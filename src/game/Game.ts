import * as THREE from 'three';
import { GameState, GameStateType } from './GameState';
import {
  CAMERA_FOV,
  CAMERA_DISTANCE,
  CAMERA_HEIGHT_OFFSET,
  MAX_DELTA_TIME,
  CELL_SIZE,
  MAZE_SIZES,
  ZOMBIE_COUNTS,
  SWORD_SPAWN_CHANCE,
} from '../utils/Constants';

// Entities
import { Player } from '../entities/Player';
import { Zombie, ZombieState } from '../entities/Zombie';
import { Sword } from '../entities/Sword';
import { PowerUp, PowerUpType, PowerUpEffectManager } from '../entities/PowerUp';

// Systems
import { InputManager, InputAction } from '../systems/InputManager';
import { CollisionSystem } from '../systems/CollisionSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { Pathfinding } from '../systems/Pathfinding';

// Maze
import { MazeGenerator, Point } from '../maze/MazeGenerator';
import { MazeRenderer } from '../maze/MazeRenderer';

// Camera
import { FollowCamera } from '../camera/FollowCamera';

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

  // Game level
  private currentLevel: number;

  // Maze
  private mazeGenerator: MazeGenerator | null;
  private mazeRenderer: MazeRenderer;
  private pathfinding: Pathfinding | null;

  // Entities
  private player: Player;
  private zombies: Zombie[];
  private sword: Sword | null;
  private powerUps: PowerUp[];

  // 3D Meshes for entities
  private playerMesh: THREE.Mesh | null;
  private zombieMeshes: Map<number, THREE.Mesh>;
  private swordMesh: THREE.Mesh | null;
  private powerUpMeshes: Map<number, THREE.Mesh>;

  // Systems
  private inputManager: InputManager;
  private collisionSystem: CollisionSystem;
  private combatSystem: CombatSystem;
  private followCamera: FollowCamera;
  private powerUpEffects: PowerUpEffectManager;

  // Debug
  private debugMode: boolean;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.clock = new THREE.Clock(false);
    this.lastTime = 0;
    this.animationFrameId = null;
    this.debugMode = false;
    this.currentLevel = 1;

    // Initialize game state
    this.gameState = new GameState(GameStateType.MENU);

    // Initialize scene
    this.scene = this.createScene();

    // Initialize camera
    this.camera = this.createCamera();

    // Initialize maze renderer
    this.mazeRenderer = new MazeRenderer(this.scene);
    this.mazeGenerator = null;
    this.pathfinding = null;

    // Initialize entities
    this.player = new Player();
    this.zombies = [];
    this.sword = null;
    this.powerUps = [];

    // Initialize 3D mesh maps
    this.playerMesh = null;
    this.zombieMeshes = new Map();
    this.swordMesh = null;
    this.powerUpMeshes = new Map();

    // Initialize systems
    this.inputManager = InputManager.getInstance();
    this.collisionSystem = new CollisionSystem();
    this.combatSystem = new CombatSystem();
    this.followCamera = new FollowCamera(this.camera);
    this.powerUpEffects = new PowerUpEffectManager();

    // Set up lighting
    this.setupLighting();

    // Create player mesh
    this.createPlayerMesh();

    // Set up state change handlers
    this.setupStateHandlers();

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Set up input action handlers
    this.setupInputHandlers();

    // Set up power-up effect callbacks
    this.setupPowerUpCallbacks();
  }

  /**
   * Create and configure the Three.js scene
   */
  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();

    // Set fog for atmosphere
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
   * Create the player mesh
   */
  private createPlayerMesh(): void {
    const playerGeometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({
      color: 0xd2691e, // Brown for meerkat
      roughness: 0.7,
    });
    this.playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    this.playerMesh.castShadow = true;
    this.playerMesh.name = 'player';
    this.scene.add(this.playerMesh);
  }

  /**
   * Create a zombie mesh
   */
  private createZombieMesh(zombie: Zombie): THREE.Mesh {
    const zombieGeometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const zombieMaterial = new THREE.MeshStandardMaterial({
      color: 0x556b2f, // Dark olive green (zombie meerkat)
      roughness: 0.8,
      emissive: 0x220000,
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(zombieGeometry, zombieMaterial);
    mesh.castShadow = true;
    mesh.name = `zombie_${zombie.getId()}`;
    this.scene.add(mesh);
    this.zombieMeshes.set(zombie.getId(), mesh);
    return mesh;
  }

  /**
   * Create a sword mesh
   */
  private createSwordMesh(sword: Sword): THREE.Mesh {
    const swordGroup = new THREE.Group();

    // Blade
    const bladeGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.02);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0,
      metalness: 0.8,
      roughness: 0.2,
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.4;
    swordGroup.add(blade);

    // Handle
    const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.8,
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    swordGroup.add(handle);

    // Convert group to mesh for simplicity
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1, 0.1),
      new THREE.MeshStandardMaterial({
        color: 0xc0c0c0,
        metalness: 0.7,
        roughness: 0.3,
        emissive: 0xffffff,
        emissiveIntensity: 0.1,
      })
    );
    mesh.castShadow = true;
    mesh.name = 'sword';
    this.scene.add(mesh);
    this.swordMesh = mesh;
    return mesh;
  }

  /**
   * Create a power-up mesh
   */
  private createPowerUpMesh(powerUp: PowerUp): THREE.Mesh {
    const visual = powerUp.getVisual();
    const geometry = new THREE.OctahedronGeometry(0.3);
    const material = new THREE.MeshStandardMaterial({
      color: visual.color,
      emissive: visual.color,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.name = `powerup_${powerUp.getId()}`;
    this.scene.add(mesh);
    this.powerUpMeshes.set(powerUp.getId(), mesh);
    return mesh;
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
          // Start game from menu or restart
          if (this.gameState.is(GameStateType.MENU)) {
            this.startLevel(1);
          } else if (this.gameState.is(GameStateType.GAME_OVER)) {
            this.startLevel(1);
          } else if (this.gameState.is(GameStateType.LEVEL_COMPLETE)) {
            this.startLevel(this.currentLevel + 1);
          }
          break;
      }
    });
  }

  /**
   * Set up input action handlers
   */
  private setupInputHandlers(): void {
    this.inputManager.addListener(InputAction.ATTACK, (pressed) => {
      if (pressed && this.gameState.is(GameStateType.PLAYING)) {
        this.handleAttack();
      }
    });
  }

  /**
   * Set up power-up effect callbacks
   */
  private setupPowerUpCallbacks(): void {
    this.powerUpEffects.setOnFreezeZombies((duration) => {
      this.zombies.forEach((zombie) => {
        if (zombie.isAlive()) {
          zombie.freeze(duration);
        }
      });
    });

    this.powerUpEffects.setOnRefillSprint(() => {
      // Refill player sprint gauge - would need to add method to Player
      // For now this is a placeholder
      console.log('Sprint refilled!');
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
   * Handle attack action
   */
  private handleAttack(): void {
    const result = this.combatSystem.attack(this.player, this.zombies);

    if (result.hit) {
      result.hitZombies.forEach((zombie) => {
        zombie.die();
        console.log(`Zombie ${zombie.getId()} killed!`);
      });
    }
  }

  /**
   * Start a new level
   */
  startLevel(level: number): void {
    this.currentLevel = level;

    // Determine maze size based on level
    const mazeSize = this.getMazeSizeForLevel(level);

    // Generate new maze
    this.mazeGenerator = new MazeGenerator({
      width: mazeSize,
      height: mazeSize,
      seed: Date.now() + level,
    });
    this.mazeGenerator.generate();

    // Initialize pathfinding
    this.pathfinding = new Pathfinding(this.mazeGenerator);

    // Build maze renderer
    this.mazeRenderer.build(this.mazeGenerator);

    // Initialize collision system with maze
    this.collisionSystem.initializeFromMaze(this.mazeGenerator);

    // Clear existing entities
    this.clearEntities();

    // Set up player at start position
    const start = this.mazeGenerator.getStart();
    const playerStartPos = {
      x: start.x * CELL_SIZE,
      y: 0,
      z: start.y * CELL_SIZE,
    };
    this.player.reset(playerStartPos);

    // Spawn zombies
    this.spawnZombies(level);

    // Spawn sword (based on probability)
    this.spawnSword(level);

    // Spawn power-ups
    this.spawnPowerUps(level);

    // Reset power-up effects
    this.powerUpEffects.reset();

    // Position camera
    this.followCamera.snapToTarget(playerStartPos);

    // Start the game
    this.gameState.transitionTo(GameStateType.PLAYING);
  }

  /**
   * Get maze size for level
   */
  private getMazeSizeForLevel(level: number): number {
    if (level <= 3) return MAZE_SIZES.SMALL;
    if (level <= 6) return MAZE_SIZES.MEDIUM;
    return MAZE_SIZES.LARGE;
  }

  /**
   * Get zombie count range for level
   */
  private getZombieCountForLevel(level: number): { min: number; max: number } {
    if (level <= 3) return ZOMBIE_COUNTS.EASY;
    if (level <= 6) return ZOMBIE_COUNTS.MEDIUM;
    if (level <= 9) return ZOMBIE_COUNTS.HARD;
    return ZOMBIE_COUNTS.ENDLESS;
  }

  /**
   * Spawn zombies for level
   */
  private spawnZombies(level: number): void {
    if (!this.mazeGenerator || !this.pathfinding) return;

    const countRange = this.getZombieCountForLevel(level);
    const zombieCount =
      Math.floor(Math.random() * (countRange.max - countRange.min + 1)) + countRange.min;

    const { width, height } = this.mazeGenerator.getDimensions();
    const start = this.mazeGenerator.getStart();

    // Minimum distance from player start (in grid cells)
    const minDistanceFromStart = 3;

    for (let i = 0; i < zombieCount; i++) {
      const zombie = new Zombie();
      zombie.initialize(this.mazeGenerator, this.pathfinding);

      // Find a valid spawn position away from player
      let spawnPoint: Point | null = null;
      let attempts = 0;

      while (!spawnPoint && attempts < 100) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);

        const distFromStart = Math.abs(x - start.x) + Math.abs(y - start.y);

        if (distFromStart >= minDistanceFromStart) {
          spawnPoint = { x, y };
        }
        attempts++;
      }

      if (spawnPoint) {
        zombie.setPosition({
          x: spawnPoint.x * CELL_SIZE,
          y: 0,
          z: spawnPoint.y * CELL_SIZE,
        });

        this.zombies.push(zombie);
        this.createZombieMesh(zombie);
      }
    }

    console.log(`Spawned ${this.zombies.length} zombies for level ${level}`);
  }

  /**
   * Spawn sword for level
   */
  private spawnSword(level: number): void {
    if (!this.mazeGenerator) return;

    // Determine spawn chance based on level
    let spawnChance: number;
    if (level <= 3) spawnChance = SWORD_SPAWN_CHANCE.EASY;
    else if (level <= 6) spawnChance = SWORD_SPAWN_CHANCE.MEDIUM;
    else if (level <= 9) spawnChance = SWORD_SPAWN_CHANCE.HARD;
    else spawnChance = SWORD_SPAWN_CHANCE.ENDLESS;

    if (Math.random() > spawnChance) {
      return; // No sword this level
    }

    const { width, height } = this.mazeGenerator.getDimensions();
    const start = this.mazeGenerator.getStart();
    const exit = this.mazeGenerator.getExit();

    // Find a position for the sword (not at start or exit)
    let spawnPoint: Point | null = null;
    let attempts = 0;

    while (!spawnPoint && attempts < 100) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);

      if ((x !== start.x || y !== start.y) && (x !== exit.x || y !== exit.y)) {
        spawnPoint = { x, y };
      }
      attempts++;
    }

    if (spawnPoint) {
      this.sword = new Sword();
      this.sword.setPosition({
        x: spawnPoint.x * CELL_SIZE,
        y: 0,
        z: spawnPoint.y * CELL_SIZE,
      });
      this.createSwordMesh(this.sword);
      console.log('Sword spawned!');
    }
  }

  /**
   * Spawn power-ups for level
   */
  private spawnPowerUps(level: number): void {
    if (!this.mazeGenerator) return;

    const { width, height } = this.mazeGenerator.getDimensions();
    const start = this.mazeGenerator.getStart();
    const exit = this.mazeGenerator.getExit();

    // Number of power-ups scales with maze size
    const powerUpCount = Math.floor(2 + Math.random() * 4);

    const powerUpTypes = [
      PowerUpType.SPEED_BOOST,
      PowerUpType.SPRINT_REFILL,
      PowerUpType.INVISIBILITY,
      PowerUpType.SHIELD,
      PowerUpType.FREEZE,
    ];

    const usedPositions = new Set<string>();
    usedPositions.add(`${start.x},${start.y}`);
    usedPositions.add(`${exit.x},${exit.y}`);

    for (let i = 0; i < powerUpCount; i++) {
      // Pick random power-up type
      const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
      const powerUp = new PowerUp(type);

      // Find valid position
      let spawnPoint: Point | null = null;
      let attempts = 0;

      while (!spawnPoint && attempts < 100) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        const key = `${x},${y}`;

        if (!usedPositions.has(key)) {
          spawnPoint = { x, y };
          usedPositions.add(key);
        }
        attempts++;
      }

      if (spawnPoint) {
        powerUp.setPosition({
          x: spawnPoint.x * CELL_SIZE,
          y: 0,
          z: spawnPoint.y * CELL_SIZE,
        });

        this.powerUps.push(powerUp);
        this.createPowerUpMesh(powerUp);
      }
    }

    console.log(`Spawned ${this.powerUps.length} power-ups for level ${level}`);
  }

  /**
   * Clear all entities from the level
   */
  private clearEntities(): void {
    // Clear zombies
    this.zombies.forEach((zombie) => {
      const mesh = this.zombieMeshes.get(zombie.getId());
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    this.zombies = [];
    this.zombieMeshes.clear();

    // Clear sword
    if (this.swordMesh) {
      this.scene.remove(this.swordMesh);
      this.swordMesh.geometry.dispose();
      (this.swordMesh.material as THREE.Material).dispose();
      this.swordMesh = null;
    }
    this.sword = null;

    // Clear power-ups
    this.powerUps.forEach((powerUp) => {
      const mesh = this.powerUpMeshes.get(powerUp.getId());
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    this.powerUps = [];
    this.powerUpMeshes.clear();
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
    if (!this.mazeGenerator) return;

    // Get input
    const moveInput = this.inputManager.getMoveInput();
    const sprintInput = this.inputManager.isActionActive(InputAction.SPRINT);

    // Apply speed multiplier from power-ups
    const speedMultiplier = this.powerUpEffects.getSpeedMultiplier();

    // Update player
    this.player.update(
      deltaTime,
      {
        x: moveInput.x * speedMultiplier,
        y: moveInput.y * speedMultiplier,
      },
      sprintInput
    );

    // Handle player wall collisions
    const playerPos = this.player.getPosition();
    const collisionResult = this.collisionSystem.resolvePlayerWallCollision(
      playerPos.x,
      playerPos.z,
      this.player.getCollisionRadius()
    );
    if (collisionResult.collided) {
      this.player.setPosition({
        x: collisionResult.newX,
        y: playerPos.y,
        z: collisionResult.newZ,
      });
    }

    // Check for exit
    const exit = this.mazeGenerator.getExit();
    if (
      this.collisionSystem.checkPlayerAtExit(
        this.player.getPosition().x,
        this.player.getPosition().z,
        exit.x,
        exit.y
      )
    ) {
      this.gameState.transitionTo(GameStateType.LEVEL_COMPLETE);
      console.log(`Level ${this.currentLevel} complete!`);
      return;
    }

    // Update power-up effects
    this.powerUpEffects.update(deltaTime);

    // Check for sword collection
    if (this.sword && this.sword.isAvailable()) {
      this.sword.update(deltaTime);
      if (
        this.sword.checkCollection(this.player.getPosition(), this.player.getCollisionRadius())
      ) {
        this.sword.collect();
        this.player.pickupSword();
        console.log('Sword collected!');
        // Hide sword mesh
        if (this.swordMesh) {
          this.swordMesh.visible = false;
        }
      }
    }

    // Check for power-up collection
    this.powerUps.forEach((powerUp) => {
      if (powerUp.isAvailable()) {
        powerUp.update(deltaTime);
        if (
          powerUp.checkCollection(this.player.getPosition(), this.player.getCollisionRadius())
        ) {
          powerUp.collect();
          this.powerUpEffects.applyEffect(powerUp.getType());
          console.log(`Power-up collected: ${powerUp.getType()}`);
          // Hide power-up mesh
          const mesh = this.powerUpMeshes.get(powerUp.getId());
          if (mesh) {
            mesh.visible = false;
          }
        }
      }
    });

    // Update zombies
    const canDetectPlayer = !this.powerUpEffects.getIsInvisible();
    this.zombies.forEach((zombie) => {
      if (zombie.isAlive()) {
        zombie.update(deltaTime, this.player.getPosition(), canDetectPlayer);

        // Check for zombie-player collision
        if (
          zombie.checkCollisionWithRadius(
            this.player.getPosition(),
            this.player.getCollisionRadius()
          )
        ) {
          // Check if player has shield
          if (this.powerUpEffects.useShield()) {
            console.log('Shield protected player!');
            // Push zombie back slightly
            const zombiePos = zombie.getPosition();
            const playerPos = this.player.getPosition();
            const dx = zombiePos.x - playerPos.x;
            const dz = zombiePos.z - playerPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > 0) {
              zombie.setPosition({
                x: zombiePos.x + (dx / dist) * 2,
                y: zombiePos.y,
                z: zombiePos.z + (dz / dist) * 2,
              });
            }
          } else {
            // Player dies
            this.player.die();
            this.gameState.transitionTo(GameStateType.GAME_OVER);
            console.log('Game Over - Zombie caught the player!');
            return;
          }
        }
      }
    });

    // Update maze renderer animations
    this.mazeRenderer.update(deltaTime);

    // Update camera
    this.followCamera.update(deltaTime, this.player.getPosition());

    // Update entity meshes
    this.updateMeshes();
  }

  /**
   * Update 3D mesh positions and rotations
   */
  private updateMeshes(): void {
    // Update player mesh
    if (this.playerMesh) {
      const pos = this.player.getPosition();
      this.playerMesh.position.set(pos.x, 1, pos.z);
      this.playerMesh.rotation.y = this.player.getRotation();

      // Visual feedback for invisibility
      const material = this.playerMesh.material as THREE.MeshStandardMaterial;
      if (this.powerUpEffects.getIsInvisible()) {
        material.transparent = true;
        material.opacity = 0.4;
      } else {
        material.transparent = false;
        material.opacity = 1;
      }

      // Visual feedback for shield
      if (this.powerUpEffects.getHasShield()) {
        material.emissive = new THREE.Color(0x00ffff);
        material.emissiveIntensity = 0.3;
      } else {
        material.emissive = new THREE.Color(0x000000);
        material.emissiveIntensity = 0;
      }
    }

    // Update zombie meshes
    this.zombies.forEach((zombie) => {
      const mesh = this.zombieMeshes.get(zombie.getId());
      if (mesh) {
        if (!zombie.isAlive()) {
          mesh.visible = false;
          return;
        }

        const pos = zombie.getPosition();
        mesh.position.set(pos.x, 1, pos.z);
        mesh.rotation.y = zombie.getRotation();

        // Visual feedback for frozen state
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (zombie.isFrozen()) {
          material.color.setHex(0x88ccff); // Ice blue
          material.emissive.setHex(0x0044aa);
        } else if (zombie.getState() === ZombieState.CHASE) {
          material.color.setHex(0x660000); // Aggressive red tint
          material.emissive.setHex(0x440000);
        } else {
          material.color.setHex(0x556b2f); // Normal color
          material.emissive.setHex(0x220000);
        }
      }
    });

    // Update sword mesh
    if (this.swordMesh && this.sword && this.sword.isAvailable()) {
      const displayPos = this.sword.getDisplayPosition();
      this.swordMesh.position.set(displayPos.x, displayPos.y, displayPos.z);
      this.swordMesh.rotation.y = this.sword.getRotation();
    }

    // Update power-up meshes
    this.powerUps.forEach((powerUp) => {
      const mesh = this.powerUpMeshes.get(powerUp.getId());
      if (mesh && powerUp.isAvailable()) {
        const displayPos = powerUp.getDisplayPosition();
        mesh.position.set(displayPos.x, displayPos.y, displayPos.z);
        mesh.rotation.y = powerUp.getRotation();
        mesh.rotation.x = Math.sin(Date.now() * 0.002) * 0.3;
      }
    });
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

  /**
   * Get current level
   */
  getCurrentLevel(): number {
    return this.currentLevel;
  }
}
