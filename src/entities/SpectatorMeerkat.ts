/**
 * Spectator Meerkat entity for Meerkat Maze Runner
 * Meerkats that stand on hedge walls and watch the player
 */

import * as THREE from 'three';
import { Position } from './Player';
import { CELL_SIZE, WALL_HEIGHT } from '../utils/Constants';

/** Alert level for spectator meerkats */
export enum AlertLevel {
  CALM = 0,
  CURIOUS = 1,
  ALERT = 2,
  ALARMED = 3,
}

/** Configuration for spectator meerkat */
export interface SpectatorMeerkatConfig {
  /** Position on the hedge (grid coordinates) */
  gridX: number;
  gridY: number;
  /** Which edge of the cell the meerkat is on */
  edge: 'north' | 'south' | 'east' | 'west';
}

/**
 * Spectator Meerkat class
 * A meerkat that stands on hedge walls and watches the player
 */
export class SpectatorMeerkat {
  // Unique identifier
  private id: number;
  private static nextId = 0;

  // Position (world coordinates, on top of hedge)
  private position: Position;
  private gridPosition: { x: number; y: number };

  // Rotation
  private bodyRotation: number;
  private headRotation: number;
  private targetHeadRotation: number;

  // Alert state
  private alertLevel: AlertLevel;
  private isAlerted: boolean;

  // Animation state
  private idlePhase: number;
  private swayAmplitude: number;
  private breathingPhase: number;

  // Head tracking
  private headTrackSpeed: number;

  // Danger detection
  private readonly DANGER_RADIUS = CELL_SIZE * 2; // 2 cells

  constructor(config: SpectatorMeerkatConfig) {
    this.id = SpectatorMeerkat.nextId++;

    this.gridPosition = { x: config.gridX, y: config.gridY };

    // Calculate world position based on grid and edge
    this.position = this.calculateWorldPosition(config);

    // Set initial rotation based on edge (face outward from hedge)
    this.bodyRotation = this.getInitialRotation(config.edge);
    this.headRotation = 0;
    this.targetHeadRotation = 0;

    // Initialize state
    this.alertLevel = AlertLevel.CALM;
    this.isAlerted = false;

    // Initialize animation
    this.idlePhase = Math.random() * Math.PI * 2; // Random starting phase
    this.swayAmplitude = 0.05 + Math.random() * 0.03;
    this.breathingPhase = Math.random() * Math.PI * 2;

    // Head tracking
    this.headTrackSpeed = 3 + Math.random() * 2; // Varied tracking speed
  }

  /**
   * Calculate world position from grid position and edge
   */
  private calculateWorldPosition(config: SpectatorMeerkatConfig): Position {
    const baseX = config.gridX * CELL_SIZE;
    const baseZ = config.gridY * CELL_SIZE;
    const halfCell = CELL_SIZE / 2;
    const heightOnHedge = WALL_HEIGHT + 0.3; // Slightly above hedge top

    let x = baseX;
    let z = baseZ;

    switch (config.edge) {
      case 'north':
        z = baseZ - halfCell;
        break;
      case 'south':
        z = baseZ + halfCell;
        break;
      case 'east':
        x = baseX + halfCell;
        break;
      case 'west':
        x = baseX - halfCell;
        break;
    }

    return { x, y: heightOnHedge, z };
  }

  /**
   * Get initial body rotation based on edge
   */
  private getInitialRotation(edge: 'north' | 'south' | 'east' | 'west'): number {
    switch (edge) {
      case 'north':
        return 0; // Face south (into maze)
      case 'south':
        return Math.PI; // Face north
      case 'east':
        return -Math.PI / 2; // Face west
      case 'west':
        return Math.PI / 2; // Face east
    }
  }

