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
	PCFSoftShadowMap,
	Vector2,
	Raycaster,
	ShaderLib,
	UniformsUtils,
	ShaderMaterial,
	Color,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let camera, controls, scene, renderer, offsetGroup;
let dirLight;
let raycaster, mouse;
let model;
let infoEl;

init();
animate();

// 调整Three.js standard shader来使batchid高亮（mixin混合）
function batchIdHighlightShaderMixin(shader) {
	// console.log("[shader]", shader);
	const newShader = { ...shader };
	newShader.uniforms = {
		highlightedBatchId: { value: -1 },
		highlightColor: { value: new Color(0x0000ff).convertSRGBToLinear() },
		// UniformsUtils: 提供用于管理uniforms的使用函数
		/**
		 * .clone ( src : Object ) : Object
		 * src: 这个对象代表uniform定义
		 * 作用:
		 * 1. 通过执行一个深度拷贝来克隆给定的uniform定义
		 * 2. 这意味着，如果uniform的值引用 Vector3 或纹理之类的对象，则克隆的uniform将引用新的对象引用。
		 */
		...UniformsUtils.clone(shader.uniforms),
	};
	newShader.extensions = {
		// 新增一个extensions对象
		derivatives: true,
	};
	newShader.lights = true;
	newShader.vertexShader =
		`
			attribute float _batchid;
			varying float batchid;
		` +
		newShader.vertexShader.replace(
			/#include <uv_vertex>/,
			`
			#include <uv_vertex>
			batchid = _batchid;
			`
		);
	newShader.fragmentShader =
		`
			varying float batchid;
			uniform float highlightedBatchId;
			uniform vec3 highlightColor;
		` +
		newShader.fragmentShader.replace(
			/vec4 diffuseColor = vec4\( diffuse, opacity \);/,
			`
			vec4 diffuseColor =
				abs( batchid - highlightedBatchId ) < 0.5 ?
				vec4( highlightColor, opacity ) :
				vec4( diffuse, opacity );
			`
		);

	/**
	 * 这里的关键就是_batchid
	 * 因为shader根据_batchid来判断是否高亮
	 */
	return newShader;
}

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
	new B3DMLoader().load("../data/b3dm/lr.b3dm").then((res) => {
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

		// 重新指定Material以使用batchid高亮显示变量.
		// 在实践中，这应复制原始Material中任何所需的uniforms
		model.traverse((c) => {
			// console.log("c", c);
			if (c.isMesh) {
				c.material = new ShaderMaterial(
					// three.js的WebGL着色器库（ShaderLib.standard）
					batchIdHighlightShaderMixin(ShaderLib.standard)
				);
			}
		});
	});
}

function onMouseMove(e) {
	// Element.getBoundingClientRect()方法返回一个DOMRect对象，其提供了元素的大小及其相对于视口的位置。
	const bounds = this.getBoundingClientRect();
	mouse.x = e.clientX - bounds.x;
	mouse.y = e.clientY - bounds.y;
	mouse.x = (mouse.x / bounds.width) * 2 - 1;
	mouse.y = -(mouse.y / bounds.height) * 2 + 1;

	// 使用一个mouse原点和方向来更新射线
	raycaster.setFromCamera(mouse, camera);

	// 获取batch表格数据
	const intersects = raycaster.intersectObject(scene, true);
	let hoveredBatchid = -1;
	if (intersects.length) {
		const { face, object } = intersects[0];
		// 返回指定名称为_batchid的attribute
		// 这个类用于存储与BufferGeometry相关联的 attribute（例如顶点位置向量，面片索引，法向量，颜色值，UV坐标以及任何自定义 attribute ）。
		// 利用 BufferAttribute，可以更高效的向GPU传递数据。
		const batchidAttr = object.geometry.getAttribute("_batchid");

		// console.log("[batchidAttr]", batchidAttr);
		if (batchidAttr) {
			// 遍历父对象以查找batch表格
			let batchTableObject = object;
			// console.log('[1]', JSON.stringify(batchTableObject));
			while (!batchTableObject.batchTable) {
				batchTableObject = batchTableObject.parent;
				// console.log("[2]", batchTableObject);
			}
			// 记录batch数据
			const batchTable = batchTableObject.batchTable;
			// console.log("[batchTable]", JSON.stringify(batchTable));
			hoveredBatchid = batchidAttr.getX(face.a);

			infoEl.innerText =
				`_batchid   : ${hoveredBatchid}\n` +
				`Latitude   : ${batchTable
					.getData("Latitude")
					[hoveredBatchid].toFixed(3)}\n` +
				`Longitude  : ${batchTable
					.getData("Longitude")
					[hoveredBatchid].toFixed(3)}\n` +
				`Height     : ${batchTable
					.getData("Height")
					[hoveredBatchid].toFixed(3)}\n`;
		}
	} else {
		infoEl.innerText = "";
	}

	if (model) {
		model.traverse((c) => {
			if (c.isMesh) {
				c.material.uniforms.highlightedBatchId.value = hoveredBatchid;
			}
		});
	}
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

	raycaster = new Raycaster();
	mouse = new Vector2();

	onWindowResize();
	window.addEventListener("resize", onWindowResize, false);
	// 鼠标事件
	renderer.domElement.addEventListener("mousemove", onMouseMove, false);
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
