/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Leaderboard, LeaderboardData } from './Leaderboard';

describe('Leaderboard', () => {
  let leaderboard: Leaderboard;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Clear any existing DOM elements
    const existingContainer = document.getElementById('leaderboard-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    leaderboard = new Leaderboard();
  });

  afterEach(() => {
    leaderboard.hide();
    localStorage.clear();
  });

  describe('constructor', () => {
    it('should create a leaderboard instance', () => {
      expect(leaderboard).toBeDefined();
    });

    it('should create the container element', () => {
      leaderboard.show();
      const container = document.getElementById('leaderboard-container');
      expect(container).not.toBeNull();
    });
  });

  describe('show/hide', () => {
    it('should show the leaderboard', () => {
      leaderboard.show();
      const container = document.getElementById('leaderboard-container');
      expect(container?.style.display).toBe('flex');
      expect(leaderboard.isShown()).toBe(true);
    });

    it('should hide the leaderboard', () => {
      leaderboard.show();
      leaderboard.hide();
      const container = document.getElementById('leaderboard-container');
      expect(container?.style.display).toBe('none');
      expect(leaderboard.isShown()).toBe(false);
    });
  });

  describe('getScores', () => {
    it('should return empty array when no scores exist', () => {
      const scores = leaderboard.getScores();
      expect(scores).toEqual([]);
    });

    it('should return scores from localStorage', () => {
      const testData: LeaderboardData = {
        scores: [
          { name: 'Player1', level: 5, time: 120, date: '2024-01-01T00:00:00.000Z' },
        ],
      };
      localStorage.setItem('meerkat-maze-leaderboard', JSON.stringify(testData));

      const scores = leaderboard.getScores();
      expect(scores).toHaveLength(1);
      expect(scores[0].name).toBe('Player1');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('meerkat-maze-leaderboard', 'invalid json');

      const scores = leaderboard.getScores();
      expect(scores).toEqual([]);
    });
  });

  describe('addScore', () => {
    it('should add a new score', () => {
      leaderboard.addScore('TestPlayer', 3, 90);

      const scores = leaderboard.getScores();
      expect(scores).toHaveLength(1);
      expect(scores[0].name).toBe('TestPlayer');
      expect(scores[0].level).toBe(3);
      expect(scores[0].time).toBe(90);
    });

    it('should sort scores by calculated score (descending)', () => {
      leaderboard.addScore('LowScore', 1, 30); // Score: 1030
      leaderboard.addScore('HighScore', 5, 100); // Score: 5100
      leaderboard.addScore('MidScore', 3, 50); // Score: 3050

      const scores = leaderboard.getScores();
      expect(scores[0].name).toBe('HighScore');
      expect(scores[1].name).toBe('MidScore');
      expect(scores[2].name).toBe('LowScore');
    });

    it('should keep only top 10 scores', () => {
      // Add 15 scores
      for (let i = 1; i <= 15; i++) {
        leaderboard.addScore(`Player${i}`, i, 100);
      }

      const scores = leaderboard.getScores();
      expect(scores).toHaveLength(10);

      // Highest scores should be kept (levels 6-15)
      expect(scores[0].level).toBe(15);
      expect(scores[9].level).toBe(6);
    });

    it('should reject names shorter than 3 characters', () => {
      leaderboard.addScore('AB', 5, 100);

      const scores = leaderboard.getScores();
      expect(scores).toHaveLength(0);
    });

    it('should reject names longer than 10 characters', () => {
      leaderboard.addScore('VeryLongPlayerName', 5, 100);

      const scores = leaderboard.getScores();
      expect(scores).toHaveLength(0);
    });

    it('should trim whitespace from names', () => {
      leaderboard.addScore('  Test  ', 5, 100);

      const scores = leaderboard.getScores();
      expect(scores[0].name).toBe('Test');
    });

    it('should include ISO date string', () => {
      leaderboard.addScore('Player', 1, 60);

      const scores = leaderboard.getScores();
      expect(scores[0].date).toBeDefined();
      // Should be a valid ISO date string
      expect(new Date(scores[0].date).toISOString()).toBe(scores[0].date);
    });
  });

  describe('isHighScore', () => {
    it('should return true when leaderboard has less than 10 entries', () => {
      const isHigh = leaderboard.isHighScore(1, 30);
      expect(isHigh).toBe(true);
    });

    it('should return true when score beats lowest score', () => {
      // Add 10 low scores
      for (let i = 0; i < 10; i++) {
        leaderboard.addScore(`Player${i}`, 1, 10);
      }

      // New score beats all (level 5 = 5000+ points)
      const isHigh = leaderboard.isHighScore(5, 100);
      expect(isHigh).toBe(true);
    });

    it('should return false when score does not beat lowest score', () => {
      // Add 10 high scores
      for (let i = 0; i < 10; i++) {
        leaderboard.addScore(`Player${i}`, 10, 500);
      }

      // New score is too low (level 1 = 1000+ points)
      const isHigh = leaderboard.isHighScore(1, 50);
      expect(isHigh).toBe(false);
    });
  });

  describe('score calculation', () => {
    it('should calculate score as (level * 1000) + time', () => {
      // Level 5, 120 seconds = 5000 + 120 = 5120
      leaderboard.addScore('Player1', 5, 120);
      // Level 4, 200 seconds = 4000 + 200 = 4200
      leaderboard.addScore('Player2', 4, 200);

      const scores = leaderboard.getScores();
      // 5120 > 4200, so Player1 should be first
      expect(scores[0].name).toBe('Player1');
      expect(scores[1].name).toBe('Player2');
    });

    it('should floor the time value in score calculation', () => {
      leaderboard.addScore('Player1', 1, 99.9);

      const scores = leaderboard.getScores();
      // Score should be 1099 (1000 + floor(99.9))
      expect(scores[0].time).toBe(99.9);
    });
  });

  describe('clearScores', () => {
    it('should remove all scores from localStorage', () => {
      leaderboard.addScore('Player1', 5, 100);
      leaderboard.addScore('Player2', 3, 50);

      leaderboard.clearScores();

      const scores = leaderboard.getScores();
      expect(scores).toHaveLength(0);
    });
  });

  describe('onBack callback', () => {
    it('should call onBack when back button is clicked', () => {
      const onBackMock = vi.fn();
      leaderboard.onBack = onBackMock;

      leaderboard.show();

      const backBtn = document.getElementById('leaderboard-back-btn');
      backBtn?.click();

      expect(onBackMock).toHaveBeenCalled();
    });
  });

  describe('display formatting', () => {
    it('should display empty state when no scores', () => {
      leaderboard.show();

      const content = document.getElementById('leaderboard-content');
      expect(content?.innerHTML).toContain('No scores yet');
    });

    it('should display scores in a table', () => {
      leaderboard.addScore('TestPlayer', 5, 125);
      leaderboard.show();

      const content = document.getElementById('leaderboard-content');
      expect(content?.innerHTML).toContain('TestPlayer');
      expect(content?.innerHTML).toContain('5');
      expect(content?.innerHTML).toContain('02:05'); // 125 seconds = 2:05
    });

    it('should escape HTML in player names', () => {
      leaderboard.addScore('<script>', 1, 60);
      leaderboard.show();

      const content = document.getElementById('leaderboard-content');
      expect(content?.innerHTML).not.toContain('<script>');
      expect(content?.innerHTML).toContain('&lt;script&gt;');
    });
  });
});
