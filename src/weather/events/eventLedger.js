import { WEATHER_KERNEL_CONTRACT_VERSION, createWeatherKernelEventSeed } from '../kernel/contracts.js';
import { buildHurricaneSystem } from './hurricaneSystems.js';
import {
  WEATHER_EVENT_LEDGER_SCHEMA,
  WEATHER_EVENT_MATCH_RADIUS_KM,
  WEATHER_EVENT_PRODUCT_SCHEMA,
  WEATHER_EVENT_RETIRE_AFTER_SECONDS,
  WEATHER_EVENT_TYPES,
  WEATHER_EVENT_TYPE_LIST
} from './eventTypes.js';
import { detectWeatherEventCandidates, haversineKm, normalizeLonDeg } from './detectEvents.js';

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const hashString = (text) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36).padStart(6, '0');
};

const roundedAnchor = (value, step) => Math.round((Number(value) || 0) / step) * step;

const eventSeedDigest = (candidate, seed) => {
  const timeBucketHours = candidate.type === WEATHER_EVENT_TYPES.SUPERCELL
    || candidate.type === WEATHER_EVENT_TYPES.TORNADO_OUTBREAK
    ? 3
    : 12;
  const timeBucket = Math.floor((candidate.timeUTC || 0) / (timeBucketHours * 3600));
  const lat = roundedAnchor(candidate.latDeg, 2.5).toFixed(1);
  const lon = roundedAnchor(normalizeLonDeg(candidate.lonDeg), 2.5).toFixed(1);
  const region = candidate.basin || candidate.region || 'global';
  return hashString(`${seed}|${candidate.type}|${region}|${lat}|${lon}|${timeBucket}`);
};

const deterministicEventId = (candidate, seed) => (
  `${candidate.type}:${candidate.basin || candidate.region || 'global'}:${eventSeedDigest(candidate, seed)}`
);

const countBy = (items, keyFn) => {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    out[key] = (out[key] || 0) + 1;
  }
  return out;
};

const eventKindCompatible = (event, candidate) => {
  if (!event || !candidate || event.type !== candidate.type) return false;
  if (event.basin && candidate.basin && event.basin !== candidate.basin) return false;
  if (event.region && candidate.region && event.region !== candidate.region) {
    const broadTypes = new Set([
      WEATHER_EVENT_TYPES.EXTRATROPICAL_CYCLONE,
      WEATHER_EVENT_TYPES.FRONT,
      WEATHER_EVENT_TYPES.MCS,
      WEATHER_EVENT_TYPES.BLIZZARD
    ]);
    return broadTypes.has(event.type);
  }
  return true;
};

const lifecyclePhase = ({ event, candidate = null, timeUTC }) => {
  const ageHours = Math.max(0, (timeUTC - event.firstSeenTimeUTC) / 3600);
  const gapHours = Math.max(0, (timeUTC - event.lastSeenTimeUTC) / 3600);
  if (!candidate || gapHours > 0.1) return 'decay';
  if (event.observationCount <= 1 || ageHours < 3) return 'genesis';
  const scoreDelta = candidate.score - (event.previousScore ?? event.score ?? 0);
  if (scoreDelta > 0.035 || candidate.intensity > (event.intensity01 || 0) + 0.04) return 'intensification';
  if ((event.intensity01 || 0) >= 0.48 || ageHours >= 9) return 'mature';
  return 'intensification';
};

const serializeCandidateEnvironment = (environment = {}) => {
  const out = {};
  for (const [key, value] of Object.entries(environment)) {
    out[key] = Number.isFinite(value) ? Number(value.toFixed(5)) : value;
  }
  return out;
};

export class WeatherEventLedger {
  constructor({ seed = 0, maxHistory = 512, maxTrackSamples = 48 } = {}) {
    this.seed = Number.isFinite(seed) ? Number(seed) : 0;
    this.maxHistory = maxHistory;
    this.maxTrackSamples = maxTrackSamples;
    this.active = new Map();
    this.history = [];
    this.lastProduct = null;
  }

  reset({ seed = this.seed } = {}) {
    this.seed = Number.isFinite(seed) ? Number(seed) : this.seed;
    this.active.clear();
    this.history = [];
    this.lastProduct = null;
  }

  updateFromCore({ grid, fields, state, timeUTC = 0, manifest = null } = {}) {
    const detection = detectWeatherEventCandidates({ grid, fields, state, timeUTC });
    return this.update({
      candidates: detection.candidates,
      rejected: detection.rejected,
      timeUTC,
      dayOfYear: detection.dayOfYear,
      manifest
    });
  }

