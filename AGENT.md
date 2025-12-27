# AGENT for satellite-wars

## Mission & Scope
- Prototype turn-based satellite warfare UI built with React + Three.js; renders Earth, manages turns, and simulates launches, comm links, fog-of-war, and strikes.
- Includes an in-engine Earth weather simulation (debug-first) used for global cloud cover and climate visuals; the long-term goal is Earth-like patterns in real time.
- Does not provide backend/multiplayer/persistence or production build tooling beyond Create React App defaults.

## Architecture Map
- Key components: `src/App.js` (scene setup, UI panels for HQ/launch/strike, event handling), `src/Satellite.js` (orbital motion, comm network, detections, fog), `src/Earth.js` (planet mesh, fog-of-war textures, HQ placement), `src/ActionRegistry.js` (AP/funds gating and action effects), `src/TurnManager.js` (turn/AP lifecycle), `src/HQ.js` & `src/Player.js` (entities), `src/EventBus.js` (pub/sub), `src/DetectionLog.js` (intel store), `src/constants.js` (ranges/economy/physics).
- Weather components: `src/SimClock.js` (authoritative sim time), `src/WeatherField.js` (stepping + debug texture painter + log capture), `src/weather/core.js` (Weather V1 core), `src/weather/v2/core5.js` (Weather V2 core, 5-level sigma/hydrostatic).
- Inbound interfaces: browser UI + pointer interactions in `src/App.js` (OrbitControls, orbit preview drag, menu buttons); no network/API inputs.
- Outbound integrations: renders WebGL via Three.js; uses MUI components for UI; no external services or storage.
- Data models/schemas: orbit objects with `radius` km, `speed` rad/s, `angle`/`raan`/`inclination` radians; Player/HQ/Satellite classes; income/upkeep & physics constants in `src/constants.js`.
- Execution modes: React dev server (`npm start`), static build (`npm run build`), Jest via react-scripts (`npm test`); all run from repo root.

## Weather System (Overview)
- Rendering path: `src/WeatherField.js` maintains offscreen canvases/textures (clouds + debug scalar maps) and paints them at a throttled cadence; `src/Earth.js` applies those textures to cloud meshes/overlays.
- Time coupling: `src/SimClock.js` is the “one clock” for Earth rotation + sun direction + weather stepping; `src/App.js` ticks the clock and calls `earth.update(simTimeSeconds, realDtSeconds, ...)`.
- Debugging: `src/App.js` exposes debug modes (ps, T, RH, omega, clouds/tau/cwp, climo fields), pause/step controls, and log capture; `src/weather/WeatherLogger.js` writes JSONL snapshots for tuning.
- Two weather implementations exist:
  - **V1** (`src/weather/*`): legacy 2-layer shallow-water-ish model + parameterized clouds/precip and optional “tropical cyclone” injector; heavily tuned and debugged.
  - **V2** (`src/weather/v2/*`): a more physically-coupled 5-level sigma/hydrostatic core intended to reduce artifacts, improve baroclinic realism, and close budgets (water/energy) while staying real-time.

## Weather V2 Goal (Why these phases exist)
The v2 plan is a stepwise rebuild that preserves your existing renderer/debug tooling while replacing the underlying atmosphere with something closer to a real global model “skeleton”:
- **Couple thermodynamics ↔ dynamics** via hypsometric geopotential (temperature gradients create pressure/geopotential gradients → winds and storm tracks can emerge).
- **Add vertical structure** (5 sigma layers) so ascent bands, shear, and vertical mixing/convection can be represented cheaply.
- **Evolve mass** (prognostic `ps`) so highs/lows move consistently with divergence (no “passive pressure field”).
- **Use stable, grid-safe numerics** on a 2° lat/lon grid (semi-Lagrangian advection + vector parallel transport + polar filtering/min-dx).
- **Close water/energy loops** (microphysics + precip flux + soil bucket + surface fluxes + cloud–radiation coupling) so climate doesn’t drift without heavy hand-tuning.
- **Anchor to Earth** with climatology initialization + large-scale-only nudging so long runs stay Earth-like while still producing transient weather.

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
- Weather hot paths:
  - `src/WeatherField.js` – the bridge between render/debug UI and the weather core(s); owns stepping, debug textures, and log capture.
  - `src/weather/core.js` – Weather V1 core loop (legacy).
  - `src/weather/v2/core5.js` – Weather V2 core loop (5-level), calling the v2 modules in sequence.
  - `src/weather/climatology.js` + `public/climo/manifest.json` – climatology asset loading and decoding.

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
- Weather climatology assets live under `public/climo/` and are described by `public/climo/manifest.json`; missing assets should fall back cleanly (do not hard-crash on missing optional files).
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
- src/WeatherField.js
- src/weather/core.js
- src/weather/v2/core5.js
- src/ActionRegistry.js
- src/TurnManager.js
- src/constants.js
- src/DetectionLog.js
- src/HQ.js
- src/Player.js
- src/EventBus.js
- src/setupTests.js, src/App.test.js

