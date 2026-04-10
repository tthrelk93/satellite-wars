# Climate Physics Campaign

Use this roadmap whenever `worker-brief.md` reports `climatePhysicsDue = true` or the planetary audit still shows broad realism blockers.

## Mission

Land climate-model improvements that materially change the planet-scale weather, not just the browser/runtime harness around it.

## Current annual diagnosis

The latest 365-day audit says the model is stable enough to learn from, but still fails the broad Earth-like climate bar.

Current annual blockers from `weather-validation/output/annual-planetary-realism.md`:
- ITCZ is too broad all year: latest width `25.693 deg`
- subtropical dry belts are too wet: latest dry-belt ratios `1.524` north and `1.075` south against a target below `0.8`
- subtropical descending branches are too weak: latest subsidence drying `0.022` north and `0.003` south against a target above `0.03`
- organized tropical convection is too weak/shallow to sustain realistic moisture export:
  - convective organization `0.289`
  - convective potential `0.404`
  - convective mass flux `0.00026`
  - upper detrainment `0.00218 kg/m²`
  - anvil persistence `0.012`
- downstream seasonal storm/cyclone structure is still weak:
  - NH warm/cool tropical cyclone environment `0 / 0.557`
  - SH warm/cool tropical cyclone environment `0 / 0`

Interpretation:
- the model is not primarily failing because circulation is absent
- it is failing because tropical ascent is too diffuse, moisture export is too weak, and subtropical subsidence is not drying the 15-35 deg belts enough
- storm seasonality should be treated as a downstream validation target until the moisture belts are fixed

## Core strategy

Attack the remaining realism gap in this order:

1. `Hadley-cell moisture partitioning`
   - tighten tropical ascent into a narrower, more organized overturning core
   - strengthen compensating subtropical drying
   - reduce diffuse precipitation leaking into the dry belts

2. `Organized tropical convection and upper-level outflow`
   - make mass flux, detrainment height, and anvil persistence stronger when convection is truly organized
   - keep marginal subtropical convection weak instead of letting it mimic tropical deep convection

3. `Downstream storm-track and seasonal cyclone-support structure`
   - only after the broad moisture partition improves
   - use as a seasonal follow-through check, not as the first repair lane

## Campaign phases

### Phase 1: Tighten Hadley Moisture Partitioning

Objective:
- get the dry-belt ratios below `0.8`
- get subtropical subsidence drying above `0.03` north and south
- narrow ITCZ width into `6-24 deg` without killing trades or equatorial rain

Primary files:
- `src/weather/v2/vertical5.js`
- `src/weather/v2/microphysics5.js`
- `src/weather/v2/core5.js`
- `src/weather/v2/nudging5.js`

What to change:
- in `vertical5.js`
  - make organized tropical ascent more selective and persistent near the equator
  - strengthen the linkage between sustained organized ascent and off-equatorial compensating drying
  - make subtropical convection decay faster when moisture convergence and organized support are weak
- in `microphysics5.js`
  - reduce broad diffuse rainout in marginal subtropical columns
  - increase the separation between organized equatorial rain production and weak subtropical drizzle/cloud retention
  - make moisture export aloft stronger relative to low-level local rainout when organization is high
- in `core5.js`
  - tune the coupling between convective heating, moisture export, and the broad overturning tendency
  - avoid global knob sweeps that improve one hemisphere by making the whole tropics wetter
- in `nudging5.js`
  - keep nudging in a guardrail role; do not let it re-humidify subtropics that the improved overturning is trying to dry

Phase-1 acceptance gates:
- quick 30-day audit:
  - north dry-belt ratio improved materially from `1.524`
  - south dry-belt ratio improved materially from `1.075`
  - ITCZ width reduced from `25.693`
  - north and south subsidence drying both improved
- no regression in:
  - tropical trades
  - midlatitude westerlies
  - global stability metrics

### Phase 2: Strengthen Organized Tropical Convection And Upper-Level Outflow

Objective:
- increase organized convection strength without simply inflating rainfall everywhere
- raise upper-level detrainment and anvil persistence enough that the tropics export moisture and energy more like Earth

Primary files:
- `src/weather/v2/vertical5.js`
- `src/weather/v2/microphysics5.js`

What to change:
- in `vertical5.js`
  - make organized convection persistence accumulate more strongly when low-level moisture convergence and instability stay co-located
  - make entrainment/detrainment more nonlinear with organization so true ITCZ columns deepen while marginal subtropical columns stay shallow
  - allow organized mass flux to maintain upper-level outflow longer instead of collapsing too quickly between steps
- in `microphysics5.js`
  - let organized convection produce a clearer stratiform/anvil tail aloft
  - reduce premature warm-rain conversion in columns that should be exporting condensate upward
  - tie evaporation and rainout penalties more strongly to environmental dryness and weak organization

Phase-2 acceptance gates:
- quick or seasonal audit:
  - tropical convective organization above the current `0.289`
  - tropical convective mass flux above the current `0.00026`
  - upper detrainment above the current `0.00218 kg/m²`
  - anvil persistence above the current `0.012`
- the dry belts continue improving or at least do not regress

### Phase 3: Seasonal Storm Structure And Cyclone-Support Follow-Through

Objective:
- once tropical/subtropical climate is healthier, improve storm-track asymmetry and seasonal cyclone-support realism

Primary files:
- `src/weather/v2/core5.js`
- `src/weather/v2/vertical5.js`
- `src/weather/v2/microphysics5.js`

What to change:
- correct storm-track latitude asymmetry if it persists after the moisture belts improve
- strengthen hemisphere-appropriate warm-season cyclone-support contrast
- improve baroclinic organization and seasonal background state only after the annual moisture partition is credible

