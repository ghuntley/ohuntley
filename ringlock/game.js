const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const cx = canvas.width / 2;
const cy = canvas.height / 2;
let ang = 0;
let speed = 0.045;
let score = 0;
const notch = -Math.PI / 2;

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  e.preventDefault();
  let d = ang - notch;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) < 0.22) {
    score++;
    speed = Math.min(0.14, speed * 1.06);
    document.getElementById("sc").textContent = String(score);
  } else {
    score = Math.max(0, score - 1);
    speed = Math.max(0.028, speed * 0.92);
    document.getElementById("sc").textContent = String(score);
  }
  document.getElementById("df").textContent = (speed / 0.045).toFixed(2) + "×";
});

function loop() {
  ang += speed;
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#263238";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#ffeb3b";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(cx, cy, 120, ang - 0.35, ang + 0.35);
  ctx.stroke();
  ctx.strokeStyle = "#eceff1";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 130);
  ctx.lineTo(cx, cy - 150);
  ctx.stroke();
  requestAnimationFrame(loop);
}
loop();
