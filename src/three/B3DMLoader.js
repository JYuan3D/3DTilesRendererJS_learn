import { B3DMLoaderBase } from "../base/B3DMLoaderBase.js";
import { DefaultLoadingManager, Matrix4 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// LoadingManager是一个全局实例, 当其他加载器没有指定加载管理器时，它将被其他大多数的加载器设为默认的加载管理器。
export class B3DMLoader extends B3DMLoaderBase {
	constructor(manager = DefaultLoadingManager) {
		super();
		this.manager = manager;
		this.adjustmentTransform = new Matrix4();
	}

	parse(buffer) {
		const b3dm = super.parse(buffer); // 9704 = 640 + 92 + 8944 + 28
		const gltfBuffer = b3dm.glbBytes.slice().buffer;
		return new Promise((resolve, reject) => {
			const manager = this.manager;
			const fetchOptions = this.fetchOptions;
			// 可用于检索给定文件路径的注册加载程序
			const loader = manager.getHandler("path.gltf") || new GLTFLoader(manager);

			// 设置loader加载设置
			if (
				fetchOptions.credentials === "include" &&
				fetchOptions.mode === "cors"
			) {
				// crossOrigin字符串用于实现CORS，以从允许CORS的其它域加载url
				loader.setCrossOrigin("use-credentials");
			}

			if ("credentials" in fetchOptions) {
				loader.setWithCredentials(fetchOptions.credentials === "include");
			}

			if (fetchOptions.headers) {
				// 设置在HTTP请求中使用的request header（请求头）
				loader.setRequestHeader(fetchOptions.headers);
			}

			// GLTFLoader 假设工作路径以斜线结尾
			let workingPath = this.workingPath;
			if (!/[\\/]$/.test(workingPath) && workingPath.length) {
				workingPath += "/";
			}

			const adjustmentTransform = this.adjustmentTransform; // 调整变换

			loader.parse( // 该方法需要被所有具体的加载器来实现。它包含了解析资产到 three.js 实体的逻辑。
				gltfBuffer,
				workingPath,
				(model) => {
					const { batchTable, featureTable } = b3dm;
					const { scene } = model;

					const rtcCenter = featureTable.getData("RTC_CENTER");
					if (rtcCenter) {
						scene.position.x += rtcCenter[0];
						scene.position.y += rtcCenter[1];
						scene.position.z += rtcCenter[2];
					}

					model.scene.updateMatrix();
					model.scene.matrix.multiply(adjustmentTransform);
					model.scene.matrix.decompose(
						model.scene.position,
						model.scene.quaternion,
						model.scene.scale
					);

					model.batchTable = batchTable;
					model.featureTable = featureTable;

					scene.batchTable = batchTable;
					scene.featureTable = featureTable;

					resolve(model);
				},
				reject
			);
		});
	}
}
