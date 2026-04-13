# Phase 1B Live Replay Patch Design

The next `stepVertical5` patch must be designed against the exact current live replay state, not the older static alignment mass target.

## Why

- Old mass contract stale: true
- Support family still valid: true
- Old mismatched gates: staleCarryoverDominance

## Live Trigger To Design Against

- freshPotentialTarget: 0.21166
- freshOrganizedSupport: 0.19569
- freshSubtropicalSuppression: 0.78151
- staleCarryoverDominance: 0
- previousStepResidualUpperCloudKgM2: 4.56883

## Recommended Gate Envelope

- subtropicalSuppressionMin: 0.74243
- organizedSupportMax: 0.22504
- freshPotentialTargetMax: 0.24341
- staleCarryoverDominanceMin: null
- verticalCarryInputDominanceMin: 0.95
- previousStepResidualUpperCloudMinKgM2: 4.40574
- representation shift: At the exact live handoff, the retained reservoir is expressed through vertical input and carry-surviving mass while carriedOverUpperCloudMass has already rolled to zero. Replace the old stale-carryover-dominance gate with a vertical carry-surviving-to-input dominance gate.

## Live Handoff Target

- upperCloudPathKgM2: 4.56883 -> 0
- carriedOverUpperCloudMassKgM2: 0 -> 0
- upperCloudStaleMassKgM2: 0 -> 0
- upperCloudAppliedErosionMassKgM2: 0 -> 4.56883
- upperCloudBlockedErosionMassKgM2: 0 -> 0
- verticalUpperCloudCarrySurvivingMassKgM2: 4.56883 -> 0
- verticalUpperCloudAppliedErosionMassKgM2: 0 -> 4.56883
- verticalUpperCloudHandedToMicrophysicsMassKgM2: 4.56883 -> 0

## Stability Contract

- verticalUpperCloudInputMassKgM2: 4.56883
- verticalUpperCloudResolvedBirthMassKgM2: 0.04342
- verticalUpperCloudConvectiveBirthMassKgM2: 0
- lowLevelOmegaEffectiveDiagPaS: -0.12755
- lowLevelMoistureConvergenceDiagS_1: 0.00000211
- convectivePotential: 0.20712
- convectiveOrganization: 0.03715
- convectiveMassFluxKgM2S: 0
- convectiveDetrainmentMassKgM2: 0
- convectiveAnvilSource: 0

## Keep/Reject Rule

- Reject the next live patch if it still keys off post-handoff carriedOverUpperCloudMass dominance instead of the live carry-surviving-to-input dominance, or if it fails to reduce the exact live replay carry-surviving and handed-to-microphysics masses by the reconciled deltas.

