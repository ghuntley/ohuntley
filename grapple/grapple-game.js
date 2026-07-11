import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const EYE_HEIGHT = 1.55;
const GRAVITY = -32;
const GROUND_ACCEL = 60;
const AIR_ACCEL = 14;
const MAX_SPEED_GROUND = 9;
const MAX_SPEED_AIR = 6.5;
const GROUND_FRICTION = 26;
const GROUND_FRICTION_STOP = 4.5;
const AIR_DRAG = 1.2;
const JUMP_SPEED = 10.5;
const PLAYER_R = 0.36;
const HOOK_MAX_LENGTH = 70;
const HOOK_PULL = 44;
const HOOK_SWING_DAMP = 0.12;
const HOOK_WINCH = 7;
const HOOK_MIN_LEN = 1.8;
const HOOK_INITIAL_KICK = 7;
const TOTAL_SHARDS = 12;
const FALL_RESPAWN_Y = -22;
const BEST_KEY = "skyhook.bestTime";

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();
const tmpV4 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function fmtTime(seconds) {
  if (!isFinite(seconds)) return "--.--";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  if (m > 0) return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  return s.toFixed(2).padStart(5, "0");
}

// ---------- procedural audio ----------
class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.swing = null;
    this.swingGain = null;
    this.ambientFilter = null;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
      this._buildAmbient();
      this._buildSwingLoop();
    } catch {
      this.ctx = null;
    }
  }
  _buildAmbient() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    filter.Q.value = 4;
    this.ambientFilter = filter;

    const o1 = ctx.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.value = 55;
    o1.detune.value = -7;
    const o2 = ctx.createOscillator();
    o2.type = "sawtooth";
    o2.frequency.value = 82.4;
    o2.detune.value = 9;
    const o3 = ctx.createOscillator();
    o3.type = "sine";
    o3.frequency.value = 27.5;

    o1.connect(filter);
    o2.connect(filter);
    o3.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    o1.start();
    o2.start();
    o3.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
  }
  _buildSwingLoop() {
    const ctx = this.ctx;
    // pink-ish noise, sustained, gain modulated by swing speed
    const dur = 1.5;
    const buf = ctx.createBuffer(1, dur * ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const w = (Math.random() * 2 - 1) * 0.6;
      last = last * 0.96 + w * 0.04;
      data[i] = last * 6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 480;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    this.swing = filter;
    this.swingGain = gain;
  }
  setSwing(intensity) {
    if (!this.ctx || !this.swingGain) return;
    const t = this.ctx.currentTime;
    const target = clamp(intensity, 0, 1) * 0.18;
    this.swingGain.gain.linearRampToValueAtTime(target, t + 0.06);
    if (this.swing) {
      this.swing.frequency.linearRampToValueAtTime(360 + intensity * 540, t + 0.08);
    }
  }
  hookFire() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.frequency.setValueAtTime(960, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.22);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.24);
  }
  hookAttach() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [880, 1320, 1760].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18 / (i + 1), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.34);
    });
    this._noiseBurst(0.05, 0.08, 1800, "highpass");
  }
  hookMiss() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.22);
  }
  shardPickup(idx) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 660 * Math.pow(2, idx / 12);
    [0, 4, 7, 12].forEach((semi, i) => {
      const f = base * Math.pow(2, semi / 12);
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const ts = t + i * 0.055;
      g.gain.setValueAtTime(0.0001, ts);
      g.gain.exponentialRampToValueAtTime(0.22, ts + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.3);
      o.connect(g);
      g.connect(this.master);
      o.start(ts);
      o.stop(ts + 0.32);
    });
  }
  jump() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.14);
  }
  land(intensity) {
    if (!this.ctx) return;
    this._noiseBurst(0.18, clamp(0.06 + intensity * 0.05, 0.06, 0.4), 240, "lowpass");
    if (intensity > 5) {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 60;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.26);
    }
  }
  step() {
    if (!this.ctx) return;
    this._noiseBurst(0.04, 0.04, 900, "highpass");
  }
  unlock() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const ts = t + i * 0.07;
      g.gain.setValueAtTime(0.0001, ts);
      g.gain.exponentialRampToValueAtTime(0.18, ts + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.4);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1800;
      o.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      o.start(ts);
      o.stop(ts + 0.42);
    });
  }
  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const ts = t + i * 0.13;
      g.gain.setValueAtTime(0.0001, ts);
      g.gain.exponentialRampToValueAtTime(0.32, ts + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.5);
      o.connect(g);
      g.connect(this.master);
      o.start(ts);
      o.stop(ts + 0.52);
    });
  }
  _noiseBurst(dur, vol, freq, type) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const samples = Math.max(1, Math.floor(dur * ctx.sampleRate));
    const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples, 2);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }
}

// ---------- collisions ----------
function playerAabb(pos, outMin, outMax) {
  outMin.set(pos.x - PLAYER_R, pos.y - EYE_HEIGHT, pos.z - PLAYER_R);
  outMax.set(pos.x + PLAYER_R, pos.y, pos.z + PLAYER_R);
}

