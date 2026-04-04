# Phase 6 prognostic cloud fraction and full-column cloud-radiation coupling

Phase 6 replaces the old mostly display-driven cloud path with state-driven cloud fraction and layer optical depth proxies.

## Implemented pieces

- added per-layer cloud diagnostics in model state:
  - `state.cloudFrac3D`
  - `state.cloudTau3D`
- `diagnostics2d` now derives cloud fraction from:
  - condensate (`qc`, `qi`, `qr`)
  - relative humidity
  - ascent
  - convective anvil support as a secondary modifier only
- low / high / total cloud are now derived from vertical layer cloud fractions via overlap logic instead of RH-memory heuristics being the primary source
- radiation now uses full-column cloud optical depth + cloud fraction instead of only low/high heuristic bands
- validation diagnostics now export optical-depth proxies:
  - `opticalDepthProxyLow`
  - `opticalDepthProxyHigh`
  - `opticalDepthProxyTotal`

## Main files

- `src/weather/v2/state5.js`
- `src/weather/v2/diagnostics2d.js`
- `src/weather/v2/radiation2d.js`
- `src/weather/v2/cloudRadiation.test.js`
- `src/weather/validation/diagnostics.js`

## Tests

- `cloudRadiation.test.js` verifies:
  - condensate-bearing states generate nonzero cloud fraction / optical depth
  - full-column cloud optical depth reduces surface radiative flux relative to a clear column
