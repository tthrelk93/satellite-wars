# R9-β2 attempt — SST cross-equatorial asymmetry is NOT a model bug

Generated: 2026-04-22
Status: **diagnostic null result — R9-α hypothesis partially overturned; branch state unchanged**

## TL;DR

R9-β1 null result proposed that the cross-equatorial SST asymmetry
(NH ocean 291.79 K vs SH ocean 298.82 K at ~25° lat, a +7 K SH-warmer
skew) was the root cause of SH Hadley absence and ITCZ southward bias.
R9-β2 tested the simplest fix: shorten the 120-day ocean restore tau
so SST snaps back to climo faster than atmospheric flux imbalance can
drift it.

Adding an sstClimo-vs-Ts_ocn delta column to the probe revealed:

- **Ts_ocn tracks sstClimo within ±0.1 K everywhere** (except NH polar
  cells where sea-ice holds Ts to freezing; delta = -4.5 K there).
- The SST is NOT drifting from climo. Changing oceanRestoreTau from
  120 d to 30 d produced **identical** zonal means.
- The "+7 K SH-warmer asymmetry" at 25° lat is the **climo data at the
  spin-up end time**, which is simulated early March (monthFloat = 1.97
  after 60 days from UTC=0 start).
- Early March IS SH late-summer / NH winter. ERA5 at 25°N in early
  March ≈ 290-292 K (matches 291.75). ERA5 at 25°S in early March ≈
  297-299 K (matches 298.91). The "asymmetry" is the seasonal phase,
  not a data bug.

On the annual mean this asymmetry averages out — it is NOT a
systematic driver of ITCZ southward bias.

## What the diagnosis does reveal

A different forcing defect is exposed by the per-row probe output at
NH subtrop 15–35° land cells:

```
t2m_land target (climo):  281.58 K
Model Ts_land (actual):   275.74 K
Model Tair (surface):     292.47 K
```

Two layered cold biases:

1. **The t2m climo TARGET itself is ~6 K too cold** at NH subtrop land
   in early March. Earth ERA5 Sahara/Arabia 30°N Feb mean ~287 K; our
   climo says 281 K. Either the t2m PNG data is wrong, or the
   land-fraction / desert masking is skewing the per-cell lookup.
2. **The model Ts drifts 6 K BELOW even that cold target.** Land
   restore tau is 2-6 days (`landTauTsDry=2d, landTauTsWet=6d`). That
   is fast enough that a 6 K gap can only persist if the net surface
   flux is strongly cooling — ~3 K/day of sustained cooling even with
   the nudging pulling the other way.
3. **Tair is 10-17 K warmer than Ts_land.** The boundary layer air is
   far hotter than the soil skin. Theta-closure should be warming the
   ground via sensible-heat flux, but instead the air is absorbing
   heat from an unknown source while the ground cools.

The SH subtrop shows a milder but similar pattern: Ts_land=293.4 vs
t2m_land target 296.7 vs Tair 298.6. Ts runs ~3 K below target, air
runs ~2 K above target.

## Candidate root causes (ranked)

**C1 — Radiative cooling over desert-like land is too strong.**
The subtropical high-pressure belts are clear-sky, so LW cooling is
unopposed by clouds. If the model radiation scheme over-estimates
surface LW loss at subtropical land albedo+emissivity, the ground
cools below the t2m target regardless of nudging tau. Probe: compare
`surfaceRadiativeFlux` over NH subtrop land to Earth reference.

**C2 — The boundary layer heat source is advective, not surface-flux.**
Subtropics sit under Hadley descending-branch subsidence. Warm
mid-tropospheric air descends and compresses adiabatically, heating
the BL from above. If subsidence heating is too strong in the model
(too-active descent), the BL air stays hot while the ground decouples
below. This would explain Tair = 292 K with Ts = 276 K — a stable
inversion created by adiabatic compression above and radiative cooling
below. Probe: check ω at 700 hPa over NH subtrop.

