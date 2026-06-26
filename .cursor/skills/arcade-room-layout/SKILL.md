---
name: arcade-room-layout
description: >-
  Funland Arcade 3D lobby room layout: max 5 games per room, extra rooms spawned
  automatically. Use when adding games to the lobby, changing cabinet layout,
  room count, doorways, or editing arcade-3d.js room building.
---

# Arcade Room Layout (5 Games per Room)

The 3D lobby splits `window.ARCADE_GAMES` into **rooms of at most 5 cabinets**. When a 6th game is registered, a **new room** is created behind the previous one along **−Z**. The player walks through neon doorways to reach later rooms.

## Rules

| Rule | Value |
|------|-------|
| Max cabinets per room | **5** (`GAMES_PER_ROOM` in `arcade-3d.js`) |
| Room footprint | `VIBE.roomW` × `VIBE.roomD` (15 × 32 m) |
| Room spacing | Each room offset by `−roomIndex * roomD` on Z |
| Registration order | Games fill room 1, then room 2, etc. (order in `ARCADE_GAMES`) |
| Prize counter | **Room 1 only** (entrance / front wall) |
| Scoreboard | Per room — shows that room's games only |

## Adding a game (agent checklist)

1. Append to `window.ARCADE_GAMES` in `index.html` (and sync `DEFAULT_GAMES`).
2. **Do not** manually create rooms — `chunkGames()` handles splitting.
3. If total games cross 5 / 10 / 15 … a new room appears automatically.
4. Precache the game in `service-worker.js` (see `register-arcade-game` skill).

Example with 11 games:

| Room | Games (slugs) |
|------|----------------|
| 1 | maze, meerkat, meerkat-tycoon, gorillas, nibbles |
| 2 | grapple, parkour, peggle, shooter, clicker |
| 3 | drone |

## Implementation map (`arcade-3d.js`)

| Symbol | Role |
|--------|------|
| `GAMES_PER_ROOM` | Constant `5` — change only with deliberate layout redesign |
| `chunkGames(games, perRoom?)` | Splits game array into room chunks |
| `buildRoom(container, roomW, roomD, games, opts)` | Builds one room into a `THREE.Group` |
| `opts.isFirst` | Front wall + entrance decor + vending machines |
| `opts.isLast` | Solid back wall (vs doorway) |
| `opts.roomIndex` / `totalRooms` | Room labels |
| `layoutCabinetSlots(n, roomW, roomD)` | Positions up to 5 cabinets inside one room |
| `addBackWallDoorway()` | Neon arch + "MORE GAMES" when not last room |
| `addRoomEntrySign()` | "ROOM N" sign on rooms 2+ |
| `clampPlayer(..., roomCount)` | Player bounds across all rooms |

## Changing the limit

To change max games per room:

1. Update `GAMES_PER_ROOM` in `arcade-3d.js`.
2. Verify `layoutCabinetSlots()` still fits visually (designed for ≤5).
3. Update this skill and the game table examples.
4. Bump `service-worker.js` `VERSION` if precache list changed.

## Common mistakes

- Putting all games in one room manually — use `ARCADE_GAMES` order only.
- Expecting prize counter in every room — it stays in room 1.
- Forgetting per-room scoreboards only list that room's slugs.
- Adding a 6th game without registering it in `ARCADE_GAMES` — room won't appear.

## Related skills

- `.cursor/skills/register-arcade-game/SKILL.md` — lobby registration + precache
- `.cursor/skills/mobile-touch-compatibility/SKILL.md` — touch controls per game
