import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeV2FromClimo } from '../../src/weather/v2/initializeFromClimo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_FIXTURE_PATH = path.join(__dirname, 'fixtures', 'headless-terrain-180x90.json');

const wrapX = (x, w) => {
  if (x < 0) return x + w;
  if (x >= w) return x - w;
  return x;
};

const readFixture = (fixturePath = DEFAULT_FIXTURE_PATH) => {
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const srcW = raw?.grid?.nx ?? 0;
  const srcH = raw?.grid?.ny ?? 0;
  if (!Number.isFinite(srcW) || !Number.isFinite(srcH) || srcW <= 0 || srcH <= 0) {
    throw new Error(`Invalid terrain fixture grid in ${fixturePath}`);
  }
  return {
    ...raw,
    srcW,
    srcH,
    elev: Float32Array.from(raw.elev || []),
    landMask: Uint8Array.from(raw.landMask || []),
    soilCap: Float32Array.from(raw.soilCap || []),
    albedo: Float32Array.from(raw.albedo || [])
  };
};

const sampleBilinear = (source, srcW, srcH, x, y) => {
  const xFloor = Math.floor(x);
  const y0 = Math.max(0, Math.min(srcH - 1, Math.floor(y)));
  const y1 = Math.max(0, Math.min(srcH - 1, y0 + 1));
  const x0 = wrapX(xFloor, srcW);
  const x1 = wrapX(x0 + 1, srcW);
  const tx = x - xFloor;
  const ty = y - Math.floor(y);
  const v00 = source[y0 * srcW + x0] ?? 0;
  const v10 = source[y0 * srcW + x1] ?? 0;
  const v01 = source[y1 * srcW + x0] ?? 0;
  const v11 = source[y1 * srcW + x1] ?? 0;
  const v0 = v00 * (1 - tx) + v10 * tx;
  const v1 = v01 * (1 - tx) + v11 * tx;
  return v0 * (1 - ty) + v1 * ty;
};

const mapDestIndexToSourceCoord = (index, srcSize, dstSize) => {
  if (dstSize <= 1 || srcSize <= 1) return 0;
  return (index / (dstSize - 1)) * (srcSize - 1);
};

const resampleScalarField = (source, srcW, srcH, dstW, dstH, { clampMin = null, clampMax = null } = {}) => {
  if (srcW === dstW && srcH === dstH) {
    const out = Float32Array.from(source);
    if (Number.isFinite(clampMin) || Number.isFinite(clampMax)) {
      for (let i = 0; i < out.length; i += 1) {
        if (Number.isFinite(clampMin)) out[i] = Math.max(clampMin, out[i]);
        if (Number.isFinite(clampMax)) out[i] = Math.min(clampMax, out[i]);
      }
    }
    return out;
  }

  const out = new Float32Array(dstW * dstH);
  for (let j = 0; j < dstH; j += 1) {
    const y = mapDestIndexToSourceCoord(j, srcH, dstH);
    for (let i = 0; i < dstW; i += 1) {
      const x = mapDestIndexToSourceCoord(i, srcW, dstW);
      let value = sampleBilinear(source, srcW, srcH, x, y);
      if (Number.isFinite(clampMin)) value = Math.max(clampMin, value);
      if (Number.isFinite(clampMax)) value = Math.min(clampMax, value);
      out[j * dstW + i] = value;
    }
  }
  return out;
};

const resampleMaskField = (source, srcW, srcH, dstW, dstH) => {
  if (srcW === dstW && srcH === dstH) {
    return Uint8Array.from(source);
  }

  const out = new Uint8Array(dstW * dstH);
  for (let j = 0; j < dstH; j += 1) {
    const y = mapDestIndexToSourceCoord(j, srcH, dstH);
    for (let i = 0; i < dstW; i += 1) {
      const x = mapDestIndexToSourceCoord(i, srcW, dstW);
      const value = sampleBilinear(source, srcW, srcH, x, y);
      out[j * dstW + i] = value >= 0.5 ? 1 : 0;
    }
  }
  return out;
};

export const summarizeTerrain = (core) => {
  const elev = core?.geo?.elev;
  const landMask = core?.state?.landMask;
  if (!elev?.length) {
    return {
      elevMax: 0,
      landFrac: 0,
      terrainSampleCount: 0
    };
  }
  let elevMax = 0;
  let terrainSampleCount = 0;
  let landCount = 0;
  for (let i = 0; i < elev.length; i += 1) {
    const value = elev[i] || 0;
    if (value > elevMax) elevMax = value;
    if (value >= 1000) terrainSampleCount += 1;
    if (landMask?.[i] === 1) landCount += 1;
  }
  return {
    elevMax,
    landFrac: elev.length ? landCount / elev.length : 0,
    terrainSampleCount
  };
};

export function applyHeadlessTerrainFixture(core, { fixturePath = DEFAULT_FIXTURE_PATH } = {}) {
  if (!core?.grid || !core?.state || !core?.geo || !core?.climo) {
    throw new Error('applyHeadlessTerrainFixture requires a fully initialized WeatherCore5 instance');
  }

  const before = summarizeTerrain(core);
  if (before.terrainSampleCount > 0 && before.elevMax > 0) {
    return {
      applied: false,
      source: 'native',
      fixturePath,
      before,
      after: before
    };
  }

  const fixture = readFixture(fixturePath);
  const dstW = core.grid.nx;
  const dstH = core.grid.ny;
  const elev = resampleScalarField(fixture.elev, fixture.srcW, fixture.srcH, dstW, dstH, { clampMin: 0 });
  const landMask = resampleMaskField(fixture.landMask, fixture.srcW, fixture.srcH, dstW, dstH);
  const soilCap = fixture.soilCap.length
    ? resampleScalarField(fixture.soilCap, fixture.srcW, fixture.srcH, dstW, dstH, { clampMin: 0, clampMax: 1 })
    : null;
  const albedo = fixture.albedo.length
    ? resampleScalarField(fixture.albedo, fixture.srcW, fixture.srcH, dstW, dstH, { clampMin: 0, clampMax: 1 })
    : null;

  core.geo.elev.set(elev);
  core.state.landMask.set(landMask);
  if (soilCap && core.state.soilCap?.length === soilCap.length) {
    core.state.soilCap.set(soilCap);
  }
  if (albedo && core.geo.albedo?.length === albedo.length) {
    core.geo.albedo.set(albedo);
  }

  initializeV2FromClimo({
    grid: core.grid,
    state: core.state,
    geo: core.geo,
    climo: core.climo
  });
  core._updateHydrostatic?.();

  const after = summarizeTerrain(core);
  core._agentHeadlessTerrainFixture = {
    applied: true,
    source: 'fixture',
    fixturePath,
    fixtureStats: fixture.stats || null,
    before,
    after
  };

  return core._agentHeadlessTerrainFixture;
}
