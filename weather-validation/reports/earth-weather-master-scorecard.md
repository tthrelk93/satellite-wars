# Earth Weather Master Scorecard

Updated: 2026-04-16

## Top-level phase status

- Phase 0 Base-State Recovery Decision: COMPLETED (`no_clear_winner`)
- Architecture A Circulation-Preserving Dry-Belt Partition Redesign: COMPLETED
- Architecture A1 Explicit Subtropical Balance Contract Experiment: FAILED (`quick_reject`)
- Architecture A2 Circulation-Preserving Partition Port: FAILED (`quick_reject`)
- Architecture B Circulation-First Partition Rebuild: COMPLETED
- Architecture B1 Circulation Scaffold Rebuild: FAILED (`quick_reject`)
- Architecture B2 Explicit Circulation-State Port: NEXT
- Phase 1 Climate Base Recovery: BLOCKED
- Phase 2 Seasonal Earth Realism: BLOCKED
- Phase 3 Regional Weather-Regime Realism: BLOCKED
- Phase 4 Tropical Cyclone Environment Realism: BLOCKED
- Phase 5 Emergent Storm Realism: BLOCKED
- Phase 6 Multi-Year Stability And Drift: BLOCKED
- Phase 7 Scientific Review And Ship Readiness: BLOCKED

## Canonical base decision

- Current branch: `codex/world-class-weather-loop`
- Rollback candidate: `codex/world-class-weather-loop-archive-20260407-0745`
- Verdict: `no_clear_winner`
- Selected base: none

## Architecture A decision

- Verdict: `integrated_partition_circulation_split_required`
- Preserve from current:
  - `itczWidthDeg`
  - `subtropicalDryNorthRatio`
- Recover from rollback archive:
  - `subtropicalDrySouthRatio`
  - `midlatitudeWesterliesNorthU10Ms`
  - `crossEquatorialVaporFluxNorthKgM_1S`

## Architecture A1 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-a1-balance-contract.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a1-balance-contract.md)
- Quick result:
  - improved metrics: `1 / 6`
  - severe regressions: `itczWidthDeg`, `subtropicalDryNorthRatio`, `subtropicalDrySouthRatio`
- Next active phase: `Architecture A2: circulation-preserving partition port`

## Architecture A2 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-a2-partition-port.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-a2-partition-port.md)
- Best quick candidate: `ported-floor-soft-containment`
- Quick result:
  - improved metrics: `2 / 6`
  - severe regressions: none
  - preserved only partial current-branch partition gains:
    - `itczWidthDeg: 25.91 -> 25.826`
    - `subtropicalDryNorthRatio: 1.534 -> 1.507`
  - failed the circulation-recovery half of the contract:
    - `subtropicalDrySouthRatio: 1.199 -> 1.2`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.14845`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 144.63218`
- Next active phase: `Architecture B: circulation-first partition rebuild`

## Architecture B decision

- Verdict: `circulation_scaffold_rebuild_required`
- Decision report: [earth-weather-architecture-b-design.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b-design.md)
- Summary:
  - Architecture A could preserve some partition gains
  - Architecture A could not recover SH dry-belt ratio, NH westerlies, or cross-equatorial vapor flux
  - the next family must rebuild circulation first, then re-port partition behavior
- Next active phase: `Architecture B1: circulation scaffold rebuild`

## Architecture B1 decision

- Verdict: `quick_reject`
- Decision report: [earth-weather-architecture-b1-circulation-scaffold.md](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/reports/earth-weather-architecture-b1-circulation-scaffold.md)
- Best quick candidate: `narrow-band-soft-containment`
- Quick result:
  - improved metrics: `1 / 6`
  - severe regressions: `itczWidthDeg`
  - partial movement:
    - `subtropicalDryNorthRatio: 1.534 -> 1.504`
  - failed circulation recovery:
    - `itczWidthDeg: 25.91 -> 26.218`
    - `subtropicalDrySouthRatio: 1.199 -> 1.201`
    - `midlatitudeWesterliesNorthU10Ms: 0.531 -> 0.531`
    - `northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.1413 -> 0.16433`
    - `crossEquatorialVaporFluxNorthKgM_1S: 143.95306 -> 147.25094`
- Next active phase: `Architecture B2: explicit circulation-state port`

## Day-365 benchmark summary

- ITCZ width: current 24.875, rollback 25.613, winner current
- NH dry-belt ratio: current 1.343, rollback 1.561, winner current
- SH dry-belt ratio: current 1.145, rollback 1.014, winner candidate
- NH midlatitude westerlies: current 0.524, rollback 1.139, winner candidate
- NH dry-belt ocean condensation: current 0.277, rollback 0, winner n/a
- Cross-equatorial vapor flux north: current 326.338, rollback 176.877, winner candidate
