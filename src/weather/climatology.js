const clamp01 = (v) => Math.max(0, Math.min(1, v));

const decodeGray = (r, decode) => {
  const t = r / 255;
  return decode.min + (decode.max - decode.min) * t;
};

const decodeWind = (c, maxAbs) => {
  const t = c / 255;
  return (t * 2 - 1) * maxAbs;
};

const wrapX = (x, w) => {
  if (x < 0) return x + w;
  if (x >= w) return x - w;
  return x;
};

export function sampleImageToGrid({ imageData, imgW, imgH, nx, ny, decodeFn }) {
  const out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const v = j / ny;
    const y = v * (imgH - 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(imgH - 1, y0 + 1);
    const ty = y - y0;
    for (let i = 0; i < nx; i++) {
      const u = i / nx;
      const x = u * (imgW - 1);
      const x0 = wrapX(Math.floor(x), imgW);
      const x1 = wrapX(x0 + 1, imgW);
      const tx = x - Math.floor(x);

      const idx00 = (y0 * imgW + x0) * 4;
      const idx10 = (y0 * imgW + x1) * 4;
      const idx01 = (y1 * imgW + x0) * 4;
      const idx11 = (y1 * imgW + x1) * 4;

      const v00 = decodeFn(
        imageData[idx00],
        imageData[idx00 + 1],
        imageData[idx00 + 2],
        imageData[idx00 + 3]
      );
      const v10 = decodeFn(
        imageData[idx10],
        imageData[idx10 + 1],
        imageData[idx10 + 2],
        imageData[idx10 + 3]
      );
      const v01 = decodeFn(
        imageData[idx01],
        imageData[idx01 + 1],
        imageData[idx01 + 2],
        imageData[idx01 + 3]
      );
      const v11 = decodeFn(
        imageData[idx11],
        imageData[idx11 + 1],
        imageData[idx11 + 2],
        imageData[idx11 + 3]
      );

      const v0 = v00 * (1 - tx) + v10 * tx;
      const v1 = v01 * (1 - tx) + v11 * tx;
      out[j * nx + i] = v0 * (1 - ty) + v1 * ty;
    }
  }
  return out;
}

const loadImageData = async (url) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  return { data, width: c.width, height: c.height };
};

const createFallbackClimo = ({ nx, ny, latDeg }) => {
  const sstMonths = Array.from({ length: 12 }, () => new Float32Array(nx * ny));
  const iceMonths = Array.from({ length: 12 }, () => new Float32Array(nx * ny));

  for (let j = 0; j < ny; j++) {
    const lat = latDeg[j];
    const latRad = (lat * Math.PI) / 180;
    const latNorm = Math.min(1, Math.abs(lat) / 90);
    const base = 300 - 28 * Math.pow(latNorm, 1.2) - 6 * Math.pow(Math.sin(latRad), 2);
    const amp = 2 + 6 * (1 - latNorm);
    const iceBase = clamp01((Math.abs(lat) - 60) / 25);
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      for (let m = 0; m < 12; m++) {
        const phase = (2 * Math.PI * m) / 12 + (lat >= 0 ? 0 : Math.PI);
        const seasonal = Math.cos(phase);
        const sst = Math.max(271.15, Math.min(307.15, base + amp * seasonal));
        sstMonths[m][k] = sst;
        const iceSeason = 0.5 + 0.5 * seasonal;
        iceMonths[m][k] = clamp01(iceBase * iceSeason);
      }
    }
  }

  return {
    sstMonths,
    iceMonths,
    albedo: null,
    elev: null,
    soilCap: null,
    slpMonths: null,
    windMonthsU: null,
    windMonthsV: null,
    wind500MonthsU: null,
    wind500MonthsV: null,
    wind250MonthsU: null,
    wind250MonthsV: null,
    t2mMonths: null,
    usedFallback: true
  };
};

