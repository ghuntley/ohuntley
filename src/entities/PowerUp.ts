/**
 * Power-up entities for Meerkat Maze Runner
 * Collectible items that provide temporary effects
 */

import {
  SPEED_BOOST_MULTIPLIER,
  SPEED_BOOST_DURATION,
  INVISIBILITY_DURATION,
  FREEZE_DURATION,
  CELL_SIZE,
} from '../utils/Constants';
import { Position } from './Player';

/** Power-up types */
export enum PowerUpType {
  SPEED_BOOST = 'SPEED_BOOST',
  SPRINT_REFILL = 'SPRINT_REFILL',
  INVISIBILITY = 'INVISIBILITY',
  SHIELD = 'SHIELD',
  FREEZE = 'FREEZE',
}

/** Power-up state enum */
export enum PowerUpState {
  AVAILABLE = 'AVAILABLE',
  COLLECTED = 'COLLECTED',
}

/** Power-up visual configuration */
export interface PowerUpVisual {
  color: number;
  icon: string;
}

/** Visual configurations for each power-up type */
export const POWER_UP_VISUALS: Record<PowerUpType, PowerUpVisual> = {
  [PowerUpType.SPEED_BOOST]: { color: 0xffa500, icon: '⚡' }, // Orange
  [PowerUpType.SPRINT_REFILL]: { color: 0x0080ff, icon: '🔋' }, // Blue
  [PowerUpType.INVISIBILITY]: { color: 0x8b00ff, icon: '👻' }, // Purple
  [PowerUpType.SHIELD]: { color: 0x00ffff, icon: '🛡️' }, // Cyan
  [PowerUpType.FREEZE]: { color: 0xadd8e6, icon: '❄️' }, // Light blue
};

/**
 * Power-up collectible item
 */
export class PowerUp {
  // Unique identifier
  private id: number;
  private static nextId = 0;

  // Properties
  private type: PowerUpType;
  private position: Position;
  private state: PowerUpState;

  // Collision
  private collisionRadius: number;

  // Animation
  private rotation: number;
  private bobOffset: number;

  constructor(type: PowerUpType) {
    this.id = PowerUp.nextId++;
    this.type = type;
    this.position = { x: 0, y: 0, z: 0 };
    this.state = PowerUpState.AVAILABLE;
    this.collisionRadius = 0.6;
    this.rotation = 0;
    this.bobOffset = 0;
  }

  /**
   * Update power-up animation
   */
  update(deltaTime: number): void {
    if (this.state === PowerUpState.COLLECTED) return;

    // Rotate
    this.rotation += deltaTime * 2;

    // Bob up and down
    this.bobOffset = Math.sin(Date.now() * 0.004) * 0.15;
  }

  /**
   * Collect the power-up
   */
  collect(): boolean {
    if (this.state === PowerUpState.COLLECTED) return false;
    this.state = PowerUpState.COLLECTED;
    return true;
  }

  /**
   * Check if power-up is still available
   */
  isAvailable(): boolean {
    return this.state === PowerUpState.AVAILABLE;
  }

  /**
   * Reset power-up to initial state
   */
  reset(position?: Position): void {
    this.position = position ?? { x: 0, y: 0, z: 0 };
    this.state = PowerUpState.AVAILABLE;
    this.rotation = 0;
    this.bobOffset = 0;
  }

  // Getters

  getId(): number {
    return this.id;
  }

  getType(): PowerUpType {
    return this.type;
  }

  getPosition(): Position {
    return { ...this.position };
  }

  getDisplayPosition(): Position {
    return {
      x: this.position.x,
      y: this.position.y + 0.4 + this.bobOffset,
      z: this.position.z,
    };
  }

  getRotation(): number {
    return this.rotation;
  }

  getState(): PowerUpState {
    return this.state;
  }

  getCollisionRadius(): number {
    return this.collisionRadius;
  }

  getVisual(): PowerUpVisual {
    return POWER_UP_VISUALS[this.type];
  }

  // Setters

  setPosition(position: Position): void {
    this.position = { ...position };
  }

