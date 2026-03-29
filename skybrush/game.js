const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
let knots = [];
let score = 0;
let hp = 100;
let drawing = false;
let last = null;
let cooldown = 0;
let acc = 0;

function pos(e) {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width;
  const y = ((e.clientY - r.top) / r.height) * canvas.height;
  return { x, y };
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  drawing = true;
  last = pos(e);
});
canvas.addEventListener("pointerup", () => {
  drawing = false;
  last = null;
});
canvas.addEventListener("pointerleave", () => {
  drawing = false;
  last = null;
});
canvas.addEventListener("pointermove", (e) => {
  if (!drawing || cooldown > 0) return;
  const p = pos(e);
  if (last) {
    for (const k of knots) {
      const d = distSegmentPoint(last.x, last.y, p.x, p.y, k.x, k.y);
      if (d < k.r + 14) {
        k.dead = true;
        score += 8;
        document.getElementById("sc").textContent = String(score);
      }
    }
    cooldown = 3;
  }
  last = p;
});

function distSegmentPoint(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / (len * len);
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx,
    ny = y1 + t * dy;
  return Math.hypot(px - nx, py - ny);
}

function loop() {
  acc++;
  if (cooldown > 0) cooldown--;
  if (acc % 38 === 0)
    knots.push({
      x: 24 + Math.random() * (canvas.width - 48),
      y: -12,
      vy: 1.6 + Math.random() * 1.8,
      r: 8 + (Math.random() * 8) | 0,
    });
  for (const k of knots) {
    k.y += k.vy;
    if (k.y > canvas.height - 30) {
      hp -= 10;
      document.getElementById("hp").textContent = String(Math.max(0, hp));
      k.dead = true;
    }
  }
  knots = knots.filter((k) => !k.dead);

  ctx.fillStyle = "#041024";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const k of knots) {
    const g = ctx.createRadialGradient(k.x, k.y, 2, k.x, k.y, k.r);
    g.addColorStop(0, "#fff9c4");
    g.addColorStop(1, "#ff6f00");
    ctx.beginPath();
    ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.fillStyle = hp > 0 ? "#1b5e20" : "#b71c1c";
  ctx.fillRect(0, canvas.height - 22, canvas.width, 22);
  if (hp <= 0) {
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.fillText("Ground ignited — click to reset sweep", 60, canvas.height / 2);
  }
  requestAnimationFrame(loop);
}

canvas.addEventListener("click", () => {
  if (hp <= 0) {
    hp = 100;
    knots = [];
    score = 0;
    document.getElementById("sc").textContent = "0";
    document.getElementById("hp").textContent = "100";
  }
});
loop();
