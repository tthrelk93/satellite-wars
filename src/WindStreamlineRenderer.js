import * as THREE from 'three';
import {
  addParticleEvolvePhase,
  createParticleEvolvePhaseTotals,
  hasParticleEvolvePhaseData,
  mergeParticleEvolvePhaseTotals
} from './windParticlePerf.js';
import { bilinear } from './weather/shared/bilinear.js';

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 80;
const PARTICLE_MULTIPLIER = 10;
const MAX_PARTICLE_AGE = 320;
const MIN_PARTICLE_AGE = Math.round(MAX_PARTICLE_AGE * 0.5);
const INTENSITY_SCALE_STEP = 10;
const DEFAULT_MAX_INTENSITY = 25;
const DEFAULT_STEP_SECONDS = 900;
const DEFAULT_MAX_STEP_PX = 2.5;
const FADE_ALPHA = 0.992;
const LINE_WIDTH = 1.0;
const DEFAULT_DIAG_SAMPLE_TARGET = 20000;
const DESIRED_MEAN_STEP_PX = 0.9;
const ADAPT_STEP_CLAMP_MIN = 0.3;
const ADAPT_STEP_CLAMP_MAX = 1.2;
const RENDER_FRAME_INTERVAL_SECONDS = 0.15;
const MAX_RENDER_SUBSTEPS = 1;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now());

const computePercentiles = (values, percentiles) => {
  if (!values || values.length === 0) return {};
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const out = {};
  percentiles.forEach((p) => {
    const idx = Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
    out[`p${Math.round(p * 100)}`] = sorted[idx];
  });
  return out;
};

const createSampleResult = () => ({ dx: 0, dy: 0, speed: 0, valid: false });

const writeInvalidSampleResult = (out = createSampleResult()) => {
  out.dx = 0;
  out.dy = 0;
  out.speed = 0;
  out.valid = false;
  return out;
};

const writeValidSampleResult = (out = createSampleResult(), dx = 0, dy = 0, speed = 0) => {
  out.dx = dx;
  out.dy = dy;
  out.speed = speed;
  out.valid = true;
  return out;
};

export const sampleFieldBilinearInRange = (
  x,
  y,
  width,
  height,
  fieldDx,
  fieldDy,
  fieldSpeed,
  fieldValid,
  out = createSampleResult()
) => {
  const x0 = x | 0;
  const y0 = y | 0;
  const x1 = x0 + 1 < width ? x0 + 1 : 0;
  const y1 = y0 + 1 < height ? y0 + 1 : y0;
  const row0 = y0 * width;
  const row1 = y1 * width;
  const idx00 = row0 + x0;
  const idx10 = row0 + x1;
  const idx01 = row1 + x0;
  const idx11 = row1 + x1;
  const tx = x - x0;
  const ty = y - y0;
  const oneMinusTx = 1 - tx;
  const oneMinusTy = 1 - ty;
  const w00 = oneMinusTx * oneMinusTy;
  const w10 = tx * oneMinusTy;
  const w01 = oneMinusTx * ty;
  const w11 = tx * ty;

  const valid00 = fieldValid[idx00] !== 0;
  const valid10 = fieldValid[idx10] !== 0;
  const valid01 = fieldValid[idx01] !== 0;
  const valid11 = fieldValid[idx11] !== 0;

  if (valid00 && valid10 && valid01 && valid11) {
    return writeValidSampleResult(
      out,
      (fieldDx[idx00] * w00) + (fieldDx[idx10] * w10) + (fieldDx[idx01] * w01) + (fieldDx[idx11] * w11),
      (fieldDy[idx00] * w00) + (fieldDy[idx10] * w10) + (fieldDy[idx01] * w01) + (fieldDy[idx11] * w11),
      (fieldSpeed[idx00] * w00) + (fieldSpeed[idx10] * w10) + (fieldSpeed[idx01] * w01) + (fieldSpeed[idx11] * w11)
    );
  }

  let wSum = 0;
  let dxSum = 0;
  let dySum = 0;
  let speedSum = 0;
  if (valid00) {
    wSum += w00;
    dxSum += fieldDx[idx00] * w00;
    dySum += fieldDy[idx00] * w00;
    speedSum += fieldSpeed[idx00] * w00;
  }
  if (valid10) {
    wSum += w10;
    dxSum += fieldDx[idx10] * w10;
    dySum += fieldDy[idx10] * w10;
    speedSum += fieldSpeed[idx10] * w10;
  }
  if (valid01) {
    wSum += w01;
    dxSum += fieldDx[idx01] * w01;
    dySum += fieldDy[idx01] * w01;
    speedSum += fieldSpeed[idx01] * w01;
  }
  if (valid11) {
    wSum += w11;
    dxSum += fieldDx[idx11] * w11;
    dySum += fieldDy[idx11] * w11;
    speedSum += fieldSpeed[idx11] * w11;
  }
  if (wSum <= 0) {
    return writeInvalidSampleResult(out);
  }
  const inv = 1 / wSum;
  return writeValidSampleResult(out, dxSum * inv, dySum * inv, speedSum * inv);
};

