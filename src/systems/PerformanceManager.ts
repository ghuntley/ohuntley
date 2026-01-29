import * as THREE from 'three';
import {
  MOBILE_SHADOW_MAP_SIZE,
  DESKTOP_SHADOW_MAP_SIZE,
  MOBILE_FOG_NEAR,
  MOBILE_FOG_FAR,
  DESKTOP_FOG_NEAR,
  DESKTOP_FOG_FAR,
  MOBILE_PIXEL_RATIO_CAP,
} from '../utils/Constants';

/**
 * Performance tier based on device capabilities
 */
export enum PerformanceTier {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * Performance settings for each tier
 */
export interface PerformanceSettings {
  shadowMapSize: number;
  shadowsEnabled: boolean;
  fogNear: number;
  fogFar: number;
  pixelRatio: number;
  particleMultiplier: number;
  antialias: boolean;
  maxLights: number;
}

/**
 * Performance tier configurations
 */
const TIER_SETTINGS: Record<PerformanceTier, PerformanceSettings> = {
  [PerformanceTier.LOW]: {
    shadowMapSize: 512,
    shadowsEnabled: false,
    fogNear: MOBILE_FOG_NEAR,
    fogFar: MOBILE_FOG_FAR,
    pixelRatio: 1,
    particleMultiplier: 0.3,
    antialias: false,
    maxLights: 2,
  },
  [PerformanceTier.MEDIUM]: {
    shadowMapSize: MOBILE_SHADOW_MAP_SIZE,
    shadowsEnabled: true,
    fogNear: MOBILE_FOG_NEAR,
    fogFar: MOBILE_FOG_FAR,
    pixelRatio: Math.min(window.devicePixelRatio, MOBILE_PIXEL_RATIO_CAP),
    particleMultiplier: 0.5,
    antialias: false,
    maxLights: 3,
  },
  [PerformanceTier.HIGH]: {
    shadowMapSize: DESKTOP_SHADOW_MAP_SIZE,
    shadowsEnabled: true,
    fogNear: DESKTOP_FOG_NEAR,
    fogFar: DESKTOP_FOG_FAR,
    pixelRatio: window.devicePixelRatio,
    particleMultiplier: 1.0,
    antialias: true,
    maxLights: 5,
  },
};

/**
 * Manages performance settings based on device capabilities
 */
export class PerformanceManager {
  private static instance: PerformanceManager | null = null;

  private isMobile: boolean;
  private tier: PerformanceTier;
  private settings: PerformanceSettings;
  private fps: number;
  private frameCount: number;
  private lastFpsUpdate: number;
  private fpsHistory: number[];

  private constructor() {
    this.isMobile = this.detectMobile();
    this.tier = this.detectPerformanceTier();
    this.settings = TIER_SETTINGS[this.tier];
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.fpsHistory = [];
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    PerformanceManager.instance = null;
  }

  /**
   * Detect if running on a mobile device
   */
  private detectMobile(): boolean {
    // Check for touch support
    const msNav = navigator as unknown as { msMaxTouchPoints?: number };
    const hasTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (msNav.msMaxTouchPoints ?? 0) > 0;

    // Check user agent for mobile keywords
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Check screen size
    const smallScreen = window.innerWidth <= 768 || window.innerHeight <= 600;

    // Consider it mobile if it has touch AND (mobile UA OR small screen)
    return hasTouch && (mobileUA || smallScreen);
  }

  /**
   * Detect performance tier based on device capabilities
   */
  private detectPerformanceTier(): PerformanceTier {
    // Check for WebGL2 support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      return PerformanceTier.LOW;
    }

    // Get renderer info
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let gpuInfo = '';

    if (debugInfo) {
      gpuInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    }

    // Check for low-end GPU indicators
    const lowEndGPUs = ['Mali-4', 'Mali-T', 'Adreno 3', 'Adreno 4', 'Intel HD', 'Apple A7', 'Apple A8'];
    const isLowEndGPU = lowEndGPUs.some((gpu) => gpuInfo.includes(gpu));

