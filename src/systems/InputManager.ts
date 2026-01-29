/**
 * Input management system for Meerkat Maze Runner
 * Handles keyboard and touch input for player control
 */

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

  private constructor() {
    this.activeActions = new Set();
    this.pressedKeys = new Set();
    this.actionCallbacks = new Set();
    this.enabled = true;
    this.initialized = false;
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

  /** Initialize event listeners */
  initialize(): void {
    if (this.initialized) return;

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('blur', this.handleBlur);
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
    }

    this.activeActions.clear();
    this.pressedKeys.clear();
    this.actionCallbacks.clear();
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

  /** Get movement direction as normalized vector */
  getMovementDirection(): Vector2 {
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
}
