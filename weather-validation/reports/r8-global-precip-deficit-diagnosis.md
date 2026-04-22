# R8 diagnosis — global precipitation deficit

Generated: 2026-04-21
Status: **diagnosis in progress**
Artifact base: `weather-validation/output/r7-storm-track-annual-mean-annual-*` (still the
current baseline; R8 probe runs out-of-band)

## Starting point

From R7 closeout, the model is ~4× too dry globally:

| Metric                | Model     | Earth     | Ratio |
|-----------------------|-----------|-----------|-------|
| Global-mean precip    | 0.031 mm/hr | 0.108 mm/hr | 0.28× |
| Global-mean TCW       | 30.2 kg/m² | 24 kg/m²   | 1.29× |

TCW is **above** Earth, so the atmosphere is not short on water vapor —
precipitation *efficiency* is the suspect, not water supply.

## Probe results (`scripts/agent/r8-global-precip-budget-probe.mjs`, 180-day spinup)

### Global budget (area-weighted cos(lat))

```
P (surface)               = 0.0303 mm/hr  (0.28× Earth)
E (surface evap)          = 0.0449 mm/hr  (0.42× Earth)
P / E                     = 0.677         ← NOT closed at steady state
Condensation source (LS)  = 0.0846 mm/hr
Precip reevap             = 0.0092 mm/hr
Cloud reevap              = 0.0948 mm/hr  (> condensation!)
TCW                       = 30.97 kg/m²   (1.29× Earth)
```

Two red flags:
1. **P/E = 0.68** — at equilibrium this should be ≈1. 32% of evaporated moisture
   is not returning as precipitation.
2. **Cloud-reevap > large-scale condensation.** Physically impossible in
   steady-state unless convective detrainment pumps cloud water (it does;
   `enableConvectiveOutcome: true` in core5.js — detrainment fills cloud
   water without writing to `largeScaleCondensationSource`). So the counter
   is incomplete, not the physics broken — but confirms **convection is a
   major moisture pathway** at which tracers blind us.

### Per-band diagnosis

| Band          | Lat      | P      | E      | P/E   | TCW  | RH_low | P/Earth |
|---------------|----------|--------|--------|-------|------|--------|---------|
| Tropics       | -12..12  | 0.0212 | 0.0662 | 0.32  | 46.0 | 0.387  | **0.12** |
| NH subtrop    | 15..35   | 0.0213 | 0.0361 | 0.59  | 24.4 | 0.282  | 0.53    |
| SH subtrop    | -35..-15 | 0.0101 | 0.0708 | 0.14  | 40.2 | 0.396  | 0.25    |
| NH midlat     | 35..65   | 0.0372 | 0.0226 | 1.65  | 11.9 | 0.664  | 0.37    |
| SH midlat     | -65..-35 | 0.0457 | 0.0163 | 2.81  | 30.7 | 0.604  | 0.46    |
| Polar (N)     | 65..90   | 0.0283 | 0.0367 | 0.77  |  5.0 | 0.587  | 1.41    |
| Polar (S)     | -90..-65 | 0.1373 | 0.0394 | 3.49  | 22.8 | 0.918  | **6.87**|

### The two numerical anchors

**Tropics** dominate the deficit. Tropical P is 12% of Earth's tropical rain.
Tropical E is 66% of Earth's — not collapsed, but weak. The **tropical
lower-tropospheric RH of 0.39** is desert-like — Earth ITCZ has RH_low ≈ 0.80,
broader tropics ≈ 0.65. Tropical TCW (46 kg/m²) is high, meaning moisture
is concentrated upstairs (upper tropo / detrainment layer) rather than in
the BL where it could precipitate.

**Antarctica** is a hidden moisture dump. Polar S rains 7× Earth's rate and
has P/E = 3.5 — it receives 0.10 mm/hr net poleward moisture transport. The
missing tropical rain goes here.

### Conservation check (from R7 audit's
      `conservation-summary.json`, cumulative over 8760 hourly steps ≈ 365 days)

Per-day net delta by module (global column water):

