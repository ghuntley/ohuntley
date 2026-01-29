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

### Phase 2: Core Gameplay Systems (In Progress)
- [x] Maze Generator (recursive backtracking algorithm)
- [x] Input Manager (keyboard and touch controls)
- [x] Player Entity (movement, sprint, collision)
- [ ] Maze Renderer (3D hedge walls from generated maze)
- [ ] Collision System (player-wall, player-zombie)
- [ ] Camera Follow System (third-person follow camera)

### Phase 3: Enemies & Combat
- [ ] Zombie Entity (patrol and chase states)
- [ ] Pathfinding System (A* for zombie navigation)
- [ ] Combat System (sword attacks)
- [ ] Power-ups (speed boost, shield, etc.)

### Phase 4: UI & Polish
- [ ] HUD (timer, sprint gauge, level indicator)
- [ ] Main Menu
- [ ] Pause Menu
- [ ] Game Over / Victory screens
- [ ] Leaderboard with LocalStorage persistence

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
