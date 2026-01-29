/**
 * UI Manager for Meerkat Maze Runner
 * Coordinates all UI components and handles state-based visibility
 */

import { GameStateType } from '../game/GameState';
import { HUD, HUDData } from './HUD';
import { MainMenu, MainMenuCallbacks } from './MainMenu';
import { PauseMenu, PauseMenuCallbacks } from './PauseMenu';
import { GameOverScreen, GameOverData, GameOverCallbacks } from './GameOverScreen';
import { LevelCompleteScreen, LevelCompleteData, LevelCompleteCallbacks } from './LevelCompleteScreen';
import { Leaderboard } from './Leaderboard';
import { SettingsMenu } from './SettingsMenu';
import { HowToPlayScreen } from './HowToPlayScreen';

export interface UIManagerCallbacks {
  // Main menu actions
  onPlay?: () => void;
  onContinue?: () => void;

  // Pause menu actions
  onResume?: () => void;
  onRestart?: () => void;
  onQuitToMenu?: () => void;

  // Game over actions
  onTryAgain?: () => void;

  // Level complete actions
  onNextLevel?: () => void;
}

/**
 * UIManager coordinates all UI screens and handles visibility based on game state
 */
export class UIManager {
  private hud: HUD;
  private mainMenu: MainMenu;
  private pauseMenu: PauseMenu;
  private gameOverScreen: GameOverScreen;
  private levelCompleteScreen: LevelCompleteScreen;
  private leaderboard: Leaderboard;
  private settingsMenu: SettingsMenu;
  private howToPlayScreen: HowToPlayScreen;

  private callbacks: UIManagerCallbacks;

  // Track stats for game over / level complete
  private totalTimeSurvived: number = 0;
  private zombiesKilled: number = 0;
  private powerUpsCollected: number = 0;

  constructor(callbacks: UIManagerCallbacks = {}) {
    this.callbacks = callbacks;

    // Initialize all UI components
    this.hud = new HUD();
    this.leaderboard = new Leaderboard();

    this.mainMenu = new MainMenu(
      this.createMainMenuCallbacks(),
      MainMenu.checkForSavedProgress()
    );

    this.pauseMenu = new PauseMenu(this.createPauseMenuCallbacks());

    this.gameOverScreen = new GameOverScreen(this.createGameOverCallbacks());

    this.levelCompleteScreen = new LevelCompleteScreen(
      this.createLevelCompleteCallbacks()
    );

    this.settingsMenu = new SettingsMenu({
      onBack: () => {
        this.mainMenu.show();
      },
    });

    this.howToPlayScreen = new HowToPlayScreen({
      onBack: () => {
        this.mainMenu.show();
      },
    });

    // Set leaderboard back callback
    this.leaderboard.onBack = () => {
      this.mainMenu.show();
    };
  }

  private createMainMenuCallbacks(): MainMenuCallbacks {
    return {
      onPlay: () => {
        this.mainMenu.hide();
        this.callbacks.onPlay?.();
      },
      onContinue: () => {
        this.mainMenu.hide();
        this.callbacks.onContinue?.();
      },
      onLeaderboard: () => {
        this.mainMenu.hide();
        this.leaderboard.show();
      },
      onSettings: () => {
        this.mainMenu.hide();
        this.settingsMenu.show();
      },
      onHowToPlay: () => {
        this.mainMenu.hide();
        this.howToPlayScreen.show();
      },
    };
  }

  private createPauseMenuCallbacks(): PauseMenuCallbacks {
    return {
      onResume: () => {
        this.pauseMenu.hide();
        this.callbacks.onResume?.();
      },
      onRestart: () => {
        this.pauseMenu.hide();
        this.callbacks.onRestart?.();
      },
      onQuit: () => {
        this.pauseMenu.hide();
        this.hud.hide();
        this.mainMenu.show();
        this.callbacks.onQuitToMenu?.();
      },
    };
  }

  private createGameOverCallbacks(): GameOverCallbacks {
    return {
      onTryAgain: () => {
        this.gameOverScreen.hide();
        this.callbacks.onTryAgain?.();
      },
      onMainMenu: () => {
        this.gameOverScreen.hide();
        this.mainMenu.show();
        this.callbacks.onQuitToMenu?.();
      },
      onHighScoreSubmit: (name: string) => {
        // Add to leaderboard
        this.leaderboard.addScore(name, this.getLastGameLevel(), this.totalTimeSurvived);
      },
    };
  }

