# AGENT for satellite-wars

## Mission & Scope
- Prototype turn-based satellite warfare UI built with React + Three.js; renders Earth, manages turns, and simulates launches, comm links, fog-of-war, and strikes.
- Does not provide backend/multiplayer/persistence or production build tooling beyond Create React App defaults.

## Architecture Map
- Key components: `src/App.js` (scene setup, UI panels for HQ/launch/strike, event handling), `src/Satellite.js` (orbital motion, comm network, detections, fog), `src/Earth.js` (planet mesh, fog-of-war textures, HQ placement), `src/ActionRegistry.js` (AP/funds gating and action effects), `src/TurnManager.js` (turn/AP lifecycle), `src/HQ.js` & `src/Player.js` (entities), `src/EventBus.js` (pub/sub), `src/DetectionLog.js` (intel store), `src/constants.js` (ranges/economy/physics).
- Inbound interfaces: browser UI + pointer interactions in `src/App.js` (OrbitControls, orbit preview drag, menu buttons); no network/API inputs.
- Outbound integrations: renders WebGL via Three.js; uses MUI components for UI; no external services or storage.
- Data models/schemas: orbit objects with `radius` km, `speed` rad/s, `angle`/`raan`/`inclination` radians; Player/HQ/Satellite classes; income/upkeep & physics constants in `src/constants.js`.
- Execution modes: React dev server (`npm start`), static build (`npm run build`), Jest via react-scripts (`npm test`); all run from repo root.

## Entrypoints & Commands
- Build: `npm run build`
- Test: `npm test` (react-scripts jest runner)
- Lint/Format: TODO (no scripts configured)
- Run (dev): `npm start`
- Smoke/Quick checks: `npm test -- --watch=false` (non-interactive CRA test run; current default test is placeholder)

## Hot Paths (priorities for reading/changing)
- `src/App.js` – orchestrates scene lifecycle, UI panels, orbit preview, turn/economy listeners, toasts, and rendering of satellites/HQs.
- `src/Satellite.js` – advances orbits, computes LoS/range graph, reveals fog, draws comm lines, and detects enemy HQs with throttling.
- `src/Earth.js` – Earth mesh, fog-of-war canvas per player, HQ placement on clicks, and overlay updates.
- `src/ActionRegistry.js` – defines LAUNCH_SAT/GROUND_STRIKE costs, AP/funds gating, strike timing, and victory checks.
- `src/TurnManager.js` – turn rotation, AP reset, economy tick emission.
- `src/constants.js` – communication/LoS thresholds and economy/launch cost physics constants shared across systems.
- `src/DetectionLog.js` – records detection events used by strike UI.
- `src/HQ.js` – HQ entity with HP/neighbor tracking that gates comm reachability.

## Contracts & Dependencies
- Provided APIs: ActionRegistry actions `LAUNCH_SAT`, `GROUND_STRIKE` → `src/ActionRegistry.js` (experimental); EventBus topics such as `TURN_STARTED`, `AP_CHANGED`, `ECONOMY_TICK`, `DETECTION_HQ`, `ACTION_STRIKE_RESOLVED`, `VICTORY` → emitted/consumed in `src/App.js`, `src/TurnManager.js`, `src/DetectionLog.js`, `src/ActionRegistry.js` (experimental).
- Consumed APIs/services: Three.js + OrbitControls in `src/App.js`/`src/Satellite.js`/`src/Earth.js`; MUI components (`@mui/material`, `@mui/icons-material`) for UI; Testing Library via react-scripts.
- Config/env requirements: None; UI constants and economy values are code-defined (`src/constants.js`).
- Version constraints: React 18.3.1, react-scripts 5.0.1 (Node version not pinned; ensure compatible node/npm).

