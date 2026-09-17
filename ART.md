# Missing art — working TODO and progress log

> **This file is the source of truth for the remaining sprite work.** If a
> session is interrupted — usage limit, `/clear`, crash — read the Progress log
> below, find the first unchecked box, and continue from there. No other context
> is needed. Update a box the moment its family lands.

## How to resume (read this first)

1. `npm run art:lint:all` — tells you what is already defined and clean.
2. Find the first `[ ]` family below. Its brief is in **Family briefs**.
3. Draw it per **Workflow**, tick the boxes, append to **Session notes**.

Registered families as of 2026-09-16: `tiles`, `props`, `wrecks`, `loot`,
`infected`. Everything below is **referenced by code but not defined** — the
`hasArt()` / `ART.spec()` guards mean the game silently falls back to legacy
rects, so nothing is broken, it is just placeholder.

Status key: `[ ]` not started · `[~]` drawing · `[r]` drawn, awaiting review ·
`[x]` landed, lint clean, sheet approved

## Progress log

### Wave 1 — the things you look at every second
- [x] **survivors** (Opus) — landed 2026-09-16, 9 targets / 0 errors
  - [x] `body` frames down/up/side × 4, 32×32, fps 8
  - [x] `bodyIdle` × 2 per facing
  - [x] `downed` 32×20, anchor `{.5,.68}`
  - [x] `wpn_pistol` 20×10
  - [x] `wpn_smg` 26×12
  - [x] `wpn_ar` 34×12
  - [x] `wpn_shotgun` 34×12
  - [x] `wpn_rifle` 40×12
  - [x] `wpn_flame` 36×16, grip anchor `{.18,.5}`
- [x] **buildings** (Sonnet) — landed 2026-09-16, 17 targets / 0 errors
  - [x] `wallH` 32×16 / `wallV` 16×32, 2 variants each (`render.js:128` passes `variant`; walls are 14 thick, see brief)
  - [x] `roofFill` × 3, `roofFillBig` × 3
  - [x] `roofEdge` mask16 (`render.js:173` passes `mask`)
  - [x] `roofVent`, `roofAC`, `roofWater`, `roofSkylight`, `roofAntenna`, `roofStair`
  - [x] `roofBillboard`
  - [x] `furn_bed` 60×36, `furn_table` 48×32, `furn_shelf` 60×16, `furn_crates` 32×28, `furn_counter` 80×22
- [x] **vfx** (Sonnet), anchor `center` — landed 2026-09-16, 14 targets / 0 errors
  - [x] `muzzleS` / `muzzleM` / `muzzleL`, 3f each
  - [x] `impactSpark` 3f
  - [x] `bloodHit` 3f, `bloodDecal` × 3 (anchor `feet`)
  - [x] `fire` 5f 24×32
  - [x] `flameTongue` 5f
  - [x] `smokePuff` 4f, `emberMote` 2f
  - [x] `explosion` 5f
  - [x] `pickupSparkle` 4f, `reviveRing` 4f, `footDust` 3f

### Wave 2 — set pieces and the boss
- [x] **barricade** (Opus) — landed 2026-09-16, 12 targets / 0 errors
  - [x] `sandbagWall` 48×20, `sandbagNest` 56×30 — `sandbagCorner` **skipped, no call site**
  - [x] `jersey` 48×24 — one sprite, not 2 tints: `world.js` never passes a variant
  - [x] `humvee` 84×48, `truckMil` 120×52
  - [x] `floodlight` 40×90 (emits light; see the `dy` note below)
  - [x] `crateMil` 24×24, `tentMil` 64×40 — `fieldRadio` **skipped, no call site**
  - [x] `razorWire` (flat), `bodyBag` (flat), `signQuarantine`
  - [x] `bloodSplat` × 3 (flat decal) — the only variant the code ever asks for
- [x] **landmarks** (Sonnet) — landed 2026-09-16, 12 targets / 0 errors
  - [x] `mastBase` 48×40, `mastSection` × 3, `mastTop`, `beacon` 2f
  - [x] `dish`, `shack` 88×56, `generator` 40×28
  - [x] `gate`, `watchtower` — `gateArm` **skipped, no call site**
  - [x] `hospitalEntrance` — `crossSign` **skipped, no call site**
  - [x] `foundryStack` × 2 variants — `foundryHall` **skipped, no call site**
  - [x] `ruinsCollapse`
- [x] **boss** (Opus) — landed 2026-09-16, 6 targets / 0 errors. **Every legacy den-2 sprite is now gone.**
  - [x] `body` × 3 variants 96×80 (ember / hot / cracked)
  - [x] `core` 24×16 2f × 2 variants
  - [x] `arm` 24×56 `{.5,0}` × 3 variants
  - [x] `maulShaft` 8×52, `maulHead` 40×28 `{.5,.35}` × 3 variants
  - [x] `armRight` 20×48 × 2 variants

### Wave 3 — HUD and the cars
- [x] **hud** (Sonnet), anchor `tile` — `hud.js:38` already looks for `panel9`
  - [x] `panel9` / `panel9Alert` / `panel9Gold` — 24×24, 3×3 cells of 8×8
  - [x] `icon_bullets` / `icon_shells` / `icon_fuel` 12×12 — **note the underscores**
  - ~~`barFrame`, `divider`, `iconHeart`, `iconLevel`, `iconMap`, `iconPause`,
    `keycap`, `badgeTier`, `dotLive`, `cursor`, `upgradePip`, `cardFrame`,
    `bossBarFrame`, `castBarFrame`, `minimapFrame`, `promptFrame`~~ — **all 16 cut:
    zero references in `hud.js`/`render.js`/`game.js` (grepped 2026-09-16). They came
    from the plan table, not the code, and the queued UI declutter will rebuild these
    panels anyway.**
