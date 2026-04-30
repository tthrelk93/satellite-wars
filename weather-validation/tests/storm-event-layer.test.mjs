import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatLonGrid } from '../../src/weather/grid.js';
import {
  WEATHER_EVENT_PRODUCT_SCHEMA,
  WEATHER_EVENT_TYPES,
  WeatherEventLedger,
  computeSevereWeatherEnvironment,
  detectWeatherEventCandidates
} from '../../src/weather/events/index.js';
import { createWeatherKernel } from '../../src/weather/kernel/index.js';

const daySeconds = 86400;

const nearestCell = (grid, latDeg, lonDeg) => {
  let best = 0;
  let bestDist = Infinity;
  for (let j = 0; j < grid.ny; j += 1) {
    for (let i = 0; i < grid.nx; i += 1) {
      const lonDelta = Math.abs((((grid.lonDeg[i] - lonDeg + 180) % 360) + 360) % 360 - 180);
      const dist = Math.abs(grid.latDeg[j] - latDeg) + lonDelta * 0.2;
      if (dist < bestDist) {
        bestDist = dist;
        best = j * grid.nx + i;
      }
    }
  }
  return best;
};

const makeFixture = (nx = 72, ny = 36) => {
  const grid = createLatLonGrid(nx, ny);
  const N = grid.count;
  const f32 = (value = 0) => {
    const arr = new Float32Array(N);
    if (value !== 0) arr.fill(value);
    return arr;
  };
  const fields = {
    u: f32(4),
    v: f32(1),
    uU: f32(8),
    vU: f32(2),
    RH: f32(0.45),
    RHU: f32(0.38),
    vort: f32(0),
    omegaL: f32(0.03),
    omegaU: f32(0.01),
    precipRate: f32(0.01),
    sstNow: f32(300),
    seaIceFrac: f32(0),
    Ts: f32(292),
    cloudLow: f32(0.25),
    cloudHigh: f32(0.18),
    tauLow: f32(1),
    tauHigh: f32(1)
  };
  const state = {
    landMask: new Uint8Array(N),
    sstNow: f32(300),
    seaIceFrac: f32(0),
    Ts: f32(292),
    precipRate: fields.precipRate,
    precipConvectiveRate: f32(0),
    convectiveOrganization: f32(0),
    convectiveMassFlux: f32(0),
    lowLevelMoistureConvergence: f32(0),
    tropicalCycloneGenesisPotentialDiag: f32(0),
    tropicalCycloneEmbeddedVortexDiag: f32(0),
    tropicalCycloneShearSupportDiag: f32(0),
    tropicalCycloneHumiditySupportDiag: f32(0),
    tropicalCycloneVorticitySupportDiag: f32(0),
    tropicalCycloneBasinSeasonSupportDiag: f32(0),
    stormGenesisPotentialDiag: f32(0),
    stormDeepeningPotentialDiag: f32(0),
    stormPrecipShieldDiag: f32(0),
    stormWarmSectorDiag: f32(0),
    stormColdSectorDiag: f32(0),
    frontalAscentSupportDiag: f32(0),
    tornadoRiskPotentialDiag: f32(0),
    tornadoInstabilitySupportDiag: f32(0),
    tornadoShearSupportDiag: f32(0),
    tornadoLiftSupportDiag: f32(0),
    tornadoStormModeSupportDiag: f32(0)
  };
  return { grid, fields, state };
};

const setAt = (fixture, k, values) => {
  const { fields, state } = fixture;
  for (const [key, value] of Object.entries(values)) {
    if (fields[key]) fields[key][k] = value;
    if (state[key]) state[key][k] = value;
  }
};

