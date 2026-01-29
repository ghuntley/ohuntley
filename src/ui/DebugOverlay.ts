/**
 * Debug Overlay for Meerkat Maze Runner
 * Displays debug information: FPS counter, collision visualization toggle,
 * pathfinding visualization toggle, and level seed display
 */

import * as THREE from 'three';
import { MazeGenerator, Point } from '../maze/MazeGenerator';
import { CELL_SIZE } from '../utils/Constants';

/** Debug data interface */
export interface DebugData {
  fps: number;
  frameTime: number;
  entityCount: number;
  zombieCount: number;
  seed: number;
  playerPosition: { x: number; y: number; z: number };
  playerGridPosition: Point;
  cameraPosition: { x: number; y: number; z: number };
}

/** Visualization options */
export interface DebugVisualizationOptions {
  showCollision: boolean;
  showPathfinding: boolean;
  showGrid: boolean;
}

/**
 * DebugOverlay class - manages debug information display and visualizations
 */
export class DebugOverlay {
  private container: HTMLDivElement | null = null;
  private isVisible: boolean = false;

  // Element references
  private fpsDisplay: HTMLDivElement | null = null;
  private frameTimeDisplay: HTMLDivElement | null = null;
  private entityCountDisplay: HTMLDivElement | null = null;
  private seedDisplay: HTMLDivElement | null = null;
  private positionDisplay: HTMLDivElement | null = null;
  private gridPosDisplay: HTMLDivElement | null = null;

  // Visualization options
  private visualizationOptions: DebugVisualizationOptions = {
    showCollision: false,
    showPathfinding: false,
    showGrid: false,
  };

  // FPS tracking
  private fpsHistory: number[] = [];
  private readonly FPS_HISTORY_SIZE = 60;

  // 3D visualization objects
  private scene: THREE.Scene | null = null;
  private collisionHelpers: THREE.Group | null = null;
  private pathfindingHelpers: THREE.Group | null = null;
  private gridHelper: THREE.GridHelper | null = null;

  constructor() {
    this.createStyles();
    this.createOverlay();
  }

