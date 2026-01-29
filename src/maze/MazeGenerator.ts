/**
 * Procedural maze generator for Meerkat Maze Runner
 * Uses recursive backtracking algorithm to generate solvable mazes
 */

/** Directions for maze generation */
export enum Direction {
  NORTH = 0,
  EAST = 1,
  SOUTH = 2,
  WEST = 3,
}

/** Direction vectors [dx, dy] */
const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  [Direction.NORTH]: [0, -1],
  [Direction.EAST]: [1, 0],
  [Direction.SOUTH]: [0, 1],
  [Direction.WEST]: [-1, 0],
};

/** Opposite direction mapping */
const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  [Direction.NORTH]: Direction.SOUTH,
  [Direction.SOUTH]: Direction.NORTH,
  [Direction.EAST]: Direction.WEST,
  [Direction.WEST]: Direction.EAST,
};

/** Cell in the maze grid */
export interface MazeCell {
  x: number;
  y: number;
  walls: Record<Direction, boolean>;
  visited: boolean;
}

/** Point coordinates */
export interface Point {
  x: number;
  y: number;
}

/** Maze configuration */
export interface MazeConfig {
  width: number;
  height: number;
  seed?: number;
}

/**
 * Seeded pseudo-random number generator
 * Using mulberry32 algorithm
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /** Get next random number between 0 and 1 */
  next(): number {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Get random integer from 0 to max (exclusive) */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Shuffle array in place */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

/**
 * Generates procedural mazes using recursive backtracking
 */
export class MazeGenerator {
  private width: number;
  private height: number;
  private grid: MazeCell[][];
  private random: SeededRandom;
  private start: Point;
  private exit: Point;
  private seed: number;

  constructor(config: MazeConfig) {
    this.width = config.width;
    this.height = config.height;
    this.seed = config.seed ?? Date.now();
    this.random = new SeededRandom(this.seed);
    this.grid = [];
    this.start = { x: 0, y: 0 };
    this.exit = { x: this.width - 1, y: this.height - 1 };

    this.initializeGrid();
  }

  /** Initialize grid with all walls */
  private initializeGrid(): void {
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      const row: MazeCell[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push({
          x,
          y,
          walls: {
            [Direction.NORTH]: true,
            [Direction.EAST]: true,
            [Direction.SOUTH]: true,
            [Direction.WEST]: true,
          },
          visited: false,
        });
      }
      this.grid.push(row);
    }
  }

  /** Generate the maze */
  generate(): void {
    // Reset grid
    this.initializeGrid();
    this.random = new SeededRandom(this.seed);

    // Start carving from position (0, 0)
    this.carvePassagesFrom(0, 0);

    // Set start and find exit (furthest point from start)
    this.start = { x: 0, y: 0 };
    this.exit = this.findFurthestCell(this.start);
  }

  /** Recursive backtracking algorithm to carve passages */
  private carvePassagesFrom(x: number, y: number): void {
    const cell = this.grid[y][x];
    cell.visited = true;

    // Get randomized directions
    const directions = this.random.shuffle([
      Direction.NORTH,
      Direction.EAST,
      Direction.SOUTH,
      Direction.WEST,
    ]);

    for (const direction of directions) {
      const [dx, dy] = DIRECTION_VECTORS[direction];
      const nx = x + dx;
      const ny = y + dy;

      // Check if neighbor is valid and unvisited
      if (this.isValidCell(nx, ny) && !this.grid[ny][nx].visited) {
        // Remove wall between current cell and neighbor
        cell.walls[direction] = false;
        this.grid[ny][nx].walls[OPPOSITE_DIRECTION[direction]] = false;

        // Recursively carve from neighbor
        this.carvePassagesFrom(nx, ny);
      }
    }
  }

  /** Check if coordinates are within grid bounds */
  private isValidCell(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /** Find the cell furthest from the given start point using BFS */
  private findFurthestCell(start: Point): Point {
    const distances: number[][] = Array(this.height)
      .fill(null)
      .map(() => Array(this.width).fill(-1));

    const queue: Point[] = [start];
    distances[start.y][start.x] = 0;

    let furthest = start;
    let maxDistance = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const cell = this.grid[current.y][current.x];
      const currentDistance = distances[current.y][current.x];

      if (currentDistance > maxDistance) {
        maxDistance = currentDistance;
        furthest = current;
      }

      // Check all directions
      for (const direction of [
        Direction.NORTH,
        Direction.EAST,
        Direction.SOUTH,
        Direction.WEST,
      ]) {
        // Skip if wall exists
        if (cell.walls[direction]) continue;

        const [dx, dy] = DIRECTION_VECTORS[direction];
        const nx = current.x + dx;
        const ny = current.y + dy;

        // Skip if already visited or out of bounds
        if (!this.isValidCell(nx, ny) || distances[ny][nx] !== -1) continue;

        distances[ny][nx] = currentDistance + 1;
        queue.push({ x: nx, y: ny });
      }
    }

    return furthest;
  }

  /** Get the maze grid */
  getGrid(): MazeCell[][] {
    return this.grid;
  }

  /** Get a specific cell */
  getCell(x: number, y: number): MazeCell | null {
    if (!this.isValidCell(x, y)) return null;
    return this.grid[y][x];
  }

  /** Get the start position */
  getStart(): Point {
    return { ...this.start };
  }

  /** Get the exit position */
  getExit(): Point {
    return { ...this.exit };
  }

  /** Get maze dimensions */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /** Get the seed used for generation */
  getSeed(): number {
    return this.seed;
  }

  /** Check if a path exists from start to exit */
  isPathValid(): boolean {
    const visited: boolean[][] = Array(this.height)
      .fill(null)
      .map(() => Array(this.width).fill(false));

    const queue: Point[] = [this.start];
    visited[this.start.y][this.start.x] = true;

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Check if we reached exit
      if (current.x === this.exit.x && current.y === this.exit.y) {
        return true;
      }

      const cell = this.grid[current.y][current.x];

      // Check all directions
      for (const direction of [
        Direction.NORTH,
        Direction.EAST,
        Direction.SOUTH,
        Direction.WEST,
      ]) {
        // Skip if wall exists
        if (cell.walls[direction]) continue;

        const [dx, dy] = DIRECTION_VECTORS[direction];
        const nx = current.x + dx;
        const ny = current.y + dy;

        // Skip if already visited or out of bounds
        if (!this.isValidCell(nx, ny) || visited[ny][nx]) continue;

        visited[ny][nx] = true;
        queue.push({ x: nx, y: ny });
      }
    }

    return false;
  }

  /** Check if can move from cell in given direction (no wall) */
  canMove(x: number, y: number, direction: Direction): boolean {
    const cell = this.getCell(x, y);
    if (!cell) return false;
    return !cell.walls[direction];
  }

  /** Get all accessible neighbors of a cell */
  getAccessibleNeighbors(x: number, y: number): Point[] {
    const neighbors: Point[] = [];
    const cell = this.getCell(x, y);
    if (!cell) return neighbors;

    for (const direction of [
      Direction.NORTH,
      Direction.EAST,
      Direction.SOUTH,
      Direction.WEST,
    ]) {
      if (!cell.walls[direction]) {
        const [dx, dy] = DIRECTION_VECTORS[direction];
        const nx = x + dx;
        const ny = y + dy;
        if (this.isValidCell(nx, ny)) {
          neighbors.push({ x: nx, y: ny });
        }
      }
    }

    return neighbors;
  }
}

export { DIRECTION_VECTORS, OPPOSITE_DIRECTION };