const setHurricaneEnvironment = (fixture, k) => {
  setAt(fixture, k, {
    sstNow: 302.2,
    Ts: 301,
    RH: 0.88,
    RHU: 0.72,
    precipRate: 0.55,
    precipConvectiveRate: 0.28,
    convectiveOrganization: 0.82,
    convectiveMassFlux: 0.018,
    tropicalCycloneGenesisPotentialDiag: 0.72,
    tropicalCycloneEmbeddedVortexDiag: 0.76,
    tropicalCycloneShearSupportDiag: 0.78,
    tropicalCycloneHumiditySupportDiag: 0.86,
    tropicalCycloneVorticitySupportDiag: 0.82
  });
  fixture.fields.u[k] = 5;
  fixture.fields.v[k] = 2;
  fixture.fields.uU[k] = 10;
  fixture.fields.vU[k] = 4;
  fixture.fields.vort[k] = 8e-6;
};

const setSevereEnvironment = (fixture, k, { dryline = true } = {}) => {
  const { grid } = fixture;
  const i = k % grid.nx;
  const j = Math.floor(k / grid.nx);
  fixture.state.landMask[k] = 1;
  setAt(fixture, k, {
    Ts: 304,
    RH: 0.78,
    RHU: 0.62,
    precipRate: 0.26,
    precipConvectiveRate: 0.18,
    convectiveOrganization: 0.82,
    lowLevelMoistureConvergence: 7.5e-6,
    stormGenesisPotentialDiag: 0.58,
    stormWarmSectorDiag: 0.72,
    frontalAscentSupportDiag: 0.44,
    tornadoRiskPotentialDiag: 0.76,
    tornadoInstabilitySupportDiag: 0.88,
    tornadoShearSupportDiag: 0.82,
    tornadoLiftSupportDiag: 0.78,
    tornadoStormModeSupportDiag: 0.84
  });
  fixture.fields.u[k] = 16;
  fixture.fields.v[k] = 5;
  fixture.fields.uU[k] = 38;
  fixture.fields.vU[k] = 18;
  fixture.fields.omegaL[k] = -0.08;
  if (dryline) {
    const west = j * grid.nx + ((i - 1 + grid.nx) % grid.nx);
    const east = j * grid.nx + ((i + 1) % grid.nx);
    fixture.fields.RH[west] = 0.28;
    fixture.fields.RH[east] = 0.82;
  }
};

test('Atlantic hurricane candidates peak in hurricane season and reject winter/cold/dry setups', () => {
  const peak = makeFixture();
  const k = nearestCell(peak.grid, 18, -55);
  setHurricaneEnvironment(peak, k);
  const peakResult = detectWeatherEventCandidates({
    ...peak,
    timeUTC: 252 * daySeconds
  });
  const hurricanes = peakResult.candidates.filter((event) => event.type === WEATHER_EVENT_TYPES.HURRICANE);
  assert.ok(hurricanes.some((event) => event.basin === 'atlantic'), 'expected Atlantic hurricane in peak season');

  const winter = makeFixture();
  const kw = nearestCell(winter.grid, 18, -55);
  setHurricaneEnvironment(winter, kw);
  const winterResult = detectWeatherEventCandidates({
    ...winter,
    timeUTC: 20 * daySeconds
  });
  assert.equal(winterResult.candidates.some((event) => event.type === WEATHER_EVENT_TYPES.HURRICANE), false);

  const coldDry = makeFixture();
  const kc = nearestCell(coldDry.grid, 22, -50);
  setHurricaneEnvironment(coldDry, kc);
  coldDry.state.sstNow[kc] = 296;
  coldDry.fields.sstNow[kc] = 296;
  coldDry.fields.RH[kc] = 0.22;
  coldDry.fields.RHU[kc] = 0.18;
  const coldResult = detectWeatherEventCandidates({
    ...coldDry,
    timeUTC: 252 * daySeconds
  });
  assert.equal(coldResult.candidates.some((event) => event.type === WEATHER_EVENT_TYPES.HURRICANE), false);
});

