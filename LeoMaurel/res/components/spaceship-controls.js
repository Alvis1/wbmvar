AFRAME.registerComponent('spaceship-controls', {
    schema: {
        speed: { type: 'number', default: 2 },
        boostSpeed: { type: 'number', default: 6 },
        warpSpeed: { type: 'number', default: 65 },
        warpCountdown: { type: 'number', default: 3 },
        rotationSpeed: { type: 'number', default: 3 },
        acceleration: { type: 'number', default: 4 },
        rotationAcceleration: { type: 'number', default: 0.15 },
        damping: { type: 'number', default: 0.97 },
        rotationDamping: { type: 'number', default: 0.94 },
        axisDeadzone: { type: 'number', default: 0.1 }
    },

    init: function() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            pitchUp: false,
            pitchDown: false,
            rollLeft: false,
            rollRight: false,
            warpR: false,
            warpT: false
        };
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.angularVelocity = new THREE.Vector3(0, 0, 0);
        
        this.leftController = null;
        this.rightController = null;
        this.leftAxes = { x: 0, y: 0 };
        this.rightAxes = { x: 0, y: 0 };
        this.controllersSetup = false;
        
        this.isBoosting = false;
        this.onTriggerDown = this.onTriggerDown.bind(this);
        this.onTriggerUp = this.onTriggerUp.bind(this);
        
        this.isWarping = false;
        this.warpCountdownActive = false;
        this.warpCountdownTimer = 0;
        this.leftGripPressed = false;
        this.rightGripPressed = false;
        this.onGripDown = this.onGripDown.bind(this);
        this.onGripUp = this.onGripUp.bind(this);
        
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onAxisMove = this.onAxisMove.bind(this);
        
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        
        if (this.el.sceneEl.hasLoaded) {
            this.setupControllers();
        } else {
            this.el.sceneEl.addEventListener('loaded', () => {
                this.setupControllers();
            });
        }
    },

    setupControllers: function() {
        const leftHand = document.querySelector('#leftHand');
        const rightHand = document.querySelector('#rightHand');
        
        if (leftHand) {
            if (leftHand.components['meta-touch-controls']) {
                this.attachLeftController(leftHand);
            } else {
                leftHand.addEventListener('componentinitialized', (evt) => {
                    if (evt.detail.name === 'meta-touch-controls') {
                        this.attachLeftController(leftHand);
                    }
                });
            }
        }
        
        if (rightHand) {
            if (rightHand.components['meta-touch-controls']) {
                this.attachRightController(rightHand);
            } else {
                rightHand.addEventListener('componentinitialized', (evt) => {
                    if (evt.detail.name === 'meta-touch-controls') {
                        this.attachRightController(rightHand);
                    }
                });
            }
        }
        
        this.controllersSetup = true;
    },

    attachLeftController: function(leftHand) {
        this.leftController = leftHand;
        // meta quest specific events
        leftHand.addEventListener('thumbstickmoved', this.onAxisMove);
        leftHand.addEventListener('axismove', this.onAxisMove);
        
        leftHand.addEventListener('triggerdown', this.onTriggerDown);
        leftHand.addEventListener('triggerup', this.onTriggerUp);
        leftHand.addEventListener('gripdown', this.onGripDown);
        leftHand.addEventListener('gripup', this.onGripUp);
        console.log('trigger and grip added to left controller');
    },

    attachRightController: function(rightHand) {
        this.rightController = rightHand;
        // meta quest specific events
        rightHand.addEventListener('thumbstickmoved', this.onAxisMove);
        rightHand.addEventListener('axismove', this.onAxisMove);

        rightHand.addEventListener('gripdown', this.onGripDown);
        rightHand.addEventListener('gripup', this.onGripUp);
    },

    onTriggerDown: function(event) {
        this.isBoosting = true;
    },

    onTriggerUp: function(event) {
        this.isBoosting = false;
    },

    onGripDown: function(event) {
        const hand = event.target.components['meta-touch-controls'].data.hand;
        
        if (hand === 'left') {
            this.leftGripPressed = true;
        } else if (hand === 'right') {
            this.rightGripPressed = true;
        }
        
        if (this.leftGripPressed && this.rightGripPressed && !this.warpCountdownActive && !this.isWarping) {
            console.log('countdown');
            this.warpCountdownActive = true;
            this.warpCountdownTimer = this.data.warpCountdown;
        }
    },

    onGripUp: function(event) {
        const hand = event.target.components['meta-touch-controls'].data.hand;
        
        if (hand === 'left') {
            this.leftGripPressed = false;
        } else if (hand === 'right') {
            this.rightGripPressed = false;
        }
        
        if (!this.leftGripPressed || !this.rightGripPressed) {
            if (this.warpCountdownActive) {
                console.log('warp dive cancelled');
                this.warpCountdownActive = false;
                this.warpCountdownTimer = 0;
            }
            if (this.isWarping) {
                console.log('warp dive ended');
                this.isWarping = false;
            }
        }
    },

    onAxisMove: function(event) {        
        const metaTouchComponent = event.target.components['meta-touch-controls'];
        if (!metaTouchComponent) {
            console.warn('no meta-touch-controls component found');
            return;
        }
        
        const hand = metaTouchComponent.data.hand;
        
        let axisX, axisY;
        if (event.type === 'thumbstickmoved') {
            axisX = event.detail.x;
            axisY = event.detail.y;
        } else if (event.type === 'axismove') {
            const axes = event.detail.axis;
            axisX = axes[0];
            axisY = axes[1];
        } else {
            return;
        }
        
        console.log('hand:', hand, 'x:', axisX, 'y:', axisY);
        
        if (hand === 'left') {
            this.leftAxes.x = axisX;
            this.leftAxes.y = axisY;
        } else if (hand === 'right') {
            this.rightAxes.x = axisX;
            this.rightAxes.y = axisY;
        }
    },

    onKeyDown: function(event) {
        switch(event.code) {
            case 'KeyW':
                this.keys.forward = true;
                break;
            case 'KeyS':
                this.keys.backward = true;
                break;
            case 'KeyA':
                this.keys.left = true;
                break;
            case 'KeyD':
                this.keys.right = true;
                break;
            case 'KeyZ':
                this.keys.pitchUp = true;
                break;
            case 'KeyX':
                this.keys.pitchDown = true;
                break;
            case 'KeyQ':
                this.keys.rollLeft = true;
                break;
            case 'KeyE':
                this.keys.rollRight = true;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                console.log('Boost activated via keyboard!');
                this.isBoosting = true;
                break;
            case 'KeyR':
                this.keys.warpR = true;
                this.checkKeyboardWarp();
                break;
            case 'KeyT':
                this.keys.warpT = true;
                this.checkKeyboardWarp();
                break;
        }
    },

    checkKeyboardWarp: function() {
        if (this.keys.warpR && this.keys.warpT && !this.warpCountdownActive && !this.isWarping) {
            console.log('Warp countdown started (keyboard)!');
            this.warpCountdownActive = true;
            this.warpCountdownTimer = this.data.warpCountdown;
        }
    },

    onKeyUp: function(event) {
        switch(event.code) {
            case 'KeyW':
                this.keys.forward = false;
                break;
            case 'KeyS':
                this.keys.backward = false;
                break;
            case 'KeyA':
                this.keys.left = false;
                break;
            case 'KeyD':
                this.keys.right = false;
                break;
            case 'KeyZ':
                this.keys.pitchUp = false;
                break;
            case 'KeyX':
                this.keys.pitchDown = false;
                break;
            case 'KeyQ':
                this.keys.rollLeft = false;
                break;
            case 'KeyE':
                this.keys.rollRight = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                console.log('Boost deactivated via keyboard');
                this.isBoosting = false;
                break;
            case 'KeyR':
                this.keys.warpR = false;
                this.checkKeyboardWarpCancel();
                break;
            case 'KeyT':
                this.keys.warpT = false;
                this.checkKeyboardWarpCancel();
                break;
        }
    },

    checkKeyboardWarpCancel: function() {
        if (!this.keys.warpR || !this.keys.warpT) {
            if (this.warpCountdownActive) {
                console.log('Warp countdown cancelled (keyboard)!');
                this.warpCountdownActive = false;
                this.warpCountdownTimer = 0;
            }
            if (this.isWarping) {
                console.log('Warp dive ended (keyboard)!');
                this.isWarping = false;
            }
        }
    },

    tick: function(time, timeDelta) {
        const el = this.el;
        const data = this.data;
        const deltaSeconds = timeDelta / 1000;
        const object3D = el.object3D;
        
        // === ROTATION WITH INERTIA ===
        if (!this.isWarping) {
            const rotAccel = data.rotationAcceleration * deltaSeconds * 50 * (Math.PI / 180);
            
            if (this.keys.left) {
                this.angularVelocity.y += rotAccel;
            }
            if (this.keys.right) {
                this.angularVelocity.y -= rotAccel;
            }
            if (this.keys.pitchUp) {
                this.angularVelocity.x += rotAccel;
            }
            if (this.keys.pitchDown) {
                this.angularVelocity.x -= rotAccel;
            }
            if (this.keys.rollLeft) {
                this.angularVelocity.z += rotAccel;
            }
            if (this.keys.rollRight) {
                this.angularVelocity.z -= rotAccel;
            }

            if (this.leftController) {
                const leftX = Math.abs(this.leftAxes.x) > data.axisDeadzone ? this.leftAxes.x : 0;
                this.angularVelocity.y -= leftX * rotAccel * 0.7;
            }
            
            if (this.rightController) {
                const rightX = Math.abs(this.rightAxes.x) > data.axisDeadzone ? this.rightAxes.x : 0;
                const rightY = Math.abs(this.rightAxes.y) > data.axisDeadzone ? this.rightAxes.y : 0;
                
                this.angularVelocity.z += rightX * rotAccel * 0.7;
                this.angularVelocity.x += rightY * rotAccel * 0.7;
            }
        } else {
            this.angularVelocity.multiplyScalar(0.85);
        }
        
        this.angularVelocity.multiplyScalar(data.rotationDamping);
        
        object3D.rotateY(this.angularVelocity.y);
        object3D.rotateX(this.angularVelocity.x);
        object3D.rotateZ(this.angularVelocity.z);
        
        const maxAngularVel = data.rotationSpeed * (Math.PI / 180);
        this.angularVelocity.clampLength(0, maxAngularVel);
        
        // === TRANSLATION WITH INERTIA ===
        const forwardVector = new THREE.Vector3(0, 0, -1);
        forwardVector.applyQuaternion(object3D.quaternion);
        
        const rightVector = new THREE.Vector3(1, 0, 0);
        rightVector.applyQuaternion(object3D.quaternion);
        
        if (!this.isWarping) {
            const accelMultiplier = this.isBoosting ? data.boostSpeed : 1;
            if (this.keys.forward) {
                this.velocity.add(forwardVector.clone().multiplyScalar(data.acceleration * accelMultiplier * deltaSeconds));
            }
            if (this.keys.backward) {
                this.velocity.add(forwardVector.clone().multiplyScalar(-data.acceleration * accelMultiplier * deltaSeconds));
            }
        }
        
        if (this.leftController && !this.isWarping) {
            const leftY = Math.abs(this.leftAxes.y) > data.axisDeadzone ? this.leftAxes.y : 0;
            const accelMultiplier = this.isBoosting ? data.boostSpeed : 1;
            
            this.velocity.add(forwardVector.clone().multiplyScalar(-leftY * data.acceleration * accelMultiplier * deltaSeconds * 0.7));
        }
        
        if (this.leftController) {
            const metaTouchComponent = this.leftController.components['meta-touch-controls'];
            if (metaTouchComponent && metaTouchComponent.el.components['tracked-controls']) {
                const gamepad = metaTouchComponent.el.components['tracked-controls'].controller;
                if (gamepad && gamepad.buttons && gamepad.buttons[0]) {
                    const triggerPressed = gamepad.buttons[0].pressed;
                    if (triggerPressed && !this.isBoosting) {
                        console.log('Boost activated via direct trigger state!');
                        this.isBoosting = true;
                    } else if (!triggerPressed && this.isBoosting && !event.shiftKey) {
                        console.log('Boost deactivated via direct trigger state');
                        this.isBoosting = false;
                    }
                }
            }
        }
        
        if (this.isWarping) {
            this.velocity.add(forwardVector.clone().multiplyScalar(data.acceleration * data.warpSpeed * deltaSeconds));
        }
        
        if (this.warpCountdownActive) {
            this.warpCountdownTimer -= deltaSeconds;
            
            const secondsLeft = Math.ceil(this.warpCountdownTimer);
            if (secondsLeft !== this.lastCountdownSecond) {
                console.log('Warp in:', secondsLeft);
                this.lastCountdownSecond = secondsLeft;
            }
            
            if (this.warpCountdownTimer <= 0) {
                console.log('WARP DRIVE ACTIVATED!');
                this.isWarping = true;
                this.warpCountdownActive = false;
                this.warpCountdownTimer = 0;
            }
        }
        
        let speedMultiplier = 1;
        if (this.isWarping) {
            speedMultiplier = data.warpSpeed;
        } else if (this.isBoosting) {
            speedMultiplier = data.boostSpeed;
        }
        
        const maxSpeed = data.speed * speedMultiplier;
        
        if (Math.floor(time) % 1000 < 20) {
            console.log('Warp:', this.isWarping, '| Boost:', this.isBoosting, '| Multiplier:', speedMultiplier, '| Max speed:', maxSpeed, '| Current speed:', this.velocity.length().toFixed(2));
        }
        
        if (this.velocity.length() > maxSpeed) {
            this.velocity.normalize().multiplyScalar(maxSpeed);
        }
        
        this.velocity.multiplyScalar(data.damping);
        
        const position = el.getAttribute('position');
        position.x += this.velocity.x;
        position.y += this.velocity.y;
        position.z += this.velocity.z;
        el.setAttribute('position', position);
    },

    remove: function() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        
        if (this.leftController) {
            this.leftController.removeEventListener('thumbstickmoved', this.onAxisMove);
            this.leftController.removeEventListener('axismove', this.onAxisMove);
            this.leftController.removeEventListener('triggerdown', this.onTriggerDown);
            this.leftController.removeEventListener('triggerup', this.onTriggerUp);
            this.leftController.removeEventListener('gripdown', this.onGripDown);
            this.leftController.removeEventListener('gripup', this.onGripUp);
        }
        if (this.rightController) {
            this.rightController.removeEventListener('thumbstickmoved', this.onAxisMove);
            this.rightController.removeEventListener('axismove', this.onAxisMove);
            this.rightController.removeEventListener('gripdown', this.onGripDown);
            this.rightController.removeEventListener('gripup', this.onGripUp);
        }
    }
});
