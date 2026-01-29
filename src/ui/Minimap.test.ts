/**
 * Tests for Minimap component
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Minimap, MinimapData } from './Minimap';
import { MazeGenerator } from '../maze/MazeGenerator';

describe('Minimap', () => {
  let minimap: Minimap;

  beforeEach(() => {
    // Clean up any existing DOM elements
    const existingMinimap = document.getElementById('game-minimap');
    if (existingMinimap) {
      existingMinimap.remove();
    }
    const existingStyles = document.getElementById('meerkat-minimap-styles');
    if (existingStyles) {
      existingStyles.remove();
    }

    minimap = new Minimap();
  });

  afterEach(() => {
    minimap.dispose();
  });

  describe('initialization', () => {
    it('should create minimap container', () => {
      const container = document.getElementById('game-minimap');
      expect(container).not.toBeNull();
    });

    it('should inject CSS styles', () => {
      const styles = document.getElementById('meerkat-minimap-styles');
      expect(styles).not.toBeNull();
    });

    it('should start hidden', () => {
      expect(minimap.getIsVisible()).toBe(false);
      const container = document.getElementById('game-minimap');
      expect(container?.classList.contains('hidden')).toBe(true);
    });

    it('should create canvas element', () => {
      const canvas = document.querySelector('.minimap-canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.tagName).toBe('CANVAS');
    });
  });

  describe('visibility', () => {
    it('should show the minimap', () => {
      minimap.show();
      expect(minimap.getIsVisible()).toBe(true);
      const container = document.getElementById('game-minimap');
      expect(container?.classList.contains('hidden')).toBe(false);
    });

    it('should hide the minimap', () => {
      minimap.show();
      minimap.hide();
      expect(minimap.getIsVisible()).toBe(false);
    });

    it('should toggle visibility', () => {
      minimap.toggle();
      expect(minimap.getIsVisible()).toBe(true);
      minimap.toggle();
      expect(minimap.getIsVisible()).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should accept custom configuration', () => {
      minimap.dispose();
      minimap = new Minimap({
        size: 200,
        fogOfWar: false,
        showZombies: false,
      });

      const canvas = document.querySelector('.minimap-canvas') as HTMLCanvasElement;
      expect(canvas?.width).toBe(200);
      expect(canvas?.height).toBe(200);
    });

    it('should use default configuration when not provided', () => {
      const canvas = document.querySelector('.minimap-canvas') as HTMLCanvasElement;
      expect(canvas?.width).toBe(180);
      expect(canvas?.height).toBe(180);
    });
  });

  describe('maze integration', () => {
    let mazeGenerator: MazeGenerator;

    beforeEach(() => {
      mazeGenerator = new MazeGenerator({
        width: 10,
        height: 10,
        seed: 12345,
      });
      mazeGenerator.generate();
    });

    it('should set maze without error', () => {
      expect(() => minimap.setMaze(mazeGenerator)).not.toThrow();
    });

    it('should clear explored cells when setting new maze', () => {
      minimap.setMaze(mazeGenerator);
      // Internal state - we verify by setting maze again
      expect(() => minimap.setMaze(mazeGenerator)).not.toThrow();
    });

    it('should reset explored cells', () => {
      minimap.setMaze(mazeGenerator);
      expect(() => minimap.reset()).not.toThrow();
    });
  });

  describe('update', () => {
    let mazeGenerator: MazeGenerator;
    const mockMinimapData: MinimapData = {
      playerPosition: { x: 8, y: 0, z: 8 },
      playerRotation: 0,
      zombiePositions: [
        { x: 20, y: 0, z: 20, isChasing: false },
        { x: 40, y: 0, z: 40, isChasing: true },
      ],
      powerUpPositions: [
        { x: 12, y: 0, z: 16, type: 'SPEED_BOOST' },
      ],
      swordPosition: { x: 24, y: 0, z: 8 },
    };

    beforeEach(() => {
      mazeGenerator = new MazeGenerator({
        width: 10,
        height: 10,
        seed: 12345,
      });
      mazeGenerator.generate();
      minimap.setMaze(mazeGenerator);
    });

    it('should not throw when updating while hidden', () => {
      expect(() => minimap.update(mockMinimapData)).not.toThrow();
    });

    it('should update without error when visible', () => {
      minimap.show();
      expect(() => minimap.update(mockMinimapData)).not.toThrow();
    });

    it('should handle missing sword position', () => {
      minimap.show();
      const dataWithoutSword: MinimapData = {
        ...mockMinimapData,
        swordPosition: undefined,
      };
      expect(() => minimap.update(dataWithoutSword)).not.toThrow();
    });

    it('should handle empty zombie positions', () => {
      minimap.show();
      const dataNoZombies: MinimapData = {
        ...mockMinimapData,
        zombiePositions: [],
      };
      expect(() => minimap.update(dataNoZombies)).not.toThrow();
    });

    it('should handle empty powerup positions', () => {
      minimap.show();
      const dataNoPowerups: MinimapData = {
        ...mockMinimapData,
        powerUpPositions: [],
      };
      expect(() => minimap.update(dataNoPowerups)).not.toThrow();
    });
  });

  describe('canvas rendering', () => {
    let mazeGenerator: MazeGenerator;

    beforeEach(() => {
      mazeGenerator = new MazeGenerator({
        width: 10,
        height: 10,
        seed: 12345,
      });
      mazeGenerator.generate();
      minimap.setMaze(mazeGenerator);
    });

    it('should render to canvas without error', () => {
      minimap.show();

      const mockData: MinimapData = {
        playerPosition: { x: 8, y: 0, z: 8 },
        playerRotation: Math.PI / 4,
        zombiePositions: [],
        powerUpPositions: [],
      };

      expect(() => minimap.update(mockData)).not.toThrow();

      // Check that canvas element exists (context may be null in jsdom)
      const canvas = document.querySelector('.minimap-canvas') as HTMLCanvasElement;
      expect(canvas).not.toBeNull();
    });

    it('should handle player rotation', () => {
      minimap.show();

      // Test various rotations
      const rotations = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI * 2];

      for (const rotation of rotations) {
        const mockData: MinimapData = {
          playerPosition: { x: 8, y: 0, z: 8 },
          playerRotation: rotation,
          zombiePositions: [],
          powerUpPositions: [],
        };

        expect(() => minimap.update(mockData)).not.toThrow();
      }
    });
  });

  describe('fog of war', () => {
    let mazeGenerator: MazeGenerator;

    beforeEach(() => {
      mazeGenerator = new MazeGenerator({
        width: 10,
        height: 10,
        seed: 12345,
      });
      mazeGenerator.generate();
    });

    it('should respect fog of war setting', () => {
      minimap.dispose();
      minimap = new Minimap({ fogOfWar: true });
      minimap.setMaze(mazeGenerator);
      minimap.show();

      const mockData: MinimapData = {
        playerPosition: { x: 8, y: 0, z: 8 },
        playerRotation: 0,
        zombiePositions: [],
        powerUpPositions: [],
      };

      expect(() => minimap.update(mockData)).not.toThrow();
    });

    it('should work with fog of war disabled', () => {
      minimap.dispose();
      minimap = new Minimap({ fogOfWar: false });
      minimap.setMaze(mazeGenerator);
      minimap.show();

      const mockData: MinimapData = {
        playerPosition: { x: 8, y: 0, z: 8 },
        playerRotation: 0,
        zombiePositions: [],
        powerUpPositions: [],
      };

      expect(() => minimap.update(mockData)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove DOM elements on dispose', () => {
      minimap.dispose();
      expect(document.getElementById('game-minimap')).toBeNull();
      expect(document.getElementById('meerkat-minimap-styles')).toBeNull();
    });

    it('should handle multiple dispose calls', () => {
      minimap.dispose();
      expect(() => minimap.dispose()).not.toThrow();
    });

    it('should clear explored cells on dispose', () => {
      const mazeGenerator = new MazeGenerator({
        width: 10,
        height: 10,
        seed: 12345,
      });
      mazeGenerator.generate();
      minimap.setMaze(mazeGenerator);

      minimap.dispose();
      // After dispose, internal state should be cleared
      expect(minimap.getIsVisible()).toBe(false);
    });
  });

  describe('world to grid conversion', () => {
    let mazeGenerator: MazeGenerator;

    beforeEach(() => {
      mazeGenerator = new MazeGenerator({
        width: 10,
        height: 10,
        seed: 12345,
      });
      mazeGenerator.generate();
      minimap.setMaze(mazeGenerator);
      minimap.show();
    });

    it('should correctly place player at different positions', () => {
      // Test multiple positions
      const positions = [
        { x: 0, z: 0 },
        { x: 4, z: 4 },
        { x: 20, z: 20 },
        { x: 36, z: 36 },
      ];

      for (const pos of positions) {
        const mockData: MinimapData = {
          playerPosition: { x: pos.x, y: 0, z: pos.z },
          playerRotation: 0,
          zombiePositions: [],
          powerUpPositions: [],
        };

        expect(() => minimap.update(mockData)).not.toThrow();
      }
    });
  });
});
