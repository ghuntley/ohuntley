const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const pw = 72;
let px, items, charge, flux, battery, acc;

function reset() {
  px = canvas.width / 2 - pw / 2;
  items = [];
  charge = 1;
  flux = 0;
  battery = 100;
  acc = 0;
  document.getElementById("sc").textContent = "0";
  document.getElementById("hp").textContent = "100";
}

canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  px = ((e.clientX - r.left) / r.width) * canvas.width - pw / 2;
  px = Math.max(0, Math.min(canvas.width - pw, px));
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    charge *= -1;
  }
  if (e.key === "a" || e.key === "A") px -= 20;
  if (e.key === "d" || e.key === "D") px += 20;
  px = Math.max(0, Math.min(canvas.width - pw, px));
});

function spawn() {
  items.push({
    x: 24 + Math.random() * (canvas.width - 48),
    y: -16,
    vy: 2.2 + Math.random() * 2,
    s: Math.random() < 0.5 ? 1 : -1,
  });
}

function loop() {
  acc++;
  if (battery > 0 && acc % 40 === 0) spawn();
  ctx.fillStyle = "#061028";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const it of items) {
    it.y += it.vy;
    const caught =
      it.y > canvas.height - 52 &&
      it.y < canvas.height - 22 &&
      it.x > px &&
      it.x < px + pw;
    if (caught) {
      if (it.s === charge) {
        flux += 15;
        battery = Math.min(100, battery + 4);
      } else {
        battery -= 18;
      }
      document.getElementById("sc").textContent = String(flux);
      document.getElementById("hp").textContent = String(Math.max(0, battery | 0));
      it.dead = true;
    } else if (it.y > canvas.height) {
      it.dead = true;
    }
    ctx.fillStyle = it.s > 0 ? "#ff7043" : "#42a5f5";
    ctx.fillRect(it.x - 10, it.y - 10, 20, 20);
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.fillText(it.s > 0 ? "+" : "−", it.x - 4, it.y + 5);
  }
  items = items.filter((i) => !i.dead);

  ctx.fillStyle = charge > 0 ? "#ff7043" : "#42a5f5";
  ctx.fillRect(px, canvas.height - 44, pw, 16);
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.fillText(charge > 0 ? "+ pole" : "− pole", px + 12, canvas.height - 32);

  if (battery <= 0) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.fillText("Battery dead — click to re-polarize", 70, canvas.height / 2);
  }
  requestAnimationFrame(loop);
}

canvas.addEventListener("click", () => {
  if (battery <= 0) reset();
});

reset();
loop();
