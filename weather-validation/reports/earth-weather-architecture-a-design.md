# Earth Weather Architecture A Design

## Objective

Turn the failed Phase 0 branch split into one integrated redesign family instead of more local patch phases.

## Inputs

- [earth-weather-phase0-branch-benchmark.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-phase0-branch-benchmark.json)
- [phase1-reset-system-experiments.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/phase1-reset-system-experiments.json)

## Phase 0 split we must resolve

The branch benchmark says:

- ITCZ width: current `24.875`, rollback `25.613`, winner `current`
- NH dry-belt ratio: current `1.343`, rollback `1.561`, winner `current`
- SH dry-belt ratio: current `1.145`, rollback `1.014`, winner `candidate`
- NH midlatitude westerlies: current `0.524`, rollback `1.139`, winner `candidate`
- Cross-equatorial vapor flux north: current `326.33822`, rollback `176.87748`, winner `candidate`

So the live split is:

### Preserve from current branch

- ITCZ width
- NH dry-belt ratio

### Recover from rollback archive

- SH dry-belt ratio
- NH midlatitude westerlies
- Cross-equatorial vapor flux north

## Why a broader architecture change is justified

The reset R2 experiment family had no annual winner:
- decision: `no_clear_winner`
- next move: No annualized experiment improved both 30-day and 365-day climate objectives strongly enough. Stop the patch spiral and either roll back to the best trusted climate state or escalate to a broader architecture change.

That means the problem is no longer "find the next better local patch." It is "separate the partition gains from the circulation losses."

## Code ownership evidence

The dominant code churn between the rollback archive and the current branch is concentrated in the shared physics/diagnostics stack:

- `scripts/agent/planetary-realism-audit.mjs`: churn 5748 (5748 added / 0 deleted)
- `src/weather/v2/vertical5.js`: churn 2397 (2328 added / 69 deleted)
- `src/weather/validation/diagnostics.js`: churn 2285 (2276 added / 9 deleted)
- `src/weather/v2/core5.js`: churn 1257 (1191 added / 66 deleted)
- `src/weather/v2/microphysics5.js`: churn 837 (821 added / 16 deleted)
- `src/weather/v2/state5.js`: churn 500 (499 added / 1 deleted)
- `src/weather/v2/radiation2d.js`: churn 93 (92 added / 1 deleted)

The physics-heavy files at the center of this split are:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)

## Architecture A verdict

- verdict: `integrated_partition_circulation_split_required`
- summary: The current branch is stronger on NH dry-belt partitioning while the rollback archive is stronger on circulation. The next architecture must preserve partition gains without continuing to damp circulation.

## Design contract

- Keep the current branch dry-belt partition gains as the protected side of the redesign.
- Recover rollback-like NH jet and cross-equatorial circulation behavior without restoring the rollback NH dry-belt wet bias.
- Replace stacked local suppressor families with one explicit subtropical partition/circulation contract shared between vertical and microphysics.
- Promote only annualized integrated experiments; do not resume local residual patching.

## Preferred bounded experiment families

### Explicit subtropical balance contract
- key: `A1-explicit-subtropical-balance-contract`
- Create a single vertical-state circulation/partition contract in vertical5, then let microphysics consume it instead of re-deriving many local gates.

### Circulation-preserving partition port
- key: `A2-circulation-preserving-partition-port`
- Port only the current branch partition improvements that still make sense under rollback-like circulation support, instead of carrying all current-branch circulation dampers forward.

## Next active phase

- Architecture A1: implement explicit subtropical balance contract experiment

