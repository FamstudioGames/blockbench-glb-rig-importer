# Validation and accuracy

## Recorded character workflow

The original local development workflow imported an animated GLB character into **Blockbench 5.2.2**, saved it as BBMODEL, reopened it and compared the result against the source GLB.

| Measurement | Recorded result |
| --- | --- |
| Mesh vertices | 1,143 |
| Triangles | 1,372 |
| Source skin joints | 41 |
| Native bones, including transform nodes | 43 |
| Animation clips | 5 |
| Source image | One embedded 1024 × 1024 texture |
| Coordinate scale | 1800 |
| Animation sampling | 120 FPS plus original key times |
| Sample times per clip | 31, including intermediate poses |
| Maximum vertex position deviation | Less than 0.064 Blockbench units |
| Maximum weight deviation after reopening | Less than 0.000005 |

The recorded report is available as [`validation/character-import.json`](validation/character-import.json). It is historical evidence copied from the original workflow, not the output of this repository's CI. The original GLB, BBMODEL and character images are not redistributed; their redistribution rights were not established for this repository.

The validator compared all vertices at each sample time using source joint matrices and normalized weights, then compared the imported native deformation after reopening. It also checked clip duration and nonzero motion. The configured pass thresholds in that report were `0.08` for positions and `0.00001` for weights; the observed errors were smaller.

## What these results do not establish

One tested character does not establish correctness for arbitrary GLB files, every Blockbench release, all bind poses, multi-skin assets or all transform combinations. Position error is scale-dependent. BBMODEL's numeric rounding and Euler interpolation between sampled keys can introduce differences.

Source `STEP` channels are sampled and emitted as linear native keys, so a discontinuity can become a short transition. Raising FPS reduces some interpolation errors, but does not make conversion mathematically lossless.

## Automated tests

`npm test` runs Node.js tests for invalid GLB headers and buffers, interleaved and normalized accessors, sparse values, accessor bounds, source interpolation, API registration and lifecycle, option validation, and the original ribbon fixture.

`npm run check` checks JavaScript syntax, English-only repository text, required files, local Markdown links and the SVG banner's basic structure. These are source/package checks, not editor integration tests.

GitHub Actions runs the same commands on Windows and Linux. The checks require no third-party packages and do not launch Blockbench.

## Manual example check

1. Load the plugin in Blockbench desktop.
2. Import `examples/weighted-ribbon.glb` at scale `16`, FPS `120`.
3. Expect one mesh, two source joints, three native bones including the mesh node, one texture and the `Sway` clip.
4. Play the clip and inspect blending around the middle of the ribbon.
5. Save BBMODEL, reopen it, disable the importer and confirm the saved rig still plays.

The ribbon is a reproducible synthetic input, not a broad compatibility suite. Record the Blockbench version and any deviations when reporting results.
