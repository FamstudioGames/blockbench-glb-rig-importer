/* Regression tests for GLB decoding and source animation interpolation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../plugin/glb_rig_importer.js',import.meta.url),'utf8');
const sandbox={Plugin:{register(){}},TextDecoder,Uint8Array,ArrayBuffer,DataView};
vm.createContext(sandbox);
vm.runInContext(source.replace('Plugin.register(ID, {','globalThis.helpers={decodeGLB,sampleTrack};Plugin.register(ID, {'),sandbox);
const {decodeGLB,sampleTrack}=sandbox.helpers;

function glb(json,binary=Buffer.alloc(4)) {
    let text=Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{byteLength:binary.length}],...json}));
    text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);
    binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
    const out=Buffer.alloc(12+8+text.length+8+binary.length);
    out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
    out.writeUInt32LE(text.length,12);out.writeUInt32LE(0x4e4f534a,16);text.copy(out,20);
    out.writeUInt32LE(binary.length,20+text.length);out.writeUInt32LE(0x004e4942,24+text.length);binary.copy(out,28+text.length);
    return out;
}

test('GLB rejects corrupt headers, truncated chunks and external buffers',()=>{
    assert.throws(()=>decodeGLB(Buffer.alloc(4)),/GLB 2.0/);
    const valid=glb({});const broken=Buffer.from(valid);broken.writeUInt32LE(99,4);
    assert.throws(()=>decodeGLB(broken),/GLB 2.0/);
    assert.throws(()=>decodeGLB(valid.subarray(0,valid.length-1)),/length/);
    const badChunk=Buffer.from(valid);badChunk.writeUInt32LE(valid.length*2,12);
    assert.throws(()=>decodeGLB(badChunk),/Truncated/);
    assert.throws(()=>decodeGLB(glb({buffers:[{uri:'external.bin'}]})),/External buffers/);
    assert.throws(()=>decodeGLB(glb({extensionsRequired:['KHR_draco_mesh_compression']})),/Unsupported required/);
});

test('GLB reads interleaved accessors with offsets and normalized weights',()=>{
    const binary=Buffer.alloc(32);
    [1,2,3].forEach((v,i)=>binary.writeFloatLE(v,4+i*4));
    [4,5,6].forEach((v,i)=>binary.writeFloatLE(v,20+i*4));
    const {accessor}=decodeGLB(glb({bufferViews:[{buffer:0,byteLength:32,byteStride:16}],accessors:[{bufferView:0,byteOffset:4,componentType:5126,type:'VEC3',count:2}]},binary));
    assert.equal(JSON.stringify(accessor(0)),'[[1,2,3],[4,5,6]]');
    const weights=decodeGLB(glb({bufferViews:[{buffer:0,byteLength:4}],accessors:[{bufferView:0,componentType:5121,type:'VEC4',count:1,normalized:true}]},Buffer.from([255,0,127,0]))).accessor(0)[0];
    assert.equal(weights[0],1);assert.equal(weights[2],127/255);
});

test('GLB applies sparse values and checks accessor bounds',()=>{
    const binary=Buffer.alloc(16);binary[0]=1;[7,8,9].forEach((v,i)=>binary.writeFloatLE(v,4+i*4));
    const g={bufferViews:[{buffer:0,byteLength:1},{buffer:0,byteOffset:4,byteLength:12}],accessors:[{componentType:5126,type:'VEC3',count:3,sparse:{count:1,indices:{bufferView:0,componentType:5121},values:{bufferView:1}}}]};
    assert.equal(JSON.stringify(decodeGLB(glb(g,binary)).accessor(0)),'[[0,0,0],[7,8,9],[0,0,0]]');
    g.accessors=[{bufferView:1,componentType:5126,type:'VEC3',count:2}];
    assert.throws(()=>decodeGLB(glb(g,binary)).accessor(0),/bounds/);
});

test('Animation sampling handles boundaries, STEP, LINEAR and cubic tangents',()=>{
    const track={times:[0,2],values:[[0,2,4],[4,6,8]],interpolation:'LINEAR'};
    assert.equal(JSON.stringify(sampleTrack(track,1)),'[2,4,6]');
    assert.equal(JSON.stringify(sampleTrack(track,-1)),'[0,2,4]');
    assert.equal(JSON.stringify(sampleTrack(track,4)),'[4,6,8]');
    assert.equal(JSON.stringify(sampleTrack({...track,interpolation:'STEP'},1)),'[0,2,4]');
    const cubic={times:[0,2],values:[[0],[0],[1],[0],[2],[0]],interpolation:'CUBICSPLINE'};
    assert.equal(sampleTrack(cubic,1)[0],1.25);
});
