# R9-β1 attempt — subtropical land warm-bias flag

Generated: 2026-04-22
Status: **null result, documented; branch state unchanged**

## TL;DR

Added a guarded `enableSubtropicalLandWarmBias` flag to `surface2d.js`
that applies a Gaussian warm bump (+10 K peak at 25° lat, σ=10°) on top
of the existing `TsTargetLand` nudging target. The 60-day probe
confirmed the bias raises subtropical-land Tsurf by +8 K as designed,
but the **atmospheric closure absorbs the new surface heating so fast
that net evap actually drops**. Specifically: air T rises in step with
Tsurf (via theta-closure in `surface2d.js` and subsidence-heating), so
`qs(Ts) − qa` stays roughly constant while `qs(Ts)` itself rises with
`Ts`. Downstream evap is dominated by soilGate / turbulence, which
doesn't scale favourably with higher Ts alone.

R7 remains shipping state. The R9-β1 flag has been reverted (stash
`stash@{1}`). The probe script is retained as a committed artifact.

## Diagnostic probe findings (`r9-beta-surface-temperature-probe.mjs`)

Baseline (flag OFF, 60-day spin-up, 48×24 grid):

```
NH subtrop 15–35°:  Ts_land=275.74  Ts_ocn=291.79  Tair=292.47  E/Epot=12%
SH subtrop -15–-35°: Ts_land=293.36 Ts_ocn=298.82  Tair=298.55  E/Epot=19%
Deep tropics ±6°:    Ts_land=296.14 Ts_ocn=300.71  Tair=300.69  E/Epot=24%
```

With R9-β1 flag ON (boost=10K, center=25°, width=10°):

```
NH subtrop 15–35°:  Ts_land=283.89 (+8K)  Tair=295.06 (+2.6K)  E/Epot=4%  (-8pp)
SH subtrop -15–-35°: Ts_land=301.75 (+8K)  Tair=300.62 (+2.1K)  E/Epot=8%  (-11pp)
Deep tropics ±6°:    Ts_land=297.19 (+1K)  Tair=301.15 (+0.5K) E/Epot=20%  (-4pp)
```

Land Tsurf rose as designed. Atmospheric Tair rose with it (~30% of the
Tsurf boost). Net evap dropped in every affected band. The evap gradient
did NOT become a new driver of circulation — it was a local feedback
loop.

## Why the closure cancels

The energy-balance closure at the surface is very tight:

1. Tsurf rises by +ΔT via the nudging target bump.
2. Sensible flux `H = ρ·Cp·Ch·U·(Ts − Tair)` becomes strongly positive;
   the `enableThetaClosure` path feeds this back as `theta += H·dt /
   (Cp·m0)` — warming the lowest atmospheric layer.
3. Tair rises, and qa (nudged toward RH·qs(Tair)) rises in step.
4. The humidity gradient `dq = qs(Ts) − qa` grows only marginally
   (in probe: dq went 0.0021 → 0.0031 kg/kg at 26°N, a ~50% increase
   that should raise E by 50% — but E dropped instead because
   soilGate and windU didn't cooperate, and potentialE jumped so
   hard that the soil drained faster).
5. SoilGate `= avail^exp` falls as E temporarily spikes, then settles
   into a new equilibrium where most of the additional qs is not used.
6. Net: the system finds a new self-consistent state with hotter
   surface but barely-changed turbulent fluxes.

This is the expected behaviour of a bulk-exchange surface scheme coupled
to a finite-capacity boundary layer: you can't inject net energy by
raising surface T alone — the energy goes somewhere, and in this model
it warms the BL rather than driving evap.

## What this tells us about R9 (Hadley re-forcing)

The R9-α diagnosis identified subtropical surface cooling + SH Hadley
absence as the key symptoms. R9-β1 tested whether lifting subtropical
surface T alone would strengthen the Hadley ascending-branch driver.
The null result establishes:

- **Subtropical surface T is NOT the independent driver.** The tight
  surface-air closure means local surface forcing alone can't supply
  the energy for the Hadley cell.
