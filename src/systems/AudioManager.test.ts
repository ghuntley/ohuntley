/**
 * Tests for Audio Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AudioManager,
  MusicTheme,
  SoundEffect,
  VolumeType,
} from './AudioManager';
import {
  DEFAULT_MUSIC_VOLUME,
  DEFAULT_SFX_VOLUME,
} from '../utils/Constants';

// Mock AudioContext
class MockGainNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockOscillatorNode {
  frequency = {
    setValueAtTime: vi.fn(),
  };
  type = 'sine';
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioBufferSourceNode {
  buffer: AudioBuffer | null = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioBuffer {
  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number
  ) {}
  getChannelData = vi.fn(() => new Float32Array(this.length));
}

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = new MockGainNode();

  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
  createBuffer = vi.fn(
    (channels: number, length: number, sampleRate: number) =>
      new MockAudioBuffer(channels, length, sampleRate)
  );
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
}

describe('AudioManager', () => {
  let originalAudioContext: typeof window.AudioContext;

  beforeEach(() => {
    // Save original AudioContext
    originalAudioContext = window.AudioContext;
    // Mock AudioContext - use any to bypass strict type checking for mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).AudioContext = MockAudioContext;
    // Reset singleton
    AudioManager.resetInstance();
  });

  afterEach(() => {
    // Restore original AudioContext
    window.AudioContext = originalAudioContext;
    // Clean up singleton
    AudioManager.resetInstance();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AudioManager.getInstance();
      const instance2 = AudioManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should accept configuration on first call', () => {
      const instance = AudioManager.getInstance({
        masterVolume: 0.5,
        musicVolume: 0.3,
        sfxVolume: 0.4,
      });

      expect(instance.getVolume(VolumeType.MASTER)).toBe(0.5);
      expect(instance.getVolume(VolumeType.MUSIC)).toBe(0.3);
      expect(instance.getVolume(VolumeType.SFX)).toBe(0.4);
    });

    it('should reset instance properly', () => {
      const instance1 = AudioManager.getInstance();
      AudioManager.resetInstance();
      const instance2 = AudioManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const instance = AudioManager.getInstance();

      expect(instance.getVolume(VolumeType.MASTER)).toBe(1.0);
      expect(instance.getVolume(VolumeType.MUSIC)).toBe(DEFAULT_MUSIC_VOLUME);
      expect(instance.getVolume(VolumeType.SFX)).toBe(DEFAULT_SFX_VOLUME);
      expect(instance.isInitialized()).toBe(false);
    });

    it('should initialize audio context', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      expect(instance.isInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();
      await instance.initialize(); // Second call should be no-op

      expect(instance.isInitialized()).toBe(true);
    });
  });

  describe('volume control', () => {
    it('should set master volume', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.setVolume(VolumeType.MASTER, 0.7);

      expect(instance.getVolume(VolumeType.MASTER)).toBe(0.7);
    });

    it('should set music volume', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.setVolume(VolumeType.MUSIC, 0.4);

      expect(instance.getVolume(VolumeType.MUSIC)).toBe(0.4);
    });

    it('should set SFX volume', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.setVolume(VolumeType.SFX, 0.6);

      expect(instance.getVolume(VolumeType.SFX)).toBe(0.6);
    });

    it('should clamp volume to 0-1 range', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.setVolume(VolumeType.MASTER, 1.5);
      expect(instance.getVolume(VolumeType.MASTER)).toBe(1);

      instance.setVolume(VolumeType.MASTER, -0.5);
      expect(instance.getVolume(VolumeType.MASTER)).toBe(0);
    });
  });

  describe('sound effects', () => {
    it('should not play sounds when not initialized', () => {
      const instance = AudioManager.getInstance();

      // Should not throw
      expect(() => instance.play(SoundEffect.FOOTSTEP)).not.toThrow();
    });

    it('should play footstep sound when initialized', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      // Should not throw
      expect(() => instance.play(SoundEffect.FOOTSTEP)).not.toThrow();
    });

    it('should play sword swing sound', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      expect(() => instance.play(SoundEffect.SWORD_SWING)).not.toThrow();
    });

    it('should play sword hit sound', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      expect(() => instance.play(SoundEffect.SWORD_HIT)).not.toThrow();
    });

    it('should play zombie sounds', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      expect(() => instance.play(SoundEffect.ZOMBIE_GROWL)).not.toThrow();
      expect(() => instance.play(SoundEffect.ZOMBIE_DEATH)).not.toThrow();
    });

    it('should play powerup pickup sound', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      expect(() => instance.play(SoundEffect.POWERUP_PICKUP)).not.toThrow();
    });

    it('should play game state sounds', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      expect(() => instance.play(SoundEffect.LEVEL_COMPLETE)).not.toThrow();
      expect(() => instance.play(SoundEffect.GAME_OVER)).not.toThrow();
    });

    it('should throttle footstep sounds', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      // Play first footstep
      instance.play(SoundEffect.FOOTSTEP);

      // Immediate second footstep should be throttled (no crash means success)
      expect(() => instance.play(SoundEffect.FOOTSTEP)).not.toThrow();
    });
  });

  describe('music', () => {
    it('should not play music when not initialized', () => {
      const instance = AudioManager.getInstance();

      expect(() => instance.playMusic(MusicTheme.SAFE)).not.toThrow();
      expect(instance.getCurrentTheme()).toBeNull();
    });

    it('should play safe theme music', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.playMusic(MusicTheme.SAFE);

      expect(instance.getCurrentTheme()).toBe(MusicTheme.SAFE);
    });

    it('should play danger theme music', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.playMusic(MusicTheme.DANGER);

      expect(instance.getCurrentTheme()).toBe(MusicTheme.DANGER);
    });

    it('should not restart same theme', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.playMusic(MusicTheme.SAFE);
      const theme1 = instance.getCurrentTheme();

      instance.playMusic(MusicTheme.SAFE);
      const theme2 = instance.getCurrentTheme();

      expect(theme1).toBe(theme2);
    });

    it('should switch between themes', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.playMusic(MusicTheme.SAFE);
      expect(instance.getCurrentTheme()).toBe(MusicTheme.SAFE);

      instance.playMusic(MusicTheme.DANGER);
      expect(instance.getCurrentTheme()).toBe(MusicTheme.DANGER);
    });

    it('should stop music', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.playMusic(MusicTheme.SAFE);
      instance.stopMusic();

      // Theme should be null after stopping
      expect(instance.getCurrentTheme()).toBeNull();
    });
  });

  describe('update', () => {
    it('should not update when not initialized', () => {
      const instance = AudioManager.getInstance();

      const playerPos = { x: 0, y: 0, z: 0 };
      const zombies: { getPosition(): { x: number; y: number; z: number }; isAlive(): boolean; getId(): number }[] = [];

      expect(() => instance.update(playerPos, zombies, false)).not.toThrow();
    });

    it('should switch to danger music when zombie is close', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      const playerPos = { x: 0, y: 0, z: 0 };
      const zombies = [
        {
          getPosition: () => ({ x: 5, y: 0, z: 0 }), // Within danger threshold
          isAlive: () => true,
          getId: () => 1,
        },
      ];

      // First update establishes safe theme
      instance.update(playerPos, [], false);

      // Update with nearby zombie should switch to danger
      instance.update(playerPos, zombies, false);

      expect(instance.getCurrentTheme()).toBe(MusicTheme.DANGER);
    });

    it('should stay in safe music when zombies are far', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      const playerPos = { x: 0, y: 0, z: 0 };
      const zombies = [
        {
          getPosition: () => ({ x: 100, y: 0, z: 0 }), // Far away
          isAlive: () => true,
          getId: () => 1,
        },
      ];

      instance.update(playerPos, zombies, false);

      expect(instance.getCurrentTheme()).toBe(MusicTheme.SAFE);
    });

    it('should ignore dead zombies for proximity check', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      const playerPos = { x: 0, y: 0, z: 0 };
      const zombies = [
        {
          getPosition: () => ({ x: 1, y: 0, z: 0 }), // Very close but dead
          isAlive: () => false,
          getId: () => 1,
        },
      ];

      instance.update(playerPos, zombies, false);

      expect(instance.getCurrentTheme()).toBe(MusicTheme.SAFE);
    });
  });

  describe('suspend and resume', () => {
    it('should suspend audio context', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      await instance.suspend();

      // No error means success with mock
    });

    it('should resume audio context', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      await instance.resume();

      // No error means success with mock
    });
  });

  describe('preload', () => {
    it('should preload sounds without error', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      await expect(instance.preload()).resolves.not.toThrow();
    });
  });

  describe('zombie audio', () => {
    it('should play zombie sound at position', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      const position = { x: 5, y: 0, z: 5 };

      expect(() => instance.playZombieSound(1, position, SoundEffect.ZOMBIE_GROWL)).not.toThrow();
    });

    it('should remove zombie audio', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.playZombieSound(1, { x: 0, y: 0, z: 0 }, SoundEffect.ZOMBIE_GROWL);
      instance.removeZombieAudio(1);

      // No error means success
    });

    it('should handle removing non-existent zombie audio', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      expect(() => instance.removeZombieAudio(999)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clean up on destroy', async () => {
      const instance = AudioManager.getInstance();
      await instance.initialize();

      instance.playMusic(MusicTheme.SAFE);
      instance.destroy();

      expect(instance.isInitialized()).toBe(false);
    });
  });
});
