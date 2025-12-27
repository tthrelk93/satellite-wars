const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function stepSurfacePressure5({ dt, grid, state, params = {}, scratch }) {
  if (!grid || !state || !scratch) return;
  const {
    psMin = 50000,
    psMax = 110000,
    conserveGlobalMean = true,
    maxAbsDpsDt = 1.0
  } = params;

  const { nx, ny, invDx, invDy, cosLat } = grid;
  const { N, nz, u, v, ps, pHalf } = state;
  const { fluxU, fluxV, dpsDt } = scratch;
  if (!fluxU || !fluxV || !dpsDt) return;

  dpsDt.fill(0);

  for (let lev = 0; lev < nz; lev++) {
    const base = lev * N;
    const baseHalf = lev * N;
    const baseHalfNext = (lev + 1) * N;
    for (let k = 0; k < N; k++) {
      const dp = pHalf[baseHalfNext + k] - pHalf[baseHalf + k];
      fluxU[k] = u[base + k] * dp;
      fluxV[k] = v[base + k] * dp;
    }

    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const rowN = jN * nx;
      const rowS = jS * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      const cosC = cosLat[j];
      const cosN = cosLat[jN];
      const cosS = cosLat[jS];
      for (let i = 0; i < nx; i++) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const kE = row + iE;
        const kW = row + iW;
        const kN = rowN + i;
        const kS = rowS + i;
        const dFluxVcos_dy = (fluxV[kN] * cosN - fluxV[kS] * cosS) * 0.5 * invDyRow;
        const divFlux = (fluxU[kE] - fluxU[kW]) * 0.5 * invDxRow + dFluxVcos_dy / cosC;
        dpsDt[k] -= divFlux;
      }
    }
  }

  if (conserveGlobalMean) {
    let sum = 0;
    let den = 0;
    for (let j = 0; j < ny; j++) {
      const w = cosLat[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        sum += dpsDt[k] * w;
        den += w;
      }
    }
    const mean = den > 0 ? sum / den : 0;
    for (let k = 0; k < N; k++) {
      dpsDt[k] -= mean;
    }
  }

  for (let k = 0; k < N; k++) {
    const capped = clamp(dpsDt[k], -maxAbsDpsDt, maxAbsDpsDt);
    ps[k] = clamp(ps[k] + capped * dt, psMin, psMax);
  }
}
