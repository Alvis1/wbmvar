/**
 * VERSION 1.4
 * A-CURSOR NAVIGATION - A-Frame Teleportation System
 * FULLY COMPATIBLE with hand tracking and grabbing in VR
 * 
 * COMPONENTS:
 *   navmesh          - Mark surfaces as teleportable
 *   raycast-exclude  - Prevent objects from blocking teleport rays
 *   a-cursor-teleport - Main teleportation (attach to a-camera)
 *   go-to            - Click to navigate to preset position
 * 
 * EXAMPLE (teleport with hand tracking):
 *   <a-camera a-cursor-teleport="cameraHeight: 1.6">
 *     <a-cursor></a-cursor>
 *   </a-camera>
 *   <a-entity hand-tracking-grab-controls="hand: left;"></a-entity>
 *   <a-entity hand-tracking-grab-controls="hand: right;"></a-entity>
 *   <a-plane navmesh rotation="-90 0 0" width="20" height="20"></a-plane>
 * 
 * EXAMPLE (go-to):
 *   <a-sphere go-to="position: 5 0 -10; rotation: 0 90 0" 
 *             position="5 1 -10" radius="0.3" color="yellow"></a-sphere>
 * 
 * OPTIONS (a-cursor-teleport):
 *   cameraHeight    - Height above navmesh (default: 1.6)
 *   landingMaxAngle - Max surface angle in degrees (default: 45)
 *   transitionSpeed - Teleport speed (default: 0.0006)
 *   cursorColor     - Indicator color (default: #00ff00)
 *   cursorOpacity   - Indicator opacity (default: 0.8)
 *   dragThreshold   - Pixels to distinguish drag from click (default: 8)
 * 
 * OPTIONS (go-to):
 *   position - Target position x y z
 *   rotation - Target rotation x y z in degrees (default: 0 0 0)
 *   duration - Animation duration in ms (default: 2000)
 *   easing   - Animation easing (default: easeInOutQuad)
 * 
 * VR HAND TRACKING NOTE:
 *   Uses WebXR reference space offsetting for VR teleportation.
 *   This moves the ENTIRE VR coordinate system (camera + hands together),
 *   so grabbed objects stay correctly positioned during/after teleport.
 *   No rig structure needed - just a simple <a-camera> works.
 * 
 * DEBUG: Add ?debug=true to URL for console logging
 */

// Debug helper
const createLogger = (prefix, enabled) => (...args) => enabled && console.log(prefix, ...args);

// ============================================================================
// NAVMESH COMPONENT
// Marks surfaces as valid teleport destinations
// ============================================================================
AFRAME.registerComponent("navmesh", {
    init() {
        this.markMeshes = () => {
            this.el.object3D.traverse(obj => {
                if (obj.isMesh) {
                    obj.userData.isNavmesh = true;
                    obj.userData.collision = true;
                }
            });
        };
        this.markMeshes();
        this.el.addEventListener('model-loaded', this.markMeshes);
    },

    remove() {
        this.el.removeEventListener('model-loaded', this.markMeshes);
    }
});

// ============================================================================
// RAYCAST-EXCLUDE COMPONENT
// Prevents objects from blocking teleportation rays
// ============================================================================
AFRAME.registerComponent("raycast-exclude", {
    init() {
        this.markExcluded = () => {
            this.el.object3D.traverse(obj => {
                if (obj.isMesh) obj.userData.raycastExclude = true;
            });
        };
        this.markExcluded();
        this.el.addEventListener('model-loaded', this.markExcluded);
    },

    remove() {
        this.el.removeEventListener('model-loaded', this.markExcluded);
    }
});

