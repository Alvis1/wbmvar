AFRAME.registerComponent('planet-markers', {
    schema: {
        markerDistance: { type: 'number', default: 10000 }, // distance from camera
        markerSize: { type: 'number', default: 600 },
        minDistanceToShow: { type: 'number', default: 50000 }, // display from this distance
    },

    init: function() {
        this.planets = [
            { position: new THREE.Vector3(0, 1.6, -3), name: 'Green Planet', size: 1000 }, // size reference
            { position: new THREE.Vector3(-4508, 753, -1315), name: 'Lunar Planet', size: 700 },
            { position: new THREE.Vector3(100000, 20, 100000), name: 'Ice Planet', size: 1100 },
            { position: new THREE.Vector3(100000, 700, -200000), name: 'Water Planet', size: 1000 },
            { position: new THREE.Vector3(-200000, 12000, -150000), name: 'Gas Giant', size: 1400 }
        ];

        this.markers = [];
        this.camera = null;

        this.planets.forEach((planet, index) => {
            const marker = document.createElement('a-entity');
            marker.setAttribute('visible', false);
            
            const scaledSize = this.data.markerSize * (planet.size / 1000);
            
            const imageEl = document.createElement('a-image');
            imageEl.setAttribute('src', '#star-image');
            imageEl.setAttribute('width', scaledSize);
            imageEl.setAttribute('height', scaledSize);
            imageEl.setAttribute('position', '0 0 0.01');
            imageEl.setAttribute('material', 'shader: flat; transparent: true; opacity: 1');
            
            marker.appendChild(imageEl);
            this.el.sceneEl.appendChild(marker);
            
            this.markers.push({
                entity: marker,
                imageElement: imageEl,
                planet: planet
            });
        });
    },

    tick: function() {
        if (!this.camera) {
            this.camera = this.el.sceneEl.camera;
            if (!this.camera) return;
        }

        const cameraPos = new THREE.Vector3();
        this.camera.getWorldPosition(cameraPos);

        // update each
        this.markers.forEach(marker => {
            const planetPos = marker.planet.position;
            const distance = cameraPos.distanceTo(planetPos);

            if (distance > this.data.minDistanceToShow) {
                marker.entity.setAttribute('visible', true);

                const direction = new THREE.Vector3()
                    .subVectors(planetPos, cameraPos)
                    .normalize();

                const depthOffset = Math.min(distance / 100000, 1) * 1000;
                const adjustedDistance = this.data.markerDistance + depthOffset;
                
                const markerPos = new THREE.Vector3()
                    .copy(cameraPos)
                    .add(direction.multiplyScalar(adjustedDistance));

                marker.entity.object3D.position.copy(markerPos);
                marker.entity.object3D.lookAt(cameraPos);

                const minDist = this.data.minDistanceToShow;
                const maxDist = this.data.minDistanceToShow * 2;
                const opacity = THREE.MathUtils.clamp(
                    (distance - minDist) / (maxDist - minDist),
                    0.0,
                    0.8
                );
                
                if (marker.imageElement && marker.imageElement.components.material) {
                    marker.imageElement.setAttribute('material', 'opacity', opacity);
                }
            } else {
                marker.entity.setAttribute('visible', false);
            }
        });
    }
});
