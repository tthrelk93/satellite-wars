# Phase 1F Maintenance-Loop Patch Design

## Decision

- Next phase: `Phase 1G: implement regime-selective saturation-adjustment maintenance patch`
- Exit criteria pass: `true`

## Proof Answers

- Added large-scale condensation origin: The residual added large-scale condensation is ocean-side, not land-side.
- Humidification path: The maintenance loop is not being driven by stronger surface evaporation, stronger import, or stronger radiative support. The remaining humidification path is structural marine moisture retention feeding saturation adjustment.
- Local vs circulation assessment: The remaining blocker is better explained by local maintenance than by the previously dominant import/retention owner. Circulation remains biased on the branch, but the next patch should target local maintenance first.

## Patch Target

- Primary module: `stepMicrophysics5`
- Primary file: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js
- Primary region: lines `313-345`
- Why: This branch condenses all supersaturated vapor immediately, but does not currently suppress condensation in weak-engine, subtropically suppressed marine columns. After the carry-input patch reduces imported cloud, this is the one pathway that still moves in the wrong direction.
- Secondary module: `stepVertical5`
- Secondary file: /Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js
- Secondary region: lines `1478-1498`
- Why: This region already computes the regime information that distinguishes weakly ventilated subtropical maintenance columns. It should provide the microphysics gating signal, but should not be the first direct climate lever again.

## Predicted Signature

- Should decrease `northDryBeltLargeScaleCondensationMeanKgM2` to < 0.16079 from current 0.17069
- Should decrease `northDryBeltOceanLargeScaleCondensationMeanKgM2` to < 0.18314 from current 0.19722
- Should decrease `northDryBeltBoundaryLayerRhMeanFrac` to < 0.61368
- Should decrease `northDryBeltMidTroposphereRhMeanFrac` to < 0.44885
- Should decrease `itczWidthDeg` to < 26.415
- Should decrease `subtropicalDryNorthRatio` to < 1.704
- Should decrease `subtropicalDrySouthRatio` to < 1.296
- Should hold/improve `northDryBeltImportedAnvilPersistenceMeanKgM2` at <= 0.21583
- Should hold/improve `northDryBeltWeakErosionCloudSurvivalMeanKgM2` at <= 0.21337
- Should hold/improve `midlatitudeWesterliesNorthU10Ms` at >= 0.532
- Should hold/improve `midlatitudeWesterliesSouthU10Ms` at >= 0.851

- Anti-pattern: Do not globally suppress saturation-adjustment condensation. Strong/organized ascent bins still dominate cumulative cloud birth, so a blanket microphysics reduction would likely damage the tropical engine.

## Key Evidence

- `largeScaleCondensation`: `0.16079 -> 0.17069` (delta `0.0099`)
- `oceanLargeScaleCondensation`: `0.18314 -> 0.19722` (delta `0.01408`)
- `landLargeScaleCondensation`: `0.10854 -> 0.10867` (delta `0.00013`)
- `importedAnvilPersistence`: `0.24428 -> 0.21583` (delta `-0.02845`)
- `carriedOverUpperCloud`: `0.24445 -> 0.21598` (delta `-0.02847`)
- `weakErosionCloudSurvival`: `0.24133 -> 0.21337` (delta `-0.02796`)
- `surfaceOceanEvaporation`: `0.241 -> 0.239` (delta `-0.002`)
- `surfaceLandEvaporation`: `0.013 -> 0.013` (delta `0`)
- `boundaryLayerRh`: `0.61436 -> 0.61368` (delta `-0.00068`)
- `midTroposphereRh`: `0.45478 -> 0.44885` (delta `-0.00593`)
- `upperTroposphericImport`: `6.308 -> 6.09383` (delta `-0.21417`)
- `radiativePersistenceSupport`: `46.13692 -> 43.74402` (delta `-2.3929`)
- `weakAscentCloudBirthMass`: `4574.27741 -> 4573.61148` (delta `-0.66593`)
- `strongAscentCloudBirthMass`: `25016.77624 -> 24820.05447` (delta `-196.72177`)
