const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');
const restartButton = document.getElementById('restartButton');

const pauseButton = document.createElement('button');
pauseButton.type = 'button';
pauseButton.id = 'maze-pause-btn';
pauseButton.setAttribute('aria-label', 'Pause or resume game');
pauseButton.textContent = '⏸️';
pauseButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    font-size: 24px;
    touch-action: none;
    z-index: 1000;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;
document.body.appendChild(pauseButton);

// Set canvas size
canvas.width = 400;
canvas.height = 400;

// Cell size
const cellSize = 16;  // Smaller cells to fit more maze
const rows = Math.floor(canvas.height / cellSize);
const cols = Math.floor(canvas.width / cellSize);

// Player properties
const player = {
    x: cellSize,  // Start at first valid cell
    y: cellSize,
    size: cellSize - 4,
    color: '#4CAF50'
};

// Add score elements
const currentScoreElement = document.getElementById('currentScore');
const highScoresList = document.getElementById('highScoresList');

// Add level display element
const levelDisplay = document.createElement('p');
levelDisplay.innerHTML = 'Level: <span id="currentLevel">1</span>';
document.querySelector('.stats').appendChild(levelDisplay);
const currentLevelElement = document.getElementById('currentLevel');

// Game state
let gameStarted = false;
let gameWon = false;
let gamePaused = false;
let startTime = 0;
let elapsedTime = 0;
let pauseStartTime = 0;
let currentScore = 0;
let lastMoveTime = 0;
let currentLevel = 1;
let nextMaze = null;
let savedMazes = JSON.parse(localStorage.getItem('savedMazes')) || {};
let highScores = JSON.parse(localStorage.getItem('mazeRunnerHighScores')) || [];

// Add touch controls
const touchControls = {
    startX: 0,
    startY: 0,
    isMoving: false
};

// Add virtual control buttons
function createVirtualControls() {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'virtual-controls';

    // Position controls relative to canvas
    const canvasRect = canvas.getBoundingClientRect();
    controlsContainer.style.cssText = `
        position: absolute;
        top: ${canvasRect.top + (canvasRect.height / 2)}px;
        left: calc(${canvasRect.right}px + 4em);
        transform: translateY(-50%);
        display: grid;
        grid-template-areas:
            ". up ."
            "left . right"
            ". down .";
        gap: 10px;
        touch-action: none;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.2);
        padding: 10px;
        border-radius: 15px;
    `;

    const buttons = {
        up: '↑',
        down: '↓',
        left: '←',
        right: '→'
    };

    Object.entries(buttons).forEach(([direction, arrow]) => {
        const button = document.createElement('button');
        button.textContent = arrow;
        button.className = `control-button ${direction}`;
        button.style.cssText = `
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.3);
            background: rgba(0, 0, 0, 0.5);
            color: white;
            font-size: 24px;
            touch-action: none;
            grid-area: ${direction};
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            transition: background-color 0.2s, transform 0.1s;
        `;

        // Add hover effect
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        });

        // Add press effect
        const pressEffect = () => {
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 100);
        };

        // Handle both touch and click events
        const handleInteraction = (e) => {
            e.preventDefault();
            pressEffect();
            simulateKeyPress(direction);
        };

        button.addEventListener('touchstart', handleInteraction);
        button.addEventListener('mousedown', handleInteraction);

        controlsContainer.appendChild(button);
    });

    document.body.appendChild(controlsContainer);

    // Add a small instruction text above the controls
    const instructionText = document.createElement('div');
    instructionText.style.cssText = `
        position: absolute;
        top: ${canvasRect.top + (canvasRect.height / 2) - 120}px;
        left: calc(${canvasRect.right}px + 4em);
        color: black;
        font-size: 14px;
        text-align: center;
        background: rgba(255, 255, 255, 0.8);
        padding: 5px 10px;
        border-radius: 5px;
        pointer-events: none;
    `;
    document.body.appendChild(instructionText);

    // Update positions when window is resized
    window.addEventListener('resize', () => {
        const newCanvasRect = canvas.getBoundingClientRect();
        controlsContainer.style.top = `${newCanvasRect.top + (newCanvasRect.height / 2)}px`;
        controlsContainer.style.left = `calc(${newCanvasRect.right}px + 4em)`;
        instructionText.style.top = `${newCanvasRect.top + (newCanvasRect.height / 2) - 120}px`;
        instructionText.style.left = `calc(${newCanvasRect.right}px + 4em)`;
    });
}

