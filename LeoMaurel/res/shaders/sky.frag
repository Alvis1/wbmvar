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

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float stars(vec2 uv, float density) {
    vec2 gridUv = floor(uv * 1000.0);
    float starRand = random(gridUv);
    
    if (starRand > 1.0 - density) {
        vec2 starPos = fract(uv * 1000.0);
        vec2 center = vec2(0.5);
        float dist = length(starPos - center);
        float blinkSpeed = 0.003 + starRand * 0.0007;
        float phase = random(gridUv * 2.5) * 6.28318;
        float blink = 0.8 + 0.5 * sin(time * blinkSpeed + phase);
        return smoothstep(0.4, 0.0, dist) * blink;
    }
    
    return 0.0;
}

void main() {
    float gradient = vPosition.y / 500.0 + 0.5;
    vec3 skyGradient = mix(horizonColor, skyColor, gradient);
    float starLayer = stars(vUv, starDensity);
    
    vec3 sunDir = normalize(sunPosition);
    vec3 viewDir = normalize(vPosition);
    float sunDot = max(dot(viewDir, sunDir), 0.0);
    
    float sunDisc = smoothstep(sunSize, sunSize - 0.001, 1.0 - sunDot);
    float sunHalo = pow(sunDot, 10.0) * sunGlow;
    
    vec3 sun = sunColor * (sunDisc + sunHalo);
    
    // Final color with sky, stars, and sun
    vec3 finalColor = skyGradient + vec3(starLayer * starBrightness) + sun;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
