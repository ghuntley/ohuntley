/**
 * AnimationSystem - Procedural animation system for entity animations
 * Supports keyframe interpolation, easing functions, and animation blending
 */

import * as THREE from 'three';

/** Easing function types */
export enum EaseType {
  LINEAR = 'linear',
  EASE_IN = 'easeIn',
  EASE_OUT = 'easeOut',
  EASE_IN_OUT = 'easeInOut',
  BOUNCE = 'bounce',
  ELASTIC = 'elastic',
}

/** Animation state for tracking */
export enum AnimationState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  FINISHED = 'finished',
}

/** Keyframe definition */
export interface Keyframe {
  time: number; // Time in seconds from animation start
  value: number; // Target value
  ease?: EaseType; // Easing to use when interpolating TO this keyframe
}

/** Track for animating a single property */
export interface AnimationTrack {
  target: THREE.Object3D;
  property: 'position.x' | 'position.y' | 'position.z' | 'rotation.x' | 'rotation.y' | 'rotation.z' | 'scale.x' | 'scale.y' | 'scale.z';
  keyframes: Keyframe[];
}

/** Animation clip definition */
export interface AnimationClip {
  name: string;
  duration: number;
  loop: boolean;
  tracks: AnimationTrack[];
}

/** Active animation instance */
interface AnimationInstance {
  clip: AnimationClip;
  time: number;
  speed: number;
  state: AnimationState;
  blendWeight: number;
  onComplete?: () => void;
}

/** Easing functions */
const easingFunctions: Record<EaseType, (t: number) => number> = {
  [EaseType.LINEAR]: (t) => t,
  [EaseType.EASE_IN]: (t) => t * t,
  [EaseType.EASE_OUT]: (t) => t * (2 - t),
  [EaseType.EASE_IN_OUT]: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  [EaseType.BOUNCE]: (t) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      const t2 = t - 1.5 / 2.75;
      return 7.5625 * t2 * t2 + 0.75;
    } else if (t < 2.5 / 2.75) {
      const t2 = t - 2.25 / 2.75;
      return 7.5625 * t2 * t2 + 0.9375;
    } else {
      const t2 = t - 2.625 / 2.75;
      return 7.5625 * t2 * t2 + 0.984375;
    }
  },
  [EaseType.ELASTIC]: (t) => {
    if (t === 0 || t === 1) return t;
    const p = 0.3;
    const s = p / 4;
    return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
  },
};

/**
 * Get property value from an Object3D
 */
function getPropertyValue(target: THREE.Object3D, property: string): number {
  const parts = property.split('.');
  if (parts.length === 2) {
    const [obj, prop] = parts;
    const container = target[obj as keyof THREE.Object3D] as THREE.Vector3 | THREE.Euler;
    if (container && prop in container) {
      return (container as Record<string, number>)[prop];
    }
  }
  return 0;
}

/**
 * Set property value on an Object3D
 */
function setPropertyValue(target: THREE.Object3D, property: string, value: number): void {
  const parts = property.split('.');
  if (parts.length === 2) {
    const [obj, prop] = parts;
    const container = target[obj as keyof THREE.Object3D] as THREE.Vector3 | THREE.Euler;
    if (container && prop in container) {
      (container as Record<string, number>)[prop] = value;
    }
  }
}

/**
 * Interpolate between keyframes at a given time
 */
function interpolateKeyframes(keyframes: Keyframe[], time: number): number {
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].value;

  // Find surrounding keyframes
  let prevKeyframe = keyframes[0];
  let nextKeyframe = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
      prevKeyframe = keyframes[i];
      nextKeyframe = keyframes[i + 1];
      break;
    }
  }

  // Handle edge cases
  if (time <= prevKeyframe.time) return prevKeyframe.value;
  if (time >= nextKeyframe.time) return nextKeyframe.value;

  // Calculate interpolation factor
  const duration = nextKeyframe.time - prevKeyframe.time;
  const t = (time - prevKeyframe.time) / duration;

  // Apply easing
  const ease = nextKeyframe.ease ?? EaseType.LINEAR;
  const easedT = easingFunctions[ease](t);

  // Linear interpolation with eased t
  return prevKeyframe.value + (nextKeyframe.value - prevKeyframe.value) * easedT;
}

