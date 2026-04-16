import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyEquatorialVerticalStateContractPatch,
  classifyC15Decision,
  renderArchitectureC15Markdown
} from '../../scripts/agent/earth-weather-architecture-c15-equatorial-vertical-state-contract-experiment.mjs';

test('classifyC15Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC15Decision({
    quickGatePass: false,
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C16: vertical-contract implementation attribution');
});

test('renderArchitectureC15Markdown includes patched params and gate context', () => {
  const markdown = renderArchitectureC15Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C16: vertical-contract implementation attribution'
    },
    quickRows: [
      {
        label: 'ITCZ width',
        off: 25.91,
        on: 24.1,
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
      patchedParams: ['vertParams.rhTrig']
    }
  });

  assert.match(markdown, /Architecture C15 Equatorial Vertical-State Contract Experiment/);
  assert.match(markdown, /vertParams\.rhTrig/);
  assert.match(markdown, /quick gate pass: false/);
});

test('applyEquatorialVerticalStateContractPatch rewrites donor-core vertical defaults', async (t) => {
  const tmpDir = t.testDir ? t.testDir() : await fs.promises.mkdtemp('/tmp/c15-core-');
  const corePath = `${tmpDir}/src/weather/v2/core5.js`;
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
  const summary = applyEquatorialVerticalStateContractPatch(tmpDir);
  const patched = await fs.promises.readFile(corePath, 'utf8');

  assert.match(patched, /tauSurfaceSeconds: 8 \* 3600/);
  assert.match(patched, /rhTrig: 0.72/);
  assert.match(patched, /convPotentialGrowTau: 90 \* 60/);
  assert.match(patched, /subtropicalSubsidenceCrossHemiFloorFrac: 0.58/);
  assert.ok(summary.patchedParams.includes('vertParams subtropicalSubsidence contract'));
});
