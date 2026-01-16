precision highp float;

varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec3 uCameraPos;
uniform vec3 uLightDir;
uniform float uPlanetRadius;
uniform vec3 uPlanetCenter;
uniform float cameraNear;
uniform float cameraFar;
uniform mat4 cameraInverseProjection;
uniform mat4 cameraWorldMatrix;
uniform vec3 uScatterCoefficients;

// uniforms parameters "up"
uniform float upAtmosphereRadius;
uniform float upDensityFalloff;

// use constants for loop bounds (WebGL requirement)
const int MAX_OPTICAL_DEPTH_SAMPLES = 16;
const int MAX_IN_SCATTERING_POINTS = 16;

float linearizeDepth(float depth) {
    float z = depth * 2.0 - 1.0; // convert to ndc
    return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}

vec2 raySphereIntersect(vec3 sphereCenter, float sphereRadius, vec3 rayOrigin, vec3 rayDirection)
{
    vec3 offset = rayOrigin - sphereCenter;
    float a = dot(rayDirection, rayDirection);
    float b = 2.0 * dot(offset, rayDirection);
    float c = dot(offset, offset) - sphereRadius * sphereRadius;
    float discriminant = b * b - 4.0 * a * c;
    
    if (discriminant < 0.0) {
        return vec2(-1.0, 0.0);
    }
    
    float sqrtDiscriminant = sqrt(discriminant);
    float t0 = (-b - sqrtDiscriminant) / (2.0 * a);
    float t1 = (-b + sqrtDiscriminant) / (2.0 * a);
    
    if (t1 < 0.0) {
        return vec2(-1.0, 0.0);
    }
    
    if (t0 < 0.0) {
        return vec2(0.0, t1);
    }
    
    return vec2(t0, t1 - t0);
}

float densityAtPoint(vec3 point) {
    float heightAboveSurface = length(point - uPlanetCenter) - uPlanetRadius;
    float scaledHeight = heightAboveSurface / (upAtmosphereRadius - uPlanetRadius);
    float localDensity = exp(-scaledHeight * upDensityFalloff) * (1.0 - scaledHeight);
    return localDensity;
}

float opticalDepth(vec3 rayOrigin, vec3 rayDirection, float rayLength) {
    vec3 samplePoint = rayOrigin;
    float stepSize = rayLength / float(MAX_OPTICAL_DEPTH_SAMPLES - 1);
    float opticalDepth = 0.0;

    for (int i = 0; i < MAX_OPTICAL_DEPTH_SAMPLES; i++) {
        float localDensity = densityAtPoint(samplePoint);
        opticalDepth += localDensity * stepSize;
        samplePoint += rayDirection * stepSize;
    }
    return opticalDepth;
}

vec3 calculateLightInteraction(vec3 rayOrigin, vec3 rayDirection, float rayLength, vec3 finalColor) {
    vec3 inScatterPoint = rayOrigin;
    float stepSize = rayLength / float(MAX_IN_SCATTERING_POINTS - 1);
    vec3 inScatteredLight = vec3(0.0);
    float viewRayOpticalDepth = 0.0;

    for (int i = 0; i < MAX_IN_SCATTERING_POINTS; i++) {
        float sunRayLength = raySphereIntersect(uPlanetCenter, upAtmosphereRadius, inScatterPoint, uLightDir).y;
        float sunRayOpticalDepth = opticalDepth(inScatterPoint, uLightDir, sunRayLength);
        viewRayOpticalDepth = opticalDepth(inScatterPoint, -rayDirection, stepSize * float(i));
        vec3 transmitance = exp(-(sunRayOpticalDepth + viewRayOpticalDepth) * uScatterCoefficients);
        float localDensity = densityAtPoint(inScatterPoint);
        
        inScatteredLight += localDensity * transmitance * uScatterCoefficients * stepSize;
        inScatterPoint += rayDirection * stepSize;
    }
    float originalColorTransmitance = exp(-viewRayOpticalDepth);
    return finalColor * originalColorTransmitance + inScatteredLight;
}

void main()
{
    vec4 originalColor = texture2D(tDiffuse, vUv);
    
    // view ray from screen uv
    vec2 ndc = vUv * 2.0 - 1.0; // convert uv to clip space
    vec4 clipPos = vec4(ndc, -1.0, 1.0); // create clip space position (near plane)
    vec4 viewPos = cameraInverseProjection * clipPos; // transform to view space
    viewPos /= viewPos.w;
    vec3 viewVector = (cameraWorldMatrix * vec4(viewPos.xyz, 0.0)).xyz; // to world space
    
    vec3 rayOrigin = uCameraPos;
    vec3 rayDirection = normalize(viewVector);
    float screenDepthNonLinear = texture2D(tDepth, vUv).r;
    bool isBackground = screenDepthNonLinear >= 0.9999;
    
    float rayDistance = 0.0;
    if (!isBackground) {
        float linearDepth = linearizeDepth(screenDepthNonLinear);
        
        // reconstruct view space position for depth
        vec4 clipPosDepth = vec4(ndc, screenDepthNonLinear * 2.0 - 1.0, 1.0);
        vec4 viewPosDepth = cameraInverseProjection * clipPosDepth;
        viewPosDepth /= viewPosDepth.w;
        
        vec3 worldPos = (cameraWorldMatrix * vec4(viewPosDepth.xyz, 1.0)).xyz;
        rayDistance = length(worldPos - rayOrigin);
    }
    
    // atmosphere intersection
    vec2 atmosphereHit = raySphereIntersect(uPlanetCenter, upAtmosphereRadius, rayOrigin, rayDirection);
    float distanceToAtmosphere = atmosphereHit.x;
    float distanceThroughAtmosphere = atmosphereHit.y;
    
    vec3 finalColor = originalColor.rgb;
    
    if (distanceToAtmosphere >= 0.0 && distanceThroughAtmosphere > 0.0) {
        float dstThroughAtmosphere = distanceThroughAtmosphere;
        
        if (!isBackground) {
            if (rayDistance < distanceToAtmosphere) {
                dstThroughAtmosphere = 0.0;
            } else if (rayDistance < distanceToAtmosphere + distanceThroughAtmosphere) {
                dstThroughAtmosphere = rayDistance - distanceToAtmosphere;
            }
        }
        
        if (dstThroughAtmosphere > 0.0) {
            vec3 pointInAtmosphere = rayOrigin + rayDirection * distanceToAtmosphere;
            vec3 light = calculateLightInteraction(pointInAtmosphere, rayDirection, dstThroughAtmosphere, finalColor);
            finalColor = light;
        }
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
}
