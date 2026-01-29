# Meerkat Maze Runner - Implementation Plan

## Overview
A 3D third-person survival game where a meerkat navigates procedurally generated garden hedge mazes while evading zombies. Built with Three.js for browser (desktop + mobile).

---

## Phase 1: Project Setup & Core Infrastructure ✅ COMPLETED

### 1.1 Project Initialization ✅
- [x] Initialize npm project with `package.json`
- [x] Install dependencies:
  - `three` (Three.js core)
  - `vite` (build tool)
  - Development dependencies for TypeScript
  - `vitest` for testing
- [x] Configure Vite for development and production builds
- [x] Set up basic HTML entry point (`index.html`)
- [x] Create source directory structure:
  ```
  src/
  ├── main.ts
  ├── game/
  ├── entities/
  ├── systems/
  ├── maze/
  ├── ui/
  ├── camera/
  └── utils/
  ```

### 1.2 Three.js Scene Setup ✅
- [x] Create `src/main.ts` entry point
- [x] Initialize Three.js renderer with WebGL 2.0
- [x] Set up scene with appropriate lighting:
  - Ambient light for base illumination
  - Directional light for shadows (sun-like)
  - Hemisphere light for sky/ground variation
- [x] Configure renderer settings:
  - Enable shadows (PCFSoftShadowMap)
  - Set pixel ratio for retina displays (capped at 2)
  - Enable antialiasing
  - ACES Filmic tone mapping
- [x] Create resize handler for responsive canvas

### 1.3 Game Loop Foundation ✅
- [x] Create `src/game/Game.ts` main game class
- [x] Implement requestAnimationFrame game loop
- [x] Add delta time calculation for frame-independent movement
- [x] Create `src/game/GameState.ts` for state management:
  - States: MENU, PLAYING, PAUSED, GAME_OVER, LEVEL_COMPLETE
  - State transition validation
  - Event listeners for state changes
- [x] Create `src/utils/Constants.ts` for game constants
- [x] Unit tests for GameState and Constants (65 tests passing)

---

## Phase 2: Maze Generation System

### 2.1 Maze Algorithm Implementation
- Create `src/maze/MazeGenerator.js`
- Implement Recursive Backtracking algorithm:
  - Create 2D grid representation
  - Implement cell and wall data structures
  - Generate maze with guaranteed path from start to exit
  - Support seed-based random generation for reproducibility
- Add size configurations:
  - Small: 10x10 cells (Levels 1-3)
  - Medium: 15x15 cells (Levels 4-6)
  - Large: 20x20 cells (Levels 7+)

### 2.2 Maze Data Structure
- Define cell structure:
  - `walls: { north, south, east, west }`
  - `visited: boolean`
  - `isStart: boolean`
  - `isExit: boolean`
  - `spawnPoint: 'item' | 'zombie' | null`
- Calculate valid spawn points for:
  - Player start (always accessible, safe)
  - Exit (far from start by path distance)
  - Power-ups (distributed throughout)
  - Zombies (away from player start)

### 2.3 Maze 3D Rendering
- Create `src/maze/MazeRenderer.js`
- Define world-space dimensions:
  - Cell size: 4x4 units
  - Wall thickness: 0.5 units
  - Wall height: ~9 units (3x player height)
  - Corridor width: 3.5 units
- Create hedge wall geometry:
  - Use BoxGeometry for walls
  - Apply green hedge material/texture
  - Enable shadow casting/receiving
- Create floor geometry:
  - PlaneGeometry for ground
  - Grass/garden texture
- Use instanced rendering for wall performance
- Mark special locations visually:
  - Start point: distinct ground texture
  - Exit: archway/gate with glow effect

### 2.4 Fog of War System
- Implement visibility radius (3-4 cells)
- Create shader or mesh-based fog system
- Darken/hide areas outside visibility range
- Update fog based on player position
- Consider performance on mobile (simplified fog)

---

## Phase 3: Player Character

### 3.1 Player Entity Setup
- Create `src/entities/Player.js`
- Load or create meerkat 3D model:
  - Placeholder: capsule geometry initially
  - Target: GLTF meerkat model with rig
