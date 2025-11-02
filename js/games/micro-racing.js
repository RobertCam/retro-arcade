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
        this.gameState = 'menu'; // menu, countdown, playing, paused, gameOver, crashing
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.timeLeft = 45; // 45 seconds per level (tighter timer)
        this.crashPauseTimer = 0; // Timer for crash pause
        this.crashPauseDuration = 1000; // 1 second pause after crash
        this.checkpointTime = 0; // Time when checkpoint was reached
        this.countdown = 0; // Countdown before race starts (3, 2, 1, GO!)
        this.countdownTimer = 0; // Frame counter for countdown
        
        // Track and camera
        this.baseRoadLength = 5000; // Base track length (much longer)
        this.roadLength = 5000; // Current track length (increases with level)
        this.roadSegments = [];
        this.playerZ = 0; // Player's position on track (0 to roadLength)
        this.cameraHeight = 1200; // Camera height above track
        this.cameraDepth = 0.84; // Field of view
        this.roadWidth = 5000; // Base track width (very wide for easy dodging)
        this.horizonY = this.height * 0.4; // Horizon line position
        
        // Synthwave color palette - consistent across all levels
        // Sky gradient colors: deep purple → electric blue-purple
        this.skyColors = {
            topDark: { r: 26, g: 0, b: 51 },        // #1a0033
            mid: { r: 51, g: 0, b: 102 },           // #330066
            horizon: { r: 77, g: 0, b: 255 },        // #4d00ff
            ground: { r: 26, g: 0, b: 51 }          // #1a0033 (dark)
        };
        
        // Track colors
        this.trackColors = {
            base: { r: 26, g: 0, b: 51 },          // #1a0033 - dark blue-purple
            grid: { r: 51, g: 0, b: 102 },         // #330066 - lighter grid lines
            speedLine: { r: 255, g: 69, b: 0 },    // #ff4500 - orange-red speed lines
            speedLineAlt: { r: 255, g: 102, b: 0 } // #ff6600 - brighter orange
        };
        
        // Car colors
        this.carColors = {
            body: { r: 255, g: 69, b: 0 },         // #ff4500 - orange-red
            accent: { r: 204, g: 51, b: 0 },       // #cc3300 - darker red
            exhaust: { r: 0, g: 191, b: 255 },     // #00bfff - bright cyan
            exhaustAlt: { r: 102, g: 217, b: 255 } // #66d9ff - lighter cyan
        };
        
        // City colors
        this.cityColors = {
            building: { r: 26, g: 0, b: 51 },      // #1a0033 - dark blue-purple
            buildingAlt: { r: 51, g: 0, b: 102 },  // #330066 - slightly lighter
            windowPink: { r: 255, g: 0, b: 255 },  // #ff00ff - bright pink
            windowPinkAlt: { r: 255, g: 102, b: 255 }, // #ff66ff - lighter pink
            windowCyan: { r: 0, g: 204, b: 255 },  // #00ccff - bright cyan
            windowCyanAlt: { r: 102, g: 217, b: 255 } // #66d9ff - lighter cyan
        };
        
        // UI colors
        this.uiColors = {
            gold: { r: 255, g: 215, b: 0 },        // #ffd700 - golden
            goldShadow: { r: 204, g: 153, b: 0 },   // #cc9900 - darker gold
            purple: { r: 139, g: 0, b: 255 },      // #8b00ff - purple
            orange: { r: 255, g: 102, b: 0 }       // #ff6600 - orange
        };
        
        // Sunset/sun colors
        this.sunColors = {
            circle: { r: 255, g: 0, b: 255 },       // #ff00ff - magenta-pink
            lines: { r: 255, g: 102, b: 0 }         // #ff6600 - orange-pink
        };
        
        // Checkered barrier colors
        this.barrierColors = {
            orange: { r: 255, g: 102, b: 0 },      // #ff6600 - orange
            dark: { r: 26, g: 0, b: 51 }            // #1a0033 - dark blue-purple
        };
        
        // Cityscape cache to avoid recreating every frame
        this.cityscapeCache = null;
        this.cityscapeSeed = Math.floor(Math.random() * 10000); // Deterministic seed
        
        // Starfield cache - stars don't move, can be cached
        this.starfieldCache = null;
        
        // Player hover ship (always at bottom of screen)
        this.playerCar = {
            x: 0, // Position on track (-1 to 1, where 0 is center)
            speed: 0,
            maxSpeed: 6, // Slower max speed for better control
            acceleration: 0.05, // Slower acceleration
            friction: 0.96, // More friction (slower coasting)
            curve: 0, // Current curve input
            color: '#FF4500', // Orange-red for synthwave
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
        this.roadLength = this.baseRoadLength + (this.level - 1) * 1000; // Much longer levels as you progress
        
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
                
                // Much sharper corners - up to 4.0 curve (very sharp and pronounced)
                currentCurve = easedProgress * 4.0 * cornerDirection;
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
        // Longer levels need more checkpoints spread out further
        const checkpointDistance = 500; // Increased distance between checkpoints
        
        // Generate checkpoints based on road length (every 500 units)
        const numCheckpoints = Math.floor(this.roadLength / checkpointDistance);
        for (let i = 1; i <= numCheckpoints; i++) {
            this.checkpoints.push({
                z: i * checkpointDistance,
                passed: false
            });
        }
    }
    
    generateTraffic() {
        this.trafficCars = [];
        
        // Traffic increases with level progression - much more traffic
        // Level 1: 8 cars, Level 5: 15 cars, Level 10: 25 cars, Level 15+: more aggressive
        let maxTrafficCars;
        if (this.level > 10) {
            // More aggressive traffic scaling for levels above 10
            maxTrafficCars = Math.min(25 + Math.floor((this.level - 10) * 3), 50); // Up to 50 cars for high levels
        } else {
            maxTrafficCars = Math.min(8 + Math.floor(this.level * 1.5), 25); // Normal progression up to level 10
        }
        
        // Assign to lanes: -0.66, 0, 0.66 for 3 lanes, or -0.5, 0.5 for 2 lanes
        const numLanes = this.level >= 10 ? 2 : 3;
        const lanePositions = numLanes === 3 ? [-0.66, 0, 0.66] : [-0.5, 0.5];
        
        // Space traffic out evenly across the track
        // With longer levels and more traffic, we can space them more evenly
        const minSpacing = Math.max(150, 300 - (this.level - 1) * 10); // More spacing for visibility
        const usedPositions = [];
        
        for (let i = 0; i < maxTrafficCars; i++) {
            let z, attempts = 0;
            // Ensure we have enough road length - spread across longer track
            // Start traffic closer to player so they're visible at game start
            const maxZ = Math.max(200, this.roadLength - 200); // Leave buffer
            const minZ = Math.min(100, maxZ - 500); // Start closer for visibility (was 800)
            
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
            
            // Synthwave car colors - full palette matching player car style but different colors
            const carColors = [
                '#FF4500', // Orange-red (like player)
                '#00BFFF', // Bright cyan
                '#FF00FF', // Magenta-pink
                '#8B00FF', // Purple
                '#00FF88', // Cyan-green
                '#FF6600', // Orange
                '#00CCFF', // Light cyan
                '#FF0088', // Pink
                '#4400FF', // Blue-purple
                '#FF8800', // Gold-orange
                '#00FFCC', // Aqua
                '#FF3388'  // Hot pink
            ];
            
            // Traffic moves in same direction as player but slower (negative speed means moving forward slower)
            // Player speed is positive, traffic speed is negative (relative to player, they're going slower)
            const trafficSpeed = -(2 + Math.random() * 2); // Traffic moves 2-4 units slower than player
            
            this.trafficCars.push({
                z: z,
                x: assignedLane + (Math.random() - 0.5) * 0.08, // Less variation for better lane keeping
                speed: trafficSpeed, // Negative = same direction but slower (player passes them)
                sprite: Math.floor(Math.random() * 3), // Different car designs
                color: carColors[Math.floor(Math.random() * carColors.length)],
                lane: assignedLane, // Store lane for lane-keeping behavior
                hoverGlow: Math.random() * Math.PI * 2, // Random hover animation phase
                type: Math.floor(Math.random() * 3), // Different car types
                shapeVariation: Math.random() // For varied car shapes
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
        
        // Handle crash pause - pause game for 1 second after collision
        if (this.gameState === 'crashing') {
            this.crashPauseTimer += deltaTime;
            if (this.crashPauseTimer >= this.crashPauseDuration) {
                this.crashPauseTimer = 0;
                this.gameState = 'playing';
            }
            return; // Don't update game during crash pause
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
            // Move traffic cars - they move in same direction but slower
            const relativeZ = car.z - this.playerZ;
            
            // Traffic moves forward but slower than player (player passes them)
            // car.speed is negative (e.g., -3), so traffic moves at playerSpeed + carSpeed (e.g., 5 + (-3) = 2)
            // This means traffic moves slower than player, so player catches up and passes them
            // Traffic moves forward at player speed + traffic speed (which is negative)
            // So if player speed is 5 and traffic speed is -3, traffic moves at 5-3=2 units/sec
            car.z += (this.playerCar.speed + car.speed) * dt * 0.3; // Traffic moves slower than player
            
            // Keep car in its lane (slight lane-keeping)
            if (car.lane !== undefined) {
                const laneCenter = car.lane;
                car.x += (laneCenter - car.x) * 0.02; // Gently drift toward lane center
            }
            
            // Wrap around if too far behind player
            if (car.z < this.playerZ - 200) {
                // Respawn ahead of player
                car.z = this.playerZ + 100 + Math.random() * 300;
                // Respawn in a random lane
                car.lane = lanePositions[Math.floor(Math.random() * lanePositions.length)];
                car.x = car.lane + (Math.random() - 0.5) * 0.1;
                // Reset collision state when car respawns
                car.colliding = false;
                car.collisionCooldown = 0;
            }
            
            // Also wrap if too far ahead
            if (car.z > this.playerZ + this.roadLength) {
                car.z = this.playerZ - 100 - Math.random() * 100;
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
        // Don't check collisions during crash pause
        if (this.gameState === 'crashing') return;
        
        // Only check collisions if player is moving (has some speed)
        if (this.playerCar.speed < 2) return; // Lower threshold for slower gameplay
        
        const playerSegment = Math.max(0, Math.min(Math.floor(this.playerZ), this.roadSegments.length - 1));
        const playerSegmentData = this.roadSegments[playerSegment];
        if (!playerSegmentData) return;
        
        // Collision detection aligned with car polygon shapes
        // Cars are wider at back, narrower at front - use trapezoid-like collision
        const collisionRadiusZ = 25; // Z-axis collision tolerance (front-to-back)
        
        for (let car of this.trafficCars) {
            const relativeZ = car.z - this.playerZ;
            
            // Check collisions with cars ahead of player (relativeZ > 0 means ahead)
            if (relativeZ > 0 && relativeZ < collisionRadiusZ) {
                const distanceX = Math.abs(car.x - this.playerCar.x);
                
                // Car collision boxes: wider at back, narrower at front (matches visual shape)
                // Made wider for collision detection (easier to detect, less frustrating)
                const playerWidthRear = 0.28; // Player car rear width (wider for easier collision)
                const playerWidthFront = 0.20; // Player car front width (wider)
                const trafficWidthRear = this.level > 10 ? 0.26 : 0.24; // Traffic rear width (wider)
                const trafficWidthFront = this.level > 10 ? 0.18 : 0.16; // Traffic front width (wider)
                
                // Interpolate width based on relative Z position (closer = wider rear, further = narrower front)
                const zFactor = relativeZ / collisionRadiusZ; // 0 = at player, 1 = at collisionRadiusZ
                const playerWidthAtZ = playerWidthFront + (playerWidthRear - playerWidthFront) * (1 - zFactor);
                const trafficWidthAtZ = trafficWidthFront + (trafficWidthRear - trafficWidthFront) * zFactor;
                
                // Average width for collision check
                const avgWidth = (playerWidthAtZ + trafficWidthAtZ) / 2;
                
                // Check collision with trapezoid approximation
                if (distanceX < avgWidth && relativeZ < collisionRadiusZ) {
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
        // Pause game for crash feedback
        this.gameState = 'crashing';
        this.crashPauseTimer = 0;
        
        // Slow down and add effects with better feedback
        this.playerCar.speed *= 0.2; // More dramatic slowdown
        
        // Enhanced screen shake
        if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
            this.screenEffects.shake(25); // Stronger shake for crash
        }
        
        // Multiple explosion effects for better visibility
        if (this.particles && typeof this.particles.explode === 'function') {
            // Main explosion at collision point
            const playerX = this.width / 2 + this.playerCar.x * (this.roadWidth * 0.15);
            this.particles.explode(playerX, this.height - 120, 25, '#FF0000');
            // Additional particles for visibility
            this.particles.explode(playerX - 40, this.height - 120, 18, '#FF6600');
            this.particles.explode(playerX + 40, this.height - 120, 18, '#FF6600');
            this.particles.explode(playerX, this.height - 140, 15, '#FFAA00');
        }
        
        // Flash effect using screen effects if available
        if (this.nesEffects && typeof this.nesEffects.flash === 'function') {
            this.nesEffects.flash('#FF0000', 300); // Longer red flash for crash
        }
        
        this.lives--;
        this.score = Math.max(0, this.score - 100);
        
        if (this.lives <= 0) {
            // Wait for crash pause to finish before game over
            setTimeout(() => {
                this.gameOver();
            }, this.crashPauseDuration);
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
        
        // Properly destroy children to prevent memory leaks
        while (bgLayer.children.length > 0) {
            const child = bgLayer.removeChildAt(0);
            if (child && child.destroy) child.destroy(true);
        }
        while (fgLayer.children.length > 0) {
            const child = fgLayer.removeChildAt(0);
            if (child && child.destroy) child.destroy(true);
        }
        while (uiLayer.children.length > 0) {
            const child = uiLayer.removeChildAt(0);
            if (child && child.destroy) child.destroy(true);
        }
        
        // Draw background gradient
        this.drawBackgroundPixi(bgLayer);
        
        // Draw stars
        this.drawStarsPixi(bgLayer);
        
        // Draw cityscape (only during gameplay)
        if (this.gameState === 'playing' || this.gameState === 'countdown') {
            this.drawCityscapePixi(bgLayer);
        }
        
        if (this.gameState === 'menu') {
            this.drawMenuPixi(uiLayer);
            this.drawUIPixi(uiLayer);
            return;
        }
        
        if (this.gameState === 'playing' || this.gameState === 'countdown' || this.gameState === 'crashing') {
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
        // Synthwave sky gradient: deep purple → electric blue-purple
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, `rgb(${this.skyColors.topDark.r}, ${this.skyColors.topDark.g}, ${this.skyColors.topDark.b})`);
        gradient.addColorStop(0.3, `rgb(${this.skyColors.mid.r}, ${this.skyColors.mid.g}, ${this.skyColors.mid.b})`);
        gradient.addColorStop(0.6, `rgb(${this.skyColors.horizon.r}, ${this.skyColors.horizon.g}, ${this.skyColors.horizon.b})`);
        gradient.addColorStop(1, `rgb(${this.skyColors.ground.r}, ${this.skyColors.ground.g}, ${this.skyColors.ground.b})`);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw sunset
        this.drawSunset();
        
        // Enhanced starfield
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
            // Draw cityscape
            this.drawCityscape();
            
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
        // Synthwave sky gradient: deep purple → electric blue-purple
        // Combine all segments into ONE graphics object
        const bgGradient = new PIXI.Graphics();
        const segments = 30; // Reduced from 60 for performance
        
        for (let i = 0; i < segments; i++) {
            const y1 = (i / segments) * this.height;
            const y2 = ((i + 1) / segments) * this.height;
            const progress = i / segments;
            
            // Multi-stop gradient: top dark → mid → horizon bright → ground dark
            let colorR, colorG, colorB;
            if (progress < 0.3) {
                // Top section: deep purple to mid purple
                const t = progress / 0.3;
                colorR = Math.floor(this.skyColors.topDark.r * (1 - t) + this.skyColors.mid.r * t);
                colorG = Math.floor(this.skyColors.topDark.g * (1 - t) + this.skyColors.mid.g * t);
                colorB = Math.floor(this.skyColors.topDark.b * (1 - t) + this.skyColors.mid.b * t);
            } else if (progress < 0.6) {
                // Mid section: mid purple to electric blue-purple
                const t = (progress - 0.3) / 0.3;
                colorR = Math.floor(this.skyColors.mid.r * (1 - t) + this.skyColors.horizon.r * t);
                colorG = Math.floor(this.skyColors.mid.g * (1 - t) + this.skyColors.horizon.g * t);
                colorB = Math.floor(this.skyColors.mid.b * (1 - t) + this.skyColors.horizon.b * t);
            } else {
                // Bottom section: horizon bright back to dark ground
                const t = (progress - 0.6) / 0.4;
                colorR = Math.floor(this.skyColors.horizon.r * (1 - t) + this.skyColors.ground.r * t);
                colorG = Math.floor(this.skyColors.horizon.g * (1 - t) + this.skyColors.ground.g * t);
                colorB = Math.floor(this.skyColors.horizon.b * (1 - t) + this.skyColors.ground.b * t);
            }
            
            const color = (colorR << 16) | (colorG << 8) | colorB;
            bgGradient.beginFill(color, 1);
            bgGradient.drawRect(0, y1, this.width, y2 - y1);
            bgGradient.endFill();
        }
        
        layer.addChild(bgGradient);
        
        // Draw retro sunset/sun in upper-left
        this.drawSunsetPixi(layer);
    }
    
    drawSunsetPixi(layer) {
        const sunX = this.width * 0.15; // Upper-left area
        const sunY = this.height * 0.15;
        const sunRadius = this.width * 0.12; // Large sun
        
        // Sun glow halo (subtle effect on sky)
        const halo = new PIXI.Graphics();
        halo.beginFill((this.sunColors.circle.r << 16) | (this.sunColors.circle.g << 8) | this.sunColors.circle.b, 0.15);
        halo.drawCircle(sunX, sunY, sunRadius * 1.5);
        halo.endFill();
        layer.addChild(halo);
        
        // Main sun circle (magenta-pink)
        const sun = new PIXI.Graphics();
        sun.beginFill((this.sunColors.circle.r << 16) | (this.sunColors.circle.g << 8) | this.sunColors.circle.b, 0.9);
        sun.drawCircle(sunX, sunY, sunRadius);
        sun.endFill();
        layer.addChild(sun);
        
        // Horizontal orange-pink lines across sun
        const lineCount = 5;
        const lineSpacing = (sunRadius * 2) / (lineCount + 1);
        const lineY = sunY - sunRadius + lineSpacing;
        
        for (let i = 0; i < lineCount; i++) {
            const line = new PIXI.Graphics();
            const y = sunY - sunRadius + (i + 1) * lineSpacing;
            const lineWidth = Math.sqrt(sunRadius * sunRadius - Math.pow(y - sunY, 2)) * 2;
            
            if (lineWidth > 0) {
                line.lineStyle(3, (this.sunColors.lines.r << 16) | (this.sunColors.lines.g << 8) | this.sunColors.lines.b, 0.8);
                line.moveTo(sunX - lineWidth / 2, y);
                line.lineTo(sunX + lineWidth / 2, y);
                layer.addChild(line);
            }
        }
    }
    
    drawStarsPixi(layer) {
        // Enhanced starfield: combine all stars into single graphics object for performance
        // Use cached positions but update alpha for twinkling
        const currentTime = Date.now();
        const starsGraphics = new PIXI.Graphics();
        
        // Reduce star count for performance - 120 instead of 180
        for (let i = 0; i < 120; i++) {
            // Golden angle distribution for even spacing
            const angle = i * 2.399963229728653; // Golden angle in radians
            const radius = Math.sqrt(i / 120) * Math.min(this.width, this.horizonY);
            const x = (this.width / 2) + radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            
            // Only draw stars above horizon
            if (y > this.horizonY) continue;
            
            // Varied sizes: 1-3 pixels
            const baseSize = (i % 3) + 1;
            
            // Position-based visibility: stars higher up are more visible
            const heightFactor = 1 - (y / this.horizonY);
            const baseAlpha = 0.6 + heightFactor * 0.4; // 0.6 to 1.0
            
            // Subtle twinkling animation (but only update every few frames for performance)
            const twinklePhase = (currentTime / 2000 + i * 0.1) % (Math.PI * 2);
            const twinkle = Math.sin(twinklePhase) * 0.2 + 0.8; // 0.6 to 1.0
            const alpha = baseAlpha * twinkle;
            
            starsGraphics.beginFill(0xffffff, alpha);
            starsGraphics.drawRect(x - baseSize / 2, y - baseSize / 2, baseSize, baseSize);
            starsGraphics.endFill();
        }
        
        layer.addChild(starsGraphics);
    }
    
    // Simple deterministic random function using seed
    seededRandom(seed) {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    }
    
    drawCityscapePixi(layer) {
        // Multi-layered cityscape with parallax effect
        // Use deterministic positions to avoid recreating objects every frame
        const currentTime = Date.now();
        const parallaxOffset = (this.playerZ * 0.1) % 100; // Slow parallax movement
        
        // Three layers: far, mid, near (reduced counts for performance)
        const layers = [
            { z: 0.3, scale: 0.6, alpha: 0.4, buildingCount: 6 },  // Far - faded, smaller
            { z: 0.6, scale: 0.8, alpha: 0.7, buildingCount: 8 }, // Mid - partially faded
            { z: 1.0, scale: 1.0, alpha: 1.0, buildingCount: 10 }  // Near - full opacity
        ];
        
        layers.forEach((layerData, layerIndex) => {
            const cityContainer = new PIXI.Container();
            const buildingSpacing = this.width / (layerData.buildingCount + 2);
            
            for (let i = 0; i < layerData.buildingCount; i++) {
                const baseX = (i + 1) * buildingSpacing + parallaxOffset * layerData.z;
                const wrappedX = ((baseX % (this.width + buildingSpacing)) + buildingSpacing) % (this.width + buildingSpacing);
                
                // Deterministic building height using seed
                const seed = this.cityscapeSeed + layerIndex * 1000 + i * 100;
                const centerDistance = Math.abs(i - layerData.buildingCount / 2) / (layerData.buildingCount / 2);
                const heightVariation = 1 - centerDistance * 0.5;
                const heightRandom = 0.5 + this.seededRandom(seed) * 0.5;
                const buildingHeight = (this.height - this.horizonY) * layerData.scale * heightVariation * heightRandom;
                
                // Draw building silhouette
                const building = new PIXI.Graphics();
                const buildingColor = i % 2 === 0 ? 
                    (this.cityColors.building.r << 16) | (this.cityColors.building.g << 8) | this.cityColors.building.b :
                    (this.cityColors.buildingAlt.r << 16) | (this.cityColors.buildingAlt.g << 8) | this.cityColors.buildingAlt.b;
                
                building.beginFill(buildingColor, layerData.alpha);
                const buildingWidth = buildingSpacing * 0.6 * layerData.scale;
                building.drawRect(wrappedX - buildingWidth / 2, this.horizonY - buildingHeight, buildingWidth, buildingHeight);
                building.endFill();
                cityContainer.addChild(building);
                
                // Add glowing windows (combine into single graphics object per building for performance)
                // Reduced window count for performance
                const windowCount = Math.max(1, Math.min(8, Math.floor(buildingHeight / 50)));
                const windowPulse = Math.sin(currentTime / 1000 + i + layerIndex * 10) * 0.3 + 0.7;
                
                // Combine all windows for a building into one graphics object
                const buildingWindows = new PIXI.Graphics();
                
                for (let w = 0; w < windowCount; w++) {
                    const windowSeed = seed + w * 17;
                    const windowY = this.horizonY - buildingHeight + (w + 1) * (buildingHeight / (windowCount + 1));
                    const windowXOffset = (this.seededRandom(windowSeed) - 0.5) * buildingWidth * 0.6;
                    const windowX = wrappedX + windowXOffset;
                    
                    // Deterministic window color
                    const isPink = this.seededRandom(windowSeed + 100) < 0.5;
                    const windowColor = isPink ?
                        (this.cityColors.windowPink.r << 16) | (this.cityColors.windowPink.g << 8) | this.cityColors.windowPink.b :
                        (this.cityColors.windowCyan.r << 16) | (this.cityColors.windowCyan.g << 8) | this.cityColors.windowCyan.b;
                    
                    // Window glow (bright center) - combined into single graphics
                    buildingWindows.beginFill(windowColor, windowPulse * 0.4 * layerData.alpha);
                    buildingWindows.drawCircle(windowX, windowY, 6);
                    buildingWindows.endFill();
                    
                    // Window center (bright)
                    buildingWindows.beginFill(windowColor, windowPulse * 0.9 * layerData.alpha);
                    buildingWindows.drawRect(windowX - 2, windowY - 2, 4, 4);
                    buildingWindows.endFill();
                }
                
                cityContainer.addChild(buildingWindows);
            }
            
            layer.addChild(cityContainer);
        });
        
        // Ground reflection (faint city light reflection)
        const reflection = new PIXI.Graphics();
        reflection.beginFill(0x330066, 0.15);
        reflection.drawRect(0, this.horizonY, this.width, (this.height - this.horizonY) * 0.2);
        reflection.endFill();
        layer.addChild(reflection);
    }
    
    drawHorizonPixi(layer) {
        // Simple horizon line (cityscape provides the visual horizon)
        const horizon = new PIXI.Graphics();
        const horizonColor = (this.skyColors.horizon.r << 16) | (this.skyColors.horizon.g << 8) | this.skyColors.horizon.b;
        horizon.lineStyle(2, horizonColor, 0.5);
        horizon.moveTo(0, this.horizonY);
        horizon.lineTo(this.width, this.horizonY);
        layer.addChild(horizon);
    }
    
    drawRoadPixi(layer) {
        const playerSegment = Math.floor(this.playerZ);
        const cameraHeight = this.cameraHeight;
        const cameraDepth = this.cameraDepth;
        const numLanes = this.level >= 10 ? 2 : 3;
        
        const currentTime = Date.now();
        const baseGlow = Math.sin(currentTime / 500) * 0.3 + 0.7;
        
        // Reduce segment count from 100 to 60 for performance
        for (let i = 1; i < 60; i++) {
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
                
                // Draw road segment (trapezoid) with synthwave colors
                const roadColor = (this.trackColors.base.r << 16) | (this.trackColors.base.g << 8) | this.trackColors.base.b;
                
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
                
                // Draw grid texture on track (only draw every few segments to reduce objects)
                if (i % 3 === 0) { // Only draw grid on every 3rd segment
                    const gridSpacing = 100 * scale; // Grid cells scale with perspective
                    if (gridSpacing > 8 && gridSpacing < roadWidth && gridSpacing < 200) {
                        const gridLines = new PIXI.Graphics();
                        const gridColor = (this.trackColors.grid.r << 16) | (this.trackColors.grid.g << 8) | this.trackColors.grid.b;
                        gridLines.lineStyle(1, gridColor, 0.4);
                        
                        // Simplified grid - just key lines
                        const gridLineCount = Math.min(5, Math.floor(roadWidth / gridSpacing));
                        for (let g = 0; g <= gridLineCount; g += Math.max(1, Math.floor(gridLineCount / 3))) {
                            const gridX = prevRoadX - prevRoadWidth / 2 + (g * prevRoadWidth / gridLineCount);
                            const nextGridX = roadX - roadWidth / 2 + (g * roadWidth / gridLineCount);
                            gridLines.moveTo(gridX, prevSegmentY);
                            gridLines.lineTo(nextGridX, segmentY);
                        }
                        
                        // Just one vertical line
                        const midY = (prevSegmentY + segmentY) / 2;
                        const midW = (prevRoadWidth + roadWidth) / 2;
                        gridLines.moveTo(prevRoadX - midW / 2, midY);
                        gridLines.lineTo(prevRoadX + midW / 2, midY);
                        
                        layer.addChild(gridLines);
                    }
                }
                
                // Draw speed lines (orange-red strips down lane centers) - combine into single graphics
                const speedLineGlow = Math.sin(currentTime / 300 + i * 0.1) * 0.3 + 0.7;
                const speedLineWidth = Math.max(8, 15 * scale);
                const speedLineColor = (this.trackColors.speedLine.r << 16) | (this.trackColors.speedLine.g << 8) | this.trackColors.speedLine.b;
                
                // Combine all speed lines into one graphics object
                const speedLines = new PIXI.Graphics();
                
                if (numLanes === 3) {
                    // Three lanes: speed lines in each lane center
                    const lanePositions = [-prevRoadWidth / 3, 0, prevRoadWidth / 3];
                    const nextLanePositions = [-(prevRoadWidth - roadWidth) / 3, 0, (prevRoadWidth - roadWidth) / 3];
                    
                    lanePositions.forEach((pos, idx) => {
                        // Glow effect
                        speedLines.beginFill(speedLineColor, speedLineGlow * 0.3);
                        speedLines.drawPolygon([
                            prevRoadX + pos - speedLineWidth / 1.5, prevSegmentY,
                            prevRoadX + pos + speedLineWidth / 1.5, prevSegmentY,
                            roadX + nextLanePositions[idx] + speedLineWidth / 1.5, segmentY,
                            roadX + nextLanePositions[idx] - speedLineWidth / 1.5, segmentY
                        ]);
                        speedLines.endFill();
                        
                        // Main speed line
                        speedLines.beginFill(speedLineColor, speedLineGlow);
                        speedLines.drawPolygon([
                            prevRoadX + pos - speedLineWidth / 2, prevSegmentY,
                            prevRoadX + pos + speedLineWidth / 2, prevSegmentY,
                            roadX + nextLanePositions[idx] + speedLineWidth / 2, segmentY,
                            roadX + nextLanePositions[idx] - speedLineWidth / 2, segmentY
                        ]);
                        speedLines.endFill();
                    });
                } else {
                    // Two lanes: speed line in each lane center
                    const lanePositions = [-prevRoadWidth / 4, prevRoadWidth / 4];
                    const nextLanePositions = [-(prevRoadWidth - roadWidth) / 4, (prevRoadWidth - roadWidth) / 4];
                    
                    lanePositions.forEach((pos, idx) => {
                        // Glow
                        speedLines.beginFill(speedLineColor, speedLineGlow * 0.3);
                        speedLines.drawPolygon([
                            prevRoadX + pos - speedLineWidth / 1.5, prevSegmentY,
                            prevRoadX + pos + speedLineWidth / 1.5, prevSegmentY,
                            roadX + nextLanePositions[idx] + speedLineWidth / 1.5, segmentY,
                            roadX + nextLanePositions[idx] - speedLineWidth / 1.5, segmentY
                        ]);
                        speedLines.endFill();
                        
                        // Main speed line
                        speedLines.beginFill(speedLineColor, speedLineGlow);
                        speedLines.drawPolygon([
                            prevRoadX + pos - speedLineWidth / 2, prevSegmentY,
                            prevRoadX + pos + speedLineWidth / 2, prevSegmentY,
                            roadX + nextLanePositions[idx] + speedLineWidth / 2, segmentY,
                            roadX + nextLanePositions[idx] - speedLineWidth / 2, segmentY
                        ]);
                        speedLines.endFill();
                    });
                }
                
                layer.addChild(speedLines);
                
                // Draw checkered barriers on track edges (combine into single graphics per side)
                if (i % 2 === 0) { // Only draw every other segment
                    const barrierBlockSize = Math.max(30, 50 * scale);
                    const leftBarrierStart = prevRoadX - prevRoadWidth / 2;
                    const rightBarrierStart = prevRoadX + prevRoadWidth / 2;
                    const barrierHeight = Math.max(10, 20 * scale);
                    
                    // Combine left barrier blocks into one graphics object
                    const leftBarrier = new PIXI.Graphics();
                    const leftBarrierBlocks = Math.min(6, Math.floor(prevRoadWidth / barrierBlockSize));
                    for (let b = 0; b < leftBarrierBlocks; b++) {
                        const barrierX = leftBarrierStart + b * barrierBlockSize;
                        const nextBarrierX = roadX - roadWidth / 2 + b * (roadWidth / leftBarrierBlocks);
                        const isOrange = (Math.floor(b + i) % 2 === 0);
                        const barrierColor = isOrange ? 
                            (this.barrierColors.orange.r << 16) | (this.barrierColors.orange.g << 8) | this.barrierColors.orange.b :
                            (this.barrierColors.dark.r << 16) | (this.barrierColors.dark.g << 8) | this.barrierColors.dark.b;
                        
                        leftBarrier.beginFill(barrierColor, 1);
                        leftBarrier.drawPolygon([
                            barrierX, prevSegmentY - barrierHeight,
                            barrierX + barrierBlockSize, prevSegmentY - barrierHeight,
                            nextBarrierX + (roadWidth / leftBarrierBlocks), segmentY - barrierHeight * scale,
                            nextBarrierX, segmentY - barrierHeight * scale
                        ]);
                        leftBarrier.endFill();
                    }
                    layer.addChild(leftBarrier);
                    
                    // Combine right barrier blocks into one graphics object
                    const rightBarrier = new PIXI.Graphics();
                    const rightBarrierBlocks = Math.min(6, Math.floor(prevRoadWidth / barrierBlockSize));
                    for (let b = 0; b < rightBarrierBlocks; b++) {
                        const barrierX = rightBarrierStart - b * barrierBlockSize;
                        const nextBarrierX = roadX + roadWidth / 2 - b * (roadWidth / rightBarrierBlocks);
                        const isOrange = (Math.floor(b + i) % 2 === 0);
                        const barrierColor = isOrange ? 
                            (this.barrierColors.orange.r << 16) | (this.barrierColors.orange.g << 8) | this.barrierColors.orange.b :
                            (this.barrierColors.dark.r << 16) | (this.barrierColors.dark.g << 8) | this.barrierColors.dark.b;
                        
                        rightBarrier.beginFill(barrierColor, 1);
                        rightBarrier.drawPolygon([
                            barrierX, prevSegmentY - barrierHeight,
                            barrierX - barrierBlockSize, prevSegmentY - barrierHeight,
                            nextBarrierX - (roadWidth / rightBarrierBlocks), segmentY - barrierHeight * scale,
                            nextBarrierX, segmentY - barrierHeight * scale
                        ]);
                        rightBarrier.endFill();
                    }
                    layer.addChild(rightBarrier);
                }
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
            
            // Draw traffic ahead of player only (player is catching up to them)
            // Increased view distance to match longer levels
            if (relativeZ <= 0 || relativeZ > 1000) continue;
            
            // Use same scale calculation as road segments
            const scale = cameraDepth / relativeZ; // Cars get BIGGER as they get closer (smaller relativeZ = larger scale)
            const roadWidth = this.roadWidth * scale;
            
            const segmentIndex = Math.max(0, Math.min(Math.floor(car.z), this.roadSegments.length - 1));
            const segment = this.roadSegments[segmentIndex];
            if (!segment) continue;
            
            const baseRoadX = segment.curve * scale * 300 + this.width / 2;
            const x = baseRoadX + car.x * roadWidth / 2;
            
            // Calculate y position same way as road segments
            const y = this.horizonY + (cameraHeight / relativeZ);
            
            // Only draw if car is visible (below horizon and within screen)
            if (y < this.horizonY || y > this.height) continue;
            
            // Atmospheric perspective: fade and desaturate based on distance
            const distanceFactor = Math.min(1, relativeZ / 1000); // 0 = near, 1 = far (adjusted for longer view)
            const fadeAlpha = 1 - distanceFactor * 0.4; // Fade to 60% opacity at max distance
            const detailFactor = 1 - distanceFactor * 0.5; // Less detail for far objects
            
            // Make cars more substantial - use same scale as road segments
            // Base sizes: cars should be about 10-15% of road width when drawn
            // At 200 units: road width = 21px, so car width should be ~3-4px
            // With scale = 0.0042, baseWidth needs to be ~750-1000
            const baseWidth = this.level > 10 ? 900 : 750; // Properly sized for perspective scaling
            const baseHeight = this.level > 10 ? 1500 : 1250;
            const width = baseWidth * scale;
            const height = baseHeight * scale;
            
            car.hoverGlow = (car.hoverGlow || 0) + 0.1;
            const hoverPulse = Math.sin(car.hoverGlow) * 0.3 + 0.7;
            
            const carContainer = new PIXI.Container();
            
            // Calculate colors with atmospheric desaturation (distance-based)
            const r = parseInt(car.color.slice(1, 3), 16);
            const g = parseInt(car.color.slice(3, 5), 16);
            const b = parseInt(car.color.slice(5, 7), 16);
            
            // Desaturate colors for distance (blend toward gray)
            const desatAmount = distanceFactor * 0.3; // Up to 30% desaturation
            const gray = (r + g + b) / 3;
            const desatR = Math.floor(r * (1 - desatAmount) + gray * desatAmount);
            const desatG = Math.floor(g * (1 - desatAmount) + gray * desatAmount);
            const desatB = Math.floor(b * (1 - desatAmount) + gray * desatAmount);
            
            const colorHex = (desatR << 16) | (desatG << 8) | desatB;
            const accentR = Math.floor(desatR * 0.8);
            const accentG = Math.floor(desatG * 0.8);
            const accentB = Math.floor(desatB * 0.8);
            const accentColor = (accentR << 16) | (accentG << 8) | accentB;
            
            // Optional small exhaust (only on closer cars for performance, deterministic)
            const exhaustChance = ((car.z * 7) % 10) / 10; // Deterministic based on position
            if (relativeZ < 150 && exhaustChance < 0.3) {
                const exhaustLength = 8 * scale;
                const exhaust = new PIXI.Graphics();
                const exhaustColor = (this.carColors.exhaust.r << 16) | (this.carColors.exhaust.g << 8) | this.carColors.exhaust.b;
                exhaust.beginFill(exhaustColor, hoverPulse * 0.6);
                exhaust.drawPolygon([
                    x - width * 0.15, y,
                    x + width * 0.15, y,
                    x + width * 0.2, y + exhaustLength,
                    x - width * 0.2, y + exhaustLength
                ]);
                exhaust.endFill();
                carContainer.addChild(exhaust);
            }
            
            const carGraphics = new PIXI.Graphics();
            
            // Use exact same shape as player car (same proportions) - just different colors
            // Player car proportions: width/2, width*0.55, width*0.4, width*0.15 for the shape
            // Player car height proportions: height*0.3, height*0.5, height, height*1.05
            const carShape = [
                x - width / 2, y - height * 0.3,           // Bottom left (same as player)
                x - width * 0.55, y - height * 0.5,        // Left side mid (same as player)
                x - width * 0.4, y - height,               // Top left (same as player)
                x - width * 0.15, y - height * 1.05,       // Front left (same as player)
                x + width * 0.15, y - height * 1.05,       // Front right (same as player)
                x + width * 0.4, y - height,               // Top right (same as player)
                x + width * 0.55, y - height * 0.5,         // Right side mid (same as player)
                x + width / 2, y - height * 0.3            // Bottom right (same as player)
            ];
            
            // Dark shadow/outline for better visibility
            const outlineWidth = Math.max(3, 4 * scale);
            carGraphics.lineStyle(outlineWidth, 0x000000, fadeAlpha * 0.8); // Black outline
            carGraphics.drawPolygon(carShape);
            
            // Main body base (darker sides for shadow) - apply atmospheric fade
            carGraphics.beginFill(accentColor, fadeAlpha);
            carGraphics.drawPolygon(carShape);
            carGraphics.endFill();
            
            // Main body (lighter top for highlight) - same as player car
            const highlightShape = [
                x - width * 0.4, y - height * 0.5,
                x - width * 0.3, y - height * 0.7,
                x - width * 0.1, y - height * 0.95,
                x + width * 0.1, y - height * 0.95,
                x + width * 0.3, y - height * 0.7,
                x + width * 0.4, y - height * 0.5
            ];
            carGraphics.beginFill(colorHex, fadeAlpha);
            carGraphics.drawPolygon(highlightShape);
            carGraphics.endFill();
            
            // Ground shadow for depth (always visible)
            const shadow = new PIXI.Graphics();
            shadow.beginFill(0x000000, fadeAlpha * 0.3);
            shadow.drawEllipse(x, y, width * 1.2, height * 0.15);
            shadow.endFill();
            carContainer.addChild(shadow);
            
            // Structure details - same as player car (panels/lines)
            carGraphics.lineStyle(Math.max(2, 2 * scale), accentColor, 0.6 * fadeAlpha);
            carGraphics.moveTo(x - width * 0.2, y - height * 0.6);
            carGraphics.lineTo(x - width * 0.15, y - height * 0.9);
            carGraphics.moveTo(x + width * 0.2, y - height * 0.6);
            carGraphics.lineTo(x + width * 0.15, y - height * 0.9);
            carGraphics.moveTo(x - width * 0.05, y - height * 0.55);
            carGraphics.lineTo(x - width * 0.05, y - height * 0.85);
            carGraphics.moveTo(x + width * 0.05, y - height * 0.55);
            carGraphics.lineTo(x + width * 0.05, y - height * 0.85);
            
            // Darker window area at front - same as player car
            carGraphics.beginFill(0x000000, 0.6 * fadeAlpha);
            carGraphics.drawPolygon([
                x - width * 0.15, y - height * 0.95,
                x - width * 0.1, y - height,
                x + width * 0.1, y - height,
                x + width * 0.15, y - height * 0.95
            ]);
            carGraphics.endFill();
            
            // Distinct front and rear sections - same as player car
            carGraphics.lineStyle(Math.max(3, 3 * scale), colorHex, 0.8 * fadeAlpha);
            carGraphics.moveTo(x - width * 0.4, y - height * 0.3);
            carGraphics.lineTo(x - width * 0.35, y - height * 0.5);
            carGraphics.moveTo(x + width * 0.4, y - height * 0.3);
            carGraphics.lineTo(x + width * 0.35, y - height * 0.5);
            
            // Hover glow beneath - same style as player but smaller
            const hoverGlow = new PIXI.Graphics();
            hoverGlow.beginFill((this.carColors.exhaust.r << 16) | (this.carColors.exhaust.g << 8) | this.carColors.exhaust.b, hoverPulse * 0.15 * fadeAlpha);
            hoverGlow.drawEllipse(x, y, width * 1.2, height * 0.3);
            hoverGlow.endFill();
            carContainer.addChild(hoverGlow);
            
            // Apply alpha to entire container for fade effect
            carContainer.alpha = fadeAlpha;
            
            carContainer.addChild(carGraphics);
            layer.addChild(carContainer);
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
        
        const carContainer = new PIXI.Container();
        
        // Exhaust flames (bright light blue trailing from rear)
        const speedFactor = Math.min(1, this.playerCar.speed / this.playerCar.maxSpeed);
        const exhaustLength = 25 + speedFactor * 15;
        const exhaustWidth = 12 + speedFactor * 8;
        
        for (let e = 0; e < 3; e++) {
            const exhaustSegment = new PIXI.Graphics();
            const exhaustProgress = e / 3;
            const segmentLength = exhaustLength / 3;
            const segmentY = y + exhaustProgress * segmentLength;
            const segmentWidth = exhaustWidth * (1 - exhaustProgress * 0.5);
            
            const exhaustColor = e === 0 ? 
                (this.carColors.exhaustAlt.r << 16) | (this.carColors.exhaustAlt.g << 8) | this.carColors.exhaustAlt.b :
                (this.carColors.exhaust.r << 16) | (this.carColors.exhaust.g << 8) | this.carColors.exhaust.b;
            
            // Outer glow
            const exhaustAlpha = (1 - exhaustProgress) * (0.6 + speedFactor * 0.3) * hoverPulse;
            exhaustSegment.beginFill(exhaustColor, exhaustAlpha * 0.4);
            exhaustSegment.drawPolygon([
                x - segmentWidth / 1.5, segmentY,
                x + segmentWidth / 1.5, segmentY,
                x + segmentWidth / 2, segmentY + segmentLength,
                x - segmentWidth / 2, segmentY + segmentLength
            ]);
            exhaustSegment.endFill();
            
            // Inner bright core
            exhaustSegment.beginFill(exhaustColor, exhaustAlpha * 0.9);
            exhaustSegment.drawPolygon([
                x - segmentWidth / 3, segmentY,
                x + segmentWidth / 3, segmentY,
                x + segmentWidth / 4, segmentY + segmentLength * 0.8,
                x - segmentWidth / 4, segmentY + segmentLength * 0.8
            ]);
            exhaustSegment.endFill();
            carContainer.addChild(exhaustSegment);
        }
        
        // Hover glow beneath car
        const hoverGlow = new PIXI.Graphics();
        hoverGlow.beginFill((this.carColors.exhaust.r << 16) | (this.carColors.exhaust.g << 8) | this.carColors.exhaust.b, hoverPulse * 0.2);
        hoverGlow.drawEllipse(x, y, width * 1.2, height * 0.3);
        hoverGlow.endFill();
        carContainer.addChild(hoverGlow);
        
        const carGraphics = new PIXI.Graphics();
        const bodyColor = (this.carColors.body.r << 16) | (this.carColors.body.g << 8) | this.carColors.body.b;
        const accentColor = (this.carColors.accent.r << 16) | (this.carColors.accent.g << 8) | this.carColors.accent.b;
        
        // Car shape polygon: wider at back, tapered front (rear-view hover car)
        const carShape = [
            x - width / 2, y - height * 0.3,           // Bottom left
            x - width * 0.55, y - height * 0.5,        // Left side mid
            x - width * 0.4, y - height,               // Top left (narrower)
            x - width * 0.15, y - height * 1.05,       // Front left (tapered)
            x + width * 0.15, y - height * 1.05,       // Front right
            x + width * 0.4, y - height,               // Top right
            x + width * 0.55, y - height * 0.5,         // Right side mid
            x + width / 2, y - height * 0.3            // Bottom right
        ];
        
        // Main body base (darker sides for shadow)
        carGraphics.beginFill(accentColor, 1);
        carGraphics.drawPolygon(carShape);
        carGraphics.endFill();
        
        // Main body (lighter top for highlight)
        const highlightShape = [
            x - width * 0.4, y - height * 0.5,
            x - width * 0.3, y - height * 0.7,
            x - width * 0.1, y - height * 0.95,
            x + width * 0.1, y - height * 0.95,
            x + width * 0.3, y - height * 0.7,
            x + width * 0.4, y - height * 0.5
        ];
        carGraphics.beginFill(bodyColor, 1);
        carGraphics.drawPolygon(highlightShape);
        carGraphics.endFill();
        
        // Structure details - panels/lines
        carGraphics.lineStyle(2, accentColor, 0.6);
        carGraphics.moveTo(x - width * 0.2, y - height * 0.6);
        carGraphics.lineTo(x - width * 0.15, y - height * 0.9);
        carGraphics.moveTo(x + width * 0.2, y - height * 0.6);
        carGraphics.lineTo(x + width * 0.15, y - height * 0.9);
        carGraphics.moveTo(x - width * 0.05, y - height * 0.55);
        carGraphics.lineTo(x - width * 0.05, y - height * 0.85);
        carGraphics.moveTo(x + width * 0.05, y - height * 0.55);
        carGraphics.lineTo(x + width * 0.05, y - height * 0.85);
        
        // Darker window area at front
        carGraphics.beginFill(0x000000, 0.6);
        carGraphics.drawPolygon([
            x - width * 0.15, y - height * 0.95,
            x - width * 0.1, y - height,
            x + width * 0.1, y - height,
            x + width * 0.15, y - height * 0.95
        ]);
        carGraphics.endFill();
        
        // Distinct front and rear sections
        carGraphics.lineStyle(3, bodyColor, 0.8);
        carGraphics.moveTo(x - width * 0.4, y - height * 0.3);
        carGraphics.lineTo(x - width * 0.35, y - height * 0.5);
        carGraphics.moveTo(x + width * 0.4, y - height * 0.3);
        carGraphics.lineTo(x + width * 0.35, y - height * 0.5);
        
        carContainer.addChild(carGraphics);
        layer.addChild(carContainer);
    }
    
    drawUIPixi(layer) {
        // Update stats panel instead of drawing on canvas
        this.updateStatsPanel();
        
        // LAP/TIME Display (Upper-right) - synthwave style
        const lapLabelStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 16,
            fill: (this.uiColors.purple.r << 16) | (this.uiColors.purple.g << 8) | this.uiColors.purple.b,
            fontWeight: 'bold'
        });
        const lapValueStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 18,
            fill: (this.uiColors.orange.r << 16) | (this.uiColors.orange.g << 8) | this.uiColors.orange.b,
            fontWeight: 'bold'
        });
        
        const lapLabel = new PIXI.Text('LAP', lapLabelStyle);
        lapLabel.x = this.width - 120;
        lapLabel.y = 20;
        layer.addChild(lapLabel);
        
        const lapValue = new PIXI.Text(`${this.level}/3`, lapValueStyle);
        lapValue.x = this.width - 120;
        lapValue.y = 40;
        layer.addChild(lapValue);
        
        const timeLabel = new PIXI.Text('TIME', lapLabelStyle);
        timeLabel.x = this.width - 120;
        timeLabel.y = 65;
        layer.addChild(timeLabel);
        
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = Math.floor(this.timeLeft % 60);
        const timeValue = new PIXI.Text(`${minutes}:${seconds.toString().padStart(2, '0')}`, lapValueStyle);
        timeValue.x = this.width - 120;
        timeValue.y = 85;
        layer.addChild(timeValue);
        
        // Speedometer (Lower-left) with bar graph
        const speed = Math.floor(this.playerCar.speed);
        const speedStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 16,
            fill: (this.uiColors.orange.r << 16) | (this.uiColors.orange.g << 8) | this.uiColors.orange.b,
            fontWeight: 'bold'
        });
        const speedText = new PIXI.Text(`${speed} km/h`, speedStyle);
        speedText.x = 20;
        speedText.y = this.height - 80;
        layer.addChild(speedText);
        
        // Bar graph (vertical bars for speed/boost)
        const barGraphX = 20;
        const barGraphY = this.height - 50;
        const barWidth = 8;
        const barHeight = 3;
        const barSpacing = 2;
        const maxBars = 15;
        const filledBars = Math.floor((speed / this.playerCar.maxSpeed) * maxBars);
        
        // Background box for bar graph
        const barBg = new PIXI.Graphics();
        barBg.lineStyle(2, 0xff0000, 1); // Red border
        barBg.beginFill(0x000033, 0.8); // Dark blue background
        barBg.drawRect(barGraphX - 2, barGraphY - 2, barWidth + 4, (barHeight + barSpacing) * maxBars + barSpacing);
        barBg.endFill();
        layer.addChild(barBg);
        
        // Draw bars - combine into single graphics object
        const bars = new PIXI.Graphics();
        for (let i = 0; i < maxBars; i++) {
            if (i < filledBars) {
                bars.beginFill(0xffffff, 1); // White segments
            } else {
                bars.beginFill(0xffffff, 0.3); // Faded segments
            }
            bars.drawRect(barGraphX, barGraphY + i * (barHeight + barSpacing), barWidth, barHeight);
            bars.endFill();
        }
        layer.addChild(bars);
        
        // Crash feedback message
        if (this.gameState === 'crashing') {
            const crashOverlay = new PIXI.Graphics();
            crashOverlay.beginFill(0xFF0000, 0.3); // Red tint overlay
            crashOverlay.drawRect(0, 0, this.width, this.height);
            crashOverlay.endFill();
            layer.addChild(crashOverlay);
            
            const crashStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 48,
                fill: (this.uiColors.orange.r << 16) | (this.uiColors.orange.g << 8) | this.uiColors.orange.b,
                fontWeight: 'bold',
                stroke: 0x000000,
                strokeThickness: 4,
                dropShadow: true,
                dropShadowColor: 0x000000,
                dropShadowBlur: 10,
                dropShadowAngle: Math.PI / 4,
                dropShadowDistance: 5
            });
            
            const crashText = new PIXI.Text('CRASH!', crashStyle);
            crashText.anchor.set(0.5);
            crashText.x = this.width / 2;
            crashText.y = this.height / 2 - 30;
            layer.addChild(crashText);
            
            const livesStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 24,
                fill: 0xffffff,
                fontWeight: 'bold',
                stroke: 0x000000,
                strokeThickness: 2
            });
            
            const livesText = new PIXI.Text(`Lives: ${this.lives}`, livesStyle);
            livesText.anchor.set(0.5);
            livesText.x = this.width / 2;
            livesText.y = this.height / 2 + 30;
            layer.addChild(livesText);
        }
        
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
        // Synthwave menu background
        const menuBg = new PIXI.Graphics();
        menuBg.beginFill((this.skyColors.topDark.r << 16) | (this.skyColors.topDark.g << 8) | this.skyColors.topDark.b, 1);
        menuBg.drawRect(0, 0, this.width, this.height);
        menuBg.endFill();
        layer.addChild(menuBg);
        
        // Draw stars and sunset in menu too
        this.drawStarsPixi(layer);
        this.drawSunsetPixi(layer);
        
        // Golden-orange title with shadow for depth
        const titleShadowStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 50,
            fill: (this.uiColors.goldShadow.r << 16) | (this.uiColors.goldShadow.g << 8) | this.uiColors.goldShadow.b,
            fontWeight: 'bold',
            align: 'center'
        });
        const titleShadow = new PIXI.Text('HYPER RUNNERS', titleShadowStyle);
        titleShadow.anchor.set(0.5);
        titleShadow.x = this.width / 2 + 3; // Offset for shadow
        titleShadow.y = this.height / 2 - 100 + 3;
        layer.addChild(titleShadow);
        
        const titleStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 50,
            fill: (this.uiColors.gold.r << 16) | (this.uiColors.gold.g << 8) | this.uiColors.gold.b,
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
    
    drawCityscape() {
        // Multi-layered cityscape with parallax effect (Canvas 2D version)
        const currentTime = Date.now();
        const parallaxOffset = (this.playerZ * 0.1) % 100;
        
        const layers = [
            { z: 0.3, scale: 0.6, alpha: 0.4, buildingCount: 8 },
            { z: 0.6, scale: 0.8, alpha: 0.7, buildingCount: 12 },
            { z: 1.0, scale: 1.0, alpha: 1.0, buildingCount: 15 }
        ];
        
        layers.forEach((layerData) => {
            const buildingSpacing = this.width / (layerData.buildingCount + 2);
            
            for (let i = 0; i < layerData.buildingCount; i++) {
                const baseX = (i + 1) * buildingSpacing + parallaxOffset * layerData.z;
                const wrappedX = ((baseX % (this.width + buildingSpacing)) + buildingSpacing) % (this.width + buildingSpacing);
                
                const centerDistance = Math.abs(i - layerData.buildingCount / 2) / (layerData.buildingCount / 2);
                const heightVariation = 1 - centerDistance * 0.5;
                const buildingHeight = (this.height - this.horizonY) * layerData.scale * heightVariation * (0.5 + Math.random() * 0.5);
                
                // Draw building
                const buildingColor = i % 2 === 0 ? this.cityColors.building : this.cityColors.buildingAlt;
                this.ctx.fillStyle = `rgba(${buildingColor.r}, ${buildingColor.g}, ${buildingColor.b}, ${layerData.alpha})`;
                const buildingWidth = buildingSpacing * 0.6 * layerData.scale;
                this.ctx.fillRect(wrappedX - buildingWidth / 2, this.horizonY - buildingHeight, buildingWidth, buildingHeight);
                
                // Add windows
                const windowCount = Math.floor(buildingHeight / 30) * layerData.scale;
                const windowPulse = Math.sin(currentTime / 1000 + i) * 0.3 + 0.7;
                
                for (let w = 0; w < windowCount; w++) {
                    const windowY = this.horizonY - buildingHeight + (w + 1) * (buildingHeight / (windowCount + 1));
                    const windowX = wrappedX + (Math.random() - 0.5) * buildingWidth * 0.6;
                    
                    const isPink = Math.random() < 0.5;
                    const windowColor = isPink ? this.cityColors.windowPink : this.cityColors.windowCyan;
                    
                    // Window glow
                    this.ctx.fillStyle = `rgba(${windowColor.r}, ${windowColor.g}, ${windowColor.b}, ${windowPulse * 0.4 * layerData.alpha})`;
                    this.ctx.beginPath();
                    this.ctx.arc(windowX, windowY, 6, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Window center
                    this.ctx.fillStyle = `rgba(${windowColor.r}, ${windowColor.g}, ${windowColor.b}, ${windowPulse * 0.9 * layerData.alpha})`;
                    this.ctx.fillRect(windowX - 2, windowY - 2, 4, 4);
                }
            }
        });
        
        // Ground reflection
        this.ctx.fillStyle = 'rgba(51, 0, 102, 0.15)';
        this.ctx.fillRect(0, this.horizonY, this.width, (this.height - this.horizonY) * 0.2);
    }
    
    drawHorizon() {
        // Simple horizon line (cityscape provides the visual horizon)
        this.ctx.strokeStyle = `rgba(${this.skyColors.horizon.r}, ${this.skyColors.horizon.g}, ${this.skyColors.horizon.b}, 0.5)`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.horizonY);
        this.ctx.lineTo(this.width, this.horizonY);
        this.ctx.stroke();
    }
    
    drawSunset() {
        const sunX = this.width * 0.15;
        const sunY = this.height * 0.15;
        const sunRadius = this.width * 0.12;
        
        // Sun glow halo
        const haloGradient = this.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 1.5);
        haloGradient.addColorStop(0, `rgba(${this.sunColors.circle.r}, ${this.sunColors.circle.g}, ${this.sunColors.circle.b}, 0.3)`);
        haloGradient.addColorStop(1, `rgba(${this.sunColors.circle.r}, ${this.sunColors.circle.g}, ${this.sunColors.circle.b}, 0)`);
        this.ctx.fillStyle = haloGradient;
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, sunRadius * 1.5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Main sun circle
        this.ctx.fillStyle = `rgb(${this.sunColors.circle.r}, ${this.sunColors.circle.g}, ${this.sunColors.circle.b})`;
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Horizontal lines
        const lineCount = 5;
        for (let i = 0; i < lineCount; i++) {
            const y = sunY - sunRadius + (i + 1) * (sunRadius * 2 / (lineCount + 1));
            const lineWidth = Math.sqrt(sunRadius * sunRadius - Math.pow(y - sunY, 2)) * 2;
            if (lineWidth > 0) {
                this.ctx.strokeStyle = `rgb(${this.sunColors.lines.r}, ${this.sunColors.lines.g}, ${this.sunColors.lines.b})`;
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(sunX - lineWidth / 2, y);
                this.ctx.lineTo(sunX + lineWidth / 2, y);
                this.ctx.stroke();
            }
        }
    }
    
    drawStars() {
        // Enhanced starfield with twinkling
        const currentTime = Date.now();
        
        for (let i = 0; i < 180; i++) {
            const angle = i * 2.399963229728653;
            const radius = Math.sqrt(i / 180) * Math.min(this.width, this.horizonY);
            const x = (this.width / 2) + radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            
            if (y > this.horizonY) continue;
            
            const baseSize = (i % 3) + 1;
            const heightFactor = 1 - (y / this.horizonY);
            const baseAlpha = 0.6 + heightFactor * 0.4;
            const twinklePhase = (currentTime / 1000 + i * 0.1) % (Math.PI * 2);
            const twinkle = Math.sin(twinklePhase) * 0.2 + 0.8;
            const alpha = baseAlpha * twinkle;
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.fillRect(x - baseSize / 2, y - baseSize / 2, baseSize, baseSize);
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
            
            // Draw traffic ahead of player only
            // Increased view distance to match longer levels
            if (relativeZ <= 0 || relativeZ > 1000) continue;
            
            // Use same scale calculation as road segments
            const scale = cameraDepth / relativeZ; // Cars get BIGGER as they get closer
            const roadWidth = this.roadWidth * scale;
            
            // Clamp segment index to valid range
            const segmentIndex = Math.max(0, Math.min(Math.floor(car.z), this.roadSegments.length - 1));
            const segment = this.roadSegments[segmentIndex];
            if (!segment) continue;
            
            const baseRoadX = segment.curve * scale * 300 + this.width / 2;
            const x = baseRoadX + car.x * roadWidth / 2;
            
            // Calculate y position same way as road segments (matching drawRoad)
            const y = this.horizonY + (cameraHeight / relativeZ);
            
            // Only draw if car is visible
            if (y < this.horizonY || y > this.height) continue;
            
            // Atmospheric perspective: fade and desaturate based on distance
            const distanceFactor = Math.min(1, relativeZ / 1000); // 0 = near, 1 = far (adjusted for longer view)
            const fadeAlpha = 1 - distanceFactor * 0.4;
            const detailFactor = 1 - distanceFactor * 0.5;
            
            // Make cars more substantial - use same scale as road segments
            // Base sizes: cars should be about 10-15% of road width when drawn
            // At 200 units: road width = 21px, so car width should be ~3-4px
            // With scale = 0.0042, baseWidth needs to be ~750-1000
            const baseWidth = this.level > 10 ? 900 : 750; // Properly sized for perspective scaling
            const baseHeight = this.level > 10 ? 1500 : 1250;
            const width = baseWidth * scale;
            const height = baseHeight * scale;
            
            // Update hover glow animation
            car.hoverGlow += 0.1;
            const hoverPulse = Math.sin(car.hoverGlow) * 0.3 + 0.7;
            
            // Use exact same shape as player car (same proportions) - just different colors
            // Calculate colors with atmospheric desaturation
            const r = parseInt(car.color.slice(1, 3), 16);
            const g = parseInt(car.color.slice(3, 5), 16);
            const b = parseInt(car.color.slice(5, 7), 16);
            
            // Desaturate colors for distance
            const desatAmount = distanceFactor * 0.3;
            const gray = (r + g + b) / 3;
            const desatR = Math.floor(r * (1 - desatAmount) + gray * desatAmount);
            const desatG = Math.floor(g * (1 - desatAmount) + gray * desatAmount);
            const desatB = Math.floor(b * (1 - desatAmount) + gray * desatAmount);
            
            const accentR = Math.floor(desatR * 0.8);
            const accentG = Math.floor(desatG * 0.8);
            const accentB = Math.floor(desatB * 0.8);
            
            const desatCarColor = `rgb(${desatR}, ${desatG}, ${desatB})`;
            
            // Optional small exhaust (deterministic)
            const exhaustChance = ((car.z * 7) % 10) / 10;
            if (relativeZ < 150 && exhaustChance < 0.3) {
                const exhaustLength = 8 * scale;
                this.ctx.fillStyle = `rgba(${this.carColors.exhaust.r}, ${this.carColors.exhaust.g}, ${this.carColors.exhaust.b}, ${hoverPulse * 0.6})`;
                this.ctx.beginPath();
                this.ctx.moveTo(x - width * 0.15, y);
                this.ctx.lineTo(x + width * 0.15, y);
                this.ctx.lineTo(x + width * 0.2, y + exhaustLength);
                this.ctx.lineTo(x - width * 0.2, y + exhaustLength);
                this.ctx.closePath();
                this.ctx.fill();
            }
            
            // Car shape polygon - exact same shape as player car
            const carShape = [
                [x - width / 2, y - height * 0.3],           // Bottom left (same as player)
                [x - width * 0.55, y - height * 0.5],        // Left side mid (same as player)
                [x - width * 0.4, y - height],               // Top left (same as player)
                [x - width * 0.15, y - height * 1.05],       // Front left (same as player)
                [x + width * 0.15, y - height * 1.05],       // Front right (same as player)
                [x + width * 0.4, y - height],               // Top right (same as player)
                [x + width * 0.55, y - height * 0.5],         // Right side mid (same as player)
                [x + width / 2, y - height * 0.3]            // Bottom right (same as player)
            ];
            
            // Ground shadow for depth (always visible)
            this.ctx.globalAlpha = fadeAlpha * 0.3;
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.ellipse(x, y, width * 0.6, height * 0.075, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Dark outline for better visibility
            this.ctx.globalAlpha = fadeAlpha * 0.8;
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = Math.max(3, 4 * scale);
            this.ctx.beginPath();
            this.ctx.moveTo(carShape[0][0], carShape[0][1]);
            for (let p = 1; p < carShape.length; p++) {
                this.ctx.lineTo(carShape[p][0], carShape[p][1]);
            }
            this.ctx.closePath();
            this.ctx.stroke();
            
            // Main body base (darker sides) - apply atmospheric fade
            this.ctx.globalAlpha = fadeAlpha;
            this.ctx.fillStyle = `rgb(${accentR}, ${accentG}, ${accentB})`;
            this.ctx.beginPath();
            this.ctx.moveTo(carShape[0][0], carShape[0][1]);
            for (let p = 1; p < carShape.length; p++) {
                this.ctx.lineTo(carShape[p][0], carShape[p][1]);
            }
            this.ctx.closePath();
            this.ctx.fill();
            
            // Main body highlight - same as player car
            this.ctx.fillStyle = desatCarColor;
            const highlightShape = [
                [x - width * 0.4, y - height * 0.5],
                [x - width * 0.3, y - height * 0.7],
                [x - width * 0.1, y - height * 0.95],
                [x + width * 0.1, y - height * 0.95],
                [x + width * 0.3, y - height * 0.7],
                [x + width * 0.4, y - height * 0.5]
            ];
            this.ctx.beginPath();
            this.ctx.moveTo(highlightShape[0][0], highlightShape[0][1]);
            for (let p = 1; p < highlightShape.length; p++) {
                this.ctx.lineTo(highlightShape[p][0], highlightShape[p][1]);
            }
            this.ctx.closePath();
            this.ctx.fill();
            
            // Structure details - same as player car (panels/lines)
            this.ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${0.6 * fadeAlpha})`;
            this.ctx.lineWidth = Math.max(2, 2 * scale);
            this.ctx.beginPath();
            this.ctx.moveTo(x - width * 0.2, y - height * 0.6);
            this.ctx.lineTo(x - width * 0.15, y - height * 0.9);
            this.ctx.moveTo(x + width * 0.2, y - height * 0.6);
            this.ctx.lineTo(x + width * 0.15, y - height * 0.9);
            this.ctx.moveTo(x - width * 0.05, y - height * 0.55);
            this.ctx.lineTo(x - width * 0.05, y - height * 0.85);
            this.ctx.moveTo(x + width * 0.05, y - height * 0.55);
            this.ctx.lineTo(x + width * 0.05, y - height * 0.85);
            this.ctx.stroke();
            
            // Window area - same as player car
            this.ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * fadeAlpha})`;
            this.ctx.beginPath();
            this.ctx.moveTo(x - width * 0.15, y - height * 0.95);
            this.ctx.lineTo(x - width * 0.1, y - height);
            this.ctx.lineTo(x + width * 0.1, y - height);
            this.ctx.lineTo(x + width * 0.15, y - height * 0.95);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Distinct front and rear sections - same as player car
            this.ctx.strokeStyle = `rgba(${desatR}, ${desatG}, ${desatB}, ${0.8 * fadeAlpha})`;
            this.ctx.lineWidth = Math.max(3, 3 * scale);
            this.ctx.beginPath();
            this.ctx.moveTo(x - width * 0.4, y - height * 0.3);
            this.ctx.lineTo(x - width * 0.35, y - height * 0.5);
            this.ctx.moveTo(x + width * 0.4, y - height * 0.3);
            this.ctx.lineTo(x + width * 0.35, y - height * 0.5);
            this.ctx.stroke();
            
            // Hover glow - same style as player but smaller
            this.ctx.fillStyle = `rgba(${this.carColors.exhaust.r}, ${this.carColors.exhaust.g}, ${this.carColors.exhaust.b}, ${hoverPulse * 0.15 * fadeAlpha})`;
            this.ctx.beginPath();
            this.ctx.ellipse(x, y, width * 0.6, height * 0.15, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.globalAlpha = 1; // Reset alpha
            this.ctx.shadowBlur = 0;
        }
    }
    
    drawPlayerCar() {
        // Update hover glow animation
        if (!this.playerCar.hoverGlow) this.playerCar.hoverGlow = 0;
        this.playerCar.hoverGlow += 0.15;
        const hoverPulse = Math.sin(this.playerCar.hoverGlow) * 0.3 + 0.7;
        
        // Position hover car based on track width at bottom of screen
        const bottomRoadWidth = this.roadWidth * (this.cameraDepth / 20);
        const x = this.width / 2 + this.playerCar.x * (bottomRoadWidth / 2);
        const y = this.height - 120;
        const width = 40;
        const height = 75;
        
        const speedFactor = Math.min(1, this.playerCar.speed / this.playerCar.maxSpeed);
        
        // Exhaust flames (bright light blue trailing from rear)
        const exhaustLength = 25 + speedFactor * 15;
        const exhaustWidth = 12 + speedFactor * 8;
        
        for (let e = 0; e < 3; e++) {
            const exhaustProgress = e / 3;
            const segmentLength = exhaustLength / 3;
            const segmentY = y + exhaustProgress * segmentLength;
            const segmentWidth = exhaustWidth * (1 - exhaustProgress * 0.5);
            
            const exhaustColor = e === 0 ? 
                `rgba(${this.carColors.exhaustAlt.r}, ${this.carColors.exhaustAlt.g}, ${this.carColors.exhaustAlt.b}, ${(1 - exhaustProgress) * (0.6 + speedFactor * 0.3) * hoverPulse * 0.4})` :
                `rgba(${this.carColors.exhaust.r}, ${this.carColors.exhaust.g}, ${this.carColors.exhaust.b}, ${(1 - exhaustProgress) * (0.6 + speedFactor * 0.3) * hoverPulse * 0.4})`;
            
            // Outer glow
            this.ctx.fillStyle = exhaustColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x - segmentWidth / 1.5, segmentY);
            this.ctx.lineTo(x + segmentWidth / 1.5, segmentY);
            this.ctx.lineTo(x + segmentWidth / 2, segmentY + segmentLength);
            this.ctx.lineTo(x - segmentWidth / 2, segmentY + segmentLength);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Inner bright core
            this.ctx.fillStyle = exhaustColor.replace(/0\.[0-9]+\)/, (1 - exhaustProgress) * (0.6 + speedFactor * 0.3) * hoverPulse * 0.9 + ')');
            this.ctx.beginPath();
            this.ctx.moveTo(x - segmentWidth / 3, segmentY);
            this.ctx.lineTo(x + segmentWidth / 3, segmentY);
            this.ctx.lineTo(x + segmentWidth / 4, segmentY + segmentLength * 0.8);
            this.ctx.lineTo(x - segmentWidth / 4, segmentY + segmentLength * 0.8);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        // Hover glow beneath car
        this.ctx.fillStyle = `rgba(${this.carColors.exhaust.r}, ${this.carColors.exhaust.g}, ${this.carColors.exhaust.b}, ${hoverPulse * 0.2})`;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, width * 1.2, height * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        const bodyColor = this.playerCar.color;
        const accentColor = `rgb(${this.carColors.accent.r}, ${this.carColors.accent.g}, ${this.carColors.accent.b})`;
        
        // Car shape polygon: wider at back, tapered front
        const carShape = [
            [x - width / 2, y - height * 0.3],
            [x - width * 0.55, y - height * 0.5],
            [x - width * 0.4, y - height],
            [x - width * 0.15, y - height * 1.05],
            [x + width * 0.15, y - height * 1.05],
            [x + width * 0.4, y - height],
            [x + width * 0.55, y - height * 0.5],
            [x + width / 2, y - height * 0.3]
        ];
        
        // Main body base (darker sides for shadow)
        this.ctx.fillStyle = accentColor;
        this.ctx.beginPath();
        this.ctx.moveTo(carShape[0][0], carShape[0][1]);
        for (let p = 1; p < carShape.length; p++) {
            this.ctx.lineTo(carShape[p][0], carShape[p][1]);
        }
        this.ctx.closePath();
        this.ctx.fill();
        
        // Main body (lighter top for highlight)
        const highlightShape = [
            [x - width * 0.4, y - height * 0.5],
            [x - width * 0.3, y - height * 0.7],
            [x - width * 0.1, y - height * 0.95],
            [x + width * 0.1, y - height * 0.95],
            [x + width * 0.3, y - height * 0.7],
            [x + width * 0.4, y - height * 0.5]
        ];
        this.ctx.fillStyle = bodyColor;
        this.ctx.beginPath();
        this.ctx.moveTo(highlightShape[0][0], highlightShape[0][1]);
        for (let p = 1; p < highlightShape.length; p++) {
            this.ctx.lineTo(highlightShape[p][0], highlightShape[p][1]);
        }
        this.ctx.closePath();
        this.ctx.fill();
        
        // Structure details - panels/lines
        this.ctx.strokeStyle = `rgba(${this.carColors.accent.r}, ${this.carColors.accent.g}, ${this.carColors.accent.b}, 0.6)`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x - width * 0.2, y - height * 0.6);
        this.ctx.lineTo(x - width * 0.15, y - height * 0.9);
        this.ctx.moveTo(x + width * 0.2, y - height * 0.6);
        this.ctx.lineTo(x + width * 0.15, y - height * 0.9);
        this.ctx.moveTo(x - width * 0.05, y - height * 0.55);
        this.ctx.lineTo(x - width * 0.05, y - height * 0.85);
        this.ctx.moveTo(x + width * 0.05, y - height * 0.55);
        this.ctx.lineTo(x + width * 0.05, y - height * 0.85);
        this.ctx.stroke();
        
        // Darker window area at front
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.beginPath();
        this.ctx.moveTo(x - width * 0.15, y - height * 0.95);
        this.ctx.lineTo(x - width * 0.1, y - height);
        this.ctx.lineTo(x + width * 0.1, y - height);
        this.ctx.lineTo(x + width * 0.15, y - height * 0.95);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Distinct front and rear sections
        this.ctx.strokeStyle = bodyColor;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x - width * 0.4, y - height * 0.3);
        this.ctx.lineTo(x - width * 0.35, y - height * 0.5);
        this.ctx.moveTo(x + width * 0.4, y - height * 0.3);
        this.ctx.lineTo(x + width * 0.35, y - height * 0.5);
        this.ctx.stroke();
        
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