// ============================================================================
// A-CURSOR-TELEPORT COMPONENT
// Main teleportation system using a-cursor
// Attach directly to <a-camera> - works with hand tracking in VR
// ============================================================================
AFRAME.registerComponent("a-cursor-teleport", {
    schema: {
        cameraHeight: { type: "number", default: 1.6 },
        landingMaxAngle: { type: "number", default: 45 },
        transitionSpeed: { type: "number", default: 0.0006 },
        cursorColor: { type: "color", default: "#00ff00" },
        cursorOpacity: { type: "number", default: 0.8 },
        dragThreshold: { type: "number", default: 8 }
    },

    init() {
        this.debug = location.search.includes('debug=true');
        this.log = createLogger('[teleport]', this.debug);
        this.log('Initializing');

        this.isVR = false;
        this.transitioning = false;
        this.transitionProgress = 0;
        this.isDragging = false;

        // Store reference to the element this component is attached to
        this.cameraEl = this.el;
        
        // For VR: we need to move a parent container, not the camera itself
        // A-Frame automatically wraps a-camera in a rig, we'll find or create one
        this.rigEl = null;
        this.vrRigOffset = new THREE.Vector3();
        
        this.log('Camera element:', this.cameraEl.tagName);

        // Reusable THREE.js objects (prevents garbage collection)
        this.startPos = new THREE.Vector3();
        this.endPos = new THREE.Vector3();
        this.upVector = new THREE.Vector3(0, 1, 0);
        this.tempMatrix = new THREE.Matrix3();
        this.tempVec = new THREE.Vector3();
        this.headOffset = new THREE.Vector3();

        this.createIndicator();
        this.setupVRListeners();
        
        // Defer cursor setup until scene is ready
        if (this.el.sceneEl.hasLoaded) {
            this.setupCursor();
            this.setupDragDetection();
        } else {
            this.el.sceneEl.addEventListener('loaded', () => {
                this.setupCursor();
                this.setupDragDetection();
            }, { once: true });
        }
    },

    createIndicator() {
        const geometry = new THREE.RingGeometry(0.25, 0.3, 32);
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, 0.02, 0);

        this.indicator = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
            color: this.data.cursorColor,
            transparent: true,
            opacity: this.data.cursorOpacity
        }));
        this.indicator.visible = false;
        this.el.sceneEl.object3D.add(this.indicator);
        this.log('Indicator created');
    },

    setupCursor() {
        this.cursorEl = this.el.sceneEl.querySelector('a-cursor');
        
        if (!this.cursorEl?.components?.raycaster?.raycaster) {
            this.log('Cursor not ready, retrying...');
            setTimeout(() => this.setupCursor(), 200);
            return;
        }

        this.cursorRaycaster = this.cursorEl.components.raycaster;

        this.handleClick = () => {
            if (this.isDragging && !this.isVR) {
                this.log('Click ignored - was drag');
                return;
            }

            const hit = this.getValidHit();
            if (hit) {
                this.log('Teleporting to', hit.point);
                this.teleportTo(hit.point);
            }
        };

        this.cursorEl.addEventListener('click', this.handleClick);
        this.log('Cursor setup complete');
    },

    setupVRListeners() {
        const scene = this.el.sceneEl;
        
        scene.addEventListener('enter-vr', () => {
            this.isVR = true;
            this.log('Entered VR');
            
            // Store the XR reference space offset for hand-tracking compatible teleportation
            // This approach shifts the entire VR coordinate system rather than moving a rig
            this.xrReferenceSpaceOffset = new THREE.Vector3(0, 0, 0);
            
            this.initTunnel();
        });

        scene.addEventListener('exit-vr', () => {
            this.isVR = false;
            this.log('Exited VR');
            this.xrReferenceSpaceOffset = null;
        });
    },

    setupDragDetection() {
        const canvas = this.el.sceneEl.canvas;
        if (!canvas) return;

        let startX, startY;

        this.onMouseDown = (e) => {
            startX = e.clientX;
            startY = e.clientY;
            this.isDragging = false;
        };

        this.onMouseMove = (e) => {
            if (startX === undefined) return;
            const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
            if (dist > this.data.dragThreshold) this.isDragging = true;
        };

        this.onMouseUp = () => {
            setTimeout(() => this.isDragging = false, 0);
            startX = startY = undefined;
        };

        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('mouseup', this.onMouseUp);
    },

    initTunnel() {
        this.tunnelEl = this.tunnelEl || this.el.sceneEl.querySelector('#tunnel');
        if (this.tunnelEl) {
            this.tunnelEl.removeAttribute('animation__tunnel_down');
            this.tunnelEl.removeAttribute('animation__tunnel_up');
            this.tunnelEl.setAttribute('scale', '1 0.1 1');
            this.tunnelEl.setAttribute('visible', 'true');
        }
    },

    getValidHit() {
        const raycaster = this.cursorRaycaster?.raycaster;
        if (!raycaster) return null;

        // Collect all visible meshes except excluded ones
        const meshes = [];
        this.el.sceneEl.object3D.traverse(obj => {
            if (obj.isMesh && obj.visible && !obj.userData.raycastExclude) {
                meshes.push(obj);
            }
        });

        const hits = raycaster.intersectObjects(meshes, true);
        if (hits.length === 0) return null;

        // First hit must be a navmesh (occlusion check)
        const hit = hits[0];
        if (!hit.object.userData.isNavmesh || !hit.face) return null;

        // Check surface angle
        this.tempMatrix.getNormalMatrix(hit.object.matrixWorld);
        const worldNormal = this.tempVec
            .copy(hit.face.normal)
            .applyMatrix3(this.tempMatrix)
            .normalize();

        const angle = THREE.MathUtils.radToDeg(this.upVector.angleTo(worldNormal));
        if (angle > this.data.landingMaxAngle) return null;

        return { point: hit.point, normal: worldNormal };
    },

    teleportTo(point) {
        if (this.isVR) {
            // VR MODE: Use WebXR reference space offset approach
            // This moves the entire VR coordinate system (camera + hands together)
            // so grabbed objects stay correctly positioned
            this.teleportVR(point);
        } else {
            // DESKTOP MODE: Move the camera element directly
            this.teleportDesktop(point);
        }
    },
    
    teleportVR(point) {
        const renderer = this.el.sceneEl.renderer;
        const xrManager = renderer?.xr;
        
        if (!xrManager?.isPresenting) {
            this.log('XR not presenting, falling back to desktop teleport');
            this.teleportDesktop(point);
            return;
        }
        
        // Get current camera world position (where user's head actually is)
        const camera = this.el.sceneEl.camera;
        if (!camera) return;
        
        camera.getWorldPosition(this.headOffset);
        
        // Calculate the delta we need to move
        // Target: point + cameraHeight
        // Current: camera world position
        const deltaX = point.x - this.headOffset.x;
        const deltaY = (point.y + this.data.cameraHeight) - this.headOffset.y;
        const deltaZ = point.z - this.headOffset.z;
        
        this.startPos.set(0, 0, 0);
        this.endPos.set(deltaX, deltaY, deltaZ);
        
        // Store for animation - we'll apply offset incrementally
        this.vrTeleportDelta = new THREE.Vector3(deltaX, deltaY, deltaZ);
        this.vrTeleportApplied = new THREE.Vector3(0, 0, 0);
        
        this.transitionProgress = 0;
        this.transitioning = true;
        this.useVROffset = true;
        this.el.emit('navigation-start');
        
        // VR tunnel animation
        if (this.tunnelEl) {
            this.tunnelEl.removeAttribute('animation__tunnel_down');
            this.tunnelEl.setAttribute('animation__tunnel_down', {
                property: 'scale.y',
                to: -1,
                dur: 250,
                easing: 'easeInQuad'
            });
        }
        
        this.log('VR Teleporting, delta:', deltaX.toFixed(2), deltaY.toFixed(2), deltaZ.toFixed(2));
    },
    
    teleportDesktop(point) {
        const moveTarget = this.cameraEl.object3D;
        
        if (!moveTarget) {
            this.log('Error: No move target found');
            return;
        }

        this.moveTarget = moveTarget;
        this.startPos.copy(moveTarget.position);
        this.endPos.set(point.x, point.y + this.data.cameraHeight, point.z);

        this.transitionProgress = 0;
        this.transitioning = true;
        this.useVROffset = false;
        this.el.emit('navigation-start');
        
        this.log('Desktop teleporting from', this.startPos.toArray(), 'to', this.endPos.toArray());
    },
    
    // Apply offset to the XR reference space (moves camera + hands together)
    applyVROffset(offset) {
        const renderer = this.el.sceneEl.renderer;
        const xrManager = renderer?.xr;
        
        if (!xrManager?.isPresenting) return;
        
        // Get the current reference space
        const baseReferenceSpace = xrManager.getReferenceSpace();
        if (!baseReferenceSpace) return;
        
        // Create an offset transform
        // Note: XRRigidTransform uses position as {x, y, z, w} for DOMPointReadOnly
        const offsetTransform = new XRRigidTransform(
            { x: -offset.x, y: -offset.y, z: -offset.z, w: 1 },
            { x: 0, y: 0, z: 0, w: 1 }
        );
        
        // Apply the offset to get a new reference space
        const offsetReferenceSpace = baseReferenceSpace.getOffsetReferenceSpace(offsetTransform);
        
        // Set the new reference space
        xrManager.setReferenceSpace(offsetReferenceSpace);
        
        this.log('Applied VR offset:', offset.x.toFixed(2), offset.y.toFixed(2), offset.z.toFixed(2));
    },

    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },

    tick(time, delta) {
        // Update indicator when not transitioning
        if (!this.transitioning) {
            const hit = this.getValidHit();
            const wasHidden = !this.indicator.visible;
            this.indicator.visible = !!hit;
            
            if (hit) {
                // Snap to position if indicator just appeared, otherwise lerp smoothly
                if (wasHidden) {
                    this.indicator.position.copy(hit.point);
                } else {
                    this.indicator.position.lerp(hit.point, 0.3);
                }
            }
        }

        // Animate transition
        if (this.transitioning) {
            this.transitionProgress += delta * this.data.transitionSpeed;
            const t = Math.min(this.transitionProgress, 1);
            const eased = this.easeInOutQuad(t);

            if (this.useVROffset && this.vrTeleportDelta) {
                // VR mode: Apply incremental offset to XR reference space
                // Calculate how much we should have moved by now
                const targetApplied = this.tempVec.copy(this.vrTeleportDelta).multiplyScalar(eased);
                
                // Calculate the delta from what we've already applied
                const incrementalOffset = new THREE.Vector3().subVectors(targetApplied, this.vrTeleportApplied);
                
                if (incrementalOffset.lengthSq() > 0.0001) {
                    this.applyVROffset(incrementalOffset);
                    this.vrTeleportApplied.copy(targetApplied);
                }
            } else if (this.moveTarget) {
                // Desktop mode: Move the camera directly
                this.moveTarget.position.lerpVectors(this.startPos, this.endPos, eased);
            }

            if (t >= 1) {
                this.transitioning = false;
                
                if (this.useVROffset && this.vrTeleportDelta) {
                    // Apply any remaining offset
                    const remaining = new THREE.Vector3().subVectors(this.vrTeleportDelta, this.vrTeleportApplied);
                    if (remaining.lengthSq() > 0.0001) {
                        this.applyVROffset(remaining);
                    }
                    this.vrTeleportDelta = null;
                    this.vrTeleportApplied = null;
                } else if (this.moveTarget) {
                    this.moveTarget.position.copy(this.endPos);
                }
                
                this.el.emit('navigation-end');

                // VR tunnel up animation
                if (this.isVR && this.tunnelEl) {
                    this.tunnelEl.removeAttribute('animation__tunnel_up');
                    this.tunnelEl.setAttribute('animation__tunnel_up', {
                        property: 'scale.y',
                        to: -0.1,
                        dur: 500,
                        easing: 'easeOutQuad'
                    });
                }
            }
        }
    },

    update(oldData) {
        if (this.indicator) {
            if (oldData.cursorColor !== this.data.cursorColor) {
                this.indicator.material.color.set(this.data.cursorColor);
            }
            if (oldData.cursorOpacity !== this.data.cursorOpacity) {
                this.indicator.material.opacity = this.data.cursorOpacity;
            }
        }
    },

    remove() {
        // Cleanup indicator
        if (this.indicator) {
            this.el.sceneEl.object3D.remove(this.indicator);
            this.indicator.geometry.dispose();
            this.indicator.material.dispose();
        }

        // Cleanup event listeners
        if (this.cursorEl && this.handleClick) {
            this.cursorEl.removeEventListener('click', this.handleClick);
        }

        const canvas = this.el.sceneEl?.canvas;
        if (canvas) {
            canvas.removeEventListener('mousedown', this.onMouseDown);
            canvas.removeEventListener('mousemove', this.onMouseMove);
            canvas.removeEventListener('mouseup', this.onMouseUp);
        }
    }
});

