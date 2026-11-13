# Contributing

Thank you for helping make skeletal GLB import easier to use.

## Development

Use Node.js 22 or newer. There are no package dependencies and no build step. The distributable is `plugin/glb_rig_importer.js`.

```sh
npm test
npm run check
```

Load the plugin from that file in Blockbench desktop. Reload it after changes and test the bundled ribbon before trying larger assets. For transform or skinning changes, also save and reopen BBMODEL and compare intermediate poses against the source.

## Bug reports

Include your Blockbench version, operating system, plugin version, scale, sampling FPS, steps to reproduce, expected behavior and actual behavior. Attach a small GLB only if you can share it under its license. Explain whether the problem happens before or after saving BBMODEL. Remove private content and absolute personal paths from diagnostics.

## Pull requests

- Keep code, comments, documentation, UI and commit messages in English.
- Explain the user-visible behavior and any changed compatibility limits.
- Add meaningful regression coverage for parsing, interpolation or transform fixes.
- Keep pure binary/math helpers separate from Blockbench object creation and UI behavior.
- Avoid runtime dependencies and unrelated refactoring.
- Update `CHANGELOG.md` for significant changes.

Contributions are accepted under the repository's MIT license. Please do not add models, textures or screenshots without verified redistribution rights.
