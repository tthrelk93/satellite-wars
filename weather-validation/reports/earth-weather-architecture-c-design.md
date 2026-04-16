# Earth Weather Architecture C Design

This report converts the failed parameter-only Architecture B family into a code-level hybridization plan between the rollback circulation branch and the current partition-preserving branch.

- Archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- Verdict: `module_level_hybrid_required`
- Next move: Architecture C1: hybrid seam contract

## Seam findings

### Core circulation defaults

- file: [src/weather/v2/core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- target role: `rollback_donor_candidate`
- classification: `rollback_donor_candidate`
- diff lines: `+1193 / -66`
- token hits: current `5/5`, archive `0/5`

### Vertical circulation scaffold

- file: [src/weather/v2/vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- target role: `rollback_donor_candidate`
- classification: `rollback_donor_candidate`
- diff lines: `+2380 / -69`
- token hits: current `5/5`, archive `0/5`

### Partition-preserving microphysics

- file: [src/weather/v2/microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- target role: `current_preserve_candidate`
- classification: `current_preserve_candidate`
- diff lines: `+889 / -16`
- token hits: current `5/5`, archive `0/5`

### State adapter surface

- file: [src/weather/v2/state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- target role: `current_adapter_candidate`
- classification: `current_adapter_candidate`
- diff lines: `+505 / -1`
- token hits: current `2/2`, archive `0/2`

### Diagnostics adapter surface

- file: [src/weather/validation/diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- target role: `current_adapter_candidate`
- classification: `current_adapter_candidate`
- diff lines: `+2279 / -9`
- token hits: current `3/3`, archive `0/3`

### Audit harness adapter surface

- file: [scripts/agent/planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- target role: `current_adapter_candidate`
- classification: `current_adapter_candidate`
- diff lines: `+5934 / -0`
- token hits: current `3/4`, archive `null/4`

### Radiative support review lane

- file: [src/weather/v2/radiation2d.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/radiation2d.js)
- target role: `secondary_review_candidate`
- classification: `secondary_review_candidate`
- diff lines: `+92 / -1`
- token hits: current `2/3`, archive `1/3`

## Hybridization split

- rollback donor files: src/weather/v2/core5.js, src/weather/v2/vertical5.js
- current preserve files: src/weather/v2/microphysics5.js
- current adapter files: src/weather/v2/state5.js, src/weather/validation/diagnostics.js, scripts/agent/planetary-realism-audit.mjs

## Design conclusion

- Architecture B proved that parameter-only tuning cannot recover circulation on the current code path.
- The rollback branch remains the only branch with materially stronger NH circulation and cross-equatorial transport.
- The current branch remains the only branch with the partition-preserving suppressor/diagnostic stack we need to protect NH dry-belt realism work.
- So the next responsible move is a module-level donor/preserve/adapter hybrid, not another scalar experiment family.

