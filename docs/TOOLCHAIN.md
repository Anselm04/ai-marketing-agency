# Build and test toolchain

Use a supported Node release: Node 22.12 or newer in the 22.x line, Node 24.x, or Node 26+. The root/frontend engine ranges match Vitest 5's supported versions. CI and Docker use the Node 22 release line; do not use an older cached Node 22 image for frontend builds.

The frontend tools are pinned to Vite 8.3.5, Vitest 5.0.5 and the React plugin 6.1.2 in the workspace manifest and root lockfile. Vite 8 changes the bundler to Rolldown; the existing React configuration and Vitest jsdom setup remain in use. The Vite config explicitly preserves the previous Vite 5 browser targets instead of adopting a newer default browser baseline.

Tailwind remains on version 3 to preserve the app's styling configuration. Its selector-parser dependency and the copy used by postcss-nested are overridden to patched postcss-selector-parser 7.1.7. This override is intentional: Tailwind 3's own dependency range otherwise resolves the affected 6.x parser. Retain the override until an upstream Tailwind version declares a patched compatible parser, or a separately verified styling migration replaces it.

Validation for this upgrade includes a clean `npm ci`, full dependency audit, frontend tests, production build, backend tests/lint and comparison of the generated unminified Tailwind/PostCSS output before and after the parser replacement. The same sources/configuration must produce identical CSS. CI audits both production and development dependencies at moderate severity and above.

Reference migration guides:
- https://vite.dev/guide/migration
- https://vitest.dev/guide/migration/
- https://github.com/postcss/postcss-selector-parser/blob/main/CHANGELOG.md
