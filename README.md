# Storyline

A cozy storybook platformer set to Laufey songs. A girl with a cello walks through ten chapters, each scored by a different song, collecting notes and the thirty torn pages of a book. Find all thirty and the ending shows what the pages say.

| # | Song | Place | New idea |
|---|---|---|---|
| 1 | Street by Street | cobblestone town in spring | piano-key springs, thorns |
| 2 | Falling Behind | park at golden hour | leaves that crumble under you |
| 3 | Magnolia | glasshouse garden | petal updrafts that carry you up |
| 4 | California and Me | pier at sunset | rowing boats bobbing on the harbour |
| 5 | Bewitched | moonlit wood | ink blots (stomp them into butterflies) |
| 6 | Haunted | old manor library | ghost floors that blink in and out |
| 7 | Snow White | frozen village | slippery ice |
| 8 | Clockwork | inside the clocktower | moving clock-face platforms |
| 9 | Carousel | carnival at dusk | carousel platforms, everything mixed |
| 10 | From The Start | rooftops to the stage | the full gauntlet, then a curtain call |

Levels are 260–450 tiles long and built from hand-designed chunks (`tools/make_levels.py`), seeded per chapter.

**Rendering:** high-DPI canvas; four parallax layers per chapter with fog between them; terrain pre-rendered into cached chunks; a half-resolution lighting pass (darkness with light holes) plus additive bloom; sun shafts; blurred foreground silhouettes; soft-light colour grading, film grain, and vignette.

**Controls:** ← → / A D to walk, Space / W / ↑ to jump (hold to jump higher), R to restart from the last lamp, M for music, Esc for the cover. Phones and tablets get on-screen buttons.

## Music

The music is Apple Music's public 30-second previews, streamed straight from Apple's CDN (the same source as Laufeyless). No audio is stored in this repo. The sound effects are synthesized in the browser.

## Files

- `index.html`: screens and styles
- `game.js`: rendering, audio, game flow
- `core.js`: physics and level parsing (no DOM, so node can run it)
- `levels.js`: **generated**; edit `tools/make_levels.py` and rerun it
- `tools/validate.mjs`: runs a search using the real physics to prove every level can be finished and every page and note can be reached

```
python3 tools/make_levels.py && node tools/validate.mjs
```
