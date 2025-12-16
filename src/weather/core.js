// core.js: orchestrates physics steps for the weather model
import { createLatLonGrid } from './grid';
import { createFields, initAtmosphere } from './fields';
import { loadGeoTexture, analyticGeo } from './geo';
import { solarDeclination, cosZenith, surfaceRadiation } from './solar';
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
    dt = 120,
    diffusion = 1e-4
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
    this.dt = dt; // seconds model time per step
    this.diffusion = diffusion;
    this.ready = false;
    initAtmosphere(this.fields, this.grid);
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
    const steps = Math.max(1, Math.floor(realDtSeconds / this.dt));
    for (let s = 0; s < steps; s++) {
      this._stepOnce(this.dt);
    }
  }

  _stepOnce(dt) {
    const { grid, fields, geo } = this;
    const dayOfYear = (this.timeUTC / 86400) % 365;
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
    computeVorticity(fields, grid, this.vorticity || (this.vorticity = new Float32Array(fields.T.length)));
    computeCloudDensity(fields, fields.cloud);
    computePrecipRate(fields, fields.precipRate);

    this.timeUTC += dt;
  }

  _advectAll(dt) {
    const { grid, fields } = this;
    const tmp = new Float32Array(fields.T.length);
    advectScalar({ src: fields.T, dst: tmp, u: fields.u, v: fields.v, dt, grid, diffusion: this.diffusion });
    fields.T.set(tmp);
    advectScalar({ src: fields.qv, dst: tmp, u: fields.u, v: fields.v, dt, grid, diffusion: this.diffusion });
    fields.qv.set(tmp);
    advectScalar({ src: fields.qc, dst: tmp, u: fields.u, v: fields.v, dt, grid, diffusion: this.diffusion });
    fields.qc.set(tmp);
    advectScalar({ src: fields.qr, dst: tmp, u: fields.u, v: fields.v, dt, grid, diffusion: this.diffusion });
    fields.qr.set(tmp);
    advectScalar({ src: fields.ps, dst: tmp, u: fields.u, v: fields.v, dt, grid, diffusion: this.diffusion * 0.5 });
    fields.ps.set(tmp);
  }
}
