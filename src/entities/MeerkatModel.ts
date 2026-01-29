/**
 * MeerkatModel - Creates a stylized 3D meerkat model using Three.js primitives
 * Used for the player character and can be adapted for spectator meerkats
 */

import * as THREE from 'three';

/** Configuration options for meerkat model creation */
export interface MeerkatModelConfig {
  /** Primary body color (default: 0xd2691e - brown) */
  bodyColor?: number;
  /** Belly/front color (default: 0xf5deb3 - wheat) */
  bellyColor?: number;
  /** Eye color (default: 0x1a1a1a - dark) */
  eyeColor?: number;
  /** Nose color (default: 0x2a1506 - dark brown) */
  noseColor?: number;
  /** Scale multiplier (default: 1) */
  scale?: number;
  /** Whether to cast shadows (default: true) */
  castShadow?: boolean;
  /** Whether to receive shadows (default: false) */
  receiveShadow?: boolean;
}

/** Creates a stylized meerkat model for use in the game */
export class MeerkatModel {
  private group: THREE.Group;
  private materials: THREE.MeshStandardMaterial[];

  constructor(config: MeerkatModelConfig = {}) {
    const {
      bodyColor = 0xd2691e,
      bellyColor = 0xf5deb3,
      eyeColor = 0x1a1a1a,
      noseColor = 0x2a1506,
      scale = 1,
      castShadow = true,
      receiveShadow = false,
    } = config;

    this.group = new THREE.Group();
    this.materials = [];

    // Create materials
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.8,
    });
    const bellyMaterial = new THREE.MeshStandardMaterial({
      color: bellyColor,
      roughness: 0.9,
    });
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: eyeColor,
      roughness: 0.5,
    });
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: noseColor,
      roughness: 0.6,
    });

    this.materials.push(bodyMaterial, bellyMaterial, eyeMaterial, noseMaterial);

    // Build the meerkat body parts
    this.buildBody(bodyMaterial, bellyMaterial, castShadow, receiveShadow);
    this.buildHead(bodyMaterial, bellyMaterial, eyeMaterial, noseMaterial, castShadow, receiveShadow);
    this.buildArms(bodyMaterial, castShadow, receiveShadow);
    this.buildLegs(bodyMaterial, castShadow, receiveShadow);
    this.buildTail(bodyMaterial, castShadow, receiveShadow);
    this.buildEars(bodyMaterial, castShadow, receiveShadow);

    // Apply scale
    this.group.scale.setScalar(scale);
  }

  /**
   * Build the meerkat's body (elongated standing pose)
   */
  private buildBody(
    bodyMaterial: THREE.MeshStandardMaterial,
    bellyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean,
    receiveShadow: boolean
  ): void {
    // Main body - elongated capsule-like shape (standing upright)
    const bodyGeometry = new THREE.CapsuleGeometry(0.25, 0.7, 8, 16);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.6, 0);
    body.castShadow = castShadow;
    body.receiveShadow = receiveShadow;
    this.group.add(body);

    // Belly - front patch (lighter color)
    const bellyGeometry = new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI);
    const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
    belly.position.set(0, 0.5, 0.08);
    belly.scale.set(0.9, 1.2, 0.5);
    belly.rotation.x = -Math.PI / 2;
    belly.castShadow = false;
    this.group.add(belly);
  }

  /**
   * Build the meerkat's head
   */
  private buildHead(
    bodyMaterial: THREE.MeshStandardMaterial,
    bellyMaterial: THREE.MeshStandardMaterial,
    eyeMaterial: THREE.MeshStandardMaterial,
    noseMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean,
    receiveShadow: boolean
  ): void {
    // Head - slightly pointed towards snout
    const headGeometry = new THREE.SphereGeometry(0.22, 16, 16);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.set(0, 1.15, 0);
    head.scale.set(1, 1.1, 0.95);
    head.castShadow = castShadow;
    head.receiveShadow = receiveShadow;
    head.name = 'head';
    this.group.add(head);

    // Snout - pointed forward
    const snoutGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    const snout = new THREE.Mesh(snoutGeometry, bellyMaterial);
    snout.position.set(0, 1.08, 0.18);
    snout.scale.set(0.8, 0.7, 1);
    snout.castShadow = false;
    this.group.add(snout);

    // Nose
    const noseGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 1.08, 0.26);
    nose.castShadow = false;
    this.group.add(nose);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.04, 8, 8);

    // Left eye
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 1.18, 0.16);
    leftEye.castShadow = false;
    this.group.add(leftEye);

    // Right eye
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 1.18, 0.16);
    rightEye.castShadow = false;
    this.group.add(rightEye);

    // Eye whites/highlights
    const highlightGeometry = new THREE.SphereGeometry(0.015, 6, 6);
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.materials.push(highlightMaterial);

    const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    leftHighlight.position.set(-0.085, 1.195, 0.18);
    this.group.add(leftHighlight);

    const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    rightHighlight.position.set(0.115, 1.195, 0.18);
    this.group.add(rightHighlight);

    // Dark eye patches (meerkat markings)
    const patchGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const patchMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3520,
      roughness: 0.9,
    });
    this.materials.push(patchMaterial);

    const leftPatch = new THREE.Mesh(patchGeometry, patchMaterial);
    leftPatch.position.set(-0.1, 1.18, 0.12);
    leftPatch.scale.set(1, 1.3, 0.5);
    this.group.add(leftPatch);

    const rightPatch = new THREE.Mesh(patchGeometry, patchMaterial);
    rightPatch.position.set(0.1, 1.18, 0.12);
    rightPatch.scale.set(1, 1.3, 0.5);
    this.group.add(rightPatch);
  }

  /**
   * Build the meerkat's arms (small, held at sides or front)
   */
  private buildArms(
    bodyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean,
    receiveShadow: boolean
  ): void {
    const armGeometry = new THREE.CapsuleGeometry(0.06, 0.2, 4, 8);

    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
    leftArm.position.set(-0.22, 0.7, 0.05);
    leftArm.rotation.z = 0.3;
    leftArm.rotation.x = -0.2;
    leftArm.castShadow = castShadow;
    leftArm.receiveShadow = receiveShadow;
    this.group.add(leftArm);

    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
    rightArm.position.set(0.22, 0.7, 0.05);
    rightArm.rotation.z = -0.3;
    rightArm.rotation.x = -0.2;
    rightArm.castShadow = castShadow;
    rightArm.receiveShadow = receiveShadow;
    this.group.add(rightArm);

    // Paws/hands (small spheres)
    const pawGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const pawMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.7,
    });
    this.materials.push(pawMaterial);

    const leftPaw = new THREE.Mesh(pawGeometry, pawMaterial);
    leftPaw.position.set(-0.28, 0.55, 0.08);
    this.group.add(leftPaw);

    const rightPaw = new THREE.Mesh(pawGeometry, pawMaterial);
    rightPaw.position.set(0.28, 0.55, 0.08);
    this.group.add(rightPaw);
  }

  /**
   * Build the meerkat's legs (short, sturdy)
   */
  private buildLegs(
    bodyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean,
    receiveShadow: boolean
  ): void {
    const legGeometry = new THREE.CapsuleGeometry(0.08, 0.15, 4, 8);

    // Left leg
    const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    leftLeg.position.set(-0.12, 0.15, 0);
    leftLeg.castShadow = castShadow;
    leftLeg.receiveShadow = receiveShadow;
    this.group.add(leftLeg);

    // Right leg
    const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    rightLeg.position.set(0.12, 0.15, 0);
    rightLeg.castShadow = castShadow;
    rightLeg.receiveShadow = receiveShadow;
    this.group.add(rightLeg);

    // Feet
    const footGeometry = new THREE.SphereGeometry(0.07, 8, 8);
    const footMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.7,
    });
    this.materials.push(footMaterial);

    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.12, 0.02, 0.02);
    leftFoot.scale.set(1, 0.5, 1.3);
    this.group.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.12, 0.02, 0.02);
    rightFoot.scale.set(1, 0.5, 1.3);
    this.group.add(rightFoot);
  }

  /**
   * Build the meerkat's tail
   */
  private buildTail(
    bodyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean,
    receiveShadow: boolean
  ): void {
    // Tail - tapered, extends back and down slightly
    const tailGeometry = new THREE.ConeGeometry(0.06, 0.4, 8);
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tail.position.set(0, 0.35, -0.2);
    tail.rotation.x = Math.PI / 3; // Angled back
    tail.castShadow = castShadow;
    tail.receiveShadow = receiveShadow;
    this.group.add(tail);

    // Tail tip (darker)
    const tipGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const tipMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d2814,
      roughness: 0.8,
    });
    this.materials.push(tipMaterial);

    const tailTip = new THREE.Mesh(tipGeometry, tipMaterial);
    tailTip.position.set(0, 0.18, -0.35);
    this.group.add(tailTip);
  }

  /**
   * Build the meerkat's ears
   */
  private buildEars(
    bodyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean,
    receiveShadow: boolean
  ): void {
    const earGeometry = new THREE.SphereGeometry(0.06, 8, 8);

    // Left ear
    const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
    leftEar.position.set(-0.15, 1.3, -0.02);
    leftEar.scale.set(0.7, 1, 0.5);
    leftEar.castShadow = castShadow;
    leftEar.receiveShadow = receiveShadow;
    this.group.add(leftEar);

    // Right ear
    const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
    rightEar.position.set(0.15, 1.3, -0.02);
    rightEar.scale.set(0.7, 1, 0.5);
    rightEar.castShadow = castShadow;
    rightEar.receiveShadow = receiveShadow;
    this.group.add(rightEar);

    // Inner ears (pink)
    const innerEarGeometry = new THREE.SphereGeometry(0.03, 6, 6);
    const innerEarMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a4a4,
      roughness: 0.9,
    });
    this.materials.push(innerEarMaterial);

    const leftInnerEar = new THREE.Mesh(innerEarGeometry, innerEarMaterial);
    leftInnerEar.position.set(-0.15, 1.3, 0.01);
    this.group.add(leftInnerEar);

    const rightInnerEar = new THREE.Mesh(innerEarGeometry, innerEarMaterial);
    rightInnerEar.position.set(0.15, 1.3, 0.01);
    this.group.add(rightInnerEar);
  }

  /**
   * Get the Three.js group containing the meerkat model
   */
  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Set the primary body color
   */
  setBodyColor(color: number): void {
    if (this.materials[0]) {
      this.materials[0].color.setHex(color);
    }
  }

  /**
   * Set emissive glow (for effects like shield)
   */
  setEmissive(color: number, intensity: number): void {
    this.materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissive.setHex(color);
        material.emissiveIntensity = intensity;
      }
    });
  }

  /**
   * Set opacity (for invisibility effect)
   */
  setOpacity(opacity: number): void {
    const transparent = opacity < 1;
    this.materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.transparent = transparent;
        material.opacity = opacity;
      }
    });
  }

  /**
   * Dispose of all geometries and materials
   */
  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });

    this.materials.forEach((material) => {
      material.dispose();
    });
  }
}

/**
 * Create a zombie meerkat model with undead appearance
 */
export function createZombieMeerkatModel(config: Partial<MeerkatModelConfig> = {}): MeerkatModel {
  return new MeerkatModel({
    bodyColor: 0x4a5d4a, // Sickly green
    bellyColor: 0x6b7b6b, // Pale green
    eyeColor: 0xff0000, // Red eyes (will be replaced with glowing)
    noseColor: 0x3d3d3d, // Dark gray
    ...config,
  });
}

/**
 * Create a player meerkat model
 */
export function createPlayerMeerkatModel(config: Partial<MeerkatModelConfig> = {}): MeerkatModel {
  return new MeerkatModel({
    bodyColor: 0xd2691e, // Chocolate brown
    bellyColor: 0xf5deb3, // Wheat
    ...config,
  });
}
