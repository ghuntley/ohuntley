/**
 * MeerkatModel - Creates a stylized 3D meerkat model using Three.js primitives
 * Used for the player character and can be adapted for spectator meerkats
 * Supports procedural animations via stored limb references
 */

import * as THREE from 'three';
import {
  AnimationController,
  ProceduralAnimations,
} from '../systems/AnimationSystem';

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
  /** Whether to enable animations (default: true) */
  enableAnimations?: boolean;
}

/** Animatable body parts */
export interface AnimatableParts {
  body: THREE.Group;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  tail: THREE.Mesh;
}

/** Creates a stylized meerkat model for use in the game */
export class MeerkatModel {
  private group: THREE.Group;
  private materials: THREE.MeshStandardMaterial[];

  // Animatable parts stored for animation system
  private parts: Partial<AnimatableParts> = {};
  private bodyGroup: THREE.Group;

  // Animation controller
  private animationController: AnimationController | null = null;
  private animationsEnabled: boolean;

  constructor(config: MeerkatModelConfig = {}) {
    const {
      bodyColor = 0xd2691e,
      bellyColor = 0xf5deb3,
      eyeColor = 0x1a1a1a,
      noseColor = 0x2a1506,
      scale = 1,
      castShadow = true,
      receiveShadow = false,
      enableAnimations = true,
    } = config;

    this.group = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.materials = [];
    this.animationsEnabled = enableAnimations;

    // Add body group to main group (allows animating all body parts together)
    this.group.add(this.bodyGroup);
    this.parts.body = this.bodyGroup;

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

    // Initialize animations if enabled
    if (enableAnimations) {
      this.initializeAnimations();
    }
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
    body.name = 'torso';
    this.bodyGroup.add(body);

    // Belly - front patch (lighter color)
    const bellyGeometry = new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI);
    const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
    belly.position.set(0, 0.5, 0.08);
    belly.scale.set(0.9, 1.2, 0.5);
    belly.rotation.x = -Math.PI / 2;
    belly.castShadow = false;
    this.bodyGroup.add(belly);
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
    this.bodyGroup.add(head);
    this.parts.head = head;

    // Snout - pointed forward
    const snoutGeometry = new THREE.SphereGeometry(0.1, 12, 12);
    const snout = new THREE.Mesh(snoutGeometry, bellyMaterial);
    snout.position.set(0, 1.08, 0.18);
    snout.scale.set(0.8, 0.7, 1);
    snout.castShadow = false;
    this.bodyGroup.add(snout);

