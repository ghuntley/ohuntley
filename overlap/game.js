const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const slabW = 120;
let t = 0;
let score = 0;

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  e.preventDefault();
  const p = (Math.sin(t) + 1) / 2;
  if (p > 0.92) {
    score++;
    document.getElementById("sc").textContent = String(score);
  } else {
    score = Math.max(0, score - 1);
    document.getElementById("sc").textContent = String(score);
  }
});

function loop() {
  t += 0.045;
  const p = (Math.sin(t) + 1) / 2;
  const gap = 200 * (1 - p);
  const leftX = canvas.width / 2 - gap / 2 - slabW;
  const rightX = canvas.width / 2 + gap / 2;
  ctx.fillStyle = "#1a1418";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#8d6e63";
  ctx.fillRect(leftX, 60, slabW, 70);
  ctx.fillStyle = "#a1887f";
  ctx.fillRect(rightX, 60, slabW, 70);
  const ov = Math.max(0, leftX + slabW - rightX);
  ctx.fillStyle = "rgba(255,213,79,0.35)";
  ctx.fillRect(rightX, 60, ov, 70);
  requestAnimationFrame(loop);
}
loop();
