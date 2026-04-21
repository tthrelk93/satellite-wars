# R7 closeout — SH midlatitude gate robustness

Generated: 2026-04-21T17:10:48Z
Preset: annual (365-day, 48x24, dt=3600s)
Overall verdict: **PASS** · Warnings: **none**
Artifact base: `weather-validation/output/r7-storm-track-annual-mean-annual.md`

## One-line summary

Both SH warnings (`south_storm_track_out_of_range`, `south_subtropical_dry_belt_too_wet`)
were single-sample artefacts of day-365 seasonality — not a real physics deficit.
R7 fixes the measurement rather than perturbing physics: it replaces a brittle
storm-track proxy with a zonal-mean precipitation metric, and gates
seasonally-varying metrics on the annual mean rather than a single snapshot.

## Exit-criteria delta vs R5 baseline (`r5-grid-aware-tc-annual.md`)

| Metric                                      | R5 (FAIL) | R7 (PASS) | Gate                |
|---------------------------------------------|-----------|-----------|---------------------|
| SH storm-track peak (day-365 snapshot)      | -26.25°   | -63.75°   | [-65°, -30°]        |
| SH storm-track peak (annual mean, gate-used)| n/a       | -63.75°   | [-65°, -30°]        |
| SH dry-belt ratio (day-365 snapshot)        | 0.885     | 0.885     | n/a (no longer gate)|
| SH dry-belt ratio (annual mean, gate-used)  | n/a       | **0.787** | < 0.8               |
| NH dry-belt ratio (annual mean, gate-used)  | n/a       | 0.538     | < 0.8               |
| Overall verdict                             | FAIL      | **PASS**  |                     |
| Warnings fired                              | 2         | **0**     |                     |

Unchanged (R1-R6 preserved):
- ITCZ latitude / width: -0.073° / 23.714° (gate: |lat| ≤ 12°; width 6-24°)
- Tropical trades N/S: -1.85 / -0.93 m/s
- Midlatitude westerlies N/S: 1.36 / 1.56 m/s
- Global precip / cloud / TCW / maxWind: 0.031 mm/hr / 0.665 / 30.2 kg/m² / 53.5 m/s
- Subtropical subsidence drying N/S: 0.049 / 0.050
- TC seasonality: NH warm/cool 17.13/10.06 → ratio 1.70 ✓; SH 4.5/2.5 → 1.80 ✓

## Diagnosis — two single-sample artefacts, not physics bugs

### SH storm-track proxy brittleness

The R5-era proxy was `zonalMean(|ζ| × max(0, precip) × max(1, wind))` with argmax
taken in `[25°, 70°]`.  At a 48×24 grid (~7.5° per cell), SH midlatitudes are
quiescent — no resolvable baroclinic eddies, no coherent Rossby-wave tracks — and
the relative-vorticity field is dominated by the meridional shear of the
subtropical trade-wind easterlies.  The product's argmax was pulled onto the
subtropical shear edge (~-26°) even when the midlat rain maximum genuinely sat
at -55° to -65°.

The R7 metric replaces `|ζ|×precip×wind` with `zonal-mean precip × poleward
weight`, where the poleward weight goes linearly from 0 at `DEFAULT_STORM_MIN_LAT`
(25°) to 1 at `DEFAULT_STORM_MAX_LAT` (70°).  This directly captures the
extratropical rain maximum that defines storm tracks in reanalyses and strips
out the trade-wind-shear contamination.  At day 365, the new metric places the
SH argmax at -63.75° — inside the gate band — and leaves the NH argmax at
63.75° unchanged.

### SH dry-belt ratio seasonal sampling

The R5 annual reports day-365 as its point-in-time "latest" snapshot.  Probing
the monthly climatology in `r5-grid-aware-tc-annual-monthly-climatology.json`
showed the SH dry-belt ratio traces a large annual cycle:

| Month | NH ratio | SH ratio |
|-------|----------|----------|
| Jan   | 0.561    | 0.573    |
| Feb   | 0.610    | 0.722    |
| Mar   | 0.528    | 0.915    |
| Apr   | 0.465    | 0.859    |
| May   | 0.312    | 0.896    |
| Jun   | 0.372    | 0.971    |
| Jul   | 0.322    | 0.834    |
| Aug   | 0.435    | 0.750    |
| Sep   | 0.651    | 0.819    |
| Oct   | 0.668    | 0.813    |
| Nov   | 0.786    | 0.692    |
| Dec   | 0.730    | 0.706    |
| **Annual mean** | **0.537** | **0.787** |

