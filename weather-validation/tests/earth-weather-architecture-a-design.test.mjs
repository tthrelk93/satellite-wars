import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseNumstat,
  buildArchitectureADesign,
  renderArchitectureAMarkdown
} from '../../scripts/agent/earth-weather-architecture-a-design.mjs';

test('parseNumstat sorts entries by total churn descending', () => {
  const raw = [
    '10\t2\tsrc/weather/v2/core5.js',
    '3\t1\tsrc/weather/v2/radiation2d.js',
    '20\t5\tsrc/weather/v2/vertical5.js'
  ].join('\n');

  const result = parseNumstat(raw);
  assert.deepEqual(result.map((entry) => entry.file), [
    'src/weather/v2/vertical5.js',
    'src/weather/v2/core5.js',
    'src/weather/v2/radiation2d.js'
  ]);
  assert.equal(result[0].churn, 25);
});

test('buildArchitectureADesign selects the integrated redesign lane', () => {
  const benchmark = {
    annualComparisons: [
      { key: 'itczWidthDeg', label: 'ITCZ width', comparable: true, winner: 'current' },
      { key: 'subtropicalDryNorthRatio', label: 'NH dry-belt ratio', comparable: true, winner: 'current' },
      { key: 'subtropicalDrySouthRatio', label: 'SH dry-belt ratio', comparable: true, winner: 'candidate' },
      { key: 'midlatitudeWesterliesNorthU10Ms', label: 'NH midlatitude westerlies', comparable: true, winner: 'candidate' },
      { key: 'crossEquatorialVaporFluxNorthKgM_1S', label: 'Cross-equatorial vapor flux north', comparable: true, winner: 'candidate' }
    ]
  };
  const reset = {
    experiments: [
      { key: 'upper-cloud-persistence-collapse', label: 'R2A Upper-cloud persistence collapse', combinedScore: 0 },
      { key: 'annual-numerical-hardening', label: 'R2B Annual numerical hardening', combinedScore: -0.28 }
    ]
  };
  const diffEntries = [
    { file: 'src/weather/v2/vertical5.js', added: 20, deleted: 4, churn: 24 },
    { file: 'src/weather/validation/diagnostics.js', added: 15, deleted: 2, churn: 17 },
    { file: 'src/weather/v2/core5.js', added: 10, deleted: 3, churn: 13 },
    { file: 'README.md', added: 5, deleted: 0, churn: 5 }
  ];

  const design = buildArchitectureADesign({ benchmark, reset, diffEntries });

  assert.equal(design.verdict, 'integrated_partition_circulation_split_required');
  assert.equal(design.nextImplementationPhase, 'Architecture A1: implement explicit subtropical balance contract experiment');
  assert.deepEqual(design.preserveFromCurrent.map((row) => row.key), [
    'itczWidthDeg',
    'subtropicalDryNorthRatio'
  ]);
  assert.deepEqual(design.recoverFromArchive.map((row) => row.key), [
    'subtropicalDrySouthRatio',
    'midlatitudeWesterliesNorthU10Ms',
    'crossEquatorialVaporFluxNorthKgM_1S'
  ]);
  assert.equal(design.codeOwnershipRank.length, 3);
  assert.equal(design.codeOwnershipRank[0].file, 'src/weather/v2/vertical5.js');
});

test('renderArchitectureAMarkdown includes the active implementation phase', () => {
  const benchmark = {
    annualComparisons: [
      {
        key: 'itczWidthDeg',
        label: 'ITCZ width',
        current: 24.875,
        candidate: 25.613,
        comparable: true,
        winner: 'current'
      }
    ]
  };
  const reset = {
    decision: {
      verdict: 'no_clear_winner',
      nextMove: 'Escalate to architecture change.'
    }
  };
  const diffEntries = [
    { file: 'src/weather/v2/vertical5.js', added: 20, deleted: 4, churn: 24 }
  ];
  const design = {
    verdict: 'integrated_partition_circulation_split_required',
    summary: 'Split partition gains from circulation losses.',
    preserveFromCurrent: [{ label: 'ITCZ width' }],
    recoverFromArchive: [{ label: 'NH midlatitude westerlies' }],
    designContract: ['Keep current partition gains.'],
    boundedExperimentFamilies: [
      {
        key: 'A1-explicit-subtropical-balance-contract',
        label: 'Explicit subtropical balance contract',
        description: 'Shared contract lane.'
      }
    ],
    nextImplementationPhase: 'Architecture A1: implement explicit subtropical balance contract experiment'
  };

  const markdown = renderArchitectureAMarkdown({ benchmark, reset, diffEntries, design });

  assert.match(markdown, /Architecture A1: implement explicit subtropical balance contract experiment/);
  assert.match(markdown, /integrated_partition_circulation_split_required/);
});
