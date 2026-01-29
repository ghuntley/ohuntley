/**
 * Tests for DebugOverlay component
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { DebugOverlay, DebugData } from './DebugOverlay';

describe('DebugOverlay', () => {
  let debugOverlay: DebugOverlay;

  beforeEach(() => {
    // Clean up any existing DOM elements
    const existingOverlay = document.getElementById('debug-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    const existingStyles = document.getElementById('meerkat-debug-styles');
    if (existingStyles) {
      existingStyles.remove();
    }

    debugOverlay = new DebugOverlay();
  });

  afterEach(() => {
    debugOverlay.dispose();
  });

  describe('initialization', () => {
    it('should create debug overlay container', () => {
      const container = document.getElementById('debug-overlay');
      expect(container).not.toBeNull();
    });

    it('should inject CSS styles', () => {
      const styles = document.getElementById('meerkat-debug-styles');
      expect(styles).not.toBeNull();
    });

    it('should start hidden', () => {
      expect(debugOverlay.getIsVisible()).toBe(false);
      const container = document.getElementById('debug-overlay');
      expect(container?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('visibility', () => {
    it('should show the overlay', () => {
      debugOverlay.show();
      expect(debugOverlay.getIsVisible()).toBe(true);
      const container = document.getElementById('debug-overlay');
      expect(container?.classList.contains('hidden')).toBe(false);
    });

    it('should hide the overlay', () => {
      debugOverlay.show();
      debugOverlay.hide();
      expect(debugOverlay.getIsVisible()).toBe(false);
    });

    it('should toggle visibility', () => {
      debugOverlay.toggle();
      expect(debugOverlay.getIsVisible()).toBe(true);
      debugOverlay.toggle();
      expect(debugOverlay.getIsVisible()).toBe(false);
    });
  });

  describe('update', () => {
    const mockDebugData: DebugData = {
      fps: 60,
      frameTime: 16.67,
      entityCount: 10,
      zombieCount: 5,
      seed: 12345,
      playerPosition: { x: 10, y: 0, z: 20 },
      playerGridPosition: { x: 2, y: 5 },
      cameraPosition: { x: 10, y: 12, z: 35 },
    };

    it('should not throw when updating while hidden', () => {
      expect(() => debugOverlay.update(mockDebugData)).not.toThrow();
    });

    it('should update FPS display when visible', () => {
      debugOverlay.show();
      debugOverlay.update(mockDebugData);
      // FPS is averaged, so check the container is updated
      const container = document.getElementById('debug-overlay');
      expect(container?.innerHTML).toContain('60');
    });

    it('should update seed display when visible', () => {
      debugOverlay.show();
      debugOverlay.update(mockDebugData);
      const container = document.getElementById('debug-overlay');
      expect(container?.innerHTML).toContain('12345');
    });

    it('should update entity count display', () => {
      debugOverlay.show();
      debugOverlay.update(mockDebugData);
      const container = document.getElementById('debug-overlay');
      expect(container?.innerHTML).toContain('10');
      expect(container?.innerHTML).toContain('5 zombies');
    });
  });

  describe('visualization options', () => {
    it('should have visualization options disabled by default', () => {
      const options = debugOverlay.getVisualizationOptions();
      expect(options.showCollision).toBe(false);
      expect(options.showPathfinding).toBe(false);
      expect(options.showGrid).toBe(false);
    });
  });

  describe('scene integration', () => {
    it('should set scene without error', () => {
      const scene = new THREE.Scene();
      expect(() => debugOverlay.setScene(scene)).not.toThrow();
    });

    it('should add collision helpers group to scene', () => {
      const scene = new THREE.Scene();
      debugOverlay.setScene(scene);
      const collisionGroup = scene.getObjectByName('debug-collision');
      expect(collisionGroup).toBeDefined();
    });

    it('should add pathfinding helpers group to scene', () => {
      const scene = new THREE.Scene();
      debugOverlay.setScene(scene);
      const pathfindingGroup = scene.getObjectByName('debug-pathfinding');
      expect(pathfindingGroup).toBeDefined();
    });
  });

  describe('collision visualization', () => {
    it('should update collision visualization when enabled', () => {
      const scene = new THREE.Scene();
      debugOverlay.setScene(scene);
      debugOverlay.show();

      // Simulate enabling collision visualization
      const toggleCheckbox = document.getElementById('debug-checkbox-collision');
      if (toggleCheckbox) {
        toggleCheckbox.parentElement?.click();
      }

      debugOverlay.updateCollisionVisualization(
        { x: 10, y: 0, z: 10 },
        0.5,
        [{ x: 20, y: 0, z: 20, radius: 0.5 }]
      );

      const collisionGroup = scene.getObjectByName('debug-collision') as THREE.Group;
      // Should have at least player and zombie circles
      expect(collisionGroup.children.length).toBeGreaterThan(0);
    });
  });

  describe('FPS classification', () => {
    it('should classify FPS correctly', () => {
      debugOverlay.show();

      // Good FPS
      debugOverlay.update({
        fps: 60,
        frameTime: 16.67,
        entityCount: 0,
        zombieCount: 0,
        seed: 0,
        playerPosition: { x: 0, y: 0, z: 0 },
        playerGridPosition: { x: 0, y: 0 },
        cameraPosition: { x: 0, y: 0, z: 0 },
      });

      // FPS bar should have 'good' class at 60 FPS
      const fpsBar = document.getElementById('debug-fps-bar');
      expect(fpsBar?.classList.contains('good')).toBe(true);
    });

    it('should show warning for medium FPS', () => {
      debugOverlay.show();

      // Push multiple low FPS values to move the average
      for (let i = 0; i < 60; i++) {
        debugOverlay.update({
          fps: 35,
          frameTime: 28.57,
          entityCount: 0,
          zombieCount: 0,
          seed: 0,
          playerPosition: { x: 0, y: 0, z: 0 },
          playerGridPosition: { x: 0, y: 0 },
          cameraPosition: { x: 0, y: 0, z: 0 },
        });
      }

      const fpsBar = document.getElementById('debug-fps-bar');
      expect(fpsBar?.classList.contains('warning')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove DOM elements on dispose', () => {
      debugOverlay.dispose();
      expect(document.getElementById('debug-overlay')).toBeNull();
      expect(document.getElementById('meerkat-debug-styles')).toBeNull();
    });

    it('should remove 3D helpers from scene on dispose', () => {
      const scene = new THREE.Scene();
      debugOverlay.setScene(scene);

      debugOverlay.dispose();

      expect(scene.getObjectByName('debug-collision')).toBeUndefined();
      expect(scene.getObjectByName('debug-pathfinding')).toBeUndefined();
    });
  });
});
