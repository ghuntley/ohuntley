/**
 * Settings Menu for Meerkat Maze Runner
 * Audio volume controls and other settings
 */

import { AudioManager, VolumeType } from '../systems/AudioManager';
import { JoystickPosition, TouchButtonSize } from '../utils/Constants';

export interface SettingsMenuCallbacks {
  onBack?: () => void;
  onTouchSettingsChanged?: (joystickPosition: JoystickPosition, buttonSize: TouchButtonSize) => void;
}

export interface TouchControlSettings {
  joystickPosition: JoystickPosition;
  buttonSize: TouchButtonSize;
}

/**
 * Settings menu with audio controls
 */
export class SettingsMenu {
  private container: HTMLElement | null;
  private menuElement: HTMLElement | null = null;
  private callbacks: SettingsMenuCallbacks;
  private audioManager: AudioManager;
  private touchSettings: TouchControlSettings = {
    joystickPosition: 'left',
    buttonSize: 'medium',
  };

  constructor(callbacks: SettingsMenuCallbacks = {}) {
    this.container = document.getElementById('game-container');
    this.callbacks = callbacks;
    this.audioManager = AudioManager.getInstance();
    this.createMenu();
    this.loadSettings();
  }

  /**
   * Get current touch control settings
   */
  getTouchSettings(): TouchControlSettings {
    return { ...this.touchSettings };
  }

  /**
   * Load saved settings from localStorage
   */
  private loadSettings(): void {
    try {
      const savedSettings = localStorage.getItem('meerkat-maze-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.musicVolume !== undefined) {
          this.audioManager.setVolume(VolumeType.MUSIC, settings.musicVolume);
        }
        if (settings.sfxVolume !== undefined) {
          this.audioManager.setVolume(VolumeType.SFX, settings.sfxVolume);
        }
        if (settings.masterVolume !== undefined) {
          this.audioManager.setVolume(VolumeType.MASTER, settings.masterVolume);
        }
        // Load touch control settings
        if (settings.joystickPosition === 'left' || settings.joystickPosition === 'right') {
          this.touchSettings.joystickPosition = settings.joystickPosition;
        }
        if (settings.buttonSize === 'small' || settings.buttonSize === 'medium' || settings.buttonSize === 'large') {
          this.touchSettings.buttonSize = settings.buttonSize;
        }
        this.updateSliderValues();
        this.updateTouchControlValues();
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      const settings = {
        musicVolume: this.audioManager.getVolume(VolumeType.MUSIC),
        sfxVolume: this.audioManager.getVolume(VolumeType.SFX),
        masterVolume: this.audioManager.getVolume(VolumeType.MASTER),
        joystickPosition: this.touchSettings.joystickPosition,
        buttonSize: this.touchSettings.buttonSize,
      };
      localStorage.setItem('meerkat-maze-settings', JSON.stringify(settings));
    } catch {
      // Ignore errors
    }
  }

  /**
   * Update touch control UI values from current settings
   */
  private updateTouchControlValues(): void {
    if (!this.menuElement) return;

    const joystickSelect = this.menuElement.querySelector('#joystick-position') as HTMLSelectElement;
    const buttonSizeSelect = this.menuElement.querySelector('#button-size') as HTMLSelectElement;

    if (joystickSelect) {
      joystickSelect.value = this.touchSettings.joystickPosition;
    }
    if (buttonSizeSelect) {
      buttonSizeSelect.value = this.touchSettings.buttonSize;
    }
  }

  /**
   * Update slider values from current settings
   */
  private updateSliderValues(): void {
    if (!this.menuElement) return;

    const masterSlider = this.menuElement.querySelector('#master-volume') as HTMLInputElement;
    const musicSlider = this.menuElement.querySelector('#music-volume') as HTMLInputElement;
    const sfxSlider = this.menuElement.querySelector('#sfx-volume') as HTMLInputElement;

    if (masterSlider) {
      masterSlider.value = String(this.audioManager.getVolume(VolumeType.MASTER) * 100);
      this.updateSliderLabel('master');
    }
    if (musicSlider) {
      musicSlider.value = String(this.audioManager.getVolume(VolumeType.MUSIC) * 100);
      this.updateSliderLabel('music');
    }
    if (sfxSlider) {
      sfxSlider.value = String(this.audioManager.getVolume(VolumeType.SFX) * 100);
      this.updateSliderLabel('sfx');
    }
  }

