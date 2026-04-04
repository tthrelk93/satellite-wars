# Weather validation harness

This directory is the Phase 0 regression gate for the weather model.

## What this harness is for

The job of this harness is to score the simulator against reference truth on the **simulator grid**, not by eye.

For the purposes of this repo, “Earth accurate” means:
- initialization can come from real analysis/reanalysis
- later phases can re-anchor the model with external analysis increments or observations
- validation is done on downsampled/remapped truth on the simulator grid
- changes are judged with objective metrics and documented outputs

It does **not** imply convective-scale realism on the current resolved grid.

## Directory layout

- `cases/` – benchmark case manifests
- `fixtures/` – checked-in synthetic fixture data and example schemas
- `lib/` – remapping, metric, and reporting helpers used by the validation runner
- `tests/` – focused unit tests for remapping and metric logic
- `output/` – generated JSON and Markdown summaries

## Case manifest schema

Each benchmark manifest must define:
- `caseId`
- `initTime`
- `leadHours`
- `simulatorGrid`
- `reference.fieldsPath`
- optional `reference.stormTrackPath`

This repo also records:
- `model.fieldsPath`
- optional `model.stormTrackPath`
- `validationPressureLevelsPa`
- `outputDir`

Example:

```json
{
  "caseId": "fixture-synoptic",
  "initTime": "2026-01-15T00:00:00Z",
  "leadHours": [0, 6, 12],
  "validationPressureLevelsPa": [50000],
  "simulatorGrid": {
    "latitudesDeg": [45, 0, -45],
    "longitudesDeg": [-135, -45, 45, 135]
  },
  "model": {
    "fieldsPath": "../../fixtures/fixture-synoptic/model-fields.json"
  },
  "reference": {
    "fieldsPath": "../../fixtures/fixture-synoptic/reference-fields.json"
  }
}
```

## Field dataset schema

The validation runner currently expects lead-based field snapshots in JSON with this shape:

```json
{
  "schema": "satellite-wars.weather-validation.fields.v1",
  "grid": {
    "latitudesDeg": [60, 0, -60],
    "longitudesDeg": [-150, -30, 90]
  },
  "pressureLevelsPa": [50000],
  "leads": [
    {
      "leadHours": 6,
      "seaLevelPressurePa": [/* grid-sized array */],
      "surfacePressurePa": [/* grid-sized array */],
      "wind10mU": [/* grid-sized array */],
      "wind10mV": [/* grid-sized array */],
      "geopotentialHeightMByPressurePa": {
        "50000": [/* grid-sized array */]
      },
      "totalColumnWaterKgM2": [/* grid-sized array */],
      "precipRateMmHr": [/* grid-sized array */],
      "precipAccumMm": [/* grid-sized array */],
      "cloudLowFraction": [/* grid-sized array */],
      "cloudHighFraction": [/* grid-sized array */],
      "cloudTotalFraction": [/* grid-sized array */]
    }
  ]
}
```

## Metrics produced

Per lead:
- SLP RMSE
- 500 hPa height RMSE
- 10 m wind RMSE
- total column water RMSE
- precip bias
- precip categorical skill at configurable thresholds
- low/high/total cloud-fraction bias
- cyclone-track error when storm metadata is present

Outputs:
- `summary.json`
- `summary.md`

## Running validation

Run the checked-in benchmark fixture:

```bash
npm run weather:validate
```

Run a specific manifest:

```bash
npm run weather:validate -- --case weather-validation/cases/fixture-synoptic/manifest.json
```

Export `validationSnapshot` events from a weather log into the field-schema JSON used by the validator:

```bash
npm run weather:validate:export -- logs/weather-log.jsonl --out weather-validation/output/live-case-fields.json
```

Run the focused helper tests:

```bash
npm run weather:validate:test
```

## How later phases should use this

1. Generate model diagnostics in the same field schema or emit `validationSnapshot` log entries from the live model.
2. If you logged snapshots, convert them with `npm run weather:validate:export`.
3. Point a manifest at the model outputs and reference truth.
4. Run `npm run weather:validate`.
5. Treat the JSON/Markdown summaries as the regression gate.

## Current fixture status

`fixture-synoptic` is intentionally synthetic. It is included to verify:
- manifest parsing
- grid remapping
- pressure-level handling
- metric calculations
- Markdown/JSON output generation
- cyclone-track scoring

It is not meant to represent a physically authoritative Earth case. Later phases should add real benchmark cases using actual analysis/reanalysis-derived truth.
