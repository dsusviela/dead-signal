# The score — working notes and progress log

> **This file is the source of truth for the music system.** If a session is interrupted,
> read this before touching `audio.js`. The calibration numbers below were measured against
> real play and are the reason the current values are what they are — changing them without
> re-measuring will silently undo the work.

## State: landed 2026-09-16

- [x] Five discrete songs, one bus each, crossfaded by a threat meter
- [x] Patient Furnace gets its own piece, not the city score sped up
- [x] Threat tiers calibrated against measured play
- [x] `tools/test-songs.mjs` — 14 checks
- [x] `tools/test-pulse.mjs` — perceived tempo per song
- [x] `tools/test-crowd.mjs` — headcount distribution from a real sim
- [ ] Verify by ear in the browser (`npm run serve`) — nobody has done this end to end in game

## How to check it without playing

```
node tools/test-songs.mjs audio.js     # 14 checks: tiers, hysteresis, no drain, budget, bands
node tools/test-pulse.mjs audio.js     # perceived tempo: onsets/sec and median gap per song
node tools/test-crowd.mjs              # 6 min of real play -> headcount distribution (slow, ~2 min)
```

There is also a **bench artifact** that runs the real `audio.js` in a browser with live
controls for headcount, boss phase and surge, and meters reading the actual bus gains. It is
the only way to *hear* this. Re-splice it by substituting `audio.js` into the template for
`/*__AUDIO_JS__*/`. Neither the model nor the tools can hear anything — the bench is the
only review surface that matters for taste.

## The five songs

One plays at a time. A threat change crossfades one out and the next in; these are separate
pieces, not layers of one arrangement, so a swap changes the music rather than its density.

| song | threat | step | centre | what makes it its own piece |
|---|---|---|---|---|
| `songExplore` | 0-9 | .34 | 4 roots, turning | no pulse at all; silence and the reverb tail |
| `songProwl` | 10-29 | .27 | D against its flat 2nd | heartbeat on 0 and 6, never settles into a beat |
| `songFight` | 30-54 | .21 | D minor | four on the floor, walking bass, hats — the only groove |
| `songSwarm` | 55+ | .165 | D, no third | thirty-seconds, 12 hits/sec, no sustained voice at all |
| `furnace` | boss | .34-.30 | F1 pedal, fixed | 12-step three, bellows and hammer, nothing resolves |

Tier selection is `tierFor()` with **6-count hysteresis** so the score does not flap on a
threshold. Crossfade time scales with the jump: 1 tier 1.6 s, 2 tiers 0.8 s, 3 tiers 0.35 s.
The furnace overrides that — in over 0.12 s, back out over 1.2 s.

## Measured numbers — the reason the constants are what they are

### Headcount in real play (`tools/test-crowd.mjs`, 6 min, 4 survivors)

```
p25 36   median 46   p75 55   p95 82   max 97
minute-by-minute median: 12, 37, 40, 51, 52, 57
```

**Re-measured 2026-09-16 after the city revamp** (CITY.md Phase 12A; new fixed city, same seed,
4 survivors, before any boss): `p25 31  median 41  p75 49  p95 81  max 90`, minute medians
`7, 31, 34, 43, 48, 51`, 1.9% of samples moved the mix by more than 0.05, no snaps. Denser
buildings slow the build-up in the first minute and trim the peaks; the thresholds were **not**
changed — a run still climbs PROWL → FIGHT and reaches SWARM at its peaks. Local convergence
(Phase 11/12) only lowers spawns after Patient Furnace dies and the final push only raises them at
Checkpoint Nine, so neither is in this pre-boss sample; both need the listening pass.

The tier thresholds (10 / 30 / 55) come from this. **A run therefore walks up through
PROWL → FIGHT → SWARM on its own**, and shaking the horde off on a backtrack drops it to
EXPLORE — which is the whole point of the run structure.

> **The mistake this replaced:** the first version scaled the mix by `crowd/9`, a number
> taken from a tier table rather than from the game. Against a median of 46 that pinned the
> combat layer at full for **93% of play** and `pressure()` (which drives `heat`) with it.
> The music was adaptive on paper and a flat wall in the room. If you change a threshold,
> re-run `test-crowd.mjs` first.

### Perceived tempo (`tools/test-pulse.mjs`)

Felt tempo is **onset rate, not the grid**. Measured over 24 s, counting voices shorter than
0.30 s as percussive:

| song | grid bpm | percussive onsets/s | median gap |
|---|---|---|---|
| explore | 44 | 0.2 | 5.44 s |
| prowl | 56 | 1.2 | 0.710 s |
| fight | 71 | 8.0 | 0.210 s |
| swarm | 91 | **11.5-12.1** | **0.083 s** |

> **The mistake this replaced:** swarm's grid was faster than fight's (91 vs 71 bpm) while
> its *felt* pulse was less than half (3.9 vs 8.0 onsets/s). The song at the top of the
> ladder felt slower than the one below it. A straight sixteenth line at swarm's tempo is
> only 6.06/s, so it could not beat fight on-grid — the gaps are filled **off-grid**, with a
> tick at `t + step/2` on twelve of sixteen off-slots.

## Hard constraints

