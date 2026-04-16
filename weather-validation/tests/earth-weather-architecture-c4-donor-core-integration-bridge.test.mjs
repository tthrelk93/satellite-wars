import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rewriteRelativeImportSpecifiers,
  injectDonorCoreCompatibilityBridge,
  applyDonorCoreIntegrationBridge,
  renderArchitectureC4Markdown
} from '../../scripts/agent/earth-weather-architecture-c4-donor-core-integration-bridge.mjs';

test('rewriteRelativeImportSpecifiers adds .js only to extensionless relative imports', () => {
  const result = rewriteRelativeImportSpecifiers(`
    import { a } from './grid';
    import { b } from './state5.js';
    export { c } from '../constants';
    const lazy = import('./vertical5');
  `);

  assert.match(result.content, /from '\.\/grid\.js'/);
  assert.match(result.content, /from '\.\/state5\.js'/);
  assert.match(result.content, /from '\.\.\/constants\.js'/);
  assert.match(result.content, /import\('\.\/vertical5\.js'\)/);
  assert.equal(result.rewrittenImportCount, 3);
});

test('injectDonorCoreCompatibilityBridge inserts the donor compatibility block once', () => {
  const donorCore = `
    export class WeatherCore5 {
      constructor() {}

      _bindFieldViews() {}
    }
  `;
  const first = injectDonorCoreCompatibilityBridge(donorCore);
  assert.equal(first.injected, true);
  assert.match(first.content, /Architecture C4 donor-core compatibility bridge/);
  assert.match(first.content, /loadStateSnapshot\(snapshot\)/);

  const second = injectDonorCoreCompatibilityBridge(first.content);
  assert.equal(second.injected, false);
});

test('applyDonorCoreIntegrationBridge rewrites imports and removes missing donor-core methods', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'earth-weather-c4-test-'));
  try {
    fs.mkdirSync(path.join(tempRoot, 'src', 'weather', 'v2'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src', 'weather'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, 'src', 'weather', 'v2', 'core5.js'),
      `
        import { createLatLonGridV2 } from './grid';
        import WeatherLogger from '../WeatherLogger';
        export class WeatherCore5 {
          constructor() {}

          _bindFieldViews() {}
        }
      `
    );
    fs.writeFileSync(
      path.join(tempRoot, 'src', 'weather', 'v2', 'grid.js'),
      `import { Omega } from '../constants'; export const createLatLonGridV2 = () => Omega;`
    );
    fs.writeFileSync(path.join(tempRoot, 'src', 'weather', 'WeatherLogger.js'), 'export default class WeatherLogger {}');
    fs.writeFileSync(path.join(tempRoot, 'src', 'weather', 'constants.js'), 'export const Omega = 1;');

    const summary = applyDonorCoreIntegrationBridge(tempRoot);
    const bridgedCore = fs.readFileSync(path.join(tempRoot, 'src', 'weather', 'v2', 'core5.js'), 'utf8');
    const bridgedGrid = fs.readFileSync(path.join(tempRoot, 'src', 'weather', 'v2', 'grid.js'), 'utf8');

    assert.match(bridgedCore, /from '\.\/grid\.js'/);
    assert.match(bridgedCore, /from '\.\.\/WeatherLogger\.js'/);
    assert.match(bridgedCore, /getCloudTransitionLedgerRaw\(\)/);
    assert.match(bridgedGrid, /from '\.\.\/constants\.js'/);
    assert.equal(summary.missingCoreMethodsAfterBridge.length, 0);
    assert.ok(summary.rewrittenImportCount >= 3);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('renderArchitectureC4Markdown records the rerun handoff', () => {
  const markdown = renderArchitectureC4Markdown({
    bridgeSummary: {
      bridgedFiles: ['src/weather/v2/core5.js'],
      rewrittenImportCount: 4,
      missingCoreMethodsAfterBridge: []
    }
  });

  assert.match(markdown, /Architecture C4 Donor-Core Integration Bridge/);
  assert.match(markdown, /Architecture C5: bridged donor-base hybrid rerun benchmark/);
  assert.match(markdown, /rewritten relative import count: 4/);
});