/**
 * AnimationController - Manages animations for a single entity
 */
export class AnimationController {
  private animations: Map<string, AnimationInstance> = new Map();
  private clips: Map<string, AnimationClip> = new Map();
  private currentAnimation: string | null = null;
  private blendTime: number = 0.2; // Blend duration in seconds
  private blendProgress: number = 0;
  private previousAnimation: string | null = null;

  /**
   * Register an animation clip
   */
  addClip(clip: AnimationClip): void {
    this.clips.set(clip.name, clip);
  }

  /**
   * Play an animation by name
   */
  play(name: string, options: { speed?: number; onComplete?: () => void } = {}): void {
    const clip = this.clips.get(name);
    if (!clip) {
      console.warn(`Animation clip '${name}' not found`);
      return;
    }

    // Start blending from current animation
    if (this.currentAnimation && this.currentAnimation !== name) {
      this.previousAnimation = this.currentAnimation;
      this.blendProgress = 0;
    }

    // Create or reset animation instance
    const instance: AnimationInstance = {
      clip,
      time: 0,
      speed: options.speed ?? 1,
      state: AnimationState.PLAYING,
      blendWeight: 1,
      onComplete: options.onComplete,
    };

    this.animations.set(name, instance);
    this.currentAnimation = name;
  }

  /**
   * Stop an animation
   */
  stop(name?: string): void {
    if (name) {
      const instance = this.animations.get(name);
      if (instance) {
        instance.state = AnimationState.FINISHED;
      }
    } else if (this.currentAnimation) {
      const instance = this.animations.get(this.currentAnimation);
      if (instance) {
        instance.state = AnimationState.FINISHED;
      }
      this.currentAnimation = null;
    }
  }

  /**
   * Pause/resume animation
   */
  setPaused(paused: boolean, name?: string): void {
    const targetName = name ?? this.currentAnimation;
    if (!targetName) return;

    const instance = this.animations.get(targetName);
    if (instance) {
      instance.state = paused ? AnimationState.PAUSED : AnimationState.PLAYING;
    }
  }

  /**
   * Check if an animation is playing
   */
  isPlaying(name?: string): boolean {
    const targetName = name ?? this.currentAnimation;
    if (!targetName) return false;

    const instance = this.animations.get(targetName);
    return instance?.state === AnimationState.PLAYING;
  }

  /**
   * Get current animation name
   */
  getCurrentAnimation(): string | null {
    return this.currentAnimation;
  }

  /**
   * Update animations
   */
  update(deltaTime: number): void {
    // Update blend progress when blending between animations
    const isBlending = this.previousAnimation !== null && this.blendProgress < 1;
    if (isBlending) {
      this.blendProgress = Math.min(1, this.blendProgress + deltaTime / this.blendTime);
    }

    // Update and apply current animation
    if (this.currentAnimation) {
      const instance = this.animations.get(this.currentAnimation);
      if (instance && instance.state === AnimationState.PLAYING) {
        this.updateInstance(instance, deltaTime);
        // When not blending, apply with full weight (1.0)
        // When blending, use blendProgress as weight
        const weight = isBlending ? this.blendProgress : 1;
        this.applyAnimation(instance, weight);
      }
    }

    // Apply previous animation with decreasing weight during blend
    if (isBlending && this.previousAnimation) {
      const prevInstance = this.animations.get(this.previousAnimation);
      if (prevInstance) {
        this.applyAnimation(prevInstance, 1 - this.blendProgress);
      }
    }

    // Clean up finished blend
    if (this.blendProgress >= 1) {
      this.previousAnimation = null;
    }
  }

  /**
   * Update animation instance time
   */
  private updateInstance(instance: AnimationInstance, deltaTime: number): void {
    instance.time += deltaTime * instance.speed;

    if (instance.time >= instance.clip.duration) {
      if (instance.clip.loop) {
        instance.time = instance.time % instance.clip.duration;
      } else {
        instance.time = instance.clip.duration;
        instance.state = AnimationState.FINISHED;
        instance.onComplete?.();
      }
    }
  }