  /**
   * Inject CSS styles into the document
   */
  private createStyles(): void {
    if (document.getElementById('meerkat-debug-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'meerkat-debug-styles';
    style.textContent = `
      /* Debug Overlay Container */
      #debug-overlay {
        position: fixed;
        top: 80px;
        left: 20px;
        background: rgba(0, 0, 0, 0.85);
        color: #00ff00;
        padding: 15px;
        border-radius: 8px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        z-index: 2000;
        min-width: 280px;
        border: 1px solid #00ff00;
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
      }

      #debug-overlay.hidden {
        display: none;
      }

      .debug-header {
        color: #ffff00;
        font-weight: bold;
        font-size: 14px;
        margin-bottom: 10px;
        padding-bottom: 5px;
        border-bottom: 1px solid #444;
      }

      .debug-section {
        margin-bottom: 12px;
      }

      .debug-section-title {
        color: #88ccff;
        font-size: 12px;
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      .debug-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
      }

      .debug-label {
        color: #888;
      }

      .debug-value {
        color: #00ff00;
        font-weight: bold;
      }

      .debug-value.warning {
        color: #ffaa00;
      }

      .debug-value.critical {
        color: #ff4444;
      }

      .debug-value.good {
        color: #44ff44;
      }

      .debug-controls {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #444;
      }

      .debug-toggle {
        display: flex;
        align-items: center;
        margin: 5px 0;
        cursor: pointer;
        user-select: none;
      }

      .debug-toggle:hover {
        color: #00ffaa;
      }

      .debug-checkbox {
        width: 16px;
        height: 16px;
        border: 1px solid #00ff00;
        margin-right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }

      .debug-checkbox.checked {
        background: #00ff00;
        color: #000;
      }

      .debug-hint {
        color: #666;
        font-size: 11px;
        margin-top: 10px;
        font-style: italic;
      }

      .debug-fps-bar {
        width: 100%;
        height: 4px;
        background: #333;
        margin-top: 4px;
        border-radius: 2px;
        overflow: hidden;
      }

      .debug-fps-fill {
        height: 100%;
        transition: width 0.1s ease;
        border-radius: 2px;
      }

      .debug-fps-fill.good {
        background: linear-gradient(90deg, #00aa00, #00ff00);
      }

      .debug-fps-fill.warning {
        background: linear-gradient(90deg, #aa8800, #ffaa00);
      }

      .debug-fps-fill.critical {
        background: linear-gradient(90deg, #aa0000, #ff4444);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create the debug overlay DOM structure
   */
  private createOverlay(): void {
    const existingOverlay = document.getElementById('debug-overlay');
    if (existingOverlay) {
      this.container = existingOverlay as HTMLDivElement;
      this.cacheElements();
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'debug-overlay';
    this.container.className = 'hidden';

    // Header
    const header = document.createElement('div');
    header.className = 'debug-header';
    header.textContent = '🛠️ DEBUG MODE';
    this.container.appendChild(header);

    // Performance section
    const perfSection = this.createSection('Performance');

    // FPS
    const fpsRow = this.createRow('FPS', '0');
    this.fpsDisplay = fpsRow.querySelector('.debug-value') as HTMLDivElement;
    perfSection.appendChild(fpsRow);

    // FPS bar
    const fpsBarContainer = document.createElement('div');
    fpsBarContainer.className = 'debug-fps-bar';
    const fpsBar = document.createElement('div');
    fpsBar.className = 'debug-fps-fill good';
    fpsBar.id = 'debug-fps-bar';
    fpsBar.style.width = '100%';
    fpsBarContainer.appendChild(fpsBar);
    perfSection.appendChild(fpsBarContainer);

    // Frame time
    const frameTimeRow = this.createRow('Frame Time', '0.0ms');
    this.frameTimeDisplay = frameTimeRow.querySelector('.debug-value') as HTMLDivElement;
    perfSection.appendChild(frameTimeRow);

    // Entity count
    const entityRow = this.createRow('Entities', '0');
    this.entityCountDisplay = entityRow.querySelector('.debug-value') as HTMLDivElement;
    perfSection.appendChild(entityRow);

    this.container.appendChild(perfSection);

    // Level section
    const levelSection = this.createSection('Level');

    // Seed
    const seedRow = this.createRow('Seed', '0');
    this.seedDisplay = seedRow.querySelector('.debug-value') as HTMLDivElement;
    levelSection.appendChild(seedRow);

    this.container.appendChild(levelSection);

    // Position section
    const posSection = this.createSection('Position');

    // World position
    const posRow = this.createRow('World', '(0, 0, 0)');
    this.positionDisplay = posRow.querySelector('.debug-value') as HTMLDivElement;
    posSection.appendChild(posRow);

    // Grid position
    const gridRow = this.createRow('Grid', '(0, 0)');
    this.gridPosDisplay = gridRow.querySelector('.debug-value') as HTMLDivElement;
    posSection.appendChild(gridRow);

    this.container.appendChild(posSection);

    // Visualization controls
    const controlsSection = document.createElement('div');
    controlsSection.className = 'debug-controls';

    const controlsTitle = document.createElement('div');
    controlsTitle.className = 'debug-section-title';
    controlsTitle.textContent = 'Visualizations';
    controlsSection.appendChild(controlsTitle);

    // Collision toggle
    const collisionToggle = this.createToggle('Show Collision', 'collision', () => {
      this.visualizationOptions.showCollision = !this.visualizationOptions.showCollision;
      this.updateVisualization();
    });
    controlsSection.appendChild(collisionToggle);

    // Pathfinding toggle
    const pathToggle = this.createToggle('Show Pathfinding', 'pathfinding', () => {
      this.visualizationOptions.showPathfinding = !this.visualizationOptions.showPathfinding;
      this.updateVisualization();
    });
    controlsSection.appendChild(pathToggle);

    // Grid toggle
    const gridToggle = this.createToggle('Show Grid', 'grid', () => {
      this.visualizationOptions.showGrid = !this.visualizationOptions.showGrid;
      this.updateVisualization();
    });
    controlsSection.appendChild(gridToggle);

    this.container.appendChild(controlsSection);

    // Hint
    const hint = document.createElement('div');
    hint.className = 'debug-hint';
    hint.textContent = 'Press ` (backtick) to toggle debug mode';
    this.container.appendChild(hint);

    document.body.appendChild(this.container);
  }

  /**
   * Create a section with title
   */
  private createSection(title: string): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'debug-section';

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'debug-section-title';
    sectionTitle.textContent = title;
    section.appendChild(sectionTitle);

    return section;
  }

  /**
   * Create a labeled row
   */
  private createRow(label: string, value: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'debug-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'debug-label';
    labelEl.textContent = label + ':';
    row.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.className = 'debug-value';
    valueEl.textContent = value;
    row.appendChild(valueEl);

    return row;
  }

  /**
   * Create a toggle control
   */
  private createToggle(label: string, id: string, onClick: () => void): HTMLDivElement {
    const toggle = document.createElement('div');
    toggle.className = 'debug-toggle';
    toggle.id = `debug-toggle-${id}`;

    const checkbox = document.createElement('div');
    checkbox.className = 'debug-checkbox';
    checkbox.id = `debug-checkbox-${id}`;
    toggle.appendChild(checkbox);

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    toggle.appendChild(labelEl);

    toggle.addEventListener('click', () => {
      checkbox.classList.toggle('checked');
      checkbox.textContent = checkbox.classList.contains('checked') ? '✓' : '';
      onClick();
    });

    return toggle;
  }

  /**
   * Cache element references
   */
  private cacheElements(): void {
    if (!this.container) return;
    // Elements would be cached here if reusing existing overlay
  }

  /**
   * Set the scene for 3D visualizations
   */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;

    // Create visualization groups
    this.collisionHelpers = new THREE.Group();
    this.collisionHelpers.name = 'debug-collision';
    this.collisionHelpers.visible = false;
    scene.add(this.collisionHelpers);

    this.pathfindingHelpers = new THREE.Group();
    this.pathfindingHelpers.name = 'debug-pathfinding';
    this.pathfindingHelpers.visible = false;
    scene.add(this.pathfindingHelpers);
  }

