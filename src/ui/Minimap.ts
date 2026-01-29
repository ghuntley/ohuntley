/**
 * Minimap for Meerkat Maze Runner
 * Displays a top-down view of the maze showing player, zombies, exit, and power-ups
 */

import { MazeGenerator, MazeCell, Point, Direction } from '../maze/MazeGenerator';
import { CELL_SIZE } from '../utils/Constants';

/** Minimap data interface */
export interface MinimapData {
  playerPosition: { x: number; y: number; z: number };
  playerRotation: number;
  zombiePositions: Array<{ x: number; y: number; z: number; isChasing: boolean }>;
  powerUpPositions: Array<{ x: number; y: number; z: number; type: string }>;
  swordPosition?: { x: number; y: number; z: number };
}

/** Minimap configuration */
export interface MinimapConfig {
  size: number;
  cellSize: number;
  showZombies: boolean;
  showPowerUps: boolean;
  showExit: boolean;
  fogOfWar: boolean;
}

const DEFAULT_CONFIG: MinimapConfig = {
  size: 180,
  cellSize: 8,
  showZombies: true,
  showPowerUps: true,
  showExit: true,
  fogOfWar: true,
};

/**
 * Minimap class - renders a top-down view of the maze
 */
export class Minimap {
  private container: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isVisible: boolean = false;
  private config: MinimapConfig;

  private mazeGenerator: MazeGenerator | null = null;
  private exploredCells: Set<string> = new Set();

  // Colors
  private readonly COLORS = {
    background: '#1a1a2e',
    wall: '#16213e',
    floor: '#0f3460',
    explored: '#1a1a4a',
    unexplored: '#0a0a1a',
    player: '#00ff88',
    playerDirection: '#00ff88',
    zombie: '#ff4444',
    zombieChasing: '#ff0000',
    exit: '#ffd700',
    powerUp: '#00ffff',
    sword: '#c0c0c0',
    start: '#44ff44',
    border: '#00ff88',
  };

  constructor(config: Partial<MinimapConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.createStyles();
    this.createMinimap();
  }