## Test Strategy
- Layout: CRA/Jest defaults under `src/App.test.js`; `src/setupTests.js` installs `@testing-library/jest-dom`.
- Running subsets: `npm test -- <pattern>` or `npm test -- --watch=false` to avoid watch mode.
- Safe change guidance: prefer exercising the UI via `npm start` to validate Three.js rendering, orbit preview drag, launching/strike flows; add focused tests around ActionRegistry/TurnManager if extending rules (current default test is placeholder and may fail once UI text changes).

## Guardrails
- Do not remove or rename textures in `src/8081_earthmap10k.jpg`, `src/8081_earthbump10k.jpg`, `src/fog.png`; Earth depends on them.
- Gameplay/economy constants in `src/constants.js` shape ranges, costs, and income; adjust deliberately and keep systems in sync.
- Actions are gated by AP/funds and, for strikes, comm reachability; maintain these checks when adding actions to avoid bypasses.
- Secrets policy: front-end only; no secrets or env vars expected—keep configuration in code or runtime-provided values.

## Agent Drilldown Map
- Subsystems (Level 2 AGENTs to create or maintain):
  - Core game client → path: src (expected agent: src/AGENT.md) – React/Three orchestration, UI flows, and scene lifecycle (TODO)
  - Gameplay systems → path: src/gameplay (expected agent: src/gameplay/AGENT.md) – Turn, action, and economy logic currently split across TurnManager/ActionRegistry/constants (TODO)
  - World & fog-of-war → path: src/world (expected agent: src/world/AGENT.md) – Earth mesh, fog textures, HQ placement, minimap (TODO)
  - Entities & network graph → path: src/entities (expected agent: src/entities/AGENT.md) – Satellite/HQ classes, LoS/range and detection behaviors (TODO)
  - Static shell → path: public (expected agent: public/AGENT.md) – CRA HTML shell, manifest, icons (TODO)
- Critical files (Level 3 AGENTs to create or maintain):
  - src/App.js (expected agent: App.AGENT.md) – Main component: scene setup, UI panels, toasts, orbit preview, turn/event wiring (TODO)
  - src/Satellite.js (expected agent: Satellite.AGENT.md) – Orbit propagation, comm graph, detection, fog reveal (TODO)
  - src/Earth.js (expected agent: Earth.AGENT.md) – Earth rendering, fog canvases, HQ placement (TODO)
  - src/ActionRegistry.js (expected agent: ActionRegistry.AGENT.md) – Action definitions, AP/funds gating, strike resolution (TODO)
  - src/TurnManager.js (expected agent: TurnManager.AGENT.md) – Turn rotation and AP lifecycle (TODO)
  - src/constants.js (expected agent: constants.AGENT.md) – Shared range/physics/economy constants (TODO)
  - src/DetectionLog.js (expected agent: DetectionLog.AGENT.md) – Detection history used by strike UI (TODO)
  - src/HQ.js (expected agent: HQ.AGENT.md) – HQ entity HP and neighbor tracking (TODO)

## How Future Agents Should Use This Repo
- Start with this AGENT.md for commands, architecture, and hot paths.
- Follow the Agent Drilldown Map to open module/file AGENT docs (or create them where marked TODO).
- Inspect the referenced source files and tests directly to confirm behavior; rely on code if docs disagree.
- Use `npm start` to observe in-browser behavior when altering Three.js interactions or game rules.

## Glossary (acronyms/terms)
- AP: Action Points per turn (max 10) consumed via ActionRegistry.
- RAAN: Right Ascension of the Ascending Node; orbit plane orientation used in launch geometry.
- FoW: Fog of War; per-player visibility mask rendered from satellite imaging data.
- LoS: Line of Sight; occlusion checks against Earth when linking satellites or HQs.

## Sources
- package.json
- src/App.js
- src/Satellite.js
- src/Earth.js
- src/ActionRegistry.js
- src/TurnManager.js
- src/constants.js
- src/DetectionLog.js
- src/HQ.js
- src/Player.js
- src/EventBus.js
- src/setupTests.js, src/App.test.js
