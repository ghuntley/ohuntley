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

### Phase 5: Audio & Effects ✅
- [x] Audio Manager (Web Audio API with synthetic sounds)
- [x] Background music (safe/danger themes with crossfade)
- [x] Sound effects (footsteps, attacks, pickups, zombie sounds)
- [x] Particle effects (sword trail, zombie hit, power-up collect, shield break)

### Phase 6: Mobile & Polish ✅
- [x] Touch controls (virtual joystick, action buttons)
- [x] Mobile optimizations (PerformanceManager with auto-tier detection)
- [x] Performance tuning (shadow quality, fog distance, particle scaling)
- [x] Bug fixes and balancing

### Bonus: Spectator Meerkats ✅
- [x] SpectatorMeerkat entity (head tracking, idle animation)
- [x] SpectatorMeerkatManager (spawning on hedge tops)
- [x] Danger alert behavior (agitated movement when zombies near)

### Phase 7: Debug Tools & Minimap ✅
- [x] DebugOverlay component (FPS counter, frame time, entity count)
- [x] Level seed display for reproducible testing
- [x] Player position display (world and grid coordinates)
- [x] Collision visualization toggle (player and zombie collision circles)
- [x] Pathfinding visualization toggle (zombie paths)
- [x] Grid overlay toggle
- [x] Minimap component with fog of war
- [x] Minimap shows player, zombies, exit, power-ups, sword
- [x] Keyboard shortcuts: backtick (`) for debug mode, M for minimap

### Phase 8: Visibility Systems ✅
- [x] 3D Fog of War system (limited visibility radius in 3D view)
- [x] True line-of-sight for zombie detection (raycasting through maze grid)
- [x] FogOfWarSystem class with configurable visibility radius and fade
- [x] LineOfSight class with grid-based raycasting using DDA algorithm
- [x] Visibility radius matches spec (3-4 cells = 12-16 world units)
- [x] Dark fog color for dramatic effect at visibility edges
- [x] Zombie detection now blocked by maze walls (true LOS)

### Phase 9: Polish & Spec Compliance ✅
- [x] Sprint refill power-up now fully functional (was placeholder)
- [x] Mobile control customization (joystick position left/right, button size small/medium/large)
- [x] Touch control settings persist to localStorage
- [x] Camera wall collision avoidance (raycasting to prevent clipping through hedges)
- [x] Smooth camera transition when obstruction clears

### Phase 10: Enhanced Visuals & Mobile UX ✅
- [x] HapticManager for mobile vibration feedback (attack, hit, collect, death, level complete)
- [x] Improved MeerkatModel using Three.js primitives (detailed body, head, ears, tail, arms, legs)
- [x] ZombieModel with glowing eyes (red emissive eyes with point lights visible in fog)
- [x] Zombie visual state system (normal, chasing, frozen) with distinct appearances
- [x] Player and zombie models positioned correctly at ground level

### Phase 11: Animation System & UI Polish ✅
- [x] AnimationSystem for procedural entity animations (keyframe interpolation, easing, blending)
- [x] Player procedural animations (idle, walk, run, attack, death, victory)
- [x] MeerkatModel refactored with animatable limb groups
- [x] Zombie death animation (dissolve effect with scale/fade/spin)
- [x] ZombieModel refactored with bodyGroup for animation support
- [x] Attack cooldown UI indicator (visual overlay on sword icon)
- [x] Level complete stats already functional (zombies killed, power-ups collected)

## Current Implementation Notes

### Maze Generator
- Uses recursive backtracking algorithm
- Supports seeded random generation for reproducibility
- Generates valid, solvable mazes with start and exit points
- Grid-based with configurable size

### Input Manager
- Keyboard support (WASD/Arrow keys for movement, Shift for sprint)
- Touch support with virtual joystick and action buttons
- Unified input: combines keyboard and touch seamlessly
- Touch detection with dead zones (10% radius)
- Action buttons for attack, sprint, and pause
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
- Wall collision avoidance (raycasting from player to camera)
- Smooth distance adjustment when obstructed by walls
- Configurable collision padding and minimum distance

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
- Sprint Refill: instantly refills player sprint gauge to full capacity
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

### Audio Manager
- Web Audio API based audio system
- Synthetic sounds using oscillators and noise generators (easily swappable for real audio files)
- Two music themes: SAFE (calm exploration) and DANGER (tense chase)
- Smooth crossfade between themes (configurable, default 2 seconds)
- Sound effects: footsteps, sword swing, sword hit, zombie growl/death, powerup pickup, level complete, game over
- Volume controls: master, music, SFX
- Spatial audio support for zombie positions
- Auto-switches music based on zombie proximity

### Spectator Meerkats
- Non-playable meerkats positioned on hedge wall tops
- Head tracking: smoothly follows player position
- Idle animation: subtle swaying/breathing motion
- Danger alert system with 4 levels: CALM, CURIOUS, ALERT, ALARMED
- Alert triggered when zombies within 2 cells of player
- SpectatorMeerkatManager handles spawning (every 3-5 cells) and batch updates
- Uses InstancedMesh for performance when many meerkats

### Touch Controls
- Virtual joystick: configurable position (left or right side), drag to move
- Sprint button: opposite side from joystick, press and hold
- Attack button: above sprint, tap to attack
- Pause button: top-right corner
- Auto-shows on touch devices, hidden on desktop
- Dead zone handling (10% radius) prevents accidental movement
- Visual feedback on button presses
- Customizable button size: small, medium, or large
- Settings persist to localStorage

### Particle System
- GPU-accelerated using Three.js Points with BufferGeometry
- Effect types: SWORD_TRAIL, ZOMBIE_HIT, POWERUP_COLLECT, SHIELD_BREAK, FOOTSTEP_DUST
- Particle pooling for memory efficiency
- Configurable per-effect: count, color, size, lifetime, velocity, gravity
- Mobile-aware with automatic particle count reduction
- Emission shapes: point, sphere, cone
- Fade and shrink over lifetime support

### Performance Manager
- Singleton pattern for global performance control
- Auto-detects mobile devices (touch + screen size + user agent)
- Three performance tiers: LOW, MEDIUM, HIGH
- GPU detection via WebGL debug info
- Settings per tier: shadow map size, fog distance, particle multiplier, pixel ratio
- FPS tracking with auto-tier adjustment when FPS drops
- Applies settings to renderer, scene, and lights

### Screen Shake
- Combat feedback for successful hits
- Configurable intensity and duration
- Decay over time for natural feel
- Applied after camera positioning in game loop

### Zombie Difficulty Scaling
- Level-based difficulty multipliers for patrol speed, chase speed, and detection radius
- Levels 1-3 (Easy): 80% patrol/85% chase speed, 70% detection radius
- Levels 4-6 (Medium): Normal values
- Levels 7-9 (Hard): 115% patrol/120% chase speed, 130% detection radius
- Levels 10+ (Endless): 125% patrol/130% chase speed, 140% detection radius

### Timer Warning Sounds
- Warning ticking sound for last 10 seconds (1 tick/sec)
- Critical ticking sound for last 5 seconds (2 ticks/sec, higher pitch)
- Rate-limited to prevent sound spam

### Spectator Meerkat Sounds
- Occasional chirps when curious (low frequency)
- Alarm calls when danger is near (higher frequency)
- Sound triggers based on max alert level across all spectators

### Settings Menu
- Audio controls: Master, Music, and SFX volume sliders
- Mute all toggle
- Touch control settings: joystick position (left/right), button size (small/medium/large)
- Settings persist to localStorage
- Accessible from main menu

### How to Play Screen
- Proper overlay screen (replaced alert())
- Visual control guide for keyboard and mobile
- Power-up descriptions with icons
- Tips and goal explanation
- Spectator meerkat warning system explained

### Save/Continue System
- Progress saved to localStorage on level completion
- Saves next level number and total time survived
- Continue button appears when save exists
- Progress cleared on game over or new game start

### Debug Overlay
- Toggle with backtick (`) key
- FPS counter with color-coded status (green/yellow/red)
- Frame time display in milliseconds
- Entity count and active zombie count
- Level seed display for reproducibility
- Player world position (x, y, z) and grid position (cell coordinates)
- Camera position display
- Visualization toggles: collision circles, pathfinding paths, grid overlay
- 3D visualization helpers added to scene when enabled

