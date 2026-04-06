/**
 * Meerkat Run — vanilla JavaScript (ES module).
 * Meerkat / bird: reference sprites (chroma-keyed). Background: savanna plate.
 */

const MEERKAT_SRC = new URL("./meerkat-ref.png", import.meta.url).href;
const BG_SAVANNA_SRC = new URL("./bg-savanna.png", import.meta.url).href;
const BIRD_SRC = new URL("./bird-ref.png", import.meta.url).href;

const CONFIG = {
  gravity: 0.38,
  jump: -5.85,
  maxFall: 7,
  autoRunMin: 1.26,
  autoRunMax: 1.4,
  birdSpeedMin: 1.12,
  birdSpeedMax: 1.74,
  catchDistMin: 11,
  catchDistMax: 14.5,
  /** On-screen sprite size (game pixels); reference is downscaled for chunky pixels */
  meerkatDrawW: 32,
  meerkatDrawH: 32,
  /** Atlas size after chroma + nearest-neighbor downscale */
  meerkatAtlasPx: 56,
  birdAtlasPx: 56,
  birdDrawW: 50,
  birdDrawH: 48,
  /** Score ≈ how far right you’ve reached (world units × mult) */
  scoreOriginX: 18,
  scorePerWorldUnit: 3,
  winBonusScore: 1000,
  /** Persisted best score (same browser / origin) */
  highScoreStorageKey: "meerkat-chase-highscore-v1",
  /** Background scroll vs camera (0 = fixed, ~0.2 = subtle parallax) */
  bgParallax: 0.16,
  /** >1 zooms art in so horizontal pan has slack (square art on wide canvas) */
  bgZoom: 1.28,
  /** Frames after leaving a ledge where jump still registers */
  coyoteFrames: 8,
  /** Frames a jump input is remembered before landing */
  jumpBufferFrames: 12,
};

/** @typedef {{ x: number, y: number, w: number, h: number }} Plat */
/** @typedef {{ name: string, worldWidth: number, diffStartX: number, diffEndX: number, birdSpeedMul: number, catchDistMul: number, platforms: readonly Plat[], goal: { x: number, y: number, w: number, h: number } }} LevelDef */

