const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const cx = canvas.width / 2;
const cy = canvas.height / 2 + 10;
let runners = [];
let spokes = [];
let mx = cx,
  my = cy - 80;
let score = 0;
let hp = 100;
let acc = 0;

canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mx = ((e.clientX - r.left) / r.width) * canvas.width;
  my = ((e.clientY - r.top) / r.height) * canvas.height;
});

canvas.addEventListener("click", () => {
  if (hp <= 0) {
    hp = 100;
    runners = [];
    spokes = [];
    score = 0;
    document.getElementById("hp").textContent = "100";
    document.getElementById("sc").textContent = "0";
    return;
  }
  const ang = Math.atan2(my - cy, mx - cx);
  spokes.push({ ang, r: 28, speed: 11 });
});

function spawn() {
  const ang = Math.random() * Math.PI * 2;
  runners.push({ ang, rad: 190, w: 0.018 + Math.random() * 0.012 });
}

function loop() {
  acc++;
  if (hp > 0 && acc % 55 === 0) spawn();
  if (hp > 0) {
    for (const run of runners) {
      run.ang += run.w;
      run.rad -= 0.55;
      if (run.rad < 22) {
        hp -= 8;
        document.getElementById("hp").textContent = String(Math.max(0, hp));
        run.dead = true;
      }
    }
  }
  runners = runners.filter((r) => !r.dead);

  for (const s of spokes) {
    s.r += s.speed;
    const x = cx + Math.cos(s.ang) * s.r;
    const y = cy + Math.sin(s.ang) * s.r;
    for (const run of runners) {
      const rx = cx + Math.cos(run.ang) * run.rad;
      const ry = cy + Math.sin(run.ang) * run.rad;
      if (Math.hypot(x - rx, y - ry) < 16) {
        run.dead = true;
        s.dead = true;
        score++;
        document.getElementById("sc").textContent = String(score);
        break;
      }
    }
    if (s.r > 220) s.dead = true;
  }
  spokes = spokes.filter((s) => !s.dead);

  ctx.fillStyle = "#050308";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#2a1520";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 6; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, i * 32, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const run of runners) {
    const x = cx + Math.cos(run.ang) * run.rad;
    const y = cy + Math.sin(run.ang) * run.rad;
    ctx.fillStyle = "#ff5252";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of spokes) {
    const x = cx + Math.cos(s.ang) * s.r;
    const y = cy + Math.sin(s.ang) * s.r;
    ctx.strokeStyle = "#69f0ae";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.fillStyle = hp > 0 ? "#ffd54f" : "#444";
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  if (hp <= 0) {
    ctx.fillStyle = "#fff";
    ctx.font = "13px sans-serif";
    ctx.fillText("Core breached — click to reboot", 90, 40);
  }
  requestAnimationFrame(loop);
}

document.getElementById("hp").textContent = String(hp);
loop();
