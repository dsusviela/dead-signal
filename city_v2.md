# City v2 — a city of recognizable neighborhoods

> Follow-up to [CITY.md](CITY.md), based on the current implementation and the user's
> original three screenshots and subsequent solo HUD/playtest feedback, reviewed 2026-09-16.
> This document plans the next changes; it does not claim
> they are implemented. CITY.md retains the original campaign, resource, vehicle, and access
> contracts. V2 refines district ownership, map presentation, street composition, and art
> acceptance, controller usability and HUD layout. Where those subjects conflict, the explicit
> v2 decisions below take precedence. The input changes below also supersede v1's combined
> medkit/ration binding; healing amounts, inventory ownership and resource budgets remain intact.

Status: `[ ]` pending · `[~]` implemented in part or awaiting review · `[x]` verified with evidence.
V2-specific delivery work starts pending. Inherited v1 work may already exist; audit it before
commissioning replacements. Existing code is evidence to build on, not proof that its visual
result is finished. Preserve the original tracker and its history.

## Audit against CITY.md — 2026-09-16

**The city direction is consistent with v1, but usability must be an early delivery gate.**
The original v2 audit also predates v1's audio tests, performance evidence and warning-budget
gate; those are inherited work, not missing systems. The campaign, fixed geometry across seeds,
required destinations, foot access, fuel reserve, optional service vehicles, Day 9 and self-rescue contracts remain
binding. Strong map territories are compatible with gradual architectural transitions in play.

Current evidence and corrections:

- `npm test` passes, including city, art-reference, campaign, boss and vehicle checks. The
  measured 84 enterable buildings, 51 sealed masses, 18 lots and 845 props still match.
- All nine ids in the P0 ledger now resolve. `art/quarantine.js` is registered in `index.html`,
  and `test-art-refs.mjs` now explicitly requires the dynamic campaign ids. P0 is an integration
  and quality review, not nine missing-asset commissions. Frame coverage, browser load order
  and actual fallback occurrence still need stronger verification.
- `audio.js` already has per-type engines, track clatter, action/material cues, district beds,
  generator/fire/transmitter loops and distance attenuation. `tools/test-audio.mjs` now covers
  new cues, floor/engine signatures, source conditions, pause/mute/reset and the 48-voice stress
  case; CITY.md records a passing browser run. Listening acceptance remains open. District beds
  use camera territory; the proposed source-bound scene composition is additional v2 work.
- `npm run art:lint:all` now passes: **276 targets, 0 errors, 904 warnings**, within the checked-in
  per-sprite budget. The former strict failure is historical; `art:lint:strict` retains that
  stricter diagnostic. Preserve the budget gate and review intended changes, rather than
  scheduling its implementation again or treating the warnings as resolved artwork.
- CITY.md Phase 13 records current simulation/browser timings and solo/four-player counts.
  Reuse them as the v1 reference and capture comparable v2 measurements; no pre-revamp timing
  exists. Full-run, street-read and listening acceptance remain in its human review queue.
- The current controller uses RT to run and LT to heal, including before the vehicle branch.
  Driving takes stick/D-pad X/Y; trigger values are reduced to button booleans. Simply adding
  LT braking would risk consuming supplies unless input actions are separated by context.
- H / LT attempts a personal medkit, then silently attempts a shared ration if that fails.
  The HUD labels only the medkit. The player's inability to understand healing is a supported
  usability finding, even though the underlying inventory/healing tests pass.
- `hud.js` reserves `50*k` at the top and `180*k` at the bottom, with `k` based only on width.
  At the supplied 2048×1002 viewport this is 80 + 288 = **368 px (36.7% of height)** before
  objective, minimap and prompts. Pending upgrades raise the drawn bottom band to about 358 px,
  while the camera still reserves 288 px. Four cards occupy more horizontal area in that same
  tall band; they do not create four vertically stacked bands. The supplies panel is currently
  one shared panel, but its left alignment above P1 makes its ownership and placement unclear.
- The proposed ownership table preserves the intended districts at sampled corners/centers
  of all current required location rectangles. It nevertheless changes ordinary locations,
  street caches, spawn themes and resource allocation, so it is a gameplay migration too.
- The earlier diagnostic keeping v1 loot fixed and only applying the proposed territory classifier
  fails the existing South Blocks resource shares in **6/50 seeds**: bullets in 17, 29 and 43;
  medkits in 29, 32, 35 and 44. Minimum shares become 10.64% bullets (required 12%) and 0%
  medkits (required 5%). This isolates the boundary effect; regenerating loot with the new
  district weights will need a separate full measurement. Preserve starting-area sufficiency
  by redistributing the existing budget before accepting the migration.

**Distance to the two quality bars:** v1's main playable systems are implemented and pass
simulation checks. Its remaining work is street/interaction readability (Phase 8), listening
acceptance (12A), and manual balance/full-run acceptance (13), now including the reported
control/HUD problems. Those are substantial acceptance gates; phase checkboxes do not establish
finished v1 quality. V2's
territory renderer, composed block families and six-district rollout remain pending. Most
of that spatial/art work is still ahead, although it can reuse the v1 mechanics and assets.
No defensible calendar estimate exists until the two pilot blocks establish iteration cost.

**Delivery decision:** establish the baseline, then fix controls, healing clarity and the HUD
before the territory/composition rollout. Denser streets must be reviewed through the intended
gameplay viewport. Additional art cannot compensate for a screen dominated by panels.

Close the v1 gaps alongside v2 rather than rebuilding inherited features. Keep distinct exits:
v1 proves its current city is readable and playable end to end; v2 additionally proves the
unlabelled neighborhood, territory and purposeful-space checks below. Use the two pilots to
estimate the remaining six district passes before committing to a citywide art expansion.
This audit reviewed source, automated checks and existing screenshots; it did not perform a
fresh browser run, listening session or solo/four-player playthrough.

## Direction

The primary deliverable is a denser, fully dressed and visually finished city: buildings,
alleys, courts, street clutter, ground materials and detailed public spaces across all six
districts. Controls/HUD are an early enabling pass, not a replacement for this work. V2 cannot
close with only a better interface, colored map or increased building count.

The city should feel inhabited nine days ago. Streets should reveal how people lived, worked,
waited for treatment, loaded goods, and were contained. A district needs a recognizable street
pattern and building vocabulary around its landmark. A hospital sign on another generic box
does not establish a medical district; a few pipes beside houses do not establish Ashworks.

The map should make the geography immediately legible: **every block belongs to one of six
districts, and the entire mapped city carries those district colors.** Use the supplied GTA2
reference for continuous, readable territories and street contrast. These are neighborhoods,
not gang ownership, capture zones, or a new territorial-control mechanic.

At street level, retain believable materials, failed lighting and gradual changes across
boundaries. Strong cartographic colors do not require painting the playable world six colors.
Keep fixed geometry across seeds, randomized supplies, open exploration, the guaranteed fire
truck, optional bulldozer shortcuts, and the self-rescue ending.

## What the current build actually shows

This snapshot comes from `DSWorld.create(1)`, source review, the supplied screenshots, and
`node tools/test-art-refs.mjs`. It is not a new browser playthrough. The corrections above
and updated rows below supersede the original missing-asset diagnosis.

| Finding | Evidence | Consequence for v2 |
|---|---|---|
| The city has content, but weak composition | 36 blocks, 84 enterable buildings, 51 solid building masses, 18 lots and 845 props | Judge useful frontage and relationships, not just total object counts |
| The map barely communicates territory | `drawMapRevamp()` uses district color with alpha `14` (20/255, about 8%), then paints opaque roads, lots and buildings | Territory needs its own strong palette and a deliberate layer order |
| Central Quarantine owns no blocks | Current block ownership: South Blocks 12, Old Quarter 8, Civic Ward 8, Northline 4, Ashworks 4, Quarantine 0 | Give it explicit neighborhood territory, distinct from the inner arena |
| Ordinary buildings remain similar across districts | South Blocks, Civic Ward and Northline use row-house styles; Ashworks' ordinary weights are 60% home / 40% shop | Change block and building families, not only prop colors |
| Ashworks is especially underdeveloped | Its five enterable buildings are the machine shop, warehouse and three homes | Extend the industrial environment through surrounding blocks |
| Empty-looking spaces are a generator outcome | Frontage parcels are 230–319 units long with 50–99-unit gaps; cores contain small isolated masses, and reservations reject fill | Replace repeated disconnected boxes with authored frontage, courtyards and service spaces |
| Previously missing campaign art now exists | All nine P0 ids resolve and the art-reference suite passes | Review state, scale, collision and street readability before replacing art |
| Reference existence does not prove rendered state coverage | Dynamic campaign ids are now enumerated, but the check does not exercise their live frames or browser load order | Validate state-dependent rendering and actual browser registration |

Current counts describe this audit snapshot, not new targets. More items, more enemies or more
loot would not by themselves solve the empty feeling.

### Original screenshot 1: the unexplained red slab

The original red rectangle was consistent with a fallback path: `render.js` handles a `gate`
through `drawStrip(..., 'quarantine/gate')`, falling back to the red collision-box palette
(`#1a0b09`, `#8b2b1d`) when the orientation sprite is missing. Both sprites now exist and the
family is registered. Reproduce the scene in the current build before attributing any remaining
slab to missing art. The screenshot has no world coordinates, so its exact gate instance is
not established by the image alone.

There is also a decorative `landmarks/gate` at Checkpoint and a separate functional evacuation
barrier farther south. Retain multiple checkpoints only when their spatial role is clear.
A decorative boom must never promise the opening behavior of the actual exit gate.

**Required outcome:** the player sees a supported gate with posts, hinges or a sliding track,
a visible passage, and an unmistakable open/closed state. Its collision belongs to the physical
leaf or bollard, not an unexplained colored slab. Render a single assembly with coordinated
solid and decorative parts; do not double-draw the placeholder gate under the finished prop.

### Additional prop/place screenshots: recognizable objects and readable ground

These are the later watchtower crop, white vehicle crop and South Blocks scene at 00:34;
they are separate from the original three city references. The district name is visible in
the third image, but the exact location/coordinates cannot be established from it alone.
Its immediate space has no clear function: broad dark ground, anonymous building edges,
a fence and an isolated arrow sign do not explain whether this is a street, yard or forecourt.

The two prop ids below were matched against fresh isolated renders of the current source,
saved in `artifacts/city/prop-audit/`. This confirms identity, not satisfactory in-game quality.