- [x] **vehicles** (Sonnet) — CARS.md Phase 5; replaces the amber-glint hack
  - [x] `sedan_h` 96×58, `sedan_v` **48×106** — intact glass, closed doors, headlight
    lenses. *The plan table said 58×96; it transposed the numbers.* Must match
    `wrecks/car_h` / `car_v` exactly or a car jumps when it breaks down.
  - [x] 2 paint variants each — **these actually render** (`variant: carId % 2`)
  - ~~retire the `driveable` glint in `render.js drawSolid`~~ — **no engine change
    needed**: `drawSolid` returns early inside `if(o.driveable){ if(hasArt(id)){ … } }`
    before it ever reaches the glint.

## UI declutter — requested 2026-09-16, not started

> Screenshot review by the user: "a lot of text, and the boxes at the bottom take up
> too much space." The HUD currently spends most of its area telling the player things
> they learn once and then never need again.

**Ownership: CLEARED 2026-09-16 11:23.** The CARS.md agent has finished — its log is
complete except `art/vehicles.js`, which it explicitly assigned to this file's owner
("owned by the concurrent ART.md agent; render hooks ready"). `hud.js`, `render.js`,
`game.js` and `lights.js` are free. Note it shipped an options menu with a music toggle
(`musicMuted` in `audio.js`), so the **pause menu already exists** — the Controls
submenu below is an addition to it, not a new menu.

### Findings from the audit (do not re-derive these)

- **The objective card is not lore-accurate, and it is a code gap, not a wording bug.**
  `hud.js:89` hardcodes a single permanent objective, `KILL PATIENT FURNACE`, with only
  the sub-line varying (`hud.js:86`). `lore.md:105-133` defines a **four-act chain**:
  Act I restore Blackglass (Northline) · Act II kill Patient Furnace (Central
  Quarantine) · Act III transmit from Blackglass · Act IV escape via Checkpoint Nine.
  So the HUD shows Act II's goal for the whole run, as if it were the game.
  `lore.md:170` already records the root cause: *"boss.js:346 — boss death sets
  s.mode='won'. Under this chain it ends Act II, not the run. **Acts III and IV do not
  exist in code yet.**"* A four-item list with an active light is therefore the right
  design but cannot be fully honest yet — ship it listing all four with III and IV
  visibly pending, or the HUD will promise content that is not there.
- **XP is already shared — no work needed.** `game.js:93` keeps `s.xp` / `s.level` /
  `s.nextXp` on the run, not the player, and a level-up does
  `s.players.forEach(p => p.upgrades++)`. `hud.js:131` draws it exactly once, in the
  shared SUPPLIES strip. The request is already satisfied; do not add a second bar.

### Tasks

- [ ] **Shrink the bottom boxes.** The per-player card carries weapon name, mag count,
      fire mode, medkit count, a stamina bar and an upgrade row. Most of it is static.
      Keep what changes under fire; move the rest out.
- [ ] **Health on the character, not in a box** — the user's call, and the recommended
      one: **damage thresholds drawn into the survivor art** rather than a hovering bar.
      Needs `art/survivors.js` work: a hurt and a badly-hurt state per facing (blood at
      ~66% and ~33%), reusing the `MAT.blood` ramp that `vfx/bloodDecal` already uses.
      A hovering bar is the fallback if the thresholds do not read at 32x32.
- [ ] **Objective list with an active light.** Four acts from `lore.md:105`, red dot on
      the current one, later acts shown as pending. See the finding above before
      writing any copy.
- [ ] **Strip the keybinding legends.** The bottom-left `WASD WALK / SHIFT RUN / ...`
      strip and the bottom-right `CONTROLLER: A JOIN / ...` strip are permanent screen
      furniture teaching something learned in the first ten seconds. Remove both.
- [ ] **Pause → Controls submenu** to hold what the strips used to say. Controller rows
      use the real Xbox glyphs and colours — **A green, B red, X blue, Y yellow**.
      Needs a small `hud` family sprite set (see Wave 3) or drawn glyphs.
      **This is the item that collides with the CARS agent's options menu.**
- [ ] **Audit the remaining prose.** `[ E ] EMPTY TANK / Out of fuel · find another car`
      and similar prompts are two lines where one would do.

## Workflow (per family)

Per [[subagents-draw-main-reviews]]: **subagents draw, the main agent reviews.**

1. Main agent writes the brief (dims, anchors, MAT ramp, frame counts, the
   craft rules that bite) from **Family briefs** below.
2. Subagent authors `art/<family>.js` in the style of the existing
   `art/wrecks.js` (grid helpers → `toRows`) or `art/loot.js`, then:
   - `npm run art:lint -- --family <F>` → **zero errors**, warnings read not silenced
   - `npm run art:sheet -- <F> --out <scratch>/<F>.png`
   - `npm run art:frame -- <scratch>/<F>-frame.png --scene <S>`
   - reads its own PNGs beside the printed rows, fixes, reports paths
3. Main agent reads sheet + frame, gives notes, resumes the **same** subagent
   for one or two revisions.
4. Main agent sends **one sheet per family** to the user, then lands it:
   add `<script src="art/<family>.js"></script>` to `index.html:23` and run
   `npm test` + `npm run art:lint:all`.

Craft rules live in `C:\Users\daniel\.claude\skills\pixel-art\rules.md` — every
subagent reads it before drawing. Dead Signal is **den 1** (one texel = one
world unit), not pixel-horde's den 2; the skill's `land.mjs` / `playground.html`
steps do **not** apply here — families are plain `DSArt.define(...)` modules.

## Traps

- **`npm run art:lint:all` is a zero-error gate plus a warning budget** (CITY.md Phase 13).
  It no longer passes `--strict`; it fails on any error or when a sprite has more warnings
  than `tools/fixtures/art-warn-budget.json` records (904 on 276 targets, 2026-09-16).
  Warning counts are not a design target: after an intended redraw, re-record with
  `node tools/art/lint.mjs --family all --quiet --budget tools/fixtures/art-warn-budget.json --write-budget`.
  `npm run art:lint:strict` keeps the old all-warnings view.

