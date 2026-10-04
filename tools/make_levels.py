#!/usr/bin/env python3
"""Generates levels.js from feature placements. Coordinates are tiles; y=0 is the top row, 17 rows."""
import json, pathlib

H = 17

class Lv:
    def __init__(s, w):
        s.w = w
        s.g = [[' '] * w for _ in range(H)]
    def ground(s, x0, x1, top=15):
        for x in range(x0, x1 + 1):
            for y in range(top, H):
                s.g[y][x] = '#'
        return s
    def block(s, x0, x1, y0, y1):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                s.g[y][x] = '#'
    def plat(s, x, y, n):
        for i in range(n):
            s.g[y][x + i] = '='
    def put(s, x, y, c):
        s.g[y][x] = c
    def row(s, x, y, c, n, step=1):
        for i in range(n):
            s.g[y][x + i * step] = c
    def out(s):
        return [''.join(r).rstrip() for r in s.g]

levels = []

# ---------- Chapter 1: Street by Street ----------
a = Lv(142)
a.ground(0, 22); a.put(2, 14, 'S')
a.row(6, 13, 'o', 3, 2)
a.ground(16, 22, 13); a.row(17, 12, 'o', 3, 2)
a.ground(26, 40)
a.plat(29, 12, 4); a.row(29, 11, 'o', 4)
a.plat(34, 9, 4); a.put(36, 8, 'P')
a.row(37, 14, '^', 2)
a.ground(41, 60); a.put(43, 14, 'L')
a.put(48, 14, 'K'); a.plat(50, 6, 6); a.row(50, 5, 'o', 3); a.put(54, 5, 'P')
a.row(52, 14, 'o', 3)
a.ground(65, 80); a.row(70, 14, '^', 3); a.row(69, 11, 'o', 5)
a.ground(81, 84, 13); a.ground(85, 88, 11); a.row(85, 10, 'o', 4)
a.plat(93, 11, 3); a.put(94, 10, 'o')
a.ground(97, 115, 13); a.put(98, 12, 'L'); a.plat(102, 10, 4); a.put(104, 9, 'P')
a.row(107, 12, '^', 2); a.row(110, 12, 'o', 4)
a.ground(116, 141); a.row(118, 14, 'o', 5, 2); a.put(134, 14, 'E')
levels.append(a)

# ---------- Chapter 2: Falling Behind (crumbling leaves) ----------
b = Lv(150)
b.ground(0, 14); b.put(2, 14, 'S'); b.row(6, 13, 'o', 4)
b.row(17, 14, 'C', 2); b.row(21, 13, 'C', 2); b.row(25, 12, 'C', 2)
b.row(17, 13, 'o', 2); b.row(25, 11, 'o', 2)
b.ground(29, 42, 13); b.put(31, 12, 'L'); b.row(36, 12, '^', 2)
b.plat(39, 9, 3); b.put(40, 7, 'P')
b.row(46, 12, 'C', 1); b.row(50, 11, 'C', 1); b.row(54, 12, 'C', 1); b.row(58, 13, 'C', 1)
b.put(46, 11, 'o'); b.put(50, 10, 'o'); b.put(54, 11, 'o'); b.put(58, 12, 'o')
b.ground(61, 78); b.put(63, 14, 'L'); b.put(68, 14, 'K'); b.row(66, 14, '^', 2); b.row(70, 14, '^', 2)
b.row(66, 4, 'C', 5); b.row(66, 3, 'o', 3); b.put(70, 3, 'P')
b.ground(74, 78, 12); b.row(75, 11, 'o', 3)
b.row(82, 12, 'C', 2); b.row(87, 11, 'C', 2); b.row(92, 12, 'C', 2)
b.ground(96, 112, 13); b.put(97, 12, 'L'); b.row(101, 12, '^', 3); b.row(100, 9, 'o', 5)
b.plat(106, 10, 3); b.plat(110, 7, 3); b.put(111, 6, 'P')
b.row(116, 13, 'C', 2); b.row(120, 13, 'C', 2); b.row(124, 13, 'C', 2)
b.ground(128, 149); b.row(130, 14, 'o', 5, 2); b.put(143, 14, 'E')
levels.append(b)

# ---------- Chapter 3: Bewitched (ink blots in a moonlit wood) ----------
c = Lv(160)
c.ground(0, 30); c.put(2, 14, 'S'); c.put(16, 14, 'x'); c.row(10, 13, 'o', 4)
c.plat(20, 11, 4); c.row(20, 10, 'o', 4)
c.ground(34, 50, 13); c.put(36, 12, 'L'); c.put(44, 12, 'x'); c.row(48, 12, '^', 2)
c.plat(40, 10, 3); c.put(41, 7, 'P')
c.ground(54, 70); c.put(58, 14, 'x'); c.put(64, 14, 'x'); c.row(57, 11, 'o', 6)
c.put(68, 14, 'K'); c.plat(64, 5, 5); c.row(64, 4, 'o', 4)
c.ground(71, 80, 11); c.put(73, 10, 'x'); c.put(78, 10, 'P')
c.ground(81, 100); c.put(83, 14, 'L'); c.row(88, 14, '^', 3); c.row(94, 14, '^', 3)
c.plat(87, 11, 5); c.plat(93, 11, 5); c.put(90, 10, 'x'); c.row(88, 10, 'o', 2); c.row(95, 10, 'o', 2)
c.plat(104, 12, 3); c.plat(109, 10, 3); c.plat(114, 12, 3); c.row(104, 11, 'o', 3); c.put(110, 8, 'P')
c.ground(119, 140); c.put(121, 14, 'L'); c.put(126, 14, 'x'); c.put(131, 14, 'x'); c.put(136, 14, 'x')
c.row(125, 12, 'o', 12)
c.ground(141, 159, 13); c.put(152, 12, 'E')
levels.append(c)

