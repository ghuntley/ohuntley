/**
 * Collision System for Meerkat Maze Runner
 * Handles player-wall and player-entity collision detection and resolution
 */

import { MazeGenerator, Direction, DIRECTION_VECTORS } from '../maze/MazeGenerator';
import { Player, Position } from '../entities/Player';
import {
  CELL_SIZE,
  WALL_THICKNESS,
  PLAYER_COLLISION_RADIUS,
} from '../utils/Constants';

/** Axis-aligned bounding box */
export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Wall segment for collision detection */
interface WallCollider {
  aabb: AABB;
  direction: Direction;
  cellX: number;
  cellY: number;
}

/** Collision result */
export interface CollisionResult {
  collided: boolean;
  correctedPosition: Position;
  hitWalls: WallCollider[];
}

/**
 * Handles collision detection and resolution
 */
export class CollisionSystem {
  private mazeGenerator: MazeGenerator | null = null;
  private wallColliders: WallCollider[] = [];
  private mazeWidth: number = 0;
  private mazeHeight: number = 0;

  /**
   * Initialize collision system with maze data
   */
  setMaze(generator: MazeGenerator): void {
    this.mazeGenerator = generator;
    const { width, height } = generator.getDimensions();
    this.mazeWidth = width;
    this.mazeHeight = height;
    this.buildWallColliders();
  }

  /**
   * Build wall colliders from maze data
   */
  private buildWallColliders(): void {
    this.wallColliders = [];

    if (!this.mazeGenerator) return;

    const grid = this.mazeGenerator.getGrid();
    const halfCell = CELL_SIZE / 2;
    const halfWall = WALL_THICKNESS / 2;

    for (let y = 0; y < this.mazeHeight; y++) {
      for (let x = 0; x < this.mazeWidth; x++) {
        const cell = grid[y][x];
        const worldX = x * CELL_SIZE;
        const worldZ = y * CELL_SIZE;

        // North wall
        if (cell.walls[Direction.NORTH]) {
          this.wallColliders.push({
            aabb: {
              minX: worldX - halfCell,
              maxX: worldX + halfCell,
              minZ: worldZ - halfCell - halfWall,
              maxZ: worldZ - halfCell + halfWall,
            },
            direction: Direction.NORTH,
            cellX: x,
            cellY: y,
          });
        }

        // South wall
        if (cell.walls[Direction.SOUTH]) {
          this.wallColliders.push({
            aabb: {
              minX: worldX - halfCell,
              maxX: worldX + halfCell,
              minZ: worldZ + halfCell - halfWall,
              maxZ: worldZ + halfCell + halfWall,
            },
            direction: Direction.SOUTH,
            cellX: x,
            cellY: y,
          });
        }

        // East wall
        if (cell.walls[Direction.EAST]) {
          this.wallColliders.push({
            aabb: {
              minX: worldX + halfCell - halfWall,
              maxX: worldX + halfCell + halfWall,
              minZ: worldZ - halfCell,
              maxZ: worldZ + halfCell,
            },
            direction: Direction.EAST,
            cellX: x,
            cellY: y,
          });
        }

        // West wall
        if (cell.walls[Direction.WEST]) {
          this.wallColliders.push({
            aabb: {
              minX: worldX - halfCell - halfWall,
              maxX: worldX - halfCell + halfWall,
              minZ: worldZ - halfCell,
              maxZ: worldZ + halfCell,
            },
            direction: Direction.WEST,
            cellX: x,
            cellY: y,
          });
        }
      }
    }
  }

  /**
   * Check and resolve player-wall collisions
   */
  checkPlayerWallCollision(player: Player): CollisionResult {
    const position = player.getPosition();
    const radius = player.getCollisionRadius();

    return this.checkCircleWallCollision(
      position.x,
      position.z,
      radius
    );
  }

  /**
   * Check circle collision against walls and resolve
   */
  checkCircleWallCollision(
    x: number,
    z: number,
    radius: number
  ): CollisionResult {
    const result: CollisionResult = {
      collided: false,
      correctedPosition: { x, y: 0, z },
      hitWalls: [],
    };

    // Get nearby walls based on grid position
    const nearbyWalls = this.getNearbyWalls(x, z);

    let correctedX = x;
    let correctedZ = z;

    // Check each nearby wall
    for (const wall of nearbyWalls) {
      const collision = this.circleAABBCollision(
        correctedX,
        correctedZ,
        radius,
        wall.aabb
      );

      if (collision.collided) {
        result.collided = true;
        result.hitWalls.push(wall);

        // Apply collision response (push player out)
        correctedX += collision.pushX;
        correctedZ += collision.pushZ;
      }
    }

    result.correctedPosition.x = correctedX;
    result.correctedPosition.z = correctedZ;

    return result;
  }