- Set up player properties:
  - Position, rotation
  - Walking speed: base value
  - Sprint speed: 2x walking speed
  - Sprint gauge: 5 seconds capacity
  - Sprint regen: ~2 seconds to full
  - hasSword: boolean
  - hasShield: boolean

### 3.2 Player Movement
- Implement 8-directional movement:
  - Forward, backward, left, right
  - Four diagonals
- Movement relative to screen (fixed camera orientation)
- Smooth movement with velocity-based physics
- Collision detection with maze walls:
  - Capsule/cylinder collider
  - Slide along walls on collision

### 3.3 Sprint System
- Implement sprint gauge mechanics:
  - Deplete while Shift held (or mobile sprint button)
  - Regenerate when not sprinting
  - Visual gauge in HUD
- Apply sprint speed multiplier (2x)
- Prevent sprint when gauge empty

### 3.4 Player Animations
- Set up animation mixer
- Implement animation states:
  - Idle: meerkat alert pose
  - Walking: walking cycle
  - Running: sprint cycle
  - Attack: sword swing (when equipped)
  - Death: death animation
  - Victory: celebration animation
- Smooth transitions between animation states

### 3.5 Player Collision
- Create collision shapes:
  - Capsule collider for wall collision
  - Smaller hitbox for zombie collision
- Implement collision response:
  - Wall: stop/slide
  - Zombie: trigger death (unless shield)
  - Power-up: collect
  - Sword: equip
  - Exit: level complete

---

## Phase 4: Input System

### 4.1 Input Manager Foundation
- Create `src/systems/InputManager.js`
- Implement input state tracking:
  - Currently pressed keys
  - Mouse button states
  - Touch states
- Add event listeners:
  - `keydown`, `keyup`
  - `mousedown`, `mouseup`
  - `touchstart`, `touchmove`, `touchend`

### 4.2 Desktop Controls
- WASD movement mapping:
  - W: forward (screen up)
  - A: left
  - S: backward (screen down)
  - D: right
- Shift: sprint (hold)
- Left mouse click: attack
- ESC: pause menu
- Prevent default browser shortcuts during gameplay

### 4.3 Mobile Controls
- Create virtual joystick:
  - Position: bottom-left (configurable)
  - Size: ~100px radius
  - Touch and drag for direction
  - Dead zone: 10% radius
  - Release to stop
- Create action buttons:
  - Sprint button: bottom-right
  - Attack button: above sprint
  - Pause button: top-right
- Minimum touch target size: 44x44px
- Visual feedback on button press
- Haptic feedback (if supported)

### 4.4 Input Abstraction
- Create unified input interface:
  - `getMovementDirection(): Vector2`
  - `isSprinting(): boolean`
  - `isAttacking(): boolean`
  - `isPausePressed(): boolean`
- Abstract away keyboard vs touch differences

---

## Phase 5: Camera System

### 5.1 Follow Camera Implementation
- Create `src/camera/FollowCamera.js`
- Configure camera parameters:
  - Vertical angle: 50 degrees from horizontal
  - Distance from player: 12-15 units
  - Height offset: 10-12 units
  - Field of view: 60 degrees
- Implement smooth following:
  - Lerp position toward target
  - Follow speed: 5-8 units/second

### 5.2 Camera Behavior
- Fixed orientation (no rotation with player)
- Always look at player position
- Handle wall obstruction:
  - Detect camera-to-player line intersection with walls
  - Move camera closer or higher when obstructed
  - Smooth transition back when obstruction clears

### 5.3 Camera-Fog Integration
- Use camera frustum for visibility calculations
- Integrate with fog of war system
- Ensure player always visible

---

## Phase 6: Zombie Enemies

### 6.1 Zombie Entity Setup
- Create `src/entities/Zombie.js`
- Load or create zombie model:
  - Desaturated meerkat or generic zombie
  - Glowing eyes
  - Shambling posture
- Define zombie properties:
  - Patrol speed: slow
  - Chase speed: faster than player walk, slower than sprint
  - Detection radius: configurable
  - State: PATROL or CHASE

### 6.2 Zombie Patrol Behavior
- Wander maze randomly:
  - Pick random valid direction at intersections
  - Turn around at dead ends
- Move at slow walking pace
- Play patrol animations

