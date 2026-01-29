/**
 * Level Complete Screen for Meerkat Maze Runner
 * Displays level completion stats and next level option
 */

export interface LevelCompleteData {
  level: number;
  timeRemaining: number;
  zombiesKilled: number;
  powerUpsCollected: number;
}

export interface LevelCompleteCallbacks {
  onNextLevel?: () => void;
}

/**
 * Level complete screen with stats display
 */
export class LevelCompleteScreen {
  private container: HTMLElement | null;
  private screenElement: HTMLElement | null = null;
  private callbacks: LevelCompleteCallbacks;

  constructor(callbacks: LevelCompleteCallbacks = {}) {
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
    this.screenElement.className = 'levelcomplete-overlay hidden';
    this.screenElement.innerHTML = `
      <style>
        .levelcomplete-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(5px);
          z-index: 200;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .levelcomplete-overlay.hidden {
          display: none;
        }

        .levelcomplete-container {
          background: linear-gradient(180deg, #2d4a2d 0%, #1a3d1a 100%);
          border-radius: 20px;
          padding: 40px 50px;
          box-shadow:
            0 0 0 4px #0f2d0f,
            0 0 40px rgba(74, 222, 128, 0.3),
            0 10px 40px rgba(0, 0, 0, 0.5);
          text-align: center;
          min-width: 350px;
          animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .levelcomplete-trophy {
          font-size: 70px;
          margin-bottom: 10px;
          animation: bounce 1s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .levelcomplete-title {
          font-size: 42px;
          font-weight: bold;
          color: #4ade80;
          text-shadow:
            3px 3px 0 #0f2d0f,
            0 0 20px rgba(74, 222, 128, 0.5);
          margin: 0 0 10px 0;
          letter-spacing: 2px;
        }

        .levelcomplete-subtitle {
          font-size: 18px;
          color: #a8d4a8;
          margin-bottom: 30px;
        }

        .levelcomplete-stats {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 30px;
        }

        .levelcomplete-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .levelcomplete-stat:last-child {
          border-bottom: none;
        }

        .levelcomplete-stat-label {
          color: #a8d4a8;
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .levelcomplete-stat-icon {
          font-size: 20px;
        }

        .levelcomplete-stat-value {
          color: #f5e6c8;
          font-size: 22px;
          font-weight: bold;
        }

        .levelcomplete-bonus {
          color: #ffd700;
          font-size: 14px;
          margin-left: 8px;
        }

        .levelcomplete-stars {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 30px;
        }

        .levelcomplete-star {
          font-size: 40px;
          opacity: 0.3;
          transition: all 0.3s ease;
        }

        .levelcomplete-star.earned {
          opacity: 1;
          animation: starPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation-fill-mode: backwards;
        }

        .levelcomplete-star:nth-child(1).earned { animation-delay: 0.2s; }
        .levelcomplete-star:nth-child(2).earned { animation-delay: 0.4s; }
        .levelcomplete-star:nth-child(3).earned { animation-delay: 0.6s; }

        @keyframes starPop {
          0% { transform: scale(0) rotate(-180deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        .levelcomplete-btn {
          padding: 18px 50px;
          font-size: 20px;
          font-weight: bold;
          border: none;
          border-radius: 15px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 2px;
          background: linear-gradient(180deg, #4ade80 0%, #22c55e 100%);
          color: #0f4d1a;
          box-shadow:
            0 6px 0 #15803d,
            0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .levelcomplete-btn:hover {
          transform: translateY(-3px);
          box-shadow:
            0 9px 0 #15803d,
            0 12px 25px rgba(0, 0, 0, 0.35);
        }

        .levelcomplete-btn:active {
          transform: translateY(2px);
          box-shadow:
            0 3px 0 #15803d,
            0 5px 10px rgba(0, 0, 0, 0.25);
        }

        .levelcomplete-confetti {
          position: absolute;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          animation: fall 3s ease-in-out infinite;
        }

        @keyframes fall {
          0% {
            transform: translateY(-100px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      </style>

      <div class="levelcomplete-confetti"></div>

      <div class="levelcomplete-container">
        <div class="levelcomplete-trophy">🏆</div>
        <h2 class="levelcomplete-title">Level <span class="level-number">1</span> Complete!</h2>
        <p class="levelcomplete-subtitle">Excellent work, maze runner!</p>

        <div class="levelcomplete-stars">
          <span class="levelcomplete-star">⭐</span>
          <span class="levelcomplete-star">⭐</span>
          <span class="levelcomplete-star">⭐</span>
        </div>

        <div class="levelcomplete-stats">
          <div class="levelcomplete-stat">
            <span class="levelcomplete-stat-label">
              <span class="levelcomplete-stat-icon">⏱️</span>
              Time Remaining
            </span>
            <span class="levelcomplete-stat-value time-value">0:00</span>
          </div>
          <div class="levelcomplete-stat">
            <span class="levelcomplete-stat-label">
              <span class="levelcomplete-stat-icon">💀</span>
              Zombies Defeated
            </span>
            <span class="levelcomplete-stat-value kills-value">0</span>
          </div>
          <div class="levelcomplete-stat">
            <span class="levelcomplete-stat-label">
              <span class="levelcomplete-stat-icon">✨</span>
              Power-ups Collected
            </span>
            <span class="levelcomplete-stat-value powerups-value">0</span>
          </div>
        </div>

        <button class="levelcomplete-btn">Next Level</button>
      </div>
    `;

    this.setupEventListeners();
    this.container.appendChild(this.screenElement);
  }

