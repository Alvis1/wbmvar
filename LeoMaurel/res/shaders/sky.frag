uniform vec3 skyColor;
uniform vec3 horizonColor;
uniform float starDensity;
uniform float starBrightness;
uniform float time;
uniform vec3 sunPosition;
uniform vec3 sunColor;
uniform float sunSize;
uniform float sunGlow;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vDirection;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float random3d(vec3 st) {
    return fract(sin(dot(st.xyz, vec3(12.9898, 78.233, 45.5432))) * 43758.5453123);
}

float stars(vec3 pos, float density) {
    // Use 3D position instead of 2D UVs for VR consistency
    vec3 scaledPos = pos * 500.0;
    vec3 gridPos = floor(scaledPos);
    float starRand = random3d(gridPos);
    
    if (starRand > 1.0 - density) {
        vec3 starPos = fract(scaledPos);
        vec3 center = vec3(0.5);
        float dist = length(starPos - center);
        float blinkSpeed = 0.003 + starRand * 0.0007;
        float phase = random3d(gridPos * 2.5) * 6.28318;
        float blink = 0.8 + 0.5 * sin(time * blinkSpeed + phase);
        return smoothstep(0.4, 0.0, dist) * blink;
    }
    
    return 0.0;
}

void main() {
    // Re-normalize after interpolation to fix edge artifacts in VR
    vec3 dir = normalize(vDirection);
    
    float gradient = dir.y * 0.5 + 0.5;
    vec3 skyGradient = mix(horizonColor, skyColor, gradient);
    float starLayer = stars(dir, starDensity);
    
    vec3 sunDir = normalize(sunPosition);
    float sunDot = max(dot(dir, sunDir), 0.0);
    
    float sunDisc = smoothstep(sunSize, sunSize - 0.001, 1.0 - sunDot);
    float sunHalo = pow(sunDot, 10.0) * sunGlow;
    
    vec3 sun = sunColor * (sunDisc + sunHalo);
    
    // Final color with sky, stars, and sun
    vec3 finalColor = skyGradient + vec3(starLayer * starBrightness) + sun;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
