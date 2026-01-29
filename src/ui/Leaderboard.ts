/**
 * Leaderboard system for Meerkat Maze Runner
 * Displays top 10 scores with LocalStorage persistence
 */

// ============================================
// Types & Interfaces
// ============================================

export interface LeaderboardEntry {
  name: string;
  level: number;
  time: number; // total survival time in seconds
  date: string; // ISO date string
}

export interface LeaderboardData {
  scores: LeaderboardEntry[];
}

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'meerkat-maze-leaderboard';
const MAX_ENTRIES = 10;
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 10;

// ============================================
// Leaderboard Class
// ============================================

/**
 * Leaderboard class manages the high score display and storage
 */
export class Leaderboard {
  private container: HTMLElement | null = null;
  private isVisible: boolean = false;

  /** Callback when back button is pressed */
  onBack?: () => void;

  constructor() {
    this.createContainer();
  }

  /**
   * Create the leaderboard container element
   */
  private createContainer(): void {
    // Check if container already exists
    if (document.getElementById('leaderboard-container')) {
      this.container = document.getElementById('leaderboard-container');
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'leaderboard-container';
    this.container.innerHTML = this.getStyles() + this.getHTML();
    this.container.style.display = 'none';
    document.body.appendChild(this.container);

    this.setupEventListeners();
  }

  /**
   * Get the CSS styles for the leaderboard
   */
  private getStyles(): string {
    return `
      <style>
        #leaderboard-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(0, 0, 0, 0.85);
          z-index: 2000;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .leaderboard-panel {
          background: linear-gradient(145deg, #2d2d44, #1a1a2e);
          border-radius: 20px;
          padding: 30px 40px;
          min-width: 400px;
          max-width: 90vw;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow:
            0 10px 40px rgba(0, 0, 0, 0.5),
            0 0 0 3px rgba(255, 200, 100, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          border: 2px solid #ffc864;
        }

        .leaderboard-title {
          text-align: center;
          color: #ffc864;
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 25px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
          letter-spacing: 2px;
        }

        .leaderboard-subtitle {
          text-align: center;
          color: #aaa;
          font-size: 14px;
          margin-top: -15px;
          margin-bottom: 20px;
        }

        .leaderboard-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }

        .leaderboard-table th {
          color: #ffc864;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 12px 8px;
          border-bottom: 2px solid rgba(255, 200, 100, 0.3);
          text-align: left;
        }

        .leaderboard-table th:first-child {
          width: 50px;
          text-align: center;
        }

        .leaderboard-table th:nth-child(3),
        .leaderboard-table th:nth-child(4) {
          text-align: right;
        }

        .leaderboard-table td {
          color: #fff;
          font-size: 16px;
          padding: 14px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .leaderboard-table td:first-child {
          text-align: center;
          font-weight: bold;
        }

        .leaderboard-table td:nth-child(3),
        .leaderboard-table td:nth-child(4) {
          text-align: right;
          font-family: 'Courier New', monospace;
        }

        .leaderboard-table tr:hover td {
          background: rgba(255, 200, 100, 0.1);
        }

        .leaderboard-table tr:last-child td {
          border-bottom: none;
        }

        .rank-gold {
          color: #ffd700 !important;
          font-size: 20px !important;
        }

        .rank-silver {
          color: #c0c0c0 !important;
          font-size: 18px !important;
        }

        .rank-bronze {
          color: #cd7f32 !important;
          font-size: 18px !important;
        }

        .empty-leaderboard {
          text-align: center;
          color: #888;
          font-size: 18px;
          padding: 40px 20px;
          font-style: italic;
        }

        .leaderboard-back-btn {
          display: block;
          width: 100%;
          padding: 15px 30px;
          font-size: 18px;
          font-weight: bold;
          color: #1a1a2e;
          background: linear-gradient(145deg, #ffc864, #ff9632);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 4px 15px rgba(255, 150, 50, 0.3);
        }

        .leaderboard-back-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(255, 150, 50, 0.4);
          background: linear-gradient(145deg, #ffd280, #ffaa50);
        }

        .leaderboard-back-btn:active {
          transform: translateY(0);
          box-shadow: 0 2px 10px rgba(255, 150, 50, 0.3);
        }

        /* Name Input Modal Styles */
        .name-input-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2100;
        }

        .name-input-panel {
          background: linear-gradient(145deg, #2d2d44, #1a1a2e);
          border-radius: 20px;
          padding: 30px 40px;
          min-width: 350px;
          box-shadow:
            0 10px 40px rgba(0, 0, 0, 0.5),
            0 0 0 3px rgba(100, 200, 255, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          border: 2px solid #64c8ff;
        }

        .name-input-title {
          text-align: center;
          color: #64c8ff;
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 10px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }

        .name-input-subtitle {
          text-align: center;
          color: #4ade80;
          font-size: 18px;
          margin-bottom: 25px;
        }

        .name-input-field {
          width: 100%;
          padding: 15px 20px;
          font-size: 20px;
          color: #fff;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(100, 200, 255, 0.3);
          border-radius: 10px;
          outline: none;
          text-align: center;
          letter-spacing: 2px;
          margin-bottom: 10px;
          transition: border-color 0.2s ease;
        }

        .name-input-field:focus {
          border-color: #64c8ff;
        }

        .name-input-field::placeholder {
          color: #666;
          letter-spacing: 1px;
        }

        .name-input-hint {
          text-align: center;
          color: #888;
          font-size: 12px;
          margin-bottom: 20px;
        }

        .name-input-error {
          text-align: center;
          color: #ff6b6b;
          font-size: 14px;
          margin-bottom: 15px;
          min-height: 20px;
        }

        .name-input-submit {
          display: block;
          width: 100%;
          padding: 15px 30px;
          font-size: 18px;
          font-weight: bold;
          color: #1a1a2e;
          background: linear-gradient(145deg, #4ade80, #22c55e);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 4px 15px rgba(74, 222, 128, 0.3);
        }

        .name-input-submit:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(74, 222, 128, 0.4);
        }

        .name-input-submit:active {
          transform: translateY(0);
        }

        .name-input-submit:disabled {
          background: #555;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        /* Score display in name input */
        .score-display {
          display: flex;
          justify-content: space-around;
          margin-bottom: 25px;
          padding: 15px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
        }

        .score-item {
          text-align: center;
        }

        .score-label {
          color: #888;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .score-value {
          color: #ffc864;
          font-size: 24px;
          font-weight: bold;
        }
      </style>
    `;
  }

  /**
   * Get the HTML structure for the leaderboard
   */
  private getHTML(): string {
    return `
      <div class="leaderboard-panel">
        <h1 class="leaderboard-title">LEADERBOARD</h1>
        <p class="leaderboard-subtitle">Score = (Level x 1000) + Survival Time</p>
        <div id="leaderboard-content"></div>
        <button class="leaderboard-back-btn" id="leaderboard-back-btn">Back to Menu</button>
      </div>
    `;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    const backBtn = document.getElementById('leaderboard-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.hide();
        if (this.onBack) {
          this.onBack();
        }
      });
    }

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
        if (this.onBack) {
          this.onBack();
        }
      }
    });
  }

  /**
   * Show the leaderboard
   */
  show(): void {
    if (!this.container) {
      this.createContainer();
    }

    this.updateDisplay();
    this.container!.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * Hide the leaderboard
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.isVisible = false;
  }

  /**
   * Check if a score qualifies for the leaderboard
   * @param level - The highest level reached
   * @param time - Total survival time in seconds
   * @returns true if the score qualifies for top 10
   */
  isHighScore(level: number, time: number): boolean {
    const scores = this.getScores();
    const newScore = this.calculateScore(level, time);

    if (scores.length < MAX_ENTRIES) {
      return true;
    }

    const lowestScore = this.calculateScore(
      scores[scores.length - 1].level,
      scores[scores.length - 1].time
    );

    return newScore > lowestScore;
  }

  /**
   * Add a new score to the leaderboard
   * @param name - Player name (3-10 characters)
   * @param level - Highest level reached
   * @param time - Total survival time in seconds
   */
  addScore(name: string, level: number, time: number): void {
    // Validate name
    const trimmedName = name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) {
      console.warn('Invalid name length for leaderboard entry');
      return;
    }

    const scores = this.getScores();

    const newEntry: LeaderboardEntry = {
      name: trimmedName,
      level,
      time,
      date: new Date().toISOString(),
    };

    scores.push(newEntry);

    // Sort by score (descending)
    scores.sort((a, b) => {
      const scoreA = this.calculateScore(a.level, a.time);
      const scoreB = this.calculateScore(b.level, b.time);
      return scoreB - scoreA;
    });

    // Keep only top 10
    const topScores = scores.slice(0, MAX_ENTRIES);

    // Save to localStorage
    this.saveScores(topScores);
  }

  /**
   * Get all scores from localStorage
   * @returns Array of leaderboard entries
   */
  getScores(): LeaderboardEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }

      const parsed: LeaderboardData = JSON.parse(data);
      return parsed.scores || [];
    } catch (error) {
      console.error('Error reading leaderboard data:', error);
      return [];
    }
  }

  /**
   * Save scores to localStorage
   * @param scores - Array of leaderboard entries
   */
  private saveScores(scores: LeaderboardEntry[]): void {
    try {
      const data: LeaderboardData = { scores };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving leaderboard data:', error);
    }
  }

  /**
   * Calculate the total score
   * @param level - Highest level reached
   * @param time - Total survival time in seconds
   * @returns The calculated score
   */
  private calculateScore(level: number, time: number): number {
    return level * 1000 + Math.floor(time);
  }

  /**
   * Format time as MM:SS
   * @param seconds - Time in seconds
   * @returns Formatted time string
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Update the leaderboard display
   */
  private updateDisplay(): void {
    const content = document.getElementById('leaderboard-content');
    if (!content) return;

    const scores = this.getScores();

    if (scores.length === 0) {
      content.innerHTML = `
        <div class="empty-leaderboard">
          No scores yet!<br>
          Be the first to set a high score.
        </div>
      `;
      return;
    }

    let tableHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Level</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
    `;

    scores.forEach((entry, index) => {
      const rank = index + 1;
      let rankClass = '';

      if (rank === 1) rankClass = 'rank-gold';
      else if (rank === 2) rankClass = 'rank-silver';
      else if (rank === 3) rankClass = 'rank-bronze';

      tableHTML += `
        <tr>
          <td class="${rankClass}">${rank}</td>
          <td>${this.escapeHTML(entry.name)}</td>
          <td>${entry.level}</td>
          <td>${this.formatTime(entry.time)}</td>
        </tr>
      `;
    });

    tableHTML += `
        </tbody>
      </table>
    `;

    content.innerHTML = tableHTML;
  }

  /**
   * Escape HTML special characters for safety
   * @param str - String to escape
   * @returns Escaped string
   */
  private escapeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Show name input dialog for a new high score
   * @param level - Level reached
   * @param time - Survival time in seconds
   * @returns Promise that resolves with the entered name
   */
  showNameInput(level: number, time: number): Promise<string> {
    return new Promise((resolve) => {
      const score = this.calculateScore(level, time);

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'name-input-overlay';
      overlay.id = 'name-input-overlay';

      overlay.innerHTML = `
        <div class="name-input-panel">
          <h2 class="name-input-title">NEW HIGH SCORE!</h2>
          <p class="name-input-subtitle">Score: ${score.toLocaleString()}</p>

          <div class="score-display">
            <div class="score-item">
              <div class="score-label">Level</div>
              <div class="score-value">${level}</div>
            </div>
            <div class="score-item">
              <div class="score-label">Time</div>
              <div class="score-value">${this.formatTime(time)}</div>
            </div>
          </div>

          <input
            type="text"
            class="name-input-field"
            id="name-input-field"
            placeholder="Enter your name"
            maxlength="${MAX_NAME_LENGTH}"
            autocomplete="off"
          />
          <p class="name-input-hint">${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters</p>
          <p class="name-input-error" id="name-input-error"></p>
          <button class="name-input-submit" id="name-input-submit" disabled>Save Score</button>
        </div>
      `;

      document.body.appendChild(overlay);

      const input = document.getElementById('name-input-field') as HTMLInputElement;
      const submitBtn = document.getElementById('name-input-submit') as HTMLButtonElement;
      const errorEl = document.getElementById('name-input-error') as HTMLElement;

      // Focus input
      setTimeout(() => input.focus(), 100);

      // Validate input on change
      const validateInput = () => {
        const value = input.value.trim();
        const isValid = value.length >= MIN_NAME_LENGTH && value.length <= MAX_NAME_LENGTH;

        submitBtn.disabled = !isValid;

        if (value.length > 0 && value.length < MIN_NAME_LENGTH) {
          errorEl.textContent = `Name must be at least ${MIN_NAME_LENGTH} characters`;
        } else {
          errorEl.textContent = '';
        }
      };

      input.addEventListener('input', validateInput);

      // Handle submit
      const handleSubmit = () => {
        const name = input.value.trim();
        if (name.length >= MIN_NAME_LENGTH && name.length <= MAX_NAME_LENGTH) {
          overlay.remove();
          resolve(name);
        }
      };

      submitBtn.addEventListener('click', handleSubmit);

      // Enter key to submit
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          handleSubmit();
        }
      });
    });
  }

  /**
   * Clear all leaderboard data (for debugging/testing)
   */
  clearScores(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Check if the leaderboard is currently visible
   * @returns true if visible
   */
  isShown(): boolean {
    return this.isVisible;
  }
}
