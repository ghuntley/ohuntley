/**
 * Tests for Power-up Entity and Effect Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PowerUp,
  PowerUpType,
  PowerUpState,
  PowerUpEffectManager,
  POWER_UP_VISUALS,
} from './PowerUp';
import {
  SPEED_BOOST_MULTIPLIER,
  SPEED_BOOST_DURATION,
  INVISIBILITY_DURATION,
  FREEZE_DURATION,
} from '../utils/Constants';

describe('PowerUp', () => {
  let powerUp: PowerUp;

  beforeEach(() => {
    powerUp = new PowerUp(PowerUpType.SPEED_BOOST);
  });

  describe('initialization', () => {
    it('should initialize with correct type', () => {
      expect(powerUp.getType()).toBe(PowerUpType.SPEED_BOOST);
    });

    it('should initialize with AVAILABLE state', () => {
      expect(powerUp.getState()).toBe(PowerUpState.AVAILABLE);
      expect(powerUp.isAvailable()).toBe(true);
    });

    it('should have unique IDs', () => {
      const powerUp1 = new PowerUp(PowerUpType.SHIELD);
      const powerUp2 = new PowerUp(PowerUpType.SHIELD);
      expect(powerUp1.getId()).not.toBe(powerUp2.getId());
    });

    it('should return correct visual config', () => {
      const visual = powerUp.getVisual();
      expect(visual).toEqual(POWER_UP_VISUALS[PowerUpType.SPEED_BOOST]);
    });
  });

  describe('collection', () => {
    it('should be collectable when available', () => {
      expect(powerUp.collect()).toBe(true);
      expect(powerUp.getState()).toBe(PowerUpState.COLLECTED);
      expect(powerUp.isAvailable()).toBe(false);
    });

    it('should not be collectable twice', () => {
      powerUp.collect();
      expect(powerUp.collect()).toBe(false);
    });

    it('should detect player within collection range', () => {
      powerUp.setPosition({ x: 10, y: 0, z: 10 });
      const playerPos = { x: 10.3, y: 0, z: 10 };
      const playerRadius = 0.4;

      expect(powerUp.checkCollection(playerPos, playerRadius)).toBe(true);
    });

    it('should not detect player outside collection range', () => {
      powerUp.setPosition({ x: 10, y: 0, z: 10 });
      const playerPos = { x: 20, y: 0, z: 20 };
      const playerRadius = 0.4;

      expect(powerUp.checkCollection(playerPos, playerRadius)).toBe(false);
    });
  });

  describe('animation', () => {
    it('should update rotation over time', () => {
      const initialRotation = powerUp.getRotation();
      powerUp.update(1);
      expect(powerUp.getRotation()).toBeGreaterThan(initialRotation);
    });

    it('should not update when collected', () => {
      powerUp.collect();
      const rotation = powerUp.getRotation();
      powerUp.update(1);
      expect(powerUp.getRotation()).toBe(rotation);
    });
  });

  describe('reset', () => {
    it('should reset to available state', () => {
      powerUp.collect();
      powerUp.reset({ x: 5, y: 0, z: 5 });

      expect(powerUp.isAvailable()).toBe(true);
      expect(powerUp.getPosition()).toEqual({ x: 5, y: 0, z: 5 });
    });
  });

  describe('all power-up types', () => {
    it('should create all power-up types', () => {
      const types = [
        PowerUpType.SPEED_BOOST,
        PowerUpType.SPRINT_REFILL,
        PowerUpType.INVISIBILITY,
        PowerUpType.SHIELD,
        PowerUpType.FREEZE,
      ];

      types.forEach((type) => {
        const pu = new PowerUp(type);
        expect(pu.getType()).toBe(type);
        expect(pu.getVisual()).toBeDefined();
      });
    });
  });
});

describe('PowerUpEffectManager', () => {
  let manager: PowerUpEffectManager;

  beforeEach(() => {
    manager = new PowerUpEffectManager();
  });

  describe('initialization', () => {
    it('should start with no active effects', () => {
      expect(manager.getActiveEffects()).toHaveLength(0);
      expect(manager.getHasShield()).toBe(false);
      expect(manager.getIsInvisible()).toBe(false);
      expect(manager.getSpeedMultiplier()).toBe(1);
    });
  });

  describe('speed boost', () => {
    it('should apply speed boost multiplier', () => {
      manager.applyEffect(PowerUpType.SPEED_BOOST);

      expect(manager.getSpeedMultiplier()).toBe(SPEED_BOOST_MULTIPLIER);
      expect(manager.hasActiveEffect(PowerUpType.SPEED_BOOST)).toBe(true);
    });

    it('should remove speed boost after duration', () => {
      manager.applyEffect(PowerUpType.SPEED_BOOST);

      // Update past duration
      manager.update(SPEED_BOOST_DURATION + 0.1);

      expect(manager.getSpeedMultiplier()).toBe(1);
      expect(manager.hasActiveEffect(PowerUpType.SPEED_BOOST)).toBe(false);
    });

    it('should track remaining time', () => {
      manager.applyEffect(PowerUpType.SPEED_BOOST);

      manager.update(2);

      const remaining = manager.getEffectRemainingTime(PowerUpType.SPEED_BOOST);
      expect(remaining).toBeCloseTo(SPEED_BOOST_DURATION - 2, 1);
    });
  });

  describe('sprint refill', () => {
    it('should call sprint refill callback', () => {
      const callback = vi.fn();
      manager.setOnRefillSprint(callback);

      manager.applyEffect(PowerUpType.SPRINT_REFILL);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('invisibility', () => {
    it('should set invisible state', () => {
      manager.applyEffect(PowerUpType.INVISIBILITY);

      expect(manager.getIsInvisible()).toBe(true);
    });

    it('should remove invisibility after duration', () => {
      manager.applyEffect(PowerUpType.INVISIBILITY);

      manager.update(INVISIBILITY_DURATION + 0.1);

      expect(manager.getIsInvisible()).toBe(false);
    });
  });

  describe('shield', () => {
    it('should set shield state', () => {
      manager.applyEffect(PowerUpType.SHIELD);

      expect(manager.getHasShield()).toBe(true);
      expect(manager.hasActiveEffect(PowerUpType.SHIELD)).toBe(true);
    });

    it('should consume shield on use', () => {
      manager.applyEffect(PowerUpType.SHIELD);

      const used = manager.useShield();

      expect(used).toBe(true);
      expect(manager.getHasShield()).toBe(false);
    });

    it('should not consume shield if not present', () => {
      const used = manager.useShield();

      expect(used).toBe(false);
    });

    it('should persist until used (no timer)', () => {
      manager.applyEffect(PowerUpType.SHIELD);

      // Update for a long time
      manager.update(1000);

      expect(manager.getHasShield()).toBe(true);
    });
  });

  describe('freeze', () => {
    it('should call freeze zombies callback', () => {
      const callback = vi.fn();
      manager.setOnFreezeZombies(callback);

      manager.applyEffect(PowerUpType.FREEZE);

      expect(callback).toHaveBeenCalledWith(FREEZE_DURATION);
    });
  });

  describe('effect progress', () => {
    it('should return correct progress', () => {
      manager.applyEffect(PowerUpType.SPEED_BOOST);

      // At start, progress should be 1 (full)
      expect(manager.getEffectProgress(PowerUpType.SPEED_BOOST)).toBeCloseTo(1, 1);

      // After half duration, progress should be ~0.5
      manager.update(SPEED_BOOST_DURATION / 2);
      expect(manager.getEffectProgress(PowerUpType.SPEED_BOOST)).toBeCloseTo(0.5, 1);
    });

    it('should return 0 for inactive effects', () => {
      expect(manager.getEffectProgress(PowerUpType.SPEED_BOOST)).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all effects', () => {
      manager.applyEffect(PowerUpType.SPEED_BOOST);
      manager.applyEffect(PowerUpType.SHIELD);
      manager.applyEffect(PowerUpType.INVISIBILITY);

      manager.reset();

      expect(manager.getActiveEffects()).toHaveLength(0);
      expect(manager.getHasShield()).toBe(false);
      expect(manager.getIsInvisible()).toBe(false);
      expect(manager.getSpeedMultiplier()).toBe(1);
    });
  });

  describe('multiple effects', () => {
    it('should handle multiple simultaneous effects', () => {
      manager.applyEffect(PowerUpType.SPEED_BOOST);
      manager.applyEffect(PowerUpType.INVISIBILITY);
      manager.applyEffect(PowerUpType.SHIELD);

      expect(manager.getSpeedMultiplier()).toBe(SPEED_BOOST_MULTIPLIER);
      expect(manager.getIsInvisible()).toBe(true);
      expect(manager.getHasShield()).toBe(true);
    });

    it('should expire effects independently', () => {
      manager.applyEffect(PowerUpType.SPEED_BOOST); // 8 seconds
      manager.applyEffect(PowerUpType.INVISIBILITY); // 5 seconds

      // After 6 seconds, invisibility should be gone, speed boost should remain
      manager.update(6);

      expect(manager.getIsInvisible()).toBe(false);
      expect(manager.getSpeedMultiplier()).toBe(SPEED_BOOST_MULTIPLIER);
    });
  });
});