test('Great Plains tornado outbreaks peak in warm season and reject cool-season false positives', () => {
  const warm = makeFixture();
  const k = nearestCell(warm.grid, 36, -98);
  setSevereEnvironment(warm, k);
  const warmResult = detectWeatherEventCandidates({
    ...warm,
    timeUTC: 150 * daySeconds
  });
  assert.ok(warmResult.candidates.some((event) => event.type === WEATHER_EVENT_TYPES.TORNADO_OUTBREAK && event.region === 'great-plains'));
  assert.ok(warmResult.candidates.some((event) => event.type === WEATHER_EVENT_TYPES.SUPERCELL));
  assert.ok(warmResult.candidates.some((event) => event.type === WEATHER_EVENT_TYPES.TORNADO_TOUCHDOWN));

  const cool = makeFixture();
  const kc = nearestCell(cool.grid, 36, -98);
  setSevereEnvironment(cool, kc);
  const coolResult = detectWeatherEventCandidates({
    ...cool,
    timeUTC: 20 * daySeconds
  });
  assert.equal(coolResult.candidates.some((event) => event.type === WEATHER_EVENT_TYPES.TORNADO_OUTBREAK), false);
});

test('severe-weather environment index requires ingredients and rejects generic rain', () => {
  const favorable = computeSevereWeatherEnvironment({
    isLand: true,
    latDeg: 36,
    lonDeg: -98,
    dayOfYear: 150,
    surfaceTempK: 304,
    rhLow: 0.78,
    rhUpper: 0.62,
    shearMs: 27,
    convectiveOrganization: 0.82,
    convectivePrecipRate: 0.18,
    precipRate: 0.26,
    lowLevelConvergence: 7.5e-6,
    omegaLower: -0.08,
    frontalSupport: 0.44,
    warmSectorSupport: 0.72,
    stormGenesis: 0.58,
    instabilityDiag: 0.88,
    shearDiag: 0.82,
    liftDiag: 0.78,
    stormModeDiag: 0.84,
    drylineMoistureGradient: 0.54
  });
  const genericRain = computeSevereWeatherEnvironment({
    isLand: true,
    latDeg: 36,
    lonDeg: -98,
    dayOfYear: 150,
    surfaceTempK: 296,
    rhLow: 0.78,
    rhUpper: 0.62,
    shearMs: 4,
    convectiveOrganization: 0.18,
    convectivePrecipRate: 0.02,
    precipRate: 0.75,
    omegaLower: 0.01,
    frontalSupport: 0.02,
    instabilityDiag: 0.04,
    shearDiag: 0.03,
    liftDiag: 0.05,
    stormModeDiag: 0.04
  });
  assert.ok(favorable.severeWeatherIndex01 > 0.45);
  assert.equal(favorable.physicallyTornadic, true);
  assert.ok(favorable.drylineSupport01 > 0.5);
  assert.ok(genericRain.severeWeatherIndex01 < favorable.severeWeatherIndex01 * 0.25);
  assert.equal(genericRain.physicallyTornadic, false);
});

test('generic rain cannot spawn tornadoes without shear, instability, lift, and storm mode', () => {
  const fixture = makeFixture();
  const k = nearestCell(fixture.grid, 36, -98);
  fixture.state.landMask[k] = 1;
  setAt(fixture, k, {
    Ts: 297,
    RH: 0.82,
    RHU: 0.70,
    precipRate: 0.85,
    precipConvectiveRate: 0.04,
    convectiveOrganization: 0.12
  });
  fixture.fields.u[k] = 4;
  fixture.fields.v[k] = 1;
  fixture.fields.uU[k] = 7;
  fixture.fields.vU[k] = 2;
  const result = detectWeatherEventCandidates({
    ...fixture,
    timeUTC: 150 * daySeconds
  });
  assert.equal(result.candidates.some((event) => event.type === WEATHER_EVENT_TYPES.TORNADO_OUTBREAK), false);
  assert.equal(result.candidates.some((event) => event.type === WEATHER_EVENT_TYPES.TORNADO_TOUCHDOWN), false);
  assert.ok(result.rejected.genericRainRejected >= 1);
});