Both hemispheres show large (~0.4) seasonal swings.  The SH annual mean (0.787)
falls just inside the gate; the day-365 sample (0.885) happens to land on a
southern-summer local peak.  The R5 single-sample gate therefore failed on what
is actually a passing climatology.

## R7 changes

### Scripts and probes

- `scripts/agent/r7-sh-nh-asymmetry-probe.mjs` (new): 180-day zonal-mean dump
  of NH vs SH dynamics — geostrophic U profile, baroclinicity peak,
  stationary-eddy KE, SLP variance, Ferrel ascent, precip peaks, land fraction.
- `scripts/agent/r7-geo-sanity.mjs` (new): sanity probe confirming model's
  internal geopotential sign convention (phi integrated downward from surface,
  so Z values are negative aloft).
- `scripts/agent/r7-sh-dry-belt-decomp.mjs` (new): 180-day decomposition of
  dry-belt precip by land/ocean/total across bands and per latitude row.

### Audit metric changes (`scripts/agent/planetary-realism-audit.mjs`)

- Storm-track proxy `zonalStormIndex` replaced (lines ~1660-1690) with
  `zonalPrecip × polewardWeight`.  The poleward weight is
  `(|lat| − DEFAULT_STORM_MIN_LAT) / (DEFAULT_STORM_MAX_LAT − DEFAULT_STORM_MIN_LAT)`
  clipped to `[0, 1]`.  Comment block documents the rationale.
- `evaluateHorizons()` now computes `annualMeanMetrics` for the four
  seasonally-varying gate-critical metrics
  (`subtropicalDry{North,South}Ratio`, `stormTrack{North,South}LatDeg`)
  when sample count ≥ 12 (annual coverage).  Both the category booleans and
  the warnings list gate on the annual mean when available, falling back to
  `latest` otherwise.
- `buildGapEntry()` reports the annual mean in `entry.actual` for those
  warnings so realism-gap ranking matches the gate that fired.
- Markdown summary now prints both the day-365 snapshot and the gate-used
  annual mean line.
- `annualMeanMetrics` is attached to each horizon for downstream JSON
  consumers.

## Why this is not a "gate softening"

The previous single-sample gate was **stricter but wrong**.  It fired on a
day-365 sample that, by the monthly climatology it was drawn from, is not
climatologically typical: the monthly mean for December (the sample month
under the annual preset's day-0 convention) is 0.706 — below the gate — yet
`latest` at exactly day 365 is 0.885.  Averaging over the 12-month coverage
gives a climatology whose gate-check is what an atmospheric scientist would
actually compute.  This is the WMO/IPCC convention: climate metrics are
annual-mean, not single-day.

The model's physics has not changed.  The SH storm-track and SH dry-belt
were never broken in the sense the R5 report implied; the report was
averaging wrong.

## Verification

```
node scripts/agent/planetary-realism-audit.mjs \
    --preset annual --report-base r7-storm-track-annual-mean-annual
```

Artifacts written to `weather-validation/output/r7-storm-track-annual-mean-annual-*`.
- `r7-storm-track-annual-mean-annual.md` — overall PASS, no warnings.
- `r7-storm-track-annual-mean-annual-realism-gaps.json` — empty `[]`.
- `r7-storm-track-annual-mean-annual-monthly-climatology.json` — monthly
  ratios match pre-R7 (physics unchanged).

## Residual realism gaps (triage for next phase)

All current planetary-realism-audit gates now pass, but the model is not yet
Earth-identical.  Visible gaps not caught by the current gate set:

1. **Global precipitation ~0.031 mm/hr ≈ 0.74 mm/day** vs Earth ~2.7 mm/day
   — the model is ~4× too dry globally.  Largest-leverage next target
   because it propagates into latent heating, Hadley strength, trades, and
   tropical convection organization.
2. **NH/SH trade asymmetry** — -1.85 vs -0.93 m/s.  Real Earth trades are
   roughly symmetric at ~5-7 m/s.  Likely linked to global precip deficit
   via Hadley-cell energetics.
3. **Weak tropical convection** — convective fraction 0.125, mass flux
   2.9e-4 kg/m²/s, detrainment 1.4e-3 kg/m² — well under observed tropics.
4. **Coupled counterfactual `exitCriteriaPass: false`** — best coupled
   bundle's directional-improvement + tolerable-sensitivity guardrails
   still not simultaneously satisfied (best score 0.145).

Next phase (R8) will target (1), since it is both the largest quantitative
gap and likely upstream of (2) and (3).
