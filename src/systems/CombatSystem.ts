/**
 * Combat System for Meerkat Maze Runner
 * Handles sword attacks and hit detection
 */

import { Player, Position } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import {
  ATTACK_COOLDOWN,
  SWORD_RANGE,
  SWORD_ARC,
} from '../utils/Constants';

/** Attack result interface */
export interface AttackResult {
  hit: boolean;
  hitZombies: Zombie[];
}

/**
 * Combat system for handling player attacks
 */
export class CombatSystem {
  private attackCooldown: number;
  private swordRange: number;
  private swordArc: number; // in degrees

  constructor(config?: {
    attackCooldown?: number;
    swordRange?: number;
    swordArc?: number;
  }) {
    this.attackCooldown = config?.attackCooldown ?? ATTACK_COOLDOWN;
    this.swordRange = config?.swordRange ?? SWORD_RANGE;
    this.swordArc = config?.swordArc ?? SWORD_ARC;
  }

  /**
   * Perform a sword attack
   * @param player The attacking player
   * @param zombies Array of all zombies to check for hits
   * @returns Result of the attack including which zombies were hit
   */
  attack(player: Player, zombies: Zombie[]): AttackResult {
    const result: AttackResult = {
      hit: false,
      hitZombies: [],
    };

    // Check if player can attack
    if (!player.getHasSword()) {
      return result;
    }

    if (!player.attack()) {
      return result;
    }

    // Check each zombie for hit
    const playerPos = player.getPosition();
    const playerRotation = player.getRotation();

    for (const zombie of zombies) {
      if (!zombie.isAlive()) continue;

      if (this.isInAttackArc(playerPos, playerRotation, zombie)) {
        result.hitZombies.push(zombie);
        result.hit = true;
      }
    }

    return result;
  }

  /**
   * Check if a zombie is within the attack arc
   */
  private isInAttackArc(
    playerPos: Position,
    playerRotation: number,
    zombie: Zombie
  ): boolean {
    const zombiePos = zombie.getPosition();

    // Calculate distance
    const dx = zombiePos.x - playerPos.x;
    const dz = zombiePos.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Check if within range (including zombie collision radius)
    const effectiveRange = this.swordRange + zombie.getCollisionRadius();
    if (distance > effectiveRange) {
      return false;
    }

    // Calculate angle to zombie
    const angleToZombie = Math.atan2(dx, dz);

    // Calculate angle difference
    let angleDiff = angleToZombie - playerRotation;

    // Normalize angle difference to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Check if within arc
    const halfArcRad = (this.swordArc / 2) * (Math.PI / 180);
    return Math.abs(angleDiff) <= halfArcRad;
  }

  /**
   * Check if a point is within attack range and arc
   * Useful for debugging or visual feedback
   */
  isPointInAttackRange(
    playerPos: Position,
    playerRotation: number,
    point: Position
  ): boolean {
    const dx = point.x - playerPos.x;
    const dz = point.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > this.swordRange) {
      return false;
    }

    const angleToPoint = Math.atan2(dx, dz);
    let angleDiff = angleToPoint - playerRotation;

    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const halfArcRad = (this.swordArc / 2) * (Math.PI / 180);
    return Math.abs(angleDiff) <= halfArcRad;
  }

  // Getters

  getAttackCooldown(): number {
    return this.attackCooldown;
  }

  getSwordRange(): number {
    return this.swordRange;
  }

  getSwordArc(): number {
    return this.swordArc;
  }
}