  /**
   * Get walls near a world position (optimized lookup)
   */
  private getNearbyWalls(worldX: number, worldZ: number): WallCollider[] {
    // Convert to grid coordinates
    const gridX = Math.floor(worldX / CELL_SIZE + 0.5);
    const gridY = Math.floor(worldZ / CELL_SIZE + 0.5);

    // Check surrounding cells (3x3 grid centered on player)
    const nearby: WallCollider[] = [];

    for (const wall of this.wallColliders) {
      const dx = Math.abs(wall.cellX - gridX);
      const dy = Math.abs(wall.cellY - gridY);

      // Only consider walls within 1 cell distance
      if (dx <= 1 && dy <= 1) {
        nearby.push(wall);
      }
    }

    return nearby;
  }

  /**
   * Check circle vs AABB collision and calculate push vector
   */
  private circleAABBCollision(
    circleX: number,
    circleZ: number,
    radius: number,
    aabb: AABB
  ): { collided: boolean; pushX: number; pushZ: number } {
    // Find closest point on AABB to circle center
    const closestX = Math.max(aabb.minX, Math.min(circleX, aabb.maxX));
    const closestZ = Math.max(aabb.minZ, Math.min(circleZ, aabb.maxZ));

    // Calculate distance from closest point to circle center
    const dx = circleX - closestX;
    const dz = circleZ - closestZ;
    const distanceSq = dx * dx + dz * dz;

    if (distanceSq >= radius * radius) {
      return { collided: false, pushX: 0, pushZ: 0 };
    }

    // Collision detected - calculate push vector
    const distance = Math.sqrt(distanceSq);

    if (distance === 0) {
      // Circle center is inside AABB - push to nearest edge
      const pushToLeft = circleX - aabb.minX;
      const pushToRight = aabb.maxX - circleX;
      const pushToTop = circleZ - aabb.minZ;
      const pushToBottom = aabb.maxZ - circleZ;

      const minPush = Math.min(pushToLeft, pushToRight, pushToTop, pushToBottom);

      if (minPush === pushToLeft) {
        return { collided: true, pushX: -(radius + pushToLeft), pushZ: 0 };
      } else if (minPush === pushToRight) {
        return { collided: true, pushX: radius + pushToRight, pushZ: 0 };
      } else if (minPush === pushToTop) {
        return { collided: true, pushX: 0, pushZ: -(radius + pushToTop) };
      } else {
        return { collided: true, pushX: 0, pushZ: radius + pushToBottom };
      }
    }

    // Normal collision - push along the collision normal
    const overlap = radius - distance;
    const normalX = dx / distance;
    const normalZ = dz / distance;

    return {
      collided: true,
      pushX: normalX * overlap,
      pushZ: normalZ * overlap,
    };
  }

  /**
   * Check if a position is inside a specific cell (for exit detection)
   */
  isInCell(worldX: number, worldZ: number, cellX: number, cellY: number): boolean {
    const halfCell = CELL_SIZE / 2;
    const cellWorldX = cellX * CELL_SIZE;
    const cellWorldZ = cellY * CELL_SIZE;

    return (
      worldX >= cellWorldX - halfCell &&
      worldX <= cellWorldX + halfCell &&
      worldZ >= cellWorldZ - halfCell &&
      worldZ <= cellWorldZ + halfCell
    );
  }

  /**
   * Check circle-circle collision (for player-zombie, player-powerup)
   */
  checkCircleCollision(
    x1: number,
    z1: number,
    radius1: number,
    x2: number,
    z2: number,
    radius2: number
  ): boolean {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const distanceSq = dx * dx + dz * dz;
    const radiusSum = radius1 + radius2;

    return distanceSq < radiusSum * radiusSum;
  }

  /**
   * Check if player has reached the exit
   */
  checkPlayerAtExit(player: Player): boolean {
    if (!this.mazeGenerator) return false;

    const position = player.getPosition();
    const exit = this.mazeGenerator.getExit();
    const radius = player.getCollisionRadius();

    // Check if player center is within exit cell
    const exitWorldX = exit.x * CELL_SIZE;
    const exitWorldZ = exit.y * CELL_SIZE;

    const dx = position.x - exitWorldX;
    const dz = position.z - exitWorldZ;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Player reaches exit when close enough to center
    return distance < CELL_SIZE / 3;
  }

  /**
   * Get current cell coordinates for a world position
   */
  getGridPosition(worldX: number, worldZ: number): { x: number; y: number } {
    return {
      x: Math.floor(worldX / CELL_SIZE + 0.5),
      y: Math.floor(worldZ / CELL_SIZE + 0.5),
    };
  }

  /**
   * Get world position for grid coordinates
   */
  getWorldPosition(gridX: number, gridY: number): { x: number; z: number } {
    return {
      x: gridX * CELL_SIZE,
      z: gridY * CELL_SIZE,
    };
  }

  /**
   * Clear collision data
   */
  clear(): void {
    this.wallColliders = [];
    this.mazeGenerator = null;
    this.mazeWidth = 0;
    this.mazeHeight = 0;
  }
}
