/**
 * Circuit Breaker — close a load-center circuit before the throw timer hits zero.
 */
const CB_TILE_MASKS = {
    straight: 0b0101,
    corner: 0b0011,
    source: 0b0010,
    sink: 0b0010
};
const CB_DIR = { N: 1, E: 2, S: 4, W: 8 };

class CircuitBreakerGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = 800;
        this.height = 600;
        this.isPreview = canvas.width < 400;
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
                backgroundColor: 0x121418,
                pixelPerfect: true,
                cameraMode: 'playfield2d'
            });
        }

        this.gameState = 'menu';
        this.score = 0;
        this.lives = 2;
        this.levelIndex = 0;
        this.loopCount = 0;
        this.movesUsed = 0;
        this.parMoves = 0;
        this.levelTime = 22;
        this.timeLeft = 22;
        this.energyLock = false;
        this.circuitLive = false;
        this.circuitClosed = false;
        this.levelClearFlash = 0;
        this.fuseFlash = 0;
        this.pulsePhase = 0;
        this._lastTickSec = null;
        this._advanceTimer = null;

        this.gridCols = 6;
        this.gridRows = 6;
        this.grid = [];
        this.selCol = 0;
        this.selRow = 0;
        this.powered = new Set();

        this.boardX = 0;
        this.boardY = 0;
        this.tileSize = 48;

        this.keys = {};
        this.lastTime = 0;
        this.tickerCallback = null;
        this.rafId = null;

        this.sm = null;
        this.boardRoot = null;
        this.cellViews = [];
        this.menuRoot = null;
        this.menuPropRoot = null;
        this.menuPropPivot = null;
        this.powerBoxScene = null;
        this.hintRoot = null;
        this.pauseRoot = null;
        this.timerLabel = null;
        this.timerColor = 0x44ff66;
        this.clearFlashMesh = null;
        this.fuseFlashMesh = null;
        this._hintKey = '';
        this._menuState = '';
        this._frameKey = '';
        this._timerKey = '';

        this.setupInput();
        if (this.isPreview) {
            this.gameLoop();
        } else {
            this.initGraphics();
        }
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
            console.error('Circuit Breaker init failed:', err);
            this.startFallbackLoop();
            this.markReady();
        }
    }

    async finishGraphicsInit() {
        try {
            this.nesEffects = this.graphics.getScreenEffects();
            this.sm = this.graphics.sprites;
            // Soften CRT — scanlines + curvature were mushing canvas text.
            if (this.nesEffects) {
                this.nesEffects.crtScanlineIntensity = 0.035;
                this.nesEffects.crtVignetteIntensity = 0.06;
                this.nesEffects.crtCurvature = 0.008;
                this.nesEffects.crtPass?.uniforms?.scanlineIntensity &&
                    (this.nesEffects.crtPass.uniforms.scanlineIntensity.value = 0.035);
                this.nesEffects.crtPass?.uniforms?.vignetteIntensity &&
                    (this.nesEffects.crtPass.uniforms.vignetteIntensity.value = 0.06);
                this.nesEffects.crtPass?.uniforms?.curvature &&
                    (this.nesEffects.crtPass.uniforms.curvature.value = 0.008);
            }
            if (this.graphics.renderer) {
                this.graphics.renderer.toneMappingExposure = 1.25;
            }
            await this.loadSharedMaterials();
            this.buildStaticScene();
            this.startGameLoop();
            this.graphics.start?.();
            this.syncVisuals();
        } catch (err) {
            console.error('Circuit Breaker finishGraphicsInit failed:', err);
            this.startFallbackLoop();
        } finally {
            this.markReady();
        }
    }

    async loadSharedMaterials() {
        this.panelMaps = null;
        this.bayMaps = null;
        this.pcbMaps = null;
        this.pcbPhoto = null;
        this.powerBoxScene = null;
        this.circuitBoardScene = null;
        this.cableKit = null;
        if (!this.sm) return;
        try {
            this.pcbPhoto = await this.sm.loadTexture(
                'assets/games/circuit-breaker/pcb-photo.jpg',
                { pixelPerfect: false }
            );
            if (typeof loadPolyhavenTextureSet === 'function') {
                this.panelMaps = await loadPolyhavenTextureSet(this.sm, 'metalPlate', { repeat: 2.2 });
                this.bayMaps = await loadPolyhavenTextureSet(this.sm, 'blueMetalPlate', { repeat: 1.4 });
                this.pcbMaps = await loadPolyhavenTextureSet(this.sm, 'circuitBoard', { repeat: 1.25 });
            }
            if (typeof loadPolyhavenModel === 'function') {
                const [power, board, cables] = await Promise.all([
                    loadPolyhavenModel('powerBox01'),
                    loadPolyhavenModel('circuitBoard'),
                    loadPolyhavenModel('modularElectricCables')
                ]);
                this.powerBoxScene = power?.scene || null;
                this.circuitBoardScene = board?.scene || null;
                this.cableKit = cables || null;
            }
        } catch (err) {
            console.warn('Circuit Breaker: Poly Haven assets unavailable', err);
        }
    }

    /** Photo PCB plate (falls back to solid FR-4 green). */
    makePcbPhotoPlate(w, h, x, y, z, { repeatX = 1, repeatY = 1, dim = 1 } = {}) {
        if (!this.pcbPhoto || !window.THREE) {
            return this.sm.createRect(w, h, 0x2a8a38, {
                depth: 2, x, y, z, unlit: true
            });
        }
        const THREE = window.THREE;
        const tex = this.pcbPhoto.clone();
        tex.needsUpdate = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        const plate = this.sm.createSprite(tex, {
            width: w, height: h, x, y, z
        });
        if (plate.object?.material) {
            plate.object.material.depthWrite = true;
            plate.object.material.color.setRGB(dim, dim, dim);
            if (plate.object.material.map) {
                plate.object.material.map.magFilter = THREE.LinearFilter;
                plate.object.material.map.minFilter = THREE.LinearMipmapLinearFilter;
                plate.object.material.map.generateMipmaps = true;
            }
        }
        return plate;
    }

    pbrOpts(maps, extras = {}) {
        if (!maps?.map) return extras;
        return {
            pbr: true,
            map: maps.map,
            normalMap: maps.normalMap || undefined,
            roughnessMap: maps.roughnessMap || undefined,
            metalnessMap: maps.metalnessMap || undefined,
            metalness: maps.metalnessMap ? 1 : 0.7,
            roughness: maps.roughnessMap ? 1 : 0.45,
            ...extras
        };
    }

    /** Real Poly Haven circuit-board albedo, with procedural FR-4 fallback. */
    ensureFr4Texture() {
        if (this.pcbMaps?.map) return this.pcbMaps.map;
        if (this.fr4Map || !window.THREE) return this.fr4Map;
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2f7a3a';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1800; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const a = 0.04 + Math.random() * 0.08;
            ctx.fillStyle = Math.random() > 0.5
                ? `rgba(20,70,30,${a})`
                : `rgba(90,170,100,${a})`;
            ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 3);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        this.fr4Map = tex;
        return tex;
    }

    pcbMaterialOpts(extras = {}) {
        if (this.pcbMaps?.map) {
            return this.pbrOpts(this.pcbMaps, {
                metalness: 0.12,
                roughness: 0.7,
                ...extras
            });
        }
        return {
            pbr: true,
            metalness: 0.05,
            roughness: 0.75,
            map: this.ensureFr4Texture() || undefined,
            ...extras
        };
    }

    prepareModelClone(root) {
        const T = window.THREE;
        const clone = root.clone(true);
        clone.traverse((node) => {
            if (!node.isMesh) return;
            node.castShadow = false;
            node.receiveShadow = false;
            node.frustumCulled = false;
            if (!node.material) return;
            const src = Array.isArray(node.material) ? node.material : [node.material];
            const cloned = src.map((m) => {
                const mat = m.clone();
                mat.side = T.FrontSide;
                mat.depthWrite = true;
                mat.needsUpdate = true;
                return mat;
            });
            node.material = cloned.length === 1 ? cloned[0] : cloned;
        });
        return clone;
    }

    fitModelFlat(clone, targetW, targetH) {
        const T = window.THREE;
        const box = new T.Box3().setFromObject(clone);
        const size = box.getSize(new T.Vector3());
        const center = box.getCenter(new T.Vector3());
        clone.position.sub(center);
        // Prefer the two largest axes as the board face.
        const dims = [
            { axis: 'x', v: size.x },
            { axis: 'y', v: size.y },
            { axis: 'z', v: size.z }
        ].sort((a, b) => b.v - a.v);
        // If thickness is Y (common), rotate so the face lies in XY toward +Z.
        if (dims[2].axis === 'y' || size.y < size.x * 0.35) {
            clone.rotation.x = -Math.PI / 2;
        }
        const box2 = new T.Box3().setFromObject(clone);
        const size2 = box2.getSize(new T.Vector3());
        const center2 = box2.getCenter(new T.Vector3());
        clone.position.x -= center2.x;
        clone.position.y -= center2.y;
        clone.position.z -= center2.z;
        const sx = size2.x > 0.001 ? targetW / size2.x : 1;
        const sy = size2.y > 0.001 ? targetH / size2.y : 1;
        const scale = Math.min(sx, sy);
        clone.scale.setScalar(scale);
        return scale;
    }

    cloneCablePiece(name) {
        if (!this.cableKit || typeof findPolyhavenNode !== 'function') return null;
        const node = findPolyhavenNode(this.cableKit, name);
        if (!node) return null;
        return this.prepareModelClone(node);
    }

    startFallbackLoop() {
        if (this.rafId) return;
        const tick = (now) => {
            if (this.lastTime === 0) this.lastTime = now;
            const deltaMs = Math.min(now - this.lastTime, 50);
            this.lastTime = now;
            this.gameLoop(deltaMs);
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    startGameLoop() {
        const ticker = this.graphics?.getTicker();
        if (ticker) {
            this.tickerCallback = (tickerObj) => {
                const deltaMs = Math.min(Math.max((tickerObj.deltaTime ?? 1) * 16.67, 1), 50);
                this.gameLoop(deltaMs);
            };
            ticker.add(this.tickerCallback);
        } else {
            this.startFallbackLoop();
        }
    }

    gameLoop(deltaMs = 16.67) {
        if (this.isPreview) {
            const now = performance.now();
            if (this.lastTime === 0) this.lastTime = now;
            deltaMs = Math.min(now - this.lastTime, 50);
            this.lastTime = now;
            this.drawPreviewFrame();
            requestAnimationFrame(() => this.gameLoop());
            return;
        }
        if (Number.isFinite(deltaMs) && deltaMs > 0) {
            this.pulsePhase += deltaMs * 0.005;
            if (this.levelClearFlash > 0) this.levelClearFlash -= deltaMs;
            if (this.fuseFlash > 0) this.fuseFlash -= deltaMs;
            this.tickThrowTimer(deltaMs);
            this.tickMenuProp(deltaMs);
        }
        this.syncVisuals();
    }

    tickMenuProp(deltaMs) {
        if (!this.menuPropPivot) return;
        const inMenu = this.gameState === 'menu' || this.gameState === 'gameOver';
        if (!inMenu) return;
        // Tiny idle sway — keep the cabinet fully in frame.
        this.menuPropPivot.rotation.y = -0.35 + Math.sin(this.pulsePhase * 0.35) * 0.12;
        this.menuPropPivot.rotation.x = 0.06 + Math.sin(this.pulsePhase * 0.18) * 0.02;
    }

    tickThrowTimer(deltaMs) {
        if (this.gameState !== 'playing' || this.energyLock) return;
        this.timeLeft = Math.max(0, this.timeLeft - deltaMs / 1000);
        const sec = Math.ceil(this.timeLeft);
        if (sec <= 5 && sec >= 0 && sec !== this._lastTickSec) {
            this._lastTickSec = sec;
            if (typeof audioManager !== 'undefined') {
                audioManager.playGameSfx('circuit-breaker', 'tick');
            }
        }
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.energize();
        }
    }

    getTileMask(tile) {
        if (!tile) return 0;
        const base = (typeof CB_GEN_MASKS !== 'undefined' ? CB_GEN_MASKS[tile.type] : CB_TILE_MASKS[tile.type]) ?? 0;
        if (typeof cbRotMask === 'function') return cbRotMask(base, tile.rotation ?? 0);
        return CircuitBreakerGame.rotateMask(base, tile.rotation ?? 0);
    }

    static rotateMask(mask, rot) {
        let m = mask;
        for (let i = 0; i < ((rot % 4) + 4) % 4; i++) {
            let next = 0;
            if (m & 1) next |= 2;
            if (m & 2) next |= 4;
            if (m & 4) next |= 8;
            if (m & 8) next |= 1;
            m = next;
        }
        return m;
    }

    levelSeed(index) {
        return (index + 1) * 9973 + this.loopCount * 104729;
    }

    loadLevel(index) {
        const levels = CIRCUIT_BREAKER_LEVELS;
        const idx = index % levels.length;
        const spec = levels[idx];
        const data = typeof generateCircuitLevel === 'function'
            ? generateCircuitLevel(spec, this.levelSeed(idx))
            : spec;

        this.gridCols = data.cols;
        this.gridRows = data.rows;
        this.parMoves = data.parMoves ?? 0;
        this.movesUsed = 0;
        this.levelTime = Math.max(12, Math.round(spec.time * Math.pow(0.85, this.loopCount)));
        this.timeLeft = this.levelTime;
        this.energyLock = false;
        this.circuitLive = false;
        this.circuitClosed = false;
        this.levelClearFlash = 0;
        this.fuseFlash = 0;
        this._lastTickSec = null;
        this._timerKey = '';

        this.grid = Array.from({ length: this.gridRows }, () =>
            Array.from({ length: this.gridCols }, () => null)
        );

        for (const cell of data.cells) {
            this.grid[cell.row][cell.col] = {
                type: cell.type,
                rotation: cell.rotation ?? 0,
                fixed: !!cell.fixed || cell.type === 'source' || cell.type === 'sink',
                solutionRotation: cell.solutionRotation ?? cell.rotation ?? 0
            };
        }

        const maxBoardW = this.width - 72;
        const maxBoardH = this.height - 110;
        this.tileSize = Math.floor(Math.min(maxBoardW / this.gridCols, maxBoardH / this.gridRows));
        this.tileSize = Math.max(28, Math.min(this.tileSize, 68));
        this.boardX = Math.floor((this.width - this.gridCols * this.tileSize) / 2);
        this.boardY = Math.floor((this.height - this.gridRows * this.tileSize) / 2) + 16;

        this.selCol = 0;
        this.selRow = 0;
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                if (this.grid[r][c]?.type === 'source') {
                    this.selCol = c;
                    this.selRow = r;
                }
            }
        }

        this.powered = new Set();
        this._hintKey = '';
        this.rebuildBoard();
        this._frameKey = '';
        this.frameCamera();
    }

    evaluateBoard() {
        if (typeof evaluateClosedCircuit === 'function') {
            const result = evaluateClosedCircuit(this.grid, this.gridCols, this.gridRows);
            this.powered = result.powered;
            this.circuitClosed = !!result.ok;
            return result;
        }
        this.powered = new Set();
        this.circuitClosed = false;
        return { ok: false, powered: this.powered };
    }

    rotateTile(col, row, dir) {
        if (this.energyLock || this.gameState !== 'playing') return;
        const tile = this.grid[row]?.[col];
        if (!tile || tile.fixed || tile.type === 'source' || tile.type === 'sink') return;
        tile.rotation = (tile.rotation + (dir > 0 ? 1 : 3)) % 4;
        this.movesUsed++;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('circuit-breaker', 'rotate');
        this.updateCellView(this.cellViews[row]?.[col]);
    }

    energize() {
        if (this.gameState !== 'playing' || this.energyLock) return;
        this.energyLock = true;
        this.circuitLive = true;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('circuit-breaker', 'energize');

        const result = this.evaluateBoard();
        this.syncPowerVisuals();

        if (result.ok) {
            const timeBonus = Math.max(0, Math.floor(this.timeLeft * 40));
            const levelBase = 500 + this.levelIndex * 100 + this.loopCount * 250;
            const parBonus = Math.max(0, this.parMoves - this.movesUsed) * 30;
            this.score += levelBase + parBonus + timeBonus;
            this.levelClearFlash = 800;
            if (typeof audioManager !== 'undefined') {
                audioManager.playGameSfx('circuit-breaker', 'powerOn');
                audioManager.playGameSfx('circuit-breaker', 'levelClear');
            }
            this.nesEffects?.flash?.('#88ffaa', 180);

            const nextLevel = this.levelIndex + 1;
            this._advanceTimer = setTimeout(() => {
                if (this.gameState !== 'playing') return;
                if (nextLevel >= CIRCUIT_BREAKER_LEVELS.length) {
                    this.loopCount++;
                    this.levelIndex = 0;
                } else {
                    this.levelIndex = nextLevel;
                }
                this.loadLevel(this.levelIndex);
            }, 750);
        } else {
            this.lives--;
            this.fuseFlash = 500;
            if (typeof audioManager !== 'undefined') audioManager.playGameSfx('circuit-breaker', 'fuseBlow');
            this.nesEffects?.flash?.('#FF2244', 220);
            this.nesEffects?.shake?.(6, 200);
            this._advanceTimer = setTimeout(() => {
                if (this.gameState !== 'playing') return;
                if (this.lives <= 0) {
                    this.gameOver();
                    return;
                }
                this.energyLock = false;
                this.circuitLive = false;
                this.circuitClosed = false;
                this.powered = new Set();
                this.timeLeft = this.levelTime;
                this._lastTickSec = null;
                this.syncPowerVisuals();
            }, 650);
        }
    }

    setupInput() {
        this.keydownHandler = (e) => {
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal?.classList.contains('active')) return;
            if (document.getElementById('game-canvas') !== this.canvas) return;

            this.keys[e.code] = true;

            if (this.gameState === 'menu' || this.gameState === 'gameOver') {
                if (e.code === 'Space' || e.code === 'Enter') {
                    e.preventDefault();
                    this.startGame();
                }
                return;
            }

            if (this.gameState === 'paused') {
                if (e.code === 'KeyP') this.gameState = 'playing';
                return;
            }

            if (e.code === 'KeyP') {
                this.gameState = 'paused';
                return;
            }
            if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                this.energize();
                return;
            }
            if (e.code === 'KeyR') {
                this.rotateTile(this.selCol, this.selRow, -1);
                return;
            }
            if (e.code === 'KeyX' || e.code === 'KeyZ') {
                this.rotateTile(this.selCol, this.selRow, 1);
                return;
            }
            if (e.code === 'ArrowLeft') {
                e.preventDefault();
                this.moveSelection(-1, 0);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                this.moveSelection(1, 0);
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                this.moveSelection(0, -1);
            } else if (e.code === 'ArrowDown') {
                e.preventDefault();
                this.moveSelection(0, 1);
            }
        };

        this.keyupHandler = (e) => { this.keys[e.code] = false; };

        this.clickHandler = (e) => {
            if (this.gameState !== 'playing' || this.energyLock) return;
            if (document.getElementById('game-canvas') !== this.canvas) return;
            let mx;
            let my;
            const mapped = this.graphics?.screenToPlayfield?.(e.clientX, e.clientY);
            if (mapped) {
                mx = mapped.x;
                my = mapped.y;
            } else {
                const rect = this.canvas.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                mx = (e.clientX - rect.left) * (this.width / rect.width);
                my = (e.clientY - rect.top) * (this.height / rect.height);
            }
            const col = Math.floor((mx - this.boardX) / this.tileSize);
            const row = Math.floor((my - this.boardY) / this.tileSize);
            if (col < 0 || row < 0 || col >= this.gridCols || row >= this.gridRows) return;
            if (!this.grid[row][col]) return;

            this.selCol = col;
            this.selRow = row;
            this.rotateTile(col, row, 1);
        };

        this.pointerHandler = (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            this.clickHandler(e);
        };

        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        this.canvas.addEventListener('pointerdown', this.pointerHandler);
        this.canvas.style.touchAction = 'none';
    }

    moveSelection(dc, dr) {
        const nc = Utils.clamp(this.selCol + dc, 0, this.gridCols - 1);
        const nr = Utils.clamp(this.selRow + dr, 0, this.gridRows - 1);
        if (this.grid[nr][nc]) {
            this.selCol = nc;
            this.selRow = nr;
        }
    }

    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 2;
        this.levelIndex = 0;
        this.loopCount = 0;
        this.loadLevel(0);
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('circuit-breaker', 'start');
    }

    gameOver() {
        this.gameState = 'gameOver';
        this.energyLock = false;
        if (typeof audioManager !== 'undefined') audioManager.playSfx('gameOver');
        if (highScoreManager.checkHighScore('circuit-breaker', this.score)) {
            highScoreManager.requestNameEntry('circuit-breaker', this.score);
        }
        this._menuState = '';
    }

    buildStaticScene() {
        const sm = this.sm;
        const bg = this.graphics.getLayer('background');
        const mid = this.graphics.getLayer('midground');
        const ui = this.graphics.getLayer('ui');

        // Menu room stays industrial; play uses the real PCB photo.
        this.menuBg = sm.createRect(this.width, this.height, 0x3a424c, {
            depth: 2, x: 0, y: 0, z: -10,
            ...this.pbrOpts(this.panelMaps, { metalness: 0.5, roughness: 0.65 })
        });
        bg.addChild(this.menuBg);
        this.playBg = this.makePcbPhotoPlate(
            this.width * 2.6,
            this.height * 2.6,
            -this.width * 0.8,
            -this.height * 0.8,
            -10,
            { repeatX: 2.4, repeatY: 2.4, dim: 0.72 }
        );
        this.playBg.visible = false;
        bg.addChild(this.playBg);

        this.menuPropRoot = sm.createGroup();
        mid.addChild(this.menuPropRoot);
        this.mountMenuCircuitHero();

        this.hintRoot = sm.createGroup();
        ui.addChild(this.hintRoot);

        this.clearFlashMesh = sm.createRect(this.width, this.height, 0x88ffaa, {
            depth: 2, x: 0, y: 0, z: 8, unlit: true, alpha: 0
        });
        this.clearFlashMesh.visible = false;
        ui.addChild(this.clearFlashMesh);

        this.fuseFlashMesh = sm.createRect(this.width, this.height, 0xff2244, {
            depth: 2, x: 0, y: 0, z: 9, unlit: true, alpha: 0
        });
        this.fuseFlashMesh.visible = false;
        ui.addChild(this.fuseFlashMesh);

        this.pauseRoot = sm.createGroup();
        this.pauseRoot.addChild(sm.createRect(this.width, this.height, 0x000000, {
            depth: 2, x: 0, y: 0, z: 10, unlit: true, alpha: 0.55
        }));
        const paused = sm.createText('PAUSED', {
            fontSize: 32, fill: 0xffff00, z: 12, billboard: false, depthTest: false
        });
        paused.x = this.width / 2;
        paused.y = this.height / 2 - 10;
        this.pauseRoot.addChild(paused);
        this.pauseRoot.visible = false;
        ui.addChild(this.pauseRoot);

        this.menuRoot = sm.createGroup();
        ui.addChild(this.menuRoot);
        this.rebuildMenu();
    }

    mountMenuCircuitHero() {
        if (!this.menuPropRoot || !window.THREE) return;
        const T = window.THREE;
        this.menuPropRoot.removeChildren();
        this.menuPropPivot = new T.Group();

        const source = this.circuitBoardScene || this.powerBoxScene;
        if (source) {
            const board = this.prepareModelClone(source);
            const box = new T.Box3().setFromObject(board);
            const size = box.getSize(new T.Vector3());
            const center = box.getCenter(new T.Vector3());
            board.position.sub(center);
            const target = 300;
            const longest = Math.max(size.x, size.y, size.z) || 1;
            board.scale.setScalar(target / longest);
            board.rotation.x = 0.55;
            board.rotation.y = -0.55;
            board.rotation.z = 0.08;
            this.menuPropPivot.add(board);
        }

        // Cable kit accents from Poly Haven modular wiring
        const cableNames = ['cable_turn_short', 'cable_scurve_1', 'cable_end', 'cable_straight_short'];
        cableNames.forEach((name, i) => {
            const piece = this.cloneCablePiece(name);
            if (!piece) return;
            const box = new T.Box3().setFromObject(piece);
            const size = box.getSize(new T.Vector3());
            const center = box.getCenter(new T.Vector3());
            piece.position.sub(center);
            const s = 55 / Math.max(size.x, size.y, size.z, 0.001);
            piece.scale.setScalar(s);
            piece.position.set(-90 + i * 42, 110, 20 + i * 4);
            piece.rotation.y = -0.4 + i * 0.35;
            piece.rotation.x = 0.4;
            this.menuPropPivot.add(piece);
        });

        const shadow = this.sm.createCircle(95, 0x000000, {
            depth: 1, x: -95, y: 120, z: -36, unlit: true, alpha: 0.25, depthWrite: false
        });
        shadow.object.scale.set(1.45, 0.4, 1);
        this.menuPropRoot.addChild(shadow);

        this.menuPropRoot.object.add(this.menuPropPivot);
        this.menuPropRoot.x = this.width * 0.68;
        this.menuPropRoot.y = this.height * 0.52;
        this.menuPropRoot.z = 8;
        this.menuPropRoot.visible = true;
    }

    rebuildMenu() {
        if (!this.sm || !this.menuRoot) return;
        this.menuRoot.removeChildren();

        // Light veil only — keep depthWrite off so the prop never cuts out.
        this.menuRoot.addChild(this.sm.createRect(this.width, this.height, 0x000000, {
            depth: 2, x: 0, y: 0, z: 4, unlit: true, alpha: 0.12, depthWrite: false
        }));

        const cardW = 430;
        const cardH = 360;
        const cardX = 36;
        const cardY = this.height / 2 - cardH / 2;
        this.menuRoot.addChild(this.sm.createRect(cardW, cardH, 0xc8d0d8, {
            depth: 4, x: cardX, y: cardY, z: 5,
            ...this.pbrOpts(this.panelMaps, { metalness: 0.55, roughness: 0.5 }),
            depthWrite: false
        }));
        this.menuRoot.addChild(this.sm.createRect(cardW - 12, cardH - 12, 0x12161c, {
            depth: 2, x: cardX + 6, y: cardY + 6, z: 6, unlit: true, alpha: 0.88, depthWrite: false
        }));

        const lines = [];
        if (this.gameState === 'gameOver') {
            lines.push(['GAME OVER', 0xff4444, 28, -132]);
        }
        lines.push(
            ['CIRCUIT BREAKER', 0xe8a317, 30, -100],
            ['Route copper traces START → END', 0xdde3ea, 14, -66],
            ['before the throw timer hits zero.', 0xa8b0b8, 13, -46]
        );
        const best = highScoreManager.getTopScore('circuit-breaker');
        lines.push(
            [`BEST: ${Utils.formatScore(best)}`, 0xffaa44, 16, -16],
            ['Click breakers to rotate', 0xffffff, 13, 14],
            ['Arrows · X/Z rotate · R CCW', 0xffffff, 13, 34],
            ['Enter throws early', 0xffffff, 13, 54],
            ['Unused tiles are OK — no leaks on the live run', 0xffcc88, 12, 78],
            ['PRESS SPACE TO START', 0xffff00, 18, 118]
        );

        const textX = cardX + cardW / 2;
        for (const [text, color, size, yOff] of lines) {
            const label = this.sm.createText(text, {
                fontSize: size, fill: color, z: 16, billboard: false, depthTest: false
            });
            label.x = textX;
            label.y = this.height / 2 + yOff;
            this.menuRoot.addChild(label);
        }
        this._menuState = this.gameState;
    }

    rebuildBoard() {
        if (!this.sm || !this.graphics?.isInitialized) return;

        const fg = this.graphics.getLayer('foreground');
        if (this.boardRoot) {
            fg.removeChild(this.boardRoot);
            this.boardRoot.destroy();
        }
        this.boardRoot = this.sm.createGroup();
        fg.addChild(this.boardRoot);

        const ts = this.tileSize;
        const boardW = this.gridCols * ts;
        const boardH = this.gridRows * ts;
        const pad = 2;
        const ox = this.boardX;
        const oy = this.boardY;

        // Photo stays around the board; play grid itself is solid FR-4 green
        this.boardRoot.addChild(this.makePcbPhotoPlate(
            boardW + 220, boardH + 200, ox - 110, oy - 90, -4,
            { repeatX: 1.15, repeatY: 1.15, dim: 0.8 }
        ));
        this.boardRoot.addChild(this.sm.createRect(boardW + 28, boardH + 52, 0x2a8f3a, {
            depth: 3, x: ox - 14, y: oy - 38, z: 0, unlit: true
        }));
        this.boardRoot.addChild(this.sm.createRect(boardW + 8, boardH + 8, 0x248234, {
            depth: 2, x: ox - 4, y: oy - 4, z: 1, unlit: true
        }));

        // Header / timer strip
        this.boardRoot.addChild(this.sm.createRect(boardW + 8, 28, 0x145222, {
            depth: 2, x: ox - 4, y: oy - 34, z: 2, unlit: true
        }));
        this.boardRoot.addChild(this.sm.createRect(Math.min(boardW * 0.5, 200), 20, 0x041a0a, {
            depth: 2, x: ox + boardW / 2 - Math.min(boardW * 0.5, 200) / 2, y: oy - 30, z: 3,
            unlit: true
        }));

        const rating = this.sm.createText('FR-4  ·  COPPER TRACE', {
            fontSize: 11, fill: 0xd8f5d0, z: 12, billboard: false, depthTest: false
        });
        rating.x = ox + boardW / 2;
        rating.y = oy + boardH + 16;
        this.boardRoot.addChild(rating);

        this.timerLabel = this.sm.createText(this.formatTime(this.timeLeft), {
            fontSize: 20, fill: 0x66ff99, z: 20, billboard: false, depthTest: false
        });
        this.timerLabel.x = ox + boardW / 2;
        this.timerLabel.y = oy - 20;
        this.boardRoot.addChild(this.timerLabel);
        this.timerColor = 0x66ff99;
        this._timerKey = '';

        this.cellViews = [];
        for (let r = 0; r < this.gridRows; r++) {
            this.cellViews[r] = [];
            for (let c = 0; c < this.gridCols; c++) {
                const gx = ox + c * ts;
                const gy = oy + r * ts;

                this.boardRoot.addChild(this.sm.createRect(ts - 2, ts - 2, 0x2c933c, {
                    depth: 2, x: gx + 1, y: gy + 1, z: 2, unlit: true
                }));
                this.boardRoot.addChild(this.sm.createRect(ts - 6, 1, 0xb6e8bc, {
                    depth: 1, x: gx + 3, y: gy + 3, z: 2.5, unlit: true, alpha: 0.35, depthWrite: false
                }));
                this.boardRoot.addChild(this.sm.createRect(ts - 6, 1, 0xb6e8bc, {
                    depth: 1, x: gx + 3, y: gy + ts - 4, z: 2.5, unlit: true, alpha: 0.3, depthWrite: false
                }));

                const tile = this.grid[r][c];
                if (!tile) {
                    this.cellViews[r][c] = null;
                    continue;
                }

                const x = gx + pad;
                const y = gy + pad;
                const w = ts - pad * 2;
                const h = ts - pad * 2;
                const view = {
                    col: c, row: r, x, y, w, h, tile, mask: -1,
                    traces: [], hardware: [], glow: null, selection: null, rim: null, badge: null, terminal: null
                };
                this.buildCellBody(view);
                this.cellViews[r][c] = view;
                try {
                    this.updateCellView(view);
                } catch (err) {
                    console.error('Circuit Breaker cell update failed', c, r, err);
                }
            }
        }
    }

    terminalTheme(type) {
        if (type === 'source') {
            return {
                pad: 0x4a1014,
                face: 0x1a1a1a,
                rim: 0xff3355,
                metal: 0xff6a6a,
                emissive: 0xff2244,
                badge: 0x2a080c,
                label: 0xffe0e6,
                glow: 0xff4466
            };
        }
        if (type === 'sink') {
            return {
                pad: 0x0f2a18,
                face: 0x1a1a1a,
                rim: 0x44ff88,
                metal: 0x66ff99,
                emissive: 0x22cc55,
                badge: 0x082014,
                label: 0xe0ffe8,
                glow: 0x44ff88
            };
        }
        return null;
    }

    buildCellBody(view) {
        const { x, y, w, h, tile } = view;
        const sm = this.sm;
        const theme = this.terminalTheme(tile.type);
        const isTerminal = !!theme;

        view.glow = sm.createRect(w + 2, h + 2, theme?.glow || 0xffcc44, {
            depth: 2, x: x - 1, y: y - 1, z: 3.2, alpha: isTerminal ? 0.22 : 0.0, unlit: true
        });
        this.boardRoot.addChild(view.glow);

        // High-contrast cursor: dark wash + thick cyan frame above copper
        view.selection = sm.createGroup();
        view.selection.visible = false;
        const frameZ = 18;
        const thick = Math.max(3, Math.round(this.tileSize * 0.07));
        view.selection.addChild(sm.createRect(w + 2, h + 2, 0x041208, {
            depth: 1, x: x - 1, y: y - 1, z: frameZ - 1, unlit: true, alpha: 0.45, depthWrite: false
        }));
        const edge = 0x7dffd2;
        view.selection.addChild(sm.createRect(w + 4, thick, edge, {
            depth: 1.2, x: x - 2, y: y - 2, z: frameZ, unlit: true
        }));
        view.selection.addChild(sm.createRect(w + 4, thick, edge, {
            depth: 1.2, x: x - 2, y: y + h - thick + 2, z: frameZ, unlit: true
        }));
        view.selection.addChild(sm.createRect(thick, h + 4 - thick * 2, edge, {
            depth: 1.2, x: x - 2, y: y - 2 + thick, z: frameZ, unlit: true
        }));
        view.selection.addChild(sm.createRect(thick, h + 4 - thick * 2, edge, {
            depth: 1.2, x: x + w - thick + 2, y: y - 2 + thick, z: frameZ, unlit: true
        }));
        // Corner ticks for extra pop
        const tick = thick + 2;
        for (const [tx, ty] of [
            [x - 2, y - 2],
            [x + w - tick + 2, y - 2],
            [x - 2, y + h - tick + 2],
            [x + w - tick + 2, y + h - tick + 2]
        ]) {
            view.selection.addChild(sm.createRect(tick, tick, 0xffffff, {
                depth: 1.2, x: tx, y: ty, z: frameZ + 0.5, unlit: true
            }));
        }
        this.boardRoot.addChild(view.selection);

        if (!isTerminal) {
            // Normal tiles sit on bare FR-4 — traces carry the character.
            view.pad = null;
            view.face = null;
            return;
        }

        // Flat silkscreen terminal mark — no chunky IC block
        view.pad = sm.createRect(w * 0.78, h * 0.42, theme.pad, {
            depth: 1.2, x: x + w * 0.11, y: y + h * 0.38, z: 5, unlit: true
        });
        this.boardRoot.addChild(view.pad);

        const badgeW = Math.max(28, w * 0.7);
        const badgeH = Math.max(11, h * 0.2);
        view.badge = sm.createRect(badgeW, badgeH, theme.badge, {
            depth: 1.2,
            x: x + (w - badgeW) / 2,
            y: y + 3,
            z: 12,
            unlit: true
        });
        this.boardRoot.addChild(view.badge);
        this.addTileLabel(view, tile.type === 'source' ? 'START' : 'END', theme.label);

        const ledR = Math.max(4, Math.min(w, h) * 0.12);
        view.terminal = sm.createCircle(ledR, theme.rim, {
            depth: 1.4,
            x: x + w / 2 - ledR,
            y: y + h * 0.52 - ledR,
            z: 10,
            unlit: true
        });
        this.boardRoot.addChild(view.terminal);
    }

    addTileLabel(view, text, color) {
        const label = this.sm.createText(text, {
            fontSize: Math.max(11, Math.floor(this.tileSize * 0.26)),
            fill: color,
            z: 24,
            billboard: false,
            depthTest: false
        });
        label.x = this.boardX + view.col * this.tileSize + this.tileSize / 2;
        label.y = this.boardY + view.row * this.tileSize + Math.max(12, this.tileSize * 0.2);
        this.boardRoot.addChild(label);
    }

    clearPieceMeshes(view) {
        if (!view || !this.boardRoot) return;
        const wipe = (list) => {
            (list || []).forEach((part) => {
                try {
                    this.boardRoot.removeChild(part);
                    part.destroy?.();
                } catch (_) { /* already disposed */ }
            });
        };
        wipe(view.traces);
        wipe((view.hardware || []).filter((h) => h && h._pieceDetail));
        view.traces = [];
        view.hardware = (view.hardware || []).filter((h) => h && !h._pieceDetail);
    }

    addPiecePart(view, mesh, { live = false } = {}) {
        this.boardRoot.addChild(mesh);
        if (live) view.traces.push(mesh);
        else {
            mesh._pieceDetail = true;
            view.hardware.push(mesh);
        }
        return mesh;
    }

    rebuildTraces(view, mask) {
        this.clearPieceMeshes(view);
        if (!mask) {
            view.mask = 0;
            return;
        }

        const tile = this.grid[view.row][view.col];
        const theme = this.terminalTheme(tile?.type);
        const ts = this.tileSize;
        const gx = this.boardX + view.col * ts;
        const gy = this.boardY + view.row * ts;
        const cx = gx + ts / 2;
        const cy = gy + ts / 2;

        // Flat etched copper on FR-4 — keep depth tiny so tilt doesn't look like pipes
        const copper = theme?.metal || 0xe8b84a;
        const track = Math.max(7, Math.round(ts * 0.18));
        const padR = Math.max(5, Math.round(ts * 0.14));
        const traceZ = 6;
        const traceDepth = 1.1;

        const addPad = (px, py, r = padR) => {
            this.addPiecePart(view, this.sm.createCircle(r, copper, {
                depth: traceDepth, x: px - r, y: py - r, z: traceZ + 0.4, unlit: true
            }), { live: true });
            this.addPiecePart(view, this.sm.createCircle(Math.max(1.4, r * 0.3), 0x1a5a28, {
                depth: 0.6, x: px - r * 0.3, y: py - r * 0.3, z: traceZ + 1, unlit: true
            }));
        };

        const addTrace = (x, y, w, h) => {
            if (w < 1 || h < 1) return;
            this.addPiecePart(view, this.sm.createRect(w, h, copper, {
                depth: traceDepth, x, y, z: traceZ, unlit: true
            }), { live: true });
        };

        addPad(cx, cy, padR);

        const half = ts / 2;
        if (mask & CB_DIR.N) {
            addTrace(cx - track / 2, gy + 1, track, half - padR + 2);
            addPad(cx, gy + padR, padR * 0.85);
        }
        if (mask & CB_DIR.S) {
            addTrace(cx - track / 2, cy + padR - 2, track, half - padR + 2);
            addPad(cx, gy + ts - padR, padR * 0.85);
        }
        if (mask & CB_DIR.W) {
            addTrace(gx + 1, cy - track / 2, half - padR + 2, track);
            addPad(gx + padR, cy, padR * 0.85);
        }
        if (mask & CB_DIR.E) {
            addTrace(cx + padR - 2, cy - track / 2, half - padR + 2, track);
            addPad(gx + ts - padR, cy, padR * 0.85);
        }
        view.mask = mask;
    }

    tintMesh(obj, color) {
        if (!obj?.object?.material?.color) return;
        obj.object.material.color.setHex(color);
    }

    updateCellView(view) {
        if (!view) return;
        const tile = this.grid[view.row]?.[view.col];
        if (!tile) return;

        const key = `${view.col},${view.row}`;
        const theme = this.terminalTheme(tile.type);
        const live = this.circuitLive && this.powered.has(key);
        const pulse = 0.6 + 0.4 * Math.sin(this.pulsePhase + view.col * 0.4 + view.row * 0.3);
        const selected = view.col === this.selCol && view.row === this.selRow && this.gameState === 'playing';

        if (view.selection) view.selection.visible = selected;
        if (view.glow) {
            if (theme) {
                view.glow.visible = true;
                view.glow.alpha = live ? 0.28 * pulse : 0.14 + 0.06 * pulse;
            } else {
                view.glow.visible = live;
                view.glow.alpha = live ? 0.2 * pulse : 0;
            }
        }

        const mask = this.getTileMask(tile);
        if (mask !== view.mask) this.rebuildTraces(view, mask);

        let metal = live ? 0xfff27a : (theme?.metal || 0xe8b84a);
        if (selected && !live) metal = theme?.metal || 0xffe28a;
        (view.traces || []).forEach((part) => this.tintMesh(part, metal));
    }

    syncPowerVisuals() {
        for (let r = 0; r < this.cellViews.length; r++) {
            for (let c = 0; c < (this.cellViews[r] || []).length; c++) {
                this.updateCellView(this.cellViews[r][c]);
            }
        }
    }

    formatTime(seconds) {
        const clamped = Math.max(0, seconds);
        if (clamped <= 5) return clamped.toFixed(1);
        return String(Math.ceil(clamped));
    }

    updateTimerLabel() {
        if (!this.timerLabel || !this.sm) return;
        const urgent = this.timeLeft <= 5;
        const color = this.circuitClosed ? 0x66ff99 : (urgent ? 0xff3344 : 0x44ff66);
        const text = `THROW ${this.formatTime(this.timeLeft)}`;
        const key = `${text}|${color}`;
        if (key === this._timerKey) return;
        this._timerKey = key;
        if (color !== this.timerColor) {
            const x = this.timerLabel.x;
            const y = this.timerLabel.y;
            this.boardRoot.removeChild(this.timerLabel);
            this.timerLabel.destroy();
            this.timerLabel = this.sm.createText(text, {
                fontSize: 18, fill: color, z: 20, billboard: false, depthTest: false
            });
            this.timerLabel.x = x;
            this.timerLabel.y = y;
            this.boardRoot.addChild(this.timerLabel);
            this.timerColor = color;
        } else if (typeof this.timerLabel.setText === 'function') {
            this.timerLabel.setText(text);
        }
    }

    updateHints() {
        if (!this.hintRoot || !this.sm) return;
        const key = `${this.gameState}|${this.levelIndex}|${this.loopCount}|${this.gridCols}x${this.gridRows}|${this.energyLock}`;
        if (key === this._hintKey) return;
        this._hintKey = key;
        this.hintRoot.removeChildren();
        if (this.gameState !== 'playing') return;

        const addHint = (text, color, size, y) => {
            const label = this.sm.createText(text, { fontSize: size, fill: color, z: 20, billboard: true });
            label.x = this.width / 2;
            label.y = y;
            this.hintRoot.addChild(label);
        };

        const hintY = this.boardY - 48;
        if (this.loopCount > 0) {
            addHint(`OVERCLOCK ×${this.loopCount} — shorter throw window`, 0xff8866, 13, hintY);
        } else {
            addHint('Route red START into green END. Unused breakers can sit idle.', 0xcdd3da, 12, hintY);
        }
        addHint(
            'Click to rotate · Enter throws early · open branches blow a fuse',
            0x9aa3ab,
            12,
            this.boardY + this.gridRows * this.tileSize + 24
        );
    }

    syncVisuals() {
        if (!this.graphics?.isInitialized) return;

        const inMenu = this.gameState === 'menu' || this.gameState === 'gameOver';
        this.frameCamera();
        if (this.boardRoot) this.boardRoot.visible = !inMenu;
        if (this.menuBg) this.menuBg.visible = inMenu;
        if (this.playBg) this.playBg.visible = !inMenu;
        if (this.menuPropRoot) this.menuPropRoot.visible = inMenu;
        if (this.menuRoot) {
            if (inMenu && this._menuState !== this.gameState) this.rebuildMenu();
            this.menuRoot.visible = inMenu;
        }
        if (this.hintRoot) this.hintRoot.visible = !inMenu;
        if (this.pauseRoot) this.pauseRoot.visible = this.gameState === 'paused';

        if (!inMenu) {
            this.syncPowerVisuals();
            this.updateHints();
            this.updateTimerLabel();
        }

        if (this.clearFlashMesh) {
            const on = this.levelClearFlash > 0;
            this.clearFlashMesh.visible = on;
            this.clearFlashMesh.alpha = on ? 0.18 : 0;
        }
        if (this.fuseFlashMesh) {
            const on = this.fuseFlash > 0;
            this.fuseFlashMesh.visible = on;
            this.fuseFlashMesh.alpha = on ? 0.25 * (this.fuseFlash / 500) : 0;
        }

        this.updateStatsPanel();
    }

    frameCamera() {
        if (!this.graphics?.framePlayfield) return;
        const inMenu = this.gameState === 'menu' || this.gameState === 'gameOver';
        const key = inMenu
            ? `menu:${this.gameState}`
            : `board:${this.boardX}:${this.boardY}:${this.tileSize}:${this.gridCols}:${this.gridRows}`;
        if (key === this._frameKey) return;
        this._frameKey = key;
        if (inMenu) {
            this.graphics.framePlayfield(0, 0, this.width, this.height, 10, 0.28);
        } else {
            const boardW = this.gridCols * this.tileSize;
            const boardH = this.gridRows * this.tileSize;
            // Low tilt — top-down PCB view, not a 3D pipe sculpture
            this.graphics.framePlayfield(
                this.boardX - 48,
                this.boardY - 64,
                boardW + 96,
                boardH + 112,
                18,
                0.22
            );
        }
    }

    drawPreviewFrame() {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.fillStyle = '#1a1c20';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = '#5a6068';
        ctx.fillRect(18, 16, this.width - 36, this.height - 32);
        ctx.fillStyle = '#2a2e32';
        ctx.fillRect(26, 28, this.width - 52, this.height - 56);
        ctx.fillStyle = '#e8a317';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('CIRCUIT', this.width / 2, this.height / 2 - 8);
        ctx.fillText('BREAKER', this.width / 2, this.height / 2 + 8);
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = '#0c0d10';
            ctx.fillRect(32 + i * 14, this.height - 28, 11, 14);
            ctx.fillStyle = i === 0 ? '#c41e3a' : i === 5 ? '#2e8b3a' : '#e8a317';
            ctx.fillRect(35 + i * 14, this.height - 24, 5, 8);
        }
    }

    updateStatsPanel() {
        const el = document.getElementById('game-stats-panel')?.querySelector('.stats-content');
        if (!el) return;
        const score = Number.isFinite(this.score) ? this.score : 0;
        const level = this.loopCount > 0
            ? `${this.levelIndex + 1}+${this.loopCount}`
            : String(this.levelIndex + 1);
        const lives = Number.isFinite(this.lives) ? this.lives : 0;
        const time = this.gameState === 'playing' ? this.formatTime(this.timeLeft) : '--';
        el.innerHTML = `
            <div class="stat-item"><div class="stat-label">Time</div><div class="stat-value">${time}</div></div>
            <div class="stat-item"><div class="stat-label">Score</div><div class="stat-value">${Utils.formatScore(score)}</div></div>
            <div class="stat-item"><div class="stat-label">Level</div><div class="stat-value">${level}</div></div>
            <div class="stat-item"><div class="stat-label">Moves</div><div class="stat-value">${this.movesUsed}/${this.parMoves}</div></div>
            <div class="stat-item"><div class="stat-label">Fuses</div><div class="stat-value">${lives}</div></div>
        `;
    }

    cleanup() {
        if (this._advanceTimer) {
            clearTimeout(this._advanceTimer);
            this._advanceTimer = null;
        }
        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);
        this.canvas.removeEventListener('pointerdown', this.pointerHandler);
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.graphics?.getTicker() && this.tickerCallback) {
            this.graphics.getTicker().remove(this.tickerCallback);
        }
        this.graphics?.stop?.();
        this.graphics?.destroy?.();
    }
}

function initCircuitBreaker() {
    // Lobby uses static cover art
}