  update({ candidates = [], rejected = {}, timeUTC = 0, dayOfYear = 0, manifest = null } = {}) {
    const matchedEventIds = new Set();
    const usedCandidateIndexes = new Set();
    const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));

    for (let c = 0; c < sortedCandidates.length; c += 1) {
      const candidate = sortedCandidates[c];
      const match = this._findMatch(candidate, matchedEventIds);
      if (match) {
        this._updateEvent(match, candidate, timeUTC);
        matchedEventIds.add(match.id);
        usedCandidateIndexes.add(c);
      }
    }

    for (let c = 0; c < sortedCandidates.length; c += 1) {
      if (usedCandidateIndexes.has(c)) continue;
      const candidate = sortedCandidates[c];
      const event = this._createEvent(candidate, timeUTC);
      this.active.set(event.id, event);
      matchedEventIds.add(event.id);
    }

    this._ageUnmatchedEvents(matchedEventIds, timeUTC);
    const activeEvents = [...this.active.values()]
      .map((event) => this._serializeEvent(event))
      .sort((a, b) => b.intensity01 - a.intensity01 || a.type.localeCompare(b.type));
    const recentHistory = this.history.slice(-this.maxHistory).map((event) => this._serializeEvent(event, { includeTrack: false }));
    const product = {
      schema: WEATHER_EVENT_PRODUCT_SCHEMA,
      ledgerSchema: WEATHER_EVENT_LEDGER_SCHEMA,
      contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
      manifest,
      timeUTC,
      dayOfYear,
      activeEvents,
      history: recentHistory,
      seeds: activeEvents.map((event) => createWeatherKernelEventSeed({
        id: event.id,
        type: event.type,
        timeUTC: event.firstSeenTimeUTC,
        seed: this.seed,
        sourceSnapshotDigest: event.sourceSnapshotDigest || null,
        basin: event.basin || null,
        region: event.region || null,
        environment: event.environment || null
      })),
      summary: {
        activeCount: activeEvents.length,
        historyCount: recentHistory.length,
        countsByType: Object.fromEntries(WEATHER_EVENT_TYPE_LIST.map((type) => [
          type,
          activeEvents.filter((event) => event.type === type).length
        ])),
        basinCounts: countBy(activeEvents, (event) => event.basin),
        regionCounts: countBy(activeEvents, (event) => event.region),
        rejected
      }
    };
    this.lastProduct = product;
    return product;
  }

  getProduct() {
    return this.lastProduct || {
      schema: WEATHER_EVENT_PRODUCT_SCHEMA,
      ledgerSchema: WEATHER_EVENT_LEDGER_SCHEMA,
      contractVersion: WEATHER_KERNEL_CONTRACT_VERSION,
      timeUTC: 0,
      dayOfYear: 0,
      activeEvents: [],
      history: [],
      seeds: [],
      summary: {
        activeCount: 0,
        historyCount: 0,
        countsByType: Object.fromEntries(WEATHER_EVENT_TYPE_LIST.map((type) => [type, 0])),
        basinCounts: {},
        regionCounts: {},
        rejected: {}
      }
    };
  }

  _findMatch(candidate, matchedEventIds) {
    let best = null;
    let bestScore = -Infinity;
    const radius = WEATHER_EVENT_MATCH_RADIUS_KM[candidate.type] || 700;
    for (const event of this.active.values()) {
      if (matchedEventIds.has(event.id)) continue;
      if (!eventKindCompatible(event, candidate)) continue;
      const distance = haversineKm(event.center, candidate);
      if (distance > radius) continue;
      const score = (1 - distance / radius) * 0.62 + Math.min(event.intensity01 || 0, candidate.intensity || 0) * 0.38;
      if (score > bestScore) {
        best = event;
        bestScore = score;
      }
    }
    return best;
  }

  _createEvent(candidate, timeUTC) {
    const id = deterministicEventId(candidate, this.seed);
    const firstSample = this._sampleFromCandidate(candidate, timeUTC);
    const event = {
      id,
      type: candidate.type,
      basin: candidate.basin || null,
      region: candidate.region || null,
      firstSeenTimeUTC: timeUTC,
      lastSeenTimeUTC: timeUTC,
      lastUpdatedTimeUTC: timeUTC,
      endTimeUTC: null,
      phase: 'genesis',
      observationCount: 1,
      score: candidate.score,
      previousScore: candidate.score,
      intensity01: clamp01(candidate.intensity),
      maxIntensity01: clamp01(candidate.intensity),
      radiusKm: candidate.radiusKm,
      center: {
        latDeg: Number(candidate.latDeg.toFixed(3)),
        lonDeg: Number(normalizeLonDeg(candidate.lonDeg).toFixed(3))
      },
      motionVector: candidate.motionVector || null,
      environment: serializeCandidateEnvironment(candidate.environment),
      sourceIndex: candidate.sourceIndex,
      sourceSnapshotDigest: eventSeedDigest(candidate, this.seed),
      samples: [firstSample],
      track: [firstSample],
      hurricane: null,
      closedReason: null
    };
    if (candidate.type === WEATHER_EVENT_TYPES.HURRICANE) {
      event.hurricane = buildHurricaneSystem(candidate, event);
      event.track = event.hurricane.track;
    }
    return event;
  }

  _updateEvent(event, candidate, timeUTC) {
    event.previousScore = event.score;
    event.score = candidate.score;
    event.intensity01 = clamp01(0.58 * event.intensity01 + 0.42 * candidate.intensity);
    event.maxIntensity01 = Math.max(event.maxIntensity01 || 0, event.intensity01);
    event.lastSeenTimeUTC = timeUTC;
    event.lastUpdatedTimeUTC = timeUTC;
    event.observationCount += 1;
    event.radiusKm = Math.round(0.62 * event.radiusKm + 0.38 * candidate.radiusKm);
    event.center = {
      latDeg: Number(candidate.latDeg.toFixed(3)),
      lonDeg: Number(normalizeLonDeg(candidate.lonDeg).toFixed(3))
    };
    event.motionVector = candidate.motionVector || event.motionVector || null;
    event.environment = serializeCandidateEnvironment(candidate.environment);
    event.sourceIndex = candidate.sourceIndex;
    event.phase = lifecyclePhase({ event, candidate, timeUTC });
    const sample = this._sampleFromCandidate(candidate, timeUTC);
    event.samples.push(sample);
    while (event.samples.length > this.maxTrackSamples) event.samples.shift();
    event.track.push(sample);
    while (event.track.length > this.maxTrackSamples) event.track.shift();
    if (candidate.type === WEATHER_EVENT_TYPES.HURRICANE) {
      event.hurricane = buildHurricaneSystem(candidate, event);
      event.track = event.hurricane.track;
    }
  }

  _ageUnmatchedEvents(matchedEventIds, timeUTC) {
    for (const event of [...this.active.values()]) {
      if (matchedEventIds.has(event.id)) continue;
      const gapSeconds = Math.max(0, timeUTC - event.lastSeenTimeUTC);
      const retireSeconds = WEATHER_EVENT_RETIRE_AFTER_SECONDS[event.type] || 24 * 3600;
      event.lastUpdatedTimeUTC = timeUTC;
      event.phase = 'decay';
      event.score = Number((event.score * 0.82).toFixed(5));
      event.intensity01 = clamp01(event.intensity01 * 0.88);
      if (gapSeconds >= retireSeconds) {
        event.endTimeUTC = event.lastSeenTimeUTC;
        event.closedReason = 'environment-no-longer-valid';
        this.active.delete(event.id);
        this.history.push(event);
        while (this.history.length > this.maxHistory) this.history.shift();
      }
    }
  }

  _sampleFromCandidate(candidate, timeUTC) {
    return {
      timeUTC,
      latDeg: Number(candidate.latDeg.toFixed(3)),
      lonDeg: Number(normalizeLonDeg(candidate.lonDeg).toFixed(3)),
      score: Number(clamp01(candidate.score).toFixed(4)),
      intensity01: Number(clamp01(candidate.intensity).toFixed(4)),
      phase: candidate.type
    };
  }

  _serializeEvent(event, { includeTrack = true } = {}) {
    const ageHours = Math.max(0, ((event.endTimeUTC || event.lastUpdatedTimeUTC || event.lastSeenTimeUTC) - event.firstSeenTimeUTC) / 3600);
    return {
      id: event.id,
      type: event.type,
      basin: event.basin,
      region: event.region,
      phase: event.phase,
      active: event.endTimeUTC == null,
      firstSeenTimeUTC: event.firstSeenTimeUTC,
      lastSeenTimeUTC: event.lastSeenTimeUTC,
      endTimeUTC: event.endTimeUTC,
      ageHours: Number(ageHours.toFixed(2)),
      observationCount: event.observationCount,
      center: event.center ? { ...event.center } : null,
      radiusKm: event.radiusKm,
      score: Number((event.score || 0).toFixed(4)),
      intensity01: Number((event.intensity01 || 0).toFixed(4)),
      maxIntensity01: Number((event.maxIntensity01 || 0).toFixed(4)),
      motionVector: event.motionVector ? { ...event.motionVector } : null,
      environment: event.environment ? { ...event.environment } : null,
      sourceIndex: event.sourceIndex,
      sourceSnapshotDigest: event.sourceSnapshotDigest,
      track: includeTrack ? [...(event.track || [])] : undefined,
      hurricane: event.hurricane ? { ...event.hurricane, track: [...(event.hurricane.track || [])] } : null,
      closedReason: event.closedReason
    };
  }
}