  /**
   * Update the label showing the current value for a slider
   */
  private updateSliderLabel(type: string): void {
    if (!this.menuElement) return;
    const slider = this.menuElement.querySelector(`#${type}-volume`) as HTMLInputElement;
    const label = this.menuElement.querySelector(`#${type}-volume-label`);
    if (slider && label) {
      label.textContent = `${Math.round(Number(slider.value))}%`;
    }
  }

  private createMenu(): void {
    if (!this.container) {
      console.error('Game container not found');
      return;
    }

    this.menuElement = document.createElement('div');
    this.menuElement.className = 'settings-menu-overlay hidden';
    this.menuElement.innerHTML = `
      <style>
        .settings-menu-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #2d5a27 0%, #1a3d17 50%, #0f2d0d 100%);
          z-index: 110;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .settings-menu-overlay.hidden {
          display: none;
        }

        .settings-menu-container {
          background: rgba(0, 0, 0, 0.6);
          border-radius: 20px;
          padding: 40px;
          min-width: 350px;
          max-width: 500px;
        }

        .settings-menu-title {
          font-size: 36px;
          font-weight: bold;
          color: #f5e6c8;
          text-align: center;
          margin-bottom: 30px;
          text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
        }

        .settings-section {
          margin-bottom: 25px;
        }

        .settings-section-title {
          font-size: 20px;
          color: #a8d4a8;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .settings-control {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
        }

        .settings-label {
          color: #f5e6c8;
          font-size: 16px;
          min-width: 120px;
        }

        .settings-slider {
          flex: 1;
          height: 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.2);
          -webkit-appearance: none;
          appearance: none;
          cursor: pointer;
        }

        .settings-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4ade80;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
        }

        .settings-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4ade80;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
        }

        .settings-value {
          color: #4ade80;
          font-size: 16px;
          min-width: 50px;
          text-align: right;
          font-weight: bold;
        }

        .settings-btn {
          padding: 15px 30px;
          font-size: 18px;
          font-weight: bold;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
          width: 100%;
          margin-top: 20px;
        }

        .settings-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3);
        }

        .settings-btn:active {
          transform: translateY(2px);
          box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
        }

        .back-btn {
          background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
          color: #1e293b;
        }

        .back-btn:hover {
          background: linear-gradient(180deg, #a4b3c8 0%, #7484ab 100%);
        }

        .mute-toggle {
          display: flex;
          align-items: center;
          margin-top: 20px;
        }

        .mute-checkbox {
          width: 20px;
          height: 20px;
          margin-right: 10px;
          cursor: pointer;
        }

        .mute-label {
          color: #f5e6c8;
          font-size: 16px;
          cursor: pointer;
        }

        .settings-select {
          flex: 1;
          padding: 8px 12px;
          font-size: 14px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.15);
          color: #f5e6c8;
          border: 2px solid rgba(255, 255, 255, 0.3);
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f5e6c8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 36px;
        }

        .settings-select:focus {
          outline: none;
          border-color: #4ade80;
        }

        .settings-select option {
          background: #1a3d17;
          color: #f5e6c8;
        }

        .touch-controls-note {
          color: #888;
          font-size: 12px;
          font-style: italic;
          margin-top: 5px;
        }
      </style>

      <div class="settings-menu-container">
        <h1 class="settings-menu-title">Settings</h1>

        <div class="settings-section">
          <h2 class="settings-section-title">Audio</h2>

          <div class="settings-control">
            <label class="settings-label" for="master-volume">Master</label>
            <input type="range" id="master-volume" class="settings-slider" min="0" max="100" value="100">
            <span id="master-volume-label" class="settings-value">100%</span>
          </div>

          <div class="settings-control">
            <label class="settings-label" for="music-volume">Music</label>
            <input type="range" id="music-volume" class="settings-slider" min="0" max="100" value="50">
            <span id="music-volume-label" class="settings-value">50%</span>
          </div>

          <div class="settings-control">
            <label class="settings-label" for="sfx-volume">Sound Effects</label>
            <input type="range" id="sfx-volume" class="settings-slider" min="0" max="100" value="70">
            <span id="sfx-volume-label" class="settings-value">70%</span>
          </div>

          <div class="mute-toggle">
            <input type="checkbox" id="mute-all" class="mute-checkbox">
            <label for="mute-all" class="mute-label">Mute All Audio</label>
          </div>
        </div>

        <div class="settings-section" id="touch-controls-section">
          <h2 class="settings-section-title">Touch Controls</h2>

          <div class="settings-control">
            <label class="settings-label" for="joystick-position">Joystick</label>
            <select id="joystick-position" class="settings-select">
              <option value="left">Left Side</option>
              <option value="right">Right Side</option>
            </select>
          </div>

          <div class="settings-control">
            <label class="settings-label" for="button-size">Button Size</label>
            <select id="button-size" class="settings-select">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <p class="touch-controls-note">Touch controls only appear on mobile devices</p>
        </div>

        <button class="settings-btn back-btn">Back</button>
      </div>
    `;

    this.setupEventListeners();
    this.container.appendChild(this.menuElement);
  }