  private setupEventListeners(): void {
    if (!this.screenElement) return;

    const nextLevelBtn = this.screenElement.querySelector('.levelcomplete-btn');

    nextLevelBtn?.addEventListener('click', () => {
      this.callbacks.onNextLevel?.();
    });
  }

  /**
   * Create confetti pieces
   */
  private createConfetti(): void {
    if (!this.screenElement) return;

    const confettiContainer = this.screenElement.querySelector('.levelcomplete-confetti');
    if (!confettiContainer) return;

    // Clear existing confetti
    confettiContainer.innerHTML = '';

    const colors = ['#4ade80', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa'];
    const shapes = ['🎉', '🎊', '✨', '⭐', '🌟'];

    for (let i = 0; i < 30; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 3}s`;
      piece.style.animationDuration = `${2 + Math.random() * 2}s`;

      if (Math.random() > 0.5) {
        piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        piece.style.fontSize = `${15 + Math.random() * 15}px`;
      } else {
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
      }

      confettiContainer.appendChild(piece);
    }
  }

  /**
   * Calculate number of stars earned based on performance
   */
  private calculateStars(data: LevelCompleteData): number {
    let stars = 1; // Always get at least 1 star for completing

    // Bonus star for having time remaining
    if (data.timeRemaining > 30) {
      stars++;
    }

    // Bonus star for killing zombies or collecting power-ups
    if (data.zombiesKilled >= 3 || data.powerUpsCollected >= 2) {
      stars++;
    }

    return Math.min(stars, 3);
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
   * Show the level complete screen with data
   */
  show(data: LevelCompleteData): void {
    if (!this.screenElement) return;

    // Update level number
    const levelNumber = this.screenElement.querySelector('.level-number');
    if (levelNumber) levelNumber.textContent = data.level.toString();

    // Update stats
    const timeValue = this.screenElement.querySelector('.time-value');
    const killsValue = this.screenElement.querySelector('.kills-value');
    const powerupsValue = this.screenElement.querySelector('.powerups-value');

    if (timeValue) timeValue.textContent = this.formatTime(data.timeRemaining);
    if (killsValue) killsValue.textContent = data.zombiesKilled.toString();
    if (powerupsValue) powerupsValue.textContent = data.powerUpsCollected.toString();

    // Update stars
    const stars = this.screenElement.querySelectorAll('.levelcomplete-star');
    const earnedStars = this.calculateStars(data);
    stars.forEach((star, index) => {
      if (index < earnedStars) {
        star.classList.add('earned');
      } else {
        star.classList.remove('earned');
      }
    });

    // Create confetti
    this.createConfetti();

    this.screenElement.classList.remove('hidden');
  }

  /**
   * Hide the level complete screen
   */
  hide(): void {
    if (this.screenElement) {
      this.screenElement.classList.add('hidden');

      // Clear confetti when hiding
      const confettiContainer = this.screenElement.querySelector('.levelcomplete-confetti');
      if (confettiContainer) {
        confettiContainer.innerHTML = '';
      }
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
  setCallbacks(callbacks: LevelCompleteCallbacks): void {
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
