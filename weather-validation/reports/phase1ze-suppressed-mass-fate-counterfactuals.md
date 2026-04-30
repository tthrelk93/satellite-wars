# Phase 1ZE Suppressed-Mass Fate Counterfactuals

## Scope

- off baseline: `/tmp/phase1ze-off.json`
- retain: `/tmp/phase1ze-retain.json`
- sink/export: `/tmp/phase1ze-sink.json`
- buffered rainout: `/tmp/phase1ze-buffered.json`

## Verdict

- no_counterfactual_clears_gate
- Next phase: Phase 1ZF: Shoulder Fate Patch Design
- No fate mode clears every guardrail yet. Buffered rainout is the best current direction, but it still needs a patch-design phase instead of a direct default enablement.

## Ranking

- buffered_rainout: score `0.98969`, exit pass `false`
  itcz delta `-0.042`, dry north delta `-0.04`, dry south delta `-0.009`
  shoulder core delta `0.00099`, spillover delta `-0.01452`, target-entry applied `0`
  retained `0`, sink/export `0`, buffered rainout `0.01403`
- sink_export: score `0.83333`, exit pass `false`
  itcz delta `-0.345`, dry north delta `-0.148`, dry south delta `0.105`
  shoulder core delta `-0.01967`, spillover delta `-0.03469`, target-entry applied `0`
  retained `0`, sink/export `0.00802`, buffered rainout `0`
- retain: score `0.17051`, exit pass `false`
  itcz delta `0.056`, dry north delta `0.012`, dry south delta `0.005`
  shoulder core delta `0.01603`, spillover delta `0.00635`, target-entry applied `0`
  retained `0.01858`, sink/export `0`, buffered rainout `0`
