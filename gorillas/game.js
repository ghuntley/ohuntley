const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const turnLabel = document.getElementById("turnLabel");
const windLabel = document.getElementById("windLabel");
const scoreLabel = document.getElementById("scoreLabel");
const statusMsg = document.getElementById("statusMsg");
const shotForm = document.getElementById("shotForm");
const angleInput = document.getElementById("angleInput");
const powerInput = document.getElementById("powerInput");
const fireBtn = document.getElementById("fireBtn");
const newRoundBtn = document.getElementById("newRoundBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const viewport = document.getElementById("viewport");

const W = canvas.width;
const H = canvas.height;
/** Scale relative to original 540px-tall playfield. */
const scaleH = H / 540;
const G = 0.24;
const BANANA_R = Math.max(5, 5 * scaleH);
/** Main warhead splits into this many bananas at apex or when speed drops. */
const MIRV_COUNT = 6;
const MIRV_SPREAD_RAD = 0.92;
const MIRV_CHILD_SPEED = 0.54;
const MIRV_LOW_POWER_FRAC = 0.42;
/** Scaled sprite height on canvas (natural asset 263×192). */
const PLAYER_DRAW_H = Math.round(52 * scaleH);
const playerImg = new Image();
let playerSpriteReady = false;
playerImg.onload = () => {
  playerSpriteReady = true;
};
playerImg.src = "player-sprite.png";

let buildings = [];
let players = [];
let activeTurn = 0;
let wind = 0;
/** @type {Array<{x:number,y:number,vx:number,vy:number,trail:Array<{x:number,y:number}>,angle:number,canSplit:boolean,launchSpeed:number,age:number}>} */
let projectiles = [];
let burst = null;
let roundLocked = false;
const scores = [0, 0];
let playerShots = [
  { angle: 45, power: 60 },
  { angle: 45, power: 60 },
];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function makeSkyline() {
  const list = [];
  let x = 0;
  const wMin = Math.max(36, Math.round((44 * W) / 960));
  const wMax = Math.max(wMin + 8, Math.round((72 * W) / 960));
  const roofLo = Math.round(H * 0.352);
  const roofHi = Math.round(H * 0.796);
  while (x < W) {
    const width = randInt(wMin, wMax);
    const roofY = randInt(roofLo, roofHi);
    list.push({
      x,
      width,
      roofY,
      color: `hsl(${randInt(205, 260)} 35% ${randInt(18, 35)}%)`,
      holes: [],
    });
    x += width + randInt(2, 6);
  }
  return list;
}

function buildingAt(x) {
  return buildings.find((b) => x >= b.x && x <= b.x + b.width);
}

function generateRound() {
  buildings = makeSkyline();

  const left = buildings[randInt(1, Math.max(2, Math.floor(buildings.length * 0.24)))];
  const right = buildings[randInt(Math.floor(buildings.length * 0.7), buildings.length - 2)];

  const pr = Math.round(20 * scaleH);
  const foot = Math.round(16 * scaleH);
  players = [
    { name: "Player 1", color: "#ffd95b", x: left.x + left.width / 2, y: left.roofY - foot, r: pr },
    { name: "Player 2", color: "#7ee6ff", x: right.x + right.width / 2, y: right.roofY - foot, r: pr },
  ];

  wind = rand(-0.18, 0.18);
  projectiles = [];
  burst = null;
  roundLocked = false;
  fireBtn.disabled = false;
  activeTurn = 0;
  playerShots = [
    { angle: 45, power: 60 },
    { angle: 45, power: 60 },
  ];
  applySavedShotForTurn();
  updateHud(`${players[activeTurn].name} to throw.`);
}

function updateHud(message) {
  turnLabel.textContent = players[activeTurn].name;
  windLabel.textContent = `${Math.round(wind * 100)} mph`;
  scoreLabel.textContent = `${scores[0]} - ${scores[1]}`;
  statusMsg.textContent = message;
}

function drawSky() {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#0e1a3a");
  grd.addColorStop(1, "#261125");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  for (let i = 0; i < 30; i += 1) {
    const sx = (i * 163) % W;
    const sy = (i * 97) % 150;
    ctx.fillRect(sx, sy, 2, 2);
  }
}

function drawBuildings() {
  for (const b of buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.roofY, b.width, H - b.roofY);

    ctx.fillStyle = "rgba(255, 232, 130, 0.45)";
    const cols = Math.max(2, Math.floor(b.width / 14));
    const rows = Math.max(2, Math.floor((H - b.roofY) / 18));
    for (let ix = 0; ix < cols; ix += 1) {
      for (let iy = 0; iy < rows; iy += 1) {
        if ((ix + iy) % 3 === 0) {
          ctx.fillRect(b.x + 5 + ix * 12, b.roofY + 8 + iy * 16, 6, 8);
        }
      }
    }

    // Craters are drawn with sky color to carve holes in facades.
    for (const h of b.holes) {
      ctx.fillStyle = "#151a35";
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlayers() {
  players.forEach((p, idx) => {
    const { w, h } = playerSpriteReady && playerImg.naturalWidth
      ? { w: (playerImg.naturalWidth / playerImg.naturalHeight) * PLAYER_DRAW_H, h: PLAYER_DRAW_H }
      : { w: p.r * 2, h: p.r * 2 };

    if (playerSpriteReady && playerImg.naturalWidth > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (idx === 1) ctx.scale(-1, 1);
      ctx.drawImage(playerImg, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = idx === activeTurn ? "#ffffff" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - w / 2 - 3, p.y - h / 2 - 3, w + 6, h + 6);
  });
}

function drawProjectile() {
  if (!projectiles.length) return;

  ctx.strokeStyle = "rgba(255, 230, 110, 0.45)";
  for (const p of projectiles) {
    if (p.trail.length < 2) continue;
    ctx.beginPath();
    p.trail.forEach((t, idx) => {
      if (idx === 0) ctx.moveTo(t.x, t.y);
      else ctx.lineTo(t.x, t.y);
    });
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of projectiles) {
    const fontPx = Math.round((p.childBanana ? 28 : 38) * scaleH);
    ctx.font = `${fontPx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif`;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillText("🍌", 0, 0);
    ctx.restore();
  }
}

function drawBurst() {
  if (!burst) return;
  const t = burst.maxLife > 0 ? burst.life / burst.maxLife : 0;
  const x = burst.x;
  const y = burst.y;
  const r = burst.r;

  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255, 255, 230, ${0.55 * t})`);
  g.addColorStop(0.35, `rgba(255, 200, 60, ${0.75 * t})`);
  g.addColorStop(0.65, `rgba(255, 120, 20, ${0.5 * t})`);
  g.addColorStop(1, `rgba(200, 40, 10, ${0.12 * t})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 220, 140, ${0.22 * t})`;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.22, 0, Math.PI * 2);
  ctx.fill();
}

function inHole(building, x, y) {
  return building.holes.some((h) => {
    const dx = x - h.x;
    const dy = y - h.y;
    return dx * dx + dy * dy <= h.r * h.r;
  });
}

function collidesWithBuilding(x, y) {
  const b = buildingAt(x);
  if (!b) return false;
  if (y < b.roofY || y > H) return false;
  return !inHole(b, x, y);
}

function collidesWithPlayer(x, y) {
  for (let i = 0; i < players.length; i += 1) {
    const p = players[i];
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy <= (p.r + BANANA_R) * (p.r + BANANA_R)) {
      return i;
    }
  }
  return -1;
}

function swapTurn() {
  activeTurn = activeTurn === 0 ? 1 : 0;
  applySavedShotForTurn();
  updateHud(`${players[activeTurn].name} to throw.`);
}

function saveShotForTurn(angle, power) {
  playerShots[activeTurn] = {
    angle: clamp(Math.round(angle), 0, 90),
    power: clamp(Math.round(power), 5, 130),
  };
}

function applySavedShotForTurn() {
  const saved = playerShots[activeTurn] || { angle: 45, power: 60 };
  angleInput.value = String(saved.angle);
  powerInput.value = String(saved.power);
}

function endShot(message) {
  projectiles = [];
  roundLocked = false;
  fireBtn.disabled = false;
  if (message) updateHud(message);
}

function awardHit(winner) {
  scores[winner] += 1;
  roundLocked = true;
  fireBtn.disabled = true;
  const roundPoints = 100 + Math.round(Math.abs(wind) * 320);
  if (typeof ArcadeScores !== "undefined" && typeof ArcadeScores.record === "function") {
    ArcadeScores.record("gorillas", roundPoints);
    ArcadeScores.refresh("gorillas");
  }
  updateHud(`${players[winner].name} hits! New round starting...`);
  setTimeout(() => generateRound(), 1200);
}

function buildMirvChildren(p) {
  const spd = Math.hypot(p.vx, p.vy);
  const baseAng = Math.atan2(p.vy, p.vx);
  const sp = Math.max(0.9, spd);
  const n = MIRV_COUNT;
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const u = n <= 1 ? 0 : k / (n - 1) - 0.5;
    const ang = baseAng + u * MIRV_SPREAD_RAD;
    const cs = Math.max(1.35, sp * MIRV_CHILD_SPEED);
    out.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(ang) * cs,
      vy: Math.sin(ang) * cs,
      trail: [],
      angle: p.angle + rand(-0.45, 0.45),
      canSplit: false,
      launchSpeed: 0,
      age: 0,
      childBanana: true,
    });
  }
  return out;
}

function stepProjectile() {
  if (!projectiles.length) return;

  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    const wasVy = p.vy;
    p.vx += wind * 0.03;
    p.vy += G;
    p.age += 1;

    const spd = Math.hypot(p.vx, p.vy);
    const apexSplit =
      p.canSplit && wasVy < -0.025 && p.vy >= -0.025;
    const lowPowerSplit =
      p.canSplit &&
      p.age > 14 &&
      p.vy > 0.06 &&
      spd < p.launchSpeed * MIRV_LOW_POWER_FRAC;

    if (apexSplit || lowPowerSplit) {
      projectiles.splice(i, 1, ...buildMirvChildren(p));
      continue;
    }

    p.x += p.vx;
    p.y += p.vy;
    const speed = Math.hypot(p.vx, p.vy);
    p.angle += 0.14 + speed * 0.006;

    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 18) p.trail.shift();

    const hitPlayer = collidesWithPlayer(p.x, p.y);
    if (hitPlayer !== -1) {
      burst = {
        x: p.x,
        y: p.y,
        r: Math.round(18 * scaleH),
        life: Math.round(44 * scaleH),
        maxLife: Math.round(44 * scaleH),
      };
      const winner = hitPlayer === 0 ? 1 : 0;
      projectiles.length = 0;
      endShot();
      awardHit(winner);
      return;
    }

    if (collidesWithBuilding(p.x, p.y)) {
      const b = buildingAt(p.x);
      if (b)
        b.holes.push({
          x: p.x,
          y: p.y,
          r: randInt(Math.round(16 * scaleH), Math.round(24 * scaleH)),
        });
      burst = {
        x: p.x,
        y: p.y,
        r: Math.round(18 * scaleH),
        life: Math.round(44 * scaleH),
        maxLife: Math.round(44 * scaleH),
      };
      projectiles.length = 0;
      endShot("Direct hit on a building. Turn switches.");
      swapTurn();
      return;
    }

    if (p.x < -20 || p.x > W + 20 || p.y > H + 20 || p.y < -40) {
      projectiles.splice(i, 1);
      if (projectiles.length === 0) {
        endShot("Missed everything. Turn switches.");
        swapTurn();
      }
    }
  }
}

function fireShot(angleDeg, power) {
  if (roundLocked || projectiles.length) return;

  const shooter = players[activeTurn];
  const worldAngle = activeTurn === 0 ? angleDeg : 180 - angleDeg;
  const radians = (worldAngle * Math.PI) / 180;
  const speed = clamp(power, 5, 130) * 0.15;
  const halfH =
    playerSpriteReady && playerImg.naturalWidth
      ? PLAYER_DRAW_H / 2
      : shooter.r + 2;
  const vx = Math.cos(radians) * speed;
  const vy = -Math.sin(radians) * speed;
  const launchSpeed = Math.hypot(vx, vy);
  projectiles = [
    {
      x: shooter.x,
      y: shooter.y - halfH - 4,
      vx,
      vy,
      trail: [],
      angle: 0,
      canSplit: true,
      launchSpeed,
      age: 0,
      childBanana: false,
    },
  ];
  roundLocked = true;
  fireBtn.disabled = true;
  updateHud(`${shooter.name} throws MIRV…`);
}

function tick() {
  drawSky();
  drawBuildings();
  stepProjectile();

  if (burst) {
    burst.r += 5.2 * scaleH;
    burst.life -= 1;
    if (burst.life <= 0) burst = null;
  }

  drawPlayers();
  drawProjectile();
  drawBurst();

  requestAnimationFrame(tick);
}

shotForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (projectiles.length || roundLocked) return;
  const angle = Number(angleInput.value);
  const power = Number(powerInput.value);
  if (!Number.isFinite(angle) || !Number.isFinite(power)) return;
  const shotAngle = clamp(angle, 0, 90);
  const shotPower = clamp(power, 5, 130);
  saveShotForTurn(shotAngle, shotPower);
  fireShot(shotAngle, shotPower);
});

newRoundBtn.addEventListener("click", () => {
  generateRound();
  if (typeof ArcadeScores !== "undefined" && typeof ArcadeScores.refresh === "function") {
    ArcadeScores.refresh("gorillas");
  }
});

function fullscreenActive() {
  return Boolean(
    document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement,
  );
}

function syncFullscreenButton() {
  if (!fullscreenBtn) return;
  fullscreenBtn.textContent = fullscreenActive() ? "Exit full screen" : "Full screen";
}

if (fullscreenBtn && viewport) {
  fullscreenBtn.addEventListener("click", () => {
    if (fullscreenActive()) {
      const exit =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.msExitFullscreen;
      exit?.call(document);
      return;
    }
    const req =
      viewport.requestFullscreen ||
      viewport.webkitRequestFullscreen ||
      viewport.msRequestFullscreen;
    req?.call(viewport);
  });
  document.addEventListener("fullscreenchange", syncFullscreenButton);
  document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
  document.addEventListener("MSFullscreenChange", syncFullscreenButton);
  syncFullscreenButton();
}

if (typeof ArcadeScores !== "undefined" && typeof ArcadeScores.refresh === "function") {
  ArcadeScores.refresh("gorillas");
}
generateRound();
tick();
