/* eslint-env worker */
/* eslint-disable no-restricted-globals */
import { createWeatherKernel, collectWeatherKernelTransferBuffers } from '../weather/kernel';

let kernel = null;
let snapshotMode = 'compact';

const postSnapshot = (type) => {
  if (!kernel) return;
  const payload = kernel.getWorkerPayload({ mode: snapshotMode });
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
      await kernel.whenReady();
      if (Number.isFinite(payload.startTimeSeconds)) {
        kernel.setTimeUTC(payload.startTimeSeconds);
      }
      if (Array.isArray(payload.focusRegions)) {
        kernel.setLocalFocusRegions(payload.focusRegions);
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
      return;
    }

    if (type === 'setLocalFocusRegions') {
      kernel.setLocalFocusRegions(Array.isArray(payload.focusRegions) ? payload.focusRegions : []);
      postSnapshot('state');
      return;
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
