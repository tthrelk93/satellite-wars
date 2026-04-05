const makeArray = (size, value = 0) => {
  const arr = new Float32Array(size);
  if (value !== 0) arr.fill(value);
  return arr;
};

export function createState5({ grid, nz = 26, sigmaHalf } = {}) {
  const N = grid.count;
  const SZ = N * nz;

  const u = makeArray(SZ);
  const v = makeArray(SZ);
  const theta = makeArray(SZ, 290);
  const qv = makeArray(SZ);
  const qc = makeArray(SZ);
  const qi = makeArray(SZ);
  const qr = makeArray(SZ);
  const qs = makeArray(SZ);
  const cloudFrac3D = makeArray(SZ);
  const cloudTau3D = makeArray(SZ);

  const ps = makeArray(N, 101325);
  const dpsDtRaw = makeArray(N);
  const dpsDtApplied = makeArray(N);
  const Ts = makeArray(N, 288);
  const soilW = makeArray(N);
  const precipAccum = makeArray(N);
  const precipRate = makeArray(N);
  const precipRainRate = makeArray(N);
  const precipSnowRate = makeArray(N);
  const sstNow = makeArray(N, 300);
  const seaIceFrac = makeArray(N);
  const seaIceThicknessM = makeArray(N);
  const surfaceRadiativeFlux = makeArray(N);
  const soilCap = makeArray(N);
  const landMask = new Uint8Array(N);
  const analysisIauPs = makeArray(N);
  const analysisIauTs = makeArray(N);
  const analysisIauU = makeArray(SZ);
  const analysisIauV = makeArray(SZ);
  const analysisIauTheta = makeArray(SZ);
  const analysisIauQv = makeArray(SZ);

  const pHalf = makeArray((nz + 1) * N);
  const pMid = makeArray(nz * N);
  const phiHalf = makeArray((nz + 1) * N);
  const phiMid = makeArray(nz * N);
  const omega = makeArray((nz + 1) * N);
  const Tv = makeArray(SZ);
  const T = makeArray(SZ, 280);

  return {
    N,
    nz,
    SZ,
    sigmaHalf,
    u,
    v,
    theta,
    qv,
    qc,
    qi,
    qr,
    qs,
    cloudFrac3D,
    cloudTau3D,
    ps,
    dpsDtRaw,
    dpsDtApplied,
    Ts,
    soilW,
    precipAccum,
    precipRate,
    precipRainRate,
    precipSnowRate,
    landMask,
    soilCap,
    analysisIauPs,
    analysisIauTs,
    analysisIauU,
    analysisIauV,
    analysisIauTheta,
    analysisIauQv,
    sstNow,
    seaIceFrac,
    seaIceThicknessM,
    surfaceRadiativeFlux,
    pHalf,
    pMid,
    phiHalf,
    phiMid,
    omega,
    Tv,
    T
  };
}
