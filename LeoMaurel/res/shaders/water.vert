varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vObjectPosition;

void main() {
    vUv = uv;
    vNormal = normal;
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vObjectPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}