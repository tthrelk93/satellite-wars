import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifySeam,
  buildArchitectureCDecision,
  renderArchitectureCMarkdown
} from '../../scripts/agent/earth-weather-architecture-c-design.mjs';

test('classifySeam marks rollback donors when current-only circulation tokens are absent in archive', () => {
  const classification = classifySeam({
    targetRole: 'rollback_donor_candidate',
    currentTokenHits: 5,
    archiveTokenHits: 0
  });
  assert.equal(classification, 'rollback_donor_candidate');
});

test('buildArchitectureCDecision promotes module-level hybridization when donor and preserve bundles exist', () => {
  const decision = buildArchitectureCDecision([
    { file: 'src/weather/v2/core5.js', classification: 'rollback_donor_candidate' },
    { file: 'src/weather/v2/vertical5.js', classification: 'rollback_donor_candidate' },
    { file: 'src/weather/v2/microphysics5.js', classification: 'current_preserve_candidate' },
    { file: 'src/weather/validation/diagnostics.js', classification: 'current_adapter_candidate' }
  ]);
  assert.equal(decision.verdict, 'module_level_hybrid_required');
  assert.deepEqual(decision.donorFiles, ['src/weather/v2/core5.js', 'src/weather/v2/vertical5.js']);
  assert.deepEqual(decision.preserveFiles, ['src/weather/v2/microphysics5.js']);
});

test('renderArchitectureCMarkdown includes donor and preserve findings', () => {
  const markdown = renderArchitectureCMarkdown({
    seams: [
      {
        label: 'Vertical circulation scaffold',
        file: 'src/weather/v2/vertical5.js',
        targetRole: 'rollback_donor_candidate',
        classification: 'rollback_donor_candidate',
        diff: { added: 100, deleted: 10 },
        currentTokenHits: 5,
        archiveTokenHits: 0,
        tokens: ['a', 'b', 'c', 'd', 'e']
      }
    ],
    decision: {
      verdict: 'module_level_hybrid_required',
      donorFiles: ['src/weather/v2/vertical5.js'],
      preserveFiles: ['src/weather/v2/microphysics5.js'],
      adapterFiles: ['src/weather/validation/diagnostics.js'],
      nextMove: 'Architecture C1: hybrid seam contract'
    }
  });
  assert.match(markdown, /Architecture C Design/);
  assert.match(markdown, /rollback_donor_candidate/);
  assert.match(markdown, /Architecture C1: hybrid seam contract/);
});
