/**
 * Game state management for Meerkat Maze Runner
 * Handles state transitions and state-specific logic
 */

/** Possible game states */
export enum GameStateType {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
}

/** Valid state transitions */
const VALID_TRANSITIONS: Record<GameStateType, GameStateType[]> = {
  [GameStateType.MENU]: [GameStateType.PLAYING],
  [GameStateType.PLAYING]: [
    GameStateType.PAUSED,
    GameStateType.GAME_OVER,
    GameStateType.LEVEL_COMPLETE,
  ],
  [GameStateType.PAUSED]: [GameStateType.PLAYING, GameStateType.MENU],
  [GameStateType.GAME_OVER]: [GameStateType.MENU, GameStateType.PLAYING],
  [GameStateType.LEVEL_COMPLETE]: [GameStateType.PLAYING, GameStateType.MENU],
};

/** State change event listener type */
export type StateChangeListener = (
  newState: GameStateType,
  previousState: GameStateType
) => void;

/**
 * Manages game state and transitions
 */
export class GameState {
  private currentState: GameStateType;
  private previousState: GameStateType;
  private listeners: Set<StateChangeListener>;

  constructor(initialState: GameStateType = GameStateType.MENU) {
    this.currentState = initialState;
    this.previousState = initialState;
    this.listeners = new Set();
  }

  /**
   * Get the current game state
   */
  get state(): GameStateType {
    return this.currentState;
  }

  /**
   * Get the previous game state
   */
  get previous(): GameStateType {
    return this.previousState;
  }

  /**
   * Check if a transition to the target state is valid
   */
  canTransitionTo(targetState: GameStateType): boolean {
    const validTargets = VALID_TRANSITIONS[this.currentState];
    return validTargets.includes(targetState);
  }

  /**
   * Transition to a new state
   * @returns true if transition was successful, false otherwise
   */
  transitionTo(newState: GameStateType): boolean {
    if (!this.canTransitionTo(newState)) {
      console.warn(
        `Invalid state transition: ${this.currentState} -> ${newState}`
      );
      return false;
    }

    this.previousState = this.currentState;
    this.currentState = newState;

    // Notify listeners
    this.notifyListeners();

    return true;
  }

  /**
   * Force a state change without validation
   * Use sparingly, mainly for initialization or debugging
   */
  forceState(newState: GameStateType): void {
    this.previousState = this.currentState;
    this.currentState = newState;
    this.notifyListeners();
  }

  /**
   * Check if game is in a specific state
   */
  is(state: GameStateType): boolean {
    return this.currentState === state;
  }

  /**
   * Check if game is in one of the specified states
   */
  isAny(...states: GameStateType[]): boolean {
    return states.includes(this.currentState);
  }

  /**
   * Check if the game is actively running (not paused or in menu)
   */
  isActive(): boolean {
    return this.currentState === GameStateType.PLAYING;
  }

  /**
   * Check if the game loop should update game logic
   */
  shouldUpdate(): boolean {
    return this.currentState === GameStateType.PLAYING;
  }

  /**
   * Check if the game loop should render
   */
  shouldRender(): boolean {
    // Always render except when not initialized
    return true;
  }

  /**
   * Add a listener for state changes
   */
  addListener(listener: StateChangeListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a state change listener
   */
  removeListener(listener: StateChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentState, this.previousState);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.previousState = this.currentState;
    this.currentState = GameStateType.MENU;
    this.notifyListeners();
  }
}
