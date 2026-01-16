AFRAME.registerComponent('atmospheric-post-processing', {
    schema: {
    },

    init: function() {
        this.depthRenderTarget = null;
        this.postProcessingMaterials = [];
        this.renderTarget = null;
        this.planets = [];
        this.waveLenghts = new THREE.Vector3(700, 530, 440); // RGB in nm
        this.scatteringStrength = 1.0;

        const scene = this.el.sceneEl;

        if (scene.hasLoaded) {
            this.setup();
        } else {
            scene.addEventListener('loaded', () => {
                this.setup();
            });
        }
    },

    setup: function() {
        const scene = this.el.sceneEl;
        const renderer = scene.renderer;
        const camera = scene.camera;
        const size = renderer.getSize(new THREE.Vector2());

        this.findPlanets();
        this.depthRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter
        });
        this.depthRenderTarget.depthTexture = new THREE.DepthTexture(
            size.x, 
            size.y,
            THREE.UnsignedShortType
        );
        scatterR = Math.pow(400 / this.waveLenghts.x, 4.0) * this.scatteringStrength;
        scatterG = Math.pow(400 / this.waveLenghts.y, 4.0) * this.scatteringStrength;
        scatterB = Math.pow(400 / this.waveLenghts.z, 4.0) * this.scatteringStrength;
        this.scatterCoefficients = new THREE.Vector3(scatterR, scatterG, scatterB);

        this.renderTarget = new THREE.WebGLRenderTarget(size.x, size.y);

        Promise.all([
            fetch('res/shaders/atmospheric_post.vert').then(r => r.text()),
            fetch('res/shaders/atmospheric_post.frag').then(r => r.text())
        ]).then(([vertexShader, fragmentShader]) => {
            this.planets.forEach(planet => {
                const material = new THREE.ShaderMaterial({
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    uniforms: {
                        tDiffuse: { value: null },
                        tDepth: { value: this.depthRenderTarget.depthTexture },
                        uCameraPos: { value: new THREE.Vector3() },
                        uLightDir: { value: new THREE.Vector3() },
                        uPlanetRadius: { value: planet.planetRadius },
                        uPlanetCenter: { value: new THREE.Vector3().copy(planet.position) },
                        cameraNear: { value: camera.near },
                        cameraFar: { value: camera.far },
                        cameraInverseProjection: { value: new THREE.Matrix4() },
                        cameraWorldMatrix: { value: new THREE.Matrix4() },
                        upAtmosphereRadius: { value: planet.atmosphereRadius },
                        upDensityFalloff: { value: 4.0 },
                        uScatterCoefficients: { value: this.scatterCoefficients }
                    }
                });
                
                this.postProcessingMaterials.push({
                    material: material,
                    planet: planet
                });
            });

            // post-processing quad
            this.quad = new THREE.Mesh(
                new THREE.PlaneGeometry(2, 2),
                null
            );
            this.orthoScene = new THREE.Scene();
            this.orthoScene.add(this.quad);
            this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        });
    },

    findPlanets: function() {
        const planetElements = document.querySelectorAll('[planet-atmosphere]');
        
        planetElements.forEach(el => {
            const data = el.components['planet-atmosphere'].data;
            this.planets.push({
                element: el,
                position: new THREE.Vector3(data.center.x, data.center.y, data.center.z),
                atmosphereRadius: data.atmosphereRadius,
                planetRadius: data.planetRadius,
                sunPosition: new THREE.Vector3(data.sunPosition.x, data.sunPosition.y, data.sunPosition.z)
            });
        });
    },

    tick: function() {
        if (this.postProcessingMaterials.length === 0) return;
        const scene = this.el.sceneEl;
        const camera = scene.camera;

        const cameraPos = new THREE.Vector3();
        camera.getWorldPosition(cameraPos);

        this.postProcessingMaterials.forEach(({material, planet}) => {
            material.uniforms.uCameraPos.value.copy(cameraPos);
            
            const lightDir = planet.sunPosition.clone().normalize();
            material.uniforms.uLightDir.value.copy(lightDir);

            // update camera matrices
            material.uniforms.cameraInverseProjection.value.copy(camera.projectionMatrixInverse);
            material.uniforms.cameraWorldMatrix.value.copy(camera.matrixWorld);
            material.uniforms.cameraNear.value = camera.near;
            material.uniforms.cameraFar.value = camera.far;
            
            material.uniforms.uPlanetCenter.value.copy(planet.position);
        });
    },

    tock: function() {
        if (this.postProcessingMaterials.length === 0) return;
        const scene = this.el.sceneEl;
        const renderer = scene.renderer;
        const camera = scene.camera;
        const currentRenderTarget = renderer.getRenderTarget();

        renderer.setRenderTarget(this.depthRenderTarget);
        renderer.render(scene.object3D, camera);

        // render scene to temp target
        renderer.setRenderTarget(this.renderTarget);
        renderer.render(scene.object3D, camera);

        let currentSource = this.renderTarget.texture;
        const cameraPos = new THREE.Vector3();
        camera.getWorldPosition(cameraPos);
        
        // sort materials by distance (first one is the farthest planet)
        const sortedMaterials = [...this.postProcessingMaterials].sort((a, b) => {
            const distA = cameraPos.distanceTo(a.planet.position);
            const distB = cameraPos.distanceTo(b.planet.position);
            return distB - distA; // far to near
        });

        sortedMaterials.forEach(({material}, index) => {
            material.uniforms.tDiffuse.value = currentSource;
            this.quad.material = material;
            renderer.setRenderTarget(null);
            renderer.render(this.orthoScene, this.orthoCamera);
        });
        renderer.setRenderTarget(currentRenderTarget);
    },

    remove: function() {
        if (this.depthRenderTarget) this.depthRenderTarget.dispose();
        if (this.renderTarget) this.renderTarget.dispose();
        this.postProcessingMaterials.forEach(({material}) => material.dispose());
    }
});
