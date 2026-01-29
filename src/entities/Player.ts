/**
 * Player entity for Meerkat Maze Runner
 * Controls the meerkat character with movement and sprint mechanics
 */

import {
  PLAYER_WALK_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
  SPRINT_GAUGE_CAPACITY,
  SPRINT_REGEN_TIME,
  PLAYER_COLLISION_RADIUS,
  PLAYER_HEIGHT,
} from '../utils/Constants';

/** Position in 3D space */
export interface Position {
  x: number;
  y: number;
  z: number;
}

/** Player state enum */
export enum PlayerState {
  IDLE = 'IDLE',
  WALKING = 'WALKING',
  SPRINTING = 'SPRINTING',
  ATTACKING = 'ATTACKING',
  DEAD = 'DEAD',
}

/** Player configuration */
export interface PlayerConfig {
  walkSpeed?: number;
  sprintMultiplier?: number;
  sprintCapacity?: number;
  sprintRegenTime?: number;
  collisionRadius?: number;
  height?: number;
}

/**
 * Player character class
 * Handles movement, sprint gauge, and state management
 */
export class Player {
  // Position and rotation
  private position: Position;
  private rotation: number; // Y-axis rotation in radians

  // Movement
  private walkSpeed: number;
  private sprintMultiplier: number;
  private velocity: Position;

  // Sprint system
  private sprintCapacity: number;
  private sprintGauge: number;
  private sprintRegenRate: number;
  private isSprinting: boolean;

  // State
  private state: PlayerState;
  private hasSword: boolean;
  private hasShield: boolean;

  // Collision
  private collisionRadius: number;
  private height: number;

  // Attack cooldown
  private attackCooldown: number;
  private attackCooldownTimer: number;

  constructor(config: PlayerConfig = {}) {
    // Initialize with defaults from constants
    this.walkSpeed = config.walkSpeed ?? PLAYER_WALK_SPEED;
    this.sprintMultiplier = config.sprintMultiplier ?? PLAYER_SPRINT_MULTIPLIER;
    this.sprintCapacity = config.sprintCapacity ?? SPRINT_GAUGE_CAPACITY;
    this.sprintRegenRate = this.sprintCapacity / (config.sprintRegenTime ?? SPRINT_REGEN_TIME);
    this.collisionRadius = config.collisionRadius ?? PLAYER_COLLISION_RADIUS;
    this.height = config.height ?? PLAYER_HEIGHT;

    // Initialize position
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = 0;
    this.velocity = { x: 0, y: 0, z: 0 };

    // Initialize sprint
    this.sprintGauge = this.sprintCapacity;
    this.isSprinting = false;

    // Initialize state
    this.state = PlayerState.IDLE;
    this.hasSword = false;
    this.hasShield = false;

    // Attack cooldown
    this.attackCooldown = 0.5;
    this.attackCooldownTimer = 0;
  }

  /**
   * Update player state
   * @param deltaTime Time since last update in seconds
   * @param moveInput Movement input vector { x, y } where y is forward/back
   * @param sprintInput Whether sprint key is held
   */
  update(
    deltaTime: number,
    moveInput: { x: number; y: number },
    sprintInput: boolean
  ): void {
    if (this.state === PlayerState.DEAD) return;

    // Update attack cooldown
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= deltaTime;
    }

    // Update sprint state
    this.updateSprint(deltaTime, sprintInput, moveInput);

    // Calculate movement
    this.updateMovement(deltaTime, moveInput);

