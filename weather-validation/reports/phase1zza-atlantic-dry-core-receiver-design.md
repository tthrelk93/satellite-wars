# Phase 1ZZA Atlantic Dry-Core Receiver Design

## Verdict

- atlantic_receiver_efficiency_without_birth_or_import_growth
- keep patch: `false`
- Next phase: Phase 1ZZB: Implement Atlantic Receiver Efficiency Taper Patch
- Do not strengthen the north-source cap. Add a basin-aware Atlantic dry-core receiver taper in vertical5/core5, ocean-only and centered on the poleward half of the 20–30°N lane, keyed off the already-live north leak signal while leaving 11.25°N relief intact.

## Why This Is A Receiver Problem

- 11.25°N source relief is real: condensation `-0.0306`, TCW `-0.03`, lower-omega `-0.00006`
- 26.25°N dry-core uptake still rises: condensation `0.0084`, TCW `-0.122`, lower-omega `0.00233`, mid-RH `-0.006`
- Atlantic sector dominates the failed receiver lane: condensation `0.00966` versus east Pacific `0.00034`, continental `-0.00004`, Indo-Pacific `-0.00337`

## Why This Is Not An Upstream Birth/Import Growth Problem

- Atlantic low-level source delta: `-0.11393`
- Atlantic carry entering delta: `-1.56613`
- Atlantic carry surviving delta: `-1.535`
- Atlantic saturation-adjustment birth delta: `-0.61447`
- Atlantic resolved-ascent birth delta: `-0.03308`
- Atlantic convective detrainment birth delta: `-0.00014`

## Design Contract

- Basin window: `Atlantic ocean sector, lonDeg >= -90 && lonDeg < 20, land excluded`
- Latitude window: `Poleward half of the dry-core receiver lane, centered near 22–30°N with taper outside it`
- Activation carrier: `Reuse the existing live northside leak signal / source-cap activity rather than introducing a new independent source switch`
- Target mechanism: `Receiver efficiency / uptake taper under dry-core condensation concentration, not source strengthening, local humidity recharge, or import ablation`
- Anti-patterns:
  - `Do not increase the north-source cap amplitude first`
  - `Do not blunt Atlantic carryover or saturation-adjustment birth globally`
  - `Do not add a new local humidity or omega boost at 11.25°N`

## Guardrails Context

- itcz width delta: `-0.028`
- dry north delta: `-0.004`
- dry south delta: `0`
- NH dry-belt ocean condensation delta: `0.00199`
