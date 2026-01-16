// Component to mark planets with atmosphere parameters
AFRAME.registerComponent('planet-atmosphere', {
    schema: {
        center: {type: 'vec3', default: {x: 0, y: 0, z: 0}},
        atmosphereRadius: {type: 'number', default: 26},
        planetRadius: {type: 'number', default: 20},
        sunPosition: {type: 'vec3', default: {x: -230, y: 139, z: -115}}
    }
});
