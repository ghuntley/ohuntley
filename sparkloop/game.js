const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const cx = canvas.width / 2;
const cy = canvas.height / 2;
const R = 118;
let angle = 0;
let dir = 1;
let speed = 0.032;
let sparks = [];
let voids = [];
let score = 0;
let started = false;
let alive = true;

function flip() {
  if (!started) {
    started = true;
    alive = true;
    document.getElementById("st").textContent = "Flip polarity";
    return;
  }
  if (!alive) {
    angle = 0;
    dir = 1;
    sparks = [];
    voids = [];
    score = 0;
    alive = true;
    document.getElementById("sc").textContent = "0";
    document.getElementById("st").textContent = "Flip polarity";
    return;
  }
  dir *= -1;
}

canvas.addEventListener("click", flip);
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    flip();
  }
});

function inVoid(a) {
  for (const v of voids) {
    let d = a - v.a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < v.w / 2) return true;
  }
  return false;
}

function loop() {
  ctx.fillStyle = "#080818";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#283593";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  if (started && alive) {
    angle += dir * speed;
    speed = Math.min(0.065, speed + 0.000012);
    if (Math.random() < 0.03)
      sparks.push({ a: Math.random() * Math.PI * 2, taken: false });
    if (Math.random() < 0.016)
      voids.push({
        a: Math.random() * Math.PI * 2,
        w: 0.5 + Math.random() * 0.35,
        life: 380,
      });

    for (const v of voids) {
      v.life--;
      ctx.strokeStyle = "rgba(55,71,79,0.85)";
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, R, v.a - v.w / 2, v.a + v.w / 2);
      ctx.stroke();
    }
    voids = voids.filter((v) => v.life > 0);

    const sx = cx + Math.cos(angle) * R;
    const sy = cy + Math.sin(angle) * R;
    if (inVoid(angle)) {
      alive = false;
      document.getElementById("st").textContent = "Click retry";
    }

    for (const s of sparks) {
      const x = cx + Math.cos(s.a) * R;
      const y = cy + Math.sin(s.a) * R;
      ctx.fillStyle = s.taken ? "#333" : "#ffea00";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      if (!s.taken && Math.hypot(sx - x, sy - y) < 16) {
        s.taken = true;
        score += 5;
        document.getElementById("sc").textContent = String(score);
      }
    }
    sparks = sparks.filter((s) => !s.taken);

    ctx.fillStyle = alive ? "#7c4dff" : "#444";
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, Math.PI * 2);
    ctx.fill();
  } else if (!alive) {
    const sx = cx + Math.cos(angle) * R;
    const sy = cy + Math.sin(angle) * R;
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#7c4dff";
    ctx.beginPath();
    ctx.arc(cx + R, cy, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  requestAnimationFrame(loop);
}
loop();
