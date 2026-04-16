import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyEquatorialOverturningSignContractPatch,
  classifyC13Decision,
  evaluateAnnualAbsoluteGate,
  renderArchitectureC13Markdown
} from '../../scripts/agent/earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.mjs';

test('classifyC13Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC13Decision({
    quickGatePass: false,
    severeRegressions: ['crossEquatorialVaporFluxNorthKgM_1S'],
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C14: sign-contract implementation attribution');
});

test('evaluateAnnualAbsoluteGate requires all six annual checks', () => {
  const gate = evaluateAnnualAbsoluteGate({
    itczWidthDeg: 24.1,
    subtropicalDryNorthRatio: 1.1,
    subtropicalDrySouthRatio: 0.7,
    midlatitudeWesterliesNorthU10Ms: 0.96,
    northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.17,
    crossEquatorialVaporFluxNorthKgM_1S: 120
  });

  assert.equal(gate.pass, true);
  assert.equal(gate.passedCount, 6);
});

test('renderArchitectureC13Markdown includes patched params and gate context', () => {
  const markdown = renderArchitectureC13Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C14: sign-contract implementation attribution'
    },
    quickRows: [
      {
        label: 'ITCZ width',
        off: 25.91,
        on: 24.3,
        improved: true,
        severeRegression: false
      }
    ],
    quickGate: {
      improvedCount: 1,
      severeRegressions: ['crossEquatorialVaporFluxNorthKgM_1S'],
      pass: false
    },
    annualGate: null,
    currentQuickPath: '/tmp/current.json',
    hybridQuickPath: '/tmp/hybrid.json',
    hybridAnnualPath: null,
    supportingArtifacts: {},
    bridgeSummary: {
      bridgedFiles: ['src/weather/v2/core5.js'],
      rewrittenImportCount: 4
    },
    patchSummary: {
      patchedCorePath: 'src/weather/v2/core5.js',
      patchedParams: ['windNudgeParams.tauSurfaceSeconds']
    }
  });

  assert.match(markdown, /Architecture C13 Equatorial Overturning Sign Contract Experiment/);
  assert.match(markdown, /windNudgeParams\.tauSurfaceSeconds/);
  assert.match(markdown, /quick gate pass: false/);
});

test('applyEquatorialOverturningSignContractPatch rewrites donor-core low-level defaults', async (t) => {
  const tmpDir = t.testDir ? t.testDir() : await fs.promises.mkdtemp('/tmp/c13-core-');
  const corePath = `${tmpDir}/src/weather/v2/core5.js`;
  await fs.promises.mkdir(`${tmpDir}/src/weather/v2`, { recursive: true });
  await fs.promises.writeFile(corePath, `
      tauQvS: 30 * 86400,
      landQvNudgeScale: 0.5,
      oceanQvNudgeScale: 1.0,
      tauQvColumn: 12 * 86400,
      tauSurfaceSeconds: 7 * 86400,
`);
  const summary = applyEquatorialOverturningSignContractPatch(tmpDir);
  const patched = await fs.promises.readFile(corePath, 'utf8');

  assert.match(patched, /tauQvS: 45 \* 86400/);
  assert.match(patched, /organizedConvectionQvSurfaceRelief: 0.85/);
  assert.match(patched, /tauQvColumn: 18 \* 86400/);
  assert.match(patched, /tauSurfaceSeconds: 8 \* 3600/);
  assert.equal(summary.patchedCorePath, 'src/weather/v2/core5.js');
});