/** Multi-stage run: each stage is longer, tighter; `birdSpeedMul` scales both the falcon and auto-run speed. */
const LEVELS = Object.freeze(
  /** @type {readonly LevelDef[]} */ ([
    Object.freeze({
      name: "Dust Trail",
      worldWidth: 1120,
      diffStartX: 18,
      diffEndX: 985,
      birdSpeedMul: 1,
      catchDistMul: 1,
      platforms: Object.freeze([
        { x: 0, y: 154, w: 88, h: 10 },
        { x: 108, y: 140, w: 64, h: 8 },
        { x: 210, y: 118, w: 48, h: 8 },
        { x: 292, y: 134, w: 44, h: 8 },
        { x: 368, y: 102, w: 52, h: 8 },
        { x: 458, y: 126, w: 42, h: 8 },
        { x: 538, y: 98, w: 56, h: 8 },
        { x: 628, y: 120, w: 48, h: 8 },
        { x: 712, y: 92, w: 54, h: 8 },
        { x: 802, y: 112, w: 58, h: 8 },
        { x: 898, y: 88, w: 52, h: 8 },
        { x: 978, y: 108, w: 140, h: 10 },
      ]),
      goal: Object.freeze({ x: 1040, y: 76, w: 28, h: 32 }),
    }),
    Object.freeze({
      name: "Broken Ridge",
      worldWidth: 1200,
      diffStartX: 18,
      diffEndX: 1040,
      birdSpeedMul: 1.12,
      catchDistMul: 0.94,
      platforms: Object.freeze([
        { x: 0, y: 154, w: 70, h: 10 },
        { x: 88, y: 138, w: 50, h: 8 },
        { x: 158, y: 122, w: 38, h: 8 },
        { x: 218, y: 134, w: 34, h: 8 },
        { x: 272, y: 108, w: 44, h: 8 },
        { x: 338, y: 124, w: 36, h: 8 },
        { x: 394, y: 98, w: 46, h: 8 },
        { x: 462, y: 116, w: 36, h: 8 },
        { x: 518, y: 92, w: 42, h: 8 },
        { x: 580, y: 112, w: 38, h: 8 },
        { x: 636, y: 86, w: 44, h: 8 },
        { x: 698, y: 106, w: 36, h: 8 },
        { x: 752, y: 82, w: 42, h: 8 },
        { x: 814, y: 100, w: 36, h: 8 },
        { x: 868, y: 78, w: 44, h: 8 },
        { x: 928, y: 96, w: 240, h: 10 },
      ]),
      goal: Object.freeze({ x: 1088, y: 76, w: 28, h: 32 }),
    }),
    Object.freeze({
      name: "Sunfall Cliffs",
      worldWidth: 1380,
      diffStartX: 18,
      diffEndX: 1220,
      birdSpeedMul: 1.24,
      catchDistMul: 0.86,
      platforms: Object.freeze([
        { x: 0, y: 154, w: 60, h: 10 },
        { x: 78, y: 142, w: 40, h: 8 },
        { x: 134, y: 128, w: 32, h: 8 },
        { x: 182, y: 114, w: 30, h: 8 },
        { x: 228, y: 130, w: 30, h: 8 },
        { x: 274, y: 104, w: 38, h: 8 },
        { x: 328, y: 120, w: 32, h: 8 },
        { x: 376, y: 94, w: 40, h: 8 },
        { x: 430, y: 112, w: 34, h: 8 },
        { x: 480, y: 88, w: 38, h: 8 },
        { x: 532, y: 106, w: 32, h: 8 },
        { x: 580, y: 84, w: 40, h: 8 },
        { x: 634, y: 102, w: 34, h: 8 },
        { x: 684, y: 80, w: 38, h: 8 },
        { x: 736, y: 98, w: 32, h: 8 },
        { x: 784, y: 76, w: 40, h: 8 },
        { x: 836, y: 94, w: 34, h: 8 },
        { x: 886, y: 72, w: 40, h: 8 },
        { x: 938, y: 92, w: 32, h: 8 },
        { x: 986, y: 70, w: 42, h: 8 },
        { x: 1042, y: 88, w: 34, h: 8 },
        { x: 1092, y: 104, w: 280, h: 10 },
      ]),
      goal: Object.freeze({ x: 1265, y: 76, w: 28, h: 32 }),
    }),
    Object.freeze({
      name: "Sirocco Steps",
      worldWidth: 1580,
      diffStartX: 18,
      diffEndX: 1360,
      birdSpeedMul: 1.36,
      catchDistMul: 0.78,
      platforms: Object.freeze([
        { x: 0, y: 154, w: 56, h: 10 },
        { x: 78, y: 142, w: 36, h: 8 },
        { x: 134, y: 128, w: 28, h: 8 },
        { x: 182, y: 114, w: 26, h: 8 },
        { x: 228, y: 130, w: 26, h: 8 },
        { x: 274, y: 104, w: 34, h: 8 },
        { x: 328, y: 120, w: 28, h: 8 },
        { x: 376, y: 94, w: 36, h: 8 },
        { x: 430, y: 112, w: 30, h: 8 },
        { x: 480, y: 88, w: 34, h: 8 },
        { x: 532, y: 106, w: 28, h: 8 },
        { x: 580, y: 84, w: 36, h: 8 },
        { x: 634, y: 102, w: 30, h: 8 },
        { x: 684, y: 80, w: 34, h: 8 },
        { x: 736, y: 98, w: 28, h: 8 },
        { x: 784, y: 76, w: 36, h: 8 },
        { x: 836, y: 94, w: 30, h: 8 },
        { x: 886, y: 72, w: 36, h: 8 },
        { x: 938, y: 92, w: 28, h: 8 },
        { x: 986, y: 70, w: 38, h: 8 },
        { x: 1042, y: 88, w: 30, h: 8 },
        { x: 1092, y: 104, w: 200, h: 10 },
        { x: 1302, y: 118, w: 28, h: 8 },
        { x: 1348, y: 96, w: 34, h: 8 },
        { x: 1398, y: 114, w: 28, h: 8 },
        { x: 1444, y: 92, w: 36, h: 8 },
        { x: 1492, y: 110, w: 88, h: 10 },
      ]),
      goal: Object.freeze({ x: 1518, y: 76, w: 28, h: 32 }),
    }),
    Object.freeze({
      name: "Mirage Line",
      worldWidth: 1820,
      diffStartX: 18,
      diffEndX: 1520,
      birdSpeedMul: 1.48,
      catchDistMul: 0.72,
      platforms: Object.freeze([
        { x: 0, y: 154, w: 54, h: 10 },
        { x: 78, y: 142, w: 34, h: 8 },
        { x: 134, y: 128, w: 26, h: 8 },
        { x: 182, y: 114, w: 24, h: 8 },
        { x: 228, y: 130, w: 24, h: 8 },
        { x: 274, y: 104, w: 32, h: 8 },
        { x: 328, y: 120, w: 26, h: 8 },
        { x: 376, y: 94, w: 34, h: 8 },
        { x: 430, y: 112, w: 28, h: 8 },
        { x: 480, y: 88, w: 32, h: 8 },
        { x: 532, y: 106, w: 26, h: 8 },
        { x: 580, y: 84, w: 34, h: 8 },
        { x: 634, y: 102, w: 28, h: 8 },
        { x: 684, y: 80, w: 32, h: 8 },
        { x: 736, y: 98, w: 26, h: 8 },
        { x: 784, y: 76, w: 34, h: 8 },
        { x: 836, y: 94, w: 28, h: 8 },
        { x: 886, y: 72, w: 34, h: 8 },
        { x: 938, y: 92, w: 26, h: 8 },
        { x: 986, y: 70, w: 36, h: 8 },
        { x: 1042, y: 88, w: 28, h: 8 },
        { x: 1092, y: 104, w: 178, h: 10 },
        { x: 1288, y: 118, w: 26, h: 8 },
        { x: 1332, y: 96, w: 32, h: 8 },
        { x: 1380, y: 114, w: 26, h: 8 },
        { x: 1424, y: 92, w: 34, h: 8 },
        { x: 1472, y: 110, w: 82, h: 10 },
        { x: 1564, y: 94, w: 26, h: 8 },
        { x: 1608, y: 78, w: 30, h: 8 },
        { x: 1656, y: 100, w: 24, h: 8 },
        { x: 1696, y: 86, w: 64, h: 10 },
      ]),
      goal: Object.freeze({ x: 1745, y: 76, w: 28, h: 32 }),
    }),
    Object.freeze({
      name: "Last Burrow",
      worldWidth: 2000,
      diffStartX: 18,
      diffEndX: 1680,
      birdSpeedMul: 1.6,
      catchDistMul: 0.66,
      platforms: Object.freeze([
        { x: 0, y: 154, w: 52, h: 10 },
        { x: 76, y: 142, w: 32, h: 8 },
        { x: 130, y: 128, w: 24, h: 8 },
        { x: 176, y: 114, w: 24, h: 8 },
        { x: 222, y: 130, w: 24, h: 8 },
        { x: 268, y: 104, w: 30, h: 8 },
        { x: 320, y: 120, w: 24, h: 8 },
        { x: 366, y: 94, w: 32, h: 8 },
        { x: 418, y: 112, w: 26, h: 8 },
        { x: 466, y: 88, w: 30, h: 8 },
        { x: 516, y: 106, w: 24, h: 8 },
        { x: 562, y: 84, w: 32, h: 8 },
        { x: 614, y: 102, w: 26, h: 8 },
        { x: 662, y: 80, w: 30, h: 8 },
        { x: 712, y: 98, w: 24, h: 8 },
        { x: 758, y: 76, w: 32, h: 8 },
        { x: 808, y: 94, w: 26, h: 8 },
        { x: 856, y: 72, w: 32, h: 8 },
        { x: 906, y: 92, w: 24, h: 8 },
        { x: 952, y: 70, w: 34, h: 8 },
        { x: 1006, y: 88, w: 26, h: 8 },
        { x: 1054, y: 104, w: 165, h: 10 },
        { x: 1238, y: 118, w: 24, h: 8 },
        { x: 1280, y: 96, w: 30, h: 8 },
        { x: 1326, y: 114, w: 24, h: 8 },
        { x: 1368, y: 92, w: 32, h: 8 },
        { x: 1414, y: 110, w: 76, h: 10 },
        { x: 1500, y: 94, w: 24, h: 8 },
        { x: 1542, y: 78, w: 28, h: 8 },
        { x: 1586, y: 100, w: 24, h: 8 },
        { x: 1624, y: 86, w: 58, h: 10 },
        { x: 1692, y: 108, w: 24, h: 8 },
        { x: 1732, y: 88, w: 28, h: 8 },
        { x: 1774, y: 106, w: 24, h: 8 },
        { x: 1812, y: 90, w: 48, h: 10 },
        { x: 1880, y: 108, w: 120, h: 10 },
      ]),
      goal: Object.freeze({ x: 1938, y: 76, w: 28, h: 32 }),
    }),
  ])
);

