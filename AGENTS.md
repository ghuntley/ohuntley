# AGENTS.md — Funland Arcade

Guidance for AI agents working in this repository.

## Project

**Funland Arcade** is a static, self-contained browser arcade: a Three.js 3D lobby (`index.html`) with walk-up cabinets that link to individual games. No build step, no bundler, no npm. Everything is plain HTML, CSS, and JavaScript served from the repo root.

Default branch: **`trunk`** (GitHub default). There is no remote `main`.

## Local development

Serve from the repo root — ES modules and the service worker require HTTP:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Do not open game HTML files directly via `file://`; module imports and the service worker will fail.

## Layout

```
index.html          # 3D lobby; defines window.ARCADE_GAMES
arcade-3d.js        # Three.js lobby (cabinets, walking, prize counter)
arcade-scores.js    # Shared localStorage leaderboards (per slug)
arcade-tokens.js    # Token economy; auto-awards on ArcadeScores.record()
service-worker.js   # Offline precache; bump VERSION when PRECACHE_URLS changes
sw-register.js      # Service worker registration
vendor/             # Self-hosted fonts + three.js (no CDN)
<slug>/             # One folder per game (index.html + assets)
bots/               # Python + Playwright auto-player (optional)
videos of the bots/ # Bot demo reel — not a playable cabinet
```

## Registered games

Each game folder has a **slug** (folder name). All playable cabinets must be registered in three places:

| File | Purpose |
|------|---------|
| `index.html` → `window.ARCADE_GAMES` | Lobby cabinets |
| `arcade-3d.js` → `DEFAULT_GAMES` | Fallback list (keep identical to above) |
| `service-worker.js` → `PRECACHE_URLS` | Offline assets (+ bump `VERSION`) |

Current slugs: `maze`, `meerkat`, `meerkat-tycoon`, `gorillas`, `nibbles`, `grapple`, `parkour`, `peggle`, `shooter`, `clicker`, `drone`.

**Room layout:** max **5 games per 3D lobby room**; additional games spawn new rooms automatically. See `.cursor/skills/arcade-room-layout/SKILL.md`.

**Adding or auditing a game:** read and follow `.cursor/skills/register-arcade-game/SKILL.md`.

## Game conventions

- **Mobile touch is required** for every game. See `.cursor/skills/mobile-touch-compatibility/SKILL.md`.
- Folder name = slug used everywhere (`ArcadeScores.record("<slug>", …)`).
- Every game page links back: `href="../index.html"`.
- Games with scores load scripts in order: `arcade-tokens.js` → `arcade-scores.js` → game JS → `sw-register.js`.
- Time trials use `{ lowerIsBetter: true }` on `ArcadeScores.record()`.
- Match the style of neighboring games (canvas vs module script, CSS split or inline).
- Self-host dependencies under `vendor/` — do not add CDN links (locked-down school networks block them).

## Shared lobby behavior

- `arcade-3d.js` is an ES module; it imports three.js from `./vendor/three/…`.
- Cabinets link to `{slug}/index.html` via `userData.href` on each cabinet group.
- Prize counter / tokens: `arcade-tokens.js` integrated in the lobby UI.

## Bots harness (`bots/`)

Optional Python + Playwright runner for demo recordings. Not required for lobby registration. See `bots/README.md`. Register new bots in `bots/game_bots/__init__.py` → `BOT_MODULES`.

## Coding principles

- **Minimize scope** — smallest correct diff; don't refactor unrelated code.
- **No over-engineering** — no abstractions for one-off helpers.
- **Follow existing patterns** — read a similar game before adding a new one.
- **Comments sparingly** — only for non-obvious logic.
- **No tests unless asked** — this repo has no test harness for games.

## Git

- Commit only when the user explicitly asks.
- Do not force-push `trunk`/`main`.
- Use `gh` for GitHub PRs when requested.

## Common agent tasks

| Task | Where to look |
|------|---------------|
| Add a new game | `.cursor/skills/register-arcade-game/SKILL.md` |
| Lobby rooms / cabinet layout | `.cursor/skills/arcade-room-layout/SKILL.md` |
| Touch / mobile controls | `.cursor/skills/mobile-touch-compatibility/SKILL.md` |
| Fix offline / cache | `service-worker.js` (precache + VERSION bump) |
| Lobby cabinet missing | `index.html` ARCADE_GAMES + `arcade-3d.js` DEFAULT_GAMES |
| Leaderboard / tokens | `arcade-scores.js`, `arcade-tokens.js`, game's `record()` calls |
| 3D lobby / walking | `arcade-3d.js` |
| Bot demo video | `bots/runner.py`, `bots/game_bots/<slug>.py` |
