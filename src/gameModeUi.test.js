import test from 'node:test';
import assert from 'node:assert/strict';

import { showMinimapOverlayForGameMode } from './gameModeUi.js';

test('showMinimapOverlayForGameMode only enables the minimap for pvp mode', () => {
  assert.equal(showMinimapOverlayForGameMode(null), false);
  assert.equal(showMinimapOverlayForGameMode(undefined), false);
  assert.equal(showMinimapOverlayForGameMode('solo'), false);
  assert.equal(showMinimapOverlayForGameMode('pvp'), true);
});
