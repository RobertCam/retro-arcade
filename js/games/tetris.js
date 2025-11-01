// Classic Tetris game implementation
class TetrisGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Check if this is a preview canvas (smaller)
        this.isPreview = this.width < 400;
        
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
        
        // Particles for line clears
        this.particles = new ParticleSystem();
        this.screenEffects = new ScreenEffects(canvas);
        this.crtFilter = new CRTFilter(canvas);
        
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
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
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
        
        if (this.movePiece(0, 1)) {
            this.score += 1; // 1 point per cell for soft drop
        }
    }
    
    hardDrop() {
        if (this.gameState !== 'playing' || !this.currentPiece) return;
        
        let dropDistance = 0;
        while (this.movePiece(0, 1)) {
            dropDistance++;
        }
        
        this.score += dropDistance * 2; // 2 points per cell for hard drop
        this.lockPiece();
    }
    
    lockPiece() {
        if (!this.currentPiece) return;
        
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
        
        // Spawn next piece
        this.spawnPiece(this.nextPiece);
        this.nextPiece = this.getRandomPiece();
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
        
        // Score based on lines cleared
        const lineScores = {
            1: 100,
            2: 300,
            3: 500,
            4: 800
        };
        
        const baseScore = lineScores[linesToClear.length] || 0;
        this.score += baseScore * this.level;
        this.lines += linesToClear.length;
        
        // Level up every 10 lines
        const newLevel = Math.floor(this.lines / 10) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            // Increase drop speed (decrease interval)
            this.dropInterval = Math.max(50, 1000 - (this.level - 1) * 50);
        }
        
        // Create particles for cleared lines
        linesToClear.forEach(row => {
            for (let col = 0; col < this.cols; col++) {
                const x = this.boardX + col * this.cellSize + this.cellSize / 2;
                const y = this.boardY + row * this.cellSize + this.cellSize / 2;
                const pieceColor = this.pieceColors[this.board[row][col]] || '#ffffff';
                
                // Create explosion effect for each cell
                this.particles.explode(x, y, 5, pieceColor, 'default');
                this.particles.sparkBurst(x, y, 3, pieceColor);
            }
        });
        
        // Remove cleared lines
        linesToClear.forEach(row => {
            this.board.splice(row, 1);
            this.board.unshift(new Array(this.cols).fill(0));
        });
        
        // Screen shake effect (intensity based on number of lines)
        const shakeIntensity = Math.min(8 + linesToClear.length * 2, 15);
        this.screenEffects.shake(shakeIntensity, 5);
        
        // Flash effect for line clear
        this.screenEffects.flash('#00ffff', 10, 0.3);
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
        this.ctx.fillText('TETRIS', this.width / 2, this.height / 2 - 100);
        
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
    
    draw() {
        // Don't draw if destroyed
        if (this.isDestroyed) return;
        
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
        const transform = this.screenEffects.getTransform();
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
        this.particles.update();
        this.particles.draw(this.ctx);
        
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
        this.screenEffects.drawFlash();
        this.screenEffects.drawRipple();
        
        // Apply CRT filter
        this.crtFilter.draw(this.ctx);
    }
    
    update(currentTime) {
        if (this.isPreview || this.isDestroyed) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        if (this.gameState !== 'playing') return;
        
        // Handle key repeats for movement
        const now = performance.now();
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
            const elapsed = currentTime - this.lastDropTime;
            
            if (elapsed >= this.dropInterval) {
                // Try to move piece down
                if (this.movePiece(0, 1)) {
                    this.lastDropTime = currentTime;
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
                            this.lockPiece();
                            this.lastDropTime = currentTime;
                        }
                    }
                }
            }
        }
        
        // Update particles
        this.particles.update();
        this.screenEffects.update();
    }
    
    gameLoop(currentTime) {
        if (this.isDestroyed) return;
        
        this.update(currentTime);
        this.draw();
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
    
    cleanup() {
        // Stop game loop
        this.isDestroyed = true;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
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
        this.lastDropTime = performance.now();
        
        this.initializeBoard();
        this.spawnPiece();
        this.nextPiece = this.getRandomPiece();
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
        this.ctx.fillText('TETRIS', previewX, previewY + 50);
    }
}

// Initialize Tetris preview
function initTetris() {
    const canvas = document.getElementById('tetris-preview');
    if (canvas) {
        new TetrisGame(canvas);
    }
}
