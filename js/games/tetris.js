// Classic Tetris game implementation - PixiJS version
class TetrisGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Check if this is a preview canvas (smaller)
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
        this.level = 1;
        this.lines = 0;
        
        // Board dimensions
        this.cols = 10;
        this.rows = 20;
        this.cellSize = this.isPreview ? 8 : 25;
        
        // Calculate board position (centered)
        if (this.isPreview) {
            this.boardX = (this.width - this.cols * this.cellSize) / 2;
            this.boardY = 10;
        } else {
            this.boardX = 250;
            this.boardY = 50;
        }
        
        // Game board (2D array: 0 = empty, 1-7 = piece type)
        this.board = [];
        this.initializeBoard();
        
        // Current piece
        this.currentPiece = null;
        this.currentX = 0;
        this.currentY = 0;
        this.currentRotation = 0;
        
        // Next piece
        this.nextPiece = null;
        
        // Drop timing
        this.dropTime = 0;
        this.dropInterval = 1000; // milliseconds
        this.lastDropTime = 0;
        
        // Lock delay
        this.lockDelay = 500; // milliseconds
        this.lockTime = 0;
        this.isLocking = false;
        
        // Ghost piece (preview of where piece will land)
        this.showGhost = true;
        
        // Line clear animation
        this.linesClearing = []; // Track lines being cleared
        this.lineClearAnimationTime = 0;
        this.lastLineClearData = null; // Store last line clear info for display
        this.lineClearDisplayTime = 0;
        
        // Tetromino definitions (I, O, T, S, Z, J, L)
        this.tetrominoes = {
            'I': {
                shape: [
                    [[0,0,0,0],
                     [1,1,1,1],
                     [0,0,0,0],
                     [0,0,0,0]],
                    [[0,0,1,0],
                     [0,0,1,0],
                     [0,0,1,0],
                     [0,0,1,0]],
                    [[0,0,0,0],
                     [0,0,0,0],
                     [1,1,1,1],
                     [0,0,0,0]],
                    [[0,1,0,0],
                     [0,1,0,0],
                     [0,1,0,0],
                     [0,1,0,0]]
                ],
                color: '#00ffff', // Cyan
                rotations: 4
            },
            'O': {
                shape: [
                    [[1,1],
                     [1,1]]
                ],
                color: '#ffff00', // Yellow
                rotations: 1
            },
            'T': {
                shape: [
                    [[0,1,0],
                     [1,1,1],
                     [0,0,0]],
                    [[0,1,0],
                     [0,1,1],
                     [0,1,0]],
                    [[0,0,0],
                     [1,1,1],
                     [0,1,0]],
                    [[0,1,0],
                     [1,1,0],
                     [0,1,0]]
                ],
                color: '#a000f0', // Purple
                rotations: 4
            },
            'S': {
                shape: [
                    [[0,1,1],
                     [1,1,0],
                     [0,0,0]],
                    [[0,1,0],
                     [0,1,1],
                     [0,0,1]],
                    [[0,0,0],
                     [0,1,1],
                     [1,1,0]],
                    [[1,0,0],
                     [1,1,0],
                     [0,1,0]]
                ],
                color: '#00f000', // Green
                rotations: 4
            },
            'Z': {
                shape: [
                    [[1,1,0],
                     [0,1,1],
                     [0,0,0]],
                    [[0,0,1],
                     [0,1,1],
                     [0,1,0]],
                    [[0,0,0],
                     [1,1,0],
                     [0,1,1]],
                    [[0,1,0],
                     [1,1,0],
                     [1,0,0]]
                ],
                color: '#f00000', // Red
                rotations: 4
            },
            'J': {
                shape: [
                    [[1,0,0],
                     [1,1,1],
                     [0,0,0]],
                    [[0,1,1],
                     [0,1,0],
                     [0,1,0]],
                    [[0,0,0],
                     [1,1,1],
                     [0,0,1]],
                    [[0,1,0],
                     [0,1,0],
                     [1,1,0]]
                ],
                color: '#0000f0', // Blue
                rotations: 4
            },
            'L': {
                shape: [
                    [[0,0,1],
                     [1,1,1],
                     [0,0,0]],
                    [[0,1,0],
                     [0,1,0],
                     [0,1,1]],
                    [[0,0,0],
                     [1,1,1],
                     [1,0,0]],
                    [[1,1,0],
                     [0,1,0],
                     [0,1,0]]
                ],
                color: '#f0a000', // Orange
                rotations: 4
            }
        };
        
        // Piece type to color mapping
        this.pieceColors = {
            'I': '#00ffff',
            'O': '#ffff00',
            'T': '#a000f0',
            'S': '#00f000',
            'Z': '#f00000',
            'J': '#0000f0',
            'L': '#f0a000'
        };
        
        // Input handling
        this.keys = {};
        this.keyRepeatDelay = 150; // ms before repeat starts
        this.keyRepeatInterval = 50; // ms between repeats
        this.lastKeyPress = {};
        this.setupInput();
        
        // Effects
        if (this.isPreview) {
            this.particles = new ParticleSystem();
            this.screenEffects = new ScreenEffects(canvas);
            this.crtFilter = new CRTFilter(canvas);
        } else {
            this.particles = null; // Will create PixiJS particles as needed
            this.screenEffects = null; // Will be set from nesEffects
            this.crtFilter = null; // CRT handled by NES effects
        }
        
        // PixiJS sprites (only for main game)
        if (!this.isPreview) {
            this.boardSprites = [];
            this.currentPieceSprite = null;
            this.ghostPieceSprite = null;
            this.nextPieceSprite = null;
        }
        
        // If preview, draw static preview
        if (this.isPreview) {
            this.drawPreview();
            return;
        }
        
        // Start game loop
        this.lastTime = 0;
        this.gameLoop = this.gameLoop.bind(this);
        this.animationFrameId = null;
        this.isDestroyed = false;
        
        this.initGraphics();
    }
    
    async initGraphics() {
        if (this.isPreview) return;
        await this.graphics.init();
        if (!this.graphics || !this.graphics.isInitialized || !this.graphics.app || !this.graphics.app.renderer || !this.graphics.app.ticker) {
            console.error('Graphics initialization failed, falling back to requestAnimationFrame');
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
            return;
        }
        this.finishGraphicsInit();
    }
    
    finishGraphicsInit() {
        this.spriteManager = new SpriteManager(this.graphics);
        this.nesEffects = this.graphics.getScreenEffects();
        this.screenEffects = this.nesEffects;
        this.initSprites();
        
        // Draw initial frame before starting loop
        this.drawPixi();
        
        this.startGameLoop();
    }
    
    initSprites() {
        if (this.isPreview) return;
        // Don't update board sprites yet - wait until game starts
        // Just ensure background is drawn
        this.drawBackgroundPixi();
    }
    
    startGameLoop() {
        if (this.isPreview) {
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
            return;
        }
        
        const ticker = this.graphics.getTicker();
        if (ticker) {
            // Store the ticker callback so we can remove it later
            // Use performance.now() for reliable absolute time tracking
            this.tickerCallback = () => {
                this.gameLoop(performance.now());
            };
            ticker.add(this.tickerCallback);
        } else {
            console.warn('PixiJS ticker not available, falling back to requestAnimationFrame');
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        }
    }
    
    initializeBoard() {
        this.board = [];
        for (let row = 0; row < this.rows; row++) {
            this.board[row] = [];
            for (let col = 0; col < this.cols; col++) {
                this.board[row][col] = 0;
            }
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
            if (!this.isPreview) {
                const activeCanvas = document.getElementById('game-canvas');
                if (activeCanvas !== this.canvas) return;
            }
            
            this.keys[e.code] = true;
            this.lastKeyPress[e.code] = performance.now();
            
            // Menu/game controls
            if (e.code === 'Space') {
                if (this.gameState === 'menu') {
                    this.startGame();
                    e.preventDefault();
                } else if (this.gameState === 'gameOver') {
                    this.startGame();
                    e.preventDefault();
                } else if (this.gameState === 'playing') {
                    // Hard drop
                    this.hardDrop();
                    e.preventDefault();
                }
            }
            
            if (e.code === 'KeyP' && this.gameState === 'playing') {
                this.togglePause();
                e.preventDefault();
            }
            
            if (e.code === 'KeyR' && (this.gameState === 'playing' || this.gameState === 'paused' || this.gameState === 'gameOver')) {
                this.resetGame();
                e.preventDefault();
            }
            
            // Don't handle game controls in menu/gameOver
            if (this.gameState !== 'playing') return;
            
            // Piece rotation
            if (e.code === 'ArrowUp' || e.code === 'KeyZ') {
                this.rotatePiece(-1); // Counter-clockwise
                e.preventDefault();
            }
            
            if (e.code === 'KeyX') {
                this.rotatePiece(1); // Clockwise
                e.preventDefault();
            }
            
            // Movement
            if (e.code === 'ArrowLeft') {
                this.movePiece(-1, 0);
                e.preventDefault();
            }
            
            if (e.code === 'ArrowRight') {
                this.movePiece(1, 0);
                e.preventDefault();
            }
            
            if (e.code === 'ArrowDown') {
                this.softDrop();
                e.preventDefault();
            }
        };
        
        this.keyupHandler = (e) => {
            if (!this.isPreview) {
                const activeCanvas = document.getElementById('game-canvas');
                if (activeCanvas !== this.canvas) return;
            }
            
            this.keys[e.code] = false;
            delete this.lastKeyPress[e.code];
        };
        
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }
    
    getRandomPiece() {
        const pieces = Object.keys(this.tetrominoes);
        return pieces[Math.floor(Math.random() * pieces.length)];
    }
    
    spawnPiece(pieceType = null) {
        if (!pieceType) {
            pieceType = this.getRandomPiece();
        }
        
        this.currentPiece = pieceType;
        this.currentRotation = 0;
        this.currentX = Math.floor(this.cols / 2) - 1;
        this.currentY = 0;
        this.isLocking = false;
        this.lockTime = 0;
        
        // Check if piece can be placed (game over condition)
        if (this.checkCollision(this.currentPiece, this.currentRotation, this.currentX, this.currentY)) {
            this.gameOver();
        }
    }
    
    getPieceShape(pieceType, rotation) {
        const piece = this.tetrominoes[pieceType];
        if (!piece) return null;
        
        const numRotations = piece.rotations;
        const normalizedRotation = ((rotation % numRotations) + numRotations) % numRotations;
        return piece.shape[normalizedRotation];
    }
    
    checkCollision(pieceType, rotation, x, y) {
        const shape = this.getPieceShape(pieceType, rotation);
        if (!shape) return true;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardX = x + col;
                    const boardY = y + row;
                    
                    // Check boundaries
                    if (boardX < 0 || boardX >= this.cols || boardY >= this.rows) {
                        return true;
                    }
                    
                    // Check if board cell is filled
                    if (boardY >= 0 && this.board[boardY][boardX] !== 0) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    movePiece(dx, dy) {
        if (this.gameState !== 'playing' || !this.currentPiece) return false;
        
        const newX = this.currentX + dx;
        const newY = this.currentY + dy;
        
        if (!this.checkCollision(this.currentPiece, this.currentRotation, newX, newY)) {
            this.currentX = newX;
            this.currentY = newY;
            this.isLocking = false;
            this.lockTime = 0;
            return true;
        }
        
        return false;
    }
    
    rotatePiece(direction) {
        if (this.gameState !== 'playing' || !this.currentPiece) return false;
        
        const newRotation = this.currentRotation + direction;
        
        // Try rotation
        if (!this.checkCollision(this.currentPiece, newRotation, this.currentX, this.currentY)) {
            this.currentRotation = newRotation;
            this.isLocking = false;
            this.lockTime = 0;
            return true;
        }
        
        // Try wall kicks (move left/right and try again)
        for (let offset of [-1, 1, -2, 2]) {
            if (!this.checkCollision(this.currentPiece, newRotation, this.currentX + offset, this.currentY)) {
                this.currentX += offset;
                this.currentRotation = newRotation;
                this.isLocking = false;
                this.lockTime = 0;
                return true;
            }
        }
        
        return false;
    }
    
    softDrop() {
        if (this.gameState !== 'playing' || !this.currentPiece) return;
        
        const currentTime = performance.now();
        
        if (this.movePiece(0, 1)) {
            this.score += 1; // 1 point per cell for soft drop
            this.isLocking = false;
            this.lockTime = 0;
        } else {
            // Piece can't move down - start lock delay
            if (!this.isLocking) {
                this.isLocking = true;
                this.lockTime = currentTime;
            } else {
                // Check if lock delay has passed
                if (currentTime - this.lockTime >= this.lockDelay) {
                    this.lockPiece(currentTime);
                }
            }
        }
    }
    
    hardDrop() {
        if (this.gameState !== 'playing' || !this.currentPiece) return;
        
        let dropDistance = 0;
        while (this.movePiece(0, 1)) {
            dropDistance++;
        }
        
        this.score += dropDistance * 2; // 2 points per cell for hard drop
        this.lockPiece(performance.now());
    }
    
    lockPiece(currentTime = null) {
        if (!this.currentPiece) return;
        
        // Use provided time or fallback to performance.now()
        if (!currentTime) {
            currentTime = performance.now();
        }
        
        const shape = this.getPieceShape(this.currentPiece, this.currentRotation);
        if (!shape) return;
        
        // Place piece on board
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardX = this.currentX + col;
                    const boardY = this.currentY + row;
                    
                    if (boardY >= 0 && boardY < this.rows && boardX >= 0 && boardX < this.cols) {
                        this.board[boardY][boardX] = this.currentPiece;
                    }
                }
            }
        }
        
        // Check for line clears
        this.clearLines();
        
        // Update board sprites after locking and clearing lines
        if (!this.isPreview) {
            this.updateBoardSprites();
        }
        
        // Spawn next piece
        this.spawnPiece(this.nextPiece);
        this.nextPiece = this.getRandomPiece();
        
        // Reset drop timer so new piece waits full interval before first drop
        this.lastDropTime = currentTime;
        
        // Update sprites immediately
        if (!this.isPreview) {
            this.updateNextPieceSprite();
            this.updateCurrentPieceSprite();
            this.updateGhostPieceSprite();
            // Force a redraw
            this.drawPixi();
        }
    }
    
    clearLines() {
        const linesToClear = [];
        
        // Find filled lines
        for (let row = this.rows - 1; row >= 0; row--) {
            let isFull = true;
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === 0) {
                    isFull = false;
                    break;
                }
            }
            
            if (isFull) {
                linesToClear.push(row);
            }
        }
        
        if (linesToClear.length === 0) return;
        
        // Score based on lines cleared (with bonuses for multiple lines)
        const lineScores = {
            1: { base: 100, bonus: 0, name: 'Single' },
            2: { base: 300, bonus: 100, name: 'Double' },
            3: { base: 500, bonus: 200, name: 'Triple' },
            4: { base: 800, bonus: 400, name: 'TETRIS!' }
        };
        
        const scoreData = lineScores[linesToClear.length] || { base: 0, bonus: 0, name: '' };
        const baseScore = scoreData.base * this.level;
        const bonusScore = scoreData.bonus * this.level;
        const totalScore = baseScore + bonusScore;
        this.score += totalScore;
        this.lines += linesToClear.length;
        
        // Store for animation display
        this.lastLineClearData = {
            count: linesToClear.length,
            name: scoreData.name,
            score: totalScore,
            bonus: bonusScore
        };
        
        // Level up every 10 lines
        const newLevel = Math.floor(this.lines / 10) + 1;
        const levelChanged = newLevel > this.level;
        if (levelChanged) {
            this.level = newLevel;
            // Increase drop speed (decrease interval)
            this.dropInterval = Math.max(50, 1000 - (this.level - 1) * 50);
            
            // Update background for new level
            if (!this.isPreview) {
                this.updateBackgroundForLevel();
            }
        }
        
        // Store lines to clear for animation
        this.linesClearing = [...linesToClear];
        this.lineClearAnimationTime = performance.now();
        this.lineClearDisplayTime = performance.now();
        
        // Screen shake and flash effects (intensity based on number of lines)
        if (this.screenEffects) {
            const shakeIntensity = Math.min(8 + linesToClear.length * 3, 20);
            if (typeof this.screenEffects.shake === 'function') {
                this.screenEffects.shake(shakeIntensity, 8);
            }
            
            // Flash effect - different colors for different line counts
            const flashColors = {
                1: '#00ffff',
                2: '#00ff00',
                3: '#ffff00',
                4: '#ff00ff'
            };
            const flashColor = flashColors[linesToClear.length] || '#00ffff';
            if (typeof this.screenEffects.flash === 'function') {
                // Shorter flash - 8 frames instead of 15, lower intensity
                this.screenEffects.flash(flashColor, 8, 0.3);
            }
        }
        
        // Create particles for cleared lines (only in preview/Canvas2D mode)
        if (this.particles) {
            linesToClear.forEach(row => {
                for (let col = 0; col < this.cols; col++) {
                    const x = this.boardX + col * this.cellSize + this.cellSize / 2;
                    const y = this.boardY + row * this.cellSize + this.cellSize / 2;
                    const pieceColor = this.pieceColors[this.board[row][col]] || '#ffffff';
                    
                    // Create explosion effect for each cell
                    this.particles.explode(x, y, 8, pieceColor, 'default');
                    this.particles.sparkBurst(x, y, 5, pieceColor);
                }
            });
        }
        
        // Delay line removal for animation
        setTimeout(() => {
            // Remove cleared lines
            linesToClear.forEach(row => {
                this.board.splice(row, 1);
                this.board.unshift(new Array(this.cols).fill(0));
            });
            
            // Clear animation state
            this.linesClearing = [];
            this.lineClearAnimationTime = 0;
            
            // Update board after removal
            if (!this.isPreview) {
                this.updateBoardSprites();
            }
        }, 400); // 400ms delay for animation
    }
    
    animateLineClear(linesToClear) {
        // Animation handled in draw methods - this is just a placeholder
        // The actual animation happens when drawing the board
    }
    
    updateBackgroundForLevel() {
        if (this.isPreview || !this.graphics) return;
        
        // Remove existing background
        const bgLayer = this.graphics.getLayer('background');
        if (!bgLayer) return;
        
        const existingBg = bgLayer.children.find(child => child.userData && child.userData.isBackground);
        if (existingBg) {
            bgLayer.removeChild(existingBg);
        }
        
        // Create new background based on level
        this.drawBackgroundPixi();
    }
    
    getGhostY() {
        if (!this.currentPiece || !this.showGhost) return this.currentY;
        
        let ghostY = this.currentY;
        while (!this.checkCollision(this.currentPiece, this.currentRotation, this.currentX, ghostY + 1)) {
            ghostY++;
        }
        
        return ghostY;
    }
    
    drawCell(x, y, color, alpha = 1.0) {
        const screenX = this.boardX + x * this.cellSize;
        const screenY = this.boardY + y * this.cellSize;
        
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(screenX, screenY, this.cellSize - 1, this.cellSize - 1);
        
        // Draw border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(screenX, screenY, this.cellSize - 1, this.cellSize - 1);
        
        this.ctx.globalAlpha = 1.0;
    }
    
    drawPiece(pieceType, rotation, x, y, alpha = 1.0, isGhost = false) {
        const shape = this.getPieceShape(pieceType, rotation);
        if (!shape) return;
        
        const color = this.pieceColors[pieceType] || '#ffffff';
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardX = x + col;
                    const boardY = y + row;
                    
                    if (boardY >= 0 && boardY < this.rows && boardX >= 0 && boardX < this.cols) {
                        if (isGhost) {
                            this.ctx.strokeStyle = color;
                            this.ctx.lineWidth = 2;
                            this.ctx.strokeRect(
                                this.boardX + boardX * this.cellSize + 2,
                                this.boardY + boardY * this.cellSize + 2,
                                this.cellSize - 5,
                                this.cellSize - 5
                            );
                        } else {
                            this.drawCell(boardX, boardY, color, alpha);
                        }
                    }
                }
            }
        }
    }
    
    drawBackground() {
        // Clear canvas with gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#001122');
        gradient.addColorStop(0.5, '#001a2e');
        gradient.addColorStop(1, '#000011');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw subtle grid pattern
        this.ctx.strokeStyle = '#001122';
        this.ctx.lineWidth = 1;
        const gridSize = 40;
        
        // Vertical lines
        for (let x = 0; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
        
        // Draw subtle dots at intersections
        this.ctx.fillStyle = '#002244';
        for (let x = 0; x < this.width; x += gridSize) {
            for (let y = 0; y < this.height; y += gridSize) {
                this.ctx.fillRect(x - 1, y - 1, 2, 2);
            }
        }
    }
    
    drawBoard() {
        // Draw board background with border
        this.ctx.fillStyle = '#000033';
        this.ctx.fillRect(this.boardX - 8, this.boardY - 8, 
                         this.cols * this.cellSize + 16, 
                         this.rows * this.cellSize + 16);
        
        // Draw board border
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.boardX - 8, this.boardY - 8, 
                           this.cols * this.cellSize + 16, 
                           this.rows * this.cellSize + 16);
        
        // Draw inner board background
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(this.boardX - 5, this.boardY - 5, 
                         this.cols * this.cellSize + 10, 
                         this.rows * this.cellSize + 10);
        
        // Draw grid lines
        this.ctx.strokeStyle = '#003355';
        this.ctx.lineWidth = 1;
        
        for (let col = 0; col <= this.cols; col++) {
            const x = this.boardX + col * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.boardY);
            this.ctx.lineTo(x, this.boardY + this.rows * this.cellSize);
            this.ctx.stroke();
        }
        
        for (let row = 0; row <= this.rows; row++) {
            const y = this.boardY + row * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(this.boardX, y);
            this.ctx.lineTo(this.boardX + this.cols * this.cellSize, y);
            this.ctx.stroke();
        }
        
        // Draw placed pieces
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] !== 0) {
                    const pieceType = this.board[row][col];
                    const color = this.pieceColors[pieceType] || '#ffffff';
                    this.drawCell(col, row, color);
                }
            }
        }
    }
    
    drawNextPiece() {
        if (!this.nextPiece) return;
        
        const previewX = 50;
        const previewY = 120;
        const previewSize = 20;
        
        // Draw label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('NEXT', previewX, previewY - 10);
        
        // Draw preview box
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(previewX - 5, previewY - 5, previewSize * 4 + 10, previewSize * 4 + 10);
        
        // Draw next piece
        const shape = this.getPieceShape(this.nextPiece, 0);
        if (shape) {
            const color = this.pieceColors[this.nextPiece];
            const offsetX = Math.floor((4 - shape[0].length) / 2);
            const offsetY = Math.floor((4 - shape.length) / 2);
            
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        this.ctx.fillStyle = color;
                        this.ctx.fillRect(
                            previewX + (offsetX + col) * previewSize,
                            previewY + (offsetY + row) * previewSize,
                            previewSize - 2,
                            previewSize - 2
                        );
                    }
                }
            }
        }
    }
    
    drawInfo() {
        const infoX = 50;
        let infoY = 50;
        const lineHeight = 25;
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'left';
        
        // Score
        this.ctx.fillStyle = '#00ffff';
        this.ctx.fillText('SCORE', infoX, infoY);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(Utils.formatScore(this.score), infoX, infoY + lineHeight);
        
        infoY += lineHeight * 3;
        
        // Level
        this.ctx.fillStyle = '#00ffff';
        this.ctx.fillText('LEVEL', infoX, infoY);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(this.level.toString(), infoX, infoY + lineHeight);
        
        infoY += lineHeight * 3;
        
        // Lines
        this.ctx.fillStyle = '#00ffff';
        this.ctx.fillText('LINES', infoX, infoY);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(this.lines.toString(), infoX, infoY + lineHeight);
    }
    
    drawMenu() {
        // Background
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Title
        this.ctx.fillStyle = '#00ffff';
        this.ctx.font = 'bold 64px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('TETRA CIRCUIT', this.width / 2, this.height / 2 - 100);
        
        // Instructions
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Courier New';
        this.ctx.fillText('Press SPACE to Start', this.width / 2, this.height / 2);
        
        this.ctx.font = '16px Courier New';
        this.ctx.fillText('Arrow Keys: Move & Rotate', this.width / 2, this.height / 2 + 50);
        this.ctx.fillText('Space: Hard Drop | X: Rotate', this.width / 2, this.height / 2 + 80);
        this.ctx.fillText('P: Pause | R: Reset', this.width / 2, this.height / 2 + 110);
        
        // Draw preview pieces
        const pieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        const startX = this.width / 2 - (pieces.length * 35) / 2;
        const startY = this.height / 2 + 180;
        
        pieces.forEach((piece, index) => {
            const shape = this.getPieceShape(piece, 0);
            const color = this.pieceColors[piece];
            const x = startX + index * 35;
            
            if (shape) {
                for (let row = 0; row < shape.length; row++) {
                    for (let col = 0; col < shape[row].length; col++) {
                        if (shape[row][col]) {
                            this.ctx.fillStyle = color;
                            this.ctx.fillRect(x + col * 8, startY + row * 8, 7, 7);
                        }
                    }
                }
            }
        });
    }
    
    drawGameOver() {
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Game Over text
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 50);
        
        // Final score
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Courier New';
        this.ctx.fillText(`Final Score: ${Utils.formatScore(this.score)}`, this.width / 2, this.height / 2 + 20);
        this.ctx.fillText(`Level: ${this.level} | Lines: ${this.lines}`, this.width / 2, this.height / 2 + 50);
        
        // Instructions
        this.ctx.fillStyle = '#00ffff';
        this.ctx.font = '18px Courier New';
        this.ctx.fillText('Press SPACE to Restart', this.width / 2, this.height / 2 + 100);
        this.ctx.fillText('Press R to Reset', this.width / 2, this.height / 2 + 130);
    }
    
    drawPaused() {
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Paused text
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = 'bold 48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '18px Courier New';
        this.ctx.fillText('Press P to Resume', this.width / 2, this.height / 2 + 40);
    }
    
    // PixiJS rendering methods
    updateBoardSprites() {
        if (this.isPreview || !this.graphics) return;
        
        // Remove old board sprites
        this.boardSprites.forEach(sprite => {
            if (sprite && sprite.parent) {
                sprite.parent.removeChild(sprite);
            }
        });
        this.boardSprites = [];
        
        // Draw board background with border
        const boardBg = new PIXI.Graphics();
        boardBg.beginFill(0x000033, 1);
        boardBg.drawRect(this.boardX - 8, this.boardY - 8, 
                        this.cols * this.cellSize + 16, 
                        this.rows * this.cellSize + 16);
        boardBg.endFill();
        
        boardBg.lineStyle(3, 0x00ffff, 1);
        boardBg.drawRect(this.boardX - 8, this.boardY - 8, 
                        this.cols * this.cellSize + 16, 
                        this.rows * this.cellSize + 16);
        
        boardBg.beginFill(0x000011, 1);
        boardBg.drawRect(this.boardX - 5, this.boardY - 5, 
                        this.cols * this.cellSize + 10, 
                        this.rows * this.cellSize + 10);
        boardBg.endFill();
        
        // Draw grid lines
        boardBg.lineStyle(1, 0x003355, 1);
        for (let col = 0; col <= this.cols; col++) {
            const x = this.boardX + col * this.cellSize;
            boardBg.moveTo(x, this.boardY);
            boardBg.lineTo(x, this.boardY + this.rows * this.cellSize);
        }
        for (let row = 0; row <= this.rows; row++) {
            const y = this.boardY + row * this.cellSize;
            boardBg.moveTo(this.boardX, y);
            boardBg.lineTo(this.boardX + this.cols * this.cellSize, y);
        }
        
        this.graphics.addToLayer(boardBg, 'background');
        this.boardSprites.push(boardBg);
        
        // Draw placed pieces with line clear animation
        const currentTime = performance.now();
        const isAnimating = this.linesClearing.length > 0 && 
                           this.lineClearAnimationTime > 0 &&
                           (currentTime - this.lineClearAnimationTime) < 400;
        const animProgress = isAnimating ? (currentTime - this.lineClearAnimationTime) / 400 : 1.0;
        
        for (let row = 0; row < this.rows; row++) {
            const isClearing = this.linesClearing.includes(row);
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] !== 0) {
                    const pieceType = this.board[row][col];
                    const colorHex = parseInt((this.pieceColors[pieceType] || '#ffffff').replace('#', ''), 16);
                    
                    if (isClearing && isAnimating) {
                        // Animate clearing cells - fade out and scale up
                        const alpha = 1.0 - animProgress;
                        const scale = 1.0 + animProgress * 0.5;
                        const cellSprite = this.createCellSprite(col, row, colorHex, alpha);
                        cellSprite.scale.set(scale, scale);
                        this.graphics.addToLayer(cellSprite, 'foreground');
                        this.boardSprites.push(cellSprite);
                    } else if (!isClearing) {
                        // Normal cells (don't draw clearing cells if animation finished)
                        const cellSprite = this.createCellSprite(col, row, colorHex, 1.0);
                        this.graphics.addToLayer(cellSprite, 'foreground');
                        this.boardSprites.push(cellSprite);
                    }
                }
            }
        }
    }
    
    createCellSprite(boardX, boardY, color, alpha = 1.0) {
        const screenX = this.boardX + boardX * this.cellSize;
        const screenY = this.boardY + boardY * this.cellSize;
        
        const cellGraphics = new PIXI.Graphics();
        cellGraphics.alpha = alpha;
        
        // Main cell
        cellGraphics.beginFill(color, 1);
        cellGraphics.drawRect(0, 0, this.cellSize - 1, this.cellSize - 1);
        cellGraphics.endFill();
        
        // Border
        cellGraphics.lineStyle(1, 0xffffff, 0.2);
        cellGraphics.drawRect(0, 0, this.cellSize - 1, this.cellSize - 1);
        
        // Highlight for 3D effect
        cellGraphics.lineStyle(1, 0xffffff, 0.4);
        cellGraphics.moveTo(0, 0);
        cellGraphics.lineTo(this.cellSize - 1, 0);
        cellGraphics.lineTo(this.cellSize - 1, 1);
        cellGraphics.lineTo(0, 1);
        cellGraphics.lineTo(0, 0);
        
        cellGraphics.x = screenX;
        cellGraphics.y = screenY;
        
        return cellGraphics;
    }
    
    updateCurrentPieceSprite() {
        if (this.isPreview || !this.graphics) return;
        
        // Remove old sprite
        if (this.currentPieceSprite && this.currentPieceSprite.parent) {
            this.currentPieceSprite.parent.removeChild(this.currentPieceSprite);
        }
        
        if (!this.currentPiece || this.gameState !== 'playing') {
            this.currentPieceSprite = null;
            return;
        }
        
        const pieceContainer = new PIXI.Container();
        const shape = this.getPieceShape(this.currentPiece, this.currentRotation);
        if (shape) {
            const colorHex = parseInt((this.pieceColors[this.currentPiece] || '#ffffff').replace('#', ''), 16);
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        const boardX = this.currentX + col;
                        const boardY = this.currentY + row;
                        if (boardY >= 0 && boardY < this.rows && boardX >= 0 && boardX < this.cols) {
                            const cellSprite = this.createCellSprite(boardX, boardY, colorHex, 1.0);
                            pieceContainer.addChild(cellSprite);
                        }
                    }
                }
            }
        }
        
        this.graphics.addToLayer(pieceContainer, 'foreground');
        this.currentPieceSprite = pieceContainer;
    }
    
    updateGhostPieceSprite() {
        if (this.isPreview || !this.graphics || !this.showGhost) return;
        
        // Remove old sprite
        if (this.ghostPieceSprite && this.ghostPieceSprite.parent) {
            this.ghostPieceSprite.parent.removeChild(this.ghostPieceSprite);
        }
        
        if (!this.currentPiece || this.gameState !== 'playing') {
            this.ghostPieceSprite = null;
            return;
        }
        
        const ghostY = this.getGhostY();
        if (ghostY === this.currentY) {
            this.ghostPieceSprite = null;
            return;
        }
        
        const ghostContainer = new PIXI.Container();
        const shape = this.getPieceShape(this.currentPiece, this.currentRotation);
        if (shape) {
            const colorHex = parseInt((this.pieceColors[this.currentPiece] || '#ffffff').replace('#', ''), 16);
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        const boardX = this.currentX + col;
                        const boardY = ghostY + row;
                        if (boardY >= 0 && boardY < this.rows && boardX >= 0 && boardX < this.cols) {
                            const screenX = this.boardX + boardX * this.cellSize;
                            const screenY = this.boardY + boardY * this.cellSize;
                            
                            const ghostCell = new PIXI.Graphics();
                            ghostCell.lineStyle(2, colorHex, 1);
                            ghostCell.drawRect(2, 2, this.cellSize - 5, this.cellSize - 5);
                            ghostCell.x = screenX;
                            ghostCell.y = screenY;
                            
                            ghostContainer.addChild(ghostCell);
                        }
                    }
                }
            }
        }
        
        this.graphics.addToLayer(ghostContainer, 'foreground');
        this.ghostPieceSprite = ghostContainer;
    }
    
    updateNextPieceSprite() {
        if (this.isPreview || !this.graphics) return;
        
        // Remove old sprite
        if (this.nextPieceSprite && this.nextPieceSprite.parent) {
            this.nextPieceSprite.parent.removeChild(this.nextPieceSprite);
        }
        
        if (!this.nextPiece) {
            this.nextPieceSprite = null;
            return;
        }
        
        const previewContainer = new PIXI.Container();
        const previewX = 50;
        const previewY = 120;
        const previewSize = 20;
        
        // Preview box border
        const border = new PIXI.Graphics();
        border.lineStyle(2, 0x00ffff, 1);
        border.drawRect(previewX - 5, previewY - 5, previewSize * 4 + 10, previewSize * 4 + 10);
        previewContainer.addChild(border);
        
        // Draw next piece
        const shape = this.getPieceShape(this.nextPiece, 0);
        if (shape) {
            const colorHex = parseInt((this.pieceColors[this.nextPiece] || '#ffffff').replace('#', ''), 16);
            const offsetX = Math.floor((4 - shape[0].length) / 2);
            const offsetY = Math.floor((4 - shape.length) / 2);
            
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        const cellGraphics = new PIXI.Graphics();
                        cellGraphics.beginFill(colorHex, 1);
                        cellGraphics.drawRect(0, 0, previewSize - 2, previewSize - 2);
                        cellGraphics.endFill();
                        
                        cellGraphics.lineStyle(1, 0xffffff, 0.2);
                        cellGraphics.drawRect(0, 0, previewSize - 2, previewSize - 2);
                        
                        cellGraphics.x = previewX + (offsetX + col) * previewSize;
                        cellGraphics.y = previewY + (offsetY + row) * previewSize;
                        previewContainer.addChild(cellGraphics);
                    }
                }
            }
        }
        
        this.graphics.addToLayer(previewContainer, 'ui');
        this.nextPieceSprite = previewContainer;
    }
    
    drawPixi() {
        if (this.isPreview || !this.graphics || !this.graphics.isInitialized) return;
        
        // Draw background first (only once, or when needed)
        this.drawBackgroundPixi();
        
        // Update board sprites (only when playing, not in menu)
        if (this.gameState === 'playing') {
            this.updateBoardSprites();
            // Update current piece
            this.updateCurrentPieceSprite();
            // Update ghost piece
            this.updateGhostPieceSprite();
        } else {
            // Clear piece sprites when not playing
            if (this.currentPieceSprite && this.currentPieceSprite.parent) {
                this.currentPieceSprite.parent.removeChild(this.currentPieceSprite);
                this.currentPieceSprite = null;
            }
            if (this.ghostPieceSprite && this.ghostPieceSprite.parent) {
                this.ghostPieceSprite.parent.removeChild(this.ghostPieceSprite);
                this.ghostPieceSprite = null;
            }
        }
        
        // Update next piece (always show if we have one)
        if (this.nextPiece) {
            this.updateNextPieceSprite();
        }
        
        // Draw UI
        this.drawUIPixi();
    }
    
    drawBackgroundPixi() {
        if (this.isPreview || !this.graphics) return;
        
        const bgLayer = this.graphics.getLayer('background');
        if (!bgLayer) return;
        
        // Check if background already exists - only skip if level hasn't changed
        const existingBg = bgLayer.children.find(child => child.userData && child.userData.isBackground);
        if (existingBg && existingBg.userData.level === this.level) {
            return; // Background already exists for this level
        }
        
        if (existingBg) {
            bgLayer.removeChild(existingBg);
        }
        
        // Create background based on level
        const background = new PIXI.Graphics();
        background.userData = { isBackground: true, level: this.level };
        
        // Different background themes based on level ranges
        const levelTheme = Math.floor(this.level / 5) % 4; // Cycles through 4 themes every 5 levels
        
        let color1, color2, color3;
        switch (levelTheme) {
            case 0: // Levels 1-4: Classic blue
                color1 = { r: 0x00, g: 0x11, b: 0x22 };
                color2 = { r: 0x00, g: 0x1a, b: 0x33 };
                color3 = { r: 0x00, g: 0x00, b: 0x11 };
                break;
            case 1: // Levels 5-9: Purple/cyan
                color1 = { r: 0x11, g: 0x00, b: 0x33 };
                color2 = { r: 0x22, g: 0x00, b: 0x44 };
                color3 = { r: 0x00, g: 0x11, b: 0x22 };
                break;
            case 2: // Levels 10-14: Green/teal
                color1 = { r: 0x00, g: 0x22, b: 0x11 };
                color2 = { r: 0x00, g: 0x33, b: 0x22 };
                color3 = { r: 0x00, g: 0x11, b: 0x00 };
                break;
            case 3: // Levels 15+: Red/orange
                color1 = { r: 0x33, g: 0x00, b: 0x00 };
                color2 = { r: 0x44, g: 0x11, b: 0x00 };
                color3 = { r: 0x22, g: 0x00, b: 0x00 };
                break;
        }
        
        // Create gradient background
        const gradientSteps = 30;
        const stepHeight = this.height / gradientSteps;
        for (let i = 0; i < gradientSteps; i++) {
            const y = i * stepHeight;
            const t = i / gradientSteps;
            
            // Interpolate between three colors
            let r, g, b;
            if (t < 0.5) {
                // First half: color1 to color2
                const t2 = t * 2;
                r = Math.floor(color1.r + (color2.r - color1.r) * t2);
                g = Math.floor(color1.g + (color2.g - color1.g) * t2);
                b = Math.floor(color1.b + (color2.b - color1.b) * t2);
            } else {
                // Second half: color2 to color3
                const t2 = (t - 0.5) * 2;
                r = Math.floor(color2.r + (color3.r - color2.r) * t2);
                g = Math.floor(color2.g + (color3.g - color2.g) * t2);
                b = Math.floor(color2.b + (color3.b - color2.b) * t2);
            }
            
            const color = (r << 16) | (g << 8) | b;
            background.beginFill(color, 1.0);
            background.drawRect(0, y, this.width, stepHeight + 1);
            background.endFill();
        }
        
        // Add pattern based on level (more complex patterns at higher levels)
        const patternIntensity = Math.min(this.level / 10, 1.0);
        background.lineStyle(1, 0x002244, 0.3 * patternIntensity);
        const gridSize = 40 - (this.level % 5) * 2; // Smaller grid at higher levels
        for (let x = 0; x < this.width; x += gridSize) {
            background.moveTo(x, 0);
            background.lineTo(x, this.height);
        }
        for (let y = 0; y < this.height; y += gridSize) {
            background.moveTo(0, y);
            background.lineTo(this.width, y);
        }
        
        // Draw dots at intersections
        background.beginFill(0x003366, 0.4 * patternIntensity);
        for (let x = 0; x < this.width; x += gridSize) {
            for (let y = 0; y < this.height; y += gridSize) {
                background.drawRect(x - 1, y - 1, 2, 2);
            }
        }
        background.endFill();
        
        bgLayer.addChildAt(background, 0);
    }
    
    drawUIPixi() {
        if (this.isPreview || !this.graphics) return;
        
        // Update stats panel instead of drawing on canvas
        this.updateStatsPanel();
        
        const uiLayer = this.graphics.getLayer('ui');
        if (!uiLayer) return;
        
        // Remove existing line clear display sprites first
        const lineClearSprites = [];
        uiLayer.children.forEach(child => {
            if (child.userData && child.userData.isLineClearDisplay) {
                lineClearSprites.push(child);
            }
        });
        lineClearSprites.forEach(child => uiLayer.removeChild(child));
        
        // Remove existing game state message sprites (but keep next piece)
        const childrenToRemove = [];
        uiLayer.children.forEach(child => {
            // Keep next piece sprite
            if (child !== this.nextPieceSprite && 
                child.userData && 
                child.userData.isGameStateMessage) {
                childrenToRemove.push(child);
            }
        });
        childrenToRemove.forEach(child => uiLayer.removeChild(child));
        
        // Draw line clear bonus display (shorter duration)
        if (this.lastLineClearData && this.lineClearDisplayTime > 0) {
            const elapsed = performance.now() - this.lineClearDisplayTime;
            const displayDuration = 800; // 800ms instead of 2000ms
            if (elapsed < displayDuration) {
                this.drawLineClearBonusPixi(uiLayer, elapsed / displayDuration);
            } else {
                // Clear after timeout
                this.lastLineClearData = null;
                this.lineClearDisplayTime = 0;
            }
        }
        
        // Game state overlays (always draw fresh)
        if (this.gameState === 'menu') {
            this.drawMenuPixi(uiLayer);
        } else if (this.gameState === 'gameOver') {
            this.drawGameOverPixi(uiLayer);
        } else if (this.gameState === 'paused') {
            this.drawPausedPixi(uiLayer);
        }
    }
    
    drawLineClearBonusPixi(uiLayer, progress) {
        if (!this.lastLineClearData) return;
        
        const data = this.lastLineClearData;
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Calculate animation (quick bounce in, hold, fade out)
        let scale = 1.0;
        let alpha = 1.0;
        if (progress < 0.2) {
            // Quick bounce in (first 20%)
            const t = progress / 0.2;
            scale = Easing.easeOutBounce(t);
            alpha = t;
        } else if (progress > 0.6) {
            // Fade out (last 40%)
            const t = (progress - 0.6) / 0.4;
            alpha = 1.0 - t;
            scale = 1.0 - t * 0.1;
        }
        
        // Main text - better readability with stronger stroke and shadow
        const textColor = data.count === 4 ? 0xff00ff : (data.count === 3 ? 0xffff00 : (data.count === 2 ? 0x00ff00 : 0x00ffff));
        const textStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: data.count === 4 ? 64 : 42,
            fill: textColor,
            fontWeight: 'bold',
            align: 'center',
            stroke: 0x000000,
            strokeThickness: 8, // Thicker stroke for better readability
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowBlur: 8,
            dropShadowAngle: Math.PI / 4,
            dropShadowDistance: 4
        });
        
        // Position above board, not center screen
        const nameText = new PIXI.Text(data.name.toUpperCase(), textStyle);
        nameText.anchor.set(0.5);
        nameText.x = centerX;
        nameText.y = this.boardY + 50; // Position above board area
        nameText.scale.set(scale, scale);
        nameText.alpha = alpha;
        nameText.userData = { isLineClearDisplay: true };
        uiLayer.addChild(nameText);
        
        // Score display - only show bonus for multi-line clears
        if (data.bonus > 0) {
            const bonusStyle = new PIXI.TextStyle({
                fontFamily: 'Courier New',
                fontSize: 28,
                fill: 0xffff00,
                fontWeight: 'bold',
                align: 'center',
                stroke: 0x000000,
                strokeThickness: 4,
                dropShadow: true,
                dropShadowColor: 0x000000,
                dropShadowBlur: 4,
                dropShadowDistance: 2
            });
            
            const bonusText = new PIXI.Text(`+${Utils.formatScore(data.score)} BONUS!`, bonusStyle);
            bonusText.anchor.set(0.5);
            bonusText.x = centerX;
            bonusText.y = this.boardY + 90;
            bonusText.scale.set(scale, scale);
            bonusText.alpha = alpha;
            bonusText.userData = { isLineClearDisplay: true };
            uiLayer.addChild(bonusText);
        } else {
            // Don't show score for single lines - just the name is enough
        }
    }
    
    drawMenuPixi(uiLayer) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000011, 1);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
        uiLayer.addChild(overlay);
        
        const titleStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 48,
            fill: 0x00ffff,
            fontWeight: 'bold',
            align: 'center'
        });
        
        const title = new PIXI.Text('TETRA CIRCUIT', titleStyle);
        title.anchor.set(0.5);
        title.x = this.width / 2;
        title.y = this.height / 2 - 100;
        title.userData = { isGameStateMessage: true };
        overlay.userData = { isGameStateMessage: true };
        uiLayer.addChild(overlay);
        uiLayer.addChild(title);
        
        const instructionStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 16,
            fill: 0xffffff,
            align: 'center'
        });
        
        const instructions = [
            'Press SPACE to Start',
            'Arrow Keys: Move & Rotate',
            'Space: Hard Drop | X: Rotate',
            'P: Pause | R: Reset'
        ];
        
        instructions.forEach((text, i) => {
            const instruction = new PIXI.Text(text, instructionStyle);
            instruction.anchor.set(0.5);
            instruction.x = this.width / 2;
            instruction.y = this.height / 2 - 20 + (i * 30);
            instruction.userData = { isGameStateMessage: true };
            uiLayer.addChild(instruction);
        });
    }
    
    drawGameOverPixi(uiLayer) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.7);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
        uiLayer.addChild(overlay);
        
        const gameOverStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 48,
            fill: 0xff0000,
            fontWeight: 'bold',
            align: 'center'
        });
        
        overlay.userData = { isGameStateMessage: true };
        uiLayer.addChild(overlay);
        
        const gameOver = new PIXI.Text('GAME OVER', gameOverStyle);
        gameOver.anchor.set(0.5);
        gameOver.x = this.width / 2;
        gameOver.y = this.height / 2 - 50;
        gameOver.userData = { isGameStateMessage: true };
        uiLayer.addChild(gameOver);
        
        const infoStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 24,
            fill: 0xffffff,
            align: 'center'
        });
        
        const finalScore = new PIXI.Text(`Final Score: ${Utils.formatScore(this.score)}`, infoStyle);
        finalScore.anchor.set(0.5);
        finalScore.x = this.width / 2;
        finalScore.y = this.height / 2 + 20;
        finalScore.userData = { isGameStateMessage: true };
        uiLayer.addChild(finalScore);
        
        const stats = new PIXI.Text(`Level: ${this.level} | Lines: ${this.lines}`, infoStyle);
        stats.anchor.set(0.5);
        stats.x = this.width / 2;
        stats.y = this.height / 2 + 50;
        stats.userData = { isGameStateMessage: true };
        uiLayer.addChild(stats);
        
        const restartStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 18,
            fill: 0x00ffff,
            align: 'center'
        });
        
        const restart = new PIXI.Text('Press SPACE to Restart', restartStyle);
        restart.anchor.set(0.5);
        restart.x = this.width / 2;
        restart.y = this.height / 2 + 100;
        restart.userData = { isGameStateMessage: true };
        uiLayer.addChild(restart);
        
        const reset = new PIXI.Text('Press R to Reset', restartStyle);
        reset.anchor.set(0.5);
        reset.x = this.width / 2;
        reset.y = this.height / 2 + 130;
        reset.userData = { isGameStateMessage: true };
        uiLayer.addChild(reset);
    }
    
    drawPausedPixi(uiLayer) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.7);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
        overlay.userData = { isGameStateMessage: true };
        uiLayer.addChild(overlay);
        
        const pauseStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 48,
            fill: 0xffff00,
            fontWeight: 'bold',
            align: 'center'
        });
        
        const paused = new PIXI.Text('PAUSED', pauseStyle);
        paused.anchor.set(0.5);
        paused.x = this.width / 2;
        paused.y = this.height / 2;
        paused.userData = { isGameStateMessage: true };
        uiLayer.addChild(paused);
        
        const resumeStyle = new PIXI.TextStyle({
            fontFamily: 'Courier New',
            fontSize: 18,
            fill: 0xffffff,
            align: 'center'
        });
        
        const resume = new PIXI.Text('Press P to Resume', resumeStyle);
        resume.anchor.set(0.5);
        resume.x = this.width / 2;
        resume.y = this.height / 2 + 40;
        resume.userData = { isGameStateMessage: true };
        uiLayer.addChild(resume);
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
                <div class="stat-label">Level</div>
                <div class="stat-value">${this.level}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Lines</div>
                <div class="stat-value">${this.lines}</div>
            </div>
        `;
    }
    
    draw() {
        // Don't draw if destroyed
        if (this.isDestroyed) return;
        
        if (this.isPreview) {
            // Canvas 2D rendering for preview
            this.drawCanvas2D();
            return;
        }
        
        // PixiJS rendering
        this.drawPixi();
    }
    
    drawCanvas2D() {
        // Draw background pattern
        this.drawBackground();
        
        if (this.gameState === 'menu') {
            this.drawMenu();
            return;
        }
        
        if (this.gameState === 'gameOver') {
            this.drawGameOver();
            return;
        }
        
        // Apply screen effects transform
        let transform = { x: 0, y: 0, scale: 1 };
        if (this.screenEffects && typeof this.screenEffects.getTransform === 'function') {
            transform = this.screenEffects.getTransform();
        }
        this.ctx.save();
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(transform.scale, transform.scale);
        this.ctx.translate(-this.width / 2 + transform.x, -this.height / 2 + transform.y);
        
        // Draw board
        this.drawBoard();
        
        // Draw ghost piece
        if (this.currentPiece && this.showGhost && this.gameState === 'playing') {
            const ghostY = this.getGhostY();
            if (ghostY !== this.currentY) {
                this.drawPiece(this.currentPiece, this.currentRotation, this.currentX, ghostY, 0.3, true);
            }
        }
        
        // Draw current piece
        if (this.currentPiece && this.gameState === 'playing') {
            this.drawPiece(this.currentPiece, this.currentRotation, this.currentX, this.currentY);
        }
        
        // Draw particles
        if (this.particles) {
            this.particles.update();
            this.particles.draw(this.ctx);
        }
        
        this.ctx.restore();
        
        // Draw info panel (not affected by transform)
        this.drawInfo();
        
        // Draw next piece (not affected by transform)
        this.drawNextPiece();
        
        // Draw paused overlay
        if (this.gameState === 'paused') {
            this.drawPaused();
        }
        
        // Draw screen effects overlays
        if (this.screenEffects) {
            if (typeof this.screenEffects.drawFlash === 'function') {
                this.screenEffects.drawFlash();
            }
            if (typeof this.screenEffects.drawRipple === 'function') {
                this.screenEffects.drawRipple();
            }
        }
        
        // Apply CRT filter
        if (this.crtFilter && typeof this.crtFilter.draw === 'function') {
            this.crtFilter.draw(this.ctx);
        }
    }
    
    update(currentTime) {
        if (this.isPreview || this.isDestroyed) return;
        
        // currentTime is already performance.now() in PixiJS mode, or from requestAnimationFrame in preview
        // Track delta for effects, but use currentTime directly for game logic
        const deltaTime = currentTime - (this.lastTime || currentTime);
        this.lastTime = currentTime;
        
        if (this.gameState !== 'playing') return;
        
        // Use currentTime consistently for all timing
        const now = currentTime;
        for (let key in this.keys) {
            if (!this.keys[key]) continue;
            
            const lastPress = this.lastKeyPress[key] || 0;
            const timeSincePress = now - lastPress;
            
            if (timeSincePress > this.keyRepeatDelay) {
                const repeatCount = Math.floor((timeSincePress - this.keyRepeatDelay) / this.keyRepeatInterval);
                const shouldRepeat = repeatCount > (this.lastKeyRepeatCount || {})[key] || 0;
                
                if (shouldRepeat) {
                    if (key === 'ArrowLeft') {
                        this.movePiece(-1, 0);
                    } else if (key === 'ArrowRight') {
                        this.movePiece(1, 0);
                    } else if (key === 'ArrowDown') {
                        this.softDrop();
                    }
                    
                    (this.lastKeyRepeatCount || {})[key] = repeatCount;
                }
            }
        }
        this.lastKeyRepeatCount = this.lastKeyRepeatCount || {};
        
        // Handle piece dropping
        if (this.currentPiece) {
            // Check lock delay first (happens every frame once locking starts)
            if (this.isLocking) {
                if (currentTime - this.lockTime >= this.lockDelay) {
                    this.lockPiece(currentTime);
                    // lockPiece spawns new piece and resets isLocking
                }
                // While locking, skip automatic drop - piece is waiting to lock
                // Don't return, continue to update effects
            } else {
                // Not locking - handle automatic drop
                const elapsed = currentTime - this.lastDropTime;
                if (elapsed >= this.dropInterval) {
                    // Try to move piece down
                    if (this.movePiece(0, 1)) {
                        // Piece moved successfully
                        this.lastDropTime = currentTime;
                        this.isLocking = false;
                        this.lockTime = 0;
                    } else {
                        // Piece can't move down - start lock delay
                        this.isLocking = true;
                        this.lockTime = currentTime;
                        // Lock delay will be checked at top of loop on next frame
                    }
                }
            }
        }
        
        // Update effects
        if (this.isPreview) {
            if (this.particles) this.particles.update();
            if (this.screenEffects) this.screenEffects.update();
        } else {
            // Update sprites
            this.updateCurrentPieceSprite();
            this.updateGhostPieceSprite();
            if (this.nesEffects && typeof this.nesEffects.update === 'function') {
                this.nesEffects.update();
            }
        }
    }
    
    gameLoop(currentTime) {
        if (this.isDestroyed) return;
        
        // Ensure we always have a valid timestamp
        // requestAnimationFrame provides a DOMHighResTimeStamp
        // PixiJS ticker we pass performance.now()
        const timestamp = currentTime || performance.now();
        
        this.update(timestamp);
        
        if (this.isPreview) {
            this.draw();
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        } else {
            // PixiJS handles rendering automatically, but we still need to update our draw calls
            this.drawPixi();
            // Ticker handles loop, so don't call requestAnimationFrame
        }
    }
    
    cleanup() {
        // Stop game loop
        this.isDestroyed = true;
        
        if (this.isPreview) {
            if (this.animationFrameId !== null) {
                cancelAnimationFrame(this.animationFrameId);
            }
        } else {
            // Remove ticker if using PixiJS
            if (this.graphics) {
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
            this.boardSprites = [];
            this.currentPieceSprite = null;
            this.ghostPieceSprite = null;
            this.nextPieceSprite = null;
        }
        
        // Remove event listeners
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
        }
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = 1000;
        
        // Initialize time tracking - always use performance.now() for consistency
        const now = performance.now();
        if (!this.lastTime) {
            this.lastTime = now;
        }
        this.lastDropTime = now;
        
        this.initializeBoard();
        this.spawnPiece();
        this.nextPiece = this.getRandomPiece();
        
        // Update sprites for new game
        if (!this.isPreview) {
            // Update background for starting level
            this.drawBackgroundPixi();
            this.updateBoardSprites();
            this.updateNextPieceSprite();
        }
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.lastDropTime = performance.now();
        }
    }
    
    resetGame() {
        this.startGame();
    }
    
    gameOver() {
        // Don't do anything if game is destroyed
        if (this.isDestroyed) return;
        
        this.gameState = 'gameOver';
        
        // Only check for high score if this is still the active game
        const activeCanvas = document.getElementById('game-canvas');
        if (activeCanvas && activeCanvas === this.canvas) {
            if (highScoreManager.checkHighScore('tetris', this.score)) {
                highScoreManager.requestNameEntry('tetris', this.score);
            }
        }
    }
    
    drawPreview() {
        // Draw a simple animated preview
        const previewPieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        const previewX = this.width / 2;
        const previewY = this.height / 2;
        
        // Clear
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw some pieces
        previewPieces.forEach((piece, index) => {
            const shape = this.getPieceShape(piece, 0);
            const color = this.pieceColors[piece];
            const x = previewX - 35 + (index % 4) * 18;
            const y = previewY - 30 + Math.floor(index / 4) * 20;
            
            if (shape) {
                for (let row = 0; row < shape.length; row++) {
                    for (let col = 0; col < shape[row].length; col++) {
                        if (shape[row][col]) {
                            this.ctx.fillStyle = color;
                            this.ctx.fillRect(x + col * 6, y + row * 6, 5, 5);
                        }
                    }
                }
            }
        });
        
        // Draw title
        this.ctx.fillStyle = '#00ffff';
        this.ctx.font = 'bold 20px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('TETRA CIRCUIT', previewX, previewY + 50);
    }
}

// Initialize Tetris preview
function initTetris() {
    const canvas = document.getElementById('tetris-preview');
    if (canvas) {
        new TetrisGame(canvas);
    }
}
