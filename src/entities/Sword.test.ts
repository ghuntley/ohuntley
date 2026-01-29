/**
 * Tests for Sword Entity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Sword, SwordState } from './Sword';

describe('Sword', () => {
  let sword: Sword;

  beforeEach(() => {
    sword = new Sword();
  });

  describe('initialization', () => {
    it('should initialize with AVAILABLE state', () => {
      expect(sword.getState()).toBe(SwordState.AVAILABLE);
      expect(sword.isAvailable()).toBe(true);
    });

    it('should have unique IDs', () => {
      const sword1 = new Sword();
      const sword2 = new Sword();
      expect(sword1.getId()).not.toBe(sword2.getId());
    });

    it('should start at origin', () => {
      const pos = sword.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      expect(pos.z).toBe(0);
    });
  });

  describe('collection', () => {
    it('should be collectable when available', () => {
      expect(sword.collect()).toBe(true);
      expect(sword.getState()).toBe(SwordState.COLLECTED);
      expect(sword.isAvailable()).toBe(false);
    });

    it('should not be collectable twice', () => {
      sword.collect();
      expect(sword.collect()).toBe(false);
    });

    it('should detect player within collection range', () => {
      sword.setPosition({ x: 10, y: 0, z: 10 });
      const playerPos = { x: 10.5, y: 0, z: 10 };
      const playerRadius = 0.4;

      expect(sword.checkCollection(playerPos, playerRadius)).toBe(true);
    });

    it('should not detect player outside collection range', () => {
      sword.setPosition({ x: 10, y: 0, z: 10 });
      const playerPos = { x: 20, y: 0, z: 20 };
      const playerRadius = 0.4;

      expect(sword.checkCollection(playerPos, playerRadius)).toBe(false);
    });

    it('should not detect collection when already collected', () => {
      sword.setPosition({ x: 10, y: 0, z: 10 });
      sword.collect();

      const playerPos = { x: 10, y: 0, z: 10 };
      expect(sword.checkCollection(playerPos, 0.4)).toBe(false);
    });
  });

  describe('animation', () => {
    it('should update rotation over time', () => {
      const initialRotation = sword.getRotation();
      sword.update(1);
      expect(sword.getRotation()).toBeGreaterThan(initialRotation);
    });

    it('should not update when collected', () => {
      sword.collect();
      const rotation = sword.getRotation();
      sword.update(1);
      expect(sword.getRotation()).toBe(rotation);
    });

    it('should have display position offset for bobbing', () => {
      sword.setPosition({ x: 5, y: 0, z: 5 });
      const displayPos = sword.getDisplayPosition();

      expect(displayPos.x).toBe(5);
      expect(displayPos.z).toBe(5);
      expect(displayPos.y).toBeGreaterThan(0); // Should be elevated
    });
  });

  describe('reset', () => {
    it('should reset to available state', () => {
      sword.collect();
      sword.reset({ x: 5, y: 0, z: 5 });

      expect(sword.isAvailable()).toBe(true);
      expect(sword.getPosition()).toEqual({ x: 5, y: 0, z: 5 });
    });

    it('should reset to origin if no position provided', () => {
      sword.setPosition({ x: 10, y: 0, z: 10 });
      sword.reset();

      expect(sword.getPosition()).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('getters and setters', () => {
    it('should get and set position correctly', () => {
      const newPos = { x: 15, y: 0, z: 20 };
      sword.setPosition(newPos);

      const pos = sword.getPosition();
      expect(pos.x).toBe(15);
      expect(pos.z).toBe(20);

      // Should return a copy
      pos.x = 999;
      expect(sword.getPosition().x).toBe(15);
    });

    it('should return collision radius', () => {
      expect(sword.getCollisionRadius()).toBeGreaterThan(0);
    });
  });
});