## File Index (Repo Map)

Notes:
- This list covers the *project files* (tracked in git plus the active weather v2 directory). It does not attempt to document `node_modules/` or `build/` outputs.
- If docs and code disagree, trust the code.

### Root
- `.gitignore` – git ignore rules.
- `AGENT.md` – this document (architecture, commands, and repo map for agents).
- `README.md` – project overview + basic usage.
- `agent.yaml` – local agent configuration (editor/automation metadata).
- `package.json` – npm scripts and dependencies (CRA + Three.js + MUI).
- `package-lock.json` – dependency lockfile.
- `commAndImagingNetwork.png` – design/diagram asset (communications + imaging network).
- `createSat.png` – design/diagram asset (satellite creation UI).
- `networkCreation.png` – design/diagram asset (network creation UI).
- `traversing fog of war.png` – design/diagram asset (fog-of-war traversal).
- `traversing fog of war2.png` – design/diagram asset (fog-of-war traversal, variant).

### IDE Metadata
- `.idea/modules.xml` – IntelliJ project configuration.
- `.idea/satellite-wars.iml` – IntelliJ module definition.
- `.idea/vcs.xml` – IntelliJ VCS mapping.

### Public (CRA static assets)
- `public/index.html` – CRA HTML shell.
- `public/favicon.ico` – favicon.
- `public/manifest.json` – PWA manifest.
- `public/robots.txt` – robots directives.
- `public/logo192.png`, `public/logo512.png` – PWA icons.

### Climatology Assets (`public/climo/`)
- `public/climo/README.md` – how to supply low-res climatology textures.
- `public/climo/manifest.json` – variable list + decode ranges for climo textures.
- `public/climo/sst_00.png`…`public/climo/sst_11.png` – monthly SST (K, grayscale).
- `public/climo/ice_00.png`…`public/climo/ice_11.png` – monthly sea-ice fraction (0–1, grayscale).
- `public/climo/slp_00.png`…`public/climo/slp_11.png` – monthly SLP for optional nudging (Pa, grayscale).
- `public/climo/wind_00.png`…`public/climo/wind_11.png` – monthly 10m wind for optional nudging (RG = u/v, m/s).
- `public/climo/wind500_00.png`…`public/climo/wind500_11.png` – monthly wind at 500 hPa (RG = u/v, m/s).
- `public/climo/wind250_00.png`…`public/climo/wind250_11.png` – monthly wind at 250 hPa (RG = u/v, m/s).
- `public/climo/albedo.png` – static albedo (0–1, grayscale).
- `public/climo/soilcap.png` – static soil capacity (0–1, grayscale).

### App Source (`src/`)
- `src/index.js` – React entrypoint (mounts `App`).
- `src/index.css` – global CSS.
- `src/App.js` – main UI + Three.js scene orchestration; sim clock; debug UI; weather controls/log capture.
- `src/App.css` – app-level styles.
- `src/App.test.js` – placeholder CRA test.
- `src/setupTests.js` – Jest DOM setup.
- `src/reportWebVitals.js` – CRA performance hooks.
- `src/logo.svg` – CRA logo asset.

### Game/World
- `src/Earth.js` – Earth mesh + fog-of-war canvases + HQ placement; hosts `WeatherField` and applies weather textures/overlays.
- `src/Satellite.js` – satellite entity/orbit propagation; comm graph + detection + fog reveal.
- `src/HQ.js` – HQ entity model (HP, ownership, neighbor relationships).
- `src/Player.js` – player model (funds/AP + state).
- `src/TurnManager.js` – turn/AP lifecycle + economy tick.
- `src/ActionRegistry.js` – action definitions and gating (launch satellite, strike, etc.).
- `src/DetectionLog.js` – detection/intel history used by strike UI.
- `src/EventBus.js` – pub/sub event bus for gameplay systems.
- `src/constants.js` – shared gameplay constants (ranges, costs, physics-ish values).
- `src/SimClock.js` – authoritative sim time (pause, speed, stepping).

