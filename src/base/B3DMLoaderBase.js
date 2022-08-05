// B3DM File Format
// https://github.com/CesiumGS/3d-tiles/blob/master/specification/TileFormats/Batched3DModel/README.md

import { FeatureTable, BatchTable } from "../utilities/FeatureTable.js";
import { LoaderBase } from "./LoaderBase.js";
import { readMagicBytes } from "../utilities/readMagicBytes.js";

export class B3DMLoaderBase extends LoaderBase {
	parse(buffer) {
		// TODO: 这应该能够采用具有偏移量和长度的uint8array
		const dataView = new DataView(buffer);

		// 28-byte 文件头

		// 4 bytes(字节Byte和比特bit的换算关系是 1 Byte = 8 bit )
		// 瓦片类型为b3dm
		const magic = readMagicBytes(dataView);

		/**
		 * console.assert
		 * 如果断言为false，则将一个错误消息写入控制台。如果断言是true，没有任何反应。
		 */
		console.assert(magic === "b3dm");

		// 4 bytes
		// 瓦片的版本为1
		const version = dataView.getUint32(4, true);

		console.assert(version === 1);

		// 4 bytes
		// 瓦片文件的文件大小
		const byteLength = dataView.getUint32(8, true);

		console.assert(byteLength === buffer.byteLength);

		// 4 bytes
		// 要素表的JSON文本（二进制形式）长度
		const featureTableJSONByteLength = dataView.getUint32(12, true);

		// 4 bytes
		// 要素表的二进制数据长度
		const featureTableBinaryByteLength = dataView.getUint32(16, true);

		// 4 bytes
		// 批量表的JSON文本（二进制形式）长度
		const batchTableJSONByteLength = dataView.getUint32(20, true);

		// 4 bytes
		// 批量表的二进制数据长度
		const batchTableBinaryByteLength = dataView.getUint32(24, true);

		// Feature Table
		const featureTableStart = 28; // 文件头占28字符
		const featureTableBuffer = buffer.slice( // ArrayBuffer(92)
			featureTableStart,
			featureTableStart +
				featureTableJSONByteLength +
				featureTableBinaryByteLength
		);

		const featureTable = new FeatureTable(
			featureTableBuffer,
			0,
			featureTableJSONByteLength,
			featureTableBinaryByteLength
		);

		// Batch Table
		const batchTableStart =
			featureTableStart +
			featureTableJSONByteLength +
			featureTableBinaryByteLength;

		const batchTableBuffer = buffer.slice(
			batchTableStart,
			batchTableStart + batchTableJSONByteLength + batchTableBinaryByteLength
		);
		const batchTable = new BatchTable(
			batchTableBuffer,
			featureTable.getData("BATCH_LENGTH"),
			0,
			batchTableJSONByteLength,
			batchTableBinaryByteLength
		);

		const glbStart =
			batchTableStart + batchTableJSONByteLength + batchTableBinaryByteLength;
		const glbBytes = new Uint8Array(buffer, glbStart, byteLength - glbStart);

		return {
			version,
			featureTable,
			batchTable,
			glbBytes,
		};
	}
}