  /**
   * Update spectator state
   * @param deltaTime Time since last update in seconds
   * @param playerPosition Player's current world position
   * @param zombiePositions Array of zombie world positions
   */
  update(deltaTime: number, playerPosition: Position, zombiePositions: Position[]): void {
    // Update idle animation
    this.updateIdleAnimation(deltaTime);

    // Update head tracking to follow player
    this.updateHeadTracking(deltaTime, playerPosition);

    // Check for danger (zombies near player)
    this.updateAlertState(playerPosition, zombiePositions);
  }

  /**
   * Update idle animation (swaying, breathing)
   */
  private updateIdleAnimation(deltaTime: number): void {
    // Base idle animation
    const baseSpeed = 1.5;
    const alertMultiplier = 1 + this.alertLevel * 0.5;

    this.idlePhase += deltaTime * baseSpeed * alertMultiplier;
    this.breathingPhase += deltaTime * 2 * alertMultiplier;

    // Increase sway when alerted
    if (this.alertLevel >= AlertLevel.ALERT) {
      this.swayAmplitude = Math.min(this.swayAmplitude + deltaTime * 0.1, 0.15);
    } else {
      this.swayAmplitude = Math.max(this.swayAmplitude - deltaTime * 0.05, 0.05);
    }
  }

  /**
   * Update head tracking to follow player
   */
  private updateHeadTracking(deltaTime: number, playerPosition: Position): void {
    // Calculate direction to player
    const dx = playerPosition.x - this.position.x;
    const dz = playerPosition.z - this.position.z;

    // Calculate target head rotation (relative to body)
    const angleToPlayer = Math.atan2(dx, dz);
    const relativeAngle = angleToPlayer - this.bodyRotation;

    // Normalize angle to [-PI, PI]
    let normalizedAngle = relativeAngle;
    while (normalizedAngle > Math.PI) normalizedAngle -= Math.PI * 2;
    while (normalizedAngle < -Math.PI) normalizedAngle += Math.PI * 2;

    // Clamp head rotation to realistic range (-90 to +90 degrees)
    const maxHeadTurn = Math.PI / 2;
    this.targetHeadRotation = Math.max(-maxHeadTurn, Math.min(maxHeadTurn, normalizedAngle));

    // Smoothly interpolate head rotation
    const trackSpeed = this.headTrackSpeed * (this.alertLevel >= AlertLevel.ALERT ? 2 : 1);
    const rotationDiff = this.targetHeadRotation - this.headRotation;
    this.headRotation += rotationDiff * Math.min(1, deltaTime * trackSpeed);
  }

  /**
   * Update alert state based on zombie proximity to player
   */
  private updateAlertState(playerPosition: Position, zombiePositions: Position[]): void {
    let nearestZombieDistance = Infinity;

    // Find nearest zombie to player
    for (const zombiePos of zombiePositions) {
      const dx = zombiePos.x - playerPosition.x;
      const dz = zombiePos.z - playerPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      nearestZombieDistance = Math.min(nearestZombieDistance, distance);
    }

    // Update alert level based on zombie proximity
    if (nearestZombieDistance < this.DANGER_RADIUS / 2) {
      this.alertLevel = AlertLevel.ALARMED;
      this.isAlerted = true;
    } else if (nearestZombieDistance < this.DANGER_RADIUS) {
      this.alertLevel = AlertLevel.ALERT;
      this.isAlerted = true;
    } else if (nearestZombieDistance < this.DANGER_RADIUS * 2) {
      this.alertLevel = AlertLevel.CURIOUS;
      this.isAlerted = false;
    } else {
      this.alertLevel = AlertLevel.CALM;
      this.isAlerted = false;
    }
  }

  /**
   * Set alert level manually
   */
  setAlert(level: AlertLevel): void {
    this.alertLevel = level;
    this.isAlerted = level >= AlertLevel.ALERT;
  }

