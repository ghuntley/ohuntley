"""Grid Sentinel bot — places pulse towers and sends waves."""

SLUG = "towers"
TITLE = "GRID SENTINEL — auto defender"
PATH = "/towers/"

INIT_SCRIPT = """
window.__BOT__ = window.__BOT__ || {};
window.__GRID_SENTINEL_BOT__ = true;
try { localStorage.setItem('grid-sentinel-tutorial-v1', '1'); } catch (e) {}
"""


def play(page) -> int:
    page.wait_for_selector("#game")
    page.evaluate("window.__GRID_SENTINEL__.selectMap('core-run')")
    page.evaluate("window.__GRID_SENTINEL__.begin()")
    page.wait_for_timeout(400)

    pads = page.evaluate(
        """() => {
          const gs = window.__GRID_SENTINEL__;
          const st = gs.getState();
          return [
            [1, 0], [2, 0], [7, 0], [7, 2], [7, 5], [13, 1], [13, 5], [5, 3]
          ];
        }"""
    )

    for col, row in pads:
        st = page.evaluate("() => window.__GRID_SENTINEL__.getState()")
        if st.get("gameOver") or not st.get("running"):
            break
        page.evaluate(
            "([c,r]) => window.__GRID_SENTINEL__.clickPad(c,r)",
            [col, row],
        )
        page.wait_for_timeout(120)

    deadline = page.evaluate("() => performance.now() + 120000")

    while page.evaluate("() => performance.now()") < deadline:
        st = page.evaluate("() => window.__GRID_SENTINEL__.getState()")
        score = st.get("score", 0)
        page.evaluate("s => window.__BOT__ && window.__BOT__.score(s)", str(score))
        if st.get("gameOver"):
            break
        if not st.get("waveActive") and st.get("waveIndex", 0) < 20:
            page.evaluate("() => window.__GRID_SENTINEL__.sendWave()")
        page.wait_for_timeout(350)

    return page.evaluate("() => window.__GRID_SENTINEL__.getState().score") or 0
