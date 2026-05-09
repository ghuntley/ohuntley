"""Nibbles bot.

Strategy:

* The game's IIFE keeps its state private, so we monkey-patch its
  ``addEventListener`` for ``keydown`` to expose a snapshot of (snake, food,
  walls) every tick. The patch is light: we just wrap the original handler
  and additionally publish state.
* Easier hook: also wrap ``window.addEventListener`` so we can intercept the
  game's keydown handler. But the cleanest exposure is to override
  ``Uint8Array`` walls + ``snake`` access by re-implementing the playfield
  state mirror inside the bot using only what's externally observable
  (canvas pixels + score DOM).

Because re-implementing the maze/food readers from canvas pixels is messy,
we go with a simpler trick: we let the bot drive the game blind (greedy
direction toward the food), and we extract food + snake by reading the
canvas's ``ImageData`` once per tick.

Pixel codes (matching ``draw()`` in nibbles/game.js):
  background  #0000aa
  walls       #5555aa
  snake       #00ffff
  food digit  #ffff55 (yellow text glyph)
"""

SLUG = "nibbles"
TITLE = "NIBBLES — auto-pilot"
PATH = "/nibbles/"


# Forces deterministic-ish play: starts a game on load and exposes a
# function we can poll for the snake / food / walls grid by reading the
# offscreen canvas.
INIT_SCRIPT = r"""
window.__BOT__ = window.__BOT__ || {};
window.__BOT__.nibbles = {};

(function () {
  const COLS = 80;
  const ROWS = 50;
  const CELL = 8;

  function rgbAt(data, x, y, w) {
    const i = (y * w + x) * 4;
    return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
  }

  // Sample each grid cell at the centre pixel.
  window.__BOT__.nibbles.scan = function () {
    const cv = document.getElementById("gameCanvas");
    if (!cv) return null;
    const ctx = cv.getContext("2d");
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const w = cv.width;
    const walls = new Uint8Array(COLS * ROWS);
    const snake = new Uint8Array(COLS * ROWS);
    let food = null;
    let head = null;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cx = x * CELL + 4;
        const cy = y * CELL + 4;
        const c = rgbAt(img, cx, cy, w);
        if (c === 0x5555aa) walls[y * COLS + x] = 1;
        else if (c === 0x00ffff) {
          snake[y * COLS + x] = 1;
          // Head cells have zero padding (full 8x8 fill); body cells
          // have 1px padding (only inner 6x6 is cyan). Sample the cell
          // border at (x*CELL+0, y*CELL+0) — only the head will have
          // cyan there.
          const corner = rgbAt(img, x * CELL, y * CELL, w);
          if (corner === 0x00ffff) head = { x, y };
        }
      }
    }
    // Food digits are drawn as yellow text — sample several offsets per cell.
    for (let y = 1; y < ROWS - 1 && !food; y++) {
      for (let x = 1; x < COLS - 1 && !food; x++) {
        if (walls[y * COLS + x] || snake[y * COLS + x]) continue;
        const off = [
          [3, 3],
          [4, 4],
          [5, 4],
          [4, 5],
        ];
        for (const [dx, dy] of off) {
          const c = rgbAt(img, x * CELL + dx, y * CELL + dy, w);
          // 0xffff55 plus anti-aliased neighbours
          if (((c >> 16) & 0xff) > 200 && ((c >> 8) & 0xff) > 200 && (c & 0xff) < 120) {
            food = { x, y };
            break;
          }
        }
      }
    }
    return { walls: Array.from(walls), snake: Array.from(snake), food, head, COLS, ROWS };
  };
})();
"""


