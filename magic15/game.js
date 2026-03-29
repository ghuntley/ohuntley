const boardEl = document.getElementById("board");
const rackEl = document.getElementById("rack");
const st = document.getElementById("st");
const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
let cells = [];
let grid;
let humanTurn;
let over;
let selected = null;
let picks = [];

function line15(g) {
  for (const [a, b, c] of lines) {
    const x = g[a],
      y = g[b],
      z = g[c];
    if (x && y && z && x + y + z === 15) return true;
  }
  return false;
}

function build() {
  boardEl.innerHTML = "";
  rackEl.innerHTML = "";
  cells = [];
  grid = Array(9).fill(null);
  humanTurn = true;
  over = false;
  selected = null;
  picks = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  st.textContent = "Choose a digit, then an empty cell";
  for (let i = 0; i < 9; i++) {
    const d = document.createElement("div");
    d.className = "cell";
    d.addEventListener("click", () => place(i));
    boardEl.appendChild(d);
    cells.push(d);
  }
  paintRack();
  paintBoard();
}

function paintBoard() {
  cells.forEach((el, i) => {
    el.textContent = grid[i] ? String(grid[i]) : "";
  });
}

function paintRack() {
  rackEl.innerHTML = "";
  picks.forEach((n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pick";
    b.textContent = String(n);
    b.disabled = !humanTurn || over;
    b.addEventListener("click", () => {
      if (!humanTurn || over) return;
      selected = n;
      st.textContent = `Placing ${n} — tap an empty cell`;
    });
    rackEl.appendChild(b);
  });
}

function end(msg) {
  over = true;
  st.textContent = msg;
  paintRack();
}

function place(i) {
  if (!humanTurn || over || grid[i] || !selected) return;
  if (!picks.includes(selected)) return;
  grid[i] = selected;
  picks = picks.filter((p) => p !== selected);
  selected = null;
  paintBoard();
  if (line15(grid)) return end("You closed a 15-line!");
  if (!picks.length) return end("Grid full — standoff.");
  humanTurn = false;
  st.textContent = "Opponent weaving…";
  paintRack();
  setTimeout(cpu, 400);
}

function cpu() {
  const avail = grid.map((v, idx) => (v ? -1 : idx)).filter((idx) => idx >= 0);
  let pick = null,
    cell = null;
  outer: for (const p of picks) {
    for (const i of avail) {
      const t = [...grid];
      t[i] = p;
      if (line15(t)) {
        pick = p;
        cell = i;
        break outer;
      }
    }
  }
  if (pick === null) {
    pick = picks[(Math.random() * picks.length) | 0];
    cell = avail[(Math.random() * avail.length) | 0];
  }
  grid[cell] = pick;
  picks = picks.filter((p) => p !== pick);
  paintBoard();
  if (line15(grid)) return end("Opponent closed a 15-line.");
  if (!picks.length) return end("Grid full — standoff.");
  humanTurn = true;
  st.textContent = "Your weave — digit then cell";
  paintRack();
}

document.getElementById("again").addEventListener("click", build);
build();
