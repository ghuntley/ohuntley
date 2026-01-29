/**
 * Main Menu for Meerkat Maze Runner
 * Displays the title screen with navigation options
 */

export interface MainMenuCallbacks {
  onPlay?: () => void;
  onContinue?: () => void;
  onLeaderboard?: () => void;
  onSettings?: () => void;
  onHowToPlay?: () => void;
}

/**
 * Main menu screen with game title and navigation buttons
 */
export class MainMenu {
  private container: HTMLElement | null;
  private menuElement: HTMLElement | null = null;
  private callbacks: MainMenuCallbacks;
  private hasProgress: boolean;

  constructor(callbacks: MainMenuCallbacks = {}, hasProgress: boolean = false) {
    this.container = document.getElementById('game-container');
    this.callbacks = callbacks;
    this.hasProgress = hasProgress;
    this.createMenu();
  }

  /**
   * Check if saved progress exists in localStorage
   */
  static checkForSavedProgress(): boolean {
    try {
      const savedGame = localStorage.getItem('meerkat-maze-runner-save');
      return savedGame !== null;
    } catch {
      return false;
    }
  }

  /**
   * Update the hasProgress state and refresh the menu
   */
  setHasProgress(hasProgress: boolean): void {
    this.hasProgress = hasProgress;
    if (this.menuElement) {
      const continueBtn = this.menuElement.querySelector('.continue-btn') as HTMLElement;
      if (continueBtn) {
        continueBtn.style.display = hasProgress ? 'block' : 'none';
      }
    }
  }