const GameState = Object.freeze({
  menu: "menu",
  play: "play",
  /** Cleared a stage; short pause before the next */
  levelDone: "levelDone",
  win: "win",
  lose: "lose",
});

function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function smoothstep01(u) {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

function loadHighScore(storageKey) {
  try {
    const v = localStorage.getItem(storageKey);
    if (v == null) return 0;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(storageKey, value) {
  try {
    localStorage.setItem(storageKey, String(value));
  } catch {
    /* quota / private mode */
  }
}

function prefersReducedMotion() {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  } catch {
    return false;
  }
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Remove flat backdrop (sampled from corners) so the character + cast shadow read on any level.
 * @param {HTMLImageElement} img
 * @returns {HTMLCanvasElement}
 */
function chromaKeyCanvas(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) throw new Error("2d context");
  x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, w, h);
  const d = id.data;
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (const [cx, cy] of corners) {
    const i = (cy * w + cx) * 4;
    sr += d[i];
    sg += d[i + 1];
    sb += d[i + 2];
  }
  sr /= corners.length;
  sg /= corners.length;
  sb /= corners.length;
  const tol = 40;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (
      Math.abs(r - sr) < tol &&
      Math.abs(g - sg) < tol &&
      Math.abs(b - sb) < tol
    ) {
      d[i + 3] = 0;
    }
  }
  x.putImageData(id, 0, 0);
  return c;
}

/**
 * @param {HTMLCanvasElement} source
 * @param {number} atlasPx
 * @returns {HTMLCanvasElement}
 */
function downscaleNearest(source, atlasPx) {
  const S = atlasPx;
  const out = document.createElement("canvas");
  out.width = S;
  out.height = S;
  const o = out.getContext("2d");
  if (!o) throw new Error("2d context");
  o.imageSmoothingEnabled = false;
  o.drawImage(source, 0, 0, S, S);
  return out;
}

/**
 * @param {HTMLImageElement} img
 * @returns {HTMLCanvasElement}
 */
function prepareMeerkatSprite(img) {
  return downscaleNearest(chromaKeyCanvas(img), CONFIG.meerkatAtlasPx);
}

/**
 * @param {HTMLImageElement} img
 * @returns {HTMLCanvasElement}
 */
function prepareBirdSprite(img) {
  return downscaleNearest(chromaKeyCanvas(img), CONFIG.birdAtlasPx);
}

