AFRAME.registerComponent('speed-lines', {
    schema: {
        count: { type: 'number', default: 200 },
        speedThreshold: { type: 'number', default: 2.0 }, // min speed to show lines
        maxDistance: { type: 'number', default: 50 },
        lineLength: { type: 'number', default: 2 },
        warpLineLength: { type: 'number', default: 8 },
        warpStartColor: { type: 'color', default: '#ff0000' },
        warpEndColor: { type: 'color', default: '#fecb00' },
        warpingLinesSpeed: { type: 'number', default: 0.2 },
        color: { type: 'color', default: '#ffffff' },
        opacity: { type: 'number', default: 0.6 }
    },

    init: function() {
        const data = this.data;
        
        this.spaceship = document.querySelector('[spaceship-controls]');
        
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];
        
        for (let i = 0; i < data.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * data.maxDistance * 0.5;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const z = -Math.random() * data.maxDistance;
            
            positions.push(x, y, z);
            velocities.push(Math.random() * 0.5 + 0.5);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        this.velocities = velocities;
        this.lineProgress = new Array(data.count).fill(0);
        
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        
        const linePositions = [];
        const lineColors = [];
        const baseColor = new THREE.Color(data.color);
        
        for (let i = 0; i < data.count; i++) {
            linePositions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            lineColors.push(baseColor.r, baseColor.g, baseColor.b);
            
            linePositions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2] - data.lineLength);
            lineColors.push(baseColor.r, baseColor.g, baseColor.b);
        }
        
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
        
        this.lines = new THREE.LineSegments(lineGeometry, material);
        this.el.setObject3D('speed-lines', this.lines);
        
        this.material = material;
        this.lineGeometry = lineGeometry;
        this.baseColor = baseColor;
        this.warpStartColor = new THREE.Color(data.warpStartColor);
        this.warpEndColor = new THREE.Color(data.warpEndColor);
        this.currentLineLength = data.lineLength;
        this.isWarping = false;
    },

    tick: function(time, timeDelta) {
        if (!this.spaceship || !this.spaceship.components['spaceship-controls']) return;
        
        const data = this.data;
        const deltaSeconds = timeDelta / 1000;
        const spaceshipComponent = this.spaceship.components['spaceship-controls'];
        
        const velocity = spaceshipComponent.velocity;
        const speed = velocity.length();
        const isWarping = spaceshipComponent.isWarping;
        
        if (isWarping !== this.isWarping) {
            this.isWarping = isWarping;
            this.currentLineLength = isWarping ? data.warpLineLength : data.lineLength;
        }
        
        let targetOpacity = 0;
        if (speed > data.speedThreshold) {
            targetOpacity = Math.min((speed - data.speedThreshold) / 3, 1) * data.opacity;
        }
        
        this.material.opacity += (targetOpacity - this.material.opacity) * 0.1;
        
        const positions = this.lineGeometry.attributes.position.array;
        const colors = this.lineGeometry.attributes.color.array;
        
        for (let i = 0; i < data.count; i++) {
            const idx = i * 6;
            const colorIdx = i * 6;
            
            let z = positions[idx + 2];
            
            const speedMultiplier = isWarping ? data.warpingLinesSpeed : 1.0;
            const moveSpeed = (speed * 30 + 10) * this.velocities[i] * deltaSeconds * speedMultiplier;
            z += moveSpeed;
            
            const totalDistance = data.maxDistance + 5;
            this.lineProgress[i] = Math.min((z + data.maxDistance) / totalDistance, 1);
            
            if (z > 5) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * data.maxDistance * 0.5;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                positions[idx] = x;
                positions[idx + 1] = y;
                positions[idx + 2] = -data.maxDistance;
                
                positions[idx + 3] = x;
                positions[idx + 4] = y;
                positions[idx + 5] = -data.maxDistance - this.currentLineLength;
                
                this.lineProgress[i] = 0;
            } else {
                positions[idx + 2] = z;
                positions[idx + 5] = z - this.currentLineLength;
            }
            
            if (isWarping) {
                const t = this.lineProgress[i];
                const lineColor = new THREE.Color();
                lineColor.lerpColors(this.warpStartColor, this.warpEndColor, t);
                
                colors[colorIdx] = lineColor.r;
                colors[colorIdx + 1] = lineColor.g;
                colors[colorIdx + 2] = lineColor.b;
                
                colors[colorIdx + 3] = lineColor.r;
                colors[colorIdx + 4] = lineColor.g;
                colors[colorIdx + 5] = lineColor.b;
            } else {
                colors[colorIdx] = this.baseColor.r;
                colors[colorIdx + 1] = this.baseColor.g;
                colors[colorIdx + 2] = this.baseColor.b;
                
                colors[colorIdx + 3] = this.baseColor.r;
                colors[colorIdx + 4] = this.baseColor.g;
                colors[colorIdx + 5] = this.baseColor.b;
            }
        }
        
        this.lineGeometry.attributes.position.needsUpdate = true;
        this.lineGeometry.attributes.color.needsUpdate = true;
    },

    remove: function() {
        this.el.removeObject3D('speed-lines');
    }
});