function resolveAabbPenetration(pos, velocity, box) {
  const minP = tmpV;
  const maxP = tmpV2;
  playerAabb(pos, minP, maxP);
  if (maxP.x < box.min.x || minP.x > box.max.x) return false;
  if (maxP.y < box.min.y || minP.y > box.max.y) return false;
  if (maxP.z < box.min.z || minP.z > box.max.z) return false;

  const penLeft = maxP.x - box.min.x;
  const penRight = box.max.x - minP.x;
  const penDown = maxP.y - box.min.y;
  const penUp = box.max.y - minP.y;
  const penBack = maxP.z - box.min.z;
  const penFront = box.max.z - minP.z;

  const minPen = Math.min(penLeft, penRight, penDown, penUp, penBack, penFront);
  let landed = false;
  if (minPen === penLeft) {
    pos.x -= penLeft;
    velocity.x = Math.min(0, velocity.x);
  } else if (minPen === penRight) {
    pos.x += penRight;
    velocity.x = Math.max(0, velocity.x);
  } else if (minPen === penDown) {
    pos.y -= penDown;
    velocity.y = Math.min(0, velocity.y);
  } else if (minPen === penUp) {
    pos.y += penUp;
    if (velocity.y < -0.1) landed = true;
    velocity.y = Math.max(0, velocity.y);
  } else if (minPen === penBack) {
    pos.z -= penBack;
    velocity.z = Math.min(0, velocity.z);
  } else {
    pos.z += penFront;
    velocity.z = Math.max(0, velocity.z);
  }
  return landed;
}

// ---------- world ----------
function makeNeonMaterial(color, emissiveIntensity = 0.35) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    metalness: 0.25,
    roughness: 0.42,
  });
}

function buildLevel(scene) {
  const colliders = [];
  const grappleMeshes = [];
  const pulseMeshes = [];
  const group = new THREE.Group();
  scene.add(group);

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a1528,
    emissive: 0x220044,
    emissiveIntensity: 0.08,
    roughness: 0.85,
    metalness: 0.1,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // grid lines on the ground for sci-fi feel
  const gridHelper = new THREE.GridHelper(280, 140, 0x004055, 0x110a22);
  gridHelper.position.y = 0.01;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.5;
  group.add(gridHelper);

  function addBox(w, h, d, x, y, z, color, grapple) {
    const mat = makeNeonMaterial(color, grapple ? 0.55 : 0.15);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.grapple = !!grapple;
    if (grapple) {
      mesh.userData.basePulse = 0.55;
      mesh.userData.pulsePhase = Math.random() * Math.PI * 2;
      pulseMeshes.push(mesh);
      grappleMeshes.push(mesh);
    }
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  }

  // ===== INNER HUB (original layout, lightly tweaked) =====
  addBox(16, 2, 16, 0, 0, -18, 0x00fff2, false);
  addBox(3, 10, 24, -14, 0, 0, 0x00c8ff, true);
  addBox(3, 10, 24, 14, 0, 0, 0xff1493, true);
  addBox(24, 3, 3, 0, 0, -12, 0x7df9ff, true);
  addBox(4, 14, 4, -6, 0, 8, 0x00fff2, true);
  addBox(4, 10, 4, 6, 0, 10, 0xff66cc, true);
  addBox(8, 1.2, 8, 0, 12, 18, 0xffcc00, true);

  // ===== MID RING - outer pillars and bridges (radius ~28) =====
  // Tall corner spires
  addBox(3.5, 22, 3.5, -28, 0, -22, 0xff1493, true);
  addBox(3.5, 22, 3.5,  28, 0, -22, 0x00fff2, true);
  addBox(3.5, 26, 3.5, -28, 0,  22, 0x00c8ff, true);
  addBox(3.5, 26, 3.5,  28, 0,  22, 0xff66cc, true);
  // Cardinal mid-pillars
  addBox(3, 16, 3,  0, 0, -34, 0x7df9ff, true);
  addBox(3, 18, 3,  34, 0,  0, 0xffcc00, true);
  addBox(3, 18, 3, -34, 0,  0, 0xffcc00, true);
  // Sky bridges connecting outer spires
  addBox(20, 1.2, 3, -19, 18, -22, 0x00fff2, true);
  addBox(20, 1.2, 3,  19, 18, -22, 0xff66cc, true);
  addBox(3, 1.2, 22,  28, 22,   0, 0x7df9ff, true);
  addBox(3, 1.2, 22, -28, 22,   0, 0x7df9ff, true);

  // ===== FLOATING NEON BEAMS (mid-air swing targets) =====
  addBox(8, 0.8, 0.8, -16, 14, -14, 0x00fff2, true);
  addBox(8, 0.8, 0.8,  16, 14, -14, 0xff1493, true);
  addBox(0.8, 0.8, 8, -22, 16,  10, 0x7df9ff, true);
  addBox(0.8, 0.8, 8,  22, 16,  10, 0x7df9ff, true);
  addBox(6, 0.8, 0.8,   0, 20, -28, 0xff66cc, true);
  addBox(0.8, 0.8, 10,  0, 24,  30, 0xffcc00, true);
  addBox(10, 0.6, 10, -22, 10,  -2, 0x00c8ff, true);
  addBox(10, 0.6, 10,  22, 10,  -2, 0x00c8ff, true);

  // ===== HIGH RING - elevated landing pads at altitude =====
  addBox(5, 0.8, 5, -18, 22, 18, 0xff66cc, true);
  addBox(5, 0.8, 5,  18, 22, 18, 0x00fff2, true);
  addBox(5, 0.8, 5, -18, 24, -8, 0xffcc00, true);
  addBox(5, 0.8, 5,  18, 24, -8, 0xffcc00, true);
  addBox(6, 0.8, 6,   0, 28,  0, 0xff1493, true);

  // ===== CENTRAL SPIRE that holds the uplink high above the city =====
  addBox(2.4, 30, 2.4, 0, 0, 36, 0x00fff2, true);
  addBox(6, 0.8, 6, 0, 16, 36, 0xff66cc, true);
  addBox(6, 0.8, 6, 0, 24, 36, 0x7df9ff, true);

  // ===== UPLINK GOAL - now perched on top of the central spire =====
  const goalMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.0, 0.4, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.35,
      metalness: 0.6,
      roughness: 0.25,
    })
  );
  goalMesh.position.set(0, 30.6, 36);
  goalMesh.userData.grapple = false;
  goalMesh.userData.isGoal = true;
  group.add(goalMesh);
  colliders.push(new THREE.Box3().setFromObject(goalMesh));

  // ring around the uplink that spins
  const ringGeom = new THREE.TorusGeometry(2.4, 0.07, 8, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.45 });
  const goalRing = new THREE.Mesh(ringGeom, ringMat);
  goalRing.rotation.x = Math.PI / 2;
  goalRing.position.copy(goalMesh.position);
  group.add(goalRing);

  // second outer ring at a different angle for a fancier uplink
  const ringGeom2 = new THREE.TorusGeometry(3.2, 0.05, 8, 64);
  const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.35 });
  const goalRingOuter = new THREE.Mesh(ringGeom2, ringMat2);
  goalRingOuter.rotation.x = Math.PI / 2;
  goalRingOuter.rotation.y = Math.PI / 6;
  goalRingOuter.position.copy(goalMesh.position);
  group.add(goalRingOuter);

  // ===== LIGHTING =====
  const ambient = new THREE.AmbientLight(0x6688cc, 0.28);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xaaccff, 0x220044, 0.6);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.5);
  dir.position.set(30, 60, 18);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 160;
  dir.shadow.camera.left = -60;
  dir.shadow.camera.right = 60;
  dir.shadow.camera.top = 60;
  dir.shadow.camera.bottom = -60;
  scene.add(dir);
  // Inner-hub neon point lights
  const pink = new THREE.PointLight(0xff1493, 0.9, 60);
  pink.position.set(-12, 8, 4);
  scene.add(pink);
  const cyan = new THREE.PointLight(0x00fff2, 0.85, 60);
  cyan.position.set(12, 8, 4);
  scene.add(cyan);
  // Outer accent lights to keep the bigger arena lit
  const accentColors = [0xff1493, 0x00fff2, 0xff66cc, 0x7df9ff];
  const accentSpots = [
    [-30, 12, -22], [30, 12, -22],
    [-30, 14,  22], [30, 14,  22],
    [  0, 22, -30], [  0, 22,  30],
  ];
  for (let i = 0; i < accentSpots.length; i++) {
    const [x, y, z] = accentSpots[i];
    const c = accentColors[i % accentColors.length];
    const pl = new THREE.PointLight(c, 0.65, 55);
    pl.position.set(x, y, z);
    scene.add(pl);
  }
  const gold = new THREE.PointLight(0xffd766, 1.4, 50);
  gold.position.copy(goalMesh.position).y += 1.8;
  scene.add(gold);

  return { colliders, grappleMeshes, pulseMeshes, goalMesh, goalRing, goalRingOuter, goalLight: gold };
}