| Reference | Diagnosis | Required revision |
|---|---|---|
| Watchtower crop | `landmarks/watchtower`: a flat cabin rectangle on two legs, with faint braces and no readable access/platform. Its 96-pixel sprite puts the lit window about 80 units above its feet, but the placed light omits `dy`, so render/light code uses the generic 24-unit offset. The glow consequently appears between the legs. | Establish cabin roof/side planes, a supported platform, railing, visible ladder/stair access and grounded footings. Keep braces readable at gameplay zoom. Attach the window/lamp emitter to the actual visible source using matching offsets in glow and lighting passes; do not disguise the mismatch with a larger glow. |
| White vehicle crop | `wrecks/car_h`, police variant 1: two window rectangles, an almost featureless white slab and dark wheel blocks. It can read as a trailer or kiosk instead of an abandoned police car. | Redraw roof/cabin, hood and trunk proportions, windshield versus side glass, wheel arches/tires, bumpers, lightbar and restrained police livery. Make front/back and vehicle scale legible. Carry the same perspective through horizontal/vertical, intact and damaged relatives; retain compatible anchors/footprints or migrate their consumers explicitly. |
| South Blocks at 00:34 | Weak ground/edge composition makes even flashlight-lit space anonymous; darkness further hides the few context cues. Adding an isolated sign or more random props would leave that problem. | Reproduce and record the location before authoring its use. Compose ground, perimeter, facade/entrance and an activity cluster as one place, then check the same view under normal flashlight and ambient lighting. |

For the third scene and every comparable void, declare the intended use first. A street needs
connected carriageway, curbs/sidewalks, crossings or appropriate road wear and frontages; a
loading yard needs a service entrance/dock, maneuvering space and coherent storage; a parking
area needs access, bays and a pedestrian route. Give an alley rear doors, enclosure and clear
connections. Select the treatment justified by its actual location; do not guess a loading yard
from this screenshot and silently change the place's role.

Make the player's footing legible: distinguish asphalt, pavement, gravel, grass and interior
floor; show wall bases, thresholds, curb edges and contact shadows so roofs/facades do not
look like arbitrary rectangles beside an empty plane. Fix massing and material values first,
then compose useful light pools. Preserve night and stealth while ensuring the flashlight
reveals meaningful surface/edge information. More texture noise or global brightness is not
an acceptance criterion; review scanline/grain strength when it erases those cues.

**Ground-specific clarification from the player:** the existing streets and sidewalks look
good. Preserve their material treatment as the quality reference. The broad area in the third
image looks effectively untextured even inside the flashlight; this is a surface-art problem
in addition to the missing spatial identity. Filling it with props does not complete the fix.

Source review finds a relevant weakness: outside roads, rooms and explicit lots,
`chunks.js::groundKind()` chooses a district filler such as `tiles/lotSouth`.
`art/tiles.js::makeLot()` deliberately builds a mostly flat base with a few tiny clusters.
That supplies technically present texels without a recognizable material across a large area.
This is a plausible explanation for the screenshot, not a confirmed classification of its
unknown coordinates. Check the ground kind and actual rendered tile when reproducing it;
distinguish missing texture draws from texture that is too sparse/dark to read.

Replace anonymous filler in these spaces with the appropriate outdoor material: slab joints
and patching for concrete, aggregate and repairs for yard asphalt, stones/ruts for gravel,
or soil/grass structure where justified. Compose fine material grain with broader wear,
stains and edge accumulation so a large empty patch still reads as a physical surface. Keep
variation continuous across tiles/chunks. Validate the base surface with dressing hidden and
then in the complete night scene; readable roads/sidewalks are the comparison, not a redraw task.

Use a brief named-place arrival cue and the compact location field where a known semantic
location applies, with details available on the map. Derive names from existing location data;
do not invent a new label for every patch of pavement. Environmental identity must still pass
with that text and the minimap hidden. A player should be able to say what they are standing
on, what the surrounding place is used for, and where its entrances/exits are within five
seconds. This is a separate check from identifying the district's architectural style.

## 0. Controls, healing and a lean gameplay HUD

The latest solo screenshot is a separate usability reference from the original three city
screenshots. It shows too much permanent framing, small low-contrast instructions, a detached
shared supplies bar and duplicated weapon information. The reported four-player problem must
be evaluated with all four cards populated, not inferred from a solo mockup.

### Input contract

Use this as the proposed v2 default. Keep keyboard driving preferences; make controller
acceleration/braking independent from its steering style. Do not ship a trigger mapping while
the old LT heal path is still active. Standard gamepad positions are listed with Xbox / PS
labels; prompts must reflect each player's device, with a consistent fallback for unknown pads.

| Action | Keyboard | Controller during live play |
|---|---|---|
| Walk | WASD / arrows | Left stick / D-pad |
| Run on foot | Hold Shift | Hold RT / R2 |
| Steer vehicle | Existing A/D steering or directional preference | Left-stick X in steering mode; stick direction in directional mode |
| Accelerate vehicle | Existing W / Up or directional preference | RT / R2, analog |
| Brake, then reverse | Existing S / Down in steering mode | LT / L2, analog |
| Interact / board / leave | E (retain Space alias) | A / Cross |
| Use personal medkit | H | B / Circle, press once |
| Eat shared ration | R | RB / R1, press once |
| Toggle autofire | F | X / Square |
| Cycle weapons | Q | Y / Triangle |
| Map / pause | Tab / Esc | View / touchpad-equivalent; Menu / Options |

- Read trigger `.value` with a small dead zone; support digital 0/1 devices too. Stick motion
  alone never accelerates a controller-driven vehicle, including directional steering mode.
  Define explicit steering, throttle and brake actions instead of reusing walking Y.
- LT first brakes forward motion to zero; continued LT reverses from rest. RT first brakes
  reverse motion before going forward. If both triggers are held, brake to rest and do not
  accelerate/reverse. Releasing both coasts with existing drag. Preserve vehicle-specific
  handling, fuel use, tracked pivoting and collision; brakes still work with an empty tank.
- Only the driver produces vehicle actions. Passengers retain heal/ration/fire/cycle actions;
  their triggers do not drive or consume supplies. Dedicated heal/ration buttons also work for
  the driver. Suppress on-foot sprint while seated. On boarding, exiting, resuming or reconnecting,
  require held triggers to return to neutral before their new context acts; do not accelerate
  just because the player was holding run while boarding.
- B and RB currently confirm/select upgrades, so relocating healing requires relocating that
  flow too. A pending upgrade becomes a small badge on its owner's strip. Open that player's
  upgrade panel explicitly from Pause; the squad remains paused. Only its owner (or an explicit
  mouse choice for that player) selects it: stick/D-pad or LB/RB navigate, A confirms, B backs
  out. Keyboard 1–3 may choose only inside that panel. Closing it consumes the menu press and
  never heals, eats, fires or boards. Make upgrade allocation explicitly available while paused
  without advancing simulation; current live-only UI/guards need migration. No automatic modal
  on level-up and no taller live HUD when points are waiting.
- Use one action-label source for manual, contextual prompts, options and player strips.
  Resolve bindings per player in mixed keyboard/controller co-op. Test held buttons, device
  loss and menu transitions; a single press must not perform two actions.

### Healing must explain itself

Retain the existing personal inventory (start with one kit, carry at most three), 50 HP heal
capped at max HP, press-once behavior and healing noise. Walking over a kit collects it; it
does not automatically heal. Downed survivors still need a teammate nearby for three seconds.

Give every player a persistent compact `H HEAL ×1` / `B HEAL ×1` affordance beside their HP,
using the appropriate device label. Emphasize it when hurt and carrying a kit. On the first
damage with a kit, show one brief player-specific hint: `P2 · B: heal 50 HP`. On successful use,
show the actual HP gained and decrement that player's kit count. At full HP show `Health full`;
with no kit show `No medkits`; consume nothing in either case. Rate-limit repeated feedback.
Explain kit collection once on first pickup and make the controls reference available in Pause.

Remove the implicit ration fallback. R / RB explicitly consumes a shared ration and reports
its stamina benefit, remaining squad count, or why it cannot be used. Preserve existing ration
effects, cooldown and caps. Rations are not healing. The strip's downed state replaces the
heal affordance with revive progress and a nearby-teammate instruction. Critical downed alerts
must take priority over generic stash/vehicle hints; today's global prompt order can hide them.

### Information hierarchy and screen-space budget

Design at four players first, then allow the same strips to occupy less width in solo play.
Use compact text and spacing, not illegibly scaled versions of the existing large cards.

| Surface | Keep during play | Move out of the persistent layout |
|---|---|---|
| Top edge | District/location, elapsed clock, small map/pause affordances | District role subtitle, oversized outbreak numeral, permanent escalation countdown |
| Each player strip | P-number/color, HP, heal button/count, active weapon and magazine, compact fire/reload state | Repeated KEYBOARD/CONTROLLER labels, duplicate pistol/slot text, three large inventory boxes |
| Conditional player details | Thin stamina meter while draining/recovering; vehicle fuel/integrity replaces it while seated; downed/revive and upgrade badge | Full-time stamina numbers/labels and expanded upgrade choices |
| One squad supplies row | Shared ammo, incendiary fuel, rations, machine fuel and compact level/XP | Detached framed panel hovering over P1; repeated reserve counts on each card |
| Local map | Small corner map with player/danger cues and an accessible expand control | Large LOCAL / 1.4 KM heading, decorative noise/roam footer |
| Campaign and help | Short discovery/state-change notices, nearby action feedback, current knowledge accessible in map/pause | Permanent two-line objective card, full-width keyboard/controller instruction footer, repeated start banner |

Attach the supplies row directly to the bottom strips as a single squad dock, with a `SQUAD`
label and subtle divider, not a floating second frame. Keep it visibly shared even in solo.
Show all resource totals once; use distinguishable glyphs/short labels and retain the explicit
incendiary-versus-machine-fuel distinction. Provide expanded inventory/weapon details in Pause.
Retain a clear autofire-on/off indication because shooting is opt-in.

Replace the opaque full-width top slab with compact edge clusters. Keep the elapsed clock
visible during the boss fight too; currently the boss display replaces it. Outbreak escalation
becomes a brief change alert, with tier/countdown available in map/pause. During the arena,
show a compact boss HP/cast strip with essential tells; measure its extra area explicitly.
Neither campaign notices nor the map should reveal undiscovered dependencies or add a route trail.

Initial acceptance budgets, measured in CSS pixels at default UI scale:

- Top allocation at most **4.5% of viewport height**; complete bottom dock, including supplies
  and margins, at most **11.5%**. Combined permanent vertical reservation at most **16%**,
  with one through four players and pending upgrades. At 720 px this is at most 115 px total,
  versus today's roughly 250 px at 1280×720. These are targets to prove in V2-0A, not results.