### Earth Assets (`src/`)
- `src/8081_earthmap10k.jpg` – diffuse Earth texture.
- `src/8081_earthbump10k.jpg` – bump map for Earth shading.
- `src/fog.png` – fog-of-war brush/texture.

### Weather Bridge
- `src/WeatherField.js` – connects game loop to weather cores; stepping; debug scalar painting; cloud texture painting; log capture.

### Weather V1 (`src/weather/`)
- `src/weather/core.js` – V1 weather core loop + module orchestration.
- `src/weather/fields.js` – V1 field allocation/init (typed arrays, diagnostics).
- `src/weather/grid.js` – V1 lat/lon grid utilities.
- `src/weather/solar.js` – solar geometry (zenith/season) used in radiation.
- `src/weather/surface.js` – surface fluxes/relaxation (Ts, evap, land/ocean behavior).
- `src/weather/dyn2layer.js` – 2-layer mass/wind dynamical core (hL/hU + u/v).
- `src/weather/dynamics.js` – legacy/aux dynamics helpers.
- `src/weather/advect.js` – V1 advection routines (semi-Lagrangian helpers).
- `src/weather/vertical.js` – V1 vertical exchange parameterization.
- `src/weather/convection.js` – V1 convection trigger/transport.
- `src/weather/clouds.js` – V1 stratiform cloud source/sink.
- `src/weather/microphysics.js` – V1 microphysics (qc/qr processes).
- `src/weather/diagnostics.js` – V1 derived fields for debug/render (RH, vort, omega proxy, tau/cwp, precip).
- `src/weather/climatology.js` – climo loader/sampler from `public/climo` with analytic fallbacks.
- `src/weather/geo.js` – land/sea mask and geography helpers.
- `src/weather/renderer.js` – V1 debug render helpers (if used).
- `src/weather/constants.js` – V1 physical constants.
- `src/weather/WeatherLogger.js` – JSONL logging + probes/stats collection for tuning.
- `src/weather/fix_instructions.docx` – historical notes/instructions (not used at runtime).

### Weather V2 (`src/weather/v2/`) (active development; currently untracked in git)
- `src/weather/v2/core5.js` – V2 core orchestrator (5 sigma layers): calls hydrostatic, dynamics, ps continuity, advection, vertical, microphysics, surface, radiation, diagnostics, climo/nudging.
- `src/weather/v2/state5.js` – typed-array state allocation (3D level-block fields + 2D surface/column + scratch).
- `src/weather/v2/grid.js` – V2 grid metrics (precomputed per-lat arrays: f, invDx/invDy, polarWeight, minDx clamp).
- `src/weather/v2/hydrostatic.js` – θ→T/Tv diagnosis and hypsometric geopotential integration (phiHalf/phiMid).
- `src/weather/v2/dynamics5.js` – pressure-gradient force + Coriolis + drag/diffusion wind step (with polar filtering).
- `src/weather/v2/mass5.js` – prognostic surface pressure update from vertically integrated mass-flux divergence.
- `src/weather/v2/advect5.js` – semi-Lagrangian advection for scalars + vectors with parallel transport; polar filtering.
- `src/weather/v2/vertical5.js` – omega diagnosis + vertical mixing + minimal convective adjustment (toggleable).
- `src/weather/v2/microphysics5.js` – saturation adjustment + qc/qr processes + precip flux to surface.
- `src/weather/v2/surface2d.js` – Ts slab + bulk fluxes + soil bucket closure (land moisture limits evap).
- `src/weather/v2/radiation2d.js` – cloud–radiation coupling (SW attenuation + LW emissivity) applying heating/cooling tendencies.
- `src/weather/v2/diagnostics2d.js` – outputs 2D diagnostic fields expected by renderer/debug (cloudLow/high, tau, omega, winds, precipRate).
- `src/weather/v2/climo2d.js` – samples `public/climo` fields onto the V2 grid (monthly interpolation).
- `src/weather/v2/initializeFromClimo.js` – initializes V2 state (ps/Ts/theta/qv/soilW) from climo fields.
- `src/weather/v2/nudging5.js` – large-scale-only nudging toward monthly climo (cadence + long taus) to keep long runs Earth-like.
