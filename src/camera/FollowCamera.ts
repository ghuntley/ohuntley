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

  constructor(config: FollowCameraConfig = {}) {
    // Initialize parameters from config or constants
    this.angle = ((config.angle ?? CAMERA_ANGLE) * Math.PI) / 180; // Convert to radians
    this.distance = config.distance ?? CAMERA_DISTANCE;
    this.heightOffset = config.heightOffset ?? CAMERA_HEIGHT_OFFSET;
    this.followSpeed = config.followSpeed ?? CAMERA_FOLLOW_SPEED;

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      config.fov ?? CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Initialize vectors
    this.targetPosition = new THREE.Vector3();
    this.lookAtTarget = new THREE.Vector3();
    this.playerPosition = new THREE.Vector3();

    // Set initial position
    this.updateTargetPosition();
    this.camera.position.copy(this.targetPosition);
    this.camera.lookAt(this.lookAtTarget);
  }

  /**
   * Update camera position to follow player
   */
  update(deltaTime: number, playerPosition: Position): void {
    // Update player position
    this.playerPosition.set(playerPosition.x, playerPosition.y, playerPosition.z);

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
   * Calculate target camera position based on player position
   * Camera is positioned behind and above player at fixed angle
   */
  private updateTargetPosition(): void {
    // Fixed orientation: camera always looks from south (positive Z) toward north
    // This means camera is at positive Z relative to player

    // Calculate vertical and horizontal components based on angle
    const horizontalDistance = this.distance * Math.cos(this.angle);
    const verticalDistance = this.distance * Math.sin(this.angle);

    this.targetPosition.set(
      this.playerPosition.x, // Same X as player (no left/right offset)
      this.playerPosition.y + this.heightOffset + verticalDistance,
      this.playerPosition.z + horizontalDistance // Behind player (positive Z)
    );
  }

  /**
   * Immediately snap camera to target position (no lerp)
   */
  snapToTarget(playerPosition: Position): void {
    this.playerPosition.set(playerPosition.x, playerPosition.y, playerPosition.z);
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