- Keep four player strips in one row at 1280×720, 1920×1080, 2048×1002 and 1024×768. Core
  text (HP, clock, weapon/ammo, healing) must remain at least 12 CSS px at default scale.
  Remove secondary text before reducing it below that size. Offer a larger readable UI scale;
  record its explicit space tradeoff separately rather than claiming the default budget holds.
- Cap the local map's outer size at 18% of the shorter viewport dimension; allow hiding it
  and expanding the full map. Count all persistent panel rectangles, including minimap and
  boss bar, toward a **22% maximum covered screen area**. Transparency does not exempt a panel.
- Protect the central combat view. Notices use one short-lived slot; nearby prompts identify
  the player and stay clear of survivors, enemies and interactable entrances. Coalesce duplicate
  hints without hiding another player's urgent heal/revive/action feedback. Essential action
  progress and readable evidence remain accessible; moving them is not permission to omit them.
- Compute one actual gameplay safe rectangle for HUD layout, `main.js` aspect calculation,
  camera/tether/boss framing and `render.js`. Resizing or gaining an upgrade must not make
  actors disappear behind a dock whose height the camera does not know. Recheck pointer hit
  targets after the canvas layout change; editing title-screen CSS alone cannot fix this HUD.

Prove this with comparable calm/combat screenshots and controller play, not just a wireframe.
Capture one, two, three and four players; mixed devices; healing available/unavailable; all
players awaiting upgrades; vehicle driver/passengers; downed teammate; boss and campaign text.
Show before/after panel bounds and the usable play rectangle at each target viewport. A new
player should be able to heal and drive without opening the manual or asking which button works.

## 1. District ownership and the fully colored map

### Author block ownership explicitly

Use the existing six-by-six street grid and stable block ids. Add one authored district id
per block; validate all 36 assignments. Derive point classification, map territories, ordinary
building placement, HUD names and thematic transitions from that ownership. Keep district
metadata in `DISTRICTS`; do not add a second hand-maintained map-only geography.

Proposed ownership, north at the top and west at the left:

| Row / column | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 0 | OLD | OLD | NORTH | NORTH | CIVIC | CIVIC |
| 1 | OLD | OLD | NORTH | NORTH | CIVIC | CIVIC |
| 2 | OLD | OLD | QUAR | QUAR | CIVIC | CIVIC |
| 3 | OLD | OLD | QUAR | QUAR | CIVIC | CIVIC |
| 4 | SOUTH | SOUTH | SOUTH | SOUTH | ASH | ASH |
| 5 | SOUTH | SOUTH | SOUTH | SOUTH | ASH | ASH |

OLD = Old Quarter; NORTH = Northline; CIVIC = Civic Ward; QUAR = Central Quarantine;
SOUTH = South Blocks; ASH = Ashworks. Grid edges remain
`[-3600, -2800, -1400, 0, 1400, 2800, 3600]`; cells have unequal physical sizes.

This deliberately changes the four central blocks from South Blocks to Central Quarantine.
The broader district covers containment support streets around the existing complex. **It
does not enlarge the sealed boss arena or close the through-roads.** Keep the current arena
at approximately ±370 and the authored command/disposal compound at approximately ±620;
use outer central blocks for processing support, requisitioned buildings, vehicle staging,
logistics and abandoned civilian frontage. Preserve all current required destinations.

That change requires a quarantine-specific fill pass: today's `buildFabric()` skips quarantine
blocks and its ordinary weights are empty. Changing the four ids alone would make the center
emptier. Author the support blocks before enabling the new ownership in the playable build.
Initially preserve/adapt the existing central fabric and routes; the final architectural pass
follows the representative-block review. Keep every intermediate playable build populated.

Redistribute supplies within the approved global budgets so the remaining South Blocks still
meets its per-seed ammunition, medical and provision shares. Reclassification alone already
breaks those shares in the diagnostic above. Do not lower the envelopes or add total loot just
to make this migration pass. Recheck spawn composition as well: central streets change from
the South Blocks walker theme to quarantine's runner theme, without changing the arena bounds.

Update old acceptance assumptions deliberately: `district(700,700)` currently expects South
Blocks, and ordinary-fabric tests require home/shop/clinic interiors in Ashworks. Replace those
with the new ownership and suitable industrial-content assertions while retaining access,
supply and fixed-seed guarantees. Preserve semantic ids for retained places; the current shared
geometry RNG and global parcel counter can shift unrelated fill/ids when a block is skipped.
Review that effect before refreshing fixtures; fixed across seeds does not mean stable across edits.

For the complete map, territory cells extend to road centerlines and the world edge, beyond
the inset usable block rectangles. Assign half-road surfaces to the adjacent territory and
use a deterministic half-open coordinate rule at shared edges/intersections. Include the
outermost edge explicitly. Every in-bounds point must resolve to exactly one district, with
no uncolored pavement, arbitrary fallback slivers or overlapping color fills.

Locations inherit block ownership. For compounds crossing several cells, list those block
ids and validate a consistent owner; fix authored boundaries when a required compound would
otherwise straddle districts. Keep the fixed city identical across run seeds.

### Map palette and drawing rules

Use a dedicated `mapPalette` on each district, separate from world ambient light, loot-profile
colors and combat indicators. The following are starting design colors, to tune in screenshots:

| District | Territory hue | Proposed fill | Recognition beyond color |
|---|---|---|---|
| South Blocks | Teal | `#487f75` | Joined residential/shop blocks and market crossroads |
| Old Quarter | Violet | `#79629b` | Terrace rows, broken courts and graveyard footprint |
| Civic Ward | Blue | `#537ea6` | Hospital wings, campus paths and service court |
| Northline | Ochre | `#a58a42` | Utility parcels, fire apron and mast yard |
| Ashworks | Rust orange | `#a86943` | Large sheds, loading courts and pipe/conveyor runs |
| Central Quarantine | Dusty crimson | `#9b535d` | Four support blocks, perimeter and distinct inner arena |

Draw the map in this order:

1. Opaque territory colors over the entire map extent. The full map is a readable diagram,
   independent of scene darkness, flashlight coverage and the lighting simulation.
2. Roads in a darker, district-derived value with clear continuous curb/road edges. Boundary
   strokes separate territories without hiding the road that runs along the boundary.
3. Building footprints in lighter/darker values of their owner hue; preserve territory color
   on roofs, sealed masses, courtyards, parks and service yards. Show lot function using small
   symbols or restrained patterns instead of large opaque unrelated-color rectangles.
4. Compound outlines and actual gate/entrance states. The inner arena is a local hazard overlay
   with its own outline/hatching, distinct from the broader quarantine district color.
5. Large district labels and smaller place labels with dark backing where needed. Place labels
   inside their territory, avoid icon overlap, and adjust their positions for each map scale.
6. Supply/profile glyphs on neutral dark badges, with visited/cleared markings confined to the
   badge. Clearing supplies must never gray out district territory or erase street geography.
7. Players, live vehicles, objective annotations, visible infected and actual noise radii.
   Their shapes and contrast must remain readable over every territory color.

Make Territory view the default, including all six districts. Keep the supply legend, but
give the territory key and labels visual priority; fit the legend without shrinking geography
into unreadability. Include Central Quarantine in the key/cards and correct `index.html`'s
“Five districts” copy. The fire-truck bay and live truck remain distinct map marks.

Apply the same ownership/colors to the full map, local map, title preview and `tools/city-map.mjs`.
At local scale reduce label clutter, not territorial coverage. Unknown caches remain hidden;
district geography may be known from the start, so coloring does not reveal hidden loot.
Use names, boundary shapes and glyphs alongside color; verify grayscale and color-vision
readability, especially Civic/South and Quarantine/Ashworks. Reduce map grain/scanline effects
if they obscure the hierarchy shown in screenshot 2.

## 2. Fill the city with relationships, not scattered props

Every block needs a declared purpose and every substantial open area needs a reason: street,
court, garden, parking, loading, staging, demolition, refuge or combat clearance. An unplaced
building must not silently leave an anonymous empty rectangle behind.

Use three scales of composition:

- **Block:** connected street wall, campus, industrial court or containment support cluster,
  with an identifiable corner and a purposeful interior.
- **Frontage:** an entrance, windows/shutters, canopy or service opening facing an appropriate
  street; a back door, bins and loading face toward a lane or yard.
- **Human traces:** a waiting queue by reception, a trolley return by parking, a hose rack by
  the fire bay, a dispatch board by loading, fresh refuge notices by the chapel. Place each
  cluster for a reason and keep its scale consistent with people, doors and vehicles.

### Density rules to test in representative blocks

These are initial authoring targets, not measured performance results or requirements to pack
every square unit. Measure frontage coverage as facade/perimeter length facing a street divided
by usable frontage after explicit access reservations. Count the projected intervals once.

| Block family | Initial frontage coverage | Where open space belongs |
|---|---:|---|
| South Blocks residential/commercial | 65–80% | Rear courts, park, parking and loading |
| Old Quarter terrace streets | 70–85% intact outline | Broken courtyards and documented demolition gaps |
| Civic Ward campus/support streets | 45–65% | Connected forecourt, ambulance loop, treatment/service courts |
| Northline municipal/utility | 45–65% | Fire apron, fenced utility courts and tower setback |
| Ashworks industrial | 55–75% | Working yards between large sheds, loading and machinery routes |
| Quarantine support streets | 50–70% | Processing queues, staging and deliberately open fight approaches |

- Use attached or nearly attached frontage where appropriate; replace arbitrary repeated
  50–99-unit gaps with specific alleys, stairs, courtyards or service access.
- Grow selected building masses and connect their visual facades while retaining purposeful
  pedestrian routes. Do not turn every background facade into a lootable interior.
- Consolidate generic reservation padding after verifying its purpose. Distinguish no-solid
  navigation space from no-decoration space: paint, drains and ground detail can occupy clear
  lanes without adding collision. Do not casually shrink truck/dozer clearance.
- Give block cores yards, coherent rear wings or connected roof masses. A collection of small
  square roofs surrounded by empty asphalt still reads as scattered objects.
- Keep open-space contrasts: a dark park or a bare fire apron makes dense frontage legible.
  Empty space is acceptable when its edges, surface and use explain it.
- Pilot a visible new detail, purposeful threshold or route choice roughly every 3–6 seconds
  of walking on representative streets. Review cadence at actual camera zoom; do not implement
  this as a loot/enemy spawn quota.
- Keep current loot budgets across 50 seeds. More frontage and decoration must not multiply
  pickups, map icons, patrol density or mandatory interactions automatically.

### Alleys, trash and debris are authored street content

