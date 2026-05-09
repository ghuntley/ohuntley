"""Peggle-ish bot.

The game keeps state inside an IIFE in peggle/game.js. We can't read it
directly, but we *can* read the canvas pixels to find pegs and the launcher
position is fixed. Strategy:

1. Sample the canvas, find every peg by detecting the bright dot colours.
2. For the orange peg (priority target) and a couple of high-density
   clusters, simulate the ball's flight using the same physics constants
   the game uses (gravity, launch speed, etc.) and pick the angle that
   knocks down the most pegs (with a big bonus for the orange one).
3. Move the mouse to that angle and click to fire. Wait for the ball to
   settle, repeat until the run finishes (HUD ``shotsLeft`` -> 0 or all
   pegs cleared).
"""

import math

SLUG = "peggle"
TITLE = "PEGGLE-ISH — aim assist"
PATH = "/peggle/"

INIT_SCRIPT = "window.__BOT__ = window.__BOT__ || {};"

# Constants mirrored from peggle/game.js (kept in sync manually).
W, H = 700, 920  # canvas size — looked up below at runtime to confirm
LAUNCH_X_FRAC = 0.5
LAUNCH_Y = 46
BALL_R = 7
PEG_R = 11
GRAVITY = 920.0
LAUNCH_SPEED = 520.0
BUCKET_H = 38
MAX_DT = 1 / 30


def play(page) -> int:
    page.evaluate("window.__BOT__.title('PEGGLE — aiming')")
    page.wait_for_selector("#game")
    geom = page.evaluate(
        "() => { const c = document.getElementById('game'); return { w: c.width, h: c.height }; }"
    )
    cw, ch = geom["w"], geom["h"]
    launch_x = cw * LAUNCH_X_FRAC
    bucket_top = ch - BUCKET_H

    bbox = page.locator("#game").bounding_box()
    if not bbox:
        return 0

    last_score = 0
    deadline = page.evaluate("performance.now()") + 90_000

    for shot_idx in range(40):  # cap shots; game ends when shotsLeft=0
        if page.evaluate("performance.now()") > deadline:
            break
        shots_left = _read_int(page, "shotsVal")
        if shots_left == 0:
            break
        pegs = _scan_pegs(page, cw, ch, bucket_top)
        if not pegs:
            # No pegs visible — wait a frame, the game might be between
            # levels (1 second pause).
            page.wait_for_timeout(700)
            continue

        target_angle = _pick_angle(pegs, launch_x, bucket_top)
        # Convert angle (degrees from straight down, +ve = right) to a
        # mouseX/mouseY pair the game can read from the canvas.
        rad = math.radians(target_angle)
        # The game derives the aim from (mouseX - launch.x, mouseY - launch.y).
        # We pick a point 220px below the launcher rotated by target_angle.
        aim_dx = math.sin(rad) * 220
        aim_dy = math.cos(rad) * 220 + 30  # always below
        # Move mouse over canvas at that aim point.
        page.mouse.move(
            bbox["x"] + (launch_x + aim_dx) * (bbox["width"] / cw),
            bbox["y"] + (LAUNCH_Y + aim_dy) * (bbox["height"] / ch),
        )
        page.wait_for_timeout(50)
        page.mouse.click(
            bbox["x"] + (launch_x + aim_dx) * (bbox["width"] / cw),
            bbox["y"] + (LAUNCH_Y + aim_dy) * (bbox["height"] / ch),
        )

        # Wait for the shot to settle: poll shotsLeft until it changes
        # again or 5 seconds pass.
        start = page.evaluate("performance.now()")
        while page.evaluate("performance.now()") - start < 6500:
            cur = _read_int(page, "shotsVal")
            score = _read_int(page, "scoreVal")
            page.evaluate("s => window.__BOT__.score(s)", str(score))
            last_score = max(last_score, score)
            if cur != shots_left:
                # The shot resolved.
                break
            page.wait_for_timeout(120)

    return _read_int(page, "scoreVal")


def _read_int(page, elem_id: str) -> int:
    t = page.evaluate(
        f"() => document.getElementById('{elem_id}')?.textContent"
    )
    try:
        return int(t)
    except Exception:
        return 0


