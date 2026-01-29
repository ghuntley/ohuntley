/**
 * Spectator Meerkat Manager for Meerkat Maze Runner
 * Manages spawning and updating all spectator meerkats with instanced rendering
 */

import * as THREE from 'three';
import { SpectatorMeerkat, AlertLevel, createSpectatorMeerkatMesh } from './SpectatorMeerkat';
import { Position } from './Player';
import { MazeGenerator, Direction } from '../maze/MazeGenerator';

/** Configuration for spectator manager */
export interface SpectatorManagerConfig {
  /** Minimum cells between spectators (default: 3) */
  minSpacing?: number;
  /** Maximum cells between spectators (default: 5) */
  maxSpacing?: number;
  /** Spawn probability when conditions are met (default: 0.7) */
  spawnProbability?: number;
}

/** Edge type for wall positions */
type WallEdge = 'north' | 'south' | 'east' | 'west';

/** Wall position data */
interface WallPosition {
  gridX: number;
  gridY: number;
  edge: WallEdge;
}

/**
 * Manages all spectator meerkats in the maze
 */
export class SpectatorMeerkatManager {
  private scene: THREE.Scene;
  private spectators: SpectatorMeerkat[];
  private spectatorMeshes: Map<number, THREE.Group>;

  // Instanced rendering components
  private bodyInstancedMesh: THREE.InstancedMesh | null;
  private headInstancedMesh: THREE.InstancedMesh | null;
  private useInstancing: boolean;

  // Configuration
  private minSpacing: number;
  private spawnProbability: number;

  // Group to hold all spectator objects
  private spectatorGroup: THREE.Group;

  constructor(scene: THREE.Scene, config: SpectatorManagerConfig = {}) {
    this.scene = scene;
    this.spectators = [];
    this.spectatorMeshes = new Map();

    this.bodyInstancedMesh = null;
    this.headInstancedMesh = null;
    this.useInstancing = false;

    this.minSpacing = config.minSpacing ?? 3;
    this.spawnProbability = config.spawnProbability ?? 0.7;

    // Create group for all spectators
    this.spectatorGroup = new THREE.Group();
    this.spectatorGroup.name = 'spectatorMeerkats';
    this.scene.add(this.spectatorGroup);
  }

  /**
   * Spawn spectators based on maze layout
   */
  spawn(maze: MazeGenerator): void {
    // Clear existing spectators
    this.clear();

    // Get valid wall positions
    const wallPositions = this.findWallPositions(maze);

    // Select spawn positions with spacing
    const spawnPositions = this.selectSpawnPositions(wallPositions, maze);

    // Decide rendering method based on count
    this.useInstancing = spawnPositions.length > 10;

    // Create spectators
    for (const pos of spawnPositions) {
      const spectator = new SpectatorMeerkat({
        gridX: pos.gridX,
        gridY: pos.gridY,
        edge: pos.edge,
      });
      this.spectators.push(spectator);
    }

    // Create meshes
    if (this.useInstancing) {
      this.createInstancedMeshes();
    } else {
      this.createIndividualMeshes();
    }

    console.log(`Spawned ${this.spectators.length} spectator meerkats`);
  }

