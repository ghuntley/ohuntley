const swatch = document.getElementById("swatch");
const readout = document.getElementById("readout");
const scEl = document.getElementById("sc");
const erEl = document.getElementById("er");
let hue = 0;
let score = 0;
let errs = 0;

function tick() {
  hue = (hue + 2.1) % 360;
  swatch.style.background = `hsl(${hue}, 75%, 48%)`;
  const ok = hue > 265 && hue < 295;
  readout.textContent = ok ? "VIOLET LOCK" : "wait…";
  readout.style.color = ok ? "#e040fb" : "#888";
}

document.getElementById("hit").addEventListener("click", () => {
  const ok = hue > 265 && hue < 295;
  if (ok) {
    score++;
    scEl.textContent = String(score);
  } else {
    errs++;
    erEl.textContent = String(errs);
    if (errs >= 5) {
      score = 0;
      errs = 0;
      scEl.textContent = "0";
      erEl.textContent = "0";
    }
  }
});

setInterval(tick, 32);
