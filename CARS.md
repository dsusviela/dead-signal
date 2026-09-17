# Driveable cars — working plan and progress log

> **This file is the source of truth for the cars feature.** If a session is
> interrupted, read the Progress log below to see exactly where to resume, then
> continue from the first unchecked item. Update the log as each item lands.

## Progress log

Status key: `[ ]` not started · `[~]` in progress · `[x]` landed, `npm test` green

### Phase 1 — Spawn + data model (no driving)
- [x] `parkedCars(w)` in `world.js`, called from `dress()` after `avenueWrecks(w)`
- [x] Guard the burning pass (`world.js` ~204) so driveables are not repainted burnt
- [x] Guard the static-light pass (`world.js` ~212) for the same reason
- [x] `s.vehicles` built in `game.js create(seed)` from `random(s)` (fuel is seeded)
- [x] `p.vehicle = null` on the player record (`game.js` ~39)
- [x] Amber `driveable` glint in `render.js drawSolid`
- [x] `tools/test-vehicles.mjs` with checks 1–3; wired into `npm test`

### Phase 2 — Enter, exit, drive, collide
- [x] `CAR` constants + `carBlocked` three-probe collider
- [x] `vehicleTick` (steering, throttle, drag, substepped motion, wall hit, ram-through)
- [x] `enterVehicle` / `exitVehicle` / `parkVehicle` / driver promotion
- [x] `nearestVehicle` + the interact priority chain in `playerTick`
- [x] Rider branch in `playerTick` (seating, stamina, driver angle)
- [x] Fuel drain by distance; out-of-fuel coast and park
- [x] Vehicle tether at 900 units
- [x] `vehicleDraw` in `render.js` (snap-to-cardinal + residual rotate, riders)
- [x] Camera cap / chase rate / lookahead in `game.js camera`
- [x] HUD prompt + FUEL/HULL card rows
- [x] Tests 4–8, 12

### Phase 3 — Roadkill, damage, breakdown
- [x] OBB roadkill sweep through `hitEnemy` + knockback + `MASS`
- [x] Integrity → top-speed curve
- [x] Crash damage to chassis and riders
- [x] `enemyTick` rider contact guard; stalled car takes the damage instead
- [x] Breakdown: dead, ejected, parked, permanently un-enterable
- [x] Render-only hood smoke below 35% integrity
- [x] Boss lockout: entry barred, breach ejects riders into the circle
- [x] Tests 9, 10, 11, 15 (plus explicit check 13 / co-op coverage)

### Phase 4 — Noise, headlights, audio
- [x] `NOISE.engine` / `NOISE.crash` + the .34 s engine cadence
- [x] Headlight block in `lights.js collect()`
- [x] Rider skip in `lights.js castShadows`
- [x] `engine` / `crash` cues in `audio.js`
- [x] `car` scene in `tools/shot.mjs`; test 14

### Phase 5 — Art and polish
- [ ] `art/vehicles.js` intact sedan family (owned by the concurrent ART.md agent; render hooks ready)
- [x] Car-body silhouette in `castShadows`
- [x] Looping engine voice in `audio.js`

## Session notes

- 2026-09-16 — Added Pause → Options with saved driving styles, Music and All sound toggles; removed M and the HUD sound button. User chose car-relative steering as the default: W/S accelerates/brakes/reverses, A/D steers; stick/D-pad uses the same axes. Original directional driving remains selectable. Steering requires motion and reverses while backing up. Signed speed is handled by collision, roadkill/knockback, fuel, noise, occupant protection, boarding, camera and audio. Options remains paused, supports mouse/keyboard/controller, and survives restart/reload; tests cover those paths and music-only mute.
- 2026-09-16 — User requested 30–50% longer fuel range; applied **40%** to the full tank (2,800 → 3,920) and seeded nonempty rolls (400–2,800 → 560–3,920). The 25% dry-car rate and distance-based drain are unchanged. Constants live in `CAR.minFuel/maxFuel`; fuel remains isolated from flamethrower ammo.

