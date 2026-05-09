import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

// --- Tunables ---
const EYE_HEIGHT = 1.62;
const PLAYER_R = 0.4;
const GRAVITY = -30;
const GROUND_ACCEL = 70;
const AIR_ACCEL = 22;
const MAX_SPEED_GROUND = 8.6;
const MAX_SPEED_AIR = 6.2;
const JUMP_SPEED = 9.6;
const FRICTION = 9;

const ARENA_HALF = 28;
const WALL_H = 5;

const MAG_SIZE = 12;
const RELOAD_TIME = 1.15;
const FIRE_COOLDOWN = 0.115;
const BULLET_DAMAGE = 28;
const HEADSHOT_BONUS = 1.85;
const TRACER_FADE = 0.22;
const RECOIL_KICK = 0.022;

const ENEMY_DRONE_HP = 50;
const ENEMY_DRONE_SPEED = 2.85;
const ENEMY_DRONE_RADIUS = 0.55;
const ENEMY_DRONE_DPS = 22;
const ENEMY_TANK_HP = 145;
const ENEMY_TANK_SPEED = 1.85;
const ENEMY_TANK_RADIUS = 0.85;
const ENEMY_TANK_DPS = 36;
const ENEMY_HEAD_FRAC = 0.62; // top fraction of bounding sphere counts as head

const TOTAL_WAVES = 5;
const PLAYER_MAX_HP = 100;

// --- DOM hooks ---
const canvas = document.getElementById("game-canvas");
const blocker = document.getElementById("blocker");
const healthFill = document.getElementById("health-fill");
const healthText = document.getElementById("health-text");
const ammoLoaded = document.getElementById("ammo-loaded");
const ammoCount = document.getElementById("ammo-count");
const waveText = document.getElementById("wave-text");
const enemiesText = document.getElementById("enemies-text");
const scoreText = document.getElementById("score-text");
const dmgFlash = document.getElementById("dmg-flash");
const centerStatus = document.getElementById("center-status");
const crosshair = document.getElementById("crosshair");

// Scratch vectors reused per frame to avoid allocation churn.
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

// --- Audio: gunshot sample, decoded once and replayed via BufferSource. ---
const SHOT_GAIN = 0.45;
const SHOT_PITCH_JITTER = 0.07;
let audioCtx = null;
let gunBuffer = null;
let gunBufferLoading = null;

