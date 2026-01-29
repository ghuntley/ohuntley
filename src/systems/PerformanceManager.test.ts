/**
 * Tests for Performance Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { PerformanceManager, PerformanceTier } from './PerformanceManager';

describe('PerformanceManager', () => {
  beforeEach(() => {
    // Reset singleton before each test
    PerformanceManager.resetInstance();
  });

  afterEach(() => {
    PerformanceManager.resetInstance();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PerformanceManager.getInstance();
      const instance2 = PerformanceManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = PerformanceManager.getInstance();
      PerformanceManager.resetInstance();
      const instance2 = PerformanceManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('mobile detection', () => {
    it('should detect device type', () => {
      const manager = PerformanceManager.getInstance();

      // getIsMobile returns a boolean
      expect(typeof manager.getIsMobile()).toBe('boolean');
    });
  });

  describe('performance tier', () => {
    it('should return a valid performance tier', () => {
      const manager = PerformanceManager.getInstance();
      const tier = manager.getTier();

      expect([PerformanceTier.LOW, PerformanceTier.MEDIUM, PerformanceTier.HIGH]).toContain(tier);
    });

    it('should allow setting tier manually', () => {
      const manager = PerformanceManager.getInstance();

      manager.setTier(PerformanceTier.LOW);
      expect(manager.getTier()).toBe(PerformanceTier.LOW);

      manager.setTier(PerformanceTier.HIGH);
      expect(manager.getTier()).toBe(PerformanceTier.HIGH);
    });
  });

  describe('settings', () => {
    it('should return performance settings object', () => {
      const manager = PerformanceManager.getInstance();
      const settings = manager.getSettings();

      expect(settings).toHaveProperty('shadowMapSize');
      expect(settings).toHaveProperty('shadowsEnabled');
      expect(settings).toHaveProperty('fogNear');
      expect(settings).toHaveProperty('fogFar');
      expect(settings).toHaveProperty('pixelRatio');
      expect(settings).toHaveProperty('particleMultiplier');
      expect(settings).toHaveProperty('antialias');
      expect(settings).toHaveProperty('maxLights');
    });

    it('should have valid shadow map size', () => {
      const manager = PerformanceManager.getInstance();
      const settings = manager.getSettings();

      expect(settings.shadowMapSize).toBeGreaterThan(0);
      expect([512, 1024, 2048]).toContain(settings.shadowMapSize);
    });

    it('should have valid pixel ratio', () => {
      const manager = PerformanceManager.getInstance();
      const settings = manager.getSettings();

      expect(settings.pixelRatio).toBeGreaterThan(0);
      expect(settings.pixelRatio).toBeLessThanOrEqual(window.devicePixelRatio);
    });

    it('should have valid particle multiplier', () => {
      const manager = PerformanceManager.getInstance();
      const settings = manager.getSettings();

      expect(settings.particleMultiplier).toBeGreaterThan(0);
      expect(settings.particleMultiplier).toBeLessThanOrEqual(1);
    });

    it('should update settings when tier changes', () => {
      const manager = PerformanceManager.getInstance();

      manager.setTier(PerformanceTier.HIGH);
      const highSettings = manager.getSettings();

      manager.setTier(PerformanceTier.LOW);
      const lowSettings = manager.getSettings();

      expect(highSettings.shadowMapSize).toBeGreaterThan(lowSettings.shadowMapSize);
      expect(highSettings.particleMultiplier).toBeGreaterThan(lowSettings.particleMultiplier);
    });
  });

  describe('getParticleMultiplier', () => {
    it('should return particle multiplier for current tier', () => {
      const manager = PerformanceManager.getInstance();
      const multiplier = manager.getParticleMultiplier();

      expect(multiplier).toBeGreaterThan(0);
      expect(multiplier).toBeLessThanOrEqual(1);
    });

    it('should return lower multiplier for lower tiers', () => {
      const manager = PerformanceManager.getInstance();

      manager.setTier(PerformanceTier.HIGH);
      const highMultiplier = manager.getParticleMultiplier();

      manager.setTier(PerformanceTier.LOW);
      const lowMultiplier = manager.getParticleMultiplier();

      expect(highMultiplier).toBeGreaterThan(lowMultiplier);
    });
  });

  describe('applyToRenderer', () => {
    it('should apply settings to renderer', () => {
      const manager = PerformanceManager.getInstance();

      // Create a mock renderer
      const mockRenderer = {
        setPixelRatio: vi.fn(),
        shadowMap: {
          enabled: false,
          type: THREE.PCFSoftShadowMap,
        },
      } as unknown as THREE.WebGLRenderer;

      // Should not throw
      expect(() => manager.applyToRenderer(mockRenderer)).not.toThrow();

      // Verify setPixelRatio was called
      expect(mockRenderer.setPixelRatio).toHaveBeenCalled();
    });

    it('should set pixel ratio on renderer', () => {
      const manager = PerformanceManager.getInstance();

      const mockRenderer = {
        setPixelRatio: vi.fn(),
        shadowMap: {
          enabled: false,
          type: THREE.PCFSoftShadowMap,
        },
      } as unknown as THREE.WebGLRenderer;

      manager.applyToRenderer(mockRenderer);

      const settings = manager.getSettings();
      expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(settings.pixelRatio);
    });
  });

  describe('applyToScene', () => {
    it('should apply fog settings to scene', () => {
      const manager = PerformanceManager.getInstance();
      const scene = new THREE.Scene();

      manager.applyToScene(scene);

      expect(scene.fog).toBeInstanceOf(THREE.Fog);
    });

    it('should set correct fog distances', () => {
      const manager = PerformanceManager.getInstance();
      const scene = new THREE.Scene();

      manager.applyToScene(scene);

      const settings = manager.getSettings();
      const fog = scene.fog as THREE.Fog;

      expect(fog.near).toBe(settings.fogNear);
      expect(fog.far).toBe(settings.fogFar);
    });

    it('should update existing fog', () => {
      const manager = PerformanceManager.getInstance();
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x000000, 1, 10);

      manager.applyToScene(scene);

      const settings = manager.getSettings();
      const fog = scene.fog as THREE.Fog;

      expect(fog.near).toBe(settings.fogNear);
      expect(fog.far).toBe(settings.fogFar);
    });
  });

  describe('applyToLight', () => {
    it('should apply shadow settings to directional light', () => {
      const manager = PerformanceManager.getInstance();
      const light = new THREE.DirectionalLight();

      manager.applyToLight(light);

      const settings = manager.getSettings();

      expect(light.castShadow).toBe(settings.shadowsEnabled);
    });

    it('should set shadow map size for high tier', () => {
      const manager = PerformanceManager.getInstance();
      manager.setTier(PerformanceTier.HIGH);

      const light = new THREE.DirectionalLight();
      manager.applyToLight(light);

      const settings = manager.getSettings();

      expect(light.shadow.mapSize.width).toBe(settings.shadowMapSize);
      expect(light.shadow.mapSize.height).toBe(settings.shadowMapSize);
    });
  });

  describe('FPS tracking', () => {
    it('should track frames', () => {
      const manager = PerformanceManager.getInstance();

      // Should not throw
      expect(() => manager.trackFrame()).not.toThrow();
    });

    it('should return FPS value', () => {
      const manager = PerformanceManager.getInstance();

      const fps = manager.getFps();

      expect(typeof fps).toBe('number');
      expect(fps).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRendererOptions', () => {
    it('should return renderer options', () => {
      const manager = PerformanceManager.getInstance();
      const options = manager.getRendererOptions();

      expect(options).toHaveProperty('antialias');
      expect(options).toHaveProperty('powerPreference');
      expect(options).toHaveProperty('alpha');
      expect(options).toHaveProperty('stencil');
      expect(options).toHaveProperty('depth');
    });

    it('should return valid power preference', () => {
      const manager = PerformanceManager.getInstance();
      const options = manager.getRendererOptions();

      expect(['low-power', 'high-performance', 'default']).toContain(options.powerPreference);
    });
  });
});