Phase-3 acceptance gates:
- seasonal or annual audit:
  - NH warm-season cyclone-support stronger than NH cool season
  - SH warm-season cyclone-support stronger than SH cool season
  - storm-track peaks remain in believable bands while seasonal asymmetry improves

### Phase 4: Annual Signoff

Only claim near-Earth climate behavior when:
- annual ITCZ width is inside the target band for most months
- dry-belt ratios stay below `0.8` in both hemispheres
- subtropical subsidence drying clears `0.03` north and south
- organized convection and upper-level outflow remain healthy across the year
- seasonal cyclone-support contrast is believable in both hemispheres
- no stability or hydrology collapse emerges over 365 days

## Campaign ordering

1. `ITCZ placement and subtropical dry-belt moisture partitioning`
   - Current blocker because the annual audit still shows wet subtropics and weak subtropical descent even though circulation survives.
   - Primary modules to inspect first:
     - `src/weather/v2/core5.js`
     - `src/weather/v2/vertical5.js`
     - `src/weather/v2/microphysics5.js`
     - `src/weather/v2/nudging5.js`
   - Most relevant levers already proven sensitive:
     - continuous convective state persistence and decay
     - organized mass-flux scaling
     - detrainment and rainout coupling
     - latitude-aware subtropical drying
     - nudging relief against broad moisture-belt bias
   - Goal:
     - reduce dry-belt wet bias without killing trades, westerlies, or equatorial precipitation

2. `Organized tropical convection and upper-level outflow`
   - Use immediately after or alongside dry-belt work when the ITCZ is still too broad or too weakly organized.
   - Primary modules:
     - `src/weather/v2/vertical5.js`
     - `src/weather/v2/microphysics5.js`
   - Goal:
     - raise mass flux, detrainment, and anvil persistence so the tropics export moisture and energy more realistically

3. `Large-scale circulation and jet placement`
   - Use after any dry-belt or convection change that degrades trade winds, westerlies, or storm-track placement.
   - Primary modules:
     - `src/weather/v2/core5.js`
     - `src/weather/v2/nudging5.js`
     - `src/weather/v2/windNudge5.js`
     - `src/weather/v2/dynamics5.js`
   - Goal:
     - preserve realistic Hadley/Ferrel structure while the moisture and convection fixes land

4. `Storm evolution and cyclone structure`
   - Use once the broad circulation and moisture belts are stable enough that storms are worth trusting.
   - Primary modules:
     - `src/weather/v2/vertical5.js`
     - `src/weather/v2/microphysics5.js`
     - `src/weather/v2/advect5.js`
   - Goal:
     - improve frontal precipitation organization, cyclogenesis, comma-head structure, and storm lifetimes

5. `Tropical cyclone / hurricane seasonality`
   - Only elevate this after the annual moisture and circulation structure are healthy enough to support a year-scale claim.
   - Primary modules:
     - `src/weather/v2/core5.js`
     - `src/weather/v2/vertical5.js`
     - `src/weather/v2/microphysics5.js`
     - `src/weather/v2/radiation2d.js`
   - Goal:
     - get tropical cyclone environments and seasonality into believable geographic/seasonal windows

6. `Multi-day or seasonal stability`
   - Promote to the top once quick, seasonal, and annual moisture-belt behavior are all close enough that the remaining question is persistence.
   - Required evidence:
     - `quick` 30-day planetary audit
     - `seasonal` 90-day planetary audit
     - `annual` 365-day planetary audit before any world-class claim

## Concrete execution rules

For the next climate work, prefer this loop:

1. pick one of the top 2 annual physics targets
2. make a structural change in `vertical5.js` and/or `microphysics5.js`
3. run `quick` audit first
4. if `quick` improves the named blocker and does not obviously regress circulation, run `seasonal`
5. only run `annual` when the `quick` and `seasonal` results are promising enough to justify the cost

Do not keep doing:
- isolated threshold retunes in `rhTrig`, `qvTrig`, `omegaTrig`, or `thetaeCoeff` without changing the closure structure
- storm/cyclone tuning before the moisture belts are credible
- runtime/browser work as a substitute for climate progress

## Success scorecard

The next climate fix should be treated as a win only if it moves at least one of these materially in the right direction without obviously hurting the others:
- `itczWidthDeg`
- `subtropicalDryNorthRatio`
- `subtropicalDrySouthRatio`
- `subtropicalSubsidenceNorthMean`
- `subtropicalSubsidenceSouthMean`
- `tropicalConvectiveOrganization`
- `tropicalConvectiveMassFluxKgM2S`
- `upperDetrainmentTropicalKgM2`
- `tropicalAnvilPersistenceFrac`

## Runtime lane rule

Runtime/perf/parity work is only justified when:
- it validates the immediately previous climate change,
- it is the narrowest blocker to observing a climate change,
- or a live/browser path is provably lying about the current climate baseline.

Do not stay in the runtime lane for more than one fresh cycle while this campaign still has unresolved items.

## What counts as success

- a verified commit that changes climate/weather-core behavior in `src/weather/` or closely coupled weather-core code
- fresh planetary audit evidence that improves the named blocker
- for annual work, a new `annual-planetary-realism-physics-targets` report that downgrades the current top blocker or changes the top-3 ordering for a physically meaningful reason
- no obvious regression in trades, westerlies, storm tracks, equatorial precipitation, or seasonal follow-through

## What does not count as success

- UI-only polish
- browser-helper-only wins
- runtime-only fixes when the planetary audit is still failing on a broad climate blocker
- live-probe/parity improvements without a return to climate code in the next fresh cycle