- 2026-09-16 — Phases 3–4 and non-art Phase 5 implemented. Roadkill runs above 40 u/s (never while stalled), once per enemy per simulation step across motion substeps; ghosts phase through both ways. Contact tests the car body, damages its hull once per enemy cooldown, and ejects on breakdown. Boss entry releases riders before arena placement and restores/nudges car solids afterwards, including a solo car already parked by the interaction, so no survivor spawns inside a chassis.
- 2026-09-16 — Engine pulses every .34 s while occupied and fueled; crashes have a separate 600-unit sound. Paired forward headlights flicker below 35% hull; smoke/embers and chassis shadows are render-only. The continuous engine voice follows speed and stops on parking, dry tank, breakdown, pause, mute, hidden page, or run reset. `tools/test-audio.mjs` checks waveforms and loop cleanup; `tools/test-vehicles-browser.mjs` checks actual keyboard entry/driving/exit, beam positions, pause/resume, and stopped engines, and is wired into `test:browser`.
- 2026-09-16 — Validation: `npm test`, browser/control/audio suites, and the new vehicle browser suite pass. Reviewed `artifacts/cars/scene-car.png` and `scene-night.png` from `node tools/shot.mjs car,night --out artifacts/cars`, with no page errors. The screenshot uses temporary wreck art. `render.js` now automatically selects `vehicles/sedan_h|_v` and two deterministic paint variants for parked/driven cars when the ART.md agent registers them; the parked glint disappears automatically. ART.md, art files, and index.html are left to that agent.
- 2026-09-16 — Three-second damaged/pristine distance comparison includes acceleration: with the approved top-speed curve the ratio is about 1.7, so check 10 accepts 1.6–2.6. The four-second driving/sprint check remains >1.4× as corrected below. Residual sprite rotation now follows the full heading within each cardinal quadrant, keeping the chassis aligned with its collision box.

- 2026-09-16 — Phase 1 landed; `npm test` passes. 32 fixed parked cars; seeded fuel is isolated from obstacle geometry and flamethrower ammo. Clearance rejects reduced the proposed 18% acceptance to 22 cars, so acceptance is 24%. Garage cars sit on adjacent kerbs to preserve cache clear space. The 300 u/s design is 1.79× sprint (168), not 2.9×; the impossible >3× sprint test will instead verify >1.4× over four seconds including acceleration.
- 2026-09-16 — Phase 2 landed; vehicle entry/exit, driver promotion, point-and-go handling, three-probe collision, distance fuel, out-of-fuel parking, squad tether, camera chase/lookahead, rider rendering, and HUD FUEL/HULL rows are implemented. `tools/test-vehicles.mjs` now covers checks 1–8 and 12; all pass under `npm test`.
- 2026-09-16 — Phase 3 partial: integrity speed scaling, crash chassis/rider damage, and permanent breakdown/ejection/parking are implemented. Roadkill OBB sweep, enemy contact guard, hood smoke, and boss eject remain. Phase 4 noise/headlights/audio remains.

_Append dated notes here for anything discovered mid-implementation that the
plan below does not already say._

- 2026-09-16 — Plan approved. Key trap to remember: `tools/test.mjs:23` asserts
  `deepEqual(create(11).obstacles, create(29).obstacles)`, so **no seed-varying
  field may live on a `w.obstacles` entry** — fuel lives on `s.vehicles`.

---


## Context

Dead Signal is a fixed 7200×7200 night city crossed on foot at 105 u/s (168
sprinting). The run structure is deliberately several short expeditions with
backtracking between objectives — the return trips are where the squad
scavenges. Every leg currently costs the same, and the ~120 burnt avenue wrecks
(`world.js avenueWrecks`) are pure scenery.

This adds **parked, driveable cars**: a scarce, consumable traversal resource.
A found car has a random tank, gets the squad across roughly one district,
screams noise the whole way, flattens infected at the cost of its own chassis,
and dies where it runs dry. A shortcut on one leg, never a commute — the fuel
and the accumulating damage are the point.

Confirmed with the user:

