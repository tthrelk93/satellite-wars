# Earth Weather Architecture B Design

## Objective

Turn the failed Architecture A partition-port family into a circulation-first rebuild family.

## Inputs

- [earth-weather-phase0-branch-benchmark.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-phase0-branch-benchmark.json)
- [earth-weather-architecture-a2-partition-port.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a2-partition-port.json)

## Phase 0 split we still must resolve

- ITCZ width: current `24.875`, rollback `25.613`, winner `current`
- NH dry-belt ratio: current `1.343`, rollback `1.561`, winner `current`
- SH dry-belt ratio: current `1.145`, rollback `1.014`, winner `candidate`
- NH midlatitude westerlies: current `0.524`, rollback `1.139`, winner `candidate`
- Cross-equatorial vapor flux north: current `326.33822`, rollback `176.87748`, winner `candidate`

### Preserve from current branch

- ITCZ width
- NH dry-belt ratio

### Recover from rollback archive

- SH dry-belt ratio
- NH midlatitude westerlies
- Cross-equatorial vapor flux north

## Why Architecture A was not enough

Architecture A2 selected `ported-floor-soft-containment` as its best bounded candidate, but it still failed to recover the circulation side:

- SH dry-belt ratio: off `1.199`, on `1.2`, improved `false`
- NH midlatitude westerlies: off `0.531`, on `0.531`, improved `false`
- Cross-equatorial vapor flux north: off `143.95306`, on `144.63218`, improved `false`

That means the next family cannot just relax current dampers. It has to rebuild the circulation scaffold itself.

## Code ownership evidence

- `scripts/agent/planetary-realism-audit.mjs`: churn 5807 (5807 added / 0 deleted)
- `src/weather/v2/vertical5.js`: churn 2449 (2380 added / 69 deleted)
- `src/weather/validation/diagnostics.js`: churn 2288 (2279 added / 9 deleted)
- `src/weather/v2/core5.js`: churn 1259 (1193 added / 66 deleted)
- `src/weather/v2/microphysics5.js`: churn 905 (889 added / 16 deleted)
- `src/weather/v2/state5.js`: churn 506 (505 added / 1 deleted)
- `src/weather/v2/radiation2d.js`: churn 93 (92 added / 1 deleted)

The physics-heavy files that still own this failure are:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)
- [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js)
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)

## Architecture B verdict

- verdict: `circulation_scaffold_rebuild_required`
- summary: Architecture A proved that selective relaxation of current-branch dampers can preserve some partition gains, but it cannot recover the circulation scaffold. The next architecture must rebuild circulation first and only then re-port partition behavior.

## Design contract

- Rebuild the subtropical circulation scaffold before attempting another partition-port.
- Treat the vertical subtropical drying scaffold as the primary Architecture B lever, not the microphysics suppressor families.
- Keep the current branch partition microphysics available as a protected layer, but do not let it dictate the circulation scaffold.
- Promote only bounded scaffold experiments that are judged by the full six-metric climate objective.

## Preferred bounded experiment families

### Circulation scaffold rebuild
- key: `B1-circulation-scaffold-rebuild`
- Rebuild the subtropical vertical scaffold by resetting the floor/boost dependence and attenuating the drying/theta application before re-porting partition behavior.

### Partition re-port on rebuilt scaffold
- key: `B2-partition-report-on-rebuilt-scaffold`
- Once a circulation-first scaffold clears the quick gate, re-port only the current branch partition layers that still preserve the recovered circulation metrics.

## Next active phase

- Architecture B1: implement circulation scaffold rebuild experiment