- **`hash()` collapses on grid-aligned inputs** (`world.js`) — everything comes
  out < .5. Placement rolls use `mix()`. Art variant picks in `render.js` use
  `hash()` already; do not add new ones.
- **Lighting is multiply + additive + cone bite + sprite-silhouette shadows** (rebuilt 2026-09-16, see `LIGHTING.md`), and `tools/frame.mjs` cannot see any of it. Any
  glow / light-emitting sprite is verified with `node tools/shot.mjs <scene>,night`.
- **`tools/test.mjs:23`** asserts `deepEqual(create(11).obstacles, create(29).obstacles)`.
  Art is render-only and cannot break this, but do not "helpfully" touch
  `world.js` placement while landing a family.
- **Another agent is implementing `CARS.md` right now.** Do not edit `game.js`,
  `render.js`, `world.js`, `lights.js` or `hud.js` beyond the single
  `index.html` script tag per family. Art families activate themselves through
  the existing `hasArt()` / `ART.spec()` guards — no render hookup needed.
- Palette letters are `K` outline / `D` dark / `M` mid / `L` light / `H` highlight
  plus accents; ramps are in `art.js MAT`. New ramps come from
  `npm run art:ramp`, never hand-picked hexes.

## Family briefs

_Filled in by the main agent as each family starts, so a resumed session does
not have to re-derive the brief. See the plan file
`C:\Users\daniel\.claude\plans\i-need-an-entire-glittery-frost.md`
("Art family specs") for the original table._

### survivors — call sites `render.js:37-68`

Palette: `pal:'survivor'` (the `NAMED.survivor` tint function in `art.js`) so the
player colour lands on letter **C**. `K` outline, `D` dark, `M` mid, `L`/`H` skin
and highlight, **C = the player tint — use it only on the jacket/armband**, it is
the single thing that tells four survivors apart on one screen.

- `body` — `frames:{down:[4],up:[4],side:[4]}`, `fps:8`, 32×32, anchor `feet`
  (default). Drawn at the player's feet. `side` is drawn **facing right**;
  `render.js` mirrors it with `flip` when aiming left. `up` is the back of the
  head — no face. Walk cycle order is contact / pass / contact / pass with the
  two contacts *different* (opposite leg), because `render.js:57` runs
  `frame = floor(time*8) & 3` straight through.
- `bodyIdle` — same three facings, **2 frames each**, breathing only (1-texel
  chest/shoulder lift). `render.js:57` drives it at `floor(time*3) & 1`.
- `downed` — 32×20, anchor `{x:.5,y:.68}`, drawn at `p.y+4`. A body sprawled
  toward the camera, tint still visible (the revive ring is drawn over it).
- Weapons — all drawn **horizontal, muzzle pointing +x (right)**, anchor `feet`
  is wrong here: use anchor `{x:.4,y:.5}`. `render.js:26` overrides `anchorX` to
  `.18` while firing and `.4` at rest, and sets `flipY` when aiming left, so the
  sprite must read correctly mirrored top-to-bottom. Grip/trigger sits at about
  x=.18 of the width. Sizes: `wpn_pistol` 20×10, `wpn_smg` 26×12, `wpn_ar` 34×12,
  `wpn_shotgun` 34×12, `wpn_rifle` 40×12, `wpn_flame` 36×16.
  `pal:'MAT.iron'` for all but `wpn_flame`, which uses `MAT.rust` + an ember
  pilot light at the nozzle. Muzzle tip must be at the sprite's right edge:
  `render.js:28` puts the flash at `sp.w*.8` along the aim.

### buildings — call sites `render.js:125-189`, `world.js:80-87`

- `wallH` **32×16**, `wallV` **16×32**, 2 variants each, anchor `tile` (0,0).
  *Deviation from the original 32×48 spec, and it matters:* every wall in the
  game is a house wall and `world.js:72` sets `wallT = 14`, so `render.js:127`
  clips the sprite to a **14-texel-thick band**. A 48-tall sprite would throw 34
  rows away. `wallH` tiles along x at a 32 step (one row only, at `o.y`);
  `wallV` tiles down y at a 32 step, clipped to the leftmost 14 columns. Both
  must tile seamlessly at that 32 step. Read it as a top-down wall cap: `K`
  outline on both long edges, `H` weathering along the outer edge, `M`/`D`
  render the roofline thickness. Variants are grime/cracks only — the silhouette
  and the tiling edges must be identical between them.
- `roofFill` 32×32 × 3 variants, `roofFillBig` 32×32 × 3 variants, anchor `tile`.
  `roofFill` is the small-house roof (tar paper, `MAT.asphalt`), `roofFillBig` is
  the block roof (gravel/concrete, `MAT.concrete`). Both tile in **both** axes at
  32 and every variant must tile against every other variant — `render.js:151`
  and `:180` pick per cell by `hash(x,y)`. Keep contrast low: the roof is a
  background, the props on it are the reading.
- `roofEdge` `mask:[16 × 32×32]`, anchor `tile`. Bit N|E|S|W = 1|2|4|8; index 0
  is never drawn, so it can be empty. Each set bit puts a parapet lip on that
  side — `K` outer line, `H` top cap, `D` inner shadow falling **into** the roof.
  Corners (3, 6, 12, 9) must mitre cleanly.
- Roof props, all anchor `feet`, `render.js:187` scatters 3-5 of them:
  `roofVent` 16×14, `roofAC` 28×20, `roofWater` 24×34 (tank on legs),
  `roofSkylight` 26×18 (flat glass, `MAT.glass`), `roofAntenna` 14×30,
  `roofStair` 30×26 (stairwell head-house). `MAT.iron` / `MAT.concrete`.
