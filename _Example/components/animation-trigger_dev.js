/**
 * Animation Trigger Component (Universal)
 * Switches animations on various events (hover, click, proximity, custom events, timer, etc.)
 *
 * Usage examples:
 *   animation-trigger="idle: Idle; hover: Wave"
 *   animation-trigger="idle: Idle; hover: Dance; click: Jump"
 *   animation-trigger="idle: Idle; proximity: Attack; proximityDistance: 3"
 *   animation-trigger="idle: Idle; triggerEvent: activate; trigger: Action"
 *   animation-trigger="idle: Idle; focus: Alert; blur: Sleep"
 *   animation-trigger="clips: Idle, Walk, Run; randomize: true; intervalMin: 2; intervalMax: 5"
 *
 * Also registers legacy 'animation-on-hover' and 'animation-switcher' as aliases for backwards compatibility.
 */
(function () {
  var componentDefinition = {
    schema: {
      // Animation names for each trigger state
      idle: { type: "string", default: "" },
      hover: { type: "string", default: "" },
      click: { type: "string", default: "" },
      proximity: { type: "string", default: "" },
      focus: { type: "string", default: "" }, // When element gains focus
      blur: { type: "string", default: "" }, // When element loses focus
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
        default: "proximity,trigger,click,hover,focus,idle",
      }, // State priority order
      enabled: { type: "boolean", default: true }, // Enable/disable the component

      // Debug
      debug: { type: "boolean", default: false },
    },

    init: function () {
      var self = this;

      // State tracking
      this.currentClip = "";
      this.currentState = "idle";
      this.states = {
        hover: false,
        focus: false,
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

      // Reusable Vector3 objects to avoid GC in tick()
      this._targetPos = new THREE.Vector3();
      this._myPos = new THREE.Vector3();

      // Cache parsed priorities (will be set in update/init)
      this._parsedPriorities = null;

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
      if (!this.data.debug) return;

      var model = this.el.getObject3D("mesh");
      if (model && model.animations && model.animations.length > 0) {
        var names = model.animations.map(function (clip) {
          return clip.name;
        });
        this.log("Available animations in model:", names);
      } else {
        this.log("No animations found in model or model not loaded yet");
      }
    },

    playInitialAnimation: function () {
      // Force play the initial/idle animation
      var clipToPlay = this.data.idle;

      // If using clips list and no idle, use first clip
      if (!clipToPlay && this.clipList.length > 0) {
        clipToPlay = this.clipList[0];
      }

      this.log("playInitialAnimation, clipToPlay:", clipToPlay);

      if (clipToPlay) {
        this.currentClip = ""; // Reset to force play
        this.playAnimation(clipToPlay);
      } else {
        this.log("No clip to play!");
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

    bindMethods: function () {
      this.onMouseEnter = this.onMouseEnter.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onFocus = this.onFocus.bind(this);
      this.onBlur = this.onBlur.bind(this);
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

      // Focus events
      if (this.data.focus || this.data.blur) {
        el.addEventListener("focus", this.onFocus);
        el.addEventListener("blur", this.onBlur);
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
      el.removeEventListener("focus", this.onFocus);
      el.removeEventListener("blur", this.onBlur);

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

    onFocus: function () {
      if (!this.data.enabled) return;
      this.states.focus = true;
      this.log("Focus");
      this.updateAnimationState();
    },

    onBlur: function () {
      if (!this.data.enabled) return;
      this.states.focus = false;
      this.log("Blur");
      this.updateAnimationState();
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
      if (
        !this.data.enabled ||
        !this.data.proximity ||
        !this.data.proximityTarget
      )
        return;

      // Throttle proximity checks
      if (time - this.lastProximityCheck < this.data.proximityCheckInterval)
        return;
      this.lastProximityCheck = time;

      var target = this.data.proximityTarget;
      if (!target || !target.object3D) return;

      // Reuse Vector3 objects to avoid garbage collection
      var targetPos = target.object3D.getWorldPosition(this._targetPos);
      var myPos = this.el.object3D.getWorldPosition(this._myPos);
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

      // Use cached priorities for better performance
      var priorities = this._parsedPriorities;
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
          case "focus":
            if (this.states.focus && this.data.focus) {
              clipToPlay = this.data.focus;
              newState = "focus";
            } else if (
              !this.states.focus &&
              this.data.blur &&
              this.currentState === "focus"
            ) {
              clipToPlay = this.data.blur;
              newState = "blur";
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

      this.log("playAnimation:", clipName, "loop:", loopMode);

      // Single setAttribute call with object for better performance
      this.el.setAttribute("animation-mixer", {
        clip: clipName,
        loop: loopMode,
        crossFadeDuration: this.data.crossFadeDuration,
        timeScale: this.data.timeScale,
      });

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
        focus: false,
        proximity: false,
        trigger: false,
        click: false,
      };
      this.currentClipIndex = 0;
      this.updateAnimationState();
    },

    update: function (oldData) {
      // Parse and cache priorities when they change or on first run
      if (!this._parsedPriorities || oldData.priority !== this.data.priority) {
        this._parsedPriorities = this.data.priority
          .split(",")
          .map(function (s) {
            return s.trim();
          });
      }

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
      if (this.autoSwitchTimeout) {
        clearTimeout(this.autoSwitchTimeout);
      }
    },
  };

  // Register the main component
  AFRAME.registerComponent("animation-trigger", componentDefinition);

  // Register legacy aliases for backwards compatibility
  AFRAME.registerComponent("animation-switcher", componentDefinition);
  AFRAME.registerComponent("animation-on-hover", componentDefinition);
})();
