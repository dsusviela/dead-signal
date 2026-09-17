# Dead Signal

Dead Signal is a survival-horror prototype for 1–4 local players, adapted from Pixel Horde's movement combat and boss encounter. Scavenge a fixed, quarantined city on Day 9 and get yourselves out: fuel the St. Aubin chapel generator to restore the emergency circuit, read the St. Orison records, kill **Patient Furnace** in the Central Quarantine disposal yard to unlock the command payload and the Checkpoint Nine override, prepare Blackglass Radio and send the distress call, then open the south barrier and walk the waiting civilians out. Nobody comes to rescue you.

Waves last 45 seconds and continue across districts, and every third wave a migration streams down a nearby avenue; neither is announced, the squad finds out on the street. The outbreak escalates every 90 seconds. Held interactions (preparing Blackglass, transmitting, opening the barrier) start with one press, advance while a survivor stays in reach and keep their progress if you leave; explore and backtrack in any order, and anything missing is named when you try. Boss difficulty scales with your arrival time and locks when you enter. Balance and boss tuning remain in progress.

## Run locally

```sh
npm run serve
```

Open <http://127.0.0.1:4177/>. No installation or build is required. You can also open `index.html` directly. `?seed=123` repeats the loot distribution; the city geometry stays fixed for every seed.

## Controls

- Keyboard: WASD or arrows walk; **hold Shift to run**; E interacts and equips weapons; F toggles autofire; Q cycles carried weapons and the backup pistol; **T deploys or packs up your turret**; **H uses your medkit**; **R eats a squad ration**; Tab opens the map; Esc pauses. Upgrades (damage, fire rate, speed, health, or stamina) are chosen in Pause, where 1–3 pick inside your upgrade panel. Press Enter during a controller-only run to add a keyboard survivor if a slot is free.
- Gamepad: left stick or D-pad walks; **hold RT/R2 to run**; A previews a controller in the title and joins during a run; Start deploys or pauses; X toggles autofire; Y cycles carried weapons and the backup pistol; **LB / L1 deploys or packs up your turret**; **B / Circle uses your medkit**; **RB / R1 eats a squad ration**; View / Create opens the map. While driving, **RT/R2 is analog gas and LT/L2 brakes, then reverses**; the stick only steers. Pending upgrades show as a badge on the survivor's strip: open Pause, pick that survivor's upgrade entry, move with the stick, D-pad or LB/RB and take it with A. Only that survivor's controller (or a mouse click) can choose it. Prompts, hints and **Pause → Controls** use each survivor's own device labels.

To start with controllers only, press A on each controller at the title, then press Start on the controller that deploys. Ammo pickups apply to the squad; E is used for weapon pickups. A solo survivor carries four weapons and each survivor in co-op carries three, plus a permanent unlimited-ammo backup pistol; if a join would push someone over the co-op limit, the run pauses until that survivor picks which weapon to drop (nothing is destroyed). Q / Y cycles the slots and the pistol, skipping empty slots. Weapon pickups fill empty slots and equip the new gun; when full, they replace the selected carried gun (the last selected one if holding the pistol), as shown in the pickup prompt. Taking a weapon you already carry upgrades it instead: each gun has three fixed attachments in order (for example the AR gains armor-piercing rounds, an extended magazine, then a speed loader), and the strip shows +N. The shotgun and piercing attachments damage several infected in a line. Replaced guns drop for teammates with their quality and loaded rounds intact. Switching preserves magazines, cancels unfinished reloads, and takes a brief equip delay. The pistol remains available when carried weapons run out of ammo.

Cars use **car-relative steering** by default: W / Up accelerates, S / Down brakes then reverses, and A/D / Left/Right steers. On a controller the stick or D-pad steers while RT/R2 accelerates and LT/L2 brakes to a stop and then reverses; holding both brakes to rest. Triggers held while boarding, leaving or closing a menu do nothing until released. Steering reverses naturally while backing up. **Pause → Options → Driving** switches to the original directional controls, where the input chooses a world heading and the car turns toward it (controllers still use the triggers for gas and brake). E / A enters or exits. Passengers can shoot; the driver cannot. Fueled cars spawn with 560–3,920 units of driving range, 40% more than the original tanks; one quarter still spawn dry.

**Pause → Options** also holds the **Music** and **All sound** toggles. Music can be disabled while keeping engine and combat effects; All sound mutes both. Driving and audio preferences survive new expeditions and page reloads. Use the mouse, arrows and Enter, or the controller stick/D-pad and A to change options; Esc / B returns to Pause. M is no longer an audio shortcut.

Stand near a downed teammate for three seconds to revive them. Push into breakable wreckage to direct fire at it. Guns reload automatically from the shared reserve; autofire starts off; F / X enables it when you want to fight. The city is dark: survivors see a cone in the direction they walk, a short radius around them, and whatever stands under a working streetlamp, floodlight or burning wreck. Auto-aim only takes shots at infected you can see; ghosts and carriers glow and are always visible. With autofire on the survivor keeps both arms on the gun as the ready pose. Tab / controller Back, the HUD MAP button, or the minimap opens the full map. The full map stays live during play. Opening CITY MAP from pause keeps the clock paused and closing it returns to pause.

