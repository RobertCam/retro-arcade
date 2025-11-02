// Jezzball game implementation - PixiJS version
class JezzballGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
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
                backgroundColor: 0x000011,
                pixelPerfect: true
            });
        }
        
        // Game state
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.timeLeft = 60; // 60 seconds per level
        
        // Game objects
        this.balls = [];
        this.walls = []; // Completed walls
        this.currentWall = null;
        this.isDrawing = false;
        this.wallDirection = 'horizontal'; // 'horizontal' or 'vertical'
        this.capturedArea = 0;
        this.totalArea = this.width * this.height;
        
        // Background pattern system
        this.backgroundPattern = null;
        this.generateBackgroundPattern();
        
        // Effects
        if (this.isPreview) {
            this.particles = new ParticleSystem();
            this.screenEffects = new ScreenEffects(canvas);
        } else {
            this.particles = null; // Will create PixiJS particles as needed
            this.screenEffects = null; // Will be set from nesEffects
        }
        
        // PixiJS sprites (only for main game)
        if (!this.isPreview) {
            this.ballSprites = [];
            this.wallSprites = [];
            this.capturedAreaSprites = [];
            this.cursorPreviewSprite = null;
            this.currentWallSprite = null;
        }
        
        // Input
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.setupInput();
        
        // Create initial level
        this.createLevel();
        
        // Start game loop
        this.lastTime = 0;
        this.gameLoop = this.gameLoop.bind(this);
        
        if (this.isPreview) {
            requestAnimationFrame(this.gameLoop);
        } else {
            this.initGraphics();
        }
    }
    
    async initGraphics() {
        if (this.isPreview) return;
        await this.graphics.init();
        if (!this.graphics || !this.graphics.isInitialized || !this.graphics.app || !this.graphics.app.renderer || !this.graphics.app.ticker) {
            console.error('Graphics initialization failed, falling back to requestAnimationFrame');
            requestAnimationFrame(this.gameLoop);
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
        this.updateBallSprites();
        this.updateWallSprites();
    }
    
    startGameLoop() {
        if (this.isPreview) {
            requestAnimationFrame(this.gameLoop);
            return;
        }
        
        const ticker = this.graphics.getTicker();
        if (ticker) {
            // Store the ticker callback so we can remove it later
            this.tickerCallback = (deltaTime) => {
                this.gameLoop(deltaTime * (1/60) * 1000); // Convert to milliseconds
            };
            ticker.add(this.tickerCallback);
        } else {
            console.warn('PixiJS ticker not available, falling back to requestAnimationFrame');
            requestAnimationFrame(this.gameLoop);
        }
    }
    
    generateBackgroundPattern() {
        const patterns = [
            // Level 1: Simple dots
            {
                type: 'dots',
                color: '#001122',
                size: 2,
                spacing: 30,
                offset: 0
            },
            // Level 2: Grid lines
            {
                type: 'grid',
                color: '#002244',
                lineWidth: 1,
                spacing: 25,
                offset: 0
            },
            // Level 3: Diagonal stripes
            {
                type: 'stripes',
                color: '#003366',
                width: 6,
                spacing: 20,
                angle: 45,
                offset: 0
            },
            // Level 4: Hexagonal pattern
            {
                type: 'hexagons',
                color: '#004488',
                size: 12,
                spacing: 30,
                offset: 0
            },
            // Level 5: Circuit board
            {
                type: 'circuit',
                color: '#0055aa',
                lineWidth: 1,
                spacing: 15,
                offset: 0
            },
            // Level 6: Starfield
            {
                type: 'stars',
                color: '#0066cc',
                size: 1,
                density: 0.2,
                offset: 0
            },
            // Level 7: Waves
            {
                type: 'waves',
                color: '#0077dd',
                amplitude: 8,
                frequency: 0.015,
                offset: 0
            },
            // Level 8: Neon grid
            {
                type: 'neon',
                color: '#0088ee',
                glow: 3,
                spacing: 20,
                offset: 0
            },
            // Level 9: Matrix rain
            {
                type: 'matrix',
                color: '#0099ff',
                charSize: 6,
                spacing: 12,
                offset: 0
            },
            // Level 10+: Cosmic
            {
                type: 'cosmic',
                color: '#00aaff',
                particles: 30,
                offset: 0
            }
        ];
        
        // Cycle through patterns based on level
        const patternIndex = (this.level - 1) % patterns.length;
        this.backgroundPattern = patterns[patternIndex];
        
        // Add some randomization for higher levels
        if (this.level > 10) {
            this.backgroundPattern.offset = Math.random() * 1000;
        }
    }
    
    createLevel() {
        this.balls = [];
        this.walls = [];
        this.currentWall = null;
        this.isDrawing = false;
        this.capturedArea = 0;
        
        // Create balls based on level (starts with 2, adds 1 per level, max 50 from level 49+)
        let ballCount = 2 + (this.level - 1);
        if (this.level >= 49) {
            ballCount = 50;
        }
        
        // Lives equal number of balls plus 1 (only set on first level, not when leveling up)
        if (this.level === 1) {
            this.lives = ballCount + 1;
        }
        
        // Calculate speed multiplier based on level (gradual increase)
        // Level 1: 1.0x, Level 2: 1.08x, Level 10: 1.72x, etc.
        const speedMultiplier = 1.0 + ((this.level - 1) * 0.08);
        
        // Create balls with random positions and velocities
        for (let i = 0; i < ballCount; i++) {
            const ball = {
                x: 50 + Math.random() * (this.width - 100),
                y: 50 + Math.random() * (this.height - 100),
                vx: (Math.random() - 0.5) * 6 * speedMultiplier,
                vy: (Math.random() - 0.5) * 6 * speedMultiplier,
                radius: 8,
                color: '#ff0000' // Red balls like original
            };
            
            // Ensure minimum speed - if ball is too slow, scale it up (also scales with level)
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const minSpeed = 2.5 * speedMultiplier; // Minimum speed threshold scales with level
            if (speed < minSpeed && speed > 0) {
                // Scale up velocity to meet minimum speed
                const scale = minSpeed / speed;
                ball.vx *= scale;
                ball.vy *= scale;
            } else if (speed === 0) {
                // If somehow speed is 0, give it a random direction
                const angle = Math.random() * Math.PI * 2;
                ball.vx = Math.cos(angle) * minSpeed;
                ball.vy = Math.sin(angle) * minSpeed;
            }
            
            // Ensure balls don't start too close to edges
            if (ball.x < 30) ball.x = 30;
            if (ball.x > this.width - 30) ball.x = this.width - 30;
            if (ball.y < 30) ball.y = 30;
            if (ball.y > this.height - 30) ball.y = this.height - 30;
            
            this.balls.push(ball);
        }
        
        // Reset timer (60 seconds per level)
        this.timeLeft = 60;
    }
    
    setupInput() {
        // Keyboard input
        this.keydownHandler = (e) => {
            // Don't handle input if modals are open
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal && nameEntryModal.classList.contains('active')) {
                return;
            }
            
            // Only handle input if this is the active game
            const activeCanvas = document.getElementById('game-canvas');
            if (activeCanvas !== this.canvas) return;
            
            this.keys[e.code] = true;
            
            if (e.code === 'Space') {
                if (this.gameState === 'menu') {
                    this.startGame();
                } else if (this.gameState === 'gameOver') {
                    this.startGame();
                }
            }
            
            if (e.code === 'KeyP' && this.gameState === 'playing') {
                this.togglePause();
            }
            
            // Control key to change wall direction
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                this.wallDirection = this.wallDirection === 'horizontal' ? 'vertical' : 'horizontal';
            }
        };
        
        this.keyupHandler = (e) => {
            // Only handle input if this is the active game
            const activeCanvas = document.getElementById('game-canvas');
            if (activeCanvas !== this.canvas) return;
            
            this.keys[e.code] = false;
        };
        
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        
        // Mouse input for Jezzball controls
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.gameState !== 'playing') return;
            
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            
            if (e.button === 0) { // Left click - start drawing wall
                if (!this.isDrawing) {
                    this.startWall(this.mouse.x, this.mouse.y);
                }
            } else if (e.button === 2) { // Right click - change direction
                e.preventDefault();
                this.wallDirection = this.wallDirection === 'horizontal' ? 'vertical' : 'horizontal';
            }
        });
        
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent right-click context menu
        });
    }
    
    startWall(x, y) {
        this.isDrawing = true;
        this.currentWall = {
            clickX: x, // Store original click point
            clickY: y,
            startX: x,
            startY: y,
            endX: x,
            endY: y,
            direction: this.wallDirection,
            extending: true
        };
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.level = 1;
        this.generateBackgroundPattern();
        this.createLevel();
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
        }
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        // Update timer
        this.timeLeft -= deltaTime / 1000;
        if (this.timeLeft <= 0) {
            this.timeUp();
            return;
        }
        
        // Update current wall if drawing
        if (this.isDrawing && this.currentWall) {
            this.updateWall();
        }
        
        // Update balls
        for (let ball of this.balls) {
            ball.x += ball.vx;
            ball.y += ball.vy;
            
            // Bounce off walls (canvas edges)
            if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= this.width) {
                ball.vx = -ball.vx;
                ball.x = Math.max(ball.radius, Math.min(this.width - ball.radius, ball.x));
            }
            
            if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= this.height) {
                ball.vy = -ball.vy;
                ball.y = Math.max(ball.radius, Math.min(this.height - ball.radius, ball.y));
            }
            
            // Check collision with completed walls
            for (let wall of this.walls) {
                if (this.checkBallWallCollision(ball, wall)) {
                    this.reflectBall(ball, wall);
                }
            }
            
            // Check collision with current extending wall
            if (this.currentWall && this.currentWall.extending) {
                if (this.checkBallWallCollision(ball, this.currentWall)) {
                    // Ball hit extending wall - cancel wall and lose life
                    this.cancelWall();
                    this.lives--;
                    if (this.screenEffects && typeof this.screenEffects.flash === 'function') {
                        this.screenEffects.flash('#ff0000', 10);
                    }
                    
                    if (this.lives <= 0) {
                        this.gameOver();
                        return;
                    }
                }
            }
        }
        
        // Update effects
        if (this.isPreview) {
            if (this.particles) this.particles.update();
            if (this.screenEffects) this.screenEffects.update();
        } else {
            // Update sprite positions (only ball positions, walls updated in drawPixi)
            this.updateBallSprites();
            if (this.nesEffects && typeof this.nesEffects.update === 'function') {
                this.nesEffects.update();
            }
        }
    }
    
    updateWall() {
        if (!this.currentWall) return;
        
        const speed = 300; // pixels per second
        const deltaTime = 16; // approximate frame time
        const moveDistance = speed * deltaTime / 1000;
        
        if (this.currentWall.direction === 'horizontal') {
            // Extend horizontally in both directions from click point
            let leftStopped = false;
            let rightStopped = false;
            
            if (this.currentWall.startX > 0) {
                this.currentWall.startX -= moveDistance;
                // Check collision with existing walls
                const collision = this.checkWallCollision(this.currentWall.startX, this.currentWall.clickY, 'left');
                if (collision) {
                    this.currentWall.startX = collision.x;
                    leftStopped = true;
                }
                if (this.currentWall.startX <= 0) {
                    this.currentWall.startX = 0;
                    leftStopped = true;
                }
            } else {
                leftStopped = true;
            }
            
            if (this.currentWall.endX < this.width) {
                this.currentWall.endX += moveDistance;
                // Check collision with existing walls
                const collision = this.checkWallCollision(this.currentWall.endX, this.currentWall.clickY, 'right');
                if (collision) {
                    this.currentWall.endX = collision.x;
                    rightStopped = true;
                }
                if (this.currentWall.endX >= this.width) {
                    this.currentWall.endX = this.width;
                    rightStopped = true;
                }
            } else {
                rightStopped = true;
            }
            
            // Complete wall when both ends hit boundaries
            if (leftStopped && rightStopped) {
                this.completeWall();
            }
        } else {
            // Extend vertically in both directions from click point
            let upStopped = false;
            let downStopped = false;
            
            if (this.currentWall.startY > 0) {
                this.currentWall.startY -= moveDistance;
                // Check collision with existing walls
                const collision = this.checkWallCollision(this.currentWall.clickX, this.currentWall.startY, 'up');
                if (collision) {
                    this.currentWall.startY = collision.y;
                    upStopped = true;
                }
                if (this.currentWall.startY <= 0) {
                    this.currentWall.startY = 0;
                    upStopped = true;
                }
            } else {
                upStopped = true;
            }
            
            if (this.currentWall.endY < this.height) {
                this.currentWall.endY += moveDistance;
                // Check collision with existing walls
                const collision = this.checkWallCollision(this.currentWall.clickX, this.currentWall.endY, 'down');
                if (collision) {
                    this.currentWall.endY = collision.y;
                    downStopped = true;
                }
                if (this.currentWall.endY >= this.height) {
                    this.currentWall.endY = this.height;
                    downStopped = true;
                }
            } else {
                downStopped = true;
            }
            
            // Complete wall when both ends hit boundaries
            if (upStopped && downStopped) {
                this.completeWall();
            }
        }
    }
    
    checkWallCollision(x, y, direction) {
        // Check collision with existing walls - increased tolerance
        for (let wall of this.walls) {
            if (wall.direction === 'horizontal') {
                // Check if point is on horizontal wall
                if (Math.abs(y - wall.startY) < 8 && x >= wall.startX && x <= wall.endX) {
                    return { x: x, y: wall.startY };
                }
            } else {
                // Check if point is on vertical wall
                if (Math.abs(x - wall.startX) < 8 && y >= wall.startY && y <= wall.endY) {
                    return { x: wall.startX, y: y };
                }
            }
        }
        return null;
    }
    
    completeWall() {
        if (!this.currentWall) return;
        
        // Add wall to completed walls
        this.walls.push({
            startX: this.currentWall.startX,
            startY: this.currentWall.startY,
            endX: this.currentWall.endX,
            endY: this.currentWall.endY,
            direction: this.currentWall.direction,
            capturedAreas: [] // Will store areas captured by this wall
        });
        
        // Calculate and fill captured areas
        this.calculateCapturedAreas();
        
        this.currentWall = null;
        this.isDrawing = false;
        
        // Sprites will be updated in drawPixi() on next frame
        // No need to update immediately here
        
        if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
            this.screenEffects.shake(3, 5);
        }
    }
    
    calculateCapturedAreas() {
        // Proper Jezzball logic: flood-fill from each ball to find areas NOT containing balls
        // Goal: reduce balls to 25% of playing field or less
        
        // Create a grid to track captured areas
        const gridWidth = Math.floor(this.width / 10);
        const gridHeight = Math.floor(this.height / 10);
        const capturedGrid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(false));
        
        // Flood fill from each ball position to mark areas containing balls
        for (let ball of this.balls) {
            const gridX = Math.floor(ball.x / 10);
            const gridY = Math.floor(ball.y / 10);
            this.floodFillFromBall(gridX, gridY, capturedGrid, gridWidth, gridHeight);
        }
        
        // Count captured areas (areas NOT containing balls)
        let capturedCells = 0;
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                if (!capturedGrid[y][x]) {
                    capturedCells++;
                }
            }
        }
        
        // Calculate percentage of area captured
        const totalCells = gridWidth * gridHeight;
        const capturePercentage = (capturedCells / totalCells) * 100;
        
        // Update captured area for display
        this.capturedArea = capturedCells * 100; // Convert grid cells to pixel area
        
        // Win condition: 75% of area captured (balls reduced to 25% or less)
        if (capturePercentage >= 75) {
            this.levelUp();
        }
    }
    
    floodFillFromBall(startX, startY, grid, gridWidth, gridHeight) {
        // Flood fill to mark areas containing balls
        const stack = [{x: startX, y: startY}];
        
        while (stack.length > 0) {
            const {x, y} = stack.pop();
            
            if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight || grid[y][x]) {
                continue;
            }
            
            // Check if this cell is blocked by a wall
            if (this.isCellBlockedByWall(x * 10, y * 10)) {
                continue;
            }
            
            grid[y][x] = true;
            
            // Add neighbors to stack
            stack.push({x: x + 1, y});
            stack.push({x: x - 1, y});
            stack.push({x, y: y + 1});
            stack.push({x, y: y - 1});
        }
    }
    
    isCellBlockedByWall(x, y) {
        // Check if this cell is blocked by any wall
        for (let wall of this.walls) {
            if (wall.direction === 'horizontal') {
                if (Math.abs(y - wall.startY) < 5 && x >= wall.startX && x <= wall.endX) {
                    return true;
                }
            } else {
                if (Math.abs(x - wall.startX) < 5 && y >= wall.startY && y <= wall.endY) {
                    return true;
                }
            }
        }
        return false;
    }
    
    calculateEnclosedArea(startX, startY, endX, endY) {
        // Use flood fill to find enclosed area that doesn't contain balls
        let area = 0;
        const step = 20; // Check every 20 pixels for performance
        
        for (let x = startX; x < endX; x += step) {
            for (let y = startY; y < endY; y += step) {
                if (this.isAreaEnclosed(x, y, endX - startX, endY - startY)) {
                    area += step * step; // Add area of this grid cell
                }
            }
        }
        
        return area;
    }
    
    isAreaEnclosed(x, y, width, height) {
        // Check if this area is completely enclosed by walls and doesn't contain balls
        
        // First check if any balls are in this area
        for (let ball of this.balls) {
            if (ball.x >= x && ball.x <= x + width && 
                ball.y >= y && ball.y <= y + height) {
                return false; // Area contains a ball, can't be captured
            }
        }
        
        // Check if area is enclosed by walls on all sides (including canvas edges)
        let wallsLeft = 0, wallsRight = 0, wallsUp = 0, wallsDown = 0;
        
        // Canvas edges count as walls
        if (x <= 0) wallsLeft++; // Left edge
        if (x + width >= this.width) wallsRight++; // Right edge  
        if (y <= 0) wallsUp++; // Top edge
        if (y + height >= this.height) wallsDown++; // Bottom edge
        
        // Check actual walls - simplified logic
        for (let wall of this.walls) {
            if (wall.direction === 'horizontal') {
                // Horizontal wall - check if it's between top and bottom of area
                if (wall.startY > y && wall.startY < y + height &&
                    wall.startX <= x && wall.endX >= x + width) {
                    if (wall.startY < y + height/2) {
                        wallsUp++;
                    } else {
                        wallsDown++;
                    }
                }
            } else {
                // Vertical wall - check if it's between left and right of area
                if (wall.startX > x && wall.startX < x + width &&
                    wall.startY <= y && wall.endY >= y + height) {
                    if (wall.startX < x + width/2) {
                        wallsLeft++;
                    } else {
                        wallsRight++;
                    }
                }
            }
        }
        
        // Debug: log enclosure check for first few areas
        if (x < 100 && y < 100) {
            console.log(`Area ${x},${y}: walls L:${wallsLeft} R:${wallsRight} U:${wallsUp} D:${wallsDown}`);
        }
        
        // Area is captured if it has walls on all sides
        return wallsLeft > 0 && wallsRight > 0 && wallsUp > 0 && wallsDown > 0;
    }
    
    floodFillArea(startX, startY, endX, endY) {
        // Simple flood fill to find enclosed area
        let area = 0;
        const step = 10; // Check every 10 pixels for performance
        
        for (let x = startX; x < endX; x += step) {
            for (let y = startY; y < endY; y += step) {
                if (this.isPointEnclosed(x, y)) {
                    area += step * step; // Add area of this grid cell
                }
            }
        }
        
        return area;
    }
    
    isPointEnclosed(x, y) {
        // Check if a point is enclosed by walls and doesn't contain a ball
        if (this.isPointInBall(x, y)) return false;
        
        // Check if point is enclosed by walls (simplified check)
        let wallsLeft = 0, wallsRight = 0, wallsUp = 0, wallsDown = 0;
        
        for (let wall of this.walls) {
            if (wall.direction === 'horizontal') {
                if (y > wall.startY && x >= wall.startX && x <= wall.endX) {
                    wallsUp++;
                }
                if (y < wall.startY && x >= wall.startX && x <= wall.endX) {
                    wallsDown++;
                }
            } else {
                if (x > wall.startX && y >= wall.startY && y <= wall.endY) {
                    wallsLeft++;
                }
                if (x < wall.startX && y >= wall.startY && y <= wall.endY) {
                    wallsRight++;
                }
            }
        }
        
        // Point is enclosed if it has walls on all sides
        return wallsLeft > 0 && wallsRight > 0 && wallsUp > 0 && wallsDown > 0;
    }
    
    isPointInBall(x, y) {
        // Check if point is inside any ball
        for (let ball of this.balls) {
            const dx = x - ball.x;
            const dy = y - ball.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < ball.radius) {
                return true;
            }
        }
        return false;
    }
    
    calculateFreeArea() {
        // Calculate total area minus areas occupied by balls
        const totalArea = this.width * this.height;
        let ballArea = 0;
        
        for (let ball of this.balls) {
            ballArea += Math.PI * ball.radius * ball.radius;
        }
        
        return totalArea - ballArea;
    }
    
    cancelWall() {
        this.currentWall = null;
        this.isDrawing = false;
        if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
            this.screenEffects.shake(8, 15);
        }
    }
    
    calculateWallArea(wall) {
        // Simplified area calculation - in real Jezzball this would be complex polygon math
        if (wall.direction === 'horizontal') {
            return Math.abs(wall.endX - wall.startX) * 10; // Rough estimate
        } else {
            return Math.abs(wall.endY - wall.startY) * 10; // Rough estimate
        }
    }
    
    checkBallWallCollision(ball, wall) {
        // Simple line-circle collision detection
        const dx = wall.endX - wall.startX;
        const dy = wall.endY - wall.startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return false;
        
        const t = Math.max(0, Math.min(1, 
            ((ball.x - wall.startX) * dx + (ball.y - wall.startY) * dy) / (length * length)
        ));
        
        const closestX = wall.startX + t * dx;
        const closestY = wall.startY + t * dy;
        
        const distance = Math.sqrt(
            (ball.x - closestX) * (ball.x - closestX) + 
            (ball.y - closestY) * (ball.y - closestY)
        );
        
        return distance < ball.radius + 2; // Wall thickness
    }
    
    reflectBall(ball, wall) {
        // Calculate reflection off wall
        const dx = wall.endX - wall.startX;
        const dy = wall.endY - wall.startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
            const nx = -dy / length;
            const ny = dx / length;
            
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx -= 2 * dot * nx;
            ball.vy -= 2 * dot * ny;
            
            if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
                this.screenEffects.shake(2, 3);
            }
        }
    }
    
    levelUp() {
        this.level++;
        this.score += 500 * this.level; // Bonus for completing level
        if (this.screenEffects && typeof this.screenEffects.flash === 'function') {
            this.screenEffects.flash('#00ff00', 15);
        }
        
        // Generate new background pattern
        this.generateBackgroundPattern();
        
        this.createLevel();
        
        // Update sprites for new level
        if (!this.isPreview) {
            this.updateBallSprites();
        }
    }
    
    timeUp() {
        this.lives--;
        if (this.screenEffects && typeof this.screenEffects.flash === 'function') {
            this.screenEffects.flash('#ff0000', 10);
        }
        
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            this.createLevel(); // Restart current level
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        
        // Check if this is a high score
        if (highScoreManager.checkHighScore('jezzball', this.score)) {
            highScoreManager.requestNameEntry('jezzball', this.score);
        }
    }
    
    drawBackground() {
        if (!this.backgroundPattern) return;
        
        this.ctx.save();
        this.ctx.fillStyle = this.backgroundPattern.color;
        this.ctx.strokeStyle = this.backgroundPattern.color;
        
        const pattern = this.backgroundPattern;
        const time = Date.now() * 0.001;
        
        switch (pattern.type) {
            case 'dots':
                this.ctx.beginPath();
                for (let x = pattern.offset; x < this.width + pattern.spacing; x += pattern.spacing) {
                    for (let y = pattern.offset; y < this.height + pattern.spacing; y += pattern.spacing) {
                        this.ctx.arc(x, y, pattern.size, 0, Math.PI * 2);
                        this.ctx.moveTo(x + pattern.spacing, y);
                    }
                }
                this.ctx.fill();
                break;
                
            case 'grid':
                this.ctx.lineWidth = pattern.lineWidth;
                this.ctx.beginPath();
                for (let x = pattern.offset; x < this.width; x += pattern.spacing) {
                    this.ctx.moveTo(x, 0);
                    this.ctx.lineTo(x, this.height);
                }
                for (let y = pattern.offset; y < this.height; y += pattern.spacing) {
                    this.ctx.moveTo(0, y);
                    this.ctx.lineTo(this.width, y);
                }
                this.ctx.stroke();
                break;
                
            case 'stripes':
                this.ctx.lineWidth = pattern.width;
                this.ctx.beginPath();
                const angle = pattern.angle * Math.PI / 180;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                for (let i = -this.width; i < this.width + this.height; i += pattern.spacing) {
                    const x1 = i * cos;
                    const y1 = i * sin;
                    const x2 = x1 + this.width * cos;
                    const y2 = y1 + this.width * sin;
                    this.ctx.moveTo(x1, y1);
                    this.ctx.lineTo(x2, y2);
                }
                this.ctx.stroke();
                break;
                
            case 'hexagons':
                this.ctx.lineWidth = 1;
                for (let x = pattern.offset; x < this.width + pattern.spacing; x += pattern.spacing) {
                    for (let y = pattern.offset; y < this.height + pattern.spacing; y += pattern.spacing) {
                        this.ctx.beginPath();
                        for (let i = 0; i < 6; i++) {
                            const angle = (i * Math.PI) / 3;
                            const px = x + pattern.size * Math.cos(angle);
                            const py = y + pattern.size * Math.sin(angle);
                            if (i === 0) this.ctx.moveTo(px, py);
                            else this.ctx.lineTo(px, py);
                        }
                        this.ctx.closePath();
                        this.ctx.stroke();
                    }
                }
                break;
                
            case 'circuit':
                this.ctx.lineWidth = pattern.lineWidth;
                this.ctx.beginPath();
                for (let y = pattern.offset; y < this.height; y += pattern.spacing) {
                    this.ctx.moveTo(0, y);
                    this.ctx.lineTo(this.width, y);
                }
                for (let x = pattern.offset; x < this.width; x += pattern.spacing) {
                    this.ctx.moveTo(x, 0);
                    this.ctx.lineTo(x, this.height);
                }
                for (let x = pattern.offset; x < this.width; x += pattern.spacing * 2) {
                    for (let y = pattern.offset; y < this.height; y += pattern.spacing * 2) {
                        this.ctx.moveTo(x, y);
                        this.ctx.lineTo(x + pattern.spacing, y + pattern.spacing);
                    }
                }
                this.ctx.stroke();
                break;
                
            case 'stars':
                this.ctx.beginPath();
                for (let i = 0; i < this.width * this.height * pattern.density; i++) {
                    const x = (i * 7 + pattern.offset) % this.width;
                    const y = (i * 11 + pattern.offset) % this.height;
                    this.ctx.arc(x, y, pattern.size, 0, Math.PI * 2);
                    this.ctx.moveTo(x + 1, y);
                }
                this.ctx.fill();
                break;
                
            case 'waves':
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                for (let x = 0; x < this.width; x += 2) {
                    const y = this.height / 2 + Math.sin(x * pattern.frequency + time + pattern.offset) * pattern.amplitude;
                    if (x === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.stroke();
                break;
                
            case 'neon':
                this.ctx.shadowColor = pattern.color;
                this.ctx.shadowBlur = pattern.glow;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                for (let x = pattern.offset; x < this.width; x += pattern.spacing) {
                    this.ctx.moveTo(x, 0);
                    this.ctx.lineTo(x, this.height);
                }
                for (let y = pattern.offset; y < this.height; y += pattern.spacing) {
                    this.ctx.moveTo(0, y);
                    this.ctx.lineTo(this.width, y);
                }
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
                break;
                
            case 'matrix':
                this.ctx.font = `${pattern.charSize}px Courier New`;
                const chars = '01';
                for (let x = pattern.offset; x < this.width; x += pattern.spacing) {
                    for (let y = pattern.offset; y < this.height; y += pattern.spacing) {
                        const char = chars[Math.floor(Math.random() * chars.length)];
                        this.ctx.fillText(char, x, y);
                    }
                }
                break;
                
            case 'cosmic':
                this.ctx.beginPath();
                for (let i = 0; i < pattern.particles; i++) {
                    const x = (i * 13 + pattern.offset) % this.width;
                    const y = (i * 17 + pattern.offset) % this.height;
                    const size = 1 + Math.sin(time + i) * 2;
                    this.ctx.arc(x, y, size, 0, Math.PI * 2);
                    this.ctx.moveTo(x + 1, y);
                }
                this.ctx.fill();
                break;
        }
        
        this.ctx.restore();
    }
    
    // PixiJS rendering methods
    updateBallSprites() {
        if (this.isPreview || !this.spriteManager || !this.graphics) return;
        
        // Remove sprites for balls that no longer exist
        for (let i = this.ballSprites.length - 1; i >= 0; i--) {
            const sprite = this.ballSprites[i];
            if (!this.balls.find(ball => ball.sprite === sprite)) {
                if (sprite && sprite.parent) {
                    sprite.parent.removeChild(sprite);
                }
                this.ballSprites.splice(i, 1);
            }
        }
        
        // Create or update sprites for each ball
        for (let ball of this.balls) {
            if (ball.sprite && this.ballSprites.includes(ball.sprite)) {
                // Update existing sprite position
                ball.sprite.x = ball.x - ball.radius;
                ball.sprite.y = ball.y - ball.radius;
            } else {
                // Create new sprite
                const ballColor = parseInt(ball.color.replace('#', ''), 16);
                const ballSprite = new PIXI.Graphics();
                
                // Main ball with glow
                ballSprite.beginFill(ballColor, 1);
                ballSprite.drawCircle(ball.radius, ball.radius, ball.radius);
                ballSprite.endFill();
                
                // Outer glow effect
                ballSprite.lineStyle(2, ballColor, 0.6);
                ballSprite.drawCircle(ball.radius, ball.radius, ball.radius + 2);
                ballSprite.lineStyle(1, ballColor, 0.3);
                ballSprite.drawCircle(ball.radius, ball.radius, ball.radius + 4);
                
                // Highlight
                ballSprite.beginFill(0xffffff, 0.4);
                ballSprite.drawCircle(ball.radius - ball.radius * 0.3, ball.radius - ball.radius * 0.3, ball.radius * 0.3);
                ballSprite.endFill();
                
                ballSprite.x = ball.x - ball.radius;
                ballSprite.y = ball.y - ball.radius;
                
                this.graphics.addToLayer(ballSprite, 'foreground');
                this.ballSprites.push(ballSprite);
                ball.sprite = ballSprite;
            }
        }
    }
    
    updateWallSprites() {
        if (this.isPreview || !this.graphics) return;
        
        const fgLayer = this.graphics.getLayer('foreground');
        if (!fgLayer) return;
        
        // Remove all old wall sprites (except test line)
        this.wallSprites.forEach(sprite => {
            if (sprite && sprite.parent && (!sprite.userData || !sprite.userData.isTestLine)) {
                sprite.parent.removeChild(sprite);
            }
        });
        this.wallSprites = [];
        
        // Clear sprite references from walls
        this.walls.forEach(wall => {
            wall.sprite = null;
        });
        
        // Create sprites for all walls
        for (let wall of this.walls) {
            const wallGraphics = new PIXI.Graphics();
            
            // Calculate wall dimensions
            const dx = wall.endX - wall.startX;
            const dy = wall.endY - wall.startY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            // Draw wall as a filled rectangle instead of line (more reliable rendering)
            wallGraphics.beginFill(0xffffff, 1.0); // Bright white
            // Draw a rotated rectangle for the wall
            const wallThickness = 10;
            wallGraphics.drawRect(0, -wallThickness / 2, length, wallThickness);
            wallGraphics.endFill();
            
            // Position and rotate
            wallGraphics.x = wall.startX;
            wallGraphics.y = wall.startY;
            wallGraphics.rotation = angle;
            
            // Ensure sprite is visible
            wallGraphics.visible = true;
            wallGraphics.alpha = 1.0;
            
            // Use same method as balls
            this.graphics.addToLayer(wallGraphics, 'foreground');
            this.wallSprites.push(wallGraphics);
            wall.sprite = wallGraphics;
        }
        
        if (this.walls.length > 0) {
            console.log(`Updated ${this.walls.length} wall sprites, fgLayer has ${fgLayer.children.length} children`);
        }
    }
    
    updateCapturedAreaSprites() {
        if (this.isPreview || !this.graphics) return;
        
        // Remove old sprites
        this.capturedAreaSprites.forEach(sprite => {
            if (sprite && sprite.parent) {
                sprite.parent.removeChild(sprite);
            }
        });
        this.capturedAreaSprites = [];
        
        // Create sprites for captured areas
        for (let wall of this.walls) {
            if (wall.capturedAreas) {
                for (let area of wall.capturedAreas) {
                    const areaGraphics = new PIXI.Graphics();
                    areaGraphics.beginFill(0x000000, 1);
                    areaGraphics.drawRect(0, 0, area.width, area.height);
                    areaGraphics.endFill();
                    areaGraphics.x = area.x;
                    areaGraphics.y = area.y;
                    
                    this.graphics.addToLayer(areaGraphics, 'background');
                    this.capturedAreaSprites.push(areaGraphics);
                }
            }
        }
    }
    
    updateCurrentWallSprite() {
        if (this.isPreview || !this.graphics) return;
        
        // Remove old sprite
        if (this.currentWallSprite && this.currentWallSprite.parent) {
            this.currentWallSprite.parent.removeChild(this.currentWallSprite);
        }
        
        if (!this.currentWall) {
            this.currentWallSprite = null;
            return;
        }
        
        const wallContainer = new PIXI.Container();
        const wallGraphics = new PIXI.Graphics();
        
        // Dashed line for extending wall
        const dx = this.currentWall.endX - this.currentWall.startX;
        const dy = this.currentWall.endY - this.currentWall.startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        if (length > 0) {
            // Draw dashed wall as filled rectangles
            const dashLength = 12;
            const gapLength = 6;
            const segments = Math.floor(length / (dashLength + gapLength));
            const wallThickness = 6;
            
            wallGraphics.beginFill(0x00ffff, 1.0); // Bright cyan
            for (let i = 0; i < segments; i++) {
                const startPercent = (i * (dashLength + gapLength)) / length;
                const dashStartX = startPercent * length;
                const dashEndX = Math.min((startPercent * length) + dashLength, length);
                
                wallGraphics.drawRect(dashStartX, -wallThickness / 2, dashEndX - dashStartX, wallThickness);
            }
            wallGraphics.endFill();
            
            // Position and rotate
            wallGraphics.x = this.currentWall.startX;
            wallGraphics.y = this.currentWall.startY;
            wallGraphics.rotation = angle;
        }
        
        wallContainer.addChild(wallGraphics);
        
        // Click point indicator - make it VERY bright and visible
        const clickIndicator = new PIXI.Graphics();
        // Bright yellow circle - fully opaque
        clickIndicator.beginFill(0xffff00, 1.0);
        clickIndicator.drawCircle(0, 0, 8); // Larger circle
        clickIndicator.endFill();
        
        clickIndicator.x = this.currentWall.clickX;
        clickIndicator.y = this.currentWall.clickY;
        clickIndicator.visible = true;
        clickIndicator.alpha = 1.0;
        
        wallContainer.addChild(clickIndicator);
        
        // Ensure visibility
        wallContainer.visible = true;
        wallContainer.alpha = 1.0;
        
        // Use same method as balls
        this.graphics.addToLayer(wallContainer, 'foreground');
        this.currentWallSprite = wallContainer;
    }
    
    updateCursorPreviewSprite() {
        if (this.isPreview || !this.graphics) return;
        
        // Remove old sprite
        if (this.cursorPreviewSprite && this.cursorPreviewSprite.parent) {
            this.cursorPreviewSprite.parent.removeChild(this.cursorPreviewSprite);
        }
        
        // Only show cursor when playing and not actively drawing a wall
        // But we still want to show it when not drawing, even if a wall is being extended
        if (this.gameState !== 'playing') {
            this.cursorPreviewSprite = null;
            return;
        }
        
        const previewContainer = new PIXI.Container();
        
        // Preview line - draw as filled rectangles instead of lines
        const previewLine = new PIXI.Graphics();
        
        let startX, startY, length;
        const lineThickness = 4;
        
        if (this.wallDirection === 'horizontal') {
            startX = 0;
            startY = this.mouse.y - lineThickness / 2;
            length = this.width;
            // Draw dashed horizontal line as rectangles
            previewLine.beginFill(0xffff00, 1.0); // Bright yellow
            const dashLength = 8;
            const gapLength = 4;
            const segments = Math.floor(length / (dashLength + gapLength));
            for (let i = 0; i < segments; i++) {
                const x = i * (dashLength + gapLength);
                previewLine.drawRect(x, startY, dashLength, lineThickness);
            }
            previewLine.endFill();
        } else {
            startX = this.mouse.x - lineThickness / 2;
            startY = 0;
            length = this.height;
            // Draw dashed vertical line as rectangles
            previewLine.beginFill(0xffff00, 1.0); // Bright yellow
            const dashLength = 8;
            const gapLength = 4;
            const segments = Math.floor(length / (dashLength + gapLength));
            for (let i = 0; i < segments; i++) {
                const y = i * (dashLength + gapLength);
                previewLine.drawRect(startX, y, lineThickness, dashLength);
            }
            previewLine.endFill();
        }
        
        previewContainer.addChild(previewLine);
        
        // Crosshair - draw as filled rectangles
        const crosshair = new PIXI.Graphics();
        crosshair.beginFill(0xffffff, 1.0); // Bright white
        // Horizontal line
        crosshair.drawRect(this.mouse.x - 15, this.mouse.y - 1, 30, 2);
        // Vertical line
        crosshair.drawRect(this.mouse.x - 1, this.mouse.y - 15, 2, 30);
        crosshair.endFill();
        
        previewContainer.addChild(crosshair);
        
        // Ensure visibility
        previewContainer.visible = true;
        previewContainer.alpha = 1.0;
        
        // Use same method as other sprites
        this.graphics.addToLayer(previewContainer, 'ui');
        this.cursorPreviewSprite = previewContainer;
    }
    
    drawPixi() {
        if (this.isPreview || !this.graphics || !this.graphics.isInitialized) {
            return;
        }
        
        // Get layers - they should exist if graphics is initialized
        const bgLayer = this.graphics.getLayer('background');
        const fgLayer = this.graphics.getLayer('foreground');
        const uiLayer = this.graphics.getLayer('ui');
        
        if (!bgLayer || !fgLayer || !uiLayer) {
            return;
        }
        
        // Draw background if not already drawn
        if (!bgLayer.children.some(child => child.userData && child.userData.isBackground)) {
            const bg = new PIXI.Graphics();
            bg.beginFill(0x000011, 1);
            bg.drawRect(0, 0, this.width, this.height);
            bg.endFill();
            bg.userData = { isBackground: true };
            bgLayer.addChildAt(bg, 0); // Add at the bottom
        }
        
        // Update captured areas (they draw on background layer, above background)
        this.updateCapturedAreaSprites();
        
        // Update completed walls (this method handles sprite removal/recreation)
        this.updateWallSprites();
        
        // Update current wall
        this.updateCurrentWallSprite();
        
        // Update cursor preview
        this.updateCursorPreviewSprite();
        
        // Draw UI
        this.drawUIPixi();
    }
    
    drawUIPixi() {
        if (this.isPreview || !this.graphics) return;
        
        // Update stats panel instead of drawing on canvas
        this.updateStatsPanel();
        
        // Game state messages still drawn on canvas (center screen)
        const uiLayer = this.graphics.getLayer('ui');
        if (!uiLayer) return;
        
        // Remove existing game state messages
        const children = uiLayer.children.slice();
        children.forEach(child => {
            if (child !== this.cursorPreviewSprite && child.userData && child.userData.isGameStateMessage) {
                uiLayer.removeChild(child);
            }
        });
        
        // Game state messages
        if (this.gameState === 'menu') {
            const menuStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 24,
                fill: 0x00ffff,
                fontWeight: 'bold',
                stroke: 0x000000,
                strokeThickness: 3,
                align: 'center'
            });
            
            const titleText = new PIXI.Text('CONTAINMENT GRID', menuStyle);
            titleText.anchor.set(0.5);
            titleText.x = this.width / 2;
            titleText.y = this.height / 2 - 50;
            titleText.userData = { isGameStateMessage: true };
            uiLayer.addChild(titleText);
            
            const smallStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 14,
                fill: 0xffffff,
                align: 'center'
            });
            
            const instructions = [
                'Capture 75% of the area!',
                'Left click: Start wall',
                'Right click or Ctrl: Change direction',
                'Press SPACE to start'
            ];
            
            instructions.forEach((text, i) => {
                const instructionText = new PIXI.Text(text, smallStyle);
                instructionText.anchor.set(0.5);
                instructionText.x = this.width / 2;
                instructionText.y = this.height / 2 - 20 + (i * 20);
                instructionText.userData = { isGameStateMessage: true };
                uiLayer.addChild(instructionText);
            });
        } else if (this.gameState === 'paused') {
            const pauseStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 24,
                fill: 0xffff00,
                fontWeight: 'bold',
                stroke: 0x000000,
                strokeThickness: 3,
                align: 'center'
            });
            
            const pauseText = new PIXI.Text('PAUSED', pauseStyle);
            pauseText.anchor.set(0.5);
            pauseText.x = this.width / 2;
            pauseText.y = this.height / 2;
            pauseText.userData = { isGameStateMessage: true };
            uiLayer.addChild(pauseText);
            
            const resumeText = new PIXI.Text('Press P to resume', new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 14,
                fill: 0xffffff,
                align: 'center'
            }));
            resumeText.anchor.set(0.5);
            resumeText.x = this.width / 2;
            resumeText.y = this.height / 2 + 30;
            resumeText.userData = { isGameStateMessage: true };
            uiLayer.addChild(resumeText);
        } else if (this.gameState === 'gameOver') {
            const gameOverStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 24,
                fill: 0xff0000,
                fontWeight: 'bold',
                stroke: 0x000000,
                strokeThickness: 3,
                align: 'center'
            });
            
            const gameOverText = new PIXI.Text('GAME OVER', gameOverStyle);
            gameOverText.anchor.set(0.5);
            gameOverText.x = this.width / 2;
            gameOverText.y = this.height / 2 - 30;
            gameOverText.userData = { isGameStateMessage: true };
            uiLayer.addChild(gameOverText);
            
            const finalScoreText = new PIXI.Text(`Final Score: ${Utils.formatScore(this.score)}`, new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 14,
                fill: 0xffffff,
                align: 'center'
            }));
            finalScoreText.anchor.set(0.5);
            finalScoreText.x = this.width / 2;
            finalScoreText.y = this.height / 2;
            finalScoreText.userData = { isGameStateMessage: true };
            uiLayer.addChild(finalScoreText);
            
            const restartText = new PIXI.Text('Press SPACE to restart', new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 14,
                fill: 0xffffff,
                align: 'center'
            }));
            restartText.anchor.set(0.5);
            restartText.x = this.width / 2;
            restartText.y = this.height / 2 + 20;
            restartText.userData = { isGameStateMessage: true };
            uiLayer.addChild(restartText);
        }
    }
    
    updateStatsPanel() {
        const statsPanel = document.getElementById('game-stats-panel');
        if (!statsPanel) return;
        
        const statsContent = statsPanel.querySelector('.stats-content');
        if (!statsContent) return;
        
        const capturePercentage = (this.capturedArea / this.totalArea) * 100;
        
        statsContent.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Score</div>
                <div class="stat-value">${Utils.formatScore(this.score)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Lives</div>
                <div class="stat-value">${this.lives}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Level</div>
                <div class="stat-value">${this.level}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Time</div>
                <div class="stat-value">${Math.ceil(this.timeLeft)}s</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Captured</div>
                <div class="stat-value">${Math.round(capturePercentage * 100) / 100}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Direction</div>
                <div class="stat-value">${this.wallDirection.toUpperCase()}</div>
            </div>
        `;
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw background pattern
        this.drawBackground();
        
        // Apply screen shake
        let shake = { x: 0, y: 0 };
        if (this.screenEffects && typeof this.screenEffects.getShakeOffset === 'function') {
            shake = this.screenEffects.getShakeOffset();
        }
        this.ctx.save();
        this.ctx.translate(shake.x, shake.y);
        
        // Draw captured areas (black fill)
        this.ctx.fillStyle = '#000000';
        for (let wall of this.walls) {
            if (wall.capturedAreas) {
                for (let area of wall.capturedAreas) {
                    this.ctx.fillRect(area.x, area.y, area.width, area.height);
                }
            }
        }
        
        // Draw completed walls
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        
        for (let wall of this.walls) {
            this.ctx.beginPath();
            this.ctx.moveTo(wall.startX, wall.startY);
            this.ctx.lineTo(wall.endX, wall.endY);
            this.ctx.stroke();
            
            // Add glow
            this.ctx.shadowColor = '#ffffff';
            this.ctx.shadowBlur = 8;
            this.ctx.beginPath();
            this.ctx.moveTo(wall.startX, wall.startY);
            this.ctx.lineTo(wall.endX, wall.endY);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        // Draw current extending wall
        if (this.currentWall) {
            this.ctx.strokeStyle = '#00ffff';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([8, 4]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentWall.startX, this.currentWall.startY);
            this.ctx.lineTo(this.currentWall.endX, this.currentWall.endY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Add glow for extending wall
            this.ctx.shadowColor = '#00ffff';
            this.ctx.shadowBlur = 12;
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentWall.startX, this.currentWall.startY);
            this.ctx.lineTo(this.currentWall.endX, this.currentWall.endY);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            
            // Draw click point indicator
            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(this.currentWall.clickX, this.currentWall.clickY, 4, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.shadowColor = '#ffff00';
            this.ctx.shadowBlur = 8;
            this.ctx.beginPath();
            this.ctx.arc(this.currentWall.clickX, this.currentWall.clickY, 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
        
        // Draw cursor preview when not drawing
        if (!this.isDrawing && this.gameState === 'playing') {
            this.drawCursorPreview();
        }
        
        // Draw balls (red like original Jezzball)
        for (let ball of this.balls) {
            this.ctx.fillStyle = ball.color;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add glow
            this.ctx.shadowColor = ball.color;
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
        
        this.ctx.restore();
        
        // Draw particles
        if (this.particles && typeof this.particles.draw === 'function') {
            this.particles.draw(this.ctx);
        }
        
        // Draw UI
        this.drawUI();
        
        // Draw screen effects
        if (this.screenEffects && typeof this.screenEffects.drawFlash === 'function') {
            this.screenEffects.drawFlash();
        }
    }
    
    drawCursorPreview() {
        // Draw preview line showing where wall would be drawn
        this.ctx.strokeStyle = '#666666';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        
        if (this.wallDirection === 'horizontal') {
            this.ctx.beginPath();
            this.ctx.moveTo(0, this.mouse.y);
            this.ctx.lineTo(this.width, this.mouse.y);
            this.ctx.stroke();
        } else {
            this.ctx.beginPath();
            this.ctx.moveTo(this.mouse.x, 0);
            this.ctx.lineTo(this.mouse.x, this.height);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
        
        // Draw cursor crosshair
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(this.mouse.x - 10, this.mouse.y);
        this.ctx.lineTo(this.mouse.x + 10, this.mouse.y);
        this.ctx.moveTo(this.mouse.x, this.mouse.y - 10);
        this.ctx.lineTo(this.mouse.x, this.mouse.y + 10);
        this.ctx.stroke();
    }
    
    drawUI() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.fillText(`Score: ${Utils.formatScore(this.score)}`, 10, 25);
        this.ctx.fillText(`Lives: ${this.lives}`, 10, 45);
        this.ctx.fillText(`Level: ${this.level}`, 10, 65);
        this.ctx.fillText(`Time: ${Math.ceil(this.timeLeft)}`, 10, 85);
        
        // Show capture percentage
        const capturePercentage = (this.capturedArea / this.totalArea) * 100;
        this.ctx.fillText(`Captured: ${Math.round(capturePercentage * 100) / 100}%`, 10, 105);
        
        // Show wall direction
        this.ctx.fillText(`Direction: ${this.wallDirection.toUpperCase()}`, 10, 125);
        
        // Draw game state messages
        if (this.gameState === 'menu') {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.font = '24px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('CONTAINMENT GRID', this.width / 2, this.height / 2 - 50);
            this.ctx.font = '14px Courier New';
            this.ctx.fillText('Capture 75% of the area!', this.width / 2, this.height / 2 - 20);
            this.ctx.fillText('Left click: Start wall', this.width / 2, this.height / 2);
            this.ctx.fillText('Right click or Ctrl: Change direction', this.width / 2, this.height / 2 + 20);
            this.ctx.fillText('Press SPACE to start', this.width / 2, this.height / 2 + 50);
            this.ctx.textAlign = 'left';
        } else if (this.gameState === 'paused') {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '24px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
            this.ctx.font = '14px Courier New';
            this.ctx.fillText('Press P to resume', this.width / 2, this.height / 2 + 30);
            this.ctx.textAlign = 'left';
        } else if (this.gameState === 'gameOver') {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = '24px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 30);
            this.ctx.font = '14px Courier New';
            this.ctx.fillText(`Final Score: ${Utils.formatScore(this.score)}`, this.width / 2, this.height / 2);
            this.ctx.fillText('Press SPACE to restart', this.width / 2, this.height / 2 + 20);
            this.ctx.textAlign = 'left';
        }
    }
    
    drawPreview() {
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw some bouncing balls
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.arc(50, 50, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(150, 100, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw some lines
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(20, 20);
        this.ctx.lineTo(180, 20);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(20, 130);
        this.ctx.lineTo(180, 130);
        this.ctx.stroke();
        
        // Draw title
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('CONTAINMENT GRID', this.width / 2, this.height - 10);
        this.ctx.textAlign = 'left';
    }
    
    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        
        if (this.isPreview) {
            this.draw();
            requestAnimationFrame(this.gameLoop);
        } else {
            // PixiJS handles rendering automatically, but we still need to update our draw calls
            this.drawPixi();
        }
    }
    
    cleanup() {
        // Remove ticker if using PixiJS
        if (!this.isPreview && this.graphics) {
            const ticker = this.graphics.getTicker();
            if (ticker && this.tickerCallback) {
                ticker.remove(this.tickerCallback);
            }
            
            // Clean up PixiJS app
            if (this.graphics.app) {
                this.graphics.app.destroy(true, { children: true, texture: true, baseTexture: true });
            }
        }
        
        // Clean up sprites
        if (!this.isPreview) {
            this.ballSprites = [];
            this.wallSprites = [];
            this.capturedAreaSprites = [];
            this.cursorPreviewSprite = null;
            this.currentWallSprite = null;
        }
    }
}

function initJezzball() {
    const canvas = document.getElementById('jezzball-preview');
    if (canvas) {
        new JezzballGame(canvas);
    }
}