- `roofBillboard` 64×48 anchor `feet`, drawn at the roof's bottom-right corner.
  Frame + a faded advert face; no legible lettering at this size, suggest type
  with 1-texel bars.
- Furniture, anchor `feet`, drawn at the rect's bottom-centre by
  `render.js:195`. Exact rects from `world.js:83-87`: `furn_bed` 60×36,
  `furn_table` 48×32, `furn_shelf` 60×16, `furn_crates` 32×28, `furn_counter`
  80×22. **`furn_shelf` is also placed as a 16×60 rect** (`world.js:83`, the `w`
  and `e` cases) and `render.js:195` does **not** rotate it — draw the 60×16
  horizontal sprite and accept that the vertical placement overhangs; do not try
  to solve it in art. Top-down interior view, `MAT.wood` for bed/table/shelf/
  counter, `MAT.wood` + `MAT.iron` banding for crates.

### vfx — call sites `render.js:19,160,233,235,247,250`, `game.js:96,346`

Anchor `center` for everything except `bloodDecal` (anchor `feet`).

**Referenced by code today — these are the ones that change the game:**
- `muzzleS` / `muzzleM` / `muzzleL`, 3 frames each, `pal:'MAT.ember'`.
  `render.js:19` rotates by the aim angle, so the flash points **+x (right)** and
  the origin (centre anchor) sits at the barrel tip. S ≈ 14×10, M ≈ 20×14,
  L ≈ 26×18. Frame 0 is the brightest/widest, 2 is the dying wisp — it is driven
  by `floor(time*30)%3`, not by shot age, so all three frames must read as "a gun
  just fired" rather than as a sequence.
- `impactSpark` 3f, ~12×12, `MAT.ember`. `render.js:235` indexes it by shot age,
  so this one *is* a sequence: burst → spray → fading motes.
- `bloodHit` 3f ~16×16 and `bloodDecal` 3 **variants** ~20×12 anchor `feet`,
  `pal:'MAT.blood'`. The decal is drawn at 0.85 alpha under everything and
  persists (up to 240 on screen) — keep it dark, flat, no highlight, or the
  street turns into a rash.
- `fire` 5f 24×32, `MAT.ember`. `render.js:160` draws it at the wreck centre +6
  and runs `floor(time*12)%5`, so the loop must close frame 4 → frame 0.
- `flameTongue` 5f ~18×14, `MAT.ember`. `render.js:233` stamps five of them
  along the aim at increasing scale with `rotate`, so it points **+x** and must
  tile against itself — no hard cap at either end.
- `reviveRing` 4f, ~48×24 (a flat ellipse on the ground), `pal:'MAT.loot'` with
  the `C` cyan. `game.js:346` plays it once over 0.5 s: expand and fade.

**Listed in the plan but not referenced by any call site yet** — draw them last,
smaller effort, they cost nothing while unused: `smokePuff` 4f, `emberMote` 2f,
`explosion` 5f, `pickupSparkle` 4f, `footDust` 3f.

### barricade — call sites `world.js:97-110` (avenue), `:194` (checkpoint), `:198` (radio)

A failed military containment line, abandoned in a hurry and then overrun — not a tidy
checkpoint. Ramps: `MAT.sandbag`, `MAT.olive`, `MAT.iron`, `MAT.rust`, `MAT.blood`,
`MAT.concrete`.

**Solids**, anchor `feet`, drawn with their feet on the rect's bottom edge:
`jersey` 48×24 (hp 240) · `sandbagNest` 56×30 (hp 400) · `sandbagWall` 48×20 (hp 400,
checkpoint + radio only, never rotated) · `humvee` 84×48 · `truckMil` 120×52 ·
`crateMil` 24×24 (hp 120) · `tentMil` 64×40.

**Rotation:** `jersey`, `sandbagNest`, `humvee` and `tentMil` are placed with `rot:1` on a
horizontal barricade, which makes `drawSolid` draw them **centred and rotated −90°**
rather than on their feet. Author them horizontal at the sizes above, keep the mass
centred, and put no detail that only reads standing up.

**Props**, drawn at exactly `p.x,p.y`:
`floodlight` ~40×90 anchor `feet`, `light{r:140,#ffd249,ff}` · `signQuarantine` ~28×36
anchor `feet` · `razorWire` ~48×16 **anchor `center`**, `flat`, rotated 0/−90° ·
`bodyBag` ~40×18 **anchor `center`**, `flat`, rotated 0/−90° · `bloodSplat` ~28×20
**anchor `center`**, `flat`, **3 variants** (`world.js:110` passes `variant:d%3`).

Traps:
- **`variant` is non-zero only on `bloodSplat`.** Every other placement leaves it 0, so a
  second variant anywhere else can never render. The original plan's "jersey × 2 tints"
  and "crateMil × 2" are dead weight — do not draw them.
- **The flat decals are drawn under everything at ground level and there are a lot of
  them** (4 blood splats + 3 body bags per barricade). Keep `MAT.blood` in `K`/`D` or the
  road turns into a rash — the same mistake the first `vfx/bloodDecal` pass made.
- **The floodlight's glow will not line up with its head.** `world.js:103` sets no
  `light.dy`, so `drawProp` defaults to 24 and puts the corona near the base of a 90-tall
  mast. Draw the lens emissive so it reads anyway. The fix belongs in `world.js`, which is
  off-limits while the CARS agent owns it.
- Not referenced by any call site, draw last if at all: `sandbagCorner`, `fieldRadio`.

### landmarks — call sites `world.js:213-219,241-243`, `render.js:186-189,226`

The five things you navigate by, read as silhouettes from across a dark grid: radio mast,
checkpoint, hospital, foundry, ruins. Ramps: `MAT.iron`, `MAT.rust`, `MAT.concrete`,
`MAT.brick`, `MAT.glass`.

