# Phase 9 end-to-end calibration, thresholds, and Earth-accuracy exit gates

Phase 9 adds the benchmark-suite runner and final status-report path.

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
