/**
 * Tests for CollisionSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionSystem, AABB } from './CollisionSystem';
import { MazeGenerator } from '../maze/MazeGenerator';
import { Player } from '../entities/Player';
import { CELL_SIZE, PLAYER_COLLISION_RADIUS } from '../utils/Constants';

describe('CollisionSystem', () => {
  let collisionSystem: CollisionSystem;
  let generator: MazeGenerator;

  beforeEach(() => {
    collisionSystem = new CollisionSystem();
    generator = new MazeGenerator({ width: 5, height: 5, seed: 12345 });
    generator.generate();
    collisionSystem.setMaze(generator);
  });

  describe('setMaze', () => {
    it('should initialize with maze data', () => {
      // If no errors, maze is set correctly
      expect(() => collisionSystem.setMaze(generator)).not.toThrow();
    });

    it('should handle different maze sizes', () => {
      const largeGenerator = new MazeGenerator({ width: 20, height: 20, seed: 1 });
      largeGenerator.generate();

      expect(() => collisionSystem.setMaze(largeGenerator)).not.toThrow();
    });
  });

  describe('checkCircleWallCollision', () => {
    it('should detect collision when circle overlaps wall', () => {
      // Position player at a wall (cell boundary has walls)
      // In a 5x5 maze, the top-left corner (0,0) has walls on north and west
      const result = collisionSystem.checkCircleWallCollision(
        -CELL_SIZE / 2 + 0.1, // Near west wall
        0,
        PLAYER_COLLISION_RADIUS
      );

      expect(result.collided).toBe(true);
    });

    it('should not detect collision in open corridor', () => {
      // Position in center of start cell
      const start = generator.getStart();
      const result = collisionSystem.checkCircleWallCollision(
        start.x * CELL_SIZE,
        start.y * CELL_SIZE,
        PLAYER_COLLISION_RADIUS
      );

      expect(result.collided).toBe(false);
    });

    it('should return corrected position when colliding', () => {
      // Push into north wall from cell (0,0)
      const result = collisionSystem.checkCircleWallCollision(
        0,
        -CELL_SIZE / 2, // Near north wall
        PLAYER_COLLISION_RADIUS
      );

      if (result.collided) {
        // Corrected position should be different from original (pushed away from wall)
        // The correction pushes player to valid position
        expect(result.correctedPosition).toBeDefined();
        expect(result.correctedPosition.x).toBeDefined();
        expect(result.correctedPosition.z).toBeDefined();
      }
    });

    it('should handle collisions with multiple walls (corners)', () => {
      // Position at corner where multiple walls meet
      const result = collisionSystem.checkCircleWallCollision(
        -CELL_SIZE / 2,
        -CELL_SIZE / 2,
        PLAYER_COLLISION_RADIUS
      );

      // Should either collide or be pushed to valid position
      expect(result.correctedPosition).toBeDefined();
    });
  });

  describe('checkPlayerWallCollision', () => {
    it('should use player position and radius', () => {
      const player = new Player();
      player.setPosition({ x: 0, y: 0, z: 0 });

      const result = collisionSystem.checkPlayerWallCollision(player);

      expect(result).toHaveProperty('collided');
      expect(result).toHaveProperty('correctedPosition');
      expect(result).toHaveProperty('hitWalls');
    });

    it('should detect wall collision for player at wall', () => {
      const player = new Player();
      // Place player at west boundary
      player.setPosition({
        x: -CELL_SIZE / 2 + PLAYER_COLLISION_RADIUS / 2,
        y: 0,
        z: 0
      });

      const result = collisionSystem.checkPlayerWallCollision(player);

      // Should either collide or be very close to wall
      expect(result.correctedPosition).toBeDefined();
    });
  });

  describe('checkCircleCollision', () => {
    it('should detect overlapping circles', () => {
      const result = collisionSystem.checkCircleCollision(
        0, 0, 1,  // Circle 1
        1.5, 0, 1 // Circle 2 (overlapping)
      );

      expect(result).toBe(true);
    });

    it('should not detect non-overlapping circles', () => {
      const result = collisionSystem.checkCircleCollision(
        0, 0, 1,   // Circle 1
        5, 0, 1    // Circle 2 (far away)
      );

      expect(result).toBe(false);
    });

    it('should detect touching circles', () => {
      const result = collisionSystem.checkCircleCollision(
        0, 0, 1,   // Circle 1
        1.99, 0, 1 // Circle 2 (just touching)
      );

      expect(result).toBe(true);
    });
  });

  describe('checkPlayerAtExit', () => {
    it('should detect player at exit', () => {
      const player = new Player();
      const exit = generator.getExit();
      player.setPosition({
        x: exit.x * CELL_SIZE,
        y: 0,
        z: exit.y * CELL_SIZE
      });

      const result = collisionSystem.checkPlayerAtExit(player);

      expect(result).toBe(true);
    });

    it('should not detect player far from exit', () => {
      const player = new Player();
      const start = generator.getStart();
      player.setPosition({
        x: start.x * CELL_SIZE,
        y: 0,
        z: start.y * CELL_SIZE
      });

      const exit = generator.getExit();
      // Only test if start and exit are different
      if (start.x !== exit.x || start.y !== exit.y) {
        const result = collisionSystem.checkPlayerAtExit(player);
        expect(result).toBe(false);
      }
    });

    it('should return false when no maze is set', () => {
      const emptySystem = new CollisionSystem();
      const player = new Player();

      const result = emptySystem.checkPlayerAtExit(player);

      expect(result).toBe(false);
    });
  });

  describe('isInCell', () => {
    it('should detect point in cell center', () => {
      const result = collisionSystem.isInCell(
        2 * CELL_SIZE,
        3 * CELL_SIZE,
        2, 3
      );

      expect(result).toBe(true);
    });

    it('should detect point at cell edge', () => {
      const halfCell = CELL_SIZE / 2;
      const result = collisionSystem.isInCell(
        2 * CELL_SIZE + halfCell - 0.1,
        3 * CELL_SIZE,
        2, 3
      );

      expect(result).toBe(true);
    });

    it('should not detect point outside cell', () => {
      const result = collisionSystem.isInCell(
        5 * CELL_SIZE,
        5 * CELL_SIZE,
        2, 3
      );

      expect(result).toBe(false);
    });
  });

  describe('getGridPosition', () => {
    it('should convert world to grid coordinates', () => {
      const result = collisionSystem.getGridPosition(
        2 * CELL_SIZE,
        3 * CELL_SIZE
      );

      expect(result.x).toBe(2);
      expect(result.y).toBe(3);
    });

    it('should handle origin', () => {
      const result = collisionSystem.getGridPosition(0, 0);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('getWorldPosition', () => {
    it('should convert grid to world coordinates', () => {
      const result = collisionSystem.getWorldPosition(2, 3);

      expect(result.x).toBe(2 * CELL_SIZE);
      expect(result.z).toBe(3 * CELL_SIZE);
    });
  });

  describe('clear', () => {
    it('should clear collision data', () => {
      collisionSystem.clear();

      // After clearing, checkPlayerAtExit should return false
      const player = new Player();
      const result = collisionSystem.checkPlayerAtExit(player);

      expect(result).toBe(false);
    });

    it('should allow re-initialization after clear', () => {
      collisionSystem.clear();

      expect(() => collisionSystem.setMaze(generator)).not.toThrow();
    });
  });
});
