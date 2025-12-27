import { advectScalar, advectVector } from './advect';
import { Omega, g } from './constants';

const clampMin = (v, min) => (v < min ? min : v);

const computeDxDy = (grid, j, minDx) => {
  const kmPerDegLat = 111.0;
  const dx = Math.max(minDx, kmPerDegLat * 1000 * grid.cellLonDeg * grid.cosLat[j]);
  const dy = kmPerDegLat * 1000 * grid.cellLatDeg;
  return { dx, dy };
};

const computeDiv = (u, v, grid, out, minDx) => {
  const { nx, ny } = grid;
  for (let j = 0; j < ny; j++) {
    const { dx, dy } = computeDxDy(grid, j, minDx);
    const invDx = 1 / dx;
    const invDy = 1 / dy;
    for (let i = 0; i < nx; i++) {
      const iE = (i + 1) % nx;
      const iW = (i - 1 + nx) % nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const k = j * nx + i;
      const kE = j * nx + iE;
      const kW = j * nx + iW;
      const kN = jN * nx + i;
      const kS = jS * nx + i;
      out[k] = (u[kE] - u[kW]) * 0.5 * invDx + (v[kN] - v[kS]) * 0.5 * invDy;
    }
  }
};

const laplacian = (src, grid, out, minDx) => {
  const { nx, ny } = grid;
  for (let j = 0; j < ny; j++) {
    const { dx, dy } = computeDxDy(grid, j, minDx);
    const invDx2 = 1 / (dx * dx);
    const invDy2 = 1 / (dy * dy);
    for (let i = 0; i < nx; i++) {
      const iE = (i + 1) % nx;
      const iW = (i - 1 + nx) % nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const k = j * nx + i;
      const kE = j * nx + iE;
      const kW = j * nx + iW;
      const kN = jN * nx + i;
      const kS = jS * nx + i;
      out[k] =
        (src[kE] + src[kW] - 2 * src[k]) * invDx2 +
        (src[kN] + src[kS] - 2 * src[k]) * invDy2;
    }
  }
};

const hyperdiffuse = (field, grid, scratch, dt, nu4, minDx) => {
  if (!nu4 || nu4 <= 0) return;
  laplacian(field, grid, scratch.lap, minDx);
  laplacian(scratch.lap, grid, scratch.lap2, minDx);
  for (let k = 0; k < field.length; k++) {
    field[k] -= nu4 * dt * scratch.lap2[k];
  }
};

const applyPolarFilter = (field, grid, scratch) => {
  const { nx, ny, latDeg } = grid;
  const rowA = scratch.rowA;
  const rowB = scratch.rowB;
  for (let j = 0; j < ny; j++) {
    const latAbs = Math.abs(latDeg[j]);
    if (latAbs < 60) continue;
    const passes = Math.min(4, 1 + Math.floor((latAbs - 60) / 7));
    for (let i = 0; i < nx; i++) {
      rowA[i] = field[j * nx + i];
    }
    let src = rowA;
    let dst = rowB;
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < nx; i++) {
        const iW = (i - 1 + nx) % nx;
        const iE = (i + 1) % nx;
        dst[i] = 0.25 * src[iW] + 0.5 * src[i] + 0.25 * src[iE];
      }
      const swap = src;
      src = dst;
      dst = swap;
    }
    for (let i = 0; i < nx; i++) {
      field[j * nx + i] = src[i];
    }
  }
};