### Minimap
- Toggle with M key
- Canvas-based top-down view of maze
- Fog of war system: unexplored areas hidden
- Player position shown as directional triangle
- Zombie positions shown as red dots (brighter when chasing)
- Exit marker always visible as gold star
- Power-ups and sword positions shown when in explored area
- Automatic exploration radius around player (3 cells)
- Legend showing marker meanings

### 3D Fog of War System
- Distance-based fog limits visibility to 3-4 cells (FOG_VISIBILITY_RADIUS)
- Dark fog color (0x1a1a2e) for dramatic effect
- Seamless darkness at visibility edges (background matches fog)
- Performance-aware: same settings across all tiers
- Applied via Three.js Fog with near/far based on visibility radius

### Line of Sight System
- True raycasting for zombie detection (walls block vision)
- Uses Digital Differential Analyzer (DDA) algorithm
- Grid-based traversal checking wall transitions
- Replaces old pathfinding heuristic with accurate LOS
- getVisibleCells() method for future fog of war enhancements
- Zombies can only detect player when no walls block the path

### Haptic Feedback System
- HapticManager singleton using Vibration API
- Predefined patterns: LIGHT, MEDIUM, HEAVY, DOUBLE, SUCCESS, WARNING, ERROR
- Game event methods: onAttack(), onHitZombie(), onPowerUpCollect(), onShieldBreak(), onDeath(), onLevelComplete()
- Graceful fallback when API not supported
- User can enable/disable haptic feedback