export async function loadClimatology({ nx, ny, latDeg }) {
  if (typeof fetch === 'undefined' || typeof Image === 'undefined' || typeof document === 'undefined') {
    return createFallbackClimo({ nx, ny, latDeg });
  }

  const baseUrl = `${process.env.PUBLIC_URL || ''}/climo`;
  let manifest;
  try {
    const res = await fetch(`${baseUrl}/manifest.json`);
    if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
    manifest = await res.json();
  } catch (err) {
    return createFallbackClimo({ nx, ny, latDeg });
  }

  try {
    if (!manifest?.sst?.files || manifest.sst.files.length !== 12) {
      throw new Error('Missing SST monthly files');
    }

    const sstMonths = [];
    for (const file of manifest.sst.files) {
      const { data, width, height } = await loadImageData(`${baseUrl}/${file}`);
      sstMonths.push(
        sampleImageToGrid({
          imageData: data,
          imgW: width,
          imgH: height,
          nx,
          ny,
          decodeFn: (r) => decodeGray(r, manifest.sst.decode)
        })
      );
    }

    let iceMonths = null;
    if (manifest.seaIce?.files && manifest.seaIce.files.length === 12) {
      try {
        iceMonths = [];
        for (const file of manifest.seaIce.files) {
          const { data, width, height } = await loadImageData(`${baseUrl}/${file}`);
          iceMonths.push(
            sampleImageToGrid({
              imageData: data,
              imgW: width,
              imgH: height,
              nx,
              ny,
              decodeFn: (r) => decodeGray(r, manifest.seaIce.decode)
            })
          );
        }
      } catch (err) {
        iceMonths = null;
      }
    }

    let albedo = null;
    if (manifest.albedo?.file) {
      try {
        const { data, width, height } = await loadImageData(`${baseUrl}/${manifest.albedo.file}`);
        albedo = sampleImageToGrid({
          imageData: data,
          imgW: width,
          imgH: height,
          nx,
          ny,
          decodeFn: (r) => decodeGray(r, manifest.albedo.decode)
        });
      } catch (err) {
        albedo = null;
      }
    }

    let elev = null;
    if (manifest.topography?.file) {
      try {
        const { data, width, height } = await loadImageData(`${baseUrl}/${manifest.topography.file}`);
        elev = sampleImageToGrid({
          imageData: data,
          imgW: width,
          imgH: height,
          nx,
          ny,
          decodeFn: (r) => decodeGray(r, manifest.topography.decode)
        });
      } catch (err) {
        elev = null;
      }
    }

    let soilCap = null;
    if (manifest.soilCap?.file) {
      try {
        const { data, width, height } = await loadImageData(`${baseUrl}/${manifest.soilCap.file}`);
        soilCap = sampleImageToGrid({
          imageData: data,
          imgW: width,
          imgH: height,
          nx,
          ny,
          decodeFn: (r) => decodeGray(r, manifest.soilCap.decode)
        });
      } catch (err) {
        soilCap = null;
      }
    }

    let slpMonths = null;
    let windMonthsU = null;
    let windMonthsV = null;
    let wind500MonthsU = null;
    let wind500MonthsV = null;
    let wind250MonthsU = null;
    let wind250MonthsV = null;
    let t2mMonths = null;
    const optional = manifest.optionalNudging;
    if (optional?.slp?.files && optional.slp.files.length === 12) {
      try {
        slpMonths = [];
        for (const file of optional.slp.files) {
          const { data, width, height } = await loadImageData(`${baseUrl}/${file}`);
          slpMonths.push(
            sampleImageToGrid({
              imageData: data,
              imgW: width,
              imgH: height,
              nx,
              ny,
              decodeFn: (r) => decodeGray(r, optional.slp.decode)
            })
          );
        }
      } catch (err) {
        slpMonths = null;
      }
    }

    if (optional?.wind?.files && optional.wind.files.length === 12) {
      try {
        windMonthsU = [];
        windMonthsV = [];
        for (const file of optional.wind.files) {
          const { data, width, height } = await loadImageData(`${baseUrl}/${file}`);
          windMonthsU.push(
            sampleImageToGrid({
              imageData: data,
              imgW: width,
              imgH: height,
              nx,
              ny,
              decodeFn: (r) => decodeWind(r, optional.wind.decode.maxAbs)
            })
          );
          windMonthsV.push(
            sampleImageToGrid({
              imageData: data,
              imgW: width,
              imgH: height,
              nx,
              ny,
              decodeFn: (_, g) => decodeWind(g, optional.wind.decode.maxAbs)
            })
          );
        }
      } catch (err) {
        windMonthsU = null;
        windMonthsV = null;
      }
    }

    if (optional?.wind500?.files && optional.wind500.files.length === 12) {
      try {
        wind500MonthsU = [];
        wind500MonthsV = [];
        for (const file of optional.wind500.files) {
          const { data, width, height } = await loadImageData(`${baseUrl}/${file}`);
          wind500MonthsU.push(
            sampleImageToGrid({
              imageData: data,
              imgW: width,
              imgH: height,
              nx,
              ny,
              decodeFn: (r) => decodeWind(r, optional.wind500.decode.maxAbs)
            })
          );
          wind500MonthsV.push(
            sampleImageToGrid({
              imageData: data,
              imgW: width,
              imgH: height,
              nx,
              ny,
              decodeFn: (_, g) => decodeWind(g, optional.wind500.decode.maxAbs)
            })
          );
        }
      } catch (err) {
        wind500MonthsU = null;
        wind500MonthsV = null;
      }
    }

    if (optional?.wind250?.files && optional.wind250.files.length === 12) {
      try {
        wind250MonthsU = [];
        wind250MonthsV = [];
        for (const file of optional.wind250.files) {
          const { data, width, height } = await loadImageData(`${baseUrl}/${file}`);
          wind250MonthsU.push(
            sampleImageToGrid({
              imageData: data,
              imgW: width,
              imgH: height,
              nx,
              ny,
              decodeFn: (r) => decodeWind(r, optional.wind250.decode.maxAbs)
            })
          );
          wind250MonthsV.push(
            sampleImageToGrid({
              imageData: data,
              imgW: width,
              imgH: height,
              nx,
              ny,
              decodeFn: (_, g) => decodeWind(g, optional.wind250.decode.maxAbs)
            })
          );
        }
      } catch (err) {
        wind250MonthsU = null;
        wind250MonthsV = null;
      }
    }

    if (optional?.t2m?.files && optional.t2m.files.length === 12) {
      try {
        t2mMonths = [];
        for (const file of optional.t2m.files) {
          const { data, width, height } = await loadImageData(`${baseUrl}/${file}`);
          t2mMonths.push(
            sampleImageToGrid({
              imageData: data,
              imgW: width,
              imgH: height,
              nx,
              ny,
              decodeFn: (r) => decodeGray(r, optional.t2m.decode)
            })
          );
        }
      } catch (err) {
        t2mMonths = null;
      }
    }

    return {
      sstMonths,
      iceMonths,
      albedo,
      elev,
      soilCap,
      slpMonths,
      windMonthsU,
      windMonthsV,
      wind500MonthsU,
      wind500MonthsV,
      wind250MonthsU,
      wind250MonthsV,
      t2mMonths,
      usedFallback: false
    };
  } catch (err) {
    return createFallbackClimo({ nx, ny, latDeg });
  }
}
