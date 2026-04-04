# Phase 7 mixed-phase microphysics and precipitation upgrade

Phase 7 adds explicit snow and upgrades the hydrometeor / precipitation path beyond the older qc/qi/qr-only behavior.

## Implemented pieces

- added explicit snow mixing ratio state:
  - `state.qs`
- added phase-separated surface precipitation diagnostics:
  - `state.precipRainRate`
  - `state.precipSnowRate`
- microphysics now includes:
  - warm-rain autoconversion (`qc -> qr`)
  - snow autoconversion / aggregation (`qi -> qs`)
  - rain freezing to snow (`qr -> qs`)
  - snow melting to rain (`qs -> qr`)
  - cloud/rain evaporation
  - ice/snow sublimation
  - phase-aware latent heating using `Lv` and `Lf`
  - separate rain and snow fallout rates

## Validation / diagnostics additions

Validation diagnostics now export:
- `precipRainRateMmHr`
- `precipSnowRateMmHr`
- `cloudWaterPathKgM2`
- `snowWaterPathKgM2`

## Logging additions

Weather logger now records / exposes:
- upper-level snow (`qsU`) when present
- rain-rate and snow-rate summaries / probes

## Tests

- `src/weather/v2/microphysicsPhase7.test.js`

These tests verify:
- cold-column snow formation / snowfall
- warm-column snow melt toward rain
- positivity is preserved across hydrometeors