- **The Hadley driver must come from a source with memory longer than
  the atmospheric response time.** Candidates:
  - **Ocean SST gradient** (tau ~ 120 days in this model) — meridional
    SST gradient drives surface pressure gradient drives trades drives
    Hadley mass circulation.
  - **Cross-equatorial heat transport asymmetry** — NH-warmer-than-SH
    SST anchors ITCZ position and Hadley-cell widths.
  - **Radiative forcing-gradient at TOA** — solar insolation and
    longwave cooling profiles that drive meridional energy transport.

Looking at the probe data:
- **NH subtropical ocean Ts_ocn = 291.8 K** — 4 K BELOW Earth (~295 K)
- **SH subtropical ocean Ts_ocn = 298.8 K** — 3 K ABOVE Earth (~296 K)
- Cross-equatorial SST asymmetry is **~−7 K (SH-warmer)**, inverted
  from Earth's **+1–2 K (NH-warmer)**.

This **SST-asymmetry bug** is almost certainly the real Hadley-forcing
defect. It would:
- Pull the ITCZ south (observed: -10° vs Earth's +5°)
- Starve NH Hadley ascending branch (observed: tropical ω_low=+0.009)
- Break SH Hadley descending branch structurally (observed:
  returnBranchIntensity SH = 0)
- Mirror the R8 finding of NH trade strength vs SH trade weakness

## What to try next (R9-β2)

**R9-β2: Cross-equatorial SST asymmetry correction.**  Add a guarded
flag `enableCrossEquatorialSSTCorrection` that biases the `sstClimo`
restore target in `surface2d.js`:

```js
// In the ocean sst update block (lines 183-194):
let sstTarget = sstClimo;
if (enableCrossEquatorialSSTCorrection && latDeg) {
  const lat = latDeg[row];
  // Antisymmetric correction: +K in NH, -K in SH, tropical envelope.
  const envelope = Math.exp(-0.5 * (lat / crossEqSSTWidthDeg) ** 2);
  const sign = Math.tanh(lat / 5);  // smooth equator-crossing sign
  sstTarget += crossEqSSTCorrectionK * envelope * sign;
}
sst += (sstTarget - sst) * (dt / oceanRestoreTau);
```

With `crossEqSSTCorrectionK=3`, `crossEqSSTWidthDeg=25`:
- At +25°N: target sstClimo + 3×0.61×0.99 = +1.8 K (NH warmer)
- At -25°S: −1.8 K (SH cooler)
- Net meridional SST asymmetry shift: +3.6 K
- At equator: 0 (no direct effect)

Because this operates on the ocean SST prognostic (tau=120d), it
will gradually build up a new equilibrium surface gradient. The tight
atmospheric closure that defeated R9-β1 is now on the DRIVING side,
not the RESISTING side — the ocean provides persistent energy that the
atmosphere can't dissipate fast enough.

Expected equilibrium outcomes:
- ITCZ shifts north (target: ~+5°)
- NH trade wind weakens slightly; SH trade strengthens
- NH Hadley slightly weakens; SH Hadley re-forms
- Global precip rises (more symmetric Hadley cells → more ascent area)
- SH midlatitude warming in response — risk of polar-front shift

Must test this carefully with its own 60-day probe first.

## Revert details

- Stash `stash@{0}` — R10 advection conservation fix (prior null result)
- Stash `stash@{1}` — R9-β1 subtropical land warm-bias flag (this one)
- Working tree is back on HEAD `f12b91a` (R9-α diagnosis); clean of both.

## Artifacts

- `scripts/agent/r9-beta-surface-temperature-probe.mjs` (this commit) —
  per-row zonal Tsurf/Tair/evap probe, useful for future R9-β
  iterations. Reads `R9_WARM_BIAS=1` env var to toggle the flag when
  the code is un-stashed.

## Commit trail

- `de44c95` — R10 null result (advection conservation)
- `f12b91a` — R9-α diagnosis (Hadley forcing)
- This memo + probe — R9-β1 null result
- Next: R9-β2 (cross-equatorial SST correction)
