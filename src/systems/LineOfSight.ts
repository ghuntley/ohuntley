/**
 * Line of Sight System for Meerkat Maze Runner
 * Performs grid-based raycasting to check visibility between points
 */

import { MazeGenerator, Point, Direction } from '../maze/MazeGenerator';
import { CELL_SIZE } from '../utils/Constants';

/**
 * LineOfSight provides visibility checking between positions in the maze
 */
export class LineOfSight {
  private maze: MazeGenerator;

  constructor(maze: MazeGenerator) {
    this.maze = maze;
  }

  /**
   * Check if there is a clear line of sight between two world positions
   * Uses grid-based raycasting through the maze
   */
  hasLineOfSight(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number
  ): boolean {
    // Convert world positions to grid coordinates
    const fromGrid = this.worldToGrid(fromX, fromZ);
    const toGrid = this.worldToGrid(toX, toZ);

    // If same cell, always visible
    if (fromGrid.x === toGrid.x && fromGrid.y === toGrid.y) {
      return true;
    }

    // Use Bresenham's line algorithm variant to check cells along the line
    return this.raycastGrid(fromGrid, toGrid);
  }

  /**
   * Check if there is a clear line of sight between two grid positions
   */
  hasLineOfSightGrid(from: Point, to: Point): boolean {
    if (from.x === to.x && from.y === to.y) {
      return true;
    }
    return this.raycastGrid(from, to);
  }

  /**
   * Raycast through the grid using a modified Bresenham's algorithm
   * Returns true if line of sight is clear, false if blocked by a wall
   */
  private raycastGrid(from: Point, to: Point): boolean {
    const { width, height } = this.maze.getDimensions();
    const grid = this.maze.getGrid();

    // Digital Differential Analyzer (DDA) algorithm for grid traversal
    let x0 = from.x;
    let y0 = from.y;
    const x1 = to.x;
    const y1 = to.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);

    const stepX = x0 < x1 ? 1 : -1;
    const stepY = y0 < y1 ? 1 : -1;

    // Use sub-cell precision for better accuracy
    // Cast ray from center of start cell to center of end cell
    let error = dx - dy;

    let currentX = x0;
    let currentY = y0;

    // Maximum iterations to prevent infinite loops
    const maxIterations = dx + dy + 2;
    let iterations = 0;

    while (iterations < maxIterations) {
      // Check if we've reached the target
      if (currentX === x1 && currentY === y1) {
        return true; // Clear line of sight
      }

      // Store previous position to check wall transitions
      const prevX = currentX;
      const prevY = currentY;

      const e2 = 2 * error;

      // Determine next cell to check
      if (e2 > -dy) {
        error -= dy;
        currentX += stepX;

        // Check if we can move horizontally (no wall between cells)
        if (!this.canMoveBetweenCells(prevX, prevY, currentX, prevY, grid, width, height)) {
          return false; // Wall blocks line of sight
        }
      }

      if (e2 < dx) {
        error += dx;
        currentY += stepY;

        // Check if we can move vertically (no wall between cells)
        if (!this.canMoveBetweenCells(currentX, prevY, currentX, currentY, grid, width, height)) {
          return false; // Wall blocks line of sight
        }
      }

      // Bounds check
      if (currentX < 0 || currentX >= width || currentY < 0 || currentY >= height) {
        return false; // Out of bounds
      }

      iterations++;
    }

    return false; // Shouldn't reach here, but fail safe
  }

  /**
   * Check if movement between two adjacent cells is possible (no wall between)
   */
  private canMoveBetweenCells(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    grid: ReturnType<MazeGenerator['getGrid']>,
    width: number,
    height: number
  ): boolean {
    // Bounds check
    if (x1 < 0 || x1 >= width || y1 < 0 || y1 >= height) return false;
    if (x2 < 0 || x2 >= width || y2 < 0 || y2 >= height) return false;

    const cell1 = grid[y1][x1];

    // Determine direction of movement
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Check wall in direction of movement
    if (dx === 1) {
      // Moving east
      return !cell1.walls[Direction.EAST];
    } else if (dx === -1) {
      // Moving west
      return !cell1.walls[Direction.WEST];
    } else if (dy === 1) {
      // Moving south
      return !cell1.walls[Direction.SOUTH];
    } else if (dy === -1) {
      // Moving north
      return !cell1.walls[Direction.NORTH];
    }

    // Same cell or diagonal (shouldn't happen with proper algorithm)
    return true;
  }

  /**
   * Get all cells visible from a position within a given radius
   * Useful for fog of war calculations
   */
  getVisibleCells(
    fromX: number,
    fromZ: number,
    radiusCells: number
  ): Set<string> {
    const fromGrid = this.worldToGrid(fromX, fromZ);
    const { width, height } = this.maze.getDimensions();
    const visibleCells = new Set<string>();

    // Always include the cell the viewer is in
    visibleCells.add(`${fromGrid.x},${fromGrid.y}`);

    // Check all cells within radius
    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        const targetX = fromGrid.x + dx;
        const targetY = fromGrid.y + dy;

        // Bounds check
        if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) {
          continue;
        }

        // Distance check (circular radius)
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > radiusCells) {
          continue;
        }

        // Check line of sight
        if (this.hasLineOfSightGrid(fromGrid, { x: targetX, y: targetY })) {
          visibleCells.add(`${targetX},${targetY}`);
        }
      }
    }

    return visibleCells;
  }

  /**
   * Convert world position to grid coordinates
   */
  private worldToGrid(worldX: number, worldZ: number): Point {
    return {
      x: Math.round(worldX / CELL_SIZE),
      y: Math.round(worldZ / CELL_SIZE),
    };
  }

  /**
   * Get the closest point on a line segment to a given point
   * Useful for checking if a wall blocks the line of sight
   */
  private closestPointOnLineSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
  ): { x: number; y: number } {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;

    const ab2 = abx * abx + aby * aby;
    const apDotAb = apx * abx + apy * aby;
    const t = Math.max(0, Math.min(1, ab2 > 0 ? apDotAb / ab2 : 0));

    return {
      x: ax + abx * t,
      y: ay + aby * t,
    };
  }

  /**
   * Check if a line segment intersects with a wall segment
   * Using line-line intersection
   */
  lineIntersectsWall(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    wallX1: number,
    wallY1: number,
    wallX2: number,
    wallY2: number
  ): boolean {
    const d1x = x2 - x1;
    const d1y = y2 - y1;
    const d2x = wallX2 - wallX1;
    const d2y = wallY2 - wallY1;

    const cross = d1x * d2y - d1y * d2x;

    // Parallel lines
    if (Math.abs(cross) < 0.0001) {
      return false;
    }

    const dx = wallX1 - x1;
    const dy = wallY1 - y1;

    const t1 = (dx * d2y - dy * d2x) / cross;
    const t2 = (dx * d1y - dy * d1x) / cross;

    // Check if intersection is within both line segments
    return t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1;
  }
}