### 6.3 Zombie Chase Behavior
- Detection system:
  - Check if player within detection radius
  - Line-of-sight check (blocked by walls)
  - When detected, switch to CHASE state
- Chase mechanics:
  - Move toward player's last known position
  - Update target position periodically
  - Return to PATROL if player escapes radius

### 6.4 Pathfinding System
- Create `src/systems/PathfindingSystem.js`
- Implement A* algorithm:
  - Convert maze to navigation grid
  - Calculate path from zombie to target
  - Return array of waypoints
- Optimize for multiple zombies:
  - Path caching
  - Staggered path updates
- Handle dynamic path updates during chase

### 6.5 Zombie Spawning
- Spawn at designated points:
  - Minimum safe distance from player start
  - Distributed throughout maze
- Scale zombie count by level:
  - Levels 1-3: 2-4 zombies
  - Levels 4-6: 5-8 zombies
  - Levels 7-9: 9-12 zombies
  - Level 10+: 12-15 zombies
- Scale behavior by level:
  - Early: slower speed, smaller detection
  - Later: faster speed, larger detection

### 6.6 Zombie Death
- Detect sword hit collision
- Play death animation
- Remove from scene
- No respawning within level

---

## Phase 7: Combat System

### 7.1 Sword Pickup
- Create sword item entity
- Spawn at random maze location (one per level)
- Auto-pickup on player collision
- Visual/audio feedback on pickup
- Show sword on player model when equipped

### 7.2 Attack Mechanics
- Trigger attack on input (click/tap)
- Attack hitbox:
  - Cone/arc shape in front of player
  - Brief duration during swing
  - Melee range
- Cooldown: ~0.5 seconds between attacks
- Allow movement during attack

### 7.3 Combat Collision
- Detect sword hitbox overlap with zombie
- One hit kills zombie
- Apply hit effects:
  - Zombie death animation
  - Impact particles
  - Screen shake (subtle)
  - Hit sound

### 7.4 Sword Spawn Rules
- Levels 1-3: Always spawns (100%)
- Levels 4-6: Usually spawns (80%)
- Levels 7-9: Sometimes spawns (60%)
- Level 10+: Rare spawn (40%)

---

## Phase 8: Power-up System

### 8.1 Power-up Base Class
- Create `src/entities/PowerUp.js`
- Define base power-up properties:
  - Position
  - Type
  - Visual appearance (icon, color)
  - Collection radius
- Implement floating/bobbing animation
- Handle player collision for collection

### 8.2 Speed Boost Power-up
- Icon: lightning bolt
- Color: yellow/orange
- Effect: +50% movement speed
- Duration: 8 seconds
- Non-stacking (refreshes duration)

### 8.3 Sprint Refill Power-up
- Icon: energy drink/battery
- Color: blue
- Effect: instant sprint gauge refill
- Duration: instant (one-time)

### 8.4 Invisibility Power-up
- Icon: ghost/slashed eye
- Color: purple/translucent
- Effect: zombies cannot detect player
- Duration: 5 seconds
- Visual: player becomes semi-transparent
- Breaks existing chase

### 8.5 Shield Power-up
- Icon: shield emblem
- Color: cyan/silver
- Effect: survive one zombie hit
- Duration: until hit or level ends
- Visual: glowing aura around player
- Consumed on zombie contact

### 8.6 Freeze Power-up
- Icon: snowflake
- Color: light blue/white
- Effect: all zombies stop moving
- Duration: 4 seconds
- Visual: ice effect on frozen zombies
- Zombies can still be killed while frozen

### 8.7 Power-up Spawning
- Spawn 2-5 per level (scales with maze size)
- Random selection from pool
- Distributed at valid maze locations
- No spawns at start point

### 8.8 Active Effects Manager
- Track active power-up effects
- Handle duration timers
- Apply/remove effect modifiers
- Update HUD indicators

---

## Phase 9: Spectator Meerkats

### 9.1 Spectator Entity Setup
- Create `src/entities/SpectatorMeerkat.js`
- Create meerkat model in alert pose:
  - Standing upright on hind legs
  - Size variations
  - Color variations
- Position on top of hedge walls

