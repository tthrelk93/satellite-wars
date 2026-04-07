/* eslint-env worker */
/* eslint-disable no-restricted-globals */
import { WeatherCore5 } from '../weather/v2/core5';

let core = null;
let snapshotMode = 'compact';

const isTypedArray = (value) => ArrayBuffer.isView(value) && !(value instanceof DataView);

const collectTransferBuffers = (value, buffers = []) => {
  if (!value || typeof value !== 'object') return buffers;
  if (isTypedArray(value)) {
    buffers.push(value.buffer);
    return buffers;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTransferBuffers(item, buffers));
    return buffers;
  }
  Object.values(value).forEach((item) => collectTransferBuffers(item, buffers));
  return buffers;
};

const postSnapshot = (type) => {
  if (!core) return;
  const payload = core.getStateSnapshot({ mode: snapshotMode });
  const message = { type, payload };
  self.postMessage(message, collectTransferBuffers(payload));
};

self.onmessage = async (event) => {
  const data = event?.data;
  const type = data?.type;
  const payload = data?.payload || {};

  try {
    if (type === 'init') {
      snapshotMode = payload.snapshotMode === 'full' ? 'full' : 'compact';
      core = new WeatherCore5({
        nx: payload.nx,
        ny: payload.ny,
        dt: payload.dt,
        seed: payload.seed
      });
      await core._initPromise;
      if (payload.startSnapshot && typeof core.applyStateSnapshot === 'function') {
        core.applyStateSnapshot(payload.startSnapshot, { restoreRuntime: true });
      } else if (Number.isFinite(payload.startTimeSeconds)) {
        core.setTimeUTC(payload.startTimeSeconds);
      }
      postSnapshot('ready');
      return;
    }

    if (!core) {
      self.postMessage({ type: 'error', payload: { message: 'worker-not-initialized' } });
      return;
    }

    if (type === 'step') {
      snapshotMode = payload.snapshotMode === 'full' ? 'full' : 'compact';
      if (Number.isFinite(payload.simSpeed)) {
        core.setSimSpeed(payload.simSpeed);
      }
      if (Number.isFinite(payload.deltaSeconds) && payload.deltaSeconds > 0) {
        core.advanceModelSeconds(payload.deltaSeconds);
      }
      postSnapshot('state');
      return;
    }

    if (type === 'setV2ConvectionEnabled') {
      core.setV2ConvectionEnabled(Boolean(payload.enabled));
      postSnapshot('state');
      return;
    }

    if (type === 'setSnapshotMode') {
      snapshotMode = payload.mode === 'full' ? 'full' : 'compact';
      postSnapshot('state');
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: {
        message: error?.message || String(error),
        stack: error?.stack || null
      }
    });
  }
};