// Simulate key press for virtual buttons
function simulateKeyPress(direction) {
    const keyMap = {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight'
    };

    const event = {
        key: keyMap[direction],
        preventDefault: () => {}
    };
    movePlayer(event);
}

// Handle touch gestures
function handleTouchStart(e) {
    const touch = e.touches[0];
    touchControls.startX = touch.clientX;
    touchControls.startY = touch.clientY;
    touchControls.isMoving = true;
}

function handleTouchMove(e) {
    if (!touchControls.isMoving) return;

    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchControls.startX;
    const deltaY = touch.clientY - touchControls.startY;
    const minSwipeDistance = 30; // Minimum distance for swipe detection

    if (Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            simulateKeyPress(deltaX > 0 ? 'right' : 'left');
        } else {
            // Vertical swipe
            simulateKeyPress(deltaY > 0 ? 'down' : 'up');
        }

        // Reset start position after movement
        touchControls.startX = touch.clientX;
        touchControls.startY = touch.clientY;
    }
}

function handleTouchEnd() {
    touchControls.isMoving = false;
}

// Add touch event listeners
function initializeTouchControls() {
    // Add touch events to canvas
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    // Create virtual control buttons
    createVirtualControls();

    // Add meta viewport tag for proper mobile scaling if not present
    if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(viewport);
    }
}

// Generate maze using recursive backtracking
class Cell {
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.isWall = true;  // By default, all cells are walls
        this.visited = false;
    }
}

let maze = [];

// Save current maze layout
function saveMazeLayout() {
    const mazeLayout = maze.map(row => row.map(cell => ({
        isWall: cell.isWall,
        visited: false
    })));
    savedMazes[currentLevel] = mazeLayout;
    localStorage.setItem('savedMazes', JSON.stringify(savedMazes));
}

// Load maze layout for a specific level
function loadMazeLayout(level) {
    if (savedMazes[level]) {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                maze[row][col].isWall = savedMazes[level][row][col].isWall;
                maze[row][col].visited = false;
            }
        }
        return true;
    }
    return false;
}

// Generate the next maze in advance
function generateNextMaze() {
    const tempMaze = [];
    // Create grid of cells
    for (let row = 0; row < rows; row++) {
        tempMaze[row] = [];
        for (let col = 0; col < cols; col++) {
            tempMaze[row][col] = new Cell(row, col);
            if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) {
                tempMaze[row][col].isWall = true;
            } else {
                // Increase wall density based on level
                const wallChance = Math.min(0.3 + (currentLevel * 0.05), 0.8);
                if (row % 2 === 1 && col % 2 === 1) {
                    tempMaze[row][col].isWall = Math.random() < wallChance;
                } else {
                    tempMaze[row][col].isWall = true;
                }
            }
        }
    }

    // Generate path through maze with increased complexity based on level
    generateMazePath(1, 1, tempMaze);
    tempMaze[1][1].isWall = false;  // Ensure start is clear
    tempMaze[rows-2][cols-2].isWall = false;  // Ensure end is clear

    return tempMaze;
}

