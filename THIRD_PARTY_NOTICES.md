# Third-party notices

The application uses these runtime libraries. Their copyright and license notices remain in the installed packages and distributed bundles. Copies of the runtime library licenses also ship in `public/licenses/` (served as `licenses/` in the playable build).

| Library                         | Installed release | License    | Source                                 |
| ------------------------------- | ----------------- | ---------- | -------------------------------------- |
| React / React DOM               | 19.3.1            | MIT        | https://github.com/facebook/react      |
| Three.js                        | 0.180.0           | MIT        | https://github.com/mrdoob/three.js     |
| Rapier 3D compatibility package | 0.19.3            | Apache-2.0 | https://github.com/dimforge/rapier.js  |
| TensorFlow.js                   | 4.22.0            | Apache-2.0 | https://github.com/tensorflow/tfjs     |
| idb                             | 8.0.4             | ISC        | https://github.com/jakearchibald/idb   |
| Lucide React icons              | 0.468.0           | ISC        | https://github.com/lucide-icons/lucide |

Development tooling includes TypeScript, Vite, Vitest, ESLint, Prettier, Playwright, and fake-indexeddb. Exact resolved dependency versions and integrity hashes are recorded in `package-lock.json`; `npm ci` reproduces them.

IB curriculum documents and TensorFlow documentation are linked as reference sources. The project is independent and does not claim IB endorsement. Its physics world, robot conveyor, procedural training data, mission text, and questions are original project work.

## Fonts and illustrations

Anton (wordmark), Roboto Condensed Black (display type), and IBM Plex Sans (body type) are bundled locally through Fontsource 5.3.0. All three font families use the SIL Open Font License 1.1. The complete copyright and license notices ship in `public/licenses/` and in the playable build's `licenses/` directory. Font files retain their own license.

The two hub illustrations were generated with OpenAI's built-in image-generation tool using the selected original design mock as an art-direction reference. Original PNGs, generation prompts, and conversion details are in `docs/design/`; runtime JPEGs are in `public/art/`. They depict the workshop themes and are promotional illustrations, not screenshots of the running simulations. No CrazyGames artwork or game code is included. These generated images are provided under CC0 1.0 to the extent the project can dedicate rights; no exclusive authorship is claimed for AI-generated images. Educational prose remains CC BY 4.0 and original code remains MIT.

Apache-2.0 license copies for TensorFlow.js and Rapier.js were retrieved from their upstream repositories: https://github.com/tensorflow/tfjs/blob/master/LICENSE and https://github.com/dimforge/rapier.js/blob/master/LICENSE. Other runtime and font notices were copied unchanged from the installed packages.
