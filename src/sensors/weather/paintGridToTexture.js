import * as THREE from 'three';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const paintGridToTexture = ({
  nx,
  ny,
  values,
  mask,
  textureCache = {},
  options = {}
} = {}) => {
  if (!nx || !ny || !values || values.length !== nx * ny) return null;
  const scale = options.scale ?? 2;
  const width = nx * scale;
  const height = ny * scale;
  const valueMin = options.valueMin ?? 0;
  const valueMax = options.valueMax ?? 10;
  const alphaScale = options.alphaScale ?? 0.7;
  const alphaByValue = options.alphaByValue !== false;
  const colorMap = typeof options.colorMap === 'function' ? options.colorMap : null;
  const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

  let cache = textureCache && typeof textureCache === 'object' ? textureCache : {};
  if (!cache.canvas || cache.width !== width || cache.height !== height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    cache = {
      canvas,
      ctx,
      imageData,
      texture,
      width,
      height
    };
  }

  const { ctx, imageData } = cache;
  const data = imageData.data;
  const denom = Math.max(1e-6, valueMax - valueMin);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const raw = values[k];
      const t = clamp01((raw - valueMin) / denom);
      const val = Math.round(255 * t);
      let r = val;
      let g = val;
      let b = val;
      if (colorMap) {
        const mapped = colorMap(t, raw);
        if (Array.isArray(mapped) && mapped.length >= 3) {
          r = clampByte(mapped[0]);
          g = clampByte(mapped[1]);
          b = clampByte(mapped[2]);
        } else if (mapped && typeof mapped === 'object') {
          r = clampByte(mapped.r);
          g = clampByte(mapped.g);
          b = clampByte(mapped.b);
        }
      }
      const m = mask ? clamp01(mask[k]) : 1;
      const alphaFactor = alphaByValue ? t : 1;
      const alpha = Math.round(255 * alphaScale * m * alphaFactor);

      for (let sy = 0; sy < scale; sy++) {
        const y = j * scale + sy;
        for (let sx = 0; sx < scale; sx++) {
          const x = i * scale + sx;
          const idx = (y * width + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = alpha;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  cache.texture.needsUpdate = true;
  return { texture: cache.texture, cache };
};
