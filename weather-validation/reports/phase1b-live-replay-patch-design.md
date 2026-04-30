# Phase 1B Live Replay Patch Design

The next `stepVertical5` patch must be designed against the exact current live replay state, not the older static alignment mass target.

## Why

- Old mass contract stale: true
- Support family still valid: true
- Old mismatched gates: staleCarryoverDominance, previousStepResidualUpperCloud

## Live Trigger To Design Against

- freshPotentialTarget: 0.21196
- freshOrganizedSupport: 0.19656
- freshSubtropicalSuppression: 0.78121
- staleCarryoverDominance: 0
- previousStepResidualUpperCloudKgM2: 2.39787

## Recommended Gate Envelope

- subtropicalSuppressionMin: 0.74243
- organizedSupportMax: 0.22504
- freshPotentialTargetMax: 0.24341
- staleCarryoverDominanceMin: null
- verticalCarryInputDominanceMin: 0.93006
- previousStepResidualUpperCloudMinKgM2: 2.27798
- representation shift: At the exact live handoff, the retained reservoir is expressed through vertical input and carry-surviving mass while carriedOverUpperCloudMass has already rolled to zero. Replace the old stale-carryover-dominance gate with a vertical carry-surviving-to-input dominance gate.

## Live Handoff Target

- upperCloudPathKgM2: 2.39787 -> 0
- carriedOverUpperCloudMassKgM2: 0 -> 0
- upperCloudStaleMassKgM2: 0 -> 0
- upperCloudAppliedErosionMassKgM2: 0.05035 -> 2.44822
- upperCloudBlockedErosionMassKgM2: 0 -> 0
- verticalUpperCloudCarrySurvivingMassKgM2: 2.34753 -> 0
- verticalUpperCloudAppliedErosionMassKgM2: 0.05035 -> 2.44822
- verticalUpperCloudHandedToMicrophysicsMassKgM2: 2.39787 -> 0

## Stability Contract

- verticalUpperCloudInputMassKgM2: 2.39787
- verticalUpperCloudResolvedBirthMassKgM2: 0.05035
- verticalUpperCloudConvectiveBirthMassKgM2: 0
- lowLevelOmegaEffectiveDiagPaS: -0.12879
- lowLevelMoistureConvergenceDiagS_1: 0.00000209
- convectivePotential: 0.20726
- convectiveOrganization: 0.0372
- convectiveMassFluxKgM2S: 0
- convectiveDetrainmentMassKgM2: 0
- convectiveAnvilSource: 0

## Keep/Reject Rule

- Reject the next live patch if it still keys off post-handoff carriedOverUpperCloudMass dominance instead of the live carry-surviving-to-input dominance, or if it fails to reduce the exact live replay carry-surviving and handed-to-microphysics masses by the reconciled deltas.

