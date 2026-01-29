/**
 * Zombie entity for Meerkat Maze Runner
 * Enemy that patrols the maze and chases the player
 */

import {
  ZOMBIE_PATROL_SPEED,
  ZOMBIE_CHASE_SPEED,
  ZOMBIE_DETECTION_RADIUS,
  PLAYER_COLLISION_RADIUS,
  CELL_SIZE,
} from '../utils/Constants';
import { Pathfinding } from '../systems/Pathfinding';
import { MazeGenerator, Point } from '../maze/MazeGenerator';
import { Position } from './Player';

/** Zombie state enum */
export enum ZombieState {
  PATROL = 'PATROL',
  CHASE = 'CHASE',
  RETURNING = 'RETURNING',
  FROZEN = 'FROZEN',
  DEAD = 'DEAD',
}

/** Zombie configuration */
export interface ZombieConfig {
  patrolSpeed?: number;
  chaseSpeed?: number;
  detectionRadius?: number;
  collisionRadius?: number;
}

/**
 * Zombie enemy class
 * Patrols the maze and chases the player when detected
 */
export class Zombie {
  // Unique identifier
  private id: number;
  private static nextId = 0;

  // Position and rotation
  private position: Position;
  private rotation: number;

  // Movement
  private patrolSpeed: number;
  private chaseSpeed: number;
  private velocity: Position;

  // Detection
  private detectionRadius: number;
  private collisionRadius: number;

  // State
  private state: ZombieState;
  private lastKnownPlayerPosition: Point | null;

  // Pathfinding
  private currentPath: Point[];
  private pathIndex: number;
  private pathRecalculateTimer: number;
  private static readonly PATH_RECALCULATE_INTERVAL = 0.5; // seconds

  // Patrol
  private patrolTarget: Point | null;
  private returnTarget: Point | null;

  // Freeze effect
  private frozenTimer: number;

  // Reference to maze for grid conversion
  private maze: MazeGenerator | null;
  private pathfinding: Pathfinding | null;

  constructor(config: ZombieConfig = {}) {
    this.id = Zombie.nextId++;

    // Initialize with defaults from constants
    this.patrolSpeed = config.patrolSpeed ?? ZOMBIE_PATROL_SPEED;
    this.chaseSpeed = config.chaseSpeed ?? ZOMBIE_CHASE_SPEED;
    this.detectionRadius = config.detectionRadius ?? ZOMBIE_DETECTION_RADIUS;
    this.collisionRadius = config.collisionRadius ?? PLAYER_COLLISION_RADIUS;

    // Initialize position
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = 0;
    this.velocity = { x: 0, y: 0, z: 0 };

    // Initialize state
    this.state = ZombieState.PATROL;
    this.lastKnownPlayerPosition = null;

    // Initialize pathfinding
    this.currentPath = [];
    this.pathIndex = 0;
    this.pathRecalculateTimer = 0;

    // Initialize patrol
    this.patrolTarget = null;
    this.returnTarget = null;

    // Initialize freeze
    this.frozenTimer = 0;

    // References
    this.maze = null;
    this.pathfinding = null;
  }

  /**
   * Initialize zombie with maze reference
   */
  initialize(maze: MazeGenerator, pathfinding: Pathfinding): void {
    this.maze = maze;
    this.pathfinding = pathfinding;
  }