### Meerkat Character Model
- MeerkatModel class creates stylized 3D meerkat using Three.js primitives
- Includes: body, belly, head with snout, eyes with highlights, eye patches, ears, arms, paws, legs, feet, tail
- Configurable colors: body, belly, eye, nose
- Methods for visual effects: setEmissive(), setOpacity(), setBodyColor()
- Factory functions: createPlayerMeerkatModel(), createZombieMeerkatModel()

### Zombie Character Model
- ZombieModel class creates undead meerkat with glowing eyes
- Glowing eyes: emissive sphere with point light for fog visibility
- Visual states: NORMAL, CHASING (intense red glow), FROZEN (ice blue)
- Body has undead aesthetic: sickly green, claws, hunched posture
- Point lights attached to eyes illuminate nearby area through fog
- Death animation: dissolve effect (shrink, fade, spin, sink)

### Animation System
- AnimationController class manages procedural animations per entity
- Support for keyframe-based animations with multiple easing functions
- EaseType options: LINEAR, EASE_IN, EASE_OUT, EASE_IN_OUT, BOUNCE, ELASTIC
- Animation blending between states (configurable blend time)
- ProceduralAnimations helper with pre-built animation clips:
  - createWalkCycle: coordinated arm/leg swing with body bob
  - createRunCycle: faster, more pronounced motion
  - createIdleAnimation: breathing and subtle sway
  - createAttackAnimation: wind-up and swing motion
  - createDeathAnimation: fall forward collapse
  - createVictoryAnimation: arms up with jump celebration
  - createDissolveAnimation: shrink/spin/fade death effect

### Meerkat Animation Integration
- MeerkatModel stores references to animatable body part groups
- Limbs use pivot groups for proper rotation (shoulder/hip joints)
- Animation clips registered on construction
- playAnimation(name) triggers state-based animation changes
- update(deltaTime) advances animation each frame
- State tracking prevents animation interruption during attacks

### Attack Cooldown UI
- HUD displays cooldown overlay on sword indicator
- Visual fill shows cooldown progress (100% = on cooldown)
- Flash animation when cooldown completes (ready to attack)
- Grayed out appearance during cooldown period
