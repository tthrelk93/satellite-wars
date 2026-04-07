#!/usr/bin/env node
import fs from 'node:fs/promises';
import WebSocket from 'ws';

const [targetArg, outPath, screenshotPath, overridesArg, resetArg] = process.argv.slice(2);
const targetSeconds = Number(targetArg || 0);
const overrides = overridesArg ? JSON.parse(overridesArg) : null;
const resetMode = resetArg || 'keep';
const devtoolsBase = process.env.SW_DEVTOOLS_BASE || 'http://127.0.0.1:18800';
const targetUrl = 'http://127.0.0.1:3000/';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

const targets = await fetchJson(`${devtoolsBase}/json/list`);
const pageTarget = targets.find((entry) => entry.type === 'page' && entry.url.startsWith(targetUrl));
if (!pageTarget?.webSocketDebuggerUrl) throw new Error(`No page target found for ${targetUrl}`);

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', reject);
});

let idCounter = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++idCounter;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }), (err) => {
    if (err) {
      pending.delete(id);
      reject(err);
    }
  });
});

async function evaluate(expression, { awaitPromise = true, returnByValue = true } = {}) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue,
    replMode: false,
    allowUnsafeEvalBlockedByCSP: true
  });
  return result.result?.value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicateExpression, { timeoutMs = 120000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await evaluate(predicateExpression).catch(() => false);
    if (value) return value;
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for predicate: ${predicateExpression}`);
    await sleep(intervalMs);
  }
}

try {
  await send('Page.enable');
  await send('Runtime.enable');

  const hasCore = await evaluate('!!window.__sw?.earth?.weatherField?.core');
  if (!hasCore) {
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')].find((el) => /single player/i.test(el.textContent || ''));
      if (btn) btn.click();
      return !!btn;
    })()`);
    await waitFor('!!window.__sw?.earth?.weatherField?.core', { timeoutMs: 120000, intervalMs: 1000 });
  }
  await waitFor('!!window.__sw?.earth?.weatherField?.core?.ready', { timeoutMs: 120000, intervalMs: 1000 });
  await waitFor(
    '(() => { const elev = window.__sw?.earth?.weatherField?.core?.geo?.elev; if (!elev || !elev.length) return false; let max = 0; for (let i = 0; i < elev.length; i += 1) max = Math.max(max, elev[i] || 0); return max > 0; })()',
    { timeoutMs: 120000, intervalMs: 1000 }
  );

  const result = await evaluate(`(() => {
    const core = window.__sw?.earth?.weatherField?.core;
    if (!core) return { error: 'no core' };
    const overrides = ${JSON.stringify(overrides)};
    const resetMode = ${JSON.stringify(resetMode)};
    if (resetMode === 'zero') {
      core.setTimeUTC(0);
    }
    if (overrides && typeof overrides === 'object') {
      Object.assign(core.vertParams, overrides.vertParams || {});
      Object.assign(core.microParams, overrides.microParams || {});
      Object.assign(core.surfaceParams, overrides.surfaceParams || {});
      Object.assign(core.dynParams, overrides.dynParams || {});
      Object.assign(core.nudgeParams, overrides.nudgeParams || {});
      Object.assign(core.windNudgeParams, overrides.windNudgeParams || {});
      Object.assign(core.windEddyParams, overrides.windEddyParams || {});
      Object.assign(core.diagParams, overrides.diagParams || {});
    }
    if (core.timeUTC < ${JSON.stringify(targetSeconds)}) {
      core.advanceModelSeconds(${JSON.stringify(targetSeconds)} - core.timeUTC);
    }
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
      targetSeconds: ${JSON.stringify(targetSeconds)},
      timeUTC: core.timeUTC,
      resetMode,
      overrides,
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
      uiLabel: [...document.querySelectorAll('button')].map((el) => (el.textContent || '').trim()).find((text) => /^Day\\s+\\d+,/.test(text)) || null
    };
  })()`);

  const payload = JSON.stringify(result, null, 2);
  if (outPath) await fs.writeFile(outPath, payload);
  if (screenshotPath) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
  }
  console.log(payload);
} finally {
  try {
    ws.close();
  } catch (_) {}
}
