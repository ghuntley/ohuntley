/**
 * VELODRONE — first-person FPV drone racer (acro/rate-mode).
 *
 * Mimics the feel of a real 5-inch racing quad in acro mode:
 *   - No self-leveling. Stick inputs command angular RATES around body axes,
 *     so once you tilt forward, you keep tilting forward until you pitch back.
 *   - Thrust always points along the drone's local +Y. To fly forward you
 *     pitch the nose down, which converts some of your thrust into horizontal
 *     acceleration. Hover throttle ≈ GRAVITY / MAX_THRUST.
 *   - FPV camera is bolted to the airframe and pitched up ~22°, so when the
 *     drone leans forward to cruise, you can still see the horizon.
 *   - Physics runs at a fixed substep (200 Hz) so the simulation is stable
 *     regardless of frame rate.
 *
 * Track is a closed loop of neon race gates. Pass them in order, complete
 * 3 laps, finishing on the start/finish gate. Best total time goes to the
 * shared arcade leaderboard.
 */

import * as THREE from "three";

const SLUG = "drone";

// =====================================================================
// Tunables
// =====================================================================

// Physics
const GRAVITY = 18;              // m/s² (game-y; not 9.81 — feels snappier)
const MAX_THRUST = 38;           // m/s² peak thrust (≈ 2.1× gravity)
const HOVER_THROTTLE = GRAVITY / MAX_THRUST; // ~0.47

const MAX_PITCH_RATE = 6.8;      // rad/s (≈ 390°/s)
const MAX_ROLL_RATE  = 7.6;      // rad/s (≈ 435°/s)
const MAX_YAW_RATE   = 3.4;      // rad/s (≈ 195°/s)
const RATE_RESPONSE  = 22;       // exp-smoothing rate for body angular velocity

const STICK_EXPO = 0.35;         // expo curve on sticks (0 = linear, 1 = full expo)

const DRAG_LINEAR = 0.55;        // exp(-DRAG*dt) velocity damping
const DRAG_VERT_BIAS = 0.10;     // extra vertical drag (air column resistance)

const GROUND_Y = 0;              // ground plane height
const WORLD_KILL_Y = -10;        // below this → crash reset
const WORLD_KILL_RADIUS = 220;   // horizontal kill radius

// Input mapping
const THROTTLE_RAMP = 1.8;       // how fast throttle slews per second
const COUNTDOWN_SECS = 3;

// Camera
const FPV_CAM_TILT = 22 * Math.PI / 180; // FPV cam pitched up ~22°
const CHASE_DIST = 3.4;
const CHASE_HEIGHT = 1.0;
const CHASE_LERP = 6.0;          // higher = snappier chase
const CAM_SHAKE_BASE = 0.012;

// Gate geometry
const GATE_W = 3.6;              // opening width
const GATE_H = 3.6;              // opening height
const GATE_FRAME = 0.22;         // frame thickness

// =====================================================================
// DOM
// =====================================================================

const canvas         = document.getElementById("game-canvas");
const blocker        = document.getElementById("blocker");
const lapTextEl      = document.getElementById("lap-text");
const lapTimerEl     = document.getElementById("lap-timer");
const lapSplitsEl    = document.getElementById("lap-splits");
const speedEl        = document.getElementById("speed-readout");
const altEl          = document.getElementById("alt-readout");
const gateEl         = document.getElementById("gate-readout");
const camLabelEl     = document.getElementById("cam-label");
const bestReadoutEl  = document.getElementById("best-readout");
const throttleFillEl = document.getElementById("throttle-fill");
const throttleHoverEl= document.getElementById("throttle-hover");
const attitudeCanvas = document.getElementById("attitude-canvas");
const attitudeCtx    = attitudeCanvas.getContext("2d");
const gateArrowEl    = document.getElementById("gate-arrow");
const countdownEl    = document.getElementById("countdown");
const toastEl        = document.getElementById("toast");
const crashFlashEl   = document.getElementById("crash-flash");
const levelGridEl    = document.getElementById("level-grid");
const bestLineEl     = document.getElementById("best-line");

const finishEl       = document.getElementById("finish");
const finishTimeEl   = document.getElementById("finish-time");
const finishStatsEl  = document.getElementById("finish-stats");
const finishSplitsEl = document.getElementById("finish-splits");
const finishLbEl     = document.getElementById("finish-lb");
const finishRetryBtn = document.getElementById("finish-retry");
const finishNextBtn  = document.getElementById("finish-next");

const joyLeftEl      = document.getElementById("joy-left");
const joyLeftKnob    = document.getElementById("joy-left-knob");
const joyRightEl     = document.getElementById("joy-right");
const joyRightKnob   = document.getElementById("joy-right-knob");
const camBtn         = document.getElementById("cam-btn");
const resetBtn       = document.getElementById("reset-btn");

// position the hover marker on throttle bar
throttleHoverEl.style.bottom = `${HOVER_THROTTLE * 100}%`;

// =====================================================================
// Three.js scene
// =====================================================================

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false; // shadows are expensive; gates self-glow

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05081a);
scene.fog = new THREE.FogExp2(0x05081a, 0.0085);

const camera = new THREE.PerspectiveCamera(105, 16 / 9, 0.05, 800);
camera.position.set(0, 2.5, -6);

