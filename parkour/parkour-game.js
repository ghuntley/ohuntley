/**
 * Neon Drift — 3rd-person parkour platformer.
 *
 * Architecture:
 *   - Single Three.js scene + WebGLRenderer drawn into #game-canvas.
 *   - Player is an AABB-driven capsule. Movement uses Quake-style
 *     accel/friction so air control feels like a platformer and ground
 *     control feels snappy. Double-jump + coyote-time + jump-buffer give
 *     the jumps a forgiving rhythm.
 *   - Collision = axis-by-axis swept AABB against a flat list of Box3
 *     colliders. Moving platforms remember their previous frame position
 *     so the player riding on top inherits their delta cleanly.
 *   - Camera is a fixed-distance orbit "spring arm" behind the player
 *     with raycast-based shortening so it doesn't clip through geometry.
 *   - Collectible shards and the finish goal are simple Object3D probes
 *     polled each frame (sphere overlap, no physics).
 *   - Leaderboards + token rewards go through the shared
 *     window.ArcadeScores / window.ArcadeTokens helpers so finish times
 *     show up next to the other arcade games.
 */

import * as THREE from "three";

const SLUG = "parkour";

// --- Tunables ---------------------------------------------------------
const PLAYER_HALF_X = 0.4;
const PLAYER_HALF_Z = 0.4;
const PLAYER_HALF_Y = 0.85; // total height = 1.7 (capsule)
const GRAVITY = -34;
const GROUND_ACCEL = 60;
const AIR_ACCEL = 22;
const FRICTION = 11;
const MAX_RUN = 8;
const MAX_SPRINT = 12;
const JUMP_VEL = 11;
const DOUBLE_JUMP_VEL = 9.5;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.12;
const RESPAWN_Y = -12;
const CAM_DIST = 5.4;
const CAM_HEIGHT = 1.4;
const CAM_LOOK_Y = 0.5;
const CAM_PITCH_MIN = -0.45;
const CAM_PITCH_MAX = 1.25;
const MOUSE_SENS = 0.0028;
const SHARD_RADIUS = 0.95;
const GOAL_RADIUS = 1.6;

// --- DOM handles ------------------------------------------------------
const canvas = document.getElementById("game-canvas");
const blocker = document.getElementById("blocker");
const hudTimerEl = document.getElementById("hud-timer");
const hudShardsEl = document.getElementById("hud-shards");
const hudCpEl = document.getElementById("hud-cp");
const hudLevelEl = document.getElementById("hud-level");
const toastEl = document.getElementById("toast");
const finishEl = document.getElementById("finish");
const finishTimeEl = document.getElementById("finish-time");
const finishStatsEl = document.getElementById("finish-stats");
const finishLbEl = document.getElementById("finish-lb");
const finishRetryBtn = document.getElementById("finish-retry");
const finishNextBtn = document.getElementById("finish-next");
const bestLineEl = document.getElementById("best-line");
const levelGridEl = document.getElementById("level-grid");

// --- Three.js setup ---------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x180630);
scene.fog = new THREE.Fog(0x2a0c40, 32, 130);

const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 400);
camera.position.set(0, 6, -10);