  /**
   * Get body sway offset for animation
   */
  getSwayOffset(): { x: number; z: number; rotY: number } {
    const swayX = Math.sin(this.idlePhase) * this.swayAmplitude;
    const swayZ = Math.cos(this.idlePhase * 0.7) * this.swayAmplitude * 0.5;
    const rotY = Math.sin(this.idlePhase * 1.3) * this.swayAmplitude * 0.3;

    return { x: swayX, z: swayZ, rotY };
  }

  /**
   * Get breathing scale offset
   */
  getBreathingScale(): number {
    return 1 + Math.sin(this.breathingPhase) * 0.02;
  }

  // Getters

  getId(): number {
    return this.id;
  }

  getPosition(): Position {
    return { ...this.position };
  }

  getGridPosition(): { x: number; y: number } {
    return { ...this.gridPosition };
  }

  getBodyRotation(): number {
    return this.bodyRotation;
  }

  getHeadRotation(): number {
    return this.headRotation;
  }

  getAlertLevel(): AlertLevel {
    return this.alertLevel;
  }

  getIsAlerted(): boolean {
    return this.isAlerted;
  }

  getIdlePhase(): number {
    return this.idlePhase;
  }

  getSwayAmplitude(): number {
    return this.swayAmplitude;
  }
}

/**
 * Create the 3D mesh for a spectator meerkat
 * Returns a group containing body and head
 */
export function createSpectatorMeerkatMesh(): THREE.Group {
  const group = new THREE.Group();

  // Materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xd2b48c, // Tan color for meerkat
    roughness: 0.8,
  });

  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xdeb887, // Burlywood - slightly lighter for head
    roughness: 0.7,
  });

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, // Dark eyes
    roughness: 0.3,
  });

  const noseMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d1f1f, // Dark brown nose
    roughness: 0.5,
  });

  // Body - cylinder standing upright
  const bodyGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.3;
  body.name = 'body';
  group.add(body);

  // Head group (for independent rotation)
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.7;
  headGroup.name = 'headGroup';

  // Head - sphere
  const headGeometry = new THREE.SphereGeometry(0.15, 8, 6);
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.name = 'head';
  headGroup.add(head);

  // Snout - small cylinder
  const snoutGeometry = new THREE.CylinderGeometry(0.05, 0.07, 0.1, 6);
  const snout = new THREE.Mesh(snoutGeometry, headMaterial);
  snout.rotation.x = Math.PI / 2;
  snout.position.z = 0.12;
  snout.name = 'snout';
  headGroup.add(snout);

  // Nose
  const noseGeometry = new THREE.SphereGeometry(0.025, 4, 4);
  const nose = new THREE.Mesh(noseGeometry, noseMaterial);
  nose.position.z = 0.17;
  nose.name = 'nose';
  headGroup.add(nose);

  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.03, 4, 4);

  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.07, 0.03, 0.1);
  leftEye.name = 'leftEye';
  headGroup.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.07, 0.03, 0.1);
  rightEye.name = 'rightEye';
  headGroup.add(rightEye);

  // Ears
  const earGeometry = new THREE.SphereGeometry(0.04, 4, 4);
  earGeometry.scale(1, 0.6, 0.5);

  const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
  leftEar.position.set(-0.12, 0.08, 0);
  leftEar.name = 'leftEar';
  headGroup.add(leftEar);

  const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
  rightEar.position.set(0.12, 0.08, 0);
  rightEar.name = 'rightEar';
  headGroup.add(rightEar);

  group.add(headGroup);

  // Arms (small cylinders at sides)
  const armGeometry = new THREE.CylinderGeometry(0.03, 0.04, 0.2, 4);

  const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
  leftArm.position.set(-0.18, 0.35, 0);
  leftArm.rotation.z = 0.3;
  leftArm.name = 'leftArm';
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
  rightArm.position.set(0.18, 0.35, 0);
  rightArm.rotation.z = -0.3;
  rightArm.name = 'rightArm';
  group.add(rightArm);

  // Set shadows
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
    }
  });

  return group;
}
