import { SensorBase } from './SensorBase';
import { gaussian01, hash01, makeSampleSeed } from './noise';
import { RE_M, CLOUD_WATCH_GRID_LON_OFFSET_RAD } from '../../constants';

const TAU_THIN = 1.0;
const THIN_MISS_PROB = 0.30;
const RE_KM = RE_M / 1000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const wrapRadToPi = (rad) => {
  const twoPi = Math.PI * 2;
  let v = ((rad + Math.PI) % twoPi + twoPi) % twoPi;
  return v - Math.PI;
};
const radialWeight = (distKm, radiusKm) => {
  const t = Math.max(0, Math.min(1, 1 - distKm / Math.max(1e-6, radiusKm)));
  return t * t * (3 - 2 * t);
};

export class CloudSatSensor extends SensorBase {
  constructor({ worldSeed = 0 } = {}) {
    super({
      id: 'cloudSat',
      cadenceSeconds: 600,
      observes: ['tauLow', 'tauHigh', 'cloudLow', 'cloudHigh']
    });
    this.worldSeed = Number.isFinite(worldSeed) ? worldSeed : 0;
  }

  observe({ truthCore, earth, simTimeSeconds }) {
    if (!truthCore?.ready) return null;
    const fields = truthCore.fields;
    if (!fields?.tauHigh || !fields?.cloudHigh || !fields?.tauLow || !fields?.cloudLow) return null;
    const gating = earth?._sensorGating;
    const footprints = Array.isArray(gating?.imagingFootprints) ? gating.imagingFootprints : [];
    if (!footprints.length) return null;

    const tauHighTruth = fields.tauHigh;
    const tauLowTruth = fields.tauLow;
    const cloudHighTruth = fields.cloudHigh;
    const cloudLowTruth = fields.cloudLow;
    if (
      tauHighTruth.length !== cloudHighTruth.length
      || tauLowTruth.length !== cloudLowTruth.length
      || tauHighTruth.length !== tauLowTruth.length
    ) return null;

    const grid = truthCore.grid;
    const nx = grid?.nx ?? 0;
    const ny = grid?.ny ?? 0;
    const latDeg = grid?.latDeg;
    const lonDeg = grid?.lonDeg;
    if (!nx || !ny || !latDeg || !lonDeg) return null;

    const N = tauHighTruth.length;
    const tauHighObs = new Float32Array(N);
    const tauLowObs = new Float32Array(N);
    const cloudHighObs = new Float32Array(N);
    const cloudLowObs = new Float32Array(N);
    const maskHigh = new Float32Array(N);
    const maskLow = new Float32Array(N);
    const tQuant = Math.floor(simTimeSeconds / this.cadenceSeconds);
    const fpMeta = footprints
      .filter(fp => Number.isFinite(fp?.latRad) && Number.isFinite(fp?.lonRad) && Number.isFinite(fp?.radiusKm))
      .map(fp => ({ ...fp }));
    if (!fpMeta.length) return null;
    const debugEnabled = Boolean(earth?._cloudWatchDebugEnabled);
    const cosLatArr = grid?.cosLat;
    const sinLatArr = grid?.sinLat;
    let coverageCount = 0;
    let maskCount = 0;
    let coverageSum = 0;
    let coverageX = 0;
    let coverageY = 0;
    let coverageZ = 0;
    let maskSum = 0;
    let maskX = 0;
    let maskY = 0;
    let maskZ = 0;
    let maxCoverage = 0;
    let maxCoverageLat = null;
    let maxCoverageLon = null;

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
          const sinDLat = Math.sin(dLat * 0.5);
          const sinDLon = Math.sin(dLon * 0.5);
          const a = sinDLat * sinDLat + Math.cos(latRad) * Math.cos(fp.latRad) * sinDLon * sinDLon;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distKm = RE_KM * c;
          if (distKm > fp.radiusKm) continue;
          const w = radialWeight(distKm, fp.radiusKm);
          if (w > coverage) coverage = w;
          if (coverage >= 1) break;
        }

