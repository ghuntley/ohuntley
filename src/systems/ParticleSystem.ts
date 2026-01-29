import * as THREE from 'three';

/**
 * Types of particle effects available
 */
export enum ParticleEffectType {
  SWORD_TRAIL = 'sword_trail',
  ZOMBIE_HIT = 'zombie_hit',
  POWERUP_COLLECT = 'powerup_collect',
  SHIELD_BREAK = 'shield_break',
  FOOTSTEP_DUST = 'footstep_dust',
}

/**
 * Configuration for a particle effect
 */
export interface ParticleEffectConfig {
  /** Number of particles to spawn */
  count: number;
  /** Base color of particles */
  color: number;
  /** Optional secondary color for gradient */
  colorEnd?: number;
  /** Base size of particles */
  size: number;
  /** Size variation (random +/-) */
  sizeVariation: number;
  /** Lifetime in seconds */
  lifetime: number;
  /** Lifetime variation */
  lifetimeVariation: number;
  /** Initial velocity spread */
  velocitySpread: THREE.Vector3;
  /** Gravity effect on particles */
  gravity: number;
  /** Whether particles should fade out */
  fadeOut: boolean;
  /** Whether particles should shrink over time */
  shrink: boolean;
  /** Emission shape: 'point', 'sphere', 'cone' */
  emissionShape: 'point' | 'sphere' | 'cone';
  /** Radius for sphere/cone emission */
  emissionRadius?: number;
  /** Cone angle in radians */
  coneAngle?: number;
}

/**
 * Individual particle data
 */
interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  initialSize: number;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
}

/**
 * Active particle effect instance
 */
interface ActiveEffect {
  particles: Particle[];
  config: ParticleEffectConfig;
  mesh: THREE.Points;
  geometry: THREE.BufferGeometry;
  positionAttribute: THREE.BufferAttribute;
  colorAttribute: THREE.BufferAttribute;
  sizeAttribute: THREE.BufferAttribute;
  activeCount: number;
}

/**
 * Default configurations for particle effects
 */
const DEFAULT_CONFIGS: Record<ParticleEffectType, ParticleEffectConfig> = {
  [ParticleEffectType.SWORD_TRAIL]: {
    count: 20,
    color: 0xffffff,
    colorEnd: 0xaaaaff,
    size: 0.15,
    sizeVariation: 0.05,
    lifetime: 0.3,
    lifetimeVariation: 0.1,
    velocitySpread: new THREE.Vector3(0.5, 0.5, 0.5),
    gravity: 0,
    fadeOut: true,
    shrink: true,
    emissionShape: 'cone',
    coneAngle: Math.PI / 4,
  },
  [ParticleEffectType.ZOMBIE_HIT]: {
    count: 30,
    color: 0x88ff88,
    colorEnd: 0x006600,
    size: 0.2,
    sizeVariation: 0.1,
    lifetime: 0.5,
    lifetimeVariation: 0.2,
    velocitySpread: new THREE.Vector3(3, 4, 3),
    gravity: -15,
    fadeOut: true,
    shrink: false,
    emissionShape: 'sphere',
    emissionRadius: 0.3,
  },
  [ParticleEffectType.POWERUP_COLLECT]: {
    count: 40,
    color: 0xffff00,
    colorEnd: 0xff8800,
    size: 0.15,
    sizeVariation: 0.05,
    lifetime: 0.8,
    lifetimeVariation: 0.3,
    velocitySpread: new THREE.Vector3(2, 4, 2),
    gravity: -5,
    fadeOut: true,
    shrink: true,
    emissionShape: 'sphere',
    emissionRadius: 0.5,
  },
  [ParticleEffectType.SHIELD_BREAK]: {
    count: 50,
    color: 0x00ffff,
    colorEnd: 0x0088ff,
    size: 0.25,
    sizeVariation: 0.1,
    lifetime: 0.6,
    lifetimeVariation: 0.2,
    velocitySpread: new THREE.Vector3(5, 3, 5),
    gravity: -8,
    fadeOut: true,
    shrink: false,
    emissionShape: 'sphere',
    emissionRadius: 0.8,
  },
  [ParticleEffectType.FOOTSTEP_DUST]: {
    count: 8,
    color: 0xccbb99,
    size: 0.1,
    sizeVariation: 0.03,
    lifetime: 0.4,
    lifetimeVariation: 0.1,
    velocitySpread: new THREE.Vector3(0.5, 0.3, 0.5),
    gravity: -2,
    fadeOut: true,
    shrink: true,
    emissionShape: 'point',
  },
};

