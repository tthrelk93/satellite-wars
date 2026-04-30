import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyZonalMeanPreservingUpperCloudCarryoverCarveoutPatch,
  classifyC17Decision,
  renderArchitectureC17Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c17-zonal-mean-preserving-upper-cloud-carryover-carveout-experiment.mjs';

test('classifyC17Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC17Decision({
    quickGatePass: false,
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C18: carryover carveout implementation attribution');
});

test('renderArchitectureC17Markdown includes the carryover carveout contract', () => {
  const markdown = renderArchitectureC17Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C18: carryover carveout implementation attribution'
    },
    quickRows: [
      {
        label: 'ITCZ width',
        off: 25.91,
        on: 24.0,
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
      patchedPaths: ['src/weather/v2/core5.js', 'src/weather/v2/vertical5.js'],
      patchedParams: ['vertical5.carryInputDominanceMin']
    }
  });

  assert.match(markdown, /Architecture C17 Zonal-Mean-Preserving Upper-Cloud Carryover Carveout Experiment/);
  assert.match(markdown, /vertical5\.carryInputDominanceMin/);
  assert.match(markdown, /quick gate pass: false/);
});

test('applyZonalMeanPreservingUpperCloudCarryoverCarveoutPatch rewrites carry-input dominance thresholds', async (t) => {
  const tmpDir = t.testDir ? t.testDir() : await fs.promises.mkdtemp('/tmp/c17-core-');
  const corePath = `${tmpDir}/src/weather/v2/core5.js`;
  const verticalPath = `${tmpDir}/src/weather/v2/vertical5.js`;
  await fs.promises.mkdir(`${tmpDir}/src/weather/v2`, { recursive: true });
  await fs.promises.writeFile(corePath, `
      tauQvS: 30 * 86400,
      landQvNudgeScale: 0.5,
      oceanQvNudgeScale: 1.0,
      tauQvColumn: 12 * 86400,
      tauSurfaceSeconds: 7 * 86400,
      rhTrig: 0.75,
      rhMidMin: 0.25,
      omegaTrig: 0.3,
      instabTrig: 3,
      qvTrig: 0.002,
      thetaeCoeff: 10,
      thetaeQvCap: 0.03,
      enableOmegaMassFix: true,
`);
  await fs.promises.writeFile(verticalPath, `
    carryInputSubtropicalSuppressionMin = 0.74243,
    carryInputOrganizedSupportMax = 0.22504,
    carryInputPotentialMax = 0.24341,
    carryInputDominanceMin = 0.93785,
    carryInputMinResidualMassKgM2 = 3.40503,
`);
  const summary = applyZonalMeanPreservingUpperCloudCarryoverCarveoutPatch(tmpDir);
  const patchedVertical = await fs.promises.readFile(verticalPath, 'utf8');

  assert.match(patchedVertical, /carryInputSubtropicalSuppressionMin = 0.58/);
  assert.match(patchedVertical, /carryInputOrganizedSupportMax = 0.42/);
  assert.match(patchedVertical, /carryInputDominanceMin = 0.72/);
  assert.match(patchedVertical, /carryInputMinResidualMassKgM2 = 1.2/);
  assert.ok(summary.patchedParams.includes('vertical5.carryInputPotentialMax'));
});
