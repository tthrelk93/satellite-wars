# Phase 1ZD Suppressed-Mass Fate Design

## Scope

- Reintegration audit: `weather-validation/reports/phase1zc-shoulder-guard-reintegration-audit.json`

## Verdict

- in_place_vapor_retention
- Next phase: Phase 1ZE: Suppressed-Mass Fate Counterfactuals
- The next phase should compare a capped local sink/export path against a delayed-rainout path, because the current shoulder guard is leaving suppressed mass in-place as vapor and recharging the same lane.

## Live Reintegration Evidence

- tropical shoulder core net condensation delta: `0.01603`
- tropical shoulder core reconstructed raw condensation delta: `0.03461`
- tropical shoulder core applied suppression on: `0.01858`
- tropical shoulder core TCW delta: `0.1055`
- tropical shoulder core mid-RH delta: `0.003`
- adjacent shoulder spillover delta: `0.00635`

## One-Column Fate Witness

- qv sum off/on: `0.01663912` / `0.0167113` (delta `0.00007218`)
- qc sum off/on: `0.00036088` / `0.0002887` (delta `-0.00007218`)
- level-1 qv off/on: `0.01063912` / `0.0107113` (delta `0.00007218`)
- level-1 qc off/on: `0.00036088` / `0.0002887` (delta `-0.00007218`)
- final condensation off/on: `0.7022239` / `0.56177908`
- shoulder suppressed mass on: `0.14044477`

## Ranked Findings

1. in_place_vapor_retention: Suppressed shoulder mass is being retained locally as vapor in the current implementation. (score `1`)
2. adjacent_spillover_requires_fate_aware_solution: A smaller secondary rebound still leaks into the adjacent 12–22.5°N shoulder lane. (score `1`)
3. selector_geometry_is_no_longer_primary: Selector geometry is not the main blocker anymore. (score `1`)

## Design Options

1. local_sink_or_export_path: Route suppressed shoulder mass into a capped local sink/export path instead of leaving it in-place as vapor. (score `1`)
2. delayed_rainout_or_buffered_removal: Convert suppressed shoulder mass into a delayed rainout / buffered removal lane rather than immediate in-place retention. (score `0.95`)
3. selector_only_retune: Retune selector shape or amplitude again without changing suppressed-mass fate. (score `0`)
- local_sink_or_export_path rationale: Best fit to the live 3–12°N recharge and the one-column witness that shows more qv and less qc after suppression.
- delayed_rainout_or_buffered_removal rationale: Could reduce same-step recharge while keeping the patch conservative, but still needs proof it will not simply move the rebound by one step.
- selector_only_retune rationale: Not recommended. 1ZB/1ZC already proved the geometry is basically right and the target-entry false positive is resolved.

## Assessment

- ruled in: The current shoulder guard leaves more qv and less qc behind in the same column when it suppresses condensation.
- ruled in: That in-place vapor retention matches the 30-day increase in tropical-shoulder TCW and RH.
- ruled out: Another selector-geometry retune is not the primary next move.
- ambiguous: Whether the best fix is a local sink/export path or a delayed-rainout/buffered-removal path still needs counterfactual testing.
