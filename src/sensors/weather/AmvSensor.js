import { SensorBase } from './SensorBase';
import { gaussian01, makeSampleSeed } from './noise';
import { RE_M } from '../../constants';

const RE_KM = RE_M / 1000;
const DEG_TO_RAD = Math.PI / 180;

const wrapRadToPi = (rad) => {
  const twoPi = Math.PI * 2;
  let v = ((rad + Math.PI) % twoPi + twoPi) % twoPi;
  return v - Math.PI;
};
const radialWeight = (distKm, radiusKm) => {
  const t = Math.max(0, Math.min(1, 1 - distKm / Math.max(1e-6, radiusKm)));
  return t * t * (3 - 2 * t);
};

export class AmvSensor extends SensorBase {
  constructor({ worldSeed = 0 } = {}) {
    super({ id: 'amv', cadenceSeconds: 600, observes: ['u', 'v'] });
    this.worldSeed = Number.isFinite(worldSeed) ? worldSeed : 0;
  }

  observe({ truthCore, earth, simTimeSeconds }) {
    if (earth?._sensorGating?.enabledWeatherSensors?.amv !== true) return null;
    if (!truthCore?.ready) return null;
    const fields = truthCore.fields;
    const state = truthCore.state;
    if (!fields?.tauLow || !fields?.tauHigh || !state?.u || !state?.v) return null;
    const gating = earth?._sensorGating;
    const footprints = Array.isArray(gating?.imagingFootprints) ? gating.imagingFootprints : [];
    if (!footprints.length) return null;

    const grid = truthCore.grid;
    const nx = grid?.nx ?? 0;
    const ny = grid?.ny ?? 0;
    const latDeg = grid?.latDeg;
    const lonDeg = grid?.lonDeg;
    if (!nx || !ny || !latDeg || !lonDeg) return null;
    const N = nx * ny;
    const nz = state.nz ?? truthCore.nz ?? 0;
    if (!nz) return null;
    const lev = Math.min(1, nz - 1);

    const uObs = new Float32Array(N);
    const vObs = new Float32Array(N);
    const mask = new Float32Array(N);
    const tQuant = Math.floor(simTimeSeconds / this.cadenceSeconds);
    const fpMeta = footprints
      .filter(fp => Number.isFinite(fp?.latRad) && Number.isFinite(fp?.lonRad) && Number.isFinite(fp?.radiusKm))
      .map(fp => ({ ...fp, cosLat0: Math.cos(fp.latRad) }));
    if (!fpMeta.length) return null;

    for (let j = 0; j < ny; j++) {
      const latRad = latDeg[j] * DEG_TO_RAD;
      const rowOffset = j * nx;
      for (let i = 0; i < nx; i++) {
        const lonRad = lonDeg[i] * DEG_TO_RAD;
        const k = rowOffset + i;

        let coverage = 0;
        for (let f = 0; f < fpMeta.length; f++) {
          const fp = fpMeta[f];
          const dLat = latRad - fp.latRad;
          const dLon = wrapRadToPi(lonRad - fp.lonRad);
          const distKm = RE_KM * Math.sqrt(dLat * dLat + Math.pow(fp.cosLat0 * dLon, 2));
          if (distKm > fp.radiusKm) continue;
          const w = radialWeight(distKm, fp.radiusKm);
          if (w > coverage) coverage = w;
          if (coverage >= 1) break;
        }

        const tauTotal = (fields.tauLow ? fields.tauLow[k] : 0) + (fields.tauHigh ? fields.tauHigh[k] : 0);
        if (coverage <= 0 || tauTotal < 4) {
          mask[k] = 0;
          uObs[k] = 0;
          vObs[k] = 0;
          continue;
        }

        const baseSeed = makeSampleSeed({
          worldSeed: this.worldSeed,
          sensorId: this.id,
          tQuant,
          index: k
        });
        const uNoise = gaussian01(baseSeed + 1.1);
        const vNoise = gaussian01(baseSeed + 2.2);
        const idx = lev * N + k;
        uObs[k] = (state.u[idx] ?? 0) + 2.0 * uNoise;
        vObs[k] = (state.v[idx] ?? 0) + 2.0 * vNoise;
        mask[k] = coverage;
      }
    }

    return {
      sensorId: this.id,
      t: simTimeSeconds,
      products: {
        u: {
          kind: 'grid2d',
          units: 'm/s',
          data: uObs,
          mask,
          meta: { grid: { nx, ny }, levelIndex: lev }
        },
        v: {
          kind: 'grid2d',
          units: 'm/s',
          data: vObs,
          mask,
          meta: { grid: { nx, ny }, levelIndex: lev }
        }
      }
    };
  }
}
