// grid.js: lat/lon grid utilities and metric terms

export function createLatLonGrid(nx = 360, ny = 180) {
  const count = nx * ny;
  const latDeg = new Float32Array(ny);
  const lonDeg = new Float32Array(nx);
  const cosLat = new Float32Array(ny);
  const sinLat = new Float32Array(ny);
  const cellLonDeg = 360 / nx;
  const cellLatDeg = 180 / ny;
  for (let j = 0; j < ny; j++) {
    const lat = 90 - (j + 0.5) * cellLatDeg;
    latDeg[j] = lat;
    cosLat[j] = Math.max(1e-4, Math.cos((lat * Math.PI) / 180));
    sinLat[j] = Math.sin((lat * Math.PI) / 180);
  }
  for (let i = 0; i < nx; i++) {
    lonDeg[i] = -180 + (i + 0.5) * cellLonDeg;
  }
  return { nx, ny, count, latDeg, lonDeg, cosLat, sinLat, cellLonDeg, cellLatDeg };
}

export function idx(j, i, nx) {
  return j * nx + i;
}

export function wrapLon(i, nx) {
  if (i < 0) return i + nx;
  if (i >= nx) return i - nx;
  return i;
}

export function clampLat(j, ny) {
  if (j < 0) return 0;
  if (j >= ny) return ny - 1;
  return j;
}

export function metricTerms(grid) {
  // Returns km per deg lon, deg lat at a given j
  const kmPerDegLat = 111.0;
  return (j) => ({
    kmPerDegLat,
    kmPerDegLon: kmPerDegLat * grid.cosLat[j]
  });
}

