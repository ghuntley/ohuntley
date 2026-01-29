/**
 * Tests for FollowCamera
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from './FollowCamera';
import {
  CAMERA_ANGLE,
  CAMERA_DISTANCE,
  CAMERA_HEIGHT_OFFSET,
  CAMERA_FOV,
  CAMERA_FOLLOW_SPEED,
} from '../utils/Constants';

describe('FollowCamera', () => {
  let followCamera: FollowCamera;

  beforeEach(() => {
    followCamera = new FollowCamera();
  });

  describe('constructor', () => {
    it('should create a perspective camera', () => {
      const camera = followCamera.getCamera();

      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    });

    it('should use default constants', () => {
      const params = followCamera.getParameters();

      expect(params.angle).toBeCloseTo(CAMERA_ANGLE);
      expect(params.distance).toBe(CAMERA_DISTANCE);
      expect(params.heightOffset).toBe(CAMERA_HEIGHT_OFFSET);
      expect(params.fov).toBe(CAMERA_FOV);
      expect(params.followSpeed).toBe(CAMERA_FOLLOW_SPEED);
    });

    it('should accept custom configuration', () => {
      const customCamera = new FollowCamera({
        angle: 60,
        distance: 20,
        heightOffset: 15,
        fov: 75,
        followSpeed: 10,
      });

      const params = customCamera.getParameters();

      expect(params.angle).toBeCloseTo(60);
      expect(params.distance).toBe(20);
      expect(params.heightOffset).toBe(15);
      expect(params.fov).toBe(75);
      expect(params.followSpeed).toBe(10);
    });
  });

  describe('update', () => {
    it('should move camera toward player position', () => {
      const initialPosition = followCamera.getPosition().clone();

      followCamera.update(0.1, { x: 10, y: 0, z: 10 });

      const newPosition = followCamera.getPosition();

      // Camera should have moved (not necessarily to exact position due to lerp)
      expect(newPosition.x).not.toBe(initialPosition.x);
      expect(newPosition.z).not.toBe(initialPosition.z);
    });

    it('should maintain height above player', () => {
      followCamera.update(1, { x: 5, y: 0, z: 5 });

      const position = followCamera.getPosition();

      // Camera should be above player
      expect(position.y).toBeGreaterThan(0);
    });

    it('should smoothly interpolate position', () => {
      // Snap to initial position
      followCamera.snapToTarget({ x: 0, y: 0, z: 0 });

      // Small update
      followCamera.update(0.016, { x: 100, y: 0, z: 100 });
      const pos1 = followCamera.getPosition().clone();

      // Camera should not immediately reach target
      expect(pos1.x).toBeLessThan(100);
      expect(pos1.z).toBeLessThan(100 + CAMERA_DISTANCE);
    });

    it('should converge to target over time', () => {
      const target = { x: 10, y: 0, z: 10 };

      // Multiple updates to converge
      for (let i = 0; i < 100; i++) {
        followCamera.update(0.1, target);
      }

      const position = followCamera.getPosition();
      const params = followCamera.getParameters();
      const angleRad = (params.angle! * Math.PI) / 180;
      const expectedZ = target.z + params.distance! * Math.cos(angleRad);

      // Should be close to expected position
      expect(position.x).toBeCloseTo(target.x, 1);
      expect(position.z).toBeCloseTo(expectedZ, 1);
    });
  });

  describe('snapToTarget', () => {
    it('should immediately position camera', () => {
      followCamera.snapToTarget({ x: 20, y: 0, z: 20 });

      const position = followCamera.getPosition();

      // Camera should be at calculated position relative to player
      expect(position.x).toBeCloseTo(20); // Same X as player
    });

    it('should not require update after snap', () => {
      followCamera.snapToTarget({ x: 15, y: 0, z: 15 });
      const posAfterSnap = followCamera.getPosition().clone();

      // Small update with same position should not change much
      followCamera.update(0.001, { x: 15, y: 0, z: 15 });
      const posAfterUpdate = followCamera.getPosition();

      expect(posAfterUpdate.distanceTo(posAfterSnap)).toBeLessThan(0.1);
    });
  });

  describe('handleResize', () => {
    it('should update camera aspect ratio', () => {
      const camera = followCamera.getCamera();
      const initialAspect = camera.aspect;

      followCamera.handleResize(1920, 1080);

      expect(camera.aspect).toBeCloseTo(1920 / 1080);
      expect(camera.aspect).not.toBe(initialAspect);
    });

    it('should update projection matrix', () => {
      const camera = followCamera.getCamera();
      const spy = vi.spyOn(camera, 'updateProjectionMatrix');

      followCamera.handleResize(800, 600);

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('setParameters', () => {
    it('should update individual parameters', () => {
      followCamera.setParameters({ angle: 70 });

      expect(followCamera.getParameters().angle).toBe(70);
    });

    it('should update fov and projection matrix', () => {
      const camera = followCamera.getCamera();
      const spy = vi.spyOn(camera, 'updateProjectionMatrix');

      followCamera.setParameters({ fov: 90 });

      expect(camera.fov).toBe(90);
      expect(spy).toHaveBeenCalled();
    });

    it('should allow multiple parameter updates', () => {
      followCamera.setParameters({
        distance: 25,
        heightOffset: 20,
        followSpeed: 8,
      });

      const params = followCamera.getParameters();

      expect(params.distance).toBe(25);
      expect(params.heightOffset).toBe(20);
      expect(params.followSpeed).toBe(8);
    });
  });

  describe('getCamera', () => {
    it('should return the internal camera', () => {
      const camera = followCamera.getCamera();

      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    });
  });

  describe('getPosition', () => {
    it('should return camera world position', () => {
      const position = followCamera.getPosition();

      expect(position).toBeInstanceOf(THREE.Vector3);
    });

    it('should return a clone (not reference)', () => {
      const pos1 = followCamera.getPosition();
      const pos2 = followCamera.getPosition();

      pos1.x = 999;

      expect(pos2.x).not.toBe(999);
    });
  });

  describe('visibility checks', () => {
    describe('isPointVisible', () => {
      it('should return true for point in view', () => {
        followCamera.snapToTarget({ x: 0, y: 0, z: 0 });

        const visible = followCamera.isPointVisible(new THREE.Vector3(0, 0, 0));

        expect(visible).toBe(true);
      });

      it('should return false for point behind camera', () => {
        followCamera.snapToTarget({ x: 0, y: 0, z: 0 });
        const cameraPos = followCamera.getPosition();

        // Point far behind camera
        const behindCamera = new THREE.Vector3(
          cameraPos.x,
          cameraPos.y,
          cameraPos.z + 100
        );

        const visible = followCamera.isPointVisible(behindCamera);

        expect(visible).toBe(false);
      });
    });

    describe('isSphereVisible', () => {
      it('should return true for sphere in view', () => {
        followCamera.snapToTarget({ x: 0, y: 0, z: 0 });

        const visible = followCamera.isSphereVisible(
          new THREE.Vector3(0, 0, 0),
          1
        );

        expect(visible).toBe(true);
      });
    });

    describe('getFrustum', () => {
      it('should return a frustum object', () => {
        const frustum = followCamera.getFrustum();

        expect(frustum).toBeInstanceOf(THREE.Frustum);
      });
    });
  });

  describe('fixed orientation', () => {
    it('should maintain same X position as player (no lateral offset)', () => {
      followCamera.snapToTarget({ x: 50, y: 0, z: 30 });

      const position = followCamera.getPosition();

      expect(position.x).toBeCloseTo(50);
    });

    it('should be positioned behind player (positive Z offset)', () => {
      followCamera.snapToTarget({ x: 0, y: 0, z: 0 });

      const position = followCamera.getPosition();

      // Camera should be at positive Z (behind player looking north)
      expect(position.z).toBeGreaterThan(0);
    });
  });
});
