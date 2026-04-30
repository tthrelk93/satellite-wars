# Earth Weather Architecture C Closeout

This report closes out Architecture C by comparing the best meaningful late-family candidates: `C62`, `C66`, `C68`, and `C70`. The goal is to decide whether Architecture C still deserves more micro-phases or whether we should stop the ladder and move to a new top-level transport-sign architecture.

- decision: `architecture_c_exhausted_best_reference_c62`
- architecture exhausted: `yes`
- best retained reference candidate: `C62`
- do not continue: `C71+`
- next architecture: `Architecture D: core transport-sign rebuild`
- next active phase: `Architecture D1: signed transport-budget decomposition design`

## Quick comparison

| Candidate | ITCZ width | NH dry ratio | SH dry ratio | NH westerlies | NH ocean condensation | Cross-equatorial vapor flux north |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 25.91 | 1.534 | 1.199 | 0.531 | 0.1413 | 143.95306 |
| C62 | 23.386 | 1.057 | 0.487 | 1.214 | 0.13629 | -318.32449 |
| C66 | 23.232 | 1.112 | 0.492 | 1.218 | 0.12975 | -356.31833 |
| C68 | 23.431 | 1.141 | 0.507 | 1.235 | 0.12134 | -357.91328 |
| C70 | 23.438 | 1.13 | 0.514 | 1.226 | 0.13037 | -348.97338 |

## Candidate readout

### C62
- report: [earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-experiment.md)
- verdict: `quick_reject`
- read: Best retained late-C reference candidate. It keeps the least-bad cross-equatorial transport-sign defect while still preserving the strongest dry-belt ratios in this final comparison set.

### C66
- report: [earth-weather-architecture-c66-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c66-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-experiment.md)
- verdict: `quick_reject`
- read: Real equatorial-guard activity, but it does not beat C62 on the primary blocker. The sign defect stays materially worse even though the shape metrics remain strong.

### C68
- report: [earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c68-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-narrower-equatorial-core-guard-experiment.md)
- verdict: `quick_reject`
- read: Best NH dry-belt ocean-condensation containment and strongest NH westerlies of the four, but it pushes the transport-sign defect farther from recovery again.

### C70
- report: [earth-weather-architecture-c70-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-narrower-equatorial-core-guard-and-stronger-inner-core-blend-experiment.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-c70-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-narrower-equatorial-core-guard-and-stronger-inner-core-blend-experiment.md)
- verdict: `quick_reject`
- read: Best post-C68 recovery on the transport-sign defect, but it still fails badly versus C62 and gives back part of the NH ocean-condensation relief.

## Closeout decision

- Architecture C is exhausted as a micro-phase family.
- The retained reference candidate is `C62`, because it remains the least-bad candidate on the primary blocker: `Cross-equatorial vapor flux north`.
- The later candidates are informative, but they only redistribute the same failure across NH ocean maintenance, transition/receiver rows, and equatorial core support.
- No candidate in this closeout set clears the quick gate or justifies annual promotion.

## Why the ladder stops here

- All four meaningful late Architecture C candidates remain quick rejects.
- C62 still has the least-bad cross-equatorial transport-sign defect in the final comparison set.
- C66, C68, and C70 map tradeoffs inside the same family instead of producing a better keep candidate.
- Architecture C generated real discovery value, but it no longer justifies continued latitude-lane micro-tuning.

## Next architecture

- Start [earth-weather-architecture-d-core-transport-sign-rebuild.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-d-core-transport-sign-rebuild.md).
- The new architecture targets the core transport-sign problem directly: zonal-mean overturning polarity, equatorial eddy export, and NH dry-belt closure.
- It is explicitly bounded and is not another latitude-lane micro-tuning ladder.