  /**
   * Update zombie state
   * @param deltaTime Time since last update in seconds
   * @param playerPosition Player's current world position
   * @param canDetectPlayer Whether the zombie can detect the player (e.g., not invisible)
   */
  update(deltaTime: number, playerPosition: Position, canDetectPlayer: boolean = true): void {
    if (this.state === ZombieState.DEAD) return;

    // Handle frozen state
    if (this.state === ZombieState.FROZEN) {
      this.frozenTimer -= deltaTime;
      if (this.frozenTimer <= 0) {
        this.state = this.lastKnownPlayerPosition ? ZombieState.CHASE : ZombieState.PATROL;
      }
      this.velocity = { x: 0, y: 0, z: 0 };
      return;
    }

    // Update path recalculation timer
    this.pathRecalculateTimer -= deltaTime;

    // Check for player detection
    if (canDetectPlayer && this.canSeePlayer(playerPosition)) {
      this.lastKnownPlayerPosition = this.worldToGrid(playerPosition.x, playerPosition.z);
      if (this.state !== ZombieState.CHASE) {
        this.returnTarget = this.worldToGrid(this.position.x, this.position.z);
      }
      this.state = ZombieState.CHASE;
      this.recalculatePath(this.lastKnownPlayerPosition);
    } else if (this.state === ZombieState.CHASE) {
      // Lost sight of player, go to last known position
      if (this.reachedTarget()) {
        // Reached last known position, return to patrol
        this.state = ZombieState.RETURNING;
        this.lastKnownPlayerPosition = null;
        if (this.returnTarget) {
          this.recalculatePath(this.returnTarget);
        }
      }
    } else if (this.state === ZombieState.RETURNING) {
      if (this.reachedTarget()) {
        this.state = ZombieState.PATROL;
        this.returnTarget = null;
        this.currentPath = [];
      }
    }

    // Update movement based on state
    switch (this.state) {
      case ZombieState.CHASE:
        this.updateChase(deltaTime, playerPosition);
        break;
      case ZombieState.RETURNING:
        this.updatePathMovement(deltaTime, this.patrolSpeed);
        break;
      case ZombieState.PATROL:
        this.updatePatrol(deltaTime);
        break;
    }
  }

  /**
   * Check if zombie can see the player (within detection radius and line of sight)
   */
  private canSeePlayer(playerPosition: Position): boolean {
    const dx = playerPosition.x - this.position.x;
    const dz = playerPosition.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Check detection radius
    if (distance > this.detectionRadius) {
      return false;
    }

    // Check line of sight (simplified - checks if path exists and is short enough)
    if (this.maze && this.pathfinding) {
      const zombieGrid = this.worldToGrid(this.position.x, this.position.z);
      const playerGrid = this.worldToGrid(playerPosition.x, playerPosition.z);

      // Simple line of sight check - if straight path distance is close to actual distance,
      // there's likely a clear line of sight
      const pathLength = this.pathfinding.getPathLength(zombieGrid, playerGrid);

      // If path is reasonably direct (not more than 50% longer than straight line)
      const straightLineGridDist = Math.abs(zombieGrid.x - playerGrid.x) + Math.abs(zombieGrid.y - playerGrid.y);
      if (pathLength >= 0 && pathLength <= straightLineGridDist * 1.5 + 2) {
        return true;
      }
    }

    return distance <= this.detectionRadius / 2; // Fallback: very close detection
  }

  /**
   * Update chase behavior
   */
  private updateChase(deltaTime: number, playerPosition: Position): void {
    // Periodically recalculate path to player
    if (this.pathRecalculateTimer <= 0 && this.lastKnownPlayerPosition) {
      const playerGrid = this.worldToGrid(playerPosition.x, playerPosition.z);
      if (playerGrid.x !== this.lastKnownPlayerPosition.x || playerGrid.y !== this.lastKnownPlayerPosition.y) {
        this.lastKnownPlayerPosition = playerGrid;
        this.recalculatePath(playerGrid);
      }
      this.pathRecalculateTimer = Zombie.PATH_RECALCULATE_INTERVAL;
    }

    this.updatePathMovement(deltaTime, this.chaseSpeed);
  }

  /**
   * Update patrol behavior
   */
  private updatePatrol(deltaTime: number): void {
    // Pick a new patrol target if needed
    if (!this.patrolTarget || this.reachedTarget()) {
      this.pickPatrolTarget();
    }

    if (this.patrolTarget && this.currentPath.length === 0) {
      this.recalculatePath(this.patrolTarget);
    }

    this.updatePathMovement(deltaTime, this.patrolSpeed);
  }

  /**
   * Pick a random patrol target
   */
  private pickPatrolTarget(): void {
    if (!this.maze) return;

    const currentGrid = this.worldToGrid(this.position.x, this.position.z);
    const neighbors = this.maze.getAccessibleNeighbors(currentGrid.x, currentGrid.y);

    if (neighbors.length > 0) {
      // Pick a random accessible neighbor as next patrol point
      const randomIndex = Math.floor(Math.random() * neighbors.length);
      this.patrolTarget = neighbors[randomIndex];
    }
  }

