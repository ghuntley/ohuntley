const glyphs = ["⌬", "⍟", "◈", "⬡", "⎔", "⬢"];
const pad = document.getElementById("pad");
const stEl = document.getElementById("st");
const lnEl = document.getElementById("ln");
let seq = [];
let input = [];
let streak = 0;
let len = 3;
let locked = true;
const cells = [];

function buildPad() {
  pad.innerHTML = "";
  cells.length = 0;
  const pick = glyphs.slice(0, 6);
  pick.forEach((g, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "glyph";
    b.textContent = g;
    b.dataset.i = String(i);
    b.addEventListener("click", () => onPick(i));
    pad.appendChild(b);
    cells.push(b);
  });
}

function onPick(i) {
  if (locked) return;
  input.push(i);
  const need = input.length - 1;
  if (seq[need] !== i) {
    streak = 0;
    stEl.textContent = "0";
    locked = true;
    document.getElementById("go").textContent = "Try again — show trace";
    return;
  }
  if (input.length === seq.length) {
    streak++;
    stEl.textContent = String(streak);
    len = Math.min(8, 3 + ((streak / 2) | 0));
    lnEl.textContent = String(len);
    locked = true;
    document.getElementById("go").textContent = "Next trace";
  }
}

function showTrace() {
  seq = [];
  for (let k = 0; k < len; k++) seq.push((Math.random() * 6) | 0);
  input = [];
  locked = true;
  let step = 0;
  const run = () => {
    cells.forEach((c) => c.classList.remove("flash"));
    if (step >= seq.length) {
      locked = false;
      document.getElementById("go").textContent = "Replay trace";
      return;
    }
    const idx = seq[step];
    cells[idx].classList.add("flash");
    setTimeout(() => {
      cells[idx].classList.remove("flash");
      step++;
      setTimeout(run, 120);
    }, 420);
  };
  run();
}

document.getElementById("go").addEventListener("click", showTrace);
buildPad();
lnEl.textContent = String(len);