export function stepDyn2Layer({ dt, grid, fields, params, scratch }) {
  const {
    hL,
    hU,
    u,
    v,
    uU,
    vU,
    divDynL,
    divDynU,
    T,
    TU
  } = fields;
  const {
    hMin = 500,
    alpha = 0.25,
    tauShear = 3 * 86400,
    tauDragL = 3 * 86400,
    tauDragU = 10 * 86400,
    nu4 = 1e16,
    minDx = 20000,
    maxWind = 150,
    thermoCouplingL = 0,
    thermoCouplingU = 0,
    thermoTrefL = 285,
    thermoTrefU = 270
  } = params;

  advectVector({
    uSrc: u,
    vSrc: v,
    uDst: scratch.uLAdv,
    vDst: scratch.vLAdv,
    u,
    v,
    dt,
    grid
  });
  advectVector({
    uSrc: uU,
    vSrc: vU,
    uDst: scratch.uUAdv,
    vDst: scratch.vUAdv,
    u: uU,
    v: vU,
    dt,
    grid
  });

  advectScalar({ src: hL, dst: scratch.hLAdv, u, v, dt, grid });
  advectScalar({ src: hU, dst: scratch.hUAdv, u: uU, v: vU, dt, grid });

  computeDiv(scratch.uLAdv, scratch.vLAdv, grid, scratch.divL, minDx);
  computeDiv(scratch.uUAdv, scratch.vUAdv, grid, scratch.divU, minDx);

  if (divDynL && divDynU) {
    for (let k = 0; k < divDynL.length; k++) {
      divDynL[k] = scratch.divL[k];
      divDynU[k] = scratch.divU[k];
    }
  }

  for (let k = 0; k < hL.length; k++) {
    const hLNew = scratch.hLAdv[k] * Math.exp(-scratch.divL[k] * dt);
    const hUNew = scratch.hUAdv[k] * Math.exp(-scratch.divU[k] * dt);
    hL[k] = Number.isFinite(hLNew) ? clampMin(hLNew, hMin) : hMin;
    hU[k] = Number.isFinite(hUNew) ? clampMin(hUNew, hMin) : hMin;
    const uLNew = scratch.uLAdv[k];
    const vLNew = scratch.vLAdv[k];
    const uUNew = scratch.uUAdv[k];
    const vUNew = scratch.vUAdv[k];
    u[k] = Number.isFinite(uLNew) ? uLNew : 0;
    v[k] = Number.isFinite(vLNew) ? vLNew : 0;
    uU[k] = Number.isFinite(uUNew) ? uUNew : 0;
    vU[k] = Number.isFinite(vUNew) ? vUNew : 0;
  }

  for (let k = 0; k < hL.length; k++) {
    const thermL = thermoCouplingL ? thermoCouplingL * (T[k] - thermoTrefL) : 0;
    const thermU = thermoCouplingU ? thermoCouplingU * (TU[k] - thermoTrefU) : 0;
    scratch.phiL[k] = g * (hL[k] + alpha * hU[k] + thermL);
    scratch.phiU[k] = g * (hU[k] + alpha * hL[k] + thermU);
  }

  const { nx, ny, sinLat } = grid;
  for (let j = 0; j < ny; j++) {
    const { dx, dy } = computeDxDy(grid, j, minDx);
    const invDx = 1 / dx;
    const invDy = 1 / dy;
    const f = 2 * Omega * sinLat[j];
    for (let i = 0; i < nx; i++) {
      const iE = (i + 1) % nx;
      const iW = (i - 1 + nx) % nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const k = j * nx + i;
      const kE = j * nx + iE;
      const kW = j * nx + iW;
      const kN = jN * nx + i;
      const kS = jS * nx + i;

      const dphiLdx = (scratch.phiL[kE] - scratch.phiL[kW]) * 0.5 * invDx;
      const dphiLdy = (scratch.phiL[kN] - scratch.phiL[kS]) * 0.5 * invDy;
      const dphiUdx = (scratch.phiU[kE] - scratch.phiU[kW]) * 0.5 * invDx;
      const dphiUdy = (scratch.phiU[kN] - scratch.phiU[kS]) * 0.5 * invDy;

      const uL0 = u[k];
      const vL0 = v[k];
      const uU0 = uU[k];
      const vU0 = vU[k];

      u[k] = uL0 + (-dphiLdx + f * vL0) * dt;
      v[k] = vL0 + (-dphiLdy - f * uL0) * dt;
      uU[k] = uU0 + (-dphiUdx + f * vU0) * dt;
      vU[k] = vU0 + (-dphiUdy - f * uU0) * dt;
    }
  }

  const shearCoeff = dt / Math.max(1, tauShear);
  for (let k = 0; k < u.length; k++) {
    const du = (uU[k] - u[k]) * shearCoeff;
    const dv = (vU[k] - v[k]) * shearCoeff;
    u[k] += du;
    v[k] += dv;
    uU[k] -= du;
    vU[k] -= dv;
  }

  const dragL = Math.exp(-dt / Math.max(1, tauDragL));
  const dragU = Math.exp(-dt / Math.max(1, tauDragU));
  for (let k = 0; k < u.length; k++) {
    u[k] *= dragL;
    v[k] *= dragL;
    uU[k] *= dragU;
    vU[k] *= dragU;
  }

  hyperdiffuse(u, grid, scratch, dt, nu4, minDx);
  hyperdiffuse(v, grid, scratch, dt, nu4, minDx);
  hyperdiffuse(uU, grid, scratch, dt, nu4, minDx);
  hyperdiffuse(vU, grid, scratch, dt, nu4, minDx);
  hyperdiffuse(hL, grid, scratch, dt, nu4, minDx);
  hyperdiffuse(hU, grid, scratch, dt, nu4, minDx);

  applyPolarFilter(u, grid, scratch);
  applyPolarFilter(v, grid, scratch);
  applyPolarFilter(uU, grid, scratch);
  applyPolarFilter(vU, grid, scratch);
  applyPolarFilter(hL, grid, scratch);
  applyPolarFilter(hU, grid, scratch);

  for (let k = 0; k < hL.length; k++) {
    if (!Number.isFinite(hL[k]) || hL[k] < hMin) hL[k] = hMin;
    if (!Number.isFinite(hU[k]) || hU[k] < hMin) hU[k] = hMin;

    let uL = u[k];
    let vL = v[k];
    if (!Number.isFinite(uL) || !Number.isFinite(vL)) {
      uL = 0;
      vL = 0;
    } else {
      const speed = Math.hypot(uL, vL);
      if (speed > maxWind) {
        const scale = maxWind / speed;
        uL *= scale;
        vL *= scale;
      }
    }
    u[k] = uL;
    v[k] = vL;

    let uUpper = uU[k];
    let vUpper = vU[k];
    if (!Number.isFinite(uUpper) || !Number.isFinite(vUpper)) {
      uUpper = 0;
      vUpper = 0;
    } else {
      const speedU = Math.hypot(uUpper, vUpper);
      if (speedU > maxWind) {
        const scale = maxWind / speedU;
        uUpper *= scale;
        vUpper *= scale;
      }
    }
    uU[k] = uUpper;
    vU[k] = vUpper;
  }
}
