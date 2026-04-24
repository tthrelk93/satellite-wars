import { SURFACE_MOISTURE_SOURCE_FIELDS } from './sourceTracing5.js';
import {
  CLOUD_BIRTH_LEVEL_BAND_COUNT,
  cloudBirthBandOffset,
  findCloudBirthLevelBandIndex
} from './cloudBirthTracing5.js';
import {
  INSTRUMENTATION_LEVEL_BAND_COUNT,
  findInstrumentationLevelBandIndex,
  instrumentationBandOffset,
  sigmaMidAtLevel
} from './instrumentationBands5.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clamp01 = (v) => clamp(v, 0, 1);
const smoothstep01 = (t) => t * t * (3 - 2 * t);
const GRAVITY = 9.80665;
const WATER_REPAIR_EPS_KG_M2 = 1e-9;

const accumulateBandValue = (field, bandIndex, cell, cellCount, value, enabled = true) => {
  if (
    !enabled
    || 
    !(field instanceof Float32Array)
    || field.length !== cellCount * INSTRUMENTATION_LEVEL_BAND_COUNT
    || !Number.isFinite(value)
    || value === 0
  ) return;
  field[instrumentationBandOffset(bandIndex, cell, cellCount)] += value;
};

export function stepAdvection5({ dt, grid, state, params = {}, scratch }) {
  if (!grid || !state || !scratch) return;
  const traceEnabled = state.instrumentationEnabled !== false;
  const {
    polarLatStartDeg = 60,
    filterMoisture = false,
    maxBacktraceCells = 2,
    conserveWater = true
  } = params;

  const { nx, ny, invDx, invDy, sinLat, latDeg, polarWeight, cellLonDeg, cosLat } = grid;
  const { N, nz, u, v, theta, qv, qc, qi, qr, pHalf } = state;
  const qs = state.qs;
  const { tmpU, tmpV, tmp3D, rowA, rowB } = scratch;
  if (!tmpU || !tmpV || !tmp3D || !rowA || !rowB) return;
  if (!state.advectedCloudImportByBandMass || state.advectedCloudImportByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.advectedCloudImportByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }
  if (!state.advectedCloudExportByBandMass || state.advectedCloudExportByBandMass.length !== N * CLOUD_BIRTH_LEVEL_BAND_COUNT) {
    state.advectedCloudExportByBandMass = new Float32Array(N * CLOUD_BIRTH_LEVEL_BAND_COUNT);
  }

  const degToRad = Math.PI / 180;
  const lonCellRad = cellLonDeg * degToRad;
  const cloudBefore = traceEnabled ? new Float32Array(state.SZ) : null;
  if (cloudBefore) {
    for (let idx = 0; idx < state.SZ; idx += 1) {
      cloudBefore[idx] = (qc[idx] || 0) + (qi[idx] || 0) + (qr[idx] || 0) + (qs?.[idx] || 0);
    }
  }
  const waterFieldSpecs = [
    { key: 'qv', field: qv },
    { key: 'qc', field: qc },
    { key: 'qi', field: qi },
    { key: 'qr', field: qr },
    { key: 'qs', field: qs }
  ].filter(({ field }) => field instanceof Float32Array && field.length === qv.length);
  const computeColumnMass = (field) => {
    if (!(pHalf instanceof Float32Array) || pHalf.length !== (nz + 1) * N) return null;
    const columnMass = new Float64Array(N);
    for (let k = 0; k < N; k += 1) {
      for (let lev = 0; lev < nz; lev += 1) {
        const idx = lev * N + k;
        const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
        if (!(dp > 0)) continue;
        columnMass[k] += Math.max(0, field[idx] || 0) * (dp / GRAVITY);
      }
    }
    return columnMass;
  };
  const columnWeight = (cell) => Math.max(0.05, cosLat?.[Math.floor(cell / nx)] || 0);
  let weightTotal = 0;
  for (let k = 0; k < N; k += 1) weightTotal += columnWeight(k);
  const weightedColumnTotal = (columnMass) => {
    if (!columnMass || weightTotal <= 0) return null;
    let total = 0;
    for (let k = 0; k < N; k += 1) total += (columnMass[k] || 0) * columnWeight(k);
    return total;
  };
  const waterBeforeByField = conserveWater
    ? waterFieldSpecs.map((spec) => ({ ...spec, beforeColumn: computeColumnMass(spec.field) }))
    : [];

  const advectScalar = (src) => {
    for (let lev = 0; lev < nz; lev++) {
      const base = lev * N;
      for (let j = 0; j < ny; j++) {
        const row = j * nx;
        const invDxRow = invDx[j];
        const invDyRow = invDy[j];
        for (let i = 0; i < nx; i++) {
          const k = row + i;
          const idx = base + k;
          const u0 = u[idx];
          const v0 = v[idx];
          let di = u0 * dt * invDxRow;
          let dj = v0 * dt * invDyRow;
          di = clamp(di, -maxBacktraceCells, maxBacktraceCells);
          dj = clamp(dj, -maxBacktraceCells, maxBacktraceCells);
          let iSrc = i - di;
          let jSrc = j - dj;
          if (jSrc < 0) jSrc = 0;
          if (jSrc > ny - 1.001) jSrc = ny - 1.001;
          let i0 = Math.floor(iSrc);
          let j0 = Math.floor(jSrc);
          const fx = iSrc - i0;
          const fy = jSrc - j0;
          if (i0 < 0) i0 += nx;
          if (i0 >= nx) i0 -= nx;
          let i1 = i0 + 1;
          if (i1 >= nx) i1 -= nx;
          let j1 = j0 + 1;
          if (j1 >= ny) j1 = ny - 1;
          const k00 = base + j0 * nx + i0;
          const k10 = base + j0 * nx + i1;
          const k01 = base + j1 * nx + i0;
          const k11 = base + j1 * nx + i1;
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;
          tmp3D[idx] = src[k00] * w00 + src[k10] * w10 + src[k01] * w01 + src[k11] * w11;
        }
      }
    }
    src.set(tmp3D);
  };

  for (let lev = 0; lev < nz; lev++) {
    const base = lev * N;
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      const sinLatRow = sinLat[j];
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        const idx = base + k;
        const u0 = u[idx];
        const v0 = v[idx];
        const rawDi = u0 * dt * invDxRow;
        const rawDj = v0 * dt * invDyRow;
        let di = rawDi;
        let dj = rawDj;
        di = clamp(di, -maxBacktraceCells, maxBacktraceCells);
        dj = clamp(dj, -maxBacktraceCells, maxBacktraceCells);
        const clampedCells = Math.abs(rawDi - di) + Math.abs(rawDj - dj);
        if (clampedCells > 0) {
          state.numericalBacktraceClampCount[k] += 1;
          state.numericalBacktraceClampExcessCells[k] += clampedCells;
          accumulateBandValue(
            state.numericalBacktraceClampByBandCount,
            findInstrumentationLevelBandIndex(sigmaMidAtLevel(state.sigmaHalf, lev, nz)),
            k,
            N,
            1,
            traceEnabled
          );
        }
        let iSrc = i - di;
        let jSrc = j - dj;
        if (jSrc < 0) jSrc = 0;
        if (jSrc > ny - 1.001) jSrc = ny - 1.001;
        let i0 = Math.floor(iSrc);
        let j0 = Math.floor(jSrc);
        const fx = iSrc - i0;
        const fy = jSrc - j0;
        if (i0 < 0) i0 += nx;
        if (i0 >= nx) i0 -= nx;
        let i1 = i0 + 1;
        if (i1 >= nx) i1 -= nx;
        let j1 = j0 + 1;
        if (j1 >= ny) j1 = ny - 1;
        const k00 = base + j0 * nx + i0;
        const k10 = base + j0 * nx + i1;
        const k01 = base + j1 * nx + i0;
        const k11 = base + j1 * nx + i1;
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;
        const uS = u[k00] * w00 + u[k10] * w10 + u[k01] * w01 + u[k11] * w11;
        const vS = v[k00] * w00 + v[k10] * w10 + v[k01] * w01 + v[k11] * w11;
        const deltaLonRad = di * lonCellRad;
        const alpha = deltaLonRad * sinLatRow;
        const cosA = Math.cos(alpha);
        const sinA = Math.sin(alpha);
        tmpU[idx] = uS * cosA - vS * sinA;
        tmpV[idx] = uS * sinA + vS * cosA;
      }
    }
  }

  advectScalar(theta);
  advectScalar(qv);
  advectScalar(qc);
  advectScalar(qi);
  advectScalar(qr);
  if (qs instanceof Float32Array && qs.length === qv.length) {
    advectScalar(qs);
  }
  for (const fieldName of SURFACE_MOISTURE_SOURCE_FIELDS) {
    if (state[fieldName] instanceof Float32Array && state[fieldName].length === qv.length) {
      advectScalar(state[fieldName]);
    }
  }

  u.set(tmpU);
  v.set(tmpV);

  const applyFilter = (field, base, j, passes) => {
    if (passes <= 0) return;
    const rowStart = base + j * nx;
    for (let i = 0; i < nx; i++) {
      rowA[i] = field[rowStart + i];
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
      field[rowStart + i] = read[i];
    }
  };

  for (let lev = 0; lev < nz; lev++) {
    const base = lev * N;
    for (let j = 0; j < ny; j++) {
      const latAbs = Math.abs(latDeg[j]);
      if (latAbs < polarLatStartDeg) continue;
      const passes = 2 + Math.floor(2 * (polarWeight ? polarWeight[j] : 1));
      const t = clamp01((latAbs - 80) / 5);
      const uvScale = smoothstep01(t);
      const passesUv = Math.round(passes * uvScale);
      applyFilter(theta, base, j, passes);
      if (passesUv > 0) {
        applyFilter(u, base, j, passesUv);
        applyFilter(v, base, j, passesUv);
      }
      if (filterMoisture) {
        applyFilter(qv, base, j, passes);
        applyFilter(qc, base, j, passes);
        applyFilter(qi, base, j, passes);
        applyFilter(qr, base, j, passes);
        if (qs instanceof Float32Array && qs.length === qv.length) {
          applyFilter(qs, base, j, passes);
        }
      }
    }
  }

  if (conserveWater && weightTotal > 0 && waterBeforeByField.length) {
    let repairAbsWeighted = 0;
    let repairAddedWeighted = 0;
    let repairRemovedWeighted = 0;
    let repairResidualWeighted = 0;

    const adjustQvSourceTracers = (cell, levelScales, levelAdds) => {
      for (const fieldName of SURFACE_MOISTURE_SOURCE_FIELDS) {
        const field = state[fieldName];
        if (!(field instanceof Float32Array) || field.length !== qv.length) continue;
        for (let lev = 0; lev < nz; lev += 1) {
          const idx = lev * N + cell;
          if (levelScales) field[idx] = Math.max(0, (field[idx] || 0) * levelScales[lev]);
        }
      }
      const carryover = state.qvSourceAtmosphericCarryover;
      if (carryover instanceof Float32Array && carryover.length === qv.length && levelAdds) {
        for (let lev = 0; lev < nz; lev += 1) {
          const add = levelAdds[lev] || 0;
          if (add > 0) carryover[lev * N + cell] += add;
        }
      }
    };

    const applyColumnCorrection = ({ key, field, beforeColumn }, correctionByCell) => {
      for (let k = 0; k < N; k += 1) {
        const correction = correctionByCell[k] || 0;
        if (Math.abs(correction) <= WATER_REPAIR_EPS_KG_M2) continue;
        const levelScales = key === 'qv' ? new Float64Array(nz) : null;
        const levelAdds = key === 'qv' ? new Float64Array(nz) : null;
        let afterColumn = 0;
        for (let lev = 0; lev < nz; lev += 1) {
          const idx = lev * N + k;
          const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
          if (dp > 0) afterColumn += Math.max(0, field[idx] || 0) * (dp / GRAVITY);
        }
        if (correction < 0 && afterColumn > WATER_REPAIR_EPS_KG_M2) {
          const removeMass = Math.min(afterColumn, -correction);
          const scale = clamp((afterColumn - removeMass) / afterColumn, 0, 1);
          for (let lev = 0; lev < nz; lev += 1) {
            const idx = lev * N + k;
            field[idx] = Math.max(0, (field[idx] || 0) * scale);
            if (levelScales) levelScales[lev] = scale;
          }
          if (key === 'qv') adjustQvSourceTracers(k, levelScales, null);
        } else if (correction > 0) {
          if (afterColumn > WATER_REPAIR_EPS_KG_M2) {
            const scale = (afterColumn + correction) / afterColumn;
            for (let lev = 0; lev < nz; lev += 1) {
              const idx = lev * N + k;
              const before = Math.max(0, field[idx] || 0);
              const after = before * scale;
              field[idx] = after;
              if (levelScales) levelScales[lev] = 1;
              if (levelAdds) levelAdds[lev] = Math.max(0, after - before);
            }
          } else {
            let targetLev = nz - 1;
            let layerMass = 0;
            for (let lev = nz - 1; lev >= 0; lev -= 1) {
              const dp = pHalf[(lev + 1) * N + k] - pHalf[lev * N + k];
              if (dp > 0) {
                targetLev = lev;
                layerMass = dp / GRAVITY;
                break;
              }
            }
            if (layerMass > 0) {
              const idx = targetLev * N + k;
              const dq = correction / layerMass;
              field[idx] = Math.max(0, (field[idx] || 0) + dq);
              if (levelScales) {
                for (let lev = 0; lev < nz; lev += 1) levelScales[lev] = 1;
              }
              if (levelAdds) levelAdds[targetLev] = dq;
            }
          }
          if (key === 'qv') adjustQvSourceTracers(k, levelScales, levelAdds);
        }
      }
    };

    for (const spec of waterBeforeByField) {
      const { key, field, beforeColumn } = spec;
      if (!beforeColumn) continue;
      const afterColumn = computeColumnMass(field);
      const beforeWeighted = weightedColumnTotal(beforeColumn);
      const afterWeighted = weightedColumnTotal(afterColumn);
      if (!Number.isFinite(beforeWeighted) || !Number.isFinite(afterWeighted)) continue;
      const driftWeighted = afterWeighted - beforeWeighted;
      if (Math.abs(driftWeighted) / weightTotal <= WATER_REPAIR_EPS_KG_M2) continue;

      const correctionByCell = new Float64Array(N);
      if (driftWeighted > 0) {
        let candidateWeighted = 0;
        let useFallback = false;
        for (let k = 0; k < N; k += 1) {
          const gain = Math.max(0, (afterColumn[k] || 0) - (beforeColumn[k] || 0));
          candidateWeighted += gain * columnWeight(k);
        }
        if (candidateWeighted <= WATER_REPAIR_EPS_KG_M2) {
          useFallback = true;
          for (let k = 0; k < N; k += 1) candidateWeighted += Math.max(0, afterColumn[k] || 0) * columnWeight(k);
        }
        if (candidateWeighted > WATER_REPAIR_EPS_KG_M2) {
          for (let k = 0; k < N; k += 1) {
            const preferred = Math.max(0, (afterColumn[k] || 0) - (beforeColumn[k] || 0));
            const fallback = Math.max(0, afterColumn[k] || 0);
            const basis = useFallback ? fallback : preferred;
            if (!(basis > 0)) continue;
            correctionByCell[k] = -((driftWeighted * (basis * columnWeight(k)) / candidateWeighted) / columnWeight(k));
          }
        }
      } else {
        const deficitWeighted = -driftWeighted;
        let candidateWeighted = 0;
        let useFallback = false;
        for (let k = 0; k < N; k += 1) {
          const loss = Math.max(0, (beforeColumn[k] || 0) - (afterColumn[k] || 0));
          candidateWeighted += loss * columnWeight(k);
        }
        if (candidateWeighted <= WATER_REPAIR_EPS_KG_M2) {
          useFallback = true;
          for (let k = 0; k < N; k += 1) candidateWeighted += Math.max(0, beforeColumn[k] || 0) * columnWeight(k);
        }
        if (candidateWeighted > WATER_REPAIR_EPS_KG_M2) {
          for (let k = 0; k < N; k += 1) {
            const preferred = Math.max(0, (beforeColumn[k] || 0) - (afterColumn[k] || 0));
            const fallback = Math.max(0, beforeColumn[k] || 0);
            const basis = useFallback ? fallback : preferred;
            if (!(basis > 0)) continue;
            correctionByCell[k] = (deficitWeighted * (basis * columnWeight(k)) / candidateWeighted) / columnWeight(k);
          }
        }
      }

      applyColumnCorrection({ key, field, beforeColumn }, correctionByCell);
      const finalColumn = computeColumnMass(field);
      const finalWeighted = weightedColumnTotal(finalColumn);
      const fieldResidualWeighted = Number.isFinite(finalWeighted) ? finalWeighted - beforeWeighted : 0;
      repairResidualWeighted += Math.abs(fieldResidualWeighted);
      for (let k = 0; k < N; k += 1) {
        const correction = correctionByCell[k] || 0;
        const weighted = Math.abs(correction) * columnWeight(k);
        repairAbsWeighted += weighted;
        if (correction > 0) repairAddedWeighted += correction * columnWeight(k);
        if (correction < 0) repairRemovedWeighted += -correction * columnWeight(k);
        if (state.numericalAdvectionWaterRepairMass) state.numericalAdvectionWaterRepairMass[k] += Math.abs(correction);
        if (correction > 0 && state.numericalAdvectionWaterAddedMass) state.numericalAdvectionWaterAddedMass[k] += correction;
        if (correction < 0 && state.numericalAdvectionWaterRemovedMass) state.numericalAdvectionWaterRemovedMass[k] += -correction;
      }
    }

    state.numericalAdvectionWaterRepairMassMeanKgM2 =
      (state.numericalAdvectionWaterRepairMassMeanKgM2 || 0) + repairAbsWeighted / weightTotal;
    state.numericalAdvectionWaterAddedMassMeanKgM2 =
      (state.numericalAdvectionWaterAddedMassMeanKgM2 || 0) + repairAddedWeighted / weightTotal;
    state.numericalAdvectionWaterRemovedMassMeanKgM2 =
      (state.numericalAdvectionWaterRemovedMassMeanKgM2 || 0) + repairRemovedWeighted / weightTotal;
    state.numericalAdvectionWaterResidualMassMeanKgM2 =
      (state.numericalAdvectionWaterResidualMassMeanKgM2 || 0) + repairResidualWeighted / weightTotal;
  }

  if (cloudBefore && state.pHalf) {
    for (let lev = 0; lev < nz; lev += 1) {
      const sigmaMid = sigmaMidAtLevel(state.sigmaHalf, lev, nz);
      const bandIndex = findCloudBirthLevelBandIndex(sigmaMid);
      if (bandIndex < 0) continue;
      const base = lev * N;
      for (let k = 0; k < N; k += 1) {
        const idx = base + k;
        const beforeCloud = cloudBefore[idx] || 0;
        const afterCloud = (qc[idx] || 0) + (qi[idx] || 0) + (qr[idx] || 0) + (qs?.[idx] || 0);
        const deltaCloud = afterCloud - beforeCloud;
        if (deltaCloud === 0) continue;
        const dp = state.pHalf[(lev + 1) * N + k] - state.pHalf[lev * N + k];
        if (!(dp > 0)) continue;
        const deltaMass = Math.abs(deltaCloud) * (dp / 9.80665);
        const offset = cloudBirthBandOffset(bandIndex, k, N);
        if (deltaCloud > 0) state.advectedCloudImportByBandMass[offset] += deltaMass;
        else state.advectedCloudExportByBandMass[offset] += deltaMass;
      }
    }
  }
}
