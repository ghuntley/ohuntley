import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ZombieModel, ZombieVisualState } from './ZombieModel';

describe('ZombieModel', () => {
  let model: ZombieModel;

  beforeEach(() => {
    model = new ZombieModel();
  });

  describe('construction', () => {
    it('should create a model with default settings', () => {
      expect(model).toBeDefined();
      const group = model.getGroup();
      expect(group).toBeInstanceOf(THREE.Group);
    });

    it('should create a model with multiple child objects', () => {
      const group = model.getGroup();
      let objectCount = 0;
      group.traverse(() => {
        objectCount++;
      });
      // Should have body parts and lights
      expect(objectCount).toBeGreaterThan(15);
    });

    it('should respect custom body color', () => {
      const customModel = new ZombieModel({ bodyColor: 0x00ff00 });
      const group = customModel.getGroup();

      let foundColor = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.color && material.color.getHex() === 0x00ff00) {
            foundColor = true;
          }
        }
      });
      expect(foundColor).toBe(true);
      customModel.dispose();
    });

    it('should respect custom eye glow color', () => {
      const customModel = new ZombieModel({ eyeGlowColor: 0x00ffff });
      const group = customModel.getGroup();

      let foundGlowColor = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.emissive && material.emissive.getHex() === 0x00ffff) {
            foundGlowColor = true;
          }
        }
      });
      expect(foundGlowColor).toBe(true);
      customModel.dispose();
    });

    it('should respect custom scale', () => {
      const scaledModel = new ZombieModel({ scale: 1.5 });
      const group = scaledModel.getGroup();
      expect(group.scale.x).toBe(1.5);
      expect(group.scale.y).toBe(1.5);
      expect(group.scale.z).toBe(1.5);
      scaledModel.dispose();
    });
  });

  describe('getGroup', () => {
    it('should return a THREE.Group', () => {
      const group = model.getGroup();
      expect(group).toBeInstanceOf(THREE.Group);
    });

    it('should return the same group on multiple calls', () => {
      const group1 = model.getGroup();
      const group2 = model.getGroup();
      expect(group1).toBe(group2);
    });
  });

  describe('glowing eyes', () => {
    it('should have named eye objects', () => {
      const group = model.getGroup();
      const leftEye = group.getObjectByName('leftEye');
      const rightEye = group.getObjectByName('rightEye');
      expect(leftEye).toBeDefined();
      expect(rightEye).toBeDefined();
    });

    it('should have point lights for eye glow', () => {
      const group = model.getGroup();
      const leftLight = group.getObjectByName('leftEyeLight');
      const rightLight = group.getObjectByName('rightEyeLight');
      expect(leftLight).toBeInstanceOf(THREE.PointLight);
      expect(rightLight).toBeInstanceOf(THREE.PointLight);
    });

    it('should have emissive eye materials', () => {
      const group = model.getGroup();
      const leftEye = group.getObjectByName('leftEye') as THREE.Mesh;
      const material = leftEye.material as THREE.MeshStandardMaterial;
      expect(material.emissiveIntensity).toBeGreaterThan(0);
    });
  });

  describe('setVisualState', () => {
    it('should change appearance for CHASING state', () => {
      const group = model.getGroup();
      const leftLight = group.getObjectByName('leftEyeLight') as THREE.PointLight;
      const initialIntensity = leftLight.intensity;

      model.setVisualState(ZombieVisualState.CHASING);

      // Should increase eye light intensity when chasing
      expect(leftLight.intensity).toBeGreaterThan(initialIntensity);
    });

    it('should change appearance for FROZEN state', () => {
      const group = model.getGroup();
      const leftLight = group.getObjectByName('leftEyeLight') as THREE.PointLight;

      model.setVisualState(ZombieVisualState.FROZEN);

      // Should change eye light to blue when frozen
      expect(leftLight.color.getHex()).toBe(0x88ccff);
    });

    it('should reset appearance for NORMAL state', () => {
      // First change to chasing
      model.setVisualState(ZombieVisualState.CHASING);

      // Then reset to normal
      model.setVisualState(ZombieVisualState.NORMAL);

      const group = model.getGroup();
      const leftLight = group.getObjectByName('leftEyeLight') as THREE.PointLight;

      // Default eye glow color is 0xff3300
      expect(leftLight.color.getHex()).toBe(0xff3300);
      expect(leftLight.intensity).toBe(0.3);
    });

    it('should transition between all states', () => {
      // Should not throw when transitioning between states
      expect(() => {
        model.setVisualState(ZombieVisualState.NORMAL);
        model.setVisualState(ZombieVisualState.CHASING);
        model.setVisualState(ZombieVisualState.FROZEN);
        model.setVisualState(ZombieVisualState.NORMAL);
      }).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should dispose without errors', () => {
      expect(() => model.dispose()).not.toThrow();
    });
  });

  describe('model structure', () => {
    it('should have a head named component', () => {
      const group = model.getGroup();
      const head = group.getObjectByName('head');
      expect(head).toBeDefined();
    });

    it('should include claws (zombie characteristic)', () => {
      const group = model.getGroup();
      let coneCount = 0;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry instanceof THREE.ConeGeometry) {
            coneCount++;
          }
        }
      });
      // Should have multiple claws (cones) and tail
      expect(coneCount).toBeGreaterThan(3);
    });
  });

  describe('visual differences from regular meerkat', () => {
    it('should use greenish body color by default', () => {
      const group = model.getGroup();
      let foundGreenColor = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.color && material.color.getHex() === 0x4a5d4a) {
            foundGreenColor = true;
          }
        }
      });
      expect(foundGreenColor).toBe(true);
    });

    it('should have body emissive for undead glow', () => {
      const group = model.getGroup();
      let hasBodyEmissive = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (
            material.color &&
            material.color.getHex() === 0x4a5d4a &&
            material.emissiveIntensity > 0
          ) {
            hasBodyEmissive = true;
          }
        }
      });
      expect(hasBodyEmissive).toBe(true);
    });
  });
});