### 9.2 Spectator Placement
- Distribute around maze:
  - Perimeter
  - Key intersections
  - Every 3-5 maze cells
- Face inward toward maze
- Non-collidable (decorative)

### 9.3 Head Tracking Behavior
- Track player with head rotation:
  - Smooth interpolation
  - Only when player in visible range
- Eye tracking (if detail supports)
- Idle look-around when not tracking

### 9.4 Danger Alert System
- Trigger when zombie near player (~2 cells)
- Agitated movement animation
- Look toward danger source
- Warning squeaks (audio cue)
- Directional audio for player hint

### 9.5 Performance Optimization
- Use LOD for distant meerkats
- Instanced rendering
- Simple animation rig (head rotation, basic idle)

---

## Phase 10: Audio System

### 10.1 Audio Manager Setup
- Create `src/systems/AudioManager.js`
- Initialize Web Audio API context
- Implement sound loading/caching
- Create audio pools for repeated sounds
- Support 3D spatial audio

### 10.2 Music System
- Load music tracks:
  - Safe/exploration theme (playful, whimsical)
  - Danger/chase theme (tense, urgent)
  - Victory jingle
  - Defeat sting
- Implement smooth crossfade (1-2 seconds)
- Trigger transitions based on zombie proximity

### 10.3 Sound Effects - Player
- Footsteps (walk): soft grass steps
- Footsteps (sprint): faster, heavier
- Death: meerkat yelp
- Victory: happy chirp

### 10.4 Sound Effects - Combat
- Sword pickup: metallic ring + chime
- Sword swing: whoosh
- Sword hit: impact thud + squelch

### 10.5 Sound Effects - Zombies
- Ambient groaning: low, distant moans
- Chase triggered: alert growl
- Footsteps: shambling, dragging
- Death: defeat groan + collapse
- 3D positioned for directional awareness

### 10.6 Sound Effects - Power-ups
- Generic pickup: positive chime/sparkle
- Speed boost active: whoosh/wind loop
- Invisibility active: ethereal hum
- Shield active: energy hum
- Shield break: glass shatter
- Freeze activate: ice crack

### 10.7 Sound Effects - Spectator Meerkats
- Ambient chirps: soft, occasional
- Warning call: sharp, repeated squeaks
- Danger close: frantic alarm calls
- Directional audio

### 10.8 Sound Effects - UI
- Button click: soft click
- Level start: ready chime
- Timer warning (10s): ticking
- Timer critical (5s): faster ticking

### 10.9 Volume Control
- Separate music and SFX volume
- User-adjustable sliders
- Mute all toggle
- Persist settings to localStorage

---

## Phase 11: User Interface

### 11.1 UI Framework Setup
- Create `src/ui/` module structure
- Decide approach: HTML/CSS overlay or Three.js UI
- Recommend: HTML/CSS for menus, canvas for HUD
- Create base UI component class

### 11.2 HUD Implementation
- Create `src/ui/HUD.js`
- Timer display:
  - Position: top center
  - Format: MM:SS or seconds
  - Color states: normal (white), warning (yellow), critical (red)
  - Pulse animation for warning/critical
- Sprint gauge:
  - Position: bottom center
  - Horizontal bar
  - Color: blue/green (available), red (empty)
- Active power-ups:
  - Position: top right
  - Icons with duration timers
- Sword indicator:
  - Position: bottom right
  - Grayed when not held, lit when equipped
- Level indicator:
  - Position: top left
  - "Level X" text

### 11.3 Main Menu
- Create `src/ui/MainMenu.js`
- Title screen with meerkat imagery
- Animated background (hedge maze scene)
- Menu options:
  - Play (start new game)
  - Continue (resume from save, if applicable)
  - Leaderboard (view high scores)
  - Settings (audio/controls)
  - How to Play (tutorial)

### 11.4 Pause Menu
- Create `src/ui/PauseMenu.js`
- Trigger: ESC key or pause button
- Options:
  - Resume
  - Restart Level
  - Settings
  - Quit to Menu
- Game pauses, timer stops

### 11.5 Settings Menu
- Audio settings:
  - Music volume slider (0-100%)
  - SFX volume slider (0-100%)
  - Mute all toggle