test('fronts and cyclones follow midlatitude storm tracks without polar absurd placements', () => {
  const fixture = makeFixture();
  const midlat = nearestCell(fixture.grid, 45, -35);
  setAt(fixture, midlat, {
    precipRate: 0.38,
    stormGenesisPotentialDiag: 0.86,
    stormDeepeningPotentialDiag: 0.72,
    stormPrecipShieldDiag: 0.74,
    frontalAscentSupportDiag: 0.82,
    stormWarmSectorDiag: 0.72,
    stormColdSectorDiag: 0.68
  });
  fixture.fields.u[midlat] = 18;
  fixture.fields.v[midlat] = 6;

  const polar = nearestCell(fixture.grid, 84, -30);
  setAt(fixture, polar, {
    precipRate: 0.8,
    stormGenesisPotentialDiag: 0.95,
    stormDeepeningPotentialDiag: 0.95,
    frontalAscentSupportDiag: 0.95
  });

  const result = detectWeatherEventCandidates({
    ...fixture,
    timeUTC: 90 * daySeconds
  });
  const cyclone = result.candidates.find((event) => event.type === WEATHER_EVENT_TYPES.EXTRATROPICAL_CYCLONE);
  const front = result.candidates.find((event) => event.type === WEATHER_EVENT_TYPES.FRONT);
  assert.ok(cyclone, 'expected a midlatitude cyclone');
  assert.ok(front, 'expected a midlatitude front');
  assert.ok(Math.abs(cyclone.latDeg) >= 28 && Math.abs(cyclone.latDeg) <= 70);
  assert.ok(Math.abs(front.latDeg) >= 28 && Math.abs(front.latDeg) <= 70);
  assert.notEqual(cyclone.j, Math.floor(polar / fixture.grid.nx));
  assert.notEqual(front.j, Math.floor(polar / fixture.grid.nx));
});

test('event ledger persists lifecycle, history, deterministic ids, and hurricane signatures', () => {
  const fixture = makeFixture();
  const k0 = nearestCell(fixture.grid, 18, -55);
  setHurricaneEnvironment(fixture, k0);
  const detection0 = detectWeatherEventCandidates({ ...fixture, timeUTC: 252 * daySeconds });
  const candidate0 = detection0.candidates.find((event) => event.type === WEATHER_EVENT_TYPES.HURRICANE);
  assert.ok(candidate0);

  const first = new WeatherEventLedger({ seed: 42 });
  const second = new WeatherEventLedger({ seed: 42 });
  const product0 = first.update({ candidates: [candidate0], timeUTC: candidate0.timeUTC, dayOfYear: 252 });
  const product0b = second.update({ candidates: [candidate0], timeUTC: candidate0.timeUTC, dayOfYear: 252 });
  assert.equal(product0.schema, WEATHER_EVENT_PRODUCT_SCHEMA);
  assert.equal(product0.activeEvents[0].id, product0b.activeEvents[0].id);
  assert.equal(product0.activeEvents[0].phase, 'genesis');
  assert.ok(product0.activeEvents[0].hurricane?.eyeRadiusKm > 0);
  assert.ok(product0.activeEvents[0].hurricane?.windField?.maxWindMs >= 33);
  assert.ok(product0.activeEvents[0].hurricane?.satelliteSignature?.spiralBandCount >= 2);
  assert.ok(product0.activeEvents[0].hurricane?.radarSignature?.rainBandDbz >= 30);

  const fixture1 = makeFixture();
  const k1 = nearestCell(fixture1.grid, 19, -52);
  setHurricaneEnvironment(fixture1, k1);
  fixture1.state.tropicalCycloneGenesisPotentialDiag[k1] = 0.86;
  fixture1.state.tropicalCycloneEmbeddedVortexDiag[k1] = 0.88;
  const detection1 = detectWeatherEventCandidates({ ...fixture1, timeUTC: 252 * daySeconds + 6 * 3600 });
  const candidate1 = detection1.candidates.find((event) => event.type === WEATHER_EVENT_TYPES.HURRICANE);
  const product1 = first.update({ candidates: [candidate1], timeUTC: candidate1.timeUTC, dayOfYear: 252 });
  assert.equal(product1.activeEvents.length, 1);
  assert.equal(product1.activeEvents[0].id, product0.activeEvents[0].id);
  assert.ok(['intensification', 'mature'].includes(product1.activeEvents[0].phase));
  assert.ok(product1.activeEvents[0].track.length >= 2);

  const product2 = first.update({ candidates: [], timeUTC: candidate1.timeUTC + 60 * 3600, dayOfYear: 255 });
  assert.equal(product2.activeEvents.length, 0);
  assert.equal(product2.history.length, 1);
  assert.equal(product2.history[0].closedReason, 'environment-no-longer-valid');
});