**THE TRAP — these three ship together or not at all.** `render.js:226` disables the
legacy fallback for *every* distant landmark the moment `hasArt('landmarks/hospitalEntrance')`
is true. Defining `hospitalEntrance` without `foundryStack` and `ruinsCollapse` makes the
foundry and the ruins **vanish from the game**.

**Solids**, anchor `feet`: `mastBase` 48×40 · `shack` 88×56 · `generator` 40×28
(`light{r:30,#ffd249,18}`).

**Props**, anchor `feet`, drawn at `p.x,p.y`: `gate` ~120×44 · `watchtower` ~44×96
(`light{r:110,#ffd249,cc}`) · `dish` ~36×40 · `hospitalEntrance` ~96×64 (cyan
`light{r:70,#79e2cf,20,dy:40}`) · `foundryStack` ~40×110 **2 variants** (`world.js:242`
passes `variant:0` and `1`), amber light at `dy:130` so the glow sits at the chimney top —
give it an emissive lip · `ruinsCollapse` ~110×70.

**Drawn directly by `render.js radioMast()`, not by the world:** `mastSection` **48 tall**
anchor `feet`, stacked three times at `base − i*48` — it **must tile against itself with no
seam at a 48 step**, that is the whole job · `mastTop` ~20×40 anchor `feet` at `base−144` ·
`beacon` ~12×12 **anchor `center`**, **2 frames** (0 dark, 1 lit) at `top−36`.

Traps:
- **`variant` is non-zero only on `foundryStack`.** Extra variants elsewhere never render.
- Silhouette is the whole job — each must be unmistakable at the screen edge: the mast a
  thin vertical lattice, the foundry stack a fat tapering chimney, the watchtower a boxy
  head on legs, the ruins a broken diagonal.
- Not referenced by any call site, draw last if at all: `gateArm`, `crossSign`,
  `foundryHall`.

### boss — Patient Furnace, NOT YET DISPATCHED

Still the legacy den-2 `SPECS.furnace` in `art.js` plus rects. Brief not yet written;
derive it from `boss.js` (3 phases at 100/66/33% hp, `b.ai.mode` intro/active/transition)
and the `boss` scene in `tools/frame.mjs`. Note the **music for this fight has already
landed** (`audio.js furnace()`), so the art is now the part that is behind.

### vehicles — call sites `render.js:71-73` (driving), `:127-131` (parked), `world.js:114,155`

CARS.md Phase 5. The intact counterparts of `wrecks/car_h` / `car_v`, so a driveable
reads as "that one still runs" without the amber-glow hack.

- `sedan_h` **96×58**, `sedan_v` **48×106**, anchor `feet`, **2 variants each**.
  *Correction to the plan table:* it said `sedan_v` 58×96, which transposes the
  numbers. The footprint is 96×48 / 48×96 (`world.js:114 WRECK.car=[96,48]`) and the
  sprite is taller because the roof overhangs it — exactly as the wrecks do. Verified
  against the live registry: `wrecks/car_h` is 96×58 and `wrecks/car_v` is 48×106.
  **Mismatched dimensions make a car visibly jump the moment it breaks down.**
- **The 2 variants really render** (`variant: carId % 2`), unlike most art in this
  project where `variant` is always 0. Worth real effort: two different paint jobs.
- Drawn centred at the rect centre −5 with `flip` when heading west and `flipY` when
  heading north, so **each sprite must read mirrored on its own axis** — no
  driver-side-only detail, and light it straight-on, never from a corner.
  `rotate: residual` adds a small cornering lean (±0.39 rad).
- `ART.shadow` is called by the engine — do not draw a ground shadow.
- **The glint retires itself.** ART.md used to say to remove the `driveable` glow from
  `render.js drawSolid`; no engine change is needed, because `drawSolid` returns early
  inside `if(o.driveable){ if(hasArt(id)){ ... return; } }` before reaching it.

### hud — call sites `hud.js:35-57` (`panel()` and `icon()`), `hud.js:130`

**Six sprites, not twenty.** `barFrame`, `divider`, `iconHeart`, `iconLevel`,
`iconMap`, `iconPause`, `keycap`, `badgeTier`, `dotLive`, `cursor`, `upgradePip`,
`cardFrame`, `bossBarFrame`, `castBarFrame`, `minimapFrame` and `promptFrame` are all
in the plan table and **all sixteen have zero references** in `hud.js`, `render.js` or
`game.js` (grepped 2026-09-16). They are not work. The queued **UI declutter** will
rebuild the player cards and the objective panel anyway, so speculative frame art
drawn now would be redrawn.

- `panel9` / `panel9Alert` / `panel9Gold` — anchor `tile`, **24×24** (3×3 cells of
  8×8). `hud.js:38` reads `sp.w/3`, so anything not divisible by 3 tears. The
  **centre cell is never drawn as texture** (`hud.js:42` fills the interior flat
  first), and the **edge cells are stretched** along their run, so edge detail must
  survive stretching — horizontal rules yes, a rivet only in a corner cell. The three
  styles must be geometrically identical and differ only by ramp, or panels appear to
  change shape when their state changes.
- `icon_bullets` / `icon_shells` / `icon_fuel` — anchor `tile`, **12×12**.
  **Note the underscore**: `hud.js:130` builds `'icon_'+key`. The plan table's
  `iconBullet`/`iconShell`/`iconFuel` would never be found. Drawn at `anchorX:0,
  anchorY:0` with an integer scale in a 14-unit slot. They replace the text glyphs
  `▰` bullets, `▥` shells, `◩` fuel.
- HUD art never gets the lighting pass, so it must read at 100% on its own — the one
  family that legitimately sits brighter than the world band.

## Session notes

