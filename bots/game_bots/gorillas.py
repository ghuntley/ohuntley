"""Gorillas bot.

The game uses top-level ``let`` declarations in a classic <script>, so the
state is in the script's lexical environment but not on ``window``. Page
``evaluate`` calls cannot read those bindings directly. Instead we ask the
game itself for everything we need by reading the rendered HUD + DOM
inputs (angle/power) and reading the on-canvas player positions via pixel
sampling. The ``sampleTrajectoryPreview`` function is also referenced by
the in-page DOM (the form fires the same physics), so we just iterate
angle/power until one of our test shots draws a preview that ends close
to the opponent's bounding box.

Strategy per round:
  1. Detect both gorillas by sampling the canvas for the white selection
     box that's drawn around each player.
  2. Try a grid of (angle, power) combos, evaluating where each shot would
     land via our own ballistic sim that mirrors the in-game physics
     (gravity 0.24 px/frame², wind acceleration ~ wind*0.03).
  3. Pick the (angle, power) that lands inside the opponent's box.
  4. Fill in the form, click Fire, wait for the result. If we hit, the
     game increments scores[winner] and starts a new round.
"""

import math
import random

SLUG = "gorillas"
TITLE = "GORILLAS — ballistics"
PATH = "/gorillas/"

INIT_SCRIPT = "window.__BOT__ = window.__BOT__ || {};"


def play(page) -> int:
    page.evaluate("window.__BOT__.title('GORILLAS — calibrating')")
    page.wait_for_selector("#gameCanvas")
    page.wait_for_selector("#angleInput")

    rounds_played = 0
    last_score = "0 - 0"
    deadline = page.evaluate("performance.now()") + 110_000

    while rounds_played < 6:
        if page.evaluate("performance.now()") > deadline:
            break
        # Wait a moment for the round to render and HUD to settle.
        page.wait_for_timeout(250)
        info = _read_round(page)
        if info is None:
            page.wait_for_timeout(400)
            continue

        # Solve for angle/power; pick the one that hits the opponent.
        plan = _solve_shot(info)
        if plan is None:
            # Fall back to a random angle nudged toward the opponent.
            plan = _fallback_shot(info)

        angle, power = plan
        # Fill the inputs and fire.
        page.evaluate(
            "([a, p]) => { document.getElementById('angleInput').value = String(a);"
            "document.getElementById('powerInput').value = String(p); }",
            [int(round(angle)), int(round(power))],
        )
        page.locator("#fireBtn").click()
        page.evaluate(
            "msg => window.__BOT__.title(msg)",
            f"GORILLAS · throw @ {int(round(angle))}° / {int(round(power))}",
        )

        # Wait for the round to resolve. The game either: hits (awards
        # score and schedules generateRound after 1200ms) or misses /
        # destroys a building (swaps turn). We wait until the score string
        # changes OR a few seconds pass.
        round_start = page.evaluate("performance.now()")
        while page.evaluate("performance.now()") - round_start < 7000:
            score_label = page.evaluate(
                "() => document.getElementById('scoreLabel')?.textContent"
            )
            page.evaluate(
                "s => window.__BOT__.score(s)", score_label or last_score
            )
            if score_label and score_label != last_score:
                last_score = score_label
                rounds_played += 1
                # Wait for the next round to fully render.
                page.wait_for_timeout(1500)
                break
            # If a miss happened, the form was re-enabled and turn swapped;
            # we just keep firing.
            disabled = page.evaluate(
                "() => document.getElementById('fireBtn')?.disabled"
            )
            if not disabled:
                # Not waiting for projectile; turn has been handed back.
                break
            page.wait_for_timeout(120)

    final = page.evaluate(
        "() => document.getElementById('scoreLabel')?.textContent || '0 - 0'"
    )
    # Convert the "1 - 2" string into a simple integer (sum × 100).
    try:
        a, b = [int(p.strip()) for p in final.split("-")]
        return (a + b) * 100
    except Exception:
        return 0