  private createLevelCompleteCallbacks(): LevelCompleteCallbacks {
    return {
      onNextLevel: () => {
        this.levelCompleteScreen.hide();
        this.callbacks.onNextLevel?.();
      },
    };
  }

  private lastGameLevel: number = 1;

  private getLastGameLevel(): number {
    return this.lastGameLevel;
  }

  /**
   * Update UI based on game state
   */
  onStateChange(newState: GameStateType, _previousState: GameStateType): void {
    switch (newState) {
      case GameStateType.MENU:
        this.hud.hide();
        this.pauseMenu.hide();
        this.gameOverScreen.hide();
        this.levelCompleteScreen.hide();
        this.mainMenu.show();
        break;

      case GameStateType.PLAYING:
        this.mainMenu.hide();
        this.pauseMenu.hide();
        this.gameOverScreen.hide();
        this.levelCompleteScreen.hide();
        this.hud.show();
        break;

      case GameStateType.PAUSED:
        this.pauseMenu.show();
        break;

      case GameStateType.GAME_OVER:
        this.hud.hide();
        // Game over screen is shown via showGameOver()
        break;

      case GameStateType.LEVEL_COMPLETE:
        // Level complete screen is shown via showLevelComplete()
        break;
    }
  }

  /**
   * Update HUD with current game data
   */
  updateHUD(data: HUDData): void {
    this.hud.update(data);
  }

  /**
   * Show game over screen with stats
   */
  showGameOver(data: {
    level: number;
    totalTimeSurvived: number;
    zombiesKilled: number;
  }): void {
    this.lastGameLevel = data.level;
    this.totalTimeSurvived = data.totalTimeSurvived;
    this.zombiesKilled = data.zombiesKilled;

    const isHighScore = this.leaderboard.isHighScore(data.level, data.totalTimeSurvived);

    const gameOverData: GameOverData = {
      finalLevel: data.level,
      totalTimeSurvived: data.totalTimeSurvived,
      zombiesKilled: data.zombiesKilled,
      isHighScore,
    };

    this.gameOverScreen.show(gameOverData);
  }

  /**
   * Show level complete screen with stats
   */
  showLevelComplete(data: {
    level: number;
    timeRemaining: number;
    zombiesKilled: number;
    powerUpsCollected: number;
  }): void {
    this.zombiesKilled = data.zombiesKilled;
    this.powerUpsCollected = data.powerUpsCollected;

    const levelCompleteData: LevelCompleteData = {
      level: data.level,
      timeRemaining: data.timeRemaining,
      zombiesKilled: data.zombiesKilled,
      powerUpsCollected: data.powerUpsCollected,
    };

    this.levelCompleteScreen.show(levelCompleteData);
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: UIManagerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };

    // Update child component callbacks
    this.mainMenu.setCallbacks(this.createMainMenuCallbacks());
    this.pauseMenu.setCallbacks(this.createPauseMenuCallbacks());
    this.gameOverScreen.setCallbacks(this.createGameOverCallbacks());
    this.levelCompleteScreen.setCallbacks(this.createLevelCompleteCallbacks());
  }

  /**
   * Get the leaderboard instance for external access
   */
  getLeaderboard(): Leaderboard {
    return this.leaderboard;
  }

  /**
   * Reset stat trackers for a new game
   */
  resetStats(): void {
    this.totalTimeSurvived = 0;
    this.zombiesKilled = 0;
    this.powerUpsCollected = 0;
  }

  /**
   * Track zombie kill
   */
  addZombieKill(): void {
    this.zombiesKilled++;
  }

  /**
   * Track power-up collection
   */
  addPowerUpCollected(): void {
    this.powerUpsCollected++;
  }

  /**
   * Update total time survived
   */
  setTotalTimeSurvived(time: number): void {
    this.totalTimeSurvived = time;
  }

  /**
   * Clean up all UI components
   */
  dispose(): void {
    this.hud.dispose();
    this.mainMenu.destroy();
    this.pauseMenu.destroy();
    this.gameOverScreen.destroy();
    this.levelCompleteScreen.destroy();
    this.settingsMenu.destroy();
    this.howToPlayScreen.destroy();
  }
}
