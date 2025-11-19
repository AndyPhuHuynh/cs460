import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AnaglyphEffect } from 'three/addons/effects/AnaglyphEffect.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';

// GLOBAL VARIABLES

let scene;
let poly;
let matpat;
let sceneSettings = {
    anaglyph: false,
    isPolyRotating: false,
    doRotate: function() {
        this.isPolyRotating = !this.isPolyRotating;
    }
}
let camera;
let controls;
let renderer;
let anaglyph;
let pane;

// ---------------------------------

const setupCamera = () => {
    const fov = 75;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 1;
    const far = 10000;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(-5, 5, 5);
    camera.lookAt(0, 0, 0);
}

const setupLights = () => { 
    const ambientLight = new THREE.AmbientLight();
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
    directionalLight.position.set(10, 100, 10);
    scene.add(directionalLight);
}

const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    if (sceneSettings.anaglyph) {
        anaglyph.render(scene, camera)
    } else {
        renderer.render(scene, camera);
    }

    if (sceneSettings.poly) {
        if (sceneSettings.isPolyRotating) {
            sceneSettings.poly.quaternion.slerp
        }
    }
}

window.onload = () => {
    scene = new THREE.Scene();
    setupCamera();

    const loader = new GLTFLoader();
    // Poly
    loader.load("./models/poly.glb", (gltf) => {
        poly = gltf.scene;
        poly.position.set(3, -2, 0);
        poly.scale.set(20, 20, 20);
        poly.quaternion.set(0, 0, 0, 1);
        scene.add(poly);
    });
    // Matpat
    loader.load("./models/matpat.glb", (gltf) => {
        matpat = gltf.scene;
        matpat.position.set(-3, -0.5, 0);
        matpat.scale.set(2, 2, 2);
        matpat.quaternion.set(0, 0, 0, 1);
        scene.add(matpat);
    });

    pane = new Pane();
    let sceneui = pane.addFolder({ title: "Scene" });
    sceneui.addBinding(sceneSettings, "anaglyph");
    // sceneui.addBinding(matpat.material, "wireframe")
    sceneui.addButton({title: "Toggle Rotation"}).on("click", () => {sceneSettings.doRotate();});

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement)
    anaglyph = new AnaglyphEffect(renderer);

    controls = new OrbitControls(camera, renderer.domElement);
    setupLights();
    animate()
}