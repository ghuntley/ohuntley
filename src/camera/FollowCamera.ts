/**
 * Follow Camera for Meerkat Maze Runner
 * Third-person camera that smoothly follows the player
 */

import * as THREE from 'three';
import { Position } from '../entities/Player';
import {
  CAMERA_ANGLE,
  CAMERA_DISTANCE,
  CAMERA_HEIGHT_OFFSET,
  CAMERA_FOV,
  CAMERA_FOLLOW_SPEED,
} from '../utils/Constants';

/** Camera configuration options */
export interface FollowCameraConfig {
  angle?: number;
  distance?: number;
  heightOffset?: number;
  fov?: number;
  followSpeed?: number;
  collisionEnabled?: boolean;
  collisionPadding?: number;
  minDistance?: number;
}

/**
 * Third-person follow camera with smooth tracking and wall collision avoidance
 */
export class FollowCamera {
  private camera: THREE.PerspectiveCamera;
  private ownsCamera: boolean;

  // Camera parameters
  private angle: number; // Angle from horizontal in radians
  private distance: number;
  private heightOffset: number;
  private followSpeed: number;

  // Target position (where camera wants to be)
  private targetPosition: THREE.Vector3;

  // Current look-at target
  private lookAtTarget: THREE.Vector3;

  // Player position tracking
  private playerPosition: THREE.Vector3;

  // Player rotation tracking (for camera to follow behind player)
  private playerRotation: number;

  // Collision avoidance
  private collisionEnabled: boolean;
  private collisionPadding: number;
  private minDistance: number;
  private raycaster: THREE.Raycaster;
  private collisionObjects: THREE.Object3D[] = [];
  private currentDistance: number; // Actual distance used (may be reduced due to collision)