  /**
   * Inject CSS styles
   */
  private createStyles(): void {
    if (document.getElementById('meerkat-minimap-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'meerkat-minimap-styles';
    style.textContent = `
      #game-minimap {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 1000;
        pointer-events: none;
      }

      #game-minimap.hidden {
        display: none;
      }

      .minimap-container {
        position: relative;
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid #00ff88;
        border-radius: 8px;
        padding: 4px;
        box-shadow:
          0 0 10px rgba(0, 255, 136, 0.3),
          inset 0 0 20px rgba(0, 0, 0, 0.5);
      }

      .minimap-canvas {
        border-radius: 4px;
        image-rendering: pixelated;
      }

      .minimap-legend {
        position: absolute;
        bottom: -25px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        gap: 12px;
        font-family: 'Courier New', monospace;
        font-size: 10px;
        color: #888;
      }

      .minimap-legend-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .minimap-legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .minimap-toggle {
        position: absolute;
        top: -20px;
        right: 0;
        font-family: 'Courier New', monospace;
        font-size: 10px;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create the minimap DOM structure
   */
  private createMinimap(): void {
    const existing = document.getElementById('game-minimap');
    if (existing) {
      this.container = existing as HTMLDivElement;
      this.canvas = this.container.querySelector('.minimap-canvas') as HTMLCanvasElement;
      this.ctx = this.canvas?.getContext('2d') || null;
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'game-minimap';
    this.container.className = 'hidden';

    const wrapper = document.createElement('div');
    wrapper.className = 'minimap-container';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap-canvas';
    this.canvas.width = this.config.size;
    this.canvas.height = this.config.size;
    wrapper.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    // Toggle hint
    const toggle = document.createElement('div');
    toggle.className = 'minimap-toggle';
    toggle.textContent = 'Press M to toggle';
    wrapper.appendChild(toggle);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'minimap-legend';
    legend.innerHTML = `
      <div class="minimap-legend-item">
        <div class="minimap-legend-dot" style="background: ${this.COLORS.player}"></div>
        <span>You</span>
      </div>
      <div class="minimap-legend-item">
        <div class="minimap-legend-dot" style="background: ${this.COLORS.zombie}"></div>
        <span>Enemy</span>
      </div>
      <div class="minimap-legend-item">
        <div class="minimap-legend-dot" style="background: ${this.COLORS.exit}"></div>
        <span>Exit</span>
      </div>
    `;
    wrapper.appendChild(legend);

    this.container.appendChild(wrapper);
    document.body.appendChild(this.container);
  }

  /**
   * Set the maze generator for rendering
   */
  setMaze(mazeGenerator: MazeGenerator): void {
    this.mazeGenerator = mazeGenerator;
    this.exploredCells.clear();

    // Resize canvas based on maze size
    const { width, height } = mazeGenerator.getDimensions();
    const maxDimension = Math.max(width, height);
    this.config.cellSize = Math.floor(this.config.size / maxDimension);

    // Add starting area to explored cells
    const start = mazeGenerator.getStart();
    this.markExplored(start.x, start.y, 2);
  }

  /**
   * Mark cells as explored within a radius
   */
  private markExplored(cx: number, cy: number, radius: number): void {
    if (!this.mazeGenerator) return;

    const { width, height } = this.mazeGenerator.getDimensions();

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        const y = cy + dy;

        if (x >= 0 && x < width && y >= 0 && y < height) {
          this.exploredCells.add(`${x},${y}`);
        }
      }
    }
  }

  /**
   * Convert world position to grid position
   */
  private worldToGrid(x: number, z: number): Point {
    return {
      x: Math.floor(x / CELL_SIZE),
      y: Math.floor(z / CELL_SIZE),
    };
  }

  /**
   * Convert grid position to canvas position
   */
  private gridToCanvas(gx: number, gy: number): { x: number; y: number } {
    if (!this.mazeGenerator) return { x: 0, y: 0 };

    const { width, height } = this.mazeGenerator.getDimensions();
    const offsetX = (this.config.size - width * this.config.cellSize) / 2;
    const offsetY = (this.config.size - height * this.config.cellSize) / 2;

    return {
      x: offsetX + gx * this.config.cellSize + this.config.cellSize / 2,
      y: offsetY + gy * this.config.cellSize + this.config.cellSize / 2,
    };
  }

  /**
   * Draw a cell on the canvas
   */
  private drawCell(gx: number, gy: number, cell: MazeCell, isExplored: boolean): void {
    if (!this.ctx || !this.mazeGenerator) return;

    const { width, height } = this.mazeGenerator.getDimensions();
    const offsetX = (this.config.size - width * this.config.cellSize) / 2;
    const offsetY = (this.config.size - height * this.config.cellSize) / 2;

    const x = offsetX + gx * this.config.cellSize;
    const y = offsetY + gy * this.config.cellSize;
    const size = this.config.cellSize;

    // Background based on exploration
    if (this.config.fogOfWar && !isExplored) {
      this.ctx.fillStyle = this.COLORS.unexplored;
      this.ctx.fillRect(x, y, size, size);
      return;
    }

    // Floor
    this.ctx.fillStyle = this.COLORS.floor;
    this.ctx.fillRect(x, y, size, size);

    // Walls
    this.ctx.fillStyle = this.COLORS.wall;
    const wallThickness = Math.max(1, size * 0.15);

    if (cell.walls[Direction.NORTH]) {
      this.ctx.fillRect(x, y, size, wallThickness);
    }
    if (cell.walls[Direction.SOUTH]) {
      this.ctx.fillRect(x, y + size - wallThickness, size, wallThickness);
    }
    if (cell.walls[Direction.WEST]) {
      this.ctx.fillRect(x, y, wallThickness, size);
    }
    if (cell.walls[Direction.EAST]) {
      this.ctx.fillRect(x + size - wallThickness, y, wallThickness, size);
    }
  }

  /**
   * Draw an entity marker
   */
  private drawMarker(
    x: number,
    y: number,
    color: string,
    size: number,
    shape: 'circle' | 'triangle' | 'diamond' | 'star' = 'circle',
    rotation: number = 0
  ): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(rotation);

    this.ctx.fillStyle = color;
    this.ctx.beginPath();

    switch (shape) {
      case 'triangle':
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(-size * 0.7, size * 0.5);
        this.ctx.lineTo(size * 0.7, size * 0.5);
        break;

      case 'diamond':
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(size, 0);
        this.ctx.lineTo(0, size);
        this.ctx.lineTo(-size, 0);
        break;

      case 'star':
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const px = Math.cos(angle) * size;
          const py = Math.sin(angle) * size;
          if (i === 0) {
            this.ctx.moveTo(px, py);
          } else {
            this.ctx.lineTo(px, py);
          }
        }
        break;

      case 'circle':
      default:
        this.ctx.arc(0, 0, size, 0, Math.PI * 2);
        break;
    }

    this.ctx.closePath();
    this.ctx.fill();

    // Add glow effect
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = size;
    this.ctx.fill();

    this.ctx.restore();
  }

  /**
   * Update the minimap with current game state
   */
  update(data: MinimapData): void {
    if (!this.isVisible || !this.ctx || !this.mazeGenerator || !this.canvas) return;

    const maze = this.mazeGenerator.getGrid();
    const { width, height } = this.mazeGenerator.getDimensions();

    // Update explored cells based on player position
    const playerGrid = this.worldToGrid(data.playerPosition.x, data.playerPosition.z);
    this.markExplored(playerGrid.x, playerGrid.y, 3);

    // Clear canvas
    this.ctx.fillStyle = this.COLORS.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw maze cells
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isExplored = this.exploredCells.has(`${x},${y}`);
        this.drawCell(x, y, maze[y][x], isExplored);
      }
    }

    // Draw start position
    const start = this.mazeGenerator.getStart();
    const startPos = this.gridToCanvas(start.x, start.y);
    this.drawMarker(startPos.x, startPos.y, this.COLORS.start, 3, 'circle');

    // Draw exit (always visible as a goal)
    if (this.config.showExit) {
      const exit = this.mazeGenerator.getExit();
      const exitPos = this.gridToCanvas(exit.x, exit.y);
      this.drawMarker(exitPos.x, exitPos.y, this.COLORS.exit, 5, 'star');
    }

    // Draw power-ups (only if explored)
    if (this.config.showPowerUps) {
      data.powerUpPositions.forEach(powerUp => {
        const grid = this.worldToGrid(powerUp.x, powerUp.z);
        if (!this.config.fogOfWar || this.exploredCells.has(`${grid.x},${grid.y}`)) {
          const pos = this.gridToCanvas(grid.x, grid.y);
          this.drawMarker(pos.x, pos.y, this.COLORS.powerUp, 3, 'diamond');
        }
      });
    }

    // Draw sword (only if explored)
    if (data.swordPosition) {
      const swordGrid = this.worldToGrid(data.swordPosition.x, data.swordPosition.z);
      if (!this.config.fogOfWar || this.exploredCells.has(`${swordGrid.x},${swordGrid.y}`)) {
        const pos = this.gridToCanvas(swordGrid.x, swordGrid.y);
        this.drawMarker(pos.x, pos.y, this.COLORS.sword, 3, 'diamond');
      }
    }

    // Draw zombies (only if in explored area or nearby)
    if (this.config.showZombies) {
      data.zombiePositions.forEach(zombie => {
        const grid = this.worldToGrid(zombie.x, zombie.z);
        const isNearPlayer =
          Math.abs(grid.x - playerGrid.x) <= 4 && Math.abs(grid.y - playerGrid.y) <= 4;

        if (!this.config.fogOfWar || this.exploredCells.has(`${grid.x},${grid.y}`) || isNearPlayer) {
          const pos = this.gridToCanvas(grid.x, grid.y);
          const color = zombie.isChasing ? this.COLORS.zombieChasing : this.COLORS.zombie;
          this.drawMarker(pos.x, pos.y, color, 3, 'circle');
        }
      });
    }

    // Draw player (always on top)
    const playerPos = this.gridToCanvas(playerGrid.x, playerGrid.y);
    // Player direction indicator (triangle pointing in facing direction)
    this.drawMarker(
      playerPos.x,
      playerPos.y,
      this.COLORS.player,
      5,
      'triangle',
      data.playerRotation + Math.PI / 2
    );
  }

  /**
   * Show the minimap
   */
  show(): void {
    if (!this.container) {
      this.createMinimap();
    }

    if (this.container) {
      this.container.classList.remove('hidden');
      this.isVisible = true;
    }
  }

  /**
   * Hide the minimap
   */
  hide(): void {
    if (this.container) {
      this.container.classList.add('hidden');
      this.isVisible = false;
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
   * Check if minimap is visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Reset explored cells
   */
  reset(): void {
    this.exploredCells.clear();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    const styles = document.getElementById('meerkat-minimap-styles');
    if (styles && styles.parentNode) {
      styles.parentNode.removeChild(styles);
    }

    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.isVisible = false;
    this.exploredCells.clear();
  }
}
