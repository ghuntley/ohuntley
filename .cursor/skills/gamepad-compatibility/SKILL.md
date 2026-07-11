---
name: gamepad-compatibility
description: >-
  Require Xbox / standard Bluetooth gamepad support for Funland Arcade games via
  arcade-gamepad.js and the Gamepad API. Use when adding games, wiring controls,
  or reviewing controller, gamepad, or Xbox input.
---

# Gamepad Compatibility (Xbox / Bluetooth)

**Every arcade game must support a standard gamepad** (Xbox Series X|S, Xbox One, many Bluetooth controllers). Pairing happens in the **OS** (Bluetooth settings); the browser exposes the pad through the **Gamepad API** — no Web Bluetooth code in games.

Shared module: **`arcade-gamepad.js`** → global **`ArcadeGamepad`**.

## Checklist for new games

```
- [ ] `<script src="../arcade-gamepad.js"></script>` before game JS (after tokens/scores if present)
- [ ] Read `held()` / `pressed()` in the game loop — polling is automatic (no per-frame `update()` needed)
- [ ] Map sticks/buttons into the same input path as keyboard (not a separate control scheme)
- [ ] Precache `/arcade-gamepad.js` in service-worker.js (+ bump VERSION)
```

## Setup (HTML)

```html
<script src="../arcade-tokens.js"></script>
<script src="../arcade-scores.js"></script>
<script src="../arcade-gamepad.js"></script>
<script src="./game.js"></script>
```

Lobby (`index.html`): `./arcade-gamepad.js` before `arcade-3d.js`.

## API (`ArcadeGamepad`)

Call **`ArcadeGamepad.start()`** once (auto-runs on `DOMContentLoaded`). A **Pad** button is injected in the **top-left** (`#arcade-gamepad-btn`) on every page that loads this script — it opens Bluetooth pairing steps and a scan flow. An internal `requestAnimationFrame` loop polls the pad — games do **not** need to call `update()` each frame.

Each frame in game code:

```javascript
if (!ArcadeGamepad.connected) return;
// read held(), pressed(), sticks, etc.
```

`update()` remains as a no-op for backward compatibility.

| Method / property | Use |
|-------------------|-----|
| `connected` | Pad active this frame |
| `leftX`, `leftY`, `rightX`, `rightY` | Sticks (−1…1, deadzone applied) |
| `lt`, `rt` | Triggers 0…1 |
| `held("a")` | Button held |
| `pressed("a")` | Edge (one frame) |
| `dpadX()`, `dpadY()` | D-pad + left stick as digital −1/0/1 |
| `consumeDirection()` | Edge `"ArrowUp"` etc. for snake/maze |
| `applyMoveKeys(keysSet)` | Merge into `Set` of key codes (FPS) |
| `applyMoveKeyMap(obj)` | Merge into `{ KeyW: true, … }` object |
| `confirmPressed()` | A or Start (menus) |
| `confirmHeld()` | A or Start held |
| `openConnectionPanel()` | Open the Bluetooth / controller panel programmatically |
| `mountConnectionUI()` | Inject top-left Pad button (auto on load) |

Button names: `a`, `b`, `x`, `y`, `lb`, `rb`, `lt`, `rt`, `start`, `back`, `dup`, `ddown`, `dleft`, `dright`.

## Standard Xbox layout (default mapping)

| Control | Game action (typical) |
|---------|------------------------|
| Left stick | Move / steer |
| Right stick | Look / aim |
| A | Jump / confirm / fire (context) |
| B | Back / cancel / grapple release |
| X | Reload / restart / secondary |
| Y | Pause / alt action |
| RT / RB | Fire / throttle boost |
| LT | — (available) |
| Start | Pause / menu / enter lobby |
| D-pad | Discrete direction (snake, maze) |

## Integration patterns

### FPS / 3D (shooter, grapple, parkour, drone, lobby)

In the main loop:

```javascript
if (ArcadeGamepad.connected) {
  ArcadeGamepad.applyMoveKeys(keys); // or applyMoveKeyMap(keys)
  camera.rotation.y -= ArcadeGamepad.rightX * sens;
  // RT = fire, A = jump, etc.
}
```

Reference: `shooter/game.js`, `grapple/grapple-game.js`, `parkour/parkour-game.js`, `drone/drone-game.js` (`readInputs`), `arcade-3d.js` (`animate`).

### Discrete direction (nibbles, maze)

```javascript
const dir = ArcadeGamepad.consumeDirection();
if (dir) handleMove(dir); // ArrowUp, ArrowDown, …
```

Reference: `nibbles/game.js`, `maze/game.js`.

### Menu / confirm (meerkat, clicker, peggle)

```javascript
if (ArcadeGamepad.confirmPressed()) startOrContinue();
if (ArcadeGamepad.pressed("a")) primaryAction();
```

### UI sliders (gorillas)

Adjust values with sticks/d-pad in the render loop; `pressed("a")` to submit.

## Bluetooth pairing (player-facing)

1. Put Xbox controller in pairing mode (hold sync button).
2. Pair in OS Bluetooth settings (macOS / Windows / iOS / Android).
3. Open the game in the browser; press **A** or move a stick to wake the pad.
4. Chrome / Edge / Firefox support Gamepad API on HTTPS or localhost.

## Common mistakes

- Skipping keyboard merge — gamepad-only code path that skips keyboard; merge into the same `keys` / handlers.
- Missing `arcade-gamepad.js` in service worker (offline lobby/games break).
- Using Web Bluetooth API — not needed; use `navigator.getGamepads()`.

## Related skills

- `.cursor/skills/mobile-touch-compatibility/SKILL.md` — touch + gamepad together
- `.cursor/skills/register-arcade-game/SKILL.md` — registration + precache
