import * as THREE from 'three';
import { GameState, GameStateType } from './GameState';
import {
  CAMERA_FOV,
  CAMERA_DISTANCE,
  CAMERA_HEIGHT_OFFSET,
  MAX_DELTA_TIME,
} from '../utils/Constants';

/**
 * Main Game class for Meerkat Maze Runner
 * Manages the game loop, scene, and core systems
 */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private gameState: GameState;

  // Timing
  private clock: THREE.Clock;
  private lastTime: number;
  private animationFrameId: number | null;

  // Debug
  private debugMode: boolean;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.clock = new THREE.Clock(false);
    this.lastTime = 0;
    this.animationFrameId = null;
    this.debugMode = false;

    // Initialize game state
    this.gameState = new GameState(GameStateType.MENU);

    // Initialize scene
    this.scene = this.createScene();

    // Initialize camera
    this.camera = this.createCamera();

    // Set up scene elements
    this.setupLighting();
    this.setupPlaceholderContent();

    // Set up state change handlers
    this.setupStateHandlers();

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Create and configure the Three.js scene
   */
  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();

    // Set fog for atmosphere (will integrate with fog of war later)
    scene.fog = new THREE.Fog(0x87ceeb, 30, 100);

    // Set background color (sky blue)
    scene.background = new THREE.Color(0x87ceeb);

    return scene;
  }

  /**
   * Create and configure the camera
   */
  private createCamera(): THREE.PerspectiveCamera {
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 1000);

    // Position camera for third-person view
    camera.position.set(0, CAMERA_HEIGHT_OFFSET, CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);

    return camera;
  }

  /**
   * Set up scene lighting
   */
  private setupLighting(): void {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light for sun-like shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;

    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.bias = -0.0001;

    this.scene.add(directionalLight);

    // Hemisphere light for sky/ground color variation
    const hemisphereLight = new THREE.HemisphereLight(
      0x87ceeb, // Sky color
      0x556b2f, // Ground color (dark olive green for grass)
      0.3
    );
    this.scene.add(hemisphereLight);
  }

  /**
   * Set up placeholder content for testing
   * This will be replaced with actual maze and entities
   */
  private setupPlaceholderContent(): void {
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a5f0b, // Grass green
      roughness: 0.8,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Placeholder player (capsule)
    const playerGeometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({
      color: 0xd2691e, // Brown for meerkat
      roughness: 0.7,
    });
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.y = 1;
    player.castShadow = true;
    this.scene.add(player);

    // Placeholder walls to test shadows and rendering
    const wallGeometry = new THREE.BoxGeometry(0.5, 9, 4);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x228b22, // Forest green for hedge
      roughness: 0.9,
    });

    // Create a few test walls
    const wallPositions = [
      { x: 5, z: 0 },
      { x: -5, z: 0 },
      { x: 0, z: 5 },
      { x: 0, z: -5 },
    ];

    wallPositions.forEach((pos) => {
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(pos.x, 4.5, pos.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
    });
  }

  /**
   * Set up state change event handlers
   */
  private setupStateHandlers(): void {
    this.gameState.addListener((newState, previousState) => {
      console.log(`Game state changed: ${previousState} -> ${newState}`);

      switch (newState) {
        case GameStateType.PLAYING:
          this.clock.start();
          break;
        case GameStateType.PAUSED:
        case GameStateType.GAME_OVER:
        case GameStateType.LEVEL_COMPLETE:
          // Don't stop clock, just pause updates
          break;
        case GameStateType.MENU:
          this.clock.stop();
          break;
      }
    });
  }

  /**
   * Set up keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'Escape':
          this.handlePauseToggle();
          break;
        case 'Backquote':
          this.toggleDebugMode();
          break;
        case 'Enter':
        case 'Space':
          // Start game from menu
          if (this.gameState.is(GameStateType.MENU)) {
            this.gameState.transitionTo(GameStateType.PLAYING);
          }
          break;
      }
    });
  }

  /**
   * Handle pause/resume toggle
   */
  private handlePauseToggle(): void {
    if (this.gameState.is(GameStateType.PLAYING)) {
      this.gameState.transitionTo(GameStateType.PAUSED);
    } else if (this.gameState.is(GameStateType.PAUSED)) {
      this.gameState.transitionTo(GameStateType.PLAYING);
    }
  }

  /**
   * Toggle debug mode
   */
  private toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    console.log(`Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.animationFrameId !== null) {
      return; // Already running
    }

    this.clock.start();
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clock.stop();
  }

  /**
   * Pause the game
   */
  pause(): void {
    if (this.gameState.is(GameStateType.PLAYING)) {
      this.gameState.transitionTo(GameStateType.PAUSED);
    }
  }

  /**
   * Main game loop
   */
  private gameLoop(): void {
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));

    // Calculate delta time
    const currentTime = performance.now();
    let deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;

    // Clamp delta time to prevent physics issues
    deltaTime = Math.min(deltaTime, MAX_DELTA_TIME);

    // Update game logic if state allows
    if (this.gameState.shouldUpdate()) {
      this.update(deltaTime);
    }

    // Always render
    if (this.gameState.shouldRender()) {
      this.render();
    }
  }

  /**
   * Update game logic
   */
  private update(deltaTime: number): void {
    // TODO: Update player
    // TODO: Update zombies
    // TODO: Update camera
    // TODO: Update power-ups
    // TODO: Check collisions
    // TODO: Update timer

    // For now, just rotate camera slowly for visual feedback
    // This will be replaced with proper camera follow
    // const time = this.clock.getElapsedTime();
    // this.camera.position.x = Math.sin(time * 0.1) * CAMERA_DISTANCE;
    // this.camera.position.z = Math.cos(time * 0.1) * CAMERA_DISTANCE;
    // this.camera.lookAt(0, 0, 0);
  }

  /**
   * Render the scene
   */
  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handle window resize
   */
  handleResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Get the current game state
   */
  getState(): GameStateType {
    return this.gameState.state;
  }

  /**
   * Get the game state manager
   */
  getStateManager(): GameState {
    return this.gameState;
  }
}
