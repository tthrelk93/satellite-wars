# Earth Weather Master Scorecard

Updated: 2026-04-16

## Top-level phase status

- Phase 0 Base-State Recovery Decision: COMPLETED (`no_clear_winner`)
- Architecture A Circulation-Preserving Dry-Belt Partition Redesign: COMPLETED
- Architecture A1 Explicit Subtropical Balance Contract Experiment: FAILED (`quick_reject`)
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

## Day-365 benchmark summary

- ITCZ width: current 24.875, rollback 25.613, winner current
- NH dry-belt ratio: current 1.343, rollback 1.561, winner current
- SH dry-belt ratio: current 1.145, rollback 1.014, winner candidate
- NH midlatitude westerlies: current 0.524, rollback 1.139, winner candidate
- NH dry-belt ocean condensation: current 0.277, rollback 0, winner n/a
- Cross-equatorial vapor flux north: current 326.338, rollback 176.877, winner candidate
