// Working Man vs Oligarch - Donkey Kong inspired platformer - PixiJS version
// Version 2.0 - Fixed ladder exploit and improved level design
class WorkingManGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        this.isPreview = canvas.id === 'working-man-preview' || this.width < 400;
        
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
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.maxLevel = 20;
        
        // Player (Working Man)
        this.player = {
            x: 50,
            y: this.height - 100,
            width: 24,
            height: 32,
            vx: 0,
            vy: 0,
            baseSpeed: 1.65,
            maxSpeed: 1.65,
            accel: 0.12,
            speed: 0,
            jumpPower: 8.5,
            onGround: false,
            onLadder: false,
            climbing: false,
            direction: 1, // 1 = right, -1 = left
            animFrame: 0,
            animTimer: 0,
            invincible: false,
            invincibleTimer: 0
        };
        
        // Enemy (Oligarch)
        this.oligarch = {
            x: this.width - 100,
            y: 50,
            width: 40,
            height: 48,
            vx: 0,
            vy: 0,
            baseSpeed: 0.85,
            speed: 0.85,
            direction: 1,
            animFrame: 0,
            animTimer: 0,
            throwingTimer: 0,
            baseThrowingInterval: 2200,
            throwingInterval: 2200,
            patrolMin: 50,
            patrolMax: 550,
            lastEdge: null,
            waveThrowsRemaining: 0,
            waveThrowDelay: 0
        };
        
        // Paradise goal — climb to the beach at the top
        this.retirementGoal = {
            x: this.width - 120,
            y: 30,
            width: 90,
            height: 55,
            glowTimer: 0,
            type: 'paradise'
        };
        
        // Level layout tuning (~75px max jump height; vertical rung spacing)
        this.platformSpacing = 56;
        
        // Game physics
        this.gravity = 0.52;
        this.friction = 0.82;
        this.maxFallSpeed = 11;
        this.coyoteFrames = 0;
        this.jumpBufferMs = 0;
        this.jumpCooldownMs = 0;
        this.wasOnGround = false;
        
        // Level elements
        this.platforms = [];
        this.ladders = [];
        this.moneyBags = [];
        this.powerUps = [];
        
        // Animation and effects
        if (this.isPreview) {
            this.particles = new ParticleSystem();
            this.screenEffects = new ScreenEffects(canvas);
            this.tweenManager = new TweenManager();
            this.crtFilter = new CRTFilter(canvas);
            this.playerTrail = new MotionTrail(10, 0.90);
        } else {
            this.particles = null; // Will create PixiJS particles as needed
            this.screenEffects = null; // Will be set from nesEffects
            this.tweenManager = new TweenManager();
            this.crtFilter = null; // CRT handled by NES effects
            this.playerTrail = null; // Will be implemented with PixiJS
        }
        
        // PixiJS sprites (only for main game)
        if (!this.isPreview) {
            this.platformSprites = [];
            this.ladderSprites = [];
            this.playerSprite = null;
            this.oligarchSprite = null;
            this.moneyBagSprites = [];
            this.powerUpSprites = [];
            this.retirementGoalSprite = null;
            this.playerTrailSprites = [];
        }
        
        // Power-up types
        this.powerUpTypes = {
            SPEED_BOOST: { color: '#00ff00', duration: 600, effect: 'speed' },
            INVINCIBILITY: { color: '#ffff00', duration: 300, effect: 'invincible' },
            EXTRA_LIFE: { color: '#ff0000', duration: 0, effect: 'life' },
            SLOW_TIME: { color: '#00ffff', duration: 180, effect: 'slowTime' }
        };
        
        // Active power-ups
        this.activePowerUps = {
            speed: false,
            invincible: false,
            slowTime: false
        };
        this.powerUpTimers = {
            speed: 0,
            invincible: 0,
            slowTime: 0
        };
        
        // Input handling
        this.keys = {};
        this.setupInput();
        
        // Pre-designed levels
        this.levelLayouts = this.createLevelLayouts();
        
        // Start in menu state
        this.gameState = 'menu';
        
        // Generate initial level for display purposes
        this.generateLevel();
        
        // Start game loop
        this.lastTime = 0;
        if (this.isPreview) {
            // For preview, just draw once
            this.drawPreview();
        } else {
            this.initGraphics();
        }
    }
    
    async initGraphics() {
        if (this.isPreview) return;
        try {
            await this.graphics.init();
            if (!this.graphics || !this.graphics.isInitialized || !this.graphics.app || !this.graphics.app.renderer || !this.graphics.app.ticker) {
                console.error('Graphics initialization failed, falling back to requestAnimationFrame');
                this.gameLoop();
                if (typeof this.onReady === 'function') this.onReady();
                return;
            }
            await this.finishGraphicsInit();
        } catch (err) {
            console.error('Working Man graphics init error:', err);
            this.gameLoop();
            if (typeof this.onReady === 'function') this.onReady();
        }
    }
    
    async finishGraphicsInit() {
        this.spriteManager = new SpriteManager(this.graphics);
        this.nesEffects = this.graphics.getScreenEffects();
        this.screenEffects = this.nesEffects;
        this.gameAssets = new GameAssetHelper(this.spriteManager, 'working-man');
        if (this.gameAssets) await this.gameAssets.preloadAll();
        await this.initSprites();
        this.startGameLoop();
        if (this.graphics && typeof this.graphics.start === 'function') {
            this.graphics.start();
        }
        this.drawPixi();
        if (typeof this.onReady === 'function') this.onReady();
    }
    
    async initSprites() {
        if (this.isPreview) return;
        if (this.gameAssets) {
            this.playerTexture = await this.gameAssets.loadKey('player');
        }
        this.updatePlatformSprites();
        this.updateLadderSprites();
        this.updateMoneyBagSprites();
        this.updatePowerUpSprites();
        this.updateRetirementGoalSprite();
    }
    
    startGameLoop() {
        if (this.isPreview) {
            this.gameLoop();
            return;
        }
        
        const ticker = this.graphics.getTicker();
        if (ticker) {
            this.tickerCallback = (tickerObj) => {
                const deltaMs = Math.min(Math.max((tickerObj.deltaTime ?? 1) * 16.67, 1), 50);
                this.gameLoop(deltaMs);
            };
            ticker.add(this.tickerCallback);
        } else {
            console.warn('PixiJS ticker not available, falling back to requestAnimationFrame');
            this.gameLoop();
        }
    }
    
    createLevelLayouts() {
        // 20 distinct level patterns inspired by Donkey Kong
        const layouts = [];
        const platformHeight = 16;
        const startY = this.height - 80;
        
        // Level 1: Simple zigzag - easy start
        layouts.push(this.createZigzagPattern(1, startY, platformHeight));
        
        // Level 2: Alternating sides pattern
        layouts.push(this.createAlternatingSidesPattern(2, startY, platformHeight));
        
        // Level 3: Spiral pattern
        layouts.push(this.createSpiralPattern(3, startY, platformHeight));
        
        // Level 4: Left-right-left pattern
        layouts.push(this.createLeftRightPattern(4, startY, platformHeight));
        
        // Level 5: Center column with branches
        layouts.push(this.createCenterBranchesPattern(5, startY, platformHeight));
        
        // Level 6: Side-to-side snake
        layouts.push(this.createSnakePattern(6, startY, platformHeight));
        
        // Level 7: Double column pattern
        layouts.push(this.createDoubleColumnPattern(7, startY, platformHeight));
        
        // Level 8: Mixed complexity
        layouts.push(this.createMixedPattern(8, startY, platformHeight));
        
        // Level 9: Challenging zigzag with gaps
        layouts.push(this.createGapZigzagPattern(9, startY, platformHeight));
        
        // Level 10: Complex spiral
        layouts.push(this.createComplexSpiralPattern(10, startY, platformHeight));
        
        // Levels 11-15: new hand-authored patterns
        layouts.push(this.createTightGapsPattern(11, startY, platformHeight));
        layouts.push(this.createDKClassicPattern(12, startY, platformHeight));
        layouts.push(this.createStaggeredRungsPattern(13, startY, platformHeight));
        layouts.push(this.createNarrowBridgePattern(14, startY, platformHeight));
        layouts.push(this.createFinalClimbPattern(15, startY, platformHeight));
        
        // Levels 16-20: variations of new patterns
        for (let level = 16; level <= 20; level++) {
            const baseLayout = layouts[10 + (level - 16)];
            layouts.push(this.varyLayout(baseLayout, level, 1, startY, platformHeight));
        }
        
        return layouts;
    }
    
    // Helper function to add ladder between two platforms
    addLadder(layout, lowerPlatform, upperPlatform, xPos, extraHeight = 12) {
        const ladderTop = upperPlatform.y;
        const ladderBottom = lowerPlatform.y;
        const ladderHeight = ladderBottom - ladderTop + extraHeight;

        layout.ladders.push({
            x: xPos,
            y: ladderTop,
            width: 16,
            height: Math.max(ladderHeight, 40)
        });
    }

    /** Place ladder on the edge facing the next platform. */
    autoLadder(layout, lower, upper) {
        const lowerCenter = lower.x + lower.width / 2;
        const upperCenter = upper.x + upper.width / 2;
        const overlapLeft = Math.max(lower.x, upper.x);
        const overlapRight = Math.min(lower.x + lower.width, upper.x + upper.width);

        let ladderX;
        if (overlapRight - overlapLeft > 50) {
            ladderX = overlapLeft + (overlapRight - overlapLeft) / 2 - 8;
        } else if (upperCenter >= lowerCenter) {
            ladderX = lower.x + lower.width - 20;
        } else {
            ladderX = lower.x + 8;
        }
        ladderX = Math.max(lower.x + 4, Math.min(ladderX, lower.x + lower.width - 20));
        this.addLadder(layout, lower, upper, ladderX);
    }

    finalizeLayout(layout, platforms, platformHeight) {
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        layout.ladders = [];
        for (let i = 0; i < platforms.length - 1; i++) {
            this.autoLadder(layout, platforms[i], platforms[i + 1]);
        }
        layout.platforms.push({
            x: 0,
            y: this.height - 20,
            width: this.width,
            height: 20,
            isGround: true
        });
        return layout;
    }

    getTopPlayablePlatform() {
        const playable = this.platforms.filter(p => p.type !== 'ground');
        if (!playable.length) return null;
        return playable.reduce((top, p) => (p.y < top.y ? p : top));
    }

    placeParadiseGoal(platform) {
        if (!platform) return;
        this.retirementGoal.x = platform.x + platform.width / 2 - this.retirementGoal.width / 2;
        this.retirementGoal.y = platform.y - this.retirementGoal.height - 8;
    }

    createZigzagPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 50, width: 260, y: startY },
            { x: this.width - 310, width: 260, y: startY - spacing },
            { x: 50, width: 240, y: startY - spacing * 2 },
            { x: this.width - 290, width: 240, y: startY - spacing * 3 },
            { x: 50, width: 220, y: startY - spacing * 4 },
            { x: this.width - 270, width: 220, y: startY - spacing * 5 },
            { x: this.width / 2 - 110, width: 220, y: startY - spacing * 6 }
        ];
        return this.finalizeLayout(layout, platforms, platformHeight);
    }

    createAlternatingSidesPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 40, width: 280, y: startY },
            { x: this.width / 2 - 140, width: 280, y: startY - spacing },
            { x: 40, width: 260, y: startY - spacing * 2 },
            { x: this.width - 300, width: 260, y: startY - spacing * 3 },
            { x: this.width / 2 - 130, width: 240, y: startY - spacing * 4 },
            { x: 40, width: 240, y: startY - spacing * 5 },
            { x: this.width / 2 - 100, width: 220, y: startY - spacing * 6 }
        ];
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    // Pattern 3: Spiral with connecting platforms
    createSpiralPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 400, y: startY }, // Very wide
            { x: 30, width: 350, y: startY - spacing }, // Overlaps
            { x: this.width - 380, width: 350, y: startY - spacing * 2 }, // Reaches center
            { x: this.width - 380, width: 280, y: startY - spacing * 3 }, // Shrinks but still connects
            { x: this.width / 2 - 140, width: 280, y: startY - spacing * 4 }, // Center
            { x: this.width / 2 - 100, width: 200, y: startY - spacing * 5 }, // Narrower
            { x: this.width - 250, width: 230, y: startY - spacing * 6 } // Goal
        ];
        
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    // Pattern 4: Left-right-left with wide overlapping platforms
    createLeftRightPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 380, y: startY }, // Very wide
            { x: this.width - 410, width: 380, y: startY - spacing }, // Overlaps significantly
            { x: 30, width: 380, y: startY - spacing * 2 }, // Back to left
            { x: this.width - 410, width: 380, y: startY - spacing * 3 }, // Right again
            { x: 30, width: 360, y: startY - spacing * 4 }, // Slightly narrower
            { x: this.width - 390, width: 360, y: startY - spacing * 5 }, // Overlaps
            { x: this.width - 320, width: 300, y: startY - spacing * 6 } // Goal
        ];
        
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    // Pattern 5: Center with branches - wide platforms that connect
    createCenterBranchesPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const centerX = this.width / 2 - 150;
        const platforms = [
            { x: 30, width: 300, y: startY }, // Wide left
            { x: centerX, width: 300, y: startY - spacing }, // Wide center - overlaps
            { x: 30, width: 280, y: startY - spacing * 2 }, // Left branch
            { x: centerX, width: 300, y: startY - spacing * 3 }, // Center again
            { x: this.width - 310, width: 280, y: startY - spacing * 4 }, // Right branch
            { x: centerX, width: 300, y: startY - spacing * 5 }, // Center
            { x: this.width - 300, width: 280, y: startY - spacing * 6 } // Goal
        ];
        
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    // Pattern 6: Snake with wide overlapping platforms
    createSnakePattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 250, y: startY }, // Wide
            { x: 120, width: 250, y: startY - spacing }, // Overlaps
            { x: 240, width: 250, y: startY - spacing * 2 }, // Further right
            { x: 120, width: 250, y: startY - spacing * 3 }, // Back left
            { x: 30, width: 250, y: startY - spacing * 4 }, // Far left
            { x: 240, width: 250, y: startY - spacing * 5 }, // Right
            { x: this.width - 280, width: 260, y: startY - spacing * 6 } // Goal
        ];
        
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    // Pattern 7: Double column with connecting platforms
    createDoubleColumnPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const leftX = 40;
        const rightX = this.width - 310;
        const platforms = [
            { x: leftX, width: 300, y: startY }, // Wide left
            { x: rightX, width: 300, y: startY - spacing }, // Wide right - overlaps
            { x: leftX, width: 300, y: startY - spacing * 2 }, // Left again
            { x: rightX, width: 300, y: startY - spacing * 3 }, // Right
            { x: leftX, width: 300, y: startY - spacing * 4 }, // Left
            { x: rightX, width: 300, y: startY - spacing * 5 }, // Right
            { x: this.width - 280, width: 260, y: startY - spacing * 6 } // Goal
        ];
        
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    // Pattern 8: Mixed with wide connecting platforms
    createMixedPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 350, y: startY }, // Very wide
            { x: this.width / 2 - 175, width: 350, y: startY - spacing }, // Overlaps center
            { x: 30, width: 300, y: startY - spacing * 2 }, // Left
            { x: this.width - 330, width: 300, y: startY - spacing * 3 }, // Right - overlaps
            { x: this.width / 2 - 150, width: 300, y: startY - spacing * 4 }, // Center
            { x: 30, width: 320, y: startY - spacing * 5 }, // Left
            { x: this.width - 300, width: 280, y: startY - spacing * 6 } // Goal
        ];
        
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    // Pattern 9: Zigzag with gaps but still connecting
    createGapZigzagPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 320, y: startY }, // Wide enough to connect
            { x: this.width - 350, width: 320, y: startY - spacing }, // Overlaps
            { x: 30, width: 280, y: startY - spacing * 2 }, // Still wide
            { x: this.width - 310, width: 280, y: startY - spacing * 3 }, // Overlaps
            { x: 30, width: 300, y: startY - spacing * 4 }, // Wide
            { x: this.width - 330, width: 300, y: startY - spacing * 5 }, // Overlaps
            { x: this.width - 280, width: 260, y: startY - spacing * 6 } // Goal
        ];
        
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    // Pattern 10: Complex spiral with connecting platforms
    createComplexSpiralPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 380, y: startY }, // Very wide
            { x: 60, width: 340, y: startY - spacing }, // Slightly narrower but still wide
            { x: this.width - 400, width: 340, y: startY - spacing * 2 }, // Right side - overlaps
            { x: this.width - 370, width: 300, y: startY - spacing * 3 }, // Shrinks but connects
            { x: this.width / 2 - 150, width: 300, y: startY - spacing * 4 }, // Center
            { x: this.width / 2 - 120, width: 240, y: startY - spacing * 5 }, // Narrower
            { x: this.width - 260, width: 240, y: startY - spacing * 6 } // Goal
        ];
        
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    // Vary an existing layout for difficulty scaling
    varyLayout(baseLayout, level, variation, startY, platformHeight) {
        // Create a deep copy
        const layout = {
            platforms: baseLayout.platforms.map(p => ({ ...p })),
            ladders: baseLayout.ladders.map(l => ({ ...l }))
        };
        
        // Adjust platform widths based on level difficulty
        const widthAdjust = Math.min(level * 2, 24);
        for (const platform of layout.platforms) {
            if (platform.isGround || platform.y >= this.height - 25) continue;
            platform.width = Math.max(120, platform.width - widthAdjust);
        }
        
        if (variation > 0) {
            const playable = layout.platforms.filter(p => !p.isGround && p.y < this.height - 25);
            layout.ladders = [];
            for (let i = 0; i < playable.length - 1; i++) {
                this.autoLadder(layout, playable[i], playable[i + 1]);
            }
        }
        
        return layout;
    }

    createTightGapsPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 300, y: startY },
            { x: this.width - 330, width: 280, y: startY - spacing },
            { x: 30, width: 260, y: startY - spacing * 2 },
            { x: this.width - 290, width: 260, y: startY - spacing * 3 },
            { x: 30, width: 240, y: startY - spacing * 4 },
            { x: this.width - 270, width: 240, y: startY - spacing * 5 },
            { x: this.width / 2 - 110, width: 220, y: startY - spacing * 6 }
        ];
        return this.finalizeLayout(layout, platforms, platformHeight);
    }

    createDKClassicPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 40, width: 240, y: startY },
            { x: this.width - 280, width: 220, y: startY - spacing },
            { x: 40, width: 200, y: startY - spacing * 2 },
            { x: this.width - 260, width: 200, y: startY - spacing * 3 },
            { x: 80, width: 180, y: startY - spacing * 4 },
            { x: this.width - 260, width: 180, y: startY - spacing * 5 },
            { x: this.width / 2 - 90, width: 180, y: startY - spacing * 6 }
        ];
        return this.finalizeLayout(layout, platforms, platformHeight);
    }

    createStaggeredRungsPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 340, y: startY },
            { x: this.width - 370, width: 340, y: startY - spacing },
            { x: 30, width: 320, y: startY - spacing * 2 },
            { x: this.width - 350, width: 320, y: startY - spacing * 3 },
            { x: 30, width: 300, y: startY - spacing * 4 },
            { x: this.width - 330, width: 300, y: startY - spacing * 5 },
            { x: this.width / 2 - 130, width: 260, y: startY - spacing * 6 }
        ];
        return this.finalizeLayout(layout, platforms, platformHeight);
    }

    createNarrowBridgePattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 280, y: startY },
            { x: 180, width: 220, y: startY - spacing },
            { x: 330, width: 220, y: startY - spacing * 2 },
            { x: 180, width: 220, y: startY - spacing * 3 },
            { x: 30, width: 240, y: startY - spacing * 4 },
            { x: 200, width: 240, y: startY - spacing * 5 },
            { x: this.width / 2 - 110, width: 220, y: startY - spacing * 6 }
        ];
        return this.finalizeLayout(layout, platforms, platformHeight);
    }

    createFinalClimbPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = this.platformSpacing;
        const platforms = [
            { x: 30, width: 300, y: startY },
            { x: 200, width: 280, y: startY - spacing },
            { x: 30, width: 260, y: startY - spacing * 2 },
            { x: 200, width: 260, y: startY - spacing * 3 },
            { x: 30, width: 240, y: startY - spacing * 4 },
            { x: 200, width: 240, y: startY - spacing * 5 },
            { x: this.width / 2 - 120, width: 240, y: startY - spacing * 6 }
        ];
        return this.finalizeLayout(layout, platforms, platformHeight);
    }
    
    generateLevel() {
        // Clear existing level elements
        this.platforms = [];
        this.ladders = [];
        this.moneyBags = [];
        this.powerUps = [];
        
        // Use pre-designed layout
        const layoutIndex = Math.min(this.level - 1, this.levelLayouts.length - 1);
        const layout = this.levelLayouts[layoutIndex];
        
        // Copy platforms and ladders — tag full-width floor as ground
        this.platforms = layout.platforms.map((p) => ({
            ...p,
            type: (p.isGround || (p.y >= this.height - 25 && p.width >= this.width - 1)) ? 'ground' : 'platform'
        }));
        this.ladders = layout.ladders.map(l => ({ ...l }));
        
        // Scale difficulty
        const difficultyMultiplier = 1 + (this.level - 1) * 0.12;
        this.oligarch.speed = Math.min(1.6, this.oligarch.baseSpeed * difficultyMultiplier);
        this.oligarch.throwingInterval = Math.max(
            900,
            this.oligarch.baseThrowingInterval - (this.level - 1) * 120
        );
        
        // Spawn power-ups (more in later levels)
        const powerUpCount = Math.min(2 + Math.floor(this.level / 5), 5);
        const usedPositions = [];
        
        for (let i = 0; i < powerUpCount; i++) {
            // Find a platform to place power-up on
            let platform;
            let attempts = 0;
            const playable = this.platforms.filter(p => p.type !== 'ground');
            do {
                platform = playable[Math.floor(Math.random() * playable.length)];
                attempts++;
            } while ((usedPositions.some(p => Math.abs(p.x - platform.x) < 50) || platform.y > this.height - 100) && attempts < 20);
            
            if (platform && platform.y < this.height - 100) {
                const powerUpType = Object.keys(this.powerUpTypes)[
                    Math.floor(Math.random() * Object.keys(this.powerUpTypes).length)
                ];
                
                this.powerUps.push({
                    x: platform.x + platform.width / 2 - 8,
                    y: platform.y - 16,
                    width: 16,
                    height: 16,
                    type: powerUpType,
                    animTimer: 0,
                    animFrame: 0,
                    floatOffset: Math.random() * Math.PI * 2
                });
                
                usedPositions.push({ x: platform.x, y: platform.y });
            }
        }
        
        // Position player on the ground floor
        const ground = this.platforms.find(p => p.type === 'ground');
        this.player.x = 60;
        this.player.y = ground ? ground.y - this.player.height : this.height - 100;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onGround = true;
        this.player.onLadder = false;
        this.player.climbing = false;
        this.player.speed = this.player.baseSpeed;
        this.jumpCooldownMs = 0;
        this.jumpBufferMs = 0;
        
        const topPlatform = this.getTopPlayablePlatform();
        this.placeParadiseGoal(topPlatform);

        // Boss patrols the top girder near Paradise
        if (topPlatform) {
            this.oligarch.x = topPlatform.x + topPlatform.width / 2 - this.oligarch.width / 2;
            this.oligarch.y = topPlatform.y - this.oligarch.height - 8;
            this.oligarch.patrolMin = topPlatform.x + 8;
            this.oligarch.patrolMax = topPlatform.x + topPlatform.width - this.oligarch.width - 8;
        } else {
            this.oligarch.x = this.width - 100;
            this.oligarch.y = 50;
            this.oligarch.patrolMin = 50;
            this.oligarch.patrolMax = this.width - 90;
        }
        this.oligarch.direction = 1;
        this.oligarch.lastEdge = null;
        this.oligarch.throwingTimer = this.oligarch.throwingInterval * 0.45;
        this.oligarch.waveThrowsRemaining = 0;
        this.oligarch.waveThrowDelay = 0;
        this.moneyBags = [];
        
        // Clear trail
        if (this.playerTrail && typeof this.playerTrail.clear === 'function') {
            this.playerTrail.clear();
        }
        if (!this.isPreview) {
            this.playerTrailSprites = [];
        }
    }
    
    setupInput() {
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
            
            if (e.code === 'Space' && this.gameState === 'menu') {
                this.startGame();
            }
            
            if (e.code === 'KeyP' && this.gameState === 'playing') {
                this.togglePause();
            }
            
            if (e.code === 'Space' && this.gameState === 'playing') {
                this.jumpBufferMs = 140;
            }
            
            if (e.code === 'Space' && this.gameState === 'gameOver') {
                this.restartGame();
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
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.generateLevel();
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('working-man', 'start');
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
        
        // Apply slow time effect
        const timeScale = this.activePowerUps.slowTime ? 0.5 : 1.0;
        const scaledDelta = deltaTime * timeScale;
        
        this.updatePlayer(scaledDelta);
        this.updateOligarch(scaledDelta);
        this.updateMoneyBags(scaledDelta);
        this.updatePowerUps(scaledDelta);
        this.updateCollisions();
        this.updatePowerUpTimers();
        this.updateEffects();
        
        // Check win condition (reach Paradise at the top)
        if (this.checkCollision(this.player, this.retirementGoal)) {
            this.levelUp();
        }
        
        // Check lose condition (fall off screen)
        if (this.player.y > this.height) {
            this.loseLife();
        }
        
        // Check game completion
        if (this.level > this.maxLevel) {
            this.gameComplete();
        }
    }
    
    updatePlayer(deltaTime) {
        // Update power-up effects
        if (this.activePowerUps.speed) {
            this.player.speed = this.player.baseSpeed * 1.25;
        } else {
            this.player.speed = this.player.baseSpeed;
        }
        
        // Check for horizontal input FIRST
        const horizontalInput = (this.keys['ArrowLeft'] || this.keys['KeyA'] || 
                                 this.keys['ArrowRight'] || this.keys['KeyD']);
        const verticalInput = (this.keys['ArrowUp'] || this.keys['KeyW'] || 
                               this.keys['ArrowDown'] || this.keys['KeyS']);
        
        // Store previous state
        const wasOnLadder = this.player.onLadder;
        const wasClimbing = this.player.climbing;
        
        // Check if player is at ladder top (for jumping off)
        this.player.atLadderTop = false;
        for (let ladder of this.ladders) {
            const ladderCenterX = ladder.x + ladder.width / 2;
            const playerCenterX = this.player.x + this.player.width / 2;
            const distanceFromCenter = Math.abs(playerCenterX - ladderCenterX);
            const playerTop = this.player.y;
            const ladderTop = ladder.y;
            
            if (distanceFromCenter <= 8 && playerTop <= ladderTop + 10 && playerTop >= ladderTop - 5) {
                this.player.atLadderTop = true;
                break;
            }
        }
        
        // Reset ladder state - will be set if we're actually on a ladder
        this.player.onLadder = false;
        this.player.climbing = false;
        
        // Check if player is on a ladder (collision check)
        let foundLadder = false;
        let currentLadder = null;
        
        for (let ladder of this.ladders) {
            const ladderCenterX = ladder.x + ladder.width / 2;
            const playerCenterX = this.player.x + this.player.width / 2;
            const distanceFromCenter = Math.abs(playerCenterX - ladderCenterX);
            
            // Ladder bounds: from ladder.y (top) to ladder.y + ladder.height (bottom)
            const ladderTop = ladder.y;
            const ladderBottom = ladder.y + ladder.height;
            
            // Check if player is within ladder horizontal bounds (within 6 pixels of center)
            // AND within ladder vertical bounds
            const playerTop = this.player.y;
            const playerBottom = this.player.y + this.player.height;
            
            if (distanceFromCenter <= 6 &&
                playerBottom > ladderTop &&
                playerTop < ladderBottom) {
                
                foundLadder = true;
                currentLadder = ladder;
                break;
            }
        }
        
        // CRITICAL FIX: If horizontal input is pressed, NEVER allow ladder state
        if (foundLadder && !horizontalInput) {
            // Player is on ladder AND not pressing horizontal keys
            const ladder = currentLadder;
            const ladderCenterX = ladder.x + ladder.width / 2;
            const ladderTop = ladder.y;
            const ladderBottom = ladder.y + ladder.height;
            const playerTop = this.player.y;
            const playerBottom = this.player.y + this.player.height;
            
            // More lenient bounds - allow climbing to very top/bottom
            const atLadderTop = playerTop <= ladderTop + 8; // Very lenient to allow exit
            const atLadderBottom = playerBottom >= ladderBottom - 5; // More lenient (was 2)
            
            // Only allow climbing with vertical input ONLY
            if (verticalInput) {
                if ((this.keys['ArrowUp'] || this.keys['KeyW'])) {
                    if (!atLadderTop) {
                        // Climbing up
                        this.player.onLadder = true;
                        this.player.climbing = true;
                        this.player.vy = -this.player.speed * 0.95;
                        this.player.vx = 0;
                        this.player.x = ladderCenterX - this.player.width / 2;
                        
                        // Allow climbing to the very top of the ladder (platform bottom)
                        if (this.player.y <= ladderTop) {
                            this.player.y = ladderTop;
                            this.player.vy = 0;
                            // Exit ladder immediately when reaching top
                            this.player.onLadder = false;
                            this.player.climbing = false;
                            // Set flag to allow jumping
                            this.player.atLadderTop = true;
                        }
                    } else {
                        // At top - EXIT ladder immediately to allow jumping/moving
                        this.player.onLadder = false;
                        this.player.climbing = false;
                        // Position player at ladder top (platform bottom)
                        this.player.x = ladderCenterX - this.player.width / 2;
                        this.player.y = ladderTop;
                        // Set flag so jump can work
                        this.player.atLadderTop = true;
                    }
                } else if ((this.keys['ArrowDown'] || this.keys['KeyS'])) {
                    if (!atLadderBottom) {
                        // Climbing down
                        this.player.onLadder = true;
                        this.player.climbing = true;
                        this.player.vy = this.player.speed * 0.95;
                        this.player.vx = 0;
                        this.player.x = ladderCenterX - this.player.width / 2;
                        
                        // Clamp to bottom
                        if (this.player.y + this.player.height > ladderBottom) {
                            this.player.y = ladderBottom - this.player.height;
                            this.player.vy = 0;
                            this.player.onLadder = false;
                            this.player.climbing = false;
                        }
                    } else {
                        // At bottom - exit ladder state
                        this.player.climbing = false;
                        this.player.onLadder = false;
                    }
                } else if (wasOnLadder) {
                    // On ladder but at top/bottom - hold position
                    this.player.onLadder = true;
                    this.player.vy = 0;
                    this.player.vx = 0;
                    this.player.x = ladderCenterX - this.player.width / 2;
                }
            } else if (wasOnLadder) {
                // On ladder but no input - hold position
                this.player.onLadder = true;
                this.player.vy = 0;
                this.player.vx = 0;
                this.player.x = ladderCenterX - this.player.width / 2;
                
                // Clamp position
                if (this.player.y < ladderTop) {
                    this.player.y = ladderTop;
                    this.player.onLadder = false;
                } else if (this.player.y + this.player.height > ladderBottom) {
                    this.player.y = ladderBottom - this.player.height;
                    this.player.onLadder = false;
                }
            }
        }
        
        const dt = deltaTime / 16.67;
        
        if (!this.player.onLadder && !this.player.climbing) {
            const airControl = this.player.onGround ? 1 : 0.32;
            const targetVx = (this.keys['ArrowLeft'] || this.keys['KeyA']) ? -this.player.speed :
                (this.keys['ArrowRight'] || this.keys['KeyD']) ? this.player.speed : 0;
            if (targetVx !== 0) {
                this.player.vx += (targetVx - this.player.vx) * this.player.accel * dt * 2 * airControl;
                this.player.direction = targetVx > 0 ? 1 : -1;
            } else {
                this.player.vx *= Math.pow(this.friction, dt);
            }
        } else {
            this.player.vx = 0;
        }
        
        this.jumpCooldownMs = Math.max(0, this.jumpCooldownMs - deltaTime);
        this.jumpBufferMs = Math.max(0, this.jumpBufferMs - deltaTime);
        const canJump = this.jumpCooldownMs <= 0;
        const upJump = (this.keys['ArrowUp'] || this.keys['KeyW']) && !foundLadder && !wasOnLadder;
        const jumpRequested = this.jumpBufferMs > 0 || upJump;
        const groundJump = jumpRequested && !this.player.climbing && canJump &&
            (this.player.onGround || this.coyoteFrames > 0);
        const ladderJump = (this.keys['ArrowUp'] || this.keys['KeyW']) && !this.player.climbing && canJump &&
            (this.player.atLadderTop || (wasOnLadder && !this.player.onLadder && !this.player.onGround));
        if (groundJump) {
            this.player.vy = -this.player.jumpPower;
            this.player.onGround = false;
            this.coyoteFrames = 0;
            this.jumpBufferMs = 0;
            this.jumpCooldownMs = 320;
            if (typeof audioManager !== 'undefined') audioManager.playGameSfx('working-man', 'jump');
        } else if (ladderJump) {
            this.player.vy = -this.player.jumpPower * 0.8;
            this.player.onLadder = false;
            this.player.climbing = false;
            this.player.atLadderTop = false;
            this.jumpCooldownMs = 360;
            if (typeof audioManager !== 'undefined') audioManager.playGameSfx('working-man', 'jump');
        }
        
        // Apply gravity - CRITICAL: always apply if not actively climbing
        // If horizontal input is pressed while on ladder, force exit and apply gravity
        if (horizontalInput && wasOnLadder) {
            // Force exit ladder if horizontal key is pressed
            this.player.onLadder = false;
            this.player.climbing = false;
        }
        
        if (!this.player.climbing && !this.player.onLadder) {
            this.player.vy += this.gravity * dt;
            this.player.vy = Math.min(this.player.vy, this.maxFallSpeed);
        } else if (this.player.climbing && !this.player.onLadder) {
            this.player.vy += this.gravity * dt;
            this.player.climbing = false;
        }
        
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;
        
        if (this.player.onGround) {
            this.coyoteFrames = 3;
        } else if (this.coyoteFrames > 0) {
            this.coyoteFrames--;
        }
        if (this.player.onGround && !this.wasOnGround && typeof audioManager !== 'undefined') {
            audioManager.playGameSfx('working-man', 'land');
        }
        this.wasOnGround = this.player.onGround;
        
        // Keep player on screen
        this.player.x = Math.max(0, Math.min(this.width - this.player.width, this.player.x));
        
        // Add to motion trail
        if (this.playerTrail && typeof this.playerTrail.addPoint === 'function') {
            if (Math.abs(this.player.vx) > 0.1 || Math.abs(this.player.vy) > 0.1) {
                this.playerTrail.addPoint(
                    this.player.x + this.player.width / 2,
                    this.player.y + this.player.height / 2,
                    this.player.invincible ? '#ffff00' : '#00ffff',
                    3
                );
            }
        }
        
        // Update invincibility
        if (this.player.invincible) {
            this.player.invincibleTimer--;
            if (this.player.invincibleTimer <= 0) {
                this.player.invincible = false;
            }
        }
        
        // Animation
        this.player.animTimer += deltaTime;
        if (this.player.animTimer > 200) {
            this.player.animFrame = (this.player.animFrame + 1) % 4;
            this.player.animTimer = 0;
        }
    }
    
    updateOligarch(deltaTime) {
        const dt = deltaTime / 16.67;
        this.oligarch.vx = this.oligarch.speed * this.oligarch.direction;
        this.oligarch.x += this.oligarch.vx * dt;

        const minX = this.oligarch.patrolMin ?? 50;
        const maxX = this.oligarch.patrolMax ?? this.width - 90;

        if (this.oligarch.x <= minX) {
            this.oligarch.direction = 1;
            this.oligarch.x = minX;
            if (this.oligarch.lastEdge !== 'left') {
                this.oligarch.lastEdge = 'left';
                this.queueThrow();
            }
        } else if (this.oligarch.x >= maxX) {
            this.oligarch.direction = -1;
            this.oligarch.x = maxX;
            if (this.oligarch.lastEdge !== 'right') {
                this.oligarch.lastEdge = 'right';
                this.queueThrow();
            }
        }

        this.oligarch.throwingTimer += deltaTime;
        if (this.oligarch.throwingTimer >= this.oligarch.throwingInterval) {
            this.oligarch.throwingTimer = 0;
            this.queueThrow();
        }

        if (this.oligarch.waveThrowDelay > 0) {
            this.oligarch.waveThrowDelay -= deltaTime;
            if (this.oligarch.waveThrowDelay <= 0 && this.oligarch.waveThrowsRemaining > 0) {
                this.throwMoneyBag();
                this.oligarch.waveThrowsRemaining--;
                if (this.oligarch.waveThrowsRemaining > 0) {
                    this.oligarch.waveThrowDelay = 350;
                }
            }
        } else if (this.oligarch.waveThrowsRemaining > 0) {
            this.throwMoneyBag();
            this.oligarch.waveThrowsRemaining--;
            if (this.oligarch.waveThrowsRemaining > 0) {
                this.oligarch.waveThrowDelay = 350;
            }
        }

        this.oligarch.animTimer += deltaTime;
        if (this.oligarch.animTimer > 300) {
            this.oligarch.animFrame = (this.oligarch.animFrame + 1) % 2;
            this.oligarch.animTimer = 0;
        }
    }

    queueThrow() {
        let waveCount = 1;
        if (this.level >= 10) waveCount = 3;
        else if (this.level >= 5) waveCount = 2;
        this.oligarch.waveThrowsRemaining += waveCount;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('working-man', 'throw');
    }

    throwMoneyBag() {
        const speedMultiplier = 1 + (this.level - 1) * 0.1;
        const rollDir = this.oligarch.direction > 0 ? 1 : -1;
        const vx = rollDir * (1.4 + speedMultiplier * 0.35);
        const vy = 2.8 + speedMultiplier * 0.45;

        this.moneyBags.push({
            x: this.oligarch.x + this.oligarch.width / 2 - 10,
            y: this.oligarch.y + this.oligarch.height - 4,
            width: 20,
            height: 16,
            vx: vx,
            vy: vy,
            rotation: 0,
            onPlatform: false,
            animFrame: 0
        });
    }
    
    updateMoneyBags(deltaTime) {
        const timeScale = this.activePowerUps.slowTime ? 0.5 : 1.0;
        
        for (let i = this.moneyBags.length - 1; i >= 0; i--) {
            const moneyBag = this.moneyBags[i];
            
            // Apply gravity
            moneyBag.vy += this.gravity * timeScale * (deltaTime / 16.67);
            moneyBag.x += moneyBag.vx * timeScale * (deltaTime / 16.67);
            moneyBag.y += moneyBag.vy * timeScale * (deltaTime / 16.67);
            moneyBag.rotation += 0.2 * timeScale;
            
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
                    if (platform.type === 'ground') {
                        moneyBag.vx = 2 * (moneyBag.vx > 0 ? 1 : -1);
                    } else {
                        const speedMultiplier = 1 + (this.level - 1) * 0.08;
                        moneyBag.vx = 1.8 * speedMultiplier * (moneyBag.vx > 0 ? 1 : -1);
                    }
                }
            }
        }
    }
    
    updatePowerUps(deltaTime) {
        for (let powerUp of this.powerUps) {
            // Floating animation
            powerUp.floatOffset += 0.05;
            powerUp.animTimer += deltaTime;
            
            if (powerUp.animTimer > 300) {
                powerUp.animFrame = (powerUp.animFrame + 1) % 2;
                powerUp.animTimer = 0;
            }
        }
    }
    
    updateCollisions() {
        // Player platform collisions
        this.player.onGround = false;
        
        for (let platform of this.platforms) {
            if (this.checkCollision(this.player, platform)) {
                if (this.player.vy >= 0 || this.player.onLadder || this.player.climbing) {
                    // Falling onto platform OR coming from ladder
                    const platformTop = platform.y;
                    const playerBottom = this.player.y + this.player.height;
                    
                    // If player is coming from ladder (at top of ladder), allow walking onto platform
                    if (this.player.onLadder || this.player.climbing || this.player.atLadderTop) {
                        // Check if player is at the top edge of platform (from ladder)
                        if (playerBottom >= platformTop - 5 && playerBottom <= platformTop + 15) {
                            // Allow walking onto platform from ladder
                            this.player.y = platformTop - this.player.height;
                    this.player.vy = 0;
                    this.player.onGround = true;
                            this.player.climbing = false;
                            this.player.onLadder = false;
                            this.player.atLadderTop = false;
                        }
                    } else {
                        // Standing on or landing on platform
                        this.player.y = platformTop - this.player.height;
                        this.player.vy = 0;
                        this.player.onGround = true;
                    }
                }
            }
        }
        
        // Player money bag collisions
        if (!this.player.invincible) {
        for (let i = this.moneyBags.length - 1; i >= 0; i--) {
            const moneyBag = this.moneyBags[i];
            if (this.checkCollision(this.player, moneyBag)) {
                this.loseLife();
                    if (this.particles && typeof this.particles.explode === 'function') {
                        this.particles.explode(moneyBag.x + moneyBag.width/2, moneyBag.y + moneyBag.height/2, 10, '#ff0000');
                    }
                this.moneyBags.splice(i, 1);
                break;
                }
            }
        }
        
        // Player power-up collisions
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            if (this.checkCollision(this.player, powerUp)) {
                this.collectPowerUp(powerUp);
                this.powerUps.splice(i, 1);
                break;
            }
        }
    }
    
    collectPowerUp(powerUp) {
        const powerUpData = this.powerUpTypes[powerUp.type];
        
        this.score += 200;
        if (this.screenEffects && typeof this.screenEffects.flash === 'function') {
            this.screenEffects.flash(powerUpData.color, 10, 0.5);
        }
        if (this.particles && typeof this.particles.glowExplosion === 'function') {
            this.particles.glowExplosion(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2, 20, powerUpData.color);
        }
        
        switch (powerUp.type) {
            case 'SPEED_BOOST':
                this.activePowerUps.speed = true;
                this.powerUpTimers.speed = powerUpData.duration;
                break;
            case 'INVINCIBILITY':
                this.activePowerUps.invincible = true;
                this.powerUpTimers.invincible = powerUpData.duration;
                this.player.invincible = true;
                this.player.invincibleTimer = powerUpData.duration;
                break;
            case 'EXTRA_LIFE':
                this.lives++;
                if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
                    this.screenEffects.shake(3, 5);
                }
                break;
            case 'SLOW_TIME':
                this.activePowerUps.slowTime = true;
                this.powerUpTimers.slowTime = powerUpData.duration;
                break;
        }
    }
    
    updatePowerUpTimers() {
        // Update timers
        if (this.powerUpTimers.speed > 0) {
            this.powerUpTimers.speed--;
            if (this.powerUpTimers.speed <= 0) {
                this.activePowerUps.speed = false;
            }
        }
        
        if (this.powerUpTimers.invincible > 0) {
            this.powerUpTimers.invincible--;
            if (this.powerUpTimers.invincible <= 0) {
                this.activePowerUps.invincible = false;
                this.player.invincible = false;
            }
        }
        
        if (this.powerUpTimers.slowTime > 0) {
            this.powerUpTimers.slowTime--;
            if (this.powerUpTimers.slowTime <= 0) {
                this.activePowerUps.slowTime = false;
            }
        }
    }
    
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    updateEffects() {
        if (this.isPreview) {
            if (this.particles) this.particles.update();
            if (this.screenEffects) this.screenEffects.update();
            if (this.playerTrail) this.playerTrail.update();
        } else {
            if (this.nesEffects && typeof this.nesEffects.update === 'function') {
                this.nesEffects.update();
            }
        }
        this.tweenManager.update(performance.now());
    }
    
    levelUp() {
        if (this.level < this.maxLevel) {
        this.level++;
            this.score += 1000 * this.level;
            if (this.screenEffects) {
                if (typeof this.screenEffects.flash === 'function') {
                    this.screenEffects.flash('#00ff00', 15, 0.4);
                }
                if (typeof this.screenEffects.ripple === 'function') {
                    this.screenEffects.ripple(this.retirementGoal.x + this.retirementGoal.width/2, 
                                         this.retirementGoal.y + this.retirementGoal.height/2, 200);
                }
            }
            if (this.particles && typeof this.particles.glowExplosion === 'function') {
                this.particles.glowExplosion(this.retirementGoal.x + this.retirementGoal.width/2,
                                            this.retirementGoal.y + this.retirementGoal.height/2,
                                            30, '#00ff00');
            }
        this.generateLevel();
        if (!this.isPreview) {
            this.initSprites(); // Refresh sprites after level generation
        }
        } else {
            this.gameComplete();
        }
    }
    
    gameComplete() {
        this.gameState = 'complete';
        this.score += 5000; // Bonus for completion
        if (this.screenEffects && typeof this.screenEffects.flash === 'function') {
            this.screenEffects.flash('#ffd700', 30, 0.6);
        }
        
        if (highScoreManager.checkHighScore('working-man', this.score)) {
            highScoreManager.requestNameEntry('working-man', this.score);
        }
    }
    
    loseLife() {
        if (this.player.invincible) return;
        
        this.lives--;
        if (this.screenEffects) {
            if (typeof this.screenEffects.shake === 'function') {
                this.screenEffects.shake(8, 15);
            }
            if (typeof this.screenEffects.flash === 'function') {
                this.screenEffects.flash('#ff0000', 10, 0.5);
            }
        }
        if (this.particles) {
            if (typeof this.particles.explode === 'function') {
                this.particles.explode(this.player.x + this.player.width/2, this.player.y + this.player.height/2, 15, '#ff0000');
            }
            if (typeof this.particles.sparkBurst === 'function') {
                this.particles.sparkBurst(this.player.x + this.player.width/2, this.player.y + this.player.height/2, 10, '#ff6600');
            }
        }
        
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            // Reset player position with brief invincibility
            this.player.x = 50;
            this.player.y = this.height - 100;
            this.player.vx = 0;
            this.player.vy = 0;
            this.player.invincible = true;
            this.player.invincibleTimer = 120; // 2 seconds of invincibility
            if (this.playerTrail && typeof this.playerTrail.clear === 'function') {
                this.playerTrail.clear();
            }
            if (!this.isPreview) {
                this.playerTrailSprites = []; // Clear trail sprites
            }
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('working-man', 'death');

        // Check for high score
        if (highScoreManager.checkHighScore('working-man', this.score)) {
            highScoreManager.requestNameEntry('working-man', this.score);
        }
    }
    
    gameLoop(currentTime = 0) {
        let deltaTime;
        if (this.isPreview) {
            if (this.lastTime === 0) {
                this.lastTime = currentTime;
                deltaTime = 16.67;
            } else {
                deltaTime = currentTime - this.lastTime;
                this.lastTime = currentTime;
            }
        } else {
            deltaTime = currentTime || 16.67;
        }
        
        this.update(deltaTime);
        
        if (this.isPreview) {
            this.draw();
            requestAnimationFrame((time) => this.gameLoop(time));
        } else {
            this.drawPixi();
        }
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
        
        // Draw background
        const bg = new PIXI.Graphics();
        bg.beginFill(0x1a1a2e, 1);
        bg.drawRect(0, 0, this.width, this.height);
        bg.endFill();
        bgLayer.addChild(bg);
        
        if (this.gameState === 'playing') {
            // Draw platforms
            this.drawPlatformsPixi(fgLayer);
            
            // Draw ladders
            this.drawLaddersPixi(fgLayer);
            
            // Draw retirement goal
            this.drawRetirementGoalPixi(fgLayer);
            
            // Draw power-ups
            this.drawPowerUpsPixi(fgLayer);
            
            // Draw money bags
            this.drawMoneyBagsPixi(fgLayer);
            
            // Draw player trail
            this.drawPlayerTrailPixi(fgLayer);
            
            // Draw oligarch
            this.drawOligarchPixi(fgLayer);
            
            // Draw player
            this.drawPlayerPixi(fgLayer);
        } else if (this.gameState === 'menu') {
            this.drawPlatformsPixi(fgLayer);
            this.drawLaddersPixi(fgLayer);
            this.drawRetirementGoalPixi(fgLayer);
            this.drawPlayerPixi(fgLayer);
            this.drawOligarchPixi(fgLayer);
        }
        
        // Draw UI
        this.drawUIPixi(uiLayer);
        
        // Draw game state messages
        this.drawGameStatePixi(uiLayer);
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
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Apply screen effects transform
        let transform = { x: 0, y: 0, scale: 1 };
        if (this.screenEffects && typeof this.screenEffects.getTransform === 'function') {
            transform = this.screenEffects.getTransform();
        }
        this.ctx.save();
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(transform.scale, transform.scale);
        this.ctx.translate(-this.width / 2 + transform.x, -this.height / 2 + transform.y);
        
        // Only draw game elements when playing
        if (this.gameState === 'playing') {
            // Draw platforms
            this.drawPlatforms();
            
            // Draw ladders
            this.drawLadders();
            
            // Draw retirement goal
            this.drawRetirementGoal();
            
            // Draw power-ups
            this.drawPowerUps();
            
            // Draw money bags
            this.drawMoneyBags();
            
            // Draw player trail
            if (this.playerTrail && typeof this.playerTrail.draw === 'function') {
                this.playerTrail.draw(this.ctx);
            }
            
            // Draw oligarch
            this.drawOligarch();
            
            // Draw player
            this.drawPlayer();
            
            // Draw particles
            if (this.particles && typeof this.particles.draw === 'function') {
                this.particles.draw(this.ctx);
            }
        }
        
        this.ctx.restore();
        
        // Draw UI
        this.drawUI();
        
        // Draw game state messages
        this.drawGameState();
        
        // Draw screen effects
        if (this.screenEffects) {
            if (typeof this.screenEffects.drawFlash === 'function') {
                this.screenEffects.drawFlash();
            }
            if (typeof this.screenEffects.drawRipple === 'function') {
                this.screenEffects.drawRipple();
            }
        }
        
        // Draw CRT filter
        if (this.crtFilter && typeof this.crtFilter.draw === 'function') {
            this.crtFilter.draw(this.ctx);
        }
    }
    
    // PixiJS rendering methods
    drawPlatformsPixi(layer) {
        for (let platform of this.platforms) {
            const platformGraphics = new PIXI.Graphics();
            
            // Main platform body with gradient effect (simulated)
            platformGraphics.beginFill(0x8B4513, 1);
            platformGraphics.drawRect(0, 0, platform.width, platform.height);
            platformGraphics.endFill();
            
            // Darker bottom
            platformGraphics.beginFill(0x654321, 1);
            platformGraphics.drawRect(0, platform.height / 2, platform.width, platform.height / 2);
            platformGraphics.endFill();
            
            // Border
            platformGraphics.lineStyle(2, 0x654321, 1);
            platformGraphics.drawRect(0, 0, platform.width, platform.height);
            
            // Top highlight
            platformGraphics.lineStyle(1, 0xA0522D, 1);
            platformGraphics.moveTo(0, 0);
            platformGraphics.lineTo(platform.width, 0);
            
            platformGraphics.x = platform.x;
            platformGraphics.y = platform.y;
            layer.addChild(platformGraphics);
        }
    }
    
    drawLaddersPixi(layer) {
        for (let ladder of this.ladders) {
            const ladderGraphics = new PIXI.Graphics();
            
            // Ladder background with gradient effect
            ladderGraphics.beginFill(0xC0C0C0, 1);
            ladderGraphics.drawRect(0, 0, ladder.width, ladder.height);
            ladderGraphics.endFill();
            
            // Darker right side
            ladderGraphics.beginFill(0x808080, 1);
            ladderGraphics.drawRect(ladder.width / 2, 0, ladder.width / 2, ladder.height);
            ladderGraphics.endFill();
            
            // Draw ladder rungs
            ladderGraphics.lineStyle(2, 0x606060, 1);
            for (let i = 0; i < ladder.height; i += 20) {
                ladderGraphics.moveTo(0, i);
                ladderGraphics.lineTo(ladder.width, i);
            }
            
            // Ladder sides
            ladderGraphics.lineStyle(2, 0x505050, 1);
            ladderGraphics.drawRect(0, 0, ladder.width, ladder.height);
            
            ladderGraphics.x = ladder.x;
            ladderGraphics.y = ladder.y;
            layer.addChild(ladderGraphics);
        }
    }
    
    drawMoneyBagsPixi(layer) {
        for (let moneyBag of this.moneyBags) {
            const bagContainer = new PIXI.Container();
            bagContainer.x = moneyBag.x + moneyBag.width/2;
            bagContainer.y = moneyBag.y + moneyBag.height/2;
            bagContainer.rotation = moneyBag.rotation;
            
            const bagGraphics = new PIXI.Graphics();
            
            // Outer glow
            bagGraphics.beginFill(0xFFD700, 0.3);
            bagGraphics.drawRect(-moneyBag.width/2 - 2, -moneyBag.height/2 - 2, moneyBag.width + 4, moneyBag.height + 4);
            bagGraphics.endFill();
            
            // Money bag
            bagGraphics.beginFill(0xFFD700, 1);
            bagGraphics.drawRect(-moneyBag.width/2, -moneyBag.height/2, moneyBag.width, moneyBag.height);
            bagGraphics.endFill();
            
            // Border
            bagGraphics.lineStyle(2, 0xB8860B, 1);
            bagGraphics.drawRect(-moneyBag.width/2, -moneyBag.height/2, moneyBag.width, moneyBag.height);
            
            bagContainer.addChild(bagGraphics);
            
            // Dollar sign
            const dollarText = new PIXI.Text('$', new PIXI.TextStyle({
                fontFamily: 'Arial',
                fontSize: 10,
                fill: 0x000000,
                fontWeight: 'bold',
                align: 'center'
            }));
            dollarText.anchor.set(0.5);
            bagContainer.addChild(dollarText);
            
            layer.addChild(bagContainer);
        }
    }
    
    drawPowerUpsPixi(layer) {
        for (let powerUp of this.powerUps) {
            const powerUpData = this.powerUpTypes[powerUp.type];
            const floatY = powerUp.y + Math.sin(powerUp.floatOffset) * 3;
            const colorHex = parseInt(powerUpData.color.replace('#', ''), 16);
            
            const powerUpContainer = new PIXI.Container();
            powerUpContainer.x = powerUp.x + powerUp.width/2;
            powerUpContainer.y = floatY + powerUp.height/2;
            
            const powerUpGraphics = new PIXI.Graphics();
            
            // Outer glow
            powerUpGraphics.beginFill(colorHex, 0.2);
            powerUpGraphics.drawRect(-powerUp.width/2 - 5, -powerUp.height/2 - 5, powerUp.width + 10, powerUp.height + 10);
            powerUpGraphics.endFill();
            
            powerUpGraphics.beginFill(colorHex, 1);
            
            switch (powerUp.type) {
                case 'SPEED_BOOST':
                    // Lightning bolt
                    powerUpGraphics.drawPolygon([
                        powerUp.width/2, -powerUp.height/2 + 2,
                        powerUp.width - 4, 0,
                        powerUp.width/2, 0,
                        -powerUp.width/2 + 4, powerUp.height/2 - 2,
                        powerUp.width/2, 0,
                        powerUp.width - 4, 0
                    ]);
                    break;
                    
                case 'INVINCIBILITY':
                    // Star (5-pointed)
                    const starPoints = [];
                    for (let i = 0; i < 5; i++) {
                        const angle = (i * Math.PI * 2 / 5) - Math.PI / 2;
                        starPoints.push(
                            Math.cos(angle) * (powerUp.width/2),
                            Math.sin(angle) * (powerUp.height/2)
                        );
                    }
                    powerUpGraphics.drawPolygon(starPoints);
                    break;
                    
                case 'EXTRA_LIFE':
                    // Heart shape (simplified as rounded rectangle with triangle top)
                    powerUpGraphics.drawRoundedRect(-powerUp.width/3, 0, powerUp.width * 2/3, powerUp.height/2, 2);
                    powerUpGraphics.drawPolygon([
                        -powerUp.width/2, powerUp.height/2,
                        0, -powerUp.height/3,
                        powerUp.width/2, powerUp.height/2
                    ]);
                    break;
                    
                case 'SLOW_TIME':
                    // Clock
                    powerUpGraphics.drawCircle(0, 0, powerUp.width/2 - 2);
                    powerUpGraphics.lineStyle(1, 0x000000, 1);
                    powerUpGraphics.drawCircle(0, 0, powerUp.width/2 - 2);
                    // Clock hands
                    powerUpGraphics.lineStyle(2, 0x000000, 1);
                    powerUpGraphics.moveTo(0, 0);
                    powerUpGraphics.lineTo(0, -powerUp.height/2 + 4);
                    powerUpGraphics.moveTo(0, 0);
                    powerUpGraphics.lineTo(powerUp.width/2 - 4, 0);
                    break;
            }
            
            powerUpGraphics.endFill();
            powerUpContainer.addChild(powerUpGraphics);
            layer.addChild(powerUpContainer);
        }
    }
    
    drawRetirementGoalPixi(layer) {
        this.retirementGoal.glowTimer += 0.08;
        const pulse = Math.sin(this.retirementGoal.glowTimer) * 0.25 + 0.75;
        const g = this.retirementGoal;

        const goalContainer = new PIXI.Container();
        goalContainer.x = g.x;
        goalContainer.y = g.y;

        const glow = new PIXI.Graphics();
        glow.beginFill(0x00ddff, pulse * 0.25);
        glow.drawEllipse(g.width / 2, g.height / 2 + 4, g.width * 0.75, g.height * 0.55);
        glow.endFill();
        goalContainer.addChild(glow);

        const art = new PIXI.Graphics();

        // Sand bar
        art.beginFill(0xf4d03f, pulse);
        art.drawEllipse(g.width / 2, g.height - 6, g.width * 0.55, 14);
        art.endFill();

        // Water line
        art.lineStyle(2, 0x00ccff, 0.8);
        art.moveTo(0, g.height - 2);
        art.lineTo(g.width, g.height - 2);

        // Palm trunk
        art.beginFill(0x8B5A2B, pulse);
        art.drawRect(g.width / 2 + 18, g.height - 38, 8, 32);
        art.endFill();

        // Palm fronds
        art.beginFill(0x22aa44, pulse);
        for (let i = 0; i < 5; i++) {
            const angle = -Math.PI / 2 + (i - 2) * 0.45;
            const fx = g.width / 2 + 22 + Math.cos(angle) * 28;
            const fy = g.height - 38 + Math.sin(angle) * 16;
            art.drawPolygon([
                g.width / 2 + 22, g.height - 38,
                fx, fy,
                g.width / 2 + 22 + Math.cos(angle + 0.2) * 12, g.height - 36 + Math.sin(angle + 0.2) * 8
            ]);
        }
        art.endFill();

        // Tiki sign
        art.beginFill(0xdeb887, pulse);
        art.drawRect(8, g.height - 32, 36, 26);
        art.endFill();
        art.beginFill(0xcd853f, pulse);
        art.drawPolygon([8, g.height - 32, 26, g.height - 40, 44, g.height - 32]);
        art.endFill();

        goalContainer.addChild(art);

        const title = new PIXI.Text('PARADISE', new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 11,
            fill: 0xffffff,
            fontWeight: 'bold',
            align: 'center'
        }));
        title.anchor.set(0.5);
        title.x = 26;
        title.y = g.height - 22;
        goalContainer.addChild(title);

        const subtitle = new PIXI.Text('☼ ESCAPE ☼', new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 9,
            fill: 0xffee88,
            align: 'center'
        }));
        subtitle.anchor.set(0.5);
        subtitle.x = g.width / 2;
        subtitle.y = -6;
        goalContainer.addChild(subtitle);

        layer.addChild(goalContainer);
    }
    
    drawOligarchPixi(layer) {
        const oligarchContainer = new PIXI.Container();
        oligarchContainer.x = this.oligarch.x;
        oligarchContainer.y = this.oligarch.y;
        
        const oligarchGraphics = new PIXI.Graphics();
        
        // Body
        oligarchGraphics.beginFill(0x000080, 1);
        oligarchGraphics.drawRect(0, 20, this.oligarch.width, this.oligarch.height - 20);
        oligarchGraphics.endFill();
        
        // Head
        oligarchGraphics.beginFill(0xFDBCB4, 1);
        oligarchGraphics.drawRect(8, 0, this.oligarch.width - 16, 20);
        oligarchGraphics.endFill();
        
        // Top hat
        oligarchGraphics.beginFill(0x000000, 1);
        oligarchGraphics.drawRect(4, -12, this.oligarch.width - 8, 12);
        oligarchGraphics.drawRect(2, -4, this.oligarch.width - 4, 4);
        oligarchGraphics.endFill();
        
        // Monocle
        oligarchGraphics.lineStyle(3, 0xFFD700, 1);
        oligarchGraphics.drawCircle(25, 8, 6);
        oligarchGraphics.lineStyle(2, 0xFFD700, 1);
        oligarchGraphics.moveTo(31, 8);
        oligarchGraphics.lineTo(35, 6);
        
        // Face details
        oligarchGraphics.beginFill(0x000000, 1);
        oligarchGraphics.drawRect(20, 6, 2, 2);
        oligarchGraphics.drawRect(28, 6, 2, 2);
        oligarchGraphics.endFill();
        
        // Mustache
        oligarchGraphics.beginFill(0x8B4513, 1);
        oligarchGraphics.drawRect(15, 12, 10, 2);
        oligarchGraphics.endFill();
        
        // Arms
        oligarchGraphics.beginFill(0xFDBCB4, 1);
        oligarchGraphics.drawRect(-4, 24, 8, 16);
        oligarchGraphics.drawRect(this.oligarch.width - 4, 24, 8, 16);
        oligarchGraphics.endFill();
        
        // Legs
        oligarchGraphics.beginFill(0x000080, 1);
        oligarchGraphics.drawRect(8, 36, 8, 12);
        oligarchGraphics.drawRect(24, 36, 8, 12);
        oligarchGraphics.endFill();
        
        // Shoes
        oligarchGraphics.beginFill(0x000000, 1);
        oligarchGraphics.drawRect(6, 46, 12, 4);
        oligarchGraphics.drawRect(22, 46, 12, 4);
        oligarchGraphics.endFill();
        
        // Cane
        oligarchGraphics.lineStyle(3, 0x8B4513, 1);
        oligarchGraphics.moveTo(-8, 20);
        oligarchGraphics.lineTo(-8, 40);
        
        // Cane handle
        oligarchGraphics.beginFill(0xFFD700, 1);
        oligarchGraphics.drawCircle(-8, 20, 3);
        oligarchGraphics.endFill();
        
        oligarchContainer.addChild(oligarchGraphics);
        layer.addChild(oligarchContainer);
    }
    
    drawPlayerTrailPixi(layer) {
        // Simple trail implementation with fading circles
        if (this.playerTrailSprites.length > 10) {
            const oldTrail = this.playerTrailSprites.shift();
            if (oldTrail && oldTrail.parent) {
                oldTrail.parent.removeChild(oldTrail);
            }
        }
        
        const trailPoint = new PIXI.Graphics();
        trailPoint.beginFill(0x4169E1, 0.5);
        trailPoint.drawCircle(0, 0, 4);
        trailPoint.endFill();
        trailPoint.x = this.player.x + this.player.width/2;
        trailPoint.y = this.player.y + this.player.height/2;
        trailPoint.alpha = 0.3;
        layer.addChild(trailPoint);
        this.playerTrailSprites.push(trailPoint);
        
        // Fade existing trails
        this.playerTrailSprites.forEach((trail, index) => {
            trail.alpha = 0.3 * (1 - index / this.playerTrailSprites.length);
        });
    }
    
    drawPlayerPixi(layer) {
        const invincibleFlash = this.player.invincible && Math.floor(this.player.invincibleTimer / 5) % 2;
        
        if (invincibleFlash) {
            return; // Don't draw when flashing
        }
        
        this.drawPlayerTrailPixi(layer);

        if (this.playerTexture) {
            const sprite = new PIXI.Sprite(this.playerTexture);
            sprite.x = this.player.x;
            sprite.y = this.player.y;
            sprite.width = this.player.width;
            sprite.height = this.player.height;
            layer.addChild(sprite);
            return;
        }
        
        const playerContainer = new PIXI.Container();
        playerContainer.x = this.player.x;
        playerContainer.y = this.player.y;
        
        const playerGraphics = new PIXI.Graphics();
        
        // Body
        playerGraphics.beginFill(0x4169E1, 1);
        playerGraphics.drawRect(0, 16, this.player.width, this.player.height - 16);
        playerGraphics.endFill();
        
        // Head
        playerGraphics.beginFill(0xFDBCB4, 1);
        playerGraphics.drawRect(4, 0, this.player.width - 8, 16);
        playerGraphics.endFill();
        
        // Hard hat
        playerGraphics.beginFill(0xFFD700, 1);
        playerGraphics.drawRect(2, -4, this.player.width - 4, 8);
        playerGraphics.endFill();
        
        // Face details
        playerGraphics.beginFill(0x000000, 1);
        playerGraphics.drawRect(6, 4, 2, 2);
        playerGraphics.drawRect(12, 4, 2, 2);
        playerGraphics.endFill();
        
        // Mustache
        playerGraphics.beginFill(0x8B4513, 1);
        playerGraphics.drawRect(7, 8, 6, 2);
        playerGraphics.endFill();
        
        // Arms (animation)
        playerGraphics.beginFill(0xFDBCB4, 1);
        if (this.player.animFrame % 2 === 0) {
            playerGraphics.drawRect(-4, 20, 8, 12);
            playerGraphics.drawRect(this.player.width - 4, 20, 8, 12);
        } else {
            playerGraphics.drawRect(-2, 18, 8, 12);
            playerGraphics.drawRect(this.player.width - 6, 22, 8, 12);
        }
        playerGraphics.endFill();
        
        // Legs (walking animation)
        playerGraphics.beginFill(0x4169E1, 1);
        if (this.player.vx !== 0 || this.player.climbing) {
            if (this.player.animFrame % 2 === 0) {
                playerGraphics.drawRect(4, this.player.height - 8, 6, 8);
                playerGraphics.drawRect(14, this.player.height - 12, 6, 12);
            } else {
                playerGraphics.drawRect(4, this.player.height - 12, 6, 12);
                playerGraphics.drawRect(14, this.player.height - 8, 6, 8);
            }
        } else {
            playerGraphics.drawRect(4, this.player.height - 8, 6, 8);
            playerGraphics.drawRect(14, this.player.height - 8, 6, 8);
        }
        playerGraphics.endFill();
        
        // Power-up indicators
        if (this.activePowerUps.speed) {
            playerGraphics.lineStyle(2, 0x00ff00, 0.8);
            playerGraphics.drawRect(0, 0, this.player.width, this.player.height);
        }
        if (this.activePowerUps.invincible) {
            playerGraphics.lineStyle(2, 0xffff00, 0.8);
            playerGraphics.drawCircle(this.player.width/2, this.player.height/2, this.player.width/2 + 2);
        }
        
        playerContainer.addChild(playerGraphics);
        layer.addChild(playerContainer);
    }
    
    drawUIPixi(layer) {
        // Update stats panel instead of drawing on canvas
        this.updateStatsPanel();
    }
    
    updateStatsPanel() {
        const statsPanel = document.getElementById('game-stats-panel');
        if (!statsPanel) return;
        
        const statsContent = statsPanel.querySelector('.stats-content');
        if (!statsContent) return;
        
        let powerUpHTML = '';
        if (this.activePowerUps.speed) {
            powerUpHTML += '<div class="stat-item"><div class="stat-label">Power-Up</div><div class="stat-value" style="color: #00ff00;">SPEED</div></div>';
        }
        if (this.activePowerUps.invincible) {
            powerUpHTML += '<div class="stat-item"><div class="stat-label">Power-Up</div><div class="stat-value" style="color: #ffff00;">INVINCIBLE</div></div>';
        }
        
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
            ${powerUpHTML}
        `;
    }
    
    drawGameStatePixi(layer) {
        if (this.gameState === 'menu') {
            const menuBg = new PIXI.Graphics();
            menuBg.beginFill(0x1a1a2e, 0.9);
            menuBg.drawRect(0, 0, this.width, this.height);
            menuBg.endFill();
            layer.addChild(menuBg);
            
            const titleStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 36,
                fill: 0x00ffff,
                fontWeight: 'bold',
                align: 'center'
            });
            const title = new PIXI.Text('RISE OF THE RIVETS', titleStyle);
            title.anchor.set(0.5);
            title.x = this.width / 2;
            title.y = this.height / 2 - 80;
            layer.addChild(title);
            
            const instructionStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 16,
                fill: 0xffffff,
                align: 'center'
            });
            const instructions = [
                'Climb the girders to Paradise!',
                'The oligarch rains money bags — dodge them',
                'Arrow Keys: Move | Up/Down: Ladders | Space/Up: Jump',
                'Reach the beach at the TOP',
                'Press SPACE to start'
            ];
            instructions.forEach((text, i) => {
                const instruction = new PIXI.Text(text, instructionStyle);
                instruction.anchor.set(0.5);
                instruction.x = this.width / 2;
                instruction.y = this.height / 2 - 40 + (i * 25);
                layer.addChild(instruction);
            });
        } else if (this.gameState === 'paused') {
            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.8);
            overlay.drawRect(0, 0, this.width, this.height);
            overlay.endFill();
            layer.addChild(overlay);
            
            const pauseStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 24,
                fill: 0xffff00,
                align: 'center'
            });
            const pauseText = new PIXI.Text('PAUSED', pauseStyle);
            pauseText.anchor.set(0.5);
            pauseText.x = this.width / 2;
            pauseText.y = this.height / 2;
            layer.addChild(pauseText);
            
            const resumeText = new PIXI.Text('Press P to resume', new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 16,
                fill: 0xffffff,
                align: 'center'
            }));
            resumeText.anchor.set(0.5);
            resumeText.x = this.width / 2;
            resumeText.y = this.height / 2 + 30;
            layer.addChild(resumeText);
        } else if (this.gameState === 'gameOver') {
            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.8);
            overlay.drawRect(0, 0, this.width, this.height);
            overlay.endFill();
            layer.addChild(overlay);
            
            const gameOverStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 24,
                fill: 0xff0000,
                align: 'center'
            });
            const gameOverText = new PIXI.Text('GAME OVER', gameOverStyle);
            gameOverText.anchor.set(0.5);
            gameOverText.x = this.width / 2;
            gameOverText.y = this.height / 2 - 30;
            layer.addChild(gameOverText);
            
            const infoStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 16,
                fill: 0xffffff,
                align: 'center'
            });
            const scoreText = new PIXI.Text(`Final Score: ${Utils.formatScore(this.score)}`, infoStyle);
            scoreText.anchor.set(0.5);
            scoreText.x = this.width / 2;
            scoreText.y = this.height / 2;
            layer.addChild(scoreText);
            
            const levelText = new PIXI.Text(`Reached Level: ${this.level}`, infoStyle);
            levelText.anchor.set(0.5);
            levelText.x = this.width / 2;
            levelText.y = this.height / 2 + 30;
            layer.addChild(levelText);
            
            const restartText = new PIXI.Text('Press SPACE to restart', infoStyle);
            restartText.anchor.set(0.5);
            restartText.x = this.width / 2;
            restartText.y = this.height / 2 + 60;
            layer.addChild(restartText);
        } else if (this.gameState === 'complete') {
            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.8);
            overlay.drawRect(0, 0, this.width, this.height);
            overlay.endFill();
            layer.addChild(overlay);
            
            const completeStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 28,
                fill: 0xffd700,
                align: 'center'
            });
            const completeText = new PIXI.Text('CONGRATULATIONS!', completeStyle);
            completeText.anchor.set(0.5);
            completeText.x = this.width / 2;
            completeText.y = this.height / 2 - 40;
            layer.addChild(completeText);
            
            const infoStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 20,
                fill: 0xffffff,
                align: 'center'
            });
            const messageText = new PIXI.Text('Welcome to Paradise!', infoStyle);
            messageText.anchor.set(0.5);
            messageText.x = this.width / 2;
            messageText.y = this.height / 2 - 10;
            layer.addChild(messageText);
            
            const scoreText = new PIXI.Text(`Final Score: ${Utils.formatScore(this.score)}`, infoStyle);
            scoreText.anchor.set(0.5);
            scoreText.x = this.width / 2;
            scoreText.y = this.height / 2 + 25;
            layer.addChild(scoreText);
            
            const restartText = new PIXI.Text('Press SPACE to play again', infoStyle);
            restartText.anchor.set(0.5);
            restartText.x = this.width / 2;
            restartText.y = this.height / 2 + 55;
            layer.addChild(restartText);
        }
    }
    
    updatePlatformSprites() {
        if (this.isPreview) return;
        // Platform sprites are recreated each frame in drawPlatformsPixi
    }
    
    updateLadderSprites() {
        if (this.isPreview) return;
        // Ladder sprites are recreated each frame in drawLaddersPixi
    }
    
    updateMoneyBagSprites() {
        if (this.isPreview) return;
        // Money bag sprites are recreated each frame in drawMoneyBagsPixi
    }
    
    updatePowerUpSprites() {
        if (this.isPreview) return;
        // Power-up sprites are recreated each frame in drawPowerUpsPixi
    }
    
    updateRetirementGoalSprite() {
        if (this.isPreview) return;
        // Retirement goal sprite is recreated each frame in drawRetirementGoalPixi
    }
    
    drawPlatforms() {
        for (let platform of this.platforms) {
            // Gradient fill for platforms
            const gradient = this.ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.height);
            gradient.addColorStop(0, '#8B4513');
            gradient.addColorStop(1, '#654321');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            
            // Platform border with glow
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
            
            // Top highlight
            this.ctx.strokeStyle = '#A0522D';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(platform.x, platform.y);
            this.ctx.lineTo(platform.x + platform.width, platform.y);
            this.ctx.stroke();
        }
    }
    
    drawLadders() {
        for (let ladder of this.ladders) {
            // Ladder background
            const gradient = this.ctx.createLinearGradient(ladder.x, ladder.y, ladder.x + ladder.width, ladder.y);
            gradient.addColorStop(0, '#C0C0C0');
            gradient.addColorStop(1, '#808080');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(ladder.x, ladder.y, ladder.width, ladder.height);
            
            // Draw ladder rungs
            this.ctx.strokeStyle = '#606060';
            this.ctx.lineWidth = 2;
            for (let i = 0; i < ladder.height; i += 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(ladder.x, ladder.y + i);
                this.ctx.lineTo(ladder.x + ladder.width, ladder.y + i);
                this.ctx.stroke();
            }
            
            // Ladder sides
            this.ctx.strokeStyle = '#505050';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(ladder.x, ladder.y, ladder.width, ladder.height);
        }
    }
    
    drawMoneyBags() {
        for (let moneyBag of this.moneyBags) {
            this.ctx.save();
            this.ctx.translate(moneyBag.x + moneyBag.width/2, moneyBag.y + moneyBag.height/2);
            this.ctx.rotate(moneyBag.rotation);
            
            // Draw money bag with glow
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 5;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillRect(-moneyBag.width/2, -moneyBag.height/2, moneyBag.width, moneyBag.height);
            this.ctx.shadowBlur = 0;
            
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
    
    drawPowerUps() {
        for (let powerUp of this.powerUps) {
            const powerUpData = this.powerUpTypes[powerUp.type];
            const floatY = powerUp.y + Math.sin(powerUp.floatOffset) * 3;
            
            // Glow effect
            this.ctx.shadowColor = powerUpData.color;
            this.ctx.shadowBlur = 10;
            
            // Draw icon based on type
            this.ctx.fillStyle = powerUpData.color;
            
            switch (powerUp.type) {
                case 'SPEED_BOOST':
                    // Lightning bolt
                    this.ctx.beginPath();
                    this.ctx.moveTo(powerUp.x + powerUp.width/2, floatY + 2);
                    this.ctx.lineTo(powerUp.x + powerUp.width - 4, floatY + powerUp.height/2);
                    this.ctx.lineTo(powerUp.x + powerUp.width/2, floatY + powerUp.height/2);
                    this.ctx.lineTo(powerUp.x + 4, floatY + powerUp.height - 2);
                    this.ctx.lineTo(powerUp.x + powerUp.width/2, floatY + powerUp.height/2);
                    this.ctx.lineTo(powerUp.x + powerUp.width - 4, floatY + powerUp.height/2);
                    this.ctx.closePath();
                    this.ctx.fill();
                    break;
                    
                case 'INVINCIBILITY':
                    // Star
                    this.ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const angle = (i * Math.PI * 2 / 5) - Math.PI / 2;
                        const x = powerUp.x + powerUp.width/2 + Math.cos(angle) * (powerUp.width/2);
                        const y = floatY + powerUp.height/2 + Math.sin(angle) * (powerUp.height/2);
                        if (i === 0) this.ctx.moveTo(x, y);
                        else this.ctx.lineTo(x, y);
                    }
                    this.ctx.closePath();
                    this.ctx.fill();
                    break;
                    
                case 'EXTRA_LIFE':
                    // Heart
                    this.ctx.beginPath();
                    this.ctx.moveTo(powerUp.x + powerUp.width/2, floatY + powerUp.height - 2);
                    this.ctx.bezierCurveTo(powerUp.x + powerUp.width/2, floatY + powerUp.height - 2,
                                          powerUp.x, floatY + powerUp.height/2,
                                          powerUp.x, floatY + powerUp.height/3);
                    this.ctx.bezierCurveTo(powerUp.x, floatY + 2,
                                          powerUp.x + powerUp.width/3, floatY + 2,
                                          powerUp.x + powerUp.width/2, floatY + powerUp.height/3);
                    this.ctx.bezierCurveTo(powerUp.x + powerUp.width * 2/3, floatY + 2,
                                          powerUp.x + powerUp.width, floatY + 2,
                                          powerUp.x + powerUp.width, floatY + powerUp.height/3);
                    this.ctx.bezierCurveTo(powerUp.x + powerUp.width, floatY + powerUp.height/2,
                                          powerUp.x + powerUp.width/2, floatY + powerUp.height - 2,
                                          powerUp.x + powerUp.width/2, floatY + powerUp.height - 2);
                    this.ctx.closePath();
                    this.ctx.fill();
                    break;
                    
                case 'SLOW_TIME':
                    // Clock
                    this.ctx.beginPath();
                    this.ctx.arc(powerUp.x + powerUp.width/2, floatY + powerUp.height/2, powerUp.width/2 - 2, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.strokeStyle = '#000000';
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                    // Clock hands
                    this.ctx.strokeStyle = '#000000';
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(powerUp.x + powerUp.width/2, floatY + powerUp.height/2);
                    this.ctx.lineTo(powerUp.x + powerUp.width/2, floatY + 4);
                    this.ctx.moveTo(powerUp.x + powerUp.width/2, floatY + powerUp.height/2);
                    this.ctx.lineTo(powerUp.x + powerUp.width - 4, floatY + powerUp.height/2);
                    this.ctx.stroke();
                    break;
            }
            
            this.ctx.shadowBlur = 0;
        }
    }
    
    drawRetirementGoal() {
        this.retirementGoal.glowTimer += 0.08;
        const pulse = Math.sin(this.retirementGoal.glowTimer) * 0.25 + 0.75;
        const g = this.retirementGoal;
        const cx = g.x + g.width / 2;

        this.ctx.save();
        this.ctx.shadowColor = '#f4d03f';
        this.ctx.shadowBlur = 14 * pulse;
        this.ctx.globalAlpha = pulse;
        this.ctx.fillStyle = '#f4d03f';
        this.ctx.beginPath();
        this.ctx.ellipse(cx, g.y + g.height - 6, g.width * 0.45, 12, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#22aa44';
        this.ctx.fillRect(cx + 10, g.y + g.height - 36, 6, 28);
        this.ctx.fillStyle = '#deb887';
        this.ctx.fillRect(g.x + 8, g.y + g.height - 30, 32, 22);
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 10px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PARADISE', g.x + 24, g.y + g.height - 14);
        this.ctx.fillStyle = '#ffee88';
        this.ctx.fillText('☼ ESCAPE ☼', cx, g.y - 4);
        this.ctx.textAlign = 'left';
        this.ctx.restore();
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
    }
    
    drawPlayer() {
        // Draw invincibility flash effect
        const invincibleFlash = this.player.invincible && Math.floor(this.player.invincibleTimer / 5) % 2;
        
        if (!invincibleFlash) {
            // Draw player trail
            this.playerTrail.draw(this.ctx);
            
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
            if (this.player.vx !== 0 || this.player.climbing) {
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
        
            // Power-up indicators
            if (this.activePowerUps.speed) {
                this.ctx.fillStyle = '#00ff00';
            this.ctx.beginPath();
                this.ctx.arc(this.player.x + this.player.width/2, this.player.y - 8, 4, 0, Math.PI * 2);
            this.ctx.fill();
            }
            
            if (this.activePowerUps.invincible) {
                this.ctx.strokeStyle = '#ffff00';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(this.player.x + this.player.width/2, this.player.y + this.player.height/2, 
                            Math.max(this.player.width, this.player.height)/2 + 2, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
    }
    
    drawUI() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'left';
        
        this.ctx.fillText(`Score: ${Utils.formatScore(this.score)}`, 10, 25);
        this.ctx.fillText(`Lives: ${this.lives}`, 10, 45);
        this.ctx.fillText(`Level: ${this.level}/${this.maxLevel}`, 10, 65);
        
        // Draw power-up timers
        let powerUpY = 90;
        if (this.activePowerUps.speed && this.powerUpTimers.speed > 0) {
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillText(`SPEED: ${Math.ceil(this.powerUpTimers.speed / 60)}s`, 10, powerUpY);
            powerUpY += 20;
        }
        if (this.activePowerUps.invincible && this.powerUpTimers.invincible > 0) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.fillText(`INVINCIBLE: ${Math.ceil(this.powerUpTimers.invincible / 60)}s`, 10, powerUpY);
            powerUpY += 20;
        }
        if (this.activePowerUps.slowTime && this.powerUpTimers.slowTime > 0) {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.fillText(`SLOW TIME: ${Math.ceil(this.powerUpTimers.slowTime / 60)}s`, 10, powerUpY);
        }
    }
    
    drawPreview() {
        // Draw a simplified preview of the game
        this.ctx.fillStyle = '#001122';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw some platforms
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(30, this.height - 60, 200, 16);
        this.ctx.fillRect(this.width - 230, this.height - 120, 200, 16);
        this.ctx.fillRect(50, this.height - 180, 180, 16);
        
        // Draw ladders
        this.ctx.fillStyle = '#666666';
        this.ctx.fillRect(190, this.height - 180, 16, 60);
        this.ctx.fillRect(this.width - 150, this.height - 240, 16, 60);
        
        // Draw player (small)
        this.ctx.fillStyle = '#00ffff';
        this.ctx.fillRect(50, this.height - 92, 12, 16);
        // Head
        this.ctx.fillStyle = '#FFDBAC';
        this.ctx.fillRect(52, this.height - 92, 8, 8);
        
        // Draw oligarch at top
        this.ctx.fillStyle = '#000080';
        this.ctx.fillRect(this.width - 80, 20, 20, 24);
        // Head
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(this.width - 78, 20, 16, 12);
        
        // Draw Paradise goal at top
        this.ctx.fillStyle = '#f4d03f';
        this.ctx.fillRect(this.width - 100, 12, 60, 14);
        this.ctx.fillStyle = '#22aa44';
        this.ctx.fillRect(this.width - 72, 8, 4, 10);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '8px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PARADISE', this.width - 70, 22);
        this.ctx.textAlign = 'left';
        
        // Draw title overlay
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('RISE OF THE RIVETS', this.width / 2, this.height - 10);
        this.ctx.textAlign = 'left';
    }
    
    drawGameState() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Courier New';
        this.ctx.textAlign = 'left';
        
        // Draw game state messages
        if (this.gameState === 'menu') {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.font = '24px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('RISE OF THE RIVETS', this.width / 2, this.height / 2 - 50);
            this.ctx.fillText('Climb the girders to Paradise!', this.width / 2, this.height / 2 - 20);
            this.ctx.font = '16px Courier New';
            this.ctx.fillText('Arrow Keys: Move | Up/Down: Ladders | Space/Up: Jump', this.width / 2, this.height / 2 + 10);
            this.ctx.fillText('Collect power-ups to help your journey!', this.width / 2, this.height / 2 + 35);
            this.ctx.fillText('Press SPACE to start', this.width / 2, this.height / 2 + 60);
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
            this.ctx.fillText(`Reached Level: ${this.level}`, this.width / 2, this.height / 2 + 30);
            this.ctx.fillText('Press SPACE to restart', this.width / 2, this.height / 2 + 60);
        } else if (this.gameState === 'complete') {
            this.ctx.fillStyle = '#ffd700';
            this.ctx.font = '28px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('CONGRATULATIONS!', this.width / 2, this.height / 2 - 40);
            this.ctx.font = '20px Courier New';
            this.ctx.fillText('Welcome to Paradise!', this.width / 2, this.height / 2 - 10);
            this.ctx.fillText(`Final Score: ${Utils.formatScore(this.score)}`, this.width / 2, this.height / 2 + 25);
            this.ctx.fillText('Press SPACE to play again', this.width / 2, this.height / 2 + 55);
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
            this.platformSprites = [];
            this.ladderSprites = [];
            this.playerSprite = null;
            this.oligarchSprite = null;
            this.moneyBagSprites = [];
            this.powerUpSprites = [];
            this.retirementGoalSprite = null;
            this.playerTrailSprites = [];
        }
    }
}

// Initialize Working Man game when canvas is ready
function initWorkingMan() {
    const canvas = document.getElementById('working-man-preview');
    if (canvas) {
    new WorkingManGame(canvas);
}
}
