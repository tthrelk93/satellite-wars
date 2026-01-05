import { SensorBase } from './SensorBase';
import { bilinear } from '../../weather/shared/bilinear';
import { gaussian01, hashStringToInt, makeSampleSeed } from './noise';

const STATION_RADIUS_KM = 300;
const DENSE_SURFACE_RADIUS_KM = 450;
const DENSE_SURFACE_SIGMA = 50;

const wrapLon = (lonDeg) => {
  let v = ((lonDeg + 180) % 360 + 360) % 360;
  return v - 180;
};
const clampLat = (latDeg) => Math.max(-89.5, Math.min(89.5, latDeg));

export class SurfaceStationSensor extends SensorBase {
  constructor({ worldSeed = 0 } = {}) {
    super({ id: 'surfaceStations', cadenceSeconds: 300, observes: ['ps'] });
    this.worldSeed = Number.isFinite(worldSeed) ? worldSeed : 0;
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

    const tQuant = Math.floor(simTimeSeconds / this.cadenceSeconds);
    const gating = earth?._sensorGating;
    const surfaceSites = Array.isArray(gating?.surfaceSites) ? gating.surfaceSites : [];
    const noiseCfg = this.noiseModel('ps');
    const sites = surfaceSites.map((site) => {
      const latDeg = clampLat(site.latDeg);
      const lonDeg = wrapLon(site.lonDeg);
      const seedKey = hashStringToInt(site.id ?? `${latDeg.toFixed(3)},${lonDeg.toFixed(3)}`);
      const dense = site.denseSurface === true;
      const radiusKm = dense ? DENSE_SURFACE_RADIUS_KM : STATION_RADIUS_KM;
      const sigma = dense ? Math.min(noiseCfg.sigmaObs, DENSE_SURFACE_SIGMA) : noiseCfg.sigmaObs;
      return { latDeg, lonDeg, radiusKm, sigma, seedKey };
    });

    const count = sites.length;
    const values = new Float32Array(count);
    const sigmaObs = new Float32Array(count);
    const mask = new Float32Array(count);
    const latOut = new Float32Array(count);
    const lonOut = new Float32Array(count);
    const radiusByStation = new Float32Array(count);

    if (count === 0) {
      return {
        sensorId: this.id,
        t: simTimeSeconds,
        products: {
          ps: {
            kind: 'points',
            units: 'Pa',
            data: { latDeg: latOut, lonDeg: lonOut, value: values },
            mask,
            sigmaObs,
            meta: {
              stationRadiusKm: STATION_RADIUS_KM,
              stationRadiusKmByStation: radiusByStation,
              N_STATIONS: 0
            }
          }
        }
      };
    }

    for (let i = 0; i < count; i++) {
      const site = sites[i];
      const lat = site.latDeg;
      const lon = site.lonDeg;
      latOut[i] = lat;
      lonOut[i] = lon;
      mask[i] = 1;
      sigmaObs[i] = site.sigma;
      radiusByStation[i] = site.radiusKm;

      const iF = (lon + 180) / cellLonDeg - 0.5;
      const jF = (90 - lat) / cellLatDeg - 0.5;
      const psTruth = bilinear(state.ps, iF, jF, nx, ny);

      const seed = makeSampleSeed({
        worldSeed: this.worldSeed,
        sensorId: this.id,
        tQuant,
        index: site.seedKey
      });
      const noise = gaussian01(seed);
      const obs = psTruth + noiseCfg.bias + site.sigma * noise;
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
            latDeg: latOut,
            lonDeg: lonOut,
            value: values
          },
          mask,
          sigmaObs,
          meta: {
            stationRadiusKm: STATION_RADIUS_KM,
            stationRadiusKmByStation: radiusByStation,
            N_STATIONS: count
          }
        }
      }
    };
  }
}
