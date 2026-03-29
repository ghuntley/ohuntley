const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const lanes = 3;
const lw = canvas.width / lanes;
const colors = ["#e53935", "#43a047", "#1e88e5"];
let lane = 1;
let colorIdx = 1;
let gates = [];
let dist = 0;
let speed = 2.4;
let alive = true;
let acc = 0;

document.addEventListener("keydown", (e) => {
  if (!alive && e.key === "r") {
    gates = [];
    dist = 0;
    speed = 2.4;
    acc = 0;
    alive = true;
    document.getElementById("sc").textContent = "0";
    document.getElementById("st").textContent = "Running";
    return;
  }
  if (!alive) return;
  if (e.key === "1") {
    lane = 0;
    colorIdx = 0;
  }
  if (e.key === "2") {
    lane = 1;
    colorIdx = 1;
  }
  if (e.key === "3") {
    lane = 2;
    colorIdx = 2;
  }
});

function spawnGate() {
  const open = (Math.random() * 3) | 0;
  gates.push({ y: -70, open, h: 56 });
}

function loop() {
  if (alive) {
    acc++;
    if (acc % 70 === 0) spawnGate();
    for (const g of gates) {
      g.y += speed;
      const py = canvas.height - 80;
      if (g.y + g.h > py && g.y < py + 36) {
        if (g.open !== lane) {
          alive = false;
          document.getElementById("st").textContent = "Press R";
        }
      }
    }
    gates = gates.filter((g) => g.y < canvas.height + 40);
    dist += alive ? speed * 0.1 : 0;
    speed = Math.min(5.5, 2.4 + dist * 0.01);
    document.getElementById("sc").textContent = String((dist | 0));
  }

  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 1; i < lanes; i++) {
    ctx.strokeStyle = "#222";
    ctx.beginPath();
    ctx.moveTo(i * lw, 0);
    ctx.lineTo(i * lw, canvas.height);
    ctx.stroke();
  }
  for (const g of gates) {
    for (let L = 0; L < 3; L++) {
      if (L !== g.open) {
        ctx.fillStyle = "#37474f";
        ctx.fillRect(L * lw + 3, g.y, lw - 6, g.h);
      } else {
        ctx.fillStyle = colors[L];
        ctx.globalAlpha = 0.25;
        ctx.fillRect(L * lw + 3, g.y, lw - 6, g.h);
        ctx.globalAlpha = 1;
      }
    }
  }
  const py = canvas.height - 72;
  ctx.fillStyle = colors[colorIdx];
  ctx.fillRect(lane * lw + lw / 2 - 18, py, 36, 32);
  if (!alive) {
    ctx.fillStyle = "#fff";
    ctx.font = "13px sans-serif";
    ctx.fillText("Spectrum clash — R", 100, canvas.height / 2);
  }
  requestAnimationFrame(loop);
}
loop();
