AFRAME.registerComponent('spaceship-controls', {
    schema: {
        speed: { type: 'number', default: 2 },
        rotationSpeed: { type: 'number', default: 3 },
        acceleration: { type: 'number', default: 4 },
        rotationAcceleration: { type: 'number', default: 0.15 },
        damping: { type: 'number', default: 0.97 },
        rotationDamping: { type: 'number', default: 0.94 }
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
            rollRight: false
        };
        
        // Velocity for movement
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        // Angular velocity for rotation
        this.angularVelocity = new THREE.Vector3(0, 0, 0);
        
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
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
        }
    },

    tick: function(time, timeDelta) {
        const el = this.el;
        const data = this.data;
        const deltaSeconds = timeDelta / 1000;
        const object3D = el.object3D;
        
        // === ROTATION WITH INERTIA ===
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
        
        this.angularVelocity.multiplyScalar(data.rotationDamping);
        
        object3D.rotateY(this.angularVelocity.y);
        object3D.rotateX(this.angularVelocity.x);
        object3D.rotateZ(this.angularVelocity.z);
        
        const maxAngularVel = data.rotationSpeed * (Math.PI / 180);
        this.angularVelocity.clampLength(0, maxAngularVel);
        
        // === MOVEMENT WITH INERTIA ===
        const forwardVector = new THREE.Vector3(0, 0, -1);
        forwardVector.applyQuaternion(object3D.quaternion);
        
        if (this.keys.forward) {
            this.velocity.add(forwardVector.clone().multiplyScalar(data.acceleration * deltaSeconds));
        }
        if (this.keys.backward) {
            this.velocity.add(forwardVector.clone().multiplyScalar(-data.acceleration * deltaSeconds));
        }
        
        if (this.velocity.length() > data.speed) {
            this.velocity.normalize().multiplyScalar(data.speed);
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
    }
});