- New seeded parked-car spawns, distinct from the burnt wrecks.
- Fast traversal + rolling weapon + headlights, deliberately very loud.
- **Per-car fuel only.** No fuel item, no siphoning, no inventory change.
  `s.ammo.fuel` is flamethrower ammo and is never read or written by car code.
- Roadkill damages the car; damage lowers top speed; near breakdown smoke pours
  from under the hood; at zero the car is dead forever.
- "Looted" just means enterable — no trunk, no container UI.
- Co-op: passengers ride and shoot out the windows. **The driver cannot shoot** —
  that is what makes a passenger seat worth taking.
- Car-relative steering is the default; the original point-and-go style is
  available in Pause → Options. No new inputs; `E` / `A` enters and exits.
- Occupants are safe at speed; a stalled car gets clawed apart, then its people.
- **No cars in the boss fight**: entry is barred once Patient Furnace is active,
  and breaching ejects every rider into the arena circle.

---

## Design

### Data model — the split that keeps the tests green

`tools/test.mjs:23` asserts `deepEqual(create(11).obstacles, create(29).obstacles)`:
world geometry must stay byte-identical across seeds. So **no seed-varying field
may live on a `w.obstacles` entry.** Split it exactly the way `world.sites → s.loot`
already is at `game.js:31`:

- **`world.js`** places the parked footprint as an ordinary obstacle using the
  existing `solid()`, with geometry-RNG placement only:
  `{…, type:'car', kind:'car', hp:200, art:'wrecks/car_h'|'_v', driveable:true, carId:'drive-N'}`
- **`game.js create(seed)`** builds `s.vehicles` from those, rolling fuel with
  `random(s)` — the same per-seed RNG the loot uses.

```js
// s.vehicles[i] — the live car. Invariants, worth a comment in the source:
//   v.parked === (v.obstacle !== null)
//   v.parked  ⇒  v.driver === null && v.riders.length === 0
//   s.ammo.fuel is FLAMETHROWER ammo. No vehicle code ever touches it.
{ id, carId, obstacle,           // null while driven
  x, y,                          // centre — obstacles are top-left, vehicles are not
  angle, speed,                  // radians, signed u/s; negative means reverse
  fuel, maxFuel:3920,            // measured in WORLD UNITS TRAVELLED, not seconds
  integrity, maxIntegrity:100,
  driver:null, riders:[],        // player ids
  parked:true, dead:false,
  engineCd:0, crashCd:0, hitIds:new Set() }
```

Players get `p.vehicle = null` in the field list at `game.js:39`.

**A moving car can never be in `w.obstacles`** — the WeakMap obstacle index
(`world.js:273`) and the BFS nav field (`game.js:239`) both cache on static
geometry. A car is *either* an obstacle (parked) *or* an `s.vehicles` actor
(driven). Entering does `removeObstacle` + `s.navVersion++`; exiting pushes it
back + `s.navVersion++` — the identical pattern to clearing a shot wreck at
`game.js:134`, so it costs one index rebuild per enter and one per exit.

**Fuel as distance, not time.** `v.fuel -= distanceMovedThisStep`. A full 3920-unit
tank is about one district crossing, the drain is framerate-independent, and the
test is a one-line equality instead of an integration. Seeded roll: **25% arrive
dry** (scenery with a cruel prompt), otherwise `560 + random(s)*3360`.

### Spawn — `parkedCars(w)` in `world.js`

Called from `dress()` immediately after `avenueWrecks(w)`: late enough that
`rectClear` already knows the wrecks and set pieces, early enough that lamps and
hydrants route around the cars.

- Kerb slots offset half a period from the wreck slots — `avenueWrecks` walks `z`
  from −3000 in steps of 400, so `parkedCars` walks the midpoints from −2800,
  reusing the same `a ± s*55 − 24` kerb offset (`world.js:137`) and the same
  guards (skip `|a|<620 && |z|<620`, skip the `a===0` barricade bands, go through
  `rectClear(w,x,y,ww,hh,14)`).
