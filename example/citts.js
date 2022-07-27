import * as THREE from "three";
import { DebugTilesRenderer as TilesRenderer } from "../src/index.js";
import { FlyOrbitControls } from "./FlyOrbitControls.js";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";

// 已学习

const groundUrl =
	"https://raw.githubusercontent.com/NASA-AMMOS/3DTilesSampleData/master/msl-dingo-gap/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_colorize_tileset.json";

const skyUrl =
	"https://raw.githubusercontent.com/NASA-AMMOS/3DTilesSampleData/master/msl-dingo-gap/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_sky/0528_0260184_to_s64o256_sky_tileset.json";

let camera, controls, scene, renderer;
let groundTiles, skyTiles;

const params = {
	errorTarget: 12,
	displayBoxBounds: false,
	fog: false,
};

init();
render();

function init() {
	const fog = new THREE.FogExp2(0xd8cec0, 0.0075, 250);
	scene = new THREE.Scene();

	// primary camera view
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0xd8cec0);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.outputEncoding = THREE.sRGBEncoding;

	document.body.appendChild(renderer.domElement);
	renderer.domElement.tabIndex = 1;

	camera = new THREE.PerspectiveCamera(
		60,
		window.innerWidth / window.innerHeight,
		1,
		4000
	);
	camera.position.set(0, 100, 200);

	// controls
	controls = new FlyOrbitControls(camera, renderer.domElement);
	controls.screenSpacePanning = false;
	controls.minDistance = 1;
	controls.maxDistance = 2000;
	// controls.maxPolarAngle = Math.PI / 2;
	controls.baseSpeed = 0.1;
	controls.fastSpeed = 0.2;

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

	const ambLight = new THREE.AmbientLight(0xffffff, 1);
	// scene.add(ambLight);

	// 参照物
	let torusKnotGGeometry = new THREE.TorusKnotGeometry(25, 8, 75, 20);
	let torusKnotMaterial = new THREE.MeshStandardMaterial({
		color: 0xff0000,
		metalness: 0.9,
		roughness: 0.1,
	});
	const torusKnot3D = new THREE.Mesh(torusKnotGGeometry, torusKnotMaterial);
	torusKnot3D.position.set(0, 10, 0);
	torusKnot3D.scale.set(0.05, 0.05, 0.05);
	torusKnot3D.castShadow = true;
	torusKnot3D.receiveShadow = true;
	scene.add(torusKnot3D);

	// 平面
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

	const tilesParent = new THREE.Group();
	tilesParent.rotation.set(Math.PI / 2, 0, 0);
	scene.add(tilesParent);

	groundTiles = new TilesRenderer(groundUrl);
	groundTiles.fetchOptions.mode = "cors";
	groundTiles.lruCache.minSize = 900;
	groundTiles.lruCache.maxSize = 1300;
	groundTiles.errorTarget = 12;
	groundTiles.onLoadModel = (scene) => {
		scene.traverse((c) => {
			if (c.isMesh) {
				var prevMaterial = c.material;
				c.material = new THREE.MeshStandardMaterial();
				THREE.MeshBasicMaterial.prototype.copy.call(c.material, prevMaterial);
				// 请注意，上述操作反过来出来反而不行，因为copy在更简单的材质中（如MeshBasicMaterial）上调用复杂材质的方法将导致它查找不到不存在的属性
				// c.material.side = THREE.DoubleSide
				c.castShadow = true;
				c.receiveShadow = true;
			}
		});
	};

	skyTiles = new TilesRenderer(skyUrl);
	skyTiles.fetchOptions.mode = "cors";
	skyTiles.lruCache.minSize = 900;
	skyTiles.lruCache.maxSize = 1300;

	tilesParent.add(groundTiles.group, skyTiles.group);

	onWindowResize();
	window.addEventListener("resize", onWindowResize, false);

	const gui = new GUI();
	gui.add(params, "fog").onChange((v) => {
		scene.fog = v ? fog : null;
	});

	gui.add(params, "displayBoxBounds");
	gui.add(params, "errorTarget", 0, 100);
	gui.open();
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

	groundTiles.errorTarget = params.errorTarget;
	groundTiles.displayBoxBounds = params.displayBoxBounds;
	skyTiles.displayBoxBounds = params.displayBoxBounds;

	groundTiles.setCamera(camera);
	groundTiles.setResolutionFromRenderer(camera, renderer);
	groundTiles.update();

	skyTiles.setCamera(camera);
	skyTiles.setResolutionFromRenderer(camera, renderer);
	skyTiles.update();

	renderer.render(scene, camera);
}
