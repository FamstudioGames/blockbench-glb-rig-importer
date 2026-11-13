# Automation and AI agents

## Execution environment

Run importer calls inside the **Blockbench desktop renderer**, after loading `plugin/glb_rig_importer.js`. The plugin uses Blockbench's native modeling APIs and its bundled `THREE` objects. It cannot import models in ordinary Node.js, a browser tab or an MCP server process by itself.

An automation bridge may execute the code below in the renderer. This repository does not bundle a bridge or require any specific AI product.

## Public API

```ts
window.GlbRigImporter.importFile(
    file: { name?: string; content: ArrayBuffer | Uint8Array },
    options?: { scale?: number; fps?: number }
): Promise<ImportResult>
```

`file` should normally come from `Blockbench.read(paths, {readtype: 'buffer'}, callback)`. Node.js Buffers are also accepted when available in the renderer, since they are Uint8Array views.

| Option | Default | Constraint |
| --- | --- | --- |
| `scale` | `16` | Finite number greater than zero; multiplies source coordinates. |
| `fps` | `120` | Finite number from `1` through `240`; sets additional sampling frequency. |

The returned object contains `project`, `meshes`, `joints`, `bones`, `textures`, `scale`, `fps`, `animations` and `animation_sampling`. `animations` is an array of `{name, length}` objects. `joints` counts distinct source skin joints; `bones` also includes source transform nodes. `project` is the new project's name, not a project object or a saved file path.

## Example

```js
const absoluteGlbPath = '/absolute/path/to/weighted-ribbon.glb';
Blockbench.read([absoluteGlbPath], {readtype: 'buffer'}, async files => {
    try {
        if (!files[0]) throw new Error('No GLB file was read.');
        if (!window.GlbRigImporter) throw new Error('GLB Rig Importer is not loaded.');
        const result = await window.GlbRigImporter.importFile(files[0], {
            scale: 16,
            fps: 120,
        });
        console.log('GLB import complete.', result);
    } catch (error) {
        console.error('GLB import failed.', error);
    }
});
```

On Windows, forward slashes work in paths such as `C:/assets/character.glb`. Replace the example path with a path that exists on the machine running Blockbench.

## Side effects and failure behavior

- Creates and activates a separate **Generic Model** project tab. Native project-switch/save prompts may still require user interaction.
- Adds an armature, native bones, meshes, textures and animations. Selects `Idle` if present, otherwise the first clip.
- Does not save a BBMODEL or export a GLB automatically. Use Blockbench's native save operation after reviewing the result.
- Validates several format constraints before creating the project. Texture or later import failures may occur after tab creation; the undo edit is canceled, but the empty tab may remain.
- Rejects its promise with an English `Error` for unsupported or malformed inputs. The interactive menu catches the error and shows a dialog; API callers must catch rejections themselves.
- Uses linear Euler keys after source sampling. Preserve the source file and compare deformation before relying on the result in production.

## Decoder helpers

`window.GlbRigImporter.decodeGLB(content)` returns `{json, binary, accessor}`. `accessor(index)` returns arrays of numeric components and supports interleaved, normalized and sparse data for the supported layouts.

`window.GlbRigImporter.sampleTrack(track, time)` samples a source track with `times`, `values`, `interpolation` and optional `rotation`. These low-level helpers assume valid track data; use `importFile` for normal imports.

The helpers do not create editor objects. They are exposed to support validation, diagnostics and integrations. They are not a separate packaged Node.js library.

## Recommended agent workflow

1. Check that Blockbench desktop is reachable and the plugin API exists.
2. Save current work and confirm the source is a self-contained, uncompressed GLB.
3. Call `importFile` in the renderer and inspect returned counts and clip names.
4. Inspect rest pose, weights and at least several intermediate animation poses.
5. Save through Blockbench, reopen the BBMODEL and repeat the inspection.
6. Report unsupported features and measured deviations explicitly.
