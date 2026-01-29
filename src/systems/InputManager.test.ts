import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager, InputAction, Vector2 } from './InputManager';

describe('InputManager', () => {
  let inputManager: InputManager;

  beforeEach(() => {
    InputManager.resetInstance();
    inputManager = InputManager.getInstance();
    inputManager.initialize();
  });

  afterEach(() => {
    InputManager.resetInstance();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = InputManager.getInstance();
      const instance2 = InputManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = InputManager.getInstance();
      InputManager.resetInstance();
      const instance2 = InputManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('keyboard input', () => {
    it('should activate MOVE_UP on W key press', () => {
      inputManager.simulateKeyDown('KeyW');

      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(true);
    });

    it('should activate MOVE_UP on ArrowUp key press', () => {
      inputManager.simulateKeyDown('ArrowUp');

      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(true);
    });

    it('should deactivate action on key release', () => {
      inputManager.simulateKeyDown('KeyW');
      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(true);

      inputManager.simulateKeyUp('KeyW');
      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(false);
    });

    it('should keep action active if alternate key still pressed', () => {
      inputManager.simulateKeyDown('KeyW');
      inputManager.simulateKeyDown('ArrowUp');

      inputManager.simulateKeyUp('KeyW');
      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(true);

      inputManager.simulateKeyUp('ArrowUp');
      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(false);
    });

    it('should handle all movement keys', () => {
      inputManager.simulateKeyDown('KeyW');
      inputManager.simulateKeyDown('KeyA');
      inputManager.simulateKeyDown('KeyS');
      inputManager.simulateKeyDown('KeyD');

      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(true);
      expect(inputManager.isActionActive(InputAction.MOVE_LEFT)).toBe(true);
      expect(inputManager.isActionActive(InputAction.MOVE_DOWN)).toBe(true);
      expect(inputManager.isActionActive(InputAction.MOVE_RIGHT)).toBe(true);
    });

    it('should handle sprint key', () => {
      inputManager.simulateKeyDown('ShiftLeft');
      expect(inputManager.isSprinting()).toBe(true);

      inputManager.simulateKeyUp('ShiftLeft');
      expect(inputManager.isSprinting()).toBe(false);
    });

    it('should handle attack key', () => {
      inputManager.simulateKeyDown('Space');
      expect(inputManager.isActionActive(InputAction.ATTACK)).toBe(true);
    });

    it('should not respond to unmapped keys', () => {
      const initialActions = inputManager.getActiveActions();
      inputManager.simulateKeyDown('KeyQ');

      expect(inputManager.getActiveActions()).toEqual(initialActions);
    });
  });

  describe('movement direction', () => {
    it('should return zero vector when no movement keys pressed', () => {
      const direction = inputManager.getMovementDirection();

      expect(direction.x).toBe(0);
      expect(direction.y).toBe(0);
    });

    it('should return correct direction for single key', () => {
      inputManager.simulateKeyDown('KeyW');
      const direction = inputManager.getMovementDirection();

      expect(direction.x).toBe(0);
      expect(direction.y).toBe(-1);
    });

    it('should return normalized diagonal movement', () => {
      inputManager.simulateKeyDown('KeyW');
      inputManager.simulateKeyDown('KeyD');

      const direction = inputManager.getMovementDirection();
      const length = Math.sqrt(direction.x ** 2 + direction.y ** 2);

      expect(length).toBeCloseTo(1, 5);
      expect(direction.x).toBeGreaterThan(0);
      expect(direction.y).toBeLessThan(0);
    });

    it('should return raw movement without normalization', () => {
      inputManager.simulateKeyDown('KeyW');
      inputManager.simulateKeyDown('KeyD');

      const raw = inputManager.getRawMovement();

      expect(raw.x).toBe(1);
      expect(raw.y).toBe(-1);
    });

    it('should cancel opposite directions', () => {
      inputManager.simulateKeyDown('KeyW');
      inputManager.simulateKeyDown('KeyS');

      const direction = inputManager.getMovementDirection();

      expect(direction.y).toBe(0);
    });
  });

  describe('action callbacks', () => {
    it('should notify callback on action activation', () => {
      const callback = vi.fn();
      inputManager.addActionCallback(callback);

      inputManager.simulateKeyDown('KeyW');

      expect(callback).toHaveBeenCalledWith(InputAction.MOVE_UP, true);
    });

    it('should notify callback on action deactivation', () => {
      const callback = vi.fn();
      inputManager.addActionCallback(callback);

      inputManager.simulateKeyDown('KeyW');
      inputManager.simulateKeyUp('KeyW');

      expect(callback).toHaveBeenCalledWith(InputAction.MOVE_UP, false);
    });

    it('should remove callback correctly', () => {
      const callback = vi.fn();
      inputManager.addActionCallback(callback);
      inputManager.removeActionCallback(callback);

      inputManager.simulateKeyDown('KeyW');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const successCallback = vi.fn();

      inputManager.addActionCallback(errorCallback);
      inputManager.addActionCallback(successCallback);

      // Should not throw
      expect(() => inputManager.simulateKeyDown('KeyW')).not.toThrow();

      // Second callback should still be called
      expect(successCallback).toHaveBeenCalled();
    });
  });

  describe('enable/disable', () => {
    it('should be enabled by default', () => {
      expect(inputManager.isEnabled()).toBe(true);
    });

    it('should not process input when disabled', () => {
      inputManager.disable();
      inputManager.simulateKeyDown('KeyW');

      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(false);
    });

    it('should release all actions when disabled', () => {
      inputManager.simulateKeyDown('KeyW');
      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(true);

      inputManager.disable();
      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(false);
    });

    it('should process input after re-enabling', () => {
      inputManager.disable();
      inputManager.enable();
      inputManager.simulateKeyDown('KeyW');

      expect(inputManager.isActionActive(InputAction.MOVE_UP)).toBe(true);
    });
  });

  describe('releaseAll', () => {
    it('should release all active actions', () => {
      inputManager.simulateKeyDown('KeyW');
      inputManager.simulateKeyDown('KeyA');
      inputManager.simulateKeyDown('ShiftLeft');

      inputManager.releaseAll();

      expect(inputManager.getActiveActions()).toEqual([]);
    });

    it('should notify callbacks of releases', () => {
      const callback = vi.fn();
      inputManager.addActionCallback(callback);

      inputManager.simulateKeyDown('KeyW');
      callback.mockClear();

      inputManager.releaseAll();

      expect(callback).toHaveBeenCalledWith(InputAction.MOVE_UP, false);
    });
  });

  describe('isMoving', () => {
    it('should return false when no movement keys pressed', () => {
      expect(inputManager.isMoving()).toBe(false);
    });

    it('should return true when any movement key pressed', () => {
      inputManager.simulateKeyDown('KeyW');
      expect(inputManager.isMoving()).toBe(true);
    });

    it('should return false when only non-movement key pressed', () => {
      inputManager.simulateKeyDown('Space');
      expect(inputManager.isMoving()).toBe(false);
    });
  });

  describe('getActiveActions', () => {
    it('should return empty array when no actions active', () => {
      expect(inputManager.getActiveActions()).toEqual([]);
    });

    it('should return all active actions', () => {
      inputManager.simulateKeyDown('KeyW');
      inputManager.simulateKeyDown('ShiftLeft');

      const actions = inputManager.getActiveActions();

      expect(actions).toContain(InputAction.MOVE_UP);
      expect(actions).toContain(InputAction.SPRINT);
      expect(actions.length).toBe(2);
    });
  });

  describe('touch input', () => {
    describe('isTouchDevice', () => {
      it('should return a boolean', () => {
        expect(typeof inputManager.isTouchDevice()).toBe('boolean');
      });
    });

    describe('joystick simulation', () => {
      it('should update joystick direction when simulated', () => {
        inputManager.simulateTouchJoystick({ x: 0.5, y: -0.5 });

        const direction = inputManager.getJoystickDirection();
        expect(direction.x).toBe(0.5);
        expect(direction.y).toBe(-0.5);
      });

      it('should set joystick as active when direction is non-zero', () => {
        inputManager.simulateTouchJoystick({ x: 1, y: 0 });

        const state = inputManager.getJoystickState();
        expect(state.active).toBe(true);
      });

      it('should set joystick as inactive when direction is zero', () => {
        inputManager.simulateTouchJoystick({ x: 0, y: 0 });

        const state = inputManager.getJoystickState();
        expect(state.active).toBe(false);
      });

      it('should prioritize joystick over keyboard for movement direction', () => {
        inputManager.simulateKeyDown('KeyW'); // keyboard up
        inputManager.simulateTouchJoystick({ x: 1, y: 0 }); // joystick right

        const direction = inputManager.getMovementDirection();
        expect(direction.x).toBe(1);
        expect(direction.y).toBe(0);
      });

      it('should fall back to keyboard when joystick is inactive', () => {
        inputManager.simulateKeyDown('KeyW');
        inputManager.simulateTouchJoystick({ x: 0, y: 0 });

        const direction = inputManager.getMovementDirection();
        expect(direction.x).toBe(0);
        expect(direction.y).toBe(-1);
      });
    });

    describe('touch button simulation', () => {
      it('should activate sprint action when sprint button pressed', () => {
        inputManager.simulateTouchButton('sprint', true);

        expect(inputManager.isActionActive(InputAction.SPRINT)).toBe(true);
        expect(inputManager.isTouchSprintActive()).toBe(true);
      });

      it('should deactivate sprint action when sprint button released', () => {
        inputManager.simulateTouchButton('sprint', true);
        inputManager.simulateTouchButton('sprint', false);

        expect(inputManager.isActionActive(InputAction.SPRINT)).toBe(false);
        expect(inputManager.isTouchSprintActive()).toBe(false);
      });

      it('should activate attack action when attack button pressed', () => {
        inputManager.simulateTouchButton('attack', true);

        expect(inputManager.isActionActive(InputAction.ATTACK)).toBe(true);
        expect(inputManager.isTouchAttackActive()).toBe(true);
      });

      it('should deactivate attack action when attack button released', () => {
        inputManager.simulateTouchButton('attack', true);
        inputManager.simulateTouchButton('attack', false);

        expect(inputManager.isActionActive(InputAction.ATTACK)).toBe(false);
        expect(inputManager.isTouchAttackActive()).toBe(false);
      });

      it('should activate pause action when pause button pressed', () => {
        inputManager.simulateTouchButton('pause', true);

        expect(inputManager.isActionActive(InputAction.PAUSE)).toBe(true);
      });

      it('should trigger callbacks when touch buttons are pressed', () => {
        const callback = vi.fn();
        inputManager.addActionCallback(callback);

        inputManager.simulateTouchButton('sprint', true);

        expect(callback).toHaveBeenCalledWith(InputAction.SPRINT, true);
      });
    });

    describe('element registration', () => {
      it('should allow setting joystick element', () => {
        const mockElement = document.createElement('div');
        expect(() => inputManager.setJoystickElement(mockElement)).not.toThrow();
      });

      it('should allow setting sprint button element', () => {
        const mockElement = document.createElement('div');
        expect(() => inputManager.setSprintButtonElement(mockElement)).not.toThrow();
      });

      it('should allow setting attack button element', () => {
        const mockElement = document.createElement('div');
        expect(() => inputManager.setAttackButtonElement(mockElement)).not.toThrow();
      });

      it('should allow setting pause button element', () => {
        const mockElement = document.createElement('div');
        expect(() => inputManager.setPauseButtonElement(mockElement)).not.toThrow();
      });

      it('should allow setting elements to null', () => {
        expect(() => inputManager.setJoystickElement(null)).not.toThrow();
        expect(() => inputManager.setSprintButtonElement(null)).not.toThrow();
        expect(() => inputManager.setAttackButtonElement(null)).not.toThrow();
        expect(() => inputManager.setPauseButtonElement(null)).not.toThrow();
      });
    });
  });
});
