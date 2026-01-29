/**
 * Tests for MazeRenderer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { MazeRenderer } from './MazeRenderer';
import { MazeGenerator } from './MazeGenerator';
import { CELL_SIZE, WALL_HEIGHT } from '../utils/Constants';

describe('MazeRenderer', () => {
  let scene: THREE.Scene;
  let renderer: MazeRenderer;
  let generator: MazeGenerator;

  beforeEach(() => {
    scene = new THREE.Scene();
    renderer = new MazeRenderer(scene);
    generator = new MazeGenerator({ width: 5, height: 5, seed: 12345 });
    generator.generate();
  });

  afterEach(() => {
    renderer.dispose();
  });

  describe('constructor', () => {
    it('should add maze group to scene', () => {
      const mazeGroup = scene.getObjectByName('maze');
      expect(mazeGroup).toBeDefined();
      expect(mazeGroup).toBeInstanceOf(THREE.Group);
    });

    it('should initialize with empty maze group', () => {
      const newScene = new THREE.Scene();
      const newRenderer = new MazeRenderer(newScene);
      const mazeGroup = newRenderer.getMazeGroup();
      expect(mazeGroup.children.length).toBe(0);
      newRenderer.dispose();
    });
  });

  describe('build', () => {
    it('should create floor mesh', () => {
      renderer.build(generator);
      const floor = renderer.getMazeGroup().getObjectByName('floor');
      expect(floor).toBeDefined();
      expect(floor).toBeInstanceOf(THREE.Mesh);
    });

    it('should create wall mesh', () => {
      renderer.build(generator);
      const walls = renderer.getMazeGroup().getObjectByName('walls');
      expect(walls).toBeDefined();
      expect(walls).toBeInstanceOf(THREE.InstancedMesh);
    });

    it('should create start marker', () => {
      renderer.build(generator);
      const startMarker = renderer.getMazeGroup().getObjectByName('startMarker');
      expect(startMarker).toBeDefined();
      expect(startMarker).toBeInstanceOf(THREE.Mesh);
    });

    it('should create exit marker', () => {
      renderer.build(generator);
      const exitMarker = renderer.getMazeGroup().getObjectByName('exitMarker');
      expect(exitMarker).toBeDefined();
      expect(exitMarker).toBeInstanceOf(THREE.Mesh);
    });

    it('should position start marker at maze start', () => {
      renderer.build(generator);
      const startMarker = renderer.getMazeGroup().getObjectByName('startMarker');
      const start = generator.getStart();

      expect(startMarker!.position.x).toBeCloseTo(start.x * CELL_SIZE);
      expect(startMarker!.position.z).toBeCloseTo(start.y * CELL_SIZE);
    });

    it('should position exit marker at maze exit', () => {
      renderer.build(generator);
      const exitMarker = renderer.getMazeGroup().getObjectByName('exitMarker');
      const exit = generator.getExit();

      expect(exitMarker!.position.x).toBeCloseTo(exit.x * CELL_SIZE);
      expect(exitMarker!.position.z).toBeCloseTo(exit.y * CELL_SIZE);
    });

    it('should create multiple wall instances', () => {
      renderer.build(generator);
      const walls = renderer.getMazeGroup().getObjectByName('walls') as THREE.InstancedMesh;

      // A 5x5 maze should have a significant number of walls
      expect(walls.count).toBeGreaterThan(10);
    });
  });

  describe('clear', () => {
    it('should remove all children from maze group', () => {
      renderer.build(generator);
      expect(renderer.getMazeGroup().children.length).toBeGreaterThan(0);

      renderer.clear();
      expect(renderer.getMazeGroup().children.length).toBe(0);
    });

    it('should allow rebuilding after clear', () => {
      renderer.build(generator);
      renderer.clear();
      renderer.build(generator);

      expect(renderer.getMazeGroup().children.length).toBeGreaterThan(0);
    });
  });

  describe('gridToWorld', () => {
    it('should convert grid coordinates to world position', () => {
      const worldPos = renderer.gridToWorld(2, 3);

      expect(worldPos.x).toBe(2 * CELL_SIZE);
      expect(worldPos.y).toBe(0);
      expect(worldPos.z).toBe(3 * CELL_SIZE);
    });

    it('should handle origin correctly', () => {
      const worldPos = renderer.gridToWorld(0, 0);

      expect(worldPos.x).toBe(0);
      expect(worldPos.y).toBe(0);
      expect(worldPos.z).toBe(0);
    });
  });

  describe('worldToGrid', () => {
    it('should convert world position to grid coordinates', () => {
      const gridPos = renderer.worldToGrid(2 * CELL_SIZE, 3 * CELL_SIZE);

      expect(gridPos.x).toBe(2);
      expect(gridPos.y).toBe(3);
    });

    it('should round to nearest cell', () => {
      const gridPos = renderer.worldToGrid(
        2 * CELL_SIZE + 1,
        3 * CELL_SIZE - 1
      );

      expect(gridPos.x).toBe(2);
      expect(gridPos.y).toBe(3);
    });
  });

  describe('update', () => {
    it('should animate exit marker', () => {
      renderer.build(generator);
      const exitMarker = renderer.getMazeGroup().getObjectByName('exitMarker');
      const initialRotation = exitMarker!.rotation.y;

      renderer.update(0.1);

      expect(exitMarker!.rotation.y).not.toBe(initialRotation);
    });
  });

  describe('dispose', () => {
    it('should remove maze group from scene', () => {
      renderer.build(generator);
      renderer.dispose();

      const mazeGroup = scene.getObjectByName('maze');
      expect(mazeGroup).toBeUndefined();
    });
  });

  describe('different maze sizes', () => {
    it('should handle small mazes', () => {
      const smallGenerator = new MazeGenerator({ width: 3, height: 3, seed: 1 });
      smallGenerator.generate();

      expect(() => renderer.build(smallGenerator)).not.toThrow();
      expect(renderer.getMazeGroup().children.length).toBeGreaterThan(0);
    });

    it('should handle large mazes', () => {
      const largeGenerator = new MazeGenerator({ width: 20, height: 20, seed: 1 });
      largeGenerator.generate();

      expect(() => renderer.build(largeGenerator)).not.toThrow();
      expect(renderer.getMazeGroup().children.length).toBeGreaterThan(0);
    });
  });
});
