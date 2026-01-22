AFRAME.registerComponent("rotate-to-follow-y", {
    schema: {
        target: { type: "selector" },
    },

    tick() {
        const targetPosition = new THREE.Vector3();
        const objectPosition = new THREE.Vector3();

        this.data.target.object3D.getWorldPosition(targetPosition);
        this.el.object3D.getWorldPosition(objectPosition);

        const dx = targetPosition.x - objectPosition.x;
        const dz = targetPosition.z - objectPosition.z;

        this.el.object3D.rotation.y = Math.atan2(dx, dz);
    },
});
