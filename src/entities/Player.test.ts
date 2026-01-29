import { describe, it, expect, beforeEach } from 'vitest';
import { Player, PlayerState, Position } from './Player';
import {
  PLAYER_WALK_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
  SPRINT_GAUGE_CAPACITY,
} from '../utils/Constants';

describe('Player', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(player.getPosition()).toEqual({ x: 0, y: 0, z: 0 });
      expect(player.getRotation()).toBe(0);
      expect(player.getState()).toBe(PlayerState.IDLE);
      expect(player.getSprintGauge()).toBe(SPRINT_GAUGE_CAPACITY);
      expect(player.isAlive()).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customPlayer = new Player({
        walkSpeed: 10,
        sprintMultiplier: 3,
        sprintCapacity: 10,
      });

      expect(customPlayer.getSprintCapacity()).toBe(10);
    });

    it('should not have sword or shield initially', () => {
      expect(player.getHasSword()).toBe(false);
      expect(player.getHasShield()).toBe(false);
    });
  });

  describe('movement', () => {
    it('should move forward when given positive y input', () => {
      player.update(1, { x: 0, y: 1 }, false);

      const pos = player.getPosition();
      expect(pos.z).toBe(PLAYER_WALK_SPEED);
    });

    it('should move backward when given negative y input', () => {
      player.update(1, { x: 0, y: -1 }, false);

      const pos = player.getPosition();
      expect(pos.z).toBe(-PLAYER_WALK_SPEED);
    });

    it('should move right when given positive x input', () => {
      player.update(1, { x: 1, y: 0 }, false);

      const pos = player.getPosition();
      expect(pos.x).toBe(PLAYER_WALK_SPEED);
    });

    it('should move left when given negative x input', () => {
      player.update(1, { x: -1, y: 0 }, false);

      const pos = player.getPosition();
      expect(pos.x).toBe(-PLAYER_WALK_SPEED);
    });

    it('should handle diagonal movement', () => {
      player.update(1, { x: 1, y: 1 }, false);

      const pos = player.getPosition();
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.z).toBeGreaterThan(0);
    });

    it('should not move when input is zero', () => {
      player.update(1, { x: 0, y: 0 }, false);

      expect(player.getPosition()).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should scale movement by delta time', () => {
      player.update(0.5, { x: 0, y: 1 }, false);

      const pos = player.getPosition();
      expect(pos.z).toBe(PLAYER_WALK_SPEED * 0.5);
    });

    it('should update rotation to face movement direction', () => {
      player.update(1, { x: 1, y: 0 }, false);
      expect(player.getRotation()).toBeCloseTo(Math.PI / 2);

      player.update(1, { x: 0, y: 1 }, false);
      expect(player.getRotation()).toBeCloseTo(0);
    });
  });

  describe('sprint', () => {
    it('should move faster when sprinting', () => {
      const normalPlayer = new Player();
      const sprintPlayer = new Player();

      normalPlayer.update(1, { x: 0, y: 1 }, false);
      sprintPlayer.update(1, { x: 0, y: 1 }, true);

      const normalPos = normalPlayer.getPosition();
      const sprintPos = sprintPlayer.getPosition();

      expect(sprintPos.z).toBe(normalPos.z * PLAYER_SPRINT_MULTIPLIER);
    });

    it('should deplete sprint gauge while sprinting', () => {
      player.update(1, { x: 0, y: 1 }, true);

      expect(player.getSprintGauge()).toBeLessThan(SPRINT_GAUGE_CAPACITY);
    });

    it('should regenerate sprint gauge when not sprinting', () => {
      // Deplete some sprint
      player.update(2, { x: 0, y: 1 }, true);
      const depletedGauge = player.getSprintGauge();

      // Stop sprinting and wait
      player.update(1, { x: 0, y: 0 }, false);

      expect(player.getSprintGauge()).toBeGreaterThan(depletedGauge);
    });

    it('should not sprint when gauge is empty', () => {
      // Deplete gauge completely
      for (let i = 0; i < 10; i++) {
        player.update(1, { x: 0, y: 1 }, true);
      }

      expect(player.getSprintGauge()).toBe(0);
      expect(player.isSprintActive()).toBe(false);
    });

    it('should not sprint when not moving', () => {
      player.update(1, { x: 0, y: 0 }, true);

      expect(player.isSprintActive()).toBe(false);
      expect(player.getSprintGauge()).toBe(SPRINT_GAUGE_CAPACITY); // No depletion
    });

    it('should return sprint gauge as percentage', () => {
      expect(player.getSprintGaugePercent()).toBe(1);

      player.update(SPRINT_GAUGE_CAPACITY / 2, { x: 0, y: 1 }, true);

      expect(player.getSprintGaugePercent()).toBeCloseTo(0.5);
    });
  });

  describe('state', () => {
    it('should be IDLE when not moving', () => {
      player.update(1, { x: 0, y: 0 }, false);

      expect(player.getState()).toBe(PlayerState.IDLE);
    });

    it('should be WALKING when moving without sprint', () => {
      player.update(1, { x: 0, y: 1 }, false);

      expect(player.getState()).toBe(PlayerState.WALKING);
    });

    it('should be SPRINTING when moving with sprint', () => {
      player.update(1, { x: 0, y: 1 }, true);

      expect(player.getState()).toBe(PlayerState.SPRINTING);
    });

    it('should be DEAD after die() is called', () => {
      player.die();

      expect(player.getState()).toBe(PlayerState.DEAD);
      expect(player.isAlive()).toBe(false);
    });

    it('should not update when dead', () => {
      player.die();
      player.update(1, { x: 0, y: 1 }, false);

      expect(player.getPosition()).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('combat', () => {
    it('should not attack without sword', () => {
      const result = player.attack();

      expect(result).toBe(false);
    });

    it('should attack with sword', () => {
      player.pickupSword();
      const result = player.attack();

      expect(result).toBe(true);
      expect(player.getState()).toBe(PlayerState.ATTACKING);
    });

    it('should not attack during cooldown', () => {
      player.pickupSword();
      player.attack();

      // Try to attack immediately
      const result = player.attack();

      expect(result).toBe(false);
    });

    it('should attack after cooldown expires', () => {
      player.pickupSword();
      player.attack();

      // Wait for cooldown
      player.update(1, { x: 0, y: 0 }, false);

      const result = player.attack();
      expect(result).toBe(true);
    });

    it('should not attack when dead', () => {
      player.pickupSword();
      player.die();

      const result = player.attack();
      expect(result).toBe(false);
    });
  });

  describe('items', () => {
    it('should pickup sword', () => {
      player.pickupSword();
      expect(player.getHasSword()).toBe(true);
    });

    it('should pickup shield', () => {
      player.pickupShield();
      expect(player.getHasShield()).toBe(true);
    });

    it('should use shield only once', () => {
      player.pickupShield();

      expect(player.useShield()).toBe(true);
      expect(player.getHasShield()).toBe(false);
      expect(player.useShield()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      // Modify player state
      player.update(1, { x: 1, y: 1 }, true);
      player.pickupSword();
      player.pickupShield();
      player.die();

      // Reset
      player.reset();

      expect(player.getPosition()).toEqual({ x: 0, y: 0, z: 0 });
      expect(player.getState()).toBe(PlayerState.IDLE);
      expect(player.getSprintGauge()).toBe(SPRINT_GAUGE_CAPACITY);
      expect(player.getHasSword()).toBe(false);
      expect(player.getHasShield()).toBe(false);
      expect(player.isAlive()).toBe(true);
    });

    it('should accept custom start position', () => {
      const startPos: Position = { x: 10, y: 0, z: 10 };
      player.reset(startPos);

      expect(player.getPosition()).toEqual(startPos);
    });
  });

  describe('collision', () => {
    it('should check collision with point', () => {
      player.setPosition({ x: 0, y: 0, z: 0 });

      // Point inside radius
      expect(player.checkCollision({ x: 0.2, y: 0, z: 0 })).toBe(true);

      // Point outside radius
      expect(player.checkCollision({ x: 10, y: 0, z: 0 })).toBe(false);
    });

    it('should return correct bounding box', () => {
      player.setPosition({ x: 5, y: 0, z: 5 });

      const box = player.getBoundingBox();
      const radius = player.getCollisionRadius();

      expect(box.minX).toBe(5 - radius);
      expect(box.maxX).toBe(5 + radius);
      expect(box.minZ).toBe(5 - radius);
      expect(box.maxZ).toBe(5 + radius);
    });
  });

  describe('position and rotation', () => {
    it('should set position', () => {
      player.setPosition({ x: 10, y: 5, z: 15 });

      expect(player.getPosition()).toEqual({ x: 10, y: 5, z: 15 });
    });

    it('should set rotation', () => {
      player.setRotation(Math.PI);

      expect(player.getRotation()).toBe(Math.PI);
    });

    it('should return copy of position (not reference)', () => {
      const pos1 = player.getPosition();
      pos1.x = 999;

      const pos2 = player.getPosition();
      expect(pos2.x).toBe(0);
    });
  });

  describe('velocity', () => {
    it('should return current velocity', () => {
      player.update(1, { x: 1, y: 0 }, false);

      const velocity = player.getVelocity();
      expect(velocity.x).toBe(PLAYER_WALK_SPEED);
    });

    it('should return current speed', () => {
      player.update(1, { x: 1, y: 0 }, false);

      const speed = player.getCurrentSpeed();
      expect(speed).toBe(PLAYER_WALK_SPEED);
    });

    it('should return zero velocity when stopped', () => {
      player.update(1, { x: 0, y: 0 }, false);

      expect(player.getCurrentSpeed()).toBe(0);
    });
  });
});
