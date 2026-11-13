# Changelog

## 1.0.0 — 2026-11-13

Initial standalone repository, prepared for private review before public availability.

- Extracted the working GLB rig importer into a single-file Blockbench desktop plugin.
- Native armatures, bones, weighted meshes, embedded textures and editable animations.
- Source key times plus configurable animation sampling, with a default of 120 FPS.
- English interface and documentation, documented renderer API and agent entry points.
- Original weighted-ribbon example with a deterministic source generator.
- Decoder, sampling and plugin-contract regression tests with Windows/Linux CI.
- Recorded character-import evidence and explicit compatibility limits.

The extraction retains the original import algorithm. Repository packaging and English UI wording are new; the historical character validation predates this packaging.
