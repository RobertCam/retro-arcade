// Tetra Stack — classic tetromino puzzle with Three.js extruded playfield
class TetrisGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        this.isPreview = this.width < 400;
        this.onReady = null;
        this.isReady = false;

        if (this.isPreview) {
            this.ctx = canvas.getContext('2d');
            this.graphics = null;
        } else {
            this.ctx = null;
            this.graphics = new ThreeGraphicsCore(canvas, {
                width: this.width,
                height: this.height,
                backgroundColor: 0x000011,
                cameraMode: 'playfield2d'
            });
        }

        this.gameState = 'menu';
        this.score = 0;
        this.level = 1;
        this.lines = 0;

        this.cols = 10;
        this.rows = 20;
        this.cellSize = this.isPreview ? 8 : 26;
        this.blockDepth = 16;
        this.ghostDepth = 4;

        if (this.isPreview) {
            this.boardX = (this.width - this.cols * this.cellSize) / 2;
            this.boardY = 10;
        } else {
            // Centered well with room for NEXT panel on the left
            this.boardX = 255;
            this.boardY = 36;
        }

        this.board = [];
        this.initializeBoard();

        this.currentPiece = null;
        this.currentX = 0;
        this.currentY = 0;
        this.currentRotation = 0;
        this.nextPiece = null;

        this.dropInterval = 1000;
        this.lastDropTime = 0;
        this.lockDelay = 500;
        this.lockTime = 0;
        this.isLocking = false;
        this.showGhost = true;

        this.linesClearing = [];
        this.lineClearAnimationTime = 0;
        this.lineClearTimeout = null;
        this.lastLineClearData = null;
        this.lineClearDisplayTime = 0;

        this.tetrominoes = {
            I: {
                shape: [
                    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
                    [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
                    [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
                    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]
                ],
                rotations: 4
            },
            O: {
                shape: [[[1, 1], [1, 1]]],
                rotations: 1
            },
            T: {
                shape: [
                    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
                    [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
                    [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
                    [[0, 1, 0], [1, 1, 0], [0, 1, 0]]
                ],
                rotations: 4
            },
            S: {
                shape: [
                    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
                    [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
                    [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
                    [[1, 0, 0], [1, 1, 0], [0, 1, 0]]
                ],
                rotations: 4
            },
            Z: {
                shape: [
                    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
                    [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
                    [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
                    [[0, 1, 0], [1, 1, 0], [1, 0, 0]]
                ],
                rotations: 4
            },
            J: {
                shape: [
                    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
                    [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
                    [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
                    [[0, 1, 0], [0, 1, 0], [1, 1, 0]]
                ],
                rotations: 4
            },
            L: {
                shape: [
                    [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
                    [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
                    [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
                    [[1, 1, 0], [0, 1, 0], [0, 1, 0]]
                ],
                rotations: 4
            }
        };

        this.pieceColors = {
            I: 0x00e0f0,
            O: 0xf0c000,
            T: 0xb030f0,
            S: 0x20d040,
            Z: 0xe02020,
            J: 0x2050e8,
            L: 0xf08010
        };
        this.pieceColorsCss = {
            I: '#00e8f0',
            O: '#f0d000',
            T: '#b040f0',
            S: '#20e040',
            Z: '#f02828',
            J: '#3060f0',
            L: '#f09020'
        };

        this.keys = {};
        this.keyRepeatDelay = 150;
        this.keyRepeatInterval = 50;
        this.lastKeyPress = {};
        this.lastKeyRepeatCount = {};
        this.setupInput();

        this.sm = null;
        this.nesEffects = null;
        this.boardRoot = null;
        this.wellRoot = null;
        this.cellViews = [];
        this.activeCells = [];
        this.ghostCells = [];
        this.nextRoot = null;
        this.nextCells = [];
        this.menuRoot = null;
        this.pauseRoot = null;
        this.overlayRoot = null;
        this.bonusRoot = null;
        this.playBg = null;
        this.menuBg = null;
        this._frameKey = '';
        this._menuKey = '';
        this._bonusKey = '';
        this._statsKey = '';

        this.lastTime = 0;
        this.tickerCallback = null;
        this.animationFrameId = null;
        this._useRafLoop = false;
        this.isDestroyed = false;

        if (this.isPreview) {
            this.drawPreview();
            return;
        }

        this.initGraphics();
    }

    markReady() {
        this.isReady = true;
        queueMicrotask(() => {
            if (typeof this.onReady === 'function') this.onReady();
        });
    }

    async initGraphics() {
        if (this.isPreview) return;
        try {
            await this.graphics.init();
            if (!this.graphics?.isInitialized) {
                this.startFallbackLoop();
                this.markReady();
                return;
            }
            await this.finishGraphicsInit();
        } catch (err) {
            console.error('Tetra Stack init failed:', err);
            this.startFallbackLoop();
            this.markReady();
        }
    }

    async finishGraphicsInit() {
        try {
            this.sm = this.graphics.sprites;
            this.nesEffects = this.graphics.getScreenEffects();
            if (this.nesEffects) {
                this.nesEffects.crtScanlineIntensity = 0.04;
                this.nesEffects.crtVignetteIntensity = 0.07;
                this.nesEffects.crtCurvature = 0.01;
                if (this.nesEffects.crtPass?.uniforms) {
                    const u = this.nesEffects.crtPass.uniforms;
                    if (u.scanlineIntensity) u.scanlineIntensity.value = 0.04;
                    if (u.vignetteIntensity) u.vignetteIntensity.value = 0.07;
                    if (u.curvature) u.curvature.value = 0.01;
                }
            }
            if (this.graphics.renderer) {
                this.graphics.renderer.toneMappingExposure = 1.18;
                this.graphics.renderer.setClearColor(0x0a1524, 1);
            }
            this.setupStageLights();

            this.buildStaticScene();
            this.startGameLoop();
            this.graphics.start?.();
            this.syncVisuals();
        } catch (err) {
            console.error('Tetra Stack finishGraphicsInit failed:', err);
            this.startFallbackLoop();
        } finally {
            this.markReady();
        }
    }

    setupStageLights() {
        const THREE = window.THREE;
        const lights = this.graphics?.lights;
        const scene = this.graphics?.scene;
        if (!lights || !scene || !THREE) return;

        // Balanced stage: enough ambient to avoid crushed shadows, enough key to sculpt
        if (lights.ambient) {
            lights.ambient.color.setHex(0x8aa4bc);
            lights.ambient.intensity = 0.85;
        }
        if (lights.key) {
            lights.key.color.setHex(0xfff6e8);
            lights.key.intensity = 1.85;
            lights.key.position.set(
                this.boardX + 40,
                -(this.boardY - 80),
                640
            );
        }
        if (lights.fill) {
            lights.fill.color.setHex(0x9ad0ff);
            lights.fill.intensity = 1.05;
            lights.fill.position.set(
                this.boardX + this.cols * this.cellSize + 120,
                -(this.boardY + 160),
                420
            );
            lights.fill.distance = 2600;
        }
        if (lights.rim) {
            lights.rim.color.setHex(0x66e8ff);
            lights.rim.intensity = 0.9;
            lights.rim.position.set(
                this.boardX - 200,
                -(this.boardY + 100),
                380
            );
        }

        // Cyan accent from the bezel / well
        if (this._wellLight) scene.remove(this._wellLight);
        this._wellLight = new THREE.PointLight(0x5af0ff, 1.5, 1000, 2);
        this._wellLight.position.set(
            this.boardX + (this.cols * this.cellSize) / 2,
            -(this.boardY + (this.rows * this.cellSize) / 2),
            140
        );
        scene.add(this._wellLight);

        // Warm kick under the stack for underside separation
        if (this._kickLight) scene.remove(this._kickLight);
        this._kickLight = new THREE.PointLight(0xffb070, 0.7, 1200, 2);
        this._kickLight.position.set(
            this.boardX + this.cols * this.cellSize * 0.5,
            -(this.boardY + this.rows * this.cellSize + 60),
            180
        );
        scene.add(this._kickLight);
    }

    startFallbackLoop() {
        this._useRafLoop = true;
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }

    startGameLoop() {
        const ticker = this.graphics?.getTicker?.();
        if (ticker) {
            this._useRafLoop = false;
            this.tickerCallback = () => this.gameLoop(performance.now());
            ticker.add(this.tickerCallback);
        } else {
            this.startFallbackLoop();
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
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal && nameEntryModal.classList.contains('active')) return;
            if (!this.isPreview) {
                const activeCanvas = document.getElementById('game-canvas');
                if (activeCanvas !== this.canvas) return;
            }

            this.keys[e.code] = true;
            this.lastKeyPress[e.code] = performance.now();

            if (e.code === 'Space') {
                if (this.gameState === 'menu' || this.gameState === 'gameOver') {
                    this.startGame();
                    e.preventDefault();
                } else if (this.gameState === 'playing') {
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

            if (this.gameState !== 'playing') return;

            if (e.code === 'ArrowUp' || e.code === 'KeyZ') {
                this.rotatePiece(-1);
                e.preventDefault();
            }
            if (e.code === 'KeyX') {
                this.rotatePiece(1);
                e.preventDefault();
            }
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
        this.currentPiece = pieceType || this.getRandomPiece();
        this.currentRotation = 0;
        this.currentX = Math.floor(this.cols / 2) - 1;
        this.currentY = 0;
        this.isLocking = false;
        this.lockTime = 0;

        if (this.checkCollision(this.currentPiece, this.currentRotation, this.currentX, this.currentY)) {
            this.gameOver();
        }
    }

    getPieceShape(pieceType, rotation) {
        const piece = this.tetrominoes[pieceType];
        if (!piece) return null;
        const n = piece.rotations;
        const r = ((rotation % n) + n) % n;
        return piece.shape[r];
    }

    checkCollision(pieceType, rotation, x, y) {
        const shape = this.getPieceShape(pieceType, rotation);
        if (!shape) return true;

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (!shape[row][col]) continue;
                const boardX = x + col;
                const boardY = y + row;
                if (boardX < 0 || boardX >= this.cols || boardY >= this.rows) return true;
                if (boardY >= 0 && this.board[boardY][boardX] !== 0) return true;
            }
        }
        return false;
    }

    movePiece(dx, dy) {
        if (this.gameState !== 'playing' || !this.currentPiece) return false;
        const newX = this.currentX + dx;
        const newY = this.currentY + dy;
        if (this.checkCollision(this.currentPiece, this.currentRotation, newX, newY)) return false;
        this.currentX = newX;
        this.currentY = newY;
        this.isLocking = false;
        this.lockTime = 0;
        return true;
    }

    rotatePiece(direction) {
        if (this.gameState !== 'playing' || !this.currentPiece) return false;
        const newRotation = this.currentRotation + direction;
        if (!this.checkCollision(this.currentPiece, newRotation, this.currentX, this.currentY)) {
            this.currentRotation = newRotation;
            this.isLocking = false;
            this.lockTime = 0;
            return true;
        }
        for (const offset of [-1, 1, -2, 2]) {
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
            this.score += 1;
            this.isLocking = false;
            this.lockTime = 0;
        } else if (!this.isLocking) {
            this.isLocking = true;
            this.lockTime = currentTime;
        } else if (currentTime - this.lockTime >= this.lockDelay) {
            this.lockPiece(currentTime);
        }
    }

    hardDrop() {
        if (this.gameState !== 'playing' || !this.currentPiece) return;
        let dropDistance = 0;
        while (this.movePiece(0, 1)) dropDistance++;
        this.score += dropDistance * 2;
        this.lockPiece(performance.now());
    }

    lockPiece(currentTime = null) {
        if (!this.currentPiece) return;
        if (!currentTime) currentTime = performance.now();

        const shape = this.getPieceShape(this.currentPiece, this.currentRotation);
        if (!shape) return;

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (!shape[row][col]) continue;
                const boardX = this.currentX + col;
                const boardY = this.currentY + row;
                if (boardY >= 0 && boardY < this.rows && boardX >= 0 && boardX < this.cols) {
                    this.board[boardY][boardX] = this.currentPiece;
                }
            }
        }

        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tetris', 'lock');

        this.clearLines();
        this.spawnPiece(this.nextPiece);
        this.nextPiece = this.getRandomPiece();
        this.lastDropTime = currentTime;
    }

    flushPendingLineClear() {
        if (this.lineClearTimeout) {
            clearTimeout(this.lineClearTimeout);
            this.lineClearTimeout = null;
        }
        if (this.linesClearing.length > 0) {
            this.removeClearedLines(this.linesClearing);
            this.linesClearing = [];
            this.lineClearAnimationTime = 0;
        }
    }

    removeClearedLines(linesToClear) {
        const clearSet = new Set(linesToClear);
        this.board = this.board.filter((_, row) => !clearSet.has(row));
        while (this.board.length < this.rows) {
            this.board.unshift(new Array(this.cols).fill(0));
        }
    }

    clearLines() {
        this.flushPendingLineClear();

        const linesToClear = [];
        for (let row = this.rows - 1; row >= 0; row--) {
            let isFull = true;
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === 0) {
                    isFull = false;
                    break;
                }
            }
            if (isFull) linesToClear.push(row);
        }
        if (linesToClear.length === 0) return;

        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tetris', 'lineClear');

        const lineScores = {
            1: { base: 100, bonus: 0, name: 'Single' },
            2: { base: 300, bonus: 100, name: 'Double' },
            3: { base: 500, bonus: 200, name: 'Triple' },
            4: { base: 800, bonus: 400, name: 'TETRIS!' }
        };
        const scoreData = lineScores[linesToClear.length] || { base: 0, bonus: 0, name: '' };
        const totalScore = (scoreData.base + scoreData.bonus) * this.level;
        this.score += totalScore;
        this.lines += linesToClear.length;
        this.lastLineClearData = {
            count: linesToClear.length,
            name: scoreData.name,
            score: totalScore,
            bonus: scoreData.bonus * this.level
        };

        const newLevel = Math.floor(this.lines / 10) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tetris', 'levelUp');
            this.dropInterval = Math.max(50, 1000 - (this.level - 1) * 50);
            this.updatePlayBackground();
        }

        this.linesClearing = [...linesToClear];
        this.lineClearAnimationTime = performance.now();
        this.lineClearDisplayTime = performance.now();
        this._bonusKey = '';

        const effects = this.nesEffects;
        if (effects) {
            const shakeIntensity = Math.min(8 + linesToClear.length * 3, 20);
            if (typeof effects.shake === 'function') effects.shake(shakeIntensity, 8);
            const flashColors = { 1: '#00ffff', 2: '#00ff00', 3: '#ffff00', 4: '#ff00ff' };
            if (typeof effects.flash === 'function') {
                effects.flash(flashColors[linesToClear.length] || '#00ffff', 8, 0.3);
            }
        }

        this.lineClearTimeout = setTimeout(() => {
            this.lineClearTimeout = null;
            this.removeClearedLines(linesToClear);
            this.linesClearing = [];
            this.lineClearAnimationTime = 0;
        }, 400);
    }

    getGhostY() {
        if (!this.currentPiece || !this.showGhost) return this.currentY;
        let ghostY = this.currentY;
        while (!this.checkCollision(this.currentPiece, this.currentRotation, this.currentX, ghostY + 1)) {
            ghostY++;
        }
        return ghostY;
    }

    // —— Three.js scene ——

    cellScreenPos(col, row) {
        return {
            x: this.boardX + col * this.cellSize,
            y: this.boardY + row * this.cellSize
        };
    }

    makeBlock(size, depth, color, options = {}) {
        return this.sm.createRect(size, size, color, {
            depth,
            pbr: true,
            metalness: options.metalness ?? 0.18,
            roughness: options.roughness ?? 0.45,
            emissive: options.emissive ?? color,
            emissiveIntensity: options.emissiveIntensity ?? 0.4,
            alpha: options.alpha,
            z: options.z ?? 0,
            origin: 'topleft'
        });
    }

    setBlockColor(block, color, emissiveIntensity = 0.55) {
        if (!block?.object?.material) return;
        const mat = block.object.material;
        mat.color.setHex(color);
        if (mat.emissive) {
            mat.emissive.setHex(color);
            mat.emissiveIntensity = emissiveIntensity;
        }
        mat.needsUpdate = true;
    }

    buildStaticScene() {
        if (!this.sm) return;
        const bg = this.graphics.getLayer('background');
        const fg = this.graphics.getLayer('foreground');
        const ui = this.graphics.getLayer('ui');

        this.menuBg = this.sm.createRect(this.width + 80, this.height + 80, 0x152030, {
            depth: 4,
            unlit: true,
            z: -40,
            x: -40,
            y: -40
        });
        bg.addChild(this.menuBg);

        this.playBg = this.sm.createGroup({ x: 0, y: 0, z: -30 });
        bg.addChild(this.playBg);
        this.updatePlayBackground(true);

        this.wellRoot = this.sm.createGroup();
        fg.addChild(this.wellRoot);

        const boardW = this.cols * this.cellSize;
        const boardH = this.rows * this.cellSize;
        const bezel = 18;
        const wall = 10;
        const chassisPad = 28;

        // Side cabinet panels — fill dead space so it can't read as playfield
        const panelMat = {
            depth: 12,
            pbr: true,
            metalness: 0.45,
            roughness: 0.55,
            emissive: 0x1a3a55,
            emissiveIntensity: 0.08
        };
        const leftPanelW = Math.max(40, this.boardX - chassisPad - 8);
        const rightPanelX = this.boardX + boardW + chassisPad;
        const rightPanelW = Math.max(40, this.width - rightPanelX + 20);
        this.wellRoot.addChild(this.sm.createRect(
            leftPanelW,
            this.height + 40,
            0x31485e,
            { ...panelMat, x: -8, y: -20, z: -22 }
        ));
        this.wellRoot.addChild(this.sm.createRect(
            rightPanelW,
            this.height + 40,
            0x31485e,
            { ...panelMat, x: rightPanelX, y: -20, z: -22 }
        ));
        // Panel rivet/groove details so sides read as machine, not empty grid
        for (let i = 0; i < 6; i++) {
            const gy = 40 + i * 90;
            this.wellRoot.addChild(this.sm.createRect(leftPanelW - 24, 3, 0x1a2c3c, {
                depth: 4, unlit: true, alpha: 0.55,
                x: 4, y: gy, z: -18
            }));
            this.wellRoot.addChild(this.sm.createRect(rightPanelW - 24, 3, 0x1a2c3c, {
                depth: 4, unlit: true, alpha: 0.55,
                x: rightPanelX + 12, y: gy, z: -18
            }));
        }

        // Outer chassis plate behind the well
        this.wellRoot.addChild(this.sm.createRect(
            boardW + (chassisPad + bezel) * 2,
            boardH + (chassisPad + bezel) * 2,
            0x1c2e42,
            {
                depth: 26,
                pbr: true,
                metalness: 0.5,
                roughness: 0.48,
                emissive: 0x0a1828,
                emissiveIntensity: 0.1,
                x: this.boardX - chassisPad - bezel,
                y: this.boardY - chassisPad - bezel,
                z: -20
            }
        ));

        // Well floor first (must not be covered by a solid bezel slab)
        this.wellRoot.addChild(this.sm.createRect(boardW, boardH, 0x081828, {
            depth: 10,
            pbr: true,
            metalness: 0.1,
            roughness: 0.85,
            emissive: 0x040c18,
            emissiveIntensity: 0.08,
            x: this.boardX,
            y: this.boardY,
            z: -14
        }));

        // Hollow cyan bezel — four sides only, so the floor stays visible
        const bezelMat = {
            depth: 20,
            pbr: true,
            metalness: 0.35,
            roughness: 0.32,
            emissive: 0x2ad0e8,
            emissiveIntensity: 0.55,
            z: -6
        };
        const outerW = boardW + bezel * 2;
        const outerH = boardH + bezel * 2;
        const bx = this.boardX - bezel;
        const by = this.boardY - bezel;
        // Top & bottom rails
        this.wellRoot.addChild(this.sm.createRect(outerW, bezel, 0x3ad8f0, {
            ...bezelMat, x: bx, y: by
        }));
        this.wellRoot.addChild(this.sm.createRect(outerW, bezel, 0x3ad8f0, {
            ...bezelMat, x: bx, y: this.boardY + boardH
        }));
        // Left & right rails
        this.wellRoot.addChild(this.sm.createRect(bezel, boardH, 0x3ad8f0, {
            ...bezelMat, x: bx, y: this.boardY
        }));
        this.wellRoot.addChild(this.sm.createRect(bezel, boardH, 0x3ad8f0, {
            ...bezelMat, x: this.boardX + boardW, y: this.boardY
        }));

        // Inner dark lip between bezel and grid
        const lipMat = {
            depth: 16,
            pbr: true,
            metalness: 0.3,
            roughness: 0.6,
            z: -10
        };
        this.wellRoot.addChild(this.sm.createRect(wall, boardH + wall * 2, 0x0a1520, {
            ...lipMat, x: this.boardX - wall, y: this.boardY - wall
        }));
        this.wellRoot.addChild(this.sm.createRect(wall, boardH + wall * 2, 0x0a1520, {
            ...lipMat, x: this.boardX + boardW, y: this.boardY - wall
        }));
        this.wellRoot.addChild(this.sm.createRect(boardW, wall, 0x0a1520, {
            ...lipMat, x: this.boardX, y: this.boardY - wall
        }));
        this.wellRoot.addChild(this.sm.createRect(boardW, wall, 0x0a1520, {
            ...lipMat, x: this.boardX, y: this.boardY + boardH
        }));

        // Raised side walls for physical depth
        const wallDepth = 24;
        const wallColor = 0x243e56;
        const wallOpts = {
            depth: wallDepth,
            pbr: true,
            metalness: 0.4,
            roughness: 0.42,
            emissive: 0x102030,
            emissiveIntensity: 0.1,
            z: -2
        };
        this.wellRoot.addChild(this.sm.createRect(wall - 2, boardH + wall * 2, wallColor, {
            ...wallOpts,
            x: this.boardX - wall + 1,
            y: this.boardY - wall
        }));
        this.wellRoot.addChild(this.sm.createRect(wall - 2, boardH + wall * 2, wallColor, {
            ...wallOpts,
            x: this.boardX + boardW + 1,
            y: this.boardY - wall
        }));
        this.wellRoot.addChild(this.sm.createRect(boardW, wall - 2, wallColor, {
            ...wallOpts,
            x: this.boardX,
            y: this.boardY - wall + 1
        }));
        this.wellRoot.addChild(this.sm.createRect(boardW, wall - 2, wallColor, {
            ...wallOpts,
            x: this.boardX,
            y: this.boardY + boardH + 1
        }));

        // Bright inner trim line on the playable edge
        const trim = 2;
        const trimColor = 0x9af6ff;
        const trimOpts = { depth: 5, unlit: true, alpha: 0.95, z: 1 };
        this.wellRoot.addChild(this.sm.createRect(trim, boardH, trimColor, {
            ...trimOpts, x: this.boardX, y: this.boardY
        }));
        this.wellRoot.addChild(this.sm.createRect(trim, boardH, trimColor, {
            ...trimOpts, x: this.boardX + boardW - trim, y: this.boardY
        }));
        this.wellRoot.addChild(this.sm.createRect(boardW, trim, trimColor, {
            ...trimOpts, x: this.boardX, y: this.boardY
        }));
        this.wellRoot.addChild(this.sm.createRect(boardW, trim, trimColor, {
            ...trimOpts, x: this.boardX, y: this.boardY + boardH - trim
        }));

        // Readable grid on the dark floor
        for (let c = 0; c <= this.cols; c++) {
            this.wellRoot.addChild(this.sm.createRect(1.25, boardH, 0x2a5570, {
                depth: 2,
                unlit: true,
                alpha: 0.65,
                x: this.boardX + c * this.cellSize - 0.6,
                y: this.boardY,
                z: -5
            }));
        }
        for (let r = 0; r <= this.rows; r++) {
            this.wellRoot.addChild(this.sm.createRect(boardW, 1.25, 0x2a5570, {
                depth: 2,
                unlit: true,
                alpha: 0.65,
                x: this.boardX,
                y: this.boardY + r * this.cellSize - 0.6,
                z: -5
            }));
        }

        this.boardRoot = this.sm.createGroup();
        fg.addChild(this.boardRoot);

        const inset = 2;
        const blockSize = this.cellSize - inset;
        this.cellViews = [];
        for (let row = 0; row < this.rows; row++) {
            this.cellViews[row] = [];
            for (let col = 0; col < this.cols; col++) {
                const pos = this.cellScreenPos(col, row);
                const block = this.makeBlock(blockSize, this.blockDepth, 0xffffff, {
                    emissiveIntensity: 0.58,
                    z: 0
                });
                block.x = pos.x + inset / 2;
                block.y = pos.y + inset / 2;
                block.visible = false;
                this.boardRoot.addChild(block);
                this.cellViews[row][col] = block;
            }
        }

        this.activeCells = [];
        this.ghostCells = [];
        for (let i = 0; i < 4; i++) {
            const active = this.makeBlock(blockSize, this.blockDepth + 2, 0xffffff, {
                emissiveIntensity: 0.72,
                z: 4
            });
            active.visible = false;
            this.boardRoot.addChild(active);
            this.activeCells.push(active);

            const ghost = this.makeBlock(blockSize - 2, this.ghostDepth, 0xffffff, {
                emissiveIntensity: 0.2,
                alpha: 0.35,
                metalness: 0.08,
                roughness: 0.55,
                z: -2
            });
            ghost.visible = false;
            this.boardRoot.addChild(ghost);
            this.ghostCells.push(ghost);
        }

        // Next-piece panel sits on the left cabinet
        this.nextRoot = this.sm.createGroup();
        fg.addChild(this.nextRoot);
        const nx = 42;
        const ny = 92;
        this.nextRoot.addChild(this.sm.createRect(128, 142, 0x243848, {
            depth: 18,
            pbr: true,
            metalness: 0.4,
            roughness: 0.45,
            emissive: 0x152838,
            emissiveIntensity: 0.12,
            x: nx - 14,
            y: ny - 40,
            z: -6
        }));
        this.nextRoot.addChild(this.sm.createRect(128, 5, 0x5ef0ff, {
            depth: 8,
            pbr: true,
            emissive: 0x2ad8f0,
            emissiveIntensity: 0.55,
            x: nx - 14,
            y: ny - 40,
            z: 4
        }));
        const nextLabel = this.sm.createText('NEXT', {
            fontSize: 18,
            fill: 0x8ef6ff,
            z: 20,
            billboard: true
        });
        nextLabel.x = nx + 50;
        nextLabel.y = ny - 20;
        this.nextRoot.addChild(nextLabel);

        this.nextCells = [];
        for (let i = 0; i < 4; i++) {
            const cell = this.makeBlock(22, 12, 0xffffff, { emissiveIntensity: 0.6, z: 6 });
            cell.visible = false;
            this.nextRoot.addChild(cell);
            this.nextCells.push(cell);
        }
        this._nextPanel = { x: nx, y: ny + 16, size: 22 };

        this.menuRoot = this.sm.createGroup();
        ui.addChild(this.menuRoot);
        this.pauseRoot = this.sm.createGroup();
        ui.addChild(this.pauseRoot);
        this.overlayRoot = this.sm.createGroup();
        ui.addChild(this.overlayRoot);
        this.bonusRoot = this.sm.createGroup();
        ui.addChild(this.bonusRoot);

        this.rebuildPause();
        this.rebuildMenu();
    }

    updatePlayBackground(force = false) {
        if (!this.sm || !this.playBg) return;
        const theme = Math.floor(this.level / 5) % 4;
        if (!force && this._bgTheme === theme) return;
        this._bgTheme = theme;

        this.playBg.removeChildren();

        const palettes = [
            { deep: 0x07101c, mid: 0x143048, glow: 0x1a6a88, accent: 0x3ad8f0, grid: 0x2a7098 },
            { deep: 0x10081c, mid: 0x2a1848, glow: 0x6a2a88, accent: 0xc06aff, grid: 0x7040a0 },
            { deep: 0x061410, mid: 0x143830, glow: 0x1a7050, accent: 0x3aeea0, grid: 0x2a8060 },
            { deep: 0x180808, mid: 0x302018, glow: 0x804018, accent: 0xff9040, grid: 0xa05030 }
        ];
        const p = palettes[theme];
        const boardW = this.cols * this.cellSize;
        const boardH = this.rows * this.cellSize;
        // Draw interest inside the camera frame (tight around NEXT + well)
        const viewX = this.boardX - 140;
        const viewY = this.boardY - 40;
        const viewW = boardW + 180;
        const viewH = boardH + 80;

        // Base gradient across the framed stage
        const steps = 22;
        const stepH = (viewH + 40) / steps;
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const color = this.lerpColor(p.deep, p.mid, Math.pow(t, 0.8));
            this.playBg.addChild(this.sm.createRect(viewW + 60, stepH + 2, color, {
                depth: 2,
                unlit: true,
                x: viewX - 30,
                y: viewY - 20 + i * stepH,
                z: -48
            }));
        }

        // Soft glow plate behind the well
        this.playBg.addChild(this.sm.createRect(boardW + 100, boardH + 80, p.glow, {
            depth: 2,
            unlit: true,
            alpha: 0.22,
            x: this.boardX - 50,
            y: this.boardY - 40,
            z: -44
        }));
        this.playBg.addChild(this.sm.createRect(boardW + 40, 50, p.accent, {
            depth: 2,
            unlit: true,
            alpha: 0.12,
            x: this.boardX - 20,
            y: this.boardY + boardH * 0.55,
            z: -43
        }));

        // Circuit-style trace grid on the side panels (inside frame)
        const drawTraces = (x0, y0, w, h) => {
            for (let i = 0; i < 5; i++) {
                const y = y0 + 30 + i * (h / 5);
                this.playBg.addChild(this.sm.createRect(w - 16, 1.5, p.grid, {
                    depth: 2, unlit: true, alpha: 0.35,
                    x: x0 + 8, y, z: -40
                }));
                // stub traces
                const stubX = x0 + 12 + (i % 3) * (w / 4);
                this.playBg.addChild(this.sm.createRect(1.5, 18, p.grid, {
                    depth: 2, unlit: true, alpha: 0.4,
                    x: stubX, y: y - 9, z: -39
                }));
                this.playBg.addChild(this.sm.createRect(6, 6, p.accent, {
                    depth: 3, unlit: true, alpha: 0.45,
                    x: stubX - 2, y: y - 2, z: -38
                }));
            }
        };
        drawTraces(viewX, this.boardY, this.boardX - viewX - 20, boardH);
        drawTraces(this.boardX + boardW + 36, this.boardY, 70, boardH);

        // Perspective mini-grid below the well
        const floorY = this.boardY + boardH + 8;
        for (let i = 0; i < 8; i++) {
            const t = i / 8;
            const y = floorY + t * 36;
            const w = boardW + 40 + t * 80;
            this.playBg.addChild(this.sm.createRect(w, 1.4, p.grid, {
                depth: 2,
                unlit: true,
                alpha: 0.4 * (1 - t),
                x: this.boardX + boardW / 2 - w / 2,
                y,
                z: -41
            }));
        }

        // Floating motes near the well
        for (let i = 0; i < 36; i++) {
            const size = 1.5 + Math.random() * 2.5;
            this.playBg.addChild(this.sm.createRect(size, size, p.accent, {
                depth: 2,
                unlit: true,
                alpha: 0.2 + Math.random() * 0.4,
                x: viewX + Math.random() * viewW,
                y: viewY + Math.random() * viewH,
                z: -37 + Math.random() * 5
            }));
        }

        // Neon accent rails beside the chassis
        const railH = boardH + 40;
        [
            this.boardX - 48,
            this.boardX + boardW + 30
        ].forEach((x) => {
            this.playBg.addChild(this.sm.createRect(3, railH, p.accent, {
                depth: 4, unlit: true, alpha: 0.4,
                x, y: this.boardY - 20, z: -36
            }));
            this.playBg.addChild(this.sm.createRect(12, railH, p.accent, {
                depth: 2, unlit: true, alpha: 0.08,
                x: x - 4, y: this.boardY - 20, z: -37
            }));
        });
    }

    lerpColor(a, b, t) {
        const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
        const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const bl = Math.round(ab + (bb - ab) * t);
        return (r << 16) | (g << 8) | bl;
    }

    rebuildMenu() {
        if (!this.sm || !this.menuRoot) return;
        this.menuRoot.removeChildren();
        const overlay = this.sm.createRect(this.width, this.height, 0x000014, {
            depth: 2,
            unlit: true,
            alpha: 0.55,
            z: 30,
            x: 0,
            y: 0
        });
        this.menuRoot.addChild(overlay);

        const isOver = this.gameState === 'gameOver';
        const title = this.sm.createText(isOver ? 'GAME OVER' : 'TETRA STACK', {
            fontSize: isOver ? 46 : 52,
            fill: isOver ? 0xff3344 : 0x00e8f0,
            z: 40,
            billboard: true
        });
        title.x = this.width / 2;
        title.y = this.height / 2 - 110;
        this.menuRoot.addChild(title);

        if (isOver) {
            const score = this.sm.createText(`Final Score: ${Utils.formatScore(this.score)}`, {
                fontSize: 22,
                fill: 0xffffff,
                z: 40,
                billboard: true
            });
            score.x = this.width / 2;
            score.y = this.height / 2 - 40;
            this.menuRoot.addChild(score);

            const stats = this.sm.createText(`Level: ${this.level}  |  Lines: ${this.lines}`, {
                fontSize: 18,
                fill: 0xccdde8,
                z: 40,
                billboard: true
            });
            stats.x = this.width / 2;
            stats.y = this.height / 2 - 10;
            this.menuRoot.addChild(stats);
        }

        const lines = isOver
            ? ['Press SPACE to Restart', 'Press R to Reset']
            : ['Press SPACE to Start', 'Arrow Keys: Move & Rotate', 'Space: Hard Drop | X: Rotate', 'P: Pause | R: Reset'];

        lines.forEach((text, i) => {
            const label = this.sm.createText(text, {
                fontSize: 16,
                fill: i === 0 ? 0xffffff : 0x9ab0c0,
                z: 40,
                billboard: true
            });
            label.x = this.width / 2;
            label.y = this.height / 2 + 40 + i * 28;
            this.menuRoot.addChild(label);
        });

        if (!isOver) {
            const demo = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
            const startX = this.width / 2 - (demo.length * 42) / 2;
            demo.forEach((type, i) => {
                const color = this.pieceColors[type];
                const block = this.makeBlock(18, 10, color, { emissiveIntensity: 0.5, z: 36 });
                block.x = startX + i * 42;
                block.y = this.height / 2 + 170;
                this.menuRoot.addChild(block);
            });
        }
    }

    rebuildPause() {
        if (!this.sm || !this.pauseRoot) return;
        this.pauseRoot.removeChildren();
        this.pauseRoot.addChild(this.sm.createRect(this.width, this.height, 0x000000, {
            depth: 2,
            unlit: true,
            alpha: 0.55,
            z: 50,
            x: 0,
            y: 0
        }));
        const paused = this.sm.createText('PAUSED', {
            fontSize: 48,
            fill: 0xffee44,
            z: 60,
            billboard: true
        });
        paused.x = this.width / 2;
        paused.y = this.height / 2;
        this.pauseRoot.addChild(paused);
        const resume = this.sm.createText('Press P to Resume', {
            fontSize: 18,
            fill: 0xffffff,
            z: 60,
            billboard: true
        });
        resume.x = this.width / 2;
        resume.y = this.height / 2 + 44;
        this.pauseRoot.addChild(resume);
    }

    placeShapeCells(cells, pieceType, rotation, originX, originY, options = {}) {
        const shape = this.getPieceShape(pieceType, rotation);
        cells.forEach((c) => { c.visible = false; });
        if (!shape) return;

        const color = this.pieceColors[pieceType] || 0xffffff;
        const inset = options.inset ?? 2;
        const size = options.size ?? (this.cellSize - inset);
        let i = 0;
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (!shape[row][col] || i >= cells.length) continue;
                const cell = cells[i++];
                const boardCol = originX + col;
                const boardRow = originY + row;
                if (options.boardSpace) {
                    if (boardRow < 0 || boardRow >= this.rows || boardCol < 0 || boardCol >= this.cols) {
                        cell.visible = false;
                        continue;
                    }
                    const pos = this.cellScreenPos(boardCol, boardRow);
                    cell.x = pos.x + inset / 2 + (options.pad ?? 0);
                    cell.y = pos.y + inset / 2 + (options.pad ?? 0);
                } else {
                    cell.x = originX + col * (size + 2);
                    cell.y = originY + row * (size + 2);
                }
                this.setBlockColor(cell, color, options.emissiveIntensity ?? 0.5);
                cell.alpha = options.alpha ?? 1;
                cell.scale = options.scale ?? 1;
                cell.visible = true;
            }
        }
    }

    syncBoardCells() {
        const clearing = new Set(this.linesClearing);
        const now = performance.now();
        const animating = clearing.size > 0 && this.lineClearAnimationTime > 0 &&
            (now - this.lineClearAnimationTime) < 400;
        const progress = animating ? (now - this.lineClearAnimationTime) / 400 : 1;

        for (let row = 0; row < this.rows; row++) {
            const isClearing = clearing.has(row);
            for (let col = 0; col < this.cols; col++) {
                const cell = this.cellViews[row][col];
                const type = this.board[row][col];
                if (!type) {
                    cell.visible = false;
                    continue;
                }
                if (isClearing && animating) {
                    this.setBlockColor(cell, this.pieceColors[type], 0.95);
                    cell.alpha = 1 - progress;
                    cell.scale = 1 + progress * 0.55;
                    cell.z = progress * 18;
                    cell.visible = true;
                } else if (isClearing) {
                    cell.visible = false;
                } else {
                    this.setBlockColor(cell, this.pieceColors[type], 0.55);
                    cell.alpha = 1;
                    cell.scale = 1;
                    cell.z = 0;
                    cell.visible = true;
                }
            }
        }
    }

    syncActiveAndGhost() {
        const playing = this.gameState === 'playing' && this.currentPiece;
        if (!playing) {
            this.activeCells.forEach((c) => { c.visible = false; });
            this.ghostCells.forEach((c) => { c.visible = false; });
            return;
        }

        const ghostY = this.getGhostY();
        if (this.showGhost && ghostY !== this.currentY) {
            this.placeShapeCells(this.ghostCells, this.currentPiece, this.currentRotation,
                this.currentX, ghostY, {
                    boardSpace: true,
                    inset: 4,
                    pad: 1,
                    alpha: 0.3,
                    emissiveIntensity: 0.12
                });
        } else {
            this.ghostCells.forEach((c) => { c.visible = false; });
        }

        this.placeShapeCells(this.activeCells, this.currentPiece, this.currentRotation,
            this.currentX, this.currentY, {
                boardSpace: true,
                emissiveIntensity: 0.72
            });
    }

    syncNextPiece() {
        if (!this.nextPiece || !this._nextPanel) {
            this.nextCells.forEach((c) => { c.visible = false; });
            return;
        }
        const shape = this.getPieceShape(this.nextPiece, 0);
        if (!shape) return;
        const size = this._nextPanel.size;
        const w = shape[0].length;
        const h = shape.length;
        const ox = this._nextPanel.x + (4 - w) * (size + 2) / 2;
        const oy = this._nextPanel.y + (4 - h) * (size + 2) / 2;
        this.placeShapeCells(this.nextCells, this.nextPiece, 0, ox, oy, {
            size,
            emissiveIntensity: 0.45
        });
    }

    syncBonus() {
        if (!this.bonusRoot) return;
        const data = this.lastLineClearData;
        const elapsed = this.lineClearDisplayTime ? performance.now() - this.lineClearDisplayTime : 9999;
        const show = data && elapsed < 800;
        this.bonusRoot.visible = !!show;
        if (!show) return;

        const key = `${data.name}:${data.score}:${Math.floor(elapsed / 50)}`;
        if (key === this._bonusKey) return;
        this._bonusKey = key;

        this.bonusRoot.removeChildren();
        const progress = elapsed / 800;
        let scale = 1;
        let alpha = 1;
        if (progress < 0.2) {
            const t = progress / 0.2;
            scale = typeof Easing !== 'undefined' ? Easing.easeOutBounce(t) : (0.6 + t * 0.4);
            alpha = t;
        } else if (progress > 0.6) {
            const t = (progress - 0.6) / 0.4;
            alpha = 1 - t;
            scale = 1 - t * 0.1;
        }

        const color = data.count === 4 ? 0xff00ff
            : data.count === 3 ? 0xffff00
                : data.count === 2 ? 0x00ff00
                    : 0x00ffff;
        const label = this.sm.createText(data.name.toUpperCase(), {
            fontSize: data.count === 4 ? 48 : 36,
            fill: color,
            z: 70,
            billboard: true
        });
        label.x = this.width / 2;
        label.y = this.boardY + 36;
        label.scale = scale;
        label.alpha = alpha;
        this.bonusRoot.addChild(label);

        if (data.bonus > 0) {
            const bonus = this.sm.createText(`+${Utils.formatScore(data.score)} BONUS!`, {
                fontSize: 22,
                fill: 0xffee55,
                z: 70,
                billboard: true
            });
            bonus.x = this.width / 2;
            bonus.y = this.boardY + 78;
            bonus.scale = scale;
            bonus.alpha = alpha;
            this.bonusRoot.addChild(bonus);
        }
    }

    frameCamera() {
        if (!this.graphics?.framePlayfield) return;
        const inMenu = this.gameState === 'menu' || this.gameState === 'gameOver';
        const key = `${this.gameState}:${this.level}`;
        if (key === this._frameKey) return;
        this._frameKey = key;

        if (inMenu) {
            this.graphics.framePlayfield(0, 0, this.width, this.height, 10, 0.15);
        } else {
            const boardW = this.cols * this.cellSize;
            const boardH = this.rows * this.cellSize;
            // Nearly face-on; leave a little room so stage accents stay visible
            this.graphics.framePlayfield(
                this.boardX - 135,
                this.boardY - 30,
                boardW + 170,
                boardH + 70,
                12,
                0.07
            );
        }
    }

    syncVisuals() {
        if (!this.graphics?.isInitialized || this.isDestroyed) return;

        const inMenu = this.gameState === 'menu' || this.gameState === 'gameOver';
        this.frameCamera();

        if (this.menuBg) this.menuBg.visible = inMenu;
        if (this.playBg) this.playBg.visible = !inMenu;
        if (this.wellRoot) this.wellRoot.visible = !inMenu;
        if (this.boardRoot) this.boardRoot.visible = !inMenu;
        if (this.nextRoot) this.nextRoot.visible = !inMenu && this.gameState !== 'gameOver';
        if (this.pauseRoot) this.pauseRoot.visible = this.gameState === 'paused';

        const menuKey = `${this.gameState}:${this.score}:${this.level}:${this.lines}`;
        if (this.menuRoot) {
            if (inMenu && menuKey !== this._menuKey) {
                this._menuKey = menuKey;
                this.rebuildMenu();
            }
            this.menuRoot.visible = inMenu;
        }

        if (!inMenu) {
            this.syncBoardCells();
            this.syncActiveAndGhost();
            this.syncNextPiece();
            this.syncBonus();
        } else if (this.bonusRoot) {
            this.bonusRoot.visible = false;
        }

        this.updateStatsPanel();
    }

    updateStatsPanel() {
        const statsPanel = document.getElementById('game-stats-panel');
        if (!statsPanel) return;
        const statsContent = statsPanel.querySelector('.stats-content');
        if (!statsContent) return;
        const key = `${this.score}:${this.level}:${this.lines}`;
        if (key === this._statsKey) return;
        this._statsKey = key;
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

    update(currentTime) {
        if (this.isPreview || this.isDestroyed) return;

        this.lastTime = currentTime;
        if (this.gameState !== 'playing') return;

        for (const key in this.keys) {
            if (!this.keys[key]) continue;
            const lastPress = this.lastKeyPress[key] || 0;
            const timeSincePress = currentTime - lastPress;
            if (timeSincePress > this.keyRepeatDelay) {
                const repeatCount = Math.floor((timeSincePress - this.keyRepeatDelay) / this.keyRepeatInterval);
                const shouldRepeat = repeatCount > (this.lastKeyRepeatCount[key] || 0);
                if (shouldRepeat) {
                    if (key === 'ArrowLeft') this.movePiece(-1, 0);
                    else if (key === 'ArrowRight') this.movePiece(1, 0);
                    else if (key === 'ArrowDown') this.softDrop();
                    this.lastKeyRepeatCount[key] = repeatCount;
                }
            }
        }

        if (this.currentPiece) {
            if (this.isLocking) {
                if (currentTime - this.lockTime >= this.lockDelay) {
                    this.lockPiece(currentTime);
                }
            } else {
                const elapsed = currentTime - this.lastDropTime;
                if (elapsed >= this.dropInterval) {
                    if (this.movePiece(0, 1)) {
                        this.lastDropTime = currentTime;
                        this.isLocking = false;
                        this.lockTime = 0;
                    } else {
                        this.isLocking = true;
                        this.lockTime = currentTime;
                    }
                }
            }
        }

        if (this.nesEffects && typeof this.nesEffects.update === 'function') {
            this.nesEffects.update();
        }

        // Gentle well-light pulse so the stage feels alive
        if (this._wellLight) {
            const pulse = 0.5 + 0.5 * Math.sin(currentTime * 0.0022);
            this._wellLight.intensity = 1.15 + pulse * 0.45;
        }
    }

    gameLoop = (currentTime) => {
        if (this.isDestroyed) return;
        const timestamp = currentTime || performance.now();
        this.update(timestamp);
        if (!this.isPreview) {
            this.syncVisuals();
        }
        if (this._useRafLoop) {
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        }
    };

    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = 1000;
        this._statsKey = '';
        this._menuKey = '';
        this._frameKey = '';
        this._bonusKey = '';
        this.flushPendingLineClear();

        const now = performance.now();
        this.lastTime = now;
        this.lastDropTime = now;

        this.initializeBoard();
        this.spawnPiece();
        this.nextPiece = this.getRandomPiece();
        this.updatePlayBackground(true);

        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tetris', 'start');
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
        if (this.isDestroyed) return;
        this.gameState = 'gameOver';
        this._menuKey = '';
        if (typeof audioManager !== 'undefined') audioManager.playSfx('gameOver');

        const activeCanvas = document.getElementById('game-canvas');
        if (activeCanvas && activeCanvas === this.canvas) {
            if (highScoreManager.checkHighScore('tetris', this.score)) {
                highScoreManager.requestNameEntry('tetris', this.score);
            }
        }
    }

    cleanup() {
        this.isDestroyed = true;
        this.flushPendingLineClear();

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.graphics?.getTicker?.() && this.tickerCallback) {
            this.graphics.getTicker().remove(this.tickerCallback);
        }
        if (this._wellLight && this.graphics?.scene) {
            this.graphics.scene.remove(this._wellLight);
            this._wellLight = null;
        }
        if (this._kickLight && this.graphics?.scene) {
            this.graphics.scene.remove(this._kickLight);
            this._kickLight = null;
        }
        this.graphics?.stop?.();
        this.graphics?.destroy?.();

        if (this.keydownHandler) document.removeEventListener('keydown', this.keydownHandler);
        if (this.keyupHandler) document.removeEventListener('keyup', this.keyupHandler);
        if (this.touchControls) {
            this.touchControls.destroy();
            this.touchControls = null;
        }
    }

    drawPreview() {
        const ctx = this.ctx;
        if (!ctx) return;
        const previewPieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        const previewX = this.width / 2;
        const previewY = this.height / 2;

        ctx.fillStyle = '#000011';
        ctx.fillRect(0, 0, this.width, this.height);

        previewPieces.forEach((piece, index) => {
            const shape = this.getPieceShape(piece, 0);
            const color = this.pieceColorsCss[piece];
            const x = previewX - 35 + (index % 4) * 18;
            const y = previewY - 30 + Math.floor(index / 4) * 20;
            if (!shape) return;
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (!shape[row][col]) continue;
                    ctx.fillStyle = color;
                    ctx.fillRect(x + col * 6, y + row * 6, 5, 5);
                }
            }
        });

        ctx.fillStyle = '#00e8f0';
        ctx.font = 'bold 18px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('TETRA STACK', previewX, previewY + 50);
    }
}

function initTetris() {
    const canvas = document.getElementById('tetris-preview');
    if (canvas) {
        new TetrisGame(canvas);
    }
}
