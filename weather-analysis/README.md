# Weather analysis ingestion

Phase 2 adds a repo-native input format for initializing the model from local analysis/reanalysis-style data instead of synthetic climatology.

## Default loader path

At runtime the weather core looks for:

- `public/analysis/manifest.json`
- a referenced case JSON under `public/analysis/`

If an analysis case is available and valid, it is used as the **preferred** initialization path.
If not, the core falls back to climatology.

## Repo-native analysis case schema

```json
{
  "schema": "satellite-wars.weather-analysis.case.v1",
  "caseId": "fixture-global-2026-01-15",
  "validTime": "2026-01-15T00:00:00Z",
  "grid": {
    "latitudesDeg": [75, 50, 25, 0, -25, -50, -75],
    "longitudesDeg": [-165, -135, -105, -75, -45, -15, 15, 45, 75, 105, 135, 165]
  },
  "fields": {
    "surfacePressurePa": [/* 2-D field */],
    "surfaceTemperatureK": [/* optional 2-D field */],
    "surfaceGeopotentialM2S2": [/* optional 2-D field */],
    "uByPressurePa": {
      "100000": [/* 2-D field */],
      "85000": [/* 2-D field */],
      "70000": [/* 2-D field */],
      "50000": [/* 2-D field */],
      "25000": [/* 2-D field */]
    },
    "vByPressurePa": { /* same shape */ },
    "temperatureKByPressurePa": { /* or thetaKByPressurePa */ },
    "specificHumidityKgKgByPressurePa": { /* optional if RH provided */ },
    "relativeHumidityByPressurePa": { /* optional if q provided */ }
  }
}
```

Minimum required content:
- `surfacePressurePa`
- `uByPressurePa`
- `vByPressurePa`
- `temperatureKByPressurePa` **or** `thetaKByPressurePa`
- `specificHumidityKgKgByPressurePa` **or** `relativeHumidityByPressurePa`

## Raw-to-repo conversion

A lightweight conversion script is included:

```bash
npm run weather:analysis:convert -- \
  --in weather-analysis/raw-fixtures/fixture-global-2026-01-15-raw.json \
  --out public/analysis/fixture-global-2026-01-15.json
```

The converter accepts a raw JSON payload with either `fields` or `variables` and wraps it into the repo-native schema.

## Checked-in fixture

This repo includes:
- raw source fixture:
  - `weather-analysis/raw-fixtures/fixture-global-2026-01-15-raw.json`
- converted runtime fixture:
  - `public/analysis/fixture-global-2026-01-15.json`
- manifest:
  - `public/analysis/manifest.json`

This fixture is intended to prove the pipeline end-to-end in a local environment without requiring live downloads.

## Integration behavior

- `WeatherCore5` now attempts analysis initialization first.
- `initializeV2FromAnalysis` remaps horizontal fields onto the simulator grid.
- Vertical interpolation uses the model’s sigma grid and target pressure at each model level.
- If only RH is supplied, it is converted to specific humidity using temperature and pressure.
- If analysis loading fails validation, initialization falls back to climatology and records the fallback reason in `core.analysisInit`.

## Verification

Recommended checks:

```bash
npm run weather:validate:test
npm run weather:validate
npm run build
```

The model should initialize from `public/analysis/manifest.json` when that fixture is present.
