# Earth Weather Architecture C1 Hybrid Seam Contract

This report turns the Architecture C donor/preserve/adapter decision into the concrete splice contract for the first donor-base hybrid benchmark.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- verdict: `rollback_vertical_core_current_partition_adapter_contract`
- next move: Architecture C2: donor-base hybrid worktree benchmark

## Donor bundle

- [src/weather/v2/core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [src/weather/v2/vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)

## Preserve bundle

- [src/weather/v2/microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)

## Adapter bundle

- [src/weather/v2/state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [src/weather/validation/diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [scripts/agent/planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)

## Excluded current donor overrides

- do not start from current [src/weather/v2/core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) for the first hybrid benchmark
- do not start from current [src/weather/v2/vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js) for the first hybrid benchmark

## Implementation order

- Create a donor worktree from the rollback archive branch.
- Keep rollback donor files as the initial circulation scaffold.
- Forward-port current partition-preserving files onto the donor base.
- Forward-port current adapter/audit files needed to run the modern scorecard.
- Run a bounded hybrid benchmark before any new parameter tuning.

## Contract conclusion

- The first Architecture C benchmark should be donor-base-first, not current-branch-first.
- The circulation scaffold must come from rollback donor files.
- The partition-protecting microphysics and the modern audit stack should be ported forward onto that donor base.
- No parameter-only retuning should happen before the donor-base hybrid benchmark is measured.

