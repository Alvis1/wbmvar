/**
 * A-CURSOR NAVIGATION v2.0
 * A-Frame Teleportation System (Desktop + VR with hand tracking)
 *
 * QUICK START:
 *   <a-camera a-cursor-teleport><a-cursor></a-cursor></a-camera>
 *   <a-plane navmesh rotation="-90 0 0" width="20" height="20"></a-plane>
 *
 * WITH RIG (recommended):
 *   <a-entity id="rig">
 *     <a-camera a-cursor-teleport="cameraHeight: 0"><a-cursor></a-cursor></a-camera>
 *   </a-entity>
 *   <a-plane navmesh rotation="-90 0 0"></a-plane>
 *
 * GO-TO WAYPOINTS:
 *   <a-sphere go-to="position: 5 0 -10; rotation: 0 90 0" position="5 1 -10"></a-sphere>
 *
 * COMPONENTS:
 *   navmesh           - Mark as teleportable surface
 *   raycast-exclude   - Ignore in teleport raycasts
 *   a-cursor-teleport - Main teleport system (on camera)
 *   go-to             - Click to navigate to position
 *
 * SETTINGS (a-cursor-teleport):
 *   cameraHeight      : 1.6    - Height above navmesh (desktop without rig)
 *   landingMaxAngle   : 360    - Max surface angle in degrees
 *   transitionSpeed   : 0.0006 - Teleport animation speed
 *   cursorColor       : #00ff00
 *   cursorOpacity     : 0.8
 *   dragThreshold     : 8      - Pixels before click becomes drag
 *   alignToSurface    : true   - Tilt to match surface normal
 *   rotationSmoothing : 1.0    - Rotation lerp factor (0-1)
 *
 * TUNNEL VIGNETTE (motion sickness reduction):
 *   tunnelEnabled     : true   - Enable/disable vignette effect
 *   tunnelRadius      : 0.4    - Inner clear vision radius (0-1)
 *   tunnelSoftness    : 0.3    - Edge softness/gradient width
 *   tunnelOpacity     : 0.95   - Max darkness of vignette (0-1)
 *   tunnelColor       : #000000 - Vignette color
 *   tunnelFadeIn      : 200    - Duration to close vignette (ms)
 *   tunnelFadeOut     : 400    - Duration to open vignette (ms)
 *
 * SETTINGS (go-to):
 *   position : vec3   - Target position
 *   rotation : vec3   - Target rotation (degrees)
 *   duration : 2000   - Animation duration (ms)
 *   easing   : easeInOutQuad
 *
 * DEBUG: Add ?debug=true to URL
 */

