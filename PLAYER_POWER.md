# Player power — implementation tracker

> **This file is the source of truth for the player-power exploration.** Read the
> decisions, invariants, and current-code baseline before changing gameplay. Continue from
> the first unfinished item in the ordered tracker, and update both its checkbox and the
> session log when work lands.

Status key: `[ ]` not started · `[~]` partially implemented · `[x]` landed and verified

An implementation item is `[x]` only when its code, applicable automated checks, and listed
browser or play check are complete, with evidence in the session log. Use `[~]` when a mechanic
exists but one of those checks is still missing, and record what remains. Documentation-only
items may be checked after source review. Do not mark a whole phase complete because its data,
art, or isolated prototype exists.

This tracker is a design and sequencing plan. It does not by itself authorize gameplay
implementation. All selected features are currently unimplemented. Proposed behaviors and
numerical values remain open until Phase 0 records a decision or a later playtest changes it.

## Progress summary

| Order | Workstream | Status | Exit condition |
|---:|---|:---:|---|
| 0 | Decisions, baseline, and test harness | `[ ]` | Open rules are resolved for the first prototype and current combat is measured |
| 1 | Carried capacity and co-op drop-in | `[ ]` | Solo carries four, co-op carries three, and joining never destroys a weapon |
| 2 | Shotgun cleave | `[ ]` | Short-range pellets reliably damage aligned targets without passing through solids |
| 3 | Duplicate-drop and attachment framework | `[ ]` | A duplicate can preview and add one persistent ordered upgrade to any carried match |
| 4 | Grenade launcher foundation | `[ ]` | The launcher, projectile, blast, ammo, and base presentation work without attachments |
| 5 | Attachment catalog | `[ ]` | Every selected weapon has a complete, tested fixed progression with readable effects |
| 6 | Carryable turrets | `[ ]` | Each survivor can deploy, use, resupply, retrieve, and retain one turret |
| 7 | Armor layers | `[ ]` | Armor consistently absorbs damage before health and communicates damage and break states |
| 8 | Loot and run-economy integration | `[ ]` | New power appears through scarcity-safe city loot and remains shareable in co-op |
| 9 | HUD, controls, art, audio, and documentation | `[ ]` | Every new state and action is readable with keyboard, Xbox, and PlayStation input |
| 10 | Combined balance and final review | `[ ]` | The systems improve recovery and preparation without removing run pressure |

