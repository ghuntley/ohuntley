"""Maze runner bot.

The maze game uses ``let`` at module top-level inside a classic <script>, so
its state ends up in the per-script lexical scope and not on ``window``.
We expose what we need with a small route-time JS rewrite: prepend a few
lines that hoist ``maze``, ``player``, ``cellSize``, ``rows``, ``cols`` and
``currentLevel`` onto ``window.__BOT__`` after the script runs.

We accomplish that with ``page.add_init_script`` plus a deferred reader:
since the values become visible to subsequent classic scripts, we run our
peek inside another inline ``<script>`` injected after navigation. Easier
still: we just read everything we need from the canvas pixels and HUD
elements; that's what this bot does.

Strategy: BFS to the exit from the player's current cell, send arrow keys
one at a time. The game enforces a 200 ms cooldown between moves, so we
sleep after each.
"""

SLUG = "maze"
TITLE = "MAZE RUNNER — solver"
PATH = "/maze/"

INIT_SCRIPT = r"""
window.__BOT__ = window.__BOT__ || {};
"""


def play(page) -> int:
    page.evaluate("window.__BOT__.title('MAZE RUNNER — solving')")
    page.wait_for_selector("#gameCanvas")
    # Make sure the canvas has the focus so keystrokes are received globally
    # (the maze uses document.addEventListener so window keypresses work too).
    page.focus("body")

    LEVELS_TO_PLAY = 4
    completed = 0
    best_score = 0
    deadline = page.evaluate("performance.now()") + 110_000  # ~110s safety

    while completed < LEVELS_TO_PLAY:
        if page.evaluate("performance.now()") > deadline:
            break
        plan = _plan_route(page)
        if not plan:
            # Maze couldn't be parsed — bail.
            break
        for key in plan:
            page.keyboard.press(key)
            page.wait_for_timeout(220)  # game cooldown is 200ms
            score = _read_score(page)
            page.evaluate("s => window.__BOT__.score(s)", str(score))
            if score > best_score:
                best_score = score
        # Wait for the level-complete animation + new maze generation.
        page.wait_for_timeout(1700)
        completed += 1
        page.evaluate(
            "n => window.__BOT__.title('MAZE RUNNER — level ' + n + ' cleared')",
            completed,
        )

    final = _read_score(page)
    return max(final, best_score)


def _read_score(page) -> int:
    txt = page.evaluate("() => document.getElementById('currentScore')?.textContent")
    try:
        return int(txt)
    except Exception:
        return 0


def _plan_route(page):
    """Read maze from canvas pixels, BFS, and return a list of arrow keys."""
    payload = page.evaluate(
        r"""
        () => {
          const cv = document.getElementById('gameCanvas');
          if (!cv) return null;
          const ctx = cv.getContext('2d');
          const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
          const W = cv.width, H = cv.height;
          const CELL = 16;
          const ROWS = H / CELL, COLS = W / CELL;
          const walls = new Uint8Array(ROWS * COLS);
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              // Sample the cell centre. Walls are pure black (#000), open
              // cells are white. The end marker is a coloured square but we
              // detect it via "not exactly white" too — so we sample two
              // pixels and treat as wall only if both are black.
              const x = c * CELL + CELL / 2;
              const y = r * CELL + CELL / 2;
              const i = (y * W + x) * 4;
              const isBlack = img[i] < 30 && img[i + 1] < 30 && img[i + 2] < 30;
              if (isBlack) walls[r * COLS + c] = 1;
            }
          }
          // Player position is encoded at (1,1) initially; instead of
          // sampling it we just ask the game to draw and read the player's
          // last known cell via a scan: find the brightest white circle.
          // Easier: the player always starts at (1,1) after restart; we
          // run the BFS from the visible "lit" cell — the cell the player
          // is sitting in. The player draws a circle with shadow and a
          // small white inner pip. We detect the pip: pure white at cell
          // centre but surrounded by colored ring.
          let pr = 1, pc = 1;
          for (let r = 1; r < ROWS - 1; r++) {
            for (let c = 1; c < COLS - 1; c++) {
              if (walls[r * COLS + c]) continue;
              const cx = c * CELL + CELL / 2;
              const cy = r * CELL + CELL / 2;
              const i = (cy * W + cx) * 4;
              const isPureWhite = img[i] > 240 && img[i + 1] > 240 && img[i + 2] > 240;
              if (!isPureWhite) continue;
              // Verify the surrounding ring is colourful (not pure white)
              const offs = [[3,0],[-3,0],[0,3],[0,-3]];
              let coloured = 0;
              for (const [dx, dy] of offs) {
                const j = ((cy + dy) * W + (cx + dx)) * 4;
                const r2 = img[j], g2 = img[j + 1], b2 = img[j + 2];
                if (r2 > 30 || g2 > 30 || b2 > 30) {
                  if (!(r2 > 240 && g2 > 240 && b2 > 240)) coloured++;
                }
              }
              if (coloured >= 3) { pr = r; pc = c; }
            }
          }
          const goal = { r: ROWS - 2, c: COLS - 2 };
          return { walls: Array.from(walls), ROWS, COLS, pr, pc, goal };
        }
        """
    )
    if not payload:
        return None
    walls = payload["walls"]
    ROWS = payload["ROWS"]
    COLS = payload["COLS"]
    pr = payload["pr"]
    pc = payload["pc"]
    goal = payload["goal"]
    grid = (walls, ROWS, COLS)
    return _bfs_path((pc, pr), (goal["c"], goal["r"]), grid)


def _bfs_path(start, goal, grid):
    walls, rows, cols = grid
    sx, sy = start
    gx, gy = goal
    if not (0 <= sx < cols and 0 <= sy < rows):
        return None
    if walls[sy * cols + sx]:
        # Player drawn over a wall? bail
        return None
    parent = {(sx, sy): None}
    q = [(sx, sy)]
    DX = [0, 1, 0, -1]
    DY = [-1, 0, 1, 0]
    NAMES = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]
    while q:
        x, y = q.pop(0)
        if (x, y) == (gx, gy):
            break
        for d in range(4):
            nx = x + DX[d]
            ny = y + DY[d]
            if not (0 <= nx < cols and 0 <= ny < rows):
                continue
            if walls[ny * cols + nx]:
                continue
            if (nx, ny) in parent:
                continue
            parent[(nx, ny)] = ((x, y), d)
            q.append((nx, ny))
    if (gx, gy) not in parent:
        return None
    keys = []
    cur = (gx, gy)
    while parent[cur] is not None:
        prev, d = parent[cur]
        keys.append(NAMES[d])
        cur = prev
    keys.reverse()
    return keys
