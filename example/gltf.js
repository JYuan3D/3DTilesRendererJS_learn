import { GLTFExtensionLoader } from "../src/three/GLTFExtensionLoader.js";
import {
	Scene,
	DirectionalLight,
	AmbientLight,
	WebGLRenderer,
	PerspectiveCamera,
	sRGBEncoding,
	PCFSoftShadowMap,
	CameraHelper,
	PlaneGeometry,
	MeshStandardMaterial,
	Mesh,
	DoubleSide,
	TorusKnotGeometry,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LoadingManager } from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

let camera, controls, scene, renderer;
let dirLight;

init();
animate();

// 已学习

function init() {
	scene = new Scene();

	// primary camera view
	renderer = new WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0x151c1f);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	renderer.outputEncoding = sRGBEncoding;

	document.body.appendChild(renderer.domElement);

	camera = new PerspectiveCamera(
		60,
		window.innerWidth / window.innerHeight,
		1,
		4000
	);
	camera.position.set(0, 10, 20);

	// controls
	controls = new OrbitControls(camera, renderer.domElement);
	controls.screenSpacePanning = false;
	controls.minDistance = 1;
	controls.maxDistance = 2000;

	// lights
	dirLight = new DirectionalLight(0xffffff, 1.25);
	dirLight.position.set(1, 2, 3).multiplyScalar(40);
	dirLight.castShadow = true;
	dirLight.shadow.bias = -0.01;
	dirLight.shadow.mapSize.setScalar(2048);

	const shadowCam = dirLight.shadow.camera;
	shadowCam.left = -200;
	shadowCam.bottom = -200;
	shadowCam.right = 200;
	shadowCam.top = 200;
	shadowCam.updateProjectionMatrix();
	scene.add(dirLight);

	let shadowCamHelper = new CameraHelper(dirLight.shadow.camera);
	shadowCamHelper.name = `dirLight_helper`;
	scene.add(shadowCamHelper);

	const ambLight = new AmbientLight(0xffffff, 0.05);
	scene.add(ambLight);

	// 平面
	const geometry = new PlaneGeometry(100, 100);
	const material = new MeshStandardMaterial({
		color: 0xefe7b0,
		metalness: 0.0,
		roughness: 1.0,
		side: DoubleSide,
	});
	const ground = new Mesh(geometry, material);
	ground.position.set(0, -10, 0);
	ground.rotation.set(Math.PI / 2, 0, 0);
	ground.castShadow = false;
	ground.receiveShadow = true;
	scene.add(ground);

	// 参照物
	let torusKnotGGeometry = new TorusKnotGeometry(25, 8, 75, 20);
	let torusKnotMaterial = new MeshStandardMaterial({
		color: 0xff0000,
		metalness: 0.9,
		roughness: 0.1,
	});
	const torusKnot3D = new Mesh(torusKnotGGeometry, torusKnotMaterial);
	torusKnot3D.position.set(0, 0, 0);
	torusKnot3D.scale.set(0.05, 0.05, 0.05);
	torusKnot3D.castShadow = true;
	torusKnot3D.receiveShadow = true;
	scene.add(torusKnot3D);

	let insertPosition = 0;
	// 基本gltf测试文件
	const gltfModelTests = [
		"https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb",
		"https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Embedded/CesiumMilkTruck.gltf",
		"https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf",
	];

	for (const url of gltfModelTests) {
		const loader = new GLTFExtensionLoader();
		loader.workingPath = loader.workingPathForURL(url);
		loader.load(url).then((res) => {
			res.scene.position.set((insertPosition += 5), 0, 0);
			controls.target.set(insertPosition / 2, 0, 0);
			controls.update();
			res.scene.traverse((node) => {
				if (node.type === "Mesh") {
					// console.log("[node]", url, node);
					node.castShadow = true;
					node.receiveShadow = true;
				}
			});
			// console.log("default loader:", { gltf: res, url });
			scene.add(res.scene);
		});
	}

	// gltf扩展
	const delegatedLoaderTests = [
		"https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Draco/CesiumMilkTruck.gltf",
		"https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
	];

	const manager = new LoadingManager();
	const gltfLoader = new GLTFLoader(manager);
	const dracoLoader = new DRACOLoader(manager);
	dracoLoader.setDecoderPath(
		"https://unpkg.com/three@0.128.0/examples/js/libs/draco/gltf/"
	);
	gltfLoader.setDRACOLoader(dracoLoader);
	manager.addHandler(/\.gltf$/, gltfLoader);
	manager.addHandler(/\.glb$/, gltfLoader);

	for (const url of delegatedLoaderTests) {
		const loader = new GLTFExtensionLoader(manager);
		loader.workingPath = loader.workingPathForURL(url);
		loader.load(url).then((res) => {
			res.scene.position.set((insertPosition += 5), 0, 0);
			controls.target.set(insertPosition / 2, 0, 0);
			controls.update();
			// console.log("custom loader:", { gltf: res, url });
			res.scene.traverse((node) => {
				if (node.type === "Mesh") {
					// console.log("[node]", url, node);
					node.castShadow = true;
					node.receiveShadow = true;
				}
			});
			scene.add(res.scene);
		});
	}

	onWindowResize();
	window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.updateProjectionMatrix();
}

function animate() {
	requestAnimationFrame(animate);

	render();
}

function render() {
	renderer.render(scene, camera);
}
