# GLB Rig Importer v1.0.0

Bring a GLB character into Blockbench with its native skeleton, blended vertex weights, embedded textures and editable skeletal animations. Save the result as a portable BBMODEL and keep working with Blockbench's own tools.

## Download and install

1. Download **[`glb_rig_importer.js`](https://github.com/FamstudioGames/blockbench-glb-rig-importer/releases/download/v1.0.0/glb_rig_importer.js)** from the release assets below. No source-code archive or build step is needed.
2. In **Blockbench desktop**, open **File → Plugins → Load Plugin from File** and select the downloaded file.
3. Choose **File → Import → Import GLB with Rig and Animations…**, or drag a `.glb` into the editor.

Requires **Blockbench desktop 5.0+** with native armature APIs. The original character workflow was validated on **5.2.2**. No extra runtime dependencies, MCP server or Blender setup is required.

## Included assets

| Asset | Purpose |
| --- | --- |
| `glb_rig_importer.js` | The complete, directly loadable plugin. |
| `LICENSE.txt` | The MIT license and copyright notice. |
| `SHA256SUMS.txt` | SHA-256 checksums for the plugin and license downloads. |

GitHub's automatic source archives are also available for developers. No GLB or character model files are included in this release.

## Highlights

- Native Blockbench armatures, bones and weighted meshes.
- Embedded textures, primary UVs and base-color support.
- Source animation sampled into editable position, Euler rotation and scale keys.
- Configurable sampling, defaulting to 120 FPS plus source key times.
- A documented renderer API for scripts and AI-assisted workflows.
- Standalone regression tests and Windows/Linux CI.

## Known limits

Use self-contained, uncompressed binary glTF 2.0 files. Text `.gltf`, external resources, Draco/Meshopt compression, morph targets and more than four joint influences per vertex are unsupported. Full PBR rendering fidelity is not provided.

Animation conversion is sampled, not lossless. Imported clips default to looping; source STEP discontinuities become short linear transitions. Verify intermediate poses and a BBMODEL save/reopen cycle for your own assets.

See the [README](https://github.com/FamstudioGames/blockbench-glb-rig-importer#readme), [compatibility table](https://github.com/FamstudioGames/blockbench-glb-rig-importer#compatibility), [automation guide](https://github.com/FamstudioGames/blockbench-glb-rig-importer/blob/main/docs/AUTOMATION.md) and [recorded validation](https://github.com/FamstudioGames/blockbench-glb-rig-importer/blob/main/docs/VALIDATION.md).

## Contact and support

[Reddit](https://www.reddit.com/user/famstudios/submitted/) · [Telegram](https://t.me/+RzFhrTe9XYAxZjhi) · [Email](mailto:famstudiogames@gmail.com) · [Support my tools on itch.io](https://famstudiogames.itch.io/advanced-flowchart-editor-for-construct-3/donate)

MIT licensed. While the repository is private, only accounts with repository access can download the assets. Publishing this release does not change repository visibility.
