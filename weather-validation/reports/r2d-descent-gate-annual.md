# Planetary Realism Status

Generated: 2026-04-20T18:04:33.097Z
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

## Top realism gaps

- South storm track misplaced: actual -26.25 vs target -65 to -30 deg (severity 0.188, horizons 365)
- South subtropical dry belt too wet: actual 0.885 vs target < 0.8 (severity 0.17, horizons 365)
- North tropical cyclone seasonality weak: actual 0 vs target > nhCoolSeasonMean * 1.15 (severity 0.067, horizons 365)
- South tropical cyclone seasonality weak: actual 0 vs target > shCoolSeasonMean * 1.15 (severity 0.067, horizons 365)

## Seasonal Root-Cause Signal

- Dominant annual family: Local large-scale maintenance (0.75071)
- Stable across sampled months: true
- Stable across sampled seasons: true
- Strongest lagged predictor: Radiative/thermodynamic support (0.35136)

## Counterfactual Root-Cause Ranking

- Primary candidate: Radiative maintenance ablation (0.01476)
- Backup candidate: 35N upper import ablation (0.05351)
- Closure ready: true

## Coupled Counterfactual Matrix

- Best coupled bundle: Import + erosion + saturation-adjustment maintenance (0.14477)
- Exit criteria pass: false

## Rich artifacts

- Monthly climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-monthly-climatology.json
- Sample zonal profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-sample-profiles.json
- Ranked realism gaps JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-realism-gaps.json
- Moisture attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-moisture-attribution.json
- Run manifest JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-run-manifest.json
- Conservation summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-conservation-summary.json
- Restart parity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-restart-parity.json
- Surface source attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-surface-source-tracers.json
- Surface flux decomposition JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-surface-flux-decomposition.json
- NH dry-belt source sector JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-nh-dry-belt-source-sector-summary.json
- Corridor replay catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-corridor-replay-catalog.json
- Corridor step-slice attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-corridor-step-slice-attribution.json
- Corridor module-toggle deltas JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-corridor-module-toggle-deltas.json
- Thermodynamic support summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-thermodynamic-support-summary.json
- Radiative cloud maintenance JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-radiative-cloud-maintenance.json
- Boundary-layer stability profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-boundary-layer-stability-profiles.json
- Forcing opposition budget JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-forcing-opposition-budget.json
- Nudging target mismatch JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-nudging-target-mismatch.json
- Initialization memory JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-initialization-memory.json
- Numerical integrity summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-numerical-integrity-summary.json
- Storm spillover catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-storm-spillover-catalog.json
- Sectoral dry-belt regimes JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-sectoral-dry-belt-regimes.json
- Transient eddy leakage summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-transient-eddy-leakage-summary.json
- DT sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-dt-sensitivity.json
- Grid sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-grid-sensitivity.json
- Monthly attribution climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-monthly-attribution-climatology.json
- Seasonal root-cause ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-seasonal-root-cause-ranking.json
- Attribution lag analysis JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-attribution-lag-analysis.json
- Counterfactual pathway sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-counterfactual-pathway-sensitivity.json
- Root-cause candidate ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-root-cause-candidate-ranking.json
- Coupled counterfactual matrix JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-coupled-counterfactual-matrix.json
- Coupled counterfactual ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-coupled-counterfactual-ranking.json
- Coupled counterfactual guardrails JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/r2d-descent-gate-annual-coupled-counterfactual-guardrails.json

## Default next priorities

1. Improve storm organization and cyclone-support structure using the planetary audit, not only orographic ratios.
2. Correct ITCZ placement and subtropical dry-belt moisture partitioning with a broad hydrology/circulation cycle.
3. Run a seasonal or annual tropical-cyclone-environment audit and target the hemisphere/season that fails.

