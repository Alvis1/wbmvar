/*

INFO
--------------------------------------------------------------------  
Requiranments: 
  Scripts: 
    aframe-extras (handles the animations in the .gltf)
  
  On the camera - 
    cursor="rayOrigin: mouse"
  
--------------------------------------------------------------------  

Load entities from other html
  Usage:
    load="entity: cubes.html>greencube,redcube|/spheres.html>redsphere; target: plane; click: true"
      Can load multiple entities from multiple hmtl.
      If click is false then loads immediately.
      target is in which entity to load.      

Destroy components
  Usage:
    destroy="id: cube; delay:2"
      Just tell what and after what time.
      If delay is not mentioned, it will destroy immediately
      
Animation
  Usage:
    anim="id:cube; clip:bounce, roll; trigger: click"
      
      In Blender, prepare animation or action clips using the nonlinear editor. Export model as .gltf with NLA clips.
      
      The ID of the target entity where the animation will be applied. If not provided, the animation will be applied to the entity itself. Default: "".

      clips: An array of animation clips with optional parameters. Each clip follows the format: "ClipName[loop=loop|reverse=true]". Default: [loop=once|reverse=false].

      trigger: 'click', 'toggle' (click + reverse on second click), 'mouseenter', 'mouseleave', 'mouseenter_leave'. Default: 'click'.
      reverseOrder: Default: false.
      
      playMode: 'consecutive' (play one after the other), 'simultaneous' (play all at once). Default: 'consecutive'.


    TODO:
    anim -  When animation command comes from other trigger then there are offered 2 options: play clip on top or stop previeous and play
    anim - remove the # for the ids


    load - there is an error, when using an array. When there is a slash "/" before the first entity, then the first does not load. Works when removed. "/" is needed for the other entities. 

      */





