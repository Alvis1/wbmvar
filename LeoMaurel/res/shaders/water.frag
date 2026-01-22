varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vObjectPosition;

uniform float time;
uniform vec3 waterColor1;
uniform vec3 waterColor2;
uniform float waveSpeed;
uniform float waveScale;
uniform float noiseScale;

float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    float a = hash(i);
    float b = hash(i + vec3(1.0, 0.0, 0.0));
    float c = hash(i + vec3(0.0, 1.0, 0.0));
    float d = hash(i + vec3(1.0, 1.0, 0.0));
    float e = hash(i + vec3(0.0, 0.0, 1.0));
    float f1 = hash(i + vec3(1.0, 0.0, 1.0));
    float g = hash(i + vec3(0.0, 1.0, 1.0));
    float h = hash(i + vec3(1.0, 1.0, 1.0));
    
    return mix(
        mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
        mix(mix(e, f1, f.x), mix(g, h, f.x), f.y),
        f.z
    );
}

void main() {
    vec3 spherePos = normalize(vObjectPosition);
    vec3 pos = spherePos * waveScale * noiseScale;
    float t = time * waveSpeed;
    
    float n = 0.0;
    n += noise3D(pos * 1.0 + vec3(t * 0.3, t * 0.2, 0.0)) * 0.4;
    n += noise3D(pos * 1.1 - vec3(t * 0.35, t * 0.25, t * 0.1)) * 0.3;
    n += noise3D(pos * 1.2 + vec3(t * 0.25, -t * 0.3, t * 0.15)) * 0.2;
    n += noise3D(pos * 1.3 - vec3(t * 0.2, t * 0.4, -t * 0.2)) * 0.1;
    
    vec3 waterColor = mix(waterColor1, waterColor2, n);
    
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 2.0);
    waterColor += vec3(0.1, 0.2, 0.3) * fresnel;
    
    float foam = smoothstep(0.6, 0.8, n);
    waterColor += vec3(0.3, 0.4, 0.5) * foam;
    
    gl_FragColor = vec4(waterColor, 1.0);
}
