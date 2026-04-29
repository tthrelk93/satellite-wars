# Weather Model Claims

Status: Phase 0 claim contract

This document defines what the game is allowed to claim as simulated, parameterized, or visualized.

## Simulated By The Global Model

The certified global weather model may be described as simulating:

- global seasonal circulation
- ITCZ placement and width
- Hadley/Ferrel/polar broad overturning behavior through diagnostics and parameterized dynamics
- trade winds and midlatitude westerlies
- tropical rainfall regimes
- subtropical dry belts
- rainforest, desert, monsoon, tundra, and ocean stratocumulus climate behavior
- ocean mixed-layer and sea-ice proxies
- global precipitation, evaporation, column water, clouds, pressure, winds, and temperature fields
- broad storm-track placement and seasonal migration
- numerical water-budget and dt/grid sensitivity gates

Allowed claim language:

- "world-class Earth-like climate behavior for a video game"
- "global climate and weather regimes are simulated"
- "the global model drives seasons, basins, storm tracks, rainfall, deserts, rainforests, and ocean cloud belts"

## Parameterized Event Systems

These systems may be described as parameterized events spawned from model environments:

- hurricanes and tropical cyclones
- tornado outbreaks and touchdown tracks
- supercells
- mesoscale convective systems
- atmospheric rivers
- blizzards
- dust storms
- local hail and damaging-wind swaths

Allowed claim language:

- "hurricanes are parameterized storm systems spawned from SST, humidity, shear, vorticity, basin season, and organized convection"
- "tornadoes are local touchdown events spawned from severe-weather environments"
- "events are physically constrained by the global model"

Forbidden claim language unless a future high-resolution solver proves it:

- "the global grid resolves tornado vortices"
- "the global model resolves hurricane eyewalls from first principles"
- "county-level tornado touchdown paths are directly resolved by the global atmosphere"
- "full CFD or operational NWP accuracy"

## Visualized Or Downscaled

These features may be described as visualized or downscaled from model/event state:

- hurricane eyes, eyewalls, spiral bands, and storm surge cues
- tornado funnels, debris/damage swaths, hook echoes, and velocity couplets
- cloud towers, anvils, frontal shields, stratocumulus decks, fog, dust, lightning, rain shafts, snow bands
- radar, satellite visible/IR/water-vapor products
- local gusts and storm-scale texture near the camera/player

Allowed claim language:

- "visual detail is generated from model state, event ledgers, and deterministic local downscaling"
- "radar and satellite products reflect the simulated state"

## Evidence Requirements

Every major claim requires current artifacts:

- Climate claims require matching planetary audits.
- Annual/seasonal claims require annual/seasonal artifacts.
- Event claims require event-ledger and seasonality audits.
- Visual claims require browser or packaged runtime screenshots plus telemetry.
- Performance claims require fresh runtime summaries.
- Portability claims require deterministic replay tests and boundary guard tests.
