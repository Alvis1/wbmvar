// Load shader files and register water shader
Promise.all([
    fetch('res/shaders/water.frag').then(r => r.text()),
    fetch('res/shaders/water.vert').then(r => r.text())
]).then(([fragmentShader, vertexShader]) => {
    AFRAME.registerShader('water', {
        schema: {
            waterColor1: {type: 'color', default: '#0a4d68', is: 'uniform'},
            waterColor2: {type: 'color', default: '#1a7fa0', is: 'uniform'},
            waveSpeed: {type: 'number', default: 0.15, is: 'uniform'},
            waveScale: {type: 'number', default: 8.0, is: 'uniform'},
            noiseScale: {type: 'number', default: 0.01, is: 'uniform'},
            time: {type: 'time', is: 'uniform'}
        },
        
        vertexShader: vertexShader,
        fragmentShader: fragmentShader
    });
});
