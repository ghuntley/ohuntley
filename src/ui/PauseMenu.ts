/**
 * Pause Menu for Meerkat Maze Runner
 * Displays when game is paused with resume/restart/quit options
 */

export interface PauseMenuCallbacks {
  onResume?: () => void;
  onRestart?: () => void;
  onQuit?: () => void;
}

/**
 * Pause menu overlay with game control options
 */
export class PauseMenu {
  private container: HTMLElement | null;
  private menuElement: HTMLElement | null = null;
  private callbacks: PauseMenuCallbacks;

  constructor(callbacks: PauseMenuCallbacks = {}) {
    this.container = document.getElementById('game-container');
    this.callbacks = callbacks;
    this.createMenu();
  }

  private createMenu(): void {
    if (!this.container) {
      console.error('Game container not found');
      return;
    }

    this.menuElement = document.createElement('div');
    this.menuElement.className = 'pause-menu-overlay hidden';
    this.menuElement.innerHTML = `
      <style>
        .pause-menu-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(5px);
          z-index: 150;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .pause-menu-overlay.hidden {
          display: none;
        }

        .pause-menu-container {
          background: linear-gradient(180deg, #3d5a3d 0%, #2d4a2d 100%);
          border-radius: 20px;
          padding: 40px 50px;
          box-shadow:
            0 0 0 4px #1a2d1a,
            0 10px 40px rgba(0, 0, 0, 0.5);
          text-align: center;
        }

        .pause-menu-title {
          font-size: 48px;
          font-weight: bold;
          color: #f5e6c8;
          text-shadow: 3px 3px 0 #2d1a0a;
          margin: 0 0 30px 0;
          letter-spacing: 3px;
        }

        .pause-menu-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 250px;
        }

        .pause-menu-btn {
          padding: 15px 35px;
          font-size: 18px;
          font-weight: bold;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow:
            0 4px 0 rgba(0, 0, 0, 0.3),
            0 6px 12px rgba(0, 0, 0, 0.2);
        }

        .pause-menu-btn:hover {
          transform: translateY(-2px);
          box-shadow:
            0 6px 0 rgba(0, 0, 0, 0.3),
            0 8px 15px rgba(0, 0, 0, 0.25);
        }

        .pause-menu-btn:active {
          transform: translateY(2px);
          box-shadow:
            0 2px 0 rgba(0, 0, 0, 0.3),
            0 3px 8px rgba(0, 0, 0, 0.2);
        }

        .resume-btn {
          background: linear-gradient(180deg, #4ade80 0%, #22c55e 100%);
          color: #0f4d1a;
        }

        .resume-btn:hover {
          background: linear-gradient(180deg, #5aee90 0%, #32d56e 100%);
        }

        .restart-btn {
          background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
          color: #5c3d0a;
        }

        .restart-btn:hover {
          background: linear-gradient(180deg, #fccd44 0%, #ffae1b 100%);
        }

        .quit-btn {
          background: linear-gradient(180deg, #f87171 0%, #ef4444 100%);
          color: #5c1a1a;
        }

        .quit-btn:hover {
          background: linear-gradient(180deg, #ff8181 0%, #ff5454 100%);
        }

        .pause-menu-hint {
          margin-top: 20px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
        }
      </style>

      <div class="pause-menu-container">
        <h2 class="pause-menu-title">Paused</h2>

        <div class="pause-menu-buttons">
          <button class="pause-menu-btn resume-btn">Resume</button>
          <button class="pause-menu-btn restart-btn">Restart Level</button>
          <button class="pause-menu-btn quit-btn">Quit to Menu</button>
        </div>

        <p class="pause-menu-hint">Press ESC to resume</p>
      </div>
    `;

    this.setupEventListeners();
    this.container.appendChild(this.menuElement);
  }

  private setupEventListeners(): void {
    if (!this.menuElement) return;

    const resumeBtn = this.menuElement.querySelector('.resume-btn');
    const restartBtn = this.menuElement.querySelector('.restart-btn');
    const quitBtn = this.menuElement.querySelector('.quit-btn');

    resumeBtn?.addEventListener('click', () => {
      this.callbacks.onResume?.();
    });

    restartBtn?.addEventListener('click', () => {
      this.callbacks.onRestart?.();
    });

    quitBtn?.addEventListener('click', () => {
      this.callbacks.onQuit?.();
    });

    // Handle ESC key to resume
    this.handleKeyPress = this.handleKeyPress.bind(this);
    document.addEventListener('keydown', this.handleKeyPress);
  }

  private handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.menuElement && !this.menuElement.classList.contains('hidden')) {
      this.callbacks.onResume?.();
    }
  }

  /**
   * Show the pause menu
   */
  show(): void {
    if (this.menuElement) {
      this.menuElement.classList.remove('hidden');
    }
  }

  /**
   * Hide the pause menu
   */
  hide(): void {
    if (this.menuElement) {
      this.menuElement.classList.add('hidden');
    }
  }

  /**
   * Check if the menu is currently visible
   */
  isVisible(): boolean {
    return this.menuElement ? !this.menuElement.classList.contains('hidden') : false;
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: PauseMenuCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Clean up and remove the menu from DOM
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyPress);
    if (this.menuElement && this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
      this.menuElement = null;
    }
  }
}
