// Breakout game implementation
class BreakoutGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
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
        this.particles = new ParticleSystem();
        this.screenEffects = new ScreenEffects(canvas);
        
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
        
        // Start game loop
        this.lastTime = 0;
        this.gameLoop = this.gameLoop.bind(this);
        requestAnimationFrame(this.gameLoop);
    }
    
    setupInput() {
        document.addEventListener('keydown', (e) => {
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
            
            if (e.code === 'KeyP' && this.gameState === 'playing') {
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
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
    
    createLevel() {
        this.bricks = [];
        const brickWidth = 80;
        const brickHeight = 20;
        const brickPadding = 5;
        const rows = 5 + this.level; // More rows as level increases
        const cols = Math.floor(this.width / (brickWidth + brickPadding));
        
        const startX = (this.width - (cols * (brickWidth + brickPadding) - brickPadding)) / 2;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * (brickWidth + brickPadding);
                const y = 50 + row * (brickHeight + brickPadding);
                
                // Different colors for different rows
                const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'];
                const color = colors[row % colors.length];
                
                this.bricks.push({
                    x: x,
                    y: y,
                    width: brickWidth,
                    height: brickHeight,
                    color: color,
                    destroyed: false
                });
            }
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
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
        }
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
        
        // Reset paddle power-up effect
        if (this.paddlePowerUpActive) {
            this.paddlePowerUpActive = false;
            this.paddle.width = this.paddle.baseWidth;
            this.paddle.x = this.width / 2 - this.paddle.width / 2;
        }
        
        this.resetBall();
        this.gameState = 'playing';
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
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
        
        // Ball collision with walls
        if (this.ball.x - this.ball.radius <= 0 || this.ball.x + this.ball.radius >= this.width) {
            this.ball.vx = -this.ball.vx;
            this.screenEffects.shake(3, 5);
        }
        
        if (this.ball.y - this.ball.radius <= 0) {
            this.ball.vy = -this.ball.vy;
            this.screenEffects.shake(3, 5);
        }
        
        // Ball collision with paddle
        if (this.ball.y + this.ball.radius >= this.paddle.y &&
            this.ball.x >= this.paddle.x &&
            this.ball.x <= this.paddle.x + this.paddle.width &&
            this.ball.vy > 0) {
            
            // Calculate hit position (left side = negative angle, right side = positive)
            const hitPos = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
            
            // Reduce speed slightly when hitting at an angle
            const speedReduction = 0.9; // 10% speed reduction
            this.ball.vx = hitPos * 5 * speedReduction; // Reduced from 6 to 5, then apply reduction
            this.ball.vy = -Math.abs(this.ball.vy) * speedReduction; // Apply reduction to vertical speed too
            this.ball.y = this.paddle.y - this.ball.radius;
            
            this.screenEffects.shake(5, 8);
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
                
                // Particle effect
                this.particles.explode(brick.x + brick.width / 2, brick.y + brick.height / 2, 8, brick.color);
                
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
                
                this.screenEffects.shake(4, 6);
                
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
                this.powerUps.splice(i, 1);
                this.screenEffects.flash(powerUp.color, 10);
            }
            
            // Remove if off screen
            if (powerUp.y > this.height) {
                this.powerUps.splice(i, 1);
            }
        }
        
        // Update all balls (for multi-ball power-up)
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            ball.x += ball.vx;
            ball.y += ball.vy;
            
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
                
                // Apply same speed reduction for multi-balls
                const speedReduction = 0.9;
                ball.vx = hitPos * 5 * speedReduction;
                ball.vy = -Math.abs(ball.vy) * speedReduction;
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
                    
                    // Particle effect
                    this.particles.explode(brick.x + brick.width / 2, brick.y + brick.height / 2, 8, brick.color);
                    
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
                    
                    this.screenEffects.shake(4, 6);
                    
                    // Chance to drop power-up
                    if (Math.random() < 0.2) {
                        this.dropPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2);
                    }
                    
                    break; // Only hit one brick per frame
                }
            }
            
            // Remove ball if it falls off screen
            if (ball.y > this.height) {
                this.balls.splice(i, 1);
            }
        }
        
        // Check if main ball fell off screen
        if (this.ball.y > this.height) {
            console.log('Main ball lost! Lives before:', this.lives);
            
            // Ball explosion effect
            this.particles.explode(this.ball.x, this.ball.y, 15, '#ff0000');
            this.screenEffects.shake(8, 15);
            
            // Destroy all multi-balls
            this.balls = [];
            
            // Lose a life
            this.lives--;
            console.log('Lives after:', this.lives);
            this.screenEffects.flash('#ff0000', 10);
            
            if (this.lives <= 0) {
                console.log('Game over triggered!');
                this.gameOver();
            } else {
                this.waitingForNextTurn = true;
                this.gameState = 'waiting';
            }
        }
        
        // Check if all bricks destroyed
        if (this.bricks.every(brick => brick.destroyed)) {
            this.levelUp();
        }
        
        // Update effects
        this.particles.update();
        this.screenEffects.update();
    }
    
    levelUp() {
        this.level++;
        this.score += 100 * this.level; // Bonus points for completing level
        this.screenEffects.flash('#00ff00', 15);
        
        // Generate new background pattern for this level
        this.generateBackgroundPattern();
        
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
                // Make paddle larger until end of turn
                this.paddlePowerUpActive = true;
                const oldWidth = this.paddle.width;
                this.paddle.width = 150;
                // Keep paddle centered at its current center position
                const centerX = this.paddle.x + oldWidth / 2;
                this.paddle.x = centerX - this.paddle.width / 2;
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
        // Clear canvas with base background
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw background pattern
        this.drawBackground();
        
        // Apply screen shake
        const shake = this.screenEffects.getShakeOffset();
        this.ctx.save();
        this.ctx.translate(shake.x, shake.y);
        
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
        
        // Draw additional balls (multi-ball power-up)
        for (let ball of this.balls) {
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
    
    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.draw();
        
        requestAnimationFrame(this.gameLoop);
    }
}

// Initialize Breakout game when canvas is available
function initBreakout() {
    const canvas = document.getElementById('breakout-preview');
    if (canvas) {
        new BreakoutGame(canvas);
    }
}
