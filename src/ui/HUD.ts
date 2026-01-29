/**
 * HUD (Heads-Up Display) for Meerkat Maze Runner
 * Displays game information as HTML/CSS overlays on top of the Three.js canvas
 */

import { PowerUpType, POWER_UP_VISUALS } from '../entities/PowerUp';

/** Data interface for HUD updates */
export interface HUDData {
  level: number;
  timeRemaining: number;
  sprintPercent: number;
  hasSword: boolean;
  hasShield: boolean;
  activeEffects: Array<{ type: string; remainingTime: number; duration: number }>;
}

/** Timer state for visual feedback */
enum TimerState {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

/**
 * HUD class - manages all on-screen game information displays
 */
export class HUD {
  private container: HTMLDivElement | null = null;
  private isVisible: boolean = false;

  // Element references
  private levelIndicator: HTMLDivElement | null = null;
  private timerDisplay: HTMLDivElement | null = null;
  private sprintGauge: HTMLDivElement | null = null;
  private sprintFill: HTMLDivElement | null = null;
  private swordIndicator: HTMLDivElement | null = null;
  private powerUpsContainer: HTMLDivElement | null = null;

  // Timer state tracking
  private currentTimerState: TimerState = TimerState.NORMAL;
  private pulseAnimationId: number | null = null;

  constructor() {
    this.createStyles();
    this.createHUD();
  }

