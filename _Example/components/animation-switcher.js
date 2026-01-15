/**
 * Animation Switcher Component (Universal)
 * Switches animations on various events (hover, click, proximity, custom events, timer, etc.)
 *
 * Usage examples:
 *   animation-switcher="defaultClip: Idle; hoverClip: Wave"
 *   animation-switcher="defaultClip: Idle; hoverClip: Dance; clickClip: Jump"
 *   animation-switcher="defaultClip: Idle; proximityClip: Attack; proximityDistance: 3"
 *   animation-switcher="defaultClip: Idle; triggerEvent: activate; triggerClip: Action"
 *   animation-switcher="defaultClip: Idle; focusClip: Alert; blurClip: Sleep"
 *   animation-switcher="clips: Idle, Walk, Run; randomize: true; intervalMin: 2; intervalMax: 5"
 *
 * Also registers legacy 'animation-on-hover' as an alias for backwards compatibility.
 */
(function () {
  var componentDefinition = {
    schema: {
      // Animation clips
      defaultClip: { type: "string", default: "" },
      hoverClip: { type: "string", default: "" },
      clickClip: { type: "string", default: "" },
      proximityClip: { type: "string", default: "" },
      focusClip: { type: "string", default: "" }, // When element gains focus
      blurClip: { type: "string", default: "" }, // When element loses focus
      triggerClip: { type: "string", default: "" }, // Custom event trigger
      triggerEndClip: { type: "string", default: "" }, // When custom trigger ends

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
        default: "proximity,trigger,click,hover,focus,default",
      }, // State priority order
      enabled: { type: "boolean", default: true }, // Enable/disable the component

      // Debug
      debug: { type: "boolean", default: false },
    },

    init: function () {
      var self = this;

      // State tracking
      this.currentClip = "";
      this.currentState = "default";
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
      if (this.data.makeClickable) {
        this.el.classList.add("clickable");
        this.addClickableToChildren();
      }

      this.parseClipList();
      this.addEventListeners();

      // Set initial animation with optional delay
      var self = this;
      if (this.data.startDelay > 0) {
        setTimeout(function () {
          self.updateAnimationState();
        }, this.data.startDelay * 1000);
      } else {
        this.updateAnimationState();
      }

      // Start auto-switch if configured
      if (
        (this.data.sequence || this.data.randomize) &&
        this.clipList.length > 0
      ) {
        this.scheduleNextAutoSwitch();
      }

      this.log("Animation switcher initialized");
      this.el.emit("animation-switcher-ready", {
        clips: this.getAvailableClips(),
      });
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
      if (this.data.hoverClip) {
        el.addEventListener("mouseenter", this.onMouseEnter);
        el.addEventListener("mouseleave", this.onMouseLeave);
      }

      // Click events
      if (this.data.clickClip) {
        el.addEventListener("click", this.onClick);
      }

      // Focus events
      if (this.data.focusClip || this.data.blurClip) {
        el.addEventListener("focus", this.onFocus);
        el.addEventListener("blur", this.onBlur);
      }

      // Custom trigger events
      if (this.data.triggerEvent && this.data.triggerClip) {
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
          this.data.clickClip,
          function () {
            this.states.click = false;
            this.updateAnimationState();
          }.bind(this)
        );
      } else {
        this.updateAnimationState();
      }

      this.el.emit("animation-clicked", { clip: this.data.clickClip });
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
        clip: this.data.triggerClip,
        detail: evt.detail,
      });
    },

    onTriggerEnd: function (evt) {
      if (!this.data.enabled) return;
      this.states.trigger = false;
      this.log("Trigger end event:", this.data.triggerEndEvent);

      if (this.data.triggerEndClip) {
        this.playAnimationOnce(
          this.data.triggerEndClip,
          function () {
            this.updateAnimationState();
          }.bind(this)
        );
      } else {
        this.updateAnimationState();
      }
    },

    onAnimationFinished: function (evt) {
      this.el.emit("animation-switcher-finished", {
        clip: this.currentClip,
        state: this.currentState,
      });
    },

    // Proximity check in tick
    tick: function (time) {
      if (!this.data.enabled) return;
      if (!this.data.proximityClip || !this.data.proximityTarget) return;

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
      var clipToPlay = this.data.defaultClip;
      var newState = "default";

      for (var i = 0; i < priorities.length; i++) {
        var state = priorities[i];

        switch (state) {
          case "proximity":
            if (this.states.proximity && this.data.proximityClip) {
              clipToPlay = this.data.proximityClip;
              newState = "proximity";
            }
            break;
          case "trigger":
            if (this.states.trigger && this.data.triggerClip) {
              clipToPlay = this.data.triggerClip;
              newState = "trigger";
            }
            break;
          case "click":
            if (this.states.click && this.data.clickClip) {
              clipToPlay = this.data.clickClip;
              newState = "click";
            }
            break;
          case "hover":
            if (this.states.hover && this.data.hoverClip) {
              clipToPlay = this.data.hoverClip;
              newState = "hover";
            }
            break;
          case "focus":
            if (this.states.focus && this.data.focusClip) {
              clipToPlay = this.data.focusClip;
              newState = "focus";
            } else if (
              !this.states.focus &&
              this.data.blurClip &&
              this.currentState === "focus"
            ) {
              clipToPlay = this.data.blurClip;
              newState = "blur";
            }
            break;
        }

        if (newState !== "default") break;
      }

      // Handle sequence/random mode
      if (
        newState === "default" &&
        this.clipList.length > 0 &&
        !this.data.defaultClip
      ) {
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
      if (clipName === this.currentClip && !loopOverride) return;

      this.currentClip = clipName;
      this.log("Playing animation:", clipName);

      var mixerSettings = {
        clip: clipName,
        loop: loopOverride || this.data.loop,
        crossFadeDuration: this.data.crossFadeDuration,
        timeScale: this.data.timeScale,
      };

      if (this.data.clampWhenFinished) {
        mixerSettings.clampWhenFinished = true;
      }

      this.el.setAttribute("animation-mixer", mixerSettings);

      this.el.emit("animation-changed", {
        clip: clipName,
        state: this.currentState,
        loop: loopOverride || this.data.loop,
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
        var args = ["[animation-switcher]"].concat(
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
  AFRAME.registerComponent("animation-switcher", componentDefinition);

  // Register legacy alias for backwards compatibility
  AFRAME.registerComponent("animation-on-hover", componentDefinition);
})();
