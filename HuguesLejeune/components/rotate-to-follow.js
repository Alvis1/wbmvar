AFRAME.registerComponent('rotate-to-follow-y', {
    schema: {
        target: {type: 'selector'},
    },

    tick() {
        const target3D = this.data.target.object3D;
        const object3D = this.el.object3D;

        const dx = target3D.position.x - object3D.position.x;
        const dz = target3D.position.z - object3D.position.z;

        object3D.rotation.y = Math.atan2(dx, dz);
    },
});
