export const WEATHER_KERNEL_CONTRACT_VERSION = 'weather-kernel.v1';
export const WEATHER_KERNEL_GRID_FIELDS_SCHEMA = 'satellite-wars.weather-kernel.grid-fields.v1';
export const WEATHER_KERNEL_DIAGNOSTICS_SCHEMA = 'satellite-wars.weather-kernel.diagnostics.v1';
export const WEATHER_KERNEL_EVENT_SEED_SCHEMA = 'satellite-wars.weather-kernel.event-seed.v1';
export const WEATHER_KERNEL_EVENT_PRODUCT_SCHEMA = 'satellite-wars.weather-events.v1';
export const WEATHER_KERNEL_LOCAL_DOWNSCALE_SCHEMA = 'satellite-wars.local-downscale.v1';
export const WEATHER_KERNEL_SNAPSHOT_SCHEMA = 'satellite-wars.weather-kernel.snapshot.v1';
export const WEATHER_KERNEL_REPLAY_SCHEMA = 'satellite-wars.weather-kernel.replay.v1';

export const WEATHER_KERNEL_PUBLIC_FIELD_KEYS = Object.freeze([
  'ps',
  'Ts',
  'u',
  'v',
  'uU',
  'vU',
  'cloud',
  'cloudLow',
  'cloudHigh',
  'precipRate',
  'sstNow',
  'seaIceFrac',
  'seaIceThicknessM',
  'tauLow',
  'tauHigh',
  'h850',
  'h700',
  'h500',
  'h250'
]);

export const WEATHER_KERNEL_DEFAULT_CONFIG = Object.freeze({
  nx: 180,
  ny: 90,
  dt: 120,
  nz: 26,
  instrumentationMode: 'full',
  maxInternalDt: 900
});

const normalizePositiveInteger = (value, fallback, min = 1) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

const normalizePositiveNumber = (value, fallback, min = 1e-9) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

export function normalizeWeatherKernelConfig(config = {}) {
  const nx = normalizePositiveInteger(config.nx, WEATHER_KERNEL_DEFAULT_CONFIG.nx, 4);
  const ny = normalizePositiveInteger(config.ny, WEATHER_KERNEL_DEFAULT_CONFIG.ny, 2);
  const dt = normalizePositiveNumber(config.dt, WEATHER_KERNEL_DEFAULT_CONFIG.dt, 1);
  const nz = normalizePositiveInteger(config.nz, WEATHER_KERNEL_DEFAULT_CONFIG.nz, 5);
  const maxInternalDt = normalizePositiveNumber(
    config.maxInternalDt,
    Math.min(dt, WEATHER_KERNEL_DEFAULT_CONFIG.maxInternalDt),
    1
  );
  const instrumentationMode = config.instrumentationMode === 'disabled'
    ? 'disabled'
    : config.instrumentationMode === 'noop'
      ? 'noop'
      : WEATHER_KERNEL_DEFAULT_CONFIG.instrumentationMode;

  const normalized = {
    nx,
    ny,
    dt,
    nz,
    instrumentationMode,
    maxInternalDt: Math.min(dt, maxInternalDt)
  };

  if (Number.isFinite(config.seed)) normalized.seed = Number(config.seed);
  if (config.sigmaHalf instanceof Float32Array) normalized.sigmaHalf = new Float32Array(config.sigmaHalf);
  else if (Array.isArray(config.sigmaHalf)) normalized.sigmaHalf = Float32Array.from(config.sigmaHalf);
  if (Array.isArray(config.pressureLevelsPa) || config.pressureLevelsPa instanceof Float32Array) {
    normalized.pressureLevelsPa = Array.from(config.pressureLevelsPa, Number).filter(Number.isFinite);
  }

  return normalized;
}

export function createWeatherKernelManifest(config = {}) {
  const normalized = normalizeWeatherKernelConfig(config);
  return {
    schema: 'satellite-wars.weather-kernel.manifest.v1',
    contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
    implementation: 'WeatherCore5.js',
    config: {
      nx: normalized.nx,
      ny: normalized.ny,
      dt: normalized.dt,
      nz: normalized.nz,
      seed: Number.isFinite(normalized.seed) ? normalized.seed : null,
      instrumentationMode: normalized.instrumentationMode,
      maxInternalDt: normalized.maxInternalDt
    }
  };
}

