// Working Man vs Oligarch - Donkey Kong inspired platformer
console.log('Working Man game script loaded');

class WorkingManGame {
    constructor(canvas) {
        console.log('WorkingManGame constructor called');
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Game state
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        
        // Player (Working Man)
        this.player = {
            x: 50,
            y: this.height - 100,
            width: 24,
            height: 32,
            vx: 0,
            vy: 0,
            speed: 2, // Slower for more strategic gameplay
            jumpPower: 10, // Reduced jump power
            onGround: false,
            onLadder: false,
            climbing: false,
            direction: 1, // 1 = right, -1 = left
            animFrame: 0,
            animTimer: 0
        };
        
        // Enemy (Oligarch)
        this.oligarch = {
            x: this.width - 100,
            y: 50,
            width: 40,
            height: 48,
            vx: 0,
            vy: 0,
            speed: 0.5, // Slower movement
            direction: -1,
            animFrame: 0,
            animTimer: 0,
            throwingTimer: 0,
            throwingInterval: 180 // Longer between throws for more strategic gameplay
        };
        
        // Retirement goal for the player to reach
        this.retirementGoal = {
            x: this.width - 120,
            y: 30,
            width: 100,
            height: 20,
            glowTimer: 0,
            type: 'retirement'
        };
        
        // Game physics
        this.gravity = 0.5;
        this.friction = 0.8;
        
        // Level elements
        this.platforms = [];
        this.ladders = [];
        this.moneyBags = []; // Changed from barrels to money bags
        this.hammers = [];
        
        // Animation and effects
        this.particles = new ParticleSystem();
        this.screenEffects = new ScreenEffects(canvas);
        
        // Input handling
        this.keys = {};
        this.setupInput();
        
        // Start in menu state
        this.gameState = 'menu';
        
        // Generate initial level for display purposes
        this.generateLevel();
        
        // Start game loop
        this.lastTime = 0;
        this.gameLoop();
    }
    
    generateLevel() {
        // Clear existing level elements
        this.platforms = [];
        this.ladders = [];
        this.moneyBags = []; // Changed from barrels to money bags
        this.hammers = [];
        
        // Generate platforms with guaranteed path to retirement but with variety
        const platformCount = Math.min(6 + this.level, 12);
        const platformSpacing = (this.height - 100) / (platformCount + 1);
        
        // Create platforms that form a guaranteed path to the top with variety
        for (let i = 0; i < platformCount; i++) {
            const y = this.height - 80 - (i * platformSpacing);
            let x, width;
            
            if (i === 0) {
                // Bottom platform - start position
                x = 20;
                width = 150;
            } else if (i === platformCount - 1) {
                // Top platform - leads to retirement
                x = this.width - 150;
                width = 150;
            } else {
                // Middle platforms - create variety while maintaining path
                const basePattern = i % 3; // Use 3-pattern cycle for more variety
                const randomOffset = (Math.random() - 0.5) * 40; // Add some randomness
                
                if (basePattern === 0) {
                    // Left side platforms
                    x = Math.max(30, 50 + randomOffset);
                    width = 100 + Math.random() * 40;
                } else if (basePattern === 1) {
                    // Center platforms
                    x = this.width/2 - 60 + randomOffset;
                    width = 120 + Math.random() * 40;
                } else {
                    // Right side platforms
                    x = Math.min(this.width - 150, this.width - 200 + randomOffset);
                    width = 100 + Math.random() * 40;
                }
            }
            
            this.platforms.push({
                x: x,
                y: y,
                width: width,
                height: 16,
                type: 'platform'
            });
        }
        
        // Add guaranteed ladders between platforms with smart positioning
        for (let i = 0; i < platformCount - 1; i++) {
            const currentPlatform = this.platforms[i];
            const nextPlatform = this.platforms[i + 1];
            
            // Calculate the best ladder position to connect platforms
            let ladderX;
            const currentCenter = currentPlatform.x + currentPlatform.width / 2;
            const nextCenter = nextPlatform.x + nextPlatform.width / 2;
            
            if (nextCenter > currentCenter) {
                // Next platform is to the right - place ladder at right end of current
                ladderX = currentPlatform.x + currentPlatform.width - 20;
            } else if (nextCenter < currentCenter) {
                // Next platform is to the left - place ladder at left end of current
                ladderX = currentPlatform.x + 4;
            } else {
                // Platforms are roughly aligned - place ladder at center
                ladderX = currentCenter - 8;
            }
            
            // Ensure ladder is within platform bounds
            ladderX = Math.max(currentPlatform.x + 4, 
                      Math.min(ladderX, currentPlatform.x + currentPlatform.width - 20));
            
            this.ladders.push({
                x: ladderX,
                y: currentPlatform.y - platformSpacing,
                width: 16,
                height: platformSpacing + 10
            });
        }
        
        // Add some extra platforms for variety (not part of main path)
        const extraPlatforms = Math.min(2 + Math.floor(this.level / 3), 4);
        for (let i = 0; i < extraPlatforms; i++) {
            const y = this.height - 100 - (Math.random() * (this.height - 200));
            const width = 80 + Math.random() * 60;
            const x = Math.random() * (this.width - width);
            
            // Don't place too close to main path platforms
            let tooClose = false;
            for (let platform of this.platforms) {
                if (Math.abs(y - platform.y) < 50 && 
                    Math.abs(x - platform.x) < 100) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                this.platforms.push({
                    x: x,
                    y: y,
                    width: width,
                    height: 16,
                    type: 'platform'
                });
                
                // Sometimes add ladders to extra platforms
                if (Math.random() < 0.3) {
                    this.ladders.push({
                        x: x + width - 20,
                        y: y - 30,
                        width: 16,
                        height: 40
                    });
                }
            }
        }
        
        // Add ground platform
        this.platforms.push({
            x: 0,
            y: this.height - 20,
            width: this.width,
            height: 20,
            type: 'ground'
        });
        
        // Position player at bottom
        this.player.x = 50;
        this.player.y = this.height - 100;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onGround = false;
        
        // Position oligarch at top
        this.oligarch.x = this.width - 100;
        this.oligarch.y = 50;
        this.oligarch.throwingTimer = 0;
        
        // Position retirement goal
        this.retirementGoal.x = this.width - 120;
        this.retirementGoal.y = 30;
        this.retirementGoal.glowTimer = 0;
    }
    
    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            if (e.code === 'Space' && this.gameState === 'menu') {
                this.startGame();
            }
            
