# R9-β3 — subsidence diagnosis (ω@700 probe)

Generated: 2026-04-22
Status: **diagnostic breakthrough — R9-α and R9-β2 framings corrected**
Branch: `codex/world-class-weather-loop`, HEAD `3e4ea43` before this commit

## TL;DR

Adding ω@700 hPa and ω@500 hPa to the zonal probe reveals the real
Hadley defect: **subtropical descent is 2-5× too strong, and the
tropical ascending branch is missing from the zonal mean**. The
subtropical surface cold bias and superheated boundary-layer air
that R9-α flagged are **downstream consequences**, not drivers.

The entire planet from -35° to +35° latitude exhibits zonal-mean
descent in our model. Earth has localized strong ascent in the ITCZ
that dominates the zonal mean of the deep tropics. Our model has no
organized ITCZ, so descent dominates everywhere equatorward of the
midlatitude storm tracks.

## Evidence (60-day spin-up, 48×24 grid, ends at simulated early March)

```
                           ω@700 (mPa/s)   ω@500 (mPa/s)   Earth ω@500
  Deep tropics (±6°)          +10.19          +6.72          -30 to -50
  Tropics (±12°)              +12.02          +9.00          -20 to -40
  NH subtrop 15–35°           +97.91         +107.60         +20 to +50
  SH subtrop -35–-15°         +51.92          +59.48         +20 to +50
  NH midlat 35–65°            -99.52         -106.88         -10 to -30
  SH midlat -65–-35°           +9.37          -11.48         -10 to -30
  NH polar 65–90°             +54.56          -21.68          ~0
  SH polar -90–-65°          -237.99         -170.94          ~0
```

Key observations:

1. **Tropical ω is positive (descending) in zonal mean.** Earth's ITCZ
   dominates the ±6° zonal mean with ω~-0.03 Pa/s; our model shows
   +0.01 Pa/s. No organized ITCZ → no zonal-mean ascent.

2. **NH subtropical descent is 3-5× too strong.** ω@500 = +0.108 Pa/s
   vs Earth's +0.03 Pa/s. That's where all the "missing" mass balance
   ends up when the ITCZ doesn't organize.

3. **SH subtropical descent is 2× Earth but OK in absolute terms.**
   The hemispheric asymmetry in descent (NH +0.108 vs SH +0.059 at
   500 hPa) reflects the inverted ITCZ in our model (R8 finding:
   convection peaks at -10° lat, NH subtrop then gets the return mass
   from a mislocated cell).

4. **Polar ascent is enormous.** SH polar ω@700 = -0.238 Pa/s. That's
   the hemispheric mass-balance sink for the global descent pattern —
   totally unphysical compared to Earth.

## Why the surface cold bias appears

The NH subtrop land Tsurf = 275.74 K, Tair = 292.47 K inversion
(ΔT = -16.7 K) now makes sense:

- **Strong subsidence → adiabatic compression of descending air.**
  At ω@700 = +0.098 Pa/s, air descends from ~700 hPa to ~850 hPa on a
  timescale of a few days, adiabatically warming by 10-15 K. This
  explains the hot Tair at the surface level.
- **Clear skies → unopposed surface LW cooling.** Descent dries the
  column (low qv → weak LW greenhouse), and the absence of
  convection means no clouds block LW escape. The ground radiates to
  space under a super-stable BL that can't vertically mix heat down.
- **Net: air hot, ground cold.** The "-6 K below nudging target"
  surface drift I diagnosed in R9-β2 is the natural steady state of
  a radiatively cooled surface under a subsidence-warmed BL.

The C1/C2/C3 candidates from R9-β2 resolve as:

- **C1 (radiation imbalance)**: partially confirmed but downstream.
  Clear-sky LW cooling IS over-efficient at NH subtrop land (124
  W/m² net positive, vs ~200-250 W/m² expected), but only because
  the air above is too dry (from descent drying). Fixing radiation
  in isolation would move the surface/air temperatures a few K but
  not fix the circulation.
- **C2 (subsidence too strong)**: **confirmed and dominant.** This is
  the primary forcing defect.
- **C3 (t2m climo data)**: residual ~2-3 K bias in climo data
  target. Real but minor compared to the C2 forcing error.

## Upstream cause: why doesn't the ITCZ organize?

