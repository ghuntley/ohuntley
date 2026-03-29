const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const G = 20;
const W = canvas.width / G;
const H = canvas.height / G;
const ECHO_TURNS = 9;
const CORES = 5;

let px, py, echoes, cores, collected, pendingMove, alive;

function reset() {
  px = (W / 2) | 0;
  py = (H / 2) | 0;
  echoes = [];
  collected = 0;
  pendingMove = null;
  alive = true;
  cores = [];
  const used = new Set([`${px},${py}`]);
  while (cores.length < CORES) {
    const x = (Math.random() * W) | 0;
    const y = (Math.random() * H) | 0;
    const k = `${x},${y}`;
    if (used.has(k)) continue;
    used.add(k);
    cores.push({ x, y });
  }
  document.getElementById("tot").textContent = String(CORES);
  document.getElementById("co").textContent = "0";
}

function echoHeat() {
  return echoes.filter((e) => e.t > 0).length;
}

document.addEventListener("keydown", (e) => {
  if (!alive) {
    if (e.key === "r" || e.key === "R") reset();
    return;
  }
  let dx = 0,
    dy = 0;
  if (e.key === "ArrowUp") dy = -1;
  if (e.key === "ArrowDown") dy = 1;
  if (e.key === "ArrowLeft") dx = -1;
  if (e.key === "ArrowRight") dx = 1;
  if (!dx && !dy) return;
  pendingMove = { dx, dy };
});

function tick() {
  if (!alive) return;
  for (const e of echoes) {
    if (e.t > 0) e.t--;
  }
  echoes = echoes.filter((e) => e.t > 0 || e.flash > 0);
  if (pendingMove) {
    const { dx, dy } = pendingMove;
    pendingMove = null;
    echoes.push({ x: px, y: py, t: ECHO_TURNS, flash: 3 });
    px += dx;
    py += dy;
    if (px < 0 || px >= W || py < 0 || py >= H) {
      alive = false;
      return;
    }
    if (echoes.some((e) => e.x === px && e.y === py && e.t > 0)) {
      alive = false;
      return;
    }
    const hit = cores.findIndex((c) => c.x === px && c.y === py);
    if (hit >= 0) {
      cores.splice(hit, 1);
      collected++;
      document.getElementById("co").textContent = String(collected);
      if (collected >= CORES) reset();
    }
  }
  document.getElementById("eh").textContent = String(echoHeat());
}

function draw() {
  ctx.fillStyle = "#0c0c18";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = "#101022";
        ctx.fillRect(x * G, y * G, G, G);
      }
    }
  for (const e of echoes) {
    const a = e.t / ECHO_TURNS;
    ctx.fillStyle = `rgba(124, 77, 255, ${0.15 + a * 0.55})`;
    ctx.fillRect(e.x * G + 1, e.y * G + 1, G - 2, G - 2);
  }
  for (const c of cores) {
    ctx.fillStyle = "#ffea00";
    ctx.beginPath();
    ctx.arc(c.x * G + G / 2, c.y * G + G / 2, G / 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = alive ? "#00e5ff" : "#555";
  ctx.beginPath();
  ctx.arc(px * G + G / 2, py * G + G / 2, G / 2.6, 0, Math.PI * 2);
  ctx.fill();
  if (!alive) {
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.fillText("Echo collision — R to weave again", 70, canvas.height / 2);
  }
}

setInterval(() => {
  tick();
  draw();
}, 130);
reset();
draw();
