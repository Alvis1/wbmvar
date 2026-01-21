AFRAME.registerComponent('atmosphere-gui', {
    init: function() {
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
        const planetEl = document.querySelector('[planet-atmosphere]');
        if (!planetEl) {
            console.warn('No planet with planet-atmosphere component found');
            return;
        }
        const planetComponent = planetEl.components['planet-atmosphere'];
        const postProcessing = this.el.components['atmospheric-post-processing'];
        const sunEl = document.querySelector('#sun');

        const gui = new dat.GUI();
        gui.domElement.style.position = 'absolute';
        gui.domElement.style.top = '10px';
        gui.domElement.style.right = '10px';
        gui.domElement.style.zIndex = '9999';

        // parameters object for gui
        const params = {
            planetRadius: planetComponent.data.planetRadius,
            atmosphereRadius: planetComponent.data.atmosphereRadius,
            centerX: planetComponent.data.center.x,
            centerY: planetComponent.data.center.y,
            centerZ: planetComponent.data.center.z,
            sunX: planetComponent.data.sunPosition.x,
            sunY: planetComponent.data.sunPosition.y,
            sunZ: planetComponent.data.sunPosition.z,
            wavelengthR: postProcessing.waveLenghts.x,
            wavelengthG: postProcessing.waveLenghts.y,
            wavelengthB: postProcessing.waveLenghts.z,
            scatteringStrength: postProcessing.scatteringStrength,
            densityFalloff: 4.0,
            
            reset: () => {
                params.planetRadius = 80;
                params.atmosphereRadius = 90;
                params.centerX = 0;
                params.centerY = 1.6;
                params.centerZ = -3;
                params.sunX = -230.18989;
                params.sunY = 139.65639;
                params.sunZ = -115.81083;
                params.wavelengthR = 700;
                params.wavelengthG = 530;
                params.wavelengthB = 440;
                params.scatteringStrength = 1.0;
                params.densityFalloff = 4.0;
                
                for (let i in gui.__controllers) {
                    gui.__controllers[i].updateDisplay();
                }
                this.updateParameters();
            }
        };

        const planetFolder = gui.addFolder('Planet');
        planetFolder.add(params, 'planetRadius', 10, 200).onChange(() => this.updateParameters());
        planetFolder.add(params, 'atmosphereRadius', 10, 250).onChange(() => this.updateParameters());
        planetFolder.open();

        const centerFolder = gui.addFolder('Planet Center');
        centerFolder.add(params, 'centerX', -100, 100).onChange(() => this.updateParameters());
        centerFolder.add(params, 'centerY', -50, 50).onChange(() => this.updateParameters());
        centerFolder.add(params, 'centerZ', -100, 100).onChange(() => this.updateParameters());

        const sunFolder = gui.addFolder('Sun Position');
        sunFolder.add(params, 'sunX', -500, 500).onChange(() => this.updateParameters());
        sunFolder.add(params, 'sunY', -500, 500).onChange(() => this.updateParameters());
        sunFolder.add(params, 'sunZ', -500, 500).onChange(() => this.updateParameters());

        const scatteringFolder = gui.addFolder('Atmospheric Scattering');
        scatteringFolder.add(params, 'wavelengthR', 380, 780).name('Red Wavelength (nm)').onChange(() => this.updateParameters());
        scatteringFolder.add(params, 'wavelengthG', 380, 780).name('Green Wavelength (nm)').onChange(() => this.updateParameters());
        scatteringFolder.add(params, 'wavelengthB', 380, 780).name('Blue Wavelength (nm)').onChange(() => this.updateParameters());
        scatteringFolder.add(params, 'scatteringStrength', 0.1, 3.0).onChange(() => this.updateParameters());
        scatteringFolder.add(params, 'densityFalloff', 0.5, 10.0).onChange(() => this.updateParameters());
        scatteringFolder.open();

        gui.add(params, 'reset');

        this.gui = gui;
        this.params = params;
        this.planetEl = planetEl;
        this.planetComponent = planetComponent;
        this.postProcessing = postProcessing;
        this.sunEl = sunEl;
    },

    updateParameters: function() {
        const params = this.params;
        const planetEl = this.planetEl;
        const postProcessing = this.postProcessing;
        const sunEl = this.sunEl;

        planetEl.setAttribute('planet-atmosphere', {
            center: { x: params.centerX, y: params.centerY, z: params.centerZ },
            atmosphereRadius: params.atmosphereRadius,
            planetRadius: params.planetRadius,
            sunPosition: { x: params.sunX, y: params.sunY, z: params.sunZ }
        });

        planetEl.setAttribute('position', {
            x: params.centerX,
            y: params.centerY,
            z: params.centerZ
        });

        if (sunEl) {
            sunEl.setAttribute('position', {
                x: params.sunX,
                y: params.sunY,
                z: params.sunZ
            });
        }

        postProcessing.waveLenghts.set(params.wavelengthR, params.wavelengthG, params.wavelengthB);
        postProcessing.scatteringStrength = params.scatteringStrength;

        const scatterR = Math.pow(400 / params.wavelengthR, 4.0) * params.scatteringStrength;
        const scatterG = Math.pow(400 / params.wavelengthG, 4.0) * params.scatteringStrength;
        const scatterB = Math.pow(400 / params.wavelengthB, 4.0) * params.scatteringStrength;
        postProcessing.scatterCoefficients.set(scatterR, scatterG, scatterB);

        // update post-processing materials
        if (postProcessing.postProcessingMaterials) {
            postProcessing.postProcessingMaterials.forEach(({material, planet}) => {
                const data = planetEl.components['planet-atmosphere'].data;
                planet.position.set(data.center.x, data.center.y, data.center.z);
                planet.atmosphereRadius = data.atmosphereRadius;
                planet.planetRadius = data.planetRadius;
                planet.sunPosition.set(data.sunPosition.x, data.sunPosition.y, data.sunPosition.z);
                material.uniforms.uPlanetRadius.value = data.planetRadius;
                material.uniforms.uPlanetCenter.value.copy(planet.position);
                material.uniforms.upAtmosphereRadius.value = data.atmosphereRadius;
                material.uniforms.upDensityFalloff.value = params.densityFalloff;
                material.uniforms.uScatterCoefficients.value.copy(postProcessing.scatterCoefficients);
            });
        }
    },

    remove: function() {
        if (this.gui) {
            this.gui.destroy();
        }
    }
});
