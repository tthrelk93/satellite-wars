import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  setImageLoader,
  setManifestLoader,
  resetClimatologyLoaders
} from '../../src/weather/climatology.js';

const inflateAsync = promisify(zlib.inflate);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const publicRoot = path.join(repoRoot, 'public');

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const readU32BE = (buf, offset) =>
  buf[offset] * 0x1000000 + ((buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]);

const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const paethPredictor = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
};

const unfilterScanlines = (raw, width, height, bytesPerPixel) => {
  const rowBytes = width * bytesPerPixel;
  const out = new Uint8Array(rowBytes * height);
  let rawOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    const dstStart = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const rawByte = raw[rawOffset + x];
      const left = x >= bytesPerPixel ? out[dstStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? out[dstStart - rowBytes + x] : 0;
      const upLeft = x >= bytesPerPixel && y > 0 ? out[dstStart - rowBytes + x - bytesPerPixel] : 0;
      let reconstructed;
      switch (filterType) {
        case 0:
          reconstructed = rawByte;
          break;
        case 1:
          reconstructed = (rawByte + left) & 0xff;
          break;
        case 2:
          reconstructed = (rawByte + up) & 0xff;
          break;
        case 3:
          reconstructed = (rawByte + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          reconstructed = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type ${filterType}`);
      }
      out[dstStart + x] = reconstructed;
    }
    rawOffset += rowBytes;
  }
  return out;
};

const expandToRgba = (pixels, width, height, colorType, palette, trns) => {
  const N = width * height;
  const rgba = new Uint8ClampedArray(N * 4);
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  for (let i = 0; i < N; i += 1) {
    const src = i * channels;
    const dst = i * 4;
    if (colorType === 0) {
      const g = pixels[src];
      rgba[dst] = g;
      rgba[dst + 1] = g;
      rgba[dst + 2] = g;
      rgba[dst + 3] = 255;
    } else if (colorType === 2) {
      rgba[dst] = pixels[src];
      rgba[dst + 1] = pixels[src + 1];
      rgba[dst + 2] = pixels[src + 2];
      rgba[dst + 3] = 255;
    } else if (colorType === 3) {
      const idx = pixels[src];
      const paletteOffset = idx * 3;
      rgba[dst] = palette?.[paletteOffset] ?? 0;
      rgba[dst + 1] = palette?.[paletteOffset + 1] ?? 0;
      rgba[dst + 2] = palette?.[paletteOffset + 2] ?? 0;
      rgba[dst + 3] = trns ? trns[idx] ?? 255 : 255;
    } else if (colorType === 4) {
      const g = pixels[src];
      rgba[dst] = g;
      rgba[dst + 1] = g;
      rgba[dst + 2] = g;
      rgba[dst + 3] = pixels[src + 1];
    } else if (colorType === 6) {
      rgba[dst] = pixels[src];
      rgba[dst + 1] = pixels[src + 1];
      rgba[dst + 2] = pixels[src + 2];
      rgba[dst + 3] = pixels[src + 3];
    } else {
      throw new Error(`Unsupported PNG color type ${colorType}`);
    }
  }
  return rgba;
};

const decodePngBuffer = async (buffer) => {
  for (let i = 0; i < 8; i += 1) {
    if (buffer[i] !== PNG_SIGNATURE[i]) throw new Error('Invalid PNG signature');
  }
  let offset = 8;
  let ihdr = null;
  const idatParts = [];
  let palette = null;
  let trns = null;
  while (offset < buffer.length) {
    const length = readU32BE(buffer, offset);
    const type = String.fromCharCode(buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7]);
    const dataStart = offset + 8;
    const data = buffer.subarray(dataStart, dataStart + length);
    offset = dataStart + length + 4;
    if (type === 'IHDR') {
      ihdr = {
        width: readU32BE(data, 0),
        height: readU32BE(data, 4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12]
      };
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'PLTE') {
      palette = Uint8Array.from(data);
    } else if (type === 'tRNS') {
      trns = Uint8Array.from(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (!ihdr) throw new Error('PNG missing IHDR');
  if (ihdr.interlace !== 0) throw new Error('Interlaced PNGs are not supported');
  if (ihdr.bitDepth !== 8) throw new Error(`Only 8-bit PNGs supported (got ${ihdr.bitDepth})`);
  const channels = CHANNELS_BY_COLOR_TYPE[ihdr.colorType];
  if (!channels) throw new Error(`Unsupported PNG color type ${ihdr.colorType}`);

  let totalIdat = 0;
  for (const part of idatParts) totalIdat += part.length;
  const combined = Buffer.allocUnsafe(totalIdat);
  let cursor = 0;
  for (const part of idatParts) {
    combined.set(part, cursor);
    cursor += part.length;
  }
  const raw = await inflateAsync(combined);
  const unfiltered = unfilterScanlines(raw, ihdr.width, ihdr.height, channels);
  const rgba = expandToRgba(unfiltered, ihdr.width, ihdr.height, ihdr.colorType, palette, trns);
  return { data: rgba, width: ihdr.width, height: ihdr.height };
};

const urlToFsPath = (url) => {
  const stripped = url.replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, '');
  if (stripped.startsWith('public/')) return path.join(repoRoot, stripped);
  return path.join(publicRoot, stripped);
};

const nodeLoadImageData = async (url) => {
  const absPath = urlToFsPath(url);
  const buffer = await fs.readFile(absPath);
  return decodePngBuffer(buffer);
};

const nodeLoadManifest = async (baseUrl) => {
  const absPath = urlToFsPath(`${baseUrl}/manifest.json`);
  const text = await fs.readFile(absPath, 'utf8');
  return JSON.parse(text);
};

export const installNodeClimoLoader = () => {
  setImageLoader(nodeLoadImageData);
  setManifestLoader(nodeLoadManifest);
};

export const uninstallNodeClimoLoader = () => {
  resetClimatologyLoaders();
};

export const _decodePngBufferForTest = decodePngBuffer;
