/* Import GLB 2.0 into native Blockbench 5 meshes, armatures, weights and animations. */
(function () {
    'use strict';
    const ID = 'glb_rig_importer';
    let action, dragHandler;

    function decodeGLB(content) {
        const bytes = content instanceof ArrayBuffer ? new Uint8Array(content)
            : new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (bytes.length < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2)
            throw new Error('Expected a GLB 2.0 file.');
        if (view.getUint32(8, true) !== bytes.length) throw new Error('Invalid GLB length.');
        let json, binary;
        for (let offset = 12; offset < bytes.length;) {
            if (offset + 8 > bytes.length) throw new Error('Truncated GLB chunk.');
            const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
            offset += 8;
            if (offset + length > bytes.length) throw new Error('Truncated GLB chunk data.');
            if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(bytes.subarray(offset, offset + length)).trim());
            if (type === 0x004e4942) binary = bytes.subarray(offset, offset + length);
            offset += length;
        }
        if (!json || !binary) throw new Error('GLB must contain JSON and an embedded binary buffer.');
        if ((json.buffers || []).some((b, i) => i !== 0 || b.uri)) throw new Error('External buffers are not supported.');
        const supported = ['KHR_materials_specular', 'KHR_materials_unlit'];
        for (const ext of json.extensionsRequired || [])
            if (!supported.includes(ext)) throw new Error('Unsupported required extension: ' + ext);
        const cache = new Map();
        function accessor(index) {
            if (cache.has(index)) return cache.get(index);
            const a = json.accessors?.[index];
            if (!a) throw new Error('Invalid accessor: ' + index);
            const components = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16}[a.type];
            const types = {5120: ['getInt8', 1, 127], 5121: ['getUint8', 1, 255], 5122: ['getInt16', 2, 32767], 5123: ['getUint16', 2, 65535], 5125: ['getUint32', 4, 4294967295], 5126: ['getFloat32', 4, 1]};
            const type = types[a.componentType];
            if (!components || !type) throw new Error('Unsupported accessor layout.');
            const result = Array.from({length: a.count}, () => Array(components).fill(0));
            function read(bufferView, byteOffset, count, width, spec, normalized) {
                const b = json.bufferViews?.[bufferView];
                if (!b || b.buffer !== 0) throw new Error('Invalid buffer view.');
                const stride = b.byteStride || width * spec[1];
                const start = (b.byteOffset || 0) + (byteOffset || 0);
                const end = start + (count ? (count - 1) * stride + width * spec[1] : 0);
                if (end > binary.length || end > (b.byteOffset || 0) + b.byteLength) throw new Error('Accessor exceeds buffer bounds.');
                const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
                return Array.from({length: count}, (_, i) => Array.from({length: width}, (_, j) => {
                    const value = data[spec[0]](start + i * stride + j * spec[1], true);
                    return normalized ? Math.max(-1, value / spec[2]) : value;
                }));
            }
            if (a.bufferView !== undefined) {
                const values = read(a.bufferView, a.byteOffset, a.count, components, type, a.normalized);
                values.forEach((v, i) => result[i] = v);
            }
            if (a.sparse) {
                const s = a.sparse, indices = read(s.indices.bufferView, s.indices.byteOffset, s.count, 1, types[s.indices.componentType], false);
                const values = read(s.values.bufferView, s.values.byteOffset, s.count, components, type, a.normalized);
                indices.forEach(([i], k) => {
                    if (i >= a.count) throw new Error('Invalid sparse accessor index.');
                    result[i] = values[k];
                });
            }
            cache.set(index, result);
            return result;
        }
        return {json, binary, accessor};
    }

    function sampleTrack(track, time) {
        const {times, values, interpolation, rotation} = track;
        let lo = 0, hi = times.length - 1;
        while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (times[mid] <= time) lo = mid; else hi = mid; }
        const cubic = interpolation === 'CUBICSPLINE';
        const at = i => values[cubic ? i * 3 + 1 : i];
        if (time <= times[0]) return at(0).slice();
        if (time >= times.at(-1)) return at(times.length - 1).slice();
        if (interpolation === 'STEP') return at(lo).slice();
        const duration = times[hi] - times[lo], t = (time - times[lo]) / duration;
        let value;
        if (cubic) {
            const a = at(lo), b = at(hi), out = values[lo * 3 + 2], incoming = values[hi * 3];
            value = a.map((v, i) => (2*t**3-3*t*t+1)*v + (t**3-2*t*t+t)*duration*out[i] + (-2*t**3+3*t*t)*b[i] + (t**3-t*t)*duration*incoming[i]);
        } else if (rotation) {
            return new THREE.Quaternion().fromArray(at(lo)).slerp(new THREE.Quaternion().fromArray(at(hi)), t).toArray();
        } else value = at(lo).map((v, i) => v + (at(hi)[i] - v) * t);
        return rotation ? new THREE.Quaternion().fromArray(value).normalize().toArray() : value;
    }

    async function importFile(file, options = {}) {
        if (typeof ArmatureBone === 'undefined') throw new Error('Blockbench 5.0 or newer is required.');
        const scale = options.scale ?? 16, fps = options.fps ?? 120;
        if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(fps) || fps < 1 || fps > 240)
            throw new Error('Scale must be positive; FPS must be between 1 and 240.');
        const {json: g, binary, accessor} = decodeGLB(file.content);
        const nodes = g.nodes || [], parents = nodes.map(() => -1);
        nodes.forEach((n, i) => (n.children || []).forEach(child => {
            if (!nodes[child] || parents[child] !== -1) throw new Error('Invalid node hierarchy.');
            parents[child] = i;
        }));
        const trs = nodes.map(n => {
            const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
            if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(p, q, s);
            else { p.fromArray(n.translation || [0, 0, 0]); q.fromArray(n.rotation || [0, 0, 0, 1]).normalize(); s.fromArray(n.scale || [1, 1, 1]); }
            return {p, q, s};
        });
        function worldMatrices(local) {
            const result = [], visiting = new Set();
            function get(i) {
                if (result[i]) return result[i];
                if (visiting.has(i)) throw new Error('Cyclic node hierarchy.');
                visiting.add(i);
                result[i] = parents[i] < 0 ? local[i].clone() : get(parents[i]).clone().multiply(local[i]);
                visiting.delete(i); return result[i];
            }
            nodes.forEach((_, i) => get(i)); return result;
        }
        const restWorld = worldMatrices(trs.map(({p,q,s}) => new THREE.Matrix4().compose(p,q,s)));
        const sourceBind = restWorld.map(m => m.clone()), assigned = new Set();
        for (const skin of g.skins || []) {
            const inverse = skin.inverseBindMatrices === undefined ? skin.joints.map(() => new THREE.Matrix4().elements) : accessor(skin.inverseBindMatrices);
            if (inverse.length !== skin.joints.length) throw new Error('Invalid inverse bind matrix count.');
            skin.joints.forEach((node, i) => {
                if (!nodes[node]) throw new Error('Invalid skin joint.');
                const bind = new THREE.Matrix4().fromArray(inverse[i]).invert();
                if (assigned.has(node) && sourceBind[node].elements.some((v,k) => Math.abs(v-bind.elements[k]) > 1e-5))
                    throw new Error('Shared joints with different bind matrices are not supported.');
                assigned.add(node); sourceBind[node] = bind;
            });
        }
        const unit = new THREE.Matrix4().makeScale(scale,scale,scale), inverseUnit = unit.clone().invert();
        const nativeBind = sourceBind.map(m => {
            const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
            m.decompose(p,q,s); return new THREE.Matrix4().compose(p.multiplyScalar(scale),q,new THREE.Vector3(1,1,1));
        });
        const corrections = sourceBind.map((m,i) => m.clone().invert().multiply(inverseUnit).multiply(nativeBind[i]));
        const localBind = nativeBind.map((m,i) => parents[i] < 0 ? m.clone() : nativeBind[parents[i]].clone().invert().multiply(m));
        const clips = (g.animations || []).map(clip => ({name: clip.name, tracks: clip.channels.map(c => {
            if (c.target.path === 'weights') throw new Error('Morph target animation is not supported.');
            if (!nodes[c.target.node] || !['translation','rotation','scale'].includes(c.target.path)) throw new Error('Invalid animation target.');
            const s = clip.samplers[c.sampler], times = accessor(s.input).map(v=>v[0]), values = accessor(s.output);
            const interpolation = s.interpolation || 'LINEAR';
            if (!['LINEAR','STEP','CUBICSPLINE'].includes(interpolation) || !times.length || values.length !== times.length * (interpolation === 'CUBICSPLINE' ? 3 : 1)) throw new Error('Invalid animation sampler.');
            return {node:c.target.node,path:c.target.path,times,values,interpolation,rotation:c.target.path==='rotation'};
        })}));
        for (const mesh of g.meshes || []) for (const p of mesh.primitives) {
            if ((p.mode ?? 4) !== 4 || p.targets || p.extensions?.KHR_draco_mesh_compression) throw new Error('Only uncompressed triangle primitives without morph targets are supported.');
            if (p.attributes.JOINTS_1 !== undefined) throw new Error('More than four skin influences per vertex are not supported.');
            Object.values(p.attributes).forEach(accessor);
            if (p.indices !== undefined) accessor(p.indices);
        }
        // Validate the format before creating a separate project tab.
        newProject(Formats.free);
        const project = Project;
        project.name = (file.name || 'GLB').replace(/\.glb$/i, '');
        project.fps = fps;
        const elements = [], textures = [], animations = [];
        Undo.initEdit({outliner:true,elements,textures,animations});
        try {
            const armature = new Armature({name:'GLB_Rig'}).init();
            const bones = [], rests = [];
            function makeBone(i) {
                if (bones[i]) return bones[i];
                const parent = parents[i] < 0 ? armature : makeBone(parents[i]);
                const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
                localBind[i].decompose(p,q,s);
                const e = new THREE.Euler().setFromQuaternion(q,Format.euler_order);
                rests[i] = {p:p.toArray(),e:e.toArray().slice(0,3).map(Math.radToDeg)};
                const bone = new ArmatureBone({name:nodes[i].name || 'node_'+i,origin:rests[i].p,rotation:rests[i].e,length:1,width:0.4});
                bones[i] = bone; bone.addTo(parent).init(); bone.createUniqueName(); return bone;
            }
            nodes.forEach((_,i)=>makeBone(i));
            const imageTextures = [];
            for (let i=0;i<(g.images || []).length;i++) {
                const image = g.images[i], bv = g.bufferViews?.[image.bufferView];
                let source = image.uri;
                if (bv) {
                    const bytes = binary.subarray(bv.byteOffset || 0,(bv.byteOffset || 0)+bv.byteLength);
                    let text = ''; for (let k=0;k<bytes.length;k+=8192) text += String.fromCharCode(...bytes.subarray(k,k+8192));
                    source = 'data:'+(image.mimeType || 'image/png')+';base64,'+btoa(text);
                }
                if (!source?.startsWith('data:')) throw new Error('Only embedded images are supported.');
                const texture = new Texture({name:image.name || 'image_'+i});
                await new Promise((resolve,reject)=>{
                    const timer=setTimeout(()=>reject(new Error('Texture loading timed out.')),15000);
                    texture.load_callback=()=>{clearTimeout(timer);resolve();};
                    texture.fromDataURL(source).add(false); textures.push(texture);
                });
                imageTextures[i]=texture;
            }
            const materialTextures = (g.materials || []).map((material,i)=>{
                const info = material.pbrMetallicRoughness || {}, ti = info.baseColorTexture;
                let texture = ti ? imageTextures[g.textures?.[ti.index]?.source] : null;
                if (!texture) {
                    const rgba=info.baseColorFactor || [1,1,1,1], canvas=document.createElement('canvas'); canvas.width=canvas.height=16;
                    const ctx=canvas.getContext('2d');ctx.fillStyle=`rgba(${rgba.slice(0,3).map(v=>Math.round(v*255)).join(',')},${rgba[3]})`;ctx.fillRect(0,0,16,16);
                    texture=new Texture({name:material.name || 'material_'+i}).fromDataURL(canvas.toDataURL()).add(false);textures.push(texture);
                }
                texture.render_sides=material.doubleSided?'double':'front';return texture;
            });
            nodes.forEach((node,ni)=>{
                if (node.mesh === undefined) return;
                const skin=g.skins?.[node.skin];
                g.meshes[node.mesh].primitives.forEach((primitive,pi)=>{
                    const attributes=primitive.attributes, positions=accessor(attributes.POSITION);
                    const mesh=new Mesh({name:(node.name || 'mesh_'+ni)+'_'+pi,vertices:{},origin:[0,0,0],shading:'smooth'});
                    const keys=positions.map((v,i)=>{
                        const point=new THREE.Vector3().fromArray(v);
                        if (!skin) point.applyMatrix4(restWorld[ni]);
                        point.multiplyScalar(scale);
                        const key='v'+i;mesh.vertices[key]=point.toArray();return key;
                    });
                    const indices=primitive.indices===undefined?positions.map((_,i)=>i):accessor(primitive.indices).map(v=>v[0]);
                    const uv=attributes.TEXCOORD_0===undefined?null:accessor(attributes.TEXCOORD_0), texture=materialTextures[primitive.material];
                    const width=texture?.uv_width || 16,height=texture?.uv_height || 16;
                    if (indices.length%3) throw new Error('Incomplete triangle indices.');
                    for (let k=0;k<indices.length;k+=3) {
                        const vertices=indices.slice(k,k+3).map(i=>keys[i]);
                        if (vertices.some(v=>v===undefined)) throw new Error('Triangle index exceeds vertex count.');
                        const coords={};indices.slice(k,k+3).forEach(i=>coords[keys[i]]=uv?[uv[i][0]*width,uv[i][1]*height]:[0,0]);
                        mesh.addFaces(new MeshFace(mesh,{vertices,uv:coords,texture:texture?.uuid || null}));
                    }
                    mesh.addTo(armature).init();elements.push(mesh);
                    if (skin) {
                        if (attributes.JOINTS_0===undefined || attributes.WEIGHTS_0===undefined) throw new Error('Skinned mesh has no vertex weights.');
                        const joints=accessor(attributes.JOINTS_0),weights=accessor(attributes.WEIGHTS_0);
                        keys.forEach((key,i)=>{
                            const total=weights[i].reduce((a,b)=>a+b,0);
                            if (!(total>0)) throw new Error('Skinned vertex has no positive weights.');
                            joints[i].forEach((joint,k)=>{if (weights[i][k]>0) {
                                const bone=bones[skin.joints[joint]];if (!bone) throw new Error('Invalid vertex joint index.');
                                bone.setVertexWeight(mesh,key,bone.getVertexWeight(mesh,key)+weights[i][k]/total);
                            }});
                        });
                    } else {
                        // A normalized bone preserves the node transform for rigid meshes.
                        keys.forEach(key=>bones[ni].setVertexWeight(mesh,key,1));
                    }
                });
            });
            Canvas.updateAll();
            for (const clip of clips) {
                const duration=Math.max(...clip.tracks.map(t=>t.times.at(-1)),0);
                const animation=new Animation({name:clip.name || 'Animation',length:duration,loop:'loop',snapping:fps}).add(false);animations.push(animation);
                const times=new Set([0,duration]);
                for (let f=1;f<duration*fps;f++) times.add(f/fps);
                clip.tracks.forEach(t=>t.times.forEach(v=>times.add(v)));
                const values=nodes.map(()=>({position:[],rotation:[],scale:[]}));
                for (const time of [...times].sort((a,b)=>a-b)) {
                    const pose=trs.map(({p,q,s})=>({p:p.clone(),q:q.clone(),s:s.clone()}));
                    clip.tracks.forEach(track=>{
                        const key={translation:'p',rotation:'q',scale:'s'}[track.path];pose[track.node][key].fromArray(sampleTrack(track,time));
                    });
                    const source=worldMatrices(pose.map(({p,q,s})=>new THREE.Matrix4().compose(p,q,s)));
                    const target=source.map((m,i)=>unit.clone().multiply(m).multiply(corrections[i]));
                    nodes.forEach((_,i)=>{
                        const local=parents[i]<0?target[i]:target[parents[i]].clone().invert().multiply(target[i]);
                        const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();local.decompose(p,q,s);
                        const e=new THREE.Euler().setFromQuaternion(q,Format.euler_order).toArray().slice(0,3).map(Math.radToDeg);
                        const rotation=e.map((v,k)=>v-rests[i].e[k]);
                        const previous=values[i].rotation.at(-1)?.value;
                        if (previous) rotation.forEach((v,k)=>{rotation[k]=v+360*Math.round((previous[k]-v)/360);});
                        const channels={position:p.toArray().map((v,k)=>v-rests[i].p[k]),rotation,scale:s.toArray()};
                        Object.entries(channels).forEach(([channel,value])=>values[i][channel].push({time,value}));
                    });
                }
                values.forEach((channels,i)=>{
                    let animator;
                    Object.entries(channels).forEach(([channel,keys])=>{
                        const neutral=channel==='scale'?1:0;
                        if (keys.every(k=>k.value.every(v=>Math.abs(v-neutral)<1e-5))) return;
                        animator ||= animation.getBoneAnimator(bones[i]);
                        animator.quaternion_interpolation=false;
                        for (const {time,value} of keys) {
                            const keyframe=new Keyframe({channel,time,interpolation:'linear',data_points:[{x:value[0],y:value[1],z:value[2]}]},null,animator);
                            animator.pushKeyframe(keyframe);
                        }
                    });
                });
            }
            Undo.finishEdit('Import GLB rig and animations');
            Canvas.updateAll();armature.openUp();
            const preferred=animations.find(a=>a.name==='Idle') || animations[0];
            if (preferred) preferred.select();
            if (Preview.selected) Preview.selected.loadAnglePreset(DefaultCameraPresets[0]);
            return {project:project.name,meshes:elements.length,joints:assigned.size,bones:bones.length,textures:textures.length,scale,fps,animations:animations.map(a=>({name:a.name,length:a.length})),animation_sampling:'Native Euler keyframes sampled at source times and '+fps+' FPS'};
        } catch (error) {
            Undo.cancelEdit();throw error;
        }
    }

    Plugin.register(ID, {
        title:'GLB Rig Importer',author:'FamstudioGames',version:'1.0.0',
        description:'Import GLB models with native armatures, vertex weights, textures and editable skeletal animations.',
        repository:'https://github.com/FamstudioGames/blockbench-glb-rig-importer',
        tags:['Importer','Animation','Format: Generic Model'],
        variant:'desktop',min_version:'5.0.0',
        onload() {
            window.GlbRigImporter={importFile,decodeGLB,sampleTrack};
            dragHandler=Blockbench.addDragHandler(ID,{extensions:['glb'],readtype:'buffer'},files=>{if(files[0])showOptions(files[0]);});
            action=new Action('import_glb_rig',{name:'Import GLB with Rig and Animations…',icon:'accessibility',category:'file',click(){
                Blockbench.import({extensions:['glb'],type:'GLB',readtype:'buffer'},files=>{if(files[0])showOptions(files[0]);});
            }});
            MenuBar.addAction(action,'file.import');
        },
        onunload(){action?.delete();dragHandler?.delete();delete window.GlbRigImporter;}
    });
    function showOptions(file) {
        new Dialog({id:'glb_rig_options',title:'Import GLB Rig',form:{
            scale:{type:'number',label:'Coordinate scale',value:16,min:0.000001},
            fps:{type:'number',label:'Animation sampling FPS',value:120,min:1,max:240},
            info:{type:'info',text:'Creates a separate Generic Model tab. Animations are sampled into native editable keyframes; vertex weights are retained and normalized.'}
        },onConfirm(options){importFile(file,options).catch(error=>{console.error(error);Blockbench.showMessageBox({title:'GLB import failed',message:error.message,icon:'error'});});}}).show();
    }
})();
