import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyEquatorialBandEddySofteningCarveoutPatch,
  classifyC22Decision,
  renderArchitectureC22Markdown
} from '../../scripts/agent/earth-weather-architecture-c22-equatorial-band-eddy-softening-carveout-experiment.mjs';

test('classifyC22Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC22Decision({
    quickGatePass: false,
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C23: equatorial-band eddy softening attribution');
});

test('renderArchitectureC22Markdown includes the equatorial-band softening contract', () => {
  const markdown = renderArchitectureC22Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C23: equatorial-band eddy softening attribution'
    },
    quickRows: [
      {
        label: 'ITCZ width',
        off: 25.91,
        on: 23.4,
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
      patchedParams: ['windEddyParams.enableEquatorialBandSoftening']
    }
  });

  assert.match(markdown, /Architecture C22 Equatorial-Band Eddy Softening Carveout Experiment/);
  assert.match(markdown, /windEddyParams\.enableEquatorialBandSoftening/);
  assert.match(markdown, /quick gate pass: false/);
});

test('applyEquatorialBandEddySofteningCarveoutPatch adds equatorial-only softening controls', async (t) => {
  const tmpDir = t.testDir ? t.testDir() : await fs.promises.mkdtemp('/tmp/c22-core-');
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
  const summary = applyEquatorialBandEddySofteningCarveoutPatch(tmpDir);
  const patchedCore = await fs.promises.readFile(corePath, 'utf8');
  const patchedEddy = await fs.promises.readFile(eddyPath, 'utf8');

  assert.match(patchedCore, /enableEquatorialBandSoftening: true/);
  assert.match(patchedCore, /equatorialSofteningLat0Deg: 4/);
  assert.match(patchedEddy, /const smoothstep =/);
  assert.match(patchedEddy, /enableEquatorialBandSoftening = false/);
  assert.match(patchedEddy, /const softenedScale = lerp\(scale, 1,/);
  assert.ok(summary.patchedParams.includes('windEddyNudge5 equatorial band softening branch'));
});
