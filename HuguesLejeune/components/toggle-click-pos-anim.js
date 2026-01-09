AFRAME.registerComponent('toggle-click-pos-anim', {

    schema: {
        to: {type: 'vec3', default: {x: 0, y: 1, z: 0}},
        dur: {type: 'number', default: 500},
        easing: {type: 'string', default: 'easeInOutQuad'},
    },

    init() {
        this.toggled = false;
        this.origin = this.el.getAttribute('position');

        this.el.addEventListener('click', () => {
            const to = this.toggled ? this.origin : this.data.to;
            console.log('Animating to:', to);

            this.el.setAttribute(
                'animation__click',
                `property: position; to: ${to.x} ${to.y} ${to.z}; dur: ${this.data.dur}; easing: ${this.data.easing}; dir: alternate; startEvents: click`
            );
            this.toggled = !this.toggled;
        });
    },

});
