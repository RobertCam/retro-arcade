// Mouse Pac-Man game implementation - PixiJS version
class MousePacmanGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
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
        this.initializeMaze();
        
        // Mouse (player) properties
        this.mouse = {
            x: 14, // Start position in grid (center)
            y: 23, // Start position in grid
            direction: 0, // 0=right, 1=down, 2=left, 3=up
            nextDirection: 0, // Buffered input direction
            speed: 0.12, // Tiles per frame (classic Pac-Man speed)
            position: { x: 14, y: 23 }, // Pixel position for smooth movement
            mouthFrame: 0, // Animation frame for chomping
            mouthFrameTime: 0
        };
        
        // Cats (enemies) - 4 cats with different behaviors
        this.cats = [];
        this.catStartPos = { x: 14, y: 14 }; // Ghost house center
        this.initializeCats();
        
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
            "     #.## ###GG### ##.#     ",
            "######.## #      # ##.######",
            "      .   # GGGG #   .      ",
            "######.## #      # ##.######",
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
            "     #.## ###GG### ##.#     ",
            "######.## #      # ##.######",
            "      .   # GGGG #   .      ",
            "######.## #      # ##.######",
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
            "############################",
            "#..........................#",
            "#.##########################",
            "############################"
        ];
    }
    
    initializeCats() {
        this.cats = [
            {
                x: 13, y: 14,
                position: { x: 13, y: 14 },
                direction: 3, // Face up to exit
                nextDirection: 3,
                speed: 0.095, // Slightly slower than mouse
                color: '#ff0000', // Red - aggressive chaser
                name: 'Blinky',
                state: 'chase', // chase, scatter, frightened, eaten
                targetX: 0,
                targetY: 0,
                inHouse: true,
                houseTimer: 0 // Exit immediately
            },
            {
                x: 14, y: 14,
                position: { x: 14, y: 14 },
                direction: 2,
                nextDirection: 2,
                speed: 0.095,
                color: '#ffb8ff', // Pink - ambusher
                name: 'Pinky',
                state: 'chase',
                targetX: 0,
                targetY: 0,
                inHouse: true,
                houseTimer: 3000 // Stay in house for 3 seconds
            },
            {
                x: 13, y: 15,
                position: { x: 13, y: 15 },
                direction: 0,
                nextDirection: 0,
                speed: 0.085, // Slower
                color: '#00ffff', // Cyan - random
                name: 'Inky',
                state: 'chase',
                targetX: 0,
                targetY: 0,
                inHouse: true,
                houseTimer: 6000 // Stay longer
            },
            {
                x: 14, y: 15,
                position: { x: 14, y: 15 },
                direction: 0,
                nextDirection: 0,
                speed: 0.085, // Slower
                color: '#ffb851', // Orange - random
                name: 'Clyde',
                state: 'chase',
                targetX: 0,
                targetY: 0,
                inHouse: true,
                houseTimer: 9000 // Stay longest
            }
        ];
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
            this.tickerCallback = (deltaTime) => {
                this.gameLoop(performance.now());
            };
            ticker.add(this.tickerCallback);
        } else {
            console.warn('PixiJS ticker not available, falling back to requestAnimationFrame');
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        }
    }
    
    setupInput() {
        this.keydownHandler = (e) => {
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
        this.mouse.position.x = 14;
        this.mouse.position.y = 23;
        this.mouse.direction = 0;
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
            }
        });
        this.mazeSprites = [];
        
        const wallColor = 0x2121de; // Classic Pac-Man blue
        const mazeGraphics = new PIXI.Graphics();
        
        // Draw walls
        for (let row = 0; row < this.mazeRows; row++) {
            for (let col = 0; col < this.mazeCols; col++) {
                if (this.maze[row][col] === 1) {
                    const x = this.mazeX + col * this.tileSize;
                    const y = this.mazeY + row * this.tileSize;
                    mazeGraphics.beginFill(wallColor);
                    mazeGraphics.drawRect(x, y, this.tileSize, this.tileSize);
                    mazeGraphics.endFill();
                }
            }
        }
        
        this.graphics.addToLayer(mazeGraphics, 'background');
        this.mazeSprites.push(mazeGraphics);
    }
    
    updateCheeseSprites() {
        if (this.isPreview || !this.graphics || !this.spriteManager) return;
        
        // Get or create cheese container
        let cheeseContainer = this.cheeseContainer;
        if (!cheeseContainer) {
            cheeseContainer = new PIXI.Container();
            this.cheeseContainer = cheeseContainer;
            this.graphics.addToLayer(cheeseContainer, 'foreground');
        }
        
        // Remove all children and rebuild
        cheeseContainer.removeChildren();
        this.cheeseSprites = [];
        
        // Draw cheese dots
        if (this.maze && this.maze.length > 0) {
            for (let row = 0; row < Math.min(this.mazeRows, this.maze.length); row++) {
                if (!this.maze[row]) continue;
                for (let col = 0; col < Math.min(this.mazeCols, this.maze[row].length); col++) {
                    const cell = this.maze[row][col];
                    if (cell === 2) { // Small cheese
                        const x = this.mazeX + col * this.tileSize + this.tileSize / 2;
                        const y = this.mazeY + row * this.tileSize + this.tileSize / 2;
                        const dot = this.spriteManager.createCircle(2, 0xffff00);
                        if (dot) {
                            dot.x = x;
                            dot.y = y;
                            cheeseContainer.addChild(dot);
                            this.cheeseSprites.push(dot);
                        }
                    } else if (cell === 3) { // Power pellet
                        const x = this.mazeX + col * this.tileSize + this.tileSize / 2;
                        const y = this.mazeY + row * this.tileSize + this.tileSize / 2;
                        // Pulsing effect for power pellet
                        const pulseSize = 4 + Math.sin((this.animationTime || 0) / 200) * 2;
                        const dot = this.spriteManager.createCircle(pulseSize, 0xffff00);
                        if (dot) {
                            dot.x = x;
                            dot.y = y;
                            cheeseContainer.addChild(dot);
                            this.cheeseSprites.push(dot);
                        }
                    }
                }
            }
        }
    }
    
    updateMouseSprite() {
        if (this.isPreview || !this.graphics) return;
        if (!this.mouse) return;
        if (!this.mouse.position) {
            this.mouse.position = { x: this.mouse.x || 0, y: this.mouse.y || 0 };
        }
        
        // Remove old mouse sprite
        if (this.mouseSprite && this.mouseSprite.parent) {
            this.mouseSprite.parent.removeChild(this.mouseSprite);
        }
        
        const mouse = this.mouse;
        // Clamp position to valid ranges to prevent glitches
        const posX = Math.max(0, Math.min(this.mazeCols - 1, mouse.position.x || mouse.x || 0));
        const posY = Math.max(0, Math.min(this.mazeRows - 1, mouse.position.y || mouse.y || 0));
        const screenX = this.mazeX + posX * this.tileSize;
        const screenY = this.mazeY + posY * this.tileSize;
        const centerX = this.tileSize / 2;
        const centerY = this.tileSize / 2;
        const bodySize = this.tileSize / 2 - 2;
        
        // Create mouse sprite container
        const mouseContainer = new PIXI.Container();
        
        // Mouse body color - light gray/brown
        const mouseColor = 0xc8c8c8;
        const mouseDark = 0x808080;
        
        // Calculate rotation based on direction (mouse faces right by default)
        let rotation = 0;
        if (mouse.direction === 1) rotation = Math.PI / 2; // Down
        else if (mouse.direction === 2) rotation = Math.PI; // Left
        else if (mouse.direction === 3) rotation = -Math.PI / 2; // Up
        
        // Draw mouse body (always drawn facing right, then rotated)
        const mouseGraphics = new PIXI.Graphics();
        
        // Draw body (oval)
        mouseGraphics.beginFill(mouseColor);
        mouseGraphics.drawEllipse(centerX, centerY, bodySize * 0.9, bodySize * 0.7);
        mouseGraphics.endFill();
        
        // Draw ears (on top when facing right)
        mouseGraphics.beginFill(mouseDark);
        mouseGraphics.drawCircle(centerX - bodySize * 0.4, centerY - bodySize * 0.4, bodySize * 0.3);
        mouseGraphics.drawCircle(centerX + bodySize * 0.4, centerY - bodySize * 0.4, bodySize * 0.3);
        mouseGraphics.endFill();
        
        // Inner ear (pink)
        mouseGraphics.beginFill(0xffc0cb);
        mouseGraphics.drawCircle(centerX - bodySize * 0.4, centerY - bodySize * 0.4, bodySize * 0.15);
        mouseGraphics.drawCircle(centerX + bodySize * 0.4, centerY - bodySize * 0.4, bodySize * 0.15);
        mouseGraphics.endFill();
        
        // Draw snout/mouth opening (chomping animation) - on the right side when facing right
        const mouthOpen = mouse.mouthFrame === 1 ? 0.6 : 0.3;
        mouseGraphics.beginFill(0x000000);
        
        const snoutX = centerX + bodySize * 0.5; // Right side
        const snoutY = centerY;
        const mouthWidth = bodySize * 0.4 * mouthOpen;
        const mouthHeight = bodySize * 0.25;
        
        mouseGraphics.drawEllipse(snoutX, snoutY, mouthWidth, mouthHeight);
        mouseGraphics.endFill();
        
        // Draw nose (on snout)
        mouseGraphics.beginFill(0xff69b4); // Pink nose
        mouseGraphics.drawCircle(snoutX, snoutY - bodySize * 0.1, bodySize * 0.1);
        mouseGraphics.endFill();
        
        // Draw eyes
        mouseGraphics.beginFill(0x000000);
        mouseGraphics.drawCircle(centerX - bodySize * 0.2, centerY - bodySize * 0.1, 2);
        mouseGraphics.drawCircle(centerX + bodySize * 0.1, centerY - bodySize * 0.1, 2);
        mouseGraphics.endFill();
        
        // Draw tail (curved line on left when facing right)
        mouseGraphics.lineStyle(3, mouseDark);
        mouseGraphics.moveTo(centerX, centerY);
        mouseGraphics.quadraticCurveTo(
            centerX - bodySize * 1.1, centerY - bodySize * 0.3,
            centerX - bodySize * 1.2, centerY - bodySize * 0.6
        );
        
        // Apply rotation to the entire graphics object (rotate around center)
        mouseGraphics.rotation = rotation;
        mouseGraphics.pivot.set(centerX, centerY);
        mouseGraphics.x = centerX;
        mouseGraphics.y = centerY;
        
        mouseContainer.addChild(mouseGraphics);
        mouseContainer.x = screenX;
        mouseContainer.y = screenY;
        
        this.graphics.addToLayer(mouseContainer, 'foreground');
        this.mouseSprite = mouseContainer;
    }
    
    updateCatSprites() {
        if (this.isPreview || !this.graphics) return;
        if (!this.cats || this.cats.length === 0) return;
        
        // Remove old cat sprites
        if (this.catSprites) {
            this.catSprites.forEach(sprite => {
                if (sprite && sprite.parent) {
                    sprite.parent.removeChild(sprite);
                }
            });
        }
        this.catSprites = [];
        
        const catContainer = new PIXI.Container();
        
        this.cats.forEach((cat, index) => {
            if (!cat) return;
            // Draw cats even when in house (just at house position)
            const catX = cat.inHouse ? this.catStartPos.x : cat.x;
            const catY = cat.inHouse ? this.catStartPos.y : cat.y;
            
            // Use position for smooth movement if available, otherwise use grid position
            // Clamp positions to prevent glitches
            let posX = cat.position ? cat.position.x : catX;
            let posY = cat.position ? cat.position.y : catY;
            posX = Math.max(0, Math.min(this.mazeCols - 1, posX));
            posY = Math.max(0, Math.min(this.mazeRows - 1, posY));
            const screenX = this.mazeX + posX * this.tileSize;
            const screenY = this.mazeY + posY * this.tileSize;
            const centerX = this.tileSize / 2;
            const centerY = this.tileSize / 2;
            const size = this.tileSize - 2;
            
            const catGraphics = new PIXI.Graphics();
            
            if (cat.state === 'frightened') {
                // Blue flashing when frightened
                const flashTime = Math.floor(this.animationTime / 200) % 2;
                catGraphics.beginFill(flashTime === 0 ? 0x2121de : 0xffffff);
            } else if (cat.state === 'eaten') {
                // Just eyes when eaten
                catGraphics.beginFill(0x000000);
            } else {
                // Normal cat color
                const colorHex = parseInt(cat.color.replace('#', ''), 16);
                catGraphics.beginFill(colorHex);
            }
            
            // Draw cat body (more cat-like shape)
            const radius = size / 2;
            // Main body (oval)
            catGraphics.drawEllipse(centerX, centerY, size * 0.8, size * 0.6);
            catGraphics.endFill();
            
            // Draw ears
            if (cat.state !== 'eaten') {
                const earColor = parseInt(cat.color.replace('#', ''), 16);
                catGraphics.beginFill(earColor);
                // Left ear
                catGraphics.moveTo(centerX - size * 0.3, centerY - size * 0.3);
                catGraphics.lineTo(centerX - size * 0.5, centerY - size * 0.5);
                catGraphics.lineTo(centerX - size * 0.2, centerY - size * 0.4);
                catGraphics.closePath();
                // Right ear
                catGraphics.moveTo(centerX + size * 0.3, centerY - size * 0.3);
                catGraphics.lineTo(centerX + size * 0.5, centerY - size * 0.5);
                catGraphics.lineTo(centerX + size * 0.2, centerY - size * 0.4);
                catGraphics.closePath();
                catGraphics.endFill();
            }
            
            // Draw tail
            if (cat.state !== 'eaten') {
                const tailColor = parseInt(cat.color.replace('#', ''), 16);
                catGraphics.lineStyle(3, tailColor);
                catGraphics.moveTo(centerX - size * 0.4, centerY + size * 0.2);
                catGraphics.quadraticCurveTo(
                    centerX - size * 0.6, centerY + size * 0.4,
                    centerX - size * 0.5, centerY + size * 0.5
                );
            }
            
            // Draw eyes
            catGraphics.beginFill(0xffffff);
            if (cat.state === 'eaten') {
                // Just eyes when eaten
                catGraphics.drawCircle(centerX - size * 0.2, centerY, 2);
                catGraphics.drawCircle(centerX + size * 0.2, centerY, 2);
            } else {
                // Two eyes based on direction
                if (cat.direction === 0 || cat.direction === 2) {
                    // Looking left/right
                    catGraphics.drawCircle(centerX - size * 0.25, centerY - size * 0.1, 2);
                    catGraphics.drawCircle(centerX + size * 0.25, centerY - size * 0.1, 2);
                } else {
                    // Looking up/down
                    catGraphics.drawCircle(centerX - size * 0.2, centerY - size * 0.15, 2);
                    catGraphics.drawCircle(centerX + size * 0.2, centerY - size * 0.15, 2);
                }
            }
            catGraphics.endFill();
            
            // Draw pupils
            catGraphics.beginFill(0x000000);
            if (cat.state !== 'eaten') {
                let pupilOffsetX = 0;
                let pupilOffsetY = 0;
                if (cat.direction === 0) pupilOffsetX = 1; // Right
                else if (cat.direction === 1) pupilOffsetY = 1; // Down
                else if (cat.direction === 2) pupilOffsetX = -1; // Left
                else if (cat.direction === 3) pupilOffsetY = -1; // Up
                
                if (cat.direction === 0 || cat.direction === 2) {
                    catGraphics.drawCircle(centerX - size * 0.25 + pupilOffsetX, centerY - size * 0.1 + pupilOffsetY, 1);
                    catGraphics.drawCircle(centerX + size * 0.25 + pupilOffsetX, centerY - size * 0.1 + pupilOffsetY, 1);
                } else {
                    catGraphics.drawCircle(centerX - size * 0.2 + pupilOffsetX, centerY - size * 0.15 + pupilOffsetY, 1);
                    catGraphics.drawCircle(centerX + size * 0.2 + pupilOffsetX, centerY - size * 0.15 + pupilOffsetY, 1);
                }
            } else {
                catGraphics.drawCircle(centerX - size * 0.2, centerY, 1);
                catGraphics.drawCircle(centerX + size * 0.2, centerY, 1);
            }
            catGraphics.endFill();
            
            catGraphics.x = screenX;
            catGraphics.y = screenY;
            
            catContainer.addChild(catGraphics);
            this.catSprites.push(catGraphics);
        });
        
        this.graphics.addToLayer(catContainer, 'foreground');
    }
    
    gameLoop(currentTime) {
        if (this.isDestroyed) return;
        
        if (this.lastTime === 0) {
            this.lastTime = currentTime;
            return;
        }
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        this.animationTime += deltaTime;
        
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
        
        // Continue animation loop only for preview mode
        // Main game uses PixiJS ticker which calls this automatically
        if (this.isPreview) {
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        }
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        // Update power mode timer
        if (this.powerModeActive) {
            this.powerModeTimer += deltaTime;
            if (this.powerModeTimer >= this.powerModeDuration) {
                this.powerModeActive = false;
                this.powerModeTimer = 0;
                // Reset cat states
                this.cats.forEach(cat => {
                    if (cat.state === 'frightened') {
                        cat.state = 'chase';
                    }
                });
            }
        }
        
        // Update mouse movement
        this.updateMouse(deltaTime);
        
        // Update cats
        this.updateCats(deltaTime);
        
        // Check collisions
        this.checkCollisions();
        
        // Check win condition
        if (this.cheeseCount === 0 && this.powerPelletCount === 0) {
            this.nextLevel();
        }
    }
    
    updateMouse(deltaTime) {
        const mouse = this.mouse;
        
        // Ensure position is valid
        if (!mouse.position || isNaN(mouse.position.x) || isNaN(mouse.position.y)) {
            mouse.position = { x: mouse.x || 14, y: mouse.y || 23 };
        }
        
        // Clamp position to valid range
        mouse.position.x = Math.max(0, Math.min(this.mazeCols - 1, mouse.position.x));
        mouse.position.y = Math.max(0, Math.min(this.mazeRows - 1, mouse.position.y));
        
        // Get current grid position
        const currentGridX = Math.round(mouse.position.x);
        const currentGridY = Math.round(mouse.position.y);
        
        // Try to change direction if buffered (only when aligned to grid center)
        const alignedX = Math.abs(mouse.position.x - currentGridX) < 0.2;
        const alignedY = Math.abs(mouse.position.y - currentGridY) < 0.2;
        const isAligned = (mouse.direction === 0 || mouse.direction === 2) ? alignedX : alignedY;
        
        if (mouse.nextDirection !== mouse.direction && isAligned) {
            // Check if we can move in the new direction from current grid position
            if (this.canMoveInDirection(currentGridX, currentGridY, mouse.nextDirection)) {
                mouse.direction = mouse.nextDirection;
                // Snap to exact grid center when changing direction
                mouse.position.x = currentGridX;
                mouse.position.y = currentGridY;
            }
        }
        
        // Move mouse
        const moveSpeed = mouse.speed * (deltaTime / 16.67); // Normalize to 60fps
        
        // Calculate the target cell we're trying to move into
        let targetGridX = currentGridX;
        let targetGridY = currentGridY;
        
        if (mouse.direction === 0) targetGridX = currentGridX + 1; // Right
        else if (mouse.direction === 1) targetGridY = currentGridY + 1; // Down
        else if (mouse.direction === 2) targetGridX = currentGridX - 1; // Left
        else if (mouse.direction === 3) targetGridY = currentGridY - 1; // Up
        
        // Check if we're in a tunnel row (row 14)
        const tunnelRows = [14];
        const isTunnelRow = tunnelRows.includes(currentGridY);
        // Tunnel area is at x <= 5 or x >= 22 on row 14
        const isInTunnelArea = isTunnelRow && (currentGridX <= 5 || currentGridX >= 22);
        
        // Handle wraparound for target
        let canMove = false;
        
        // If in tunnel area and trying to wrap, always allow it
        if (isInTunnelArea && (targetGridX < 0 || targetGridX >= this.mazeCols)) {
            canMove = true;
            // Adjust target for wraparound
            if (targetGridX < 0) targetGridX = this.mazeCols - 1;
            if (targetGridX >= this.mazeCols) targetGridX = 0;
        } else {
            // Normal movement - handle wraparound first
            if (targetGridX < 0) targetGridX = this.mazeCols - 1;
            if (targetGridX >= this.mazeCols) targetGridX = 0;
            // Then check if target cell is valid (not a wall)
            canMove = this.isValidCell(targetGridX, targetGridY);
        }
        
        if (canMove) {
            // Calculate new position
            let newX = mouse.position.x;
            let newY = mouse.position.y;
            
            if (mouse.direction === 0) newX += moveSpeed;
            else if (mouse.direction === 1) newY += moveSpeed;
            else if (mouse.direction === 2) newX -= moveSpeed;
            else if (mouse.direction === 3) newY -= moveSpeed;
            
            // Handle wraparound - check if we've crossed the boundary
            // For tunnel row 14, check if we're in tunnel area and trying to wrap
            if (isTunnelRow && (currentGridX <= 5 || currentGridX >= 22)) {
                // In tunnel area - instant wraparound when crossing boundary
                if (newX < -0.5) {
                    // Wrapped left to right
                    newX = this.mazeCols - 1;
                    mouse.position.x = newX;
                    mouse.x = this.mazeCols - 1;
                } else if (newX > this.mazeCols - 0.5) {
                    // Wrapped right to left  
                    newX = 0;
                    mouse.position.x = newX;
                    mouse.x = 0;
                } else {
                    // Normal movement
                    mouse.position.x = newX;
                    let newGridX = Math.round(newX);
                    if (newGridX < 0) newGridX = this.mazeCols - 1;
                    if (newGridX >= this.mazeCols) newGridX = 0;
                    mouse.x = newGridX;
                }
            } else if (newX < -1) {
                // Wrapped left to right - calculate proper position on right side
                const overflow = Math.abs(newX + 1);
                newX = this.mazeCols - overflow;
                mouse.position.x = Math.max(0, Math.min(this.mazeCols - 1, newX));
                mouse.x = Math.max(0, Math.min(this.mazeCols - 1, Math.floor(newX)));
            } else if (newX > this.mazeCols) {
                // Wrapped right to left - calculate proper position on left side
                const overflow = newX - this.mazeCols;
                newX = overflow;
                mouse.position.x = Math.max(0, Math.min(this.mazeCols - 1, newX));
                mouse.x = Math.max(0, Math.min(this.mazeCols - 1, Math.floor(newX)));
            } else {
                // Normal movement
                mouse.position.x = Math.max(0, Math.min(this.mazeCols - 1, newX));
                // Update grid position
                let newGridX = Math.round(mouse.position.x);
                // Handle wraparound for grid position (safety check)
                if (newGridX < 0) newGridX = this.mazeCols - 1;
                if (newGridX >= this.mazeCols) newGridX = 0;
                mouse.x = newGridX;
            }
            
            // Update Y position (no wraparound for Y)
            mouse.position.y = Math.max(0, Math.min(this.mazeRows - 1, newY));
            const newGridY = Math.round(mouse.position.y);
            mouse.y = Math.max(0, Math.min(this.mazeRows - 1, newGridY));
            
            // Animate mouth
            mouse.mouthFrameTime += deltaTime;
            if (mouse.mouthFrameTime > 150) {
                mouse.mouthFrame = (mouse.mouthFrame + 1) % 2;
                mouse.mouthFrameTime = 0;
            }
            
            // Check cheese collection when near grid center
            let gridX = Math.round(mouse.position.x);
            let gridY = Math.round(mouse.position.y);
            // Handle wraparound for grid position
            if (gridX < 0) gridX = this.mazeCols - 1;
            if (gridX >= this.mazeCols) gridX = 0;
            if (gridY >= 0 && gridY < this.mazeRows) {
                if (Math.abs(mouse.position.x - gridX) < 0.3 && Math.abs(mouse.position.y - gridY) < 0.3) {
                    this.checkCheeseCollection(gridX, gridY);
                }
            }
        } else {
            // Can't move - snap to current grid center
            mouse.position.x = currentGridX;
            mouse.position.y = currentGridY;
            mouse.x = currentGridX;
            mouse.y = currentGridY;
        }
    }
    
    isValidCell(x, y) {
        // Y bounds check first
        if (y < 0 || y >= this.mazeRows) return false;
        
        // Special case: tunnel rows allow wraparound movement
        // In the maze, row 14 (y=14) is "      .   # GGGG #   .      "
        // Left tunnel: columns 0-5 (spaces), Right tunnel: columns 22-27 (spaces)
        const tunnelRows = [14];
        const isTunnelRow = tunnelRows.includes(y);
        const isInTunnelArea = isTunnelRow && (x <= 5 || x >= 22);
        
        // Handle wraparound for X
        if (x < 0) {
            // If in tunnel row and tunnel area, allow wraparound
            if (isInTunnelArea) return true;
            x = this.mazeCols - 1;
        }
        if (x >= this.mazeCols) {
            // If in tunnel row and tunnel area, allow wraparound
            if (isInTunnelArea) return true;
            x = 0;
        }
        
        // Safety check for maze bounds
        if (x < 0 || x >= this.mazeCols) return false;
        if (!this.maze || !this.maze[y] || this.maze[y][x] === undefined) return false;
        
        // Check if cell is a wall
        return this.maze[y][x] !== 1;
    }
    
    canMoveInDirection(x, y, direction) {
        // Handle wraparound for starting position
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
        
        // Check if we're in a tunnel row and trying to wrap
        const tunnelRows = [14];
        const isTunnelRow = tunnelRows.includes(y);
        // Tunnel area is at x <= 5 or x >= 22 on row 14
        const isInTunnelArea = isTunnelRow && (x <= 5 || x >= 22);
        
        if (isInTunnelArea && (targetX < 0 || targetX >= this.mazeCols)) {
            // In tunnel area, wraparound is allowed
            return true;
        }
        
        // Check if target cell is valid
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
        this.cats.forEach((cat, index) => {
            if (!cat) return;
            
            // Initialize position if missing
            if (!cat.position) {
                cat.position = { x: cat.x || 13, y: cat.y || 14 };
            }
            
            // Handle house timer
            if (cat.inHouse) {
                cat.houseTimer -= deltaTime;
                if (cat.houseTimer <= 0) {
                    cat.inHouse = false;
                    // Position at house center
                    cat.x = this.catStartPos.x;
                    cat.y = this.catStartPos.y;
                    cat.position.x = cat.x;
                    cat.position.y = cat.y;
                    cat.direction = 3; // Face up to exit
                } else {
                    return; // Still waiting
                }
            }
            
            // Get grid position
            const gridX = Math.round(cat.position.x);
            const gridY = Math.round(cat.position.y);
            
            // If cat is in house rows (y >= 13), use exit AI targeting door
            if (gridY >= 13) {
                // Target the door exit: row 12, column 13-14 (center of door)
                cat.targetX = 13.5;
                cat.targetY = 12;
                // Use pathfinding to reach target
                this.moveCatTowardTarget(cat, deltaTime);
                return;
            }
            
            // Cat is out - run AI
            if (cat.state === 'frightened') {
                this.updateCatFrightened(cat, deltaTime);
            } else if (cat.state === 'eaten') {
                this.updateCatEaten(cat, deltaTime);
            } else {
                this.updateCatAI(cat, index, deltaTime);
            }
        });
    }
    
    
    updateCatAI(cat, index, deltaTime) {
        // Different AI for each cat
        let targetX, targetY;
        
        if (index === 0) { // Red - aggressive chaser
            targetX = this.mouse.x;
            targetY = this.mouse.y;
        } else if (index === 1) { // Pink - ambusher (target 4 tiles ahead)
            const dir = this.mouse.direction;
            targetX = this.mouse.x;
            targetY = this.mouse.y;
            if (dir === 0) targetX += 4;
            else if (dir === 1) targetY += 4;
            else if (dir === 2) targetX -= 4;
            else if (dir === 3) targetY -= 4;
        } else { // Cyan and Orange - random/scatter
            targetX = Math.random() * this.mazeCols;
            targetY = Math.random() * this.mazeRows;
        }
        
        cat.targetX = targetX;
        cat.targetY = targetY;
        
        // Choose direction toward target
        this.moveCatTowardTarget(cat, deltaTime);
    }
    
    updateCatFrightened(cat, deltaTime) {
        // Random movement when frightened - only change direction when aligned
        const gridX = Math.round(cat.position ? cat.position.x : cat.x);
        const gridY = Math.round(cat.position ? cat.position.y : cat.y);
        const alignedX = Math.abs((cat.position ? cat.position.x : cat.x) - gridX) < 0.3;
        const alignedY = Math.abs((cat.position ? cat.position.y : cat.y) - gridY) < 0.3;
        const isAligned = (cat.direction === 0 || cat.direction === 2) ? alignedX : alignedY;
        
        // Change direction randomly when aligned to prevent bouncing
        if (isAligned && Math.random() < 0.1) {
            const possibleDirs = [];
            for (let dir = 0; dir < 4; dir++) {
                if (this.canMoveInDirection(gridX, gridY, dir)) {
                    possibleDirs.push(dir);
                }
            }
            if (possibleDirs.length > 0) {
                cat.direction = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
                // Snap to grid when changing direction
                if (cat.position) {
                    cat.position.x = gridX;
                    cat.position.y = gridY;
                }
            }
        }
        
        const moveSpeed = cat.speed * 0.5; // Slower when frightened
        this.moveCat(cat, deltaTime, moveSpeed);
    }
    
    updateCatEaten(cat, deltaTime) {
        // Move toward ghost house
        const houseX = this.catStartPos.x;
        const houseY = this.catStartPos.y;
        
        // Use position for smooth movement
        const currentX = cat.position ? cat.position.x : cat.x;
        const currentY = cat.position ? cat.position.y : cat.y;
        const currentGridX = Math.round(currentX);
        const currentGridY = Math.round(currentY);
        
        // Check if reached house
        if (currentGridX === houseX && currentGridY === houseY) {
            // Reached house - regenerate the cat
            cat.x = houseX;
            cat.y = houseY;
            cat.position = { x: houseX, y: houseY };
            cat.state = 'chase';
            cat.inHouse = true;
            cat.direction = 3; // Face up to exit
            // Set house timer based on which cat (like initial spawn)
            const catIndex = this.cats.indexOf(cat);
            if (catIndex === 0) {
                cat.houseTimer = 0; // Red cat exits immediately
            } else if (catIndex === 1) {
                cat.houseTimer = 2000; // Pink after 2 seconds
            } else if (catIndex === 2) {
                cat.houseTimer = 4000; // Cyan after 4 seconds
            } else {
                cat.houseTimer = 6000; // Orange after 6 seconds
            }
            return;
        }
        
        // Move toward house - use pathfinding
        const targetGridX = houseX;
        const targetGridY = houseY;
        
        // Simple pathfinding - prefer moving toward target
        let bestDir = cat.direction;
        let bestDist = Infinity;
        
        // Try each direction (don't reverse unless necessary)
        for (let dir = 0; dir < 4; dir++) {
            // Don't reverse unless stuck
            if (dir === (cat.direction + 2) % 4) continue;
            
            let testX = currentGridX;
            let testY = currentGridY;
            
            if (dir === 0) testX += 1;
            else if (dir === 1) testY += 1;
            else if (dir === 2) testX -= 1;
            else if (dir === 3) testY -= 1;
            
            // Handle wraparound
            if (testX < 0) testX = this.mazeCols - 1;
            if (testX >= this.mazeCols) testX = 0;
            
            if (this.isValidCell(testX, testY)) {
                const dist = Math.abs(testX - targetGridX) + Math.abs(testY - targetGridY);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestDir = dir;
                }
            }
        }
        
        // If no good direction found, allow reverse
        if (bestDist === Infinity) {
            const reverseDir = (cat.direction + 2) % 4;
            let testX = currentGridX;
            let testY = currentGridY;
            if (reverseDir === 0) testX += 1;
            else if (reverseDir === 1) testY += 1;
            else if (reverseDir === 2) testX -= 1;
            else if (reverseDir === 3) testY -= 1;
            if (testX < 0) testX = this.mazeCols - 1;
            if (testX >= this.mazeCols) testX = 0;
            if (this.isValidCell(testX, testY)) {
                bestDir = reverseDir;
            }
        }
        
        cat.direction = bestDir;
        this.moveCat(cat, deltaTime, cat.speed * 2); // Faster when returning
    }
    
    moveCatTowardTarget(cat, deltaTime) {
        const gridX = Math.round(cat.position ? cat.position.x : cat.x);
        const gridY = Math.round(cat.position ? cat.position.y : cat.y);
        
        // Only change direction when aligned to grid
        const alignedX = Math.abs((cat.position ? cat.position.x : cat.x) - gridX) < 0.3;
        const alignedY = Math.abs((cat.position ? cat.position.y : cat.y) - gridY) < 0.3;
        const isAligned = (cat.direction === 0 || cat.direction === 2) ? alignedX : alignedY;
        
        // Choose best direction
        const possibleDirs = [];
        
        // Try each direction
        for (let dir = 0; dir < 4; dir++) {
            if (this.canMoveInDirection(gridX, gridY, dir) && dir !== (cat.direction + 2) % 4) {
                possibleDirs.push(dir);
            }
        }
        
        if (possibleDirs.length === 0) {
            // No valid directions, try reverse
            const reverseDir = (cat.direction + 2) % 4;
            if (this.canMoveInDirection(gridX, gridY, reverseDir)) {
                cat.direction = reverseDir;
            }
            this.moveCat(cat, deltaTime, cat.speed);
            return;
        }
        
        // Only change direction if aligned to grid
        if (isAligned) {
            // Choose direction closest to target
            let bestDir = possibleDirs[0];
            let bestDist = Infinity;
            
            possibleDirs.forEach(dir => {
                let testX = gridX;
                let testY = gridY;
                
                if (dir === 0) testX += 1;
                else if (dir === 1) testY += 1;
                else if (dir === 2) testX -= 1;
                else if (dir === 3) testY -= 1;
                
                const dist = Math.abs(testX - cat.targetX) + Math.abs(testY - cat.targetY);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestDir = dir;
                }
            });
            
            cat.direction = bestDir;
            // Snap to grid when changing direction
            if (cat.position) {
                cat.position.x = gridX;
                cat.position.y = gridY;
            }
        }
        
        this.moveCat(cat, deltaTime, cat.speed);
    }
    
    moveCat(cat, deltaTime, speed) {
        // Initialize position if not set or invalid
        if (!cat.position || isNaN(cat.position.x) || isNaN(cat.position.y)) {
            cat.position = { x: cat.x || 14, y: cat.y || 14 };
        }
        
        // Ensure cat has valid x, y
        if (isNaN(cat.x) || cat.x === undefined) cat.x = 14;
        if (isNaN(cat.y) || cat.y === undefined) cat.y = 14;
        
        // Don't clamp position here - allow smooth movement
        const moveSpeed = speed * (deltaTime / 16.67);
        
        // Get current grid position
        const currentGridX = Math.round(cat.position.x);
        const currentGridY = Math.round(cat.position.y);
        
        // Calculate target cell
        let targetGridX = currentGridX;
        let targetGridY = currentGridY;
        
        if (cat.direction === 0) targetGridX = currentGridX + 1;
        else if (cat.direction === 1) targetGridY = currentGridY + 1;
        else if (cat.direction === 2) targetGridX = currentGridX - 1;
        else if (cat.direction === 3) targetGridY = currentGridY - 1;
        
        // Check if we're in a tunnel row (row 14)
        const tunnelRows = [14];
        const isTunnelRow = tunnelRows.includes(currentGridY);
        // Tunnel area is at x <= 5 or x >= 22 on row 14
        const isInTunnelArea = isTunnelRow && (currentGridX <= 5 || currentGridX >= 22);
        
        // Handle wraparound
        let canMove = false;
        
        // If in tunnel area and trying to wrap, always allow it
        if (isInTunnelArea && (targetGridX < 0 || targetGridX >= this.mazeCols)) {
            canMove = true;
            // Adjust target for wraparound
            if (targetGridX < 0) targetGridX = this.mazeCols - 1;
            if (targetGridX >= this.mazeCols) targetGridX = 0;
        } else {
            // Normal movement - handle wraparound first
            if (targetGridX < 0) targetGridX = this.mazeCols - 1;
            if (targetGridX >= this.mazeCols) targetGridX = 0;
            // Then check if can move
            canMove = this.isValidCell(targetGridX, targetGridY);
        }
        
        if (canMove) {
            let newX = cat.position.x;
            let newY = cat.position.y;
            
            if (cat.direction === 0) newX += moveSpeed;
            else if (cat.direction === 1) newY += moveSpeed;
            else if (cat.direction === 2) newX -= moveSpeed;
            else if (cat.direction === 3) newY -= moveSpeed;
            
            // Handle wraparound - check if we've crossed the boundary
            // For tunnel row 14, check if we're in tunnel area and trying to wrap
            if (isTunnelRow && (currentGridX <= 5 || currentGridX >= 22)) {
                // In tunnel area - instant wraparound when crossing boundary
                if (newX < -0.5) {
                    // Wrapped left to right
                    newX = this.mazeCols - 1;
                    cat.position.x = newX;
                    cat.x = this.mazeCols - 1;
                } else if (newX > this.mazeCols - 0.5) {
                    // Wrapped right to left
                    newX = 0;
                    cat.position.x = newX;
                    cat.x = 0;
                } else {
                    // Normal movement
                    cat.position.x = newX;
                    let newGridX = Math.round(newX);
                    if (newGridX < 0) newGridX = this.mazeCols - 1;
                    if (newGridX >= this.mazeCols) newGridX = 0;
                    cat.x = newGridX;
                }
            } else if (newX < -1) {
                // Wrapped left to right - calculate proper position on right side
                const overflow = Math.abs(newX + 1);
                newX = this.mazeCols - overflow;
                cat.position.x = Math.max(0, Math.min(this.mazeCols - 1, newX));
                cat.x = Math.max(0, Math.min(this.mazeCols - 1, Math.floor(newX)));
            } else if (newX > this.mazeCols) {
                // Wrapped right to left - calculate proper position on left side
                const overflow = newX - this.mazeCols;
                newX = overflow;
                cat.position.x = Math.max(0, Math.min(this.mazeCols - 1, newX));
                cat.x = Math.max(0, Math.min(this.mazeCols - 1, Math.floor(newX)));
            } else {
                // Normal movement - allow position to be slightly outside for smooth movement
                cat.position.x = newX;
                // Update grid position
                let newGridX = Math.round(newX);
                // Handle wraparound for grid position (safety check)
                if (newGridX < 0) newGridX = this.mazeCols - 1;
                if (newGridX >= this.mazeCols) newGridX = 0;
                // Only clamp if way out of bounds
                if (newGridX >= 0 && newGridX < this.mazeCols) {
                    cat.x = newGridX;
                }
            }
            
            // Update Y position (no wraparound for Y)
            cat.position.y = newY;
            let newGridY = Math.round(newY);
            // Clamp Y to valid range
            if (newGridY < 0) newGridY = 0;
            if (newGridY >= this.mazeRows) newGridY = this.mazeRows - 1;
            cat.y = newGridY;
        } else {
            // Can't move - snap to grid
            cat.position.x = currentGridX;
            cat.position.y = currentGridY;
            cat.x = currentGridX;
            cat.y = currentGridY;
        }
    }
    
    checkCollisions() {
        // Safety checks
        if (!this.mouse || !this.cats) return;
        if (isNaN(this.mouse.x) || isNaN(this.mouse.y)) return;
        
        // Check mouse-cat collisions
        this.cats.forEach((cat, index) => {
            if (!cat) return;
            if (cat.inHouse) return;
            if (isNaN(cat.x) || isNaN(cat.y)) return;
            
            const dist = Math.abs(cat.x - this.mouse.x) + Math.abs(cat.y - this.mouse.y);
            
            if (dist < 0.5) { // Collision
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
            this.mouse.x = 14;
            this.mouse.y = 23;
            this.mouse.position.x = 14;
            this.mouse.position.y = 23;
            this.mouse.direction = 0;
            
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
        
        // Reset positions
        this.mouse.x = 14;
        this.mouse.y = 23;
        this.mouse.position.x = 14;
        this.mouse.position.y = 23;
        this.mouse.direction = 0;
        
        // Increase speed slightly
        this.mouse.speed = Math.min(0.15, this.mouse.speed * 1.05);
        this.cats.forEach(cat => {
            cat.speed = Math.min(0.12, cat.speed * 1.05);
        });
        
        // Reset cats
        this.initializeCats();
        this.powerModeActive = false;
        this.powerModeTimer = 0;
        this.gameState = 'ready';
        this.readyTimer = 0;
        
        if (!this.isPreview) {
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
        
        // Update sprites (only if playing)
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
        
        const uiLayer = this.graphics.getLayer('ui');
        if (!uiLayer) return;
        
        // Remove existing UI text sprites
        const children = uiLayer.children.slice();
        children.forEach(child => {
            uiLayer.removeChild(child);
        });
        
        // Score
        const scoreStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 20,
            fill: 0xffffff,
            fontWeight: 'bold'
        });
        
        const scoreText = new PIXI.Text(`SCORE: ${Utils.formatScore(this.score)}`, scoreStyle);
        scoreText.x = 20;
        scoreText.y = 10;
        uiLayer.addChild(scoreText);
        
        // High Score
        const highScore = highScoreManager.getTopScore('mouse-pacman');
        const highScoreText = new PIXI.Text(`HIGH: ${Utils.formatScore(highScore)}`, scoreStyle);
        highScoreText.x = 20;
        highScoreText.y = 35;
        uiLayer.addChild(highScoreText);
        
        // Lives
        const livesStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 16,
            fill: 0xffff00
        });
        
        let livesText = 'LIVES: ';
        for (let i = 0; i < this.lives; i++) {
            livesText += '● ';
        }
        const livesDisplay = new PIXI.Text(livesText, livesStyle);
        livesDisplay.x = this.width - 200;
        livesDisplay.y = 10;
        uiLayer.addChild(livesDisplay);
        
        // Level
        const levelText = new PIXI.Text(`LEVEL: ${this.level}`, scoreStyle);
        levelText.x = this.width - 200;
        levelText.y = 35;
        uiLayer.addChild(levelText);
        
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
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 1);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
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
            uiLayer.addChild(instruction);
        });
    }
    
    drawGameOverPixi(uiLayer) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.8);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
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
        uiLayer.addChild(restart);
    }
    
    drawPausedPixi(uiLayer) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.7);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
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
            
            this.mazeSprites = [];
            this.cheeseSprites = [];
            this.mouseSprite = null;
            this.catSprites = [];
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
