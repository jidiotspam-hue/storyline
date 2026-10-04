// Storyline — rendering, audio, screens. Physics lives in core.js.
(() => {
  const { T, parseLevel, newPlayer, stepPlayer, updateWorld, overlap, tileAt } = StoryCore;
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const W = 960, H = 544;
  const $ = id => document.getElementById(id);
  const INK = '#3b2a26';

  // ---------------- themes ----------------
  const THEMES = {
    spring: { sky: ['#f7d9d6', '#f8ece0'], far: '#e6c3c0', mid: '#d9a7a8', ground: '#e9d3b4', top: '#a9c08f', dirt: '#c9a985', accent: '#c9727a', wood: '#b98b62' },
    autumn: { sky: ['#f3c48f', '#f8e6c4'], far: '#e3ae7c', mid: '#cf8a5a', ground: '#e2c49a', top: '#d08a4a', dirt: '#b98a5e', accent: '#b5552f', wood: '#a8754c' },
    moon:   { note: '#f4ecc8', sky: ['#1d2340', '#3a4170'], far: '#2c3460', mid: '#232a4e', ground: '#5a5f86', top: '#7f86b5', dirt: '#474c72', accent: '#e8d9a8', wood: '#6e6a8c' },
    clock:  { note: '#f6e3b8', sky: ['#5c3d2e', '#8a6247'], far: '#6e4b38', mid: '#5a3c2c', ground: '#b48c64', top: '#d2b07a', dirt: '#8f6a48', accent: '#e3c27a', wood: '#9a7048' },
    stage:  { note: '#f7e6b5', sky: ['#2b1d3d', '#6b3f63'], far: '#4a2f55', mid: '#3a2445', ground: '#8a6a7c', top: '#c99aac', dirt: '#6d5163', accent: '#f2c879', wood: '#8d6a5c' },
  };

  // ---------------- paper texture ----------------
  const paper = document.createElement('canvas'); paper.width = 256; paper.height = 256;
  {
    const p = paper.getContext('2d'); const img = p.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 200 + Math.random() * 55 | 0;
      img.data[i] = v; img.data[i + 1] = v - 8; img.data[i + 2] = v - 22; img.data[i + 3] = 255;
    }
    p.putImageData(img, 0, 0);
    p.globalAlpha = 0.06; p.strokeStyle = '#7a5a40';
    for (let i = 0; i < 90; i++) { p.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; p.moveTo(x, y); p.lineTo(x + Math.random() * 40 - 20, y + Math.random() * 6 - 3); p.stroke(); }
  }
  const paperPat = ctx.createPattern(paper, 'repeat');
  const vignette = (() => { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(60,35,20,0)'); g.addColorStop(1, 'rgba(60,35,20,0.45)'); return g; })();

  // deterministic noise for decorations
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------------- audio ----------------
  const music = new Audio(); music.loop = true; music.preload = 'auto';
  let musicOn = localStorage.getItem('storyline.music') !== 'off';
  let musicTarget = 0.7, fadeT = null;
  let ac = null, sfxBus = null;
  function ensureAC() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.32;
    const comp = ac.createDynamicsCompressor(); sfxBus.connect(comp); comp.connect(ac.destination);
  }
  function tone(freq, t0, dur, type = 'triangle', vol = 0.5) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2; const g2 = ac.createGain(); g2.gain.value = 0.25;
    o2.connect(g2); g2.connect(g);
    const t = ac.currentTime + t0;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // Fmaj9-ish voicing walked up for note pickups (bossa colours)
  const CHORD = [65, 69, 72, 76, 79, 81, 84, 88];
  let noteIdx = 0, noteTimer = 0;
  const SFX = {
    note() { tone(mtof(CHORD[noteIdx % CHORD.length]), 0, 0.5, 'sine', 0.45); noteIdx++; noteTimer = 1.2; },
    page() { [72, 76, 79, 83, 86].forEach((m, i) => tone(mtof(m), i * 0.07, 0.9, 'sine', 0.35)); },
    jump() { tone(mtof(57 + (Math.random() * 3 | 0) * 2), 0, 0.14, 'triangle', 0.18); },
    spring() { tone(mtof(48), 0, 0.5, 'triangle', 0.5); tone(mtof(55), 0.02, 0.5, 'triangle', 0.3); tone(mtof(64), 0.04, 0.6, 'sine', 0.3); },
    stomp() { tone(mtof(43), 0, 0.18, 'triangle', 0.5); tone(mtof(79), 0.05, 0.3, 'sine', 0.25); },
    dead() { [64, 60, 57, 52].forEach((m, i) => tone(mtof(m), i * 0.09, 0.35, 'triangle', 0.3)); },
    lamp() { tone(mtof(76), 0, 0.6, 'sine', 0.3); tone(mtof(83), 0.08, 0.8, 'sine', 0.25); },
    crumble() { tone(mtof(40 + Math.random() * 4), 0, 0.12, 'square', 0.05); },
    win() { [65, 69, 72, 76, 79, 84].forEach((m, i) => tone(mtof(m), i * 0.11, 1.4, 'sine', 0.3)); },
  };
  // Browsers can refuse play() outside a gesture; retry on the next key/tap.
  function tryPlay() {
    if (!musicOn || !music.src) return;
    music.play().catch(err => {
      if (err.name === 'AbortError') { // load still settling; try again once it can play
        const again = () => { if (musicOn) music.play().catch(() => {}); };
        if (music.readyState >= 3) setTimeout(again, 60); else music.addEventListener('canplay', again, { once: true });
        return;
      }
      console.warn('music blocked:', err.name);
      const retry = () => { removeEventListener('pointerdown', retry, true); removeEventListener('keydown', retry, true); if (musicOn) music.play().catch(() => {}); };
      addEventListener('pointerdown', retry, true); addEventListener('keydown', retry, true);
    });
  }
  function playSong(song, vol = 0.7) {
    musicTarget = vol;
    if (music.dataset.src !== song.preview) { music.src = song.preview; music.dataset.src = song.preview; }
    music.volume = 0;
    tryPlay();
    fadeTo(vol);
  }
  function fadeTo(v, ms = 900) {
    clearInterval(fadeT);
    const start = music.volume, t0 = performance.now();
    fadeT = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      music.volume = Math.max(0, Math.min(1, start + (v - start) * k));
      if (k >= 1) clearInterval(fadeT);
    }, 30);
  }
  function setMusic(on) {
    musicOn = on; localStorage.setItem('storyline.music', on ? 'on' : 'off');
    $('mute').textContent = on ? '♫ on' : '♫ off';
    if (on && music.src) { tryPlay(); fadeTo(musicTarget); } else music.pause();
  }
  $('mute').onclick = (e) => { e.stopPropagation(); setMusic(!musicOn); e.target.blur(); };
  $('mute').textContent = musicOn ? '♫ on' : '♫ off';

  // ---------------- input ----------------
  const keys = {}; let jumpEdge = false;
  const JUMP = ['Space', 'KeyW', 'ArrowUp', 'KeyZ', 'KeyK'];
  addEventListener('keydown', e => {
    if (e.repeat) { if (JUMP.includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault(); return; }
    keys[e.code] = true;
    if (JUMP.includes(e.code)) { jumpEdge = true; e.preventDefault(); }
    if (e.code.startsWith('Arrow')) e.preventDefault();
    if (e.code === 'KeyM') setMusic(!musicOn);
    if (e.code === 'Escape' && state === 'play') toTitle();
    if (e.code === 'Enter' || e.code === 'Space') {
      const on = document.querySelector('.screen.on button:not(.ghost):not(:disabled)');
      if (on && state !== 'play') { e.preventDefault(); on.click(); }
    }
    if (e.code === 'KeyR' && state === 'play' && game) killPlayer();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const touch = { l: false, r: false, j: false };
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) $('touch').classList.add('on');
  for (const [id, k] of [['tl', 'l'], ['tr', 'r'], ['tj', 'j']]) {
    const el = $(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); touch[k] = true; if (k === 'j') jumpEdge = true; el.setPointerCapture(e.pointerId); });
    const up = e => { touch[k] = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  const readInput = () => {
    const inp = {
      left: keys.ArrowLeft || keys.KeyA || touch.l,
      right: keys.ArrowRight || keys.KeyD || touch.r,
      jump: JUMP.some(k => keys[k]) || touch.j,
      jumpPressed: jumpEdge,
    };
    jumpEdge = false;
    return inp;
  };

  // ---------------- progress ----------------
  const save = JSON.parse(localStorage.getItem('storyline.save') || '{"unlocked":1,"best":{}}');
  const persist = () => localStorage.setItem('storyline.save', JSON.stringify(save));

  // ---------------- game state ----------------
  let state = 'title';
  let game = null; // {li, L, p, t, cam, deaths, particles, respawn, ...}
  const run = { notes: 0, notesTotal: 0, pages: 0, deaths: 0, perLevel: [] };

  function startLevel(li) {
    const def = LEVELS[li];
    const L = parseLevel(def);
    const p = newPlayer(L);
    game = { li, L, p, theme: THEMES[def.theme], themeName: def.theme, t: 0, cam: { x: 0, y: 0 }, deaths: 0, particles: [], respawn: 0,
      checkpoint: { x: L.start.x, y: L.start.y }, notes: 0, pages: 0, anim: 0, winT: 0, shake: 0, leaves: [] };
    game.cam.x = Math.max(0, p.x - W / 3);
    state = 'play';
    showScreen(null);
  }

  function killPlayer() {
    const g = game; if (!g || g.p.dead && g.respawn > 0) return;
    g.p.dead = true; g.respawn = 0.9; g.deaths++; g.shake = 0.25;
    SFX.dead();
    for (let i = 0; i < 24; i++) g.particles.push({ x: g.p.x + 10, y: g.p.y + 14, vx: (Math.random() - 0.5) * 360, vy: -Math.random() * 380, life: 0.9, kind: 'ink', r: 3 + Math.random() * 5 });
  }

  function update(dt) {
    const g = game; if (!g) return;
    g.t += dt;
    updateWorld(g.L, g.t, dt);
    noteTimer -= dt; if (noteTimer <= 0) noteIdx = 0;
    const p = g.p;
    if (g.winT > 0) {
      g.winT += dt;
      p.vx *= 0.9;
      if (g.winT > 1.6) finishLevel();
      updateParticles(g, dt);
      return;
    }
    if (p.dead) {
      g.respawn -= dt;
      if (g.respawn <= 0) {
        const np = newPlayer(g.L); np.x = g.checkpoint.x; np.y = g.checkpoint.y; g.p = np;
        for (const e of g.L.enemies) if (!e.alive && e.poof <= 0) { /* stomped stay stomped */ }
      }
      updateParticles(g, dt);
      return;
    }
    const inp = readInput();
    const ev = stepPlayer(g.L, p, inp, dt);
    for (const e of ev) {
      if (e === 'jump') SFX.jump();
      if (e === 'spring') { SFX.spring(); burst(g, p.x + 10, p.y + p.h, 8, 'sparkle'); }
      if (e === 'land') burst(g, p.x + 10, p.y + p.h, 4, 'dust');
      if (e === 'crumble') SFX.crumble();
      if (e === 'dead') { p.dead = false; killPlayer(); return; }
    }
    if (Math.abs(p.vx) > 10 && p.ground) g.anim += dt * Math.abs(p.vx) / 18; else if (p.ground) g.anim = 0;

    // pickups
    const pb = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (const n of g.L.notes) if (!n.got && overlap(pb, { x: n.x - 10, y: n.y - 10, w: 20, h: 20 })) { n.got = true; g.notes++; SFX.note(); burst(g, n.x, n.y, 6, 'sparkle'); }
    for (const n of g.L.pages) if (!n.got && overlap(pb, { x: n.x - 12, y: n.y - 12, w: 24, h: 24 })) { n.got = true; g.pages++; SFX.page(); burst(g, n.x, n.y, 16, 'petal'); g.banner = { text: `Torn page ${g.pages} of 3`, t: 2 }; }
    for (const l of g.L.lamps) if (!l.lit && Math.abs(p.x + 10 - l.x) < 18 && p.y + p.h > l.y - 70) { l.lit = true; g.checkpoint = { x: l.x - 10, y: l.y - p.h }; SFX.lamp(); burst(g, l.x, l.y - 58, 10, 'sparkle'); }

    // enemies
    for (const e of g.L.enemies) {
      if (!e.alive) { e.poof -= dt; continue; }
      e.vy = (e.vy || 0) + 2100 * dt;
      e.x += e.vx * dt;
      const ahead = e.vx > 0 ? e.x + e.w : e.x;
      const tx = Math.floor(ahead / T), tyMid = Math.floor((e.y + e.h / 2) / T), tyBelow = Math.floor((e.y + e.h + 2) / T);
      const wall = tileAt(g.L, tx, tyMid) === 1;
      const floor = tileAt(g.L, tx, tyBelow);
      if (wall || (floor !== 1 && floor !== 2)) { e.vx = -e.vx; e.x += e.vx * dt * 2; }
      e.y += e.vy * dt;
      const by = Math.floor((e.y + e.h) / T), bx = Math.floor((e.x + e.w / 2) / T);
      const bt = tileAt(g.L, bx, by);
      if (bt === 1 || bt === 2) { e.y = by * T - e.h; e.vy = 0; }
      if (e.y > g.L.h * T + 100) e.alive = false;
      if (overlap(pb, e)) {
        if (p.vy > 60 && p.y + p.h - e.y < 18) {
          e.alive = false; e.poof = 1; p.vy = -520; p.jumping = true; SFX.stomp();
          burst(g, e.x + 12, e.y + 12, 7, 'butterfly');
        } else { killPlayer(); return; }
      }
    }
    for (const s of g.L.springs) s.squash = Math.max(0, s.squash - dt * 4);

    // exit
    if (g.L.exit && overlap(pb, g.L.exit)) {
      g.winT = 0.001; SFX.win(); burst(g, g.L.exit.x + 24, g.L.exit.y + 20, 30, 'petal');
    }

    // ambient
    if (g.themeName === 'autumn' && Math.random() < dt * 6) g.leaves.push({ x: g.cam.x + Math.random() * (W + 200), y: -20, vx: -20 - Math.random() * 30, vy: 30 + Math.random() * 30, r: Math.random() * 6, life: 20 });
    if (g.themeName === 'spring' && Math.random() < dt * 3) g.leaves.push({ x: g.cam.x + Math.random() * (W + 200), y: -20, vx: -30 - Math.random() * 20, vy: 25 + Math.random() * 20, r: Math.random() * 6, life: 20, petal: true });
    for (const l of g.leaves) { l.x += (l.vx + Math.sin(g.t * 2 + l.r) * 30) * dt; l.y += l.vy * dt; l.life -= dt; }
    g.leaves = g.leaves.filter(l => l.life > 0 && l.y < H + 20);

    if (g.banner) { g.banner.t -= dt; if (g.banner.t <= 0) g.banner = null; }
    updateParticles(g, dt);

    // camera
    const look = p.face * 70;
    const tx = Math.max(0, Math.min(g.L.w * T - W, p.x + p.w / 2 - W / 2 + look));
    g.cam.x += (tx - g.cam.x) * Math.min(1, dt * 5);
    g.shake = Math.max(0, g.shake - dt);
  }

  function burst(g, x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 160;
      g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'butterfly' ? 80 : 40), life: kind === 'butterfly' ? 2.2 : kind === 'dust' ? 0.35 : 0.9, max: 1, kind, r: 2 + Math.random() * 3, seed: Math.random() * 10 });
    }
  }
  function updateParticles(g, dt) {
    for (const q of g.particles) {
      q.life -= dt;
      if (q.kind === 'butterfly') { q.vx += Math.sin(g.t * 8 + q.seed) * 200 * dt; q.vy -= 60 * dt; q.vx *= 0.98; q.vy *= 0.98; }
      else if (q.kind === 'petal') { q.vy += 120 * dt; q.vx *= 0.97; }
      else if (q.kind === 'ink') { q.vy += 900 * dt; }
      else { q.vy += 200 * dt; q.vx *= 0.95; }
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    g.particles = g.particles.filter(q => q.life > 0);
  }

  // ---------------- drawing ----------------
  function draw() {
    const g = game;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!g) { drawCover(); return; }
    const th = g.theme;
    const sx = g.shake > 0 ? (Math.random() - 0.5) * 8 : 0, sy = g.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    drawBackground(g, th);
    ctx.save();
    ctx.translate(Math.round(-g.cam.x + sx), Math.round(-g.cam.y + sy));
    drawTiles(g, th);
    drawEntities(g, th);
    if (!g.p.dead) drawPlayer(g.p, g);
    drawParticles(g, th);
    for (const l of g.leaves) drawLeaf(l, g);
    ctx.restore();
    drawOverlay();
    drawHUD(g);
  }

  function drawCover() {
    const t = performance.now() / 1000;
    const fake = { theme: THEMES.spring, themeName: 'spring', cam: { x: t * 30, y: 0 }, t, L: { w: 999 } };
    drawBackground(fake, THEMES.spring);
    drawOverlay();
  }

  function drawOverlay() {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.fillStyle = paperPat; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function sky(th) {
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }

  function drawBackground(g, th) {
    sky(th);
    const cx = g.cam.x, t = g.t;
    ctx.lineWidth = 2; ctx.strokeStyle = INK + '55';
    const name = g.themeName;
    if (name === 'spring' || name === 'autumn') {
      // sun
      ctx.fillStyle = name === 'spring' ? '#fbf3e4' : '#fbe3b0';
      ctx.beginPath(); ctx.arc(760 - cx * 0.02, 120, 54, 0, 7); ctx.fill();
      // clouds
      for (let i = 0; i < 8; i++) {
        const x = ((i * 290 - cx * 0.08 - t * 6) % 2320 + 2320) % 2320 - 200, y = 60 + hash(i) * 120;
        cloud(x, y, 0.8 + hash(i + 9) * 0.6);
      }
    }
    if (name === 'moon' || name === 'stage') {
      ctx.fillStyle = '#fff8e0';
      for (let i = 0; i < 90; i++) {
        const x = ((hash(i) * 2400 - cx * 0.03) % W + W) % W, y = hash(i + 50) * 300;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + hash(i + 3)) + i));
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
      if (name === 'moon') {
        ctx.fillStyle = '#f4ecc8'; ctx.beginPath(); ctx.arc(720 - cx * 0.02, 120, 62, 0, 7); ctx.fill();
        ctx.fillStyle = '#e2d8ad'; [[700, 105, 10], [735, 140, 7], [745, 100, 5]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x - cx * 0.02, y, r, 0, 7); ctx.fill(); });
        ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = '#f4ecc8'; ctx.beginPath(); ctx.arc(720 - cx * 0.02, 120, 110, 0, 7); ctx.fill(); ctx.restore();
      } else {
        // crescent
        ctx.fillStyle = '#f7e6b5'; ctx.beginPath(); ctx.arc(800 - cx * 0.02, 90, 40, 0, 7); ctx.fill();
        ctx.fillStyle = th.sky[0]; ctx.beginPath(); ctx.arc(815 - cx * 0.02, 80, 36, 0, 7); ctx.fill();
      }
    }
    if (name === 'clock') {
      // giant gears in the back
      ctx.save();
      gear(220 - cx * 0.1, 200, 150, 16, t * 0.15, th.far);
      gear(520 - cx * 0.1, 330, 110, 12, -t * 0.2, th.far);
      gear(860 - cx * 0.1, 160, 170, 18, t * 0.12, th.far);
      gear(1250 - cx * 0.1, 300, 130, 14, -t * 0.17, th.far);
      gear(1650 - cx * 0.1, 180, 150, 16, t * 0.15, th.far);
      ctx.restore();
      // pendulum
      const px = 640 - cx * 0.18, a = Math.sin(t * 1.6) * 0.35;
      ctx.save(); ctx.translate(px, -10); ctx.rotate(a); ctx.strokeStyle = th.accent + '88'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 300); ctx.stroke(); ctx.fillStyle = th.accent + '88'; ctx.beginPath(); ctx.arc(0, 320, 36, 0, 7); ctx.fill(); ctx.restore();
      // tall windows
      for (let i = 0; i < 6; i++) {
        const x = ((i * 380 - cx * 0.25) % 2280 + 2280) % 2280 - 200;
        ctx.fillStyle = '#f2d39a33'; archWindow(x, 80, 80, 200);
      }
    }
    // far layer
    layer(cx * 0.2, th.far, 300, 1, name);
    // mid layer
    layer(cx * 0.45, th.mid, 360, 2, name);
    if (name === 'moon') fireflies(g);
  }

  function cloud(x, y, s) {
    ctx.fillStyle = '#fffaf2cc';
    ctx.beginPath();
    ctx.arc(x, y, 24 * s, 0, 7); ctx.arc(x + 26 * s, y - 12 * s, 30 * s, 0, 7); ctx.arc(x + 58 * s, y, 24 * s, 0, 7);
    ctx.rect(x, y, 58 * s, 22 * s); ctx.fill();
  }

  function gear(x, y, r, teeth, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const rr = i % 2 ? r : r * 0.86, a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
      ctx.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr); ctx.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, 7); ctx.fill();
    for (let i = 0; i < 5; i++) { const a2 = i / 5 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a2) * r * 0.55, Math.sin(a2) * r * 0.55, r * 0.15, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  function archWindow(x, y, w, h) {
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  }

  function layer(off, col, base, depth, name) {
    ctx.fillStyle = col;
    const span = 2400;
    if (name === 'spring' || name === 'stage') {
      // townhouses / rooftops
      const facades = name === 'stage' ? ['#4a2f55', '#563a5e', '#3f2a4c', '#5d3e5a'] : ['#efc9c4', '#e9d6bd', '#d7c3d6', '#c9d4dc', '#f0dcc0'];
      for (let i = 0; i < 26; i++) {
        const w = 64 + hash(i * depth) * 60, h = (depth === 1 ? 110 : 90) + hash(i * depth + 1) * (depth === 1 ? 120 : 80);
        const x = ((i * 96 - off) % span + span) % span - 120, y = (depth === 1 ? 330 : 400) - h;
        const roofH = 22 + hash(i + 4) * 18;
        ctx.save();
        if (depth === 1) ctx.globalAlpha = 0.45;
        ctx.fillStyle = depth === 1 ? col : facades[(i * 7 + depth) % facades.length];
        ctx.fillRect(x, y, w, H - y);
        ctx.fillStyle = name === 'stage' ? '#2e1d38' : depth === 1 ? col : '#b98a86';
        ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + w / 2, y - roofH); ctx.lineTo(x + w + 6, y); ctx.closePath(); ctx.fill();
        if (hash(i + 7) > 0.5) ctx.fillRect(x + w * 0.7, y - roofH * 0.9, 10, roofH * 0.7);
        if (depth === 2) {
          ctx.strokeStyle = INK + '88'; ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, w, H - y);
          ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + w / 2, y - roofH); ctx.lineTo(x + w + 6, y); ctx.stroke();
        }
        ctx.fillStyle = name === 'stage' ? '#f2c879aa' : depth === 1 ? '#fff4e455' : '#fff8ee';
        for (let wy = y + 16; wy < y + h - 14; wy += 30) for (let wx = x + 10; wx < x + w - 14; wx += 22) if (hash(wx * 0.3 + wy) > 0.35) {
          ctx.fillRect(wx, wy, 10, 14);
          if (depth === 2) { ctx.strokeStyle = INK + '66'; ctx.lineWidth = 1; ctx.strokeRect(wx, wy, 10, 14); }
        }
        ctx.restore();
      }
      if (name === 'stage' && depth === 2) {
        // string lights
        for (let k = 0; k < 6; k++) {
          const x0 = ((k * 420 - off) % span + span) % span - 200;
          ctx.strokeStyle = INK + '88'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, 250); ctx.quadraticCurveTo(x0 + 200, 310, x0 + 400, 250); ctx.stroke();
          for (let j = 1; j < 10; j++) { const u = j / 10, bx = x0 + 400 * u, by = 250 + 2 * u * (1 - u) * 60; ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(bx, by + 4, 3.5, 0, 7); ctx.fill(); }
        }
      }
    } else if (name === 'autumn') {
      for (let i = 0; i < 24; i++) {
        const x = ((i * 110 - off) % span + span) % span - 120, r = 40 + hash(i * depth) * 40, y = base + (depth === 2 ? 70 : 10) - hash(i + 3) * 40;
        ctx.fillStyle = INK + '66'; ctx.fillRect(x - 4, y, 8, H - y);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.arc(x - r * 0.6, y + r * 0.3, r * 0.7, 0, 7); ctx.arc(x + r * 0.6, y + r * 0.3, r * 0.7, 0, 7); ctx.fill();
      }
      ctx.fillStyle = col; ctx.fillRect(0, base + 120 + depth * 20, W, H);
    } else if (name === 'moon') {
      for (let i = 0; i < 40; i++) {
        const x = ((i * 64 - off) % span + span) % span - 60, h = 140 + hash(i * depth) * 150, y = base + 160 - h + (depth === 2 ? 40 : 0);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 34, y + h); ctx.lineTo(x - 34, y + h); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y + h * 0.3); ctx.lineTo(x + 44, y + h + 10); ctx.lineTo(x - 44, y + h + 10); ctx.fill();
      }
      ctx.fillRect(0, base + 150, W, H);
    } else if (name === 'clock') {
      for (let i = 0; i < 18; i++) {
        const x = ((i * 150 - off) % span + span) % span - 100;
        ctx.fillRect(x, depth === 1 ? 40 : 120, 26, H);
        ctx.fillRect(x - 8, depth === 1 ? 40 : 120, 42, 14);
      }
    }
  }

  function fireflies(g) {
    for (let i = 0; i < 26; i++) {
      const x = ((hash(i) * 1600 - g.cam.x * 0.6 + Math.sin(g.t * 0.7 + i) * 40) % W + W) % W;
      const y = 200 + hash(i + 20) * 300 + Math.cos(g.t * 0.9 + i * 2) * 20;
      ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(g.t * 2 + i * 1.7));
      ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
      ctx.globalAlpha *= 0.3; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTiles(g, th) {
    const L = g.L;
    const x0 = Math.max(0, Math.floor(g.cam.x / T) - 1), x1 = Math.min(L.w - 1, Math.ceil((g.cam.x + W) / T) + 1);
    for (let ty = 0; ty < L.h; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = L.tiles[ty][tx]; if (!t) continue;
      const px = tx * T, py = ty * T;
      if (t === 1) {
        const up = tileAt(L, tx, ty - 1) === 1 || ty === 0;
        const lf = tx > 0 && L.tiles[ty][tx - 1] === 1, rt = tx < L.w - 1 && L.tiles[ty][tx + 1] === 1;
        ctx.fillStyle = up ? th.dirt : th.ground;
        ctx.fillRect(px, py, T, T);
        if (up) {
          // crosshatch
          ctx.strokeStyle = INK + '22'; ctx.lineWidth = 1; ctx.beginPath();
          for (let k = 0; k < 3; k++) { const hx = px + hash(tx * 7 + ty * 13 + k) * 24, hy = py + hash(tx * 3 + ty * 5 + k) * 24; ctx.moveTo(hx, hy); ctx.lineTo(hx + 6, hy + 6); }
          ctx.stroke();
        } else {
          // top lip: grass / cobble
          ctx.fillStyle = th.top; ctx.fillRect(px, py, T, 9);
          ctx.beginPath();
          for (let k = 0; k < 4; k++) { const bx = px + k * 8 + 4; ctx.moveTo(bx - 4, py + 9); ctx.quadraticCurveTo(bx, py + 15 + hash(tx * 4 + k) * 4, bx + 4, py + 9); }
          ctx.fill();
          ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py + 1); ctx.lineTo(px + T, py + 1); ctx.stroke();
          if (g.themeName === 'spring' && hash(tx * 9.1) > 0.75) flower(px + 8 + hash(tx) * 16, py, th.accent);
          if (g.themeName === 'moon' && hash(tx * 5.3) > 0.8) mushroom(px + 10 + hash(tx) * 12, py);
        }
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath();
        if (!lf) { ctx.moveTo(px + 1, py); ctx.lineTo(px + 1, py + T); }
        if (!rt) { ctx.moveTo(px + T - 1, py); ctx.lineTo(px + T - 1, py + T); }
        ctx.stroke();
      } else if (t === 2) {
        plank(px, py, T, 12, th.wood);
      } else if (t === 3) {
        thorns(px, py, th);
      }
    }
  }

  function plank(x, y, w, h, col) {
    ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = INK + '44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 4, y + h / 2); ctx.lineTo(x + w - 6, y + h / 2); ctx.stroke();
  }

  function flower(x, y, col) {
    ctx.strokeStyle = '#6f8f5a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 9); ctx.stroke();
    ctx.fillStyle = col; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3, y - 10 + Math.sin(a) * 3, 2.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#f6e2a0'; ctx.beginPath(); ctx.arc(x, y - 10, 1.8, 0, 7); ctx.fill();
  }
  function mushroom(x, y) {
    ctx.fillStyle = '#efe6d0'; ctx.fillRect(x - 1.5, y - 7, 3, 7);
    ctx.fillStyle = '#c66a7a'; ctx.beginPath(); ctx.arc(x, y - 7, 6, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  }

  function thorns(px, py, th) {
    ctx.strokeStyle = '#4f6b45'; ctx.lineWidth = 2.5;
    for (let k = 0; k < 3; k++) {
      const bx = px + 6 + k * 10;
      ctx.beginPath(); ctx.moveTo(bx, py + T); ctx.quadraticCurveTo(bx + (k - 1) * 6, py + 20, bx + (k - 1) * 3, py + 10); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(bx - 1, py + 22); ctx.lineTo(bx - 6, py + 19); ctx.lineTo(bx, py + 18); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 1, py + 27); ctx.lineTo(bx + 6, py + 24); ctx.lineTo(bx, py + 24); ctx.fill();
    }
    // a rose on top
    ctx.fillStyle = '#b8434f'; ctx.beginPath(); ctx.arc(px + 16, py + 10, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7d2632'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px + 16, py + 10, 3, 0, 5); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px + 16, py + 10, 6, 0, 7); ctx.stroke();
  }

  function drawEntities(g, th) {
    const L = g.L, t = g.t;
    // lamps
    for (const l of L.lamps) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y - 56); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(l.x - 7, l.y - 4, 14, 4);
      ctx.fillStyle = l.lit ? '#ffe7a0' : '#8a7a6a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(l.x - 9, l.y - 56); ctx.lineTo(l.x + 9, l.y - 56); ctx.lineTo(l.x + 6, l.y - 72); ctx.lineTo(l.x - 6, l.y - 72); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(l.x - 8, l.y - 72); ctx.lineTo(l.x, l.y - 79); ctx.lineTo(l.x + 8, l.y - 72); ctx.fillStyle = INK; ctx.fill();
      if (l.lit) { ctx.save(); ctx.globalAlpha = 0.22 + Math.sin(t * 3) * 0.04; ctx.fillStyle = '#ffe7a0'; ctx.beginPath(); ctx.arc(l.x, l.y - 64, 34, 0, 7); ctx.fill(); ctx.restore(); }
    }
    // springs: piano keys
    for (const s of L.springs) {
      const sq = s.squash * 6;
      ctx.fillStyle = INK; ctx.fillRect(s.x - 2, s.y + 8, s.w + 4, 6);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = '#fbf6ea'; ctx.fillRect(s.x + k * 9.5, s.y + sq, 9, 14 - sq);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(s.x + k * 9.5, s.y + sq, 9, 14 - sq);
      }
      ctx.fillStyle = INK; ctx.fillRect(s.x + 7, s.y + sq, 5, 8 - sq * 0.5); ctx.fillRect(s.x + 16.5, s.y + sq, 5, 8 - sq * 0.5);
      if (s.squash > 0.3) { ctx.fillStyle = INK; ctx.font = '16px serif'; ctx.fillText('♪', s.x + 18, s.y - 10 - (1 - s.squash) * 20); }
    }
    // crumbling leaves
    for (const c of L.crumbles) {
      if (c.state === 'gone') continue;
      const jx = c.state === 'shaking' ? (Math.random() - 0.5) * 3 : 0;
      leafPlatform(c.x + jx, c.y, c.w, th, c.state === 'falling' ? 0.6 : 1, c.x0);
    }
    // movers: clock-face platforms
    for (const m of L.movers) {
      ctx.fillStyle = '#e8d3a8'; ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(m.x + 1, m.y + 1, m.w - 2, m.h - 2);
      for (let k = 1; k < 8; k++) { ctx.beginPath(); ctx.moveTo(m.x + k * 8, m.y + 2); ctx.lineTo(m.x + k * 8, m.y + (k % 2 ? 6 : 9)); ctx.lineWidth = 1; ctx.stroke(); }
      gearSmall(m.x + 10, m.y + m.h + 2, 7, t * 3 * (m.axis === 'x' ? 1 : -1));
      gearSmall(m.x + m.w - 10, m.y + m.h + 2, 7, -t * 3);
    }
    // notes
    for (const n of L.notes) {
      if (n.got) continue;
      const bob = Math.sin(t * 3 + n.x * 0.05) * 3;
      ctx.font = 'bold 22px "Playfair Display", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(n.x, n.y + bob, 11, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = th.note || INK;
      ctx.fillText((n.x / T | 0) % 3 ? '♪' : '♫', n.x, n.y + bob);
    }
    // pages
    for (const n of L.pages) {
      if (n.got) continue;
      const bob = Math.sin(t * 2 + n.x) * 4, rot = Math.sin(t * 1.5 + n.x) * 0.15;
      ctx.save(); ctx.translate(n.x, n.y + bob); ctx.rotate(rot);
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(t * 4) * 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fbf3e0'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-10, -13); ctx.lineTo(10, -13); ctx.lineTo(10, 6); ctx.lineTo(6, 9); ctx.lineTo(3, 6); ctx.lineTo(0, 13); ctx.lineTo(-4, 8); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = INK + '66'; ctx.lineWidth = 1; for (let k = -8; k < 5; k += 4) { ctx.beginPath(); ctx.moveTo(-7, k); ctx.lineTo(7, k); ctx.stroke(); }
      ctx.restore();
    }
    // enemies: ink blots
    for (const e of L.enemies) {
      if (!e.alive) continue;
      const wob = Math.sin(t * 8 + e.x0) * 2;
      ctx.fillStyle = '#2a1e2e';
      ctx.beginPath();
      const cx = e.x + 12, cy = e.y + 14;
      for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2, r = 12 + Math.sin(a * 3 + t * 6 + e.x0) * 2 + (Math.sin(a) > 0 ? 1 : 0); ctx.lineTo(cx + Math.cos(a) * (r + wob * 0.3), cy + Math.sin(a) * r * 0.95); }
      ctx.fill();
      if (th.note) { ctx.strokeStyle = th.note + '99'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(cx - 13, cy + 9, 3, 0, 7); ctx.arc(cx + 14, cy + 8, 2.4, 0, 7); ctx.fill();
      const look = Math.sign(e.vx) * 2.5;
      ctx.fillStyle = '#fbf3e0'; ctx.beginPath(); ctx.arc(cx - 4 + look, cy - 3, 3.5, 0, 7); ctx.arc(cx + 4 + look, cy - 3, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a1e2e'; ctx.beginPath(); ctx.arc(cx - 4 + look * 1.4, cy - 3, 1.6, 0, 7); ctx.arc(cx + 4 + look * 1.4, cy - 3, 1.6, 0, 7); ctx.fill();
    }
    // finale: a little stage with curtains around the last page
    if (g.themeName === 'stage' && L.exit) {
      const ex = L.exit.x + 24, gy = L.exit.y + 64, lx = ex - 230, rx = ex + 230;
      ctx.save();
      ctx.globalAlpha = 0.18 + Math.sin(t * 1.3) * 0.03; ctx.fillStyle = '#fff1c0';
      ctx.beginPath(); ctx.moveTo(ex - 30, 0); ctx.lineTo(ex + 30, 0); ctx.lineTo(ex + 120, gy); ctx.lineTo(ex - 120, gy); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      plank(lx, gy - 10, rx - lx, 10, '#6b4a3a');
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? lx - 10 : rx + 10;
        ctx.fillStyle = '#8e2f3c'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 - side * 90, 0);
        ctx.quadraticCurveTo(x0 - side * 30, gy * 0.55, x0 - side * 70, gy - 10); ctx.lineTo(x0, gy - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#6a1f2b'; ctx.lineWidth = 1.5;
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x0 - side * k * 20, 0); ctx.quadraticCurveTo(x0 - side * (k * 10 + 10), gy * 0.55, x0 - side * k * 16, gy - 10); ctx.stroke(); }
        ctx.fillStyle = '#e3b85a'; ctx.beginPath(); ctx.arc(x0 - side * 48, gy * 0.55, 5, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#8e2f3c'; ctx.fillRect(lx - 100, 0, rx - lx + 200, 26);
      ctx.fillStyle = '#e3b85a'; for (let x = lx - 100; x < rx + 100; x += 14) { ctx.beginPath(); ctx.arc(x + 7, 26, 4, 0, Math.PI); ctx.fill(); }
      ctx.restore();
    }
    // exit: standing storybook
    if (L.exit) {
      const x = L.exit.x, y = L.exit.y + 8, open = g.winT > 0 ? Math.min(1, g.winT * 2) : 0.3 + Math.sin(t * 2) * 0.05;
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(x + 24, y + 22, 44 + Math.sin(t * 3) * 3, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#7a3f4a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.fillRect(x - 2, y - 2, 52, 60); ctx.strokeRect(x - 2, y - 2, 52, 60);
      ctx.fillStyle = '#fbf3e0';
      ctx.beginPath(); ctx.moveTo(x + 24, y + 2); ctx.lineTo(x + 2, y + 2 + open * 6); ctx.lineTo(x + 2, y + 54); ctx.lineTo(x + 24, y + 54); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 24, y + 2); ctx.lineTo(x + 46, y + 2 + open * 6); ctx.lineTo(x + 46, y + 54); ctx.lineTo(x + 24, y + 54); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = 'italic 11px "IM Fell English", serif'; ctx.textAlign = 'center';
      ctx.fillText('the', x + 13, y + 22); ctx.fillText('end', x + 35, y + 22);
      ctx.font = '16px serif'; ctx.fillText('❦', x + 24, y + 42);
      ctx.fillStyle = th.note || INK; ctx.font = 'italic 13px "IM Fell English", serif'; ctx.fillText('turn the page', x + 24, y - 14 + Math.sin(t * 2) * 2);
    }
  }

  function gearSmall(x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#b08a52'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); for (let i = 0; i < 16; i++) { const rr = i % 2 ? r : r * 0.75, aa = i / 16 * 6.283; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function leafPlatform(x, y, w, th, alpha, seed) {
    ctx.save(); ctx.globalAlpha = alpha;
    const col = ['#d9823f', '#c4612f', '#e3a14a', '#b8743a'][(seed / T | 0) % 4];
    ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.quadraticCurveTo(x + w / 2, y - 6, x + w, y + 6); ctx.quadraticCurveTo(x + w / 2, y + 16, x, y + 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 3, y + 6); ctx.lineTo(x + w - 3, y + 6); ctx.lineWidth = 1; ctx.stroke();
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * 8, y + 6); ctx.lineTo(x + k * 8 + 4, y + 1); ctx.stroke(); }
    ctx.restore();
  }

  function drawLeaf(l, g) {
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(g.t * 2 + l.r);
    ctx.fillStyle = l.petal ? '#f1b8c0' : ['#d9823f', '#c4612f', '#e3a14a'][(l.r | 0) % 3];
    ctx.beginPath(); ctx.ellipse(0, 0, l.petal ? 4 : 6, l.petal ? 2.5 : 3, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawParticles(g, th) {
    for (const q of g.particles) {
      const a = Math.max(0, Math.min(1, q.life / 0.4));
      ctx.globalAlpha = a;
      if (q.kind === 'ink') { ctx.fillStyle = '#2a1e2e'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
      else if (q.kind === 'dust') { ctx.fillStyle = INK + '55'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); }
      else if (q.kind === 'petal') { ctx.fillStyle = ['#f1b8c0', '#fbe8b0', '#e98a96'][(q.seed * 3 | 0) % 3]; ctx.beginPath(); ctx.ellipse(q.x, q.y, 5, 3, q.seed + g.t * 3, 0, 7); ctx.fill(); }
      else if (q.kind === 'butterfly') {
        const f = Math.abs(Math.sin(g.t * 18 + q.seed)) * 5 + 1;
        ctx.fillStyle = ['#7d93b2', '#c9727a', '#e8d9a8'][(q.seed * 3 | 0) % 3];
        ctx.beginPath(); ctx.ellipse(q.x - f / 2, q.y, f / 1.5, 4, -0.4, 0, 7); ctx.ellipse(q.x + f / 2, q.y, f / 1.5, 4, 0.4, 0, 7); ctx.fill();
        ctx.fillStyle = INK; ctx.fillRect(q.x - 0.5, q.y - 3, 1, 6);
      } else { ctx.fillStyle = '#fff2b0'; star(q.x, q.y, q.r + 1); }
    }
    ctx.globalAlpha = 1;
  }
  function star(x, y, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.4 : r * 1.4, a = i / 8 * 6.283; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }

  // The heroine: dark bob with bangs, a bow, pale blue dress, cello on her back.
  function drawPlayer(p, g) {
    const x = Math.round(p.x + p.w / 2), y = Math.round(p.y + p.h);
    const f = p.face, run = p.ground && Math.abs(p.vx) > 10, ph = g.anim;
    const air = !p.ground;
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    const bob = run ? Math.abs(Math.sin(ph)) * -2 : 0;
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
    // cello on back
    ctx.save(); ctx.translate(-7, -22 + bob); ctx.rotate(-0.25);
    ctx.fillStyle = '#9a5a33';
    ctx.beginPath(); ctx.ellipse(0, 6, 7, 9, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -6, 5.5, 6.5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(-1, -22, 2, 18); ctx.fillRect(-2.5, -25, 5, 4);
    ctx.restore();
    // legs
    const l1 = run ? Math.sin(ph) * 5 : air ? 3 : 0, l2 = run ? -Math.sin(ph) * 5 : air ? -2 : 0;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-3, -8 + bob); ctx.lineTo(-3 + l1, -1); ctx.moveTo(3, -8 + bob); ctx.lineTo(3 + l2, -1); ctx.stroke();
    ctx.fillStyle = '#5a2f2f'; ctx.beginPath(); ctx.ellipse(-3 + l1 + 1, -1, 3, 1.8, 0, 0, 7); ctx.ellipse(3 + l2 + 1, -1, 3, 1.8, 0, 0, 7); ctx.fill();
    // dress
    ctx.fillStyle = '#a9bfd9'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    const flare = air ? 2 : run ? Math.sin(ph * 2) : 0;
    ctx.beginPath(); ctx.moveTo(-4, -22 + bob); ctx.lineTo(4, -22 + bob); ctx.lineTo(8 + flare, -7 + bob); ctx.quadraticCurveTo(0, -5 + bob, -8 - flare, -7 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fbf3e0'; ctx.beginPath(); ctx.moveTo(-3, -22 + bob); ctx.lineTo(0, -19 + bob); ctx.lineTo(3, -22 + bob); ctx.fill();
    // arm
    const arm = run ? Math.sin(ph + 3.14) * 4 : air ? -6 : 0;
    ctx.strokeStyle = '#f0d2bd'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(2, -19 + bob); ctx.lineTo(5 + arm * 0.4, -12 + bob + (air ? -6 : 0)); ctx.stroke();
    // head
    const hy = -29 + bob;
    ctx.fillStyle = '#f3d9c6'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, hy, 7.5, 0, 7); ctx.fill(); ctx.stroke();
    // bob hair with bangs
    ctx.fillStyle = '#3a2420';
    ctx.beginPath(); ctx.moveTo(-8.5, hy + 5); ctx.quadraticCurveTo(-10, hy - 9, 0, hy - 9.5); ctx.quadraticCurveTo(10, hy - 9, 8.5, hy + 4);
    ctx.lineTo(6, hy + 4); ctx.lineTo(6.5, hy - 3); ctx.quadraticCurveTo(0, hy - 2, -5, hy - 3.5); ctx.lineTo(-6, hy + 5); ctx.closePath(); ctx.fill();
    // hair sway
    const sway = run ? Math.sin(ph) * 1.2 : air ? -1.5 : 0;
    ctx.beginPath(); ctx.moveTo(-8.5, hy + 5); ctx.lineTo(-9 - sway, hy + 7); ctx.lineTo(-5, hy + 6); ctx.fill();
    // bow
    ctx.fillStyle = '#c9727a';
    ctx.beginPath(); ctx.moveTo(-4, hy - 9); ctx.lineTo(-10, hy - 13); ctx.lineTo(-9, hy - 6); ctx.closePath(); ctx.moveTo(-4, hy - 9); ctx.lineTo(1, hy - 14); ctx.lineTo(1, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // face
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(3.5, hy + 0.5, 1.1, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8a3a0'; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(4.5, hy + 3, 1.8, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(4, hy + 3.5, 1.4, 0.2, 2.2); ctx.stroke();
    ctx.restore();
  }

  function drawHUD(g) {
    const def = LEVELS[g.li];
    ctx.save();
    ctx.fillStyle = '#f4ead6dd'; ctx.strokeStyle = INK + '66'; ctx.lineWidth = 1;
    roundRect(12, 10, 300, 52, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '12px "IM Fell English", serif'; ctx.fillText(def.chapter.toUpperCase(), 24, 29);
    ctx.font = 'italic 19px "Playfair Display", serif'; ctx.fillText(def.title, 24, 52);
    ctx.font = '17px "IM Fell English", serif'; ctx.textAlign = 'right';
    ctx.fillText(`♪ ${g.notes}/${g.L.notes.length}`, 296, 30);
    ctx.fillText(`❦ ${g.pages}/3`, 296, 52);
    // song credit
    const song = SONGS[g.li];
    ctx.textAlign = 'left'; ctx.font = 'italic 14px "IM Fell English", serif';
    const credit = `♫ ${song.title} — Laufey`;
    const w = ctx.measureText(credit).width + 24;
    ctx.fillStyle = '#f4ead6cc'; roundRect(12, H - 38, w, 26, 13); ctx.fill(); ctx.strokeStyle = INK + '44'; ctx.stroke();
    ctx.fillStyle = INK; ctx.fillText(credit, 24, H - 20);
    if (g.banner) {
      ctx.globalAlpha = Math.min(1, g.banner.t * 2);
      ctx.textAlign = 'center'; ctx.font = 'italic 30px "Playfair Display", serif';
      ctx.fillStyle = '#f4ead6'; ctx.fillText(g.banner.text, W / 2 + 1, 112);
      ctx.fillStyle = INK; ctx.fillText(g.banner.text, W / 2, 110);
    }
    if (g.t < 5 && g.li === 0) {
      ctx.globalAlpha = Math.min(1, (5 - g.t));
      ctx.textAlign = 'center'; ctx.font = 'italic 18px "IM Fell English", serif'; ctx.fillStyle = INK;
      ctx.fillText('← → to walk · space to jump · find the three torn pages', W / 2, 150);
    }
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------------- screens ----------------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  }
  const NUM = ['One', 'Two', 'Three', 'Four', 'Five'];
  function buildChapterList() {
    const box = $('chapters'); box.innerHTML = '';
    LEVELS.forEach((l, i) => {
      const b = document.createElement('button'); b.className = 'ghost';
      const best = save.best[i];
      b.textContent = `${i + 1}. ${l.title}${best ? ` · ❦${best.pages}` : ''}`;
      b.disabled = i + 1 > save.unlocked;
      b.onclick = () => { ensureAC(); run.notes = run.pages = run.deaths = 0; run.notesTotal = 0; showCard(i); };
      box.appendChild(b);
    });
  }
  function toTitle() {
    state = 'title'; game = null; buildChapterList(); showScreen('title');
    fadeTo(0, 600); setTimeout(() => { if (state === 'title') music.pause(); }, 650);
  }
  let pendingLevel = 0;
  function showCard(i) {
    pendingLevel = i; state = 'card';
    const def = LEVELS[i], song = SONGS[i];
    $('cardChapter').textContent = def.chapter + ' · ' + def.place;
    $('cardTitle').textContent = def.title;
    $('cardLine').textContent = def.line;
    $('cardArt').src = song.art; $('cardSong').textContent = song.title;
    $('cardAlbum').textContent = `Laufey · ${song.album} (${song.year})`;
    showScreen('card');
    playSong(song, 0.35);
    // show the level behind the card
    const L = parseLevel(def); game = { li: i, L, p: newPlayer(L), theme: THEMES[def.theme], themeName: def.theme, t: 0, cam: { x: 0, y: 0 }, particles: [], leaves: [], notes: 0, pages: 0, winT: 0, shake: 0, anim: 0, deaths: 0, idle: true };
  }
  $('startBtn').onclick = () => { ensureAC(); run.notes = run.pages = run.deaths = 0; run.notesTotal = 0; showCard(0); };
  $('cardGo').onclick = () => { ensureAC(); startLevel(pendingLevel); fadeTo(0.7); tryPlay(); };

  const CLEAR_LINES = [
    'The streets remember her song now. Somewhere ahead, the leaves are turning.',
    'Golden hour faded into blue. The path led on into the trees.',
    'The last of the ink became butterflies, and the moon showed her the way to the tower.',
    'Every gear agreed on the time at last. It was time to go up to the roof.',
  ];
  function finishLevel() {
    const g = game; state = 'clear';
    run.notes += g.notes; run.notesTotal += g.L.notes.length; run.pages += g.pages; run.deaths += g.deaths;
    run.perLevel[g.li] = { pages: g.pages };
    const prev = save.best[g.li];
    if (!prev || g.pages > prev.pages || (g.pages === prev.pages && g.notes > prev.notes)) save.best[g.li] = { pages: g.pages, notes: g.notes };
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, g.li + 2));
    persist();
    if (g.li === LEVELS.length - 1) return showEnd();
    $('clearChapter').textContent = LEVELS[g.li].chapter + ' · ' + LEVELS[g.li].title;
    $('clearNotes').textContent = `${g.notes}/${g.L.notes.length}`;
    $('clearPages').textContent = `${g.pages}/3`;
    $('clearDeaths').textContent = g.deaths;
    $('clearLine').textContent = CLEAR_LINES[g.li];
    showScreen('clear');
    fadeTo(0.3);
  }
  $('clearNext').onclick = () => showCard(game.li + 1);
  $('clearRetry').onclick = () => { const li = game.li; run.notes -= game.notes; run.notesTotal -= game.L.notes.length; run.pages -= game.pages; run.deaths -= game.deaths; startLevel(li); fadeTo(0.7); };

  function showEnd() {
    state = 'end';
    const totalPages = Object.values(save.best).reduce((s, b) => s + (b.pages || 0), 0);
    $('endNotes').textContent = `${run.notes}/${run.notesTotal || '—'}`;
    $('endPages').textContent = `${totalPages}/15`;
    $('endDeaths').textContent = run.deaths;
    $('endLetter').innerHTML = totalPages >= 15
      ? 'All fifteen pages, pressed back into the book. They were a letter, all along:<br><br>“To the girl who practised scales in an empty room: they will listen. Keep the cello. Keep the old songs. Someday the whole town will be humming them.”'
      : `You found ${totalPages} of the 15 torn pages. The rest are still out there, tucked behind thorns and above the clouds. Find them all to read what the book was hiding.`;
    const s = SONGS[5];
    $('endArt').src = s.art; $('endSong').textContent = s.title; $('endAlbum').textContent = `Laufey · ${s.album} (${s.year})`;
    showScreen('end');
    playSong(s, 0.7);
  }
  $('endTitle').onclick = toTitle;

  // ---------------- loop ----------------
  let last = performance.now(), acc = 0;
  const STEP = 1 / 120;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (state === 'play') {
      acc += dt;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
    } else if (game) { game.t += dt; updateWorld(game.L, game.t, dt); }
    draw();
    requestAnimationFrame(frame);
  }
  buildChapterList();
  requestAnimationFrame(frame);

  // test hook for automated checks
  window.__story = { get state() { return state; }, get game() { return game; }, startLevel, showCard, finishLevel, keys, music };
})();
