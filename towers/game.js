/* Grid Sentinel — Bloons-style waves + Defense Grid pad placement */

(function () {
  "use strict";

  const SLUG = "towers";
  const GRID_COLS = 16;
  const GRID_ROWS = 9;

  /** Serpentine lane through the grid (col, row). */
  const PATH = [
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
    [6, 2], [6, 3], [6, 4],
    [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4],
    [0, 5], [0, 6],
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [15, 6],
    [15, 5], [15, 4], [15, 3], [15, 2],
    [14, 2], [13, 2], [12, 2], [11, 2], [10, 2], [9, 2], [8, 2],
    [8, 3], [8, 4], [8, 5],
    [9, 5], [10, 5], [11, 5], [12, 5], [13, 5], [14, 5],
    [14, 4], [14, 3],
    [13, 3], [12, 3], [11, 3], [10, 3], [9, 3],
    [9, 4],
    [10, 4], [11, 4], [12, 4], [13, 4],
  ];

  const PATH_SET = new Set(PATH.map(([c, r]) => `${c},${r}`));

  /** Build pads adjacent to the lane (Manhattan distance 1, not on path). */
  const BUILD_SLOTS = (() => {
    const slots = new Set();
    for (const [c, r] of PATH) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
        const key = `${nc},${nr}`;
        if (!PATH_SET.has(key)) slots.add(key);
      }
    }
    return slots;
  })();

  const TOWER_TYPES = [
    {
      id: "pulse",
      name: "Pulse",
      cost: 50,
      accent: "#7df9ff",
      range: 2.4,
      fireRate: 0.35,
      damage: 8,
      projectileSpeed: 14,
      splash: 0,
      slow: 0,
      desc: "Fast single-target blaster",
    },
    {
      id: "mortar",
      name: "Mortar",
      cost: 90,
      accent: "#ffe27a",
      range: 3.2,
      fireRate: 1.1,
      damage: 22,
      projectileSpeed: 7,
      splash: 1.1,
      slow: 0,
      desc: "Splash damage vs clusters",
    },
    {
      id: "frost",
      name: "Frost",
      cost: 75,
      accent: "#a8d8ff",
      range: 2.2,
      fireRate: 0.55,
      damage: 4,
      projectileSpeed: 10,
      splash: 0,
      slow: 0.45,
      desc: "Slows enemies on hit",
    },
    {
      id: "rail",
      name: "Rail",
      cost: 140,
      accent: "#ff6eb4",
      range: 4.5,
      fireRate: 1.6,
      damage: 55,
      projectileSpeed: 22,
      splash: 0,
      slow: 0,
      desc: "Long range, heavy hit",
    },
  ];

  const ENEMY_TYPES = {
    scout: { name: "Scout", hp: 28, speed: 1.35, reward: 6, radius: 0.28, color: "#b8ff6a" },
    grunt: { name: "Grunt", hp: 55, speed: 0.95, reward: 10, radius: 0.32, color: "#ff9f43" },
    shield: { name: "Shield", hp: 120, speed: 0.72, reward: 18, radius: 0.38, color: "#7df9ff" },
    swarm: { name: "Swarm", hp: 16, speed: 1.55, reward: 4, radius: 0.22, color: "#e056fd" },
    boss: { name: "Boss", hp: 650, speed: 0.55, reward: 80, radius: 0.52, color: "#ff4757" },
  };

  /** @type {Array<{groups: Array<{type: keyof typeof ENEMY_TYPES, count: number, gap?: number}>, reward?: number}>} */
  const WAVES = [
    { groups: [{ type: "scout", count: 8, gap: 0.55 }] },
    { groups: [{ type: "scout", count: 12, gap: 0.45 }] },
    { groups: [{ type: "grunt", count: 6, gap: 0.7 }, { type: "scout", count: 6, gap: 0.4 }] },
    { groups: [{ type: "swarm", count: 18, gap: 0.25 }] },
    { groups: [{ type: "grunt", count: 10, gap: 0.55 }, { type: "shield", count: 2, gap: 1.2 }] },
    { groups: [{ type: "scout", count: 8, gap: 0.35 }, { type: "swarm", count: 14, gap: 0.22 }] },
    { groups: [{ type: "shield", count: 5, gap: 0.85 }] },
    { groups: [{ type: "grunt", count: 14, gap: 0.5 }] },
    { groups: [{ type: "swarm", count: 24, gap: 0.18 }, { type: "shield", count: 3, gap: 0.9 }] },
    { groups: [{ type: "boss", count: 1, gap: 0 }, { type: "scout", count: 10, gap: 0.4 }] },
    { groups: [{ type: "grunt", count: 12, gap: 0.45 }, { type: "shield", count: 6, gap: 0.75 }] },
    { groups: [{ type: "swarm", count: 30, gap: 0.16 }] },
    { groups: [{ type: "shield", count: 8, gap: 0.65 }, { type: "grunt", count: 10, gap: 0.45 }] },
    { groups: [{ type: "scout", count: 16, gap: 0.3 }, { type: "boss", count: 1, gap: 2 }] },
    { groups: [{ type: "grunt", count: 18, gap: 0.4 }, { type: "shield", count: 8, gap: 0.6 }] },
    { groups: [{ type: "swarm", count: 36, gap: 0.14 }, { type: "shield", count: 4, gap: 0.7 }] },
    { groups: [{ type: "boss", count: 2, gap: 3 }, { type: "grunt", count: 12, gap: 0.45 }] },
    { groups: [{ type: "shield", count: 12, gap: 0.55 }] },
    { groups: [{ type: "swarm", count: 40, gap: 0.12 }, { type: "grunt", count: 14, gap: 0.35 }] },
    { groups: [{ type: "boss", count: 3, gap: 2.5 }, { type: "shield", count: 10, gap: 0.5 }, { type: "swarm", count: 20, gap: 0.15 }] },
  ];

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
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const startBtn = document.getElementById("startBtn");
  const retryBtn = document.getElementById("retryBtn");
  const finalScoreEl = document.getElementById("finalScore");
  const finalWaveEl = document.getElementById("finalWave");
  const gameOverTitle = document.getElementById("gameOverTitle");

  let dpr = 1;
  let cellSize = 40;
  let offsetX = 0;
  let offsetY = 0;

  let running = false;
  let gameOver = false;
  let gold = 120;
  let lives = 20;
  let waveIndex = 0;
  let kills = 0;
  let score = 0;
  let selectedTowerId = TOWER_TYPES[0].id;
  /** @type {string | null} */
  let selectedSlot = null;
  /** @type {Array<{slot: string, typeId: string, level: number, cooldown: number}>} */
  let towers = [];
  /** @type {Array<{type: string, hp: number, maxHp: number, pathT: number, slowUntil: number, id: number}>} */
  let enemies = [];
  /** @type {Array<{x: number, y: number, tx: number, ty: number, speed: number, damage: number, splash: number, slow: number, color: string, towerId: number}>} */
  let projectiles = [];
  /** @type {Array<{x: number, y: number, life: number, color: string}>} */
  let particles = [];

  let waveActive = false;
  let waveComplete = true;
  let spawnQueue = [];
  let spawnTimer = 0;
  let enemyIdCounter = 0;

  let pointerX = 0;
  let pointerY = 0;
  let pointerInside = false;
  let padCursorCol = 8;
  let padCursorRow = 4;

  const pathPoints = buildPathPoints();
  const pathLength = computePathLength(pathPoints);

  function buildPathPoints() {
    const pts = [];
    for (let i = 0; i < PATH.length; i++) {
      const [c, r] = PATH[i];
      pts.push({ x: c + 0.5, y: r + 0.5 });
    }
    return pts;
  }

  function computePathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return len;
  }

  function posAlongPath(t) {
    let dist = Math.max(0, Math.min(1, t)) * pathLength;
    for (let i = 1; i < pathPoints.length; i++) {
      const seg = Math.hypot(
        pathPoints[i].x - pathPoints[i - 1].x,
        pathPoints[i].y - pathPoints[i - 1].y,
      );
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
    return {
      x: offsetX + gx * cellSize,
      y: offsetY + gy * cellSize,
    };
  }

  function pxToGrid(px, py) {
    return {
      col: Math.floor((px - offsetX) / cellSize),
      row: Math.floor((py - offsetY) / cellSize),
    };
  }

  function slotKey(c, r) {
    return `${c},${r}`;
  }

  function towerAtSlot(key) {
    return towers.find((t) => t.slot === key) || null;
  }

  function towerDef(typeId, level = 1) {
    const base = TOWER_TYPES.find((t) => t.id === typeId);
    const mult = 1 + (level - 1) * 0.55;
    return {
      ...base,
      damage: base.damage * mult,
      range: base.range * (1 + (level - 1) * 0.08),
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

  function addScore(amount) {
    score += amount;
    scoreEl.textContent = String(score);
  }

  function updateHud() {
    goldEl.textContent = String(gold);
    livesEl.textContent = String(lives);
    waveEl.textContent = String(waveIndex);
    scoreEl.textContent = String(score);
    renderShop();
    updateManageButtons();
  }

  function renderShop() {
    towerShop.innerHTML = "";
    for (const t of TOWER_TYPES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tower-btn" + (selectedTowerId === t.id ? " selected" : "");
      btn.style.setProperty("--accent", t.accent);
      btn.disabled = !running || gameOver || gold < t.cost;
      btn.innerHTML =
        `<span class="name">${t.name}</span>` +
        `<span class="cost">${t.cost}g</span>` +
        `<span class="desc">${t.desc}</span>`;
      bindTap(btn, () => {
        selectedTowerId = t.id;
        selectedSlot = null;
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
      sellBtn.disabled = false;
      upgradeBtn.disabled = gold < upCost || tower.level >= 3;
      upgradeBtn.textContent = tower.level >= 3 ? "Max level" : `Upgrade (${upCost}g)`;
    } else {
      sellBtn.disabled = true;
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = "Upgrade";
    }
    sendWaveBtn.disabled = !running || gameOver || waveActive || !waveComplete || waveIndex >= WAVES.length;
    sendWaveBtn.textContent =
      waveIndex >= WAVES.length ? "All waves cleared" : waveActive ? "Wave in progress…" : "Send Wave";
  }

  function bindTap(el, handler) {
    let last = 0;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - last < 450) return;
      last = now;
      handler(e);
    });
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const pad = 8 * dpr;
    const availW = canvas.width - pad * 2;
    const availH = canvas.height - pad * 2;
    cellSize = Math.floor(Math.min(availW / GRID_COLS, availH / GRID_ROWS));
    offsetX = Math.floor((canvas.width - cellSize * GRID_COLS) / 2);
    offsetY = Math.floor((canvas.height - cellSize * GRID_ROWS) / 2);
  }

  function resetGame() {
    running = true;
    gameOver = false;
    gold = 120;
    lives = 20;
    waveIndex = 0;
    kills = 0;
    score = 0;
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
    startOverlay.hidden = true;
    gameOverOverlay.hidden = true;
    updateHud();
  }

  function startWave() {
    if (!running || gameOver || waveActive || !waveComplete || waveIndex >= WAVES.length) return;
    const wave = WAVES[waveIndex];
    spawnQueue = [];
    for (const group of wave.groups) {
      for (let i = 0; i < group.count; i++) {
        spawnQueue.push({ type: group.type, delay: i * (group.gap ?? 0.6) });
      }
    }
    spawnQueue.sort((a, b) => a.delay - b.delay);
    spawnTimer = 0;
    waveActive = true;
    waveComplete = false;
    waveIndex += 1;
    addScore(100);
    updateHud();
  }

  function spawnEnemy(typeId) {
    const def = ENEMY_TYPES[typeId];
    if (!def) return;
    const hpScale = 1 + waveIndex * 0.12;
    enemies.push({
      id: ++enemyIdCounter,
      type: typeId,
      hp: def.hp * hpScale,
      maxHp: def.hp * hpScale,
      pathT: 0,
      slowUntil: 0,
      ...def,
    });
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
    ArcadeScores.record(SLUG, score);
    ArcadeScores.refresh(SLUG);
  }

  function placeTower(key) {
    if (!BUILD_SLOTS.has(key) || towerAtSlot(key)) return;
    const type = TOWER_TYPES.find((t) => t.id === selectedTowerId);
    if (!type || gold < type.cost) return;
    gold -= type.cost;
    towers.push({ slot: key, typeId: type.id, level: 1, cooldown: 0 });
    selectedSlot = key;
    addScore(15);
    updateHud();
  }

  function sellSelectedTower() {
    const tower = selectedSlot ? towerAtSlot(selectedSlot) : null;
    if (!tower) return;
    gold += sellValue(tower);
    towers = towers.filter((t) => t.slot !== tower.slot);
    selectedSlot = null;
    updateHud();
  }

  function upgradeSelectedTower() {
    const tower = selectedSlot ? towerAtSlot(selectedSlot) : null;
    if (!tower || tower.level >= 3) return;
    const cost = upgradeCost(tower);
    if (gold < cost) return;
    gold -= cost;
    tower.level += 1;
    addScore(25);
    updateHud();
  }

  function handleGridTap(col, row) {
    const key = slotKey(col, row);
    if (BUILD_SLOTS.has(key)) {
      if (towerAtSlot(key)) {
        selectedSlot = key;
      } else if (selectedTowerId) {
        placeTower(key);
      } else {
        selectedSlot = key;
      }
      updateHud();
    }
  }

  function nearestSlotToGrid(col, row) {
    let best = null;
    let bestDist = Infinity;
    for (const key of BUILD_SLOTS) {
      const [c, r] = key.split(",").map(Number);
      const d = Math.abs(c - col) + Math.abs(r - row);
      if (d < bestDist) {
        bestDist = d;
        best = key;
      }
    }
    return best;
  }

  function readGamepad() {
    if (!ArcadeGamepad.connected || !running || gameOver) return;

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
    if (ArcadeGamepad.pressed("y")) {
      startWave();
    }
    if (ArcadeGamepad.pressed("a")) {
      if (startOverlay.hidden === false) {
        resetGame();
        return;
      }
      if (!gameOverOverlay.hidden) {
        resetGame();
        return;
      }
      const key = selectedSlot || nearestSlotToGrid(padCursorCol, padCursorRow);
      if (key) {
        if (towerAtSlot(key)) {
          selectedSlot = key;
        } else {
          placeTower(key);
        }
        updateHud();
      }
    }
    if (ArcadeGamepad.pressed("x") && selectedSlot && towerAtSlot(selectedSlot)) {
      upgradeSelectedTower();
    }
    if (ArcadeGamepad.pressed("b") && selectedSlot && towerAtSlot(selectedSlot)) {
      sellSelectedTower();
    }
  }

  function cycleTower(dir) {
    const idx = TOWER_TYPES.findIndex((t) => t.id === selectedTowerId);
    const next = (idx + dir + TOWER_TYPES.length) % TOWER_TYPES.length;
    selectedTowerId = TOWER_TYPES[next].id;
    renderShop();
  }

  function update(dt) {
    if (!running || gameOver) return;

    readGamepad();

    if (waveActive) {
      spawnTimer += dt;
      while (spawnQueue.length && spawnQueue[0].delay <= spawnTimer) {
        const item = spawnQueue.shift();
        spawnEnemy(item.type);
      }
      if (!spawnQueue.length && enemies.length === 0) {
        waveActive = false;
        waveComplete = true;
        gold += 25 + waveIndex * 8;
        addScore(200 + waveIndex * 40);
        if (waveIndex >= WAVES.length) {
          endGame(true);
        }
        updateHud();
      }
    }

    for (const e of enemies) {
      let speed = e.speed;
      if (e.slowUntil > performance.now()) speed *= 0.55;
      e.pathT += (speed * dt) / pathLength;
      if (e.pathT >= 1) {
        e.pathT = 1;
        lives -= 1;
        e._dead = true;
        if (lives <= 0) {
          endGame(false);
        }
      }
    }
    enemies = enemies.filter((e) => !e._dead);

    for (const tower of towers) {
      tower.cooldown = Math.max(0, tower.cooldown - dt);
      const def = towerDef(tower.typeId, tower.level);
      const [c, r] = tower.slot.split(",").map(Number);
      const tx = c + 0.5;
      const ty = r + 0.5;

      if (tower.cooldown > 0) continue;

      let best = null;
      let bestProg = -1;
      for (const e of enemies) {
        const pos = posAlongPath(e.pathT);
        const dist = Math.hypot(pos.x - tx, pos.y - ty);
        if (dist <= def.range && e.pathT > bestProg) {
          bestProg = e.pathT;
          best = { e, pos };
        }
      }
      if (!best) continue;

      tower.cooldown = def.fireRate;
      const ang = Math.atan2(best.pos.y - ty, best.pos.x - tx);
      projectiles.push({
        x: tx,
        y: ty,
        tx: best.pos.x,
        ty: best.pos.y,
        vx: Math.cos(ang) * def.projectileSpeed,
        vy: Math.sin(ang) * def.projectileSpeed,
        damage: def.damage,
        splash: def.splash,
        slow: def.slow,
        color: def.accent,
        life: 2,
        homing: def.id === "pulse" || def.id === "frost",
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
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      let hit = false;
      for (const e of enemies) {
        const pos = posAlongPath(e.pathT);
        const dist = Math.hypot(pos.x - p.x, pos.y - p.y);
        if (dist < e.radius + 0.15) {
          applyDamage(p.x, p.y, p.damage, p.splash, p.slow);
          hit = true;
          break;
        }
      }
      if (hit || p.life <= 0) p._dead = true;
    }
    projectiles = projectiles.filter((p) => !p._dead);

    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function applyDamage(x, y, damage, splash, slow) {
    for (const e of enemies) {
      const pos = posAlongPath(e.pathT);
      const dist = Math.hypot(pos.x - x, pos.y - y);
      const inRange = splash > 0 ? dist <= splash : dist < e.radius + 0.2;
      if (!inRange) continue;
      const mult = splash > 0 ? 1 - dist / (splash + 0.01) * 0.45 : 1;
      e.hp -= damage * mult;
      if (slow > 0) e.slowUntil = performance.now() + slow * 1000;
      if (e.hp <= 0 && !e._dead) {
        e._dead = true;
        kills += 1;
        gold += e.reward;
        addScore(e.reward * 3);
        burst(pos.x, pos.y, e.color);
      }
    }
    enemies = enemies.filter((e) => !e._dead);
    updateHud();
  }

  function burst(gx, gy, color) {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      particles.push({
        x: gx,
        y: gy,
        vx: Math.cos(a) * 2.5,
        vy: Math.sin(a) * 2.5,
        life: 0.35,
        color,
      });
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#0a0614";
    ctx.fillRect(0, 0, w, h);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const key = slotKey(c, r);
        const px = offsetX / dpr + c * (cellSize / dpr);
        const py = offsetY / dpr + r * (cellSize / dpr);
        const cs = cellSize / dpr;
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
    ctx.fillStyle = "#b8ff6a";
    ctx.font = `${Math.max(10, cellSize / dpr * 0.28)}px VT323, monospace`;
    ctx.fillText("IN", start.x / dpr - 8, start.y / dpr - 10);
    ctx.fillStyle = "#ff6eb4";
    ctx.fillText("CORE", end.x / dpr - 14, end.y / dpr + 18);

    for (const tower of towers) {
      const [c, r] = tower.slot.split(",").map(Number);
      const def = towerDef(tower.typeId, tower.level);
      const center = gridToPx(c + 0.5, r + 0.5);
      const cx = center.x / dpr;
      const cy = center.y / dpr;
      const rad = (cellSize / dpr) * 0.32;

      if (selectedSlot === tower.slot) {
        ctx.beginPath();
        ctx.arc(cx, cy, def.range * (cellSize / dpr), 0, Math.PI * 2);
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

    if (selectedSlot && !towerAtSlot(selectedSlot) && BUILD_SLOTS.has(selectedSlot)) {
      const [c, r] = selectedSlot.split(",").map(Number);
      const def = TOWER_TYPES.find((t) => t.id === selectedTowerId);
      const center = gridToPx(c + 0.5, r + 0.5);
      const cx = center.x / dpr;
      const cy = center.y / dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, def.range * (cellSize / dpr), 0, Math.PI * 2);
      ctx.fillStyle = def.accent + "12";
      ctx.fill();
      ctx.strokeStyle = def.accent + "66";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const e of enemies) {
      const pos = posAlongPath(e.pathT);
      const p = gridToPx(pos.x, pos.y);
      const cx = p.x / dpr;
      const cy = p.y / dpr;
      const rad = e.radius * (cellSize / dpr);
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

    if (ArcadeGamepad.connected && running && !gameOver) {
      const key = selectedSlot || nearestSlotToGrid(padCursorCol, padCursorRow);
      if (key) {
        const [c, r] = key.split(",").map(Number);
        const px = offsetX / dpr + c * (cellSize / dpr);
        const py = offsetY / dpr + r * (cellSize / dpr);
        const cs = cellSize / dpr;
        ctx.strokeStyle = "#ffffff88";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
      }
    }

    if (pointerInside && running && !gameOver) {
      const { col, row } = pxToGrid(pointerX * dpr, pointerY * dpr);
      const key = slotKey(col, row);
      if (BUILD_SLOTS.has(key)) {
        const px = offsetX / dpr + col * (cellSize / dpr);
        const py = offsetY / dpr + row * (cellSize / dpr);
        const cs = cellSize / dpr;
        ctx.strokeStyle = "#ffffff44";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
      }
    }
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
    if (!running || gameOver) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
    const { col, row } = pxToGrid(pointerX * dpr, pointerY * dpr);
    handleGridTap(col, row);
  });

  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
    pointerInside =
      pointerX >= 0 && pointerY >= 0 && pointerX <= rect.width && pointerY <= rect.height;
  });

  canvas.addEventListener("pointerleave", () => {
    pointerInside = false;
  });

  window.addEventListener("resize", resizeCanvas);

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (!startOverlay.hidden) resetGame();
      else if (!gameOverOverlay.hidden) resetGame();
      else startWave();
    }
    if (e.code === "Digit1") selectedTowerId = TOWER_TYPES[0].id;
    if (e.code === "Digit2") selectedTowerId = TOWER_TYPES[1].id;
    if (e.code === "Digit3") selectedTowerId = TOWER_TYPES[2].id;
    if (e.code === "Digit4") selectedTowerId = TOWER_TYPES[3].id;
    if (selectedTowerId) renderShop();
  });

  bindTap(startBtn, () => resetGame());
  bindTap(retryBtn, () => resetGame());
  bindTap(sendWaveBtn, () => startWave());
  bindTap(sellBtn, () => sellSelectedTower());
  bindTap(upgradeBtn, () => upgradeSelectedTower());

  resizeCanvas();
  renderShop();
  updateHud();
  ArcadeScores.refresh(SLUG);
  requestAnimationFrame(loop);
})();
