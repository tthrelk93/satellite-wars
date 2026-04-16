import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHybridContract,
  renderArchitectureC1Markdown
} from '../../scripts/agent/earth-weather-architecture-c1-hybrid-seam-contract.mjs';

test('buildHybridContract selects rollback donor and current preserve bundles', () => {
  const contract = buildHybridContract({
    archiveBranch: 'archive-branch',
    decision: {
      donorFiles: ['src/weather/v2/core5.js', 'src/weather/v2/vertical5.js'],
      preserveFiles: ['src/weather/v2/microphysics5.js'],
      adapterFiles: ['src/weather/validation/diagnostics.js']
    }
  });
  assert.equal(contract.verdict, 'rollback_vertical_core_current_partition_adapter_contract');
  assert.equal(contract.nextMove, 'Architecture C2: donor-base hybrid worktree benchmark');
});

test('renderArchitectureC1Markdown includes donor and preserve bundles', () => {
  const markdown = renderArchitectureC1Markdown({
    design: { archiveBranch: 'archive-branch' },
    contract: {
      verdict: 'rollback_vertical_core_current_partition_adapter_contract',
      donorFiles: ['src/weather/v2/core5.js'],
      preserveFiles: ['src/weather/v2/microphysics5.js'],
      adapterFiles: ['src/weather/validation/diagnostics.js'],
      excludedCurrentFiles: ['src/weather/v2/core5.js'],
      implementationOrder: ['step one', 'step two'],
      nextMove: 'Architecture C2: donor-base hybrid worktree benchmark'
    }
  });
  assert.match(markdown, /Architecture C1 Hybrid Seam Contract/);
  assert.match(markdown, /Architecture C2: donor-base hybrid worktree benchmark/);
  assert.match(markdown, /do not start from current/);
});
