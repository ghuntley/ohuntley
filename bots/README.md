# Funland Arcade auto-player

A Python + Playwright harness that opens each game in the arcade, plays it
automatically with a per-game bot, and saves one `.webm` recording per
run. After every game has been played, the runner writes a `recordings/index.html`
that plays all the runs back-to-back like a tape.

## What's in the box

| Slug             | Bot strategy                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| `nibbles`        | Pixel-scans the canvas, BFS toward the next food, classic Snake auto-pilot. |
| `maze`           | Reads the maze grid from canvas pixels, BFS to the exit, plays 4 levels.    |
| `peggle`         | Detects pegs by colour, simulates each candidate angle's flight, picks best. |
| `gorillas`       | Locates each gorilla by its highlight box, brute-force ballistic solver.    |
| `meerkat`        | Watches the canvas for gaps in front of the runner, jumps just in time.     |
| `meerkat-tycoon` | Real-time sim: forager allocation, recruit/dig/buy when affordable.         |
| `grapple`        | 3D game; the bot drives a watchable demo (no real score available).         |

Every recording starts with a translucent "AUTO PLAYER · GAME · SCORE"
overlay so the video is self-explanatory.

## First-time setup

```bash
cd bots
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

This creates a self-contained Python venv inside `bots/.venv/` and
downloads the headless Chromium build Playwright drives. Nothing is
installed globally.

## Running

From `bots/`:

```bash
. .venv/bin/activate
python runner.py                # play every game (default ~7 min)
python runner.py nibbles peggle # only those slugs
python runner.py --headed       # show the browser while it plays
```

Output:

```
recordings/
├── index.html            # tape player + per-game grid (open in browser)
├── summary.json          # machine-readable scores + paths
├── nibbles/nibbles.webm
├── maze/maze.webm
├── peggle/peggle.webm
├── gorillas/gorillas.webm
├── meerkat/meerkat.webm
├── meerkat-tycoon/meerkat-tycoon.webm
└── grapple/grapple.webm
```

To watch the whole reel, just open `recordings/index.html` in any browser
and click any game name (the player chains the next video on `ended`).

## Architecture notes

The arcade is served from a tiny in-process `http.server` rooted at the
project root, so the bots see exactly what a real visitor would
(including the offline service worker, fonts, and Three.js bundle).

Each bot module exports:

- `SLUG`, `TITLE`, `PATH` — plumbing the runner uses.
- `INIT_SCRIPT` — JavaScript injected with `context.add_init_script` before
  any of the page's own scripts run. Most games keep state inside an IIFE,
  so the init script is mostly used to expose a small reader on
  `window.__BOT__` (e.g. nibbles publishes a canvas-scanning helper).
- `play(page) -> int` — drives the game over a Playwright `Page` and
  returns the final score.

The shared overlay is also injected via `add_init_script` and re-attaches
itself with a `MutationObserver` if the game wipes the body.

## Concatenating into a single video

`index.html` already plays every recording in sequence. If you want a
single MP4 you can scrub:

```bash
brew install ffmpeg
cd bots/recordings
printf "file '%s'\n" */*.webm > reel.txt
ffmpeg -f concat -safe 0 -i reel.txt -c:v libx264 -pix_fmt yuv420p arcade-reel.mp4
```

(ffmpeg isn't required — the index.html playlist works without it.)

## Limitations

- The Skyhook (grapple) game requires pointer-lock, which Playwright
  cannot grant in a headless browser. The bot drives a "demo flight" with
  WASD + clicks instead. There's no in-game score for it, so the recorded
  number is "seconds aloft".
- The bots are written for the current games. Adding a new arcade game
  means adding a new `game_bots/<slug>.py` and listing it in
  `game_bots/__init__.py:BOT_MODULES`.