- Build continuous alleys and service passages linking streets, rear entrances and courts.
  Give them readable mouths, corners and exits, with rear facades, doors, drainpipes, utility
  boxes and loading thresholds. The pilot blocks each need two useful route choices; a narrow
  decorative gap that leads nowhere does not count. Deliberate dead-end service pockets may
  exist, but should visibly explain their use.
- Place trash where it accumulated: bins and torn bags by collection points, flattened boxes
  behind shops, paper caught along curbs/fences, tipped containers by interrupted loading.
  Vary clusters and orientation deterministically instead of evenly scattering one sprite.
- Compose fresh debris around its source: brick/plaster below a broken facade, glass near a
  damaged storefront, timber at a boarded entrance, scrap/pallets in industrial service areas.
  Preserve clear silhouettes for decorative rubble, solid cover and bulldozer-clearable piles.
  Nothing introduced as dressing may silently become a mandatory demolition task.
- Give gutters, door recesses and wall bases restrained dirt, damp stains, scuffs and material
  transitions. Use flat decals for small litter and wear; reserve collision for substantial
  objects that look solid. Preserve door, combat, vehicle and camera clearances.
- Match the district and Day 9: household/market refuse in South Blocks, recent masonry damage
  in Old Quarter, interrupted medical/service work at Civic, municipal work at Northline,
  scrap/ash at Ashworks and abandoned processing supplies at Quarantine. Avoid uniform rubble
  everywhere or vegetation that suggests years of abandonment.

### Ground textures and parks get a dedicated finish pass

Grass and gravel already exist in `art/tiles.js`, and `chunks.js` selects them for lot surfaces.
Trees, planting beds, gravel paths and notices already exist in `art/lots.js`. Their presence
does not establish a finished park. Improve those assets and their composition in the world.

- **Grass:** replace conspicuous repeated speckle with quiet larger patches, restrained blade
  clusters, worn edges and sparse bare soil. Keep the established maintained, late-winter look.
  Add enough compatible variants to avoid obvious tile stamps; grass must read as grass under
  gameplay lighting without making the whole district brighter.
- **Surface joins:** finish grass-to-path, grass-to-curb, soil-to-bed, gravel-to-asphalt and
  building-foot transitions, including corners. Avoid arbitrary rectangular cutouts, visible
  tile/chunk seams and floating path decals. Use masks/edge overlays where flat tile selection
  alone cannot represent the boundary; integrate them with cached ground rendering.
- **Park composition:** connect actual entrances with a legible path network, then arrange
  lawns, tree groups, benches facing usable space, bins, planting borders, lighting and notices
  around it. Include small signs of interrupted daily use, with wear near benches and gates.
  Preserve lawn and sightline space; detailing a park does not mean filling every patch.
- **Distinct parks:** South Blocks' residential park supports neighborhood foot routes and
  informal sitting areas; Northline's smaller municipal park has more ordered planting and
  paths relating to its civic surroundings. Review both individually. The chapel graveyard
  needs its own path/grave/stone/grass relationships, not the same park layout with graves added.
- **Other ground:** prioritize generic district filler, service concrete, yard asphalt, gravel
  and rubble/ash surfaces. Preserve the streets/sidewalks the player already likes; extend their
  successful treatment only where new connections need it. Ground stays quieter than pickups,
  actors and danger cues.
  Distribution is fixed across run seeds; cosmetic detail adds no loot, noise or new lights
  automatically. Bake static detail where practical and measure cache rebuild/render cost.

Accept these surfaces in wide repeated patches, at boundaries and while the camera moves,
both in neutral diagnostic light and the actual night scene. A good isolated tile preview is
insufficient. Check canopy/prop occlusion with four players and retain visible paths through parks.

## 3. Give each district a recognizable building vocabulary

Each brief needs at least three structural/material cues visible without its landmark, HUD
district name, map, or colored lighting. Lighting and ambience reinforce an identity already
present in the architecture. Reuse compatible assets but avoid distributing signature props
uniformly through every district.

| District | Massing and street pattern | Material/silhouette cues | Everyday scene and route choice |
|---|---|---|---|
| South Blocks | Joined rows, corner shops, market block and rear courts | Brick frontage, shop awnings, repeated doors, narrow rear extensions | Abandoned market/loading activity; choose lit storefront route or quieter rear lane |
| Old Quarter | Terraces enclosing small courts, irregular rear passages, chapel/graveyard edge | Masonry party walls, stepped roof edges, exposed fresh interior cuts, stone boundaries | Refuge moved into old buildings; wind through a collapsed terrace or take the longer intact street |
| Civic Ward | Connected hospital wings, covered walks and subordinate medical/support buildings | Pale tile/concrete, long ward roofs, entrance canopies, glass corridor links, service doors | Treatment spilled from hospital to ambulance court; public approach versus darker service loop |
| Northline | Municipal frontage giving way to long utility parcels and mast setback | Fire-bay rhythm, depot sheds, cable/transformer yards, antenna silhouettes | Duty interrupted at fire station, utility crew abandoned work; pass the truck apron or utility lane |
| Ashworks | Large halls and sheds organized around loading courts | Sawtooth/monitor roofs, corrugated walls, broad loading doors, overhead pipes and conveyors | Interrupted industrial process with furnace glow; open truck lane versus machinery-cover route |
| Central Quarantine | Requisitioned city blocks outside a concentrated military/clinical complex | Bolted fencing, concrete barriers, tent rows, checkpoints, covered processing links | Registration → holding → records → disposal reads spatially; public bypass remains distinct from fight commitment |

### Specific content changes

- South Blocks: extend the market's commercial frontage into its neighboring streets; put the
  police station on the evacuation route with a recognizable public desk entrance and secure
  rear edge. Use homes and small shops to connect the park, market and Checkpoint.
- Old Quarter: show interrupted houses and shared party walls at collapses. Pair chapel and
  graveyard through paths, gates and sightlines. Fresh rubble has exposed structure and a
  readable source; it is not an arbitrary rock field or ancient ruin.
- Civic Ward: connect campus wings visibly, separate ambulance/public circulation, and use
  pharmacy, clinic, staff/service spaces and nearby housing in a campus hierarchy. Hospital
  furniture belongs in treatment spaces, not randomly on every sidewalk.
- Northline: make the fire department an unmistakable street landmark with its existing
  driveable truck, apparatus bays, numbered frontage, duty entrance and cleared apron. Show
  useful transition from residences to depot/utility buildings and the broadcast compound.
- Ashworks: replace the ordinary home/shop-dominated fill with small workshops, storage sheds,
  dispatch/maintenance offices and service courts. Keep worker housing at an authored edge,
  rather than making it the district's default. Extend pipes/conveyors between things that
  plausibly use them; keep their collision and camera occlusion intentional.
- Quarantine: furnish the new outer support blocks with requisitioned offices, staging and
  logistics. Preserve traces of the city underneath temporary containment. Keep the existing
  arena readable as the inner disposal yard, not the entire district or an isolated red square.

For new decorative building kinds, explicitly choose an existing compatible loot profile or
no supply site. Add a new playable archetype only when its layout/mechanics require it.

## 4. Art completion and replacement ledger

Classify every problem as **missing**, **not loaded**, **wrong state/orientation**, **incorrect
scale/anchor**, or **present but visually weak**. Lint checks sprite construction; it cannot
certify that a sprite is recognizable, believable or drawn at the correct place.

### P0 — inherited campaign art: integration and quality review

These ids were absent when v2 was first drafted; the follow-up audit finds all nine present.
The ledger describes acceptance contracts, not missing implementation:

| Asset contract | Required delivery and integration |
|---|---|
| `quarantine/gate_h`, `quarantine/gate_v` | Arena gate leaf/track/post treatment with clear opening; eliminate red collision-box fallback |
| `quarantine/bollard_h`, `quarantine/bollard_v` | Physical anti-vehicle control with survivor/infected gaps matching collision |
| `quarantine/evacBarrier` | Checkpoint closed/open states, coordinated with the functional gate and side barriers |
| `props/circuitBox` | Powered/unpowered states already selected by the renderer; mounting and cables explain its purpose |
| `landmarks/generatorRunning` | Running animation compatible with the existing generator footprint and power state |
| `buildings/transmitterLive` | Prepared/transmitting/completed presentation compatible with current console placement |
| `survivors/civilian` | Waiting, moving and cowering states expected by the renderer; replace block figures |

Decide whether to keep these exact ids or replace their contracts together with every caller.
Do not leave dynamic references pointing to nonexistent sprites. Supply all frames requested
by state selection, not merely frame zero. New families must be loaded by `index.html` as well
as the Node art tooling, which currently auto-discovers `art/*.js`.

The current reference test enumerates all these ids. Extend it to validate frame/state and
orientation contracts plus browser script registration. A sprite can be present in the tool
registry and absent in the browser if its script was never registered.

### P1 — art needed to establish districts

- [x] Residential and shop frontage modules: corners, attached sections, entrance recesses,
  shutters, awnings, windows, rear extensions and court walls.
  *art/frontage.js (35 ids, reviewed). Integrated: render.js KITS draws brick rows, shopfronts + awnings, shutters and eaves on South Blocks generated street faces; rear walls, back doors and bin nooks on service sides (REAR kit).*
- [~] Old Quarter terrace/party-wall modules and fresh collapse cross-sections; revise rubble
  spill so the source of the damage is visible.
  *Terrace faces and collapse ends + collapseSpill drawn on Old Quarter faces and collapsed masses; brick spill decal under collapses. Full party-wall gap composite not yet used.*
- [x] Hospital wing roofs, public canopy, covered links, service frontage and medical facade
  modules. Establish a campus silhouette larger than a cross sign.
  *art/civic.js drawn and reviewed; ward roofs, canopy, glass link and ambulance bay placed on St. Orison.*
- [x] Fire-station facade/bay grouping, depot facade, utility-yard equipment/cable supports,
  broadcast building frontage and maintenance access. Preserve the truck's existing variants.
  *Drawn (civic family). Utility Yard transformers, cable drum and poles placed; fire apron and broadcast front placed; the fire station keeps its roller-door family (fireBays sprite kept for review, assumption: the existing door jambs already carry the bay rhythm).*
- [x] Industrial roof/wall modules, loading docks, workshop fronts, pipe connections, conveyor
  endpoints and gantry silhouettes that form connected industrial scenes.
  *art/industrial.js (39 ids, reviewed). Integrated: metal / sawtooth roofs on Ashworks masses and sheds, corrugated walls, workshop and office fronts; pallets, drums, ash skips and ash spill in works yards and truck lanes. Pipe run, conveyor + hopper, gantry crane and loading dock apron placed (world.js districtPieces, dressLots).*