// Sky dome — vertical gradient with neon horizon band.
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop:     { value: new THREE.Color(0x020514) },
    uMid:     { value: new THREE.Color(0x0a0820) },
    uHorizon: { value: new THREE.Color(0xff2da3) },
    uGround:  { value: new THREE.Color(0x01010a) },
    uHorBand: { value: new THREE.Color(0x00fff2) },
  },
  vertexShader: `
    varying vec3 vWorld;
    void main() {
      vWorld = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uTop, uMid, uHorizon, uGround, uHorBand;
    varying vec3 vWorld;
    void main() {
      float h = normalize(vWorld).y;
      vec3 col;
      if (h >= 0.0) {
        float t = pow(h, 0.55);
        vec3 lo = mix(uHorizon, uMid, smoothstep(0.0, 0.4, t));
        col = mix(lo, uTop, smoothstep(0.4, 1.0, t));
        // Thin neon horizon band
        float band = smoothstep(0.0, 0.02, h) * (1.0 - smoothstep(0.02, 0.07, h));
        col = mix(col, uHorBand, band * 0.6);
      } else {
        col = mix(uHorizon, uGround, smoothstep(0.0, 0.55, -h));
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(380, 48, 24), skyMat);
scene.add(skyDome);

const hemi = new THREE.HemisphereLight(0xff8ad6, 0x0a061a, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 0.55);
sun.position.set(40, 80, 25);
scene.add(sun);

// Ground: neon-grid plane with subtle shader.
const groundMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:   { value: 0 },
    uBase:   { value: new THREE.Color(0x040414) },
    uLine:   { value: new THREE.Color(0x00fff2) },
    uLine2:  { value: new THREE.Color(0xff2da3) },
  },
  vertexShader: `
    varying vec3 vWorld;
    void main() {
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uBase, uLine, uLine2;
    varying vec3 vWorld;
    void main() {
      vec2 p = vWorld.xz;
      vec2 g = abs(fract(p * 0.5 + 0.5) - 0.5);
      float fineLine = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
      vec2 g2 = abs(fract(p * 0.05 + 0.5) - 0.5);
      float majorLine = 1.0 - smoothstep(0.0, 0.012, min(g2.x, g2.y));
      // distance fade
      float d = length(p);
      float fade = 1.0 - smoothstep(40.0, 180.0, d);
      vec3 col = uBase;
      col += uLine  * fineLine  * 0.35 * fade;
      col += uLine2 * majorLine * 0.85 * fade;
      // slow horizon pulse
      col += vec3(0.02, 0.0, 0.04) * (sin(uTime * 0.4) * 0.5 + 0.5);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(800, 800, 1, 1), groundMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = 0;
scene.add(groundMesh);

// Distant neon "skyline" rings — purely cosmetic horizon decoration.
{
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff2da3,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(160, 160, 6, 64, 1, true),
    ringMat,
  );
  ring.position.y = -1.5;
  scene.add(ring);

  const ringMat2 = new THREE.MeshBasicMaterial({
    color: 0x00fff2,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const ring2 = new THREE.Mesh(
    new THREE.CylinderGeometry(190, 190, 14, 80, 1, true),
    ringMat2,
  );
  ring2.position.y = 1.5;
  scene.add(ring2);
}

// =====================================================================
// Drone model (X-quad with 4 spinning props, FPV cam, antennas, LEDs)
// =====================================================================

const droneGroup = new THREE.Group();
scene.add(droneGroup);

// Track a few sub-objects for animation
const propMeshes = [];   // 4 propellers
const propRotors = [];   // 4 motor stator caps (slight spin too, subtle)
const ledStrips = [];    // emissive LED bars
let droneCamMount;       // child object where the FPV camera lives
let underglow;           // PointLight under chassis

function buildDrone() {
  // Carbon fiber frame (X)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a12,
    metalness: 0.6,
    roughness: 0.45,
  });
  const armGeo = new THREE.BoxGeometry(0.62, 0.05, 0.05);
  // Two crossing arms (X)
  const arm1 = new THREE.Mesh(armGeo, frameMat);
  arm1.rotation.y = Math.PI / 4;
  droneGroup.add(arm1);
  const arm2 = new THREE.Mesh(armGeo, frameMat);
  arm2.rotation.y = -Math.PI / 4;
  droneGroup.add(arm2);

  // Center stack (flight controller + ESC stack)
  const stackMat = new THREE.MeshStandardMaterial({
    color: 0x1c1c2a, metalness: 0.4, roughness: 0.55,
  });
  const stack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.20), stackMat);
  stack.position.y = 0.03;
  droneGroup.add(stack);

  // Battery (LiPo) on top — purple wrap
  const battMat = new THREE.MeshStandardMaterial({
    color: 0x2a0a4a, emissive: 0x100626, emissiveIntensity: 0.4,
    metalness: 0.2, roughness: 0.6,
  });
  const batt = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.06, 0.32), battMat);
  batt.position.y = 0.10;
  droneGroup.add(batt);
  // Velcro strap detail
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.9 });
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.04), strapMat);
  strap.position.set(0, 0.135, 0.06);
  droneGroup.add(strap);
  const strap2 = strap.clone();
  strap2.position.z = -0.06;
  droneGroup.add(strap2);

  // FPV camera assembly (front), tilted up
  const camHousingMat = new THREE.MeshStandardMaterial({
    color: 0x0c0c14, metalness: 0.5, roughness: 0.45,
  });
  const camHousing = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.08), camHousingMat);
  camHousing.position.set(0, 0.08, 0.16);
  camHousing.rotation.x = -FPV_CAM_TILT; // tilt back (so its forward looks up)
  droneGroup.add(camHousing);

  // Lens
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x000810, emissive: 0x002a3a, emissiveIntensity: 0.55,
    metalness: 0.9, roughness: 0.05,
  });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.05, 16), lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, 0.05);
  camHousing.add(lens);

  // Mount: where the cinematic chase / FPV camera should sit (relative to drone)
  droneCamMount = new THREE.Object3D();
  droneGroup.add(droneCamMount);
  droneCamMount.position.set(0, 0.06, 0.12);
  // Note: we don't use this Object3D for the camera directly; we compute the
  // camera transform manually so we can apply shake and chase smoothing.

  // VTX antenna (rear, sticking up)
  const antennaMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee, metalness: 0.05, roughness: 0.6,
  });
  const antBase = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), antennaMat);
  antBase.position.set(0, 0.18, -0.14);
  droneGroup.add(antBase);
  const antCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x00fff2, emissive: 0x004a44, emissiveIntensity: 0.85 }),
  );
  antCap.position.set(0, 0.27, -0.14);
  droneGroup.add(antCap);

  // 4 motor + prop assemblies on the X tips
  const motorMat = new THREE.MeshStandardMaterial({
    color: 0xb0b0c0, metalness: 0.85, roughness: 0.25,
  });
  const propMat = new THREE.MeshStandardMaterial({
    color: 0x111118, metalness: 0.2, roughness: 0.65,
    transparent: true, opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const propBladeGeo = new THREE.BoxGeometry(0.45, 0.012, 0.038);
  const propDiscGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.008, 24);
  const propDiscMat = new THREE.MeshBasicMaterial({
    color: 0x6affff, transparent: true, opacity: 0.10, depthWrite: false,
  });

  const armLen = 0.31 / Math.SQRT2; // half-distance along x from center for each arm tip in world space
  const motorPositions = [
    new THREE.Vector3( 0.22, 0.03,  0.22), // FR
    new THREE.Vector3(-0.22, 0.03,  0.22), // FL
    new THREE.Vector3( 0.22, 0.03, -0.22), // BR
    new THREE.Vector3(-0.22, 0.03, -0.22), // BL
  ];
  motorPositions.forEach((p, i) => {
    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 0.06, 14),
      motorMat,
    );
    motor.position.copy(p);
    droneGroup.add(motor);
    propRotors.push(motor);

    // Propeller — two blades + an alpha disc (visualizes spin like motion blur)
    const prop = new THREE.Group();
    prop.position.copy(p);
    prop.position.y += 0.04;
    const blade = new THREE.Mesh(propBladeGeo, propMat);
    prop.add(blade);
    const blade2 = new THREE.Mesh(propBladeGeo, propMat);
    blade2.rotation.y = Math.PI / 2;
    prop.add(blade2);
    const disc = new THREE.Mesh(propDiscGeo, propDiscMat);
    disc.position.y = 0.002;
    prop.add(disc);
    droneGroup.add(prop);
    propMeshes.push({
      prop,
      disc,
      blade1: blade,
      blade2: blade2,
      // alternate spin direction per FPV convention (CW/CCW)
      dir: (i === 0 || i === 3) ? 1 : -1,
      angle: Math.random() * Math.PI * 2,
    });
  });

  // LED strip underglow (cyan + magenta) on each arm bottom
  const ledColors = [0x00fff2, 0xff2da3, 0x00fff2, 0xff2da3];
  motorPositions.forEach((p, i) => {
    const m = new THREE.MeshBasicMaterial({ color: ledColors[i], transparent: true, opacity: 0.9 });
    const ledGeo = new THREE.BoxGeometry(0.42, 0.008, 0.018);
    const led = new THREE.Mesh(ledGeo, m);
    led.position.set(p.x * 0.55, -0.012, p.z * 0.55);
    led.rotation.y = Math.atan2(p.x, p.z);
    droneGroup.add(led);
    ledStrips.push({ mesh: led, baseColor: ledColors[i] });
  });

  // Soft underglow point light
  underglow = new THREE.PointLight(0x00fff2, 0.6, 5, 1.6);
  underglow.position.set(0, -0.05, 0);
  droneGroup.add(underglow);
}
buildDrone();

// =====================================================================
// Particle thrust trail (subtle)
// =====================================================================

