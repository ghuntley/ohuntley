/**
 * Fog of War System for Meerkat Maze Runner
 * Limits player visibility to a radius around their position in 3D view
 */

import * as THREE from 'three';
import { CELL_SIZE, FOG_VISIBILITY_RADIUS } from '../utils/Constants';

/**
 * Configuration for fog of war effect
 */
export interface FogOfWarConfig {
  /** Visibility radius in world units */
  visibilityRadius: number;
  /** Fade distance (transition zone) in world units */
  fadeDistance: number;
  /** Darkness level at edge (0 = black, 1 = normal) */
  minVisibility: number;
}

/**
 * Default fog of war configuration
 */
const DEFAULT_CONFIG: FogOfWarConfig = {
  visibilityRadius: FOG_VISIBILITY_RADIUS * CELL_SIZE,
  fadeDistance: CELL_SIZE * 2,
  minVisibility: 0.05,
};

/**
 * Custom shader for fog of war effect
 * Darkens objects based on distance from player position
 */
const fogOfWarVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fogOfWarFragmentShader = `
  uniform vec3 playerPosition;
  uniform float visibilityRadius;
  uniform float fadeDistance;
  uniform float minVisibility;
  uniform vec3 baseColor;
  uniform float roughness;
  uniform float metalness;
  uniform vec3 ambientLight;
  uniform vec3 lightDirection;
  uniform vec3 lightColor;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    // Calculate distance from player (in XZ plane for top-down visibility)
    float distXZ = distance(vec2(vWorldPosition.x, vWorldPosition.z), vec2(playerPosition.x, playerPosition.z));

    // Calculate visibility factor
    float innerRadius = visibilityRadius - fadeDistance;
    float visibility = 1.0;

    if (distXZ > innerRadius) {
      visibility = 1.0 - smoothstep(innerRadius, visibilityRadius, distXZ);
      visibility = max(visibility, minVisibility);
    }

    // Simple lighting calculation
    vec3 normal = normalize(vNormal);
    float diffuse = max(dot(normal, lightDirection), 0.0);

    // Combine lighting
    vec3 lighting = ambientLight + lightColor * diffuse;
    vec3 finalColor = baseColor * lighting;

    // Apply visibility (darken based on distance)
    finalColor *= visibility;

    // Output with slight transparency at far edges
    float alpha = visibility > minVisibility ? 1.0 : 0.0;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

/**
 * FogOfWarSystem manages visibility-based rendering
 */
export class FogOfWarSystem {
  private config: FogOfWarConfig;
  private playerPosition: THREE.Vector3;
  private materials: Map<string, THREE.ShaderMaterial>;
  private enabled: boolean;

  constructor(config: Partial<FogOfWarConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.playerPosition = new THREE.Vector3();
    this.materials = new Map();
    this.enabled = true;
  }

  /**
   * Create a fog of war material based on an existing standard material
   */
  createFogMaterial(
    baseMaterial: THREE.MeshStandardMaterial,
    materialId: string
  ): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        playerPosition: { value: this.playerPosition },
        visibilityRadius: { value: this.config.visibilityRadius },
        fadeDistance: { value: this.config.fadeDistance },
        minVisibility: { value: this.config.minVisibility },
        baseColor: { value: new THREE.Color(baseMaterial.color) },
        roughness: { value: baseMaterial.roughness },
        metalness: { value: baseMaterial.metalness },
        ambientLight: { value: new THREE.Color(0x404040) },
        lightDirection: { value: new THREE.Vector3(0.5, 1, 0.5).normalize() },
        lightColor: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: fogOfWarVertexShader,
      fragmentShader: fogOfWarFragmentShader,
      transparent: true,
      side: baseMaterial.side,
    });

    this.materials.set(materialId, material);
    return material;
  }

  /**
   * Update player position for all fog materials
   */
  updatePlayerPosition(position: { x: number; y: number; z: number }): void {
    this.playerPosition.set(position.x, position.y, position.z);

    // Update all materials with new player position
    this.materials.forEach((material) => {
      material.uniforms.playerPosition.value.copy(this.playerPosition);
    });
  }

  /**
   * Set visibility radius
   */
  setVisibilityRadius(radius: number): void {
    this.config.visibilityRadius = radius;
    this.materials.forEach((material) => {
      material.uniforms.visibilityRadius.value = radius;
    });
  }

  /**
   * Get current visibility radius
   */
  getVisibilityRadius(): number {
    return this.config.visibilityRadius;
  }

  /**
   * Enable or disable fog of war
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // Set full visibility when disabled
      this.materials.forEach((material) => {
        material.uniforms.visibilityRadius.value = 10000;
      });
    } else {
      // Restore configured visibility
      this.materials.forEach((material) => {
        material.uniforms.visibilityRadius.value = this.config.visibilityRadius;
      });
    }
  }

  /**
   * Check if fog of war is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get a material by ID
   */
  getMaterial(materialId: string): THREE.ShaderMaterial | undefined {
    return this.materials.get(materialId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FogOfWarConfig>): void {
    this.config = { ...this.config, ...config };

    this.materials.forEach((material) => {
      if (config.visibilityRadius !== undefined) {
        material.uniforms.visibilityRadius.value = this.config.visibilityRadius;
      }
      if (config.fadeDistance !== undefined) {
        material.uniforms.fadeDistance.value = this.config.fadeDistance;
      }
      if (config.minVisibility !== undefined) {
        material.uniforms.minVisibility.value = this.config.minVisibility;
      }
    });
  }

  /**
   * Check if a world position is visible to the player
   */
  isPositionVisible(position: { x: number; z: number }): boolean {
    if (!this.enabled) return true;

    const distXZ = Math.sqrt(
      Math.pow(position.x - this.playerPosition.x, 2) +
      Math.pow(position.z - this.playerPosition.z, 2)
    );

    return distXZ <= this.config.visibilityRadius;
  }

  /**
   * Get visibility factor for a position (0-1)
   */
  getVisibilityFactor(position: { x: number; z: number }): number {
    if (!this.enabled) return 1;

    const distXZ = Math.sqrt(
      Math.pow(position.x - this.playerPosition.x, 2) +
      Math.pow(position.z - this.playerPosition.z, 2)
    );

    const innerRadius = this.config.visibilityRadius - this.config.fadeDistance;

    if (distXZ <= innerRadius) return 1;
    if (distXZ >= this.config.visibilityRadius) return this.config.minVisibility;

    const t = (distXZ - innerRadius) / this.config.fadeDistance;
    return 1 - t * (1 - this.config.minVisibility);
  }

  /**
   * Dispose of all materials
   */
  dispose(): void {
    this.materials.forEach((material) => material.dispose());
    this.materials.clear();
  }
}