// Skydome — large back-side sphere with a gradient. Uniforms are mutated
// per level via applyTheme() so each course gets its own sky.
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: new THREE.Color(0x100330) },
    uMid: { value: new THREE.Color(0x4a0a5a) },
    uHorizon: { value: new THREE.Color(0xff2da3) },
    uGround: { value: new THREE.Color(0x07020e) },
  },
  vertexShader: `
    varying vec3 vWorld;
    void main() {
      vWorld = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uTop, uMid, uHorizon, uGround;
    varying vec3 vWorld;
    void main() {
      float h = normalize(vWorld).y;
      vec3 col;
      if (h >= 0.0) {
        float t = pow(h, 0.55);
        vec3 lo = mix(uHorizon, uMid, smoothstep(0.0, 0.45, t));
        col = mix(lo, uTop, smoothstep(0.45, 1.0, t));
      } else {
        col = mix(uHorizon, uGround, smoothstep(0.0, 0.6, -h));
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), skyMat));

const hemi = new THREE.HemisphereLight(0xff8ad6, 0x110522, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(40, 70, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.0008;
scene.add(sun);

// Distant neon "city" silhouette band so the void below has a horizon.
const horizonRingMat = new THREE.MeshBasicMaterial({
  color: 0xff2da3,
  side: THREE.BackSide,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
});
const horizonRing = new THREE.Mesh(
  new THREE.CylinderGeometry(140, 140, 8, 64, 1, true),
  horizonRingMat,
);
horizonRing.position.y = -2;
scene.add(horizonRing);

// --- Player mesh ------------------------------------------------------
const playerPos = new THREE.Vector3(0, PLAYER_HALF_Y + 0.55, -2);
const velocity = new THREE.Vector3();

const playerGroup = new THREE.Group();
{
  const radius = 0.38;
  const length = (PLAYER_HALF_Y * 2) - radius * 2;
  const bodyGeo = new THREE.CapsuleGeometry(radius, length, 6, 14);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x10c4ff,
    emissive: 0x041a26,
    emissiveIntensity: 0.6,
    metalness: 0.25,
    roughness: 0.45,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  playerGroup.add(body);

  const headMat = new THREE.MeshStandardMaterial({
    color: 0xff66c4,
    emissive: 0x440019,
    emissiveIntensity: 0.5,
    metalness: 0.2,
    roughness: 0.4,
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 14), headMat);
  head.position.y = PLAYER_HALF_Y - 0.15;
  head.castShadow = true;
  playerGroup.add(head);

  const visorMat = new THREE.MeshBasicMaterial({ color: 0x00fff2 });
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.04), visorMat);
  visor.position.set(0, PLAYER_HALF_Y - 0.05, 0.27);
  playerGroup.add(visor);

  // Soft underglow (point light) so the player picks up shadows on platforms.
  const glow = new THREE.PointLight(0xff66c4, 0.7, 6, 1.6);
  glow.position.y = -0.4;
  playerGroup.add(glow);
}
scene.add(playerGroup);
let facingYaw = 0;

// --- Course state (rebuilt per level) --------------------------------
let courseGroup = new THREE.Group();
scene.add(courseGroup);

const colliders = []; // { box: THREE.Box3, mesh, mover?: Mover }
const movers = [];
const checkpoints = [];
const shards = [];
let goal = null;

const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();

function addPlatform({ x, y, z, sx, sy, sz, color = 0x2a0c40, neon = 0x00fff2, mover = null }) {
  const fillMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.18,
    metalness: 0.3,
    roughness: 0.55,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), fillMat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  courseGroup.add(mesh);

  // Neon edge wireframe.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: neon, transparent: true, opacity: 0.9 }),
  );
  mesh.add(edges);

  const collider = { box: new THREE.Box3().setFromObject(mesh), mesh, mover: null };
  colliders.push(collider);

  if (mover) {
    const m = {
      mesh,
      box: collider.box,
      collider,
      base: new THREE.Vector3(x, y, z),
      prevPos: new THREE.Vector3(x, y, z),
      mode: mover.mode, // "linearX" | "linearY" | "linearZ"
      amp: mover.amp,
      speed: mover.speed,
      phase: mover.phase || 0,
    };
    collider.mover = m;
    movers.push(m);
  }
  return collider;
}

function addCheckpoint({ x, y, z, idx, color = 0x00fff2 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const beamMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 6, 24, 1, true), beamMat);
  beam.position.y = 3;
  group.add(beam);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 1.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x0a0a18, emissive: 0x002a2e, emissiveIntensity: 0.6 }),
  );
  post.position.y = 0.7;
  group.add(post);

  courseGroup.add(group);
  checkpoints.push({ pos: group.position.clone(), idx, group, beam, hit: idx === 0 });
}

function addShard({ x, y, z, color = 0xffe066, emissive = 0xffaa00 }) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 1.4,
    metalness: 0.6,
    roughness: 0.2,
  });
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  courseGroup.add(mesh);
  shards.push({ pos: mesh.position.clone(), mesh, taken: false });
}

function addGoal({ x, y, z }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const podiumMat = new THREE.MeshStandardMaterial({
    color: 0x352000,
    emissive: 0xffb300,
    emissiveIntensity: 0.65,
    metalness: 0.6,
    roughness: 0.35,
  });
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.5, 24), podiumMat);
  podium.position.y = 0.25;
  podium.castShadow = true;
  podium.receiveShadow = true;
  group.add(podium);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 18, 24, 1, true), beamMat);
  beam.position.y = 9;
  group.add(beam);

  const ringGeo = new THREE.TorusGeometry(0.95, 0.06, 12, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff3a0 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.8;
  group.add(ring);

  courseGroup.add(group);
  goal = { pos: group.position.clone().add(new THREE.Vector3(0, 1, 0)), group, beam, ring };
}

// --- Level system -----------------------------------------------------
const PROGRESS_KEY = "parkour-progress-v1";

function readProgress() {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { unlocked: 0 };
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return { unlocked: 0 };
    const u = Math.max(0, Math.min(LEVELS.length - 1, parseInt(o.unlocked, 10) || 0));
    return { unlocked: u };
  } catch {
    return { unlocked: 0 };
  }
}

function writeProgress(p) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* localStorage unavailable */
  }
}

function unlockUpTo(idx) {
  const p = readProgress();
  if (idx > p.unlocked) {
    p.unlocked = Math.min(LEVELS.length - 1, idx);
    writeProgress(p);
  }
}

function levelSlug(idx) {
  return SLUG + "-L" + (idx + 1);
}

function bestTimeFor(idx) {
  if (!window.ArcadeScores) return null;
  const list = window.ArcadeScores.list(levelSlug(idx), true);
  return list[0]?.score ?? null;
}

function disposeNode(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

function clearLevel() {
  scene.remove(courseGroup);
  disposeNode(courseGroup);
  courseGroup = new THREE.Group();
  scene.add(courseGroup);
  colliders.length = 0;
  movers.length = 0;
  checkpoints.length = 0;
  shards.length = 0;
  goal = null;
  standingOn = null;
}

function applyTheme(theme) {
  scene.background.setHex(theme.bg);
  scene.fog.color.setHex(theme.fog.color);
  scene.fog.near = theme.fog.near;
  scene.fog.far = theme.fog.far;
  skyMat.uniforms.uTop.value.setHex(theme.sky.top);
  skyMat.uniforms.uMid.value.setHex(theme.sky.mid);
  skyMat.uniforms.uHorizon.value.setHex(theme.sky.horizon);
  skyMat.uniforms.uGround.value.setHex(theme.sky.ground);
  hemi.color.setHex(theme.hemi.sky);
  hemi.groundColor.setHex(theme.hemi.ground);
  sun.color.setHex(theme.sun.color);
  sun.intensity = theme.sun.intensity;
  horizonRingMat.color.setHex(theme.horizon);
  horizonRingMat.opacity = theme.horizonAlpha;
}

function loadLevel(idx) {
  const lvl = LEVELS[idx];
  if (!lvl) return;
  state.levelIdx = idx;
  clearLevel();
  applyTheme(lvl.theme);
  lvl.build({ addPlatform, addCheckpoint, addShard, addGoal });
  buildCamRayList();
  hudLevelEl.textContent = `L${idx + 1} · ${lvl.name.toUpperCase()}`;
  finishEl.classList.remove("show");
  refreshBestLine();
  renderLevelGrid();
  // Reset run state and place player at start.
  runActive = false;
  runFinished = false;
  runTime = 0;
  shardsCount = 0;
  cpIdx = 0;
  for (const cp of checkpoints) cp.hit = cp.idx === 0;
  respawnAt(0);
  updateHud();
  hudTimerEl.textContent = "00.00";
  // Snap camera so it doesn't lerp from the previous level.
  camera.position.set(
    playerPos.x + Math.sin(camYaw) * Math.cos(camPitch) * CAM_DIST,
    playerPos.y + CAM_LOOK_Y + Math.sin(camPitch) * CAM_DIST,
    playerPos.z + Math.cos(camYaw) * Math.cos(camPitch) * CAM_DIST,
  );
}

// --- Level catalog ---------------------------------------------------
//
// Each level defines a theme (sky/fog/lights) plus a build() that calls
// addPlatform / addCheckpoint / addShard / addGoal. Keep checkpoint
// `idx` values contiguous starting at 0; the first one is the spawn.
const LEVELS = [
  {
    id: "rooftop",
    name: "Rooftop Run",
    sub: "Learn the rhythm",
    theme: {
      bg: 0x180630,
      fog: { color: 0x2a0c40, near: 32, far: 130 },
      sky: { top: 0x100330, mid: 0x4a0a5a, horizon: 0xff2da3, ground: 0x07020e },
      hemi: { sky: 0xff8ad6, ground: 0x110522 },
      sun: { color: 0xffffff, intensity: 0.85 },
      horizon: 0xff2da3,
      horizonAlpha: 0.35,
    },
    build({ addPlatform, addCheckpoint, addShard, addGoal }) {
      addPlatform({ x: 0, y: -0.5, z: 0, sx: 10, sy: 1, sz: 10, color: 0x1c0a2a, neon: 0x00fff2 });
      addCheckpoint({ x: 0, y: 0, z: 3, idx: 0 });

      addPlatform({ x: 0, y: 0, z: 9, sx: 2.6, sy: 0.5, sz: 2.6, neon: 0xff66c4 });
      addPlatform({ x: -2.5, y: 0.6, z: 13, sx: 2.6, sy: 0.5, sz: 2.6, neon: 0xff66c4 });
      addPlatform({ x: 2.5, y: 1.2, z: 17, sx: 2.6, sy: 0.5, sz: 2.6, neon: 0xff66c4 });
      addShard({ x: 2.5, y: 2.5, z: 17 });

      addPlatform({ x: 0, y: 1.4, z: 22, sx: 6, sy: 0.5, sz: 4, neon: 0x00fff2 });
      addCheckpoint({ x: 0, y: 1.65, z: 22, idx: 1 });

      addPlatform({
        x: 0, y: 1.4, z: 28, sx: 3, sy: 0.4, sz: 3,
        color: 0x251040, neon: 0xffe066,
        mover: { mode: "linearX", amp: 4.5, speed: 1.4 },
      });
      addShard({ x: 0, y: 3, z: 28 });

      addPlatform({ x: 0, y: 1.4, z: 35, sx: 5, sy: 0.5, sz: 4, neon: 0xff66c4 });

      addPlatform({
        x: 0, y: 1.4, z: 41, sx: 3, sy: 0.4, sz: 3,
        color: 0x251040, neon: 0xffe066,
        mover: { mode: "linearY", amp: 2.6, speed: 0.9 },
      });

      addPlatform({ x: 0, y: 4.6, z: 47, sx: 6, sy: 0.5, sz: 5, neon: 0x00fff2 });
      addCheckpoint({ x: 0, y: 4.85, z: 47, idx: 2 });
      addShard({ x: 0, y: 6.2, z: 47 });

      addPlatform({ x: 3, y: 4.6, z: 53, sx: 2.4, sy: 0.4, sz: 2.4, neon: 0xff66c4 });
      addPlatform({ x: -3, y: 4.6, z: 58, sx: 2.4, sy: 0.4, sz: 2.4, neon: 0xff66c4 });
      addPlatform({ x: 3.2, y: 4.6, z: 63, sx: 2.4, sy: 0.4, sz: 2.4, neon: 0xff66c4 });
      addPlatform({ x: -3.4, y: 4.6, z: 68, sx: 2.4, sy: 0.4, sz: 2.4, neon: 0xff66c4 });
      addShard({ x: -3.4, y: 6, z: 68 });

      addPlatform({
        x: 0, y: 4.6, z: 74.5, sx: 3, sy: 0.4, sz: 3,
        color: 0x251040, neon: 0xffe066,
        mover: { mode: "linearZ", amp: 2.6, speed: 1.0 },
      });

      addPlatform({ x: 0, y: 5.2, z: 81, sx: 4, sy: 0.4, sz: 3, neon: 0xff66c4 });
      addPlatform({ x: 0, y: 5.9, z: 86, sx: 4, sy: 0.4, sz: 3, neon: 0xff66c4 });
      addShard({ x: 0, y: 7.2, z: 86 });

      addPlatform({ x: 0, y: 6.6, z: 93, sx: 9, sy: 0.5, sz: 9, color: 0x3a1f08, neon: 0xffd166 });
      addGoal({ x: 0, y: 6.85, z: 95.5 });
    },
  },

  {
    id: "skylanes",
    name: "Sky Lanes",
    sub: "Sprint and shuttle",
    theme: {
      bg: 0x1a1230,
      fog: { color: 0x4a2070, near: 38, far: 150 },
      sky: { top: 0x12081e, mid: 0xff5a3a, horizon: 0xffd166, ground: 0x080514 },
      hemi: { sky: 0xffb27a, ground: 0x14082a },
      sun: { color: 0xffe7c4, intensity: 0.95 },
      horizon: 0xffa040,
      horizonAlpha: 0.45,
    },
    build({ addPlatform, addCheckpoint, addShard, addGoal }) {
      // Long start strip — sprint priming
      addPlatform({ x: 0, y: -0.5, z: 0, sx: 6, sy: 1, sz: 14, color: 0x1c1430, neon: 0x00d8ff });
      addCheckpoint({ x: 0, y: 0, z: 5, idx: 0, color: 0x00d8ff });
      addShard({ x: 0, y: 1.4, z: 4, color: 0xffd166, emissive: 0xff8800 });

      // Two parallel narrow lanes. Pick a side.
      addPlatform({ x: -2.6, y: 0, z: 14, sx: 1.6, sy: 0.4, sz: 6, neon: 0xff8a3a });
      addPlatform({ x: 2.6, y: 0, z: 14, sx: 1.6, sy: 0.4, sz: 6, neon: 0xff8a3a });

      // Crossover X-shuttle (sweeps across both lanes)
      addPlatform({
        x: 0, y: 0.2, z: 22, sx: 2.4, sy: 0.4, sz: 2.4,
        color: 0x2a1240, neon: 0xffd166,
        mover: { mode: "linearX", amp: 5.0, speed: 1.6 },
      });
      addShard({ x: 0, y: 1.6, z: 22, color: 0xff66c4, emissive: 0xff1493 });

      // Catch + checkpoint
      addPlatform({ x: 0, y: 0.2, z: 28, sx: 6, sy: 0.5, sz: 3.5, neon: 0x00d8ff });
      addCheckpoint({ x: 0, y: 0.45, z: 28, idx: 1, color: 0x00d8ff });

      // Two staggered floating pads (long jumps; sprint required)
      addPlatform({ x: -3.5, y: 0.5, z: 35, sx: 2.4, sy: 0.4, sz: 2.4, neon: 0xff8a3a });
      addPlatform({ x: 3.5, y: 1.0, z: 41, sx: 2.4, sy: 0.4, sz: 2.4, neon: 0xff8a3a });
      addShard({ x: 3.5, y: 2.4, z: 41 });

      // Z-shuttle that bridges a long forward gap
      addPlatform({
        x: 0, y: 1.5, z: 48, sx: 2.6, sy: 0.4, sz: 2.6,
        color: 0x2a1240, neon: 0xffd166,
        mover: { mode: "linearZ", amp: 3.0, speed: 1.2, phase: 1.0 },
      });

      // Mid platform + checkpoint
      addPlatform({ x: 0, y: 1.6, z: 55, sx: 5, sy: 0.5, sz: 4, neon: 0x00d8ff });
      addCheckpoint({ x: 0, y: 1.85, z: 55, idx: 2, color: 0x00d8ff });

      // Vertical lift up to higher tier
      addPlatform({
        x: 0, y: 1.6, z: 61, sx: 2.6, sy: 0.4, sz: 2.6,
        color: 0x2a1240, neon: 0xffd166,
        mover: { mode: "linearY", amp: 3.6, speed: 1.0 },
      });

      addPlatform({ x: 0, y: 5.6, z: 67, sx: 5, sy: 0.5, sz: 4, neon: 0xff8a3a });
      addShard({ x: 0, y: 7, z: 67, color: 0xff66c4, emissive: 0xff1493 });

      // Counter-phase shuttles (timing puzzle)
      addPlatform({
        x: -2.5, y: 5.6, z: 74, sx: 2, sy: 0.4, sz: 2,
        color: 0x2a1240, neon: 0xffd166,
        mover: { mode: "linearX", amp: 2.5, speed: 1.8 },
      });
      addPlatform({
        x: 2.5, y: 5.6, z: 80, sx: 2, sy: 0.4, sz: 2,
        color: 0x2a1240, neon: 0xffd166,
        mover: { mode: "linearX", amp: 2.5, speed: 1.8, phase: Math.PI },
      });

      // Final dash + checkpoint
      addPlatform({ x: 0, y: 5.6, z: 87, sx: 5, sy: 0.5, sz: 4, neon: 0x00d8ff });
      addCheckpoint({ x: 0, y: 5.85, z: 87, idx: 3, color: 0x00d8ff });
      addShard({ x: 0, y: 7, z: 87 });

      // Goal
      addPlatform({ x: 0, y: 5.6, z: 96, sx: 9, sy: 0.5, sz: 9, color: 0x3a1f08, neon: 0xffd166 });
      addGoal({ x: 0, y: 5.85, z: 98.5 });
    },
  },

  {
    id: "tower",
    name: "Tower Climb",
    sub: "Spiral up · double-jump matters",
    theme: {
      bg: 0x040a14,
      fog: { color: 0x06281e, near: 28, far: 140 },
      sky: { top: 0x021022, mid: 0x05402a, horizon: 0x00ffaa, ground: 0x010608 },
      hemi: { sky: 0x4afaa8, ground: 0x021616 },
      sun: { color: 0xc8ffe0, intensity: 0.9 },
      horizon: 0x00ffaa,
      horizonAlpha: 0.4,
    },
    build({ addPlatform, addCheckpoint, addShard, addGoal }) {
      // Big base pad
      addPlatform({ x: 0, y: -0.5, z: 0, sx: 10, sy: 1, sz: 10, color: 0x07221a, neon: 0x00ffaa });
      addCheckpoint({ x: 0, y: 0, z: 0, idx: 0, color: 0x00ffaa });
      addShard({ x: 0, y: 1.6, z: 0, color: 0xc4ff66, emissive: 0x88cc00 });

      // Spiral pads (each 60° around a 5m radius, climbing)
      const spiral = (i) => {
        const angle = (i * Math.PI) / 3;
        const radius = 5.5;
        return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius, y: 0.6 + i * 0.95 };
      };
      for (let i = 0; i < 6; i++) {
        const p = spiral(i);
        addPlatform({
          x: p.x, y: p.y, z: p.z,
          sx: 2.4, sy: 0.4, sz: 2.4,
          color: 0x0a2a26,
          neon: i % 2 === 0 ? 0x00ffaa : 0x66ffd0,
        });
      }
      addShard({ x: spiral(2).x, y: spiral(2).y + 1.4, z: spiral(2).z });

      // Mid landing + checkpoint at top of spiral
      const top1 = spiral(5);
      addPlatform({ x: 0, y: top1.y + 1.2, z: 0, sx: 6, sy: 0.5, sz: 6, neon: 0xc4ff66 });
      addCheckpoint({ x: 0, y: top1.y + 1.45, z: 0, idx: 1, color: 0xc4ff66 });

      // Vertical lift
      const liftBaseY = top1.y + 1.2;
      addPlatform({
        x: 0, y: liftBaseY + 0.3, z: -5, sx: 2.6, sy: 0.4, sz: 2.6,
        color: 0x0a2a26, neon: 0xffd166,
        mover: { mode: "linearY", amp: 4.0, speed: 0.8 },
      });

      // Upper spiral, tighter
      const upper = (i) => {
        const angle = Math.PI + (i * Math.PI) / 3; // start opposite
        const radius = 5.0;
        return {
          x: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
          y: liftBaseY + 4.5 + i * 1.05,
        };
      };
      for (let i = 0; i < 6; i++) {
        const p = upper(i);
        addPlatform({
          x: p.x, y: p.y, z: p.z,
          sx: 2.0, sy: 0.4, sz: 2.0,
          color: 0x0a2a26,
          neon: i % 2 === 0 ? 0x4afaa8 : 0xffd166,
        });
      }
      addShard({ x: upper(1).x, y: upper(1).y + 1.4, z: upper(1).z });
      addShard({ x: upper(4).x, y: upper(4).y + 1.4, z: upper(4).z });

      // Mid-air lift + checkpoint platform
      const top2 = upper(5);
      addPlatform({ x: 0, y: top2.y + 1.2, z: 0, sx: 5, sy: 0.5, sz: 5, neon: 0xc4ff66 });
      addCheckpoint({ x: 0, y: top2.y + 1.45, z: 0, idx: 2, color: 0xc4ff66 });
      addShard({ x: 0, y: top2.y + 2.6, z: 0 });

      // Jump-puzzle finale: a vertical lift, two floating pads requiring double jump,
      // then the goal.
      addPlatform({
        x: 0, y: top2.y + 1.4, z: 5.5, sx: 2.4, sy: 0.4, sz: 2.4,
        color: 0x0a2a26, neon: 0xffd166,
        mover: { mode: "linearY", amp: 3.4, speed: 0.9, phase: 0.3 },
      });
      addPlatform({ x: 3.5, y: top2.y + 5.4, z: 8.5, sx: 2.2, sy: 0.4, sz: 2.2, neon: 0x4afaa8 });
      addPlatform({ x: -3.5, y: top2.y + 6.4, z: 11, sx: 2.2, sy: 0.4, sz: 2.2, neon: 0x4afaa8 });
      addShard({ x: -3.5, y: top2.y + 7.8, z: 11 });
      addCheckpoint({ x: -3.5, y: top2.y + 6.65, z: 11, idx: 3, color: 0xc4ff66 });

      // Goal pad floating in the green sky
      addPlatform({
        x: 0, y: top2.y + 7.4, z: 16,
        sx: 8, sy: 0.5, sz: 8,
        color: 0x3a2f08, neon: 0xffd166,
      });
      addGoal({ x: 0, y: top2.y + 7.65, z: 18 });
    },
  },
];

// --- Input ------------------------------------------------------------
const keys = Object.create(null);
let camYaw = Math.PI; // start facing +Z (down the course)
let camPitch = 0.55;
let pointerLocked = false;

canvas.addEventListener("click", () => {
  if (!pointerLocked) canvas.requestPointerLock?.();
});
blocker.addEventListener("click", () => {
  canvas.requestPointerLock?.();
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  document.body.classList.toggle("locked", pointerLocked);
  if (pointerLocked) {
    blocker.style.display = "none";
    finishEl.classList.remove("show");
    if (!runActive) startRun();
  } else {
    blocker.style.display = "flex";
  }
});

window.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  camYaw -= e.movementX * MOUSE_SENS;
  camPitch += e.movementY * MOUSE_SENS;
  camPitch = Math.max(CAM_PITCH_MIN, Math.min(CAM_PITCH_MAX, camPitch));
});

let jumpBuffer = 0;
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === "Space") {
    jumpBuffer = JUMP_BUFFER;
    e.preventDefault();
  }
  if (e.code === "KeyR") respawn();
  if (e.code === "Escape") {
    document.exitPointerLock?.();
  }
});
window.addEventListener("keyup", (e) => {
  delete keys[e.code];
});

// --- Run state --------------------------------------------------------
const state = { levelIdx: 0 };
let runTime = 0;
let runActive = false;
let runFinished = false;
let shardsCount = 0;
let cpIdx = 0;
let respawnPos = playerPos.clone();
let coyote = 0;
let canDoubleJump = false;
let grounded = false;
let standingOn = null; // mover currently supporting player

function startRun() {
  if (runActive) return;
  runActive = true;
  runFinished = false;
  runTime = 0;
  shardsCount = 0;
  cpIdx = 0;
  for (const cp of checkpoints) cp.hit = cp.idx === 0;
  for (const s of shards) {
    if (s.taken) {
      s.taken = false;
      s.mesh.visible = true;
    }
  }
  respawnAt(0);
  updateHud();
  flashToast(`L${state.levelIdx + 1} · ${LEVELS[state.levelIdx].name}`, 1400);
}

function respawn() {
  respawnAt(cpIdx);
}

function respawnAt(idx) {
  if (checkpoints.length === 0) return;
  const cp = checkpoints[idx] || checkpoints[0];
  playerPos.set(cp.pos.x, cp.pos.y + PLAYER_HALF_Y + 0.05, cp.pos.z);
  velocity.set(0, 0, 0);
  grounded = false;
  canDoubleJump = false;
  coyote = 0;
  standingOn = null;
  respawnPos.copy(playerPos);
  if (runActive) flashToast(idx === 0 ? "Go!" : "Respawn");
}

function updateHud() {
  hudShardsEl.textContent = `${shardsCount} / ${shards.length}`;
  hudCpEl.textContent = String(cpIdx + 1);
}

let toastTimer = 0;
function flashToast(text, ms = 1200) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  toastTimer = ms / 1000;
}

// --- Physics helpers -------------------------------------------------
function aabbOverlap(min, max, box) {
  return !(max.x < box.min.x || min.x > box.max.x ||
           max.y < box.min.y || min.y > box.max.y ||
           max.z < box.min.z || min.z > box.max.z);
}

function moveAxis(axis, dt, half) {
  const delta = velocity[axis] * dt;
  if (delta === 0) return;
  playerPos[axis] += delta;

  const min = tmpVec.set(playerPos.x - half.x, playerPos.y - half.y, playerPos.z - half.z);
  const max = tmpVec2.set(playerPos.x + half.x, playerPos.y + half.y, playerPos.z + half.z);

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!aabbOverlap(min, max, c.box)) continue;

    if (delta > 0) {
      playerPos[axis] = c.box.min[axis] - half[axis] - 1e-4;
      velocity[axis] = 0;
    } else {
      playerPos[axis] = c.box.max[axis] + half[axis] + 1e-4;
      velocity[axis] = 0;
      if (axis === "y") {
        grounded = true;
        canDoubleJump = true;
        coyote = COYOTE_TIME;
        standingOn = c.mover || null;
      }
    }
    // Re-derive bounds for the next collider after we shifted.
    min[axis] = playerPos[axis] - half[axis];
    max[axis] = playerPos[axis] + half[axis];
  }
}

const HALF = new THREE.Vector3(PLAYER_HALF_X, PLAYER_HALF_Y, PLAYER_HALF_Z);

function physics(dt) {
  // Horizontal input (camera-relative)
  const fwd = tmpVec.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  const right = tmpVec2.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
  let inFwd = 0, inRight = 0;
  if (keys["KeyW"] || keys["ArrowUp"]) inFwd += 1;
  if (keys["KeyS"] || keys["ArrowDown"]) inFwd -= 1;
  if (keys["KeyA"] || keys["ArrowLeft"]) inRight -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) inRight += 1;
  const inMag = Math.hypot(inFwd, inRight);
  let wishX = 0, wishZ = 0;
  if (inMag > 0) {
    inFwd /= inMag; inRight /= inMag;
    wishX = fwd.x * inFwd + right.x * inRight;
    wishZ = fwd.z * inFwd + right.z * inRight;
  }

  const sprint = !!(keys["ShiftLeft"] || keys["ShiftRight"]);
  const wishSpeed = inMag > 0 ? (sprint ? MAX_SPRINT : MAX_RUN) : 0;
  const accel = grounded ? GROUND_ACCEL : AIR_ACCEL;

  // Friction (ground only, when no input)
  if (grounded && inMag === 0) {
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed > 0) {
      const drop = speed * FRICTION * dt;
      const newSpeed = Math.max(0, speed - drop);
      const k = newSpeed / speed;
      velocity.x *= k; velocity.z *= k;
    }
  }
  // Acceleration toward wishDir (Quake-style)
  if (wishSpeed > 0) {
    const projSpeed = velocity.x * wishX + velocity.z * wishZ;
    const addSpeed = wishSpeed - projSpeed;
    if (addSpeed > 0) {
      const a = Math.min(accel * dt, addSpeed);
      velocity.x += wishX * a;
      velocity.z += wishZ * a;
    }
  }

  // Gravity
  velocity.y += GRAVITY * dt;
  if (velocity.y < -55) velocity.y = -55;

  // Jump (with buffer + coyote + double-jump)
  jumpBuffer -= dt;
  coyote -= dt;
  if (jumpBuffer > 0) {
    if (grounded || coyote > 0) {
      velocity.y = JUMP_VEL;
      jumpBuffer = 0;
      coyote = 0;
      canDoubleJump = true;
      grounded = false;
      standingOn = null;
    } else if (canDoubleJump) {
      velocity.y = DOUBLE_JUMP_VEL;
      jumpBuffer = 0;
      canDoubleJump = false;
    }
  }

  // --- Move platforms first; carry the player if standing on one. ---
  const carrying = standingOn;
  for (const m of movers) {
    m.prevPos.copy(m.mesh.position);
    const t = (performance.now() / 1000) * m.speed + m.phase;
    if (m.mode === "linearX") m.mesh.position.x = m.base.x + Math.sin(t) * m.amp;
    else if (m.mode === "linearY") m.mesh.position.y = m.base.y + (Math.sin(t) * 0.5 + 0.5) * m.amp;
    else if (m.mode === "linearZ") m.mesh.position.z = m.base.z + Math.sin(t) * m.amp;
    m.box.setFromObject(m.mesh);
  }
  if (carrying) {
    playerPos.x += carrying.mesh.position.x - carrying.prevPos.x;
    playerPos.y += carrying.mesh.position.y - carrying.prevPos.y;
    playerPos.z += carrying.mesh.position.z - carrying.prevPos.z;
  }

  // Player movement, axis-by-axis.
  grounded = false;
  standingOn = null;
  moveAxis("y", dt, HALF);
  moveAxis("x", dt, HALF);
  moveAxis("z", dt, HALF);

  // Death plane
  if (playerPos.y < RESPAWN_Y) {
    respawn();
    return;
  }

  // Checkpoint pickups
  for (const cp of checkpoints) {
    if (cp.hit) continue;
    const dx = playerPos.x - cp.pos.x;
    const dz = playerPos.z - cp.pos.z;
    const dy = playerPos.y - cp.pos.y;
    if (dx * dx + dz * dz < 1.6 * 1.6 && Math.abs(dy) < 2.5) {
      cp.hit = true;
      cpIdx = Math.max(cpIdx, cp.idx);
      flashToast(`Checkpoint ${cp.idx + 1}`);
      updateHud();
    }
  }

  // Shard pickups
  for (const s of shards) {
    if (s.taken) continue;
    const dx = playerPos.x - s.pos.x;
    const dy = playerPos.y - s.pos.y;
    const dz = playerPos.z - s.pos.z;
    if (dx * dx + dy * dy + dz * dz < SHARD_RADIUS * SHARD_RADIUS) {
      s.taken = true;
      s.mesh.visible = false;
      shardsCount++;
      flashToast(`Shard ${shardsCount}/${shards.length}`);
      updateHud();
    }
  }

  // Goal
  if (goal && !runFinished) {
    const dx = playerPos.x - goal.pos.x;
    const dz = playerPos.z - goal.pos.z;
    const dy = playerPos.y - goal.pos.y;
    if (dx * dx + dz * dz < GOAL_RADIUS * GOAL_RADIUS && Math.abs(dy) < 3) {
      finishRun();
    }
  }
}

// --- Camera (3rd person spring arm) ----------------------------------
const camRay = new THREE.Raycaster();
const camTargetPos = new THREE.Vector3();
const camRayMeshes = []; // refreshed by buildCamRayList() each loadLevel()

function buildCamRayList() {
  camRayMeshes.length = 0;
  for (const c of colliders) camRayMeshes.push(c.mesh);
}

function updateCamera(dt) {
  // Look-at point is slightly above player center.
  camTargetPos.set(playerPos.x, playerPos.y + CAM_LOOK_Y, playerPos.z);

  // Desired camera position: orbit "behind" player at (yaw, pitch).
  const cy = Math.cos(camPitch);
  const wantX = camTargetPos.x + Math.sin(camYaw) * cy * CAM_DIST;
  const wantY = camTargetPos.y + Math.sin(camPitch) * CAM_DIST + CAM_HEIGHT * 0.3;
  const wantZ = camTargetPos.z + Math.cos(camYaw) * cy * CAM_DIST;
  let want = tmpVec.set(wantX, wantY, wantZ);

  // Avoid clipping into platforms: cast ray from look-at to desired position.
  // Refresh world matrices so movers' colliders are correct for the raycast.
  scene.updateMatrixWorld(true);
  const dir = tmpVec2.copy(want).sub(camTargetPos);
  const dist = dir.length();
  dir.normalize();
  camRay.set(camTargetPos, dir);
  camRay.far = dist;
  const hits = camRay.intersectObjects(camRayMeshes, false);
  let useDist = dist;
  if (hits.length > 0 && hits[0].distance < dist) {
    useDist = Math.max(1.4, hits[0].distance - 0.3);
  }
  want = camTargetPos.clone().addScaledVector(dir, useDist);

  // Smooth follow
  const k = 1 - Math.pow(0.0025, dt);
  camera.position.lerp(want, k);
  camera.lookAt(camTargetPos);
}

// --- Resize -----------------------------------------------------------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);
onResize();

// --- Main loop --------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);

  if (pointerLocked && runActive && !runFinished) {
    runTime += dt;
    physics(dt);
  }

  // Spin shards
  for (const s of shards) {
    if (s.taken) continue;
    s.mesh.rotation.y += dt * 1.6;
    s.mesh.rotation.x += dt * 0.7;
    s.mesh.position.y = s.pos.y + Math.sin(performance.now() * 0.003 + s.pos.x) * 0.18;
  }
  // Spin goal ring
  if (goal) {
    goal.ring.rotation.z += dt * 1.2;
    goal.beam.material.opacity = 0.45 + Math.sin(performance.now() * 0.004) * 0.12;
  }

  // Visually orient player toward movement; otherwise toward camera forward.
  const speedXZ = Math.hypot(velocity.x, velocity.z);
  let targetYaw = facingYaw;
  if (speedXZ > 0.2) {
    targetYaw = Math.atan2(velocity.x, velocity.z);
  }
  // Wrap delta to shortest path
  let dyaw = targetYaw - facingYaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  facingYaw += dyaw * Math.min(1, dt * 12);
  playerGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
  playerGroup.rotation.y = facingYaw;

  updateCamera(dt);
  if (runActive && !runFinished) {
    hudTimerEl.textContent = formatTime(runTime);
  }

  // Toast fade
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) toastEl.classList.remove("show");
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function formatTime(t) {
  return t.toFixed(2).padStart(5, "0");
}

// --- Finish line ------------------------------------------------------
function finishRun() {
  if (runFinished) return;
  runFinished = true;
  runActive = false;

  const slug = levelSlug(state.levelIdx);
  const lvl = LEVELS[state.levelIdx];

  // Record to leaderboard (lower-is-better) — auto-awards a small token.
  let board = [];
  if (window.ArcadeScores) {
    board = window.ArcadeScores.record(slug, runTime, { lowerIsBetter: true });
  }

  // Bonus token award scaled by speed + shards + level (skip debounce by slug).
  let bonusTokens = 0;
  if (window.ArcadeTokens) {
    const tier = 1 + state.levelIdx * 0.35; // later levels reward more
    const synth = Math.max(
      80,
      Math.floor((700 + state.levelIdx * 200 - runTime * 9 + shardsCount * 90) * tier),
    );
    bonusTokens = window.ArcadeTokens.earnFromGameScore(slug + "-finish", synth);
  }

  // Unlock the next level on first clear.
  const wasUnlocked = readProgress().unlocked;
  unlockUpTo(state.levelIdx + 1);
  const justUnlocked = readProgress().unlocked > wasUnlocked;

  const best = board[0]?.score ?? runTime;
  const isBest = Math.abs(best - runTime) < 0.005;
  finishTimeEl.textContent = formatTime(runTime);

  const nextIdx = state.levelIdx + 1;
  const hasNext = nextIdx < LEVELS.length;
  const nextName = hasNext ? LEVELS[nextIdx].name : null;

  let unlockedLine = "";
  if (justUnlocked && hasNext) {
    unlockedLine = `<br><span style="color:#7df9ff">Unlocked: L${nextIdx + 1} ${nextName}</span>`;
  } else if (!hasNext) {
    unlockedLine = `<br><span style="color:#ffe066">All courses cleared!</span>`;
  }

  finishStatsEl.innerHTML = `
    <b>${lvl.name}</b><br>
    Shards <b>${shardsCount} / ${shards.length}</b>
    · Tokens <b>+${bonusTokens}</b>
    ${isBest ? "<br>New personal best!" : `<br>Best <b>${formatTime(best)}s</b>`}
    ${unlockedLine}
  `;
  finishLbEl.innerHTML = "";
  board.slice(0, 5).forEach((row, i) => {
    const li = document.createElement("li");
    const d = new Date(row.at);
    const when = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    li.textContent = `${i + 1}. ${formatTime(row.score)}s · ${when}`;
    finishLbEl.appendChild(li);
  });

  finishNextBtn.hidden = !hasNext;
  if (hasNext) finishNextBtn.textContent = `Next: L${nextIdx + 1} ${nextName}`;

  finishEl.classList.add("show");
  document.exitPointerLock?.();
  refreshBestLine();
  renderLevelGrid();
}

finishRetryBtn.addEventListener("click", () => {
  loadLevel(state.levelIdx);
  canvas.requestPointerLock?.();
});

finishNextBtn.addEventListener("click", () => {
  const nextIdx = state.levelIdx + 1;
  if (nextIdx >= LEVELS.length) return;
  loadLevel(nextIdx);
  canvas.requestPointerLock?.();
});

function refreshBestLine() {
  if (!window.ArcadeScores) {
    bestLineEl.textContent = "";
    return;
  }
  const list = window.ArcadeScores.list(levelSlug(state.levelIdx), true);
  if (list.length > 0) {
    bestLineEl.textContent = `BEST ${formatTime(list[0].score)}s · RUNS ${list.length}`;
  } else {
    bestLineEl.textContent = "FIRST RUN — SET A TIME";
  }
}

function renderLevelGrid() {
  const unlocked = readProgress().unlocked;
  levelGridEl.innerHTML = "";
  LEVELS.forEach((lvl, i) => {
    const isUnlocked = i <= unlocked;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level-btn" + (i === state.levelIdx ? " active" : "");
    btn.disabled = !isUnlocked;
    const best = bestTimeFor(i);
    const bestStr = isUnlocked
      ? best != null
        ? `${formatTime(best)}s`
        : "— ·"
      : "Locked";
    btn.innerHTML = `
      <div class="num">L${i + 1}</div>
      <div class="name">${lvl.name}</div>
      <div class="best">${bestStr}</div>
    `;
    btn.title = lvl.sub || "";
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // don't trigger blocker click → pointer lock
      if (!isUnlocked) return;
      loadLevel(i);
    });
    levelGridEl.appendChild(btn);
  });
}

// --- Boot -------------------------------------------------------------
loadLevel(0);
requestAnimationFrame(animate);
