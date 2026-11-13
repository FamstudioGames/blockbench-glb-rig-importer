/* Generate an original, deterministic, self-contained skinned GLB fixture. */
import fs from 'node:fs';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

export function createExample() {
    const binaryParts = [], bufferViews = [], accessors = [];
    let offset = 0;
    function append(data) {
        const padding = (4 - offset % 4) % 4;
        if (padding) { binaryParts.push(Buffer.alloc(padding)); offset += padding; }
        const index = bufferViews.length;
        bufferViews.push({buffer: 0, byteOffset: offset, byteLength: data.length});
        binaryParts.push(data); offset += data.length;
        return index;
    }
    function attribute(values, type, componentType = 5126, extra = {}) {
        const width = {5126: 4, 5123: 2, 5121: 1}[componentType];
        const data = Buffer.alloc(values.flat().length * width);
        values.flat().forEach((value, i) => {
            if (componentType === 5126) data.writeFloatLE(value, i * width);
            else if (componentType === 5123) data.writeUInt16LE(value, i * width);
            else data.writeUInt8(value, i);
        });
        const index = accessors.length;
        accessors.push({bufferView: append(data), componentType, type, count: values.length, ...extra});
        return index;
    }
    const positions = [], uvs = [], joints = [], weights = [];
    for (const y of [0, 0.75, 1.25, 2]) {
        const tipWeight = y <= 0 ? 0 : y >= 2 ? 1 : (y - 0.25) / 1.5;
        for (const x of [-0.35, 0.35]) {
            positions.push([x, y, 0]); uvs.push([x < 0 ? 0 : 1, y / 2]);
            joints.push([0, 1, 0, 0]); weights.push([1 - tipWeight, tipWeight, 0, 0]);
        }
    }
    const indices = [];
    for (let row = 0; row < 3; row++) {
        const i = row * 2;
        indices.push([i], [i + 1], [i + 2], [i + 1], [i + 3], [i + 2]);
    }
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const inverseTip = [...identity]; inverseTip[13] = -1;
    const attributes = {
        POSITION: attribute(positions, 'VEC3', 5126, {min: [-0.35, 0, 0], max: [0.35, 2, 0]}),
        TEXCOORD_0: attribute(uvs, 'VEC2'),
        JOINTS_0: attribute(joints, 'VEC4', 5121),
        WEIGHTS_0: attribute(weights, 'VEC4'),
    };
    const indexAccessor = attribute(indices, 'SCALAR', 5123);
    const inverseBindMatrices = attribute([identity, inverseTip], 'MAT4');
    const timeAccessor = attribute([[0], [0.5], [1], [1.5], [2]], 'SCALAR', 5126, {min: [0], max: [2]});
    const rotations = [0, -0.55, 0, 0.55, 0].map(angle => [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)]);
    const rotationAccessor = attribute(rotations, 'VEC4');
    const imageView = append(createTexture());
    const binary = Buffer.concat(binaryParts);
    const gltf = {
        asset: {version: '2.0', generator: 'GLB Rig Importer original weighted-ribbon fixture', copyright: '2026 FamstudioGames, MIT'},
        scene: 0, scenes: [{nodes: [0, 2]}],
        nodes: [{name: 'Root', children: [1]}, {name: 'Tip', translation: [0, 1, 0]}, {name: 'Ribbon', mesh: 0, skin: 0}],
        meshes: [{name: 'WeightedRibbon', primitives: [{attributes, indices: indexAccessor, material: 0}]}],
        skins: [{name: 'RibbonRig', joints: [0, 1], skeleton: 0, inverseBindMatrices}],
        materials: [{name: 'MintAndAmber', doubleSided: true, pbrMetallicRoughness: {baseColorTexture: {index: 0}, metallicFactor: 0, roughnessFactor: 1}}],
        images: [{name: 'OriginalChecker', bufferView: imageView, mimeType: 'image/png'}],
        textures: [{source: 0}],
        animations: [{name: 'Sway', samplers: [{input: timeAccessor, output: rotationAccessor, interpolation: 'LINEAR'}], channels: [{sampler: 0, target: {node: 1, path: 'rotation'}}]}],
        buffers: [{byteLength: binary.length}], bufferViews, accessors,
    };
    let json = Buffer.from(JSON.stringify(gltf));
    json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
    const paddedBinary = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
    const output = Buffer.alloc(12 + 8 + json.length + 8 + paddedBinary.length);
    output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
    output.writeUInt32LE(json.length, 12); output.writeUInt32LE(0x4e4f534a, 16); json.copy(output, 20);
    output.writeUInt32LE(paddedBinary.length, 20 + json.length); output.writeUInt32LE(0x004e4942, 24 + json.length); paddedBinary.copy(output, 28 + json.length);
    return output;
}

function createTexture() {
    function crc32(bytes) {
        let crc = 0xffffffff;
        for (const byte of bytes) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }
    function chunk(type, data) {
        const name = Buffer.from(type), output = Buffer.alloc(data.length + 12);
        output.writeUInt32BE(data.length); name.copy(output, 4); data.copy(output, 8);
        output.writeUInt32BE(crc32(Buffer.concat([name, data])), output.length - 4);
        return output;
    }
    const header = Buffer.alloc(13); header.writeUInt32BE(2, 0); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6;
    const mint = [88, 214, 188, 255], amber = [245, 181, 107, 255];
    const pixels = Buffer.from([0, ...mint, ...amber, 0, ...amber, ...mint]);
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels, {level: 0})), chunk('IEND', Buffer.alloc(0))]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const target = new URL('../examples/weighted-ribbon.glb', import.meta.url);
    fs.writeFileSync(target, createExample());
    console.log('Generated examples/weighted-ribbon.glb.');
}
