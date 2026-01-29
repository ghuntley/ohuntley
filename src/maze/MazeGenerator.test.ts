import { describe, it, expect, beforeEach } from 'vitest';
import {
  MazeGenerator,
  SeededRandom,
  Direction,
  DIRECTION_VECTORS,
} from './MazeGenerator';

describe('SeededRandom', () => {
  it('should produce deterministic sequences', () => {
    const rng1 = new SeededRandom(12345);
    const rng2 = new SeededRandom(12345);

    const values1 = Array.from({ length: 10 }, () => rng1.next());
    const values2 = Array.from({ length: 10 }, () => rng2.next());

    expect(values1).toEqual(values2);
  });

  it('should produce different sequences for different seeds', () => {
    const rng1 = new SeededRandom(12345);
    const rng2 = new SeededRandom(54321);

    const values1 = Array.from({ length: 10 }, () => rng1.next());
    const values2 = Array.from({ length: 10 }, () => rng2.next());

    expect(values1).not.toEqual(values2);
  });

  it('should produce values between 0 and 1', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('should produce integers in correct range', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const value = rng.nextInt(10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('should shuffle arrays deterministically', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [1, 2, 3, 4, 5];

    rng1.shuffle(arr1);
    rng2.shuffle(arr2);

    expect(arr1).toEqual(arr2);
  });
});

describe('MazeGenerator', () => {
  describe('initialization', () => {
    it('should create maze with specified dimensions', () => {
      const maze = new MazeGenerator({ width: 10, height: 10 });
      const dims = maze.getDimensions();

      expect(dims.width).toBe(10);
      expect(dims.height).toBe(10);
    });

    it('should initialize grid with all walls', () => {
      const maze = new MazeGenerator({ width: 5, height: 5 });
      const grid = maze.getGrid();

      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          const cell = grid[y][x];
          expect(cell.walls[Direction.NORTH]).toBe(true);
          expect(cell.walls[Direction.EAST]).toBe(true);
          expect(cell.walls[Direction.SOUTH]).toBe(true);
          expect(cell.walls[Direction.WEST]).toBe(true);
        }
      }
    });

    it('should use provided seed', () => {
      const maze = new MazeGenerator({ width: 10, height: 10, seed: 12345 });
      expect(maze.getSeed()).toBe(12345);
    });
  });

  describe('generation', () => {
    let maze: MazeGenerator;

    beforeEach(() => {
      maze = new MazeGenerator({ width: 10, height: 10, seed: 42 });
      maze.generate();
    });

    it('should generate a solvable maze', () => {
      expect(maze.isPathValid()).toBe(true);
    });

    it('should mark all cells as visited after generation', () => {
      const grid = maze.getGrid();

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          expect(grid[y][x].visited).toBe(true);
        }
      }
    });

    it('should set start position at (0, 0)', () => {
      const start = maze.getStart();
      expect(start.x).toBe(0);
      expect(start.y).toBe(0);
    });

    it('should set exit position different from start', () => {
      const start = maze.getStart();
      const exit = maze.getExit();

      expect(exit.x !== start.x || exit.y !== start.y).toBe(true);
    });

    it('should generate same maze with same seed', () => {
      const maze1 = new MazeGenerator({ width: 10, height: 10, seed: 12345 });
      const maze2 = new MazeGenerator({ width: 10, height: 10, seed: 12345 });

      maze1.generate();
      maze2.generate();

      const grid1 = maze1.getGrid();
      const grid2 = maze2.getGrid();

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          expect(grid1[y][x].walls).toEqual(grid2[y][x].walls);
        }
      }
    });

    it('should generate different mazes with different seeds', () => {
      const maze1 = new MazeGenerator({ width: 10, height: 10, seed: 12345 });
      const maze2 = new MazeGenerator({ width: 10, height: 10, seed: 54321 });

      maze1.generate();
      maze2.generate();

      const grid1 = maze1.getGrid();
      const grid2 = maze2.getGrid();

      // At least some cells should be different
      let hasDifference = false;
      for (let y = 0; y < 10 && !hasDifference; y++) {
        for (let x = 0; x < 10 && !hasDifference; x++) {
          if (
            JSON.stringify(grid1[y][x].walls) !==
            JSON.stringify(grid2[y][x].walls)
          ) {
            hasDifference = true;
          }
        }
      }

      expect(hasDifference).toBe(true);
    });

    it('should remove walls symmetrically', () => {
      const grid = maze.getGrid();

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const cell = grid[y][x];

          // Check North/South symmetry
          if (y > 0) {
            const northCell = grid[y - 1][x];
            expect(cell.walls[Direction.NORTH]).toBe(
              northCell.walls[Direction.SOUTH]
            );
          }

          // Check East/West symmetry
          if (x < 9) {
            const eastCell = grid[y][x + 1];
            expect(cell.walls[Direction.EAST]).toBe(
              eastCell.walls[Direction.WEST]
            );
          }
        }
      }
    });
  });

  describe('cell access', () => {
    let maze: MazeGenerator;

    beforeEach(() => {
      maze = new MazeGenerator({ width: 10, height: 10, seed: 42 });
      maze.generate();
    });

    it('should return cell at valid coordinates', () => {
      const cell = maze.getCell(5, 5);
      expect(cell).not.toBeNull();
      expect(cell!.x).toBe(5);
      expect(cell!.y).toBe(5);
    });

    it('should return null for invalid coordinates', () => {
      expect(maze.getCell(-1, 0)).toBeNull();
      expect(maze.getCell(0, -1)).toBeNull();
      expect(maze.getCell(10, 0)).toBeNull();
      expect(maze.getCell(0, 10)).toBeNull();
    });
  });

  describe('navigation', () => {
    let maze: MazeGenerator;

    beforeEach(() => {
      maze = new MazeGenerator({ width: 10, height: 10, seed: 42 });
      maze.generate();
    });

    it('should correctly report if can move in direction', () => {
      const cell = maze.getCell(0, 0);
      expect(cell).not.toBeNull();

      // Cell at (0, 0) should have at least one open passage
      const hasOpenPassage =
        !cell!.walls[Direction.EAST] || !cell!.walls[Direction.SOUTH];
      expect(hasOpenPassage).toBe(true);

      // Check canMove matches wall state
      expect(maze.canMove(0, 0, Direction.EAST)).toBe(
        !cell!.walls[Direction.EAST]
      );
      expect(maze.canMove(0, 0, Direction.SOUTH)).toBe(
        !cell!.walls[Direction.SOUTH]
      );

      // Border walls should always exist
      expect(maze.canMove(0, 0, Direction.NORTH)).toBe(false);
      expect(maze.canMove(0, 0, Direction.WEST)).toBe(false);
    });

    it('should return false for canMove on invalid cell', () => {
      expect(maze.canMove(-1, 0, Direction.NORTH)).toBe(false);
    });

    it('should return accessible neighbors', () => {
      const neighbors = maze.getAccessibleNeighbors(0, 0);

      expect(neighbors.length).toBeGreaterThan(0);

      // Each neighbor should be adjacent
      for (const neighbor of neighbors) {
        const dx = Math.abs(neighbor.x - 0);
        const dy = Math.abs(neighbor.y - 0);
        expect(dx + dy).toBe(1);
      }
    });

    it('should return empty array for invalid cell neighbors', () => {
      const neighbors = maze.getAccessibleNeighbors(-1, -1);
      expect(neighbors).toEqual([]);
    });
  });

  describe('different maze sizes', () => {
    it('should generate small maze (10x10)', () => {
      const maze = new MazeGenerator({ width: 10, height: 10, seed: 42 });
      maze.generate();
      expect(maze.isPathValid()).toBe(true);
    });

    it('should generate medium maze (15x15)', () => {
      const maze = new MazeGenerator({ width: 15, height: 15, seed: 42 });
      maze.generate();
      expect(maze.isPathValid()).toBe(true);
    });

    it('should generate large maze (20x20)', () => {
      const maze = new MazeGenerator({ width: 20, height: 20, seed: 42 });
      maze.generate();
      expect(maze.isPathValid()).toBe(true);
    });

    it('should generate non-square maze', () => {
      const maze = new MazeGenerator({ width: 15, height: 10, seed: 42 });
      maze.generate();
      expect(maze.isPathValid()).toBe(true);
      expect(maze.getDimensions()).toEqual({ width: 15, height: 10 });
    });
  });
});

describe('DIRECTION_VECTORS', () => {
  it('should have correct direction vectors', () => {
    expect(DIRECTION_VECTORS[Direction.NORTH]).toEqual([0, -1]);
    expect(DIRECTION_VECTORS[Direction.EAST]).toEqual([1, 0]);
    expect(DIRECTION_VECTORS[Direction.SOUTH]).toEqual([0, 1]);
    expect(DIRECTION_VECTORS[Direction.WEST]).toEqual([-1, 0]);
  });
});
