// Mouse Pac-Man game implementation - PixiJS version
class MousePacmanGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        
        // Debug counters
        this.debugFrameCount = 0;
        this.debugUpdateCount = 0;
        this.debugCatStuckCount = {};
        this.debugLastCatPositions = {};
        this.height = canvas.height;
        
        // Check if this is a preview canvas (smaller)
        this.isPreview = this.width < 400;
        
        if (this.isPreview) {
            this.ctx = canvas.getContext('2d');
            this.graphics = null;
            this.spriteManager = null;
            this.nesEffects = null;
        } else {
            this.ctx = null;
            this.graphics = new GraphicsCore(canvas, {
                width: this.width,
                height: this.height,
                backgroundColor: 0x000000,
                pixelPerfect: true
            });
        }
        
        // Game state
        this.gameState = 'menu'; // menu, playing, paused, gameOver, ready
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.highScore = 0;
        
        // Maze dimensions (classic Pac-Man: 28x31)
        this.mazeCols = 28;
        this.mazeRows = 31;
        
        // Calculate tile size to fit maze in canvas
        if (this.isPreview) {
            this.tileSize = 6;
            this.mazeX = 10;
            this.mazeY = 10;
        } else {
            // Leave space for UI at top, fit maze in remaining space
            // Canvas is 800x600, need to fit 31 rows with UI space
            const uiSpace = 70;
            const availableHeight = this.height - uiSpace;
            const maxTileSize = Math.floor(availableHeight / this.mazeRows);
            this.tileSize = Math.min(maxTileSize, 16); // Max 16 to ensure it fits
            
            this.mazeX = (this.width - this.mazeCols * this.tileSize) / 2;
            this.mazeY = uiSpace; // Space for score/lives UI
        }
        
        // Maze data: 0=empty, 1=wall, 2=dot, 3=power pellet, 4=ghost house area
        this.maze = [];
        this.tunnelRow = 14; // Default, will be detected during maze initialization
        this.mouseStartPos = { x: 14, y: 23 }; // Default, will be set during initialization
        this.initializeMaze();
        
        // Mouse (player) properties - PURE GRID-BASED
        // Position will be set after maze initialization
        this.mouse = {
            x: 14, // Will be set to valid position
            y: 23, // Will be set to valid position
            direction: 0, // 0=right, 1=down, 2=left, 3=up
            nextDirection: 0, // Buffered input direction
            moveTimer: 0, // Timer for grid-based movement
            moveDelay: 150, // Milliseconds between moves (lower = faster)
            mouthFrame: 0, // Animation frame for chomping
            mouthFrameTime: 0
        };
        
        // Cats (enemies) - 4 cats with different behaviors
        this.cats = [];
        this.catStartPos = { x: 14, y: 14 }; // Ghost house center
        this.initializeCats();
        
        // Set mouse to valid starting position (found during maze init)
        this.mouse.x = this.mouseStartPos.x;
        this.mouse.y = this.mouseStartPos.y;
        
        // Power pellet mode
        this.powerModeActive = false;
        this.powerModeTimer = 0;
        this.powerModeDuration = 6000; // 6 seconds
        
        // Game timing
        this.lastTime = 0;
        this.readyTimer = 0;
        this.readyDuration = 2000; // 2 seconds "READY!" display
        
        // Animation
        this.animationTime = 0;
        
        // Effects
        if (this.isPreview) {
            this.particles = new ParticleSystem();
            this.screenEffects = new ScreenEffects(canvas);
            this.crtFilter = new CRTFilter(canvas);
        } else {
            this.particles = null;
            this.screenEffects = null;
            this.crtFilter = null;
        }
        
        // PixiJS sprites (only for main game)
        if (!this.isPreview) {
            this.mouseSprite = null;
            this.catSprites = [];
            this.mazeSprites = [];
            this.cheeseSprites = [];
            this.cheeseContainer = null;
            this.backgroundSprite = null;
        }
        
        // Input
        this.keys = {};
        this.setupInput();
        
        // If preview, draw static preview
        if (this.isPreview) {
            this.drawPreview();
            return;
        }
        
        // Start game loop
        this.animationFrameId = null;
        this.isDestroyed = false;
        this.gameLoop = this.gameLoop.bind(this);
        
        this.initGraphics();
    }
    
    initializeMaze() {
        // Classic Pac-Man maze layout (28x31 grid)
        // Using a simplified ASCII representation, then converting to data structure
        const mazeLayout = this.getClassicMazeLayout();
        
        this.maze = [];
        this.cheeseCount = 0;
        this.powerPelletCount = 0;
        
        for (let row = 0; row < this.mazeRows; row++) {
            this.maze[row] = [];
            for (let col = 0; col < this.mazeCols; col++) {
                const char = mazeLayout[row][col];
                let cellType = 0;
                
                if (char === '#' || char === '=') {
                    cellType = 1; // Wall
                } else if (char === '.') {
                    cellType = 2; // Small cheese dot
                    this.cheeseCount++;
                } else if (char === 'o' || char === 'O') {
                    cellType = 3; // Power pellet
                    this.powerPelletCount++;
                } else if (char === ' ') {
                    cellType = 0; // Empty corridor
                } else if (char === 'G') {
                    cellType = 0; // Ghost house (empty, no dots, but walkable)
                } else {
                    cellType = 0;
                }
                
                this.maze[row][col] = cellType;
            }
        }
        
        // Store initial counts for reset
        this.initialCheeseCount = this.cheeseCount;
        this.initialPowerPelletCount = this.powerPelletCount;
        
        // Detect tunnel row - look for row with dots and spaces on sides
        this.detectTunnelRow();
        
        // Find valid mouse starting position (bottom center, empty cell)
        this.findMouseStartPosition();
    }
    
    detectTunnelRow() {
        // Look for the tunnel row - this is the row with open corridors on both sides
        // The tunnel row typically has pattern like "      .            .      "
        // This means: spaces (0) on left AND right sides, with dots (2) in between, and NO walls blocking the path
        for (let row = 0; row < this.mazeRows; row++) {
            if (this.maze[row]) {
                // Check if first 6 columns are all empty (spaces) - left tunnel entrance
                let leftTunnelOpen = true;
                for (let col = 0; col <= 5; col++) {
                    if (this.maze[row][col] === 1) { // Wall blocks tunnel
                        leftTunnelOpen = false;
                        break;
                    }
                }
                
                // Check if last 6 columns are all empty (spaces) - right tunnel entrance
                let rightTunnelOpen = true;
                for (let col = this.mazeCols - 6; col < this.mazeCols; col++) {
                    if (this.maze[row][col] === 1) { // Wall blocks tunnel
                        rightTunnelOpen = false;
                        break;
                    }
                }
                
                // Check if there are dots in the middle (indicates this is the main tunnel row)
                let hasDots = false;
                for (let col = 6; col < this.mazeCols - 6; col++) {
                    if (this.maze[row][col] === 2 || this.maze[row][col] === 3) {
                        hasDots = true;
                        break;
                    }
                }
                
                // Tunnel row has: open left side, open right side, and dots in middle (not blocked by walls)
                if (leftTunnelOpen && rightTunnelOpen && hasDots) {
                    this.tunnelRow = row;
                    console.log(`[Tunnel] Detected tunnel row: ${row}`);
                    return;
                }
            }
        }
        // Fallback to row 14 if not found
        this.tunnelRow = 14;
        console.warn(`[Tunnel] Tunnel row not detected, using default: ${this.tunnelRow}`);
    }
    
    findMouseStartPosition() {
        // Find a valid starting position near bottom center
        // Try positions around (14, 23) first, then nearby positions
        const candidates = [
            { x: 14, y: 23 },
            { x: 13, y: 23 },
            { x: 15, y: 23 },
            { x: 14, y: 24 },
            { x: 14, y: 22 },
            { x: 13, y: 24 },
            { x: 15, y: 24 }
        ];
        
        for (const pos of candidates) {
            if (pos.y >= 0 && pos.y < this.mazeRows && 
                pos.x >= 0 && pos.x < this.mazeCols &&
                this.maze[pos.y] && 
                this.maze[pos.y][pos.x] !== 1) { // Not a wall
                this.mouseStartPos = { x: pos.x, y: pos.y };
                return;
            }
        }
        
        // Fallback: find any empty cell in bottom half
        for (let row = this.mazeRows - 1; row >= Math.floor(this.mazeRows / 2); row--) {
            for (let col = 10; col < 18; col++) {
                if (this.maze[row] && this.maze[row][col] !== 1) {
                    this.mouseStartPos = { x: col, y: row };
                    return;
                }
            }
        }
        
        // Ultimate fallback
        this.mouseStartPos = { x: 14, y: 23 };
    }
    
    getClassicMazeLayout() {
        // Different layouts for different levels
        const layoutIndex = (this.level - 1) % 2; // Alternate between 2 layouts
        
        if (layoutIndex === 0) {
            return this.getMazeLayout1();
        } else {
            return this.getMazeLayout2();
        }
    }
    
    getMazeLayout1() {
        // Classic Pac-Man maze layout (28 columns x 31 rows)
        // # = wall, . = small dot, o = power pellet, space = corridor, G = ghost house
        return [
            "############################",
            "#............##............#",
            "#.####.#####.##.#####.####.#",
            "#o####.#####.##.#####.####o#",
            "#.####.#####.##.#####.####.#",
            "#..........................#",
            "#.####.##.########.##.####.#",
            "#.####.##.########.##.####.#",
            "#......##....##....##......#",
            "######.##### ## #####.######",
            "     #.##### ## #####.#     ",
            "     #.##          ##.#     ",
            "     #.## ######## ##.#     ",
            "######.## ######## ##.######",
            "      .            .      ",
            "######.## ######## ##.######",
            "     #.## ######## ##.#     ",
            "     #.##          ##.#     ",
            "     #.## ######## ##.#     ",
            "######.## ######## ##.######",
            "#............##............#",
            "#.####.#####.##.#####.####.#",
            "#.####.#####.##.#####.####.#",
            "#o..##.......  .......##..o#",
            "###.##.##.########.##.##.###",
            "#......##....##....##......#",
            "#.##########.##.##########.#",
            "#.##########.##.##########.#",
            "#..........................#",
            "#.##########################",
            "############################"
        ];
    }
    
    getMazeLayout2() {
        // Alternative maze layout (28 columns x 31 rows)
        // Slightly different arrangement for variety
        // Removed ghost house (G) since cats don't use it
        return [
            "############################",
            "#............##............#",
            "#.####.#####.##.#####.####.#",
            "#o####.#####.##.#####.####o#",
            "#.####.#####.##.#####.####.#",
            "#......##....##....##......#",
            "######.##### ## #####.######",
            "     #.##### ## #####.#     ",
            "     #.##          ##.#     ",
            "     #.## ######## ##.#     ",
            "######.## ######## ##.######",
            "      .            .      ",
            "######.## ######## ##.######",
            "     #.## ######## ##.#     ",
            "     #.##          ##.#     ",
            "     #.## ######## ##.#     ",
            "######.## ######## ##.######",
            "#............##............#",
            "#.####.#####.##.#####.####.#",
            "#.####.#####.##.#####.####.#",
            "#o..##.......  .......##..o#",
            "###.##.##.########.##.##.###",
            "#......##....##....##......#",
            "#.##########.##.##########.#",
            "#.##########.##.##########.#",
            "#..........................#",
            "#.##########################",
            "############################"
        ];
    }
    
    initializeCats() {
        // Simple starting positions - scatter cats around the maze
        // Use valid corridor positions (not walls or dots)
        const startPositions = [
            { x: 13, y: 11, dir: 0 },  // Near center-top, facing right
            { x: 14, y: 11, dir: 2 },  // Near center-top, facing left
            { x: 13, y: 20, dir: 0 },  // Near center-bottom, facing right
            { x: 14, y: 20, dir: 2 }   // Near center-bottom, facing left
        ];
        
        this.cats = startPositions.map((pos, index) => ({
            x: pos.x, // Grid position only
            y: pos.y, // Grid position only
            direction: pos.dir,
            moveTimer: 0, // Timer for grid-based movement
            moveDelay: 180 + (index * 10), // Slightly different speeds per cat
            color: ['#ff0000', '#ffb8ff', '#00ffff', '#ffb851'][index],
            name: ['Blinky', 'Pinky', 'Inky', 'Clyde'][index],
            state: 'chase',
            respawnTimer: null
        }));
    }
    
    async initGraphics() {
        if (this.isPreview) return;
        
        if (this.graphics && typeof this.graphics.init === 'function') {
            await this.graphics.init();
        }
        
        if (!this.graphics || !this.graphics.isInitialized) {
            console.error('Graphics initialization failed, falling back to requestAnimationFrame');
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
            return;
        }
        
        if (!this.graphics.app || !this.graphics.app.renderer || !this.graphics.app.ticker) {
            console.error('Graphics app, renderer, or ticker not available');
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
            return;
        }
        
        this.finishGraphicsInit();
    }
    
    finishGraphicsInit() {
        this.spriteManager = new SpriteManager(this.graphics);
        this.nesEffects = this.graphics.getScreenEffects();
        this.screenEffects = this.nesEffects;
        
        this.initSprites();
        this.startGameLoop();
    }
    
    initSprites() {
        if (this.isPreview) return;
        this.updateMazeSprites();
        this.updateCheeseSprites();
        this.updateMouseSprite();
        this.updateCatSprites();
    }
    
    startGameLoop() {
        if (this.isPreview) {
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
            return;
        }
        
        const ticker = this.graphics.getTicker();
        if (ticker) {
            this.tickerCallback = (tickerObj) => {
                // PixiJS ticker provides deltaTime (1.0 = 1 frame at 60fps = ~16.67ms)
                // Convert to milliseconds and cap to prevent huge jumps
                const deltaMs = Math.min(Math.max(tickerObj.deltaTime * 16.67, 1), 100);
                this.gameLoop(deltaMs);
            };
            ticker.add(this.tickerCallback);
        } else {
            console.warn('PixiJS ticker not available, falling back to requestAnimationFrame');
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        }
    }
    
    setupInput() {
        this.keydownHandler = (e) => {
            // Don't handle input if modals are open
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal && nameEntryModal.classList.contains('active')) {
                return;
            }
            
            if (!this.isPreview) {
                const activeCanvas = document.getElementById('game-canvas');
                if (activeCanvas !== this.canvas) return;
            }
            
            this.keys[e.code] = true;
            
            // Menu/game controls
            if (e.code === 'Space') {
                if (this.gameState === 'menu') {
                    this.startGame();
                    e.preventDefault();
                } else if (this.gameState === 'gameOver') {
                    this.startGame();
                    e.preventDefault();
                } else if (this.gameState === 'playing' || this.gameState === 'ready') {
                    this.togglePause();
                    e.preventDefault();
                }
            }
            
            if (e.code === 'KeyP' && (this.gameState === 'playing' || this.gameState === 'ready' || this.gameState === 'paused')) {
                this.togglePause();
                e.preventDefault();
            }
            
            if (e.code === 'Space' && this.gameState === 'paused') {
                this.togglePause();
                e.preventDefault();
            }
            
            if (e.code === 'KeyR' && (this.gameState === 'playing' || this.gameState === 'paused' || this.gameState === 'gameOver' || this.gameState === 'ready')) {
                this.resetGame();
                e.preventDefault();
            }
            
            // Don't handle movement in menu/gameOver
            if (this.gameState !== 'playing' && this.gameState !== 'ready') return;
            
            // Movement input (buffered)
            if (e.code === 'ArrowUp') {
                this.mouse.nextDirection = 3;
                e.preventDefault();
            } else if (e.code === 'ArrowDown') {
                this.mouse.nextDirection = 1;
                e.preventDefault();
            } else if (e.code === 'ArrowLeft') {
                this.mouse.nextDirection = 2;
                e.preventDefault();
            } else if (e.code === 'ArrowRight') {
                this.mouse.nextDirection = 0;
                e.preventDefault();
            }
        };
        
        this.keyupHandler = (e) => {
            if (!this.isPreview) {
                const activeCanvas = document.getElementById('game-canvas');
                if (activeCanvas !== this.canvas) return;
            }
            
            this.keys[e.code] = false;
        };
        
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }
    
    startGame() {
        this.gameState = 'ready';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.readyTimer = 0;
        this.powerModeActive = false;
        this.powerModeTimer = 0;
        
        // Reset maze
        this.initializeMaze();
        
        // Reset mouse position
        this.mouse.x = 14;
        this.mouse.y = 23;
        this.mouse.direction = 0;
        this.mouse.moveTimer = 0;
        this.mouse.nextDirection = 0;
        
        // Reset cats
        this.initializeCats();
        
        if (!this.isPreview) {
            this.updateMazeSprites();
            this.updateCheeseSprites();
            this.updateMouseSprite();
            this.updateCatSprites();
        }
    }
    
    resetGame() {
        this.startGame();
    }
    
    togglePause() {
        if (this.gameState === 'playing' || this.gameState === 'ready') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
        }
    }
    
    gameOver() {
        if (this.isDestroyed) return;
        
        this.gameState = 'gameOver';
        
        const activeCanvas = document.getElementById('game-canvas');
        if (activeCanvas && activeCanvas === this.canvas) {
            if (highScoreManager.checkHighScore('mouse-pacman', this.score)) {
                highScoreManager.requestNameEntry('mouse-pacman', this.score);
            }
        }
    }
    
    // Placeholder methods - will implement next
    drawPreview() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = 'bold 16px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MOUSE', this.width / 2, this.height / 2 - 10);
        this.ctx.fillText('PAC-MAN', this.width / 2, this.height / 2 + 10);
    }
    
    updateMazeSprites() {
        if (this.isPreview || !this.graphics) return;
        
        // Remove old maze sprites
        this.mazeSprites.forEach(sprite => {
            if (sprite && sprite.parent) {
                sprite.parent.removeChild(sprite);
                sprite.destroy();
            }
        });
        this.mazeSprites = [];
        
        // House-themed wall colors - wood brown with darker outline
        const wallColor = 0x8b4513; // Saddle brown (wood)
        const wallOutline = 0x654321; // Darker brown (wood grain)
        const wallHighlight = 0xa0522d; // Sienna (wood highlight)
        const mazeGraphics = new PIXI.Graphics();
        
        // Draw walls with house theme (wood planks)
        for (let row = 0; row < this.mazeRows; row++) {
            for (let col = 0; col < this.mazeCols; col++) {
                if (this.maze[row][col] === 1) {
                    const x = this.mazeX + col * this.tileSize;
                    const y = this.mazeY + row * this.tileSize;
                    
                    // Wood plank effect
                    mazeGraphics.lineStyle(1, wallOutline, 0.8);
                    mazeGraphics.beginFill(wallColor);
                    mazeGraphics.drawRect(x, y, this.tileSize, this.tileSize);
                    mazeGraphics.endFill();
                    
                    // Add wood grain lines
                    mazeGraphics.lineStyle(0.5, wallHighlight, 0.4);
                    mazeGraphics.moveTo(x + 1, y + this.tileSize / 3);
                    mazeGraphics.lineTo(x + this.tileSize - 1, y + this.tileSize / 3);
                    mazeGraphics.moveTo(x + 1, y + (this.tileSize * 2) / 3);
                    mazeGraphics.lineTo(x + this.tileSize - 1, y + (this.tileSize * 2) / 3);
                }
            }
        }
        
        this.graphics.addToLayer(mazeGraphics, 'background');
        this.mazeSprites.push(mazeGraphics);
    }
    
    updateCheeseSprites() {
        if (this.isPreview || !this.graphics || !this.spriteManager) return;
        
        // Create container once if needed
        if (!this.cheeseContainer) {
            this.cheeseContainer = new PIXI.Container();
            this.graphics.addToLayer(this.cheeseContainer, 'foreground');
            this.cheeseSpriteMap = new Map(); // Map of "x,y" to sprite
        }
        
        // Update existing sprites or create new ones - don't recreate every frame
        const currentCheese = new Set();
        
        if (this.maze && this.maze.length > 0) {
            for (let row = 0; row < Math.min(this.mazeRows, this.maze.length); row++) {
                if (!this.maze[row]) continue;
                for (let col = 0; col < Math.min(this.mazeCols, this.maze[row].length); col++) {
                    const cell = this.maze[row][col];
                    const key = `${col},${row}`;
                    
                    if (cell === 2 || cell === 3) { // Cheese or power pellet
                        currentCheese.add(key);
                        
                        // Create sprite if it doesn't exist
                        if (!this.cheeseSpriteMap.has(key)) {
                            const x = this.mazeX + col * this.tileSize + this.tileSize / 2;
                            const y = this.mazeY + row * this.tileSize + this.tileSize / 2;
                            
                            let dot;
                            if (cell === 2) {
                                // Larger cheese dots
                                dot = this.spriteManager.createCircle(Math.max(3, this.tileSize * 0.15), 0xffff00);
                            } else {
                                // Larger power pellets
                                dot = this.spriteManager.createCircle(Math.max(6, this.tileSize * 0.25), 0xffff00);
                            }
                            
                            if (dot) {
                                dot.x = x;
                                dot.y = y;
                                this.cheeseContainer.addChild(dot);
                                this.cheeseSpriteMap.set(key, dot);
                            }
                        }
                        
                        // Update power pellet pulse
                        if (cell === 3) {
                            const sprite = this.cheeseSpriteMap.get(key);
                            if (sprite) {
                                const pulseSize = 4 + Math.sin((this.animationTime || 0) / 200) * 2;
                                sprite.scale.set(pulseSize / 4);
                            }
                        }
                    }
                }
            }
        }
        
        // Remove sprites for collected cheese
        for (const [key, sprite] of this.cheeseSpriteMap.entries()) {
            if (!currentCheese.has(key)) {
                if (sprite && sprite.parent) {
                    sprite.parent.removeChild(sprite);
                    sprite.destroy();
                }
                this.cheeseSpriteMap.delete(key);
            }
        }
    }
    
    updateMouseSprite() {
        if (this.isPreview || !this.graphics) return;
        if (!this.mouse) return;
        
        // Create sprite once, then just update position
        if (!this.mouseSprite) {
            this.createMouseSprite();
        }
        
        const mouse = this.mouse;
        const targetX = this.mazeX + mouse.x * this.tileSize;
        const targetY = this.mazeY + mouse.y * this.tileSize;
        
        // Smooth interpolation for position
        const smoothFactor = 0.3; // Adjust for smoothness (lower = smoother but slower)
        this.mouseSprite.x += (targetX - this.mouseSprite.x) * smoothFactor;
        this.mouseSprite.y += (targetY - this.mouseSprite.y) * smoothFactor;
        
        // Update rotation based on direction
        const mouseGraphics = this.mouseSprite.children[0];
        if (mouseGraphics) {
            let rotation = 0;
            if (mouse.direction === 1) rotation = Math.PI / 2; // Down
            else if (mouse.direction === 2) rotation = Math.PI; // Left
            else if (mouse.direction === 3) rotation = -Math.PI / 2; // Up
            mouseGraphics.rotation = rotation;
        }
    }
    
    createMouseSprite() {
        const centerX = this.tileSize / 2;
        const centerY = this.tileSize / 2;
        const bodySize = this.tileSize * 0.6; // Larger mouse
        
        // Create mouse sprite container
        const mouseContainer = new PIXI.Container();
        
        // Mouse colors - more realistic mouse colors
        const mouseBodyColor = 0xa0a0a0; // Light gray
        const mouseDarkColor = 0x707070; // Darker gray for shading
        const mouseEarColor = 0x808080; // Gray ears
        const mouseEarInner = 0xffb6c1; // Light pink inner ears
        const mouseNose = 0xff69b4; // Bright pink nose
        
        // Create graphics once
        const mouseGraphics = new PIXI.Graphics();
        mouseGraphics.pivot.set(centerX, centerY);
        mouseGraphics.x = centerX;
        mouseGraphics.y = centerY;
        
        // Draw body (larger, more mouse-like)
        mouseGraphics.beginFill(mouseBodyColor);
        mouseGraphics.drawEllipse(centerX, centerY, bodySize * 0.85, bodySize * 0.65);
        mouseGraphics.endFill();
        
        // Add shading to body
        mouseGraphics.beginFill(mouseDarkColor, 0.3);
        mouseGraphics.drawEllipse(centerX - bodySize * 0.1, centerY, bodySize * 0.7, bodySize * 0.5);
        mouseGraphics.endFill();
        
        // Draw larger ears (more prominent)
        const earSize = bodySize * 0.35;
        mouseGraphics.beginFill(mouseEarColor);
        mouseGraphics.drawCircle(centerX - bodySize * 0.35, centerY - bodySize * 0.35, earSize);
        mouseGraphics.drawCircle(centerX + bodySize * 0.35, centerY - bodySize * 0.35, earSize);
        mouseGraphics.endFill();
        
        // Inner ear (pink, larger)
        mouseGraphics.beginFill(mouseEarInner);
        mouseGraphics.drawCircle(centerX - bodySize * 0.35, centerY - bodySize * 0.35, earSize * 0.5);
        mouseGraphics.drawCircle(centerX + bodySize * 0.35, centerY - bodySize * 0.35, earSize * 0.5);
        mouseGraphics.endFill();
        
        // Draw snout (more pronounced)
        const snoutX = centerX + bodySize * 0.45;
        const snoutY = centerY;
        const mouthOpen = this.mouse.mouthFrame === 1 ? 0.7 : 0.4;
        
        // Mouth (chomping animation)
        mouseGraphics.beginFill(0x000000);
        mouseGraphics.drawEllipse(snoutX, snoutY, bodySize * 0.35 * mouthOpen, bodySize * 0.25);
        mouseGraphics.endFill();
        
        // Nose (bright pink, larger)
        mouseGraphics.beginFill(mouseNose);
        mouseGraphics.drawCircle(snoutX, snoutY - bodySize * 0.12, bodySize * 0.12);
        mouseGraphics.endFill();
        
        // Draw larger, more expressive eyes
        const eyeSize = Math.max(2, bodySize * 0.12);
        mouseGraphics.beginFill(0xffffff);
        mouseGraphics.drawCircle(centerX - bodySize * 0.2, centerY - bodySize * 0.15, eyeSize);
        mouseGraphics.drawCircle(centerX + bodySize * 0.15, centerY - bodySize * 0.15, eyeSize);
        mouseGraphics.endFill();
        mouseGraphics.beginFill(0x000000);
        mouseGraphics.drawCircle(centerX - bodySize * 0.2, centerY - bodySize * 0.15, eyeSize * 0.6);
        mouseGraphics.drawCircle(centerX + bodySize * 0.15, centerY - bodySize * 0.15, eyeSize * 0.6);
        mouseGraphics.endFill();
        
        // Draw whiskers (more mouse-like)
        mouseGraphics.lineStyle(1, mouseDarkColor, 0.6);
        mouseGraphics.moveTo(snoutX, snoutY - bodySize * 0.05);
        mouseGraphics.lineTo(snoutX + bodySize * 0.3, snoutY - bodySize * 0.1);
        mouseGraphics.moveTo(snoutX, snoutY);
        mouseGraphics.lineTo(snoutX + bodySize * 0.35, snoutY);
        mouseGraphics.moveTo(snoutX, snoutY + bodySize * 0.05);
        mouseGraphics.lineTo(snoutX + bodySize * 0.3, snoutY + bodySize * 0.1);
        
        // Draw tail (longer, more curved, mouse-like)
        mouseGraphics.lineStyle(Math.max(2, bodySize * 0.15), mouseDarkColor, 0.8);
        mouseGraphics.moveTo(centerX - bodySize * 0.4, centerY);
        mouseGraphics.quadraticCurveTo(
            centerX - bodySize * 1.2, centerY - bodySize * 0.2,
            centerX - bodySize * 1.5, centerY - bodySize * 0.5
        );
        
        mouseContainer.addChild(mouseGraphics);
        
        // Add to layer once
        this.graphics.addToLayer(mouseContainer, 'foreground');
        this.mouseSprite = mouseContainer;
    }
    
    updateCatSprites() {
        if (this.isPreview || !this.graphics) return;
        if (!this.cats || this.cats.length === 0) return;
        
        // Create cat sprites once if needed
        if (!this.catSprites || this.catSprites.length === 0) {
            this.catSprites = [];
            this.cats.forEach((cat, index) => {
                if (cat) {
                    const sprite = this.createCatSprite(cat, index);
                    this.catSprites.push(sprite);
                }
            });
        }
        
        // Update existing cat sprites (reuse, don't recreate)
        this.cats.forEach((cat, index) => {
            if (!cat || !this.catSprites[index]) return;
            
            const sprite = this.catSprites[index];
            const targetX = this.mazeX + cat.x * this.tileSize;
            const targetY = this.mazeY + cat.y * this.tileSize;
            
            // Smooth interpolation for position
            const smoothFactor = 0.25; // Slightly slower than mouse
            sprite.x += (targetX - sprite.x) * smoothFactor;
            sprite.y += (targetY - sprite.y) * smoothFactor;
            
            // Update visual state
            const catGraphics = sprite.children[0];
            if (catGraphics) {
                // Update color/state
                catGraphics.clear();
                const size = this.tileSize - 2;
                const radius = size / 2;
                
                if (cat.state === 'frightened') {
                    const flashTime = Math.floor(this.animationTime / 200) % 2;
                    catGraphics.beginFill(flashTime === 0 ? 0x2121de : 0xffffff);
                } else if (cat.state === 'eaten') {
                    catGraphics.beginFill(0x000000);
                } else {
                    const colorHex = parseInt(cat.color.replace('#', ''), 16);
                    catGraphics.beginFill(colorHex);
                }
                
                catGraphics.drawCircle(radius, radius, radius);
                catGraphics.endFill();
                
                // Eyes
                if (cat.state !== 'eaten') {
                    catGraphics.beginFill(0xffffff);
                    catGraphics.drawCircle(radius - 3, radius - 2, 2);
                    catGraphics.drawCircle(radius + 3, radius - 2, 2);
                    catGraphics.endFill();
                    catGraphics.beginFill(0x000000);
                    catGraphics.drawCircle(radius - 3, radius - 2, 1);
                    catGraphics.drawCircle(radius + 3, radius - 2, 1);
                    catGraphics.endFill();
                }
            }
        });
    }
    
    createCatSprite(cat, index) {
        const centerX = this.tileSize / 2;
        const centerY = this.tileSize / 2;
        const bodySize = this.tileSize * 0.65; // Larger cats
        
        const catContainer = new PIXI.Container();
        const catGraphics = new PIXI.Graphics();
        
        const colorHex = parseInt(cat.color.replace('#', ''), 16);
        const darkerColor = colorHex * 0.7; // Darker shade for depth
        
        // Draw cat body (more cat-like shape - rounded with slight point)
        catGraphics.beginFill(colorHex);
        // Main body (rounded rectangle/ellipse)
        catGraphics.drawEllipse(centerX, centerY, bodySize * 0.75, bodySize * 0.6);
        catGraphics.endFill();
        
        // Add body shading
        catGraphics.beginFill(darkerColor, 0.4);
        catGraphics.drawEllipse(centerX - bodySize * 0.1, centerY, bodySize * 0.6, bodySize * 0.5);
        catGraphics.endFill();
        
        // Draw ears (triangular, cat-like)
        const earSize = bodySize * 0.25;
        catGraphics.beginFill(colorHex);
        // Left ear
        catGraphics.moveTo(centerX - bodySize * 0.25, centerY - bodySize * 0.25);
        catGraphics.lineTo(centerX - bodySize * 0.5, centerY - bodySize * 0.5);
        catGraphics.lineTo(centerX - bodySize * 0.15, centerY - bodySize * 0.35);
        catGraphics.closePath();
        // Right ear
        catGraphics.moveTo(centerX + bodySize * 0.25, centerY - bodySize * 0.25);
        catGraphics.lineTo(centerX + bodySize * 0.5, centerY - bodySize * 0.5);
        catGraphics.lineTo(centerX + bodySize * 0.15, centerY - bodySize * 0.35);
        catGraphics.closePath();
        catGraphics.endFill();
        
        // Inner ear (pink)
        catGraphics.beginFill(0xffb6c1, 0.8);
        catGraphics.moveTo(centerX - bodySize * 0.25, centerY - bodySize * 0.3);
        catGraphics.lineTo(centerX - bodySize * 0.4, centerY - bodySize * 0.45);
        catGraphics.lineTo(centerX - bodySize * 0.2, centerY - bodySize * 0.35);
        catGraphics.closePath();
        catGraphics.moveTo(centerX + bodySize * 0.25, centerY - bodySize * 0.3);
        catGraphics.lineTo(centerX + bodySize * 0.4, centerY - bodySize * 0.45);
        catGraphics.lineTo(centerX + bodySize * 0.2, centerY - bodySize * 0.35);
        catGraphics.closePath();
        catGraphics.endFill();
        
        // Draw larger, more cat-like eyes
        const eyeSize = Math.max(2, bodySize * 0.15);
        catGraphics.beginFill(0xffffff);
        catGraphics.drawCircle(centerX - bodySize * 0.2, centerY - bodySize * 0.1, eyeSize);
        catGraphics.drawCircle(centerX + bodySize * 0.2, centerY - bodySize * 0.1, eyeSize);
        catGraphics.endFill();
        
        // Eye pupils (slit-like for cat)
        catGraphics.beginFill(0x000000);
        catGraphics.drawEllipse(centerX - bodySize * 0.2, centerY - bodySize * 0.1, eyeSize * 0.7, eyeSize * 0.3);
        catGraphics.drawEllipse(centerX + bodySize * 0.2, centerY - bodySize * 0.1, eyeSize * 0.7, eyeSize * 0.3);
        catGraphics.endFill();
        
        // Nose (small pink triangle)
        catGraphics.beginFill(0xff69b4);
        catGraphics.moveTo(centerX, centerY + bodySize * 0.05);
        catGraphics.lineTo(centerX - bodySize * 0.08, centerY + bodySize * 0.15);
        catGraphics.lineTo(centerX + bodySize * 0.08, centerY + bodySize * 0.15);
        catGraphics.closePath();
        catGraphics.endFill();
        
        // Mouth (small lines)
        catGraphics.lineStyle(1.5, 0x000000, 0.8);
        catGraphics.moveTo(centerX, centerY + bodySize * 0.15);
        catGraphics.lineTo(centerX - bodySize * 0.15, centerY + bodySize * 0.25);
        catGraphics.moveTo(centerX, centerY + bodySize * 0.15);
        catGraphics.lineTo(centerX + bodySize * 0.15, centerY + bodySize * 0.25);
        
        // Tail (curved, cat-like)
        catGraphics.lineStyle(Math.max(2, bodySize * 0.12), colorHex, 0.9);
        catGraphics.moveTo(centerX - bodySize * 0.3, centerY + bodySize * 0.2);
        catGraphics.quadraticCurveTo(
            centerX - bodySize * 0.6, centerY + bodySize * 0.4,
            centerX - bodySize * 0.5, centerY + bodySize * 0.5
        );
        
        catContainer.addChild(catGraphics);
        this.graphics.addToLayer(catContainer, 'foreground');
        return catContainer;
    }
    
    gameLoop(timeOrDelta) {
        if (this.isDestroyed) return;
        
        this.debugFrameCount++;
        
        let deltaTime;
        if (this.isPreview) {
            // Preview mode: timeOrDelta is a timestamp from requestAnimationFrame
            if (this.lastTime === 0) {
                this.lastTime = timeOrDelta;
                return;
            }
            deltaTime = timeOrDelta - this.lastTime;
            this.lastTime = timeOrDelta;
            // Cap deltaTime to prevent huge jumps
            deltaTime = Math.min(Math.max(deltaTime, 1), 100);
        } else {
            // Main game: timeOrDelta is already deltaTime in milliseconds from ticker
            deltaTime = timeOrDelta || 16.67;
            // Cap deltaTime to prevent huge jumps
            deltaTime = Math.min(Math.max(deltaTime, 1), 100);
        }
        
        // Log every 60 frames (once per second at 60fps)
        if (this.debugFrameCount % 60 === 0) {
            console.log(`[GameLoop] Frame ${this.debugFrameCount}, deltaTime: ${deltaTime.toFixed(2)}ms, state: ${this.gameState}`);
        }
        
        this.animationTime += deltaTime;
        
        try {
            if (this.gameState === 'playing') {
                this.update(deltaTime);
            } else if (this.gameState === 'ready') {
                this.readyTimer += deltaTime;
                if (this.readyTimer >= this.readyDuration) {
                    this.gameState = 'playing';
                    this.readyTimer = 0;
                }
            }
            
            // Update particles in preview mode
            if (this.isPreview && this.particles) {
                this.particles.update();
            }
            
            this.draw();
        } catch (error) {
            console.error('Error in game loop:', error);
            console.error('Stack:', error.stack);
            // Try to recover by resetting state
            if (this.gameState === 'playing') {
                this.gameState = 'ready';
            }
        }
        
        // Continue animation loop only for preview mode
        // Main game uses PixiJS ticker which calls this automatically
        if (this.isPreview) {
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        }
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        // Safety check
        if (!deltaTime || isNaN(deltaTime) || deltaTime <= 0) {
            console.warn('Invalid deltaTime:', deltaTime);
            deltaTime = 16.67;
        }
        
        try {
            // Update power mode timer
            if (this.powerModeActive) {
                this.powerModeTimer += deltaTime;
                if (this.powerModeTimer >= this.powerModeDuration) {
                    this.powerModeActive = false;
                    this.powerModeTimer = 0;
                    // Reset cat states
                    this.cats.forEach(cat => {
                        if (cat && cat.state === 'frightened') {
                            cat.state = 'chase';
                        }
                    });
                }
            }
            
            // Update mouse movement (grid-based)
            this.updateMouse(deltaTime);
            
            // Update cats (grid-based)
            this.updateCats(deltaTime);
            
            // Check collisions
            this.checkCollisions();
            
            // Debug: Log cat positions every 120 frames (2 seconds)
            if (this.debugUpdateCount % 120 === 0 && this.cats) {
                this.cats.forEach((cat, idx) => {
                    if (cat) {
                        const posKey = `${cat.x},${cat.y}`;
                        if (this.debugLastCatPositions[idx] === posKey) {
                            this.debugCatStuckCount[idx] = (this.debugCatStuckCount[idx] || 0) + 1;
                            if (this.debugCatStuckCount[idx] > 5) {
                                console.warn(`[Cat ${idx}] STUCK at (${cat.x}, ${cat.y}) for ${this.debugCatStuckCount[idx]} checks! State: ${cat.state}, Dir: ${cat.direction}`);
                            }
                        } else {
                            this.debugCatStuckCount[idx] = 0;
                        }
                        this.debugLastCatPositions[idx] = posKey;
                    }
                });
            }
            
            this.debugUpdateCount++;
            
            // Check win condition
            if (this.cheeseCount === 0 && this.powerPelletCount === 0) {
                this.nextLevel();
            }
        } catch (error) {
            console.error('Error in update:', error);
            console.error('deltaTime:', deltaTime);
            console.error('gameState:', this.gameState);
            console.error('Stack:', error.stack);
            // Don't throw - log and try to recover
            // Reset to safe state
            if (this.gameState === 'playing') {
                console.warn('Attempting recovery from update error...');
                this.gameState = 'ready';
                this.readyTimer = 0;
            }
        }
    }
    
    updateMouse(deltaTime) {
        const mouse = this.mouse;
        
        // Simple grid-based movement
        mouse.moveTimer += deltaTime;
        
        // Try to change direction if buffered
        if (mouse.nextDirection !== mouse.direction) {
            if (this.canMoveInDirection(mouse.x, mouse.y, mouse.nextDirection)) {
                mouse.direction = mouse.nextDirection;
            }
        }
        
        // Move one tile at a time
        if (mouse.moveTimer >= mouse.moveDelay) {
            mouse.moveTimer = 0;
            
            // Calculate next position
            let nextX = mouse.x;
            let nextY = mouse.y;
            
            if (mouse.direction === 0) nextX++; // Right
            else if (mouse.direction === 1) nextY++; // Down
            else if (mouse.direction === 2) nextX--; // Left
            else if (mouse.direction === 3) nextY--; // Up
            
            // Handle tunnel wraparound - instant teleport when crossing boundaries in tunnel row
            if (mouse.y === this.tunnelRow) {
                // In tunnel row - allow wraparound at boundaries
                if (mouse.direction === 2 && nextX < 0) {
                    // Moving left, going off left edge - wrap to right side
                    console.log(`[Mouse] Tunnel wrap LEFT: (${mouse.x}, ${mouse.y}) -> (${this.mazeCols - 1}, ${mouse.y})`);
                    nextX = this.mazeCols - 1;
                    nextY = mouse.y; // Keep same row
                } else if (mouse.direction === 0 && nextX >= this.mazeCols) {
                    // Moving right, going off right edge - wrap to left side
                    console.log(`[Mouse] Tunnel wrap RIGHT: (${mouse.x}, ${mouse.y}) -> (0, ${mouse.y})`);
                    nextX = 0;
                    nextY = mouse.y; // Keep same row
                }
            }
            
            // Check if can move (isValidCell handles tunnel wraparound)
            if (this.isValidCell(nextX, nextY)) {
                mouse.x = nextX;
                mouse.y = nextY;
                
                // Check cheese collection
                this.checkCheeseCollection(mouse.x, mouse.y);
                
                // Animate mouth
                mouse.mouthFrameTime += deltaTime;
                if (mouse.mouthFrameTime > 150) {
                    mouse.mouthFrame = (mouse.mouthFrame + 1) % 2;
                    mouse.mouthFrameTime = 0;
                }
            }
        }
        
        // Animate mouth even when not moving
        mouse.mouthFrameTime += deltaTime;
        if (mouse.mouthFrameTime > 150) {
            mouse.mouthFrame = (mouse.mouthFrame + 1) % 2;
            mouse.mouthFrameTime = 0;
        }
    }
    
    isValidCell(x, y) {
        // Safety checks
        if (!this.maze || !Array.isArray(this.maze)) {
            console.error('Maze array is invalid!');
            return false;
        }
        
        // Y bounds check
        if (y < 0 || y >= this.mazeRows) return false;
        
        // Check if we're in tunnel row and trying to wraparound
        const isTunnelRow = (y === this.tunnelRow);
        let actualX = x;
        
        // Handle X wraparound for tunnel - allow wrapping if in tunnel row
        if (x < 0) {
            if (isTunnelRow) {
                // In tunnel row - wrap to right side
                actualX = this.mazeCols - 1;
            } else {
                return false;
            }
        } else if (x >= this.mazeCols) {
            if (isTunnelRow) {
                // In tunnel row - wrap to left side
                actualX = 0;
            } else {
                return false;
            }
        }
        
        // Safety check for maze row
        if (!this.maze[y] || !Array.isArray(this.maze[y])) {
            console.error(`Maze row ${y} is invalid!`);
            return false;
        }
        
        // Safety check for maze bounds after wraparound
        if (actualX < 0 || actualX >= this.mazeCols) return false;
        if (this.maze[y][actualX] === undefined) return false;
        
        // Check if cell is a wall
        return this.maze[y][actualX] !== 1;
    }
    
    canMoveInDirection(x, y, direction) {
        // Normalize x if needed (for checking current position)
        if (x < 0) x = this.mazeCols - 1;
        if (x >= this.mazeCols) x = 0;
        if (y < 0 || y >= this.mazeRows) return false;
        
        // Calculate target cell based on direction
        let targetX = x;
        let targetY = y;
        
        if (direction === 0) targetX = x + 1; // Right
        else if (direction === 1) targetY = y + 1; // Down
        else if (direction === 2) targetX = x - 1; // Left
        else if (direction === 3) targetY = y - 1; // Up
        
        // Check if we're in tunnel row and trying to wrap
        const isTunnelRow = (y === this.tunnelRow);
        
        // Allow wraparound if in tunnel row and moving left/right out of bounds
        if (isTunnelRow && direction === 2 && targetX < 0) {
            // Moving left, wrapping to right
            return true;
        }
        if (isTunnelRow && direction === 0 && targetX >= this.mazeCols) {
            // Moving right, wrapping to left
            return true;
        }
        
        // Check if target cell is valid (this handles wraparound for tunnel)
        return this.isValidCell(targetX, targetY);
    }
    
    checkCheeseCollection(x, y) {
        // Handle wraparound
        if (x < 0) x = this.mazeCols - 1;
        if (x >= this.mazeCols) x = 0;
        if (y < 0 || y >= this.mazeRows) return;
        
        // Safety check
        if (!this.maze || !this.maze[y] || this.maze[y][x] === undefined) return;
        
        const cell = this.maze[y][x];
        
        if (cell === 2) { // Small cheese
            this.maze[y][x] = 0;
            this.cheeseCount--;
            this.score += 10;
            
            // Particle effect (only in preview mode for now)
            if (this.isPreview && this.particles) {
                const screenX = this.mazeX + x * this.tileSize + this.tileSize / 2;
                const screenY = this.mazeY + y * this.tileSize + this.tileSize / 2;
                this.particles.explode(screenX, screenY, 3, '#ffff00', 'spark');
            }
            
            if (!this.isPreview) {
                this.updateCheeseSprites();
            }
        } else if (cell === 3) { // Power pellet
            this.maze[y][x] = 0;
            this.powerPelletCount--;
            this.score += 50;
            this.activatePowerMode();
            
            // Particle effect (only in preview mode for now)
            if (this.isPreview && this.particles) {
                const screenX = this.mazeX + x * this.tileSize + this.tileSize / 2;
                const screenY = this.mazeY + y * this.tileSize + this.tileSize / 2;
                this.particles.explode(screenX, screenY, 10, '#ffff00', 'glow');
            }
            
            if (!this.isPreview) {
                this.updateCheeseSprites();
                if (this.screenEffects) {
                    this.screenEffects.flash('#ffff00', 10, 0.5);
                }
            }
        }
    }
    
    activatePowerMode() {
        this.powerModeActive = true;
        this.powerModeTimer = 0;
        this.catsEatenThisPower = 0; // Reset counter
        
        // Make all cats frightened
        if (this.cats) {
            this.cats.forEach(cat => {
                if (cat && cat.state !== 'eaten') {
                    cat.state = 'frightened';
                    // Reverse direction
                    cat.direction = (cat.direction + 2) % 4;
                }
            });
        }
    }
    
    updateCats(deltaTime) {
        if (!this.cats || !Array.isArray(this.cats)) return;
        
        this.cats.forEach((cat, index) => {
            if (!cat) return;
            
            // Handle eaten state
            if (cat.state === 'eaten') {
                if (!cat.respawnTimer) {
                    cat.respawnTimer = 3000; // 3 seconds
                }
                cat.respawnTimer -= deltaTime;
                if (cat.respawnTimer <= 0) {
                    // Respawn
                    const startPositions = [
                        { x: 13, y: 11 }, { x: 14, y: 11 },
                        { x: 13, y: 20 }, { x: 14, y: 20 }
                    ];
                    const pos = startPositions[index] || { x: 14, y: 14 };
                    cat.x = pos.x;
                    cat.y = pos.y;
                    cat.state = 'chase';
                    cat.respawnTimer = null;
                    cat.moveTimer = 0;
                }
                return; // Don't move when eaten
            }
            
            // Grid-based movement
            cat.moveTimer += deltaTime;
            
            if (cat.moveTimer >= cat.moveDelay) {
                cat.moveTimer = 0;
                
                // Choose direction based on state
                if (cat.state === 'frightened') {
                    this.chooseRandomDirection(cat);
                } else {
                    this.chooseChaseDirection(cat, index);
                }
                
                // Move in chosen direction
                let nextX = cat.x;
                let nextY = cat.y;
                
                if (cat.direction === 0) nextX++;
                else if (cat.direction === 1) nextY++;
                else if (cat.direction === 2) nextX--;
                else if (cat.direction === 3) nextY--;
                
                // Handle tunnel wraparound - instant teleport when crossing boundaries in tunnel row
                if (cat.y === this.tunnelRow) {
                    // In tunnel row - allow wraparound at boundaries
                    if (cat.direction === 2 && cat.x === 0) {
                        // Moving left from column 0 - wrap to right side
                        nextX = this.mazeCols - 1;
                    } else if (cat.direction === 0 && cat.x === this.mazeCols - 1) {
                        // Moving right from last column - wrap to left side
                        nextX = 0;
                    }
                }
                
                // Move if valid
                if (this.isValidCell(nextX, nextY)) {
                    cat.x = nextX;
                    cat.y = nextY;
                }
            }
        });
    }
    
    
    chooseChaseDirection(cat, index) {
        // Simple AI: pick direction toward mouse, but don't get stuck
        const targetX = this.mouse.x;
        const targetY = this.mouse.y;
        
        // Find valid directions
        const possibleDirs = [];
        for (let dir = 0; dir < 4; dir++) {
            if (this.canMoveInDirection(cat.x, cat.y, dir)) {
                possibleDirs.push(dir);
            }
        }
        
        if (possibleDirs.length === 0) {
            // Completely stuck - shouldn't happen, but pick random if it does
            cat.direction = Math.floor(Math.random() * 4);
            return;
        }
        
        // If only one direction available, take it immediately
        if (possibleDirs.length === 1) {
            cat.direction = possibleDirs[0];
            return;
        }
        
        // Choose direction closest to target
        let bestDir = possibleDirs[0];
        let bestDist = Infinity;
        
        // Also track current direction if it's still valid (prefer continuing forward)
        let currentDirValid = possibleDirs.includes(cat.direction);
        
        possibleDirs.forEach(dir => {
            let testX = cat.x;
            let testY = cat.y;
            if (dir === 0) testX++;
            else if (dir === 1) testY++;
            else if (dir === 2) testX--;
            else if (dir === 3) testY--;
            
            const dist = Math.abs(testX - targetX) + Math.abs(testY - targetY);
            
            // Prefer current direction if it's still good (reduces jitter)
            // But if mouse hasn't moved much, occasionally explore
            const preferCurrent = currentDirValid && dir === cat.direction;
            const adjustedDist = preferCurrent ? dist * 0.8 : dist;
            
            if (adjustedDist < bestDist) {
                bestDist = adjustedDist;
                bestDir = dir;
            }
        });
        
        cat.direction = bestDir;
        
        // If cat can't move toward mouse effectively, occasionally pick random direction to explore
        // This prevents cats from getting stuck when mouse stops
        if (bestDist > 10 && Math.random() < 0.15) {
            cat.direction = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
        }
    }
    
    chooseRandomDirection(cat) {
        // Random valid direction
        const possibleDirs = [];
        for (let dir = 0; dir < 4; dir++) {
            if (this.canMoveInDirection(cat.x, cat.y, dir)) {
                possibleDirs.push(dir);
            }
        }
        
        if (possibleDirs.length > 0) {
            cat.direction = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
        }
    }
    
    
    checkCollisions() {
        // Safety checks
        if (!this.mouse || !this.cats) return;
        if (isNaN(this.mouse.x) || isNaN(this.mouse.y)) return;
        
        // Check mouse-cat collisions - simple grid-based
        this.cats.forEach((cat, index) => {
            if (!cat) return;
            if (cat.state === 'eaten') return;
            if (isNaN(cat.x) || isNaN(cat.y)) return;
            
            // Simple grid collision - same tile = collision
            if (cat.x === this.mouse.x && cat.y === this.mouse.y) {
                if (cat.state === 'frightened') {
                    // Mouse eats cat
                    cat.state = 'eaten';
                    if (!this.catsEatenThisPower) this.catsEatenThisPower = 0;
                    this.catsEatenThisPower++;
                    const points = 200 * Math.pow(2, this.catsEatenThisPower - 1); // 200, 400, 800, 1600
                    this.score += points;
                    
                    // Particle effect (only in preview mode for now)
                    if (this.isPreview && this.particles) {
                        const screenX = this.mazeX + cat.x * this.tileSize + this.tileSize / 2;
                        const screenY = this.mazeY + cat.y * this.tileSize + this.tileSize / 2;
                        this.particles.explode(screenX, screenY, 15, cat.color, 'glow');
                    }
                } else if (cat.state !== 'eaten') {
                    // Mouse caught - lose life
                    this.loseLife();
                }
            }
        });
    }
    
    loseLife() {
        this.lives--;
        
        if (!this.isPreview && this.screenEffects) {
            this.screenEffects.shake(10, 10);
        }
        
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            // Reset positions
            this.mouse.x = this.mouseStartPos.x;
            this.mouse.y = this.mouseStartPos.y;
            this.mouse.direction = 0;
            this.mouse.moveTimer = 0;
            
            this.initializeCats();
            this.powerModeActive = false;
            this.powerModeTimer = 0;
            this.gameState = 'ready';
            this.readyTimer = 0;
        }
    }
    
    nextLevel() {
        this.level++;
        this.score += 1000; // Level bonus
        
        // Reset maze
        this.initializeMaze();
        
        // Reset positions (will be set by initializeMaze via findMouseStartPosition)
        this.mouse.x = this.mouseStartPos.x;
        this.mouse.y = this.mouseStartPos.y;
        this.mouse.direction = 0;
        this.mouse.moveTimer = 0;
        
        // Increase speed slightly (lower delay = faster)
        this.mouse.moveDelay = Math.max(100, this.mouse.moveDelay * 0.95);
        this.cats.forEach(cat => {
            cat.moveDelay = Math.max(120, cat.moveDelay * 0.95);
        });
        
        // Reset cats
        this.initializeCats();
        this.powerModeActive = false;
        this.powerModeTimer = 0;
        this.gameState = 'ready';
        this.readyTimer = 0;
        
        if (!this.isPreview) {
            // Force recreation by removing old sprites first
            if (this.mazeSprites && this.mazeSprites.length > 0) {
                this.mazeSprites.forEach(sprite => {
                    if (sprite && sprite.parent) {
                        sprite.parent.removeChild(sprite);
                        sprite.destroy();
                    }
                });
                this.mazeSprites = [];
            }
            
            if (this.cheeseContainer && this.cheeseSpriteMap) {
                this.cheeseSpriteMap.forEach(sprite => {
                    if (sprite && sprite.parent) {
                        sprite.parent.removeChild(sprite);
                        sprite.destroy();
                    }
                });
                this.cheeseSpriteMap.clear();
                if (this.cheeseContainer.parent) {
                    this.cheeseContainer.parent.removeChild(this.cheeseContainer);
                    this.cheeseContainer.destroy({ children: true });
                }
                this.cheeseContainer = null;
            }
            
            // Recreate all sprites for new level
            this.updateMazeSprites();
            this.updateCheeseSprites();
            this.updateMouseSprite();
            this.updateCatSprites();
        }
    }
    
    draw() {
        if (this.isDestroyed) return;
        
        if (this.isPreview) {
            this.drawCanvas2D();
            return;
        }
        
        this.drawPixi();
    }
    
    drawCanvas2D() {
        // Canvas 2D rendering for preview
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        if (this.gameState === 'menu') {
            this.drawMenu();
            return;
        }
        
        // Draw simple maze preview
        this.ctx.strokeStyle = '#2121de';
        this.ctx.lineWidth = 1;
        for (let row = 0; row < Math.min(5, this.mazeRows); row++) {
            for (let col = 0; col < Math.min(10, this.mazeCols); col++) {
                if (this.maze[row][col] === 1) {
                    const x = this.mazeX + col * this.tileSize;
                    const y = this.mazeY + row * this.tileSize;
                    this.ctx.fillStyle = '#2121de';
                    this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                } else if (this.maze[row][col] === 2) {
                    const x = this.mazeX + col * this.tileSize + this.tileSize / 2;
                    const y = this.mazeY + row * this.tileSize + this.tileSize / 2;
                    this.ctx.fillStyle = '#ffff00';
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 1, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
        
        // Draw simple mouse preview (gray oval with ears)
        const mouseX = this.mazeX + this.mouse.x * this.tileSize + this.tileSize / 2;
        const mouseY = this.mazeY + this.mouse.y * this.tileSize + this.tileSize / 2;
        const bodySize = this.tileSize / 3;
        
        this.ctx.fillStyle = '#c8c8c8';
        this.ctx.beginPath();
        this.ctx.ellipse(mouseX, mouseY, bodySize * 0.9, bodySize * 0.7, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Ears
        this.ctx.fillStyle = '#808080';
        this.ctx.beginPath();
        this.ctx.arc(mouseX - bodySize * 0.4, mouseY - bodySize * 0.4, bodySize * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(mouseX + bodySize * 0.4, mouseY - bodySize * 0.4, bodySize * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawPixi() {
        if (this.isPreview || !this.graphics || !this.graphics.isInitialized) return;
        
        // Maze and cheese should always be visible (background layer)
        // Only update if sprites don't exist yet
        if (!this.mazeSprites || this.mazeSprites.length === 0) {
            this.updateMazeSprites();
        }
        if (!this.cheeseContainer || !this.cheeseSpriteMap || this.cheeseSpriteMap.size === 0) {
            this.updateCheeseSprites();
        }
        
        // Update sprites (only if playing or ready)
        if (this.gameState === 'playing' || this.gameState === 'ready') {
            this.updateMouseSprite();
            this.updateCatSprites();
            // Update cheese sprites for pulsing power pellets
            this.updateCheeseSprites();
        }
        
        // Draw UI
        this.drawUIPixi();
    }
    
    drawUIPixi() {
        if (this.isPreview || !this.graphics) return;
        
        // Update stats panel instead of drawing on canvas
        this.updateStatsPanel();
        
        const uiLayer = this.graphics.getLayer('ui');
        if (!uiLayer) return;
        
        // Remove existing game state messages
        const children = uiLayer.children.slice();
        children.forEach(child => {
            if (child.userData && child.userData.isGameStateMessage) {
                uiLayer.removeChild(child);
            }
        });
        
        // Game state overlays
        if (this.gameState === 'menu') {
            this.drawMenuPixi(uiLayer);
        } else if (this.gameState === 'gameOver') {
            this.drawGameOverPixi(uiLayer);
        } else if (this.gameState === 'paused') {
            this.drawPausedPixi(uiLayer);
        } else if (this.gameState === 'ready') {
            this.drawReadyPixi(uiLayer);
        }
    }
    
    updateStatsPanel() {
        const statsPanel = document.getElementById('game-stats-panel');
        if (!statsPanel) return;
        
        const statsContent = statsPanel.querySelector('.stats-content');
        if (!statsContent) return;
        
        const highScore = highScoreManager.getTopScore('mouse-pacman');
        let livesHTML = '';
        for (let i = 0; i < this.lives; i++) {
            livesHTML += '● ';
        }
        
        statsContent.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Score</div>
                <div class="stat-value">${Utils.formatScore(this.score)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">High</div>
                <div class="stat-value">${Utils.formatScore(highScore)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Lives</div>
                <div class="stat-value">${livesHTML}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Level</div>
                <div class="stat-value">${this.level}</div>
            </div>
        `;
    }
    
    drawUIPixi() {
        if (this.isPreview || !this.graphics) return;
        
        // Update stats panel instead of drawing on canvas
        this.updateStatsPanel();
        
        const uiLayer = this.graphics.getLayer('ui');
        if (!uiLayer) return;
        
        // Remove existing game state messages
        const children = uiLayer.children.slice();
        children.forEach(child => {
            if (child.userData && child.userData.isGameStateMessage) {
                uiLayer.removeChild(child);
            }
        });
        
        // Game state overlays
        if (this.gameState === 'menu') {
            this.drawMenuPixi(uiLayer);
        } else if (this.gameState === 'gameOver') {
            this.drawGameOverPixi(uiLayer);
        } else if (this.gameState === 'paused') {
            this.drawPausedPixi(uiLayer);
        } else if (this.gameState === 'ready') {
            this.drawReadyPixi(uiLayer);
        }
    }
    
    drawMenuPixi(uiLayer) {
        // Semi-transparent overlay so game is visible behind menu
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.7);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
        overlay.userData = { isGameStateMessage: true };
        uiLayer.addChild(overlay);
        
        const titleStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 64,
            fill: 0xffff00,
            fontWeight: 'bold',
            align: 'center'
        });
        
        const title = new PIXI.Text('MOUSETRAP', titleStyle);
        title.anchor.set(0.5);
        title.x = this.width / 2;
        title.y = this.height / 2 - 100;
        title.userData = { isGameStateMessage: true };
        uiLayer.addChild(title);
        
        const instructionStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 20,
            fill: 0xffffff,
            align: 'center'
        });
        
        const instructions = [
            'Press SPACE to Start',
            'Arrow Keys: Move',
            'Eat all the cheese!',
            'Avoid the cats!'
        ];
        
        instructions.forEach((text, i) => {
            const instruction = new PIXI.Text(text, instructionStyle);
            instruction.anchor.set(0.5);
            instruction.x = this.width / 2;
            instruction.y = this.height / 2 + i * 30;
            instruction.userData = { isGameStateMessage: true };
            uiLayer.addChild(instruction);
        });
    }
    
    drawGameOverPixi(uiLayer) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.8);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
        overlay.userData = { isGameStateMessage: true };
        uiLayer.addChild(overlay);
        
        const gameOverStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 48,
            fill: 0xff0000,
            fontWeight: 'bold',
            align: 'center'
        });
        
        const gameOver = new PIXI.Text('GAME OVER', gameOverStyle);
        gameOver.anchor.set(0.5);
        gameOver.x = this.width / 2;
        gameOver.y = this.height / 2 - 50;
        gameOver.userData = { isGameStateMessage: true };
        uiLayer.addChild(gameOver);
        
        const infoStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 24,
            fill: 0xffffff,
            align: 'center'
        });
        
        const finalScore = new PIXI.Text(`Final Score: ${Utils.formatScore(this.score)}`, infoStyle);
        finalScore.anchor.set(0.5);
        finalScore.x = this.width / 2;
        finalScore.y = this.height / 2 + 20;
        finalScore.userData = { isGameStateMessage: true };
        uiLayer.addChild(finalScore);
        
        const restartStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 18,
            fill: 0xffff00,
            align: 'center'
        });
        
        const restart = new PIXI.Text('Press SPACE to Restart', restartStyle);
        restart.anchor.set(0.5);
        restart.x = this.width / 2;
        restart.y = this.height / 2 + 80;
        restart.userData = { isGameStateMessage: true };
        uiLayer.addChild(restart);
    }
    
    drawPausedPixi(uiLayer) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.7);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
        overlay.userData = { isGameStateMessage: true };
        uiLayer.addChild(overlay);
        
        const pauseStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 48,
            fill: 0xffff00,
            fontWeight: 'bold',
            align: 'center'
        });
        
        const paused = new PIXI.Text('PAUSED', pauseStyle);
        paused.anchor.set(0.5);
        paused.x = this.width / 2;
        paused.y = this.height / 2;
        paused.userData = { isGameStateMessage: true };
        uiLayer.addChild(paused);
        
        const resumeStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 18,
            fill: 0xffffff,
            align: 'center'
        });
        
        const resume = new PIXI.Text('Press P to Resume', resumeStyle);
        resume.anchor.set(0.5);
        resume.x = this.width / 2;
        resume.y = this.height / 2 + 40;
        resume.userData = { isGameStateMessage: true };
        uiLayer.addChild(resume);
    }
    
    drawReadyPixi(uiLayer) {
        const readyStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 36,
            fill: 0xffff00,
            fontWeight: 'bold',
            align: 'center'
        });
        
        const ready = new PIXI.Text('READY!', readyStyle);
        ready.anchor.set(0.5);
        ready.x = this.width / 2;
        ready.y = this.height / 2;
        ready.userData = { isGameStateMessage: true };
        uiLayer.addChild(ready);
    }
    
    drawMenu() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = 'bold 24px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MOUSETRAP', this.width / 2, this.height / 2 - 20);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.fillText('Press SPACE to Start', this.width / 2, this.height / 2 + 20);
    }
    
    cleanup() {
        this.isDestroyed = true;
        
        if (this.isPreview) {
            if (this.animationFrameId !== null) {
                cancelAnimationFrame(this.animationFrameId);
            }
        } else {
            if (this.graphics) {
                const ticker = this.graphics.getTicker();
                if (ticker && this.tickerCallback) {
                    ticker.remove(this.tickerCallback);
                }
                
                if (this.graphics.app) {
                    this.graphics.app.destroy(true, { children: true, texture: true, baseTexture: true });
                }
            }
            
            // Properly destroy sprites
            if (this.mouseSprite) {
                if (this.mouseSprite.parent) {
                    this.mouseSprite.parent.removeChild(this.mouseSprite);
                }
                this.mouseSprite.destroy({ children: true });
                this.mouseSprite = null;
            }
            
            if (this.catSprites) {
                this.catSprites.forEach(sprite => {
                    if (sprite && sprite.parent) {
                        sprite.parent.removeChild(sprite);
                    }
                    if (sprite) sprite.destroy({ children: true });
                });
                this.catSprites = [];
            }
            
            if (this.cheeseContainer) {
                if (this.cheeseSpriteMap) {
                    this.cheeseSpriteMap.forEach(sprite => {
                        if (sprite) sprite.destroy();
                    });
                    this.cheeseSpriteMap.clear();
                }
                if (this.cheeseContainer.parent) {
                    this.cheeseContainer.parent.removeChild(this.cheeseContainer);
                }
                this.cheeseContainer.destroy({ children: true });
                this.cheeseContainer = null;
            }
            
            if (this.mazeSprites) {
                this.mazeSprites.forEach(sprite => {
                    if (sprite && sprite.parent) {
                        sprite.parent.removeChild(sprite);
                    }
                    if (sprite) sprite.destroy();
                });
                this.mazeSprites = [];
            }
        }
        
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
        }
    }
}

// Initialize Mouse Pac-Man preview
function initMousePacman() {
    const canvas = document.getElementById('mouse-pacman-preview');
    if (canvas) {
        new MousePacmanGame(canvas);
    }
}