  /**
   * Find all valid wall positions in the maze
   */
  private findWallPositions(maze: MazeGenerator): WallPosition[] {
    const positions: WallPosition[] = [];
    const { width, height } = maze.getDimensions();
    const grid = maze.getGrid();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = grid[y][x];

        // Check each wall of the cell
        if (cell.walls[Direction.NORTH] && y > 0) {
          positions.push({ gridX: x, gridY: y, edge: 'north' });
        }
        if (cell.walls[Direction.SOUTH] && y < height - 1) {
          positions.push({ gridX: x, gridY: y, edge: 'south' });
        }
        if (cell.walls[Direction.EAST] && x < width - 1) {
          positions.push({ gridX: x, gridY: y, edge: 'east' });
        }
        if (cell.walls[Direction.WEST] && x > 0) {
          positions.push({ gridX: x, gridY: y, edge: 'west' });
        }
      }
    }

    return positions;
  }

  /**
   * Select spawn positions with proper spacing
   */
  private selectSpawnPositions(
    wallPositions: WallPosition[],
    _maze: MazeGenerator
  ): WallPosition[] {
    const selected: WallPosition[] = [];
    const usedCells = new Set<string>();

    // Shuffle positions for randomness
    const shuffled = [...wallPositions].sort(() => Math.random() - 0.5);

    for (const pos of shuffled) {
      const key = `${pos.gridX},${pos.gridY}`;

      // Check spacing from existing spectators
      if (this.isTooCloseToExisting(pos, selected)) {
        continue;
      }

      // Don't place multiple on same cell
      if (usedCells.has(key)) {
        continue;
      }

      // Random chance to spawn
      if (Math.random() > this.spawnProbability) {
        continue;
      }

      selected.push(pos);
      usedCells.add(key);

      // Mark nearby cells as blocked for spacing
      for (let dy = -this.minSpacing; dy <= this.minSpacing; dy++) {
        for (let dx = -this.minSpacing; dx <= this.minSpacing; dx++) {
          const blockedKey = `${pos.gridX + dx},${pos.gridY + dy}`;
          // Only block for minimum spacing, allow some flexibility
          if (Math.abs(dx) + Math.abs(dy) < this.minSpacing) {
            usedCells.add(blockedKey);
          }
        }
      }
    }

    return selected;
  }

  /**
   * Check if position is too close to existing spectators
   */
  private isTooCloseToExisting(pos: WallPosition, existing: WallPosition[]): boolean {
    for (const other of existing) {
      const dx = Math.abs(pos.gridX - other.gridX);
      const dy = Math.abs(pos.gridY - other.gridY);
      const distance = dx + dy;

      if (distance < this.minSpacing) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create instanced meshes for many spectators
   */
  private createInstancedMeshes(): void {
    const count = this.spectators.length;
    if (count === 0) return;

    // Body geometry and material
    const bodyGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xd2b48c,
      roughness: 0.8,
    });

    this.bodyInstancedMesh = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, count);
    this.bodyInstancedMesh.castShadow = true;
    this.bodyInstancedMesh.name = 'spectatorBodies';
    this.spectatorGroup.add(this.bodyInstancedMesh);

    // Head geometry and material
    const headGeometry = new THREE.SphereGeometry(0.15, 8, 6);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xdeb887,
      roughness: 0.7,
    });

    this.headInstancedMesh = new THREE.InstancedMesh(headGeometry, headMaterial, count);
    this.headInstancedMesh.castShadow = true;
    this.headInstancedMesh.name = 'spectatorHeads';
    this.spectatorGroup.add(this.headInstancedMesh);

    // Set initial transforms
    this.updateInstancedMeshes();
  }

  /**
   * Create individual meshes for few spectators (better detail)
   */
  private createIndividualMeshes(): void {
    for (const spectator of this.spectators) {
      const mesh = createSpectatorMeerkatMesh();
      mesh.name = `spectator_${spectator.getId()}`;

      // Set initial position and rotation
      const pos = spectator.getPosition();
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.rotation.y = spectator.getBodyRotation();

      this.spectatorGroup.add(mesh);
      this.spectatorMeshes.set(spectator.getId(), mesh);
    }
  }

  /**
   * Update instanced mesh transforms
   */
  private updateInstancedMeshes(): void {
    if (!this.bodyInstancedMesh || !this.headInstancedMesh) return;

    const bodyMatrix = new THREE.Matrix4();
    const headMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    this.spectators.forEach((spectator, index) => {
      const pos = spectator.getPosition();
      const sway = spectator.getSwayOffset();
      const breathScale = spectator.getBreathingScale();

      // Body transform
      position.set(pos.x + sway.x, pos.y + 0.3, pos.z + sway.z);
      quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        spectator.getBodyRotation() + sway.rotY
      );
      scale.set(breathScale, breathScale, breathScale);
      bodyMatrix.compose(position, quaternion, scale);
      this.bodyInstancedMesh!.setMatrixAt(index, bodyMatrix);

      // Head transform (higher up, with head rotation)
      position.set(pos.x + sway.x, pos.y + 0.7, pos.z + sway.z);
      const headAngle = spectator.getBodyRotation() + spectator.getHeadRotation() + sway.rotY;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), headAngle);
      scale.set(1, 1, 1);
      headMatrix.compose(position, quaternion, scale);
      this.headInstancedMesh!.setMatrixAt(index, headMatrix);
    });

    this.bodyInstancedMesh.instanceMatrix.needsUpdate = true;
    this.headInstancedMesh.instanceMatrix.needsUpdate = true;

    // Update colors based on alert level
    this.updateInstancedColors();
  }

  /**
   * Update instanced mesh colors based on alert state
   */
  private updateInstancedColors(): void {
    if (!this.bodyInstancedMesh) return;

    // For instanced meshes, we use a single material, so we can't have per-instance colors
    // without custom shaders. For now, we'll change the overall material color based on
    // average alert level
    let totalAlert = 0;
    for (const spectator of this.spectators) {
      totalAlert += spectator.getAlertLevel();
    }
    const avgAlert = totalAlert / this.spectators.length;

    const material = this.bodyInstancedMesh.material as THREE.MeshStandardMaterial;
    if (avgAlert >= AlertLevel.ALERT) {
      material.emissive.setHex(0x331100);
      material.emissiveIntensity = 0.2;
    } else {
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
    }
  }

  /**
   * Update individual mesh transforms
   */
  private updateIndividualMeshes(): void {
    for (const spectator of this.spectators) {
      const mesh = this.spectatorMeshes.get(spectator.getId());
      if (!mesh) continue;

      const pos = spectator.getPosition();
      const sway = spectator.getSwayOffset();
      const breathScale = spectator.getBreathingScale();

      // Update main group position
      mesh.position.set(pos.x + sway.x, pos.y, pos.z + sway.z);
      mesh.rotation.y = spectator.getBodyRotation() + sway.rotY;
      mesh.scale.setScalar(breathScale);

      // Update head rotation
      const headGroup = mesh.getObjectByName('headGroup') as THREE.Group;
      if (headGroup) {
        headGroup.rotation.y = spectator.getHeadRotation();
      }

      // Update materials based on alert level
      const alertLevel = spectator.getAlertLevel();
      const body = mesh.getObjectByName('body') as THREE.Mesh;
      if (body) {
        const material = body.material as THREE.MeshStandardMaterial;
        if (alertLevel >= AlertLevel.ALERT) {
          material.emissive.setHex(0x331100);
          material.emissiveIntensity = 0.3;
        } else {
          material.emissive.setHex(0x000000);
          material.emissiveIntensity = 0;
        }
      }
    }
  }

  /**
   * Update all spectators
   */
  update(deltaTime: number, playerPosition: Position, zombiePositions: Position[]): void {
    // Update each spectator's logic
    for (const spectator of this.spectators) {
      spectator.update(deltaTime, playerPosition, zombiePositions);
    }

    // Update meshes
    if (this.useInstancing) {
      this.updateInstancedMeshes();
    } else {
      this.updateIndividualMeshes();
    }
  }

  /**
   * Clear all spectators
   */
  clear(): void {
    // Clear individual meshes
    for (const mesh of this.spectatorMeshes.values()) {
      this.spectatorGroup.remove(mesh);
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }
    this.spectatorMeshes.clear();

    // Clear instanced meshes
    if (this.bodyInstancedMesh) {
      this.spectatorGroup.remove(this.bodyInstancedMesh);
      this.bodyInstancedMesh.geometry.dispose();
      (this.bodyInstancedMesh.material as THREE.Material).dispose();
      this.bodyInstancedMesh = null;
    }

    if (this.headInstancedMesh) {
      this.spectatorGroup.remove(this.headInstancedMesh);
      this.headInstancedMesh.geometry.dispose();
      (this.headInstancedMesh.material as THREE.Material).dispose();
      this.headInstancedMesh = null;
    }

    // Clear spectator list
    this.spectators = [];
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clear();
    this.scene.remove(this.spectatorGroup);
  }

  /**
   * Get all spectators
   */
  getSpectators(): SpectatorMeerkat[] {
    return [...this.spectators];
  }

  /**
   * Get spectator count
   */
  getCount(): number {
    return this.spectators.length;
  }

  /**
   * Get alerted spectator count
   */
  getAlertedCount(): number {
    return this.spectators.filter((s) => s.getIsAlerted()).length;
  }

  /**
   * Get the maximum alert level among all spectators
   */
  getMaxAlertLevel(): AlertLevel {
    let maxLevel = AlertLevel.CALM;
    for (const spectator of this.spectators) {
      const level = spectator.getAlertLevel();
      if (level > maxLevel) {
        maxLevel = level;
      }
    }
    return maxLevel;
  }
}