const TRAIL_MAX = 220;
const trailPositions = new Float32Array(TRAIL_MAX * 3);
const trailColors = new Float32Array(TRAIL_MAX * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
trailGeo.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
const trailMat = new THREE.PointsMaterial({
  size: 0.18,
  vertexColors: true,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true,
});
const trail = new THREE.Points(trailGeo, trailMat);
scene.add(trail);
let trailHead = 0;
const trailAge = new Float32Array(TRAIL_MAX);

function emitTrail(pos, color, jitter = 0.05) {
  trailPositions[trailHead * 3 + 0] = pos.x + (Math.random() - 0.5) * jitter;
  trailPositions[trailHead * 3 + 1] = pos.y + (Math.random() - 0.5) * jitter;
  trailPositions[trailHead * 3 + 2] = pos.z + (Math.random() - 0.5) * jitter;
  trailColors[trailHead * 3 + 0] = color.r;
  trailColors[trailHead * 3 + 1] = color.g;
  trailColors[trailHead * 3 + 2] = color.b;
  trailAge[trailHead] = 0;
  trailHead = (trailHead + 1) % TRAIL_MAX;
  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.attributes.color.needsUpdate = true;
}

const trailColorBuf = new THREE.Color();

// =====================================================================
// Gate system
// =====================================================================

const gates = [];        // active gate objects for current track
let nextGateIdx = 0;     // index of the gate the pilot must hit next
let lap = 1;
const TOTAL_LAPS = 3;
const lapTimes = [0, 0, 0];
let lapElapsed = 0;
let totalElapsed = 0;

let trackGroup = new THREE.Group();
scene.add(trackGroup);

// Build a gate at (x,y,z) facing along `fwd` (the racing-line tangent at this
// point). The gate plane is perpendicular to `fwd`; the gate's "up" stays
// world-up where possible, and rotates only when the racing line goes
// nearly vertical (the apex of a loop, etc.).
const _gateRight = new THREE.Vector3();
const _gateUp = new THREE.Vector3();
const _gateBasis = new THREE.Matrix4();
const _gateQuat = new THREE.Quaternion();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _altUp = new THREE.Vector3(0, 0, 1);

function buildGateQuat(fwd) {
  const forward = fwd.clone().normalize();
  // Pick a world-up reference; if forward is nearly vertical, use +Z as the
  // alt reference so the basis stays well-defined.
  let upRef = _worldUp;
  if (Math.abs(forward.dot(_worldUp)) > 0.985) upRef = _altUp;
  _gateRight.crossVectors(upRef, forward).normalize();
  _gateUp.crossVectors(forward, _gateRight).normalize();
  // Basis columns: local X = right, local Y = up, local Z = forward
  _gateBasis.makeBasis(_gateRight, _gateUp, forward);
  _gateQuat.setFromRotationMatrix(_gateBasis);
  return _gateQuat.clone();
}

function makeGate({ x, y, z, fwd, w = GATE_W, h = GATE_H, label = "" }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const gateQuat = buildGateQuat(fwd);
  group.quaternion.copy(gateQuat);

  const halfW = w / 2;
  const halfH = h / 2;
  const t = GATE_FRAME;

  // Frame material — emissive cyan by default; set via setGateState()
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x121828,
    emissive: 0x00fff2,
    emissiveIntensity: 0.8,
    metalness: 0.55,
    roughness: 0.35,
  });

  // 4 frame bars
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * t, t, t), frameMat);
  top.position.set(0, halfH + t / 2, 0);
  group.add(top);
  const bot = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * t, t, t), frameMat);
  bot.position.set(0, -halfH - t / 2, 0);
  group.add(bot);
  const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, t), frameMat);
  left.position.set(-halfW - t / 2, 0, 0);
  group.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(t, h, t), frameMat);
  right.position.set(halfW + t / 2, 0, 0);
  group.add(right);

  // Inner neon ring (slightly emissive plane outline using line segments)
  const innerEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, 0.001));
  const innerEdge = new THREE.LineSegments(
    innerEdgeGeo,
    new THREE.LineBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.95 }),
  );
  group.add(innerEdge);

  // Banner top with gate number
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0x1a0a30,
    emissive: 0xff2da3,
    emissiveIntensity: 0.75,
    metalness: 0.3,
    roughness: 0.5,
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.45, 0.06), bannerMat);
  banner.position.set(0, halfH + t + 0.45, 0);
  group.add(banner);

  // Gate label as a canvas-texture sprite on the banner
  if (label) {
    const cnv = document.createElement("canvas");
    cnv.width = 256;
    cnv.height = 64;
    const ctx = cnv.getContext("2d");
    ctx.fillStyle = "transparent";
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = "bold 44px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ff2da3";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, 128, 36);
    const tex = new THREE.CanvasTexture(cnv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.5, 0.38),
      labelMat,
    );
    labelMesh.position.set(0, halfH + t + 0.45, 0.04);
    group.add(labelMesh);
  }

  // Pylons (legs touching the ground if gate is roughly upright and close to floor)
  const isUpright = Math.abs(fwd.y) < 0.4;
  if (isUpright && y - halfH < 2.5) {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.7 });
    const legH = Math.max(0.1, y - halfH);
    if (legH > 0.1) {
      const legGeo = new THREE.BoxGeometry(0.16, legH, 0.16);
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-halfW - t, -halfH - legH / 2, 0);
      group.add(legL);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(halfW + t, -halfH - legH / 2, 0);
      group.add(legR);
    }
  }

  // Plane-crossing data in world space:
  const dirWorld = fwd.clone().normalize();
  const data = {
    group,
    pos: group.position.clone(),
    halfW,
    halfH,
    invQuat: gateQuat.clone().invert(),
    dirWorld,
    frameMat,
    bannerMat,
    state: "normal", // "normal" | "next" | "passed" | "start"
    label,
    pulse: 0,
  };
  trackGroup.add(group);
  gates.push(data);
  return data;
}

function setGateState(g, state) {
  g.state = state;
  let frameCol = 0x00fff2;
  let frameEm = 1.0;
  let bannerCol = 0xff2da3;
  if (state === "next") {
    frameCol = 0xffd700;
    frameEm = 1.6;
    bannerCol = 0xffd700;
  } else if (state === "passed") {
    frameCol = 0x114040;
    frameEm = 0.25;
    bannerCol = 0x331818;
  } else if (state === "start") {
    frameCol = 0xff2da3;
    frameEm = 1.4;
    bannerCol = 0x00fff2;
  }
  g.frameMat.emissive.setHex(frameCol);
  g.frameMat.emissiveIntensity = frameEm;
  g.bannerMat.emissive.setHex(bannerCol);
}

function refreshGateStates() {
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    if (i === nextGateIdx) setGateState(g, "next");
    else if (i === 0 && nextGateIdx !== 0) setGateState(g, "start");
    else setGateState(g, "normal");
  }
}

function clearTrack() {
  scene.remove(trackGroup);
  trackGroup.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
  trackGroup = new THREE.Group();
  scene.add(trackGroup);
  gates.length = 0;
}

// =====================================================================
// Track catalog
// =====================================================================
//
// Each track is a closed loop of "waypoints". The gate at each waypoint
// is automatically oriented so its normal points to the *next* waypoint.
// Gate 0 doubles as the start/finish line.

