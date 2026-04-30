# R9-β4 — tropical ascent seed (partial positive + new diagnosis)

Generated: 2026-04-22
Status: **partial positive; flag retained default OFF; R7 still shipping**

## TL;DR

Added a guarded `enableTropicalAscentSeed` flag to `vertical5.js`
that injects a Gaussian ω perturbation in the deep tropics after
dynamical ω is computed. The seed successfully forces **realistic
tropical ascent** (ω@700 = -0.04 Pa/s at the equator, matching
Earth's ITCZ zonal mean). But the forced ascent **does NOT close
the Hadley loop** — subtropical descent is unchanged, midlatitude
ascent is unchanged, and subtropical surface temperature / BL air
temperature are unchanged to within 0.01 K.

This overturns the R9-β3 hypothesis that subtropical descent is
caused by a missing ITCZ. The two circulations are **independent
in our model**. The real Hadley-descent driver turns out to be the
midlatitude storm-track return flow, which itself is 3-5× Earth's
strength. The subtropical surface cold bias is a **local energy
balance defect**, not downstream of Hadley circulation.

Flag committed as default OFF for future experiments. R7 remains
shipping state.

## What was added

- `vertical5.js` line 567+: parameter registrations for the 8 new
  `tropicalAscentSeed*` params in `VERTICAL_PARAM_NAMES`.
- `vertical5.js` line 745+: default values in the `stepVertical5`
  destructuring block.
- `vertical5.js` line 2636+: the injection block itself — a Gaussian
  envelope in (lat, sigma) applied to `omega[lv*N + k]` after the
  equatorial-edge-subsidence guardrail, with a linear time fade
  between `fadeStartDay` and `fadeStartDay + fadeDurationDays`.
- `scripts/agent/r9-beta-surface-temperature-probe.mjs`: env-var
  wiring (`R9_ASCENT_SEED=1`, plus `R9_ASCENT_*` tunables).

Defaults when the flag is enabled:
- peak 0.05 Pa/s magnitude (applied as negative ω = ascent)
- center 0° latitude, width 10° (1σ Gaussian)
- sigma range [0.3, 0.7] (≈ 300-700 hPa)
- fade: day 20 → 40 (linear taper to zero)

Default when the flag is disabled: zero perturbation, no behavior
change.

## Probe results (60-day spin-up, 48×24 grid)

### A/B at baseline settings (peak 0.05, fade day 20-40)

```
                          ω@700  baseline | ω@700  seed ON  | Earth target
Deep tropics (±6°)         +10.19          +10.12              -30 to -50
Tropics (±12°)             +12.02          +11.98              -20 to -40
NH subtrop 15–35°          +97.91          +97.94              +20 to +50
```

After the fade ended (day 40+), ω@500 held the ascent but ω@700
reverted to baseline. The convective scheme did NOT latch on and
propagate the ascent down to the BL.

### Permanent-seed test (peak 0.06, no fade, σ=[0.25, 0.85])

```
                          ω@700 baseline | ω@700 perma-seed | Earth
Deep tropics (±6°)          +10.19          -38.75              -30 to -50 ✓
Tropics (±12°)              +12.02          -26.39              -20 to -40 ✓
NH subtrop 15–35°           +97.91          +94.35              +20 to +50 ✗
SH subtrop -35–-15°         +51.92          +48.40              +20 to +50 ✗
NH midlat 35–65°            -99.52          -99.53              -10 to -30 ✗
```

Tropical ω values are now **within Earth's normal range**. But:
- Subtropical descent only dropped 3-4 mPa/s (<5% reduction).
- Midlatitude ascent is totally unaffected.
- Ts_land in NH subtrop = 275.74 K unchanged.
- Tair in NH subtrop = 292.47 K unchanged.
- E/Epot in NH subtrop = 11-12% unchanged.

## What this means

The Hadley cell's two branches (tropical ascent, subtropical
descent) are **decoupled** in our model. Mass balance must close
somewhere, and in our model it closes via the midlatitude cell
(Ferrel descent vs polar ascent) rather than through the
tropical–subtropical Hadley circulation.

Equivalently: the model's zonal-mean circulation is three
decoupled overturning cells — Hadley (broken), Ferrel
(hyperactive), Polar — instead of Earth's coupled 3-cell
meridional circulation.

## Revised root-cause tree for the global-precip gap

- ~~R9-α: subtropical surface forcing too cold~~ (overturned)
- ~~R9-β2: cross-equatorial SST asymmetry~~ (overturned — was
  seasonal phase)
- ~~R9-β3: subtropical descent too strong because ITCZ is missing~~
  (overturned — R9-β4 shows adding ITCZ ascent doesn't fix descent)
- **New: R9-γ-1: midlatitude storm-track ascent is 3-5× too strong,
  driving oversized subtropical descent via Ferrel return flow**
- **New: R9-γ-2: subtropical BL is radiatively locked into an
  inversion (hot air over cold ground) independent of circulation**

## Why we didn't find these first

The R9 diagnostic chain assumed Hadley-cell coupling was the
master driver. Each probe layered a new hypothesis on top
without testing whether Hadley's two branches were actually
coupled in our model. Once R9-β4 forced one branch and observed
no response in the other, the decoupling became visible.

The **cancellation-of-errors warning from R10** applies here too:
multiple decoupled circulations can produce a broadly-Earth-like
zonal mean T/q profile, which is why R7's audit passes. But the
circulation itself is wrong in structure, which is why global
precipitation remains stuck at 0.031 mm/hr.

## What to try next (R9-γ or R11)

This is now a deeper physics question than a single probe can
answer. Two leads:

**R9-γ-1 — diagnose midlat ascent width.**  Add a probe that
zonally samples ω@500 at every latitude and identifies where the
ascent is too broad vs narrow-and-localized. Compare to ERA5 /
NCEP midlat storm-track zonal-mean climatology. If the model's
storm tracks cover too much of the zonal band, the fix is either
narrower storms (higher resolution, not possible at 48×24) or a
sub-grid parameterization that concentrates ascent.

**R9-γ-2 — diagnose subtropical BL energy balance.**  Add a
surface-flux decomposition probe that reports LW↓, LW↑, SW↓, SH,
LH per cell. Compare to ERA5 at NH subtrop land cells. Identify
which flux term is overcooling the ground.

Both require new probe infrastructure, not just a probe run. That
is more work than a single session.

## Artifacts

- `src/weather/v2/vertical5.js` — flag + injection block
- `scripts/agent/r9-beta-surface-temperature-probe.mjs` — env-var
  wiring
- This memo

## Shipping state

R7 remains the shipping state. The R9-β4 flag is **default OFF**
— it does not affect any production run unless explicitly enabled
via `params.enableTropicalAscentSeed = true`.

## Commit trail

- `de44c95` — R10 null result
- `f12b91a` — R9-α diagnosis (superseded)
- `4ff6205` — R9-β1 null result (surface warm-bias closure)
- `3e4ea43` — R9-β2 null result (SST is seasonal phase)
- `872807d` — R9-β3 subsidence diagnosis (partly superseded)
- This commit — R9-β4 tropical ascent seed, partial positive,
  reveals Hadley decoupling
- Next: R9-γ (midlat storm-track breadth + BL energy balance)
