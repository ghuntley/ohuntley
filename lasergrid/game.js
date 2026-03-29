const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const cols = 10;
const rows = 6;
const cellW = canvas.width / cols;
const cellH = 36;
const topY = 50;
let emitterX;
let grid;
let charges;
let pulse;

function countNodes() {
  let n = 0;
  for (const row of grid) for (const c of row) if (c) n++;
  return n;
}

function rebuild() {
  grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(Math.random() < 0.88);
    grid.push(row);
  }
  charges = 5;
  pulse = null;
  emitterX = canvas.width / 2;
  document.getElementById("ch").textContent = String(charges);
  document.getElementById("br").textContent = String(countNodes());
}

canvas.addEventListener("click", () => fire());
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  emitterX = ((e.clientX - r.left) / r.width) * canvas.width;
  emitterX = Math.max(20, Math.min(canvas.width - 20, emitterX));
});

document.addEventListener("keydown", (e) => {
  if (e.key === "a" || e.key === "A") emitterX -= 28;
  if (e.key === "d" || e.key === "D") emitterX += 28;
  emitterX = Math.max(20, Math.min(canvas.width - 20, emitterX));
  if (e.code === "Space") {
    e.preventDefault();
    fire();
  }
});

function fire() {
  if (pulse || charges <= 0) return;
  const col = Math.min(cols - 1, Math.max(0, ((emitterX / canvas.width) * cols) | 0));
  charges--;
  document.getElementById("ch").textContent = String(charges);
  pulse = { col, y: canvas.height - 55, vy: -14 };
}

function update() {
  if (pulse) {
    pulse.y += pulse.vy;
    if (pulse.y < topY - 20) {
      for (let r = 0; r < rows; r++) grid[r][pulse.col] = false;
      pulse = null;
      document.getElementById("br").textContent = String(countNodes());
      if (countNodes() === 0) rebuild();
      else if (charges <= 0 && countNodes() > 0) {
        charges = 3;
        document.getElementById("ch").textContent = String(charges);
      }
    }
  }
}

function draw() {
  ctx.fillStyle = "#080c18";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      const x = c * cellW + 3;
      const y = topY + r * (cellH + 4);
      ctx.fillStyle = `hsl(${(c * 37 + r * 51) % 280}, 70%, 52%)`;
      ctx.fillRect(x, y, cellW - 6, cellH);
    }
  }
  ctx.fillStyle = "#263238";
  ctx.fillRect(emitterX - 30, canvas.height - 48, 60, 16);
  ctx.fillStyle = pulse ? "#ff4081" : "#00b0ff";
  ctx.beginPath();
  ctx.arc(emitterX, canvas.height - 40, 7, 0, Math.PI * 2);
  ctx.fill();
  if (pulse) {
    const x = pulse.col * cellW + cellW / 2;
    ctx.strokeStyle = "rgba(0, 229, 255, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, pulse.y);
    ctx.lineTo(x, canvas.height - 48);
    ctx.stroke();
    ctx.fillStyle = "rgba(0, 229, 255, 0.35)";
    ctx.fillRect(x - 8, pulse.y, 16, canvas.height - 48 - pulse.y);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

rebuild();
loop();