- 2026-09-16 — **`art.js define()` no longer throws on a duplicate bare sprite name, and
  that was a real blocker.** `boss/body` collides with `survivors/body`; `art/` loads
  alphabetically, so defining the boss family made **`art/survivors.js` throw and never
  register at all** — adding the script tag would have broken the whole game, not just the
  boss. Checked before changing it: the only bare-name lookups anywhere are `'down'` and
  `'furnace'`, and both resolve through the **legacy `SPECS` table**, not the alias. The
  alias exists only so the lint/sheet CLIs accept `body` as shorthand for
  `survivors/body`. So a collision now **drops the alias** (`ALIAS[name]=null`) instead of
  throwing: full ids always work, and an ambiguous bare lookup returns null and fails
  loudly rather than silently resolving to whichever family loaded first. Two families may
  now share a part name, which they should — `body`, `core` and `arm` are the obvious ones.
- 2026-09-16 — **`art.js pick()` reads `frames` OR `variants`, never both.** `boss/core` is
  specified as 2 frames × 2 variants and `boss.js:513` passes both, so only one axis can
  resolve. The boss agent bound it to **frames** (the pulse) — a dead, unblinking fire is a
  worse loss than a missing phase tint on a 24×16 sprite — and carried the phase-3 read on
  the body's port instead. If both axes are ever needed, `pick()` is the place to fix it.

- 2026-09-16 — **Trap for whoever ticks these boxes next: do not bulk-tick with a
  regex over sprite names.** A Wave 1 script matched on `body|bodyIdle|downed|wpn_...`
  and silently ticked the **boss** family's `body` sub-item, because `boss` also has a
  sprite called `body`. It sat wrong in the file until Wave 2 landed and the boss
  section was read again. Tick by section, or match the family heading too.
- 2026-09-16 — **Five sprites in this checklist have no call site and were never
  drawn**, deliberately and per brief: `sandbagCorner`, `fieldRadio`, `gateArm`,
  `crossSign`, `foundryHall`. They came from the original plan table, not from the
  code. The lines above now say so. Do not "finish" them without first adding a
  placement in `world.js` that actually asks for them.

- 2026-09-16 — **Wave 2: `barricade` and `landmarks` LANDED.** Both tagged in
  `index.html`, `npm test` exit 0, registry **142 targets / 0 errors**. Glow check
  done by the main agent per the trap: `node tools/shot.mjs radio,night` →
  `artifacts/scene-radio.png`, emitters read correctly under the multiply lightmap.
  - **landmarks** took one revision, all three notes measured rather than eyeballed:
    `shack` was the single most saturated object in the game (0.655 vs a family
    running 0.22-0.40) sitting right at the Act I objective — now 0.195.
    `hospitalEntrance` was the brightest sprite (mean L 0.334 over 4116 texels) —
    now 0.252, with the cyan sign finally the brightest thing on it instead of its
    own canopy. `ruinsCollapse` read as blood puddles because of 229 `MAT.brick`
    texels pooled at the ground line, not because of its shape — now concrete with
    brick chips.
  - **barricade** landed first time. Accepted three of the agent's own judgement
    calls after checking them: `signQuarantine` is loud (sat 0.589) but it is a
    hazard sign, 50% of it is near-black, and there is one per barricade;
    `bodyBag`'s magenta is 4% of its texels (a stain, not a stripe); the seven
    identical jerseys are correct because cast barriers *are* identical units and
    `world.js` never passes a variant anyway.
  - **A seam check of mine was wrong and cost the agent nothing only because I
    caught it**: I reported `mastSection` had "12 of 24 columns not continuing
    across the join". Row 47 is the two rails, row 0 is a full horizontal rung; the
    rails align exactly and those 12 columns are the rung filling the bay. Correct
    lattice. If you write a tiling check, compare rail positions, not lit-column
    parity.
- 2026-09-16 — **Still open in Wave 2: `boss`.** The Patient Furnace is the last
  legacy den-2 `SPECS` entry in the game. Note the **furnace music already shipped**
  (`audio.js`, five-song score), so the art is now the part that is behind.

- 2026-09-16 — **WAVE 1 COMPLETE. `survivors`, `buildings` and `vfx` all landed.**
  All three script tags are in `index.html`, `npm test` exit 0, registry at
  118 targets / 0 errors. Combined verification frames rendered with all three
  families live at once: `artifacts/art/wave1-street.png` and
  `artifacts/art/wave1-house.png` — four survivors separable by tint, furniture
  and walls reading, y-sorting intact. **Next: Wave 2 — barricade (Opus),
  landmarks (Sonnet), boss (Opus).** Briefs for those are NOT yet written; derive
  them from the call sites the way the Wave 1 briefs were.
  - **survivors** round 2 fixed the side walk (stride 4 → 11 texels, contacts are
    now genuine opposite poses, `f1`/`f3` no longer byte-identical) and gave the
    `C` torso a placket seam, armhole wedge, hem shadow and lit shoulder cap.
    Three IoU warnings on `body.side` are intentional and correct. The agent
    self-corrected two shadows it had put on the lit side. On `side`, `D` (72)
    slightly outcounts `C` (60) because hair/belt/boots/placket are all
    legitimately dark — accepted: `C` is still the largest contiguous region and
    the only saturated hue, and the frame render confirms four players stay
    separable.
  - **buildings** round 2 fixed the inert variants: `roofFillBig` went from 99%
    one colour to ~85% with real grit, and variant 0 vs 1 now differ by 278 of
    1024 texels, so the `render.js:180` hash pick finally selects between
    distinct patches. `roofFill` 92% → ~80% `D`. `roofBillboard` face moved off
    the near-white `P` (56% → 0.1%) onto the mid-ramp.

