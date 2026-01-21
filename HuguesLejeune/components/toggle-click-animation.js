AFRAME.registerComponent('toggle-click-animation', {
    schema: {
        property: {type: 'string', default: ''},
        from: {type: 'string', default: ''},
        to: {type: 'string', default: ''},
    },

    init() {
        this.toggled = false;

        this.el.addEventListener('click', () => {
            const to = this.toggled ? this.data.from : this.data.to;

            this.el.setAttribute(
                'animation',
                `property: ${this.data.property}; to: ${to}`,
            );
            this.toggled = !this.toggled;
        });
    },
});
