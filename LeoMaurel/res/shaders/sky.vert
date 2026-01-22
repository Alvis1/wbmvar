varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vDirection;

void main() {
    vUv = uv;
    vPosition = position;
    // Direction in model space - consistent for both eyes in VR
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
