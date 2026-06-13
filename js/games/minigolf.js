// Mini Golf game implementation - PixiJS version
class MinigolfGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Check if this is a preview canvas (smaller, in lobby)
        this.isPreview = this.width < 400;
        
        // For preview, use Canvas 2D (simpler, smaller)
        if (this.isPreview) {
            this.ctx = canvas.getContext('2d');
            this.graphics = null;
            this.spriteManager = null;
            this.nesEffects = null;
            this.gameAssets = null;
            this.onReady = null;
        } else {
            // For main game, use PixiJS
            this.ctx = null;
            this.graphics = new GraphicsCore(canvas, {
                width: this.width,
                height: this.height,
                backgroundColor: 0x1a5530, // Green course background
                pixelPerfect: true
            });
        }
        
        // Game state
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.score = 0; // Total strokes across all holes
        this.currentHole = 0; // 0-indexed (0-17 for 18 holes)
        this.strokesOnHole = 0;
        this.isDestroyed = false; // Flag to prevent updates after cleanup
        
        // Ball properties
        this.ball = {
            x: 0,
            y: 0,
            radius: 8,
            vx: 0,
            vy: 0,
            color: '#ffffff',
            isMoving: false
        };
        
        // Aiming/power system
        this.aiming = {
            isAiming: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            minDragDistance: 10
        };
        
        // Physics constants
        this.friction = 0.98;
        this.bounceCoefficient = 0.75;
        this.minVelocity = 0.1; // Below this, ball is considered stopped
        this.maxSinkSpeed = 1.2; // Maximum velocity to sink ball (lower = harder to drop)
        
        // Current hole data
        this.currentHoleData = null;
        
        // Hole definitions (18 holes)
        this.holes = [];
        this.initializeHoles();
        
        // Sinking animation
        this.sinking = {
            isActive: false,
            scale: 1,
            alpha: 1,
            duration: 0,
            maxDuration: 300, // milliseconds
            startTime: 0 // Track absolute time for fallback
        };
        
        // Speed warning feedback
        this.speedWarning = {
            isActive: false,
            duration: 0,
            maxDuration: 500
        };
        
        // Initialize input
        this.mouseDownHandler = null;
        this.mouseMoveHandler = null;
        this.mouseUpHandler = null;
        this.keydownHandler = null;
        this.keyupHandler = null;
        this.keys = {};
        this.setupInput();
        
        // Initialize SNES-style texture cache (will be populated after graphics init)
        this.textureCache = {};
        
        // Initialize graphics and start loop
        if (this.isPreview) {
            this.drawPreview();
        } else {
            this.initGraphics();
        }
    }
    
    async initSpriteTextures() {
        if (!this.gameAssets) return;
        this.ballTexture = await this.gameAssets.loadKey('ball');
        this.holeTexture = await this.gameAssets.loadKey('hole');
        this.flagTexture = await this.gameAssets.loadKey('flag');
    }

    // Initialize SNES-style textures for grass, sand, water, walls, etc.
    initTextures() {
        if (this.isPreview) return; // Skip textures for preview
        
        // Check if PIXI is available
        if (typeof PIXI === 'undefined' || !PIXI.BaseTexture) {
            console.warn('PixiJS not available for texture creation');
            return;
        }
        
        // Create texture generation functions
        this.textureCache = {
            grass: this.createGrassTexture(),
            sand: this.createSandTexture(),
            water: this.createWaterTexture(),
            wall: this.createWallTexture(),
            wallTop: this.createWallTopTexture(),
            brick: this.createBrickTexture()
        };
    }
    
    // Create tiled grass texture with SNES-style depth
    createGrassTexture() {
        const tileSize = 32;
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d');
        
        // Base green
        ctx.fillStyle = '#4a8f5a';
        ctx.fillRect(0, 0, tileSize, tileSize);
        
        // Add texture pattern - darker spots
        ctx.fillStyle = '#3d7549';
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * tileSize;
            const y = Math.random() * tileSize;
            ctx.fillRect(x, y, 3, 3);
        }
        
        // Lighter highlights
        ctx.fillStyle = '#5ca66b';
        for (let i = 0; i < 4; i++) {
            const x = Math.random() * tileSize;
            const y = Math.random() * tileSize;
            ctx.fillRect(x, y, 2, 2);
        }
        
        const baseTexture = PIXI.BaseTexture.from(canvas);
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return new PIXI.Texture(baseTexture);
    }
    
    // Create sand texture
    createSandTexture() {
        const tileSize = 32;
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d');
        
        // Base sand color
        ctx.fillStyle = '#e8d4a8';
        ctx.fillRect(0, 0, tileSize, tileSize);
        
        // Add granular texture
        ctx.fillStyle = '#d4c098';
        for (let i = 0; i < 12; i++) {
            const x = Math.random() * tileSize;
            const y = Math.random() * tileSize;
            ctx.fillRect(x, y, 2, 2);
        }
        
        // Lighter highlights
        ctx.fillStyle = '#f5e6c8';
        for (let i = 0; i < 6; i++) {
            const x = Math.random() * tileSize;
            const y = Math.random() * tileSize;
            ctx.fillRect(x, y, 1, 1);
        }
        
        const baseTexture = PIXI.BaseTexture.from(canvas);
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return new PIXI.Texture(baseTexture);
    }
    
    // Create water texture with ripples
    createWaterTexture() {
        const tileSize = 32;
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d');
        
        // Base water blue
        ctx.fillStyle = '#2e86ab';
        ctx.fillRect(0, 0, tileSize, tileSize);
        
        // Darker blue ripples
        ctx.fillStyle = '#1f5f7a';
        for (let i = 0; i < 4; i++) {
            const x = i * 8 + 4;
            const y = i * 6 + 3;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Light blue highlights
        ctx.fillStyle = '#4ea8d4';
        for (let i = 0; i < 3; i++) {
            const x = (i + 1) * 10;
            const y = (i + 1) * 8;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        const baseTexture = PIXI.BaseTexture.from(canvas);
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return new PIXI.Texture(baseTexture);
    }
    
    // Create wall texture with wood grain
    createWallTexture() {
        const width = 16;
        const height = 32;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Base brown
        ctx.fillStyle = '#8b5a3c';
        ctx.fillRect(0, 0, width, height);
        
        // Wood grain lines
        ctx.strokeStyle = '#6b4423';
        ctx.lineWidth = 1;
        for (let i = 0; i < height; i += 4) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i + 1);
            ctx.stroke();
        }
        
        // Highlights
        ctx.fillStyle = '#a67c52';
        ctx.fillRect(2, 0, 3, height);
        
        // Shadows
        ctx.fillStyle = '#6b4423';
        ctx.fillRect(width - 3, 0, 2, height);
        
        const baseTexture = PIXI.BaseTexture.from(canvas);
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return new PIXI.Texture(baseTexture);
    }
    
    // Create wall top texture (for 3D effect)
    createWallTopTexture() {
        const size = 16;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Top face - lighter
        ctx.fillStyle = '#a67c52';
        ctx.fillRect(0, 0, size, size);
        
        // Wood grain on top
        ctx.strokeStyle = '#8b5a3c';
        ctx.lineWidth = 1;
        for (let i = 2; i < size; i += 3) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(size, i);
            ctx.stroke();
        }
        
        // Highlight edge
        ctx.fillStyle = '#c49a6b';
        ctx.fillRect(0, 0, size, 2);
        
        const baseTexture = PIXI.BaseTexture.from(canvas);
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return new PIXI.Texture(baseTexture);
    }
    
    // Create brick texture for bumpers
    createBrickTexture() {
        const width = 32;
        const height = 16;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Base brick red
        ctx.fillStyle = '#b85450';
        ctx.fillRect(0, 0, width, height);
        
        // Brick outline
        ctx.strokeStyle = '#8b4035';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);
        
        // Mortar lines
        ctx.fillStyle = '#d4c098';
        ctx.fillRect(0, 6, width, 2);
        ctx.fillRect(0, height - 6, width, 2);
        ctx.fillRect(15, 0, 2, height);
        
        // Highlight
        ctx.fillStyle = '#d4706a';
        ctx.fillRect(2, 2, width - 4, 2);
        
        // Shadow
        ctx.fillStyle = '#8b4035';
        ctx.fillRect(2, height - 4, width - 4, 2);
        
        const baseTexture = PIXI.BaseTexture.from(canvas);
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return new PIXI.Texture(baseTexture);
    }
    
    initializeHoles() {
        // Course area boundaries (leaving margins for walls)
        const margin = 50;
        const courseWidth = this.width - margin * 2;
        const courseHeight = this.height - margin * 2;
        
        // Initialize 18 holes with varied layouts
        for (let i = 0; i < 18; i++) {
            const hole = this.createHole(i, margin, courseWidth, courseHeight);
            this.holes.push(hole);
        }
    }
    
    createHole(holeNumber, margin, courseWidth, courseHeight) {
        return buildMinigolfHole(holeNumber, margin, courseWidth, courseHeight, this.ball.radius);
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
            if (!activeCanvas || activeCanvas !== this.canvas) {
                return;
            }
            
            this.keys[e.code] = true;
            
            // Handle Space to start game
            if (e.code === 'Space' && this.gameState === 'menu') {
                e.preventDefault();
                this.startGame();
            }
            
            // Handle P for pause
            if (e.code === 'KeyP' && this.gameState === 'playing') {
                this.gameState = 'paused';
            } else if (e.code === 'KeyP' && this.gameState === 'paused') {
                this.gameState = 'playing';
            }
            
            // Debug mode: Jump to specific holes
            // Numbers 1-9 for holes 1-9, 0 for hole 10, Shift+1-8 for holes 11-18
            if (this.gameState === 'menu' || this.gameState === 'playing' || this.gameState === 'paused') {
                let targetHole = null;
                
                // Check number keys
                if (e.code.startsWith('Digit')) {
                    const digit = parseInt(e.code.replace('Digit', ''));
                    if (e.shiftKey) {
                        // Shift + number = holes 11-18
                        if (digit >= 1 && digit <= 8) {
                            targetHole = 10 + digit; // 11-18
                        }
                    } else {
                        // Regular number = holes 1-10
                        if (digit >= 1 && digit <= 9) {
                            targetHole = digit - 1; // 0-8 (holes 1-9)
                        } else if (digit === 0) {
                            targetHole = 9; // Hole 10
                        }
                    }
                }
                
                if (targetHole !== null && targetHole >= 0 && targetHole < 18) {
                    // Debug: Jump to specific hole
                    this.currentHole = targetHole;
                    this.totalStrokes = 0; // Reset total for debug testing
                    this.loadHole(this.currentHole);
                    this.gameState = 'playing';
                }
            }
        };
        
        this.keyupHandler = (e) => {
            this.keys[e.code] = false;
        };
        
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        
        // Mouse input
        this.mouseDownHandler = (e) => {
            // Don't handle input if modals are open
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal && nameEntryModal.classList.contains('active')) {
                return;
            }
            
            // Only handle input if this is the active game
            const activeCanvas = document.getElementById('game-canvas');
            if (!activeCanvas || activeCanvas !== this.canvas) {
                return;
            }
            
            // Only allow aiming when game is playing and ball is not moving
            if (this.gameState !== 'playing' || this.ball.isMoving || this.sinking.isActive) {
                return;
            }
            
            // Get mouse position relative to canvas
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Check if click is near the ball
            const distToBall = Utils.distance(x, y, this.ball.x, this.ball.y);
            if (distToBall <= this.ball.radius + 10) {
                this.aiming.isAiming = true;
                this.aiming.startX = this.ball.x;
                this.aiming.startY = this.ball.y;
                this.aiming.currentX = x;
                this.aiming.currentY = y;
            }
        };
        
        this.mouseMoveHandler = (e) => {
            if (!this.aiming.isAiming) return;
            
            const rect = this.canvas.getBoundingClientRect();
            // Allow tracking even outside canvas for power extension
            this.aiming.currentX = e.clientX - rect.left;
            this.aiming.currentY = e.clientY - rect.top;
        };
        
        // Track mouse globally when aiming
        this.globalMouseMoveHandler = (e) => {
            if (!this.aiming.isAiming) return;
            
            const rect = this.canvas.getBoundingClientRect();
            this.aiming.currentX = e.clientX - rect.left;
            this.aiming.currentY = e.clientY - rect.top;
        };
        
        this.mouseUpHandler = (e) => {
            if (!this.aiming.isAiming) return;
            
            this.aiming.isAiming = false;
            
            // Ensure we have valid coordinates (allow mouseup outside canvas)
            const rect = this.canvas.getBoundingClientRect();
            if (e.clientX !== undefined && e.clientY !== undefined) {
                this.aiming.currentX = e.clientX - rect.left;
                this.aiming.currentY = e.clientY - rect.top;
            }
            
            // Calculate power and direction
            const dx = this.aiming.currentX - this.aiming.startX;
            const dy = this.aiming.currentY - this.aiming.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Only shoot if dragged far enough
            if (distance >= this.aiming.minDragDistance) {
                const power = Math.min(distance / 20, 30); // Max power of 30 (stronger shots)
                // Reverse direction - drag away from where ball will go (like pulling back a golf club)
                const angle = Math.atan2(dy, dx) + Math.PI;
                
                // Set ball velocity
                this.ball.vx = Math.cos(angle) * power;
                this.ball.vy = Math.sin(angle) * power;
                this.ball.isMoving = true;
                
                // Increment stroke counter
                this.strokesOnHole++;
                this.score++;
                if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'putt');
            }
        };
        
        // Global mouseup handler for when released outside canvas
        this.globalMouseUpHandler = (e) => {
            if (!this.aiming.isAiming) return;
            // Call the same handler
            this.mouseUpHandler(e);
        };
        
        this.canvas.addEventListener('mousedown', this.mouseDownHandler);
        this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
        this.canvas.addEventListener('mouseup', this.mouseUpHandler);
        // Add global mouse handlers for tracking outside canvas
        document.addEventListener('mousemove', this.globalMouseMoveHandler);
        document.addEventListener('mouseup', this.globalMouseUpHandler);
    }
    
    async initGraphics() {
        if (this.isPreview) return;
        
        if (this.graphics && typeof this.graphics.init === 'function') {
            await this.graphics.init();
        }
        
        if (!this.graphics || !this.graphics.isInitialized) {
            console.error('Graphics initialization failed');
            return;
        }

        this.spriteManager = new SpriteManager(this.graphics);
        this.nesEffects = this.graphics.getScreenEffects();
        this.gameAssets = new GameAssetHelper(this.spriteManager, 'minigolf');
        if (this.gameAssets) await this.gameAssets.preloadAll();
        await this.initSpriteTextures();

        this.initTextures();
        
        // Set up ticker callback with safety check
        this.tickerCallback = (deltaTime) => {
            // Safety check - don't run if destroyed or graphics app is destroyed
            if (this.isDestroyed || !this.graphics || !this.graphics.app || this.graphics.app.destroyed) {
                return;
            }
            // PixiJS ticker deltaTime - multiply by 16.67 to convert to milliseconds (assuming 60fps)
            // deltaTime is typically 1.0 at 60fps, so multiply by ~16.67ms per frame
            // Ensure minimum delta to prevent stuck animations
            const deltaMs = Math.max(deltaTime * 16.67, 1);
            this.gameLoop(deltaMs);
        };
        
        const ticker = this.graphics.getTicker();
        if (ticker) {
            ticker.add(this.tickerCallback);
        }
        
        // Start initial render
        this.drawPixi();
        
        if (ticker && !ticker.started) {
            this.graphics.start();
        }

        if (typeof this.onReady === 'function') {
            this.onReady();
        }
    }
    
    gameLoop(deltaTime) {
        // Don't continue if destroyed
        if (this.isDestroyed) return;
        
        // Safety check - if graphics app is being destroyed, stop the loop
        if (!this.isPreview && this.graphics && this.graphics.app && this.graphics.app.destroyed) {
            return;
        }
        
        // Always call update to handle sinking animation
        this.update(deltaTime);
        
        if (this.isPreview) {
            if (!this.isDestroyed) {
                this.drawPreview();
                requestAnimationFrame((dt) => this.gameLoop(dt));
            }
        } else {
            this.drawPixi();
        }
    }
    
    update(deltaTime) {
        // Don't update if destroyed
        if (this.isDestroyed) return;
        
        // Always update sinking animation (even when paused or game over)
        // This MUST be checked first and MUST continue to run even if gameState isn't 'playing'
        if (this.sinking.isActive) {
            // Ensure deltaTime is valid (fallback to ~16ms if 0 or invalid)
            const validDelta = deltaTime > 0 && deltaTime < 100 ? deltaTime : 16.67;
            this.sinking.duration += validDelta;
            
            // Fallback: Use absolute time if deltaTime accumulation isn't working
            const elapsedTime = Date.now() - this.sinking.startTime;
            if (elapsedTime > this.sinking.maxDuration && this.sinking.duration < this.sinking.maxDuration) {
                // DeltaTime accumulation failed, use absolute time instead
                this.sinking.duration = this.sinking.maxDuration;
            }
            
            // Clamp progress to prevent overshooting
            const progress = Math.min(this.sinking.duration / this.sinking.maxDuration, 1);
            this.sinking.scale = 1 - progress * 0.8;
            this.sinking.alpha = 1 - progress;
            
            // Check if animation completed - be generous with the check
            if (this.sinking.duration >= this.sinking.maxDuration || progress >= 0.99 || elapsedTime > this.sinking.maxDuration + 100) {
                // Immediately advance to next hole
                const oldHole = this.currentHole;
                this.sinking.isActive = false;
                this.sinking.duration = 0;
                this.nextHole();
                // Safety check - if nextHole didn't work, force advance
                if (this.currentHole === oldHole && oldHole < 17) {
                    this.currentHole++;
                    this.loadHole(this.currentHole);
                    this.gameState = 'playing';
                }
                return; // Don't update other game logic during transition
            }
            // Continue updating even during sinking (for animations)
        }
        
        if (this.gameState !== 'playing') return;
        
        // Update speed warning
        if (this.speedWarning.isActive) {
            this.speedWarning.duration += deltaTime;
            if (this.speedWarning.duration >= this.speedWarning.maxDuration) {
                this.speedWarning.isActive = false;
                this.speedWarning.duration = 0;
            }
        }
        
        // Update obstacles (windmills, rotating barriers)
        if (this.currentHoleData && this.currentHoleData.obstacles) {
            this.currentHoleData.obstacles.forEach(obstacle => {
                if (obstacle.type === 'windmill') {
                    obstacle.rotation += obstacle.rotationSpeed;
                } else if (obstacle.type === 'rotatingBarrier') {
                    obstacle.rotation += obstacle.rotationSpeed;
                }
            });
        }
        
        // Update ball physics if moving
        if (this.ball.isMoving && !this.sinking.isActive) {
            // Apply friction
            this.ball.vx *= this.friction;
            this.ball.vy *= this.friction;

            if (this.currentHoleData && this.currentHoleData.breakZones) {
                for (const zone of this.currentHoleData.breakZones) {
                    const d = Utils.distance(this.ball.x, this.ball.y, zone.x, zone.y);
                    if (d < zone.radius) {
                        this.ball.vx += Math.cos(zone.biasAngle) * zone.strength;
                        this.ball.vy += Math.sin(zone.biasAngle) * zone.strength;
                    }
                }
            }
            
            const oldX = this.ball.x;
            const oldY = this.ball.y;
            
            // Update position
            this.ball.x += this.ball.vx;
            this.ball.y += this.ball.vy;
            
            // Check if ball stopped
            const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
            const wasMoving = this.ball.isMoving;
            if (speed < this.minVelocity) {
                this.ball.isMoving = false;
                this.ball.vx = 0;
                this.ball.vy = 0;
            }
            
            // Check wall collisions with swept collision detection (prevents tunneling)
            this.checkWallCollisions(oldX, oldY);
            
            // Check obstacle collisions (pass old position for water entry detection)
            this.checkObstacleCollisions(oldX, oldY);
            
            // Check hole detection (while moving)
            this.checkHoleDetection();
            
            // If ball just stopped, check hole detection one more time
            if (wasMoving && !this.ball.isMoving) {
                this.checkHoleDetection();
            }
        } else if (!this.ball.isMoving && !this.sinking.isActive) {
            // Ball is stopped but not sinking - check if it's in the hole
            this.checkHoleDetection();
        }
    }
    
    checkWallCollisions(oldX, oldY) {
        if (!this.currentHoleData) return;
        
        const ball = this.ball;
        
        // Use swept collision detection to prevent tunneling through walls
        // Check collision along the entire movement path
        const dx = ball.x - (oldX || ball.x);
        const dy = ball.y - (oldY || ball.y);
        const movementDist = Math.sqrt(dx * dx + dy * dy);
        
        // If not moving, just check current position
        if (movementDist < 0.1) {
            oldX = ball.x;
            oldY = ball.y;
        }
        
        for (let wall of this.currentHoleData.walls) {
            const [x1, y1, x2, y2] = wall;
            
            // Swept circle-line segment collision detection
            const collision = this.sweptCircleLineCollision(
                oldX || ball.x, oldY || ball.y, ball.x, ball.y, ball.radius,
                x1, y1, x2, y2
            );
            
            if (collision) {
                // Collision detected - calculate reflection
                const lineLength = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
                if (lineLength === 0) continue; // Skip zero-length walls
                
                // Calculate the closest point on the line segment to the collision point
                const lineDx = x2 - x1;
                const lineDy = y2 - y1;
                const toCollisionX = collision.x - x1;
                const toCollisionY = collision.y - y1;
                const t = Math.max(0, Math.min(1, (toCollisionX * lineDx + toCollisionY * lineDy) / (lineLength * lineLength)));
                const closestX = x1 + t * lineDx;
                const closestY = y1 + t * lineDy;
                
                // Calculate vector from closest point on line to collision point (ball center)
                const fromLineX = collision.x - closestX;
                const fromLineY = collision.y - closestY;
                const fromLineDist = Math.sqrt(fromLineX * fromLineX + fromLineY * fromLineY);
                
                // Normal vector pointing from the line toward the ball
                // If ball is exactly on the line (shouldn't happen), use perpendicular vector
                let nx, ny;
                if (fromLineDist > 0.001) {
                    // Normalize the vector from line to ball
                    nx = fromLineX / fromLineDist;
                    ny = fromLineY / fromLineDist;
                } else {
                    // Ball is very close to line, use perpendicular vector
                    // Choose direction based on velocity to push ball back
                    const perpX = -(y2 - y1) / lineLength;
                    const perpY = (x2 - x1) / lineLength;
                    
                    // Determine which side using the old position (before collision)
                    const oldToLineDx = (oldX || ball.x) - x1;
                    const oldToLineDy = (oldY || ball.y) - y1;
                    const crossProd = oldToLineDx * lineDy - oldToLineDy * lineDx;
                    
                    // Normal points away from where ball came from
                    const normalDir = crossProd > 0 ? 1 : -1;
                    nx = normalDir * perpX;
                    ny = normalDir * perpY;
                }
                
                // Move ball to collision point
                ball.x = collision.x;
                ball.y = collision.y;
                
                // Reflect velocity
                const dot = ball.vx * nx + ball.vy * ny;
                ball.vx -= 2 * dot * nx * this.bounceCoefficient;
                ball.vy -= 2 * dot * ny * this.bounceCoefficient;
                if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'bounce');
                
                // Move ball slightly away from wall to prevent stuck
                // Push in the direction of the normal (away from wall)
                const pushDistance = ball.radius - collision.distance + 3; // Extra padding
                ball.x += nx * pushDistance;
                ball.y += ny * pushDistance;
                
                // Safety check: verify ball is now outside the wall
                // If still inside, push it further
                const safetyDist = this.distanceToLineSegment(ball.x, ball.y, x1, y1, x2, y2);
                if (safetyDist < ball.radius) {
                    // Still inside wall - push further out
                    const extraPush = (ball.radius - safetyDist) + 2;
                    ball.x += nx * extraPush;
                    ball.y += ny * extraPush;
                }
            }
        }
        
        // Final safety check: ensure ball isn't inside any wall after all collisions
        // This catches any edge cases where collision was missed
        for (let wall of this.currentHoleData.walls) {
            const [x1, y1, x2, y2] = wall;
            const dist = this.distanceToLineSegment(ball.x, ball.y, x1, y1, x2, y2);
            
            if (dist < ball.radius) {
                // Ball is inside wall - push it out
                const lineLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                if (lineLength === 0) continue;
                
                const lineDx = x2 - x1;
                const lineDy = y2 - y1;
                const toBallX = ball.x - x1;
                const toBallY = ball.y - y1;
                const t = Math.max(0, Math.min(1, (toBallX * lineDx + toBallY * lineDy) / (lineLength * lineLength)));
                const closestX = x1 + t * lineDx;
                const closestY = y1 + t * lineDy;
                
                const fromLineX = ball.x - closestX;
                const fromLineY = ball.y - closestY;
                const fromLineDist = Math.sqrt(fromLineX * fromLineX + fromLineY * fromLineY);
                
                if (fromLineDist > 0.001) {
                    const nx = fromLineX / fromLineDist;
                    const ny = fromLineY / fromLineDist;
                    const pushDist = (ball.radius - dist) + 2;
                    ball.x += nx * pushDist;
                    ball.y += ny * pushDist;
                } else {
                    // Use perpendicular vector
                    const perpX = -(y2 - y1) / lineLength;
                    const perpY = (x2 - x1) / lineLength;
                    const pushDist = ball.radius - dist + 2;
                    // Push in direction away from line center
                    const centerX = (x1 + x2) / 2;
                    const centerY = (y1 + y2) / 2;
                    const toCenterX = ball.x - centerX;
                    const toCenterY = ball.y - centerY;
                    const dot = toCenterX * perpX + toCenterY * perpY;
                    const dir = dot > 0 ? 1 : -1;
                    ball.x += dir * perpX * pushDist;
                    ball.y += dir * perpY * pushDist;
                }
            }
        }
    }
    
    // Swept circle-line segment collision detection
    sweptCircleLineCollision(cx0, cy0, cx1, cy1, radius, x1, y1, x2, y2) {
        // Check along the movement path first with more accurate detection
        const dx = cx1 - cx0;
        const dy = cy1 - cy0;
        const movementDist = Math.sqrt(dx * dx + dy * dy);
        
        // If movement is very small, just check current position
        if (movementDist < 0.1) {
            const currentDist = this.distanceToLineSegment(cx1, cy1, x1, y1, x2, y2);
            if (currentDist < radius) {
                return {
                    x: cx1,
                    y: cy1,
                    distance: currentDist
                };
            }
            return null;
        }
        
        // Use much finer steps - at least 2 steps per radius, up to 50 steps
        // This ensures we catch collisions even at very high speeds
        const minSteps = Math.max(20, Math.ceil(movementDist / (radius * 0.25)));
        const steps = Math.min(minSteps, 50); // Cap at 50 for performance
        
        let firstCollision = null;
        let lastValidPos = { x: cx0, y: cy0, dist: this.distanceToLineSegment(cx0, cy0, x1, y1, x2, y2) };
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const testX = cx0 + dx * t;
            const testY = cy0 + dy * t;
            
            const dist = this.distanceToLineSegment(testX, testY, x1, y1, x2, y2);
            
            if (dist < radius) {
                // Found collision - use previous valid position as collision point
                // Use binary search between last valid and current position for precision
                if (!firstCollision) {
                    firstCollision = this.findExactCollisionPoint(
                        lastValidPos.x, lastValidPos.y, testX, testY, radius, x1, y1, x2, y2
                    );
                }
                
                if (firstCollision) {
                    return firstCollision;
                }
            } else {
                // Still valid - update last valid position
                lastValidPos = { x: testX, y: testY, dist: dist };
            }
        }
        
        // Final check at end position
        const currentDist = this.distanceToLineSegment(cx1, cy1, x1, y1, x2, y2);
        if (currentDist < radius) {
            return {
                x: cx1,
                y: cy1,
                distance: currentDist
            };
        }
        
        return null;
    }
    
    // Binary search to find exact collision point
    findExactCollisionPoint(x0, y0, x1, y1, radius, wallX1, wallY1, wallX2, wallY2, iterations = 5) {
        let low = 0;
        let high = 1;
        let bestT = 0;
        
        // Binary search for collision point
        for (let i = 0; i < iterations; i++) {
            const mid = (low + high) / 2;
            const testX = x0 + (x1 - x0) * mid;
            const testY = y0 + (y1 - y0) * mid;
            const dist = this.distanceToLineSegment(testX, testY, wallX1, wallY1, wallX2, wallY2);
            
            if (dist < radius) {
                high = mid;
                bestT = mid;
            } else {
                low = mid;
            }
        }
        
        const collisionX = x0 + (x1 - x0) * bestT;
        const collisionY = y0 + (y1 - y0) * bestT;
        const finalDist = this.distanceToLineSegment(collisionX, collisionY, wallX1, wallY1, wallX2, wallY2);
        
        return {
            x: collisionX,
            y: collisionY,
            distance: finalDist
        };
    }
    
    distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq === 0) {
            return Utils.distance(px, py, x1, y1);
        }
        
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        return Utils.distance(px, py, projX, projY);
    }
    
    checkObstacleCollisions(oldX, oldY) {
        if (!this.currentHoleData || !this.currentHoleData.obstacles) return;
        if (!this.ball.isMoving) return;
        
        const ball = this.ball;
        const currentTime = Date.now();
        // Use old position if provided, otherwise fall back to current position
        const prevX = oldX !== undefined ? oldX : ball.x;
        const prevY = oldY !== undefined ? oldY : ball.y;
        
        for (let obstacle of this.currentHoleData.obstacles) {
            // Update obstacle state (gates, rotating barriers)
            if (obstacle.type === 'movingGate') {
                if (!obstacle.lastToggleTime) {
                    obstacle.lastToggleTime = currentTime;
                }
                if (currentTime - obstacle.lastToggleTime >= obstacle.toggleInterval) {
                    obstacle.isOpen = !obstacle.isOpen;
                    obstacle.lastToggleTime = currentTime;
                }
                
                // Check collision with closed gate
                if (!obstacle.isOpen) {
                    const distX = Math.abs(ball.x - obstacle.x);
                    const distY = Math.abs(ball.y - obstacle.y);
                    const halfWidth = obstacle.width / 2;
                    const halfHeight = obstacle.height / 2;
                    
                    if (distX < halfWidth + ball.radius && distY < halfHeight + ball.radius) {
                        // Collision with gate - bounce back
                        const angle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                        ball.vx = -Math.cos(angle) * Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * this.bounceCoefficient;
                        ball.vy = -Math.sin(angle) * Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * this.bounceCoefficient;
                        
                        // Push ball out
                        const overlap = Math.min(halfWidth + ball.radius - distX, halfHeight + ball.radius - distY);
                        ball.x += Math.cos(angle) * overlap;
                        ball.y += Math.sin(angle) * overlap;
                    }
                }
            } else if (obstacle.type === 'windmill') {
                const dist = Utils.distance(ball.x, ball.y, obstacle.x, obstacle.y);
                
                if (dist < ball.radius + obstacle.radius) {
                    // Collision with windmill
                    const angle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                    
                    // Push ball out
                    const overlap = (ball.radius + obstacle.radius) - dist;
                    ball.x += Math.cos(angle) * overlap;
                    ball.y += Math.sin(angle) * overlap;
                    
                    // Deflect ball (add some rotation influence)
                    const normalAngle = angle + Math.PI / 2;
                    const dot = ball.vx * Math.cos(normalAngle) + ball.vy * Math.sin(normalAngle);
                    ball.vx -= 2 * dot * Math.cos(normalAngle) * this.bounceCoefficient;
                    ball.vy -= 2 * dot * Math.sin(normalAngle) * this.bounceCoefficient;
                    
                    // Add some angular velocity from windmill rotation
                    const tangentSpeed = obstacle.rotationSpeed * obstacle.radius * 20;
                    ball.vx += Math.cos(angle + Math.PI / 2) * tangentSpeed * 0.3;
                    ball.vy += Math.sin(angle + Math.PI / 2) * tangentSpeed * 0.3;
                }
            } else if (obstacle.type === 'sand') {
                // Sand slows the ball significantly
                const dist = Utils.distance(ball.x, ball.y, obstacle.x, obstacle.y);
                if (dist < obstacle.radius) {
                    // Apply heavy friction - much more impactful
                    this.ball.vx *= 0.88; // Very heavy friction (was 0.92)
                    this.ball.vy *= 0.88;
                    if (!obstacle._sandSoundPlayed) {
                        obstacle._sandSoundPlayed = true;
                        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'sand');
                    }
                } else {
                    obstacle._sandSoundPlayed = false;
                }
            } else if (obstacle.type === 'water') {
                // Water slows the ball and adds drag
                // For Hole 13 and Hole 15, water adds a stroke penalty and resets ball
                const isHole13 = this.currentHole === 12; // Hole 13 is case 12 (0-indexed)
                const isHole15 = this.currentHole === 14; // Hole 15 is case 14 (0-indexed)
                
                let inWater = false;
                let waterEdgeX = ball.x;
                let waterEdgeY = ball.y;
                let wasOutside = true;
                
                if (obstacle.width && obstacle.height) {
                    // Rectangular water
                    const distX = Math.abs(ball.x - obstacle.x);
                    const distY = Math.abs(ball.y - obstacle.y);
                    const prevDistX = Math.abs(prevX - obstacle.x);
                    const prevDistY = Math.abs(prevY - obstacle.y);
                    wasOutside = prevDistX >= obstacle.width / 2 || prevDistY >= obstacle.height / 2;
                    
                    if (distX < obstacle.width / 2 && distY < obstacle.height / 2) {
                        inWater = true;
                        // Find edge where ball entered - use previous position to determine entry
                        if (!obstacle.entryPoint || wasOutside) {
                            // Ball just entered - find entry point on edge
                            // Determine which edge was crossed by checking previous position
                            const dx = ball.x - prevX;
                            const dy = ball.y - prevY;
                            const t = 0; // Parameter for line intersection (start from edge)
                            
                            // Find intersection with water rectangle edges
                            let entryFound = false;
                            // Check top/bottom edges
                            if (dy !== 0) {
                                const tTop = (obstacle.y - obstacle.height / 2 - prevY) / dy;
                                const tBottom = (obstacle.y + obstacle.height / 2 - prevY) / dy;
                                if (tTop >= 0 && tTop <= 1 && prevX + dx * tTop >= obstacle.x - obstacle.width / 2 && 
                                    prevX + dx * tTop <= obstacle.x + obstacle.width / 2) {
                                    waterEdgeX = prevX + dx * tTop;
                                    waterEdgeY = obstacle.y - obstacle.height / 2;
                                    entryFound = true;
                                } else if (tBottom >= 0 && tBottom <= 1 && prevX + dx * tBottom >= obstacle.x - obstacle.width / 2 && 
                                           prevX + dx * tBottom <= obstacle.x + obstacle.width / 2) {
                                    waterEdgeX = prevX + dx * tBottom;
                                    waterEdgeY = obstacle.y + obstacle.height / 2;
                                    entryFound = true;
                                }
                            }
                            // Check left/right edges
                            if (!entryFound && dx !== 0) {
                                const tLeft = (obstacle.x - obstacle.width / 2 - prevX) / dx;
                                const tRight = (obstacle.x + obstacle.width / 2 - prevX) / dx;
                                if (tLeft >= 0 && tLeft <= 1 && prevY + dy * tLeft >= obstacle.y - obstacle.height / 2 && 
                                    prevY + dy * tLeft <= obstacle.y + obstacle.height / 2) {
                                    waterEdgeX = obstacle.x - obstacle.width / 2;
                                    waterEdgeY = prevY + dy * tLeft;
                                    entryFound = true;
                                } else if (tRight >= 0 && tRight <= 1 && prevY + dy * tRight >= obstacle.y - obstacle.height / 2 && 
                                           prevY + dy * tRight <= obstacle.y + obstacle.height / 2) {
                                    waterEdgeX = obstacle.x + obstacle.width / 2;
                                    waterEdgeY = prevY + dy * tRight;
                                    entryFound = true;
                                }
                            }
                            
                            // Fallback: use closest edge if intersection not found
                            if (!entryFound) {
                                const entryAngle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                                const edgeDistX = obstacle.width / 2;
                                const edgeDistY = obstacle.height / 2;
                                if (Math.abs(Math.cos(entryAngle)) > Math.abs(Math.sin(entryAngle))) {
                                    waterEdgeX = obstacle.x + (Math.cos(entryAngle) > 0 ? edgeDistX : -edgeDistX);
                                    waterEdgeY = obstacle.y;
                                } else {
                                    waterEdgeX = obstacle.x;
                                    waterEdgeY = obstacle.y + (Math.sin(entryAngle) > 0 ? edgeDistY : -edgeDistY);
                                }
                            }
                            
                            obstacle.entryPoint = { x: waterEdgeX, y: waterEdgeY };
                        } else {
                            waterEdgeX = obstacle.entryPoint.x;
                            waterEdgeY = obstacle.entryPoint.y;
                        }
                    }
                } else if (obstacle.innerRadius) {
                    // Ring/moat water
                    const dist = Utils.distance(ball.x, ball.y, obstacle.x, obstacle.y);
                    const prevDist = Utils.distance(prevX, prevY, obstacle.x, obstacle.y);
                    wasOutside = prevDist >= obstacle.radius || prevDist <= obstacle.innerRadius;
                    
                    if (dist < obstacle.radius && dist > obstacle.innerRadius) {
                        inWater = true;
                        // Find edge point on outer radius where ball entered
                        if (!obstacle.entryPoint || wasOutside) {
                            // Use direction from previous position to current to find entry point
                            const angle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                            waterEdgeX = obstacle.x + Math.cos(angle) * obstacle.radius;
                            waterEdgeY = obstacle.y + Math.sin(angle) * obstacle.radius;
                            obstacle.entryPoint = { x: waterEdgeX, y: waterEdgeY };
                        } else {
                            waterEdgeX = obstacle.entryPoint.x;
                            waterEdgeY = obstacle.entryPoint.y;
                        }
                    }
                } else {
                    // Circular water
                    const dist = Utils.distance(ball.x, ball.y, obstacle.x, obstacle.y);
                    const prevDist = Utils.distance(prevX, prevY, obstacle.x, obstacle.y);
                    wasOutside = prevDist >= obstacle.radius;
                    
                    if (dist < obstacle.radius) {
                        inWater = true;
                        // Find edge point on circle where ball entered
                        if (!obstacle.entryPoint || wasOutside) {
                            // Use direction from previous position to current to find entry point
                            const angle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                            waterEdgeX = obstacle.x + Math.cos(angle) * obstacle.radius;
                            waterEdgeY = obstacle.y + Math.sin(angle) * obstacle.radius;
                            obstacle.entryPoint = { x: waterEdgeX, y: waterEdgeY };
                        } else {
                            waterEdgeX = obstacle.entryPoint.x;
                            waterEdgeY = obstacle.entryPoint.y;
                        }
                    }
                }
                
                if (inWater) {
                    if (wasOutside && typeof audioManager !== 'undefined') {
                        audioManager.playGameSfx('minigolf', 'water');
                    }
                    if ((isHole13 || isHole15) && !obstacle.penaltyApplied) {
                        // Hole 13 and Hole 15 special penalty: add stroke and reset ball
                        this.strokesOnHole++;
                        this.score++;
                        this.updateStatsPanel();
                        
                        // Reset ball to entry point on water edge
                        ball.x = waterEdgeX;
                        ball.y = waterEdgeY;
                        ball.vx = 0;
                        ball.vy = 0;
                        ball.isMoving = false;
                        
                        obstacle.penaltyApplied = true;
                        
                        // Visual feedback
                        if (!this.isPreview && this.graphics && this.graphics.getScreenEffects) {
                            const screenEffects = this.graphics.getScreenEffects();
                            if (screenEffects) {
                                screenEffects.flash(0xff0000, 8, 0.5);
                                screenEffects.shake(5, 10);
                            }
                        }
                    } else if (!isHole13 && !isHole15) {
                        // Other holes: just heavy water drag
                        this.ball.vx *= 0.90;
                        this.ball.vy *= 0.90;
                    }
                } else {
                    // Ball left water, reset penalty flag
                    if (isHole13 || isHole15) {
                        obstacle.penaltyApplied = false;
                        obstacle.entryPoint = null;
                    }
                }
                
                // Track ball position for entry detection
                obstacle.lastBallX = ball.x;
                obstacle.lastBallY = ball.y;
            } else if (obstacle.type === 'jumpPad') {
                // Jump pad boosts the ball when touched
                const dist = Utils.distance(ball.x, ball.y, obstacle.x, obstacle.y);
                if (dist < (obstacle.radius || 25) + ball.radius) {
                    // Boost ball speed in current direction
                    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                    const angle = Math.atan2(ball.vy, ball.vx);
                    const boost = 3; // Speed boost
                    ball.vx = Math.cos(angle) * (speed + boost);
                    ball.vy = Math.sin(angle) * (speed + boost);
                    
                    // Push ball off pad
                    const overlap = (obstacle.radius || 25) + ball.radius - dist;
                    const padAngle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                    ball.x += Math.cos(padAngle) * overlap;
                    ball.y += Math.sin(padAngle) * overlap;
                }
            } else if (obstacle.type === 'ramp' || obstacle.type === 'slope') {
                // Ramps and slopes affect ball velocity
                const w = obstacle.width || 80;
                const h = obstacle.height || 30;
                const distX = Math.abs(ball.x - obstacle.x);
                const distY = Math.abs(ball.y - obstacle.y);
                
                if (distX < w / 2 && distY < h / 2) {
                    // Ball is on ramp - add acceleration based on ramp angle
                    const angle = obstacle.angle || Math.PI / 6;
                    const gravity = 0.3; // Gravity effect
                    ball.vx += Math.sin(angle) * gravity * Math.cos(angle);
                    ball.vy -= Math.cos(angle) * gravity * Math.sin(angle);
                }
            } else if (obstacle.type === 'brick' || obstacle.type === 'plank') {
                // Rectangular obstacles - check collision
                const distX = Math.abs(ball.x - obstacle.x);
                const distY = Math.abs(ball.y - obstacle.y);
                const halfWidth = (obstacle.width || 60) / 2;
                const halfHeight = (obstacle.height || 20) / 2;
                
                if (distX < halfWidth + ball.radius && distY < halfHeight + ball.radius) {
                    // Collision with rectangular obstacle
                    const angle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                    
                    // Determine which side was hit
                    let normalX = 0;
                    let normalY = 0;
                    if (distX / halfWidth > distY / halfHeight) {
                        // Hit vertical side
                        normalX = ball.x > obstacle.x ? 1 : -1;
                    } else {
                        // Hit horizontal side
                        normalY = ball.y > obstacle.y ? 1 : -1;
                    }
                    
                    // Reflect velocity
                    const dot = ball.vx * normalX + ball.vy * normalY;
                    ball.vx -= 2 * dot * normalX * this.bounceCoefficient;
                    ball.vy -= 2 * dot * normalY * this.bounceCoefficient;
                    
                    // Push ball out
                    const overlap = Math.min(halfWidth + ball.radius - distX, halfHeight + ball.radius - distY);
                    ball.x += normalX * overlap;
                    ball.y += normalY * overlap;
                }
            } else if (obstacle.type === 'rotatingBarrier') {
                // Rotating barrier collision
                const length = obstacle.length || 80;
                const thickness = obstacle.thickness || 8;
                const angle = obstacle.rotation || 0;
                const pivotX = obstacle.pivotX || obstacle.x;
                const pivotY = obstacle.pivotY || obstacle.y;
                
                // Calculate barrier endpoints
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const barrierX1 = pivotX + cos * (-length / 2);
                const barrierY1 = pivotY + sin * (-length / 2);
                const barrierX2 = pivotX + cos * (length / 2);
                const barrierY2 = pivotY + sin * (length / 2);
                
                // Check collision with barrier line segment
                const dist = this.distanceToLineSegment(ball.x, ball.y, barrierX1, barrierY1, barrierX2, barrierY2);
                
                if (dist < ball.radius + thickness / 2) {
                    // Collision with rotating barrier
                    const lineAngle = Math.atan2(barrierY2 - barrierY1, barrierX2 - barrierX1);
                    const normalX = -Math.sin(lineAngle);
                    const normalY = Math.cos(lineAngle);
                    
                    // Reflect velocity
                    const dot = ball.vx * normalX + ball.vy * normalY;
                    ball.vx -= 2 * dot * normalX * this.bounceCoefficient;
                    ball.vy -= 2 * dot * normalY * this.bounceCoefficient;
                    
                    // Add rotation influence
                    const tangentSpeed = obstacle.rotationSpeed * length * 10;
                    ball.vx += Math.cos(lineAngle) * tangentSpeed * 0.2;
                    ball.vy += Math.sin(lineAngle) * tangentSpeed * 0.2;
                    
                    // Push ball out
                    const overlap = ball.radius + thickness / 2 - dist;
                    ball.x += normalX * overlap;
                    ball.y += normalY * overlap;
                }
            }
        }
    }
    
    checkHoleDetection() {
        if (!this.currentHoleData) return;
        if (this.sinking.isActive) return; // Don't check if already sinking
        
        const ball = this.ball;
        const hole = this.currentHoleData;
        const dist = Utils.distance(ball.x, ball.y, hole.holeX, hole.holeY);
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        
        // Use slightly larger detection radius for more forgiving hole detection
        const detectionRadius = hole.holeRadius + 2;
        
        // Check if ball is in hole range
        if (dist < detectionRadius) {
            // Check if ball is slow enough to sink (moving slow or stopped in hole)
            const canSink = (speed <= this.maxSinkSpeed && this.ball.isMoving) || (!this.ball.isMoving && speed < this.minVelocity);
            
            if (canSink) {
                // Ball sinks successfully - only trigger if not already sinking
                if (!this.sinking.isActive) {
                    this.ball.isMoving = false;
                    this.ball.vx = 0;
                    this.ball.vy = 0;
                    this.sinking.isActive = true;
                    this.sinking.duration = 0;
                    this.sinking.scale = 1;
                    this.sinking.alpha = 1;
                    this.sinking.startTime = Date.now(); // Track when sinking started
                    if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'sink');
                    
                    // Stop the ball at hole center
                    this.ball.x = hole.holeX;
                    this.ball.y = hole.holeY;
                    
                    // Screen effect
                    if (!this.isPreview && this.graphics && this.graphics.getScreenEffects) {
                        const screenEffects = this.graphics.getScreenEffects();
                        if (screenEffects) {
                            screenEffects.flash(0x00ff00, 5, 0.3);
                        }
                    }
                }
            } else if (hole.cupLip && speed > this.maxSinkSpeed) {
                const lipAngle = Math.atan2(ball.y - hole.holeY, ball.x - hole.holeX);
                ball.vx = Math.cos(lipAngle) * speed * 0.6;
                ball.vy = Math.sin(lipAngle) * speed * 0.6;
                ball.x = hole.holeX + Math.cos(lipAngle) * (detectionRadius + ball.radius * 0.5);
                ball.y = hole.holeY + Math.sin(lipAngle) * (detectionRadius + ball.radius * 0.5);
            } else if (speed > this.maxSinkSpeed && !this.speedWarning.isActive) {
                // Ball too fast - show warning
                this.speedWarning.isActive = true;
                this.speedWarning.duration = 0;
                
                // Visual feedback
                if (!this.isPreview && this.graphics && this.graphics.getScreenEffects) {
                    const screenEffects = this.graphics.getScreenEffects();
                    if (screenEffects) {
                        screenEffects.shake(3, 5);
                    }
                }
            }
        }
    }
    
    drawPreview() {
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        // Background
        ctx.fillStyle = '#1a5530';
        ctx.fillRect(0, 0, width, height);
        
        // Draw simple course preview
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, height / 2);
        ctx.lineTo(width - 20, height / 2);
        ctx.stroke();
        
        // Ball
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(30, height / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Hole
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(width - 30, height / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('MINI GOLF', width / 2, height - 10);
    }
    
    drawPixi() {
        if (!this.graphics || this.isDestroyed) return;
        
        // Safety checks - if graphics app is being destroyed or cleanup is in progress, don't draw
        if (!this.graphics.app || this.graphics.app.destroyed) {
            return;
        }
        if (!this.graphics.app.renderer || this.graphics.app.renderer.destroyed) {
            return;
        }
        
        const bgLayer = this.graphics.getLayer('background');
        const gameLayer = this.graphics.getLayer('foreground');
        const uiLayer = this.graphics.getLayer('ui');
        
        // Clear layers - destroy all children to prevent memory leaks
        // Use try-catch to handle any errors during cleanup
        try {
            while (bgLayer && bgLayer.children.length > 0) {
                const child = bgLayer.children[0];
                bgLayer.removeChild(child);
                if (child && child.destroy) {
                    child.destroy({ children: true });
                }
            }
            while (gameLayer && gameLayer.children.length > 0) {
                const child = gameLayer.children[0];
                gameLayer.removeChild(child);
                if (child && child.destroy) {
                    child.destroy({ children: true });
                }
            }
            while (uiLayer && uiLayer.children.length > 0) {
                const child = uiLayer.children[0];
                uiLayer.removeChild(child);
                if (child && child.destroy) {
                    child.destroy({ children: true });
                }
            }
        } catch (e) {
            console.warn('Error during layer cleanup in drawPixi:', e);
            // If cleanup fails, we're likely being destroyed - just return
            return;
        }
        
        if (this.gameState === 'menu' || this.gameState === 'gameOver') {
            this.drawMenuPixi(uiLayer);
            if (this.gameState === 'menu') {
                return;
            }
        }
        
        if (!this.currentHoleData && this.gameState !== 'menu' && this.gameState !== 'gameOver') return;
        
        // Don't draw course in menu state
        if (this.gameState === 'menu' || this.gameState === 'gameOver') {
            return;
        }
        
        // Draw course background
        this.drawCourse(bgLayer);
        
        this.drawBreakZones(gameLayer);

        // Draw hole
        this.drawHole(gameLayer);
        
        // Draw obstacles
        this.drawObstacles(gameLayer);
        
        // Draw walls
        this.drawWalls(gameLayer);
        
        // Draw ball
        this.drawBall(gameLayer);
        
        // Draw aiming indicator
        if (this.aiming.isAiming && !this.ball.isMoving) {
            this.drawAimIndicator(gameLayer);
        }
        
        // Draw UI
        this.drawUIPixi(uiLayer);
        
        // Update stats panel
        this.updateStatsPanel();
    }
    
    drawMenuPixi(uiLayer) {
        const title = new PIXI.Text('MINI GOLF', {
            fontFamily: 'Courier New',
            fontSize: 48,
            fill: 0xffffff,
            align: 'center'
        });
        title.anchor.set(0.5);
        title.x = this.width / 2;
        title.y = this.height / 2 - 40;
        uiLayer.addChild(title);
        
        const subtitle = new PIXI.Text('Press SPACE to Start', {
            fontFamily: 'Courier New',
            fontSize: 24,
            fill: 0xaaaaaa,
            align: 'center'
        });
        subtitle.anchor.set(0.5);
        subtitle.x = this.width / 2;
        subtitle.y = this.height / 2 + 20;
        uiLayer.addChild(subtitle);
        
        // Draw game over screen
        if (this.gameState === 'gameOver') {
            const gameOverText = new PIXI.Text('GAME OVER', {
                fontFamily: 'Courier New',
                fontSize: 36,
                fill: 0xffff00,
                align: 'center'
            });
            gameOverText.anchor.set(0.5);
            gameOverText.x = this.width / 2;
            gameOverText.y = this.height / 2 + 80;
            uiLayer.addChild(gameOverText);
            
            const finalScore = new PIXI.Text(`Final Score: ${this.score} strokes`, {
                fontFamily: 'Courier New',
                fontSize: 20,
                fill: 0xffffff,
                align: 'center'
            });
            finalScore.anchor.set(0.5);
            finalScore.x = this.width / 2;
            finalScore.y = this.height / 2 + 130;
            uiLayer.addChild(finalScore);
        }
    }
    
    drawCourse(bgLayer) {
        // Draw textured grass course area
        if (this.textureCache && this.textureCache.grass) {
            // Create tiled grass background
            const tileSize = 32;
            for (let x = 0; x < this.width; x += tileSize) {
                for (let y = 0; y < this.height; y += tileSize) {
                    const sprite = new PIXI.Sprite(this.textureCache.grass);
                    sprite.x = x;
                    sprite.y = y;
                    bgLayer.addChild(sprite);
                }
            }
        } else {
            // Fallback to solid color
            const course = new PIXI.Graphics();
            course.beginFill(0x4a8f5a);
            course.drawRect(0, 0, this.width, this.height);
            course.endFill();
            bgLayer.addChild(course);
        }
    }
    
    drawBreakZones(gameLayer) {
        if (!this.currentHoleData || !this.currentHoleData.breakZones) return;
        for (const zone of this.currentHoleData.breakZones) {
            const gfx = new PIXI.Graphics();
            gfx.lineStyle(1, 0xffffff, 0.15);
            gfx.drawCircle(zone.x, zone.y, zone.radius);
            const len = zone.radius * 0.6;
            const ax = zone.x + Math.cos(zone.biasAngle) * len;
            const ay = zone.y + Math.sin(zone.biasAngle) * len;
            gfx.lineStyle(2, 0xffffaa, 0.25);
            gfx.moveTo(zone.x, zone.y);
            gfx.lineTo(ax, ay);
            gameLayer.addChild(gfx);
        }
    }

    drawHole(gameLayer) {
        if (!this.currentHoleData) return;
        
        const hole = this.currentHoleData;
        
        if (this.holeTexture) {
            const holeSprite = new PIXI.Sprite(this.holeTexture);
            holeSprite.anchor.set(0.5);
            holeSprite.x = hole.holeX;
            holeSprite.y = hole.holeY;
            holeSprite.width = hole.holeRadius * 2.4;
            holeSprite.height = hole.holeRadius * 2.4;
            gameLayer.addChild(holeSprite);
        } else {
            // Draw hole (black circle)
            const holeGraphics = new PIXI.Graphics();
            holeGraphics.beginFill(0x000000);
            holeGraphics.drawCircle(hole.holeX, hole.holeY, hole.holeRadius);
            holeGraphics.endFill();
            
            // Add inner shadow effect
            holeGraphics.beginFill(0x1a1a1a);
            holeGraphics.drawCircle(hole.holeX, hole.holeY, hole.holeRadius * 0.7);
            holeGraphics.endFill();
            
            gameLayer.addChild(holeGraphics);
        }

        if (this.flagTexture) {
            const flagSprite = new PIXI.Sprite(this.flagTexture);
            flagSprite.x = hole.holeX - 6;
            flagSprite.y = hole.holeY - hole.holeRadius - 38;
            flagSprite.width = 22;
            flagSprite.height = 42;
            gameLayer.addChild(flagSprite);
        } else {
            const flag = new PIXI.Graphics();
            flag.lineStyle(2, 0xffffff, 1);
            flag.moveTo(hole.holeX, hole.holeY - hole.holeRadius);
            flag.lineTo(hole.holeX, hole.holeY - hole.holeRadius - 30);
            flag.beginFill(0xff0000);
            flag.drawPolygon([
                hole.holeX, hole.holeY - hole.holeRadius - 30,
                hole.holeX + 14, hole.holeY - hole.holeRadius - 22,
                hole.holeX, hole.holeY - hole.holeRadius - 14
            ]);
            flag.endFill();
            gameLayer.addChild(flag);
        }
    }
    
    drawObstacles(gameLayer) {
        if (!this.currentHoleData || !this.currentHoleData.obstacles) return;
        
        for (let obstacle of this.currentHoleData.obstacles) {
            if (obstacle.type === 'windmill') {
                const windmill = new PIXI.Graphics();
                
                // Draw windmill base with SNES-style depth
                windmill.beginFill(0x6b4423); // Darker brown for shadow
                windmill.drawCircle(obstacle.x + 2, obstacle.y + 2, obstacle.radius * 0.3);
                windmill.endFill();
                windmill.beginFill(0x8b4513); // Base brown
                windmill.drawCircle(obstacle.x, obstacle.y, obstacle.radius * 0.3);
                windmill.endFill();
                
                // Draw rotating blades with better visuals
                windmill.lineStyle(4, 0x654321, 1);
                for (let i = 0; i < obstacle.blades; i++) {
                    const angle = obstacle.rotation + (i * Math.PI * 2 / obstacle.blades);
                    const startX = obstacle.x + Math.cos(angle) * obstacle.radius * 0.4;
                    const startY = obstacle.y + Math.sin(angle) * obstacle.radius * 0.4;
                    const endX = obstacle.x + Math.cos(angle) * obstacle.radius;
                    const endY = obstacle.y + Math.sin(angle) * obstacle.radius;
                    
                    windmill.moveTo(startX, startY);
                    windmill.lineTo(endX, endY);
                }
                
                gameLayer.addChild(windmill);
            } else if (obstacle.type === 'sand') {
                // Draw sand trap with texture
                const sand = new PIXI.Graphics();
                if (this.textureCache && this.textureCache.sand) {
                    const sandSprite = new PIXI.Sprite(this.textureCache.sand);
                    sandSprite.x = obstacle.x - obstacle.radius;
                    sandSprite.y = obstacle.y - obstacle.radius;
                    sandSprite.width = obstacle.radius * 2;
                    sandSprite.height = obstacle.radius * 2;
                    gameLayer.addChild(sandSprite);
                } else {
                    sand.beginFill(0xe8d4a8);
                    sand.drawCircle(obstacle.x, obstacle.y, obstacle.radius);
                    sand.endFill();
                    gameLayer.addChild(sand);
                }
            } else if (obstacle.type === 'water') {
                // Draw water with texture
                const water = new PIXI.Graphics();
                if (this.textureCache && this.textureCache.water) {
                    if (obstacle.width && obstacle.height) {
                        // Rectangular water area
                        const waterSprite = new PIXI.TilingSprite(
                            this.textureCache.water,
                            obstacle.width,
                            obstacle.height
                        );
                        waterSprite.x = obstacle.x - obstacle.width / 2;
                        waterSprite.y = obstacle.y - obstacle.height / 2;
                        gameLayer.addChild(waterSprite);
                    } else {
                        // Circular water area
                        const waterSprite = new PIXI.Sprite(this.textureCache.water);
                        const waterSize = obstacle.radius * 2;
                        waterSprite.x = obstacle.x - obstacle.radius;
                        waterSprite.y = obstacle.y - obstacle.radius;
                        waterSprite.width = waterSize;
                        waterSprite.height = waterSize;
                        gameLayer.addChild(waterSprite);
                    }
                } else {
                    water.beginFill(0x2e86ab, 0.8);
                    if (obstacle.width && obstacle.height) {
                        water.drawRect(obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2, 
                                     obstacle.width, obstacle.height);
                    } else {
                        water.drawCircle(obstacle.x, obstacle.y, obstacle.radius);
                    }
                    water.endFill();
                    gameLayer.addChild(water);
                }
            } else if (obstacle.type === 'ramp' || obstacle.type === 'slope') {
                // Draw elevated ramp/slope
                const ramp = new PIXI.Graphics();
                const w = obstacle.width || 80;
                const h = obstacle.height || 30;
                const angle = obstacle.angle || Math.PI / 6;
                
                // Calculate ramp corners
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const x1 = obstacle.x - w / 2;
                const y1 = obstacle.y;
                const x2 = obstacle.x + w / 2;
                const y2 = obstacle.y;
                const x3 = obstacle.x + w / 2;
                const y3 = obstacle.y - h;
                const x4 = obstacle.x - w / 2;
                const y4 = obstacle.y - h;
                
                // Draw ramp face (top)
                ramp.beginFill(0xa67c52); // Light brown for wood
                ramp.drawPolygon([x1, y1, x2, y2, x3, y3, x4, y4]);
                ramp.endFill();
                
                // Draw ramp side (for 3D effect)
                ramp.beginFill(0x6b4423); // Darker brown
                ramp.drawPolygon([x2, y2, x3, y3, x3, y3 + h / 2, x2, y2 + h / 2]);
                ramp.endFill();
                
                // Highlight
                ramp.lineStyle(2, 0xc49a6b, 1);
                ramp.moveTo(x1, y1);
                ramp.lineTo(x2, y2);
                
                gameLayer.addChild(ramp);
            } else if (obstacle.type === 'bridge') {
                // Draw bridge over water
                const bridge = new PIXI.Graphics();
                const w = obstacle.width || 80;
                const h = obstacle.height || pathWidth;
                
                bridge.beginFill(0x8b5a3c); // Wood color
                bridge.drawRect(obstacle.x - w / 2, obstacle.y - h / 2, w, h);
                bridge.endFill();
                
                // Bridge planks
                bridge.lineStyle(1, 0x6b4423, 1);
                for (let i = 1; i < 5; i++) {
                    const plankX = obstacle.x - w / 2 + (w / 5) * i;
                    bridge.moveTo(plankX, obstacle.y - h / 2);
                    bridge.lineTo(plankX, obstacle.y + h / 2);
                }
                
                // Railings
                bridge.lineStyle(3, 0x654321, 1);
                bridge.moveTo(obstacle.x - w / 2, obstacle.y - h / 2);
                bridge.lineTo(obstacle.x + w / 2, obstacle.y - h / 2);
                bridge.moveTo(obstacle.x - w / 2, obstacle.y + h / 2);
                bridge.lineTo(obstacle.x + w / 2, obstacle.y + h / 2);
                
                gameLayer.addChild(bridge);
            } else if (obstacle.type === 'jumpPad') {
                // Draw jump pad (spring/platform)
                const jumpPad = new PIXI.Graphics();
                jumpPad.beginFill(0xff6b6b); // Red/orange for visibility
                jumpPad.drawCircle(obstacle.x, obstacle.y, obstacle.radius || 25);
                jumpPad.endFill();
                
                // Spring lines
                jumpPad.lineStyle(2, 0xffffff, 1);
                for (let i = 0; i < 4; i++) {
                    const angle = (i * Math.PI * 2) / 4;
                    const innerX = obstacle.x + Math.cos(angle) * (obstacle.radius * 0.5);
                    const innerY = obstacle.y + Math.sin(angle) * (obstacle.radius * 0.5);
                    const outerX = obstacle.x + Math.cos(angle) * obstacle.radius;
                    const outerY = obstacle.y + Math.sin(angle) * obstacle.radius;
                    jumpPad.moveTo(innerX, innerY);
                    jumpPad.lineTo(outerX, outerY);
                }
                
                gameLayer.addChild(jumpPad);
            } else if (obstacle.type === 'movingGate') {
                // Draw moving gate (only if closed)
                if (!obstacle.isOpen) {
                    const gate = new PIXI.Graphics();
                    gate.beginFill(0x8b4513); // Brown wood
                    gate.drawRect(obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2,
                                 obstacle.width, obstacle.height);
                    gate.endFill();
                    
                    // Gate highlight
                    gate.lineStyle(2, 0xa67c52, 1);
                    gate.drawRect(obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2,
                                 obstacle.width, obstacle.height);
                    
                    gameLayer.addChild(gate);
                }
            } else if (obstacle.type === 'rotatingBarrier') {
                // Draw rotating barrier
                const barrier = new PIXI.Graphics();
                const length = obstacle.length || 80;
                const thickness = obstacle.thickness || 8;
                const angle = obstacle.rotation || 0;
                
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const x1 = obstacle.pivotX + cos * (-length / 2) - sin * (-thickness / 2);
                const y1 = obstacle.pivotY + sin * (-length / 2) + cos * (-thickness / 2);
                const x2 = obstacle.pivotX + cos * (length / 2) - sin * (-thickness / 2);
                const y2 = obstacle.pivotY + sin * (length / 2) + cos * (-thickness / 2);
                const x3 = obstacle.pivotX + cos * (length / 2) - sin * (thickness / 2);
                const y3 = obstacle.pivotY + sin * (length / 2) + cos * (thickness / 2);
                const x4 = obstacle.pivotX + cos * (-length / 2) - sin * (thickness / 2);
                const y4 = obstacle.pivotY + sin * (-length / 2) + cos * (thickness / 2);
                
                barrier.beginFill(0xb85450); // Red brick color
                barrier.drawPolygon([x1, y1, x2, y2, x3, y3, x4, y4]);
                barrier.endFill();
                
                gameLayer.addChild(barrier);
            } else if (obstacle.type === 'brick') {
                // Draw brick bumper
                const brick = new PIXI.Graphics();
                if (this.textureCache && this.textureCache.brick) {
                    const brickSprite = new PIXI.Sprite(this.textureCache.brick);
                    brickSprite.x = obstacle.x - (obstacle.width || 60) / 2;
                    brickSprite.y = obstacle.y - (obstacle.height || 20) / 2;
                    brickSprite.width = obstacle.width || 60;
                    brickSprite.height = obstacle.height || 20;
                    gameLayer.addChild(brickSprite);
                } else {
                    brick.beginFill(0xb85450);
                    brick.drawRect(obstacle.x - (obstacle.width || 60) / 2,
                                  obstacle.y - (obstacle.height || 20) / 2,
                                  obstacle.width || 60, obstacle.height || 20);
                    brick.endFill();
                    gameLayer.addChild(brick);
                }
            } else if (obstacle.type === 'plank') {
                // Draw wood plank
                const plank = new PIXI.Graphics();
                plank.beginFill(0x8b5a3c);
                plank.drawRect(obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2,
                              obstacle.width, obstacle.height);
                plank.endFill();
                
                // Wood grain
                plank.lineStyle(1, 0x6b4423, 0.5);
                for (let i = 1; i < 4; i++) {
                    const lineX = obstacle.x - obstacle.width / 2 + (obstacle.width / 4) * i;
                    plank.moveTo(lineX, obstacle.y - obstacle.height / 2);
                    plank.lineTo(lineX, obstacle.y + obstacle.height / 2);
                }
                
                gameLayer.addChild(plank);
            }
        }
    }
    
    drawWalls(gameLayer) {
        if (!this.currentHoleData) return;
        
        const wallThickness = 16;
        const useTextures = this.textureCache && this.textureCache.wall && this.textureCache.wallTop;
        
        for (let wall of this.currentHoleData.walls) {
            const [x1, y1, x2, y2] = wall;
            const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const perpAngle = angle + Math.PI / 2;
            const offsetX = Math.cos(perpAngle) * (wallThickness / 2);
            const offsetY = Math.sin(perpAngle) * (wallThickness / 2);
            
            if (useTextures) {
                // Draw 3D wall with SNES-style textures
                // Wall face (side)
                const wallSprite = new PIXI.TilingSprite(
                    this.textureCache.wall,
                    length,
                    wallThickness
                );
                wallSprite.x = x1 - offsetX;
                wallSprite.y = y1 - offsetY;
                wallSprite.rotation = angle;
                wallSprite.pivot.set(0, wallThickness / 2);
                gameLayer.addChild(wallSprite);
                
                // Wall top (for 3D effect)
                const topSprite = new PIXI.TilingSprite(
                    this.textureCache.wallTop,
                    length,
                    wallThickness / 2
                );
                topSprite.x = x1 - offsetX;
                topSprite.y = y1 - offsetY - wallThickness / 4;
                topSprite.rotation = angle;
                topSprite.alpha = 0.7;
                topSprite.pivot.set(0, wallThickness / 4);
                gameLayer.addChild(topSprite);
            } else {
                // Fallback to simple graphics
                const wallGraphics = new PIXI.Graphics();
                wallGraphics.lineStyle(2, 0x6b4423, 1);
                wallGraphics.beginFill(0x8b5a3c, 1);
                
                wallGraphics.drawPolygon([
                    x1 + offsetX, y1 + offsetY,
                    x2 + offsetX, y2 + offsetY,
                    x2 - offsetX, y2 - offsetY,
                    x1 - offsetX, y1 - offsetY
                ]);
                wallGraphics.endFill();
                
                // Add highlight for depth
                wallGraphics.lineStyle(0);
                wallGraphics.beginFill(0xa67c52, 0.5);
                wallGraphics.drawPolygon([
                    x1 + offsetX, y1 + offsetY,
                    x2 + offsetX, y2 + offsetY,
                    x2 + offsetX - 2, y2 + offsetY - 2,
                    x1 + offsetX - 2, y1 + offsetY - 2
                ]);
                wallGraphics.endFill();
                
                gameLayer.addChild(wallGraphics);
            }
        }
    }
    
    drawBall(gameLayer) {
        const ball = this.ball;
        
        if (this.sinking.isActive) {
            if (this.ballTexture) {
                const sprite = new PIXI.Sprite(this.ballTexture);
                sprite.anchor.set(0.5);
                sprite.x = ball.x;
                sprite.y = ball.y;
                sprite.width = ball.radius * 2 * this.sinking.scale;
                sprite.height = ball.radius * 2 * this.sinking.scale;
                sprite.alpha = this.sinking.alpha;
                gameLayer.addChild(sprite);
            } else {
                const ballSprite = new PIXI.Graphics();
                ballSprite.beginFill(parseInt(ball.color.replace('#', '0x')), this.sinking.alpha);
                ballSprite.drawCircle(ball.x, ball.y, ball.radius * this.sinking.scale);
                ballSprite.endFill();
                gameLayer.addChild(ballSprite);
            }
        } else if (this.ballTexture) {
            const sprite = new PIXI.Sprite(this.ballTexture);
            sprite.anchor.set(0.5);
            sprite.x = ball.x;
            sprite.y = ball.y;
            sprite.width = ball.radius * 2;
            sprite.height = ball.radius * 2;
            gameLayer.addChild(sprite);
        } else {
            // Draw normal ball
            const ballSprite = new PIXI.Graphics();
            ballSprite.beginFill(parseInt(ball.color.replace('#', '0x')));
            ballSprite.drawCircle(ball.x, ball.y, ball.radius);
            ballSprite.endFill();
            
            // Add highlight
            ballSprite.beginFill(0xffffff, 0.5);
            ballSprite.drawCircle(ball.x - 3, ball.y - 3, ball.radius * 0.4);
            ballSprite.endFill();
            
            gameLayer.addChild(ballSprite);
        }
    }
    
    drawAimIndicator(gameLayer) {
        const dx = this.aiming.currentX - this.aiming.startX;
        const dy = this.aiming.currentY - this.aiming.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.aiming.minDragDistance) return;
        
        const power = Math.min(distance / 20, 30);
        // Show direction ball will go (opposite of drag direction)
        const dragAngle = Math.atan2(dy, dx);
        const ballAngle = dragAngle + Math.PI; // Reverse direction
        const lineLength = Math.min(distance, 200);
        
        // Draw drag line (where user is dragging)
        const dragLine = new PIXI.Graphics();
        dragLine.lineStyle(2, 0x888888, 0.5);
        dragLine.moveTo(this.ball.x, this.ball.y);
        dragLine.lineTo(
            this.aiming.currentX,
            this.aiming.currentY
        );
        gameLayer.addChild(dragLine);
        
        // Draw aim line (direction ball will go)
        const aimLine = new PIXI.Graphics();
        aimLine.lineStyle(3, 0xffff00, 0.9);
        aimLine.moveTo(this.ball.x, this.ball.y);
        aimLine.lineTo(
            this.ball.x + Math.cos(ballAngle) * lineLength,
            this.ball.y + Math.sin(ballAngle) * lineLength
        );
        gameLayer.addChild(aimLine);
        
        // Draw power indicator
        const powerColor = power > 6 ? 0xff0000 : power > 3 ? 0xffaa00 : 0x00ff00;
        const powerIndicator = new PIXI.Graphics();
        powerIndicator.lineStyle(4, powerColor, 1);
        powerIndicator.moveTo(this.ball.x, this.ball.y);
        const powerLength = power * 15;
        powerIndicator.lineTo(
            this.ball.x + Math.cos(ballAngle) * powerLength,
            this.ball.y + Math.sin(ballAngle) * powerLength
        );
        gameLayer.addChild(powerIndicator);
        
        // Draw power text
        const powerText = new PIXI.Text(`Power: ${power.toFixed(1)}`, {
            fontFamily: 'Courier New',
            fontSize: 14,
            fill: powerColor,
            align: 'center'
        });
        powerText.x = this.ball.x + Math.cos(ballAngle) * (powerLength + 20);
        powerText.y = this.ball.y + Math.sin(ballAngle) * (powerLength + 20);
        powerText.anchor.set(0.5);
        gameLayer.addChild(powerText);
    }
    
    drawUIPixi(uiLayer) {
        // Draw paused overlay
        if (this.gameState === 'paused') {
            const pausedBg = new PIXI.Graphics();
            pausedBg.beginFill(0x000000, 0.7);
            pausedBg.drawRect(0, 0, this.width, this.height);
            pausedBg.endFill();
            uiLayer.addChild(pausedBg);
            
            const pausedText = new PIXI.Text('PAUSED\nPress P to Resume', {
                fontFamily: 'Courier New',
                fontSize: 32,
                fill: 0xffffff,
                align: 'center'
            });
            pausedText.anchor.set(0.5);
            pausedText.x = this.width / 2;
            pausedText.y = this.height / 2;
            uiLayer.addChild(pausedText);
        }
        
        // Draw speed warning if active
        if (this.speedWarning.isActive && this.gameState === 'playing') {
            const warning = new PIXI.Text('TOO FAST!', {
                fontFamily: 'Courier New',
                fontSize: 24,
                fill: 0xff0000,
                align: 'center'
            });
            warning.anchor.set(0.5);
            warning.x = this.width / 2;
            warning.y = 50;
            uiLayer.addChild(warning);
        }
        
        // Draw stroke count and hole info
        if (this.gameState === 'playing' || this.gameState === 'paused') {
            const strokeText = new PIXI.Text(`Hole ${this.currentHole + 1}/18\nStrokes: ${this.strokesOnHole} | Total: ${this.score}`, {
                fontFamily: 'Courier New',
                fontSize: 18,
                fill: 0xffffff,
                align: 'left'
            });
            strokeText.x = 20;
            strokeText.y = 20;
            uiLayer.addChild(strokeText);
            
            // Draw par info
            if (this.currentHoleData) {
                const parText = new PIXI.Text(`Par: ${this.currentHoleData.par}`, {
                    fontFamily: 'Courier New',
                    fontSize: 16,
                    fill: 0xaaaaaa,
                    align: 'left'
                });
                parText.x = 20;
                parText.y = 70;
                uiLayer.addChild(parText);
            }
        }
    }
    
    updateStatsPanel() {
        const statsPanel = document.getElementById('game-stats-panel');
        if (!statsPanel) return;
        
        const statsContent = statsPanel.querySelector('.stats-content');
        if (!statsContent) return;
        
        statsContent.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Current Hole</div>
                <div class="stat-value">${this.currentHole + 1}/18</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Strokes This Hole</div>
                <div class="stat-value">${this.strokesOnHole}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Total Strokes</div>
                <div class="stat-value">${this.score}</div>
            </div>
            ${this.currentHoleData ? `
            <div class="stat-item">
                <div class="stat-label">Par</div>
                <div class="stat-value">${this.currentHoleData.par}</div>
            </div>
            ` : ''}
        `;
    }
    
    startGame() {
        this.gameState = 'playing';
        this.currentHole = 0;
        this.score = 0;
        this.strokesOnHole = 0;
        this.loadHole(this.currentHole);
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'start');
    }
    
    loadHole(holeIndex) {
        if (holeIndex >= this.holes.length) {
            this.gameOver();
            return;
        }
        
        this.currentHoleData = this.holes[holeIndex];
        this.ball.x = this.currentHoleData.startX;
        this.ball.y = this.currentHoleData.startY;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.isMoving = false;
        this.strokesOnHole = 0;
        this.sinking.isActive = false;
        this.speedWarning.isActive = false;
    }
    
    nextHole() {
        // Advance to next hole
        this.currentHole++;
        
        // Reset sinking state
        this.sinking.isActive = false;
        this.sinking.duration = 0;
        this.sinking.scale = 1;
        this.sinking.alpha = 1;
        
        if (this.currentHole < 18) {
            // Load the next hole immediately
            this.loadHole(this.currentHole);
            // Ensure we're in playing state
            this.gameState = 'playing';
        } else {
            // All holes complete
            this.gameOver();
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        if (typeof audioManager !== 'undefined') audioManager.playSfx('gameOver');

        // For minigolf, lower score is better
        // We need to handle this specially since the high score manager assumes higher is better
        if (!highScoreManager.scores['minigolf']) {
            highScoreManager.scores['minigolf'] = [];
        }
        
        const currentHighScores = highScoreManager.scores['minigolf'];
        
        // Check if this is a new low score (lower strokes = better)
        let isNewLowScore = false;
        if (currentHighScores.length === 0) {
            isNewLowScore = true; // First score
        } else if (currentHighScores.length < 10) {
            isNewLowScore = true; // Less than 10 scores, always qualifies
        } else {
            // Check if this score is lower than the highest (worst) score
            const worstScore = Math.max(...currentHighScores.map(s => s.score));
            isNewLowScore = this.score < worstScore;
        }
        
        if (isNewLowScore) {
            // Manually add the score to trigger name entry
            // We'll handle the sorting manually in addScore
            highScoreManager.requestNameEntry('minigolf', this.score);
        }
    }
    
    cleanup() {
        // Set flag to prevent further updates
        this.isDestroyed = true;
        
        // Remove event listeners
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
            this.keyupHandler = null;
        }
        if (this.mouseDownHandler) {
            this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
            this.mouseDownHandler = null;
        }
        if (this.mouseMoveHandler) {
            this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
            this.mouseMoveHandler = null;
        }
        if (this.mouseUpHandler) {
            this.canvas.removeEventListener('mouseup', this.mouseUpHandler);
            this.mouseUpHandler = null;
        }
        if (this.globalMouseMoveHandler) {
            document.removeEventListener('mousemove', this.globalMouseMoveHandler);
            this.globalMouseMoveHandler = null;
        }
        if (this.globalMouseUpHandler) {
            document.removeEventListener('mouseup', this.globalMouseUpHandler);
            this.globalMouseUpHandler = null;
        }
        
        // Clean up PixiJS layers and destroy all children
        if (!this.isPreview && this.graphics) {
            // Stop ticker and remove callback FIRST (before destroying anything)
            const ticker = this.graphics.getTicker();
            if (ticker) {
                // Stop the ticker to prevent any more callbacks
                if (ticker.started) {
                    ticker.stop();
                }
                // Remove callback if it exists
                if (this.tickerCallback) {
                    ticker.remove(this.tickerCallback);
                    this.tickerCallback = null;
                }
            }
            
            // Destroy all layer children BEFORE destroying textures/app
            const layers = ['background', 'midground', 'foreground', 'ui'];
            layers.forEach(layerName => {
                const layer = this.graphics.getLayer(layerName);
                if (layer) {
                    while (layer.children.length > 0) {
                        const child = layer.children[0];
                        layer.removeChild(child);
                        if (child && child.destroy) {
                            try {
                                child.destroy({ children: true, texture: true, baseTexture: true });
                            } catch (e) {
                                console.warn('Error destroying child:', e);
                            }
                        }
                    }
                }
            });
            
            // Destroy textures and their base textures
            if (this.textureCache) {
                Object.keys(this.textureCache).forEach(key => {
                    const texture = this.textureCache[key];
                    if (texture && texture.destroy) {
                        try {
                            // Destroy texture and its baseTexture
                            texture.destroy(true);
                        } catch (e) {
                            console.warn(`Error destroying texture ${key}:`, e);
                        }
                    }
                });
                this.textureCache = {};
            }
            
            // Use GraphicsCore's destroy method for complete cleanup
            // This handles app, renderer, and all internal cleanup
            if (this.graphics && typeof this.graphics.destroy === 'function') {
                try {
                    this.graphics.destroy();
                } catch (e) {
                    console.warn('Error destroying GraphicsCore:', e);
                    // Fallback: manually destroy app if GraphicsCore destroy fails
                    if (this.graphics.app) {
                        try {
                            if (this.graphics.app.ticker && this.graphics.app.ticker.started) {
                                this.graphics.app.stop();
                            }
                            if (this.graphics.app.renderer) {
                                this.graphics.app.renderer.destroy(true);
                            }
                            this.graphics.app.destroy(true, { children: true, texture: true, baseTexture: true });
                        } catch (e2) {
                            console.warn('Error in fallback cleanup:', e2);
                        }
                    }
                }
            } else if (this.graphics && this.graphics.app) {
                // Fallback if destroy method doesn't exist
                try {
                    if (this.graphics.app.ticker && this.graphics.app.ticker.started) {
                        this.graphics.app.stop();
                    }
                    if (this.graphics.app.renderer) {
                        this.graphics.app.renderer.destroy(true);
                    }
                    this.graphics.app.destroy(true, { children: true, texture: true, baseTexture: true });
                } catch (e) {
                    console.warn('Error destroying PixiJS app:', e);
                }
            }
            this.graphics = null;
        }
        
        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Clear references
        this.canvas = null;
        this.currentHoleData = null;
        this.holes = [];
    }
}

// Preview initialization function
function initMinigolf() {
    const canvas = document.getElementById('minigolf-preview');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Background
    ctx.fillStyle = '#1a5530';
    ctx.fillRect(0, 0, width, height);
    
    // Draw simple course preview
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, height / 2);
    ctx.lineTo(width - 20, height / 2);
    ctx.stroke();
    
    // Ball
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(30, height / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Hole
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(width - 30, height / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('MINI GOLF', width / 2, height - 10);
}
