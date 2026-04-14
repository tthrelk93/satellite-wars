# Phase 1ZC Shoulder Guard Reintegration Audit

## Scope

- Same-branch off audit: `/tmp/phase1zb-off.json`
- Same-branch on audit: `/tmp/phase1zb-on.json`

## Verdict

- same_lane_vapor_recharge
- Next phase: Phase 1ZD: Suppressed-Mass Fate Design
- The next phase should stop redesigning selector geometry and instead explain how the suppressed 3–12°N marine condensation mass is recharging the same shoulder lane and spilling into 18.75°N.

## Off Versus On

- `itczWidthDeg`: `25.834` -> `25.89` (delta `0.056`)
- `subtropicalDryNorthRatio`: `1.515` -> `1.527` (delta `0.012`)
- `subtropicalDrySouthRatio`: `1.192` -> `1.197` (delta `0.005`)

## Band Diagnostics

- tropical shoulder core net condensation delta: `0.01603`
- tropical shoulder core reconstructed raw condensation delta: `0.03461`
- tropical shoulder core applied suppression on: `0.01858`
- tropical shoulder core TCW delta: `0.1055`
- tropical shoulder core mid-RH delta: `0.003`
- adjacent shoulder spillover delta: `0.00635`
- adjacent shoulder TCW delta: `0.168`
- adjacent shoulder mid-RH delta: `0.007`
- target-entry applied suppression on: `0`

## Key Slices

- shoulder `3.75°N`: off/on final condensation `0.07641` / `0.09188`, on applied `0.0122`, on reconstructed raw `0.10408`
- shoulder `11.25°N`: off/on final condensation `0.12779` / `0.14437`, on applied `0.02496`, on reconstructed raw `0.16933`
- spillover `18.75°N`: off/on condensation `0.10309` / `0.10944`, on applied `0`
- source `26.25°N`: off/on condensation `0.12559` / `0.10811`
- target entry `33.75°N`: off/on candidate `0` / `0`, on exclusion `1`

## Ranked Residuals

1. same_lane_vapor_recharge: Suppressed shoulder condensation is reappearing as a same-lane vapor recharge inside the corrected 3–12°N selector. (score `1`)
2. adjacent_ungated_shoulder_spillover: A secondary share of the rebound spills poleward into the ungated 12–22.5°N shoulder-adjacent lane. (score `1`)

## Assessment

- ruled in: The corrected selector is active in the right 3–12°N shoulder cells, but the same lane becomes moister and more RH-rich, so reconstructed raw condensation rises faster than the applied suppression.
- ruled in: A smaller secondary rebound leaks into 18.75°N even though the guard never fires there.
- ruled out: This is no longer a 30–45°N target-entry false-positive problem.
- ambiguous: Whether the next fix should route suppressed mass into a local sink, a delayed rainout path, or a narrower inner-vs-outer shoulder split is still unresolved.