(() => {
  "use strict";

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  const DEFAULTS = {
    CAMERA_HEIGHT: 1.6,
    LANDING_MAX_ANGLE: 360,
    TRANSITION_SPEED: 0.0006,
    CURSOR_COLOR: "#00ff00",
    CURSOR_OPACITY: 0.8,
    DRAG_THRESHOLD: 8,
    INDICATOR_INNER_RADIUS: 0.25,
    INDICATOR_OUTER_RADIUS: 0.3,
    INDICATOR_SEGMENTS: 32,
    INDICATOR_Y_OFFSET: 0.02,
    INDICATOR_LERP_FACTOR: 0.3,
    CURSOR_RETRY_DELAY: 200,
    SAVE_INTERVAL: 5000,
    GO_TO_DURATION: 2000,
    // Tunnel vignette settings for motion sickness reduction
    TUNNEL_ENABLED: true,
    TUNNEL_RADIUS: 0.15, // Inner radius of clear vision (0-1)
    TUNNEL_SOFTNESS: 0.1, // Softness of vignette edge
    TUNNEL_OPACITY: 1, // Max darkness of vignette
    TUNNEL_COLOR: "#000000", // Vignette color
    TUNNEL_FADE_IN: 200, // ms to close vignette
    TUNNEL_FADE_OUT: 400, // ms to open vignette
  };

  // ============================================================================
  // SHARED UTILITIES
  // ============================================================================
  const isDebug = () => location.search.includes("debug=true");

  const createLogger = (prefix) => {
    const enabled = isDebug();
    return (...args) => enabled && console.log(prefix, ...args);
  };

  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  // Factory for navmesh/raycast-exclude style components
  const createMeshMarkerComponent = (userDataKey, userDataValue = true) => ({
    init() {
      this._markMeshes = () => {
        this.el.object3D.traverse((obj) => {
          if (obj.isMesh) obj.userData[userDataKey] = userDataValue;
        });
      };
      this._markMeshes();
      this.el.addEventListener("model-loaded", this._markMeshes);
    },
    remove() {
      this.el.removeEventListener("model-loaded", this._markMeshes);
    },
  });

  // ============================================================================
  // NAVMESH COMPONENT
  // ============================================================================
  AFRAME.registerComponent("navmesh", {
    ...createMeshMarkerComponent("isNavmesh"),
    init() {
      this._markMeshes = () => {
        this.el.object3D.traverse((obj) => {
          if (obj.isMesh) {
            obj.userData.isNavmesh = true;
            obj.userData.collision = true;
          }
        });
      };
      this._markMeshes();
      this.el.addEventListener("model-loaded", this._markMeshes);
    },
  });

  // ============================================================================
  // RAYCAST-EXCLUDE COMPONENT
  // ============================================================================
  AFRAME.registerComponent(
    "raycast-exclude",
    createMeshMarkerComponent("raycastExclude")
  );

  // ============================================================================
  // A-CURSOR-TELEPORT COMPONENT
  // ============================================================================
  AFRAME.registerComponent("a-cursor-teleport", {
    schema: {
      cameraHeight: { type: "number", default: DEFAULTS.CAMERA_HEIGHT },
      landingMaxAngle: { type: "number", default: DEFAULTS.LANDING_MAX_ANGLE },
      transitionSpeed: { type: "number", default: DEFAULTS.TRANSITION_SPEED },
      cursorColor: { type: "color", default: DEFAULTS.CURSOR_COLOR },
      cursorOpacity: { type: "number", default: DEFAULTS.CURSOR_OPACITY },
      dragThreshold: { type: "number", default: DEFAULTS.DRAG_THRESHOLD },
      alignToSurface: { type: "boolean", default: true },
      rotationSmoothing: { type: "number", default: 1.0 },
      // Tunnel vignette for motion sickness reduction
      tunnelEnabled: { type: "boolean", default: DEFAULTS.TUNNEL_ENABLED },
      tunnelRadius: { type: "number", default: DEFAULTS.TUNNEL_RADIUS },
      tunnelSoftness: { type: "number", default: DEFAULTS.TUNNEL_SOFTNESS },
      tunnelOpacity: { type: "number", default: DEFAULTS.TUNNEL_OPACITY },
      tunnelColor: { type: "color", default: DEFAULTS.TUNNEL_COLOR },
      tunnelFadeIn: { type: "number", default: DEFAULTS.TUNNEL_FADE_IN },
      tunnelFadeOut: { type: "number", default: DEFAULTS.TUNNEL_FADE_OUT },
    },

    init() {
      this.log = createLogger("[teleport]");
      this.log("Initializing");

      // State
      this.isVR = false;
      this.transitioning = false;
      this.transitionProgress = 0;
      this.isDragging = false;
      this.aligningRotation = false;

      // References
      this.cameraEl = this.el;
      this.rigEl = null;
      this.moveTarget = null;
      this.cursorEl = null;
      this.cursorRaycaster = null;
      this.tunnelEl = null;

      // Tunnel vignette state
      this.vignette = null;
      this.vignetteIntensity = 0;
      this.vignetteTargetIntensity = 0;
      this.vignetteFadeSpeed = 0;

      // Cached navmesh objects for faster raycasting
      this._navmeshCache = [];
      this._navmeshCacheDirty = true;

      // Pre-allocated THREE.js objects (reused to avoid GC)
      this._vec3 = {
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        up: new THREE.Vector3(0, 1, 0),
        temp: new THREE.Vector3(),
        currentNormal: new THREE.Vector3(0, 1, 0),
        targetNormal: new THREE.Vector3(0, 1, 0),
      };
      this._quat = {
        start: new THREE.Quaternion(),
        end: new THREE.Quaternion(),
        temp: new THREE.Quaternion(),
      };
      this._mat3 = new THREE.Matrix3();

      this._setupCameraRig();
      this._createIndicator();
      this._createVignette();
      this._setupVRListeners();
      this._setupNavmeshObserver();

      if (this.el.sceneEl.hasLoaded) {
        this._setupCursor();
        this._setupDragDetection();
      } else {
        this.el.sceneEl.addEventListener(
          "loaded",
          () => {
            this._setupCursor();
            this._setupDragDetection();
          },
          { once: true }
        );
      }
    },

    _setupNavmeshObserver() {
      // Invalidate cache when DOM changes
      this._observer = new MutationObserver(() => {
        this._navmeshCacheDirty = true;
      });
      this._observer.observe(this.el.sceneEl, {
        childList: true,
        subtree: true,
      });
    },

    _updateNavmeshCache() {
      if (!this._navmeshCacheDirty) return;

      this._navmeshCache.length = 0;
      this.el.sceneEl.object3D.traverse((obj) => {
        if (obj.isMesh && obj.visible && !obj.userData.raycastExclude) {
          this._navmeshCache.push(obj);
        }
      });
      this._navmeshCacheDirty = false;
    },

    _createIndicator() {
      const geo = new THREE.RingGeometry(
        DEFAULTS.INDICATOR_INNER_RADIUS,
        DEFAULTS.INDICATOR_OUTER_RADIUS,
        DEFAULTS.INDICATOR_SEGMENTS
      );
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, DEFAULTS.INDICATOR_Y_OFFSET, 0);

      this.indicator = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: this.data.cursorColor,
          transparent: true,
          opacity: this.data.cursorOpacity,
        })
      );
      this.indicator.visible = false;
      this.el.sceneEl.object3D.add(this.indicator);
    },

    _createVignette() {
      if (!this.data.tunnelEnabled) return;

      // Vignette shader material for tunnel vision effect
      const vignetteShader = {
        uniforms: {
          intensity: { value: 0.0 },
          radius: { value: this.data.tunnelRadius },
          softness: { value: this.data.tunnelSoftness },
          color: { value: new THREE.Color(this.data.tunnelColor) },
          opacity: { value: this.data.tunnelOpacity },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float intensity;
          uniform float radius;
          uniform float softness;
          uniform vec3 color;
          uniform float opacity;
          varying vec2 vUv;
          
          void main() {
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(vUv, center) * 2.0;
            
            // Create vignette with adjustable radius and softness
            float innerRadius = radius;
            float outerRadius = radius + softness;
            float vignette = smoothstep(innerRadius, outerRadius, dist);
            
            // Apply intensity (0 = no effect, 1 = full effect)
            float alpha = vignette * intensity * opacity;
            
            gl_FragColor = vec4(color, alpha);
          }
        `,
      };

      // Create a plane that sits in front of the camera
      const geometry = new THREE.PlaneGeometry(2, 2);
      const material = new THREE.ShaderMaterial({
        uniforms: vignetteShader.uniforms,
        vertexShader: vignetteShader.vertexShader,
        fragmentShader: vignetteShader.fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      this.vignette = new THREE.Mesh(geometry, material);
      this.vignette.frustumCulled = false;
      this.vignette.renderOrder = 9999;
      this.vignette.visible = false; // Start hidden

      // Position it close to the camera - will be adjusted when camera is ready
      this.vignette.position.set(0, 0, -0.15);
      this.vignette.scale.set(0.25, 0.25, 1);

      // Find the actual camera object and attach vignette to it
      this._attachVignetteToCamera();
    },

    _attachVignetteToCamera() {
      // Try to find the camera - it might be this element or a child
      const findCamera = () => {
        // Check if this element has a camera
        if (this.el.sceneEl.camera) {
          const cameraObject = this.el.sceneEl.camera;
          cameraObject.add(this.vignette);
          this.log("Tunnel vignette attached to scene camera");
          return true;
        }
        return false;
      };

      if (!findCamera()) {
        // Camera not ready yet, wait for it
        this.el.sceneEl.addEventListener(
          "camera-set-active",
          () => {
            findCamera();
          },
          { once: true }
        );
      }
    },

    _setupCameraRig() {
      const parent = this.cameraEl.parentElement;

      if (parent && parent !== this.el.sceneEl && parent.hasAttribute("id")) {
        this.rigEl = parent;
        this.log("Using existing rig:", parent.id);
      } else {
        this.rigEl = document.createElement("a-entity");
        this.rigEl.setAttribute("id", "camera-rig-auto");
        this.rigEl.setAttribute("position", "0 0 0");
        this.cameraEl.parentElement.insertBefore(this.rigEl, this.cameraEl);
        this.rigEl.appendChild(this.cameraEl);
        this.log("Created camera rig");
      }
    },

    _setupCursor() {
      this.cursorEl = this.el.sceneEl.querySelector("a-cursor");

      if (!this.cursorEl?.components?.raycaster?.raycaster) {
        this.log("Cursor not ready, retrying...");
        setTimeout(() => this._setupCursor(), DEFAULTS.CURSOR_RETRY_DELAY);
        return;
      }

      this.cursorRaycaster = this.cursorEl.components.raycaster;
      this._handleClick = () => {
        if (this.isDragging && !this.isVR) return;
        const hit = this._getValidHit();
        if (hit) this._teleportTo(hit.point, hit.normal);
      };
      this.cursorEl.addEventListener("click", this._handleClick);
      this.log("Cursor ready");
    },

    _setupVRListeners() {
      const scene = this.el.sceneEl;
      scene.addEventListener("enter-vr", () => {
        this.isVR = true;
        this.tunnelEl = this.tunnelEl || scene.querySelector("#tunnel");
        if (this.tunnelEl) {
          this.tunnelEl.removeAttribute("animation__tunnel_down");
          this.tunnelEl.removeAttribute("animation__tunnel_up");
          this.tunnelEl.setAttribute("scale", "1 0.1 1");
          this.tunnelEl.setAttribute("visible", "true");
        }
      });
      scene.addEventListener("exit-vr", () => {
        this.isVR = false;
      });
    },

    _setupDragDetection() {
      const canvas = this.el.sceneEl.canvas;
      if (!canvas) return;

      let startX, startY;
      const threshold = this.data.dragThreshold;

      this._onMouseDown = (e) => {
        startX = e.clientX;
        startY = e.clientY;
        this.isDragging = false;
      };

      this._onMouseMove = (e) => {
        if (startX === undefined) return;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > threshold) {
          this.isDragging = true;
        }
      };

      this._onMouseUp = () => {
        setTimeout(() => (this.isDragging = false), 0);
        startX = startY = undefined;
      };

      canvas.addEventListener("mousedown", this._onMouseDown);
      canvas.addEventListener("mousemove", this._onMouseMove);
      canvas.addEventListener("mouseup", this._onMouseUp);
    },

    _getValidHit() {
      const raycaster = this.cursorRaycaster?.raycaster;
      if (!raycaster) return null;

      this._updateNavmeshCache();
      const hits = raycaster.intersectObjects(this._navmeshCache, true);
      if (!hits.length) return null;

      const hit = hits[0];
      if (!hit.object.userData.isNavmesh || !hit.face) return null;

      // Check surface angle
      this._mat3.getNormalMatrix(hit.object.matrixWorld);
      const worldNormal = this._vec3.temp
        .copy(hit.face.normal)
        .applyMatrix3(this._mat3)
        .normalize();

      const angle = THREE.MathUtils.radToDeg(
        this._vec3.up.angleTo(worldNormal)
      );
      if (angle > this.data.landingMaxAngle) return null;

      return { point: hit.point, normal: worldNormal.clone() };
    },

    _teleportTo(point, normal) {
      const moveTarget = this.rigEl?.object3D || this.cameraEl.object3D;
      if (!moveTarget) return;

      this.moveTarget = moveTarget;
      this._vec3.start.copy(moveTarget.position);

      // In VR, headset provides height; in desktop with rig, camera offset handles it
      const addHeight = !this.isVR && !this.rigEl;
      const targetY = addHeight ? point.y + this.data.cameraHeight : point.y;
      this._vec3.end.set(point.x, targetY, point.z);

      // Setup rotation alignment
      this.aligningRotation = false;
      if (this.data.alignToSurface && normal && this.rigEl) {
        this.aligningRotation = true;
        this._quat.start.copy(moveTarget.quaternion);
        this._quat.end.setFromUnitVectors(this._vec3.up, normal);
        this._vec3.currentNormal.set(0, 1, 0);
        this._vec3.targetNormal.copy(normal);
      }

      this.transitionProgress = 0;
      this.transitioning = true;
      this.el.emit("navigation-start");

      // Trigger tunnel vignette fade in (VR only - reduces motion sickness)
      if (this.isVR && this.data.tunnelEnabled && this.vignette) {
        this.vignetteTargetIntensity = 1.0;
        this.vignetteFadeSpeed = 1.0 / (this.data.tunnelFadeIn / 1000);
      }

      // Legacy VR tunnel animation (if tunnel element exists)
      if (this.isVR && this.tunnelEl) {
        this.tunnelEl.removeAttribute("animation__tunnel_down");
        this.tunnelEl.setAttribute("animation__tunnel_down", {
          property: "scale.y",
          to: -1,
          dur: 250,
          easing: "easeInQuad",
        });
      }

      this.log(
        "Teleporting:",
        this._vec3.end
          .toArray()
          .map((n) => n.toFixed(2))
          .join(", ")
      );
    },

    tick(time, delta) {
      // Update vignette intensity
      this._updateVignette(delta);

      if (!this.transitioning) {
        this._updateIndicator();
        return;
      }

      this.transitionProgress += delta * this.data.transitionSpeed;
      const t = Math.min(this.transitionProgress, 1);
      const eased = easeInOutQuad(t);

      // Position
      this.moveTarget.position.lerpVectors(
        this._vec3.start,
        this._vec3.end,
        eased
      );

      // Rotation
      if (this.aligningRotation) {
        const rotT = Math.min(eased * this.data.rotationSmoothing, 1);
        this.moveTarget.quaternion.slerpQuaternions(
          this._quat.start,
          this._quat.end,
          rotT
        );
      }

      if (t >= 1) {
        this._finishTransition();
      }
    },

    _updateIndicator() {
      const hit = this._getValidHit();
      const wasHidden = !this.indicator.visible;
      this.indicator.visible = !!hit;

      if (!hit) return;

      if (wasHidden) {
        this.indicator.position.copy(hit.point);
      } else {
        this.indicator.position.lerp(hit.point, DEFAULTS.INDICATOR_LERP_FACTOR);
      }

      if (this.data.alignToSurface && hit.normal) {
        this._quat.temp.setFromUnitVectors(this._vec3.up, hit.normal);
        this.indicator.quaternion.slerp(
          this._quat.temp,
          DEFAULTS.INDICATOR_LERP_FACTOR
        );
      }
    },

    _finishTransition() {
      this.transitioning = false;
      this.moveTarget.position.copy(this._vec3.end);

      if (this.aligningRotation) {
        this.moveTarget.quaternion.copy(this._quat.end);
        this._vec3.currentNormal.copy(this._vec3.targetNormal);
        this.aligningRotation = false;
      }

      this.el.emit("navigation-end");

      // Trigger tunnel vignette fade out (VR only)
      if (this.isVR && this.data.tunnelEnabled && this.vignette) {
        this.vignetteTargetIntensity = 0.0;
        this.vignetteFadeSpeed = 1.0 / (this.data.tunnelFadeOut / 1000);
      }

      // Legacy VR tunnel animation
      if (this.isVR && this.tunnelEl) {
        this.tunnelEl.removeAttribute("animation__tunnel_up");
        this.tunnelEl.setAttribute("animation__tunnel_up", {
          property: "scale.y",
          to: -0.1,
          dur: 500,
          easing: "easeOutQuad",
        });
      }
    },

    _updateVignette(delta) {
      if (!this.vignette || !this.data.tunnelEnabled) return;

      const deltaSeconds = delta / 1000;

      // Animate intensity toward target
      if (this.vignetteIntensity !== this.vignetteTargetIntensity) {
        const diff = this.vignetteTargetIntensity - this.vignetteIntensity;
        const step = this.vignetteFadeSpeed * deltaSeconds;

        if (Math.abs(diff) <= step) {
          this.vignetteIntensity = this.vignetteTargetIntensity;
        } else {
          this.vignetteIntensity += Math.sign(diff) * step;
        }

        // Update shader uniform
        this.vignette.material.uniforms.intensity.value =
          this.vignetteIntensity;
      }

      // Show/hide vignette based on intensity
      this.vignette.visible = this.vignetteIntensity > 0.001;
    },

    update(oldData) {
      if (!this.indicator) return;
      if (oldData.cursorColor !== this.data.cursorColor) {
        this.indicator.material.color.set(this.data.cursorColor);
      }
      if (oldData.cursorOpacity !== this.data.cursorOpacity) {
        this.indicator.material.opacity = this.data.cursorOpacity;
      }
    },

    remove() {
      if (this.indicator) {
        this.el.sceneEl.object3D.remove(this.indicator);
        this.indicator.geometry.dispose();
        this.indicator.material.dispose();
      }
      // Clean up vignette
      if (this.vignette) {
        if (this.vignette.parent) {
          this.vignette.parent.remove(this.vignette);
        }
        this.vignette.geometry.dispose();
        this.vignette.material.dispose();
        this.vignette = null;
      }
      if (this.cursorEl && this._handleClick) {
        this.cursorEl.removeEventListener("click", this._handleClick);
      }
      if (this._observer) {
        this._observer.disconnect();
      }
      const canvas = this.el.sceneEl?.canvas;
      if (canvas) {
        canvas.removeEventListener("mousedown", this._onMouseDown);
        canvas.removeEventListener("mousemove", this._onMouseMove);
        canvas.removeEventListener("mouseup", this._onMouseUp);
      }
    },
  });

  // ============================================================================
  // GO-TO COMPONENT
  // ============================================================================
  AFRAME.registerComponent("go-to", {
    schema: {
      position: { type: "vec3" },
      rotation: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
      duration: { type: "number", default: DEFAULTS.GO_TO_DURATION },
      easing: { type: "string", default: "easeInOutQuad" },
    },

    init() {
      this.log = createLogger("[go-to]");

      this.cameraEl =
        this.el.sceneEl.querySelector("[camera]") ||
        this.el.sceneEl.querySelector("a-camera");
      this.tunnelEl = null;
      this.isVR = false;
      this.animating = false;
      this.useVROffset = false;

      // Pre-allocated objects
      this._startPos = new THREE.Vector3();
      this._endPos = new THREE.Vector3();
      this._startQuat = new THREE.Quaternion();
      this._endQuat = new THREE.Quaternion();
      this._headOffset = new THREE.Vector3();
      this._tempVec = new THREE.Vector3();
      this._vrDelta = null;
      this._vrApplied = null;

      this.el.sceneEl.addEventListener("enter-vr", () => (this.isVR = true));
      this.el.sceneEl.addEventListener("exit-vr", () => (this.isVR = false));

      this._onClick = this._onClick.bind(this);
      this.el.addEventListener("click", this._onClick);
    },

    _onClick(evt) {
      if (!evt.detail?.intersection) return;

      this.tunnelEl = this.tunnelEl || this.el.sceneEl.querySelector("#tunnel");
      if (this.tunnelEl) {
        this.tunnelEl.removeAttribute("animation__down");
        this.tunnelEl.setAttribute("animation__down", {
          property: "scale.y",
          to: -1,
          dur: 500,
          easing: this.data.easing,
        });
      }

      const { position, rotation } = this.data;
      const hasRotation =
        Math.abs(rotation.x) + Math.abs(rotation.y) + Math.abs(rotation.z) >
        0.001;

      if (this.isVR) {
        this._moveVR(position);
      } else {
        this._moveDesktop(position, hasRotation ? rotation : null);
      }
    },

    _moveVR(targetPosition) {
      const xrManager = this.el.sceneEl.renderer?.xr;
      if (!xrManager?.isPresenting) {
        this._moveDesktop(targetPosition, null);
        return;
      }

      const camera = this.el.sceneEl.camera;
      if (!camera) return;

      camera.getWorldPosition(this._headOffset);
      this._vrDelta = new THREE.Vector3(
        targetPosition.x - this._headOffset.x,
        targetPosition.y - this._headOffset.y,
        targetPosition.z - this._headOffset.z
      );
      this._vrApplied = new THREE.Vector3();

      this.animating = true;
      this.useVROffset = true;
      this._animStart = performance.now();
    },

    _moveDesktop(targetPosition, targetRotation) {
      // Find the rig (parent of camera) - move rig instead of camera
      const cameraParent = this.cameraEl?.parentElement;
      const rigEl =
        cameraParent &&
        cameraParent !== this.el.sceneEl &&
        cameraParent.hasAttribute("id")
          ? cameraParent
          : null;

      const target = rigEl?.object3D || this.cameraEl?.object3D;
      if (!target) return;

      this._moveTarget = target;
      this._startPos.copy(target.position);
      this._endPos.set(targetPosition.x, targetPosition.y, targetPosition.z);

      this._animateRotation = false;
      if (targetRotation) {
        this._animateRotation = true;
        this._startQuat.copy(target.quaternion);
        this._endQuat.setFromEuler(
          new THREE.Euler(
            THREE.MathUtils.degToRad(targetRotation.x),
            THREE.MathUtils.degToRad(targetRotation.y),
            THREE.MathUtils.degToRad(targetRotation.z),
            "YXZ"
          )
        );
      }

      this.animating = true;
      this.useVROffset = false;
      this._animStart = performance.now();
    },

    _applyVROffset(offset) {
      const xrManager = this.el.sceneEl.renderer?.xr;
      if (!xrManager?.isPresenting) return;

      const baseSpace = xrManager.getReferenceSpace();
      if (!baseSpace) return;

      const transform = new XRRigidTransform(
        { x: -offset.x, y: -offset.y, z: -offset.z, w: 1 },
        { x: 0, y: 0, z: 0, w: 1 }
      );
      xrManager.setReferenceSpace(baseSpace.getOffsetReferenceSpace(transform));
    },

    tick() {
      if (!this.animating) return;

      const progress = Math.min(
        (performance.now() - this._animStart) / this.data.duration,
        1
      );
      const eased = easeInOutQuad(progress);

      if (this.useVROffset && this._vrDelta) {
        const target = this._tempVec.copy(this._vrDelta).multiplyScalar(eased);
        const increment = new THREE.Vector3().subVectors(
          target,
          this._vrApplied
        );
        if (increment.lengthSq() > 0.0001) {
          this._applyVROffset(increment);
          this._vrApplied.copy(target);
        }
      } else if (this._moveTarget) {
        this._moveTarget.position.lerpVectors(
          this._startPos,
          this._endPos,
          eased
        );
        if (this._animateRotation) {
          this._moveTarget.quaternion.slerpQuaternions(
            this._startQuat,
            this._endQuat,
            eased
          );
        }
      }

      if (progress >= 1) {
        this._finishAnimation();
      }
    },

    _finishAnimation() {
      this.animating = false;

      if (this.useVROffset && this._vrDelta) {
        const remaining = new THREE.Vector3().subVectors(
          this._vrDelta,
          this._vrApplied
        );
        if (remaining.lengthSq() > 0.0001) this._applyVROffset(remaining);
        this._vrDelta = this._vrApplied = null;
      } else if (this._moveTarget) {
        this._moveTarget.position.copy(this._endPos);
        if (this._animateRotation) {
          this._moveTarget.quaternion.copy(this._endQuat);
          this._animateRotation = false;
        }
      }

      if (this.tunnelEl) {
        this.tunnelEl.removeAttribute("animation__up");
        this.tunnelEl.setAttribute("animation__up", {
          property: "scale.y",
          to: 0.1,
          dur: 500,
          easing: this.data.easing,
        });
      }

      this.cameraEl?.emit("go-to-complete");
    },

    remove() {
      this.el.removeEventListener("click", this._onClick);
    },
  });

  // ============================================================================
  // SAVE-POSITION-AND-ROTATION COMPONENT
  // ============================================================================
  AFRAME.registerComponent("save-position-and-rotation", {
    init() {
      this.cameraEl =
        this.el.sceneEl.querySelector("[camera]") ||
        this.el.sceneEl.querySelector("a-camera");
      this.isVR = false;

      this.el.sceneEl.addEventListener("enter-vr", () => (this.isVR = true));
      this.el.sceneEl.addEventListener("exit-vr", () => (this.isVR = false));

      this._saveInterval = setInterval(() => {
        try {
          const target = this.isVR
            ? this.cameraEl?.object3D?.parent || this.cameraEl?.object3D
            : this.cameraEl?.object3D;

          if (target) {
            const { x, y, z } = target.position;
            localStorage.setItem("cameraPosition", JSON.stringify({ x, y, z }));
          }
          if (this.cameraEl) {
            localStorage.setItem(
              "cameraRotation",
              JSON.stringify(this.cameraEl.getAttribute("rotation"))
            );
          }
        } catch (e) {
          // Storage unavailable
        }
      }, DEFAULTS.SAVE_INTERVAL);
    },

    remove() {
      clearInterval(this._saveInterval);
    },
  });

  // ============================================================================
  // DIAGNOSTIC (debug mode only)
  // ============================================================================
  if (isDebug()) {
    window.TeleportDiagnostic = {
      run() {
        console.log("=== TELEPORT DIAGNOSTIC ===");
        const scene = document.querySelector("a-scene");
        const camera =
          document.querySelector("[camera]") ||
          document.querySelector("a-camera");
        const teleport = camera?.components?.["a-cursor-teleport"];
        console.table({
          Scene: !!scene,
          Camera: !!camera,
          Cursor: !!document.querySelector("a-cursor"),
          Navmeshes: document.querySelectorAll("[navmesh]").length,
          VRMode: teleport?.isVR ?? "N/A",
          CachedMeshes: teleport?._navmeshCache?.length ?? "N/A",
        });
        console.log("=== END ===");
      },
    };
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(window.TeleportDiagnostic.run, 2000);
    });
  }
})();
