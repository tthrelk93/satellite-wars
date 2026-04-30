# Phase 1ZU Bilateral Balance Patch Design

## Verdict

- weak_hemi_crosshemi_floor_overhang
- Next phase: Phase 1ZV: Implement Weak-Hemisphere Cross-Hemi Floor Taper Patch
- Do not add a south-local humidity or omega patch. The smallest evidence-backed balance fix is to taper the weak-hemisphere cross-hemi floor in the subtropical source-driver path when the northside leak gate is live, rather than letting the south transition inherit an over-high floor.

## Why Bilateral Balance Is The Right Lane

- northside leak penalty at `11.25°N`: `0.06225`
- southside leak penalty at `-11.25°`: `0`
- north local / mean tropical source: `0.16841` / `0.10765`
- south local / mean tropical source: `0.04689` / `0.10765`
- south source-driver floor: `0.06244`
- south cross-hemi floor share: `0.24904`
- north cross-hemi floor share: `0`
- south weak-hemi fraction: `0.56444`

## Overhang Analysis

- south effective floor fraction: `0.58003`
- south neutral floor fraction: `0.43558`
- weak-hemi floor overhang: `0.14445`
- north suppression net condensation delta: `-0.03065`
- south mirror net condensation delta: `0.02957`
- cross-equatorial vapor-flux delta: `-0.21439`

## Patch Contract

- keep: keep the northside leak-risk gate and bilateral equatorial-edge geometry available behind their runtime toggles
- keep: keep the south-edge stabilization lane and target-entry exclusion unchanged for the next implementation
- change: patch the subtropical source-driver floor in vertical5.js rather than adding a south-local humidity or omega sink
- change: compute a weak-hemisphere-only taper from max(0, effectiveCrossHemiFloorFrac - localHemiSource / meanTropicalSource)
- change: apply that taper only where the hemisphere is weak, the cross-hemi floor share is positive, and the northside leak gate is live
- change: cap the live taper near the current overhang magnitude (~0.144) before considering any stronger amplitude
- avoid: do not globally reduce subtropicalSubsidenceCrossHemiFloorFrac because the north transition already has zero floor share
- avoid: do not add a south-local TCW/RH/omega patch because Phase 1ZT showed no meaningful local recharge signal