// Modified generateMazePath to work with a specific maze and increase complexity
function generateMazePath(row, col, targetMaze) {
    const directions = [
        [0, 2],   // right
        [2, 0],   // down
        [0, -2],  // left
        [-2, 0]   // up
    ];

    // Add diagonal paths at higher levels for more complexity
    if (currentLevel > 5) {
        directions.push(
            [2, 2],   // diagonal down-right
            [2, -2],  // diagonal down-left
            [-2, 2],  // diagonal up-right
            [-2, -2]  // diagonal up-left
        );
    }

    // Randomize directions with increased chaos at higher levels
    const randomFactor = Math.min(1 + (currentLevel * 0.1), 2);
    directions.sort(() => Math.random() * randomFactor - randomFactor/2);

    targetMaze[row][col].visited = true;

    for (const [dy, dx] of directions) {
        const newRow = row + dy;
        const newCol = col + dx;

        if (newRow > 0 && newRow < rows - 1 && newCol > 0 && newCol < cols - 1
            && !targetMaze[newRow][newCol].visited) {
            // Add more walls at higher levels
            const shouldCreatePath = Math.random() < (1 - (currentLevel * 0.02));
            if (shouldCreatePath) {
                targetMaze[row + dy/2][col + dx/2].isWall = false;
                targetMaze[newRow][newCol].isWall = false;
                generateMazePath(newRow, newCol, targetMaze);
            }
        }
    }
}

function initializeMaze() {
    // Create grid of cells
    for (let row = 0; row < rows; row++) {
        maze[row] = [];
        for (let col = 0; col < cols; col++) {
            maze[row][col] = new Cell(row, col);
            if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) {
                maze[row][col].isWall = true;
            } else {
                // Increase wall density based on level
                const wallChance = Math.min(0.3 + (currentLevel * 0.05), 0.8);
                if (row % 2 === 1 && col % 2 === 1) {
                    maze[row][col].isWall = Math.random() < wallChance;
                } else {
                    maze[row][col].isWall = true;
                }
            }
        }
    }

    if (nextMaze) {
        // Use the pre-generated maze
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                maze[row][col].isWall = nextMaze[row][col].isWall;
            }
        }
        // Generate the next maze for the next level
        nextMaze = generateNextMaze();
    } else {
        // First time initialization
        if (currentLevel === 1 && !savedMazes[1]) {
            generateMazePath(1, 1, maze);
            maze[1][1].isWall = false;
            maze[rows-2][cols-2].isWall = false;
            saveMazeLayout();
        } else if (!loadMazeLayout(currentLevel)) {
            generateMazePath(1, 1, maze);
            maze[1][1].isWall = false;
            maze[rows-2][cols-2].isWall = false;
        }
        // Generate the next maze
        nextMaze = generateNextMaze();
    }

    // Validate and ensure path exists
    const isPathValid = validatePath(1, 1, rows-2, cols-2);
    if (!isPathValid) {
        console.log("Regenerating maze to ensure valid path");
        initializeMaze();
    }
}

function drawMaze() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw maze cells
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = maze[row][col];
            const x = col * cellSize;
            const y = row * cellSize;

            // Draw walls in black
            if (cell.isWall) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(x, y, cellSize, cellSize);
            }

            // Highlight current player cell
            if (Math.floor(player.y / cellSize) === row &&
                Math.floor(player.x / cellSize) === col &&
                !cell.isWall) {
                ctx.fillStyle = 'rgba(144, 238, 144, 0.5)';
                ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
    }

    // Draw start point with level-based color
    const startHue = (currentLevel * 30) % 360;
    ctx.fillStyle = `hsl(${startHue}, 70%, 50%)`;
    ctx.fillRect(cellSize + 2, cellSize + 2, cellSize - 4, cellSize - 4);

    // Draw end point with complementary color
    const endHue = (startHue + 180) % 360;
    ctx.fillStyle = `hsl(${endHue}, 70%, 50%)`;
    ctx.fillRect((cols-2) * cellSize + 2, (rows-2) * cellSize + 2, cellSize - 4, cellSize - 4);

    // Draw player with level-based glow
    const centerX = Math.floor(player.x / cellSize) * cellSize + cellSize / 2;
    const centerY = Math.floor(player.y / cellSize) * cellSize + cellSize / 2;

    // Add glow effect
    ctx.shadowColor = `hsl(${startHue}, 70%, 50%)`;
    ctx.shadowBlur = 15;

    // Draw player circle
    ctx.fillStyle = `hsl(${startHue}, 70%, 50%)`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, player.size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Add white center for visibility
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(centerX, centerY, player.size / 4, 0, Math.PI * 2);
    ctx.fill();
}