**C3 — t2m PNG climo is seasonally phase-shifted or coarsened.**
If the 48×24 grid interpolation from ERA5 monthly climo PNGs is
smearing cold high-latitude cells into the subtropical band, the
target will appear 5-8 K cold. Probe: sample t2m PNG values at
specific (lat, lon) against ERA5 tabulated values.

## What does NOT appear to be the problem

- **Cross-equatorial SST asymmetry** — the climo reproduces Earth's
  seasonal phase correctly; annual mean has no asymmetry bug.
- **Ocean restore tau** — SST is already pinned to climo within 0.1 K;
  making tau faster has no effect.
- **Subtropical-land warm-bias flag (R9-β1)** — local forcing is
  absorbed by atmospheric closure; doesn't drive Hadley.

## Implications for the R9-δ plan

The R10 null-result memo proposed bundling R9 (Hadley re-forcing) with
R10 (advection conservation) once R9 lands. The R9 lever is now
narrower than expected:

- **Original R9 hypothesis**: Surface T forcing gradient is wrong →
  fix the surface boundary condition.
- **After R9-β1**: Surface nudging is absorbed by theta closure;
  surface forcing alone cannot drive Hadley.
- **After R9-β2**: SST is fine; cross-equatorial asymmetry is a
  seasonal-phase artifact, not a bug.
- **Remaining candidates**: subsidence heating (C2), radiative
  balance over clear-sky subtrop land (C1), or t2m climo data (C3).

C2 is the most promising because it ties directly to Hadley-cell
physics: if the descending branch is too active, its own subsidence
heating dominates the subtropical BL energy budget. Weakening
subsidence would let the BL air cool (Tair drops toward 286 K target),
closing the surface-air inversion and simultaneously signaling that
the Hadley cell itself needs to be re-forced with the correct
driver — which is the meridional radiative imbalance, not surface T.

## What to try next (R9-β3)

**Probe first:** Add ω@700hPa and the surface LW budget to the zonal
probe output. Compare NH subtrop and SH subtrop `radiation.js`
outputs against Earth reference (solar zenith at 25° lat, typical
clear-sky LW cooling over sand/rock albedo).

**If C1 wins** (radiative imbalance): patch `radiation.js` to correct
the clear-sky desert LW budget. Low-risk; guardable by lat/land/albedo
mask.

**If C2 wins** (too-active subsidence): the right fix is upstream —
weaken the subtropical descending branch. This requires strengthening
the ascending branch (Hadley re-forcing) via tropical heating, which
we've been dancing around all session. The tropical heating gradient
lives in `radiation.js` + convective heating from microphysics.
That's a bigger surgery.

**If C3 wins** (t2m climo data): regenerate the t2m PNGs from fresh
ERA5 data, or implement a richer lat-baseline fallback that captures
subtropical-land peaks separately from global midlat-poleward slope.

## Artifacts

- `scripts/agent/r9-beta-surface-temperature-probe.mjs` — now also
  prints sstClimo column and ocean-vs-climo delta; env var
  `R9_SST_TAU_DAYS` overrides ocean restore tau (no-op here but kept
  for future lat-specific experiments).
- This memo supersedes the "cross-equatorial SST asymmetry" part of
  the R9-β1 null-result memo. The theta-closure explanation for
  R9-β1's warm-bias cancellation stands.

## Shipping state

R7 remains the shipping state. Three null results now documented in
the R9 phase (R9-β1 warm bias, R9-β2 SST tau, plus the incorrect R9-α
asymmetry framing). The next meaningful probe requires instrumenting
subtropical subsidence heating and radiative balance — more work than
a single probe session. Committing this diagnostic so the trail is
transparent.

## Commit trail

- `de44c95` — R10 null result (advection conservation)
- `f12b91a` — R9-α diagnosis (now partially corrected by this memo)
- `4ff6205` — R9-β1 null result (warm-bias closure cancellation)
- This memo + probe update — R9-β2 null result (SST asymmetry is
  seasonal phase, not a bug)
- Next: R9-β3 (subsidence + radiation probe)