- Mobile control settings:
  - Joystick position (left/right)
  - Button size (small/medium/large)
- Save to localStorage

### 11.6 Leaderboard Screen
- Create `src/ui/Leaderboard.js`
- Display top 10 scores:
  - Rank (1-10)
  - Player name/initials
  - Highest level reached
  - Total survival time
- LocalStorage persistence
- Prompt for name on new high score (3-10 chars)

### 11.7 Level Transition Screens
- Level Complete screen:
  - "Level X Complete!"
  - Time remaining bonus
  - Stats: zombies killed, power-ups collected
  - "Next Level" button
- Game Over screen:
  - "Game Over"
  - Final level reached
  - Total time survived
  - "Try Again" / "Main Menu" buttons
  - High score entry if applicable

### 11.8 Tutorial/How to Play
- Simple overlay or separate screen
- Visual control guide
- Brief explanations:
  - Goal: reach exit before time runs out
  - Zombies: avoid or kill with sword
  - Sprint: limited use, regenerates
  - Power-ups: brief descriptions
  - Spectator meerkats: warning system

### 11.9 Mobile UI Considerations
- Larger touch targets (minimum 44px)
- Scale with screen size
- Clear, readable fonts
- Consistent cartoony aesthetic

---

## Phase 12: Level Progression System

### 12.1 Level Manager
- Create `src/game/LevelManager.js`
- Track current level number
- Configure level parameters:
  - Maze size
  - Zombie count
  - Base time
  - Power-up count
  - Sword spawn chance

### 12.2 Level Configuration
- Easy (Levels 1-3):
  - Maze: 10x10
  - Zombies: 2-4
  - Time: 60 seconds
  - Power-ups: 2-3
  - Sword: 100%
- Medium (Levels 4-6):
  - Maze: 15x15
  - Zombies: 5-8
  - Time: 90 seconds
  - Power-ups: 3-4
  - Sword: 80%
- Hard (Levels 7-9):
  - Maze: 20x20
  - Zombies: 9-12
  - Time: 120 seconds
  - Power-ups: 4-5
  - Sword: 60%
- Endless (Level 10+):
  - Maze: 20x20
  - Zombies: 12-15 (capped)
  - Time: 120s - 5s per level above 10 (min 90s)
  - Power-ups: 3-4
  - Sword: 40%

### 12.3 Level Generation
- Generate new maze each level
- Random seed for variety
- Place player at start
- Spawn zombies at safe locations
- Spawn power-ups throughout
- Spawn sword (based on probability)

### 12.4 Level Completion
- Detect player reaching exit
- Stop timer
- Calculate score:
  - Time remaining bonus
  - Stats tracking
- Show Level Complete screen
- Load next level

### 12.5 Game Over
- Trigger on:
  - Timer reaches zero
  - Zombie touches player (no shield)
- Record final stats
- Check for high score
- Show Game Over screen
- Reset to Level 1 on retry

### 12.6 Continue System
- Save current level to localStorage
- "Continue" option on main menu
- Optional: only save every 3 levels

### 12.7 Score Calculation
- Formula: `(Highest Level × 1000) + Total Survival Time (seconds)`
- Primary sort: highest level
- Secondary sort: total time

---

## Phase 13: Collision System

### 13.1 Collision Manager
- Create `src/systems/CollisionSystem.js`
- Handle all collision detection:
  - Player vs walls
  - Player vs zombies
  - Player vs power-ups
  - Player vs sword
  - Player vs exit
  - Sword attack vs zombies

### 13.2 Wall Collision
- Use player capsule collider
- Cast rays or use bounding box checks
- Implement sliding response along walls
- Prevent player from passing through walls

### 13.3 Entity Collision
- Sphere-based collision for entities
- Player death on zombie touch (unless shield)
- Auto-collect power-ups and sword
- Level complete on exit touch

### 13.4 Attack Collision
- Create temporary hitbox during attack
- Cone/arc shape in front of player
- Check overlap with zombie bounds
- Trigger zombie death on hit

---

## Phase 14: Data Persistence

### 14.1 Storage Manager
- Create utility for localStorage operations
- Keys:
  - `meerkat-maze-leaderboard`
  - `meerkat-maze-settings`
  - `meerkat-maze-progress`

