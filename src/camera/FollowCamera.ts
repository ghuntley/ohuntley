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
}

/**
 * Third-person follow camera with smooth tracking
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

    // Calculate target position
    this.updateTargetPosition();

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
   */
  private updateTargetPosition(): void {
    // Calculate vertical and horizontal components based on angle
    const horizontalDistance = this.distance * Math.cos(this.angle);
    const verticalDistance = this.distance * Math.sin(this.angle);

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
    this.updateTargetPosition();
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
    };
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
