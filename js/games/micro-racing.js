// Out Run Style Racing Game - PixiJS version
console.log('Out Run Style Racing game script loaded');

class MicroRacingGame {
    constructor(canvas) {
        console.log('MicroRacingGame constructor called');
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
                backgroundColor: 0x1a1a2e,
                pixelPerfect: true
            });
        }
        
        // Game state
        this.gameState = 'menu'; // menu, countdown, playing, paused, gameOver
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.timeLeft = 45; // 45 seconds per level (tighter timer)
        this.checkpointTime = 0; // Time when checkpoint was reached
        this.countdown = 0; // Countdown before race starts (3, 2, 1, GO!)
        this.countdownTimer = 0; // Frame counter for countdown
        
        // Track and camera
        this.baseRoadLength = 1000; // Base track length
        this.roadLength = 1000; // Current track length (increases with level)
        this.roadSegments = [];
        this.playerZ = 0; // Player's position on track (0 to roadLength)
        this.cameraHeight = 1200; // Camera height above track
        this.cameraDepth = 0.84; // Field of view
        this.roadWidth = 5000; // Base track width (very wide for easy dodging)
        this.horizonY = this.height * 0.4; // Horizon line position
        
        // Level-based colors
        this.trackColors = [
            { r: 0, g: 20, b: 40, horizon: '#000033' }, // Deep blue
            { r: 20, g: 0, b: 40, horizon: '#1a0033' }, // Purple
            { r: 40, g: 20, b: 0, horizon: '#331400' }, // Dark orange
            { r: 0, g: 40, b: 20, horizon: '#002814' }, // Dark green
            { r: 20, g: 20, b: 0, horizon: '#333300' }, // Dark yellow
            { r: 40, g: 0, b: 20, horizon: '#330014' }, // Dark magenta
        ];
        
        // Player hover ship (always at bottom of screen)
        this.playerCar = {
            x: 0, // Position on track (-1 to 1, where 0 is center)
            speed: 0,
            maxSpeed: 10, // Very slow max speed for easy gameplay
            acceleration: 0.08, // Much slower acceleration
            friction: 0.94, // Less friction (coast more)
            curve: 0, // Current curve input
            color: '#00FFFF', // Cyan for sci-fi
            hoverGlow: 0 // Animation for hover effect
        };
        
        // Traffic cars
        this.trafficCars = [];
        // Max traffic will scale with level in generateTraffic()
        
        // Roadside objects (trees, etc.)
        this.roadsideObjects = [];
        
        // Checkpoints
        this.checkpoints = [];
        this.currentCheckpoint = 0;
        
        // Animation and effects
        if (this.isPreview) {
            this.particles = new ParticleSystem();
            this.screenEffects = new ScreenEffects(canvas);
        } else {
            this.particles = null; // Will create PixiJS particles as needed
            this.screenEffects = null; // Will be set from nesEffects
        }
        
        // PixiJS sprites (only for main game)
        if (!this.isPreview) {
            this.roadSprites = [];
            this.trafficCarSprites = [];
            this.playerCarSprite = null;
            this.roadsideObjectSprites = [];
        }
        
        // Input handling
        this.keys = {};
        this.setupInput();
        
        // Generate road
        this.generateRoad();
        this.generateCheckpoints();
        this.generateTraffic();
        this.generateRoadsideObjects();
        
        // Start game loop
        this.lastTime = 0;
        
        if (this.isPreview) {
            this.gameLoop();
        } else {
            this.initGraphics();
        }
    }
    
    async initGraphics() {
        if (this.isPreview) return;
        await this.graphics.init();
        if (!this.graphics || !this.graphics.isInitialized || !this.graphics.app || !this.graphics.app.renderer || !this.graphics.app.ticker) {
            console.error('Graphics initialization failed, falling back to requestAnimationFrame');
            this.gameLoop();
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
        // Draw initial frame to show menu
        if (!this.isPreview) {
            this.drawPixi();
        }
    }
    
    initSprites() {
        if (this.isPreview) return;
        // Sprites will be created dynamically during rendering
    }
    
    startGameLoop() {
        if (this.isPreview) {
            this.gameLoop();
            return;
        }
        
        const ticker = this.graphics.getTicker();
        if (ticker) {
            // Store the ticker callback so we can remove it later
            // PixiJS ticker deltaTime is in frames, convert to milliseconds for update()
            this.tickerCallback = (deltaTime) => {
                const deltaMs = deltaTime * (1000 / 60); // Convert frames to milliseconds
                this.gameLoop(deltaMs);
            };
            ticker.add(this.tickerCallback);
        } else {
            console.warn('PixiJS ticker not available, falling back to requestAnimationFrame');
            this.gameLoop();
        }
    }
    
    generateRoad() {
        this.roadSegments = [];
        this.roadLength = this.baseRoadLength + (this.level - 1) * 200; // Longer levels as you progress
        
        let currentCurve = 0;
        
        for (let i = 0; i < this.roadLength; i++) {
            const z = i;
            
            // Add actual corners/turns - much longer and significantly steeper
            const cornerLength = 450; // Much longer corners for extended turns
            const straightLength = 200; // Shorter straight sections between corners
            const cornerCycle = cornerLength + straightLength;
            
            if (i % cornerCycle < cornerLength) {
                // In a corner - very sharp, extended turns
                const cornerProgress = (i % cornerCycle) / cornerLength;
                const cornerDirection = Math.floor(i / cornerCycle) % 2 === 0 ? 1 : -1; // Alternate left/right
                
                // Use a sharper curve function for very pronounced corners
                // Ease-in-out for smooth entry/exit but sharp in middle
                const easedProgress = cornerProgress < 0.5 
                    ? 2 * cornerProgress * cornerProgress 
                    : 1 - Math.pow(-2 * cornerProgress + 2, 3) / 2;
                
                // Very sharp corners - up to 2.5 curve (extremely sharp and pronounced)
                currentCurve = easedProgress * 2.5 * cornerDirection;
            } else if (i % cornerCycle < cornerLength + 20) {
                // Quick transition out of corner
                const transitionProgress = ((i % cornerCycle) - cornerLength) / 20;
                currentCurve *= (1 - transitionProgress);
            } else {
                // Straight sections - minimal curves
                const gentleCurve = Math.sin(i * 0.015) * 0.03;
                currentCurve = gentleCurve;
            }
            
            // Hills (change camera height)
            const hill = Math.sin(i * 0.03) * 100;
            
            this.roadSegments.push({
                z: z,
                curve: currentCurve,
                y: 0, // Ground height
                hill: hill
            });
        }
    }
    
    generateCheckpoints() {
        this.checkpoints = [];
        const checkpointDistance = 200;
        
        for (let i = 1; i <= 5; i++) {
            this.checkpoints.push({
                z: i * checkpointDistance,
                passed: false
            });
        }
    }
    
    generateTraffic() {
        this.trafficCars = [];
        
        // Traffic increases with level progression
        // Level 1: 3 cars, Level 5: 6 cars, Level 10: 9 cars, Level 15+: more aggressive
        let maxTrafficCars;
        if (this.level > 10) {
            // More aggressive traffic scaling for levels above 10
            maxTrafficCars = Math.min(9 + Math.floor((this.level - 10) * 1.5), 18); // Up to 18 cars for high levels
        } else {
            maxTrafficCars = Math.min(3 + Math.floor(this.level / 2), 9); // Normal progression up to level 10
        }
        
        // Assign to lanes: -0.66, 0, 0.66 for 3 lanes, or -0.5, 0.5 for 2 lanes
        const numLanes = this.level >= 10 ? 2 : 3;
        const lanePositions = numLanes === 3 ? [-0.66, 0, 0.66] : [-0.5, 0.5];
        
        // Space traffic out evenly across the track
        // Reduce minimum spacing as traffic increases (but not too much)
        const minSpacing = Math.max(100, 200 - (this.level - 1) * 5); // Reduce spacing slightly with level
        const usedPositions = [];
        
        for (let i = 0; i < maxTrafficCars; i++) {
            let z, attempts = 0;
            // Ensure we have enough road length
            const maxZ = Math.max(100, this.roadLength - 100); // Leave some buffer
            const minZ = Math.min(500, maxZ - 200); // Start position
            
            do {
                // Try to place traffic, ensuring minimum spacing
                z = minZ + Math.random() * (maxZ - minZ);
                attempts++;
            } while (attempts < 50 && usedPositions.some(pos => Math.abs(pos - z) < minSpacing));
            
            // If we couldn't find a good spot, space them evenly
            if (attempts >= 50) {
                z = minZ + (i * (maxZ - minZ) / Math.max(1, maxTrafficCars));
            }
            
            // Clamp to valid road segment range
            z = Math.max(0, Math.min(z, this.roadLength - 1));
            
            usedPositions.push(z);
            const assignedLane = lanePositions[Math.floor(Math.random() * lanePositions.length)];
            
            // Sci-fi ship colors - brighter for better visibility
            const shipColors = ['#00FFFF', '#FF00FF', '#FFFF00', '#00FF00', '#FF6600', '#0099FF', '#FF0088', '#00FF88'];
            
            this.trafficCars.push({
                z: z,
                x: assignedLane + (Math.random() - 0.5) * 0.08, // Less variation for better lane keeping
                speed: 5 + Math.random() * 8, // Very slow speeds (5-13)
                sprite: Math.floor(Math.random() * 3), // Different ship designs
                color: shipColors[Math.floor(Math.random() * shipColors.length)],
                lane: assignedLane, // Store lane for lane-keeping behavior
                hoverGlow: Math.random() * Math.PI * 2, // Random hover animation phase
                type: Math.floor(Math.random() * 3) // Different ship types
            });
        }
        
        // Sort by z position
        this.trafficCars.sort((a, b) => b.z - a.z);
    }
    
    generateRoadsideObjects() {
        this.roadsideObjects = [];
        
        for (let i = 0; i < 100; i++) {
            const z = Math.random() * this.roadLength;
            const side = Math.random() < 0.5 ? -1 : 1; // Left or right side
            
            this.roadsideObjects.push({
                z: z,
                x: side * (1.5 + Math.random() * 0.5), // Position away from road
                type: Math.floor(Math.random() * 3), // Tree, sign, etc.
                sprite: Math.floor(Math.random() * 2)
            });
        }
        
        // Sort by z position
        this.roadsideObjects.sort((a, b) => b.z - a.z);
    }
    
    setupInput() {
        // Store bound handlers for cleanup
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
            
            // Start game with space
            if (e.code === 'Space' && (this.gameState === 'menu' || this.gameState === 'gameOver')) {
                e.preventDefault();
                this.restart();
            }
            
            // Pause with P
            if (e.code === 'KeyP' && this.gameState === 'playing') {
                e.preventDefault();
                this.gameState = 'paused';
            } else if (e.code === 'KeyP' && this.gameState === 'paused') {
                e.preventDefault();
                this.gameState = 'playing';
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
    }
    
    restart() {
        this.gameState = 'countdown';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.timeLeft = 45;
        this.playerZ = 0;
        this.playerCar.x = 0;
        this.playerCar.speed = 0;
        this.currentCheckpoint = 0;
        this.countdown = 3;
        this.countdownTimer = 0;
        this.generateRoad();
        this.generateCheckpoints();
        this.generateTraffic();
        this.generateRoadsideObjects();
        this.checkpointTime = Date.now();
        
        // Reset collision flags on all traffic cars
        for (let car of this.trafficCars) {
            car.colliding = false;
        }
    }
    
    update(deltaTime) {
        // Normalize deltaTime to 60fps, and cap it to prevent huge jumps
        const dt = Math.min(deltaTime / 16.67, 2); // Cap at 2x normal speed
        
        // Handle countdown - use milliseconds directly
        if (this.gameState === 'countdown') {
            this.countdownTimer += deltaTime; // Accumulate milliseconds
            if (this.countdownTimer >= 1000) { // 1000ms = 1 second
                this.countdownTimer = 0;
                this.countdown--;
                if (this.countdown <= 0) {
                    this.gameState = 'playing';
                }
            }
            return; // Don't update game during countdown
        }
        
        if (this.gameState !== 'playing') return;
        
        // Update time
        this.timeLeft -= dt / 60; // Countdown in seconds
        if (this.timeLeft <= 0) {
            this.lives--;
            this.score = Math.max(0, this.score - 100);
            // Reset timer to level's starting time for next life
            this.timeLeft = 40 + (this.level - 1) * 3;
            this.screenEffects.shake(10);
            this.particles.explode(this.width / 2, this.height - 100, 15, '#FF0000');
            
            if (this.lives <= 0) {
                this.gameOver();
                return;
            }
        }
        
        // Handle input
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            this.playerCar.speed = Math.min(
                this.playerCar.speed + this.playerCar.acceleration * dt,
                this.playerCar.maxSpeed
            );
        } else {
            this.playerCar.speed *= Math.pow(this.playerCar.friction, dt);
        }
        
        if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            this.playerCar.speed = Math.max(
                this.playerCar.speed - this.playerCar.acceleration * dt * 2,
                0
            );
        }
        
        // Steering - always allow steering, very responsive
        const steerMultiplier = this.playerCar.speed > 0 ? 1.2 : 0.6; // More responsive steering
        const steerSpeed = 0.12 * dt * steerMultiplier; // Very fast, responsive steering
        
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.playerCar.x -= steerSpeed;
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.playerCar.x += steerSpeed;
        }
        
        // Get current road segment for curve effect - DISABLED to prevent oscillation
        // The curve effect was causing the car to oscillate uncontrollably
        // const currentSegment = this.roadSegments[Math.floor(this.playerZ)];
        // if (currentSegment && this.playerCar.speed > 0) {
        //     // Update player position based on curve (subtle effect)
        //     this.playerCar.x -= currentSegment.curve * 0.3 * (this.playerCar.speed / this.playerCar.maxSpeed) * dt;
        // }
        
        // Limit player position on road (much wider limits for easier dodging)
        const laneLimit = this.level >= 10 ? 0.8 : 0.9; // Much wider steering range
        this.playerCar.x = Math.max(-laneLimit, Math.min(laneLimit, this.playerCar.x));
        
        // Move player forward (with additional scaling for slower gameplay)
        this.playerZ += this.playerCar.speed * dt * 0.3; // Much slower forward movement (30% of normal)
        
        // Update traffic
        this.updateTraffic(dt);
        
        // Check collisions
        this.checkCollisions();
        
        // Check checkpoints
        this.checkCheckpoints();
        
        // Check win condition
        if (this.playerZ >= this.roadLength) {
            this.completeLevel();
        }
        
        // Update effects
        if (this.isPreview) {
            if (this.particles) this.particles.update();
            if (this.screenEffects) this.screenEffects.update();
        } else {
            if (this.nesEffects && typeof this.nesEffects.update === 'function') {
                this.nesEffects.update();
            }
        }
    }
    
    updateTraffic(dt) {
        const numLanes = this.level >= 10 ? 2 : 3;
        const lanePositions = numLanes === 3 ? [-0.66, 0, 0.66] : [-0.5, 0.5];
        
        for (let car of this.trafficCars) {
            // Move traffic cars backward relative to player
            const relativeZ = car.z - this.playerZ;
            
            // Only update if car is ahead of player
            if (relativeZ > 0) {
                // Move much slower - traffic moves very slowly relative to player
                // When player accelerates, traffic appears to move back slowly, giving time to react
                const relativeSpeed = Math.min(car.speed, this.playerCar.speed * 0.3); // Traffic much slower than player
                car.z -= relativeSpeed * dt * 0.2; // Very reduced speed multiplier for easier gameplay
                
                // Keep car in its lane (slight lane-keeping)
                if (car.lane !== undefined) {
                    const laneCenter = car.lane;
                    car.x += (laneCenter - car.x) * 0.02; // Gently drift toward lane center
                }
                
                // Wrap around if behind player
                if (car.z < this.playerZ - 100) {
                    car.z = this.playerZ + this.roadLength * 0.5 + Math.random() * this.roadLength * 0.5;
                    // Respawn in a random lane
                    car.lane = lanePositions[Math.floor(Math.random() * lanePositions.length)];
                    car.x = car.lane + (Math.random() - 0.5) * 0.1;
                    // Reset collision state when car respawns
                    car.colliding = false;
                    car.collisionCooldown = 0;
                }
            }
            
            // Update collision cooldown
            if (car.collisionCooldown > 0) {
                car.collisionCooldown--;
                if (car.collisionCooldown <= 0 && !car.colliding) {
                    car.colliding = false;
                }
            }
        }
        
        // Sort traffic by z position
        this.trafficCars.sort((a, b) => b.z - a.z);
    }
    
    checkCollisions() {
        // Only check collisions if player is moving (has some speed)
        if (this.playerCar.speed < 10) return;
        
        const playerSegment = Math.max(0, Math.min(Math.floor(this.playerZ), this.roadSegments.length - 1));
        const playerSegmentData = this.roadSegments[playerSegment];
        if (!playerSegmentData) return;
        
        // More accurate collision detection
        const collisionRadiusX = 0.15; // X-axis collision tolerance (balanced)
        const collisionRadiusZ = 20; // Z-axis collision tolerance (balanced)
        
        for (let car of this.trafficCars) {
            const relativeZ = car.z - this.playerZ;
            
            // Only check ships that are ahead of player and close
            // Don't check ships behind player (relativeZ < 0)
            if (relativeZ > 0 && relativeZ < collisionRadiusZ) {
                // More accurate distance calculation
                const distanceX = Math.abs(car.x - this.playerCar.x);
                
                // Use rectangular collision detection (more accurate than circular)
                // Account for ship width in X direction - wider for levels above 10
                const shipWidthX = this.level > 10 ? 0.18 : 0.12; // Wider ships at higher levels
                const shipLengthZ = this.level > 10 ? 20 : 15; // Longer ships at higher levels
                
                if (distanceX < (collisionRadiusX + shipWidthX) && relativeZ < (collisionRadiusZ + shipLengthZ)) {
                    // Double check - make sure we're not colliding with same car multiple times
                    if (!car.colliding) {
                        car.colliding = true;
                        car.collisionCooldown = 60; // 60 frames cooldown (~1 second at 60fps)
                        this.handleCollision();
                        break;
                    }
                } else if (car.colliding) {
                    // Reset collision flag when no longer colliding
                    car.collisionCooldown--;
                    if (car.collisionCooldown <= 0) {
                        car.colliding = false;
                    }
                }
            }
        }
    }
    
    handleCollision() {
        // Slow down and add effects
        this.playerCar.speed *= 0.3;
        if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
            this.screenEffects.shake(10);
        }
        if (this.particles && typeof this.particles.explode === 'function') {
            this.particles.explode(this.width / 2, this.height - 100, 15, '#FF0000');
        }
        this.lives--;
        this.score = Math.max(0, this.score - 100);
        
        if (this.lives <= 0) {
            this.gameOver();
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        
        // Check if this is a high score
        if (highScoreManager.checkHighScore('micro-racing', this.score)) {
            highScoreManager.requestNameEntry('micro-racing', this.score);
        }
    }
    
    checkCheckpoints() {
        const checkpoint = this.checkpoints[this.currentCheckpoint];
        if (!checkpoint || checkpoint.passed) return;
        
        if (this.playerZ >= checkpoint.z) {
            checkpoint.passed = true;
            this.currentCheckpoint++;
            
            // Add time bonus - smaller bonus for tighter gameplay
            const timeBonus = Math.floor(this.timeLeft);
            this.timeLeft = Math.min(this.timeLeft + 5, 50); // Add 5 seconds, max 50
            this.score += timeBonus * 10;
            
            // Add particles
            if (this.particles && typeof this.particles.explode === 'function') {
                this.particles.explode(this.width / 2, this.height - 150, 15, '#00FF00');
            }
        }
    }
    
    completeLevel() {
        this.level++;
        this.score += Math.floor(this.timeLeft) * 100;
        this.playerZ = 0;
        this.playerCar.x = 0;
        this.currentCheckpoint = 0;
        // Timer based on road length - tighter but scales with level
        // Base 40 seconds, plus 3 seconds per level (for longer levels)
        this.timeLeft = 40 + (this.level - 1) * 3;
        this.generateRoad(); // Road length increases automatically
        this.generateCheckpoints();
        this.generateTraffic();
        this.generateRoadsideObjects();
        
        // Change horizon color based on level
        const colorIndex = (this.level - 1) % this.trackColors.length;
        // Horizon color will be set in drawHorizon()
        
        if (this.screenEffects && typeof this.screenEffects.flash === 'function') {
            this.screenEffects.flash('#00FF00');
        }
        this.checkpointTime = Date.now();
    }
    
    // Project 3D point to 2D screen position
    project(point, cameraX, cameraY, cameraZ) {
        const scale = this.cameraDepth / (point.z - cameraZ);
        return {
            x: (point.x - cameraX) * scale + this.width / 2,
            y: (point.y - cameraY) * scale + this.height / 2,
            scale: scale
        };
    }
    
    drawPixi() {
        if (this.isPreview || !this.graphics || !this.graphics.isInitialized) return;
        
        // Clear all layers
        const bgLayer = this.graphics.getLayer('background');
        const fgLayer = this.graphics.getLayer('foreground');
        const uiLayer = this.graphics.getLayer('ui');
        
        bgLayer.removeChildren();
        fgLayer.removeChildren();
        uiLayer.removeChildren();
        
        // Draw background gradient
        this.drawBackgroundPixi(bgLayer);
        
        // Draw stars
        this.drawStarsPixi(bgLayer);
        
        if (this.gameState === 'menu') {
            this.drawMenuPixi(uiLayer);
            this.drawUIPixi(uiLayer);
            return;
        }
        
        if (this.gameState === 'playing' || this.gameState === 'countdown') {
            // Draw horizon
            this.drawHorizonPixi(bgLayer);
            
            // Draw road
            this.drawRoadPixi(fgLayer);
            
            // Draw start/finish lines
            this.drawStartFinishLinesPixi(fgLayer);
            
            // Draw roadside objects
            this.drawRoadsideObjectsPixi(fgLayer);
            
            // Draw traffic
            this.drawTrafficPixi(fgLayer);
            
            // Draw player car
            this.drawPlayerCarPixi(fgLayer);
        }
        
        // Draw UI
        this.drawUIPixi(uiLayer);
        
        // Draw countdown
        if (this.gameState === 'countdown') {
            this.drawCountdownPixi(uiLayer);
        }
    }
    
    draw() {
        if (this.isPreview) {
            this.drawCanvas2D();
            return;
        }
        
        // PixiJS rendering
        this.drawPixi();
    }
    
    drawCanvas2D() {
        // Clear canvas with sci-fi space gradient - changes per level
        const colorIndex = (this.level - 1) % this.trackColors.length;
        const bgColor = this.trackColors[colorIndex].horizon;
        
        // Create darker version for ground
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        const darkR = Math.max(0, Math.floor(r * 0.3));
        const darkG = Math.max(0, Math.floor(g * 0.3));
        const darkB = Math.max(0, Math.floor(b * 0.3));
        
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, bgColor); // Space color
        gradient.addColorStop(0.5, `rgb(${Math.floor(r * 0.8)}, ${Math.floor(g * 0.8)}, ${Math.floor(b * 0.8)})`);
        gradient.addColorStop(1, `rgb(${darkR}, ${darkG}, ${darkB})`); // Dark ground
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Add some stars for sci-fi feel
        this.drawStars();
        
        if (this.gameState === 'menu') {
            this.drawMenu();
            return;
        }
        
        // Apply screen effects
        let shake = { x: 0, y: 0 };
        if (this.screenEffects && typeof this.screenEffects.getShakeOffset === 'function') {
            shake = this.screenEffects.getShakeOffset();
        }
        this.ctx.save();
        this.ctx.translate(shake.x, shake.y);
        
        if (this.gameState === 'playing' || this.gameState === 'countdown') {
            // Draw horizon first
            this.drawHorizon();
            
            // Draw road
            this.drawRoad();
            
            // Draw start/finish lines
            this.drawStartFinishLines();
            
            // Draw roadside objects
            this.drawRoadsideObjects();
            
            // Draw traffic
            this.drawTraffic();
            
            // Draw player car (always at bottom)
            this.drawPlayerCar();
            
            // Draw particles
            if (this.particles && typeof this.particles.draw === 'function') {
                this.particles.draw(this.ctx);
            }
        }
        
        this.ctx.restore();
        
        // Draw UI (always on top)
        this.drawUI();
        
        // Draw countdown
        if (this.gameState === 'countdown') {
            this.drawCountdown();
        }
        
        // Draw screen effects
        if (this.screenEffects && typeof this.screenEffects.drawFlash === 'function') {
            this.screenEffects.drawFlash();
        }
    }
    
    drawMenu() {
        // Draw menu background
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw title
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.font = 'bold 36px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('HYPER RUNNERS', this.width / 2, this.height / 2 - 100);
        
        // Draw high score
        const topScore = highScoreManager.getTopScore('micro-racing');
        this.ctx.font = '20px Courier New';
        this.ctx.fillStyle = '#FFFF00';
        if (topScore > 0) {
            this.ctx.fillText(`HIGH SCORE: ${Utils.formatScore(topScore)}`, this.width / 2, this.height / 2 - 60);
        } else {
            this.ctx.fillText('HIGH SCORE: 0', this.width / 2, this.height / 2 - 60);
        }
        
        // Draw instructions
        this.ctx.font = '18px Courier New';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText('Arrow Keys or WASD: Pilot your hover ship', this.width / 2, this.height / 2 - 20);
        this.ctx.fillText('Dodge traffic and reach checkpoints!', this.width / 2, this.height / 2 + 10);
        this.ctx.fillText('Press SPACE to start', this.width / 2, this.height / 2 + 50);
        
        this.ctx.textAlign = 'left';
    }
    
    // PixiJS rendering methods
    drawBackgroundPixi(layer) {
        const colorIndex = (this.level - 1) % this.trackColors.length;
        const bgColor = this.trackColors[colorIndex].horizon;
        
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        const darkR = Math.max(0, Math.floor(r * 0.3));
        const darkG = Math.max(0, Math.floor(g * 0.3));
        const darkB = Math.max(0, Math.floor(b * 0.3));
        
        // Draw gradient using multiple rectangles with varying colors
        const segments = 50;
        for (let i = 0; i < segments; i++) {
            const y1 = (i / segments) * this.height;
            const y2 = ((i + 1) / segments) * this.height;
            const progress = i / segments;
            
            let colorR, colorG, colorB;
            if (progress < 0.5) {
                const t = progress * 2;
                colorR = Math.floor(r * (1 - t) + r * 0.8 * t);
                colorG = Math.floor(g * (1 - t) + g * 0.8 * t);
                colorB = Math.floor(b * (1 - t) + b * 0.8 * t);
            } else {
                const t = (progress - 0.5) * 2;
                colorR = Math.floor(r * 0.8 * (1 - t) + darkR * t);
                colorG = Math.floor(g * 0.8 * (1 - t) + darkG * t);
                colorB = Math.floor(b * 0.8 * (1 - t) + darkB * t);
            }
            
            const color = (colorR << 16) | (colorG << 8) | colorB;
            const rect = new PIXI.Graphics();
            rect.beginFill(color, 1);
            rect.drawRect(0, y1, this.width, y2 - y1);
            rect.endFill();
            layer.addChild(rect);
        }
    }
    
    drawStarsPixi(layer) {
        const stars = new PIXI.Graphics();
        stars.beginFill(0xffffff, 1);
        for (let i = 0; i < 100; i++) {
            const x = (i * 137.5) % this.width;
            const y = (i * 237.5) % this.horizonY;
            const size = (i % 3) + 1;
            stars.drawRect(x, y, size, size);
        }
        stars.endFill();
        layer.addChild(stars);
    }
    
    drawHorizonPixi(layer) {
        const colorIndex = (this.level - 1) % this.trackColors.length;
        const horizonColor = this.trackColors[colorIndex].horizon;
        
        const r = parseInt(horizonColor.slice(1, 3), 16);
        const g = parseInt(horizonColor.slice(3, 5), 16);
        const b = parseInt(horizonColor.slice(5, 7), 16);
        
        // Draw horizon line with glow effect
        const horizon = new PIXI.Graphics();
        horizon.lineStyle(3, (r << 16) | (g << 8) | b, 1);
        horizon.moveTo(0, this.horizonY);
        horizon.lineTo(this.width, this.horizonY);
        
        // Add glow lines above and below
        horizon.lineStyle(2, (r << 16) | (g << 8) | b, 0.5);
        horizon.moveTo(0, this.horizonY - 2);
        horizon.lineTo(this.width, this.horizonY - 2);
        horizon.moveTo(0, this.horizonY + 2);
        horizon.lineTo(this.width, this.horizonY + 2);
        
        layer.addChild(horizon);
    }
    
    drawRoadPixi(layer) {
        const playerSegment = Math.floor(this.playerZ);
        const cameraHeight = this.cameraHeight;
        const cameraDepth = this.cameraDepth;
        const numLanes = this.level >= 10 ? 2 : 3;
        
        const currentTime = Date.now();
        const baseGlow = Math.sin(currentTime / 500) * 0.3 + 0.7;
        
        for (let i = 1; i < 100; i++) {
            const segmentIndex = playerSegment + i;
            if (segmentIndex >= this.roadSegments.length) break;
            
            const segment = this.roadSegments[segmentIndex];
            const z = segment.z - this.playerZ;
            
            if (z <= 0 || z > 500) continue;
            
            const scale = cameraDepth / z;
            const roadWidth = this.roadWidth * scale;
            const roadX = (segment.curve * scale * 300) + this.width / 2;
            const segmentY = this.horizonY + (cameraHeight / z);
            
            if (segmentY < this.horizonY) continue;
            
            if (i > 1) {
                const prevSegment = this.roadSegments[segmentIndex - 1];
                const prevZ = prevSegment.z - this.playerZ;
                if (prevZ <= 0) continue;
                
                const prevScale = cameraDepth / prevZ;
                const prevRoadWidth = this.roadWidth * prevScale;
                const prevRoadX = (prevSegment.curve * prevScale * 300) + this.width / 2;
                const prevSegmentY = this.horizonY + (cameraHeight / prevZ);
                
                if (prevSegmentY < this.horizonY) continue;
                
                // Draw road segment (trapezoid)
                const colorIndex = (this.level - 1) % this.trackColors.length;
                const trackColor = this.trackColors[colorIndex];
                const trackBrightness = Math.min(1, z / 200);
                const baseR = Math.floor(trackColor.r + trackBrightness * 30);
                const baseG = Math.floor(trackColor.g + trackBrightness * 40);
                const baseB = Math.floor(trackColor.b + trackBrightness * 60);
                const roadColor = (baseR << 16) | (baseG << 8) | baseB;
                
                const roadSegment = new PIXI.Graphics();
                roadSegment.beginFill(roadColor, 1);
                roadSegment.drawPolygon([
                    prevRoadX - prevRoadWidth / 2, prevSegmentY,
                    prevRoadX + prevRoadWidth / 2, prevSegmentY,
                    roadX + roadWidth / 2, segmentY,
                    roadX - roadWidth / 2, segmentY
                ]);
                roadSegment.endFill();
                layer.addChild(roadSegment);
                
                // Draw lane dividers
                if (numLanes === 3) {
                    const laneDividerWidth = Math.max(1, 2 * scale);
                    const leftDividerX = prevRoadX - prevRoadWidth / 3;
                    const rightDividerX = prevRoadX + prevRoadWidth / 3;
                    
                    const leftDivider = new PIXI.Graphics();
                    leftDivider.lineStyle(laneDividerWidth, 0x00ffff, baseGlow);
                    leftDivider.moveTo(leftDividerX, prevSegmentY);
                    leftDivider.lineTo(leftDividerX - (prevRoadWidth - roadWidth) / 3, segmentY);
                    layer.addChild(leftDivider);
                    
                    const rightDivider = new PIXI.Graphics();
                    rightDivider.lineStyle(laneDividerWidth, 0xff00ff, baseGlow);
                    rightDivider.moveTo(rightDividerX, prevSegmentY);
                    rightDivider.lineTo(rightDividerX - (prevRoadWidth - roadWidth) / 3, segmentY);
                    layer.addChild(rightDivider);
                } else {
                    const laneDividerWidth = Math.max(2, 3 * scale);
                    if (i % 10 < 5) {
                        const centerDivider = new PIXI.Graphics();
                        centerDivider.lineStyle(laneDividerWidth, 0xffff00, baseGlow);
                        centerDivider.moveTo(prevRoadX, prevSegmentY);
                        centerDivider.lineTo(roadX, segmentY);
                        layer.addChild(centerDivider);
                    }
                }
                
                // Draw track edges
                const edgeGraphics = new PIXI.Graphics();
                edgeGraphics.lineStyle(Math.max(2, 4 * scale), 0x00c8ff, 0.8);
                edgeGraphics.moveTo(prevRoadX - prevRoadWidth / 2, prevSegmentY);
                edgeGraphics.lineTo(roadX - roadWidth / 2, segmentY);
                edgeGraphics.moveTo(prevRoadX + prevRoadWidth / 2, prevSegmentY);
                edgeGraphics.lineTo(roadX + roadWidth / 2, segmentY);
                layer.addChild(edgeGraphics);
            }
        }
    }
    
    drawStartFinishLinesPixi(layer) {
        // Start line
        const startZ = 0 - this.playerZ;
        if (startZ > 0 && startZ < 200) {
            const scale = this.cameraDepth / startZ;
            const roadWidth = this.roadWidth * scale;
            const roadX = this.width / 2;
            const segmentY = this.horizonY + (this.cameraHeight / startZ);
            
            if (segmentY >= this.horizonY && segmentY < this.height) {
                const startLine = new PIXI.Graphics();
                startLine.beginFill(0xffffff, 1);
                startLine.drawRect(roadX - roadWidth / 2, segmentY - 12, roadWidth, 24);
                
                const checkerSize = roadWidth / 8;
                startLine.beginFill(0x000000, 1);
                for (let i = 0; i < 8; i += 2) {
                    startLine.drawRect(roadX - roadWidth / 2 + i * checkerSize, segmentY - 12, checkerSize, 12);
                    startLine.drawRect(roadX - roadWidth / 2 + (i + 1) * checkerSize, segmentY, checkerSize, 12);
                }
                startLine.endFill();
                layer.addChild(startLine);
            }
        }
        
        // Finish line
        const finishZ = this.roadLength - this.playerZ;
        if (finishZ > 0 && finishZ < 500) {
            const scale = this.cameraDepth / finishZ;
            const roadWidth = this.roadWidth * scale;
            const roadX = this.width / 2;
            const segmentY = this.horizonY + (this.cameraHeight / finishZ);
            
            if (segmentY >= this.horizonY && segmentY < this.height) {
                const finishLine = new PIXI.Graphics();
                finishLine.beginFill(0xffd700, 1);
                finishLine.drawRect(roadX - roadWidth / 2, segmentY - 15, roadWidth, 30);
                
                const checkerSize = roadWidth / 8;
                finishLine.beginFill(0x000000, 1);
                for (let i = 0; i < 8; i += 2) {
                    finishLine.drawRect(roadX - roadWidth / 2 + i * checkerSize, segmentY - 15, checkerSize, 15);
                    finishLine.drawRect(roadX - roadWidth / 2 + (i + 1) * checkerSize, segmentY, checkerSize, 15);
                }
                finishLine.endFill();
                layer.addChild(finishLine);
            }
        }
    }
    
    drawRoadsideObjectsPixi(layer) {
        const playerSegment = Math.floor(this.playerZ);
        const cameraHeight = this.cameraHeight;
        const cameraDepth = this.cameraDepth;
        
        const currentTime = Date.now();
        const baseGlow = Math.sin(currentTime / 800) * 0.3 + 0.7;
        
        let drawn = 0;
        const maxDrawn = 30;
        
        for (let obj of this.roadsideObjects) {
            const relativeZ = obj.z - this.playerZ;
            
            if (relativeZ <= 0 || relativeZ > 200) continue;
            if (drawn++ >= maxDrawn) break;
            
            const scale = cameraDepth / relativeZ;
            const roadWidth = this.roadWidth * scale;
            
            const segmentIndex = Math.max(0, Math.min(Math.floor(obj.z), this.roadSegments.length - 1));
            const segment = this.roadSegments[segmentIndex];
            if (!segment) continue;
            
            const baseRoadX = segment.curve * scale * 300 + this.width / 2;
            const x = baseRoadX + obj.x * roadWidth / 2;
            const y = this.horizonY + (cameraHeight / relativeZ);
            
            if (y < this.horizonY) continue;
            
            const size = Math.max(15, 50 * scale);
            const glowIntensity = baseGlow;
            
            const objectGraphics = new PIXI.Graphics();
            
            if (obj.type === 0) {
                // Energy pylon
                const color = 0x00ffff;
                objectGraphics.beginFill(color, glowIntensity);
                objectGraphics.drawRect(x - size / 8, y - size, size / 4, size);
                objectGraphics.drawRect(x - size / 3, y - size * 0.8, size * 2/3, size / 6);
                objectGraphics.endFill();
            } else if (obj.type === 1) {
                // Floating crystal
                const color = 0xff00ff;
                objectGraphics.beginFill(color, glowIntensity);
                objectGraphics.drawPolygon([
                    x, y - size,
                    x - size / 2, y - size / 2,
                    x, y,
                    x + size / 2, y - size / 2
                ]);
                objectGraphics.endFill();
            } else {
                // Energy beacon
                const color = 0xffff00;
                objectGraphics.beginFill(color, glowIntensity);
                objectGraphics.drawCircle(x, y - size / 2, size / 3);
                objectGraphics.endFill();
            }
            
            layer.addChild(objectGraphics);
        }
    }
    
    drawTrafficPixi(layer) {
        const playerSegment = Math.floor(this.playerZ);
        const cameraHeight = this.cameraHeight;
        const cameraDepth = this.cameraDepth;
        
        for (let car of this.trafficCars) {
            const relativeZ = car.z - this.playerZ;
            
            if (relativeZ <= 0 || relativeZ > 400) continue;
            
            const scale = cameraDepth / relativeZ;
            const roadWidth = this.roadWidth * scale;
            
            const segmentIndex = Math.max(0, Math.min(Math.floor(car.z), this.roadSegments.length - 1));
            const segment = this.roadSegments[segmentIndex];
            if (!segment) continue;
            
            const baseRoadX = segment.curve * scale * 300 + this.width / 2;
            const x = baseRoadX + car.x * roadWidth / 2;
            const y = this.horizonY + (cameraHeight / relativeZ) - 30 * scale;
            
            if (y < this.horizonY) continue;
            
            const baseWidth = this.level > 10 ? 40 : 30;
            const baseHeight = this.level > 10 ? 70 : 60;
            const width = Math.max(this.level > 10 ? 25 : 20, baseWidth * scale);
            const height = Math.max(this.level > 10 ? 50 : 40, baseHeight * scale);
            
            car.hoverGlow = (car.hoverGlow || 0) + 0.1;
            const hoverPulse = Math.sin(car.hoverGlow) * 0.3 + 0.7;
            
            const carGraphics = new PIXI.Graphics();
            const colorHex = parseInt(car.color.replace('#', ''), 16);
            const glowSize = width * 0.8;
            const glowAlpha = 0.3 * hoverPulse;
            
            // Glow
            carGraphics.beginFill(colorHex, glowAlpha);
            carGraphics.drawRect(x - glowSize / 2, y - glowSize / 4, glowSize, glowSize / 2);
            carGraphics.endFill();
            
            // Main body
            carGraphics.beginFill(colorHex, 1);
            carGraphics.drawRect(x - width / 2, y - height, width, height);
            carGraphics.endFill();
            
            // Outline
            carGraphics.lineStyle(Math.max(2, 3 * scale), 0xffffff, 1);
            carGraphics.drawRect(x - width / 2, y - height, width, height);
            
            // Center indicator
            carGraphics.beginFill(0xffffff, 1);
            carGraphics.drawRect(x - 2 * scale, y - height, 4 * scale, height * 0.3);
            carGraphics.drawRect(x - 2 * scale, y - height * 0.3, 4 * scale, height * 0.3);
            carGraphics.endFill();
            
            // Engine glow
            carGraphics.beginFill(0xffff00, hoverPulse * 0.8);
            carGraphics.drawRect(x - width / 3, y - height * 0.2, width * 2/3, height * 0.2);
            carGraphics.endFill();
            
            layer.addChild(carGraphics);
        }
    }
    
    drawPlayerCarPixi(layer) {
        if (!this.playerCar.hoverGlow) this.playerCar.hoverGlow = 0;
        this.playerCar.hoverGlow += 0.15;
        const hoverPulse = Math.sin(this.playerCar.hoverGlow) * 0.3 + 0.7;
        
        const bottomRoadWidth = this.roadWidth * (this.cameraDepth / 20);
        const x = this.width / 2 + this.playerCar.x * (bottomRoadWidth / 2);
        const y = this.height - 120;
        const width = 40;
        const height = 75;
        
        const carGraphics = new PIXI.Graphics();
        const colorHex = parseInt(this.playerCar.color.replace('#', ''), 16);
        const glowSize = width * 0.8;
        const glowAlpha = 0.3 * hoverPulse;
        
        // Glow
        carGraphics.beginFill(0x00ffff, glowAlpha);
        carGraphics.drawRect(x - glowSize / 2, y - glowSize / 4, glowSize, glowSize / 2);
        carGraphics.endFill();
        
        // Main body
        carGraphics.beginFill(colorHex, 1);
        carGraphics.drawRect(x - width / 2, y - height, width, height * 0.7);
        carGraphics.endFill();
        
        // Cockpit
        carGraphics.beginFill(0x000000, 0.7);
        carGraphics.drawRect(x - width / 3, y - height + height * 0.15, width * 2/3, height * 0.35);
        carGraphics.endFill();
        
        // Engine pods
        carGraphics.beginFill(colorHex, 1);
        carGraphics.drawRect(x - width / 2 - width * 0.35, y - height * 0.6, width * 0.45, height * 0.45);
        carGraphics.drawRect(x + width / 2 - width * 0.1, y - height * 0.6, width * 0.45, height * 0.45);
        carGraphics.endFill();
        
        // Engine glow
        carGraphics.beginFill(0xffff00, hoverPulse);
        carGraphics.drawRect(x - width / 2 - width * 0.3, y - height * 0.55, width * 0.35, height * 0.35);
        carGraphics.drawRect(x + width / 2 - width * 0.05, y - height * 0.55, width * 0.35, height * 0.35);
        carGraphics.endFill();
        
        // Central energy core
        carGraphics.beginFill(0x00ffff, hoverPulse);
        carGraphics.drawRect(x - 4, y - height * 0.4, 8, height * 0.3);
        carGraphics.endFill();
        
        // Wing details
        carGraphics.beginFill(0xffffff, 0.5);
        carGraphics.drawRect(x - width * 0.45, y - height * 0.5, width * 0.3, 3);
        carGraphics.drawRect(x + width * 0.15, y - height * 0.5, width * 0.3, 3);
        carGraphics.endFill();
        
        layer.addChild(carGraphics);
    }
    
    drawUIPixi(layer) {
        // Update stats panel instead of drawing on canvas
        this.updateStatsPanel();
        
        // Speedometer still drawn on canvas (bottom right)
        const speed = Math.floor(this.playerCar.speed);
        const speedStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 20,
            fill: speed > 150 ? 0xff0000 : 0x00ff00,
            fontWeight: 'bold'
        });
        const speedText = new PIXI.Text(`SPEED: ${speed}`, speedStyle);
        speedText.x = this.width - 150;
        speedText.y = this.height - 40;
        layer.addChild(speedText);
        
        // Game state messages
        if (this.gameState === 'paused') {
            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.8);
            overlay.drawRect(0, 0, this.width, this.height);
            overlay.endFill();
            layer.addChild(overlay);
            
            const pauseStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 36,
                fill: 0xffff00,
                align: 'center'
            });
            const pauseText = new PIXI.Text('PAUSED', pauseStyle);
            pauseText.anchor.set(0.5);
            pauseText.x = this.width / 2;
            pauseText.y = this.height / 2;
            layer.addChild(pauseText);
        } else if (this.gameState === 'gameOver') {
            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.8);
            overlay.drawRect(0, 0, this.width, this.height);
            overlay.endFill();
            layer.addChild(overlay);
            
            const gameOverStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 36,
                fill: 0xff0000,
                align: 'center'
            });
            const gameOverText = new PIXI.Text('GAME OVER', gameOverStyle);
            gameOverText.anchor.set(0.5);
            gameOverText.x = this.width / 2;
            gameOverText.y = this.height / 2 - 20;
            layer.addChild(gameOverText);
            
            const restartStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 18,
                fill: 0xffffff,
                align: 'center'
            });
            const restartText = new PIXI.Text('Press SPACE to restart', restartStyle);
            restartText.anchor.set(0.5);
            restartText.x = this.width / 2;
            restartText.y = this.height / 2 + 70;
            layer.addChild(restartText);
        }
    }
    
    updateStatsPanel() {
        const statsPanel = document.getElementById('game-stats-panel');
        if (!statsPanel) return;
        
        const statsContent = statsPanel.querySelector('.stats-content');
        if (!statsContent) return;
        
        statsContent.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Score</div>
                <div class="stat-value">${Utils.formatScore(this.score)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Time</div>
                <div class="stat-value">${Math.max(0, Math.floor(this.timeLeft))}s</div>
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
                <div class="stat-label">Checkpoint</div>
                <div class="stat-value">${this.currentCheckpoint}/${this.checkpoints.length}</div>
            </div>
        `;
    }
    
    drawMenuPixi(layer) {
        const menuBg = new PIXI.Graphics();
        menuBg.beginFill(0x1a1a2e, 1);
        menuBg.drawRect(0, 0, this.width, this.height);
        menuBg.endFill();
        layer.addChild(menuBg);
        
        const titleStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 48,
            fill: 0x00ffff,
            fontWeight: 'bold',
            align: 'center'
        });
        const title = new PIXI.Text('HYPER RUNNERS', titleStyle);
        title.anchor.set(0.5);
        title.x = this.width / 2;
        title.y = this.height / 2 - 100;
        layer.addChild(title);
        
        const instructionStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 16,
            fill: 0xffffff,
            align: 'center'
        });
        
        const instructions = [
            'Press SPACE to Start',
            'Arrow Keys: Steer',
            'Avoid traffic and reach the finish!'
        ];
        
        instructions.forEach((text, i) => {
            const instruction = new PIXI.Text(text, instructionStyle);
            instruction.anchor.set(0.5);
            instruction.x = this.width / 2;
            instruction.y = this.height / 2 - 20 + (i * 30);
            layer.addChild(instruction);
        });
    }
    
    drawCountdownPixi(layer) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.7);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
        layer.addChild(overlay);
        
        const countdownStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 120,
            fill: 0xffff00,
            fontWeight: 'bold',
            align: 'center'
        });
        
        const countdownText = new PIXI.Text(
            this.countdown > 0 ? this.countdown.toString() : 'GO!',
            countdownStyle
        );
        countdownText.anchor.set(0.5);
        countdownText.x = this.width / 2;
        countdownText.y = this.height / 2;
        layer.addChild(countdownText);
    }
    
    drawHorizon() {
        // Draw sci-fi horizon line with glow effect - changes color per level
        const colorIndex = (this.level - 1) % this.trackColors.length;
        const horizonColor = this.trackColors[colorIndex].horizon;
        
        // Convert hex to RGB for gradient
        const r = parseInt(horizonColor.slice(1, 3), 16);
        const g = parseInt(horizonColor.slice(3, 5), 16);
        const b = parseInt(horizonColor.slice(5, 7), 16);
        
        const gradient = this.ctx.createLinearGradient(0, this.horizonY - 2, 0, this.horizonY + 2);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 1)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.5)`);
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.horizonY);
        this.ctx.lineTo(this.width, this.horizonY);
        this.ctx.stroke();
    }
    
    drawStars() {
        // Simple starfield effect
        this.ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 100; i++) {
            const x = (i * 137.5) % this.width; // Golden angle distribution
            const y = (i * 237.5) % this.horizonY;
            const size = (i % 3) + 1;
            this.ctx.fillRect(x, y, size, size);
        }
    }
    
    drawRoad() {
        const playerSegment = Math.floor(this.playerZ);
        const cameraHeight = this.cameraHeight;
        const cameraDepth = this.cameraDepth;
        const numLanes = this.level >= 10 ? 2 : 3; // 2 lanes after level 10
        
        // Cache glow calculation outside loop for performance
        const currentTime = Date.now();
        const baseGlow = Math.sin(currentTime / 500) * 0.3 + 0.7;
        
        // Draw fewer road segments for better performance (100 instead of 300)
        for (let i = 1; i < 100; i++) {
            const segmentIndex = playerSegment + i;
            if (segmentIndex >= this.roadSegments.length) break;
            
            const segment = this.roadSegments[segmentIndex];
            const z = segment.z - this.playerZ;
            
            if (z <= 0) continue; // Don't draw segments behind player
            if (z > 500) continue; // Don't draw too far ahead
            
            // Calculate perspective
            const scale = cameraDepth / z;
            const roadWidth = (this.roadWidth * scale); // Much wider road
            const roadX = (segment.curve * scale * 300) + this.width / 2;
            
            // Road segment position on screen (from horizon)
            const segmentY = this.horizonY + (cameraHeight / z);
            
            // Don't draw if segment is above horizon
            if (segmentY < this.horizonY) continue;
            
            // Sci-fi track color (glowing energy track) - changes per level
            const colorIndex = (this.level - 1) % this.trackColors.length;
            const trackColor = this.trackColors[colorIndex];
            const trackBrightness = Math.min(1, z / 200);
            const baseR = Math.floor(trackColor.r + trackBrightness * 30);
            const baseG = Math.floor(trackColor.g + trackBrightness * 40);
            const baseB = Math.floor(trackColor.b + trackBrightness * 60);
            const roadColor = `rgb(${baseR}, ${baseG}, ${baseB})`;
            
            // Get previous segment for connection
            if (i > 1) {
                const prevSegment = this.roadSegments[segmentIndex - 1];
                const prevZ = prevSegment.z - this.playerZ;
                if (prevZ <= 0) continue;
                
                const prevScale = cameraDepth / prevZ;
                const prevRoadWidth = (this.roadWidth * prevScale);
                const prevRoadX = (prevSegment.curve * prevScale * 300) + this.width / 2;
                const prevSegmentY = this.horizonY + (cameraHeight / prevZ);
                
                // Don't draw if previous segment is above horizon
                if (prevSegmentY < this.horizonY) continue;
                
                // Draw road segment (trapezoid)
                this.ctx.fillStyle = roadColor;
                this.ctx.beginPath();
                this.ctx.moveTo(prevRoadX - prevRoadWidth / 2, prevSegmentY);
                this.ctx.lineTo(prevRoadX + prevRoadWidth / 2, prevSegmentY);
                this.ctx.lineTo(roadX + roadWidth / 2, segmentY);
                this.ctx.lineTo(roadX - roadWidth / 2, segmentY);
                this.ctx.closePath();
                this.ctx.fill();
                
                // Draw lane dividers (simplified for performance - no shadows)
                if (numLanes === 3) {
                    // 3 lanes: left divider and right divider
                    const laneDividerWidth = Math.max(1, 2 * scale);
                    const leftDividerX = prevRoadX - prevRoadWidth / 3;
                    const rightDividerX = prevRoadX + prevRoadWidth / 3;
                    
                    // Left lane divider (glowing cyan)
                    this.ctx.strokeStyle = `rgba(0, 255, 255, ${baseGlow})`;
                    this.ctx.lineWidth = laneDividerWidth;
                    this.ctx.beginPath();
                    this.ctx.moveTo(leftDividerX, prevSegmentY);
                    this.ctx.lineTo(leftDividerX - (prevRoadWidth - roadWidth) / 3, segmentY);
                    this.ctx.stroke();
                    
                    // Right lane divider (glowing magenta)
                    this.ctx.strokeStyle = `rgba(255, 0, 255, ${baseGlow})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(rightDividerX, prevSegmentY);
                    this.ctx.lineTo(rightDividerX - (prevRoadWidth - roadWidth) / 3, segmentY);
                    this.ctx.stroke();
                } else {
                    // 2 lanes: center divider only
                    const laneDividerWidth = Math.max(2, 3 * scale);
                    this.ctx.strokeStyle = `rgba(255, 255, 0, ${baseGlow})`;
                    this.ctx.lineWidth = laneDividerWidth;
                    // Dashed center line
                    if (i % 10 < 5) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(prevRoadX, prevSegmentY);
                        this.ctx.lineTo(roadX, segmentY);
                        this.ctx.stroke();
                    }
                }
                
                // Draw track edges (simplified, no glow for performance)
                this.ctx.strokeStyle = `rgba(0, 200, 255, 0.8)`;
                this.ctx.lineWidth = Math.max(2, 4 * scale);
                this.ctx.beginPath();
                this.ctx.moveTo(prevRoadX - prevRoadWidth / 2, prevSegmentY);
                this.ctx.lineTo(roadX - roadWidth / 2, segmentY);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.moveTo(prevRoadX + prevRoadWidth / 2, prevSegmentY);
                this.ctx.lineTo(roadX + roadWidth / 2, segmentY);
                this.ctx.stroke();
            }
        }
    }
    
    drawStartFinishLines() {
        // Draw start line at beginning (z = 0)
        const startZ = 0 - this.playerZ;
        if (startZ > 0 && startZ < 200) {
            const scale = this.cameraDepth / startZ;
            const roadWidth = this.roadWidth * scale;
            const roadX = this.width / 2;
            const segmentY = this.horizonY + (this.cameraHeight / startZ);
            
            if (segmentY >= this.horizonY && segmentY < this.height) {
                // Draw checkered start line
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fillRect(roadX - roadWidth / 2, segmentY - 12, roadWidth, 24);
                // Checker pattern (black and white)
                const checkerSize = roadWidth / 8;
                this.ctx.fillStyle = '#000000';
                for (let i = 0; i < 8; i += 2) {
                    this.ctx.fillRect(roadX - roadWidth / 2 + i * checkerSize, segmentY - 12, checkerSize, 12);
                    this.ctx.fillRect(roadX - roadWidth / 2 + (i + 1) * checkerSize, segmentY, checkerSize, 12);
                }
            }
        }
        
        // Draw finish line at end
        const finishZ = this.roadLength - this.playerZ;
        if (finishZ > 0 && finishZ < 500) {
            const scale = this.cameraDepth / finishZ;
            const roadWidth = this.roadWidth * scale;
            const roadX = this.width / 2;
            const segmentY = this.horizonY + (this.cameraHeight / finishZ);
            
            if (segmentY >= this.horizonY && segmentY < this.height) {
                // Draw checkered finish line
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillRect(roadX - roadWidth / 2, segmentY - 15, roadWidth, 30);
                // Checker pattern
                const checkerSize = roadWidth / 8;
                this.ctx.fillStyle = '#000000';
                for (let i = 0; i < 8; i += 2) {
                    this.ctx.fillRect(roadX - roadWidth / 2 + i * checkerSize, segmentY - 15, checkerSize, 15);
                    this.ctx.fillRect(roadX - roadWidth / 2 + (i + 1) * checkerSize, segmentY, checkerSize, 15);
                }
            }
        }
    }
    
    drawCountdown() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.font = 'bold 120px Courier New';
        this.ctx.textAlign = 'center';
        
        if (this.countdown > 0) {
            this.ctx.fillText(this.countdown.toString(), this.width / 2, this.height / 2);
        } else {
            this.ctx.fillText('GO!', this.width / 2, this.height / 2);
        }
        
        this.ctx.textAlign = 'left';
    }
    
    drawRoadsideObjects() {
        const playerSegment = Math.floor(this.playerZ);
        const cameraHeight = this.cameraHeight;
        const cameraDepth = this.cameraDepth;
        
        // Cache glow calculation
        const currentTime = Date.now();
        const baseGlow = Math.sin(currentTime / 800) * 0.3 + 0.7;
        
        // Only draw nearby objects for performance
        let drawn = 0;
        const maxDrawn = 30; // Limit number of objects drawn per frame
        
        for (let obj of this.roadsideObjects) {
            const relativeZ = obj.z - this.playerZ;
            
            if (relativeZ <= 0 || relativeZ > 200) continue; // Reduced view distance
            if (drawn++ >= maxDrawn) break; // Limit objects drawn
            
            const scale = cameraDepth / relativeZ;
            const roadWidth = this.roadWidth * scale;
            
            // Clamp segment index to valid range
            const segmentIndex = Math.max(0, Math.min(Math.floor(obj.z), this.roadSegments.length - 1));
            const segment = this.roadSegments[segmentIndex];
            if (!segment) continue; // Safety check
            
            const baseRoadX = segment.curve * scale * 300 + this.width / 2;
            
            // Position objects off the track
            const x = baseRoadX + obj.x * roadWidth / 2;
            const y = this.horizonY + (cameraHeight / relativeZ);
            
            // Don't draw if above horizon
            if (y < this.horizonY) continue;
            
            const size = Math.max(15, 50 * scale);
            
            // Draw sci-fi objects (simplified glow)
            const glowIntensity = baseGlow;
            
            // Simplified drawing (no shadows for performance)
            if (obj.type === 0) {
                // Energy pylon
                this.ctx.fillStyle = `rgba(0, 255, 255, ${glowIntensity})`;
                this.ctx.fillRect(x - size / 8, y - size, size / 4, size);
                this.ctx.fillRect(x - size / 3, y - size * 0.8, size * 2/3, size / 6);
            } else if (obj.type === 1) {
                // Floating crystal
                this.ctx.fillStyle = `rgba(255, 0, 255, ${glowIntensity})`;
                // Draw diamond shape
                this.ctx.beginPath();
                this.ctx.moveTo(x, y - size);
                this.ctx.lineTo(x - size / 2, y - size / 2);
                this.ctx.lineTo(x, y);
                this.ctx.lineTo(x + size / 2, y - size / 2);
                this.ctx.closePath();
                this.ctx.fill();
            } else {
                // Energy beacon
                this.ctx.fillStyle = `rgba(255, 255, 0, ${glowIntensity})`;
                this.ctx.beginPath();
                this.ctx.arc(x, y - size / 2, size / 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }
    
    drawTraffic() {
        const playerSegment = Math.floor(this.playerZ);
        const cameraHeight = this.cameraHeight;
        const cameraDepth = this.cameraDepth;
        
        for (let car of this.trafficCars) {
            const relativeZ = car.z - this.playerZ;
            
            // Only draw cars ahead of player and within view distance
            if (relativeZ <= 0 || relativeZ > 400) continue;
            
            const scale = cameraDepth / relativeZ;
            const roadWidth = this.roadWidth * scale; // Use the same wide road width
            
            // Clamp segment index to valid range
            const segmentIndex = Math.max(0, Math.min(Math.floor(car.z), this.roadSegments.length - 1));
            const segment = this.roadSegments[segmentIndex];
            if (!segment) continue; // Safety check
            
            const baseRoadX = segment.curve * scale * 300 + this.width / 2;
            
            // Position car on road using wider road
            const x = baseRoadX + car.x * roadWidth / 2;
            const y = this.horizonY + (cameraHeight / relativeZ) - 30 * scale;
            
            // Make sure car is below horizon and visible
            if (y < this.horizonY) continue;
            
            // Wider shapes for levels above 10 to make it harder
            const baseWidth = this.level > 10 ? 40 : 30;
            const baseHeight = this.level > 10 ? 70 : 60;
            const width = Math.max(this.level > 10 ? 25 : 20, baseWidth * scale); // Wider for higher levels
            const height = Math.max(this.level > 10 ? 50 : 40, baseHeight * scale); // Taller for higher levels
            
            // Update hover glow animation
            car.hoverGlow += 0.1;
            const hoverPulse = Math.sin(car.hoverGlow) * 0.3 + 0.7;
            
            // Draw simplified hover glow (no gradients for performance)
            const glowSize = width * 0.8; // Larger glow for visibility
            const glowAlpha = 0.3 * hoverPulse; // Brighter glow
            this.ctx.fillStyle = `rgba(${parseInt(car.color.slice(1, 3), 16)}, ${parseInt(car.color.slice(3, 5), 16)}, ${parseInt(car.color.slice(5, 7), 16)}, ${glowAlpha})`;
            this.ctx.fillRect(x - glowSize / 2, y - glowSize / 4, glowSize, glowSize / 2);
            
            // Draw simpler, more visible ship shapes
            // All ships use a simple, highly visible design
            this.ctx.fillStyle = car.color;
            
            // Main body (always visible rectangle)
            this.ctx.fillRect(x - width / 2, y - height, width, height);
            
            // Bright outline for visibility
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = Math.max(2, 3 * scale);
            this.ctx.strokeRect(x - width / 2, y - height, width, height);
            
            // Center indicator line for better visibility
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillRect(x - 2 * scale, y - height, 4 * scale, height * 0.3);
            this.ctx.fillRect(x - 2 * scale, y - height * 0.3, 4 * scale, height * 0.3);
            
            // Engine glow at back
            this.ctx.fillStyle = `rgba(255, 255, 0, ${hoverPulse * 0.8})`;
            this.ctx.fillRect(x - width / 3, y - height * 0.2, width * 2/3, height * 0.2);
            
            this.ctx.shadowBlur = 0;
        }
    }
    
    drawPlayerCar() {
        // Update hover glow animation
        if (!this.playerCar.hoverGlow) this.playerCar.hoverGlow = 0;
        this.playerCar.hoverGlow += 0.15;
        const hoverPulse = Math.sin(this.playerCar.hoverGlow) * 0.3 + 0.7;
        
        // Position hover ship based on track width at bottom of screen
        const bottomRoadWidth = this.roadWidth * (this.cameraDepth / 20); // Track width near player
        const x = this.width / 2 + this.playerCar.x * (bottomRoadWidth / 2);
        const y = this.height - 120;
        const width = 40;
        const height = 75;
        
        // Draw simplified hover glow (no gradients for performance)
        const glowSize = width * 0.8;
        const glowAlpha = 0.3 * hoverPulse;
        this.ctx.fillStyle = `rgba(0, 255, 255, ${glowAlpha})`;
        this.ctx.fillRect(x - glowSize / 2, y - glowSize / 4, glowSize, glowSize / 2);
        
        // Draw player hover ship (sleek pod racer style)
        this.ctx.fillStyle = this.playerCar.color;
        
        // Main body
        this.ctx.fillRect(x - width / 2, y - height, width, height * 0.7);
        
        // Cockpit (dark)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x - width / 3, y - height + height * 0.15, width * 2/3, height * 0.35);
        
        // Engine pods on sides
        this.ctx.fillStyle = this.playerCar.color;
        this.ctx.fillRect(x - width / 2 - width * 0.35, y - height * 0.6, width * 0.45, height * 0.45);
        this.ctx.fillRect(x + width / 2 - width * 0.1, y - height * 0.6, width * 0.45, height * 0.45);
        
        // Engine glow
        this.ctx.fillStyle = `rgba(255, 255, 0, ${hoverPulse})`;
        this.ctx.fillRect(x - width / 2 - width * 0.3, y - height * 0.55, width * 0.35, height * 0.35);
        this.ctx.fillRect(x + width / 2 - width * 0.05, y - height * 0.55, width * 0.35, height * 0.35);
        
        // Central energy core
        this.ctx.fillStyle = `rgba(0, 255, 255, ${hoverPulse})`;
        this.ctx.fillRect(x - 4, y - height * 0.4, 8, height * 0.3);
        
        // Wing details
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.5})`;
        this.ctx.fillRect(x - width * 0.45, y - height * 0.5, width * 0.3, 3);
        this.ctx.fillRect(x + width * 0.15, y - height * 0.5, width * 0.3, 3);
        
        this.ctx.shadowBlur = 0;
    }
    
    drawUI() {
        // HUD background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 250, 120);
        
        // Game info
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'left';
        
        this.ctx.fillText(`Score: ${Utils.formatScore(this.score)}`, 20, 30);
        this.ctx.fillText(`Time: ${Math.max(0, Math.floor(this.timeLeft))}s`, 20, 50);
        this.ctx.fillText(`Lives: ${this.lives}`, 20, 70);
        this.ctx.fillText(`Level: ${this.level}`, 20, 90);
        this.ctx.fillText(`Checkpoint: ${this.currentCheckpoint}/${this.checkpoints.length}`, 20, 110);
        
        // Speedometer
        const speed = Math.floor(this.playerCar.speed);
        this.ctx.fillStyle = speed > 150 ? '#FF0000' : '#00FF00';
        this.ctx.font = 'bold 20px Courier New';
        this.ctx.fillText(`SPEED: ${speed}`, this.width - 150, 30);
        
        // Draw game state messages
        if (this.gameState === 'paused') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '36px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
            this.ctx.font = '18px Courier New';
            this.ctx.fillText('Press P to resume', this.width / 2, this.height / 2 + 40);
            this.ctx.textAlign = 'left';
        } else if (this.gameState === 'gameOver') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = '36px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 40);
            this.ctx.font = '20px Courier New';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(`Final Score: ${Utils.formatScore(this.score)}`, this.width / 2, this.height / 2);
            this.ctx.fillText(`Level Reached: ${this.level}`, this.width / 2, this.height / 2 + 30);
            this.ctx.fillText('Press SPACE to restart', this.width / 2, this.height / 2 + 70);
            this.ctx.textAlign = 'left';
        }
    }
    
    gameLoop(currentTime = 0) {
        let deltaTime;
        if (this.isPreview) {
            // For preview, currentTime is a timestamp from requestAnimationFrame
            if (this.lastTime === 0) {
                this.lastTime = currentTime;
                deltaTime = 16.67; // First frame, assume 60fps
            } else {
                deltaTime = currentTime - this.lastTime;
                this.lastTime = currentTime;
            }
        } else {
            // For PixiJS, currentTime is already deltaTime in milliseconds from our callback
            deltaTime = currentTime || 16.67; // Use provided delta or default
        }
        
        this.update(deltaTime);
        
        if (this.isPreview) {
            this.draw();
            requestAnimationFrame((time) => this.gameLoop(time));
        } else {
            // PixiJS handles rendering automatically, but we still need to update our draw calls
            this.drawPixi();
            // Ticker handles loop, so don't call requestAnimationFrame
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
            this.roadSprites = [];
            this.trafficCarSprites = [];
            this.playerCarSprite = null;
            this.roadsideObjectSprites = [];
        }
    }
}

// Initialize Micro Racing preview
function initMicroRacing() {
    const canvas = document.getElementById('racing-preview');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Draw a simple racing preview
    function drawPreview() {
        // Sky gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98D8C8');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Simple road perspective
        ctx.fillStyle = '#404040';
        ctx.beginPath();
        ctx.moveTo(width * 0.2, height);
        ctx.lineTo(width * 0.3, height * 0.5);
        ctx.lineTo(width * 0.7, height * 0.5);
        ctx.lineTo(width * 0.8, height);
        ctx.closePath();
        ctx.fill();
        
        // Road lines
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width * 0.5, height * 0.5);
        ctx.lineTo(width * 0.5, height);
        ctx.stroke();
        
        // Player car
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(width / 2 - 8, height - 30, 16, 24);
        
        // Traffic car in distance
        ctx.fillStyle = '#0000FF';
        ctx.fillRect(width / 2 + 15, height * 0.6, 10, 16);
    }
    
    drawPreview();
}
