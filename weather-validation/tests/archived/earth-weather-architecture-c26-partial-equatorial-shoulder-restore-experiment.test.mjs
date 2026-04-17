import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyPartialEquatorialShoulderRestorePatch,
  classifyC26Decision,
  renderArchitectureC26Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c26-partial-equatorial-shoulder-restore-experiment.mjs';

test('classifyC26Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC26Decision({
    quickGatePass: false,
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C27: partial equatorial shoulder restore attribution');
});

test('renderArchitectureC26Markdown includes the shoulder-restore contract', () => {
  const markdown = renderArchitectureC26Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C27: partial equatorial shoulder restore attribution'
    },
    quickRows: [
      {
        label: 'ITCZ width',
        off: 25.91,
        on: 23.3,
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
      patchedPaths: ['src/weather/v2/core5.js', 'src/weather/v2/windEddyNudge5.js'],
      patchedParams: ['windEddyParams.partialShoulderRestoreLat1Deg']
    }
  });

  assert.match(markdown, /Architecture C26 Partial Equatorial Shoulder Restore Experiment/);
  assert.match(markdown, /partial shoulder-restore quick artifact/);
  assert.match(markdown, /quick gate pass: false/);
});

test('applyPartialEquatorialShoulderRestorePatch restores a modest outer shoulder on top of C24', async (t) => {
  const tmpDir = t.testDir ? t.testDir() : await fs.promises.mkdtemp('/tmp/c26-shoulder-');
  const corePath = `${tmpDir}/src/weather/v2/core5.js`;
  const verticalPath = `${tmpDir}/src/weather/v2/vertical5.js`;
  const eddyPath = `${tmpDir}/src/weather/v2/windEddyNudge5.js`;
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
      eps: 1e-6
`);
  await fs.promises.writeFile(verticalPath, `
    carryInputSubtropicalSuppressionMin = 0.74243,
    carryInputOrganizedSupportMax = 0.22504,
    carryInputPotentialMax = 0.24341,
    carryInputDominanceMin = 0.93785,
    carryInputMinResidualMassKgM2 = 3.40503,
`);
  await fs.promises.writeFile(eddyPath, `
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
export function stepWindEddyNudge5({ params = {} }) {
  const {
    tauSeconds = 10 * 86400,
    scaleClampMin = 0.5,
    scaleClampMax = 2.0,
    eps = 1e-6
  } = params;
  const relax = 0.5;
    const scaleRaw = 1.4;
    const scale = Math.max(scaleClampMin, Math.min(scaleClampMax, scaleRaw));
    const blend = lerp(1, scale, relax);
  return { tauSeconds, scaleClampMin, scaleClampMax, eps, blend };
}
`);
  const summary = applyPartialEquatorialShoulderRestorePatch(tmpDir);
  const patchedCore = await fs.promises.readFile(corePath, 'utf8');
  const patchedEddy = await fs.promises.readFile(eddyPath, 'utf8');

  assert.match(patchedCore, /equatorialSofteningLat0Deg: 0/);
  assert.match(patchedCore, /equatorialSofteningLat1Deg: 12/);
  assert.match(patchedCore, /equatorialBlendToUnityFrac: 0.5/);
  assert.match(patchedEddy, /equatorialSofteningLat0Deg = 0/);
  assert.match(patchedEddy, /equatorialSofteningLat1Deg = 12/);
  assert.match(patchedEddy, /equatorialBlendToUnityFrac = 0.5/);
  assert.ok(summary.patchedParams.includes('windEddyParams.partialShoulderRestoreBlendToUnityFrac'));
});
