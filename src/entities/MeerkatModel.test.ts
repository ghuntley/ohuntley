import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  MeerkatModel,
  createPlayerMeerkatModel,
  createZombieMeerkatModel,
} from './MeerkatModel';

describe('MeerkatModel', () => {
  let model: MeerkatModel;

  beforeEach(() => {
    model = new MeerkatModel();
  });

  describe('construction', () => {
    it('should create a model with default settings', () => {
      expect(model).toBeDefined();
      const group = model.getGroup();
      expect(group).toBeInstanceOf(THREE.Group);
    });

    it('should create a model with multiple child meshes', () => {
      const group = model.getGroup();
      let meshCount = 0;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshCount++;
        }
      });
      // Should have body parts: body, belly, head, snout, nose, 2 eyes, 2 highlights,
      // 2 eye patches, 2 arms, 2 paws, 2 legs, 2 feet, tail, tail tip, 2 ears, 2 inner ears
      expect(meshCount).toBeGreaterThan(15);
    });

    it('should respect custom body color', () => {
      const customModel = new MeerkatModel({ bodyColor: 0xff0000 });
      const group = customModel.getGroup();

      // Find the main body mesh
      let foundExpectedColor = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.color && material.color.getHex() === 0xff0000) {
            foundExpectedColor = true;
          }
        }
      });
      expect(foundExpectedColor).toBe(true);
      customModel.dispose();
    });

    it('should respect custom scale', () => {
      const scaledModel = new MeerkatModel({ scale: 2 });
      const group = scaledModel.getGroup();
      expect(group.scale.x).toBe(2);
      expect(group.scale.y).toBe(2);
      expect(group.scale.z).toBe(2);
      scaledModel.dispose();
    });

    it('should respect shadow settings', () => {
      const noShadowModel = new MeerkatModel({
        castShadow: false,
        receiveShadow: true,
      });
      const group = noShadowModel.getGroup();

      let foundCastShadowFalse = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && !child.castShadow) {
          foundCastShadowFalse = true;
        }
      });
      expect(foundCastShadowFalse).toBe(true);
      noShadowModel.dispose();
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

  describe('setBodyColor', () => {
    it('should change the body material color', () => {
      model.setBodyColor(0x00ff00);

      const group = model.getGroup();
      let foundNewColor = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.color && material.color.getHex() === 0x00ff00) {
            foundNewColor = true;
          }
        }
      });
      expect(foundNewColor).toBe(true);
    });
  });

  describe('setEmissive', () => {
    it('should set emissive properties on materials', () => {
      model.setEmissive(0x00ffff, 0.5);

      const group = model.getGroup();
      let foundEmissive = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.emissiveIntensity === 0.5) {
            foundEmissive = true;
          }
        }
      });
      expect(foundEmissive).toBe(true);
    });
  });

  describe('setOpacity', () => {
    it('should set opacity on all materials', () => {
      model.setOpacity(0.5);

      const group = model.getGroup();
      let foundOpacity = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.opacity === 0.5 && material.transparent) {
            foundOpacity = true;
          }
        }
      });
      expect(foundOpacity).toBe(true);
    });

    it('should set transparent to false when opacity is 1', () => {
      model.setOpacity(0.5);
      model.setOpacity(1);

      const group = model.getGroup();
      let foundNonTransparent = false;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.opacity === 1 && !material.transparent) {
            foundNonTransparent = true;
          }
        }
      });
      expect(foundNonTransparent).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should dispose without errors', () => {
      expect(() => model.dispose()).not.toThrow();
    });
  });

  describe('factory functions', () => {
    describe('createPlayerMeerkatModel', () => {
      it('should create a player model with brown color', () => {
        const playerModel = createPlayerMeerkatModel();
        const group = playerModel.getGroup();

        let foundBrownColor = false;
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = child.material as THREE.MeshStandardMaterial;
            if (material.color && material.color.getHex() === 0xd2691e) {
              foundBrownColor = true;
            }
          }
        });
        expect(foundBrownColor).toBe(true);
        playerModel.dispose();
      });

      it('should accept additional config options', () => {
        const playerModel = createPlayerMeerkatModel({ scale: 1.5 });
        const group = playerModel.getGroup();
        expect(group.scale.x).toBe(1.5);
        playerModel.dispose();
      });
    });

    describe('createZombieMeerkatModel', () => {
      it('should create a zombie model with greenish color', () => {
        const zombieModel = createZombieMeerkatModel();
        const group = zombieModel.getGroup();

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
        zombieModel.dispose();
      });

      it('should accept additional config options', () => {
        const zombieModel = createZombieMeerkatModel({ scale: 0.9 });
        const group = zombieModel.getGroup();
        expect(group.scale.x).toBe(0.9);
        zombieModel.dispose();
      });
    });
  });

  describe('model structure', () => {
    it('should have a head named component', () => {
      const group = model.getGroup();
      const head = group.getObjectByName('head');
      expect(head).toBeDefined();
    });

    it('should position model at ground level', () => {
      const group = model.getGroup();
      // The group itself starts at 0, body parts are positioned relative
      expect(group.position.y).toBe(0);
    });
  });
});
