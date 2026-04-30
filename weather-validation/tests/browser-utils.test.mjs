import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flattenTabs,
  isTransientBrowserError,
  normalizeObservationTarget,
  parseSimTimeLabel,
  scoreDevtoolsPageTarget,
  scoreTab,
  selectDevtoolsPageTarget,
  selectMatchingTabs,
  tabIdOf
} from '../../scripts/agent/browser-utils.mjs';

test('normalizeObservationTarget adds solo mode when missing', () => {
  const url = normalizeObservationTarget('http://127.0.0.1:3000/');
  assert.equal(url.href, 'http://127.0.0.1:3000/?mode=solo');
});

test('flattenTabs handles wrapped CLI tab payloads', () => {
  assert.deepEqual(flattenTabs({ tabs: [{ id: 'a' }] }), [{ id: 'a' }]);
  assert.deepEqual(flattenTabs({ data: [{ id: 'b' }] }), [{ id: 'b' }]);
  assert.deepEqual(flattenTabs(null), []);
});

test('selectMatchingTabs prefers exact canonical localhost match', () => {
  const target = normalizeObservationTarget('http://127.0.0.1:3000/');
  const tabs = [
    { id: 'older', url: 'http://127.0.0.1:3000/' },
    { id: 'best', url: 'http://127.0.0.1:3000/?mode=solo', focused: true, title: 'satellite-wars' },
    { id: 'other', url: 'http://example.com/' }
  ];
  const matches = selectMatchingTabs(tabs, target);
  assert.equal(tabIdOf(matches[0]), 'best');
  assert.ok(scoreTab(matches[0], target) > scoreTab(matches[1], target));
});

test('isTransientBrowserError recognizes retryable gateway/browser failures', () => {
  assert.equal(isTransientBrowserError('Error: gateway timeout after 20000ms'), true);
  assert.equal(isTransientBrowserError('browser unavailable'), true);
  assert.equal(isTransientBrowserError('permission denied'), false);
});

test('parseSimTimeLabel converts HUD labels to seconds', () => {
  assert.equal(parseSimTimeLabel('Day 1, 05:18'), 105480);
  assert.equal(parseSimTimeLabel('Day 0, 00:48'), 2880);
  assert.equal(parseSimTimeLabel('nonsense'), null);
});

test('selectDevtoolsPageTarget prefers canonical solo page targets', () => {
  const targets = [
    { type: 'page', url: 'http://127.0.0.1:3000/', title: 'App', webSocketDebuggerUrl: 'ws://a' },
    { type: 'page', url: 'http://127.0.0.1:3000/?mode=solo', title: 'satellite-wars', webSocketDebuggerUrl: 'ws://b' },
    { type: 'service_worker', url: 'http://127.0.0.1:3000/sw.js', webSocketDebuggerUrl: 'ws://c' }
  ];
  const selected = selectDevtoolsPageTarget(targets, {
    targetUrl: 'http://127.0.0.1:3000/?mode=solo',
    preferredMode: 'solo'
  });
  assert.equal(selected?.webSocketDebuggerUrl, 'ws://b');
  assert.ok(scoreDevtoolsPageTarget(selected, {
    targetUrl: 'http://127.0.0.1:3000/?mode=solo',
    preferredMode: 'solo'
  }) > scoreDevtoolsPageTarget(targets[0], {
    targetUrl: 'http://127.0.0.1:3000/?mode=solo',
    preferredMode: 'solo'
  }));
});