export const sampleFieldBilinear = (
  x,
  y,
  width,
  height,
  fieldDx,
  fieldDy,
  fieldSpeed,
  fieldValid,
  out = createSampleResult()
) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return writeInvalidSampleResult(out);
  }
  if (y < 0 || y >= height) {
    return writeInvalidSampleResult(out);
  }
  const xWrapped = (x >= 0 && x < width) ? x : ((x % width) + width) % width;
  return sampleFieldBilinearInRange(
    xWrapped,
    y,
    width,
    height,
    fieldDx,
    fieldDy,
    fieldSpeed,
    fieldValid,
    out
  );
};

const windIntensityColorScale = (step, maxWind) => {
  const result = [];
  const bucketCount = Math.max(12, Math.round((255 - 85) / step) + 1);
  const stops = [
    [0.0, [40, 80, 255]],
    [0.2, [0, 200, 255]],
    [0.4, [0, 255, 170]],
    [0.6, [255, 230, 90]],
    [0.8, [255, 160, 60]],
    [1.0, [255, 70, 60]]
  ];
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpColor = (t) => {
    let i = 0;
    while (i < stops.length - 1 && t > stops[i + 1][0]) i += 1;
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[Math.min(i + 1, stops.length - 1)];
    const tt = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    return [
      Math.round(lerp(c0[0], c1[0], tt)),
      Math.round(lerp(c0[1], c1[1], tt)),
      Math.round(lerp(c0[2], c1[2], tt))
    ];
  };
  const alphaFor = (t) => {
    if (t <= 0.4) {
      return 0.08 + (t / 0.4) * (0.2 - 0.08);
    }
    return 0.2 + ((t - 0.4) / 0.6) * (0.9 - 0.2);
  };
  for (let i = 0; i < bucketCount; i++) {
    const t = bucketCount > 1 ? i / (bucketCount - 1) : 0;
    const [r, g, b] = lerpColor(t);
    const a = alphaFor(t);
    result.push(`rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`);
  }
  result.indexFor = (m) => {
    if (!Number.isFinite(m) || m <= 0) return 0;
    return Math.floor(Math.min(m, maxWind) / maxWind * (result.length - 1));
  };
  return result;
};

class WindStreamlineRenderer {
  constructor({
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    particleMultiplier = PARTICLE_MULTIPLIER,
    maxIntensity = DEFAULT_MAX_INTENSITY,
    stepSeconds = DEFAULT_STEP_SECONDS,
    maxStepPx = DEFAULT_MAX_STEP_PX
  } = {}) {
    this.width = width;
    this.height = height;
    this.particleMultiplier = particleMultiplier;
    this._baseParticleMultiplier = particleMultiplier;
    this._densityScale = 1;
    this.maxIntensity = maxIntensity;
    this.stepSeconds = stepSeconds;
    this.baseStepSeconds = stepSeconds;
    this.maxStepPx = maxStepPx;
    this._frameAccumSeconds = 0;
    this._frameIntervalSeconds = RENDER_FRAME_INTERVAL_SECONDS;

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    this.colorStyles = windIntensityColorScale(INTENSITY_SCALE_STEP, maxIntensity);
    this.buckets = this.colorStyles.map(() => []);

    const total = width * height;
    this.fieldDx = new Float32Array(total);
    this.fieldDy = new Float32Array(total);
    this.fieldSpeed = new Float32Array(total);
    this.fieldValid = new Uint8Array(total);

    this.particles = [];
    this._initParticles();

    this._lastFieldSimTimeSeconds = null;
    this._lastGridKey = null;
    this.fieldUpdateCadenceSeconds = 1800;
    this._fieldReady = false;
    this._lastFieldDiagnostics = null;
    this._lastFrameDiagnostics = null;
    this._lastBuildPerfDiagnostics = null;
    this._lastPerfDiagnostics = null;
    this._clearCanvas();
  }

