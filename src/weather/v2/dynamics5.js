import { Re } from '../constants.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function stepWinds5({ dt, grid, state, geo, params = {}, scratch }) {
  if (!grid || !state || !scratch) return;
  const {
    maxWind = 70,
    tauDragSurface = 4 * 3600,
    tauDragTop = 2 * 86400,
    nuLaplacian = 4_000_000,
    quadDragAlphaSurface = 0.02,
    tropicsDragBoost = 0.5,
    tropicsDragLat0Deg = 10,
    tropicsDragLat1Deg = 30,
    terrainDragBoost = 2.0,
    terrainSlopeRef = 0.003,
    landRoughnessBoost = 0.3,
    polarFilterLatStartDeg = 60,
    polarFilterEverySteps = 1,
    extraFilterEverySteps = 15,
    extraFilterPasses = 2,
    enableMetricTerms = true,
    diagnosticsLevel = -1,
    collectDiagnostics = false,
    stepIndex = 0
  } = params;

  const { nx, ny, invDx, invDy, f, latDeg, polarWeight, sinLat, cosLat } = grid;
  const { N, nz, u, v, phiMid, landMask } = state;
  const elevField = geo?.elev && geo.elev.length === N ? geo.elev : null;
  const { lapU, lapV, lapLapU, lapLapV, rowA, rowB } = scratch;
  if (!lapU || !lapV || !lapLapU || !lapLapV || !rowA || !rowB) return;

  const applyPolarFilter = polarFilterEverySteps > 0 && (stepIndex % polarFilterEverySteps === 0);
  const applyExtra = extraFilterEverySteps > 0 && (stepIndex % extraFilterEverySteps === 0);
  const extraPasses = applyExtra ? extraFilterPasses : 0;
  const shouldCollectDiagnostics = collectDiagnostics && Number.isInteger(diagnosticsLevel) && diagnosticsLevel >= 0 && diagnosticsLevel < nz;
  let diagCount = 0;
  let diagClamped = 0;
  let sumPGradDelta2 = 0;
  let sumCoriolisDelta2 = 0;
  let sumDragDelta2 = 0;
  let sumDiffDelta2 = 0;
  let sumMetricDelta2 = 0;
  let sumPreClampSpeed = 0;
  let sumPostClampSpeed = 0;
  let maxPreClampSpeed = 0;
  let maxPostClampSpeed = 0;

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
    laplacianLevel(lapU, 0, lapLapU);
    laplacianLevel(lapV, 0, lapLapV);
    const t = nz > 1 ? lev / (nz - 1) : 0;
    const tauDragLev = lerp(tauDragTop, tauDragSurface, t);
    const nuHyper = nuLaplacian;
    const nuLapSmall = nuLaplacian * 0.05;

    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      const fRow = f[j];
      const metricCoeff = enableMetricTerms ? (sinLat[j] / cosLat[j]) / Re : 0;
      const latAbs = Math.abs(latDeg[j]);
      const tropicsT = clamp01((latAbs - tropicsDragLat0Deg) / (tropicsDragLat1Deg - tropicsDragLat0Deg));
      const tropicsFactor = 1 + (1 - tropicsT) * tropicsDragBoost;
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

        const slopeX = elevField
          ? (elevField[row + iE] - elevField[row + iW]) * 0.5 * invDxRow
          : 0;
        const slopeY = elevField
          ? (elevField[rowN + i] - elevField[rowS + i]) * 0.5 * invDyRow
          : 0;
        const slopeMag = Math.hypot(slopeX, slopeY);
        const terrainFactor = clamp01(slopeMag / Math.max(1e-6, terrainSlopeRef));
        const landFactor = landMask?.[k] === 1 ? landRoughnessBoost : 0;
        const u0 = u[idx0];
        const v0 = v[idx0];
        const speed0 = Math.hypot(u0, v0);
        const quadAlphaLev = quadDragAlphaSurface * t;
        const dragFactor = (1 + quadAlphaLev * speed0) * tropicsFactor * (1 + terrainDragBoost * terrainFactor + landFactor * t);
        const dragU = -(dragFactor * u0) / tauDragLev;
        const dragV = -(dragFactor * v0) / tauDragLev;
        const diffU = (-nuHyper * lapLapU[k]) + (nuLapSmall * lapU[k]);
        const diffV = (-nuHyper * lapLapV[k]) + (nuLapSmall * lapV[k]);
        const metricU = metricCoeff * u0 * v0;
        const metricV = -metricCoeff * u0 * u0;
        const pGradU = -dphidx;
        const pGradV = -dphidy;
        const coriolisU = fRow * v0;
        const coriolisV = -fRow * u0;

        let u1 = u0 + (pGradU + coriolisU + dragU + diffU + metricU) * dt;
        let v1 = v0 + (pGradV + coriolisV + dragV + diffV + metricV) * dt;
        const preClampSpeed = Math.hypot(u1, v1);
        let clamped = false;
        const speed = Math.hypot(u1, v1);
        if (speed > maxWind) {
          const s = maxWind / speed;
          u1 *= s;
          v1 *= s;
          clamped = true;
        }
        u[idx0] = u1;
        v[idx0] = v1;

        if (shouldCollectDiagnostics && lev === diagnosticsLevel) {
          diagCount += 1;
          if (clamped) diagClamped += 1;
          const pGradDelta = Math.hypot(pGradU, pGradV) * dt;
          const coriolisDelta = Math.hypot(coriolisU, coriolisV) * dt;
          const dragDelta = Math.hypot(dragU, dragV) * dt;
          const diffDelta = Math.hypot(diffU, diffV) * dt;
          const metricDelta = Math.hypot(metricU, metricV) * dt;
          sumPGradDelta2 += pGradDelta * pGradDelta;
          sumCoriolisDelta2 += coriolisDelta * coriolisDelta;
          sumDragDelta2 += dragDelta * dragDelta;
          sumDiffDelta2 += diffDelta * diffDelta;
          sumMetricDelta2 += metricDelta * metricDelta;
          sumPreClampSpeed += preClampSpeed;
          const postClampSpeed = Math.hypot(u1, v1);
          sumPostClampSpeed += postClampSpeed;
          maxPreClampSpeed = Math.max(maxPreClampSpeed, preClampSpeed);
          maxPostClampSpeed = Math.max(maxPostClampSpeed, postClampSpeed);
        }
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

  if (!shouldCollectDiagnostics || diagCount <= 0) return null;
  const rms = (sum) => Math.sqrt(sum / diagCount);
  return {
    level: diagnosticsLevel,
    count: diagCount,
    rmsDeltaPGrad: rms(sumPGradDelta2),
    rmsDeltaCoriolis: rms(sumCoriolisDelta2),
    rmsDeltaDrag: rms(sumDragDelta2),
    rmsDeltaDiffusion: rms(sumDiffDelta2),
    rmsDeltaMetric: rms(sumMetricDelta2),
    meanPreClampSpeed: sumPreClampSpeed / diagCount,
    meanPostClampSpeed: sumPostClampSpeed / diagCount,
    maxPreClampSpeed,
    maxPostClampSpeed,
    fracClamped: diagClamped / diagCount
  };
}
