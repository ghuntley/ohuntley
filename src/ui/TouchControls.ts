/**
 * Touch Controls UI for Meerkat Maze Runner
 * Provides virtual joystick and buttons for mobile devices
 */

import { InputManager } from '../systems/InputManager';
import {
  JOYSTICK_RADIUS,
  MIN_TOUCH_TARGET,
  TOUCH_BUTTON_SIZES,
  JoystickPosition,
  TouchButtonSize,
} from '../utils/Constants';

/**
 * TouchControls class - manages touch UI overlay
 */
export class TouchControls {
  private container: HTMLDivElement | null = null;
  private joystickContainer: HTMLDivElement | null = null;
  private joystickBase: HTMLDivElement | null = null;
  private joystickThumb: HTMLDivElement | null = null;
  private sprintButton: HTMLDivElement | null = null;
  private attackButton: HTMLDivElement | null = null;
  private pauseButton: HTMLDivElement | null = null;
  private buttonsContainer: HTMLDivElement | null = null;

  private inputManager: InputManager;
  private isVisible: boolean = false;
  private animationFrameId: number | null = null;

  // Current settings
  private joystickPosition: JoystickPosition = 'left';
  private buttonSize: TouchButtonSize = 'medium';

  constructor() {
    this.inputManager = InputManager.getInstance();
    this.loadSettings();
    this.createStyles();
    this.createTouchControls();

    // Auto-show on touch devices
    if (this.inputManager.isTouchDevice()) {
      this.show();
    }
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    try {
      const savedSettings = localStorage.getItem('meerkat-maze-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.joystickPosition === 'left' || settings.joystickPosition === 'right') {
          this.joystickPosition = settings.joystickPosition;
        }
        if (settings.buttonSize === 'small' || settings.buttonSize === 'medium' || settings.buttonSize === 'large') {
          this.buttonSize = settings.buttonSize;
        }
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Update joystick position (left or right side)
   */
  setJoystickPosition(position: JoystickPosition): void {
    this.joystickPosition = position;
    this.applySettings();
  }

  /**
   * Update button size
   */
  setButtonSize(size: TouchButtonSize): void {
    this.buttonSize = size;
    this.applySettings();
  }

  /**
   * Apply current settings to the UI
   */
  private applySettings(): void {
    if (!this.joystickContainer || !this.buttonsContainer) return;

    const sizes = TOUCH_BUTTON_SIZES[this.buttonSize.toUpperCase() as keyof typeof TOUCH_BUTTON_SIZES];

    // Apply joystick position
    if (this.joystickPosition === 'left') {
      this.joystickContainer.style.left = '30px';
      this.joystickContainer.style.right = 'auto';
      this.buttonsContainer.style.right = '30px';
      this.buttonsContainer.style.left = 'auto';
    } else {
      this.joystickContainer.style.right = '30px';
      this.joystickContainer.style.left = 'auto';
      this.buttonsContainer.style.left = '30px';
      this.buttonsContainer.style.right = 'auto';
    }

    // Apply button sizes
    this.joystickContainer.style.width = `${sizes.joystickRadius * 2}px`;
    this.joystickContainer.style.height = `${sizes.joystickRadius * 2}px`;

    if (this.joystickThumb) {
      this.joystickThumb.style.width = `${sizes.joystickThumb}px`;
      this.joystickThumb.style.height = `${sizes.joystickThumb}px`;
    }

    if (this.sprintButton) {
      this.sprintButton.style.width = `${sizes.button}px`;
      this.sprintButton.style.height = `${sizes.button}px`;
    }

    if (this.attackButton) {
      this.attackButton.style.width = `${sizes.button}px`;
      this.attackButton.style.height = `${sizes.button}px`;
    }
  }

  /**
   * Get current joystick position setting
   */
  getJoystickPosition(): JoystickPosition {
    return this.joystickPosition;
  }

  /**
   * Get current button size setting
   */
  getButtonSize(): TouchButtonSize {
    return this.buttonSize;
  }

  /**
   * Inject CSS styles for touch controls
   */
  private createStyles(): void {
    // Check if styles already exist
    if (document.getElementById('meerkat-touch-controls-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'meerkat-touch-controls-styles';
    style.textContent = `
      /* Touch Controls Container */
      #touch-controls {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 1100;
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
      }

      #touch-controls * {
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
      }

      /* Joystick Container - Bottom Left */
      .touch-joystick-container {
        position: absolute;
        bottom: 30px;
        left: 30px;
        width: ${JOYSTICK_RADIUS * 2}px;
        height: ${JOYSTICK_RADIUS * 2}px;
        pointer-events: auto;
      }

      /* Joystick Base */
      .touch-joystick-base {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 70%, transparent 100%);
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        box-shadow:
          inset 0 0 20px rgba(0, 0, 0, 0.3),
          0 4px 8px rgba(0, 0, 0, 0.2);
      }

      /* Joystick Thumb */
      .touch-joystick-thumb {
        position: absolute;
        width: 60px;
        height: 60px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(200, 200, 200, 0.8) 100%);
        border: 3px solid rgba(255, 255, 255, 0.6);
        border-radius: 50%;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          inset 0 2px 0 rgba(255, 255, 255, 0.5);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        transition: transform 0.05s ease-out;
      }

      .touch-joystick-thumb.active {
        background: radial-gradient(circle, rgba(100, 200, 255, 0.95) 0%, rgba(50, 150, 220, 0.85) 100%);
        border-color: rgba(100, 200, 255, 0.8);
        box-shadow:
          0 4px 12px rgba(100, 200, 255, 0.5),
          inset 0 2px 0 rgba(255, 255, 255, 0.5);
      }

      /* Touch Buttons Container - Bottom Right */
      .touch-buttons-container {
        position: absolute;
        bottom: 30px;
        right: 30px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        align-items: flex-end;
      }

      /* Touch Button Base */
      .touch-button {
        width: ${Math.max(MIN_TOUCH_TARGET, 70)}px;
        height: ${Math.max(MIN_TOUCH_TARGET, 70)}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: bold;
        pointer-events: auto;
        transition: transform 0.1s ease, opacity 0.1s ease, box-shadow 0.1s ease;
        border: 3px solid rgba(255, 255, 255, 0.4);
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          inset 0 2px 0 rgba(255, 255, 255, 0.2);
        cursor: pointer;
      }

      .touch-button:active,
      .touch-button.active {
        transform: scale(0.9);
        opacity: 0.9;
      }

      /* Sprint Button - Blue */
      .touch-button-sprint {
        background: linear-gradient(135deg, #0088ff 0%, #0066cc 100%);
        color: white;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .touch-button-sprint:active,
      .touch-button-sprint.active {
        background: linear-gradient(135deg, #00aaff 0%, #0088ff 100%);
        box-shadow:
          0 2px 4px rgba(0, 0, 0, 0.3),
          0 0 15px rgba(0, 136, 255, 0.5),
          inset 0 2px 0 rgba(255, 255, 255, 0.2);
      }

      /* Attack Button - Red */
      .touch-button-attack {
        background: linear-gradient(135deg, #ff4444 0%, #cc2222 100%);
        color: white;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .touch-button-attack:active,
      .touch-button-attack.active {
        background: linear-gradient(135deg, #ff6666 0%, #ff4444 100%);
        box-shadow:
          0 2px 4px rgba(0, 0, 0, 0.3),
          0 0 15px rgba(255, 68, 68, 0.5),
          inset 0 2px 0 rgba(255, 255, 255, 0.2);
      }

      /* Pause Button - Top Right */
      .touch-button-pause {
        position: absolute;
        top: 20px;
        right: 20px;
        width: ${Math.max(MIN_TOUCH_TARGET, 50)}px;
        height: ${Math.max(MIN_TOUCH_TARGET, 50)}px;
        background: linear-gradient(135deg, rgba(60, 60, 60, 0.9) 0%, rgba(40, 40, 40, 0.9) 100%);
        color: white;
        font-size: 20px;
        pointer-events: auto;
        border-radius: 12px;
      }

      .touch-button-pause:active,
      .touch-button-pause.active {
        background: linear-gradient(135deg, rgba(80, 80, 80, 0.95) 0%, rgba(60, 60, 60, 0.95) 100%);
      }

      /* Hide on non-touch devices by default */
      #touch-controls.hidden {
        display: none;
      }

      /* Responsive adjustments for smaller screens */
      @media (max-width: 480px) {
        .touch-joystick-container {
          bottom: 20px;
          left: 20px;
          width: ${JOYSTICK_RADIUS * 1.6}px;
          height: ${JOYSTICK_RADIUS * 1.6}px;
        }

        .touch-joystick-thumb {
          width: 50px;
          height: 50px;
        }

        .touch-buttons-container {
          bottom: 20px;
          right: 20px;
          gap: 10px;
        }

        .touch-button {
          width: ${Math.max(MIN_TOUCH_TARGET, 60)}px;
          height: ${Math.max(MIN_TOUCH_TARGET, 60)}px;
          font-size: 24px;
        }

        .touch-button-pause {
          width: ${Math.max(MIN_TOUCH_TARGET, 44)}px;
          height: ${Math.max(MIN_TOUCH_TARGET, 44)}px;
          font-size: 18px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create the touch controls DOM structure
   */
  private createTouchControls(): void {
    // Check if controls already exist
    const existingControls = document.getElementById('touch-controls');
    if (existingControls) {
      this.container = existingControls as HTMLDivElement;
      this.cacheElements();
      return;
    }

    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    this.container.className = 'hidden';

    // Create joystick
    this.createJoystick();

    // Create action buttons
    this.createActionButtons();

    // Create pause button
    this.createPauseButton();

    // Append to body
    document.body.appendChild(this.container);

    // Register elements with InputManager
    this.registerElementsWithInputManager();

    // Apply saved settings
    this.applySettings();
  }

  /**
   * Create the virtual joystick
   */
  private createJoystick(): void {
    if (!this.container) return;

    this.joystickContainer = document.createElement('div');
    this.joystickContainer.className = 'touch-joystick-container';

    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'touch-joystick-base';
    this.joystickContainer.appendChild(this.joystickBase);

    this.joystickThumb = document.createElement('div');
    this.joystickThumb.className = 'touch-joystick-thumb';
    this.joystickContainer.appendChild(this.joystickThumb);

    this.container.appendChild(this.joystickContainer);
  }

  /**
   * Create sprint and attack buttons
   */
  private createActionButtons(): void {
    if (!this.container) return;

    this.buttonsContainer = document.createElement('div');
    this.buttonsContainer.className = 'touch-buttons-container';

    // Attack button (top)
    this.attackButton = document.createElement('div');
    this.attackButton.className = 'touch-button touch-button-attack';
    this.attackButton.innerHTML = '&#x2694;'; // Sword emoji
    this.attackButton.setAttribute('role', 'button');
    this.attackButton.setAttribute('aria-label', 'Attack');
    this.buttonsContainer.appendChild(this.attackButton);

    // Sprint button (bottom)
    this.sprintButton = document.createElement('div');
    this.sprintButton.className = 'touch-button touch-button-sprint';
    this.sprintButton.innerHTML = '&#x1F3C3;'; // Running emoji
    this.sprintButton.setAttribute('role', 'button');
    this.sprintButton.setAttribute('aria-label', 'Sprint');
    this.buttonsContainer.appendChild(this.sprintButton);

    this.container.appendChild(this.buttonsContainer);
  }

  /**
   * Create pause button
   */
  private createPauseButton(): void {
    if (!this.container) return;

    this.pauseButton = document.createElement('div');
    this.pauseButton.className = 'touch-button touch-button-pause';
    this.pauseButton.innerHTML = '&#x23F8;'; // Pause symbol
    this.pauseButton.setAttribute('role', 'button');
    this.pauseButton.setAttribute('aria-label', 'Pause');

    this.container.appendChild(this.pauseButton);
  }

  /**
   * Cache element references for existing controls
   */
  private cacheElements(): void {
    if (!this.container) return;

    this.joystickContainer = this.container.querySelector('.touch-joystick-container');
    this.joystickBase = this.container.querySelector('.touch-joystick-base');
    this.joystickThumb = this.container.querySelector('.touch-joystick-thumb');
    this.buttonsContainer = this.container.querySelector('.touch-buttons-container');
    this.sprintButton = this.container.querySelector('.touch-button-sprint');
    this.attackButton = this.container.querySelector('.touch-button-attack');
    this.pauseButton = this.container.querySelector('.touch-button-pause');

    this.registerElementsWithInputManager();
    this.applySettings();
  }

  /**
   * Register touch elements with InputManager
   */
  private registerElementsWithInputManager(): void {
    this.inputManager.setJoystickElement(this.joystickContainer);
    this.inputManager.setSprintButtonElement(this.sprintButton);
    this.inputManager.setAttackButtonElement(this.attackButton);
    this.inputManager.setPauseButtonElement(this.pauseButton);
  }

  /**
   * Update visual state based on input
   */
  update(): void {
    if (!this.isVisible) return;

    this.updateJoystickVisual();
    this.updateButtonVisuals();
  }

  /**
   * Update joystick thumb position based on input direction
   */
  private updateJoystickVisual(): void {
    if (!this.joystickThumb) return;

    const state = this.inputManager.getJoystickState();

    if (state.active) {
      this.joystickThumb.classList.add('active');

      // Calculate offset from center
      const dx = state.currentX - state.centerX;
      const dy = state.currentY - state.centerY;

      // Clamp to joystick radius
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = JOYSTICK_RADIUS - 30; // Leave room for thumb
      const clampedDistance = Math.min(distance, maxDistance);

      let offsetX = 0;
      let offsetY = 0;
      if (distance > 0) {
        offsetX = (dx / distance) * clampedDistance;
        offsetY = (dy / distance) * clampedDistance;
      }

      this.joystickThumb.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    } else {
      this.joystickThumb.classList.remove('active');
      this.joystickThumb.style.transform = 'translate(-50%, -50%)';
    }
  }

  /**
   * Update button active states
   */
  private updateButtonVisuals(): void {
    if (this.sprintButton) {
      if (this.inputManager.isTouchSprintActive()) {
        this.sprintButton.classList.add('active');
      } else {
        this.sprintButton.classList.remove('active');
      }
    }

    if (this.attackButton) {
      if (this.inputManager.isTouchAttackActive()) {
        this.attackButton.classList.add('active');
      } else {
        this.attackButton.classList.remove('active');
      }
    }
  }

  /**
   * Start the update loop
   */
  private startUpdateLoop(): void {
    if (this.animationFrameId !== null) return;

    const loop = () => {
      this.update();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Stop the update loop
   */
  private stopUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Show touch controls
   */
  show(): void {
    if (!this.container) {
      this.createTouchControls();
    }

    if (this.container) {
      this.container.classList.remove('hidden');
      this.isVisible = true;
      this.startUpdateLoop();
    }
  }

  /**
   * Hide touch controls
   */
  hide(): void {
    if (this.container) {
      this.container.classList.add('hidden');
      this.isVisible = false;
      this.stopUpdateLoop();
    }
  }

  /**
   * Check if touch controls are visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Clean up touch controls
   */
  dispose(): void {
    // Stop update loop
    this.stopUpdateLoop();

    // Unregister elements from InputManager
    this.inputManager.setJoystickElement(null);
    this.inputManager.setSprintButtonElement(null);
    this.inputManager.setAttackButtonElement(null);
    this.inputManager.setPauseButtonElement(null);

    // Remove from DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    // Remove styles
    const styles = document.getElementById('meerkat-touch-controls-styles');
    if (styles && styles.parentNode) {
      styles.parentNode.removeChild(styles);
    }

    // Clear references
    this.container = null;
    this.joystickContainer = null;
    this.joystickBase = null;
    this.joystickThumb = null;
    this.sprintButton = null;
    this.attackButton = null;
    this.pauseButton = null;
    this.isVisible = false;
  }
}