  _initParticles() {
    const count = Math.round(this.width * this.particleMultiplier);
    this.particles.length = 0;
    for (let i = 0; i < count; i++) {
      const particle = { x: 0, y: 0, age: 0, maxAge: MAX_PARTICLE_AGE };
      this._randomizeParticle(particle);
      this.particles.push(particle);
    }
  }

  setParticleDensityScale(scale) {
    const next = Number.isFinite(scale) ? Math.max(0.2, Math.min(1, scale)) : 1;
    if (Math.abs(next - this._densityScale) < 0.05) return;
    this._densityScale = next;
    this.particleMultiplier = this._baseParticleMultiplier * next;
    this._initParticles();
    this._clearCanvas();
  }

  _randomizeParticle(particle) {
    const maxSin = Math.sin(85 * Math.PI / 180);
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.random() * (this.width - 1);
      const sinLat = ((Math.random() * 2) - 1) * maxSin;
      const latRad = Math.asin(sinLat);
      const y = ((Math.PI / 2 - latRad) / Math.PI) * (this.height - 1);
      const idx = (Math.floor(y) * this.width) + Math.floor(x);
      if (this.fieldValid[idx]) {
        particle.x = x;
        particle.y = y;
        particle.maxAge = Math.floor(MIN_PARTICLE_AGE + Math.random() * (MAX_PARTICLE_AGE - MIN_PARTICLE_AGE));
        particle.age = Math.floor(Math.random() * Math.max(1, particle.maxAge));
        return particle;
      }
    }
    particle.x = Math.random() * (this.width - 1);
    const sinLat = ((Math.random() * 2) - 1) * maxSin;
    const latRad = Math.asin(sinLat);
    particle.y = ((Math.PI / 2 - latRad) / Math.PI) * (this.height - 1);
    particle.maxAge = Math.floor(MIN_PARTICLE_AGE + Math.random() * (MAX_PARTICLE_AGE - MIN_PARTICLE_AGE));
    particle.age = Math.floor(Math.random() * Math.max(1, particle.maxAge));
    return particle;
  }

  _clearCanvas() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.texture.needsUpdate = true;
  }

  reset() {
    this._fieldReady = false;
    this._lastFieldSimTimeSeconds = null;
    this._lastGridKey = null;
    this.stepSeconds = this.baseStepSeconds;
    this._initParticles();
    this._clearCanvas();
  }

  _buildField(core) {
    if (!core?.ready) return false;
    const buildStartMs = nowMs();
    let phaseStartMs = buildStartMs;
    const buildPhases = {};
    const { grid, fields } = core;
    if (!grid?.nx || !grid?.ny || !fields?.u || !fields?.v) return false;

    const prevGridKey = this._lastGridKey;
    const gridKey = `${grid.nx}x${grid.ny}`;
    const gridChanged = prevGridKey != null && prevGridKey !== gridKey;
    this._lastGridKey = gridKey;

    const { nx, ny } = grid;
    const gridCount = nx * ny;
    const width = this.width;
    const height = this.height;
    const kmPerDegLat = grid.kmPerDegLat ?? 111.0;
    const cellLonDeg = grid.cellLonDeg;
    const cellLatDeg = grid.cellLatDeg;
    const pixelsPerCellX = width / nx;
    const pixelsPerCellY = height / ny;

    if (!this._uSmooth || this._uSmooth.length !== gridCount) {
      this._uSmooth = new Float32Array(gridCount);
      this._vSmooth = new Float32Array(gridCount);
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let sumU = 0;
        let sumV = 0;
        let count = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = clamp(j + dj, 0, ny - 1);
          const row = jj * nx;
          for (let di = -1; di <= 1; di++) {
            const ii = ((i + di) % nx + nx) % nx;
            const k = row + ii;
            const uVal = fields.u[k];
            const vVal = fields.v[k];
            if (!Number.isFinite(uVal) || !Number.isFinite(vVal)) continue;
            sumU += uVal;
            sumV += vVal;
            count += 1;
          }
        }
        const outIdx = j * nx + i;
        if (count > 0) {
          this._uSmooth[outIdx] = sumU / count;
          this._vSmooth[outIdx] = sumV / count;
        } else {
          this._uSmooth[outIdx] = 0;
          this._vSmooth[outIdx] = 0;
        }
      }
    }
    buildPhases.smoothFieldMs = nowMs() - phaseStartMs;
    phaseStartMs = nowMs();

    this.stepSeconds = this.baseStepSeconds;
    if (!this._fieldDxNext || this._fieldDxNext.length !== width * height) {
      this._fieldDxNext = new Float32Array(width * height);
      this._fieldDyNext = new Float32Array(width * height);
      this._fieldSpeedNext = new Float32Array(width * height);
      this._fieldValidNext = new Uint8Array(width * height);
      this._fieldStepRawNext = new Float32Array(width * height);
    }
    const nextDx = this._fieldDxNext;
    const nextDy = this._fieldDyNext;
    const nextSpeed = this._fieldSpeedNext;
    const nextValid = this._fieldValidNext;
    const nextStepRaw = this._fieldStepRawNext;
    const sampleStride = Math.max(1, Math.floor((width * height) / DEFAULT_DIAG_SAMPLE_TARGET));

    for (let y = 0; y < height; y++) {
      const latIndex = (y / height) * ny;
      const j = Math.max(0, Math.min(ny - 1, Math.floor(latIndex)));
      const latDegRow = Number.isFinite(grid.latDeg?.[j])
        ? grid.latDeg[j]
        : 90 - ((j + 0.5) / ny) * 180;
      const absLat = Math.abs(latDegRow);
      const polarRow = absLat > 85;
      let rowTaper = 1;
      if (absLat >= 80) {
        const t = clamp((absLat - 80) / 5, 0, 1);
        rowTaper = 1 - (t * t * (3 - 2 * t));
      }
      const kmPerDegLon = Math.max(10.0, kmPerDegLat * grid.cosLat[j]);
      for (let x = 0; x < width; x++) {
        const lonIndex = (x / width) * nx;
        const idx = y * width + x;
        if (polarRow) {
          nextValid[idx] = 0;
          nextDx[idx] = 0;
          nextDy[idx] = 0;
          nextSpeed[idx] = 0;
          nextStepRaw[idx] = 0;
          continue;
        }
        const u = bilinear(this._uSmooth, lonIndex, latIndex, nx, ny);
        const v = bilinear(this._vSmooth, lonIndex, latIndex, nx, ny);
        if (!Number.isFinite(u) || !Number.isFinite(v)) {
          nextValid[idx] = 0;
          nextDx[idx] = 0;
          nextDy[idx] = 0;
          nextSpeed[idx] = 0;
          nextStepRaw[idx] = 0;
          continue;
        }
        const speed = Math.hypot(u, v);
        const dLonCells = (u * this.stepSeconds) / (kmPerDegLon * 1000 * cellLonDeg);
        const dLatCells = (v * this.stepSeconds) / (kmPerDegLat * 1000 * cellLatDeg);
        let dx = dLonCells * pixelsPerCellX;
        let dy = -dLatCells * pixelsPerCellY;
        if (rowTaper < 1) {
          dx *= rowTaper;
          dy *= rowTaper;
        }
        const magRaw = Math.hypot(dx, dy);
        if (magRaw > this.maxStepPx && magRaw > 0) {
          const scale = this.maxStepPx / magRaw;
          dx *= scale;
          dy *= scale;
        }
        nextValid[idx] = 1;
        nextDx[idx] = dx;
        nextDy[idx] = dy;
        nextSpeed[idx] = speed;
        nextStepRaw[idx] = magRaw;
      }
    }
    buildPhases.rasterizeFieldMs = nowMs() - phaseStartMs;
    phaseStartMs = nowMs();

    const blend = this._fieldReady && !gridChanged ? 0.25 : 1.0;
    let validCount = 0;
    let clippedCount = 0;
    let sumSpeed = 0;
    let sumStep = 0;
    let sumStepRaw = 0;
    let maxSpeed = 0;
    let maxStep = 0;
    let maxStepRaw = 0;
    const speedSamples = [];
    const stepSamples = [];
    const stepSamplesRaw = [];

    for (let idx = 0; idx < width * height; idx++) {
      if (!nextValid[idx]) {
        this.fieldValid[idx] = 0;
        this.fieldDx[idx] = 0;
        this.fieldDy[idx] = 0;
        this.fieldSpeed[idx] = 0;
        continue;
      }
      let dx = nextDx[idx];
      let dy = nextDy[idx];
      let speed = nextSpeed[idx];
      if (blend < 1) {
        dx = this.fieldDx[idx] + (dx - this.fieldDx[idx]) * blend;
        dy = this.fieldDy[idx] + (dy - this.fieldDy[idx]) * blend;
        speed = this.fieldSpeed[idx] + (speed - this.fieldSpeed[idx]) * blend;
      }
      this.fieldValid[idx] = 1;
      this.fieldDx[idx] = dx;
      this.fieldDy[idx] = dy;
      this.fieldSpeed[idx] = speed;

      const magUsed = Math.hypot(dx, dy);
      const magRaw = nextStepRaw[idx];
      validCount += 1;
      sumSpeed += speed;
      sumStep += magUsed;
      sumStepRaw += magRaw;
      if (speed > maxSpeed) maxSpeed = speed;
      if (magUsed > maxStep) maxStep = magUsed;
      if (magRaw > maxStepRaw) maxStepRaw = magRaw;
      if (magRaw > this.maxStepPx && magRaw > 0) clippedCount += 1;
      if (validCount % sampleStride === 0) {
        speedSamples.push(speed);
        stepSamples.push(magUsed);
        stepSamplesRaw.push(magRaw);
      }
    }
    buildPhases.blendFieldMs = nowMs() - phaseStartMs;
    phaseStartMs = nowMs();

    const speedPct = computePercentiles(speedSamples, [0.5, 0.9, 0.99]);
    const stepPct = computePercentiles(stepSamples, [0.5, 0.9, 0.99]);
    const stepPctRaw = computePercentiles(stepSamplesRaw, [0.5, 0.9, 0.99]);
    this._lastFieldDiagnostics = {
      gridNx: nx,
      gridNy: ny,
      validCount,
      validFrac: validCount / (width * height),
      meanSpeed: validCount > 0 ? sumSpeed / validCount : 0,
      maxSpeed,
      meanStepPx: validCount > 0 ? sumStep / validCount : 0,
      maxStepPx: maxStep,
      meanStepPxRaw: validCount > 0 ? sumStepRaw / validCount : 0,
      maxStepPxRaw: maxStepRaw,
      clippedFrac: validCount > 0 ? clippedCount / validCount : 0,
      speedPercentiles: speedPct,
      stepPercentiles: stepPct,
      stepPercentilesRaw: stepPctRaw,
      stepSeconds: this.stepSeconds,
      maxStepPxLimit: this.maxStepPx
    };

    const currentStepMean = this._lastFieldDiagnostics.meanStepPx;
    const ratio = DESIRED_MEAN_STEP_PX / Math.max(1e-6, currentStepMean);
    const mult = clamp(ratio, ADAPT_STEP_CLAMP_MIN, ADAPT_STEP_CLAMP_MAX);
    const oldStepSeconds = this.stepSeconds;
    const targetStepSeconds = this.baseStepSeconds * mult;
    if (oldStepSeconds > 0 && Math.abs(targetStepSeconds - oldStepSeconds) / oldStepSeconds >= 0.05) {
      const scale = targetStepSeconds / this.baseStepSeconds;
      this.stepSeconds = targetStepSeconds;
      let adjClippedCount = 0;
      let adjSumStep = 0;
      let adjSumStepRaw = 0;
      let adjMaxStep = 0;
      let adjMaxStepRaw = 0;
      const adjStepSamples = [];
      const adjStepSamplesRaw = [];
      let adjValidCount = 0;
      for (let idx = 0; idx < this.fieldDx.length; idx++) {
        if (!this.fieldValid[idx]) continue;
        let dx = this.fieldDx[idx] * scale;
        let dy = this.fieldDy[idx] * scale;
        const magRaw = Math.hypot(dx, dy);
        if (magRaw > this.maxStepPx && magRaw > 0) {
          const scaleClamp = this.maxStepPx / magRaw;
          dx *= scaleClamp;
          dy *= scaleClamp;
          adjClippedCount += 1;
        }
        const magUsed = Math.hypot(dx, dy);
        this.fieldDx[idx] = dx;
        this.fieldDy[idx] = dy;
        adjValidCount += 1;
        adjSumStep += magUsed;
        adjSumStepRaw += magRaw;
        if (magUsed > adjMaxStep) adjMaxStep = magUsed;
        if (magRaw > adjMaxStepRaw) adjMaxStepRaw = magRaw;
        if (adjValidCount % sampleStride === 0) {
          adjStepSamples.push(magUsed);
          adjStepSamplesRaw.push(magRaw);
        }
      }
      const adjStepPct = computePercentiles(adjStepSamples, [0.5, 0.9, 0.99]);
      const adjStepPctRaw = computePercentiles(adjStepSamplesRaw, [0.5, 0.9, 0.99]);
      this._lastFieldDiagnostics = {
        ...this._lastFieldDiagnostics,
        meanStepPx: adjValidCount > 0 ? adjSumStep / adjValidCount : 0,
        maxStepPx: adjMaxStep,
        meanStepPxRaw: adjValidCount > 0 ? adjSumStepRaw / adjValidCount : 0,
        maxStepPxRaw: adjMaxStepRaw,
        clippedFrac: adjValidCount > 0 ? adjClippedCount / adjValidCount : 0,
        stepPercentiles: adjStepPct,
        stepPercentilesRaw: adjStepPctRaw,
        stepSeconds: this.stepSeconds
      };
    }
    buildPhases.adaptiveStepRetuneMs = nowMs() - phaseStartMs;
    phaseStartMs = nowMs();

    const shouldClear = !this._fieldReady || gridChanged;
    this._fieldReady = true;
    if (shouldClear) {
      this._clearCanvas();
    }
    buildPhases.clearCanvasMs = nowMs() - phaseStartMs;
    this._lastBuildPerfDiagnostics = {
      totalMs: nowMs() - buildStartMs,
      phases: buildPhases,
      gridChanged,
      blendFactor: blend,
      sampleStride,
      validCount,
      clippedFrac: this._lastFieldDiagnostics?.clippedFrac ?? null,
      stepSeconds: this._lastFieldDiagnostics?.stepSeconds ?? null
    };
    return true;
  }

  _shouldRebuildField(core, simTimeSeconds) {
    if (!core?.ready) return false;
    const { grid } = core;
    const gridKey = grid ? `${grid.nx}x${grid.ny}` : null;
    if (!this._fieldReady || gridKey !== this._lastGridKey) return true;
    if (!Number.isFinite(simTimeSeconds)) return false;
    if (this._lastFieldSimTimeSeconds == null) return true;
    return (simTimeSeconds - this._lastFieldSimTimeSeconds) >= this.fieldUpdateCadenceSeconds;
  }

  shouldRebuildField({ core, simTimeSeconds } = {}) {
    return this._shouldRebuildField(core, simTimeSeconds);
  }

  update({ core, simTimeSeconds, realDtSeconds } = {}) {
    if (!core?.ready) return;
    const updateStartMs = nowMs();
    const shouldRebuild = this._shouldRebuildField(core, simTimeSeconds);
    let rebuiltField = false;
    let buildPerf = null;
    const finalizePerf = (renderSteps, evolveParticlesMs, evolveParticlesPhases, drawMs, frameDiag) => {
      const fieldAgeSimSeconds = Number.isFinite(simTimeSeconds) && Number.isFinite(this._lastFieldSimTimeSeconds)
        ? simTimeSeconds - this._lastFieldSimTimeSeconds
        : null;
      this._lastPerfDiagnostics = {
        totalMs: nowMs() - updateStartMs,
        fieldRebuildRequested: shouldRebuild,
        fieldRebuilt: rebuiltField,
        buildFieldMs: buildPerf?.totalMs ?? 0,
        buildFieldPhases: buildPerf?.phases ?? null,
        renderSteps,
        evolveParticlesMs,
        evolveParticlesPhases: hasParticleEvolvePhaseData(evolveParticlesPhases)
          ? evolveParticlesPhases
          : null,
        drawMs,
        particleCount: frameDiag?.particleCount ?? this.particles.length,
        fieldCadenceSeconds: this.fieldUpdateCadenceSeconds,
        frameIntervalSeconds: this._frameIntervalSeconds,
        fieldAgeSimSeconds
      };
    };
    if (shouldRebuild) {
      if (this._buildField(core)) {
        this._lastFieldSimTimeSeconds = simTimeSeconds ?? null;
        buildPerf = this._lastBuildPerfDiagnostics;
        rebuiltField = true;
      }
    }
    if (!this._fieldReady) {
      finalizePerf(0, 0, null, 0, null);
      return;
    }
    if (!(realDtSeconds > 0)) {
      finalizePerf(0, 0, null, 0, null);
      return;
    }
    this._frameAccumSeconds += realDtSeconds;
    const steps = Math.min(MAX_RENDER_SUBSTEPS, Math.floor(this._frameAccumSeconds / this._frameIntervalSeconds));
    if (steps <= 0) {
      finalizePerf(0, 0, null, 0, null);
      return;
    }
    this._frameAccumSeconds -= steps * this._frameIntervalSeconds;
    let frameDiag = null;
    let evolveParticlesMs = 0;
    let evolveParticlesPhases = createParticleEvolvePhaseTotals();
    let drawMs = 0;
    for (let i = 0; i < steps; i++) {
      const evolveStartMs = nowMs();
      frameDiag = this._evolveParticles();
      evolveParticlesMs += nowMs() - evolveStartMs;
      evolveParticlesPhases = mergeParticleEvolvePhaseTotals(
        evolveParticlesPhases,
        frameDiag?.perfPhases
      );
      const drawStartMs = nowMs();
      this._draw();
      drawMs += nowMs() - drawStartMs;
    }
    this._lastFrameDiagnostics = {
      ...frameDiag,
      simTimeSeconds: Number.isFinite(simTimeSeconds) ? simTimeSeconds : null
    };
    finalizePerf(steps, evolveParticlesMs, evolveParticlesPhases, drawMs, frameDiag);
  }

  _evolveParticles() {
    const perfPhases = createParticleEvolvePhaseTotals();
    let phaseStartMs = nowMs();
    this.buckets.forEach((bucket) => {
      bucket.length = 0;
    });
    addParticleEvolvePhase(perfPhases, 'clearBucketsMs', nowMs() - phaseStartMs);
    const width = this.width;
    const height = this.height;
    const fieldDx = this.fieldDx;
    const fieldDy = this.fieldDy;
    const fieldSpeed = this.fieldSpeed;
    const fieldValid = this.fieldValid;
    const sample0Scratch = createSampleResult();
    const sample1Scratch = createSampleResult();
    let movedCount = 0;
    let respawnedCount = 0;
    let invalidCount = 0;
    let outOfBoundsCount = 0;

    for (const particle of this.particles) {
      if (particle.age >= particle.maxAge) {
        phaseStartMs = nowMs();
        this._randomizeParticle(particle);
        addParticleEvolvePhase(perfPhases, 'respawnMs', nowMs() - phaseStartMs);
        respawnedCount += 1;
        continue;
      }
      phaseStartMs = nowMs();
      const sample0 = sampleFieldBilinearInRange(
        particle.x,
        particle.y,
        width,
        height,
        fieldDx,
        fieldDy,
        fieldSpeed,
        fieldValid,
        sample0Scratch
      );
      addParticleEvolvePhase(perfPhases, 'sample0Ms', nowMs() - phaseStartMs);
      if (!sample0.valid) {
        particle.age = particle.maxAge;
        invalidCount += 1;
        continue;
      }
      const midX = particle.x + sample0.dx * 0.5;
      const midY = particle.y + sample0.dy * 0.5;
      phaseStartMs = nowMs();
      const sample1 = sampleFieldBilinear(
        midX,
        midY,
        width,
        height,
        fieldDx,
        fieldDy,
        fieldSpeed,
        fieldValid,
        sample1Scratch
      );
      addParticleEvolvePhase(perfPhases, 'sample1Ms', nowMs() - phaseStartMs);
      if (!sample1.valid) {
        particle.age = particle.maxAge;
        invalidCount += 1;
        continue;
      }
      phaseStartMs = nowMs();
      let xt = particle.x + sample1.dx;
      let yt = particle.y + sample1.dy;
      if (!Number.isFinite(xt) || !Number.isFinite(yt)) {
        addParticleEvolvePhase(perfPhases, 'projectValidateMs', nowMs() - phaseStartMs);
        particle.age = particle.maxAge;
        invalidCount += 1;
        continue;
      }
      if (yt < 0 || yt >= height) {
        addParticleEvolvePhase(perfPhases, 'projectValidateMs', nowMs() - phaseStartMs);
        particle.age = particle.maxAge;
        outOfBoundsCount += 1;
        continue;
      }
      xt = (xt >= 0 && xt < width) ? xt : ((xt % width) + width) % width;
      const nextIdx = Math.floor(yt) * width + Math.floor(xt);
      addParticleEvolvePhase(perfPhases, 'projectValidateMs', nowMs() - phaseStartMs);
      if (!fieldValid[nextIdx]) {
        particle.age = particle.maxAge;
        invalidCount += 1;
        continue;
      }
      phaseStartMs = nowMs();
      const dxScreen = xt - particle.x;
      if (Math.abs(dxScreen) > width / 2) {
        particle.x = xt;
        particle.y = yt;
        movedCount += 1;
        particle.age += 1;
        addParticleEvolvePhase(perfPhases, 'bucketStageMs', nowMs() - phaseStartMs);
        continue;
      }
      particle.xt = xt;
      particle.yt = yt;
      this.buckets[this.colorStyles.indexFor(sample1.speed)].push(particle);
      movedCount += 1;
      particle.age += 1;
      addParticleEvolvePhase(perfPhases, 'bucketStageMs', nowMs() - phaseStartMs);
    }

    return {
      particleCount: this.particles.length,
      movedCount,
      respawnedCount,
      invalidCount,
      outOfBoundsCount,
      movedFrac: this.particles.length > 0 ? movedCount / this.particles.length : 0,
      respawnedFrac: this.particles.length > 0 ? respawnedCount / this.particles.length : 0,
      outOfBoundsFrac: this.particles.length > 0 ? outOfBoundsCount / this.particles.length : 0,
      perfPhases
    };
  }

  _draw() {
    const ctx = this.ctx;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = prev;

    ctx.lineWidth = LINE_WIDTH;
    this.buckets.forEach((bucket, i) => {
      if (bucket.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = this.colorStyles[i];
      for (const particle of bucket) {
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.xt, particle.yt);
        particle.x = particle.xt;
        particle.y = particle.yt;
      }
      ctx.stroke();
    });
    this.texture.needsUpdate = true;
  }

  getDiagnostics() {
    return {
      field: this._lastFieldDiagnostics,
      frame: this._lastFrameDiagnostics,
      perf: this._lastPerfDiagnostics
    };
  }
}

export default WindStreamlineRenderer;
