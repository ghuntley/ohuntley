(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("scoreVal");
  const levelEl = document.getElementById("levelVal");
  const lenEl = document.getElementById("lenVal");
  const pauseOverlay = document.getElementById("pauseOverlay");

  const COLS = 80;
  const ROWS = 50;
  const CELL = 8;
  const SLUG = "nibbles";

  /** @type {0|1|2|3} 0 up 1 right 2 down 3 left */
  const DIR_UP = 0;
  const DIR_RIGHT = 1;
  const DIR_DOWN = 2;
  const DIR_LEFT = 3;
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];

  let walls = new Uint8Array(COLS * ROWS);
  /** @type {{x:number,y:number}[]} head at index 0 */
  let snake = [];
  let dir = DIR_RIGHT;
  let queuedDir = DIR_RIGHT;
  let food = { x: 0, y: 0, digit: 3 };
  let score = 0;
  let level = 1;
  let growDebt = 0;
  let tickMs = 100;
  let lastTick = 0;
  let raf = 0;
  let paused = false;
  let playing = false;
  let gameOver = false;

  function idx(x, y) {
    return y * COLS + x;
  }

  function clearWalls() {
    walls = new Uint8Array(COLS * ROWS);
  }

  function setRect(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) walls[idx(x, y)] = 1;
      }
    }
  }

  function buildBorder() {
    setRect(0, 0, COLS - 1, 0);
    setRect(0, ROWS - 1, COLS - 1, ROWS - 1);
    setRect(0, 0, 0, ROWS - 1);
    setRect(COLS - 1, 0, COLS - 1, ROWS - 1);
  }

  /** Interior obstacles inspired by classic nibbles mazes (grid coords inside border). */
  function buildLevelMaze(lv) {
    clearWalls();
    buildBorder();
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);

    if (lv >= 2) {
      setRect(cx - 1, 8, cx + 1, ROWS - 9);
      setRect(8, cy - 1, COLS - 9, cy + 1);
    }
    if (lv >= 3) {
      setRect(12, 12, COLS - 13, 14);
      setRect(12, ROWS - 15, COLS - 13, ROWS - 13);
    }
    if (lv >= 4) {
      setRect(20, 18, 22, ROWS - 19);
      setRect(COLS - 23, 18, COLS - 21, ROWS - 19);
    }
    if (lv >= 5) {
      setRect(28, 10, 32, ROWS - 11);
      setRect(COLS - 33, 10, COLS - 29, ROWS - 11);
    }
    if (lv >= 6) {
      setRect(6, 6, COLS - 7, 8);
      setRect(6, ROWS - 9, COLS - 7, ROWS - 7);
    }

    /* Keep a clear pocket at the center so level-up mazes cannot brick the whole run. */
    const r = 5 + Math.min(4, lv);
    for (let y = cy - r; y <= cy + r; y += 1) {
      for (let x = cx - r * 2; x <= cx + r * 2; x += 1) {
        if (x > 0 && x < COLS - 1 && y > 0 && y < ROWS - 1) walls[idx(x, y)] = 0;
      }
    }
  }

  /** After a maze rebuild, never leave the snake embedded in new walls. */
  function carveSnakeThroughWalls() {
    for (let i = 0; i < snake.length; i += 1) {
      const s = snake[i];
      if (s.x >= 0 && s.x < COLS && s.y >= 0 && s.y < ROWS) walls[idx(s.x, s.y)] = 0;
    }
  }

  function cellFree(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (walls[idx(x, y)]) return false;
    for (let i = 0; i < snake.length; i += 1) {
      if (snake[i].x === x && snake[i].y === y) return false;
    }
    return true;
  }

  function randomDigit() {
    return 1 + Math.floor(Math.random() * 9);
  }

  function spawnFood() {
    const free = [];
    for (let y = 1; y < ROWS - 1; y += 1) {
      for (let x = 1; x < COLS - 1; x += 1) {
        if (cellFree(x, y)) free.push({ x, y });
      }
    }
    if (!free.length) {
      food = { x: -1, y: -1, digit: 0 };
      return;
    }
    const spot = free[Math.floor(Math.random() * free.length)];
    food = { x: spot.x, y: spot.y, digit: randomDigit() };
  }

  function resetRun() {
    buildLevelMaze(level);
    const startX = Math.floor(COLS / 4);
    const startY = Math.floor(ROWS / 2);
    snake = [
      { x: startX + 2, y: startY },
      { x: startX + 1, y: startY },
      { x: startX, y: startY },
    ];
    dir = DIR_RIGHT;
    queuedDir = DIR_RIGHT;
    growDebt = 0;
    score = 0;
    gameOver = false;
    tickMs = Math.max(38, 108 - (level - 1) * 6);
    spawnFood();
    updateHud();
  }

  function startGame() {
    level = 1;
    resetRun();
    playing = true;
    paused = false;
    pauseOverlay.hidden = true;
    lastTick = performance.now();
    canvas.focus();
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    levelEl.textContent = String(level);
    lenEl.textContent = String(snake.length + growDebt);
  }

  function tryQueueDir(newDir) {
    if ((newDir + 2) % 4 === dir) return;
    queuedDir = newDir;
  }

  function onKeyDown(e) {
    if (e.code === "KeyP" || e.code === "Escape") {
      if (!playing || gameOver) return;
      paused = !paused;
      pauseOverlay.hidden = !paused;
      if (!paused) lastTick = performance.now();
      e.preventDefault();
      return;
    }

    if (e.code === "KeyR") {
      startGame();
      e.preventDefault();
      return;
    }

    if (e.code === "Space") {
      if (!playing || gameOver) {
        if (gameOver) level = 1;
        startGame();
      }
      e.preventDefault();
      return;
    }

    if (!playing || gameOver || paused) return;

    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        tryQueueDir(DIR_UP);
        e.preventDefault();
        break;
      case "ArrowDown":
      case "KeyS":
        tryQueueDir(DIR_DOWN);
        e.preventDefault();
        break;
      case "ArrowLeft":
      case "KeyA":
        tryQueueDir(DIR_LEFT);
        e.preventDefault();
        break;
      case "ArrowRight":
      case "KeyD":
        tryQueueDir(DIR_RIGHT);
        e.preventDefault();
        break;
      default:
        break;
    }
  }

  function tick() {
    const nd = queuedDir;
    if ((nd + 2) % 4 !== dir) dir = nd;
    const head = snake[0];
    const nx = head.x + DX[dir];
    const ny = head.y + DY[dir];

    if (!cellFree(nx, ny)) {
      endGame();
      return;
    }

    const eating = nx === food.x && ny === food.y && food.digit > 0;
    snake.unshift({ x: nx, y: ny });

    if (eating) {
      const d = food.digit;
      score += d * 5 * level;
      growDebt += d;
      const nextLevel = Math.min(12, 1 + Math.floor(score / 200));
      if (nextLevel > level) {
        level = nextLevel;
        buildLevelMaze(level);
        carveSnakeThroughWalls();
        tickMs = Math.max(38, 108 - (level - 1) * 6);
      }
      spawnFood();
      if (food.digit === 0 && food.x < 0) {
        growDebt = 0;
      }
    }

    if (growDebt > 0) {
      growDebt -= 1;
    } else {
      snake.pop();
    }

    updateHud();
  }

  function endGame() {
    playing = false;
    gameOver = true;
    paused = false;
    pauseOverlay.hidden = true;
    if (typeof ArcadeScores !== "undefined" && typeof ArcadeScores.record === "function") {
      ArcadeScores.record(SLUG, score);
      ArcadeScores.refresh(SLUG);
    }
  }

  function draw() {
    ctx.fillStyle = "#0000aa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#5555aa";
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (walls[idx(x, y)]) {
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }

    ctx.fillStyle = "#00ffff";
    for (let i = 0; i < snake.length; i += 1) {
      const s = snake[i];
      const pad = i === 0 ? 0 : 1;
      ctx.fillRect(s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
    }

    if (food.digit > 0 && food.x >= 0) {
      ctx.fillStyle = "#ffff55";
      ctx.font = "bold 10px monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(String(food.digit), food.x * CELL + CELL / 2, food.y * CELL + CELL / 2);
      ctx.textAlign = "left";
    }

    if (!playing) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "28px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (gameOver) {
        ctx.fillText("Game over", canvas.width / 2, canvas.height / 2 - 16);
        ctx.font = "18px monospace";
        ctx.fillText(`Score ${score} · Space to play again`, canvas.width / 2, canvas.height / 2 + 14);
      } else {
        ctx.fillText("Nibbles", canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = "18px monospace";
        ctx.fillText("Space to start", canvas.width / 2, canvas.height / 2 + 18);
      }
      ctx.textAlign = "left";
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!playing || paused || gameOver) {
      draw();
      return;
    }
    while (now - lastTick >= tickMs) {
      lastTick += tickMs;
      tick();
      if (!playing || gameOver) break;
    }
    draw();
  }

  window.addEventListener("keydown", onKeyDown);
  lastTick = performance.now();
  raf = requestAnimationFrame(loop);

  if (typeof ArcadeScores !== "undefined" && typeof ArcadeScores.refresh === "function") {
    ArcadeScores.refresh(SLUG);
  }
})();