class MeerkatChaseGame {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLCanvasElement | null} meerkatSprite — processed RGBA canvas, or null for procedural fallback
   * @param {HTMLImageElement | null} backgroundImage — savanna plate, or null for gradient fallback
   * @param {HTMLCanvasElement | null} birdSprite — chroma-keyed falcon, or null for procedural fallback
   */
  constructor(canvas, meerkatSprite, backgroundImage, birdSprite) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.GW = canvas.width;
    this.GH = canvas.height;

    /** @type {HTMLCanvasElement | null} */
    this.meerkatSprite = meerkatSprite;

    /** @type {HTMLImageElement | null} */
    this.backgroundImage = backgroundImage;

    /** @type {HTMLCanvasElement | null} */
    this.birdSprite = birdSprite;

    /** @type {Record<string, boolean>} */
    this.keys = Object.create(null);
    this.cameraX = 0;
    this.tick = 0;
    /** @type {string} */
    this.state = GameState.menu;

    this.player = {
      x: 36,
      y: 130,
      vx: 0,
      vy: 0,
      w: 12,
      h: 16,
      onGround: false,
      facing: 1,
    };

    this.bird = {
      x: -48,
      y: 88,
      vx: 0,
      vy: 0,
      phase: 0,
    };

    this._onKeyDown = (e) => this.#handleKeyDown(e);
    this._onKeyUp = (e) => this.#handleKeyUp(e);
    this._frame = () => this.#step();

    this.highScore = loadHighScore(CONFIG.highScoreStorageKey);
    /** After game over, high score write runs once per round */
    this._highScoreCommitted = false;
    /** True for this overlay if this run set a new best */
    this._newHighScore = false;

    this.levelIndex = 0;
    /** Distance score banked from finished stages (+ bonuses) */
    this.scoreBank = 0;
    /** Auto-advance countdown between stages */
    this._levelDoneTimer = 0;

    this.reduceMotion = prefersReducedMotion();
    /** While {@link GameState.play}: freeze simulation (P / Esc) */
    this.paused = false;
    /** Coyote-time & jump-buffer (updated in #updatePlayer) */
    this._coyoteTimer = 0;
    this._jumpBuffer = 0;

    this._onPointerDown = (e) => this.#handlePointerDown(e);
  }

  #handleKeyDown(e) {
    this.keys[e.code] = true;
    if (
      [
        "Space",
        "Enter",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.code)
    ) {
      e.preventDefault();
    }

    if (this.state === GameState.menu) {
      if (e.code === "Space" || e.code === "Enter" || e.code === "KeyR") {
        e.preventDefault();
        this.#beginPlayFromMenu();
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        this.#toggleFullscreen();
      }
      return;
    }

    if (this.state === GameState.levelDone) {
      if (
        e.code === "Space" ||
        e.code === "Enter" ||
        e.code === "KeyR"
      ) {
        e.preventDefault();
        this.#advanceToNextLevel();
      }
      return;
    }

    if (this.state === GameState.win || this.state === GameState.lose) {
      if (e.code === "Enter" || e.code === "Space" || e.code === "KeyR") {
        e.preventDefault();
        this.reset();
      }
      return;
    }

    if (this.state === GameState.play) {
      if (this.paused && e.code === "Enter") {
        e.preventDefault();
        this.paused = false;
        return;
      }
      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        this.paused = !this.paused;
        return;
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        this.#toggleFullscreen();
        return;
      }
    }

    if (e.code === "KeyR") {
      e.preventDefault();
      this.reset();
    }
  }

  /** @returns {LevelDef} */
  #level() {
    const i = Math.max(0, Math.min(this.levelIndex, LEVELS.length - 1));
    return LEVELS[i];
  }

  #advanceToNextLevel() {
    this.levelIndex++;
    this.#resetWorld();
    this.state = GameState.play;
    this._levelDoneTimer = 0;
    this.paused = false;
    this._coyoteTimer = 0;
    this._jumpBuffer = 0;
    this.keys.Space = false;
    this.keys.ArrowUp = false;
    this.keys.KeyW = false;
    this.keys.KeyJ = false;
  }

  #toggleFullscreen() {
    const el = this.canvas.parentElement;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void el.requestFullscreen();
      }
    } catch {
      /* unsupported */
    }
  }

  /** Start a run from the title screen; clears jump keys so Space doesn’t auto-jump. */
  #beginPlayFromMenu() {
    this.reset();
    this.keys.Space = false;
    this.keys.Enter = false;
    this.keys.ArrowUp = false;
    this.keys.KeyW = false;
    this.keys.KeyJ = false;
    this._jumpBuffer = 0;
    this._coyoteTimer = 0;
    this.canvas.focus({ preventScroll: true });
  }

  #handleKeyUp(e) {
    this.keys[e.code] = false;
  }

  #handlePointerDown(e) {
    if (this.state === GameState.menu) {
      e.preventDefault();
      this.#beginPlayFromMenu();
      return;
    }
    if (this.state === GameState.levelDone) {
      e.preventDefault();
      this.#advanceToNextLevel();
      return;
    }
    if (this.state === GameState.play) {
      if (this.paused) {
        e.preventDefault();
        this.paused = false;
        return;
      }
      e.preventDefault();
      this._jumpBuffer = CONFIG.jumpBufferFrames;
    }
  }

  bindInput() {
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    this.canvas.addEventListener("pointerdown", this._onPointerDown, {
      passive: false,
    });
  }

  unbindInput() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
  }

  #resetWorld() {
    const { player, bird } = this;
    this.cameraX = 0;
    this.tick = 0;
    player.x = 36;
    player.y = 130;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.facing = 1;
    bird.x = player.x - 120;
    bird.y = 72;
    bird.vx = 0;
    bird.vy = 0;
    bird.phase = 0;
  }

  reset() {
    this.levelIndex = 0;
    this.scoreBank = 0;
    this._levelDoneTimer = 0;
    this.#resetWorld();
    this.state = GameState.play;
    this._highScoreCommitted = false;
    this._newHighScore = false;
    this.paused = false;
    this._coyoteTimer = 0;
    this._jumpBuffer = 0;
  }

  #showStartScreen() {
    this.levelIndex = 0;
    this.scoreBank = 0;
    this._levelDoneTimer = 0;
    this.#resetWorld();
    this.state = GameState.menu;
    this._highScoreCommitted = false;
    this._newHighScore = false;
    this.paused = false;
    this._coyoteTimer = 0;
    this._jumpBuffer = 0;
  }

  #maybeUpdateHighScore() {
    if (
      this.state === GameState.play ||
      this.state === GameState.menu ||
      this.state === GameState.levelDone ||
      this._highScoreCommitted
    ) {
      return;
    }
    this._highScoreCommitted = true;
    const s = this.#displayScore();
    if (s > this.highScore) {
      this.highScore = s;
      saveHighScore(CONFIG.highScoreStorageKey, s);
      this._newHighScore = true;
    }
    const AT = globalThis.ArcadeTokens;
    if (typeof AT !== "undefined" && AT.earnFromGameScore) {
      AT.earnFromGameScore("meerkat", s);
    }
  }

  #segmentScoreRaw() {
    const { scoreOriginX, scorePerWorldUnit } = CONFIG;
    let s = Math.floor((this.player.x - scoreOriginX) * scorePerWorldUnit);
    return Math.max(0, s);
  }

  /**
   * Full run score: banked stages + current segment (while playing / dead).
   * Clearing a stage banks segment points plus win bonus before the interstitial.
   */
  #displayScore() {
    if (this.state === GameState.menu) return 0;
    if (
      this.state === GameState.win ||
      this.state === GameState.levelDone
    ) {
      return this.scoreBank;
    }
    const seg = this.#segmentScoreRaw();
    return this.scoreBank + seg;
  }

  #drawScoreHud() {
    const { ctx } = this;
    const lvHi = `LV ${this.levelIndex + 1}/${LEVELS.length} · HI ${this.highScore}`;
    let lines;
    if (this.state === GameState.menu) {
      lines = [[`HI ${this.highScore}`, "#e8d4a0"]];
    } else if (this.state === GameState.levelDone) {
      const next = LEVELS[this.levelIndex + 1];
      lines = [
        [`SCORE ${this.#displayScore()}`, "#f2e6d4"],
        [next ? `Next: ${next.name}` : "", "#c9b090"],
      ].filter((row) => row[0].length > 0);
    } else {
      lines = [
        [`SCORE ${this.#displayScore()}`, "#f2e6d4"],
        [lvHi, "#e8d4a0"],
      ];
    }
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "bold 10px monospace, Courier New, monospace";
    let y = 4;
    for (const [text, fill] of lines) {
      ctx.fillStyle = "rgba(25, 20, 16, 0.65)";
      ctx.fillText(text, 5, y + 1);
      ctx.fillStyle = fill;
      ctx.fillText(text, 4, y);
      y += 13;
    }
    ctx.restore();
  }

  #drawStartScreenOverlay() {
    const { ctx, GW, GH } = this;
    ctx.save();
    ctx.fillStyle = "rgba(10, 6, 4, 0.52)";
    ctx.fillRect(0, 0, GW, GH);

    const title = "MEERKAT RUN";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 13px monospace, Courier New, monospace";
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillText(title, GW / 2 + 1, 52 + 1);
    ctx.fillStyle = "#f8ead8";
    ctx.fillText(title, GW / 2, 52);

    ctx.font = "6px monospace, Courier New, monospace";
    ctx.fillStyle = "#e8d4c8";
    ctx.fillText(`${LEVELS.length} stages — bird and sprint ramp together`, GW / 2, 68);
    ctx.fillText("Outrun the falcon · jump the gaps", GW / 2, 80);
    ctx.fillText("Auto-run · Space / W / ↑ jump", GW / 2, 92);
    ctx.fillStyle = "#c9a86c";
    ctx.fillText("Press Space, Enter, or R to start", GW / 2, 108);

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(GW / 2 - 62, 122, 124, 1);

    ctx.fillStyle = "#a89880";
    ctx.fillText(`Best score  ${this.highScore}`, GW / 2, 132);

    ctx.fillStyle = "#7a7068";
    ctx.fillText("P / Esc — pause   F — fullscreen   Tap — jump", GW / 2, 146);

    ctx.restore();
  }

  #drawPauseOverlay() {
    const { ctx, GW, GH } = this;
    ctx.save();
    ctx.fillStyle = "rgba(8, 6, 4, 0.45)";
    ctx.fillRect(0, 0, GW, GH);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 11px monospace, Courier New, monospace";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText("PAUSED", GW / 2 + 1, GH / 2 - 6 + 1);
    ctx.fillStyle = "#f0e4d4";
    ctx.fillText("PAUSED", GW / 2, GH / 2 - 6);
    ctx.font = "6px monospace, Courier New, monospace";
    ctx.fillStyle = "#c4b8a8";
    ctx.fillText("P / Esc / Enter — resume   Tap — resume", GW / 2, GH / 2 + 8);
    ctx.fillStyle = "#9a8a78";
    ctx.fillText("R — restart run", GW / 2, GH / 2 + 20);
    ctx.restore();
  }

  #runProgress() {
    const L = this.#level();
    const u = (this.player.x - L.diffStartX) / (L.diffEndX - L.diffStartX);
    return smoothstep01(u);
  }

  #scaledAutoRun() {
    const t = this.#runProgress();
    const { autoRunMin, autoRunMax } = CONFIG;
    const base = autoRunMin + (autoRunMax - autoRunMin) * t;
    return base * this.#level().birdSpeedMul;
  }

  #scaledBirdSpeed() {
    const t = this.#runProgress();
    const curved = t ** 0.92;
    const { birdSpeedMin, birdSpeedMax } = CONFIG;
    const base = birdSpeedMin + (birdSpeedMax - birdSpeedMin) * curved;
    return base * this.#level().birdSpeedMul;
  }

  #scaledCatchDist() {
    const t = this.#runProgress();
    const { catchDistMin, catchDistMax } = CONFIG;
    const raw = catchDistMax + (catchDistMin - catchDistMax) * t;
    return raw * this.#level().catchDistMul;
  }

  /**
   * @param {number} px
   * @param {number} py
   * @param {number} pw
   * @param {number} ph
   * @param {boolean} resolveY
   */
  #collidePlatforms(px, py, pw, ph, resolveY) {
    const { player } = this;
    for (const p of this.#level().platforms) {
      if (!aabb(px, py, pw, ph, p.x, p.y, p.w, p.h)) continue;
      if (resolveY) {
        const prevBottom = py + ph - player.vy;
        const platTop = p.y;
        if (player.vy >= 0 && prevBottom <= platTop + 2) {
          py = platTop - ph;
          player.vy = 0;
          player.onGround = true;
        } else if (player.vy < 0) {
          py = p.y + p.h;
          player.vy = 0;
        }
      } else {
        const cx = px + pw / 2;
        const pcx = p.x + p.w / 2;
        px = cx < pcx ? p.x - pw : p.x + p.w;
      }
    }
    return { x: px, y: py };
  }

  #updatePlayer() {
    const { player } = this;
    const groundedStart = player.onGround;
    player.onGround = false;

    const jumpHeld =
      this.keys.Space ||
      this.keys.ArrowUp ||
      this.keys.KeyW ||
      this.keys.KeyJ;

    if (jumpHeld) {
      this._jumpBuffer = CONFIG.jumpBufferFrames;
    } else {
      this._jumpBuffer = Math.max(0, this._jumpBuffer - 1);
    }

    const canJump = groundedStart || this._coyoteTimer > 0;

    player.facing = 1;
    player.vx = this.#scaledAutoRun();

    if (this._jumpBuffer > 0 && canJump) {
      player.vy = CONFIG.jump;
      this._jumpBuffer = 0;
      this._coyoteTimer = 0;
    }

    player.vy += CONFIG.gravity;
    if (player.vy > CONFIG.maxFall) player.vy = CONFIG.maxFall;

    const hw = player.w / 2;
    let px = player.x - hw;
    let py = player.y - player.h;

    px += player.vx;
    ({ x: px, y: py } = this.#collidePlatforms(px, py, player.w, player.h, false));

    py += player.vy;
    ({ x: px, y: py } = this.#collidePlatforms(px, py, player.w, player.h, true));

    player.x = px + hw;
    player.y = py + player.h;

    if (player.onGround) {
      this._coyoteTimer = CONFIG.coyoteFrames;
    } else {
      this._coyoteTimer = Math.max(0, this._coyoteTimer - 1);
    }

    if (player.y > this.GH + 24) this.state = GameState.lose;

    const g = this.#level().goal;
    if (aabb(px, py, player.w, player.h, g.x, g.y, g.w, g.h)) {
      const seg = this.#segmentScoreRaw();
      this.scoreBank += seg + CONFIG.winBonusScore;
      if (this.levelIndex < LEVELS.length - 1) {
        this.state = GameState.levelDone;
        this._levelDoneTimer = 0;
      } else {
        this.state = GameState.win;
      }
    }
  }

  #updateBird() {
    const { bird, player } = this;
    bird.phase += 0.18;
    const px = player.x;
    const py = player.y - player.h / 2;
    const dx = px - bird.x;
    const dy = py - bird.y + Math.sin(bird.phase) * 6;
    const len = Math.hypot(dx, dy) || 1;
    const spd = this.#scaledBirdSpeed();
    bird.vx = (dx / len) * spd;
    bird.vy = (dy / len) * spd * 0.88;
    bird.x += bird.vx;
    bird.y += bird.vy;

    const dist = Math.hypot(
      player.x - bird.x,
      player.y - player.h / 2 - bird.y
    );
    if (dist < this.#scaledCatchDist() && this.state === GameState.play) {
      this.state = GameState.lose;
    }
  }

  #updateCamera() {
    const target = this.player.x - this.GW * 0.42;
    this.cameraX += (target - this.cameraX) * 0.12;
    const maxCam = this.#level().worldWidth - this.GW;
    this.cameraX = Math.max(0, Math.min(this.cameraX, maxCam));
  }

  #drawBackgroundFallback(cam) {
    const { ctx, GW, GH } = this;
    const g = ctx.createLinearGradient(0, 0, 0, GH);
    g.addColorStop(0, "#c85a3a");
    g.addColorStop(0.35, "#e8945c");
    g.addColorStop(0.7, "#f0b890");
    g.addColorStop(1, "#5c4a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GW, GH);

    ctx.fillStyle = "rgba(255, 248, 235, 0.22)";
    const starScroll = this.reduceMotion ? cam * 0.025 : cam * 0.12;
    for (let i = 0; i < 18; i++) {
      const sx = ((i * 73 + starScroll) % (GW + 40)) - 20;
      const sy = 12 + (i * 17) % 50;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  /**
   * Savanna sunset plate: cover-fit, nearest-neighbor, slight horizontal parallax.
   * @param {number} cam
   */
  #drawBackground(cam) {
    const { ctx, GW, GH, backgroundImage: img } = this;
    if (!img || !img.complete || img.naturalWidth < 1) {
      this.#drawBackgroundFallback(cam);
      return;
    }

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const base = Math.max(GW / iw, GH / ih);
    const scale = base * CONFIG.bgZoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const parallax = this.reduceMotion ? CONFIG.bgParallax * 0.2 : CONFIG.bgParallax;
    const pan = cam * parallax;
    const ox = (GW - dw) / 2 - pan;
    const oy = (GH - dh) / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, ox, oy, dw, dh);
    ctx.restore();
  }

  #drawPlatforms(cam) {
    const { ctx, GW } = this;
    for (const p of this.#level().platforms) {
      const x = Math.floor(p.x - cam);
      const y = Math.floor(p.y);
      if (x + p.w < 0 || x > GW) continue;
      ctx.fillStyle = "#5c4030";
      ctx.fillRect(x, y, p.w, p.h);
      ctx.fillStyle = "#9a6f4a";
      ctx.fillRect(x, y, p.w, 2);
      ctx.fillStyle = "#3a2820";
      ctx.fillRect(x, y + p.h - 2, p.w, 2);
    }
  }

  #drawGoal(cam) {
    const { ctx } = this;
    const G = this.#level().goal;
    const x = Math.floor(G.x - cam);
    const y = Math.floor(G.y);
    ctx.fillStyle = "#2a4518";
    ctx.fillRect(x + 10, y + 8, 4, G.h - 8);
    ctx.fillStyle = "#b8922e";
    ctx.fillRect(x + 4, y + 4, 22, 14);
    ctx.fillStyle = "#e8d89a";
    ctx.fillRect(x + 6, y + 6, 18, 10);
    ctx.fillStyle = "#1a3010";
    ctx.fillRect(x + 11, y + 10, 2, G.h - 12);
  }

  /**
   * Flat shadow under feet — tighter on ground, slightly dropped in air (reference look).
   * @param {number} screenX
   * @param {number} feetY
   */
  #drawMeerkatShadow(screenX, feetY) {
    const { ctx, player } = this;
    const air = !player.onGround;
    const drop = air ? Math.min(8, 3 + Math.max(0, player.vy) * 0.35) : 0;
    const ay = Math.floor(feetY + drop);
    ctx.fillStyle = air ? "rgba(38, 34, 40, 0.4)" : "rgba(38, 34, 40, 0.52)";
    ctx.beginPath();
    ctx.ellipse(screenX + 0.5, ay + 1.5, 12, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Reference sprite: art faces left; game runs right → horizontal flip when facing +1.
   * @param {number} screenX anchor (feet, screen space)
   * @param {number} feetY
   * @param {number} facing 1 = run right
   */
  #drawMeerkatFromSprite(screenX, feetY, facing) {
    const { ctx } = this;
    const spr = this.meerkatSprite;
    if (!spr) return;

    const dw = CONFIG.meerkatDrawW;
    const dh = CONFIG.meerkatDrawH;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.floor(screenX), Math.floor(feetY));
    ctx.scale(-facing, 1);
    ctx.drawImage(spr, -dw / 2, -dh, dw, dh);
    ctx.restore();
  }

  /** Procedural fallback if image missing */
  #drawMeerkatProcedural(x, y, facing) {
    const { ctx } = this;
    const ox = Math.floor(x);
    const oy = Math.floor(y);
    const f = facing;
    const pixel = (lx, ly, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(ox + lx * f, oy + ly, 1, 1);
    };
    const tan = "#c9a574";
    const dark = "#6b4e3d";
    const blk = "#2a1810";
    const light = "#e8d4b8";

    pixel(-6, -4, dark);
    pixel(-7, -3, dark);
    for (let row = 0; row < 7; row++) {
      for (let col = -3; col <= 3; col++) {
        pixel(col, -6 - row, tan);
      }
    }
    pixel(0, -8, light);
    pixel(0, -9, light);
    pixel(-1, -8, light);
    pixel(-2, 0, dark);
    pixel(-2, -1, dark);
    pixel(2, 0, dark);
    pixel(2, -1, dark);
    for (let row = 0; row < 4; row++) {
      for (let col = -2; col <= 2; col++) {
        pixel(col, -12 - row, tan);
      }
    }
    pixel(-3, -15, dark);
    pixel(3, -15, dark);
    pixel(-2, -16, tan);
    pixel(2, -16, tan);
    pixel(1 * f, -13, blk);
    pixel(2 * f, -13, blk);
    pixel(2 * f, -11, blk);
    pixel(0, -7, dark);
    pixel(0, -10, dark);
  }

  #drawMeerkat(screenX, feetY, facing) {
    if (this.meerkatSprite) {
      this.#drawMeerkatFromSprite(screenX, feetY, facing);
    } else {
      this.#drawMeerkatShadow(screenX, feetY);
      this.#drawMeerkatProcedural(screenX, feetY, facing);
    }
  }

  /**
   * Soft shadow on the ground / mid-air so the falcon reads against bright sky.
   * @param {number} screenX
   * @param {number} centerY
   */
  #drawBirdGroundShadow(screenX, centerY) {
    const { ctx } = this;
    const rx = Math.max(15, CONFIG.birdDrawW * 0.38);
    ctx.save();
    ctx.fillStyle = "rgba(28, 18, 14, 0.5)";
    ctx.beginPath();
    ctx.ellipse(
      Math.floor(screenX) + 0.5,
      Math.floor(centerY + CONFIG.birdDrawH * 0.38) + 2,
      rx,
      4.8,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  /**
   * Reference faces left; flip when chasing from the left so the beak points at the meerkat.
   * @param {number} screenX
   * @param {number} centerY
   */
  #drawBirdFromSprite(screenX, centerY) {
    const { ctx, bird, player } = this;
    const spr = this.birdSprite;
    if (!spr) return;

    const dw = CONFIG.birdDrawW;
    const dh = CONFIG.birdDrawH;
    const faceRight = player.x > bird.x;
    const bob = this.reduceMotion
      ? 0
      : Math.sin(this.tick * 0.14) * 1.1;
    const sx = Math.floor(screenX);
    const sy = Math.floor(centerY + bob);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(sx, sy);
    ctx.scale(faceRight ? -1 : 1, 1);

    // Dark silhouette offset 1px — reads on sunset sky without heavy blur
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "brightness(0)";
    ctx.globalAlpha = 0.5;
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      ctx.drawImage(spr, -dw / 2 + ox, -dh / 2 + oy, dw, dh);
    }
    ctx.filter = "none";
    ctx.globalAlpha = 1;

    ctx.shadowColor = "rgba(12, 8, 6, 0.95)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.filter = "brightness(1.14) contrast(1.12) saturate(1.08)";
    ctx.drawImage(spr, -dw / 2, -dh / 2, dw, dh);
    ctx.filter = "none";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.restore();
  }

  /** Procedural fallback if image missing */
  #drawBirdProcedural(x, y, wing) {
    const { ctx } = this;
    const scale = 1.5;
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;
    const ox = 0;
    const oy = 0;
    const pixel = (lx, ly, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(ox + lx, oy + ly, 1, 1);
    };
    const body = "#4a3f38";
    const wingC = "#352e28";
    const beak = "#c45c26";
    const eye = "#e8c848";

    for (let row = -2; row <= 2; row++) {
      for (let col = -3; col <= 4; col++) {
        if (Math.abs(row) + Math.abs(col) < 6) pixel(col, row, body);
      }
    }
    const woff = wing ? 1 : 0;
    pixel(-6, 0 + woff, wingC);
    pixel(-7, -1 + woff, wingC);
    pixel(-5, 1 + woff, wingC);
    pixel(-8, 0 + woff, wingC);
    pixel(4, -2, body);
    pixel(5, -2, body);
    pixel(5, -1, body);
    pixel(6, -1, beak);
    pixel(7, -1, beak);
    pixel(4, -3, body);
    pixel(5, -2, eye);
    pixel(5, -2, "#1a1a1a");
    pixel(-4, 2, "#2a2420");
    pixel(-5, 3, "#2a2420");
    ctx.restore();
  }

  #drawBird(screenX, centerY, wing) {
    this.#drawBirdGroundShadow(screenX, centerY);
    if (this.birdSprite) {
      this.#drawBirdFromSprite(screenX, centerY);
    } else {
      this.#drawBirdProcedural(screenX, centerY, wing);
    }
  }

  draw() {
    const { ctx, GW, GH, player, bird, tick, state } = this;
    const cam = this.cameraX;
    ctx.clearRect(0, 0, GW, GH);
    this.#drawBackground(cam);
    this.#drawPlatforms(cam);
    this.#drawGoal(cam);

    const psx = player.x - cam;
    if (psx > -48 && psx < GW + 48) {
      this.#drawMeerkat(psx, player.y, player.facing);
    }

    const wing = Math.floor(tick / 6) % 2 === 0;
    const bsx = bird.x - cam;
    if (bsx > -72 && bsx < GW + 72) {
      this.#drawBird(bsx, bird.y, wing);
    }

    ctx.fillStyle = "rgba(42, 36, 32, 0.35)";
    ctx.fillRect(0, GH - 6, GW, 6);

    const scoreStr = String(this.#displayScore());

    ctx.textAlign = "center";
    ctx.font = "6px monospace";
    if (state === GameState.levelDone) {
      const L = this.#level();
      const next = LEVELS[this.levelIndex + 1];
      ctx.fillStyle = "rgba(0,50,28,0.78)";
      ctx.fillRect(GW / 2 - 80, GH / 2 - 26, 160, 52);
      ctx.fillStyle = "#e8f5e0";
      ctx.fillText("STAGE CLEAR!", GW / 2, GH / 2 - 12);
      ctx.fillStyle = "#b8dcb0";
      ctx.fillText(L.name, GW / 2, GH / 2 - 2);
      ctx.fillStyle = "#a8d4a0";
      ctx.fillText(
        next ? `${next.name} next` : "",
        GW / 2,
        GH / 2 + 8
      );
      ctx.fillStyle = "#8ec49a";
      ctx.fillText("Space · Enter · R · tap", GW / 2, GH / 2 + 18);
    } else if (state === GameState.win) {
      const tall = this._newHighScore ? 58 : 48;
      ctx.fillStyle = "rgba(0,40,20,0.75)";
      ctx.fillRect(GW / 2 - 82, GH / 2 - 24, 164, tall);
      ctx.fillStyle = "#e8f5e0";
      ctx.fillText("YOU CLEARED ALL STAGES!", GW / 2, GH / 2 - 10);
      ctx.fillStyle = "#c8e2b8";
      ctx.fillText(`Score ${scoreStr}`, GW / 2, GH / 2 + 2);
      let y = GH / 2 + 12;
      if (this._newHighScore) {
        ctx.fillStyle = "#fff0a8";
        ctx.fillText("New high score!", GW / 2, y);
        y += 10;
      }
      ctx.fillStyle = "#a8d4a0";
      ctx.fillText(`Hi ${this.highScore} · Enter · Space · R — new run`, GW / 2, y);
    } else if (state === GameState.lose) {
      const tall = this._newHighScore ? 54 : 44;
      ctx.fillStyle = "rgba(50,10,10,0.75)";
      ctx.fillRect(GW / 2 - 78, GH / 2 - 22, 156, tall);
      ctx.fillStyle = "#ffd0d0";
      ctx.fillText("THE BIRD GOT YOU!", GW / 2, GH / 2 - 8);
      ctx.fillStyle = "#ffcccc";
      ctx.fillText(`Score ${scoreStr}`, GW / 2, GH / 2 + 2);
      let y = GH / 2 + 12;
      if (this._newHighScore) {
        ctx.fillStyle = "#ffe8a0";
        ctx.fillText("New high score!", GW / 2, y);
        y += 10;
      }
      ctx.fillStyle = "#ffaaaa";
      ctx.fillText(`Hi ${this.highScore} · Enter · Space · R — retry`, GW / 2, y);
    }

    if (state === GameState.menu) {
      this.#drawStartScreenOverlay();
    }

    if (state === GameState.play && this.paused) {
      this.#drawPauseOverlay();
    }

    this.#drawScoreHud();
  }

  #step() {
    this.tick++;
    if (this.state === GameState.play && !this.paused) {
      this.#updatePlayer();
      this.#updateBird();
      this.#updateCamera();
    } else if (this.state === GameState.menu) {
      this.bird.phase += 0.12;
    } else if (this.state === GameState.levelDone) {
      this._levelDoneTimer++;
      if (this._levelDoneTimer >= 72) {
        this.#advanceToNextLevel();
      }
    } else {
      this.#maybeUpdateHighScore();
    }
    this.draw();
    requestAnimationFrame(this._frame);
  }

  start() {
    this.bindInput();
    this.#showStartScreen();
    this.canvas.focus({ preventScroll: true });
    requestAnimationFrame(this._frame);
  }
}

async function main() {
  const canvas = document.getElementById("game");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const [meerkatImg, bgImg, birdImg] = await Promise.all([
    loadImage(MEERKAT_SRC).catch(() => null),
    loadImage(BG_SAVANNA_SRC).catch(() => null),
    loadImage(BIRD_SRC).catch(() => null),
  ]);

  let sprite = null;
  if (meerkatImg) {
    try {
      sprite = prepareMeerkatSprite(meerkatImg);
    } catch {
      sprite = null;
    }
  }

  let birdSprite = null;
  if (birdImg) {
    try {
      birdSprite = prepareBirdSprite(birdImg);
    } catch {
      birdSprite = null;
    }
  }

  new MeerkatChaseGame(canvas, sprite, bgImg, birdSprite).start();
}

main();
