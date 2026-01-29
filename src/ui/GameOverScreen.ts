/**
 * Game Over Screen for Meerkat Maze Runner
 * Displays final stats and high score entry option
 */

export interface GameOverData {
  finalLevel: number;
  totalTimeSurvived: number;
  zombiesKilled: number;
  isHighScore?: boolean;
}

export interface GameOverCallbacks {
  onTryAgain?: () => void;
  onMainMenu?: () => void;
  onHighScoreSubmit?: (name: string, score: number) => void;
}

/**
 * Game over screen with stats and high score entry
 */
export class GameOverScreen {
  private container: HTMLElement | null;
  private screenElement: HTMLElement | null = null;
  private callbacks: GameOverCallbacks;
  private currentData: GameOverData | null = null;

  constructor(callbacks: GameOverCallbacks = {}) {
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
    this.screenElement.className = 'gameover-overlay hidden';
    this.screenElement.innerHTML = `
      <style>
        .gameover-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, rgba(139, 0, 0, 0.9) 0%, rgba(50, 0, 0, 0.95) 100%);
          z-index: 200;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .gameover-overlay.hidden {
          display: none;
        }

        .gameover-container {
          background: linear-gradient(180deg, #4a2020 0%, #2d1515 100%);
          border-radius: 20px;
          padding: 40px 50px;
          box-shadow:
            0 0 0 4px #1a0a0a,
            0 0 30px rgba(255, 0, 0, 0.3),
            0 10px 40px rgba(0, 0, 0, 0.5);
          text-align: center;
          min-width: 350px;
        }

        .gameover-skull {
          font-size: 60px;
          margin-bottom: 10px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .gameover-title {
          font-size: 52px;
          font-weight: bold;
          color: #ff4444;
          text-shadow:
            3px 3px 0 #2d0a0a,
            0 0 20px rgba(255, 0, 0, 0.5);
          margin: 0 0 30px 0;
          letter-spacing: 3px;
        }

        .gameover-stats {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 25px;
        }

        .gameover-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .gameover-stat:last-child {
          border-bottom: none;
        }

        .gameover-stat-label {
          color: #c0a0a0;
          font-size: 16px;
        }

        .gameover-stat-value {
          color: #f5e6c8;
          font-size: 20px;
          font-weight: bold;
        }

        .gameover-highscore {
          background: linear-gradient(180deg, #3d3d1a 0%, #2d2d0a 100%);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 25px;
          display: none;
        }

        .gameover-highscore.visible {
          display: block;
        }

        .gameover-highscore-title {
          color: #ffd700;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        .gameover-highscore-input {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: center;
        }

        .gameover-name-input {
          padding: 10px 15px;
          font-size: 16px;
          border: 2px solid #5a5a1a;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.4);
          color: #f5e6c8;
          width: 150px;
          text-align: center;
          text-transform: uppercase;
        }

        .gameover-name-input:focus {
          outline: none;
          border-color: #ffd700;
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
        }

        .gameover-submit-btn {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: bold;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          background: linear-gradient(180deg, #ffd700 0%, #daa520 100%);
          color: #3d3d0a;
          transition: all 0.2s ease;
          text-transform: uppercase;
        }

        .gameover-submit-btn:hover {
          background: linear-gradient(180deg, #ffe033 0%, #eab530 100%);
          transform: translateY(-2px);
        }

        .gameover-submit-btn:disabled {
          background: #666;
          color: #999;
          cursor: not-allowed;
          transform: none;
        }

        .gameover-char-count {
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
          margin-top: 8px;
        }

        .gameover-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .gameover-btn {
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

        .gameover-btn:hover {
          transform: translateY(-2px);
          box-shadow:
            0 6px 0 rgba(0, 0, 0, 0.3),
            0 8px 15px rgba(0, 0, 0, 0.25);
        }

        .gameover-btn:active {
          transform: translateY(2px);
          box-shadow:
            0 2px 0 rgba(0, 0, 0, 0.3),
            0 3px 8px rgba(0, 0, 0, 0.2);
        }

        .tryagain-btn {
          background: linear-gradient(180deg, #4ade80 0%, #22c55e 100%);
          color: #0f4d1a;
        }

        .tryagain-btn:hover {
          background: linear-gradient(180deg, #5aee90 0%, #32d56e 100%);
        }

        .mainmenu-btn {
          background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
          color: #1e293b;
        }

        .mainmenu-btn:hover {
          background: linear-gradient(180deg, #a4b3c8 0%, #74849b 100%);
        }
      </style>

      <div class="gameover-container">
        <div class="gameover-skull">💀</div>
        <h2 class="gameover-title">Game Over</h2>

        <div class="gameover-stats">
          <div class="gameover-stat">
            <span class="gameover-stat-label">Final Level</span>
            <span class="gameover-stat-value level-value">1</span>
          </div>
          <div class="gameover-stat">
            <span class="gameover-stat-label">Time Survived</span>
            <span class="gameover-stat-value time-value">0:00</span>
          </div>
          <div class="gameover-stat">
            <span class="gameover-stat-label">Zombies Killed</span>
            <span class="gameover-stat-value kills-value">0</span>
          </div>
        </div>

        <div class="gameover-highscore">
          <div class="gameover-highscore-title">🏆 New High Score!</div>
          <div class="gameover-highscore-input">
            <input type="text" class="gameover-name-input" placeholder="YOUR NAME" maxlength="10" minlength="3" />
            <button class="gameover-submit-btn">Submit</button>
          </div>
          <div class="gameover-char-count">3-10 characters</div>
        </div>

        <div class="gameover-buttons">
          <button class="gameover-btn tryagain-btn">Try Again</button>
          <button class="gameover-btn mainmenu-btn">Main Menu</button>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.container.appendChild(this.screenElement);
  }

  private setupEventListeners(): void {
    if (!this.screenElement) return;

    const tryAgainBtn = this.screenElement.querySelector('.tryagain-btn');
    const mainMenuBtn = this.screenElement.querySelector('.mainmenu-btn');
    const submitBtn = this.screenElement.querySelector('.gameover-submit-btn') as HTMLButtonElement;
    const nameInput = this.screenElement.querySelector('.gameover-name-input') as HTMLInputElement;

    tryAgainBtn?.addEventListener('click', () => {
      this.callbacks.onTryAgain?.();
    });

    mainMenuBtn?.addEventListener('click', () => {
      this.callbacks.onMainMenu?.();
    });

    // Handle name input validation
    nameInput?.addEventListener('input', () => {
      const value = nameInput.value.trim();
      if (submitBtn) {
        submitBtn.disabled = value.length < 3 || value.length > 10;
      }
    });

    // Handle submit
    submitBtn?.addEventListener('click', () => {
      const name = nameInput?.value.trim();
      if (name && name.length >= 3 && name.length <= 10 && this.currentData) {
        const score = this.calculateScore(this.currentData);
        this.callbacks.onHighScoreSubmit?.(name, score);
        // Disable input after submission
        if (nameInput) nameInput.disabled = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitted!';
      }
    });

    // Handle enter key in input
    nameInput?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !submitBtn?.disabled) {
        submitBtn?.click();
      }
    });
  }

  /**
   * Calculate score from game data
   */
  private calculateScore(data: GameOverData): number {
    return (data.finalLevel * 1000) + (data.zombiesKilled * 100) + Math.floor(data.totalTimeSurvived);
  }

  /**
   * Format time in seconds to MM:SS format
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Show the game over screen with data
   */
  show(data: GameOverData): void {
    if (!this.screenElement) return;

    this.currentData = data;

    // Update stats
    const levelValue = this.screenElement.querySelector('.level-value');
    const timeValue = this.screenElement.querySelector('.time-value');
    const killsValue = this.screenElement.querySelector('.kills-value');
    const highscoreSection = this.screenElement.querySelector('.gameover-highscore');
    const nameInput = this.screenElement.querySelector('.gameover-name-input') as HTMLInputElement;
    const submitBtn = this.screenElement.querySelector('.gameover-submit-btn') as HTMLButtonElement;

    if (levelValue) levelValue.textContent = data.finalLevel.toString();
    if (timeValue) timeValue.textContent = this.formatTime(data.totalTimeSurvived);
    if (killsValue) killsValue.textContent = data.zombiesKilled.toString();

    // Show/hide high score input
    if (highscoreSection) {
      if (data.isHighScore) {
        highscoreSection.classList.add('visible');
        // Reset input state
        if (nameInput) {
          nameInput.value = '';
          nameInput.disabled = false;
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submit';
        }
      } else {
        highscoreSection.classList.remove('visible');
      }
    }

    this.screenElement.classList.remove('hidden');
  }

  /**
   * Hide the game over screen
   */
  hide(): void {
    if (this.screenElement) {
      this.screenElement.classList.add('hidden');
    }
  }

  /**
   * Check if the screen is currently visible
   */
  isVisible(): boolean {
    return this.screenElement ? !this.screenElement.classList.contains('hidden') : false;
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: GameOverCallbacks): void {
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