        let sinLon = 0;
        let cosLon = 0;
        let sinLat = 0;
        let cosLat = 0;
        if (debugEnabled && coverage > 0) {
          coverageCount += 1;
          coverageSum += coverage;
          cosLat = cosLatArr ? cosLatArr[j] : Math.cos(latRad);
          sinLat = sinLatArr ? sinLatArr[j] : Math.sin(latRad);
          sinLon = Math.sin(lonRad);
          cosLon = Math.cos(lonRad);
          coverageX += coverage * cosLat * sinLon;
          coverageY += coverage * sinLat;
          coverageZ += coverage * cosLat * cosLon;
          if (coverage > maxCoverage) {
            maxCoverage = coverage;
            maxCoverageLat = latRad;
            maxCoverageLon = lonRad;
          }
        }

        const baseSeed = makeSampleSeed({
          worldSeed: this.worldSeed,
          sensorId: this.id,
          tQuant,
          index: k
        });
        let retrievalHigh = coverage > 0 ? 1 : 0;
        if (retrievalHigh && tauHighTruth[k] < TAU_THIN) {
          const r = hash01(baseSeed + 0.31);
          if (r < THIN_MISS_PROB) retrievalHigh = 0;
        }
        const mHigh = coverage * retrievalHigh;
        maskHigh[k] = mHigh;

        let retrievalLow = coverage > 0 ? 1 : 0;
        if (retrievalLow && tauHighTruth[k] > 5) {
          retrievalLow = 0;
        } else if (retrievalLow && tauLowTruth[k] < TAU_THIN) {
          const r = hash01(baseSeed + 0.61);
          if (r < THIN_MISS_PROB) retrievalLow = 0;
        }
        const mLow = coverage * retrievalLow;
        maskLow[k] = mLow;

        if (debugEnabled) {
          const maskW = Math.max(mHigh, mLow);
          if (maskW > 0) {
            if (sinLon === 0 && cosLon === 0) {
              cosLat = cosLatArr ? cosLatArr[j] : Math.cos(latRad);
              sinLat = sinLatArr ? sinLatArr[j] : Math.sin(latRad);
              sinLon = Math.sin(lonRad);
              cosLon = Math.cos(lonRad);
            }
            maskCount += 1;
            maskSum += maskW;
            maskX += maskW * cosLat * sinLon;
            maskY += maskW * sinLat;
            maskZ += maskW * cosLat * cosLon;
          }
        }

        if (mHigh > 0) {
          const cloudNoise = gaussian01(baseSeed + 1.7);
          const tauNoise = gaussian01(baseSeed + 2.3);
          const cloudVal = Math.min(1, Math.max(0, cloudHighTruth[k] + 0.05 * cloudNoise));
          const tauVal = Math.min(50, Math.max(0, tauHighTruth[k] * (1 + 0.15 * tauNoise)));
          cloudHighObs[k] = cloudVal;
          tauHighObs[k] = tauVal;
        } else {
          cloudHighObs[k] = 0;
          tauHighObs[k] = 0;
        }

