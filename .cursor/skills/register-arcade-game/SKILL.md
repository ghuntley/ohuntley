---
name: register-arcade-game
description: >-
  Register a new game in the Funland Arcade (ohuntley repo): lobby cabinet,
  offline precache, scores/tokens, and fallback list. Use when adding a new
  arcade game, wiring a game into the 3D lobby, updating ARCADE_GAMES,
  service-worker precache, or auditing that all games are registered.
---

# Register Arcade Games (Funland Arcade)

Funland Arcade is a static site. A playable game is **registered** when it appears as a 3D cabinet in the lobby and works offline. The **slug** is the folder name under the repo root (e.g. `drone`, `clicker`).

## Registration checklist

Copy and complete when adding or auditing a game:

```
- [ ] Game folder: `<slug>/index.html` (+ JS/CSS/assets)
- [ ] Lobby: entry in `index.html` → `window.ARCADE_GAMES`
- [ ] Fallback: same entry in `arcade-3d.js` → `DEFAULT_GAMES`
- [ ] Offline: assets in `service-worker.js` → `PRECACHE_URLS` + bump `VERSION`
- [ ] Game page: back link to `../index.html`
- [ ] Scores (if applicable): `arcade-scores.js` + `ArcadeScores.record("<slug>", score)`
- [ ] Tokens (optional): load `../arcade-tokens.js` before `arcade-scores.js`
- [ ] Touch: mobile playable per `.cursor/skills/mobile-touch-compatibility/SKILL.md`
```

## 1. Lobby entry (`index.html`)

Add an object to `window.ARCADE_GAMES` (inside `<head>`, before `arcade-3d.js` loads):

```javascript
{
  slug: "my-game",           // must match folder name
  title: "MY GAME",          // cabinet marquee (ALL CAPS)
  blurb: "Short · tag · line", // shown on cabinet screen
  marquee: "#ff00cc",        // hex accent for cabinet trim
  screen: "#00ffaa",         // hex accent for screen glow
},
```

`arcade-3d.js` reads `window.ARCADE_GAMES` and builds cabinets. Cabinet links resolve to `{slug}/index.html`.

**Room limit:** at most **5 games per lobby room**; `chunkGames()` in `arcade-3d.js` opens a new room for each additional batch. See `.cursor/skills/arcade-room-layout/SKILL.md`.

## 2. Fallback list (`arcade-3d.js`)

**Keep `DEFAULT_GAMES` identical to `ARCADE_GAMES`.** It is used only when `window.ARCADE_GAMES` is missing, but drift causes missing cabinets in edge cases.

## 3. Service worker precache (`service-worker.js`)

Add every same-origin asset the game needs offline:

```javascript
"/<slug>/",
"/<slug>/index.html",
"/<slug>/game.js",        // or whatever the main script is named
"/<slug>/style.css",      // if separate
// images, audio, fonts used only by this game
```

Then **increment `VERSION`** (e.g. `funland-arcade-v8` → `v9`). Without a bump, existing installs keep the old cache.

Shared shell assets are already precached (lobby JS, fonts, three.js vendor bundle). Do not duplicate those per game unless adding new shared deps.

## 4. Game page conventions

Each game lives in its own folder with `index.html`. Follow existing games (`clicker/`, `nibbles/`, `drone/`):

**Back link** (required):

```html
<a class="back" href="../index.html" title="Back to the arcade">← Arcade</a>
```

**Scripts** (when the game has scores):

```html
<script src="../arcade-tokens.js"></script>
<script src="../arcade-scores.js"></script>
<script src="./game.js"></script>
<script src="/sw-register.js"></script>
```

Load order: `arcade-tokens.js` before `arcade-scores.js` (tokens auto-award on `record()`).

## 5. Leaderboards (`arcade-scores.js`)

Use the **same slug** as the folder name:

```javascript
// Higher is better (default)
ArcadeScores.record("my-game", score);
ArcadeScores.refresh("my-game");

// Time trials — lower is better
ArcadeScores.record("my-game", timeMs, { lowerIsBetter: true });
```

Games without a meaningful score (e.g. Skyhook/grapple demo) may skip scores — still register in the lobby and service worker.

## 6. Optional: bot harness (`bots/`)

Only if an automated demo bot is needed:

1. Add `bots/game_bots/<slug>.py` with `SLUG`, `TITLE`, `PATH`, `INIT_SCRIPT`, `play(page)`.
2. Register the module in `bots/game_bots/__init__.py` → `BOT_MODULES`.

Not required for lobby registration.

## Audit: find unregistered games

1. List game folders: each `*/index.html` except root `index.html` and `videos of the bots/`.
2. Compare slugs to `window.ARCADE_GAMES`, `DEFAULT_GAMES`, and `PRECACHE_URLS`.
3. Fix any missing entries in all three places.

## Current registered games (keep in sync when editing)

| slug | title |
|------|-------|
| maze | MAZE RUNNER |
| meerkat | MEERKAT RUN |
| meerkat-tycoon | MEERKAT MANOR |
| gorillas | GORILLAS |
| nibbles | NIBBLES |
| grapple | SKYHOOK |
| parkour | NEON DRIFT |
| peggle | PEGGLE-ISH |
| shooter | VECTOR STRIKE |
| clicker | NEON FORGE |
| drone | VELODRONE |

When adding a new game, append a row here in the same commit.

## Common mistakes

- Registering in `ARCADE_GAMES` but forgetting `service-worker.js` (game works online only).
- Forgetting to bump `VERSION` after precache changes.
- Slug mismatch between folder name, `ARCADE_GAMES.slug`, and `ArcadeScores.record()` first argument.
- Updating `ARCADE_GAMES` without syncing `DEFAULT_GAMES`.
