# Planetary Realism Status

Generated: 2026-04-20T07:18:12.210Z
Preset: annual
Grid: 48x24
Model dt: 3600s
Overall verdict: **FAIL**

- Headless terrain source: native
- Terrain parity available: true

## 365-day audit

- Pass: **FAIL**
- ITCZ latitude/width: -0.288 / 25.639 deg
- Tropical convective fraction/org/mass flux: 0.089 / 0.355 / 0.00021
- Subtropical RH (N/S): 0.286 / 0.425
- North dry-belt land/ocean precip: 0.036 / 0.012 mm/hr
- North dry-belt land/ocean RH: 0.383 / 0.238
- Cross-equatorial / north-transition / north-dry vapor flux: 54.04024 / -171.21902 / -252.68168
- Subtropical subsidence drying (N/S): 0.012 / 0.009
- Tropical detrainment/anvil: 0.00135 kg/m² / 0.002
- Tropical trades (N/S): -1.845 / -0.924 m/s
- Midlatitude westerlies (N/S): 1.355 / 1.557 m/s
- Storm-track peaks (N/S): 63.75 / -26.25 deg
- Dry-belt ratios (N/S): 0.764 / 0.941
- Tropical cyclone environment counts (N/S): 0 / 0
- Global precip/cloud/tcw/max wind: 0.033 mm/hr / 0.672 / 35.141 kg/m² / 53.514 m/s
- Warnings:
  - itcz_width_unrealistic
  - south_subtropical_dry_belt_too_wet
  - north_subtropical_subsidence_too_weak
  - south_subtropical_subsidence_too_weak
  - south_storm_track_out_of_range
  - north_tropical_cyclone_seasonality_weak
  - south_tropical_cyclone_seasonality_weak
- NH warm/cool tropical cyclone environment: 0 / 0
- SH warm/cool tropical cyclone environment: 0 / 0

## Top realism gaps

- South subtropical subsidence drying too weak: actual 0.009 vs target > 0.03 (severity 0.7, horizons 365)
- North subtropical subsidence drying too weak: actual 0.012 vs target > 0.03 (severity 0.6, horizons 365)
- South subtropical dry belt too wet: actual 0.941 vs target < 0.8 (severity 0.282, horizons 365)
- South storm track misplaced: actual -26.25 vs target -65 to -30 deg (severity 0.188, horizons 365)
- ITCZ width unrealistic: actual 25.639 vs target 6-24 deg (severity 0.137, horizons 365)
- North tropical cyclone seasonality weak: actual 0 vs target > nhCoolSeasonMean * 1.15 (severity 0.067, horizons 365)
- South tropical cyclone seasonality weak: actual 0 vs target > shCoolSeasonMean * 1.15 (severity 0.067, horizons 365)

## Seasonal Root-Cause Signal

- Dominant annual family: Local large-scale maintenance (0.73558)
- Stable across sampled months: true
- Stable across sampled seasons: true
- Strongest lagged predictor: Numerical fragility (0.5633)

## Counterfactual Root-Cause Ranking

- Primary candidate: Saturation-adjustment cloud-birth ablation (-0.59861)
- Backup candidate: 35N upper import ablation (-0.60846)
- Closure ready: false

## Coupled Counterfactual Matrix

- Best coupled bundle: Import + erosion + saturation-adjustment maintenance (-0.58915)
- Exit criteria pass: false

## Rich artifacts

- Monthly climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-monthly-climatology.json
- Sample zonal profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-sample-profiles.json
- Ranked realism gaps JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-realism-gaps.json
- Moisture attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-moisture-attribution.json
- Run manifest JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-run-manifest.json
- Conservation summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-conservation-summary.json
- Restart parity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-restart-parity.json
- Surface source attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-surface-source-tracers.json
- Surface flux decomposition JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-surface-flux-decomposition.json
- NH dry-belt source sector JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-nh-dry-belt-source-sector-summary.json
- Corridor replay catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-corridor-replay-catalog.json
- Corridor step-slice attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-corridor-step-slice-attribution.json
- Corridor module-toggle deltas JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-corridor-module-toggle-deltas.json
- Thermodynamic support summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-thermodynamic-support-summary.json
- Radiative cloud maintenance JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-radiative-cloud-maintenance.json
- Boundary-layer stability profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-boundary-layer-stability-profiles.json
- Forcing opposition budget JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-forcing-opposition-budget.json
- Nudging target mismatch JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-nudging-target-mismatch.json
- Initialization memory JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-initialization-memory.json
- Numerical integrity summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-numerical-integrity-summary.json
- Storm spillover catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-storm-spillover-catalog.json
- Sectoral dry-belt regimes JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-sectoral-dry-belt-regimes.json
- Transient eddy leakage summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-transient-eddy-leakage-summary.json
- DT sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-dt-sensitivity.json
- Grid sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-grid-sensitivity.json
- Monthly attribution climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-monthly-attribution-climatology.json
- Seasonal root-cause ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-seasonal-root-cause-ranking.json
- Attribution lag analysis JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-attribution-lag-analysis.json
- Counterfactual pathway sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-counterfactual-pathway-sensitivity.json
- Root-cause candidate ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-root-cause-candidate-ranking.json
- Coupled counterfactual matrix JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-coupled-counterfactual-matrix.json
- Coupled counterfactual ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-coupled-counterfactual-ranking.json
- Coupled counterfactual guardrails JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2c-node-climo-annual-coupled-counterfactual-guardrails.json

## Default next priorities

1. Improve storm organization and cyclone-support structure using the planetary audit, not only orographic ratios.
2. Correct ITCZ placement and subtropical dry-belt moisture partitioning with a broad hydrology/circulation cycle.
3. Run a seasonal or annual tropical-cyclone-environment audit and target the hemisphere/season that fails.