**Grenade launcher, turrets and armor.** The grenade launcher (found in armouries, police stations and the odd street cache) fires shared GREN rounds that arc to the aimed point and burst once, damaging and staggering infected in the blast without ever hurting survivors, vehicles or gates. Each survivor may carry one sentry turret outside their weapon slots; two exist per run, one in the South Blocks police station and one in the Quarantine armoury. T / LB / L1 deploys it after 0.8 s standing still and packs it up again beside it; E / A beside any turret loads it one bullet at a time from the squad reserve. Turrets fire 12-damage rounds at the nearest visible infected within range, make noise, and break when infected wear them down. Armor vests (6–9 per run) add 25 armor up to 50; armor absorbs damage before health, a hit that breaks it carries the rest to health, it never regenerates, and the strip shows it as a steel-blue plate under the health bar.

Each survivor starts with one medkit and can carry three. Walk over medkits in clinics, house stashes, or the abandoned quarantine pallet at Blackglass to collect them. Each press of H or B / Circle consumes one kit and restores up to 50 HP to that survivor; the strip shows the heal button and kit count. At full health the press says "Health full", without a kit "No medkits", and nothing is consumed; it never eats a ration instead. R / RB eats one shared ration for faster stamina recovery (never healing). Downed survivors cannot use kits; a full inventory leaves pickups on the ground for teammates.

## Stealth, stamina, and upgrades

Street infected roam until they hear a noise, then investigate its last location, search the area for a while, and return to roaming. They do not track a silently moving survivor, but an alert infected that comes within a few steps of one it can see goes for them. Contact remains dangerous, and the committed Patient Furnace encounter retains its combat AI. Running, shots, healing, reloading, equipping weapons, reviving, breaking wreckage, and the active radio emit noise. Walking is nearly quiet: after the first pace, footsteps carry only a few steps. Gunshot ranges vary by weapon; breaking wreckage carries furthest.

The minimap covers 1.4 km centered on your survivor (the living squad's center in co-op). Amber rings show actual noise radius; gray dots roam and red dots investigate/search. Sound affects gameplay even when audio is muted. Future door/window interactions can call `DSGame.makeNoise(state, source, kind, radius)` with a world-space source and hearing radius.

Running moves 60% faster and drains 28 stamina/second from an initial 100. Recovery starts after 1.25 seconds without running at 22/second. After exhaustion, release the run control before sprinting again. Standing still or pushing into a wall consumes no stamina. The stamina upgrade adds 25 capacity and restores 25 stamina.

Each survivor has a personal upgrade bag with one of each of the five upgrades. Each offer samples three distinct choices; only the chosen upgrade leaves the bag. Refill when fewer than three remain or when needed to prevent a pair appearing in three consecutive offers. Identical consecutive offers are avoided when another valid triple exists. Speed is excluded once it reaches its cap. Choices use the seeded game RNG; rendering does not reroll them. Level-ups never open a menu or grow the HUD: a badge appears on each survivor's strip and the choice waits in Pause (keys 1–3 or arrows and Enter for the keyboard survivor, stick / LB/RB and A for a controller, or a mouse click on the badge or card).

## Audio and performance

The original procedural soundtrack uses a sparse minor-key pulse during exploration and a faster industrial pattern during the boss encounter. Each weapon has its own effect; pickups, healing, damage, reloads, revives, level-ups, waves, and the ending have audio cues. Audio starts after interaction, stops during pause, and remembers the Music and All sound preferences from Options. Everything is synthesized locally with Web Audio; no audio downloads are required.

Collision and sight checks use a spatial index, navigation reuses its buffers and only refreshes when needed, and glows and the screen vignette use cached images. Audio shares a noise buffer and caps concurrent voices. Run `npm run bench` for a deterministic one- and four-player CPU simulation benchmark. This excludes rendering and audio and does not measure Mac or Safari frame rates.

## Validation

`npm test` runs the dependency-free simulation, city (fixed geometry, reachability, economy envelopes), campaign, boss, vehicle, medkit, stealth, score and tempo checks. `npm run art:lint:all` fails on sprite errors or warnings over the recorded budget; `npm run bench` and `npm run bench:browser` measure CPU and frame cost. Optional browser checks use a separately installed Playwright package:

```powershell
$env:PLAYWRIGHT_PATH = 'C:/path/to/playwright-core/index.mjs'
npm run test:browser
```

Run the local server first. Browser checks cover the interface, medkit press edges, simulated gamepads, and rendered audio waveforms; physical controllers and couch difficulty still need playtesting. Screenshots are written to `artifacts/`.

## City v2 (2026-09-17)

The city is six districts owned block by block (see the map legend): South Blocks, Old Quarter, Civic Ward, Northline, Ashworks and Central Quarantine. Streets are built from attached frontage with alleys, forecourts and named courtyards; each district has its own facades, roofs, ground materials and litter. Development tools: `node tools/v2-scenes.mjs [--diag]` (district captures, neutral light), `node tools/hud-matrix.mjs` (HUD budget captures), `node tools/v2-frontage.mjs` (frontage coverage), `node tools/v2-voids.mjs` (open filler patches). Plan and evidence: `city_v2.md`.

## Files

- `world.js`: fixed geography, seeded scavenging sites, collision, city and map drawing.
- `game.js`: weapons, ammo, enemies, waves, upgrades, objectives, revival, camera.
- `boss.js`: Patient Furnace, the three-phase fight in the fenced disposal yard.
- `render.js`: actors, loot, combat effects.
- `main.js`: keyboard/gamepad input, interface, fixed-step loop.
- `audio.js`: procedural music, weapon and gameplay effects, mute and audio lifecycle.

This prototype is self-contained and makes no external service requests.
