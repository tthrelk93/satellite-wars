import { SensorBase } from './SensorBase';
import { gaussian01, hashStringToInt, makeSampleSeed } from './noise';

const wrapLon = (lonDeg) => {
  let v = ((lonDeg + 180) % 360 + 360) % 360;
  return v - 180;
};

export class SoundingSensor extends SensorBase {
  constructor({ worldSeed = 0 } = {}) {
    super({ id: 'soundings', cadenceSeconds: 21600, observes: ['u', 'v', 'qv'] });
    this.worldSeed = Number.isFinite(worldSeed) ? worldSeed : 0;
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

    const tQuant = Math.floor(simTimeSeconds / this.cadenceSeconds);
    const gating = earth?._sensorGating;
    const radiosondeSites = Array.isArray(gating?.radiosondeSites) ? gating.radiosondeSites : [];
    const sites = radiosondeSites.map((site) => ({
      id: site.id,
      latDeg: site.latDeg,
      lonDeg: wrapLon(site.lonDeg)
    }));

    const count = sites.length * levels.length;
    const latOut = new Float32Array(count);
    const lonOut = new Float32Array(count);
    const levelOut = new Int16Array(count);
    const uOut = new Float32Array(count);
    const vOut = new Float32Array(count);
    const qvOut = new Float32Array(count);
    const mask = new Float32Array(count);
    const sigmaU = new Float32Array(count);
    const sigmaQv = new Float32Array(count);

    if (sites.length === 0) {
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

    let idxOut = 0;
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      const lat = site.latDeg;
      const lon = site.lonDeg;
      const iF = (lon + 180) / cellLonDeg - 0.5;
      const jF = (90 - lat) / cellLatDeg - 0.5;
      const iCell = Math.max(0, Math.min(nx - 1, Math.round(iF)));
      const jCell = Math.max(0, Math.min(ny - 1, Math.round(jF)));
      const k2d = jCell * nx + iCell;
      const siteSeed = hashStringToInt(site.id ?? `${lat.toFixed(3)},${lon.toFixed(3)}`);
      const baseSeed = makeSampleSeed({
        worldSeed: this.worldSeed,
        sensorId: this.id,
        tQuant,
        index: siteSeed
      });

      for (let l = 0; l < levels.length; l++) {
        const lev = levels[l];
        const k3d = lev * nx * ny + k2d;
        latOut[idxOut] = lat;
        lonOut[idxOut] = lon;
        levelOut[idxOut] = lev;
        sigmaU[idxOut] = 2.0;
        sigmaQv[idxOut] = 0.001;
        const seed = baseSeed + l * 7.1;
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
