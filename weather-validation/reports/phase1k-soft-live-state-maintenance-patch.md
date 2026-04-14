# Phase 1K: Soft Live-State Maintenance Patch

Objective:
- implement a narrow saturation-adjustment suppression patch inside the successful Phase 1J soft live-state gate and verify whether it moves the real 30-day climate

Implementation:
- added a regime-selective suppression path in [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)
- keyed the patch off the existing soft live-state selector and ascent modulation rather than the dead Phase 1G/1I gate families
- exposed applied suppression diagnostics in [state5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/state5.js), [diagnostics.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/validation/diagnostics.js), and [planetary-realism-audit.mjs](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/scripts/agent/planetary-realism-audit.mjs)
- added focused regression coverage in [microphysicsPhase7.test.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysicsPhase7.test.js)

Same-branch day-30 compare:
- `patch off` artifact: [phase1k-soft-live-patch-off.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1k-soft-live-patch-off.json)
- `patch on` artifact: [phase1k-soft-live-patch-on.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1k-soft-live-patch-on.json)

Key day-30 deltas (`on - off`):
- `itczWidthDeg`: `26.415 -> 25.874` (`-0.541`)
- `subtropicalDryNorthRatio`: `1.704 -> 1.524` (`-0.180`)
- `subtropicalDrySouthRatio`: `1.296 -> 1.194` (`-0.102`)
- `northDryBeltLargeScaleCondensationMeanKgM2`: `0.17069 -> 0.14040` (`-0.03029`)
- `northDryBeltOceanLargeScaleCondensationMeanKgM2`: `0.19722 -> 0.15260` (`-0.04462`)
- `northDryBeltOceanSoftLiveGateAppliedSuppressionMeanKgM2`: `0 -> 0.04238`
- `midlatitudeWesterliesNorthU10Ms`: `0.532 -> 0.531` (`-0.001`)
- `midlatitudeWesterliesSouthU10Ms`: `0.851 -> 0.851` (`0`)

Interpretation:
- this is the first maintenance-loop patch in this lane that is both live and materially active in the 30-day climate
- it reduces the targeted NH dry-belt marine condensation pathway without introducing a new circulation collapse
- it is worth keeping as the new branch default

Limit:
- it does **not** restore the branch to the trusted old Phase 1 baseline on its own
- versus [phase1-hadley-second-pass-restore-v4.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json), the kept `patch on` state is still worse on:
  - `itczWidthDeg`: `23.646 -> 25.874`
  - `subtropicalDryNorthRatio`: `1.100 -> 1.524`
  - `subtropicalDrySouthRatio`: `0.519 -> 1.194`
  - `midlatitudeWesterliesNorthU10Ms`: `1.192 -> 0.531`

Conclusion:
- Phase 1K succeeded as a live-lever patch and is now worth keeping
- the branch still needs another attribution/tuning phase before we can return to the original world-climate roadmap
