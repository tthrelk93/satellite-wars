# Earth Weather Architecture C8 Donor-Worktree Cycle Contract Repair

This phase repairs the donor-worktree cycle contract by creating a real guarded cycle inside the bridged donor worktree before invoking the audit.

- archive donor branch: `codex/world-class-weather-loop-archive-20260407-0745`
- decision: `post_cycle_runtime_failure`
- next move: Architecture C9: cycled hybrid runtime attribution

## Repair contract

- cycle id: `cycle-2026-04-16T05-55-21Z-earth-weather-architecture-c8-bridged-hybrid`
- cycle dir created: `true`
- plan path created: `true`
- cycle-state path created: `true`
- cycle mode: `quick`
- quick artifact copied to repo: no

## Bridged run facts

- bridged file count: 6
- rewritten relative import count: 27
- quick exit code: 1
- quick summary exists: false
- stdout snippet: `[V2] seed=12345 version=v2 nz=26`
- stderr snippet: `node:fs:440
    return binding.readFileUtf8(path, stringToFlags(options.flag));
                   ^

Error: ENOENT: no such file or directory, open '/private/var/folders/wq/k6l0z6354594td_g2b054vxc0000gn/T/earth-weather-c8-WDIhhT/cycle-worktree/scripts/agent/fixtures/headless-terrain-180x90.json'
    at Object.readFileSync (node:fs:440:20)
    at readFixture (file:///private/var/folders/wq/k6l0z6`