- **48 simultaneous voices, globally, shared with gunfire.** `voice()` silently drops
  anything over the cap. Current peaks: explore 6, prowl 6, fight 8, swarm 7-9. Under a
  pathological load (four guns at the cooldown floor, 97 enemies) the worst case measured is
  **45/48 with zero music notes dropped**.
  > An earlier swarm sat at ~47 voices/bar and dropped its own notes in exactly the
  > situation it existed for. Scheduling rate is not the number that matters — **peak
  > simultaneity** is.
- **The gun band is 1.5-4 kHz and belongs to gunfire** (shot noise is 1700-3600 Hz and
  near-continuous). No song may put anything there. `900 Hz-1.5 kHz` and `>4 kHz` are
  available and are where the swarm song's dread lives (whine and shriek at 4.7-7.5 kHz).
  > An earlier swarm fired a 4200 Hz tick on every sixteenth — **365 events/min above
  > 2 kHz**. That was the "high beat is not good" complaint. Current total above 900 Hz
  > across all songs: ~31/min, gun band exactly 0.
- **`noise()` hardcodes Q = 0.7**, so any bandpass is ~2 octaves wide. "Out of the gun band"
  means centre frequency; a 1250 Hz formant's upper skirt still reaches ~2.3 kHz at reduced
  level.
- **A 2.4 s reverb tail** sits on the music bus. Dense fast material turns to mush through it.
- **`audio.js` is CRLF.** Multi-line anchors written with `\n` will not match it.

## City sound (CITY.md Phase 12A, 2026-09-16)

All new sound is on the **effects** bus and follows the constraints above: action cues keep their
energy below 1.5 kHz or above 4 kHz (hisses and paper sit at 5-6 kHz; the tile footstep tick
is 1.1 kHz), and nothing new touches the music bus.

- **Engines by vehicle type** (`ENGINE` in audio.js): sedan saw 38-100 Hz; fire truck square
  27-63 Hz with a darker filter; bulldozer square 22-46 Hz (pitch over its 140 top speed since the city_v2 retune) plus a speed-driven track clank train
  that is skipped when more than 44 voices are live. Pitch follows speed over that type's top speed.
- **Action cues:** board (crank / long diesel turnover), dismount and stall (plus the truck's air
  release), breakdown, blade strain (0.25 s cooldown) and route cleared, pour / refuelled /
  reject / pour stopped, forced door, gate motor open/close, hold start, generator start, paper,
  payload and override pickup, station ready, transmission sent, furnace down, escape, and
  footsteps by floor (tile, wood, concrete, gravel, grass, asphalt; 0.1 s cooldown).
- **Persistent loops** (released by `stopVoices` on pause, hidden tab, mute, new run, win/loss):
  the generator hum near the chapel only while the circuit is live, and fire crackle only
  near a still-burning (Ashworks) wreck — cold wrecks never.
  The district ambience bed and transmitter static were removed at the user's request on
  2026-09-16 to eliminate the continuous static. Music and action cues remain unchanged.
- **Source-bound incidentals** (city_v2 Section 5, 2026-09-16): no beds or loops. Each district has
  one short one-shot bound to a real nearby object, played at random 8–28 s gaps and only in its
  condition: street metal by South Blocks dumpsters/bins, wind at collapsed Old Quarter terraces,
  failing ventilation at Civic Ward hospital/clinic buildings, a transformer buzz at the Utility Yard
  only on a live circuit and wind at the Blackglass mast, hot-metal pings by a still-burning Ashworks
  wreck, fence rattle in Central Quarantine. Silent during the boss fight and above 40 voices; cleared
  with every other voice on pause, hidden tab, mute and new run; never simulation noise.
  `DSAudio.primeIncidentals()` is the test hook. Listening review still pending.
- **Measured load** (`tools/test-audio.mjs`): three engines, both remaining loops, the boss song, a
  volley of eight shots and two heavy cues together stay at or below 48 voices without clipping.
- **Hearing is simulation-only** (`game.js` never reads `DSAudio`): pour 110, gate motor 380,
  transmission 500 per second, blade strain 480 and route cleared 720, the running generator 260
  every 4 s; paper, eating and ambience make no noise.

## Traps

- **Intensity must not decay while the situation is unchanged.** An earlier version compared
  the crowd against a ~14 s rolling average, so the layer bled out while the horde was still
  there. `test-songs.mjs` holds a headcount for 25 s and fails if the gain drifts > 0.02.
- **Do not assume intensity means more voices.** A heavier song can be sparser and lower. A
  test asserting monotonically rising density was *passing* the near-cap version that broke
  itself, and *failing* the good one.
- **The music bus is `music`; each song has its own gain under it.** `musicMuted` (the
  options menu) sets `music.gain`, so it correctly silences all five.
- Boss phase changes fire a one-shot detuned shove; `cue('boss')` is a separate **effects**-bus
  stinger and is not part of the score.

## Open

- Nobody has heard this in the actual game. The bench proves the mechanism; the mix against
  gunfire, footsteps and the engine loop is unverified.
- The swarm whine (`.014`, 4.6-7.5 kHz) is the element most likely to read as a test tone
  rather than dread. If so, drop its level or widen its rotation — **do not move it down**,
  that is the gun band.
- If swarm reads muddy rather than slow, the lever is the tick level and density (drop to 8
  of 16 off-slots), not the tempo.
