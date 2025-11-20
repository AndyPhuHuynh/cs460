import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AnaglyphEffect } from 'three/addons/effects/AnaglyphEffect.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';

// GLOBAL VARIABLES

const loader = new GLTFLoader();

let scene;
let poly;
let matpat;
let matpatVertexHelper;
let sceneSettings = {
    anaglyph: false,
    isPolyRotating: false,
    isMatpatRotating: false,
    blenderOldMaterial: null
}
let lights = {
    ambient: null,
    directional: null
};
let camera;
let controls;
let renderer;
let anaglyph;
let pane;

const rotations = {};
rotations.x_180 = new THREE.Quaternion(
    0,
    Math.sin(Math.PI / 2) * 0.5,
    0,
    Math.cos(Math.PI / 2) * 0.5
);
rotations.reset = new THREE.Quaternion(0, 0, 0, 1);
Object.freeze(rotations)


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
    lights.ambient = new THREE.AmbientLight();
    scene.add(lights.ambient);

    lights.directional = new THREE.DirectionalLight(0xffffff, 5);
    lights.directional.position.set(10, 100, 10);
    scene.add(lights.directional);
}

const loadModel = (path) => {
    return new Promise((resolve, reject) => {
        loader.load(path, (gltf) => {
            resolve(gltf, undefined, reject);
        });
    });
}

const changeMatpatMaterial = (newMaterial) => {
    if (sceneSettings.blenderOldMaterial === null) {
        sceneSettings.blenderOldMaterial = matpat.material.clone();
        matpat.material = new THREE.MeshNormalMaterial();
    } else {
        matpat.material = sceneSettings.blenderOldMaterial;
        sceneSettings.blenderOldMaterial = null;
    }
}

const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    if (sceneSettings.anaglyph) {
        anaglyph.render(scene, camera)
    } else {
        renderer.render(scene, camera);
    }

    if (poly) {
        if (sceneSettings.isPolyRotating) {
            poly.quaternion.slerp(rotations.x_180, 0.01);
        } else {
            poly.quaternion.slerp(rotations.reset, 0.01);
        }
    }

    if (matpat) {
        if (sceneSettings.isMatpatRotating) {
            matpat.quaternion.slerp(rotations.x_180, 0.01);
        } else {
            matpat.quaternion.slerp(rotations.reset, 0.01);
        }
        if (matpatVertexHelper) {
            matpatVertexHelper.update();
        }
    }
}

window.onload = async () => {
    scene = new THREE.Scene();
    setupCamera();
    setupLights();

    // PolyCam Mesh
    try {
        const polyGltf = await loadModel("./models/poly.glb");
        poly = polyGltf.scenes[0].children[0];
        poly.position.set(3, -2, 0);
        poly.scale.set(20, 20, 20);
        poly.quaternion.set(0, 0, 0, 1);
        scene.add(poly);
    } catch (error) {
        alert(`Error loading PolyCam model: ${error}`);
    }

    // Matpat Mesh
    try {
        const matpatGltf = await loadModel("./models/matpat.glb");
        matpat = matpatGltf.scenes[0].children[0];
        matpat.position.set(-3, -2, 0);
        matpat.scale.set(20, 20, 20);
        matpat.quaternion.set(0, 0, 0, 1);
        scene.add(matpat);

        matpatVertexHelper = new VertexNormalsHelper(matpat, 0.1, "blue");
        matpatVertexHelper.visible = false;
        scene.add(matpatVertexHelper);
    } catch (error) {
        alert(`Error loading Blender model: ${error}`);
    }

    pane = new Pane();
    let sceneui = pane.addFolder({ title: "Scene" });
    sceneui.addBinding(sceneSettings, "anaglyph");
    sceneui.addBinding(lights.directional.position, "x", { min: -100, max: 100, step: 1,   label: "Light X" });
    sceneui.addBinding(lights.directional.position, "y", { min: -100, max: 100, step: 1,   label: "Light Y" });
    sceneui.addBinding(lights.directional.position, "z", { min: -100, max: 100, step: 1,   label: "Light Z" });
    sceneui.addBinding(lights.directional, "intensity",  { min: 0,    max: 10,  step: 0.1, label: "Light Intensity" });
    sceneui.addBinding(lights.ambient, "color", { label: "Ambient Color" });

    if (poly) {
        let polyui = pane.addFolder({ title: "PolyCam Mesh" });
        polyui.addBinding(poly.material, "wireframe");
        polyui.addButton({title: "Toggle Rotation"}).on("click", () => {
            sceneSettings.isPolyRotating = !sceneSettings.isPolyRotating;
        });
    }

    if (matpat) {
        let matpatui = pane.addFolder({ title: "Blender Mesh" });
        matpatui.addBinding(matpatVertexHelper, "visible", { label: "Show Vertex Normals" });
        matpatui.addButton({title: "Toggle Material"}).on("click", () => {
            changeMatpatMaterial();
        });
        matpatui.addButton({title: "Toggle Rotation"}).on("click", () => {
            sceneSettings.isMatpatRotating = !sceneSettings.isMatpatRotating;
        });
    }

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement)
    anaglyph = new AnaglyphEffect(renderer);

    controls = new OrbitControls(camera, renderer.domElement);
    animate()
}