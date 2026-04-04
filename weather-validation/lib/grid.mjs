export const toRadians = (deg) => (deg * Math.PI) / 180;

export function normalizeGrid(grid) {
  if (!grid || typeof grid !== 'object') {
    throw new Error('Grid definition is required.');
  }

  const latitudesDeg = Array.isArray(grid.latitudesDeg)
    ? grid.latitudesDeg.slice()
    : Array.isArray(grid.latitudes)
      ? grid.latitudes.slice()
      : null;
  const longitudesDeg = Array.isArray(grid.longitudesDeg)
    ? grid.longitudesDeg.slice()
    : Array.isArray(grid.longitudes)
      ? grid.longitudes.slice()
      : null;

  if (!latitudesDeg?.length || !longitudesDeg?.length) {
    throw new Error('Grid must define latitudesDeg/latitudes and longitudesDeg/longitudes arrays.');
  }

  const nx = Number.isFinite(grid.nx) ? grid.nx : longitudesDeg.length;
  const ny = Number.isFinite(grid.ny) ? grid.ny : latitudesDeg.length;
  if (nx !== longitudesDeg.length || ny !== latitudesDeg.length) {
    throw new Error(`Grid dimension mismatch: nx=${nx} longitudes=${longitudesDeg.length}, ny=${ny} latitudes=${latitudesDeg.length}`);
  }

  return {
    nx,
    ny,
    count: nx * ny,
    latitudesDeg,
    longitudesDeg
  };
}

export function buildAreaWeights(grid) {
  const out = new Float64Array(grid.count);
  for (let j = 0; j < grid.ny; j += 1) {
    const weight = Math.max(1e-6, Math.cos(toRadians(grid.latitudesDeg[j])));
    const rowOffset = j * grid.nx;
    for (let i = 0; i < grid.nx; i += 1) {
      out[rowOffset + i] = weight;
    }
  }
  return out;
}

export function assertFieldLength(field, grid, label) {
  if (!Array.isArray(field)) {
    throw new Error(`${label} must be an array.`);
  }
  if (field.length !== grid.count) {
    throw new Error(`${label} length ${field.length} does not match grid cell count ${grid.count}.`);
  }
}

export function fieldIndex(grid, i, j) {
  return j * grid.nx + i;
}
