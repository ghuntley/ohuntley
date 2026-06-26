---
name: mobile-touch-compatibility
description: >-
  Require and implement mobile touch compatibility for Funland Arcade games.
  Use when creating or editing any game, adding controls, fixing mobile bugs,
  or reviewing touch, pointer, viewport, or on-screen control work.
---

# Mobile Touch Compatibility (Funland Arcade)

**Every arcade game must be playable on phones and tablets.** Keyboard-only or pointer-lock-only games are not acceptable unless they also provide touch/on-screen controls that cover the same actions.

The lobby (`arcade-3d.js`) already has touch walking; this skill applies to **individual games** in `<slug>/`.

## Checklist

Copy when building or reviewing a game:

```
- [ ] Viewport meta includes viewport-fit=cover
- [ ] touch-action set on canvas/game surface (usually none or manipulation)
- [ ] -webkit-tap-highlight-color: transparent on interactive controls
- [ ] All core actions reachable without a physical keyboard
- [ ] Touch does not double-fire (synthetic click after pointerdown)
- [ ] Controls respect safe-area-inset (notches, home bar)
- [ ] On-screen hints updated for touch (@media pointer: coarse)
- [ ] Tested mentally for portrait + landscape on ~375px width
```

## HTML baseline

Every game `index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

UI-heavy games (menus, buttons, tap targets) also set:

```html
<html lang="en" data-touch-compatible="true">
```

## CSS baseline

On `html, body` and the game canvas:

```css
touch-action: none;          /* games that drag/steer on canvas */
-webkit-user-select: none;
user-select: none;
```

On buttons and tappable UI:

```css
touch-action: manipulation;  /* allow tap, suppress double-tap zoom delay */
-webkit-tap-highlight-color: transparent;
min-height: 44px;            /* Apple HIG minimum touch target */
min-width: 44px;
```

Show touch-specific copy only on coarse pointers:

```css
.desktop-only { display: block; }
.touch-only { display: none; }
@media (pointer: coarse) {
  .desktop-only { display: none; }
  .touch-only { display: block; }
}
```

Position fixed controls with safe areas:

```css
bottom: max(12px, env(safe-area-inset-bottom));
left: max(12px, env(safe-area-inset-left));
```

## Patterns by game type

Pick the pattern that matches the game. Read the reference implementation before inventing a new scheme.

### Tap / UI games (menus, buttons, idle clickers)

**Reference:** `clicker/` (`data-touch-compatible`, `bindTap()` in `clicker/game.js`)

- Use `pointerdown` for touch/pen; suppress duplicate `click` within ~500 ms.
- Enlarge tap targets on coarse devices (`.touch-device` class from `initTouchCompat()`).
- Primary actions (tap anvil, buy, ascend) must work from a single tap.

### 2D canvas — discrete actions (jump, shoot, aim)

**Reference:** `meerkat/` (`pointerdown` on canvas → jump), `maze/` (virtual D-pad + swipe)

- Map touch to the same input path as keyboard (`simulateKeyPress`, shared `inputs` object, etc.).
- For movement: on-screen D-pad **or** swipe-to-move (maze uses both D-pad buttons and swipe).
- D-pad buttons: `touchstart` + `mousedown`, `preventDefault`, `touch-action: none`.

### 2D canvas — aim + fire (peggle, gorillas, nibbles)

**Reference:** `peggle/` (`touch-action: none` on canvas; aim follows pointer/touch position)

- Track `pointermove` / `touchmove` for aim; `pointerdown` or `touchend` to fire.
- Do not rely on hover-only UI.

### 3D — pointer lock (FPS, parkour, grapple)

Pointer lock often fails on mobile browsers. **Provide a touch fallback:**

**Reference:** `drone/` (dual virtual joysticks + `@media (pointer: coarse)`)

- Detect coarse pointer: `matchMedia("(pointer: coarse)")` or `(hover: none) and (pointer: coarse)`.
- Virtual joysticks: left stick move/throttle, right stick look/aim (see `drone/drone-game.js` `setupJoystick`).
- Use `touch-action: none` on joystick bases; `{ passive: false }` + `preventDefault` on touchmove when steering.
- Add touch-only action buttons (jump, fire, use) ≥ 44×44 px.
- Prefer **Pointer Events** (`pointerdown`/`pointermove`) where one handler covers mouse + touch; use **touch events** for multi-touch joysticks (two simultaneous sticks).

**Lobby reference:** `arcade-3d.js` — virtual joystick + drag-to-look when pointer lock unavailable.

Games that still lack full touch (audit targets): `parkour/`, `shooter/`, `grapple/` — new work must add controls, not leave “desktop only” messages.

## Input implementation rules

1. **One code path** — touch and keyboard should feed the same `inputs` / handler functions (`readInputs()` in drone is the model).
2. **No double fire** — see `bindTap()` in `clicker/game.js`; never attach bare `click` and `touchstart` without guarding.
3. **preventDefault** on game surface touch when scrolling would steal input (`passive: false`).
4. **No 300 ms tap delay** — `touch-action: manipulation` on buttons; avoid `:hover`-only affordances.
5. **Audio / pointer lock** — first user gesture (`pointerdown`) may unlock AudioContext or start the game; do not require keyboard.

## Audit existing games

| Game | Touch status | Notes |
|------|--------------|-------|
| clicker | ✓ Full | `data-touch-compatible`, `bindTap` |
| drone | ✓ Full | Dual joysticks |
| maze | ✓ Full | D-pad + swipe |
| meerkat | ✓ Partial | Tap to jump; no on-screen move buttons |
| peggle | ✓ Partial | Canvas touch-action; verify aim/fire |
| gorillas | ⚠ Review | Add touch aim/fire if missing |
| nibbles | ⚠ Review | Arrow keys only — needs swipe or D-pad |
| parkour | ✗ Gap | Shows “Best on desktop” — needs touch controls |
| shooter | ✗ Gap | Pointer lock FPS — needs touch look + fire |
| grapple | ✗ Gap | Pointer lock — needs touch fallback |
| meerkat-tycoon | ⚠ Review | UI game — ensure tap targets |

When fixing gaps, follow the closest reference implementation above.

## Common mistakes

- Viewport missing `viewport-fit=cover` → content under iPhone notch/home bar.
- Only `click` listeners → 300 ms delay or missed taps on iOS.
- `touchstart` + `click` both firing → double jump / double purchase.
- Virtual controls hidden on desktop but forget `@media (pointer: coarse) { display: block }`.
- Joystick uses `pointerdown` with `setPointerCapture` for **two** sticks — breaks; use touch identifiers per stick (drone pattern).
- Announcing “desktop only” instead of implementing touch controls.

## Definition of done

A game is touch-compatible when a player on a phone can complete a full run (start → play → finish/restart) using only touch, with readable UI and no required keyboard or mouse.
