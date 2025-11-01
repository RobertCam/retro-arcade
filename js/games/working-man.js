// Working Man vs Oligarch - Donkey Kong inspired platformer
// Version 2.0 - Fixed ladder exploit and improved level design
console.log('Working Man game script loaded v2.0');

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
        this.maxLevel = 20;
        
        // Player (Working Man)
        this.player = {
            x: 50,
            y: this.height - 100,
            width: 24,
            height: 32,
            vx: 0,
            vy: 0,
            baseSpeed: 2,
            speed: 2,
            jumpPower: 10,
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
            baseSpeed: 0.5,
            speed: 0.5,
            direction: -1,
            animFrame: 0,
            animTimer: 0,
            throwingTimer: 0,
            baseThrowingInterval: 180
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
        this.moneyBags = [];
        this.powerUps = [];
        
        // Animation and effects
        this.particles = new ParticleSystem();
        this.screenEffects = new ScreenEffects(canvas);
        this.tweenManager = new TweenManager();
        this.crtFilter = new CRTFilter(canvas);
        this.playerTrail = new MotionTrail(10, 0.90);
        
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
        
        // Check if this is a preview canvas
        this.isPreview = canvas.id === 'working-man-preview';
        
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
        
        // Levels 11-20: Repeat patterns with variations and increasing difficulty
        for (let level = 11; level <= 20; level++) {
            const basePattern = (level - 1) % 10;
            const variation = Math.floor((level - 1) / 10);
            
            // Create variation of existing pattern
            const baseLayout = layouts[basePattern];
            const variedLayout = this.varyLayout(baseLayout, level, variation, startY, platformHeight);
            layouts.push(variedLayout);
        }
        
        return layouts;
    }
    
    // Helper function to add ladder between two platforms
    addLadder(layout, lowerPlatform, upperPlatform, xPos, extraHeight = 8) {
        const ladderTop = upperPlatform.y;
        const ladderBottom = lowerPlatform.y;
        const ladderHeight = ladderBottom - ladderTop + extraHeight;
        
        layout.ladders.push({
            x: xPos,
            y: ladderTop,
            width: 16,
            height: ladderHeight
        });
    }
    
    // Pattern 1: Simple zigzag - ensures platforms overlap or connect
    createZigzagPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 80;
        const platforms = [
            { x: 30, width: 350, y: startY }, // Wide bottom platform
            { x: this.width - 380, width: 350, y: startY - spacing }, // Overlaps with previous
            { x: 30, width: 350, y: startY - spacing * 2 }, // Overlaps back
            { x: this.width - 380, width: 350, y: startY - spacing * 3 },
            { x: 30, width: 350, y: startY - spacing * 4 },
            { x: this.width - 380, width: 350, y: startY - spacing * 5 },
            { x: this.width - 300, width: 280, y: startY - spacing * 6 } // Top goal platform
        ];
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            // Place ladder in overlap area or at connecting edge
            let ladderX;
            const overlap = Math.min(current.x + current.width, next.x + next.width) - Math.max(current.x, next.x);
            if (overlap > 40) {
                // Platforms overlap - place ladder in overlap
                ladderX = (next.x === 30 ? current.x + current.width - 20 : next.x + next.width - 20);
            } else {
                // No overlap - place at edge that's closest
                ladderX = next.x === 30 ? current.x + current.width - 20 : current.x + 4;
            }
            this.addLadder(layout, current, next, ladderX);
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Pattern 2: Alternating sides with overlapping platforms
    createAlternatingSidesPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 70;
        const platforms = [
            { x: 30, width: 300, y: startY }, // Wide
            { x: this.width / 2 - 150, width: 300, y: startY - spacing }, // Overlaps center
            { x: 30, width: 300, y: startY - spacing * 2 }, // Overlaps left
            { x: this.width - 330, width: 300, y: startY - spacing * 3 }, // Overlaps right
            { x: this.width / 2 - 150, width: 300, y: startY - spacing * 4 }, // Center
            { x: 30, width: 300, y: startY - spacing * 5 }, // Left
            { x: this.width - 300, width: 280, y: startY - spacing * 6 } // Top goal
        ];
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            // Find overlap area for ladder placement
            const overlapLeft = Math.max(current.x, next.x);
            const overlapRight = Math.min(current.x + current.width, next.x + next.width);
            let ladderX;
            if (overlapRight > overlapLeft + 50) {
                // Good overlap - place in overlap
                ladderX = overlapLeft < current.x + current.width / 2 ? overlapRight - 20 : overlapLeft + 4;
                } else {
                // Minimal overlap - place at edge
                ladderX = next.x < current.x + current.width / 2 ? current.x + 4 : current.x + current.width - 20;
            }
            this.addLadder(layout, current, next, ladderX);
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Pattern 3: Spiral with connecting platforms
    createSpiralPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 65;
        const platforms = [
            { x: 30, width: 400, y: startY }, // Very wide
            { x: 30, width: 350, y: startY - spacing }, // Overlaps
            { x: this.width - 380, width: 350, y: startY - spacing * 2 }, // Reaches center
            { x: this.width - 380, width: 280, y: startY - spacing * 3 }, // Shrinks but still connects
            { x: this.width / 2 - 140, width: 280, y: startY - spacing * 4 }, // Center
            { x: this.width / 2 - 100, width: 200, y: startY - spacing * 5 }, // Narrower
            { x: this.width - 250, width: 230, y: startY - spacing * 6 } // Goal
        ];
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            // Find best ladder position in overlap
            const overlapLeft = Math.max(current.x, next.x);
            const overlapRight = Math.min(current.x + current.width, next.x + next.width);
            let ladderX = overlapLeft < overlapRight ? (overlapLeft + overlapRight) / 2 - 8 : current.x + current.width / 2 - 8;
            ladderX = Math.max(current.x + 4, Math.min(ladderX, current.x + current.width - 20));
            this.addLadder(layout, current, next, ladderX);
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Pattern 4: Left-right-left with wide overlapping platforms
    createLeftRightPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 75;
        const platforms = [
            { x: 30, width: 380, y: startY }, // Very wide
            { x: this.width - 410, width: 380, y: startY - spacing }, // Overlaps significantly
            { x: 30, width: 380, y: startY - spacing * 2 }, // Back to left
            { x: this.width - 410, width: 380, y: startY - spacing * 3 }, // Right again
            { x: 30, width: 360, y: startY - spacing * 4 }, // Slightly narrower
            { x: this.width - 390, width: 360, y: startY - spacing * 5 }, // Overlaps
            { x: this.width - 320, width: 300, y: startY - spacing * 6 } // Goal
        ];
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            // Place ladder in overlap area
            const overlapLeft = Math.max(current.x, next.x);
            const overlapRight = Math.min(current.x + current.width, next.x + next.width);
            const ladderX = i % 2 === 0 ? overlapRight - 20 : overlapLeft + 4;
            this.addLadder(layout, current, next, ladderX);
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Pattern 5: Center with branches - wide platforms that connect
    createCenterBranchesPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 70;
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
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            let ladderX;
            // Find overlap or connection point
            const overlapLeft = Math.max(current.x, next.x);
            const overlapRight = Math.min(current.x + current.width, next.x + next.width);
            if (overlapRight > overlapLeft + 40) {
                // Good overlap
                ladderX = next.x === centerX ? overlapRight - 20 : overlapLeft + 4;
            } else if (next.x === centerX) {
                ladderX = current.x + current.width - 20;
            } else if (current.x === centerX) {
                ladderX = next.x === 30 ? centerX + 4 : centerX + 300 - 20;
            } else {
                ladderX = current.x + current.width / 2 - 8;
            }
            this.addLadder(layout, current, next, ladderX);
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Pattern 6: Snake with wide overlapping platforms
    createSnakePattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 68;
        const platforms = [
            { x: 30, width: 250, y: startY }, // Wide
            { x: 120, width: 250, y: startY - spacing }, // Overlaps
            { x: 240, width: 250, y: startY - spacing * 2 }, // Further right
            { x: 120, width: 250, y: startY - spacing * 3 }, // Back left
            { x: 30, width: 250, y: startY - spacing * 4 }, // Far left
            { x: 240, width: 250, y: startY - spacing * 5 }, // Right
            { x: this.width - 280, width: 260, y: startY - spacing * 6 } // Goal
        ];
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            // Find overlap for ladder placement
            const overlapLeft = Math.max(current.x, next.x);
            const overlapRight = Math.min(current.x + current.width, next.x + next.width);
            let ladderX;
            if (overlapRight > overlapLeft + 40) {
                ladderX = next.x > current.x ? overlapRight - 20 : overlapLeft + 4;
            } else {
                ladderX = next.x > current.x ? current.x + current.width - 20 : current.x + 4;
            }
            this.addLadder(layout, current, next, ladderX);
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Pattern 7: Double column with connecting platforms
    createDoubleColumnPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 72;
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
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            // Platforms overlap, place ladder in overlap or at edge
            const overlapLeft = Math.max(current.x, next.x);
            const overlapRight = Math.min(current.x + current.width, next.x + next.width);
            const ladderX = current.x === leftX ? (overlapRight > overlapLeft ? overlapRight - 20 : current.x + current.width - 20) : 
                          (overlapLeft < overlapRight ? overlapLeft + 4 : current.x + 4);
            this.addLadder(layout, current, next, ladderX);
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Pattern 8: Mixed with wide connecting platforms
    createMixedPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 66;
        const platforms = [
            { x: 30, width: 350, y: startY }, // Very wide
            { x: this.width / 2 - 175, width: 350, y: startY - spacing }, // Overlaps center
            { x: 30, width: 300, y: startY - spacing * 2 }, // Left
            { x: this.width - 330, width: 300, y: startY - spacing * 3 }, // Right - overlaps
            { x: this.width / 2 - 150, width: 300, y: startY - spacing * 4 }, // Center
            { x: 30, width: 320, y: startY - spacing * 5 }, // Left
            { x: this.width - 300, width: 280, y: startY - spacing * 6 } // Goal
        ];
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            // Find overlap
            const overlapLeft = Math.max(current.x, next.x);
            const overlapRight = Math.min(current.x + current.width, next.x + next.width);
            let ladderX;
            if (overlapRight > overlapLeft + 40) {
                ladderX = next.x < current.x + current.width / 2 ? overlapLeft + 4 : overlapRight - 20;
            } else {
                ladderX = next.x < current.x + current.width / 2 ? current.x + 4 : current.x + current.width - 20;
            }
            this.addLadder(layout, current, next, ladderX);
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Pattern 9: Zigzag with gaps but still connecting
    createGapZigzagPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 74;
        const platforms = [
            { x: 30, width: 320, y: startY }, // Wide enough to connect
            { x: this.width - 350, width: 320, y: startY - spacing }, // Overlaps
            { x: 30, width: 280, y: startY - spacing * 2 }, // Still wide
            { x: this.width - 310, width: 280, y: startY - spacing * 3 }, // Overlaps
            { x: 30, width: 300, y: startY - spacing * 4 }, // Wide
            { x: this.width - 330, width: 300, y: startY - spacing * 5 }, // Overlaps
            { x: this.width - 280, width: 260, y: startY - spacing * 6 } // Goal
        ];
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            const overlapLeft = Math.max(current.x, next.x);
            const overlapRight = Math.min(current.x + current.width, next.x + next.width);
            const ladderX = i % 2 === 0 ? (overlapRight > overlapLeft ? overlapRight - 20 : current.x + current.width - 20) :
                          (overlapLeft < overlapRight ? overlapLeft + 4 : current.x + 4);
            this.addLadder(layout, current, next, ladderX);
            // Add extra ladder for better connectivity
            if (i % 3 === 0 && overlapRight > overlapLeft + 60) {
                const altX = i % 2 === 0 ? overlapLeft + 20 : overlapRight - 36;
                this.addLadder(layout, current, next, altX);
            }
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Pattern 10: Complex spiral with connecting platforms
    createComplexSpiralPattern(level, startY, platformHeight) {
        const layout = { platforms: [], ladders: [] };
        const spacing = 64;
        const platforms = [
            { x: 30, width: 380, y: startY }, // Very wide
            { x: 60, width: 340, y: startY - spacing }, // Slightly narrower but still wide
            { x: this.width - 400, width: 340, y: startY - spacing * 2 }, // Right side - overlaps
            { x: this.width - 370, width: 300, y: startY - spacing * 3 }, // Shrinks but connects
            { x: this.width / 2 - 150, width: 300, y: startY - spacing * 4 }, // Center
            { x: this.width / 2 - 120, width: 240, y: startY - spacing * 5 }, // Narrower
            { x: this.width - 260, width: 240, y: startY - spacing * 6 } // Goal
        ];
        
        layout.platforms = platforms.map(p => ({ ...p, height: platformHeight }));
        
        for (let i = 0; i < platforms.length - 1; i++) {
            const current = platforms[i];
            const next = platforms[i + 1];
            // Find overlap for ladder
            const overlapLeft = Math.max(current.x, next.x);
            const overlapRight = Math.min(current.x + current.width, next.x + next.width);
            let ladderX;
            if (overlapRight > overlapLeft + 40) {
                ladderX = (overlapLeft + overlapRight) / 2 - 8;
            } else {
                ladderX = next.x < current.x + current.width / 3 ? current.x + 4 :
                         (next.x > current.x + current.width * 2 / 3 ? current.x + current.width - 20 :
                          current.x + current.width / 2 - 8);
            }
            this.addLadder(layout, current, next, ladderX);
        }
        
        layout.platforms.push({ x: 0, y: this.height - 20, width: this.width, height: 20 });
        return layout;
    }
    
    // Vary an existing layout for difficulty scaling
    varyLayout(baseLayout, level, variation, startY, platformHeight) {
        // Create a deep copy
        const layout = {
            platforms: baseLayout.platforms.map(p => ({ ...p })),
            ladders: baseLayout.ladders.map(l => ({ ...l }))
        };
        
        // Adjust platform widths based on level difficulty
        const widthAdjust = Math.min(level * 2, 30);
        for (let i = 1; i < layout.platforms.length - 1; i++) {
            const platform = layout.platforms[i];
            if (platform.y < this.height - 20) {
                platform.width = Math.max(100, platform.width - widthAdjust);
            }
        }
        
        // Adjust spacing slightly for variation
        if (variation > 0) {
            const spacingOffset = variation * 5;
            for (let i = 1; i < layout.platforms.length; i++) {
                layout.platforms[i].y -= spacingOffset;
            }
            // Recalculate ladders
            layout.ladders = [];
            for (let i = 0; i < layout.platforms.length - 2; i++) {
                const current = layout.platforms[i];
                const next = layout.platforms[i + 1];
                if (next.y < this.height - 20) {
                    let ladderX = current.x + current.width / 2 - 8;
                    // Adjust ladder position based on platform alignment
                    if (next.x < current.x + current.width / 2) {
                        ladderX = current.x + 4;
                    } else if (next.x > current.x + current.width / 2) {
                        ladderX = current.x + current.width - 20;
                    }
                    this.addLadder(layout, current, next, ladderX);
                }
            }
        }
        
        return layout;
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
        
        // Copy platforms and ladders
        this.platforms = layout.platforms.map(p => ({ ...p, type: 'platform' }));
        this.ladders = layout.ladders.map(l => ({ ...l }));
        
        // Scale difficulty
        const difficultyMultiplier = 1 + (this.level - 1) * 0.15;
        this.oligarch.speed = this.oligarch.baseSpeed * difficultyMultiplier;
        this.oligarch.throwingInterval = Math.max(60, this.oligarch.baseThrowingInterval / difficultyMultiplier);
        
        // Spawn power-ups (more in later levels)
        const powerUpCount = Math.min(2 + Math.floor(this.level / 5), 5);
        const usedPositions = [];
        
        for (let i = 0; i < powerUpCount; i++) {
            // Find a platform to place power-up on
            let platform;
            let attempts = 0;
            do {
                platform = this.platforms[Math.floor(Math.random() * (this.platforms.length - 1))]; // Skip ground
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
        
        // Position player at bottom
        this.player.x = 50;
        this.player.y = this.height - 100;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.onGround = false;
        this.player.onLadder = false;
        this.player.climbing = false;
        this.player.speed = this.player.baseSpeed;
        
        // Position oligarch at top
        this.oligarch.x = this.width - 100;
        this.oligarch.y = 50;
        this.oligarch.throwingTimer = 0;
        
        // Position retirement goal
        this.retirementGoal.x = this.width - 120;
        this.retirementGoal.y = 30;
        this.retirementGoal.glowTimer = 0;
        
        // Clear trail
        this.playerTrail.clear();
    }
    
    setupInput() {
        this.keydownHandler = (e) => {
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
        
        // Check win condition (reach retirement goal)
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
            this.player.speed = this.player.baseSpeed * 1.5;
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
                        this.player.vy = -this.player.speed * 1.2;
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
                        this.player.vy = this.player.speed * 1.2;
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
        
        // Horizontal movement - ONLY if NOT on ladder
        if (!this.player.onLadder && !this.player.climbing) {
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.vx = -this.player.speed;
            this.player.direction = -1;
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.vx = this.player.speed;
            this.player.direction = 1;
        } else {
            this.player.vx *= this.friction;
        }
        } else {
            // On ladder - absolutely no horizontal movement
                this.player.vx = 0;
        }
        
        // Jumping (on ground OR at top of ladder to jump onto platform)
        if ((this.keys['ArrowUp'] || this.keys['KeyW']) && !this.player.climbing) {
            if (this.player.onGround) {
                // Normal ground jump
                this.player.vy = -this.player.jumpPower;
                this.player.onGround = false;
                this.particles.sparkBurst(this.player.x + this.player.width / 2, this.player.y + this.player.height, 5, '#00ffff');
            } else if (this.player.atLadderTop || (wasOnLadder && !this.player.onLadder && !this.player.onGround)) {
                // At ladder top OR just exited ladder - allow jump to reach platform
                this.player.vy = -this.player.jumpPower * 0.85; // Strong jump from ladder top
                this.particles.sparkBurst(this.player.x + this.player.width / 2, this.player.y + this.player.height, 3, '#00ffff');
                // Clear ladder state after jumping
                this.player.onLadder = false;
                this.player.climbing = false;
                this.player.atLadderTop = false;
            }
        }
        
        // Apply gravity - CRITICAL: always apply if not actively climbing
        // If horizontal input is pressed while on ladder, force exit and apply gravity
        if (horizontalInput && wasOnLadder) {
            // Force exit ladder if horizontal key is pressed
            this.player.onLadder = false;
            this.player.climbing = false;
        }
        
        if (!this.player.climbing && !this.player.onLadder) {
            // Not climbing and not on ladder - apply full gravity
            this.player.vy += this.gravity;
        } else if (this.player.climbing && !this.player.onLadder) {
            // Was climbing but no longer on ladder - apply gravity immediately
            this.player.vy += this.gravity;
            this.player.climbing = false;
        }
        
        // Update position
        this.player.x += this.player.vx;
        this.player.y += this.player.vy;
        
        // Keep player on screen
        this.player.x = Math.max(0, Math.min(this.width - this.player.width, this.player.x));
        
        // Add to motion trail
        if (Math.abs(this.player.vx) > 0.1 || Math.abs(this.player.vy) > 0.1) {
            this.playerTrail.addPoint(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2,
                this.player.invincible ? '#ffff00' : '#00ffff',
                3
            );
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
        const speedMultiplier = 1 + (this.level - 1) * 0.1;
        
        // Calculate direction toward player with random variation
        const playerX = this.player.x + this.player.width / 2;
        const playerY = this.player.y + this.player.height / 2;
        const oligarchX = this.oligarch.x + this.oligarch.width / 2;
        const oligarchY = this.oligarch.y + this.oligarch.height / 2;
        
        // Direction toward player
        const dx = playerX - oligarchX;
        const dy = Math.abs(playerY - oligarchY); // Always ensure downward component
        
        // Random angle variation (30 degrees each side)
        const baseAngle = Math.atan2(dy, Math.abs(dx));
        const angleVariation = (Math.random() - 0.5) * (Math.PI / 6); // ±30 degrees
        const throwAngle = baseAngle + angleVariation;
        
        // Ensure angle is downward (between 30 and 150 degrees from horizontal)
        const minAngle = Math.PI / 6; // 30 degrees
        const maxAngle = Math.PI * 5 / 6; // 150 degrees
        const clampedAngle = Math.max(minAngle, Math.min(maxAngle, throwAngle));
        
        // Calculate velocity (always downward)
        const speed = 2 + speedMultiplier;
        const vx = Math.cos(clampedAngle) * (dx >= 0 ? 1 : -1) * speed;
        const vy = Math.abs(Math.sin(clampedAngle)) * speed; // Always positive (downward)
        
        this.moneyBags.push({
            x: this.oligarch.x + 20,
            y: this.oligarch.y + 30,
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
            moneyBag.vy += this.gravity * timeScale;
            
            // Update position
            moneyBag.x += moneyBag.vx * timeScale;
            moneyBag.y += moneyBag.vy * timeScale;
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
                    if (platform.type !== 'ground') {
                        const speedMultiplier = 1 + (this.level - 1) * 0.1;
                        moneyBag.vx = 1.5 * speedMultiplier * (moneyBag.vx > 0 ? 1 : -1);
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
                    } else if (this.player.vy > 0 || this.player.vy < 0) {
                        // Normal falling collision
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
                    this.particles.explode(moneyBag.x + moneyBag.width/2, moneyBag.y + moneyBag.height/2, 10, '#ff0000');
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
        this.screenEffects.flash(powerUpData.color, 10, 0.5);
        this.particles.glowExplosion(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2, 20, powerUpData.color);
        
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
                this.screenEffects.shake(3, 5);
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
        this.particles.update();
        this.screenEffects.update();
        this.tweenManager.update(performance.now());
        this.playerTrail.update();
    }
    
    levelUp() {
        if (this.level < this.maxLevel) {
        this.level++;
            this.score += 1000 * this.level;
            this.screenEffects.flash('#00ff00', 15, 0.4);
            this.screenEffects.ripple(this.retirementGoal.x + this.retirementGoal.width/2, 
                                     this.retirementGoal.y + this.retirementGoal.height/2, 200);
            this.particles.glowExplosion(this.retirementGoal.x + this.retirementGoal.width/2,
                                        this.retirementGoal.y + this.retirementGoal.height/2,
                                        30, '#00ff00');
        this.generateLevel();
        } else {
            this.gameComplete();
        }
    }
    
    gameComplete() {
        this.gameState = 'complete';
        this.score += 5000; // Bonus for completion
        this.screenEffects.flash('#ffd700', 30, 0.6);
        
        if (highScoreManager.checkHighScore('working-man', this.score)) {
            highScoreManager.requestNameEntry('working-man', this.score);
        }
    }
    
    loseLife() {
        if (this.player.invincible) return;
        
        this.lives--;
        this.screenEffects.shake(8, 15);
        this.screenEffects.flash('#ff0000', 10, 0.5);
        this.particles.explode(this.player.x + this.player.width/2, this.player.y + this.player.height/2, 15, '#ff0000');
        this.particles.sparkBurst(this.player.x + this.player.width/2, this.player.y + this.player.height/2, 10, '#ff6600');
        
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
            this.playerTrail.clear();
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
        
        // Apply screen effects transform
        const transform = this.screenEffects.getTransform();
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
            this.playerTrail.draw(this.ctx);
            
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
        
        // Draw screen effects
        this.screenEffects.drawFlash();
        this.screenEffects.drawRipple();
        
        // Draw CRT filter
        this.crtFilter.draw(this.ctx);
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
        // Animate glow effect
        this.retirementGoal.glowTimer += 0.1;
        const glowIntensity = Math.sin(this.retirementGoal.glowTimer) * 0.3 + 0.7;
        
        // Draw glow
        this.ctx.shadowColor = '#00ff00';
        this.ctx.shadowBlur = 20 * glowIntensity;
        
        // Draw retirement cottage/house
        this.ctx.fillStyle = `rgba(139, 69, 19, ${glowIntensity})`;
        this.ctx.fillRect(this.retirementGoal.x, this.retirementGoal.y, this.retirementGoal.width, this.retirementGoal.height);
        
        // Draw roof
        this.ctx.fillStyle = `rgba(139, 0, 0, ${glowIntensity})`;
        this.ctx.beginPath();
        this.ctx.moveTo(this.retirementGoal.x - 10, this.retirementGoal.y);
        this.ctx.lineTo(this.retirementGoal.x + this.retirementGoal.width/2, this.retirementGoal.y - 20);
        this.ctx.lineTo(this.retirementGoal.x + this.retirementGoal.width + 10, this.retirementGoal.y);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw door
        this.ctx.fillStyle = `rgba(101, 67, 33, ${glowIntensity})`;
        this.ctx.fillRect(this.retirementGoal.x + 30, this.retirementGoal.y + 5, 20, 15);
        
        // Draw windows
        this.ctx.fillStyle = `rgba(135, 206, 235, ${glowIntensity})`;
        this.ctx.fillRect(this.retirementGoal.x + 10, this.retirementGoal.y + 8, 12, 8);
        this.ctx.fillRect(this.retirementGoal.x + 60, this.retirementGoal.y + 8, 12, 8);
        
        // Draw chimney
        this.ctx.fillStyle = `rgba(105, 105, 105, ${glowIntensity})`;
        this.ctx.fillRect(this.retirementGoal.x + 70, this.retirementGoal.y - 15, 8, 15);
        
        // Draw smoke particles
        for (let i = 0; i < 3; i++) {
            const smokeY = this.retirementGoal.y - 20 - (Math.sin(this.retirementGoal.glowTimer + i) * 5);
        this.ctx.fillStyle = `rgba(192, 192, 192, ${glowIntensity * 0.7})`;
        this.ctx.beginPath();
            this.ctx.arc(this.retirementGoal.x + 74, smokeY, 2 + i, 0, Math.PI * 2);
        this.ctx.fill();
        }
        
        this.ctx.shadowBlur = 0;
        
        // Draw border
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.retirementGoal.x, this.retirementGoal.y, this.retirementGoal.width, this.retirementGoal.height);
        
        // Draw "RETIREMENT" text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('RETIREMENT', this.retirementGoal.x + this.retirementGoal.width/2, this.retirementGoal.y - 5);
        this.ctx.textAlign = 'left';
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
        
        // Draw retirement goal
        this.ctx.fillStyle = '#ffff00';
        this.ctx.fillRect(this.width - 100, 15, 60, 12);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '8px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GOAL', this.width - 70, 23);
        this.ctx.textAlign = 'left';
        
        // Draw title overlay
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('WORKING MAN', this.width / 2, this.height - 10);
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
            this.ctx.fillText('WORKING MAN vs OLIGARCH', this.width / 2, this.height / 2 - 50);
            this.ctx.fillText('Climb to reach the Oligarch!', this.width / 2, this.height / 2 - 20);
            this.ctx.font = '16px Courier New';
            this.ctx.fillText('Arrow Keys: Move | Up: Jump/Climb Up | Down: Climb Down', this.width / 2, this.height / 2 + 10);
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
            this.ctx.fillText('You reached retirement!', this.width / 2, this.height / 2 - 10);
            this.ctx.fillText(`Final Score: ${Utils.formatScore(this.score)}`, this.width / 2, this.height / 2 + 25);
            this.ctx.fillText('Press SPACE to play again', this.width / 2, this.height / 2 + 55);
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