// ============================================================================
// GO-TO COMPONENT
// Click to navigate to predefined position/rotation
// Uses WebXR reference space offset in VR for hand tracking compatibility
// ============================================================================
AFRAME.registerComponent("go-to", {
    schema: {
        position: { type: "vec3" },
        rotation: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
        duration: { type: "number", default: 2000 },
        easing: { type: "string", default: "easeInOutQuad" }
    },

    init() {
        this.debug = location.search.includes('debug=true');
        this.log = createLogger('[go-to]', this.debug);

        // Auto-find camera element
        this.cameraEl = this.el.sceneEl.querySelector('[camera]') || this.el.sceneEl.querySelector('a-camera');
        this.isVR = false;
        
        this.tunnelEl = null;
        this.startQuat = new THREE.Quaternion();
        this.endQuat = new THREE.Quaternion();
        this.animatingRotation = false;
        this.rotationStartTime = 0;
        
        // Reusable vectors for VR offset
        this.headOffset = new THREE.Vector3();
        this.tempVec = new THREE.Vector3();
        this.vrTeleportDelta = null;
        this.vrTeleportApplied = null;
        
        // VR mode tracking
        this.el.sceneEl.addEventListener('enter-vr', () => { this.isVR = true; });
        this.el.sceneEl.addEventListener('exit-vr', () => { this.isVR = false; });

        this.onClick = this.onClick.bind(this);
        this.el.addEventListener('click', this.onClick);
    },

    onClick(evt) {
        if (!evt.detail?.intersection) return;

        this.tunnelEl = this.tunnelEl || this.el.sceneEl.querySelector('#tunnel');
        
        if (this.tunnelEl) {
            this.tunnelEl.removeAttribute('animation__down');
            this.tunnelEl.setAttribute('animation__down', {
                property: 'scale.y',
                to: -1,
                dur: 500,
                easing: this.data.easing
            });
        }

        this.moveCamera();
    },

    moveCamera() {
        const { position, rotation, duration } = this.data;

        // Check if rotation is specified (only works in desktop mode)
        const hasRotation = Math.abs(rotation.x) > 0.001 || 
                           Math.abs(rotation.y) > 0.001 || 
                           Math.abs(rotation.z) > 0.001;
        
        if (this.isVR) {
            // VR MODE: Use WebXR reference space offset
            this.moveCameraVR(position);
        } else {
            // DESKTOP MODE: Move camera directly
            this.moveCameraDesktop(position, hasRotation ? rotation : null);
        }
        
        this.log('Moving to', position, 'VR:', this.isVR);
    },
    
    moveCameraVR(targetPosition) {
        const renderer = this.el.sceneEl.renderer;
        const xrManager = renderer?.xr;
        
        if (!xrManager?.isPresenting) {
            this.log('XR not presenting, falling back to desktop');
            this.moveCameraDesktop(targetPosition, null);
            return;
        }
        
        // Get current camera world position
        const camera = this.el.sceneEl.camera;
        if (!camera) return;
        
        camera.getWorldPosition(this.headOffset);
        
        // Calculate delta to target
        const deltaX = targetPosition.x - this.headOffset.x;
        const deltaY = targetPosition.y - this.headOffset.y;
        const deltaZ = targetPosition.z - this.headOffset.z;
        
        this.vrTeleportDelta = new THREE.Vector3(deltaX, deltaY, deltaZ);
        this.vrTeleportApplied = new THREE.Vector3(0, 0, 0);
        
        this.animating = true;
        this.useVROffset = true;
        this.animationStartTime = performance.now();
    },
    
    moveCameraDesktop(targetPosition, targetRotation) {
        const moveTarget = this.cameraEl?.object3D;
        if (!moveTarget) return;
        
        this.currentMoveTarget = moveTarget;
        this.animationStartPos = moveTarget.position.clone();
        this.animationEndPos = new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z);
        
        if (targetRotation) {
            this.startQuat.copy(moveTarget.quaternion);
            this.endQuat.setFromEuler(new THREE.Euler(
                THREE.MathUtils.degToRad(targetRotation.x),
                THREE.MathUtils.degToRad(targetRotation.y),
                THREE.MathUtils.degToRad(targetRotation.z),
                'YXZ'
            ));
            this.animatingRotation = true;
            this.rotationStartTime = performance.now();
        }
        
        this.animating = true;
        this.useVROffset = false;
        this.animationStartTime = performance.now();
    },
    
    // Apply offset to WebXR reference space
    applyVROffset(offset) {
        const renderer = this.el.sceneEl.renderer;
        const xrManager = renderer?.xr;
        
        if (!xrManager?.isPresenting) return;
        
        const baseReferenceSpace = xrManager.getReferenceSpace();
        if (!baseReferenceSpace) return;
        
        const offsetTransform = new XRRigidTransform(
            { x: -offset.x, y: -offset.y, z: -offset.z, w: 1 },
            { x: 0, y: 0, z: 0, w: 1 }
        );
        
        const offsetReferenceSpace = baseReferenceSpace.getOffsetReferenceSpace(offsetTransform);
        xrManager.setReferenceSpace(offsetReferenceSpace);
    },
    
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },

    onAnimEnd() {
        if (this.currentMoveTarget && this.animatingRotation) {
            this.currentMoveTarget.quaternion.copy(this.endQuat);
            this.animatingRotation = false;
        }
        
        this.vrTeleportDelta = null;
        this.vrTeleportApplied = null;

        this.tunnelUp();
        if (this.cameraEl) {
            this.cameraEl.emit('go-to-complete');
        }
    },

    tunnelUp() {
        if (this.tunnelEl) {
            this.tunnelEl.removeAttribute('animation__up');
            this.tunnelEl.setAttribute('animation__up', {
                property: 'scale.y',
                to: 0.1,
                dur: 500,
                easing: this.data.easing
            });
        }
    },

    tick() {
        if (!this.animating) return;
        
        const elapsed = performance.now() - this.animationStartTime;
        const progress = Math.min(elapsed / this.data.duration, 1);
        const eased = this.easeInOutQuad(progress);
        
        if (this.useVROffset && this.vrTeleportDelta) {
            // VR mode: Apply incremental offset to XR reference space
            const targetApplied = this.tempVec.copy(this.vrTeleportDelta).multiplyScalar(eased);
            const incrementalOffset = new THREE.Vector3().subVectors(targetApplied, this.vrTeleportApplied);
            
            if (incrementalOffset.lengthSq() > 0.0001) {
                this.applyVROffset(incrementalOffset);
                this.vrTeleportApplied.copy(targetApplied);
            }
        } else if (this.currentMoveTarget) {
            // Desktop mode: Move camera directly
            this.currentMoveTarget.position.lerpVectors(this.animationStartPos, this.animationEndPos, eased);
            
            // Handle rotation animation
            if (this.animatingRotation) {
                this.currentMoveTarget.quaternion.slerpQuaternions(this.startQuat, this.endQuat, eased);
            }
        }
        
        if (progress >= 1) {
            this.animating = false;
            
            if (this.useVROffset && this.vrTeleportDelta) {
                // Apply remaining offset
                const remaining = new THREE.Vector3().subVectors(this.vrTeleportDelta, this.vrTeleportApplied);
                if (remaining.lengthSq() > 0.0001) {
                    this.applyVROffset(remaining);
                }
            } else if (this.currentMoveTarget) {
                this.currentMoveTarget.position.copy(this.animationEndPos);
                if (this.animatingRotation) {
                    this.currentMoveTarget.quaternion.copy(this.endQuat);
                    this.animatingRotation = false;
                }
            }
            
            this.onAnimEnd();
        }
    },

    remove() {
        this.el.removeEventListener('click', this.onClick);
    }
});

