# Phase 1 Reset System Experiments

This report compares the three bounded reset experiments against the frozen branch state using only full-objective climate outcomes.

## Baseline

- Frozen branch state quick: ITCZ 25.91, dry north 1.534, dry south 1.199, NH jet 0.531, NH dry-belt ocean condensation 0.1413
- Frozen branch state annual day-365: ITCZ 24.875, dry north 1.343, dry south 1.145, NH jet 0.524, NH dry-belt ocean condensation 0.2774
- Trusted old Phase 1 baseline target: ITCZ 23.646, dry north 1.1, dry south 0.519, NH jet 1.192

## Experiment Results

### R2A Upper-cloud persistence collapse

- Quick score: 0
- Annual score: skipped after quick ranking
- Combined score: 0
- Quick guardrails: ITCZ 25.91, dry north 1.534, dry south 1.199, NH jet 0.531, NH ocean condensation 0.1413
- Annual day-365 guardrails: skipped after the quick screen ranked this bundle below the top annual candidates

### R2B Annual numerical hardening

- Quick score: 0.14171
- Annual score: -0.50762
- Combined score: -0.28035
- Quick guardrails: ITCZ 25.804, dry north 1.303, dry south 1.195, NH jet 0.532, NH ocean condensation 0.11021
- Annual day-365 guardrails: ITCZ 25.468, dry north 1.793, dry south 1.321, NH jet 0.525, NH ocean condensation 0.16856

### R2C Hydrology balance repartition

- Quick score: 0.02792
- Annual score: -0.61604
- Combined score: -0.39065
- Quick guardrails: ITCZ 25.792, dry north 1.504, dry south 1.198, NH jet 0.531, NH ocean condensation 0.14021
- Annual day-365 guardrails: ITCZ 26.097, dry north 1.744, dry south 1.291, NH jet 0.523, NH ocean condensation 0.25077

## Decision

- Winner: R2B Annual numerical hardening
- Verdict: no_clear_winner
- Next move: No annualized experiment improved both 30-day and 365-day climate objectives strongly enough. Stop the patch spiral and either roll back to the best trusted climate state or escalate to a broader architecture change.

