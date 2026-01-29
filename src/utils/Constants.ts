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

// ============================================
// Audio Constants
// ============================================

/** Music crossfade duration in seconds */
export const MUSIC_CROSSFADE_DURATION = 2;

/** Default music volume (0-1) */
export const DEFAULT_MUSIC_VOLUME = 0.5;

/** Default SFX volume (0-1) */
export const DEFAULT_SFX_VOLUME = 0.7;