  /**
   * Update collision visualization
   */
  updateCollisionVisualization(
    playerPos: { x: number; y: number; z: number },
    playerRadius: number,
    zombiePositions: Array<{ x: number; y: number; z: number; radius: number }>
  ): void {
    if (!this.collisionHelpers || !this.visualizationOptions.showCollision) return;

    // Clear existing helpers
    while (this.collisionHelpers.children.length > 0) {
      const child = this.collisionHelpers.children[0];
      this.collisionHelpers.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    // Player collision circle
    const playerCircle = new THREE.Mesh(
      new THREE.RingGeometry(playerRadius - 0.02, playerRadius + 0.02, 32),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    );
    playerCircle.position.set(playerPos.x, 0.1, playerPos.z);
    playerCircle.rotation.x = -Math.PI / 2;
    this.collisionHelpers.add(playerCircle);

    // Zombie collision circles
    zombiePositions.forEach(zombie => {
      const zombieCircle = new THREE.Mesh(
        new THREE.RingGeometry(zombie.radius - 0.02, zombie.radius + 0.02, 32),
        new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
      );
      zombieCircle.position.set(zombie.x, 0.1, zombie.z);
      zombieCircle.rotation.x = -Math.PI / 2;
      if (this.collisionHelpers) {
        this.collisionHelpers.add(zombieCircle);
      }
    });
  }

  /**
   * Update pathfinding visualization
   */
  updatePathfindingVisualization(
    paths: Array<{ points: Array<{ x: number; y: number }>; color: number }>
  ): void {
    if (!this.pathfindingHelpers || !this.visualizationOptions.showPathfinding) return;

    // Clear existing helpers
    while (this.pathfindingHelpers.children.length > 0) {
      const child = this.pathfindingHelpers.children[0];
      this.pathfindingHelpers.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    // Draw each path
    paths.forEach(path => {
      if (path.points.length < 2) return;

      const points = path.points.map(p =>
        new THREE.Vector3(p.x * CELL_SIZE, 0.2, p.y * CELL_SIZE)
      );

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: path.color,
        linewidth: 2
      });
      const line = new THREE.Line(geometry, material);
      if (this.pathfindingHelpers) {
        this.pathfindingHelpers.add(line);
      }

      // Add spheres at each waypoint
      path.points.forEach(p => {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 8, 8),
          new THREE.MeshBasicMaterial({ color: path.color })
        );
        sphere.position.set(p.x * CELL_SIZE, 0.2, p.y * CELL_SIZE);
        if (this.pathfindingHelpers) {
          this.pathfindingHelpers.add(sphere);
        }
      });
    });
  }

  /**
   * Set up grid visualization
   */
  setupGrid(mazeGenerator: MazeGenerator): void {
    if (!this.scene) return;

    // Remove existing grid
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper = null;
    }

    const { width, height } = mazeGenerator.getDimensions();
    const gridSize = Math.max(width, height) * CELL_SIZE;

    this.gridHelper = new THREE.GridHelper(
      gridSize,
      Math.max(width, height),
      0x444444,
      0x222222
    );
    this.gridHelper.position.set(
      (width * CELL_SIZE) / 2 - CELL_SIZE / 2,
      0.05,
      (height * CELL_SIZE) / 2 - CELL_SIZE / 2
    );
    this.gridHelper.visible = this.visualizationOptions.showGrid && this.isVisible;
    this.scene.add(this.gridHelper);
  }

  /**
   * Update visualization visibility
   */
  private updateVisualization(): void {
    if (this.collisionHelpers) {
      this.collisionHelpers.visible = this.visualizationOptions.showCollision && this.isVisible;
    }
    if (this.pathfindingHelpers) {
      this.pathfindingHelpers.visible = this.visualizationOptions.showPathfinding && this.isVisible;
    }
    if (this.gridHelper) {
      this.gridHelper.visible = this.visualizationOptions.showGrid && this.isVisible;
    }
  }

  /**
   * Update the debug overlay with current data
   */
  update(data: DebugData): void {
    if (!this.isVisible) return;

    // Track FPS history for smoothing
    this.fpsHistory.push(data.fps);
    if (this.fpsHistory.length > this.FPS_HISTORY_SIZE) {
      this.fpsHistory.shift();
    }

    // Calculate average FPS
    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    // Update FPS display
    if (this.fpsDisplay) {
      this.fpsDisplay.textContent = Math.round(avgFps).toString();
      this.fpsDisplay.className = 'debug-value';
      if (avgFps >= 55) {
        this.fpsDisplay.classList.add('good');
      } else if (avgFps >= 30) {
        this.fpsDisplay.classList.add('warning');
      } else {
        this.fpsDisplay.classList.add('critical');
      }
    }

    // Update FPS bar
    const fpsBar = document.getElementById('debug-fps-bar');
    if (fpsBar) {
      const fpsPercent = Math.min(100, (avgFps / 60) * 100);
      fpsBar.style.width = `${fpsPercent}%`;
      fpsBar.className = 'debug-fps-fill';
      if (avgFps >= 55) {
        fpsBar.classList.add('good');
      } else if (avgFps >= 30) {
        fpsBar.classList.add('warning');
      } else {
        fpsBar.classList.add('critical');
      }
    }

    // Update frame time
    if (this.frameTimeDisplay) {
      this.frameTimeDisplay.textContent = `${data.frameTime.toFixed(1)}ms`;
      this.frameTimeDisplay.className = 'debug-value';
      if (data.frameTime <= 16.67) {
        this.frameTimeDisplay.classList.add('good');
      } else if (data.frameTime <= 33.33) {
        this.frameTimeDisplay.classList.add('warning');
      } else {
        this.frameTimeDisplay.classList.add('critical');
      }
    }

    // Update entity count
    if (this.entityCountDisplay) {
      this.entityCountDisplay.textContent = `${data.entityCount} (${data.zombieCount} zombies)`;
    }

    // Update seed
    if (this.seedDisplay) {
      this.seedDisplay.textContent = data.seed.toString();
    }

    // Update position
    if (this.positionDisplay) {
      this.positionDisplay.textContent =
        `(${data.playerPosition.x.toFixed(1)}, ${data.playerPosition.y.toFixed(1)}, ${data.playerPosition.z.toFixed(1)})`;
    }

    // Update grid position
    if (this.gridPosDisplay) {
      this.gridPosDisplay.textContent =
        `(${data.playerGridPosition.x}, ${data.playerGridPosition.y})`;
    }
  }

  /**
   * Show the debug overlay
   */
  show(): void {
    if (!this.container) {
      this.createOverlay();
    }

    if (this.container) {
      this.container.classList.remove('hidden');
      this.isVisible = true;
      this.updateVisualization();
    }
  }

  /**
   * Hide the debug overlay
   */
  hide(): void {
    if (this.container) {
      this.container.classList.add('hidden');
      this.isVisible = false;
      this.updateVisualization();
    }
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if overlay is visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Get visualization options
   */
  getVisualizationOptions(): DebugVisualizationOptions {
    return { ...this.visualizationOptions };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Remove 3D helpers
    if (this.scene) {
      if (this.collisionHelpers) {
        this.scene.remove(this.collisionHelpers);
      }
      if (this.pathfindingHelpers) {
        this.scene.remove(this.pathfindingHelpers);
      }
      if (this.gridHelper) {
        this.scene.remove(this.gridHelper);
      }
    }

    // Remove DOM elements
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    const styles = document.getElementById('meerkat-debug-styles');
    if (styles && styles.parentNode) {
      styles.parentNode.removeChild(styles);
    }

    this.container = null;
    this.fpsDisplay = null;
    this.frameTimeDisplay = null;
    this.entityCountDisplay = null;
    this.seedDisplay = null;
    this.positionDisplay = null;
    this.gridPosDisplay = null;
    this.isVisible = false;
  }
}
