"""
Funland Arcade auto-player.

Walks each game in ``game_bots.BOT_MODULES``, plays it under Playwright with
video recording, and writes per-game ``.webm`` files plus a summary HTML so
you can step through the runs in a browser.

Usage:

    cd bots
    . .venv/bin/activate
    python runner.py                # play every game
    python runner.py nibbles peggle # play just these slugs
    python runner.py --headed       # show the browser while it plays
"""

from __future__ import annotations

import argparse
import http.server
import json
import shutil
import socketserver
import sys
import threading
import time
import traceback
from contextlib import contextmanager
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

from game_bots import load_bots

PROJECT_ROOT = Path(__file__).resolve().parent.parent  # the arcade site root
RECORDINGS_DIR = Path(__file__).resolve().parent / "recordings"

# 16:9 viewport — looks fine on phones and TVs when you replay the videos.
VIEWPORT = {"width": 1280, "height": 720}


class _SilentHandler(http.server.SimpleHTTPRequestHandler):
    """Same as SimpleHTTPRequestHandler but does not spam stderr."""

    def log_message(self, format, *args):  # noqa: A002 — match base API
        return

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            # The browser frequently abandons partially-loaded videos when
            # we close the page; that's fine, just keep serving.
            pass


def _make_handler_class(root: Path):
    class Handler(_SilentHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

    return Handler


@contextmanager
def static_server(root: Path):
    """Spin up a localhost-only HTTP server rooted at ``root``."""
    handler = _make_handler_class(root)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    host, port = httpd.server_address
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://{host}:{port}"
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=2)


# JS shared across every game: a small overlay banner that shows what the bot
# is doing. Injected as an init script so it appears in the recording from
# the very first frame.
COMMON_OVERLAY_JS = r"""
(function () {
  window.__BOT__ = window.__BOT__ || {};
  window.__BOT__.__lastOverlay = window.__BOT__.__lastOverlay || {};

  function ensureHost() {
    var host = document.getElementById("__bot_overlay__");
    if (host) return host;
    var parent = document.body || document.documentElement;
    if (!parent) return null;
    host = document.createElement("div");
    host.id = "__bot_overlay__";
    Object.assign(host.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      padding: "10px 14px",
      background: "linear-gradient(180deg, rgba(8,4,16,0.92), rgba(8,4,16,0.4))",
      color: "#7df9ff",
      font: "600 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      letterSpacing: "0.08em",
      textShadow: "0 0 8px rgba(0,255,238,0.55)",
      display: "flex",
      gap: "18px",
      alignItems: "center",
      borderBottom: "1px solid rgba(0,255,238,0.35)",
      whiteSpace: "nowrap",
    });
    var tag = document.createElement("span");
    tag.id = "__bot_overlay_tag__";
    tag.textContent = "AUTO PLAYER";
    tag.style.color = "#ff6eb4";
    tag.style.textShadow = "0 0 10px rgba(255,20,147,0.7)";
    var title = document.createElement("span");
    title.id = "__bot_overlay_title__";
    var score = document.createElement("span");
    score.id = "__bot_overlay_score__";
    score.style.marginLeft = "auto";
    score.style.color = "#ffe082";
    score.style.textShadow = "0 0 10px rgba(255,193,7,0.55)";
    host.appendChild(tag);
    host.appendChild(title);
    host.appendChild(score);
    parent.appendChild(host);
    return host;
  }

  window.__BOT__.setOverlay = function setOverlay(text, score) {
    var host = ensureHost();
    if (!host) return;
    if (text != null) {
      var t = document.getElementById("__bot_overlay_title__");
      if (t) t.textContent = text;
    }
    if (score != null) {
      var s = document.getElementById("__bot_overlay_score__");
      if (s) s.textContent = score;
    }
  };

  window.__BOT__.score = function score(n) {
    window.__BOT__.__lastOverlay.score = String(n);
    window.__BOT__.setOverlay(null, String(n));
  };

  window.__BOT__.title = function title(t) {
    window.__BOT__.__lastOverlay.text = t;
    window.__BOT__.setOverlay(t, null);
  };

  function attachObserver() {
    if (window.__BOT__.__observerAttached) return;
    var root = document.documentElement;
    if (!root) return;
    var obs = new MutationObserver(function () {
      if (!document.getElementById("__bot_overlay__")) {
        var last = window.__BOT__.__lastOverlay || {};
        window.__BOT__.setOverlay(last.text, last.score);
      }
    });
    obs.observe(root, { childList: true, subtree: true });
    window.__BOT__.__observerAttached = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachObserver, { once: true });
  } else {
    attachObserver();
  }
})();
"""


