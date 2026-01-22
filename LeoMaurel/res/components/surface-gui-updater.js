AFRAME.registerComponent('surface-gui-updater', {
    schema: {
        textSelector: { type: 'string', default: '#surface-gui a-text' }
    },

    init: function() {
        this.textElement = document.querySelector(this.data.textSelector);
        this.spaceshipControls = this.el.components['spaceship-controls'];
        
        if (!this.textElement) {
            console.error('Surface GUI text element not found!');
        }
        
        if (!this.spaceshipControls) {
            console.error('Spaceship controls component not found!');
        }
    },

    tick: function(time, timeDelta) {
        if (!this.textElement || !this.spaceshipControls) {
            return;
        }
        
        const controls = this.spaceshipControls;
        
        if (controls.isWarping) {
            this.textElement.setAttribute('value', 'Warp Dive Mode');
            this.textElement.setAttribute('color', '#ff3333');
        } else if (controls.warpCountdownActive) {
            const secondsLeft = Math.ceil(controls.warpCountdownTimer);
            this.textElement.setAttribute('value', 'Warp in ' + secondsLeft + '...');
            this.textElement.setAttribute('color', '#ffaa00');
        } else if (controls.isBoosting) {
            this.textElement.setAttribute('value', 'Boosting Mode');
            this.textElement.setAttribute('color', '#3399ff');
        } else {
            this.textElement.setAttribute('value', 'Normal Mode');
            this.textElement.setAttribute('color', '#ffffff');
        }
    }
});
