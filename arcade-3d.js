import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const DEFAULT_GAMES = [
  {
    slug: "maze",
    title: "MAZE RUNNER",
    blurb: "Random mazes · arrows · beat the clock",
    marquee: "#ff00cc",
    screen: "#00ffaa",
  },
  {
    slug: "meerkat",
    title: "MEERKAT RUN",
    blurb: "Desert chase · jump · multi-stage",
    marquee: "#00e5ff",
    screen: "#ffaa00",
  },
  {
    slug: "meerkat-tycoon",
    title: "MEERKAT MANOR",
    blurb: "Colony tycoon · dig burrows · forage vs sentries · renown",
    marquee: "#d4a03a",
    screen: "#e8c088",
  },
  {
    slug: "nibbles",
    title: "NIBBLES",
    blurb: "QBasic snake · digits for length · maze levels",
    marquee: "#00e676",
    screen: "#304ffe",
  },
  {
    slug: "grapple",
    title: "SKYHOOK",
    blurb: "Three.js grapple · swing to the gold platform",
    marquee: "#00fff2",
    screen: "#ff1493",
  },
  {
    slug: "peggle",
    title: "PEGGLE-ISH",
    blurb: "Aim · bounce pegs · buckets · orange bonus",
    marquee: "#ff9100",
    screen: "#7c4dff",
  },
  {
    slug: "shooter",
    title: "VECTOR STRIKE",
    blurb: "Three.js FPS · neon arena · waves · headshots",
    marquee: "#ff5cd2",
    screen: "#00fff2",
  },
];

function getGames() {
  const g = typeof window !== "undefined" ? window.ARCADE_GAMES : null;
  return Array.isArray(g) && g.length ? g : DEFAULT_GAMES;
}

const VIBE = {
  fogNear: 12,
  fogFar: 48,
  fogColor: 0x240018,
  bgColor: 0x140818,
  bloomStrength: 0.62,
  bloomRadius: 0.48,
  bloomThreshold: 0.22,
  /** Corridor footprint (meters) — long aisle like classic 80s arcade rows */
  roomW: 15,
  roomD: 32,
};

function hexToColor(hex) {
  const s = String(hex || "#888888").replace("#", "");
  return parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
}

