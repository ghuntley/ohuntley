/**
 * Tests for Line of Sight System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LineOfSight } from './LineOfSight';
import { MazeGenerator } from '../maze/MazeGenerator';
import { CELL_SIZE } from '../utils/Constants';

describe('LineOfSight', () => {
  let maze: MazeGenerator;
  let los: LineOfSight;

  beforeEach(() => {
    // Create a small maze with a fixed seed for reproducibility
    maze = new MazeGenerator({ width: 5, height: 5, seed: 12345 });
    maze.generate();
    los = new LineOfSight(maze);
  });

  describe('hasLineOfSight', () => {
    it('should return true when checking same position', () => {
      const x = 2 * CELL_SIZE;
      const z = 2 * CELL_SIZE;
      expect(los.hasLineOfSight(x, z, x, z)).toBe(true);
    });

    it('should return true when checking same cell different positions', () => {
      const x1 = 2 * CELL_SIZE + 0.5;
      const z1 = 2 * CELL_SIZE + 0.5;
      const x2 = 2 * CELL_SIZE - 0.5;
      const z2 = 2 * CELL_SIZE - 0.5;
      expect(los.hasLineOfSight(x1, z1, x2, z2)).toBe(true);
    });

    it('should return true for adjacent accessible cells', () => {
      // Start position should be accessible
      const start = maze.getStart();
      const neighbors = maze.getAccessibleNeighbors(start.x, start.y);

      if (neighbors.length > 0) {
        const neighbor = neighbors[0];
        const startWorld = { x: start.x * CELL_SIZE, z: start.y * CELL_SIZE };
        const neighborWorld = { x: neighbor.x * CELL_SIZE, z: neighbor.y * CELL_SIZE };

        expect(los.hasLineOfSight(
          startWorld.x,
          startWorld.z,
          neighborWorld.x,
          neighborWorld.z
        )).toBe(true);
      }
    });

    it('should return false when wall blocks line of sight', () => {
      // Find two adjacent cells with a wall between them
      const grid = maze.getGrid();
      const { width, height } = maze.getDimensions();

      // Find a cell with a wall to the east
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width - 1; x++) {
          const cell = grid[y][x];
          // Direction.EAST = 1
          if (cell.walls[1]) {
            // There's a wall between (x, y) and (x+1, y)
            const result = los.hasLineOfSight(
              x * CELL_SIZE,
              y * CELL_SIZE,
              (x + 1) * CELL_SIZE,
              y * CELL_SIZE
            );
            expect(result).toBe(false);
            return; // Test passed, exit
          }
        }
      }
    });
  });

  describe('hasLineOfSightGrid', () => {
    it('should return true for same position', () => {
      const point = { x: 2, y: 2 };
      expect(los.hasLineOfSightGrid(point, point)).toBe(true);
    });

    it('should return true for accessible neighbors', () => {
      const start = maze.getStart();
      const neighbors = maze.getAccessibleNeighbors(start.x, start.y);

      if (neighbors.length > 0) {
        expect(los.hasLineOfSightGrid(start, neighbors[0])).toBe(true);
      }
    });
  });

  describe('getVisibleCells', () => {
    it('should always include the origin cell', () => {
      const x = 2 * CELL_SIZE;
      const z = 2 * CELL_SIZE;
      const visibleCells = los.getVisibleCells(x, z, 3);

      expect(visibleCells.has('2,2')).toBe(true);
    });

    it('should include accessible neighbors within radius', () => {
      const start = maze.getStart();
      const visibleCells = los.getVisibleCells(
        start.x * CELL_SIZE,
        start.y * CELL_SIZE,
        3
      );

      // Should at least contain the start cell
      expect(visibleCells.has(`${start.x},${start.y}`)).toBe(true);

      // Check that accessible neighbors are visible
      const neighbors = maze.getAccessibleNeighbors(start.x, start.y);
      for (const neighbor of neighbors) {
        expect(visibleCells.has(`${neighbor.x},${neighbor.y}`)).toBe(true);
      }
    });

    it('should respect radius limit', () => {
      const x = 2 * CELL_SIZE;
      const z = 2 * CELL_SIZE;
      const radius = 2;
      const visibleCells = los.getVisibleCells(x, z, radius);

      // All visible cells should be within radius
      for (const cellKey of visibleCells) {
        const [cx, cy] = cellKey.split(',').map(Number);
        const distance = Math.sqrt((cx - 2) ** 2 + (cy - 2) ** 2);
        expect(distance).toBeLessThanOrEqual(radius);
      }
    });

    it('should not include cells outside maze bounds', () => {
      const { width, height } = maze.getDimensions();
      const x = 0; // Edge of maze
      const z = 0;
      const visibleCells = los.getVisibleCells(x, z, 3);

      // Should not have negative coordinates
      for (const cellKey of visibleCells) {
        const [cx, cy] = cellKey.split(',').map(Number);
        expect(cx).toBeGreaterThanOrEqual(0);
        expect(cy).toBeGreaterThanOrEqual(0);
        expect(cx).toBeLessThan(width);
        expect(cy).toBeLessThan(height);
      }
    });
  });

  describe('lineIntersectsWall', () => {
    it('should detect intersection with horizontal segment', () => {
      // Line from (0, 0) to (2, 2)
      // Wall segment from (0, 1) to (2, 1) - horizontal
      expect(los.lineIntersectsWall(0, 0, 2, 2, 0, 1, 2, 1)).toBe(true);
    });

    it('should detect intersection with vertical segment', () => {
      // Line from (0, 0) to (2, 2)
      // Wall segment from (1, 0) to (1, 2) - vertical
      expect(los.lineIntersectsWall(0, 0, 2, 2, 1, 0, 1, 2)).toBe(true);
    });

    it('should return false for parallel non-intersecting lines', () => {
      // Two horizontal parallel lines
      expect(los.lineIntersectsWall(0, 0, 2, 0, 0, 1, 2, 1)).toBe(false);
    });

    it('should return false when segments do not intersect', () => {
      // Line from (0, 0) to (1, 0)
      // Wall segment from (2, 0) to (3, 0)
      expect(los.lineIntersectsWall(0, 0, 1, 0, 2, 0, 3, 0)).toBe(false);
    });
  });

  describe('performance', () => {
    it('should handle larger mazes efficiently', () => {
      const largeMaze = new MazeGenerator({ width: 20, height: 20, seed: 99999 });
      largeMaze.generate();
      const largeLos = new LineOfSight(largeMaze);

      const startTime = performance.now();

      // Check line of sight across the maze multiple times
      for (let i = 0; i < 100; i++) {
        largeLos.hasLineOfSight(
          0,
          0,
          19 * CELL_SIZE,
          19 * CELL_SIZE
        );
      }

      const endTime = performance.now();

      // Should complete 100 checks in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should calculate visible cells efficiently', () => {
      const largeMaze = new MazeGenerator({ width: 20, height: 20, seed: 99999 });
      largeMaze.generate();
      const largeLos = new LineOfSight(largeMaze);

      const startTime = performance.now();
      const visibleCells = largeLos.getVisibleCells(
        10 * CELL_SIZE,
        10 * CELL_SIZE,
        4 // Same as FOG_VISIBILITY_RADIUS
      );
      const endTime = performance.now();

      expect(visibleCells.size).toBeGreaterThan(0);
      // Should complete in reasonable time (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});
