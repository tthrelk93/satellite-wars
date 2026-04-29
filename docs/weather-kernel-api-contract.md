# Weather Kernel API Contract

Status: Phase 1 boundary contract

## Contract Version

Current version: `weather-kernel.v1`

Implementation today: `WeatherCore5.js`

Public package boundary: `src/weather/kernel`

Future implementations, including Rust/WASM and native Rust/C++, must satisfy the same contract before replacing the JavaScript implementation.

## Ownership

The weather kernel owns:

- model configuration
- deterministic seed handling
- global grid and vertical layout
- global time and timestep advancement
- public grid fields
- compact and full snapshots
- replay digest support
- diagnostics required by audits and future event spawning

The kernel does not own:

- Three.js scene objects
- React state
- user interface state
- Steam packaging
- event lifecycle objects
- local downscaled tiles
- cinematic weather rendering

## Public Runtime API

`createWeatherKernel(config)` returns a `WeatherKernelRuntime`.

Required methods:

- `whenReady()`
- `advanceModelSeconds(modelSeconds)`
- `setSimSpeed(simSpeed)`
- `setTimeUTC(seconds)`
- `setV2ConvectionEnabled(enabled)`
- `getSnapshot({ mode })`
- `getGridFields({ mode })`
- `getDiagnostics({ mode })`
- `loadSnapshot(snapshot)`
- `getWorkerPayload({ mode })`
- `getTransferBuffers(payload)`

Required metadata:

- `contractVersion`
- `manifest`
- normalized `config`

Transitional compatibility:

- `runtime.core` currently exposes the underlying `WeatherCore5` for legacy render paths.
- New subsystems must not depend on `runtime.core`.
- The event layer, local downscaler, renderer, and gameplay features must request data through versioned products or snapshots.

## Snapshot Contract

Snapshot schema: `satellite-wars.weather-kernel.snapshot.v1`

Compact snapshots must include:

- `timeUTC`
- `grid.nx`, `grid.ny`, `grid.latDeg`, `grid.lonDeg`
- `vertical.nz`, `vertical.sigmaHalf`, `vertical.layout`
- public fields:
  - `ps`
  - `Ts`
  - `u`
  - `v`
  - `uU`
  - `vU`
  - `cloud`
  - `cloudLow`
  - `cloudHigh`
  - `precipRate`
  - `sstNow`
  - `seaIceFrac`
  - `seaIceThicknessM`
  - `tauLow`
  - `tauHigh`
  - `h850`
  - `h700`
  - `h500`
  - `h250`

Full snapshots must also include full mutable state for restart/replay parity.

## Grid Field Product Contract

Grid field schema: `satellite-wars.weather-kernel.grid-fields.v1`

Grid-field products expose only public model fields, grid metadata, vertical metadata, time, manifest, and contract version. Renderers, gameplay systems, event detectors, and downscalers should consume this product instead of importing internal weather arrays.

## Diagnostics Product Contract

Diagnostics schema: `satellite-wars.weather-kernel.diagnostics.v1`

Diagnostics products expose time, manifest, contract version, and a stable diagnostics object. The event layer may use diagnostics to spawn storms or severe-weather ledgers, but it must treat missing diagnostics as unknown rather than reaching into `WeatherCore5` internals.

## Event Seed Contract

Event seed schema: `satellite-wars.weather-kernel.event-seed.v1`

Event seeds are deterministic handoff records between the global model and future event systems. They must include:

- `id`
- `type`
- `timeUTC`
- `seed`
- `sourceSnapshotDigest`
- optional `basin`, `region`, `parentEventId`, and normalized `environment`

Given the same kernel snapshot digest, event type, event id, seed, and environment fields, the event layer and local downscaler must produce the same event lifecycle and local detail.

## Deterministic Replay Contract

Replay schema: `satellite-wars.weather-kernel.replay.v1`

Given the same implementation, config, seed, step count, step duration, and starting state:

- compact snapshot digests must match exactly in the same runtime
- full snapshot restore must preserve parity-critical runtime state
- replay artifacts must record contract version and normalized config

## Boundary Rule

Runtime app code outside `src/weather/kernel` and `src/weather/v2` must not import `src/weather/v2/core5` directly. It must create or consume the model through `src/weather/kernel`.

Low-level weather unit tests, climate audits, and existing research scripts may still import `src/weather/v2` internals until those tools are migrated behind dedicated audit contracts.
