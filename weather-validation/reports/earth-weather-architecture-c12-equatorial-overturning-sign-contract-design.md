# Earth Weather Architecture C12 Equatorial Overturning Sign Contract Design

This phase converts the C11 flux-inversion result into an explicit implementation contract for the next donor/current hybrid experiment.

- decision: `current_low_level_momentum_preserve_layer_required`
- next move: Architecture C13: equatorial overturning sign contract experiment

## Attribution basis

- cross-equatorial vapor flux north: off `143.95306`, on `-371.9765`
- equatorial low-level velocity mean: off `11.78514`, on `-20.46744`
- NH westerlies: off `0.531`, on `1.061`
- interpretation: the donor/current hybrid keeps the stronger extratropical circulation scaffold but reverses equatorial overturning sign

## Contract

- Keep donor `core5.js` / `vertical5.js` as the main scaffold.
- Forward-port the current low-level momentum/nudging preserve layer first:
  - `src/weather/v2/windNudge5.js`
  - `src/weather/v2/windEddyNudge5.js`
  - `src/weather/v2/nudging5.js`
- Patch donor-core default parameters only in the low-level sign-control lane:
  - `windNudgeParams.tauSurfaceSeconds: 7 * 86400 -> 8 * 3600`
  - `nudgeParams.tauQvS: 30 * 86400 -> 45 * 86400`
  - `nudgeParams.tauQvColumn: 12 * 86400 -> 18 * 86400`
  - `nudgeParams organized/subsidence relief quartet from current core`
- Do not port `dynamics5.js` in the first experiment.
- Judge the experiment only by full-objective quick/annual climate gates, not by local equatorial metrics alone.

## Evidence from current vs donor scaffold delta

- The hybrid flips equatorial low-level velocity from northward to strongly southward while improving NH westerlies, which points to a low-level sign-control mismatch rather than a generic circulation collapse.
- Current-vs-donor core diff exposes the strongest sign-control change in low-level wind nudging: -      tauSurfaceSeconds: 7 * 86400, | +      tauSurfaceSeconds: 8 * 3600,
- Current-vs-donor core diff also changes surface/column moisture nudging timescales: -      tauQvS: 30 * 86400, | +      tauQvS: 45 * 86400, | -      tauQvColumn: 12 * 86400, | +      tauQvColumn: 18 * 86400,
- Current core adds organized/subsidence relief terms consumed by current nudging modules: +      organizedConvectionQvSurfaceRelief: 0.85,