    // Update player state
    this.updateState(moveInput);
  }

  /**
   * Update sprint gauge and state
   */
  private updateSprint(
    deltaTime: number,
    sprintInput: boolean,
    moveInput: { x: number; y: number }
  ): void {
    const isMoving = moveInput.x !== 0 || moveInput.y !== 0;

    // Can only sprint if moving and has gauge
    if (sprintInput && isMoving && this.sprintGauge > 0) {
      this.isSprinting = true;
      this.sprintGauge = Math.max(0, this.sprintGauge - deltaTime);
    } else {
      this.isSprinting = false;

      // Only regenerate sprint when NOT holding sprint key
      // (don't regenerate while player is trying to sprint with empty gauge)
      if (!sprintInput && this.sprintGauge < this.sprintCapacity) {
        this.sprintGauge = Math.min(
          this.sprintCapacity,
          this.sprintGauge + this.sprintRegenRate * deltaTime
        );
      }
    }
  }

  /**
   * Update position based on input
   */
  private updateMovement(
    deltaTime: number,
    moveInput: { x: number; y: number }
  ): void {
    // Calculate speed
    const speed = this.isSprinting
      ? this.walkSpeed * this.sprintMultiplier
      : this.walkSpeed;

    // Apply movement (x is left/right, y is forward/back which maps to z in 3D)
    this.velocity.x = moveInput.x * speed;
    this.velocity.z = moveInput.y * speed;

    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Update rotation to face movement direction
    if (moveInput.x !== 0 || moveInput.y !== 0) {
      this.rotation = Math.atan2(moveInput.x, moveInput.y);
    }
  }

  /**
   * Update player state based on current activity
   */
  private updateState(moveInput: { x: number; y: number }): void {
    if (this.state === PlayerState.DEAD) return;
    if (this.state === PlayerState.ATTACKING && this.attackCooldownTimer > 0) {
      return;
    }

    const isMoving = moveInput.x !== 0 || moveInput.y !== 0;

    if (!isMoving) {
      this.state = PlayerState.IDLE;
    } else if (this.isSprinting) {
      this.state = PlayerState.SPRINTING;
    } else {
      this.state = PlayerState.WALKING;
    }
  }

  /**
   * Attempt to attack
   * @returns true if attack was performed
   */
  attack(): boolean {
    if (this.state === PlayerState.DEAD) return false;
    if (!this.hasSword) return false;
    if (this.attackCooldownTimer > 0) return false;

    this.state = PlayerState.ATTACKING;
    this.attackCooldownTimer = this.attackCooldown;
    return true;
  }

  /**
   * Kill the player
   */
  die(): void {
    this.state = PlayerState.DEAD;
    this.velocity = { x: 0, y: 0, z: 0 };
  }

  /**
   * Reset player to initial state
   */
  reset(startPosition?: Position): void {
    this.position = startPosition ?? { x: 0, y: 0, z: 0 };
    this.rotation = 0;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.sprintGauge = this.sprintCapacity;
    this.isSprinting = false;
    this.state = PlayerState.IDLE;
    this.hasSword = false;
    this.hasShield = false;
    this.attackCooldownTimer = 0;
  }

  // Getters

  getPosition(): Position {
    return { ...this.position };
  }

  getRotation(): number {
    return this.rotation;
  }

  getVelocity(): Position {
    return { ...this.velocity };
  }

  getState(): PlayerState {
    return this.state;
  }

  getSprintGauge(): number {
    return this.sprintGauge;
  }

  getSprintGaugePercent(): number {
    return this.sprintGauge / this.sprintCapacity;
  }

  getSprintCapacity(): number {
    return this.sprintCapacity;
  }

  isSprintActive(): boolean {
    return this.isSprinting;
  }

  getHasSword(): boolean {
    return this.hasSword;
  }

  getHasShield(): boolean {
    return this.hasShield;
  }

  isAlive(): boolean {
    return this.state !== PlayerState.DEAD;
  }

  getCollisionRadius(): number {
    return this.collisionRadius;
  }

  getHeight(): number {
    return this.height;
  }

  getCurrentSpeed(): number {
    const length = Math.sqrt(
      this.velocity.x ** 2 + this.velocity.y ** 2 + this.velocity.z ** 2
    );
    return length;
  }

  /**
   * Get attack cooldown as percentage (0 = ready, 1 = just attacked)
   */
  getAttackCooldownPercent(): number {
    if (this.attackCooldown <= 0) return 0;
    return Math.max(0, Math.min(1, this.attackCooldownTimer / this.attackCooldown));
  }

  /**
   * Check if attack is on cooldown
   */
  isAttackOnCooldown(): boolean {
    return this.attackCooldownTimer > 0;
  }

  // Setters

  setPosition(position: Position): void {
    this.position = { ...position };
  }

  setRotation(rotation: number): void {
    this.rotation = rotation;
  }

  pickupSword(): void {
    this.hasSword = true;
  }

  pickupShield(): void {
    this.hasShield = true;
  }

  useShield(): boolean {
    if (this.hasShield) {
      this.hasShield = false;
      return true;
    }
    return false;
  }

  /**
   * Refill sprint gauge to full capacity
   */
  refillSprint(): void {
    this.sprintGauge = this.sprintCapacity;
  }

  /**
   * Check if a point is within collision distance
   */
  checkCollision(point: Position): boolean {
    const dx = this.position.x - point.x;
    const dz = this.position.z - point.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance < this.collisionRadius;
  }

  /**
   * Get bounding box for collision detection
   */
  getBoundingBox(): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    return {
      minX: this.position.x - this.collisionRadius,
      maxX: this.position.x + this.collisionRadius,
      minZ: this.position.z - this.collisionRadius,
      maxZ: this.position.z + this.collisionRadius,
    };
  }
}