def _read_round(page):
    """Detect player gorilla positions by sampling the canvas, plus read wind."""
    info = page.evaluate(
        r"""
        () => {
          const cv = document.getElementById('gameCanvas');
          if (!cv) return null;
          const ctx = cv.getContext('2d');
          const W = cv.width, H = cv.height;
          // Player rectangles are highlighted by drawPlayers with white
          // outlines. We sample columns to find the topmost roof for each
          // building strip; the gorillas sit on top of them. But it's
          // simpler to fish the highlight stroke: scan for nearly-pure-white
          // rectangle outlines.
          const img = ctx.getImageData(0, 0, W, H).data;
          const isWhite = (i) => img[i] > 230 && img[i + 1] > 230 && img[i + 2] > 230;
          const isStrong = (i) => img[i] > 170 && img[i + 1] > 170 && img[i + 2] > 170;

          // Find connected almost-white pixels (the active player has a
          // solid white box; the other has a 35% white box).
          const seen = new Uint8Array(W * H);
          const blobs = [];
          const minSize = 20;
          for (let y = 0; y < H; y += 2) {
            for (let x = 0; x < W; x += 2) {
              const i = (y * W + x) * 4;
              if (!isStrong(i)) continue;
              if (seen[y * W + x]) continue;
              // BFS over white-ish pixels.
              let minX = x, maxX = x, minY = y, maxY = y, n = 0;
              const stack = [[x, y]];
              seen[y * W + x] = 1;
              while (stack.length) {
                const [px, py] = stack.pop();
                n++;
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
                for (const [dx, dy] of [[2,0],[-2,0],[0,2],[0,-2]]) {
                  const nx = px + dx, ny = py + dy;
                  if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                  if (seen[ny * W + nx]) continue;
                  const j = (ny * W + nx) * 4;
                  if (isStrong(j)) {
                    seen[ny * W + nx] = 1;
                    stack.push([nx, ny]);
                  }
                }
              }
              const w = maxX - minX, h = maxY - minY;
              if (n < minSize) continue;
              // Player highlight boxes are roughly square (w ~ h, both 50-80px),
              // and bigger than star pixels (which are 2x2).
              if (w > 30 && h > 30 && w < 120 && h < 120) {
                blobs.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, w, h });
              }
            }
          }
          // Sort by intensity proxy (size).
          blobs.sort((a, b) => (a.x - b.x));
          const wind = document.getElementById('windLabel')?.textContent || '0';
          const turnName = document.getElementById('turnLabel')?.textContent || '';
          return {
            W, H, blobs, wind,
            turnName,
            scoreLabel: document.getElementById('scoreLabel')?.textContent || '',
          };
        }
        """
    )
    if not info:
        return None
    blobs = info.get("blobs") or []
    if len(blobs) < 2:
        return None
    left, right = blobs[0], blobs[-1]
    # Parse wind "X mph" → number.
    try:
        wind_mph = int(info["wind"].split()[0])
    except Exception:
        wind_mph = 0
    # The shooter is whichever player matches turnName; gorillas/game.js names
    # them "Player 1" (left) and "Player 2" (right).
    is_left_turn = "1" in (info["turnName"] or "")
    return {
        "W": info["W"],
        "H": info["H"],
        "left": left,
        "right": right,
        "wind": wind_mph / 100.0,  # back to physical units
        "is_left_turn": is_left_turn,
    }


def _solve_shot(info):
    """Brute-force search across (angle, power) for a shot that hits."""
    shooter = info["left"] if info["is_left_turn"] else info["right"]
    target = info["right"] if info["is_left_turn"] else info["left"]
    wind = info["wind"]
    W = info["W"]
    H = info["H"]
    # Half-height of the player box approximates sprite height.
    half_h = max(20, target["h"] / 2 + 4)
    half_w = max(15, target["w"] / 2 + 4)

    best = None
    best_dist = 1e9
    for angle in range(20, 86, 2):
        for power in range(35, 121, 3):
            land = _simulate(
                shooter["x"],
                shooter["y"] - shooter["h"] / 2 - 4,
                angle,
                power,
                info["is_left_turn"],
                wind,
                W,
                H,
                target["x"],
                target["y"],
                half_w,
                half_h,
            )
            if land is None:
                continue
            lx, ly, hit = land
            if hit:
                # Tighter dead-centre is better.
                dist = abs(lx - target["x"]) + abs(ly - target["y"])
                if dist < best_dist:
                    best_dist = dist
                    best = (angle, power)
    return best


def _fallback_shot(info):
    # Aim roughly toward the opponent with moderate power.
    shooter = info["left"] if info["is_left_turn"] else info["right"]
    target = info["right"] if info["is_left_turn"] else info["left"]
    dx = abs(target["x"] - shooter["x"])
    base_power = max(45, min(110, 35 + dx * 0.18))
    return (random.randint(40, 70), base_power)


def _simulate(
    sx,
    sy,
    angle_deg,
    power,
    is_left_turn,
    wind,
    W,
    H,
    tgt_x,
    tgt_y,
    half_w,
    half_h,
):
    """Mirror gorillas/game.js stepProjectile."""
    G = 0.24
    world_angle = angle_deg if is_left_turn else (180 - angle_deg)
    rad = math.radians(world_angle)
    speed = max(5.0, min(130.0, power)) * 0.15
    vx = math.cos(rad) * speed
    vy = -math.sin(rad) * speed
    x, y = sx, sy
    for _ in range(800):
        vx += wind * 0.03
        vy += G
        x += vx
        y += vy
        if x < -20 or x > W + 20 or y > H + 20 or y < -80:
            return (x, y, False)
        # Player hit?
        if abs(x - tgt_x) <= half_w and abs(y - tgt_y) <= half_h:
            return (x, y, True)
    return (x, y, False)
