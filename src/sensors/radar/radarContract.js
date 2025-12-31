export const RADAR_V2_INDEXING = Object.freeze({
    k2D: 'k2D = j * nx + i',
    idx3D: 'idx3D = lev * (nx * ny) + k2D (lev=0 top, lev=nz-1 surface)'
});

export const RADAR_V2_REQUIRED_INPUTS = Object.freeze({
    state: Object.freeze({
        required3D: Object.freeze(['qr', 'u', 'v']),
        optional3D: Object.freeze(['qi']),
        required2D: Object.freeze(['ps']),
        vertical: Object.freeze(['sigmaHalf', 'nz'])
    }),
    grid: Object.freeze(['nx', 'ny', 'cellLonDeg', 'cellLatDeg'])
});

export const validateRadarV2Inputs = (core) => {
    const missing = [];
    const state = core?.state;
    const grid = core?.grid;

    if (!state) missing.push('state');
    if (!grid) missing.push('grid');

    if (state) {
        for (const key of RADAR_V2_REQUIRED_INPUTS.state.required3D) {
            if (!state[key]) missing.push(`state.${key}`);
        }
        for (const key of RADAR_V2_REQUIRED_INPUTS.state.required2D) {
            if (!state[key]) missing.push(`state.${key}`);
        }
        const sigmaHalf = state.sigmaHalf || core?.sigmaHalf;
        const nz = state.nz || core?.nz;
        if (!sigmaHalf) missing.push('state.sigmaHalf');
        if (!nz) missing.push('state.nz');
    }

    if (grid) {
        for (const key of RADAR_V2_REQUIRED_INPUTS.grid) {
            if (!Number.isFinite(grid[key])) missing.push(`grid.${key}`);
        }
    }

    return { ok: missing.length === 0, missing };
};
