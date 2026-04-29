# Steam Weather Performance Budget

Status: Phase 0 target budget

## Target Hardware

Minimum target:

- OS: Windows 10/11 64-bit, macOS 13+, or Steam Deck class Linux target after packaging proof
- CPU: 4 physical cores / 8 hardware threads, 3.0 GHz class desktop CPU or Steam Deck class APU
- GPU: DirectX 11 / Metal / Vulkan capable GPU with WebGL2 support; WebGPU preferred when available
- VRAM: 2 GB minimum, 4 GB recommended
- RAM: 8 GB minimum, 16 GB recommended
- Storage: 2 GB install target before high-resolution optional art packs

Recommended target:

- CPU: 6+ modern cores
- GPU: GTX 1660 / RX 580 / Apple M1 class or better
- RAM: 16 GB
- Storage: under 5 GB base install

## Frame And Smoothness Budget

Default gameplay target:

- 60 FPS at 1920x1080 on recommended hardware
- 30 FPS minimum mode on minimum hardware
- Main-thread frame budget: 16.6 ms at 60 FPS
- `Earth.update` p95 target: under 12 ms
- `Earth.update` max soft target during ordinary play: under 25 ms
- No recurring visible clock stalls
- No repeated worker restarts in healthy play

## Weather Simulation Budget

Live global production grid:

- Current production live grid: 96x48
- Certified annual validation grid: 48x24
- Future validation grids: 60x30 and 96x48 as periodic higher-cost gates

Simulation cadence:

- Global climate grid may advance in bounded worker chunks.
- The renderer should consume snapshots asynchronously.
- Long-horizon audits can run headless and do not share the live frame budget.

Worker budget:

- Live worker step requests remain bounded to avoid UI stalls.
- Snapshot transfer should use transferable typed-array buffers or future shared-memory contracts.
- The live app may skip visual repaint cadence, but it may not silently skip model time without telemetry.

## Memory Budget

Base target:

- Runtime RAM below 1.5 GB on recommended hardware during ordinary play.
- Weather kernel live state below 250 MB before local downscaling.
- Local downscaled fields are tile/event scoped and cache-evicted.
- Renderer textures and volumetric buffers must expose quality tiers.

## Visual Budget

Quality tiers:

- Low: coherent global clouds, winds, precipitation, simple event overlays.
- Medium: layered clouds, rain/snow shafts, animated fronts, radar/satellite products.
- High: volumetric/impostor cloud towers, hurricane eyewalls, squall lines, lightning, terrain and day/night polish.

The renderer may synthesize detail, but visual detail must remain tied to model fields, event objects, or deterministic downscaled tiles.

## Release Gates

- `npm run weather:validate:test` passes.
- `npm run weather:benchmark` passes.
- Browser or packaged desktop runtime telemetry passes the smoothness budget.
- No world-class claim is made from headless climate metrics alone after visual/rendering changes.
