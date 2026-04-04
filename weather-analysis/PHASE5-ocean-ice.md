# Phase 5 slab ocean and sea-ice coupling

Phase 5 upgrades the lower boundary from prescribed SST/ice toward an active slab-ocean + sea-ice system.

## Implemented pieces

- `state.sstNow` remains the active ocean mixed-layer temperature state
- added prognostic sea-ice state:
  - `state.seaIceFrac`
  - `state.seaIceThicknessM`
- added `state.surfaceRadiativeFlux` so the surface layer can use radiative forcing in its energy budget

## Surface coupling

`surface2d` now:
- evolves ocean SST using a slab mixed-layer heat capacity
- applies weak restoring toward climatological SST on a long timescale
- grows sea ice when ocean temperature falls below freezing or net cooling persists
- melts sea ice under sustained positive surface heat input
- suppresses evaporation over ice
- increases roughness modestly over ice
- uses colder ice skin temperatures for atmosphere/ocean flux coupling

## Radiation coupling

`radiation2d` now:
- blends ocean albedo toward higher sea-ice albedo over ocean ice
- writes an approximate net surface radiative flux into `state.surfaceRadiativeFlux`

## Logging / validation / snapshots

- compact/full state snapshots now include SST and sea-ice state
- validation diagnostics now include:
  - `sstK`
  - `seaIceFraction`
  - `seaIceThicknessM`
- logger stats now report prognostic SST / sea ice instead of only climatology references

## Tests

- `src/weather/v2/oceanIce.test.js`

These tests verify:
- slab-ocean SST responds to net surface flux + restoring
- sea ice can grow from subfreezing ocean conditions
