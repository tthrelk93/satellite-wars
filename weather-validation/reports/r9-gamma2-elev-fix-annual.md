# Planetary Realism Status

Generated: 2026-04-23T07:19:07.110Z
Preset: annual
Grid: 48x24
Model dt: 3600s
Overall verdict: **FAIL**

- Headless terrain source: native
- Terrain parity available: true

## 365-day audit

- Pass: **FAIL**
- ITCZ latitude/width: 0.747 / 23.957 deg
- Tropical convective fraction/org/mass flux: 0.115 / 0.355 / 0.00029
- Subtropical RH (N/S): 0.291 / 0.375
- North dry-belt land/ocean precip: 0.03 / 0.012 mm/hr
- North dry-belt land/ocean RH: 0.358 / 0.258
- Cross-equatorial / north-transition / north-dry vapor flux: 53.8594 / -157.16796 / -232.5235
- Subtropical subsidence drying (N/S): 0.049 / 0.044
- Tropical detrainment/anvil: 0.00106 kg/m² / 0.002
- Tropical trades (N/S): -1.848 / -0.923 m/s
- Midlatitude westerlies (N/S): 1.361 / 1.555 m/s
- Storm-track peaks (N/S): 63.75 / -63.75 deg
- Dry-belt ratios (N/S): 0.637 / 0.628
- Annual-mean storm-track (N/S): 63.75 / -63.75 deg  ← gate-used
- Annual-mean dry-belt ratios (N/S): 0.529 / 0.829  ← gate-used
- Tropical cyclone environment counts (N/S): 11 / 7
- Global precip/cloud/tcw/max wind: 0.034 mm/hr / 0.655 / 32.409 kg/m² / 49.636 m/s
- Warnings:
  - south_subtropical_dry_belt_too_wet
- NH warm/cool tropical cyclone environment: 18 / 11.61
- SH warm/cool tropical cyclone environment: 4.943 / 2.5

## Top realism gaps

- South subtropical dry belt too wet: actual 0.829 vs target < 0.8 (severity 0.058, horizons 365)

## Seasonal Root-Cause Signal

- Dominant annual family: Local large-scale maintenance (0.67705)
- Stable across sampled months: true
- Stable across sampled seasons: true
- Strongest lagged predictor: Imported cloud persistence (0.36437)

## Rich artifacts

- Monthly climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-monthly-climatology.json
- Sample zonal profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-sample-profiles.json
- Ranked realism gaps JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-realism-gaps.json
- Moisture attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-moisture-attribution.json
- Run manifest JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-run-manifest.json
- Conservation summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-conservation-summary.json
- Restart parity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-restart-parity.json
- Surface source attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-surface-source-tracers.json
- Surface flux decomposition JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-surface-flux-decomposition.json
- NH dry-belt source sector JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-nh-dry-belt-source-sector-summary.json
- Corridor replay catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-corridor-replay-catalog.json
- Corridor step-slice attribution JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-corridor-step-slice-attribution.json
- Corridor module-toggle deltas JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-corridor-module-toggle-deltas.json
- Thermodynamic support summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-thermodynamic-support-summary.json
- Radiative cloud maintenance JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-radiative-cloud-maintenance.json
- Boundary-layer stability profiles JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-boundary-layer-stability-profiles.json
- Forcing opposition budget JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-forcing-opposition-budget.json
- Nudging target mismatch JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-nudging-target-mismatch.json
- Initialization memory JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-initialization-memory.json
- Numerical integrity summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-numerical-integrity-summary.json
- Storm spillover catalog JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-storm-spillover-catalog.json
- Sectoral dry-belt regimes JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-sectoral-dry-belt-regimes.json
- Transient eddy leakage summary JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-transient-eddy-leakage-summary.json
- DT sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-dt-sensitivity.json
- Grid sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-grid-sensitivity.json
- Monthly attribution climatology JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-monthly-attribution-climatology.json
- Seasonal root-cause ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-seasonal-root-cause-ranking.json
- Attribution lag analysis JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-attribution-lag-analysis.json
- Counterfactual pathway sensitivity JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-counterfactual-pathway-sensitivity.json
- Root-cause candidate ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-root-cause-candidate-ranking.json
- Coupled counterfactual matrix JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-coupled-counterfactual-matrix.json
- Coupled counterfactual ranking JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-coupled-counterfactual-ranking.json
- Coupled counterfactual guardrails JSON: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/planetary-realism-status-coupled-counterfactual-guardrails.json

## Default next priorities

1. Correct ITCZ placement and subtropical dry-belt moisture partitioning with a broad hydrology/circulation cycle.