test('event ledger builds severe-weather signatures and tornado touchdown tracks', () => {
  const fixture = makeFixture();
  const k = nearestCell(fixture.grid, 36, -98);
  setSevereEnvironment(fixture, k);
  const detection = detectWeatherEventCandidates({ ...fixture, timeUTC: 150 * daySeconds });
  const outbreak = detection.candidates.find((event) => event.type === WEATHER_EVENT_TYPES.TORNADO_OUTBREAK);
  const touchdown = detection.candidates.find((event) => event.type === WEATHER_EVENT_TYPES.TORNADO_TOUCHDOWN);
  assert.ok(outbreak, 'expected Great Plains outbreak candidate');
  assert.ok(touchdown, 'expected local touchdown candidate');

  const ledger = new WeatherEventLedger({ seed: 99 });
  const product = ledger.update({
    candidates: [outbreak, touchdown],
    timeUTC: 150 * daySeconds,
    dayOfYear: 150
  });
  const severeOutbreak = product.activeEvents.find((event) => event.type === WEATHER_EVENT_TYPES.TORNADO_OUTBREAK);
  const severeTouchdown = product.activeEvents.find((event) => event.type === WEATHER_EVENT_TYPES.TORNADO_TOUCHDOWN);
  assert.ok(severeOutbreak?.severeWeather);
  assert.ok(severeOutbreak.severeWeather.radarSignature.hookEcho);
  assert.ok(severeOutbreak.severeWeather.radarSignature.velocityCouplet);
  assert.ok(severeOutbreak.severeWeather.satelliteSignature.overshootingTop);
  assert.ok(severeOutbreak.severeWeather.warningPolygon.length >= 4);
  assert.ok(severeOutbreak.severeWeather.touchdownTracks.length >= 1);
  assert.ok(severeOutbreak.severeWeather.damageSwaths.length >= 1);
  assert.ok(severeTouchdown?.severeWeather?.touchdownTracks?.length === 1);
  assert.ok(severeTouchdown.severeWeather.damageSwaths[0].polygon.length >= 4);
});

test('weather kernel payload exposes deterministic event products through the boundary', async () => {
  const kernel = createWeatherKernel({
    nx: 12,
    ny: 6,
    dt: 3600,
    seed: 7,
    instrumentationMode: 'disabled'
  });
  await kernel.whenReady();
  kernel.advanceModelSeconds(3600);
  const payload = kernel.getWorkerPayload({ mode: 'compact' });
  assert.equal(payload.events.schema, WEATHER_EVENT_PRODUCT_SCHEMA);
  assert.equal(payload.events.contractVersion, kernel.contractVersion);
  assert.ok(payload.events.summary);
  const repeat = kernel.getEventProduct();
  assert.equal(repeat.timeUTC, payload.events.timeUTC);
});
