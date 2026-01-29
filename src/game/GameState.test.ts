import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState, GameStateType, StateChangeListener } from './GameState';

describe('GameState', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe('initialization', () => {
    it('should initialize with MENU state by default', () => {
      expect(gameState.state).toBe(GameStateType.MENU);
    });

    it('should accept a custom initial state', () => {
      const customState = new GameState(GameStateType.PLAYING);
      expect(customState.state).toBe(GameStateType.PLAYING);
    });

    it('should have previous state same as current on initialization', () => {
      expect(gameState.previous).toBe(GameStateType.MENU);
    });
  });

  describe('state transitions', () => {
    it('should transition from MENU to PLAYING', () => {
      const result = gameState.transitionTo(GameStateType.PLAYING);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.PLAYING);
    });

    it('should transition from PLAYING to PAUSED', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      const result = gameState.transitionTo(GameStateType.PAUSED);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.PAUSED);
    });

    it('should transition from PLAYING to GAME_OVER', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      const result = gameState.transitionTo(GameStateType.GAME_OVER);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.GAME_OVER);
    });

    it('should transition from PLAYING to LEVEL_COMPLETE', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      const result = gameState.transitionTo(GameStateType.LEVEL_COMPLETE);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.LEVEL_COMPLETE);
    });

    it('should transition from PAUSED to PLAYING', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.transitionTo(GameStateType.PAUSED);
      const result = gameState.transitionTo(GameStateType.PLAYING);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.PLAYING);
    });

    it('should transition from PAUSED to MENU', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.transitionTo(GameStateType.PAUSED);
      const result = gameState.transitionTo(GameStateType.MENU);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.MENU);
    });

    it('should transition from GAME_OVER to MENU', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.transitionTo(GameStateType.GAME_OVER);
      const result = gameState.transitionTo(GameStateType.MENU);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.MENU);
    });

    it('should transition from GAME_OVER to PLAYING (retry)', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.transitionTo(GameStateType.GAME_OVER);
      const result = gameState.transitionTo(GameStateType.PLAYING);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.PLAYING);
    });

    it('should transition from LEVEL_COMPLETE to PLAYING', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.transitionTo(GameStateType.LEVEL_COMPLETE);
      const result = gameState.transitionTo(GameStateType.PLAYING);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.PLAYING);
    });

    it('should transition from LEVEL_COMPLETE to MENU', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.transitionTo(GameStateType.LEVEL_COMPLETE);
      const result = gameState.transitionTo(GameStateType.MENU);
      expect(result).toBe(true);
      expect(gameState.state).toBe(GameStateType.MENU);
    });
  });

  describe('invalid transitions', () => {
    it('should reject transition from MENU to PAUSED', () => {
      const result = gameState.transitionTo(GameStateType.PAUSED);
      expect(result).toBe(false);
      expect(gameState.state).toBe(GameStateType.MENU);
    });

    it('should reject transition from MENU to GAME_OVER', () => {
      const result = gameState.transitionTo(GameStateType.GAME_OVER);
      expect(result).toBe(false);
      expect(gameState.state).toBe(GameStateType.MENU);
    });

    it('should reject transition from PLAYING to MENU directly', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      const result = gameState.transitionTo(GameStateType.MENU);
      expect(result).toBe(false);
      expect(gameState.state).toBe(GameStateType.PLAYING);
    });

    it('should reject transition from PAUSED to GAME_OVER', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.transitionTo(GameStateType.PAUSED);
      const result = gameState.transitionTo(GameStateType.GAME_OVER);
      expect(result).toBe(false);
      expect(gameState.state).toBe(GameStateType.PAUSED);
    });
  });

  describe('canTransitionTo', () => {
    it('should return true for valid transitions', () => {
      expect(gameState.canTransitionTo(GameStateType.PLAYING)).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(gameState.canTransitionTo(GameStateType.PAUSED)).toBe(false);
      expect(gameState.canTransitionTo(GameStateType.GAME_OVER)).toBe(false);
    });
  });

  describe('forceState', () => {
    it('should force state change without validation', () => {
      gameState.forceState(GameStateType.GAME_OVER);
      expect(gameState.state).toBe(GameStateType.GAME_OVER);
    });

    it('should update previous state when forcing', () => {
      gameState.forceState(GameStateType.PLAYING);
      expect(gameState.previous).toBe(GameStateType.MENU);
    });
  });

  describe('state checks', () => {
    it('should correctly identify current state with is()', () => {
      expect(gameState.is(GameStateType.MENU)).toBe(true);
      expect(gameState.is(GameStateType.PLAYING)).toBe(false);
    });

    it('should correctly identify multiple states with isAny()', () => {
      expect(gameState.isAny(GameStateType.MENU, GameStateType.PLAYING)).toBe(true);
      expect(gameState.isAny(GameStateType.PLAYING, GameStateType.PAUSED)).toBe(false);
    });

    it('should correctly report isActive()', () => {
      expect(gameState.isActive()).toBe(false);
      gameState.transitionTo(GameStateType.PLAYING);
      expect(gameState.isActive()).toBe(true);
      gameState.transitionTo(GameStateType.PAUSED);
      expect(gameState.isActive()).toBe(false);
    });

    it('should correctly report shouldUpdate()', () => {
      expect(gameState.shouldUpdate()).toBe(false);
      gameState.transitionTo(GameStateType.PLAYING);
      expect(gameState.shouldUpdate()).toBe(true);
      gameState.transitionTo(GameStateType.PAUSED);
      expect(gameState.shouldUpdate()).toBe(false);
    });

    it('should always return true for shouldRender()', () => {
      expect(gameState.shouldRender()).toBe(true);
      gameState.transitionTo(GameStateType.PLAYING);
      expect(gameState.shouldRender()).toBe(true);
      gameState.transitionTo(GameStateType.PAUSED);
      expect(gameState.shouldRender()).toBe(true);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      gameState.addListener(listener);

      gameState.transitionTo(GameStateType.PLAYING);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(GameStateType.PLAYING, GameStateType.MENU);
    });

    it('should notify listeners on forceState', () => {
      const listener = vi.fn();
      gameState.addListener(listener);

      gameState.forceState(GameStateType.GAME_OVER);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(GameStateType.GAME_OVER, GameStateType.MENU);
    });

    it('should not notify listeners on failed transition', () => {
      const listener = vi.fn();
      gameState.addListener(listener);

      gameState.transitionTo(GameStateType.PAUSED); // Invalid

      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove listeners correctly', () => {
      const listener = vi.fn();
      gameState.addListener(listener);
      gameState.removeListener(listener);

      gameState.transitionTo(GameStateType.PLAYING);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      gameState.addListener(listener1);
      gameState.addListener(listener2);

      gameState.transitionTo(GameStateType.PLAYING);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener: StateChangeListener = () => {
        throw new Error('Test error');
      };
      const normalListener = vi.fn();

      gameState.addListener(errorListener);
      gameState.addListener(normalListener);

      // Should not throw
      expect(() => gameState.transitionTo(GameStateType.PLAYING)).not.toThrow();
      // Other listeners should still be called
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset to MENU state', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.reset();
      expect(gameState.state).toBe(GameStateType.MENU);
    });

    it('should update previous state on reset', () => {
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.reset();
      expect(gameState.previous).toBe(GameStateType.PLAYING);
    });

    it('should notify listeners on reset', () => {
      const listener = vi.fn();
      gameState.transitionTo(GameStateType.PLAYING);
      gameState.addListener(listener);

      gameState.reset();

      expect(listener).toHaveBeenCalledWith(GameStateType.MENU, GameStateType.PLAYING);
    });
  });
});
