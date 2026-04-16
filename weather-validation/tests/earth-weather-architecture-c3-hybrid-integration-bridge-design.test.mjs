import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectExtensionlessImports,
  buildArchitectureC3Decision,
  renderArchitectureC3Markdown
} from '../../scripts/agent/earth-weather-architecture-c3-hybrid-integration-bridge-design.mjs';

test('collectExtensionlessImports finds donor-core ESM specifiers without extensions', () => {
  const imports = collectExtensionlessImports(`
    import { a } from './grid';
    import { b } from './state5';
    import { c } from './vertical5.js';
  `);
  assert.deepEqual(imports, ['./grid', './state5']);
});

test('buildArchitectureC3Decision requires both ESM and core API bridge when both blockers exist', () => {
  const decision = buildArchitectureC3Decision({
    c2Result: {
      decision: { verdict: 'integration_blocked_missing_dependency' },
      missingCoreMethods: ['getCloudTransitionLedgerRaw']
    },
    extensionlessImports: ['./grid', './state5']
  });
  assert.equal(decision.verdict, 'esm_and_core_api_bridge_required');
  assert.equal(decision.nextMove, 'Architecture C4: donor-core integration bridge implementation');
});

test('renderArchitectureC3Markdown includes the bridge contract', () => {
  const markdown = renderArchitectureC3Markdown({
    c2Result: { decision: { verdict: 'integration_blocked_missing_dependency' } },
    decision: {
      verdict: 'esm_and_core_api_bridge_required',
      nextMove: 'Architecture C4: donor-core integration bridge implementation',
      extensionlessImports: ['./grid'],
      missingCoreMethods: ['getCloudTransitionLedgerRaw']
    }
  });
  assert.match(markdown, /Architecture C3 Hybrid Integration Bridge Design/);
  assert.match(markdown, /Architecture C4: donor-core integration bridge implementation/);
  assert.match(markdown, /getCloudTransitionLedgerRaw/);
});