  /**
   * Create a FollowCamera
   * @param cameraOrConfig Either an existing camera to control, or a config object
   */
  constructor(cameraOrConfig?: THREE.PerspectiveCamera | FollowCameraConfig) {
    // Determine if we were passed a camera or config
    let config: FollowCameraConfig = {};

    if (cameraOrConfig instanceof THREE.PerspectiveCamera) {
      // Use the provided camera
      this.camera = cameraOrConfig;
      this.ownsCamera = false;
    } else {
      // Use config, create our own camera
      config = cameraOrConfig ?? {};
      this.camera = new THREE.PerspectiveCamera(
        config.fov ?? CAMERA_FOV,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      this.ownsCamera = true;
    }

    // Initialize parameters from config or constants
    this.angle = ((config.angle ?? CAMERA_ANGLE) * Math.PI) / 180; // Convert to radians
    this.distance = config.distance ?? CAMERA_DISTANCE;
    this.heightOffset = config.heightOffset ?? CAMERA_HEIGHT_OFFSET;
    this.followSpeed = config.followSpeed ?? CAMERA_FOLLOW_SPEED;

    // Initialize collision parameters
    this.collisionEnabled = config.collisionEnabled ?? true;
    this.collisionPadding = config.collisionPadding ?? 0.5;
    this.minDistance = config.minDistance ?? 3;
    this.raycaster = new THREE.Raycaster();
    this.currentDistance = this.distance;

    // Initialize vectors
    this.targetPosition = new THREE.Vector3();
    this.lookAtTarget = new THREE.Vector3();
    this.playerPosition = new THREE.Vector3();
    this.playerRotation = 0;

    // Set initial position
    this.updateTargetPosition();
    this.camera.position.copy(this.targetPosition);
    this.camera.lookAt(this.lookAtTarget);
  }

  /**
   * Update camera position to follow player
   * @param deltaTime Time since last update
   * @param playerPosition Player's world position
   * @param playerRotation Player's Y rotation in radians (optional, for rotating camera)
   */
  update(deltaTime: number, playerPosition: Position, playerRotation?: number): void {
    // Update player position
    this.playerPosition.set(playerPosition.x, playerPosition.y, playerPosition.z);

    // Update player rotation if provided
    if (playerRotation !== undefined) {
      this.playerRotation = playerRotation;
    }

    // Calculate ideal target position at full distance
    this.updateTargetPosition(this.distance);

    // Check for collisions and adjust distance if needed
    if (this.collisionEnabled && this.collisionObjects.length > 0) {
      const adjustedDistance = this.checkCollision();
      if (adjustedDistance < this.currentDistance) {
        // Quickly move closer when obstructed
        this.currentDistance = adjustedDistance;
      } else {
        // Smoothly return to full distance when unobstructed
        this.currentDistance = this.currentDistance + (this.distance - this.currentDistance) * 0.05;
      }
      // Recalculate target with adjusted distance
      this.updateTargetPosition(this.currentDistance);
    }

    // Smooth interpolation to target position
    const lerpFactor = 1 - Math.exp(-this.followSpeed * deltaTime);

    this.camera.position.lerp(this.targetPosition, lerpFactor);
    this.lookAtTarget.lerp(this.playerPosition, lerpFactor);

    // Always look at player
    this.camera.lookAt(this.lookAtTarget);
  }

  /**
   * Calculate target camera position based on player position and rotation
   * Camera is positioned behind and above player, rotating with player facing
   * @param dist Distance from player (may be adjusted for collision)
   */
  private updateTargetPosition(dist?: number): void {
    const useDistance = dist ?? this.distance;

    // Calculate vertical and horizontal components based on angle
    const horizontalDistance = useDistance * Math.cos(this.angle);
    const verticalDistance = useDistance * Math.sin(this.angle);

    // Camera orbits around player based on player's rotation
    // Player rotation uses atan2(dirX, dirZ):
    //   rotation=0 → facing -Z (north on screen)
    //   rotation=PI/2 → facing -X (left)
    //   rotation=PI → facing +Z (south)
    // Camera stays behind player (opposite of facing direction)
    // When rotation=0, camera should be at +Z (behind player facing -Z)
    const offsetX = Math.sin(this.playerRotation) * horizontalDistance;
    const offsetZ = Math.cos(this.playerRotation) * horizontalDistance;

    this.targetPosition.set(
      this.playerPosition.x + offsetX,
      this.playerPosition.y + this.heightOffset + verticalDistance,
      this.playerPosition.z + offsetZ
    );
  }

  /**
   * Check for collisions between player and camera target position
   * @returns Adjusted distance that avoids collision, or full distance if clear
   */
  private checkCollision(): number {
    // Calculate direction from player to target camera position
    const direction = new THREE.Vector3()
      .subVectors(this.targetPosition, this.playerPosition)
      .normalize();

    // Cast ray from player towards camera target
    const playerHead = this.playerPosition.clone();
    playerHead.y += 1.5; // Start from approximate head height

    this.raycaster.set(playerHead, direction);
    this.raycaster.far = this.distance + this.collisionPadding;

    const intersections = this.raycaster.intersectObjects(this.collisionObjects, true);

    if (intersections.length > 0) {
      // Found an obstruction - move camera closer
      const hitDistance = intersections[0].distance - this.collisionPadding;
      return Math.max(this.minDistance, hitDistance);
    }

    // No obstruction - use full distance
    return this.distance;
  }

  /**
   * Set objects that the camera should avoid clipping through
   * @param objects Array of Three.js objects (typically maze walls)
   */
  setCollisionObjects(objects: THREE.Object3D[]): void {
    this.collisionObjects = objects;
  }

  /**
   * Add a single object to collision detection
   * @param object Three.js object to add
   */
  addCollisionObject(object: THREE.Object3D): void {
    if (!this.collisionObjects.includes(object)) {
      this.collisionObjects.push(object);
    }
  }

  /**
   * Remove an object from collision detection
   * @param object Three.js object to remove
   */
  removeCollisionObject(object: THREE.Object3D): void {
    const index = this.collisionObjects.indexOf(object);
    if (index !== -1) {
      this.collisionObjects.splice(index, 1);
    }
  }

  /**
   * Clear all collision objects
   */
  clearCollisionObjects(): void {
    this.collisionObjects = [];
  }

  /**
   * Enable or disable collision avoidance
   */
  setCollisionEnabled(enabled: boolean): void {
    this.collisionEnabled = enabled;
    if (!enabled) {
      this.currentDistance = this.distance;
    }
  }

  /**
   * Check if collision avoidance is enabled
   */
  isCollisionEnabled(): boolean {
    return this.collisionEnabled;
  }

  /**
   * Immediately snap camera to target position (no lerp)
   * @param playerPosition Player's world position
   * @param playerRotation Player's Y rotation in radians (optional)
   */
  snapToTarget(playerPosition: Position, playerRotation?: number): void {
    this.playerPosition.set(playerPosition.x, playerPosition.y, playerPosition.z);
    if (playerRotation !== undefined) {
      this.playerRotation = playerRotation;
    }
    this.lookAtTarget.copy(this.playerPosition);

    // Check for collision and adjust distance
    this.updateTargetPosition(this.distance);
    if (this.collisionEnabled && this.collisionObjects.length > 0) {
      this.currentDistance = this.checkCollision();
      this.updateTargetPosition(this.currentDistance);
    } else {
      this.currentDistance = this.distance;
    }

    this.camera.position.copy(this.targetPosition);
    this.camera.lookAt(this.lookAtTarget);
  }

  /**
   * Handle window resize
   */
  handleResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Get the Three.js camera
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get current camera position
   */
  getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  /**
   * Set camera parameters
   */
  setParameters(config: Partial<FollowCameraConfig>): void {
    if (config.angle !== undefined) {
      this.angle = (config.angle * Math.PI) / 180;
    }
    if (config.distance !== undefined) {
      this.distance = config.distance;
      this.currentDistance = Math.min(this.currentDistance, this.distance);
    }
    if (config.heightOffset !== undefined) {
      this.heightOffset = config.heightOffset;
    }
    if (config.followSpeed !== undefined) {
      this.followSpeed = config.followSpeed;
    }
    if (config.fov !== undefined) {
      this.camera.fov = config.fov;
      this.camera.updateProjectionMatrix();
    }
    if (config.collisionEnabled !== undefined) {
      this.setCollisionEnabled(config.collisionEnabled);
    }
    if (config.collisionPadding !== undefined) {
      this.collisionPadding = config.collisionPadding;
    }
    if (config.minDistance !== undefined) {
      this.minDistance = config.minDistance;
    }
  }

  /**
   * Get camera parameters
   */
  getParameters(): FollowCameraConfig {
    return {
      angle: (this.angle * 180) / Math.PI,
      distance: this.distance,
      heightOffset: this.heightOffset,
      followSpeed: this.followSpeed,
      fov: this.camera.fov,
      collisionEnabled: this.collisionEnabled,
      collisionPadding: this.collisionPadding,
      minDistance: this.minDistance,
    };
  }

  /**
   * Get current effective distance (may be reduced due to collision)
   */
  getCurrentDistance(): number {
    return this.currentDistance;
  }

  /**
   * Get camera frustum for visibility checks
   */
  getFrustum(): THREE.Frustum {
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);
    return frustum;
  }

  /**
   * Check if a point is visible to the camera
   */
  isPointVisible(point: THREE.Vector3): boolean {
    this.camera.updateMatrixWorld();
    const frustum = this.getFrustum();
    return frustum.containsPoint(point);
  }

  /**
   * Check if a sphere is visible to the camera
   */
  isSphereVisible(center: THREE.Vector3, radius: number): boolean {
    this.camera.updateMatrixWorld();
    const frustum = this.getFrustum();
    const sphere = new THREE.Sphere(center, radius);
    return frustum.intersectsSphere(sphere);
  }
}
