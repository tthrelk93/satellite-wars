# Phase 9 end-to-end calibration, thresholds, and Earth-accuracy exit gates

Phase 9 is not just scoring. It adds a model-side Earth-mode calibration path and the final benchmark/reporting path.

## Model implementation: incremental analysis updates between reanchors

The final Earth-mode gap was that analysis re-anchoring only applied a direct blend at the re-anchor instant.
That kept the system tethered, but it did not carry the remaining large-scale correction forward as part of the model evolution.

Phase 9 now adds **incremental analysis updates (IAU)**:

- re-anchor events compute residual analysis increments for:
  - surface pressure
  - wind
  - theta / temperature
  - specific humidity
  - surface temperature
- those residuals are converted into per-step tendencies spread across the next re-anchor window
- the core applies those tendencies every dynamics step with field clamps and hydrostatic refresh
- module diagnostics now log analysis-increment application during Earth-mode runs

Main model files:
- `src/weather/v2/analysisIncrement5.js`
- `src/weather/v2/state5.js`
- `src/weather/v2/core5.js`
- `src/Earth.js`

This makes Earth-mode correction continuous instead of a periodic jump/blend only.

## One-command workflow

```bash
npm run weather:benchmark
```

This generates:
- `weather-validation/reports/earth-accuracy-status.json`
- `weather-validation/reports/earth-accuracy-status.md`

## Suite contents

The suite file is:
- `weather-validation/suites/earth-accuracy-suite.json`

It spans five benchmark categories:
- quiescent synoptic
- strong midlatitude cyclone
- tropical system
- mountain precipitation
- polar / sea-ice

Each case includes:
- model fields
- analysis fields
- reference truth fields
- climatology baseline fields
- persistence baseline fields
- remap-floor proxy fields

## Gates

The suite compares model skill against:
- absolute thresholds
- a remap-floor multiplier threshold
- climatology baseline
- persistence baseline

## Status document intent

The generated report is meant to answer one question cleanly:

> On the simulator grid and resolved scales, is the current system good enough to call Earth-accurate for this benchmark suite?

It produces an explicit pass/fail result instead of hand-wavy vibes.