function ensureAudio() {
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    return null;
  }
  if (!gunBufferLoading) {
    gunBufferLoading = fetch("./gunshot.mp3")
      .then((r) => {
        if (!r.ok) throw new Error(`gunshot fetch ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => audioCtx.decodeAudioData(buf))
      .then((decoded) => {
        gunBuffer = decoded;
      })
      .catch(() => {
        // Audio is optional — drop the load so retries are possible.
        gunBufferLoading = null;
      });
  }
  return audioCtx;
}

function playGunshot() {
  const ctx = audioCtx;
  if (!ctx || !gunBuffer) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const src = ctx.createBufferSource();
  src.buffer = gunBuffer;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * SHOT_PITCH_JITTER;
  const gain = ctx.createGain();
  gain.gain.value = SHOT_GAIN;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

function makeNeonMaterial(color, emissive = 0.45) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: emissive,
    metalness: 0.25,
    roughness: 0.45,
  });
}

function makeFloorTexture() {
  const cells = 32;
  const s = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#08040f";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "rgba(255, 92, 210, 0.55)";
  ctx.lineWidth = 1.5;
  const cs = s / cells;
  for (let i = 0; i <= cells; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * cs, 0);
    ctx.lineTo(i * cs, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cs);
    ctx.lineTo(s, i * cs);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0, 255, 238, 0.42)";
  ctx.lineWidth = 2.5;
  for (let i = 0; i <= cells; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i * cs, 0);
    ctx.lineTo(i * cs, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cs);
    ctx.lineTo(s, i * cs);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildArena(scene) {
  const colliders = []; // AABBs blocking the player + enemies
  const group = new THREE.Group();
  scene.add(group);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x12081a,
    map: makeFloorTexture(),
    roughness: 0.85,
    metalness: 0.15,
    emissive: 0x110018,
    emissiveIntensity: 0.18,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2),
    floorMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  function addBox(w, h, d, x, y, z, color, emis = 0.4) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      makeNeonMaterial(color, emis),
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  }

  const A = ARENA_HALF;
  const t = 1.4;
  // Perimeter walls (thin slabs just outside the floor)
  addBox(A * 2 + t * 2, WALL_H, t, 0, 0, -A - t / 2, 0xff1493, 0.55);
  addBox(A * 2 + t * 2, WALL_H, t, 0, 0, A + t / 2, 0x00fff2, 0.55);
  addBox(t, WALL_H, A * 2 + t * 2, -A - t / 2, 0, 0, 0xff5cd2, 0.55);
  addBox(t, WALL_H, A * 2 + t * 2, A + t / 2, 0, 0, 0x80f5ff, 0.55);

  // Cover pillars — provide flank routes & break sightlines
  addBox(2.4, 3.6, 2.4, -7, 0, -6, 0xff66cc, 0.35);
  addBox(2.4, 3.6, 2.4, 7, 0, -6, 0x00fff2, 0.35);
  addBox(2.0, 4.8, 2.0, -10, 0, 9, 0xffd54f, 0.4);
  addBox(2.0, 4.8, 2.0, 10, 0, 9, 0xffd54f, 0.4);
  addBox(3.0, 1.6, 3.0, 0, 0, 0, 0xff5cd2, 0.5);
  addBox(1.6, 5.5, 1.6, -16, 0, -16, 0x00fff2, 0.4);
  addBox(1.6, 5.5, 1.6, 16, 0, -16, 0xff1493, 0.4);
  addBox(1.6, 5.5, 1.6, -16, 0, 16, 0xff1493, 0.4);
  addBox(1.6, 5.5, 1.6, 16, 0, 16, 0x00fff2, 0.4);

  // Lighting
  scene.add(new THREE.AmbientLight(0x4a3a66, 0.3));
  scene.add(new THREE.HemisphereLight(0xff66cc, 0x080010, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 0.55);
  dir.position.set(20, 30, 12);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 80;
  dir.shadow.camera.left = -36;
  dir.shadow.camera.right = 36;
  dir.shadow.camera.top = 36;
  dir.shadow.camera.bottom = -36;
  scene.add(dir);
  const pink = new THREE.PointLight(0xff1493, 0.9, 50);
  pink.position.set(-14, 6, 8);
  scene.add(pink);
  const cyan = new THREE.PointLight(0x00fff2, 0.9, 50);
  cyan.position.set(14, 6, -8);
  scene.add(cyan);

  return colliders;
}

// Resolve player AABB vs world AABB and consume velocity into the wall.
function resolveAabbPenetration(camera, velocity, box) {
  const minP = tmpV;
  const maxP = tmpV2;
  minP.set(camera.x - PLAYER_R, camera.y - EYE_HEIGHT, camera.z - PLAYER_R);
  maxP.set(camera.x + PLAYER_R, camera.y, camera.z + PLAYER_R);
  if (maxP.x < box.min.x || minP.x > box.max.x) return;
  if (maxP.y < box.min.y || minP.y > box.max.y) return;
  if (maxP.z < box.min.z || minP.z > box.max.z) return;
  const penLeft = maxP.x - box.min.x;
  const penRight = box.max.x - minP.x;
  const penDown = maxP.y - box.min.y;
  const penUp = box.max.y - minP.y;
  const penBack = maxP.z - box.min.z;
  const penFront = box.max.z - minP.z;
  const minPen = Math.min(penLeft, penRight, penDown, penUp, penBack, penFront);
  if (minPen === penLeft) {
    camera.x -= penLeft;
    velocity.x = Math.min(0, velocity.x);
  } else if (minPen === penRight) {
    camera.x += penRight;
    velocity.x = Math.max(0, velocity.x);
  } else if (minPen === penDown) {
    camera.y -= penDown;
    velocity.y = Math.min(0, velocity.y);
  } else if (minPen === penUp) {
    camera.y += penUp;
    velocity.y = Math.max(0, velocity.y);
  } else if (minPen === penBack) {
    camera.z -= penBack;
    velocity.z = Math.min(0, velocity.z);
  } else {
    camera.z += penFront;
    velocity.z = Math.max(0, velocity.z);
  }
}

function makeEnemyMesh(isTank) {
  const radius = isTank ? ENEMY_TANK_RADIUS : ENEMY_DRONE_RADIUS;
  const headR = radius * 0.55;
  const bodyColor = isTank ? 0xff3a3a : 0xff5cd2;
  const headColor = 0x00fff2;
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, isTank ? 1 : 0),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      emissive: bodyColor,
      emissiveIntensity: 0.65,
      metalness: 0.3,
      roughness: 0.4,
    }),
  );
  body.castShadow = true;
  body.position.y = radius;
  body.userData.bodyPart = "body";
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(headR, 1),
    new THREE.MeshStandardMaterial({
      color: headColor,
      emissive: headColor,
      emissiveIntensity: 0.85,
      metalness: 0.3,
      roughness: 0.3,
    }),
  );
  head.position.y = radius * 2 + headR * 0.35;
  head.userData.bodyPart = "head";
  group.add(head);

  return { group, body, head, radius, totalHeight: head.position.y + headR };
}

class Enemy {
  constructor(scene, isTank, x, z) {
    this.isTank = isTank;
    this.hp = isTank ? ENEMY_TANK_HP : ENEMY_DRONE_HP;
    this.maxHp = this.hp;
    this.speed = isTank ? ENEMY_TANK_SPEED : ENEMY_DRONE_SPEED;
    this.dps = isTank ? ENEMY_TANK_DPS : ENEMY_DRONE_DPS;
    const built = makeEnemyMesh(isTank);
    this.group = built.group;
    this.body = built.body;
    this.head = built.head;
    this.radius = built.radius;
    this.totalHeight = built.totalHeight;
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.alive = true;
    this.flashUntil = 0;
    this.scene = scene;
    this.contactSecondsApplied = 0;
  }

  // Approximate raycast hit test: ground-plane radius check.
  // Treat upper portion of body as headshot zone.
  testHit(rayOrigin, rayDir) {
    if (!this.alive) return null;
    // Project enemy center onto ray
    const center = tmpV;
    center.set(this.group.position.x, this.group.position.y + this.radius, this.group.position.z);
    const ox = center.x - rayOrigin.x;
    const oy = center.y - rayOrigin.y;
    const oz = center.z - rayOrigin.z;
    const tCenter = ox * rayDir.x + oy * rayDir.y + oz * rayDir.z;
    if (tCenter < 0.2) return null;
    const px = rayOrigin.x + rayDir.x * tCenter;
    const py = rayOrigin.y + rayDir.y * tCenter;
    const pz = rayOrigin.z + rayDir.z * tCenter;
    const dx = center.x - px;
    const dy = center.y - py;
    const dz = center.z - pz;
    const distSq = dx * dx + dy * dy + dz * dz;
    const r = this.radius * 1.05;
    if (distSq > r * r) return null;
    // headshot zone: top 38% of body bounding sphere
    const headWorldY = this.head.getWorldPosition(tmpV2).y;
    const head = py > headWorldY - this.head.geometry.parameters.radius * 0.85;
    return { t: tCenter, head, enemy: this };
  }

  damage(amount, head, scoreCallback) {
    if (!this.alive) return;
    const dmg = head ? amount * HEADSHOT_BONUS : amount;
    this.hp -= dmg;
    this.flashUntil = performance.now() / 1000 + 0.12;
    if (this.hp <= 0) {
      this.kill();
      const base = this.isTank ? 200 : 80;
      const bonus = head ? 60 : 0;
      scoreCallback(base + bonus, head);
      return true;
    }
    return false;
  }

  kill() {
    this.alive = false;
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  update(dt, target, colliders) {
    if (!this.alive) return;
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.001) {
      const ux = dx / dist;
      const uz = dz / dist;
      const step = this.speed * dt;
      this.group.position.x += ux * step;
      this.group.position.z += uz * step;
    }

    // Resolve enemy vs world AABBs (cylinder approximation: same XZ AABB as player)
    for (const box of colliders) {
      const minX = this.group.position.x - this.radius;
      const maxX = this.group.position.x + this.radius;
      const minZ = this.group.position.z - this.radius;
      const maxZ = this.group.position.z + this.radius;
      // Skip walls that don't overlap our footprint
      if (maxX < box.min.x || minX > box.max.x) continue;
      if (maxZ < box.min.z || minZ > box.max.z) continue;
      // Vertical overlap not needed: enemies on ground
      const penLeft = maxX - box.min.x;
      const penRight = box.max.x - minX;
      const penBack = maxZ - box.min.z;
      const penFront = box.max.z - minZ;
      const minPen = Math.min(penLeft, penRight, penBack, penFront);
      if (minPen === penLeft) this.group.position.x -= penLeft;
      else if (minPen === penRight) this.group.position.x += penRight;
      else if (minPen === penBack) this.group.position.z -= penBack;
      else this.group.position.z += penFront;
    }

    // Bobbing + spin animation
    const t = performance.now() / 1000;
    this.group.rotation.y += dt * (this.isTank ? 0.6 : 1.2);
    this.body.position.y = this.radius + Math.sin(t * (this.isTank ? 2.4 : 4.2)) * 0.05;

    // Hit flash colorshift via emissiveIntensity
    const flashing = t < this.flashUntil;
    this.body.material.emissiveIntensity = flashing ? 1.6 : 0.65;
    this.head.material.emissiveIntensity = flashing ? 1.8 : 0.85;
  }
}

function showCenterStatus(message, holdMs = 1400) {
  centerStatus.textContent = message;
  centerStatus.classList.add("show");
  if (showCenterStatus._t) clearTimeout(showCenterStatus._t);
  showCenterStatus._t = setTimeout(() => centerStatus.classList.remove("show"), holdMs);
}

function flashDamage() {
  dmgFlash.style.transition = "none";
  dmgFlash.style.opacity = "1";
  // Forced reflow to restart transition
  void dmgFlash.offsetWidth;
  dmgFlash.style.transition = "opacity 0.45s ease";
  dmgFlash.style.opacity = "0";
}

function flashCrosshairHit() {
  crosshair.classList.add("hit");
  if (flashCrosshairHit._t) clearTimeout(flashCrosshairHit._t);
  flashCrosshairHit._t = setTimeout(() => crosshair.classList.remove("hit"), 110);
}

function main() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06030c);
  scene.fog = new THREE.Fog(0x06030c, 18, 65);

  const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.05, 200);
  camera.rotation.order = "YXZ";
  camera.position.set(0, EYE_HEIGHT, 18);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const colliders = buildArena(scene);

  // First-person weapon ("rig" attached to camera)
  const weaponRig = new THREE.Group();
  camera.add(weaponRig);
  scene.add(camera);
  weaponRig.position.set(0.32, -0.32, -0.55);

  const weaponBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.16, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x202028, roughness: 0.45, metalness: 0.7 }),
  );
  weaponBody.position.z = -0.12;
  weaponRig.add(weaponBody);
  const weaponBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.42, 16),
    new THREE.MeshStandardMaterial({ color: 0x10101a, roughness: 0.4, metalness: 0.85 }),
  );
  weaponBarrel.rotation.x = Math.PI / 2;
  weaponBarrel.position.set(0, 0.02, -0.45);
  weaponRig.add(weaponBarrel);
  const weaponSight = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0xff5cd2,
      emissive: 0xff5cd2,
      emissiveIntensity: 0.9,
    }),
  );
  weaponSight.position.set(0, 0.11, -0.18);
  weaponRig.add(weaponSight);

  // Muzzle flash sprite (a bright disc that briefly appears at the barrel tip)
  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0 }),
  );
  muzzleFlash.position.set(0, 0.02, -0.7);
  weaponRig.add(muzzleFlash);
  let muzzleFlashUntil = 0;

  // Tracer pool: thin lines from muzzle to hit point
  const TRACER_COUNT = 12;
  const tracers = [];
  for (let i = 0; i < TRACER_COUNT; i += 1) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(6);
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xfff4a8,
      transparent: true,
      opacity: 0,
    });
    const line = new THREE.Line(geom, mat);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    tracers.push({ line, positions, life: 0 });
  }
  let tracerIdx = 0;
  function spawnTracer(fromX, fromY, fromZ, toX, toY, toZ) {
    const t = tracers[tracerIdx];
    tracerIdx = (tracerIdx + 1) % tracers.length;
    t.positions[0] = fromX;
    t.positions[1] = fromY;
    t.positions[2] = fromZ;
    t.positions[3] = toX;
    t.positions[4] = toY;
    t.positions[5] = toZ;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.material.opacity = 0.9;
    t.life = TRACER_FADE;
    t.line.visible = true;
  }
  function updateTracers(dt) {
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const k = Math.max(0, t.life / TRACER_FADE);
      t.line.material.opacity = 0.9 * k;
      if (t.life <= 0) t.line.visible = false;
    }
  }

  // --- Game state ---
  const controls = new PointerLockControls(camera, document.body);
  const raycaster = new THREE.Raycaster();
  raycaster.far = 120;

  const enemies = [];
  const velocity = new THREE.Vector3();
  const keys = new Set();

  let grounded = false;
  let pendingJump = false;

  let hp = PLAYER_MAX_HP;
  let ammo = MAG_SIZE;
  let reloadingUntil = 0;
  let nextFireAt = 0;
  let score = 0;
  let wave = 0;
  let waveActive = false;
  let waveStartAt = 0;
  let waveSpawnQueue = [];
  let nextSpawnAt = 0;

  let gameOver = false;
  let won = false;
  let firingHeld = false;
  let recoilPitch = 0;

  function setBlockerWelcome() {
    blocker.innerHTML = `
      <h1>VECTOR STRIKE</h1>
      <p>Click to enter the arena · <kbd>W A S D</kbd> move · <kbd>Space</kbd> jump · mouse look</p>
      <p><span class="accent">LMB</span> fire · <kbd>R</kbd> reload · <kbd>Esc</kbd> release mouse</p>
      <p>Survive <strong>${TOTAL_WAVES}</strong> waves of neon attackers — keep moving and headshot the drones for bonus points.</p>
    `;
  }

  function setBlockerGameOver() {
    blocker.innerHTML = `
      <h1 class="danger">SYSTEM FAILURE</h1>
      <p>You fell on wave <strong>${wave}</strong> · final score <strong>${score}</strong>.</p>
      <p>Click to redeploy and try again.</p>
    `;
  }

  function setBlockerVictory() {
    blocker.innerHTML = `
      <h1 class="accent">GRID SECURED</h1>
      <p>All ${TOTAL_WAVES} waves cleared · score <strong>${score}</strong> · ${Math.round(hp)} HP remaining.</p>
      <p>Click to start over.</p>
    `;
  }

  function resetMatch() {
    for (const e of enemies) e.kill();
    enemies.length = 0;
    waveSpawnQueue = [];
    waveActive = false;
    wave = 0;
    score = 0;
    hp = PLAYER_MAX_HP;
    ammo = MAG_SIZE;
    reloadingUntil = 0;
    nextFireAt = 0;
    velocity.set(0, 0, 0);
    camera.position.set(0, EYE_HEIGHT, 18);
    camera.rotation.set(0, 0, 0);
    gameOver = false;
    won = false;
    updateHud();
    centerStatus.classList.remove("show");
  }

  function startNextWave() {
    wave += 1;
    if (wave > TOTAL_WAVES) {
      victory();
      return;
    }
    const droneCount = 3 + wave * 2;
    const tankCount = wave >= 2 ? Math.max(1, Math.floor((wave - 1) / 1)) : 0;
    waveSpawnQueue = [];
    for (let i = 0; i < droneCount; i += 1) waveSpawnQueue.push("drone");
    for (let i = 0; i < tankCount; i += 1) waveSpawnQueue.push("tank");
    // Shuffle
    for (let i = waveSpawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [waveSpawnQueue[i], waveSpawnQueue[j]] = [waveSpawnQueue[j], waveSpawnQueue[i]];
    }
    waveActive = true;
    waveStartAt = performance.now() / 1000;
    nextSpawnAt = waveStartAt;
    showCenterStatus(`Wave ${wave} of ${TOTAL_WAVES}`);
    updateHud();
  }

  function spawnEnemy(kind) {
    // Pick a random perimeter point not in front of the camera too closely
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 6; tries += 1) {
      const ang = Math.random() * Math.PI * 2;
      const r = ARENA_HALF - 2;
      x = Math.cos(ang) * r;
      z = Math.sin(ang) * r;
      const dx = x - camera.position.x;
      const dz = z - camera.position.z;
      if (dx * dx + dz * dz > 9 * 9) break;
    }
    enemies.push(new Enemy(scene, kind === "tank", x, z));
    updateHud();
  }

  function victory() {
    won = true;
    gameOver = false;
    waveActive = false;
    if (typeof ArcadeScores !== "undefined" && typeof ArcadeScores.record === "function") {
      ArcadeScores.record("shooter", score);
      ArcadeScores.refresh?.("shooter");
    }
    setBlockerVictory();
    controls.unlock();
  }

  function lose() {
    gameOver = true;
    waveActive = false;
    if (typeof ArcadeScores !== "undefined" && typeof ArcadeScores.record === "function") {
      ArcadeScores.record("shooter", score);
      ArcadeScores.refresh?.("shooter");
    }
    setBlockerGameOver();
    controls.unlock();
  }

  function updateHud() {
    const hpPct = Math.max(0, Math.min(100, (hp / PLAYER_MAX_HP) * 100));
    healthFill.style.width = `${hpPct}%`;
    healthText.textContent = String(Math.max(0, Math.round(hp)));
    ammoLoaded.textContent = String(ammo);
    if (performance.now() / 1000 < reloadingUntil) {
      ammoCount.classList.add("reloading");
    } else {
      ammoCount.classList.remove("reloading");
    }
    waveText.textContent = String(Math.max(1, wave));
    enemiesText.textContent = String(enemies.filter((e) => e.alive).length + waveSpawnQueue.length);
    scoreText.textContent = String(score);
  }

  function reload() {
    const now = performance.now() / 1000;
    if (ammo === MAG_SIZE) return;
    if (now < reloadingUntil) return;
    reloadingUntil = now + RELOAD_TIME;
    showCenterStatus("Reloading…", RELOAD_TIME * 1000);
    updateHud();
  }

  function fire() {
    const now = performance.now() / 1000;
    if (gameOver || won) return;
    if (!controls.isLocked) return;
    if (now < nextFireAt) return;
    if (now < reloadingUntil) return;
    if (ammo <= 0) {
      reload();
      return;
    }
    ammo -= 1;
    nextFireAt = now + FIRE_COOLDOWN;
    muzzleFlashUntil = now + 0.06;
    muzzleFlash.material.opacity = 1;
    playGunshot();

    // Tiny camera kick (pitch up briefly) — tracked as a separate offset so
    // it can decay without fighting the player's mouse look.
    camera.rotation.x += RECOIL_KICK;
    recoilPitch += RECOIL_KICK;

    // Hitscan ray from camera
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;

    // 1) Enemy hits via spherical test
    let bestEnemy = null;
    let bestEnemyT = Infinity;
    let bestHead = false;
    for (const e of enemies) {
      const hit = e.testHit(origin, dir);
      if (hit && hit.t < bestEnemyT) {
        bestEnemyT = hit.t;
        bestEnemy = hit.enemy;
        bestHead = hit.head;
      }
    }

    // 2) Wall hit via collider AABBs
    let wallT = Infinity;
    for (const box of colliders) {
      const t = rayBoxIntersect(origin, dir, box);
      if (t > 0 && t < wallT) wallT = t;
    }

    let endX, endY, endZ;
    if (bestEnemy && bestEnemyT < wallT) {
      bestEnemy.damage(BULLET_DAMAGE, bestHead, (gain, head) => {
        score += gain;
        if (head) showCenterStatus("Headshot +60", 600);
      });
      flashCrosshairHit();
      const tt = bestEnemyT;
      endX = origin.x + dir.x * tt;
      endY = origin.y + dir.y * tt;
      endZ = origin.z + dir.z * tt;
    } else if (Number.isFinite(wallT)) {
      const tt = Math.min(wallT, raycaster.far);
      endX = origin.x + dir.x * tt;
      endY = origin.y + dir.y * tt;
      endZ = origin.z + dir.z * tt;
    } else {
      const tt = raycaster.far;
      endX = origin.x + dir.x * tt;
      endY = origin.y + dir.y * tt;
      endZ = origin.z + dir.z * tt;
    }

    // Tracer should originate near the muzzle, not the camera, so it looks fired by the gun.
    weaponRig.updateMatrixWorld();
    const muzzleWorld = muzzleFlash.getWorldPosition(tmpV3);
    spawnTracer(muzzleWorld.x, muzzleWorld.y, muzzleWorld.z, endX, endY, endZ);

    if (ammo === 0) reload();
    updateHud();
  }

  // Slab method ray-AABB intersection. Returns nearest positive t or 0.
  function rayBoxIntersect(orig, dir, box) {
    let tmin = -Infinity;
    let tmax = Infinity;
    const oa = [orig.x, orig.y, orig.z];
    const da = [dir.x, dir.y, dir.z];
    const minA = [box.min.x, box.min.y, box.min.z];
    const maxA = [box.max.x, box.max.y, box.max.z];
    for (let i = 0; i < 3; i += 1) {
      if (Math.abs(da[i]) < 1e-6) {
        if (oa[i] < minA[i] || oa[i] > maxA[i]) return 0;
      } else {
        const inv = 1 / da[i];
        let t1 = (minA[i] - oa[i]) * inv;
        let t2 = (maxA[i] - oa[i]) * inv;
        if (t1 > t2) [t1, t2] = [t2, t1];
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return 0;
      }
    }
    return tmin > 0 ? tmin : tmax > 0 ? tmax : 0;
  }

  function takeDamage(amount) {
    if (gameOver || won) return;
    hp -= amount;
    flashDamage();
    if (hp <= 0) {
      hp = 0;
      lose();
    }
    updateHud();
  }

  // --- Input ---
  document.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.code === "Space" && !e.repeat) pendingJump = true;
    if (e.code === "KeyR") reload();
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));

  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (!controls.isLocked) return;
    firingHeld = true;
    fire();
  });
  document.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;
    firingHeld = false;
  });

  blocker.addEventListener("click", () => {
    if (gameOver || won) {
      resetMatch();
      setBlockerWelcome();
    }
    controls.lock();
  });

  controls.addEventListener("lock", () => {
    // Pointer lock counts as a user gesture, so this is a safe place to spin
    // up the AudioContext and start preloading the gunshot sample.
    ensureAudio();
    document.body.classList.add("locked");
    blocker.style.display = "none";
    if (!waveActive && !gameOver && !won) {
      startNextWave();
    }
  });
  controls.addEventListener("unlock", () => {
    document.body.classList.remove("locked");
    blocker.style.display = "flex";
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  if (typeof ArcadeScores !== "undefined" && typeof ArcadeScores.refresh === "function") {
    ArcadeScores.refresh("shooter");
  }

  // --- Main loop ---
  const clock = new THREE.Clock();

  function step(dt) {
    if (firingHeld) fire();

    if (!controls.isLocked || gameOver || won) {
      // Still apply gravity / friction so player settles when paused
      velocity.x *= 1 - Math.min(1, FRICTION * dt);
      velocity.z *= 1 - Math.min(1, FRICTION * dt);
    } else {
      // Movement input in camera-yaw frame
      const yaw = camera.rotation.y;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      let mx = 0;
      let mz = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) {
        mx -= sin;
        mz -= cos;
      }
      if (keys.has("KeyS") || keys.has("ArrowDown")) {
        mx += sin;
        mz += cos;
      }
      if (keys.has("KeyA") || keys.has("ArrowLeft")) {
        mx -= cos;
        mz += sin;
      }
      if (keys.has("KeyD") || keys.has("ArrowRight")) {
        mx += cos;
        mz -= sin;
      }
      const len = Math.hypot(mx, mz);
      if (len > 1e-6) {
        mx /= len;
        mz /= len;
      }

      const accel = grounded ? GROUND_ACCEL : AIR_ACCEL;
      const maxSp = grounded ? MAX_SPEED_GROUND : MAX_SPEED_AIR;
      velocity.x += mx * accel * dt;
      velocity.z += mz * accel * dt;

      // Cap horizontal speed
      const sp = Math.hypot(velocity.x, velocity.z);
      if (sp > maxSp) {
        velocity.x *= maxSp / sp;
        velocity.z *= maxSp / sp;
      }
      // Apply ground friction when no input
      if (grounded && len < 1e-6) {
        velocity.x *= 1 - Math.min(1, FRICTION * dt);
        velocity.z *= 1 - Math.min(1, FRICTION * dt);
      }
      if (pendingJump && grounded) {
        velocity.y = JUMP_SPEED;
        grounded = false;
      }
      pendingJump = false;
    }

    velocity.y += GRAVITY * dt;
    camera.position.addScaledVector(velocity, dt);

    // Floor clamp
    if (camera.position.y < EYE_HEIGHT) {
      camera.position.y = EYE_HEIGHT;
      if (velocity.y < 0) velocity.y = 0;
      grounded = true;
    } else {
      grounded = false;
    }

    // Wall collisions
    for (const box of colliders) {
      resolveAabbPenetration(camera.position, velocity, box);
    }

    // Enemy AI
    const targetPos = tmpV.set(camera.position.x, 0, camera.position.z);
    for (const e of enemies) {
      e.update(dt, targetPos, colliders);
    }

    // Enemy contact damage (cylinder vs cylinder XZ, gated by vertical overlap)
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = camera.position.x - e.group.position.x;
      const dz = camera.position.z - e.group.position.z;
      const distSq = dx * dx + dz * dz;
      const r = e.radius + PLAYER_R;
      if (distSq < r * r) {
        // Verify vertical overlap (eyes vs body height)
        if (camera.position.y - EYE_HEIGHT < e.totalHeight + 0.2) {
          takeDamage(e.dps * dt);
        }
      }
    }

    // Wave management
    const now = performance.now() / 1000;
    if (waveActive) {
      // Stagger spawns over the first 1.6s of each wave
      while (waveSpawnQueue.length && now >= nextSpawnAt) {
        const kind = waveSpawnQueue.shift();
        spawnEnemy(kind);
        nextSpawnAt = now + 0.35;
      }
      const liveEnemies = enemies.filter((e) => e.alive).length;
      if (liveEnemies === 0 && waveSpawnQueue.length === 0) {
        waveActive = false;
        // Clear corpse refs from array
        for (let i = enemies.length - 1; i >= 0; i -= 1) {
          if (!enemies[i].alive) enemies.splice(i, 1);
        }
        if (wave >= TOTAL_WAVES) {
          victory();
        } else {
          showCenterStatus(`Wave ${wave} clear · +${score >= 0 ? 50 : 0} bonus`, 1400);
          score += 50;
          // Brief lull, then next wave
          setTimeout(() => {
            if (gameOver || won) return;
            if (!controls.isLocked) return;
            startNextWave();
          }, 1800);
        }
      }
    }

    // Reload completion: refill mag once timer elapses (no need to wait for a key)
    if (reloadingUntil > 0 && now >= reloadingUntil && ammo < MAG_SIZE) {
      ammo = MAG_SIZE;
      reloadingUntil = 0;
    }

    // Muzzle flash decay
    if (now > muzzleFlashUntil && muzzleFlash.material.opacity > 0) {
      muzzleFlash.material.opacity = 0;
    }

    // Recoil decay: subtract a bit of the recoil offset from camera pitch so
    // the view returns to where the player is actually aiming, leaving any
    // mouse-driven pitch change untouched.
    if (recoilPitch > 1e-4) {
      const ease = Math.min(recoilPitch, recoilPitch * Math.min(1, dt * 8));
      recoilPitch -= ease;
      camera.rotation.x -= ease;
    } else {
      recoilPitch = 0;
    }
    // Final clamp to avoid flipping the camera through the ceiling/floor.
    camera.rotation.x = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, camera.rotation.x));

    updateTracers(dt);

    // HUD updates that need to track time-driven state
    updateHud();
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt);
    renderer.render(scene, camera);
  }

  // First HUD draw
  setBlockerWelcome();
  updateHud();
  animate();
}

main();
