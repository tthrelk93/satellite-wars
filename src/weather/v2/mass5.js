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

  if (!state.dpsDtRaw || state.dpsDtRaw.length !== N) {
    state.dpsDtRaw = new Float32Array(N);
  }
  if (!state.dpsDtApplied || state.dpsDtApplied.length !== N) {
    state.dpsDtApplied = new Float32Array(N);
  }
  const dpsDtApplied = state.dpsDtApplied;
  for (let k = 0; k < N; k++) {
    state.dpsDtRaw[k] = dpsDt[k];
    dpsDtApplied[k] = clamp(dpsDt[k], -maxAbsDpsDt, maxAbsDpsDt);
  }

  let sumApplied = 0;
  let denApplied = 0;
  for (let j = 0; j < ny; j++) {
    const w = cosLat[j];
    const row = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = row + i;
      sumApplied += dpsDtApplied[k] * w;
      denApplied += w;
    }
  }
  const meanApplied = denApplied > 0 ? sumApplied / denApplied : 0;
  for (let k = 0; k < N; k++) {
    dpsDtApplied[k] -= meanApplied;
  }

  let clampMinCount = 0;
  let clampMaxCount = 0;
  let isFree = state._dpsDtFreeMask;
  if (!isFree || isFree.length !== N) {
    isFree = new Uint8Array(N);
    state._dpsDtFreeMask = isFree;
  }

  const iterations = 3;
  for (let iter = 0; iter < iterations; iter++) {
    let freeWeight = 0;
    let sumAppliedPre = 0;
    let denAppliedPre = 0;
    for (let j = 0; j < ny; j++) {
      const w = cosLat[j];
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        const lo = (psMin - ps[k]) / dt;
        const hi = (psMax - ps[k]) / dt;
        let applied = dpsDtApplied[k];
        if (applied < lo) {
          applied = lo;
          isFree[k] = 0;
        } else if (applied > hi) {
          applied = hi;
          isFree[k] = 0;
        } else {
          isFree[k] = 1;
          freeWeight += w;
        }
        dpsDtApplied[k] = applied;
        sumAppliedPre += applied * w;
        denAppliedPre += w;
      }
    }

    const meanAppliedPre = denAppliedPre > 0 ? sumAppliedPre / denAppliedPre : 0;
    if (freeWeight <= 0 || meanAppliedPre === 0) break;
    const corr = -meanAppliedPre;
    const scale = denAppliedPre / freeWeight;
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        if (!isFree[k]) continue;
        dpsDtApplied[k] += corr * scale;
      }
    }
  }

  let sumAppliedPost = 0;
  let denAppliedPost = 0;
  let sumActual = 0;
  let denActual = 0;
  for (let j = 0; j < ny; j++) {
    const w = cosLat[j];
    const row = j * nx;
    for (let i = 0; i < nx; i++) {
      const k = row + i;
      const applied = dpsDtApplied[k];
      const psOld = ps[k];
      const psNew = psOld + applied * dt;
      if (psNew < psMin) {
        clampMinCount += 1;
        dpsDtApplied[k] = (psMin - psOld) / dt;
        ps[k] = psMin;
      } else if (psNew > psMax) {
        clampMaxCount += 1;
        dpsDtApplied[k] = (psMax - psOld) / dt;
        ps[k] = psMax;
      } else {
        ps[k] = psNew;
      }
      sumAppliedPost += dpsDtApplied[k] * w;
      denAppliedPost += w;
      const actual = (ps[k] - psOld) / dt;
      sumActual += actual * w;
      denActual += w;
    }
  }
  state.psClampMinCount = clampMinCount;
  state.psClampMaxCount = clampMaxCount;
  state.meanDpsDtApplied = denAppliedPost > 0 ? sumAppliedPost / denAppliedPost : 0;
  state.meanDpsDtActual = denActual > 0 ? sumActual / denActual : 0;
}
