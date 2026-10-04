// Storyline core: level parsing + player physics. No DOM, so tools/validate.mjs can run it in node.
(function (G) {
  const T = 32;
  const PHYS = {
    g: 2100, jumpV: 700, runV: 250, accel: 2600, airAccel: 1700, fric: 3000,
    springV: 1180, maxFall: 950, coyote: 0.09, buffer: 0.12, cut: 0.45,
    w: 20, h: 28,
  };

  // Legend:
  //  # ground   = one-way wood   ^ thorns   S start   E exit (storybook)
  //  o note     P torn page      K piano-key spring   L lamp checkpoint
  //  x ink blot (patrols)        C crumbling leaf     M moving platform (horiz)  V moving (vert)
  function parseLevel(def) {
    const rows = def.map;
    const h = rows.length;
    const w = Math.max(...rows.map(r => r.length));
    const tiles = [];
    const L = { w, h, tiles, notes: [], pages: [], springs: [], lamps: [], enemies: [],
      crumbles: [], movers: [], start: { x: 64, y: 64 }, exit: null };
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const c = rows[y][x] || ' ';
        let t = 0;
        const px = x * T, py = y * T;
        switch (c) {
          case '#': t = 1; break;
          case '=': t = 2; break;
          case '^': t = 3; break;
          case 'S': L.start = { x: px + 6, y: py + T - PHYS.h }; break;
          case 'E': L.exit = { x: px - 8, y: py - 32, w: 48, h: 64 }; break;
          case 'o': L.notes.push({ x: px + 16, y: py + 16, got: false }); break;
          case 'P': L.pages.push({ x: px + 16, y: py + 16, got: false }); break;
          case 'K': L.springs.push({ x: px + 2, y: py + 18, w: 28, h: 14, squash: 0 }); break;
          case 'L': L.lamps.push({ x: px + 16, y: py + T, lit: false }); break;
          case 'x': L.enemies.push({ x: px + 4, y: py + 8, w: 24, h: 24, vx: -60, alive: true, x0: px + 4, y0: py + 8, poof: 0 }); break;
          case 'C': L.crumbles.push({ x: px, y: py, w: T, h: 12, x0: px, y0: py, t: -1, state: 'idle', vy: 0 }); break;
          case 'M': L.movers.push({ x: px, y: py, w: 64, h: 14, x0: px, y0: py, axis: 'x', amp: 96, speed: 1.1, phase: x * 0.37, dx: 0, dy: 0 }); break;
          case 'V': L.movers.push({ x: px, y: py, w: 64, h: 14, x0: px, y0: py, axis: 'y', amp: 80, speed: 1.0, phase: x * 0.37, dx: 0, dy: 0 }); break;
        }
        row.push(t);
      }
      tiles.push(row);
    }
    return L;
  }

  function tileAt(L, tx, ty) {
    if (tx < 0 || tx >= L.w) return 1; // side walls
    if (ty < 0) return 0;
    if (ty >= L.h) return 0;
    return L.tiles[ty][tx];
  }

  function newPlayer(L) {
    return { x: L.start.x, y: L.start.y, vx: 0, vy: 0, w: PHYS.w, h: PHYS.h, ground: false,
      coyote: 0, buffer: 0, jumping: false, face: 1, ride: null, dead: false, sprung: false };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Solid one-way boxes from entities (crumbles, movers).
  function platforms(L) {
    const out = [];
    for (const c of L.crumbles) if (c.state !== 'gone' && c.state !== 'falling') out.push(c);
    for (const m of L.movers) out.push(m);
    return out;
  }

  function updateWorld(L, t, dt) {
    for (const m of L.movers) {
      const ox = m.x, oy = m.y;
      const s = Math.sin(t * m.speed + m.phase) * m.amp;
      if (m.axis === 'x') m.x = m.x0 + s; else m.y = m.y0 + s;
      m.dx = m.x - ox; m.dy = m.y - oy;
    }
    for (const c of L.crumbles) {
      if (c.state === 'shaking') { c.t -= dt; if (c.t <= 0) { c.state = 'falling'; c.vy = 0; } }
      else if (c.state === 'falling') { c.vy += 1400 * dt; c.y += c.vy * dt; if (c.y > L.h * T + 200) { c.state = 'gone'; c.t = 2.5; } }
      else if (c.state === 'gone') { c.t -= dt; if (c.t <= 0) { c.state = 'idle'; c.x = c.x0; c.y = c.y0; } }
    }
  }

  // input: {left, right, jump (held), jumpPressed (edge)}
  // returns events array: 'jump','land','spring','dead'
  function stepPlayer(L, p, input, dt) {
    const ev = [];
    if (p.dead) return ev;
    // ride moving platform
    if (p.ride) { p.x += p.ride.dx; p.y += p.ride.dy; }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) p.face = dir;
    const acc = p.ground ? PHYS.accel : PHYS.airAccel;
    if (dir) {
      p.vx += dir * acc * dt;
      if (Math.abs(p.vx) > PHYS.runV) p.vx = Math.sign(p.vx) * PHYS.runV;
    } else if (p.ground) {
      const f = PHYS.fric * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    } else {
      p.vx *= Math.pow(0.2, dt);
    }

    if (input.jumpPressed) p.buffer = PHYS.buffer; else p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = p.ground ? PHYS.coyote : Math.max(0, p.coyote - dt);
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PHYS.jumpV; p.jumping = true; p.buffer = 0; p.coyote = 0; p.ground = false; p.ride = null;
      ev.push('jump');
    }
    if (p.jumping && !input.jump && p.vy < 0 && !p.sprung) { p.vy *= PHYS.cut; p.jumping = false; }

    p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.g * dt);

    // X
    p.x += p.vx * dt;
    collideTiles(L, p, 'x');
    // Y
    const prevBottom = p.y + p.h - (p.ride ? p.ride.dy : 0);
    p.y += p.vy * dt;
    const wasGround = p.ground;
    p.ground = false; p.ride = null;
    collideTiles(L, p, 'y', prevBottom);
    if (p.vy >= 0) {
      for (const b of platforms(L)) {
        if (p.x + p.w > b.x && p.x < b.x + b.w && prevBottom <= b.y - (b.dy || 0) + 1 && p.y + p.h >= b.y) {
          p.y = b.y - p.h; p.vy = 0; p.ground = true; p.ride = b.dx !== undefined ? b : null;
          if (b.state === 'idle') { b.state = 'shaking'; b.t = 0.45; ev.push('crumble'); }
        }
      }
    }
    if (p.ground) { p.jumping = false; p.sprung = false; if (!wasGround) ev.push('land'); }

    // springs
    for (const s of L.springs) {
      if (p.vy >= 0 && overlap(p, s) && prevBottom <= s.y + 8) {
        p.vy = -PHYS.springV; p.y = s.y - p.h; p.ground = false; p.jumping = false; p.sprung = true; s.squash = 1;
        ev.push('spring');
      }
    }
    // thorns: inner hitbox
    const tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - 1) / T);
    const ty0 = Math.floor(p.y / T), ty1 = Math.floor((p.y + p.h - 1) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tileAt(L, tx, ty) === 3) {
        const hb = { x: tx * T + 5, y: ty * T + 14, w: T - 10, h: T - 14 };
        if (overlap(p, hb)) { p.dead = true; ev.push('dead'); return ev; }
      }
    }
    if (p.y > L.h * T + 64) { p.dead = true; ev.push('dead'); }
    return ev;
  }

  function collideTiles(L, p, axis, prevBottom) {
    const tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - 0.001) / T);
    const ty0 = Math.floor(p.y / T), ty1 = Math.floor((p.y + p.h - 0.001) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = tileAt(L, tx, ty);
      if (t === 1) {
        if (axis === 'x') {
          if (p.vx > 0) p.x = tx * T - p.w; else if (p.vx < 0) p.x = tx * T + T;
          p.vx = 0;
          return;
        } else {
          if (p.vy > 0) { p.y = ty * T - p.h; p.ground = true; }
          else if (p.vy < 0) { p.y = ty * T + T; }
          p.vy = 0;
          return;
        }
      } else if (t === 2 && axis === 'y' && p.vy >= 0 && prevBottom <= ty * T + 1) {
        p.y = ty * T - p.h; p.vy = 0; p.ground = true;
        return;
      }
    }
  }

  G.StoryCore = { T, PHYS, parseLevel, newPlayer, stepPlayer, updateWorld, overlap, tileAt };
})(typeof window !== 'undefined' ? window : globalThis);