  private setupEventListeners(): void {
    if (!this.menuElement) return;

    // Volume sliders
    const masterSlider = this.menuElement.querySelector('#master-volume') as HTMLInputElement;
    const musicSlider = this.menuElement.querySelector('#music-volume') as HTMLInputElement;
    const sfxSlider = this.menuElement.querySelector('#sfx-volume') as HTMLInputElement;
    const muteCheckbox = this.menuElement.querySelector('#mute-all') as HTMLInputElement;
    const backBtn = this.menuElement.querySelector('.back-btn');

    masterSlider?.addEventListener('input', () => {
      const value = Number(masterSlider.value) / 100;
      this.audioManager.setVolume(VolumeType.MASTER, value);
      this.updateSliderLabel('master');
      this.saveSettings();
    });

    musicSlider?.addEventListener('input', () => {
      const value = Number(musicSlider.value) / 100;
      this.audioManager.setVolume(VolumeType.MUSIC, value);
      this.updateSliderLabel('music');
      this.saveSettings();
    });

    sfxSlider?.addEventListener('input', () => {
      const value = Number(sfxSlider.value) / 100;
      this.audioManager.setVolume(VolumeType.SFX, value);
      this.updateSliderLabel('sfx');
      this.saveSettings();
    });

    muteCheckbox?.addEventListener('change', () => {
      if (muteCheckbox.checked) {
        this.audioManager.setVolume(VolumeType.MASTER, 0);
        if (masterSlider) masterSlider.value = '0';
        this.updateSliderLabel('master');
      } else {
        this.audioManager.setVolume(VolumeType.MASTER, 1);
        if (masterSlider) masterSlider.value = '100';
        this.updateSliderLabel('master');
      }
      this.saveSettings();
    });

    backBtn?.addEventListener('click', () => {
      this.hide();
      this.callbacks.onBack?.();
    });

    // Touch control settings
    const joystickSelect = this.menuElement.querySelector('#joystick-position') as HTMLSelectElement;
    const buttonSizeSelect = this.menuElement.querySelector('#button-size') as HTMLSelectElement;

    joystickSelect?.addEventListener('change', () => {
      this.touchSettings.joystickPosition = joystickSelect.value as JoystickPosition;
      this.saveSettings();
      this.callbacks.onTouchSettingsChanged?.(
        this.touchSettings.joystickPosition,
        this.touchSettings.buttonSize
      );
    });

    buttonSizeSelect?.addEventListener('change', () => {
      this.touchSettings.buttonSize = buttonSizeSelect.value as TouchButtonSize;
      this.saveSettings();
      this.callbacks.onTouchSettingsChanged?.(
        this.touchSettings.joystickPosition,
        this.touchSettings.buttonSize
      );
    });
  }

  /**
   * Show the settings menu
   */
  show(): void {
    if (this.menuElement) {
      this.updateSliderValues();
      this.menuElement.classList.remove('hidden');
    }
  }

  /**
   * Hide the settings menu
   */
  hide(): void {
    if (this.menuElement) {
      this.menuElement.classList.add('hidden');
    }
  }

  /**
   * Check if menu is visible
   */
  isVisible(): boolean {
    return this.menuElement ? !this.menuElement.classList.contains('hidden') : false;
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: SettingsMenuCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Clean up and remove the menu from DOM
   */
  destroy(): void {
    if (this.menuElement && this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
      this.menuElement = null;
    }
  }
}