The R8 diagnosis already identified this: the convective trigger
depends on `ascentSupport > 0.05`, which is rarely crossed in the
tropics because ω is positive there. **It's a feedback loop**:

1. No organized tropical ascent → convection doesn't trigger.
2. No convection → no latent heat release → no upper-level divergence
   → no mass-flux driver for ascent.
3. Mass balance forces the descent to be distributed globally.
4. Descent drying the tropics further suppresses any residual
   convection.
5. Return to step 1.

The Hadley cell is a **self-sustaining circulation** that requires
either (a) an externally imposed radiative-convective forcing
asymmetry strong enough to break the symmetry, or (b) a seed ascent
that the convective scheme can amplify via latent heating.

## What to try next (R9-β4): seed tropical ascent

Given the feedback-loop diagnosis, a small, localized, time-limited
injection of ω < 0 in the deep tropics — applied long enough for the
convective scheme to catch on — may be enough to flip the system
into a self-sustaining Hadley state. The existing `vertical5.js` has
"omega bridge" guardrail injection logic (lines 2392+, 2473+,
2600+) that precedes this; those injections are small and bridge
existing ascent. We'd need a stronger, lat-targeted injection for a
spin-up period, guarded by a new flag.

Alternative: steepen the tropical SST → pressure gradient by
patching the deep-tropical radiative forcing in `radiation.js` to
produce more tropical heating. This is a more thermodynamic path
that doesn't require a spin-up transient.

**Safer path**: implement an `enableTropicalAscentSeed` flag that
adds an idealized ω-profile (Gaussian in latitude, centered at 0°,
width 10°, peak -0.05 Pa/s at 500 hPa) during the first N days of
spin-up, then fades to zero. If the system re-organizes a Hadley
cell under this seed, that's strong evidence the forcing lever is
the tropical ascent itself.

**Caveat learned from R9-β1**: the atmospheric response closure may
absorb the seed. Unlike R9-β1's surface-T forcing, an ω injection
directly drives the dynamical state rather than a thermodynamic
target — so closure cancellation is less likely. But still possible
if the micro/cloud scheme doesn't latch on to the imposed ascent.

## Known unknowns

- **Why does the midlat storm track ascent not leak equatorward?**
  NH midlat ω@500 = -0.107 Pa/s (strong ascent), but the return flow
  apparently goes poleward (NH polar ω@500 = -0.022) and
  equatorward (NH subtrop ω@500 = +0.108). Mass balance suggests
  the subtrop descent IS partly fed from midlat ascent — that's
  normal Ferrel cell. The problem is the tropical side is missing,
  not the midlat side.
- **What determines the model's specific ITCZ location?** R8 found it
  at -10°, consistent with NH subtrop descent > SH subtrop descent
  (Hadley cross-equatorial flow lifts the ITCZ toward the warmer
  hemisphere, which in our model is SH in this Feb snapshot).
- **Is there a stealth source term somewhere pushing Ts_land down?**
  The probe shows Ts_land drifts 6 K below nudging target despite a
  2-day tau. Either (a) the time-averaged forcing is stronger than
  the instantaneous snapshot suggests, or (b) some other module
  overrides Ts. Worth checking core5.js / land radiation coupling.

## Shipping state

R7 remains the shipping state. The R9 diagnostic chain is now:

- R9-α: surface inversion observed → hypothesis surface forcing wrong
- R9-β1: surface warm-bias → null result, closure absorbs it
- R9-β2: SST asymmetry → not a bug, climo is correct for seasonal phase
- **R9-β3: subsidence hyperactive is the real defect — Hadley ascent
  is missing, descent is distributed 3-5× too strong**
- R9-β4 (next): test ω seed injection in deep tropics to bootstrap
  the ascending branch

## Artifacts

- `scripts/agent/r9-beta-surface-temperature-probe.mjs` — now prints
  ω@700, ω@500, srLand, srOcn per band (R9-β3 instrumentation)
- This memo

## Commit trail

- `de44c95` — R10 null result (advection conservation)
- `f12b91a` — R9-α diagnosis (now superseded by R9-β3)
- `4ff6205` — R9-β1 null result (surface warm-bias closure)
- `3e4ea43` — R9-β2 null result (SST asymmetry is seasonal phase)
- This commit — R9-β3 subsidence-hyperactive diagnosis
- Next: R9-β4 (tropical ω-seed experiment)
