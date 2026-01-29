import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HapticManager, HapticPattern } from './HapticManager';

describe('HapticManager', () => {
  let hapticManager: HapticManager;
  let mockVibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset the singleton for each test
    // @ts-expect-error - accessing private static for testing
    HapticManager.instance = null;

    // Mock navigator.vibrate
    mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    });

    hapticManager = HapticManager.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = HapticManager.getInstance();
      const instance2 = HapticManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('support detection', () => {
    it('should detect vibration support', () => {
      expect(hapticManager.getIsSupported()).toBe(true);
    });

    it('should be enabled by default when supported', () => {
      expect(hapticManager.getIsEnabled()).toBe(true);
    });
  });

  describe('enable/disable', () => {
    it('should allow disabling haptic feedback', () => {
      hapticManager.setEnabled(false);
      expect(hapticManager.getIsEnabled()).toBe(false);
    });

    it('should not vibrate when disabled', () => {
      hapticManager.setEnabled(false);
      hapticManager.trigger(HapticPattern.MEDIUM);
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    it('should vibrate when re-enabled', () => {
      hapticManager.setEnabled(false);
      hapticManager.setEnabled(true);
      hapticManager.trigger(HapticPattern.MEDIUM);
      expect(mockVibrate).toHaveBeenCalled();
    });
  });

  describe('trigger patterns', () => {
    it('should trigger LIGHT pattern', () => {
      hapticManager.trigger(HapticPattern.LIGHT);
      expect(mockVibrate).toHaveBeenCalledWith(10);
    });

    it('should trigger MEDIUM pattern', () => {
      hapticManager.trigger(HapticPattern.MEDIUM);
      expect(mockVibrate).toHaveBeenCalledWith(25);
    });

    it('should trigger HEAVY pattern', () => {
      hapticManager.trigger(HapticPattern.HEAVY);
      expect(mockVibrate).toHaveBeenCalledWith(50);
    });

    it('should trigger DOUBLE pattern', () => {
      hapticManager.trigger(HapticPattern.DOUBLE);
      expect(mockVibrate).toHaveBeenCalledWith([20, 50, 20]);
    });

    it('should trigger SUCCESS pattern', () => {
      hapticManager.trigger(HapticPattern.SUCCESS);
      expect(mockVibrate).toHaveBeenCalledWith([30, 50, 30, 50, 60]);
    });

    it('should trigger WARNING pattern', () => {
      hapticManager.trigger(HapticPattern.WARNING);
      expect(mockVibrate).toHaveBeenCalledWith([100, 30, 100]);
    });

    it('should trigger ERROR pattern', () => {
      hapticManager.trigger(HapticPattern.ERROR);
      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100, 50, 200]);
    });
  });

  describe('custom patterns', () => {
    it('should trigger custom number pattern', () => {
      hapticManager.triggerCustom(100);
      expect(mockVibrate).toHaveBeenCalledWith(100);
    });

    it('should trigger custom array pattern', () => {
      hapticManager.triggerCustom([50, 100, 50]);
      expect(mockVibrate).toHaveBeenCalledWith([50, 100, 50]);
    });
  });

  describe('stop', () => {
    it('should stop vibration', () => {
      hapticManager.stop();
      expect(mockVibrate).toHaveBeenCalledWith(0);
    });
  });

  describe('convenience methods', () => {
    it('should call correct pattern for onAttack', () => {
      hapticManager.onAttack();
      expect(mockVibrate).toHaveBeenCalledWith(50); // HEAVY
    });

    it('should call correct pattern for onHitZombie', () => {
      hapticManager.onHitZombie();
      expect(mockVibrate).toHaveBeenCalledWith(25); // MEDIUM
    });

    it('should call correct pattern for onPowerUpCollect', () => {
      hapticManager.onPowerUpCollect();
      expect(mockVibrate).toHaveBeenCalledWith([20, 50, 20]); // DOUBLE
    });

    it('should call correct pattern for onSwordCollect', () => {
      hapticManager.onSwordCollect();
      expect(mockVibrate).toHaveBeenCalledWith(25); // MEDIUM
    });

    it('should call correct pattern for onShieldBreak', () => {
      hapticManager.onShieldBreak();
      expect(mockVibrate).toHaveBeenCalledWith([100, 30, 100]); // WARNING
    });

    it('should call correct pattern for onDeath', () => {
      hapticManager.onDeath();
      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100, 50, 200]); // ERROR
    });

    it('should call correct pattern for onLevelComplete', () => {
      hapticManager.onLevelComplete();
      expect(mockVibrate).toHaveBeenCalledWith([30, 50, 30, 50, 60]); // SUCCESS
    });

    it('should call correct pattern for onButtonPress', () => {
      hapticManager.onButtonPress();
      expect(mockVibrate).toHaveBeenCalledWith(10); // LIGHT
    });
  });

  describe('error handling', () => {
    it('should handle vibrate throwing an error gracefully', () => {
      mockVibrate.mockImplementation(() => {
        throw new Error('Vibration not allowed');
      });

      // Should not throw
      expect(() => hapticManager.trigger(HapticPattern.MEDIUM)).not.toThrow();
    });
  });

  describe('unsupported environment', () => {
    it('should handle missing vibrate API', () => {
      // @ts-expect-error - accessing private static for testing
      HapticManager.instance = null;

      // Store original
      const originalVibrate = navigator.vibrate;

      // Delete vibrate to simulate unsupported environment
      // @ts-expect-error - deleting for test
      delete navigator.vibrate;

      const manager = HapticManager.getInstance();
      expect(manager.getIsSupported()).toBe(false);
      expect(manager.getIsEnabled()).toBe(false);

      // Should not throw even when API doesn't exist
      expect(() => manager.trigger(HapticPattern.MEDIUM)).not.toThrow();
      expect(() => manager.stop()).not.toThrow();

      // Restore for other tests
      Object.defineProperty(navigator, 'vibrate', {
        value: originalVibrate,
        writable: true,
        configurable: true,
      });
    });
  });
});
