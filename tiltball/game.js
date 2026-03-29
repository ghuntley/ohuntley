const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const keys = {};
let tilt, ball, t0, alive, best;

function loadBest() {
  best = parseFloat(localStorage.getItem("tiltDeckBest") || "0") || 0;
  document.getElementById("bst").textContent = best.toFixed(1);
}

function start() {
  tilt = 0;
  ball = { x: canvas.width / 2, vx: 0 };
  t0 = performance.now();
  alive = true;
}

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (!alive && (e.key === "r" || e.key === "R")) {
    start();
  }
});
document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

function loop(now) {
  const deckY = canvas.height - 50;
  const deckH = 24;
  const margin = 28;
  if (alive) {
    if (keys["KeyA"] || keys["ArrowLeft"]) tilt = Math.max(-1, tilt - 0.04);
    else if (keys["KeyD"] || keys["ArrowRight"]) tilt = Math.min(1, tilt + 0.04);
    else tilt *= 0.92;
    ball.vx += tilt * 0.45;
    ball.vx *= 0.985;
    ball.x += ball.vx;
    const minX = margin + 10;
    const maxX = canvas.width - margin - 10;
    if (ball.x < minX || ball.x > maxX) {
      alive = false;
      const elapsed = (now - t0) / 1000;
      if (elapsed > best) {
        best = elapsed;
        localStorage.setItem("tiltDeckBest", String(best));
        document.getElementById("bst").textContent = best.toFixed(1);
      }
    }
    document.getElementById("tm").textContent = ((now - t0) / 1000).toFixed(1);
  }

  ctx.fillStyle = "#2c2419";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, deckY + deckH / 2);
  ctx.rotate(tilt * 0.22);
  ctx.fillStyle = "#5c4a32";
  ctx.fillRect(-canvas.width / 2 + margin, -deckH / 2, canvas.width - margin * 2, deckH);
  ctx.restore();
  ctx.fillStyle = alive ? "#f5e6c8" : "#666";
  ctx.beginPath();
  ctx.arc(ball.x, deckY - 14, 12, 0, Math.PI * 2);
  ctx.fill();
  if (!alive) {
    ctx.fillStyle = "#fff";
    ctx.font = "13px sans-serif";
    ctx.fillText("Off the deck — R to try again", 90, canvas.height / 2 - 10);
  }
  requestAnimationFrame(loop);
}

loadBest();
start();
requestAnimationFrame(loop);
