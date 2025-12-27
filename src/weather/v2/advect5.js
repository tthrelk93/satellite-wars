const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function stepAdvection5({ dt, grid, state, params = {}, scratch }) {
  if (!grid || !state || !scratch) return;
  const {
    polarLatStartDeg = 60,
    filterMoisture = false,
    maxBacktraceCells = 2
  } = params;

  const { nx, ny, invDx, invDy, sinLat, latDeg, polarWeight, cellLonDeg } = grid;
  const { N, nz, u, v, theta, qv, qc, qi, qr } = state;
  const { tmpU, tmpV, tmp3D, rowA, rowB } = scratch;
  if (!tmpU || !tmpV || !tmp3D || !rowA || !rowB) return;

  const degToRad = Math.PI / 180;
  const lonCellRad = cellLonDeg * degToRad;

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
          let jSrc = j + dj;
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
        let di = u0 * dt * invDxRow;
        let dj = v0 * dt * invDyRow;
        di = clamp(di, -maxBacktraceCells, maxBacktraceCells);
        dj = clamp(dj, -maxBacktraceCells, maxBacktraceCells);
        let iSrc = i - di;
        let jSrc = j + dj;
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

  u.set(tmpU);
  v.set(tmpV);

  advectScalar(theta);
  advectScalar(qv);
  advectScalar(qc);
  advectScalar(qi);
  advectScalar(qr);

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
      if (Math.abs(latDeg[j]) < polarLatStartDeg) continue;
      const passes = 2 + Math.floor(2 * (polarWeight ? polarWeight[j] : 1));
      applyFilter(u, base, j, passes);
      applyFilter(v, base, j, passes);
      applyFilter(theta, base, j, passes);
      if (filterMoisture) {
        applyFilter(qv, base, j, passes);
        applyFilter(qc, base, j, passes);
        applyFilter(qi, base, j, passes);
        applyFilter(qr, base, j, passes);
      }
    }
  }
}