const TRACKS = [
  {
    id: "hangar",
    name: "Hangar Practice",
    sub: "Learn the line · big gates",
    spawn: { x: 0, y: 2.2, z: -8, yaw: 0 },
    sky: { top: 0x040218, mid: 0x12063a, horizon: 0xff2da3, ground: 0x010108, horBand: 0x00fff2 },
    fog: { color: 0x05081a, density: 0.0085 },
    // closed loop, gate 0 is start/finish
    waypoints: [
      { x: 0,   y: 2.0, z: 0,   w: 5.0, h: 5.0 }, // start/finish
      { x: 0,   y: 2.6, z: 22,  w: 4.6, h: 4.6 },
      { x: 14,  y: 3.4, z: 36,  w: 4.4, h: 4.4 },
      { x: 30,  y: 4.0, z: 30,  w: 4.2, h: 4.2 },
      { x: 36,  y: 4.6, z: 12,  w: 4.2, h: 4.2 },
      { x: 28,  y: 4.2, z: -8,  w: 4.4, h: 4.4 },
      { x: 8,   y: 3.6, z: -18, w: 4.4, h: 4.4 },
      { x: -10, y: 3.0, z: -14, w: 4.6, h: 4.6 },
      { x: -12, y: 2.6, z: 4,   w: 4.8, h: 4.8 },
    ],
  },
  {
    id: "skyline",
    name: "Skyline Sprint",
    sub: "Sharper turns, real elevation",
    spawn: { x: 0, y: 3.0, z: -10, yaw: 0 },
    sky: { top: 0x041030, mid: 0x143460, horizon: 0xff8a2a, ground: 0x010614, horBand: 0xffd166 },
    fog: { color: 0x081224, density: 0.0070 },
    waypoints: [
      { x: 0,   y: 2.5, z: 0,    w: 4.6, h: 4.6 },
      { x: 0,   y: 6.0, z: 26,   w: 3.8, h: 3.8 }, // climb gate
      { x: 18,  y: 9.0, z: 40,   w: 3.6, h: 3.6 },
      { x: 38,  y: 12.0, z: 30,  w: 3.6, h: 3.6 },
      { x: 48,  y: 14.0, z: 8,   w: 3.4, h: 3.4 },
      { x: 38,  y: 9.0,  z: -14, w: 3.6, h: 3.6 }, // dive
      { x: 14,  y: 4.0,  z: -28, w: 3.8, h: 3.8 },
      { x: -16, y: 6.5,  z: -22, w: 3.8, h: 3.8 },
      { x: -28, y: 9.0,  z: 0,   w: 3.6, h: 3.6 },
      { x: -20, y: 6.0,  z: 22,  w: 3.8, h: 3.8 },
      { x: -4,  y: 3.2,  z: 10,  w: 4.0, h: 4.0 },
    ],
  },
  {
    id: "inferno",
    name: "Inferno Loop",
    sub: "Vertical loops · tight slalom",
    spawn: { x: 0, y: 3.0, z: -12, yaw: 0 },
    sky: { top: 0x180408, mid: 0x401020, horizon: 0xff3a4a, ground: 0x100204, horBand: 0xff8a2a },
    fog: { color: 0x12060a, density: 0.0090 },
    waypoints: [
      { x: 0,    y: 2.5, z: 0,    w: 4.0, h: 4.0 }, // start
      { x: 0,    y: 4.0, z: 20,   w: 3.4, h: 3.4 },
      { x: 0,    y: 12.0, z: 30,  w: 3.0, h: 3.0 }, // vertical loop apex
      { x: 0,    y: 20.0, z: 22,  w: 3.0, h: 3.0 },
      { x: 0,    y: 18.0, z: 6,   w: 3.0, h: 3.0 },
      { x: 0,    y: 8.0,  z: -2,  w: 3.0, h: 3.0 }, // close the loop
      { x: 18,   y: 4.5,  z: -10, w: 3.2, h: 3.2 }, // slalom out
      { x: 30,   y: 4.0,  z: 8,   w: 3.0, h: 3.0 },
      { x: 22,   y: 4.5,  z: 28,  w: 3.0, h: 3.0 },
      { x: 0,    y: 5.0,  z: 38,  w: 3.0, h: 3.0 },
      { x: -22,  y: 4.5,  z: 28,  w: 3.0, h: 3.0 },
      { x: -30,  y: 4.0,  z: 8,   w: 3.0, h: 3.0 },
      { x: -18,  y: 4.5,  z: -10, w: 3.2, h: 3.2 },
    ],
  },
];

function buildTrackFromWaypoints(waypoints) {
  // Gate orientation = average of incoming and outgoing tangents at the
  // waypoint, so a smooth racing line passes perpendicular to the gate plane.
  // This correctly handles vertical-loop apex points where the racing line
  // is going straight up.
  const N = waypoints.length;
  const _in = new THREE.Vector3();
  const _out = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const wp = waypoints[i];
    const prev = waypoints[(i - 1 + N) % N];
    const nxt = waypoints[(i + 1) % N];
    _in.set(wp.x - prev.x, wp.y - prev.y, wp.z - prev.z).normalize();
    _out.set(nxt.x - wp.x, nxt.y - wp.y, nxt.z - wp.z).normalize();
    const fwd = new THREE.Vector3().addVectors(_in, _out).normalize();
    const label = String(i).padStart(2, "0");
    makeGate({ ...wp, fwd, label });
  }
  // Decorative ground pylon at every other waypoint (skipped if waypoint is
  // high in the air — no pylon hanging in the sky).
  for (let i = 0; i < N; i += 2) {
    const wp = waypoints[i];
    if (wp.y > 8) continue;
    const pylonGeo = new THREE.ConeGeometry(0.18, 0.5, 8);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff5500,
      emissiveIntensity: 0.6,
    });
    const p = new THREE.Mesh(pylonGeo, pylonMat);
    p.position.set(wp.x + 5, 0.25, wp.z + 5);
    trackGroup.add(p);
  }
}

function applyTrackTheme(t) {
  skyMat.uniforms.uTop.value.setHex(t.sky.top);
  skyMat.uniforms.uMid.value.setHex(t.sky.mid);
  skyMat.uniforms.uHorizon.value.setHex(t.sky.horizon);
  skyMat.uniforms.uGround.value.setHex(t.sky.ground);
  skyMat.uniforms.uHorBand.value.setHex(t.sky.horBand);
  scene.fog.color.setHex(t.fog.color);
  scene.fog.density = t.fog.density;
  scene.background.setHex(t.fog.color);
}

// =====================================================================
// Drone physics state
// =====================================================================

const droneState = {
  pos: new THREE.Vector3(0, 2.5, -10),
  vel: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  bodyRates: new THREE.Vector3(),  // (pitch, yaw, roll) in body frame
  prevPos: new THREE.Vector3(),
};

const droneEulerTmp = new THREE.Euler();

function resetDroneTo(pos, yaw) {
  droneState.pos.copy(pos);
  droneState.prevPos.copy(pos);
  droneState.vel.set(0, 0, 0);
  droneState.quat.setFromEuler(new THREE.Euler(0, yaw, 0));
  droneState.bodyRates.set(0, 0, 0);
  inputs.throttle = HOVER_THROTTLE; // start at hover
}

// =====================================================================
// Input
// =====================================================================

const keys = Object.create(null);
const inputs = {
  throttle: HOVER_THROTTLE, // 0..1
  yaw: 0,    // -1..1  (positive = body +Y rotation = yaw LEFT)
  pitch: 0,  // -1..1  (positive = body +X rotation = nose DOWN)
  roll: 0,   // -1..1  (positive = body +Z rotation = roll RIGHT)
  // Mobile virtual sticks (raw [-1..1] from joysticks)
  touchLeftX: 0,
  touchLeftY: 0,
  touchRightX: 0,
  touchRightY: 0,
  punch: false,
};

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === "KeyC") toggleCamera();
  if (e.code === "KeyR") {
    if (runActive) resetToLastGate();
  }
  if (e.code === "Escape") pause();
  if (e.code === "Space") {
    inputs.punch = true;
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  delete keys[e.code];
  if (e.code === "Space") inputs.punch = false;
});

const TOUCH_MODE = matchMedia("(pointer: coarse)").matches;

// Signs are chosen so that the input value IS the body-frame rotation
// command the physics step applies directly (no extra inversions later):
//   inputs.pitch  positive  →  +X body rotation  →  nose DOWN
//   inputs.yaw    positive  →  +Y body rotation  →  yaw LEFT
//   inputs.roll   positive  →  +Z body rotation  →  roll RIGHT (right wing down)
// The keyboard / touch mappings flip signs so each control feels natural
// at the stick layer.
function readInputs(dt) {
  if (TOUCH_MODE) {
    // Mode 2 sticks: left = throttle (Y) + yaw (X), right = pitch (Y) + roll (X).
    // touchLeftY in [-1..1]: stick UP = -1, DOWN = +1.
    inputs.throttle = THREE.MathUtils.clamp(0.5 - inputs.touchLeftY * 0.5, 0, 1);
    // Joystick X positive = stick RIGHT → yaw RIGHT → -Y rotation
    inputs.yaw   = -inputs.touchLeftX;
    // Right joy Y negative = stick FORWARD = nose DOWN = +X rotation
    inputs.pitch = -inputs.touchRightY;
    // Right joy X positive = stick RIGHT = roll RIGHT = +Z rotation
    inputs.roll  =  inputs.touchRightX;
    return;
  }

  // Keyboard
  if (keys["KeyW"]) inputs.throttle = Math.min(1, inputs.throttle + THROTTLE_RAMP * dt);
  if (keys["KeyS"]) inputs.throttle = Math.max(0, inputs.throttle - THROTTLE_RAMP * dt);
  if (inputs.punch) inputs.throttle = 1.0;

  let yaw = 0, pitch = 0, roll = 0;
  if (keys["KeyA"])       yaw   += 1; // A = yaw LEFT  = +Y rotation
  if (keys["KeyD"])       yaw   -= 1; // D = yaw RIGHT = -Y rotation
  if (keys["ArrowUp"])    pitch += 1; // ↑ = stick forward = nose DOWN = +X rotation
  if (keys["ArrowDown"])  pitch -= 1; // ↓ = stick back    = nose UP   = -X rotation
  if (keys["ArrowLeft"])  roll  -= 1; // ← = roll LEFT  = -Z rotation
  if (keys["ArrowRight"]) roll  += 1; // → = roll RIGHT = +Z rotation
  inputs.yaw = yaw;
  inputs.pitch = pitch;
  inputs.roll = roll;
}

