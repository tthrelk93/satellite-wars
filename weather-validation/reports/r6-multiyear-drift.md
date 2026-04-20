# Planetary Realism Status

Generated: 2026-04-20T22:26:10.042Z
Preset: annual
Grid: 48x24
Model dt: 3600s
Overall verdict: **FAIL**

- Headless terrain source: native
- Terrain parity available: true

## 365-day audit

- Pass: **FAIL**
- ITCZ latitude/width: -0.073 / 23.714 deg
- Tropical convective fraction/org/mass flux: 0.125 / 0.359 / 0.00029
- Subtropical RH (N/S): 0.277 / 0.359
- North dry-belt land/ocean precip: 0.033 / 0.008 mm/hr
- North dry-belt land/ocean RH: 0.324 / 0.254
- Cross-equatorial / north-transition / north-dry vapor flux: 39.33207 / -166.24422 / -203.0997
- Subtropical subsidence drying (N/S): 0.049 / 0.05
- Tropical detrainment/anvil: 0.0014 kg/m² / 0.003
- Tropical trades (N/S): -1.848 / -0.927 m/s
- Midlatitude westerlies (N/S): 1.357 / 1.558 m/s
- Storm-track peaks (N/S): 63.75 / -26.25 deg
- Dry-belt ratios (N/S): 0.692 / 0.885
- Tropical cyclone environment counts (N/S): 0 / 0
- Global precip/cloud/tcw/max wind: 0.031 mm/hr / 0.665 / 30.209 kg/m² / 53.514 m/s
- Warnings:
  - south_subtropical_dry_belt_too_wet
  - south_storm_track_out_of_range
  - north_tropical_cyclone_seasonality_weak
  - south_tropical_cyclone_seasonality_weak
- NH warm/cool tropical cyclone environment: 0 / 0
- SH warm/cool tropical cyclone environment: 0 / 0

## 730-day audit

- Pass: **FAIL**
- ITCZ latitude/width: 0.553 / 23.521 deg
- Tropical convective fraction/org/mass flux: 0.141 / 0.372 / 0.00035
- Subtropical RH (N/S): 0.318 / 0.373
- North dry-belt land/ocean precip: 0.049 / 0.009 mm/hr
- North dry-belt land/ocean RH: 0.377 / 0.288
- Cross-equatorial / north-transition / north-dry vapor flux: 30.92741 / -137.75406 / -181.38483
- Subtropical subsidence drying (N/S): 0.058 / 0.057
- Tropical detrainment/anvil: 0.0019 kg/m² / 0.004
- Tropical trades (N/S): -1.847 / -0.927 m/s
- Midlatitude westerlies (N/S): 1.358 / 1.557 m/s
- Storm-track peaks (N/S): 63.75 / -26.25 deg
- Dry-belt ratios (N/S): 0.902 / 0.959
- Tropical cyclone environment counts (N/S): 0 / 0
- Global precip/cloud/tcw/max wind: 0.033 mm/hr / 0.673 / 30.276 kg/m² / 53.514 m/s
- Warnings:
  - north_subtropical_dry_belt_too_wet
  - south_subtropical_dry_belt_too_wet
  - south_storm_track_out_of_range
  - north_tropical_cyclone_seasonality_weak
  - south_tropical_cyclone_seasonality_weak
- NH warm/cool tropical cyclone environment: 0 / 0
- SH warm/cool tropical cyclone environment: 0 / 0

## 1095-day audit

- Pass: **FAIL**
- ITCZ latitude/width: 0.726 / 23.364 deg
- Tropical convective fraction/org/mass flux: 0.136 / 0.372 / 0.00033
- Subtropical RH (N/S): 0.322 / 0.374
- North dry-belt land/ocean precip: 0.049 / 0.009 mm/hr
- North dry-belt land/ocean RH: 0.379 / 0.294
- Cross-equatorial / north-transition / north-dry vapor flux: 30.20489 / -137.02052 / -182.44932
- Subtropical subsidence drying (N/S): 0.057 / 0.052
- Tropical detrainment/anvil: 0.00206 kg/m² / 0.005
- Tropical trades (N/S): -1.847 / -0.927 m/s
- Midlatitude westerlies (N/S): 1.357 / 1.557 m/s
- Storm-track peaks (N/S): 63.75 / -26.25 deg
- Dry-belt ratios (N/S): 0.886 / 0.932
- Tropical cyclone environment counts (N/S): 0 / 0
- Global precip/cloud/tcw/max wind: 0.033 mm/hr / 0.673 / 30.404 kg/m² / 53.514 m/s
- Warnings:
  - north_subtropical_dry_belt_too_wet
  - south_subtropical_dry_belt_too_wet
  - south_storm_track_out_of_range
  - north_tropical_cyclone_seasonality_weak
  - south_tropical_cyclone_seasonality_weak
