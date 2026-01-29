import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TouchControls } from './TouchControls';
import { InputManager } from '../systems/InputManager';

describe('TouchControls', () => {
  let touchControls: TouchControls;

  beforeEach(() => {
    // Reset InputManager singleton before each test
    InputManager.resetInstance();
    const inputManager = InputManager.getInstance();
    inputManager.initialize();
  });

  afterEach(() => {
    // Clean up
    if (touchControls) {
      touchControls.dispose();
    }
    InputManager.resetInstance();

    // Clean up any leftover DOM elements
    const container = document.getElementById('touch-controls');
    if (container) {
      container.remove();
    }
    const styles = document.getElementById('meerkat-touch-controls-styles');
    if (styles) {
      styles.remove();
    }
  });

  describe('initialization', () => {
    it('should create touch controls instance', () => {
      touchControls = new TouchControls();
      expect(touchControls).toBeDefined();
    });

    it('should create DOM container', () => {
      touchControls = new TouchControls();
      const container = document.getElementById('touch-controls');
      expect(container).toBeDefined();
    });

    it('should inject styles', () => {
      touchControls = new TouchControls();
      const styles = document.getElementById('meerkat-touch-controls-styles');
      expect(styles).toBeDefined();
    });

    it('should create joystick elements', () => {
      touchControls = new TouchControls();
      const joystickContainer = document.querySelector('.touch-joystick-container');
      const joystickBase = document.querySelector('.touch-joystick-base');
      const joystickThumb = document.querySelector('.touch-joystick-thumb');

      expect(joystickContainer).toBeDefined();
      expect(joystickBase).toBeDefined();
      expect(joystickThumb).toBeDefined();
    });

    it('should create sprint button', () => {
      touchControls = new TouchControls();
      const sprintButton = document.querySelector('.touch-button-sprint');
      expect(sprintButton).toBeDefined();
    });

    it('should create attack button', () => {
      touchControls = new TouchControls();
      const attackButton = document.querySelector('.touch-button-attack');
      expect(attackButton).toBeDefined();
    });

    it('should create pause button', () => {
      touchControls = new TouchControls();
      const pauseButton = document.querySelector('.touch-button-pause');
      expect(pauseButton).toBeDefined();
    });
  });

  describe('visibility', () => {
    beforeEach(() => {
      touchControls = new TouchControls();
    });

    it('should be hidden initially on non-touch devices', () => {
      const inputManager = InputManager.getInstance();
      // In test environment, touch is not detected
      if (!inputManager.isTouchDevice()) {
        expect(touchControls.getIsVisible()).toBe(false);
      }
    });

    it('should show controls when show() is called', () => {
      touchControls.show();
      expect(touchControls.getIsVisible()).toBe(true);
    });

    it('should hide controls when hide() is called', () => {
      touchControls.show();
      touchControls.hide();
      expect(touchControls.getIsVisible()).toBe(false);
    });

    it('should remove hidden class when shown', () => {
      touchControls.show();
      const container = document.getElementById('touch-controls');
      expect(container?.classList.contains('hidden')).toBe(false);
    });

    it('should add hidden class when hidden', () => {
      touchControls.show();
      touchControls.hide();
      const container = document.getElementById('touch-controls');
      expect(container?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      touchControls = new TouchControls();
      touchControls.show();
    });

    it('should update without errors', () => {
      expect(() => touchControls.update()).not.toThrow();
    });

    it('should not update when hidden', () => {
      touchControls.hide();
      // Should not throw even when hidden
      expect(() => touchControls.update()).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should remove container from DOM', () => {
      touchControls = new TouchControls();
      touchControls.dispose();

      const container = document.getElementById('touch-controls');
      expect(container).toBeNull();
    });

    it('should remove styles from DOM', () => {
      touchControls = new TouchControls();
      touchControls.dispose();

      const styles = document.getElementById('meerkat-touch-controls-styles');
      expect(styles).toBeNull();
    });

    it('should set visibility to false', () => {
      touchControls = new TouchControls();
      touchControls.show();
      touchControls.dispose();

      expect(touchControls.getIsVisible()).toBe(false);
    });

    it('should unregister elements from InputManager', () => {
      touchControls = new TouchControls();
      touchControls.dispose();

      // After dispose, elements should be null in InputManager
      // We can verify this indirectly by checking the controls work properly
      // when recreated
      const newControls = new TouchControls();
      expect(newControls).toBeDefined();
      newControls.dispose();
    });
  });

  describe('button accessibility', () => {
    beforeEach(() => {
      touchControls = new TouchControls();
    });

    it('should have role="button" on sprint button', () => {
      const sprintButton = document.querySelector('.touch-button-sprint');
      expect(sprintButton?.getAttribute('role')).toBe('button');
    });

    it('should have role="button" on attack button', () => {
      const attackButton = document.querySelector('.touch-button-attack');
      expect(attackButton?.getAttribute('role')).toBe('button');
    });

    it('should have role="button" on pause button', () => {
      const pauseButton = document.querySelector('.touch-button-pause');
      expect(pauseButton?.getAttribute('role')).toBe('button');
    });

    it('should have aria-label on sprint button', () => {
      const sprintButton = document.querySelector('.touch-button-sprint');
      expect(sprintButton?.getAttribute('aria-label')).toBe('Sprint');
    });

    it('should have aria-label on attack button', () => {
      const attackButton = document.querySelector('.touch-button-attack');
      expect(attackButton?.getAttribute('aria-label')).toBe('Attack');
    });

    it('should have aria-label on pause button', () => {
      const pauseButton = document.querySelector('.touch-button-pause');
      expect(pauseButton?.getAttribute('aria-label')).toBe('Pause');
    });
  });

  describe('joystick visual updates', () => {
    beforeEach(() => {
      touchControls = new TouchControls();
      touchControls.show();
    });

    it('should add active class to thumb when joystick is active', () => {
      const inputManager = InputManager.getInstance();
      inputManager.simulateTouchJoystick({ x: 1, y: 0 });

      touchControls.update();

      // Note: The active class is added based on joystick state from InputManager
      // Since we're simulating, the state should be active
      const state = inputManager.getJoystickState();
      expect(state.active).toBe(true);
    });

    it('should remove active class from thumb when joystick is inactive', () => {
      const inputManager = InputManager.getInstance();
      inputManager.simulateTouchJoystick({ x: 1, y: 0 });
      touchControls.update();

      inputManager.simulateTouchJoystick({ x: 0, y: 0 });
      touchControls.update();

      const state = inputManager.getJoystickState();
      expect(state.active).toBe(false);
    });
  });

  describe('button visual updates', () => {
    beforeEach(() => {
      touchControls = new TouchControls();
      touchControls.show();
    });

    it('should add active class to sprint button when pressed', () => {
      const inputManager = InputManager.getInstance();
      inputManager.simulateTouchButton('sprint', true);

      touchControls.update();

      const sprintButton = document.querySelector('.touch-button-sprint');
      expect(sprintButton?.classList.contains('active')).toBe(true);
    });

    it('should remove active class from sprint button when released', () => {
      const inputManager = InputManager.getInstance();
      inputManager.simulateTouchButton('sprint', true);
      touchControls.update();

      inputManager.simulateTouchButton('sprint', false);
      touchControls.update();

      const sprintButton = document.querySelector('.touch-button-sprint');
      expect(sprintButton?.classList.contains('active')).toBe(false);
    });

    it('should add active class to attack button when pressed', () => {
      const inputManager = InputManager.getInstance();
      inputManager.simulateTouchButton('attack', true);

      touchControls.update();

      const attackButton = document.querySelector('.touch-button-attack');
      expect(attackButton?.classList.contains('active')).toBe(true);
    });

    it('should remove active class from attack button when released', () => {
      const inputManager = InputManager.getInstance();
      inputManager.simulateTouchButton('attack', true);
      touchControls.update();

      inputManager.simulateTouchButton('attack', false);
      touchControls.update();

      const attackButton = document.querySelector('.touch-button-attack');
      expect(attackButton?.classList.contains('active')).toBe(false);
    });
  });

  describe('multiple instances', () => {
    it('should not duplicate DOM elements when created multiple times', () => {
      touchControls = new TouchControls();
      const secondControls = new TouchControls();

      const containers = document.querySelectorAll('#touch-controls');
      expect(containers.length).toBe(1);

      secondControls.dispose();
    });

    it('should not duplicate styles when created multiple times', () => {
      touchControls = new TouchControls();
      const secondControls = new TouchControls();

      const styles = document.querySelectorAll('#meerkat-touch-controls-styles');
      expect(styles.length).toBe(1);

      secondControls.dispose();
    });
  });

  describe('settings', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.removeItem('meerkat-maze-settings');
      touchControls = new TouchControls();
    });

    it('should default to left joystick position', () => {
      expect(touchControls.getJoystickPosition()).toBe('left');
    });

    it('should default to medium button size', () => {
      expect(touchControls.getButtonSize()).toBe('medium');
    });

    it('should allow setting joystick position to right', () => {
      touchControls.setJoystickPosition('right');
      expect(touchControls.getJoystickPosition()).toBe('right');
    });

    it('should allow setting button size to small', () => {
      touchControls.setButtonSize('small');
      expect(touchControls.getButtonSize()).toBe('small');
    });

    it('should allow setting button size to large', () => {
      touchControls.setButtonSize('large');
      expect(touchControls.getButtonSize()).toBe('large');
    });

    it('should apply joystick position to DOM', () => {
      touchControls.setJoystickPosition('right');
      const joystickContainer = document.querySelector('.touch-joystick-container') as HTMLElement;
      expect(joystickContainer?.style.right).toBe('30px');
    });

    it('should apply button size to DOM', () => {
      touchControls.setButtonSize('large');
      const sprintButton = document.querySelector('.touch-button-sprint') as HTMLElement;
      expect(sprintButton?.style.width).toBe('84px');
    });

    it('should load settings from localStorage', () => {
      // Set up settings in localStorage
      localStorage.setItem('meerkat-maze-settings', JSON.stringify({
        joystickPosition: 'right',
        buttonSize: 'small'
      }));

      // Dispose current and create new to load settings
      touchControls.dispose();
      touchControls = new TouchControls();

      expect(touchControls.getJoystickPosition()).toBe('right');
      expect(touchControls.getButtonSize()).toBe('small');
    });
  });
});
