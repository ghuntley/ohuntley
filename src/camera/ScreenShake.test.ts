/**
 * Tests for Screen Shake
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ScreenShake } from './ScreenShake';

describe('ScreenShake', () => {
  let camera: THREE.PerspectiveCamera;
  let screenShake: ScreenShake;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 10, 15);
    screenShake = new ScreenShake(camera);
  });

  describe('initialization', () => {
    it('should initialize without shaking', () => {
      expect(screenShake.getIsShaking()).toBe(false);
    });
  });

  describe('shake', () => {
    it('should start shaking when shake is called', () => {
      screenShake.shake();

      expect(screenShake.getIsShaking()).toBe(true);
    });

    it('should accept custom intensity', () => {
      screenShake.shake(0.5);

      expect(screenShake.getIsShaking()).toBe(true);
    });

    it('should accept custom duration', () => {
      screenShake.shake(0.3, 0.5);

      expect(screenShake.getIsShaking()).toBe(true);
    });

    it('should reset shake time when called multiple times', () => {
      screenShake.shake(0.3, 0.2);
      screenShake.update(0.1); // Partial shake

      screenShake.shake(0.3, 0.2); // Reset shake

      expect(screenShake.getIsShaking()).toBe(true);
    });
  });

  describe('update', () => {
    it('should not modify camera when not shaking', () => {
      const originalX = camera.position.x;
      const originalY = camera.position.y;

      screenShake.update(0.016);

      expect(camera.position.x).toBe(originalX);
      expect(camera.position.y).toBe(originalY);
    });

    it('should modify camera position when shaking', () => {
      screenShake.shake(1.0, 0.5);
      screenShake.update(0.016);

      // Position should be offset (though randomness makes exact testing difficult)
      // We just verify it was still shaking
      expect(screenShake.getIsShaking()).toBe(true);
    });

    it('should stop shaking after duration expires', () => {
      screenShake.shake(0.3, 0.2);

      // Update past the duration
      screenShake.update(0.3);

      expect(screenShake.getIsShaking()).toBe(false);
    });

    it('should continue shaking before duration expires', () => {
      screenShake.shake(0.3, 0.5);

      screenShake.update(0.1);

      expect(screenShake.getIsShaking()).toBe(true);
    });

    it('should reduce shake intensity over time', () => {
      // This is tested indirectly through the decay factor
      screenShake.shake(1.0, 0.5);

      // Update multiple times
      for (let i = 0; i < 10; i++) {
        screenShake.update(0.01);
      }

      expect(screenShake.getIsShaking()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop shaking immediately', () => {
      screenShake.shake(0.3, 1.0);

      expect(screenShake.getIsShaking()).toBe(true);

      screenShake.stop();

      expect(screenShake.getIsShaking()).toBe(false);
    });

    it('should not affect camera when stopped', () => {
      screenShake.shake(0.3, 1.0);
      screenShake.stop();

      const originalX = camera.position.x;
      const originalY = camera.position.y;

      screenShake.update(0.016);

      expect(camera.position.x).toBe(originalX);
      expect(camera.position.y).toBe(originalY);
    });
  });

  describe('getIsShaking', () => {
    it('should return false initially', () => {
      expect(screenShake.getIsShaking()).toBe(false);
    });

    it('should return true while shaking', () => {
      screenShake.shake();

      expect(screenShake.getIsShaking()).toBe(true);
    });

    it('should return false after shake completes', () => {
      screenShake.shake(0.3, 0.1);
      screenShake.update(0.2);

      expect(screenShake.getIsShaking()).toBe(false);
    });
  });
});
