#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  evaluateMetricRows,
  evaluateGate
} from './earth-weather-architecture-c2-donor-base-hybrid-benchmark.mjs';
import { applyDonorCoreIntegrationBridge } from './earth-weather-architecture-c4-donor-core-integration-bridge.mjs';
import {
  buildCycleScopedOutputBase,
  runExplicitMainAudit,
  startCycleContract
} from './earth-weather-architecture-c8-donor-worktree-cycle-contract-repair.mjs';
import { evaluateAnnualAbsoluteGate } from './earth-weather-architecture-c13-equatorial-overturning-sign-contract-experiment.mjs';
import { applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainmentPatch } from './earth-weather-architecture-c62-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-experiment.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const archiveBranch = 'codex/world-class-weather-loop-archive-20260407-0745';

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');
const trustedBaselinePath = path.join(
  repoRoot,
  'weather-validation',
  'output',
  'phase1-hadley-second-pass-restore-v4.json'
);

const SUPPORT_ARTIFACT_KEYS = [
  'monthlyClimatologyJsonPath',
  'moistureAttributionJsonPath',
  'transportInterfaceBudgetJsonPath',
  'hadleyPartitionSummaryJsonPath',
  'thermodynamicSupportSummaryJsonPath',
  'nhDryBeltSourceSectorSummaryJsonPath'
];

const OVERLAY_FILES = [
  'src/weather/v2/microphysics5.js',
  'src/weather/v2/vertical5.js',
  'src/weather/v2/state5.js',
  'src/weather/v2/cloudBirthTracing5.js',
  'src/weather/v2/sourceTracing5.js',
  'src/weather/v2/instrumentationBands5.js',
  'src/weather/v2/windNudge5.js',
  'src/weather/v2/windEddyNudge5.js',
  'src/weather/v2/nudging5.js',
  'src/weather/validation/diagnostics.js',
  'scripts/agent/planetary-realism-audit.mjs',
  'scripts/agent/headless-terrain-fixture.mjs',
  'scripts/agent/start-cycle.mjs',
  'scripts/agent/plan-guard.mjs',
  'scripts/agent/fixtures/headless-terrain-180x90.json'
];

