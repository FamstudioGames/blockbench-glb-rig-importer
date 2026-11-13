/* Verify public registration, lifecycle and option guards without an editor. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createExample} from '../scripts/generate-example.mjs';

const source = fs.readFileSync(new URL('../plugin/glb_rig_importer.js', import.meta.url), 'utf8');

function loadPlugin() {
    const state = {deleted: 0};
    const sandbox = {
        Plugin: {register(id, plugin) { state.id = id; state.plugin = plugin; }},
        window: {}, TextDecoder, Uint8Array, ArrayBuffer, DataView,
        Blockbench: {addDragHandler(id, options) { state.dragOptions = options; return {delete() { state.deleted++; }}; }},
        Action: function (id, options) { state.action = {id, ...options}; this.delete = () => { state.deleted++; }; },
        MenuBar: {addAction(action, location) { state.location = location; }},
        ArmatureBone: function () {},
    };
    vm.createContext(sandbox); vm.runInContext(source, sandbox);
    state.plugin.onload();
    return {state, sandbox, api: sandbox.window.GlbRigImporter};
}

test('Plugin exposes a standalone renderer API and removes its UI on unload', () => {
    const {state, sandbox, api} = loadPlugin();
    assert.equal(state.id, 'glb_rig_importer');
    assert.equal(state.plugin.variant, 'desktop');
    assert.equal(state.plugin.min_version, '5.0.0');
    assert.equal(state.location, 'file.import');
    assert.equal(state.action.name, 'Import GLB with Rig and Animations…');
    assert.equal(state.dragOptions.readtype, 'buffer');
    for (const name of ['importFile', 'decodeGLB', 'sampleTrack']) assert.equal(typeof api[name], 'function');
    state.plugin.onunload();
    assert.equal(state.deleted, 2);
    assert.equal(sandbox.window.GlbRigImporter, undefined);
});

test('Invalid scale and FPS fail before decoding or creating editor objects', async () => {
    const {api} = loadPlugin();
    for (const options of [{scale: 0}, {scale: -1}, {scale: Infinity}, {fps: 0}, {fps: 241}, {fps: NaN}]) {
        await assert.rejects(api.importFile({content: null}, options), /Scale must be positive/);
    }
});

test('In-memory synthetic fixture contains a weighted animated mesh', () => {
    const {api} = loadPlugin();
    const generated = createExample();
    const {json, accessor, binary} = api.decodeGLB(generated);
    assert.equal(json.nodes.length, 3); assert.equal(json.skins[0].joints.length, 2);
    const primitive = json.meshes[0].primitives[0];
    assert.equal(accessor(primitive.attributes.POSITION).length, 8);
    assert.equal(accessor(primitive.indices).length, 18);
    for (const weights of accessor(primitive.attributes.WEIGHTS_0)) assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-6);
    const middle = accessor(primitive.attributes.WEIGHTS_0)[2];
    assert.ok(middle[0] > 0 && middle[1] > 0);
    assert.equal(json.animations[0].name, 'Sway');
    assert.equal(accessor(json.animations[0].samplers[0].input).at(-1)[0], 2);
    for (const rotation of accessor(json.animations[0].samplers[0].output)) assert.ok(Math.abs(Math.hypot(...rotation) - 1) < 1e-6);
    const image = json.bufferViews[json.images[0].bufferView];
    assert.equal(binary[image.byteOffset], 137); assert.equal(binary[image.byteOffset + 1], 80);
});