    // Nose
    const noseGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 1.08, 0.26);
    nose.castShadow = false;
    this.bodyGroup.add(nose);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.04, 8, 8);

    // Left eye
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 1.18, 0.16);
    leftEye.castShadow = false;
    this.bodyGroup.add(leftEye);

    // Right eye
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 1.18, 0.16);
    rightEye.castShadow = false;
    this.bodyGroup.add(rightEye);

    // Eye whites/highlights
    const highlightGeometry = new THREE.SphereGeometry(0.015, 6, 6);
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.materials.push(highlightMaterial);

    const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    leftHighlight.position.set(-0.085, 1.195, 0.18);
    this.bodyGroup.add(leftHighlight);

    const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    rightHighlight.position.set(0.115, 1.195, 0.18);
    this.bodyGroup.add(rightHighlight);

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
    this.bodyGroup.add(leftPatch);

    const rightPatch = new THREE.Mesh(patchGeometry, patchMaterial);
    rightPatch.position.set(0.1, 1.18, 0.12);
    rightPatch.scale.set(1, 1.3, 0.5);
    this.bodyGroup.add(rightPatch);
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

    // Left arm - use a group for proper pivot point
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.22, 0.85, 0.05); // Pivot at shoulder
    const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
    leftArm.position.set(0, -0.15, 0); // Offset from pivot
    leftArm.castShadow = castShadow;
    leftArm.receiveShadow = receiveShadow;
    leftArm.name = 'leftArm';
    leftArmGroup.add(leftArm);
    leftArmGroup.rotation.z = 0.3;
    leftArmGroup.rotation.x = -0.2;
    this.bodyGroup.add(leftArmGroup);
    this.parts.leftArm = leftArm;

    // Right arm
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.22, 0.85, 0.05); // Pivot at shoulder
    const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
    rightArm.position.set(0, -0.15, 0); // Offset from pivot
    rightArm.castShadow = castShadow;
    rightArm.receiveShadow = receiveShadow;
    rightArm.name = 'rightArm';
    rightArmGroup.add(rightArm);
    rightArmGroup.rotation.z = -0.3;
    rightArmGroup.rotation.x = -0.2;
    this.bodyGroup.add(rightArmGroup);
    this.parts.rightArm = rightArm;

    // Store the groups as the animatable parts (we animate the groups, not the meshes)
    // Override with groups for animation
    (this.parts as Record<string, THREE.Object3D>).leftArm = leftArmGroup;
    (this.parts as Record<string, THREE.Object3D>).rightArm = rightArmGroup;

    // Paws/hands (small spheres) - attached to arm groups
    const pawGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const pawMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.7,
    });
    this.materials.push(pawMaterial);

    const leftPaw = new THREE.Mesh(pawGeometry, pawMaterial);
    leftPaw.position.set(0, -0.3, 0.03);
    leftArmGroup.add(leftPaw);

    const rightPaw = new THREE.Mesh(pawGeometry, pawMaterial);
    rightPaw.position.set(0, -0.3, 0.03);
    rightArmGroup.add(rightPaw);
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

    // Left leg - use a group for proper pivot point
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.12, 0.25, 0); // Pivot at hip
    const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    leftLeg.position.set(0, -0.1, 0); // Offset from pivot
    leftLeg.castShadow = castShadow;
    leftLeg.receiveShadow = receiveShadow;
    leftLeg.name = 'leftLeg';
    leftLegGroup.add(leftLeg);
    this.bodyGroup.add(leftLegGroup);
    (this.parts as Record<string, THREE.Object3D>).leftLeg = leftLegGroup;

    // Right leg
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.12, 0.25, 0); // Pivot at hip
    const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    rightLeg.position.set(0, -0.1, 0); // Offset from pivot
    rightLeg.castShadow = castShadow;
    rightLeg.receiveShadow = receiveShadow;
    rightLeg.name = 'rightLeg';
    rightLegGroup.add(rightLeg);
    this.bodyGroup.add(rightLegGroup);
    (this.parts as Record<string, THREE.Object3D>).rightLeg = rightLegGroup;

    // Feet - attached to leg groups
    const footGeometry = new THREE.SphereGeometry(0.07, 8, 8);
    const footMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.7,
    });
    this.materials.push(footMaterial);

    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(0, -0.23, 0.02);
    leftFoot.scale.set(1, 0.5, 1.3);
    leftLegGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0, -0.23, 0.02);
    rightFoot.scale.set(1, 0.5, 1.3);
    rightLegGroup.add(rightFoot);
  }

  /**
   * Build the meerkat's tail
   */
  private buildTail(
    bodyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean,
    receiveShadow: boolean
  ): void {
    // Tail group for animation
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.35, -0.15); // Pivot at base

    // Tail - tapered, extends back and down slightly
    const tailGeometry = new THREE.ConeGeometry(0.06, 0.4, 8);
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tail.position.set(0, 0, -0.1);
    tail.rotation.x = Math.PI / 3; // Angled back
    tail.castShadow = castShadow;
    tail.receiveShadow = receiveShadow;
    tail.name = 'tail';
    tailGroup.add(tail);

    // Tail tip (darker)
    const tipGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const tipMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d2814,
      roughness: 0.8,
    });
    this.materials.push(tipMaterial);

    const tailTip = new THREE.Mesh(tipGeometry, tipMaterial);
    tailTip.position.set(0, -0.17, -0.2);
    tailGroup.add(tailTip);

    this.bodyGroup.add(tailGroup);
    (this.parts as Record<string, THREE.Object3D>).tail = tailGroup;
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
    this.bodyGroup.add(leftEar);

    // Right ear
    const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
    rightEar.position.set(0.15, 1.3, -0.02);
    rightEar.scale.set(0.7, 1, 0.5);
    rightEar.castShadow = castShadow;
    rightEar.receiveShadow = receiveShadow;
    this.bodyGroup.add(rightEar);

    // Inner ears (pink)
    const innerEarGeometry = new THREE.SphereGeometry(0.03, 6, 6);
    const innerEarMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a4a4,
      roughness: 0.9,
    });
    this.materials.push(innerEarMaterial);

    const leftInnerEar = new THREE.Mesh(innerEarGeometry, innerEarMaterial);
    leftInnerEar.position.set(-0.15, 1.3, 0.01);
    this.bodyGroup.add(leftInnerEar);

    const rightInnerEar = new THREE.Mesh(innerEarGeometry, innerEarMaterial);
    rightInnerEar.position.set(0.15, 1.3, 0.01);
    this.bodyGroup.add(rightInnerEar);
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
   * Initialize animation clips
   */
  private initializeAnimations(): void {
    if (!this.parts.leftArm || !this.parts.rightArm || !this.parts.leftLeg || !this.parts.rightLeg) {
      console.warn('MeerkatModel: Cannot initialize animations, parts not found');
      return;
    }

    this.animationController = new AnimationController();

    // Create and register animation clips
    const idleClip = ProceduralAnimations.createIdleAnimation(
      this.bodyGroup,
      this.parts.head
    );
    this.animationController.addClip(idleClip);

    const walkClip = ProceduralAnimations.createWalkCycle(
      this.parts.leftArm as THREE.Object3D,
      this.parts.rightArm as THREE.Object3D,
      this.parts.leftLeg as THREE.Object3D,
      this.parts.rightLeg as THREE.Object3D,
      this.bodyGroup
    );
    this.animationController.addClip(walkClip);

    const runClip = ProceduralAnimations.createRunCycle(
      this.parts.leftArm as THREE.Object3D,
      this.parts.rightArm as THREE.Object3D,
      this.parts.leftLeg as THREE.Object3D,
      this.parts.rightLeg as THREE.Object3D,
      this.bodyGroup
    );
    this.animationController.addClip(runClip);

    const attackClip = ProceduralAnimations.createAttackAnimation(
      this.parts.rightArm as THREE.Object3D,
      this.bodyGroup
    );
    this.animationController.addClip(attackClip);

    const deathClip = ProceduralAnimations.createDeathAnimation(this.bodyGroup);
    this.animationController.addClip(deathClip);

    const victoryClip = ProceduralAnimations.createVictoryAnimation(
      this.parts.leftArm as THREE.Object3D,
      this.parts.rightArm as THREE.Object3D,
      this.bodyGroup
    );
    this.animationController.addClip(victoryClip);

    // Start with idle animation
    this.animationController.play('idle');
  }

  /**
   * Update animations
   * @param deltaTime Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (this.animationController && this.animationsEnabled) {
      this.animationController.update(deltaTime);
    }
  }

  /**
   * Play an animation by name
   * @param name Animation name: 'idle', 'walk', 'run', 'attack', 'death', 'victory'
   * @param options Optional configuration
   */
  playAnimation(name: string, options?: { speed?: number; onComplete?: () => void }): void {
    if (this.animationController && this.animationsEnabled) {
      this.animationController.play(name, options);
    }
  }

  /**
   * Stop current animation
   */
  stopAnimation(): void {
    if (this.animationController) {
      this.animationController.stop();
    }
  }

  /**
   * Check if an animation is currently playing
   */
  isAnimationPlaying(name?: string): boolean {
    return this.animationController?.isPlaying(name) ?? false;
  }

  /**
   * Get current animation name
   */
  getCurrentAnimation(): string | null {
    return this.animationController?.getCurrentAnimation() ?? null;
  }

  /**
   * Get animatable parts for external animation
   */
  getParts(): Partial<AnimatableParts> {
    return this.parts;
  }

  /**
   * Get the body group (for position/rotation animation)
   */
  getBodyGroup(): THREE.Group {
    return this.bodyGroup;
  }

  /**
   * Reset the model to default pose
   */
  resetPose(): void {
    this.bodyGroup.position.set(0, 0, 0);
    this.bodyGroup.rotation.set(0, 0, 0);
    this.bodyGroup.scale.set(1, 1, 1);

    // Reset limb rotations
    if (this.parts.leftArm) {
      (this.parts.leftArm as THREE.Object3D).rotation.set(-0.2, 0, 0.3);
    }
    if (this.parts.rightArm) {
      (this.parts.rightArm as THREE.Object3D).rotation.set(-0.2, 0, -0.3);
    }
    if (this.parts.leftLeg) {
      (this.parts.leftLeg as THREE.Object3D).rotation.set(0, 0, 0);
    }
    if (this.parts.rightLeg) {
      (this.parts.rightLeg as THREE.Object3D).rotation.set(0, 0, 0);
    }
  }

  /**
   * Dispose of all geometries and materials
   */
  dispose(): void {
    // Dispose animation controller
    if (this.animationController) {
      this.animationController.dispose();
    }

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
 * Note: Zombies typically don't need complex animations, so we disable them by default
 */
export function createZombieMeerkatModel(config: Partial<MeerkatModelConfig> = {}): MeerkatModel {
  return new MeerkatModel({
    bodyColor: 0x4a5d4a, // Sickly green
    bellyColor: 0x6b7b6b, // Pale green
    eyeColor: 0xff0000, // Red eyes (will be replaced with glowing)
    noseColor: 0x3d3d3d, // Dark gray
    enableAnimations: false, // Zombies use ZombieModel instead
    ...config,
  });
}

/**
 * Create a player meerkat model with full animation support
 */
export function createPlayerMeerkatModel(config: Partial<MeerkatModelConfig> = {}): MeerkatModel {
  return new MeerkatModel({
    bodyColor: 0xd2691e, // Chocolate brown
    bellyColor: 0xf5deb3, // Wheat
    enableAnimations: true,
    ...config,
  });
}

/**
 * Create a spectator meerkat model (no animations needed - has its own animation)
 */
export function createSpectatorMeerkatModel(config: Partial<MeerkatModelConfig> = {}): MeerkatModel {
  return new MeerkatModel({
    bodyColor: 0xd2691e,
    bellyColor: 0xf5deb3,
    enableAnimations: false, // Spectators have their own head-tracking animation
    ...config,
  });
}
