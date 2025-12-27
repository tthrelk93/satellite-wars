import { saturationMixingRatio } from './surface';
import { bilinear } from './advect';

const KM_PER_DEG_LAT = 111.0;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const wrapLonDeg = (lon) => {
  let v = ((lon + 180) % 360 + 360) % 360;
  return v - 180;
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const latLonToIdx = (lonDeg, latDeg, grid) => {
  const i = (lonDeg + 180) / grid.cellLonDeg - 0.5;
  const j = (90 - latDeg) / grid.cellLatDeg - 0.5;
  return { i, j };
};

const sampleField = (field, lonDeg, latDeg, grid) => {
  const { i, j } = latLonToIdx(lonDeg, latDeg, grid);
  return bilinear(field, i, j, grid.nx, grid.ny);
};

const nearestIndex = (lonDeg, latDeg, grid) => {
  const i = Math.round((lonDeg + 180) / grid.cellLonDeg - 0.5);
  const j = Math.round((90 - latDeg) / grid.cellLatDeg - 0.5);
  const ii = (i % grid.nx + grid.nx) % grid.nx;
  const jj = Math.max(0, Math.min(grid.ny - 1, j));
  return jj * grid.nx + ii;
};

const seasonFactor = (timeUTC) => {
  const dayOfYear = (((timeUTC / 86400) % 365) + 365) % 365;
  const rampUp = smoothstep(150, 180, dayOfYear);
  const rampDown = 1 - smoothstep(320, 350, dayOfYear);
  const peak = Math.exp(-Math.pow((dayOfYear - 255) / 30, 2));
  return rampUp * rampDown * peak;
};

export class TropicalCycloneSystem {
  constructor(seed = 1) {
    this.storms = [];
    this.nextStormId = 1;
    this.genesisAccumSeconds = 0;
    this.lastGenesisTimeSeconds = -Infinity;
    this.setSeed(seed);
  }

  setSeed(seed) {
    const base = Number.isFinite(seed) ? seed : 1;
    this.rng = mulberry32((base + 1337) >>> 0);
    this.storms = [];
    this.nextStormId = 1;
    this.genesisAccumSeconds = 0;
    this.lastGenesisTimeSeconds = -Infinity;
  }

  resetTime() {
    this.genesisAccumSeconds = 0;
    this.lastGenesisTimeSeconds = -Infinity;
  }

  getStormSummary(limit = 5) {
    const active = this.storms.filter(s => s.alive);
    return {
      stormCount: active.length,
      storms: active.slice(0, limit).map(s => ({
        id: s.id,
        lat: s.latDeg,
        lon: s.lonDeg,
        vmax: s.vmax
      }))
    };
  }

  step({ dt, timeUTC, grid, fields, geo, dynParams }) {
    if (!grid || !fields || !geo) return;
    const { tcMask } = fields;
    if (tcMask) {
      tcMask.fill(0);
    }
    const season = seasonFactor(timeUTC);

    this._updateStorms({ dt, timeUTC, season, grid, fields, geo, dynParams });

    this.genesisAccumSeconds += dt;
    if (this.genesisAccumSeconds >= 6 * 3600) {
      this.genesisAccumSeconds = 0;
      this._scanGenesis({ timeUTC, season, grid, fields, geo });
    }
  }

  _scanGenesis({ timeUTC, season, grid, fields, geo }) {
    const { nx, ny, latDeg, lonDeg, cellLonDeg, cellLatDeg, cosLat } = grid;
    const { tcGenesis } = fields;
    const { sstNow, landMask, iceNow } = geo;
    if (!tcGenesis || !sstNow || !landMask) return;
    tcGenesis.fill(0);
    if (season <= 0) return;

    const MAX_STORMS = 5;
    const G_MIN = 0.05;
    const GENESIS_RATE = 1.0;
    const minDistanceKm = 600;
    const minGenesisInterval = 2 * 86400;
    if (this.storms.filter(s => s.alive).length >= MAX_STORMS) return;
    if (timeUTC - this.lastGenesisTimeSeconds < minGenesisInterval) return;

    let sumG = 0;
    const candidates = [];

    for (let j = 0; j < ny; j++) {
      const lat = latDeg[j];
      if (lat < 5 || lat > 30) continue;
      const latAbs = Math.abs(lat);
      const kmPerDegLon = Math.max(1.0, KM_PER_DEG_LAT * cosLat[j]);
      const invDx = 1 / (kmPerDegLon * 1000 * cellLonDeg);
      const invDy = 1 / (KM_PER_DEG_LAT * 1000 * cellLatDeg);
      for (let i = 0; i < nx; i++) {
        const lon = lonDeg[i];
        if (lon < -100 || lon > -10) continue;
        const k = j * nx + i;
        if (landMask[k] === 1) continue;
        if (iceNow && iceNow[k] > 0.15) continue;

        const G = this._computeGenesisIndex({
          i,
          j,
          k,
          grid,
          fields,
          sstNow,
          season,
          invDx,
          invDy,
          latAbs
        });
        tcGenesis[k] = G;
        if (G > 0) {
          sumG += G;
          candidates.push({ k, G, lat, lon });
        }
      }
    }

    if (sumG <= 0) return;
    let pick = this.rng() * sumG;
    let candidate = null;
    for (const c of candidates) {
      pick -= c.G;
      if (pick <= 0) {
        candidate = c;
        break;
      }
    }
    if (!candidate) return;
    if (candidate.G < G_MIN) return;

    for (const storm of this.storms) {
      if (!storm.alive) continue;
      const dLon = wrapLonDeg(candidate.lon - storm.lonDeg);
      const dLat = candidate.lat - storm.latDeg;
      const kmPerDegLon = KM_PER_DEG_LAT * Math.cos((candidate.lat * Math.PI) / 180);
      const dx = dLon * kmPerDegLon;
      const dy = dLat * KM_PER_DEG_LAT;
      const dist = Math.hypot(dx, dy);
      if (dist < minDistanceKm) {
        return;
      }
    }

    const pSpawn = clamp(1 - Math.exp(-GENESIS_RATE * candidate.G), 0, 1);
    if (this.rng() > pSpawn) return;

    this.storms.push({
      id: this.nextStormId++,
      latDeg: candidate.lat,
      lonDeg: candidate.lon,
      vmax: 15,
      radiusKm: 600,
      ageSeconds: 0,
      weakSeconds: 0,
      alive: true,
      phase: 0
    });
    this.lastGenesisTimeSeconds = timeUTC;
  }

  debugSpawnBestCaribbean({ timeUTC, grid, fields, geo }) {
    if (!grid || !fields || !geo) return;
    const { nx, ny, latDeg, lonDeg, cellLonDeg, cellLatDeg, cosLat } = grid;
    const { tcGenesis } = fields;
    const { sstNow, landMask, iceNow } = geo;
    if (!sstNow || !landMask) return;
    if (tcGenesis) tcGenesis.fill(0);
    let best = null;
    let bestG = 0;
    const season = 1;

    for (let j = 0; j < ny; j++) {
      const lat = latDeg[j];
      if (lat < 5 || lat > 30) continue;
      const latAbs = Math.abs(lat);
      const kmPerDegLon = Math.max(1.0, KM_PER_DEG_LAT * cosLat[j]);
      const invDx = 1 / (kmPerDegLon * 1000 * cellLonDeg);
      const invDy = 1 / (KM_PER_DEG_LAT * 1000 * cellLatDeg);
      for (let i = 0; i < nx; i++) {
        const lon = lonDeg[i];
        if (lon < -100 || lon > -10) continue;
        const k = j * nx + i;
        if (landMask[k] === 1) continue;
        if (iceNow && iceNow[k] > 0.15) continue;
        const G = this._computeGenesisIndex({
          i,
          j,
          k,
          grid,
          fields,
          sstNow,
          season,
          invDx,
          invDy,
          latAbs
        });
        if (tcGenesis) tcGenesis[k] = G;
        if (G > bestG) {
          bestG = G;
          best = { lat, lon };
        }
      }
    }

    const fallback = { lat: 15, lon: -60 };
    const spawn = best || fallback;
    this.storms.push({
      id: this.nextStormId++,
      latDeg: spawn.lat,
      lonDeg: spawn.lon,
      vmax: 22,
      radiusKm: 500,
      ageSeconds: 0,
      weakSeconds: 0,
      alive: true,
      phase: 0
    });
  }

  debugSpawnHurricane({ latDeg = 15, lonDeg = -60, vmax = 35, radiusKm = 450 } = {}) {
    this.storms.push({
      id: this.nextStormId++,
      latDeg,
      lonDeg,
      vmax,
      radiusKm,
      ageSeconds: 0,
      weakSeconds: 0,
      alive: true,
      phase: 0
    });
  }

  _computeGenesisIndex({ i, j, k, grid, fields, sstNow, season, invDx, invDy, latAbs }) {
    const { nx, sinLat } = grid;
    const { u, v, uU, vU, qvU, TU } = fields;
    const iE = (i + 1) % nx;
    const iW = (i - 1 + nx) % nx;
    const jN = Math.max(0, j - 1);
    const jS = Math.min(grid.ny - 1, j + 1);
    const kE = j * nx + iE;
    const kW = j * nx + iW;
    const kN = jN * nx + i;
    const kS = jS * nx + i;
    const dvdx = (v[kE] - v[kW]) * 0.5 * invDx;
    const dudy = (u[kN] - u[kS]) * 0.5 * invDy;
    const vort = dvdx - dudy;

    const sst = sstNow[k];
    const rhu = qvU[k] / Math.max(1e-8, saturationMixingRatio(TU[k], 50000));
    const shear = Math.hypot(uU[k] - u[k], vU[k] - v[k]);
    const fSign = sinLat[j] >= 0 ? 1 : -1;

    const sstFac = smoothstep(299.5, 302.5, sst);
    const corFac = smoothstep(5, 12, latAbs) * (1 - smoothstep(30, 35, latAbs));
    const humFac = smoothstep(0.35, 0.55, rhu);
    const shearFac = 1 - smoothstep(10, 20, shear);
    const vortFac = smoothstep(5e-7, 3e-6, fSign * vort);
    let G = season * sstFac * corFac * humFac * shearFac * vortFac;
    G = Math.pow(G, 1.2);
    return G;
  }

  _updateStorms({ dt, timeUTC, season, grid, fields, geo, dynParams }) {
    const { u, v, uU, vU, omegaL, omegaU, hL, hU, qv, qvU, TU, tcMask } = fields;
    const { sstNow, landMask, iceNow } = geo;
    if (!sstNow || !landMask) return;
    const maxWind = dynParams?.maxWind ?? 150;
    const hMin = dynParams?.hMin ?? 500;
    const omegaClamp = 0.05;
    this._ensureWindScratch(u.length);
    const windScratch = this._windScratch;
    windScratch.uBase.set(u);
    windScratch.vBase.set(v);
    windScratch.uUBase.set(uU);
    windScratch.vUBase.set(vU);
    windScratch.du.fill(0);
    windScratch.dv.fill(0);
    windScratch.duU.fill(0);
    windScratch.dvU.fill(0);

    for (const storm of this.storms) {
      if (!storm.alive) continue;
      storm.ageSeconds += dt;

      const uSteer = sampleField(windScratch.uUBase, storm.lonDeg, storm.latDeg, grid);
      const vSteer = sampleField(windScratch.vUBase, storm.lonDeg, storm.latDeg, grid);
      const latRad = (storm.latDeg * Math.PI) / 180;
      const cosLat = Math.max(0.1, Math.cos(latRad));
      const dLatDeg = (vSteer * dt) / (KM_PER_DEG_LAT * 1000);
      const dLonDeg = (uSteer * dt) / (KM_PER_DEG_LAT * 1000 * cosLat);
      const hemiSign = storm.latDeg >= 0 ? 1 : -1;
      const betaLat = hemiSign * 0.02 * (dt / 86400);
      const betaLon = -0.05 * (dt / 86400);

      storm.latDeg = clamp(storm.latDeg + dLatDeg + betaLat, -89, 89);
      storm.lonDeg = wrapLonDeg(storm.lonDeg + dLonDeg + betaLon);

      const sst = sampleField(sstNow, storm.lonDeg, storm.latDeg, grid);
      const land = (() => {
        const k = nearestIndex(storm.lonDeg, storm.latDeg, grid);
        return landMask[k] === 1;
      })();
      const qvUCenter = sampleField(fields.qvU, storm.lonDeg, storm.latDeg, grid);
      const TUCenter = sampleField(fields.TU, storm.lonDeg, storm.latDeg, grid);
      const rhu = qvUCenter / Math.max(1e-8, saturationMixingRatio(TUCenter, 50000));
      const uL = sampleField(windScratch.uBase, storm.lonDeg, storm.latDeg, grid);
      const vL = sampleField(windScratch.vBase, storm.lonDeg, storm.latDeg, grid);
      const shear = Math.hypot(uSteer - uL, vSteer - vL);
      const latAbs = Math.abs(storm.latDeg);
      const corFac = smoothstep(5, 12, latAbs) * (1 - smoothstep(30, 35, latAbs));
      const pi = smoothstep(298.8, 303.0, sst);
      const shearPenalty = smoothstep(12, 25, shear);
      const coldPenalty = smoothstep(299.5, 297.0, sst);

      const humFac = smoothstep(0.35, 0.55, rhu);
      const env = pi * humFac * (1 - shearPenalty) * corFac;
      const vTarget = lerp(18, 90, env);
      const tauSpinup = 6 * 3600;
      storm.vmax += (vTarget - storm.vmax) * (dt / tauSpinup);

      const tauDecayBase = 10 * 86400;
      const tauDecayLand = 18 * 3600;
      const tauDecayCold = lerp(tauDecayBase, 18 * 3600, coldPenalty);
      let tauDecay = tauDecayBase;
      if (land) tauDecay = Math.min(tauDecay, tauDecayLand);
      tauDecay = Math.min(tauDecay, tauDecayCold);
      storm.vmax -= storm.vmax * (dt / tauDecay);
      storm.vmax = clamp(storm.vmax, 0, 80);

      if (storm.vmax < 10) {
        storm.weakSeconds += dt;
      } else {
        storm.weakSeconds = 0;
      }

      storm.radiusKm = clamp(600 + 4 * (storm.vmax - 15), 400, 1400);

      const lat = storm.latDeg;
      const lon = storm.lonDeg;
      const radius = storm.radiusKm;
      const Rm = 0.35 * radius;
      const hemi = storm.latDeg >= 0 ? 1 : -1;
      const maxPhaseRate = 0.004;
      const phaseRate = clamp((storm.vmax / Math.max(100, Rm) / 1000), -maxPhaseRate, maxPhaseRate);
      storm.phase = (storm.phase || 0) + hemi * phaseRate * dt;
      const maskNorm = Math.min(1, storm.vmax / 60);
      for (let j = 0; j < grid.ny; j++) {
        const latCell = grid.latDeg[j];
        const kmPerDegLon = KM_PER_DEG_LAT * grid.cosLat[j];
        for (let i = 0; i < grid.nx; i++) {
          const lonCell = grid.lonDeg[i];
          let dLon = wrapLonDeg(lonCell - lon);
          const dx = dLon * kmPerDegLon;
          const dy = (latCell - lat) * KM_PER_DEG_LAT;
          const r = Math.hypot(dx, dy);
          if (r > radius * 1.2) continue;
          const k = j * grid.nx + i;
          const rr = Math.max(1e-3, r);
          const tx = -dy / rr;
          const ty = dx / rr;
          const rx = -dx / rr;
          const ry = -dy / rr;

          if (r <= radius) {
            const profile = (r / Rm) * Math.exp(1 - r / Rm);
            const vTang = storm.vmax * profile;
            const vIn = storm.vmax * 0.15 * Math.exp(-Math.pow(r / (0.7 * radius), 2));
            const sign = grid.sinLat[j] >= 0 ? 1 : -1;
            windScratch.du[k] += sign * vTang * tx + vIn * rx;
            windScratch.dv[k] += sign * vTang * ty + vIn * ry;
          }

          const outflow = Math.exp(-Math.pow(r / (1.2 * radius), 2));
          if (outflow > 0.01) {
            const sign = grid.sinLat[j] >= 0 ? 1 : -1;
            const vTangU = storm.vmax * 0.15 * outflow;
            windScratch.duU[k] += sign * vTangU * tx;
            windScratch.dvU[k] += sign * vTangU * ty;
          }

          if (r < 0.4 * radius && landMask[k] === 0 && (!iceNow || iceNow[k] < 0.15) && sst >= 299.5) {
            const pump = 0.002;
            hL[k] = Math.max(hMin, hL[k] - pump * dt);
            hU[k] = Math.max(hMin, hU[k] + pump * dt * 0.7);
          }

          if (omegaL && omegaU) {
            const theta = Math.atan2(dy, dx);
            const spiral = 0.65 + 0.35 * Math.sin(2 * theta + (r / (0.25 * radius)) - storm.phase);
            const profile = (r / Rm) * Math.exp(1 - r / Rm);
            const eyeFactor = r < 0.4 * Rm ? (r / (0.4 * Rm)) : 1;
            const ring = profile * eyeFactor;
            const omegaBoostL = 0.0015 * (storm.vmax / 40) * ring * spiral;
            const omegaBoostU = 0.006 * (storm.vmax / 40) * ring * spiral;
            omegaL[k] = clamp(omegaL[k] + omegaBoostL, -omegaClamp, omegaClamp);
            omegaU[k] = clamp(omegaU[k] + omegaBoostU, -omegaClamp, omegaClamp);
          }

          if (tcMask) {
            const mask = maskNorm * Math.exp(-Math.pow(r / (0.7 * radius), 2));
            tcMask[k] = Math.max(tcMask[k], mask);
          }

          if (r < 0.6 * radius && landMask[k] === 0 && (!iceNow || iceNow[k] < 0.15)) {
            const sstCell = sstNow[k];
            if (sstCell >= 299.5) {
              const rhuTarget = 0.65 + 0.1 * Math.min(1, storm.vmax / 50);
              const qvUTarget = rhuTarget * saturationMixingRatio(TU[k], 50000);
              if (qvU[k] < qvUTarget && qv[k] > 0) {
                const tauMoist = 12 * 3600;
                const transfer = Math.min(qv[k], (qvUTarget - qvU[k]) * (dt / tauMoist));
                qv[k] -= transfer;
                qvU[k] += transfer;
              }
            }
          }
        }
      }

      if (storm.weakSeconds > 86400 || season < 0.05) {
        storm.alive = false;
      }
    }

    for (let k = 0; k < u.length; k++) {
      let uNew = windScratch.uBase[k] + windScratch.du[k];
      let vNew = windScratch.vBase[k] + windScratch.dv[k];
      const speed = Math.hypot(uNew, vNew);
      if (speed > maxWind) {
        const s = maxWind / speed;
        uNew *= s;
        vNew *= s;
      }
      u[k] = uNew;
      v[k] = vNew;

      let uUNew = windScratch.uUBase[k] + windScratch.duU[k];
      let vUNew = windScratch.vUBase[k] + windScratch.dvU[k];
      const speedU = Math.hypot(uUNew, vUNew);
      if (speedU > maxWind) {
        const s = maxWind / speedU;
        uUNew *= s;
        vUNew *= s;
      }
      uU[k] = uUNew;
      vU[k] = vUNew;
    }

    this.storms = this.storms.filter(s => s.alive);
  }

  _ensureWindScratch(count) {
    if (this._windScratch && this._windScratch.count === count) return;
    this._windScratch = {
      count,
      uBase: new Float32Array(count),
      vBase: new Float32Array(count),
      uUBase: new Float32Array(count),
      vUBase: new Float32Array(count),
      du: new Float32Array(count),
      dv: new Float32Array(count),
      duU: new Float32Array(count),
      dvU: new Float32Array(count)
    };
  }
}
