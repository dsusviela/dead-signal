/* Dead Signal raid boss: PATIENT FURNACE.
 *
 * This file deliberately owns the whole encounter.  The parent supplies actor
 * movement, damage and effects through DSGame.api(); boss.fx
 * and boss.ai contain only JSON-shaped data so snapshots remain safe.
 */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  // The disposal yard is a square: its chain-link fence stands on x/y = +-ARENA_R (world.js inner-arena lot),
  // and every bound below (survivors, knockback, the furnace, its carriers) uses that same square.
  var ARENA_X = 0, ARENA_Y = 0, ARENA_R = 370, PLAY = ARENA_R - 10;
  var COLORS = {
    ash: '#171d22', iron: '#29323a', iron2: '#3c4850', edge: '#0b1014',
    rust: '#8f3d29', ember: '#ff6a2a', hot: '#ffad36', white: '#fff0bd',
    warning: '#f4bf48', danger: '#e34c35', cyan: '#8bd6d1', smoke: '#63747a'
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function alivePlayers(s) { return (s.players || []).filter(function (p) { return p && !p.dead && p.hp > 0; }); }
  function keyOf(p, index) { return p && p.id != null ? p.id : index; }
  function random(api) { return api && typeof api.random === 'function' ? api.random() : Math.random(); }
  function findPlayer(s, key) {
    var ps = s.players || [], i;
    for (i = 0; i < ps.length; i++) if (keyOf(ps[i], i) === key) return ps[i];
    return null;
  }
  function playerKey(s, p) {
    var ps = s.players || [], i = ps.indexOf(p);
    return keyOf(p, i < 0 ? 0 : i);
  }
  function announce(api, text) { if (api && typeof api.announce === 'function') api.announce(text); }
  function effect(api, x, y, text, color) { if (api && typeof api.effect === 'function') api.effect(x, y, text, color); }
  function hurt(api, p, amount, kx, ky) {
    if (!p || p.dead || p.hp <= 0 || !api || typeof api.hurt !== 'function') return;
    // game.js keeps survivors inside the square yard (ARENA.play) during ordinary movement, but
    // knockback is applied by its damage API. Clamp the impulse to that same square so a slam
    // can never throw somebody out of the encounter.
    if (kx || ky) {
      var limit = PLAY - (p.r || 10), scale = 1, px = (p.x || 0) - ARENA_X, py = (p.y || 0) - ARENA_Y;
      if (Math.abs(px + kx) > limit && kx) scale = Math.min(scale, Math.max(0, (limit - Math.abs(px)) / Math.abs(kx)));
      if (Math.abs(py + ky) > limit && ky) scale = Math.min(scale, Math.max(0, (limit - Math.abs(py)) / Math.abs(ky)));
      kx *= scale; ky *= scale;
    }
    api.hurt(p, amount, kx || 0, ky || 0);
  }
  function addFx(b, f) {
    f.life = f.life == null ? (f.dur == null ? 1 : f.dur) : f.life;
    if (f.dur == null) f.dur = f.life;
    b.fx.push(f);
    return f;
  }
  function livingKey(p, i) { return p && p.id != null ? String(p.id) : String(i); }
  function hpDamage(p, fraction, b) {
    return (p.maxHp || 100) * fraction * (b.difficulty ? b.difficulty.damageScale : 1);
  }

  function moveEntity(api, entity, dx, dy) {
    if (!entity || (!dx && !dy)) return;
    if (api && typeof api.move === 'function') api.move(entity, dx, dy);
    else { entity.x += dx; entity.y += dy; }
  }
  function moveBoss(b, api, tx, ty, speed, dt) {
    var dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
    var step = Math.min(d, speed * dt), nx = dx / d * step, ny = dy / d * step;
    moveEntity(api, b, nx, ny);
    var lim = ARENA_R - 25 - (b.r || 0) * 0;
    b.x = clamp(b.x, ARENA_X - lim, ARENA_X + lim); b.y = clamp(b.y, ARENA_Y - lim, ARENA_Y + lim);
  }
  function targetNearest(s, b) {
    var ps = alivePlayers(s), best = null, bd = Infinity;
    ps.forEach(function (p) { var d = dist(p.x, p.y, b.x, b.y); if (d < bd) { bd = d; best = p; } });
    return best;
  }
  function randomTargets(s, api, count) {
    var ps = alivePlayers(s).slice(), out = [];
    while (ps.length && out.length < count) {
      var i = Math.floor(random(api) * ps.length);
      out.push(ps.splice(i, 1)[0]);
    }
    return out;
  }

  function resetCast(b) {
    b.ai.cast = null;
    b.castName = '';
    b.castProgress = 0;
  }
  function cast(b, key, name, duration, extra) {
    b.ai.cast = { key: key, t: duration, dur: duration };
    if (extra) Object.keys(extra).forEach(function (k) { b.ai.cast[k] = extra[k]; });
    b.castName = name;
    b.castProgress = 0;
  }
  function tell(b, kind, x, y, r, dur, color) {
    return addFx(b, { kind: kind, x: x, y: y, r: r, life: dur, dur: dur, color: color });
  }

  function damageCircle(s, api, b, x, y, r, fraction, knock, hitMap) {
    (s.players || []).forEach(function (p, i) {
      if (!p || p.dead || dist(p.x, p.y, x, y) > r + (p.r || 10)) return;
      var k = livingKey(p, i);
      if (hitMap && hitMap[k]) return;
      if (hitMap) hitMap[k] = 1;
      var a = Math.atan2(p.y - y, p.x - x);
      hurt(api, p, hpDamage(p, fraction, b), Math.cos(a) * (knock || 0), Math.sin(a) * (knock || 0));
    });
  }
  function damageRing(s, api, b, f, previous, current) {
    // width is the visual band width; use half on each side so the first
    // outward tick does not reach through the advertised inner safe disc.
    var half = (f.width || 12) * 0.5;
    var lo = Math.min(previous, current) - half, hi = Math.max(previous, current) + half;
    (s.players || []).forEach(function (p, i) {
      if (!p || p.dead) return;
      var d = dist(p.x, p.y, f.x, f.y), k = livingKey(p, i);
      if (d >= lo && d <= hi && !f.hit[k]) {
        f.hit[k] = 1;
        var a = Math.atan2(p.y - f.y, p.x - f.x);
        hurt(api, p, hpDamage(p, f.fraction || 0.12, b), Math.cos(a) * (f.knock || 0), Math.sin(a) * (f.knock || 0));
      }
    });
  }
  function spawnCarrier(s, api, b, phase3) {
    var side = Math.floor(random(api) * 4), x, y, edge = ARENA_R - 26;
    if (side === 0) { x = ARENA_X - edge; y = ARENA_Y + (random(api) * 2 - 1) * edge; }
    else if (side === 1) { x = ARENA_X + edge; y = ARENA_Y + (random(api) * 2 - 1) * edge; }
    else if (side === 2) { x = ARENA_X + (random(api) * 2 - 1) * edge; y = ARENA_Y - edge; }
    else { x = ARENA_X + (random(api) * 2 - 1) * edge; y = ARENA_Y + edge; }
    var carrierScale = b.difficulty && b.difficulty.hpScale ? b.difficulty.hpScale : 1;
    var carrierHp = (phase3 ? 95 : 75) * carrierScale;
    var extra = { bossOwned: true, bossLocked: true, bossCarrier: true, bossId: b.id, noTouch: true,
      speed: phase3 ? 38 : 31, hp: carrierHp, maxHp: carrierHp,
      damage: 0, color: phase3 ? COLORS.danger : COLORS.hot };
    var c = api && typeof api.spawn === 'function' ? api.spawn('carrier', x, y, extra) : null;
    if (c) { c.bossOwned = true; c.bossCarrier = true; c.bossId = b.id; }
    b.ai.carrierN = (b.ai.carrierN || 0) + 1;
    effect(api, x, y, 'CARRIER', phase3 ? COLORS.danger : COLORS.hot);
  }
  function findCarrier(s, id) {
    return (s.enemies || []).find(function (e) { return e && (e.id === id || e === id); });
  }
  function tickCarriers(s, api, b, dt) {
    var enemies = s.enemies || [], bossId = b.id;
    enemies.forEach(function (c) {
      // game.js removes dead actors after the boss update. Check hp as well as
      // dead so a carrier killed by the last player shot cannot still feed.
      if (!c || c.dead || c.hp <= 0 || !c.bossCarrier || c.bossId !== bossId) return;
      var dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy) || 1;
      moveEntity(api, c, dx / d * Math.min(d, (c.speed || 31) * dt), dy / d * Math.min(d, (c.speed || 31) * dt));
      if (d < b.r + 17) {
        c.dead = true;
        var players = (b.difficulty && b.difficulty.players) || 1;
        var heal = (b.phase === 3 ? 0.055 : 0.08) * (0.4 + 0.15 * players);
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * heal);
        b.ai.fed = (b.ai.fed || 0) + 1;
        effect(api, b.x, b.y - 30, 'FURNACE FED', phaseColor(b));
        addFx(b, { kind: 'feed', x: b.x, y: b.y, r: 40, life: 0.6, dur: 0.6, color: phaseColor(b) });
      }
    });
  }
  function phaseColor(b) { return b.phase >= 3 ? COLORS.danger : b.phase === 2 ? COLORS.hot : COLORS.ember; }

  function phaseTransition(b, api, phase) {
    b.phase = phase;
    b.ai.mode = 'transition';
    b.ai.transition = 2.2;
    b.ai.cast = null;
    b.ai.next = phase === 2 ? 'vent' : 'slam';
    b.ai.timer = 1.1;
    b.ai.carrierTimer = phase === 2 ? 3.5 : 7;
    b.castName = phase === 2 ? 'CORE TEMPERATURE CRITICAL' : 'CONTAINMENT SHELL FAILING';
    b.castProgress = 0;
    announce(api, phase === 2 ? 'THE PATIENT FURNACE OPENS' : 'THE PATIENT FURNACE CRACKS');
    effect(api, b.x, b.y, phase === 2 ? 'FORGE OPEN' : 'CAULDRON CRACKS', phaseColor(b));
    addFx(b, { kind: 'burst', x: b.x, y: b.y, r: 100, life: 1.0, dur: 1.0, color: phaseColor(b) });
  }

  function startSlam(b, api, duration) {
    var r = b.phase === 3 ? 94 : 82;
    cast(b, 'slam', 'FURNACE HAMMER', duration, { r: r });
    tell(b, 'slamTell', b.x, b.y, r, duration, COLORS.ember);
    announce(api, 'IMPACT ARM RAISED — CLEAR THE ZONE');
  }
  function startOuterRing(b, api, duration) {
    var r = b.phase === 3 ? 112 : 96;
    cast(b, 'outerRing', 'OUTER CINDER RING', duration, { r: r });
    tell(b, 'safeDisc', b.x, b.y, r - 11, duration + 1.1, COLORS.cyan);
    announce(api, 'HEAT PULSE OUTWARD — CLOSE IN ON THE SUBJECT');
  }
  function startInnerRing(b, api, duration) {
    var r = 346;
    cast(b, 'innerRing', 'INWARD CINDER RING', duration, { r: r });
    tell(b, 'innerTell', b.x, b.y, r, duration, COLORS.warning);
    announce(api, 'HEAT PULSE INWARD — MOVE THROUGH THE GAPS');
  }
  function startVent(b, api) {
    cast(b, 'vent', 'VENTING', 1.35);
    tell(b, 'ventTell', b.x, b.y, 58, 1.35, COLORS.warning);
    announce(api, 'PRESSURE VENT — STAND CLEAR');
  }
  function startMarks(b, api, s) {
    var count = Math.min(2, Math.max(1, alivePlayers(s).length));
    var targets = randomTargets(s, api, count).map(function (p) { return playerKey(s, p); });
    cast(b, 'marks', 'EMBER MARKS', 2.65, { targets: targets });
    targets.forEach(function (id) {
      var p = findPlayer(s, id);
      if (p) tell(b, 'mark', p.x, p.y, 38, 2.65, COLORS.danger).target = id;
    });
    announce(api, 'THERMAL MARKERS — SPREAD OUT');
  }
  function startBurn(b, api, s) {
    var count = Math.min(3, Math.max(1, alivePlayers(s).length));
    var targets = randomTargets(s, api, count).map(function (p) { return playerKey(s, p); });
    cast(b, 'burn', 'BURNING CHANNEL', 3.6, { targets: targets, pulse: 0.45 });
    targets.forEach(function (id) {
      var p = findPlayer(s, id);
      if (p) tell(b, 'burnTell', p.x, p.y, 26, 3.6, COLORS.danger).target = id;
    });
    announce(api, 'INCINERATION CHANNEL — BREAK LINE OF CONTACT');
  }
  function resolveCast(s, api, b, c) {
    var ps = alivePlayers(s), i;
    if (c.key === 'slam') {
      damageCircle(s, api, b, b.x, b.y, c.r, 0.22, b.phase === 3 ? 125 : 78);
      addFx(b, { kind: 'impact', x: b.x, y: b.y, r: c.r + 45, life: 0.5, dur: 0.5, color: COLORS.hot });
      addFx(b, { kind: 'ring', x: b.x, y: b.y, r: 30, previous: 30, max: c.r + 65, speed: 330, width: 10, fraction: 0.08, knock: 35, dir: 1, hit: {}, life: (c.r + 65) / 330 + 0.25, dur: (c.r + 65) / 330 + 0.25, color: COLORS.hot });
      effect(api, b.x, b.y, 'SLAM', COLORS.hot);
      b.ai.timer = b.phase === 1 ? 1.7 : 2.25;
    } else if (c.key === 'outerRing') {
      addFx(b, { kind: 'ring', x: b.x, y: b.y, r: c.r, previous: c.r, max: ARENA_R + 18, speed: 104, width: 13, fraction: 0.14, knock: 0, dir: 1, hit: {}, life: (ARENA_R + 18 - c.r) / 104 + 0.25, dur: (ARENA_R + 18 - c.r) / 104 + 0.25, color: COLORS.warning });
      // Let the ring finish before another mandatory cast starts.
      b.ai.timer = (ARENA_R + 18 - c.r) / 104 + 0.3;
    } else if (c.key === 'innerRing') {
      addFx(b, { kind: 'ring', x: b.x, y: b.y, r: c.r, previous: c.r, max: 24, speed: 75, width: 14, fraction: 0.13, knock: 0, dir: -1, hit: {}, life: (c.r - 24) / 75 + 0.35, dur: (c.r - 24) / 75 + 0.35, color: COLORS.warning });
      b.ai.timer = (c.r - 24) / 75 + 0.35;
    } else if (c.key === 'vent') {
      for (i = 0; i < Math.min(8, 3 + ps.length * 2); i++) {
        var a = i * TAU / Math.min(8, 3 + ps.length * 2) + random(api) * 0.24;
        addFx(b, { kind: 'pool', x: b.x + Math.cos(a) * (32 + random(api) * 44), y: b.y + Math.sin(a) * (32 + random(api) * 44), r: 22, life: 7, dur: 7, tick: 0, fraction: 0.045, color: COLORS.ember });
      }
      for (i = 0; i < 2 + ps.length; i++) {
        var an = random(api) * TAU, rr = 55 + random(api) * 75;
        if (api && typeof api.spawn === 'function') api.spawn('runner', b.x + Math.cos(an) * rr, b.y + Math.sin(an) * rr, { bossOwned: true, bossLocked: true, bossId: b.id, speed: 48, damage: 5 });
      }
      effect(api, b.x, b.y, 'VENT', COLORS.ember);
      b.ai.timer = 1.4;
    } else if (c.key === 'marks') {
      (c.targets || []).forEach(function (id) {
        var p = findPlayer(s, id); if (!p || p.dead) return;
        addFx(b, { kind: 'pool', x: p.x, y: p.y, r: 40, life: 8, dur: 8, tick: 0, fraction: 0.055, color: COLORS.danger });
        damageCircle(s, api, b, p.x, p.y, 42, 0.16, 0);
        effect(api, p.x, p.y, 'EMBER', COLORS.danger);
      });
      b.ai.timer = 1.1;
    } else if (c.key === 'burn') {
      (c.targets || []).forEach(function (id) {
        var p = findPlayer(s, id); if (!p || p.dead) return;
        addFx(b, { kind: 'pool', x: p.x, y: p.y, r: 30, life: 6, dur: 6, tick: 0, fraction: 0.06, color: COLORS.danger });
        damageCircle(s, api, b, p.x, p.y, 34, 0.17, 42);
      });
      effect(api, b.x, b.y, 'CHANNEL BROKEN', COLORS.white);
      b.ai.timer = 0.9;
    }
    resetCast(b);
  }

  function tickFx(s, api, b, dt) {
    var keep = [], f, i, p, d, prev;
    for (i = 0; i < b.fx.length; i++) {
      f = b.fx[i];
      if (!f || f.life <= 0) continue;
      if (f.kind === 'ring') {
        prev = f.r;
        f.previous = prev;
        f.r += (f.dir > 0 ? 1 : -1) * f.speed * dt;
        damageRing(s, api, b, f, prev, f.r);
        if ((f.dir > 0 && f.r >= f.max) || (f.dir < 0 && f.r <= f.max)) f.life = 0;
      } else if (f.kind === 'pool') {
        f.tick = (f.tick || 0) - dt;
        if (f.tick <= 0) {
          f.tick = 0.48;
          // Pools pulse repeatedly while occupied; rings keep a separate
          // one-hit map because their moving edge should only catch once.
          damageCircle(s, api, b, f.x, f.y, f.r, f.fraction || 0.04, 0);
        }
      } else if (f.kind === 'burnTell') {
        p = findPlayer(s, f.target);
        if (p) { f.x = p.x; f.y = p.y; }
        f.pulse = (f.pulse || 0) - dt;
        if (f.pulse <= 0) {
          f.pulse = 0.7;
          if (p && !p.dead) hurt(api, p, hpDamage(p, 0.045, b), 0, 0);
        }
      } else if (f.kind === 'mark') {
        p = findPlayer(s, f.target); if (p && f.life > f.dur * 0.48) { f.x = p.x; f.y = p.y; }
      }
      f.life -= dt;
      if (f.life > 0) keep.push(f);
    }
    b.fx = keep;
  }

  function tickTouch(s, api, b, dt) {
    var ps = s.players || [], i, p, k, d;
    b.ai.touch = b.ai.touch || {};
    for (i = 0; i < ps.length; i++) {
      p = ps[i]; k = livingKey(p, i); b.ai.touch[k] = Math.max(0, (b.ai.touch[k] || 0) - dt);
      if (!p || p.dead || b.ai.touch[k] > 0) continue;
      d = dist(p.x, p.y, b.x, b.y);
      if (d < b.r + (p.r || 10)) { hurt(api, p, hpDamage(p, 0.045, b), 0, 0); b.ai.touch[k] = 0.65; }
    }
  }

  function chooseCast(s, api, b) {
    var a = b.ai;
    if (a.timer > 0 || a.cast || a.mode !== 'active') return;
    var p = targetNearest(s, b), d = p ? dist(p.x, p.y, b.x, b.y) : 999;
    a.cycle = (a.cycle || 0) + 1;
    if (b.phase === 1) {
      if (p && d > 105) { moveBoss(b, api, p.x, p.y, 62, 0.25); a.timer = 0.25; return; }
      if (a.next === 'slam') { startSlam(b, api, a.cycle === 1 ? 2.05 : 1.6); a.next = 'outer'; }
      else { startOuterRing(b, api, 2.5); a.next = 'slam'; }
    } else if (b.phase === 2) {
      var pattern = (a.cycle - 1) % 3;
      if (pattern === 0) startVent(b, api);
      else if (pattern === 1) startMarks(b, api, s);
      else startInnerRing(b, api, 2.45);
      a.carrierTimer = Math.min(a.carrierTimer, 4.2);
    } else {
      if (a.next === 'slam') { startSlam(b, api, 1.55); a.next = 'outer'; }
      else if (a.next === 'outer') { startOuterRing(b, api, 2.15); a.next = 'burn'; }
      else if (a.next === 'burn') { startBurn(b, api, s); a.next = 'inner'; }
      else { startInnerRing(b, api, 2.3); a.next = 'slam'; }
    }
  }

  function update(s, dt, api) {
    var b = s.boss;
    if (!b || !b.active) return;
    dt = clamp(Number(dt) || 0, 0, 0.1);
    tickFx(s, api, b, dt);
    tickCarriers(s, api, b, dt);
    if (b.hp <= 0) { defeat(s, api); return; }
    var ratio = b.hp / b.maxHp;
    if (b.phase === 1 && ratio <= 0.66) phaseTransition(b, api, 2);
    else if (b.phase === 2 && ratio <= 0.33) phaseTransition(b, api, 3);

    if (b.ai.mode === 'intro') {
      b.ai.intro -= dt;
      b.castName = 'SUBJECT ACTIVE';
      b.castProgress = clamp(1 - b.ai.intro / 2.5, 0, 1);
      if (b.ai.intro <= 0) { b.ai.mode = 'active'; b.castName = ''; b.castProgress = 0; announce(api, 'SUBJECT MOBILE'); }
      return;
    }
    if (b.ai.mode === 'transition') {
      b.ai.transition -= dt;
      b.castProgress = clamp(1 - b.ai.transition / 2.2, 0, 1);
      if (b.ai.transition <= 0) { b.ai.mode = 'active'; b.castName = ''; b.castProgress = 0; }
      return;
    }
    if (b.ai.cast) {
      var c = b.ai.cast;
      c.t -= dt; b.castProgress = clamp(1 - c.t / c.dur, 0, 1);
      if (c.key === 'burn' && c.t > 0) {
        c.pulse = (c.pulse || 0) - dt;
        if (c.pulse <= 0) {
          c.pulse = 0.72;
          (c.targets || []).forEach(function (id) { var p = findPlayer(s, id); if (p && !p.dead) hurt(api, p, hpDamage(p, 0.04, b), 0, 0); });
        }
      }
      if (c.t <= 0) resolveCast(s, api, b, c);
      return;
    }
    b.ai.timer -= dt;
    if (b.phase === 1 || b.phase === 3) {
      var target = targetNearest(s, b);
      if (target) {
        var distance = dist(target.x, target.y, b.x, b.y);
        if (distance > 96 || (b.phase === 3 && b.ai.timer > 0)) moveBoss(b, api, target.x, target.y, b.phase === 3 ? 48 : 55, dt);
      }
    }
    if (b.phase >= 2) {
      b.ai.carrierTimer -= dt;
      if (b.ai.carrierTimer <= 0) { b.ai.carrierTimer = b.phase === 2 ? 7.8 : 11.5; spawnCarrier(s, api, b, b.phase === 3); }
    }
    tickTouch(s, api, b, dt);
    chooseCast(s, api, b);
  }

  function start(s, api) {
    // Release seats before placing the squad in the arena; the next car tick
    // must never pull a survivor back out of the containment yard.
    var parkCars = api && api.ejectVehicles ? api.ejectVehicles() : null;
    s.players = s.players || [];
    var n = Math.max(1, Math.min(4, s.players.filter(function (p) { return p && !p.dead; }).length));
    // Two separate prices, both captured on commit and never touched again.
    //
    // HP prices the squad's POWER: it tracks level at half the exponent of the
    // damage upgrade (1.13 per pick, roughly one pick in three), so a stronger
    // squad meets a bigger furnace but still kills it measurably faster. That
    // is what makes time spent levelling worth spending.
    //
    // Damage prices the CLOCK: it still climbs every 90s of outbreak. Dawdling
    // does not give the furnace more health to chew through, it gives it a
    // harder swing. You can out-prepare a long run; you cannot out-prepare
    // being slow.
    var tier = 1 + Math.floor(Math.max(0, Number(s.time) || 0) / 90);
    var level = Math.max(1, Number(s.level) || 1);
    var partyScale = 1 + 0.9 * (n - 1);
    var hpScale = Math.pow(1.13, (level - 1) / 6);
    var scale = partyScale * hpScale, baseHp = 9600;
    var b = {
      id: 'patient-furnace', type: 'boss', name: 'PATIENT FURNACE', x: ARENA_X, y: ARENA_Y,
      r: 31, hp: Math.round(baseHp * scale), maxHp: Math.round(baseHp * scale), phase: 1,
      active: true, dead: false, castName: 'SUBJECT ACTIVE', castProgress: 0,
      difficulty: { tier: tier, players: n, level: level, partyScale: partyScale, hpScale: hpScale, damageScale: (1 + 0.08 * (n - 1)) * (1 + 0.08 * (tier - 1)) },
      ai: { mode: 'intro', intro: 2.5, transition: 0, cast: null, next: 'slam', timer: 1.2,
        cycle: 0, carrierTimer: 5.5, carrierN: 0, fed: 0, touch: {} },
      fx: [], fury: 0
    };
    s.boss = b;
    s.arena = { x: ARENA_X, y: ARENA_Y, r: ARENA_R, half: ARENA_R, play: PLAY, shape: 'square' };
    if (api && typeof api.sealArena === 'function') api.sealArena();
    var party = s.players.filter(function (p) { return p && !p.dead; });
    party.forEach(function (p, i) { var a = i * TAU / Math.max(1, party.length); p.x = ARENA_X + Math.cos(a) * 92; p.y = ARENA_Y + Math.sin(a) * 92; p.invuln = Math.max(p.invuln || 0, 1.0); });
    // Downed survivors stay down, but are brought into the arena edge so a
    // living teammate can reach the revive radius during the encounter.
    s.players.filter(function (p) { return p && p.dead; }).forEach(function (p, i) {
      var a = (party.length + i) * TAU / Math.max(1, s.players.length);
      p.x = ARENA_X + Math.cos(a) * 320; p.y = ARENA_Y + Math.sin(a) * 320;
    });
    if (parkCars) parkCars();
    announce(api, 'CONTAINMENT BREACHED · GATES SEALED');
    return b;
  }

  function hit(s, amount, api) {
    var b = s && s.boss;
    if (!b || !b.active || b.dead || !isFinite(amount)) return false;
    b.hp = Math.max(0, b.hp - Math.max(0, amount));
    b.flash = 0.08;
    if (b.hp <= 0) defeat(s, api);
    return true;
  }
  // Both death paths end here once: the fight is over but the run is not. game.js reopens the gates, lowers the
  // city's convergence and unlocks the command payload (CITY.md Phase 11/12).
  function defeat(s, api) {
    var b = s.boss; if (!b || b.dead) return;
    b.hp = 0; b.active = false; b.dead = true; resetCast(b); b.castName = ''; b.castProgress = 0; b.fx = [];
    announce(api, 'SUBJECT NEUTRALISED');
    if (api && typeof api.bossDefeated === 'function') api.bossDefeated();
  }

  function drawGround(ctx, s) {
    var b = s && s.boss; if (!b || !ctx) return;
    var f, i, p;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(9,14,17,0.82)'; ctx.fillRect(ARENA_X - ARENA_R, ARENA_Y - ARENA_R, ARENA_R * 2, ARENA_R * 2);
    ctx.strokeStyle = 'rgba(139,214,209,0.28)'; ctx.lineWidth = 3; ctx.strokeRect(ARENA_X - ARENA_R, ARENA_Y - ARENA_R, ARENA_R * 2, ARENA_R * 2);
    ctx.strokeStyle = 'rgba(95,111,112,0.22)'; ctx.lineWidth = 1; for (i = 0; i < 16; i++) { var a = i * TAU / 16; ctx.beginPath(); ctx.moveTo(ARENA_X + Math.cos(a) * 50, ARENA_Y + Math.sin(a) * 50); ctx.lineTo(ARENA_X + Math.cos(a) * ARENA_R, ARENA_Y + Math.sin(a) * ARENA_R); ctx.stroke(); }
    for (i = 0; i < b.fx.length; i++) {
      f = b.fx[i]; if (!f || f.life <= 0) continue;
      var q = clamp(f.life / (f.dur || 1), 0, 1), pulse = 0.5 + 0.5 * Math.sin((s.time || 0) * 8);
      if (f.kind === 'slamTell') {
        ctx.fillStyle = 'rgba(227,76,53,' + (0.10 + 0.16 * (1 - q) + 0.04 * pulse) + ')'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = COLORS.ember; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      } else if (f.kind === 'safeDisc') {
        ctx.fillStyle = 'rgba(139,214,209,0.12)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,240,189,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
      } else if (f.kind === 'innerTell') {
        ctx.strokeStyle = 'rgba(244,191,72,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      } else if (f.kind === 'ring') {
        ctx.strokeStyle = f.color || COLORS.warning; ctx.lineWidth = f.width || 12; ctx.globalAlpha = 0.82; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0, f.r), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.kind === 'pool') {
        ctx.fillStyle = 'rgba(227,76,53,0.22)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); ctx.strokeStyle = f.color || COLORS.ember; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,173,54,0.7)'; for (var k = -1; k <= 1; k++) ctx.fillRect(Math.round(f.x + k * 8), Math.round(f.y - 1), 3, 3);
      } else if (f.kind === 'mark') {
        ctx.strokeStyle = COLORS.danger; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.1 - q * 0.2), 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(227,76,53,0.18)'; ctx.fillRect(Math.round(f.x - 5), Math.round(f.y - 5), 10, 10);
      } else if (f.kind === 'burnTell') {
        ctx.strokeStyle = 'rgba(227,76,53,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(b.x, b.y - 12); ctx.lineTo(f.x, f.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = COLORS.danger; ctx.lineWidth = 4; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(f.x, f.y, f.r + pulse * 4, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = COLORS.hot; ctx.fillRect(Math.round(f.x - 2), Math.round(f.y - 2), 5, 5);
      } else if (f.kind === 'impact' || f.kind === 'burst') {
        ctx.strokeStyle = f.color || COLORS.hot; ctx.globalAlpha = q; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.25 - q * 0.25), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    // A thin route from each carrier to the boss makes the interruptible heal
    // legible even when the carrier is behind another actor.
    (s.enemies || []).forEach(function (e) {
      if (!e || e.dead || !e.bossCarrier || e.bossId !== b.id) return;
      ctx.strokeStyle = 'rgba(255,173,54,0.28)'; ctx.lineWidth = 2; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.restore();
  }

  function drawBody(ctx, s) {
    var b = s && s.boss; if (!b || !ctx || (!b.active && b.hp <= 0)) return;
    var t = s.time || 0, c = b.ai && b.ai.cast, prog = b.castProgress || 0;
    var arm = 0.22 + Math.sin(t * 2) * 0.035, maul = 0.32, lean = 0, squash = 1;
    if (b.ai.mode === 'intro') { arm = -0.6 + prog * 2.4; maul = -0.65 + prog * 0.5; }
    else if (b.ai.mode === 'transition') { arm = b.phase === 2 ? -0.7 + prog * 2.2 : 1.8 - prog * 1.5; maul = b.phase === 2 ? -0.9 + prog * 1.2 : -2 + prog * 2.3; lean = b.phase === 2 ? 0.04 : -0.05; }
    else if (c && c.key === 'slam') { arm = prog < 0.7 ? -0.55 + prog * 4.0 : 2.25 - (prog - 0.7) * 8; maul = prog < 0.75 ? -0.7 : -2.45; lean = prog > 0.76 ? 0.12 : -0.05; squash = prog > 0.83 ? 0.88 : 1.03; }
    else if (c && c.key === 'outerRing') { arm = prog < 0.45 ? prog * 3.8 : 1.7 - (prog - 0.45) * 4.5; maul = 1.45 - prog * 2.5; }
    else if (c && c.key === 'innerRing') { arm = prog < 0.35 ? prog * 4 : 1.4 - (prog - 0.35) * 2; maul = 1.2 - prog * 1.7; }
    else if (c && c.key === 'vent') { arm = Math.sin(prog * TAU * 2) * 1.8; maul = -1 + Math.sin(prog * TAU * 2) * 0.6; squash = 1 - 0.08 * Math.max(0, Math.sin(prog * TAU * 2)); }
    else if (c && c.key === 'marks') { arm = -0.3; maul = -0.7; lean = -0.04; }
    else if (c && c.key === 'burn') { arm = -0.9 + Math.sin(t * 5) * 0.08; maul = -0.8; lean = 0.02; }
    var bob = Math.abs(Math.sin(t * 6)) * (b.ai.mode === 'active' && !c ? 2 : 0), x = Math.round(b.x), y = Math.round(b.y - bob);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(x, y); ctx.rotate(lean); ctx.scale(1 / Math.sqrt(squash), squash);
    var heat = b.phase >= 3 ? COLORS.danger : (c && c.key === 'burn' ? COLORS.white : COLORS.ember);
    // The body is a true den-2 sprite; articulated arms stay separate so every
    // cast keeps its readable wind-up and follow-through.
    var A = root.DSArt, fresh = !!(A && A.spec && A.spec('boss/body'));
    if (A) {
      A.shadow(ctx, 3, 37, 43, .68);
      A.glow(ctx, 0, -1, b.phase >= 3 ? 92 : 72, b.phase >= 3 ? '#ff543b' : '#ff6a2a', b.phase >= 3 ? '40' : '2c');
      if (fresh) {
        A.draw(ctx, 'boss/body', 0, 40, { variant: Math.max(0, Math.min(2, b.phase - 1)), flash: b.flash > 0 });
        if (A.spec('boss/core')) A.draw(ctx, 'boss/core', 0, -1, { frame: Math.floor(t * (b.phase >= 3 ? 10 : 5)) & 1, variant: b.phase >= 3 ? 1 : 0 });
      } else {
        A.draw(ctx, 'furnace', 0, 39, { scale: 1.42, flash: b.flash > 0 });
        ctx.fillStyle = heat; ctx.fillRect(-10, -6, 20, 10); ctx.fillStyle = COLORS.white; ctx.fillRect(-5, -4, 10, 4);
      }
    }
    // Left arm, articulated shoulder and maul; the rig (arm/maul angles) is the choreography and stays as is.
    ctx.save(); ctx.translate(-29, -18); ctx.rotate(arm);
    if (fresh && A.spec('boss/arm')) A.draw(ctx, 'boss/arm', 0, -4, { anchorX: .5, anchorY: 0, variant: Math.min(2, b.phase - 1) });
    else { ctx.fillStyle = COLORS.edge; ctx.fillRect(-7, -5, 14, 48); ctx.fillStyle = COLORS.iron2; ctx.fillRect(-5, -3, 10, 42); ctx.fillStyle = COLORS.rust; ctx.fillRect(-6, 15, 12, 7); }
    ctx.translate(0, 40); ctx.rotate(maul - arm);
    if (fresh && A.spec('boss/maulShaft')) { A.draw(ctx, 'boss/maulShaft', 0, -6, { anchorX: .5, anchorY: 0 }); A.draw(ctx, 'boss/maulHead', 0, 40, { anchorX: .5, anchorY: .35, variant: b.phase >= 3 ? 2 : (c && c.key === 'burn') ? 1 : 0 }); }
    else { ctx.fillStyle = COLORS.edge; ctx.fillRect(-3, -7, 6, 46); ctx.fillStyle = '#6d594b'; ctx.fillRect(-2, -2, 4, 40); ctx.fillStyle = COLORS.iron2; ctx.fillRect(-13, 31, 26, 17); ctx.fillStyle = COLORS.edge; ctx.fillRect(-17, 38, 34, 9); ctx.fillStyle = heat; ctx.fillRect(-9, 36, 18, 4); }
    ctx.restore();
    // Spare right arm hangs like a gantry; phase 3 burns at its seam.
    if (fresh && A.spec('boss/armRight')) A.draw(ctx, 'boss/armRight', 33, -18, { anchorX: .5, anchorY: 0, variant: b.phase >= 3 ? 1 : 0 });
    else { ctx.fillStyle = COLORS.edge; ctx.fillRect(26, -18, 14, 43); ctx.fillStyle = COLORS.iron2; ctx.fillRect(28, -15, 9, 35); ctx.fillStyle = b.phase >= 3 ? COLORS.danger : COLORS.rust; ctx.fillRect(27, 3, 11, 5); }
    // Hot motes, kept square to preserve the pixel silhouette.
    ctx.fillStyle = COLORS.hot; for (var i = 0; i < 5; i++) { var aa = t * (1.2 + i * 0.2) + i; ctx.fillRect(Math.round(Math.cos(aa) * (32 + i * 4)), Math.round(-55 + Math.sin(aa * 1.4) * 12), 3, 3); }
    ctx.restore();
  }

  function inside(x, y) { return Math.abs(x - ARENA_X) <= ARENA_R && Math.abs(y - ARENA_Y) <= ARENA_R; }

  var DSBoss = { start: start, update: update, drawGround: drawGround, drawBody: drawBody, hit: hit, inside: inside };
  root.DSBoss = DSBoss;
  if (typeof module !== 'undefined' && module.exports) module.exports = DSBoss;
}(typeof window !== 'undefined' ? window : globalThis));
