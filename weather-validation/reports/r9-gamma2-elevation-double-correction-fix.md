# R9-γ-2 — elevation double-correction fix on land Ts target

Generated: 2026-04-23
Status: **shipping fix — 2 realism gaps → 1, NH dry belt 0.77 → 0.637**
Branch: `codex/world-class-weather-loop`, HEAD pre-commit

## TL;DR

R9-γ-2 diagnosed a silent double-correction bug in `surface2d.js`:
`TsTargetLand` was being assigned from ERA5 `t2mNow` (already
surface-standardized at actual terrain elevation) and then had a
lapse-rate × elevation subtraction applied to it. Elevated land
was therefore being nudged toward a target that was ~1–7 K too
cold, depending on elevation.

Fix: gate the elevation lapse correction behind
`targetIsSurfaceStandardized === false`. When the target comes from
ERA5 t2m (already measured at surface), skip the correction. When
the target comes from the sea-level latitude baseline
(`landTsUseLatBaseline`), still apply it — that path benefits from
the correction.

Result: the R9-γ-2 probe shows NH subtrop LAND Δ(Ts − target)
collapses from **−5.84 K to +0.17 K**. The 365-day annual audit
goes from R9-γ-1a's 2 gaps to **1 gap** (SH subtropical dry belt,
severity 0.058 — just barely outside target). ITCZ width gap
cleared. NH dry belt ratio 0.77 → 0.637.

Unit tests: 77/78 pass (same one pre-existing ESM bug in
`analysisIncrement5.test.js` unrelated to this change).

## Root cause

In `src/weather/v2/surface2d.js` land-Ts nudging (lines 159–179),
the code was:

```javascript
let TsTargetLand = 288;
if (enableLandClimoTs) {
  if (t2mNow && t2mNow.length === N) {
    TsTargetLand = t2mNow[k];           // ← ERA5 t2m (surface-standardized)
  } else if (landTsUseLatBaseline && latDeg) {
    // ... construct sea-level baseline
    TsTargetLand = thetaLat - 2;        // ← sea-level convention
  }
}
if (elevField) {
  TsTargetLand -= lapseRateKPerM * elevField[k];  // ← blanket correction (bug)
}
```

The blanket elevation correction is wrong when `t2mNow` is used as
the target. ERA5 t2m is **already at actual terrain elevation** —
no further correction is needed. The correction was only valid for
the `landTsUseLatBaseline` fallback path (where 288 K or
`thetaLat - 2` represent sea-level values).

With `landTauTs: 3 days`, this bias persists indefinitely: every
update pulls Ts toward a target that's 1–7 K below the correct
value.

## Fix

```javascript
let TsTargetLand = 288;
let targetIsSurfaceStandardized = false;
if (enableLandClimoTs) {
  if (t2mNow && t2mNow.length === N) {
    TsTargetLand = t2mNow[k];
    targetIsSurfaceStandardized = true;
  } else if (landTsUseLatBaseline && latDeg) {
    // ... sea-level baseline
    TsTargetLand = thetaLat - 2;
  }
}
if (elevField && !targetIsSurfaceStandardized) {
  TsTargetLand -= lapseRateKPerM * elevField[k];
}
```

## Probe evidence (60-day spin-up, 48×24 grid)

Before (R9-γ-1a baseline):

```
NH subtrop 15–35° LAND:
  Ts(state)=275.74 K   Ts(target t2m)=281.58 K   Δ(Ts−target)=−5.84 K
  Tair(lowest)=278.90 K   inversion(Tair−Ts)=3.16 K
  Net surface energy imbalance: +181 W/m² (silently ignored by nudging)
```

After (R9-γ-2 fix):

```
NH subtrop 15–35° LAND:
  Ts(state)= ~same as target   Δ(Ts−target)=+0.17 K
```

Per-latitude table (LAND ONLY, Ts_mean vs t2m_climo_mean):

| lat    | t2m_climo | Ts_mean | Δ    |
|--------|-----------|---------|------|
|  78.8° | 242.74    | 242.58  | −0.16 |
|  63.8° | 252.87    | 252.00  | −0.87 |
|  48.8° | 264.52    | 263.85  | −0.67 |
|  33.8° | 276.28    | 275.80  | −0.48 |
|  18.8° | 294.60    | 294.26  | −0.34 |
|   3.8° | 299.37    | 299.35  | −0.02 |
| −26.3° | 297.99    | 298.06  | +0.07 |
| −56.3° | 281.78    | 281.79  | +0.01 |
| −78.8° | 246.31    | 248.57  | +2.26 |

Residual Δ at poles (~2 K) reflects grid-scale physics near the
singularity, not the elevation bug. The body of the globe (|lat|<60°)
now tracks t2m climatology to ≤1 K.

