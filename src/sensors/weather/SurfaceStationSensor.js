import { SensorBase } from './SensorBase';
import { bilinear } from '../../weather/shared/bilinear';
import { gaussian01, hash01, makeSampleSeed } from './noise';
import { RE_M } from '../../constants';

const N_STATIONS = 400;
const STATION_LAT_MIN = -70;
const STATION_LAT_MAX = 70;
const STATION_RADIUS_KM = 300;
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

export class SurfaceStationSensor extends SensorBase {
  constructor({ worldSeed = 0 } = {}) {
    super({ id: 'surfaceStations', cadenceSeconds: 300, observes: ['ps'] });
    this.worldSeed = Number.isFinite(worldSeed) ? worldSeed : 0;
    this.stationRadiusKm = STATION_RADIUS_KM;
    this.stationLatDeg = new Float32Array(N_STATIONS);
    this.stationLonDeg = new Float32Array(N_STATIONS);
    this._initStations();
  }

  _initStations() {
    const seedBase = this.worldSeed + 1001;
    const latSpan = STATION_LAT_MAX - STATION_LAT_MIN;
    for (let i = 0; i < N_STATIONS; i++) {
      const rLat = hash01(seedBase + i * 12.9898);
      const rLon = hash01(seedBase + i * 78.233);
      this.stationLatDeg[i] = STATION_LAT_MIN + latSpan * rLat;
      this.stationLonDeg[i] = -180 + 360 * rLon;
    }
  }

  noiseModel() {
    return { bias: 0, sigmaObs: 80, kind: 'add' };
  }

  observe({ truthCore, earth, simTimeSeconds }) {
    if (!truthCore?.ready) return null;
    const { grid, state } = truthCore;
    if (!grid || !state?.ps) return null;

    const { nx, ny, cellLonDeg, cellLatDeg } = grid;
    if (!nx || !ny || !cellLonDeg || !cellLatDeg) return null;

    const dense = earth?._sensorGating?.enabledWeatherSensors?.denseSurface === true;
    const stationRadiusKm = dense ? 450 : STATION_RADIUS_KM;
    const noiseCfg = this.noiseModel('ps');
    const sigmaValue = dense ? 50 : noiseCfg.sigmaObs;
    this.stationRadiusKm = stationRadiusKm;

    const values = new Float32Array(N_STATIONS);
    const sigmaObs = new Float32Array(N_STATIONS);
    const mask = new Float32Array(N_STATIONS);
    const tQuant = Math.floor(simTimeSeconds / this.cadenceSeconds);
    const gating = earth?._sensorGating;
    const hasComms = gating?.hasComms === true;
    const hqSites = Array.isArray(gating?.hqSites) ? gating.hqSites : [];

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
      mask[i] = valid ? 1 : 0;
      sigmaObs[i] = sigmaValue;
      if (!valid) {
        values[i] = 0;
        continue;
      }

      const iF = (lon + 180) / cellLonDeg - 0.5;
      const jF = (90 - lat) / cellLatDeg - 0.5;
      const psTruth = bilinear(state.ps, iF, jF, nx, ny);

      const seed = makeSampleSeed({
        worldSeed: this.worldSeed,
        sensorId: this.id,
        tQuant,
        index: i
      });
      const noise = gaussian01(seed);
      const obs = psTruth + noiseCfg.bias + sigmaValue * noise;
      values[i] = obs;
    }

    return {
      sensorId: this.id,
      t: simTimeSeconds,
      products: {
        ps: {
          kind: 'points',
          units: 'Pa',
          data: {
            latDeg: this.stationLatDeg,
            lonDeg: this.stationLonDeg,
            value: values
          },
          mask,
          sigmaObs,
          meta: {
            stationRadiusKm,
            N_STATIONS
          }
        }
      }
    };
  }
}
