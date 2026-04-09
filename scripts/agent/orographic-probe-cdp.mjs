#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import WebSocket from 'ws';
import { parseSimTimeLabel, selectDevtoolsPageTarget } from './browser-utils.mjs';

const [targetArg, outPath, screenshotPath, overridesArg, resetArg] = process.argv.slice(2);
const targetSeconds = Number(targetArg || 0);
const overrides = overridesArg && overridesArg !== 'null' ? JSON.parse(overridesArg) : null;
const resetMode = resetArg || 'keep';
const devtoolsBase = process.env.SW_DEVTOOLS_BASE || 'http://127.0.0.1:18800';
const targetUrl = 'http://127.0.0.1:3000/?mode=solo';
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const DEFAULT_COMMAND_TIMEOUT_MS = 30000;
const DEFAULT_WAIT_TIMEOUT_MS = 240000;
const SIM_PARITY_TOLERANCE_SECONDS = 60;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs, label) => {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

async function fetchJson(url, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const ensureParentDir = async (filePath) => {
  if (!filePath) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const targets = await fetchJson(`${devtoolsBase}/json/list`);
const pageTarget = selectDevtoolsPageTarget(targets, { targetUrl, preferredMode: 'solo' });
if (!pageTarget?.webSocketDebuggerUrl) {
  throw new Error(`No page target found for ${targetUrl}`);
}

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
let restoreProbePauseState = null;
await withTimeout(new Promise((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', reject);
}), DEFAULT_FETCH_TIMEOUT_MS, 'websocket connect');

let idCounter = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject, timer } = pending.get(msg.id);
    pending.delete(msg.id);
    if (timer) clearTimeout(timer);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});
ws.on('close', () => {
  for (const [id, entry] of pending.entries()) {
    pending.delete(id);
    if (entry.timer) clearTimeout(entry.timer);
    entry.reject(new Error('WebSocket closed before command response'));
  }
});
ws.on('error', (error) => {
  for (const [id, entry] of pending.entries()) {
    pending.delete(id);
    if (entry.timer) clearTimeout(entry.timer);
    entry.reject(error);
  }
});