  /**
   * Check if player is within collection range
   */
  checkCollection(playerPosition: Position, playerRadius: number): boolean {
    if (this.state === PowerUpState.COLLECTED) return false;

    const dx = this.position.x - playerPosition.x;
    const dz = this.position.z - playerPosition.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    return distance < this.collisionRadius + playerRadius;
  }
}

/**
 * Active power-up effect
 */
export interface ActiveEffect {
  type: PowerUpType;
  remainingTime: number;
  duration: number;
}

/**
 * Power-up effect manager
 * Tracks active effects on the player
 */
export class PowerUpEffectManager {
  private activeEffects: Map<PowerUpType, ActiveEffect>;
  private hasShield: boolean;
  private isInvisible: boolean;
  private speedMultiplier: number;

  // Callbacks for effects
  private onFreezeZombies?: (duration: number) => void;
  private onRefillSprint?: () => void;

  constructor() {
    this.activeEffects = new Map();
    this.hasShield = false;
    this.isInvisible = false;
    this.speedMultiplier = 1;
  }

  /**
   * Apply a power-up effect
   */
  applyEffect(type: PowerUpType): void {
    switch (type) {
      case PowerUpType.SPEED_BOOST:
        this.activeEffects.set(type, {
          type,
          remainingTime: SPEED_BOOST_DURATION,
          duration: SPEED_BOOST_DURATION,
        });
        this.speedMultiplier = SPEED_BOOST_MULTIPLIER;
        break;

      case PowerUpType.SPRINT_REFILL:
        // Instant effect
        this.onRefillSprint?.();
        break;

      case PowerUpType.INVISIBILITY:
        this.activeEffects.set(type, {
          type,
          remainingTime: INVISIBILITY_DURATION,
          duration: INVISIBILITY_DURATION,
        });
        this.isInvisible = true;
        break;

      case PowerUpType.SHIELD:
        this.hasShield = true;
        // Shield doesn't have a timer - it lasts until hit
        break;

      case PowerUpType.FREEZE:
        // Instant effect that affects zombies
        this.onFreezeZombies?.(FREEZE_DURATION);
        break;
    }
  }

  /**
   * Update active effects
   */
  update(deltaTime: number): void {
    for (const [type, effect] of this.activeEffects) {
      effect.remainingTime -= deltaTime;

      if (effect.remainingTime <= 0) {
        this.activeEffects.delete(type);
        this.onEffectExpired(type);
      }
    }
  }

  /**
   * Handle effect expiration
   */
  private onEffectExpired(type: PowerUpType): void {
    switch (type) {
      case PowerUpType.SPEED_BOOST:
        this.speedMultiplier = 1;
        break;
      case PowerUpType.INVISIBILITY:
        this.isInvisible = false;
        break;
    }
  }

  /**
   * Use shield to prevent death
   * @returns true if shield was consumed
   */
  useShield(): boolean {
    if (this.hasShield) {
      this.hasShield = false;
      return true;
    }
    return false;
  }

  /**
   * Reset all effects
   */
  reset(): void {
    this.activeEffects.clear();
    this.hasShield = false;
    this.isInvisible = false;
    this.speedMultiplier = 1;
  }

  // Getters

  getActiveEffects(): ActiveEffect[] {
    return Array.from(this.activeEffects.values());
  }

  hasActiveEffect(type: PowerUpType): boolean {
    return this.activeEffects.has(type) || (type === PowerUpType.SHIELD && this.hasShield);
  }

  getEffectRemainingTime(type: PowerUpType): number {
    return this.activeEffects.get(type)?.remainingTime ?? 0;
  }

  getEffectProgress(type: PowerUpType): number {
    const effect = this.activeEffects.get(type);
    if (!effect) return 0;
    return effect.remainingTime / effect.duration;
  }

  getHasShield(): boolean {
    return this.hasShield;
  }

  getIsInvisible(): boolean {
    return this.isInvisible;
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  // Setters for callbacks

  setOnFreezeZombies(callback: (duration: number) => void): void {
    this.onFreezeZombies = callback;
  }

  setOnRefillSprint(callback: () => void): void {
    this.onRefillSprint = callback;
  }
}
