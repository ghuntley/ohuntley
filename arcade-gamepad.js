/**
 * Shared Xbox / standard gamepad input for Funland Arcade games.
 *
 * Pair the controller via Bluetooth or USB in the OS; the browser exposes it
 * through the Gamepad API. One internal poll loop feeds all games — games read
 * held()/pressed() without calling update() each frame.
 */
(function (w) {
  "use strict";

  const DEADZONE = 0.18;
  const STICK_AS_DPAD = 0.52;
  const TRIGGER_THRESHOLD = 0.35;
  const BTN_NAMES = [
    "a", "b", "x", "y", "lb", "rb", "lt", "rt",
    "back", "start", "ls", "rs", "dup", "ddown", "dleft", "dright",
  ];

  let running = false;
  let pollRaf = 0;
  let scanActive = false;
  let scanTicks = 0;
  /** @type {Map<string, boolean>} */
  const prevHeld = new Map();
  /** @type {number[]} */
  const buttons = new Array(16).fill(0);

  const BTN = {
    a: 0,
    b: 1,
    x: 2,
    y: 3,
    lb: 4,
    rb: 5,
    lt: 6,
    rt: 7,
    back: 8,
    start: 9,
    ls: 10,
    rs: 11,
    dup: 12,
    ddown: 13,
    dleft: 14,
    dright: 15,
  };

  let cachedPadIndex = -1;
  /** @type {Gamepad | null} */
  let pad = null;

  const state = {
    connected: false,
    id: "",
    index: -1,
    leftX: 0,
    leftY: 0,
    rightX: 0,
    rightY: 0,
    lt: 0,
    rt: 0,
    dpadX: 0,
    dpadY: 0,
  };

  function applyDeadzone(v) {
    const a = Math.abs(v);
    if (a < DEADZONE) return 0;
    return (Math.sign(v) * (a - DEADZONE)) / (1 - DEADZONE);
  }

  function btnValue(gp, idx) {
    const b = gp.buttons[idx];
    if (!b) return 0;
    return typeof b.value === "number" ? b.value : b.pressed ? 1 : 0;
  }

  function findPad() {
    const list = w.navigator.getGamepads?.();
    if (!list) return null;
    if (cachedPadIndex >= 0) {
      const cached = list[cachedPadIndex];
      if (cached?.connected) return cached;
      cachedPadIndex = -1;
    }
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (g?.connected) {
        cachedPadIndex = i;
        return g;
      }
    }
    return null;
  }

  function readTriggers(gp) {
    let lt = buttons[BTN.lt];
    let rt = buttons[BTN.rt];
    if (lt < TRIGGER_THRESHOLD && gp.axes.length > 4) {
      const ax = (gp.axes[4] + 1) * 0.5;
      if (ax > lt) lt = ax;
    }
    if (rt < TRIGGER_THRESHOLD && gp.axes.length > 5) {
      const ax = (gp.axes[5] + 1) * 0.5;
      if (ax > rt) rt = ax;
    }
    state.lt = lt >= TRIGGER_THRESHOLD ? lt : 0;
    state.rt = rt >= TRIGGER_THRESHOLD ? rt : 0;
  }

  function computeDpad() {
    let x = 0;
    let y = 0;
    if (buttons[BTN.dleft] >= TRIGGER_THRESHOLD) x = -1;
    else if (buttons[BTN.dright] >= TRIGGER_THRESHOLD) x = 1;
    else if (state.leftX <= -STICK_AS_DPAD) x = -1;
    else if (state.leftX >= STICK_AS_DPAD) x = 1;

    if (buttons[BTN.dup] >= TRIGGER_THRESHOLD) y = -1;
    else if (buttons[BTN.ddown] >= TRIGGER_THRESHOLD) y = 1;
    else if (state.leftY <= -STICK_AS_DPAD) y = -1;
    else if (state.leftY >= STICK_AS_DPAD) y = 1;

    state.dpadX = x;
    state.dpadY = y;
  }

  function pollOnce() {
    pad = findPad();
    if (!pad) {
      if (state.connected) prevHeld.clear();
      state.connected = false;
      state.id = "";
      state.index = -1;
      state.leftX = state.leftY = state.rightX = state.rightY = 0;
      state.lt = state.rt = 0;
      state.dpadX = state.dpadY = 0;
      buttons.fill(0);
      return;
    }

    state.connected = true;
    state.id = pad.id || "Gamepad";
    state.index = pad.index;
    state.leftX = applyDeadzone(pad.axes[0] || 0);
    state.leftY = applyDeadzone(pad.axes[1] || 0);
    state.rightX = applyDeadzone(pad.axes[2] || 0);
    state.rightY = applyDeadzone(pad.axes[3] || 0);

    for (let i = 0; i < 16; i++) buttons[i] = btnValue(pad, i);
    readTriggers(pad);
    computeDpad();
  }

  function isHeld(name) {
    if (!pad) return false;
    const key = String(name).toLowerCase();
    if (key === "lt") return state.lt > 0;
    if (key === "rt") return state.rt > 0;
    const idx = BTN[key];
    if (idx == null) return false;
    return buttons[idx] >= TRIGGER_THRESHOLD;
  }

  function wasHeld(name) {
    return prevHeld.get(String(name).toLowerCase()) === true;
  }

  function commitEdges() {
    for (let i = 0; i < BTN_NAMES.length; i++) {
      const n = BTN_NAMES[i];
      prevHeld.set(n, isHeld(n));
    }
  }

  function held(name) {
    return isHeld(name);
  }

  function pressed(name) {
    return isHeld(name) && !wasHeld(name);
  }

  function released(name) {
    return !isHeld(name) && wasHeld(name);
  }

  function dpadX() {
    return state.dpadX;
  }

  function dpadY() {
    return state.dpadY;
  }

  function directionCode() {
    const x = state.dpadX;
    const y = state.dpadY;
    if (Math.abs(x) > Math.abs(y)) {
      if (x < 0) return "ArrowLeft";
      if (x > 0) return "ArrowRight";
      return null;
    }
    if (y < 0) return "ArrowUp";
    if (y > 0) return "ArrowDown";
    return null;
  }

  let lastDir = null;

  function consumeDirection() {
    const dir = directionCode();
    if (!dir || dir === lastDir) return null;
    lastDir = dir;
    return dir;
  }

  function resetDirectionLatch() {
    lastDir = null;
  }

  function applyMoveKeys(keys) {
    if (!state.connected || !keys) return;
    const y = state.dpadY;
    const x = state.dpadX;
    if (y < 0) {
      keys.add("KeyW");
      keys.add("ArrowUp");
    }
    if (y > 0) {
      keys.add("KeyS");
      keys.add("ArrowDown");
    }
    if (x < 0) {
      keys.add("KeyA");
      keys.add("ArrowLeft");
    }
    if (x > 0) {
      keys.add("KeyD");
      keys.add("ArrowRight");
    }
  }

  function applyMoveKeyMap(keys) {
    if (!state.connected || !keys) return;
    const y = state.dpadY;
    const x = state.dpadX;
    if (y < 0) {
      keys.KeyW = true;
      keys.ArrowUp = true;
    }
    if (y > 0) {
      keys.KeyS = true;
      keys.ArrowDown = true;
    }
    if (x < 0) {
      keys.KeyA = true;
      keys.ArrowLeft = true;
    }
    if (x > 0) {
      keys.KeyD = true;
      keys.ArrowRight = true;
    }
  }

  function confirmPressed() {
    return pressed("a") || pressed("start");
  }

  function confirmHeld() {
    return held("a") || held("start");
  }

  function pollLoop() {
    pollRaf = w.requestAnimationFrame(pollLoop);
    if (!running) return;
    if (w.document.visibilityState === "hidden") return;

    const wasConnected = state.connected;
    pollOnce();
    commitEdges();

    if (wasConnected !== state.connected) {
      if (state.connected) {
        w.dispatchEvent(
          new CustomEvent("arcade-gamepad-connected", { detail: { id: state.id } }),
        );
      } else {
        w.dispatchEvent(new CustomEvent("arcade-gamepad-disconnected"));
      }
    }

    refreshConnectionUI();

    if (scanActive) {
      scanTicks += 1;
      if (state.connected) {
        if (hintEl) {
          hintEl.textContent = "Controller detected. You can close this panel and play.";
        }
        scanActive = false;
        scanTicks = 0;
      } else if (scanTicks > 90) {
        if (hintEl) {
          hintEl.textContent =
            "No controller detected yet. Confirm Bluetooth pairing, then scan again.";
        }
        scanActive = false;
        scanTicks = 0;
      }
    }
  }

  function ensurePollLoop() {
    if (!pollRaf && running) pollLoop();
  }

  function start() {
    if (running) return;
    running = true;
    w.addEventListener("gamepadconnected", onConnect);
    w.addEventListener("gamepaddisconnected", onDisconnect);
    pollOnce();
    commitEdges();
    ensurePollLoop();
  }

  function stop() {
    running = false;
    if (pollRaf) {
      w.cancelAnimationFrame(pollRaf);
      pollRaf = 0;
    }
    w.removeEventListener("gamepadconnected", onConnect);
    w.removeEventListener("gamepaddisconnected", onDisconnect);
    cachedPadIndex = -1;
    pad = null;
    state.connected = false;
    prevHeld.clear();
  }

  function onConnect(e) {
    if (e?.gamepad && Number.isInteger(e.gamepad.index)) {
      cachedPadIndex = e.gamepad.index;
    }
  }

  function onDisconnect(e) {
    if (e?.gamepad && e.gamepad.index === cachedPadIndex) cachedPadIndex = -1;
  }

  /** Kept for API compatibility — polling is automatic via the internal loop. */
  function update() {}

  function poll() {
    pollOnce();
    commitEdges();
  }

  // ---- Top-left Bluetooth / controller connection UI --------------------

  let uiMounted = false;
  let panelOpen = false;
  let uiConnected = null;
  let uiId = "";
  /** @type {HTMLElement | null} */
  let statusEl = null;
  /** @type {HTMLElement | null} */
  let hintEl = null;
  /** @type {HTMLElement | null} */
  let panelEl = null;
  /** @type {HTMLButtonElement | null} */
  let toggleBtn = null;
  /** @type {HTMLElement | null} */
  let statusDot = null;
  /** @type {HTMLElement | null} */
  let statusText = null;

  function pairingStepsHtml() {
    const ua = navigator.userAgent || "";
    let os = "your device";
    let steps =
      "<li>Put the controller in pairing mode (hold the sync / pair button).</li>" +
      "<li>Open Bluetooth settings and pair the controller.</li>" +
      "<li>Return here and tap <strong>Scan for controller</strong>, then press any button on the pad.</li>";
    if (/Mac OS X|Macintosh/i.test(ua)) {
      os = "macOS";
      steps =
        "<li>Hold the Xbox sync button until the logo flashes.</li>" +
        "<li>Open <strong>System Settings → Bluetooth</strong> and select the controller.</li>" +
        "<li>Return here, tap <strong>Scan for controller</strong>, then press <strong>A</strong>.</li>";
    } else if (/Windows/i.test(ua)) {
      os = "Windows";
      steps =
        "<li>Hold the Xbox sync button until the logo flashes.</li>" +
        "<li>Open <strong>Settings → Bluetooth & devices</strong> and add the controller.</li>" +
        "<li>Return here, tap <strong>Scan for controller</strong>, then press <strong>A</strong>.</li>";
    } else if (/Android/i.test(ua)) {
      os = "Android";
      steps =
        "<li>Hold the Xbox sync button until the logo flashes.</li>" +
        "<li>Open <strong>Settings → Connected devices → Pair new device</strong>.</li>" +
        "<li>Return to the browser, scan, and press any button on the pad.</li>";
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      os = "iOS / iPadOS";
      steps =
        "<li>Use an MFi / supported controller; Xbox One/Series pads pair in <strong>Settings → Bluetooth</strong>.</li>" +
        "<li>After pairing, return here, scan, and press any button on the pad.</li>";
    }
    return { os, steps };
  }

  function shortPadName(id) {
    const s = String(id || "Controller");
    if (s.length <= 42) return s;
    return s.slice(0, 39) + "…";
  }

  function refreshConnectionUI() {
    const connected = state.connected;
    const id = state.id;
    if (uiConnected === connected && uiId === id) return;
    uiConnected = connected;
    uiId = id;

    if (toggleBtn) {
      toggleBtn.classList.toggle("is-connected", connected);
      toggleBtn.setAttribute("aria-pressed", connected ? "true" : "false");
      toggleBtn.title = connected
        ? `Controller connected: ${shortPadName(id)}`
        : "Connect Bluetooth controller";
    }
    if (statusDot) {
      statusDot.classList.toggle("on", connected);
    }
    if (statusText) {
      statusText.textContent = connected
        ? `Connected · ${shortPadName(id)}`
        : "Not connected · pair in Bluetooth settings, then scan";
    }
  }

  function openPanel() {
    if (!panelEl) return;
    panelOpen = true;
    panelEl.hidden = false;
    refreshConnectionUI();
    panelEl.querySelector(".arcade-gp-scan")?.focus({ preventScroll: true });
  }

  function closePanel() {
    if (!panelEl) return;
    panelOpen = false;
    panelEl.hidden = true;
    scanActive = false;
    scanTicks = 0;
    toggleBtn?.focus({ preventScroll: true });
  }

  function startScan() {
    if (hintEl) {
      hintEl.textContent = "Listening… press any button on your controller.";
    }
    scanActive = true;
    scanTicks = 0;
  }

  function mountConnectionUI() {
    if (uiMounted || document.getElementById("arcade-gamepad-btn")) return;
    uiMounted = true;
    document.body.classList.add("arcade-gp-active");

    const style = document.createElement("style");
    style.id = "arcade-gamepad-ui-style";
    style.textContent = `
#arcade-gamepad-btn {
  position: fixed;
  top: max(0.65rem, env(safe-area-inset-top));
  left: max(0.65rem, env(safe-area-inset-left));
  z-index: 10050;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.62rem;
  border-radius: 999px;
  border: 1px solid rgba(0, 255, 242, 0.45);
  background: rgba(10, 8, 24, 0.82);
  color: #bff;
  font: 600 0.78rem/1 system-ui, -apple-system, sans-serif;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 0 14px rgba(255, 20, 147, 0.18);
  -webkit-tap-highlight-color: transparent;
  contain: layout style paint;
}
#arcade-gamepad-btn:hover { border-color: #00fff2; color: #fff; }
#arcade-gamepad-btn.is-connected {
  border-color: rgba(0, 255, 136, 0.75);
  box-shadow: 0 0 16px rgba(0, 255, 136, 0.25);
}
#arcade-gamepad-btn svg { width: 1.05rem; height: 1.05rem; flex-shrink: 0; }
body.arcade-gp-active a.back-link,
body.arcade-gp-active a.back,
body.arcade-gp-active a.home {
  left: calc(max(0.65rem, env(safe-area-inset-left)) + 2.85rem) !important;
}
#arcade-gamepad-panel {
  position: fixed;
  inset: 0;
  z-index: 10060;
  display: grid;
  place-items: center;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  background: rgba(4, 3, 10, 0.72);
}
#arcade-gamepad-panel[hidden] { display: none !important; }
.arcade-gp-card {
  width: min(26rem, 100%);
  max-height: min(88vh, 32rem);
  overflow: auto;
  border-radius: 14px;
  border: 1px solid rgba(255, 20, 147, 0.45);
  background: linear-gradient(160deg, rgba(22, 8, 32, 0.96), rgba(8, 6, 18, 0.98));
  color: #eaf6ff;
  font: 400 0.92rem/1.45 system-ui, -apple-system, sans-serif;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
}
.arcade-gp-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem 0.65rem;
  border-bottom: 1px solid rgba(0, 255, 242, 0.2);
}
.arcade-gp-card h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #7df9ff;
}
.arcade-gp-close {
  border: 0;
  background: transparent;
  color: #ff8ad6;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.15rem 0.35rem;
}
.arcade-gp-body { padding: 0.85rem 1rem 1rem; }
.arcade-gp-status {
  margin: 0 0 0.75rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.86rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.arcade-gp-status-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #666;
  flex-shrink: 0;
}
.arcade-gp-status-dot.on {
  background: #00e676;
  box-shadow: 0 0 8px rgba(0, 230, 118, 0.85);
}
.arcade-gp-hint {
  margin: 0 0 0.75rem;
  font-size: 0.82rem;
  color: rgba(234, 246, 255, 0.75);
}
.arcade-gp-steps {
  margin: 0 0 1rem;
  padding-left: 1.15rem;
  font-size: 0.84rem;
  color: rgba(234, 246, 255, 0.88);
}
.arcade-gp-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.arcade-gp-scan, .arcade-gp-done {
  border: 0;
  border-radius: 8px;
  padding: 0.5rem 0.85rem;
  font: 600 0.84rem/1 system-ui, sans-serif;
  cursor: pointer;
}
.arcade-gp-scan {
  background: linear-gradient(90deg, #ff1493, #7b1fa2);
  color: #fff;
}
.arcade-gp-done {
  background: rgba(255, 255, 255, 0.08);
  color: #cfe;
  border: 1px solid rgba(0, 255, 242, 0.25);
}
`;
    document.head.appendChild(style);

    toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.id = "arcade-gamepad-btn";
    toggleBtn.setAttribute("aria-label", "Bluetooth controller connection");
    toggleBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h12V6H6zm3.5 9.5L8 11l1.5-1.5L12 12l2.5-2.5L16 11l-1.5 2.5L12 17l-2.5-2.5z"/>' +
      "</svg><span>Pad</span>";

    const guide = pairingStepsHtml();
    panelEl = document.createElement("div");
    panelEl.id = "arcade-gamepad-panel";
    panelEl.hidden = true;
    panelEl.innerHTML =
      '<div class="arcade-gp-card" role="dialog" aria-modal="true" aria-labelledby="arcade-gp-title">' +
      "<header><h2 id=\"arcade-gp-title\">Bluetooth controller</h2>" +
      '<button type="button" class="arcade-gp-close" aria-label="Close">×</button></header>' +
      '<div class="arcade-gp-body">' +
      '<p class="arcade-gp-status"><span class="arcade-gp-status-dot"></span><span class="arcade-gp-status-text"></span></p>' +
      '<p class="arcade-gp-hint">Pair in ' +
      guide.os +
      " Bluetooth first. The browser cannot pair devices itself.</p>" +
      "<ol class=\"arcade-gp-steps\">" +
      guide.steps +
      "</ol>" +
      '<div class="arcade-gp-actions">' +
      '<button type="button" class="arcade-gp-scan">Scan for controller</button>' +
      '<button type="button" class="arcade-gp-done">Done</button>' +
      "</div></div></div>";

    statusEl = panelEl.querySelector(".arcade-gp-status");
    statusDot = panelEl.querySelector(".arcade-gp-status-dot");
    statusText = panelEl.querySelector(".arcade-gp-status-text");
    hintEl = panelEl.querySelector(".arcade-gp-hint");

    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (panelOpen) closePanel();
      else openPanel();
    });

    panelEl.querySelector(".arcade-gp-close")?.addEventListener("click", () => closePanel());
    panelEl.querySelector(".arcade-gp-done")?.addEventListener("click", () => closePanel());
    panelEl.querySelector(".arcade-gp-scan")?.addEventListener("click", () => startScan());
    panelEl.addEventListener("click", (e) => {
      if (e.target === panelEl) closePanel();
    });

    document.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && panelOpen) {
        e.preventDefault();
        closePanel();
      }
    });

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panelEl);
    refreshConnectionUI();
  }

  w.ArcadeGamepad = {
    start,
    stop,
    poll,
    update,
    openConnectionPanel: openPanel,
    closeConnectionPanel: closePanel,
    refreshConnectionUI,
    mountConnectionUI,
    held,
    pressed,
    released,
    dpadX,
    dpadY,
    directionCode,
    consumeDirection,
    resetDirectionLatch,
    applyMoveKeys,
    applyMoveKeyMap,
    confirmPressed,
    confirmHeld,
    get connected() {
      return state.connected;
    },
    get id() {
      return state.id;
    },
    get leftX() {
      return state.leftX;
    },
    get leftY() {
      return state.leftY;
    },
    get rightX() {
      return state.rightX;
    },
    get rightY() {
      return state.rightY;
    },
    get lt() {
      return state.lt;
    },
    get rt() {
      return state.rt;
    },
  };

  if (typeof w.ArcadeGamepadAutoStart !== "boolean" || w.ArcadeGamepadAutoStart) {
    const boot = () => {
      start();
      mountConnectionUI();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }
})(window);