const defaults = {
  trustedBaselinePath,
  currentQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-current-off-quick.json'),
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-quick.json'),
  hybridAnnualPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c64-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-annual.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c64-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-experiment.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c64-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-experiment.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--trusted-baseline' && argv[i + 1]) options.trustedBaselinePath = path.resolve(argv[++i]);
  else if (arg === '--current-quick' && argv[i + 1]) options.currentQuickPath = path.resolve(argv[++i]);
  else if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const extractMetrics = (auditJson) => auditJson?.horizons?.[auditJson.horizons.length - 1]?.latest?.metrics || {};

const readFileAtRef = (ref, relativePath) => execFileSync('git', ['show', `${ref}:${relativePath}`], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

const copyRepoFileAtHead = (relativePath, destinationRoot) => {
  const content = readFileAtRef('HEAD', relativePath);
  const destPath = path.join(destinationRoot, relativePath);
  ensureDir(destPath);
  fs.writeFileSync(destPath, content);
};

const copyArtifactIntoRepo = (fromPath, toPath) => {
  ensureDir(toPath);
  fs.copyFileSync(fromPath, toPath);
};

const buildRepoSupportArtifactPath = (repoOutputPath, sourceArtifactPath) => {
  const repoDir = path.dirname(repoOutputPath);
  return path.join(repoDir, path.basename(sourceArtifactPath));
};

const copySupportingArtifacts = (summaryJson, repoOutputPath) => {
  const copied = {};
  for (const key of SUPPORT_ARTIFACT_KEYS) {
    const sourcePath = summaryJson?.artifacts?.[key];
    if (!sourcePath || !fs.existsSync(sourcePath)) continue;
    const targetPath = buildRepoSupportArtifactPath(repoOutputPath, sourcePath);
    copyArtifactIntoRepo(sourcePath, targetPath);
    copied[key] = targetPath;
  }
  return copied;
};

const replaceOnce = (text, needle, replacement) => {
  if (!text.includes(needle)) {
    throw new Error(`Expected to find patch needle: ${needle}`);
  }
  return text.replace(needle, replacement);
};

export function applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainmentAnd35degInterfaceEddySofteningPatch(worktreePath) {
  const basePatch = applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainmentPatch(worktreePath);

  const corePath = path.join(worktreePath, 'src', 'weather', 'v2', 'core5.js');
  let coreContent = fs.readFileSync(corePath, 'utf8');
  coreContent = replaceOnce(
    coreContent,
    '      enableEquatorialBandSoftening: true,\n      equatorialSofteningLat0Deg: 0,\n      equatorialSofteningLat1Deg: 11,\n      equatorialBlendToUnityFrac: 0.47\n',
    '      enableEquatorialBandSoftening: true,\n      equatorialSofteningLat0Deg: 0,\n      equatorialSofteningLat1Deg: 11,\n      equatorialBlendToUnityFrac: 0.47,\n      enable35degInterfaceEddySoftening: true,\n      interfaceEddySofteningLat0Deg: 29,\n      interfaceEddySofteningLat1Deg: 33,\n      interfaceEddySofteningLat2Deg: 37,\n      interfaceEddySofteningLat3Deg: 41,\n      interfaceEddyBlendToUnityFrac: 0.3\n'
  );
  fs.writeFileSync(corePath, coreContent);

  const eddyPath = path.join(worktreePath, 'src', 'weather', 'v2', 'windEddyNudge5.js');
  let eddyContent = fs.readFileSync(eddyPath, 'utf8');
  if (!eddyContent.includes('const smoothstep =')) {
    eddyContent = replaceOnce(
      eddyContent,
      "const clamp01 = (v) => Math.max(0, Math.min(1, v));\nconst lerp = (a, b, t) => a + (b - a) * t;\n",
      "const clamp01 = (v) => Math.max(0, Math.min(1, v));\nconst lerp = (a, b, t) => a + (b - a) * t;\nconst smoothstep = (edge0, edge1, x) => {\n  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));\n  return t * t * (3 - 2 * t);\n};\n"
    );
  }
  eddyContent = replaceOnce(
    eddyContent,
    "    tauSeconds = 10 * 86400,\n    scaleClampMin = 0.5,\n    scaleClampMax = 2.0,\n    eps = 1e-6,\n    enableEquatorialBandSoftening = false,\n    equatorialSofteningLat0Deg = 0,\n    equatorialSofteningLat1Deg = 11,\n    equatorialBlendToUnityFrac = 0.47\n  } = params;\n",
    "    tauSeconds = 10 * 86400,\n    scaleClampMin = 0.5,\n    scaleClampMax = 2.0,\n    eps = 1e-6,\n    enableEquatorialBandSoftening = false,\n    equatorialSofteningLat0Deg = 0,\n    equatorialSofteningLat1Deg = 11,\n    equatorialBlendToUnityFrac = 0.47,\n    enable35degInterfaceEddySoftening = false,\n    interfaceEddySofteningLat0Deg = 29,\n    interfaceEddySofteningLat1Deg = 33,\n    interfaceEddySofteningLat2Deg = 37,\n    interfaceEddySofteningLat3Deg = 41,\n    interfaceEddyBlendToUnityFrac = 0.3\n  } = params;\n"
  );
  eddyContent = replaceOnce(
    eddyContent,
    "    const scale = Math.max(scaleClampMin, Math.min(scaleClampMax, scaleRaw));\n    const equatorialSofteningWeight = enableEquatorialBandSoftening\n      ? 1 - smoothstep(equatorialSofteningLat0Deg, equatorialSofteningLat1Deg, Math.abs(latDeg))\n      : 0;\n    const softenedScale = lerp(scale, 1, equatorialSofteningWeight * clamp01(equatorialBlendToUnityFrac));\n    const blend = lerp(1, softenedScale, relax);\n",
    "    const scale = Math.max(scaleClampMin, Math.min(scaleClampMax, scaleRaw));\n    const equatorialSofteningWeight = enableEquatorialBandSoftening\n      ? 1 - smoothstep(equatorialSofteningLat0Deg, equatorialSofteningLat1Deg, Math.abs(latDeg))\n      : 0;\n    const interfaceShoulderWeight = enable35degInterfaceEddySoftening\n      ? smoothstep(interfaceEddySofteningLat0Deg, interfaceEddySofteningLat1Deg, Math.abs(latDeg))\n        * (1 - smoothstep(interfaceEddySofteningLat2Deg, interfaceEddySofteningLat3Deg, Math.abs(latDeg)))\n      : 0;\n    const combinedSofteningFrac = Math.max(\n      equatorialSofteningWeight * clamp01(equatorialBlendToUnityFrac),\n      interfaceShoulderWeight * clamp01(interfaceEddyBlendToUnityFrac)\n    );\n    const softenedScale = lerp(scale, 1, combinedSofteningFrac);\n    const blend = lerp(1, softenedScale, relax);\n"
  );
  fs.writeFileSync(eddyPath, eddyContent);

  return {
    patchedPaths: [...basePatch.patchedPaths, path.relative(worktreePath, eddyPath)],
    patchedParams: [
      ...basePatch.patchedParams,
      'windEddyParams.enable35degInterfaceEddySoftening',
      'windEddyParams.interfaceEddySofteningLat0Deg',
      'windEddyParams.interfaceEddySofteningLat1Deg',
      'windEddyParams.interfaceEddySofteningLat2Deg',
      'windEddyParams.interfaceEddySofteningLat3Deg',
      'windEddyParams.interfaceEddyBlendToUnityFrac',
      'windEddyNudge5 35deg interface eddy softening branch'
    ]
  };
}

export function classifyC64Decision({ quickGatePass, annualGatePass = null }) {
  if (!quickGatePass) {
    return {
      verdict: 'quick_reject',
      nextMove: 'Architecture C65: stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment and 35deg interface eddy softening attribution'
    };
  }
  if (annualGatePass === true) {
    return {
      verdict: 'keep_candidate',
      nextMove: 'Phase 1 Climate Base Recovery on the 35deg interface eddy-softening hybrid track'
    };
  }
  if (annualGatePass === false) {
    return {
      verdict: 'annual_reject',
      nextMove: 'Architecture C65: annual stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment and 35deg interface eddy softening attribution'
    };
  }
  return {
    verdict: 'quick_pass_annual_pending',
    nextMove: 'Architecture C65: annual stronger 26p25 receiver carryover containment with 33p75 poleward shoulder carryover containment and 35deg interface eddy softening gate completion'
  };
}

const renderRows = (rows) => rows.map((row) => (
  `- ${row.label}: off \`${row.off}\`, on \`${row.on}\`, improved \`${row.improved}\`, severeRegression \`${row.severeRegression}\``
)).join('\n');

export function renderArchitectureC64Markdown({
  decision,
  quickRows,
  quickGate,
  annualGate,
  currentQuickPath,
  hybridQuickPath,
  hybridAnnualPath,
  supportingArtifacts,
  bridgeSummary,
  patchSummary
}) {
  const lines = [
    '# Earth Weather Architecture C64 Stronger 26p25 Receiver Carryover Containment With 33p75 Poleward Shoulder Carryover Containment And 35deg Interface Eddy Softening Experiment',
    '',
    'This phase keeps the active C62 `18.75°`, `26.25°`, and `33.75°` carryover controls fixed, then softens eddy-energy rescaling only in a narrow `35°` interface band. The goal is to reduce the remaining eddy-side NH dry-belt import burden without reopening the receiver and shoulder maintenance families that C62 had just recovered.',
    '',
    `- archive donor branch: \`${archiveBranch}\``,
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Implementation contract',
    '',
    `- bridged file count: ${bridgeSummary.bridgedFiles.length}`,
    `- rewritten relative import count: ${bridgeSummary.rewrittenImportCount}`,
    `- patched paths: ${patchSummary.patchedPaths.map((value) => `\`${value}\``).join(', ')}`,
    `- patched params: ${patchSummary.patchedParams.join(', ')}`,
    '',
    '## Quick benchmark',
    '',
    `- current quick artifact: [${path.basename(currentQuickPath)}](${currentQuickPath})`,
    `- 35deg interface eddy-softening quick artifact: [${path.basename(hybridQuickPath)}](${hybridQuickPath})`,
    ''
  ];

  if (quickRows) {
    lines.push(renderRows(quickRows));
    lines.push('');
    lines.push(`- improved metrics: ${quickGate.improvedCount} / ${quickRows.length}`);
    lines.push(`- severe regressions: ${quickGate.severeRegressions.length ? quickGate.severeRegressions.join(', ') : 'none'}`);
    lines.push(`- quick gate pass: ${quickGate.pass}`);
    lines.push('');
  }

  if (hybridAnnualPath) {
    lines.push('## Annual gate');
    lines.push('');
    lines.push(`- annual artifact: [${path.basename(hybridAnnualPath)}](${hybridAnnualPath})`);
    lines.push(`- annual gate pass: ${annualGate.pass}`);
    lines.push(`- annual checks passed: ${annualGate.passedCount} / ${Object.keys(annualGate.checks).length}`);
    lines.push('');
  }

  const supportEntries = Object.entries(supportingArtifacts || {});
  if (supportEntries.length) {
    lines.push('## Supporting artifacts');
    lines.push('');
    for (const [key, value] of supportEntries) {
      lines.push(`- ${key}: [${path.basename(value)}](${value})`);
    }
    lines.push('');
  }

  lines.push('## Interpretation');
  lines.push('');
  lines.push('- Architecture C63 showed that C62 already recaptures the receiver and NH ocean rebound lanes, and that the remaining live blocker is now concentrated in the `35°` eddy import branch rather than the zonal-mean branch.');
  lines.push('- This experiment holds the active C62 carryover-containment geometry fixed and changes only the `windEddyNudge5.js` rescaling behavior near the `35°` interface.');
  lines.push('- The bounded question is whether the remaining sign defect can be reduced by easing that eddy-side repayment lane without reopening the `26.25°` receiver or the `33.75°` shoulder maintenance families.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));
  const trustedBaselineMetrics = extractMetrics(readJson(options.trustedBaselinePath));
  let hybridAnnualPath = null;
  let annualGate = null;
  let supportingArtifacts = {};

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c64-'));
  const worktreePath = path.join(tempParent, 'c64-35deg-interface-eddy-softening-worktree');
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, archiveBranch], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    for (const relativePath of OVERLAY_FILES) {
      copyRepoFileAtHead(relativePath, worktreePath);
    }

    const bridgeSummary = applyDonorCoreIntegrationBridge(worktreePath);
    const patchSummary = applyStronger26p25ReceiverCarryoverContainmentWith33p75PolewardShoulderCarryoverContainmentAnd35degInterfaceEddySofteningPatch(worktreePath);

    const cycleContract = startCycleContract({
      repoPath: worktreePath,
      slug: 'earth-weather-architecture-c64-35deg-interface-eddy-softening',
      focusArea: '35deg interface eddy softening experiment on top of the C62 carryover containment base',
      blockerFamily: 'testing whether the remaining 35deg eddy import branch is the dominant live blocker after C62',
      mode: 'quick',
      question: 'Can the donor/current hybrid keep the active C62 receiver and shoulder containment wins while softening only the remaining 35° interface eddy-import lane?',
      hypothesis: 'If C63 is right that the remaining blocker is the 35° eddy branch, then a narrow subtropical shoulder eddy-softening carveout should improve cross-equatorial vapor transport without reopening the NH ocean rebound family.',
      expectedSrcPaths: [
        'src/weather/v2/core5.js',
        'src/weather/v2/vertical5.js',
        'src/weather/v2/windEddyNudge5.js'
      ],
      evidence: [
        'Architecture C63 showed C62 recovers the receiver and shoulder carryover lanes relative to C60.',
        'Architecture C63 also showed the remaining repayment is concentrated in the 35° eddy import branch while the 35° zonal-mean branch improves.'
      ],
      passCriteria: [
        'Quick gate passes with no severe regressions.',
        'Cross-equatorial vapor flux north improves relative to C62 without giving back NH dry-belt ocean condensation.'
      ],
      failCriteria: [
        'The 35° interface eddy-softening carveout is inert.',
        'The eddy-softening carveout reopens NH dry-belt ocean condensation or worsens the sign defect.'
      ]
    });

    const worktreeAuditScript = path.join(worktreePath, 'scripts', 'agent', 'planetary-realism-audit.mjs');
    const quickOutputBase = buildCycleScopedOutputBase(
      cycleContract.cycleDir,
      'earth-weather-architecture-c64-35deg-interface-eddy-softening-quick'
    );
    const quickRun = runExplicitMainAudit({
      scriptPath: worktreeAuditScript,
      repoPath: worktreePath,
      preset: 'quick',
      outputBase: quickOutputBase,
      cycleDir: cycleContract.cycleDir
    });
    if (!quickRun.ok) {
      throw new Error(`35deg interface eddy-softening quick run failed. stderr=${(quickRun.stderr || '').trim().slice(0, 400)}`);
    }

    copyArtifactIntoRepo(quickRun.jsonPath, options.hybridQuickPath);
    const quickSummary = readJson(quickRun.jsonPath);
    supportingArtifacts = copySupportingArtifacts(quickSummary, options.hybridQuickPath);

    const hybridQuickMetrics = extractMetrics(readJson(options.hybridQuickPath));
    const quickRows = evaluateMetricRows({
      offMetrics: currentQuickMetrics,
      onMetrics: hybridQuickMetrics,
      targetMetrics: trustedBaselineMetrics,
      severeTolerance: 0.05
    });
    const quickGate = evaluateGate(quickRows, 4);

    if (quickGate.pass) {
      const annualCycle = startCycleContract({
        repoPath: worktreePath,
        slug: 'earth-weather-architecture-c64-35deg-interface-eddy-softening-annual',
        focusArea: '35deg interface eddy softening annual gate',
        blockerFamily: '35deg interface eddy softening annual verification',
        mode: 'annual',
        question: 'Does the 35deg interface eddy-softening hybrid keep realistic circulation over an annual run?',
        hypothesis: 'If the remaining blocker is the 35° eddy branch, then softening it locally should annualize better than the plain C62 hybrid.',
        expectedSrcPaths: [
          'src/weather/v2/core5.js',
          'src/weather/v2/vertical5.js',
          'src/weather/v2/windEddyNudge5.js'
        ],
        evidence: [
          'Architecture C63 showed the next bounded move is narrow 35deg interface eddy softening on top of the active C62 base.'
        ],
        passCriteria: [
          'Annual absolute gate passes.'
        ],
        failCriteria: [
          'Annual absolute gate fails.'
        ]
      });
      const annualOutputBase = buildCycleScopedOutputBase(
        annualCycle.cycleDir,
        'earth-weather-architecture-c64-35deg-interface-eddy-softening-annual'
      );
      const annualRun = runExplicitMainAudit({
        scriptPath: worktreeAuditScript,
        repoPath: worktreePath,
        preset: 'annual',
        outputBase: annualOutputBase,
        cycleDir: annualCycle.cycleDir
      });
      if (annualRun.ok) {
        hybridAnnualPath = options.hybridAnnualPath;
        copyArtifactIntoRepo(annualRun.jsonPath, hybridAnnualPath);
        annualGate = evaluateAnnualAbsoluteGate(extractMetrics(readJson(hybridAnnualPath)));
      }
    }

    const decision = classifyC64Decision({
      quickGatePass: quickGate.pass,
      annualGatePass: annualGate?.pass ?? null
    });

    const result = {
      schema: 'satellite-wars.earth-weather-architecture-c64-stronger-26p25-receiver-carryover-containment-with-33p75-poleward-shoulder-carryover-containment-and-35deg-interface-eddy-softening-experiment.v1',
      generatedAt: new Date().toISOString(),
      archiveBranch,
      currentQuickPath: options.currentQuickPath,
      hybridQuickPath: options.hybridQuickPath,
      hybridAnnualPath,
      bridgeSummary,
      patchSummary,
      supportingArtifacts,
      quickRows,
      quickGate,
      annualGate,
      decision
    };

    ensureDir(options.jsonPath);
    ensureDir(options.reportPath);
    fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(options.reportPath, renderArchitectureC64Markdown({
      decision,
      quickRows,
      quickGate,
      annualGate,
      currentQuickPath: options.currentQuickPath,
      hybridQuickPath: options.hybridQuickPath,
      hybridAnnualPath,
      supportingArtifacts,
      bridgeSummary,
      patchSummary
    }));

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    try {
      execFileSync('git', ['worktree', 'remove', '--force', worktreePath], {
        cwd: repoRoot,
        stdio: ['ignore', 'ignore', 'ignore']
      });
    } catch {}
    fs.rmSync(tempParent, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMain) {
  main();
}
