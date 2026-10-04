#!/usr/bin/env python3
"""Generates levels.js. Each chapter is a seeded run of hand-designed chunks; tools/validate.mjs proves the
result is beatable. Coordinates are tiles, y=0 is the top row, 17 rows. Every chunk lays its own ground and
leaves the cursor (s.x) at the next free column with ground expected at height s.h."""
import json, math, pathlib, random

H = 17

class Lv:
    def __init__(s, seed):
        s.w = 900
        s.g = [[' '] * s.w for _ in range(H)]
        s.x = 0
        s.h = 14
        s.r = random.Random(seed)
        s.since_lamp = 0

    # ---- primitives ----
    def G(s, x0, x1, top, ice=False):
        for x in range(x0, x1 + 1):
            for y in range(top, H):
                s.g[y][x] = 'I' if (ice and y == top) else '#'
    def put(s, x, y, c):
        if 0 <= y < H and s.g[y][x] == ' ':
            s.g[y][x] = c
    def force(s, x, y, c):
        s.g[y][x] = c
    def plat(s, x, y, n, c='='):
        for i in range(n):
            s.force(x + i, y, c)
    def arc(s, x0, n, row, lift=1.6):
        for i in range(n):
            r = row - (round(math.sin(math.pi * i / (n - 1)) * lift) if n > 2 else 0)
            s.put(x0 + i, r, 'o')
    def clamp(s, h):
        return max(9, min(14, h))
    def ri(s, a, b):
        return s.r.randint(a, b)

    # ---- chunks ----
    def start(s):
        s.G(0, 9, s.h); s.force(2, s.h - 1, 'S'); s.arc(5, 4, s.h - 2); s.x = 10
    def finish(s):
        x, h = s.x, s.h
        s.G(x, x + 15, h); s.arc(x + 1, 5, h - 2); s.force(x + 10, h - 1, 'E'); s.x = x + 16
    def lamp(s):
        x, h = s.x, s.h
        s.G(x, x + 5, h); s.force(x + 2, h - 1, 'L'); s.x = x + 6; s.since_lamp = 0
    def flat(s):
        x, h, n = s.x, s.h, s.ri(5, 8)
        s.G(x, x + n - 1, h)
        if s.r.random() < 0.7: s.arc(x + 1, n - 2, h - 2)
        s.x += n
    def step(s):
        x = s.x
        nh = s.clamp(s.h + s.r.choice([-2, -1, 1, 2]))
        if nh == s.h: nh = s.clamp(s.h - 1) if s.h > 9 else s.h + 1
        s.G(x, x + 4, nh); s.arc(x + 1, 3, nh - 2, 0.6)
        s.h = nh; s.x += 5
    def gap(s):
        x, h, w = s.x, s.h, s.ri(2, 4)
        nh = s.clamp(h + s.r.choice([-1, 0, 0, 1]))
        if w == 4 and nh < h: nh = h
        s.arc(x - 1, w + 2, min(h, nh) - 3)
        s.G(x + w, x + w + 3, nh); s.h = nh; s.x += w + 4
    def thorns(s):
        x, h, k = s.x, s.h, s.ri(2, 3)
        s.G(x, x + k + 4, h)
        for i in range(k): s.force(x + 2 + i, h - 1, '^')
        s.arc(x + 1, k + 2, h - 3)
        s.x += k + 5
    def plats(s):
        x, h, w = s.x, s.h, s.r.choice([7, 9])
        s.plat(x + 1, h - 2, 2); s.plat(x + 4, h - 3, 2)
        s.arc(x + 1, 5, h - 4, 1)
        if w == 9: s.plat(x + 7, h - 2, 2); s.put(x + 7, h - 3, 'o'); s.put(x + 8, h - 3, 'o')
        s.G(x + w, x + w + 3, h); s.x += w + 4
    def spring_up(s, page=False):
        x, h = s.x, s.h
        s.G(x, x + 10, h); s.force(x + 2, h - 1, 'K')
        r = max(2, h - 8)
        s.plat(x + 4, r, 5)
        for i in range(4): s.put(x + 4 + i, r - 1, 'o')
        if page: s.force(x + 8, r - 1, 'P')
        s.arc(x + 4, 5, h - 2, 0.5)
        s.x += 11
    def tower(s, page=True):
        x, h = s.x, s.h
        if h < 11: return s.spring_up(page)
        s.G(x, x + 7, h)
        s.plat(x + 1, h - 3, 3); s.plat(x + 4, h - 6, 3); s.plat(x + 1, h - 9, 3)
        s.put(x + 5, h - 7, 'o'); s.put(x + 2, h - 4, 'o')
        if page: s.force(x + 2, h - 10, 'P')
        else: s.put(x + 2, h - 10, 'o')
        s.x += 8
    def crumble(s):
        x, h, w = s.x, s.h, s.r.choice([8, 10])
        pairs = [(1, h), (4, h - 1)] + ([(7, h)] if w == 10 else [])
        for dx, row in pairs:
            s.plat(x + dx, row, 2, 'C'); s.put(x + dx, row - 1, 'o'); s.put(x + dx + 1, row - 1, 'o')
        s.G(x + w, x + w + 3, h); s.x += w + 4
    def enemies(s, n=None):
        x, h = s.x, s.h
        n = n or s.ri(1, 2)
        s.G(x, x + 12, h)
        for i in range(n): s.force(x + 4 + i * 4, h - 1, 'x')
        s.arc(x + 2, 9, h - 3, 1)
        s.x += 13
    def mover(s):
        x, h = s.x, s.h
        s.force(x + 3, h, 'M')
        s.arc(x, 9, h - 3, 1.2)
        s.G(x + 9, x + 12, h); s.x += 13
    def vclimb(s):
        x, h = s.x, s.h
        if h < 12: return s.mover()
        s.G(x, x + 2, h)
        s.force(x + 4, h - 1, 'V'); s.put(x + 4, h - 5, 'o'); s.put(x + 5, h - 5, 'o')
        nh = h - 3
        s.G(x + 7, x + 11, nh); s.arc(x + 8, 3, nh - 2, 0.5)
        s.h = nh; s.x += 12
    def ice(s):
        x, h = s.x, s.h
        s.G(x, x + 13, h, ice=True)
        s.force(x + 5, h - 1, '^'); s.force(x + 6, h - 1, '^'); s.force(x + 10, h - 1, '^')
        s.arc(x + 4, 4, h - 3); s.arc(x + 9, 3, h - 3, 0.8)
        s.x += 14
    def blink(s):
        x, h, w = s.x, s.h, s.r.choice([8, 10])
        pairs = [1, 4] + ([7] if w == 10 else [])
        for dx in pairs:
            s.plat(x + dx, h, 2, 'B'); s.put(x + dx, h - 2, 'o'); s.put(x + dx + 1, h - 2, 'o')
        s.G(x + w, x + w + 3, h); s.x += w + 4
    def updraft(s, page=False):
        x, h = s.x, s.h
        for col in (x + 3, x + 4):
            for y in range(h - 6, H): s.force(col, y, 'U')
        s.plat(x + 6, h - 5, 2)
        s.put(x + 6, h - 6, 'o'); s.put(x + 7, h - 6, 'o')
        if page: s.force(x + 4, h - 9, 'P')
        else:
            s.put(x + 3, h - 8, 'o'); s.put(x + 4, h - 8, 'o')
        s.G(x + 9, x + 12, h); s.x += 13
    def water(s):
        x, h = s.x, s.h
        if h < 13: return s.gap()
        w = s.r.choice([9, 10, 12])
        for col in range(x, x + w):
            for y in range(15, H): s.force(col, y, '~')
        boats = [2, 6] + ([9] if w == 12 else [])
        for b in boats:
            s.force(x + b, 14, 'W'); s.put(x + b, 12, 'o'); s.put(x + b + 1, 12, 'o')
        s.G(x + w, x + w + 3, h); s.x += w + 4

    def out(s):
        return [''.join(r[:s.x]).rstrip() for r in s.g]