const send = (method, params = {}, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS) => new Promise((resolve, reject) => {
  const id = ++idCounter;
  const timer = setTimeout(() => {
    pending.delete(id);
    reject(new Error(`${method} timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  pending.set(id, { resolve, reject, timer });
  ws.send(JSON.stringify({ id, method, params }), (err) => {
    if (err) {
      clearTimeout(timer);
      pending.delete(id);
      reject(err);
    }
  });
});

async function evaluate(expression, { awaitPromise = true, returnByValue = true } = {}, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue,
    replMode: false,
    allowUnsafeEvalBlockedByCSP: true
  }, timeoutMs);
  return result.result?.value;
}

async function waitFor(predicateExpression, { timeoutMs = DEFAULT_WAIT_TIMEOUT_MS, intervalMs = 1000, label = predicateExpression } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  for (;;) {
    try {
      const value = await evaluate(predicateExpression, {}, DEFAULT_COMMAND_TIMEOUT_MS);
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() >= deadline) {
      const suffix = lastError ? ` (last error: ${lastError.message})` : '';
      throw new Error(`Timed out waiting for ${label}${suffix}`);
    }
    await sleep(intervalMs);
  }
}

const getProbeState = async () => evaluate('(() => window.__sw?.getSimProbeState?.() ?? null)()');
const setProbePaused = async (paused) => evaluate(`(() => window.__sw?.setSimProbePaused?.(${JSON.stringify(Boolean(paused))}) ?? null)()`);
const queueProbeAdvance = async (deltaSeconds) => evaluate(`(() => window.__sw?.queueSimProbeAdvance?.(${JSON.stringify(deltaSeconds)}, { burst: true }) ?? null)()`);

const waitForSimParity = async (requestedTargetSeconds, { exact = false } = {}) => {
  const deadline = Date.now() + DEFAULT_WAIT_TIMEOUT_MS;
  let lastState = null;
  for (;;) {
    lastState = await getProbeState().catch(() => null);
    const simTime = Number(lastState?.simTimeSeconds);
    const coreTime = Number(lastState?.coreTimeUTC);
    const labelSeconds = Number.isFinite(lastState?.simTimeLabelSeconds)
      ? Number(lastState.simTimeLabelSeconds)
      : parseSimTimeLabel(lastState?.simTimeLabel);
    const queueRemaining = Number(lastState?.queuedAdvanceSeconds ?? 0);
    const ready = Boolean(lastState?.weatherReady && lastState?.terrainReady);
    const simReached = exact
      ? Number.isFinite(simTime) && Math.abs(simTime - requestedTargetSeconds) <= SIM_PARITY_TOLERANCE_SECONDS
      : Number.isFinite(simTime) && simTime >= requestedTargetSeconds;
    const coreAligned = Number.isFinite(coreTime) && Math.abs(coreTime - simTime) <= SIM_PARITY_TOLERANCE_SECONDS;
    const labelAligned = Number.isFinite(labelSeconds) && Math.abs(labelSeconds - simTime) <= SIM_PARITY_TOLERANCE_SECONDS;
    const queueDrained = queueRemaining <= SIM_PARITY_TOLERANCE_SECONDS;
    if (ready && simReached && coreAligned && labelAligned && queueDrained) {
      return lastState;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for sim parity at ${requestedTargetSeconds}s. Last state: ${JSON.stringify(lastState)}`);
    }
    await sleep(1000);
  }
};

const advanceProbeInChunks = async (requestedTargetSeconds, initialState) => {
  let lastState = initialState;
  await setProbePaused(true);
  while (Number(lastState?.simTimeSeconds ?? 0) < requestedTargetSeconds - SIM_PARITY_TOLERANCE_SECONDS) {
    const currentSimTime = Number(lastState?.simTimeSeconds ?? 0);
    const remaining = Math.max(0, requestedTargetSeconds - currentSimTime);
    const chunk = remaining > 21600 ? 21600 : remaining > 7200 ? 7200 : remaining;
    if (!(chunk > 0)) break;
    await queueProbeAdvance(chunk);
    lastState = await waitForSimParity(Math.min(requestedTargetSeconds, currentSimTime + chunk), { exact: false });
  }
  return waitForSimParity(requestedTargetSeconds, { exact: true });
};

try {
  await send('Page.enable');
  await send('Runtime.enable');

  if (resetMode === 'zero') {
    await send('Page.reload', { ignoreCache: true }, DEFAULT_COMMAND_TIMEOUT_MS);
  }

  await waitFor('document.readyState === "complete"', { timeoutMs: 120000, label: 'document ready' });
  await waitFor('!!window.__sw?.earth', { timeoutMs: 120000, label: 'window.__sw.earth' });

  const hasCore = await evaluate('!!window.__sw?.earth?.weatherField?.core');
  if (!hasCore) {
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')].find((el) => /single player/i.test(el.textContent || ''));
      if (btn) btn.click();
      return !!btn;
    })()`);
    await waitFor('!!window.__sw?.earth?.weatherField?.core', { timeoutMs: 120000, label: 'weather core after single-player launch' });
  }

  await waitFor('!!window.__sw?.getSimProbeState && !!window.__sw?.setSimProbePaused && !!window.__sw?.queueSimProbeAdvance', {
    timeoutMs: 120000,
    label: 'dev probe helpers'
  });
  await waitFor(
    '(() => { const state = window.__sw?.getSimProbeState?.(); return !!(state && state.weatherReady && state.terrainReady); })()',
    { timeoutMs: 120000, label: 'weather + terrain readiness' }
  );

  if (overrides && typeof overrides === 'object') {
    await evaluate(`(() => {
      const core = window.__sw?.earth?.weatherField?.core;
      if (!core) return false;
      const overrides = ${JSON.stringify(overrides)};
      Object.assign(core.vertParams, overrides.vertParams || {});
      Object.assign(core.microParams, overrides.microParams || {});
      Object.assign(core.surfaceParams, overrides.surfaceParams || {});
      Object.assign(core.dynParams, overrides.dynParams || {});
      Object.assign(core.nudgeParams, overrides.nudgeParams || {});
      Object.assign(core.windNudgeParams, overrides.windNudgeParams || {});
      Object.assign(core.windEddyParams, overrides.windEddyParams || {});
      Object.assign(core.diagParams, overrides.diagParams || {});
      return true;
    })()`);
  }

  const initialState = await getProbeState();
  restoreProbePauseState = initialState?.paused;
  const initialSimTime = Number(initialState?.simTimeSeconds ?? 0);
  if (resetMode === 'zero' && Number.isFinite(initialSimTime) && Number.isFinite(targetSeconds) && initialSimTime >= targetSeconds) {
    throw new Error(`Reset requested, but the page was already at or past the target time after reload. State: ${JSON.stringify(initialState)}`);
  }

  const parityState = Number.isFinite(targetSeconds) && targetSeconds > initialSimTime
    ? await advanceProbeInChunks(targetSeconds, initialState)
    : await waitForSimParity(targetSeconds, { exact: true });

  const result = await evaluate(`(() => {
    const core = window.__sw?.earth?.weatherField?.core;
    const probeState = window.__sw?.getSimProbeState?.() ?? null;
    if (!core) return { error: 'no core', probeState };
    const { grid, state, fields, geo } = core;
    const { nx, ny, invDx, invDy, latDeg, lonDeg } = grid;
    const N = state.N;
    const levS = state.nz - 1;
    const elev = geo.elev;
    const precip = fields.precipRate || state.precipRate;
    const cloudLow = fields.cloudLow;
    const u = state.u;
    const v = state.v;
    const normLon = (lon) => ((lon + 540) % 360) - 180;
    const inLonRange = (lon, a, b) => {
      lon = normLon(lon); a = normLon(a); b = normLon(b);
      if (a <= b) return lon >= a && lon <= b;
      return lon >= a || lon <= b;
    };
    const mean = (arr, fn) => arr.length ? arr.reduce((s, x) => s + fn(x), 0) / arr.length : 0;
    const terrain = [];
    const regions = [
      { name: 'Andes', lat0: -50, lat1: -15, lon0: -78, lon1: -64, entries: [] },
      { name: 'Rockies', lat0: 32, lat1: 58, lon0: -128, lon1: -104, entries: [] },
      { name: 'Himalaya-Tibet', lat0: 25, lat1: 40, lon0: 70, lon1: 105, entries: [] }
    ];
    for (let j = 0; j < ny; j += 1) {
      const row = j * nx;
      const jN = Math.max(0, j - 1);
      const jS = Math.min(ny - 1, j + 1);
      const rowN = jN * nx;
      const rowS = jS * nx;
      const invDxRow = invDx[j];
      const invDyRow = invDy[j];
      for (let i = 0; i < nx; i += 1) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const k = row + i;
        const slopeX = (elev[row + iE] - elev[row + iW]) * 0.5 * invDxRow;
        const slopeY = (elev[rowN + i] - elev[rowS + i]) * 0.5 * invDyRow;
        const slopeMag = Math.hypot(slopeX, slopeY);
        if (elev[k] < 1000 || slopeMag < 0.001) continue;
        const idxS = levS * N + k;
        const cap = state.soilCap?.[k] || 0;
        const soilFrac = cap > 1e-6 ? (state.soilW?.[k] || 0) / cap : 0;
        const entry = {
          upslope: u[idxS] * slopeX + v[idxS] * slopeY,
          precip: precip[k],
          cloudLow: cloudLow[k],
          qcLow: state.qc[idxS],
          qrLow: state.qr[idxS],
          qvLow: state.qv[idxS],
          rhLow: fields.rh3D ? fields.rh3D[idxS] : 0,
          soilFrac,
          pLow: state.pMid[idxS],
          elev: elev[k],
          lat: latDeg[j],
          lon: normLon(lonDeg[i]),
          omegaLow: state.omega[levS * N + k],
          omegaSurface: state.omega[state.nz * N + k]
        };
        terrain.push(entry);
        for (const region of regions) {
          if (entry.lat >= region.lat0 && entry.lat <= region.lat1 && inLonRange(entry.lon, region.lon0, region.lon1)) {
            region.entries.push(entry);
          }
        }
      }
    }
    terrain.sort((a, b) => a.upslope - b.upslope);
    const q10 = terrain[Math.floor(0.10 * (terrain.length - 1))]?.upslope ?? 0;
    const q90 = terrain[Math.floor(0.90 * (terrain.length - 1))]?.upslope ?? 0;
    const low = terrain.filter((e) => e.upslope <= q10);
    const high = terrain.filter((e) => e.upslope >= q90);
    const summarizeGroup = (entries) => ({
      count: entries.length,
      precipMean: mean(entries, (e) => e.precip),
      cloudMean: mean(entries, (e) => e.cloudLow),
      qcLowMean: mean(entries, (e) => e.qcLow),
      qrLowMean: mean(entries, (e) => e.qrLow),
      qvLowMean: mean(entries, (e) => e.qvLow),
      rhLowMean: mean(entries, (e) => e.rhLow),
      soilFracMean: mean(entries, (e) => e.soilFrac),
      pLowMean: mean(entries, (e) => e.pLow),
      elevMean: mean(entries, (e) => e.elev),
      omegaLowMean: mean(entries, (e) => e.omegaLow),
      omegaSurfaceMean: mean(entries, (e) => e.omegaSurface)
    });
    const summarizeRegion = (region) => {
      if (!region.entries.length) return { name: region.name, count: 0 };
      const sorted = [...region.entries].sort((a, b) => a.upslope - b.upslope);
      const q25 = sorted[Math.floor(0.25 * (sorted.length - 1))]?.upslope ?? 0;
      const q75 = sorted[Math.floor(0.75 * (sorted.length - 1))]?.upslope ?? 0;
      const downslope = sorted.filter((e) => e.upslope <= q25);
      const upslope = sorted.filter((e) => e.upslope >= q75);
      return {
        name: region.name,
        count: region.entries.length,
        upslope: summarizeGroup(upslope),
        downslope: summarizeGroup(downslope),
        precipRatio: mean(upslope, (e) => e.precip) / Math.max(1e-6, mean(downslope, (e) => e.precip)),
        cloudRatio: mean(upslope, (e) => e.cloudLow) / Math.max(1e-6, mean(downslope, (e) => e.cloudLow)),
        qcLowRatio: mean(upslope, (e) => e.qcLow) / Math.max(1e-9, mean(downslope, (e) => e.qcLow)),
        qrLowRatio: mean(upslope, (e) => e.qrLow) / Math.max(1e-9, mean(downslope, (e) => e.qrLow)),
        qvLowRatio: mean(upslope, (e) => e.qvLow) / Math.max(1e-9, mean(downslope, (e) => e.qvLow)),
        rhLowRatio: mean(upslope, (e) => e.rhLow) / Math.max(1e-9, mean(downslope, (e) => e.rhLow)),
        soilFracRatio: mean(upslope, (e) => e.soilFrac) / Math.max(1e-9, mean(downslope, (e) => e.soilFrac)),
        pLowRatio: mean(upslope, (e) => e.pLow) / Math.max(1e-9, mean(downslope, (e) => e.pLow)),
        elevRatio: mean(upslope, (e) => e.elev) / Math.max(1e-9, mean(downslope, (e) => e.elev)),
        omegaLowContrast: mean(upslope, (e) => e.omegaLow) - mean(downslope, (e) => e.omegaLow),
        omegaSurfaceContrast: mean(upslope, (e) => e.omegaSurface) - mean(downslope, (e) => e.omegaSurface)
      };
    };
    return {
      requestedTargetSeconds: ${JSON.stringify(targetSeconds)},
      timeUTC: core.timeUTC,
      resetMode: ${JSON.stringify(resetMode)},
      overrides: ${JSON.stringify(overrides)},
      probeState,
      global: {
        terrainSampleCount: terrain.length,
        precipUpslopeVsDownslope: mean(high, (e) => e.precip) / Math.max(1e-6, mean(low, (e) => e.precip)),
        cloudUpslopeVsDownslope: mean(high, (e) => e.cloudLow) / Math.max(1e-6, mean(low, (e) => e.cloudLow)),
        qcLowUpslopeVsDownslope: mean(high, (e) => e.qcLow) / Math.max(1e-9, mean(low, (e) => e.qcLow)),
        qrLowUpslopeVsDownslope: mean(high, (e) => e.qrLow) / Math.max(1e-9, mean(low, (e) => e.qrLow)),
        qvLowUpslopeVsDownslope: mean(high, (e) => e.qvLow) / Math.max(1e-9, mean(low, (e) => e.qvLow)),
        rhLowUpslopeVsDownslope: mean(high, (e) => e.rhLow) / Math.max(1e-9, mean(low, (e) => e.rhLow)),
        soilFracUpslopeVsDownslope: mean(high, (e) => e.soilFrac) / Math.max(1e-9, mean(low, (e) => e.soilFrac)),
        pLowUpslopeVsDownslope: mean(high, (e) => e.pLow) / Math.max(1e-9, mean(low, (e) => e.pLow)),
        elevUpslopeVsDownslope: mean(high, (e) => e.elev) / Math.max(1e-9, mean(low, (e) => e.elev)),
        omegaLowContrast: mean(high, (e) => e.omegaLow) - mean(low, (e) => e.omegaLow),
        omegaSurfaceContrast: mean(high, (e) => e.omegaSurface) - mean(low, (e) => e.omegaSurface)
      },
      regions: regions.map(summarizeRegion),
      uiLabel: probeState?.simTimeLabel ?? null
    };
  })()`);

  const labelSeconds = parseSimTimeLabel(result?.probeState?.simTimeLabel ?? result?.uiLabel);
  result.probeState = {
    ...result.probeState,
    simTimeLabelSeconds: Number.isFinite(labelSeconds) ? labelSeconds : result?.probeState?.simTimeLabelSeconds ?? null,
    parityDeltaSeconds: Number.isFinite(result?.probeState?.coreTimeUTC) && Number.isFinite(result?.probeState?.simTimeSeconds)
      ? Math.abs(result.probeState.coreTimeUTC - result.probeState.simTimeSeconds)
      : null
  };
  result.parityState = parityState;

  const payload = JSON.stringify(result, null, 2);
  if (outPath) {
    await ensureParentDir(outPath);
    await fs.writeFile(outPath, payload);
  }
  if (screenshotPath) {
    await ensureParentDir(screenshotPath);
    const shot = await send('Page.captureScreenshot', { format: 'png' }, DEFAULT_COMMAND_TIMEOUT_MS);
    await fs.writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
  }
  console.log(payload);
} finally {
  if (restoreProbePauseState !== null) {
    try {
      await setProbePaused(restoreProbePauseState);
    } catch (_) {}
  }
  try {
    ws.close();
  } catch (_) {}
}
