"""Meerkat Manor (tycoon) bot.

Real-time colony sim. The bot just plays a simple opening: maximise
forager allocation, recruit and dig when affordable, stock food when
hungry, and let renown accrue. We run for ~2 minutes and report the
final renown number as the "score".
"""

import re

SLUG = "meerkat-tycoon"
TITLE = "MEERKAT MANOR — colony sim"
PATH = "/meerkat-tycoon/"

INIT_SCRIPT = "window.__BOT__ = window.__BOT__ || {};"


def play(page) -> int:
    page.evaluate("window.__BOT__.title('MEERKAT MANOR — managing')")
    page.wait_for_selector("#mobStrip")

    # Speed the game up if possible.
    try:
        page.locator("#btnSpeed").click()
        page.wait_for_timeout(150)
        page.locator("#btnSpeed").click()  # 4×
    except Exception:
        pass

    deadline = page.evaluate("performance.now()") + 110_000
    last_renown = 0

    while page.evaluate("performance.now()") < deadline:
        # Read state.
        snapshot = page.evaluate(
            r"""
            () => {
              const num = (id) => {
                const t = document.getElementById(id)?.textContent || '0';
                const n = parseInt(t.replace(/[^0-9-]/g, ''), 10);
                return Number.isFinite(n) ? n : 0;
              };
              return {
                grubs: num('grubs'),
                food: num('food'),
                pop: num('pop'),
                cap: num('cap'),
                renown: num('renown'),
                chambers: num('chambersN'),
                outposts: num('outpostN'),
                rngForageMax: parseInt(document.getElementById('rngForage')?.max || '0', 10) || 0,
                rngForage: parseInt(document.getElementById('rngForage')?.value || '0', 10) || 0,
                rngSentry: parseInt(document.getElementById('rngSentry')?.value || '0', 10) || 0,
                rngRest: parseInt(document.getElementById('rngRest')?.value || '0', 10) || 0,
              };
            }
            """
        )
        page.evaluate(
            "([r, p]) => window.__BOT__.score('renown ' + r + ' · pop ' + p)",
            [snapshot["renown"], snapshot["pop"]],
        )
        last_renown = max(last_renown, snapshot["renown"])

        # Cheap action playbook: prioritise food > recruit > dig > water > tools.
        actions = []
        if snapshot["food"] < snapshot["pop"] * 2 + 4 and snapshot["grubs"] >= 6:
            actions.append("buyFood")
        if snapshot["pop"] < snapshot["cap"] and snapshot["grubs"] >= 8:
            actions.append("recruit")
        if snapshot["pop"] >= snapshot["cap"] and snapshot["grubs"] >= 12:
            actions.append("dig")
        if snapshot["grubs"] >= 18 and snapshot["chambers"] >= 2:
            actions.append("water")
        if snapshot["grubs"] >= 25 and snapshot["chambers"] >= 3:
            actions.append("tools")
        if snapshot["grubs"] >= 40 and snapshot["renown"] >= 80:
            actions.append("outpostBtn")

        for action_id in actions:
            try:
                page.locator(f"#{action_id}").click(timeout=400)
                page.wait_for_timeout(120)
            except Exception:
                pass

        # Adjust foragers/sentries: most on forage, a couple on sentry, rest
        # rest. We use the slider's max value as a guide.
        try:
            mx = snapshot["rngForageMax"]
            if mx and snapshot["pop"] >= 2:
                forage = max(1, snapshot["pop"] - 2)
                sentry = 1 if snapshot["pop"] >= 3 else 0
                page.evaluate(
                    """
                    ([f, s]) => {
                      const setRng = (id, v) => {
                        const el = document.getElementById(id);
                        if (!el) return;
                        el.value = String(v);
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                      };
                      setRng('rngForage', f);
                      setRng('rngSentry', s);
                    }
                    """,
                    [forage, sentry],
                )
        except Exception:
            pass

        page.wait_for_timeout(700)

    final = page.evaluate(
        "() => parseInt((document.getElementById('renown')?.textContent || '0').replace(/[^0-9-]/g,''), 10) || 0"
    )
    return int(final or last_renown)
