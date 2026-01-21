/**
 * Animation Trigger Component (Universal)
 * @version 1.1.0
 * @date 2026-01-16
 *
 * A comprehensive animation controller for A-Frame that switches animations
 * on various events (hover, click, proximity, custom events, timer, etc.)
 *
 * Features:
 *   - Multiple trigger types: hover, click, proximity, custom events
 *   - Sequence and random animation playback with configurable intervals
 *   - Auto-hitbox generation for optimized raycasting on complex 3D models
 *   - Automatic mesh raycast exclusion when hitbox is enabled
 *   - Cross-fade transitions between animations
 *   - Configurable priority system for overlapping triggers
 *
 * Basic usage examples:
 *   animation-trigger="idle: Idle; hover: Wave"
 *   animation-trigger="idle: Idle; hover: Dance; click: Jump"
 *   animation-trigger="idle: Idle; proximity: Attack; proximityDistance: 3"
 *   animation-trigger="idle: Idle; triggerEvent: activate; trigger: Action"
 *   animation-trigger="clips: Idle, Walk, Run; randomize: true; intervalMin: 2; intervalMax: 5"
 *
 * Auto-hitbox examples (enabled by default):
 *   animation-trigger="idle: Idle"                                    (hitbox auto-created)
 *   animation-trigger="idle: Idle; hitboxVisible: true"               (visible for debugging)
 *   animation-trigger="idle: Idle; hitboxPadding: 0.1 0.2 0.1"        (with padding)
 *   animation-trigger="idle: Idle; autoHitbox: false"                 (disable, use mesh raycasting)
 *
 * Schema properties:
 *   Animation triggers:
 *     idle           - Animation to play in default state
 *     hover          - Animation on mouse enter
 *     click          - Animation on click
 *     proximity      - Animation when camera is within proximityDistance
 *     trigger        - Animation on custom triggerEvent
 *     triggerEnd     - Animation when custom trigger ends
 *
 *   Sequence/Random:
 *     clips          - Comma-separated list of clips for sequence/random playback
 *     sequence       - Play clips in order (default: false)
 *     randomize      - Randomize clip selection (default: false)
 *     intervalMin    - Min seconds between auto-switch
 *     intervalMax    - Max seconds between auto-switch
 *
 *   Animation settings:
 *     loop              - "repeat", "once", or "pingpong" (default: "repeat")
 *     crossFadeDuration - Transition duration in seconds (default: 0.3)
 *     timeScale         - Playback speed multiplier (default: 1)
 *     clampWhenFinished - Hold last frame when done (default: false)
 *     startDelay        - Delay before initial animation in seconds
 *
 *   Hitbox settings:
 *     autoHitbox     - Auto-generate bounding box for raycasting (default: true)
 *     hitboxPadding  - Extra padding as vec3, e.g., "0.1 0.2 0.1"
 *     hitboxVisible  - Show hitbox for debugging (default: false)
 *     hitboxColor    - Debug hitbox color (default: "#00ff00")
 *     hitboxOpacity  - Debug hitbox opacity (default: 0.3)
 *
 *   Behavior settings:
 *     clickOnce        - Play click animation once then return (default: true)
 *     hoverOnce        - Play hover animation once (default: false)
 *     returnToDefault  - Return to idle after one-shot animations (default: true)
 *     makeClickable    - Add clickable class to element (default: true)
 *     priority         - State priority order (default: "proximity,trigger,click,hover,idle")
 *     enabled          - Enable/disable the component (default: true)
 *     debug            - Enable debug logging (default: false)
 *
 * Events emitted:
 *   animation-trigger-ready    - Component initialized, includes available clips
 *   animation-changed          - Animation changed, includes clip name and state
 *   animation-clicked          - Click animation triggered
 *   animation-triggered        - Custom event trigger activated
 *   animation-proximity-changed - Proximity state changed
 *   animation-auto-switched    - Auto sequence/random switched clip
 *   animation-trigger-finished - Animation loop/finish completed
 *   hitbox-created             - Hitbox generated, includes size and center
 *
 * Public API methods:
 *   play(clipName, options)    - Play a specific animation
 *   stop()                     - Stop all animations
 *   pause()                    - Pause current animation
 *   resume()                   - Resume paused animation
 *   setEnabled(bool)           - Enable/disable the component
 *   reset()                    - Reset to default idle state
 */
