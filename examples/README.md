# Weighted ribbon

[`weighted-ribbon.glb`](weighted-ribbon.glb) is an original synthetic GLB 2.0 example covered by the repository's MIT license.

- One ribbon mesh: eight vertices and six triangles.
- Two skin joints and blended weights at the middle rows.
- One additional mesh node, represented as a third native bone during import.
- One embedded 2 × 2 PNG base-color texture and primary UVs.
- One two-second `Sway` animation with five quaternion rotation keys.
- No external resources, compression, morph targets or third-party assets.

Import at scale `16`, FPS `120`. The rest-pose height is 32 Blockbench units. This deliberately simple asset makes the install path easy to exercise; it does not prove support for complex production rigs.

Regenerate the binary deterministically with `npm run example`. The source is [`scripts/generate-example.mjs`](../scripts/generate-example.mjs).
