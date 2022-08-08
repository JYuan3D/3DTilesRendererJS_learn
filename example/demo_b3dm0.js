import * as THREE from "three";
import { DebugTilesRenderer as TilesRenderer } from "../src/index.js";
import { FlyOrbitControls } from "./FlyOrbitControls.js";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";

// const groundUrl = "../data/output/Batched/BatchedWithTransformBox/tileset.json";
// const groundUrl = "../data/output/Batched/BatchedWithTransformSphere/tileset.json";
const groundUrl = "../data/output/Batched/BatchedWithTransformRegion/tileset.json";

console.log("[groundUrl]", groundUrl);

let camera, controls, scene, renderer;
let tilesParent;
let targetTiles;

const params = {
	errorTarget: 12,
	displayBoxBounds: false,
	fog: false,
};

init();
render();

function setScene() {
	scene = new THREE.Scene();
}

function setCamera() {
	camera = new THREE.PerspectiveCamera(
		60,
		window.innerWidth / window.innerHeight,
		1,
		4000
	);
	camera.position.set(0, 100, 200);
}

function setRenderer() {
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0xd8cec0);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.outputEncoding = THREE.sRGBEncoding;

	document.body.appendChild(renderer.domElement);
	renderer.domElement.tabIndex = 1;
}

function setControls() {
	// controls
	controls = new FlyOrbitControls(camera, renderer.domElement);
	controls.screenSpacePanning = false;
	controls.minDistance = 1;
	controls.maxDistance = 2000;
	controls.maxPolarAngle = Math.PI / 2;
	controls.baseSpeed = 0.1;
	controls.fastSpeed = 0.2;
}

function addLight() {
	// lights
	const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
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

	let shadowCamHelper = new THREE.CameraHelper(dirLight.shadow.camera);
	shadowCamHelper.name = `dirLight_helper`;
	scene.add(shadowCamHelper);

	const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
	scene.add(ambLight);
}

function addRefPlane() {
	const geometry = new THREE.PlaneGeometry(30, 30);
	const material = new THREE.MeshStandardMaterial({
		color: 0xefe7b0,
		metalness: 0.0,
		roughness: 1.0,
		side: THREE.DoubleSide,
	});
	const ground = new THREE.Mesh(geometry, material);
	ground.position.set(0, 5, 0);
	ground.rotation.set(Math.PI / 2, 0, 0);
	ground.castShadow = true;
	ground.receiveShadow = true;
	scene.add(ground);
}

function addTilesParent() {
	tilesParent = new THREE.Group();
	tilesParent.rotation.set(0, 0, 0);
	scene.add(tilesParent);
}

function rotationBetweenDirections(dir1, dir2) {
	const rotation = new THREE.Quaternion();
	const a = new THREE.Vector3().crossVectors(dir1, dir2);
	rotation.x = a.x;
	rotation.y = a.y;
	rotation.z = a.z;
	rotation.w = 1 + dir1.clone().dot(dir2);
	rotation.normalize();

	return rotation;
}

function addTargetTiles() {
	targetTiles = new TilesRenderer(groundUrl);
	targetTiles.fetchOptions.mode = "cors";
	targetTiles.lruCache.minSize = 900;
	targetTiles.lruCache.maxSize = 1300;
	targetTiles.errorTarget = 12;
	targetTiles.onLoadModel = (scene) => {
		scene.traverse((c) => {
			if (c.isMesh) {
				console.log("[c.isMesh]", c);
				// var prevMaterial = c.material;
				// c.material = new THREE.MeshStandardMaterial();
				// THREE.MeshBasicMaterial.prototype.copy.call(c.material, prevMaterial);
				// 请注意，上述操作反过来出来反而不行，因为copy在更简单的材质中（如MeshBasicMaterial）上调用复杂材质的方法将导致它查找不到不存在的属性
				// c.material.side = THREE.DoubleSide
				c.castShadow = true;
				c.receiveShadow = true;
			}
		});
	};
	targetTiles.onLoadTileSet = () => {
		console.log("输出", targetTiles);
		const box = new THREE.Box3();
		const sphere = new THREE.Sphere();
		const matrix = new THREE.Matrix4();

		let position;
		let distanceToEllipsoidCenter;

		if (targetTiles.getOrientedBounds(box, matrix)) {
			position = new THREE.Vector3().setFromMatrixPosition(matrix);
			distanceToEllipsoidCenter = position.length();
		} else if (targetTiles.getBoundingSphere(sphere)) {
			position = sphere.center.clone();
			distanceToEllipsoidCenter = position.length();
		}

		const surfaceDirection = position.normalize();
		const up = new THREE.Vector3(0, 1, 0);
		const rotationToNorthPole = rotationBetweenDirections(surfaceDirection, up);

		targetTiles.group.quaternion.x = rotationToNorthPole.x;
		targetTiles.group.quaternion.y = rotationToNorthPole.y;
		targetTiles.group.quaternion.z = rotationToNorthPole.z;
		targetTiles.group.quaternion.w = rotationToNorthPole.w;

		targetTiles.group.position.y = -distanceToEllipsoidCenter;
	};

	tilesParent.add(targetTiles.group);
}

function setGui() {
	const gui = new GUI();
	gui.add(params, "fog").onChange((v) => {
		scene.fog = v ? fog : null;
	});

	gui.add(params, "displayBoxBounds");
	gui.add(params, "errorTarget", 0, 100);
	gui.open();
}

function init() {
	const fog = new THREE.FogExp2(0xd8cec0, 0.0075, 250);
	setScene();
	setCamera();
	setRenderer();

	setControls();

	addLight();

	addRefPlane();

	addTilesParent();

	addTargetTiles();

	setGui();

	onWindowResize();
	window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
}

function render() {
	requestAnimationFrame(render);

	camera.updateMatrixWorld();

	targetTiles.errorTarget = params.errorTarget;
	targetTiles.displayBoxBounds = params.displayBoxBounds;

	targetTiles.setCamera(camera);
	targetTiles.setResolutionFromRenderer(camera, renderer);
	targetTiles.update();

	renderer.render(scene, camera);
}
