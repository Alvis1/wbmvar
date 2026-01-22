AFRAME.registerComponent('vr-camera-position', {
    schema: {
        pcPosition: {type: 'vec3', default: {x: 0, y: 0.5, z: -1.15}},
        vrPosition: {type: 'vec3', default: {x: 0, y: 0, z: 0}}
    },
    
    init: function() {
        this.onEnterVR = this.onEnterVR.bind(this);
        this.onExitVR = this.onExitVR.bind(this);
        
        this.el.sceneEl.addEventListener('enter-vr', this.onEnterVR);
        this.el.sceneEl.addEventListener('exit-vr', this.onExitVR);
        
        if (this.el.sceneEl.is('vr-mode')) {
            this.setVRPosition();
        } else {
            this.setPCPosition();
        }
    },
    
    onEnterVR: function() {
        this.setVRPosition();
    },
    
    onExitVR: function() {
        this.setPCPosition();
    },
    
    setVRPosition: function() {
        this.el.setAttribute('position', this.data.vrPosition);
    },
    
    setPCPosition: function() {
        this.el.setAttribute('position', this.data.pcPosition);
    },
    
    remove: function() {
        this.el.sceneEl.removeEventListener('enter-vr', this.onEnterVR);
        this.el.sceneEl.removeEventListener('exit-vr', this.onExitVR);
    }
});