def run_one_bot(playwright, base_url: str, bot, headless: bool) -> dict:
    """Run a single bot and return a result dict."""
    slug = bot.SLUG
    target_dir = RECORDINGS_DIR / slug
    if target_dir.exists():
        shutil.rmtree(target_dir)
    target_dir.mkdir(parents=True)

    browser = playwright.chromium.launch(headless=headless)
    context = browser.new_context(
        viewport=VIEWPORT,
        record_video_dir=str(target_dir),
        record_video_size=VIEWPORT,
        # Quietly accept anything localStorage / cookies — games persist scores.
        ignore_https_errors=True,
        # Some games preconfig audio etc. — Playwright defaults are fine.
    )
    # Inject overlay before any page script.
    context.add_init_script(COMMON_OVERLAY_JS)
    # Per-bot init script (e.g. expose state on window.__BOT__).
    if getattr(bot, "INIT_SCRIPT", None):
        context.add_init_script(bot.INIT_SCRIPT)

    page = context.new_page()
    started = time.time()
    score = None
    error = None

    target_url = base_url + bot.PATH
    try:
        page.goto(target_url)
        # Set the on-screen banner immediately.
        page.evaluate(
            "([t, s]) => { window.__BOT__.title(t); window.__BOT__.score(s); }",
            [bot.TITLE, "0"],
        )
        score = bot.play(page)
        # Final overlay tick so the closing seconds of the video show the score.
        if score is not None:
            page.evaluate(
                "s => window.__BOT__.score(String(s))", str(score)
            )
        # Hold for a couple of seconds so the video ends on the result screen.
        page.wait_for_timeout(2200)
    except Exception as exc:  # noqa: BLE001 — surface any bot failure
        error = "".join(
            traceback.format_exception_only(type(exc), exc)
        ).strip()
        try:
            page.evaluate(
                "msg => window.__BOT__.title('CRASHED · ' + msg)", error[:120]
            )
            page.wait_for_timeout(1500)
        except Exception:
            pass
    finally:
        page_video = page.video
        try:
            context.close()
        except Exception:
            pass
        try:
            browser.close()
        except Exception:
            pass

    elapsed = time.time() - started

    # Rename the .webm to a friendly filename.
    final_video = target_dir / f"{slug}.webm"
    if page_video:
        try:
            raw = Path(page_video.path())
            if raw.exists():
                raw.replace(final_video)
        except Exception:
            pass
    if not final_video.exists():
        # Fall back to whatever .webm landed in target_dir.
        webms = sorted(target_dir.glob("*.webm"))
        if webms:
            webms[0].replace(final_video)

    return {
        "slug": slug,
        "title": bot.TITLE,
        "score": score,
        "elapsed": round(elapsed, 1),
        "video": final_video.relative_to(RECORDINGS_DIR).as_posix()
        if final_video.exists()
        else None,
        "error": error,
    }


