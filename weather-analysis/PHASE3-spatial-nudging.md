# Phase 3 spatial climatology targets and full-column nudging

This note documents the Phase 3 steering path.

## Source precedence

For nudging sources, `auto` means:
1. use `state.analysisTargets` when available
2. otherwise use spatial climatology targets from `climo`
3. otherwise fall back to older latitude-only wind nudges only where explicitly retained as fallback

## Climatology fields now plumbed through `optionalNudging`

Supported monthly scalar/vector products in the climatology manifest:

- `slp`
- `wind` (surface u/v)
- `wind500` (midlevel u/v)
- `wind250` (upper-level u/v)
- `t2m`
- `q2m`
- `q700`
- `q250`
- `t700`
- `t250`

If present, these are interpolated month-to-month into current fields in `climo2d`:

- `windNowU`, `windNowV`
- `wind500NowU`, `wind500NowV`
- `wind250NowU`, `wind250NowV`
- `q2mNow`, `q700Now`, `q250Now`
- `t700Now`, `t250Now`

## Nudging controls

`nudging5` now supports:
- `enableThetaColumn`
- `enableQvColumn`
- `enableWindColumn`
- `thetaSource`
- `qvSource`
- `windSource`
- `tauThetaColumn`
- `tauQvColumn`
- `tauWindColumn`

These work alongside the existing surface nudges for `ps`, surface `theta`, and surface `qv`.

## Wind steering behavior

`windNudge5` now prefers spatial climatology targets when available:
- surface winds from `windNowU/V`
- upper winds from `wind500NowU/V` or `wind250NowU/V`

The old latitude-only zonal-mean path remains only as fallback when spatial fields are absent.

`windEddyNudge5` is disabled automatically when spatial wind targets are available, unless fallback behavior is explicitly forced.