CHAPTERS = [
    dict(title='Street by Street', chapter='Chapter One', place='a cobblestone town in spring', theme='spring', n=26,
         pool=dict(flat=3, step=2, gap=3, thorns=2, plats=2, spring_up=1),
         line='Once, a girl with a cello walked the old streets, humming a song nobody had heard yet.'),
    dict(title='Falling Behind', chapter='Chapter Two', place='the park at golden hour', theme='autumn', n=28,
         pool=dict(flat=2, step=2, gap=2, thorns=1, plats=1, crumble=4, spring_up=1),
         line='The leaves let go one by one. Some of them will hold you, just long enough.'),
    dict(title='Magnolia', chapter='Chapter Three', place='the glasshouse garden', theme='garden', n=28,
         pool=dict(flat=2, step=2, gap=2, thorns=2, plats=1, crumble=1, updraft=4),
         line='Under the glass the magnolias breathe out warm air. Step into the petals and let them carry you.'),
    dict(title='California and Me', chapter='Chapter Four', place='a pier at sunset', theme='sea', n=30,
         pool=dict(flat=2, gap=2, thorns=1, plats=2, water=5, spring_up=1, crumble=1),
         line='The sun went down over the water, and little boats rocked her across the harbour.'),
    dict(title='Bewitched', chapter='Chapter Five', place='a moonlit wood', theme='moon', n=30,
         pool=dict(flat=2, step=2, gap=2, thorns=2, plats=1, enemies=4, spring_up=1, crumble=1),
         line='Spilled ink crept between the trees. Hop on it, and it turns to butterflies.'),
    dict(title='Haunted', chapter='Chapter Six', place='the old manor library', theme='haunt', n=32,
         pool=dict(flat=2, step=2, gap=2, thorns=2, blink=5, enemies=2, plats=1),
         line='The bookshelves whisper. Some floors are only there when the ghosts remember them.'),
    dict(title='Snow White', chapter='Chapter Seven', place='a frozen village', theme='snow', n=32,
         pool=dict(flat=2, step=2, gap=2, ice=5, thorns=1, enemies=2, plats=1, spring_up=1),
         line='Snow fell all night. The paths are glass now — lean into it, and stop early.'),
    dict(title='Clockwork', chapter='Chapter Eight', place='inside the clocktower', theme='clock', n=34,
         pool=dict(flat=2, step=1, gap=2, thorns=1, mover=4, vclimb=3, enemies=2, spring_up=1),
         line='Every gear keeps its own time. Wait for the right moment, then leap.'),
    dict(title='Carousel', chapter='Chapter Nine', place='the carnival at dusk', theme='carnival', n=34,
         pool=dict(flat=2, step=1, gap=2, mover=3, spring_up=2, enemies=3, crumble=2, blink=1, plats=1),
         line='Round and round the painted horses go. Ride them to the lights at the end of the fair.'),
    dict(title='From The Start', chapter='Chapter Ten', place='the rooftops, to the stage', theme='stage', n=38,
         pool=dict(flat=1, step=2, gap=2, thorns=2, plats=1, crumble=2, enemies=2, mover=2, vclimb=1, blink=2, ice=1, updraft=1, spring_up=1),
         line='The last page is a stage under the stars, and the whole town is listening.'),
]

