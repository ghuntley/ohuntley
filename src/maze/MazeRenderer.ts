/**
 * Maze Renderer for Meerkat Maze Runner
 * Converts maze data into 3D hedge walls using Three.js
 */

import * as THREE from 'three';
import { MazeGenerator, MazeCell, Direction, Point } from './MazeGenerator';
import {
  CELL_SIZE,
  WALL_THICKNESS,
  WALL_HEIGHT,
} from '../utils/Constants';

/** Wall segment data for instancing */
interface WallSegment {
  x: number;
  z: number;
  rotation: number; // 0 for N/S walls, PI/2 for E/W walls
}

/**
 * Renders maze as 3D hedge walls
 */
export class MazeRenderer {
  private scene: THREE.Scene;
  private mazeGroup: THREE.Group;
  private wallMesh: THREE.InstancedMesh | null = null;
  private floorMesh: THREE.Mesh | null = null;
  private startMarker: THREE.Mesh | null = null;
  private exitMarker: THREE.Mesh | null = null;

  // Materials
  private wallMaterial: THREE.MeshStandardMaterial;
  private floorMaterial: THREE.MeshStandardMaterial;
  private startMaterial: THREE.MeshStandardMaterial;
  private exitMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mazeGroup = new THREE.Group();
    this.mazeGroup.name = 'maze';
    this.scene.add(this.mazeGroup);

