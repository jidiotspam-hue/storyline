// Storyline — rendering, lighting, audio, screens. Physics lives in core.js.
(() => {
  const { T, SOLID, parseLevel, newPlayer, stepPlayer, updateWorld, overlap, tileAt } = StoryCore;
  const cv = document.getElementById('c');
  const W = 960, H = 544;
  const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  cv.width = W * DPR; cv.height = H * DPR;
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const INK = '#2e211d';
  const TAU = Math.PI * 2;
  const NCH = LEVELS.length;

  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  function hex(c) { const n = parseInt(c.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, k) { const A = hex(a), B = hex(b); const h2 = v => (v | 0).toString(16).padStart(2, '0'); return '#' + h2(lerp(A[0], B[0], k)) + h2(lerp(A[1], B[1], k)) + h2(lerp(A[2], B[2], k)); }
  function rgba(c, a) { const A = hex(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }
  function makeCanvas(w, h, scale = 1) { const c = document.createElement('canvas'); c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale); const x = c.getContext('2d'); x.scale(scale, scale); return [c, x]; }

  // ---------------- themes ----------------
  // ambient: darkness the lighting pass lays over the scene (0 = full daylight)
  const THEMES = {
    spring:   { sky: ['#f3c9cf', '#fbe9dc', '#fff4e6'], haze: '#f6dcd6', sun: '#fff6e0', ambient: 0.0, amb: '#3a2440', grade: ['#ffd9c0', '#c0d0ff'], rays: true, day: true,
                cap: 'grass', top: '#9dc283', topLit: '#c9e3a6', body: '#d7b68e', deep: '#8f6b4f', wood: '#b98b62', accent: '#d97a8a', weather: 'petals' },
    autumn:   { sky: ['#e9935e', '#f5c27e', '#fbe4bb'], haze: '#f1c18c', sun: '#ffe3a6', ambient: 0.04, amb: '#40202a', grade: ['#ffc070', '#a07cc0'], rays: true, day: true,
                cap: 'grass', top: '#c98a3e', topLit: '#e8b864', body: '#c9a074', deep: '#7c5639', wood: '#a8754c', accent: '#c4502e', weather: 'leaves' },
    garden:   { sky: ['#cfe6d2', '#eef5e2', '#fff8ec'], haze: '#e3efdb', sun: '#fffbe8', ambient: 0.0, amb: '#203a30', grade: ['#fff0c8', '#a8e0d0'], rays: true, day: true,
                cap: 'lush', top: '#78b26a', topLit: '#a9d98c', body: '#a58a6c', deep: '#5f4a3a', wood: '#c6a57a', accent: '#f0b8c8', weather: 'pollen' },
    sea:      { sky: ['#6a4c8c', '#e98a6a', '#ffd29a'], haze: '#f0a888', sun: '#ffe2a8', ambient: 0.1, amb: '#2a1840', grade: ['#ffb070', '#7060c0'], rays: true, day: true,
                cap: 'sand', top: '#ecd2a0', topLit: '#fbe8c2', body: '#c9a57a', deep: '#86664a', wood: '#9a6b48', accent: '#ff9f80', weather: 'none' },
    moon:     { sky: ['#0f1530', '#253064', '#3d4a86'], haze: '#3a4580', sun: '#f4ecc8', ambient: 0.5, amb: '#060820', grade: ['#a0b0ff', '#402060'], rays: false, day: false,
                cap: 'grass', top: '#5f6fa8', topLit: '#8f9fd8', body: '#4a4f7a', deep: '#22264a', wood: '#6e6a8c', accent: '#e8d9a8', note: '#f7eec8', weather: 'fireflies' },
    haunt:    { sky: ['#101a22', '#23363c', '#3f5450'], haze: '#3c5450', sun: '#e8f4e0', ambient: 0.58, amb: '#050a0c', grade: ['#90e0c0', '#503070'], rays: true, day: false,
                cap: 'moss', top: '#5f7d62', topLit: '#88a888', body: '#59606a', deep: '#262a32', wood: '#5c4636', accent: '#a8f0c8', note: '#e8f8e8', weather: 'motes' },
    snow:     { sky: ['#8ea6c4', '#c8d6e6', '#eef2f6'], haze: '#d6e0ec', sun: '#fffaf0', ambient: 0.08, amb: '#1a2440', grade: ['#fff0e0', '#90b0ff'], rays: true, day: true,
                cap: 'snow', top: '#f4f8fc', topLit: '#ffffff', body: '#8f8a92', deep: '#4c4a58', wood: '#8a6a52', accent: '#c94a5a', weather: 'snow' },
    clock:    { sky: ['#2e1d16', '#5a3b2a', '#7a5238'], haze: '#6a4632', sun: '#ffd890', ambient: 0.34, amb: '#120804', grade: ['#ffc070', '#604030'], rays: true, day: false,
                cap: 'plank', top: '#c49a62', topLit: '#e6c48a', body: '#8a6240', deep: '#3e2a1c', wood: '#9a7048', accent: '#e3c27a', note: '#f6e3b8', weather: 'motes' },
    carnival: { sky: ['#2c1e4a', '#8a4a78', '#f0a070'], haze: '#a8607a', sun: '#ffd0a0', ambient: 0.3, amb: '#14082a', grade: ['#ffb0c0', '#5040b0'], rays: false, day: false,
                cap: 'grass', top: '#6a9a6a', topLit: '#98c890', body: '#8a6a5a', deep: '#3a2a30', wood: '#c46a5a', accent: '#ffd36a', note: '#fff0c0', weather: 'confetti' },
    stage:    { sky: ['#140e24', '#3a2450', '#7a4a6a'], haze: '#5a3a5e', sun: '#f7e6b5', ambient: 0.46, amb: '#08040f', grade: ['#ffd090', '#5030a0'], rays: false, day: false,
                cap: 'roof', top: '#8a5a6a', topLit: '#b48494', body: '#5e4252', deep: '#2a1a26', wood: '#8d6a5c', accent: '#f2c879', note: '#f7e6b5', weather: 'stars' },
  };

  // ---------------- post textures ----------------
  const paper = (() => {
    const [c, p] = makeCanvas(256, 256);
    const img = p.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) { const v = 210 + Math.random() * 45 | 0; img.data[i] = v; img.data[i + 1] = v - 6; img.data[i + 2] = v - 18; img.data[i + 3] = 255; }
    p.putImageData(img, 0, 0);
    p.globalAlpha = 0.07; p.strokeStyle = '#7a5a40';
    for (let i = 0; i < 120; i++) { p.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; p.moveTo(x, y); p.lineTo(x + Math.random() * 50 - 25, y + Math.random() * 6 - 3); p.stroke(); }
    return c;
  })();
  const paperPat = ctx.createPattern(paper, 'repeat');
  const grains = [0, 1, 2].map(() => {
    const [c, p] = makeCanvas(200, 200); const img = p.createImageData(200, 200);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    p.putImageData(img, 0, 0); return ctx.createPattern(c, 'repeat');
  });

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
  function noise(dur, vol, freq) {
    if (!ac) return;
    const len = ac.sampleRate * dur | 0, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ac.createBufferSource(); s.buffer = buf; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const CHORD = [65, 69, 72, 76, 79, 81, 84, 88];
  let noteIdx = 0, noteTimer = 0;
  const SFX = {
    note() { tone(mtof(CHORD[noteIdx % CHORD.length]), 0, 0.5, 'sine', 0.42); noteIdx++; noteTimer = 1.2; },
    page() { [72, 76, 79, 83, 86].forEach((m, i) => tone(mtof(m), i * 0.07, 0.9, 'sine', 0.35)); },
    jump() { tone(mtof(57 + (Math.random() * 3 | 0) * 2), 0, 0.14, 'triangle', 0.16); },
    spring() { tone(mtof(48), 0, 0.5, 'triangle', 0.5); tone(mtof(55), 0.02, 0.5, 'triangle', 0.3); tone(mtof(64), 0.04, 0.6, 'sine', 0.3); },
    stomp() { tone(mtof(43), 0, 0.18, 'triangle', 0.5); tone(mtof(79), 0.05, 0.3, 'sine', 0.25); },
    dead() { [64, 60, 57, 52].forEach((m, i) => tone(mtof(m), i * 0.09, 0.35, 'triangle', 0.3)); },
    splash() { noise(0.5, 0.5, 1400); SFX.dead(); },
    lamp() { tone(mtof(76), 0, 0.6, 'sine', 0.3); tone(mtof(83), 0.08, 0.8, 'sine', 0.25); },
    crumble() { noise(0.12, 0.15, 900); },
    win() { [65, 69, 72, 76, 79, 84].forEach((m, i) => tone(mtof(m), i * 0.11, 1.4, 'sine', 0.3)); },
  };
  function tryPlay() {
    if (!musicOn || !music.src) return;
    music.play().catch(err => {
      if (err.name === 'AbortError') {
        const again = () => { if (musicOn) music.play().catch(() => {}); };
        if (music.readyState >= 3) setTimeout(again, 60); else music.addEventListener('canplay', again, { once: true });
        return;
      }
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
    const up = () => { touch[k] = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  const readInput = () => {
    const inp = { left: keys.ArrowLeft || keys.KeyA || touch.l, right: keys.ArrowRight || keys.KeyD || touch.r, jump: JUMP.some(k => keys[k]) || touch.j, jumpPressed: jumpEdge };
    jumpEdge = false;
    return inp;
  };

  // ---------------- progress ----------------
  const save = JSON.parse(localStorage.getItem('storyline.save2') || '{"unlocked":1,"best":{}}');
  const persist = () => localStorage.setItem('storyline.save2', JSON.stringify(save));

  // =====================================================================
  //  BACKGROUND LAYERS — painted once per theme into tileable strips
  // =====================================================================
  const LW = 2048;
  const layerCache = {};
  function wrap(fn, x, w) { fn(x); if (x + w > LW) fn(x - LW); if (x < 0) fn(x + LW); }

  function ridgeY(x, base, amp, freq, seed) {
    const u = x / LW * TAU;
    return base - (Math.sin(u * freq + seed) * 0.5 + Math.sin(u * freq * 2 + seed * 2) * 0.3 + Math.sin(u * freq * 5 + seed * 3) * 0.12) * amp;
  }
  function ridge(c, base, amp, freq, seed, col, rim) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= LW; x += 8) c.lineTo(x, ridgeY(x, base, amp, freq, seed));
    c.lineTo(LW, H); c.closePath(); c.fill();
    if (rim) { c.strokeStyle = rim; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= LW; x += 8) { const y = ridgeY(x, base, amp, freq, seed); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  }
  function fogBand(c, y0, y1, col, a) {
    const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, a));
    c.fillStyle = g; c.fillRect(0, y0, LW, y1 - y0);
  }
  function roundTree(c, x, y, r, col, lit, dark, trunk) {
    c.fillStyle = trunk; c.fillRect(x - r * 0.08, y, r * 0.16, H - y);
    const blobs = [[0, 0, 1], [-0.6, 0.25, 0.72], [0.6, 0.25, 0.72], [-0.3, -0.35, 0.7], [0.35, -0.3, 0.65]];
    c.fillStyle = dark; for (const [bx, by, br] of blobs) { c.beginPath(); c.arc(x + bx * r, y + by * r + r * 0.12, br * r, 0, TAU); c.fill(); }
    c.fillStyle = col; for (const [bx, by, br] of blobs) { c.beginPath(); c.arc(x + bx * r, y + by * r, br * r * 0.94, 0, TAU); c.fill(); }
    c.fillStyle = lit; for (const [bx, by, br] of blobs) { c.beginPath(); c.arc(x + bx * r - br * r * 0.25, y + by * r - br * r * 0.3, br * r * 0.45, 0, TAU); c.fill(); }
  }
  function pine(c, x, y, h, col, lit, snow) {
    const w = h * 0.42;
    for (let k = 0; k < 4; k++) {
      const ty = y + k * h * 0.2, tw = w * (0.45 + k * 0.2), th = h * 0.38;
      c.fillStyle = col; c.beginPath(); c.moveTo(x, ty); c.lineTo(x + tw, ty + th); c.lineTo(x - tw, ty + th); c.closePath(); c.fill();
      if (lit) { c.fillStyle = lit; c.beginPath(); c.moveTo(x, ty); c.lineTo(x - tw, ty + th); c.lineTo(x - tw * 0.3, ty + th); c.closePath(); c.fill(); }
      if (snow) { c.fillStyle = snow; c.beginPath(); c.moveTo(x, ty); c.lineTo(x + tw * 0.4, ty + th * 0.4); c.quadraticCurveTo(x, ty + th * 0.55, x - tw * 0.4, ty + th * 0.4); c.closePath(); c.fill(); }
    }
    c.fillStyle = col; c.fillRect(x - 3, y + h * 0.95, 6, H);
  }
  function house(c, x, y, w, h, wall, roof, win, opts = {}) {
    const rh = opts.roofH || w * 0.4;
    c.fillStyle = wall; c.fillRect(x, y, w, H - y);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x + w * 0.72, y, w * 0.28, H - y);
    c.fillStyle = roof; c.beginPath(); c.moveTo(x - 6, y + 2); c.lineTo(x + w / 2, y - rh); c.lineTo(x + w + 6, y + 2); c.closePath(); c.fill();
    if (opts.snow) { c.fillStyle = opts.snow; c.beginPath(); c.moveTo(x - 7, y + 2); c.lineTo(x + w / 2, y - rh - 2); c.lineTo(x + w + 7, y + 2); c.lineTo(x + w + 2, y + 7); c.lineTo(x + w / 2, y - rh + 6); c.lineTo(x - 2, y + 7); c.closePath(); c.fill(); }
    if (opts.chimney) { c.fillStyle = roof; c.fillRect(x + w * 0.68, y - rh * 0.85, 9, rh * 0.6); }
    if (opts.outline) { c.strokeStyle = opts.outline; c.lineWidth = 1.5; c.strokeRect(x + 0.5, y + 0.5, w - 1, H - y); c.beginPath(); c.moveTo(x - 6, y + 2); c.lineTo(x + w / 2, y - rh); c.lineTo(x + w + 6, y + 2); c.stroke(); }
    for (let wy = y + 14; wy < y + h - 12; wy += 26) for (let wx = x + 9; wx < x + w - 14; wx += 20) {
      const lit = hash(wx * 0.37 + wy * 1.3 + x) > 0.4;
      c.fillStyle = lit ? win : 'rgba(0,0,0,0.18)'; c.fillRect(wx, wy, 9, 13);
      if (opts.outline) { c.strokeStyle = opts.outline; c.lineWidth = 1; c.strokeRect(wx, wy, 9, 13); }
      if (opts.sill) { c.fillStyle = opts.sill; c.fillRect(wx - 1, wy + 13, 11, 2); }
    }
  }

  function paintLayers(name) {
    if (layerCache[name]) return layerCache[name];
    const th = THEMES[name];
    const L = [];
    const layer = (f, paint) => { const [cv2, c] = makeCanvas(LW, H); paint(c); L.push({ f, cv: cv2 }); };
    const R = (i, k = 0) => hash(i * 13.7 + k * 91.1 + name.length * 7);
    if (name === 'spring' || name === 'stage') {
      const night = name === 'stage';
      layer(0.08, c => { ridge(c, 330, 60, 2, 1, night ? '#3a2850' : '#e9c4c6'); fogBand(c, 250, 420, th.haze, 0.6); });
      layer(0.2, c => {
        for (let i = 0; i < 34; i++) { const w = 50 + R(i) * 50, h = 90 + R(i, 1) * 110, x = i * 62 + R(i, 2) * 20; wrap(x2 => house(c, x2, 360 - h, w, h, night ? '#40284e' : '#e3b9bc', night ? '#2a1a38' : '#d3a1a8', night ? '#f2c87966' : '#fff2e855', { chimney: R(i, 3) > 0.5 }), x, w + 10); }
        wrap(x2 => { c.fillStyle = night ? '#2a1a38' : '#d3a1a8'; c.fillRect(x2, 150, 30, 250); c.beginPath(); c.moveTo(x2 - 6, 152); c.lineTo(x2 + 15, 60); c.lineTo(x2 + 36, 152); c.fill(); }, 700, 40);
        fogBand(c, 280, 480, th.haze, 0.55);
      });
      const walls = night ? ['#4f3360', '#5a3d66', '#46305a', '#62405e'] : ['#f2cfc6', '#ecdcc0', '#dcc8de', '#cfdbe4', '#f3e0c2', '#e8c0b0'];
      const roofs = night ? ['#2a1a38', '#33203f'] : ['#b9787a', '#9a6a72', '#c98c6c', '#8a7aa0'];
      layer(0.42, c => {
        for (let i = 0; i < 28; i++) {
          const w = 64 + R(i, 4) * 50, h = 110 + R(i, 5) * 90, x = i * 74 + R(i, 6) * 10;
          wrap(x2 => house(c, x2, 420 - h, w, h, walls[i % walls.length], roofs[(i * 3) % roofs.length], night ? '#ffd98acc' : '#fffaf0', { outline: rgba(INK, 0.55), chimney: R(i, 7) > 0.45, sill: night ? null : '#ffffffaa', roofH: 22 + R(i, 8) * 22 }), x, w + 12);
        }
        fogBand(c, 380, 544, th.haze, 0.35);
      });
      layer(0.7, c => {
        for (let i = 0; i < 12; i++) {
          const x = i * 175 + R(i, 9) * 60;
          if (night) wrap(x2 => { c.fillStyle = '#1e1428'; c.fillRect(x2, 380, 8, 200); c.fillRect(x2 - 30, 380, 68, 8); }, x - 30, 70);
          else wrap(x2 => roundTree(c, x2, 400 + R(i, 10) * 30, 46 + R(i, 11) * 20, '#b9cf9a', '#d6e8b8', '#97ae7e', '#7a5e48'), x - 70, 140);
        }
      });
    } else if (name === 'autumn') {
      layer(0.08, c => { ridge(c, 320, 70, 2, 2, '#e8a77a'); fogBand(c, 220, 420, th.haze, 0.55); });
      layer(0.22, c => { for (let i = 0; i < 40; i++) { const x = i * 52 + R(i) * 20; wrap(x2 => roundTree(c, x2, 330 + R(i, 1) * 50, 40 + R(i, 2) * 26, '#df9a5c', '#efb878', '#cd8650', '#a46a48'), x - 60, 120); } fogBand(c, 300, 500, th.haze, 0.5); });
      layer(0.45, c => {
        const cols = [['#d0602f', '#ec8a4a', '#a8481f'], ['#e39a35', '#f6c060', '#b9741f'], ['#b8462c', '#dc6a40', '#8a2e1a'], ['#c9a03a', '#e8c460', '#987028']];
        for (let i = 0; i < 22; i++) { const x = i * 96 + R(i, 3) * 30, k = cols[i % 4]; wrap(x2 => roundTree(c, x2, 380 + R(i, 4) * 40, 50 + R(i, 5) * 30, k[0], k[1], k[2], '#5e3d2a'), x - 90, 180); }
        fogBand(c, 400, 544, th.haze, 0.3);
      });
      layer(0.72, c => { for (let i = 0; i < 10; i++) { const x = i * 210 + R(i, 6) * 50; wrap(x2 => { c.fillStyle = '#4a2e20'; c.fillRect(x2, 0, 22, H); c.fillStyle = '#5e3a26'; c.fillRect(x2 + 4, 0, 6, H); }, x, 30); } });
    } else if (name === 'garden') {
      layer(0.06, c => {
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3;
        for (let i = 0; i < 8; i++) { const x = i * 256; c.beginPath(); c.moveTo(x, H); c.lineTo(x, 200); c.quadraticCurveTo(x + 128, -60, x + 256, 200); c.stroke(); }
        c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,0.35)';
        for (let x = 0; x < LW; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
        for (let y = 60; y < H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(LW, y); c.stroke(); }
        fogBand(c, 200, 500, th.haze, 0.5);
      });
      layer(0.22, c => { for (let i = 0; i < 40; i++) { const x = i * 52 + R(i) * 20; wrap(x2 => roundTree(c, x2, 340 + R(i, 1) * 40, 34 + R(i, 2) * 20, '#a8cc96', '#c6e2b0', '#8fb682', '#7a6a50'), x - 50, 100); } fogBand(c, 320, 520, th.haze, 0.45); });
      layer(0.45, c => {
        for (let i = 0; i < 18; i++) {
          const x = i * 118 + R(i, 3) * 30, y = 330 + R(i, 4) * 50, r = 56 + R(i, 5) * 26;
          wrap(x2 => {
            c.strokeStyle = '#5a4436'; c.lineWidth = 7; c.beginPath(); c.moveTo(x2, H); c.quadraticCurveTo(x2 - 10, y + 60, x2, y); c.stroke();
            c.lineWidth = 3; c.beginPath(); c.moveTo(x2, y + 40); c.lineTo(x2 - r * 0.7, y - 10); c.moveTo(x2, y + 20); c.lineTo(x2 + r * 0.6, y - 20); c.stroke();
            for (let k = 0; k < 26; k++) {
              const a = R(i, k + 10) * TAU, d = R(i, k + 40) * r;
              const bx = x2 + Math.cos(a) * d, by = y - 10 + Math.sin(a) * d * 0.6;
              c.fillStyle = k % 3 ? '#fbe6ee' : '#f2b8c8'; c.beginPath(); c.ellipse(bx, by, 7, 5, a, 0, TAU); c.fill();
              c.fillStyle = '#e88aa4'; c.beginPath(); c.arc(bx, by + 1, 2, 0, TAU); c.fill();
            }
          }, x - r, r * 2);
        }
        fogBand(c, 420, 544, th.haze, 0.3);
      });
      layer(0.72, c => {
        for (let i = 0; i < 14; i++) {
          const x = i * 150 + R(i, 6) * 60;
          wrap(x2 => { for (let k = 0; k < 5; k++) { const a = -1.2 + k * 0.6; c.fillStyle = k % 2 ? '#5e9a58' : '#6fae64'; c.save(); c.translate(x2, 520); c.rotate(a); c.beginPath(); c.ellipse(0, -60, 16, 62, 0, 0, TAU); c.fill(); c.restore(); } }, x - 80, 160);
        }
      });
    } else if (name === 'sea') {
      layer(0.04, c => { ridge(c, 330, 50, 1, 3, '#8a5a7a'); ridge(c, 345, 30, 3, 5, '#a46a7e'); });
      layer(0.1, c => {
        const g = c.createLinearGradient(0, 340, 0, H); g.addColorStop(0, '#f0a080'); g.addColorStop(0.15, '#c46a7a'); g.addColorStop(1, '#4a3a70');
        c.fillStyle = g; c.fillRect(0, 340, LW, H);
        c.fillStyle = 'rgba(255,220,170,0.35)';
        for (let i = 0; i < 160; i++) { const y = 345 + R(i) * 190, w = 10 + R(i, 1) * 50 * (1 - (y - 340) / 300); c.fillRect(R(i, 2) * LW, y, w, 1.5); }
        wrap(x2 => { c.fillStyle = '#5a3a5a'; c.beginPath(); c.moveTo(x2, 340); c.lineTo(x2 + 8, 240); c.lineTo(x2 + 22, 240); c.lineTo(x2 + 30, 340); c.fill(); c.fillStyle = '#ffe8b0'; c.fillRect(x2 + 9, 228, 12, 12); c.fillStyle = '#5a3a5a'; c.beginPath(); c.moveTo(x2 + 5, 228); c.lineTo(x2 + 15, 214); c.lineTo(x2 + 25, 228); c.fill(); }, 1200, 40);
      });
      layer(0.38, c => {
        for (let i = 0; i < 4; i++) {
          const x = i * 512 + 60;
          wrap(x2 => {
            c.fillStyle = '#5a3a48'; c.fillRect(x2, 400, 340, 14);
            for (let k = 0; k < 9; k++) { c.fillRect(x2 + 6 + k * 40, 410, 9, 140); }
            c.strokeStyle = '#5a3a48'; c.lineWidth = 3; for (let k = 0; k < 8; k++) { c.beginPath(); c.moveTo(x2 + 10 + k * 40, 412); c.lineTo(x2 + 50 + k * 40, 470); c.stroke(); }
            c.fillRect(x2 + 260, 350, 50, 50); c.beginPath(); c.moveTo(x2 + 254, 352); c.lineTo(x2 + 285, 330); c.lineTo(x2 + 316, 352); c.fill();
            c.fillStyle = '#ffd99a'; c.fillRect(x2 + 272, 362, 10, 12); c.fillRect(x2 + 290, 362, 10, 12);
          }, x, 350);
        }
      });
      layer(0.75, c => { for (let i = 0; i < 9; i++) { const x = i * 230 + R(i) * 60; wrap(x2 => { c.fillStyle = '#3c2634'; c.fillRect(x2, 420, 14, 200); c.fillStyle = '#4c3040'; c.fillRect(x2 + 3, 420, 4, 200); c.strokeStyle = '#3c2634'; c.lineWidth = 2; c.beginPath(); c.moveTo(x2 + 7, 432); c.quadraticCurveTo(x2 + 120, 470, x2 + 237, 432); c.stroke(); }, x, 250); } });
    } else if (name === 'moon') {
      layer(0.06, c => { ridge(c, 330, 90, 2, 4, '#2a3468'); fogBand(c, 240, 430, th.haze, 0.6); });
      layer(0.2, c => { for (let i = 0; i < 60; i++) { const x = i * 35 + R(i) * 20, h = 120 + R(i, 1) * 90; wrap(x2 => pine(c, x2, 400 - h, h, '#28305e', null), x - 40, 80); } fogBand(c, 300, 500, th.haze, 0.55); });
      layer(0.42, c => { for (let i = 0; i < 34; i++) { const x = i * 62 + R(i, 2) * 30, h = 170 + R(i, 3) * 110; wrap(x2 => pine(c, x2, 470 - h, h, '#1c2248', '#2a3366'), x - 60, 120); } fogBand(c, 420, 544, th.haze, 0.35); });
      layer(0.72, c => { for (let i = 0; i < 9; i++) { const x = i * 230 + R(i, 4) * 60; wrap(x2 => { c.fillStyle = '#10142c'; c.fillRect(x2, 0, 26, H); c.beginPath(); c.moveTo(x2, 120); c.quadraticCurveTo(x2 - 60, 90, x2 - 110, 130); c.lineTo(x2 - 100, 136); c.quadraticCurveTo(x2 - 50, 104, x2, 136); c.fill(); }, x - 120, 160); } });
    } else if (name === 'haunt') {
      layer(0.06, c => {
        ridge(c, 400, 30, 2, 2, '#1c2a2e');
        wrap(x2 => {
          c.fillStyle = '#1a2428';
          c.fillRect(x2, 230, 420, 200); c.beginPath(); c.moveTo(x2 - 10, 232); c.lineTo(x2 + 210, 150); c.lineTo(x2 + 430, 232); c.fill();
          for (const [tx, th2] of [[20, 130], [360, 160]]) { c.fillRect(x2 + tx, 230 - th2 + 40, 44, th2); c.beginPath(); c.moveTo(x2 + tx - 6, 230 - th2 + 42); c.lineTo(x2 + tx + 22, 230 - th2 - 20); c.lineTo(x2 + tx + 50, 230 - th2 + 42); c.fill(); }
          c.fillStyle = '#d8f0a0aa'; for (let k = 0; k < 14; k++) if (hash(k + 3) > 0.45) c.fillRect(x2 + 70 + (k % 7) * 44, 260 + (k / 7 | 0) * 60, 12, 20);
        }, 500, 440);
        fogBand(c, 280, 470, th.haze, 0.6);
      });
      layer(0.3, c => {
        for (let i = 0; i < 16; i++) { const x = i * 128; wrap(x2 => { c.fillStyle = '#1e2c30'; c.fillRect(x2, 140, 22, H); c.fillRect(x2 + 106, 140, 22, H); c.beginPath(); c.moveTo(x2, 150); c.quadraticCurveTo(x2 + 64, 60, x2 + 128, 150); c.lineTo(x2 + 128, 130); c.quadraticCurveTo(x2 + 64, 40, x2, 130); c.fill(); }, x, 130); }
        fogBand(c, 360, 520, th.haze, 0.5);
      });
      layer(0.5, c => {
        for (let i = 0; i < 10; i++) {
          const x = i * 210 + 20;
          wrap(x2 => {
            c.fillStyle = '#2a2020'; c.fillRect(x2, 250, 150, H);
            for (let s = 0; s < 8; s++) {
              const sy = 262 + s * 36; let bx = x2 + 8;
              while (bx < x2 + 140) { const bw = 5 + hash(bx * 0.7 + s) * 8, bh = 22 + hash(bx + s * 3) * 10; c.fillStyle = ['#5a3040', '#30485a', '#5a5030', '#3a5a40', '#6a4a3a'][Math.floor(hash(bx * 1.3 + s) * 5)]; c.fillRect(bx, sy + 30 - bh, bw, bh); bx += bw + 1; }
              c.fillStyle = '#1a1414'; c.fillRect(x2, sy + 30, 150, 5);
            }
          }, x, 160);
        }
        fogBand(c, 430, 544, th.haze, 0.4);
      });
      layer(0.75, c => { for (let i = 0; i < 7; i++) { const x = i * 300 + 40; wrap(x2 => { c.fillStyle = '#0e1416'; c.fillRect(x2, 0, 46, H); c.fillRect(x2 - 10, 0, 66, 30); c.fillRect(x2 - 8, 440, 62, 20); }, x - 10, 80); } });
    } else if (name === 'snow') {
      layer(0.05, c => { ridge(c, 300, 120, 2, 6, '#b8c6da', 'rgba(255,255,255,0.8)'); fogBand(c, 220, 420, th.haze, 0.55); });
      layer(0.18, c => { for (let i = 0; i < 50; i++) { const x = i * 42 + R(i) * 20, h = 90 + R(i, 1) * 70; wrap(x2 => pine(c, x2, 390 - h, h, '#8ea2b8', null, '#f4f8ff'), x - 40, 80); } fogBand(c, 300, 500, th.haze, 0.5); });
      layer(0.4, c => {
        const walls = ['#c96a5a', '#d8b48a', '#7a9ab8', '#e8d8c0', '#9a7a9a'];
        for (let i = 0; i < 24; i++) { const w = 70 + R(i, 2) * 40, h = 80 + R(i, 3) * 60, x = i * 86 + R(i, 4) * 10; wrap(x2 => house(c, x2, 430 - h, w, h, walls[i % 5], '#5a4a52', '#ffd98a', { snow: '#ffffff', chimney: true, outline: rgba(INK, 0.5), roofH: 30 }), x, w + 12); }
        fogBand(c, 400, 544, th.haze, 0.35);
      });
      layer(0.7, c => { for (let i = 0; i < 12; i++) { const x = i * 175 + R(i, 5) * 60, h = 240 + R(i, 6) * 80; wrap(x2 => pine(c, x2, 560 - h, h, '#4c6a72', '#5e7e86', '#ffffff'), x - 90, 180); } });
    } else if (name === 'clock') {
      layer(0.25, c => {
        for (let i = 0; i < 7; i++) {
          const x = i * 300 + 60;
          wrap(x2 => {
            c.fillStyle = '#2a1a12'; c.beginPath(); c.moveTo(x2, 470); c.lineTo(x2, 140); c.arc(x2 + 60, 140, 60, Math.PI, 0); c.lineTo(x2 + 120, 470); c.fill();
            const g = c.createLinearGradient(0, 80, 0, 470); g.addColorStop(0, '#ffd99088'); g.addColorStop(1, '#ffb06022');
            c.fillStyle = g; c.beginPath(); c.moveTo(x2 + 8, 470); c.lineTo(x2 + 8, 140); c.arc(x2 + 60, 140, 52, Math.PI, 0); c.lineTo(x2 + 112, 470); c.fill();
            c.strokeStyle = '#2a1a12'; c.lineWidth = 4; c.beginPath(); c.moveTo(x2 + 60, 88); c.lineTo(x2 + 60, 470); c.moveTo(x2 + 8, 240); c.lineTo(x2 + 112, 240); c.moveTo(x2 + 8, 360); c.lineTo(x2 + 112, 360); c.stroke();
          }, x, 130);
        }
        fogBand(c, 300, 520, th.haze, 0.5);
      });
      layer(0.48, c => { for (let i = 0; i < 12; i++) { const x = i * 175; wrap(x2 => { c.fillStyle = '#3a2618'; c.fillRect(x2, 0, 34, H); c.fillStyle = '#4e3422'; c.fillRect(x2 + 4, 0, 8, H); c.fillStyle = '#2e1e14'; c.fillRect(x2 - 10, 100, 54, 16); c.fillRect(x2 - 10, 420, 54, 16); }, x - 10, 60); } fogBand(c, 420, 544, th.haze, 0.35); });
      layer(0.75, c => { for (let i = 0; i < 8; i++) { const x = i * 260 + 90; wrap(x2 => { c.strokeStyle = '#1e140c'; c.lineWidth = 5; c.beginPath(); for (let y = 0; y < 300; y += 14) { c.moveTo(x2 - 4, y); c.lineTo(x2 + 4, y + 10); c.moveTo(x2 + 4, y + 7); c.lineTo(x2 - 4, y + 17); } c.stroke(); }, x - 6, 20); } });
    } else if (name === 'carnival') {
      layer(0.2, c => {
        const stripes = [['#c84a5a', '#f2e0c8'], ['#4a6ab0', '#f2e0c8'], ['#d8a03a', '#f2e0c8'], ['#5a9a7a', '#f2e0c8']];
        for (let i = 0; i < 12; i++) {
          const x = i * 170 + R(i) * 40, w = 110 + R(i, 1) * 50, h = 80 + R(i, 2) * 40, y = 400 - h, s = stripes[i % 4];
          wrap(x2 => {
            for (let k = 0; k < 8; k++) { c.fillStyle = s[k % 2]; c.beginPath(); c.moveTo(x2 + w / 2, y - 50); c.lineTo(x2 + k * w / 8, y); c.lineTo(x2 + (k + 1) * w / 8, y); c.closePath(); c.fill(); c.fillRect(x2 + k * w / 8, y, w / 8 + 0.5, h + 200); }
            c.fillStyle = 'rgba(30,10,40,0.35)'; c.fillRect(x2, y, w, h + 200);
            c.fillStyle = '#ffd36a'; c.beginPath(); c.arc(x2 + w / 2, y - 54, 4, 0, TAU); c.fill();
          }, x, w);
        }
        fogBand(c, 300, 520, th.haze, 0.55);
      });
      layer(0.45, c => {
        for (let i = 0; i < 10; i++) {
          const x = i * 205 + R(i, 3) * 40;
          wrap(x2 => {
            c.fillStyle = '#4a2a4a'; c.fillRect(x2, 380, 120, 200);
            c.fillStyle = '#ffd99a'; c.fillRect(x2 + 12, 400, 96, 40);
            c.fillStyle = '#c84a5a'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x2 + 10 + k * 20, 380, 10, 0, Math.PI); c.fill(); }
            for (let k = 0; k < 7; k++) { c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(x2 + k * 20, 372, 3, 0, TAU); c.fill(); }
          }, x, 130);
        }
        fogBand(c, 430, 544, th.haze, 0.35);
      });
    }
    return (layerCache[name] = L);
  }

  // =====================================================================
  //  TERRAIN — tiles pre-rendered into lazily built, high-DPI chunks
  // =====================================================================
  const CHUNK = 1024;
  function buildChunk(g, ci) {
    const [cv2, c] = makeCanvas(CHUNK, H, DPR);
    c.translate(-ci * CHUNK, 0);
    const L = g.L, th = g.theme;
    const tx0 = Math.max(0, Math.floor(ci * CHUNK / T) - 1), tx1 = Math.min(L.w - 1, Math.ceil((ci + 1) * CHUNK / T) + 1);
    const solid = (x, y) => x >= 0 && x < L.w && SOLID(tileAt(L, x, y));
    for (let ty = 0; ty < L.h; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = L.tiles[ty][tx];
      if (!SOLID(t)) continue;
      const px = tx * T, py = ty * T;
      let depth = 0; for (let k = ty - 1; k >= 0 && solid(tx, k); k--) depth++;
      const g0 = c.createLinearGradient(0, py, 0, py + T);
      g0.addColorStop(0, mix(th.body, th.deep, clamp01(depth / 4)));
      g0.addColorStop(1, mix(th.body, th.deep, clamp01((depth + 1) / 4)));
      c.fillStyle = g0; c.fillRect(px, py, T + 0.5, T + 0.5);
      bodyTexture(c, th, px, py, tx, ty, depth);
      if (!solid(tx - 1, ty)) { const gs = c.createLinearGradient(px, 0, px + 10, 0); gs.addColorStop(0, 'rgba(255,240,220,0.18)'); gs.addColorStop(1, 'rgba(255,240,220,0)'); c.fillStyle = gs; c.fillRect(px, py, 10, T); }
      if (!solid(tx + 1, ty)) { const gs = c.createLinearGradient(px + T, 0, px + T - 12, 0); gs.addColorStop(0, 'rgba(20,10,10,0.35)'); gs.addColorStop(1, 'rgba(20,10,10,0)'); c.fillStyle = gs; c.fillRect(px + T - 12, py, 12, T); }
    }
    c.strokeStyle = INK; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath();
    for (let ty = 0; ty < L.h; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!solid(tx, ty)) continue;
      const px = tx * T, py = ty * T;
      if (!solid(tx - 1, ty)) { c.moveTo(px + 1, py); c.lineTo(px + 1, py + T); }
      if (!solid(tx + 1, ty)) { c.moveTo(px + T - 1, py); c.lineTo(px + T - 1, py + T); }
      if (!solid(tx, ty + 1) && ty < L.h - 1) { c.moveTo(px, py + T - 1); c.lineTo(px + T, py + T - 1); }
    }
    c.stroke();
    for (let ty = 0; ty < L.h; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = L.tiles[ty][tx];
      if (!SOLID(t) || solid(tx, ty - 1)) continue;
      cap(c, th, g.themeName, tx * T, ty * T, tx, !solid(tx - 1, ty) || solid(tx - 1, ty - 1), !solid(tx + 1, ty) || solid(tx + 1, ty - 1), t === 4);
    }
    for (let ty = 0; ty < L.h; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = L.tiles[ty][tx];
      if (t === 2) plank(c, th, g.themeName, tx * T, ty * T, tx, L.tiles[ty][tx - 1] === 2, L.tiles[ty][tx + 1] === 2);
      else if (t === 3) thorns(c, tx * T, ty * T, tx);
    }
    return cv2;
  }

  function bodyTexture(c, th, px, py, tx, ty, depth) {
    const style = th.cap;
    if (style === 'moss' || style === 'roof') {
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.2; c.beginPath();
      if (style === 'moss') {
        const off = (ty % 2) * 16;
        c.moveTo(px, py + 16); c.lineTo(px + T, py + 16); c.moveTo(px, py + T); c.lineTo(px + T, py + T);
        c.moveTo(px + ((off + 8) % 32), py); c.lineTo(px + ((off + 8) % 32), py + 16); c.moveTo(px + ((off + 24) % 32), py + 16); c.lineTo(px + ((off + 24) % 32), py + 32);
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(px + 2, py + 2, 28, 3);
      } else {
        for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { const sx = px + k * 11 + (r % 2) * 5, sy = py + r * 11; c.moveTo(sx, sy + 8); c.arc(sx + 5.5, sy + 8, 5.5, Math.PI, 0, true); }
        c.stroke();
      }
      return;
    }
    if (style === 'plank') {
      c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 1.2; c.beginPath();
      c.moveTo(px, py + 10.5); c.lineTo(px + T, py + 10.5); c.moveTo(px, py + 21.5); c.lineTo(px + T, py + 21.5);
      const j = (tx * 3 + ty) % 4 * 8; c.moveTo(px + j, py); c.lineTo(px + j, py + 10); c.stroke();
      c.strokeStyle = 'rgba(255,230,190,0.12)'; c.beginPath(); c.moveTo(px + 3, py + 4); c.quadraticCurveTo(px + 16, py + 7, px + 29, py + 4); c.stroke();
      return;
    }
    for (let k = 0; k < 4; k++) {
      const sx = px + hash(tx * 7.1 + ty * 3.3 + k) * 30, sy = py + hash(tx * 2.7 + ty * 9.1 + k) * 30;
      c.fillStyle = 'rgba(40,20,10,0.16)'; c.beginPath(); c.arc(sx, sy, 1 + hash(sx) * 1.6, 0, TAU); c.fill();
    }
    if (hash(tx * 4.3 + ty * 7.7) > 0.72 && depth > 0) {
      const sx = px + 6 + hash(tx + ty) * 18, sy = py + 8 + hash(tx * 2 + ty) * 16, r = 4 + hash(tx * 3) * 4;
      c.fillStyle = mix(th.deep, '#9a8a80', 0.45); c.beginPath(); c.ellipse(sx, sy, r * 1.3, r, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(sx - r * 0.3, sy - r * 0.35, r * 0.6, r * 0.35, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(30,15,10,0.45)'; c.lineWidth = 1; c.beginPath(); c.ellipse(sx, sy, r * 1.3, r, 0, 0, TAU); c.stroke();
    }
  }

  function cap(c, th, name, px, py, tx, openL, openR, ice) {
    const style = ice ? 'ice' : th.cap;
    const sh = c.createLinearGradient(0, py + 8, 0, py + 22); sh.addColorStop(0, 'rgba(20,10,10,0.35)'); sh.addColorStop(1, 'rgba(20,10,10,0)');
    c.fillStyle = sh; c.fillRect(px, py + 8, T, 14);
    const top = style === 'ice' ? '#bfe6f6' : th.top, lit = style === 'ice' ? '#f2fbff' : th.topLit;
    const capH = style === 'snow' ? 12 : style === 'plank' || style === 'roof' ? 8 : 10;
    const ox = openL ? -3 : 0, ow = T + (openL ? 3 : 0) + (openR ? 3 : 0);
    c.fillStyle = top; c.beginPath();
    c.moveTo(px + ox, py - 1);
    c.lineTo(px + ox + ow, py - 1);
    c.lineTo(px + ox + ow, py + capH - 1);
    const n = 4;
    for (let k = n - 1; k >= 0; k--) {
      const bx = px + ox + ow * k / n, dip = capH + (style === 'snow' || style === 'lush' ? 4 : 2) * hash(tx * 5 + k);
      c.quadraticCurveTo(bx + ow / n / 2, py + dip + 3, bx, py + capH - 1);
    }
    c.closePath(); c.fill();
    c.fillStyle = lit; c.fillRect(px + ox + 2, py, ow - 4, 3);
    c.strokeStyle = INK; c.lineWidth = 2.2; c.beginPath(); c.moveTo(px + ox, py); c.lineTo(px + ox + ow, py); c.stroke();
    if (style === 'ice') { c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 6, py + 6); c.lineTo(px + 14, py + 3); c.stroke(); }
    const r = hash(tx * 9.13);
    if (style === 'grass' || style === 'lush') {
      c.strokeStyle = mix(th.top, '#203018', 0.3); c.lineWidth = 1.2; c.beginPath();
      for (let k = 0; k < 6; k++) { const bx = px + 3 + k * 5 + hash(tx + k) * 3, bh = 3 + hash(tx * 2 + k) * 5; c.moveTo(bx, py); c.quadraticCurveTo(bx + 1, py - bh * 0.6, bx + (hash(k + tx) - 0.5) * 4, py - bh); }
      c.stroke();
      if (name === 'spring' && r > 0.7) flower(c, px + 8 + hash(tx) * 16, py, th.accent);
      if (name === 'garden' && r > 0.55) flower(c, px + 8 + hash(tx) * 16, py, r > 0.8 ? '#f6d06a' : '#f0a8c0');
      if (name === 'moon' && r > 0.78) mushroom(c, px + 10 + hash(tx) * 12, py, '#c66a7a');
      if (name === 'autumn' && r > 0.5) { c.fillStyle = ['#c4502e', '#e39a35', '#b8462c'][tx % 3]; c.beginPath(); c.ellipse(px + 6 + r * 20, py - 1, 4, 2, r * 3, 0, TAU); c.fill(); }
      if (name === 'carnival' && r > 0.6) { for (let k = 0; k < 3; k++) { c.fillStyle = ['#ff6a8a', '#ffd36a', '#6ac8ff'][k]; c.fillRect(px + hash(tx + k * 3) * 28, py - 2 + hash(k + tx) * 4, 3, 2); } }
    } else if (style === 'sand') {
      if (r > 0.75) { c.fillStyle = '#fff0e0'; c.beginPath(); c.arc(px + 10 + r * 10, py - 1, 3.5, Math.PI, 0); c.fill(); c.strokeStyle = '#c99a80'; c.lineWidth = 1; c.stroke(); }
      if (r < 0.15) { c.strokeStyle = '#6a8a50'; c.lineWidth = 1.5; c.beginPath(); for (let k = 0; k < 4; k++) { c.moveTo(px + 14 + k * 2, py); c.quadraticCurveTo(px + 12 + k * 3, py - 8, px + 8 + k * 5, py - 12); } c.stroke(); }
    } else if (style === 'snow') {
      if (openR) { c.fillStyle = '#e8f6ff'; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(px + T - 9 + k * 4, py + 10); c.lineTo(px + T - 7 + k * 4, py + 18 + hash(tx + k) * 8); c.lineTo(px + T - 5 + k * 4, py + 10); c.fill(); } }
      if (r > 0.8) { c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(px + 16, py - 1, 9, 4, 0, Math.PI, 0); c.fill(); }
    } else if (style === 'moss') {
      c.fillStyle = '#7fa07a'; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(px + 4 + k * 10, py + 8); c.quadraticCurveTo(px + 6 + k * 10, py + 16 + hash(tx + k) * 8, px + 8 + k * 10, py + 8); c.fill(); }
    }
  }

  function flower(c, x, y, col) {
    c.strokeStyle = '#5f8a4a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 2, y - 5, x, y - 10); c.stroke();
    c.fillStyle = col; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; c.beginPath(); c.arc(x + Math.cos(a) * 3, y - 11 + Math.sin(a) * 3, 2.5, 0, TAU); c.fill(); }
    c.fillStyle = '#f9e6a0'; c.beginPath(); c.arc(x, y - 11, 1.8, 0, TAU); c.fill();
  }
  function mushroom(c, x, y, col) {
    c.fillStyle = '#efe6d0'; c.fillRect(x - 1.5, y - 7, 3, 7);
    c.fillStyle = col; c.beginPath(); c.arc(x, y - 7, 6, Math.PI, 0); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 2, y - 9, 1, 0, TAU); c.arc(x + 2.5, y - 8, 0.8, 0, TAU); c.fill();
  }
  function candle(c, x, y, t) {
    c.fillStyle = '#efe6d0'; c.fillRect(x - 2.5, y - 12, 5, 12); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(x - 2.5, y - 12, 5, 12);
    c.fillStyle = '#ffd36a'; c.beginPath(); c.ellipse(x + Math.sin((t || 0) * 9 + x) * 0.6, y - 15, 2, 3.5, 0, 0, TAU); c.fill();
  }

  function plank(c, th, name, px, py, tx, joinL, joinR) {
    const col = name === 'clock' ? '#b08a52' : name === 'haunt' ? '#5c4636' : th.wood;
    const g = c.createLinearGradient(0, py, 0, py + 12); g.addColorStop(0, mix(col, '#ffffff', 0.25)); g.addColorStop(1, mix(col, '#000000', 0.25));
    c.fillStyle = g; c.fillRect(px, py, T, 12);
    c.strokeStyle = 'rgba(40,20,10,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 2, py + 6); c.quadraticCurveTo(px + 16, py + 4 + hash(tx) * 4, px + 30, py + 6); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath();
    c.moveTo(px, py + 1); c.lineTo(px + T, py + 1); c.moveTo(px, py + 11); c.lineTo(px + T, py + 11);
    if (!joinL) { c.moveTo(px + 1, py); c.lineTo(px + 1, py + 12); }
    if (!joinR) { c.moveTo(px + T - 1, py); c.lineTo(px + T - 1, py + 12); }
    c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(px + 5, py + 6, 1.3, 0, TAU); c.arc(px + 27, py + 6, 1.3, 0, TAU); c.fill();
    if (!joinL || !joinR) {
      const bx = !joinL ? px + 6 : px + 22;
      c.strokeStyle = rgba(INK, 0.8); c.lineWidth = 2; c.beginPath(); c.moveTo(bx, py + 12); c.lineTo(bx + (!joinL ? 6 : -6), py + 20); c.stroke();
    }
  }

  function thorns(c, px, py) {
    c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const bx = px + 6 + k * 10;
      c.strokeStyle = '#3d5a36'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(bx, py + T); c.quadraticCurveTo(bx + (k - 1) * 7, py + 20, bx + (k - 1) * 3, py + 9); c.stroke();
      c.strokeStyle = '#6f8f5f'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx - 1, py + T); c.quadraticCurveTo(bx + (k - 1) * 7 - 1, py + 20, bx + (k - 1) * 3 - 1, py + 10); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.moveTo(bx - 1, py + 22); c.lineTo(bx - 7, py + 19); c.lineTo(bx, py + 18); c.fill();
      c.beginPath(); c.moveTo(bx + 1, py + 27); c.lineTo(bx + 7, py + 24); c.lineTo(bx, py + 24); c.fill();
      c.fillStyle = '#5f8a4a'; c.beginPath(); c.ellipse(bx + 4, py + 15, 3.5, 1.8, -0.6, 0, TAU); c.fill();
    }
    const rg = c.createRadialGradient(px + 14, py + 8, 1, px + 16, py + 10, 7); rg.addColorStop(0, '#e86a7a'); rg.addColorStop(1, '#8e2a3a');
    c.fillStyle = rg; c.beginPath(); c.arc(px + 16, py + 10, 6.5, 0, TAU); c.fill();
    c.strokeStyle = '#6a1a28'; c.lineWidth = 1.2; c.beginPath(); c.arc(px + 16, py + 10, 3, 0.4, 5.4); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.arc(px + 16, py + 10, 6.5, 0, TAU); c.stroke();
  }

  // foreground silhouettes (soft, out of focus)
  const fgCache = {};
  function fgSprites(name) {
    if (fgCache[name]) return fgCache[name];
    const th = THEMES[name];
    const col = mix(th.deep, '#000000', 0.55);
    const sprites = [];
    const make = (w, h, top, draw) => { const [cv2, c] = makeCanvas(w, h); if ('filter' in c) c.filter = 'blur(3px)'; c.fillStyle = col; c.strokeStyle = col; draw(c, w, h); sprites.push({ cv: cv2, w, h, top }); };
    make(180, 120, false, (c, w, h) => { for (let k = 0; k < 16; k++) { const x = 20 + k * 9, bh = 40 + hash(k + name.length) * 70; c.beginPath(); c.moveTo(x - 6, h); c.quadraticCurveTo(x, h - bh * 0.6, x + (hash(k) - 0.5) * 30, h - bh); c.quadraticCurveTo(x + 2, h - bh * 0.5, x + 6, h); c.fill(); } });
    make(220, 110, false, (c, w, h) => { c.beginPath(); c.arc(70, h, 60, Math.PI, 0); c.arc(140, h + 10, 70, Math.PI, 0); c.fill(); });
    make(260, 160, true, (c) => { c.lineWidth = 8; c.beginPath(); c.moveTo(0, 10); c.quadraticCurveTo(120, 40, 250, 20); c.stroke(); for (let k = 0; k < 14; k++) { const x = 20 + k * 17, y = 20 + Math.sin(k) * 8; c.beginPath(); c.ellipse(x, y + 18 + hash(k) * 30, 7, 16, hash(k * 3) - 0.5, 0, TAU); c.fill(); } });
    return (fgCache[name] = sprites);
  }

  // =====================================================================
  //  GAME STATE
  // =====================================================================
  let state = 'title';
  let game = null;
  const run = { notes: 0, notesTotal: 0, pages: 0, deaths: 0 };

  function makeGame(li) {
    const def = LEVELS[li];
    const L = parseLevel(def);
    const g = { li, L, p: newPlayer(L), theme: THEMES[def.theme], themeName: def.theme, t: 0, cam: { x: 0, y: 0 }, deaths: 0, particles: [], weather: [], respawn: 0,
      checkpoint: { x: L.start.x, y: L.start.y }, notes: 0, pages: 0, anim: 0, winT: 0, shake: 0, chunks: new Map(), iris: 0, squash: { x: 1, y: 1 }, hair: 0, flash: 0 };
    g.cam.x = Math.max(0, g.p.x - W / 3);
    g.props = [];
    for (let tx = 4; tx < L.w - 4; tx++) {
      if (hash(tx * 3.71 + li) > 0.93) {
        for (let ty = 1; ty < L.h; ty++) if (SOLID(L.tiles[ty][tx]) && L.tiles[ty - 1][tx] === 0) { g.props.push({ x: tx * T + 16, y: ty * T, kind: hash(tx * 1.3) }); break; }
      }
    }
    paintLayers(def.theme); fgSprites(def.theme);
    return g;
  }

  function startLevel(li) {
    game = makeGame(li);
    state = 'play';
    showScreen(null);
  }

  function killPlayer(kind) {
    const g = game; if (!g || (g.p.dead && g.respawn > 0)) return;
    g.p.dead = true; g.respawn = 1.0; g.deaths++; g.shake = 0.3;
    if (kind === 'splash') { SFX.splash(); for (let i = 0; i < 26; i++) g.particles.push({ x: g.p.x + 10, y: g.p.y + 20, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 420, life: 0.9, kind: 'drop', r: 2 + Math.random() * 3 }); }
    else { SFX.dead(); for (let i = 0; i < 28; i++) g.particles.push({ x: g.p.x + 10, y: g.p.y + 14, vx: (Math.random() - 0.5) * 380, vy: -Math.random() * 400, life: 0.9, kind: 'ink', r: 3 + Math.random() * 5 }); }
  }

  function update(dt) {
    const g = game; if (!g) return;
    g.t += dt;
    updateWorld(g.L, g.t, dt);
    noteTimer -= dt; if (noteTimer <= 0) noteIdx = 0;
    g.iris = Math.min(1, g.iris + dt * 1.4);
    updateWeather(g, dt);
    const p = g.p;
    if (g.winT > 0) {
      g.winT += dt;
      if (g.winT > 2.0) finishLevel();
      updateParticles(g, dt);
      return;
    }
    if (p.dead) {
      g.respawn -= dt;
      if (g.respawn <= 0) { const np = newPlayer(g.L); np.x = g.checkpoint.x; np.y = g.checkpoint.y; g.p = np; burst(g, np.x + 10, np.y + 14, 14, 'sparkle'); }
      updateParticles(g, dt);
      return;
    }
    const inp = readInput();
    const vyBefore = p.vy;
    const ev = stepPlayer(g.L, p, inp, dt);
    for (const e of ev) {
      if (e === 'jump') { SFX.jump(); g.squash = { x: 0.78, y: 1.25 }; burst(g, p.x + 10, p.y + p.h, 5, 'dust'); }
      if (e === 'spring') { SFX.spring(); g.squash = { x: 0.7, y: 1.35 }; burst(g, p.x + 10, p.y + p.h, 10, 'sparkle'); }
      if (e === 'land') { const k = clamp01(vyBefore / 900); g.squash = { x: 1 + 0.35 * k, y: 1 - 0.3 * k }; burst(g, p.x + 10, p.y + p.h, 3 + k * 6 | 0, 'dust'); }
      if (e === 'crumble') SFX.crumble();
      if (e === 'dead' || e === 'splash') { p.dead = false; killPlayer(e); return; }
    }
    g.squash.x = lerp(g.squash.x, 1, Math.min(1, dt * 12)); g.squash.y = lerp(g.squash.y, 1, Math.min(1, dt * 12));
    g.hair = lerp(g.hair, clamp01(Math.abs(p.vx) / 250) + (p.ground ? 0 : -p.vy / 900), Math.min(1, dt * 8));
    if (Math.abs(p.vx) > 10 && p.ground) g.anim += dt * Math.abs(p.vx) / 18; else if (p.ground) g.anim = 0;
    if (p.ground && p.ice && Math.abs(p.vx) > 120 && Math.random() < dt * 30) g.particles.push({ x: p.x + 10, y: p.y + p.h, vx: -p.vx * 0.2, vy: -40, life: 0.4, kind: 'sparkle', r: 1.5 });
    if (p.floating && Math.random() < dt * 20) g.particles.push({ x: p.x + Math.random() * 20, y: p.y + p.h, vx: 0, vy: 40, life: 0.6, kind: 'petal', r: 2, seed: Math.random() * 10 });

    const pb = { x: p.x, y: p.y, w: p.w, h: p.h };
    for (const n of g.L.notes) if (!n.got && overlap(pb, { x: n.x - 11, y: n.y - 11, w: 22, h: 22 })) { n.got = true; g.notes++; SFX.note(); burst(g, n.x, n.y, 7, 'sparkle'); g.particles.push({ x: n.x, y: n.y, vx: 0, vy: -60, life: 0.7, kind: 'ghostnote' }); }
    for (const n of g.L.pages) if (!n.got && overlap(pb, { x: n.x - 13, y: n.y - 13, w: 26, h: 26 })) { n.got = true; g.pages++; SFX.page(); burst(g, n.x, n.y, 20, 'petal'); g.banner = { text: `Torn page ${g.pages} of 3`, t: 2.2 }; g.flash = 0.5; }
    for (const l of g.L.lamps) if (!l.lit && Math.abs(p.x + 10 - l.x) < 20 && p.y + p.h > l.y - 80) { l.lit = true; g.checkpoint = { x: l.x - 10, y: l.y - p.h }; SFX.lamp(); burst(g, l.x, l.y - 68, 14, 'sparkle'); }

    for (const e of g.L.enemies) {
      if (!e.alive) { e.poof -= dt; continue; }
      if (Math.abs(e.x - p.x) > W * 1.2) continue;
      e.vy = (e.vy || 0) + 2100 * dt;
      e.x += e.vx * dt;
      const ahead = e.vx > 0 ? e.x + e.w : e.x;
      const tx = Math.floor(ahead / T), tyMid = Math.floor((e.y + e.h / 2) / T), tyBelow = Math.floor((e.y + e.h + 2) / T);
      const wall = SOLID(tileAt(g.L, tx, tyMid)) || tileAt(g.L, tx, tyMid) === 3;
      const floor = tileAt(g.L, tx, tyBelow);
      if (wall || !(SOLID(floor) || floor === 2)) { e.vx = -e.vx; e.x += e.vx * dt * 2; }
      e.y += e.vy * dt;
      const by = Math.floor((e.y + e.h) / T), bx = Math.floor((e.x + e.w / 2) / T);
      const bt = tileAt(g.L, bx, by);
      if (SOLID(bt) || bt === 2) { e.y = by * T - e.h; e.vy = 0; }
      if (e.y > g.L.h * T + 100) e.alive = false;
      if (overlap(pb, e)) {
        if (p.vy > 60 && p.y + p.h - e.y < 18) {
          e.alive = false; e.poof = 1; p.vy = -540; p.jumping = true; SFX.stomp(); g.squash = { x: 0.8, y: 1.2 };
          burst(g, e.x + 12, e.y + 12, 8, 'butterfly');
        } else { killPlayer(); return; }
      }
    }
    for (const s of g.L.springs) s.squash = Math.max(0, s.squash - dt * 4);

    if (g.L.exit && overlap(pb, g.L.exit)) { g.winT = 0.001; SFX.win(); burst(g, g.L.exit.x + 24, g.L.exit.y + 20, 36, 'petal'); g.flash = 0.6; }

    if (g.banner) { g.banner.t -= dt; if (g.banner.t <= 0) g.banner = null; }
    if (g.flash) g.flash = Math.max(0, g.flash - dt);
    updateParticles(g, dt);

    const look = p.face * 80 + p.vx * 0.25;
    const tx = Math.max(0, Math.min(g.L.w * T - W, p.x + p.w / 2 - W / 2 + look));
    g.cam.x += (tx - g.cam.x) * Math.min(1, dt * 4);
    g.shake = Math.max(0, g.shake - dt);
  }

  function updateWeather(g, dt) {
    const w = g.theme.weather, ws = g.weather;
    const spawn = (rate, f) => { let n = rate * dt; while (n > 0) { if (Math.random() < n) ws.push(f()); n -= 1; } };
    if (w === 'petals') spawn(5, () => ({ x: Math.random() * (W + 300), y: -10, vx: -40 - Math.random() * 30, vy: 30 + Math.random() * 30, r: Math.random() * 6, z: 0.5 + Math.random(), life: 22, kind: 'petal' }));
    if (w === 'leaves') spawn(6, () => ({ x: Math.random() * (W + 300), y: -10, vx: -30 - Math.random() * 40, vy: 40 + Math.random() * 30, r: Math.random() * 6, z: 0.5 + Math.random(), life: 22, kind: 'leaf' }));
    if (w === 'snow') spawn(60, () => ({ x: Math.random() * (W + 200), y: -10, vx: -20 - Math.random() * 20, vy: 40 + Math.random() * 50, r: Math.random() * 6, z: 0.3 + Math.random() * 1.2, life: 20, kind: 'snow' }));
    if (w === 'pollen' || w === 'motes') spawn(5, () => ({ x: Math.random() * W, y: H * Math.random(), vx: (Math.random() - 0.5) * 10, vy: -5 - Math.random() * 10, r: Math.random() * 6, z: 0.6 + Math.random(), life: 8, kind: 'mote' }));
    if (w === 'confetti') spawn(4, () => ({ x: Math.random() * (W + 200), y: -10, vx: -20, vy: 50 + Math.random() * 40, r: Math.random() * 6, z: 0.7 + Math.random() * 0.6, life: 14, kind: 'confetti' }));
    for (const q of ws) { q.x += (q.vx + Math.sin(g.t * 1.7 + q.r) * 20) * dt * q.z; q.y += q.vy * dt * q.z; q.life -= dt; }
    g.weather = ws.filter(q => q.life > 0 && q.y < H + 20 && q.x > -40);
  }

  function burst(g, x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = kind === 'dust' ? 30 + Math.random() * 60 : 40 + Math.random() * 160;
      g.particles.push({ x, y, vx: Math.cos(a) * s, vy: kind === 'dust' ? -Math.random() * 40 : Math.sin(a) * s - (kind === 'butterfly' ? 80 : 40), life: kind === 'butterfly' ? 2.4 : kind === 'dust' ? 0.45 : 0.9, kind, r: 2 + Math.random() * 3, seed: Math.random() * 10 });
    }
  }
  function updateParticles(g, dt) {
    for (const q of g.particles) {
      q.life -= dt;
      if (q.kind === 'butterfly') { q.vx += Math.sin(g.t * 8 + q.seed) * 200 * dt; q.vy -= 60 * dt; q.vx *= 0.98; q.vy *= 0.98; }
      else if (q.kind === 'petal') { q.vy += 120 * dt; q.vx *= 0.97; }
      else if (q.kind === 'ink' || q.kind === 'drop') { q.vy += 900 * dt; }
      else if (q.kind === 'dust') { q.vx *= 0.9; q.vy *= 0.9; q.r += dt * 6; }
      else if (q.kind === 'ghostnote') { q.vy *= 0.97; }
      else { q.vy += 200 * dt; q.vx *= 0.95; }
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    g.particles = g.particles.filter(q => q.life > 0);
  }

  // cached sprites: radial glows (per colour) and note glyphs (per colour), so the per-frame cost is drawImage only
  const glowCache = {}, noteCache = {};
  function glowSprite(col) {
    if (glowCache[col]) return glowCache[col];
    const [c, x] = makeCanvas(128, 128);
    const rg = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, rgba(col, 1)); rg.addColorStop(0.35, rgba(col, 0.55)); rg.addColorStop(1, rgba(col, 0));
    x.fillStyle = rg; x.fillRect(0, 0, 128, 128);
    return (glowCache[col] = c);
  }
  function noteSprite(ch, col) {
    const k = ch + col;
    if (noteCache[k]) return noteCache[k];
    const [c, x] = makeCanvas(36, 36, DPR);
    x.font = 'bold 22px "Playfair Display", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillText(ch, 19.5, 20);
    x.fillStyle = col; x.fillText(ch, 18, 18);
    if (document.fonts && document.fonts.status !== 'loaded') return c; // don't cache a fallback-font glyph
    return (noteCache[k] = c);
  }
  if (document.fonts) document.fonts.ready.then(() => { for (const k in noteCache) delete noteCache[k]; });

  // =====================================================================
  //  DRAW
  // =====================================================================
  const [lightCv, lctx] = makeCanvas(W / 2, H / 2);
  let frameNo = 0;
  let coverGame = null;

  function draw() {
    frameNo++;
    const g = game;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (!g) { drawCover(); return; }
    const th = g.theme;
    const sx = g.shake > 0 ? (Math.random() - 0.5) * 9 * g.shake / 0.3 : 0, sy = g.shake > 0 ? (Math.random() - 0.5) * 7 * g.shake / 0.3 : 0;
    drawSky(g, th);
    drawLayers(g);
    if (th.rays) drawRays(g);
    ctx.save();
    ctx.translate(-Math.round(g.cam.x * DPR) / DPR + sx, sy);
    drawWater(g, true);
    drawProps(g);
    drawTerrain(g);
    drawUpdrafts(g);
    drawEntities(g, th);
    if (!g.p.dead) { drawShadow(g); drawPlayer(g.p, g); }
    drawWater(g, false);
    drawParticles(g, th);
    ctx.restore();
    drawWeather(g, th);
    drawLighting(g, th);
    drawForeground(g, th);
    drawPost(th, g);
    drawHUD(g);
    drawIris(g);
  }

  function drawCover() {
    const t = performance.now() / 1000;
    if (!coverGame) coverGame = makeGame(0);
    const g = coverGame, th = g.theme;
    g.t = t; g.cam.x = (t * 40) % (g.L.w * T - W);
    drawSky(g, th); drawLayers(g); drawRays(g);
    ctx.save(); ctx.translate(-g.cam.x, 0); drawTerrain(g); ctx.restore();
    updateWeather(g, 1 / 60); drawWeather(g, th);
    drawPost(th, null);
  }

  function drawSky(g, th) {
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.55, th.sky[1]); gr.addColorStop(1, th.sky[2]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    const t = g.t, cx = g.cam.x, name = g.themeName;
    if ((!th.day || name === 'sea') && name !== 'clock') {
      ctx.fillStyle = '#fff8e6';
      for (let i = 0; i < 120; i++) {
        const x = ((hash(i) * 2400 - cx * 0.02) % W + W) % W, y = hash(i + 50) * (name === 'sea' ? 140 : 330);
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.4 + hash(i + 3)) + i));
        ctx.globalAlpha = tw * (name === 'sea' ? 0.5 : 1);
        const s = hash(i + 9) > 0.9 ? 2.5 : 1.5; ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
    }
    const pos = { spring: [760, 110, 50], autumn: [700, 170, 64], garden: [760, 90, 44], sea: [600, 330, 70], moon: [720, 120, 60], haunt: [240, 110, 46], snow: [780, 120, 40], carnival: [820, 330, 50], stage: [800, 90, 38] }[name];
    if (pos) {
      const [x0, y0, r] = pos, x = x0 - cx * 0.015;
      const glow = ctx.createRadialGradient(x, y0, r * 0.5, x, y0, r * 5);
      glow.addColorStop(0, rgba(th.sun, th.day ? 0.55 : 0.35)); glow.addColorStop(1, rgba(th.sun, 0));
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      if (name !== 'carnival') {
        ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(x, y0, r, 0, TAU); ctx.fill();
        if (name === 'moon' || name === 'haunt') { ctx.fillStyle = 'rgba(160,150,120,0.25)'; [[-18, -12, 11], [14, 18, 8], [20, -16, 6], [-6, 22, 5]].forEach(([dx, dy, rr]) => { ctx.beginPath(); ctx.arc(x + dx * r / 60, y0 + dy * r / 60, rr * r / 60, 0, TAU); ctx.fill(); }); }
        if (name === 'stage') { ctx.fillStyle = th.sky[0]; ctx.beginPath(); ctx.arc(x + 14, y0 - 9, r * 0.9, 0, TAU); ctx.fill(); }
      }
    }
    if (th.day) {
      for (let i = 0; i < 9; i++) {
        const x = ((i * 280 - cx * 0.05 - t * 5) % 2520 + 2520) % 2520 - 260, y = 50 + hash(i) * 140, s = 0.7 + hash(i + 9) * 0.8;
        cloud(x, y, s, name === 'sea' ? '#ffc8a8' : name === 'autumn' ? '#ffe8c8' : '#fffaf2', name === 'sea' ? '#d88a8a' : name === 'snow' ? '#c8d4e4' : '#f0d8d0');
      }
    }
    if (name === 'clock') {
      gear(220 - cx * 0.05, 200, 160, 18, t * 0.12, '#3e2a1e'); gear(560 - cx * 0.05, 340, 110, 12, -t * 0.18, '#46301f');
      gear(880 - cx * 0.05, 150, 180, 20, t * 0.1, '#3e2a1e'); gear(1300 - cx * 0.05, 300, 130, 14, -t * 0.15, '#46301f');
      const px = 640 - cx * 0.1, a = Math.sin(t * 1.6) * 0.35;
      ctx.save(); ctx.translate(px, -10); ctx.rotate(a); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 300); ctx.stroke(); const pg = ctx.createRadialGradient(-8, 312, 4, 0, 320, 38); pg.addColorStop(0, '#f0d08a'); pg.addColorStop(1, '#8a6a3a'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 320, 36, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (name === 'carnival') {
      const fx = 780 - cx * 0.04, fy = 250, R = 150, a = t * 0.15;
      ctx.strokeStyle = '#3a2440'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(fx - 80, H); ctx.lineTo(fx, fy); ctx.lineTo(fx + 80, H); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx, fy, R, 0, TAU); ctx.stroke();
      for (let k = 0; k < 12; k++) {
        const b = a + k / 12 * TAU, ex = fx + Math.cos(b) * R, ey = fy + Math.sin(b) * R;
        ctx.strokeStyle = '#3a2440'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = ['#c84a5a', '#4a6ab0', '#d8a03a'][k % 3]; ctx.fillRect(ex - 9, ey, 18, 14);
        ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, TAU); ctx.fill();
      }
    }
    if (name === 'sea') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 18; k++) { const y = 352 + k * 10, w = 70 - k * 2.5 + Math.sin(t * 2 + k) * 10; ctx.fillStyle = `rgba(255,200,140,${0.22 - k * 0.01})`; ctx.fillRect(600 - cx * 0.015 - w / 2 + Math.sin(t + k) * 6, y, w, 3); }
      ctx.restore();
    }
  }

  function cloud(x, y, s, col, shade) {
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.ellipse(x + 40 * s, y + 18 * s, 62 * s, 14 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, TAU); ctx.arc(x + 26 * s, y - 14 * s, 30 * s, 0, TAU); ctx.arc(x + 60 * s, y - 4 * s, 26 * s, 0, TAU); ctx.arc(x + 84 * s, y + 6 * s, 18 * s, 0, TAU);
    ctx.fill();
  }

  function gear(x, y, r, teeth, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) { const rr = i % 2 ? r : r * 0.86, a0 = (i / (teeth * 2)) * TAU, a1 = ((i + 1) / (teeth * 2)) * TAU; ctx.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr); ctx.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) { const a2 = i / 5 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a2) * r * 0.55, Math.sin(a2) * r * 0.55, r * 0.15, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawLayers(g) {
    for (const l of paintLayers(g.themeName)) {
      const off = ((g.cam.x * l.f) % LW + LW) % LW;
      ctx.drawImage(l.cv, -off, 0, LW, H);
      if (LW - off < W) ctx.drawImage(l.cv, LW - off, 0, LW, H);
    }
  }

  function drawRays(g) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const t = g.t, ox = -g.cam.x * 0.08;
    const col = g.themeName === 'haunt' ? '170,230,210' : g.themeName === 'clock' ? '255,210,140' : g.themeName === 'sea' ? '255,190,140' : '255,240,210';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 260 + ox) % 1560 + 1560) % 1560 - 300, w = 60 + hash(i) * 80, a = (0.07 + 0.05 * Math.sin(t * 0.4 + i * 1.7)) * (g.themeName === 'haunt' ? 0.8 : 1);
      const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + w, -10); ctx.lineTo(x + w + 260, H); ctx.lineTo(x + 180, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawTerrain(g) {
    const c0 = Math.max(0, Math.floor(g.cam.x / CHUNK)), c1 = Math.floor((g.cam.x + W) / CHUNK);
    for (let ci = c0; ci <= c1; ci++) {
      let cv2 = g.chunks.get(ci);
      if (!cv2) { cv2 = buildChunk(g, ci); g.chunks.set(ci, cv2); }
      ctx.drawImage(cv2, ci * CHUNK, 0, CHUNK, H);
    }
    for (const k of g.chunks.keys()) if (k < c0 - 1 || k > c1 + 1) g.chunks.delete(k);
    if (!g.chunks.has(c1 + 1) && (c1 + 1) * CHUNK < g.L.w * T) g.chunks.set(c1 + 1, buildChunk(g, c1 + 1));
  }

  function drawProps(g) {
    const name = g.themeName;
    for (const pr of g.props) {
      if (pr.x < g.cam.x - 80 || pr.x > g.cam.x + W + 80) continue;
      const x = pr.x, y = pr.y, k = pr.kind;
      ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      if (name === 'snow') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - 11, 11, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y - 28, 8, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8803a'; ctx.beginPath(); ctx.moveTo(x + 2, y - 28); ctx.lineTo(x + 10, y - 27); ctx.lineTo(x + 2, y - 26); ctx.fill(); ctx.fillStyle = '#c94a5a'; ctx.fillRect(x - 8, y - 22, 16, 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x - 3, y - 30, 1, 0, TAU); ctx.arc(x + 3, y - 30, 1, 0, TAU); ctx.fill(); }
      else if (name === 'spring' || name === 'stage') { ctx.fillStyle = name === 'stage' ? '#5a3a4a' : '#8a6a4a'; ctx.fillRect(x - 18, y - 14, 36, 4); ctx.strokeRect(x - 18, y - 14, 36, 4); ctx.fillRect(x - 18, y - 24, 36, 4); ctx.strokeRect(x - 18, y - 24, 36, 4); ctx.fillStyle = INK; ctx.fillRect(x - 15, y - 14, 2, 14); ctx.fillRect(x + 13, y - 14, 2, 14); }
      else if (name === 'autumn') { ctx.fillStyle = '#e07a2a'; ctx.beginPath(); ctx.ellipse(x, y - 8, 12, 8, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = '#5a7a3a'; ctx.fillRect(x - 1.5, y - 20, 3, 5); }
      else if (name === 'garden') { ctx.fillStyle = '#c4704a'; ctx.beginPath(); ctx.moveTo(x - 10, y - 16); ctx.lineTo(x + 10, y - 16); ctx.lineTo(x + 7, y); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill(); ctx.stroke(); flower(ctx, x - 4, y - 16, '#f0a8c0'); flower(ctx, x + 4, y - 16, '#f6d06a'); }
      else if (name === 'sea') { ctx.fillStyle = '#7a5a40'; ctx.fillRect(x - 10, y - 16, 20, 16); ctx.strokeRect(x - 10, y - 16, 20, 16); ctx.beginPath(); ctx.moveTo(x - 10, y - 8); ctx.lineTo(x + 10, y - 8); ctx.stroke(); }
      else if (name === 'haunt') { candle(ctx, x - 6, y, g.t); candle(ctx, x + 5, y, g.t + 1); }
      else if (name === 'carnival') { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y - 40); ctx.stroke(); ctx.fillStyle = ['#ff6a8a', '#6ac8ff', '#ffd36a'][(k * 3) | 0]; ctx.beginPath(); ctx.ellipse(x + 4 + Math.sin(g.t + x) * 2, y - 50, 9, 11, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
      else if (name === 'moon') mushroom(ctx, x, y, '#a86ab8');
      ctx.restore();
    }
  }

  function drawWater(g, back) {
    const L = g.L, t = g.t;
    const x0 = Math.max(0, Math.floor(g.cam.x / T) - 1), x1 = Math.min(L.w - 1, Math.ceil((g.cam.x + W) / T) + 1);
    for (let tx = x0; tx <= x1; tx++) {
      let ty = -1; for (let y = 0; y < L.h; y++) if (L.tiles[y][tx] === 5) { ty = y; break; }
      if (ty < 0) continue;
      const px = tx * T, top = ty * T + 8;
      if (back) {
        const gr = ctx.createLinearGradient(0, top, 0, H); gr.addColorStop(0, '#4a6aa0'); gr.addColorStop(1, '#22284a');
        ctx.fillStyle = gr; ctx.fillRect(px, top, T + 0.5, H - top);
      } else {
        ctx.fillStyle = 'rgba(120,170,220,0.35)';
        ctx.beginPath(); ctx.moveTo(px, H);
        for (let k = 0; k <= 4; k++) { const x = px + k * 8; ctx.lineTo(x, top + Math.sin(t * 2.4 + x * 0.06) * 3); }
        ctx.lineTo(px + T, H); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,230,200,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let k = 0; k <= 4; k++) { const x = px + k * 8, y = top + Math.sin(t * 2.4 + x * 0.06) * 3; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
        if (hash(tx + Math.floor(t * 2)) > 0.7) { ctx.fillStyle = 'rgba(255,240,220,0.7)'; ctx.fillRect(px + hash(tx * 3 + Math.floor(t * 2)) * 24, top + 8 + hash(tx) * 20, 6, 1.5); }
      }
    }
  }

  function drawUpdrafts(g) {
    const L = g.L, t = g.t;
    const x0 = Math.max(0, Math.floor(g.cam.x / T) - 1), x1 = Math.min(L.w - 1, Math.ceil((g.cam.x + W) / T) + 1);
    for (let tx = x0; tx <= x1; tx++) {
      let top = -1; for (let y = 0; y < L.h; y++) if (L.tiles[y][tx] === 6) { top = y; break; }
      if (top < 0) continue;
      const px = tx * T, py = top * T;
      const gr = ctx.createLinearGradient(0, py, 0, H); gr.addColorStop(0, 'rgba(255,220,235,0)'); gr.addColorStop(1, 'rgba(255,220,235,0.4)');
      ctx.fillStyle = gr; ctx.fillRect(px, py, T, H - py);
      for (let k = 0; k < 6; k++) {
        const ph = (t * 0.6 + hash(tx * 5 + k)) % 1, y = H - ph * (H - py), x = px + 6 + hash(tx + k * 7) * 20 + Math.sin(t * 3 + k) * 4;
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.fillStyle = k % 2 ? '#fbe6ee' : '#f2b8c8'; ctx.beginPath(); ctx.ellipse(x, y, 4, 2.5, t * 2 + k, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawEntities(g, th) {
    const L = g.L, t = g.t, name = g.themeName;
    const vis = (x, m = 100) => x > g.cam.x - m && x < g.cam.x + W + m;
    for (const l of L.lamps) {
      if (!vis(l.x)) continue;
      ctx.strokeStyle = '#241a17'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y - 60); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l.x, l.y - 50); ctx.quadraticCurveTo(l.x + 8, l.y - 54, l.x + 2, l.y - 60); ctx.stroke();
      ctx.fillStyle = '#241a17'; ctx.fillRect(l.x - 8, l.y - 5, 16, 5);
      const lg = ctx.createLinearGradient(0, l.y - 78, 0, l.y - 60);
      lg.addColorStop(0, l.lit ? '#fff4c0' : '#7a6e64'); lg.addColorStop(1, l.lit ? '#ffc860' : '#5a5048');
      ctx.fillStyle = lg; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(l.x - 10, l.y - 60); ctx.lineTo(l.x + 10, l.y - 60); ctx.lineTo(l.x + 7, l.y - 78); ctx.lineTo(l.x - 7, l.y - 78); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(l.x - 9, l.y - 78); ctx.lineTo(l.x, l.y - 86); ctx.lineTo(l.x + 9, l.y - 78); ctx.fill();
      if (l.lit) { ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.ellipse(l.x, l.y - 68, 2.5, 4, 0, 0, TAU); ctx.fill(); }
    }
    for (const s of L.springs) {
      if (!vis(s.x)) continue;
      const sq = s.squash * 6;
      ctx.fillStyle = '#3a2620'; ctx.fillRect(s.x - 3, s.y + 8, s.w + 6, 7);
      ctx.fillStyle = '#c9a050'; ctx.fillRect(s.x - 3, s.y + 8, s.w + 6, 2);
      for (let k = 0; k < 3; k++) {
        const kg = ctx.createLinearGradient(0, s.y + sq, 0, s.y + 14); kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, '#e6dcc8');
        ctx.fillStyle = kg; ctx.fillRect(s.x + k * 9.5, s.y + sq, 9, 14 - sq);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(s.x + k * 9.5, s.y + sq, 9, 14 - sq);
      }
      ctx.fillStyle = '#1e1614'; ctx.fillRect(s.x + 7, s.y + sq, 5, 8 - sq * 0.5); ctx.fillRect(s.x + 16.5, s.y + sq, 5, 8 - sq * 0.5);
      if (s.squash > 0.2) { ctx.globalAlpha = s.squash; ctx.fillStyle = th.note || INK; ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText('♪', s.x + 20 + (1 - s.squash) * 10, s.y - 8 - (1 - s.squash) * 26); ctx.fillText('♫', s.x + 4 - (1 - s.squash) * 8, s.y - 14 - (1 - s.squash) * 20); ctx.globalAlpha = 1; }
    }
    for (const c of L.crumbles) {
      if (c.state === 'gone' || !vis(c.x)) continue;
      const jx = c.state === 'shaking' ? (Math.random() - 0.5) * 3 : 0;
      leafPlatform(c.x + jx, c.y, c.w, name, c.state === 'falling' ? 0.6 : 1, c.x0, c.state === 'falling' ? (c.y - c.y0) * 0.01 : 0);
    }
    for (const b of L.blinks) {
      if (!vis(b.x)) continue;
      ctx.save(); ctx.globalAlpha = b.a;
      ctx.fillStyle = 'rgba(190,255,230,0.25)'; ctx.fillRect(b.x - 2, b.y - 4, b.w + 4, b.h + 8);
      const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); bg.addColorStop(0, '#e8fff4'); bg.addColorStop(1, '#8fd8c0');
      ctx.fillStyle = bg; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(40,90,80,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 2);
      ctx.restore();
    }
    for (const m of L.movers) {
      if (!vis(m.x)) continue;
      if (m.kind === 'boat') { boat(m, t); continue; }
      if (name === 'carnival' || name === 'stage') {
        ctx.strokeStyle = '#d8b060'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(m.x + m.w / 2, m.y + m.h); ctx.lineTo(m.x + m.w / 2, m.y + m.h + 40); ctx.stroke();
        const mg = ctx.createLinearGradient(0, m.y, 0, m.y + m.h); mg.addColorStop(0, '#f6e0b0'); mg.addColorStop(1, '#c89850');
        ctx.fillStyle = mg; ctx.fillRect(m.x, m.y, m.w, m.h); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(m.x + 1, m.y + 1, m.w - 2, m.h - 2);
        for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#c84a5a' : '#f2e0c8'; ctx.fillRect(m.x + 2 + k * 15, m.y + m.h - 6, 15, 4); }
        for (let k = 0; k < 5; k++) { ctx.fillStyle = (Math.floor(t * 4) + k) % 2 ? '#fff4b0' : '#c89850'; ctx.beginPath(); ctx.arc(m.x + 6 + k * 13, m.y + 5, 2, 0, TAU); ctx.fill(); }
        continue;
      }
      const mg = ctx.createLinearGradient(0, m.y, 0, m.y + m.h); mg.addColorStop(0, '#f4e2bc'); mg.addColorStop(1, '#c8a870');
      ctx.fillStyle = mg; ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(m.x + 1, m.y + 1, m.w - 2, m.h - 2);
      ctx.lineWidth = 1; for (let k = 1; k < 8; k++) { ctx.beginPath(); ctx.moveTo(m.x + k * 8, m.y + 2); ctx.lineTo(m.x + k * 8, m.y + (k % 2 ? 6 : 9)); ctx.stroke(); }
      gearSmall(m.x + 12, m.y + m.h + 3, 8, t * 3 * (m.axis === 'x' ? 1 : -1));
      gearSmall(m.x + m.w - 12, m.y + m.h + 3, 8, -t * 3);
    }
    const ncol = th.note || '#5a3a20', nA = noteSprite('♪', ncol), nB = noteSprite('♫', ncol);
    for (const n of L.notes) {
      if (n.got || !vis(n.x, 40)) continue;
      const bob = Math.sin(t * 3 + n.x * 0.05) * 3, sc = 1 + Math.sin(t * 5 + n.x) * 0.06;
      ctx.save(); ctx.translate(n.x, n.y + bob); ctx.scale(sc, sc); ctx.rotate(Math.sin(t * 2 + n.x) * 0.12);
      ctx.drawImage((n.x / T | 0) % 3 ? nA : nB, -18, -18, 36, 36);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
    for (const n of L.pages) {
      if (n.got || !vis(n.x)) continue;
      const bob = Math.sin(t * 2 + n.x) * 4, rot = Math.sin(t * 1.5 + n.x) * 0.15;
      ctx.save(); ctx.translate(n.x, n.y + bob);
      for (let k = 0; k < 3; k++) { const a = t * 2 + k * TAU / 3; ctx.fillStyle = '#fff6c8'; star(Math.cos(a) * 20, Math.sin(a) * 9, 2); }
      ctx.rotate(rot);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; pagePath(2, 3); ctx.fill();
      const pg = ctx.createLinearGradient(-10, -13, 10, 13); pg.addColorStop(0, '#fffaf0'); pg.addColorStop(1, '#ead8b4');
      ctx.fillStyle = pg; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; pagePath(0, 0); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(46,33,29,0.45)'; ctx.lineWidth = 1; for (let k = -8; k < 5; k += 4) { ctx.beginPath(); ctx.moveTo(-7, k); ctx.lineTo(7, k); ctx.stroke(); }
      ctx.restore();
    }
    for (const e of L.enemies) {
      if (!e.alive || !vis(e.x)) continue;
      const cx = e.x + 12, cy = e.y + 14, look = Math.sign(e.vx) * 2.5;
      if (name === 'haunt') {
        const fl = Math.sin(t * 3 + e.x0) * 3;
        ctx.save(); ctx.translate(cx, cy + fl - 2);
        const gg = ctx.createLinearGradient(0, -14, 0, 14); gg.addColorStop(0, '#ffffff'); gg.addColorStop(1, '#bfe8dc');
        ctx.fillStyle = gg; ctx.strokeStyle = 'rgba(40,80,70,0.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, -3, 12, Math.PI, 0); ctx.lineTo(12, 12);
        for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(12 - k * 6 - 3, 16 + Math.sin(t * 8 + k) * 2, 12 - (k + 1) * 6, 12);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a2a28'; ctx.beginPath(); ctx.ellipse(-4 + look, -3, 2.2, 3.2, 0, 0, TAU); ctx.ellipse(4 + look, -3, 2.2, 3.2, 0, 0, TAU); ctx.fill();
        ctx.restore();
        continue;
      }
      const wob = Math.sin(t * 8 + e.x0) * 2;
      const ig = ctx.createRadialGradient(cx - 4, cy - 6, 2, cx, cy, 16); ig.addColorStop(0, '#5a4a6a'); ig.addColorStop(1, '#1a1220');
      ctx.fillStyle = ig;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) { const a = i / 14 * TAU, r = 12.5 + Math.sin(a * 3 + t * 6 + e.x0) * 2 + (Math.sin(a) > 0 ? 1 : 0); ctx.lineTo(cx + Math.cos(a) * (r + wob * 0.3), cy + Math.sin(a) * r * 0.92); }
      ctx.fill();
      if (th.note) { ctx.strokeStyle = rgba(th.note, 0.55); ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.fillStyle = '#1a1220'; ctx.beginPath(); ctx.arc(cx - 13, cy + 9, 3, 0, TAU); ctx.arc(cx + 14, cy + 8, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx - 5, cy - 8, 4, 2, -0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fbf3e0'; ctx.beginPath(); ctx.arc(cx - 4 + look, cy - 2, 3.6, 0, TAU); ctx.arc(cx + 4 + look, cy - 2, 3.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a1220'; ctx.beginPath(); ctx.arc(cx - 4 + look * 1.4, cy - 2, 1.7, 0, TAU); ctx.arc(cx + 4 + look * 1.4, cy - 2, 1.7, 0, TAU); ctx.fill();
      if (name === 'snow') { ctx.fillStyle = '#c94a5a'; ctx.beginPath(); ctx.arc(cx, cy - 9, 8, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy - 18, 3, 0, TAU); ctx.fill(); }
    }
    if (name === 'stage' && L.exit) stageSet(g);
    if (L.exit && vis(L.exit.x, 200)) {
      const x = L.exit.x, y = L.exit.y + 8, open = g.winT > 0 ? Math.min(1, g.winT * 1.5) : 0.25 + Math.sin(t * 2) * 0.05;
      ctx.fillStyle = '#5a3a2a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 14, y + 56); ctx.lineTo(x + 34, y + 56); ctx.lineTo(x + 30, y + 30); ctx.lineTo(x + 18, y + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(x + 24, y + 26); ctx.rotate(-0.12);
      ctx.fillStyle = '#7a2f3e'; ctx.fillRect(-30, -26, 60, 34); ctx.strokeRect(-30, -26, 60, 34);
      const lp = ctx.createLinearGradient(-28, 0, 0, 0); lp.addColorStop(0, '#fffaf0'); lp.addColorStop(1, '#e8d6b0');
      ctx.fillStyle = lp; ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(-14, -26 - open * 6, -27, -22); ctx.lineTo(-27, 4); ctx.quadraticCurveTo(-14, 0, 0, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      const rp = ctx.createLinearGradient(28, 0, 0, 0); rp.addColorStop(0, '#fffaf0'); rp.addColorStop(1, '#e8d6b0');
      ctx.fillStyle = rp; ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(14, -26 - open * 6, 27, -22); ctx.lineTo(27, 4); ctx.quadraticCurveTo(14, 0, 0, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (g.winT > 0) for (let k = 0; k < 3; k++) { const f = clamp01(g.winT * 1.5 - k * 0.3); ctx.save(); ctx.scale(Math.cos(f * Math.PI), 1); ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, -22, 26, 26); ctx.strokeRect(0, -22, 26, 26); ctx.restore(); }
      ctx.fillStyle = INK; ctx.font = 'italic 9px "IM Fell English", serif'; ctx.textAlign = 'center';
      ctx.fillText('the', -13, -12); ctx.fillText('end', 13, -12); ctx.font = '12px serif'; ctx.fillText('❦', -13, -2); ctx.fillText('❦', 13, -2);
      ctx.restore();
      ctx.fillStyle = th.note || INK; ctx.font = 'italic 14px "IM Fell English", serif'; ctx.textAlign = 'center'; ctx.fillText('turn the page', x + 24, y - 22 + Math.sin(t * 2) * 2);
    }
  }

  function pagePath(ox, oy) { ctx.beginPath(); ctx.moveTo(-10 + ox, -13 + oy); ctx.lineTo(10 + ox, -13 + oy); ctx.lineTo(10 + ox, 6 + oy); ctx.lineTo(6 + ox, 9 + oy); ctx.lineTo(3 + ox, 6 + oy); ctx.lineTo(0 + ox, 13 + oy); ctx.lineTo(-4 + ox, 8 + oy); ctx.lineTo(-10 + ox, 13 + oy); ctx.closePath(); }

  function boat(m, t) {
    const rot = Math.sin(t * m.speed + m.phase + 1) * 0.05;
    ctx.save(); ctx.translate(m.x + 32, m.y + 6); ctx.rotate(rot);
    const bg = ctx.createLinearGradient(0, -2, 0, 16); bg.addColorStop(0, '#d8664a'); bg.addColorStop(1, '#8a3a2a');
    ctx.fillStyle = bg; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-38, -4); ctx.lineTo(38, -4); ctx.quadraticCurveTo(30, 16, 0, 16); ctx.quadraticCurveTo(-30, 16, -38, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2e6d0'; ctx.fillRect(-34, 2, 68, 3);
    ctx.fillStyle = '#b07a50'; ctx.fillRect(-32, -6, 64, 4); ctx.strokeRect(-32, -6, 64, 4);
    ctx.restore();
  }

  function stageSet(g) {
    const L = g.L, t = g.t;
    const ex = L.exit.x + 24, gy = L.exit.y + 64, lx = ex - 240, rx = ex + 240;
    if (rx < g.cam.x - 200 || lx > g.cam.x + W + 200) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const [sx, a] of [[ex - 160, 0.12], [ex + 160, 0.12], [ex, 0.2]]) {
      const sg = ctx.createLinearGradient(0, 0, 0, gy); sg.addColorStop(0, `rgba(255,240,190,${a + Math.sin(t * 1.3 + sx) * 0.03})`); sg.addColorStop(1, 'rgba(255,240,190,0.02)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(sx - 20, 0); ctx.lineTo(sx + 20, 0); ctx.lineTo(ex + 110 + (sx - ex) * 0.2, gy); ctx.lineTo(ex - 110 + (sx - ex) * 0.2, gy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    const fl = ctx.createLinearGradient(0, gy - 12, 0, gy); fl.addColorStop(0, '#8a5a42'); fl.addColorStop(1, '#4a2e22');
    ctx.fillStyle = fl; ctx.fillRect(lx, gy - 12, rx - lx, 12); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(lx, gy - 12, rx - lx, 12);
    for (let x = lx + 20; x < rx; x += 40) { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x, gy - 5, 2.5, 0, TAU); ctx.fill(); }
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? lx - 10 : rx + 10;
      const cg = ctx.createLinearGradient(x0 - side * 100, 0, x0, 0); cg.addColorStop(0, '#5e1a28'); cg.addColorStop(0.5, '#a8344a'); cg.addColorStop(1, '#6a2030');
      ctx.fillStyle = cg; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 - side * 100, 0);
      ctx.quadraticCurveTo(x0 - side * 30, gy * 0.55, x0 - side * 76, gy - 12); ctx.lineTo(x0, gy - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,5,15,0.5)'; ctx.lineWidth = 2;
      for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x0 - side * k * 19, 0); ctx.quadraticCurveTo(x0 - side * (k * 9 + 8), gy * 0.55, x0 - side * k * 15, gy - 12); ctx.stroke(); }
      ctx.fillStyle = '#e3b85a'; ctx.beginPath(); ctx.arc(x0 - side * 50, gy * 0.55, 6, 0, TAU); ctx.fill();
    }
    const vg = ctx.createLinearGradient(0, 0, 0, 34); vg.addColorStop(0, '#6a1a28'); vg.addColorStop(1, '#a8344a');
    ctx.fillStyle = vg; ctx.fillRect(lx - 110, 0, rx - lx + 220, 30);
    ctx.fillStyle = '#e3b85a'; for (let x = lx - 110; x < rx + 110; x += 16) { ctx.beginPath(); ctx.arc(x + 8, 30, 5, 0, Math.PI); ctx.fill(); }
    ctx.restore();
  }

  function gearSmall(x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#b08a52'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); for (let i = 0; i < 16; i++) { const rr = i % 2 ? r : r * 0.75, aa = i / 16 * TAU; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function leafPlatform(x, y, w, name, alpha, seed, rot) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x + w / 2, y + 6); ctx.rotate(rot);
    const pal = name === 'garden' ? ['#f2b8c8', '#fbe6ee'] : name === 'carnival' || name === 'stage' ? ['#d8a03a', '#f6d06a'] : [['#d9823f', '#f0a860'], ['#c4612f', '#e88a50'], ['#e3a14a', '#f6c870'], ['#b8743a', '#d89a58']][(seed / T | 0) % 4];
    const lg = ctx.createLinearGradient(0, -6, 0, 10); lg.addColorStop(0, pal[1]); lg.addColorStop(1, pal[0]);
    ctx.fillStyle = lg; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, -12, w / 2, 0); ctx.quadraticCurveTo(0, 10, -w / 2, 0); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-w / 2 + 3, 0); ctx.lineTo(w / 2 - 3, 0); ctx.stroke();
    for (let k = -1; k < 2; k++) { ctx.beginPath(); ctx.moveTo(k * 8, 0); ctx.lineTo(k * 8 + 4, -4); ctx.moveTo(k * 8, 0); ctx.lineTo(k * 8 + 4, 3); ctx.stroke(); }
    ctx.restore();
  }

  function drawParticles(g, th) {
    for (const q of g.particles) {
      const a = Math.max(0, Math.min(1, q.life / 0.4));
      ctx.globalAlpha = a;
      if (q.kind === 'ink') { ctx.fillStyle = '#1a1220'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); }
      else if (q.kind === 'drop') { ctx.fillStyle = '#bfe0ff'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); }
      else if (q.kind === 'dust') { ctx.globalAlpha = a * 0.5; ctx.fillStyle = th.day ? '#fff6e8' : '#c8c0d8'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); }
      else if (q.kind === 'petal') { ctx.fillStyle = ['#f1b8c0', '#fbe8b0', '#e98a96'][(q.seed * 3 | 0) % 3]; ctx.beginPath(); ctx.ellipse(q.x, q.y, 5, 3, q.seed + g.t * 3, 0, TAU); ctx.fill(); }
      else if (q.kind === 'ghostnote') { ctx.fillStyle = th.note || '#5a3a20'; ctx.font = 'bold 20px serif'; ctx.textAlign = 'center'; ctx.fillText('♪', q.x, q.y); }
      else if (q.kind === 'butterfly') {
        const f = Math.abs(Math.sin(g.t * 18 + q.seed)) * 5 + 1;
        ctx.fillStyle = ['#9ab4e0', '#e88a9a', '#f0e0a0'][(q.seed * 3 | 0) % 3];
        ctx.beginPath(); ctx.ellipse(q.x - f / 2, q.y, f / 1.5, 4, -0.4, 0, TAU); ctx.ellipse(q.x + f / 2, q.y, f / 1.5, 4, 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = INK; ctx.fillRect(q.x - 0.5, q.y - 3, 1, 6);
      } else { ctx.fillStyle = '#fff4b8'; star(q.x, q.y, q.r + 1); }
    }
    ctx.globalAlpha = 1;
  }
  function star(x, y, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.4 : r * 1.4, a = i / 8 * TAU; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }

  function fireflyPos(g, i) {
    return [((hash(i) * 1600 - g.cam.x * 0.6 + Math.sin(g.t * 0.7 + i) * 40) % W + W) % W, 180 + hash(i + 20) * 320 + Math.cos(g.t * 0.9 + i * 2) * 20];
  }
  function drawWeather(g, th) {
    for (const q of g.weather) {
      const x = q.x, y = q.y;
      if (q.kind === 'snow') { ctx.globalAlpha = 0.5 + q.z * 0.35; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, q.z * 2.2, 0, TAU); ctx.fill(); }
      else if (q.kind === 'petal') { ctx.globalAlpha = 0.85; ctx.fillStyle = '#f4bcc6'; ctx.beginPath(); ctx.ellipse(x, y, 4 * q.z, 2.4 * q.z, g.t * 2 + q.r, 0, TAU); ctx.fill(); }
      else if (q.kind === 'leaf') { ctx.globalAlpha = 0.9; ctx.fillStyle = ['#d9823f', '#c4612f', '#e3a14a'][(q.r | 0) % 3]; ctx.beginPath(); ctx.ellipse(x, y, 6 * q.z, 3 * q.z, g.t * 2 + q.r, 0, TAU); ctx.fill(); }
      else if (q.kind === 'mote') { ctx.globalAlpha = Math.sin(Math.min(1, q.life / 8) * Math.PI) * 0.7; ctx.fillStyle = g.themeName === 'haunt' ? '#c8ffe8' : '#fff4c8'; ctx.beginPath(); ctx.arc(x, y, 1.4 * q.z, 0, TAU); ctx.fill(); }
      else if (q.kind === 'confetti') { ctx.globalAlpha = 0.9; ctx.fillStyle = ['#ff6a8a', '#ffd36a', '#6ac8ff', '#9aff9a'][(q.r | 0) % 4]; ctx.save(); ctx.translate(x, y); ctx.rotate(g.t * 4 + q.r); ctx.fillRect(-3, -1.5, 6, 3); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
    if (th.weather === 'fireflies') {
      ctx.fillStyle = '#ffe9a0';
      for (let i = 0; i < 30; i++) { const [x, y] = fireflyPos(g, i); ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(g.t * 2 + i * 1.7)); ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }

  // ---- lighting: darkness with light holes (half-res, upscaled = soft), then additive bloom
  function collectLights(g) {
    const th = g.theme, L = g.L, t = g.t, out = [];
    const add = (x, y, r, col, a) => { const sx = x - g.cam.x; if (r > 0 && sx > -r && sx < W + r) out.push({ x: sx, y, r, col, a }); };
    for (const l of L.lamps) add(l.x, l.y - 68, l.lit ? 170 + Math.sin(t * 7 + l.x) * 4 : 60, l.lit ? '#ffcf70' : '#a08060', l.lit ? 0.5 : 0.15);
    for (const n of L.pages) if (!n.got) add(n.x, n.y, 90, '#fff2b0', 0.45);
    for (const n of L.notes) if (!n.got) add(n.x, n.y, 34, th.note || '#ffe0a0', 0.22);
    for (const b of L.blinks) if (b.on) add(b.x + 16, b.y + 6, 50, '#a8f0d0', 0.3 * b.a);
    if (L.exit) add(L.exit.x + 24, L.exit.y + 20, 150, '#fff0c0', 0.5);
    if (!g.p.dead && !th.day) add(g.p.x + 10, g.p.y + 10, 130, '#ffe8d0', 0.18);
    if (th.weather === 'fireflies') for (let i = 0; i < 30; i++) { const [x, y] = fireflyPos(g, i); out.push({ x, y, r: 26, col: '#ffe9a0', a: 0.3 * Math.max(0, Math.sin(t * 2 + i * 1.7)) }); }
    if (g.themeName === 'haunt') for (const pr of g.props) add(pr.x, pr.y - 15, 80, '#ffd36a', 0.35);
    if (g.themeName === 'carnival') for (const pr of g.props) add(pr.x, pr.y - 50, 50, '#ffb0c0', 0.2);
    if (g.themeName === 'stage' && L.exit) add(L.exit.x + 24, L.exit.y - 40, 300, '#fff0c0', 0.3);
    return out;
  }
  function drawLighting(g, th) {
    const lights = collectLights(g);
    if (th.ambient > 0) {
      lctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, W, H);
      lctx.fillStyle = rgba(th.amb, th.ambient); lctx.fillRect(0, 0, W, H);
      const vg = lctx.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, rgba(th.amb, 0.25)); vg.addColorStop(0.5, rgba(th.amb, 0)); lctx.fillStyle = vg; lctx.fillRect(0, 0, W, H);
      lctx.globalCompositeOperation = 'destination-out';
      const hole = glowSprite('#000000');
      for (const l of lights) { lctx.globalAlpha = Math.min(1, l.a * 2); lctx.drawImage(hole, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
      lctx.globalAlpha = 1;
      ctx.drawImage(lightCv, 0, 0, W, H);
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const k = th.day ? 0.3 : 0.5;
    for (const l of lights) {
      const r = l.r * 0.6;
      ctx.globalAlpha = Math.min(1, l.a * k); ctx.drawImage(glowSprite(l.col), l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  function drawForeground(g, th) {
    const sp = fgSprites(g.themeName), f = 1.35, span = 900;
    const base = g.cam.x * f;
    const k0 = Math.floor(base / span) - 1, k1 = Math.floor((base + W) / span) + 1;
    ctx.save(); ctx.globalAlpha = th.day ? 0.8 : 0.95;
    for (let k = k0; k <= k1; k++) {
      if (hash(k * 7.3 + g.li) < 0.35) continue;
      const s = sp[Math.floor(hash(k * 3.1 + g.li) * sp.length)], x = k * span + hash(k) * 400 - base;
      if (s.top) { ctx.globalAlpha = 0.55; ctx.drawImage(s.cv, x, -40, s.w * 1.3, s.h * 1.1); ctx.globalAlpha = th.day ? 0.8 : 0.95; }
      else ctx.drawImage(s.cv, x, H - s.h * 1.2 + 34, s.w * 1.4, s.h * 1.2);
    }
    ctx.restore();
  }

  function drawPost(th, g) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, rgba(th.grade[0], 0.55)); gr.addColorStop(1, rgba(th.grade[1], 0.45));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.16; ctx.fillStyle = paperPat; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.06; ctx.fillStyle = grains[frameNo % 3];
    ctx.translate((frameNo * 37) % 200 - 200, (frameNo * 53) % 200 - 200); ctx.fillRect(0, 0, W + 200, H + 200);
    ctx.restore();
    ctx.save();
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.0);
    v.addColorStop(0, 'rgba(20,10,10,0)'); v.addColorStop(1, 'rgba(20,10,10,0.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (g && g.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,200,${g.flash * 0.4})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  function drawIris(g) {
    const k = g.winT > 0 ? 1 - clamp01((g.winT - 0.9) / 1.0) : g.iris;
    if (k >= 1) return;
    const e = k * k * (3 - 2 * k);
    const cx = (g.winT > 0 && g.L.exit ? g.L.exit.x + 24 : g.p.x + 10) - g.cam.x, cy = g.winT > 0 && g.L.exit ? g.L.exit.y + 20 : g.p.y + 14;
    const r = e * Math.hypot(W, H);
    ctx.save(); ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(0.1, r), 0, TAU, true); ctx.fill('evenodd');
    ctx.restore();
  }

  function drawShadow(g) {
    const p = g.p, L = g.L;
    const cx = p.x + p.w / 2, tx = Math.floor(cx / T);
    let gy = null;
    for (let ty = Math.max(0, Math.floor((p.y + p.h) / T)); ty < L.h; ty++) { const t = tileAt(L, tx, ty); if (SOLID(t) || t === 2) { gy = ty * T; break; } }
    if (p.ground) gy = p.y + p.h;
    if (gy === null) return;
    const d = clamp01((gy - (p.y + p.h)) / 200);
    ctx.fillStyle = `rgba(20,10,10,${0.28 * (1 - d)})`; ctx.beginPath(); ctx.ellipse(cx, gy, 11 * (1 - d * 0.5), 3.2 * (1 - d * 0.5), 0, 0, TAU); ctx.fill();
  }

  // The heroine: dark bob with bangs, a bow, pale blue dress, cello on her back. Drawn at 1.3x with squash & stretch.
  function drawPlayer(p, g) {
    const x = p.x + p.w / 2, y = p.y + p.h;
    const f = p.face, run = p.ground && Math.abs(p.vx) > 10, ph = g.anim, air = !p.ground;
    const S = 1.3;
    ctx.save(); ctx.translate(x, y); ctx.scale(f * S * g.squash.x, S * g.squash.y);
    const bob = run ? Math.abs(Math.sin(ph)) * -1.8 : Math.sin(g.t * 2.2) * 0.4;
    const hairSw = -g.hair * 2.5;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.save(); ctx.translate(-7, -16 + bob); ctx.rotate(-0.22 + (run ? Math.sin(ph) * 0.04 : 0));
    const cg = ctx.createLinearGradient(-7, 0, 7, 0); cg.addColorStop(0, '#6a3418'); cg.addColorStop(0.45, '#c47a3e'); cg.addColorStop(1, '#7a3c1c');
    ctx.fillStyle = cg; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(0, 3, 6.5, 7.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -7, 5, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillRect(-4.2, -6, 8.4, 9);
    ctx.fillStyle = INK; ctx.fillRect(-0.8, -22, 1.6, 22); ctx.beginPath(); ctx.arc(0, -23.5, 2.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,10,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-2.6, -1); ctx.quadraticCurveTo(-3.6, 2, -2.4, 5); ctx.moveTo(2.6, -1); ctx.quadraticCurveTo(3.6, 2, 2.4, 5); ctx.stroke();
    ctx.restore();
    const l1 = run ? Math.sin(ph) * 4.5 : air ? 2.5 : 0, l2 = run ? -Math.sin(ph) * 4.5 : air ? -2 : 0;
    const lift1 = run ? Math.max(0, Math.cos(ph)) * 2 : air ? 2 : 0, lift2 = run ? Math.max(0, -Math.cos(ph)) * 2 : 0;
    ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(-2.5, -8 + bob); ctx.lineTo(-2.5 + l1, -1.5 - lift1); ctx.moveTo(2.5, -8 + bob); ctx.lineTo(2.5 + l2, -1.5 - lift2); ctx.stroke();
    ctx.fillStyle = '#5a2a2e'; ctx.beginPath(); ctx.ellipse(-2 + l1, -1.2 - lift1, 2.8, 1.6, 0, 0, TAU); ctx.ellipse(3 + l2, -1.2 - lift2, 2.8, 1.6, 0, 0, TAU); ctx.fill();
    const flare = (air ? 2.5 : run ? Math.abs(Math.sin(ph)) * 1.2 : 0) + g.hair * 0.8;
    const dg = ctx.createLinearGradient(-8, -22, 8, -6); dg.addColorStop(0, '#c8daf0'); dg.addColorStop(1, '#7f9cc4');
    ctx.fillStyle = dg; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-4, -21 + bob); ctx.lineTo(4, -21 + bob); ctx.lineTo(7.5 + flare * 0.4, -7 + bob);
    ctx.quadraticCurveTo(4, -5.5 + bob, 1, -7 + bob); ctx.quadraticCurveTo(-3, -5 + bob, -8 - flare, -7.5 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-6.5 - flare * 0.8, -8.2 + bob); ctx.quadraticCurveTo(0, -6.8 + bob, 6.6, -8 + bob); ctx.stroke();
    ctx.fillStyle = '#fbf6ea'; ctx.beginPath(); ctx.moveTo(-3.5, -21 + bob); ctx.lineTo(0, -17.5 + bob); ctx.lineTo(3.5, -21 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9727a'; ctx.beginPath(); ctx.arc(0, -18.6 + bob, 0.9, 0, TAU); ctx.fill();
    const arm = run ? Math.sin(ph + Math.PI) * 4 : air ? -7 : Math.sin(g.t * 2.2) * 0.5;
    ctx.strokeStyle = '#f0d0bc'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(1.5, -19 + bob); ctx.quadraticCurveTo(4 + arm * 0.3, -15 + bob, 4.5 + arm * 0.5, -11.5 + bob + (air ? -5 : 0)); ctx.stroke();
    const hy = -28.5 + bob;
    const sg = ctx.createRadialGradient(1.5, hy - 1, 1, 0, hy, 8.5); sg.addColorStop(0, '#fbe4d4'); sg.addColorStop(1, '#ecc4ac');
    ctx.fillStyle = sg; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(0, hy, 7.6, 0, TAU); ctx.fill(); ctx.stroke();
    const hg = ctx.createLinearGradient(0, hy - 10, 0, hy + 7); hg.addColorStop(0, '#4a2e26'); hg.addColorStop(1, '#24140f');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(-8.6 + hairSw * 0.3, hy + 6); ctx.quadraticCurveTo(-10.5, hy - 9, 0, hy - 9.8); ctx.quadraticCurveTo(10, hy - 9.5, 8.6, hy + 2.5);
    ctx.lineTo(6.2, hy + 3); ctx.lineTo(6.4, hy - 2.8); ctx.quadraticCurveTo(2, hy - 1.2, -1, hy - 3.6); ctx.quadraticCurveTo(-3.5, hy - 1.8, -5.2, hy - 3); ctx.lineTo(-5.6, hy + 6.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8.6, hy + 4); ctx.quadraticCurveTo(-10 + hairSw, hy + 7, -9.5 + hairSw, hy + 8.5); ctx.lineTo(-5.4, hy + 6.8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,200,0.35)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, hy - 2, 7.4, -2.6, -1.6); ctx.stroke();
    ctx.fillStyle = '#d97a86'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, hy - 9); ctx.lineTo(-10, hy - 13.5 + hairSw * 0.2); ctx.lineTo(-9.2, hy - 5.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, hy - 9); ctx.lineTo(1.2, hy - 14); ctx.lineTo(1, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b85a66'; ctx.beginPath(); ctx.arc(-4, hy - 9, 1.6, 0, TAU); ctx.fill();
    const blink = (g.t % 4) > 3.86;
    ctx.fillStyle = INK;
    if (blink) ctx.fillRect(2.4, hy + 0.6, 2.4, 0.9);
    else { ctx.beginPath(); ctx.ellipse(3.6, hy + 0.8, 1.05, 1.4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3.9, hy + 0.3, 0.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(232,140,140,0.55)'; ctx.beginPath(); ctx.ellipse(4.6, hy + 3.4, 1.9, 1.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(4.4, hy + 3.6, 1.3, 0.3, 2.0); ctx.stroke();
    ctx.restore();
  }

  function drawHUD(g) {
    const def = LEVELS[g.li];
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    const pg = ctx.createLinearGradient(0, 10, 0, 66); pg.addColorStop(0, '#fbf3e2'); pg.addColorStop(1, '#ecdcbc');
    ctx.fillStyle = pg; roundRect(14, 12, 330, 56, 10); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 1; roundRect(18, 16, 322, 48, 7); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '11px "IM Fell English", serif'; ctx.fillText(def.chapter.toUpperCase(), 28, 32);
    ctx.font = 'italic 19px "Playfair Display", serif'; ctx.fillText(def.title, 28, 55);
    ctx.textAlign = 'right'; ctx.font = '16px "IM Fell English", serif';
    ctx.fillText(`♪ ${g.notes}/${g.L.notes.length}`, 330, 33);
    for (let k = 0; k < 3; k++) {
      ctx.save(); ctx.translate(276 + k * 20, 50); ctx.scale(0.62, 0.62);
      ctx.globalAlpha = k < g.pages ? 1 : 0.3;
      ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = INK; ctx.lineWidth = 2; pagePath(0, 0); if (k < g.pages) ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    const span = g.L.w * T - 200;
    const prog = clamp01(g.p.x / span);
    const bx = 372, bw = W - 500, by = 32;
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = 'rgba(251,243,226,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
    ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
    for (const l of g.L.lamps) { const lx = bx + bw * clamp01(l.x / span); ctx.fillStyle = l.lit ? '#ffcf70' : '#fbf3e2'; ctx.beginPath(); ctx.arc(lx, by, 3, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
    for (const n of g.L.pages) if (!n.got) { const lx = bx + bw * clamp01(n.x / span); ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.fillRect(lx - 2.5, by - 10, 5, 6); ctx.strokeRect(lx - 2.5, by - 10, 5, 6); }
    ctx.fillStyle = '#d97a86'; ctx.beginPath(); ctx.arc(bx + bw * prog, by, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fbf3e2'; ctx.fillText('❦', bx + bw + 13, by + 4);
    ctx.globalAlpha = 1;
    const song = SONGS[g.li];
    ctx.textAlign = 'left'; ctx.font = 'italic 14px "IM Fell English", serif';
    const credit = `♫  ${song.title} — Laufey`;
    const w = ctx.measureText(credit).width + 26;
    ctx.fillStyle = 'rgba(251,243,226,0.85)'; roundRect(14, H - 40, w, 26, 13); ctx.fill();
    ctx.fillStyle = INK; ctx.fillText(credit, 27, H - 22);
    ctx.textAlign = 'center';
    if (g.banner) {
      ctx.globalAlpha = Math.min(1, g.banner.t * 2);
      ctx.font = 'italic 34px "Playfair Display", serif';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#fbf3e2'; ctx.fillText(g.banner.text, W / 2, 118);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }
    if (g.t < 6 && state === 'play') {
      ctx.globalAlpha = Math.min(1, 6 - g.t) * Math.min(1, g.t * 1.5);
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#fbf3e2'; ctx.font = '13px "IM Fell English", serif'; ctx.fillText(def.chapter.toUpperCase() + '  ·  ' + def.place.toUpperCase(), W / 2, 150);
      ctx.font = 'italic 46px "Playfair Display", serif'; ctx.fillText(def.title, W / 2, 198);
      if (g.li === 0) { ctx.font = 'italic 17px "IM Fell English", serif'; ctx.fillText('← → to walk  ·  space to jump  ·  find the three torn pages', W / 2, 232); }
    }
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------------- screens ----------------
  function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
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
    $('startBtn').textContent = save.unlocked > 1 ? `Continue — Chapter ${save.unlocked}` : 'Open the book';
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
    game = makeGame(i); game.iris = 1;
  }
  $('startBtn').onclick = () => { ensureAC(); run.notes = run.pages = run.deaths = 0; run.notesTotal = 0; showCard(Math.min(save.unlocked, NCH) - 1); };
  $('cardGo').onclick = () => { ensureAC(); startLevel(pendingLevel); fadeTo(0.7); tryPlay(); };

  const CLEAR_LINES = [
    'The streets remember her song now. Somewhere ahead, the leaves are turning.',
    'Golden hour faded into blue. Beyond the park, a glasshouse glowed.',
    'The petals set her down gently, right where the land met the sea.',
    'The tide went out, and the moon came up over a dark wood.',
    'The last of the ink became butterflies. A house on the hill had its candles lit.',
    'The ghosts waved goodbye. Outside, it had started to snow.',
    'Footprints in the snow led up to the old clocktower.',
    'Every gear agreed on the time at last. Below, the carnival lights were coming on.',
    'The carousel slowed. All that was left was the climb to the roof, and the stage.',
  ];
  function finishLevel() {
    const g = game; state = 'clear';
    run.notes += g.notes; run.notesTotal += g.L.notes.length; run.pages += g.pages; run.deaths += g.deaths;
    const prev = save.best[g.li];
    if (!prev || g.pages > prev.pages || (g.pages === prev.pages && g.notes > prev.notes)) save.best[g.li] = { pages: g.pages, notes: g.notes };
    save.unlocked = Math.max(save.unlocked, Math.min(NCH, g.li + 2));
    persist();
    if (g.li === NCH - 1) return showEnd();
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
    const total = NCH * 3;
    const totalPages = Object.values(save.best).reduce((s, b) => s + (b.pages || 0), 0);
    $('endNotes').textContent = `${run.notes}/${run.notesTotal || '—'}`;
    $('endPages').textContent = `${totalPages}/${total}`;
    $('endDeaths').textContent = run.deaths;
    $('endLetter').innerHTML = totalPages >= total
      ? `All ${total} pages, pressed back into the book. They were a letter, all along:<br><br>“To the girl who practised scales in an empty room: they will listen. Keep the cello. Keep the old songs. Someday the whole town will be humming them.”`
      : `You found ${totalPages} of the ${total} torn pages. The rest are still out there, up on the high ledges, past the thorns, at the top of the petals. Find them all to read what the book was hiding.`;
    const s = SONGS[SONGS.length - 1];
    $('endArt').src = s.art; $('endSong').textContent = s.title; $('endAlbum').textContent = `Laufey · ${s.album} (${s.year})`;
    showScreen('end');
    playSong(s, 0.7);
  }
  $('endTitle').onclick = toTitle;

  // ---------------- loop ----------------
  let last = performance.now(), acc = 0;
  const perf = [];
  const STEP = 1 / 120;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (state === 'play') { acc += dt; let n = 0; while (acc >= STEP && n++ < 12) { update(STEP); acc -= STEP; } }
    else if (game) { game.t += dt; updateWorld(game.L, game.t, dt); updateWeather(game, dt); }
    const d0 = performance.now(); draw(); perf.push(performance.now() - d0); if (perf.length > 120) perf.shift();
    requestAnimationFrame(frame);
  }
  buildChapterList();
  requestAnimationFrame(frame);

  window.__story = { get state() { return state; }, get game() { return game; }, startLevel, showCard, finishLevel, keys, music, perf, tick(sec) { for (let i = 0; i < sec * 120; i++) update(STEP); }, bench(n = 30) { const t0 = performance.now(); for (let i = 0; i < n; i++) { if (game) game.t += 1 / 60; draw(); } return (performance.now() - t0) / n; } };
})();
