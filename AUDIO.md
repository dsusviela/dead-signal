# The score: working notes and progress log

> **This file is the source of truth for the music system.** If a session is interrupted,
> read this before touching `audio.js`. The limits below were measured. Changing a threshold
> or a voice budget without re-running the tools will silently undo that work.

## State: rewritten 2026-09-17

2026-09-17, later: the user found the scaling too aggressive. Fight/overrun thresholds rose (table below),
fight 140 → 132 bpm and overrun 160 → 150, combat layers fade in and sit at .8, and pause keeps the score
playing softly instead of stopping it.

The five separate beep-pattern songs (explore/prowl/fight/swarm/furnace) were replaced. The user
found them cheap-sounding and unmusical. They asked for **suspense and near-horror while exploring,
frantic fights, a different mood in each quarter**, in a **dark ambient horror** style, still fully
procedural.

- [x] Synthesis kit: periodic-wave strings, reed, brass and glass; 2-op FM piano, music box and bells;
      formant choir; skin drums, anvils, swells; one long-lived gliding drone
- [x] Mix bus: saturation, a dark 4.2 s hall, a short room, a filtered echo, and a duck under gunfire
- [x] Stealth-aware director (calm / suspense / fight / overrun / boss) with dwell times
- [x] Six quarter palettes; the Patient Furnace rewritten on the new kit
- [x] `tools/test-score.mjs` (33 checks), `tools/test-crowd.mjs` state distribution, `test-audio` overrun case
- [x] Listening bench: `npm run bench:music` builds `artifacts/music-bench.html`
- [ ] **User listening pass on the bench, one quarter at a time**
- [ ] In-game pass (`npm run serve`): sneak, get spotted, fight, lose them, cross a quarter, boss

## How to check it

```
node tools/test-score.mjs     # director, quarters, voice budget, gun band, no beds, tempo ladder, lifecycle
node tools/test-crowd.mjs     # 6 min of real play -> headcount and music-state distribution (~35 s)
npm run bench:music           # rebuild the listening bench after ANY change to audio.js
```

None of the tools can hear anything. **The bench is the only review surface for taste.**
It splices the real `audio.js` into `tools/music-bench.template.html` at `/*__AUDIO_JS__*/`.

## Architecture

One **conductor** (a sixteen-step lookahead clock) drives one arrangement in **layers**, on two axes:

- **Quarter** (`QUARTERS`, keyed by `DSWorld.district(camera).id`): root, chords, drone colour,
  pad wave, motif, texture, pulse kind, combat ostinato and drum kit.
