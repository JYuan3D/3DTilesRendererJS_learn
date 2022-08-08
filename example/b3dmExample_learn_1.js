import { B3DMLoader } from "../src/index.js";
import {
	Scene,
	Group,
	DirectionalLight,
	AmbientLight,
	WebGLRenderer,
	PerspectiveCamera,
	Box3,
	sRGBEncoding,
	PCFSoftShadowMap
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let camera, controls, scene, renderer, offsetGroup;
let dirLight;
let model;
let infoEl;

const url = "../data/b3dm/lr.b3dm"
// const url = "../data/output/Batched/BatchedWithTransformRegion/batchedWithTransformRegion.b3dm";

init();
animate();

function setScene() {
	scene = new Scene();
}

function setCamera() {
	camera = new PerspectiveCamera(
		45,
		window.innerWidth / window.innerHeight,
		1,
		4000
	);
	camera.position.set(200, 200, 200);
}

function setRenderer() {
	renderer = new WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0x151c1f);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	renderer.outputEncoding = sRGBEncoding;

	document.body.appendChild(renderer.domElement);
}

function addControls() {
	controls = new OrbitControls(camera, renderer.domElement);
	controls.screenSpacePanning = false;
	controls.minDistance = 1;
	controls.maxDistance = 2000;
}

function addLight() {
	const ambLight = new AmbientLight(0xffffff, 0.05);
	scene.add(ambLight);

	dirLight = new DirectionalLight(0xffffff, 1.25);
	dirLight.position.set(1, 2, 3).multiplyScalar(40);
	dirLight.castShadow = true;
	dirLight.shadow.bias = -0.01;
	dirLight.shadow.mapSize.setScalar(2048);

	setShadow(dirLight);

	scene.add(dirLight);
}

function setShadow(dirLight) {
	const shadowCam = dirLight.shadow.camera;
	shadowCam.left = -200;
	shadowCam.bottom = -200;
	shadowCam.right = 200;
	shadowCam.top = 200;
	shadowCam.updateProjectionMatrix();
}

function addModel() {
	console.log("url", url)
	new B3DMLoader().load(url).then((res) => {
		console.log('[featureTable]', res.featureTable)
		console.log('[batchTable]', res.batchTable)
		model = res.scene;
		offsetGroup.add(model);

		// step1: 创建一个Box3轴对齐包围盒（AABB）
		const box = new Box3();
		// step2: 通过调用AABB的setFromObject方法，来计算和世界轴对齐的一个对象model的包围盒
		// 以便计算对象和子对象的世界坐标变换（该方法可能会导致一个比严格需要的更大的框）
		box.setFromObject(model);
		// step3: 返回包围盒的中心点Vector3（三维向量）
		// 并将中心点和传入的标量-1进行相乘
		box.getCenter(offsetGroup.position).multiplyScalar(-1);
	});
}

function init() {
	infoEl = document.getElementById("info");

	setScene();

	setCamera();

	setRenderer();

	addControls();

	addLight();

	offsetGroup = new Group();
	scene.add(offsetGroup);

	addModel();

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
