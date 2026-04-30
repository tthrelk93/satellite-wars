# R9-α — Hadley forcing-gradient diagnosis

Generated: 2026-04-22
Status: **diagnosis complete; R9-β (experiment) not yet started**
Data source: R10 365-day audit reports (reverted to R7 physics; circulation
identical to R7 baseline because advection changes don't perturb forcing)

## TL;DR

The Hadley cell's ascending branch is weak because the **subtropical
surface is colder than the air above it**. NH dry belt surface T = 286 K,
air T = 292 K — a 6 K stable inversion. Surface evap runs at 18% of
potential. Without warm subtropical surfaces, the poleward BL air can't
be cooled-and-exported into the ITCZ, and the meridional SLP gradient
that drives trades is weak.

The **SH Hadley return branch mass flux is zero** in the current
atmosphere (NH return = 1640 kg/m/s). The cell is almost NH-only; SH
precip in midlatitudes drains into the Antarctic dump instead of
recirculating.

R9-β target: fix the surface/air temperature inversion in the
subtropical belts (~30N/30S).

## Key signals

From `planetary-realism-status-surface-flux-decomposition.json`:

```
northDryBeltSurfaceTempMeanK      = 286.387 K
northDryBeltAirTempMeanK          = 292.110 K    ← air 6K WARMER than surface
northDryBeltEvapMeanMmHr          = 0.035
northDryBeltEvapPotentialMeanMmHr = 0.194        ← evap = 18% of potential
northDryBeltSurfaceQsMeanKgKg     = 0.011869
northDryBeltSurfaceQaMeanKgKg     = 0.011439     ← humidity gradient = 0.00043
northDryBeltWindSpeedMeanMs       = 10.907       ← wind is fine
northDryBeltSoilGateMeanFrac      = 0.894        ← soil fine
northDryBeltTransferCoeffMean     = 0.00275
```

Earth reference for 30°N subtropics (Sahara/Arabian):
- Summer: surface T ≈ 310 K, air T ≈ 305 K → surface warmer than air
- Annual mean surface T ≈ 300–305 K
- Surface–air ΔT ≈ +3 to +8 K (surface warmer)

Our model: surface–air ΔT = **−5.7 K** (inverted sign). This is the
forcing defect.

From `planetary-realism-status-hadley-partition-summary.json`:

```
returnBranchIntensity.northDryBeltEquatorwardMassFluxKgM_1S = 1640.25
returnBranchIntensity.southDryBeltEquatorwardMassFluxKgM_1S = 0.00   ← dead
lowLevelSourcePartition.localSourceProxyFrac                = 0.041
lowLevelSourcePartition.importedSourceProxyFrac             = 0.959
tropicalExportLevels.northVaporExportSigma                  = null   ← no measurable NH export
tropicalExportLevels.southVaporExportSigma                  = 0.181
```

The NH Hadley cell returns, weakly. The SH Hadley cell does not return
at all. NH vapor export from tropics ("ascending branch at N side of
ITCZ") is below the detection threshold.

## Root-cause hypothesis ranking (R9)

1. **H9-A (dominant): Subtropical surface inversion.**  Cold
   surface-warm-air inverts the sensible-heat forcing sign, shutting off
   the thermally driven component of the Hadley descending branch.
   Evap is starved because `Qs(Tsurf) < Qa(air)` in many cells → no
   vapor gradient drives evaporation. Downstream: BL air over the
   subtropics stays dense and drifts equatorward without energizing the
   Hadley cell.
   **Where**: `surface2d5.js` surface-temperature partition, or the
   radiation forcing gradient that sets it. Probe it first.

2. **H9-B (important): SH Hadley cell absent.**  The 0 kg/m/s SH return
   mass flux tells us the SH cell simply doesn't form. Compare to NH's
   1640 kg/m/s. Possible causes:
   - SH surface forcing too symmetric with SH midlatitudes (no
     poleward temperature gradient to drive circulation)
   - SH ITCZ shifted so far south that the nominal "30°S subtropics"
     actually sit inside the SH ITCZ (consistent with R8 finding:
     convMask=14.6% at -15..-6°S vs 4% at 0..+15°N — asymmetric ITCZ)
   - SH dry-belt sector summary reports 0 mass flux but also 0
     equatorward transport — suggests the cell never closes

3. **H9-C (secondary): Radiative gradient.**  The forcing gradient that
   drives Hadley is the TOA net radiation latitude profile: surplus in
   tropics, deficit in poles, driving meridional energy flux. If our
   `radiation.js` computes a too-flat latitude profile, Hadley is
   starved. Check radiation module's latitudinal heating structure.

## R9-β design

Two guarded experiment flags, one at a time:

**R9-β1: `enableSubtropicalSurfaceForcing`**  — patch surface2d5.js to
enforce Earth-realistic surface temperatures in the subtropical dry
belts. E.g., add a latitude-dependent land/ocean surface-T target that
reaches ~305 K at 25–30° lat and relaxes Tsurf toward it on a BL
timescale (~1 day). This closes H9-A directly.

**R9-β2: `enableEquatorialRadiativeGradient`**  — if β1 doesn't close
H9-C, steepen the TOA latitudinal gradient in radiation.js. Target:
equator SW absorption 340 W/m² vs 30° lat 310 W/m² vs 60° lat 240 W/m².

Expected outcome of β1:
- Subtropical Tsurf rises 10–15 K (286 → 298–302 K)
- Surface–air ΔT flips from −5.7 K to +3 to +7 K
- Evap rises from 0.035 to ~0.1 mm/hr (2–3× increase, approaching Earth)
- BL over subtropics becomes unstable, drives meridional pressure
  gradient
- NH + SH Hadley return branches strengthen
- Tropical ω_low flips from +0.009 (subsidence) to −0.03 to −0.05
  (organized ascent)
- Tropical P rises from 0.021 to 0.1+ mm/hr (approaches Earth 0.18)

Regression risks to watch:
- Subtropical dry-belt ratios: already borderline. Warmer subtropics =
  more evap = more moisture. Could push NH ratio 0.76 → >0.80 (break
  gate). Mitigated by stronger Hadley subsidence drying.
- Storm-track latitudes: could shift poleward with stronger Hadley.
- Global TCW: should rise slightly (~5 kg/m²) before equilibrium
  re-establishes.
- Tropical cyclone count: should rise (more warm-ocean surface).

## R9-γ verification plan

Full 365-day annual audit (same `planetary-realism-audit.mjs --preset
annual` that R7/R10 used). Must pass:

- All R1–R7 gates (no regressions)
- Dry-belt ratios < 0.8 (both hemispheres)
- ITCZ width 6–24°
- Global precip ≥ 0.07 mm/hr (target 0.108, accept 0.07 as "closed half
  the gap")
- No new `numerical_integrity_summary` warnings
- `exitCriteriaPass: true` for at least one coupled counterfactual
  bundle (new; was false in R7/R10)

## Artifacts

- `planetary-realism-status-surface-flux-decomposition.json` (R10 audit;
  R7 physics)
- `planetary-realism-status-hadley-partition-summary.json` (same)
- `planetary-realism-status-sample-profiles.json` (zonal-mean thermo
  profiles for forcing-gradient analysis; 1MB+)

## Next concrete step

Write `scripts/agent/r9-beta1-subtropical-surface-probe.mjs` that:
1. Loads WeatherCore5 at R7 physics
2. Instruments surface2d5.js to trace Tsurf, Tair, Qs, Qa per
   latitude band at 180-day spinup
3. Compares to Earth targets above
4. Identifies whether the issue is: (a) insufficient SW absorption at
   surface, (b) too much sensible-heat loss to atmosphere, (c) excess
   atmospheric LW back-radiation missing.

That probe reveals which lever in surface2d5.js or radiation.js to
touch in R9-β.
