import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseNumstat,
  buildArchitectureBDesign,
  renderArchitectureBMarkdown
} from '../../../scripts/agent/archived/earth-weather-architecture-b-design.mjs';

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

test('buildArchitectureBDesign selects the circulation-first rebuild lane', () => {
  const benchmark = {
    annualComparisons: [
      { key: 'itczWidthDeg', label: 'ITCZ width', comparable: true, winner: 'current', current: 24.875, candidate: 25.613 },
      { key: 'subtropicalDryNorthRatio', label: 'NH dry-belt ratio', comparable: true, winner: 'current', current: 1.343, candidate: 1.561 },
      { key: 'subtropicalDrySouthRatio', label: 'SH dry-belt ratio', comparable: true, winner: 'candidate', current: 1.145, candidate: 1.014 },
      { key: 'midlatitudeWesterliesNorthU10Ms', label: 'NH midlatitude westerlies', comparable: true, winner: 'candidate', current: 0.524, candidate: 1.139 },
      { key: 'crossEquatorialVaporFluxNorthKgM_1S', label: 'Cross-equatorial vapor flux north', comparable: true, winner: 'candidate', current: 326.338, candidate: 176.877 }
    ]
  };
  const architectureA2 = {
    selectedMode: 'ported-floor-soft-containment',
    quick: {
      candidates: [
        {
          mode: 'ported-floor-soft-containment',
          rows: [
            { key: 'subtropicalDrySouthRatio', label: 'SH dry-belt ratio', off: 1.199, on: 1.2, improved: false },
            { key: 'midlatitudeWesterliesNorthU10Ms', label: 'NH midlatitude westerlies', off: 0.531, on: 0.531, improved: false },
            { key: 'crossEquatorialVaporFluxNorthKgM_1S', label: 'Cross-equatorial vapor flux north', off: 143.953, on: 144.632, improved: false }
          ]
        }
      ]
    }
  };
  const diffEntries = [
    { file: 'src/weather/v2/vertical5.js', added: 20, deleted: 4, churn: 24 },
    { file: 'src/weather/validation/diagnostics.js', added: 15, deleted: 2, churn: 17 },
    { file: 'src/weather/v2/core5.js', added: 10, deleted: 3, churn: 13 }
  ];

  const design = buildArchitectureBDesign({ benchmark, architectureA2, diffEntries });

  assert.equal(design.verdict, 'circulation_scaffold_rebuild_required');
  assert.equal(design.nextImplementationPhase, 'Architecture B1: implement circulation scaffold rebuild experiment');
  assert.deepEqual(design.preserveFromCurrent.map((row) => row.key), [
    'itczWidthDeg',
    'subtropicalDryNorthRatio'
  ]);
  assert.deepEqual(design.recoverFromArchive.map((row) => row.key), [
    'subtropicalDrySouthRatio',
    'midlatitudeWesterliesNorthU10Ms',
    'crossEquatorialVaporFluxNorthKgM_1S'
  ]);
});

test('renderArchitectureBMarkdown includes the active implementation phase', () => {
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
  const architectureA2 = {};
  const diffEntries = [
    { file: 'src/weather/v2/vertical5.js', added: 20, deleted: 4, churn: 24 }
  ];
  const design = {
    verdict: 'circulation_scaffold_rebuild_required',
    summary: 'Rebuild circulation first.',
    preserveFromCurrent: [{ label: 'ITCZ width' }],
    recoverFromArchive: [{ label: 'NH midlatitude westerlies' }],
    failedArchitectureA2Mode: 'ported-floor-soft-containment',
    failedCirculationRecoveries: [{ label: 'NH midlatitude westerlies', off: 0.531, on: 0.531, improved: false }],
    designContract: ['Rebuild the circulation scaffold first.'],
    boundedExperimentFamilies: [
      {
        key: 'B1-circulation-scaffold-rebuild',
        label: 'Circulation scaffold rebuild',
        description: 'Scaffold lane.'
      }
    ],
    nextImplementationPhase: 'Architecture B1: implement circulation scaffold rebuild experiment'
  };

  const markdown = renderArchitectureBMarkdown({ benchmark, architectureA2, diffEntries, design });

  assert.match(markdown, /Architecture B1: implement circulation scaffold rebuild experiment/);
  assert.match(markdown, /circulation_scaffold_rebuild_required/);
});