def write_summary(results: list[dict]):
    summary_json = RECORDINGS_DIR / "summary.json"
    summary_json.write_text(json.dumps(results, indent=2))

    summary_html = RECORDINGS_DIR / "index.html"
    rows = []
    for r in results:
        score_cell = (
            "—" if r["score"] is None else f"{r['score']:,}".replace(",", ",")
        )
        err = (
            f'<div class="err">{r["error"]}</div>' if r.get("error") else ""
        )
        if r.get("video"):
            video_html = (
                f'<video controls preload="metadata" '
                f'src="{r["video"]}" width="640"></video>'
            )
        else:
            video_html = '<div class="err">No video recorded.</div>'
        rows.append(
            f"""
        <section class="card">
          <header>
            <h2>{r['title']}</h2>
            <div class="meta">
              <span class="score">Score {score_cell}</span>
              <span class="time">{r['elapsed']}s</span>
            </div>
          </header>
          {video_html}
          {err}
        </section>
        """
        )
    body = "\n".join(rows)
    playlist_payload = json.dumps(
        [
            {
                "title": r["title"],
                "src": r["video"],
                "score": r["score"],
            }
            for r in results
            if r.get("video")
        ]
    )
    summary_html.write_text(
        f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" />
<title>Arcade auto-player runs</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{
    margin: 0;
    padding: 24px;
    background: #0a0610;
    color: #e0e0f0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }}
  h1 {{ color: #ff6eb4; text-shadow: 0 0 12px rgba(255,20,147,0.45); margin: 0 0 6px; }}
  p.lede {{ margin: 0 0 16px; color: #c8e0ff; opacity: 0.85; }}
  #player {{
    margin: 0 auto 24px;
    max-width: 1180px;
    background: rgba(8, 4, 16, 0.85);
    border: 1px solid rgba(255, 20, 147, 0.45);
    border-radius: 16px;
    padding: 14px 14px 16px;
    box-shadow: 0 0 40px rgba(255, 20, 147, 0.18);
  }}
  #player header {{ display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }}
  #player h2 {{ margin: 0; color: #7df9ff; letter-spacing: 0.05em; font-size: 18px; }}
  #player video {{ width: 100%; border-radius: 10px; margin-top: 10px; background: black; }}
  #player nav {{ margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }}
  #player nav button {{
    padding: 6px 12px;
    font: 600 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: rgba(0, 255, 238, 0.12);
    color: #b2fef9;
    border: 1px solid rgba(0, 255, 238, 0.45);
    border-radius: 6px;
    cursor: pointer;
    letter-spacing: 0.05em;
  }}
  #player nav button[aria-pressed="true"] {{
    background: rgba(255, 20, 147, 0.25);
    color: #ffeaf2;
    border-color: rgba(255, 20, 147, 0.7);
  }}
  #player .meta {{ font-size: 14px; color: #ffe082; }}
  .grid {{ display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); }}
  .card {{
    background: rgba(20, 12, 32, 0.85);
    border: 1px solid rgba(0,255,238,0.25);
    border-radius: 14px;
    padding: 14px;
  }}
  .card header {{ display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }}
  .card h2 {{ margin: 0; color: #7df9ff; font-size: 16px; letter-spacing: 0.05em; }}
  .meta {{ font-size: 13px; color: #c8e0ff; opacity: 0.85; display: flex; gap: 14px; }}
  .score {{ color: #ffe082; }}
  video {{ width: 100%; border-radius: 8px; margin-top: 10px; background: black; }}
  .err {{ color: #ff8a80; margin-top: 8px; font-size: 13px; }}
</style>
</head><body>
  <h1>Arcade auto-player runs</h1>
  <p class="lede">All seven games played back-to-back. Scores below reflect what each game awarded the bot.</p>

  <section id="player">
    <header>
      <h2 id="now-playing">Loading…</h2>
      <div class="meta" id="now-score"></div>
    </header>
    <video id="reel" controls preload="auto" autoplay playsinline></video>
    <nav id="reel-nav"></nav>
  </section>

  <h2 style="color:#7df9ff;letter-spacing:0.05em;">Individual runs</h2>
  <div class="grid">{body}</div>

  <script>
    const playlist = {playlist_payload};
    const reel = document.getElementById('reel');
    const nav = document.getElementById('reel-nav');
    const titleEl = document.getElementById('now-playing');
    const scoreEl = document.getElementById('now-score');
    let cursor = 0;

    function show(i) {{
      if (!playlist.length) {{
        titleEl.textContent = 'No videos recorded.';
        return;
      }}
      cursor = ((i % playlist.length) + playlist.length) % playlist.length;
      const item = playlist[cursor];
      reel.src = item.src;
      reel.play().catch(() => {{}});
      titleEl.textContent = item.title;
      scoreEl.textContent = item.score == null ? '' : 'Score ' + item.score.toLocaleString();
      [...nav.children].forEach((b, idx) => {{
        b.setAttribute('aria-pressed', String(idx === cursor));
      }});
    }}

    playlist.forEach((item, idx) => {{
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.title.split('—')[0].trim();
      b.addEventListener('click', () => show(idx));
      nav.appendChild(b);
    }});

    reel.addEventListener('ended', () => show(cursor + 1));

    if (playlist.length) show(0);
  </script>
</body></html>
"""
    )
    return summary_html


def parse_args(argv: list[str]):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "slugs",
        nargs="*",
        help="Optional list of game slugs to run (default: all).",
    )
    p.add_argument(
        "--headed",
        action="store_true",
        help="Show the browser window while playing (slower; off by default).",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    bots = load_bots()
    if args.slugs:
        wanted = set(args.slugs)
        bots = [b for b in bots if b.SLUG in wanted]
        missing = wanted - {b.SLUG for b in bots}
        if missing:
            print(f"unknown slug(s): {', '.join(sorted(missing))}", file=sys.stderr)
            return 2
    if not bots:
        print("no bots selected", file=sys.stderr)
        return 2

    RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Output dir: {RECORDINGS_DIR}")

    with static_server(PROJECT_ROOT) as base_url:
        print(f"Static server: {base_url}")
        with sync_playwright() as p:
            results = []
            for bot in bots:
                print(f"\n=== {bot.TITLE} ({bot.SLUG}) ===")
                r = run_one_bot(p, base_url, bot, headless=not args.headed)
                results.append(r)
                if r["error"]:
                    print(f"  CRASHED: {r['error']}")
                else:
                    print(f"  score={r['score']}  elapsed={r['elapsed']}s")

    summary_path = write_summary(results)
    print(f"\nSummary: {summary_path}")
    print("Open it in a browser to watch the videos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
