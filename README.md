# Storyline

A cozy storybook platformer set to Laufey songs. A girl with a cello walks through five chapters, each scored by a different song, collecting notes and the fifteen torn pages of a book. Find all fifteen and the ending shows what the pages say.

| Chapter | Place | Song | New idea |
|---|---|---|---|
| 1 | cobblestone town in spring | Street by Street | piano-key springs, thorns |
| 2 | park at golden hour | Falling Behind | leaves that crumble under you |
| 3 | moonlit wood | Bewitched | ink blots (jump on them, they turn into butterflies) |
| 4 | inside the clocktower | Clockwork | moving clock-face platforms |
| 5 | rooftops to the stage | From The Start | everything, then a curtain call |

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