- Accept at `mix(a+91,z) < .18` → **~28–32 cars** against ~120 wrecks, rare enough
  to feel like a find. Use `mix()`, never `hash()` — `hash()` collapses on
  grid-aligned inputs, a known trap in this repo.
- Force one at each `garage-cache` site (`2800,600`, `2500,2800`) and one on the
  checkpoint approach near `(150,2560)` so the first car is findable early.
- Cars sit at the kerb exactly like the wrecks, so the opposite lane stays open.

**Two `dress()` passes must be guarded** or driveable cars get repainted as
wrecks:

- `world.js:224` burning roll matches `o.type==='car' && o.kind` → add `|| o.driveable` to the skip.
- `world.js:232` static-light pass picks up `o.burning` — the same guard covers it.

**Visual tell.** `wrecks/car_h` is a wreck; nothing distinguishes a driveable at a
glance. Ship with a render-only amber glint in `drawSolid` (`ART.glow(g, cx, cy-4, 22, '#ffd249', '30')`)
plus the prompt at range, and commission real intact art in Phase 5.

### Driving — `vehicleTick(s,v,input,dt)` in `game.js`

```js
CAR = { accel:190, brake:340, drag:26, topSpeed:300, turn:2.6, turnFalloff:1.6,
        half:34, probe:22, probes:[-34,0,34] }
```

Point-and-go: the input vector is a **desired world heading**, identical to
walking, so the control language does not change and the stick needs no
relearning.

**Updated default: car-relative.** Up accelerates along the hood; Down brakes
through zero then reverses at up to 45% of forward top speed. Left/Right steers
relative to the car; steering scales up with movement and reverses when backing
up. Pause → Options selects either style. The point-and-go rules below remain
the directional alternative. Collision/damage/noise thresholds use absolute
speed; movement and knockback preserve its sign.

- `want = atan2(dy,dx)`; `turnRate = CAR.turn − CAR.turnFalloff*(speed/topNow)` —
  you cannot pivot at speed; `angle` steps toward `want` by at most `turnRate*dt`.
- `|diff| < 1.2` accelerates, `|diff| > 2.2` brakes hard, no input coasts on drag.
- **Top speed from integrity** — the user's damage→slowdown curve:
  `topNow = 300 * (0.42 + 0.58 * integrity/maxIntegrity)`. Pristine ≈ 300 u/s
  (1.79× sprint); at 10% integrity ≈ 143, slower than sprinting. The car stops
  being *worth* the noise before it stops working.
- **Tunnelling is not a risk** — 300 u/s at the fixed 1/60 step is 5 units, far
  inside a 22-unit probe. Still substep at `n = ceil(dist/6)` (1 at cruise, ≤2 at
  top speed) for clean wall sliding and accurate roadkill sampling.
- **Collider:** `blocked()` is square-vs-AABB with no OBB test, so model the car as
  **three probe circles** (r=22) at offsets −34/0/+34 along the heading. Rotates
  correctly, reuses `blocked` verbatim, needs no new `world.js` export. Apply
  axis-separated like `world.js:295 move` so the car slides along walls.
- **Wall hit** (both axes blocked): above 120 u/s and off `crashCd`, chassis takes
  `speed/9`, each rider takes `hurt(s,p, speed>200?8:3)`, `makeNoise(s,v,'break')`,
  `emit(s,'crash')`, `crashCd=.35`. Then `speed *= .22` — stop, never bounce
  (bouncing on axis-separated motion jitters).
- **Ram-through:** if the blocking obstacle has `hp>0`, subtract `speed*.35`; on 0,
  `removeObstacle` + `navVersion++` + `makeNoise('break')` — the same three lines
  as `game.js:134`. Driving through a pile-up at 250 is the reward for the noise.
- **Out of fuel:** throttle forced to 0, coast to a stop, `announce('OUT OF FUEL')`,
  park once `speed<4`.
- **Squad tether.** Riders skip the 420-unit tether at `game.js:218`, so a lone
  driver would strand the walking teammate and blow out the camera. Apply the same
  test to the *vehicle* at a raised **900-unit** radius: throttle `*= .15` when
  accelerating away from the living-squad centroid beyond it. Solo is unaffected
  (`others.length === 0`).

