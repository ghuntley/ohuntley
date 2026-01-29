/**
 * Audio Manager for Meerkat Maze Runner
 * Manages background music, sound effects, and spatial audio
 */

import * as THREE from 'three';
import {
  MUSIC_CROSSFADE_DURATION,
  DEFAULT_MUSIC_VOLUME,
  DEFAULT_SFX_VOLUME,
  ZOMBIE_DETECTION_RADIUS,
} from '../utils/Constants';
import { Position } from '../entities/Player';

/** Music theme types */
export enum MusicTheme {
  SAFE = 'SAFE',
  DANGER = 'DANGER',
}

/** Sound effect names */
export enum SoundEffect {
  FOOTSTEP = 'FOOTSTEP',
  SWORD_SWING = 'SWORD_SWING',
  SWORD_HIT = 'SWORD_HIT',
  ZOMBIE_GROWL = 'ZOMBIE_GROWL',
  ZOMBIE_DEATH = 'ZOMBIE_DEATH',
  POWERUP_PICKUP = 'POWERUP_PICKUP',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
  TIMER_WARNING = 'TIMER_WARNING',
  TIMER_CRITICAL = 'TIMER_CRITICAL',
  MEERKAT_CHIRP = 'MEERKAT_CHIRP',
  MEERKAT_ALARM = 'MEERKAT_ALARM',
}

/** Volume types for control */
export enum VolumeType {
  MASTER = 'MASTER',
  MUSIC = 'MUSIC',
  SFX = 'SFX',
}

/** Audio manager configuration */
export interface AudioManagerConfig {
  masterVolume?: number;
  musicVolume?: number;
  sfxVolume?: number;
  crossfadeDuration?: number;
}

// Note: Sound pool types reserved for future use with real audio files
// interface SoundPoolEntry {
//   source: AudioBufferSourceNode;
//   inUse: boolean;
// }

/**
 * Synthetic sound generator using Web Audio API
 * Creates placeholder sounds that can be replaced with real audio files later
 */
