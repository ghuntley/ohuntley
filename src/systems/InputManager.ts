/**
 * Input management system for Meerkat Maze Runner
 * Handles keyboard and touch input for player control
 */

import { JOYSTICK_DEADZONE } from '../utils/Constants';

/** Input action types */
export enum InputAction {
  MOVE_UP = 'MOVE_UP',
  MOVE_DOWN = 'MOVE_DOWN',
  MOVE_LEFT = 'MOVE_LEFT',
  MOVE_RIGHT = 'MOVE_RIGHT',
  SPRINT = 'SPRINT',
  ATTACK = 'ATTACK',
  PAUSE = 'PAUSE',
  CONFIRM = 'CONFIRM',
}

/** Keyboard key to action mapping */
const KEY_MAPPINGS: Record<string, InputAction> = {
  // WASD
  KeyW: InputAction.MOVE_UP,
  KeyA: InputAction.MOVE_LEFT,
  KeyS: InputAction.MOVE_DOWN,
  KeyD: InputAction.MOVE_RIGHT,
  // Arrow keys
  ArrowUp: InputAction.MOVE_UP,
  ArrowLeft: InputAction.MOVE_LEFT,
  ArrowDown: InputAction.MOVE_DOWN,
  ArrowRight: InputAction.MOVE_RIGHT,
  // Other controls
  ShiftLeft: InputAction.SPRINT,
  ShiftRight: InputAction.SPRINT,
  Space: InputAction.ATTACK,
  Escape: InputAction.PAUSE,
  Enter: InputAction.CONFIRM,
};

/** Movement direction vector */
export interface Vector2 {
  x: number;
  y: number;
}

/** Virtual joystick state */
export interface JoystickState {
  active: boolean;
  centerX: number;
  centerY: number;
  currentX: number;
  currentY: number;
  direction: Vector2;
  touchId: number | null;
}

/** Touch button state */
export interface TouchButtonState {
  active: boolean;
  touchId: number | null;
}

/** Callback for input action events */
export type InputActionCallback = (action: InputAction, pressed: boolean) => void;

/**
 * Manages all game input from keyboard and touch devices
 */
export class InputManager {
  private static instance: InputManager | null = null;

  private activeActions: Set<InputAction>;
  private pressedKeys: Set<string>;
  private actionCallbacks: Set<InputActionCallback>;
  private enabled: boolean;
  private initialized: boolean;

  // Touch input state
  private joystickState: JoystickState;
  private sprintButtonState: TouchButtonState;
  private attackButtonState: TouchButtonState;
  private pauseButtonState: TouchButtonState;
  private isTouchDeviceDetected: boolean;

  // Touch element references (set by TouchControls)
  private joystickElement: HTMLElement | null = null;
  private sprintButtonElement: HTMLElement | null = null;
  private attackButtonElement: HTMLElement | null = null;
  private pauseButtonElement: HTMLElement | null = null;

  private constructor() {
    this.activeActions = new Set();
    this.pressedKeys = new Set();
    this.actionCallbacks = new Set();
    this.enabled = true;
    this.initialized = false;

    // Initialize touch state
    this.joystickState = {
      active: false,
      centerX: 0,
      centerY: 0,
      currentX: 0,
      currentY: 0,
      direction: { x: 0, y: 0 },
      touchId: null,
    };

    this.sprintButtonState = { active: false, touchId: null };
    this.attackButtonState = { active: false, touchId: null };
    this.pauseButtonState = { active: false, touchId: null };

    // Detect touch device
    this.isTouchDeviceDetected = this.detectTouchDevice();
  }

  /** Get the singleton instance */
  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  /** Reset the singleton (for testing) */
  static resetInstance(): void {
    if (InputManager.instance) {
      InputManager.instance.destroy();
      InputManager.instance = null;
    }
  }

