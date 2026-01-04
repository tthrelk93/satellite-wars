import { SensorBase } from './SensorBase';
import { gaussian01, hash01, makeSampleSeed } from './noise';
import { RE_M } from '../../constants';

const N_STATIONS = 80;
const STATION_LAT_MIN = -70;
const STATION_LAT_MAX = 70;
const GROUND_ACCESS_RADIUS_KM = 1500;
const RE_KM = RE_M / 1000;
const DEG_TO_RAD = Math.PI / 180;

const wrapLon = (lonDeg) => {
  let v = ((lonDeg + 180) % 360 + 360) % 360;
  return v - 180;
};
const wrapRadToPi = (rad) => {
  const twoPi = Math.PI * 2;
  let v = ((rad + Math.PI) % twoPi + twoPi) % twoPi;
  return v - Math.PI;
};
const equirectDistanceKm = (lat0Rad, lon0Rad, lat1Rad, lon1Rad) => {
  const dLat = lat1Rad - lat0Rad;
  const dLon = wrapRadToPi(lon1Rad - lon0Rad);
  const x = dLon * Math.cos((lat0Rad + lat1Rad) * 0.5);
  const y = dLat;
  return RE_KM * Math.sqrt(x * x + y * y);
};

export class SoundingSensor extends SensorBase {
  constructor({ worldSeed = 0 } = {}) {
    super({ id: 'soundings', cadenceSeconds: 21600, observes: ['u', 'v', 'qv'] });
    this.worldSeed = Number.isFinite(worldSeed) ? worldSeed : 0;
    this.stationLatDeg = new Float32Array(N_STATIONS);
    this.stationLonDeg = new Float32Array(N_STATIONS);
    this._initStations();
  }

  _initStations() {
    const seedBase = this.worldSeed + 2007;
    const latSpan = STATION_LAT_MAX - STATION_LAT_MIN;
    for (let i = 0; i < N_STATIONS; i++) {
      const rLat = hash01(seedBase + i * 12.9898);
      const rLon = hash01(seedBase + i * 78.233);
      this.stationLatDeg[i] = STATION_LAT_MIN + latSpan * rLat;
      this.stationLonDeg[i] = -180 + 360 * rLon;
    }
  }

  observe({ truthCore, earth, simTimeSeconds }) {
    if (earth?._sensorGating?.enabledWeatherSensors?.soundings !== true) return null;
    if (!truthCore?.ready) return null;
    const { grid, state } = truthCore;
    if (!grid || !state?.u || !state?.v || !state?.qv) return null;
    const { nx, ny, cellLonDeg, cellLatDeg } = grid;
    if (!nx || !ny || !cellLonDeg || !cellLatDeg) return null;
    const nz = state.nz ?? truthCore.nz ?? 0;
    if (!nz) return null;

    const levelFracs = [0.2, 0.5, 0.8];
    const levels = levelFracs
      .map(f => Math.max(0, Math.min(nz - 1, Math.round(f * (nz - 1)))))
      .filter((v, idx, arr) => arr.indexOf(v) === idx);

    const count = N_STATIONS * levels.length;
    const latOut = new Float32Array(count);
    const lonOut = new Float32Array(count);
    const levelOut = new Int16Array(count);
    const uOut = new Float32Array(count);
    const vOut = new Float32Array(count);
    const qvOut = new Float32Array(count);
    const mask = new Float32Array(count);
    const sigmaU = new Float32Array(count);
    const sigmaQv = new Float32Array(count);
    const tQuant = Math.floor(simTimeSeconds / this.cadenceSeconds);
    const gating = earth?._sensorGating;
    const hasComms = gating?.hasComms === true;
    const hqSites = Array.isArray(gating?.hqSites) ? gating.hqSites : [];

    let idxOut = 0;
    for (let i = 0; i < N_STATIONS; i++) {
      const lat = this.stationLatDeg[i];
      const lon = wrapLon(this.stationLonDeg[i]);
      let valid = hasComms;
      if (!valid && hqSites.length) {
        const latRad = lat * DEG_TO_RAD;
        const lonRad = lon * DEG_TO_RAD;
        for (let h = 0; h < hqSites.length; h++) {
          const hq = hqSites[h];
          const distKm = equirectDistanceKm(latRad, lonRad, hq.latRad, hq.lonRad);
          if (distKm <= GROUND_ACCESS_RADIUS_KM) {
            valid = true;
            break;
          }
        }
      }

      const iF = (lon + 180) / cellLonDeg - 0.5;
      const jF = (90 - lat) / cellLatDeg - 0.5;
      const iCell = Math.max(0, Math.min(nx - 1, Math.round(iF)));
      const jCell = Math.max(0, Math.min(ny - 1, Math.round(jF)));
      const k2d = jCell * nx + iCell;

      for (let l = 0; l < levels.length; l++) {
        const lev = levels[l];
        const k3d = lev * nx * ny + k2d;
        latOut[idxOut] = lat;
        lonOut[idxOut] = lon;
        levelOut[idxOut] = lev;
        sigmaU[idxOut] = 2.0;
        sigmaQv[idxOut] = 0.001;
        if (!valid) {
          mask[idxOut] = 0;
          uOut[idxOut] = 0;
          vOut[idxOut] = 0;
          qvOut[idxOut] = 0;
          idxOut += 1;
          continue;
        }
        const seed = makeSampleSeed({
          worldSeed: this.worldSeed,
          sensorId: this.id,
          tQuant,
          index: idxOut
        });
        const uNoise = gaussian01(seed + 1.1);
        const vNoise = gaussian01(seed + 2.2);
        const qNoise = gaussian01(seed + 3.3);
        uOut[idxOut] = (state.u[k3d] ?? 0) + 2.0 * uNoise;
        vOut[idxOut] = (state.v[k3d] ?? 0) + 2.0 * vNoise;
        const qVal = (state.qv[k3d] ?? 0) + 0.001 * qNoise;
        qvOut[idxOut] = Math.max(0, qVal);
        mask[idxOut] = 1;
        idxOut += 1;
      }
    }

    return {
      sensorId: this.id,
      t: simTimeSeconds,
      products: {
        u: {
          kind: 'points',
          units: 'm/s',
          data: { latDeg: latOut, lonDeg: lonOut, levelIndex: levelOut, value: uOut },
          mask,
          sigmaObs: sigmaU,
          meta: { levels }
        },
        v: {
          kind: 'points',
          units: 'm/s',
          data: { latDeg: latOut, lonDeg: lonOut, levelIndex: levelOut, value: vOut },
          mask,
          sigmaObs: sigmaU,
          meta: { levels }
        },
        qv: {
          kind: 'points',
          units: 'kg/kg',
          data: { latDeg: latOut, lonDeg: lonOut, levelIndex: levelOut, value: qvOut },
          mask,
          sigmaObs: sigmaQv,
          meta: { levels }
        }
      }
    };
  }
}