// ---- Touch joysticks --------------------------------------------------
function setupJoystick(el, knob, onChange) {
  let activeId = null;
  let cx = 0, cy = 0;
  const radius = 64; // px from center until clamp

  function updateFromTouch(t) {
    let dx = t.clientX - cx;
    let dy = t.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    onChange(dx / radius, dy / radius);
  }

  el.addEventListener("touchstart", (e) => {
    if (activeId !== null) return;
    const t = e.changedTouches[0];
    const rect = el.getBoundingClientRect();
    cx = rect.left + rect.width / 2;
    cy = rect.top + rect.height / 2;
    activeId = t.identifier;
    updateFromTouch(t);
    e.preventDefault();
  }, { passive: false });

  el.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === activeId) {
        updateFromTouch(t);
        e.preventDefault();
        break;
      }
    }
  }, { passive: false });

  function end(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === activeId) {
        activeId = null;
        knob.style.transform = "";
        onChange(0, 0);
        break;
      }
    }
  }
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
}

setupJoystick(joyLeftEl, joyLeftKnob, (x, y) => {
  inputs.touchLeftX = x;
  inputs.touchLeftY = y;
});
setupJoystick(joyRightEl, joyRightKnob, (x, y) => {
  inputs.touchRightX = x;
  inputs.touchRightY = y;
});

camBtn?.addEventListener("click", (e) => { e.stopPropagation(); toggleCamera(); });
resetBtn?.addEventListener("click", (e) => { e.stopPropagation(); if (runActive) resetToLastGate(); });

// =====================================================================
// Physics (substepped)
// =====================================================================

const PHYS_HZ = 200;
const PHYS_DT = 1 / PHYS_HZ;
let physAccum = 0;

const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();
const tmpVec3 = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const upBody = new THREE.Vector3(0, 1, 0);
const fwdBody = new THREE.Vector3(0, 0, 1);

function expo(v) {
  // Standard FPV expo: blend linear & cubic
  const sign = Math.sign(v);
  const a = Math.abs(v);
  return sign * ((1 - STICK_EXPO) * a + STICK_EXPO * a * a * a);
}

function physicsStep(dt) {
  if (!runActive || runFinished || countdownActive || paused) return;

  // Target body rates from sticks
  const targetPitchRate = expo(inputs.pitch) * MAX_PITCH_RATE;
  const targetYawRate   = expo(inputs.yaw)   * MAX_YAW_RATE;
  const targetRollRate  = expo(inputs.roll)  * MAX_ROLL_RATE;

  // Smooth rate convergence (exp toward target)
  const k = 1 - Math.exp(-RATE_RESPONSE * dt);
  droneState.bodyRates.x += (targetPitchRate - droneState.bodyRates.x) * k;
  droneState.bodyRates.y += (targetYawRate   - droneState.bodyRates.y) * k;
  droneState.bodyRates.z += (targetRollRate  - droneState.bodyRates.z) * k;

  // Integrate quaternion by body rates.
  // q_dot = 0.5 * q * (omega_x i + omega_y j + omega_z k)
  // We construct a small rotation quaternion and multiply (body-frame intrinsic).
  const wx = droneState.bodyRates.x * dt;
  const wy = droneState.bodyRates.y * dt;
  const wz = droneState.bodyRates.z * dt;
  // Build delta quat from axis-angle approx (small-angle: q ≈ (1, wx/2, wy/2, wz/2))
  // For correctness, build from axis-angle of magnitude |w|.
  const wMag = Math.hypot(wx, wy, wz);
  if (wMag > 1e-7) {
    const half = wMag * 0.5;
    const s = Math.sin(half) / wMag;
    tmpQuat.set(wx * s, wy * s, wz * s, Math.cos(half));
    droneState.quat.multiply(tmpQuat);
    droneState.quat.normalize();
  }

  // Thrust along drone's local +Y in world frame
  const upWorld = tmpVec.copy(upBody).applyQuaternion(droneState.quat);
  const thrust = inputs.throttle * MAX_THRUST;
  // Accelerations
  const ax = upWorld.x * thrust;
  const ay = upWorld.y * thrust - GRAVITY;
  const az = upWorld.z * thrust;

  droneState.vel.x += ax * dt;
  droneState.vel.y += ay * dt;
  droneState.vel.z += az * dt;

  // Air drag — exponential decay; vertical gets a little extra
  const dragFac = Math.exp(-DRAG_LINEAR * dt);
  droneState.vel.x *= dragFac;
  droneState.vel.z *= dragFac;
  droneState.vel.y *= Math.exp(-(DRAG_LINEAR + DRAG_VERT_BIAS) * dt);

  // Previous position (for gate plane crossing)
  droneState.prevPos.copy(droneState.pos);

  // Integrate position
  droneState.pos.x += droneState.vel.x * dt;
  droneState.pos.y += droneState.vel.y * dt;
  droneState.pos.z += droneState.vel.z * dt;

  // Ground collision — soft bounce + speed loss; hard crash if too fast.
  if (droneState.pos.y < GROUND_Y + 0.08) {
    const vDown = -droneState.vel.y;
    if (vDown > 9) {
      crash("ground");
      return;
    }
    droneState.pos.y = GROUND_Y + 0.08;
    droneState.vel.y = Math.max(0, droneState.vel.y) * 0.2; // small bounce
    droneState.vel.x *= 0.7;
    droneState.vel.z *= 0.7;
  }

  // World bounds
  const horiz = Math.hypot(droneState.pos.x, droneState.pos.z);
  if (horiz > WORLD_KILL_RADIUS || droneState.pos.y < WORLD_KILL_Y) {
    crash("bounds");
    return;
  }

  // Gate plane crossing
  if (gates.length > 0) {
    const g = gates[nextGateIdx];
    // Convert prev/current pos to gate local frame
    const localPrev = tmpVec.copy(droneState.prevPos).sub(g.pos).applyQuaternion(g.invQuat);
    const localCurr = tmpVec2.copy(droneState.pos).sub(g.pos).applyQuaternion(g.invQuat);
    if (localPrev.z < 0 && localCurr.z >= 0) {
      // Plane crossed in correct direction. Interpolate crossing point.
      const t = -localPrev.z / (localCurr.z - localPrev.z || 1e-6);
      const px = localPrev.x + (localCurr.x - localPrev.x) * t;
      const py = localPrev.y + (localCurr.y - localPrev.y) * t;
      if (Math.abs(px) < g.halfW && Math.abs(py) < g.halfH) {
        onGatePassed();
      }
      // Outside the opening but within frame bounds → "frame brush" effect.
      else if (
        Math.abs(px) < g.halfW + GATE_FRAME * 2 &&
        Math.abs(py) < g.halfH + GATE_FRAME * 2
      ) {
        // Minor smack — not fatal.
        droneState.vel.multiplyScalar(0.6);
        bumpFlash();
        flashToast("Frame clip!", 700, "crash");
      }
    }
  }

  // Tick lap / total timers (only after pilot crosses the start gate)
  if (racingStarted) {
    lapElapsed += dt;
    totalElapsed += dt;
  }
}

function onGatePassed() {
  const passedIdx = nextGateIdx;
  setGateState(gates[passedIdx], "passed");

  nextGateIdx = (nextGateIdx + 1) % gates.length;

  // Crossing gate 0 is either the race start (first time) or the end of a lap.
  if (passedIdx === 0) {
    if (!racingStarted) {
      racingStarted = true;
      lapElapsed = 0;
      flashToast("Lap 1 — go!", 900, "lap");
    } else {
      lapTimes[lap - 1] = lapElapsed;
      flashToast(`Lap ${lap}: ${formatTime(lapElapsed)}`, 1500, "lap");
      updateSplitsHud();
      if (lap >= TOTAL_LAPS) {
        finishRun();
        return;
      }
      lap++;
      lapElapsed = 0;
      lapTextEl.textContent = `LAP ${lap} / ${TOTAL_LAPS}`;
    }
  } else {
    flashToast(`Gate ${passedIdx + 1}`, 500);
  }
  refreshGateStates();
  updateGateHud();
}

