/* eslint-env worker */
/* eslint-disable no-restricted-globals */
import { createWeatherKernel, collectWeatherKernelTransferBuffers } from '../weather/kernel';

let kernel = null;
let snapshotMode = 'compact';

const postSnapshot = (type) => {
  if (!core) return;
  const payload = core.getStateSnapshot({ mode: snapshotMode });
  const message = { type, payload };
  self.postMessage(message, collectWeatherKernelTransferBuffers(payload));
};

self.onmessage = async (event) => {
  const data = event?.data;
  const type = data?.type;
  const payload = data?.payload || {};

  try {
    if (type === 'init') {
      snapshotMode = payload.snapshotMode === 'full' ? 'full' : 'compact';
      kernel = createWeatherKernel({
        nx: payload.nx,
        ny: payload.ny,
        dt: payload.dt,
        seed: payload.seed,
        instrumentationMode: payload.instrumentationMode === 'disabled' ? 'disabled' : 'full'
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

    if (!kernel) {
      self.postMessage({ type: 'error', payload: { message: 'worker-not-initialized' } });
      return;
    }

    if (type === 'step') {
      snapshotMode = payload.snapshotMode === 'full' ? 'full' : 'compact';
      if (Number.isFinite(payload.simSpeed)) {
        kernel.setSimSpeed(payload.simSpeed);
      }
      if (Number.isFinite(payload.deltaSeconds) && payload.deltaSeconds > 0) {
        kernel.advanceModelSeconds(payload.deltaSeconds);
      }
      postSnapshot('state');
      return;
    }

    if (type === 'setV2ConvectionEnabled') {
      kernel.setV2ConvectionEnabled(Boolean(payload.enabled));
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
