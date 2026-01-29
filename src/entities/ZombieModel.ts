/**
 * ZombieModel - Creates a zombie meerkat model with glowing eyes
 * Based on the meerkat model but with undead appearance
 */

import * as THREE from 'three';

/** Configuration options for zombie model creation */
export interface ZombieModelConfig {
  /** Primary body color (default: 0x4a5d4a - sickly green) */
  bodyColor?: number;
  /** Belly/front color (default: 0x6b7b6b - pale green) */
  bellyColor?: number;
  /** Eye glow color (default: 0xff3300 - red-orange) */
  eyeGlowColor?: number;
  /** Eye glow intensity (default: 2.0) */
  eyeGlowIntensity?: number;
  /** Scale multiplier (default: 1) */
  scale?: number;
  /** Whether to cast shadows (default: true) */
  castShadow?: boolean;
}

/** State-based appearance options */
export enum ZombieVisualState {
  NORMAL = 'NORMAL',
  CHASING = 'CHASING',
  FROZEN = 'FROZEN',
}

/** Creates a zombie meerkat model for the game */
export class ZombieModel {
  private group: THREE.Group;
  private materials: THREE.MeshStandardMaterial[];
  private eyeMaterials: THREE.MeshStandardMaterial[];
  private bodyMaterial: THREE.MeshStandardMaterial;
  private baseBodyColor: number;
  private eyeGlowColor: number;
  private eyeGlowIntensity: number;

