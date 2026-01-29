# Meerkat Maze Runner - Implementation Plan

## Project Status

### Phase 1: Project Setup & Core Infrastructure ✅
- [x] Initialize npm project with TypeScript and Vite
- [x] Set up Three.js
- [x] Create main entry point with WebGL renderer
- [x] Implement Game class with game loop
- [x] Implement GameState management (state machine with transitions)
- [x] Create Constants file with game configuration
- [x] Set up basic scene with lighting and placeholder content
- [x] Configure test environment with Vitest

### Phase 2: Core Gameplay Systems ✅
- [x] Maze Generator (recursive backtracking algorithm)
- [x] Input Manager (keyboard and touch controls)
- [x] Player Entity (movement, sprint, collision)
- [x] Maze Renderer (3D hedge walls from generated maze)
- [x] Collision System (player-wall, player-zombie)
- [x] Camera Follow System (third-person follow camera)

### Phase 3: Enemies & Combat ✅
- [x] Zombie Entity (patrol and chase states)
- [x] Pathfinding System (A* for zombie navigation)
- [x] Combat System (sword attacks)
- [x] Power-ups (speed boost, shield, etc.)

### Phase 4: UI & Polish ✅
- [x] HUD (timer, sprint gauge, level indicator)
- [x] Main Menu
- [x] Pause Menu
- [x] Game Over / Victory screens
- [x] Leaderboard with LocalStorage persistence

### Phase 5: Audio & Effects
- [ ] Audio Manager
- [ ] Background music
- [ ] Sound effects
- [ ] Particle effects

### Phase 6: Mobile & Polish
- [ ] Touch controls (virtual joystick)
- [ ] Mobile optimizations
- [ ] Performance tuning
- [ ] Bug fixes and balancing

## Current Implementation Notes

### Maze Generator
- Uses recursive backtracking algorithm
- Supports seeded random generation for reproducibility
- Generates valid, solvable mazes with start and exit points
- Grid-based with configurable size

### Input Manager
- Keyboard support (WASD/Arrow keys for movement, Shift for sprint)
- Touch support planned for mobile
- Action buttons for attack and use power-ups
- Singleton pattern for global access

### Player Entity
- Movement with walking and sprinting
- Sprint gauge with regeneration
- 8-directional movement
- Basic collision bounds

### Maze Renderer
- Converts MazeCell[][] to 3D Three.js geometry
- Uses instanced mesh for walls (performance optimization)
- Creates floor, start marker, and exit marker
- Exit marker has animated glow effect
- Grid-to-world and world-to-grid coordinate conversion

### Collision System
- Grid-based wall collision detection
- Circle vs AABB collision with sliding resolution
- Optimized nearby wall lookup using cell coordinates
- Support for player-exit detection
- Circle-circle collision for future zombie/powerup detection

### Follow Camera
- Third-person fixed-angle camera
- Smooth lerp-based following
- Configurable distance, height, angle, and follow speed
- Snap-to-target for instant positioning
- Frustum-based visibility checks

### A* Pathfinding System
- Grid-based A* implementation for maze navigation
- Uses MazeGenerator's accessible neighbors
- Efficient path recalculation for moving targets
- Support for path length queries and next-step retrieval

### Zombie Entity
- State machine: PATROL, CHASE, RETURNING, FROZEN, DEAD
- Detection radius with line-of-sight approximation
- Uses pathfinding for navigation
- Periodic path recalculation during chase
- Freeze effect support for power-ups

### Combat System
- Arc-based melee attack detection
- Configurable sword range and attack arc (90°)
- Attack cooldown management
- Multi-zombie hit support in single swing

### Sword Pickup
- Collectible item with bobbing animation
- Enables player combat when collected
- Random spawn position (not at start/exit)
- Level-based spawn probability

### Power-up System
- Five power-up types: Speed Boost, Sprint Refill, Invisibility, Shield, Freeze
- Timed effects with duration tracking
- Visual feedback (player transparency, zombie color changes)
- Callback system for game-wide effects (freeze all zombies)

### UI System
- **HUD**: Timer with warning states (yellow/red), sprint gauge, level indicator, sword/shield indicators, active power-ups display
- **Main Menu**: Title screen with Play, Continue, Leaderboard, How to Play buttons
- **Pause Menu**: Resume, Restart Level, Quit to Menu buttons
- **Game Over Screen**: Stats display (level, time, kills), high score entry
- **Level Complete Screen**: Stats, star rating, confetti celebration
- **Leaderboard**: Top 10 scores with LocalStorage persistence, score calculation: (Level × 1000) + Survival Time
- **UIManager**: Coordinates all UI components with game state transitions