    // Initialize materials
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x228b22, // Forest green for hedge
      roughness: 0.9,
      metalness: 0.0,
    });

    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a5f0b, // Grass green
      roughness: 0.8,
      metalness: 0.1,
    });

    this.startMaterial = new THREE.MeshStandardMaterial({
      color: 0x4169e1, // Royal blue
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0x4169e1,
      emissiveIntensity: 0.2,
    });

    this.exitMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Gold
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0xffd700,
      emissiveIntensity: 0.3,
    });
  }

  /**
   * Build 3D maze from generator data
   */
  build(generator: MazeGenerator): void {
    // Clear previous maze
    this.clear();

    const { width, height } = generator.getDimensions();
    const grid = generator.getGrid();
    const start = generator.getStart();
    const exit = generator.getExit();

    // Create floor
    this.createFloor(width, height);

    // Create walls
    this.createWalls(grid, width, height);

    // Create markers
    this.createStartMarker(start);
    this.createExitMarker(exit);

    // Create boundary walls
    this.createBoundaryWalls(width, height);
  }

  /**
   * Create floor plane
   */
  private createFloor(width: number, height: number): void {
    const floorWidth = width * CELL_SIZE;
    const floorHeight = height * CELL_SIZE;

    const geometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
    this.floorMesh = new THREE.Mesh(geometry, this.floorMaterial);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.set(
      (floorWidth - CELL_SIZE) / 2,
      0,
      (floorHeight - CELL_SIZE) / 2
    );
    this.floorMesh.receiveShadow = true;
    this.floorMesh.name = 'floor';

    this.mazeGroup.add(this.floorMesh);
  }

  /**
   * Create walls using instanced mesh for performance
   */
  private createWalls(grid: MazeCell[][], width: number, height: number): void {
    const wallSegments: WallSegment[] = [];

    // Collect all wall segments
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = grid[y][x];

        // North wall (only process if this is the top row or cell above has no south wall)
        if (cell.walls[Direction.NORTH]) {
          wallSegments.push({
            x: x * CELL_SIZE,
            z: y * CELL_SIZE - CELL_SIZE / 2,
            rotation: 0,
          });
        }

        // West wall (only process if this is the left column or cell to left has no east wall)
        if (cell.walls[Direction.WEST]) {
          wallSegments.push({
            x: x * CELL_SIZE - CELL_SIZE / 2,
            z: y * CELL_SIZE,
            rotation: Math.PI / 2,
          });
        }

        // East wall for rightmost column
        if (x === width - 1 && cell.walls[Direction.EAST]) {
          wallSegments.push({
            x: x * CELL_SIZE + CELL_SIZE / 2,
            z: y * CELL_SIZE,
            rotation: Math.PI / 2,
          });
        }

        // South wall for bottom row
        if (y === height - 1 && cell.walls[Direction.SOUTH]) {
          wallSegments.push({
            x: x * CELL_SIZE,
            z: y * CELL_SIZE + CELL_SIZE / 2,
            rotation: 0,
          });
        }
      }
    }

    if (wallSegments.length === 0) return;

    // Create instanced mesh
    const wallGeometry = new THREE.BoxGeometry(
      CELL_SIZE + WALL_THICKNESS, // Length along wall direction
      WALL_HEIGHT,
      WALL_THICKNESS
    );

    this.wallMesh = new THREE.InstancedMesh(
      wallGeometry,
      this.wallMaterial,
      wallSegments.length
    );
    this.wallMesh.castShadow = true;
    this.wallMesh.receiveShadow = true;
    this.wallMesh.name = 'walls';

    // Position each wall instance
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    wallSegments.forEach((segment, i) => {
      position.set(segment.x, WALL_HEIGHT / 2, segment.z);
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), segment.rotation);
      matrix.compose(position, quaternion, scale);
      this.wallMesh!.setMatrixAt(i, matrix);
    });

    this.wallMesh.instanceMatrix.needsUpdate = true;
    this.mazeGroup.add(this.wallMesh);
  }

  /**
   * Create outer boundary walls
   */
  private createBoundaryWalls(width: number, height: number): void {
    const mazeWidth = width * CELL_SIZE;
    const mazeHeight = height * CELL_SIZE;

    // Corner pillars to fill gaps
    const pillarGeometry = new THREE.BoxGeometry(
      WALL_THICKNESS,
      WALL_HEIGHT,
      WALL_THICKNESS
    );

    const corners = [
      { x: -CELL_SIZE / 2, z: -CELL_SIZE / 2 },
      { x: mazeWidth - CELL_SIZE / 2, z: -CELL_SIZE / 2 },
      { x: -CELL_SIZE / 2, z: mazeHeight - CELL_SIZE / 2 },
      { x: mazeWidth - CELL_SIZE / 2, z: mazeHeight - CELL_SIZE / 2 },
    ];

    corners.forEach((corner) => {
      const pillar = new THREE.Mesh(pillarGeometry, this.wallMaterial);
      pillar.position.set(corner.x, WALL_HEIGHT / 2, corner.z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.mazeGroup.add(pillar);
    });
  }

  /**
   * Create start position marker
   */
  private createStartMarker(start: Point): void {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
    this.startMarker = new THREE.Mesh(geometry, this.startMaterial);
    this.startMarker.position.set(
      start.x * CELL_SIZE,
      0.05,
      start.y * CELL_SIZE
    );
    this.startMarker.receiveShadow = true;
    this.startMarker.name = 'startMarker';

    this.mazeGroup.add(this.startMarker);
  }

  /**
   * Create exit marker (archway/gate visual)
   */
  private createExitMarker(exit: Point): void {
    // Base platform
    const baseGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
    this.exitMarker = new THREE.Mesh(baseGeometry, this.exitMaterial);
    this.exitMarker.position.set(
      exit.x * CELL_SIZE,
      0.05,
      exit.y * CELL_SIZE
    );
    this.exitMarker.receiveShadow = true;
    this.exitMarker.name = 'exitMarker';

    // Add glow ring
    const ringGeometry = new THREE.TorusGeometry(0.6, 0.08, 8, 24);
    const ringMesh = new THREE.Mesh(ringGeometry, this.exitMaterial);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.1;
    this.exitMarker.add(ringMesh);

    // Add vertical beacon
    const beaconGeometry = new THREE.CylinderGeometry(0.05, 0.15, 2, 8);
    const beaconMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
    });
    const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
    beacon.position.y = 1.1;
    this.exitMarker.add(beacon);

    this.mazeGroup.add(this.exitMarker);
  }

  /**
   * Clear all maze geometry
   */
  clear(): void {
    // Remove all children from maze group
    while (this.mazeGroup.children.length > 0) {
      const child = this.mazeGroup.children[0];
      this.mazeGroup.remove(child);

      // Dispose geometries and materials
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      } else if (child instanceof THREE.InstancedMesh) {
        child.geometry.dispose();
      }
    }

    this.wallMesh = null;
    this.floorMesh = null;
    this.startMarker = null;
    this.exitMarker = null;
  }

  /**
   * Convert grid coordinates to world position
   */
  gridToWorld(gridX: number, gridY: number): THREE.Vector3 {
    return new THREE.Vector3(
      gridX * CELL_SIZE,
      0,
      gridY * CELL_SIZE
    );
  }

  /**
   * Convert world position to grid coordinates
   */
  worldToGrid(worldX: number, worldZ: number): { x: number; y: number } {
    return {
      x: Math.round(worldX / CELL_SIZE),
      y: Math.round(worldZ / CELL_SIZE),
    };
  }

  /**
   * Get the maze group for scene management
   */
  getMazeGroup(): THREE.Group {
    return this.mazeGroup;
  }

  /**
   * Get wall meshes for camera collision detection
   * Returns all wall objects (instanced mesh and boundary pillars)
   */
  getWallMeshes(): THREE.Object3D[] {
    const walls: THREE.Object3D[] = [];
    this.mazeGroup.traverse((child) => {
      if (child instanceof THREE.InstancedMesh || (child instanceof THREE.Mesh && child.name !== 'floor' && child.name !== 'startMarker' && child.name !== 'exitMarker')) {
        walls.push(child);
      }
    });
    return walls;
  }

  /**
   * Update animation (e.g., exit marker glow)
   */
  update(deltaTime: number): void {
    if (this.exitMarker) {
      // Subtle hover animation
      this.exitMarker.position.y = 0.05 + Math.sin(Date.now() * 0.003) * 0.05;
      this.exitMarker.rotation.y += deltaTime * 0.5;
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clear();
    this.wallMaterial.dispose();
    this.floorMaterial.dispose();
    this.startMaterial.dispose();
    this.exitMaterial.dispose();
    this.scene.remove(this.mazeGroup);
  }
}
