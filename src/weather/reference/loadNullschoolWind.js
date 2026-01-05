export async function loadNullschoolWind(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load wind reference: ${res.status}`);
  }
  const json = await res.json();
  if (!Array.isArray(json) || json.length < 2) {
    throw new Error('Invalid wind reference format');
  }
  const [uRec, vRec] = json;
  const uHeader = uRec?.header;
  const vHeader = vRec?.header;
  if (!uHeader || !vHeader) {
    throw new Error('Missing wind header');
  }
  const required = ['nx', 'ny', 'dx', 'dy', 'la1', 'lo1'];
  for (const key of required) {
    if (!Number.isFinite(uHeader[key]) || !Number.isFinite(vHeader[key])) {
      throw new Error(`Missing wind header field: ${key}`);
    }
    if (uHeader[key] !== vHeader[key]) {
      throw new Error(`Wind header mismatch: ${key}`);
    }
  }
  const nx = uHeader.nx;
  const ny = uHeader.ny;
  const dx = uHeader.dx;
  const dy = uHeader.dy;
  const la1 = uHeader.la1;
  const lo1 = uHeader.lo1;
  if (nx !== 360 || ny !== 181 || dx !== 1 || dy !== 1 || la1 !== 90 || lo1 !== 0) {
    throw new Error('Unexpected wind grid header');
  }
  const uData = uRec?.data;
  const vData = vRec?.data;
  const count = nx * ny;
  if (!Array.isArray(uData) || !Array.isArray(vData) || uData.length !== count || vData.length !== count) {
    throw new Error('Unexpected wind data length');
  }
  const u = new Float32Array(count);
  const v = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    u[i] = uData[i];
    v[i] = vData[i];
  }
  const latDeg = new Float32Array(ny);
  const cosLat = new Float32Array(ny);
  for (let j = 0; j < ny; j++) {
    const lat = la1 - j * dy;
    latDeg[j] = lat;
    cosLat[j] = Math.cos(lat * Math.PI / 180);
  }
  const grid = {
    nx,
    ny,
    count,
    cellLonDeg: dx,
    cellLatDeg: dy,
    kmPerDegLat: 111,
    latDeg,
    cosLat
  };
  const meta = { uHeader, vHeader };
  return { grid, u, v, meta };
}