function buildShards(scene) {
  const shards = [];
  const positions = [
    // inner-hub shards (easy starters)
    [-9,  6.0,  -2],
    [ 9,  7.0,   2],
    [ 0,  9.0,  -8],
    [-8, 11.5,   9],
    [ 8, 12.0,  11],
    // mid-ring shards (need a few good swings)
    [-22, 14.0, -16],
    [ 22, 14.0, -16],
    [-24, 18.0,  18],
    [ 24, 18.0,  18],
    [  0, 20.0, -28],
    // high shards (climb the central spire / sky bridges)
    [  0, 26.0,  18],
    [  0, 32.0,  36],
  ];
  for (let i = 0; i < positions.length; i++) {
    const [x, y, z] = positions[i];
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData.collected = false;
    group.userData.basePos = new THREE.Vector3(x, y, z);
    group.userData.phase = Math.random() * Math.PI * 2;
    group.userData.index = i;

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({
        color: 0x66ffe5,
        emissive: 0x00ffe5,
        emissiveIntensity: 1.6,
        metalness: 0.65,
        roughness: 0.18,
      })
    );
    group.add(core);

    const halo = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 0),
      new THREE.MeshBasicMaterial({
        color: 0x00ffe5,
        transparent: true,
        opacity: 0.22,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    group.add(halo);

    const light = new THREE.PointLight(0x00ffe5, 0.7, 7);
    group.add(light);

    group.userData.core = core;
    group.userData.halo = halo;
    group.userData.light = light;

    scene.add(group);
    shards.push(group);
  }
  return shards;
}

