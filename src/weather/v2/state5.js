const makeArray = (size, value = 0) => {
  const arr = new Float32Array(size);
  if (value !== 0) arr.fill(value);
  return arr;
};

export function createState5({ grid, nz = 5, sigmaHalf } = {}) {
  const N = grid.count;
  const SZ = N * nz;

  const u = makeArray(SZ);
  const v = makeArray(SZ);
  const theta = makeArray(SZ, 290);
  const qv = makeArray(SZ);
  const qc = makeArray(SZ);
  const qi = makeArray(SZ);
  const qr = makeArray(SZ);

  const ps = makeArray(N, 101325);
  const dpsDtRaw = makeArray(N);
  const dpsDtApplied = makeArray(N);
  const Ts = makeArray(N, 288);
  const soilW = makeArray(N);
  const precipAccum = makeArray(N);
  const precipRate = makeArray(N);
  const sstNow = makeArray(N, 300);
  const soilCap = makeArray(N);
  const landMask = new Uint8Array(N);

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
    ps,
    dpsDtRaw,
    dpsDtApplied,
    Ts,
    soilW,
    precipAccum,
    precipRate,
    landMask,
    soilCap,
    sstNow,
    pHalf,
    pMid,
    phiHalf,
    phiMid,
    omega,
    Tv,
    T
  };
}
