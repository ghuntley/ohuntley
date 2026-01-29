/**
 * Tests for Particle System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { ParticleSystem, ParticleEffectType } from './ParticleSystem';

describe('ParticleSystem', () => {
  let scene: THREE.Scene;
  let particleSystem: ParticleSystem;

  beforeEach(() => {
    scene = new THREE.Scene();
    particleSystem = new ParticleSystem(scene);
  });

  afterEach(() => {
    particleSystem.dispose();
  });

  describe('initialization', () => {
    it('should initialize with no active effects', () => {
      expect(particleSystem.getActiveEffectCount()).toBe(0);
      expect(particleSystem.getActiveParticleCount()).toBe(0);
    });

    it('should accept mobile mode option', () => {
      const mobileSystem = new ParticleSystem(scene, { isMobile: true });
      expect(mobileSystem.getActiveEffectCount()).toBe(0);
      mobileSystem.dispose();
    });

    it('should accept maxPoolSize option', () => {
      const customSystem = new ParticleSystem(scene, { maxPoolSize: 5 });
      expect(customSystem.getActiveEffectCount()).toBe(0);
      customSystem.dispose();
    });
  });

  describe('emit', () => {
    it('should emit sword trail particles', () => {
      const position = new THREE.Vector3(5, 1, 5);

      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, position);

      expect(particleSystem.getActiveEffectCount()).toBe(1);
      expect(particleSystem.getActiveParticleCount()).toBeGreaterThan(0);
    });

    it('should emit zombie hit particles', () => {
      const position = new THREE.Vector3(10, 1, 10);

      particleSystem.emit(ParticleEffectType.ZOMBIE_HIT, position);

      expect(particleSystem.getActiveEffectCount()).toBe(1);
      expect(particleSystem.getActiveParticleCount()).toBeGreaterThan(0);
    });

    it('should emit power-up collect particles', () => {
      const position = new THREE.Vector3(0, 1, 0);

      particleSystem.emit(ParticleEffectType.POWERUP_COLLECT, position);

      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should emit shield break particles', () => {
      const position = new THREE.Vector3(3, 1, 3);

      particleSystem.emit(ParticleEffectType.SHIELD_BREAK, position);

      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should emit footstep dust particles', () => {
      const position = new THREE.Vector3(1, 0, 1);

      particleSystem.emit(ParticleEffectType.FOOTSTEP_DUST, position);

      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should emit multiple effects simultaneously', () => {
      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(0, 0, 0));
      particleSystem.emit(ParticleEffectType.ZOMBIE_HIT, new THREE.Vector3(5, 0, 5));
      particleSystem.emit(ParticleEffectType.POWERUP_COLLECT, new THREE.Vector3(10, 0, 10));

      expect(particleSystem.getActiveEffectCount()).toBe(3);
    });

    it('should accept custom color option', () => {
      const position = new THREE.Vector3(0, 0, 0);

      particleSystem.emit(ParticleEffectType.POWERUP_COLLECT, position, {
        color: 0xff0000,
      });

      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should accept direction option for directional effects', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(1, 0, 0);

      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, position, {
        direction,
      });

      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should accept scale option', () => {
      const position = new THREE.Vector3(0, 0, 0);

      particleSystem.emit(ParticleEffectType.ZOMBIE_HIT, position, {
        scale: 2.0,
      });

      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should add mesh to scene when emitting', () => {
      const initialChildren = scene.children.length;

      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(0, 0, 0));

      expect(scene.children.length).toBe(initialChildren + 1);
    });
  });

  describe('update', () => {
    it('should update active effects', () => {
      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(0, 0, 0));

      // Update with small delta
      particleSystem.update(0.016);

      // Particles should still be active
      expect(particleSystem.getActiveParticleCount()).toBeGreaterThan(0);
    });

    it('should remove effects after lifetime expires', () => {
      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(0, 0, 0));

      expect(particleSystem.getActiveEffectCount()).toBe(1);

      // Update with long delta to expire all particles
      particleSystem.update(2.0);

      expect(particleSystem.getActiveEffectCount()).toBe(0);
    });

    it('should remove mesh from scene when effect expires', () => {
      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(0, 0, 0));

      const childrenAfterEmit = scene.children.length;

      // Expire the effect
      particleSystem.update(2.0);

      expect(scene.children.length).toBeLessThan(childrenAfterEmit);
    });

    it('should handle update when no effects are active', () => {
      // Should not throw
      expect(() => particleSystem.update(0.016)).not.toThrow();
    });

    it('should decrease particle count over time', () => {
      particleSystem.emit(ParticleEffectType.ZOMBIE_HIT, new THREE.Vector3(0, 0, 0));

      const initialCount = particleSystem.getActiveParticleCount();

      // Update several times
      for (let i = 0; i < 10; i++) {
        particleSystem.update(0.1);
      }

      expect(particleSystem.getActiveParticleCount()).toBeLessThan(initialCount);
    });
  });

  describe('setMobileMode', () => {
    it('should set mobile mode', () => {
      particleSystem.setMobileMode(true);

      // Emit particles in mobile mode
      particleSystem.emit(ParticleEffectType.ZOMBIE_HIT, new THREE.Vector3(0, 0, 0));

      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should emit fewer particles in mobile mode', () => {
      // Desktop mode
      const desktopSystem = new ParticleSystem(scene, { isMobile: false });
      desktopSystem.emit(ParticleEffectType.ZOMBIE_HIT, new THREE.Vector3(0, 0, 0));
      const desktopCount = desktopSystem.getActiveParticleCount();

      // Mobile mode
      const mobileSystem = new ParticleSystem(scene, { isMobile: true });
      mobileSystem.emit(ParticleEffectType.ZOMBIE_HIT, new THREE.Vector3(5, 0, 5));
      const mobileCount = mobileSystem.getActiveParticleCount();

      expect(mobileCount).toBeLessThan(desktopCount);

      desktopSystem.dispose();
      mobileSystem.dispose();
    });
  });

  describe('clear', () => {
    it('should clear all active effects', () => {
      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(0, 0, 0));
      particleSystem.emit(ParticleEffectType.ZOMBIE_HIT, new THREE.Vector3(5, 0, 5));

      expect(particleSystem.getActiveEffectCount()).toBe(2);

      particleSystem.clear();

      expect(particleSystem.getActiveEffectCount()).toBe(0);
      expect(particleSystem.getActiveParticleCount()).toBe(0);
    });

    it('should remove all meshes from scene', () => {
      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(0, 0, 0));
      particleSystem.emit(ParticleEffectType.ZOMBIE_HIT, new THREE.Vector3(5, 0, 5));

      const childrenAfterEmit = scene.children.length;

      particleSystem.clear();

      expect(scene.children.length).toBeLessThan(childrenAfterEmit);
    });
  });

  describe('dispose', () => {
    it('should dispose all resources', () => {
      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(0, 0, 0));

      expect(() => particleSystem.dispose()).not.toThrow();

      expect(particleSystem.getActiveEffectCount()).toBe(0);
    });

    it('should clear all effects on dispose', () => {
      particleSystem.emit(ParticleEffectType.ZOMBIE_HIT, new THREE.Vector3(0, 0, 0));
      particleSystem.emit(ParticleEffectType.POWERUP_COLLECT, new THREE.Vector3(5, 0, 5));

      particleSystem.dispose();

      expect(particleSystem.getActiveEffectCount()).toBe(0);
    });
  });

  describe('particle pooling', () => {
    it('should reuse pooled effects', () => {
      // Emit and let expire
      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(0, 0, 0));
      particleSystem.update(2.0); // Expire

      // Emit again - should reuse from pool
      particleSystem.emit(ParticleEffectType.SWORD_TRAIL, new THREE.Vector3(5, 0, 5));

      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });
  });
});
