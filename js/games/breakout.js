// Breakout game implementation - PixiJS version
class BreakoutGame {
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
        } else {
            // For main game, use PixiJS
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
        
        // Game objects
        this.paddle = {
            x: this.width / 2 - 60,
            y: this.height - 30,
            width: 120, // Bigger starting paddle
            height: 15,
            speed: 8,
            color: '#00ffff',
            baseWidth: 120,
            minWidth: 60 // Minimum width to prevent it from becoming too difficult
        };
        
        this.ball = {
            x: this.width / 2,
            y: this.height / 2,
            vx: 2, // Much slower starting speed
            vy: -2,
            radius: 8,
            color: '#ffff00',
            baseSpeed: 2 // Base speed for level calculations
        };
        
        this.bricks = [];
        this.powerUps = [];
        this.balls = []; // For multi-ball power-up
        
        // Effects and systems
        if (this.isPreview) {
            // Canvas 2D effects for preview
            this.particles = new ParticleSystem();
            this.screenEffects = new ScreenEffects(canvas);
            this.tweenManager = new TweenManager();
            this.crtFilter = new CRTFilter(canvas);
        } else {
            // PixiJS - use built-in effects (particles will be created per effect)
            this.particles = null; // Will create PixiJS particles as needed
            this.screenEffects = this.nesEffects; // Use NES effects from graphics core
            this.tweenManager = new TweenManager();
            this.crtFilter = null; // CRT filter is handled by NES effects
        }
        
        // PixiJS sprites (only for main game)
        if (!this.isPreview) {
            this.paddleSprite = null;
            this.ballSprite = null;
            this.brickSprites = [];
            this.powerUpSprites = [];
            this.ballSprites = [];
            this.backgroundSprite = null;
        }
        
        // Animation arrays
        this.lifeLossAnimations = [];
        this.uiAnimations = [];
        
        // Motion trails for balls
        this.ballTrail = new MotionTrail(15, 0.92);
        this.ballTrails = []; // For multi-balls
        
        // Power-up types
        this.powerUpTypes = {
            MULTI_BALL: { color: '#ff00ff', effect: 'multiBall' },
            LARGE_PADDLE: { color: '#00ff00', effect: 'largePaddle' },
            EXTRA_LIFE: { color: '#ff0000', effect: 'extraLife' }
        };
        
        // Game state for turn management
        this.waitingForNextTurn = false;
        
        // Paddle power-up state
        this.paddlePowerUpActive = false;
        
        // Background pattern system
        this.backgroundPattern = null;
        this.generateBackgroundPattern();
        
        // Input
        this.keys = {};
        this.setupInput();
        
        // Create initial level
        this.createLevel();
        
        // Initialize game loop binding
        this.lastTime = 0;
        this.animationFrameId = null;
        this.gameLoop = this.gameLoop.bind(this);
        
        // Initialize graphics and start game loop
        if (this.isPreview) {
            requestAnimationFrame(this.gameLoop);
        } else {
            // For main game, initialize PixiJS and then start
            this.initGraphics();
        }
    }
    
    async initGraphics() {
        if (this.isPreview) return;
        
        // Initialize graphics (async for PixiJS v8)
        if (this.graphics && typeof this.graphics.init === 'function') {
            await this.graphics.init();
        }
        
        // Check if initialization succeeded
        if (!this.graphics || !this.graphics.isInitialized) {
            console.error('Graphics initialization failed, falling back to requestAnimationFrame');
            requestAnimationFrame(this.gameLoop);
            return;
        }
        
        // Verify renderer and ticker are available
        if (!this.graphics.app || !this.graphics.app.renderer || !this.graphics.app.ticker) {
            console.error('Graphics app, renderer, or ticker not available');
            requestAnimationFrame(this.gameLoop);
            return;
        }
        
        // Proceed with initialization
        this.finishGraphicsInit();
    }
    
    finishGraphicsInit() {
        // Now create sprite manager and get effects
        this.spriteManager = new SpriteManager(this.graphics);
        this.nesEffects = this.graphics.getScreenEffects();
        
        // Initialize theme manager
        this.themeManager = new ThemeManager(this.graphics);
        this.currentTheme = null;
        
        // Initialize brick break animations
        this.initBrickAnimations();
        
        // Apply initial theme
        this.applyTheme();
        
        // Initialize sprites
        this.initSprites();
        
        // Update brick sprites now that sprite manager is ready
        this.updateBrickSprites();
        
        // Start game loop
        this.startGameLoop();
    }
    
    applyTheme() {
        if (this.isPreview || !this.themeManager) return;
        
        // Apply theme for current level - this creates the background
        this.currentTheme = this.themeManager.applyTheme(this.level);
        
        // Update app background color
        if (this.currentTheme && this.currentTheme.backgroundColor && this.graphics && this.graphics.app) {
            this.graphics.app.renderer.backgroundColor = this.currentTheme.backgroundColor;
        }
        
        // Update paddle color
        if (this.currentTheme && this.currentTheme.colors.paddle) {
            const paddleColor = this.currentTheme.colors.paddle;
            this.paddle.color = '#' + paddleColor.toString(16).padStart(6, '0');
            // Update paddle sprite color
            if (this.paddleSprite) {
                this.paddleSprite.clear();
                this.paddleSprite.beginFill(paddleColor);
                this.paddleSprite.drawRoundedRect(0, 0, this.paddle.width, this.paddle.height, 3);
                this.paddleSprite.endFill();
                this.paddleSprite.lineStyle(2, this.lightenColor(paddleColor, 0.4), 0.8);
                this.paddleSprite.drawRoundedRect(0, 0, this.paddle.width, this.paddle.height, 3);
            }
        }
        
        // Update ball color
        if (this.currentTheme && this.currentTheme.colors.ball) {
            const ballColor = this.currentTheme.colors.ball;
            this.ball.color = '#' + ballColor.toString(16).padStart(6, '0');
            // Update ball sprite color
            if (this.ballSprite) {
                this.ballSprite.clear();
                // Outer glow
                this.ballSprite.beginFill(ballColor, 0.5);
                this.ballSprite.drawCircle(this.ball.radius, this.ball.radius, this.ball.radius + 2);
                this.ballSprite.endFill();
                // Main ball
                this.ballSprite.beginFill(ballColor);
                this.ballSprite.drawCircle(this.ball.radius, this.ball.radius, this.ball.radius);
                this.ballSprite.endFill();
                // Highlight
                this.ballSprite.beginFill(this.lightenColor(ballColor, 0.5), 0.6);
                this.ballSprite.drawCircle(this.ball.radius - 2, this.ball.radius - 2, this.ball.radius * 0.4);
                this.ballSprite.endFill();
            }
        }
    }
    
    startGameLoop() {
        if (this.isPreview) {
            requestAnimationFrame(this.gameLoop);
        } else {
            // Use PixiJS ticker for main game
            const ticker = this.graphics.getTicker();
            if (!ticker) {
                console.error('PixiJS ticker not available, falling back to requestAnimationFrame');
                requestAnimationFrame(this.gameLoop);
            } else {
                ticker.add((tickerObj) => {
                    const deltaTime = tickerObj.deltaTime * 16.67; // Convert to milliseconds
                    this.gameLoop(deltaTime);
                });
            }
        }
    }
    
    // Initialize PixiJS sprites
    initSprites() {
        if (this.isPreview) return;
        
        // Create paddle sprite with enhanced graphics
        const paddleColor = parseInt(this.paddle.color.replace('#', ''), 16);
        this.paddleSprite = new PIXI.Graphics();
        this.paddleSprite.beginFill(paddleColor);
        this.paddleSprite.drawRoundedRect(0, 0, this.paddle.width, this.paddle.height, 3);
        this.paddleSprite.endFill();
        
        // Add glow effect
        this.paddleSprite.lineStyle(2, this.lightenColor(paddleColor, 0.4), 0.8);
        this.paddleSprite.drawRoundedRect(0, 0, this.paddle.width, this.paddle.height, 3);
        
        this.paddleSprite.x = this.paddle.x;
        this.paddleSprite.y = this.paddle.y;
        this.graphics.addToLayer(this.paddleSprite, 'foreground');
        
        // Create ball sprite with glow effect
        const ballColor = parseInt(this.ball.color.replace('#', ''), 16);
        this.ballSprite = new PIXI.Graphics();
        
        // Outer glow
        this.ballSprite.beginFill(ballColor, 0.5);
        this.ballSprite.drawCircle(this.ball.radius, this.ball.radius, this.ball.radius + 2);
        this.ballSprite.endFill();
        
        // Main ball
        this.ballSprite.beginFill(ballColor);
        this.ballSprite.drawCircle(this.ball.radius, this.ball.radius, this.ball.radius);
        this.ballSprite.endFill();
        
        // Highlight
        this.ballSprite.beginFill(this.lightenColor(ballColor, 0.5), 0.6);
        this.ballSprite.drawCircle(this.ball.radius - 2, this.ball.radius - 2, this.ball.radius * 0.4);
        this.ballSprite.endFill();
        
        this.ballSprite.x = this.ball.x - this.ball.radius;
        this.ballSprite.y = this.ball.y - this.ball.radius;
        this.graphics.addToLayer(this.ballSprite, 'foreground');
        
        // Brick sprites will be created in createLevel()
        this.updateBrickSprites();
    }
    
    // Update brick sprites when level changes
    updateBrickSprites() {
        if (this.isPreview) return;
        
        // Don't create sprites if sprite manager isn't ready yet
        if (!this.spriteManager || !this.graphics) {
            return;
        }
        
        // Remove old brick sprites
        if (this.brickSprites) {
            this.brickSprites.forEach(sprite => {
                if (sprite && this.graphics) {
                    this.graphics.remove(sprite);
                }
            });
        }
        this.brickSprites = [];
        
        // Create new brick sprites with enhanced graphics
        for (let brick of this.bricks) {
            // Use colorInt if available, otherwise parse from string
            const brickColor = brick.colorInt || parseInt(brick.color.replace('#', ''), 16);
            
            // Create enhanced brick sprite with border/glow effect
            const brickContainer = new PIXI.Container();
            
            // Main brick
            const mainRect = this.spriteManager.createRect(brick.width, brick.height, brickColor);
            
            // Add border/glow for visual enhancement
            const border = new PIXI.Graphics();
            border.lineStyle(2, this.lightenColor(brickColor, 0.3), 0.8);
            border.drawRect(0, 0, brick.width, brick.height);
            border.endFill();
            
            // Add inner highlight
            const highlight = new PIXI.Graphics();
            highlight.beginFill(this.lightenColor(brickColor, 0.2), 0.5);
            highlight.drawRect(2, 2, brick.width - 4, 5);
            highlight.endFill();
            
            brickContainer.addChild(mainRect);
            brickContainer.addChild(border);
            brickContainer.addChild(highlight);
            
            brickContainer.x = brick.x;
            brickContainer.y = brick.y;
            brickContainer.visible = !brick.destroyed;
            this.graphics.addToLayer(brickContainer, 'foreground');
            this.brickSprites.push(brickContainer);
            brick.sprite = brickContainer; // Link sprite to brick
        }
    }
    
    lightenColor(color, amount) {
        // Lighten a color by amount (0-1)
        const r = Math.min(255, ((color >> 16) & 0xFF) + (255 * amount));
        const g = Math.min(255, ((color >> 8) & 0xFF) + (255 * amount));
        const b = Math.min(255, (color & 0xFF) + (255 * amount));
        return (r << 16) | (g << 8) | b;
    }
    
    // Initialize brick break animations array
    initBrickAnimations() {
        if (!this.brickBreakAnimations) {
            this.brickBreakAnimations = [];
        }
    }
    
    // Animate brick breaking with particle effects
    animateBrickBreak(brick) {
        if (!brick.sprite) return;
        
        // Initialize animations array if needed
        if (!this.brickBreakAnimations) {
            this.brickBreakAnimations = [];
        }
        
        const sprite = brick.sprite;
        const centerX = brick.x + brick.width / 2;
        const centerY = brick.y + brick.height / 2;
        const color = brick.colorInt || parseInt(brick.color.replace('#', ''), 16);
        
        // Create explosion particles
        const particleCount = 8;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 3;
            const size = 3 + Math.random() * 4;
            
            const particle = new PIXI.Graphics();
            particle.beginFill(color);
            particle.drawRect(0, 0, size, size);
            particle.endFill();
            particle.x = centerX;
            particle.y = centerY;
            particle.alpha = 1;
            
            particle.userData = {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02
            };
            
            this.graphics.addToLayer(particle, 'foreground');
            particles.push(particle);
        }
        
        // Create animation object
        const animation = {
            particles: particles,
            sprite: sprite,
            duration: 500, // 500ms
            elapsed: 0,
            update: function(deltaTime) {
                this.elapsed += deltaTime;
                const progress = this.elapsed / this.duration;
                
                // Animate sprite (scale and fade)
                if (this.sprite) {
                    this.sprite.scale.x = 1 - progress;
                    this.sprite.scale.y = 1 - progress;
                    this.sprite.alpha = 1 - progress;
                    this.sprite.rotation += 0.1;
                }
                
                // Update particles
                this.particles.forEach(particle => {
                    if (particle.userData) {
                        particle.x += particle.userData.vx;
                        particle.y += particle.userData.vy;
                        particle.userData.vy += 0.2; // Gravity
                        particle.alpha -= particle.userData.decay;
                        
                        if (particle.alpha <= 0) {
                            particle.visible = false;
                        }
                    }
                });
                
                // Remove particles that are done
                this.particles = this.particles.filter(p => p.alpha > 0);
            },
            isComplete: function() {
                // Complete when sprite is invisible and particles are gone
                const spriteDone = !this.sprite || this.sprite.alpha <= 0;
                const particlesDone = this.particles.length === 0;
                
                if (spriteDone && particlesDone) {
                    // Cleanup
                    if (this.sprite) {
                        this.sprite.visible = false;
                    }
                    this.particles.forEach(p => {
                        if (p.parent) {
                            p.parent.removeChild(p);
                        }
                    });
                }
                
                return spriteDone && particlesDone;
            }
        };
        
        this.brickBreakAnimations.push(animation);
        
        // Also hide the sprite immediately but animate it out
        sprite.visible = true; // Keep visible for animation
    }
    
    setupInput() {
        this.keydownHandler = (e) => {
            // Only handle input if this is the active game
            const activeCanvas = document.getElementById('game-canvas');
            if (activeCanvas && activeCanvas !== this.canvas) return;
            
            this.keys[e.code] = true;
            
            if (e.code === 'Space') {
                if (this.gameState === 'menu') {
                    this.startGame();
                } else if (this.gameState === 'gameOver') {
                    this.startGame();
                } else if (this.waitingForNextTurn) {
                    this.startNextTurn();
                }
            }
            
            if (e.code === 'KeyP' && (this.gameState === 'playing' || this.gameState === 'paused')) {
                this.togglePause();
            }
        };
        
        this.keyupHandler = (e) => {
            // Only handle input if this is the active game
            const activeCanvas = document.getElementById('game-canvas');
            if (activeCanvas && activeCanvas !== this.canvas) return;
            
            this.keys[e.code] = false;
        };
        
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }
    
    generateBackgroundPattern() {
        const patterns = [
            // Level 1: Simple dots
            {
                type: 'dots',
                color: '#001122',
                size: 3,
                spacing: 40,
                offset: 0
            },
            // Level 2: Grid lines
            {
                type: 'grid',
                color: '#002244',
                lineWidth: 1,
                spacing: 30,
                offset: 0
            },
            // Level 3: Diagonal stripes
            {
                type: 'stripes',
                color: '#003366',
                width: 8,
                spacing: 25,
                angle: 45,
                offset: 0
            },
            // Level 4: Hexagonal pattern
            {
                type: 'hexagons',
                color: '#004488',
                size: 15,
                spacing: 35,
                offset: 0
            },
            // Level 5: Circuit board
            {
                type: 'circuit',
                color: '#0055aa',
                lineWidth: 2,
                spacing: 20,
                offset: 0
            },
            // Level 6: Starfield
            {
                type: 'stars',
                color: '#0066cc',
                size: 2,
                density: 0.3,
                offset: 0
            },
            // Level 7: Waves
            {
                type: 'waves',
                color: '#0077dd',
                amplitude: 10,
                frequency: 0.02,
                offset: 0
            },
            // Level 8: Neon grid
            {
                type: 'neon',
                color: '#0088ee',
                glow: 5,
                spacing: 25,
                offset: 0
            },
            // Level 9: Matrix rain
            {
                type: 'matrix',
                color: '#0099ff',
                charSize: 8,
                spacing: 15,
                offset: 0
            },
            // Level 10+: Cosmic
            {
                type: 'cosmic',
                color: '#00aaff',
                particles: 50,
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
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.paddlePowerUpActive = false;
        this.paddle.width = this.paddle.baseWidth;
        this.paddle.x = this.width / 2 - this.paddle.width / 2;
        this.balls = []; // Clear any remaining balls from previous game
        this.generateBackgroundPattern(); // Generate initial background pattern
        this.resetBall();
        this.createLevel();
    }
    
    togglePause() {
        // Only allow pause/unpause during playing state
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
        }
        // Don't change state if in menu or gameOver - this prevents crashes
    }
    
    resetBall() {
        this.ball.x = this.width / 2;
        this.ball.y = this.height / 2;
        // Much more gradual speed increase
        const speedMultiplier = 1 + (this.level - 1) * 0.3;
        this.ball.vx = this.ball.baseSpeed * speedMultiplier;
        this.ball.vy = -this.ball.baseSpeed * speedMultiplier;
        
        // Random direction
        if (Math.random() < 0.5) {
            this.ball.vx = -this.ball.vx;
        }
    }
    
    startNextTurn() {
        this.waitingForNextTurn = false;
        
        // Reset paddle power-up effect with tweening
        if (this.paddlePowerUpActive) {
            this.paddlePowerUpActive = false;
            const oldWidth = this.paddle.width;
            const centerX = this.paddle.x + oldWidth / 2;
            
            const tween = new Tween(this.paddle, 300, Easing.easeInQuad);
            tween.from({ width: oldWidth });
            tween.to({ width: this.paddle.baseWidth });
            tween.onUpdate = (progress, eased) => {
                this.paddle.x = centerX - this.paddle.width / 2;
            };
            this.tweenManager.add(tween);
        }
        
        // Clear ball trails
        this.ballTrail.clear();
        this.ballTrails.forEach(trail => trail.clear());
        this.ballTrails = [];
        
        this.resetBall();
        this.gameState = 'playing';
    }
    
    update(deltaTime) {
        // Update animations even when paused (for block breaking effects)
        if (this.brickBreakAnimations) {
            this.brickBreakAnimations = this.brickBreakAnimations.filter(anim => {
                anim.update(deltaTime);
                return !anim.isComplete();
            });
        }
        
        // Update life loss animations
        if (this.lifeLossAnimations) {
            this.lifeLossAnimations = this.lifeLossAnimations.filter(anim => {
                return anim.update(deltaTime);
            });
        }
        
        // Update UI animations (like life lost message)
        if (this.uiAnimations) {
            this.uiAnimations = this.uiAnimations.filter(anim => {
                return anim.update(deltaTime);
            });
        }
        
        if (this.gameState !== 'playing') {
            return; // Don't update game logic if not playing
        }
        
        // Update paddle
        if (this.keys['ArrowLeft'] && this.paddle.x > 0) {
            this.paddle.x -= this.paddle.speed;
        }
        if (this.keys['ArrowRight'] && this.paddle.x < this.width - this.paddle.width) {
            this.paddle.x += this.paddle.speed;
        }
        
        // Update ball
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;
        
        // Add point to motion trail
        this.ballTrail.addPoint(this.ball.x, this.ball.y, this.ball.color, 4);
        
        // Ball collision with walls
        if (this.ball.x - this.ball.radius <= 0 || this.ball.x + this.ball.radius >= this.width) {
            this.ball.vx = -this.ball.vx;
            if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
                this.screenEffects.shake(3, 5);
            }
        }
        
        if (this.ball.y - this.ball.radius <= 0) {
            this.ball.vy = -this.ball.vy;
            if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
                this.screenEffects.shake(3, 5);
            }
        }
        
        // Ball collision with paddle
        if (this.ball.y + this.ball.radius >= this.paddle.y &&
            this.ball.x >= this.paddle.x &&
            this.ball.x <= this.paddle.x + this.paddle.width &&
            this.ball.vy > 0) {
            
            // Calculate hit position (left side = negative angle, right side = positive)
            const hitPos = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
            
            // Set new velocities based on hit position
            this.ball.vx = hitPos * 6; // Max horizontal speed based on where on paddle
            
            // Ensure minimum vertical speed (ball must move upward at least this fast)
            const minVerticalSpeed = 3;
            this.ball.vy = -Math.max(Math.abs(this.ball.vy) * 0.9, minVerticalSpeed);
            
            // Apply minimum speed threshold - ensure total speed is never too slow
            const minTotalSpeed = 4; // Minimum combined speed
            const currentSpeed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
            
            if (currentSpeed < minTotalSpeed) {
                // Scale up velocities to meet minimum speed
                const speedMultiplier = minTotalSpeed / currentSpeed;
                this.ball.vx *= speedMultiplier;
                this.ball.vy *= speedMultiplier;
            }
            
            this.ball.y = this.paddle.y - this.ball.radius;
            
            if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
                this.screenEffects.shake(5, 8);
            }
        }
        
        // Ball collision with bricks (improved collision detection)
        for (let i = this.bricks.length - 1; i >= 0; i--) {
            const brick = this.bricks[i];
            if (brick.destroyed) continue;
            
            // More precise collision detection
            const ballLeft = this.ball.x - this.ball.radius;
            const ballRight = this.ball.x + this.ball.radius;
            const ballTop = this.ball.y - this.ball.radius;
            const ballBottom = this.ball.y + this.ball.radius;
            
            const brickLeft = brick.x;
            const brickRight = brick.x + brick.width;
            const brickTop = brick.y;
            const brickBottom = brick.y + brick.height;
            
            // Check if ball is overlapping with brick
            if (ballRight > brickLeft && ballLeft < brickRight && 
                ballBottom > brickTop && ballTop < brickBottom) {
                
                brick.destroyed = true;
                this.score += 10;
                
                // Animate brick breaking if using PixiJS
                if (brick.sprite && !this.isPreview) {
                    this.animateBrickBreak(brick);
                }
                
                // Enhanced particle effect with sparks (Canvas 2D only)
                if (this.isPreview && this.particles) {
                    this.particles.explode(brick.x + brick.width / 2, brick.y + brick.height / 2, 8, brick.color);
                    this.particles.sparkBurst(brick.x + brick.width / 2, brick.y + brick.height / 2, 6, brick.color);
                }
                
        // Screen shake effect
        if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
            this.screenEffects.shake(4, 6);
        }
                
                // Determine which side was hit for proper bounce
                const ballCenterX = this.ball.x;
                const ballCenterY = this.ball.y;
                const brickCenterX = brick.x + brick.width / 2;
                const brickCenterY = brick.y + brick.height / 2;
                
                const dx = ballCenterX - brickCenterX;
                const dy = ballCenterY - brickCenterY;
                
                // More precise collision response
                const overlapX = Math.min(ballRight - brickLeft, brickRight - ballLeft);
                const overlapY = Math.min(ballBottom - brickTop, brickBottom - ballTop);
                
                if (overlapX < overlapY) {
                    // Hit from left or right
                    this.ball.vx = -this.ball.vx;
                    // Adjust position to prevent sticking
                    if (dx > 0) {
                        this.ball.x = brickRight + this.ball.radius;
                    } else {
                        this.ball.x = brickLeft - this.ball.radius;
                    }
                } else {
                    // Hit from top or bottom
                    this.ball.vy = -this.ball.vy;
                    // Adjust position to prevent sticking
                    if (dy > 0) {
                        this.ball.y = brickBottom + this.ball.radius;
                    } else {
                        this.ball.y = brickTop - this.ball.radius;
                    }
                }
                
                    if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
                        this.screenEffects.shake(4, 6);
                    }
                
                    // Hide brick sprite if using PixiJS
                    if (brick.sprite && !this.isPreview) {
                        brick.sprite.visible = false;
                    }
                
                // Chance to drop power-up (20% chance)
                if (Math.random() < 0.2) {
                    this.dropPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2);
                }
                
                break; // Only hit one brick per frame
            }
        }
        
        // Update power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            powerUp.y += powerUp.speed;
            
            // Check collision with paddle
            if (powerUp.y + powerUp.size > this.paddle.y &&
                powerUp.x > this.paddle.x &&
                powerUp.x < this.paddle.x + this.paddle.width) {
                
                console.log('Power-up collected:', powerUp.type);
                this.activatePowerUp(powerUp.type);
                
                // Remove power-up sprite if using PixiJS
                if (powerUp.sprite && !this.isPreview) {
                    this.graphics.remove(powerUp.sprite);
                }
                
                this.powerUps.splice(i, 1);
                if (this.screenEffects && typeof this.screenEffects.flash === 'function') {
                    const powerUpColor = parseInt(powerUp.color.replace('#', ''), 16);
                    this.screenEffects.flash(powerUpColor, 10);
                }
            }
            
            // Remove if off screen
            if (powerUp.y > this.height) {
                // Remove sprite if using PixiJS
                if (powerUp.sprite && !this.isPreview) {
                    this.graphics.remove(powerUp.sprite);
                }
                this.powerUps.splice(i, 1);
            }
        }
        
        // Update all balls (for multi-ball power-up)
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            ball.x += ball.vx;
            ball.y += ball.vy;
            
            // Ensure trail exists for each ball
            if (!ball.trail) {
                ball.trail = new MotionTrail(12, 0.90);
                this.ballTrails.push(ball.trail);
            }
            ball.trail.addPoint(ball.x, ball.y, ball.color, 3);
            
            // Wall collisions
            if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= this.width) {
                ball.vx = -ball.vx;
            }
            if (ball.y - ball.radius <= 0) {
                ball.vy = -ball.vy;
            }
            
            // Paddle collision
            if (ball.y + ball.radius >= this.paddle.y &&
                ball.x >= this.paddle.x &&
                ball.x <= this.paddle.x + this.paddle.width &&
                ball.vy > 0) {
                
                const hitPos = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
                
                // Set new velocities based on hit position
                ball.vx = hitPos * 6;
                
                // Ensure minimum vertical speed
                const minVerticalSpeed = 3;
                ball.vy = -Math.max(Math.abs(ball.vy) * 0.9, minVerticalSpeed);
                
                // Apply minimum speed threshold
                const minTotalSpeed = 4;
                const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                
                if (currentSpeed < minTotalSpeed) {
                    const speedMultiplier = minTotalSpeed / currentSpeed;
                    ball.vx *= speedMultiplier;
                    ball.vy *= speedMultiplier;
                }
                
                ball.y = this.paddle.y - ball.radius;
            }
            
            // Brick collision for additional balls
            for (let j = this.bricks.length - 1; j >= 0; j--) {
                const brick = this.bricks[j];
                if (brick.destroyed) continue;
                
                // Same collision detection as main ball
                const ballLeft = ball.x - ball.radius;
                const ballRight = ball.x + ball.radius;
                const ballTop = ball.y - ball.radius;
                const ballBottom = ball.y + ball.radius;
                
                const brickLeft = brick.x;
                const brickRight = brick.x + brick.width;
                const brickTop = brick.y;
                const brickBottom = brick.y + brick.height;
                
                if (ballRight > brickLeft && ballLeft < brickRight && 
                    ballBottom > brickTop && ballTop < brickBottom) {
                    
                    brick.destroyed = true;
                    this.score += 10;
                    
                    // Animate brick breaking if using PixiJS
                    if (brick.sprite && !this.isPreview) {
                        this.animateBrickBreak(brick);
                    }
                    
                    // Enhanced particle effect with sparks (Canvas 2D only)
                    if (this.isPreview && this.particles) {
                        this.particles.explode(brick.x + brick.width / 2, brick.y + brick.height / 2, 8, brick.color);
                        this.particles.sparkBurst(brick.x + brick.width / 2, brick.y + brick.height / 2, 6, brick.color);
                    }
                    
                    // Ripple effect
                    if (this.screenEffects && typeof this.screenEffects.ripple === 'function') {
                        this.screenEffects.ripple(brick.x + brick.width / 2, brick.y + brick.height / 2, 150);
                    }
                    
                    // Screen shake effect
                    if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
                        this.screenEffects.shake(4, 6);
                    }
                    
                    // Collision response
                    const ballCenterX = ball.x;
                    const ballCenterY = ball.y;
                    const brickCenterX = brick.x + brick.width / 2;
                    const brickCenterY = brick.y + brick.height / 2;
                    
                    const dx = ballCenterX - brickCenterX;
                    const dy = ballCenterY - brickCenterY;
                    
                    const overlapX = Math.min(ballRight - brickLeft, brickRight - ballLeft);
                    const overlapY = Math.min(ballBottom - brickTop, brickBottom - ballTop);
                    
                    if (overlapX < overlapY) {
                        ball.vx = -ball.vx;
                        if (dx > 0) {
                            ball.x = brickRight + ball.radius;
                        } else {
                            ball.x = brickLeft - ball.radius;
                        }
                    } else {
                        ball.vy = -ball.vy;
                        if (dy > 0) {
                            ball.y = brickBottom + ball.radius;
                        } else {
                            ball.y = brickTop - ball.radius;
                        }
                    }
                    
                    // Chance to drop power-up
                    if (Math.random() < 0.2) {
                        this.dropPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2);
                    }
                    
                    break; // Only hit one brick per frame
                }
            }
            
            // Remove ball if it falls off screen
            if (ball.y > this.height) {
                // Remove sprite if using PixiJS
                if (ball.sprite && !this.isPreview) {
                    this.graphics.remove(ball.sprite);
                }
                
                if (ball.trail) {
                    const trailIndex = this.ballTrails.indexOf(ball.trail);
                    if (trailIndex > -1) {
                        this.ballTrails.splice(trailIndex, 1);
                    }
                }
                this.balls.splice(i, 1);
            }
        }
        
        // Check if main ball fell off screen
        if (this.ball.y > this.height) {
            console.log('Main ball lost! Lives before:', this.lives);
            
            // Enhanced ball explosion effect
            if (this.isPreview && this.particles) {
                this.particles.explode(this.ball.x, this.ball.y, 15, '#ff0000');
                this.particles.sparkBurst(this.ball.x, this.ball.y, 20, '#ff6600');
                this.particles.smokeCloud(this.ball.x, this.ball.y, 5, '#333333');
            }
            if (this.screenEffects) {
                if (typeof this.screenEffects.shake === 'function') {
                    this.screenEffects.shake(8, 15);
                }
                if (typeof this.screenEffects.zoom === 'function') {
                    this.screenEffects.zoom(1.05);
                }
            }
            
            // Destroy all multi-balls
            this.balls.forEach(ball => {
                // Remove sprite if using PixiJS
                if (ball.sprite && !this.isPreview) {
                    this.graphics.remove(ball.sprite);
                }
                
                if (ball.trail) {
                    const trailIndex = this.ballTrails.indexOf(ball.trail);
                    if (trailIndex > -1) {
                        this.ballTrails.splice(trailIndex, 1);
                    }
                }
            });
            this.balls = [];
            this.ballTrails = [];
            
            // Lose a life - with enhanced visual feedback
            this.lives--;
            console.log('Lives after:', this.lives);
            
            // Enhanced visual feedback for life loss
            if (this.screenEffects) {
                if (typeof this.screenEffects.flash === 'function') {
                    this.screenEffects.flash(0xff0000, 20, 0.5); // Red flash, longer duration, more intense
                }
                if (typeof this.screenEffects.shake === 'function') {
                    this.screenEffects.shake(10, 20); // Stronger shake
                }
            }
            
            // Create particle explosion at ball position (PixiJS mode)
            if (!this.isPreview) {
                this.createLifeLossEffect(this.ball.x, this.ball.y);
            }
            
            // Show life lost message
            this.showLifeLostMessage();
            
            if (this.lives <= 0) {
                console.log('Game over triggered!');
                this.gameOver();
            } else {
                // Wait for next turn
                this.waitingForNextTurn = true;
                this.resetBall();
            }
        }
        
        // Check if all bricks destroyed
        if (this.bricks.every(brick => brick.destroyed)) {
            this.levelUp();
        }
        
        // Update effects
        if (this.isPreview && this.particles) {
            this.particles.update();
        }
        if (this.screenEffects && typeof this.screenEffects.update === 'function') {
            this.screenEffects.update();
        }
        this.tweenManager.update(performance.now());
        
        // Update motion trails
        this.ballTrail.update();
        this.ballTrails.forEach(trail => trail.update());
        
        // Update sprite positions (PixiJS mode)
        if (!this.isPreview) {
            this.updateSpritePositions();
            
            // Update theme effects (animated backgrounds)
            if (this.themeManager && this.currentTheme) {
                this.themeManager.update(this.currentTheme);
            }
            
            // Update NES effects (screen shake, flash, CRT filter)
            if (this.nesEffects && typeof this.nesEffects.update === 'function') {
                this.nesEffects.update();
            }
        }
    }
    
    // Update PixiJS sprite positions
    updateSpritePositions() {
        if (this.isPreview) return;
        
        // Update paddle sprite
        if (this.paddleSprite) {
            this.paddleSprite.x = this.paddle.x;
            this.paddleSprite.y = this.paddle.y;
            this.paddleSprite.width = this.paddle.width;
        }
        
        // Update ball sprite
        if (this.ballSprite) {
            this.ballSprite.x = this.ball.x - this.ball.radius;
            this.ballSprite.y = this.ball.y - this.ball.radius;
        }
        
        // Update brick visibility
        for (let i = 0; i < this.bricks.length; i++) {
            const brick = this.bricks[i];
            if (brick.sprite) {
                brick.sprite.visible = !brick.destroyed;
            }
        }
        
        // Update power-up sprites
        this.updatePowerUpSprites();
        
        // Update multi-ball sprites
        this.updateMultiBallSprites();
    }
    
    // Update or create multi-ball sprites
    updateMultiBallSprites() {
        if (this.isPreview || !this.graphics || !this.spriteManager) return;
        
        // Remove old ball sprites that no longer exist
        if (this.ballSprites) {
            this.ballSprites = this.ballSprites.filter(sprite => {
                const stillExists = this.balls.some(ball => ball.sprite === sprite);
                if (!stillExists) {
                    this.graphics.remove(sprite);
                }
                return stillExists;
            });
        } else {
            this.ballSprites = [];
        }
        
        // Create sprites for new multi-balls
        for (let ball of this.balls) {
            if (!ball.sprite) {
                const ballColor = parseInt(ball.color.replace('#', ''), 16);
                const ballSprite = new PIXI.Graphics();
                
                // Outer glow
                ballSprite.beginFill(ballColor, 0.5);
                ballSprite.drawCircle(ball.radius, ball.radius, ball.radius + 2);
                ballSprite.endFill();
                
                // Main ball
                ballSprite.beginFill(ballColor);
                ballSprite.drawCircle(ball.radius, ball.radius, ball.radius);
                ballSprite.endFill();
                
                // Highlight
                ballSprite.beginFill(this.lightenColor(ballColor, 0.5), 0.6);
                ballSprite.drawCircle(ball.radius - 2, ball.radius - 2, ball.radius * 0.4);
                ballSprite.endFill();
                
                ballSprite.x = ball.x - ball.radius;
                ballSprite.y = ball.y - ball.radius;
                
                this.graphics.addToLayer(ballSprite, 'foreground');
                this.ballSprites.push(ballSprite);
                ball.sprite = ballSprite;
            }
            
            // Update ball sprite position
            if (ball.sprite) {
                ball.sprite.x = ball.x - ball.radius;
                ball.sprite.y = ball.y - ball.radius;
            }
        }
    }
    
    // Update or create power-up sprites
    updatePowerUpSprites() {
        if (this.isPreview || !this.graphics || !this.spriteManager) return;
        
        // Remove old sprites that no longer exist
        if (this.powerUpSprites) {
            this.powerUpSprites = this.powerUpSprites.filter(sprite => {
                const stillExists = this.powerUps.some(pu => pu.sprite === sprite);
                if (!stillExists) {
                    this.graphics.remove(sprite);
                }
                return stillExists;
            });
        } else {
            this.powerUpSprites = [];
        }
        
        // Create sprites for new power-ups
        for (let powerUp of this.powerUps) {
            if (!powerUp.sprite) {
                const powerUpColor = parseInt(powerUp.color.replace('#', ''), 16);
                
                // Create power-up sprite with glow effect
                const powerUpContainer = new PIXI.Container();
                
                // Outer glow
                const glow = new PIXI.Graphics();
                glow.beginFill(powerUpColor, 0.3);
                glow.drawCircle(powerUp.size / 2, powerUp.size / 2, powerUp.size / 2 + 2);
                glow.endFill();
                powerUpContainer.addChild(glow);
                
                // Main power-up shape (diamond/square)
                const mainShape = new PIXI.Graphics();
                mainShape.beginFill(powerUpColor);
                mainShape.drawRect(powerUp.size / 4, powerUp.size / 4, powerUp.size / 2, powerUp.size / 2);
                mainShape.endFill();
                
                // Rotate to make it a diamond
                mainShape.rotation = Math.PI / 4;
                mainShape.pivot.set(powerUp.size / 2, powerUp.size / 2);
                mainShape.position.set(powerUp.size / 2, powerUp.size / 2);
                powerUpContainer.addChild(mainShape);
                
                // Add border
                const border = new PIXI.Graphics();
                border.lineStyle(1, this.lightenColor(powerUpColor, 0.5), 0.8);
                border.drawRect(powerUp.size / 4, powerUp.size / 4, powerUp.size / 2, powerUp.size / 2);
                border.rotation = Math.PI / 4;
                border.pivot.set(powerUp.size / 2, powerUp.size / 2);
                border.position.set(powerUp.size / 2, powerUp.size / 2);
                powerUpContainer.addChild(border);
                
                powerUpContainer.x = powerUp.x - powerUp.size / 2;
                powerUpContainer.y = powerUp.y - powerUp.size / 2;
                
                // Add float animation data
                powerUpContainer.userData = {
                    floatOffset: Math.random() * Math.PI * 2,
                    floatSpeed: 0.05,
                    rotationSpeed: 0.02
                };
                
                this.graphics.addToLayer(powerUpContainer, 'foreground');
                this.powerUpSprites.push(powerUpContainer);
                powerUp.sprite = powerUpContainer;
            }
            
            // Update power-up position and animation
            if (powerUp.sprite) {
                powerUp.sprite.x = powerUp.x - powerUp.size / 2;
                
                // Float animation - base y position plus float offset
                if (powerUp.sprite.userData) {
                    powerUp.sprite.userData.floatOffset += powerUp.sprite.userData.floatSpeed;
                    const baseY = powerUp.y - powerUp.size / 2;
                    powerUp.sprite.y = baseY + Math.sin(powerUp.sprite.userData.floatOffset) * 2;
                    powerUp.sprite.rotation += powerUp.sprite.userData.rotationSpeed;
                } else {
                    powerUp.sprite.y = powerUp.y - powerUp.size / 2;
                }
            }
        }
    }
    
    // Create visual effect when life is lost
    createLifeLossEffect(x, y) {
        if (!this.graphics) return;
        
        const particleCount = 15;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 3 + Math.random() * 4;
            const size = 4 + Math.random() * 6;
            
            const particle = new PIXI.Graphics();
            particle.beginFill(0xff0000);
            particle.drawCircle(0, 0, size);
            particle.endFill();
            particle.x = x;
            particle.y = y;
            particle.alpha = 1;
            
            particle.userData = {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.015 + Math.random() * 0.015
            };
            
            this.graphics.addToLayer(particle, 'foreground');
            particles.push(particle);
        }
        
        // Animate particles
        const animation = {
            particles: particles,
            duration: 800,
            elapsed: 0,
            update: (deltaTime) => {
                this.elapsed += deltaTime;
                
                particles.forEach(particle => {
                    if (particle.userData) {
                        particle.x += particle.userData.vx;
                        particle.y += particle.userData.vy;
                        particle.userData.vy += 0.15; // Gravity
                        particle.alpha -= particle.userData.decay;
                        
                        if (particle.alpha <= 0) {
                            particle.visible = false;
                        }
                    }
                });
                
                // Remove dead particles
                return particles.filter(p => p.alpha > 0).length > 0;
            },
            cleanup: () => {
                particles.forEach(p => {
                    if (p.parent) {
                        p.parent.removeChild(p);
                    }
                });
            }
        };
        
        // Store animation for update loop
        if (!this.lifeLossAnimations) {
            this.lifeLossAnimations = [];
        }
        this.lifeLossAnimations.push(animation);
        
        // Cleanup after duration
        setTimeout(() => {
            animation.cleanup();
            const index = this.lifeLossAnimations.indexOf(animation);
            if (index > -1) {
                this.lifeLossAnimations.splice(index, 1);
            }
        }, animation.duration);
    }
    
    // Create glow effect for power-up activation (PixiJS)
    createPowerUpGlowEffect(x, y, color) {
        if (!this.graphics) return;
        
        const particleCount = 20;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.5);
            const speed = 2 + Math.random() * 3;
            const size = 3 + Math.random() * 5;
            
            const particle = new PIXI.Graphics();
            particle.beginFill(color, 0.8);
            particle.drawCircle(0, 0, size);
            particle.endFill();
            particle.x = x;
            particle.y = y;
            particle.alpha = 1;
            
            particle.userData = {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                decay: 0.02 + Math.random() * 0.02
            };
            
            this.graphics.addToLayer(particle, 'foreground');
            particles.push(particle);
        }
        
        // Animate particles
        const animation = {
            particles: particles,
            duration: 600,
            elapsed: 0,
            update: (deltaTime) => {
                this.elapsed += deltaTime;
                
                particles.forEach(particle => {
                    if (particle.userData) {
                        particle.x += particle.userData.vx;
                        particle.y += particle.userData.vy;
                        particle.userData.vx *= 0.98; // Friction
                        particle.userData.vy *= 0.98;
                        particle.alpha -= particle.userData.decay;
                        
                        if (particle.alpha <= 0) {
                            particle.visible = false;
                        }
                    }
                });
                
                // Continue if any particles are visible
                return particles.filter(p => p.alpha > 0).length > 0;
            },
            cleanup: () => {
                particles.forEach(p => {
                    if (p.parent) {
                        p.parent.removeChild(p);
                    }
                });
            }
        };
        
        // Store animation for update loop
        if (!this.lifeLossAnimations) {
            this.lifeLossAnimations = [];
        }
        this.lifeLossAnimations.push(animation);
        
        // Cleanup after duration
        setTimeout(() => {
            animation.cleanup();
            const index = this.lifeLossAnimations.indexOf(animation);
            if (index > -1) {
                this.lifeLossAnimations.splice(index, 1);
            }
        }, animation.duration);
    }
    
    // Show "LIFE LOST" message
    showLifeLostMessage() {
        if (this.isPreview || !this.graphics) return;
        
        const uiLayer = this.graphics.getLayer('ui');
        if (!uiLayer) return;
        
        const messageStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 36,
            fill: 0xff0000,
            fontWeight: 'bold',
            stroke: 0xffffff,
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowBlur: 10,
            dropShadowAngle: Math.PI / 4,
            dropShadowDistance: 5
        });
        
        const message = new PIXI.Text('LIFE LOST!', messageStyle);
        message.x = this.width / 2;
        message.y = this.height / 2;
        message.anchor.set(0.5);
        message.alpha = 0;
        uiLayer.addChild(message);
        
        // Fade in and out animation
        let elapsed = 0;
        const duration = 1500;
        const fadeIn = 200;
        const fadeOut = 300;
        
        const animateMessage = (deltaTime) => {
            elapsed += deltaTime;
            
            if (elapsed < fadeIn) {
                message.alpha = elapsed / fadeIn;
            } else if (elapsed < duration - fadeOut) {
                message.alpha = 1;
            } else if (elapsed < duration) {
                message.alpha = 1 - (elapsed - (duration - fadeOut)) / fadeOut;
            } else {
                message.alpha = 0;
                uiLayer.removeChild(message);
                return false; // Animation complete
            }
            return true; // Continue animation
        };
        
        // Store animation for update loop
        if (!this.uiAnimations) {
            this.uiAnimations = [];
        }
        this.uiAnimations.push({ update: animateMessage, message: message });
    }
    
    levelUp() {
        this.level++;
        this.score += 100 * this.level; // Bonus points for completing level
        
        // Apply new theme for this level
        this.applyTheme();
        
        if (this.screenEffects && typeof this.screenEffects.flash === 'function') {
            // Flash with theme color
            const flashColor = this.currentTheme ? this.currentTheme.colors.paddle : 0x00ff00;
            this.screenEffects.flash(flashColor, 15);
        }
        
        // Generate new background pattern for this level (if not using themes)
        if (this.isPreview) {
            this.generateBackgroundPattern();
        }
        
        // Paddle progression: shrink every 5 levels
        if (this.level % 5 === 0) {
            const newWidth = Math.max(this.paddle.baseWidth - (Math.floor(this.level / 5) * 10), this.paddle.minWidth);
            this.paddle.baseWidth = newWidth;
            // Only update current width if not under power-up effect
            if (!this.paddlePowerUpActive) {
                this.paddle.width = newWidth;
                this.paddle.x = this.width / 2 - this.paddle.width / 2;
            }
        }
        
        this.createLevel();
        this.resetBall();
        
        // Update brick sprites for new level
        if (!this.isPreview) {
            this.updateBrickSprites();
            this.drawBackgroundPixi();
        }
    }
    
    createLevel() {
        this.bricks = [];
        const brickWidth = 80;
        const brickHeight = 20;
        const brickPadding = 5;
        const rows = 5 + Math.floor(this.level / 2); // More rows as level increases
        const cols = Math.floor(this.width / (brickWidth + brickPadding));
        
        const startX = (this.width - (cols * (brickWidth + brickPadding) - brickPadding)) / 2;
        
        // Get colors from theme or use defaults
        let brickColors;
        if (this.currentTheme && this.currentTheme.colors.bricks) {
            brickColors = this.currentTheme.colors.bricks;
        } else {
            brickColors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0x8800ff];
        }
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * (brickWidth + brickPadding);
                const y = 50 + row * (brickHeight + brickPadding);
                
                // Use theme colors
                const colorInt = brickColors[row % brickColors.length];
                const color = '#' + colorInt.toString(16).padStart(6, '0');
                
                this.bricks.push({
                    x: x,
                    y: y,
                    width: brickWidth,
                    height: brickHeight,
                    color: color,
                    colorInt: colorInt, // Store integer version for PixiJS
                    destroyed: false,
                    sprite: null  // Will be set by updateBrickSprites()
                });
            }
        }
        
        // Update sprites if using PixiJS
        if (!this.isPreview) {
            this.updateBrickSprites();
        }
    }
    
    gameOver() {
        console.log('gameOver() called! Score:', this.score, 'Lives:', this.lives);
        this.gameState = 'gameOver';
        
        // Check if this is a high score (only at complete game end)
        if (highScoreManager.checkHighScore('breakout', this.score)) {
            console.log('High score detected! Requesting name entry...');
            highScoreManager.requestNameEntry('breakout', this.score);
        }
        // No need to save non-qualifying scores
    }
    
    dropPowerUp(x, y) {
        const types = Object.keys(this.powerUpTypes);
        const randomType = types[Math.floor(Math.random() * types.length)];
        const powerUpData = this.powerUpTypes[randomType];
        
        this.powerUps.push({
            x: x,
            y: y,
            size: 12,
            speed: 1, // Much slower falling speed
            color: powerUpData.color,
            type: randomType
        });
    }
    
    activatePowerUp(type) {
        console.log('Activating power-up:', type);
        switch (type) {
            case 'MULTI_BALL':
                console.log('Multi-ball activated!');
                
                // Create glow effect - Canvas 2D or PixiJS
                if (this.isPreview && this.particles) {
                    // Canvas 2D particle effect
                    this.particles.glowExplosion(this.ball.x, this.ball.y, 25, '#ff00ff');
                } else if (!this.isPreview) {
                    // PixiJS glow effect
                    this.createPowerUpGlowEffect(this.ball.x, this.ball.y, 0xff00ff);
                }
                
                // Create two additional balls
                for (let i = 0; i < 2; i++) {
                    const newBall = {
                        x: this.ball.x,
                        y: this.ball.y,
                        vx: this.ball.vx + (Math.random() - 0.5) * 2,
                        vy: this.ball.vy + (Math.random() - 0.5) * 2,
                        radius: this.ball.radius,
                        color: '#ff00ff'
                    };
                    this.balls.push(newBall);
                }
                break;
                
            case 'LARGE_PADDLE':
                console.log('Large paddle activated! Lives:', this.lives);
                // Make paddle larger until end of turn with tweening
                this.paddlePowerUpActive = true;
                const oldWidth = this.paddle.width;
                const centerX = this.paddle.x + oldWidth / 2;
                
                // Animate paddle size change
                const tween = new Tween(this.paddle, 300, Easing.easeOutBounce);
                tween.from({ width: oldWidth });
                tween.to({ width: 150 });
                tween.onUpdate = (progress, eased) => {
                    this.paddle.x = centerX - this.paddle.width / 2;
                };
                this.tweenManager.add(tween);
                break;
                
            case 'EXTRA_LIFE':
                console.log('Extra life activated! Lives before:', this.lives);
                this.lives++;
                console.log('Lives after:', this.lives);
                break;
        }
    }
    
    drawBackground() {
        if (!this.backgroundPattern) return;
        
        this.ctx.save();
        this.ctx.fillStyle = this.backgroundPattern.color;
        this.ctx.strokeStyle = this.backgroundPattern.color;
        
        const pattern = this.backgroundPattern;
        const time = Date.now() * 0.001; // Time in seconds
        
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
                // Horizontal lines
                for (let y = pattern.offset; y < this.height; y += pattern.spacing) {
                    this.ctx.moveTo(0, y);
                    this.ctx.lineTo(this.width, y);
                }
                // Vertical lines
                for (let x = pattern.offset; x < this.width; x += pattern.spacing) {
                    this.ctx.moveTo(x, 0);
                    this.ctx.lineTo(x, this.height);
                }
                // Diagonal connections
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
    
    draw() {
        // For preview, use Canvas 2D
        if (this.isPreview) {
            this.drawCanvas2D();
            return;
        }
        
        // For main game, PixiJS handles rendering automatically via ticker
        // Just update sprite positions (already done in update)
        this.drawBackgroundPixi();
        this.drawUIPixi();
    }
    
    // Canvas 2D drawing for preview
    drawCanvas2D() {
        // Clear canvas with base background
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw background pattern
        this.drawBackground();
        
        // Apply screen effects transform
        const transform = this.screenEffects.getTransform();
        this.ctx.save();
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(transform.scale, transform.scale);
        this.ctx.translate(-this.width / 2 + transform.x, -this.height / 2 + transform.y);
        
        // Draw bricks
        for (let brick of this.bricks) {
            if (!brick.destroyed) {
                this.ctx.fillStyle = brick.color;
                this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
                
                // Add glow effect
                this.ctx.shadowColor = brick.color;
                this.ctx.shadowBlur = 10;
                this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
                this.ctx.shadowBlur = 0;
            }
        }
        
        // Draw paddle
        this.ctx.fillStyle = this.paddle.color;
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        
        // Add paddle glow
        this.ctx.shadowColor = this.paddle.color;
        this.ctx.shadowBlur = 15;
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        this.ctx.shadowBlur = 0;
        
        // Draw ball motion trail
        this.ballTrail.draw(this.ctx);
        
        // Draw main ball
        this.ctx.fillStyle = this.ball.color;
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Add ball glow
        this.ctx.shadowColor = this.ball.color;
        this.ctx.shadowBlur = 20;
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        // Draw additional balls (multi-ball power-up) with trails
        for (let i = 0; i < this.balls.length; i++) {
            const ball = this.balls[i];
            if (ball.trail) {
                ball.trail.draw(this.ctx);
            }
            
            this.ctx.fillStyle = ball.color;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.shadowColor = ball.color;
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
        
        // Draw power-ups
        for (let powerUp of this.powerUps) {
            this.ctx.fillStyle = powerUp.color;
            this.ctx.fillRect(powerUp.x - powerUp.size/2, powerUp.y - powerUp.size/2, powerUp.size, powerUp.size);
            
            // Add glow
            this.ctx.shadowColor = powerUp.color;
            this.ctx.shadowBlur = 10;
            this.ctx.fillRect(powerUp.x - powerUp.size/2, powerUp.y - powerUp.size/2, powerUp.size, powerUp.size);
            this.ctx.shadowBlur = 0;
        }
        
        this.ctx.restore();
        
        // Draw particles
        this.particles.draw(this.ctx);
        
        // Draw UI
        this.drawUI();
        
        // Draw screen effects
        this.screenEffects.drawFlash();
        this.screenEffects.drawRipple();
        
        // Draw CRT filter for retro effect
        if (this.crtFilter) {
            this.crtFilter.draw(this.ctx);
        }
    }
    
    // Draw background using PixiJS
    drawBackgroundPixi() {
        if (this.isPreview || !this.graphics) return;
        
        // Theme system handles backgrounds - don't draw old pattern background
        // Themes are applied via themeManager.applyTheme() which creates the background
        return;
        
        const pattern = this.backgroundPattern;
        const graphics = new PIXI.Graphics();
        const color = parseInt(pattern.color.replace('#', ''), 16);
        graphics.beginFill(color);
        
        switch (pattern.type) {
            case 'dots':
                for (let x = pattern.offset; x < this.width + pattern.spacing; x += pattern.spacing) {
                    for (let y = pattern.offset; y < this.height + pattern.spacing; y += pattern.spacing) {
                        graphics.drawCircle(x, y, pattern.size);
                    }
                }
                break;
            case 'grid':
                graphics.lineStyle(1, color);
                for (let x = pattern.offset; x < this.width; x += pattern.spacing) {
                    graphics.moveTo(x, 0);
                    graphics.lineTo(x, this.height);
                }
                for (let y = pattern.offset; y < this.height; y += pattern.spacing) {
                    graphics.moveTo(0, y);
                    graphics.lineTo(this.width, y);
                }
                break;
        }
        
        graphics.endFill();
        bgLayer.addChild(graphics);
    }
    
    // Draw UI using PixiJS
    drawUIPixi() {
        if (this.isPreview || !this.graphics) return;
        
        const uiLayer = this.graphics.getLayer('ui');
        uiLayer.removeChildren();
        
        // Create text sprites for UI - positioned OUTSIDE play area (above)
        const style = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 24,
            fill: 0xffffff,
            fontWeight: 'bold',
            stroke: 0x000000,
            strokeThickness: 4
        });
        
        // Position stats above the game area (negative y or use absolute positioning)
        // Since UI layer is on top, we'll position relative to screen, not game area
        const screenWidth = this.graphics.app.screen.width;
        const screenHeight = this.graphics.app.screen.height;
        
        // Create a background panel for stats (optional, but helps readability)
        const panelBg = new PIXI.Graphics();
        panelBg.beginFill(0x000000, 0.7);
        panelBg.drawRoundedRect(10, 10, 250, 100, 5);
        panelBg.endFill();
        uiLayer.addChild(panelBg);
        
        const scoreText = new PIXI.Text(`Score: ${Utils.formatScore(this.score)}`, style);
        scoreText.x = 20;
        scoreText.y = 20;
        uiLayer.addChild(scoreText);
        
        const livesText = new PIXI.Text(`Lives: ${this.lives}`, style);
        livesText.x = 20;
        livesText.y = 50;
        uiLayer.addChild(livesText);
        
        const levelText = new PIXI.Text(`Level: ${this.level}`, style);
        levelText.x = 20;
        levelText.y = 80;
        uiLayer.addChild(levelText);
        
        // Draw game state messages (centered in play area)
        if (this.gameState === 'menu') {
            const titleStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 48,
                fill: 0x00ffff,
                fontWeight: 'bold',
                stroke: 0x000088,
                strokeThickness: 6,
                dropShadow: true,
                dropShadowColor: 0x0088ff,
                dropShadowBlur: 10,
                dropShadowAngle: Math.PI / 4,
                dropShadowDistance: 5
            });
            const title = new PIXI.Text('BREAKOUT', titleStyle);
            title.x = this.width / 2;
            title.y = this.height / 2 - 50;
            title.anchor.set(0.5);
            uiLayer.addChild(title);
            
            const startStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 20,
                fill: 0xffffff
            });
            const startText = new PIXI.Text('Press SPACE to Start', startStyle);
            startText.x = this.width / 2;
            startText.y = this.height / 2 + 20;
            startText.anchor.set(0.5);
            uiLayer.addChild(startText);
        } else if (this.gameState === 'paused') {
            const pauseStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 36,
                fill: 0xffff00,
                fontWeight: 'bold',
                stroke: 0x000000,
                strokeThickness: 4
            });
            const pauseText = new PIXI.Text('PAUSED', pauseStyle);
            pauseText.x = this.width / 2;
            pauseText.y = this.height / 2;
            pauseText.anchor.set(0.5);
            uiLayer.addChild(pauseText);
        }
    }
    
    drawUI() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px Courier New';
        this.ctx.fillText(`Score: ${Utils.formatScore(this.score)}`, 20, 30);
        this.ctx.fillText(`Lives: ${this.lives}`, 20, 60);
        this.ctx.fillText(`Level: ${this.level}`, 20, 90);
        
        // Draw game state messages
        if (this.gameState === 'menu') {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.font = '30px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('BREAKOUT', this.width / 2, this.height / 2 - 50);
            this.ctx.font = '16px Courier New';
            this.ctx.fillText('Press SPACE to start', this.width / 2, this.height / 2);
            this.ctx.fillText('Use arrow keys to move', this.width / 2, this.height / 2 + 30);
            this.ctx.textAlign = 'left';
        } else if (this.gameState === 'paused') {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '30px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
            this.ctx.font = '16px Courier New';
            this.ctx.fillText('Press P to resume', this.width / 2, this.height / 2 + 40);
            this.ctx.textAlign = 'left';
        } else if (this.gameState === 'waiting') {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '30px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('BALL LOST!', this.width / 2, this.height / 2 - 50);
            this.ctx.font = '16px Courier New';
            this.ctx.fillText(`Lives remaining: ${this.lives}`, this.width / 2, this.height / 2);
            this.ctx.fillText('Press SPACE for next turn', this.width / 2, this.height / 2 + 30);
            this.ctx.textAlign = 'left';
        } else if (this.gameState === 'gameOver') {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = '30px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 50);
            this.ctx.font = '16px Courier New';
            this.ctx.fillText(`Final Score: ${Utils.formatScore(this.score)}`, this.width / 2, this.height / 2);
            this.ctx.fillText('Press SPACE to restart', this.width / 2, this.height / 2 + 30);
            this.ctx.textAlign = 'left';
        }
    }
    
    gameLoop(deltaTime) {
        this.update(deltaTime);
        this.draw();
        
        if (this.isPreview) {
            requestAnimationFrame(this.gameLoop);
        }
    }
    
    // Cleanup method for proper resource management
    cleanup() {
        // Stop animation loop
        if (this.isPreview) {
            // Canvas 2D mode - cancelAnimationFrame would need the ID
            // For now, just remove listeners
        } else {
            // PixiJS mode
            if (this.graphics && this.graphics.getTicker()) {
                this.graphics.getTicker().remove(this.gameLoop);
            }
            if (this.graphics) {
                this.graphics.destroy();
            }
        }
        
        // Remove event listeners
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
        }
    }
}

// Initialize Breakout game when canvas is available
function initBreakout() {
    const canvas = document.getElementById('breakout-preview');
    if (canvas) {
        new BreakoutGame(canvas);
    }
}