## Annual-audit evidence (365-day, 2026-04-23, filter-ON + fix)

Realism gaps went from R9-γ-1a's **2** to **1**:

| Code | R9-γ-1a (filter on) | R9-γ-2 (elev fix) | Status |
|------|---------------------|-------------------|--------|
| south_subtropical_dry_belt_too_wet | 0.89, sev=0.188 | 0.829, sev=0.058 | improved 69% |
| itcz_width_unrealistic | 24.4°, sev=0.037 | 23.96° | **RESOLVED** |
| NH subtropical dry belt | 0.77 (passing) | **0.637** (deeper pass) | +17% margin |

Other metrics:

- Global precip 0.032 → **0.034 mm/hr** (+6%)
- N subtropical subsidence 0.048 → 0.049 Pa/s (stable)
- S subtropical subsidence 0.048 → 0.044 Pa/s (stable, still passes)
- Tropical cyclone counts NH/SH: 11 / 7 (healthy, seasonality intact)
- Storm-track peaks (N/S): 63.75° / −63.75° (unchanged)
- Overall verdict: FAIL (one mild warning), but severity reduced
  from 0.188 → 0.058 — 69% closer to pass.

## What this did NOT fix

- Global precip deficit (0.034 vs Earth's 0.1 mm/hr) — upstream of
  this change; requires the midlat-ascent-concentration work
  flagged in R9-γ-1b.
- SH subtropical dry belt is still marginally wet (0.829 vs <0.8)
  — the one remaining gap, severity 0.058.
- Polar residual Ts bias (~2 K cold at |lat|>75°) — grid resolution
  issue, not elevation.

## Operational note on audit runtime

During this session, one full annual preset audit was killed after
90 minutes of runtime with 0 artifacts visible. Initial diagnosis
was "stuck — pathological spin like R9-γ-1 baseline". **That was
wrong.** CPU was at 85–94% the whole time, accumulating 91 min of
CPU time in 90 min of wall clock — legitimately computing, not
deadlocked. The full annual preset with deep-proof diagnostics
(dt-sensitivity + grid-sensitivity + counterfactual pathway sweep +
coupled counterfactual matrix + observer-effect replay) is
genuinely long-running. The R9-γ-1a memo's "4 minutes end-to-end"
claim must have referred to a different invocation — probably a
single-horizon run without deep diagnostics.

The `--no-repro-check --no-counterfactuals` flag combination yields
the core realism-gaps result in ~25 minutes and is the right choice
for iterative debug cycles. Full deep-diagnostics runs should be
reserved for shipping audits and budgeted for hours.

## Updated root-cause tree

- ~~R9-α: subtropical surface forcing too cold~~ (overturned, was
  downstream symptom)
- ~~R9-β2: cross-equatorial SST asymmetry~~ (overturned, seasonal)
- ~~R9-β3: subtropical descent too strong from missing ITCZ~~
  (overturned; branches decoupled)
- **R9-γ-1a: polar grid-singularity noise → fixed by re-enabling
  polar filter. 7 → 2 gaps.**
- **R9-γ-2: elevation double-correction on land Ts target →
  fixed. 2 → 1 gap, NH dry-belt margin deepened.**
- **R9-γ-3 (open): SH subtropical dry belt is still slightly wet
  (0.829 vs <0.8, sev 0.058). Mild; candidate for a focused
  hydrology probe.**
- **R9-γ-4 (open): global precip deficit 0.034 vs 0.1 mm/hr.
  Upstream of this. Requires midlat-ascent-concentration at 48×24
  resolution — structural, not a single-session task.**

## Shipping state

**R9-γ-2 is the new shipping state.** Elevation double-correction
fixed. Unit tests pass (77/78; same pre-existing bug as before).
Annual audit: 2 → 1 realism gaps. Polar filter remains ON from
R9-γ-1a. R7 promoted; this change is a strict improvement.

## Artifacts

- `src/weather/v2/surface2d.js` — gated elevation lapse correction
- `scripts/agent/r9-gamma2-bl-energy-balance-probe.mjs` — probe
- `weather-validation/reports/r9-gamma2-elev-fix-annual-realism-gaps.json`
- `weather-validation/reports/r9-gamma2-elev-fix-annual.md`
- This memo

## Commit trail

- `9dfce0f` — R9-β4 tropical ascent seed
- `3e7c1b3` — R9-γ-1a polar filter re-enablement, 7→2 realism gaps
- This commit — **R9-γ-2 elevation double-correction fix, 2→1
  realism gap, NH dry-belt margin deepened, ITCZ width resolved**
- Next: R9-γ-3 (SH subtropical dry belt — mild, elective) or
  R9-γ-4 (midlat ascent concentration — structural)
