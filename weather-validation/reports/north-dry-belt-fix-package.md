# North Dry-Belt Fix Package

Use this package from the current best Phase 1 baseline at commit `e6fea58`.

## Why this is the right next package

The latest kept 30-day baseline is:
- [phase1-hadley-second-pass-restore-v4.json](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/weather-validation/output/phase1-hadley-second-pass-restore-v4.json)

Current best metrics:
- `itczWidthDeg = 23.646`
- `subtropicalDryNorthRatio = 1.100`
- `subtropicalDrySouthRatio = 0.519`
- `subtropicalSubsidenceNorthMean = 0.065`
- `subtropicalSubsidenceSouthMean = 0.038`
- `tropicalTradesNorthU10Ms = -0.788`
- `tropicalTradesSouthU10Ms = -0.328`
- `midlatitudeWesterliesNorthU10Ms = 1.192`
- `midlatitudeWesterliesSouthU10Ms = 0.943`

So the remaining failure is narrow:
- the north subtropical dry belt is still too wet
- south subtropical subsidence is already fixed
- trades and westerlies are already acceptable
- ITCZ width is already improved and should not be re-broadened

## Failure signature

The north-side dry belt is not failing because subtropical descent is absent. It is failing because too much moisture still survives into low-level cloud/rain in weakly forced north-subtropical columns.

North dry-belt zonal profile from the kept baseline:
- `33.75N`: precip `0.204`, cloud `0.830`, TCW `33.54`, RH `0.550`, subsidence drying `0.041`, convective fraction `0.000`, organization `0.109`
- `26.25N`: precip `0.078`, cloud `0.657`, TCW `38.85`, RH `0.428`, subsidence drying `0.070`, convective fraction `0.000`, organization `0.035`
- `18.75N`: precip `0.149`, cloud `0.635`, TCW `38.24`, RH `0.373`, subsidence drying `0.081`, convective fraction `0.000`, organization `0.030`

South dry-belt reference:
- `26.25S`: precip `0.071`, cloud `0.460`, TCW `24.52`, RH `0.262`, subsidence drying `0.041`
- `18.75S`: precip `0.076`, cloud `0.412`, TCW `22.88`, RH `0.280`, subsidence drying `0.036`

Interpretation:
- the north side already has meaningful subtropical drying
- but it still carries much larger total-column water and cloud fraction than the south
- convective organization is nearly zero in the failing north band, so the leak is not primarily deep convection
- the wet bias is most likely in marginal warm-rain / stratiform retention and insufficient virga in descending dry-belt columns

## Exact next fix package

### 1. Add dry-belt virga scaling in `microphysics5.js`

Target file:
- [microphysics5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/microphysics5.js)

Add a local `dryBeltVirgaStrength` that is high only when all of these are true:
- subtropical drying is already active
- lower-level moisture convergence is weak
- convective organization is weak
- lower-tropospheric RH is below a modest threshold

Use it to:
- shorten `tauEvapRain` further in marginal dry-belt columns
- slightly shorten `tauEvapCloud` in the same regime
- increase snow sublimation modestly only if RH is already low

Do not apply it:
- in organized tropical convection
- in strong moisture-convergence columns
- in lee-side terrain delivery columns that already have a separate precipitation logic

Implementation target:
- increase virga / rain evaporation in `18-35 deg` descending columns without changing organized equatorial rain

### 2. Split marginal warm-rain suppression from organized tropical rain in `microphysics5.js`

The current package already suppresses warm rain in subtropical subsidence, but the remaining bias suggests it is still not selective enough.

Add a second factor, something like `marginalWarmRainSuppression`, driven by:
- low organization
- low mass flux
- active subtropical drying
- low convergence

Use it to:
- reduce `kAutoRain` more aggressively than `kAutoSnow`
- reduce `precipEff` only in weakly organized subtropical columns
- leave organized tropical columns almost unchanged

Important constraint:
- this should be stronger than the current broad `marginalSubsiding` penalty, but only when organization and convergence are both weak

### 3. Add cloud-retention bleed in descending dry-belt columns

Problem:
- north dry-belt cloud fractions are still too high even where deep convection is basically absent

Add a weak `dryBeltCloudLoss` path that:
- activates only in subtropical descending columns
- removes a small fraction of `qc` and `qi` before those clouds become persistent low-level drizzle
- scales with active dry-belt descent and weak convective support

This should be weaker than ordinary evaporation and should act as a cleanup term, not a dominant sink.

Goal:
- reduce the north dry-belt cloud deck from the current `0.635-0.830` toward the south pattern without collapsing cloud elsewhere

### 4. Tighten the tropical-to-subtropical transition in `vertical5.js`

Target file:
- [vertical5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/vertical5.js)

The transition just poleward of the ITCZ is still a little too permissive. Add a narrow suppression on organized-convection persistence in the `12-22 deg` band when:
- low-level convergence is weak
- ascent support is weak or neutral
- subtropical drying is already active nearby

Use this only to decay residual organization/potential faster in the transition zone.

Do not:
- reduce tropical core organization
- directly weaken trades
- broaden the equatorial band

This should keep the north transition from feeding diffuse rain into the dry belt.

### 5. Do not change `nudging5.js` first

Recent experiments showed that harder humidity-relaxation asymmetry regressed the climate.

For this package:
- keep [nudging5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/nudging5.js) unchanged unless the pure physics package still leaves the north belt above `1.0`
- if a nudge change is needed afterward, make it a very small follow-up guardrail only

## Parameters to add

Suggested new params in [core5.js](/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass/src/weather/v2/core5.js) defaults:

For `microParams`:
- `dryBeltVirgaRh0`
- `dryBeltVirgaRh1`
- `dryBeltVirgaBoost`
- `dryBeltWarmRainSuppress`
- `dryBeltCloudBleed`
- `dryBeltLowConvergenceRef`

For `vertParams`:
- `subtropicalTransitionLat0`
- `subtropicalTransitionLat1`
- `subtropicalTransitionDecayBoost`

## Acceptance gate for this exact package

Run:
- `npm run agent:planetary-realism-audit -- --preset quick --report-base weather-validation/output/phase1-hadley-north-dry-belt-package`

Require:
- `subtropicalDryNorthRatio < 0.95` as the immediate target
- stretch goal: `subtropicalDryNorthRatio < 0.8`
- `subtropicalDrySouthRatio <= 0.56`
- `subtropicalSubsidenceSouthMean >= 0.03`
- `subtropicalSubsidenceNorthMean >= 0.06`
- `itczWidthDeg <= 23.8`
- `tropicalTradesNorthU10Ms <= -0.75`
- `tropicalTradesSouthU10Ms <= -0.30`
- no new storm-track or westerly regression

If this package improves north dry-belt ratio but still lands between `0.95` and `1.05`, do not abandon it. Promote it to a 40-day follow-through run first.

## What this package is trying to avoid

Do not repeat these failure modes:
- stronger hemispheric asymmetry in subtropical drying itself
- heavier qv-nudging suppression
- global harsher drying that helps the north but breaks the south
- broad precipitation-efficiency cuts that simply make the whole planet drier

## Why this package has the best chance

It targets the exact remaining mismatch:
- too much north-subtropical cloud and rain with almost no organized convection
- not a lack of descent
- not a lack of trade winds
- not a broad ITCZ problem

So the best next move is not “more circulation forcing.”
It is:
- more virga
- less marginal warm rain
- less weak subtropical cloud persistence
- a sharper transition out of organized tropical convection

That is the smallest structural package with the best chance of finally clearing the north dry-belt gate.
