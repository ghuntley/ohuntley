/**
 * Sword pickup entity for Meerkat Maze Runner
 * Collectible item that enables player combat
 */

import { CELL_SIZE } from '../utils/Constants';
import { Position } from './Player';

/** Sword state enum */
export enum SwordState {
  AVAILABLE = 'AVAILABLE',
  COLLECTED = 'COLLECTED',
}

/**
 * Sword pickup item
 * When collected, enables player to attack zombies
 */
export class Sword {
  // Unique identifier
  private id: number;
  private static nextId = 0;

  // Position
  private position: Position;

  // State
  private state: SwordState;

  // Collision
  private collisionRadius: number;

  // Animation
  private rotation: number;
  private bobOffset: number;

  constructor() {
    this.id = Sword.nextId++;
    this.position = { x: 0, y: 0, z: 0 };
    this.state = SwordState.AVAILABLE;
    this.collisionRadius = 0.8;
    this.rotation = 0;
    this.bobOffset = 0;
  }

  /**
   * Update sword animation
   */
  update(deltaTime: number): void {
    if (this.state === SwordState.COLLECTED) return;

    // Rotate slowly
    this.rotation += deltaTime * 1.5;

    // Bob up and down
    this.bobOffset = Math.sin(Date.now() * 0.003) * 0.2;
  }

  /**
   * Collect the sword
   */
  collect(): boolean {
    if (this.state === SwordState.COLLECTED) return false;
    this.state = SwordState.COLLECTED;
    return true;
  }

  /**
   * Check if sword is still available
   */
  isAvailable(): boolean {
    return this.state === SwordState.AVAILABLE;
  }

  /**
   * Reset sword to initial state
   */
  reset(position?: Position): void {
    this.position = position ?? { x: 0, y: 0, z: 0 };
    this.state = SwordState.AVAILABLE;
    this.rotation = 0;
    this.bobOffset = 0;
  }

  // Getters

  getId(): number {
    return this.id;
  }

  getPosition(): Position {
    return { ...this.position };
  }

  getDisplayPosition(): Position {
    return {
      x: this.position.x,
      y: this.position.y + 0.5 + this.bobOffset,
      z: this.position.z,
    };
  }

  getRotation(): number {
    return this.rotation;
  }

  getState(): SwordState {
    return this.state;
  }

  getCollisionRadius(): number {
    return this.collisionRadius;
  }

  // Setters

  setPosition(position: Position): void {
    this.position = { ...position };
  }

  /**
   * Check if player is within collection range
   */
  checkCollection(playerPosition: Position, playerRadius: number): boolean {
    if (this.state === SwordState.COLLECTED) return false;

    const dx = this.position.x - playerPosition.x;
    const dz = this.position.z - playerPosition.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    return distance < this.collisionRadius + playerRadius;
  }
}
