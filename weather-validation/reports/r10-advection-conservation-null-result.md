# R10 attempt — advection mass-conservation fix exposes a downstream convection deficiency

Generated: 2026-04-22
Status: **null result, documented; R10 changes reverted; branch state unchanged**

## TL;DR

The R8 diagnosis correctly identified a **real numerical bug** in
`stepAdvection5`: semi-Lagrangian bilinear interpolation was leaking
~0.418 kg/m²/day of column water globally (equivalent to ~0.017 mm/hr,
~20% of the global precipitation deficit). R10 implemented a per-level
mass-weighted (dp · cos(lat)) rescale of moisture species (qv, qc, qi,
qr) after advection, and the 60-day probe confirmed the leak closed to
≈ 7e-6 kg/m²/day — mathematically clean.

But at 365-day equilibrium the "fix" **regressed** the planetary-realism
audit from PASS to FAIL. The subtropical dry belts broke their gates, and
global precipitation dropped rather than rose. The leak was silently
subsidizing Hadley-descent drying; removing it lets vapor pool in the
subtropics. R7 remains the shipping state.

## What was tried

- **File**: `src/weather/v2/advect5.js`
- **Change**: Add params `conserveMoisture=true`, `conserveMoistureMaxScale=2.0`,
  `conserveMoistureMinScale=0.5`. Before advection, compute per-level
  mass-weighted (dp · cos(lat)) sums for each moisture species. After all
  `advectScalar` calls, compute post-advection per-level sums and rescale
  each level to preserve the pre-advection integral. Safety rail clamps
  scale to [0.5, 2.0] and skips out-of-range levels. Theta and winds
  untouched.
- Two intermediate iterations were discarded:
  - V1 (volume-weighted only) **flipped the leak sign** (+0.35 kg/m²/day)
    because it didn't match the mass-weighted integration in
    `_captureConservationSnapshot`.
  - V2 (global mass-weighted, single scale) closed the leak but dropped
    precip 46% in the short probe by inflating upper-tropospheric vapor.
  - V3 (per-level mass-weighted, current) is mathematically correct and
    structurally preserving — but still regresses at 365 days.

## Probes

### 60-day short probe (`scripts/agent/r10-advection-conservation-probe.mjs`)

```
Baseline (R7, pre-R10):   stepAdvection5 ΔColumn = -0.418 kg/m²/day
With V3 fix:              stepAdvection5 ΔColumn ≈ +7e-6 kg/m²/day  ✓
Short-probe precip:       0.627 → 0.398 mm/day  (wetter atmosphere, less rain)
Short-probe TCW:          30.2 → 35.9 kg/m²     (vapor pooling)
```

The short probe **warned** of the regression; we let the 365-day audit
run to confirm at equilibrium.

### 365-day annual planetary-realism audit (`preset: annual`)

| Metric                               | R7 baseline | R10 trial  | Gate      |
|--------------------------------------|-------------|------------|-----------|
| Overall verdict                      | **PASS**    | **FAIL**   | —         |
| Warnings                             | 0           | **3**      | 0         |
| Annual-mean SH dry-belt ratio        | 0.787       | **1.018**  | < 0.8     |
| Annual-mean NH dry-belt ratio        | 0.759       | **0.882**  | < 0.8     |
| ITCZ width (deg)                     | ~22         | 25.8       | 6–24      |
| Global precipitation (mm/hr)         | 0.031       | **0.020**  | ≥ 0.03    |
| Global TCW (kg/m²)                   | 30.2        | 38.6       | ~24 Earth |
| Tropical convective fraction         | 0.125       | 0.172      | 0.35–0.55 |
| `stepAdvection5` ΔColumn (kg/m²/day) | -0.418      | **+7e-6**  | ≈0        |

The advection leak closure is real. Everything downstream regressed.

### Per-module conservation budget (annual, R10)

```
stepSurface2D5   ΔColumn = +0.845 kg/m²/day  (was +1.108)
stepAdvection5   ΔColumn ≈ +0.000 kg/m²/day  (was -0.418) ← FIX WORKS
stepVertical5    ΔColumn = -0.315 kg/m²/day  (was +0.167) ← flipped sign
stepMicrophysics ΔColumn = -0.409 kg/m²/day  (was -0.768) ← weaker precip
stepNudging5     ΔColumn = -0.024 kg/m²/day  (was -0.015)
Net              ΔColumn = +0.097 kg/m²/day  (was +0.074)  ← STILL growing
```

Model is *still* not at full equilibrium at 365 days, and TCW drifts
upward **faster** than R7 baseline (+35 kg/m²/yr vs +27 kg/m²/yr). The
advection correction injects moisture back into the column that
microphysics can't precipitate out fast enough.

## Root cause of the regression

The non-conservative advection leak was an unintended **drying
mechanism** in the subtropics:

1. Semi-Lagrangian advection with bilinear interpolation systematically
   loses mass in regions of sharp horizontal gradients — most strongly in
   the **subtropical subsidence zones** where the Hadley descending
   branch meets humid mid-latitudes and creates steep moisture
   gradients.
2. That loss happened to keep NH/SH dry-belt ratios below the 0.8 gate
   (NH = 0.76, SH = 0.79 — margin 0.04 and 0.01 respectively).
3. When the leak is mathematically corrected, vapor that would have been
   destroyed instead stays in the subtropical column. The dry-belt
   ratios rise (NH 0.88, SH 1.02), both gates break.
4. The subtropical vapor can't precipitate efficiently because the
   convective scheme requires organized ascent (R8 diagnosis H-convection-weak:
   `ascentSupport > 0.05` threshold is rarely crossed in the subtropics
   where ω_low > 0). So vapor pools rather than raining.
5. Meanwhile tropical precip drops because the column is globally
   wetter but the scheme is self-limiting at low activity — same root
   cause as R8's failed parameter tune.

## Why we didn't see this in the R7 audit

R7's conservation-summary data showed the -0.418 kg/m²/day advection
leak, and we correctly flagged it as a "real numerical bug". What we
**didn't** see was that all the downstream gates had silently re-tuned
themselves around the leak. The R7 audit was passing *because of* the
leak, not despite it. A mathematically cleaner model doesn't
automatically mean a better climate — the error-canceling is real.

This is the classic **"cancellation-of-errors" trap** in climate model
tuning: multiple known-wrong terms can produce a realistic answer in
combination, and fixing one in isolation can make things worse.

## Implications

R10 joins R8 in the null-result ledger. Both null results **confirm
H-convection-weak** as the dominant constraint:

- R8 tuning failed because the convective scheme is upstream-constrained
  on organized ascent (Hadley ω_low ≈ +0.009 Pa/s in deep tropics).
- R10 conservation fix failed because the extra vapor it restores has
  nowhere to precipitate — same upstream constraint, different path.

**Until the Hadley cell is strengthened, no downstream fix alone will
close the 4× precip gap.**

## What would have worked

A correct R10 would require re-tuning downstream consumers
simultaneously with the advection fix. Minimum viable bundle:

- R10 advection conservation (this attempt)
- **+ R9: Hadley ascent re-forcing** (strengthen tropical ω_low to match
  Earth's ~-0.04 Pa/s)
- **+ subtropical subsidence drying re-tune** (absorb the +0.42 kg/m²/day
  that used to leak out of advection, via stronger subsidence drying in
  the BL or enhanced boundary-layer cloud sink)
- Full audit to verify all gates

That is a 3–5 sub-phase program, not a single-session change. The R10
advection code in stash `stash@{0}` can be recovered as a building
block when R9 lands.

## Revert

- `git stash push src/weather/v2/advect5.js` (saved as `stash@{0}`)
- Working tree on `codex/world-class-weather-loop` is back at R7 state
  (HEAD `9c2e7a0`, no modifications).
- Probe script `scripts/agent/r10-advection-conservation-probe.mjs` kept
  as an untracked artifact for future R9+R10 bundled re-attempts.

## Artifacts

- `scripts/agent/r10-advection-conservation-probe.mjs` — 60-day probe
  (untracked, recommended to commit alongside this memo)
- `weather-validation/reports/planetary-realism-status*.json` — 365-day
  R10 audit outputs (untracked; overwrite prior contents)
- R8 priors: `814ee5c`, `a9d64af`, `9c2e7a0`

## Next phase

**R9: Hadley-cell re-forcing probe.** Per the R8 diagnosis, this is the
dominant root cause of the global precip deficit. Both R8 (parameter
tuning) and R10 (conservation fix) have now ruled themselves out as
sufficient stand-alone fixes. R9 is now the critical path.

Proposed R9 structure:
- **R9-α (diagnose)**: Measure radiative/SST forcing-gradient that Earth
  uses to drive the Hadley cell (TOA SW absorption latitudinal profile,
  SST meridional gradient, surface-flux latitude structure). Compare to
  our model's structure. Locate where the forcing-gradient is weak.
- **R9-β (experiment)**: Add a guarded experiment flag (e.g.
  `enableHadleyForcingExperiment`) that patches the identified gap
  (likely in `radiation.js` or `surface2d5.js`).
- **R9-γ (rebalance)**: Re-verify all R1–R7 gates with the experiment
  flag on. Expect to need compensating tweaks in subtropical-subsidence
  strength and convective trigger thresholds.
- **R9-δ (bundled R9+R10)**: Once R9 strengthens tropical ascent, revisit
  R10 advection conservation with the stronger circulation absorbing the
  newly conserved vapor into precipitation.

Until R9 lands, **R7 is the shipping state**.