function buildSkyline(scene) {
  const group = new THREE.Group();
  let seed = 7;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const palette = [0x002033, 0x0f0028, 0x250015, 0x081438, 0x1a0030, 0x002a3a];
  const neon = [0x00fff2, 0xff1493, 0xff66cc, 0x7df9ff, 0xffcc00];

  // Two concentric rings of buildings to give the city real depth
  const rings = [
    { count: 110, minR: 90, maxR: 140, minH: 18, maxH: 60 },
    { count: 90,  minR: 150, maxR: 215, minH: 24, maxH: 90 },
  ];

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + rng() * 0.12;
      const radius = ring.minR + rng() * (ring.maxR - ring.minR);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = ring.minH + rng() * (ring.maxH - ring.minH);
      const w = 2.8 + rng() * 6;
      const color = palette[Math.floor(rng() * palette.length)];
      const mat = new THREE.MeshBasicMaterial({ color });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      m.position.set(x, h / 2, z);
      group.add(m);

      // neon strips on most buildings
      if (rng() > 0.3) {
        const stripColor = neon[Math.floor(rng() * neon.length)];
        const stripMat = new THREE.MeshBasicMaterial({ color: stripColor });
        const stripCount = 1 + Math.floor(rng() * 4);
        for (let s = 0; s < stripCount; s++) {
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(w * 1.04, 0.18, w * 1.04),
            stripMat
          );
          strip.position.set(x, rng() * (h - 1) + 0.6, z);
          group.add(strip);
        }
      }

      // vertical neon "window column" stripe down one face
      if (rng() > 0.55) {
        const colColor = neon[Math.floor(rng() * neon.length)];
        const colMat = new THREE.MeshBasicMaterial({ color: colColor });
        const col = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, h * 0.7, w * 1.05),
          colMat
        );
        col.position.set(x, h * 0.45, z);
        group.add(col);
      }

      // antenna spire
      if (rng() > 0.65) {
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.18, 5 + rng() * 9, 5),
          new THREE.MeshBasicMaterial({ color: neon[Math.floor(rng() * neon.length)] })
        );
        spire.position.set(x, h + 3, z);
        group.add(spire);

        // tiny blinking light at the top of the spire
        if (rng() > 0.5) {
          const blink = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff3366 })
          );
          blink.position.set(x, h + 7 + rng() * 4, z);
          group.add(blink);
        }
      }
    }
  }

  // ===== distant mega-spires for skyline drama =====
  const megaCount = 8;
  for (let i = 0; i < megaCount; i++) {
    const angle = (i / megaCount) * Math.PI * 2 + 0.3;
    const radius = 240 + rng() * 30;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const h = 120 + rng() * 60;
    const w = 8 + rng() * 5;
    const mat = new THREE.MeshBasicMaterial({ color: 0x080020 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    m.position.set(x, h / 2, z);
    group.add(m);
    // glowing crown at the top
    const crownColor = neon[Math.floor(rng() * neon.length)];
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.1, 1.2, w * 1.1),
      new THREE.MeshBasicMaterial({ color: crownColor })
    );
    crown.position.set(x, h - 0.6, z);
    group.add(crown);
  }

  // ===== floating airships / billboards drifting in the distance =====
  const ships = [];
  for (let i = 0; i < 5; i++) {
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 8, 12),
      new THREE.MeshBasicMaterial({ color: 0x12042a })
    );
    hull.rotation.z = Math.PI / 2;
    ship.add(hull);
    const lights = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: neon[i % neon.length] })
    );
    lights.position.y = -0.9;
    ship.add(lights);
    const angle = (i / 5) * Math.PI * 2;
    const radius = 130 + rng() * 30;
    ship.position.set(
      Math.cos(angle) * radius,
      55 + rng() * 25,
      Math.sin(angle) * radius
    );
    ship.userData.driftOrigin = ship.position.clone();
    ship.userData.driftPhase = rng() * Math.PI * 2;
    ship.userData.driftSpeed = 0.05 + rng() * 0.05;
    group.add(ship);
    ships.push(ship);
  }

  // ===== moon and twin halo discs =====
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(9, 32),
    new THREE.MeshBasicMaterial({ color: 0xff66cc, transparent: true, opacity: 0.6 })
  );
  moon.position.set(-70, 55, -130);
  group.add(moon);
  const moonHalo = new THREE.Mesh(
    new THREE.CircleGeometry(15, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff1493,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  moonHalo.position.copy(moon.position).z += 0.1;
  group.add(moonHalo);

  // a second smaller cyan moon on the opposite side
  const moon2 = new THREE.Mesh(
    new THREE.CircleGeometry(4, 32),
    new THREE.MeshBasicMaterial({ color: 0x00fff2, transparent: true, opacity: 0.55 })
  );
  moon2.position.set(85, 70, -120);
  group.add(moon2);
  const moon2Halo = new THREE.Mesh(
    new THREE.CircleGeometry(7, 32),
    new THREE.MeshBasicMaterial({
      color: 0x00fff2,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  moon2Halo.position.copy(moon2.position).z += 0.1;
  group.add(moon2Halo);

  // ===== starfield overhead =====
  const starGeom = new THREE.BufferGeometry();
  const starCount = 400;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 200 + rng() * 60;
    const theta = rng() * Math.PI * 2;
    const phi = rng() * Math.PI * 0.45 + 0.1;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) + 30;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeom.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeom,
    new THREE.PointsMaterial({ color: 0xc8f4ff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.85 })
  );
  group.add(stars);

  scene.add(group);
  return { group, ships };
}

function buildGoalBeam(scene, goalMesh) {
  const beamGeom = new THREE.CylinderGeometry(1.5, 2.0, 140, 24, 1, true);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 0 } },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        float edge = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 2.2);
        float fall = pow(1.0 - vUv.y, 1.5);
        float pulse = 0.55 + 0.45 * sin(time * 2.5 + vUv.y * 16.0);
        float a = edge * fall * pulse * opacity;
        vec3 col = mix(vec3(1.0, 0.78, 0.25), vec3(1.0, 1.0, 0.7), pulse);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const beam = new THREE.Mesh(beamGeom, beamMat);
  beam.position.set(goalMesh.position.x, goalMesh.position.y + 70, goalMesh.position.z);
  scene.add(beam);
  return beam;
}

