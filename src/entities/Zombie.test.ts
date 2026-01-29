/**
 * Tests for Zombie Entity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Zombie, ZombieState } from './Zombie';
import { MazeGenerator } from '../maze/MazeGenerator';
import { Pathfinding } from '../systems/Pathfinding';
import { ZOMBIE_PATROL_SPEED, ZOMBIE_CHASE_SPEED, ZOMBIE_DETECTION_RADIUS, CELL_SIZE } from '../utils/Constants';

describe('Zombie', () => {
  let zombie: Zombie;
  let maze: MazeGenerator;
  let pathfinding: Pathfinding;

  beforeEach(() => {
    zombie = new Zombie();
    maze = new MazeGenerator({ width: 10, height: 10, seed: 12345 });
    maze.generate();
    pathfinding = new Pathfinding(maze);
    zombie.initialize(maze, pathfinding);
    zombie.setPosition({ x: CELL_SIZE * 5, y: 0, z: CELL_SIZE * 5 }); // Start in middle of maze
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const newZombie = new Zombie();
      expect(newZombie.getState()).toBe(ZombieState.PATROL);
      expect(newZombie.isAlive()).toBe(true);
      expect(newZombie.isFrozen()).toBe(false);
    });

    it('should accept custom config', () => {
      const customZombie = new Zombie({
        patrolSpeed: 1,
        chaseSpeed: 5,
        detectionRadius: 10,
        collisionRadius: 0.5,
      });
      expect(customZombie.getDetectionRadius()).toBe(10);
      expect(customZombie.getCollisionRadius()).toBe(0.5);
    });

    it('should have unique IDs', () => {
      const zombie1 = new Zombie();
      const zombie2 = new Zombie();
      expect(zombie1.getId()).not.toBe(zombie2.getId());
    });
  });

  describe('state management', () => {
    it('should start in PATROL state', () => {
      expect(zombie.getState()).toBe(ZombieState.PATROL);
    });

    it('should transition to CHASE when player is detected', () => {
      // Place player very close to zombie (within detection radius)
      const playerPos = {
        x: zombie.getPosition().x + 1,
        y: 0,
        z: zombie.getPosition().z,
      };

      zombie.update(0.016, playerPos, true);
      // After detecting player, should be in chase state
      expect(zombie.getState()).toBe(ZombieState.CHASE);
    });

    it('should not detect player when canDetectPlayer is false', () => {
      const playerPos = {
        x: zombie.getPosition().x + 1,
        y: 0,
        z: zombie.getPosition().z,
      };

      zombie.update(0.016, playerPos, false); // Player is invisible
      expect(zombie.getState()).toBe(ZombieState.PATROL);
    });

    it('should transition to FROZEN state when frozen', () => {
      zombie.freeze(5);
      expect(zombie.getState()).toBe(ZombieState.FROZEN);
      expect(zombie.isFrozen()).toBe(true);
    });

    it('should unfreeze after duration expires', () => {
      zombie.freeze(1);
      expect(zombie.isFrozen()).toBe(true);

      // Update for longer than freeze duration
      const playerPos = { x: 100, y: 0, z: 100 }; // Far away
      zombie.update(0.5, playerPos, true);
      expect(zombie.isFrozen()).toBe(true);

      zombie.update(0.6, playerPos, true);
      expect(zombie.isFrozen()).toBe(false);
    });

    it('should transition to DEAD state when killed', () => {
      zombie.die();
      expect(zombie.getState()).toBe(ZombieState.DEAD);
      expect(zombie.isAlive()).toBe(false);
    });
  });

  describe('movement', () => {
    it('should not move when frozen', () => {
      zombie.freeze(5);
      const initialPos = zombie.getPosition();
      const playerPos = { x: 0, y: 0, z: 0 };

      zombie.update(1, playerPos, true);

      const newPos = zombie.getPosition();
      expect(newPos.x).toBe(initialPos.x);
      expect(newPos.z).toBe(initialPos.z);
    });

    it('should not move when dead', () => {
      zombie.die();
      const initialPos = zombie.getPosition();
      const playerPos = { x: 0, y: 0, z: 0 };

      zombie.update(1, playerPos, true);

      const newPos = zombie.getPosition();
      expect(newPos.x).toBe(initialPos.x);
      expect(newPos.z).toBe(initialPos.z);
    });

    it('should update rotation when moving', () => {
      // Force a chase state with player in a specific direction
      const playerPos = {
        x: zombie.getPosition().x + CELL_SIZE,
        y: 0,
        z: zombie.getPosition().z,
      };

      zombie.update(0.1, playerPos, true);
      // Rotation should have updated
      expect(zombie.getRotation()).toBeDefined();
    });
  });

  describe('collision detection', () => {
    it('should detect collision with point at position', () => {
      zombie.setPosition({ x: 5, y: 0, z: 5 });
      expect(zombie.checkCollision({ x: 5, y: 0, z: 5 })).toBe(true);
    });

    it('should not detect collision with far point', () => {
      zombie.setPosition({ x: 5, y: 0, z: 5 });
      expect(zombie.checkCollision({ x: 100, y: 0, z: 100 })).toBe(false);
    });

    it('should detect collision with radius', () => {
      zombie.setPosition({ x: 5, y: 0, z: 5 });
      const point = { x: 5.5, y: 0, z: 5 };
      const radius = 0.5;

      expect(zombie.checkCollisionWithRadius(point, radius)).toBe(true);
    });

    it('should return correct bounding box', () => {
      zombie.setPosition({ x: 10, y: 0, z: 10 });
      const box = zombie.getBoundingBox();
      const radius = zombie.getCollisionRadius();

      expect(box.minX).toBe(10 - radius);
      expect(box.maxX).toBe(10 + radius);
      expect(box.minZ).toBe(10 - radius);
      expect(box.maxZ).toBe(10 + radius);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      // Put zombie in a complex state
      zombie.setPosition({ x: 50, y: 0, z: 50 });
      zombie.freeze(10);

      // Reset
      zombie.reset({ x: 0, y: 0, z: 0 });

      expect(zombie.getPosition()).toEqual({ x: 0, y: 0, z: 0 });
      expect(zombie.getState()).toBe(ZombieState.PATROL);
      expect(zombie.isFrozen()).toBe(false);
    });

    it('should reset to origin if no position provided', () => {
      zombie.setPosition({ x: 50, y: 0, z: 50 });
      zombie.reset();

      expect(zombie.getPosition()).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('getters and setters', () => {
    it('should get and set position correctly', () => {
      const newPos = { x: 10, y: 0, z: 20 };
      zombie.setPosition(newPos);

      const pos = zombie.getPosition();
      expect(pos.x).toBe(10);
      expect(pos.z).toBe(20);

      // Should return a copy, not the original
      pos.x = 999;
      expect(zombie.getPosition().x).toBe(10);
    });

    it('should get and set rotation correctly', () => {
      zombie.setRotation(Math.PI);
      expect(zombie.getRotation()).toBe(Math.PI);
    });

    it('should return a copy of velocity', () => {
      const vel = zombie.getVelocity();
      vel.x = 999;
      expect(zombie.getVelocity().x).not.toBe(999);
    });
  });

  describe('detection radius', () => {
    it('should use default detection radius', () => {
      const defaultZombie = new Zombie();
      expect(defaultZombie.getDetectionRadius()).toBe(ZOMBIE_DETECTION_RADIUS);
    });

    it('should use custom detection radius', () => {
      const customZombie = new Zombie({ detectionRadius: 15 });
      expect(customZombie.getDetectionRadius()).toBe(15);
    });

    it('should not detect player outside detection radius', () => {
      const farPlayerPos = {
        x: zombie.getPosition().x + ZOMBIE_DETECTION_RADIUS + 10,
        y: 0,
        z: zombie.getPosition().z,
      };

      zombie.update(0.1, farPlayerPos, true);
      expect(zombie.getState()).toBe(ZombieState.PATROL);
    });
  });
});
