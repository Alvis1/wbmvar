AFRAME.registerComponent('sky-follow-camera', {
    init: function() {
        this.camera = null;
    },

    tick: function() {
        if (!this.camera) {
            this.camera = document.querySelector('[camera]');
            if (!this.camera) return;
        }

        const cameraWorldPos = new THREE.Vector3();
        this.camera.object3D.getWorldPosition(cameraWorldPos);

        this.el.object3D.position.copy(cameraWorldPos);
    }
});
