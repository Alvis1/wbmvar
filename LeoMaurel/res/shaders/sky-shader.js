// Load shader files and register shader
Promise.all([
    fetch('res/shaders/sky.vert').then(r => r.text()),
    fetch('res/shaders/sky.frag').then(r => r.text())
]).then(([vertexShader, fragmentShader]) => {
    AFRAME.registerShader('sky', {
        schema: {
            starDensity: {type: 'number', default: 0.002, is: 'uniform'},
            starBrightness: {type: 'number', default: 1.0, is: 'uniform'},
            skyColor: {type: 'color', default: '#000428', is: 'uniform'},
            horizonColor: {type: 'color', default: '#000e1a', is: 'uniform'},
            sunPosition: {type: 'vec3', default: {x: 100, y: 50, z: -50}, is: 'uniform'},
            sunColor: {type: 'color', default: '#ffdd88', is: 'uniform'},
            sunSize: {type: 'number', default: 0.015, is: 'uniform'},
            sunGlow: {type: 'number', default: 0.3, is: 'uniform'},
            time: {type: 'time', is: 'uniform'}
        },
        
        vertexShader: vertexShader,
        fragmentShader: fragmentShader
    });
});
