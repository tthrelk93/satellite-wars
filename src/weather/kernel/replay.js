import { createWeatherKernel } from './index.js';
import {
  WEATHER_KERNEL_REPLAY_SCHEMA,
  assertWeatherKernelSnapshot,
  createWeatherKernelManifest
} from './contracts.js';

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

const updateHashByte = (hash, byte) => Math.imul(hash ^ byte, FNV_PRIME) >>> 0;

const updateHashString = (hash, value) => {
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = updateHashByte(hash, text.charCodeAt(i) & 0xff);
    hash = updateHashByte(hash, (text.charCodeAt(i) >>> 8) & 0xff);
  }
  return updateHashByte(hash, 0);
};

const updateHashTypedArray = (hash, value) => {
  hash = updateHashString(hash, value.constructor?.name || 'TypedArray');
  hash = updateHashString(hash, value.length);
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  for (let i = 0; i < bytes.length; i += 1) {
    hash = updateHashByte(hash, bytes[i]);
  }
  return hash;
};

const updateHashValue = (hash, value) => {
  if (value == null) return updateHashString(hash, value);
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return updateHashTypedArray(hash, value);
  }
  if (Array.isArray(value)) {
    hash = updateHashString(hash, `array:${value.length}`);
    for (const item of value) hash = updateHashValue(hash, item);
    return hash;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    hash = updateHashString(hash, `object:${keys.length}`);
    for (const key of keys) {
      hash = updateHashString(hash, key);
      hash = updateHashValue(hash, value[key]);
    }
    return hash;
  }
  if (typeof value === 'number') {
    return updateHashString(hash, Number.isFinite(value) ? value.toPrecision(15) : value);
  }
  return updateHashString(hash, value);
};

export function digestWeatherKernelSnapshot(snapshot) {
  assertWeatherKernelSnapshot(snapshot);
  const hash = updateHashValue(FNV_OFFSET, snapshot);
  return hash.toString(16).padStart(8, '0');
}

export async function runWeatherKernelReplay({
  config,
  steps = 1,
  stepSeconds,
  snapshotMode = 'compact'
} = {}) {
  const kernel = createWeatherKernel(config);
  await kernel.whenReady();
  const count = Math.max(0, Math.floor(Number(steps) || 0));
  const seconds = Number.isFinite(stepSeconds) && stepSeconds > 0
    ? stepSeconds
    : kernel.config.dt;
  for (let i = 0; i < count; i += 1) {
    kernel.advanceModelSeconds(seconds);
  }
  const snapshot = kernel.getSnapshot({ mode: snapshotMode });
  return {
    schema: WEATHER_KERNEL_REPLAY_SCHEMA,
    manifest: createWeatherKernelManifest(kernel.config),
    steps: count,
    stepSeconds: seconds,
    snapshotMode,
    digest: digestWeatherKernelSnapshot(snapshot),
    snapshot
  };
}
