const TWO_PI = Math.PI * 2;

export const hash01 = (n) => {
  const x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
};

export const hashSigned = (n) => hash01(n) * 2 - 1;

export const gaussian01 = (n) => {
  const u1 = Math.max(1e-12, hash01(n + 0.17));
  const u2 = hash01(n + 0.73);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TWO_PI * u2);
};

export const hashStringToInt = (str) => {
  let h = 0;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
};

export const makeSampleSeed = ({ worldSeed = 0, sensorId = '', tQuant = 0, index = 0, extra = 0 } = {}) => {
  const seed = Number.isFinite(worldSeed) ? worldSeed : 0;
  const sid = hashStringToInt(sensorId);
  const t = Number.isFinite(tQuant) ? Math.floor(tQuant) : 0;
  const i = Number.isFinite(index) ? Math.floor(index) : 0;
  const e = Number.isFinite(extra) ? Math.floor(extra) : 0;
  return (seed ^ (sid * 374761393) ^ (t * 668265263) ^ (i * 982451653) ^ (e * 1597334677)) | 0;
};