function makeCheckerTexture() {
  const cells = 24;
  const s = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d");
  const cs = s / cells;
  /** Hot pink + electric cyan — reference arcade floor */
  const pink = "#ff1a7a";
  const pinkHi = "#ff4da0";
  const cyan = "#00e8dc";
  const cyanHi = "#40fff4";
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const alt = (x + y) % 2;
      const g = ctx.createLinearGradient(x * cs, y * cs, (x + 1) * cs, (y + 1) * cs);
      if (alt) {
        g.addColorStop(0, pinkHi);
        g.addColorStop(1, pink);
      } else {
        g.addColorStop(0, cyanHi);
        g.addColorStop(1, cyan);
      }
      ctx.fillStyle = g;
      ctx.fillRect(x * cs, y * cs, cs + 1, cs + 1);
    }
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cs, 0);
    ctx.lineTo(i * cs, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cs);
    ctx.lineTo(s, i * cs);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 17);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeCeilingGridTexture() {
  const s = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0610";
  ctx.fillRect(0, 0, s, s);
  const lines = 24;
  const step = s / lines;
  ctx.strokeStyle = "rgba(255, 20, 147, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= lines; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(s, i * step);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0, 255, 238, 0.08)";
  for (let i = 0; i < lines; i += 2) {
    ctx.strokeRect(i * step + 0.5, i * step + 0.5, step * 2, step * 2);
  }
  ctx.fillStyle = "rgba(255, 20, 147, 0.04)";
  for (let i = 0; i < 80; i++) {
    const px = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const py = (Math.cos(i * 78.233) * 12345.678) % 1;
    ctx.fillRect(((px + 1) * 0.5) * s, ((py + 1) * 0.5) * s, 1.2, 1.2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function layoutCabinetSlots(total, roomW, roomD) {
  const w = roomW / 2;
  const d = roomD / 2;
  const specs = [];
  if (total <= 0) return specs;
  if (total === 1) {
    specs.push({ x: 0, z: -d + 1.2, rotY: 0 });
    return specs;
  }
  const sideCount = total - 1;
  const leftN = Math.ceil(sideCount / 2);
  const rightN = sideCount - leftN;
  const zMin = -d + 5.2;
  const zMax = d - 4;
  const zSpan = Math.max(0.01, zMax - zMin);
  for (let i = 0; i < leftN; i++) {
    const t = leftN <= 1 ? 0.5 : i / (leftN - 1);
    specs.push({ x: -w + 0.92, z: zMin + t * zSpan, rotY: Math.PI / 2 });
  }
  for (let i = 0; i < rightN; i++) {
    const t = rightN <= 1 ? 0.5 : i / (rightN - 1);
    specs.push({ x: w - 0.92, z: zMin + t * zSpan, rotY: -Math.PI / 2 });
  }
  specs.push({ x: 0, z: -d + 1.15, rotY: 0 });
  return specs;
}

/** Bold pop-art wall panels (canvas, no external assets). */
function makePopMuralTexture(variant) {
  const w = 320;
  const h = 560;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#1a0630");
  bg.addColorStop(0.45, "#120820");
  bg.addColorStop(1, "#080618");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 20, 147, 0.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  const drawArch = (cx, cy, rw, rh, stroke, fill) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, Math.PI, 0, false);
    ctx.lineTo(cx + rw, cy + rh * 1.1);
    ctx.lineTo(cx - rw, cy + rh * 1.1);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 5;
    ctx.stroke();
  };

  switch (variant % 6) {
    case 0: {
      ctx.fillStyle = "#ffcc00";
      ctx.beginPath();
      ctx.arc(w * 0.48, h * 0.38, w * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a1a08";
      ctx.fillRect(w * 0.38, h * 0.42, w * 0.09, h * 0.06);
      ctx.fillRect(w * 0.53, h * 0.42, w * 0.09, h * 0.06);
      ctx.strokeStyle = "#ff1493";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w * 0.48, h * 0.48, w * 0.12, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      drawArch(w * 0.5, h * 0.78, w * 0.22, h * 0.14, "#ff1493", "rgba(255, 20, 147, 0.25)");
      break;
    }
    case 1: {
      ctx.fillStyle = "#00e5ff";
      ctx.fillRect(w * 0.08, h * 0.2, w * 0.35, h * 0.45);
      ctx.fillStyle = "#ff1493";
      ctx.fillRect(w * 0.52, h * 0.28, w * 0.4, h * 0.22);
      ctx.fillStyle = "#aa44ff";
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.72, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8e1";
      ctx.fillRect(w * 0.62, h * 0.58, w * 0.22, h * 0.28);
      break;
    }
    case 2: {
      ctx.fillStyle = "#ff6b35";
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(w * (0.1 + i * 0.16), h * (0.25 + (i % 2) * 0.08), w * 0.1, h * 0.35);
      }
      ctx.fillStyle = "#00fff2";
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.72);
      ctx.lineTo(w * 0.8, h * 0.68);
      ctx.lineTo(w * 0.72, h * 0.92);
      ctx.lineTo(w * 0.28, h * 0.9);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 3: {
      drawArch(w * 0.5, h * 0.42, w * 0.32, h * 0.2, "#7df9ff", "rgba(0, 255, 242, 0.2)");
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(w * 0.12, h * 0.62, w * 0.76, h * 0.08);
      ctx.fillStyle = "#ff1493";
      ctx.fillRect(w * 0.2, h * 0.76, w * 0.6, h * 0.14);
      break;
    }
    case 4: {
      ctx.fillStyle = "#e040fb";
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.18);
      ctx.lineTo(w * 0.88, h * 0.55);
      ctx.lineTo(w * 0.5, h * 0.92);
      ctx.lineTo(w * 0.12, h * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#00e676";
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.52, w * 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = "#304ffe";
      ctx.fillRect(w * 0.1, h * 0.22, w * 0.8, h * 0.18);
      ctx.fillStyle = "#ffea00";
      ctx.fillRect(w * 0.15, h * 0.48, w * 0.7, h * 0.12);
      ctx.fillStyle = "#ff4081";
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.78, w * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function readMazeBestLegacy() {
  try {
    const raw = localStorage.getItem("mazeRunnerHighScores");
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return null;
    let best = -Infinity;
    for (const r of arr) {
      const n = Number(r?.score);
      if (Number.isFinite(n)) best = Math.max(best, n);
    }
    return best >= 0 && Number.isFinite(best) ? best : null;
  } catch {
    return null;
  }
}

function readMeerkatBestLegacy() {
  const n = parseInt(localStorage.getItem("meerkat-chase-highscore-v1") || "", 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function readArcadeLeaderboardTop(slug, lowerIsBetter) {
  const AS = typeof window !== "undefined" ? window.ArcadeScores : null;
  if (!AS?.list) return null;
  const rows = AS.list(slug, !!lowerIsBetter);
  const top = rows[0];
  if (!top || !Number.isFinite(top.score)) return null;
  return top.score;
}

function bestScoreForGameSlug(slug) {
  const fromLb = readArcadeLeaderboardTop(slug, false);
  if (fromLb != null) return fromLb;
  if (slug === "maze") return readMazeBestLegacy();
  if (slug === "meerkat") return readMeerkatBestLegacy();
  return null;
}

function shortTitleForScoreboard(title) {
  const u = String(title).toUpperCase();
  if (u.includes("PEGGLE")) return "PEGGLE";
  if (u.includes("MAZE")) return "MAZE";
  if (u.includes("MANOR")) return "MANOR";
  if (u.includes("MEERKAT") && u.includes("RUN")) return "MEERKAT";
  if (u.includes("MEERKAT")) return "MEERKAT";
  const t = u.replace(/[^A-Z0-9]+/g, " ").trim();
  return t.slice(0, 10) || "GAME";
}

function formatScoreboardNumber(n) {
  if (n == null || !Number.isFinite(n)) return "   —   ";
  const v = Math.max(0, Math.floor(n));
  return String(Math.min(v, 99999)).padStart(5, "0");
}

function scoreboardRowsFromGames(games) {
  const list = Array.isArray(games) ? games.slice(0, 6) : [];
  return list.map((g) => ({
    label: shortTitleForScoreboard(g.title || g.slug || "GAME"),
    value: formatScoreboardNumber(bestScoreForGameSlug(g.slug)),
  }));
}

function paintScoreboardOntoCanvas(ctx, w, h, rows) {
  ctx.fillStyle = "#050208";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 20, 147, 0.75)";
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.strokeStyle = "rgba(0, 255, 238, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff6eb4";
  ctx.shadowColor = "#ff1493";
  ctx.shadowBlur = 12;
  ctx.fillText("◆ ARCADE HIGH SCORES ◆", w / 2, 52);
  ctx.shadowBlur = 0;

  const rowStep = rows.length > 4 ? 48 : 56;
  ctx.font = rows.length > 4 ? "24px monospace" : "28px monospace";
  for (let i = 0; i < rows.length; i++) {
    const y = 102 + i * rowStep;
    ctx.fillStyle = "#7df9ff";
    ctx.textAlign = "left";
    ctx.fillText(rows[i].label, 72, y);
    ctx.fillStyle = "#c8ffc8";
    ctx.textAlign = "right";
    ctx.fillText(rows[i].value, w - 72, y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.moveTo(52, y + 14);
    ctx.lineTo(w - 52, y + 14);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 20, 147, 0.15)";
  for (let i = 0; i < 400; i++) {
    const x = (i * 97) % w;
    const yy = (i * 53) % h;
    ctx.fillRect(x, yy, 2, 2);
  }
}

function addNeonTube(scene, ax, ay, az, len, axis, color, intensity = 1.35) {
  const geo =
    axis === "x"
      ? new THREE.BoxGeometry(len, 0.1, 0.14)
      : axis === "z"
        ? new THREE.BoxGeometry(0.14, 0.1, len)
        : new THREE.BoxGeometry(0.14, len, 0.1);
  const c = new THREE.Color(color);
  const mat = new THREE.MeshStandardMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.05,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(ax, ay, az);
  scene.add(m);
  return m;
}

function makeTextTexture(lines, opts = {}) {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = opts.bg || "#06040a";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.strokeStyle = opts.border || "rgba(255,0,170,0.35)";
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = opts.color || "#c8ffc8";
  ctx.font = "bold 28px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const main = lines[0] || "";
  ctx.fillText(main.slice(0, 22), w / 2, h * 0.38);
  ctx.font = "18px monospace";
  ctx.fillStyle = opts.muted || "rgba(200,220,200,0.75)";
  const sub = lines[1] || "";
  wrapText(ctx, sub, w / 2, h * 0.62, w - 48, 20);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Floating cabinet title — transparent canvas with a glowing neon banner.
 * Sprites use this so the label always faces the camera and reads from any
 * angle in the lobby.
 */
function makeFloatingTitleTexture(title, cssColor) {
  const w = 768;
  const h = 192;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const cleanHex =
    typeof cssColor === "string" && /^#?[0-9a-f]{6}$/i.test(cssColor)
      ? cssColor.startsWith("#") ? cssColor : "#" + cssColor
      : "#ff66c4";
  const r = parseInt(cleanHex.slice(1, 3), 16);
  const g = parseInt(cleanHex.slice(3, 5), 16);
  const b = parseInt(cleanHex.slice(5, 7), 16);
  const rgba = (a) => `rgba(${r},${g},${b},${a})`;

  // Soft radial halo behind the text so the label feels lit.
  const grad = ctx.createRadialGradient(w / 2, h / 2, 12, w / 2, h / 2, h * 0.85);
  grad.addColorStop(0, rgba(0.42));
  grad.addColorStop(0.55, rgba(0.14));
  grad.addColorStop(1, rgba(0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const text = String(title || "").toUpperCase();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Auto-shrink so long titles still fit. Monospace font keeps the look
  // consistent with the rest of the arcade canvas signage.
  let size = 92;
  ctx.font = `bold ${size}px monospace`;
  while (ctx.measureText(text).width > w - 56 && size > 36) {
    size -= 4;
    ctx.font = `bold ${size}px monospace`;
  }

  // Outer glow (in marquee color), then a bright white core, then a thin
  // dark stroke for legibility against pale walls.
  ctx.shadowColor = cleanHex;
  ctx.shadowBlur = 38;
  ctx.fillStyle = cleanHex;
  ctx.fillText(text, w / 2, h / 2);
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, w / 2, h / 2);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.strokeText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(/\s+/);
  let line = "";
  let yy = y - lineH;
  for (let n = 0; n < words.length; n++) {
    const test = line + words[n] + " ";
    if (ctx.measureText(test).width > maxW && n > 0) {
      ctx.fillText(line.trim(), x, yy);
      line = words[n] + " ";
      yy += lineH;
      if (yy > y + lineH * 2) break;
    } else line = test;
  }
  ctx.fillText(line.trim(), x, yy);
}

function createCabinet(game, spec, isHero) {
  const scale = isHero ? 1.12 : 1;
  const group = new THREE.Group();
  group.userData.slug = game.slug;
  group.userData.title = game.title;
  group.userData.href = `${String(game.slug).replace(/^\//, "").replace(/\/$/, "")}/index.html`;

  const wood = new THREE.MeshStandardMaterial({
    color: 0x3d1848,
    roughness: 0.82,
    metalness: 0.18,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x0c060e,
    roughness: 0.94,
    metalness: 0.35,
  });

  const marqC = hexToColor(game.marquee);
  const scrC = hexToColor(game.screen);
  const sideLMat = new THREE.MeshStandardMaterial({
    color: marqC,
    emissive: marqC,
    emissiveIntensity: 0.35,
    roughness: 0.55,
    metalness: 0.1,
  });
  const sideRMat = new THREE.MeshStandardMaterial({
    color: scrC,
    emissive: scrC,
    emissiveIntensity: 0.32,
    roughness: 0.55,
    metalness: 0.1,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35 * scale, 1.55 * scale, 0.85 * scale), wood);
  body.position.y = 0.775 * scale;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const sideW = 0.08 * scale;
  const sideH = 1.25 * scale;
  const sideD = 0.72 * scale;
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(sideW, sideH, sideD), sideLMat);
  sideL.position.set(-0.72 * scale, 0.85 * scale, 0);
  group.add(sideL);
  const sideR = new THREE.Mesh(new THREE.BoxGeometry(sideW, sideH, sideD), sideRMat);
  sideR.position.set(0.72 * scale, 0.85 * scale, 0);
  group.add(sideR);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15 * scale, 0.35 * scale, 0.05 * scale), dark);
  panel.position.set(0, 0.35 * scale, 0.43 * scale);
  group.add(panel);

  const marquee = new THREE.Mesh(
    new THREE.BoxGeometry(1.25 * scale, 0.22 * scale, 0.06 * scale),
    new THREE.MeshStandardMaterial({
      color: marqC,
      emissive: marqC,
      emissiveIntensity: 1.25,
      roughness: 0.35,
      metalness: 0.12,
    })
  );
  marquee.position.set(0, 1.64 * scale, 0.38 * scale);
  group.add(marquee);

  const scr = hexToColor(game.screen);
  const screenTex = makeTextTexture([game.title, game.blurb], {
    color: `#${scr.toString(16).padStart(6, "0")}`,
    muted: "rgba(200, 255, 240, 0.82)",
    bg: "#040208",
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05 * scale, 0.72 * scale),
    new THREE.MeshStandardMaterial({
      map: screenTex,
      emissive: scr,
      emissiveIntensity: 0.78,
      roughness: 0.45,
      metalness: 0,
    })
  );
  screen.position.set(0, 1.02 * scale, 0.45 * scale);
  group.add(screen);
  group.userData.screenMesh = screen;

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(1.12 * scale, 0.78 * scale, 0.04 * scale),
    new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.3, metalness: 0.8 })
  );
  bezel.position.set(0, 1.02 * scale, 0.41 * scale);
  group.add(bezel);

  // Floating title — Sprite billboards always face the camera so the label
  // is readable from anywhere on the arcade floor.
  const titleTex = makeFloatingTitleTexture(game.title, game.marquee);
  const titleSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: titleTex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    })
  );
  const titleW = (isHero ? 2.1 : 1.9) * scale;
  titleSprite.scale.set(titleW, titleW * 0.25, 1);
  const titleBaseY = (isHero ? 2.6 : 2.42) * scale;
  titleSprite.position.set(0, titleBaseY, 0);
  titleSprite.renderOrder = 5;
  group.add(titleSprite);
  group.userData.titleSprite = titleSprite;
  group.userData.titleBaseY = titleBaseY;

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.2 * scale, 0.12 * scale), dark);
  legL.position.set(-0.52 * scale, 0.1 * scale, 0.32 * scale);
  const legR = legL.clone();
  legR.position.x = 0.52 * scale;
  const legB = legL.clone();
  legB.position.set(-0.52 * scale, 0.1 * scale, -0.32 * scale);
  const legB2 = legL.clone();
  legB2.position.set(0.52 * scale, 0.1 * scale, -0.32 * scale);
  group.add(legL, legR, legB, legB2);

  group.position.set(spec.x, 0, spec.z);
  group.rotation.y = spec.rotY;

  group.updateMatrixWorld(true);
  group.userData.hitBox = new THREE.Box3().setFromObject(group);
  group.userData.screenLocal = new THREE.Vector3(0, 1.02 * scale, 0.42 * scale);

  return group;
}