- NH warm/cool tropical cyclone environment: 0 / 0
- SH warm/cool tropical cyclone environment: 0 / 0

## Top realism gaps

- South subtropical dry belt too wet: actual 0.959 vs target < 0.8 (severity 0.318, horizons 365, 730, 1095)
- North subtropical dry belt too wet: actual 0.902 vs target < 0.8 (severity 0.204, horizons 730, 1095)
- South storm track misplaced: actual -26.25 vs target -65 to -30 deg (severity 0.188, horizons 365, 730, 1095)
- North tropical cyclone seasonality weak: actual 0 vs target > nhCoolSeasonMean * 1.15 (severity 0.067, horizons 365, 730, 1095)
- South tropical cyclone seasonality weak: actual 0 vs target > shCoolSeasonMean * 1.15 (severity 0.067, horizons 365, 730, 1095)

## Seasonal Root-Cause Signal

- Dominant annual family: Local large-scale maintenance (0.7511)
- Stable across sampled months: true
- Stable across sampled seasons: true
- Strongest lagged predictor: Helper forcing interference (0.33594)

## Counterfactual Root-Cause Ranking

- Primary candidate: Radiative maintenance ablation (0.01476)
- Backup candidate: 35N upper import ablation (0.05351)
- Closure ready: true

## Coupled Counterfactual Matrix

- Best coupled bundle: Import + erosion + saturation-adjustment maintenance (0.14477)
- Exit criteria pass: false

## Rich artifacts

- Monthly climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-monthly-climatology.json
- Sample zonal profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-sample-profiles.json
- Ranked realism gaps JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-realism-gaps.json
- Moisture attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-moisture-attribution.json
- Run manifest JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-run-manifest.json
- Conservation summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-conservation-summary.json
- Restart parity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-restart-parity.json
- Surface source attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-surface-source-tracers.json
- Surface flux decomposition JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-surface-flux-decomposition.json
- NH dry-belt source sector JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-nh-dry-belt-source-sector-summary.json
- Corridor replay catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-corridor-replay-catalog.json
- Corridor step-slice attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-corridor-step-slice-attribution.json
- Corridor module-toggle deltas JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-corridor-module-toggle-deltas.json
- Thermodynamic support summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-thermodynamic-support-summary.json
- Radiative cloud maintenance JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-radiative-cloud-maintenance.json
- Boundary-layer stability profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-boundary-layer-stability-profiles.json
- Forcing opposition budget JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-forcing-opposition-budget.json
- Nudging target mismatch JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-nudging-target-mismatch.json
- Initialization memory JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-initialization-memory.json
- Numerical integrity summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-numerical-integrity-summary.json
- Storm spillover catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-storm-spillover-catalog.json
- Sectoral dry-belt regimes JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-sectoral-dry-belt-regimes.json
- Transient eddy leakage summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-transient-eddy-leakage-summary.json
- DT sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-dt-sensitivity.json
- Grid sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-grid-sensitivity.json
- Monthly attribution climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-monthly-attribution-climatology.json
- Seasonal root-cause ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-seasonal-root-cause-ranking.json
- Attribution lag analysis JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-attribution-lag-analysis.json
- Counterfactual pathway sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-counterfactual-pathway-sensitivity.json
- Root-cause candidate ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-root-cause-candidate-ranking.json
- Coupled counterfactual matrix JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-coupled-counterfactual-matrix.json
- Coupled counterfactual ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-coupled-counterfactual-ranking.json
- Coupled counterfactual guardrails JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r6-multiyear-drift-coupled-counterfactual-guardrails.json

## Default next priorities

1. Improve storm organization and cyclone-support structure using the planetary audit, not only orographic ratios.
2. Correct ITCZ placement and subtropical dry-belt moisture partitioning with a broad hydrology/circulation cycle.
3. Run a seasonal or annual tropical-cyclone-environment audit and target the hemisphere/season that fails.

