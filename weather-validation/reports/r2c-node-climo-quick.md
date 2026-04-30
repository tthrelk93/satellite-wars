# Planetary Realism Status

Generated: 2026-04-20T05:17:41.171Z
Preset: quick
Grid: 48x24
Model dt: 1800s
Overall verdict: **FAIL**

- Headless terrain source: native
- Terrain parity available: true

## 30-day audit

- Pass: **FAIL**
- ITCZ latitude/width: 1.334 / 24.89 deg
- Tropical convective fraction/org/mass flux: 0.094 / 0.348 / 0.00049
- Subtropical RH (N/S): 0.376 / 0.424
- North dry-belt land/ocean precip: 0.098 / 0.028 mm/hr
- North dry-belt land/ocean RH: 0.512 / 0.308
- Cross-equatorial / north-transition / north-dry vapor flux: 44.72752 / -241.17719 / -304.75743
- Subtropical subsidence drying (N/S): 0.02 / 0.013
- Tropical detrainment/anvil: 0.00077 kg/m² / 0.003
- Tropical trades (N/S): -1.682 / -0.852 m/s
- Midlatitude westerlies (N/S): 1.295 / 1.358 m/s
- Storm-track peaks (N/S): 63.75 / -63.75 deg
- Dry-belt ratios (N/S): 1.777 / 0.779
- Tropical cyclone environment counts (N/S): 0 / 0
- Global precip/cloud/tcw/max wind: 0.067 mm/hr / 0.666 / 34.736 kg/m² / 58.061 m/s
- Warnings:
  - itcz_width_unrealistic
  - north_subtropical_dry_belt_too_wet
  - north_subtropical_subsidence_too_weak
  - south_subtropical_subsidence_too_weak

## Top realism gaps

- North subtropical dry belt too wet: actual 1.777 vs target < 0.8 (severity 1, horizons 30)
- South subtropical subsidence drying too weak: actual 0.013 vs target > 0.03 (severity 0.567, horizons 30)
- North subtropical subsidence drying too weak: actual 0.02 vs target > 0.03 (severity 0.333, horizons 30)
- ITCZ width unrealistic: actual 24.89 vs target 6-24 deg (severity 0.074, horizons 30)

## Seasonal Root-Cause Signal

- Dominant annual family: Local large-scale maintenance (0.66828)
- Stable across sampled months: true
- Stable across sampled seasons: true

## Rich artifacts

- Monthly climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-monthly-climatology.json
- Sample zonal profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-sample-profiles.json
- Ranked realism gaps JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-realism-gaps.json
- Moisture attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-moisture-attribution.json
- Run manifest JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-run-manifest.json
- Conservation summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-conservation-summary.json
- Restart parity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-restart-parity.json
- Surface source attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-surface-source-tracers.json
- Surface flux decomposition JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-surface-flux-decomposition.json
- NH dry-belt source sector JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-nh-dry-belt-source-sector-summary.json
- Corridor replay catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-corridor-replay-catalog.json
- Corridor step-slice attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-corridor-step-slice-attribution.json
- Corridor module-toggle deltas JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-corridor-module-toggle-deltas.json
- Thermodynamic support summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-thermodynamic-support-summary.json
- Radiative cloud maintenance JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-radiative-cloud-maintenance.json
- Boundary-layer stability profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-boundary-layer-stability-profiles.json
- Forcing opposition budget JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-forcing-opposition-budget.json
- Nudging target mismatch JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-nudging-target-mismatch.json
- Initialization memory JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-initialization-memory.json
- Numerical integrity summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-numerical-integrity-summary.json
- Storm spillover catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-storm-spillover-catalog.json
- Sectoral dry-belt regimes JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-sectoral-dry-belt-regimes.json
- Transient eddy leakage summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-transient-eddy-leakage-summary.json
- DT sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-dt-sensitivity.json
- Grid sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-grid-sensitivity.json
- Monthly attribution climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-monthly-attribution-climatology.json
- Seasonal root-cause ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-seasonal-root-cause-ranking.json
- Attribution lag analysis JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-attribution-lag-analysis.json
- Counterfactual pathway sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-counterfactual-pathway-sensitivity.json
- Root-cause candidate ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-root-cause-candidate-ranking.json
- Coupled counterfactual matrix JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-coupled-counterfactual-matrix.json
- Coupled counterfactual ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-coupled-counterfactual-ranking.json
- Coupled counterfactual guardrails JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-quick-coupled-counterfactual-guardrails.json

## Default next priorities

1. Correct ITCZ placement and subtropical dry-belt moisture partitioning with a broad hydrology/circulation cycle.