        if (mLow > 0) {
          const cloudNoise = gaussian01(baseSeed + 3.7);
          const tauNoise = gaussian01(baseSeed + 4.3);
          const cloudVal = Math.min(1, Math.max(0, cloudLowTruth[k] + 0.05 * cloudNoise));
          const tauVal = Math.min(50, Math.max(0, tauLowTruth[k] * (1 + 0.15 * tauNoise)));
          cloudLowObs[k] = cloudVal;
          tauLowObs[k] = tauVal;
        } else {
          cloudLowObs[k] = 0;
          tauLowObs[k] = 0;
        }
      }
    }

    if (debugEnabled && (coverageSum > 0 || maskSum > 0)) {
      const toLatLon = (x, y, z) => {
        const mag = Math.hypot(x, y, z);
        if (!(mag > 0)) return null;
        return {
          latRad: Math.asin(y / mag),
          lonRad: Math.atan2(x, z)
        };
      };
      const fpVec = { x: 0, y: 0, z: 0 };
      fpMeta.forEach((fp) => {
        const w = Math.max(1, fp.radiusKm ?? 1);
        const cosLat = Math.cos(fp.latRad);
        const sinLat = Math.sin(fp.latRad);
        const sinLon = Math.sin(fp.lonRad);
        const cosLon = Math.cos(fp.lonRad);
        fpVec.x += w * cosLat * sinLon;
        fpVec.y += w * sinLat;
        fpVec.z += w * cosLat * cosLon;
      });
      const fpCenter = toLatLon(fpVec.x, fpVec.y, fpVec.z);
      const covCenter = toLatLon(coverageX, coverageY, coverageZ);
      const maskCenter = toLatLon(maskX, maskY, maskZ);
      const toWorldDeg = (ll) => {
        if (!ll) return null;
        return {
          latDeg: ll.latRad * RAD_TO_DEG,
          lonDeg: wrapRadToPi(ll.lonRad - CLOUD_WATCH_GRID_LON_OFFSET_RAD) * RAD_TO_DEG
        };
      };
      const angBetween = (a, b) => {
        if (!a || !b) return null;
        const ax = Math.cos(a.latRad) * Math.sin(a.lonRad);
        const ay = Math.sin(a.latRad);
        const az = Math.cos(a.latRad) * Math.cos(a.lonRad);
        const bx = Math.cos(b.latRad) * Math.sin(b.lonRad);
        const by = Math.sin(b.latRad);
        const bz = Math.cos(b.latRad) * Math.cos(b.lonRad);
        const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
        return Math.acos(dot) * RAD_TO_DEG;
      };
      const payload = {
        footprintCount: fpMeta.length,
        footprintCenterDeg: fpCenter
          ? { latDeg: fpCenter.latRad * RAD_TO_DEG, lonDeg: fpCenter.lonRad * RAD_TO_DEG }
          : null,
        footprintCenterDegWorld: toWorldDeg(fpCenter),
        coverageCenterDeg: covCenter
          ? { latDeg: covCenter.latRad * RAD_TO_DEG, lonDeg: covCenter.lonRad * RAD_TO_DEG }
          : null,
        coverageCenterDegWorld: toWorldDeg(covCenter),
        maskCenterDeg: maskCenter
          ? { latDeg: maskCenter.latRad * RAD_TO_DEG, lonDeg: maskCenter.lonRad * RAD_TO_DEG }
          : null,
        maskCenterDegWorld: toWorldDeg(maskCenter),
        coverageMaxDeg: maxCoverageLat != null && maxCoverageLon != null
          ? { latDeg: maxCoverageLat * RAD_TO_DEG, lonDeg: maxCoverageLon * RAD_TO_DEG }
          : null,
        lonOffsetDeg: CLOUD_WATCH_GRID_LON_OFFSET_RAD * RAD_TO_DEG,
        coverageFrac: N ? coverageCount / N : 0,
        maskFrac: N ? maskCount / N : 0,
        coverageOffsetDeg: angBetween(fpCenter, covCenter),
        maskOffsetDeg: angBetween(fpCenter, maskCenter)
      };
      earth?.logWeatherEvent?.('cloudWatchCoverageDebug', payload, { simTimeSeconds, core: truthCore });
      if (process.env.NODE_ENV !== 'production') {
        console.log('[cloudWatch] coverage debug', payload);
      }
    }

    return {
      sensorId: this.id,
      t: simTimeSeconds,
      products: {
        tauLow: {
          kind: 'grid2d',
          units: '1',
          data: tauLowObs,
          mask: maskLow,
          meta: { grid: { nx: truthCore.grid?.nx ?? 0, ny: truthCore.grid?.ny ?? 0 } }
        },
        tauHigh: {
          kind: 'grid2d',
          units: '1',
          data: tauHighObs,
          mask: maskHigh,
          meta: { grid: { nx: truthCore.grid?.nx ?? 0, ny: truthCore.grid?.ny ?? 0 } }
        },
        cloudLow: {
          kind: 'grid2d',
          units: '1',
          data: cloudLowObs,
          mask: maskLow,
          meta: { grid: { nx: truthCore.grid?.nx ?? 0, ny: truthCore.grid?.ny ?? 0 } }
        },
        cloudHigh: {
          kind: 'grid2d',
          units: '1',
          data: cloudHighObs,
          mask: maskHigh,
          meta: { grid: { nx: truthCore.grid?.nx ?? 0, ny: truthCore.grid?.ny ?? 0 } }
        }
      }
    };
  }
}
