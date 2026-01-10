/**
 * VERSION 1.2
 * A-CURSOR NAVIGATION - A-Frame Teleportation System
 * 
 * COMPONENTS:
 *   navmesh          - Mark surfaces as teleportable
 *   raycast-exclude  - Prevent objects from blocking teleport rays
 *   a-cursor-teleport - Main teleportation (attach to a-camera)
 *   go-to            - Click to navigate to preset position
 * 
 * EXAMPLE (teleport):
 *   <a-camera a-cursor-teleport="cameraHeight: 1.6">
 *     <a-cursor></a-cursor>
 *   </a-camera>
 *   <a-plane navmesh rotation="-90 0 0" width="20" height="20"></a-plane>
 *   <a-box raycast-exclude position="0 1 -3"></a-box>
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
// Attach directly to <a-camera> - no rig setup needed
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

        // Find camera rig - A-Frame wraps a-camera in a rig automatically
        this.cameraEl = this.el.components.camera ? this.el : this.el.querySelector('[camera]');
        this.rigEl = this.cameraEl?.parentEl?.classList?.contains('a-entity') 
            ? this.cameraEl.parentEl 
            : this.cameraEl;
        
        // Fallback: if we're on the rig itself, find the camera
        if (!this.cameraEl && this.el.querySelector('[camera]')) {
            this.cameraEl = this.el.querySelector('[camera]');
            this.rigEl = this.el;
        }

        this.log('Camera:', !!this.cameraEl, 'Rig:', !!this.rigEl);

        // Reusable THREE.js objects (prevents garbage collection)
        this.startPos = new THREE.Vector3();
        this.endPos = new THREE.Vector3();
        this.upVector = new THREE.Vector3(0, 1, 0);
        this.tempMatrix = new THREE.Matrix3();
        this.tempVec = new THREE.Vector3();

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
            this.initTunnel();
        });

        scene.addEventListener('exit-vr', () => {
            this.isVR = false;
            this.log('Exited VR');
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
        if (!this.rigEl) return;

        this.startPos.copy(this.rigEl.object3D.position);
        // Keep camera at constant height above navmesh
        this.endPos.set(point.x, point.y + this.data.cameraHeight, point.z);

        this.transitionProgress = 0;
        this.transitioning = true;
        this.el.emit('navigation-start');

        // VR tunnel animation
        if (this.isVR && this.tunnelEl) {
            this.tunnelEl.removeAttribute('animation__tunnel_down');
            this.tunnelEl.setAttribute('animation__tunnel_down', {
                property: 'scale.y',
                to: -1,
                dur: 250,
                easing: 'easeInQuad'
            });
        }
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

            this.rigEl.object3D.position.lerpVectors(this.startPos, this.endPos, eased);

            if (t >= 1) {
                this.transitioning = false;
                this.rigEl.object3D.position.copy(this.endPos);
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
// Auto-finds camera rig - no selectors needed
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

        // Auto-find camera rig
        const camera = this.el.sceneEl.querySelector('[camera]') || this.el.sceneEl.querySelector('a-camera');
        this.rigEl = camera?.parentEl?.classList?.contains('a-entity') ? camera.parentEl : camera;
        
        this.tunnelEl = null;
        this.startQuat = new THREE.Quaternion();
        this.endQuat = new THREE.Quaternion();
        this.animatingRotation = false;
        this.rotationStartTime = 0;

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
        const startPos = this.rigEl.object3D.position.clone();
        const { position, rotation, duration, easing } = this.data;

        // Check if rotation is specified
        const hasRotation = Math.abs(rotation.x) > 0.001 || 
                           Math.abs(rotation.y) > 0.001 || 
                           Math.abs(rotation.z) > 0.001;

        if (hasRotation) {
            this.startQuat.copy(this.rigEl.object3D.quaternion);
            this.endQuat.setFromEuler(new THREE.Euler(
                THREE.MathUtils.degToRad(rotation.x),
                THREE.MathUtils.degToRad(rotation.y),
                THREE.MathUtils.degToRad(rotation.z),
                'YXZ'
            ));
            this.animatingRotation = true;
            this.rotationStartTime = performance.now();
        }

        this.rigEl.removeAttribute('animation__go');
        this.rigEl.setAttribute('animation__go', {
            property: 'position',
            dur: duration,
            easing: easing,
            from: `${startPos.x} ${startPos.y} ${startPos.z}`,
            to: `${position.x} ${position.y} ${position.z}`
        });

        this.log('Moving to', position);

        this.rigEl.addEventListener('animationcomplete__go', () => this.onAnimEnd(), { once: true });
    },

    onAnimEnd() {
        if (this.animatingRotation) {
            this.rigEl.object3D.quaternion.copy(this.endQuat);
            this.animatingRotation = false;
        }

        this.tunnelUp();
        this.rigEl.emit('go-to-complete');
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
        if (!this.animatingRotation) return;

        const elapsed = performance.now() - this.rotationStartTime;
        const progress = Math.min(elapsed / this.data.duration, 1);
        const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        this.rigEl.object3D.quaternion.slerpQuaternions(this.startQuat, this.endQuat, eased);

        if (progress >= 1) {
            this.animatingRotation = false;
            this.rigEl.object3D.quaternion.copy(this.endQuat);
        }
    },

    remove() {
        this.el.removeEventListener('click', this.onClick);
    }
});

// ============================================================================
// SAVE-POSITION-AND-ROTATION COMPONENT
// Persists camera position/rotation to localStorage
// Auto-finds camera - no selectors needed
// ============================================================================
AFRAME.registerComponent("save-position-and-rotation", {
    init() {
        const camera = this.el.sceneEl.querySelector('[camera]') || this.el.sceneEl.querySelector('a-camera');
        this.rigEl = camera?.parentEl?.classList?.contains('a-entity') ? camera.parentEl : camera;

        this.saveInterval = setInterval(() => {
            try {
                if (this.rigEl) {
                    localStorage.setItem('cameraPosition', JSON.stringify(this.rigEl.getAttribute('position')));
                    localStorage.setItem('cameraRotation', JSON.stringify(camera.getAttribute('rotation')));
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
        console.log('Cursor:', !!cursor);
        console.log('Navmeshes:', navmeshes.length);

        const teleportComp = camera?.components['a-cursor-teleport'] || camera?.parentEl?.components['a-cursor-teleport'];
        if (teleportComp) {
            console.log('Teleport active, VR mode:', teleportComp.isVR);
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