### Enter / exit

`nearestInteract` (`game.js:206`) is unchanged; add `nearestVehicle(s,p)` beside
it (60 u from the car's OBB; rejects `v.dead`; boarding a moving car needs
`speed < 60` and a free seat). In `playerTick`:

```js
if(input.interact){
  if(p.vehicle != null)        exitVehicle(s,p);
  else if(p.nearItem != null)  collect(...)          // weapon loot still wins
  else if(p.nearVehicle != null) enterVehicle(s,v,p);
}
```

**Weapon pickup keeps priority** — it already owns the prompt and is the rarer
find, so no existing behaviour or test changes. `main.js:80` clears `interact`
after every step and the `else if` chain means one press can never both enter and
exit. `main.js` is untouched.

- **Enter:** if parked, `removeObstacle` + `navVersion++`, seed `v.x/v.y` from the
  obstacle centre and `v.angle` from its orientation. First in is the driver, the
  rest are riders (cap 4).
- **Riding:** `p.x/p.y` are **slaved every step** to a seat offset rotated by
  `v.angle` — driver `(−8,−11)`, then `(−8,+11)`, `(+18,−11)`, `(+18,+11)`. Because
  the rider is a normal player at a real position, lighting, `seen()`, `senses()`,
  `hurt`, the camera bbox and the minimap all keep working with **zero changes**.
  Riding also regenerates stamina.
- **Exit never lands in a wall:** try car-local `(0,±40) (±58,0) (0,±56) (±70,±40)`,
  then a 12-point ring at r=68, each rotated by `v.angle` and accepted on
  `!blocked(w,x,y,p.r)`. Final fallback is the car centre — guaranteed clear of
  everything except whatever boxed the car in, and `move()` pushes them out next
  input. A short `p.exitCd` prevents instant re-entry.
- **If the driver leaves with riders aboard, promote `riders[0]`** — two lines,
  avoids a dead car full of passengers.
- **`parkVehicle`** snaps the footprint axis-aligned: `vertical = |sin| > |cos|`,
  box `48×96` or `96×48`, art `wrecks/car_v|_h`, `rectClear` with ±12/±24 nudges.
  If nothing fits (parked across a lamp post) leave it non-solid but still
  enterable — rare and harmless; say so in the comment.
- **Breakdown** (`integrity<=0`): `v.dead=true`, coast to a stop, force-exit
  everyone, park. A dead car is a normal wreck again — solid, shootable,
  permanently un-enterable.

### Shooting, roadkill, occupants

- The rider branch in `playerTick` sits after the dead-check and before the
  movement block: seat the player, clear `wallTarget/moving/running`, then
  **driver** gets `p.angle = p.moveAngle = v.angle` (hands on the wheel — and this
  alone swings their existing vision cone down the road via `lights.js heading()`),
  **passengers** run `aim(s,p); fire(s,p,dt)` completely unchanged. Line of sight
  is clear in all directions because the car is not in `w.obstacles` while driven.
- **Roadkill:** per substep, cheap-reject enemies outside ±70, then project into
  car-local and test `|lx| > 48+e.r || |ly| > 24+e.r`. A per-vehicle `hitIds` set
  cleared each *step* (not substep) means one body is struck once per frame.
  Requires actual movement and speed above 40 u/s; a stalled car cannot farm kills.
  - Damage dealt `14 + 0.42*speed` routed through **`hitEnemy(s,e,dmg,v)`** so
    blood, XP, kill counting and `investigate` all fire exactly as for bullets. At
    300 that one-shots walkers/runners; a brute takes two passes.
  - Damage taken `MASS[e.type] * (0.25 + speed/300)` with
    `{walker:3.2, runner:2.4, band:2.0, carrier:5, brute:14}` — a car survives
    ~25–28 walkers or ~6 brutes. Knockback by shoving the body along the heading
    with 4 × `W().move` (the `game.js:56` pattern).
  - **Ghosts phase through** — skipped in both directions, consistent with how the
    rest of the sim already treats them.
