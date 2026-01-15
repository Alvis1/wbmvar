AFRAME.registerComponent('spaceship-controls', {
    schema: {
        speed: { type: 'number', default: 10 },
        rotationSpeed: { type: 'number', default: 1 }
    },

    init: function() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
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
        }
    },

    tick: function(time, timeDelta) {
        const el = this.el;
        const data = this.data;
        const deltaSeconds = timeDelta / 1000;
        const rotation = el.getAttribute('rotation');
        
        if (this.keys.left)
            rotation.y += data.rotationSpeed * deltaSeconds * 50;
        if (this.keys.right)
            rotation.y -= data.rotationSpeed * deltaSeconds * 50;
        el.setAttribute('rotation', rotation);
        if (this.keys.forward || this.keys.backward) {
            const position = el.getAttribute('position');
            const radAngle = (rotation.y * Math.PI) / 180;
            const direction = this.keys.forward ? 1 : -1;
            const speed = data.speed * deltaSeconds * direction;

            position.x -= Math.sin(radAngle) * speed;
            position.z -= Math.cos(radAngle) * speed;
            el.setAttribute('position', position);
        }
    },

    remove: function() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    }
});
