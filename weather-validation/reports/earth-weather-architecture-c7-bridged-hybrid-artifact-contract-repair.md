# Earth Weather Architecture C7 Bridged Hybrid Artifact Contract Repair

This phase repairs the bridged-hybrid artifact contract by invoking the bridged audit through its exported main path instead of relying on the worktree script-entry heuristic.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `cycle_guard_contract_block`
- next move: Architecture C8: donor-worktree cycle contract repair

## Repair summary

- bridged file count: 6
- rewritten relative import count: 27
- explicit-main run exit code: 1
- explicit-main stdout snippet: `none`
- explicit-main stderr snippet: `file:///private/var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c7-7lTKkp/bridged-worktree/scripts/agent/plan-guard.mjs:112
    throw new Error(`[agent plan guard] ${commandName || 'agent command'} requires an active cycle directory with plan.md before it can run.`);
          ^

Error: [agent plan guard] agent:planetary-realism-audit requires an active cycle directory with plan.md b`

## Benchmark

- repaired bridged hybrid benchmark did not complete
- failure classification: `cycle_guard_contract_block`
- stderr: `file:///private/var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c7-7lTKkp/bridged-worktree/scripts/agent/plan-guard.mjs:112
    throw new Error(`[agent plan guard] ${commandName || 'agent command'} requires an active cycle directory with plan.md before it can run.`);
          ^

Error: [agent plan guard] agent:planetary-realism-audit requires an active cycle directory with plan.md before it can run.
    at ensureCyclePlanReady (file:///private/var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c7-7lTKkp/bridged-worktree/scripts/agent/plan-guard.mjs:112:11)
    at Module.main (file:///private/var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c7-7lTKkp/bridged-worktree/scripts/agent/planetary-realism-audit.mjs:5172:3)
    at file:///private/var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c7-7lTKkp/bridged-worktree/[eval1]:7:11

Node.js v22.22.0`

