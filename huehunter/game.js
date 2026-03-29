const grid = document.getElementById("grid");
const stEl = document.getElementById("st");
const rdEl = document.getElementById("rd");
let streak = 0;
let n = 5;

function build() {
  grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  grid.innerHTML = "";
  const odd = (Math.random() * n * n) | 0;
  const baseHue = (Math.random() * 320) | 0;
  const delta = Math.max(6, 32 - n * 2);
  for (let i = 0; i < n * n; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell";
    const h = i === odd ? baseHue + delta : baseHue;
    b.style.background = `hsl(${h}, 62%, 48%)`;
    b.addEventListener("click", () => {
      if (i === odd) {
        streak++;
        n = Math.min(9, 5 + ((streak / 3) | 0));
        stEl.textContent = String(streak);
        rdEl.textContent = String(n);
        build();
      } else {
        streak = 0;
        n = 5;
        stEl.textContent = "0";
        rdEl.textContent = "5";
        build();
      }
    });
    grid.appendChild(b);
  }
}

build();
