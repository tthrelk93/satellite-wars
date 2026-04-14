# Phase 1ZF Shoulder Fate Patch Design

## Verdict

- equatorial_edge_buffered_underreach
- Next phase: Phase 1ZG: Implement Equatorial-Edge Buffered Shoulder Fate Patch
- Buffered rainout is the right fate family, but the live patch needs an equatorial-edge allocation redesign so 3.75°N is suppressed harder without borrowing climate stability from sink/export.

## Why Buffered Rainout Wins

- buffered_rainout score: `0.98969`
- sink_export score: `0.83333`
- retain score: `0.17051`
- buffered shoulder-core delta: `0.00099`
- buffered spillover delta: `-0.01452`
- sink_export south dry-ratio delta: `0.105`

## Key Residual Slices

- 3.75°N edge condensation delta: `0.00767` with buffered application `0.00781`
- 11.25°N inner shoulder condensation delta: `-0.00569` with buffered application `0.02025`
- 18.75°N spillover condensation delta: `-0.01452`
- 33.75°N target-entry applied suppression: `0`

## Design Contract

- keep buffered rainout as the suppressed-mass fate
- increase effective buffered application specifically in the 3–6°N equatorial-edge shoulder lane
- do not reopen the 30–45°N target-entry lane
- do not expand application into the 18.75°N spillover lane
- reallocate shoulder suppression toward 3.75°N before increasing total amplitude
