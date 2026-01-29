/**
 * Game constants for Meerkat Maze Runner
 * Centralized configuration for game parameters
 */

// ============================================
// World & Maze Constants
// ============================================

/** Size of each maze cell in world units */
export const CELL_SIZE = 4;

/** Thickness of maze walls in world units */
export const WALL_THICKNESS = 0.5;

/** Height of maze walls in world units (3x player height) */
export const WALL_HEIGHT = 9;

/** Width of corridors in world units */
export const CORRIDOR_WIDTH = 3.5;

// ============================================
// Player Constants
// ============================================

/** Base walking speed in units per second */
export const PLAYER_WALK_SPEED = 5;

/** Sprint speed multiplier */
export const PLAYER_SPRINT_MULTIPLIER = 2;

/** Sprint gauge capacity in seconds */
export const SPRINT_GAUGE_CAPACITY = 5;

/** Sprint gauge regeneration rate (seconds to full) */
export const SPRINT_REGEN_TIME = 2;

/** Player collision capsule radius */
export const PLAYER_COLLISION_RADIUS = 0.4;

/** Player height for collision */
export const PLAYER_HEIGHT = 1.8;

// ============================================
// Zombie Constants
// ============================================

/** Zombie patrol speed in units per second */
export const ZOMBIE_PATROL_SPEED = 2;

/** Zombie chase speed in units per second */
export const ZOMBIE_CHASE_SPEED = 7;

/** Zombie detection radius in world units */
export const ZOMBIE_DETECTION_RADIUS = 8;

/** Zombie difficulty scaling by level tier */
export const ZOMBIE_DIFFICULTY = {
  EASY: {
    patrolSpeedMultiplier: 0.8,
    chaseSpeedMultiplier: 0.85,
    detectionRadiusMultiplier: 0.7,
  },
  MEDIUM: {
    patrolSpeedMultiplier: 1.0,
    chaseSpeedMultiplier: 1.0,
    detectionRadiusMultiplier: 1.0,
  },
  HARD: {
    patrolSpeedMultiplier: 1.15,
    chaseSpeedMultiplier: 1.2,
    detectionRadiusMultiplier: 1.3,
  },
  ENDLESS: {
    patrolSpeedMultiplier: 1.25,
    chaseSpeedMultiplier: 1.3,
    detectionRadiusMultiplier: 1.4,
  },
} as const;

// ============================================
// Camera Constants
// ============================================

/** Camera angle from horizontal in degrees */
export const CAMERA_ANGLE = 50;

/** Camera distance from player in world units */
export const CAMERA_DISTANCE = 15;

/** Camera height offset in world units */
export const CAMERA_HEIGHT_OFFSET = 12;

/** Camera field of view in degrees */
export const CAMERA_FOV = 60;

/** Camera follow speed (lerp factor) */
export const CAMERA_FOLLOW_SPEED = 6;

// ============================================
// Combat Constants
// ============================================

/** Attack cooldown in seconds */
export const ATTACK_COOLDOWN = 0.5;

/** Sword attack range in world units */
export const SWORD_RANGE = 2;

/** Sword attack arc in degrees */
export const SWORD_ARC = 90;

// ============================================
// Power-up Constants
// ============================================

/** Speed boost effect multiplier */
export const SPEED_BOOST_MULTIPLIER = 1.5;

/** Speed boost duration in seconds */
export const SPEED_BOOST_DURATION = 8;

/** Invisibility duration in seconds */
export const INVISIBILITY_DURATION = 5;

/** Freeze duration in seconds */
export const FREEZE_DURATION = 4;

// ============================================
// Level Configuration
// ============================================

/** Maze sizes by difficulty tier */
export const MAZE_SIZES = {
  SMALL: 10,   // Levels 1-3
  MEDIUM: 15,  // Levels 4-6
  LARGE: 20,   // Levels 7+
} as const;

/** Zombie counts by level range */
export const ZOMBIE_COUNTS = {
  EASY: { min: 2, max: 4 },     // Levels 1-3
  MEDIUM: { min: 5, max: 8 },   // Levels 4-6
  HARD: { min: 9, max: 12 },    // Levels 7-9
  ENDLESS: { min: 12, max: 15 }, // Level 10+
} as const;

/** Time limits in seconds by difficulty */
export const TIME_LIMITS = {
  EASY: 60,    // Levels 1-3
  MEDIUM: 90,  // Levels 4-6
  HARD: 120,   // Levels 7+
  MIN: 90,     // Minimum time for endless mode
} as const;

/** Sword spawn probabilities */
export const SWORD_SPAWN_CHANCE = {
  EASY: 1.0,   // 100% - Levels 1-3
  MEDIUM: 0.8, // 80% - Levels 4-6
  HARD: 0.6,   // 60% - Levels 7-9
  ENDLESS: 0.4, // 40% - Level 10+
} as const;

// ============================================
// Rendering Constants
// ============================================

/** Target frame rate */
export const TARGET_FPS = 60;

/** Maximum delta time to prevent physics issues */
export const MAX_DELTA_TIME = 1 / 30;

/** Fog of war visibility radius in cells */
export const FOG_VISIBILITY_RADIUS = 4;

// ============================================
// UI Constants
// ============================================

/** Minimum touch target size in pixels */
export const MIN_TOUCH_TARGET = 44;

/** Virtual joystick radius in pixels */
export const JOYSTICK_RADIUS = 100;

/** Joystick dead zone as percentage of radius */
export const JOYSTICK_DEADZONE = 0.1;

/** Touch button sizes by setting */
export const TOUCH_BUTTON_SIZES = {
  SMALL: { button: 56, joystickRadius: 80, joystickThumb: 44 },
  MEDIUM: { button: 70, joystickRadius: 100, joystickThumb: 60 },
  LARGE: { button: 84, joystickRadius: 120, joystickThumb: 70 },
} as const;

/** Touch control position options */
export type JoystickPosition = 'left' | 'right';

/** Touch button size options */
export type TouchButtonSize = 'small' | 'medium' | 'large';

// ============================================
// Audio Constants
// ============================================

/** Music crossfade duration in seconds */
export const MUSIC_CROSSFADE_DURATION = 2;

/** Default music volume (0-1) */
export const DEFAULT_MUSIC_VOLUME = 0.5;

/** Default SFX volume (0-1) */
export const DEFAULT_SFX_VOLUME = 0.7;

// ============================================
// Particle Constants
// ============================================

/** Maximum active particle effects */
export const MAX_PARTICLE_EFFECTS = 20;

/** Particle pool size per effect type */
export const PARTICLE_POOL_SIZE = 10;

/** Mobile particle count multiplier (0-1) */
export const MOBILE_PARTICLE_MULTIPLIER = 0.5;

// ============================================
// Mobile & Performance Constants
// ============================================

/** Mobile device shadow map size */
export const MOBILE_SHADOW_MAP_SIZE = 1024;

/** Desktop shadow map size */
export const DESKTOP_SHADOW_MAP_SIZE = 2048;

/** Mobile fog near distance */
export const MOBILE_FOG_NEAR = 20;

/** Mobile fog far distance */
export const MOBILE_FOG_FAR = 60;

/** Desktop fog near distance */
export const DESKTOP_FOG_NEAR = 30;

/** Desktop fog far distance */
export const DESKTOP_FOG_FAR = 100;

/** Mobile pixel ratio cap */
export const MOBILE_PIXEL_RATIO_CAP = 2;

/** Screen shake duration in seconds */
export const SCREEN_SHAKE_DURATION = 0.15;

/** Screen shake intensity */
export const SCREEN_SHAKE_INTENSITY = 0.3;