function checkCollision(x, y) {
    const currentRow = Math.floor(y / cellSize);
    const currentCol = Math.floor(x / cellSize);

    // Check if the new position would be in a wall
    if (maze[currentRow][currentCol].isWall) {
        // Add 1 second penalty
        startTime -= 1000;
        // Reset player position
        player.x = cellSize;
        player.y = cellSize;
        return true;
    }
    return false;
}

function checkWin() {
    const currentRow = Math.floor(player.y / cellSize);
    const currentCol = Math.floor(player.x / cellSize);

    if (currentRow === rows-2 && currentCol === cols-2) {
        const winTimeSeconds = Math.floor((Date.now() - startTime) / 1000);

        // Increment level
        currentLevel++;

        // Generate new maze using pre-generated maze
        initializeMaze();

        // Save the new maze automatically
        saveMazeLayout();

        // Reset player to start position
        player.x = cellSize;
        player.y = cellSize;

        // Per-level timer for the next maze
        startTime = Date.now();
        elapsedTime = 0;
        timerElement.textContent = '0';
        currentScore = calculateScore(0);
        currentScoreElement.textContent = currentScore;

        // Update display
        drawMaze();

        // Show level completion message
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${currentLevel-1} Complete!`, canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px Arial';
        ctx.fillText(`Starting Level ${currentLevel}`, canvas.width / 2, canvas.height / 2 + 20);
        setTimeout(() => drawMaze(), 1500);

        return winTimeSeconds;
    }
    return false;
}

function calculateScore(timeSeconds) {
    const baseScore = 10000;
    const timeDeduction = timeSeconds * 10;
    const mazeComplexity = rows * cols;
    return Math.max(0, Math.floor((baseScore - timeDeduction) * (mazeComplexity / 100)));
}

function updateHighScores(newScore, timeSeconds = elapsedTime) {
    highScores.push({
        score: newScore,
        time: timeSeconds,
        date: new Date().toLocaleDateString()
    });

    // Sort by score (highest first) and keep only top 5
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5);

    // Save to localStorage
    localStorage.setItem('mazeRunnerHighScores', JSON.stringify(highScores));

    if (typeof ArcadeScores !== "undefined" && typeof ArcadeScores.record === "function") {
      ArcadeScores.record("maze", newScore);
    }

    // Update display
    displayHighScores();
}

function displayHighScores() {
    highScoresList.innerHTML = '';
    highScores.forEach((score, index) => {
        const li = document.createElement('li');
        li.textContent = `${score.score} points (${score.time}s) - ${score.date}`;
        if (index === highScores.length - 1 && score.score === currentScore) {
            li.classList.add('new-score');
        }
        highScoresList.appendChild(li);
    });
}

function showMazeToast(msg) {
    let el = document.getElementById('maze-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'maze-toast';
        el.className = 'maze-toast';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
        el.addEventListener('click', () => el.classList.remove('maze-toast--on'));
    }
    el.textContent = msg;
    el.classList.add('maze-toast--on');
    clearTimeout(showMazeToast._hide);
    showMazeToast._hide = setTimeout(() => el.classList.remove('maze-toast--on'), 6500);
}

function togglePause() {
    if (!gameStarted || gameWon) return;
    gamePaused = !gamePaused;
    if (gamePaused) {
        pauseStartTime = Date.now();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        pauseButton.textContent = '▶️';
    } else {
        startTime += (Date.now() - pauseStartTime);
        drawMaze();
        pauseButton.textContent = '⏸️';
    }
}

pauseButton.addEventListener('click', (e) => {
    e.preventDefault();
    togglePause();
});

function updateTimer() {
    if (gameStarted && !gameWon && !gamePaused) {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        timerElement.textContent = elapsedTime;

        // Update current score and level
        currentScore = calculateScore(elapsedTime);
        currentScoreElement.textContent = currentScore;
        currentLevelElement.textContent = currentLevel;
    }
}

function movePlayer(e) {
    handleMoveKey(e.code);
    if (e.code === 'KeyR' || e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Space') {
        e.preventDefault();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
}

function handleMoveKey(code) {
    if (code === 'KeyR') {
        restartGame();
        return;
    }
    if ((code === 'KeyP' || code === 'Escape') && gameStarted && !gameWon) {
        togglePause();
        return;
    }
    if (code === 'Space') {
        if (gameStarted && !gameWon) togglePause();
        return;
    }

    if (gameWon || gamePaused) return;

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        return;
    }

    const currentTime = Date.now();
    if (currentTime - lastMoveTime < 200) {
        return;
    }
    lastMoveTime = currentTime;

    if (!gameStarted) {
        gameStarted = true;
        startTime = Date.now();
    }

    const speed = cellSize;
    let newX = player.x;
    let newY = player.y;

    switch (code) {
        case 'ArrowUp':
            newY = Math.floor(player.y / cellSize) * cellSize - cellSize;
            break;
        case 'ArrowDown':
            newY = Math.floor(player.y / cellSize) * cellSize + cellSize;
            break;
        case 'ArrowLeft':
            newX = Math.floor(player.x / cellSize) * cellSize - cellSize;
            break;
        case 'ArrowRight':
            newX = Math.floor(player.x / cellSize) * cellSize + cellSize;
            break;
    }

    if (newX >= 0 && newX <= canvas.width - player.size &&
        newY >= 0 && newY <= canvas.height - player.size &&
        !checkCollision(newX, newY)) {
        player.x = newX;
        player.y = newY;

        const winTime = checkWin();
        if (winTime !== false) {
            const finalScore = calculateScore(winTime);
            updateHighScores(finalScore, winTime);
            if (typeof ArcadeScores === "undefined" || typeof ArcadeScores.record !== "function") {
                if (typeof ArcadeTokens !== "undefined" && ArcadeTokens.earnFromGameScore) {
                    ArcadeTokens.earnFromGameScore("maze", finalScore);
                }
            }
            showMazeToast(`You cleared the maze in ${winTime}s — nice run! (click to dismiss)`);
        }
    }

    drawMaze();
}

function pollMazeGamepad() {
    const GP = window.ArcadeGamepad;
    if (!GP) return;
    GP.update();
    if (GP.pressed("b") || GP.pressed("x")) restartGame();
    if (GP.pressed("start") || GP.pressed("y")) {
        if (gameStarted && !gameWon) togglePause();
    }
    const dir = GP.consumeDirection();
    if (dir) handleMoveKey(dir);
}

function restartGame() {
    player.x = cellSize;
    player.y = cellSize;
    gameStarted = false;
    gameWon = false;
    gamePaused = false;
    pauseButton.textContent = '⏸️';
    elapsedTime = 0;
    currentScore = 0;
    currentLevel = 1;
    timerElement.textContent = '0';
    currentScoreElement.textContent = '0';
    currentLevelElement.textContent = '1';
    initializeMaze();
    drawMaze();
}

// Event listeners
document.addEventListener('keydown', movePlayer);
restartButton.addEventListener('click', restartGame);

// Start game
initializeMaze();
drawMaze();

// Update timer
setInterval(updateTimer, 1000);

// Add path validation function
function validatePath(startRow, startCol, endRow, endCol) {
    const visited = new Set();
    const stack = [[startRow, startCol]];

    while (stack.length > 0) {
        const [row, col] = stack.pop();
        const key = `${row},${col}`;

        if (row === endRow && col === endCol) {
            return true;
        }

        if (visited.has(key)) continue;
        visited.add(key);

        // Check all adjacent cells
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        for (const [dy, dx] of directions) {
            const newRow = row + dy;
            const newCol = col + dx;
            if (newRow >= 0 && newRow < rows &&
                newCol >= 0 && newCol < cols &&
                !maze[newRow][newCol].isWall) {
                stack.push([newRow, newCol]);
            }
        }
    }
    return false;
}

// Initialize high scores display
displayHighScores();

// Initialize touch controls
initializeTouchControls();

(function mazeGamepadLoop() {
    pollMazeGamepad();
    requestAnimationFrame(mazeGamepadLoop);
})();
