import * as THREE from 'three';
import HQ from './HQ';
import WeatherField from './WeatherField';
import { WeatherVolumeGpu } from './sensors/radar/WeatherVolumeGpu';
import { WeatherVolumeDebugView } from './sensors/radar/WeatherVolumeDebugView';
import { RadarPpiOverlay } from './sensors/radar/RadarPpiOverlay';
import { RadarPpiPass } from './sensors/radar/RadarPpiPass';
import { DEFAULT_GROUND_DOPPLER_SPECS } from './sensors/radar/radarSpecs';
import { SensorManager } from './sensors/weather/SensorManager';
import { SurfaceStationSensor } from './sensors/weather/SurfaceStationSensor';
import { CloudSatSensor } from './sensors/weather/CloudSatSensor';
import { GroundRadarSensor } from './sensors/weather/GroundRadarSensor';
import { RadarSensor } from './sensors/weather/RadarSensor';
import { SoundingSensor } from './sensors/weather/SoundingSensor';
import { AmvSensor } from './sensors/weather/AmvSensor';
import { paintGridToTexture } from './sensors/weather/paintGridToTexture';
import { CLOUD_WATCH_GRID_LON_OFFSET_RAD } from './constants';
import earthmap from './8081_earthmap10k.jpg';
import earthbump from './8081_earthbump10k.jpg';
import fogTexture from './fog.png'; // Add your fog texture map here

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const smoothstep01 = (t) => t * t * (3 - 2 * t);
const radialWeight = (distKm, radiusKm) => {
  const t = clamp01(1 - distKm / Math.max(1e-6, radiusKm));
  return smoothstep01(t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const makeColorMap = (stops) => (tRaw) => {
  const t = clamp01(tRaw);
  if (t <= stops[0].t) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const next = stops[i];
    if (t <= next.t) {
      const span = Math.max(1e-6, next.t - prev.t);
      const tt = (t - prev.t) / span;
      return [
        lerp(prev.color[0], next.color[0], tt),
        lerp(prev.color[1], next.color[1], tt),
        lerp(prev.color[2], next.color[2], tt)
      ];
    }
  }
  return stops[stops.length - 1].color;
};
const wrapRadToPi = (rad) => {
  const twoPi = Math.PI * 2;
  let v = ((rad + Math.PI) % twoPi + twoPi) % twoPi;
  return v - Math.PI;
};

const SIGMA2_MIN = 0.01;
const SIGMA2_MAX = 10.0;
const SIGMA2_INIT = 5.0;
const OBS_STALE_SECONDS = 6 * 3600;
const SIGMA2_GROWTH_RATE_FRESH_PER_SEC = 1e-5;
const SIGMA2_GROWTH_RATE_STALE_PER_SEC = 5e-5;
const SIGMA_A0_PS = 2000;
const SIGMA_A0_CLOUD = 0.4;
const SIGMA_A0_TAU = 10;
const SIGMA_A0_WIND = 6;
const SIGMA_A0_QV = 0.004;
const QCQI_MAX = 0.05;
const DEFAULT_FORECAST_LEAD_HOURS = [1, 3, 6, 12, 24];
const FORECAST_HORIZON_HOURS = 24;
const STEPS_PER_CHUNK = 30;
const CONF_GROWTH_RATE_PER_SEC = 5e-5;
const PRECIP_COLOR_MAP = makeColorMap([
  { t: 0.0, color: [180, 220, 255] },
  { t: 0.15, color: [90, 170, 255] },
  { t: 0.3, color: [0, 200, 120] },
  { t: 0.5, color: [240, 240, 50] },
  { t: 0.7, color: [255, 170, 0] },
  { t: 0.85, color: [255, 60, 60] },
  { t: 1.0, color: [200, 0, 200] }
]);
const CONFIDENCE_COLOR_MAP = makeColorMap([
  { t: 0.0, color: [220, 60, 60] },
  { t: 0.5, color: [235, 220, 60] },
  { t: 1.0, color: [60, 200, 90] }
]);
const WIND_COLOR_MAP = makeColorMap([
  { t: 0.0, color: [255, 235, 160] },
  { t: 0.5, color: [255, 160, 40] },
  { t: 1.0, color: [220, 60, 60] }
]);
const CLOUD_INTEL_RENDER_PARAMS = {
  aLow: 0.95,
  aHigh: 0.70,
  gammaLow: 1.35,
  gammaHigh: 1.85,
  tauBrightLow: 12,
  tauBrightHigh: 8,
  tauEdgeLow: 0.08,
  tauEdgeHigh: 0.05,
  alphaHighCap: 0.65
};
const CLOUD_INTEL_RENDER_SCALE = 4;
const CLOUD_OBS_LON_OFFSET_RAD = 0;
const CLOUD_OBS_FLIP_X = false;

class Earth {
  constructor(camera, players, { weatherSeed } = {}) {
    this.camera = camera;
    this.weatherSeed = weatherSeed;
    this.earthRadiusKm = 6371; // Earth's radius in kilometers
    this.geometry = new THREE.SphereGeometry(this.earthRadiusKm, 64, 64);
    this.material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load(earthmap),
      bumpMap: new THREE.TextureLoader().load(earthbump),
      bumpScale: 0.05
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.scale.set(1, 1, 1); // Ensure it is a perfect sphere

    // Create cloud layer using fog.png
    this.cloudGeometry = new THREE.SphereGeometry(this.earthRadiusKm + 200, 512, 512); // Slightly larger than Earth
    this.cloudMaterial = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load(fogTexture),
      transparent: true,
      opacity: 0.9
    });
    this.cloudMesh = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);

    // Weather layers (dynamic clouds under FoW)
    this.weatherField = null;
    this.analysisWeatherField = null;
    this.forecastWeatherField = null;
    this.weatherViewSource = 'truth';
    this.analysisSigma2 = null;
    this.analysisObsLastSeenSimTimeSeconds = null;
    this._lastSigmaSimTimeSeconds = null;
    this._confidenceCalibrationByPlayerId = new Map();
    this._analysisSyncedFromTruth = false;
    this._analysisNoiseSeed = (this.weatherSeed ?? 0) + 1337;
    this.weatherSensorManager = null;
    this.latestWeatherObservations = new Map();
    this._weatherSensorsInitialized = false;
    this.stationObsObject = null;
    this.stationObsVisible = true;
    this.cloudObsMesh = null;
    this.cloudObsMaterial = null;
    this.cloudObsVisible = true;
    this.cloudObsProduct = 'tauTotal';
    this._cloudObsTextureCache = null;
    this._cloudIntelTextureCache = null;
    this.cloudIntelByPlayerId = new Map();
    this.cloudIntelFadeSeconds = 6 * 3600;
    this._cloudIntelNeedsRefresh = false;
    this._lastCloudIntelPaintSimTimeSeconds = null;
    this._lastSimTimeSeconds = null;
    this._cloudIntelStats = null;
    this._cloudWatchDebugEnabled = false;
    this._cloudWatchDebugGroup = null;
    this._cloudWatchDebugLiveMesh = null;
    this._cloudWatchDebugSeenMesh = null;
    this._cloudWatchDebugLiveCache = null;
    this._cloudWatchDebugSeenCache = null;
    this._cloudWatchDebugLiveMask = null;
    this._cloudWatchDebugSeenMask = null;
    this._cloudWatchCalibrationEnabled = false;
    this._cloudWatchCalibrationGroup = null;
    this._groundRadarPpiPass = null;
    this._groundRadarOriginProvider = null;
    this._lastRadarOrigin = null;
    this._sensorRenderer = null;
    this._sensorGating = null;
    this.latestForecastByPlayerId = new Map();
    this.forecastHistoryByPlayerId = new Map();
    this.forecastOverlayMesh = null;
    this.forecastOverlayMaterial = null;
    this.forecastOverlayVisible = false;
    this.forecastDisplayProduct = 'cloudTau';
    this.forecastDisplayLeadHours = 6;
    this._forecastTextureCache = null;
    this._forecastPrimed = false;
    this._forecastDisplayPlayerId = null;
    this.warningMeshesById = new Map();
    this.assimilationEnabled = {
      surfaceStations: true,
      cloudSat: true,
      soundings: true,
      amv: true,
      hqRadar: true
    };
    this._lastAssimilatedObsKeyBySensor = new Map();
    this._stationInfluenceCache = null;
    this._sensorLastObsById = new Map();
    this._sensorCadenceById = new Map();
    this.radarOverlayVisible = true;
    this.weatherVolumeGpu = null;
    this.weatherVolumeDebugView = null;
    this.radarOverlay = null;
    this.weatherLowGeometry = new THREE.SphereGeometry(this.earthRadiusKm + 120, 256, 256);
    this.weatherHighGeometry = new THREE.SphereGeometry(this.earthRadiusKm + 160, 256, 256);
    this.weatherLowMaterial = new THREE.MeshPhongMaterial({
      map: null,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    this.weatherHighMaterial = new THREE.MeshPhongMaterial({
      map: null,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });
    this.weatherLowMesh = new THREE.Mesh(this.weatherLowGeometry, this.weatherLowMaterial);
    this.weatherHighMesh = new THREE.Mesh(this.weatherHighGeometry, this.weatherHighMaterial);

    this.weatherDebugGeometry = new THREE.SphereGeometry(this.earthRadiusKm + 220, 256, 256);
    this.weatherDebugMaterial = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    this.weatherDebugMesh = new THREE.Mesh(this.weatherDebugGeometry, this.weatherDebugMaterial);
    this.weatherDebugMesh.visible = false;
    this.weatherVisible = true;
    this.weatherDebugMode = 'clouds';

    // Create a parent object to hold both the Earth and the spheres
    this.parentObject = new THREE.Object3D();
    this.parentObject.add(this.mesh);
    this.parentObject.add(this.weatherLowMesh);
    this.parentObject.add(this.weatherHighMesh);
    this.parentObject.add(this.cloudMesh);
    this.parentObject.add(this.weatherDebugMesh);

    this.cloudObsGeometry = new THREE.SphereGeometry(this.earthRadiusKm + 180, 256, 256);
    this.cloudObsMaterial = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });
    this.cloudObsMesh = new THREE.Mesh(this.cloudObsGeometry, this.cloudObsMaterial);
    this.cloudObsMesh.visible = false;
    this.cloudObsMesh.rotation.y = CLOUD_OBS_LON_OFFSET_RAD;
    this.parentObject.add(this.cloudObsMesh);

    this.forecastOverlayGeometry = new THREE.SphereGeometry(this.earthRadiusKm + 240, 256, 256);
    this.forecastOverlayMaterial = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });
    this.forecastOverlayMesh = new THREE.Mesh(this.forecastOverlayGeometry, this.forecastOverlayMaterial);
    this.forecastOverlayMesh.visible = false;
    this.parentObject.add(this.forecastOverlayMesh);

    this._createWeatherField();

    // Create a main canvas to dynamically update the fog texture
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.context = this.canvas.getContext('2d');

    this.fogTexture = new THREE.CanvasTexture(this.canvas);
    this.cloudMaterial.map = this.fogTexture;

    // Fill the canvas with the initial fog
    const ctx = this.context;
    ctx.fillStyle = 'rgba(255, 255, 255, 1.0)'; // Fully opaque initial fog
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Create off-screen canvases for each player
    this.playerCanvases = {};
    players.forEach(player => {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = 1024;
      offscreenCanvas.height = 512;
      const offscreenContext = offscreenCanvas.getContext('2d');
      offscreenContext.fillStyle = 'rgba(255, 255, 255, 1.0)'; // Fully opaque initial fog
      offscreenContext.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
      this.playerCanvases[player.id] = { canvas: offscreenCanvas, context: offscreenContext };
      console.log(`Initialized fog map for player ${player.id}`);
    });
   

    this.latLines = null;
    this.longLines = null;
    this.revealedPositions = {}; // Track revealed positions for each player
    this.lastLogTime = 0; // Timestamp of the last log
    this.DEBUG = false;
    this.currentPlayerID = null;
  }

  _createWeatherField() {
    if (this.weatherField) {
      this.weatherField.textureLow.dispose?.();
      this.weatherField.textureHigh.dispose?.();
      this.weatherField.textureDebug.dispose?.();
    }
    if (this.analysisWeatherField) {
      this.analysisWeatherField.textureLow.dispose?.();
      this.analysisWeatherField.textureHigh.dispose?.();
      this.analysisWeatherField.textureDebug.dispose?.();
    }
    if (this.forecastWeatherField) {
      this.forecastWeatherField.textureLow.dispose?.();
      this.forecastWeatherField.textureHigh.dispose?.();
      this.forecastWeatherField.textureDebug.dispose?.();
    }
    if (this.weatherVolumeDebugView) {
      this.weatherVolumeDebugView.dispose();
      this.weatherVolumeDebugView = null;
    }
    if (this.radarOverlay) {
      this.parentObject.remove(this.radarOverlay.mesh);
      this.radarOverlay.dispose();
      this.radarOverlay = null;
    }
    this.weatherVolumeGpu = null;
    this.weatherField = new WeatherField({
      renderScale: 4,
      tickSeconds: 1.0,
      seed: this.weatherSeed
    });
    this.analysisWeatherField = new WeatherField({
      renderScale: 4,
      tickSeconds: 1.0,
      seed: this.weatherSeed
    });
    this.forecastWeatherField = new WeatherField({
      renderScale: 1,
      tickSeconds: 9999,
      seed: this.weatherSeed
    });
    this._analysisSyncedFromTruth = false;
    this._analysisNoiseSeed = (this.weatherSeed ?? 0) + 1337;
    this.analysisSigma2 = null;
    this.analysisObsLastSeenSimTimeSeconds = null;
    this._lastSigmaSimTimeSeconds = null;
    this._forecastTextureCache = null;
    this._forecastPrimed = false;
    this._forecastDisplayPlayerId = null;
    this.latestForecastByPlayerId = new Map();
    this.forecastHistoryByPlayerId = new Map();
    this.cloudIntelByPlayerId = new Map();
    this._cloudIntelStats = null;
    this._cloudIntelNeedsRefresh = false;
    this._lastCloudIntelPaintSimTimeSeconds = null;
    this._cloudObsTextureCache = null;
    this._cloudIntelTextureCache = null;
    this._applyWeatherViewSourceMaps();
    this.weatherField?.setDebugMode(this.weatherDebugMode);
    this.analysisWeatherField?.setDebugMode(this.weatherDebugMode);
    this.forecastWeatherField?.setDebugMode(this.weatherDebugMode);
    this._applyForecastOverlayTexture(null);
  }

  _getActiveWeatherField() {
    return this.weatherViewSource === 'analysis'
      ? this.analysisWeatherField
      : this.weatherField;
  }

  _applyWeatherViewSourceMaps() {
    const wf = this._getActiveWeatherField();
    if (!wf) return;

    this.weatherLowMaterial.map = wf.textureLow;
    this.weatherLowMaterial.needsUpdate = true;
    this.weatherHighMaterial.map = wf.textureHigh;
    this.weatherHighMaterial.needsUpdate = true;
    this.weatherDebugMaterial.map = wf.getDebugTexture();
    this.weatherDebugMaterial.needsUpdate = true;
  }

  setWeatherViewSource(source) {
    const next = source === 'analysis' ? 'analysis' : 'truth';
    if (this.weatherViewSource === next) return;
    this.weatherViewSource = next;
    this._applyWeatherViewSourceMaps();
  }

  initWeatherSensors({ renderer } = {}) {
    if (renderer) this._sensorRenderer = renderer;
    if (!this.weatherSensorManager) {
      this.weatherSensorManager = new SensorManager({
        onNewObservation: (obs) => this._handleNewWeatherObservation(obs)
      });
    }
    if (this._weatherSensorsInitialized) return;
    this.latestWeatherObservations = new Map();
    this.addWeatherSensor(new SurfaceStationSensor({ worldSeed: this.weatherSeed ?? 0 }));
    this.addWeatherSensor(new CloudSatSensor({ worldSeed: this.weatherSeed ?? 0 }));
    this.addWeatherSensor(new SoundingSensor({ worldSeed: this.weatherSeed ?? 0 }));
    this.addWeatherSensor(new AmvSensor({ worldSeed: this.weatherSeed ?? 0 }));
    this.addWeatherSensor(new RadarSensor({ worldSeed: this.weatherSeed ?? 0 }));
    this.addWeatherSensor(new GroundRadarSensor({ worldSeed: this.weatherSeed ?? 0 }));
    this._initGroundRadarPpi();
    this._weatherSensorsInitialized = true;
  }

  addWeatherSensor(sensor) {
    this.weatherSensorManager?.addSensor(sensor);
    if (sensor?.id && Number.isFinite(sensor.cadenceSeconds)) {
      this._sensorCadenceById.set(sensor.id, sensor.cadenceSeconds);
    }
  }

  setLatestWeatherObservation(sensorId, obsSet) {
    if (!sensorId || !obsSet) return;
    this.latestWeatherObservations.set(sensorId, obsSet);
  }

  getLatestWeatherObservation(sensorId) {
    return this.latestWeatherObservations.get(sensorId) ?? null;
  }

  _handleNewWeatherObservation(obsSet) {
    if (!obsSet?.sensorId) return;
    this.setLatestWeatherObservation(obsSet.sensorId, obsSet);
    if (Number.isFinite(obsSet.t)) {
      this._sensorLastObsById.set(obsSet.sensorId, obsSet.t);
    }
    if (obsSet.sensorId === 'surfaceStations') {
      this.setStationObs(obsSet);
    } else if (obsSet.sensorId === 'cloudSat') {
      this._updateCloudIntelFromObservation(obsSet);
      this._cloudIntelNeedsRefresh = true;
    } else if (obsSet.sensorId === 'groundRadar') {
      const texture = obsSet.products?.radarDbzPpi?.data;
      this.updateRadarOverlayTexture(texture);
    }
    this._assimilateObservationSet(obsSet);
  }

  _assimilateObservationSet(obsSet) {
    if (!obsSet?.sensorId) return;
    if (!this.assimilationEnabled?.[obsSet.sensorId]) return;
    if (!this._analysisSyncedFromTruth) return;
    const analysisCore = this.analysisWeatherField?.core;
    if (!analysisCore?.ready) return;
    if (!this.analysisSigma2 || this.analysisSigma2.length !== analysisCore.grid?.count) return;

    const cadence = obsSet.sensorId === 'surfaceStations'
      ? 300
      : obsSet.sensorId === 'cloudSat'
        ? 600
        : obsSet.sensorId === 'soundings'
          ? 21600
          : obsSet.sensorId === 'amv'
            ? 600
            : obsSet.sensorId === 'hqRadar'
              ? 300
            : null;
    if (!cadence || !Number.isFinite(obsSet.t)) return;
    const tQuant = Math.floor(obsSet.t / cadence);
    const key = `${obsSet.sensorId}:${tQuant}`;
    if (this._lastAssimilatedObsKeyBySensor.get(obsSet.sensorId) === key) return;

    let didAssimilate = false;
    let stats = null;
    if (obsSet.sensorId === 'surfaceStations') {
      didAssimilate = this._assimilateSurfaceStations(obsSet, analysisCore);
    } else if (obsSet.sensorId === 'cloudSat') {
      didAssimilate = this._assimilateCloudSat(obsSet, analysisCore);
    } else if (obsSet.sensorId === 'soundings') {
      stats = this._assimilateSoundings(obsSet, analysisCore);
      didAssimilate = stats?.updatedCount > 0;
    } else if (obsSet.sensorId === 'amv') {
      stats = this._assimilateAmv(obsSet, analysisCore);
      didAssimilate = stats?.updatedCount > 0;
    } else if (obsSet.sensorId === 'hqRadar') {
      stats = this._assimilateRadar(obsSet, analysisCore);
      didAssimilate = stats?.updatedCount > 0;
    }

    if (didAssimilate) {
      this._lastAssimilatedObsKeyBySensor.set(obsSet.sensorId, key);
      if (obsSet.sensorId === 'hqRadar' && stats && Number.isFinite(obsSet.t)) {
        this.logWeatherEvent?.(
          'radarAssimilated',
          {
            updatedCellCount: stats.updatedCount,
            meanAbsDelta: stats.meanAbsDelta,
            coveredFracService: stats.coveredFracService ?? null
          },
          { simTimeSeconds: obsSet.t, core: analysisCore }
        );
      }
      if (stats && Number.isFinite(obsSet.t) && obsSet.sensorId !== 'hqRadar') {
        this.logWeatherEvent?.(
          'assimilationApplied',
          {
            sensorId: obsSet.sensorId,
            updatedCount: stats.updatedCount,
            levelIndex: stats.levelIndex ?? null
          },
          { simTimeSeconds: obsSet.t, core: analysisCore }
        );
      }
    }
  }

  _assimilateSurfaceStations(obsSet, analysisCore) {
    const product = obsSet?.products?.ps;
    if (!product || product.kind !== 'points') return false;
    const data = product.data;
    if (!data?.value || !data?.latDeg || !data?.lonDeg) return false;
    const values = data.value;
    const mask = product.mask;
    const sigmaObs = product.sigmaObs;
    const ps = analysisCore.state?.ps;
    if (!ps) return false;

    const cache = this._getStationInfluenceCache(obsSet, analysisCore);
    if (!cache) return false;

    const count = values.length;
    for (let i = 0; i < count; i++) {
      if (mask && mask[i] <= 0) continue;
      const entry = cache.entries[i];
      if (!entry) continue;
      const sigmaO = sigmaObs ? sigmaObs[i] : 80;
      const sigmaO2 = sigmaO * sigmaO;
      const yObs = values[i];
      for (let n = 0; n < entry.indices.length; n++) {
        const k = entry.indices[n];
        const w = entry.weights[n];
        const updated = this._kalmanUpdate({
          value: ps[k],
          k,
          yObs,
          sigmaO2,
          sigmaA0: SIGMA_A0_PS,
          weight: w
        });
        ps[k] = Math.min(110000, Math.max(50000, updated));
        this._markAnalysisObsSeen(k, obsSet.t);
      }
    }
    return true;
  }

  _assimilateCloudSat(obsSet, analysisCore) {
    const fields = analysisCore.fields;
    const state = analysisCore.state;
    const N = analysisCore.grid?.count ?? 0;
    if (!fields || !state || !N) return false;

    let did = false;

    const cloudHighProduct = obsSet?.products?.cloudHigh;
    if (cloudHighProduct && cloudHighProduct.kind === 'grid2d' && cloudHighProduct.data?.length === N) {
      if (!state._cloudHighCov || state._cloudHighCov.length !== N) {
        state._cloudHighCov = new Float32Array(N);
      }
      const cloudCov = state._cloudHighCov;
      const mask = cloudHighProduct.mask;
      const data = cloudHighProduct.data;
      for (let k = 0; k < N; k++) {
        const w = mask ? mask[k] : 1;
        if (w <= 0) continue;
        const yObs = data[k];
        const updated = this._kalmanUpdate({
          value: cloudCov[k],
          k,
          yObs,
          sigmaO2: 0.05 * 0.05,
          sigmaA0: SIGMA_A0_CLOUD,
          weight: w
        });
        cloudCov[k] = Math.min(1, Math.max(0, updated));
        if (fields.cloudHigh) fields.cloudHigh[k] = cloudCov[k];
        this._markAnalysisObsSeen(k, obsSet.t);
        did = true;
      }
    }

    const cloudLowProduct = obsSet?.products?.cloudLow;
    if (cloudLowProduct && cloudLowProduct.kind === 'grid2d' && cloudLowProduct.data?.length === N) {
      if (!state._cloudLowCov || state._cloudLowCov.length !== N) {
        state._cloudLowCov = new Float32Array(N);
      }
      const cloudCov = state._cloudLowCov;
      const mask = cloudLowProduct.mask;
      const data = cloudLowProduct.data;
      for (let k = 0; k < N; k++) {
        const w = mask ? mask[k] : 1;
        if (w <= 0) continue;
        const yObs = data[k];
        const updated = this._kalmanUpdate({
          value: cloudCov[k],
          k,
          yObs,
          sigmaO2: 0.05 * 0.05,
          sigmaA0: SIGMA_A0_CLOUD,
          weight: w
        });
        cloudCov[k] = Math.min(1, Math.max(0, updated));
        if (fields.cloudLow) fields.cloudLow[k] = cloudCov[k];
        this._markAnalysisObsSeen(k, obsSet.t);
        did = true;
      }
    }

    const tauHighProduct = obsSet?.products?.tauHigh;
    if (tauHighProduct && tauHighProduct.kind === 'grid2d' && tauHighProduct.data?.length === N) {
      const tauField = fields.tauHigh;
      const qc = state.qc;
      const qi = state.qi;
      const nz = state.nz ?? analysisCore.nz ?? 0;
      if (tauField && qc && qi && nz > 0) {
        const mask = tauHighProduct.mask;
        const data = tauHighProduct.data;
        const lev0 = 0;
        const lev1 = Math.min(1, nz - 1);
        for (let k = 0; k < N; k++) {
          const w = mask ? mask[k] : 1;
          if (w <= 0) continue;
          const yObs = data[k];
          const tauAnal = tauField[k];
          const sigmaO2 = Math.pow(0.15 * Math.max(1, yObs), 2);
          const updatedTau = this._kalmanUpdate({
            value: tauAnal,
            k,
            yObs,
            sigmaO2,
            sigmaA0: SIGMA_A0_TAU,
            weight: w
          });
          const tauTarget = Math.min(50, Math.max(0, updatedTau));
          const f = Math.min(4.0, Math.max(0.25, tauTarget / Math.max(1e-3, tauAnal)));
          const idx0 = lev0 * N + k;
          qc[idx0] = Math.min(QCQI_MAX, Math.max(0, qc[idx0] * f));
          qi[idx0] = Math.min(QCQI_MAX, Math.max(0, qi[idx0] * f));
          if (lev1 !== lev0) {
            const idx1 = lev1 * N + k;
            qc[idx1] = Math.min(QCQI_MAX, Math.max(0, qc[idx1] * f));
            qi[idx1] = Math.min(QCQI_MAX, Math.max(0, qi[idx1] * f));
          }
          tauField[k] = tauTarget;
          this._markAnalysisObsSeen(k, obsSet.t);
          did = true;
        }
      }
    }

    const tauLowProduct = obsSet?.products?.tauLow;
    if (tauLowProduct && tauLowProduct.kind === 'grid2d' && tauLowProduct.data?.length === N) {
      const tauField = fields.tauLow;
      const qc = state.qc;
      const qi = state.qi;
      const nz = state.nz ?? analysisCore.nz ?? 0;
      if (tauField && qc && qi && nz > 0) {
        const mask = tauLowProduct.mask;
        const data = tauLowProduct.data;
        const lev0 = Math.max(0, nz - 1);
        const lev1 = Math.max(0, nz - 2);
        for (let k = 0; k < N; k++) {
          const w = mask ? mask[k] : 1;
          if (w <= 0) continue;
          const yObs = data[k];
          const tauAnal = tauField[k];
          const sigmaO2 = Math.pow(0.15 * Math.max(1, yObs), 2);
          const updatedTau = this._kalmanUpdate({
            value: tauAnal,
            k,
            yObs,
            sigmaO2,
            sigmaA0: SIGMA_A0_TAU,
            weight: w
          });
          const tauTarget = Math.min(50, Math.max(0, updatedTau));
          const f = Math.min(4.0, Math.max(0.25, tauTarget / Math.max(1e-3, tauAnal)));
          const idx0 = lev0 * N + k;
          qc[idx0] = Math.min(QCQI_MAX, Math.max(0, qc[idx0] * f));
          qi[idx0] = Math.min(QCQI_MAX, Math.max(0, qi[idx0] * f));
          if (lev1 !== lev0) {
            const idx1 = lev1 * N + k;
            qc[idx1] = Math.min(QCQI_MAX, Math.max(0, qc[idx1] * f));
            qi[idx1] = Math.min(QCQI_MAX, Math.max(0, qi[idx1] * f));
          }
          tauField[k] = tauTarget;
          this._markAnalysisObsSeen(k, obsSet.t);
          did = true;
        }
      }
    }

    return did;
  }

  _assimilateRadar(obsSet, analysisCore) {
    const product = obsSet?.products?.precipRate;
    if (!product || product.kind !== 'grid2d') return { updatedCount: 0 };
    const values = product.data;
    const mask = product.mask;
    const precip = analysisCore.fields?.precipRate;
    if (!values || !precip || values.length !== precip.length) return { updatedCount: 0 };
    const N = precip.length;
    let updatedCount = 0;
    let sumAbs = 0;
    for (let k = 0; k < N; k++) {
      const w = mask ? mask[k] : 1;
      if (w <= 0) continue;
      const before = precip[k];
      const updated = this._kalmanUpdate({
        value: before,
        k,
        yObs: values[k],
        sigmaO2: 0.03 * 0.03,
        sigmaA0: 0.15,
        weight: w
      });
      const clamped = Math.max(0, updated);
      precip[k] = clamped;
      sumAbs += Math.abs(clamped - before);
      updatedCount += 1;
      this._markAnalysisObsSeen(k, obsSet.t);
      if (analysisCore.fields?.confidence) {
        const prev = analysisCore.fields.confidence[k] ?? 0;
        analysisCore.fields.confidence[k] = Math.max(prev, 0.9);
      }
    }
    const meanAbsDelta = updatedCount > 0 ? sumAbs / updatedCount : 0;
    const coveredFracService = product.meta?.coveredFracService ?? obsSet.meta?.coveredFracService ?? null;
    return { updatedCount, meanAbsDelta, coveredFracService };
  }

  _assimilateSoundings(obsSet, analysisCore) {
    const productU = obsSet?.products?.u;
    const productV = obsSet?.products?.v;
    const productQv = obsSet?.products?.qv;
    if (!productU || !productV || !productQv) return { updatedCount: 0 };
    if (productU.kind !== 'points' || productV.kind !== 'points' || productQv.kind !== 'points') {
      return { updatedCount: 0 };
    }
    const dataU = productU.data;
    const dataV = productV.data;
    const dataQv = productQv.data;
    if (!dataU?.latDeg || !dataU?.lonDeg || !dataU?.value || !dataU?.levelIndex) return { updatedCount: 0 };
    const latDeg = dataU.latDeg;
    const lonDeg = dataU.lonDeg;
    const levelIndex = dataU.levelIndex;
    const uObs = dataU.value;
    const vObs = dataV?.value;
    const qvObs = dataQv?.value;
    const mask = productU.mask;
    const sigmaU = productU.sigmaObs;
    const sigmaQv = productQv.sigmaObs;

    const grid = analysisCore.grid;
    const state = analysisCore.state;
    if (!grid || !state?.u || !state?.v || !state?.qv) return { updatedCount: 0 };
    const { nx, ny, cellLonDeg, cellLatDeg } = grid;
    const N = nx * ny;
    const nz = state.nz ?? analysisCore.nz ?? 0;
    if (!nx || !ny || !cellLonDeg || !cellLatDeg || !N || !nz) return { updatedCount: 0 };

    let updatedCount = 0;
    const count = uObs.length;
    for (let i = 0; i < count; i++) {
      if (mask && mask[i] <= 0) continue;
      const lev = levelIndex[i];
      if (!(lev >= 0) || lev >= nz) continue;
      const lat = latDeg[i];
      const lon = lonDeg[i];
      const iF = (lon + 180) / cellLonDeg - 0.5;
      const jF = (90 - lat) / cellLatDeg - 0.5;
      const ii = Math.max(0, Math.min(nx - 1, Math.round(iF)));
      const jj = Math.max(0, Math.min(ny - 1, Math.round(jF)));
      const k2d = jj * nx + ii;
      const idx = lev * N + k2d;

      const sigmaO = sigmaU ? sigmaU[i] : 2;
      const sigmaO2 = sigmaO * sigmaO;
      const uUpdated = this._kalmanUpdate({
        value: state.u[idx],
        k: k2d,
        yObs: uObs[i],
        sigmaO2,
        sigmaA0: SIGMA_A0_WIND,
        weight: 1
      });
      const vUpdated = this._kalmanUpdate({
        value: state.v[idx],
        k: k2d,
        yObs: vObs ? vObs[i] : 0,
        sigmaO2,
        sigmaA0: SIGMA_A0_WIND,
        weight: 1
      });
      state.u[idx] = uUpdated;
      state.v[idx] = vUpdated;

      const sigmaQ = sigmaQv ? sigmaQv[i] : 0.001;
      const sigmaQ2 = sigmaQ * sigmaQ;
      const qUpdated = this._kalmanUpdate({
        value: state.qv[idx],
        k: k2d,
        yObs: qvObs ? qvObs[i] : 0,
        sigmaO2: sigmaQ2,
        sigmaA0: SIGMA_A0_QV,
        weight: 1
      });
      state.qv[idx] = Math.max(0, Math.min(0.04, qUpdated));

      this._markAnalysisObsSeen(k2d, obsSet.t);
      updatedCount += 1;
    }

    return { updatedCount };
  }

  _assimilateAmv(obsSet, analysisCore) {
    const productU = obsSet?.products?.u;
    const productV = obsSet?.products?.v;
    if (!productU || !productV) return { updatedCount: 0 };
    if (productU.kind !== 'grid2d' || productV.kind !== 'grid2d') return { updatedCount: 0 };
    const dataU = productU.data;
    const dataV = productV.data;
    if (!dataU || !dataV || dataU.length !== dataV.length) return { updatedCount: 0 };
    const mask = productU.mask;
    const levelIndex = productU.meta?.levelIndex ?? productV.meta?.levelIndex ?? 0;

    const state = analysisCore.state;
    const N = analysisCore.grid?.count ?? 0;
    const nz = state?.nz ?? analysisCore.nz ?? 0;
    if (!state?.u || !state?.v || !N || !nz) return { updatedCount: 0 };
    if (levelIndex < 0 || levelIndex >= nz) return { updatedCount: 0 };

    let updatedCount = 0;
    for (let k = 0; k < N; k++) {
      const w = mask ? mask[k] : 1;
      if (w <= 0) continue;
      const idx = levelIndex * N + k;
      const sigmaO2 = 2 * 2;
      state.u[idx] = this._kalmanUpdate({
        value: state.u[idx],
        k,
        yObs: dataU[k],
        sigmaO2,
        sigmaA0: SIGMA_A0_WIND,
        weight: w
      });
      state.v[idx] = this._kalmanUpdate({
        value: state.v[idx],
        k,
        yObs: dataV[k],
        sigmaO2,
        sigmaA0: SIGMA_A0_WIND,
        weight: w
      });
      this._markAnalysisObsSeen(k, obsSet.t);
      updatedCount += 1;
    }
    return { updatedCount, levelIndex };
  }

  _markAnalysisObsSeen(k, t) {
    if (!this.analysisObsLastSeenSimTimeSeconds) return;
    if (!Number.isFinite(k) || !Number.isFinite(t)) return;
    const prev = this.analysisObsLastSeenSimTimeSeconds[k];
    if (!Number.isFinite(prev) || t > prev) {
      this.analysisObsLastSeenSimTimeSeconds[k] = t;
    }
  }

  _kalmanUpdate({ value, k, yObs, sigmaO2, sigmaA0, weight }) {
    const sigmaA2 = this.analysisSigma2[k] * sigmaA0 * sigmaA0;
    const K = clamp01(sigmaA2 / (sigmaA2 + sigmaO2));
    const updated = value + K * (yObs - value) * weight;
    const nextSigma2 = this.analysisSigma2[k] * (1 - K * weight);
    this.analysisSigma2[k] = Math.min(SIGMA2_MAX, Math.max(SIGMA2_MIN, nextSigma2));
    return updated;
  }

  _getStationInfluenceCache(obsSet, analysisCore) {
    const product = obsSet?.products?.ps;
    const data = product?.data;
    const latDeg = data?.latDeg;
    const lonDeg = data?.lonDeg;
    const count = latDeg?.length ?? 0;
    if (!count) return null;
    const radiusKm = product?.meta?.stationRadiusKm ?? 300;
    const grid = analysisCore.grid;
    if (!grid) return null;

    const key = `${grid.nx}:${grid.ny}:${radiusKm}:${count}`;
    if (this._stationInfluenceCache?.key === key) return this._stationInfluenceCache;

    const { nx, ny, cellLonDeg, cellLatDeg } = grid;
    const gridLat = grid.latDeg;
    const gridLon = grid.lonDeg;
    const entries = new Array(count);
    const earthRadiusKm = this.earthRadiusKm;
    const degToRad = Math.PI / 180;

    for (let i = 0; i < count; i++) {
      const lat = latDeg[i];
      const lon = lonDeg[i];
      const latRad = lat * degToRad;
      const lonRad = lon * degToRad;

      const jCenter = Math.round((90 - lat) / cellLatDeg - 0.5);
      const iCenter = Math.round((lon + 180) / cellLonDeg - 0.5);
      const dJ = Math.ceil(radiusKm / (111 * cellLatDeg));
      const cosLat = Math.max(0.1, Math.abs(Math.cos(latRad)));
      const dI = Math.ceil(radiusKm / Math.max(1e-6, 111 * cellLonDeg * cosLat));

      const indices = [];
      const weights = [];

      for (let dj = -dJ; dj <= dJ; dj++) {
        const j = jCenter + dj;
        if (j < 0 || j >= ny) continue;
        const latCellRad = gridLat[j] * degToRad;
        const rowOffset = j * nx;
        for (let di = -dI; di <= dI; di++) {
          let ii = iCenter + di;
          ii = ((ii % nx) + nx) % nx;
          const lonCellRad = gridLon[ii] * degToRad;
          const dLat = latCellRad - latRad;
          const dLon = wrapRadToPi(lonCellRad - lonRad);
          const distKm = earthRadiusKm * Math.sqrt(dLat * dLat + Math.pow(Math.cos(latRad) * dLon, 2));
          if (distKm > radiusKm) continue;
          const w = radialWeight(distKm, radiusKm);
          if (w <= 0) continue;
          indices.push(rowOffset + ii);
          weights.push(w);
        }
      }

      entries[i] = {
        indices: new Int32Array(indices),
        weights: new Float32Array(weights)
      };
    }

    this._stationInfluenceCache = { key, entries, radiusKm };
    return this._stationInfluenceCache;
  }

  setStationObsVisible(visible) {
    this.stationObsVisible = Boolean(visible);
    if (this.stationObsObject) this.stationObsObject.visible = this.stationObsVisible;
  }

  setStationObs(obsSet) {
    const product = obsSet?.products?.ps;
    if (!product || product.kind !== 'points') return;
    const data = product.data;
    if (!data?.latDeg || !data?.lonDeg || !data?.value) return;
    const mask = product.mask;

    const total = data.value.length;
    let visibleCount = total;
    if (mask && mask.length === total) {
      visibleCount = 0;
      for (let i = 0; i < total; i++) {
        if (mask[i] > 0) visibleCount++;
      }
    }
    const positions = new Float32Array(visibleCount * 3);
    const colors = new Float32Array(visibleCount * 3);
    const radius = this.earthRadiusKm + 20;

    let cursor = 0;
    for (let i = 0; i < total; i++) {
      if (mask && mask.length === total && mask[i] <= 0) continue;
      const pos = this._latLonToVector3(data.latDeg[i], data.lonDeg[i], radius);
      const base = cursor * 3;
      positions[base] = pos.x;
      positions[base + 1] = pos.y;
      positions[base + 2] = pos.z;

      const anom = data.value[i] - 101325;
      const c = this._colorizeStationPs(anom);
      colors[base] = c.r;
      colors[base + 1] = c.g;
      colors[base + 2] = c.b;
      cursor++;
    }

    if (!this.stationObsObject) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        size: 6,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false
      });
      const points = new THREE.Points(geometry, material);
      points.visible = this.stationObsVisible;
      this.parentObject.add(points);
      this.stationObsObject = points;
    } else {
      const geometry = this.stationObsObject.geometry;
      if (geometry.attributes.position.count !== visibleCount) {
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      } else {
        geometry.attributes.position.array.set(positions);
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.array.set(colors);
        geometry.attributes.color.needsUpdate = true;
      }
      geometry.computeBoundingSphere();
    }
  }

  setCloudObsVisible(visible) {
    const next = Boolean(visible);
    if (this.cloudObsVisible === next) return;
    this.cloudObsVisible = next;
    if (this.cloudObsMesh) this.cloudObsMesh.visible = this.cloudObsVisible;
    if (this.cloudObsVisible) {
      this._cloudIntelNeedsRefresh = true;
      this._refreshCloudIntelTextureForPlayer(this._sensorGating?.playerId);
    }
  }

  setRotationForSimTime(simTimeSeconds) {
    this._applyRotationForSimTime(simTimeSeconds);
  }

  _applyRotationForSimTime(simTimeSeconds) {
    if (!Number.isFinite(simTimeSeconds)) return;
    const daySeconds = 86400;
    const dayFrac = (((simTimeSeconds / daySeconds) % 1) + 1) % 1;
    this.parentObject.rotation.y = 2 * Math.PI * (dayFrac - 0.5);
    this.parentObject.updateMatrixWorld(true);
  }

  setCloudObsProduct(productName) {
    const allowed = ['tauTotal', 'tauHigh', 'tauLow', 'cloudHigh', 'cloudLow'];
    const next = allowed.includes(productName) ? productName : 'tauTotal';
    this.cloudObsProduct = next;
    this._cloudIntelNeedsRefresh = true;
    this._refreshCloudIntelTextureForPlayer(this._sensorGating?.playerId);
  }

  setCloudObsTexture(texture) {
    if (!this.cloudObsMaterial) return;
    this._applyCloudObsTextureTransform(texture);
    this.cloudObsMaterial.map = texture;
    this.cloudObsMaterial.needsUpdate = true;
    if (this.cloudObsMesh) {
      this.cloudObsMesh.visible = this.cloudObsVisible && !!texture;
    }
  }

  setCloudObsFromGrid(obsSet, productName = 'tauHigh') {
    const product = obsSet?.products?.[productName];
    if (!product || product.kind !== 'grid2d') return;
    const grid = product.meta?.grid || product.meta || {};
    const nx = grid.nx ?? this.weatherField?.core?.grid?.nx ?? 0;
    const ny = grid.ny ?? this.weatherField?.core?.grid?.ny ?? 0;
    if (!nx || !ny) return;

    const options = productName === 'cloudHigh'
      ? { valueMin: 0, valueMax: 1, alphaScale: 0.6, scale: 2 }
      : { valueMin: 0, valueMax: 10, alphaScale: 0.7, scale: 2 };

    const result = paintGridToTexture({
      nx,
      ny,
      values: product.data,
      mask: product.mask,
      textureCache: this._cloudObsTextureCache,
      options
    });
    if (!result) return;
    this._cloudObsTextureCache = result.cache;
    this.setCloudObsTexture(result.texture);
  }

  setCloudWatchDebugEnabled(enabled) {
    this._cloudWatchDebugEnabled = Boolean(enabled);
    if (!this._cloudWatchDebugEnabled) {
      this._clearCloudWatchDebugGroup();
      this._setCloudWatchDebugMaskVisibility(false);
      this._clearCloudWatchCalibrationGroup();
      return;
    }
    this._ensureCloudWatchDebugMaskMeshes();
    this._refreshCloudWatchDebugMasksFromLatest();
    if (this._cloudWatchCalibrationEnabled) {
      this._ensureCloudWatchCalibrationMarkers();
    }
  }

  setCloudWatchDebugMarkers(entries = []) {
    if (!this._cloudWatchDebugEnabled) return;
    this._clearCloudWatchDebugGroup();
    if (!Array.isArray(entries) || entries.length === 0) return;
    const group = new THREE.Group();
    const footprintMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const subpointMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
    const linkMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const ringMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.6 });
    const markerGeom = new THREE.SphereGeometry(20, 8, 8);
    const earthR = this.earthRadiusKm + 16;

    entries.forEach((entry) => {
      const fpLat = entry.footprintLatRad ?? entry.latRad;
      const fpLon = entry.footprintLonRad ?? entry.lonRad;
      const spLat = entry.subpointLatRad;
      const spLon = entry.subpointLonRad;
      if (Number.isFinite(fpLat) && Number.isFinite(fpLon)) {
        const fpLatDeg = THREE.MathUtils.radToDeg(fpLat);
        const fpLonDeg = THREE.MathUtils.radToDeg(fpLon);
        const marker = new THREE.Mesh(markerGeom, footprintMat);
        marker.position.copy(this._latLonToVector3(fpLatDeg, fpLonDeg, earthR));
        group.add(marker);

        const radiusKm = entry.radiusKm;
        if (Number.isFinite(radiusKm) && radiusKm > 0) {
          const ang = radiusKm / this.earthRadiusKm;
          const pts = [];
          const steps = 64;
          for (let i = 0; i <= steps; i++) {
            const brg = (i / steps) * Math.PI * 2;
            const lat2 = Math.asin(
              Math.sin(fpLat) * Math.cos(ang)
              + Math.cos(fpLat) * Math.sin(ang) * Math.cos(brg)
            );
            const lon2 = fpLon + Math.atan2(
              Math.sin(brg) * Math.sin(ang) * Math.cos(fpLat),
              Math.cos(ang) - Math.sin(fpLat) * Math.sin(lat2)
            );
            const latDeg2 = THREE.MathUtils.radToDeg(lat2);
            const lonDeg2 = THREE.MathUtils.radToDeg(lon2);
            pts.push(this._latLonToVector3(latDeg2, lonDeg2, earthR));
          }
          const geom = new THREE.BufferGeometry().setFromPoints(pts);
          const line = new THREE.Line(geom, ringMat);
          group.add(line);
        }
      }

      if (Number.isFinite(spLat) && Number.isFinite(spLon)) {
        const spLatDeg = THREE.MathUtils.radToDeg(spLat);
        const spLonDeg = THREE.MathUtils.radToDeg(spLon);
        const marker = new THREE.Mesh(markerGeom, subpointMat);
        marker.position.copy(this._latLonToVector3(spLatDeg, spLonDeg, earthR));
        group.add(marker);

        if (Number.isFinite(fpLat) && Number.isFinite(fpLon)) {
          const fpVec = this._latLonToVector3(
            THREE.MathUtils.radToDeg(fpLat),
            THREE.MathUtils.radToDeg(fpLon),
            earthR
          );
          const spVec = this._latLonToVector3(spLatDeg, spLonDeg, earthR);
          const lineGeom = new THREE.BufferGeometry().setFromPoints([fpVec, spVec]);
          group.add(new THREE.Line(lineGeom, linkMat));
        }
      }
    });

    this.parentObject.add(group);
    this._cloudWatchDebugGroup = group;
  }

  setCloudWatchDebugFootprints(footprints = []) {
    this.setCloudWatchDebugMarkers(footprints);
  }

  setCloudWatchCalibrationEnabled(enabled) {
    const next = Boolean(enabled);
    if (this._cloudWatchCalibrationEnabled === next) return;
    this._cloudWatchCalibrationEnabled = next;
    if (!next) {
      this._clearCloudWatchCalibrationGroup();
    } else if (this._cloudWatchDebugEnabled) {
      this._ensureCloudWatchCalibrationMarkers();
    }
    this._cloudIntelNeedsRefresh = true;
    if (this.cloudObsVisible) {
      this._refreshCloudIntelTextureForPlayer(this._sensorGating?.playerId);
    }
  }

  clearCloudIntelForPlayer(playerId) {
    const pidRaw = playerId ?? this._sensorGating?.playerId;
    if (pidRaw == null) return false;
    const pid = String(pidRaw);
    const entry = this.cloudIntelByPlayerId.get(pid);
    if (!entry) return false;
    entry.tauLow.fill(0);
    entry.tauHigh.fill(0);
    entry.cloudLow.fill(0);
    entry.cloudHigh.fill(0);
    entry.lastSeenSimTimeSeconds.fill(-1);
    this._cloudIntelStats = null;
    this._cloudIntelNeedsRefresh = true;
    if (this.cloudObsVisible) {
      this._refreshCloudIntelTextureForPlayer(pid);
    }
    if (this._cloudWatchDebugEnabled) {
      this._cloudWatchDebugLiveMask = null;
      this._cloudWatchDebugSeenMask = null;
      this._applyCloudWatchDebugMaskTextures(null, null);
    }
    return true;
  }

  _clearCloudWatchDebugGroup() {
    if (!this._cloudWatchDebugGroup) return;
    this.parentObject.remove(this._cloudWatchDebugGroup);
    this._cloudWatchDebugGroup.traverse((child) => {
      if (child.geometry?.dispose) child.geometry.dispose();
      if (child.material?.dispose) child.material.dispose();
    });
    this._cloudWatchDebugGroup = null;
  }

  _clearCloudWatchCalibrationGroup() {
    if (!this._cloudWatchCalibrationGroup) return;
    this.parentObject.remove(this._cloudWatchCalibrationGroup);
    this._cloudWatchCalibrationGroup.traverse((child) => {
      if (child.geometry?.dispose) child.geometry.dispose();
      if (child.material?.dispose) child.material.dispose();
    });
    this._cloudWatchCalibrationGroup = null;
  }

  _setCloudWatchDebugMaskVisibility(visible) {
    if (this._cloudWatchDebugLiveMesh) this._cloudWatchDebugLiveMesh.visible = visible;
    if (this._cloudWatchDebugSeenMesh) this._cloudWatchDebugSeenMesh.visible = visible;
  }

  _ensureCloudWatchDebugMaskMeshes() {
    if (this._cloudWatchDebugLiveMesh && this._cloudWatchDebugSeenMesh) return;
    const liveGeo = new THREE.SphereGeometry(this.earthRadiusKm + 188, 128, 128);
    const seenGeo = new THREE.SphereGeometry(this.earthRadiusKm + 192, 128, 128);
    const liveMat = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    const seenMat = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const liveMesh = new THREE.Mesh(liveGeo, liveMat);
    const seenMesh = new THREE.Mesh(seenGeo, seenMat);
    liveMesh.rotation.y = CLOUD_OBS_LON_OFFSET_RAD;
    seenMesh.rotation.y = CLOUD_OBS_LON_OFFSET_RAD;
    liveMesh.renderOrder = 9;
    seenMesh.renderOrder = 8;
    liveMesh.visible = false;
    seenMesh.visible = false;
    this.parentObject.add(liveMesh);
    this.parentObject.add(seenMesh);
    this._cloudWatchDebugLiveMesh = liveMesh;
    this._cloudWatchDebugSeenMesh = seenMesh;
  }

  _ensureCloudWatchCalibrationMarkers() {
    if (!this._cloudWatchDebugEnabled) return;
    this._clearCloudWatchCalibrationGroup();
    const points = [
      { latDeg: 0, lonDeg: 0, color: 0xff0000 },
      { latDeg: 0, lonDeg: 90, color: 0x00ff00 },
      { latDeg: 0, lonDeg: 180, color: 0x0000ff },
      { latDeg: 0, lonDeg: -90, color: 0xff00ff }
    ];
    const group = new THREE.Group();
    const geom = new THREE.SphereGeometry(18, 10, 10);
    const earthR = this.earthRadiusKm + 22;
    points.forEach((pt) => {
      const mat = new THREE.MeshBasicMaterial({ color: pt.color });
      const marker = new THREE.Mesh(geom, mat);
      marker.position.copy(this._latLonToVector3(pt.latDeg, pt.lonDeg, earthR));
      group.add(marker);
    });
    this.parentObject.add(group);
    this._cloudWatchCalibrationGroup = group;
  }

  _paintCloudCalibrationTexture({ grid, cache }) {
    const { ctx, imageData, width: w, height: h } = cache;
    const data = imageData.data;
    data.fill(0);
    const nx = grid.nx;
    const ny = grid.ny;
    const cellLonDeg = 360 / nx;
    const cellLatDeg = 180 / ny;
    const points = [
      { latDeg: 0, lonDeg: 0, color: [255, 0, 0] },
      { latDeg: 0, lonDeg: 90, color: [0, 255, 0] },
      { latDeg: 0, lonDeg: 180, color: [0, 0, 255] },
      { latDeg: 0, lonDeg: -90, color: [255, 0, 255] }
    ];
    const paintDot = (x, y, color) => {
      for (let dy = -2; dy <= 2; dy++) {
        const yy = Math.max(0, Math.min(h - 1, y + dy));
        for (let dx = -2; dx <= 2; dx++) {
          const xx = Math.max(0, Math.min(w - 1, x + dx));
          const idx = (yy * w + xx) * 4;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
          data[idx + 3] = 255;
        }
      }
    };
    const lonOffsetDeg = CLOUD_WATCH_GRID_LON_OFFSET_RAD * (180 / Math.PI);
    points.forEach((pt) => {
      let lon = pt.lonDeg + lonOffsetDeg;
      if (lon >= 180) lon -= 360;
      if (lon < -180) lon += 360;
      const i = (lon + 180) / cellLonDeg - 0.5;
      const j = (90 - pt.latDeg) / cellLatDeg - 0.5;
      const x = Math.round((i / nx) * w);
      const y = Math.round((j / ny) * h);
      paintDot(x, y, pt.color);
    });
    ctx.putImageData(imageData, 0, 0);
    cache.texture.needsUpdate = true;
  }

  _applyCloudWatchDebugMaskTextures(liveTexture, seenTexture) {
    if (this._cloudWatchDebugLiveMesh) {
      this._applyCloudObsTextureTransform(liveTexture);
      this._cloudWatchDebugLiveMesh.material.map = liveTexture || null;
      this._cloudWatchDebugLiveMesh.material.needsUpdate = true;
      this._cloudWatchDebugLiveMesh.visible = Boolean(this._cloudWatchDebugEnabled && liveTexture);
    }
    if (this._cloudWatchDebugSeenMesh) {
      this._applyCloudObsTextureTransform(seenTexture);
      this._cloudWatchDebugSeenMesh.material.map = seenTexture || null;
      this._cloudWatchDebugSeenMesh.material.needsUpdate = true;
      this._cloudWatchDebugSeenMesh.visible = Boolean(this._cloudWatchDebugEnabled && seenTexture);
    }
  }

  _applyCloudObsTextureTransform(texture) {
    if (!texture) return;
    if (CLOUD_OBS_FLIP_X) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.set(-1, 1);
      texture.offset.set(1, 0);
    } else {
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.offset.set(0, 0);
    }
    texture.needsUpdate = true;
  }

  _updateCloudWatchDebugMasks({ liveMask, seenMask, grid }) {
    if (!this._cloudWatchDebugEnabled || !grid) return;
    this._ensureCloudWatchDebugMaskMeshes();
    const nx = grid.nx;
    const ny = grid.ny;
    let liveTexture = null;
    let seenTexture = null;
    if (liveMask) {
      const liveResult = paintGridToTexture({
        nx,
        ny,
        values: liveMask,
        mask: null,
        textureCache: this._cloudWatchDebugLiveCache,
        options: {
          valueMin: 0,
          valueMax: 1,
          alphaScale: 0.9,
          alphaByValue: true,
          colorMap: () => ({ r: 40, g: 255, b: 180 }),
          scale: 2
        }
      });
      if (liveResult) {
        this._cloudWatchDebugLiveCache = liveResult.cache;
        liveTexture = liveResult.texture;
      }
    }
    if (seenMask) {
      const seenResult = paintGridToTexture({
        nx,
        ny,
        values: seenMask,
        mask: null,
        textureCache: this._cloudWatchDebugSeenCache,
        options: {
          valueMin: 0,
          valueMax: 1,
          alphaScale: 0.35,
          alphaByValue: true,
          colorMap: () => ({ r: 120, g: 160, b: 255 }),
          scale: 2
        }
      });
      if (seenResult) {
        this._cloudWatchDebugSeenCache = seenResult.cache;
        seenTexture = seenResult.texture;
      }
    }
    this._applyCloudWatchDebugMaskTextures(liveTexture, seenTexture);
  }

  _refreshCloudWatchDebugMasksFromLatest() {
    if (!this._cloudWatchDebugEnabled) return;
    const pid = this._sensorGating?.playerId;
    const entry = pid ? this.cloudIntelByPlayerId.get(String(pid)) : null;
    const obs = this.getLatestWeatherObservation('cloudSat');
    const grid = this.weatherField?.core?.grid;
    const nx = grid?.nx ?? 0;
    const ny = grid?.ny ?? 0;
    if (!entry || !obs || !nx || !ny) {
      this._applyCloudWatchDebugMaskTextures(null, null);
      return;
    }
    const N = nx * ny;
    const liveMask = new Float32Array(N);
    const seenMask = new Float32Array(N);
    const masks = [
      obs.products?.tauLow?.mask,
      obs.products?.tauHigh?.mask,
      obs.products?.cloudLow?.mask,
      obs.products?.cloudHigh?.mask
    ].filter(Boolean);
    for (let k = 0; k < N; k++) {
      let m = 0;
      for (let i = 0; i < masks.length; i++) {
        const w = masks[i][k];
        if (w > m) m = w;
      }
      liveMask[k] = m;
      seenMask[k] = entry.lastSeenSimTimeSeconds[k] >= 0 ? 1 : 0;
    }
    this._cloudWatchDebugLiveMask = liveMask;
    this._cloudWatchDebugSeenMask = seenMask;
    this._updateCloudWatchDebugMasks({ liveMask, seenMask, grid });
  }

  _getOrCreateCloudIntel(playerId, N) {
    if (!playerId || !N) return null;
    const pid = String(playerId);
    let entry = this.cloudIntelByPlayerId.get(pid);
    if (!entry || entry.count !== N) {
      entry = {
        count: N,
        tauLow: new Float32Array(N),
        tauHigh: new Float32Array(N),
        cloudLow: new Float32Array(N),
        cloudHigh: new Float32Array(N),
        lastSeenSimTimeSeconds: new Float32Array(N)
      };
      entry.lastSeenSimTimeSeconds.fill(-1);
      this.cloudIntelByPlayerId.set(pid, entry);
    }
    return entry;
  }

  _updateCloudIntelFromObservation(obsSet) {
    const playerId = this._sensorGating?.playerId;
    if (!playerId) return;
    const truthCore = this.weatherField?.core;
    const N = truthCore?.grid?.count ?? 0;
    if (!N) return;
    const entry = this._getOrCreateCloudIntel(playerId, N);
    if (!entry) return;

    const tauLow = obsSet.products?.tauLow;
    const tauHigh = obsSet.products?.tauHigh;
    const cloudLow = obsSet.products?.cloudLow;
    const cloudHigh = obsSet.products?.cloudHigh;
    const masks = [
      tauLow?.mask,
      tauHigh?.mask,
      cloudLow?.mask,
      cloudHigh?.mask
    ].filter(Boolean);
    const data = {
      tauLow: tauLow?.data,
      tauHigh: tauHigh?.data,
      cloudLow: cloudLow?.data,
      cloudHigh: cloudHigh?.data
    };
    const t = Number.isFinite(obsSet.t) ? obsSet.t : null;
    const hasData = data.tauLow || data.tauHigh || data.cloudLow || data.cloudHigh;
    if (!Number.isFinite(t) || !hasData) return;

    const debugEnabled = this._cloudWatchDebugEnabled;
    const liveMask = debugEnabled ? new Float32Array(N) : null;
    const seenMask = debugEnabled ? new Float32Array(N) : null;
    let coverageCount = 0;
    let observedCount = 0;
    const lastSeen = entry.lastSeenSimTimeSeconds;
    for (let k = 0; k < N; k++) {
      let m = 0;
      for (let i = 0; i < masks.length; i++) {
        const w = masks[i][k];
        if (w > m) m = w;
      }
      if (debugEnabled) liveMask[k] = m;
      if (m > 0) {
        coverageCount += 1;
        if (data.tauLow) entry.tauLow[k] = data.tauLow[k];
        if (data.tauHigh) entry.tauHigh[k] = data.tauHigh[k];
        if (data.cloudLow) entry.cloudLow[k] = data.cloudLow[k];
        if (data.cloudHigh) entry.cloudHigh[k] = data.cloudHigh[k];
        lastSeen[k] = t;
      }
      if (lastSeen[k] >= 0) observedCount += 1;
      if (debugEnabled) seenMask[k] = lastSeen[k] >= 0 ? 1 : 0;
    }

    this._cloudIntelStats = {
      playerId: String(playerId),
      coverageFrac: N ? coverageCount / N : 0,
      observedFrac: N ? observedCount / N : 0,
      lastUpdateSimTimeSeconds: t,
      coverageCount,
      observedCount,
      count: N
    };
    this.logWeatherEvent?.(
      'cloudIntelUpdate',
      {
        playerId: String(playerId),
        coverageFrac: this._cloudIntelStats.coverageFrac,
        observedFrac: this._cloudIntelStats.observedFrac,
        coverageCount,
        observedCount,
        count: N
      },
      { simTimeSeconds: t, core: truthCore }
    );

    if (debugEnabled) {
      this._cloudWatchDebugLiveMask = liveMask;
      this._cloudWatchDebugSeenMask = seenMask;
      this._updateCloudWatchDebugMasks({ liveMask, seenMask, grid: truthCore?.grid });
    }
  }

  _refreshCloudIntelTextureForPlayer(playerId, simTimeSeconds = null) {
    if (!this.cloudObsVisible) return;
    const pid = playerId != null ? String(playerId) : null;
    if (!pid) {
      this.setCloudObsTexture(null);
      return;
    }
    const entry = this.cloudIntelByPlayerId.get(pid);
    if (!entry) {
      this.setCloudObsTexture(null);
      return;
    }
    const grid = this.weatherField?.core?.grid;
    const nx = grid?.nx ?? 0;
    const ny = grid?.ny ?? 0;
    if (!nx || !ny) return;
    const now = Number.isFinite(simTimeSeconds) ? simTimeSeconds : this._lastSimTimeSeconds;
    if (!Number.isFinite(now)) return;
    const cache = this._ensureCloudIntelRenderTarget(nx, ny);
    if (!cache) return;
    if (this._cloudWatchCalibrationEnabled) {
      this._paintCloudCalibrationTexture({ grid, cache });
      this._cloudIntelTextureCache = cache;
      this.setCloudObsTexture(cache.texture);
      return;
    }
    this._paintCloudIntelTexture({
      entry,
      grid,
      now,
      cache
    });
    this._cloudIntelTextureCache = cache;
    this.setCloudObsTexture(cache.texture);
  }

  _ensureCloudIntelRenderTarget(nx, ny) {
    const scale = CLOUD_INTEL_RENDER_SCALE;
    const width = nx * scale;
    const height = ny * scale;
    let cache = this._cloudIntelTextureCache;
    if (!cache || cache.width !== width || cache.height !== height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(width, height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      cache = { canvas, ctx, imageData, texture, width, height, scale };
    }
    return cache;
  }

  _paintCloudIntelTexture({ entry, grid, now, cache }) {
    const { ctx, imageData, width: w, height: h } = cache;
    const data = imageData.data;
    data.fill(0);
    const {
      aLow,
      aHigh,
      gammaLow,
      gammaHigh,
      tauBrightLow,
      tauBrightHigh,
      tauEdgeLow,
      tauEdgeHigh,
      alphaHighCap
    } = CLOUD_INTEL_RENDER_PARAMS;
    const noiseScaleLow = 0.015;
    const noiseScaleHigh = 0.01;
    const fadeSeconds = this.cloudIntelFadeSeconds;
    const mode = this.cloudObsProduct;

    const hash = (x, y, t) => {
      const s = Math.sin(x * 127.1 + y * 311.7 + t * 0.1) * 43758.5453;
      return s - Math.floor(s);
    };
    const fbm = (x, y, t) => {
      let v = 0;
      let a = 0.5;
      let f = 1.0;
      for (let o = 0; o < 4; o++) {
        v += a * hash(x * f, y * f, t);
        f *= 2.0;
        a *= 0.5;
      }
      return v;
    };

    const nx = grid.nx;
    const ny = grid.ny;
    const lastSeen = entry.lastSeenSimTimeSeconds;

    for (let y = 0; y < h; y++) {
      const lat = (y / h) * ny;
      const j = Math.max(0, Math.min(ny - 1, Math.floor(lat)));
      for (let x = 0; x < w; x++) {
        const lon = (x / w) * nx;
        const lonWrapped = ((lon % nx) + nx) % nx;
        const latClamped = Math.max(0, Math.min(ny - 1, lat));
        const i0 = Math.floor(lonWrapped);
        const j0 = Math.floor(latClamped);
        const i1 = (i0 + 1) % nx;
        const j1 = Math.min(ny - 1, j0 + 1);
        const fi = lonWrapped - i0;
        const fj = latClamped - j0;
        const w00 = (1 - fi) * (1 - fj);
        const w10 = fi * (1 - fj);
        const w01 = (1 - fi) * fj;
        const w11 = fi * fj;
        const k00 = j0 * nx + i0;
        const k10 = j0 * nx + i1;
        const k01 = j1 * nx + i0;
        const k11 = j1 * nx + i1;

        const sample = (field) =>
          field[k00] * w00 + field[k10] * w10 + field[k01] * w01 + field[k11] * w11;

        const ls00 = lastSeen[k00];
        const ls10 = lastSeen[k10];
        const ls01 = lastSeen[k01];
        const ls11 = lastSeen[k11];
        const seen00 = ls00 >= 0 ? 1 : 0;
        const seen10 = ls10 >= 0 ? 1 : 0;
        const seen01 = ls01 >= 0 ? 1 : 0;
        const seen11 = ls11 >= 0 ? 1 : 0;
        const seen = seen00 * w00 + seen10 * w10 + seen01 * w01 + seen11 * w11;
        if (seen <= 0.001) {
          continue;
        }
        const lsSample = Math.max(0, ls00) * w00 + Math.max(0, ls10) * w10 + Math.max(0, ls01) * w01 + Math.max(0, ls11) * w11;
        const age = Math.max(0, now - lsSample);
        const staleAlpha = Math.max(0, Math.min(1, 1 - age / fadeSeconds)) * seen;
        if (staleAlpha <= 0.001) {
          continue;
        }

        const cloudLow = sample(entry.cloudLow);
        const cloudHigh = sample(entry.cloudHigh);
        const tauLow = sample(entry.tauLow);
        const tauHigh = sample(entry.tauHigh);

        let lowAlpha = 0;
        let highAlpha = 0;
        let lowColor = 0;
        let highColor = 0;

        if (mode === 'cloudLow') {
          lowColor = Math.max(0, Math.min(255, Math.round(cloudLow * 255)));
          lowAlpha = 1;
        } else if (mode === 'cloudHigh') {
          highColor = Math.max(0, Math.min(255, Math.round(cloudHigh * 255)));
          highAlpha = 1;
        } else if (mode === 'tauLow') {
          lowColor = Math.max(0, Math.min(255, Math.round((tauLow / 50) * 255)));
          lowAlpha = 1;
        } else if (mode === 'tauHigh') {
          highColor = Math.max(0, Math.min(255, Math.round((tauHigh / 50) * 255)));
          highAlpha = 1;
        } else {
          const nLow = fbm(lon * noiseScaleLow, lat * noiseScaleLow, now);
          const nHigh = fbm(lon * noiseScaleHigh, lat * noiseScaleHigh, now);

          const tauEffLow = Math.max(0, tauLow);
          const aBaseLow = Math.pow(cloudLow, gammaLow) * aLow;
          lowAlpha = Math.max(0, Math.min(1, aBaseLow));
          const brightLow = 1 - Math.exp(-tauEffLow / tauBrightLow);
          let valueLow = lowAlpha * (0.55 + 0.45 * brightLow);
          if (tauEdgeLow > 0) {
            const edge = 1 - Math.exp(-tauEffLow * tauEdgeLow);
            valueLow *= 0.90 + 0.10 * edge;
          }
          const shadeLow = 230 + Math.floor(24 * (nLow - 0.5));
          lowColor = Math.max(0, Math.min(255, Math.floor(shadeLow * valueLow)));

          const tauEffHigh = Math.max(0, tauHigh);
          const aBaseHigh = Math.pow(cloudHigh, gammaHigh) * aHigh;
          highAlpha = Math.max(0, Math.min(alphaHighCap, aBaseHigh));
          const brightHigh = 1 - Math.exp(-tauEffHigh / tauBrightHigh);
          let valueHigh = highAlpha * (0.55 + 0.45 * brightHigh);
          if (tauEdgeHigh > 0) {
            const edge = 1 - Math.exp(-tauEffHigh * tauEdgeHigh);
            valueHigh *= 0.90 + 0.10 * edge;
          }
          const shadeHigh = 240 + Math.floor(20 * (nHigh - 0.5));
          highColor = Math.max(0, Math.min(255, Math.floor(shadeHigh * valueHigh)));
        }

        lowAlpha *= staleAlpha;
        highAlpha *= staleAlpha;

        const outAlpha = highAlpha + lowAlpha * (1 - highAlpha);
        if (outAlpha <= 0) continue;
        const outColor = Math.max(0, Math.min(255, Math.round(highColor + lowColor * (1 - highAlpha))));

        const idx = (y * w + x) * 4;
        data[idx] = outColor;
        data[idx + 1] = outColor;
        data[idx + 2] = outColor;
        data[idx + 3] = Math.round(255 * outAlpha);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    cache.texture.needsUpdate = true;
  }

  _tickCloudIntel(simTimeSeconds) {
    if (!this.cloudObsVisible) return;
    const pid = this._sensorGating?.playerId;
    if (!pid) return;
    const lastPaint = this._lastCloudIntelPaintSimTimeSeconds;
    const needsRefresh = this._cloudIntelNeedsRefresh
      || (Number.isFinite(lastPaint) ? simTimeSeconds - lastPaint > 300 : true);
    if (!needsRefresh) return;
    this._refreshCloudIntelTextureForPlayer(pid, simTimeSeconds);
    this._cloudIntelNeedsRefresh = false;
    this._lastCloudIntelPaintSimTimeSeconds = simTimeSeconds;
  }

  getCloudIntelStatus() {
    return this._cloudIntelStats ? { ...this._cloudIntelStats } : null;
  }

  getSensorStatus(simTimeSeconds = null) {
    const now = Number.isFinite(simTimeSeconds) ? simTimeSeconds : this._lastSimTimeSeconds;
    const active = [];
    for (const [id, last] of this._sensorLastObsById.entries()) {
      const cadence = this._sensorCadenceById.get(id) ?? 0;
      if (!Number.isFinite(now) || !Number.isFinite(last)) continue;
      if (now - last <= cadence * 1.5 + 1) {
        active.push(id);
      }
    }
    return {
      activeSensors: active,
      cloudIntel: this.getCloudIntelStatus()
    };
  }

  setForecastOverlayVisible(visible) {
    this.forecastOverlayVisible = Boolean(visible);
    if (!this.forecastOverlayVisible) {
      this._applyForecastOverlayTexture(null);
      return;
    }
    this._refreshForecastOverlayTextureForPlayer();
  }

  setForecastDisplayProduct(product) {
    const allowed = ['cloudTau', 'precipRate', 'confidence', 'windSpeed'];
    const next = allowed.includes(product) ? product : 'cloudTau';
    if (this.forecastDisplayProduct === next) return;
    this.forecastDisplayProduct = next;
    this._refreshForecastOverlayTextureForPlayer();
  }

  setForecastDisplayLeadHours(hours) {
    const lead = Number(hours);
    const allowed = DEFAULT_FORECAST_LEAD_HOURS;
    const next = allowed.includes(lead) ? lead : allowed[0];
    if (this.forecastDisplayLeadHours === next) return;
    this.forecastDisplayLeadHours = next;
    this._refreshForecastOverlayTextureForPlayer();
  }

  _applyForecastOverlayTexture(texture) {
    if (!this.forecastOverlayMaterial) return;
    this.forecastOverlayMaterial.map = texture || null;
    this.forecastOverlayMaterial.needsUpdate = true;
    if (this.forecastOverlayMesh) {
      this.forecastOverlayMesh.visible = this.forecastOverlayVisible && !!texture;
    }
  }

  _refreshForecastOverlayTextureForPlayer(playerId) {
    const pidRaw = playerId ?? this._forecastDisplayPlayerId ?? this._sensorGating?.playerId;
    const pid = pidRaw != null ? String(pidRaw) : null;
    if (!pid) {
      this._applyForecastOverlayTexture(null);
      return;
    }
    const forecast = this.latestForecastByPlayerId.get(pid);
    if (!forecast) {
      this._applyForecastOverlayTexture(null);
      return;
    }
    const leadIdx = forecast.leadHours.indexOf(this.forecastDisplayLeadHours);
    if (leadIdx < 0) {
      this._applyForecastOverlayTexture(null);
      return;
    }

    let values = null;
    let options = null;
    if (this.forecastDisplayProduct === 'cloudTau') {
      values = forecast.products.cloudTauByLead?.[leadIdx];
      options = {
        valueMin: 0,
        valueMax: 20,
        alphaScale: 0.85,
        alphaByValue: true,
        scale: 2
      };
    } else if (this.forecastDisplayProduct === 'precipRate') {
      values = forecast.products.precipRateByLead?.[leadIdx];
      options = {
        valueMin: 0,
        valueMax: 50,
        alphaScale: 0.95,
        alphaByValue: true,
        colorMap: PRECIP_COLOR_MAP,
        scale: 2
      };
    } else if (this.forecastDisplayProduct === 'confidence') {
      values = forecast.products.confidenceByLead?.[leadIdx];
      options = {
        valueMin: 0,
        valueMax: 1,
        alphaScale: 0.9,
        alphaByValue: true,
        colorMap: CONFIDENCE_COLOR_MAP,
        scale: 2
      };
    } else if (this.forecastDisplayProduct === 'windSpeed') {
      values = forecast.products.windSpeedByLead?.[leadIdx];
      options = {
        valueMin: 0,
        valueMax: 40,
        alphaScale: 0.9,
        alphaByValue: true,
        colorMap: WIND_COLOR_MAP,
        scale: 2
      };
    }
    if (!values) {
      this._applyForecastOverlayTexture(null);
      return;
    }

    const result = paintGridToTexture({
      nx: forecast.grid.nx,
      ny: forecast.grid.ny,
      values,
      mask: null,
      textureCache: this._forecastTextureCache,
      options
    });
    if (!result) {
      this._applyForecastOverlayTexture(null);
      return;
    }
    this._forecastTextureCache = result.cache;
    this._applyForecastOverlayTexture(result.texture);
  }

  logWeatherEvent(event, payload, { simTimeSeconds, core } = {}) {
    const logger = this.weatherField?.logger;
    const logCore = core ?? this.weatherField?.core;
    if (!logger?.recordEvent || !logCore) return false;
    return logger.recordEvent(
      event,
      { simTimeSeconds: Number.isFinite(simTimeSeconds) ? simTimeSeconds : logCore.timeUTC },
      logCore,
      payload
    );
  }

  getCloudSatStats() {
    const obs = this.getLatestWeatherObservation('cloudSat');
    if (!obs?.products) return null;
    const stats = {};
    ['tauHigh', 'cloudHigh'].forEach((name) => {
      const product = obs.products?.[name];
      if (!product || product.kind !== 'grid2d' || !product.data) return;
      const values = product.data;
      const mask = product.mask;
      const N = values.length;
      if (!N) return;
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      let masked = 0;
      for (let i = 0; i < N; i++) {
        const v = values[i];
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        if (mask && mask[i] === 0) masked += 1;
      }
      stats[name] = {
        min,
        max,
        mean: sum / N,
        maskedFrac: mask ? masked / N : 0
      };
    });
    return Object.keys(stats).length ? stats : null;
  }

  logCloudSatStats(label = '') {
    const stats = this.getCloudSatStats();
    if (!stats) {
      console.log('[cloudSat] no latest observation yet');
      return;
    }
    const tag = label ? ` ${label}` : '';
    Object.entries(stats).forEach(([name, s]) => {
      const min = Number.isFinite(s.min) ? s.min.toFixed(2) : 'n/a';
      const mean = Number.isFinite(s.mean) ? s.mean.toFixed(2) : 'n/a';
      const max = Number.isFinite(s.max) ? s.max.toFixed(2) : 'n/a';
      const maskedPct = Number.isFinite(s.maskedFrac) ? (s.maskedFrac * 100).toFixed(1) : '0.0';
      console.log(`[cloudSat]${tag} ${name}: min=${min} mean=${mean} max=${max} (masked ${maskedPct}%)`);
    });
  }

  debugCloudSatMappingProbe() {
    const obs = this.getLatestWeatherObservation('cloudSat');
    if (!obs?.products) {
      console.log('[cloudSat mapprobe] no latest observation yet');
      return;
    }
    const productName = this.cloudObsProduct === 'cloudHigh' ? 'cloudHigh' : 'tauHigh';
    const product = obs.products?.[productName];
    if (!product || product.kind !== 'grid2d') {
      console.log(`[cloudSat mapprobe] missing product ${productName}`);
      return;
    }
    const grid = product.meta?.grid || this.weatherField?.core?.grid;
    const nx = grid?.nx ?? 0;
    const ny = grid?.ny ?? 0;
    if (!nx || !ny) {
      console.log('[cloudSat mapprobe] grid dims missing');
      return;
    }
    const cellLatDeg = grid?.cellLatDeg ?? 180 / ny;
    const iMid = Math.floor(nx / 2);
    const jEquator = Math.floor(ny / 2);
    const jNorth = Math.floor(ny * 0.25);
    const jSouth = Math.floor(ny * 0.75);

    const kNorth = jNorth * nx + iMid;
    const kEq = jEquator * nx + iMid;
    const kSouth = jSouth * nx + iMid;

    const latFromJ = (j) => 90 - (j + 0.5) * cellLatDeg;

    console.log(`[cloudSat mapprobe] nx=${nx} ny=${ny} j=0 is NORTH`);
    console.log(`[cloudSat mapprobe] north(~${latFromJ(jNorth).toFixed(1)}): val=${product.data[kNorth].toFixed(3)}`);
    console.log(`[cloudSat mapprobe] equator(~${latFromJ(jEquator).toFixed(1)}): val=${product.data[kEq].toFixed(3)}`);
    console.log(`[cloudSat mapprobe] south(~${latFromJ(jSouth).toFixed(1)}): val=${product.data[kSouth].toFixed(3)}`);
  }

  setPlayerWarnings(playerId, warningsArray) {
    void playerId;
    const warnings = Array.isArray(warningsArray) ? warningsArray : [];
    const nextIds = new Set();
    const radius = this.earthRadiusKm + 260;
    const maxSegAngle = THREE.MathUtils.degToRad(5);
    const colorByHazard = {
      heavyPrecip: 0x33aaff,
      highWinds: 0xffd34d,
      severeStormRisk: 0xff3388
    };

    warnings.forEach((warning) => {
      if (!warning?.id || !Array.isArray(warning.polygonLatLonDeg)) return;
      const vertices = warning.polygonLatLonDeg;
      if (vertices.length < 3) return;
      nextIds.add(warning.id);

      const existing = this.warningMeshesById.get(warning.id);
      if (existing) {
        this.parentObject.remove(existing);
        existing.geometry?.dispose?.();
        existing.material?.dispose?.();
        this.warningMeshesById.delete(warning.id);
      }

      const points = [];
      for (let i = 0; i < vertices.length; i++) {
        const v0 = vertices[i];
        const v1 = vertices[(i + 1) % vertices.length];
        const a = this._latLonDegToUnitVector(v0.latDeg, v0.lonDeg);
        const b = this._latLonDegToUnitVector(v1.latDeg, v1.lonDeg);
        const dot = Math.max(-1, Math.min(1, a.dot(b)));
        const omega = Math.acos(dot);
        const segments = Math.min(64, Math.max(2, Math.ceil(omega / maxSegAngle)));
        for (let s = 0; s <= segments; s++) {
          if (i > 0 && s === 0) continue;
          const t = s / segments;
          const p = this._slerpUnitVectors(a, b, t).multiplyScalar(radius);
          points.push(p);
        }
      }
      if (points.length > 0) {
        const first = points[0];
        const last = points[points.length - 1];
        if (first.distanceTo(last) > 1e-3) {
          points.push(first.clone());
        }
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const color = colorByHazard[warning.hazardType] ?? 0xffffff;
      const isDraft = warning.status === 'draft' || warning.isDraft === true;
      const material = isDraft
        ? new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity: 0.45,
          dashSize: 120,
          gapSize: 80
        })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(geometry, material);
      if (isDraft && geometry.computeLineDistances) {
        geometry.computeLineDistances();
      }
      line.renderOrder = 6;
      this.parentObject.add(line);
      this.warningMeshesById.set(warning.id, line);
    });

    for (const [id, mesh] of this.warningMeshesById.entries()) {
      if (nextIds.has(id)) continue;
      this.parentObject.remove(mesh);
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
      this.warningMeshesById.delete(id);
    }
  }

  setRadarOverlayVisible(visible) {
    this.radarOverlayVisible = Boolean(visible);
    if (this.radarOverlay?.mesh) this.radarOverlay.mesh.visible = this.radarOverlayVisible;
  }

  setGroundRadarOriginProvider(fn) {
    this._groundRadarOriginProvider = typeof fn === 'function' ? fn : null;
  }

  getGroundRadarPpiPass() {
    return this._groundRadarPpiPass;
  }

  getGroundRadarOriginLatLonRad(simTimeSeconds) {
    void simTimeSeconds;
    const hq = this._sensorGating?.hqSites?.[0];
    if (hq && Number.isFinite(hq.latRad) && Number.isFinite(hq.lonRad)) {
      return { latRad: hq.latRad, lonRad: hq.lonRad, source: 'hq' };
    }
    return null;
  }

  renderGroundRadarObservation(simTimeSeconds) {
    if (!Number.isFinite(simTimeSeconds)) return null;
    if (!this._groundRadarPpiPass) {
      this._initGroundRadarPpi();
    }
    const pass = this._groundRadarPpiPass;
    if (!pass) return null;
    const origin = this.getGroundRadarOriginLatLonRad(simTimeSeconds);
    if (!origin) {
      if (this.radarOverlay?.mesh) this.radarOverlay.mesh.visible = false;
      return null;
    }
    pass.setOriginLatLonRad(origin.latRad, origin.lonRad);
    this.updateRadarOverlayOrigin(origin.latRad, origin.lonRad);
    if (this.radarOverlay?.mesh) {
      this.radarOverlay.mesh.visible = this.radarOverlayVisible;
    }
    const rendered = pass.render({ simTimeSeconds });
    if (rendered) {
      this.updateRadarOverlayTexture(pass.renderTarget?.texture ?? null);
    }
    return pass.renderTarget?.texture ?? null;
  }

  _initGroundRadarPpi() {
    if (!this._sensorRenderer || !this.weatherVolumeGpu?.isSupported?.()) return;
    if (this._groundRadarPpiPass) return;
    this._groundRadarPpiPass = new RadarPpiPass({
      renderer: this._sensorRenderer,
      volume: this.weatherVolumeGpu,
      specs: DEFAULT_GROUND_DOPPLER_SPECS
    });
    this.setRadarOverlay(this._groundRadarPpiPass, {
      radiusOffsetKm: 12,
      opacity: 1.0,
      backgroundAlpha: 0.10,
      backgroundColor: [0.0, 0.0, 0.0],
      edgeFadeFrac: 0.03
    });
    this.setRadarOverlayVisible(this.radarOverlayVisible);
  }

  _syncGroundRadarOrigin(simTimeSeconds) {
    const pass = this._groundRadarPpiPass;
    if (!pass || !this.radarOverlay) return;
    const origin = this.getGroundRadarOriginLatLonRad(simTimeSeconds);
    if (!origin) {
      if (this.radarOverlay?.mesh) this.radarOverlay.mesh.visible = false;
      return;
    }

    const lat = origin.latRad;
    const lon = origin.lonRad;
    pass.setOriginLatLonRad(lat, lon);
    this.updateRadarOverlayOrigin(lat, lon);
    if (this.radarOverlay?.mesh) {
      this.radarOverlay.mesh.visible = this.radarOverlayVisible;
    }

    const prev = this._lastRadarOrigin;
    const changed = !prev
      || Math.abs(prev.latRad - lat) > 1e-6
      || Math.abs(prev.lonRad - lon) > 1e-6;
    if (changed) {
      this._lastRadarOrigin = { latRad: lat, lonRad: lon };
      pass.lastRenderSimTime = null;
      const rendered = pass.render({ simTimeSeconds });
      if (rendered) {
        this.updateRadarOverlayTexture(pass.renderTarget?.texture ?? null);
      }
    }
  }

  _latLonToVector3(latDeg, lonDeg, radius) {
    const latRad = THREE.MathUtils.degToRad(latDeg);
    const lonRad = THREE.MathUtils.degToRad(lonDeg);
    const cosLat = Math.cos(latRad);
    return new THREE.Vector3(
      radius * cosLat * Math.sin(lonRad),
      radius * Math.sin(latRad),
      radius * cosLat * Math.cos(lonRad)
    );
  }

  _latLonDegToUnitVector(latDeg, lonDeg) {
    const v = this._latLonToVector3(latDeg, lonDeg, 1);
    return v.normalize();
  }

  _slerpUnitVectors(a, b, t) {
    const dot = Math.max(-1, Math.min(1, a.dot(b)));
    const omega = Math.acos(dot);
    if (omega < 1e-6) return a.clone();
    const sinOmega = Math.sin(omega);
    const s0 = Math.sin((1 - t) * omega) / sinOmega;
    const s1 = Math.sin(t * omega) / sinOmega;
    return a.clone().multiplyScalar(s0).add(b.clone().multiplyScalar(s1));
  }

  _colorizeStationPs(anomPa) {
    const range = 3000;
    const t = Math.max(-1, Math.min(1, anomPa / range));
    const abs = Math.abs(t);
    const r = t > 0 ? 0.3 + 0.7 * abs : 0.3;
    const b = t < 0 ? 0.3 + 0.7 * abs : 0.3;
    const g = 0.3 + 0.4 * (1 - abs);
    return { r, g, b };
  }

  initRadarVolume(renderer, options = {}) {
    if (!renderer || !this.weatherField?.core) return;
    this.weatherVolumeGpu = new WeatherVolumeGpu({ renderer, core: this.weatherField.core, options });
    if (renderer) this._sensorRenderer = renderer;
    if (options.debug && this.weatherVolumeGpu?.isSupported()) {
      this.weatherVolumeDebugView = new WeatherVolumeDebugView({
        renderer,
        volume: this.weatherVolumeGpu,
        options: { camera: this.camera }
      });
    }
    if (this._weatherSensorsInitialized) {
      this._initGroundRadarPpi();
    }
  }

  setRadarOverlay(ppiPass, options = {}) {
    if (this.radarOverlay) {
      this.parentObject.remove(this.radarOverlay.mesh);
      this.radarOverlay.dispose();
      this.radarOverlay = null;
    }
    if (!ppiPass) return;
    this.radarOverlay = new RadarPpiOverlay({
      ppiPass,
      earthRadiusKm: this.earthRadiusKm,
      options
    });
    this.parentObject.add(this.radarOverlay.mesh);
  }

  updateRadarOverlayOrigin(lat0Rad, lon0Rad) {
    this.radarOverlay?.setOriginLatLonRad(lat0Rad, lon0Rad);
  }

  updateRadarOverlayTexture(texture) {
    if (texture && this.radarOverlay?.mesh?.material?.uniforms?.ppiTex) {
      this.radarOverlay.mesh.material.uniforms.ppiTex.value = texture;
      return;
    }
    this.radarOverlay?.updateTexture();
  }

  createLatLines() {
    const lines = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff }); // Blue for latitude

    // Latitude lines
    for (let lat = -80; lat <= 80; lat += 10) {
      const radius = this.earthRadiusKm * Math.cos(THREE.MathUtils.degToRad(lat));
      const latitudeGeometry = new THREE.CircleGeometry(radius, 64);
      latitudeGeometry.deleteAttribute('normal');
      latitudeGeometry.deleteAttribute('uv');
      const vertices = latitudeGeometry.attributes.position.array;
      const latitudeVertices = Array.from(vertices).slice(3); // Remove the center vertex
      const latitudeBufferGeometry = new THREE.BufferGeometry();
      latitudeBufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(latitudeVertices, 3));
      latitudeBufferGeometry.rotateX(THREE.MathUtils.degToRad(90));
      const latitudeLine = new THREE.Line(latitudeBufferGeometry, material);
      latitudeLine.position.y = this.earthRadiusKm * Math.sin(THREE.MathUtils.degToRad(lat));
      lines.add(latitudeLine);
    }

    this.parentObject.add(lines);
    return lines;
  }

  createLongLines() {
    const lines = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red for longitude

    // Longitude lines
    for (let lon = 0; lon < 360; lon += 10) {
      const longitudeGeometry = new THREE.BufferGeometry();
      const vertices = [];
      for (let lat = -90; lat <= 90; lat += 1) {
        const theta = THREE.MathUtils.degToRad(lat);
        const phi = THREE.MathUtils.degToRad(lon);
        vertices.push(
          this.earthRadiusKm * Math.cos(theta) * Math.sin(phi),
          this.earthRadiusKm * Math.sin(theta),
          this.earthRadiusKm * Math.cos(theta) * Math.cos(phi)
        );
      }
      longitudeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const longitudeLine = new THREE.Line(longitudeGeometry, material);
      lines.add(longitudeLine);
    }

    this.parentObject.add(lines);
    return lines;
  }

    addHQSphere(position, hqSpheresRef, currentPlayerRef) {
        // Raycaster gives a world-space point on the rotated Earth; convert to local so parenting doesn't double-apply rotation
        const localPosition = position.clone();
        this.parentObject.worldToLocal(localPosition);

        const newHQ = new HQ('hq-' + Math.floor(Math.random() * 1000), localPosition, currentPlayerRef.current.id); // Pass a unique id
        hqSpheresRef.current.push(newHQ);
        this.parentObject.add(newHQ.sphere);
        currentPlayerRef.current.addHQ(newHQ);
        console.log("Added HQ sphere: ", hqSpheresRef.current.length);
        return newHQ;
      }

  update(simTimeSeconds, realDtSeconds, simContext) {
    this._sensorGating = simContext?.sensorGating ?? null;
    this._lastSimTimeSeconds = simTimeSeconds;
    if (this.forecastOverlayVisible && this._sensorGating?.playerId) {
      if (this._forecastDisplayPlayerId !== this._sensorGating.playerId) {
        this._forecastDisplayPlayerId = this._sensorGating.playerId;
        this._refreshForecastOverlayTextureForPlayer(this._forecastDisplayPlayerId);
      }
    }
    const daySeconds = 86400;
    const dayFrac = (((simTimeSeconds / daySeconds) % 1) + 1) % 1;
    this.parentObject.rotation.y = 2 * Math.PI * (dayFrac - 0.5);
    this.weatherField?.update(simTimeSeconds, realDtSeconds, simContext);
    this.analysisWeatherField?.update(simTimeSeconds, realDtSeconds, simContext);
    this._syncAnalysisFromTruthIfReady();
    this._updateAnalysisSigma2(simTimeSeconds);
    const didUpload = this.weatherVolumeGpu?.update({ simTimeSeconds });
    if (didUpload) {
      this.weatherVolumeDebugView?.render();
    }
    this._syncGroundRadarOrigin(simTimeSeconds);
    this.weatherSensorManager?.update({
      truthCore: this.weatherField?.core,
      earth: this,
      simTimeSeconds
    });
    this._tickCloudIntel(simTimeSeconds);
  }

  _syncAnalysisFromTruthIfReady() {
    if (this._analysisSyncedFromTruth) return;
    const truthCore = this.weatherField?.core;
    const analysisCore = this.analysisWeatherField?.core;
    if (!truthCore?.ready || !analysisCore?.ready) return;

    this._copyCoreState(truthCore, analysisCore);
    analysisCore.setTimeUTC(truthCore.timeUTC);
    this._perturbAnalysisCore(analysisCore, this._analysisNoiseSeed);

    const N = analysisCore.grid.count;
    this.analysisSigma2 = new Float32Array(N);
    this.analysisSigma2.fill(SIGMA2_INIT);
    this.analysisObsLastSeenSimTimeSeconds = new Float32Array(N);
    this.analysisObsLastSeenSimTimeSeconds.fill(-1e9);
    this._lastSigmaSimTimeSeconds = null;

    this._analysisSyncedFromTruth = true;
  }

  _copyCoreState(truthCore, analysisCore) {
    this._copyFloat32Props(truthCore.state, analysisCore.state);
  }

  _copyFloat32Props(srcObj, dstObj) {
    if (!srcObj || !dstObj) return;
    for (const key of Object.keys(srcObj)) {
      const a = srcObj[key];
      const b = dstObj[key];
      if (a instanceof Float32Array && b instanceof Float32Array && a.length === b.length) {
        b.set(a);
      }
    }
  }

  _perturbAnalysisCore(core, seed) {
    const s = core.state;
    const N = s.N;
    const nz = s.nz;

    const ps = s.ps;
    const u = s.u;
    const v = s.v;
    const qv = s.qv;
    const theta = s.theta;
    const qc = s.qc;
    const qi = s.qi;
    const qr = s.qr;

    const psAmp = 150;
    const windAmp = 2.0;
    const thetaAmp = 0.5;
    const qvFrac = 0.10;
    const hydFrac = 0.20;

    for (let k = 0; k < N; k++) {
      const r = (Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
      const n = (r - Math.floor(r)) * 2 - 1;
      ps[k] = Math.min(110000, Math.max(50000, ps[k] + n * psAmp));
    }

    for (let k2 = 0; k2 < N; k2++) {
      const r = (Math.sin((k2 + 1) * 93.9898 + seed * 12.233) * 12758.5453) % 1;
      const n = (r - Math.floor(r)) * 2 - 1;

      for (let lev = 0; lev < nz; lev++) {
        const idx = lev * N + k2;
        u[idx] = u[idx] + n * windAmp;
        v[idx] = v[idx] + n * windAmp;
        theta[idx] = theta[idx] + n * thetaAmp;

        const q = qv[idx] * (1 + n * qvFrac);
        qv[idx] = Math.max(0, Math.min(0.04, q));

        qc[idx] = Math.max(0, qc[idx] * (1 + n * hydFrac));
        qi[idx] = Math.max(0, qi[idx] * (1 + n * hydFrac));
        qr[idx] = Math.max(0, qr[idx] * (1 + n * hydFrac));
      }
    }
  }

  _updateAnalysisSigma2(simTimeSeconds) {
    if (!this.analysisSigma2 || !Number.isFinite(simTimeSeconds)) return;
    if (this._lastSigmaSimTimeSeconds == null) {
      this._lastSigmaSimTimeSeconds = simTimeSeconds;
      return;
    }
    const dt = simTimeSeconds - this._lastSigmaSimTimeSeconds;
    if (!(dt > 0)) return;
    const a = this.analysisSigma2;
    const lastSeen = this.analysisObsLastSeenSimTimeSeconds;
    const haveLastSeen = lastSeen && lastSeen.length === a.length;
    for (let i = 0; i < a.length; i++) {
      const seen = haveLastSeen ? lastSeen[i] : -1e9;
      const age = simTimeSeconds - seen;
      const stale01 = clamp01(age / OBS_STALE_SECONDS);
      const rate = lerp(SIGMA2_GROWTH_RATE_FRESH_PER_SEC, SIGMA2_GROWTH_RATE_STALE_PER_SEC, stale01);
      let v = a[i] + rate * dt;
      if (v < SIGMA2_MIN) v = SIGMA2_MIN;
      if (v > SIGMA2_MAX) v = SIGMA2_MAX;
      a[i] = v;
    }

    this._lastSigmaSimTimeSeconds = simTimeSeconds;
  }

  _snapshotForecastCoreFromAnalysis({ analysisCore, forecastCore }) {
    if (!analysisCore?.ready || !forecastCore?.ready) return false;
    if (!this._forecastPrimed) {
      forecastCore.advanceModelSeconds(forecastCore.modelDt);
      forecastCore.setTimeUTC(analysisCore.timeUTC);
      this._forecastPrimed = true;
    }
    forecastCore.setTimeUTC(analysisCore.timeUTC);
    this._copyFloat32Props(analysisCore.state, forecastCore.state);
    this._copyFloat32Props(analysisCore.fields, forecastCore.fields);
    return true;
  }

  async runForecastForPlayer({
    playerId,
    simTimeSeconds,
    leadHours = DEFAULT_FORECAST_LEAD_HOURS,
    horizonHours = FORECAST_HORIZON_HOURS,
    onProgress
  } = {}) {
    const forecastRunId = `fc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const analysisCore = this.analysisWeatherField?.core;
    const forecastCore = this.forecastWeatherField?.core;
    if (!analysisCore?.ready || !forecastCore?.ready) {
      return { ok: false, reason: 'core-not-ready' };
    }
    const N = analysisCore.grid?.count ?? 0;
    if (!this.analysisSigma2 || this.analysisSigma2.length !== N) {
      return { ok: false, reason: 'sigma2-missing' };
    }
    if (!N) return { ok: false, reason: 'grid-missing' };
    if (!this._snapshotForecastCoreFromAnalysis({ analysisCore, forecastCore })) {
      return { ok: false, reason: 'snapshot-failed' };
    }

    const sigma2Start = new Float32Array(N);
    sigma2Start.set(this.analysisSigma2);
    const precipStart = analysisCore.fields?.precipRate
      ? new Float32Array(analysisCore.fields.precipRate)
      : null;
    const gating = this._sensorGating;
    let radarNowcastEnabled = String(gating?.playerId ?? '') === String(playerId ?? '')
      && gating?.enabledWeatherSensors?.radarNowcast === true;
    let radarMask = null;
    let radarCoverageFrac = 0;
    if (radarNowcastEnabled && Array.isArray(gating?.radarSites) && gating.radarSites.length > 0) {
      const gridLat = analysisCore.grid?.latDeg;
      const gridLon = analysisCore.grid?.lonDeg;
      if (gridLat && gridLon) {
        const degToRad = Math.PI / 180;
        const sites = gating.radarSites
          .filter(site => Number.isFinite(site?.latRad) && Number.isFinite(site?.lonRad) && Number.isFinite(site?.radiusKm))
          .map(site => ({ ...site, cosLat0: Math.cos(site.latRad) }));
        if (sites.length > 0) {
          radarMask = new Float32Array(N);
          for (let j = 0; j < analysisCore.grid.ny; j++) {
            const latRad = gridLat[j] * degToRad;
            const row = j * analysisCore.grid.nx;
            for (let i = 0; i < analysisCore.grid.nx; i++) {
              const lonRad = gridLon[i] * degToRad;
              const k = row + i;
              let covered = 0;
              for (let s = 0; s < sites.length; s++) {
                const site = sites[s];
                const dLat = latRad - site.latRad;
                const dLon = wrapRadToPi(lonRad - site.lonRad);
                const distKm = this.earthRadiusKm * Math.sqrt(dLat * dLat + Math.pow(site.cosLat0 * dLon, 2));
                if (distKm <= site.radiusKm) {
                  covered = 1;
                  break;
                }
              }
              radarMask[k] = covered;
            }
          }
          let coveredCount = 0;
          for (let k = 0; k < N; k++) {
            if (radarMask[k] === 1) coveredCount += 1;
          }
          radarCoverageFrac = coveredCount / N;
        } else {
          radarNowcastEnabled = false;
        }
      } else {
        radarNowcastEnabled = false;
      }
    } else {
      radarNowcastEnabled = false;
    }

    const leadList = Array.isArray(leadHours) && leadHours.length
      ? leadHours.slice()
      : DEFAULT_FORECAST_LEAD_HOURS.slice();
    const baseSimTimeSeconds = Number.isFinite(simTimeSeconds) ? simTimeSeconds : analysisCore.timeUTC;
    let sigma2Min = Infinity;
    let sigma2Max = -Infinity;
    let sigma2Sum = 0;
    let sigma2Count = 0;
    for (let k = 0; k < N; k++) {
      const v = sigma2Start[k];
      if (!Number.isFinite(v)) continue;
      if (v < sigma2Min) sigma2Min = v;
      if (v > sigma2Max) sigma2Max = v;
      sigma2Sum += v;
      sigma2Count++;
    }
    this.logWeatherEvent(
      'forecastRunStart',
      {
        forecastRunId,
        playerId: String(playerId ?? ''),
        baseSimTimeSeconds,
        leadHours: leadList,
        horizonHours,
        modelDtSeconds: forecastCore.modelDt,
        grid: {
          nx: analysisCore.grid.nx,
          ny: analysisCore.grid.ny,
          count: N
        },
        sigma2: {
          min: sigma2Count ? sigma2Min : null,
          mean: sigma2Count ? sigma2Sum / sigma2Count : null,
          max: sigma2Count ? sigma2Max : null
        }
      },
      { simTimeSeconds: baseSimTimeSeconds, core: analysisCore }
    );

    const leads = leadList
      .map((h, idx) => ({ hours: h, seconds: h * 3600, idx }))
      .sort((a, b) => a.seconds - b.seconds);
    const maxLeadSeconds = Math.max(
      horizonHours * 3600,
      ...leads.map(l => l.seconds)
    );

    const grid = {
      nx: analysisCore.grid.nx,
      ny: analysisCore.grid.ny,
      count: N
    };

    const products = {
      cloudTauByLead: new Array(leads.length),
      precipRateByLead: new Array(leads.length),
      confidenceByLead: new Array(leads.length),
      windSpeedByLead: new Array(leads.length)
    };

    const dt = forecastCore.modelDt;
    const maxSteps = Math.round(maxLeadSeconds / dt);
    let stepsDone = 0;
    const calibByLead = this._confidenceCalibrationByPlayerId.get(String(playerId ?? '')) || {};

    for (let l = 0; l < leads.length; l++) {
      const targetSteps = Math.round(leads[l].seconds / dt);
      const confidenceScale = Number.isFinite(calibByLead[leads[l].hours]) ? calibByLead[leads[l].hours] : 1;
      while (stepsDone < targetSteps) {
        const remaining = targetSteps - stepsDone;
        const chunkSteps = Math.min(STEPS_PER_CHUNK, remaining);
        forecastCore.advanceModelSeconds(chunkSteps * dt);
        stepsDone += chunkSteps;
        const progress01 = maxSteps > 0 ? Math.min(1, stepsDone / maxSteps) : 1;
        if (typeof onProgress === 'function') {
          onProgress({
            progress01,
            message: `Forecast +${Math.round((stepsDone * dt) / 3600)}h`
          });
        }
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      }

      const tauLow = forecastCore.fields?.tauLow;
      const tauHigh = forecastCore.fields?.tauHigh;
      const precipRate = forecastCore.fields?.precipRate;
      const u = forecastCore.fields?.u;
      const v = forecastCore.fields?.v;

      const tauSum = new Float32Array(N);
      const precipOut = new Float32Array(N);
      const confOut = new Float32Array(N);
      const windOut = new Float32Array(N);

      const leadSeconds = leads[l].seconds;
      const radarNowcastModelWeight = radarNowcastEnabled
        ? (leads[l].hours <= 1 ? 0.25 : (leads[l].hours <= 3 ? 0.60 : 1.0))
        : 1.0;
      let tauMin = Infinity;
      let tauMax = -Infinity;
      let tauSumAcc = 0;
      let precipMin = Infinity;
      let precipMax = -Infinity;
      let precipSumAcc = 0;
      let precipMaxK = -1;
      let windMin = Infinity;
      let windMax = -Infinity;
      let windSumAcc = 0;
      let windMaxK = -1;
      let confMin = Infinity;
      let confMax = -Infinity;
      let confSumAcc = 0;
      for (let k = 0; k < N; k++) {
        const tLow = tauLow ? tauLow[k] : 0;
        const tHigh = tauHigh ? tauHigh[k] : 0;
        const t = tLow + tHigh;
        tauSum[k] = t;
        if (t < tauMin) tauMin = t;
        if (t > tauMax) tauMax = t;
        tauSumAcc += t;

        let p = precipRate ? precipRate[k] : 0;
        if (radarNowcastEnabled && radarMask && radarMask[k] === 1 && precipStart) {
          p = radarNowcastModelWeight * p + (1 - radarNowcastModelWeight) * precipStart[k];
        }
        precipOut[k] = p;
        if (p < precipMin) precipMin = p;
        if (p > precipMax) {
          precipMax = p;
          precipMaxK = k;
        }
        precipSumAcc += p;

        const sigma2Lead = Math.min(SIGMA2_MAX, Math.max(SIGMA2_MIN, sigma2Start[k] + CONF_GROWTH_RATE_PER_SEC * leadSeconds));
        const conf = 1 - (sigma2Lead - SIGMA2_MIN) / (SIGMA2_MAX - SIGMA2_MIN);
        const conf01 = clamp01(conf);
        const confScaled = clamp01(conf01 * confidenceScale);
        confOut[k] = confScaled;
        if (confScaled < confMin) confMin = confScaled;
        if (confScaled > confMax) confMax = confScaled;
        confSumAcc += confScaled;

        const uVal = u ? u[k] : 0;
        const vVal = v ? v[k] : 0;
        const wind = Math.hypot(uVal, vVal);
        windOut[k] = wind;
        if (wind < windMin) windMin = wind;
        if (wind > windMax) {
          windMax = wind;
          windMaxK = k;
        }
        windSumAcc += wind;
      }

      products.cloudTauByLead[leads[l].idx] = tauSum;
      products.precipRateByLead[leads[l].idx] = precipOut;
      products.confidenceByLead[leads[l].idx] = confOut;
      products.windSpeedByLead[leads[l].idx] = windOut;

      const { nx, latDeg, lonDeg } = analysisCore.grid;
      const getLoc = (k) => {
        if (!(k >= 0) || !nx || !latDeg || !lonDeg) return null;
        const j = Math.floor(k / nx);
        const i = k - j * nx;
        return {
          latDeg: latDeg[j],
          lonDeg: lonDeg[i]
        };
      };
      this.logWeatherEvent(
        'forecastLeadStats',
        {
          forecastRunId,
          playerId: String(playerId ?? ''),
          leadHours: leads[l].hours,
          leadSeconds,
          stepsDone,
          radarNowcastEnabled,
          radarNowcastCoverageFrac: radarNowcastEnabled ? radarCoverageFrac : null,
          radarNowcastModelWeight: radarNowcastEnabled ? radarNowcastModelWeight : null,
          stats: {
            cloudTau: { min: tauMin, mean: tauSumAcc / N, max: tauMax },
            precipRate: { min: precipMin, mean: precipSumAcc / N, max: precipMax, maxAt: getLoc(precipMaxK) },
            windSpeed: { min: windMin, mean: windSumAcc / N, max: windMax, maxAt: getLoc(windMaxK) },
            confidence: { min: confMin, mean: confSumAcc / N, max: confMax }
          }
        },
        { simTimeSeconds: baseSimTimeSeconds, core: analysisCore }
      );
    }

    const result = {
      runId: forecastRunId,
      playerId: String(playerId ?? ''),
      baseSimTimeSeconds,
      leadHours: leadList,
      grid,
      products
    };

    this.latestForecastByPlayerId.set(result.playerId, result);
    this._forecastDisplayPlayerId = result.playerId;
    const historyEntry = { ...result, _skillVerifiedByLead: {} };
    const historyKey = result.playerId;
    const history = this.forecastHistoryByPlayerId.get(historyKey) || [];
    history.push(historyEntry);
    const truthTimeSeconds = this.weatherField?.core?.timeUTC;
    let filtered = history;
    if (Number.isFinite(truthTimeSeconds)) {
      filtered = history.filter(
        (run) => truthTimeSeconds <= run.baseSimTimeSeconds + 26 * 3600
      );
    }
    if (filtered.length > 3) {
      filtered = filtered.slice(-3);
    }
    this.forecastHistoryByPlayerId.set(historyKey, filtered);
    if (this.forecastOverlayVisible) {
      this._refreshForecastOverlayTextureForPlayer(result.playerId);
    }
    this.logWeatherEvent(
      'forecastRunComplete',
      {
        forecastRunId,
        playerId: result.playerId,
        leadHours: leadList,
        horizonHours,
        stepsDone,
        maxLeadHours: Math.max(...leadList)
      },
      { simTimeSeconds: baseSimTimeSeconds, core: analysisCore }
    );
    if (typeof onProgress === 'function') {
      onProgress({ progress01: 1, message: 'Forecast complete' });
    }
    return result;
  }

  updateConfidenceCalibration({ playerId, leadHours, targetScale } = {}) {
    const pid = playerId != null ? String(playerId) : null;
    const h = Number(leadHours);
    if (!pid || !Number.isFinite(h)) return;
    const scale = Math.max(0.5, Math.min(1.5, Number(targetScale)));
    if (!Number.isFinite(scale)) return;
    const alpha = 0.2;
    const calib = this._confidenceCalibrationByPlayerId.get(pid) || {};
    const prevScale = Number.isFinite(calib[h]) ? calib[h] : 1;
    const newScale = prevScale + alpha * (scale - prevScale);
    calib[h] = newScale;
    this._confidenceCalibrationByPlayerId.set(pid, calib);
    this.logWeatherEvent?.(
      'confidenceCalibrationUpdated',
      {
        playerId: pid,
        leadHours: h,
        prevScale,
        targetScale: scale,
        newScale
      },
      { simTimeSeconds: this._lastSimTimeSeconds ?? null }
    );
  }

  getForecastHistory(playerId) {
    const pid = playerId != null ? String(playerId) : null;
    if (!pid) return [];
    const runs = this.forecastHistoryByPlayerId.get(pid);
    if (!runs) return [];
    return runs.map((run) => ({
      runId: run.runId,
      playerId: run.playerId,
      baseSimTimeSeconds: run.baseSimTimeSeconds,
      leadHours: Array.isArray(run.leadHours) ? run.leadHours.slice() : [],
      grid: run.grid,
      products: run.products,
      _skillVerifiedByLead: run._skillVerifiedByLead || (run._skillVerifiedByLead = {})
    }));
  }

    revealFog(position, fov, logPosition = false, radius, playerID) {
        const currentTime = Date.now();

        const vector = new THREE.Vector3(position.x, position.y, position.z);
        vector.normalize();

        const theta = Math.acos(-vector.y); // polar angle
        const phi = Math.atan2(-vector.z, vector.x); // azimuthal angle

        // Normalize phi to range [0, 1]
        const u = (phi + Math.PI) / (2 * Math.PI);
        // Normalize theta to range [0, 1]
        const v = 1.0 - (theta / Math.PI);

        // Log UV coordinates
        if (this.DEBUG && currentTime - this.lastLogTime > 1000) {
          this.lastLogTime = currentTime;
        }

        // Convert u, v to a string to use as a key
        const positionKey = `${u.toFixed(6)}-${v.toFixed(6)}`;

    // Weather check: smooth cloud blocking based on low/high means
    const cl = this.weatherField?.sampleCloudLow?.(u, v) ?? 0;
    const ch = this.weatherField?.sampleCloudHigh?.(u, v) ?? 0;
    const wLow = 0.75;
    const wHigh = 0.35;
    const coverLocal = clamp01(wLow * cl + wHigh * ch);
    const cloudBlock = smoothstep(0.35, 0.75, coverLocal);
    const blockFactor = 1 - cloudBlock;

        // Ensure player-specific revealed positions and fog maps are initialized
        if (!this.revealedPositions[playerID.current]) {
          this.revealedPositions[playerID.current] = new Set();
        }

    if (!this.revealedPositions[playerID.current].has(positionKey)) {
      const offscreenContext = this.playerCanvases[playerID.current].context;
      offscreenContext.globalCompositeOperation = 'destination-out';
      offscreenContext.fillStyle = `rgba(0, 0, 0, ${0.5 * blockFactor})`;

      // Calculate the reveal area based on the FOV value
      const earthRadius = this.earthRadiusKm; // The Earth's radius in your scene scale
      const surfaceArea = 4 * Math.PI * Math.pow(earthRadius, 2);
      const revealArea = (fov / 100000000) * surfaceArea;
      const revealRadius = Math.sqrt(revealArea / Math.PI);

      offscreenContext.beginPath();
      offscreenContext.arc(u * this.canvas.width, v * this.canvas.height, revealRadius, 0, 2 * Math.PI);
      offscreenContext.fill();
      offscreenContext.globalCompositeOperation = 'source-over';

      this.revealedPositions[playerID.current].add(positionKey);
      // Immediately update the main fog texture so the new reveal is visible
      this.updateFogMapForCurrentPlayer();
    }
      }

      updateFogMapForCurrentPlayer() {
        if (this.context && this.playerCanvases[this.currentPlayerID]) {
          //console.log(`Updating fog map for player ${this.currentPlayerID}`);
          // Clear the entire main canvas
          this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
          // Draw the current player's off-screen canvas onto the main canvas
          this.context.drawImage(this.playerCanvases[this.currentPlayerID].canvas, 0, 0);
          // Mark the texture for an update
          this.fogTexture.needsUpdate = true;
        } else {
          console.error("Fog map for the player not found or context not initialized");
        }
      }
    

  setCurrentPlayer(playerID) {
    this.currentPlayerID = playerID;
    this.updateFogMapForCurrentPlayer();
    if (this.cloudObsVisible) {
      this._cloudIntelNeedsRefresh = true;
      this._refreshCloudIntelTextureForPlayer(playerID, this._lastSimTimeSeconds);
    }
  }

  setFogVisible(visible) {
    if (this.cloudMesh) this.cloudMesh.visible = visible;
  }

  setWeatherVisible(visible) {
    this.weatherVisible = visible;
    if (this.weatherLowMesh) this.weatherLowMesh.visible = visible;
    if (this.weatherHighMesh) this.weatherHighMesh.visible = visible;
    if (this.weatherDebugMesh) {
      this.weatherDebugMesh.visible = visible && this.weatherDebugMode !== 'clouds';
    }
  }

  setWeatherDebugMode(mode) {
    this.weatherDebugMode = mode || 'clouds';
    this.weatherField?.setDebugMode(this.weatherDebugMode);
    this.analysisWeatherField?.setDebugMode(this.weatherDebugMode);
    this.forecastWeatherField?.setDebugMode(this.weatherDebugMode);
    this._applyWeatherViewSourceMaps();
    if (this.weatherDebugMesh) {
      this.weatherDebugMesh.visible = this.weatherVisible && this.weatherDebugMode !== 'clouds';
    }
  }

  setWeatherPaused(paused) {
    this.weatherField?.setPaused(paused);
    this.analysisWeatherField?.setPaused(paused);
  }

  weatherStepHours(hours = 1) {
    this.weatherField?.stepModelSeconds(hours * 3600);
    this.analysisWeatherField?.stepModelSeconds(hours * 3600);
  }

  weatherStepDays(days = 1) {
    this.weatherField?.stepModelSeconds(days * 86400);
    this.analysisWeatherField?.stepModelSeconds(days * 86400);
  }

  getWeatherZonalMean(mode) {
    return this._getActiveWeatherField()?.getZonalMean(mode) ?? new Float32Array(0);
  }

  getWeatherTimeUTC() {
    return this.weatherField?.getTimeUTC() ?? 0;
  }

  getWeatherSeed() {
    const wfSeed = this.weatherField?.getSeed?.();
    if (Number.isFinite(wfSeed)) return wfSeed;
    if (Number.isFinite(this.weatherSeed)) return this.weatherSeed;
    return null;
  }

  setWeatherSeed(seed) {
    if (!Number.isFinite(seed)) return;
    this.weatherSeed = seed;
    this.weatherField?.setSeed?.(seed);
    this.analysisWeatherField?.setSeed?.(seed);
    this.forecastWeatherField?.setSeed?.(seed);
    this._analysisSyncedFromTruth = false;
    this._analysisNoiseSeed = seed + 1337;
    this.analysisSigma2 = null;
    this.analysisObsLastSeenSimTimeSeconds = null;
    this._lastSigmaSimTimeSeconds = null;
    this._lastAssimilatedObsKeyBySensor = new Map();
    this._stationInfluenceCache = null;
    this._forecastPrimed = false;
    this._forecastTextureCache = null;
    this.latestForecastByPlayerId = new Map();
    this.forecastHistoryByPlayerId = new Map();
    this._forecastDisplayPlayerId = null;
    this._applyForecastOverlayTexture(null);
  }

  startWeatherLogCapture(options) {
    this.weatherField?.startLogCapture(options);
  }

  stopWeatherLogCapture() {
    this.weatherField?.stopLogCapture();
  }

  clearWeatherLogCapture() {
    this.weatherField?.clearLogCapture();
  }

  downloadWeatherLogCapture(filename) {
    return this.weatherField?.downloadLogCapture(filename);
  }

  setWeatherLogCadence(cadenceSeconds, simTimeSeconds) {
    this.weatherField?.setLogCadence(cadenceSeconds, simTimeSeconds);
  }

  getWeatherLogStatus() {
    return this.weatherField?.getLogStatus() ?? { enabled: false, count: 0, cadenceSeconds: 0 };
  }

  setWeatherV2ConvectionEnabled(enabled) {
    this.weatherField?.setV2ConvectionEnabled?.(enabled);
    this.analysisWeatherField?.setV2ConvectionEnabled?.(enabled);
    this.forecastWeatherField?.setV2ConvectionEnabled?.(enabled);
  }

  weatherLogNow(simTimeSeconds, simContext, reason) {
    return this.weatherField?.logNow(simTimeSeconds, simContext, reason);
  }

  render(scene) {
    scene.add(this.parentObject);
  }
}

export default Earth;