function crash(reason) {
  if (!runActive || runFinished) return;
  crashFlashEl.classList.add("on");
  setTimeout(() => crashFlashEl.classList.remove("on"), 220);
  flashToast(reason === "ground" ? "Crash!" : "Out of bounds", 900, "crash");
  resetToLastGate();
}

function resetToLastGate() {
  // Spawn just before the next-gate target, oriented along its approach.
  const target = gates[nextGateIdx] || gates[0];
  const cur = (nextGateIdx - 1 + gates.length) % gates.length;
  const from = gates[cur] || gates[gates.length - 1];
  if (!target || !from) return;
  // Spawn on the line halfway from `from` to `target`, 0.5m back from target.
  tmpVec.copy(target.pos).sub(from.pos).normalize();
  const spawn = tmpVec2.copy(target.pos).addScaledVector(tmpVec, -3.0);
  spawn.y = Math.max(GROUND_Y + 1.5, spawn.y);
  // Face the direction of the approach (yaw)
  const yaw = Math.atan2(tmpVec.x, tmpVec.z);
  resetDroneTo(spawn, yaw);
  bumpFlash();
}

function bumpFlash() {
  crashFlashEl.classList.add("on");
  setTimeout(() => crashFlashEl.classList.remove("on"), 140);
}

// =====================================================================
// Camera modes (FPV / chase)
// =====================================================================

let cameraMode = "fpv"; // "fpv" | "chase"
const fpvOverlayEl = document.getElementById("fpv-overlay");
const chasePos = new THREE.Vector3();
const fpvOffset = new THREE.Vector3(0, 0.08, 0.18);
const camShakeOffset = new THREE.Vector3();
const camLookTarget = new THREE.Vector3();
const camLookDir = new THREE.Vector3();
const camUpDir = new THREE.Vector3();

function toggleCamera() {
  cameraMode = cameraMode === "fpv" ? "chase" : "fpv";
  camLabelEl.textContent = cameraMode === "fpv" ? "FPV" : "CHASE";
  document.body.classList.toggle("chase-cam", cameraMode === "chase");
  camera.fov = cameraMode === "fpv" ? 105 : 75;
  camera.updateProjectionMatrix();
}

function updateCamera(dt) {
  // Camera shake from throttle + speed (subtle)
  const sp = droneState.vel.length();
  const shakeAmt = CAM_SHAKE_BASE * (inputs.throttle + sp * 0.012);
  camShakeOffset.set(
    (Math.random() - 0.5) * shakeAmt,
    (Math.random() - 0.5) * shakeAmt,
    (Math.random() - 0.5) * shakeAmt,
  );

  if (cameraMode === "fpv") {
    // Position: FPV cam mount on drone (slightly above + forward of center)
    tmpVec.copy(fpvOffset).applyQuaternion(droneState.quat).add(droneState.pos);
    camera.position.copy(tmpVec).add(camShakeOffset);
    // Look direction = drone forward (+Z body) pitched up by FPV_CAM_TILT
    // around the drone's local X axis. Build in body frame, then rotate.
    camLookDir.set(0, Math.sin(FPV_CAM_TILT), Math.cos(FPV_CAM_TILT))
      .applyQuaternion(droneState.quat);
    // Up vector = body +Y also rotated by the same tilt around body +X
    camUpDir.set(0, Math.cos(FPV_CAM_TILT), -Math.sin(FPV_CAM_TILT))
      .applyQuaternion(droneState.quat);
    camera.up.copy(camUpDir);
    camLookTarget.copy(camera.position).add(camLookDir);
    camera.lookAt(camLookTarget);
  } else {
    // Chase cam: behind & above the drone, smoothed, looks at drone
    const backBody = tmpVec.set(0, 0.55, -CHASE_DIST).applyQuaternion(droneState.quat);
    // Damp the "yaw" of the chase position so it doesn't whip when drone yaws
    const desired = tmpVec2.copy(droneState.pos).add(backBody);
    desired.y = Math.max(desired.y, GROUND_Y + 0.6);
    const k = 1 - Math.exp(-CHASE_LERP * dt);
    chasePos.lerp(desired, k);
    camera.position.copy(chasePos).add(camShakeOffset);
    camera.up.set(0, 1, 0);
    tmpVec3.copy(droneState.pos);
    tmpVec3.y += 0.25;
    camera.lookAt(tmpVec3);
  }
}

// =====================================================================
// Audio — synthesized prop sound
// =====================================================================

let audioCtx = null;
let audio = null;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const master = audioCtx.createGain();
    master.gain.value = 0.0;
    master.connect(audioCtx.destination);

    // Low rumble
    const osc1 = audioCtx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.value = 60;
    const lpf = audioCtx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 600;
    osc1.connect(lpf).connect(master);
    osc1.start();

    // High whine
    const osc2 = audioCtx.createOscillator();
    osc2.type = "sawtooth";
    osc2.frequency.value = 200;
    const hpf = audioCtx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 100;
    osc2.connect(hpf).connect(master);
    osc2.start();

    // Wind noise from buffered noise source
    const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseFilt = audioCtx.createBiquadFilter();
    noiseFilt.type = "bandpass";
    noiseFilt.frequency.value = 1200;
    noiseFilt.Q.value = 0.6;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseFilt).connect(noiseGain).connect(master);
    noise.start();

    audio = { master, osc1, osc2, noiseGain };
  } catch (e) {
    audio = null;
  }
}

function updateAudio() {
  if (!audio || !audioCtx) return;
  const t = inputs.throttle;
  const sp = droneState.vel.length();
  const f1 = 60 + t * 220;
  const f2 = 180 + t * 540 + sp * 4;
  audio.osc1.frequency.setTargetAtTime(f1, audioCtx.currentTime, 0.04);
  audio.osc2.frequency.setTargetAtTime(f2, audioCtx.currentTime, 0.04);
  const masterGain = runActive ? (0.045 * (0.15 + t * 0.95)) : 0;
  audio.master.gain.setTargetAtTime(masterGain, audioCtx.currentTime, 0.08);
  audio.noiseGain.gain.setTargetAtTime(Math.min(0.04, sp * 0.0015), audioCtx.currentTime, 0.08);
}

// =====================================================================
// HUD — attitude indicator, throttle bar, readouts
// =====================================================================

function drawAttitude() {
  // Extract roll & pitch from quaternion
  droneEulerTmp.setFromQuaternion(droneState.quat, "ZYX");
  const roll = droneEulerTmp.z;
  const pitch = droneEulerTmp.x;

  const c = attitudeCtx;
  const W = attitudeCanvas.width;
  const H = attitudeCanvas.height;
  c.clearRect(0, 0, W, H);

  // Outer ring
  c.save();
  c.translate(W / 2, H / 2);

  // Rotate by roll
  c.save();
  c.rotate(-roll);

  // Sky / ground halves, offset by pitch (pitch in radians → pixels)
  const pitchPx = pitch * (H * 0.55); // sensitivity
  c.fillStyle = "#1a1c3a";
  c.fillRect(-W, -H, 2 * W, H + pitchPx);
  c.fillStyle = "#3a1518";
  c.fillRect(-W, pitchPx, 2 * W, 2 * H);

  // Horizon line
  c.strokeStyle = "#7df9ff";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-W, pitchPx);
  c.lineTo(W, pitchPx);
  c.stroke();

  // Pitch ladder ticks
  c.strokeStyle = "rgba(125,249,255,0.55)";
  c.fillStyle = "rgba(125,249,255,0.7)";
  c.font = "9px ui-monospace, monospace";
  c.lineWidth = 1;
  for (let i = -90; i <= 90; i += 15) {
    if (i === 0) continue;
    const y = pitchPx + (i / 60) * (H * 0.55);
    const w = i % 30 === 0 ? 22 : 12;
    c.beginPath();
    c.moveTo(-w, y);
    c.lineTo(w, y);
    c.stroke();
  }
  c.restore();

  // Center aircraft marker
  c.strokeStyle = "#ffd700";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-18, 0);
  c.lineTo(-6, 0);
  c.moveTo(6, 0);
  c.lineTo(18, 0);
  c.moveTo(0, -2);
  c.lineTo(0, 4);
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 2, 0, Math.PI * 2);
  c.fillStyle = "#ffd700";
  c.fill();

  // Compass tick (yaw) at top — show heading needle
  droneEulerTmp.setFromQuaternion(droneState.quat, "YXZ");
  const yaw = droneEulerTmp.y;
  c.save();
  c.rotate(-yaw);
  c.strokeStyle = "#00fff2";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, -H / 2 + 6);
  c.lineTo(0, -H / 2 + 16);
  c.stroke();
  c.restore();

  c.restore();
}

