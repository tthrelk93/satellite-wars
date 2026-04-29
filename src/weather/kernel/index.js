import { WeatherCore5 } from '../v2/core5.js';
import { WeatherEventLedger } from '../events/index.js';
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
  WEATHER_KERNEL_EVENT_PRODUCT_SCHEMA,
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
    this.eventLedger = new WeatherEventLedger({ seed: this.config.seed ?? 0 });
    this._lastEventProduct = null;
    this._lastEventProductTimeUTC = null;
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

  setSeed(seed) {
    this.core.setSeed?.(seed);
    if (Number.isFinite(seed)) {
      this.config = { ...this.config, seed: Number(seed) };
      this.manifest = createWeatherKernelManifest(this.config);
      this.eventLedger.reset({ seed: Number(seed) });
      this._lastEventProduct = null;
      this._lastEventProductTimeUTC = null;
    }
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

  getEventProduct({ force = false } = {}) {
    const timeUTC = Number.isFinite(this.core?.timeUTC) ? this.core.timeUTC : 0;
    if (!force && this._lastEventProduct && this._lastEventProductTimeUTC === timeUTC) {
      return this._lastEventProduct;
    }
    this._lastEventProduct = this.eventLedger.updateFromCore({
      grid: this.core.grid,
      fields: this.core.fields,
      state: this.core.state,
      timeUTC,
      manifest: this.manifest
    });
    this._lastEventProductTimeUTC = timeUTC;
    return this._lastEventProduct;
  }

  loadSnapshot(snapshot) {
    assertWeatherKernelSnapshot(snapshot, { requireFullState: true });
    this.core.loadStateSnapshot(snapshot);
    this.eventLedger.reset({ seed: this.config.seed ?? 0 });
    this._lastEventProduct = null;
    this._lastEventProductTimeUTC = null;
  }

  getWorkerPayload({ mode = 'compact' } = {}) {
    const snapshot = this.getSnapshot({ mode });
    const events = this.getEventProduct({ force: true });
    return {
      schema: WEATHER_KERNEL_SNAPSHOT_SCHEMA,
      contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
      manifest: this.manifest,
      timeUTC: snapshot.timeUTC,
      fields: snapshot.fields,
      state: snapshot.state || null,
      events
    };
  }

  getTransferBuffers(payload) {
    return collectWeatherKernelTransferBuffers(payload);
  }
}

export function createWeatherKernel(config = {}) {
  return new WeatherKernelRuntime(config);
}
