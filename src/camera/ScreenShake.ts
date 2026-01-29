import * as THREE from 'three';
import { SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY } from '../utils/Constants';

/**
 * Screen shake effect for combat feedback
 */
export class ScreenShake {
  private camera: THREE.Camera;
  private originalPosition: THREE.Vector3;
  private shakeTime: number;
  private shakeDuration: number;
  private shakeIntensity: number;
  private isShaking: boolean;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.originalPosition = new THREE.Vector3();
    this.shakeTime = 0;
    this.shakeDuration = SCREEN_SHAKE_DURATION;
    this.shakeIntensity = SCREEN_SHAKE_INTENSITY;
    this.isShaking = false;
  }

  /**
   * Start a screen shake effect
   */
  shake(intensity?: number, duration?: number): void {
    if (!this.isShaking) {
      this.originalPosition.copy(this.camera.position);
    }

    this.isShaking = true;
    this.shakeTime = 0;
    this.shakeDuration = duration ?? SCREEN_SHAKE_DURATION;
    this.shakeIntensity = intensity ?? SCREEN_SHAKE_INTENSITY;
  }

  /**
   * Update the screen shake effect
   */
  update(deltaTime: number): void {
    if (!this.isShaking) return;

    this.shakeTime += deltaTime;

    if (this.shakeTime >= this.shakeDuration) {
      // Shake complete - restore position offset
      this.isShaking = false;
      return;
    }

    // Calculate decay (shake intensity decreases over time)
    const progress = this.shakeTime / this.shakeDuration;
    const decay = 1 - progress;

    // Generate random offset
    const offsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;
    const offsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity * decay;

    // Apply offset to camera position
    // Note: We add the offset to whatever the current position is,
    // assuming the camera system will set the base position each frame
    this.camera.position.x += offsetX;
    this.camera.position.y += offsetY;
  }

  /**
   * Check if currently shaking
   */
  getIsShaking(): boolean {
    return this.isShaking;
  }

  /**
   * Stop the shake immediately
   */
  stop(): void {
    this.isShaking = false;
  }
}
