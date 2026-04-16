import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyPotentialHalfRelaxCarryInputPatch,
  classifyC34Decision,
  renderArchitectureC34Markdown
} from '../../scripts/agent/earth-weather-architecture-c34-potential-half-relax-carry-input-experiment.mjs';

test('classifyC34Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC34Decision({
    quickGatePass: false,
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C35: potential-half-relax carry-input attribution');
});

test('renderArchitectureC34Markdown includes the potential-half-relax contract', () => {
  const markdown = renderArchitectureC34Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C35: potential-half-relax carry-input attribution'
    },
    quickRows: [
      {
        label: 'ITCZ width',
        off: 25.91,
        on: 23.2,
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
      patchedParams: ['vertical5.potentialHalfRelaxCarryInputPotentialMax']
    }
  });

  assert.match(markdown, /Architecture C34 Potential-Half-Relax Carry-Input Experiment/);
  assert.match(markdown, /half-relaxes the convective-potential cap/);
  assert.match(markdown, /quick gate pass: false/);
});

test('applyPotentialHalfRelaxCarryInputPatch keeps strict support cap but half-relaxes potential on top of C30', async (t) => {
  const tmpDir = t.testDir ? t.testDir() : await fs.promises.mkdtemp('/tmp/c32-carry-');
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
  const summary = applyPotentialHalfRelaxCarryInputPatch(tmpDir);
  const patchedVertical = await fs.promises.readFile(verticalPath, 'utf8');

  assert.match(patchedVertical, /carryInputSubtropicalSuppressionMin = 0.46/);
  assert.match(patchedVertical, /carryInputOrganizedSupportMax = 0.42/);
  assert.match(patchedVertical, /carryInputPotentialMax = 0.47/);
  assert.match(patchedVertical, /carryInputDominanceMin = 0.58/);
  assert.match(patchedVertical, /carryInputMinResidualMassKgM2 = 0.7/);
  assert.ok(summary.patchedParams.includes('vertical5.organizedSupportCarryInputProtectiveMax'));
  assert.ok(summary.patchedParams.includes('vertical5.potentialHalfRelaxCarryInputPotentialMax'));
});
