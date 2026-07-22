/* Grid Sentinel — full tower defense engine */

(function () {
  "use strict";

  const DATA = window.GS_MAPS;
  const TOWER_TYPES = DATA.TOWER_TYPES;
  const ENEMY_TYPES = DATA.ENEMY_TYPES;
  const TRAITS = DATA.TRAITS;
  const ACHIEVEMENTS = DATA.ACHIEVEMENTS;
  const TARGET_MODES = DATA.TARGET_MODES;
  const MAP_LIST = DATA.maps;

  const SLUG_NORMAL = "towers";
  const SLUG_HARD = "towers-hard";
  const ACH_KEY = "grid-sentinel-ach-v1";
  const TUTORIAL_KEY = "grid-sentinel-tutorial-v1";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const goldEl = document.getElementById("goldVal");
  const livesEl = document.getElementById("livesVal");
  const waveEl = document.getElementById("waveVal");
  const scoreEl = document.getElementById("scoreVal");
  const towerShop = document.getElementById("towerShop");
  const sendWaveBtn = document.getElementById("sendWaveBtn");
  const sellBtn = document.getElementById("sellBtn");
  const upgradeBtn = document.getElementById("upgradeBtn");
  const targetBtn = document.getElementById("targetBtn");
  const mapSelectOverlay = document.getElementById("mapSelectOverlay");
  const mapListEl = document.getElementById("mapList");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const retryBtn = document.getElementById("retryBtn");
  const finalScoreEl = document.getElementById("finalScore");
  const finalWaveEl = document.getElementById("finalWave");
  const gameOverTitle = document.getElementById("gameOverTitle");
  const wavePreviewEl = document.getElementById("wavePreview");
  const autoWaveToggle = document.getElementById("autoWaveToggle");
  const pauseBtn = document.getElementById("pauseBtn");
  const speedBtn = document.getElementById("speedBtn");
  const hardModeToggle = document.getElementById("hardModeToggle");
  const toastEl = document.getElementById("toast");
  const tutorialEl = document.getElementById("tutorial");
  const pauseOverlay = document.getElementById("pauseOverlay");
  const achievementPanel = document.getElementById("achievementList");
  const mapNameEl = document.getElementById("mapName");
  const lbNormal = document.getElementById("arcade-lb");
  const lbHard = document.getElementById("arcade-lb-hard");

  let GRID_COLS = 16;
  let GRID_ROWS = 9;
  let PATH = [];
  let PATH_SET = new Set();
  let BUILD_SLOTS = new Set();
  let WAVES = [];
  let pathPoints = [];
  let pathLength = 1;

  let dpr = 1;
  let cellSize = 40;
  let offsetX = 0;
  let offsetY = 0;

  let running = false;
  let paused = false;
  let gameOver = false;
  let hardMode = false;
  let speedMult = 1;
  let selectedMapId = "core-run";
  let gold = 120;
  let lives = 20;
  let startLives = 20;
  let waveIndex = 0;
  let kills = 0;
  let score = 0;
  let leaksThisRun = 0;
  let selectedTowerId = TOWER_TYPES[0].id;
  let selectedSlot = null;
  /** @type {Array<{slot:string,typeId:string,level:number,cooldown:number,targetMode:string}>} */
  let towers = [];
  let enemies = [];
  let projectiles = [];
  let particles = [];

  let waveActive = false;
  let waveComplete = true;
  let spawnQueue = [];
  let spawnTimer = 0;
  let enemyIdCounter = 0;
  let autoWave = false;
  let autoWaveTimer = 0;
  let waveStartLives = 20;

  let pointerX = 0;
  let pointerY = 0;
  let pointerInside = false;
  let padCursorCol = 8;
  let padCursorRow = 4;
  let holdSellSlot = null;
  let holdSellTimer = 0;
  const HOLD_SELL_SEC = 0.5;

  let shakeT = 0;
  let shakeMag = 0;
  let toastTimer = 0;
  let toastText = "";
  let tutorialStep = 0;
  let achievementsUnlocked = loadAchievements();

  let audioCtx = null;
  let muted = false;

  function loadAchievements() {
    try {
      const raw = localStorage.getItem(ACH_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveAchievements() {
    localStorage.setItem(ACH_KEY, JSON.stringify(achievementsUnlocked));
  }

  function unlockAchievement(id) {
    if (achievementsUnlocked[id]) return;
    achievementsUnlocked[id] = Date.now();
    saveAchievements();
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (ach) showToast("Achievement: " + ach.name);
    renderAchievements();
  }

  function renderAchievements() {
    if (!achievementPanel) return;
    achievementPanel.innerHTML = "";
    for (const ach of ACHIEVEMENTS) {
      const li = document.createElement("li");
      li.className = achievementsUnlocked[ach.id] ? "unlocked" : "locked";
      li.textContent = (achievementsUnlocked[ach.id] ? "✓ " : "○ ") + ach.name + " — " + ach.desc;
      achievementPanel.appendChild(li);
    }
  }

  function showToast(msg, sec) {
    toastText = msg;
    toastTimer = sec ?? 2.5;
    if (toastEl) {
      toastEl.textContent = msg;
      toastEl.hidden = false;
    }
  }

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function playTone(freq, dur, type, vol) {
    if (muted || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.value = vol ?? 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }

  function sfxPlace() { playTone(440, 0.08, "square", 0.05); }
  function sfxShoot() { playTone(880, 0.04, "sine", 0.03); }
  function sfxKill() { playTone(660, 0.06, "triangle", 0.04); }
  function sfxLeak() { playTone(120, 0.2, "sawtooth", 0.07); shakeMag = 6; shakeT = 0.25; }
  function sfxWave() { playTone(330, 0.12, "square", 0.05); playTone(495, 0.15, "square", 0.04); }
  function sfxWin() { playTone(523, 0.1, "sine", 0.05); playTone(784, 0.2, "sine", 0.05); }

  function applyMap(mapId) {
    const map = MAP_LIST.find((m) => m.id === mapId) || MAP_LIST[0];
    selectedMapId = map.id;
    GRID_COLS = map.cols;
    GRID_ROWS = map.rows;
    PATH = map.path;
    PATH_SET = new Set(PATH.map(([c, r]) => `${c},${r}`));
    BUILD_SLOTS = new Set();
    for (const [c, r] of PATH) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
        const key = `${nc},${nr}`;
        if (!PATH_SET.has(key)) BUILD_SLOTS.add(key);
      }
    }
    WAVES = map.waves;
    pathPoints = buildPathPoints();
    pathLength = computePathLength(pathPoints);
    if (mapNameEl) mapNameEl.textContent = map.name;
  }

  function buildPathPoints() {
    return PATH.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
  }

  function computePathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return len || 1;
  }

  function posAlongPath(t) {
    let dist = Math.max(0, Math.min(1, t)) * pathLength;
    for (let i = 1; i < pathPoints.length; i++) {
      const seg = Math.hypot(pathPoints[i].x - pathPoints[i - 1].x, pathPoints[i].y - pathPoints[i - 1].y);
      if (dist <= seg) {
        const f = dist / seg;
        return {
          x: pathPoints[i - 1].x + (pathPoints[i].x - pathPoints[i - 1].x) * f,
          y: pathPoints[i - 1].y + (pathPoints[i].y - pathPoints[i - 1].y) * f,
        };
      }
      dist -= seg;
    }
    const last = pathPoints[pathPoints.length - 1];
    return { x: last.x, y: last.y };
  }

  function gridToPx(gx, gy) {
    return { x: offsetX + gx * cellSize, y: offsetY + gy * cellSize };
  }

  function pxToGrid(px, py) {
    return {
      col: Math.floor((px - offsetX) / cellSize),
      row: Math.floor((py - offsetY) / cellSize),
    };
  }

  function slotKey(c, r) { return `${c},${r}`; }
  function towerAtSlot(key) { return towers.find((t) => t.slot === key) || null; }

  function towerDef(typeId, level) {
    const base = TOWER_TYPES.find((t) => t.id === typeId);
    const mult = 1 + (level - 1) * 0.55;
    return {
      ...base,
      damage: base.damage * mult,
      range: base.id === "sniper" ? 99 : base.range * (1 + (level - 1) * 0.08),
      fireRate: Math.max(0.15, base.fireRate * (1 - (level - 1) * 0.08)),
    };
  }

  function upgradeCost(tower) {
    const base = TOWER_TYPES.find((t) => t.id === tower.typeId);
    return Math.floor(base.cost * (0.65 + tower.level * 0.85));
  }

  function sellValue(tower) {
    const base = TOWER_TYPES.find((t) => t.id === tower.typeId);
    let invested = base.cost;
    for (let lv = 1; lv < tower.level; lv++) {
      invested += Math.floor(base.cost * (0.65 + lv * 0.85));
    }
    return Math.floor(invested * 0.65);
  }

  function hpScale() {
    const base = 1 + waveIndex * 0.09;
    return hardMode ? base * 1.25 : base;
  }

  function addScore(amount) {
    score += amount;
    scoreEl.textContent = String(score);
  }

  function formatWavePreview() {
    if (waveIndex >= WAVES.length) return "All waves cleared!";
    const w = WAVES[waveIndex];
    const parts = w.groups.map((g) => {
      const def = ENEMY_TYPES[g.type];
      let s = `${g.count} ${def ? def.name : g.type}`;
      if (g.traits && g.traits.length) s += " (" + g.traits.map((t) => TRAITS[t]?.label || t).join(", ") + ")";
      return s;
    });
    return "Next: " + parts.join(" · ");
  }

  function updateWavePreview() {
    if (wavePreviewEl) wavePreviewEl.textContent = waveActive ? "Wave in progress…" : formatWavePreview();
  }

  function updateHud() {
    goldEl.textContent = String(gold);
    livesEl.textContent = String(lives);
    waveEl.textContent = String(waveIndex);
    scoreEl.textContent = String(score);
    updateWavePreview();
    renderShop();
    updateManageButtons();
    if (speedBtn) {
      speedBtn.disabled = waveIndex < 5 || !running || gameOver;
      speedBtn.textContent = speedMult > 1 ? "Speed ×2" : "Speed ×1";
      speedBtn.classList.toggle("active", speedMult > 1);
    }
    if (pauseBtn) pauseBtn.textContent = paused ? "Resume" : "Pause";
  }

  function renderShop() {
    towerShop.innerHTML = "";
    for (const t of TOWER_TYPES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tower-btn" + (selectedTowerId === t.id ? " selected" : "");
      btn.style.setProperty("--accent", t.accent);
      btn.disabled = !running || gameOver || paused || gold < t.cost;
      btn.innerHTML =
        `<span class="name">${t.name}</span><span class="cost">${t.cost}g</span><span class="desc">${t.desc}</span>`;
      bindTap(btn, () => {
        selectedTowerId = t.id;
        selectedSlot = null;
        advanceTutorial(1);
        renderShop();
        updateManageButtons();
      });
      towerShop.appendChild(btn);
    }
  }

  function updateManageButtons() {
    const tower = selectedSlot ? towerAtSlot(selectedSlot) : null;
    if (tower) {
      const upCost = upgradeCost(tower);
      sellBtn.disabled = paused;
      upgradeBtn.disabled = paused || gold < upCost || tower.level >= 3;
      upgradeBtn.textContent = tower.level >= 3 ? "Max level" : `Upgrade (${upCost}g)`;
      if (targetBtn) {
        targetBtn.disabled = paused;
        targetBtn.textContent = "Target: " + tower.targetMode;
      }
    } else {
      sellBtn.disabled = true;
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = "Upgrade";
      if (targetBtn) {
        targetBtn.disabled = true;
        targetBtn.textContent = "Target: —";
      }
    }
    sendWaveBtn.disabled = !running || gameOver || paused || waveActive || !waveComplete || waveIndex >= WAVES.length;
    sendWaveBtn.textContent =
      waveIndex >= WAVES.length ? "All waves cleared"
        : waveActive ? "Wave in progress…"
          : autoWave && autoWaveTimer > 0 ? `Auto in ${Math.ceil(autoWaveTimer)}s`
            : "Send Wave";
  }

  function bindTap(el, handler) {
    if (!el) return;
    let last = 0;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      ensureAudio();
      const now = Date.now();
      if (now - last < 450) return;
      last = now;
      handler(e);
    });
  }

  function renderMapSelect() {
    if (!mapListEl) return;
    mapListEl.innerHTML = "";
    for (const m of MAP_LIST) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-btn" + (selectedMapId === m.id ? " selected" : "");
      btn.innerHTML = `<span class="map-name">${m.name}</span><span class="map-blurb">${m.blurb}</span>`;
      bindTap(btn, () => {
        selectedMapId = m.id;
        renderMapSelect();
      });
      mapListEl.appendChild(btn);
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const pad = 8 * dpr;
    cellSize = Math.floor(Math.min((canvas.width - pad * 2) / GRID_COLS, (canvas.height - pad * 2) / GRID_ROWS));
    offsetX = Math.floor((canvas.width - cellSize * GRID_COLS) / 2);
    offsetY = Math.floor((canvas.height - cellSize * GRID_ROWS) / 2);
  }

  function showMapSelect() {
    renderMapSelect();
    if (mapSelectOverlay) mapSelectOverlay.hidden = false;
    if (startOverlay) startOverlay.hidden = true;
  }

  function beginFromMapSelect() {
    hardMode = hardModeToggle ? hardModeToggle.checked : false;
    autoWave = autoWaveToggle ? autoWaveToggle.checked : false;
    applyMap(selectedMapId);
    if (mapSelectOverlay) mapSelectOverlay.hidden = true;
    resetGame();
    maybeShowTutorial();
  }

  function resetGame() {
    const map = MAP_LIST.find((m) => m.id === selectedMapId) || MAP_LIST[0];
    running = true;
    paused = false;
    gameOver = false;
    gold = map.startGold;
    lives = hardMode ? 15 : map.startLives;
    startLives = lives;
    waveStartLives = lives;
    waveIndex = 0;
    kills = 0;
    score = 0;
    leaksThisRun = 0;
    speedMult = 1;
    selectedTowerId = TOWER_TYPES[0].id;
    selectedSlot = null;
    towers = [];
    enemies = [];
    projectiles = [];
    particles = [];
    waveActive = false;
    waveComplete = true;
    spawnQueue = [];
    spawnTimer = 0;
    autoWaveTimer = 0;
    if (startOverlay) startOverlay.hidden = true;
    if (gameOverOverlay) gameOverOverlay.hidden = true;
    if (pauseOverlay) pauseOverlay.hidden = true;
    resizeCanvas();
    updateHud();
  }

  function startWave() {
    if (!running || gameOver || paused || waveActive || !waveComplete || waveIndex >= WAVES.length) return;
    const wave = WAVES[waveIndex];
    spawnQueue = [];
    for (const group of wave.groups) {
      for (let i = 0; i < group.count; i++) {
        spawnQueue.push({
          type: group.type,
          traits: group.traits ? group.traits.slice() : [],
          delay: i * (group.gap ?? 0.6),
        });
      }
    }
    spawnQueue.sort((a, b) => a.delay - b.delay);
    spawnTimer = 0;
    waveActive = true;
    waveComplete = false;
    waveStartLives = lives;
    waveIndex += 1;
    autoWaveTimer = 0;
    addScore(100);
    sfxWave();
    advanceTutorial(3);
    updateHud();
  }

  function spawnEnemy(typeId, traitIds) {
    const def = ENEMY_TYPES[typeId];
    if (!def) return;
    const scale = hpScale();
    let speed = def.speed;
    let shieldHp = 0;
    const traits = traitIds || [];
    for (const tid of traits) {
      const tr = TRAITS[tid];
      if (!tr) continue;
      if (tr.speedMult) speed *= tr.speedMult;
      if (tr.shieldHp) shieldHp += tr.shieldHp;
    }
    enemies.push({
      id: ++enemyIdCounter,
      type: typeId,
      traits,
      hp: def.hp * scale,
      maxHp: def.hp * scale,
      shieldHp,
      maxShieldHp: shieldHp,
      pathT: 0,
      slowUntil: 0,
      speed,
      reward: def.reward,
      radius: def.radius,
      color: def.color,
    });
  }

  function recordSlug() {
    return hardMode ? SLUG_HARD : SLUG_NORMAL;
  }

  function checkAchievements(victory) {
    if (waveIndex >= 10 && leaksThisRun === 0) unlockAchievement("no_leak_10");
    if (victory) {
      const types = new Set(towers.map((t) => t.typeId));
      if (types.size >= 4) unlockAchievement("quad_build");
      if (hardMode) unlockAchievement("hard_win");
      if (selectedMapId === "spiral") unlockAchievement("spiral_clear");
      if (selectedMapId === "split") unlockAchievement("split_clear");
    }
  }

  function endGame(victory) {
    if (gameOver) return;
    gameOver = true;
    running = false;
    const bonus = lives * 50 + Math.floor(gold / 2);
    addScore(bonus);
    gameOverTitle.textContent = victory ? "Core Secured!" : "Core Breached";
    finalScoreEl.textContent = String(score);
    finalWaveEl.textContent = String(waveIndex);
    gameOverOverlay.hidden = false;
    if (victory) sfxWin();
    checkAchievements(victory);
    ArcadeScores.record(recordSlug(), score);
    ArcadeScores.refresh(recordSlug());
    refreshLeaderboards();
  }

  function refreshLeaderboards() {
    ArcadeScores.renderList(lbNormal, SLUG_NORMAL);
    if (lbHard) ArcadeScores.renderList(lbHard, SLUG_HARD);
  }

  function placeTower(key) {
    if (!BUILD_SLOTS.has(key) || towerAtSlot(key) || paused) return false;
    const type = TOWER_TYPES.find((t) => t.id === selectedTowerId);
    if (!type || gold < type.cost) return false;
    gold -= type.cost;
    towers.push({ slot: key, typeId: type.id, level: 1, cooldown: 0, targetMode: "first" });
    selectedSlot = key;
    addScore(15);
    sfxPlace();
    advanceTutorial(2);
    updateHud();
    return true;
  }

  function sellSelectedTower() {
    const tower = selectedSlot ? towerAtSlot(selectedSlot) : null;
    if (!tower || paused) return;
    gold += sellValue(tower);
    towers = towers.filter((t) => t.slot !== tower.slot);
    selectedSlot = null;
    updateHud();
  }

  function upgradeSelectedTower() {
    const tower = selectedSlot ? towerAtSlot(selectedSlot) : null;
    if (!tower || tower.level >= 3 || paused) return;
    const cost = upgradeCost(tower);
    if (gold < cost) return;
    gold -= cost;
    tower.level += 1;
    addScore(25);
    sfxPlace();
    updateHud();
  }

  function cycleTargetMode() {
    const tower = selectedSlot ? towerAtSlot(selectedSlot) : null;
    if (!tower) return;
    const idx = TARGET_MODES.indexOf(tower.targetMode);
    tower.targetMode = TARGET_MODES[(idx + 1) % TARGET_MODES.length];
    updateHud();
  }

  function pickTarget(tower, def, tx, ty) {
    const inRange = [];
    for (const e of enemies) {
      const pos = posAlongPath(e.pathT);
      const dist = Math.hypot(pos.x - tx, pos.y - ty);
      const maxR = def.id === "sniper" ? 999 : def.range;
      if (dist <= maxR) inRange.push({ e, pos, dist });
    }
    if (!inRange.length) return null;
    if (tower.targetMode === "strong") {
      inRange.sort((a, b) => b.e.hp - a.e.hp);
      return inRange[0];
    }
    if (tower.targetMode === "close") {
      inRange.sort((a, b) => a.dist - b.dist);
      return inRange[0];
    }
    inRange.sort((a, b) => b.e.pathT - a.e.pathT);
    return inRange[0];
  }

  function handleGridTap(col, row) {
    if (paused) return;
    const key = slotKey(col, row);
    if (!BUILD_SLOTS.has(key)) return;
    if (towerAtSlot(key)) {
      selectedSlot = key;
    } else if (selectedTowerId) {
      placeTower(key);
    } else {
      selectedSlot = key;
    }
    updateHud();
  }

  function nearestSlotToGrid(col, row) {
    let best = null;
    let bestDist = Infinity;
    for (const key of BUILD_SLOTS) {
      const [c, r] = key.split(",").map(Number);
      const d = Math.abs(c - col) + Math.abs(r - row);
      if (d < bestDist) { bestDist = d; best = key; }
    }
    return best;
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    if (pauseOverlay) pauseOverlay.hidden = !paused;
    updateHud();
  }

  function toggleSpeed() {
    if (waveIndex < 5) return;
    speedMult = speedMult > 1 ? 1 : 2;
    updateHud();
  }

  function maybeShowTutorial() {
    try {
      if (localStorage.getItem(TUTORIAL_KEY)) return;
    } catch { /* ignore */ }
    tutorialStep = 1;
    if (tutorialEl) tutorialEl.hidden = false;
    updateTutorialText();
  }

  function updateTutorialText() {
    if (!tutorialEl) return;
    const steps = [
      "",
      "Step 1: Pick a tower from the shop below.",
      "Step 2: Tap a dashed pad on the grid to build.",
      "Step 3: Press Send Wave when ready!",
      "Tip: Tap a turret to upgrade or change targeting.",
    ];
    tutorialEl.textContent = steps[tutorialStep] || "";
    if (tutorialStep <= 0 || tutorialStep >= 4) tutorialEl.hidden = true;
  }

  function advanceTutorial(step) {
    if (!tutorialEl || tutorialEl.hidden) return;
    if (step > tutorialStep) {
      tutorialStep = step;
      updateTutorialText();
      if (tutorialStep >= 4) {
        try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch { /* ignore */ }
        tutorialEl.hidden = true;
      }
    }
  }

  function readGamepad() {
    if (!ArcadeGamepad.connected) return;
    if (mapSelectOverlay && !mapSelectOverlay.hidden) {
      if (ArcadeGamepad.confirmPressed()) beginFromMapSelect();
      return;
    }
    if (!running || gameOver) {
      if (ArcadeGamepad.confirmPressed() && !gameOverOverlay.hidden) showMapSelect();
      return;
    }
    if (ArcadeGamepad.pressed("start")) togglePause();
    if (paused) return;

    const dx = ArcadeGamepad.dpadX() || (Math.abs(ArcadeGamepad.leftX) > 0.5 ? Math.sign(ArcadeGamepad.leftX) : 0);
    const dy = ArcadeGamepad.dpadY() || (Math.abs(ArcadeGamepad.leftY) > 0.5 ? Math.sign(ArcadeGamepad.leftY) : 0);
    if (ArcadeGamepad.pressed("dleft") || ArcadeGamepad.pressed("dright") || ArcadeGamepad.pressed("dup") || ArcadeGamepad.pressed("ddown")) {
      padCursorCol = Math.max(0, Math.min(GRID_COLS - 1, padCursorCol + dx));
      padCursorRow = Math.max(0, Math.min(GRID_ROWS - 1, padCursorRow + dy));
      const key = nearestSlotToGrid(padCursorCol, padCursorRow);
      if (key) selectedSlot = key;
      updateHud();
    }
    if (ArcadeGamepad.pressed("lb")) cycleTower(-1);
    if (ArcadeGamepad.pressed("rb")) cycleTower(1);
    if (ArcadeGamepad.pressed("y")) startWave();
    if (ArcadeGamepad.pressed("a")) {
      const key = selectedSlot || nearestSlotToGrid(padCursorCol, padCursorRow);
      if (key) {
        if (towerAtSlot(key)) selectedSlot = key;
        else placeTower(key);
        updateHud();
      }
    }
    if (ArcadeGamepad.pressed("x") && selectedSlot && towerAtSlot(selectedSlot)) upgradeSelectedTower();
    if (ArcadeGamepad.pressed("b") && selectedSlot && towerAtSlot(selectedSlot)) sellSelectedTower();
  }

  function cycleTower(dir) {
    const idx = TOWER_TYPES.findIndex((t) => t.id === selectedTowerId);
    selectedTowerId = TOWER_TYPES[(idx + dir + TOWER_TYPES.length) % TOWER_TYPES.length].id;
    renderShop();
  }

  function dealDamageToEnemy(e, amount, towerTypeId) {
    let dmg = amount;
    if (towerTypeId === "pulse" && e.traits.includes("armored")) {
      dmg *= TRAITS.armored.pulseResist;
    }
    if (e.shieldHp > 0) {
      const absorbed = Math.min(e.shieldHp, dmg);
      e.shieldHp -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) e.hp -= dmg;
    return e.hp <= 0;
  }

  function killEnemy(e, pos) {
    if (e._dead) return;
    e._dead = true;
    kills += 1;
    gold += e.reward;
    addScore(e.reward * 3);
    burst(pos.x, pos.y, e.color);
    sfxKill();
  }

  function applyDamage(x, y, damage, splash, slow, towerTypeId, chain) {
    const hitIds = new Set();
    if (chain > 0) {
      const sorted = enemies
        .map((e) => {
          const pos = posAlongPath(e.pathT);
          return { e, pos, dist: Math.hypot(pos.x - x, pos.y - y) };
        })
        .filter((o) => o.dist < 2.5)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, chain);
      for (const { e, pos } of sorted) {
        if (dealDamageToEnemy(e, damage, towerTypeId)) killEnemy(e, pos);
        if (slow > 0) e.slowUntil = performance.now() + slow * 1000;
        hitIds.add(e.id);
      }
    } else {
      for (const e of enemies) {
        const pos = posAlongPath(e.pathT);
        const dist = Math.hypot(pos.x - x, pos.y - y);
        const inRange = splash > 0 ? dist <= splash : dist < e.radius + 0.2;
        if (!inRange) continue;
        const mult = splash > 0 ? 1 - dist / (splash + 0.01) * 0.45 : 1;
        if (dealDamageToEnemy(e, damage * mult, towerTypeId)) killEnemy(e, pos);
        if (slow > 0) e.slowUntil = performance.now() + slow * 1000;
        hitIds.add(e.id);
      }
    }
    enemies = enemies.filter((e) => !e._dead);
    updateHud();
  }

  function update(dt) {
    const simDt = dt * speedMult;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0 && toastEl) toastEl.hidden = true;
    }
    if (shakeT > 0) shakeT -= dt;

    if (!running || gameOver) return;
    readGamepad();
    if (paused) return;

    if (holdSellSlot && holdSellTimer > 0) {
      holdSellTimer -= dt;
      if (holdSellTimer <= 0) {
        selectedSlot = holdSellSlot;
        sellSelectedTower();
        holdSellSlot = null;
      }
    }

    if (autoWave && waveComplete && !waveActive && waveIndex < WAVES.length) {
      autoWaveTimer -= dt;
      if (autoWaveTimer <= 0) startWave();
      updateManageButtons();
    }

    if (waveActive) {
      spawnTimer += simDt;
      while (spawnQueue.length && spawnQueue[0].delay <= spawnTimer) {
        const item = spawnQueue.shift();
        spawnEnemy(item.type, item.traits);
      }
      if (!spawnQueue.length && enemies.length === 0) {
        waveActive = false;
        waveComplete = true;
        const waveBonus = 25 + waveIndex * 8;
        gold += waveBonus;
        addScore(200 + waveIndex * 40);
        showToast(`Wave clear! +${waveBonus}g`);
        if (waveIndex >= 10 && lives === startLives) unlockAchievement("no_leak_10");
        if (waveIndex >= WAVES.length) endGame(true);
        else if (autoWave) autoWaveTimer = 5;
        updateHud();
      }
    }

    for (const e of enemies) {
      let spd = e.speed;
      if (e.slowUntil > performance.now()) spd *= 0.55;
      if (e.traits.includes("regen")) e.hp = Math.min(e.maxHp, e.hp + TRAITS.regen.regenPerSec * simDt);
      e.pathT += (spd * simDt) / pathLength;
      if (e.pathT >= 1) {
        e.pathT = 1;
        lives -= 1;
        leaksThisRun += 1;
        e._dead = true;
        sfxLeak();
        if (lives <= 0) endGame(false);
      }
    }
    enemies = enemies.filter((e) => !e._dead);

    for (const tower of towers) {
      tower.cooldown = Math.max(0, tower.cooldown - simDt);
      const def = towerDef(tower.typeId, tower.level);
      const [c, r] = tower.slot.split(",").map(Number);
      const tx = c + 0.5;
      const ty = r + 0.5;
      if (tower.cooldown > 0) continue;

      const best = pickTarget(tower, def, tx, ty);
      if (!best) continue;

      tower.cooldown = def.fireRate;
      const ang = Math.atan2(best.pos.y - ty, best.pos.x - tx);
      sfxShoot();
      projectiles.push({
        x: tx, y: ty,
        vx: Math.cos(ang) * def.projectileSpeed,
        vy: Math.sin(ang) * def.projectileSpeed,
        damage: def.damage,
        splash: def.splash,
        slow: def.slow,
        chain: def.chain,
        towerTypeId: def.id,
        color: def.accent,
        life: 2,
        homing: def.id === "pulse" || def.id === "frost" || def.id === "sniper",
        targetId: best.e.id,
      });
    }

    for (const p of projectiles) {
      if (p.homing) {
        const target = enemies.find((e) => e.id === p.targetId);
        if (target) {
          const pos = posAlongPath(target.pathT);
          const ang = Math.atan2(pos.y - p.y, pos.x - p.x);
          const spd = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(ang) * spd;
          p.vy = Math.sin(ang) * spd;
        }
      }
      p.x += p.vx * simDt;
      p.y += p.vy * simDt;
      p.life -= simDt;

      let hit = false;
      for (const e of enemies) {
        const pos = posAlongPath(e.pathT);
        if (Math.hypot(pos.x - p.x, pos.y - p.y) < e.radius + 0.15) {
          applyDamage(p.x, p.y, p.damage, p.splash, p.slow, p.towerTypeId, p.chain);
          hit = true;
          break;
        }
      }
      if (hit || p.life <= 0) p._dead = true;
    }
    projectiles = projectiles.filter((p) => !p._dead);

    for (const p of particles) {
      p.life -= simDt;
      p.x += p.vx * simDt;
      p.y += p.vy * simDt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function burst(gx, gy, color) {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      particles.push({ x: gx, y: gy, vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5, life: 0.35, color });
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    let shakeX = 0;
    let shakeY = 0;
    if (shakeT > 0) {
      shakeX = (Math.random() - 0.5) * shakeMag;
      shakeY = (Math.random() - 0.5) * shakeMag;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = "#0a0614";
    ctx.fillRect(0, 0, w, h);

    const cs = cellSize / dpr;
    const ox = offsetX / dpr;
    const oy = offsetY / dpr;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const key = slotKey(c, r);
        const px = ox + c * cs;
        const py = oy + r * cs;
        if (PATH_SET.has(key)) {
          ctx.fillStyle = "#1a1230";
          ctx.fillRect(px, py, cs, cs);
          ctx.strokeStyle = "rgba(125, 249, 255, 0.25)";
          ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
        } else if (BUILD_SLOTS.has(key)) {
          ctx.fillStyle = "#0e0a18";
          ctx.fillRect(px, py, cs, cs);
          ctx.strokeStyle = "rgba(255, 110, 180, 0.18)";
          ctx.setLineDash([3, 4]);
          ctx.strokeRect(px + 4, py + 4, cs - 8, cs - 8);
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = "#080510";
          ctx.fillRect(px, py, cs, cs);
        }
      }
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(125, 249, 255, 0.55)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < pathPoints.length; i++) {
      const p = gridToPx(pathPoints[i].x, pathPoints[i].y);
      const x = p.x / dpr;
      const y = p.y / dpr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const start = gridToPx(pathPoints[0].x, pathPoints[0].y);
    const end = gridToPx(pathPoints[pathPoints.length - 1].x, pathPoints[pathPoints.length - 1].y);
    ctx.font = `${Math.max(10, cs * 0.28)}px VT323, monospace`;
    ctx.fillStyle = "#b8ff6a";
    ctx.fillText("IN", start.x / dpr - 8, start.y / dpr - 10);
    ctx.fillStyle = "#ff6eb4";
    ctx.fillText("CORE", end.x / dpr - 14, end.y / dpr + 18);

    for (const tower of towers) {
      const [c, r] = tower.slot.split(",").map(Number);
      const def = towerDef(tower.typeId, tower.level);
      const cx = ox + (c + 0.5) * cs;
      const cy = oy + (r + 0.5) * cs;
      const rad = cs * 0.32;

      if (selectedSlot === tower.slot) {
        const rr = def.id === "sniper" ? cs * 6 : def.range * cs;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fillStyle = def.accent + "18";
        ctx.fill();
        ctx.strokeStyle = def.accent + "55";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle = "#120a1c";
      ctx.strokeStyle = def.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = def.accent;
      ctx.font = `bold ${Math.max(9, rad * 0.9)}px VT323, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(tower.level), cx, cy);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    for (const e of enemies) {
      const pos = posAlongPath(e.pathT);
      const p = gridToPx(pos.x, pos.y);
      const cx = p.x / dpr;
      const cy = p.y / dpr;
      const rad = e.radius * cs;

      for (const tid of e.traits) {
        const tr = TRAITS[tid];
        if (!tr) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, rad + 4, 0, Math.PI * 2);
        ctx.strokeStyle = tr.color + "99";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = e.color;
      ctx.strokeStyle = "#fff2";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const barW = rad * 2.2;
      const hpPct = e.hp / e.maxHp;
      ctx.fillStyle = "#000a";
      ctx.fillRect(cx - barW / 2, cy - rad - 8, barW, 4);
      ctx.fillStyle = hpPct > 0.5 ? "#b8ff6a" : hpPct > 0.25 ? "#ffe27a" : "#ff6eb4";
      ctx.fillRect(cx - barW / 2, cy - rad - 8, barW * hpPct, 4);
      if (e.maxShieldHp > 0) {
        ctx.fillStyle = "#7df9ff88";
        ctx.fillRect(cx - barW / 2, cy - rad - 12, barW * (e.shieldHp / e.maxShieldHp), 2);
      }
    }

    for (const p of projectiles) {
      const gp = gridToPx(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(gp.x / dpr, gp.y / dpr, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of particles) {
      const gp = gridToPx(p.x, p.y);
      ctx.globalAlpha = p.life / 0.35;
      ctx.fillStyle = p.color;
      ctx.fillRect(gp.x / dpr - 2, gp.y / dpr - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    if (holdSellSlot && holdSellTimer > 0) {
      const [c, r] = holdSellSlot.split(",").map(Number);
      const px = ox + c * cs;
      const py = oy + r * cs;
      const pct = 1 - holdSellTimer / HOLD_SELL_SEC;
      ctx.strokeStyle = "#ff4757";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + cs / 2, py + cs / 2, cs * 0.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
    }

    ctx.restore();
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", (e) => {
    ensureAudio();
    if (!running || gameOver || paused) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
    const { col, row } = pxToGrid(pointerX * dpr, pointerY * dpr);
    const key = slotKey(col, row);
    if (BUILD_SLOTS.has(key) && towerAtSlot(key)) {
      holdSellSlot = key;
      holdSellTimer = HOLD_SELL_SEC;
      selectedSlot = key;
      updateHud();
      return;
    }
    handleGridTap(col, row);
  });

  canvas.addEventListener("pointerup", () => {
    holdSellSlot = null;
    holdSellTimer = 0;
  });

  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
    pointerInside = pointerX >= 0 && pointerY >= 0 && pointerX <= rect.width && pointerY <= rect.height;
  });

  canvas.addEventListener("pointerleave", () => {
    pointerInside = false;
    holdSellSlot = null;
    holdSellTimer = 0;
  });

  window.addEventListener("resize", () => { if (running) resizeCanvas(); });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if (paused) togglePause();
      else if (running && !gameOver) togglePause();
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (mapSelectOverlay && !mapSelectOverlay.hidden) beginFromMapSelect();
      else if (!gameOverOverlay.hidden) showMapSelect();
      else startWave();
    }
    if (e.code === "KeyT" && selectedSlot && towerAtSlot(selectedSlot)) cycleTargetMode();
    for (let i = 1; i <= Math.min(6, TOWER_TYPES.length); i++) {
      if (e.code === "Digit" + i) selectedTowerId = TOWER_TYPES[i - 1].id;
    }
    if (selectedTowerId) renderShop();
  });

  bindTap(document.getElementById("mapStartBtn"), () => beginFromMapSelect());
  bindTap(retryBtn, () => showMapSelect());
  bindTap(sendWaveBtn, () => startWave());
  bindTap(sellBtn, () => sellSelectedTower());
  bindTap(upgradeBtn, () => upgradeSelectedTower());
  bindTap(targetBtn, () => cycleTargetMode());
  bindTap(pauseBtn, () => togglePause());
  bindTap(speedBtn, () => toggleSpeed());
  bindTap(document.getElementById("resumeBtn"), () => togglePause());

  applyMap("core-run");
  renderMapSelect();
  renderAchievements();
  refreshLeaderboards();
  resizeCanvas();
  renderShop();
  updateHud();
  showMapSelect();

  window.__GRID_SENTINEL__ = {
    getState() {
      return {
        running, gameOver, paused, gold, lives, waveIndex, score, selectedMapId, hardMode,
        towerCount: towers.length, enemyCount: enemies.length, waveActive,
      };
    },
    selectMap(id) { selectedMapId = id; applyMap(id); renderMapSelect(); },
    selectTower(id) { selectedTowerId = id; renderShop(); },
    clickPad(col, row) { handleGridTap(col, row); },
    sendWave() { startWave(); },
    begin() { beginFromMapSelect(); },
    setHardMode(v) { hardMode = !!v; if (hardModeToggle) hardModeToggle.checked = hardMode; },
  };

  requestAnimationFrame(loop);
})();