  private createMenu(): void {
    if (!this.container) {
      console.error('Game container not found');
      return;
    }

    this.menuElement = document.createElement('div');
    this.menuElement.className = 'main-menu-overlay';
    this.menuElement.innerHTML = `
      <style>
        .main-menu-overlay {
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
          z-index: 100;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .main-menu-overlay.hidden {
          display: none;
        }

        .main-menu-title-container {
          text-align: center;
          margin-bottom: 50px;
        }

        .main-menu-emoji {
          font-size: 80px;
          margin-bottom: 20px;
          animation: bounce 2s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }

        .main-menu-title {
          font-size: 56px;
          font-weight: bold;
          color: #f5e6c8;
          text-shadow:
            3px 3px 0 #5a3d1a,
            6px 6px 0 rgba(0, 0, 0, 0.3);
          margin: 0;
          letter-spacing: 2px;
        }

        .main-menu-subtitle {
          font-size: 18px;
          color: #a8d4a8;
          margin-top: 10px;
          font-style: italic;
        }

        .main-menu-buttons {
          display: flex;
          flex-direction: column;
          gap: 15px;
          min-width: 280px;
        }

        .main-menu-btn {
          padding: 18px 40px;
          font-size: 20px;
          font-weight: bold;
          border: none;
          border-radius: 15px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow:
            0 6px 0 rgba(0, 0, 0, 0.3),
            0 8px 15px rgba(0, 0, 0, 0.2);
        }

        .main-menu-btn:hover {
          transform: translateY(-3px);
          box-shadow:
            0 9px 0 rgba(0, 0, 0, 0.3),
            0 12px 20px rgba(0, 0, 0, 0.25);
        }

        .main-menu-btn:active {
          transform: translateY(2px);
          box-shadow:
            0 3px 0 rgba(0, 0, 0, 0.3),
            0 5px 10px rgba(0, 0, 0, 0.2);
        }

        .play-btn {
          background: linear-gradient(180deg, #4ade80 0%, #22c55e 100%);
          color: #0f4d1a;
        }

        .play-btn:hover {
          background: linear-gradient(180deg, #5aee90 0%, #32d56e 100%);
        }

        .continue-btn {
          background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
          color: #1e3a5f;
        }

        .continue-btn:hover {
          background: linear-gradient(180deg, #70b5ff 0%, #4b92ff 100%);
        }

        .leaderboard-btn {
          background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
          color: #5c3d0a;
        }

        .leaderboard-btn:hover {
          background: linear-gradient(180deg, #fccd44 0%, #ffae1b 100%);
        }

        .howtoplay-btn {
          background: linear-gradient(180deg, #c084fc 0%, #a855f7 100%);
          color: #3d1a5c;
        }

        .howtoplay-btn:hover {
          background: linear-gradient(180deg, #d094ff 0%, #b865ff 100%);
        }

        .settings-btn {
          background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
          color: #1e293b;
        }

        .settings-btn:hover {
          background: linear-gradient(180deg, #a4b3c8 0%, #7484ab 100%);
        }

        .main-menu-footer {
          position: absolute;
          bottom: 20px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        .main-menu-decorations {
          position: absolute;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .leaf {
          position: absolute;
          font-size: 30px;
          opacity: 0.3;
          animation: float 6s ease-in-out infinite;
        }

        .leaf:nth-child(1) { top: 10%; left: 5%; animation-delay: 0s; }
        .leaf:nth-child(2) { top: 20%; right: 10%; animation-delay: 1s; }
        .leaf:nth-child(3) { bottom: 30%; left: 8%; animation-delay: 2s; }
        .leaf:nth-child(4) { bottom: 15%; right: 5%; animation-delay: 3s; }
        .leaf:nth-child(5) { top: 40%; left: 3%; animation-delay: 4s; }
        .leaf:nth-child(6) { top: 50%; right: 7%; animation-delay: 5s; }

        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
      </style>

      <div class="main-menu-decorations">
        <div class="leaf">🌿</div>
        <div class="leaf">🍃</div>
        <div class="leaf">🌿</div>
        <div class="leaf">🍃</div>
        <div class="leaf">🌿</div>
        <div class="leaf">🍃</div>
      </div>

      <div class="main-menu-title-container">
        <div class="main-menu-emoji">🦡</div>
        <h1 class="main-menu-title">Meerkat Maze Runner</h1>
        <p class="main-menu-subtitle">Survive the garden labyrinth!</p>
      </div>

      <div class="main-menu-buttons">
        <button class="main-menu-btn play-btn">Play</button>
        <button class="main-menu-btn continue-btn" style="display: ${this.hasProgress ? 'block' : 'none'}">Continue</button>
        <button class="main-menu-btn leaderboard-btn">Leaderboard</button>
        <button class="main-menu-btn settings-btn">Settings</button>
        <button class="main-menu-btn howtoplay-btn">How to Play</button>
      </div>

      <div class="main-menu-footer">
        Use WASD or Arrow Keys to move | Space to attack
      </div>
    `;

    this.setupEventListeners();
    this.container.appendChild(this.menuElement);
  }

  private setupEventListeners(): void {
    if (!this.menuElement) return;

    const playBtn = this.menuElement.querySelector('.play-btn');
    const continueBtn = this.menuElement.querySelector('.continue-btn');
    const leaderboardBtn = this.menuElement.querySelector('.leaderboard-btn');
    const settingsBtn = this.menuElement.querySelector('.settings-btn');
    const howToPlayBtn = this.menuElement.querySelector('.howtoplay-btn');

    playBtn?.addEventListener('click', () => {
      this.callbacks.onPlay?.();
    });

    continueBtn?.addEventListener('click', () => {
      this.callbacks.onContinue?.();
    });

    leaderboardBtn?.addEventListener('click', () => {
      this.callbacks.onLeaderboard?.();
    });

    settingsBtn?.addEventListener('click', () => {
      this.callbacks.onSettings?.();
    });

    howToPlayBtn?.addEventListener('click', () => {
      this.callbacks.onHowToPlay?.();
    });
  }

  /**
   * Show the main menu
   */
  show(): void {
    if (this.menuElement) {
      this.menuElement.classList.remove('hidden');
    }
  }

  /**
   * Hide the main menu
   */
  hide(): void {
    if (this.menuElement) {
      this.menuElement.classList.add('hidden');
    }
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: MainMenuCallbacks): void {
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
