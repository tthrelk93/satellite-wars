# Phase 1ZT South Mirror Rebound Attribution

## Verdict

- cross_equatorial_compensation_without_local_recharge
- Next phase: Phase 1ZU: Bilateral Balance Patch Design
- Do not chase this with another local south humidity or omega patch. The south mirror rebound looks like a cross-equatorial compensation path after the NH source lane is suppressed, so the next step should be a bilateral balance design in the vertical/core lane.

## South Mirror Signal

- -11.25° source condensation delta: `0.02648`
- -3.75° edge condensation delta: `0.00309`
- -11.25° TCW delta: `-0.002`
- -11.25° BL RH delta: `-0.001`
- -11.25° lower omega delta: `0.00016`
- -3.75° TCW delta: `-0.008`
- -3.75° BL RH delta: `0`
- -3.75° lower omega delta: `0.00006`

## Why This Looks Like Compensation, Not Local Recharge

- cross-equatorial vapor-flux delta: `-0.21439`
- tropical-shoulder condensation delta: `-0.01354`
- equatorial precip delta: `-0.001`
- humidification signal: `0.02`
- omega signal: `0.00022`

## North-Side Context

- 11.25°N source condensation delta: `-0.02383`
- 3.75°N edge condensation delta: `-0.00682`

## Next Step

- keep: keep the northside supported-source-normalized leak gate available behind the runtime toggle
- keep: keep the bilateral equatorial-edge geometry and existing south-edge guard plumbing
- change: design the next patch around bilateral balance / cross-equatorial compensation rather than local south humidification
- change: treat the south rebound as a remote response to NH suppression because local TCW, RH, omega, cloud, and precipitation barely move
- change: avoid a south-only local sink until a bilateral balance lane has been tested
