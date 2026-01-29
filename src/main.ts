import * as THREE from 'three';
import { Game } from './game/Game';

/**
 * Main entry point for Meerkat Maze Runner
 * Initializes the Three.js renderer and starts the game
 */

class Application {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private game: Game;

  constructor() {
    const container = document.getElementById('game-container');
    if (!container) {
      throw new Error('Game container element not found');
    }
    this.container = container;

    // Initialize WebGL renderer
    this.renderer = this.createRenderer();
    this.container.appendChild(this.renderer.domElement);

    // Initialize game
    this.game = new Game(this.renderer);

    // Set up event handlers
    this.setupEventHandlers();

    // Hide loading screen
    this.hideLoadingScreen();

    // Start game loop
    this.game.start();
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });

    // Configure renderer settings
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Set clear color to match sky
    renderer.setClearColor(0x87ceeb, 1);

    return renderer;
  }

  private setupEventHandlers(): void {
    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));

    // Handle visibility change (pause when tab hidden)
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Prevent context menu on right-click
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height);
    this.game.handleResize(width, height);
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.game.pause();
    }
  }

  private hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    new Application();
  } catch (error) {
    console.error('Failed to initialize game:', error);
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.innerHTML = `
        <div class="loading-text" style="color: #ff6b6b;">
          Failed to initialize game. Please ensure WebGL is supported.
        </div>
      `;
    }
  }
});
