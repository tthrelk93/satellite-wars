# Earth Weather Architecture C2 Donor-Base Hybrid Worktree Benchmark

This report benchmarks the first donor-base hybrid worktree built from the rollback circulation scaffold plus the current partition-preserving and adapter bundles.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `integration_blocked_missing_dependency`

## Overlay bundle

- [src/weather/v2/microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- [src/weather/v2/state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js)
- [src/weather/v2/cloudBirthTracing5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/cloudBirthTracing5.js)
- [src/weather/v2/sourceTracing5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/sourceTracing5.js)
- [src/weather/v2/instrumentationBands5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/instrumentationBands5.js)
- [src/weather/validation/diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js)
- [scripts/agent/planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- [scripts/agent/headless-terrain-fixture.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/headless-terrain-fixture.mjs)
- [scripts/agent/plan-guard.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/plan-guard.mjs)

## Hybrid bootstrap checks

- missing donor-core methods relative to the current audit stack: getCloudTransitionLedgerRaw, resetCloudTransitionLedger, getModuleTimingSummary, getConservationSummary, loadStateSnapshot, setReplayDisabledModules, clearReplayDisabledModules

## Quick benchmark

- hybrid benchmark did not complete
- failure classification: `integration_blocked_missing_dependency`
- stderr: `Command failed: /opt/homebrew/Cellar/node@22/22.22.0_1/bin/node /var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c2-3Tr7Rm/hybrid-worktree/scripts/agent/planetary-realism-audit.mjs --preset quick --no-repro-check --no-counterfactuals --quiet --report-base /var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c2-3Tr7Rm/hybrid-worktree/weather-validation/output/earth-weather-architecture-c2-hybrid-quick
node:internal/modules/esm/resolve:274
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/private/var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c2-3Tr7Rm/hybrid-worktree/src/weather/v2/grid' imported from /private/var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c2-3Tr7Rm/hybrid-worktree/src/weather/v2/core5.js
    at finalizeResolution (node:internal/modules/esm/resolve:274:11)
    at moduleResolve (node:internal/modules/esm/resolve:859:10)
    at defaultResolve (node:internal/modules/esm/resolve:983:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:731:20)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:708:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:310:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:182:49) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///private/var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c2-3Tr7Rm/hybrid-worktree/src/weather/v2/grid'
}

Node.js v22.22.0
`

## Decision

- verdict: `integration_blocked_missing_dependency`
- next move: Architecture C3: hybrid integration bridge design

