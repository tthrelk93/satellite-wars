// core.js: orchestrates physics steps for the weather model
import { createLatLonGrid } from './grid';
import { createFields, initAtmosphere } from './fields';
import { loadGeoTexture, analyticGeo } from './geo';
import { cosZenith, surfaceRadiation } from './solar';
import { updateSurface } from './surface';
import { computeDensity, stepWinds } from './dynamics';
import { advectScalar } from './advect';
import { stepMicrophysics } from './microphysics';
import { stepConvection } from './convection';
import { computeRH, computeVorticity, computeCloudDensity, computePrecipRate } from './diagnostics';

export class WeatherCore {
  constructor({
    nx = 180,
    ny = 90,
    dt = 120,        // modelDt seconds
    timeScale = 200, // model seconds per real second
    kappa = 2000     // diffusion m^2/s
  } = {}) {
    this.grid = createLatLonGrid(nx, ny);
    this.fields = createFields(this.grid);
    this.geo = {
      landMask: new Uint8Array(this.grid.count),
      elev: new Float32Array(this.grid.count),
      albedo: new Float32Array(this.grid.count),
      soilM: new Float32Array(this.grid.count),
      rough: new Float32Array(this.grid.count)
    };
    this.timeUTC = 0;
    this.modelDt = dt;
    this.timeScale = timeScale;
    this.kappa = kappa;
    this._accum = 0;
    this.ready = false;
    initAtmosphere(this.fields, this.grid);
    this._tmp = new Float32Array(this.grid.count);
    this._loadGeo();
  }

  async _loadGeo() {
    const geo = await loadGeoTexture(this.grid.nx, this.grid.ny);
    if (geo) {
      this.geo = geo;
    } else {
      this.geo = analyticGeo(this.grid.nx, this.grid.ny, this.grid.latDeg);
    }
    this.ready = true;
  }

  step(realDtSeconds) {
    if (!this.ready) return;
    this._accum += realDtSeconds * this.timeScale;
    const maxSteps = 8;
    let steps = 0;
    while (this._accum >= this.modelDt && steps < maxSteps) {
      this._stepOnce(this.modelDt);
      this._accum -= this.modelDt;
      steps++;
    }
  }

  _stepOnce(dt) {
    const { grid, fields, geo } = this;
    const dayOfYear = (this.timeUTC / 86400) % 365;
    const tauRad = 5 * 86400; // radiative relaxation timescale
    // Radiation per cell
    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        const k = j * grid.nx + i;
        const latRad = (grid.latDeg[j] * Math.PI) / 180;
        const cosZ = cosZenith(latRad, grid.lonDeg[i], this.timeUTC, dayOfYear);
        const cloudFrac = Math.min(1, fields.cloud[k] || 0);
        const rad = surfaceRadiation({
          cosZ,
          cloudFrac,
          albedo: geo.albedo[k],
          Ts: fields.Ts[k],
          Tair: fields.T[k]
        });
        fields.rad[k] = rad;

        const sinLat = Math.sin(latRad);
        const Teq = (285 - 55 * (sinLat * sinLat)) + 10 * cosZ - 6 * cloudFrac;
        fields.T[k] += (Teq - fields.T[k]) * (dt / tauRad);
      }
    }

    // Surface fluxes (updates Ts, T, qv)
    updateSurface({ dt, fields, geo, rad: fields.rad, grid });

    // Density from state
    computeDensity(fields);

    // Winds
    stepWinds({ dt, grid, fields, geo });

    // Advection of T, qv, qc, qr, ps (ps passive for now)
    this._advectAll(dt);

    // Microphysics
    stepMicrophysics({ dt, fields });

    // Convection trigger
    stepConvection({ dt, fields, geo, grid });

    // Diagnostics
    computeRH(fields);
    computeVorticity(fields, grid, fields.vort);
    computeCloudDensity(fields, fields.cloud);
    computePrecipRate(fields, fields.precipRate);

    this.timeUTC += dt;
  }

  _advectAll(dt) {
    const { grid, fields } = this;
    const tmp = this._tmp;
    advectScalar({ src: fields.T, dst: tmp, u: fields.u, v: fields.v, dt, grid, kappa: this.kappa });
    fields.T.set(tmp);
    advectScalar({ src: fields.qv, dst: tmp, u: fields.u, v: fields.v, dt, grid, kappa: this.kappa });
    fields.qv.set(tmp);
    advectScalar({ src: fields.qc, dst: tmp, u: fields.u, v: fields.v, dt, grid, kappa: this.kappa });
    fields.qc.set(tmp);
    advectScalar({ src: fields.qr, dst: tmp, u: fields.u, v: fields.v, dt, grid, kappa: this.kappa });
    fields.qr.set(tmp);
    advectScalar({ src: fields.ps, dst: tmp, u: fields.u, v: fields.v, dt, grid, kappa: this.kappa * 0.5 });
    fields.ps.set(tmp);
  }
}
