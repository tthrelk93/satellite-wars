import { Rd, Cp, g } from '../constants.js';

const P0 = 100000;
const KAPPA = Rd / Cp;
const QV_VIRTUAL = 0.61;

export function updateHydrostatic(state, { p0 = P0, pTop = 20000, terrainHeightM = null } = {}) {
  const { N, nz, sigmaHalf, theta, qv, T, Tv, ps, pHalf, pMid, phiHalf, phiMid } = state;
  if (!N || !nz) return;

  for (let idx = 0; idx < N; idx++) {
    const psVal = Math.max(pTop + 100, ps[idx]);
    for (let k = 0; k <= nz; k++) {
      const frac = sigmaHalf[k];
      let p = pTop + (psVal - pTop) * frac;
      pHalf[k * N + idx] = p;
    }
    for (let k = 0; k < nz; k++) {
      const p1 = Math.max(pTop, pHalf[k * N + idx]);
      const p2 = Math.max(pTop, pHalf[(k + 1) * N + idx]);
      pMid[k * N + idx] = Math.sqrt(p1 * p2);
    }
  }

  for (let k = 0; k < nz; k++) {
    const offset = k * N;
    for (let idx = 0; idx < N; idx++) {
      const m = offset + idx;
      const p = Math.max(pTop, pMid[m]);
      const Pi = Math.pow(p / p0, KAPPA);
      const temp = theta[m] * Pi;
      T[m] = temp;
      Tv[m] = temp * (1 + QV_VIRTUAL * qv[m]);
    }
  }

  for (let idx = 0; idx < N; idx++) {
    const surfacePhi = terrainHeightM && terrainHeightM.length === N ? terrainHeightM[idx] * g : 0;
    phiHalf[nz * N + idx] = surfacePhi;
    for (let k = nz - 1; k >= 0; k--) {
      const hUpper = k * N + idx;
      const hLower = (k + 1) * N + idx;
      const pUpper = Math.max(pTop, pHalf[hUpper]);
      const pLower = Math.max(pTop, pHalf[hLower]);
      const tvMid = Tv[k * N + idx];
      const thickness = Rd * tvMid * Math.log(pLower / pUpper);
      phiHalf[hUpper] = phiHalf[hLower] - thickness;
      phiMid[k * N + idx] = 0.5 * (phiHalf[hUpper] + phiHalf[hLower]);
    }
  }
}