(function () {
  var componentDefinition = {
    schema: {
      // Animation names for each trigger state
      idle: { type: "string", default: "" },
      hover: { type: "string", default: "" },
      click: { type: "string", default: "" },
      proximity: { type: "string", default: "" },
      trigger: { type: "string", default: "" }, // Custom event trigger
      triggerEnd: { type: "string", default: "" }, // When custom trigger ends

      // Sequence/Random animation support
      clips: { type: "string", default: "" }, // Comma-separated list of clips for sequence/random
      sequence: { type: "boolean", default: false }, // Play clips in sequence
      randomize: { type: "boolean", default: false }, // Randomize clip selection
      intervalMin: { type: "number", default: 0 }, // Min interval for auto-switch (seconds)
      intervalMax: { type: "number", default: 0 }, // Max interval for auto-switch (seconds)

      // Animation settings
      loop: { type: "string", default: "repeat" }, // repeat, once, pingpong
      crossFadeDuration: { type: "number", default: 0.3 },
      timeScale: { type: "number", default: 1 },
      clampWhenFinished: { type: "boolean", default: false }, // Hold last frame when animation ends
      startDelay: { type: "number", default: 0 }, // Delay before starting initial animation

      // Proximity settings
      proximityDistance: { type: "number", default: 2 },
      proximityTarget: { type: "selector", default: "[camera]" },
      proximityCheckInterval: { type: "number", default: 100 }, // ms between proximity checks

      // Custom event triggers
      triggerEvent: { type: "string", default: "" }, // Event name that triggers animation
      triggerEndEvent: { type: "string", default: "" }, // Event name that ends triggered animation

      // Behavior settings
      clickOnce: { type: "boolean", default: true }, // Play click animation once then return
      hoverOnce: { type: "boolean", default: false }, // Play hover animation once
      returnToDefault: { type: "boolean", default: true }, // Return to default after one-shot anims
      makeClickable: { type: "boolean", default: true }, // Add clickable class to element
      priority: {
        type: "string",
        default: "proximity,trigger,click,hover,idle",
      }, // State priority order
      enabled: { type: "boolean", default: true }, // Enable/disable the component

      // Debug
      debug: { type: "boolean", default: false },

      // Auto-hitbox settings (simplified raycast detection)
      autoHitbox: { type: "boolean", default: true }, // Auto-generate bounding box for raycasting
      hitboxPadding: { type: "vec3", default: { x: 0, y: 0, z: 0 } }, // Extra padding around hitbox
      hitboxVisible: { type: "boolean", default: false }, // Show hitbox for debugging
      hitboxColor: { type: "color", default: "#00ff00" }, // Color when visible
      hitboxOpacity: { type: "number", default: 0.3 }, // Opacity when visible
    },

    init: function () {
      var self = this;

      // State tracking
      this.currentClip = "";
      this.currentState = "idle";
      this.states = {
        hover: false,
        proximity: false,
        trigger: false,
        click: false,
      };

      // Sequence/random tracking
      this.clipList = [];
      this.currentClipIndex = 0;
      this.autoSwitchTimeout = null;

      // Proximity throttling
      this.lastProximityCheck = 0;

      // Hitbox reference
      this.hitboxEl = null;

      // Bind methods
      this.bindMethods();

      // Wait for model to load if needed
      if (
        this.el.hasAttribute("gltf-model") ||
        this.el.hasAttribute("obj-model")
      ) {
        this.el.addEventListener("model-loaded", function () {
          self.onModelLoaded();
        });
      } else {
        // No model, initialize immediately
        this.onModelLoaded();
      }
    },

    onModelLoaded: function () {
      var self = this;

      if (this.data.makeClickable) {
        this.el.classList.add("clickable");
        this.addClickableToChildren();
      }

      // Create auto-hitbox for simplified raycasting
      if (this.data.autoHitbox) {
        this.createHitbox();
      }

      this.parseClipList();
      this.addEventListeners();

      // Log available animations from the model
      this.logAvailableAnimations();

      // Wait a frame for animation-mixer to initialize, then play initial animation
      setTimeout(function () {
        if (self.data.startDelay > 0) {
          setTimeout(function () {
            self.playInitialAnimation();
          }, self.data.startDelay * 1000);
        } else {
          self.playInitialAnimation();
        }
      }, 0);

      // Start auto-switch if configured
      if (
        (this.data.sequence || this.data.randomize) &&
        this.clipList.length > 0
      ) {
        this.scheduleNextAutoSwitch();
      }

      this.log("Animation trigger initialized");
      this.el.emit("animation-trigger-ready", {
        clips: this.getAvailableClips(),
      });
    },

    logAvailableAnimations: function () {
      var model = this.el.getObject3D("mesh");
      if (model && model.animations && model.animations.length > 0) {
        var names = model.animations.map(function (clip) {
          return clip.name;
        });
        console.log(
          "[animation-trigger] Available animations in model:",
          names
        );
      } else {
        console.log(
          "[animation-trigger] No animations found in model or model not loaded yet"
        );
      }
    },

    playInitialAnimation: function () {
      // Force play the initial/idle animation
      var clipToPlay = this.data.idle;

      // If using clips list and no idle, use first clip
      if (!clipToPlay && this.clipList.length > 0) {
        clipToPlay = this.clipList[0];
      }

      console.log(
        "[animation-trigger] playInitialAnimation called, clipToPlay:",
        clipToPlay
      );

      if (clipToPlay) {
        this.currentClip = ""; // Reset to force play
        this.playAnimation(clipToPlay);
      } else {
        console.log("[animation-trigger] No clip to play!");
      }
    },

    parseClipList: function () {
      if (this.data.clips) {
        this.clipList = this.data.clips
          .split(",")
          .map(function (s) {
            return s.trim();
          })
          .filter(function (s) {
            return s.length > 0;
          });
      }
    },

    addClickableToChildren: function () {
      var children = this.el.querySelectorAll("*");
      for (var i = 0; i < children.length; i++) {
        children[i].classList.add("clickable");
      }
    },

    /**
     * Creates an invisible bounding box around the model for simplified raycasting.
     * This significantly improves raycast performance for complex models.
     */
    createHitbox: function () {
      var self = this;
      var mesh = this.el.getObject3D("mesh");

      if (!mesh) {
        console.warn("[animation-trigger] No mesh found for hitbox generation");
        return;
      }

      // Store original matrix state
      var originalMatrixAutoUpdate = mesh.matrixAutoUpdate;
      mesh.updateMatrixWorld(true);

      // Calculate bounding box from the mesh in world space
      var box = new THREE.Box3().setFromObject(mesh);
      var size = new THREE.Vector3();
      var worldCenter = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(worldCenter);

      // Apply padding (in world units, before scale adjustment)
      size.x += this.data.hitboxPadding.x;
      size.y += this.data.hitboxPadding.y;
      size.z += this.data.hitboxPadding.z;

      // Get entity's world transform
      var entityWorldPos = new THREE.Vector3();
      var entityWorldQuat = new THREE.Quaternion();
      var entityWorldScale = new THREE.Vector3();
      this.el.object3D.matrixWorld.decompose(
        entityWorldPos,
        entityWorldQuat,
        entityWorldScale
      );

      // Convert world center to local space of the entity
      // First translate to entity's local origin
      var localCenter = worldCenter.clone().sub(entityWorldPos);

      // Then rotate by inverse of entity's rotation
      var inverseQuat = entityWorldQuat.clone().invert();
      localCenter.applyQuaternion(inverseQuat);

      // Then scale by inverse of entity's scale
      if (entityWorldScale.x !== 0) localCenter.x /= entityWorldScale.x;
      if (entityWorldScale.y !== 0) localCenter.y /= entityWorldScale.y;
      if (entityWorldScale.z !== 0) localCenter.z /= entityWorldScale.z;

      // Size also needs to be adjusted for entity scale
      if (entityWorldScale.x !== 0) size.x /= entityWorldScale.x;
      if (entityWorldScale.y !== 0) size.y /= entityWorldScale.y;
      if (entityWorldScale.z !== 0) size.z /= entityWorldScale.z;

      console.log(
        "[animation-trigger] Creating hitbox - size:",
        size.x.toFixed(2),
        size.y.toFixed(2),
        size.z.toFixed(2),
        "localCenter:",
        localCenter.x.toFixed(2),
        localCenter.y.toFixed(2),
        localCenter.z.toFixed(2)
      );

      // Create hitbox entity
      this.hitboxEl = document.createElement("a-box");
      this.hitboxEl.setAttribute("class", "clickable hitbox");
      this.hitboxEl.setAttribute("width", size.x);
      this.hitboxEl.setAttribute("height", size.y);
      this.hitboxEl.setAttribute("depth", size.z);
      this.hitboxEl.setAttribute("position", {
        x: localCenter.x,
        y: localCenter.y,
        z: localCenter.z,
      });

      // Set material based on visibility
      if (this.data.hitboxVisible) {
        this.hitboxEl.setAttribute("material", {
          color: this.data.hitboxColor,
          opacity: this.data.hitboxOpacity,
          transparent: true,
          side: "double",
        });
      } else {
        this.hitboxEl.setAttribute("material", {
          opacity: 0,
          transparent: true,
        });
        this.hitboxEl.setAttribute("visible", "false");
        // Keep raycaster detection even when invisible
        this.hitboxEl.object3D.visible = true;
        this.hitboxEl.setAttribute("material", "opacity", 0);
      }

      // Forward events from hitbox to parent entity
      var eventsToForward = [
        "mouseenter",
        "mouseleave",
        "click",
        "focus",
        "blur",
      ];
      eventsToForward.forEach(function (eventName) {
        self.hitboxEl.addEventListener(eventName, function (evt) {
          self.el.emit(eventName, evt.detail, false);
        });
      });

      // Exclude the original mesh from raycasting using Three.js layers
      // Layer 0 is default (raycastable), we move mesh to layer 1 (non-raycastable)
      this.excludeMeshFromRaycast(mesh);

      // Append hitbox to entity
      this.el.appendChild(this.hitboxEl);

      this.el.emit("hitbox-created", {
        size: { x: size.x, y: size.y, z: size.z },
        center: { x: localCenter.x, y: localCenter.y, z: localCenter.z },
      });
    },

    /**
     * Exclude a mesh and all its children from raycasting
     * Uses Three.js raycast override to prevent detection
     */
    excludeMeshFromRaycast: function (object) {
      var self = this;

      // Store original raycast function and disable it
      object.traverse(function (child) {
        if (child.isMesh) {
          // Store original raycast for potential restoration
          child._originalRaycast = child.raycast;
          // Disable raycasting on this mesh
          child.raycast = function () {};
        }
      });

      // Also remove clickable class from parent entity to prevent cursor detection
      this.el.classList.remove("clickable");

      console.log("[animation-trigger] Mesh excluded from raycasting");
    },

    /**
     * Restore raycasting on the mesh (used when hitbox is removed)
     */
    restoreMeshRaycast: function () {
      var mesh = this.el.getObject3D("mesh");
      if (!mesh) return;

      mesh.traverse(function (child) {
        if (child.isMesh && child._originalRaycast) {
          child.raycast = child._originalRaycast;
          delete child._originalRaycast;
        }
      });

      // Restore clickable class if makeClickable is true
      if (this.data.makeClickable) {
        this.el.classList.add("clickable");
      }

      console.log("[animation-trigger] Mesh raycasting restored");
    },

    /**
     * Remove the auto-generated hitbox
     */
    removeHitbox: function () {
      if (this.hitboxEl && this.hitboxEl.parentNode) {
        this.hitboxEl.parentNode.removeChild(this.hitboxEl);
        this.hitboxEl = null;
        this.restoreMeshRaycast();
        this.log("Hitbox removed");
      }
    },

    bindMethods: function () {
      this.onMouseEnter = this.onMouseEnter.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onTrigger = this.onTrigger.bind(this);
      this.onTriggerEnd = this.onTriggerEnd.bind(this);
      this.onAnimationFinished = this.onAnimationFinished.bind(this);
    },

    addEventListeners: function () {
      var el = this.el;

      // Hover events
      if (this.data.hover) {
        el.addEventListener("mouseenter", this.onMouseEnter);
        el.addEventListener("mouseleave", this.onMouseLeave);
      }

      // Click events
      if (this.data.click) {
        el.addEventListener("click", this.onClick);
      }

      // Custom trigger events
      if (this.data.triggerEvent && this.data.trigger) {
        el.addEventListener(this.data.triggerEvent, this.onTrigger);
      }

      if (this.data.triggerEndEvent) {
        el.addEventListener(this.data.triggerEndEvent, this.onTriggerEnd);
      }

      // Animation finished event
      el.addEventListener("animation-loop", this.onAnimationFinished);
      el.addEventListener("animation-finished", this.onAnimationFinished);
    },

    removeEventListeners: function () {
      var el = this.el;
      el.removeEventListener("mouseenter", this.onMouseEnter);
      el.removeEventListener("mouseleave", this.onMouseLeave);
      el.removeEventListener("click", this.onClick);

      if (this.data.triggerEvent) {
        el.removeEventListener(this.data.triggerEvent, this.onTrigger);
      }
      if (this.data.triggerEndEvent) {
        el.removeEventListener(this.data.triggerEndEvent, this.onTriggerEnd);
      }

      el.removeEventListener("animation-loop", this.onAnimationFinished);
      el.removeEventListener("animation-finished", this.onAnimationFinished);
    },

    // Event handlers
    onMouseEnter: function () {
      if (!this.data.enabled) return;
      this.states.hover = true;
      this.log("Mouse enter");
      this.updateAnimationState();
    },

    onMouseLeave: function () {
      if (!this.data.enabled) return;
      this.states.hover = false;
      this.log("Mouse leave");
      this.updateAnimationState();
    },

    onClick: function (evt) {
      if (!this.data.enabled) return;
      this.states.click = true;
      this.log("Click");

      if (this.data.clickOnce) {
        this.playAnimationOnce(
          this.data.click,
          function () {
            this.states.click = false;
            this.updateAnimationState();
          }.bind(this)
        );
      } else {
        this.updateAnimationState();
      }

      this.el.emit("animation-clicked", { clip: this.data.click });
    },

    onTrigger: function (evt) {
      if (!this.data.enabled) return;
      this.states.trigger = true;
      this.log("Trigger event:", this.data.triggerEvent);
      this.updateAnimationState();

      this.el.emit("animation-triggered", {
        event: this.data.triggerEvent,
        clip: this.data.trigger,
        detail: evt.detail,
      });
    },

    onTriggerEnd: function (evt) {
      if (!this.data.enabled) return;
      this.states.trigger = false;
      this.log("Trigger end event:", this.data.triggerEndEvent);

      if (this.data.triggerEnd) {
        this.playAnimationOnce(
          this.data.triggerEnd,
          function () {
            this.updateAnimationState();
          }.bind(this)
        );
      } else {
        this.updateAnimationState();
      }
    },

    onAnimationFinished: function (evt) {
      this.el.emit("animation-trigger-finished", {
        clip: this.currentClip,
        state: this.currentState,
      });
    },

    // Proximity check in tick
    tick: function (time) {
      if (!this.data.enabled) return;
      if (!this.data.proximity || !this.data.proximityTarget) return;

      // Throttle proximity checks
      if (time - this.lastProximityCheck < this.data.proximityCheckInterval)
        return;
      this.lastProximityCheck = time;

      var target = this.data.proximityTarget;
      if (!target || !target.object3D) return;

      var targetPos = target.object3D.getWorldPosition(new THREE.Vector3());
      var myPos = this.el.object3D.getWorldPosition(new THREE.Vector3());
      var distance = targetPos.distanceTo(myPos);

      var wasInProximity = this.states.proximity;
      this.states.proximity = distance < this.data.proximityDistance;

      if (this.states.proximity !== wasInProximity) {
        this.log(
          "Proximity changed:",
          this.states.proximity,
          "distance:",
          distance.toFixed(2)
        );
        this.updateAnimationState();

        this.el.emit("animation-proximity-changed", {
          inProximity: this.states.proximity,
          distance: distance,
        });
      }
    },

    // Determine which animation to play based on current state and priority
    updateAnimationState: function () {
      if (!this.data.enabled) return;

      var priorities = this.data.priority.split(",").map(function (s) {
        return s.trim();
      });
      var clipToPlay = this.data.idle;
      var newState = "idle";

      for (var i = 0; i < priorities.length; i++) {
        var state = priorities[i];

        switch (state) {
          case "proximity":
            if (this.states.proximity && this.data.proximity) {
              clipToPlay = this.data.proximity;
              newState = "proximity";
            }
            break;
          case "trigger":
            if (this.states.trigger && this.data.trigger) {
              clipToPlay = this.data.trigger;
              newState = "trigger";
            }
            break;
          case "click":
            if (this.states.click && this.data.click) {
              clipToPlay = this.data.click;
              newState = "click";
            }
            break;
          case "hover":
            if (this.states.hover && this.data.hover) {
              clipToPlay = this.data.hover;
              newState = "hover";
            }
            break;
        }

        if (newState !== "idle") break;
      }

      // Handle sequence/random mode
      if (newState === "idle" && this.clipList.length > 0 && !this.data.idle) {
        clipToPlay = this.clipList[this.currentClipIndex];
      }

      if (clipToPlay && clipToPlay !== this.currentClip) {
        this.currentState = newState;
        this.playAnimation(clipToPlay);
      }
    },

    // Play animation once and call callback when done
    playAnimationOnce: function (clipName, callback) {
      var self = this;
      this.playAnimation(clipName, "once");

      var duration = this.getClipDuration(clipName);
      setTimeout(function () {
        if (callback) callback();
      }, duration);
    },

    // Get duration of a clip from the animation-mixer
    getClipDuration: function (clipName) {
      var mixer = this.el.components["animation-mixer"];
      if (mixer && mixer.mixer && mixer.mixer._actions) {
        for (var i = 0; i < mixer.mixer._actions.length; i++) {
          var action = mixer.mixer._actions[i];
          if (action._clip && action._clip.name === clipName) {
            return (action._clip.duration * 1000) / this.data.timeScale;
          }
        }
      }
      return 1000; // Default 1 second if not found
    },

    // Get list of available animation clips
    getAvailableClips: function () {
      var clips = [];
      var mixer = this.el.components["animation-mixer"];
      if (mixer && mixer.mixer && mixer.mixer._actions) {
        for (var i = 0; i < mixer.mixer._actions.length; i++) {
          var action = mixer.mixer._actions[i];
          if (action._clip && action._clip.name) {
            clips.push(action._clip.name);
          }
        }
      }
      return clips;
    },

    // Schedule next auto-switch for sequence/random mode
    scheduleNextAutoSwitch: function () {
      if (this.autoSwitchTimeout) {
        clearTimeout(this.autoSwitchTimeout);
      }

      if (!this.data.sequence && !this.data.randomize) return;
      if (this.clipList.length === 0) return;

      var min = this.data.intervalMin || 1;
      var max = this.data.intervalMax || min;
      var delay = (min + Math.random() * (max - min)) * 1000;

      var self = this;
      this.autoSwitchTimeout = setTimeout(function () {
        self.nextAutoClip();
        self.scheduleNextAutoSwitch();
      }, delay);
    },

    nextAutoClip: function () {
      if (this.clipList.length === 0) return;

      if (this.data.randomize) {
        var newIndex = Math.floor(Math.random() * this.clipList.length);
        // Avoid playing same clip twice in a row
        if (this.clipList.length > 1 && newIndex === this.currentClipIndex) {
          newIndex = (newIndex + 1) % this.clipList.length;
        }
        this.currentClipIndex = newIndex;
      } else if (this.data.sequence) {
        this.currentClipIndex =
          (this.currentClipIndex + 1) % this.clipList.length;
      }

      var clip = this.clipList[this.currentClipIndex];
      this.playAnimation(clip);

      this.el.emit("animation-auto-switched", {
        clip: clip,
        index: this.currentClipIndex,
      });
    },

    playAnimation: function (clipName, loopOverride) {
      if (!clipName) return;

      this.currentClip = clipName;
      var loopMode = loopOverride || this.data.loop;

      console.log(
        "[animation-trigger] playAnimation called with:",
        clipName,
        "loop:",
        loopMode
      );

      // Simply set animation-mixer - it handles clip changes internally
      this.el.setAttribute("animation-mixer", "clip", clipName);
      this.el.setAttribute("animation-mixer", "loop", loopMode);
      this.el.setAttribute(
        "animation-mixer",
        "crossFadeDuration",
        this.data.crossFadeDuration
      );
      this.el.setAttribute("animation-mixer", "timeScale", this.data.timeScale);

      this.el.emit("animation-changed", {
        clip: clipName,
        state: this.currentState,
        loop: loopMode,
      });
    },

    // Public API methods
    play: function (clipName, options) {
      options = options || {};
      this.playAnimation(clipName, options.loop);
    },

    stop: function () {
      this.el.removeAttribute("animation-mixer");
      this.currentClip = "";
    },

    pause: function () {
      var mixer = this.el.components["animation-mixer"];
      if (mixer && mixer.mixer) {
        mixer.mixer.timeScale = 0;
      }
    },

    resume: function () {
      var mixer = this.el.components["animation-mixer"];
      if (mixer && mixer.mixer) {
        mixer.mixer.timeScale = this.data.timeScale;
      }
    },

    setEnabled: function (enabled) {
      this.data.enabled = enabled;
      if (enabled) {
        this.updateAnimationState();
      }
    },

    // Reset to default state
    reset: function () {
      this.states = {
        hover: false,
        proximity: false,
        trigger: false,
        click: false,
      };
      this.currentClipIndex = 0;
      this.updateAnimationState();
    },

    update: function (oldData) {
      if (
        oldData.enabled !== undefined &&
        oldData.enabled !== this.data.enabled
      ) {
        if (this.data.enabled) {
          this.updateAnimationState();
        }
      }

      if (oldData.clips !== this.data.clips) {
        this.parseClipList();
      }
    },

    log: function () {
      if (this.data.debug) {
        var args = ["[animation-trigger]"].concat(
          Array.prototype.slice.call(arguments)
        );
        console.log.apply(console, args);
      }
    },

    remove: function () {
      this.removeEventListeners();
      this.removeHitbox();
      if (this.autoSwitchTimeout) {
        clearTimeout(this.autoSwitchTimeout);
      }
    },
  };

  // Register the main component
  AFRAME.registerComponent("animation-trigger", componentDefinition);
})();