AFRAME.registerComponent("load", {
  schema: {
    entity: { default: "" },
    target: { default: "" },
    click: { default: false },
    delay: { default: 0 }, // delay property in seconds
  },

  init: function () {
    const data = this.data;
    const el = this.el;
    const self = this;

    // const targetEntity = el.id ? el.id : data.target;

    this.loadEntity = function (htmlFile, entityIds) {
      const targetEntity = data.target
        ? document.querySelector("#" + data.target)
        : el;

      // console.log("data.target", data.target);
      // console.log("targetEntity", targetEntity);
      // console.log("target:", document.querySelector("#" + data.target));

      if (!Array.isArray(entityIds)) {
        console.error("Invalid entityIds. Expecting an array.");
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open("GET", htmlFile);
      xhr.onload = function () {
        if (xhr.status === 200) {
          const temp = document.createElement("a-entity");
          temp.innerHTML = xhr.responseText;

          entityIds.forEach(function (entityId) {
            // console.log("load:", entityId);
            const entity = temp.querySelector("#" + entityId);
            if (entity) {
              targetEntity.appendChild(entity);
              console.log(entityId + " loaded in:", targetEntity)
            }
          });
        }
      };
      xhr.send();
    };

    const entityMappings = data.entity.split("|").reduce(function (obj, item) {
      const [htmlFile, entityIds] = item.split(">");
      const uniqueEntityIds = entityIds
        .split(",")
        .filter((value, index, self) => self.indexOf(value) === index);
      obj[htmlFile] = uniqueEntityIds;
      return obj;
    }, {});

    function handleLoadEntity() {
      setTimeout(function () {
        Object.entries(entityMappings).forEach(function ([
          htmlFile,
          entityIds,
        ]) {
          self.loadEntity(htmlFile, entityIds);
        });
      }, data.delay * 1000); // Apply delay here directly
    }

    function clickHandler(e) {
      e.preventDefault();
      handleLoadEntity();
    }

    // Add click event listener if click is true
    if (data.click) {
      el.addEventListener("click", clickHandler);
    } else {
      handleLoadEntity();
    }
  },
});

AFRAME.registerComponent("destroy", {
  schema: {
    id: { type: "string", default: "" }, // Accept comma-delimited string of IDs
    delay: { type: "number", default: 0 }, // Delay in seconds (3 seconds default)
  },

  init: function () {
    this.onClick = this.onClick.bind(this);
    this.el.addEventListener("click", this.onClick);
  },

  onClick: function () {
    setTimeout(() => {
      let ids = this.data.id.split(","); // Split the string into an array of IDs

      ids.forEach((id) => {
        let targetEl = document.querySelector("#" + id.trim()); // trim() to remove potential spaces

        if (!targetEl) return;

        // Clean up Three.js resources associated with the entity
        if (targetEl.object3D) {
          targetEl.object3D.traverse((child) => {
            if (child.material) {
              child.material.dispose();
            }
            if (child.geometry) {
              child.geometry.dispose();
            }
            // Add texture disposal if necessary in a similar manner
          });
        }

        console.log("destroy:", targetEl);
        // Remove the entity from the DOM
        targetEl.parentNode.removeChild(targetEl);

        // Nullify references for better garbage collection
        targetEl = null;
      });
    }, this.data.delay * 1000); // Convert delay from seconds to milliseconds
  },

  // remove: function () {
  //   this.el.removeEventListener("click", this.onClick);
  // },
});

AFRAME.registerComponent("anim", {
  schema: {
    id: {
      default: "",
    },
    clips: {
      default: [],
      parse: function (value) {
        const clipsArray = value.split(",").map((str) => str.trim());
        return clipsArray.map((clipStr) => {
          const [clipName, paramStr] = clipStr
            .split("[")
            .map((str) => str.trim());
          let loop = "once";
          let reverse = false;

          if (paramStr) {
            const params = paramStr
              .slice(0, -1)
              .split("|")
              .map((param) => param.trim());
            for (const param of params) {
              const [key, val] = param.split("=").map((part) => part.trim());
              if (key === "loop") {
                loop = val;
              } else if (key === "reverse" && val === "true") {
                reverse = true;
              }
            }
          }

          return { name: clipName, loop: loop, reverse: reverse };
        });
      },
    },
    trigger: {
      default: "load", // Possible values: 'toggle', 'click', 'mouseenter', 'mouseleave', 'load'
    },
    reverseOrder: {
      default: false,
      type: "boolean",
    },
    playMode: {
      default: "consecutive", // Possible values: 'consecutive', 'simultaneous'
    },
    delay: {
      default: 0, // in seconds
      type: "number",
    },
  },

  init: function () {
    const el = this.el;
    const data = this.data;
    const self = this; // Store the reference to 'this' for later use
    self.anim_actions = []; // Array to store animation actions

    const targetEntity = data.id ? document.querySelector(data.id) : el;

    targetEntity.addEventListener("model-loaded", function () {
      self.model = targetEntity.getObject3D("mesh");
      self.mixer = new THREE.AnimationMixer(self.model);
      let animationPlaying = false; // To track animation state
      let currentClipIndex = 0; // Index of the current animation clip
      let playingReverse = false; // To track if playing in reverse
      let isOddClick = false; // To track odd/even click count

      // Arrays to store clips in order and reverse order
      const orderedClips = [...data.clips];
      const reverseClips = [...data.clips];

      if (data.reverseOrder) {
        orderedClips.reverse();
        reverseClips.reverse();
      }

      // console.log(self.model.animations);

      // Iterate through the clips and create actions based on the ordered clips
      for (const clipName of orderedClips) {
        const clip = self.model.animations.find(
          (clip) => clip.name === clipName.name
        );
        if (clip) {
          const action = self.mixer.clipAction(clip);
          self.anim_actions.push(action);
        } else {
          console.warn(
            `Clip '${clipName.name}' not found in model animations. Skipping action creation.`
          );
        }
      }

      //console.log(self.anim_actions);
      // console.log(orderedClips);

      // Function to play the animation
      function playAnimation(reverse = false) {
        // Exit if animation is already playing or all clips have been played

        if (animationPlaying || currentClipIndex >= orderedClips.length) {
          return;
        }

        animationPlaying = true;

        // Store the mixer and model for consecutive animation
        self.mixer = new THREE.AnimationMixer(self.model);

        // Get the current animation clip
        const currentClip = reverse
          ? reverseClips[currentClipIndex]
          : orderedClips[currentClipIndex];
        const animationClip = self.model.animations.find(
          (a) => a.name === currentClip.name
        );
        // console.log("anim", animationClip);

        // If the animation clip is not found, log an error and move to the next clip
        if (!animationClip) {
          console.error(`Animation clip '${currentClip.name}' not found.`);
          currentClipIndex++;
          playAnimation(reverse);
          return;
        }

        const action = self.mixer.clipAction(animationClip);

        // Set loop mode for the current clip
        switch (currentClip.loop) {
          case "loop":
            action.setLoop(THREE.LoopRepeat);
            break;
          case "once":
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true; // Ensure it stops after playing once
            break;
          case "pingpong":
            action.setLoop(THREE.LoopPingPong);
            break;
          default:
            console.warn(
              `Invalid loop mode for clip '${currentClip.name}', defaulting to 'once'`
            );
            action.setLoop(THREE.LoopOnce);
        }
        // If the reverse parameter from the clip is true, set the appropriate time scale
        if (currentClip.reverse || reverse || playingReverse) {
          action.timeScale = -1; // Reverse the animation
          action.time = animationClip.duration;
        } else {
          action.timeScale = 1;
          action.time = 0;
        }

        setTimeout(() => {
          // Play the animation
          action.play();

          // Listen for animation finished event and move to the next clip
          self.mixer.addEventListener("finished", () => {
            animationPlaying = false;
            if (!reverse) {
              currentClipIndex++;
            } else {
              currentClipIndex--;
            }
            if (
              currentClipIndex >= 0 &&
              currentClipIndex < orderedClips.length
            ) {
              playAnimation(reverse); // Play the next animation clip
            } else {
              currentClipIndex = reverse ? orderedClips.length - 1 : 0; // Reset or set index to the last clip
              playingReverse = false; // Reset reverse state
            }
          });
        }, data.delay * 1000);

        // Call the animate function to update the animation
        function animate() {
          if (!animationPlaying) {
            // Stop the animation loop if no animation is playing
            return;
          }
          requestAnimationFrame(animate);
          self.mixer.update(0.01); // Update the animation
        }

        animate(); // Start the animation loop
      }

      // Function to play animation clips simultaneously
      function playSimultaneousAnimations(reverse = false) {
        if (animationPlaying) {
          return;
        }

        animationPlaying = true;

        const model_simul = self.model;
        if (!model_simul) {
          console.error(`Model not found on target entity.`);
          animationPlaying = false;
          return;
        }

        const mixer_simul = new THREE.AnimationMixer(self.model);
        const actions_simul = [];

        for (const clip_simul of orderedClips) {
          const animationClip_simul = model_simul.animations.find(
            (a) => a.name === clip_simul.name
          );
          if (!animationClip_simul) {
            console.error(`Animation clip '${clip_simul.name}' not found.`);
            continue;
          }

          const action_simul = mixer_simul.clipAction(animationClip_simul);
          // Set loop mode for the action
          switch (clip_simul.loop) {
            case "loop":
              action_simul.setLoop(THREE.LoopRepeat);
              break;
            case "once":
              action_simul.setLoop(THREE.LoopOnce);
              action_simul.clampWhenFinished = true; // Ensure it stops after playing once
              break;
            case "pingpong":
              action_simul.setLoop(THREE.LoopPingPong);
              break;
            default:
              console.warn(
                `Invalid loop mode for clip '${clip_simul.name}', defaulting to 'once'`
              );
              action_simul.setLoop(THREE.LoopOnce);
          }

          // Set timeScale and time based on reverse state
          if (clip_simul.reverse || playingReverse || reverse) {
            action_simul.timeScale = -1;
            action_simul.time = animationClip_simul.duration;
          } else {
            action_simul.timeScale = 1;
            action_simul.time = 0;
          }

          actions_simul.push(action_simul);
        }

        setTimeout(() => {
          actions_simul.forEach((action_simul) => {
            action_simul.play();
          });
        }, data.delay * 1000);

        mixer_simul.addEventListener("finished", () => {
          animationPlaying = false;
        });

        function animate() {
          requestAnimationFrame(animate);
          mixer_simul.update(0.01);
        }

        animate();
      }

      // Function to add event listeners based on the trigger type
      function addEventListeners() {
        switch (data.trigger) {
          case "load":
            playSimultaneousAnimations();
          case "toggle":
            el.addEventListener("click", (e) => {
              //e.preventDefault();
              // console.log("click");

              isOddClick = !isOddClick; // Toggle odd/even on each click
              if (isOddClick) {
                playingReverse = false;
                currentClipIndex = 0;
                if (data.playMode === "consecutive") {
                  playAnimation();
                } else {
                  playSimultaneousAnimations();
                }
              } else {
                playingReverse = true;
                if (data.playMode === "consecutive") {
                  currentClipIndex = reverseClips.length - 1;
                  playAnimation(true);
                } else {
                  playSimultaneousAnimations();
                }
              }
            });
            break;
          case "mouseenter":
            el.addEventListener("mouseenter", () => {
              playingReverse = false;
              currentClipIndex = 0;
              if (data.playMode === "consecutive") {
                playAnimation();
              } else {
                playSimultaneousAnimations();
              }
            });
            break;
          case "mouseleave":
            el.addEventListener("mouseleave", () => {
              playingReverse = false;
              currentClipIndex = 0;
              if (data.playMode === "consecutive") {
                playAnimation();
              } else {
                playSimultaneousAnimations();
              }
            });
            break;
          case "mouseenter_leave":
            el.addEventListener("mouseenter", () => {
              playingReverse = false;
              if (data.playMode === "consecutive") {
                currentClipIndex = 0;
                playAnimation();
              } else {
                playSimultaneousAnimations();
              }
            });
            el.addEventListener("mouseleave", () => {
              playingReverse = true;
              if (data.playMode === "consecutive") {
                currentClipIndex = reverseClips.length - 1;
                playAnimation(true);
              } else {
                playSimultaneousAnimations();
              }
            });
            break;
          default:
            // Default to 'click' trigger
            el.addEventListener("click", () => {
              playingReverse = false;
              currentClipIndex = 0;
              if (data.playMode === "consecutive") {
                playAnimation();
              } else {
                playSimultaneousAnimations();
              }
            });

            break;
        }
      }

      // Initial addition of event listeners
      addEventListeners();
    });
  },
});



const addClickEvent = () => {
  document.addEventListener('click', () => {
      const video = document.querySelector('video');
      const videoMessage = document.getElementById('LoadExib');

      video.play();
  });  
};

window.addEventListener('load', addClickEvent);
