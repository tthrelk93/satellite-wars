# Phase 4 terrain, geopotential, and land-surface coupling

Phase 4 turns terrain from a static display layer into an active lower-boundary forcing.

## Implemented pieces

- **Terrain-aware hydrostatic heights**
  - `updateHydrostatic` now accepts terrain height and anchors surface geopotential to terrain elevation.
  - Result: `phiHalf`, `phiMid`, and derived height diagnostics are now terrain-aware.

- **Separate surface pressure and sea-level pressure**
  - surface pressure remains `fields.ps`
  - sea-level pressure is now carried as `fields.slp`
  - validation diagnostics already export both separately

- **Terrain drag and roughness**
  - `dynamics5` now boosts low-level drag over steeper terrain
  - land roughness is also folded into the drag term

- **Orographic lift / leeside subsidence signal**
  - `vertical5` now injects a terrain-driven omega contribution using near-surface wind dotted with terrain slope
  - the forcing decays upward through the column instead of acting only at the surface

- **Land-surface coupling improvements**
  - `surface2d` now scales roughness over land and mountains
  - land thermal relaxation depends on soil-moisture availability
  - land target temperature includes terrain lapse-rate cooling
  - evapotranspiration sensitivity increases with slope/roughness and soil moisture availability

## Main files

- `src/weather/v2/hydrostatic.js`
- `src/weather/v2/dynamics5.js`
- `src/weather/v2/vertical5.js`
- `src/weather/v2/surface2d.js`
- `src/weather/v2/core5.js`
- `src/WeatherField.js`

## Tests added

- `src/weather/v2/terrainCoupling.test.js`

These tests verify:
- terrain height shifts geopotential structure
- terrain forcing alters omega relative to flat terrain under upslope flow
