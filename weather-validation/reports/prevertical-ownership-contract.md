# Pre-Vertical Ownership Contract

This artifact freezes the exact proving target for the upstream proof campaign that follows [Phase E0](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase-e0-minimal-corridor.md) and [Phase E1](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/vertical-handoff-proof.md).

It is a contract, not an interpretation. Later upstream phases must satisfy this contract before they are allowed to claim ownership or patch placement.

## Frozen proving question

For the frozen NH dry-belt corridor, at the instant just before `stepVertical5` runs on the first replayed step, what fraction of the excess upper-cloud reservoir relative to the historical reference is attributable to:

1. previous-step residual carryover
2. current-step advection import
3. current-step local pre-vertical creation
4. numerical residual

## Frozen corridor

- sector: `eastPacific`
- latitude band: `22-35°N`
- grid: `48 x 24`
- timestep: `1800 s`
- checkpoint day: `29.75`
- target day: `30`
- replay window steps: `12`
- target cell:
  - `cellIndex = 390`
  - `rowIndex = 8`
  - `colIndex = 6`
  - `latDeg = 26.25`
  - `lonDeg = -131.25`

## Frozen baseline roots

### Historical reference

- commit: `e6fea5801d97725ed659a9c731ceb20d9c85690c`
- root: `/tmp/sw-phase1-e6`
- role: trusted good-enough Phase 1 reference

### Discovery current reference

- commit: `246c99ad828f53e1a1d153c9c4a5555cc8be020f`
- root at discovery time: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass`
- role: E0 corridor-selection reference

### Handoff-proof current reference

- commit: `cc9676d64e3197f6fa5db6e3263b70a96b2e73a2`
- root at proof time: `/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass`
- role: E1 budget-closed replay reference

## Frozen evidence from E0

Source artifact:
- [/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase-e0-minimal-corridor.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase-e0-minimal-corridor.json)

Discovery baseline metrics:
- historical `subtropicalDryNorthRatio = 1.352`
- historical `itczWidthDeg = 23.723`
- current `subtropicalDryNorthRatio = 1.698`
- current `itczWidthDeg = 27.197`

Frozen first material divergence in the corridor:
- `stepOffset = 0`
- `simTimeSeconds = 1800000`
- top deltas:
  - `upperCloudPathKgM2 = +3.51914`
  - `largeScaleCondensationSourceKgM2 = +1.77152`
  - `precipRateMmHr = +1.40080`

## Frozen evidence from E1

Source artifact:
- [/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/vertical-handoff-proof.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/vertical-handoff-proof.json)

Frozen proving instant for upstream ownership:
- first replayed step: `stepOffset = 0`
- `simTimeSeconds = 1801800`
- proving boundary: immediately before `stepVertical5`

Frozen current target-cell handoff ledger at the proving instant:
- `inputMassKgM2 = 3.51914`
- `resolvedBirthMassKgM2 = 0.06594`
- `convectiveBirthMassKgM2 = 0`
- `carrySurvivingMassKgM2 = 3.51914`
- `appliedErosionMassKgM2 = 0`
- `handedToMicrophysicsMassKgM2 = 3.51914`
- `residualMassKgM2 = 0.06594`
- `vertical closureFrac = 0.99072`

Frozen historical target-cell handoff ledger at the proving instant:
- all vertical handoff terms are effectively `0`

Frozen current target-cell microphysics handoff at the proving instant:
- `inputMassKgM2 = 3.51912`
- `cloudReevaporationMassKgM2 = 0.20322`
- `precipReevaporationMassKgM2 = 0.01375`
- `sedimentationExportMassKgM2 = 0.20415`
- `cloudToPrecipMassKgM2 = 0.12656`
- `outputMassKgM2 = 3.09801`
- `microphysics closureFrac = 1`

Frozen combined closure at the proving instant:
- current target-cell combined closure: `0.99536`
- current corridor combined closure: `0.99653`
- historical target-cell combined closure: `1`
- historical corridor combined closure: `1`

Frozen sensitivity checks:
- `dt_half`: target `0.99523`, corridor `0.99446`, dominant vertical channel `handedToMicrophysicsMassKgM2`, stable `true`
- `grid_coarse`: target `1.00000`, corridor `0.97744`, dominant vertical channel `resolvedBirthMassKgM2`, stable `true`

## Ownership buckets

Every later upstream phase must map excess pre-vertical upper cloud into exactly these buckets:

1. `previousStepResidualUpperCloud`
2. `currentStepAdvectedUpperCloud`
3. `currentStepLocalPreverticalBirth`
4. `numericalResidual`

No extra ownership bucket may be introduced unless this contract is explicitly revised.

## Locked comparison rules

Every later upstream phase must:

- use the same frozen corridor and target cell
- evaluate the same historical reference commit
- preserve trace-disabled physical parity against the E1 handoff-proof current reference
- keep the same proving instant: immediately before `stepVertical5` on replay step `0`

Allowed instrumentation drift:
- only trace-disabled, observer-free changes are allowed
- if a later phase changes the target-cell pre-vertical `inputMassKgM2` or `resolvedBirthMassKgM2` materially relative to the E1 proof reference, that phase must stop and reconcile the drift before claiming ownership

Operational parity threshold:
- target-cell pre-vertical mass channels should stay within `1e-4 kg/m²` of the frozen E1 values when tracing is disabled
- if that threshold is not met, the later phase is invalid until reconciled

## Locked boundaries for later ledgers

The pre-vertical ownership story must be closed across these boundaries:

1. end of previous `stepMicrophysics5`
2. start of current step
3. after `stepSurface2D5`
4. after `stepRadiation2D5`
5. after wind updates
6. after `stepAdvection5`
7. immediately before `stepVertical5`

## Stop conditions

No upstream patch-placement proof is allowed until later phases show all of the following:

- target-cell budget closure at or above `0.99`
- corridor budget closure at or above `0.97`
- one primary owner of the excess pre-vertical cloud
- at most one secondary co-owner
- a falsifiable explanation for why the non-owning buckets are not primary

## Contract result

This contract freezes the problem as:

- not a broad day-30 metric hunt
- not a generic “too much subtropical cloud” story
- specifically an excess upper-cloud reservoir already present in the frozen east-Pacific NH dry-belt corridor before `stepVertical5` on replay step `0`

The next phases must prove who owns that reservoir before they are allowed to design the patch.
