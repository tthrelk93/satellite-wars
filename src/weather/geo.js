// geo.js: geographic inputs (land, elevation, albedo, soil moisture, roughness)
import earthmap from '../8081_earthmap10k.jpg';

export async function loadGeoTexture(nx, ny) {
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = earthmap;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;

  const landMask = new Uint8Array(nx * ny);
  const elev = new Float32Array(nx * ny);
  const albedo = new Float32Array(nx * ny);
  const soilM = new Float32Array(nx * ny);
  const rough = new Float32Array(nx * ny);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const u = i / nx;
      const v = j / ny;
      const px = Math.floor(u * (c.width - 1));
      const py = Math.floor(v * (c.height - 1));
      const idx = (py * c.width + px) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      const land = b < 0.55 || g > 0.4;
      const k = j * nx + i;
      landMask[k] = land ? 1 : 0;
      elev[k] = land ? Math.max(0, (r + g) * 0.5 - 0.25) * 3000 : 0;
      albedo[k] = land ? (0.15 + 0.15 * (1 - g)) : 0.06;
      soilM[k] = land ? Math.min(1, 0.4 + 0.6 * g) : 1.0;
      rough[k] = land ? 0.1 : 0.01;
    }
  }

  return { landMask, elev, albedo, soilM, rough };
}

// Fallback simple analytic geo if texture unavailable
export function analyticGeo(nx, ny, latDegArr) {
  const landMask = new Uint8Array(nx * ny);
  const elev = new Float32Array(nx * ny);
  const albedo = new Float32Array(nx * ny);
  const soilM = new Float32Array(nx * ny);
  const rough = new Float32Array(nx * ny);

  for (let j = 0; j < ny; j++) {
    const lat = latDegArr[j];
    const latNorm = Math.abs(lat) / 90;
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const land = Math.random() > 0.6; // crude split
      landMask[k] = land ? 1 : 0;
      elev[k] = land ? Math.max(0, (Math.random() - 0.3)) * 2000 : 0;
      albedo[k] = land ? 0.2 + 0.1 * latNorm : 0.06;
      soilM[k] = land ? 0.35 + 0.3 * (1 - latNorm) : 1.0;
      rough[k] = land ? 0.1 : 0.01;
    }
  }
  return { landMask, elev, albedo, soilM, rough };
}

