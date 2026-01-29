/**
 * Tests for Fog of War System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FogOfWarSystem, FogOfWarConfig } from './FogOfWarSystem';
import { FOG_VISIBILITY_RADIUS, CELL_SIZE } from '../utils/Constants';

describe('FogOfWarSystem', () => {
  let fogSystem: FogOfWarSystem;

  beforeEach(() => {
    fogSystem = new FogOfWarSystem();
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const expectedRadius = FOG_VISIBILITY_RADIUS * CELL_SIZE;
      expect(fogSystem.getVisibilityRadius()).toBe(expectedRadius);
      expect(fogSystem.isEnabled()).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<FogOfWarConfig> = {
        visibilityRadius: 20,
        fadeDistance: 5,
        minVisibility: 0.1,
      };
      const customFog = new FogOfWarSystem(customConfig);

      expect(customFog.getVisibilityRadius()).toBe(20);
    });
  });

  describe('createFogMaterial', () => {
    it('should create a shader material from standard material', () => {
      const baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x228b22,
        roughness: 0.9,
        metalness: 0.0,
      });

      const fogMaterial = fogSystem.createFogMaterial(baseMaterial, 'test-material');

      expect(fogMaterial).toBeInstanceOf(THREE.ShaderMaterial);
      expect(fogMaterial.uniforms).toBeDefined();
      expect(fogMaterial.uniforms.playerPosition).toBeDefined();
      expect(fogMaterial.uniforms.visibilityRadius).toBeDefined();
    });

    it('should store material for retrieval', () => {
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const fogMaterial = fogSystem.createFogMaterial(baseMaterial, 'stored-material');

      const retrieved = fogSystem.getMaterial('stored-material');
      expect(retrieved).toBe(fogMaterial);
    });

    it('should preserve base material color in uniforms', () => {
      const color = 0x228b22;
      const baseMaterial = new THREE.MeshStandardMaterial({ color });
      const fogMaterial = fogSystem.createFogMaterial(baseMaterial, 'color-test');

      const baseColor = fogMaterial.uniforms.baseColor.value;
      expect(baseColor.getHex()).toBe(color);
    });
  });

  describe('updatePlayerPosition', () => {
    it('should update player position in all materials', () => {
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const fogMaterial = fogSystem.createFogMaterial(baseMaterial, 'position-test');

      const newPosition = { x: 10, y: 0, z: 15 };
      fogSystem.updatePlayerPosition(newPosition);

      const materialPosition = fogMaterial.uniforms.playerPosition.value;
      expect(materialPosition.x).toBe(10);
      expect(materialPosition.y).toBe(0);
      expect(materialPosition.z).toBe(15);
    });

    it('should update position in multiple materials', () => {
      const material1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const material2 = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

      const fogMat1 = fogSystem.createFogMaterial(material1, 'mat1');
      const fogMat2 = fogSystem.createFogMaterial(material2, 'mat2');

      const position = { x: 5, y: 1, z: 8 };
      fogSystem.updatePlayerPosition(position);

      expect(fogMat1.uniforms.playerPosition.value.x).toBe(5);
      expect(fogMat2.uniforms.playerPosition.value.x).toBe(5);
    });
  });

  describe('setVisibilityRadius', () => {
    it('should update visibility radius in all materials', () => {
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const fogMaterial = fogSystem.createFogMaterial(baseMaterial, 'radius-test');

      fogSystem.setVisibilityRadius(30);

      expect(fogSystem.getVisibilityRadius()).toBe(30);
      expect(fogMaterial.uniforms.visibilityRadius.value).toBe(30);
    });
  });

  describe('setEnabled', () => {
    it('should enable fog of war by default', () => {
      expect(fogSystem.isEnabled()).toBe(true);
    });

    it('should disable fog of war and set large visibility radius', () => {
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const fogMaterial = fogSystem.createFogMaterial(baseMaterial, 'enable-test');

      fogSystem.setEnabled(false);

      expect(fogSystem.isEnabled()).toBe(false);
      // When disabled, visibility radius should be very large (10000)
      expect(fogMaterial.uniforms.visibilityRadius.value).toBe(10000);
    });

    it('should restore configured visibility when re-enabled', () => {
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const fogMaterial = fogSystem.createFogMaterial(baseMaterial, 'reenable-test');

      const originalRadius = fogSystem.getVisibilityRadius();

      fogSystem.setEnabled(false);
      fogSystem.setEnabled(true);

      expect(fogSystem.isEnabled()).toBe(true);
      expect(fogMaterial.uniforms.visibilityRadius.value).toBe(originalRadius);
    });
  });

  describe('isPositionVisible', () => {
    it('should return true for positions within visibility radius', () => {
      fogSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });

      // Position well within default radius
      expect(fogSystem.isPositionVisible({ x: 5, z: 5 })).toBe(true);
    });

    it('should return false for positions outside visibility radius', () => {
      fogSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      fogSystem.setVisibilityRadius(10);

      // Position outside radius
      expect(fogSystem.isPositionVisible({ x: 100, z: 100 })).toBe(false);
    });

    it('should always return true when disabled', () => {
      fogSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      fogSystem.setVisibilityRadius(10);
      fogSystem.setEnabled(false);

      // Even far positions should be visible when disabled
      expect(fogSystem.isPositionVisible({ x: 100, z: 100 })).toBe(true);
    });
  });

  describe('getVisibilityFactor', () => {
    it('should return 1 for positions well within radius', () => {
      fogSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      fogSystem.setVisibilityRadius(20);
      fogSystem.updateConfig({ fadeDistance: 5 });

      // Position well inside inner radius (20 - 5 = 15)
      expect(fogSystem.getVisibilityFactor({ x: 5, z: 5 })).toBe(1);
    });

    it('should return minVisibility for positions outside radius', () => {
      fogSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      fogSystem.setVisibilityRadius(10);
      fogSystem.updateConfig({ minVisibility: 0.05 });

      // Position well outside radius
      const factor = fogSystem.getVisibilityFactor({ x: 100, z: 100 });
      expect(factor).toBe(0.05);
    });

    it('should return interpolated value in fade zone', () => {
      fogSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      fogSystem.setVisibilityRadius(20);
      fogSystem.updateConfig({ fadeDistance: 10, minVisibility: 0 });

      // Position in middle of fade zone (inner radius = 10)
      // At distance ~15, should be roughly 0.5
      const factor = fogSystem.getVisibilityFactor({ x: 15, z: 0 });
      expect(factor).toBeGreaterThan(0);
      expect(factor).toBeLessThan(1);
    });

    it('should return 1 when disabled', () => {
      fogSystem.updatePlayerPosition({ x: 0, y: 0, z: 0 });
      fogSystem.setVisibilityRadius(10);
      fogSystem.setEnabled(false);

      expect(fogSystem.getVisibilityFactor({ x: 100, z: 100 })).toBe(1);
    });
  });

  describe('updateConfig', () => {
    it('should update visibility radius', () => {
      fogSystem.updateConfig({ visibilityRadius: 25 });
      expect(fogSystem.getVisibilityRadius()).toBe(25);
    });

    it('should update material uniforms', () => {
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const fogMaterial = fogSystem.createFogMaterial(baseMaterial, 'config-test');

      fogSystem.updateConfig({
        visibilityRadius: 30,
        fadeDistance: 8,
        minVisibility: 0.1,
      });

      expect(fogMaterial.uniforms.visibilityRadius.value).toBe(30);
      expect(fogMaterial.uniforms.fadeDistance.value).toBe(8);
      expect(fogMaterial.uniforms.minVisibility.value).toBe(0.1);
    });
  });

  describe('dispose', () => {
    it('should dispose all materials', () => {
      const mat1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const mat2 = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

      fogSystem.createFogMaterial(mat1, 'dispose1');
      fogSystem.createFogMaterial(mat2, 'dispose2');

      fogSystem.dispose();

      expect(fogSystem.getMaterial('dispose1')).toBeUndefined();
      expect(fogSystem.getMaterial('dispose2')).toBeUndefined();
    });
  });
});
