# Phase 8 real analysis re-anchoring

Phase 8 upgrades the analysis/forecast split so the analysis can stay anchored to external analysis targets instead of relying on truth-copy bootstrapping.

## Implemented pieces

- `Earth` now distinguishes analysis mode:
  - `real-earth` when the analysis core initialized from external analysis data
  - `sandbox` when it did not and still needs truth-copy bootstrap
- truth-copy bootstrap is skipped for the analysis core when it is already initialized from analysis data
- periodic analysis re-anchoring is supported through stored analysis targets on the analysis core state
- variable-specific re-anchor blending now covers:
  - `ps`
  - `u`
  - `v`
  - `theta` / temperature-derived theta
  - `qv`
- sounding assimilation now supports temperature / theta in addition to wind and moisture
- re-anchor events are logged as `analysisReanchorApplied`
- validation harness now supports optional `analysis.fieldsPath` so analysis-vs-reference skill can be carried alongside forecast-vs-reference skill in the summary output

## Current re-anchor path

The current implementation uses `state.analysisTargets` prepared during analysis initialization as the periodic re-anchor target source. That keeps the analysis path physically separate from the legacy truth-copy sandbox path.

## Main files

- `src/Earth.js`
- `scripts/validate-weather-case.mjs`
- `weather-validation/lib/io.mjs`
- `weather-validation/lib/markdown.mjs`

## Verification

- unit / helper tests still pass
- app build passes
- validation harness still runs