### 14.2 Leaderboard Storage
- Structure:
  ```json
  {
    "scores": [
      { "name": "AAA", "level": 12, "time": 845, "date": "2024-01-15" }
    ]
  }
  ```
- Max 10 entries
- Sort by level (primary), time (secondary)

### 14.3 Settings Storage
- Store:
  - Music volume
  - SFX volume
  - Mute state
  - Mobile joystick position
  - Mobile button size

### 14.4 Progress Storage
- Store:
  - Current level
  - (Optional) Current run stats

---

## Phase 15: Performance Optimization

### 15.1 Rendering Optimization
- Use instanced rendering for maze walls
- Implement LOD for meerkats
- Frustum culling
- Reduce shadow map resolution on mobile
- Texture atlasing

### 15.2 Object Pooling
- Pool zombies
- Pool particles
- Pool audio instances
- Reuse instead of create/destroy

### 15.3 Mobile-Specific Optimizations
- Reduce particle effects
- Lower draw distance
- Simplified fog of war
- Texture resolution scaling
- Reduced shadow quality

### 15.4 Performance Monitoring
- FPS counter (debug mode)
- Memory usage tracking
- Performance warnings

---

## Phase 16: Polish & Effects

### 16.1 Visual Effects
- Sword swing trail
- Impact particles
- Power-up collection particles
- Shield glow effect
- Invisibility transparency effect
- Freeze ice effect on zombies
- Exit glow/particles

### 16.2 Screen Effects
- Subtle screen shake on hit
- Flash on damage/death
- Vignette during danger
- Smooth transitions between states

### 16.3 Animation Polish
- Smooth animation blending
- Animation events for sound sync
- Procedural head bob during movement

---

## Phase 17: Testing & Debug Tools

### 17.1 Debug Mode
- Toggle with key (e.g., backtick)
- FPS counter
- Collision visualization
- Pathfinding visualization
- Level seed display/input

### 17.2 Unit Tests
- Maze generation validity
- Pathfinding correctness
- Collision detection accuracy

### 17.3 Manual Testing Checklist
- All levels playable
- Mobile touch controls responsive
- Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Android Chrome)
- Performance targets met (60fps desktop, 30+ fps mobile)

---

## Phase 18: Build & Deployment

### 18.1 Build Configuration
- Production build with Vite
- Asset optimization (minification, compression)
- Code splitting (if beneficial)
- Source maps for debugging

### 18.2 Asset Preparation
- Compress textures (WebP where supported)
- Compress audio (MP3/OGG)
- Optimize 3D models (GLTF/GLB)
- Generate texture atlases

### 18.3 Deployment
- Static file hosting
- Configure caching headers
- Set up HTTPS
- Test on target browsers

---

## Implementation Order Summary

1. **Foundation** (Phases 1-2): Project setup, Three.js scene, maze generation
2. **Core Gameplay** (Phases 3-6): Player, input, camera, zombies
3. **Combat & Items** (Phases 7-8): Sword, power-ups
4. **Atmosphere** (Phases 9-10): Spectator meerkats, audio
5. **Interface** (Phase 11): All UI screens
6. **Progression** (Phases 12-14): Levels, collision, persistence
7. **Polish** (Phases 15-17): Optimization, effects, testing
8. **Release** (Phase 18): Build and deploy

---

## Asset Requirements

### 3D Models (GLTF/GLB)
- Meerkat player (rigged, animated)
- Zombie meerkat (rigged, animated)
- Spectator meerkat (simple rig)
- Sword
- Power-up icons (5 types)
- Hedge wall segment
- Exit gate/archway

### Textures
- Hedge/leaf texture
- Grass/ground texture
- Stone path texture (optional)
- UI elements and icons

### Audio
- 2 music tracks (safe, danger)
- Victory jingle
- Defeat sting
- ~25 sound effects (see Phase 10)

---

## Risk Mitigation

- **Performance on mobile**: Start with simple geometry, optimize early
- **Pathfinding complexity**: Use proven A* implementation, limit zombie count
- **Touch controls feel**: Iterate early, test on real devices
- **Scope creep**: MVP first, polish after core loop works
- **Art assets**: Use placeholder geometry until final assets ready