function buildHookGauntlet(camera) {
  const rig = new THREE.Group();
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f2e,
    emissive: 0x002030,
    emissiveIntensity: 0.4,
    metalness: 0.75,
    roughness: 0.35,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x00fff2,
    emissive: 0x00fff2,
    emissiveIntensity: 1.4,
    metalness: 0.7,
    roughness: 0.3,
  });

  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.5), armMat);
  forearm.position.set(0, 0, -0.22);
  rig.add(forearm);

  const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.18), armMat);
  wrist.position.set(0, 0, -0.5);
  rig.add(wrist);

  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.07, 0.22, 10),
    accent
  );
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0, -0.68);
  rig.add(muzzle);

  const sight = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.06, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xff1493,
      emissive: 0xff1493,
      emissiveIntensity: 1.2,
    })
  );
  sight.position.set(0, 0.1, -0.42);
  rig.add(sight);

  rig.position.set(0.27, -0.24, -0.05);
  camera.add(rig);
  return rig;
}

// ---------- main game ----------
function main() {
  const canvas = document.getElementById("game-canvas");
  const blocker = document.getElementById("blocker");
  const hud = document.getElementById("hud");
  const shardCounter = document.getElementById("shard-counter");
  const timerEl = document.getElementById("timer");
  const bestEl = document.getElementById("best");
  const blockerShardCount = document.getElementById("blocker-shard-count");
  const crosshair = document.getElementById("crosshair");
  const toast = document.getElementById("toast");
  const damageFlash = document.getElementById("damage-flash");

  if (blockerShardCount) blockerShardCount.textContent = String(TOTAL_SHARDS);

  const audio = new AudioKit();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06041a);
  scene.fog = new THREE.Fog(0x06041a, 60, 240);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.06, 520);
  camera.rotation.order = "YXZ";
  scene.add(camera); // needed so children (gauntlet) render

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const { colliders, grappleMeshes, pulseMeshes, goalMesh, goalRing, goalRingOuter, goalLight } = buildLevel(scene);
  const shards = buildShards(scene);
  const skyline = buildSkyline(scene);
  const goalBeam = buildGoalBeam(scene, goalMesh);
  const gauntlet = buildHookGauntlet(camera);

  // logical player position (camera follows with bob offset)
  const playerPos = new THREE.Vector3(0, EYE_HEIGHT + 0.02, 4);
  const velocity = new THREE.Vector3();
  let grounded = false;
  let prevGrounded = false;
  let bobPhase = 0;
  let baseFov = 72;
  let currentFov = baseFov;
  let stepTimer = 0;

  let hookAnchor = null;
  let hookTargetMesh = null;
  let ropeRestLength = 0;

  // tube rope
  const ropeGeom = new THREE.CylinderGeometry(0.022, 0.022, 1, 6, 1, true);
  ropeGeom.translate(0, 0.5, 0);
  const ropeMat = new THREE.MeshBasicMaterial({
    color: 0x00fff2,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ropeMesh = new THREE.Mesh(ropeGeom, ropeMat);
  ropeMesh.visible = false;
  scene.add(ropeMesh);

  // hook tip glow at the anchor
  const hookTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0x00fff2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  hookTip.visible = false;
  scene.add(hookTip);

  const controls = new PointerLockControls(camera, document.body);
  const raycaster = new THREE.Raycaster();
  raycaster.far = HOOK_MAX_LENGTH;

  const keys = new Set();
  let won = false;
  let started = false;
  let pendingJump = false;
  let elapsed = 0;
  let collected = 0;
  let bestTime = parseFloat(localStorage.getItem(BEST_KEY) || "");
  if (!isFinite(bestTime)) bestTime = NaN;

  function refreshHud() {
    shardCounter.innerHTML = `SHARDS <b>${collected}</b> / ${TOTAL_SHARDS}`;
    bestEl.textContent = isFinite(bestTime) ? `BEST ${fmtTime(bestTime)}` : "BEST —";
  }
  refreshHud();

  function showToast(text, gold = false, hold = 1.25) {
    toast.textContent = text;
    toast.classList.toggle("gold", gold);
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("show"), hold * 1000);
  }

  function flashDamage() {
    damageFlash.classList.add("on");
    setTimeout(() => damageFlash.classList.remove("on"), 180);
  }

  function resetRun(fullReset = true) {
    playerPos.set(0, EYE_HEIGHT + 0.02, 4);
    camera.position.copy(playerPos);
    camera.rotation.set(0, 0, 0);
    velocity.set(0, 0, 0);
    pendingJump = false;
    releaseHook();
    if (fullReset) {
      collected = 0;
      elapsed = 0;
      started = false;
      for (const s of shards) {
        s.userData.collected = false;
        s.visible = true;
        s.userData.core.material.opacity = 1;
        s.userData.core.material.transparent = false;
        s.userData.light.intensity = 0.7;
      }
      refreshHud();
    }
  }

  document.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.code === "Escape") return;
    if (e.code === "Space" && !e.repeat) pendingJump = true;
    if (e.code === "KeyR") releaseHook();
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));

  document.addEventListener("mousedown", (e) => {
    if (!controls.isLocked) return;
    if (e.button !== 0) return;
    if (!hookAnchor) tryFireHook();
  });
  document.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;
    if (hookAnchor) releaseHook();
  });

  function releaseHook() {
    hookAnchor = null;
    hookTargetMesh = null;
    ropeMesh.visible = false;
    hookTip.visible = false;
    audio.setSwing(0);
    crosshair.classList.remove("hooked");
  }

  function tryFireHook() {
    audio.hookFire();
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = raycaster.intersectObjects(grappleMeshes, false);
    if (!hits.length) {
      audio.hookMiss();
      return;
    }
    const hit = hits[0];
    if (!hit.object.userData.grapple) {
      audio.hookMiss();
      return;
    }
    hookAnchor = hit.point.clone();
    hookTargetMesh = hit.object;
    const dist = playerPos.distanceTo(hookAnchor);
    ropeRestLength = Math.min(dist, HOOK_MAX_LENGTH);
    ropeMesh.visible = true;
    hookTip.visible = true;
    audio.hookAttach();
    crosshair.classList.add("hooked");
    // initial yank toward the anchor so firing from the ground actually launches you
    tmpV.subVectors(hookAnchor, playerPos);
    if (tmpV.lengthSq() > 1e-6) {
      tmpV.normalize();
      velocity.addScaledVector(tmpV, HOOK_INITIAL_KICK);
    }
  }

  function handWorldPos(out) {
    out.set(0.27, -0.24, -0.6);
    camera.localToWorld(out);
    return out;
  }

  function updateRope() {
    if (!hookAnchor || !ropeMesh.visible) return;
    const start = handWorldPos(tmpV);
    const dir = tmpV2.subVectors(hookAnchor, start);
    const len = dir.length();
    if (len < 1e-4) {
      ropeMesh.visible = false;
      return;
    }
    ropeMesh.position.copy(start);
    ropeMesh.scale.set(1, len, 1);
    tmpV3.copy(dir).normalize();
    ropeMesh.quaternion.setFromUnitVectors(
      tmpV4.set(0, 1, 0),
      tmpV3
    );
    hookTip.position.copy(hookAnchor);
    const t = elapsed * 6;
    const flick = 0.6 + 0.4 * (Math.sin(t) * 0.5 + 0.5);
    hookTip.material.opacity = 0.6 + 0.4 * flick;
    hookTip.scale.setScalar(1 + 0.2 * Math.sin(t * 1.5));
  }

  function updateReticle() {
    if (!controls.isLocked) {
      crosshair.classList.remove("target", "hooked");
      return;
    }
    if (hookAnchor) {
      crosshair.classList.add("hooked");
      crosshair.classList.remove("target");
      return;
    }
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = raycaster.intersectObjects(grappleMeshes, false);
    crosshair.classList.toggle("target", hits.length > 0);
  }

  blocker.addEventListener("click", () => {
    audio.ensure();
    if (!won) controls.lock();
  });

  controls.addEventListener("lock", () => {
    if (won) {
      won = false;
      resetRun(true);
      hud.textContent = "";
    }
    document.body.classList.add("locked");
    blocker.style.display = "none";
  });
  controls.addEventListener("unlock", () => {
    document.body.classList.remove("locked");
    blocker.style.display = "flex";
    audio.setSwing(0);
  });

  const clock = new THREE.Clock();

  function tryCollectShards() {
    for (const s of shards) {
      if (s.userData.collected) continue;
      const dx = playerPos.x - s.position.x;
      const dy = playerPos.y - EYE_HEIGHT * 0.5 - s.position.y;
      const dz = playerPos.z - s.position.z;
      if (dx * dx + dy * dy + dz * dz < 1.3 * 1.3) {
        s.userData.collected = true;
        s.visible = false;
        collected++;
        audio.shardPickup(collected - 1);
        refreshHud();
        if (collected === TOTAL_SHARDS) {
          showToast("UPLINK ONLINE", true, 1.6);
          audio.unlock();
        } else {
          showToast(`SHARD ${collected} / ${TOTAL_SHARDS}`);
        }
      }
    }
  }

  function checkWin() {
    if (won) return;
    if (collected < TOTAL_SHARDS) return;
    const dx = playerPos.x - goalMesh.position.x;
    const dz = playerPos.z - goalMesh.position.z;
    const horiz = Math.hypot(dx, dz);
    if (horiz < 1.85 && playerPos.y > goalMesh.position.y - 0.2 && playerPos.y < goalMesh.position.y + 3) {
      won = true;
      releaseHook();
      audio.win();
      const finalTime = elapsed;
      let isBest = false;
      if (!isFinite(bestTime) || finalTime < bestTime) {
        bestTime = finalTime;
        try {
          localStorage.setItem(BEST_KEY, String(bestTime));
        } catch {}
        isBest = true;
      }
      refreshHud();
      const newRecord = isBest ? "  ·  NEW BEST" : "";
      hud.textContent = `Broadcast complete · ${fmtTime(finalTime)}${newRecord}  —  click to run again`;
      controls.unlock();
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    const GP = window.ArcadeGamepad;
    if (GP) {
      GP.update();
      if (GP.connected) {
        if (!controls.isLocked && GP.confirmPressed()) controls.lock();
        if (controls.isLocked && !won) {
          GP.applyMoveKeys(keys);
          if (GP.pressed("a") || GP.pressed("x")) pendingJump = true;
          if (GP.pressed("b")) releaseHook();
          if (GP.pressed("rt") || GP.pressed("rb") || GP.pressed("y")) tryFireHook();
          camera.rotation.y -= GP.rightX * 0.042;
          camera.rotation.x = Math.max(
            -Math.PI * 0.49,
            Math.min(Math.PI * 0.49, camera.rotation.x - GP.rightY * 0.032),
          );
        }
      }
    }

    if (controls.isLocked && !won) {
      if (!started && (keys.size > 0 || pendingJump)) {
        started = true;
      }
      if (started) elapsed += dt;
    }

    grounded = playerPos.y <= EYE_HEIGHT + 0.06 && velocity.y <= 0.05;

    let moveMag = 0;
    if (controls.isLocked && !won) {
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
        moveMag = 1;
      }
      // friction — always-on when grounded, gentle drag in the air when not hooked
      if (!hookAnchor) {
        const sp = Math.hypot(velocity.x, velocity.z);
        if (sp > 0) {
          let drop = 0;
          if (grounded) {
            // Quake-style: floor speed at GROUND_FRICTION_STOP so low speeds brake fast
            const control = Math.max(sp, GROUND_FRICTION_STOP);
            drop = control * (GROUND_FRICTION / control) * dt;
          } else {
            drop = AIR_DRAG * dt;
          }
          if (sp <= drop) {
            velocity.x = 0;
            velocity.z = 0;
          } else {
            const k = (sp - drop) / sp;
            velocity.x *= k;
            velocity.z *= k;
          }
        }
      }
      const accel = grounded ? GROUND_ACCEL : AIR_ACCEL;
      const maxSp = grounded ? MAX_SPEED_GROUND : MAX_SPEED_AIR;
      velocity.x += mx * accel * dt;
      velocity.z += mz * accel * dt;
      const sp = Math.hypot(velocity.x, velocity.z);
      if (sp > maxSp) {
        velocity.x *= maxSp / sp;
        velocity.z *= maxSp / sp;
      }
      if (pendingJump && grounded) {
        velocity.y = JUMP_SPEED;
        grounded = false;
        pendingJump = false;
        audio.jump();
      }
    } else {
      pendingJump = false;
    }

    velocity.y += GRAVITY * dt;
    playerPos.addScaledVector(velocity, dt);

    if (hookAnchor) {
      ropeRestLength = Math.max(HOOK_MIN_LEN, ropeRestLength - HOOK_WINCH * dt);
      tmpV.subVectors(playerPos, hookAnchor);
      let dist = tmpV.length();
      if (dist > 1e-5) {
        tmpV.multiplyScalar(1 / dist);
      } else {
        tmpV.set(0, 1, 0);
        dist = 0;
      }
      if (dist > ropeRestLength) {
        tmpV2.copy(hookAnchor).addScaledVector(tmpV, ropeRestLength);
        playerPos.copy(tmpV2);
        const radialSpeed = velocity.dot(tmpV);
        if (radialSpeed > 0) {
          tmpV3.copy(tmpV).multiplyScalar(radialSpeed);
          velocity.sub(tmpV3);
        }
      }
      tmpV3.subVectors(hookAnchor, playerPos);
      const pullDirLen = tmpV3.length();
      if (pullDirLen > 0.15) {
        tmpV3.multiplyScalar(1 / pullDirLen);
        velocity.addScaledVector(tmpV3, HOOK_PULL * dt);
      }
      velocity.addScaledVector(velocity, -HOOK_SWING_DAMP * dt);
    }

    if (playerPos.y < EYE_HEIGHT + 0.02) {
      playerPos.y = EYE_HEIGHT + 0.02;
      if (velocity.y < 0) velocity.y = 0;
    }

    const fallSpeed = Math.abs(velocity.y);
    let landed = false;
    for (const box of colliders) {
      if (resolveAabbPenetration(playerPos, velocity, box)) landed = true;
    }
    const landImpact = landed ? fallSpeed : 0;
    // ground landing
    if (!prevGrounded && grounded && !hookAnchor) {
      audio.land(Math.min(8, Math.abs(velocity.y) * 0.6 + 1));
    }
    if (landed) {
      audio.land(landImpact);
    }

    // fall off the world: bounce back to spawn, lose nothing
    if (playerPos.y < FALL_RESPAWN_Y) {
      flashDamage();
      showToast("REROUTING…", false, 1.0);
      playerPos.set(0, EYE_HEIGHT + 0.02, 4);
      velocity.set(0, 0, 0);
      releaseHook();
    }

    // footsteps
    if (grounded && moveMag > 0.5) {
      const speed = Math.hypot(velocity.x, velocity.z);
      if (speed > 1.2) {
        stepTimer -= dt * speed * 0.45;
        if (stepTimer <= 0) {
          audio.step();
          stepTimer = 1;
        }
      }
    } else {
      stepTimer = 0.4;
    }

    // camera bob (visual only)
    let bobY = 0;
    let bobX = 0;
    if (grounded && moveMag > 0.5) {
      const speed = Math.hypot(velocity.x, velocity.z);
      bobPhase += dt * (4 + speed * 0.6);
      bobY = Math.sin(bobPhase * 2) * 0.045 * Math.min(1, speed / MAX_SPEED_GROUND);
      bobX = Math.cos(bobPhase) * 0.025 * Math.min(1, speed / MAX_SPEED_GROUND);
    } else {
      bobPhase *= 0.94;
    }
    camera.position.copy(playerPos);
    camera.position.y += bobY;
    // small lateral bob in camera local right
    tmpV.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(bobX);
    camera.position.add(tmpV);

    // FOV pulse based on horizontal speed (or hook radial speed)
    const horizSpd = Math.hypot(velocity.x, velocity.z);
    const verticalAdd = hookAnchor ? Math.abs(velocity.y) * 0.2 : 0;
    const fovTarget = baseFov + clamp(horizSpd * 0.6 + verticalAdd, 0, 12);
    currentFov = lerp(currentFov, fovTarget, 0.12);
    if (Math.abs(camera.fov - currentFov) > 0.05) {
      camera.fov = currentFov;
      camera.updateProjectionMatrix();
    }

    // gauntlet bob/recoil
    gauntlet.position.x = 0.27 + bobX * 0.5;
    gauntlet.position.y = -0.24 + bobY * 0.6;
    if (hookAnchor) {
      gauntlet.rotation.x = lerp(gauntlet.rotation.x, -0.18, 0.12);
    } else {
      gauntlet.rotation.x = lerp(gauntlet.rotation.x, 0, 0.12);
    }

    // swing audio intensity
    if (hookAnchor) {
      const speed = velocity.length();
      audio.setSwing(clamp(speed / 18, 0, 1));
    }

    // pulse grapple meshes
    for (const m of pulseMeshes) {
      const t = elapsed * 1.6 + m.userData.pulsePhase;
      m.material.emissiveIntensity = m.userData.basePulse + Math.sin(t) * 0.18;
    }

    // shards animate + pickup
    for (const s of shards) {
      if (!s.visible) continue;
      const t = elapsed * 1.4 + s.userData.phase;
      s.position.y = s.userData.basePos.y + Math.sin(t) * 0.25;
      s.userData.core.rotation.y += dt * 1.6;
      s.userData.core.rotation.x += dt * 0.9;
      s.userData.halo.rotation.y -= dt * 0.6;
      s.userData.halo.material.opacity = 0.18 + Math.sin(t * 1.8) * 0.08;
    }
    tryCollectShards();

    // goal state visuals
    const unlocked = collected >= TOTAL_SHARDS;
    goalRing.rotateZ(dt * 1.4);
    goalRingOuter.rotateZ(-dt * 0.8);
    goalRingOuter.rotateX(dt * 0.4);
    goalMesh.material.emissiveIntensity = unlocked
      ? 0.9 + Math.sin(elapsed * 4) * 0.15
      : 0.3;
    goalMesh.material.color.setHex(unlocked ? 0xffd700 : 0x6a5500);
    goalRing.material.opacity = unlocked
      ? 0.7 + Math.sin(elapsed * 5) * 0.2
      : 0.2;
    goalRing.material.color.setHex(unlocked ? 0xffd700 : 0x6a5500);
    goalRingOuter.material.opacity = unlocked
      ? 0.55 + Math.sin(elapsed * 3.2) * 0.15
      : 0.12;
    goalRingOuter.material.color.setHex(unlocked ? 0xffaa00 : 0x4a3500);
    goalLight.intensity = unlocked ? 1.8 + Math.sin(elapsed * 4) * 0.3 : 0.5;
    goalBeam.material.uniforms.time.value = elapsed;
    const targetBeamOpacity = unlocked ? 0.9 : 0.0;
    goalBeam.material.uniforms.opacity.value = lerp(
      goalBeam.material.uniforms.opacity.value,
      targetBeamOpacity,
      0.05
    );

    // drifting airships in the skyline
    if (skyline && skyline.ships) {
      for (const ship of skyline.ships) {
        const o = ship.userData.driftOrigin;
        const ph = ship.userData.driftPhase;
        const sp = ship.userData.driftSpeed;
        ship.position.x = o.x + Math.sin(elapsed * sp + ph) * 8;
        ship.position.y = o.y + Math.sin(elapsed * sp * 0.6 + ph) * 1.5;
        ship.rotation.y = Math.sin(elapsed * sp + ph) * 0.4;
      }
    }

    checkWin();
    updateRope();
    updateReticle();

    if (controls.isLocked && !won) {
      if (collected < TOTAL_SHARDS) {
        hud.textContent = hookAnchor
          ? "Swinging · release LMB to let go"
          : `Hijack the data shards · ${TOTAL_SHARDS - collected} remaining · hold LMB to swing`;
      } else {
        hud.textContent = hookAnchor
          ? "Uplink hot · release LMB to ride the gold beam"
          : "All shards secured · reach the gold uplink";
      }
    } else if (!won && !controls.isLocked) {
      hud.textContent = "";
    }

    timerEl.textContent = fmtTime(elapsed);

    prevGrounded = grounded;
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

main();