def _scan_pegs(page, cw: int, ch: int, bucket_top: float):
    """Return list of (x, y, kind) where kind is 'orange'|'green'|'purple'|'blue'."""
    raw = page.evaluate(
        r"""
        ([cw, ch, bucketTop]) => {
          const cv = document.getElementById('game');
          const ctx = cv.getContext('2d');
          const img = ctx.getImageData(0, 0, cw, ch).data;
          const seen = new Uint8Array(cw * ch);
          const pegs = [];
          // Approximate peg colours in the rendered image (after glow).
          // Targets:
          //   blue   #40c4ff
          //   green  #69f0ae
          //   purple #b388ff
          //   orange #ff9100
          function classify(r, g, b) {
            if (r > 200 && g < 160 && b < 100) return 'orange';
            if (r > 150 && g > 220 && b > 150) return 'green';
            if (r > 150 && g < 160 && b > 220) return 'purple';
            if (r < 120 && g > 170 && b > 220) return 'blue';
            return null;
          }
          // Coarse scan, every 3px.
          for (let y = 50; y < bucketTop - 4; y += 3) {
            for (let x = 4; x < cw - 4; x += 3) {
              const i = (y * cw + x) * 4;
              const k = classify(img[i], img[i + 1], img[i + 2]);
              if (!k) continue;
              if (seen[y * cw + x]) continue;
              // Flood-fill the peg blob to extract its centre.
              let sx = 0, sy = 0, n = 0;
              const stack = [[x, y]];
              seen[y * cw + x] = 1;
              while (stack.length) {
                const [px, py] = stack.pop();
                sx += px; sy += py; n++;
                for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                  const nx = px + dx, ny = py + dy;
                  if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
                  if (seen[ny * cw + nx]) continue;
                  const j = (ny * cw + nx) * 4;
                  const k2 = classify(img[j], img[j + 1], img[j + 2]);
                  if (k2 === k) {
                    seen[ny * cw + nx] = 1;
                    stack.push([nx, ny]);
                  }
                }
              }
              if (n < 12) continue; // ignore noise
              pegs.push({ x: sx / n, y: sy / n, kind: k });
            }
          }
          return pegs;
        }
        """,
        [cw, ch, bucket_top],
    )
    return raw or []


def _pick_angle(pegs, launch_x: float, bucket_top: float) -> float:
    """Return aim angle in degrees (0 = straight down, +ve = right)."""
    best_score = -1.0
    best_angle = 0.0
    # Bias toward the orange peg if present.
    has_orange = any(p["kind"] == "orange" for p in pegs)

    for angle_deg in range(-78, 79, 2):
        sim_score = _simulate(angle_deg, pegs, launch_x, bucket_top, with_orange=has_orange)
        if sim_score > best_score:
            best_score = sim_score
            best_angle = angle_deg
    return float(best_angle)


def _simulate(angle_deg: float, pegs, launch_x: float, bucket_top: float, with_orange: bool) -> float:
    """Lightweight ballistic sim: count pegs hit if ball is fired at angle."""
    rad = math.radians(angle_deg)
    dx = math.sin(rad)
    dy = math.cos(rad)
    if dy < 0.08:
        dy = 0.08
    norm = math.hypot(dx, dy)
    dx /= norm
    dy /= norm
    x = launch_x + dx * (BALL_R + 4)
    y = LAUNCH_Y + dy * (BALL_R + 4)
    vx = dx * LAUNCH_SPEED
    vy = dy * LAUNCH_SPEED

    # Track which pegs are still alive.
    alive = [True] * len(pegs)

    score = 0.0
    h = 1 / 240  # 4ms steps
    for _ in range(int(6.0 / h)):  # max 6 seconds of flight
        vy += GRAVITY * h
        x += vx * h
        y += vy * h
        # Walls.
        if x < BALL_R:
            x = BALL_R
            vx = abs(vx) * 0.88
        elif x > 700 - BALL_R:
            x = 700 - BALL_R
            vx = -abs(vx) * 0.88
        if y < BALL_R:
            y = BALL_R
            vy = abs(vy) * 0.82
        # Peg collision.
        for i, peg in enumerate(pegs):
            if not alive[i]:
                continue
            ddx = x - peg["x"]
            ddy = y - peg["y"]
            d = math.hypot(ddx, ddy)
            minD = BALL_R + PEG_R
            if d < minD and d > 1e-6:
                alive[i] = False
                if peg["kind"] == "orange":
                    score += 1500
                elif peg["kind"] == "purple":
                    score += 75
                elif peg["kind"] == "green":
                    score += 50
                else:
                    score += 25
                # Reflect ball.
                nx = ddx / d
                ny = ddy / d
                overlap = minD - d
                x += nx * overlap
                y += ny * overlap
                vdot = vx * nx + vy * ny
                if vdot < 0:
                    vx -= 2 * vdot * nx
                    vy -= 2 * vdot * ny
                vx *= 0.91
                vy *= 0.91
        # Bucket / floor.
        if y + BALL_R > bucket_top + 6 and vy > 0:
            break
        if y - BALL_R > 920:
            break
    # Penalise if we didn't even reach the peg field.
    if not any(not a for a in alive):
        score -= 100
    return score