# ---------- Chapter 4: Clockwork (moving gears) ----------
d = Lv(160)
d.ground(0, 14); d.put(2, 14, 'S'); d.row(6, 13, 'o', 4)
d.put(19, 13, 'M'); d.row(18, 11, 'o', 4)
d.ground(26, 36); d.put(28, 14, 'L'); d.put(33, 14, 'x')
d.put(39, 12, 'V'); d.put(40, 7, 'o')
d.ground(44, 56, 11); d.put(46, 10, 'x'); d.plat(50, 7, 3); d.put(51, 6, 'P')
d.put(60, 12, 'M'); d.put(70, 12, 'M'); d.row(60, 10, 'o', 12)
d.ground(76, 90); d.put(78, 14, 'L'); d.row(82, 14, '^', 4)
d.put(84, 9, 'V'); d.put(85, 4, 'P'); d.put(85, 6, 'o')
d.ground(91, 96, 12)
d.put(100, 11, 'V'); d.put(106, 9, 'V'); d.put(112, 11, 'V'); d.put(101, 8, 'o'); d.put(107, 6, 'o'); d.put(113, 8, 'o')
d.ground(117, 132); d.put(119, 14, 'L'); d.put(124, 14, 'x'); d.put(129, 14, 'K'); d.plat(124, 5, 4); d.put(125, 4, 'P')
d.put(136, 13, 'M'); d.row(135, 11, 'o', 4)
d.ground(143, 159); d.put(152, 14, 'E')
levels.append(d)

# ---------- Chapter 5: From The Start (rooftops to the stage) ----------
e = Lv(170)
e.ground(0, 16, 12); e.put(2, 11, 'S'); e.row(6, 10, 'o', 4)
e.ground(20, 30, 13); e.put(25, 12, 'x'); e.row(22, 10, 'o', 6)
e.row(34, 12, 'C', 2); e.row(38, 11, 'C', 2)
e.ground(42, 54, 11); e.put(44, 10, 'L'); e.row(48, 10, '^', 2); e.plat(47, 8, 4); e.put(48, 6, 'P')
e.put(58, 11, 'M'); e.row(57, 9, 'o', 4)
e.ground(66, 80, 13); e.put(70, 12, 'x'); e.put(76, 12, 'K'); e.plat(70, 4, 5); e.put(72, 3, 'P'); e.row(70, 3, 'o', 2)
e.put(84, 12, 'V'); e.put(90, 10, 'V'); e.row(85, 8, 'o', 1); e.row(91, 6, 'o', 1)
e.ground(95, 110, 11); e.put(97, 10, 'L'); e.put(103, 10, 'x'); e.put(107, 10, 'x')
e.row(113, 11, 'C', 2); e.row(117, 10, 'C', 2); e.row(121, 11, 'C', 2); e.put(117, 7, 'P')
e.ground(125, 136, 13); e.row(129, 12, '^', 3); e.plat(128, 10, 5); e.row(128, 9, 'o', 5)
e.ground(137, 169, 15); e.put(139, 14, 'L'); e.row(144, 14, 'o', 8, 2); e.put(162, 14, 'E')
levels.append(e)

meta = [
    dict(title='Street by Street', chapter='Chapter One', place='a cobblestone town in spring',
         line='Once, a girl with a cello walked the old streets, humming a song nobody had heard yet.', theme='spring'),
    dict(title='Falling Behind', chapter='Chapter Two', place='the park at golden hour',
         line='The leaves let go one by one. Some of them will hold you, just long enough.', theme='autumn'),
    dict(title='Bewitched', chapter='Chapter Three', place='a moonlit wood',
         line='Spilled ink crept between the trees. Hop on it, and it turns to butterflies.', theme='moon'),
    dict(title='Clockwork', chapter='Chapter Four', place='inside the clocktower',
         line='Every gear keeps its own time. Wait for the right moment, then leap.', theme='clock'),
    dict(title='From The Start', chapter='Chapter Five', place='the rooftops, to the stage',
         line='The last page is a stage under the stars, and the whole town is listening.', theme='stage'),
]
out = [dict(map=l.out(), **m) for l, m in zip(levels, meta)]
p = pathlib.Path(__file__).resolve().parent.parent / 'levels.js'
p.write_text('// Generated by tools/make_levels.py — edit that, not this.\nconst LEVELS = ' + json.dumps(out, indent=1) + ';\nif (typeof module !== "undefined") module.exports = LEVELS;\n')
print('wrote', p, [l.w for l in levels])
