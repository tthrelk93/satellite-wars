import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyZonalMeanPreservingEddyNudgeSofteningPatch,
  classifyC20Decision,
  renderArchitectureC20Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c20-zonal-mean-preserving-eddy-nudge-softening-experiment.mjs';

test('classifyC20Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC20Decision({
    quickGatePass: false,
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C21: eddy-softening implementation attribution');
});

test('renderArchitectureC20Markdown includes the eddy-softening patch contract', () => {
  const markdown = renderArchitectureC20Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C21: eddy-softening implementation attribution'
    },
    quickRows: [
      {
        label: 'ITCZ width',
        off: 25.91,
        on: 23.5,
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
      patchedPaths: ['src/weather/v2/core5.js'],
      patchedParams: ['windEddyParams.tauSeconds']
    }
  });

  assert.match(markdown, /Architecture C20 Zonal-Mean-Preserving Eddy Nudge Softening Experiment/);
  assert.match(markdown, /windEddyParams\.tauSeconds/);
  assert.match(markdown, /quick gate pass: false/);
});

test('applyZonalMeanPreservingEddyNudgeSofteningPatch rewrites wind-eddy defaults', async (t) => {
  const tmpDir = t.testDir ? t.testDir() : await fs.promises.mkdtemp('/tmp/c20-core-');
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
      tauSeconds: 10 * 86400,
      scaleClampMin: 0.5,
      scaleClampMax: 2.0,
`);
  await fs.promises.writeFile(verticalPath, `
    carryInputSubtropicalSuppressionMin = 0.74243,
    carryInputOrganizedSupportMax = 0.22504,
    carryInputPotentialMax = 0.24341,
    carryInputDominanceMin = 0.93785,
    carryInputMinResidualMassKgM2 = 3.40503,
`);
  const summary = applyZonalMeanPreservingEddyNudgeSofteningPatch(tmpDir);
  const patched = await fs.promises.readFile(corePath, 'utf8');

  assert.match(patched, /tauSeconds: 30 \* 86400/);
  assert.match(patched, /scaleClampMin: 0.85/);
  assert.match(patched, /scaleClampMax: 1.15/);
  assert.ok(summary.patchedParams.includes('windEddyParams.scaleClampMax'));
});