    // Check device memory (if available)
    const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    const lowMemory = deviceMemory !== undefined && deviceMemory < 4;

    // Check hardware concurrency
    const lowCores = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4;

    if (this.isMobile) {
      if (isLowEndGPU || lowMemory || lowCores) {
        return PerformanceTier.LOW;
      }
      return PerformanceTier.MEDIUM;
    }

    // Desktop
    if (isLowEndGPU || lowMemory) {
      return PerformanceTier.MEDIUM;
    }

    return PerformanceTier.HIGH;
  }

  /**
   * Check if device is mobile
   */
  getIsMobile(): boolean {
    return this.isMobile;
  }

  /**
   * Get current performance tier
   */
  getTier(): PerformanceTier {
    return this.tier;
  }

  /**
   * Get current performance settings
   */
  getSettings(): PerformanceSettings {
    return { ...this.settings };
  }

  /**
   * Apply performance settings to renderer
   */
  applyToRenderer(renderer: THREE.WebGLRenderer): void {
    renderer.setPixelRatio(this.settings.pixelRatio);
    renderer.shadowMap.enabled = this.settings.shadowsEnabled;

    if (this.settings.shadowsEnabled) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
  }

  /**
   * Apply performance settings to scene
   */
  applyToScene(scene: THREE.Scene): void {
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = this.settings.fogNear;
      scene.fog.far = this.settings.fogFar;
    } else {
      scene.fog = new THREE.Fog(0x87ceeb, this.settings.fogNear, this.settings.fogFar);
    }
  }

  /**
   * Apply performance settings to lights
   */
  applyToLight(light: THREE.DirectionalLight): void {
    if (this.settings.shadowsEnabled) {
      light.castShadow = true;
      light.shadow.mapSize.width = this.settings.shadowMapSize;
      light.shadow.mapSize.height = this.settings.shadowMapSize;
    } else {
      light.castShadow = false;
    }
  }

  /**
   * Get particle multiplier for current tier
   */
  getParticleMultiplier(): number {
    return this.settings.particleMultiplier;
  }

  /**
   * Track frame for FPS calculation
   */
  trackFrame(): void {
    this.frameCount++;

    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;

    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.fpsHistory.push(this.fps);

      // Keep last 10 samples
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }

      this.frameCount = 0;
      this.lastFpsUpdate = now;

      // Auto-adjust tier if needed
      this.autoAdjustTier();
    }
  }

  /**
   * Auto-adjust performance tier based on FPS
   */
  private autoAdjustTier(): void {
    if (this.fpsHistory.length < 5) return;

    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    // If FPS is consistently low, drop tier
    if (avgFps < 25 && this.tier !== PerformanceTier.LOW) {
      if (this.tier === PerformanceTier.HIGH) {
        this.tier = PerformanceTier.MEDIUM;
      } else {
        this.tier = PerformanceTier.LOW;
      }
      this.settings = TIER_SETTINGS[this.tier];
      console.log(`Performance tier adjusted to: ${this.tier} (avg FPS: ${avgFps.toFixed(1)})`);
    }
    // If FPS is consistently high and we're not at max tier
    else if (avgFps > 55 && this.tier === PerformanceTier.LOW && !this.isMobile) {
      this.tier = PerformanceTier.MEDIUM;
      this.settings = TIER_SETTINGS[this.tier];
      console.log(`Performance tier upgraded to: ${this.tier} (avg FPS: ${avgFps.toFixed(1)})`);
    }
  }

  /**
   * Get current FPS
   */
  getFps(): number {
    return this.fps;
  }

  /**
   * Force a specific performance tier
   */
  setTier(tier: PerformanceTier): void {
    this.tier = tier;
    this.settings = TIER_SETTINGS[tier];
  }

  /**
   * Get recommended renderer options
   */
  getRendererOptions(): THREE.WebGLRendererParameters {
    return {
      antialias: this.settings.antialias,
      powerPreference: this.isMobile ? 'low-power' : 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    };
  }
}