// ============================================================================
// SAVE-POSITION-AND-ROTATION COMPONENT
// Persists camera position/rotation to localStorage
// Works in both desktop and VR modes
// ============================================================================
AFRAME.registerComponent("save-position-and-rotation", {
    init() {
        this.cameraEl = this.el.sceneEl.querySelector('[camera]') || this.el.sceneEl.querySelector('a-camera');
        this.isVR = false;
        
        this.el.sceneEl.addEventListener('enter-vr', () => { this.isVR = true; });
        this.el.sceneEl.addEventListener('exit-vr', () => { this.isVR = false; });

        this.saveInterval = setInterval(() => {
            try {
                const target = this.isVR 
                    ? (this.cameraEl?.object3D?.parent || this.cameraEl?.object3D)
                    : this.cameraEl?.object3D;
                    
                if (target) {
                    localStorage.setItem('cameraPosition', JSON.stringify({
                        x: target.position.x,
                        y: target.position.y,
                        z: target.position.z
                    }));
                }
                if (this.cameraEl) {
                    localStorage.setItem('cameraRotation', JSON.stringify(this.cameraEl.getAttribute('rotation')));
                }
            } catch (e) {
                // Storage may be unavailable
            }
        }, 5000);
    },

    remove() {
        clearInterval(this.saveInterval);
    }
});

// ============================================================================
// DIAGNOSTIC UTILITY (debug mode only)
// ============================================================================
window.TeleportDiagnostic = {
    run() {
        if (!location.search.includes('debug=true')) return;

        console.log('=== TELEPORT DIAGNOSTIC ===');
        const scene = document.querySelector('a-scene');
        const camera = document.querySelector('[camera]') || document.querySelector('a-camera');
        const cursor = document.querySelector('a-cursor');
        const navmeshes = document.querySelectorAll('[navmesh]');

        console.log('Scene:', !!scene);
        console.log('Camera:', !!camera);
        console.log('Camera parent:', camera?.object3D?.parent?.type);
        console.log('Cursor:', !!cursor);
        console.log('Navmeshes:', navmeshes.length);

        const teleportComp = camera?.components['a-cursor-teleport'];
        if (teleportComp) {
            console.log('Teleport active, VR mode:', teleportComp.isVR);
            console.log('VR Camera rig:', !!teleportComp.vrCameraRig);
            console.log('Move target:', !!teleportComp.moveTarget);
        }
        console.log('=== END DIAGNOSTIC ===');
    }
};

// Auto-run diagnostic in debug mode
if (location.search.includes('debug=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(window.TeleportDiagnostic.run, 2000);
    });
}