function updateHud(dt) {
  // Throttle bar
  throttleFillEl.style.height = `${inputs.throttle * 100}%`;
  // Speed (km/h) — vel magnitude * 3.6
  const sp = droneState.vel.length();
  speedEl.textContent = String(Math.round(sp * 3.6));
  // Altitude
  altEl.textContent = (droneState.pos.y - GROUND_Y).toFixed(1);
  // Gate progress
  if (gates.length > 0) {
    const g = nextGateIdx + 1;
    gateEl.textContent = `${g} / ${gates.length}`;
  }
  // Lap timer
  if (runActive && !runFinished && !countdownActive) {
    lapTimerEl.textContent = formatTime(lapElapsed);
  }
  drawAttitude();
  updateGateArrow();
}

const arrowInvQuat = new THREE.Quaternion();
function updateGateArrow() {
  if (!runActive || runFinished || countdownActive || gates.length === 0) {
    gateArrowEl.classList.remove("show");
    return;
  }
  const g = gates[nextGateIdx];
  // Gate position in camera local frame
  tmpVec.copy(g.pos).sub(camera.position);
  arrowInvQuat.copy(camera.quaternion).invert();
  tmpVec.applyQuaternion(arrowInvQuat);
  // Camera looks down its local -Z. So "in front" means local z < 0.
  const isInFront = tmpVec.z < -0.05;
  // Project gate to NDC for on-screen check (only meaningful if in front)
  tmpVec2.copy(g.pos).project(camera);
  const onScreen = isInFront &&
    Math.abs(tmpVec2.x) < 0.85 &&
    Math.abs(tmpVec2.y) < 0.85;
  if (onScreen) {
    gateArrowEl.classList.remove("show");
    return;
  }
  gateArrowEl.classList.add("show");
  const screenX = window.innerWidth / 2;
  const screenY = window.innerHeight / 2;
  // Angle from camera's "forward" (camera-local -Z) toward gate in screen plane.
  let edgeAngle = Math.atan2(tmpVec.x, -tmpVec.z);
  if (!isInFront) {
    edgeAngle = tmpVec.x >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
  }
  const r = Math.min(window.innerWidth, window.innerHeight) * 0.32;
  // Also factor in vertical offset so the arrow points up/down when gate is above/below
  const verticalAngle = Math.atan2(tmpVec.y, -tmpVec.z);
  const px = screenX + Math.sin(edgeAngle) * r;
  const py = screenY - Math.sin(verticalAngle) * r * 0.65;
  gateArrowEl.style.left = `${px}px`;
  gateArrowEl.style.top = `${py}px`;
  gateArrowEl.style.transform = `translate(-50%, -50%) rotate(${edgeAngle}rad)`;
}

function updateSplitsHud() {
  const parts = lapTimes.map((t, i) => `L${i + 1} <b>${t > 0 ? formatTime(t) : "—"}</b>`);
  lapSplitsEl.innerHTML = parts.join(" · ");
}

function updateGateHud() {
  if (gates.length > 0) gateEl.textContent = `${nextGateIdx + 1} / ${gates.length}`;
}

// =====================================================================
// Run management
// =====================================================================

let runActive = false;
let runFinished = false;
let countdownActive = false;
let paused = false;
let racingStarted = false;
let currentTrackIdx = 0;

function startRun() {
  if (runActive) return;
  initAudio();
  audioCtx?.resume?.();
  runActive = true;
  runFinished = false;
  countdownActive = true;
  racingStarted = false;
  paused = false;
  lap = 1;
  lapElapsed = 0;
  totalElapsed = 0;
  lapTimes[0] = lapTimes[1] = lapTimes[2] = 0;
  nextGateIdx = 0;
  refreshGateStates();
  updateSplitsHud();
  lapTextEl.textContent = `LAP 1 / ${TOTAL_LAPS}`;
  lapTimerEl.textContent = "0.00";

  spawnAtGate0();
  // Seed chase cam so it doesn't lerp from a previous run's position
  const backBody = tmpVec.set(0, 0.55, -CHASE_DIST).applyQuaternion(droneState.quat);
  chasePos.copy(droneState.pos).add(backBody);

  blocker.style.display = "none";
  finishEl.classList.remove("show");
  document.body.classList.add("locked");

  runCountdown();
}

function runCountdown() {
  let n = COUNTDOWN_SECS;
  countdownEl.textContent = String(n);
  countdownEl.classList.add("show");
  const tick = () => {
    setTimeout(() => {
      n--;
      if (n > 0) {
        countdownEl.textContent = String(n);
        tick();
      } else {
        countdownEl.textContent = "GO!";
        setTimeout(() => {
          countdownEl.classList.remove("show");
          countdownActive = false;
          lapElapsed = 0;
          totalElapsed = 0;
        }, 600);
      }
    }, 800);
  };
  tick();
}

function pause() {
  if (!runActive) return;
  paused = !paused;
  if (paused) {
    blocker.style.display = "flex";
    document.body.classList.remove("locked");
  } else {
    blocker.style.display = "none";
    document.body.classList.add("locked");
  }
}

function finishRun() {
  if (runFinished) return;
  runFinished = true;
  runActive = false;
  document.body.classList.remove("locked");

  // Total time = sum of laps
  const total = lapTimes.reduce((a, b) => a + b, 0);

  const slug = trackSlug(currentTrackIdx);
  let board = [];
  if (window.ArcadeScores) {
    board = window.ArcadeScores.record(slug, total, { lowerIsBetter: true });
  }
  // Bonus tokens scaled by speed + difficulty
  let bonus = 0;
  if (window.ArcadeTokens) {
    const tier = 1 + currentTrackIdx * 0.45;
    const synth = Math.max(
      100,
      Math.floor((1300 - total * 12 + currentTrackIdx * 200) * tier),
    );
    bonus = window.ArcadeTokens.earnFromGameScore(slug + "-finish", synth);
  }

  unlockUpTo(currentTrackIdx + 1);

  finishTimeEl.textContent = formatTime(total);
  finishSplitsEl.innerHTML = lapTimes
    .map((t, i) => `<div><b>L${i + 1}</b>${formatTime(t)}</div>`)
    .join("");

  const best = board[0]?.score ?? total;
  const isBest = Math.abs(best - total) < 0.005;
  const hasNext = currentTrackIdx + 1 < TRACKS.length;
  let unlockedLine = "";
  if (hasNext) {
    unlockedLine = `<br><span style="color:#7df9ff">Next: ${TRACKS[currentTrackIdx + 1].name}</span>`;
  } else {
    unlockedLine = `<br><span style="color:#ffe066">All tracks cleared!</span>`;
  }
  finishStatsEl.innerHTML = `
    <b>${TRACKS[currentTrackIdx].name}</b> · Tokens <b>+${bonus}</b>
    ${isBest ? "<br>New personal best!" : `<br>Best <b>${formatTime(best)}</b>`}
    ${unlockedLine}
  `;
  finishLbEl.innerHTML = "";
  board.slice(0, 5).forEach((row, i) => {
    const li = document.createElement("li");
    const d = new Date(row.at);
    const when = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    li.textContent = `${i + 1}. ${formatTime(row.score)} · ${when}`;
    finishLbEl.appendChild(li);
  });
  finishNextBtn.hidden = !hasNext;
  if (hasNext) finishNextBtn.textContent = `Next: ${TRACKS[currentTrackIdx + 1].name}`;
  finishEl.classList.add("show");
  refreshBestLine();
  renderLevelGrid();
}

