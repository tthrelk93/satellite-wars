# Climate Physics Campaign

Use this roadmap whenever `worker-brief.md` reports `climatePhysicsDue = true` or the planetary audit still shows broad realism blockers.

## Mission

Land climate-model improvements that materially change the planet-scale weather, not just the browser/runtime harness around it.

## Campaign ordering

1. `ITCZ placement and subtropical dry-belt moisture partitioning`
   - Current blocker because the quick and seasonal planetary audits still flag the north subtropical dry belt as too wet.
   - Primary modules to inspect first:
     - `src/weather/v2/core5.js`
     - `src/weather/v2/vertical5.js`
     - `src/weather/v2/microphysics5.js`
   - Most relevant levers already proven sensitive:
     - `vertParams.rhTrig`
     - `vertParams.rhMidMin`
     - `vertParams.omegaTrig`
     - `vertParams.instabTrig`
     - `vertParams.qvTrig`
     - `vertParams.thetaeCoeff`
     - `microParams.precipEffMicro`
   - Goal:
     - reduce dry-belt wet bias without killing trades, westerlies, or equatorial precipitation.

2. `Large-scale circulation and jet placement`
   - Use after any dry-belt change that degrades trade winds, westerlies, storm tracks, or ITCZ latitude.
   - Primary modules:
     - `src/weather/v2/core5.js`
     - `src/weather/v2/nudging5.js`
     - `src/weather/v2/windNudge5.js`
     - `src/weather/v2/dynamics5.js`
   - Goal:
     - preserve realistic Hadley/Ferrel structure while improving moisture partitioning.

3. `Storm evolution and cyclone structure`
   - Use once the broad circulation and moisture belts are stable enough that storms are worth trusting.
   - Primary modules:
     - `src/weather/v2/vertical5.js`
     - `src/weather/v2/microphysics5.js`
     - `src/weather/v2/advect5.js`
   - Goal:
     - improve frontal precipitation organization, cyclogenesis, comma-head structure, and storm lifetimes.

4. `Tropical cyclone / hurricane seasonality`
   - Only elevate this after the annual audit path is healthy enough to support a year-scale claim.
   - Primary modules:
     - `src/weather/v2/core5.js`
     - `src/weather/v2/vertical5.js`
     - `src/weather/v2/microphysics5.js`
     - `src/weather/v2/radiation2d.js`
   - Goal:
     - get tropical cyclone environments and seasonality into believable geographic/seasonal windows.

5. `Multi-day or seasonal stability`
   - Promote to the top once quick and seasonal audits are both clean enough that the remaining question is persistence.
   - Required evidence:
     - `quick` 30-day planetary audit
     - `seasonal` 90-day planetary audit
     - `annual` 365-day planetary audit before any world-class claim

## Runtime lane rule

Runtime/perf/parity work is only justified when:
- it validates the immediately previous climate change,
- it is the narrowest blocker to observing a climate change,
- or a live/browser path is provably lying about the current climate baseline.

Do not stay in the runtime lane for more than one fresh cycle while this campaign still has unresolved items.

## What counts as success

- a verified commit that changes climate/weather-core behavior in `src/weather/` or closely coupled weather-core code
- fresh planetary audit evidence that improves the named blocker
- no obvious regression in trades, westerlies, storm tracks, equatorial precipitation, or seasonal follow-through

## What does not count as success

- UI-only polish
- browser-helper-only wins
- runtime-only fixes when the planetary audit is still failing on a broad climate blocker
- live-probe/parity improvements without a return to climate code in the next fresh cycle