Adrenaline is outside the ordered tracker. See [Deferred concept — adrenaline](#deferred-concept--adrenaline).

---

## Goal

Preserve the game's difficulty while giving solo players more ways to fight through pressure.
A run should include opportunities to clear space, prepare a defensive position, and become
stronger through scavenging instead of eventually relying on constant evasion.

The selected directions are shotgun cleave, weapon attachments from duplicate drops,
carryable turrets, a grenade launcher, and armor layers. The grenade launcher replaces the
earlier Molotov concept. Solo weapon capacity supports those tools without giving every co-op
survivor the same breadth.

## Non-negotiable invariants

- **Solo breadth and co-op specialization are different.** One joined survivor may carry four
  weapons. A squad of two to four may carry three per survivor and divide roles between players.
- **The backup pistol is permanent and separate.** It has unlimited ammunition and never
  consumes a carried-weapon slot.
- **A grenade launcher is a carried weapon.** It consumes a normal weapon slot and uses scarce,
  dedicated grenade ammunition.
- **A co-op join never silently destroys gear.** If the capacity falls below a survivor's
  inventory, play pauses until that survivor explicitly chooses a weapon to drop.
- **A dropped or transferred weapon keeps its identity.** Weapon type, quality, loaded
  ammunition, and attachments remain with the weapon through selection, dropping, collection,
  and transfer.
- **Duplicate upgrades remain optional.** A player may leave a matching drop untouched for a
  teammate. Collection never upgrades a weapon merely because a player walked over the drop.
- **Attachments use a fixed order.** A matching duplicate grants the next attachment after a
  preview; there is no attachment-choice menu in the selected design.
- **Shotgun cleave is baseline behavior.** Reliable short-range multi-target damage does not
  require an attachment.
- **Solid geometry remains authoritative.** Shotgun pellets, grenade travel, grenade blast
  damage, and turret targeting do not pass through blocking walls or other solid obstructions.
- **Turrets are personal equipment outside weapon slots.** Each survivor may carry at most one,
  with no movement penalty. A turret uses standard bullets from the shared squad reserve.
- **Turret condition persists.** Retrieval and redeployment preserve ammunition and durability;
  an empty intact turret can be replenished and reused.
- **Armor is finite protection.** Its maximum is 50, it absorbs eligible damage before health,
  armor pickups restore it, and it never regenerates on its own.
- **Health and medkits remain relevant.** Armor does not restore health or replace the personal
  medkit loop.
- **The grenade launcher does not hurt survivors.** Its base design has no self-damage or
  friendly fire. Each enemy receives blast damage at most once per explosion.
- **New power still consumes resources.** Cleave, attachments, grenades, turrets, and armor must
  not turn sustained crowd pressure into a free or permanent clear.
- **Solo and co-op remain readable on one camera.** New dialogs, effects, prompts, and actors
  must work with one to four survivors and the existing shared-camera/tether rules.

## Confirmed direction and unresolved rules

The following distinctions prevent a later implementer from mistaking candidate tuning for
canon.

### Confirmed for the selected feature set

- Solo capacity is four carried weapons; two-to-four-player capacity is three each.
- The unlimited backup pistol remains outside that capacity.
- The join-over-cap flow pauses and requires an explicit drop choice.
- Duplicate weapons can match inactive carried slots and advance a fixed attachment sequence.
- Attachments stay on the weapon when it is switched, dropped, or transferred.
- Shotgun cleave is part of the base shotgun.
- One turret per survivor is carried separately, has no movement penalty, uses shared standard
  bullets, and retains ammunition and durability when moved.
- The grenade launcher replaces the Molotov direction, occupies a weapon slot, uses dedicated
  grenade pickups, and participates in duplicate attachments.
- Armor has a maximum of 50, absorbs eligible damage before health, uses pickups, and does not
  regenerate.
- Adrenaline is deferred and is not part of the selected feature set.

### Phase 0 must decide before implementation

- Whether downed and controller-disconnected survivors continue to count toward co-op weapon
  capacity. The current proposal says yes so temporary player loss never expands capacity.
- Shotgun distance falloff, damage retained after each target, and cleave behavior against brutes
  and Patient Furnace.
- The exact attachment ids, order, maximum tier, and numeric effect for every weapon.
- Whether better quality and the next attachment can be gained from the same duplicate, and how
  loaded ammunition moves in that case.
- What a fully upgraded player may take from a duplicate, and when the drop must remain for a
  teammate.
- Turret deployment and retrieval controls, deployment time, resupply duration, interaction
  priority, targeting cone/range, firing noise, durability, damage sources, and whether the
  survivor can fire while carrying it.
- Grenade projectile speed, collision size, fuse/arrival behavior, reload values, blast curve,
  wall occlusion rule at corners, stagger values, and boss interaction. The original prototype
  candidates are recorded in Phase 4.
- Armor overflow behavior on a breaking hit, pickup amount, bypassing damage types, drop budget,
  and whether armor remains personal when other ammunition and provisions are shared.
- Which new pickup sources are authored, random, enemy-dropped, or guaranteed, and the resource
  budgets that keep a run scarce.

### Phase 0 decisions — 2026-09-17 (implementation authorized by the owner's goal prompt)

Every value below is a **tunable starting assumption**, logged so later playtests can change it.

- **Capacity.** `weaponCap(s)` = 4 while exactly one survivor exists in the run, else 3. Downed and
  controller-disconnected survivors still count (a player entry is never removed mid-run), so losing a player never
  expands capacity; a keyboard late join counts like a pad join; capacity never rises again within a run.
- **Join overflow.** A join that lowers capacity pauses the run and opens a player-owned "LEAVE A WEAPON" panel for
  each survivor above 3 weapons, in player order. Their own device moves the selection, confirms with interact and
  cannot back out; nothing is preselected-and-accepted. The chosen weapon drops beside them as a full `weaponState`
  with a 1 s pickup lock. If the selected slot was dropped, slot 0 is selected (pistol stays selected if it was).
- **Shotgun cleave.** Each pellet travels to range or the first solid; it damages up to 3 enemies in order, keeping
  60% damage after each. Falloff: 100% to 40% of range, then linear down to 50% at full range. A brute or Patient
  Furnace stops the pellet (damaged once). One pellet never hits one enemy twice.
- **Attachments.** Fixed order, three tiers per weapon, stored on the weapon instance (`attachments:[ids]`):
  | Weapon | T1 | T2 | T3 |
  |---|---|---|---|
  | shotgun | `sg_choke` +1 pellet | `sg_slug` pellets cleave +1 enemy | `sg_tube` magazine +2 |
  | ar | `ar_pierce` shot passes 1 enemy at 60% | `ar_extmag` magazine +10 | `ar_speed` reload −30% |
  | smg | `smg_suppressor` firing noise −40% | `smg_drum` magazine +18 | `smg_grip` equip delay −60% |
  | rifle | `rf_pierce` passes 2 enemies at 80% | `rf_match` damage +25% (replaces the weak-point candidate: no weak points exist) | `rf_bolt` interval −25% |
  | flame | `fl_linger` burning ground 2.5 s, 7 dps, max 8 patches | `fl_nozzle` cone +35% | `fl_tank` magazine +30 |
  | launcher | `gl_twin` magazine 2 | `gl_blast` radius +25% | `gl_reload` reload −30% |
- **Duplicates.** Interacting with a weapon drop whose type matches a carried weapon with fewer than 3 attachments
  upgrades that instance instead of taking a slot: the selected slot if it matches, else the first matching slot. The
  instance gains the next tier and takes the higher quality; the drop's loaded rounds go to the squad reserve. The drop
  is consumed only after the upgrade applies. Fully upgraded matches fall back to the ordinary pickup (empty slot or
  replace). The prompt previews "UPGRADE <WEAPON> · <attachment>" before the press. Walking over a drop never upgrades.
- **Grenade launcher** `launcher`: ammo `grenades` (shared reserve, starts 0), magazine 1, reload 2.5 s, interval
  0.9 s, range 330, noise 520. Projectile speed 420 toward the target's position at trigger time, max 12 live; it
  explodes on arrival or at the first solid. Blast radius 80, 100 damage at the centre to 35 at the edge, once per
  enemy, only to enemies with a clear line from the blast centre. Stagger: walkers/runners/ghosts/band knockback 36 and
  0.5 s stun, brutes 0.2 s stun, boss none. Never damages survivors, vehicles or gates; damages breakable debris
  (not optional-clear or protected obstacles) like gunfire.
- **Turrets** `turret`: one per survivor outside weapon slots, no movement penalty, may fire and board vehicles while
  carried. Binding `deploy` (keyboard T, Xbox LB, PlayStation L1): press while carrying = deploy after 0.8 s standing
  still (moving or being downed cancels, nothing lost); press within 40 of your own deployed turret = retrieve
  (instant). Hold interact within 40 of any deployed turret with ammo below capacity = resupply 1 bullet per 0.03 s from
  the shared reserve (lowest interact priority after weapons, refuel, vehicles). Placement needs a clear 20-unit circle
  not in a door, gate or vehicle slot. Stats: capacity 120 rounds (spawns with 60), range 260, interval 0.22 s,
  damage 12, noise 300, line of sight required, sticky nearest target. Durability 150; infected in contact damage it
  like a survivor; broken turrets drop nothing and free the slot.
- **Armor**: personal, 0..50, absorbs damage before health on every `hurt()` call; a breaking hit's remainder goes to
  health; no bypass sources (assumption: boss damage is already priced for health, so armor counts against it too);
  never regenerates. Pickup `armor` restores 25; partial pickups take the missing amount and leave the remainder;
  refused at full without consuming. Medkits heal health only.
- **Loot budget** (world.js economy, seeds 1–50): grenades count 8–12 × 2–4 rounds (munitions, weapons, quarantine
  bias), launchers count 2–3 (weapons profile, never Q2), armor count 6–9 (munitions, medical, refuge), turrets exactly
  2 per run (police station, quarantine armoury). Weapon Q1/Q2 counts unchanged, so duplicates come from the existing
  weapon pool.
- **Threat (owner constraint).** Outbreak pressure no longer follows wall-clock time. `pressure(s)` = squad power
  (shared level − 1, plus half the attachments carried, plus armor/50 and 0.5 per carried or deployed turret, averaged
  over living survivors) + 1.5 × campaign steps done (circuit, first evidence, boss down, payload, station prepared,
  transmission). Outbreak tier = 1 + ⌊pressure/3⌋ (max 9); spawn cap × min(2.5, 1 + pressure/12); spawn rate base
  0.9 + 0.35 × pressure; infected speed × (1 + min(0.35, pressure/40)); runners from pressure 1, brutes from pressure
  2; Patient Furnace damage scale uses the pressure tier. Waves, surges and migrations keep their time rhythm but do
  not grow with time.
- **Performance budgets.** ≤ 12 live grenades, ≤ 8 lingering fire patches, ≤ 4 turrets with target search every
  0.15 s, new audio cues inside the 48-voice cap, four-player browser render p95 within +2 ms of the V2 baseline.

---

## Current-code baseline — before this tracker

Source-reviewed on 2026-09-16. These are observations, not completed player-power tasks.

- `game.js` defines `WEAPON_CAP = 2` for every party size. The HUD manual says “two weapons plus
  an unlimited pistol.”
- A survivor stores carried weapons in `weaponInventory`; the selected weapon is mirrored into
  `weapon`, `quality`, and `mag`. Cycling saves the current slot and includes the backup pistol.
- Collecting a weapon fills an empty slot or replaces the selected slot. The replaced weapon is
  dropped nearby with weapon type, quality, and magazine preserved.
- Weapon pickup is explicit through interact. Ordinary non-weapon pickups are collected on
  contact. This is a reusable foundation for leaving duplicates for teammates.
- A controller can join a live run by pressing its interact button. The join does not currently
  pause play or reconcile inventory capacity. Controllers that disconnect remain represented and
  pause the game, but capacity is currently static.
- The current carried weapons are assault rifle (`ar`), pump shotgun (`shotgun`), SMG (`smg`),
  marksman rifle (`rifle`), and flamethrower (`flame`). The pistol is the backup weapon.
- The shotgun fires six separate ray pellets. Each ray finds only its nearest target and ends
  there; walls shorten the ray first. There is no through-target hit collection or distance
  damage falloff.
- The flamethrower already applies cone damage to multiple enemies and respects line-of-sight,
  but its logic is not a general penetration or blast system.
- There is no projectile actor, explosion system, grenade ammunition pool, turret actor,
  attachment definition, armor field, or armor pickup.
- `hurt()` applies eligible damage directly to health, then invulnerability, knockback, feedback,
  and the downed transition. Every damage call must continue through one authoritative path when
  armor is added.
- Weapon world loot currently rolls from SMG, shotgun, rifle, and flamethrower, with a guaranteed
  assault rifle at the spawn. Weapon quality is part of the city economy; duplicate value is not.
- Ammunition is shared by the squad. Standard bullets feed the assault rifle, SMG, and marksman
  rifle; shells feed the shotgun; incendiary fuel feeds the flamethrower.
- `hud.js`, `render.js`, `audio.js`, the field manual, loot prompts, player strips, and automated
  tests know the current weapon list and current two-slot behavior. Each needs an explicit audit.
- The existing general checks are `npm test`, `npm run test:browser`, `npm run art:lint:all`,
  `npm run bench`, and `npm run bench:browser`. No dedicated player-power suite exists.

## Target data contracts

These contracts describe the state that must survive all relevant transitions. Exact field names
may change in Phase 0, but the concepts must not be collapsed back into selected-weapon globals.

```js
weaponState = {
  weapon,          // stable weapon id
  quality,
  mag,             // loaded ammunition owned by this weapon instance
  attachments: [] // stable attachment ids in earned order
}

attachmentDefinition = {
  id,
  weapon,
  tier,
  label,
  description,
  apply            // or equivalent data consumed by combat/reload/equip behavior
}

playerPowerState = {
  weaponInventory: [weaponState],
  weaponSlot,
  backup,
  armor,           // 0..50
  turretId         // null or the survivor's carried/deployed turret
}

turretState = {
  id,
  ownerId,
  state,           // carried | deploying | deployed | retrieving | broken
  x, y, angle,
  ammo,
  durability,
  targetId
}

grenadeState = {
  id,
  ownerId,
  x, y,
  targetX, targetY,
  vx, vy,
  radius,
  damageProfile,
  attachmentSnapshot
}
```

Required ownership rules:

- A world weapon drop and a carried weapon use the same serializable `weaponState` shape.
- Attachments belong to a weapon instance, not to a player, selected slot, or global weapon type.
- A duplicate is not consumed until the upgrade transaction succeeds.
- Shared reserves own standard bullets and grenade ammunition. A deployed turret owns the rounds
  already loaded into it.
- A turret has one stable id through carrying, deployment, retrieval, and redeployment.
- Armor belongs to one survivor. Damage resolution returns enough information for health, armor,
  HUD, audio, and tests to agree on what absorbed the hit.
- Temporary grenade actors and deployed turrets must be bounded or cleaned up on restart, loss,
  victory, and owner removal.

---

## Ordered implementation tracker

### Phase 0 — Lock the prototype contract and baseline

- [ ] Resolve every item under “Phase 0 must decide before implementation” and move each result
  into “Confirmed for the selected feature set” or a clearly labeled deferred list.
- [ ] Define stable ids for the grenade launcher, grenade ammunition, turret, armor pickup, and
  every attachment selected for the first prototype.
- [ ] Freeze the first-prototype weapon capacity rule, including downed survivors, disconnected
  controllers, reconnects, late keyboard joins, and a return from co-op to solo if that can occur.
- [ ] Freeze duplicate transaction rules for attachment gain, quality gain, loaded ammunition,
  full progression, and leaving the drop for another survivor.
- [ ] Freeze initial shotgun cleave, grenade, turret, and armor numbers. Mark them as tuning
  baselines rather than permanent balance.
- [ ] Add `tools/test-player-power.mjs` and include it in `npm test`. Start with assertions for the
  historical two-slot inventory, replacement/drop preservation, shotgun one-target-per-pellet,
  direct-to-health damage, and absence of new pickup types.
- [ ] Add a browser scenario or extend the browser harness for one-, two-, and four-survivor power
  states, keyboard plus controller input, pickup prompts, join dialogs, and HUD screenshots.
- [ ] Record reproducible combat baselines: time/ammunition to clear fixed walker, runner, brute,
  and mixed crowds with every current weapon at each quality.
- [ ] Record current solo and four-player pressure baselines at fixed elapsed times: nearby enemy
  count, ammunition spent, damage/down events, and whether an objective hold can be completed.
- [ ] Record seeds 1–50 weapon type/quality counts and ammunition totals so duplicate conversion,
  grenades, turret use, and armor can later be budgeted against the current city economy.
- [ ] Define performance budgets for projectile count, explosion checks, turret targeting, new
  effects, and maximum audio voices.

Phase 0 exit: rules no longer depend on “proposed” prose, the pre-change behavior is protected by
tests, and later phases have numeric baselines for comparison.

### Phase 1 — Implement carried capacity and safe co-op drop-in

- [ ] Replace the fixed `WEAPON_CAP` assumption with one capacity function consumed by game logic,
  HUD prompts, the field manual, and tests.
- [ ] Return four slots for a one-survivor run and three slots per survivor once two to four
  survivors are counted under the Phase 0 rule.
- [ ] Audit pickup, replacement, cycling, current-slot bookkeeping, death/revive, vehicle entry,
  restart, and any test setup for inventories longer than two.
- [ ] Detect the exact transition in which a new join lowers capacity while an existing survivor
  holds four weapons.
- [ ] Pause simulation before the new survivor can move, take damage, collect loot, or affect the
  shared camera.
- [ ] Add a player-owned overflow dialog showing all four weapon names, qualities, attachments,
  and loaded ammunition.
- [ ] Require an explicit selection and confirmation; never preselect and immediately accept a
  destructive choice.
- [ ] Drop the chosen weapon nearby as a complete `weaponState`, with a short pickup lock only if
  needed to prevent the same input edge from reclaiming it.
- [ ] Preserve the selected weapon when it remains in inventory. If it is dropped, select a
  deterministic remaining weapon. Preserve the backup pistol selection when it was active.
- [ ] Skip the dialog when every existing survivor already carries three or fewer weapons.
- [ ] Define and implement an orderly queue if multiple existing survivors are over capacity.
- [ ] Handle join, disconnect, reconnect, pause, menu back/confirm, controller identity, and
  restart without duplicating or deleting a weapon.
- [ ] Update the live pickup prompt so it names the correct empty slot or replacement consequence
  at the current party size.
- [ ] Test zero-to-four inventory sizes, all selected-slot positions, pistol selected, simultaneous
  over-cap survivors, keyboard/controller joins, disconnect during the dialog, and dropped-state
  preservation.
- [ ] Browser-check the dialog at all supported aspect ratios and UI scales with keyboard, Xbox,
  and PlayStation labels.

Suggested dialog copy:

> A teammate has joined. Solo survivors can carry four weapons to cover more roles; in co-op,
> each survivor carries three and the squad can share those roles. Choose one weapon to leave for
> your teammate. Your backup pistol stays with you.

Phase 1 exit: party-size capacity is enforced at every entry point, and no drop-in or UI edge case
can destroy, duplicate, or silently select a weapon.

### Phase 2 — Add baseline shotgun cleave

- [ ] Separate pellet travel distance from the nearest victim so one pellet can enumerate ordered
  intersections along its ray until range or a solid obstruction ends it.
- [ ] Apply the Phase 0 distance falloff from muzzle to each target rather than using only the
  distance to the initially acquired target.
- [ ] Apply the decided successive-target retention rule independently per pellet.
- [ ] Ensure one pellet damages one enemy at most once, including large hit circles and overlapping
  enemies.
- [ ] Preserve six-pellet spread, ammunition use, reload behavior, quality scaling, firing noise,
  aim acquisition, and obstacle damage unless Phase 0 explicitly changes one.
- [ ] Stop pellets at walls, fences, closed doors/gates, protected obstacles, and other solids
  under the same collision rules as existing gunfire.
- [ ] Implement the decided brute and boss interaction without allowing boss size to multiply one
  pellet's damage.
- [ ] Render a trace that communicates continued travel through a crowd and still terminates at a
  wall.
- [ ] Add fixed-line tests for two aligned walkers, dense overlapping walkers, a walker behind a
  wall, falloff at several distances, brute interaction, boss interaction, and total damage from
  all six pellets.
- [ ] Compare isolated and packed-target damage to the Phase 0 baseline; document the intended
  increase instead of compensating with an unrelated global nerf.
- [ ] Browser-check doorway, alley, open-street, wall, brute, and boss shots at gameplay zoom.

Phase 2 exit: a packed short-range line is a reliably favorable shotgun situation, while cover,
range, shells, reload time, and strong targets still limit it.

### Phase 3 — Build duplicate-drop and attachment foundations

- [ ] Migrate every carried and dropped weapon to the shared `weaponState` contract without
  losing current weapon, quality, or magazine behavior.
- [ ] Define attachment metadata separately from combat code: stable id, owning weapon, fixed tier,
  label, description, and effect data/hook.
- [ ] Find matching duplicates across every carried slot, not only the selected weapon.
- [ ] If more than one carried instance matches, show which instance will receive the upgrade or
  let the player select the target under the Phase 0 rule.
- [ ] Compute the next unearned attachment from the fixed progression and never skip a tier.
- [ ] Preview the attachment name and concrete effect before collection.
- [ ] Keep ordinary weapon-pickup behavior available so a duplicate can be left or taken as a
  weapon for another survivor.
- [ ] Make the upgrade transaction atomic: consume one drop only after the intended carried weapon
  successfully receives exactly one attachment and any quality/ammunition rule is applied.
- [ ] Preserve attachments through switching, reload cancellation, dropping, overflow choice,
  teammate collection, death/revive, vehicle use, and restart setup.
- [ ] Define fully upgraded duplicate behavior and refuse collection without consuming or hiding
  the drop when it offers the player no benefit.
- [ ] Keep weapon quality and attachment tier visually distinct in prompts, player strips, the
  overflow dialog, and world drops.
- [ ] Add attachment-aware copies to all tests and developer scenarios that construct weapon
  inventory by hand.
- [ ] Test inactive-slot matches, multiple same-type slots, successive duplicates, full progression,
  higher/lower/equal quality, partial/full magazines, sharing, drop/recollect, and simultaneous
  co-op interaction.
- [ ] Browser-check the preview and result at gameplay zoom with no attachment, one attachment,
  and a fully upgraded match.

Phase 3 exit: duplicate collection is a lossless, optional, previewed transaction whose result
belongs to one weapon instance through every inventory transition.

### Phase 4 — Add the grenade launcher as a base weapon

Original candidate values for the first prototype, pending Phase 0: one shot per reload, 2.5-second
reload, 80-unit blast radius, 100 center damage falling to 35 at the edge, no survivor damage,
ordinary-infected stagger, reduced brute stagger, and no boss stagger.

- [ ] Add the grenade launcher definition to the canonical weapon table, weapon labels, size/pose
  metadata, loot rendering, world rendering, and developer fixtures.
- [ ] Add dedicated grenade ammunition to run state, pickup collection, shared-reserve HUD,
  prompts, city loot profiles, and test fixtures; do not reuse shells or incendiary fuel.
- [ ] Make the launcher occupy a normal carried slot and participate in existing select, cycle,
  reload, drop, transfer, join-overflow, vehicle-passenger fire, and autofire rules.
- [ ] Implement a bounded projectile actor with owner, position, target position, travel state,
  collision, and cleanup.
- [ ] Fire toward the acquired target's position at trigger time so a moving target can leave the
  eventual blast.
- [ ] Resolve arrival, wall collision, and any Phase 0 fuse rule exactly once; prevent double
  explosions during large time steps or cleanup.
- [ ] Stop the projectile at blocking geometry and compute blast occlusion according to the Phase 0
  corner rule.
- [ ] Apply radial falloff once per enemy regardless of hit-circle size or overlap.
- [ ] Apply the decided stagger separately from damage for ordinary infected, brutes, and Patient
  Furnace.
- [ ] Exclude all survivors, including the owner and downed teammates, from damage and stagger.
- [ ] Define interaction with destructible debris, protected geometry, vehicles, gates, turrets,
  and campaign actors; add an explicit test for each.
- [ ] Add launch, travel, impact, blast, reload, empty-fire, pickup, and detonation feedback with
  matching hearing/noise behavior.
- [ ] Test ammo consumption, empty reserve, reload interruption, moving targets, arrival, walls,
  corners, one-hit-per-enemy, falloff, stagger classes, no friendly fire, restart cleanup, and the
  maximum simultaneous projectile count.
- [ ] Browser-check close/long shots, a moving target, wall impact, an occluded enemy, a dense
  crowd, co-op visibility, and passenger firing.

Phase 4 exit: the unmodified launcher is a complete scarce-ammunition weapon and a stable base for
its duplicate attachments.

### Phase 5 — Implement and tune the attachment catalog

The candidates below preserve the original design discussion. Phase 0 must replace any rejected
candidate and record the selected fixed order before its row is implemented.

| Weapon | Tier 1 candidate | Tier 2 candidate | Tier 3 candidate |
|---|---|---|---|
| Shotgun | Wider spread | Stronger stagger | Larger tube magazine |
| Assault rifle | Penetrating ammunition | Extended magazine | Faster reload |
| SMG | Suppressor | Drum magazine | Faster equip |
| Marksman rifle | Through-target penetration | Weak-point damage if that system exists | Faster cycling |
| Flamethrower | Lingering ground fire | Wider nozzle | Larger tank |
| Grenade launcher | Two-shot chamber | Blast radius +25% | Reload time −30% |

- [ ] Finalize the table with stable ids, exact effect values, order, and player-facing copy. Do
  not leave a selected tier conditional on a nonexistent weak-point system.
- [ ] Implement the shotgun sequence on top of baseline cleave; no attachment may be required to
  unlock multi-target damage.
- [ ] Implement the assault-rifle sequence, including a common penetration primitive if selected.
- [ ] Implement the SMG sequence, including a precise gameplay meaning for suppressor noise and
  faster equip.
- [ ] Implement the marksman-rifle sequence and replace the weak-point candidate if weak points
  remain out of scope.
- [ ] Implement the flamethrower sequence, including bounded lifetime/count and wall behavior for
  lingering fire if selected.
- [ ] Implement the grenade-launcher sequence without changing its base no-friendly-fire rule.
- [ ] Recompute live magazine/reload state safely when an attachment changes capacity or reload
  time; never delete loaded or reserve ammunition.
- [ ] Make every attachment's effect inspectable in data and covered by a direct assertion rather
  than inferred only from a long simulation.
- [ ] Give each attachment distinct but restrained firing, reload, trace, muzzle, impact, HUD, or
  audio feedback appropriate to its effect.
- [ ] Test every tier alone and in sequence, all quality levels, drop/transfer, reload in progress,
  no-ammo states, and interaction with walls, brutes, boss, vehicles, and four-player fire.
- [ ] Measure damage, ammunition efficiency, reload downtime, noise, and clear time for every
  base/fully-upgraded weapon against the Phase 0 fixed crowds.
- [ ] Browser-check that a player can identify the gained effect without opening source code and
  that four fully upgraded weapons remain visually legible together.

Phase 5 exit: all selected weapons have a complete three-step progression, each tier works from
data through feedback, and no progression has an unresolved placeholder.

### Phase 6 — Implement carryable turrets

- [ ] Define turret pickup ownership and enforce one turret per survivor outside weapon slots.
- [ ] Define carried, deploying, deployed, retrieving, empty, and broken states with one stable id.
- [ ] Add controls and prompt priority for pickup, deploy, retrieve, and resupply without stealing
  interactions intended for weapons, vehicles, doors, refuelling, or campaign holds.
- [ ] Preserve normal movement speed while carrying a turret.
- [ ] Apply the Phase 0 rule for whether a carried turret permits normal weapon fire and vehicle
  boarding; explain refusals in player-owned feedback.
- [ ] Require the decided deployment time and cancel or preserve progress consistently when the
  survivor moves, is hit, is downed, enters a vehicle, opens a menu, or leaves range.
- [ ] Validate placement against walls, furniture, doors, gates, vehicle lanes, campaign anchors,
  survivors, and other turrets before deployment completes.
- [ ] Target only eligible living enemies within range, field of fire, player-visibility rules if
  selected, and unobstructed line of sight.
- [ ] Choose targets deterministically enough for reproducible tests and avoid rapid target
  flicker when two candidates are similar.
- [ ] Spend loaded turret ammunition per shot and produce the selected firing noise so turret use
  contributes to pressure.
- [ ] Hold interact near a deployed turret to transfer standard bullets from the shared reserve,
  up to capacity, over the decided duration.
- [ ] Make resupply and retrieval unambiguous when the same survivor is in range; show the current
  action, progress, ammunition, and result.
- [ ] Preserve remaining ammunition and durability through retrieval and redeployment.
- [ ] Apply the selected damage rules, hit feedback, break behavior, repair policy, and cleanup.
- [ ] Keep owner, targeting, ammunition, and effects valid when the owner is downed, disconnected,
  revived, or joined by other players.
- [ ] Bound target-search work and effect/audio creation with up to four deployed turrets in a
  full crowd.
- [ ] Test ownership, carry limit, placement rejection, deploy interruption, targeting, line of
  sight, shared-ammo transfer, empty reuse, durability, retrieval, disconnect/revive, restart, and
  four-turret performance.
- [ ] Browser-check defensive lanes at an objective hold, a blocked doorway, retrieval after a
  fight, co-op ownership, empty/resupply feedback, and a turret breaking.

Phase 6 exit: a turret provides costly, position-dependent covering fire without becoming free
ammunition, a permanent autonomous clear, or an interaction trap.

### Phase 7 — Implement armor layers

- [ ] Add personal armor state clamped from 0 to the confirmed maximum of 50.
- [ ] Route every survivor damage source through one armor-aware damage function before health,
  downing, knockback, invulnerability, and feedback are resolved.
- [ ] Implement the Phase 0 overflow rule for a hit that breaks the remaining armor.
- [ ] Implement and test the selected bypass rules by damage source rather than scattered caller
  exceptions.
- [ ] Keep knockback and hit invulnerability behavior deliberate when armor absorbs all health
  damage.
- [ ] Add armor pickups with the decided restore amount and personal ownership rule.
- [ ] Refuse a pickup at full armor without consuming it so another survivor can use it.
- [ ] Decide and implement partial-pickup behavior when the restore amount exceeds missing armor.
- [ ] Show armor separately from health on every player strip, with readable full, damaged, low,
  hit, broken, pickup, and refused states.
- [ ] Add distinct armor-hit and break feedback that remains understandable with sound muted and
  in four-player overlap.
- [ ] Keep medkit behavior unchanged: it restores health only and remains useful after armor is
  lost.
- [ ] Preserve armor through vehicle entry/exit, down/revive, district travel, menus, and normal
  play; reset it under the same new-run rules as health/inventory.
- [ ] Test exact absorption, overflow, bypass, invulnerability, simultaneous damage, downing,
  revive, full/partial pickups, medkits, vehicle crashes, boss attacks, hazards, and restart.
- [ ] Browser-check each armor state for all four player colors and supported HUD scales.

Phase 7 exit: every damage source has an explicit armor result, while health loss, downing, and
medkits continue to matter.

### Phase 8 — Integrate new power into city loot and the run economy

- [ ] Add loot-family rules and map/HUD representation for grenade ammunition, turrets, and armor
  without implying an exact item where the existing requisition map promises only a category.
- [ ] Decide whether turrets and armor are guaranteed once per run, budgeted random finds, rewards,
  enemy drops, or some combination; document the rationale and exact sources.
- [ ] Add grenade ammunition to appropriate authored and randomized sites with explicit minimum,
  median, and maximum totals over seeds 1–50.
- [ ] Add armor pickups with explicit seed-distribution bounds and no forbidden-location leaks.
- [ ] Add turret placement/drop rules with stable site/location ownership and clear-state behavior.
- [ ] Rebudget weapon type frequencies so the fixed attachment progressions are attainable but a
  single route does not guarantee every survivor a fully upgraded loadout.
- [ ] Preserve co-op sharing: a useful weapon, turret, armor pickup, or grenade stack remains in
  the world when the interacting survivor cannot or chooses not to benefit.
- [ ] Decide whether enemy weapon drops can grant attachments and apply the same transaction and
  ownership rules if they can.
- [ ] Ensure duplicate conversion does not accidentally create or erase loaded/shared ammunition.
- [ ] Keep authored-site cleared state correct when a duplicate is upgraded, a weapon is dropped,
  a turret is retrieved, or a partial pickup remains.
- [ ] Extend the 50-seed economy fixture with weapon duplicates by type/quality, attainable
  attachment tiers, grenade ammunition, turret count, armor points, and district/source breakdown.
- [ ] Test that new loot never overlaps collision, furniture, doors, campaign pickups, vehicle
  slots, or inaccessible sockets.
- [ ] Test full inventories and full armor in one-to-four-player parties so valuable loot never
  vanishes due to a refused collection.
- [ ] Compare total offensive/defensive value with the Phase 0 ammunition, medkit, weapon, and
  pressure baselines before approving any compensating scarcity change.

Phase 8 exit: all new systems are obtainable and shareable through a measured run economy, and
their availability is neither accidental nor unlimited.

### Phase 9 — Finish presentation, controls, art, audio, and documentation

- [ ] Audit every canonical weapon list in `game.js`, `render.js`, `hud.js`, `audio.js`, city loot,
  art references, fixtures, benchmarks, screenshots, README, and the field manual.
- [ ] Add registered grenade-launcher survivor poses, world pickup art, projectile/blast effects,
  grenade-ammo pickup art, and any required damaged/empty states.
- [ ] Add turret pickup, carried, deployment, deployed, firing, empty, damaged, and broken art with
  collision and muzzle origins matching simulation.
- [ ] Add armor pickup and player/HUD hit/break feedback without requiring a full alternate sprite
  set unless the chosen visual direction needs one.
- [ ] Add attachment preview and earned-state iconography that remains distinct from weapon-quality
  stars and does not overcrowd the four-player dock.
- [ ] Add capacity/drop-choice, duplicate-upgrade, turret, armor, grenade, and refused-action copy
  to the prompt hierarchy with player ownership where simultaneous actions are possible.
- [ ] Add or reuse keyboard, Xbox, and PlayStation bindings for every new action. Do not overload a
  control until Phase 0 has specified context and priority.
- [ ] Add launch, explosion, turret deploy/fire/empty/break, attachment gained, armor hit/break, and
  dialog cues within the global audio voice budget.
- [ ] Give all essential audio events a visible equivalent and make effects obey music/effects mute,
  pause, restart, loss, victory, and source-destruction lifecycle rules.
- [ ] Update the field manual with party-size capacity, duplicate progression, grenade ammunition,
  turret controls/resupply, and armor. Keep it concise enough to use during play.
- [ ] Update README and any design/status documents that state the old capacity, weapon list, loot
  behavior, or direct-to-health model.
- [ ] Register and lint all new art; update the checked-in warning budget only for intentional,
  reviewed warnings.
- [ ] Run HUD matrices at every supported aspect ratio, party size, UI scale, controller family,
  and representative base/fully-upgraded equipment state.
- [ ] Listen with one and four survivors during simultaneous upgraded gunfire, grenades, and turrets;
  confirm important state changes remain audible without clipping or starving existing cues.

Phase 9 exit: no surface teaches the old rules, every action has correct device-specific guidance,
and combat state remains legible when four players use the new systems together.

### Phase 10 — Balance, performance, and final review

- [ ] Run the full automated suite: `npm test`, `npm run test:browser`, and
  `npm run art:lint:all`.
- [ ] Run `npm run bench` and `npm run bench:browser`; compare projectile, explosion, four-turret,
  lingering-effect, crowd, rendering, and voice results with Phase 0 budgets.
- [ ] Repeat the fixed-crowd weapon matrix for base and fully attached weapons at all qualities.
- [ ] Repeat the seeds 1–50 economy measurement and confirm every Phase 8 distribution envelope.
- [ ] Play isolated prototypes before judging the combined set: shotgun cleave, attachments,
  grenade launcher, turret, and armor.
- [ ] Play full runs solo and with two and four survivors, mixing keyboard and controllers, with
  ordinary exploration, objective holds, vehicles, the boss, and the final escape.
- [ ] Confirm a solo player can reclaim a crowded street instead of only circling it.
- [ ] Confirm preparation with a turret or grenade launcher can create enough space to complete an
  objective interaction, but cannot sustain every hold without resource loss.
- [ ] Confirm duplicate drops produce noticeable, understandable growth at a useful cadence.
- [ ] Confirm shotgun cleave and explosive/penetrating attachments do not erase walls, range,
  brutes, Patient Furnace, or crowd positioning as meaningful constraints.
- [ ] Confirm grenades and turrets reward positioning while consuming meaningful ammunition and
  attracting appropriate pressure.
- [ ] Confirm armor lets a survivor recover from some mistakes while health attrition, medkits,
  downing, and revival stay relevant.
- [ ] Confirm all systems remain useful and readable in co-op without making four-player damage
  and survivability scale beyond intended pressure.
- [ ] Confirm a new player understands capacity, duplicate previews, turret state, grenade ammo,
  and armor from the game rather than developer explanation.
- [ ] Record final values, test/benchmark outputs, screenshots, known limitations, and each manual
  review result in the session log.

Phase 10 exit: measured and human review agree that the selected power tools create recoverable
combat and preparation choices while preserving scarcity, threat, and co-op readability.

---

## Deferred concept — adrenaline

Adrenaline is not part of the selected feature set and must not be implemented as incidental work
inside another phase. The concern is that an automatic buff could feel random or activate when it
is not useful.

If the concept is promoted later, first create a separate decision phase covering a visible meter,
how kills charge it, whether charge persists, deliberate activation controls, duration, faster
reload, stronger stagger, HUD/audio feedback, co-op ownership, and balance alongside attachments.
Do not infer those rules from the current note.

## Cross-feature verification matrix

Every feature phase should cover its applicable cells before `[x]`.

| Scenario | Capacity | Cleave | Attachments | Grenades | Turrets | Armor |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Solo, keyboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Two players, mixed input | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Four players, controllers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Down/revive | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Disconnect/reconnect | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Drop/transfer/recollect | ✓ | — | ✓ | ✓ | ✓ | — |
| Vehicle driver/passenger | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Wall/door/gate occlusion | — | ✓ | ✓ | ✓ | ✓ | — |
| Walker/runner/brute/boss | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pause/restart/loss/victory | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Full inventory/reserve/state | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Supported aspect/UI scales | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

`—` means the scenario has no special behavior beyond regression coverage; it does not exempt the
feature from the general test suite.

## Human review queue

Checks that automated assertions cannot establish. Tick them here after review, then tick the
matching phase item.

**A · Inventory and comprehension**

1. [ ] Join a solo run while its survivor carries four distinct upgraded weapons. Verify the
   pause, explanation, device labels, selection, confirmation, nearby drop, and resumed selection.
2. [ ] Ask a new player to explain a duplicate preview, weapon quality, attachment tier, loaded
   ammunition, and why they might leave the drop for a teammate.
3. [ ] Review the four-player dock and pickup prompt at every supported aspect ratio and UI scale.

**B · Combat read**

1. [ ] Fire the shotgun down a packed doorway, an open alley, through a brute, at Patient Furnace,
   and toward enemies behind cover. Judge cleave and stopping points without debug overlays.
2. [ ] Use each base and fully upgraded weapon. Confirm every attachment produces an observable
   effect and the combined effects remain readable.
3. [ ] Fire grenades at moving, dense, occluded, close, and boss targets with one and four players.

**C · Preparation and defense**

1. [ ] Carry, deploy, resupply, empty, retrieve, redeploy, damage, and break a turret around an
   objective hold. Verify interaction priorities near loot, doors, fuel, and vehicles.
2. [ ] Use four turrets during a crowd and listen for target/fire clarity, noise pressure, voice
   starvation, and performance problems.
3. [ ] Take small, breaking, overflowing, bypassing, vehicle, and boss hits at several armor/health
   values. Verify armor and health consequences can be understood immediately.

**D · Full-run balance**

1. [ ] Complete at least one solo run using each new tool and one solo run that finds little of
   the new power. Compare ability to recover, ammunition pressure, damage, and completion time.
2. [ ] Complete two- and four-player runs with uneven loot ownership. Confirm sharing and role
   specialization are useful without forcing one optimal loadout.
3. [ ] Review duplicate, grenade, turret, and armor availability across several seeds and routes;
   confirm the city rewards exploration without guaranteeing a full build early.

## Session log

- 2026-09-16 — **Tracker decomposed; no gameplay implementation performed.** Converted the
  exploratory concept note into ordered workstreams with status rules, current-source baseline,
  target state ownership, phase dependencies, granular implementation/test/browser items, a
  cross-feature matrix, and a human review queue. All phases remain `[ ]`. The selected mechanics,
  confirmed rules, original candidate values, and deferred adrenaline concept were preserved;
  unresolved decisions were routed to Phase 0 rather than silently decided.