class SyntheticSoundGenerator {
  private context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Create a footstep sound (short low-frequency thump)
   */
  createFootstep(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.08;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.exp(-t * 40);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create a sword swing sound (whoosh)
   */
  createSwordSwing(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.2;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.sin(Math.PI * t / duration);
      const frequency = 200 + (1 - t / duration) * 800;
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.2 +
                (Math.random() * 2 - 1) * envelope * 0.3;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create a sword hit sound (metallic clang)
   */
  createSwordHit(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.3;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.exp(-t * 10);
      data[i] = (Math.sin(2 * Math.PI * 800 * t) * 0.5 +
                 Math.sin(2 * Math.PI * 1200 * t) * 0.3 +
                 Math.sin(2 * Math.PI * 1600 * t) * 0.2) * envelope * 0.4;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create a zombie growl sound (low frequency rumble)
   */
  createZombieGrowl(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.5;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.sin(Math.PI * t / duration);
      const frequency = 60 + Math.sin(t * 20) * 20;
      data[i] = (Math.sin(2 * Math.PI * frequency * t) +
                 Math.sin(2 * Math.PI * frequency * 1.5 * t) * 0.5 +
                 (Math.random() * 2 - 1) * 0.2) * envelope * 0.3;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create a zombie death sound (descending growl)
   */
  createZombieDeath(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.6;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.exp(-t * 3);
      const frequency = 150 * Math.exp(-t * 2);
      data[i] = (Math.sin(2 * Math.PI * frequency * t) +
                 Math.sin(2 * Math.PI * frequency * 2 * t) * 0.3 +
                 (Math.random() * 2 - 1) * 0.3) * envelope * 0.4;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create a power-up pickup sound (ascending chime)
   */
  createPowerupPickup(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.3;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.exp(-t * 5);
      const frequency = 400 + (t / duration) * 400;
      data[i] = (Math.sin(2 * Math.PI * frequency * t) +
                 Math.sin(2 * Math.PI * frequency * 1.5 * t) * 0.5 +
                 Math.sin(2 * Math.PI * frequency * 2 * t) * 0.25) * envelope * 0.3;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create a level complete sound (triumphant fanfare)
   */
  createLevelComplete(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.8;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      let sample = 0;

      for (let j = 0; j < notes.length; j++) {
        const noteStart = j * 0.1;
        if (t >= noteStart) {
          const noteT = t - noteStart;
          const envelope = Math.exp(-noteT * 3);
          sample += Math.sin(2 * Math.PI * notes[j] * noteT) * envelope * 0.2;
        }
      }

      data[i] = sample;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create a game over sound (descending doom)
   */
  createGameOver(destination: AudioNode): AudioBufferSourceNode {
    const duration = 1.0;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.exp(-t * 1.5);
      const frequency = 200 * Math.exp(-t * 1);
      data[i] = (Math.sin(2 * Math.PI * frequency * t) +
                 Math.sin(2 * Math.PI * frequency * 0.5 * t) * 0.5 +
                 (Math.random() * 2 - 1) * 0.1) * envelope * 0.4;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create timer warning sound (slow ticking)
   */
  createTimerWarning(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.1;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.exp(-t * 30);
      // Tick sound - short metallic click
      data[i] = (Math.sin(2 * Math.PI * 1000 * t) * 0.5 +
                 Math.sin(2 * Math.PI * 2000 * t) * 0.3) * envelope * 0.3;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create timer critical sound (fast ticking with higher pitch)
   */
  createTimerCritical(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.08;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.exp(-t * 40);
      // Higher pitch urgent tick
      data[i] = (Math.sin(2 * Math.PI * 1500 * t) * 0.5 +
                 Math.sin(2 * Math.PI * 3000 * t) * 0.3) * envelope * 0.4;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create meerkat chirp sound (soft ambient chirp)
   */
  createMeerkatChirp(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.15;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.sin(Math.PI * t / duration);
      // Soft chirp with frequency modulation
      const frequency = 800 + Math.sin(t * 60) * 200;
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.15;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create meerkat alarm sound (sharp warning squeak)
   */
  createMeerkatAlarm(destination: AudioNode): AudioBufferSourceNode {
    const duration = 0.25;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / this.context.sampleRate;
      const envelope = Math.exp(-t * 8);
      // Sharp alarm squeak with rapid frequency changes
      const frequency = 1200 + Math.sin(t * 100) * 400;
      data[i] = (Math.sin(2 * Math.PI * frequency * t) * 0.6 +
                 Math.sin(2 * Math.PI * frequency * 1.5 * t) * 0.3) * envelope * 0.25;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    return source;
  }

  /**
   * Create background music (procedural ambient music)
   */
  createMusicLoop(theme: MusicTheme): { oscillators: OscillatorNode[], gainNodes: GainNode[] } {
    const oscillators: OscillatorNode[] = [];
    const gainNodes: GainNode[] = [];

    if (theme === MusicTheme.SAFE) {
      // Calm, exploration music - soft pads
      const baseFreq = 110; // A2

      for (let i = 0; i < 3; i++) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * (i === 0 ? 1 : i === 1 ? 1.5 : 2), this.context.currentTime);

        // Subtle LFO for movement
        const lfo = this.context.createOscillator();
        const lfoGain = this.context.createGain();
        lfo.frequency.setValueAtTime(0.1 + i * 0.05, this.context.currentTime);
        lfoGain.gain.setValueAtTime(2, this.context.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        gain.gain.setValueAtTime(0.08 / (i + 1), this.context.currentTime);

        osc.connect(gain);
        oscillators.push(osc);
        gainNodes.push(gain);
      }
    } else {
      // Danger/chase music - tense, faster
      const baseFreq = 82.41; // E2

      for (let i = 0; i < 4; i++) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = i === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(baseFreq * (i === 0 ? 1 : i === 1 ? 1.33 : i === 2 ? 2 : 2.66), this.context.currentTime);

        // Pulsing for tension
        const lfo = this.context.createOscillator();
        const lfoGain = this.context.createGain();
        lfo.frequency.setValueAtTime(2 + i * 0.5, this.context.currentTime);
        lfoGain.gain.setValueAtTime(0.02 * (i + 1), this.context.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start();

        gain.gain.setValueAtTime(0.05 / (i + 1), this.context.currentTime);

        osc.connect(gain);
        oscillators.push(osc);
        gainNodes.push(gain);
      }
    }

    return { oscillators, gainNodes };
  }
}

/**
 * AudioManager class
 * Singleton that manages all game audio
 */
export class AudioManager {
  private static instance: AudioManager | null = null;

  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Volume levels (0-1)
  private masterVolume: number;
  private musicVolume: number;
  private sfxVolume: number;

  // Music state
  private currentTheme: MusicTheme | null = null;
  private currentMusicOscillators: OscillatorNode[] = [];
  private currentMusicGains: GainNode[] = [];
  private crossfadeDuration: number;
  private isCrossfading: boolean = false;

  // Sound generator
  private soundGenerator: SyntheticSoundGenerator | null = null;

  // Sound timing for frequently used sounds
  private footstepLastPlayTime: number = 0;
  private readonly FOOTSTEP_MIN_INTERVAL = 0.25; // seconds between footsteps

  // Timer warning sound timing
  private timerWarningLastPlayTime: number = 0;
  private timerCriticalLastPlayTime: number = 0;
  private readonly TIMER_WARNING_INTERVAL = 1.0; // 1 tick per second
  private readonly TIMER_CRITICAL_INTERVAL = 0.5; // 2 ticks per second

  // Meerkat sound timing
  private meerkatChirpLastPlayTime: number = 0;
  private meerkatAlarmLastPlayTime: number = 0;
  private readonly MEERKAT_CHIRP_INTERVAL = 3.0; // occasional chirps
  private readonly MEERKAT_ALARM_INTERVAL = 0.8; // more frequent when alarmed

  // Initialization state
  private initialized: boolean = false;

  // Three.js audio listener for spatial audio
  private listener: THREE.AudioListener | null = null;

  // Store zombie positional audio sources
  private zombieAudioSources: Map<number, THREE.PositionalAudio> = new Map();

  private constructor(config: AudioManagerConfig = {}) {
    this.masterVolume = config.masterVolume ?? 1.0;
    this.musicVolume = config.musicVolume ?? DEFAULT_MUSIC_VOLUME;
    this.sfxVolume = config.sfxVolume ?? DEFAULT_SFX_VOLUME;
    this.crossfadeDuration = config.crossfadeDuration ?? MUSIC_CROSSFADE_DURATION;
  }

  /** Get the singleton instance */
  static getInstance(config?: AudioManagerConfig): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager(config);
    }
    return AudioManager.instance;
  }

  /** Reset the singleton (for testing) */
  static resetInstance(): void {
    if (AudioManager.instance) {
      AudioManager.instance.destroy();
      AudioManager.instance = null;
    }
  }

  /**
   * Initialize the audio system
   * Must be called after user interaction due to browser autoplay policies
   */
  async initialize(camera?: THREE.Camera): Promise<void> {
    if (this.initialized) return;

    try {
      // Create audio context
      this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      // Resume context if suspended (browser autoplay policy)
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      // Create gain nodes
      this.masterGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();

      // Connect gain node chain
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);

      // Set initial volumes
      this.updateGainLevels();

      // Initialize sound generator
      this.soundGenerator = new SyntheticSoundGenerator(this.context);

      // Initialize Three.js audio listener for spatial audio
      if (camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);
      }

      this.initialized = true;
      console.log('AudioManager initialized');
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
    }
  }

  /**
   * Clean up audio resources
   */
  destroy(): void {
    this.stopMusic();

    // Clean up zombie audio sources
    this.zombieAudioSources.forEach((audio) => {
      audio.stop();
      audio.disconnect();
    });
    this.zombieAudioSources.clear();

    // Clean up listener
    if (this.listener) {
      this.listener.parent?.remove(this.listener);
      this.listener = null;
    }

    // Close audio context
    if (this.context && this.context.state !== 'closed') {
      this.context.close();
    }

    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.soundGenerator = null;
    this.initialized = false;
  }

  /**
   * Check if audio system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Play a sound effect
   */
  play(sound: SoundEffect): void {
    if (!this.initialized || !this.context || !this.soundGenerator || !this.sfxGain) {
      return;
    }

    const now = this.context.currentTime;

    // Enforce minimum intervals for repeated sounds
    if (sound === SoundEffect.FOOTSTEP) {
      if (now - this.footstepLastPlayTime < this.FOOTSTEP_MIN_INTERVAL) {
        return;
      }
      this.footstepLastPlayTime = now;
    } else if (sound === SoundEffect.TIMER_WARNING) {
      if (now - this.timerWarningLastPlayTime < this.TIMER_WARNING_INTERVAL) {
        return;
      }
      this.timerWarningLastPlayTime = now;
    } else if (sound === SoundEffect.TIMER_CRITICAL) {
      if (now - this.timerCriticalLastPlayTime < this.TIMER_CRITICAL_INTERVAL) {
        return;
      }
      this.timerCriticalLastPlayTime = now;
    } else if (sound === SoundEffect.MEERKAT_CHIRP) {
      if (now - this.meerkatChirpLastPlayTime < this.MEERKAT_CHIRP_INTERVAL) {
        return;
      }
      this.meerkatChirpLastPlayTime = now;
    } else if (sound === SoundEffect.MEERKAT_ALARM) {
      if (now - this.meerkatAlarmLastPlayTime < this.MEERKAT_ALARM_INTERVAL) {
        return;
      }
      this.meerkatAlarmLastPlayTime = now;
    }

    let source: AudioBufferSourceNode;

    switch (sound) {
      case SoundEffect.FOOTSTEP:
        source = this.soundGenerator.createFootstep(this.sfxGain);
        break;
      case SoundEffect.SWORD_SWING:
        source = this.soundGenerator.createSwordSwing(this.sfxGain);
        break;
      case SoundEffect.SWORD_HIT:
        source = this.soundGenerator.createSwordHit(this.sfxGain);
        break;
      case SoundEffect.ZOMBIE_GROWL:
        source = this.soundGenerator.createZombieGrowl(this.sfxGain);
        break;
      case SoundEffect.ZOMBIE_DEATH:
        source = this.soundGenerator.createZombieDeath(this.sfxGain);
        break;
      case SoundEffect.POWERUP_PICKUP:
        source = this.soundGenerator.createPowerupPickup(this.sfxGain);
        break;
      case SoundEffect.LEVEL_COMPLETE:
        source = this.soundGenerator.createLevelComplete(this.sfxGain);
        break;
      case SoundEffect.GAME_OVER:
        source = this.soundGenerator.createGameOver(this.sfxGain);
        break;
      case SoundEffect.TIMER_WARNING:
        source = this.soundGenerator.createTimerWarning(this.sfxGain);
        break;
      case SoundEffect.TIMER_CRITICAL:
        source = this.soundGenerator.createTimerCritical(this.sfxGain);
        break;
      case SoundEffect.MEERKAT_CHIRP:
        source = this.soundGenerator.createMeerkatChirp(this.sfxGain);
        break;
      case SoundEffect.MEERKAT_ALARM:
        source = this.soundGenerator.createMeerkatAlarm(this.sfxGain);
        break;
      default:
        return;
    }

    source.start();
  }

  /**
   * Play background music with crossfade
   */
  playMusic(theme: MusicTheme): void {
    if (!this.initialized || !this.context || !this.soundGenerator || !this.musicGain) {
      return;
    }

    // Don't restart if same theme is already playing
    if (this.currentTheme === theme && !this.isCrossfading) {
      return;
    }

    const { oscillators, gainNodes } = this.soundGenerator.createMusicLoop(theme);

    // Connect all gain nodes to music gain
    gainNodes.forEach((gain) => gain.connect(this.musicGain!));

    if (this.currentMusicOscillators.length > 0) {
      // Crossfade
      this.crossfade(oscillators, gainNodes);
    } else {
      // Start fresh
      oscillators.forEach((osc) => osc.start());
      this.currentMusicOscillators = oscillators;
      this.currentMusicGains = gainNodes;
    }

    this.currentTheme = theme;
  }

  /**
   * Crossfade between current music and new music
   */
  private crossfade(newOscillators: OscillatorNode[], newGains: GainNode[]): void {
    if (!this.context) return;

    this.isCrossfading = true;
    const now = this.context.currentTime;
    const fadeEnd = now + this.crossfadeDuration;

    // Fade out current music
    const oldGains = this.currentMusicGains;
    const oldOscillators = this.currentMusicOscillators;

    oldGains.forEach((gain) => {
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, fadeEnd);
    });

    // Start new music faded in
    newGains.forEach((gain) => {
      const targetValue = gain.gain.value;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(targetValue, fadeEnd);
    });

    newOscillators.forEach((osc) => osc.start());

    // Clean up old oscillators after crossfade
    setTimeout(() => {
      oldOscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Already stopped
        }
      });
      this.isCrossfading = false;
    }, this.crossfadeDuration * 1000);

    this.currentMusicOscillators = newOscillators;
    this.currentMusicGains = newGains;
  }

  /**
   * Stop all background music
   */
  stopMusic(): void {
    if (!this.context) return;

    const now = this.context.currentTime;
    const fadeEnd = now + 0.5;

    // Fade out current music
    this.currentMusicGains.forEach((gain) => {
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, fadeEnd);
    });

    // Stop oscillators after fade
    const oscillatorsToStop = this.currentMusicOscillators;
    setTimeout(() => {
      oscillatorsToStop.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Already stopped
        }
      });
    }, 500);

    this.currentMusicOscillators = [];
    this.currentMusicGains = [];
    this.currentTheme = null;
  }

  /**
   * Set volume for a specific type
   */
  setVolume(type: VolumeType, value: number): void {
    const clampedValue = Math.max(0, Math.min(1, value));

    switch (type) {
      case VolumeType.MASTER:
        this.masterVolume = clampedValue;
        break;
      case VolumeType.MUSIC:
        this.musicVolume = clampedValue;
        break;
      case VolumeType.SFX:
        this.sfxVolume = clampedValue;
        break;
    }

    this.updateGainLevels();
  }

  /**
   * Get volume for a specific type
   */
  getVolume(type: VolumeType): number {
    switch (type) {
      case VolumeType.MASTER:
        return this.masterVolume;
      case VolumeType.MUSIC:
        return this.musicVolume;
      case VolumeType.SFX:
        return this.sfxVolume;
    }
  }

  /**
   * Update gain node levels based on volume settings
   */
  private updateGainLevels(): void {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.context?.currentTime || 0);
    }
    if (this.musicGain) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.context?.currentTime || 0);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.context?.currentTime || 0);
    }
  }

  /**
   * Update audio based on game state
   * Switches music based on zombie proximity
   */
  update(
    playerPosition: Position,
    zombies: Array<{ getPosition(): Position; isAlive(): boolean; getId(): number }>,
    isPlayerMoving: boolean
  ): void {
    if (!this.initialized) return;

    // Play footstep sounds when player is moving
    if (isPlayerMoving) {
      this.play(SoundEffect.FOOTSTEP);
    }

    // Check zombie proximity for music theme
    let closestZombieDistance = Infinity;

    zombies.forEach((zombie) => {
      if (!zombie.isAlive()) return;

      const zombiePos = zombie.getPosition();
      const dx = zombiePos.x - playerPosition.x;
      const dz = zombiePos.z - playerPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < closestZombieDistance) {
        closestZombieDistance = distance;
      }
    });

    // Switch music based on closest zombie distance
    const dangerThreshold = ZOMBIE_DETECTION_RADIUS * 1.5;
    const targetTheme = closestZombieDistance < dangerThreshold ? MusicTheme.DANGER : MusicTheme.SAFE;

    if (this.currentTheme !== targetTheme) {
      this.playMusic(targetTheme);
    }
  }

  /**
   * Play spatial audio at a specific position (for zombies)
   */
  playZombieSound(zombieId: number, position: Position, sound: SoundEffect): void {
    if (!this.initialized || !this.listener || !this.context || !this.soundGenerator) {
      return;
    }

    // Create positional audio if doesn't exist
    if (!this.zombieAudioSources.has(zombieId)) {
      const positionalAudio = new THREE.PositionalAudio(this.listener);
      positionalAudio.setRefDistance(5);
      positionalAudio.setMaxDistance(ZOMBIE_DETECTION_RADIUS * 2);
      positionalAudio.setRolloffFactor(1);
      this.zombieAudioSources.set(zombieId, positionalAudio);
    }

    const audio = this.zombieAudioSources.get(zombieId)!;
    audio.position.set(position.x, position.y, position.z);

    // For now, play through regular SFX channel since PositionalAudio requires
    // AudioBuffer which is more complex for synthetic sounds
    this.play(sound);
  }

  /**
   * Remove zombie audio source when zombie is destroyed
   */
  removeZombieAudio(zombieId: number): void {
    const audio = this.zombieAudioSources.get(zombieId);
    if (audio) {
      try {
        audio.stop();
        audio.disconnect();
      } catch {
        // Already stopped
      }
      this.zombieAudioSources.delete(zombieId);
    }
  }

  /**
   * Get the current music theme
   */
  getCurrentTheme(): MusicTheme | null {
    return this.currentTheme;
  }

  /**
   * Get the Three.js audio listener (for attaching to camera)
   */
  getListener(): THREE.AudioListener | null {
    return this.listener;
  }

  /**
   * Preload critical sounds (placeholder for when real audio files are used)
   */
  async preload(): Promise<void> {
    // In the future, this would load audio files
    // For now with synthetic sounds, there's nothing to preload
    console.log('AudioManager: Sounds preloaded (using synthetic sounds)');
  }

  /**
   * Resume audio context (needed after user interaction)
   */
  async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Suspend audio context (for pausing)
   */
  async suspend(): Promise<void> {
    if (this.context && this.context.state === 'running') {
      await this.context.suspend();
    }
  }
}
