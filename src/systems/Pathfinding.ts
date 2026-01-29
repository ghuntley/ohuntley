/**
 * A* Pathfinding System for Meerkat Maze Runner
 * Used by zombies to navigate through the maze
 */

import { MazeGenerator, Point } from '../maze/MazeGenerator';

/** Node in the A* search */
interface PathNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic (estimated cost to goal)
  f: number; // Total cost (g + h)
  parent: PathNode | null;
}

/**
 * A* Pathfinding implementation for grid-based mazes
 */
export class Pathfinding {
  private maze: MazeGenerator;

  constructor(maze: MazeGenerator) {
    this.maze = maze;
  }

  /**
   * Find a path from start to goal using A* algorithm
   * @param start Starting grid position
   * @param goal Target grid position
   * @returns Array of points representing the path, or empty array if no path exists
   */
  findPath(start: Point, goal: Point): Point[] {
    // Validate inputs
    if (!this.maze.getCell(start.x, start.y) || !this.maze.getCell(goal.x, goal.y)) {
      return [];
    }

    // Already at goal
    if (start.x === goal.x && start.y === goal.y) {
      return [{ ...goal }];
    }

    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    // Helper to create unique key for a position
    const posKey = (x: number, y: number): string => `${x},${y}`;

    // Create start node
    const startNode: PathNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: this.heuristic(start, goal),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    // Map to track best g-score for each position
    const gScores = new Map<string, number>();
    gScores.set(posKey(start.x, start.y), 0);

    while (openSet.length > 0) {
      // Find node with lowest f score
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) {
          currentIndex = i;
        }
      }

      const current = openSet[currentIndex];

      // Check if we reached the goal
      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(current);
      }

      // Move current to closed set
      openSet.splice(currentIndex, 1);
      closedSet.add(posKey(current.x, current.y));

      // Check all accessible neighbors
      const neighbors = this.maze.getAccessibleNeighbors(current.x, current.y);

      for (const neighbor of neighbors) {
        const neighborKey = posKey(neighbor.x, neighbor.y);

        // Skip if already evaluated
        if (closedSet.has(neighborKey)) {
          continue;
        }

        // Calculate tentative g score (cost of 1 per cell)
        const tentativeG = current.g + 1;

        // Check if this is a better path
        const existingG = gScores.get(neighborKey);
        if (existingG !== undefined && tentativeG >= existingG) {
          continue;
        }

        // This is a better path, record it
        gScores.set(neighborKey, tentativeG);

        const neighborNode: PathNode = {
          x: neighbor.x,
          y: neighbor.y,
          g: tentativeG,
          h: this.heuristic(neighbor, goal),
          f: 0,
          parent: current,
        };
        neighborNode.f = neighborNode.g + neighborNode.h;

        // Add to open set if not already there
        const existingNode = openSet.find((n) => n.x === neighbor.x && n.y === neighbor.y);
        if (existingNode) {
          // Update existing node
          existingNode.g = neighborNode.g;
          existingNode.f = neighborNode.f;
          existingNode.parent = neighborNode.parent;
        } else {
          openSet.push(neighborNode);
        }
      }
    }

    // No path found
    return [];
  }

  /**
   * Manhattan distance heuristic
   */
  private heuristic(a: Point, b: Point): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Reconstruct path from goal node back to start
   */
  private reconstructPath(goalNode: PathNode): Point[] {
    const path: Point[] = [];
    let current: PathNode | null = goalNode;

    while (current !== null) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }

    return path;
  }

  /**
   * Check if a path exists between two points
   */
  hasPath(start: Point, goal: Point): boolean {
    return this.findPath(start, goal).length > 0;
  }

  /**
   * Get the next step in the path from start to goal
   * Returns null if no path or already at goal
   */
  getNextStep(start: Point, goal: Point): Point | null {
    const path = this.findPath(start, goal);
    // Return the second point in path (first is current position)
    if (path.length > 1) {
      return path[1];
    }
    return null;
  }

  /**
   * Calculate the path length (number of cells) from start to goal
   * Returns -1 if no path exists
   */
  getPathLength(start: Point, goal: Point): number {
    const path = this.findPath(start, goal);
    return path.length > 0 ? path.length - 1 : -1;
  }

  /**
   * Update the maze reference (e.g., when level changes)
   */
  setMaze(maze: MazeGenerator): void {
    this.maze = maze;
  }
}
