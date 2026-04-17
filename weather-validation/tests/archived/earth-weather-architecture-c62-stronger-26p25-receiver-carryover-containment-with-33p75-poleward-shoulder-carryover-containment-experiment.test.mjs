import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainmentPatch,
  classifyC62Decision,
  renderArchitectureC62Markdown
} from '../../../scripts/agent/archived/earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-experiment.mjs';

test('classifyC62Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC62Decision({
    quickGatePass: false,
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C63: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment attribution');
});

test('renderArchitectureC62Markdown includes the 33.75 poleward-shoulder containment contract', () => {
  const markdown = renderArchitectureC62Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C63: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment attribution'
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
      patchedParams: ['vertical5.polewardShoulderCarryoverContainment33p75MaxFrac']
    }
  });

  assert.match(markdown, /Architecture C62 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment Experiment/);
  assert.match(markdown, /33\.75°.*poleward-shoulder carryover containment/i);
  assert.match(markdown, /quick gate pass: false/);
});

test('applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainmentPatch adds shoulder containment on top of C60', async (t) => {
  const tmpDir = t.testDir ? t.testDir() : await fs.promises.mkdtemp('/tmp/c62-carry-');
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
      if ((freshOrganizedSupportDiag[k] || 0) > carryInputOrganizedSupportMax) continue;
    const overlap = Math.min(previousUpperCloudMass, upperCloudMass);
    carriedOverUpperCloudMass[k] = overlap;
    weakErosionCloudSurvivalMass[k] = overlap * weakErosionSupport;
    importedAnvilPersistenceMass[k] = overlap * persistenceSupport;
      ? (overlap * (previousResidenceSeconds + dt) + localBirthMass * 0) / upperCloudMass
      ? (overlap * (previousLocalBirthSeconds + dt) + localBirthMass * 0) / upperCloudMass
    const nextImportSeconds = overlap > 0 ? previousImportSeconds + dt : 0;
    upperCloudTimeSinceImportMassWeightedSeconds[k] += overlap * nextImportSeconds;
    const recentlyImportedMass = overlap > 0 && nextImportSeconds <= recentlyImportedThresholdSeconds ? overlap : 0;
    const passiveSurvivalMass = overlap > 0 && localBirthMass <= upperCloudMass * 0.1 ? overlap : 0;
    const regenerationMass = overlap > 0 && localBirthMass > upperCloudMass * 0.1 ? localBirthMass : 0;
    const oscillatoryMass = overlap > 0 && localBirthMass > upperCloudMass * 0.05 && appliedErosionMass > potentialErosionMass * 0.05
      ? Math.min(overlap, localBirthMass)
    const blockedErosionMass = Math.max(0, potentialErosionMass - appliedErosionMass);
      const actualInputMass = verticalUpperCloudInputMass[k] || 0;
      if (!(actualInputMass >= carryInputMinResidualMassKgM2)) continue;
      if ((freshPotentialTargetDiag[k] || 0) > carryInputPotentialMax) continue;
      const rowIndex = Math.floor(k / nx);
      const latAbs = Math.abs(grid.latDeg?.[rowIndex] ?? 0);
      const transitionBandOrganizedSupportRestoreFrac = grid.latDeg
        ? smoothstep(12, 18, latAbs) * (1 - smoothstep(30, 36, latAbs))
        : 0;
      const effectiveCarryInputOrganizedSupportMax = carryInputOrganizedSupportMax
        + transitionBandOrganizedSupportRestoreFrac * Math.max(0, 0.47 - carryInputOrganizedSupportMax);
      if ((freshOrganizedSupportDiag[k] || 0) > effectiveCarryInputOrganizedSupportMax) continue;
      if ((freshSubtropicalSuppressionDiag[k] || 0) < carryInputSubtropicalSuppressionMin) continue;
      if (carryInputDominance < carryInputDominanceMin) continue;
      const removalMass = Math.min(overlap * 0.35 * receiverCarryoverContainment26p25Frac, upperCloudMass);
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

  const summary = applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainmentPatch(tmpDir);
  const patchedVertical = await fs.promises.readFile(verticalPath, 'utf8');

  assert.match(patchedVertical, /polewardShoulderCarryoverContainment33p75MaxFrac = 0\.18/);
  assert.match(patchedVertical, /containedOverlap \* polewardShoulderCarryoverContainment33p75MaxFrac \* polewardShoulderCarryoverContainment33p75Frac/);
  assert.ok(summary.patchedParams.includes('vertical5.polewardShoulderCarryoverContainment33p75MaxFrac'));
});
