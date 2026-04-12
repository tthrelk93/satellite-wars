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

Run a 365-day planetary realism report that leaves behind tuning-grade artifacts:

```bash
npm run weather:planetary:audit:annual:report
```

That annual report now writes:
- `weather-validation/output/annual-planetary-realism.json`
- `weather-validation/output/annual-planetary-realism.md`
- `weather-validation/output/annual-planetary-realism-monthly-climatology.json`
- `weather-validation/output/annual-planetary-realism-monthly-attribution-climatology.json`
- `weather-validation/output/annual-planetary-realism-seasonal-root-cause-ranking.json`
- `weather-validation/output/annual-planetary-realism-attribution-lag-analysis.json`
- `weather-validation/output/annual-planetary-realism-sample-profiles.json`
- `weather-validation/output/annual-planetary-realism-realism-gaps.json`

Those artifacts are meant for follow-on tuning, not just pass/fail:
- monthly climatology means for ITCZ placement/width, dry-belt humidity, subsidence drying, convective organization, and wind-belt structure
- monthly attribution climatology and seasonal root-cause rankings so long-horizon runs tell you which causal family actually stays dominant
- lag-analysis sidecars that show which upstream source/persistence signals best predict later dry-belt wetness and upper-cloud buildup
- zonal profile traces at every sampled checkpoint so you can see where the moisture belts, cloud belts, and convective mass flux are misplaced
- a ranked realism-gap report that turns the failing warnings into prioritized tuning targets

Live weather logs also now include a `v2.broadClimate` object in every `state` entry so browser-backed runs expose the same ITCZ, subtropical drying, convective organization, and trade/westerly metrics as the headless planetary audit.

Generate the automatic top-5 physics target report from those annual artifacts:

```bash
npm run weather:planetary:targets:annual
```

Or run the full overnight pack in one command:

```bash
npm run weather:planetary:audit:annual:tuning-pack
```

That post-run target extractor writes:
- `weather-validation/output/annual-planetary-realism-physics-targets.json`
- `weather-validation/output/annual-planetary-realism-physics-targets.md`

It turns the annual realism artifacts into a ranked shortlist of physics campaigns, with:
- the top 5 broad physics targets to attack next
- why each target is ranked where it is
- which weather-core files are the best first places to edit
- the latest and monthly evidence that supports each recommendation

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
