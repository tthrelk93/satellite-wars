# Phase 1ZZB Atlantic Receiver Efficiency Taper Patch

## Verdict

- atlantic_receiver_relief_with_transition_spillover
- keep patch: `false`
- Next phase: Phase 1ZZC: Atlantic Receiver Spillover Attribution
- Do not enable the Atlantic receiver taper by default. It relieves the Atlantic-facing 26.25°N dry-core receiver, but the improvement is reabsorbed into 18.75°N spillover and the climate guardrails get slightly worse.

## Main Guardrails

- itcz width delta: `0.077`
- dry north delta: `0.017`
- dry south delta: `0.003`
- NH westerlies delta: `0`
- north dry-belt ocean condensation delta: `-0.00039`

## Receiver-Lane Outcome

- Atlantic dry-core receiver `26.25°N` condensation delta: `-0.0097`
- transition spillover `18.75°N` condensation delta: `0.00891`
- north source `11.25°N` condensation delta: `0.00146`
- edge `3.75°N` condensation delta: `-0.00869`
- south source `-11.25°` condensation delta: `-0.03123`

## Live Taper State

- `26.25°N` taper frac: `0.00595`
- `26.25°N` applied taper: `0.00164`
- `26.25°N` total-column-water delta: `0.308`
- `26.25°N` lower-omega delta: `-0.00626`
- `26.25°N` mid-RH delta: `0.014`
- `18.75°N` total-column-water delta: `0.342`
- `18.75°N` lower-omega delta: `0.00268`
- `18.75°N` mid-RH delta: `0.011`
