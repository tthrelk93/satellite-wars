import { SensorBase } from './SensorBase';
import { gaussian01, makeSampleSeed } from './noise';
import { RE_M } from '../../constants';

const RADAR_CADENCE_SECONDS = 300;
const RADAR_NOISE_SIGMA = 0.03;
const SERVICE_RADIUS_KM = 2500;
const RE_KM = RE_M / 1000;

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

export class RadarSensor extends SensorBase {
  constructor({ worldSeed = 0 } = {}) {
    super({ id: 'hqRadar', cadenceSeconds: RADAR_CADENCE_SECONDS, observes: ['precipRate'] });
    this.worldSeed = Number.isFinite(worldSeed) ? worldSeed : 0;
  }

  observe({ truthCore, earth, simTimeSeconds }) {
    if (!truthCore?.ready) return null;
    const { grid, fields } = truthCore;
    if (!grid || !fields?.precipRate) return null;

    const radarSites = Array.isArray(earth?._sensorGating?.radarSites)
      ? earth._sensorGating.radarSites
      : [];
    if (radarSites.length === 0) return null;

    const { nx, ny } = grid;
    const N = nx * ny;
    if (!N) return null;

    const values = new Float32Array(N);
    const mask = new Float32Array(N);
    const tQuant = Math.floor(simTimeSeconds / this.cadenceSeconds);
    let coveredCellCount = 0;
    let maxPrecipObserved = 0;

    const latDegArr = grid.latDeg;
    const lonDegArr = grid.lonDeg;

    let serviceAreaW = 0;
    let coveredAreaW = 0;

    for (let j = 0; j < ny; j++) {
      const latDeg = latDegArr ? latDegArr[j] : 90 - (j + 0.5) * (180 / ny);
      const latRad = latDeg * Math.PI / 180;
      const cosLat = Math.cos(latRad);
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        const lonDeg = lonDegArr ? lonDegArr[i] : -180 + (i + 0.5) * (360 / nx);
        const lonRad = lonDeg * Math.PI / 180;
        let inRadar = false;
        let inService = false;
        for (let s = 0; s < radarSites.length; s++) {
          const site = radarSites[s];
          const distKm = equirectDistanceKm(latRad, lonRad, site.latRad, site.lonRad);
          if (distKm <= site.radiusKm) {
            inRadar = true;
          }
          if (distKm <= SERVICE_RADIUS_KM) {
            inService = true;
          }
          if (inRadar && inService) break;
        }
        const k = row + i;
        if (inService) {
          serviceAreaW += Math.max(0, cosLat);
        }
        if (!inRadar) continue;
        mask[k] = 1;
        coveredCellCount += 1;
        coveredAreaW += Math.max(0, cosLat);
        const seed = makeSampleSeed({
          worldSeed: this.worldSeed,
          sensorId: this.id,
          tQuant,
          index: k
        });
        const noise = gaussian01(seed);
        const obs = Math.max(0, fields.precipRate[k] + RADAR_NOISE_SIGMA * noise);
        values[k] = obs;
        if (obs > maxPrecipObserved) maxPrecipObserved = obs;
      }
    }

    const coveredFracService = serviceAreaW > 0 ? coveredAreaW / serviceAreaW : 0;
    earth?.logWeatherEvent?.(
      'radarObs',
      {
        t: simTimeSeconds,
        coveredCellCount,
        coveredFracService,
        maxPrecipObserved
      },
      { simTimeSeconds }
    );

    return {
      sensorId: this.id,
      t: simTimeSeconds,
      products: {
        precipRate: {
          kind: 'grid2d',
          units: 'mm/hr',
          data: values,
          mask,
          meta: {
            coveredCellCount,
            coveredFracService
          }
        }
      },
      meta: {
        coveredCellCount,
        coveredFracService,
        maxPrecipObserved
      }
    };
  }
}
