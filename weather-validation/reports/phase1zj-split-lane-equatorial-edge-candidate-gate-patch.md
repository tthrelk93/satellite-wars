# Phase 1ZJ Split-Lane Equatorial-Edge Candidate Gate Patch

## Verdict

- keep_with_out_of_lane_edge_residual
- keep patch: `true`
- Next phase: Phase 1ZK: Equatorial-Edge Out-Of-Lane Attribution
- Keep the split-lane gate: it improves the main 30-day climate guardrails and preserves the 11.25°N, 18.75°N, and 33.75°N wins. The remaining 3.75°N rebound now happens with zero shoulder-guard admission, so the next phase should chase the out-of-lane source rather than re-tuning this gate.

## Climate Guardrails

- itcz width delta: `-0.227`
- dry north delta: `-0.086`
- dry south delta: `-0.048`
- NH westerlies delta: `0`
- tropical shoulder core condensation delta: `-0.01472`

## Protected Lanes

- 11.25°N condensation delta: `-0.05705`
- 18.75°N spillover delta: `-0.01418`
- 33.75°N target-entry applied suppression: `0`

## Residual At 3.75°N

- condensation delta: `0.0269`
- candidate delta: `0`
- applied suppression delta: `0`
- buffered rainout delta: `0`
- edge window on: `1`
- edge gate support on: `0`

## What Changed Versus Phase 1ZG

- prior 3.75°N condensation delta: `0.04637`
- current 3.75°N condensation delta: `0.0269`
- prior 3.75°N candidate delta: `0.0701`
- current 3.75°N candidate delta: `0`
- prior 3.75°N applied suppression delta: `0.02352`
- current 3.75°N applied suppression delta: `0`
