export const bilinear = (field, lon, lat, nx, ny) => {
  const lonWrapped = ((lon % nx) + nx) % nx;
  const latClamped = Math.max(0, Math.min(ny - 1, lat));
  const i0 = Math.floor(lonWrapped);
  const j0 = Math.floor(latClamped);
  const i1 = (i0 + 1) % nx;
  const j1 = Math.min(ny - 1, j0 + 1);
  const fi = lonWrapped - i0;
  const fj = latClamped - j0;

  const k00 = j0 * nx + i0;
  const k10 = j0 * nx + i1;
  const k01 = j1 * nx + i0;
  const k11 = j1 * nx + i1;

  const vTop = field[k00] * (1 - fi) + field[k10] * fi;
  const vBot = field[k01] * (1 - fi) + field[k11] * fi;
  return vTop * (1 - fj) + vBot * fj;
};