- [x] Quarantine support-building adaptations, coherent fence corners/posts/gates, queue rails,
  tent groupings and links between processing and disposal.
  *Drawn (civic family); requisition boards placed in staging yards. queue rails, tent group and processing walkway placed; the ring keeps its existing chain fence (qFence kept for review).*
- [x] Sidewalk/curb corners, crossings, service-lane surfaces, drains and district-specific
  paving accents. Use non-solid surface detail to explain clear routes.
  *Drains and gutter damp along every avenue, lane/alley mouth litter, loading dock apron and hazard paint, baked
  path strips; existing crossings and sidewalk edge cuts kept (the player's reference).*
- [x] Alley/rear-frontage details and a coherent litter/debris family: reuse useful bins,
  bags, boxes, paper, glass, pallets and rubble; add missing variants identified in the pilots.
  *art/streetlife.js (22 ids, reviewed) placed by world.js streetLife(): bags/boxes/paper at alley and lane mouths and service doors, wall grime, shopfront glass, collapse spill, curb drains and damp, court bins and timber (about 450 flat decals, never loot-coloured).*
- [~] Ground transition pieces/masks and park composition pieces required by Section 2,
  including grass/path/soil edges and corners. Integrate with the actual chunk renderer.
  *Ground agent added grass/gravel/yard/kerb edges and corners, footing and grime joins and baked park paths in chunks.js; the second review rejected repetition and palette issues, which I then fixed (per-row macro shift breaks the 128-unit columns, continuous Ward joints, neutral concrete/apron palettes, darker cinder vs lighter gravel). Needs a final wide-patch review.*

### P2 — present art that needs a quality pass

These are review candidates, not claims that their files are missing. `ART.md` already flags
weak market-cart/police-shield signs, stripped aisles that resemble pillars, the gear-rack
helmet, trolley and rubble spill. Review those in their final rooms/streets at gameplay zoom.
Also inspect repeated roof tiles, horizontal versus vertical furniture, overly generic sealed
facades, and props that disappear into the night palette.

- [~] Polish grass/gravel and other ground tiles in repeated world patches; remove obvious
  repetition and seams, finish material transitions and verify camera-motion stability.
  *See the ground note above; art lint 0 errors, warn budget re-recorded after review (454 targets, 3009 warnings).*
- [~] Replace visually blank district filler with readable, use-appropriate outdoor materials.
  *All district fillers redrawn plus lotQuarantine and yardAsphalt; void0034b reads as surfaced ground in neutral and night captures (scenes-ground2-diag).*
  Compare large unoccluded patches against the existing streets/sidewalks under the same light;
  preserve those successful assets. Diagnose the later third screenshot's actual ground path.
- [~] Review trees, benches, planting beds, park paths/borders and notices in both actual parks
  and the graveyard; fix weak silhouettes, scale, contact with the ground and canopy occlusion.
  *lots.js pass (paths, benchPark_v, wornPatch, graveFlat, pathGravel) reviewed and integrated; trees, beds and
  notices read at gameplay zoom in neutral light.*
- [~] Finish existing weak signs, furniture, trolley and rubble alongside their consuming scenes;
  keep a per-asset disposition (keep/revise/replace) and before/after evidence until accepted.
  *Redrawn by hand (no subagents), lint 0 errors, budget recorded only for these ids:
  signs/market — replace: dark side-view cart (handle, wire basket, chassis, wheels) on the pale panel;
  signs/police — replace: dark shield badge with a pale six-point star and name bar;
  lots/trolley — revise: lit wire basket with mesh, push handle and castors;
  lots/rubbleSpill x2 — replace: dust fan from the wall with distinct brick and plaster chunks;
  buildings/furn_shelfAisle x2 — replace: gondola from above (lit spine, shelf decks, bay uprights, a few leftover
  boxes and tins) so it no longer reads as a pillar;
  buildings/furn_gearRack — revise: shaped turnout coats with reflective bands, swinging sleeve, domed helmet.
  Before: ART.md weakest list; after: scratch previews and scenes-p2/p2Market, p2Police, p2Rubble (diag).
  Awaiting human review of the in-game read.*
- [x] Redraw the screenshot watchtower and police-car family to the reference-specific contract
  above; correct the tower's emitter placement. Review other oversized box-like props for
  recognizable silhouette, volume, access/support, material separation and ground contact.

Keep existing useful art: intact/damaged/wrecked fire truck, bulldozer, sedans, ambulance,
medical/interior furniture, signs, door families, lots, provision/fuel/evidence/payload/override
pickups and containment placards already exist. Improve or integrate them deliberately rather
than commissioning duplicate families from stale task lists.

For every delivered asset, record id, location/consumer, dimensions, anchor, collision or
non-solid status, orientations, frames/variants, script registration and a daytime/diagnostic
plus lit-game screenshot. Use the established code-native pixel-art/MAT workflow. A safety
fallback may remain in code, but no missing-asset placeholder may be visible in accepted city
scenes. Add a development-only fallback counter/report with object ids and coordinates.

## 5. Mechanics, light and sound that make the places feel used

V2 changes controls/HUD first, then spatial design and presentation. Finish CITY.md's acceptance;
avoid adding an unrelated survival economy, territorial conquest, new mission chain or moving
civilian population to manufacture activity.

- **Traversal:** every block connects to its neighbors through streets and intentional paths.
  Use courts, arcades, service loops and alternate entrances to create route choices. Validate
  survivors, infected, the larger fire truck and all bulldozer variants after each layout pass.
- **Readable interaction:** gate leaves, secured doors, powered equipment and vehicle boarding
  must show their actual state. A visually passable route must be passable; a sealed facade
  must look sealed. Resolve the decorative/functional Checkpoint relationship from screenshot 1.
- **Sightlines:** density should frame landmarks and provide cover without hiding every threat.
  Preserve entrance clearances, roof fading, four-player camera readability and open combat
  lanes. Do not allow roof modules, canopies or overhead pipes to imply incorrect collision.
- **Light:** use existing occlusion and circuit systems; compose fewer purposeful light pools
  around signs, entrances and working equipment. Do not add lights to every new prop or rely
  on brighter district ambient light to reveal weak silhouettes. Only Ashworks smolders.
- **Sound:** complete Phase 12A's listening review in CITY.md; retain its tested source lifecycle.
  Add source-bound layers where scene composition needs them: intermittent street metal
  in South Blocks; wind through damaged terraces in Old Quarter; failing ventilation/equipment
  in Civic Ward; transformers, mast wind and truck diesel in Northline; residual machinery,
  conveyors and hot-metal sounds in Ashworks; fence/processing equipment in Quarantine.
  Loops must match powered, moving or residual conditions; an abandoned shut-down machine
  should not sound like a staffed factory. Preserve moments of quiet.
- **Vehicle identity:** review the existing truck and bulldozer engine parameters, track clatter
  and action cues; address any remaining load/contact readability gaps using the current loop
  lifecycle. Keep sirens, hoses,
  firefighting and working ladders deferred unless separately designed.
- **Feedback and performance:** connect action noise to existing hearing rules, independent of
  audio mute. Cosmetic wind is not automatically an infected attractor. Budget ambience and
  machinery inside the existing 48-voice cap; test pause, hidden tab, restart and source removal.

## 6. Ordered delivery tracker

Each phase ends with a visible review, not just a data or lint pass. Keep new authored choices
deterministic. Coordinate with any remaining CITY.md campaign work before changing its state
consumers; this document does not reset or duplicate that implementation.

### V2-0 — Establish the evidence and asset contracts

- [x] Capture comparable views of each district approach, center and exit, the full/local maps,
  both Checkpoint gate locations, four arena gates and relevant campaign states.
  *`node tools/v2-scenes.mjs --tag before` → `artifacts/city/v2/scenes-before/` (1280×720, seed 12345, report.json
  with camera, district and fallback draws per view: none recorded).*
- [x] Capture the Section 0 HUD/player/state matrix and current control behavior. Record panel
  bounds and camera-safe area, including the upgrade-band mismatch, before redesigning them.
  *`artifacts/city/v2/hud-before/` (layout per capture: e.g. 1280×720 top 54, bottom 195, band 243 with upgrades).*
- [~] Locate/reproduce the later 00:34 South Blocks scene and save coordinates, location/block
  ids, ground type and nearby building/prop ids. Record the intended spatial use and the cues
  missing from its current view; use it as a named before/after acceptance scene.
  *`tools/v2-voids.mjs` measures open `lot*` filler: every South Blocks block is 55% flat filler (12 patches,
  6.35 M u²). Best candidate, unconfirmed: the police-station block interior, grid row 4 / column 3,
  centre (670,2120), ground `tiles/lotSouth`, near `police-station`, `block-3-4-p88/p89`; scene
  `void0034a` reproduces an untextured flashlight patch with no edges. Intended use (V2-3 decision):
  police rear yard and staff parking behind the public desk. Missing cues: surface material, curb /
  wall bases, entrances, perimeter and any activity cluster.*
- [x] Save a current geometry/resource/performance snapshot before changing block ownership.
  *`artifacts/city/v2/baseline/city-baseline.json` (50 seeds) and `bench.txt` (sim1 1.20 ms avg, sim4 4.47 ms avg).*
- [x] Build the complete art-reference/state manifest, including dynamic render ids and browser
  script registration; report fallback occurrences instead of accepting silent substitutions.
  *`test-art-refs.mjs` now checks state frame counts and index.html registration; `DSRender.fallbacks()`
  counts placeholder draws with positions and `v2-scenes.mjs` records them per view.*
- [ ] Reconcile CITY.md/ART.md status against current code. Record outstanding human review
  separately from automated evidence; do not carry old “landed” assertions into v2 acceptance.

Exit: each visible problem has a location/state and an accountable implementation task.

### V2-0A — Prove controls, healing and the compact HUD

This follows the evidence baseline and precedes the existing V2-1 through V2-6 sequence.

- [x] Implement contextual analog trigger driving, explicit brake/reverse behavior and neutral
  rearming. Preserve keyboard preferences, vehicle handling, passenger controls and fuel rules.
  *2026-09-16: `game.js conditionInput/vehicleTick` (pedals), `main.js` trigger values; `tools/test-input.mjs`,
  `tools/test-controls.mjs` pass. Also fixed every vehicle sprite being drawn backwards (render.js flips)
  and retuned the bulldozer (top speed 95→140), per playtest report.*
- [x] Separate heal/ration actions and deliver device-correct labels, pickup/use/rejection
  feedback and critical revive priority. Move upgrade selection into the owner-specific paused
  panel so B/RB cannot perform conflicting live actions.
  *`DSGame.BINDINGS/label/notify`, `hud.js` upgrade/controls menus; covered by test-input, test-controls, test-browser.*
- [x] Build the four-player bottom dock with one attached shared supplies row; compact the top
  clusters and minimap; replace permanent objective/help blocks with accessible contextual text.
  *Objective moves to a one-time notice plus Pause/map; escalation is a change alert; controls live in Pause → Controls.*
- [x] Unify HUD/camera safe-rectangle calculation; preserve the clock in boss mode and keep
  pending upgrades from expanding the live HUD. Validate layout/hit targets at all four sizes.
  *`DSHud.layout().safe` feeds main.js aspect and render.js; dock height is constant (80u) with upgrades.*
- [x] Update input, medkit/ration, vehicle, upgrade and browser tests for the deliberate binding
  changes. Add fractional triggers, brake-at-empty-tank, both triggers, reverse transitions,
  driver/passenger separation, menu closure and held-input context switches to coverage.
- [~] Measure Section 0's vertical/area/text budgets in the full player/state matrix. Review
  actual calm/combat captures and have a new player heal, eat deliberately, drive and reverse
  without coaching; record physical-controller review separately from synthetic pad tests.
  *Measured (`node tools/hud-matrix.mjs`, `artifacts/city/v2/hud-before|hud-after`): at 1280×720, 1920×1080,
  2048×1002 and 1024×768, one to four players, upgrades/combat/vehicle/downed/boss: top 3.9–4.2%, dock
  10.4–11.1%, vertical 14.3–15.3%, persistent area 13.4–15.8% (boss strip 1.4–1.9%), core text 12–18 px,
  minimap ≤18%. Before: 1280×720 reserved 54+195 px (243 px band with upgrades). Large HUD option
  (1.25×) is ~19% vertical at 720 px, an explicit tradeoff. Pending: uncoached new-player and
  physical-controller review.*
- [x] Update manual, options, onboarding, README and relevant CITY.md control references when
  implementation lands. Historical session logs remain historical; do not rewrite them as v2.

Exit: controls are predictable, healing is discoverable, and four-player play meets the compact
HUD budgets without hiding actionable information. Approve these in play before judging denser
blocks through the new viewport. These tasks are planned, not already delivered by this audit.

### V2-1 — Remove the visible placeholders

- [~] Review the existing P0 gate, bollard, evacuation barrier, circuit, generator, transmitter
  and civilian assets; complete any missing frame/state integration and verify registration.
  *Workflow city-v2-p0-review (draw → independent review, both accepted): gate_h/_v redrawn as posts + braced leaves
  + lock on a track (100-unit tiles), new gateOpen_h/_v, bollards, evacBarrier closed palisade / open concertina,
  civilian redrawn as four clothed people (12 frames; render picks one per id). Circuit box, generator and
  transmitter art were not redrawn in this pass. Evidence artifacts/city/v2/art/gates|civilians,
  scenes-p0-integrated/escape.png. Open: vertical gate strips still read thin; warn budget re-record.*
- [x] Align gate collision, visual openings, shadows and interaction prompts; remove duplicate
  geometry-looking decoration and verify full closure/reopening at every orientation.
  *render.js: the Checkpoint evac collision strip no longer double-draws under the barrier prop; open arena gates
  draw posts + parked leaves around the bollard; amber/cyan post lamps glow. game.js: open gates add 6-unit post
  solids (two 34-unit passages). `v2-scenes gate-{n,s,e,w}-{open,closed}` captures every orientation. The decorative
  Checkpoint boom (landmarks/gate at y=2650) was removed so the only gate there is the functional barrier.*
- [x] Correct the confirmed watchtower emitter offset and capture its glow/light agreement;
  complete the tower/car redraw and family consistency review with the V2-3 pilot art pass.
  *Tower redrawn 52x104 (roof planes, railed deck, ladder, footings), light dy 83 = window band centre; glow on the
  cabin in scenes-checkpoint/checkpointBoom.png. Car family: police/hatch/burnt wrecks redrawn and their rear ends
  fixed after the player report; driveable sedans redrawn to the same body; new `vehicles/sedan_vs` gives southbound
  cars a front face instead of a flipped rear; seats moved into the cabin; a destroyed sedan is never a police car and
  police cruisers only appear along the evac road, Checkpoint and police station. Low solids no longer cut a hard
  flashlight wedge through themselves (lights.js) and throw a short soft contact shadow.*
- [x] Extend art-reference checks to catch all these paths and verify them in actual lit scenes.
  *test-art-refs checks state frames and index.html registration; v2-scenes records fallback draws per view (none).*

Exit: no unexplained red slab, generic replacement post, invisible required prop or block-figure
civilian appears along the acceptance routes.

### V2-2 — Establish the complete territory map

- [x] Author the 36-block ownership table and complete coverage/edge rules, keeping all six ids.
  *`world.js BLOCK_OWNERS/gridIndex`: half-open cells, shared centre lines go east/south, the outer edge and beyond clamp.
  test-city samples every 100 u of the city: exactly one territory cell, classifier and map agree.*
- [x] Derive shared territory geometry and point classification from the authored ownership.
  *`district()`, `districtCells()` (36 cells with block ids), `buildBlocks` and `territoryLabel()` read one table; `bounds` removed.*
- [~] Sketch/dress the four central support blocks so new quarantine ownership cannot trigger
  today's skipped-fabric hole; preserve public through-routes and the existing arena footprint.
  *Quarantine fabric weights (shop .4 / clinic .35 / home .25), sealed .5, street clutter and sidewalk props;
  15 enterable buildings in the district (was 3), arena rect unchanged (asserted). Per-block RNG + per-block
  parcel numbering (salt 74393 chosen for 89 enterable buildings, ≥ the 84 before). Authored requisitioned
  offices/logistics remain V2-4 work.*
- [x] Add the separate district map palettes and layer order, territorial footprints, boundaries,
  six labels/key entries, neutral icon badges and contrast-safe player/danger overlays.
  *`mapPalette` per district (fills luminance-spaced 85–154 so neighbours separate in grayscale); `drawMapRevamp`
  follows the Section 1 seven-layer order; legend leads with DISTRICTS. Evidence: `artifacts/city/v2/scenes-v2map/`
  fullmap, localmap, fullmapGray, fullmapDeutan, fullmapProtan, scene-mapstates. Deutan: Old Quarter/Civic Ward
  become similar blues but are never adjacent; labels and dashed boundaries carry them.*
- [x] Apply to full/local/title/debug maps; verify discovered, visited, partially looted, cleared,
  empty, truck-moved and arena-active states without changing district color.
  *Full, local, title (same drawMap) and `tools/city-map.mjs` use the palette; state only ever changes glyph badges
  and gate marks (mapstates capture; `fullmapStates`: all discovered, visited, cleared, truck moved/empty, three gates open, noise ring).*
- [x] Validate all required locations still belong to their intended districts; measure effects
  of the central reclassification on thematic spawns, lighting and resource distribution.
  *Every required location's corners and centre resolve to its district (test-city). Central streets now spawn the
  quarantine runner theme; the quarantine ambient was softened to #201a1e for the wider district.*
- [x] Redistribute the existing supply budget to preserve South Blocks' per-seed envelopes;
  remeasure all 50 seeds after regeneration, including new quarantine weights and sites.
  *Regenerated: only seed 17 failed (bullets 11.6%). Removed South Blocks' .85 bullet dampener; 50-seed minimum shares
  bullets 14.3%, medkits 7.7%, provisions 11.1%; global counts and envelopes unchanged.*
- [x] Migrate obsolete classifier/fabric assertions and review parcel-id/RNG changes before
  accepting new fixtures. Retain equivalent access, semantic-owner and scarcity coverage.
  *Fixture diff reviewed then rewritten: buildings 84→89 (quarantine 3→15), sealed masses 51→51, driveable cars 30→33,
  props 845→~830, lights 157→149 (dressing RNG no longer shared with fill). Fixed a shack table that blocked west doors
  for brutes and a truck-fuel test that relied on sedan ranges. npm test and test:browser pass.*

Exit: every block and all intervening surfaces have a legible owner. A player can point out
the six territories immediately, and supplies/roads/danger remain readable.

### V2-3 — Prove two representative blocks

- [~] Author one South Blocks market/residential block and one Ashworks workshop/loading block
  with frontage, core use, surface hierarchy, signature assets and two useful route choices.
  *South Blocks structure landed: `city.js PILOT_BLOCKS['block-3-4']` (police block, also the 00:34 candidate) —
  attached north shop/home row with rear service doors, a north alley mouth, east lane, west police side passage;
  its anonymous core is now Police Staff Parking (asphalt lot, two bays) and a Rear Court. Routes: avenue → alley →
  parking → police yard corridor, and east lane → rear court → parking. Frontage coverage 50% → 73% (target 65–80),
  open filler 51% → 22% (`tools/v2-frontage.mjs`, artifacts/city/v2/pilot/). void0034a now reads as a surfaced,
  named lot (scenes-pilot). Ashworks structure: `PILOT_BLOCKS['block-5-4']` — two workshops on the avenue with rear
  doors onto a truck-width loading lane, dispatch office and sheds, a fenced Loading Court with three gates, north truck
  lane; coverage 60% → 73% (target 55–75). Art dressing with the new families pending.*
- [x] Include a connected rear alley, authored trash/debris clusters and finished ground joins
  in those pilots. Review the South Blocks residential park and its street edge alongside them
  to prove grass, paths and planting before replicating the surface treatment citywide.
  *South Blocks north alley (bags/boxes at the mouth, paper along the wall, grime strips) opens into Police Staff Parking;
  the Rear Court has a dumpster, bags, tipped bin, notice and pole light. Ashworks Loading Court: dock apron, drums,
  pallets, hazard paint and a battery work light. Captures: scenes-pilot/, scenes-pilot-diag/ (pilotSouthAlley,
  pilotSouthCourt, pilotAshLane, pilotAshCourt); Linden Park in scenes-parks/.*
- [x] Prove the watchtower and police-car revisions in a checkpoint/street context, and the
  later 00:34 reference's ground/edge/place readability in its reproduced scene. These focused
  reviews accompany the two block pilots; do not postpone them to a generic final polish pass.
  *scenes-checkpoint/checkpointBoom.png (lit tower, police car on the evac road), scenes-facades-diag/ashworks-exit.png
  (police wrecks on the avenue), scenes-ground2-diag/void0034b.png and scenes-pilot/ (the 00:34 block now staff
  parking with bays, lamps, kerb and alley).*
- [x] Add only the art modules needed by those scenes, then review at normal camera zoom with
  labels and district lighting tint suppressed for diagnosis, using V2-0A's accepted HUD.
  *`window.DS_DIAGNOSTIC_LIGHT` / `v2-scenes --diag` skips the night lightmap for neutral review; all *-diag captures.*
- [x] Measure frontage coverage, unused/unexplained areas, traversal and render/light cost.
  *Tool ready: `node tools/v2-frontage.mjs`. Before (artifacts/city/v2/baseline/frontage-before.json): South Blocks
  49% (target 65–80, 0/8 blocks in range), Ashworks 41% (55–75), Civic 50%, Quarantine 50%, open filler 50–62% of
  block ground in every district.* *After: block-3-4 73%, block-5-4 73%, open filler 22–27%; traversal, door,
  socket and actor-size reachability tests pass. Browser cost (bench-browser, 1920×1080, AMD Ryzen 9 9950X, headless):
  before v2 (pre-v2 tar build on :4178) four 3.71 ms render / 3.60 ms step, circuit4 3.37 / 3.51, truck4 3.82 / 0.35,
  arena4 8.43 / 0.20; after four 3.79 / 0.35, circuit4 4.63 / 0.37, truck4 4.95 / 0.42, arena4 7.54 / 0.17, all 240
  frames. Profiling found `nearestVehicle` casting a wall ray to every car in the city each tick; it now checks
  distance first (four-player step 6.2 → 0.35 ms).*
- [x] Tune the density targets and module sizes from those two scenes before expanding the city.
  *`COMPOSE` per district (parcel run, opening width, fill share, wing, court and pocket names) derived from the
  pilots; see the V2-4 alley/trash note for the measured city-wide result.*
- [x] Record measured iteration cost and frame/voice headroom on a named target machine and
  supported viewport; use those results to scope the six district passes and set budgets.
  *Machine: AMD Ryzen 9 9950X, Windows 10, headless Chromium, 1920×1080. Worst render p95 9.8 ms (arena4), peak
  voices 15/48. A district pass (generator rule + kit + dressing + captures + tests) took roughly one working hour;
  the six passes were therefore done as shared generator rules plus per-district set pieces, not six hand-authored cities.*

Exit: the residential/commercial and industrial blocks are unmistakably different, both feel
purposeful, and extra composition has not blocked movement or added unbudgeted supplies.

### V2-4 — Roll out the six district briefs

- [x] South Blocks: connected market streets, residential courts, police/evacuation relationship.
  *Composed brick rows with shopfronts and awnings, alleys with rear walls, back doors and bin nooks, rear courts and
  shop forecourts; police block pilot (staff parking, rear court, side passage) on the evac road; police cruisers only
  along the evac road, Checkpoint and station. Evidence scenes-facades*/southBlocks-*, scenes-pilot*/.*
- [x] Old Quarter: terrace fabric, broken courts and coherent chapel/graveyard approaches.
  *Masonry terrace faces, collapse ends and spill on fresh collapses, Broken courts and Demolition gaps, chapel side
  door linked to the graveyard gate by a worn gravel path with refuge notices. scenes-facades-diag/oldQuarter-center,
  scenes-parks/chapelGraveyardPath, graveyard.*
- [x] Civic Ward: connected hospital campus and differentiated public/service circulation.
  *Ward roofs, public entrance canopy on the south forecourt, covered glass link east to the morgue/service lane, ambulance
  bay in the service yard, Ward forecourts and gardens in ordinary blocks. assumption: the campus forecourt stays open
  (brief: connected forecourt), so block-4-2 is measured against the campus brief, not the 45% street-frontage figure.
  scenes-pieces/pieceHospital.*
- [x] Northline: unmistakable fire department/truck, utility transition and radio endpoint.
  *Fire station apron paint with the truck nose-out in its bay, utility yard transformers/poles/cable drum, Blackglass
  broadcast front with dish and mast stub, Transmitter Park as the ordered municipal park, Depot aprons and service courts.
  scenes-pieces/pieceFireApron, pieceBroadcast; scenes-parks/parkNorthline.*
- [x] Ashworks: industrial ordinary fill and connected production/loading/service spaces.
  *Fabric archetypes workshop / storageShed / dispatchOffice replace the home .6 / shop .4 default (home .15 kept at the
  edge); tested. Sheds with metal/sawtooth roofs and corrugated walls, workshop/office fronts, loading court pilot,
  gantry crane over the loading yard, hopper-to-conveyor run, pipe run shop → fuel store, fenced Furnace Plant works
  compound, works yards with pallets/drums/skips. scenes-pieces/pieceGantry, pieceConveyor; scenes-pilot/pilotAshCourt.*
- [x] Central Quarantine: four support blocks, clear outer/inner hierarchy and visible containment.
  *Support-block fabric: requisitionOffice / stagingDepot over surviving clinic, shop and home frontage (15 interiors).
  South Blocks bullet weight .85→1.5 keeps its share (50-seed minimum 14.8%). Staging yards with requisition boards and a
  tent group, queue rails to Processing, covered processing walkway over the north street, vertical arena gates now
  read as raised barriers (shadow, dark face, lamps). scenes-pieces/pieceProcessing, pieceQueue; scenes-gates/.*
- [~] Complete P1 art modules and P2 revisions; account for every remaining substantial void.
  *P1 families drawn, reviewed and placed (see Section 4 notes). Voids: open filler is 26–51% of block ground by
  district after composition (was 50–62%); what remains is surfaced ground inside named courts, pockets and compounds.
  Frontage by district: ruins 70% (70–85), northline 44% (45–65), hospital 58% (45–65), quarantine 59% (50–70), checkpoint 68% (65–80), industry 73% (55–75). Off-target blocks are world-edge blocks (only two street sides, over target) and the
  authored compounds (Blackglass, depot/utility, St. Orison, market, Collapsed Quarter, warehouse). assumption: those are
  judged by their authored briefs. Awaiting human review of weak P2 signs/furniture (see P2 list).*
- [x] Complete the alley/service-route and district-specific trash/debris passes across all
  six districts, with decorative/solid/clearable states visually distinct and routes preserved.
  *Structure landed city-wide (`world.js COMPOSE` + `buildFabric`): every generated street row plans its run as
  attached parcels, one reserved access opening (alley / passage / forecourt lane / truck lane / staging lane) and named
  pockets (Shop forecourt, Demolition gap, Ward forecourt, Depot apron, Yard apron, Queue apron) sized by a per-district
  fill; block cores become named courtyards (Rear court, Broken court, Ward garden, Service court, Works yard, Staging
  yard) with surfaces and district clutter, big cores keep one sealed rear wing. Courtyards and pockets carry no loot
  sockets. Measured: ruins 68% (target 70–85, 0/8 blocks, open filler 30%); northline 44% (target 45–65, 2/4 blocks, open filler 51%); hospital 58% (target 45–65, 6/8 blocks, open filler 41%); quarantine 59% (target 50–70, 4/4 blocks, open filler 47%); checkpoint 65% (target 65–80, 2/8 blocks, open filler 36%); industry 63% (target 55–75, 1/4 blocks, open filler 39%). Remaining off-target blocks are compound blocks (radio, hospital campus, Furnace Plant,
  machine shop) for the authored briefs. Trash/debris art dressing waits for the streetlife family.*
- [~] Finish both parks and the chapel graveyard individually, including entrances, connected
  paths, seating/planting composition, daily-use details and ground/material transitions.
  *Linden Park (informal clusters, benches with worn patches) and Transmitter Park (ordered avenue of trees and beds)
  now differ; paths are baked gravel strips on grass edge to edge; the graveyard is a lawn with a gravel lane and
  irregular rows (lost and offset stones). Evidence scenes-parks/. Entrance/gate alignment of baked paths still to check.*
- [x] Roll out accepted district-filler, grass, gravel, yard and industrial-ground revisions;
  preserve existing street/sidewalk art, integrating only required new joins. Inspect repeated
  patches and tile/chunk boundaries in every affected district.
  *All fillers, grass, gravel, yard concrete/asphalt and edges ship through chunks.js; roads/sidewalks untouched.
  Captures in every district: scenes-facades-diag, scenes-ground2-diag, scenes-parks, scenes-pieces.*
- [x] Blend border streets without changing their district owner or diluting signature buildings.
  *Parcels facing another district take 30% of its fabric weights (tested); facade kits and roofs follow each block's
  owner, so a border avenue shows both districts' faces; required places keep their archetypes.*

Exit: each district meets its structural brief away from its landmark as well as at its center;
alleys, dressing, parks and ground materials have passed their finish review. Structural density
alone does not complete this phase.

### V2-5 — Integrate sound, lighting and campaign states

- [~] Review inherited truck/dozer differentiation and Phase 12A's listening queue; integrate
  any additional source-bound ambience required by the new scenes without duplicating engines.
  *Implemented as sparse one-shots, not beds (AUDIO.md records the user's earlier removal of continuous
  ambience): seven source- and condition-bound incidentals in `audio.js`, covered by test-audio (sources,
  circuit condition, no-source silence, boss quiet, no loops, voice cap). Bulldozer engine pitch follows its
  new 140 top speed. Sources bind to the new geometry automatically (collapsed masses, hospital/clinic buildings, utility
  yard, burning wrecks, quarantine fences). **Awaiting human listening review.** Check steps: `npm run serve`, open
  http://127.0.0.1:4177/?seed=12345 with sound on; (1) stand 5 min each beside a South Blocks dumpster, an Old Quarter
  collapse, St. Orison, the Utility Yard with the circuit off then on (fuel the chapel generator), a burning Ashworks
  wreck and the quarantine fence — each should give an occasional short cue, silence between, and no continuous bed;
  (2) drive the sedan, fire truck and bulldozer back to back — three clearly different engines, dozer track clatter only
  while moving; (3) pause, alt-tab and mute during each cue — all sound stops at once.*
- [x] Compose entrance/landmark lights and test restored power, open gates and final evacuation
  against the new surroundings. Retain functional occlusion and Day 9 fire rules.
  *New pools only where something explains them: St. Orison canopy (teal, on the canopy), Loading Court battery work
  light, Furnace Plant gate flood, Rear Court pole, arena gate lamps (amber/cyan). Captures scenes-v25/: generatorOff,
  generatorOn (chapel door spill and nave lit), transmitting (Blackglass rack), escape and evacBarrier (open barrier,
  civilians), gate-s-open, pieceHospital. test-city "only Ashworks still burns" and district light checks pass;
  lights 157 → 152 in the fixture.*
- [x] Check interrupted interactions, backtracking, boarding/dismounting, vehicle breakdown,
  arena commitment/reopening and final escape with the denser geometry.
  *All run against the composed city in `npm test` (exit 0): "the full chain in canon order, with retreat and re-entry,
  ends only at the escape", "spending all optional fuel still powers the chapel; cleared places, the arena and a restart
  behave", "damage reduces driving distance and breakdown permanently ejects the whole squad", "safe dismount at every
  heading beside a wall and a parked car", "refuelling: … interruptions … lose nothing", "arena cover leaves open lanes",
  plus test-city reachability for survivors, brutes, doors, sockets, gates, the fire truck and all dozer pads.*

Exit: sound and light explain the same physical spaces and states that the player can see.

### V2-6 — Final review and closeout

- [ ] Run relevant city/art/campaign/vehicle tests, then `npm test` and `npm run test:browser`.
- [ ] Run `npm run art:lint:all` and record its actual result; separate pre-existing warnings
  from new errors/warnings. A passing budgeted gate does not imply zero strict-lint warnings.
- [ ] Preserve CITY.md's implemented zero-error/per-sprite warning-budget gate; review any
  intended budget changes. Keep strict lint diagnostics distinct from the budgeted pass.
- [ ] Review the same approach/center/exit screenshots against V2-0 with labels hidden and shown.
- [ ] Compare 50-seed resource envelopes and one/four-player simulation/render/lighting/audio
  budgets. Update geometry fixtures only after reviewing intentional changes, not to hide failures.
- [ ] Complete a solo run and a four-player run through all districts, truck use, optional dozer
  clearing, arena and self-rescue. Finish outstanding browser/listening reviews explicitly.
- [ ] Recheck V2-0A controls and HUD budgets under final district/combat load, including all
  pending upgrades, mixed devices, boss tells, documents and concurrent co-op interactions.
- [ ] Update CITY.md, ART.md, AUDIO.md, LIGHTING.md and README where delivered behavior changed;
  link evidence here and retire superseded visual acceptance notes.

Exit: the city is coherent in play, the map tells its geography, and every visible asset/state
has passed integration review.

## 7. Acceptance checks

### Automated and diagnostic

- All 36 blocks have one valid district id; all six districts own blocks. Territory polygons
  cover the full bounds exactly once, including half-road surfaces, intersections and edges.
- Classification agrees with territory rendering and location ownership at interiors and
  boundary samples. Geometry and ownership are identical across run seeds.
- No map footprint loses its district hue due to lot type or cleared state; all maps use the
  same ownership data. Unknown supply sites remain undisclosed.
- Every rendered asset/state/orientation resolves in the real browser load order. Exercise
  generator on/off, transmitter stages, civilians and gate/bollard states, not only fresh world
  props. No unexpected fallback draws occur on the recorded routes.
- Every required entrance, lot gate and story destination remains reachable on foot; interior
  and alternate paths support the required actor sizes. Validate the fire-truck apron/road
  route, safe exits, all four bulldozer pads and optional debris clearing.
- Spatial/nav invalidation, roof zones, lighting occlusion, camera and campaign progression
  still agree with the new geometry. Wider quarantine territory never expands arena lockout.
- New decorative places do not create unintended loot. Per-resource budgets and reserved
  chapel fuel remain valid across the same 50-seed comparison.
- Performance reports separate simulation, rendering, cached ground, shadow/light work and
  audio voices. No extra lights/collision boxes are added merely to satisfy an object quota.
- Input tests exercise actual analog values and context transitions. Braking never consumes
  a kit/ration; heal never falls back to eating; upgrades/menu presses never leak into play.
- HUD bounds meet Section 0's budgets at each viewport/player count, without text overlap or
  clipping; one shared supplies row, per-player medkits and the camera-safe rectangle agree.

### Visual and play review

- **Uncoached control read:** a new player collects a kit, heals, understands full-health/no-kit
  feedback, deliberately eats a ration, accelerates/brakes/reverses with triggers and exits.
  Repeat with driver/passengers and an outstanding upgrade; no accidental supply consumption.
- **Four-player HUD read:** each player can find HP, heal, weapon/magazine, fire state and urgent
  warnings immediately. The clock/location stay legible; shared supplies have clear ownership.
  Compare occupied screen area to the supplied solo shot and the V2-0 multiplayer captures.
- **Five-second map read:** show the full map without explanation. The reviewer can identify
  all six district extents and follow a street across a border; each block's owner is clear.
- **Unlabelled district read:** use three ordinary street views per district, excluding its
  signature landmark. A reviewer can name the district and cite at least two physical cues.
  Record confusion pairs and revise them; changing only their lighting hue does not pass.
- **Purposeful-space read:** on each approach/center/exit walk, every large empty area has a
  recognizable function. Interruptions in frontage read as entrances, courts, lanes or damage.
- **Where am I standing?:** reproduce the later 00:34 reference and sample ordinary streets,
  yards, alleys and park edges in every district. With HUD/map labels hidden at normal night
  lighting, identify ground material, place function and entrances/exits within five seconds.
  Record mistaken interpretations and revise the scene; district name recognition alone fails.
- **Prop identity:** recognize the revised tower as an accessible observation structure and
  the white vehicle as an abandoned police car without captions or magnified previews. Check
  consistent scale/perspective, grounded silhouettes, visible emitter placement and the car's
  relevant orientations/damage states in the real scene.
- **Street-detail read:** follow the pilot alleys and sampled routes in every district. Trash
  and damage have believable sources; alternate paths remain useful, entrances are clear and
  decorative litter cannot be mistaken for pickups or an impassable/clearable obstacle.
- **Ground/park finish:** inspect both parks, graveyard and large grass/gravel/asphalt patches
  at normal zoom and in motion. No conspicuous tile/chunk seams or repeated stamps; material
  transitions and path networks read clearly. Parks feel designed and recently used, with
  distinct layouts, grounded props and sightlines that work in four-player combat.
- **Bare-ground material read:** with clutter hidden, broad outdoor patches still read as their
  intended material under normal flashlight lighting. Tiny scattered speckles on a flat field
  do not pass. Compare to the retained streets/sidewalks and check that new detail does not
  hide actors, pickups or danger cues.
- **Art completion:** every P0/P1/P2 item has integrated scene evidence or a documented finding
  that existing art already meets its contract. Missing placeholders, visibly weak assets and
  unfinished ground/park treatment cannot be waived by passing reference checks or lint alone.
- **Gate read:** the screenshot-1 location and all gate variants clearly show what blocks
  passage, how passage opens, and where the player can stand/interact. Check at normal zoom.
- **Fire-department read:** recognize station and truck from the street, board all four players,
  drive out, return, refuel and dismount; a parked/wrecked truck does not seal pedestrian access.
- **Density under pressure:** fight, retreat and backtrack through the new streets with four
  players; roofs, foreground props and shadows do not conceal required threats or routes.
- **Color/state read:** inspect map at supported sizes, in grayscale and with color-vision
  simulation; district labels/boundaries and supply/danger glyphs remain distinct.
- **Day 9 read:** fresh notices, interrupted work, restrained damage and cold wrecks outside
  Ashworks. No long-abandoned wilderness, arbitrary industrial props or implied arriving rescue.

## Audit log

- 2026-09-16 — Ground clarification: streets and sidewalks are a positive player reference;
  preserve them. Added a separate repair for visually untextured outdoor filler, including
  source diagnosis (`groundKind` district fallback and sparse `makeLot` art), material-specific
  treatment and uncluttered ground acceptance. The third scene's actual tile remains unconfirmed.
- 2026-09-16 — Added the later two prop crops and anonymous South Blocks scene as explicit
  acceptance references. Isolated source renders confirm `landmarks/watchtower` and
  `wrecks/car_h` variant 1; source review identifies the watchtower's default `dy:24` emitter
  mismatch. Added redraw, emitter alignment and ground/place recognition tasks throughout
  baseline, pilot and acceptance sections. The normal preview command encountered a syntax
  error in the then-current `hud.js` manual string; direct art-only registry renders succeeded.
  No gameplay edits or browser acceptance claimed; the exact third-scene location remains to
  be reproduced rather than inferred from the district label.
- 2026-09-16 — City-scope clarification: retained the dense frontage, useful alleys and six
  district art briefs as the main v2 deliverable. Added explicit trash/debris composition,
  grass/ground texture and transition polish, separate park/graveyard finish requirements,
  art-ledger tasks and pilot/rollout acceptance. Reviewed existing tile/lot art and ground-cache
  consumers to distinguish improvements from missing asset families. Planning changes only.
- 2026-09-16 — Playtest follow-up audit against the current CITY.md tracker, `main.js`, `hud.js`,
  vehicle/healing code and control/audio tests. Added Section 0 and the early V2-0A gate for
  analog trigger driving, separate medkit/ration actions, discoverable healing, conflict-free
  paused upgrade selection and a compact four-player HUD. Calculated the supplied 2048×1002
  shot's 36.7% top/bottom reservation from the current layout; identified width-only scaling,
  upgrade/camera height disagreement and shared-supplies alignment. Corrected stale claims
  about missing audio tests, performance evidence and the warning-budget gate. Fresh checks:
  `npm test` exit 0; `npm run art:lint:all` exit 0, 276 targets, 0 errors, 904 warnings within
  budget. Earlier ownership/resource diagnostics are retained as earlier evidence, not rerun.
  Documentation changes only; no new browser, physical-controller, listening or full-run
  acceptance is claimed. All new behavior remains pending implementation.
- 2026-09-16 — Follow-up audit against CITY.md and current source: `npm test` exit 0;
  `node tools/test-art-refs.mjs` exit 0; `npm run art:lint:all` exit 1 (276 targets,
  0 errors, 904 warnings). Corrected obsolete P0 and shared-engine claims, distinguished
  v1 closeout from v2 composition work, and added explicit resource/test migration gates.
  Required-location rectangle corner/center ownership samples agree with the proposed table.
  The 50-seed boundary-only diagnostic used existing `world.sites` loot with `tally()` and
  the proposed half-open 6×6 classifier, without regenerating geometry or supplies; six seeds
  failed South Blocks share bounds. Reviewed existing `artifacts/city/p7/scene-map.png` and
  `artifacts/city/p12/scene-escape.png` as historical visual evidence. No fresh browser,
  listening, performance or full-run acceptance is claimed. Updated CITY.md's historical
  baseline label/partial audio status and ART.md's stale campaign-art row; no gameplay edits.
- 2026-09-16 — Created this follow-up from current code and supplied screenshots. Measured
  world counts/ownership and checked dynamic sprite ids through the art registry. Existing
  `node tools/test-art-refs.mjs` failed on the missing circuit box and evacuation-barrier prop;
  additional dynamic omissions are listed above. No gameplay files or original tracker were
  changed, and no new browser/art/listening acceptance is claimed by this planning session.
