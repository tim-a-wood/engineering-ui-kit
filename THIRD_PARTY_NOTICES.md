# Third-Party Notices — Engineering UI Kit Workbench v0.1

Runtime dependencies shipped with or required by the desktop application:

| Package | License | Use |
|---|---|---|
| electron | MIT | Desktop shell |
| react, react-dom | MIT | Renderer UI |
| adm-zip | MIT | Zip-overlay reading (inspection/apply) |

Development and build-time dependencies (not distributed in the app):

| Package | License | Use |
|---|---|---|
| vite, @vitejs/plugin-react | MIT | Renderer build |
| typescript | Apache-2.0 | Compilation |
| vitest | MIT | Core library tests |
| playwright | Apache-2.0 | Qualitative validation driver; optional PDF renderer |
| @types/* (DefinitelyTyped) | MIT | Type definitions |

All licenses are permissive; no copyleft obligations attach to distribution. Full
license texts ship in `node_modules/<package>/LICENSE` and must be bundled by the
installer step (electron-builder includes them automatically).

Research-source attribution for the standards package remains in
`standards/THIRD_PARTY_NOTICES.md` and `standards/research-source-attribution.md`.
