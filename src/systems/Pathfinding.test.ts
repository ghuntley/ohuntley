/**
 * Tests for A* Pathfinding System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Pathfinding } from './Pathfinding';
import { MazeGenerator } from '../maze/MazeGenerator';

describe('Pathfinding', () => {
  let maze: MazeGenerator;
  let pathfinding: Pathfinding;

  beforeEach(() => {
    // Create a small maze with a fixed seed for reproducibility
    maze = new MazeGenerator({ width: 5, height: 5, seed: 12345 });
    maze.generate();
    pathfinding = new Pathfinding(maze);
  });

  describe('findPath', () => {
    it('should find path from start to exit', () => {
      const start = maze.getStart();
      const exit = maze.getExit();

      const path = pathfinding.findPath(start, exit);

      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toEqual(start);
      expect(path[path.length - 1]).toEqual(exit);
    });

    it('should return single-element path when already at goal', () => {
      const start = { x: 2, y: 2 };
      const path = pathfinding.findPath(start, start);

      expect(path).toHaveLength(1);
      expect(path[0]).toEqual(start);
    });

    it('should return empty array for invalid start position', () => {
      const path = pathfinding.findPath({ x: -1, y: 0 }, { x: 2, y: 2 });
      expect(path).toHaveLength(0);
    });

    it('should return empty array for invalid goal position', () => {
      const path = pathfinding.findPath({ x: 0, y: 0 }, { x: 100, y: 100 });
      expect(path).toHaveLength(0);
    });

    it('should find shortest path', () => {
      // In a maze generated with recursive backtracking,
      // there's exactly one path between any two points
      const start = maze.getStart();
      const exit = maze.getExit();

      const path = pathfinding.findPath(start, exit);

      // Each step should be to an adjacent cell
      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        const dx = Math.abs(curr.x - prev.x);
        const dy = Math.abs(curr.y - prev.y);

        // Each move should be exactly one step in one direction
        expect(dx + dy).toBe(1);
      }
    });

    it('should only move through accessible passages', () => {
      const start = maze.getStart();
      const exit = maze.getExit();

      const path = pathfinding.findPath(start, exit);

      // Verify each step is a valid move (no wall between cells)
      for (let i = 0; i < path.length - 1; i++) {
        const curr = path[i];
        const next = path[i + 1];

        // Check that next is an accessible neighbor of curr
        const neighbors = maze.getAccessibleNeighbors(curr.x, curr.y);
        const isAccessible = neighbors.some((n) => n.x === next.x && n.y === next.y);

        expect(isAccessible).toBe(true);
      }
    });
  });

  describe('hasPath', () => {
    it('should return true when path exists', () => {
      const start = maze.getStart();
      const exit = maze.getExit();

      expect(pathfinding.hasPath(start, exit)).toBe(true);
    });

    it('should return false for invalid positions', () => {
      expect(pathfinding.hasPath({ x: -1, y: 0 }, { x: 2, y: 2 })).toBe(false);
    });

    it('should return true when start equals goal', () => {
      const point = { x: 2, y: 2 };
      expect(pathfinding.hasPath(point, point)).toBe(true);
    });
  });

  describe('getNextStep', () => {
    it('should return the next cell in the path', () => {
      const start = maze.getStart();
      const exit = maze.getExit();

      const nextStep = pathfinding.getNextStep(start, exit);

      expect(nextStep).not.toBeNull();

      // Next step should be adjacent to start
      const dx = Math.abs(nextStep!.x - start.x);
      const dy = Math.abs(nextStep!.y - start.y);
      expect(dx + dy).toBe(1);
    });

    it('should return null when already at goal', () => {
      const point = { x: 2, y: 2 };
      const nextStep = pathfinding.getNextStep(point, point);

      expect(nextStep).toBeNull();
    });

    it('should return null for invalid positions', () => {
      const nextStep = pathfinding.getNextStep({ x: -1, y: 0 }, { x: 2, y: 2 });
      expect(nextStep).toBeNull();
    });
  });

  describe('getPathLength', () => {
    it('should return correct path length', () => {
      const start = maze.getStart();
      const exit = maze.getExit();

      const path = pathfinding.findPath(start, exit);
      const length = pathfinding.getPathLength(start, exit);

      // Path length should be number of steps (path.length - 1)
      expect(length).toBe(path.length - 1);
    });

    it('should return 0 when start equals goal', () => {
      const point = { x: 2, y: 2 };
      expect(pathfinding.getPathLength(point, point)).toBe(0);
    });

    it('should return -1 for invalid positions', () => {
      expect(pathfinding.getPathLength({ x: -1, y: 0 }, { x: 2, y: 2 })).toBe(-1);
    });
  });

  describe('setMaze', () => {
    it('should update the maze reference', () => {
      // Create a new maze with different seed
      const newMaze = new MazeGenerator({ width: 7, height: 7, seed: 54321 });
      newMaze.generate();

      pathfinding.setMaze(newMaze);

      // Should now find paths in the new maze
      const start = newMaze.getStart();
      const exit = newMaze.getExit();
      const path = pathfinding.findPath(start, exit);

      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual(exit);
    });
  });

  describe('performance', () => {
    it('should handle larger mazes efficiently', () => {
      // Create a larger maze
      const largeMaze = new MazeGenerator({ width: 20, height: 20, seed: 99999 });
      largeMaze.generate();
      const largePathfinding = new Pathfinding(largeMaze);

      const start = largeMaze.getStart();
      const exit = largeMaze.getExit();

      const startTime = performance.now();
      const path = largePathfinding.findPath(start, exit);
      const endTime = performance.now();

      expect(path.length).toBeGreaterThan(0);
      // Should complete in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
