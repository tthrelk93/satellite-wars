# Earth Weather Architecture C39 Inner-Core Organized-Support Restore Attribution

This phase attributes why the C38 inner-core organized-support restore was inert. The question is whether the inner-core taper reached the live carry-input override targets at all, or whether it missed the actual receiver / transition rows where the strict C32 gate is binding.

- decision: `inner_core_restore_inert_active_override_targets_outside_restore_band`
- next move: Architecture C40: transition-band organized-support restore experiment

## C32 vs C38 quick comparison

- cross-equatorial vapor flux north: C32 `-356.96839`, C38 `-356.96839`
- ITCZ width: C32 `23.374`, C38 `23.374`
- NH dry-belt ratio: C32 `1.122`, C38 `1.122`
- SH dry-belt ratio: C32 `0.493`, C38 `0.493`
- NH midlatitude westerlies: C32 `1.219`, C38 `1.219`
- NH dry-belt ocean condensation: C32 `0.10807`, C38 `0.10807`

## Carry-input override latitude coverage

- inner-core restore max |lat|: `10.5°`
- C32 accumulated override hits: `33.75°: 5.698`, `26.25°: 18.625`, `18.75°: 12.354`, `-18.75°: 7.313`, `-26.25°: 9.729`, `-33.75°: 0.104`
- C38 accumulated override hits: `33.75°: 5.698`, `26.25°: 18.625`, `18.75°: 12.354`, `-18.75°: 7.313`, `-26.25°: 9.729`, `-33.75°: 0.104`
- C32 accumulated removed mass: `33.75°: 4.531`, `26.25°: 14.891`, `18.75°: 10.81`, `-18.75°: 5.343`, `-26.25°: 7.205`, `-33.75°: 0.082`
- C38 accumulated removed mass: `33.75°: 4.531`, `26.25°: 14.891`, `18.75°: 10.81`, `-18.75°: 5.343`, `-26.25°: 7.205`, `-33.75°: 0.082`
- C32 in-band hit rows: none
- C38 in-band hit rows: none
- C32 out-of-band hit rows: `33.75°: 5.698`, `26.25°: 18.625`, `18.75°: 12.354`, `-18.75°: 7.313`, `-26.25°: 9.729`, `-33.75°: 0.104`
- C38 out-of-band hit rows: `33.75°: 5.698`, `26.25°: 18.625`, `18.75°: 12.354`, `-18.75°: 7.313`, `-26.25°: 9.729`, `-33.75°: 0.104`

## Interpretation

- The C38 inner-core restore did not change the quick climate signature at all relative to the strict C32 carveout.
- The carry-input override accumulators are also unchanged to reporting precision between C32 and C38.
- The active override rows sit in the transition / receiver latitudes around `18.75°`, `26.25°`, `33.75°` and their southern mirrors, all outside the inner-core taper.
- That means the inner-core restore was geometrically inert: it never touched the actual rows where the organized-support gate is binding.

## Next experiment contract

- Keep the strict C32 organized-support / potential carveout fixed in the equatorial core.
- Restore organized-support admission only across the active transition band where the carry-input override is actually firing.
- Keep the restore bounded with a latitude taper so the experiment can recover blocked transition transport without reopening the full receiver side.
- Candidate focus lanes:
  - `restore organized-support admission across the active transition band near 18.75°–33.75° and mirrored southern rows`
  - `leave the equatorial core at the strict C32 organized-support / potential carveout`
  - `preserve the C32 receiver containment while testing whether the live blocked subset is transition-band only`

