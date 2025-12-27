import { Re } from '../constants';

const lerp = (a, b, t) => a + (b - a) * t;

export function stepWinds5({ dt, grid, state, params = {}, scratch }) {
  if (!grid || !state || !scratch) return;
  const {
    maxWind = 150,
    tauDragSurface = 6 * 86400,
    tauDragTop = 20 * 86400,
    nuLaplacian = 2e5,
    polarFilterLatStartDeg = 60,
    polarFilterEverySteps = 1,
    extraFilterEverySteps = 15,
    extraFilterPasses = 2,
    enableMetricTerms = true,
    stepIndex = 0
  } = params;

  const { nx, ny, invDx, invDy, f, latDeg, polarWeight, sinLat, cosLat } = grid;
  const { N, nz, u, v, phiMid } = state;
  const { lapU, lapV, rowA, rowB } = scratch;
  if (!lapU || !lapV || !rowA || !rowB) return;

  const applyPolarFilter = polarFilterEverySteps > 0 && (stepIndex % polarFilterEverySteps === 0);
  const applyExtra = extraFilterEverySteps > 0 && (stepIndex % extraFilterEverySteps === 0);
  const extraPasses = applyExtra ? extraFilterPasses : 0;

  const laplacianLevel = (src, base, out) => {
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      const invDx2 = invDxRow * invDxRow;
      const invDy2 = invDyRow * invDyRow;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const rowN = jN * nx;
      const rowS = jS * nx;
      for (let i = 0; i < nx; i++) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const v0 = src[base + k];
        const vE = src[base + row + iE];
        const vW = src[base + row + iW];
        const vN = src[base + rowN + i];
        const vS = src[base + rowS + i];
        out[k] = (vE + vW - 2 * v0) * invDx2 + (vN + vS - 2 * v0) * invDy2;
      }
    }
  };

  const filterRow = (src, base, j, passes) => {
    if (passes <= 0) return;
    const rowStart = base + j * nx;
    for (let i = 0; i < nx; i++) {
      rowA[i] = src[rowStart + i];
    }
    let read = rowA;
    let write = rowB;
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < nx; i++) {
        const iW = (i - 1 + nx) % nx;
        const iE = (i + 1) % nx;
        write[i] = 0.25 * read[iW] + 0.5 * read[i] + 0.25 * read[iE];
      }
      const tmp = read;
      read = write;
      write = tmp;
    }
    for (let i = 0; i < nx; i++) {
      src[rowStart + i] = read[i];
    }
  };

  for (let lev = 0; lev < nz; lev++) {
    const base = lev * N;
    laplacianLevel(u, base, lapU);
    laplacianLevel(v, base, lapV);
    const t = nz > 1 ? lev / (nz - 1) : 0;
    const tauDragLev = lerp(tauDragTop, tauDragSurface, t);

    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      const fRow = f[j];
      const metricCoeff = enableMetricTerms ? (sinLat[j] / cosLat[j]) / Re : 0;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const rowN = jN * nx;
      const rowS = jS * nx;
      for (let i = 0; i < nx; i++) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const idx0 = base + k;
        const idxE = base + row + iE;
        const idxW = base + row + iW;
        const idxN = base + rowN + i;
        const idxS = base + rowS + i;

        const dphidx = (phiMid[idxE] - phiMid[idxW]) * 0.5 * invDxRow;
        const dphidy = (phiMid[idxN] - phiMid[idxS]) * 0.5 * invDyRow;

        const u0 = u[idx0];
        const v0 = v[idx0];
        const dragU = -u0 / tauDragLev;
        const dragV = -v0 / tauDragLev;
        const diffU = nuLaplacian * lapU[k];
        const diffV = nuLaplacian * lapV[k];
        const metricU = metricCoeff * u0 * v0;
        const metricV = -metricCoeff * u0 * u0;

        let u1 = u0 + (-dphidx + fRow * v0 + dragU + diffU + metricU) * dt;
        let v1 = v0 + (-dphidy - fRow * u0 + dragV + diffV + metricV) * dt;
        const speed = Math.hypot(u1, v1);
        if (speed > maxWind) {
          const s = maxWind / speed;
          u1 *= s;
          v1 *= s;
        }
        u[idx0] = u1;
        v[idx0] = v1;
      }
    }

    if (applyPolarFilter) {
      for (let j = 0; j < ny; j++) {
        if (Math.abs(latDeg[j]) < polarFilterLatStartDeg) continue;
        const weight = polarWeight ? polarWeight[j] : 1;
        const passes = 1 + Math.floor(3 * weight) + extraPasses;
        filterRow(u, base, j, passes);
        filterRow(v, base, j, passes);
      }
    }
  }
}
