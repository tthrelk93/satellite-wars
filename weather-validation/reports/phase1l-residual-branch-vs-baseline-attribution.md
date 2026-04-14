# Phase 1L Residual Branch-Versus-Baseline Attribution

## Scope

- Trusted baseline: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json`
- Current branch compare: `/tmp/satellite-wars-phase1l-current-branch.json`
- Preset: `quick`
- Seed: `12345`
- Target day: `30`

## Verdict

- Dominant residual family: `circulation_side_rebound`
- Read: Residual mismatch is coupled between Circulation-side rebound and Broadened tropical response. The next patch lane should start with Phase 1M: Circulation rebound lane but keep both families in view.
- Recommended next patch lane: Target circulation partition and wind response in [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) and [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js).

## Climate Guardrail Deltas

- `itczWidthDeg`: `23.646 -> 25.874` (delta `2.228`)
- `subtropicalDryNorthRatio`: `1.1 -> 1.524` (delta `0.424`)
- `subtropicalDrySouthRatio`: `0.519 -> 1.194` (delta `0.675`)
- `subtropicalSubsidenceNorthMean`: `0.065 -> 0.086` (delta `0.021`)
- `subtropicalSubsidenceSouthMean`: `0.038 -> 0.032` (delta `-0.006`)
- `midlatitudeWesterliesNorthU10Ms`: `1.192 -> 0.531` (delta `-0.661`)
- `midlatitudeWesterliesSouthU10Ms`: `0.943 -> 0.851` (delta `-0.092`)
- `tropicalConvectiveOrganization`: `0.331 -> 0.343` (delta `0.012`)
- `tropicalConvectiveMassFluxKgM2S`: `0.0009 -> 0.0009` (delta `0`)
- `equatorialPrecipMeanMmHr`: `0.13 -> 0.138` (delta `0.008`)

## Residual Family Ranking

- `circulation_side_rebound` score `0.31725`
  - `midlatitudeWesterliesNorthU10Ms`: `1.192 -> 0.531` (dir-score `0.76727`)
  - `midlatitudeWesterliesSouthU10Ms`: `0.943 -> 0.851` (dir-score `0.10256`)
  - `northDryBeltSubsidenceDryingMeanFrac`: `0.05597 -> 0.06337` (dir-score `-0.12389`)
  - `southDryBeltSubsidenceDryingMeanFrac`: `0.03872 -> 0.03356` (dir-score `0.1428`)
- `broadened_tropical_response` score `0.24192`
  - `itczWidthDeg`: `23.646 -> 25.874` (dir-score `0.08998`)
  - `northTransitionPrecipMeanMmHr`: `0.19276 -> 0.159` (dir-score `-0.19192`)
  - `southTransitionPrecipMeanMmHr`: `0.07753 -> 0.14019` (dir-score `0.57566`)
  - `subtropicalDryNorthRatio`: `1.1 -> 1.524` (dir-score `0.32317`)
- `marine_maintenance_residual` score `0.11325`
  - `northDryBeltPrecipMeanMmHr`: `0.13862 -> 0.23888` (dir-score `0.53119`)
  - `northDryBeltCloudMeanFrac`: `0.74023 -> 0.79197` (dir-score `0.06754`)
  - `northDryBeltLowerRhMeanFrac`: `0.48669 -> 0.52968` (dir-score `0.08458`)
  - `northDryBeltTcwMeanKgM2`: `36.29703 -> 34.28875` (dir-score `-0.0569`)
- `upper_cloud_clouddeck_residual` score `0.00346`
  - `northDryBeltCloudMeanFrac`: `0.74023 -> 0.79197` (dir-score `0.06754`)
  - `northDryBeltAnvilPersistenceMeanFrac`: `0.00296 -> 0.00292` (dir-score `-0.01285`)
  - `northDryBeltTcwMeanKgM2`: `36.29703 -> 34.28875` (dir-score `-0.0569`)

## Shared Profile-Band Deltas

- `precipRateMmHr`
  - Equatorial core: `0.103 -> 0.1215` (delta `0.0185`)
  - North transition: `0.19276 -> 0.159` (delta `-0.03376`)
  - North dry belt: `0.13862 -> 0.23888` (delta `0.10026`)
  - South transition: `0.07753 -> 0.14019` (delta `0.06267`)
  - South dry belt: `0.06282 -> 0.1848` (delta `0.12198`)
- `cloudTotalFraction`
  - Equatorial core: `0.7625 -> 0.8005` (delta `0.038`)
  - North transition: `0.67774 -> 0.7193` (delta `0.04156`)
  - North dry belt: `0.74023 -> 0.79197` (delta `0.05175`)
  - South transition: `0.51019 -> 0.7359` (delta `0.2257`)
  - South dry belt: `0.46866 -> 0.7531` (delta `0.28444`)
- `convectiveOrganization`
  - Equatorial core: `0.41 -> 0.421` (delta `0.011`)
  - North transition: `0.1577 -> 0.1537` (delta `-0.004`)
  - North dry belt: `0.0706 -> 0.06549` (delta `-0.00511`)
  - South transition: `0.12228 -> 0.14342` (delta `0.02114`)
  - South dry belt: `0.03343 -> 0.04876` (delta `0.01533`)
- `lowerTroposphericRhFrac`
  - Equatorial core: `0.328 -> 0.4795` (delta `0.1515`)
  - North transition: `0.3786 -> 0.38651` (delta `0.00791`)
  - North dry belt: `0.48669 -> 0.52968` (delta `0.04298`)
  - South transition: `0.30391 -> 0.62298` (delta `0.31907`)
  - South dry belt: `0.28894 -> 0.62121` (delta `0.33226`)
- `wind10mU`
  - Equatorial core: `-0.5225 -> -0.5505` (delta `-0.028`)
  - North transition: `-0.78813 -> -0.74211` (delta `0.04602`)
  - North dry belt: `1.96085 -> 0.66136` (delta `-1.29949`)
  - South transition: `-0.32828 -> -0.37219` (delta `-0.04391`)
  - South dry belt: `-0.11382 -> -0.21194` (delta `-0.09812`)

## Current-Branch Corroborating Diagnostics

- `northDryBeltOceanLargeScaleCondensationMeanKgM2 = 0.1526`
- `northDryBeltOceanMarineCondensationMeanKgM2 = 0.1526`
- `northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2 = 0.04238`
- `northDryBeltOceanSoftLiveGateHitMean = 3.55832`
- `northDryBeltOceanSoftLiveGateSelectorSupportMeanFrac = 0.56672`
- `northDryBeltImportedAnvilPersistenceMeanKgM2 = 0.22232`
- `northDryBeltWeakErosionCloudSurvivalMeanKgM2 = 0.2204`
- `northDryBeltCarriedOverUpperCloudMeanKgM2 = 0.22249`
- `northDryBeltUpperCloudPathMeanKgM2 = 0.20978`