- 2026-09-16 — **survivors and buildings both drawn, both in revision round 1.**
  `art/survivors.js` (9 targets / 0 errors) and `art/buildings.js` (17 targets /
  0 errors) exist; neither is tagged in `index.html` yet.
  - **survivors:** the six weapons are excellent and final. Sent back for two
    things: `body.side` does not actually walk (legs are one merged column in
    all four frames; frames 1 and 3 are byte-identical, 0 and 2 differ only by a
    `DD` shade swap) and the `C` torso is an 80-110 texel unshaded slab.
    `body.down` is a correct contact/pass/contact/pass cycle — told them to make
    `side` match it. `downed` is fine; told them to stop worrying about it.
  - **buildings:** walls, `roofEdge` and the six roof props are good. Found that
    **the three `roofFillBig` variants are 99% one colour each**, so the per-cell
    `hash(x,y)` variant pick in `render.js:180` is inert and every block roof is
    a uniform field; `roofFill` is 92-93% `D`, which is the real cause of the
    "ruled-paper" seam look the agent honestly flagged. Also `roofBillboard` is
    56% `#a6a4a0` — a near-white 64x48 slab on a night roof. Asked for
    low-amplitude grain (not more contrast) and a darker board.
- 2026-09-16 — **`--strict` warning counts are NOT a design target.** The
  survivors agent deliberately held the side-walk stride to 4 texels "to keep
  frame IoU above the 0.85 gate"; there is no such gate — `tools/art/pix.mjs:190`
  emits IoU as a **warning**. It traded the walk read for a tidier warning list.
  When briefing a subagent, say explicitly that the read wins over the warning
  count, or this happens again.

- 2026-09-16 — **`vfx` LANDED.** `art/vfx.js`, 14 targets / 0 errors, script tag
  added to `index.html` after `art/wrecks.js`, `npm test` exit 0 (all suites
  pass), `art:lint:all` 118 targets / 0 errors. Took **three review rounds**:
  (1) shape — everything was round symmetric orange blobs, `fire` read as a
  traffic cone; (2) value — muzzles were 65-84% near-white and read as pale
  splats, `fire` was value-inverted (198 dark texels to 50 hot) and read as a
  volcano; (3) silhouette — `fire` had become a convex orange balloon with a
  detached white bar at its base. Final `fire` is three fused tongues, hot `Y`/
  `W` at the base, dark notched tips, `O` down to 40% of coverage.
  **Review technique worth reusing:** counting palette-letter histograms and
  coverage centroids straight off `A.spec(...)` rows turned "this looks wrong"
  into numbers the subagent could act on, and caught that the muzzles were 84%
  `W`. The subagent then found the actual cause — `rampAt(ramp,0.1)` fell before
  the ramp first breakpoint at t=0.16 and returned white.

- 2026-09-16 — **vfx round 1 reviewed, sent back for one revision.** `art/vfx.js`
  exists, 14 targets / 0 errors, sheet + frame in `artifacts/art/`. Engineering
  is right (loops close, anchors right, warnings reviewed not silenced) but the
  *read* is wrong: too much of it came out as round symmetric orange blobs.
  Notes sent: `fire` reads as a traffic cone (worst, and the most visible
  sprite); `muzzleS/M/L` are one oval at three scales instead of directional
  spiky flashes differentiated by shape; `flameTongue` was made fully symmetric
  and will read as a string of beads when stamped 5× along the aim;
  `impactSpark`/`bloodHit` frame 0 is a geometric "+"; `bloodDecal` is too
  bright/magenta for 240 persistent decals; `explosion` is a donut (low
  priority, unused). **`buildings` (Sonnet) dispatched** into the freed slot.
- 2026-09-16 — **`tools/frame.mjs --scene street` cannot show vfx.** Verified by
  reading the frame: no wrecks spawn and the players never fire in those 90
  steps, so `fire`, `bloodDecal` and the muzzle flashes never appear. The sheet
  is the review surface for that family; do not send an agent chasing it.

- 2026-09-16 — **Wave 1 relaunched, two agents in flight (not three).** Verified
  first that nothing survived the earlier abort: no `art/survivors.js`,
  `art/buildings.js` or `art/vfx.js`, no `artifacts/art/`, `index.html`
  untouched, `npm run art:lint:all` clean at 78 targets / 0 errors. Wrote the
  **Family briefs** for survivors, buildings and vfx from the actual call sites
  so a resumed session does not re-derive them. Dispatched `survivors` (Opus)
  and `vfx` (Sonnet); **`buildings` is deliberately held back** until one of the
  two returns, per the usage-limit lesson below — fewer agents in flight, less
  work lost.
- 2026-09-16 — **Brief correction found while auditing the call sites:**
  `wallH`/`wallV` are **32×16 / 16×32**, not the 32×48 the plan said. Every wall
  in the game is a house wall and `world.js:72` sets `wallT = 14`, so
  `render.js:127` clips the sprite to a 14-texel band — a 48-tall sprite throws
  34 rows away. Also confirmed `furn_shelf` is placed both 60×16 and 16×60
  (`world.js:83`) with no rotation at the draw site; the brief says to draw the
  horizontal sprite and leave the overhang alone rather than fix it in art.

- 2026-09-16 — **Wave 1 aborted by the session limit before any sprite existed.**
  All three subagents died seconds after launch (limit reset 2:20am America/
  Montevideo). No files were written, `index.html` untouched, boxes reset to
  `[ ]`. **Relaunch Wave 1 from scratch** — survivors (Opus), buildings
  (Sonnet), vfx (Sonnet).
- 2026-09-16 — **Important: `autoContinueAtUsageLimit` does NOT cover
  subagents.** The main interactive session waits for the reset and continues on
  its own, but an in-flight `Agent` call dies with HTTP 429 and is *not* retried
  or resumed. Consequence for this workflow: when the session auto-continues,
  the main agent must **relaunch** any subagent that was drawing, and should
  prefer fewer agents in flight at once so less work is lost. Check `art/` and
  `artifacts/art/` for partial output before relaunching.