// =====================================================================
// Level progress / leaderboards
// =====================================================================

const PROGRESS_KEY = "drone-progress-v1";

function trackSlug(idx) {
  return SLUG + "-T" + (idx + 1);
}

function readProgress() {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { unlocked: 0 };
    const o = JSON.parse(raw);
    const u = Math.max(0, Math.min(TRACKS.length - 1, parseInt(o.unlocked, 10) || 0));
    return { unlocked: u };
  } catch {
    return { unlocked: 0 };
  }
}

function writeProgress(p) {
  try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* */ }
}

function unlockUpTo(idx) {
  const p = readProgress();
  if (idx > p.unlocked) {
    p.unlocked = Math.min(TRACKS.length - 1, idx);
    writeProgress(p);
  }
}

function bestTimeFor(idx) {
  if (!window.ArcadeScores) return null;
  const list = window.ArcadeScores.list(trackSlug(idx), true);
  return list[0]?.score ?? null;
}

function refreshBestLine() {
  if (!window.ArcadeScores) {
    bestLineEl.textContent = "";
    bestReadoutEl.textContent = "BEST —";
    return;
  }
  const list = window.ArcadeScores.list(trackSlug(currentTrackIdx), true);
  if (list.length) {
    bestLineEl.textContent = `BEST ${formatTime(list[0].score)} · RUNS ${list.length}`;
    bestReadoutEl.textContent = `BEST ${formatTime(list[0].score)}`;
  } else {
    bestLineEl.textContent = "FIRST RUN — SET A TIME";
    bestReadoutEl.textContent = "BEST —";
  }
}

function renderLevelGrid() {
  const unlocked = readProgress().unlocked;
  levelGridEl.innerHTML = "";
  TRACKS.forEach((t, i) => {
    const isUnlocked = i <= unlocked;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level-btn" + (i === currentTrackIdx ? " active" : "");
    btn.disabled = !isUnlocked;
    const best = bestTimeFor(i);
    const bestStr = isUnlocked
      ? (best != null ? formatTime(best) : "— ·")
      : "Locked";
    btn.innerHTML = `
      <div class="num">T${i + 1}</div>
      <div class="name">${t.name}</div>
      <div class="best">${bestStr}</div>
    `;
    btn.title = t.sub || "";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!isUnlocked) return;
      loadTrack(i);
    });
    levelGridEl.appendChild(btn);
  });
}

// Spawn the drone 8m behind gate 0 along its actual approach line,
// facing the gate. Doing this after the track is built guarantees the
// spawn lines up with the (dynamically computed) gate orientation, so
// the pilot is always pointed straight at the start line.
function spawnAtGate0() {
  if (!gates.length) return;
  const g0 = gates[0];
  const fwd = g0.dirWorld; // points along racing line at gate 0
  const spawn = new THREE.Vector3(
    g0.pos.x - fwd.x * 8,
    g0.pos.y - fwd.y * 8 + 0.3, // a hair above the line
    g0.pos.z - fwd.z * 8,
  );
  spawn.y = Math.max(GROUND_Y + 1.5, spawn.y);
  const yaw = Math.atan2(fwd.x, fwd.z);
  resetDroneTo(spawn, yaw);
}

function loadTrack(idx) {
  currentTrackIdx = idx;
  clearTrack();
  const t = TRACKS[idx];
  applyTrackTheme(t);
  buildTrackFromWaypoints(t.waypoints);
  nextGateIdx = 0;
  refreshGateStates();
  spawnAtGate0();
  lap = 1;
  lapElapsed = 0;
  totalElapsed = 0;
  lapTimes[0] = lapTimes[1] = lapTimes[2] = 0;
  updateSplitsHud();
  updateGateHud();
  refreshBestLine();
  renderLevelGrid();
  lapTextEl.textContent = `LAP 1 / ${TOTAL_LAPS}`;
  lapTimerEl.textContent = "0.00";
  // Seed chase camera so it starts behind the drone
  const backBody = tmpVec.set(0, 0.55, -CHASE_DIST).applyQuaternion(droneState.quat);
  chasePos.copy(droneState.pos).add(backBody);
}

// =====================================================================
// Utilities
// =====================================================================

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = (t - m * 60);
  if (m > 0) return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  return s.toFixed(2);
}

let toastTimer = 0;
function flashToast(text, ms = 1200, kind = "") {
  toastEl.textContent = text;
  toastEl.className = "";
  if (kind) toastEl.classList.add(kind);
  toastEl.classList.add("show");
  toastTimer = ms / 1000;
}

// =====================================================================
// Boot + main loop
// =====================================================================

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", onResize);
onResize();

blocker.addEventListener("click", (e) => {
  if (e.target.closest(".level-btn")) return;
  if (paused) {
    pause(); // unpause
    return;
  }
  startRun();
});
finishRetryBtn.addEventListener("click", () => {
  loadTrack(currentTrackIdx);
  startRun();
});
finishNextBtn.addEventListener("click", () => {
  const next = currentTrackIdx + 1;
  if (next >= TRACKS.length) return;
  loadTrack(next);
  startRun();
});

// Initial track
loadTrack(0);

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);

  if (runActive && !paused) {
    readInputs(dt);
  }

  // Substepped physics
  physAccum += dt;
  let safety = 8;
  while (physAccum >= PHYS_DT && safety-- > 0) {
    physicsStep(PHYS_DT);
    physAccum -= PHYS_DT;
  }

  // Visuals: drone transform
  droneGroup.position.copy(droneState.pos);
  droneGroup.quaternion.copy(droneState.quat);

  // Propeller spin proportional to throttle (and target rates for visual flair)
  const propSpeed = 90 + inputs.throttle * 280; // rad/s visual
  for (const p of propMeshes) {
    p.angle += p.dir * propSpeed * dt;
    p.prop.rotation.y = p.angle;
    // Hide blades when spinning fast (use alpha disc instead)
    const fast = inputs.throttle > 0.25;
    p.blade1.visible = !fast;
    p.blade2.visible = !fast;
    p.disc.material.opacity = fast ? 0.18 : 0.04;
  }
  // LED pulse
  const pulse = 0.7 + Math.sin(performance.now() * 0.006) * 0.3;
  for (const led of ledStrips) {
    led.mesh.material.opacity = 0.55 + pulse * 0.35;
  }

  // Underglow color tracks next-gate state
  if (gates.length > 0) {
    const g = gates[nextGateIdx];
    if (g.state === "next") underglow.color.setHex(0xffd700);
    else underglow.color.setHex(0x00fff2);
  }

  // Trail emission (only when going fast / high throttle)
  if (runActive && inputs.throttle > 0.45) {
    // emit at a couple of motors
    for (let i = 0; i < propMeshes.length; i++) {
      const localPos = new THREE.Vector3();
      propMeshes[i].prop.getWorldPosition(localPos);
      trailColorBuf.setHex(i % 2 === 0 ? 0x00fff2 : 0xff2da3);
      emitTrail(localPos, trailColorBuf, 0.04);
    }
  }
  // Age trail
  for (let i = 0; i < TRAIL_MAX; i++) trailAge[i] += dt;

  // Gate pulse animation
  for (const g of gates) {
    if (g.state === "next") {
      g.pulse += dt * 3.0;
      const m = 0.9 + Math.sin(g.pulse) * 0.4;
      g.frameMat.emissiveIntensity = 1.2 + Math.max(0, m) * 0.6;
    }
  }

  // Ground shader time
  groundMat.uniforms.uTime.value += dt;

  updateCamera(dt);
  if (runActive) updateHud(dt);
  updateAudio();

  // Toast fade
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) toastEl.classList.remove("show");
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Initialize FPV/CHASE label and class
camLabelEl.textContent = "FPV";
document.body.classList.remove("chase-cam");
