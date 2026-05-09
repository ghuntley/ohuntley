"""Meerkat Run bot.

Auto-runner platformer with a chasing falcon. The player auto-runs at a
config-defined speed; the only input is jump (Space). Strategy:

* Press Space to start a run from the menu.
* The platforms in each level are fixed and known (we mirror the layout).
  The bot looks at the player's screen-space position via canvas pixels
  to know where they are, then pre-decides jump windows for each gap.
* As a robust fallback (since the game is an ES module that does not
  expose its internals), we don't try to be optimal: we use a simple
  "if next-platform left edge is approaching, jump" heuristic by sampling
  the canvas every frame for the meerkat's bright tan colour and the
  next platform.

This produces a reasonable run-through that usually clears the first
level or two before the bird catches up. Score is read from the canvas
via OCR-free trick: there's no DOM HUD; we read the scoreBank via
window.localStorage when the run ends (the game writes the high score).
"""

SLUG = "meerkat"
TITLE = "MEERKAT RUN — auto-jump"
PATH = "/meerkat/"

INIT_SCRIPT = "window.__BOT__ = window.__BOT__ || {};"


def play(page) -> int:
    page.evaluate("window.__BOT__.title('MEERKAT RUN — booting')")
    page.wait_for_selector("#game")
    cv_box = page.locator("#game").bounding_box()
    if not cv_box:
        return 0

    # Click the canvas to focus, then start.
    page.locator("#game").click(position={"x": 50, "y": 50})
    page.keyboard.press("Space")
    page.wait_for_timeout(400)

    # The game runs at ~60fps internally. We tick every ~60ms and decide
    # whether to jump. The trigger heuristic: look at a 28×40 column 16px
    # ahead of the meerkat sprite; if the column is mostly empty (no
    # platform pixels) where the ground used to be, we're approaching a
    # gap → jump.
    deadline = page.evaluate("performance.now()") + 95_000
    last_jump_ms = 0

    while True:
        if page.evaluate("performance.now()") > deadline:
            break
        state = page.evaluate(
            r"""
            () => {
              const cv = document.getElementById('game');
              if (!cv) return null;
              const ctx = cv.getContext('2d');
              const W = cv.width, H = cv.height;
              const img = ctx.getImageData(0, 0, W, H).data;
              // Locate meerkat by tan colour ~ #c9a574.
              let mkx = 0, mky = 0, n = 0;
              for (let y = 60; y < H - 10; y += 2) {
                for (let x = 0; x < W; x += 2) {
                  const i = (y * W + x) * 4;
                  const r = img[i], g = img[i + 1], b = img[i + 2];
                  if (r > 170 && r < 230 && g > 130 && g < 180 && b > 90 && b < 140) {
                    mkx += x; mky += y; n++;
                  }
                }
              }
              if (n === 0) return null;
              mkx /= n; mky /= n;

              // Look for platform pixels (#5c4030) ahead of the meerkat.
              function platformAt(x, y) {
                const i = (y * W + x) * 4;
                const r = img[i], g = img[i + 1], b = img[i + 2];
                return r > 70 && r < 110 && g > 50 && g < 85 && b > 35 && b < 70;
              }
              // Probe column 18px ahead, scanning the next 30 rows down for
              // platform; if no hit -> gap.
              const probeX = Math.min(W - 1, Math.round(mkx) + 18);
              let groundY = -1;
              for (let y = Math.round(mky); y < H; y++) {
                if (platformAt(probeX, y)) { groundY = y; break; }
              }
              // Also look further (30px ahead) so we anticipate gaps.
              const farX = Math.min(W - 1, Math.round(mkx) + 36);
              let farGround = -1;
              for (let y = Math.round(mky); y < H; y++) {
                if (platformAt(farX, y)) { farGround = y; break; }
              }
              // Detect bird (dark silhouette behind meerkat). Just measure
              // distance to the darkest mass to the left of meerkat.
              return {
                W, H,
                mkx, mky,
                groundY,
                farGround,
                feetY: mky + 14,
              };
            }
            """
        )
        if not state:
            break
        # Detect game over: when the canvas shows the lose overlay
        # (red rectangle) — we look for a dominant red region centre.
        # Easier: when the player's tan blob disappears entirely, end.
        if state["mkx"] is None:
            break

        ground_y = state["groundY"]
        far_ground = state["farGround"]
        # Trigger jump if there's no ground in the next ~36px column.
        # Or if the ground is significantly lower (a step down — usually
        # safe to walk, but jumping early is safer in this game).
        gap_ahead = far_ground == -1
        big_drop = (
            ground_y != -1
            and far_ground != -1
            and (far_ground - ground_y) > 18
        )

        now = page.evaluate("performance.now()")
        if (gap_ahead or big_drop) and now - last_jump_ms > 280:
            page.keyboard.press("Space")
            last_jump_ms = now

        # Read high-score / score by peeking at the canvas at the corner
        # of the HUD: the score string ends with a number. We just keep
        # the bot focused; final score is read from localStorage at the
        # end of the run.
        page.wait_for_timeout(60)

    # Wait briefly so the lose / win overlay shows up.
    page.wait_for_timeout(2000)
    score = page.evaluate(
        r"""
        () => {
          try {
            const v = localStorage.getItem('meerkat-chase-highscore-v1');
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? n : 0;
          } catch (_) { return 0; }
        }
        """
    ) or 0
    page.evaluate("s => window.__BOT__.score(s)", str(score))
    return int(score)