            if (e.code === 'KeyP' && this.gameState === 'playing') {
                this.togglePause();
            }
            
            if (e.code === 'Space' && this.gameState === 'gameOver') {
                this.restartGame();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.generateLevel();
    }
    
    restartGame() {
        this.startGame();
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
        
        this.updatePlayer(deltaTime);
        this.updateOligarch(deltaTime);
        this.updateMoneyBags(deltaTime);
        this.updateHammers(deltaTime);
        this.updateCollisions();
        this.updateEffects();
        
        // Check win condition (reach retirement goal)
        if (this.checkCollision(this.player, this.retirementGoal)) {
            this.levelUp();
        }
        
        // Check lose condition (fall off screen)
        if (this.player.y > this.height) {
            this.loseLife();
        }
    }
    
    updatePlayer(deltaTime) {
        // Horizontal movement
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.vx = -this.player.speed;
            this.player.direction = -1;
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.vx = this.player.speed;
            this.player.direction = 1;
        } else {
            this.player.vx *= this.friction;
        }
        
        // Climbing ladders
        // Handle climbing (only when on ladder and pressing up/down)
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            if (this.player.onLadder) {
                this.player.vy = -this.player.speed;
                this.player.climbing = true;
                // Prevent horizontal movement while climbing
                this.player.vx = 0;
            } else if (this.player.onGround) {
                this.player.vy = -this.player.jumpPower;
                this.player.onGround = false;
            }
        } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            if (this.player.onLadder) {
                this.player.vy = this.player.speed;
                this.player.climbing = true;
                // Prevent horizontal movement while climbing
                this.player.vx = 0;
            }
        } else {
            this.player.climbing = false;
        }
        
        // Apply gravity (unless climbing)
        if (!this.player.climbing) {
            this.player.vy += this.gravity;
        }
        
        // Update position
        this.player.x += this.player.vx;
        this.player.y += this.player.vy;
        
        // Keep player on screen
        this.player.x = Math.max(0, Math.min(this.width - this.player.width, this.player.x));
        
        // Animation
        this.player.animTimer += deltaTime;
        if (this.player.animTimer > 200) {
            this.player.animFrame = (this.player.animFrame + 1) % 4;
            this.player.animTimer = 0;
        }
    }
    
    updateOligarch(deltaTime) {
        // Simple AI - move back and forth
        this.oligarch.vx = this.oligarch.speed * this.oligarch.direction;
        this.oligarch.x += this.oligarch.vx;
        
        // Reverse direction at edges
        if (this.oligarch.x <= 50 || this.oligarch.x >= this.width - 90) {
            this.oligarch.direction *= -1;
        }
        
        // Throw money bags
        this.oligarch.throwingTimer++;
        if (this.oligarch.throwingTimer >= this.oligarch.throwingInterval) {
            this.throwMoneyBag();
            this.oligarch.throwingTimer = 0;
        }
        
        // Animation
        this.oligarch.animTimer += deltaTime;
        if (this.oligarch.animTimer > 300) {
            this.oligarch.animFrame = (this.oligarch.animFrame + 1) % 2;
            this.oligarch.animTimer = 0;
        }
    }
    
    throwMoneyBag() {
        this.moneyBags.push({
            x: this.oligarch.x + 20,
            y: this.oligarch.y + 30,
            width: 20,
            height: 16,
            vx: 1.5 * this.oligarch.direction,
            vy: 0,
            rotation: 0,
            onPlatform: false,
            animFrame: 0
        });
    }
    
    updateMoneyBags(deltaTime) {
        for (let i = this.moneyBags.length - 1; i >= 0; i--) {
            const moneyBag = this.moneyBags[i];
            
            // Apply gravity
            moneyBag.vy += this.gravity;
            
            // Update position
            moneyBag.x += moneyBag.vx;
            moneyBag.y += moneyBag.vy;
            moneyBag.rotation += 0.2;
            
            // Remove if off screen
            if (moneyBag.y > this.height || moneyBag.x < -20 || moneyBag.x > this.width + 20) {
                this.moneyBags.splice(i, 1);
                continue;
            }
            
            // Check platform collisions
            for (let platform of this.platforms) {
                if (this.checkCollision(moneyBag, platform)) {
                    moneyBag.y = platform.y - moneyBag.height;
                    moneyBag.vy = 0;
                    moneyBag.onPlatform = true;
                    
                    // Roll on platform
                    if (platform.type === 'platform') {
                        moneyBag.vx = 1.5 * (moneyBag.vx > 0 ? 1 : -1);
                    }
                }
            }
        }
    }
    
    updateHammers(deltaTime) {
        // Update hammer power-ups
        for (let i = this.hammers.length - 1; i >= 0; i--) {
            const hammer = this.hammers[i];
            hammer.animTimer += deltaTime;
            
            if (hammer.animTimer > 500) {
                hammer.animFrame = (hammer.animFrame + 1) % 2;
                hammer.animTimer = 0;
            }
        }
    }
    
    updateCollisions() {
        // Player platform collisions
        this.player.onGround = false;
        this.player.onLadder = false;
        
        for (let platform of this.platforms) {
            if (this.checkCollision(this.player, platform)) {
                if (this.player.vy > 0) { // Falling onto platform
                    this.player.y = platform.y - this.player.height;
                    this.player.vy = 0;
                    this.player.onGround = true;
                }
            }
        }
        
        // Player ladder collisions (much more precise)
        this.player.onLadder = false;
        for (let ladder of this.ladders) {
            // Very precise ladder collision - player must be centered on ladder
            const ladderCenterX = ladder.x + ladder.width / 2;
            const playerCenterX = this.player.x + this.player.width / 2;
            const distanceFromCenter = Math.abs(playerCenterX - ladderCenterX);
            
            // Player must be within 8 pixels of ladder center and within ladder height bounds
            if (distanceFromCenter <= 8 && 
                this.player.y + this.player.height > ladder.y &&
                this.player.y < ladder.y + ladder.height) {
                this.player.onLadder = true;
                // Snap player to ladder center when climbing
                if (this.player.climbing) {
                    this.player.x = ladderCenterX - this.player.width / 2;
                }
                break;
            }
        }
        
        // Player money bag collisions
        for (let i = this.moneyBags.length - 1; i >= 0; i--) {
            const moneyBag = this.moneyBags[i];
            if (this.checkCollision(this.player, moneyBag)) {
                this.loseLife();
                this.moneyBags.splice(i, 1);
                break;
            }
        }
        
        // Player hammer collisions
        for (let i = this.hammers.length - 1; i >= 0; i--) {
            const hammer = this.hammers[i];
            if (this.checkCollision(this.player, hammer)) {
                this.collectHammer(hammer);
                this.hammers.splice(i, 1);
                break;
            }
        }
    }
    
    collectHammer(hammer) {
        this.score += 100;
        this.screenEffects.flash('#ffff00', 10);
        
        // Add hammer power-up effect
        this.player.hammerPower = true;
        this.player.hammerTimer = 300; // 5 seconds at 60fps
    }
    
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    updateEffects() {
        this.particles.update();
        this.screenEffects.update();
    }
    
    levelUp() {
        this.level++;
        this.score += 1000;
        this.screenEffects.flash('#00ff00', 15);
        this.generateLevel();
    }
    
    loseLife() {
        this.lives--;
        this.screenEffects.shake(5, 10);
        this.screenEffects.flash('#ff0000', 10);
        
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            // Reset player position
            this.player.x = 50;
            this.player.y = this.height - 100;
            this.player.vx = 0;
            this.player.vy = 0;
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        
        // Check for high score
        if (highScoreManager.checkHighScore('working-man', this.score)) {
            highScoreManager.requestNameEntry('working-man', this.score);
        }
    }
    
    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.draw();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Apply screen effects
        const shake = this.screenEffects.getShakeOffset();
        this.ctx.save();
        this.ctx.translate(shake.x, shake.y);
        
        // Only draw game elements when playing
        if (this.gameState === 'playing') {
            // Draw platforms
            this.drawPlatforms();
            
            // Draw ladders
            this.drawLadders();
            
            // Draw retirement goal
            this.drawRetirementGoal();
            
            // Draw money bags
            this.drawMoneyBags();
            
            // Draw hammers
            this.drawHammers();
            
            // Draw oligarch
            this.drawOligarch();
            
            // Draw player
            this.drawPlayer();
            
            // Draw particles
            this.particles.draw(this.ctx);
        }
        
        this.ctx.restore();
        
        // Draw UI
        this.drawUI();
        
        // Draw game state messages
        this.drawGameState();
    }
    
    drawPlatforms() {
        this.ctx.fillStyle = '#8B4513';
        for (let platform of this.platforms) {
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            
            // Add platform border
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
        }
    }
    
    drawLadders() {
        this.ctx.fillStyle = '#C0C0C0';
        for (let ladder of this.ladders) {
            this.ctx.fillRect(ladder.x, ladder.y, ladder.width, ladder.height);
            
            // Draw ladder rungs
            this.ctx.strokeStyle = '#808080';
            this.ctx.lineWidth = 2;
            for (let i = 0; i < ladder.height; i += 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(ladder.x, ladder.y + i);
                this.ctx.lineTo(ladder.x + ladder.width, ladder.y + i);
                this.ctx.stroke();
            }
        }
    }
    
    drawMoneyBags() {
        for (let moneyBag of this.moneyBags) {
            this.ctx.save();
            this.ctx.translate(moneyBag.x + moneyBag.width/2, moneyBag.y + moneyBag.height/2);
            this.ctx.rotate(moneyBag.rotation);
            
            // Draw money bag (golden bag with dollar sign)
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillRect(-moneyBag.width/2, -moneyBag.height/2, moneyBag.width, moneyBag.height);
            
            // Draw bag details
            this.ctx.strokeStyle = '#B8860B';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-moneyBag.width/2, -moneyBag.height/2, moneyBag.width, moneyBag.height);
            
            // Draw dollar sign
            this.ctx.fillStyle = '#000000';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('$', 0, 3);
            this.ctx.textAlign = 'left';
            
            this.ctx.restore();
        }
    }
    
    drawRetirementGoal() {
        // Animate glow effect
        this.retirementGoal.glowTimer += 0.1;
        const glowIntensity = Math.sin(this.retirementGoal.glowTimer) * 0.3 + 0.7;
        
        // Draw retirement cottage/house
        this.ctx.fillStyle = `rgba(139, 69, 19, ${glowIntensity})`; // Brown cottage
        this.ctx.fillRect(this.retirementGoal.x, this.retirementGoal.y, this.retirementGoal.width, this.retirementGoal.height);
        
        // Draw roof
        this.ctx.fillStyle = `rgba(139, 0, 0, ${glowIntensity})`; // Dark red roof
        this.ctx.beginPath();
        this.ctx.moveTo(this.retirementGoal.x - 10, this.retirementGoal.y);
        this.ctx.lineTo(this.retirementGoal.x + this.retirementGoal.width/2, this.retirementGoal.y - 20);
        this.ctx.lineTo(this.retirementGoal.x + this.retirementGoal.width + 10, this.retirementGoal.y);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw door
        this.ctx.fillStyle = `rgba(101, 67, 33, ${glowIntensity})`; // Dark brown door
        this.ctx.fillRect(this.retirementGoal.x + 30, this.retirementGoal.y + 5, 20, 15);
        
        // Draw windows
        this.ctx.fillStyle = `rgba(135, 206, 235, ${glowIntensity})`; // Sky blue windows
        this.ctx.fillRect(this.retirementGoal.x + 10, this.retirementGoal.y + 8, 12, 8);
        this.ctx.fillRect(this.retirementGoal.x + 60, this.retirementGoal.y + 8, 12, 8);
        
        // Draw chimney
        this.ctx.fillStyle = `rgba(105, 105, 105, ${glowIntensity})`; // Dim gray chimney
        this.ctx.fillRect(this.retirementGoal.x + 70, this.retirementGoal.y - 15, 8, 15);
        
        // Draw smoke
        this.ctx.fillStyle = `rgba(192, 192, 192, ${glowIntensity * 0.7})`;
        this.ctx.beginPath();
        this.ctx.arc(this.retirementGoal.x + 74, this.retirementGoal.y - 20, 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(this.retirementGoal.x + 78, this.retirementGoal.y - 25, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw border
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.retirementGoal.x, this.retirementGoal.y, this.retirementGoal.width, this.retirementGoal.height);
        
        // Draw "RETIREMENT" text
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('RETIREMENT', this.retirementGoal.x + this.retirementGoal.width/2, this.retirementGoal.y - 5);
        this.ctx.textAlign = 'left';
    }
    
    drawHammers() {
        for (let hammer of this.hammers) {
            // Draw hammer
            this.ctx.fillStyle = '#808080';
            this.ctx.fillRect(hammer.x, hammer.y, hammer.width, hammer.height);
            
            // Hammer handle
            this.ctx.fillStyle = '#654321';
            this.ctx.fillRect(hammer.x + 2, hammer.y + 8, 4, 8);
            
            // Glow effect
            this.ctx.shadowColor = '#ffff00';
            this.ctx.shadowBlur = 8;
            this.ctx.fillRect(hammer.x, hammer.y, hammer.width, hammer.height);
            this.ctx.shadowBlur = 0;
        }
    }
    
    drawOligarch() {
        // Draw Oligarch (Monopoly Man + Mr. Peanut hybrid)
        this.ctx.fillStyle = '#000080'; // Dark blue suit
        
        // Body
        this.ctx.fillRect(this.oligarch.x, this.oligarch.y + 20, this.oligarch.width, this.oligarch.height - 20);
        
        // Head
        this.ctx.fillStyle = '#FDBCB4';
        this.ctx.fillRect(this.oligarch.x + 8, this.oligarch.y, this.oligarch.width - 16, 20);
        
        // Top hat (more prominent)
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(this.oligarch.x + 4, this.oligarch.y - 12, this.oligarch.width - 8, 12);
        // Hat brim
        this.ctx.fillRect(this.oligarch.x + 2, this.oligarch.y - 4, this.oligarch.width - 4, 4);
        
        // Monocle (more prominent with chain)
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(this.oligarch.x + 25, this.oligarch.y + 8, 6, 0, Math.PI * 2);
        this.ctx.stroke();
        // Monocle chain
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.oligarch.x + 31, this.oligarch.y + 8);
        this.ctx.lineTo(this.oligarch.x + 35, this.oligarch.y + 6);
        this.ctx.stroke();
        
        // Face details
        this.ctx.fillStyle = '#000000';
        // Eyes
        this.ctx.fillRect(this.oligarch.x + 20, this.oligarch.y + 6, 2, 2);
        this.ctx.fillRect(this.oligarch.x + 28, this.oligarch.y + 6, 2, 2);
        // Mustache (curled ends like Mr. Peanut)
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(this.oligarch.x + 15, this.oligarch.y + 12, 10, 2);
        
        // Arms
        this.ctx.fillStyle = '#FDBCB4';
        this.ctx.fillRect(this.oligarch.x - 4, this.oligarch.y + 24, 8, 16);
        this.ctx.fillRect(this.oligarch.x + this.oligarch.width - 4, this.oligarch.y + 24, 8, 16);
        
        // Legs
        this.ctx.fillStyle = '#000080';
        this.ctx.fillRect(this.oligarch.x + 8, this.oligarch.y + 36, 8, 12);
        this.ctx.fillRect(this.oligarch.x + 24, this.oligarch.y + 36, 8, 12);
        
        // Shoes
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(this.oligarch.x + 6, this.oligarch.y + 46, 12, 4);
        this.ctx.fillRect(this.oligarch.x + 22, this.oligarch.y + 46, 12, 4);
        
        // Cane
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.oligarch.x - 8, this.oligarch.y + 20);
        this.ctx.lineTo(this.oligarch.x - 8, this.oligarch.y + 40);
        this.ctx.stroke();
        
        // Cane handle
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(this.oligarch.x - 8, this.oligarch.y + 20, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Animation - bouncing
        if (this.oligarch.animFrame === 1) {
            this.ctx.translate(0, 2);
        }
    }
    
    drawPlayer() {
        // Draw Working Man
        this.ctx.fillStyle = '#4169E1';
        
        // Body
        this.ctx.fillRect(this.player.x, this.player.y + 16, this.player.width, this.player.height - 16);
        
        // Head
        this.ctx.fillStyle = '#FDBCB4';
        this.ctx.fillRect(this.player.x + 4, this.player.y, this.player.width - 8, 16);
        
        // Hard hat
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(this.player.x + 2, this.player.y - 4, this.player.width - 4, 8);
        
        // Draw face details
        this.ctx.fillStyle = '#000000';
        // Eyes
        this.ctx.fillRect(this.player.x + 6, this.player.y + 4, 2, 2);
        this.ctx.fillRect(this.player.x + 12, this.player.y + 4, 2, 2);
        // Mustache
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(this.player.x + 7, this.player.y + 8, 6, 2);
        
        // Arms (animation)
        this.ctx.fillStyle = '#FDBCB4';
        if (this.player.animFrame % 2 === 0) {
            this.ctx.fillRect(this.player.x - 4, this.player.y + 20, 8, 12);
            this.ctx.fillRect(this.player.x + this.player.width - 4, this.player.y + 20, 8, 12);
        } else {
            this.ctx.fillRect(this.player.x - 2, this.player.y + 18, 8, 12);
            this.ctx.fillRect(this.player.x + this.player.width - 6, this.player.y + 22, 8, 12);
        }
        
        // Legs (walking animation)
        this.ctx.fillStyle = '#4169E1';
        if (this.player.vx !== 0) {
            if (this.player.animFrame % 2 === 0) {
                this.ctx.fillRect(this.player.x + 4, this.player.y + this.player.height - 8, 6, 8);
                this.ctx.fillRect(this.player.x + 14, this.player.y + this.player.height - 12, 6, 12);
            } else {
                this.ctx.fillRect(this.player.x + 4, this.player.y + this.player.height - 12, 6, 12);
                this.ctx.fillRect(this.player.x + 14, this.player.y + this.player.height - 8, 6, 8);
            }
        } else {
            this.ctx.fillRect(this.player.x + 4, this.player.y + this.player.height - 8, 6, 8);
            this.ctx.fillRect(this.player.x + 14, this.player.y + this.player.height - 8, 6, 8);
        }
        
        // Hammer power-up effect
        if (this.player.hammerPower) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(this.player.x + this.player.width/2, this.player.y - 10, 8, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawUI() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'left';
        
        this.ctx.fillText(`Score: ${Utils.formatScore(this.score)}`, 10, 25);
        this.ctx.fillText(`Lives: ${this.lives}`, 10, 45);
        this.ctx.fillText(`Level: ${this.level}`, 10, 65);
        
        // Draw game state messages
        if (this.gameState === 'menu') {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.font = '24px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('WORKING MAN vs OLIGARCH', this.width / 2, this.height / 2 - 50);
            this.ctx.fillText('Climb to reach the Oligarch!', this.width / 2, this.height / 2 - 20);
            this.ctx.fillText('Arrow Keys: Move | Up: Jump/Climb', this.width / 2, this.height / 2);
            this.ctx.fillText('Press SPACE to start', this.width / 2, this.height / 2 + 30);
        } else if (this.gameState === 'paused') {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '24px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
            this.ctx.fillText('Press P to resume', this.width / 2, this.height / 2 + 30);
        } else if (this.gameState === 'gameOver') {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = '24px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 30);
            this.ctx.fillText(`Final Score: ${Utils.formatScore(this.score)}`, this.width / 2, this.height / 2);
            this.ctx.fillText('Press SPACE to restart', this.width / 2, this.height / 2 + 30);
        }
        
        // Draw instructions
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Courier New';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('WORKING MAN vs OLIGARCH', this.width - 200, this.height - 10);
    }
    
    drawGameState() {
        // Additional game state rendering if needed
    }
}

// Initialize Working Man game when canvas is ready
function initWorkingMan() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    
    new WorkingManGame(canvas);
}