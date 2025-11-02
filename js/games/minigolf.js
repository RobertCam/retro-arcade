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
        this.maxSinkSpeed = 1.5; // Maximum velocity to sink ball (lower = easier to go too fast)
        
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
        
        // Initialize graphics and start loop
        if (this.isPreview) {
            this.drawPreview();
        } else {
            this.initGraphics();
        }
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
        const hole = {
            startX: margin + 100,
            startY: margin + courseHeight / 2,
            holeX: margin + courseWidth - 100,
            holeY: margin + courseHeight / 2,
            holeRadius: 12,
            par: 3,
            walls: [],
            obstacles: []
        };
        
        const pathWidth = 55; // Width of the playing path (narrower = more difficult)
        const wallOffset = 30; // Distance from edge for walls
        
        // Create 18 distinct, realistic minigolf holes
        switch(holeNumber) {
            case 0: // Hole 1: Straight Shot (Warm-up)
                hole.startX = margin + 50;
                hole.startY = margin + courseHeight / 2;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight / 2;
                hole.par = 3;
                
                hole.walls = [
                    [margin, margin + wallOffset, margin + courseWidth, margin + wallOffset],
                    [margin + courseWidth, margin + wallOffset, margin + courseWidth, margin + courseHeight - wallOffset],
                    [margin + courseWidth, margin + courseHeight - wallOffset, margin, margin + courseHeight - wallOffset],
                    [margin, margin + courseHeight - wallOffset, margin, margin + wallOffset]
                ];
                break;
                
            case 1: // Hole 2: Dogleg Right
                hole.startX = margin + 50;
                hole.startY = margin + courseHeight - 70;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + 70;
                hole.par = 4;
                
                const turn1X = margin + courseWidth * 0.65;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Turn barrier
                    [turn1X - pathWidth / 2, margin, turn1X - pathWidth / 2, margin + courseHeight * 0.4],
                    [turn1X + pathWidth / 2, margin + courseHeight * 0.6, turn1X + pathWidth / 2, margin + courseHeight]
                ];
                break;
                
            case 2: // Hole 3: Dogleg Left
                hole.startX = margin + 50;
                hole.startY = margin + 70;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight - 70;
                hole.par = 4;
                
                const turn2X = margin + courseWidth * 0.35;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Turn barrier
                    [turn2X - pathWidth / 2, margin + courseHeight * 0.6, turn2X - pathWidth / 2, margin + courseHeight],
                    [turn2X + pathWidth / 2, margin, turn2X + pathWidth / 2, margin + courseHeight * 0.4]
                ];
                break;
                
            case 3: // Hole 4: S-Curve
                hole.startX = margin + 50;
                hole.startY = margin + 100;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight - 100;
                hole.par = 4;
                
                const s1 = margin + courseWidth * 0.3;
                const s2 = margin + courseWidth * 0.7;
                const sMid = margin + courseHeight / 2;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // S-curve barriers
                    [s1 - pathWidth / 2, margin + 60, s1 - pathWidth / 2, sMid - 40],
                    [s1 + pathWidth / 2, sMid + 40, s1 + pathWidth / 2, margin + courseHeight - 60],
                    [s2 - pathWidth / 2, margin + courseHeight - 60, s2 - pathWidth / 2, sMid + 40],
                    [s2 + pathWidth / 2, sMid - 40, s2 + pathWidth / 2, margin + 60]
                ];
                break;
                
            case 4: // Hole 5: Zigzag
                hole.startX = margin + 50;
                hole.startY = margin + courseHeight / 2;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight / 2;
                hole.par = 4;
                
                const z1 = margin + courseWidth * 0.3;
                const z2 = margin + courseWidth * 0.6;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Zigzag barriers
                    [z1 - pathWidth / 2, margin + 80, z1 - pathWidth / 2, margin + courseHeight - 80],
                    [z1 + pathWidth / 2, margin, z1 + pathWidth / 2, margin + courseHeight - 120],
                    [z2 - pathWidth / 2, margin + 120, z2 - pathWidth / 2, margin + courseHeight],
                    [z2 + pathWidth / 2, margin + 80, z2 + pathWidth / 2, margin + courseHeight - 80]
                ];
                break;
                
            case 5: // Hole 6: Narrow Channel
                hole.startX = margin + 50;
                hole.startY = margin + courseHeight / 2;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight / 2;
                hole.par = 4;
                
                const narrowWidth = 40; // Narrower channel
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Narrow channel
                    [margin + courseWidth * 0.2, margin + courseHeight / 2 - narrowWidth / 2, 
                     margin + courseWidth * 0.8, margin + courseHeight / 2 - narrowWidth / 2],
                    [margin + courseWidth * 0.2, margin + courseHeight / 2 + narrowWidth / 2, 
                     margin + courseWidth * 0.8, margin + courseHeight / 2 + narrowWidth / 2]
                ];
                break;
                
            case 6: // Hole 7: Windmill Classic
                hole.startX = margin + 50;
                hole.startY = margin + courseHeight / 2;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight / 2;
                hole.par = 4;
                
                const wmX = margin + courseWidth / 2;
                const wmY = margin + courseHeight / 2;
                hole.obstacles.push({
                    type: 'windmill',
                    x: wmX,
                    y: wmY,
                    radius: 45,
                    rotation: 0,
                    rotationSpeed: 0.035, // Faster rotation
                    blades: 4
                });
                
                const wmRadius = 60;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Path around windmill
                    [margin + 40, wmY - pathWidth / 2, wmX - wmRadius, wmY - pathWidth / 2],
                    [margin + 40, wmY + pathWidth / 2, wmX - wmRadius, wmY + pathWidth / 2],
                    [wmX + wmRadius, wmY - pathWidth / 2, margin + courseWidth - 40, wmY - pathWidth / 2],
                    [wmX + wmRadius, wmY + pathWidth / 2, margin + courseWidth - 40, wmY + pathWidth / 2],
                    [margin + 40, margin, margin + 40, wmY - pathWidth / 2],
                    [margin + 40, wmY + pathWidth / 2, margin + 40, margin + courseHeight],
                    [margin + courseWidth - 40, margin, margin + courseWidth - 40, wmY - pathWidth / 2],
                    [margin + courseWidth - 40, wmY + pathWidth / 2, margin + courseWidth - 40, margin + courseHeight]
                ];
                break;
                
            case 7: // Hole 8: Double Windmill
                hole.startX = margin + 50;
                hole.startY = margin + 80;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight - 80;
                hole.par = 5;
                
                hole.obstacles.push({
                    type: 'windmill',
                    x: margin + courseWidth * 0.4,
                    y: margin + courseHeight * 0.4,
                    radius: 35,
                    rotation: 0,
                    rotationSpeed: 0.04, // Faster rotation
                    blades: 4
                });
                
                hole.obstacles.push({
                    type: 'windmill',
                    x: margin + courseWidth * 0.65,
                    y: margin + courseHeight * 0.65,
                    radius: 35,
                    rotation: Math.PI / 4,
                    rotationSpeed: -0.035, // Faster rotation
                    blades: 4
                });
                
                // Winding path around both windmills
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Path segments
                    [margin + 40, margin + 60, margin + courseWidth * 0.35, margin + 60],
                    [margin + courseWidth * 0.45, margin + 60, margin + courseWidth * 0.6, margin + 60],
                    [margin + courseWidth * 0.7, margin + 60, margin + courseWidth - 40, margin + 60],
                    [margin + 40, margin + courseHeight - 60, margin + courseWidth * 0.35, margin + courseHeight - 60],
                    [margin + courseWidth * 0.45, margin + courseHeight - 60, margin + courseWidth * 0.6, margin + courseHeight - 60],
                    [margin + courseWidth * 0.7, margin + courseHeight - 60, margin + courseWidth - 40, margin + courseHeight - 60],
                    [margin + 40, margin, margin + 40, margin + 60],
                    [margin + 40, margin + courseHeight - 60, margin + 40, margin + courseHeight],
                    [margin + courseWidth - 40, margin, margin + courseWidth - 40, margin + 60],
                    [margin + courseWidth - 40, margin + courseHeight - 60, margin + courseWidth - 40, margin + courseHeight]
                ];
                break;
                
            case 8: // Hole 9: U-Turn
                hole.startX = margin + 50;
                hole.startY = margin + 80;
                hole.holeX = margin + 50;
                hole.holeY = margin + courseHeight - 80;
                hole.par = 5;
                
                const uTurnX = margin + courseWidth * 0.75;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // U-turn barrier
                    [uTurnX - pathWidth / 2, margin + 60, uTurnX - pathWidth / 2, margin + courseHeight - 60],
                    [uTurnX + pathWidth / 2, margin + 60, uTurnX + pathWidth / 2, margin + courseHeight - 60]
                ];
                break;
                
            case 9: // Hole 10: Spiral In
                hole.startX = margin + courseWidth / 2;
                hole.startY = margin + courseHeight - 60;
                hole.holeX = margin + courseWidth / 2;
                hole.holeY = margin + 60;
                hole.par = 5;
                
                const centerX = margin + courseWidth / 2;
                const centerY = margin + courseHeight / 2;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Spiral barriers
                    [centerX - 80, margin + 100, centerX - 80, margin + courseHeight - 100],
                    [centerX + 80, margin + 100, centerX + 80, margin + courseHeight - 100],
                    [centerX - 80, centerY, centerX + 80, centerY],
                    [margin + 100, centerY - 50, margin + 100, centerY + 50],
                    [margin + courseWidth - 100, centerY - 50, margin + courseWidth - 100, centerY + 50]
                ];
                break;
                
            case 10: // Hole 11: Triangle Course
                hole.startX = margin + courseWidth / 2;
                hole.startY = margin + courseHeight - 70;
                hole.holeX = margin + courseWidth / 2;
                hole.holeY = margin + 70;
                hole.par = 4;
                
                const triX1 = margin + courseWidth * 0.3;
                const triX2 = margin + courseWidth * 0.7;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Triangle barriers
                    [triX1, margin + courseHeight * 0.3, triX2, margin + courseHeight * 0.3],
                    [triX1, margin + courseHeight * 0.7, triX2, margin + courseHeight * 0.7],
                    [triX1, margin + 100, triX1, margin + courseHeight - 100],
                    [triX2, margin + 100, triX2, margin + courseHeight - 100]
                ];
                break;
                
            case 11: // Hole 12: Snake Course
                hole.startX = margin + 50;
                hole.startY = margin + courseHeight / 2;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight / 2;
                hole.par = 5;
                
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Snake barriers
                    [margin + courseWidth * 0.2, margin + 80, margin + courseWidth * 0.2, margin + courseHeight * 0.4],
                    [margin + courseWidth * 0.35, margin + courseHeight * 0.6, margin + courseWidth * 0.35, margin + courseHeight - 80],
                    [margin + courseWidth * 0.5, margin + 80, margin + courseWidth * 0.5, margin + courseHeight * 0.4],
                    [margin + courseWidth * 0.65, margin + courseHeight * 0.6, margin + courseWidth * 0.65, margin + courseHeight - 80],
                    [margin + courseWidth * 0.8, margin + 80, margin + courseWidth * 0.8, margin + courseHeight * 0.4]
                ];
                break;
                
            case 12: // Hole 13: Loop de Loop (simplified as sharp curves)
                hole.startX = margin + 50;
                hole.startY = margin + courseHeight / 2;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight / 2;
                hole.par = 5;
                
                const loopX1 = margin + courseWidth * 0.3;
                const loopX2 = margin + courseWidth * 0.7;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Loop barriers (sharp turns)
                    [loopX1 - pathWidth / 2, margin + 60, loopX1 - pathWidth / 2, margin + courseHeight * 0.35],
                    [loopX1 - pathWidth / 2, margin + courseHeight * 0.65, loopX1 - pathWidth / 2, margin + courseHeight - 60],
                    [loopX1 + pathWidth / 2, margin + courseHeight * 0.65, loopX1 + pathWidth / 2, margin + courseHeight - 60],
                    [loopX1 + pathWidth / 2, margin + 60, loopX1 + pathWidth / 2, margin + courseHeight * 0.35],
                    [loopX2 - pathWidth / 2, margin + 60, loopX2 - pathWidth / 2, margin + courseHeight * 0.35],
                    [loopX2 - pathWidth / 2, margin + courseHeight * 0.65, loopX2 - pathWidth / 2, margin + courseHeight - 60],
                    [loopX2 + pathWidth / 2, margin + courseHeight * 0.65, loopX2 + pathWidth / 2, margin + courseHeight - 60],
                    [loopX2 + pathWidth / 2, margin + 60, loopX2 + pathWidth / 2, margin + courseHeight * 0.35]
                ];
                break;
                
            case 13: // Hole 14: Corner Pocket
                hole.startX = margin + 50;
                hole.startY = margin + 50;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight - 50;
                hole.par = 4;
                
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Corner barriers
                    [margin + courseWidth * 0.4, margin + 60, margin + courseWidth * 0.4, margin + courseHeight * 0.5],
                    [margin + courseWidth * 0.6, margin + courseHeight * 0.5, margin + courseWidth * 0.6, margin + courseHeight - 60],
                    [margin + 60, margin + courseHeight * 0.4, margin + courseWidth * 0.5, margin + courseHeight * 0.4],
                    [margin + courseWidth * 0.5, margin + courseHeight * 0.6, margin + courseWidth - 60, margin + courseHeight * 0.6]
                ];
                break;
                
            case 14: // Hole 15: Double Windmill Challenge
                hole.startX = margin + 50;
                hole.startY = margin + courseHeight / 2;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight / 2;
                hole.par = 5;
                
                hole.obstacles.push({
                    type: 'windmill',
                    x: margin + courseWidth * 0.35,
                    y: margin + courseHeight * 0.5,
                    radius: 38,
                    rotation: 0,
                    rotationSpeed: 0.04, // Faster rotation
                    blades: 4
                });
                
                hole.obstacles.push({
                    type: 'windmill',
                    x: margin + courseWidth * 0.65,
                    y: margin + courseHeight * 0.5,
                    radius: 38,
                    rotation: Math.PI / 3,
                    rotationSpeed: -0.038, // Faster rotation
                    blades: 4
                });
                
                const wm1X = margin + courseWidth * 0.35;
                const wm2X = margin + courseWidth * 0.65;
                const wmR = 55;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Paths around both windmills
                    [margin + 40, margin + courseHeight / 2 - pathWidth / 2, wm1X - wmR, margin + courseHeight / 2 - pathWidth / 2],
                    [margin + 40, margin + courseHeight / 2 + pathWidth / 2, wm1X - wmR, margin + courseHeight / 2 + pathWidth / 2],
                    [wm1X + wmR, margin + courseHeight / 2 - pathWidth / 2, wm2X - wmR, margin + courseHeight / 2 - pathWidth / 2],
                    [wm1X + wmR, margin + courseHeight / 2 + pathWidth / 2, wm2X - wmR, margin + courseHeight / 2 + pathWidth / 2],
                    [wm2X + wmR, margin + courseHeight / 2 - pathWidth / 2, margin + courseWidth - 40, margin + courseHeight / 2 - pathWidth / 2],
                    [wm2X + wmR, margin + courseHeight / 2 + pathWidth / 2, margin + courseWidth - 40, margin + courseHeight / 2 + pathWidth / 2],
                    [margin + 40, margin, margin + 40, margin + courseHeight / 2 - pathWidth / 2],
                    [margin + 40, margin + courseHeight / 2 + pathWidth / 2, margin + 40, margin + courseHeight],
                    [margin + courseWidth - 40, margin, margin + courseWidth - 40, margin + courseHeight / 2 - pathWidth / 2],
                    [margin + courseWidth - 40, margin + courseHeight / 2 + pathWidth / 2, margin + courseWidth - 40, margin + courseHeight]
                ];
                break;
                
            case 15: // Hole 16: Figure-8
                hole.startX = margin + courseWidth / 2;
                hole.startY = margin + 100;
                hole.holeX = margin + courseWidth / 2;
                hole.holeY = margin + courseHeight - 100;
                hole.par = 5;
                
                const f8X = margin + courseWidth / 2;
                const f8Y1 = margin + courseHeight * 0.35;
                const f8Y2 = margin + courseHeight * 0.65;
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Figure-8 barriers
                    [f8X - pathWidth / 2, margin + 80, f8X - pathWidth / 2, f8Y1],
                    [f8X - pathWidth / 2, f8Y2, f8X - pathWidth / 2, margin + courseHeight - 80],
                    [f8X + pathWidth / 2, margin + 80, f8X + pathWidth / 2, f8Y1],
                    [f8X + pathWidth / 2, f8Y2, f8X + pathWidth / 2, margin + courseHeight - 80],
                    [margin + 80, f8Y1, margin + courseWidth - 80, f8Y1],
                    [margin + 80, f8Y2, margin + courseWidth - 80, f8Y2]
                ];
                break;
                
            case 16: // Hole 17: Gauntlet (Multiple Barriers)
                hole.startX = margin + 50;
                hole.startY = margin + courseHeight / 2;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight / 2;
                hole.par = 5;
                
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Multiple staggered barriers
                    [margin + courseWidth * 0.2 - pathWidth / 2, margin + 100, margin + courseWidth * 0.2 - pathWidth / 2, margin + courseHeight - 100],
                    [margin + courseWidth * 0.2 + pathWidth / 2, margin + 120, margin + courseWidth * 0.2 + pathWidth / 2, margin + courseHeight - 120],
                    [margin + courseWidth * 0.4 - pathWidth / 2, margin + 120, margin + courseWidth * 0.4 - pathWidth / 2, margin + courseHeight - 120],
                    [margin + courseWidth * 0.4 + pathWidth / 2, margin + 100, margin + courseWidth * 0.4 + pathWidth / 2, margin + courseHeight - 100],
                    [margin + courseWidth * 0.6 - pathWidth / 2, margin + 100, margin + courseWidth * 0.6 - pathWidth / 2, margin + courseHeight - 100],
                    [margin + courseWidth * 0.6 + pathWidth / 2, margin + 120, margin + courseWidth * 0.6 + pathWidth / 2, margin + courseHeight - 120],
                    [margin + courseWidth * 0.8 - pathWidth / 2, margin + 120, margin + courseWidth * 0.8 - pathWidth / 2, margin + courseHeight - 120],
                    [margin + courseWidth * 0.8 + pathWidth / 2, margin + 100, margin + courseWidth * 0.8 + pathWidth / 2, margin + courseHeight - 100]
                ];
                break;
                
            case 17: // Hole 18: Final Challenge (Master Course)
                hole.startX = margin + 50;
                hole.startY = margin + 80;
                hole.holeX = margin + courseWidth - 50;
                hole.holeY = margin + courseHeight - 80;
                hole.par = 6;
                
                // Triple windmill challenge!
                hole.obstacles.push({
                    type: 'windmill',
                    x: margin + courseWidth * 0.3,
                    y: margin + courseHeight * 0.3,
                    radius: 32,
                    rotation: 0,
                    rotationSpeed: 0.045, // Faster rotation
                    blades: 4
                });
                
                hole.obstacles.push({
                    type: 'windmill',
                    x: margin + courseWidth * 0.5,
                    y: margin + courseHeight * 0.5,
                    radius: 32,
                    rotation: Math.PI / 4,
                    rotationSpeed: -0.04, // Faster rotation
                    blades: 4
                });
                
                hole.obstacles.push({
                    type: 'windmill',
                    x: margin + courseWidth * 0.7,
                    y: margin + courseHeight * 0.7,
                    radius: 32,
                    rotation: Math.PI / 2,
                    rotationSpeed: 0.038, // Faster rotation
                    blades: 4
                });
                
                // Complex winding path through all three
                hole.walls = [
                    [margin, margin, margin + courseWidth, margin],
                    [margin + courseWidth, margin, margin + courseWidth, margin + courseHeight],
                    [margin + courseWidth, margin + courseHeight, margin, margin + courseHeight],
                    [margin, margin + courseHeight, margin, margin],
                    // Winding path segments
                    [margin + 40, margin + 60, margin + courseWidth * 0.25, margin + 60],
                    [margin + courseWidth * 0.35, margin + 60, margin + courseWidth * 0.45, margin + 60],
                    [margin + courseWidth * 0.55, margin + 60, margin + courseWidth * 0.65, margin + 60],
                    [margin + courseWidth * 0.75, margin + 60, margin + courseWidth - 40, margin + 60],
                    [margin + 40, margin + courseHeight - 60, margin + courseWidth * 0.25, margin + courseHeight - 60],
                    [margin + courseWidth * 0.35, margin + courseHeight - 60, margin + courseWidth * 0.45, margin + courseHeight - 60],
                    [margin + courseWidth * 0.55, margin + courseHeight - 60, margin + courseWidth * 0.65, margin + courseHeight - 60],
                    [margin + courseWidth * 0.75, margin + courseHeight - 60, margin + courseWidth - 40, margin + courseHeight - 60],
                    [margin + 40, margin, margin + 40, margin + 60],
                    [margin + 40, margin + courseHeight - 60, margin + 40, margin + courseHeight],
                    [margin + courseWidth - 40, margin, margin + courseWidth - 40, margin + 60],
                    [margin + courseWidth - 40, margin + courseHeight - 60, margin + courseWidth - 40, margin + courseHeight]
                ];
                break;
        }
        
        return hole;
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
        
        // Set up ticker callback
        this.tickerCallback = (deltaTime) => {
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
        
        // Ensure ticker is running
        if (ticker && !ticker.started) {
            this.graphics.start();
        }
    }
    
    gameLoop(deltaTime) {
        // Always call update to handle sinking animation
        this.update(deltaTime);
        
        if (this.isPreview) {
            this.drawPreview();
            requestAnimationFrame(this.gameLoop);
        } else {
            this.drawPixi();
        }
    }
    
    update(deltaTime) {
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
        
        // Update obstacles (windmills)
        if (this.currentHoleData && this.currentHoleData.obstacles) {
            this.currentHoleData.obstacles.forEach(obstacle => {
                if (obstacle.type === 'windmill') {
                    obstacle.rotation += obstacle.rotationSpeed;
                }
            });
        }
        
        // Update ball physics if moving
        if (this.ball.isMoving && !this.sinking.isActive) {
            // Apply friction
            this.ball.vx *= this.friction;
            this.ball.vy *= this.friction;
            
            // Store old position for swept collision detection
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
            
            // Check obstacle collisions
            this.checkObstacleCollisions();
            
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
                const nx = -(y2 - y1) / lineLength; // Normal vector
                const ny = (x2 - x1) / lineLength;
                
                // Move ball to collision point
                ball.x = collision.x;
                ball.y = collision.y;
                
                // Reflect velocity
                const dot = ball.vx * nx + ball.vy * ny;
                ball.vx -= 2 * dot * nx * this.bounceCoefficient;
                ball.vy -= 2 * dot * ny * this.bounceCoefficient;
                
                // Move ball slightly away from wall to prevent stuck
                ball.x += nx * (ball.radius - collision.distance + 1);
                ball.y += ny * (ball.radius - collision.distance + 1);
            }
        }
    }
    
    // Swept circle-line segment collision detection
    sweptCircleLineCollision(cx0, cy0, cx1, cy1, radius, x1, y1, x2, y2) {
        // First check if we're already colliding
        const currentDist = this.distanceToLineSegment(cx1, cy1, x1, y1, x2, y2);
        if (currentDist < radius) {
            return {
                x: cx1,
                y: cy1,
                distance: currentDist
            };
        }
        
        // Check along the movement path
        // Use multiple steps to find collision point
        const steps = Math.max(10, Math.ceil(Math.sqrt((cx1 - cx0) ** 2 + (cy1 - cy0) ** 2) / (radius * 0.5)));
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const testX = cx0 + (cx1 - cx0) * t;
            const testY = cy0 + (cy1 - cy0) * t;
            
            const dist = this.distanceToLineSegment(testX, testY, x1, y1, x2, y2);
            
            if (dist < radius) {
                return {
                    x: testX,
                    y: testY,
                    distance: dist
                };
            }
        }
        
        return null;
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
    
    checkObstacleCollisions() {
        if (!this.currentHoleData || !this.currentHoleData.obstacles) return;
        
        const ball = this.ball;
        
        for (let obstacle of this.currentHoleData.obstacles) {
            if (obstacle.type === 'windmill') {
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
        if (!this.graphics) return;
        
        const bgLayer = this.graphics.getLayer('background');
        const gameLayer = this.graphics.getLayer('foreground');
        const uiLayer = this.graphics.getLayer('ui');
        
        // Clear layers
        bgLayer.removeChildren();
        gameLayer.removeChildren();
        uiLayer.removeChildren();
        
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
        // Draw green course area
        const course = new PIXI.Graphics();
        course.beginFill(0x2d7a4d); // Darker green
        course.drawRect(0, 0, this.width, this.height);
        course.endFill();
        bgLayer.addChild(course);
    }
    
    drawHole(gameLayer) {
        if (!this.currentHoleData) return;
        
        const hole = this.currentHoleData;
        
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
    
    drawObstacles(gameLayer) {
        if (!this.currentHoleData || !this.currentHoleData.obstacles) return;
        
        for (let obstacle of this.currentHoleData.obstacles) {
            if (obstacle.type === 'windmill') {
                const windmill = new PIXI.Graphics();
                
                // Draw windmill base
                windmill.beginFill(0x8b4513); // Brown
                windmill.drawCircle(obstacle.x, obstacle.y, obstacle.radius * 0.3);
                windmill.endFill();
                
                // Draw rotating blades
                windmill.lineStyle(3, 0x654321, 1);
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
            }
        }
    }
    
    drawWalls(gameLayer) {
        if (!this.currentHoleData) return;
        
        const walls = new PIXI.Graphics();
        walls.lineStyle(8, 0x8B4513, 1); // Brown walls - thicker and darker
        
        for (let wall of this.currentHoleData.walls) {
            const [x1, y1, x2, y2] = wall;
            walls.moveTo(x1, y1);
            walls.lineTo(x2, y2);
        }
        
        // Also draw filled rectangles for better visibility
        walls.lineStyle(0); // No outline for filled shapes
        walls.beginFill(0x8B4513, 1); // Brown fill
        for (let wall of this.currentHoleData.walls) {
            const [x1, y1, x2, y2] = wall;
            const thickness = 8;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const perpAngle = angle + Math.PI / 2;
            const offsetX = Math.cos(perpAngle) * (thickness / 2);
            const offsetY = Math.sin(perpAngle) * (thickness / 2);
            
            walls.drawPolygon([
                x1 + offsetX, y1 + offsetY,
                x2 + offsetX, y2 + offsetY,
                x2 - offsetX, y2 - offsetY,
                x1 - offsetX, y1 - offsetY
            ]);
        }
        walls.endFill();
        
        gameLayer.addChild(walls);
    }
    
    drawBall(gameLayer) {
        const ball = this.ball;
        
        if (this.sinking.isActive) {
            // Draw sinking ball with animation
            const ballSprite = new PIXI.Graphics();
            ballSprite.beginFill(parseInt(ball.color.replace('#', '0x')), this.sinking.alpha);
            ballSprite.drawCircle(ball.x, ball.y, ball.radius * this.sinking.scale);
            ballSprite.endFill();
            gameLayer.addChild(ballSprite);
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
        // Remove event listeners
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
        }
        if (this.mouseDownHandler) {
            this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
        }
        if (this.mouseMoveHandler) {
            this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
        }
        if (this.mouseUpHandler) {
            this.canvas.removeEventListener('mouseup', this.mouseUpHandler);
        }
        if (this.globalMouseMoveHandler) {
            document.removeEventListener('mousemove', this.globalMouseMoveHandler);
        }
        if (this.globalMouseUpHandler) {
            document.removeEventListener('mouseup', this.globalMouseUpHandler);
        }
        
        // Clean up PixiJS
        if (!this.isPreview && this.graphics) {
            const ticker = this.graphics.getTicker();
            if (ticker && this.tickerCallback) {
                ticker.remove(this.tickerCallback);
            }
            if (this.graphics.app) {
                this.graphics.app.destroy(true, { children: true, texture: true, baseTexture: true });
            }
        }
        
        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
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