- **Occupants:** `enemyTick` (`game.js:328`) hurts anyone within `e.r+q.r+2`, which
  would claw riders through the doors. Guard it: **skip the hurt when the target is
  riding and the car is above 40 u/s.** Below that, contact damage goes into
  `v.integrity` instead — a stalled car is torn apart and then dumps its occupants
  into the horde, where they are hurt normally. That is the punishment for running
  dry in a bad place, and it is one condition plus a target swap.
- **Smoke is render-only.** The sim exposes only `v.integrity`; `render.js` emits
  puffs below 35% by reusing the three-puff loop in `fire()` (`render.js:151`)
  anchored at the bonnet, with an ember glow below 15%. Zero `s.fx` pressure (that
  list is capped at 100 and shared with damage numbers) and zero test surface.

### Noise, headlights, camera, HUD

- **Noise.** `NOISE.engine = 520`, `NOISE.crash = 600` at `game.js:5`. Every .34 s:
  `makeNoise(s, v, 'engine', 240 + 320*(speed/300))` — 240 idling, 560 at speed,
  the second-loudest thing in the game after breaking wreckage. `makeNoise` reads
  `source.x/y/id`, all of which a vehicle has. Life is 1.4 s so ~4 pulses are live
  at once, well inside the 96 cap, and the `n.id > e.heardNoise` gate at
  `game.js:296` makes each infected react once per pulse — pulling the whole
  neighbourhood onto the road, which is the intended cost of driving.
- **Headlights** — one block in `lights.js collect()` after the muzzle-flash loop
  (`lights.js:45`): two `addLight(…, 170, '#ffe9bd', .95)` per car, at the front
  corners but with their **centres thrown ~70 units ahead of the lamps**. That is
  what makes two radial gradients read as a forward beam with no new cone
  machinery, and it feeds the rest of the system free — `seen()` lights infected
  caught in the beam and `castShadows` throws their silhouettes backwards. Flicker
  the near lamp below 35% integrity. Note `litAt` (`game.js:92`) reads only static
  `s.world.lights`, so headlights do not silently change `canSee` — the same
  asymmetry muzzle flashes already have.
- **`lights.js castShadows` (line 159) must skip riders**, or they throw walking
  silhouettes from inside the car. Car-body shadow casting is a Phase 5 polish
  item, not a requirement.
- **Camera** (`game.js:368`), three edits in the non-boss branch: cap
  `max(1450,720*aspect)` → `max(2150,1040*aspect)` while anyone is driving, follow
  rate `dt*4` → `dt*7` (at `dt*4` the ~0.25 s time constant leaves a 300 u/s car 75
  units behind centre with no road ahead), and a **lookahead bias** of
  `+cos(angle)*min(140, speed*.5)`. Keep the size lerp at `dt*3` so the zoom-out is
  a swell, not a snap. Side effect, and it is the right one: `waveTick` spawns at
  `max(camera.w*.65, 440)` (`game.js:339`), so a wider camera pushes spawns further
  out — you outrun the horde.