  /**
   * Apply animation to targets
   */
  private applyAnimation(instance: AnimationInstance, weight: number): void {
    for (const track of instance.clip.tracks) {
      const value = interpolateKeyframes(track.keyframes, instance.time);
      const currentValue = getPropertyValue(track.target, track.property);
      const blendedValue = currentValue * (1 - weight) + value * weight;
      setPropertyValue(track.target, track.property, blendedValue);
    }
  }

  /**
   * Set blend duration
   */
  setBlendTime(time: number): void {
    this.blendTime = time;
  }

  /**
   * Dispose of all animations
   */
  dispose(): void {
    this.animations.clear();
    this.clips.clear();
    this.currentAnimation = null;
    this.previousAnimation = null;
  }
}

/**
 * Procedural animation helper functions
 */
export const ProceduralAnimations = {
  /**
   * Create a walk cycle animation for limbs
   */
  createWalkCycle(
    leftArm: THREE.Object3D,
    rightArm: THREE.Object3D,
    leftLeg: THREE.Object3D,
    rightLeg: THREE.Object3D,
    body: THREE.Object3D,
    speed: number = 1
  ): AnimationClip {
    const duration = 0.6 / speed;
    const armSwing = 0.4;
    const legSwing = 0.3;
    const bodyBob = 0.03;

    return {
      name: 'walk',
      duration,
      loop: true,
      tracks: [
        // Left arm swings opposite to left leg
        {
          target: leftArm,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: armSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration / 2, value: -armSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: armSwing, ease: EaseType.EASE_IN_OUT },
          ],
        },
        // Right arm opposite
        {
          target: rightArm,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: -armSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration / 2, value: armSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: -armSwing, ease: EaseType.EASE_IN_OUT },
          ],
        },
        // Left leg
        {
          target: leftLeg,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: -legSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration / 2, value: legSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: -legSwing, ease: EaseType.EASE_IN_OUT },
          ],
        },
        // Right leg opposite
        {
          target: rightLeg,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: legSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration / 2, value: -legSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: legSwing, ease: EaseType.EASE_IN_OUT },
          ],
        },
        // Body bob
        {
          target: body,
          property: 'position.y',
          keyframes: [
            { time: 0, value: 0, ease: EaseType.EASE_OUT },
            { time: duration / 4, value: bodyBob, ease: EaseType.EASE_IN },
            { time: duration / 2, value: 0, ease: EaseType.EASE_OUT },
            { time: (3 * duration) / 4, value: bodyBob, ease: EaseType.EASE_IN },
            { time: duration, value: 0, ease: EaseType.EASE_OUT },
          ],
        },
      ],
    };
  },

  /**
   * Create a run cycle (faster walk with more exaggerated motion)
   */
  createRunCycle(
    leftArm: THREE.Object3D,
    rightArm: THREE.Object3D,
    leftLeg: THREE.Object3D,
    rightLeg: THREE.Object3D,
    body: THREE.Object3D
  ): AnimationClip {
    const duration = 0.35;
    const armSwing = 0.6;
    const legSwing = 0.5;
    const bodyBob = 0.06;
    const bodyLean = 0.15;

    return {
      name: 'run',
      duration,
      loop: true,
      tracks: [
        {
          target: leftArm,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: armSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration / 2, value: -armSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: armSwing, ease: EaseType.EASE_IN_OUT },
          ],
        },
        {
          target: rightArm,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: -armSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration / 2, value: armSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: -armSwing, ease: EaseType.EASE_IN_OUT },
          ],
        },
        {
          target: leftLeg,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: -legSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration / 2, value: legSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: -legSwing, ease: EaseType.EASE_IN_OUT },
          ],
        },
        {
          target: rightLeg,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: legSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration / 2, value: -legSwing, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: legSwing, ease: EaseType.EASE_IN_OUT },
          ],
        },
        {
          target: body,
          property: 'position.y',
          keyframes: [
            { time: 0, value: 0, ease: EaseType.EASE_OUT },
            { time: duration / 4, value: bodyBob, ease: EaseType.EASE_IN },
            { time: duration / 2, value: 0, ease: EaseType.EASE_OUT },
            { time: (3 * duration) / 4, value: bodyBob, ease: EaseType.EASE_IN },
            { time: duration, value: 0, ease: EaseType.EASE_OUT },
          ],
        },
        // Forward lean while running
        {
          target: body,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: bodyLean },
            { time: duration, value: bodyLean },
          ],
        },
      ],
    };
  },

  /**
   * Create idle breathing animation
   */
  createIdleAnimation(body: THREE.Object3D, head?: THREE.Object3D): AnimationClip {
    const duration = 2.5;
    const breathAmount = 0.02;
    const swayAmount = 0.03;

    const tracks: AnimationTrack[] = [
      // Breathing (body up/down)
      {
        target: body,
        property: 'position.y',
        keyframes: [
          { time: 0, value: 0, ease: EaseType.EASE_IN_OUT },
          { time: duration / 2, value: breathAmount, ease: EaseType.EASE_IN_OUT },
          { time: duration, value: 0, ease: EaseType.EASE_IN_OUT },
        ],
      },
      // Subtle sway
      {
        target: body,
        property: 'rotation.z',
        keyframes: [
          { time: 0, value: 0, ease: EaseType.EASE_IN_OUT },
          { time: duration / 4, value: swayAmount, ease: EaseType.EASE_IN_OUT },
          { time: duration / 2, value: 0, ease: EaseType.EASE_IN_OUT },
          { time: (3 * duration) / 4, value: -swayAmount, ease: EaseType.EASE_IN_OUT },
          { time: duration, value: 0, ease: EaseType.EASE_IN_OUT },
        ],
      },
    ];

    // Add head look-around if head provided
    if (head) {
      tracks.push({
        target: head,
        property: 'rotation.y',
        keyframes: [
          { time: 0, value: 0, ease: EaseType.EASE_IN_OUT },
          { time: duration * 0.3, value: 0.2, ease: EaseType.EASE_IN_OUT },
          { time: duration * 0.6, value: -0.15, ease: EaseType.EASE_IN_OUT },
          { time: duration, value: 0, ease: EaseType.EASE_IN_OUT },
        ],
      });
    }

    return {
      name: 'idle',
      duration,
      loop: true,
      tracks,
    };
  },

  /**
   * Create attack/swing animation
   */
  createAttackAnimation(
    rightArm: THREE.Object3D,
    body: THREE.Object3D
  ): AnimationClip {
    const duration = 0.4;

    return {
      name: 'attack',
      duration,
      loop: false,
      tracks: [
        // Wind up then swing
        {
          target: rightArm,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: 0, ease: EaseType.EASE_OUT },
            { time: 0.1, value: -1.2, ease: EaseType.EASE_IN }, // Wind up
            { time: 0.25, value: 0.8, ease: EaseType.EASE_OUT }, // Swing through
            { time: duration, value: 0, ease: EaseType.EASE_OUT }, // Return
          ],
        },
        // Arm swings outward
        {
          target: rightArm,
          property: 'rotation.z',
          keyframes: [
            { time: 0, value: -0.3, ease: EaseType.EASE_OUT },
            { time: 0.1, value: -0.5, ease: EaseType.EASE_IN },
            { time: 0.25, value: 0.3, ease: EaseType.EASE_OUT },
            { time: duration, value: -0.3, ease: EaseType.EASE_OUT },
          ],
        },
        // Body twist into swing
        {
          target: body,
          property: 'rotation.y',
          keyframes: [
            { time: 0, value: 0, ease: EaseType.EASE_OUT },
            { time: 0.1, value: -0.2, ease: EaseType.EASE_IN },
            { time: 0.25, value: 0.3, ease: EaseType.EASE_OUT },
            { time: duration, value: 0, ease: EaseType.EASE_OUT },
          ],
        },
      ],
    };
  },

  /**
   * Create death animation (fall forward)
   */
  createDeathAnimation(body: THREE.Object3D): AnimationClip {
    const duration = 0.8;

    return {
      name: 'death',
      duration,
      loop: false,
      tracks: [
        // Fall forward
        {
          target: body,
          property: 'rotation.x',
          keyframes: [
            { time: 0, value: 0, ease: EaseType.EASE_IN },
            { time: duration * 0.6, value: Math.PI / 2, ease: EaseType.BOUNCE },
            { time: duration, value: Math.PI / 2, ease: EaseType.LINEAR },
          ],
        },
        // Drop down
        {
          target: body,
          property: 'position.y',
          keyframes: [
            { time: 0, value: 0, ease: EaseType.EASE_IN },
            { time: duration * 0.6, value: -0.3, ease: EaseType.EASE_OUT },
            { time: duration, value: -0.3, ease: EaseType.LINEAR },
          ],
        },
      ],
    };
  },

  /**
   * Create victory/celebration animation
   */
  createVictoryAnimation(
    leftArm: THREE.Object3D,
    rightArm: THREE.Object3D,
    body: THREE.Object3D
  ): AnimationClip {
    const duration = 1.0;

    return {
      name: 'victory',
      duration,
      loop: true,
      tracks: [
        // Arms up
        {
          target: leftArm,
          property: 'rotation.z',
          keyframes: [
            { time: 0, value: 0.3, ease: EaseType.EASE_OUT },
            { time: 0.2, value: 2.5, ease: EaseType.EASE_IN_OUT },
            { time: 0.5, value: 2.2, ease: EaseType.EASE_IN_OUT },
            { time: 0.7, value: 2.5, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: 2.5, ease: EaseType.EASE_IN_OUT },
          ],
        },
        {
          target: rightArm,
          property: 'rotation.z',
          keyframes: [
            { time: 0, value: -0.3, ease: EaseType.EASE_OUT },
            { time: 0.2, value: -2.5, ease: EaseType.EASE_IN_OUT },
            { time: 0.5, value: -2.2, ease: EaseType.EASE_IN_OUT },
            { time: 0.7, value: -2.5, ease: EaseType.EASE_IN_OUT },
            { time: duration, value: -2.5, ease: EaseType.EASE_IN_OUT },
          ],
        },
        // Jump up and down
        {
          target: body,
          property: 'position.y',
          keyframes: [
            { time: 0, value: 0, ease: EaseType.EASE_OUT },
            { time: 0.3, value: 0.15, ease: EaseType.EASE_OUT },
            { time: 0.5, value: 0, ease: EaseType.BOUNCE },
            { time: 0.8, value: 0.15, ease: EaseType.EASE_OUT },
            { time: duration, value: 0, ease: EaseType.BOUNCE },
          ],
        },
      ],
    };
  },

  /**
   * Create dissolve/shrink death animation for zombies
   */
  createDissolveAnimation(body: THREE.Object3D): AnimationClip {
    const duration = 0.6;

    return {
      name: 'dissolve',
      duration,
      loop: false,
      tracks: [
        // Shrink
        {
          target: body,
          property: 'scale.x',
          keyframes: [
            { time: 0, value: 1, ease: EaseType.EASE_IN },
            { time: duration, value: 0, ease: EaseType.EASE_IN },
          ],
        },
        {
          target: body,
          property: 'scale.y',
          keyframes: [
            { time: 0, value: 1, ease: EaseType.EASE_IN },
            { time: duration * 0.3, value: 1.2, ease: EaseType.EASE_OUT }, // Stretch up first
            { time: duration, value: 0, ease: EaseType.EASE_IN },
          ],
        },
        {
          target: body,
          property: 'scale.z',
          keyframes: [
            { time: 0, value: 1, ease: EaseType.EASE_IN },
            { time: duration, value: 0, ease: EaseType.EASE_IN },
          ],
        },
        // Sink into ground
        {
          target: body,
          property: 'position.y',
          keyframes: [
            { time: 0, value: 0, ease: EaseType.EASE_IN },
            { time: duration * 0.3, value: 0.1, ease: EaseType.EASE_OUT },
            { time: duration, value: -0.5, ease: EaseType.EASE_IN },
          ],
        },
        // Spin
        {
          target: body,
          property: 'rotation.y',
          keyframes: [
            { time: 0, value: 0, ease: EaseType.LINEAR },
            { time: duration, value: Math.PI * 2, ease: EaseType.EASE_OUT },
          ],
        },
      ],
    };
  },
};
