const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const lanes = 3;
const lw = canvas.width / lanes;
let lane = 1;
let walls = [];
let score = 0;
let speed = 2.8;
let alive = true;
let acc = 0;

function hop() {
  if (!alive) {
    lane = 1;
    walls = [];
    score = 0;
    speed = 2.8;
    alive = true;
    document.getElementById("sc").textContent = "0";
    document.getElementById("st").textContent = "Space to hop lanes";
    return;
  }
  lane = (lane + 1) % lanes;
}

canvas.addEventListener("click", hop);
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    hop();
  }
});

function spawnWall() {
  const blocked = (Math.random() * lanes) | 0;
  const h = 52 + (Math.random() * 30) | 0;
  walls.push({ y: -h, h, blocked });
}

function loop() {
  acc++;
  if (alive) {
    if (acc % 48 === 0) spawnWall();
    for (const w of walls) {
      w.y += speed;
      const playerY = canvas.height - 72;
      if (w.y + w.h > playerY && w.y < playerY + 28 && w.blocked === lane) {
        alive = false;
        document.getElementById("st").textContent = "Click / Space retry";
      }
    }
    walls = walls.filter((w) => w.y < canvas.height + 20);
    if (alive) {
      score += 0.12;
      speed = Math.min(6.5, 2.8 + score * 0.006);
      document.getElementById("sc").textContent = String((score | 0));
    }
  }

  ctx.fillStyle = "#051820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 1; i < lanes; i++) {
    ctx.strokeStyle = "#0d3d4d";
    ctx.beginPath();
    ctx.moveTo(i * lw, 0);
    ctx.lineTo(i * lw, canvas.height);
    ctx.stroke();
  }
  for (const w of walls) {
    for (let L = 0; L < lanes; L++) {
      if (L === w.blocked) {
        ctx.fillStyle = "#b71c1c";
        ctx.fillRect(L * lw + 4, w.y, lw - 8, w.h);
      }
    }
  }
  const py = canvas.height - 68;
  ctx.fillStyle = alive ? "#00e676" : "#555";
  ctx.fillRect(lane * lw + lw / 2 - 16, py, 32, 26);
  ctx.fillStyle = "#fff";
  ctx.font = "11px monospace";
  ctx.fillText("YOU", lane * lw + lw / 2 - 14, py + 17);
  requestAnimationFrame(loop);
}

loop();