function makeSignTexture(text, sub) {
  const w = 1024;
  const h = 340;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#4a0838");
  g.addColorStop(0.5, "#1a0620");
  g.addColorStop(1, "#0a1028");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 20, 147, 0.6)";
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  /** Retro “sun” + Pac wedge nod above the title */
  const cx = w / 2;
  const cy = 62;
  for (let r = 0; r < 10; r++) {
    ctx.strokeStyle = `rgba(255, 236, 59, ${0.35 - r * 0.028})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 28 + r * 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffeb3b";
  ctx.shadowColor = "#ffc107";
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, 26, -0.35 * Math.PI, 0.35 * Math.PI, false);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fffde7";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * 16, cy - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "bold 72px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ff1493";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#ff6eb4";
  ctx.fillText(text, w / 2, h * 0.48);
  ctx.shadowBlur = 0;
  ctx.font = "28px monospace";
  ctx.fillStyle = "#7df9ff";
  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = 16;
  ctx.fillText(sub, w / 2, h * 0.78);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePrizeCounterTexture() {
  const w = 768;
  const h = 200;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#120818";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 204, 0, 0.85)";
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.font = "bold 52px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ffcc00";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffe082";
  ctx.fillText("PRIZE COUNTER", w / 2, h * 0.38);
  ctx.shadowBlur = 10;
  ctx.font = "22px monospace";
  ctx.fillStyle = "#80deea";
  ctx.fillText("TOKENS · REDEEM · RITA", w / 2, h * 0.72);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Low-poly attendant behind the counter (idle animation in main loop).
 */
function buildArcadeAttendantNpc() {
  const root = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({
    color: 0xc2187a,
    roughness: 0.72,
    metalness: 0.05,
  });
  const pants = new THREE.MeshStandardMaterial({ color: 0x283593, roughness: 0.82, metalness: 0.05 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf5cbb6, roughness: 0.68, metalness: 0 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.9, metalness: 0.1 });

  const footL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.26), shoe);
  footL.position.set(-0.12, 0.04, 0.06);
  root.add(footL);
  const footR = footL.clone();
  footR.position.set(0.12, 0.04, 0.06);
  root.add(footR);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.24), pants);
  pelvis.position.y = 0.2;
  root.add(pelvis);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.3), shirt);
  torso.position.y = 0.58;
  root.add(torso);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.4, 0.11), shirt);
  armL.position.set(-0.3, 0.55, 0.02);
  armL.name = "npcArmL";
  root.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.4, 0.11), shirt);
  armR.position.set(0.3, 0.55, 0.02);
  armR.name = "npcArmR";
  root.add(armR);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), skin);
  head.position.y = 1.05;
  head.name = "npcHead";
  root.add(head);

  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.12, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.88 })
  );
  hair.position.y = 1.16;
  root.add(hair);

  const badge = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffee58,
      emissive: 0xffc107,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    })
  );
  badge.position.set(0.12, 0.62, 0.152);
  root.add(badge);

  return { root, head, armL, armR, baseY: 0 };
}

function buildPrizeCounterStation(scene, roomW, roomD) {
  const d = roomD / 2;
  const station = new THREE.Group();
  station.position.set(0, 0, d - 0.92);

  const deskMat = new THREE.MeshStandardMaterial({
    color: 0x5d4037,
    roughness: 0.88,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xffc107,
    emissive: 0xff9800,
    emissiveIntensity: 0.55,
    roughness: 0.45,
    metalness: 0.25,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723,
    roughness: 0.55,
    metalness: 0.35,
  });

  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.02, 0.74), deskMat);
  desk.position.y = 0.51;
  desk.castShadow = true;
  desk.receiveShadow = true;
  station.add(desk);

  const trimF = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.06, 0.05), trimMat);
  trimF.position.set(0, 1.02, -0.365);
  station.add(trimF);

  const top = new THREE.Mesh(new THREE.BoxGeometry(3.95, 0.11, 0.82), topMat);
  top.position.y = 1.08;
  top.castShadow = true;
  station.add(top);

  const signTex = makePrizeCounterTexture();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 0.62),
    new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0xff1493,
      emissiveIntensity: 0.28,
      roughness: 0.5,
      metalness: 0,
      transparent: true,
    })
  );
  sign.position.set(0, 1.52, -0.385);
  sign.rotation.x = -0.1;
  station.add(sign);

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.18, 0.12, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      emissive: 0xffc400,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.5,
    })
  );
  bowl.position.set(0.85, 1.14, -0.15);
  station.add(bowl);

  const register = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.28, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.4, metalness: 0.5 })
  );
  register.position.set(-0.95, 1.22, -0.12);
  station.add(register);

  const registerGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.14),
    new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00bcd4,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    })
  );
  registerGlow.position.set(-0.95, 1.26, -0.285);
  station.add(registerGlow);

  /** Invisible hit surface for E / crosshair (must stay visible for raycaster) */
  const interactMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.001,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const prizeInteractMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.25), interactMat);
  prizeInteractMesh.position.set(0, 1.08, -0.5);
  prizeInteractMesh.name = "prizeCounterInteract";
  prizeInteractMesh.userData.interactKind = "prizeCounter";
  station.add(prizeInteractMesh);

  station.updateMatrixWorld(true);
  station.userData.hitBox = new THREE.Box3().setFromObject(station);

  scene.add(station);

  const warm = new THREE.PointLight(0xffaa66, 1.05, 9, 2);
  warm.position.set(0, 2.35, d - 0.85);
  scene.add(warm);

  const npcParts = buildArcadeAttendantNpc();
  npcParts.root.position.set(-1.38, 0, d - 0.9);
  npcParts.root.rotation.y = 0.52;
  npcParts.baseY = 0;
  scene.add(npcParts.root);

  const nameTex = (() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "rgba(8,4,16,0.92)";
    x.fillRect(0, 0, 256, 64);
    x.strokeStyle = "#ff80ab";
    x.strokeRect(2, 2, 252, 60);
    x.font = "bold 28px monospace";
    x.fillStyle = "#fce4ec";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("RITA", 128, 32);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const namePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.14),
    new THREE.MeshStandardMaterial({
      map: nameTex,
      emissive: 0xff4081,
      emissiveIntensity: 0.2,
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  namePlane.position.set(0, 1.84, 0.26);
  namePlane.rotation.y = Math.PI;
  npcParts.root.add(namePlane);
  npcParts.namePlane = namePlane;

  return { station, prizeInteractMesh, npcParts, warmLight: warm };
}

function addHangingSign(scene, roomW, roomD, wallH) {
  const d = roomD / 2;
  const tex = makeSignTexture("FUNLAND ARCADE", "INSERT IMAGINATION");
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xff1493,
    emissiveIntensity: 0.45,
    roughness: 0.5,
    metalness: 0.1,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.05), mat);
  sign.position.set(0, wallH - 1.02, -d + 0.55);
  scene.add(sign);
  const chainMat = new THREE.MeshStandardMaterial({
    color: 0x333344,
    metalness: 0.6,
    roughness: 0.4,
  });
  for (const sx of [-2.2, 2.2]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8), chainMat);
    c.position.set(sx, wallH - 0.32, -d + 0.52);
    scene.add(c);
  }
}

function addWallMurals(scene, roomW, roomD, wallH) {
  const w = roomW / 2;
  const d = roomD / 2;
  const t = wallH * 0.45;
  let k = 0;
  for (let z = -d + 4; z < d - 2; z += 3.8) {
    const vL = k++;
    const vR = k++;
    const texL = makePopMuralTexture(vL);
    const texR = makePopMuralTexture(vR);
    const matL = new THREE.MeshStandardMaterial({
      map: texL,
      color: 0xffffff,
      emissive: 0xff1493,
      emissiveIntensity: 0.06,
      roughness: 0.88,
      metalness: 0.02,
      transparent: true,
      opacity: 0.94,
    });
    const matR = new THREE.MeshStandardMaterial({
      map: texR,
      color: 0xffffff,
      emissive: 0x00fff2,
      emissiveIntensity: 0.055,
      roughness: 0.88,
      metalness: 0.02,
      transparent: true,
      opacity: 0.94,
    });
    const geo = new THREE.PlaneGeometry(1.45, wallH * 0.55);
    const leftM = new THREE.Mesh(geo, matL);
    leftM.position.set(-w + 0.21, t, z);
    leftM.rotation.y = Math.PI / 2;
    scene.add(leftM);
    const rightM = new THREE.Mesh(geo.clone(), matR);
    rightM.position.set(w - 0.21, t, z + 1.9);
    rightM.rotation.y = -Math.PI / 2;
    scene.add(rightM);
  }
}

function addBackWallScoreboard(scene, roomW, roomD, wallH, games) {
  const d = roomD / 2;
  const cw = 640;
  const ch = 340;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const refreshScoreboard = () => {
    paintScoreboardOntoCanvas(ctx, cw, ch, scoreboardRowsFromGames(games));
    tex.needsUpdate = true;
  };
  refreshScoreboard();

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xff1493,
    emissiveIntensity: 0.22,
    roughness: 0.55,
    metalness: 0.05,
    transparent: true,
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.15), mat);
  board.position.set(0, wallH * 0.38, -d + 0.21);
  scene.add(board);

  const gl = new THREE.PointLight(0xff66cc, 0.85, 9, 2);
  gl.position.set(-1.4, wallH * 0.42, -d + 2.5);
  scene.add(gl);
  const gr = new THREE.PointLight(0x66fff2, 0.75, 9, 2);
  gr.position.set(1.4, wallH * 0.42, -d + 2.5);
  scene.add(gr);

  const bannerTex = (() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 384;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 128, 384);
    g.addColorStop(0, "#ff1493");
    g.addColorStop(0.5, "#7b1fa2");
    g.addColorStop(1, "#00bcd4");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 384);
    x.strokeStyle = "rgba(255,255,255,0.35)";
    x.lineWidth = 4;
    x.strokeRect(6, 6, 116, 372);
    x.fillStyle = "#fffde7";
    x.font = "bold 22px monospace";
    x.save();
    x.translate(70, 200);
    x.rotate(-Math.PI / 2);
    x.fillText("PLAY", 0, 0);
    x.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const bMat = new THREE.MeshStandardMaterial({
    map: bannerTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.12,
    roughness: 0.7,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  for (const sx of [-5.2, 5.2]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.85), bMat);
    b.position.set(sx, wallH * 0.42, -d + 0.2);
    scene.add(b);
  }

  return { refreshScoreboard };
}

/** Chase lights under the exit — materials returned for animate(). */
function addFrontWallMarquee(scene, roomW, roomD, wallH) {
  const d = roomD / 2;
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW - 4.5, 0.28),
    new THREE.MeshStandardMaterial({
      color: 0x0a0610,
      emissive: 0xff1493,
      emissiveIntensity: 0.04,
      roughness: 0.92,
      metalness: 0.05,
    })
  );
  back.position.set(0, wallH * 0.56, d - 0.22);
  back.rotation.y = Math.PI;
  scene.add(back);

  const n = 13;
  const xs = [];
  const span = roomW - 5.2;
  const x0 = -span / 2;
  for (let i = 0; i < n; i++) xs.push(x0 + (span / (n - 1)) * i);

  const materials = [];
  const pink = new THREE.Color(0xff1493);
  const cyan = new THREE.Color(0x00fff2);
  const gold = new THREE.Color(0xffea00);
  const cols = [pink, cyan, gold];
  const geo = new THREE.SphereGeometry(0.11, 10, 8);
  for (let i = 0; i < n; i++) {
    const c = cols[i % cols.length];
    const mat = new THREE.MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 0.2,
      roughness: 0.25,
      metalness: 0.15,
    });
    materials.push(mat);
    const bulb = new THREE.Mesh(geo, mat);
    bulb.position.set(xs[i], wallH * 0.56, d - 0.26);
    scene.add(bulb);
  }
  return materials;
}

/** Benches flush to the front wall, off the main aisle — collidable. */
function addFrontWallBenches(scene, roomW, roomD) {
  const d = roomD / 2;
  const wood = new THREE.MeshStandardMaterial({
    color: 0x4e342e,
    roughness: 0.88,
    metalness: 0.06,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0xff1493,
    emissive: 0xff1493,
    emissiveIntensity: 0.28,
    roughness: 0.5,
    metalness: 0.18,
  });

  function benchAt(sx) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.09, 0.4), wood);
    seat.position.set(0, 0.42, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    g.add(seat);
    const tL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.4), trim);
    tL.position.set(-0.655, 0.42, 0);
    const tR = tL.clone();
    tR.position.x = 0.655;
    g.add(tL, tR);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.5, 0.08), wood);
    back.position.set(0, 0.7, 0.195);
    back.castShadow = true;
    g.add(back);
    const legGeo = new THREE.BoxGeometry(0.11, 0.42, 0.11);
    for (const [lx, lz] of [
      [-0.52, 0.1],
      [0.52, 0.1],
      [-0.52, -0.1],
      [0.52, -0.1],
    ]) {
      const leg = new THREE.Mesh(legGeo, wood);
      leg.position.set(lx, 0.21, lz);
      leg.castShadow = true;
      g.add(leg);
    }
    g.position.set(sx, 0, d - 0.4);
    g.updateMatrixWorld(true);
    g.userData.hitBox = new THREE.Box3().setFromObject(g);
    scene.add(g);
    return g;
  }

  return [benchAt(-4.35), benchAt(4.35)];
}

/** LED skirting along inner wall bases — pink / cyan wash. */
function addNeonSkirting(scene, roomW, roomD, wallH) {
  const w = roomW / 2;
  const d = roomD / 2;
  const h = 0.065;
  const inset = 0.2;
  const mk = (color, emissive, x, y, z, gw, gd) => {
    const c = new THREE.Color(color);
    const m = new THREE.MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: emissive,
      roughness: 0.45,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(gw, h, gd), m);
    mesh.position.set(x, y, z);
    scene.add(mesh);
  };
  const y = h * 0.5 + 0.002;
  mk(0xff1493, 0.95, 0, y, -d + inset, roomW - 2.2, 0.1);
  mk(0x00fff2, 0.85, 0, y, d - inset, roomW - 2.2, 0.1);
  mk(0x00fff2, 0.88, -w + inset, y, 0, 0.1, roomD - 2.2);
  mk(0xff1493, 0.88, w - inset, y, 0, 0.1, roomD - 2.2);
}

/** Two wide parallel pink ceiling rails (leading lines down the aisle). */
function addTwinCeilingRails(scene, roomW, roomD, wallH) {
  const w = roomW / 2;
  const len = roomD - 2.8;
  const pink = new THREE.Color(0xff1493);
  const materials = [];
  for (const ox of [-w * 0.42, w * 0.42]) {
    const mat = new THREE.MeshStandardMaterial({
      color: pink,
      emissive: pink,
      emissiveIntensity: 1.15,
      roughness: 0.28,
      metalness: 0.08,
    });
    materials.push(mat);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, len), mat);
    rail.position.set(ox, wallH - 0.16, 0);
    scene.add(rail);
  }
  return materials;
}

function makeWelcomeMatTexture() {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 20, w * 0.5, h * 0.5, h * 0.85);
  g.addColorStop(0, "#2a1040");
  g.addColorStop(0.5, "#140820");
  g.addColorStop(1, "#0a0612");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 20, 147, 0.75)";
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = "rgba(0, 255, 238, 0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, w - 52, h - 52);
  ctx.font = "bold 42px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ff6eb4";
  ctx.shadowColor = "#ff1493";
  ctx.shadowBlur = 14;
  ctx.fillText("WELCOME", w / 2, h * 0.38);
  ctx.shadowBlur = 0;
  ctx.font = "22px monospace";
  ctx.fillStyle = "#7df9ff";
  ctx.fillText("FUNLAND · FREE PLAY", w / 2, h * 0.62);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 120; i++) {
    ctx.fillRect((i * 97) % w, (i * 53) % h, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addEntranceWelcomeMat(scene, roomW, roomD) {
  const d = roomD / 2;
  const tex = makeWelcomeMatTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xff1493,
    emissiveIntensity: 0.12,
    roughness: 0.75,
    metalness: 0.05,
    transparent: true,
    opacity: 0.96,
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), mat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.022, d - 2.85);
  scene.add(rug);
}

function makeExitSignTexture() {
  const w = 320;
  const h = 120;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a080e";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 82, 82, 0.9)";
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.font = "bold 56px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ff5252";
  ctx.shadowColor = "#ff1744";
  ctx.shadowBlur = 20;
  ctx.fillText("EXIT →", w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addFrontExitSign(scene, roomW, roomD, wallH) {
  const d = roomD / 2;
  const tex = makeExitSignTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xff1744,
    emissiveIntensity: 0.55,
    roughness: 0.45,
    metalness: 0.05,
    transparent: true,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.88), mat);
  sign.position.set(0, wallH * 0.72, d - 0.21);
  sign.rotation.y = Math.PI;
  scene.add(sign);
  return mat;
}

/** Corner vending column — extra color near the prize desk. */
function addSodaMachine(scene, roomW, roomD) {
  const d = roomD / 2;
  const body = new THREE.MeshStandardMaterial({
    color: 0xc62828,
    emissive: 0x8b0000,
    emissiveIntensity: 0.12,
    roughness: 0.55,
    metalness: 0.2,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xa8a8b8,
    roughness: 0.2,
    metalness: 0.9,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x00e676,
    emissive: 0x00e676,
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.1,
  });
  const g = new THREE.Group();
  g.position.set(roomW * 0.38, 0, d - 3.1);
  g.rotation.y = -0.35;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.65, 0.58), body);
  box.position.y = 0.825;
  box.castShadow = true;
  g.add(box);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.95), glow);
  win.position.set(0, 0.88, 0.295);
  g.add(win);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.62), chrome);
  top.position.y = 1.71;
  g.add(top);
  scene.add(g);
  const pl = new THREE.PointLight(0x00ff88, 0.45, 4.5, 2);
  pl.position.set(roomW * 0.38, 1.2, d - 2.95);
  scene.add(pl);
}

function addSnackMachine(scene, roomW, roomD) {
  const d = roomD / 2;
  const body = new THREE.MeshStandardMaterial({
    color: 0x1565c0,
    emissive: 0x0d47a1,
    emissiveIntensity: 0.1,
    roughness: 0.55,
    metalness: 0.22,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xb0b8c8,
    roughness: 0.18,
    metalness: 0.92,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0xff9100,
    emissive: 0xff6d00,
    emissiveIntensity: 0.78,
    roughness: 0.4,
    metalness: 0.08,
  });
  const g = new THREE.Group();
  g.position.set(-roomW * 0.38, 0, d - 3.4);
  g.rotation.y = 0.38;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.55, 0.55), body);
  box.position.y = 0.775;
  box.castShadow = true;
  g.add(box);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.88), glow);
  win.position.set(0, 0.82, 0.28);
  g.add(win);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.11, 0.58), chrome);
  top.position.y = 1.605;
  g.add(top);
  scene.add(g);
  const pl = new THREE.PointLight(0xff8800, 0.38, 4.2, 2);
  pl.position.set(-roomW * 0.38, 1.15, d - 3.25);
  scene.add(pl);
}

function addHighWallPosters(scene, roomW, roomD, wallH) {
  const w = roomW / 2;
  const d = roomD / 2;
  const mkTex = (label, hue) => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 384;
    const x = c.getContext("2d");
    const gr = x.createLinearGradient(0, 0, 256, 384);
    gr.addColorStop(0, `hsl(${hue}, 85%, 22%)`);
    gr.addColorStop(1, "#0a0612");
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 384);
    x.strokeStyle = "rgba(255,255,255,0.25)";
    x.lineWidth = 4;
    x.strokeRect(8, 8, 240, 368);
    x.font = "bold 38px monospace";
    x.textAlign = "center";
    x.fillStyle = "#fff8e1";
    x.fillText(label, 128, 200);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const matL = new THREE.MeshStandardMaterial({
    map: mkTex("NEW!", 320),
    emissive: 0xff1493,
    emissiveIntensity: 0.06,
    roughness: 0.75,
    metalness: 0,
    transparent: true,
    opacity: 0.92,
  });
  const matR = new THREE.MeshStandardMaterial({
    map: mkTex("1UP", 185),
    emissive: 0x00bcd4,
    emissiveIntensity: 0.06,
    roughness: 0.75,
    metalness: 0,
    transparent: true,
    opacity: 0.92,
  });
  const geo = new THREE.PlaneGeometry(0.95, 1.42);
  const pL = new THREE.Mesh(geo, matL);
  pL.position.set(-w + 0.22, wallH * 0.78, 2.5);
  pL.rotation.y = Math.PI / 2;
  scene.add(pL);
  const pR = new THREE.Mesh(geo, matR);
  pR.position.set(w - 0.22, wallH * 0.78, -1.2);
  pR.rotation.y = -Math.PI / 2;
  scene.add(pR);
}

/** Horizontal neon band wrapping the room at mid height. */
function addMidWallNeonBand(scene, roomW, roomD, wallH) {
  const w = roomW / 2;
  const d = roomD / 2;
  const y = wallH * 0.62;
  const h = 0.055;
  const inset = 0.19;
  const mk = (color, ei, x, yy, z, gw, gd) => {
    const c = new THREE.Color(color);
    const m = new THREE.MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: ei,
      roughness: 0.4,
      metalness: 0.12,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(gw, h, gd), m);
    mesh.position.set(x, yy, z);
    scene.add(mesh);
  };
  mk(0xaa00ff, 0.75, 0, y, -d + inset, roomW - 2.4, 0.09);
  mk(0xaa00ff, 0.75, 0, y, d - inset, roomW - 2.4, 0.09);
  mk(0xff00aa, 0.78, -w + inset, y, 0, 0.09, roomD - 2.4);
  mk(0xff00aa, 0.78, w - inset, y, 0, 0.09, roomD - 2.4);
}

/** Low velvet-rope stanchions — defines the aisle without blocking play. */
function addAisleStanchions(scene, roomW, roomD) {
  const w = roomW / 2;
  const d = roomD / 2;
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xc0c0d0,
    roughness: 0.25,
    metalness: 0.85,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffaa00,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.6,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0x8b0000,
    emissive: 0x440000,
    emissiveIntensity: 0.08,
    roughness: 0.9,
    metalness: 0,
  });
  const posts = [
    [-w * 0.55, -d + 8],
    [w * 0.55, -d + 8],
    [-w * 0.55, d - 7],
    [w * 0.55, d - 7],
  ];
  for (const [px, pz] of posts) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.72, 10), chrome);
    pole.position.set(px, 0.36, pz);
    scene.add(pole);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), gold);
    knob.position.set(px, 0.76, pz);
    scene.add(knob);
  }
  const ropeY = 0.62;
  const ropeGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
  const r1 = new THREE.Mesh(ropeGeo, ropeMat);
  r1.scale.set(1, w * 1.1, 1);
  r1.rotation.z = Math.PI / 2;
  r1.position.set(0, ropeY, -d + 8);
  scene.add(r1);
  const r2 = r1.clone();
  r2.position.set(0, ropeY, d - 7);
  scene.add(r2);
}

/** Small floating crystals in the aisle — subtle motion in animate(). */
function addLobbySparkles(scene, roomW, roomD, wallH) {
  const group = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(0.05, 0);
  const cols = [0xff1493, 0x00fff2, 0xffea00, 0xe040fb];
  const w = roomW / 2;
  const d = roomD / 2;
  const spots = [
    [-1.1, wallH - 1.1, -2],
    [1.2, wallH - 1.35, 1],
    [-0.6, wallH - 0.95, 4],
    [0.9, wallH - 1.2, 7],
    [-1.4, wallH - 1.05, -5],
    [1.3, wallH - 1.28, -3],
    [0, wallH - 0.88, 9],
    [-0.9, wallH - 1.15, 11],
  ];
  spots.forEach(([x, y, z], i) => {
    const c = cols[i % cols.length];
    const col = new THREE.Color(c);
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 1.05,
      roughness: 0.2,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.userData.baseY = y;
    mesh.userData.phase = i * 0.73;
    group.add(mesh);
  });
  scene.add(group);
  return group;
}

function addCrownMolding(scene, roomW, roomD, wallH) {
  const w = roomW / 2;
  const d = roomD / 2;
  const y = wallH - 0.11;
  const h = 0.14;
  const inset = 0.12;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a0a28,
    emissive: 0xffcc00,
    emissiveIntensity: 0.04,
    roughness: 0.88,
    metalness: 0.15,
  });
  const mk = (x, yy, z, gw, gd) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(gw, h, gd), mat);
    m.position.set(x, yy, z);
    scene.add(m);
  };
  mk(0, y, -d + inset, roomW - 1.2, 0.22);
  mk(0, y, d - inset, roomW - 1.2, 0.22);
  mk(-w + inset, y, 0, 0.22, roomD - 1.2);
  mk(w - inset, y, 0, 0.22, roomD - 1.2);
}

/** Floor corner washes — lifts walls from pure black. */
function addCornerUplights(scene, roomW, roomD) {
  const w = roomW / 2;
  const d = roomD / 2;
  const pairs = [
    { c: 0xff1493, p: [-w + 0.9, 0.35, -d + 0.9] },
    { c: 0x00fff2, p: [w - 0.9, 0.35, -d + 0.9] },
    { c: 0x00fff2, p: [-w + 0.9, 0.35, d - 0.9] },
    { c: 0xff1493, p: [w - 0.9, 0.35, d - 0.9] },
  ];
  for (const { c, p } of pairs) {
    const L = new THREE.PointLight(c, 0.42, 11, 2);
    L.position.set(p[0], p[1], p[2]);
    scene.add(L);
  }
}

function buildRoom(scene, roomW, roomD, games) {
  const wallH = 5.2;
  const floorMap = makeCheckerTexture();
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorMap,
    roughness: 0.55,
    metalness: 0.12,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(Math.max(roomW, roomD), 64, 0xff00aa, 0x00fff2);
  const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const gm of gridMats) {
    if (gm) {
      gm.transparent = true;
      gm.opacity = 0.22;
      gm.depthWrite = false;
    }
  }
  grid.position.y = 0.018;
  scene.add(grid);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1a0828,
    roughness: 0.97,
    metalness: 0.02,
  });
  const t = wallH / 2;
  const w = roomW / 2;
  const d = roomD / 2;

  const back = new THREE.Mesh(new THREE.BoxGeometry(roomW, wallH, 0.38), wallMat);
  back.position.set(0, t, -d);
  scene.add(back);

  const front = new THREE.Mesh(new THREE.BoxGeometry(roomW, wallH, 0.38), wallMat);
  front.position.set(0, t, d);
  scene.add(front);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.38, wallH, roomD), wallMat);
  left.position.set(-w, t, 0);
  scene.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(0.38, wallH, roomD), wallMat);
  right.position.set(w, t, 0);
  scene.add(right);

  const ceilMap = makeCeilingGridTexture();
  const ceilMat = new THREE.MeshStandardMaterial({
    map: ceilMap,
    color: 0x08060c,
    roughness: 1,
    metalness: 0,
    emissive: 0xff1493,
    emissiveIntensity: 0.04,
  });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = wallH;
  scene.add(ceil);

  const cyan = 0x00ffee;
  const pink = 0xff1493;
  const gold = 0xffcc00;

  const tubeZLen = roomD - 3;
  const twinRailMats = addTwinCeilingRails(scene, roomW, roomD, wallH);
  addNeonTube(scene, 0, wallH - 0.42, 0, tubeZLen * 0.92, "z", cyan, 0.55);

  /** Cross-beams and wall grazers */
  for (let zi = -2; zi <= 2; zi++) {
    const zz = zi * (roomD / 7);
    addNeonTube(scene, 0, wallH - 0.08, zz, roomW - 3.5, "x", gold, 0.72);
  }
  addNeonTube(scene, -w + 0.22, 2.6, 0, roomD - 2.5, "z", cyan, 0.95);
  addNeonTube(scene, w - 0.22, 2.35, 0, roomD - 2.5, "z", pink, 0.95);
  addNeonTube(scene, 0, 1.25, -d + 0.22, roomW - 2, "x", pink, 0.65);

  addWallMurals(scene, roomW, roomD, wallH);
  addHangingSign(scene, roomW, roomD, wallH);
  const { refreshScoreboard } = addBackWallScoreboard(scene, roomW, roomD, wallH, games);
  addNeonSkirting(scene, roomW, roomD, wallH);
  addCrownMolding(scene, roomW, roomD, wallH);
  addMidWallNeonBand(scene, roomW, roomD, wallH);
  addEntranceWelcomeMat(scene, roomW, roomD);
  const exitSignMat = addFrontExitSign(scene, roomW, roomD, wallH);
  const marqueeBulbMats = addFrontWallMarquee(scene, roomW, roomD, wallH);
  addAisleStanchions(scene, roomW, roomD);
  const sparkleGroup = addLobbySparkles(scene, roomW, roomD, wallH);
  addSodaMachine(scene, roomW, roomD);
  addSnackMachine(scene, roomW, roomD);
  addHighWallPosters(scene, roomW, roomD, wallH);
  addCornerUplights(scene, roomW, roomD);
  const lobbyBenches = addFrontWallBenches(scene, roomW, roomD);

  return {
    roomW,
    roomD,
    wallH,
    floorGrid: grid,
    lobbyBenches,
    lobbyAnim: {
      twinRailMats,
      sparkleGroup,
      exitSignMat,
      refreshScoreboard,
      marqueeBulbMats,
    },
  };
}

function clampPlayer(pos, roomW, roomD, margin = 0.45) {
  const hx = roomW / 2 - margin;
  const hz = roomD / 2 - margin;
  pos.x = Math.max(-hx, Math.min(hx, pos.x));
  pos.z = Math.max(-hz, Math.min(hz, pos.z));
}

function resolveObstacleCollisions(pos, roots, playerR = 0.35) {
  const half = new THREE.Vector3();
  const center = new THREE.Vector3();
  for (const obj of roots) {
    const box = obj.userData.hitBox;
    if (!box) continue;
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    box.getSize(half).multiplyScalar(0.5);
    box.getCenter(center);
    const dx = pos.x - center.x;
    const dz = pos.z - center.z;
    if (Math.abs(dx) < half.x + playerR && Math.abs(dz) < half.z + playerR) {
      if (Math.abs(dx) - half.x > Math.abs(dz) - half.z) pos.x = center.x + Math.sign(dx) * (half.x + playerR);
      else pos.z = center.z + Math.sign(dz) * (half.z + playerR);
    }
  }
}

function startArcade() {
  const games = getGames();
  const blocker = document.getElementById("blocker");
  const instructions = document.getElementById("instructions");
  const promptEl = document.getElementById("hud-prompt");
  const hintEl = document.getElementById("hint");

  function requestPointerLockSupported() {
    const el = document.body;
    return (
      typeof el.requestPointerLock === "function" ||
      typeof el.webkitRequestPointerLock === "function"
    );
  }
  function useTouchStyleControls() {
    if (!requestPointerLockSupported()) return true;
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  }
  if (instructions && useTouchStyleControls()) {
    instructions.innerHTML = [
      "Tap to enter · Drag the stick (lower left) to walk · Drag the arcade floor to look",
      "Jump / Use when lit · Lobby exits walk mode · Face a cabinet — Use opens the game",
      "Prize counter: top-right · Back or Esc closes it",
    ].join("<br />");
  }

  const reduceMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotionOn = reduceMotionMq.matches;
  reduceMotionMq.addEventListener("change", () => {
    reduceMotionOn = reduceMotionMq.matches;
    applyTokenVisualTuning();
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VIBE.bgColor);
  scene.fog = new THREE.Fog(VIBE.fogColor, VIBE.fogNear, VIBE.fogFar);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 120);
  camera.rotation.order = "YXZ";
  const EYE_HEIGHT = 1.6;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  document.body.appendChild(renderer.domElement);
  renderer.domElement.id = "arcade-canvas";
  renderer.domElement.style.touchAction = "none";

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    VIBE.bloomStrength,
    VIBE.bloomRadius,
    VIBE.bloomThreshold
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const roomW = VIBE.roomW;
  const roomD = VIBE.roomD;
  const { floorGrid, lobbyAnim, lobbyBenches } = buildRoom(scene, roomW, roomD, games);
  const prizeSetup = buildPrizeCounterStation(scene, roomW, roomD);
  const { station: prizeStation, prizeInteractMesh, npcParts: prizeNpcParts } = prizeSetup;

  const amb = new THREE.AmbientLight(0xff88dd, 0.12);
  scene.add(amb);
  const hemi = new THREE.HemisphereLight(0xff00aa, 0x004455, 0.58);
  scene.add(hemi);
  const spot = new THREE.SpotLight(0xff66ff, 2.45, 56, Math.PI / 4, 0.48, 1);
  spot.position.set(0, 4.85, roomD * 0.22);
  spot.target.position.set(0, 1.2, -roomD * 0.42);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0002;
  scene.add(spot);
  scene.add(spot.target);

  const cyanWash = new THREE.PointLight(0x00fff2, 0.55, 28, 2);
  cyanWash.position.set(roomW * 0.42, 2.4, 2);
  scene.add(cyanWash);
  const pinkWash = new THREE.PointLight(0xff1493, 0.58, 28, 2);
  pinkWash.position.set(-roomW * 0.42, 2.4, -4);
  scene.add(pinkWash);

  const flickerLights = [
    { light: spot, base: 2.05, mul: 0.11, f: 1.65 },
    { light: cyanWash, base: 0.45, mul: 0.08, f: 2.2 },
    { light: pinkWash, base: 0.5, mul: 0.09, f: 1.85 },
  ];

  function applyTokenVisualTuning() {
    const AT = window.ArcadeTokens;
    const u = AT?.getUpgrades?.() ?? {};
    const n = u.neonBoost ? 1 : 0;
    const sb = u.spotBoost ? 1 : 0;
    const gg = u.gridGlow ? 1 : 0;
    const wf = u.wideFov ? 1 : 0;
    const motionBloom = reduceMotionOn ? 0.42 : 1;
    bloomPass.strength = (VIBE.bloomStrength + n * 0.15) * motionBloom;
    bloomPass.radius = (VIBE.bloomRadius + n * 0.07) * (reduceMotionOn ? 0.65 : 1);
    hemi.intensity = 0.58 + n * 0.1;
    cyanWash.intensity = 0.55 + n * 0.18;
    pinkWash.intensity = 0.58 + n * 0.2;
    spot.intensity = 2.45 + n * 0.28 + sb * 0.55;
    flickerLights[0].base = 2.05 + n * 0.12 + sb * 0.35;
    flickerLights[1].base = 0.45 + n * 0.1;
    flickerLights[2].base = 0.5 + n * 0.1;
    if (floorGrid) {
      const m = floorGrid.material;
      const mats = Array.isArray(m) ? m : m ? [m] : [];
      const op = 0.22 + gg * 0.16;
      for (const mat of mats) {
        if (mat) mat.opacity = op;
      }
    }
    camera.fov = 72 + wf * 6;
    camera.updateProjectionMatrix();
  }

  function getWalkSpeed() {
    return 5.2 * (window.ArcadeTokens?.getUpgrades?.()?.walkMult || 1);
  }

  function syncTokenHud() {
    const AT = window.ArcadeTokens;
    const bal = AT?.getBalance?.() ?? 0;
    const c = document.getElementById("token-count");
    const c2 = document.getElementById("token-shop-count");
    const souv = document.getElementById("souvenir-slot");
    if (c) c.textContent = String(bal);
    if (c2) c2.textContent = String(bal);
    if (souv && AT?.getUpgrades) {
      const u = AT.getUpgrades();
      let s = "";
      if (u.souvenir) s += "🪙";
      if (u.sticker) s += "⭐";
      if (u.lanyard) s += "🎫";
      souv.textContent = s;
    }
  }

  function buildShopList() {
    const AT = window.ArcadeTokens;
    const list = document.getElementById("token-shop-list");
    if (!list || !AT?.EXCHANGE) return;
    list.innerHTML = "";
    for (const item of AT.EXCHANGE) {
      const li = document.createElement("li");
      const name = document.createElement("div");
      name.className = "prize-name";
      name.textContent = item.name;
      const desc = document.createElement("div");
      desc.className = "prize-desc";
      desc.textContent = item.desc;
      const row = document.createElement("div");
      row.className = "prize-row";
      const cost = document.createElement("span");
      cost.className = "prize-cost";
      cost.textContent = `${item.cost} tokens`;
      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "prize-buy";
      const owned = AT.isPrizeOwned?.(item.id);
      if (owned) {
        buy.disabled = true;
        buy.textContent = "Owned";
      } else {
        buy.textContent = "Redeem";
      }
      buy.addEventListener("click", () => {
        const msg = document.getElementById("token-shop-msg");
        const r = AT.buy(item.id);
        if (msg) msg.textContent = r.msg;
        syncTokenHud();
        applyTokenVisualTuning();
        buildShopList();
      });
      row.append(cost, buy);
      li.append(name, desc, row);
      list.appendChild(li);
    }
  }

  let controls;
  let touchPlayMode = false;
  let lookPointerId = null;
  const touchDrive = { dx: 0, dz: 0 };
  const joyState = { pointerId: null, originX: 0, originY: 0, knob: null, maxR: 56 };
  const keys = new Set();
  const WALK_CODES = [
    "KeyW",
    "KeyS",
    "KeyA",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];
  let walkInputArmed = false;

  function isWalkKeyCode(code) {
    return WALK_CODES.includes(code);
  }

  function resetWalkInput() {
    keys.clear();
    walkInputArmed = false;
  }

  function openTokenShop() {
    const shop = document.getElementById("token-shop");
    if (!shop) return;
    if (controls?.isLocked) controls.unlock();
    resetWalkInput();
    touchDrive.dx = 0;
    touchDrive.dz = 0;
    joyState.pointerId = null;
    lookPointerId = null;
    if (joyState.knob) joyState.knob.style.transform = "translate(0px,0px)";
    shop.hidden = false;
    const msg = document.getElementById("token-shop-msg");
    if (msg) msg.textContent = "";
    buildShopList();
    syncTokenHud();
    requestAnimationFrame(() => {
      document.querySelector(".token-shop-scroll")?.focus({ preventScroll: true });
    });
  }

  function closeTokenShop() {
    const shop = document.getElementById("token-shop");
    if (shop) shop.hidden = true;
    resetWalkInput();
  }

  applyTokenVisualTuning();
  syncTokenHud();
  window.addEventListener("arcade-tokens-changed", () => {
    syncTokenHud();
    applyTokenVisualTuning();
  });
  window.addEventListener("storage", (e) => {
    if (
      e.key === "arcade-tokens-balance-v1" ||
      e.key === "arcade-tokens-upgrades-v1"
    ) {
      syncTokenHud();
      applyTokenVisualTuning();
    }
    const k = e.key || "";
    if (
      k.startsWith("arcade-lb-v2:") ||
      k === "mazeRunnerHighScores" ||
      k === "meerkat-chase-highscore-v1"
    ) {
      lobbyAnim?.refreshScoreboard?.();
    }
  });

  window.addEventListener("focus", () => {
    lobbyAnim?.refreshScoreboard?.();
  });

  document.addEventListener("visibilitychange", () => {
    resetWalkInput();
    if (!document.hidden) lobbyAnim?.refreshScoreboard?.();
  });

  const tokenShop = document.getElementById("token-shop");
  tokenShop?.addEventListener("click", (e) => {
    if (e.target === tokenShop) closeTokenShop();
  });
  document.getElementById("token-shop-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openTokenShop();
  });
  document.getElementById("token-shop-back")?.addEventListener("click", () => closeTokenShop());
  document.getElementById("token-shop-close")?.addEventListener("click", () => closeTokenShop());
  document.querySelector(".token-shop-inner")?.addEventListener("click", (e) => e.stopPropagation());

  const layouts = layoutCabinetSlots(games.length, roomW, roomD);
  const cabinets = [];
  games.forEach((g, i) => {
    const isHero = games.length === 1 || i === games.length - 1;
    const cab = createCabinet(g, layouts[i], isHero);
    scene.add(cab);
    cabinets.push(cab);

    const c = hexToColor(g.marquee);
    const col = new THREE.Color(c);
    const pl = new THREE.PointLight(col, 1.18, 7.2, 2);
    const lo = new THREE.Vector3(0, 2.35, 0.52);
    lo.applyAxisAngle(new THREE.Vector3(0, 1, 0), cab.rotation.y);
    pl.position.copy(cab.position).add(lo);
    scene.add(pl);
  });

  const colliders = [prizeStation, ...cabinets, ...(lobbyBenches ?? [])];

  controls = new PointerLockControls(camera, document.body);
  camera.position.set(0, EYE_HEIGHT, roomD / 2 - 2.4);
  scene.add(camera);

  const raycaster = new THREE.Raycaster();
  const camWorld = new THREE.Vector3();
  const interactWorld = new THREE.Vector3();
  let verticalVelocity = 0;
  const JUMP_SPEED = 5.35;
  const GRAVITY = -21;
  let lookLastX = 0;
  let lookLastY = 0;
  const LOOK_SENS = 0.0032;

  function findInteractTarget(cam, cabs, rc) {
    rc.setFromCamera({ x: 0, y: 0 }, cam);
    const meshes = cabs.map((c) => c.userData.screenMesh).filter(Boolean);
    const hits = rc.intersectObjects(meshes, false);
    cam.getWorldPosition(camWorld);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.slug) o = o.parent;
      if (o && o.userData.slug && o.userData.screenLocal) {
        const center = o.userData.screenLocal.clone();
        o.localToWorld(center);
        if (camWorld.distanceTo(center) < 4) return o;
      }
    }
    return null;
  }

  function arcadePlaying() {
    const shop = document.getElementById("token-shop");
    if (shop && !shop.hidden) return false;
    return controls.isLocked || touchPlayMode;
  }

  function tryJump() {
    if (!arcadePlaying()) return;
    if (verticalVelocity > 0.06) return;
    if (camera.position.y > EYE_HEIGHT + 0.035) return;
    verticalVelocity = JUMP_SPEED;
  }

  function findPrizeCounterInteract(cam, mesh, rc) {
    if (!mesh) return false;
    rc.setFromCamera({ x: 0, y: 0 }, cam);
    const hits = rc.intersectObject(mesh, false);
    if (!hits.length) return false;
    cam.getWorldPosition(camWorld);
    mesh.getWorldPosition(interactWorld);
    return camWorld.distanceTo(interactWorld) < 4.35;
  }

  function tryArcadeInteract() {
    if (!controls.isLocked && !touchPlayMode) return;
    const shop = document.getElementById("token-shop");
    if (shop && !shop.hidden) return;
    const prizeHit = findPrizeCounterInteract(camera, prizeInteractMesh, raycaster);
    const target = prizeHit ? null : findInteractTarget(camera, cabinets, raycaster);
    if (prizeHit) {
      openTokenShop();
      return;
    }
    if (target) {
      try {
        sessionStorage.setItem("arcade-resume-walk-v1", "1");
      } catch (_) {
        /* ignore */
      }
      window.location.href = target.userData.href;
    }
  }

  function exitTouchPlayMode() {
    if (!touchPlayMode) return;
    touchPlayMode = false;
    touchDrive.dx = 0;
    touchDrive.dz = 0;
    lookPointerId = null;
    joyState.pointerId = null;
    if (joyState.knob) joyState.knob.style.transform = "translate(0px,0px)";
    document.body.classList.remove("locked", "touch-play-mode");
    if (blocker) blocker.style.display = "flex";
    if (instructions) instructions.style.display = "block";
    camera.position.y = EYE_HEIGHT;
    verticalVelocity = 0;
    resetWalkInput();
    if (hintEl && window.location.protocol !== "file:") hintEl.textContent = "";
    if (touchUiRoot) touchUiRoot.style.display = "none";
    const u = document.getElementById("arcade-use-btn");
    if (u) u.disabled = true;
  }

  function enterTouchPlayMode() {
    if (!games.length || touchPlayMode || controls.isLocked) return;
    resetWalkInput();
    touchPlayMode = true;
    document.body.classList.add("locked", "touch-play-mode");
    if (blocker) blocker.style.display = "none";
    if (instructions) instructions.style.display = "none";
    if (hintEl && window.location.protocol !== "file:")
      hintEl.textContent =
        "Drag right side to look · stick = walk · Jump / Use · Lobby to exit · T = prize";
    if (touchUiRoot) touchUiRoot.style.display = "block";
  }

  function enterArcadePlayMode() {
    if (!games.length || touchPlayMode || controls.isLocked) return;
    if (useTouchStyleControls()) enterTouchPlayMode();
    else controls.lock();
  }

  const touchUiRoot = document.createElement("div");
  touchUiRoot.id = "arcade-touch-ui";
  touchUiRoot.style.cssText =
    "position:fixed;inset:0;z-index:7;pointer-events:none;display:none;";
  const joyWrap = document.createElement("div");
  joyWrap.style.cssText =
    "position:absolute;bottom:max(12px,env(safe-area-inset-bottom));left:max(12px,env(safe-area-inset-left));width:min(46vw,200px);height:min(46vw,200px);pointer-events:auto;touch-action:none;";
  const joyBase = document.createElement("div");
  joyBase.style.cssText =
    "position:absolute;left:50%;top:50%;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;background:rgba(10,8,24,0.55);border:2px solid rgba(0,255,238,0.35);box-shadow:0 0 16px rgba(255,20,147,0.2);touch-action:none;";
  const joyKnob = document.createElement("div");
  joyKnob.style.cssText =
    "position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,0.2);border:2px solid rgba(255,105,180,0.65);pointer-events:none;transform:translate(0px,0px);";
  joyState.knob = joyKnob;
  joyBase.appendChild(joyKnob);
  joyWrap.appendChild(joyBase);
  touchUiRoot.appendChild(joyWrap);
  document.body.appendChild(touchUiRoot);

  function updateJoystickKnob(clientX, clientY) {
    const dx = clientX - joyState.originX;
    const dy = clientY - joyState.originY;
    const m = Math.hypot(dx, dy);
    const mr = joyState.maxR;
    const nx = m > mr ? (dx * mr) / m : dx;
    const ny = m > mr ? (dy * mr) / m : dy;
    joyKnob.style.transform = `translate(${nx}px,${ny}px)`;
    const inv = 1 / mr;
    touchDrive.dx = THREE.MathUtils.clamp(nx * inv, -1, 1);
    touchDrive.dz = THREE.MathUtils.clamp(-ny * inv, -1, 1);
  }

  function joyPointerDown(e) {
    if (!touchPlayMode) return;
    const shop = document.getElementById("token-shop");
    if (shop && !shop.hidden) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    joyState.pointerId = e.pointerId;
    const r = joyBase.getBoundingClientRect();
    joyState.originX = r.left + r.width / 2;
    joyState.originY = r.top + r.height / 2;
    joyBase.setPointerCapture(e.pointerId);
    updateJoystickKnob(e.clientX, e.clientY);
    e.preventDefault();
  }
  function joyPointerMove(e) {
    if (joyState.pointerId !== e.pointerId) return;
    updateJoystickKnob(e.clientX, e.clientY);
    e.preventDefault();
  }
  function joyPointerUp(e) {
    if (joyState.pointerId !== e.pointerId) return;
    joyState.pointerId = null;
    joyKnob.style.transform = "translate(0px,0px)";
    touchDrive.dx = 0;
    touchDrive.dz = 0;
    try {
      joyBase.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  }
  joyBase.addEventListener("pointerdown", joyPointerDown);
  joyBase.addEventListener("pointermove", joyPointerMove);
  joyBase.addEventListener("pointerup", joyPointerUp);
  joyBase.addEventListener("pointercancel", joyPointerUp);

  function canvasLookDown(e) {
    if (!touchPlayMode) return;
    if (e.target !== renderer.domElement) return;
    const shop = document.getElementById("token-shop");
    if (shop && !shop.hidden) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const leftBand = Math.min(window.innerWidth * 0.44, 220);
    if (e.clientX < leftBand) return;
    lookPointerId = e.pointerId;
    lookLastX = e.clientX;
    lookLastY = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function canvasLookMove(e) {
    if (lookPointerId !== e.pointerId) return;
    const dx = e.clientX - lookLastX;
    const dy = e.clientY - lookLastY;
    lookLastX = e.clientX;
    lookLastY = e.clientY;
    camera.rotation.y -= dx * LOOK_SENS;
    camera.rotation.x -= dy * LOOK_SENS;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x, -1.42, 1.42);
    e.preventDefault();
  }
  function canvasLookUp(e) {
    if (lookPointerId !== e.pointerId) return;
    lookPointerId = null;
    try {
      renderer.domElement.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  }
  renderer.domElement.addEventListener("pointerdown", canvasLookDown);
  renderer.domElement.addEventListener("pointermove", canvasLookMove);
  renderer.domElement.addEventListener("pointerup", canvasLookUp);
  renderer.domElement.addEventListener("pointercancel", canvasLookUp);

  document.getElementById("arcade-touch-exit")?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    exitTouchPlayMode();
  });

  document.getElementById("arcade-use-btn")?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    tryArcadeInteract();
  });

  document.addEventListener("keydown", (e) => {
    const shopEl = document.getElementById("token-shop");
    const shopOpen = !!(shopEl && !shopEl.hidden);

    if (e.code === "Escape" && shopOpen) {
      e.preventDefault();
      closeTokenShop();
      return;
    }

    if (e.code === "Escape" && touchPlayMode) {
      e.preventDefault();
      exitTouchPlayMode();
      return;
    }

    if (e.code === "KeyT" && !e.repeat) {
      e.preventDefault();
      if (shopOpen) closeTokenShop();
      else openTokenShop();
      return;
    }

    if (shopOpen || (!controls.isLocked && !touchPlayMode)) return;

    if (isWalkKeyCode(e.code)) walkInputArmed = true;
    keys.add(e.code);

    if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      tryJump();
    }
    if (e.code === "KeyE" && !e.repeat) tryArcadeInteract();
  });
  document.addEventListener("keyup", (e) => {
    keys.delete(e.code);
    if (!WALK_CODES.some((c) => keys.has(c))) walkInputArmed = false;
  });

  window.addEventListener("blur", () => {
    resetWalkInput();
  });

  document.getElementById("arcade-jump-btn")?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    tryJump();
  });

  blocker?.addEventListener("click", () => {
    enterArcadePlayMode();
  });
  blocker?.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      enterArcadePlayMode();
    },
    { passive: false }
  );

  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement != null) return;
    resetWalkInput();
  });
  document.addEventListener("pointerlockerror", () => {
    if (games.length && !touchPlayMode && !controls.isLocked) enterTouchPlayMode();
  });

  const lockedHint =
    "Esc — close prize / release look · T — toggle prize · E — play / Rita · Space — jump";
  controls.addEventListener("lock", () => {
    resetWalkInput();
    document.body.classList.remove("touch-play-mode");
    document.body.classList.add("locked");
    if (touchUiRoot) touchUiRoot.style.display = "none";
    if (blocker) blocker.style.display = "none";
    if (instructions) instructions.style.display = "none";
    if (hintEl && window.location.protocol !== "file:") hintEl.textContent = lockedHint;
  });
  controls.addEventListener("unlock", () => {
    document.body.classList.remove("locked", "touch-play-mode");
    touchPlayMode = false;
    if (touchUiRoot) touchUiRoot.style.display = "none";
    if (blocker) blocker.style.display = "flex";
    if (instructions) instructions.style.display = "block";
    camera.position.y = EYE_HEIGHT;
    verticalVelocity = 0;
    resetWalkInput();
    touchDrive.dx = 0;
    touchDrive.dz = 0;
    joyState.pointerId = null;
    lookPointerId = null;
    if (joyState.knob) joyState.knob.style.transform = "translate(0px,0px)";
    if (hintEl && window.location.protocol !== "file:") hintEl.textContent = "";
    const u = document.getElementById("arcade-use-btn");
    if (u) u.disabled = true;
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    let prompt = "";

    const tokenShopEl = document.getElementById("token-shop");
    const tokenShopOpen = !!(tokenShopEl && !tokenShopEl.hidden);

    const playing = arcadePlaying();
    if (playing) {
      const canWalk =
        touchPlayMode || (document.hasFocus() && walkInputArmed);
      if (canWalk) {
        const step = getWalkSpeed() * dt;
        let f = touchDrive.dz;
        let s = touchDrive.dx;
        if (keys.has("KeyW") || keys.has("ArrowUp")) f += 1;
        if (keys.has("KeyS") || keys.has("ArrowDown")) f -= 1;
        if (keys.has("KeyD") || keys.has("ArrowRight")) s += 1;
        if (keys.has("KeyA") || keys.has("ArrowLeft")) s -= 1;
        f = THREE.MathUtils.clamp(f, -1, 1);
        s = THREE.MathUtils.clamp(s, -1, 1);
        if (f !== 0) controls.moveForward(step * f);
        if (s !== 0) controls.moveRight(step * s);
      }
      verticalVelocity += GRAVITY * dt;
      camera.position.y += verticalVelocity * dt;
      if (camera.position.y < EYE_HEIGHT) {
        camera.position.y = EYE_HEIGHT;
        verticalVelocity = 0;
      }
      clampPlayer(camera.position, roomW, roomD);
      resolveObstacleCollisions(camera.position, colliders);

      if (findPrizeCounterInteract(camera, prizeInteractMesh, raycaster)) {
        prompt = touchPlayMode ? "Tap Use — Prize counter · Rita" : "Press E — Prize counter · Rita";
      } else {
        const t = findInteractTarget(camera, cabinets, raycaster);
        if (t)
          prompt = touchPlayMode ? `Tap Use — ${t.userData.title}` : `Press E — ${t.userData.title}`;
      }
    }

    const useBtn = document.getElementById("arcade-use-btn");
    if (useBtn && (controls.isLocked || touchPlayMode)) {
      useBtn.disabled = !prompt;
    }

    if (promptEl) promptEl.textContent = prompt;

    const et = clock.elapsedTime;
    if (reduceMotionOn) {
      for (const fl of flickerLights) {
        fl.light.intensity = fl.base;
      }
    } else {
      for (const fl of flickerLights) {
        const wobble =
          Math.sin(et * fl.f * 6.283) * fl.mul + Math.sin(et * fl.f * 11.7) * (fl.mul * 0.35);
        fl.light.intensity = Math.max(0.05, fl.base + wobble);
      }
    }

    if (lobbyAnim?.twinRailMats?.length && !reduceMotionOn) {
      const pulse = 1 + Math.sin(et * 1.65) * 0.055;
      for (const rm of lobbyAnim.twinRailMats) {
        rm.emissiveIntensity = 1.15 * pulse;
      }
    } else if (lobbyAnim?.twinRailMats?.length) {
      for (const rm of lobbyAnim.twinRailMats) {
        rm.emissiveIntensity = 1.15;
      }
    }

    if (lobbyAnim?.sparkleGroup && !reduceMotionOn) {
      for (const ch of lobbyAnim.sparkleGroup.children) {
        const base = ch.userData.baseY ?? ch.position.y;
        const ph = ch.userData.phase ?? 0;
        ch.position.y = base + Math.sin(et * 2.05 + ph) * 0.11;
        ch.rotation.y += dt * 0.65;
        ch.rotation.x = Math.sin(et * 1.3 + ph) * 0.25;
      }
    }

    if (lobbyAnim?.exitSignMat) {
      const ex = lobbyAnim.exitSignMat;
      if (reduceMotionOn) {
        ex.emissiveIntensity = 0.55;
      } else {
        ex.emissiveIntensity = 0.48 + Math.sin(et * 3.1) * 0.14;
      }
    }

    if (lobbyAnim?.marqueeBulbMats?.length) {
      const bulbs = lobbyAnim.marqueeBulbMats;
      const n = bulbs.length;
      if (reduceMotionOn) {
        for (let i = 0; i < n; i++) {
          bulbs[i].emissiveIntensity = 0.38;
        }
      } else {
        for (let i = 0; i < n; i++) {
          const phase = (i / Math.max(1, n - 1)) * Math.PI * 2;
          const wave = 0.5 + 0.5 * Math.sin(et * 3.4 - phase * 2.2);
          bulbs[i].emissiveIntensity = 0.1 + wave * 1.02;
        }
      }
    }

    // Floating cabinet titles — gentle bob & glow pulse.
    if (cabinets?.length) {
      for (let i = 0; i < cabinets.length; i++) {
        const cab = cabinets[i];
        const sp = cab.userData.titleSprite;
        if (!sp) continue;
        const baseY = cab.userData.titleBaseY ?? 2.4;
        if (reduceMotionOn) {
          sp.position.y = baseY;
          sp.material.opacity = 0.95;
        } else {
          sp.position.y = baseY + Math.sin(et * 1.4 + i * 0.7) * 0.06;
          sp.material.opacity = 0.86 + Math.sin(et * 2.1 + i * 1.1) * 0.1;
        }
      }
    }

    if (prizeNpcParts) {
      const bob = reduceMotionOn ? 0 : Math.sin(et * 2.15) * 0.028;
      prizeNpcParts.root.position.y = prizeNpcParts.baseY + bob;
      if (prizeNpcParts.head) {
        if (reduceMotionOn) {
          prizeNpcParts.head.rotation.y = 0;
          prizeNpcParts.head.rotation.x = 0;
        } else {
          prizeNpcParts.head.rotation.y = Math.sin(et * 0.88) * 0.11;
          prizeNpcParts.head.rotation.x = Math.sin(et * 1.05) * 0.035;
        }
      }
      if (prizeNpcParts.armL) {
        prizeNpcParts.armL.rotation.z = reduceMotionOn ? 0.08 : Math.sin(et * 2.7) * 0.14 + 0.08;
      }
      if (prizeNpcParts.armR) {
        prizeNpcParts.armR.rotation.x = reduceMotionOn ? 0 : Math.sin(et * 2.4) * 0.1;
      }
    }

    composer.render();
  }

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });

  if (window.location.protocol === "file:" && hintEl) {
    hintEl.textContent =
      "Local tip: use python3 -m http.server so games and Three.js modules load correctly.";
  }

  const ARCADE_RESUME_WALK = "arcade-resume-walk-v1";
  try {
    if (sessionStorage.getItem(ARCADE_RESUME_WALK) === "1") {
      sessionStorage.removeItem(ARCADE_RESUME_WALK);
      queueMicrotask(() => {
        if (!games.length) return;
        enterArcadePlayMode();
        setTimeout(() => {
          if (games.length && !controls.isLocked && !touchPlayMode) enterTouchPlayMode();
        }, 250);
      });
    }
  } catch (_) {
    /* ignore */
  }

  animate();
}

startArcade();
