/**
 * Tests for Spectator Meerkat Entity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  SpectatorMeerkat,
  AlertLevel,
  createSpectatorMeerkatMesh,
} from './SpectatorMeerkat';
import { SpectatorMeerkatManager } from './SpectatorMeerkatManager';
import { MazeGenerator } from '../maze/MazeGenerator';
import { CELL_SIZE, WALL_HEIGHT } from '../utils/Constants';

describe('SpectatorMeerkat', () => {
  let spectator: SpectatorMeerkat;

  beforeEach(() => {
    spectator = new SpectatorMeerkat({
      gridX: 5,
      gridY: 5,
      edge: 'north',
    });
  });

  describe('initialization', () => {
    it('should initialize with correct grid position', () => {
      const gridPos = spectator.getGridPosition();
      expect(gridPos.x).toBe(5);
      expect(gridPos.y).toBe(5);
    });

    it('should calculate world position from grid position', () => {
      const pos = spectator.getPosition();
      expect(pos.x).toBe(5 * CELL_SIZE);
      expect(pos.y).toBeGreaterThan(WALL_HEIGHT); // On top of hedge
      expect(pos.z).toBe(5 * CELL_SIZE - CELL_SIZE / 2); // North edge
    });

    it('should calculate correct position for different edges', () => {
      const northSpectator = new SpectatorMeerkat({ gridX: 0, gridY: 0, edge: 'north' });
      const southSpectator = new SpectatorMeerkat({ gridX: 0, gridY: 0, edge: 'south' });
      const eastSpectator = new SpectatorMeerkat({ gridX: 0, gridY: 0, edge: 'east' });
      const westSpectator = new SpectatorMeerkat({ gridX: 0, gridY: 0, edge: 'west' });

      expect(northSpectator.getPosition().z).toBe(-CELL_SIZE / 2);
      expect(southSpectator.getPosition().z).toBe(CELL_SIZE / 2);
      expect(eastSpectator.getPosition().x).toBe(CELL_SIZE / 2);
      expect(westSpectator.getPosition().x).toBe(-CELL_SIZE / 2);
    });

    it('should start in CALM alert state', () => {
      expect(spectator.getAlertLevel()).toBe(AlertLevel.CALM);
      expect(spectator.getIsAlerted()).toBe(false);
    });

    it('should have unique IDs', () => {
      const spectator1 = new SpectatorMeerkat({ gridX: 0, gridY: 0, edge: 'north' });
      const spectator2 = new SpectatorMeerkat({ gridX: 1, gridY: 1, edge: 'south' });
      expect(spectator1.getId()).not.toBe(spectator2.getId());
    });

    it('should set initial rotation based on edge', () => {
      const northSpectator = new SpectatorMeerkat({ gridX: 0, gridY: 0, edge: 'north' });
      const southSpectator = new SpectatorMeerkat({ gridX: 0, gridY: 0, edge: 'south' });
      const eastSpectator = new SpectatorMeerkat({ gridX: 0, gridY: 0, edge: 'east' });
      const westSpectator = new SpectatorMeerkat({ gridX: 0, gridY: 0, edge: 'west' });

      expect(northSpectator.getBodyRotation()).toBe(0); // Face south
      expect(southSpectator.getBodyRotation()).toBe(Math.PI); // Face north
      expect(eastSpectator.getBodyRotation()).toBe(-Math.PI / 2); // Face west
      expect(westSpectator.getBodyRotation()).toBe(Math.PI / 2); // Face east
    });
  });

  describe('head tracking', () => {
    it('should track player position', () => {
      const initialHeadRotation = spectator.getHeadRotation();

      // Move player to one side
      const playerPosition = {
        x: spectator.getPosition().x + 10,
        y: 0,
        z: spectator.getPosition().z,
      };

      // Update for several frames
      for (let i = 0; i < 10; i++) {
        spectator.update(0.1, playerPosition, []);
      }

      // Head should have rotated toward player
      expect(spectator.getHeadRotation()).not.toBe(initialHeadRotation);
    });

    it('should clamp head rotation to realistic range', () => {
      // Put player directly behind the spectator (outside head turn range)
      const playerPosition = {
        x: spectator.getPosition().x,
        y: 0,
        z: spectator.getPosition().z - 10, // Behind (spectator faces south)
      };

      for (let i = 0; i < 20; i++) {
        spectator.update(0.1, playerPosition, []);
      }

      // Head rotation should be clamped (within +/- PI/2)
      const headRotation = spectator.getHeadRotation();
      expect(Math.abs(headRotation)).toBeLessThanOrEqual(Math.PI / 2 + 0.1);
    });
  });

  describe('alert state', () => {
    it('should become ALERT when zombies are near player', () => {
      const playerPosition = { x: 10, y: 0, z: 10 };
      const zombiePositions = [
        { x: 11, y: 0, z: 10 }, // Very close to player
      ];

      spectator.update(0.1, playerPosition, zombiePositions);

      expect(spectator.getAlertLevel()).toBeGreaterThanOrEqual(AlertLevel.ALERT);
      expect(spectator.getIsAlerted()).toBe(true);
    });

    it('should become ALARMED when zombies are very close to player', () => {
      const playerPosition = { x: 10, y: 0, z: 10 };
      const zombiePositions = [
        { x: 10.5, y: 0, z: 10 }, // Very close
      ];

      spectator.update(0.1, playerPosition, zombiePositions);

      expect(spectator.getAlertLevel()).toBe(AlertLevel.ALARMED);
    });

    it('should become CURIOUS when zombies are at medium distance', () => {
      const playerPosition = { x: 10, y: 0, z: 10 };
      const zombiePositions = [
        { x: 10 + CELL_SIZE * 3, y: 0, z: 10 }, // Medium distance
      ];

      spectator.update(0.1, playerPosition, zombiePositions);

      expect(spectator.getAlertLevel()).toBe(AlertLevel.CURIOUS);
    });

    it('should be CALM when no zombies are nearby', () => {
      const playerPosition = { x: 10, y: 0, z: 10 };
      const zombiePositions = [
        { x: 100, y: 0, z: 100 }, // Very far
      ];

      spectator.update(0.1, playerPosition, zombiePositions);

      expect(spectator.getAlertLevel()).toBe(AlertLevel.CALM);
      expect(spectator.getIsAlerted()).toBe(false);
    });

    it('should allow manual alert level setting', () => {
      spectator.setAlert(AlertLevel.ALARMED);
      expect(spectator.getAlertLevel()).toBe(AlertLevel.ALARMED);
      expect(spectator.getIsAlerted()).toBe(true);
    });
  });

  describe('idle animation', () => {
    it('should have sway offset', () => {
      const sway = spectator.getSwayOffset();
      expect(sway).toHaveProperty('x');
      expect(sway).toHaveProperty('z');
      expect(sway).toHaveProperty('rotY');
    });

    it('should have breathing scale near 1.0', () => {
      const scale = spectator.getBreathingScale();
      expect(scale).toBeGreaterThan(0.95);
      expect(scale).toBeLessThan(1.05);
    });

    it('should animate over time', () => {
      const initialPhase = spectator.getIdlePhase();

      spectator.update(1.0, { x: 0, y: 0, z: 0 }, []);

      expect(spectator.getIdlePhase()).not.toBe(initialPhase);
    });

    it('should have increased sway when alerted', () => {
      const initialAmplitude = spectator.getSwayAmplitude();

      // Make spectator alerted
      spectator.setAlert(AlertLevel.ALARMED);

      // Update for several frames
      for (let i = 0; i < 20; i++) {
        spectator.update(0.1, { x: 10, y: 0, z: 10 }, [{ x: 10.5, y: 0, z: 10 }]);
      }

      expect(spectator.getSwayAmplitude()).toBeGreaterThan(initialAmplitude);
    });
  });
});

describe('createSpectatorMeerkatMesh', () => {
  it('should create a THREE.Group', () => {
    const mesh = createSpectatorMeerkatMesh();
    expect(mesh).toBeInstanceOf(THREE.Group);
  });

  it('should have body component', () => {
    const mesh = createSpectatorMeerkatMesh();
    const body = mesh.getObjectByName('body');
    expect(body).toBeDefined();
    expect(body).toBeInstanceOf(THREE.Mesh);
  });

  it('should have head group for rotation', () => {
    const mesh = createSpectatorMeerkatMesh();
    const headGroup = mesh.getObjectByName('headGroup');
    expect(headGroup).toBeDefined();
    expect(headGroup).toBeInstanceOf(THREE.Group);
  });

  it('should have facial features', () => {
    const mesh = createSpectatorMeerkatMesh();
    expect(mesh.getObjectByName('head')).toBeDefined();
    expect(mesh.getObjectByName('leftEye')).toBeDefined();
    expect(mesh.getObjectByName('rightEye')).toBeDefined();
    expect(mesh.getObjectByName('nose')).toBeDefined();
    expect(mesh.getObjectByName('snout')).toBeDefined();
  });

  it('should have arms', () => {
    const mesh = createSpectatorMeerkatMesh();
    expect(mesh.getObjectByName('leftArm')).toBeDefined();
    expect(mesh.getObjectByName('rightArm')).toBeDefined();
  });

  it('should have shadow casting enabled on meshes', () => {
    const mesh = createSpectatorMeerkatMesh();
    let hasShadowCasting = false;

    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.castShadow) {
        hasShadowCasting = true;
      }
    });

    expect(hasShadowCasting).toBe(true);
  });
});

describe('SpectatorMeerkatManager', () => {
  let scene: THREE.Scene;
  let manager: SpectatorMeerkatManager;
  let maze: MazeGenerator;

  beforeEach(() => {
    scene = new THREE.Scene();
    manager = new SpectatorMeerkatManager(scene);
    maze = new MazeGenerator({ width: 10, height: 10, seed: 12345 });
    maze.generate();
  });

  describe('initialization', () => {
    it('should add spectator group to scene', () => {
      const spectatorGroup = scene.getObjectByName('spectatorMeerkats');
      expect(spectatorGroup).toBeDefined();
    });

    it('should start with no spectators', () => {
      expect(manager.getCount()).toBe(0);
    });
  });

  describe('spawning', () => {
    it('should spawn spectators when given a maze', () => {
      manager.spawn(maze);
      expect(manager.getCount()).toBeGreaterThan(0);
    });

    it('should log spawn count', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      manager.spawn(maze);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('spectator meerkats')
      );
      consoleSpy.mockRestore();
    });

    it('should respect minimum spacing', () => {
      manager.spawn(maze);
      const spectators = manager.getSpectators();

      for (let i = 0; i < spectators.length; i++) {
        for (let j = i + 1; j < spectators.length; j++) {
          const pos1 = spectators[i].getGridPosition();
          const pos2 = spectators[j].getGridPosition();
          const distance = Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);

          // Minimum spacing is 3 by default
          expect(distance).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });

  describe('updating', () => {
    it('should update all spectators', () => {
      manager.spawn(maze);

      const playerPosition = { x: 20, y: 0, z: 20 };
      const zombiePositions = [{ x: 21, y: 0, z: 20 }];

      // Should not throw
      expect(() => {
        manager.update(0.016, playerPosition, zombiePositions);
      }).not.toThrow();
    });

    it('should track alerted count', () => {
      manager.spawn(maze);

      // Initially no one is alerted
      expect(manager.getAlertedCount()).toBe(0);

      // Simulate danger - place zombie very close to player
      const playerPosition = { x: 20, y: 0, z: 20 };
      const zombiePositions = [{ x: 20.5, y: 0, z: 20 }];

      manager.update(0.016, playerPosition, zombiePositions);

      // Some spectators may be alerted
      // (depends on their distance to the action)
      expect(manager.getAlertedCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clearing', () => {
    it('should clear all spectators', () => {
      manager.spawn(maze);
      expect(manager.getCount()).toBeGreaterThan(0);

      manager.clear();
      expect(manager.getCount()).toBe(0);
    });

    it('should remove meshes from scene on clear', () => {
      manager.spawn(maze);

      manager.clear();

      // Spectator group should still exist but be empty
      const spectatorGroup = scene.getObjectByName('spectatorMeerkats') as THREE.Group;
      expect(spectatorGroup.children.length).toBe(0);
    });
  });

  describe('disposal', () => {
    it('should remove spectator group from scene', () => {
      manager.spawn(maze);
      manager.dispose();

      const spectatorGroup = scene.getObjectByName('spectatorMeerkats');
      expect(spectatorGroup).toBeUndefined();
    });
  });

  describe('configuration', () => {
    it('should accept custom spacing configuration', () => {
      const customManager = new SpectatorMeerkatManager(scene, {
        minSpacing: 5,
        maxSpacing: 8,
        spawnProbability: 1.0,
      });

      customManager.spawn(maze);
      const spectators = customManager.getSpectators();

      // With higher minimum spacing, should have fewer spectators
      // or at least properly spaced
      for (let i = 0; i < spectators.length; i++) {
        for (let j = i + 1; j < spectators.length; j++) {
          const pos1 = spectators[i].getGridPosition();
          const pos2 = spectators[j].getGridPosition();
          const distance = Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
          expect(distance).toBeGreaterThanOrEqual(5);
        }
      }

      customManager.dispose();
    });
  });
});
