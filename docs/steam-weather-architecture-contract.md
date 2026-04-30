# Steam Weather Architecture Contract

Status: Phase 0 baseline contract

## North Star

Satellite Wars should ship as a Steam-worthy strategy/weather game where the global climate model remains the source of truth and every dramatic local event is derived from that truth:

```text
certified global climate grid
  -> persistent storm/event objects
  -> local downscaled weather fields
  -> high-end visual renderer
  -> gameplay, sensors, forecasts, and warnings
```

The model does not need to run a global NOAA-grade atmosphere at tornado or eyewall resolution. Instead, the global grid decides the planetary state, the event layer creates physically constrained storm objects, the downscaler adds local detail near play, and the renderer makes that state legible and beautiful.

## Product Pillars

1. Weather is the game system, not a backdrop.
2. The global model is always authoritative for climate, seasons, basins, circulation, moisture, and broad storm tracks.
3. Event objects are allowed to be parameterized, but only when spawned from valid model environments.
4. Local downscaling can add detail, but it cannot contradict the global grid or event ledger.
5. Visuals must communicate real model state: clouds, fronts, rain, winds, hurricanes, tornado-risk environments, radar, satellite views, day/night, and seasonal movement.
6. Every claim must be backed by fresh artifacts: audits, replay files, browser signoff, performance profiles, or deterministic tests.

## Runtime Architecture

### Weather Kernel

The weather kernel owns global climate stepping, deterministic state, diagnostics, snapshots, replay, and public grid fields. The JavaScript implementation is `WeatherCore5` today. Rust/WASM or native Rust/C++ can replace it later only behind the same kernel contract.

The versioned boundary is `src/weather/kernel`.

### Event Layer

The event layer consumes kernel snapshots and diagnostics. The first implementation lives in `src/weather/events` and emits a deterministic `satellite-wars.weather-events.v1` product through the weather-kernel boundary. It owns persistent high-level weather events:

- tropical disturbances and hurricanes
- extratropical cyclones and frontal systems
- mesoscale convective systems
- supercells and tornado outbreaks
- atmospheric rivers
- blizzards, dust events, monsoon bursts, and heat/cold waves

The event layer may feed lightweight influence fields back to visuals and gameplay. It must not rewrite global climate state unless a future contract explicitly allows two-way coupling.

Current event objects include deterministic lifecycle, history, physical environment justification, and storm-specific forecast/satellite/radar signatures. Hurricanes are parameterized systems with center, radius, pressure proxy, wind field, rain shield, eye/eyewall, track, and intensity; they are rendered as lightweight cloud signatures tied to active event products. Severe-weather systems include an explicit ingredient index, supercell/outbreak/touchdown objects, hook-echo and velocity-couplet radar signatures, satellite anvil signatures, warning polygons, and damage swaths. The local downscaling layer consumes these same event products to create deterministic high-resolution nested fields around active events and camera/gameplay focus regions without mutating or contradicting the global model.

### Local Downscaler

The downscaler consumes global fields plus event objects and emits local high-detail fields near the camera or active gameplay region:

- local wind gusts and shear proxies
- rain/snow/hail intensity
- cloud tower/anvil/eyewall/rainband detail
- visibility, fog, lightning, dust, and storm surge cues
- tornado touchdown tracks and damage swaths

Downscaled output must be deterministic from the parent state, event id, seed, and local tile id.

Current local downscale regions include bounded wind, rain, cloud, visibility, pressure, lightning, hail, terrain-lift, and tornado-track fields. They fade to the parent global grid at their region edge and are clipped by parent/event truth so detail can sharpen an eyewall, rain band, front, squall line, or tornadic supercell without inventing weather in a physically quiet parent scene.

### Renderer

The renderer consumes public kernel fields, event objects, and downscaled fields. It must not import weather internals directly. It may use GPU-native representations, particle systems, impostors, volumes, shaders, or engine-specific assets.

Current renderer contract: global cloud textures are now colorized through a model-derived visual classifier, active event/downscale/global cues are rendered as lightweight weather impostors, and the app exposes visible-light, cinematic satellite, infrared, water-vapor, and radar modes. Renderer cues include stratocumulus decks, anvils, hurricane spirals, frontal shields, cumulonimbus towers, rain/snow shafts, lightning/tornado markers, dust, fog, sea spray, and storm-surge cues. These cues must be derived from public weather fields, event products, or local downscale products.

### Gameplay

Gameplay consumes stable products rather than raw internals:

- observations
- forecasts
- warnings
- event ledgers
- sensor products
- player-visible confidence and uncertainty

Gameplay can request forecast products through the contract. It cannot mutate raw atmospheric arrays directly.

## Engine Strategy

The current React/Three app remains the fastest path to iteration and Steam packaging. The engine decision must stay secondary until the kernel boundary is portable.

Planned evaluation order:

1. Current React/Three packaged through Electron or Tauri.
2. React/Three plus Rust/WASM weather kernel.
3. Unreal, Unity, or Godot consuming the same kernel and replay/event contracts.

Unreal is a visual ceiling candidate, not the first migration step.

## Pass Gates

- Architecture, performance, claims, and API contracts exist.
- App runtime code reaches the certified weather model through `src/weather/kernel`.
- New weather subsystems must use versioned kernel/event/downscaler/renderer contracts.
- Deterministic replay is available headlessly.
- Existing validation remains green after introducing the boundary.