/**
 * Particle System for visual effects
 * Uses Three.js Points for efficient GPU-based particle rendering
 */
export class ParticleSystem {
  private scene: THREE.Scene;
  private activeEffects: ActiveEffect[];
  private effectPool: Map<ParticleEffectType, ActiveEffect[]>;
  private maxPoolSize: number;
  private isMobile: boolean;
  private particleMultiplier: number;

  // Shared material for all particles
  private material: THREE.PointsMaterial;

  constructor(scene: THREE.Scene, options?: { isMobile?: boolean; maxPoolSize?: number }) {
    this.scene = scene;
    this.activeEffects = [];
    this.effectPool = new Map();
    this.maxPoolSize = options?.maxPoolSize ?? 10;
    this.isMobile = options?.isMobile ?? false;
    this.particleMultiplier = this.isMobile ? 0.5 : 1.0;

    // Create shared material with vertex colors
    this.material = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  /**
   * Emit a particle effect at a position
   */
  emit(
    type: ParticleEffectType,
    position: THREE.Vector3,
    options?: {
      direction?: THREE.Vector3;
      color?: number;
      scale?: number;
    }
  ): void {
    const config = { ...DEFAULT_CONFIGS[type] };

    // Apply color override if provided
    if (options?.color !== undefined) {
      config.color = options.color;
    }

    // Scale particle count for mobile
    const particleCount = Math.floor(config.count * this.particleMultiplier);
    if (particleCount <= 0) return;

    // Try to reuse a pooled effect
    let effect = this.getFromPool(type);

    if (!effect) {
      effect = this.createEffect(config, particleCount);
    }

    // Initialize particles
    this.initializeParticles(effect, position, config, options?.direction, options?.scale);

    // Add to active effects
    this.activeEffects.push(effect);
    this.scene.add(effect.mesh);
  }

  /**
   * Create a new particle effect
   */
  private createEffect(config: ParticleEffectConfig, particleCount: number): ActiveEffect {
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        size: config.size,
        initialSize: config.size,
        lifetime: 0,
        maxLifetime: config.lifetime,
        active: false,
      });
    }

    // Create geometry with buffer attributes
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    const colorAttribute = new THREE.BufferAttribute(colors, 3);
    const sizeAttribute = new THREE.BufferAttribute(sizes, 1);

    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('color', colorAttribute);
    geometry.setAttribute('size', sizeAttribute);

    // Create points mesh with cloned material for independent opacity
    const material = this.material.clone();
    const mesh = new THREE.Points(geometry, material);
    mesh.frustumCulled = false;

    return {
      particles,
      config,
      mesh,
      geometry,
      positionAttribute,
      colorAttribute,
      sizeAttribute,
      activeCount: 0,
    };
  }

  /**
   * Initialize particles for an effect
   */
  private initializeParticles(
    effect: ActiveEffect,
    position: THREE.Vector3,
    config: ParticleEffectConfig,
    direction?: THREE.Vector3,
    scale?: number
  ): void {
    const scaleMultiplier = scale ?? 1;

    effect.particles.forEach((particle) => {
      particle.active = true;

      // Set position based on emission shape
      switch (config.emissionShape) {
        case 'sphere': {
          const radius = (config.emissionRadius ?? 0.5) * scaleMultiplier;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          particle.position.set(
            position.x + radius * Math.sin(phi) * Math.cos(theta),
            position.y + radius * Math.sin(phi) * Math.sin(theta),
            position.z + radius * Math.cos(phi)
          );
          break;
        }
        case 'cone': {
          const angle = (config.coneAngle ?? Math.PI / 4) * Math.random();
          const rotation = Math.random() * Math.PI * 2;
          const dir = direction ?? new THREE.Vector3(0, 1, 0);
          particle.position.copy(position);

          // Set velocity in cone shape around direction
          const perpX = new THREE.Vector3(1, 0, 0);
          const perpZ = new THREE.Vector3(0, 0, 1);
          if (Math.abs(dir.y) < 0.99) {
            perpX.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
            perpZ.crossVectors(dir, perpX).normalize();
          }

          particle.velocity.copy(dir);
          particle.velocity.addScaledVector(perpX, Math.sin(angle) * Math.cos(rotation));
          particle.velocity.addScaledVector(perpZ, Math.sin(angle) * Math.sin(rotation));
          particle.velocity.normalize();
          particle.velocity.multiplyScalar(config.velocitySpread.length() * scaleMultiplier);
          break;
        }
        default:
          particle.position.copy(position);
      }

      // Set velocity for non-cone shapes
      if (config.emissionShape !== 'cone') {
        particle.velocity.set(
          (Math.random() - 0.5) * 2 * config.velocitySpread.x * scaleMultiplier,
          (Math.random() - 0.5) * 2 * config.velocitySpread.y * scaleMultiplier + 1,
          (Math.random() - 0.5) * 2 * config.velocitySpread.z * scaleMultiplier
        );
      }

      // Set color
      const baseColor = new THREE.Color(config.color);
      if (config.colorEnd !== undefined) {
        const endColor = new THREE.Color(config.colorEnd);
        baseColor.lerp(endColor, Math.random());
      }
      particle.color.copy(baseColor);

      // Set size with variation
      particle.size =
        (config.size + (Math.random() - 0.5) * 2 * config.sizeVariation) * scaleMultiplier;
      particle.initialSize = particle.size;

      // Set lifetime with variation
      particle.maxLifetime =
        config.lifetime + (Math.random() - 0.5) * 2 * config.lifetimeVariation;
      particle.lifetime = particle.maxLifetime;
    });

    effect.activeCount = effect.particles.length;
    this.updateBuffers(effect);
  }

  /**
   * Update all active particle effects
   */
  update(deltaTime: number): void {
    const effectsToRemove: number[] = [];

    this.activeEffects.forEach((effect, index) => {
      let hasActiveParticles = false;

      effect.particles.forEach((particle) => {
        if (!particle.active) return;

        // Update lifetime
        particle.lifetime -= deltaTime;

        if (particle.lifetime <= 0) {
          particle.active = false;
          return;
        }

        hasActiveParticles = true;

        // Update position
        particle.position.addScaledVector(particle.velocity, deltaTime);

        // Apply gravity
        particle.velocity.y += effect.config.gravity * deltaTime;

        // Calculate life ratio (0 = dead, 1 = just spawned)
        const lifeRatio = particle.lifetime / particle.maxLifetime;

        // Apply shrink
        if (effect.config.shrink) {
          particle.size = particle.initialSize * lifeRatio;
        }

        // Apply fade (handled in material opacity for now)
        if (effect.config.fadeOut) {
          particle.color.multiplyScalar(0.98);
        }
      });

      // Update buffers
      this.updateBuffers(effect);

      // Update material opacity for fade
      if (effect.config.fadeOut) {
        const avgLifeRatio =
          effect.particles.reduce((sum, p) => sum + (p.active ? p.lifetime / p.maxLifetime : 0), 0) /
          effect.particles.filter((p) => p.active).length;
        (effect.mesh.material as THREE.PointsMaterial).opacity = Math.max(0, avgLifeRatio);
      }

      if (!hasActiveParticles) {
        effectsToRemove.push(index);
      }
    });

    // Remove completed effects (in reverse order to maintain indices)
    effectsToRemove.reverse().forEach((index) => {
      const effect = this.activeEffects[index];
      this.scene.remove(effect.mesh);
      this.returnToPool(effect);
      this.activeEffects.splice(index, 1);
    });
  }

  /**
   * Update buffer attributes for GPU
   */
  private updateBuffers(effect: ActiveEffect): void {
    const positions = effect.positionAttribute.array as Float32Array;
    const colors = effect.colorAttribute.array as Float32Array;
    const sizes = effect.sizeAttribute.array as Float32Array;

    effect.particles.forEach((particle, i) => {
      if (particle.active) {
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;

        colors[i * 3] = particle.color.r;
        colors[i * 3 + 1] = particle.color.g;
        colors[i * 3 + 2] = particle.color.b;

        sizes[i] = particle.size;
      } else {
        // Move inactive particles far away
        positions[i * 3] = 0;
        positions[i * 3 + 1] = -1000;
        positions[i * 3 + 2] = 0;
        sizes[i] = 0;
      }
    });

    effect.positionAttribute.needsUpdate = true;
    effect.colorAttribute.needsUpdate = true;
    effect.sizeAttribute.needsUpdate = true;
  }

  /**
   * Get a pooled effect if available
   */
  private getFromPool(type: ParticleEffectType): ActiveEffect | null {
    const pool = this.effectPool.get(type);
    if (pool && pool.length > 0) {
      return pool.pop()!;
    }
    return null;
  }

  /**
   * Return an effect to the pool
   */
  private returnToPool(effect: ActiveEffect): void {
    // Determine type from config (simplified - in practice you'd track this)
    const type = this.getEffectType(effect.config);
    if (!type) {
      this.disposeEffect(effect);
      return;
    }

    let pool = this.effectPool.get(type);
    if (!pool) {
      pool = [];
      this.effectPool.set(type, pool);
    }

    if (pool.length < this.maxPoolSize) {
      // Reset particles
      effect.particles.forEach((p) => (p.active = false));
      effect.activeCount = 0;
      pool.push(effect);
    } else {
      this.disposeEffect(effect);
    }
  }

  /**
   * Get effect type from config (for pooling)
   */
  private getEffectType(config: ParticleEffectConfig): ParticleEffectType | null {
    for (const [type, defaultConfig] of Object.entries(DEFAULT_CONFIGS)) {
      if (
        config.count === defaultConfig.count &&
        config.color === defaultConfig.color &&
        config.lifetime === defaultConfig.lifetime
      ) {
        return type as ParticleEffectType;
      }
    }
    return null;
  }

  /**
   * Dispose of an effect's resources
   */
  private disposeEffect(effect: ActiveEffect): void {
    effect.geometry.dispose();
    (effect.mesh.material as THREE.Material).dispose();
  }

  /**
   * Set mobile mode (reduces particle counts)
   */
  setMobileMode(isMobile: boolean): void {
    this.isMobile = isMobile;
    this.particleMultiplier = isMobile ? 0.5 : 1.0;
  }

  /**
   * Get the number of active effects
   */
  getActiveEffectCount(): number {
    return this.activeEffects.length;
  }

  /**
   * Get total active particle count
   */
  getActiveParticleCount(): number {
    return this.activeEffects.reduce(
      (sum, effect) => sum + effect.particles.filter((p) => p.active).length,
      0
    );
  }

  /**
   * Clear all active effects
   */
  clear(): void {
    this.activeEffects.forEach((effect) => {
      this.scene.remove(effect.mesh);
      this.disposeEffect(effect);
    });
    this.activeEffects = [];
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clear();

    // Clear pools
    this.effectPool.forEach((pool) => {
      pool.forEach((effect) => this.disposeEffect(effect));
    });
    this.effectPool.clear();

    // Dispose shared material
    this.material.dispose();
  }
}
