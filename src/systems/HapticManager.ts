/**
 * HapticManager - Handles haptic feedback (vibration) for mobile devices
 * Uses the Vibration API to provide tactile feedback on key game events
 */

/** Haptic feedback patterns for different game events */
export enum HapticPattern {
  /** Light tap - for UI interactions */
  LIGHT = 'LIGHT',
  /** Medium impact - for collecting items */
  MEDIUM = 'MEDIUM',
  /** Heavy impact - for attacks */
  HEAVY = 'HEAVY',
  /** Double tap - for power-up collection */
  DOUBLE = 'DOUBLE',
  /** Success pattern - for level completion */
  SUCCESS = 'SUCCESS',
  /** Warning pattern - for damage/shield break */
  WARNING = 'WARNING',
  /** Error/death pattern */
  ERROR = 'ERROR',
}

/** Vibration patterns in milliseconds */
const VIBRATION_PATTERNS: Record<HapticPattern, number | number[]> = {
  [HapticPattern.LIGHT]: 10,
  [HapticPattern.MEDIUM]: 25,
  [HapticPattern.HEAVY]: 50,
  [HapticPattern.DOUBLE]: [20, 50, 20],
  [HapticPattern.SUCCESS]: [30, 50, 30, 50, 60],
  [HapticPattern.WARNING]: [100, 30, 100],
  [HapticPattern.ERROR]: [100, 50, 100, 50, 200],
};

/**
 * Singleton manager for haptic feedback
 */
export class HapticManager {
  private static instance: HapticManager | null = null;

  private enabled: boolean;
  private isSupported: boolean;

  private constructor() {
    // Check if Vibration API is supported
    this.isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    this.enabled = this.isSupported;
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): HapticManager {
    if (!HapticManager.instance) {
      HapticManager.instance = new HapticManager();
    }
    return HapticManager.instance;
  }

  /**
   * Check if haptic feedback is supported on this device
   */
  getIsSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Check if haptic feedback is enabled
   */
  getIsEnabled(): boolean {
    return this.enabled && this.isSupported;
  }

  /**
   * Enable or disable haptic feedback
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Trigger a haptic feedback pattern
   * @param pattern The pattern to play
   */
  trigger(pattern: HapticPattern): void {
    if (!this.enabled || !this.isSupported) {
      return;
    }

    try {
      const vibrationPattern = VIBRATION_PATTERNS[pattern];
      navigator.vibrate(vibrationPattern);
    } catch (error) {
      // Silently fail - some browsers may throw on vibrate
      console.debug('Haptic feedback failed:', error);
    }
  }

  /**
   * Trigger a custom vibration pattern
   * @param pattern Number (duration in ms) or array of durations
   */
  triggerCustom(pattern: number | number[]): void {
    if (!this.enabled || !this.isSupported) {
      return;
    }

    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.debug('Haptic feedback failed:', error);
    }
  }

  /**
   * Stop any ongoing vibration
   */
  stop(): void {
    if (!this.isSupported) {
      return;
    }

    try {
      navigator.vibrate(0);
    } catch (error) {
      console.debug('Failed to stop haptic feedback:', error);
    }
  }

  // Convenience methods for common game events

  /**
   * Feedback for sword attack
   */
  onAttack(): void {
    this.trigger(HapticPattern.HEAVY);
  }

  /**
   * Feedback for hitting a zombie
   */
  onHitZombie(): void {
    this.trigger(HapticPattern.MEDIUM);
  }

  /**
   * Feedback for collecting a power-up
   */
  onPowerUpCollect(): void {
    this.trigger(HapticPattern.DOUBLE);
  }

  /**
   * Feedback for collecting the sword
   */
  onSwordCollect(): void {
    this.trigger(HapticPattern.MEDIUM);
  }

  /**
   * Feedback for shield breaking
   */
  onShieldBreak(): void {
    this.trigger(HapticPattern.WARNING);
  }

  /**
   * Feedback for player death
   */
  onDeath(): void {
    this.trigger(HapticPattern.ERROR);
  }

  /**
   * Feedback for completing a level
   */
  onLevelComplete(): void {
    this.trigger(HapticPattern.SUCCESS);
  }

  /**
   * Light feedback for UI button press
   */
  onButtonPress(): void {
    this.trigger(HapticPattern.LIGHT);
  }
}