# A reference implementation of nibbles' grid + a tiny BFS in Python that
# the bot drives. We re-use the game's keyboard interface (Arrow keys).
def play(page) -> int:
    page.evaluate("window.__BOT__.title('NIBBLES — booting')")
    page.evaluate("document.getElementById('gameCanvas').focus()")
    page.keyboard.press("Space")
    page.wait_for_timeout(250)

    last_dir = 1  # right (initial direction)
    DX = [0, 1, 0, -1]
    DY = [-1, 0, 1, 0]
    KEY = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]

    last_score = 0
    idle_ticks = 0
    last_head = None

    deadline = page.evaluate("performance.now()") + 90_000

    while True:
        if page.evaluate("performance.now()") > deadline:
            break

        scan = page.evaluate("window.__BOT__.nibbles.scan()")
        if not scan:
            break
        food = scan.get("food")
        head = scan.get("head")
        walls = scan["walls"]
        snake_grid = scan["snake"]
        cols = scan["COLS"]
        rows = scan["ROWS"]

        # Game-over detection: the overlay paints a black rectangle over
        # the playfield, which obliterates the cyan snake. If we cannot
        # find the snake or head for a few ticks, exit.
        if head is None or sum(snake_grid) == 0:
            idle_ticks += 1
            if idle_ticks > 12:
                break
            page.wait_for_timeout(110)
            continue
        idle_ticks = 0

        if last_head is not None and head == last_head:
            # The game hasn't ticked yet (we polled too fast). Wait a bit.
            page.wait_for_timeout(70)
            continue
        last_head = head

        head_x, head_y = head["x"], head["y"]

        if food is None:
            d = _safe_direction(walls, snake_grid, cols, rows, head_x, head_y, last_dir)
        else:
            path = _bfs(walls, snake_grid, cols, rows, (head_x, head_y), (food["x"], food["y"]))
            if path and len(path) >= 2:
                nx, ny = path[1]
                d = _dir_for(head_x, head_y, nx, ny)
            else:
                d = _safe_direction(walls, snake_grid, cols, rows, head_x, head_y, last_dir)

        # Don't 180.
        if (d + 2) % 4 == last_dir:
            d = _safe_direction(walls, snake_grid, cols, rows, head_x, head_y, last_dir)

        page.keyboard.press(KEY[d])
        last_dir = d

        # Read score from HUD.
        score_text = page.evaluate(
            "() => document.getElementById('scoreVal')?.textContent"
        )
        try:
            score = int(score_text)
        except Exception:
            score = last_score
        if score != last_score:
            last_score = score
            page.evaluate("s => window.__BOT__.score(String(s))", str(score))

        # Sleep until next game tick (game starts at ~100ms, ramps faster
        # at higher levels). 95ms keeps us in step.
        page.wait_for_timeout(95)

    final_text = page.evaluate(
        "() => document.getElementById('scoreVal')?.textContent || '0'"
    )
    try:
        return int(final_text)
    except Exception:
        return 0


def _dir_for(hx, hy, nx, ny) -> int:
    if nx == hx + 1:
        return 1
    if nx == hx - 1:
        return 3
    if ny == hy + 1:
        return 2
    if ny == hy - 1:
        return 0
    return 1


def _safe_direction(walls, snake_grid, cols, rows, hx, hy, last_dir) -> int:
    DX = [0, 1, 0, -1]
    DY = [-1, 0, 1, 0]
    for offset in (0, 1, -1, 2):
        d = (last_dir + offset) % 4
        nx = hx + DX[d]
        ny = hy + DY[d]
        if 0 <= nx < cols and 0 <= ny < rows:
            i = ny * cols + nx
            if not walls[i] and not snake_grid[i]:
                return d
    return last_dir


def _bfs(walls, snake_grid, cols, rows, start, goal):
    sx, sy = start
    gx, gy = goal
    if not (0 <= sx < cols and 0 <= sy < rows):
        return None
    if walls[sy * cols + sx]:
        return None
    seen = bytearray(cols * rows)
    parent = {(sx, sy): None}
    q = [(sx, sy)]
    seen[sy * cols + sx] = 1
    DX = [0, 1, 0, -1]
    DY = [-1, 0, 1, 0]
    while q:
        x, y = q.pop(0)
        if (x, y) == (gx, gy):
            break
        for d in range(4):
            nx = x + DX[d]
            ny = y + DY[d]
            if not (0 <= nx < cols and 0 <= ny < rows):
                continue
            i = ny * cols + nx
            if seen[i]:
                continue
            if walls[i]:
                continue
            # The snake body is impassable — but ignore the head's own cell
            # in case our tracked head desyncs from the visual head.
            if snake_grid[i] and (nx, ny) != (sx, sy) and (nx, ny) != (gx, gy):
                continue
            seen[i] = 1
            parent[(nx, ny)] = (x, y)
            q.append((nx, ny))
    if (gx, gy) not in parent:
        return None
    # Reconstruct.
    path = []
    cur = (gx, gy)
    while cur is not None:
        path.append(cur)
        cur = parent[cur]
    path.reverse()
    return path
