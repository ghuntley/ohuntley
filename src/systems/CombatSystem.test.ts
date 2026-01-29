/**
 * Tests for Combat System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from './CombatSystem';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { MazeGenerator } from '../maze/MazeGenerator';
import { Pathfinding } from './Pathfinding';
import { SWORD_RANGE, SWORD_ARC } from '../utils/Constants';

describe('CombatSystem', () => {
  let combatSystem: CombatSystem;
  let player: Player;
  let zombie: Zombie;
  let maze: MazeGenerator;
  let pathfinding: Pathfinding;

  beforeEach(() => {
    combatSystem = new CombatSystem();
    player = new Player();
    zombie = new Zombie();

    maze = new MazeGenerator({ width: 10, height: 10, seed: 12345 });
    maze.generate();
    pathfinding = new Pathfinding(maze);
    zombie.initialize(maze, pathfinding);

    player.setPosition({ x: 5, y: 0, z: 5 });
    player.setRotation(0); // Facing positive Z direction (rotation = atan2(x, y))
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(combatSystem.getSwordRange()).toBe(SWORD_RANGE);
      expect(combatSystem.getSwordArc()).toBe(SWORD_ARC);
    });

    it('should accept custom config', () => {
      const customCombat = new CombatSystem({
        attackCooldown: 1,
        swordRange: 5,
        swordArc: 120,
      });

      expect(customCombat.getAttackCooldown()).toBe(1);
      expect(customCombat.getSwordRange()).toBe(5);
      expect(customCombat.getSwordArc()).toBe(120);
    });
  });

  describe('attack', () => {
    it('should not attack without sword', () => {
      zombie.setPosition({ x: 5, y: 0, z: 4 }); // In front of player

      const result = combatSystem.attack(player, [zombie]);

      expect(result.hit).toBe(false);
      expect(result.hitZombies).toHaveLength(0);
    });

    it('should attack when has sword and zombie in range', () => {
      player.pickupSword();
      zombie.setPosition({ x: 5, y: 0, z: 6 }); // 1 unit in front of player (positive Z is forward)

      const result = combatSystem.attack(player, [zombie]);

      expect(result.hit).toBe(true);
      expect(result.hitZombies).toContain(zombie);
    });

    it('should not hit zombie outside range', () => {
      player.pickupSword();
      zombie.setPosition({ x: 5, y: 0, z: 0 }); // Far away

      const result = combatSystem.attack(player, [zombie]);

      expect(result.hit).toBe(false);
      expect(result.hitZombies).toHaveLength(0);
    });

    it('should not hit zombie outside arc', () => {
      player.pickupSword();
      player.setRotation(0); // Facing north
      zombie.setPosition({ x: 10, y: 0, z: 5 }); // To the right, outside arc

      const result = combatSystem.attack(player, [zombie]);

      expect(result.hit).toBe(false);
    });

    it('should hit multiple zombies in range', () => {
      player.pickupSword();
      player.setRotation(0);

      const zombie2 = new Zombie();
      zombie2.initialize(maze, pathfinding);

      // Both zombies in front of player (positive Z is forward)
      zombie.setPosition({ x: 4.5, y: 0, z: 6 });
      zombie2.setPosition({ x: 5.5, y: 0, z: 6 });

      const result = combatSystem.attack(player, [zombie, zombie2]);

      expect(result.hit).toBe(true);
      expect(result.hitZombies).toHaveLength(2);
    });

    it('should not hit dead zombies', () => {
      player.pickupSword();
      zombie.setPosition({ x: 5, y: 0, z: 6 });
      zombie.die();

      const result = combatSystem.attack(player, [zombie]);

      expect(result.hit).toBe(false);
    });

    it('should respect attack cooldown', () => {
      player.pickupSword();
      zombie.setPosition({ x: 5, y: 0, z: 6 });

      // First attack should succeed
      const result1 = combatSystem.attack(player, [zombie]);
      expect(result1.hit).toBe(true);

      // Reset zombie (it would have been killed)
      zombie.reset({ x: 5, y: 0, z: 6 });
      zombie.initialize(maze, pathfinding);

      // Second attack immediately after should fail due to cooldown
      const result2 = combatSystem.attack(player, [zombie]);
      expect(result2.hit).toBe(false);
    });
  });

  describe('isPointInAttackRange', () => {
    it('should return true for point in range and arc', () => {
      const playerPos = { x: 5, y: 0, z: 5 };
      const playerRotation = 0; // Facing positive Z
      const point = { x: 5, y: 0, z: 6 }; // In front (positive Z direction)

      expect(combatSystem.isPointInAttackRange(playerPos, playerRotation, point)).toBe(true);
    });

    it('should return false for point outside range', () => {
      const playerPos = { x: 5, y: 0, z: 5 };
      const playerRotation = 0;
      const point = { x: 5, y: 0, z: 15 }; // Far away in front

      expect(combatSystem.isPointInAttackRange(playerPos, playerRotation, point)).toBe(false);
    });

    it('should return false for point outside arc', () => {
      const playerPos = { x: 5, y: 0, z: 5 };
      const playerRotation = 0; // Facing positive Z
      const point = { x: 5, y: 0, z: 4 }; // Behind player (negative Z direction)

      expect(combatSystem.isPointInAttackRange(playerPos, playerRotation, point)).toBe(false);
    });

    it('should handle different player rotations', () => {
      const playerPos = { x: 5, y: 0, z: 5 };

      // Facing east (positive X)
      const playerRotation = Math.PI / 2;
      const pointEast = { x: 6, y: 0, z: 5 };
      const pointWest = { x: 4, y: 0, z: 5 };

      expect(combatSystem.isPointInAttackRange(playerPos, playerRotation, pointEast)).toBe(true);
      expect(combatSystem.isPointInAttackRange(playerPos, playerRotation, pointWest)).toBe(false);
    });
  });
});
