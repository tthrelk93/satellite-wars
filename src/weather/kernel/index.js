import { WeatherCore5 } from '../v2/core5.js';
import {
  WEATHER_KERNEL_CONTRACT_VERSION,
  WEATHER_KERNEL_SNAPSHOT_SCHEMA,
  assertWeatherKernelSnapshot,
  collectWeatherKernelTransferBuffers,
  createWeatherKernelDiagnostics,
  createWeatherKernelGridFields,
  createWeatherKernelManifest,
  normalizeWeatherKernelConfig
} from './contracts.js';

export {
  WEATHER_KERNEL_CONTRACT_VERSION,
  WEATHER_KERNEL_DIAGNOSTICS_SCHEMA,
  WEATHER_KERNEL_EVENT_SEED_SCHEMA,
  WEATHER_KERNEL_GRID_FIELDS_SCHEMA,
  WEATHER_KERNEL_PUBLIC_FIELD_KEYS,
  WEATHER_KERNEL_REPLAY_SCHEMA,
  WEATHER_KERNEL_SNAPSHOT_SCHEMA,
  assertWeatherKernelEventSeed,
  assertWeatherKernelSnapshot,
  collectWeatherKernelTransferBuffers,
  createWeatherKernelDiagnostics,
  createWeatherKernelEventSeed,
  createWeatherKernelGridFields,
  createWeatherKernelManifest,
  normalizeWeatherKernelConfig
} from './contracts.js';

export class WeatherKernelRuntime {
  constructor(config = {}) {
    this.config = normalizeWeatherKernelConfig(config);
    this.manifest = createWeatherKernelManifest(this.config);
    this.contractVersion = WEATHER_KERNEL_CONTRACT_VERSION;
    this.core = new WeatherCore5(this.config);
    this.ready = this.core._initPromise;
  }

  async whenReady() {
    await this.ready;
    return this;
  }

  setLogger(logger) {
    this.core.setLogger?.(logger);
  }

  setLoggerContext(context) {
    this.core.setLoggerContext?.(context);
  }

  setSimSpeed(simSpeed) {
    this.core.setSimSpeed?.(simSpeed);
  }

  setTimeUTC(seconds) {
    this.core.setTimeUTC?.(seconds);
  }

  setV2ConvectionEnabled(enabled) {
    this.core.setV2ConvectionEnabled?.(Boolean(enabled));
  }

  advanceModelSeconds(modelSeconds) {
    return this.core.advanceModelSeconds(modelSeconds);
  }

  getSnapshot(options = {}) {
    const snapshot = this.core.getStateSnapshot(options);
    const wrapped = {
      ...snapshot,
      schema: WEATHER_KERNEL_SNAPSHOT_SCHEMA,
      contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
      manifest: this.manifest
    };
    return assertWeatherKernelSnapshot(wrapped, { requireFullState: options.mode === 'full' });
  }

  getGridFields(options = {}) {
    return createWeatherKernelGridFields(this.getSnapshot(options));
  }

  getDiagnostics(options = {}) {
    const snapshot = this.getSnapshot(options);
    return createWeatherKernelDiagnostics(snapshot);
  }

  loadSnapshot(snapshot) {
    assertWeatherKernelSnapshot(snapshot, { requireFullState: true });
    this.core.loadStateSnapshot(snapshot);
  }

  getWorkerPayload({ mode = 'compact' } = {}) {
    const snapshot = this.getSnapshot({ mode });
    return {
      schema: WEATHER_KERNEL_SNAPSHOT_SCHEMA,
      contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
      manifest: this.manifest,
      timeUTC: snapshot.timeUTC,
      fields: snapshot.fields,
      state: snapshot.state || null
    };
  }

  getTransferBuffers(payload) {
    return collectWeatherKernelTransferBuffers(payload);
  }
}

export function createWeatherKernel(config = {}) {
  return new WeatherKernelRuntime(config);
}
