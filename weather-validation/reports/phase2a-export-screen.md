# Phase 2A Export Screen

Date: 2026-04-10

## Purpose

Record the first integrated `Phase 2A` attempt to finish the last unresolved Phase-1 blocker by strengthening organized tropical convection and upper-level outflow.

## Kept baseline before Phase 2A

Reference artifact:
- `weather-validation/output/phase1-hadley-second-pass-restore-v4.json`

Day-30 kept baseline:
- `itczWidthDeg = 23.646`
- `subtropicalDryNorthRatio = 1.100`
- `subtropicalDrySouthRatio = 0.519`
- `subtropicalSubsidenceNorthMean = 0.065`
- `subtropicalSubsidenceSouthMean = 0.038`
- `tropicalConvectiveOrganization = 0.331`
- `tropicalConvectiveMassFluxKgM2S = 0.00090`
- `upperDetrainmentTropicalKgM2 = 0.00371`
- `tropicalAnvilPersistenceFrac = 0.016`

## What was attempted

The rejected Phase-2A package tried to:
- reduce entrainment in strongly organized tropical columns
- raise detrainment height and anvil persistence
- reduce local plume rainout in organized tropical export columns
- make subtropical drying respond more directly to actual tropical export instead of only generic convective activity
- let microphysics preserve more cloud in columns with stronger organized outflow

## What improved

The integrated package really did strengthen some export-side signals:
- tropical convective organization increased into roughly `0.359-0.366`
- tropical convective mass flux increased into roughly `0.00090-0.00104`
- upper detrainment increased into roughly `0.00370-0.00548`
- subtropical subsidence became much stronger than the kept baseline in some screened variants

## Why it was rejected

None of the integrated variants beat the kept baseline on the actual blocker:
- `subtropicalDryNorthRatio`

Representative rejected results:
- `/tmp/phase2a-quick-audit.json`
- `/tmp/phase2a-quick-audit-v2.json`
- `/tmp/phase2a-quick-audit-v3.json`

The common failure pattern was:
- upper-level export improved
- subtropical subsidence often improved
- but the north dry belt stayed wetter than the kept baseline
- and some variants also widened or north-shifted the ITCZ enough to make the real metric worse

In short:
- stronger export alone was not enough
- the package tended to weaken or redistribute equatorial rainfall in a way that hurt the dry-belt ratio
- a better export pathway is necessary, but it has to preserve or sharpen equatorial precipitation concentration at the same time

## Key lesson

The remaining blocker is not just “more outflow” or “more subsidence.”

The next valid Phase-2A package must do both:
- preserve or strengthen concentrated equatorial deep-convective rainfall
- reduce diffuse `12-22 deg` tropical/subtropical precipitation spillover

If a package raises detrainment/anvil metrics but lowers equatorial precipitation efficiency or broadens the tropical rain shield, it is not a win.

## Recommended next move

Treat the next Phase-2A attempt as a split-rainfall problem:
- keep organized tropical export strong aloft
- but separate deep-core convective rain efficiency from stratiform/anvil retention
- do not let export improvements reduce equatorial precipitation too much
- target the `12-22 deg` transition band explicitly, but only if the equatorial core remains strong

Operational rule:
- compare every new Phase-2A package directly against `phase1-hadley-second-pass-restore-v4.json`
- reject it immediately if `subtropicalDryNorthRatio` does not beat `1.100`