PAGE_CHUNKS = {'garden': 'updraft'}

def build(i, spec):
    s = Lv(1000 + i * 77)
    s.start()
    names = list(spec['pool'].keys()); weights = list(spec['pool'].values())
    n = spec['n']
    page_at = {round(n * 0.22), round(n * 0.55), round(n * 0.85)}
    last = None
    for k in range(n):
        if s.since_lamp >= 6 and k < n - 2:
            s.lamp()
        if k in page_at:
            kind = PAGE_CHUNKS.get(spec['theme'], s.r.choice(['tower', 'spring_up']))
            getattr(s, kind)(page=True)
        else:
            c = s.r.choices(names, weights)[0]
            while c == last and len(names) > 1 and c not in ('flat',):
                c = s.r.choices(names, weights)[0]
            getattr(s, c)()
            last = c
        s.since_lamp += 1
    s.finish()
    return s

levels = [build(i, c) for i, c in enumerate(CHAPTERS)]
out = [dict(map=l.out(), **{k: v for k, v in c.items() if k not in ('pool', 'n')}) for l, c in zip(levels, CHAPTERS)]
p = pathlib.Path(__file__).resolve().parent.parent / 'levels.js'
p.write_text('// Generated by tools/make_levels.py — edit that, not this.\nconst LEVELS = ' + json.dumps(out, indent=0) + ';\nif (typeof module !== "undefined") module.exports = LEVELS;\n')
print('wrote', p, [l.x for l in levels])
