"""Per-game bots for the Funland Arcade auto-player.

Each bot module exposes:

    SLUG: str
        Folder name under the arcade root (e.g. "nibbles").
    TITLE: str
        Friendly name used in the on-screen overlay.
    PATH: str
        URL path served by the static server (e.g. "/nibbles/").
    INIT_SCRIPT: str
        JavaScript injected before any of the page's own scripts run; usually
        used to monkey-patch the game so its internals are reachable from
        ``window.__BOT__`` and to disable persistence side effects (e.g.
        localStorage). Plain string, not f-string.
    play(page) -> int
        Drive the game via the Playwright Page object and return the final
        score the bot achieved.

The runner takes care of:
  - serving the arcade over a local HTTP origin,
  - opening the game URL in a fresh BrowserContext (so videos are isolated),
  - injecting a HUD overlay for the recording,
  - calling ``play`` and capturing the score / video.
"""

from importlib import import_module

BOT_MODULES = [
    "game_bots.nibbles",
    "game_bots.maze",
    "game_bots.peggle",
    "game_bots.gorillas",
    "game_bots.meerkat",
    "game_bots.meerkat_tycoon",
    "game_bots.grapple",
]


def load_bots():
    return [import_module(name) for name in BOT_MODULES]