- **HUD** (`hud.js`): a vehicle clause in `promptText` **after** the weapon clause,
  mirroring the sim's priority — `[ E ] DRIVE` with sub `Fuel 62% · loud · runs the
  infected down`, or `[ E ] LEAVE THE CAR` with `P1 · Driver · the engine is loud`.
  In each rider's player card, swap the STAMINA row (hud.js:147) for two `bar()`
  calls: **FUEL** (`COL.orange`) and **HULL**, turning red and reading
  `HULL · SMOKING` below 35% so the on-screen smoke has a HUD confirmation. The
  SUPPLIES row's FUEL counter (flamethrower) is untouched — distinct labels.
- **Audio** (`audio.js cue`): `engine` as a short filtered sawtooth burst whose
  frequency and level scale with the speed fraction passed as `detail`; `crash` as
  `noise(.3,.34,900)` + a low sawtooth. The 0.12 s cue cooldown passes the 0.34 s
  cadence. A true looping engine voice needs a persistent oscillator outside the
  one-shot `cue` design — Phase 5.

### Rendering a car at an arbitrary heading

`wrecks/car_h` is 96×58 — 48 of box plus a 10-row roof overhang and a dark
ground-contact band. Free rotation spins the overhang and the shadow and looks
broken at 90° and 180°.

**Snap to 4 cardinals plus a small residual rotate.** Pick the sprite the way
`facing()` (`render.js:15`) picks actor frames — `|sin| > |cos|` → `car_v` (flipY
when heading south), else `car_h` (flip when heading east; corrected 2026-09-16: vehicle art is drawn nose-first at low x / low y) — then apply
`rotate: wrap(angle − cardinal)` clamped to ±0.39 rad. The overhang stays upright,
cornering reads as a lean, and there is no new art. Same
`{anchorX:.5, anchorY:.5, rotate}` path `drawSolid` already uses at `render.js:111`.

In `worldPass` (`render.js:179`), one `push(v.y+26, () => vehicleDraw(g,v,s))` per
driven car — sorting on the car's bottom edge keeps it correct against wrecks,
props and infected. `vehicleDraw` does shadow → car → **riders on top** (torso-only
`survivor()` calls at their seat offsets, so the car can never sort between a
passenger and their own seat) → smoke. Exclude riders from the normal player loop
at `render.js:191`. Parked cars need nothing new beyond the amber glint —
`drawSolid` already handles `type:'car'` obstacles with an `art`.

### Boss lockout

`nearestVehicle` refuses while `s.boss && s.boss.active`. In `objectives()`
(`game.js:366`), immediately before `DSBoss.start` and next to the existing
`s.enemies=[]`, force-exit every rider and clamp each to radius ≤300 along their
bearing from the origin. Breaching already requires all living survivors within
350, so this is a nudge, not a long teleport.

---

## Files touched

| File | Change |
|---|---|
| `world.js` | `parkedCars()` in `dress()`, the two burning/light-pass guards |
| `game.js` | `s.vehicles` in `create`, `p.vehicle`, `CAR`, `carBlocked`, `vehicleTick`, `enterVehicle`/`exitVehicle`/`parkVehicle`, `nearestVehicle`, rider branch in `playerTick`, roadkill, `NOISE.engine/crash`, vehicle tether, `enemyTick` rider guard, camera, boss eject |
| `render.js` | `vehicleDraw` (snap + residual rotate, riders, smoke), rider exclusion, driveable glint, automatic intact-sedan selection |
| `boss.js` | Optional car-ejection callback before arena placement, restore solids afterwards |
| `lights.js` | headlight block in `collect()`, rider skip in `castShadows` |
| `hud.js` | drive/exit prompt, FUEL + HULL card rows |
| `audio.js` | `engine`, `crash` cues |
| `tools/test-vehicles.mjs` (new) | the checks below; add to `npm test` |
| `art/vehicles.js` (new, Phase 5) | intact car family |

Reuse rather than reinvent: `rectClear`, `solid`, `mix`, `move`/`blocked`
(world.js); `removeObstacle` + `navVersion++`, `hitEnemy`, `makeNoise`, `effect`,
`emit`, `announce`, the 8-way substep from `hurt` (game.js); `facing`, `ART.draw
({rotate})`, `ART.glow`, the smoke loop in `fire()` (render.js); `addLight`,
`heading` (lights.js); `panel`, `bar`, `text` (hud.js).

---

## Phases

Each phase ends green on `npm test`.

1. **Spawn + data model, no driving.** `parkedCars` and the two `dress()` guards;
   `s.vehicles` from `random(s)`; `p.vehicle:null`; the amber glint. Nothing
   behaves differently — the city just has ~32 intact-looking cars, and
   `test.mjs:23` proves the geometry invariant held.
2. **Enter, exit, drive, collide.** `CAR`, `carBlocked`, `vehicleTick`,
   enter/exit/park, the rider branch, `nearestVehicle`, fuel drain, the vehicle
   tether, `vehicleDraw`, prompt + card rows, camera. The big one — after it the
   feature is playable.
3. **Roadkill, damage, breakdown.** OBB sweep + `hitEnemy` + knockback + `MASS`,
   the integrity speed curve, crash and ram-through, the `enemyTick` rider guard,
   stalled-car rules, boss eject, smoke.
4. **Noise, headlights, audio.** `NOISE.engine/crash`, the cadence, the headlight
   block, the `castShadows` rider skip, the cues. Verify with a new `car` scene in
   `tools/shot.mjs`.
5. **Art and polish.** A real `vehicles/sedan_h|_v` family (intact glass, closed
   doors, headlight lenses) drawn by sprite subagents and reviewed as a sheet per
   the project's art workflow, so a driveable reads without the glint hack; car
   silhouette in `castShadows`; a looping engine voice.

> **Superseded (2026-09-16):** the no-fuel-item/no-refuelling scope below was the
> original car change set. CITY.md Phases 6 and 10 now own vehicle fuel, refuelling,
> the fire truck and the bulldozer.

**Deliberately out of scope**, so it does not creep in: no fuel item, no
siphoning, no trunk, no search UI, no inventory change — and nothing touches
`p.weaponInventory` / `cycleWeapon` (the broken stubs at `game.js:39/165/207`).
That is a separate cleanup; leaving it alone keeps this change set reviewable.

---

## Verification

New `tools/test-vehicles.mjs` in the `await import` style of `test-stealth.mjs`
(world/boss/game only — never render/lights/art; all sim code above is DOM-free
by construction). Add it to the `test` script in `package.json`.

1. **Geometry invariant** — `create(11).obstacles` deepEqual `create(29).obstacles`
   (free regression guard), `driveable` count in `[28,40]` and equal across seeds.
2. **No overlap** — no driveable's AABB intersects another obstacle.
3. **Fuel is seeded and isolated** — `create(3).vehicles.map(v=>v.fuel)` differs
   from `create(9)`'s; drive 5 s and assert `s.ammo.fuel` is unchanged.
4. **Enter/exit round trip** — `p.vehicle` set, obstacle gone, `navVersion` bumped;
   on exit restored and `!blocked(w,p.x,p.y,p.r)`.
5. **Exit never lands in a wall** — 24 headings beside a building, all clear.
6. **Weapon pickup still wins** — a weapon 20 u away plus a car adjacent; one
   `interact` takes the weapon and leaves `p.vehicle === null`.
7. **Driving beats walking** — 4 s of `{y:-1}` driving covers >1.4× 4 s of sprinting
   on the clear `x=0` avenue.
8. **Fuel drain** — `maxFuel − fuel` equals distance travelled within epsilon; at 0
   the car halts, and is solid again once the driver leaves.
9. **Roadkill** — six walkers on the lane die, `s.kills>=5`, `integrity` dropped.
10. **Integrity slows it** — 3 s at `integrity=100` vs `12`, distance ratio 1.6–2.6.
11. **Breakdown is permanent** — forced to 0: `dead`, riders ejected, parked, and a
    later `interact` does not set `p.vehicle`.
12. **Ends outside geometry** — full throttle into a wall for 3 s; both end probes
    unblocked every step, final `speed < 40`.
13. **Co-op** — passenger stays within 40 u of the car, their `fire` consumes
    `s.ammo.bullets`, and the driver's `p.mag` never changes.
14. **Engine noise** — after 1 s driving, a noise with `kind==='engine'` and
    `r > NOISE.run`; parked cars emit none.
15. **Boss ejects riders** — enter a car, breach via the plaza `interact` path, all
    `p.vehicle === null` and `hypot(p.x,p.y) < 350`.

Then in the browser (`npm run serve`, <http://127.0.0.1:4177/>): drive from the
checkpoint toward the radio mast and confirm the headlights throw down the road,
the camera leads the car, infected converge on the engine noise, the car slows and
smokes as bodies pile up, and it dies where the tank empties. Stall it in a crowd
and confirm the occupants are safe until it stops, then torn out.
`node tools/shot.mjs car,night` for a lit screenshot (multiply lighting is
invisible to `frame.mjs`).

