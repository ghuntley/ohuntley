import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const EYE_HEIGHT = 1.55;
const GRAVITY = -32;
const GROUND_ACCEL = 42;
const AIR_ACCEL = 14;
const MAX_SPEED_GROUND = 9;
const MAX_SPEED_AIR = 6.5;
const JUMP_SPEED = 10.5;
const PLAYER_R = 0.36;
const HOOK_MAX_LENGTH = 42;
const HOOK_PULL = 22;
const HOOK_SWING_DAMP = 0.12;

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

function makeNeonMaterial(color, emissiveIntensity = 0.35) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    metalness: 0.2,
    roughness: 0.45,
  });
}

function playerAabb(camera, outMin, outMax) {
  outMin.set(camera.x - PLAYER_R, camera.y - EYE_HEIGHT, camera.z - PLAYER_R);
  outMax.set(camera.x + PLAYER_R, camera.y, camera.z + PLAYER_R);
}

function resolveAabbPenetration(camera, velocity, box) {
  const minP = tmpV;
  const maxP = tmpV2;
  playerAabb(camera, minP, maxP);
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
  return true;
}

function buildLevel(scene) {
  const colliders = [];
  const grappleMeshes = [];
  const group = new THREE.Group();
  scene.add(group);

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a1528,
    emissive: 0x220044,
    emissiveIntensity: 0.08,
    roughness: 0.85,
    metalness: 0.1,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.grapple = false;
  group.add(ground);

  function addBox(w, h, d, x, y, z, color, grapple) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeNeonMaterial(color, grapple ? 0.55 : 0.15));
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.grapple = !!grapple;
    group.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push(box);
    if (grapple) grappleMeshes.push(mesh);
    return mesh;
  }

  addBox(16, 2, 16, 0, 0, -18, 0x00fff2, false);
  addBox(3, 10, 24, -14, 0, 0, 0x00c8ff, true);
  addBox(3, 10, 24, 14, 0, 0, 0xff1493, true);
  addBox(24, 3, 3, 0, 0, -12, 0x7df9ff, true);
  addBox(4, 14, 4, -6, 0, 8, 0x00fff2, true);
  addBox(4, 10, 4, 6, 0, 10, 0xff66cc, true);
  addBox(8, 1.2, 8, 0, 12, 18, 0xffcc00, true);

  const goalMesh = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.4, 3),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.9,
      metalness: 0.5,
      roughness: 0.25,
    })
  );
  goalMesh.position.set(0, 12.6, 18);
  goalMesh.userData.grapple = false;
  goalMesh.userData.isGoal = true;
  group.add(goalMesh);
  colliders.push(new THREE.Box3().setFromObject(goalMesh));

  const ambient = new THREE.AmbientLight(0x6688cc, 0.25);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xaaccff, 0x220044, 0.55);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.45);
  dir.position.set(20, 40, 12);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 90;
  dir.shadow.camera.left = -35;
  dir.shadow.camera.right = 35;
  dir.shadow.camera.top = 35;
  dir.shadow.camera.bottom = -35;
  scene.add(dir);
  const pink = new THREE.PointLight(0xff1493, 0.8, 40);
  pink.position.set(-12, 8, 4);
  scene.add(pink);
  const cyan = new THREE.PointLight(0x00fff2, 0.75, 40);
  cyan.position.set(12, 8, 4);
  scene.add(cyan);

  return { colliders, grappleMeshes, goalMesh };
}

