import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainment35degInterfaceEddySofteningAndEquatorialEddyGuardPatch,
  classifyC66Decision,
  renderArchitectureC66Markdown
} from '../../scripts/agent/earth-weather-architecture-c66-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-35deg-interface-eddy-softening-and-equatorial-eddy-guard-experiment.mjs';

test('classifyC66Decision marks quick rejects when severe regressions remain', () => {
  const decision = classifyC66Decision({
    quickGatePass: false,
    annualGatePass: null
  });

  assert.equal(decision.verdict, 'quick_reject');
  assert.equal(decision.nextMove, 'Architecture C67: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and equatorial eddy guard attribution');
});

test('renderArchitectureC66Markdown includes the equatorial guard contract', () => {
  const markdown = renderArchitectureC66Markdown({
    decision: {
      verdict: 'quick_reject',
      nextMove: 'Architecture C67: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment, 35deg interface eddy softening, and equatorial eddy guard attribution'
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
      patchedPaths: ['src/weather/v2/core5.js', 'src/weather/v2/vertical5.js', 'src/weather/v2/windEddyNudge5.js'],
      patchedParams: ['windEddyParams.equatorialGuardBlendToUnityFrac']
    }
  });

  assert.match(markdown, /Architecture C66 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment 35deg Interface Eddy Softening And Equatorial Eddy Guard Experiment/);
  assert.match(markdown, /equatorial eddy guard/i);
  assert.match(markdown, /35deg interface eddy-softening/i);
});

test('applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainment35degInterfaceEddySofteningAndEquatorialEddyGuardPatch tightens the equatorial softening lane on top of C64', async (t) => {
  const tmpDir = t.testDir ? t.testDir() : await fs.promises.mkdtemp('/tmp/c66-guard-');
  const corePath = `${tmpDir}/src/weather/v2/core5.js`;
  const verticalPath = `${tmpDir}/src/weather/v2/vertical5.js`;
  const eddyPath = `${tmpDir}/src/weather/v2/windEddyNudge5.js`;
  await fs.promises.mkdir(`${tmpDir}/src/weather/v2`, { recursive: true });
  await fs.promises.writeFile(corePath, `
    this.windEddyParams = {
      enable: true,
      tauSeconds: 10 * 86400,
      scaleClampMin: 0.5,
      scaleClampMax: 2.0,
      eps: 1e-6
    };
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
import { LAT_DEG, EKE10M_BY_LAT_TARGET, SOURCE_FIXTURE_COUNT } from './windClimoTargets.js';
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
  const latDeg = 35;
  const scaleRaw = 1.4;
    const scale = Math.max(scaleClampMin, Math.min(scaleClampMax, scaleRaw));
    const blend = lerp(1, scale, relax);
  return { tauSeconds, scaleClampMin, scaleClampMax, eps, blend, latDeg, LAT_DEG, EKE10M_BY_LAT_TARGET, SOURCE_FIXTURE_COUNT };
}
`);

  const summary = applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainment35degInterfaceEddySofteningAndEquatorialEddyGuardPatch(tmpDir);
  const patchedCore = await fs.promises.readFile(corePath, 'utf8');
  const patchedEddy = await fs.promises.readFile(eddyPath, 'utf8');

  assert.match(patchedCore, /equatorialSofteningLat1Deg: 8/);
  assert.match(patchedCore, /equatorialBlendToUnityFrac: 0\.3/);
  assert.match(patchedEddy, /equatorialSofteningLat1Deg = 8/);
  assert.match(patchedEddy, /equatorialBlendToUnityFrac = 0\.3/);
  assert.ok(summary.patchedParams.includes('windEddyParams.equatorialGuardBlendToUnityFrac'));
});
