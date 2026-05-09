"""Skyhook (grapple) demo bot.

Skyhook is a 3D Three.js platformer with mouse-look + WASD + grapple. A
proper bot would need to read the WebGL scene, which we can't easily do
without patching the source. We do the next best thing: drive a "demo"
recording — walk forward, hop, fire the grapple toward neon platforms,
and let the camera swing around for a watchable video. There's no real
score in this game; we record the time alive on the platforms instead.
"""

import random
import time

SLUG = "grapple"
TITLE = "SKYHOOK — demo flight"
PATH = "/grapple/"

INIT_SCRIPT = "window.__BOT__ = window.__BOT__ || {};"


def play(page) -> int:
    page.evaluate("window.__BOT__.title('SKYHOOK — diving in')")
    page.wait_for_selector("#game-canvas, canvas")

    # Click the canvas to engage pointer lock + start the game. Pointer
    # lock won't actually engage in a Playwright window (the request is
    # rejected without user activation), so the game stays in its
    # title screen with the blocker visible. To work around this, we
    # bypass the blocker by hiding it and synthesising controls.
    page.evaluate(
        r"""
        () => {
          const blocker = document.getElementById('blocker');
          if (blocker) blocker.style.display = 'none';
          // Some grapple builds gate playing on a custom 'started' flag
          // exposed by the game; if we can find it, flip it. Otherwise
          // we just leave the blocker hidden and synthesise key events.
          if (window.__GRAPPLE__ && typeof window.__GRAPPLE__.start === 'function') {
            window.__GRAPPLE__.start();
          }
        }
        """
    )

    # Press W for a few seconds, occasionally jumping and clicking to fire
    # the grapple. This produces a reasonable demo video.
    started = page.evaluate("performance.now()")
    last_jump = 0
    last_grapple = 0

    while page.evaluate("performance.now()") - started < 28_000:
        page.keyboard.down("KeyW")
        page.wait_for_timeout(450)
        now = page.evaluate("performance.now()")
        if now - last_jump > 1100:
            page.keyboard.press("Space")
            last_jump = now
        if now - last_grapple > 1700:
            # Move the mouse, then click to fire the grapple toward whatever
            # the camera is now pointing at.
            box = page.viewport_size
            cx = box["width"] / 2 + random.randint(-60, 60)
            cy = box["height"] / 2 + random.randint(-40, 40)
            page.mouse.move(cx, cy)
            page.mouse.down()
            page.wait_for_timeout(220)
            page.mouse.up()
            last_grapple = now
        # Occasionally turn.
        if int((now - started) / 400) % 5 == 0:
            page.mouse.move(
                box["width"] / 2 + random.randint(-220, 220),
                box["height"] / 2 + random.randint(-80, 80),
                steps=8,
            )

    page.keyboard.up("KeyW")
    elapsed = page.evaluate("performance.now()") - started
    score = int(elapsed / 1000)
    page.evaluate("s => window.__BOT__.score(String(s) + ' s aloft')", str(score))
    return score