  /** Detect if the device supports touch */
  private detectTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error - msMaxTouchPoints is IE-specific
      navigator.msMaxTouchPoints > 0
    );
  }

  /** Initialize event listeners */
  initialize(): void {
    if (this.initialized) return;

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('blur', this.handleBlur);

      // Touch event listeners
      window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
      window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
      window.addEventListener('touchend', this.handleTouchEnd, { passive: false });
      window.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });

      // Prevent default browser gestures on the document
      document.addEventListener('gesturestart', this.preventGesture, { passive: false });
      document.addEventListener('gesturechange', this.preventGesture, { passive: false });
      document.addEventListener('gestureend', this.preventGesture, { passive: false });
    }

    this.initialized = true;
  }

  /** Clean up event listeners */
  destroy(): void {
    if (!this.initialized) return;

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('blur', this.handleBlur);

      // Remove touch event listeners
      window.removeEventListener('touchstart', this.handleTouchStart);
      window.removeEventListener('touchmove', this.handleTouchMove);
      window.removeEventListener('touchend', this.handleTouchEnd);
      window.removeEventListener('touchcancel', this.handleTouchCancel);

      // Remove gesture prevention
      document.removeEventListener('gesturestart', this.preventGesture);
      document.removeEventListener('gesturechange', this.preventGesture);
      document.removeEventListener('gestureend', this.preventGesture);
    }

    this.activeActions.clear();
    this.pressedKeys.clear();
    this.actionCallbacks.clear();
    this.resetTouchState();
    this.initialized = false;
  }

  /** Handle key down event */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    const action = KEY_MAPPINGS[event.code];
    if (action === undefined) return;

    // Prevent default for game keys
    event.preventDefault();

    // Don't repeat if key is already pressed
    if (this.pressedKeys.has(event.code)) return;

    this.pressedKeys.add(event.code);
    this.activateAction(action);
  };

  /** Handle key up event */
  private handleKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_MAPPINGS[event.code];
    if (action === undefined) return;

    this.pressedKeys.delete(event.code);

    // Only deactivate if no other key maps to same action
    const stillActive = Array.from(this.pressedKeys).some(
      (key) => KEY_MAPPINGS[key] === action
    );

    if (!stillActive) {
      this.deactivateAction(action);
    }
  };

  /** Handle window blur (release all keys) */
  private handleBlur = (): void => {
    this.releaseAll();
  };

  /** Prevent default browser gestures */
  private preventGesture = (event: Event): void => {
    event.preventDefault();
  };

  /** Handle touch start event */
  private handleTouchStart = (event: TouchEvent): void => {
    if (!this.enabled) return;

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const target = touch.target as HTMLElement;

      // Check if touch is on joystick area
      if (this.joystickElement && this.isElementOrChild(target, this.joystickElement)) {
        if (!this.joystickState.active) {
          event.preventDefault();
          this.joystickState.active = true;
          this.joystickState.touchId = touch.identifier;
          this.joystickState.centerX = touch.clientX;
          this.joystickState.centerY = touch.clientY;
          this.joystickState.currentX = touch.clientX;
          this.joystickState.currentY = touch.clientY;
          this.updateJoystickDirection();
        }
        continue;
      }

      // Check if touch is on sprint button
      if (this.sprintButtonElement && this.isElementOrChild(target, this.sprintButtonElement)) {
        if (!this.sprintButtonState.active) {
          event.preventDefault();
          this.sprintButtonState.active = true;
          this.sprintButtonState.touchId = touch.identifier;
          this.activateAction(InputAction.SPRINT);
        }
        continue;
      }

      // Check if touch is on attack button
      if (this.attackButtonElement && this.isElementOrChild(target, this.attackButtonElement)) {
        if (!this.attackButtonState.active) {
          event.preventDefault();
          this.attackButtonState.active = true;
          this.attackButtonState.touchId = touch.identifier;
          this.activateAction(InputAction.ATTACK);
        }
        continue;
      }

      // Check if touch is on pause button
      if (this.pauseButtonElement && this.isElementOrChild(target, this.pauseButtonElement)) {
        if (!this.pauseButtonState.active) {
          event.preventDefault();
          this.pauseButtonState.active = true;
          this.pauseButtonState.touchId = touch.identifier;
          this.activateAction(InputAction.PAUSE);
        }
        continue;
      }
    }
  };

  /** Handle touch move event */
  private handleTouchMove = (event: TouchEvent): void => {
    if (!this.enabled) return;

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];

      // Update joystick if this is the joystick touch
      if (this.joystickState.active && touch.identifier === this.joystickState.touchId) {
        event.preventDefault();
        this.joystickState.currentX = touch.clientX;
        this.joystickState.currentY = touch.clientY;
        this.updateJoystickDirection();
      }
    }
  };

  /** Handle touch end event */
  private handleTouchEnd = (event: TouchEvent): void => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.handleTouchRelease(touch.identifier);
    }
  };

  /** Handle touch cancel event */
  private handleTouchCancel = (event: TouchEvent): void => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.handleTouchRelease(touch.identifier);
    }
  };

  /** Handle release of a specific touch */
  private handleTouchRelease(touchId: number): void {
    // Check joystick
    if (this.joystickState.active && this.joystickState.touchId === touchId) {
      this.joystickState.active = false;
      this.joystickState.touchId = null;
      this.joystickState.direction = { x: 0, y: 0 };
    }

    // Check sprint button
    if (this.sprintButtonState.active && this.sprintButtonState.touchId === touchId) {
      this.sprintButtonState.active = false;
      this.sprintButtonState.touchId = null;
      this.deactivateAction(InputAction.SPRINT);
    }

    // Check attack button
    if (this.attackButtonState.active && this.attackButtonState.touchId === touchId) {
      this.attackButtonState.active = false;
      this.attackButtonState.touchId = null;
      this.deactivateAction(InputAction.ATTACK);
    }

    // Check pause button
    if (this.pauseButtonState.active && this.pauseButtonState.touchId === touchId) {
      this.pauseButtonState.active = false;
      this.pauseButtonState.touchId = null;
      this.deactivateAction(InputAction.PAUSE);
    }
  }

  /** Check if element is or is a child of the target */
  private isElementOrChild(element: HTMLElement, target: HTMLElement): boolean {
    let current: HTMLElement | null = element;
    while (current) {
      if (current === target) return true;
      current = current.parentElement;
    }
    return false;
  }

  /** Update joystick direction based on current position */
  private updateJoystickDirection(): void {
    const dx = this.joystickState.currentX - this.joystickState.centerX;
    const dy = this.joystickState.currentY - this.joystickState.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Apply dead zone (10% of typical joystick radius ~100px)
    const deadZone = 100 * JOYSTICK_DEADZONE;

    if (distance < deadZone) {
      this.joystickState.direction = { x: 0, y: 0 };
      return;
    }

    // Normalize direction
    const normalizedX = dx / distance;
    const normalizedY = dy / distance;

    // Scale by how far past the dead zone we are (0 at dead zone, 1 at max)
    const maxDistance = 100; // Joystick radius
    const effectiveDistance = Math.min(distance - deadZone, maxDistance - deadZone);
    const scale = effectiveDistance / (maxDistance - deadZone);

    this.joystickState.direction = {
      x: normalizedX * scale,
      y: normalizedY * scale,
    };
  }

  /** Reset all touch state */
  private resetTouchState(): void {
    this.joystickState = {
      active: false,
      centerX: 0,
      centerY: 0,
      currentX: 0,
      currentY: 0,
      direction: { x: 0, y: 0 },
      touchId: null,
    };
    this.sprintButtonState = { active: false, touchId: null };
    this.attackButtonState = { active: false, touchId: null };
    this.pauseButtonState = { active: false, touchId: null };
  }

  /** Activate an input action */
  private activateAction(action: InputAction): void {
    if (this.activeActions.has(action)) return;

    this.activeActions.add(action);
    this.notifyCallbacks(action, true);
  }

  /** Deactivate an input action */
  private deactivateAction(action: InputAction): void {
    if (!this.activeActions.has(action)) return;

    this.activeActions.delete(action);
    this.notifyCallbacks(action, false);
  }

  /** Notify all registered callbacks */
  private notifyCallbacks(action: InputAction, pressed: boolean): void {
    this.actionCallbacks.forEach((callback) => {
      try {
        callback(action, pressed);
      } catch (error) {
        console.error('Error in input callback:', error);
      }
    });
  }

  /** Release all currently pressed keys/actions */
  releaseAll(): void {
    const actions = Array.from(this.activeActions);
    actions.forEach((action) => this.deactivateAction(action));
    this.pressedKeys.clear();
  }

  /** Check if an action is currently active */
  isActionActive(action: InputAction): boolean {
    return this.activeActions.has(action);
  }

  /** Check if any movement action is active */
  isMoving(): boolean {
    return (
      this.isActionActive(InputAction.MOVE_UP) ||
      this.isActionActive(InputAction.MOVE_DOWN) ||
      this.isActionActive(InputAction.MOVE_LEFT) ||
      this.isActionActive(InputAction.MOVE_RIGHT)
    );
  }

  /** Check if sprinting */
  isSprinting(): boolean {
    return this.isActionActive(InputAction.SPRINT);
  }

  /** Get movement direction as normalized vector (combines keyboard and touch input) */
  getMovementDirection(): Vector2 {
    // First check touch joystick
    if (this.joystickState.active && (this.joystickState.direction.x !== 0 || this.joystickState.direction.y !== 0)) {
      return { ...this.joystickState.direction };
    }

    // Fall back to keyboard
    let x = 0;
    let y = 0;

    if (this.isActionActive(InputAction.MOVE_UP)) y -= 1;
    if (this.isActionActive(InputAction.MOVE_DOWN)) y += 1;
    if (this.isActionActive(InputAction.MOVE_LEFT)) x -= 1;
    if (this.isActionActive(InputAction.MOVE_RIGHT)) x += 1;

    // Normalize diagonal movement
    const length = Math.sqrt(x * x + y * y);
    if (length > 0) {
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  /** Get raw movement input (non-normalized) */
  getRawMovement(): Vector2 {
    let x = 0;
    let y = 0;

    if (this.isActionActive(InputAction.MOVE_UP)) y -= 1;
    if (this.isActionActive(InputAction.MOVE_DOWN)) y += 1;
    if (this.isActionActive(InputAction.MOVE_LEFT)) x -= 1;
    if (this.isActionActive(InputAction.MOVE_RIGHT)) x += 1;

    return { x, y };
  }

  /** Register a callback for input action events */
  addActionCallback(callback: InputActionCallback): void {
    this.actionCallbacks.add(callback);
  }

  /** Remove a callback */
  removeActionCallback(callback: InputActionCallback): void {
    this.actionCallbacks.delete(callback);
  }

  /** Enable input processing */
  enable(): void {
    this.enabled = true;
  }

  /** Disable input processing */
  disable(): void {
    this.enabled = false;
    this.releaseAll();
  }

  /** Check if input is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Simulate a key press (for testing) */
  simulateKeyDown(code: string): void {
    const event = new KeyboardEvent('keydown', { code });
    this.handleKeyDown(event);
  }

  /** Simulate a key release (for testing) */
  simulateKeyUp(code: string): void {
    const event = new KeyboardEvent('keyup', { code });
    this.handleKeyUp(event);
  }

  /** Get all currently active actions */
  getActiveActions(): InputAction[] {
    return Array.from(this.activeActions);
  }

  // ============================================
  // Touch-specific methods
  // ============================================

  /** Check if device supports touch */
  isTouchDevice(): boolean {
    return this.isTouchDeviceDetected;
  }

  /** Get joystick direction (for touch controls UI updates) */
  getJoystickDirection(): Vector2 {
    return { ...this.joystickState.direction };
  }

  /** Get joystick state (for touch controls UI updates) */
  getJoystickState(): JoystickState {
    return { ...this.joystickState };
  }

  /** Check if sprint is active via touch */
  isTouchSprintActive(): boolean {
    return this.sprintButtonState.active;
  }

  /** Check if attack is active via touch */
  isTouchAttackActive(): boolean {
    return this.attackButtonState.active;
  }

  /** Set the joystick element for touch detection */
  setJoystickElement(element: HTMLElement | null): void {
    this.joystickElement = element;
  }

  /** Set the sprint button element for touch detection */
  setSprintButtonElement(element: HTMLElement | null): void {
    this.sprintButtonElement = element;
  }

  /** Set the attack button element for touch detection */
  setAttackButtonElement(element: HTMLElement | null): void {
    this.attackButtonElement = element;
  }

  /** Set the pause button element for touch detection */
  setPauseButtonElement(element: HTMLElement | null): void {
    this.pauseButtonElement = element;
  }

  /** Simulate touch joystick input (for testing) */
  simulateTouchJoystick(direction: Vector2): void {
    this.joystickState.active = direction.x !== 0 || direction.y !== 0;
    this.joystickState.direction = { ...direction };
  }

  /** Simulate touch button press (for testing) */
  simulateTouchButton(button: 'sprint' | 'attack' | 'pause', pressed: boolean): void {
    switch (button) {
      case 'sprint':
        this.sprintButtonState.active = pressed;
        if (pressed) {
          this.activateAction(InputAction.SPRINT);
        } else {
          this.deactivateAction(InputAction.SPRINT);
        }
        break;
      case 'attack':
        this.attackButtonState.active = pressed;
        if (pressed) {
          this.activateAction(InputAction.ATTACK);
        } else {
          this.deactivateAction(InputAction.ATTACK);
        }
        break;
      case 'pause':
        this.pauseButtonState.active = pressed;
        if (pressed) {
          this.activateAction(InputAction.PAUSE);
        } else {
          this.deactivateAction(InputAction.PAUSE);
        }
        break;
    }
  }
}
