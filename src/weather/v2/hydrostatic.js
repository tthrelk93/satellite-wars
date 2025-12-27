import { Rd, Cp } from '../constants';

const P0 = 100000;
const KAPPA = Rd / Cp;
const QV_VIRTUAL = 0.61;

export function updateHydrostatic(state, { p0 = P0, pTop = 20000 } = {}) {
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
    phiHalf[idx] = 0;
    for (let k = 0; k < nz; k++) {
      const h1 = k * N + idx;
      const h2 = (k + 1) * N + idx;
      const p1 = Math.max(pTop, pHalf[h1]);
      const p2 = Math.max(pTop, pHalf[h2]);
      const tvMid = Tv[k * N + idx];
      phiHalf[h2] = phiHalf[h1] + Rd * tvMid * Math.log(p2 / p1);
      phiMid[k * N + idx] = 0.5 * (phiHalf[h1] + phiHalf[h2]);
    }
  }
}
