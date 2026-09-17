# Night lighting — how it works and why

> Source of truth for `lights.js`. Read before changing any lighting constant — the values
> below were measured, and the obvious-looking fixes were tried and did not work.

## State: landed 2026-09-16

- [x] Additive light pass on top of the multiply lightmap
- [x] Cone reaches into obstacles it hits (the "constant shade" bug)
- [x] Sprite-silhouette shadows for props and cars
- [x] Casters never shadow themselves
- [x] Multi-light overlap no longer erases light
- [ ] Lamps occluded by walls (predates this work — see Limits)

## The pipeline, in order

`render.js` draws the world, then `lights.js draw()` composites over it:

1. **Lightmap** — the district's ambient colour, plus every light added with `'lighter'`, plus
   each survivor's vision cone.
2. **Shadow pass** — `multiply`. Can only darken or preserve.
3. **Light pass** — the same map with the ambient floor removed (`'difference'` against the
   ambient colour), added with `'lighter'` at `LIGHT_ADD`. This is what puts light *onto* a
   surface instead of merely failing to darken it.
4. Vignette and HUD, unlit.

`tools/frame.mjs` **cannot see any of this** — `lights.js:12` sets `HEADLESS` and `draw()`
returns at once on the software canvas. Only `node tools/shot.mjs <scene>,night` exercises it.

## Knobs (all at the top of `lights.js`)

| knob | value | what it does |
|---|---|---|
| `LIGHT_ADD` | .2 | strength of the additive pass. **0 restores the old multiply-only look.** .45 washed the cones out and killed the night |
| `LIGHT_BITE` | 96 | world units the cone reaches *into* an obstacle past its near face |
| `BITE_STEPS` | 4 | bands that bite fades in. 1 band saves ~2 ms/frame if frame time gets tight |
| `SHADOW` | .8 | shadow darkness right next to its light, fading toward the rim |
| `CAR_H` | 20 | how tall a car stands; sets how far its shadow slides |

## The two bugs, and why the first fix was not enough

**1. Multiply can only darken.** The original pipeline was steps 1-2 only, so the brightest a
lit prop could ever be was its own raw sprite colour — and this game's art is authored dark
(landed families run mean luminance 0.13-0.27). A prop in a lamp pool was *un-shaded*, never
*lit*. The additive pass (step 3) fixed this for open ground and small props.

**2. Every solid obstacle stood inside its own shadow — and no value of `LIGHT_ADD` could
help.** The cone's rays stopped at the object's near face, and the object's sprite is drawn
over its own footprint, so its body always landed in the dark part of the lightmap. Measured
with a survivor 180 units away, cone on vs off:

| point | lightmap on / off | screen gain |
|---|---|---|
| ground beside the object | 124 / 32 | 6.6-11× |
| inside car, bus, building, dumpster — every depth | 31 / 31 | **1.00×** |

Zero light reached the bodies, which is why the user still saw "constant shade" after bug 1
was fixed. `LIGHT_BITE` fixes it: the cone now reaches 96 units in, fading over 4 bands, never
past the far face. After: 112-116 near the face, 77-81 at depth 40, 42 at depth 80. The
ground *behind* every object stays at 0.93-1.05× — no light leaks through.

> **Hypotheses that were tested and killed**, so nobody retries them: the screen-space vs
> world-space sprite offset (only a ~10px strip at the top, because the art is drawn to match
> the collision boxes); `LIGHT_ADD` being too low (the added light on bodies was exactly 0);
> draw order (only vignette and HUD come after the lightmap).

## Shadows

- **Props and cars throw their own sprite silhouette**, not an ellipse blob. `render.js`
  registers each sprite with `L.caster()` as it draws it; standing props are sheared along
  the ground, cars are slid away from the light. Survivors and loot keep ellipses.
- **A caster never shadows itself** — its body is cut out of its own shadow, and its own glow,
  fire or headlights do not count as lights for it.
- **A caster reached by two or more lights throws no shadow.** Measured: each shadow used to
  erase every light under it, so a point in a walker's shadow read 253 with one survivor's
  light and **81 with two** — adding light made it darker. Now 255 with both. This rule is
  also the cheap option: doing shadows properly per light cost 5-38 ms/frame extra.

## Limits — known, not bugs to rediscover

- **Shadows can over-darken** where a shadow from one light runs into a second light's pool.
- **Four overlapping cones hit full brightness** near the party, so shadows vanish there.
- **Unseen infected no longer cast shadows.** The old code did. A deliberate behaviour change.
- **Cost:** a third lightmap-sized canvas, composited once per frame. Busy night scene
  measured 10.1 ms with shadows vs 9.5 ms stubbed, in CPU-rendered headless Chrome (so
  pessimistic). No dropped frames.

## City revamp lighting (CITY.md Phase 9, 2026-09-16)

- **Point-light occlusion.** `lights.js paintLight` clips every static light to a 40-ray visibility
  polygon cast against walls, sealed buildings, closed doors and solid fences (chain-link is
  `seeThrough`), biting 10 units into what it hits. Polygons are cached per source until
  `s.navVersion` changes (a forced door or cleared debris). Boss glow and vehicle headlights are
  not clipped. `seen()` skips a light whose ray to the infected is occluded.
- **Simulation agrees.** `game.js litAt` counts a static pool only when its circuit is live and
  `occluded()` (same occluder types) finds nothing between fixture and point, and counts a driven,
  fuelled vehicle's headlight cone (`HEADLIGHTS` per vehicle type: sedan 112/18/170, fire truck
  150/24/210, bulldozer 110/30/150; lights.js uses the same table). Sound settings never affect it.
- **Emergency circuit.** Props and `w.lights` entries tagged `circuit:'emergency'` (chapel nave,
  generator room and door spill, Blackglass control/transmitter rooms, Checkpoint Nine gate floods)
  are dark until `s.circuit.emergency` (set by the chapel generator, Phase 12). The restored tower
  adds a 420-unit steady teal pool plus a 260-unit pulse — the strongest light in the city.
- **District practicals.** Hospital corridor tubes: west strobes, centre holds, east (restricted) wing
  dead; side rooms have no fixtures. Ashworks: flickering furnace-house glow and strobing amber
  warning beacons on the machine-shop compound; lot floodlights keep their district live share.
  Old Quarter: faint cold moonlight pools over the graveyard. Quarantine: eight harsh pools on the
  ring edges plus the four floodlit corners; no fixtures in the command, holding or armoury rooms.
- **Only Ashworks burns.** A wreck scorched outside Ashworks is `cold` (burnt-out art, no fire,
  no light, no fire sound); the cross-district `forceBurn` exception is gone.
- **Entrances.** Every required civic public door has a small always-on battery marker (r 34), so
  it reads even where its street lamp is dead.
- Light-only props are `flat` props with `art:null`; the renderer draws only their light.

## Verifying a change

Render back to back, never against an old screenshot — other agents edit `art/` and the scene
shifts under you. Sample actual pixels from the PNGs rather than eyeballing: "the object is N%
brighter than its unlit self while the ground beside it is M% brighter" is the statement that
settles a lighting question. Reference crops in `artifacts/`: `light-before.png`,
`light-after.png`, `light-fix-car.png`, `light-fix-bus.png`, `light-fix-night.png`,
`light-fix-shadow-rule.png`, `light-fix-lamp.png`.
