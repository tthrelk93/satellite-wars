import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = '/Users/agentt/.openclaw/workspace/Developer/satellite-wars-worldclass';
const scriptPath = path.join(repoRoot, 'scripts/agent/earth-weather-branch-benchmark.mjs');

const writeAudit = (filePath, metrics) => {
  const payload = {
    horizons: [
      {
        horizonDays: 365,
        latest: {
          metrics
        }
      }
    ]
  };
  fs.writeFileSync(filePath, `${JSON.stringify(payload)}\n`);
};

test('branch benchmark selects rollback candidate when it wins four annual metrics without severe regression', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-benchmark-'));
  const currentQuick = path.join(tmpDir, 'current-quick.json');
  const currentAnnual = path.join(tmpDir, 'current-annual.json');
  const candidateQuick = path.join(tmpDir, 'candidate-quick.json');
  const candidateAnnual = path.join(tmpDir, 'candidate-annual.json');
  const baseline = path.join(tmpDir, 'baseline.json');
  const outJson = path.join(tmpDir, 'benchmark.json');
  const outMd = path.join(tmpDir, 'benchmark.md');
  const outScorecard = path.join(tmpDir, 'scorecard.md');

  const currentMetrics = {
    itczWidthDeg: 24.875,
    subtropicalDryNorthRatio: 1.343,
    subtropicalDrySouthRatio: 1.145,
    midlatitudeWesterliesNorthU10Ms: 0.524,
    northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.2774,
    crossEquatorialVaporFluxNorthKgM_1S: 326.33822
  };

  const candidateMetrics = {
    itczWidthDeg: 24.041,
    subtropicalDryNorthRatio: 1.18,
    subtropicalDrySouthRatio: 0.578,
    midlatitudeWesterliesNorthU10Ms: 1.073,
    northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.18,
    crossEquatorialVaporFluxNorthKgM_1S: 180
  };

  const baselineMetrics = {
    itczWidthDeg: 23.646,
    subtropicalDryNorthRatio: 1.1,
    subtropicalDrySouthRatio: 0.519,
    midlatitudeWesterliesNorthU10Ms: 1.192,
    northDryBeltOceanLargeScaleCondensationMeanKgM2: 0.14,
    crossEquatorialVaporFluxNorthKgM_1S: 160
  };

  writeAudit(currentQuick, currentMetrics);
  writeAudit(currentAnnual, currentMetrics);
  writeAudit(candidateQuick, candidateMetrics);
  writeAudit(candidateAnnual, candidateMetrics);
  writeAudit(baseline, baselineMetrics);

  execFileSync(process.execPath, [
    scriptPath,
    '--current-quick', currentQuick,
    '--current-annual', currentAnnual,
    '--candidate-quick', candidateQuick,
    '--candidate-annual', candidateAnnual,
    '--baseline', baseline,
    '--json', outJson,
    '--report', outMd,
    '--scorecard', outScorecard,
    '--candidate-name', 'Archive',
    '--candidate-branch', 'archive',
    '--current-name', 'Current',
    '--current-branch', 'current'
  ], { stdio: 'pipe' });

  const result = JSON.parse(fs.readFileSync(outJson, 'utf8'));
  assert.equal(result.decision.verdict, 'rollback_candidate_selected');
  assert.equal(result.decision.canonicalBase.branch, 'archive');
  assert.equal(result.decision.candidateWins >= 4, true);
});
