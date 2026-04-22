# R8 attempt — parameter tuning is not sufficient to close the global precip gap

Generated: 2026-04-21
Status: **null result, documented; branch state unchanged**

## TL;DR

Four separate parameter levers in the convective-outcome chain were tuned
individually at 180-day spinup and measured via the R8 budget probe.
**All four produced ≤1% change in global P.**  R7 remains the shipping
state: all offline realism gates pass, 0 warnings.  Closing the 4×
global-precip gap requires structural work beyond single-session
parameter tuning.

## What was tried

Baseline at 180-day spinup: Global P = 0.030 mm/hr, Tropical P = 0.021 mm/hr.

| # | Parameter             | Baseline → tried | Global P after  | Tropical P after | Δ    |
|---|-----------------------|------------------|-----------------|------------------|------|
| 1 | `convMinPotential`    | 0.15 → 0.08      | 0.0304 mm/hr    | 0.0212 mm/hr     | 0.0%  |
|   | `convMinOrganization` | 0.18 → 0.10      |                 |                  |       |
| 2 | `activity > 0.22`     | → `> 0.10`       | 0.0304 mm/hr    | 0.0214 mm/hr     | +0.1% |
| 3 | `convRainoutBase`     | 0.28 → 0.45      | 0.0304 mm/hr    | 0.0213 mm/hr     | 0.0%  |
| 4 | `mu0`                 | 0.05 → 0.10      | 0.0303 mm/hr    | 0.0213 mm/hr     | 0.0%  |

Tropical convMask firing fraction (convection-trigger probe): baseline
10.4%, after #1: 11.5%.  After #2: essentially same.  The additional
firings produce no additional rain in aggregate.

All parameter changes have been reverted; branch state is identical to
pre-attempt.

## Why it didn't work — root cause re-read

The R8 diagnosis document called out R8-A (weak Hadley ascent) as the
primary root cause, with R8-B (southward ITCZ bias) and R8-C
(conservative activity threshold) as secondary levers.  These four
attempts tuned R8-C and nearby knobs.  The null result **confirms the
diagnosis**:

1. **Deep tropical omega_low is +0.009 Pa/s** (net subsidence).  No
   amount of convective-scheme tuning can produce coherent tropical
   precipitation without organized ascent.
2. The `hasSupport` gate in vertical5.js requires
   `ascentSupport > 0.05 OR moistureConvergenceSupport > 0.05`.
   ascentSupport for tropical cells ≈ 0 because -omega < 0.07 almost
   everywhere.  moistureConvergence is the only path into convection,
   and it's weak.
3. Even cells that do fire convection have activity ≈ 0.3, producing
   modest `mu` (mass flux) regardless of `mu0` raising.  The scheme is
   self-limiting at the current circulation state.
4. When `convRainoutBase` was raised, per-event precip barely increased
   because events had little cloud water to rain out — the cloud
   pathway is upstream-constrained (low activity → low mass flux → low
   cloud water production).

So the global precip deficit is **not a convective-scheme tuning issue**.
It is an **atmospheric-state issue** — the model's Hadley circulation is
weak at the equator, and fixing that requires changes to either:

- Radiative forcing that drives the Hadley cell (solar absorption gradient,
  latent heating feedback)
- Vertical mixing and boundary-layer physics that set the lapse rate
- Some combination thereof, plus a consistent re-tune downstream

## Implications

R7 is the shipping state.  All offline planetary-realism-audit gates pass.
The 4× global precip deficit is real but does not trigger any of the
defined realism warnings.  The model is **"shippable with known residual
gaps"**, not "nearly perfect" — that distinction matters.

The residual gaps from R7 closeout remain the right triage for future
phases:

1. Global precipitation deficit (this attempt failed; tackle via
   Hadley/mixing rework, not convection tuning)
2. NH/SH trade asymmetry (-1.85 vs -0.93 m/s) — likely the same
   underlying Hadley imbalance
3. Weak tropical convection (same root cause)
4. Coupled counterfactual `exitCriteriaPass: false` (best score 0.145)

## What would close the gap

Proposed multi-phase plan (not executed this session):

- **R9: Hadley-cell strengthening probe.**  Measure where the Hadley
  ascent is weak, what radiative/SST/land-sea gradient forcing would
  re-energize it, and test with a guarded experiment flag.  Expected to
  require 2–3 sub-phases: (a) diagnose forcing gradient, (b) apply,
  (c) re-balance downstream gates.
- **R10: Advection conservation fix.**  `stepAdvection5` leaks
  ~0.017 mm/hr/day — a real numerical bug.  Independent of R9, smaller
  leverage (~20% of gap) but clean fix.

Until R9 lands, R7 is the shipping state.

## Artifacts

- `/tmp/r8-probe-*.log` — baseline and four attempt variants (not committed)
- `/tmp/r8-conv-probe-alpha.log` — trigger-probe with lowered thresholds
- Probes and diagnosis from prior commits: `814ee5c`, `a9d64af`