function main() {
  const canvas = document.getElementById("game-canvas");
  const blocker = document.getElementById("blocker");
  const hud = document.getElementById("hud");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06041a);
  scene.fog = new THREE.Fog(0x06041a, 28, 95);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.06, 200);
  camera.rotation.order = "YXZ";
  camera.position.set(0, EYE_HEIGHT + 0.02, 4);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const { colliders, grappleMeshes, goalMesh } = buildLevel(scene);

  const velocity = new THREE.Vector3();
  let grounded = false;

  let hookAnchor = null;
  let ropeRestLength = 0;
  const ropeGeom = new THREE.BufferGeometry();
  const ropePositions = new Float32Array(6);
  ropeGeom.setAttribute("position", new THREE.BufferAttribute(ropePositions, 3));
  const ropeLine = new THREE.Line(
    ropeGeom,
    new THREE.LineBasicMaterial({ color: 0x00fff2, transparent: true, opacity: 0.85 })
  );
  ropeLine.visible = false;
  scene.add(ropeLine);

  const controls = new PointerLockControls(camera, document.body);
  const raycaster = new THREE.Raycaster();
  raycaster.far = HOOK_MAX_LENGTH;

  const keys = new Set();
  let won = false;
  let pendingJump = false;

  document.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.code === "Escape") return;
    if (e.code === "Space" && !e.repeat) pendingJump = true;
    if (e.code === "KeyR") {
      releaseHook();
    }
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));

  document.addEventListener("mousedown", (e) => {
    if (!controls.isLocked) return;
    if (e.button !== 0) return;
    if (hookAnchor) releaseHook();
    else tryFireHook();
  });

  function releaseHook() {
    hookAnchor = null;
    ropeLine.visible = false;
  }

  function tryFireHook() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = raycaster.intersectObjects(grappleMeshes, false);
    if (!hits.length) return;
    const hit = hits[0];
    if (!hit.object.userData.grapple) return;
    hookAnchor = hit.point.clone();
    const dist = camera.position.distanceTo(hookAnchor);
    ropeRestLength = Math.min(dist, HOOK_MAX_LENGTH);
    ropeLine.visible = true;
  }

  function updateRopeLine() {
    if (!hookAnchor || !ropeLine.visible) return;
    ropePositions[0] = camera.position.x;
    ropePositions[1] = camera.position.y;
    ropePositions[2] = camera.position.z;
    ropePositions[3] = hookAnchor.x;
    ropePositions[4] = hookAnchor.y;
    ropePositions[5] = hookAnchor.z;
    ropeGeom.attributes.position.needsUpdate = true;
  }

  blocker.addEventListener("click", () => {
    if (!won) controls.lock();
  });

  controls.addEventListener("lock", () => {
    if (won) {
      won = false;
      camera.position.set(0, EYE_HEIGHT + 0.02, 4);
      camera.rotation.set(0, 0, 0);
      velocity.set(0, 0, 0);
      releaseHook();
      hud.textContent = "";
    }
    document.body.classList.add("locked");
    blocker.style.display = "none";
  });
  controls.addEventListener("unlock", () => {
    document.body.classList.remove("locked");
    blocker.style.display = "flex";
  });

  const clock = new THREE.Clock();

  function checkWin() {
    if (won) return;
    const dx = camera.position.x - goalMesh.position.x;
    const dz = camera.position.z - goalMesh.position.z;
    const horiz = Math.hypot(dx, dz);
    if (horiz < 1.85 && camera.position.y > goalMesh.position.y - 0.2 && camera.position.y < goalMesh.position.y + 3) {
      won = true;
      releaseHook();
      controls.unlock();
      hud.textContent = "You reached the gold platform — nice hook work!";
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    grounded = camera.position.y <= EYE_HEIGHT + 0.06 && velocity.y <= 0.05;

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
      }
    }

    velocity.y += GRAVITY * dt;

    camera.position.addScaledVector(velocity, dt);

    if (hookAnchor) {
      tmpV.subVectors(camera.position, hookAnchor);
      let dist = tmpV.length();
      if (dist > 1e-5) {
        tmpV.multiplyScalar(1 / dist);
      } else {
        tmpV.set(0, 1, 0);
        dist = 0;
      }
      if (dist > ropeRestLength) {
        tmpV2.copy(hookAnchor).addScaledVector(tmpV, ropeRestLength);
        camera.position.copy(tmpV2);
        const radialSpeed = velocity.dot(tmpV);
        if (radialSpeed > 0) {
          tmpV3.copy(tmpV).multiplyScalar(radialSpeed);
          velocity.sub(tmpV3);
        }
      }
      tmpV3.subVectors(hookAnchor, camera.position);
      const pullDirLen = tmpV3.length();
      if (pullDirLen > 0.15) {
        tmpV3.multiplyScalar(1 / pullDirLen);
        velocity.addScaledVector(tmpV3, HOOK_PULL * dt);
      }
      velocity.addScaledVector(velocity, -HOOK_SWING_DAMP * dt);
    }

    if (camera.position.y < EYE_HEIGHT + 0.02) {
      camera.position.y = EYE_HEIGHT + 0.02;
      if (velocity.y < 0) velocity.y = 0;
    }

    for (const box of colliders) {
      resolveAabbPenetration(camera.position, velocity, box);
    }

    checkWin();
    updateRopeLine();

    if (controls.isLocked && !won) {
      hud.textContent = hookAnchor
        ? "Grapple active · LMB or R to release"
        : "Aim at cyan/magenta surfaces · LMB to fire";
    } else if (!won && !controls.isLocked) {
      hud.textContent = "";
    }

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