- 2026-09-16 — Wave 1 dispatched: `survivors` (Opus), `buildings` (Sonnet),
  `vfx` (Sonnet) drawing in parallel. Each was told to create **only** its own
  `art/<family>.js`, and that the `CARS.md` agent owns `game.js`, `render.js`,
  `world.js`, `lights.js`, `hud.js`. Sheets land in `artifacts/art/`. When a
  family comes back: main agent reads sheet + frame, sends notes to the same
  subagent for 1-2 revisions, shows the user one sheet, then adds the
  `<script src="art/<family>.js">` tag to `index.html:23` and ticks the boxes.
- 2026-09-16 — Auto-resume verified good: Claude Code 2.1.273, subscription
  auth, `autoContinueAtUsageLimit: true` written explicitly to
  `~/.claude/settings.json`. On a usage limit the session waits and continues on
  its own, repeatedly. Caveat: typing anything during the countdown cancels it.
  If the terminal itself dies, recover with `claude --continue`, or from a cold
  session: "read ART.md and continue from the first unchecked box".

- 2026-09-16 — File created. Audited the registry against code references:
  `tiles`/`props`/`wrecks`/`loot`/`infected` are defined; `survivors`,
  `buildings`, `vfx`, `barricade`, `landmarks`, `boss`, `hud` are referenced but
  missing, and `vehicles` is new work from `CARS.md` Phase 5. Legacy den-2
  `SPECS` in `art.js` still supplies survivors and the boss.

## City revamp families (CITY.md Phase 8) — mirrored 2026-09-16

Status per CITY.md: art exists, lint 0 errors, reviewed in-game by the main agent; owner review
of the sheets is pending (sheets sent 2026-09-16). `tools/test-art-refs.mjs` (in `npm test`)
fails if any art id the city places, any fence/door/facade strip, door family piece, sign or
new pickup/vehicle sprite is undefined, or if an interior furniture sprite stops matching its
collision rect.

- [r] `lots` (new, `art/lots.js`): chain/hedge/stone/hoarding `_h`/`_v` strips, grave, graveFlat,
  tree, plantingBed, pathCross, pathGravel, parkingLine_v, lightPole, trolley, utilityBox, spoilHeap,
  conveyor, craneBase, gantryLeg, pipeBank, padMarking, hazardPaint, hoardingSign, noticeBoard,
  refugeNotice, shutdownChecklist, dispositionBoard, rubbleSpill. Weakest: trolley, rubbleSpill.
- [r] `tiles` additions: grass, gravel (lot surfaces via `chunks.js` SURFACE).
- [r] `buildings` additions: 23 interior furniture pieces (aisles, checkout, vending, desk, records,
  pallets, screen, med cabinet, console, bench, cell bars, gear rack, hose reel, transmitter,
  workbench, lathe, drum rack, racking, pew, drawers, weapon rack), flat paperwork/bedroll/tools,
  ceilingLight, doorSecured_h/_v, sealedFacade_h/_v. Weakest: stripped aisles read like pillars;
  gear-rack helmet.
- [r] `doors` (new): sill_h/_v + jamb/leaf for residential, glassDouble, policeBars, fireRoller,
  hospital, loadingBay, chapel, military, service. Drawn over the roof edge (`render.js drawDoorway`).
- [r] `signs` (new): 16 pictogram plaques. Weakest: market cart, police shield.
- [r] `vehicles` additions: fireTruck_h/_v (intact/damaged/wrecked, revised once for cab step,
  ladder, light bar), bulldozer_h/_v (working/broken, blade revised).
- [r] `loot` additions: provision, jerrycan, evidence, payload, override. `props`: manifest,
  debrisPile, debrisCleared. `vfx`: dust.
- [r] Campaign state art exists: generatorRunning, circuitBox, transmitterLive, quarantine gate/
  bollard strips and evacBarrier, civilian idle/step/cower, and the quarantine pallet. The
  2026-09-16 v2 follow-up audit confirms registry ids, quarantine browser registration and a
  passing art-reference suite; the orphaned airdrop is gone. Complete frame/state, collision and
  street-read acceptance through `city_v2.md` P0; existence alone is not visual approval.

## city_v2 families and revisions (2026-09-17)

New families registered in `index.html`: `frontage` (35 ids: brick rows, shopfronts, awnings, shutters, rear walls,
back doors, bin nooks, terraces, collapse ends, party walls, collapse floor/spill), `industrial` (39: metal/sawtooth/
monitor roofs, corrugated walls, workshop/office fronts, loading door/dock, pipes and joints, gantry, conveyor, hopper,
yard clutter; overhead pieces use `tint:'shadow'`), `civic` (31: ward roofs, canopy, glass link, ambulance bay, fire
apron/bays, depot, transformer, cable pole/drum/rack, broadcast front, quarantine fence/gate/post, queue rails, tent
group, processing link, requisition board), `streetlife` (22 flat decals: bags, boxes, paper, glass, brick spill,
timber, tipped bin, drains, damp, wall dirt, crossings, curb cuts, lane marks).
Redrawn: all ground fillers + edges/corners/footing/grime (`tiles`), watchtower, `wrecks/car_*` (police/hatch/burnt
parametric saloon), `vehicles/sedan_h/_v` + new `sedan_vs` (southbound front face), `quarantine/*` gates, bollards,
evac barrier + `gateOpen_h/_v`, `survivors/civilian` (4 people x 3 frames), park pieces in `lots`, and the P2 weakest
list: `signs/market`, `signs/police`, `lots/trolley`, `lots/rubbleSpill`, `buildings/furn_shelfAisle`,
`buildings/furn_gearRack`. `npm run art:lint:all`: 455 targets, 0 errors, 3021 warnings within the recorded budget.
Renderer contracts: `render.js` facade `KITS`/`REAR` per district, `overhead` props drawn after roofs with a shadow
copy, tile-anchored solids, vertical closed gates raised. Placement lives in `world.js streetLife()`,
`districtPieces()`, `dressCourts()` and `dressLots()`. Evidence: `artifacts/city/v2/`.