- **State** (`STATES`): which layers play (`MIX`) and the tempo (`STEP` × the quarter's `tempo`).

| layer | what | plays in |
|---|---|---|
| drone | 2 cello bodies on root + fifth, breathing filter; glides, never retriggers | all |
| bed | two-note bowed pads, 2 bars each | calm, suspense |
| texture | a quarter's gesture every 4 bars (choir, bowed metal, glass cluster) + suspense swells | calm, suspense |
| motif | the quarter's theme, 32-step phrases, every 4th phrase silent; 2 notes only under suspense | calm, suspense |
| pulse | off-beat pizzicato pedal + heart / monitor / SOS / anvil / knock | suspense |
| combat | 16th spiccato ostinato (3-3-4-2-4 accents), syncopated drums, fills, brass stabs, riser | fight, overrun |
| overrun | off-grid second ostinato, brass blasts, a sub on every bar | overrun |
| boss | the Patient Furnace | boss |
| sting | contact, release, CREST, boss phase | events |
| down | its own bus past the duck. **Level up** (cue `level`): the score hushes to 18% for 2.2 s, a 5.4/6.1 kHz ring, a low FM bell (98 Hz) tolled twice, a sub; with music off it plays on effects without the hush. **Survivor down** (any survivor newly dead, detected in `update()` so it also plays with music off, then on effects): about 1.5 s, a kill landing. The score hushes to 20% for 1.5 s. A detuned saw pair (880/932 Hz) slashes down with 5.4 k blade air; the cut is wet, with two narrow bandpass `squelch` gushes (1300→260, 900→170 Hz) and a 330→72 Hz gloop; the body lands with a 50 Hz thud, a three-burst splatter and a bounce; then the drama, a dying breath on an 'ah' choir falling a fifth from 220 Hz over a 73/78/110 Hz saw cluster and a 30 Hz boom. **Full wipe** (cue `lost`, effects bus): a D-minor-plus-flat-second saw chord over a 30 Hz boom, echoed 7 times every 0.36 s, each quieter (x0.6), darker (cutoff x0.66) and panned wider, over a sinking low D saw | events |

Sends: bed/texture/motif live in the hall (motif and texture also in the echo); combat and overrun
stay in the short room so the fast material doesn't smear. The old swarm song showed what a long tail
does to it.

### The director

`sense()` counts infected within **330u** of a living survivor, split by their AI state
(`chase`, or `alert`/`investigate`/`search`).

| state | enters when | tempo |
|---|---|---|
| calm | nothing below | 60 bpm (16th .25 s) |
| suspense | any alert or chasing infected, or ≥15 nearby | 83 bpm |
| fight | ≥5 chasing, or combat in the last 4 s (hurt, explosion, a shot with ≥3 infected near), or ≥40 nearby | 132 bpm |
| overrun | ≥60 chasing, ≥80 nearby, or CREST with ≥40 nearby and ≥15 chasing | 150 bpm |
| boss | `s.boss.active` | 12-step furnace clock |

- **Climbing lands on the next beat** and restarts the bar there. Fight and overrun layers fade in over ~.35 s
  (not a .03 s slam) and sit at .8 in the mix; only the furnace still cuts in hard.
- **Falling is one level at a time**, after the danger has been unjustified for `DWELL` =
  overrun 4 s, fight 6 s, suspense 10 s. It lands on a bar line. Holding a state uses thresholds
  lowered by 6 (and chase ≥2), so a boundary cannot flap.
- Crossing into fight fires the contact sting (at most every 15 s); falling out of it fires the release.
- **Quarter** switches need the camera to stay 3 s in the new quarter, then wait for a bar line. The
  drone glides to the new root.

### Quarters

| id | quarter | root | colour |
|---|---|---|---|
| checkpoint | South Blocks | D, aeolian | detuned FM piano, cello, heartbeat |
| ruins | Old Quarter | E, whole-tone | music box (FM 2.76) sinking out of tune, 'oo' ghost choir, knocks |
| hospital | Civic Ward | B, locrian | glass bells (FM 1.41), semitone glass cluster, monitor beep at 988 Hz |
| northline | Northline | A, open fifths | hollow e-piano (FM 2), reed pads, low SOS in the pulse |
| industry | Ashworks | F, phrygian-dominant | bowed metal, anvil shift (0/6/12), grind chords, anvil combat kit |
| quarantine | Central Quarantine | C#, octatonic | low brass motif, 'ah' choir cluster, heart + tick |

## Measured numbers

### Voices (`test-score.mjs`, queued-or-sounding peak per state × quarter)

The 48-voice cap counts a voice from when it is **queued** (up to 120 ms of lookahead), not from
when it sounds. The first bench run showed 23 in overrun while a sounding-only count said 15. The
test now measures queued voices, and overrun was trimmed (no hats, low doubling only on 0/6, 11 of 16
off-grid slots, 2-note blasts).

```
calm 8-11   suspense 12-17   fight 12-15   overrun 17-19   furnace phase 3: 13
```

Test limit: **20**. Gunfire, engines and loops share the other 28.

### Felt tempo (percussive onsets/s over 16 s)

```
calm 0   suspense 1.5-3.4   fight 21-25   overrun 25-28   furnace 6.8
```

### Real play (`test-crowd.mjs`, 4 invulnerable survivors standing still, seed 12345)

```
headcount  p25 35  median 39  p75 42  p95 71  max 83
state      calm 8.6%  suspense 7.5%  fight 68.9%  overrun 15.0%   (8 changes in 6 min)
minute 1   calm 52%, suspense 45%, fight 3%;  minutes 2-6 fight with overrun spikes
```

This sim is the worst case: nobody moves, so the horde piles up. Real play with backtracking and
stealth should spend far more time in calm and suspense. Chasing counts stayed at 1-2 there, so fight
was driven by the ≥30 headcount rule. If the in-game pass reads as "always fighting", that rule is
the lever.

### Levels (headless Chrome, South Blocks)

Music bus RMS about 0.06 in every state. Post-limiter peak 0.14 calm → 0.25 overrun. No clipping.

## Hard constraints

- **Gun band 1.5-4 kHz is the guns'.** No oscillator (FM modulators included) and no noise filter
  centre goes there. `test-score.mjs` checks every voice in every state × quarter. The registers in
  `QUARTERS` were chosen for this: music-box carriers sit at 260-520 Hz so the ×2.76 modulator stays
  under 1.5 k. Highs above 4 kHz (ticks 7.2 k, anvil ring 6.8 k, shriek 6.4 k) are allowed but kept short.
- **No noise beds.** The user had the ambience and static removed on 2026-09-16. Every noise voice is
  under 2 s (tested).
- **`noise()` hardcodes Q 0.7**, so a bandpass is about 2 octaves wide.
- **`audio.js` uses CRLF line endings.** Multi-line anchors written with `\n` will not match.
- **The score must never throw out of a frame.** `DSWorld.district` is wrapped, and every missing
  field defaults.

## City sound (CITY.md Phase 12A, 2026-09-16), unchanged by the rewrite

All city sound is on the **effects** bus: engines by vehicle type, action cues, the generator and
Ashworks fire loops, and source-bound incidentals (see CITY.md and city_v2 Section 5). None of it
touches the music bus. `tools/test-audio.mjs` covers it, plus an overrun score under a 70-strong
chasing horde, an 8-shot volley, a hurt, an explosion and three engines staying ≤48 voices without
clipping. Hearing is simulation-only: `game.js` never reads `DSAudio`.

## Traps

- **Intensity must not drain while the situation is unchanged** (the old score's first bug). Tested
  with a held crowd of 45 for 25 s.
- **Do not assume intensity means more voices.** Budget peak simultaneity, not scheduling rate.
- **Pause does not stop the score** (user, 2026-09-17: it used to cut out and restart). While paused the
  director gets no events, so the arrangement keeps playing in its current state through `pauseBus` at
  `PAUSED_MUSIC` (.6); only the effects bus drops to 0 (engines and loops keep running silently).
- `stopVoices()` (hidden tab, end of run, mute, new run) also drops the drone; `droneTo` recreates it.
  Music off calls `droneStop()` every frame, so the drone never holds voices while silent.
- `DSAudio.musicBus` exposes the layer gains plus the drone bus for the tests and the bench. Don't
  route effects through it.
- The **down** bus is for moments that must NOT blend in (user, 2026-09-17). The ring-and-bell was first written for survivor down; the user heard it as a notification and moved it to level-up. Survivor down was then a klaxon, then a short kill-landing slash and body fall, then ("more slushing, more drama") the wet squelches, the splatter, the choir breath and the dread cluster (references: an Among Us kill, a "character fall impact" effect). The full wipe was modelled on a "dramatic synth echo". Keep all of them fixed-pitch and outside the arrangement.
- `cue('boss')` is a separate **effects**-bus stinger, not part of the score.

## Open

- Nobody has heard the rewrite yet. Expect to tune by ear: levels per quarter, the choir `lvl`s
  (bandpass Q 6-8 eats a lot of level, so they are set high), the motif detune drift in the Old Quarter,
  and whether the hospital's monitor beep reads as dread or as a UI sound.
