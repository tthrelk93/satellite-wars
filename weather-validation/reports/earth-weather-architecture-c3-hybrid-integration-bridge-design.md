# Earth Weather Architecture C3 Hybrid Integration Bridge Design

This report turns the failed donor-base hybrid benchmark into the minimal bridge contract required before the first runnable hybrid climate benchmark.

- C2 verdict: `integration_blocked_missing_dependency`
- C3 verdict: `esm_and_core_api_bridge_required`
- Next move: Architecture C4: donor-core integration bridge implementation

## Immediate blockers

- extensionless donor-core imports: ./grid, ./state5, ./hydrostatic, ./dynamics5, ./windEddyNudge5, ./windNudge5, ./mass5, ./advect5, ./vertical5, ./microphysics5, ./surface2d, ./climo2d, ./radiation2d, ./diagnostics2d, ./initializeFromClimo, ./nudging5, ./verticalGrid, ../WeatherLogger
- missing donor-core compatibility methods: getCloudTransitionLedgerRaw, resetCloudTransitionLedger, getModuleTimingSummary, getConservationSummary, loadStateSnapshot, setReplayDisabledModules, clearReplayDisabledModules

## Bridge contract

- patch the rollback donor [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) to use explicit ESM import specifiers before retrying the hybrid worktree
- add compatibility methods on the donor core for the current audit stack rather than immediately replacing the donor scaffold with the current core
- keep the donor-base-first contract from C1 intact: rollback core/vertical donor scaffold, current microphysics preserve layer, current adapter stack
- rerun Architecture C2 immediately after the donor-core bridge is implemented, before any new climate tuning