export function assertWeatherKernelSnapshot(snapshot, { requireFullState = false } = {}) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Weather kernel snapshot must be an object.');
  }
  if (!Number.isFinite(snapshot.timeUTC)) {
    throw new Error('Weather kernel snapshot is missing finite timeUTC.');
  }
  if (!snapshot.grid || !Number.isFinite(snapshot.grid.nx) || !Number.isFinite(snapshot.grid.ny)) {
    throw new Error('Weather kernel snapshot is missing grid dimensions.');
  }
  if (!snapshot.vertical || !Number.isFinite(snapshot.vertical.nz)) {
    throw new Error('Weather kernel snapshot is missing vertical layout metadata.');
  }
  if (!snapshot.fields || typeof snapshot.fields !== 'object') {
    throw new Error('Weather kernel snapshot is missing public fields.');
  }
  for (const key of WEATHER_KERNEL_PUBLIC_FIELD_KEYS) {
    if (!(key in snapshot.fields)) {
      throw new Error(`Weather kernel snapshot is missing public field ${key}.`);
    }
  }
  if (requireFullState && (!snapshot.state || typeof snapshot.state !== 'object')) {
    throw new Error('Weather kernel full replay requires a full state snapshot.');
  }
  return snapshot;
}

export function createWeatherKernelGridFields(snapshot) {
  assertWeatherKernelSnapshot(snapshot);
  return {
    schema: WEATHER_KERNEL_GRID_FIELDS_SCHEMA,
    contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
    manifest: snapshot.manifest || null,
    timeUTC: snapshot.timeUTC,
    grid: snapshot.grid,
    vertical: snapshot.vertical,
    fields: snapshot.fields
  };
}

export function createWeatherKernelDiagnostics(snapshot, diagnostics = snapshot?.diagnosticState || null) {
  assertWeatherKernelSnapshot(snapshot);
  return {
    schema: WEATHER_KERNEL_DIAGNOSTICS_SCHEMA,
    contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
    manifest: snapshot.manifest || null,
    timeUTC: snapshot.timeUTC,
    diagnostics: diagnostics && typeof diagnostics === 'object' ? diagnostics : null
  };
}

export function createWeatherKernelEventSeed({
  id,
  type,
  timeUTC,
  seed,
  sourceSnapshotDigest = null,
  basin = null,
  region = null,
  parentEventId = null,
  environment = null
} = {}) {
  const eventType = typeof type === 'string' && type.trim() ? type.trim() : 'weather-event';
  const eventId = typeof id === 'string' && id.trim()
    ? id.trim()
    : `${eventType}:${Number.isFinite(timeUTC) ? Math.round(timeUTC) : 0}:${Number.isFinite(seed) ? Math.round(seed) : 0}`;
  return {
    schema: WEATHER_KERNEL_EVENT_SEED_SCHEMA,
    contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
    id: eventId,
    type: eventType,
    timeUTC: Number.isFinite(timeUTC) ? Number(timeUTC) : 0,
    seed: Number.isFinite(seed) ? Number(seed) : 0,
    sourceSnapshotDigest: typeof sourceSnapshotDigest === 'string' ? sourceSnapshotDigest : null,
    basin: typeof basin === 'string' ? basin : null,
    region: typeof region === 'string' ? region : null,
    parentEventId: typeof parentEventId === 'string' ? parentEventId : null,
    environment: environment && typeof environment === 'object' ? { ...environment } : null
  };
}

export function assertWeatherKernelEventSeed(eventSeed) {
  if (!eventSeed || typeof eventSeed !== 'object') {
    throw new Error('Weather kernel event seed must be an object.');
  }
  if (eventSeed.schema !== WEATHER_KERNEL_EVENT_SEED_SCHEMA) {
    throw new Error(`Weather kernel event seed must use schema ${WEATHER_KERNEL_EVENT_SEED_SCHEMA}.`);
  }
  if (eventSeed.contractVersion !== WEATHER_KERNEL_CONTRACT_VERSION) {
    throw new Error(`Weather kernel event seed must use contract ${WEATHER_KERNEL_CONTRACT_VERSION}.`);
  }
  if (typeof eventSeed.id !== 'string' || !eventSeed.id) {
    throw new Error('Weather kernel event seed is missing id.');
  }
  if (typeof eventSeed.type !== 'string' || !eventSeed.type) {
    throw new Error('Weather kernel event seed is missing type.');
  }
  if (!Number.isFinite(eventSeed.timeUTC) || !Number.isFinite(eventSeed.seed)) {
    throw new Error('Weather kernel event seed requires finite timeUTC and seed.');
  }
  return eventSeed;
}

const isTransferableArray = (value) => ArrayBuffer.isView(value) && !(value instanceof DataView);

export function collectWeatherKernelTransferBuffers(value, buffers = []) {
  if (!value || typeof value !== 'object') return buffers;
  if (isTransferableArray(value)) {
    buffers.push(value.buffer);
    return buffers;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectWeatherKernelTransferBuffers(item, buffers));
    return buffers;
  }
  Object.values(value).forEach((item) => collectWeatherKernelTransferBuffers(item, buffers));
  return buffers;
}
