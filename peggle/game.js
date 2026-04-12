(function () {
  const canvas = document.getElementById("game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("scoreVal");
  const shotsEl = document.getElementById("shotsVal");
  const levelEl = document.getElementById("levelVal");
  const restartBtn = document.getElementById("restartBtn");

  const W = canvas.width;
  const H = canvas.height;

  const LAUNCH = { x: W * 0.5, y: 46 };
  const BALL_R = 7;
  const PEG_R = 11;
  const GRAVITY = 920;
  const LAUNCH_SPEED = 520;
  const MAX_DT = 1 / 30;
  const BUCKET_H = 38;
  const BUCKET_TOP = H - BUCKET_H;
  const BUCKET_BONUS = [120, 220, 500, 220, 120];

  let level = 1;
  let score = 0;
  let shotsLeft = 10;
  /** @type {"idle"|"flying"|"done"} */
  let phase = "idle";
  let mouseX = LAUNCH.x;
  let mouseY = LAUNCH.y + 120;

  /** @type {{x:number,y:number,vx:number,vy:number,bucketResolved?:boolean}|null} */
  let ball = null;

  /** @type {Array<{x:number,y:number,r:number,kind:"blue"|"green"|"purple"|"orange",alive:boolean}>} */
  let pegs = [];

  function bucketX0(i) {
    const pad = 48;
    const inner = W - pad * 2;
    return pad + (inner * i) / 5;
  }

  function buildPegs(lv) {
    const list = [];
    const rows = 7 + Math.min(3, Math.floor(lv / 2));
    const cols = 11;
    const top = 76 + (lv % 3) * 6;
    const rowGap = (BUCKET_TOP - top - 40) / (rows - 0.5);
    const colGap = (W - 100) / (cols - 1);
    const baseX = 50;
    for (let row = 0; row < rows; row++) {
      const stagger = (row % 2) * (colGap * 0.5);
      for (let c = 0; c < cols - (row % 2); c++) {
        const x = baseX + c * colGap + stagger;
        const y = top + row * rowGap;
        const roll = Math.random();
        let kind = "blue";
        if (roll > 0.82) kind = "green";
        else if (roll > 0.94) kind = "purple";
        list.push({ x, y, r: PEG_R, kind, alive: true });
      }
    }
    const alivePegs = list.filter((p) => p.alive);
    if (alivePegs.length) {
      const pick = alivePegs[(Math.random() * alivePegs.length) | 0];
      pick.kind = "orange";
    }
    return list;
  }

  function pegColor(kind) {
    switch (kind) {
      case "orange":
        return { fill: "#ff9100", stroke: "#ffe0b2", glow: "rgba(255,145,0,0.45)" };
      case "green":
        return { fill: "#69f0ae", stroke: "#b9f6ca", glow: "rgba(105,240,174,0.35)" };
      case "purple":
        return { fill: "#b388ff", stroke: "#ea80fc", glow: "rgba(179,136,255,0.4)" };
      default:
        return { fill: "#40c4ff", stroke: "#80d8ff", glow: "rgba(64,196,255,0.35)" };
    }
  }

  function pegPoints(kind) {
    if (kind === "orange") return 250;
    if (kind === "green") return 50;
    if (kind === "purple") return 75;
    return 25;
  }

  function resetRun() {
    level = 1;
    score = 0;
    shotsLeft = 10;
    phase = "idle";
    ball = null;
    pegs = buildPegs(level);
    syncHud();
  }

  function syncHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (shotsEl) shotsEl.textContent = String(shotsLeft);
    if (levelEl) levelEl.textContent = String(level);
  }

  function refreshLb() {
    if (window.ArcadeScores) ArcadeScores.refresh("peggle");
  }

  function finalizeGame() {
    phase = "done";
    if (window.ArcadeScores) ArcadeScores.record("peggle", score);
    refreshLb();
  }

  function nextLevel() {
    level += 1;
    pegs = buildPegs(level);
    shotsLeft = Math.min(12, 8 + Math.floor(level / 3));
    phase = "idle";
    ball = null;
    syncHud();
  }

  function aimVector() {
    let dx = mouseX - LAUNCH.x;
    let dy = mouseY - LAUNCH.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) dy = 1;
    if (dy < 0.08) {
      dy = 0.08;
    }
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    return { x: dx, y: dy };
  }

  function fire() {
    if (phase !== "idle" || shotsLeft <= 0) return;
    const dir = aimVector();
    shotsLeft -= 1;
    ball = {
      x: LAUNCH.x + dir.x * (BALL_R + 4),
      y: LAUNCH.y + dir.y * (BALL_R + 4),
      vx: dir.x * LAUNCH_SPEED,
      vy: dir.y * LAUNCH_SPEED,
    };
    phase = "flying";
    syncHud();
  }

  function resolveCircleStatic(bx, by, br, px, py, pr) {
    const dx = bx - px;
    const dy = by - py;
    const dist = Math.hypot(dx, dy);
    const minD = br + pr;
    if (dist >= minD || dist < 1e-6) return null;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minD - dist;
    return { nx, ny, overlap };
  }

  function bounceStatic(ballObj, nx, ny, rest = 0.9) {
    const vdot = ballObj.vx * nx + ballObj.vy * ny;
    if (vdot < 0) {
      ballObj.vx -= 2 * vdot * nx;
      ballObj.vy -= 2 * vdot * ny;
    }
    ballObj.vx *= rest;
    ballObj.vy *= rest;
  }

  function bucketIndexAt(x) {
    for (let i = 0; i < 5; i++) {
      const x0 = bucketX0(i);
      const x1 = bucketX0(i + 1);
      if (x >= x0 && x <= x1) return i;
    }
    return 2;
  }

  function endShot(bucketIndex) {
    ball = null;
    if (bucketIndex != null) {
      score += BUCKET_BONUS[bucketIndex];
    }
    const alive = pegs.filter((p) => p.alive).length;
    if (alive === 0) {
      score += 1500 + level * 200;
      syncHud();
      if (shotsLeft > 0) {
        nextLevel();
        return;
      }
    }
    if (shotsLeft <= 0) {
      const orangeLeft = pegs.some((p) => p.alive && p.kind === "orange");
      if (!orangeLeft) score += 800;
      finalizeGame();
      return;
    }
    if (alive === 0) {
      return;
    }
    phase = "idle";
    syncHud();
  }

  function update(dt) {
    if (phase !== "flying" || !ball) return;
    let t = Math.min(dt, MAX_DT);
    const sub = Math.max(1, Math.ceil(t * 100));
    const h = t / sub;
    for (let s = 0; s < sub; s++) {
      ball.vy += GRAVITY * h;
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;

      if (ball.x < BALL_R) {
        ball.x = BALL_R;
        ball.vx = Math.abs(ball.vx) * 0.88;
      } else if (ball.x > W - BALL_R) {
        ball.x = W - BALL_R;
        ball.vx = -Math.abs(ball.vx) * 0.88;
      }
      if (ball.y < BALL_R) {
        ball.y = BALL_R;
        ball.vy = Math.abs(ball.vy) * 0.82;
      }

      for (const peg of pegs) {
        if (!peg.alive) continue;
        const col = resolveCircleStatic(ball.x, ball.y, BALL_R, peg.x, peg.y, peg.r);
        if (!col) continue;
        ball.x += col.nx * col.overlap;
        ball.y += col.ny * col.overlap;
        bounceStatic(ball, col.nx, col.ny, 0.91);
        peg.alive = false;
        score += pegPoints(peg.kind);
        syncHud();
      }

      const aliveAfter = pegs.filter((p) => p.alive).length;
      if (aliveAfter === 0) {
        score += 1500 + level * 200;
        syncHud();
        nextLevel();
        return;
      }

      if (!ball.bucketResolved && ball.vy > 0 && ball.y + BALL_R > BUCKET_TOP + 6) {
        ball.bucketResolved = true;
        endShot(bucketIndexAt(ball.x));
        return;
      }

      if (ball.y - BALL_R > H + 8) {
        endShot(null);
        return;
      }
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (phase === "flying") update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function drawBuckets() {
    for (let i = 0; i < 5; i++) {
      const x0 = bucketX0(i);
      const x1 = bucketX0(i + 1);
      const grd = ctx.createLinearGradient(x0, BUCKET_TOP, x0, H);
      grd.addColorStop(0, i === 2 ? "rgba(255,213,79,0.35)" : "rgba(124,77,255,0.2)");
      grd.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = grd;
      ctx.fillRect(x0, BUCKET_TOP, x1 - x0, H - BUCKET_TOP);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(x0 + 0.5, BUCKET_TOP + 0.5, x1 - x0 - 1, H - BUCKET_TOP - 1);
    }
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < 5; i++) {
      const cx = (bucketX0(i) + bucketX0(i + 1)) * 0.5;
      ctx.fillText(String(BUCKET_BONUS[i]), cx, H - 10);
    }
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a0d2e");
    g.addColorStop(0.55, "#0d0820");
    g.addColorStop(1, "#06030f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    drawBuckets();

    for (const peg of pegs) {
      if (!peg.alive) continue;
      const c = pegColor(peg.kind);
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
      ctx.fillStyle = c.fill;
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = peg.kind === "orange" ? 18 : 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = peg.kind === "orange" ? 2.5 : 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, LAUNCH.y - 2, W, 8);

    if (phase === "idle" || phase === "flying") {
      const dir = aimVector();
      ctx.strokeStyle = "rgba(255,224,130,0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(LAUNCH.x, LAUNCH.y);
      ctx.lineTo(LAUNCH.x + dir.x * 120, LAUNCH.y + dir.y * 120);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "#37474f";
    ctx.strokeStyle = "#78909c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(LAUNCH.x, LAUNCH.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (ball) {
      const shine = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, BALL_R);
      shine.addColorStop(0, "#fffde7");
      shine.addColorStop(0.35, "#ffee58");
      shine.addColorStop(1, "#f9a825");
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = shine;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (phase === "done") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Run complete", W / 2, H / 2 - 18);
      ctx.font = "18px system-ui,sans-serif";
      ctx.fillStyle = "#ffecb3";
      ctx.fillText(`Score ${score} · click or press R to play again`, W / 2, H / 2 + 18);
    }
  }

  function canvasToLogical(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    return {
      x: (clientX - r.left) * sx,
      y: (clientY - r.top) * sy,
    };
  }

  canvas.addEventListener("mousemove", (e) => {
    const p = canvasToLogical(e.clientX, e.clientY);
    mouseX = p.x;
    mouseY = p.y;
  });

  canvas.addEventListener(
    "click",
    () => {
      if (phase === "done") {
        resetRun();
        return;
      }
      fire();
    },
    { passive: true }
  );

  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyR") {
      if (phase === "idle" || phase === "done") resetRun();
    }
  });

  restartBtn?.addEventListener("click", () => resetRun());

  resetRun();
  refreshLb();
  requestAnimationFrame(loop);
})();
