AFRAME.registerComponent('update-atmosphere-uniforms', {
    schema: {
        target: {type: 'selector'},
        sunSelector: {type: 'string', default: '#sun'}
    },
    
    init: function() {
        this.targetMesh = null;
        this.depthRenderTarget = null;
        this.sunEntity = null;
        this.sunPosition = new THREE.Vector3();
        this.planetElements = [];
        this.skyElement = null;
        
        this.el.sceneEl.addEventListener('renderstart', () => {
            const renderer = this.el.sceneEl.renderer;
            const size = renderer.getSize(new THREE.Vector2());
            
            this.depthRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter
            });
            this.depthRenderTarget.depthTexture = new THREE.DepthTexture(
                size.x, 
                size.y,
                THREE.UnsignedShortType
            );
            this.sunEntity = document.querySelector(this.data.sunSelector);
            this.planetElements = Array.from(document.querySelectorAll('[planet-atmosphere]'));
            this.skyElement = document.querySelector('a-sky');
            if (!this.sunEntity)
                console.warn('update-atmosphere-uniforms: Sun entity not found with selector', this.data.sunSelector);
        });
    },
    
    tick: function() {
        if (!this.data.target || !this.depthRenderTarget) return;
        if (!this.targetMesh)
            this.targetMesh = this.data.target.getObject3D('mesh');
        if (!this.targetMesh || !this.targetMesh.material) return;
        const material = this.targetMesh.material;
        if (!material.uniforms || !material.uniforms.uCameraPos) {
            console.warn('Uniforms not found on material');
            return;
        }
        const scene = this.el.sceneEl;
        const camera = this.el.getObject3D('camera');
        const renderer = scene.renderer;
        // render depth
        const currentRenderTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(this.depthRenderTarget);
        renderer.render(scene.object3D, camera);
        renderer.setRenderTarget(currentRenderTarget);

        const cameraPos = new THREE.Vector3();
        this.el.object3D.getWorldPosition(cameraPos);
        
        material.uniforms.uCameraPos.value.copy(cameraPos);
        material.uniforms.tDepth.value = this.depthRenderTarget.depthTexture;
        material.uniforms.cameraNear.value = camera.near;
        material.uniforms.cameraFar.value = camera.far;
        
        if (this.sunEntity) {
            this.sunEntity.object3D.getWorldPosition(this.sunPosition);
            this.planetElements.forEach(planetEl => {
                const planetComp = planetEl.components['planet-atmosphere'];
                if (planetComp) {
                    planetComp.data.sunPosition = {
                        x: this.sunPosition.x,
                        y: this.sunPosition.y,
                        z: this.sunPosition.z
                    };
                }
            });
            if (this.skyElement) {
                const skyMaterial = this.skyElement.components.material;
                if (skyMaterial && skyMaterial.shader === 'sky') {
                    this.skyElement.setAttribute('material', {
                        sunPosition: `${this.sunPosition.x} ${this.sunPosition.y} ${this.sunPosition.z}`
                    });
                }
            }
            const lightDir = this.sunPosition.clone().normalize();
            material.uniforms.uLightDir.value.copy(lightDir);
        }
        material.uniformsNeedUpdate = true;
    }
});
