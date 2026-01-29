import { describe, it, expect } from 'vitest';
import * as Constants from './Constants';

describe('Constants', () => {
  describe('World & Maze Constants', () => {
    it('should have valid cell size', () => {
      expect(Constants.CELL_SIZE).toBe(4);
      expect(Constants.CELL_SIZE).toBeGreaterThan(0);
    });

    it('should have valid wall dimensions', () => {
      expect(Constants.WALL_THICKNESS).toBe(0.5);
      expect(Constants.WALL_HEIGHT).toBe(9);
      expect(Constants.WALL_HEIGHT).toBeGreaterThan(0);
    });

    it('should have corridor width less than cell size', () => {
      expect(Constants.CORRIDOR_WIDTH).toBe(3.5);
      expect(Constants.CORRIDOR_WIDTH).toBeLessThan(Constants.CELL_SIZE);
    });
  });

  describe('Player Constants', () => {
    it('should have valid walking speed', () => {
      expect(Constants.PLAYER_WALK_SPEED).toBe(5);
      expect(Constants.PLAYER_WALK_SPEED).toBeGreaterThan(0);
    });

    it('should have sprint faster than walk', () => {
      const sprintSpeed = Constants.PLAYER_WALK_SPEED * Constants.PLAYER_SPRINT_MULTIPLIER;
      expect(sprintSpeed).toBeGreaterThan(Constants.PLAYER_WALK_SPEED);
      expect(Constants.PLAYER_SPRINT_MULTIPLIER).toBe(2);
    });

    it('should have valid sprint gauge values', () => {
      expect(Constants.SPRINT_GAUGE_CAPACITY).toBe(5);
      expect(Constants.SPRINT_REGEN_TIME).toBe(2);
      expect(Constants.SPRINT_GAUGE_CAPACITY).toBeGreaterThan(0);
      expect(Constants.SPRINT_REGEN_TIME).toBeGreaterThan(0);
    });

    it('should have valid collision dimensions', () => {
      expect(Constants.PLAYER_COLLISION_RADIUS).toBe(0.4);
      expect(Constants.PLAYER_HEIGHT).toBe(1.8);
      expect(Constants.PLAYER_COLLISION_RADIUS).toBeGreaterThan(0);
      expect(Constants.PLAYER_HEIGHT).toBeGreaterThan(0);
    });
  });

  describe('Zombie Constants', () => {
    it('should have patrol speed slower than player walk', () => {
      expect(Constants.ZOMBIE_PATROL_SPEED).toBe(2);
      expect(Constants.ZOMBIE_PATROL_SPEED).toBeLessThan(Constants.PLAYER_WALK_SPEED);
    });

    it('should have chase speed faster than player walk but slower than sprint', () => {
      const playerSprintSpeed = Constants.PLAYER_WALK_SPEED * Constants.PLAYER_SPRINT_MULTIPLIER;
      expect(Constants.ZOMBIE_CHASE_SPEED).toBe(7);
      expect(Constants.ZOMBIE_CHASE_SPEED).toBeGreaterThan(Constants.PLAYER_WALK_SPEED);
      expect(Constants.ZOMBIE_CHASE_SPEED).toBeLessThan(playerSprintSpeed);
    });

    it('should have valid detection radius', () => {
      expect(Constants.ZOMBIE_DETECTION_RADIUS).toBe(8);
      expect(Constants.ZOMBIE_DETECTION_RADIUS).toBeGreaterThan(0);
    });
  });

  describe('Camera Constants', () => {
    it('should have valid camera angle', () => {
      expect(Constants.CAMERA_ANGLE).toBe(50);
      expect(Constants.CAMERA_ANGLE).toBeGreaterThan(0);
      expect(Constants.CAMERA_ANGLE).toBeLessThan(90);
    });

    it('should have valid camera distance and height', () => {
      expect(Constants.CAMERA_DISTANCE).toBe(15);
      expect(Constants.CAMERA_HEIGHT_OFFSET).toBe(12);
      expect(Constants.CAMERA_DISTANCE).toBeGreaterThan(0);
      expect(Constants.CAMERA_HEIGHT_OFFSET).toBeGreaterThan(0);
    });

    it('should have valid FOV', () => {
      expect(Constants.CAMERA_FOV).toBe(60);
      expect(Constants.CAMERA_FOV).toBeGreaterThan(30);
      expect(Constants.CAMERA_FOV).toBeLessThan(120);
    });

    it('should have valid follow speed', () => {
      expect(Constants.CAMERA_FOLLOW_SPEED).toBe(6);
      expect(Constants.CAMERA_FOLLOW_SPEED).toBeGreaterThan(0);
    });
  });

  describe('Combat Constants', () => {
    it('should have valid attack cooldown', () => {
      expect(Constants.ATTACK_COOLDOWN).toBe(0.5);
      expect(Constants.ATTACK_COOLDOWN).toBeGreaterThan(0);
    });

    it('should have valid sword range and arc', () => {
      expect(Constants.SWORD_RANGE).toBe(2);
      expect(Constants.SWORD_ARC).toBe(90);
      expect(Constants.SWORD_RANGE).toBeGreaterThan(0);
      expect(Constants.SWORD_ARC).toBeGreaterThan(0);
      expect(Constants.SWORD_ARC).toBeLessThanOrEqual(180);
    });
  });

  describe('Power-up Constants', () => {
    it('should have speed boost multiplier greater than 1', () => {
      expect(Constants.SPEED_BOOST_MULTIPLIER).toBe(1.5);
      expect(Constants.SPEED_BOOST_MULTIPLIER).toBeGreaterThan(1);
    });

    it('should have valid power-up durations', () => {
      expect(Constants.SPEED_BOOST_DURATION).toBe(8);
      expect(Constants.INVISIBILITY_DURATION).toBe(5);
      expect(Constants.FREEZE_DURATION).toBe(4);
      expect(Constants.SPEED_BOOST_DURATION).toBeGreaterThan(0);
      expect(Constants.INVISIBILITY_DURATION).toBeGreaterThan(0);
      expect(Constants.FREEZE_DURATION).toBeGreaterThan(0);
    });
  });

  describe('Level Configuration', () => {
    it('should have increasing maze sizes', () => {
      expect(Constants.MAZE_SIZES.SMALL).toBe(10);
      expect(Constants.MAZE_SIZES.MEDIUM).toBe(15);
      expect(Constants.MAZE_SIZES.LARGE).toBe(20);
      expect(Constants.MAZE_SIZES.SMALL).toBeLessThan(Constants.MAZE_SIZES.MEDIUM);
      expect(Constants.MAZE_SIZES.MEDIUM).toBeLessThan(Constants.MAZE_SIZES.LARGE);
    });

    it('should have increasing zombie counts', () => {
      expect(Constants.ZOMBIE_COUNTS.EASY.min).toBeLessThanOrEqual(Constants.ZOMBIE_COUNTS.EASY.max);
      expect(Constants.ZOMBIE_COUNTS.MEDIUM.min).toBeLessThanOrEqual(Constants.ZOMBIE_COUNTS.MEDIUM.max);
      expect(Constants.ZOMBIE_COUNTS.HARD.min).toBeLessThanOrEqual(Constants.ZOMBIE_COUNTS.HARD.max);
      expect(Constants.ZOMBIE_COUNTS.ENDLESS.min).toBeLessThanOrEqual(Constants.ZOMBIE_COUNTS.ENDLESS.max);

      // Difficulty progression
      expect(Constants.ZOMBIE_COUNTS.EASY.max).toBeLessThanOrEqual(Constants.ZOMBIE_COUNTS.MEDIUM.min);
      expect(Constants.ZOMBIE_COUNTS.MEDIUM.max).toBeLessThanOrEqual(Constants.ZOMBIE_COUNTS.HARD.min);
    });

    it('should have increasing time limits', () => {
      expect(Constants.TIME_LIMITS.EASY).toBe(60);
      expect(Constants.TIME_LIMITS.MEDIUM).toBe(90);
      expect(Constants.TIME_LIMITS.HARD).toBe(120);
      expect(Constants.TIME_LIMITS.MIN).toBe(90);
      expect(Constants.TIME_LIMITS.EASY).toBeLessThan(Constants.TIME_LIMITS.MEDIUM);
      expect(Constants.TIME_LIMITS.MEDIUM).toBeLessThan(Constants.TIME_LIMITS.HARD);
    });

    it('should have decreasing sword spawn chances', () => {
      expect(Constants.SWORD_SPAWN_CHANCE.EASY).toBe(1.0);
      expect(Constants.SWORD_SPAWN_CHANCE.MEDIUM).toBe(0.8);
      expect(Constants.SWORD_SPAWN_CHANCE.HARD).toBe(0.6);
      expect(Constants.SWORD_SPAWN_CHANCE.ENDLESS).toBe(0.4);

      expect(Constants.SWORD_SPAWN_CHANCE.EASY).toBeGreaterThan(Constants.SWORD_SPAWN_CHANCE.MEDIUM);
      expect(Constants.SWORD_SPAWN_CHANCE.MEDIUM).toBeGreaterThan(Constants.SWORD_SPAWN_CHANCE.HARD);
      expect(Constants.SWORD_SPAWN_CHANCE.HARD).toBeGreaterThan(Constants.SWORD_SPAWN_CHANCE.ENDLESS);
    });

    it('should have valid spawn probabilities (0-1)', () => {
      expect(Constants.SWORD_SPAWN_CHANCE.EASY).toBeGreaterThanOrEqual(0);
      expect(Constants.SWORD_SPAWN_CHANCE.EASY).toBeLessThanOrEqual(1);
      expect(Constants.SWORD_SPAWN_CHANCE.ENDLESS).toBeGreaterThanOrEqual(0);
      expect(Constants.SWORD_SPAWN_CHANCE.ENDLESS).toBeLessThanOrEqual(1);
    });
  });

  describe('Rendering Constants', () => {
    it('should have valid target FPS', () => {
      expect(Constants.TARGET_FPS).toBe(60);
      expect(Constants.TARGET_FPS).toBeGreaterThan(0);
    });

    it('should have valid max delta time', () => {
      expect(Constants.MAX_DELTA_TIME).toBe(1 / 30);
      expect(Constants.MAX_DELTA_TIME).toBeGreaterThan(0);
      expect(Constants.MAX_DELTA_TIME).toBeLessThan(1);
    });

    it('should have valid fog visibility radius', () => {
      expect(Constants.FOG_VISIBILITY_RADIUS).toBe(4);
      expect(Constants.FOG_VISIBILITY_RADIUS).toBeGreaterThan(0);
    });
  });

  describe('UI Constants', () => {
    it('should have valid touch target size', () => {
      expect(Constants.MIN_TOUCH_TARGET).toBe(44);
      expect(Constants.MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44); // Accessibility standard
    });

    it('should have valid joystick configuration', () => {
      expect(Constants.JOYSTICK_RADIUS).toBe(100);
      expect(Constants.JOYSTICK_DEADZONE).toBe(0.1);
      expect(Constants.JOYSTICK_RADIUS).toBeGreaterThan(0);
      expect(Constants.JOYSTICK_DEADZONE).toBeGreaterThan(0);
      expect(Constants.JOYSTICK_DEADZONE).toBeLessThan(1);
    });
  });

  describe('Audio Constants', () => {
    it('should have valid crossfade duration', () => {
      expect(Constants.MUSIC_CROSSFADE_DURATION).toBe(2);
      expect(Constants.MUSIC_CROSSFADE_DURATION).toBeGreaterThan(0);
    });

    it('should have valid default volumes', () => {
      expect(Constants.DEFAULT_MUSIC_VOLUME).toBe(0.5);
      expect(Constants.DEFAULT_SFX_VOLUME).toBe(0.7);
      expect(Constants.DEFAULT_MUSIC_VOLUME).toBeGreaterThanOrEqual(0);
      expect(Constants.DEFAULT_MUSIC_VOLUME).toBeLessThanOrEqual(1);
      expect(Constants.DEFAULT_SFX_VOLUME).toBeGreaterThanOrEqual(0);
      expect(Constants.DEFAULT_SFX_VOLUME).toBeLessThanOrEqual(1);
    });
  });
});
