import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  AnimationController,
  AnimationClip,
  EaseType,
  AnimationState,
  ProceduralAnimations,
} from './AnimationSystem';

describe('AnimationSystem', () => {
  describe('AnimationController', () => {
    let controller: AnimationController;
    let testObject: THREE.Object3D;

    beforeEach(() => {
      controller = new AnimationController();
      testObject = new THREE.Object3D();
    });

    describe('addClip', () => {
      it('should register animation clips', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [],
        };
        controller.addClip(clip);
        // Can play it without warning
        const warnSpy = vi.spyOn(console, 'warn');
        controller.play('test');
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should allow overwriting clips with same name', () => {
        const clip1: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [],
        };
        const clip2: AnimationClip = {
          name: 'test',
          duration: 2,
          loop: true,
          tracks: [],
        };
        controller.addClip(clip1);
        controller.addClip(clip2);
        // Should not throw
        expect(() => controller.play('test')).not.toThrow();
      });
    });

    describe('play', () => {
      it('should play a registered animation', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [],
        };
        controller.addClip(clip);
        controller.play('test');
        expect(controller.isPlaying('test')).toBe(true);
      });

      it('should warn when playing unregistered animation', () => {
        const warnSpy = vi.spyOn(console, 'warn');
        controller.play('nonexistent');
        expect(warnSpy).toHaveBeenCalledWith("Animation clip 'nonexistent' not found");
      });

      it('should set current animation', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [],
        };
        controller.addClip(clip);
        controller.play('test');
        expect(controller.getCurrentAnimation()).toBe('test');
      });

      it('should call onComplete when animation finishes', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 0.1,
          loop: false,
          tracks: [],
        };
        const onComplete = vi.fn();
        controller.addClip(clip);
        controller.play('test', { onComplete });

        // Update past duration
        controller.update(0.2);

        expect(onComplete).toHaveBeenCalled();
      });

      it('should support custom playback speed', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [
            {
              target: testObject,
              property: 'position.x',
              keyframes: [
                { time: 0, value: 0 },
                { time: 1, value: 10 },
              ],
            },
          ],
        };
        controller.addClip(clip);
        controller.play('test', { speed: 2 });

        // At 2x speed, 0.5 seconds should reach halfway
        controller.update(0.25);
        expect(testObject.position.x).toBeCloseTo(5, 1);
      });
    });

    describe('stop', () => {
      it('should stop the current animation', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [],
        };
        controller.addClip(clip);
        controller.play('test');
        controller.stop();
        expect(controller.isPlaying()).toBe(false);
      });

      it('should stop a specific animation', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [],
        };
        controller.addClip(clip);
        controller.play('test');
        controller.stop('test');
        expect(controller.isPlaying('test')).toBe(false);
      });
    });

    describe('setPaused', () => {
      it('should pause and resume animations', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [],
        };
        controller.addClip(clip);
        controller.play('test');

        controller.setPaused(true);
        expect(controller.isPlaying('test')).toBe(false);

        controller.setPaused(false);
        expect(controller.isPlaying('test')).toBe(true);
      });
    });

    describe('update', () => {
      it('should interpolate values between keyframes', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [
            {
              target: testObject,
              property: 'position.x',
              keyframes: [
                { time: 0, value: 0, ease: EaseType.LINEAR },
                { time: 1, value: 10, ease: EaseType.LINEAR },
              ],
            },
          ],
        };
        controller.addClip(clip);
        controller.play('test');

        // At t=0.5, should be at 5
        controller.update(0.5);
        expect(testObject.position.x).toBeCloseTo(5, 1);
      });

      it('should loop animations when loop is true', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: true,
          tracks: [
            {
              target: testObject,
              property: 'position.x',
              keyframes: [
                { time: 0, value: 0 },
                { time: 1, value: 10 },
              ],
            },
          ],
        };
        controller.addClip(clip);
        controller.play('test');

        // Update past one loop
        controller.update(1.5);
        // Should have looped back and be at 0.5 into the animation
        expect(testObject.position.x).toBeCloseTo(5, 1);
      });

      it('should apply easing functions', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [
            {
              target: testObject,
              property: 'position.x',
              keyframes: [
                { time: 0, value: 0 },
                { time: 1, value: 10, ease: EaseType.EASE_IN },
              ],
            },
          ],
        };
        controller.addClip(clip);
        controller.play('test');

        controller.update(0.5);
        // With EASE_IN (t*t), at t=0.5, eased value is 0.25
        // So position should be 2.5
        expect(testObject.position.x).toBeCloseTo(2.5, 1);
      });

      it('should handle rotation properties', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [
            {
              target: testObject,
              property: 'rotation.y',
              keyframes: [
                { time: 0, value: 0 },
                { time: 1, value: Math.PI },
              ],
            },
          ],
        };
        controller.addClip(clip);
        controller.play('test');

        controller.update(0.5);
        expect(testObject.rotation.y).toBeCloseTo(Math.PI / 2, 2);
      });

      it('should handle scale properties', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [
            {
              target: testObject,
              property: 'scale.x',
              keyframes: [
                { time: 0, value: 1 },
                { time: 1, value: 2 },
              ],
            },
          ],
        };
        controller.addClip(clip);
        controller.play('test');

        controller.update(0.5);
        expect(testObject.scale.x).toBeCloseTo(1.5, 2);
      });
    });

    describe('setBlendTime', () => {
      it('should allow setting blend duration', () => {
        controller.setBlendTime(0.5);
        // Just verifying it doesn't throw
        expect(true).toBe(true);
      });
    });

    describe('dispose', () => {
      it('should clear all animations and clips', () => {
        const clip: AnimationClip = {
          name: 'test',
          duration: 1,
          loop: false,
          tracks: [],
        };
        controller.addClip(clip);
        controller.play('test');

        controller.dispose();

        expect(controller.getCurrentAnimation()).toBeNull();
        expect(controller.isPlaying()).toBe(false);
      });
    });
  });

  describe('ProceduralAnimations', () => {
    let leftArm: THREE.Object3D;
    let rightArm: THREE.Object3D;
    let leftLeg: THREE.Object3D;
    let rightLeg: THREE.Object3D;
    let body: THREE.Object3D;
    let head: THREE.Object3D;

    beforeEach(() => {
      leftArm = new THREE.Object3D();
      rightArm = new THREE.Object3D();
      leftLeg = new THREE.Object3D();
      rightLeg = new THREE.Object3D();
      body = new THREE.Object3D();
      head = new THREE.Object3D();
    });

    describe('createWalkCycle', () => {
      it('should create a valid walk animation clip', () => {
        const clip = ProceduralAnimations.createWalkCycle(
          leftArm,
          rightArm,
          leftLeg,
          rightLeg,
          body
        );

        expect(clip.name).toBe('walk');
        expect(clip.loop).toBe(true);
        expect(clip.duration).toBeGreaterThan(0);
        expect(clip.tracks.length).toBeGreaterThan(0);
      });

      it('should respect speed parameter', () => {
        const slowClip = ProceduralAnimations.createWalkCycle(
          leftArm,
          rightArm,
          leftLeg,
          rightLeg,
          body,
          0.5
        );
        const fastClip = ProceduralAnimations.createWalkCycle(
          leftArm,
          rightArm,
          leftLeg,
          rightLeg,
          body,
          2
        );

        expect(slowClip.duration).toBeGreaterThan(fastClip.duration);
      });
    });

    describe('createRunCycle', () => {
      it('should create a valid run animation clip', () => {
        const clip = ProceduralAnimations.createRunCycle(
          leftArm,
          rightArm,
          leftLeg,
          rightLeg,
          body
        );

        expect(clip.name).toBe('run');
        expect(clip.loop).toBe(true);
        expect(clip.duration).toBeGreaterThan(0);
      });

      it('should be faster than walk cycle', () => {
        const walkClip = ProceduralAnimations.createWalkCycle(
          leftArm,
          rightArm,
          leftLeg,
          rightLeg,
          body
        );
        const runClip = ProceduralAnimations.createRunCycle(
          leftArm,
          rightArm,
          leftLeg,
          rightLeg,
          body
        );

        expect(runClip.duration).toBeLessThan(walkClip.duration);
      });
    });

    describe('createIdleAnimation', () => {
      it('should create a valid idle animation', () => {
        const clip = ProceduralAnimations.createIdleAnimation(body);

        expect(clip.name).toBe('idle');
        expect(clip.loop).toBe(true);
        expect(clip.tracks.length).toBeGreaterThan(0);
      });

      it('should include head track when head is provided', () => {
        const clipWithHead = ProceduralAnimations.createIdleAnimation(body, head);
        const clipWithoutHead = ProceduralAnimations.createIdleAnimation(body);

        expect(clipWithHead.tracks.length).toBeGreaterThan(
          clipWithoutHead.tracks.length
        );
      });
    });

    describe('createAttackAnimation', () => {
      it('should create a valid attack animation', () => {
        const clip = ProceduralAnimations.createAttackAnimation(rightArm, body);

        expect(clip.name).toBe('attack');
        expect(clip.loop).toBe(false); // Attack should not loop
        expect(clip.duration).toBeGreaterThan(0);
      });
    });

    describe('createDeathAnimation', () => {
      it('should create a valid death animation', () => {
        const clip = ProceduralAnimations.createDeathAnimation(body);

        expect(clip.name).toBe('death');
        expect(clip.loop).toBe(false); // Death should not loop
        expect(clip.duration).toBeGreaterThan(0);
      });
    });

    describe('createVictoryAnimation', () => {
      it('should create a valid victory animation', () => {
        const clip = ProceduralAnimations.createVictoryAnimation(
          leftArm,
          rightArm,
          body
        );

        expect(clip.name).toBe('victory');
        expect(clip.loop).toBe(true); // Victory loops
        expect(clip.tracks.length).toBeGreaterThan(0);
      });
    });

    describe('createDissolveAnimation', () => {
      it('should create a valid dissolve animation', () => {
        const clip = ProceduralAnimations.createDissolveAnimation(body);

        expect(clip.name).toBe('dissolve');
        expect(clip.loop).toBe(false);
        expect(clip.duration).toBeGreaterThan(0);
      });

      it('should scale to zero', () => {
        const clip = ProceduralAnimations.createDissolveAnimation(body);

        // Find scale tracks and verify they end at 0
        const scaleTrack = clip.tracks.find((t) => t.property === 'scale.x');
        expect(scaleTrack).toBeDefined();

        const lastKeyframe = scaleTrack!.keyframes[scaleTrack!.keyframes.length - 1];
        expect(lastKeyframe.value).toBe(0);
      });
    });
  });

  describe('Easing functions', () => {
    it('should produce different results for different easing types', () => {
      const controller = new AnimationController();
      const obj1 = new THREE.Object3D();
      const obj2 = new THREE.Object3D();

      const linearClip: AnimationClip = {
        name: 'linear',
        duration: 1,
        loop: false,
        tracks: [
          {
            target: obj1,
            property: 'position.x',
            keyframes: [
              { time: 0, value: 0 },
              { time: 1, value: 10, ease: EaseType.LINEAR },
            ],
          },
        ],
      };

      const easeInClip: AnimationClip = {
        name: 'easeIn',
        duration: 1,
        loop: false,
        tracks: [
          {
            target: obj2,
            property: 'position.x',
            keyframes: [
              { time: 0, value: 0 },
              { time: 1, value: 10, ease: EaseType.EASE_IN },
            ],
          },
        ],
      };

      const controller1 = new AnimationController();
      const controller2 = new AnimationController();

      controller1.addClip(linearClip);
      controller2.addClip(easeInClip);

      controller1.play('linear');
      controller2.play('easeIn');

      controller1.update(0.5);
      controller2.update(0.5);

      // Linear at 0.5 should be 5
      expect(obj1.position.x).toBeCloseTo(5, 1);
      // EaseIn at 0.5 should be less (0.5 * 0.5 = 0.25, so 2.5)
      expect(obj2.position.x).toBeCloseTo(2.5, 1);
      expect(obj1.position.x).not.toEqual(obj2.position.x);
    });
  });
});
