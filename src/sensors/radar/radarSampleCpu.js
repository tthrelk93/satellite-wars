const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const wrapLonDeg = (lonDeg) => {
    let v = ((lonDeg + 180) % 360 + 360) % 360;
    return v - 180;
};

const wrapI = (i, nx) => ((i % nx) + nx) % nx;

const clampJ = (j, ny) => clamp(j, 0, ny - 1);

const bilinear2D = (field, iF, jF, nx, ny, offset = 0) => {
    const i0 = Math.floor(iF);
    const jFClamped = clamp(jF, 0, ny - 1);
    const j0 = Math.floor(jFClamped);
    const i1 = i0 + 1;
    const j1 = Math.min(j0 + 1, ny - 1);

    const t = iF - i0;
    const u = jFClamped - j0;

    const i0w = wrapI(i0, nx);
    const i1w = wrapI(i1, nx);
    const j0c = clampJ(j0, ny);
    const j1c = clampJ(j1, ny);

    const idx00 = offset + j0c * nx + i0w;
    const idx10 = offset + j0c * nx + i1w;
    const idx01 = offset + j1c * nx + i0w;
    const idx11 = offset + j1c * nx + i1w;

    const v00 = field[idx00];
    const v10 = field[idx10];
    const v01 = field[idx01];
    const v11 = field[idx11];

    const v0 = v00 + (v10 - v00) * t;
    const v1 = v01 + (v11 - v01) * t;
    return v0 + (v1 - v0) * u;
};

const nearest2D = (field, iF, jF, nx, ny, offset = 0) => {
    const i = wrapI(Math.round(iF), nx);
    const j = clampJ(Math.round(jF), ny);
    return field[offset + j * nx + i];
};

const sample3DAtLev = (field3D, lev, iF, jF, nx, ny, method) => {
    const offset = lev * nx * ny;
    if (method === 'nearest') {
        return nearest2D(field3D, iF, jF, nx, ny, offset);
    }
    return bilinear2D(field3D, iF, jF, nx, ny, offset);
};

export function sampleV2AtLatLonSigma(core, latDeg, lonDeg, sigma, options = {}) {
    if (!core?.state || !core?.grid) return null;
    if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg) || !Number.isFinite(sigma)) return null;

    const { state, grid } = core;
    const { nx, ny, cellLonDeg, cellLatDeg } = grid;
    if (!nx || !ny || !cellLonDeg || !cellLatDeg) return null;

    const method = options.method === 'nearest' ? 'nearest' : 'bilinear';
    const sigmaClamped = clamp(sigma, 0, 1);

    const lonWrapped = wrapLonDeg(lonDeg);
    const iF = (lonWrapped + 180) / cellLonDeg - 0.5;
    const jF = (90 - latDeg) / cellLatDeg - 0.5;

    const sigmaHalf = state.sigmaHalf || core.sigmaHalf;
    const nz = state.nz || core.nz;
    if (!sigmaHalf || !nz || sigmaHalf.length < nz + 1) return null;

    let lev0 = 0;
    let lev1 = 0;
    let tLev = 0;

    if (nz > 1) {
        let prevSigmaMid = 0.5 * (sigmaHalf[0] + sigmaHalf[1]);
        if (sigmaClamped <= prevSigmaMid) {
            lev0 = 0;
            lev1 = 0;
            tLev = 0;
        } else {
            let found = false;
            for (let lev = 1; lev < nz; lev += 1) {
                const sigmaMid = 0.5 * (sigmaHalf[lev] + sigmaHalf[lev + 1]);
                if (sigmaClamped <= sigmaMid) {
                    lev0 = lev - 1;
                    lev1 = lev;
                    const denom = sigmaMid - prevSigmaMid;
                    tLev = denom > 0 ? (sigmaClamped - prevSigmaMid) / denom : 0;
                    found = true;
                    break;
                }
                prevSigmaMid = sigmaMid;
            }
            if (!found) {
                lev0 = nz - 1;
                lev1 = nz - 1;
                tLev = 0;
            }
        }
    }

    const { qr, qi, u, v, ps } = state;
    if (!qr || !u || !v || !ps) return null;

    const qr0 = sample3DAtLev(qr, lev0, iF, jF, nx, ny, method);
    const qr1 = sample3DAtLev(qr, lev1, iF, jF, nx, ny, method);
    const u0 = sample3DAtLev(u, lev0, iF, jF, nx, ny, method);
    const u1 = sample3DAtLev(u, lev1, iF, jF, nx, ny, method);
    const v0 = sample3DAtLev(v, lev0, iF, jF, nx, ny, method);
    const v1 = sample3DAtLev(v, lev1, iF, jF, nx, ny, method);
    const psVal = method === 'nearest'
        ? nearest2D(ps, iF, jF, nx, ny)
        : bilinear2D(ps, iF, jF, nx, ny);

    let qiVal = 0;
    if (qi) {
        const qi0 = sample3DAtLev(qi, lev0, iF, jF, nx, ny, method);
        const qi1 = sample3DAtLev(qi, lev1, iF, jF, nx, ny, method);
        qiVal = qi0 + (qi1 - qi0) * tLev;
    }

    const out = {
        qr: qr0 + (qr1 - qr0) * tLev,
        qi: qiVal,
        u: u0 + (u1 - u0) * tLev,
        v: v0 + (v1 - v0) * tLev,
        ps: psVal
    };

    if (options.returnMeta) {
        out.meta = { iF, jF, lev0, lev1, tLev };
    }

    return out;
}