  /**
   * Move along current path
   */
  private updatePathMovement(deltaTime: number, speed: number): void {
    if (this.currentPath.length === 0 || this.pathIndex >= this.currentPath.length) {
      this.velocity = { x: 0, y: 0, z: 0 };
      return;
    }

    const target = this.currentPath[this.pathIndex];
    const targetWorld = this.gridToWorld(target.x, target.y);

    const dx = targetWorld.x - this.position.x;
    const dz = targetWorld.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Reached current waypoint?
    if (distance < 0.5) {
      this.pathIndex++;
      if (this.pathIndex >= this.currentPath.length) {
        this.velocity = { x: 0, y: 0, z: 0 };
        return;
      }
      return this.updatePathMovement(deltaTime, speed);
    }

    // Move towards target
    const dirX = dx / distance;
    const dirZ = dz / distance;

    this.velocity.x = dirX * speed;
    this.velocity.z = dirZ * speed;

    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Update rotation to face movement direction
    this.rotation = Math.atan2(dirX, dirZ);
  }

  /**
   * Recalculate path to target
   */
  private recalculatePath(target: Point): void {
    if (!this.pathfinding) return;

    const currentGrid = this.worldToGrid(this.position.x, this.position.z);
    this.currentPath = this.pathfinding.findPath(currentGrid, target);
    this.pathIndex = 0;
  }

  /**
   * Check if zombie has reached its current target
   */
  private reachedTarget(): boolean {
    if (this.currentPath.length === 0) return true;
    return this.pathIndex >= this.currentPath.length;
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
   * Convert grid coordinates to world position
   */
  private gridToWorld(gridX: number, gridY: number): Position {
    return {
      x: gridX * CELL_SIZE,
      y: 0,
      z: gridY * CELL_SIZE,
    };
  }

  /**
   * Apply freeze effect
   */
  freeze(duration: number): void {
    if (this.state === ZombieState.DEAD) return;
    this.state = ZombieState.FROZEN;
    this.frozenTimer = duration;
  }

  /**
   * Kill the zombie
   */
  die(): void {
    this.state = ZombieState.DEAD;
    this.velocity = { x: 0, y: 0, z: 0 };
  }

  /**
   * Reset zombie to initial state
   */
  reset(startPosition?: Position): void {
    this.position = startPosition ?? { x: 0, y: 0, z: 0 };
    this.rotation = 0;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.state = ZombieState.PATROL;
    this.lastKnownPlayerPosition = null;
    this.currentPath = [];
    this.pathIndex = 0;
    this.patrolTarget = null;
    this.returnTarget = null;
    this.frozenTimer = 0;
  }

  // Getters

  getId(): number {
    return this.id;
  }

  getPosition(): Position {
    return { ...this.position };
  }

  getRotation(): number {
    return this.rotation;
  }

  getVelocity(): Position {
    return { ...this.velocity };
  }

  getState(): ZombieState {
    return this.state;
  }

  isAlive(): boolean {
    return this.state !== ZombieState.DEAD;
  }

  isFrozen(): boolean {
    return this.state === ZombieState.FROZEN;
  }

  getCollisionRadius(): number {
    return this.collisionRadius;
  }

  getDetectionRadius(): number {
    return this.detectionRadius;
  }

  // Setters

  setPosition(position: Position): void {
    this.position = { ...position };
  }

  setRotation(rotation: number): void {
    this.rotation = rotation;
  }

  /**
   * Check if a point is within collision distance
   */
  checkCollision(point: Position): boolean {
    const dx = this.position.x - point.x;
    const dz = this.position.z - point.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance < this.collisionRadius;
  }

  /**
   * Check collision with another entity (circle-circle)
   */
  checkCollisionWithRadius(point: Position, otherRadius: number): boolean {
    const dx = this.position.x - point.x;
    const dz = this.position.z - point.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance < this.collisionRadius + otherRadius;
  }

  /**
   * Get bounding box for collision detection
   */
  getBoundingBox(): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    return {
      minX: this.position.x - this.collisionRadius,
      maxX: this.position.x + this.collisionRadius,
      minZ: this.position.z - this.collisionRadius,
      maxZ: this.position.z + this.collisionRadius,
    };
  }
}