  constructor(config: ZombieModelConfig = {}) {
    const {
      bodyColor = 0x4a5d4a,
      bellyColor = 0x6b7b6b,
      eyeGlowColor = 0xff3300,
      eyeGlowIntensity = 2.0,
      scale = 1,
      castShadow = true,
    } = config;

    this.group = new THREE.Group();
    this.materials = [];
    this.eyeMaterials = [];
    this.baseBodyColor = bodyColor;
    this.eyeGlowColor = eyeGlowColor;
    this.eyeGlowIntensity = eyeGlowIntensity;

    // Create materials
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.9,
      emissive: 0x1a0a00,
      emissiveIntensity: 0.1,
    });
    const bellyMaterial = new THREE.MeshStandardMaterial({
      color: bellyColor,
      roughness: 1.0,
    });

    this.materials.push(this.bodyMaterial, bellyMaterial);

    // Build the zombie body parts
    this.buildBody(this.bodyMaterial, bellyMaterial, castShadow);
    this.buildHead(this.bodyMaterial, bellyMaterial, castShadow);
    this.buildGlowingEyes(eyeGlowColor, eyeGlowIntensity);
    this.buildArms(this.bodyMaterial, castShadow);
    this.buildLegs(this.bodyMaterial, castShadow);
    this.buildTail(this.bodyMaterial, castShadow);
    this.buildEars(this.bodyMaterial, castShadow);

    // Apply scale
    this.group.scale.setScalar(scale);
  }

  /**
   * Build the zombie's body
   */
  private buildBody(
    bodyMaterial: THREE.MeshStandardMaterial,
    bellyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean
  ): void {
    // Main body - slightly hunched/twisted
    const bodyGeometry = new THREE.CapsuleGeometry(0.25, 0.65, 8, 16);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.58, 0);
    body.rotation.x = 0.1; // Slight forward hunch
    body.castShadow = castShadow;
    this.group.add(body);

    // Belly - decayed looking
    const bellyGeometry = new THREE.SphereGeometry(0.18, 16, 16, 0, Math.PI);
    const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
    belly.position.set(0, 0.48, 0.06);
    belly.scale.set(0.9, 1.1, 0.5);
    belly.rotation.x = -Math.PI / 2;
    this.group.add(belly);
  }

  /**
   * Build the zombie's head
   */
  private buildHead(
    bodyMaterial: THREE.MeshStandardMaterial,
    bellyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean
  ): void {
    // Head - slightly misshapen
    const headGeometry = new THREE.SphereGeometry(0.22, 16, 16);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.set(0, 1.1, 0.02);
    head.scale.set(1.05, 1.0, 0.95);
    head.castShadow = castShadow;
    head.name = 'head';
    this.group.add(head);

    // Snout - gaunt
    const snoutGeometry = new THREE.SphereGeometry(0.09, 12, 12);
    const snoutMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a6a5a,
      roughness: 1.0,
    });
    this.materials.push(snoutMaterial);
    const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
    snout.position.set(0, 1.04, 0.18);
    snout.scale.set(0.8, 0.6, 1);
    this.group.add(snout);

    // Nose - dark, dead
    const noseGeometry = new THREE.SphereGeometry(0.035, 8, 8);
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.8,
    });
    this.materials.push(noseMaterial);
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 1.04, 0.25);
    this.group.add(nose);
  }

  /**
   * Build glowing eyes - the key feature for zombies
   */
  private buildGlowingEyes(glowColor: number, glowIntensity: number): void {
    // Eye sockets (dark recesses)
    const socketGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const socketMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 1.0,
    });
    this.materials.push(socketMaterial);

    const leftSocket = new THREE.Mesh(socketGeometry, socketMaterial);
    leftSocket.position.set(-0.1, 1.13, 0.12);
    this.group.add(leftSocket);

    const rightSocket = new THREE.Mesh(socketGeometry, socketMaterial);
    rightSocket.position.set(0.1, 1.13, 0.12);
    this.group.add(rightSocket);

    // Glowing eyes - the spooky part!
    const eyeGeometry = new THREE.SphereGeometry(0.045, 12, 12);
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: glowIntensity,
      roughness: 0.3,
    });
    this.materials.push(eyeMaterial);
    this.eyeMaterials.push(eyeMaterial);

    // Left glowing eye
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 1.14, 0.15);
    leftEye.name = 'leftEye';
    this.group.add(leftEye);

    // Right glowing eye
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 1.14, 0.15);
    rightEye.name = 'rightEye';
    this.group.add(rightEye);

    // Add small point lights for actual glow effect (visible in fog)
    const leftEyeLight = new THREE.PointLight(glowColor, 0.3, 3);
    leftEyeLight.position.set(-0.1, 1.14, 0.18);
    leftEyeLight.name = 'leftEyeLight';
    this.group.add(leftEyeLight);

    const rightEyeLight = new THREE.PointLight(glowColor, 0.3, 3);
    rightEyeLight.position.set(0.1, 1.14, 0.18);
    rightEyeLight.name = 'rightEyeLight';
    this.group.add(rightEyeLight);

    // Inner eye glow (brighter center)
    const innerEyeGeometry = new THREE.SphereGeometry(0.02, 8, 8);
    const innerEyeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00, // Bright yellow center
    });
    this.materials.push(innerEyeMaterial as unknown as THREE.MeshStandardMaterial);

    const leftInnerEye = new THREE.Mesh(innerEyeGeometry, innerEyeMaterial);
    leftInnerEye.position.set(-0.1, 1.14, 0.17);
    this.group.add(leftInnerEye);

    const rightInnerEye = new THREE.Mesh(innerEyeGeometry, innerEyeMaterial);
    rightInnerEye.position.set(0.1, 1.14, 0.17);
    this.group.add(rightInnerEye);
  }

  /**
   * Build zombie arms (ragged, reaching)
   */
  private buildArms(
    bodyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean
  ): void {
    const armGeometry = new THREE.CapsuleGeometry(0.055, 0.22, 4, 8);

    // Left arm - reaching forward
    const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
    leftArm.position.set(-0.24, 0.68, 0.1);
    leftArm.rotation.z = 0.4;
    leftArm.rotation.x = -0.5;
    leftArm.castShadow = castShadow;
    this.group.add(leftArm);

    // Right arm - reaching forward
    const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
    rightArm.position.set(0.24, 0.68, 0.1);
    rightArm.rotation.z = -0.4;
    rightArm.rotation.x = -0.5;
    rightArm.castShadow = castShadow;
    this.group.add(rightArm);

    // Clawed hands
    const clawMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.6,
    });
    this.materials.push(clawMaterial);

    const clawGeometry = new THREE.ConeGeometry(0.04, 0.08, 6);

    // Left hand claws
    for (let i = -1; i <= 1; i++) {
      const claw = new THREE.Mesh(clawGeometry, clawMaterial);
      claw.position.set(-0.32 + i * 0.02, 0.52, 0.18);
      claw.rotation.x = -Math.PI / 3;
      this.group.add(claw);
    }

    // Right hand claws
    for (let i = -1; i <= 1; i++) {
      const claw = new THREE.Mesh(clawGeometry, clawMaterial);
      claw.position.set(0.32 + i * 0.02, 0.52, 0.18);
      claw.rotation.x = -Math.PI / 3;
      this.group.add(claw);
    }
  }

  /**
   * Build zombie legs (shambling stance)
   */
  private buildLegs(
    bodyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean
  ): void {
    const legGeometry = new THREE.CapsuleGeometry(0.075, 0.15, 4, 8);

    // Left leg - slightly bent
    const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    leftLeg.position.set(-0.1, 0.15, 0);
    leftLeg.rotation.z = 0.1;
    leftLeg.castShadow = castShadow;
    this.group.add(leftLeg);

    // Right leg
    const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    rightLeg.position.set(0.12, 0.15, 0);
    rightLeg.rotation.z = -0.05;
    rightLeg.castShadow = castShadow;
    this.group.add(rightLeg);

    // Feet
    const footGeometry = new THREE.SphereGeometry(0.065, 8, 8);
    const footMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4a3a,
      roughness: 0.9,
    });
    this.materials.push(footMaterial);

    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.12, 0.02, 0.02);
    leftFoot.scale.set(1, 0.5, 1.3);
    this.group.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.14, 0.02, 0.02);
    rightFoot.scale.set(1, 0.5, 1.3);
    this.group.add(rightFoot);
  }

  /**
   * Build zombie tail (ragged)
   */
  private buildTail(
    bodyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean
  ): void {
    const tailGeometry = new THREE.ConeGeometry(0.05, 0.35, 8);
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tail.position.set(0, 0.32, -0.18);
    tail.rotation.x = Math.PI / 2.5;
    tail.castShadow = castShadow;
    this.group.add(tail);
  }

  /**
   * Build zombie ears (tattered)
   */
  private buildEars(
    bodyMaterial: THREE.MeshStandardMaterial,
    castShadow: boolean
  ): void {
    const earGeometry = new THREE.SphereGeometry(0.05, 6, 6);

    // Left ear - torn/ragged
    const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
    leftEar.position.set(-0.14, 1.25, -0.02);
    leftEar.scale.set(0.6, 0.8, 0.4);
    leftEar.castShadow = castShadow;
    this.group.add(leftEar);

    // Right ear
    const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
    rightEar.position.set(0.14, 1.25, -0.02);
    rightEar.scale.set(0.6, 0.9, 0.4);
    rightEar.castShadow = castShadow;
    this.group.add(rightEar);
  }

  /**
   * Get the Three.js group containing the zombie model
   */
  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Set the visual state of the zombie
   */
  setVisualState(state: ZombieVisualState): void {
    switch (state) {
      case ZombieVisualState.CHASING:
        // More intense eye glow when chasing
        this.eyeMaterials.forEach((mat) => {
          mat.emissiveIntensity = this.eyeGlowIntensity * 1.5;
        });
        // Redder body tint
        this.bodyMaterial.color.setHex(0x5a3a3a);
        this.bodyMaterial.emissive.setHex(0x2a0000);
        this.bodyMaterial.emissiveIntensity = 0.2;

        // Increase eye light intensity
        const chasingLeftLight = this.group.getObjectByName('leftEyeLight') as THREE.PointLight;
        const chasingRightLight = this.group.getObjectByName('rightEyeLight') as THREE.PointLight;
        if (chasingLeftLight) chasingLeftLight.intensity = 0.6;
        if (chasingRightLight) chasingRightLight.intensity = 0.6;
        break;

      case ZombieVisualState.FROZEN:
        // Ice blue color
        this.eyeMaterials.forEach((mat) => {
          mat.color.setHex(0x88ccff);
          mat.emissive.setHex(0x88ccff);
          mat.emissiveIntensity = 1.0;
        });
        this.bodyMaterial.color.setHex(0x88ccff);
        this.bodyMaterial.emissive.setHex(0x0044aa);
        this.bodyMaterial.emissiveIntensity = 0.3;

        // Blue eye lights
        const frozenLeftLight = this.group.getObjectByName('leftEyeLight') as THREE.PointLight;
        const frozenRightLight = this.group.getObjectByName('rightEyeLight') as THREE.PointLight;
        if (frozenLeftLight) {
          frozenLeftLight.color.setHex(0x88ccff);
          frozenLeftLight.intensity = 0.4;
        }
        if (frozenRightLight) {
          frozenRightLight.color.setHex(0x88ccff);
          frozenRightLight.intensity = 0.4;
        }
        break;

      case ZombieVisualState.NORMAL:
      default:
        // Reset to default
        this.eyeMaterials.forEach((mat) => {
          mat.color.setHex(this.eyeGlowColor);
          mat.emissive.setHex(this.eyeGlowColor);
          mat.emissiveIntensity = this.eyeGlowIntensity;
        });
        this.bodyMaterial.color.setHex(this.baseBodyColor);
        this.bodyMaterial.emissive.setHex(0x1a0a00);
        this.bodyMaterial.emissiveIntensity = 0.1;

        // Reset eye lights
        const normalLeftLight = this.group.getObjectByName('leftEyeLight') as THREE.PointLight;
        const normalRightLight = this.group.getObjectByName('rightEyeLight') as THREE.PointLight;
        if (normalLeftLight) {
          normalLeftLight.color.setHex(this.eyeGlowColor);
          normalLeftLight.intensity = 0.3;
        }
        if (normalRightLight) {
          normalRightLight.color.setHex(this.eyeGlowColor);
          normalRightLight.intensity = 0.3;
        }
        break;
    }
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
