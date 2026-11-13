# Weighted ribbon

No model binaries are distributed here. The original [synthetic fixture generator](../scripts/generate-example.mjs), covered by the repository's MIT license, can create `weighted-ribbon.glb` locally for testing.

- One ribbon mesh: eight vertices and six triangles.
- Two skin joints and blended weights at the middle rows.
- One additional mesh node, represented as a third native bone during import.
- One embedded 2 × 2 PNG base-color texture and primary UVs.
- One two-second `Sway` animation with five quaternion rotation keys.
- No external resources, compression, morph targets or third-party assets.

Import at scale `16`, FPS `120`. The rest-pose height is 32 Blockbench units. This deliberately simple asset makes the install path easy to exercise; it does not prove support for complex production rigs.

Generate the binary locally with `npm run example`. Generated GLB files are ignored by Git and must not be committed or attached to releases. The automated tests generate the fixture in memory without reading a distributed model file.
