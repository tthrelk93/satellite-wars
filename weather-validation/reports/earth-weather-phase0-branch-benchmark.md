# Earth Weather Phase 0 Branch Benchmark

## Objective

Choose the canonical branch that will serve as the new base for Earth-like climate and emergent weather work.

## Branches Compared

- Current branch: `codex/world-class-weather-loop`
- Rollback candidate: `codex/world-class-weather-loop-archive-20260407-0745`
- Trusted older climate anchor: [phase1-hadley-second-pass-restore-v4.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json)

## Important method note

The rollback candidate predates the modern annual audit harness. To keep the benchmark apples-to-apples, the current annual audit harness was overlaid into a temporary benchmark worktree and executed against the rollback branch code without modifying repo history.

## Quick screen

- Current quick: ITCZ 25.91, dry north 1.534, dry south 1.199, NH jet 0.531
- Rollback quick: ITCZ 24.041, dry north 1.283, dry south 0.578, NH jet 1.073

## Day-365 comparison

- ITCZ width: current 24.875, rollback 25.613, trusted 23.646, winner current
- NH dry-belt ratio: current 1.343, rollback 1.561, trusted 1.1, winner current
- SH dry-belt ratio: current 1.145, rollback 1.014, trusted 0.519, winner candidate
- NH midlatitude westerlies: current 0.524, rollback 1.139, trusted 1.192, winner candidate
- NH dry-belt ocean condensation: current 0.277, rollback 0, trusted n/a, winner n/a
- Cross-equatorial vapor flux north: current 326.338, rollback 176.877, trusted n/a, winner candidate

## Decision

- Verdict: `no_clear_winner`
- Rollback metric wins: 3
- Current metric wins: 2
- Comparable annual metrics: 5
- Severe rollback regressions: subtropicalDryNorthRatio
- Next move: No branch cleared the Phase 0 gate cleanly. Do not continue local patching; escalate to architecture change.

