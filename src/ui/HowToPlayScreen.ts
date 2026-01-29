/**
 * How to Play Screen for Meerkat Maze Runner
 * Tutorial/instructions overlay
 */

export interface HowToPlayCallbacks {
  onBack?: () => void;
}

/**
 * How to Play screen with game instructions
 */
export class HowToPlayScreen {
  private container: HTMLElement | null;
  private screenElement: HTMLElement | null = null;
  private callbacks: HowToPlayCallbacks;

  constructor(callbacks: HowToPlayCallbacks = {}) {
    this.container = document.getElementById('game-container');
    this.callbacks = callbacks;
    this.createScreen();
  }

  private createScreen(): void {
    if (!this.container) {
      console.error('Game container not found');
      return;
    }

    this.screenElement = document.createElement('div');
    this.screenElement.className = 'howtoplay-overlay hidden';
    this.screenElement.innerHTML = `
      <style>
        .howtoplay-overlay {
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
          overflow-y: auto;
          padding: 20px;
          box-sizing: border-box;
        }

        .howtoplay-overlay.hidden {
          display: none;
        }

        .howtoplay-container {
          background: rgba(0, 0, 0, 0.6);
          border-radius: 20px;
          padding: 30px 40px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .howtoplay-title {
          font-size: 36px;
          font-weight: bold;
          color: #f5e6c8;
          text-align: center;
          margin-bottom: 25px;
          text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
        }

        .howtoplay-section {
          margin-bottom: 25px;
        }

        .howtoplay-section-title {
          font-size: 22px;
          color: #4ade80;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .howtoplay-section-icon {
          font-size: 24px;
        }

        .howtoplay-content {
          color: #e5e5e5;
          font-size: 16px;
          line-height: 1.6;
        }

        .howtoplay-controls {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 10px;
        }

        .howtoplay-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .howtoplay-key {
          background: rgba(255, 255, 255, 0.15);
          padding: 6px 12px;
          border-radius: 6px;
          color: #fbbf24;
          font-weight: bold;
          font-size: 14px;
          min-width: 60px;
          text-align: center;
        }

        .howtoplay-key-action {
          color: #e5e5e5;
          font-size: 14px;
        }

        .howtoplay-powerups {
          display: grid;
          gap: 10px;
          margin-top: 10px;
        }

        .howtoplay-powerup {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 8px;
        }

        .howtoplay-powerup-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .powerup-speed { background: linear-gradient(135deg, #fbbf24, #f59e0b); }
        .powerup-shield { background: linear-gradient(135deg, #22d3ee, #06b6d4); }
        .powerup-invisible { background: linear-gradient(135deg, #a78bfa, #8b5cf6); }
        .powerup-freeze { background: linear-gradient(135deg, #93c5fd, #3b82f6); }
        .powerup-sprint { background: linear-gradient(135deg, #60a5fa, #2563eb); }

        .howtoplay-powerup-info {
          flex: 1;
        }

        .howtoplay-powerup-name {
          color: #f5e6c8;
          font-weight: bold;
          font-size: 15px;
        }

        .howtoplay-powerup-desc {
          color: #a8a8a8;
          font-size: 13px;
          margin-top: 2px;
        }

        .howtoplay-tip {
          background: rgba(74, 222, 128, 0.15);
          border-left: 4px solid #4ade80;
          padding: 12px 15px;
          margin-top: 10px;
          border-radius: 0 8px 8px 0;
        }

        .howtoplay-tip-title {
          color: #4ade80;
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 5px;
        }

        .howtoplay-tip-text {
          color: #d5d5d5;
          font-size: 14px;
        }

        .howtoplay-btn {
          padding: 15px 40px;
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
          margin-top: 25px;
          background: linear-gradient(180deg, #4ade80 0%, #22c55e 100%);
          color: #0f4d1a;
        }

        .howtoplay-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3);
          background: linear-gradient(180deg, #5aee90 0%, #32d56e 100%);
        }

        .howtoplay-btn:active {
          transform: translateY(2px);
          box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
        }

        @media (max-width: 500px) {
          .howtoplay-controls {
            grid-template-columns: 1fr;
          }

          .howtoplay-container {
            padding: 20px;
          }

          .howtoplay-title {
            font-size: 28px;
          }
        }
      </style>

      <div class="howtoplay-container">
        <h1 class="howtoplay-title">How to Play</h1>

        <div class="howtoplay-section">
          <h2 class="howtoplay-section-title">
            <span class="howtoplay-section-icon">🎯</span>
            Goal
          </h2>
          <p class="howtoplay-content">
            Navigate through the hedge maze and reach the glowing exit before time runs out!
            Avoid or defeat zombies along the way. Each level gets harder with larger mazes
            and more zombies.
          </p>
        </div>

        <div class="howtoplay-section">
          <h2 class="howtoplay-section-title">
            <span class="howtoplay-section-icon">🎮</span>
            Controls
          </h2>
          <div class="howtoplay-controls">
            <div class="howtoplay-control">
              <span class="howtoplay-key">WASD</span>
              <span class="howtoplay-key-action">Move</span>
            </div>
            <div class="howtoplay-control">
              <span class="howtoplay-key">Arrows</span>
              <span class="howtoplay-key-action">Move</span>
            </div>
            <div class="howtoplay-control">
              <span class="howtoplay-key">Shift</span>
              <span class="howtoplay-key-action">Sprint</span>
            </div>
            <div class="howtoplay-control">
              <span class="howtoplay-key">Space</span>
              <span class="howtoplay-key-action">Attack</span>
            </div>
            <div class="howtoplay-control">
              <span class="howtoplay-key">Esc</span>
              <span class="howtoplay-key-action">Pause</span>
            </div>
          </div>
          <p class="howtoplay-content" style="margin-top: 12px; font-size: 14px; color: #a8a8a8;">
            On mobile: Use the virtual joystick to move, and tap the action buttons for sprint and attack.
          </p>
        </div>

        <div class="howtoplay-section">
          <h2 class="howtoplay-section-title">
            <span class="howtoplay-section-icon">⚡</span>
            Power-ups
          </h2>
          <div class="howtoplay-powerups">
            <div class="howtoplay-powerup">
              <div class="howtoplay-powerup-icon powerup-speed">⚡</div>
              <div class="howtoplay-powerup-info">
                <div class="howtoplay-powerup-name">Speed Boost</div>
                <div class="howtoplay-powerup-desc">Move 50% faster for 8 seconds</div>
              </div>
            </div>
            <div class="howtoplay-powerup">
              <div class="howtoplay-powerup-icon powerup-shield">🛡</div>
              <div class="howtoplay-powerup-info">
                <div class="howtoplay-powerup-name">Shield</div>
                <div class="howtoplay-powerup-desc">Survive one zombie hit</div>
              </div>
            </div>
            <div class="howtoplay-powerup">
              <div class="howtoplay-powerup-icon powerup-invisible">👻</div>
              <div class="howtoplay-powerup-info">
                <div class="howtoplay-powerup-name">Invisibility</div>
                <div class="howtoplay-powerup-desc">Zombies can't see you for 5 seconds</div>
              </div>
            </div>
            <div class="howtoplay-powerup">
              <div class="howtoplay-powerup-icon powerup-freeze">❄</div>
              <div class="howtoplay-powerup-info">
                <div class="howtoplay-powerup-name">Freeze</div>
                <div class="howtoplay-powerup-desc">Stop all zombies for 4 seconds</div>
              </div>
            </div>
            <div class="howtoplay-powerup">
              <div class="howtoplay-powerup-icon powerup-sprint">🔋</div>
              <div class="howtoplay-powerup-info">
                <div class="howtoplay-powerup-name">Sprint Refill</div>
                <div class="howtoplay-powerup-desc">Instantly restore your sprint gauge</div>
              </div>
            </div>
          </div>
        </div>

        <div class="howtoplay-section">
          <h2 class="howtoplay-section-title">
            <span class="howtoplay-section-icon">🦡</span>
            Spectator Meerkats
          </h2>
          <p class="howtoplay-content">
            Watch for meerkats perched on the hedge walls! They'll warn you when zombies are nearby
            by getting agitated and making alarm calls. Use them as your early warning system!
          </p>
        </div>

        <div class="howtoplay-tip">
          <div class="howtoplay-tip-title">Pro Tip</div>
          <div class="howtoplay-tip-text">
            Find the sword early! It lets you fight back against zombies. Without it,
            you'll need to rely on evasion and power-ups to survive.
          </div>
        </div>

        <button class="howtoplay-btn back-btn">Got It!</button>
      </div>
    `;

    this.setupEventListeners();
    this.container.appendChild(this.screenElement);
  }

  private setupEventListeners(): void {
    if (!this.screenElement) return;

    const backBtn = this.screenElement.querySelector('.back-btn');
    backBtn?.addEventListener('click', () => {
      this.hide();
      this.callbacks.onBack?.();
    });
  }

  /**
   * Show the how to play screen
   */
  show(): void {
    if (this.screenElement) {
      this.screenElement.classList.remove('hidden');
    }
  }

  /**
   * Hide the how to play screen
   */
  hide(): void {
    if (this.screenElement) {
      this.screenElement.classList.add('hidden');
    }
  }

  /**
   * Check if screen is visible
   */
  isVisible(): boolean {
    return this.screenElement ? !this.screenElement.classList.contains('hidden') : false;
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: HowToPlayCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Clean up and remove the screen from DOM
   */
  destroy(): void {
    if (this.screenElement && this.screenElement.parentNode) {
      this.screenElement.parentNode.removeChild(this.screenElement);
      this.screenElement = null;
    }
  }
}
