const grid = document.getElementById("grid");
const scEl = document.getElementById("sc");
const tmEl = document.getElementById("tm");
let cells = [];
let target = -1;
let phase = 0;
let score = 0;
let timeLeft = 25;
let running = false;
let timerId;
let tickId;

function build() {
  grid.innerHTML = "";
  cells = [];
  for (let i = 0; i < 9; i++) {
    const d = document.createElement("div");
    d.className = "cell";
    const r = document.createElement("div");
    r.className = "ring";
    d.appendChild(r);
    d.addEventListener("click", () => tap(i));
    grid.appendChild(d);
    cells.push(d);
  }
}

function pickTarget() {
  cells.forEach((c) => {
    c.classList.remove("ready");
    const ring = c.querySelector(".ring");
    if (ring) ring.style.transform = "scale(0.4)";
  });
  target = (Math.random() * 9) | 0;
  phase = 0;
}

function tap(i) {
  if (!running) return;
  if (i === target && phase >= 12) {
    score++;
    scEl.textContent = String(score);
    pickTarget();
  } else {
    score = Math.max(0, score - 1);
    scEl.textContent = String(score);
    pickTarget();
  }
}

function tickPhase() {
  if (!running) return;
  phase++;
  if (target >= 0) {
    const c = cells[target];
    const p = Math.min(1, phase / 14);
    c.querySelector(".ring").style.transform = `scale(${0.4 + p * 0.9})`;
    if (phase >= 12 && phase <= 16) c.classList.add("ready");
    else c.classList.remove("ready");
    if (phase > 22) pickTarget();
  }
}

function sec() {
  if (!running) return;
  timeLeft--;
  tmEl.textContent = String(timeLeft);
  if (timeLeft <= 0) {
    running = false;
    clearInterval(timerId);
    clearInterval(tickId);
    cells.forEach((c) => c.classList.remove("ready"));
    alert(`Field collapsed · score ${score}`);
  }
}

document.getElementById("go").addEventListener("click", () => {
  if (running) return;
  score = 0;
  timeLeft = 25;
  scEl.textContent = "0";
  tmEl.textContent = "25";
  running = true;
  pickTarget();
  timerId = setInterval(sec, 1000);
  tickId = setInterval(tickPhase, 90);
});

build();
