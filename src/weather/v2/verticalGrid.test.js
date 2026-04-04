import test from 'node:test';
import assert from 'node:assert/strict';
import { createState5 } from './state5.js';
import {
  buildVerticalLayout,
  computeGeopotentialHeightByPressure,
  createSigmaHalfLevels
} from './verticalGrid.js';

test('createSigmaHalfLevels creates a monotonic nz+1 sigma grid', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 26 });
  assert.equal(sigmaHalf.length, 27);
  assert.equal(sigmaHalf[0], 0);
  assert.equal(sigmaHalf[sigmaHalf.length - 1], 1);
  for (let i = 1; i < sigmaHalf.length; i += 1) {
    assert.ok(sigmaHalf[i] > sigmaHalf[i - 1], `sigmaHalf must increase at ${i}`);
  }
});

test('buildVerticalLayout selects ordered diagnostic levels', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 26 });
  const layout = buildVerticalLayout({ sigmaHalf });
  assert.equal(layout.nz, 26);
  assert.ok(layout.upperTroposphere < layout.midTroposphere);
  assert.ok(layout.midTroposphere < layout.lowerTroposphere);
  assert.ok(layout.lowerTroposphere < layout.surface);
});

test('pressure-level height diagnostics remain finite at higher nz', () => {
  const sigmaHalf = createSigmaHalfLevels({ nz: 26 });
  const state = createState5({ grid: { count: 8 }, nz: 26, sigmaHalf });

  for (let lev = 0; lev < state.nz; lev += 1) {
    const pressurePa = 25000 + ((85000 - 25000) * lev) / Math.max(1, state.nz - 1);
    const heightM = 11000 - ((11000 - 1200) * lev) / Math.max(1, state.nz - 1);
    for (let cell = 0; cell < state.N; cell += 1) {
      const idx = lev * state.N + cell;
      state.pMid[idx] = pressurePa;
      state.phiMid[idx] = heightM * 9.80665;
    }
  }

  assert.equal(state.pMid.length, 26 * 8);
  assert.equal(state.phiMid.length, 26 * 8);
  for (const value of state.pMid) {
    assert.ok(Number.isFinite(value));
  }
  for (const value of state.phiMid) {
    assert.ok(Number.isFinite(value));
  }

  const heights = computeGeopotentialHeightByPressure(state, [85000, 70000, 50000, 25000]);
  for (const key of ['85000', '70000', '50000', '25000']) {
    assert.equal(heights[key].length, 8);
    for (const value of heights[key]) {
      assert.ok(Number.isFinite(value));
    }
  }
});
