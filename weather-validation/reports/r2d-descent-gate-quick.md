# Planetary Realism Status

Generated: 2026-04-20T16:04:30.943Z
Preset: quick
Grid: 48x24
Model dt: 1800s
Overall verdict: **FAIL**

- Headless terrain source: native
- Terrain parity available: true

## 30-day audit

- Pass: **FAIL**
- ITCZ latitude/width: 0.634 / 25.313 deg
- Tropical convective fraction/org/mass flux: 0.104 / 0.347 / 0.00045
- Subtropical RH (N/S): 0.33 / 0.408
- North dry-belt land/ocean precip: 0.093 / 0.022 mm/hr
- North dry-belt land/ocean RH: 0.501 / 0.245
- Cross-equatorial / north-transition / north-dry vapor flux: 57.26991 / -227.00033 / -287.20504
- Subtropical subsidence drying (N/S): 0.054 / 0.041
- Tropical detrainment/anvil: 0.00081 kg/m² / 0.003
- Tropical trades (N/S): -1.681 / -0.853 m/s
- Midlatitude westerlies (N/S): 1.295 / 1.358 m/s
- Storm-track peaks (N/S): 63.75 / -63.75 deg
- Dry-belt ratios (N/S): 1.698 / 0.839
- Tropical cyclone environment counts (N/S): 0 / 0
- Global precip/cloud/tcw/max wind: 0.063 mm/hr / 0.66 / 33.091 kg/m² / 58.061 m/s
- Warnings:
  - itcz_width_unrealistic
  - north_subtropical_dry_belt_too_wet
  - south_subtropical_dry_belt_too_wet

## Top realism gaps

- North subtropical dry belt too wet: actual 1.698 vs target < 0.8 (severity 1, horizons 30)
- ITCZ width unrealistic: actual 25.313 vs target 6-24 deg (severity 0.109, horizons 30)
- South subtropical dry belt too wet: actual 0.839 vs target < 0.8 (severity 0.078, horizons 30)

## Seasonal Root-Cause Signal

- Dominant annual family: Local large-scale maintenance (0.68618)
- Stable across sampled months: true
- Stable across sampled seasons: true

## Rich artifacts

- Monthly climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-monthly-climatology.json
- Sample zonal profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-sample-profiles.json
- Ranked realism gaps JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-realism-gaps.json
- Moisture attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-moisture-attribution.json
- Run manifest JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-run-manifest.json
- Conservation summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-conservation-summary.json
- Restart parity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-restart-parity.json
- Surface source attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-surface-source-tracers.json
- Surface flux decomposition JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-surface-flux-decomposition.json
- NH dry-belt source sector JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-nh-dry-belt-source-sector-summary.json
- Corridor replay catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-corridor-replay-catalog.json
- Corridor step-slice attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-corridor-step-slice-attribution.json
- Corridor module-toggle deltas JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-corridor-module-toggle-deltas.json
- Thermodynamic support summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-thermodynamic-support-summary.json
- Radiative cloud maintenance JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-radiative-cloud-maintenance.json
- Boundary-layer stability profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-boundary-layer-stability-profiles.json
- Forcing opposition budget JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-forcing-opposition-budget.json
- Nudging target mismatch JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-nudging-target-mismatch.json
- Initialization memory JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-initialization-memory.json
- Numerical integrity summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-numerical-integrity-summary.json
- Storm spillover catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-storm-spillover-catalog.json
- Sectoral dry-belt regimes JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-sectoral-dry-belt-regimes.json
- Transient eddy leakage summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-transient-eddy-leakage-summary.json
- DT sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-dt-sensitivity.json
- Grid sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-grid-sensitivity.json
- Monthly attribution climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-monthly-attribution-climatology.json
- Seasonal root-cause ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-seasonal-root-cause-ranking.json
- Attribution lag analysis JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-attribution-lag-analysis.json
- Counterfactual pathway sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-counterfactual-pathway-sensitivity.json
- Root-cause candidate ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-root-cause-candidate-ranking.json
- Coupled counterfactual matrix JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-coupled-counterfactual-matrix.json
- Coupled counterfactual ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-coupled-counterfactual-ranking.json
- Coupled counterfactual guardrails JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-quick-coupled-counterfactual-guardrails.json

## Default next priorities

1. Correct ITCZ placement and subtropical dry-belt moisture partitioning with a broad hydrology/circulation cycle.

