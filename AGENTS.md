# Agent instructions

## Project purpose

This is a standalone Blockbench desktop plugin for importing binary glTF 2.0 with native armatures, vertex weights, embedded textures and editable skeletal animations. It is not an MCP server or a headless converter.

## Read only what you need

- `README.md`: installation, features and compatibility limits.
- `docs/AUTOMATION.md`: renderer API contract and side effects.
- `docs/VALIDATION.md`: measured accuracy and validation limits.
- `plugin/glb_rig_importer.js`: the single distributable runtime file.
- `test/`: decoder, sampling and plugin-contract regression tests.
- `scripts/generate-example.mjs`: original synthetic GLB fixture generator.

## Rules

- All repository content, comments, UI text, errors and commit messages must be in English.
- Keep binary parsing and source animation sampling independent of editor UI calls. Keep editor adaptation and plugin registration out of pure helpers.
- Keep the plugin directly loadable from one file. Avoid adding runtime dependencies.
- Preserve existing projects and source assets. Import into a separate Generic Model tab and rely on native save prompts.
- Record significant changes in `CHANGELOG.md`; document changed compatibility limits.
- Do not change repository visibility or publish releases without an explicit maintainer instruction. A request to edit code is not a publication request.
- Do not claim lossless conversion, universal GLB support or exclusive novelty.
- Do not add third-party models, textures or screenshots without verified redistribution rights.

## Validation

Use Node.js 22 or newer. Run `npm test` and `npm run check` after code changes. If the example generator changes, run `npm run example` and review the generated GLB diff. No dependency installation is needed.

For import or transform changes, also test in Blockbench: import the ribbon, play `Sway`, save BBMODEL, reopen and inspect deformation and weights. Do not describe unit tests as a real editor integration test.
