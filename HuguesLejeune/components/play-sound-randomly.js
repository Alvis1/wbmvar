AFRAME.registerComponent('play-sound-randomly', {
    schema: {
        minInterval: { type: 'number', default: 5000 },
        maxInterval: { type: 'number', default: 15000 },
    },

    init() {
        this.playSound();
    },

    playSound() {
        const sound = this.el.components.sound;
        const rand = Math.random() * (this.data.maxInterval - this.data.minInterval) + this.data.minInterval;
        
        setTimeout(() => {
            if (sound) {
                sound.playSound();
            }
            this.playSound();
        }, rand);
    }
});
