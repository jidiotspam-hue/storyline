// Reachability check: BFS over grounded positions using the real player physics.
// Moving platforms are frozen at their spawn point and enemies are ignored, so this proves
// the static geometry is beatable and every page/note can be touched.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('../core.js');
const LEVELS = require('../levels.js');
const { T, parseLevel, newPlayer, stepPlayer, overlap } = globalThis.StoryCore;
const DT = 1 / 120;

let allOk = true;
LEVELS.forEach((def, li) => {
  const L = parseLevel(def);
  // stand-in for motion: static copies at both extremes and the middle
  L.movers = L.movers.flatMap(m => [-1, 0, 1].map(k => ({ ...m, x: m.x0 + (m.axis === 'x' ? k * m.amp : 0), y: m.y0 + (m.axis === 'y' ? k * m.amp : 0), dx: 0, dy: 0 })));
  const seen = new Set();
  const q = [];
  const p0 = newPlayer(L);
  // settle onto ground
  for (let i = 0; i < 60; i++) stepPlayer(L, p0, {}, DT);
  const key = p => `${Math.round(p.x / 6)},${Math.round(p.y)}`;
  q.push({ x: p0.x, y: p0.y }); seen.add(key(p0));
  const touchedPages = new Set(), touchedNotes = new Set();
  let exit = false;
  const actions = [];
  for (const dir of [-1, 0, 1]) for (const run of [0, 0.12, 0.3]) for (const hold of [-1, 0.06, 0.14, 0.25, 0.45]) for (const air of [9, 0.12, 0.3]) {
    if (dir === 0 && (run > 0 || air !== 9)) continue;
    if (hold === -1 && air !== 9) continue;
    actions.push({ dir, run, hold, air });
  }
  while (q.length) {
    const s = q.shift();
    for (const a of actions) {
      for (const c of L.crumbles) c.state = 'idle';
      const p = newPlayer(L); p.x = s.x; p.y = s.y; p.ground = true; p.coyote = 0.09;
      let t = 0, phase = 0, left = false, jt = 0;
      for (let i = 0; i < 400; i++) {
        const inp = {};
        if (phase === 0) { // run-up
          if (a.dir > 0) inp.right = true; if (a.dir < 0) inp.left = true;
          if (t >= a.run) { phase = 1; jt = 0; if (a.hold >= 0) inp.jumpPressed = inp.jump = true; else phase = 2; }
        } else if (phase === 1) {
          jt += DT;
          inp.jump = jt < a.hold;
          if (jt < a.air) { if (a.dir > 0) inp.right = true; if (a.dir < 0) inp.left = true; }
        } else {
          jt += DT;
          if (jt < 0.1) { if (a.dir > 0) inp.right = true; if (a.dir < 0) inp.left = true; }
        }
        const ev = stepPlayer(L, p, inp, DT);
        t += DT;
        if (p.dead) break;
        L.pages.forEach((g, k) => { if (overlap(p, { x: g.x - 12, y: g.y - 12, w: 24, h: 24 })) touchedPages.add(k); });
        L.notes.forEach((g, k) => { if (overlap(p, { x: g.x - 10, y: g.y - 10, w: 20, h: 20 })) touchedNotes.add(k); });
        if (L.exit && overlap(p, L.exit)) exit = true;
        if (!p.ground) left = true;
        if (phase >= 1 && left && p.ground) break;
        if (phase === 2 && !left && jt > 0.12) break;
      }
      if (!p.dead && p.ground) {
        const k = key(p);
        if (!seen.has(k)) { seen.add(k); q.push({ x: p.x, y: p.y }); }
      }
    }
  }
  const missP = L.pages.map((g, k) => touchedPages.has(k) ? null : `(${g.x / T - 0.5 | 0},${g.y / T - 0.5 | 0})`).filter(Boolean);
  const missN = L.notes.map((g, k) => touchedNotes.has(k) ? null : `(${(g.x - 16) / T},${(g.y - 16) / T})`).filter(Boolean);
  const ok = exit && !missP.length;
  if (!ok) allOk = false;
  console.log(`${ok ? 'OK ' : 'BAD'} ${li + 1} ${def.title.padEnd(16)} states=${seen.size} exit=${exit} pages ${L.pages.length - missP.length}/${L.pages.length} ${missP.join(' ')} notes ${L.notes.length - missN.length}/${L.notes.length} ${missN.join(' ')}`);
});
process.exit(allOk ? 0 : 1);