  /**
   * Inject CSS styles into the document
   */
  private createStyles(): void {
    // Check if styles already exist
    if (document.getElementById('meerkat-hud-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'meerkat-hud-styles';
    style.textContent = `
      /* HUD Container */
      #game-hud {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 1000;
        font-family: 'Comic Sans MS', 'Chalkboard', 'Comic Neue', cursive, sans-serif;
      }

      #game-hud * {
        pointer-events: none;
      }

      /* Level Indicator - Top Left */
      .hud-level {
        position: absolute;
        top: 20px;
        left: 20px;
        background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.2),
          inset 0 2px 0 rgba(255, 255, 255, 0.2);
        border: 3px solid rgba(255, 255, 255, 0.3);
      }

      /* Timer Display - Top Center */
      .hud-timer {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
        color: #00ff00;
        padding: 12px 30px;
        border-radius: 25px;
        font-size: 32px;
        font-weight: bold;
        font-family: 'Courier New', monospace;
        text-shadow: 0 0 10px currentColor;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          inset 0 2px 0 rgba(255, 255, 255, 0.1);
        border: 3px solid rgba(255, 255, 255, 0.2);
        min-width: 100px;
        text-align: center;
        transition: color 0.3s ease, text-shadow 0.3s ease;
      }

      .hud-timer.warning {
        color: #ffcc00;
        text-shadow: 0 0 15px #ffcc00;
        animation: pulse-warning 1s ease-in-out infinite;
      }

      .hud-timer.critical {
        color: #ff3333;
        text-shadow: 0 0 20px #ff3333;
        animation: pulse-critical 0.5s ease-in-out infinite;
      }

      @keyframes pulse-warning {
        0%, 100% { transform: translateX(-50%) scale(1); }
        50% { transform: translateX(-50%) scale(1.05); }
      }

      @keyframes pulse-critical {
        0%, 100% { transform: translateX(-50%) scale(1); }
        50% { transform: translateX(-50%) scale(1.1); }
      }

      /* Sprint Gauge - Bottom Center */
      .hud-sprint {
        position: absolute;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        width: 200px;
        height: 20px;
        background: linear-gradient(135deg, #333333 0%, #1a1a1a 100%);
        border-radius: 15px;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          inset 0 2px 4px rgba(0, 0, 0, 0.5);
        border: 3px solid rgba(255, 255, 255, 0.2);
        overflow: hidden;
      }

      .hud-sprint-fill {
        height: 100%;
        border-radius: 12px;
        transition: width 0.1s ease-out, background 0.3s ease;
        box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.3);
      }

      .hud-sprint-fill.available {
        background: linear-gradient(180deg, #00d4ff 0%, #0080ff 50%, #0066cc 100%);
      }

      .hud-sprint-fill.low {
        background: linear-gradient(180deg, #ffaa00 0%, #ff8800 50%, #cc6600 100%);
      }

      .hud-sprint-fill.empty {
        background: linear-gradient(180deg, #ff5555 0%, #cc3333 50%, #aa2222 100%);
      }

      .hud-sprint-label {
        position: absolute;
        bottom: 65px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        font-size: 14px;
        font-weight: bold;
        text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
      }

      /* Sword Indicator - Bottom Right */
      .hud-sword {
        position: absolute;
        bottom: 30px;
        right: 30px;
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #3d3d3d 0%, #2a2a2a 100%);
        border-radius: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          inset 0 2px 0 rgba(255, 255, 255, 0.1);
        border: 3px solid rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
      }

      .hud-sword.inactive {
        filter: grayscale(100%) brightness(0.5);
        opacity: 0.6;
      }

      .hud-sword.active {
        background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
        border-color: #ffcc00;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          0 0 15px rgba(255, 215, 0, 0.5),
          inset 0 2px 0 rgba(255, 255, 255, 0.3);
        animation: sword-glow 2s ease-in-out infinite;
      }

      @keyframes sword-glow {
        0%, 100% { box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3), 0 0 15px rgba(255, 215, 0, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3); }
        50% { box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3), 0 0 25px rgba(255, 215, 0, 0.8), inset 0 2px 0 rgba(255, 255, 255, 0.3); }
      }

      /* Power-ups Container - Top Right */
      .hud-powerups {
        position: absolute;
        top: 20px;
        right: 20px;
        display: flex;
        flex-direction: row;
        gap: 10px;
      }

      .hud-powerup {
        position: relative;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #4a4a4a 0%, #2d2d2d 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          inset 0 2px 0 rgba(255, 255, 255, 0.1);
        border: 3px solid rgba(255, 255, 255, 0.2);
        overflow: hidden;
      }

      .hud-powerup-timer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: rgba(0, 0, 0, 0.5);
      }

      .hud-powerup-timer-fill {
        height: 100%;
        background: linear-gradient(90deg, #00ff88 0%, #00cc66 100%);
        transition: width 0.1s linear;
      }

      .hud-powerup.speed {
        border-color: #ffa500;
        box-shadow: 0 0 10px rgba(255, 165, 0, 0.5);
      }

      .hud-powerup.invisibility {
        border-color: #8b00ff;
        box-shadow: 0 0 10px rgba(139, 0, 255, 0.5);
      }

      .hud-powerup.shield {
        border-color: #00ffff;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      }

      .hud-powerup.freeze {
        border-color: #add8e6;
        box-shadow: 0 0 10px rgba(173, 216, 230, 0.5);
      }

      /* Shield Indicator (next to sword) */
      .hud-shield {
        position: absolute;
        bottom: 30px;
        right: 100px;
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #3d3d3d 0%, #2a2a2a 100%);
        border-radius: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          inset 0 2px 0 rgba(255, 255, 255, 0.1);
        border: 3px solid rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
      }

      .hud-shield.inactive {
        filter: grayscale(100%) brightness(0.5);
        opacity: 0.6;
      }

      .hud-shield.active {
        background: linear-gradient(135deg, #00ffff 0%, #00cccc 100%);
        border-color: #00ffff;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.3),
          0 0 15px rgba(0, 255, 255, 0.5),
          inset 0 2px 0 rgba(255, 255, 255, 0.3);
        animation: shield-glow 2s ease-in-out infinite;
      }

      @keyframes shield-glow {
        0%, 100% { box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3), 0 0 15px rgba(0, 255, 255, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3); }
        50% { box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3), 0 0 25px rgba(0, 255, 255, 0.8), inset 0 2px 0 rgba(255, 255, 255, 0.3); }
      }

      /* Hide HUD by default */
      #game-hud.hidden {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create the HUD DOM structure
   */
  private createHUD(): void {
    // Check if HUD already exists
    const existingHUD = document.getElementById('game-hud');
    if (existingHUD) {
      this.container = existingHUD as HTMLDivElement;
      this.cacheElements();
      return;
    }

    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'game-hud';
    this.container.className = 'hidden';

    // Create level indicator
    this.levelIndicator = document.createElement('div');
    this.levelIndicator.className = 'hud-level';
    this.levelIndicator.textContent = 'Level 1';
    this.container.appendChild(this.levelIndicator);

    // Create timer display
    this.timerDisplay = document.createElement('div');
    this.timerDisplay.className = 'hud-timer';
    this.timerDisplay.textContent = '00:00';
    this.container.appendChild(this.timerDisplay);

    // Create power-ups container
    this.powerUpsContainer = document.createElement('div');
    this.powerUpsContainer.className = 'hud-powerups';
    this.container.appendChild(this.powerUpsContainer);

    // Create sprint gauge label
    const sprintLabel = document.createElement('div');
    sprintLabel.className = 'hud-sprint-label';
    sprintLabel.textContent = 'SPRINT';
    this.container.appendChild(sprintLabel);

    // Create sprint gauge
    this.sprintGauge = document.createElement('div');
    this.sprintGauge.className = 'hud-sprint';
    this.sprintFill = document.createElement('div');
    this.sprintFill.className = 'hud-sprint-fill available';
    this.sprintFill.style.width = '100%';
    this.sprintGauge.appendChild(this.sprintFill);
    this.container.appendChild(this.sprintGauge);

    // Create shield indicator
    const shieldIndicator = document.createElement('div');
    shieldIndicator.className = 'hud-shield inactive';
    shieldIndicator.id = 'hud-shield';
    shieldIndicator.innerHTML = '&#x1F6E1;'; // Shield emoji
    this.container.appendChild(shieldIndicator);

    // Create sword indicator
    this.swordIndicator = document.createElement('div');
    this.swordIndicator.className = 'hud-sword inactive';
    this.swordIndicator.innerHTML = '&#x2694;'; // Crossed swords emoji
    this.container.appendChild(this.swordIndicator);

    // Append to body
    document.body.appendChild(this.container);
  }

  /**
   * Cache element references for existing HUD
   */
  private cacheElements(): void {
    if (!this.container) return;

    this.levelIndicator = this.container.querySelector('.hud-level');
    this.timerDisplay = this.container.querySelector('.hud-timer');
    this.sprintGauge = this.container.querySelector('.hud-sprint');
    this.sprintFill = this.container.querySelector('.hud-sprint-fill');
    this.swordIndicator = this.container.querySelector('.hud-sword');
    this.powerUpsContainer = this.container.querySelector('.hud-powerups');
  }

  /**
   * Format time as MM:SS
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get timer state based on remaining time
   */
  private getTimerState(timeRemaining: number): TimerState {
    if (timeRemaining <= 5) {
      return TimerState.CRITICAL;
    } else if (timeRemaining <= 10) {
      return TimerState.WARNING;
    }
    return TimerState.NORMAL;
  }

  /**
   * Update timer display and state
   */
  private updateTimer(timeRemaining: number): void {
    if (!this.timerDisplay) return;

    // Update time text
    this.timerDisplay.textContent = this.formatTime(timeRemaining);

    // Get new state
    const newState = this.getTimerState(timeRemaining);

    // Update CSS classes if state changed
    if (newState !== this.currentTimerState) {
      this.timerDisplay.classList.remove('warning', 'critical');

      if (newState === TimerState.WARNING) {
        this.timerDisplay.classList.add('warning');
      } else if (newState === TimerState.CRITICAL) {
        this.timerDisplay.classList.add('critical');
      }

      this.currentTimerState = newState;
    }
  }

  /**
   * Update sprint gauge display
   */
  private updateSprintGauge(sprintPercent: number): void {
    if (!this.sprintFill) return;

    // Clamp percentage
    const percent = Math.max(0, Math.min(1, sprintPercent)) * 100;

    // Update width
    this.sprintFill.style.width = `${percent}%`;

    // Update color class based on level
    this.sprintFill.classList.remove('available', 'low', 'empty');

    if (percent <= 0) {
      this.sprintFill.classList.add('empty');
    } else if (percent <= 30) {
      this.sprintFill.classList.add('low');
    } else {
      this.sprintFill.classList.add('available');
    }
  }

  /**
   * Update level indicator
   */
  private updateLevel(level: number): void {
    if (!this.levelIndicator) return;
    this.levelIndicator.textContent = `Level ${level}`;
  }

  /**
   * Update sword indicator
   */
  private updateSwordIndicator(hasSword: boolean): void {
    if (!this.swordIndicator) return;

    this.swordIndicator.classList.remove('active', 'inactive');
    this.swordIndicator.classList.add(hasSword ? 'active' : 'inactive');
  }

  /**
   * Update shield indicator
   */
  private updateShieldIndicator(hasShield: boolean): void {
    const shieldElement = document.getElementById('hud-shield');
    if (!shieldElement) return;

    shieldElement.classList.remove('active', 'inactive');
    shieldElement.classList.add(hasShield ? 'active' : 'inactive');
  }

  /**
   * Get icon for power-up type
   */
  private getPowerUpIcon(type: string): string {
    switch (type) {
      case 'SPEED_BOOST':
      case PowerUpType.SPEED_BOOST:
        return POWER_UP_VISUALS[PowerUpType.SPEED_BOOST].icon;
      case 'INVISIBILITY':
      case PowerUpType.INVISIBILITY:
        return POWER_UP_VISUALS[PowerUpType.INVISIBILITY].icon;
      case 'SHIELD':
      case PowerUpType.SHIELD:
        return POWER_UP_VISUALS[PowerUpType.SHIELD].icon;
      case 'FREEZE':
      case PowerUpType.FREEZE:
        return POWER_UP_VISUALS[PowerUpType.FREEZE].icon;
      default:
        return '?';
    }
  }

  /**
   * Get CSS class for power-up type
   */
  private getPowerUpClass(type: string): string {
    switch (type) {
      case 'SPEED_BOOST':
      case PowerUpType.SPEED_BOOST:
        return 'speed';
      case 'INVISIBILITY':
      case PowerUpType.INVISIBILITY:
        return 'invisibility';
      case 'SHIELD':
      case PowerUpType.SHIELD:
        return 'shield';
      case 'FREEZE':
      case PowerUpType.FREEZE:
        return 'freeze';
      default:
        return '';
    }
  }

  /**
   * Update active power-ups display
   */
  private updatePowerUps(
    activeEffects: Array<{ type: string; remainingTime: number; duration: number }>
  ): void {
    if (!this.powerUpsContainer) return;

    // Clear existing power-up elements
    this.powerUpsContainer.innerHTML = '';

    // Create element for each active effect
    for (const effect of activeEffects) {
      const powerUpElement = document.createElement('div');
      powerUpElement.className = `hud-powerup ${this.getPowerUpClass(effect.type)}`;

      // Icon
      const iconSpan = document.createElement('span');
      iconSpan.textContent = this.getPowerUpIcon(effect.type);
      powerUpElement.appendChild(iconSpan);

      // Timer bar
      const timerBar = document.createElement('div');
      timerBar.className = 'hud-powerup-timer';
      const timerFill = document.createElement('div');
      timerFill.className = 'hud-powerup-timer-fill';
      const progress = (effect.remainingTime / effect.duration) * 100;
      timerFill.style.width = `${progress}%`;
      timerBar.appendChild(timerFill);
      powerUpElement.appendChild(timerBar);

      this.powerUpsContainer.appendChild(powerUpElement);
    }
  }

  /**
   * Update all HUD elements with current game data
   */
  update(gameData: HUDData): void {
    if (!this.isVisible) return;

    this.updateLevel(gameData.level);
    this.updateTimer(gameData.timeRemaining);
    this.updateSprintGauge(gameData.sprintPercent);
    this.updateSwordIndicator(gameData.hasSword);
    this.updateShieldIndicator(gameData.hasShield);
    this.updatePowerUps(gameData.activeEffects);
  }

  /**
   * Show the HUD
   */
  show(): void {
    if (!this.container) {
      this.createHUD();
    }

    if (this.container) {
      this.container.classList.remove('hidden');
      this.isVisible = true;
    }
  }

  /**
   * Hide the HUD
   */
  hide(): void {
    if (this.container) {
      this.container.classList.add('hidden');
      this.isVisible = false;
    }
  }

  /**
   * Check if HUD is currently visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Clean up HUD resources
   */
  dispose(): void {
    // Cancel any animation
    if (this.pulseAnimationId !== null) {
      cancelAnimationFrame(this.pulseAnimationId);
      this.pulseAnimationId = null;
    }

    // Remove HUD from DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    // Remove styles
    const styles = document.getElementById('meerkat-hud-styles');
    if (styles && styles.parentNode) {
      styles.parentNode.removeChild(styles);
    }

    // Clear references
    this.container = null;
    this.levelIndicator = null;
    this.timerDisplay = null;
    this.sprintGauge = null;
    this.sprintFill = null;
    this.swordIndicator = null;
    this.powerUpsContainer = null;
    this.isVisible = false;
  }
}
