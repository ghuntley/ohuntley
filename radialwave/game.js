const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const cx = canvas.width / 2;
const cy = canvas.height / 2;
const R = 130;
let playerA = -Math.PI / 2;
let windowA = 0;
let windowW = 1.1;
let spin = 0.022;
let pulseT = 0;
let score = 0;
let misses = 0;
const keys = {};

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
});
document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

function inArc(a, center, half) {
  let d = a - center;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) < half;
}

function loop() {
  if (keys["ArrowLeft"]) playerA -= 0.055;
  if (keys["ArrowRight"]) playerA += 0.055;
  windowA += spin;
  spin = Math.min(0.055, spin + 0.00002);
  pulseT++;
  if (pulseT % 110 === 0) {
    if (inArc(playerA, windowA, windowW / 2)) {
      score++;
      document.getElementById("sc").textContent = String(score);
      windowW = Math.max(0.45, windowW - 0.04);
    } else {
      misses++;
      document.getElementById("ms").textContent = String(misses);
      if (misses >= 4) {
        misses = 0;
        score = 0;
        windowW = 1.1;
        spin = 0.022;
        document.getElementById("sc").textContent = "0";
        document.getElementById("ms").textContent = "0";
      }
    }
  }

  ctx.fillStyle = "#050810";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.arc(cx, cy, R + 18, 0, Math.PI * 2);
  ctx.strokeStyle = "#1f2a3a";
  ctx.lineWidth = 28;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R + 18, windowA - windowW / 2, windowA + windowW / 2);
  ctx.strokeStyle = "#fff176";
  ctx.lineWidth = 28;
  ctx.stroke();
  const px = cx + Math.cos(playerA) * (R + 18);
  const py = cy + Math.sin(playerA) * (R + 18);
  ctx.fillStyle = "#29b6f6";
  ctx.beginPath();
  ctx.arc(px, py, 11, 0, Math.PI * 2);
  ctx.fill();
  if (pulseT % 110 > 95 && pulseT % 110 < 110) {
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(cx, cy, R + 40, 0, Math.PI * 2);
    ctx.fill();
  }
  requestAnimationFrame(loop);
}
loop();
