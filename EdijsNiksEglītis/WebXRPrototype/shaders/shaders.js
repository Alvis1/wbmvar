AFRAME.registerShader('katona-shader', {
    schema: {
        time: { type: 'time', is: 'uniform' }
    },
    vertexShader: `
        precision mediump float;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vCameraRelativePosition;
        uniform float time;
        
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            
            // Calculate camera-relative position (view space)
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vCameraRelativePosition = viewPosition.xyz;
            
            // Minimal vertex displacement for performance
            float t = time * 0.001;
            float wave = sin(viewPosition.x * 2.0 + t) * 0.02;
            vec3 pos = position + normal * wave;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        precision mediump float;
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vCameraRelativePosition;

        // Optimized hash function for VR
        float hash(float n) {
            return fract(sin(n) * 1753.5453);
        }

        void main() {
            float t = time * 0.0008; // Much slower animation
            
            // Use camera-relative position for projection
            // This creates a "screen space" effect that follows the camera
            vec2 cameraUV = vCameraRelativePosition.xy * 0.5; // Scale for appropriate pattern size
            
            // Optimized flowing deformation - reduced complexity
            float flow1 = sin(cameraUV.y * 5.0 + t) * 0.15;
            float flow2 = sin(cameraUV.x * 4.0 - t * 0.8) * 0.12;
            
            // Apply deformation to camera-relative coordinates
            cameraUV.x += flow1;
            cameraUV.y += flow2;
            
            // Pre-calculated constants for VR optimization
            const float stripeAngle = 0.785398; // 45 degrees
            const float cosAngle = 0.7071068;
            const float sinAngle = 0.7071068;
            
            // Optimized stripe pattern calculation using camera-relative position
            float rotatedCoord = cameraUV.x * cosAngle - cameraUV.y * sinAngle;
            
            // Simplified flowing movement
            rotatedCoord += sin(cameraUV.y * 3.0 + t) * 0.08;
            rotatedCoord += t * 0.15;
            
            // Generate stripe pattern - VR optimized
            float stripe = sin(rotatedCoord * 12.0);
            
            // Simplified secondary deformation using camera coordinates
            float deform = sin(cameraUV.x * 8.0 + t * 0.6) * sin(cameraUV.y * 7.0 - t * 0.4) * 0.25;
            stripe += deform;
            
            // Create gradient stripes
            float pattern = stripe * 0.5 + 0.5;
            
            // Reduced noise calculation for VR using camera position
            float noiseCoord = floor(cameraUV.x * 20.0) + floor(cameraUV.y * 20.0) * 20.0 + floor(t * 5.0);
            float noise = hash(noiseCoord) * 0.03;
            pattern += noise;
            
            // Pre-calculated gradient values using camera-relative position
            float gradientX = cameraUV.x * 0.1; // Scale down for reasonable gradient
            float gradientY = cameraUV.y * 0.1;
            float combinedGradient = (gradientX + gradientY) * 0.5;
            
            // Simplified pattern processing
            pattern = clamp(pattern, 0.0, 1.0);
            pattern = mix(pattern, combinedGradient, 0.2); // Reduced gradient influence
            
            // Final color with simplified lighting
            vec3 color = vec3(pattern);
            
            // Simplified edge highlighting
            float edge = dot(vNormal, vec3(0.0, 0.0, 1.0)) * 0.1;
            color += edge * pattern;
            
            gl_FragColor = vec4(color, 1.0);
        }
    `
});