AFRAME.registerComponent('toggle-click-animation', {
    schema: {
        property: {type: 'string', default: ''},
        from: {type: 'string', default: ''},
        to: {type: 'string', default: ''},
        dur: {type: 'number', default: 500},
        easing: {type: 'string', default: 'easeInOutCirc'},
    },

    init() {
        this.toggled = false;

        this.el.addEventListener('click', () => {
            const to = this.toggled ? this.data.from : this.data.to;

            this.el.setAttribute(
                'animation',
                `property: ${this.data.property}; to: ${to}; dur: ${this.data.dur}; easing: ${this.data.easing}`,
            );
            this.toggled = !this.toggled;
        });
    },
});

AFRAME.registerComponent('toggle-click-target-animation', {
    schema: {
        target: {type: 'selector'},
        property: {type: 'string', default: ''},
        from: {type: 'string', default: ''},
        to: {type: 'string', default: ''},
        dur: {type: 'number', default: 500},
        easing: {type: 'string', default: 'easeInOutCirc'},
    },

    init() {
        this.toggled = false;

        this.el.addEventListener('click', () => {
            const to = this.toggled ? this.data.from : this.data.to;

            this.data.target.setAttribute(
                'animation',
                `property: ${this.data.property}; to: ${to}; dur: ${this.data.dur}; easing: ${this.data.easing}`,
            );
            this.toggled = !this.toggled;
        });
    },
});