| Module             | ΔColumn (kg/m²/day) | Vapor    | Condensate |
|--------------------|---------------------|----------|------------|
| stepSurface2D5     | +1.108              | +1.108   | 0          |
| **stepAdvection5** | **-0.418**          | -1.366   | +0.948     |
| stepVertical5      | +0.167              | +0.156   | +0.011     |
| stepMicrophysics5  | -0.768              | +0.188   | -0.956     |
| stepNudging5       | -0.015              | -0.015   | 0          |
| **Net**            | **+0.074**          |          |            |

`stepAdvection5` has a net moisture sink of **0.418 kg/m²/day** (~0.017 mm/hr).
Advection should conserve mass by construction — this is a numerical
mass-loss bug in the advection step. Size: ~20% of the global precip deficit
(0.108 − 0.030 = 0.078 mm/hr shortfall; advection leak = 0.017 mm/hr ≈ 22%
of the gap).

Net column growth is +0.074 kg/m²/day = +27 kg/m² over 365 days. The model
is **not in full equilibrium at 365 days**. TCW is still growing.

## Root-cause hypothesis ranking

1. **H-convection-weak (dominant)**: Convective precipitation is too weak
   in the tropics. Tropical P = 0.021 vs 0.18 Earth (8× gap). Multiple
   symptoms:
   - Tropical RH_low = 0.39 (should be 0.65–0.80) — BL isn't retaining
     moisture, it's being shipped upstairs.
   - Tropical TCW = 46 kg/m² but precip a fraction of Earth's — mass is
     upstairs, not precipitating.
   - Convective fraction 0.125 (should be 0.35–0.55) — flagged in R7 gaps.
   - Convective mass flux 2.9e-4 kg/m²/s (should be ~1e-3) — flagged in R7.
   - `cloudReevap / cond_LS = 1.12` suggests a large fraction of cloud
     water comes from convective detrainment (bypassing LS condensation),
     so convective source is sizeable but the precipitation path out of
     convective cloud is broken.

2. **H-advection-leak**: Advection step destroys ~0.017 mm/hr of moisture
   globally. Real bug, but accounts for only ~20% of the deficit. Would
   fix model equilibrium closure but not the headline "4× too dry".

3. **H-evap-weak (partial)**: Global E is 0.045 vs Earth's 0.108. But
   tropical ocean E = 0.090 is near Earth-like. The land-side E is low
   (expected — limited soil moisture) and high-latitude E is low (expected
   — cold surface). So the global E shortfall is mostly a weighting
   artefact; fixing tropical/subtropical E wouldn't help much until the
   precip-return path is restored.

4. **H-polar-dump**: Antarctica precipitates 7× Earth's rate and imports
   0.10 mm/hr net. This is a **consequence** of H-convection-weak, not a
   root cause — missing tropical rain flows meridionally and dumps at the
   coldest sink.

## R8 target

**Strengthen tropical convective precipitation.** Specific sub-steps:

1. **Probe tropical convection** (next): dump convective mass flux,
   organization, trigger statistics per row in the tropics. Locate whether
   the trigger fires rarely, or fires but produces weak ascent, or produces
   ascent but detrains without raining.
2. **Lift autoconversion rate** for convective cloud water → precip, or
   lower the trigger thresholds (`convMinPotential: 0.15`,
   `convMinOrganization: 0.18`) to admit more convection.
3. **Consider raising `mu0`** (convective entrainment coefficient,
   currently 0.05) — more entrainment = more mass flux = more precipitation
   for same trigger conditions.
4. **Audit the advection moisture leak** as a follow-up once the headline
   is moving.

Safety guard: any fix must preserve R1–R7 passes, especially the
subtropical dry-belt gates (which sit at 0.787 SH annual mean, margin
just 0.013 to the 0.8 gate). Increased tropical convective activity will
strengthen Hadley descent, which could dry subtropics further and push
the gate. R8 verification must check that.

## Artifacts

- `scripts/agent/r8-global-precip-budget-probe.mjs` — this probe
- `/tmp/r8-probe.log` — full probe output (not committed)
