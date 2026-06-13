/**
 * Star Siege — Space Invaders-style shooter (pixel-art sprites + procedural fallback).
 */
const STAR_SIEGE_SPRITES = {
    'alien-top-a': 'assets/games/space-invaders/sprites/alien-top-a.png',
    'alien-top-b': 'assets/games/space-invaders/sprites/alien-top-b.png',
    'alien-mid-a': 'assets/games/space-invaders/sprites/alien-mid-a.png',
    'alien-mid-b': 'assets/games/space-invaders/sprites/alien-mid-b.png',
    'alien-bot-a': 'assets/games/space-invaders/sprites/alien-bot-a.png',
    'alien-bot-b': 'assets/games/space-invaders/sprites/alien-bot-b.png',
    player: 'assets/games/space-invaders/sprites/player.png',
    'bullet-player': 'assets/games/space-invaders/sprites/bullet-player.png',
    'bullet-alien': 'assets/games/space-invaders/sprites/bullet-alien.png',
    ufo: 'assets/games/space-invaders/sprites/ufo.png',
    explosion: 'assets/games/space-invaders/sprites/explosion.png'
};

class SpaceInvadersGame {
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
            this.graphics = new GraphicsCore(canvas, {
                width: this.width,
                height: this.height,
                backgroundColor: 0x000011,
                pixelPerfect: true
            });
        }

        this.gameState = 'menu';
        this.score = 0;
        this.lives = 3;
        this.wave = 1;

        this.player = { x: this.width / 2, y: this.height - 48, w: 36, h: 18, speed: 5.2 };
        this.playerBullet = null;
        this.alienBullets = [];
        this.aliens = [];
        this.bunkers = [];
        this.ufo = null;
        this.explosions = [];

        this.formationX = 0;
        this.alienDir = 1;
        this.alienStepTimer = 0;
        this.alienBaseStepDelay = 380;
        this.alienFireTimer = 0;
        this.ufoTimer = 0;
        this.waveClearFlash = 0;
        this.invincibleMs = 0;
        this.starPhase = 0;

        this.spriteTextures = {};
        this.spriteManager = null;

        this.keys = {};
        this.lastTime = 0;
        this.tickerCallback = null;
        this.rafId = null;

        this.setupInput();

        if (this.isPreview) {
            this.gameLoop();
        } else {
            this.initGraphics();
        }
    }

    // ── Init / loop ─────────────────────────────────────────────────

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
            console.error('Star Siege init failed:', err);
            this.startFallbackLoop();
            this.markReady();
        }
    }

    async finishGraphicsInit() {
        try {
            this.nesEffects = this.graphics.getScreenEffects();
            this.screenEffects = this.nesEffects;
            this.spriteManager = new SpriteManager(this.graphics);

            const bg = this.graphics.getLayer('background');
            const fg = this.graphics.getLayer('foreground');
            this.uiLayer = this.graphics.getLayer('ui');

            this.stars = this.buildStars(90);
            this.staticBg = new PIXI.Graphics();
            this.drawStaticBackground(this.staticBg);
            bg.addChild(this.staticBg);

            this.worldGfx = new PIXI.Container();
            fg.addChild(this.worldGfx);

            await this.loadSprites();

            this.startGameLoop();
            this.graphics.start?.();
            this.drawFrame();
        } catch (err) {
            console.error('Star Siege finishGraphicsInit failed:', err);
            this.startFallbackLoop();
        } finally {
            this.markReady();
        }
    }

    async loadSprites() {
        if (typeof assetLoader === 'undefined') return;
        const entries = Object.entries(STAR_SIEGE_SPRITES);
        await Promise.all(entries.map(async ([key, path]) => {
            const tex = await assetLoader.loadTexture(path, { pixelPerfect: true });
            if (tex) this.spriteTextures[key] = tex;
        }));
    }

    buildStars(count) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: (i * 97 + 13) % this.width,
                y: (i * 53 + 7) % (this.height - 80),
                size: i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1,
                phase: (i * 0.7) % (Math.PI * 2),
                speed: 0.4 + (i % 5) * 0.15
            });
        }
        return stars;
    }

    getTexture(key) {
        return this.spriteTextures[key] || null;
    }

    spawnExplosion(x, y) {
        this.explosions.push({ x, y, life: 280, maxLife: 280 });
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
            this.starPhase += deltaMs * 0.004;
        }
        this.update(deltaMs);
        this.drawFrame();
    }

    // ── Input ───────────────────────────────────────────────────────

    setupInput() {
        this.keydownHandler = (e) => {
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal?.classList.contains('active')) return;

            const activeCanvas = document.getElementById('game-canvas');
            if (activeCanvas !== this.canvas) return;

            this.keys[e.code] = true;

            if (e.code === 'Space') {
                if (this.gameState === 'menu' || this.gameState === 'gameOver') {
                    e.preventDefault();
                    this.startGame();
                } else if (this.gameState === 'playing') {
                    e.preventDefault();
                    this.firePlayerBullet();
                }
            }
            if (e.code === 'KeyP' && this.gameState === 'playing') this.gameState = 'paused';
            else if (e.code === 'KeyP' && this.gameState === 'paused') this.gameState = 'playing';
            if (e.code === 'KeyR') this.startGame();
        };
        this.keyupHandler = (e) => { this.keys[e.code] = false; };
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }

    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 3;
        this.wave = 1;
        this.player.x = this.width / 2;
        this.playerBullet = null;
        this.alienBullets = [];
        this.ufo = null;
        this.ufoTimer = 8000;
        this.invincibleMs = 0;
        this.explosions = [];
        this.spawnWave();
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('space-invaders', 'start');
    }

    gameOver() {
        this.gameState = 'gameOver';
        if (typeof audioManager !== 'undefined') audioManager.playSfx('gameOver');
        if (highScoreManager.checkHighScore('space-invaders', this.score)) {
            highScoreManager.requestNameEntry('space-invaders', this.score);
        }
    }

    loseLife() {
        this.lives--;
        this.playerBullet = null;
        this.alienBullets = [];
        this.invincibleMs = 1500;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('space-invaders', 'playerHit');
        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    // ── Wave / entities ─────────────────────────────────────────────

    spawnWave() {
        this.aliens = [];
        this.formationX = 0;
        this.alienDir = 1;
        this.alienStepTimer = 0;
        this.alienFireTimer = 0;
        this.waveClearFlash = 0;

        const cols = 11;
        const rows = 5;
        const startX = 80;
        const startY = 72;
        const gapX = 44;
        const gapY = 36;

        for (let row = 0; row < rows; row++) {
            let type = 'bottom';
            let points = 10;
            let color = 0x44ff44;
            if (row === 0) {
                type = 'top';
                points = 30;
                color = 0xff44ff;
            } else if (row <= 2) {
                type = 'mid';
                points = 20;
                color = 0x44ccff;
            }

            for (let col = 0; col < cols; col++) {
                this.aliens.push({
                    row,
                    col,
                    x: startX + col * gapX,
                    y: startY + row * gapY,
                    w: 28,
                    h: 22,
                    alive: true,
                    type,
                    points,
                    color,
                    anim: 0
                });
            }
        }

        this.createBunkers();
    }

    createBunkers() {
        this.bunkers = [];
        const positions = [120, 280, 440, 600];
        const cell = 4;
        const cols = 12;
        const rows = 8;

        for (const bx of positions) {
            const cells = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const inArch =
                        (r < 4 && c >= 3 && c <= 8) ||
                        (r >= 4 && c >= 4 && c <= 7);
                    if (inArch) {
                        cells.push({
                            x: bx + c * cell,
                            y: this.height - 130 + r * cell,
                            w: cell,
                            h: cell,
                            alive: true
                        });
                    }
                }
            }
            this.bunkers.push({ cells });
        }
    }

    aliveAlienCount() {
        return this.aliens.filter((a) => a.alive).length;
    }

    getAlienStepDelay() {
        const alive = this.aliveAlienCount();
        const speedup = Math.max(0, 55 - alive) * 6;
        const waveBonus = (this.wave - 1) * 55;
        return Math.max(70, this.alienBaseStepDelay - speedup - waveBonus);
    }

    firePlayerBullet() {
        if (this.playerBullet?.active) return;
        this.playerBullet = {
            x: this.player.x,
            y: this.player.y - 8,
            w: 4,
            h: 12,
            vy: -9,
            active: true
        };
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('space-invaders', 'shoot');
    }

    fireAlienBullet(fromAlien) {
        this.alienBullets.push({
            x: fromAlien.x,
            y: fromAlien.y + fromAlien.h,
            w: 4,
            h: 10,
            vy: 5 + this.wave * 0.55
        });
    }

    spawnUfo() {
        if (this.ufo?.active) return;
        const fromLeft = Math.random() < 0.5;
        this.ufo = {
            x: fromLeft ? -40 : this.width + 40,
            y: 36,
            w: 40,
            h: 16,
            vx: fromLeft ? 2.2 : -2.2,
            active: true,
            points: [50, 100, 150, 300][Math.floor(Math.random() * 4)]
        };
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('space-invaders', 'ufo');
    }

    completeWave() {
        this.wave++;
        this.score += 200 + this.wave * 50;
        this.waveClearFlash = 600;
        this.playerBullet = null;
        this.alienBullets = [];
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('space-invaders', 'waveClear');
        this.nesEffects?.flash?.('#00FF88', 200);
        setTimeout(() => {
            if (this.gameState === 'playing') this.spawnWave();
        }, 700);
    }

    // ── Update ──────────────────────────────────────────────────────

    update(dt) {
        if (this.gameState !== 'playing') return;
        if (!Number.isFinite(dt) || dt <= 0) return;

        if (this.waveClearFlash > 0) {
            this.waveClearFlash -= dt;
            return;
        }

        const dtNorm = dt / 16.67;

        if (this.invincibleMs > 0) this.invincibleMs -= dt;

        this.updateExplosions(dt);

        if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.player.x -= this.player.speed * dtNorm;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) this.player.x += this.player.speed * dtNorm;
        this.player.x = Math.max(30, Math.min(this.width - 30, this.player.x));

        this.updatePlayerBullet(dtNorm);
        this.updateAliens(dt);
        this.updateAlienBullets(dtNorm);
        this.updateUfo(dtNorm);
        this.checkCollisions();

        if (this.aliveAlienCount() === 0 && this.waveClearFlash <= 0) {
            this.completeWave();
        }
    }

    updatePlayerBullet(dtNorm) {
        const b = this.playerBullet;
        if (!b?.active) return;
        b.y += b.vy * dtNorm;
        if (b.y < 40) b.active = false;
    }

    updateAliens(dt) {
        this.alienStepTimer += dt;
        const delay = this.getAlienStepDelay();
        if (this.alienStepTimer < delay) return;
        this.alienStepTimer = 0;

        const stepX = 10;
        const stepDown = 18;
        const margin = 40;

        let minX = Infinity;
        let maxX = -Infinity;
        for (const a of this.aliens) {
            if (!a.alive) continue;
            const ax = a.x + this.formationX;
            minX = Math.min(minX, ax);
            maxX = Math.max(maxX, ax + a.w);
        }
        if (!Number.isFinite(minX)) return;

        let drop = false;
        if ((this.alienDir > 0 && maxX >= this.width - margin) ||
            (this.alienDir < 0 && minX <= margin)) {
            this.alienDir *= -1;
            drop = true;
        }

        if (drop) {
            for (const a of this.aliens) {
                if (a.alive) a.y += stepDown;
            }
        } else {
            this.formationX += this.alienDir * stepX;
        }

        for (const a of this.aliens) {
            if (a.alive) a.anim = 1 - a.anim;
        }

        this.alienFireTimer += delay;
        if (this.alienFireTimer > 550) {
            this.alienFireTimer = 0;
            this.tryAlienFire();
            if (this.wave >= 4 && Math.random() < 0.35) this.tryAlienFire();
        }

        for (const a of this.aliens) {
            if (a.alive && a.y + a.h >= this.player.y - 10) {
                this.gameOver();
                return;
            }
        }
    }

    tryAlienFire() {
        const alive = this.aliens.filter((a) => a.alive);
        if (!alive.length) return;
        if (Math.random() > 0.55 + this.wave * 0.07) return;

        const cols = {};
        for (const a of alive) {
            if (!cols[a.col] || a.row > cols[a.col].row) cols[a.col] = a;
        }
        const shooters = Object.values(cols);
        const shooter = shooters[Math.floor(Math.random() * shooters.length)];
        this.fireAlienBullet({
            x: shooter.x + this.formationX + shooter.w / 2,
            y: shooter.y,
            h: shooter.h
        });
    }

    updateExplosions(dt) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].life -= dt;
            if (this.explosions[i].life <= 0) this.explosions.splice(i, 1);
        }
    }

    updateAlienBullets(dtNorm) {
        for (let i = this.alienBullets.length - 1; i >= 0; i--) {
            const b = this.alienBullets[i];
            b.y += b.vy * dtNorm;
            if (b.y > this.height) this.alienBullets.splice(i, 1);
        }
    }

    updateUfo(dtNorm) {
        this.ufoTimer -= dtNorm * 16.67;
        if (this.ufoTimer <= 0) {
            this.ufoTimer = 12000 + Math.random() * 15000;
            this.spawnUfo();
        }
        if (!this.ufo?.active) return;
        this.ufo.x += this.ufo.vx * dtNorm;
        if (this.ufo.x < -60 || this.ufo.x > this.width + 60) {
            this.ufo.active = false;
        }
    }

    checkCollisions() {
        const pb = this.playerBullet;
        if (pb?.active) {
            for (const a of this.aliens) {
                if (!a.alive) continue;
                const ax = a.x + this.formationX;
                if (this.hitRect(pb.x - pb.w / 2, pb.y, pb.w, pb.h, ax, a.y, a.w, a.h)) {
                    a.alive = false;
                    this.score += a.points;
                    pb.active = false;
                    this.spawnExplosion(ax + a.w / 2, a.y + a.h / 2);
                    if (typeof audioManager !== 'undefined') audioManager.playGameSfx('space-invaders', 'alienHit');
                    break;
                }
            }

            if (pb.active && this.ufo?.active &&
                this.hitRect(pb.x - pb.w / 2, pb.y, pb.w, pb.h, this.ufo.x, this.ufo.y, this.ufo.w, this.ufo.h)) {
                this.score += this.ufo.points;
                this.ufo.active = false;
                pb.active = false;
                if (typeof audioManager !== 'undefined') audioManager.playGameSfx('space-invaders', 'ufo');
            }

            if (pb.active) {
                for (const bunker of this.bunkers) {
                    if (this.hitBunker(pb.x - pb.w / 2, pb.y, pb.w, pb.h, bunker)) {
                        pb.active = false;
                        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('space-invaders', 'bunkerHit');
                        break;
                    }
                }
            }
        }

        if (this.invincibleMs <= 0) {
            for (const b of this.alienBullets) {
                if (this.hitRect(b.x - b.w / 2, b.y, b.w, b.h,
                    this.player.x - this.player.w / 2, this.player.y - this.player.h / 2,
                    this.player.w, this.player.h)) {
                    this.alienBullets.length = 0;
                    this.loseLife();
                    break;
                }
            }
        }

        for (const b of this.alienBullets) {
            for (const bunker of this.bunkers) {
                if (this.hitBunker(b.x - b.w / 2, b.y, b.w, b.h, bunker)) {
                    b.y = this.height + 10;
                    if (typeof audioManager !== 'undefined') audioManager.playGameSfx('space-invaders', 'bunkerHit');
                    break;
                }
            }
        }
    }

    hitRect(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    hitBunker(bx, by, bw, bh, bunker) {
        let hit = false;
        for (const cell of bunker.cells) {
            if (!cell.alive) continue;
            if (this.hitRect(bx, by, bw, bh, cell.x, cell.y, cell.w, cell.h)) {
                cell.alive = false;
                hit = true;
            }
        }
        return hit;
    }

    // ── Rendering ───────────────────────────────────────────────────

    drawStaticBackground(gfx) {
        gfx.clear();
        gfx.beginFill(0x000018);
        gfx.drawRect(0, 0, this.width, this.height);
        gfx.endFill();

        // Nebula bands
        gfx.beginFill(0x220044, 0.25);
        gfx.drawRect(0, 40, this.width, 120);
        gfx.endFill();
        gfx.beginFill(0x002244, 0.2);
        gfx.drawRect(0, 200, this.width, 100);
        gfx.endFill();

        if (this.stars) {
            for (const s of this.stars) {
                const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.starPhase * s.speed + s.phase));
                const tint = s.size >= 3 ? 0xaaccff : 0xffffff;
                gfx.beginFill(tint, twinkle * 0.9);
                gfx.drawRect(s.x, s.y, s.size, s.size);
                gfx.endFill();
            }
        }

        // Ground defense line
        gfx.lineStyle(2, 0x00ffcc, 0.35);
        gfx.moveTo(0, this.height - 28);
        gfx.lineTo(this.width, this.height - 28);
    }

    blitSprite(container, texKey, x, y, opts = {}) {
        const tex = this.getTexture(texKey);
        if (tex) {
            const spr = new PIXI.Sprite(tex);
            spr.x = x - (opts.anchorX ?? 0.5) * spr.width;
            spr.y = y - (opts.anchorY ?? 0) * spr.height;
            if (opts.alpha !== undefined) spr.alpha = opts.alpha;
            if (opts.tint !== undefined) spr.tint = opts.tint;
            container.addChild(spr);
            return;
        }
        if (opts.fallback) opts.fallback(container, x, y);
    }

    drawFrame() {
        if (!this.graphics?.isInitialized || !this.worldGfx) return;

        this.staticBg?.clear?.();
        if (this.staticBg) this.drawStaticBackground(this.staticBg);

        this.worldGfx.removeChildren();
        this.uiLayer.removeChildren();

        if (this.gameState === 'menu' || this.gameState === 'gameOver') {
            this.drawMenu(this.uiLayer);
            this.updateStatsPanel();
            return;
        }

        this.drawWorld(this.worldGfx);

        if (this.waveClearFlash > 0) {
            const flash = new PIXI.Graphics();
            flash.beginFill(0x00ff88, 0.25);
            flash.drawRect(0, 0, this.width, this.height);
            flash.endFill();
            this.uiLayer.addChild(flash);
            this.addCenterText(this.uiLayer, `WAVE ${this.wave}`, 0x00ffcc, 28, -20);
        }

        if (this.gameState === 'paused') {
            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.6);
            overlay.drawRect(0, 0, this.width, this.height);
            overlay.endFill();
            this.uiLayer.addChild(overlay);
            this.addCenterText(this.uiLayer, 'PAUSED', 0xffff00, 32, -10);
            this.addCenterText(this.uiLayer, 'Press P to resume', 0xffffff, 16, 30);
        }

        this.updateStatsPanel();
    }

    drawWorld(container) {
        const bunkerGfx = new PIXI.Graphics();
        for (const bunker of this.bunkers) {
            for (const cell of bunker.cells) {
                if (!cell.alive) continue;
                bunkerGfx.beginFill(0x44ff66);
                bunkerGfx.drawRect(cell.x, cell.y, cell.w, cell.h);
                bunkerGfx.endFill();
                bunkerGfx.beginFill(0x88ffaa, 0.5);
                bunkerGfx.drawRect(cell.x, cell.y, cell.w, 1);
                bunkerGfx.endFill();
            }
        }
        container.addChild(bunkerGfx);

        for (const a of this.aliens) {
            if (!a.alive) continue;
            const frame = a.anim ? 'b' : 'a';
            const prefix = a.type === 'top' ? 'alien-top' : a.type === 'mid' ? 'alien-mid' : 'alien-bot';
            const ax = a.x + this.formationX;
            this.blitSprite(container, `${prefix}-${frame}`, ax + a.w / 2, a.y, {
                fallback: (c, x, y) => this.drawAlienFallback(c, x - a.w / 2, y, a)
            });
        }

        if (this.ufo?.active) {
            this.blitSprite(container, 'ufo', this.ufo.x + this.ufo.w / 2, this.ufo.y, {
                fallback: (c) => this.drawUfoFallback(c, this.ufo)
            });
        }

        const blink = this.invincibleMs <= 0 || Math.floor(this.invincibleMs / 120) % 2 === 0;
        if (blink) {
            this.blitSprite(container, 'player', this.player.x, this.player.y, {
                anchorY: 0.5,
                fallback: (c) => this.drawPlayerFallback(c)
            });
        }

        const pb = this.playerBullet;
        if (pb?.active) {
            this.blitSprite(container, 'bullet-player', pb.x, pb.y + pb.h / 2, {
                fallback: (c, x, y) => {
                    const g = new PIXI.Graphics();
                    g.beginFill(0xffff00);
                    g.drawRect(x - pb.w / 2, y - pb.h / 2, pb.w, pb.h);
                    g.endFill();
                    c.addChild(g);
                }
            });
        }

        for (const b of this.alienBullets) {
            this.blitSprite(container, 'bullet-alien', b.x, b.y + b.h / 2, {
                fallback: (c, x, y) => {
                    const g = new PIXI.Graphics();
                    g.beginFill(0xff6644);
                    g.drawRect(x - b.w / 2, y - b.h / 2, b.w, b.h);
                    g.endFill();
                    c.addChild(g);
                }
            });
        }

        for (const ex of this.explosions) {
            const alpha = Math.max(0, ex.life / ex.maxLife);
            this.blitSprite(container, 'explosion', ex.x, ex.y, {
                alpha,
                fallback: (c, x, y) => {
                    const g = new PIXI.Graphics();
                    g.beginFill(0xffaa00, alpha);
                    g.drawCircle(x, y, 8 * alpha + 2);
                    g.endFill();
                    c.addChild(g);
                }
            });
        }
    }

    drawPlayerFallback(container) {
        const gfx = new PIXI.Graphics();
        const px = this.player.x;
        const py = this.player.y;
        const w = this.player.w;
        const h = this.player.h;
        gfx.beginFill(0x00ffcc);
        gfx.drawPolygon([
            px, py - h / 2,
            px - w / 2, py + h / 2,
            px + w / 2, py + h / 2
        ]);
        gfx.endFill();
        container.addChild(gfx);
    }

    drawAlienFallback(container, x, y, alien) {
        const gfx = new PIXI.Graphics();
        const bob = alien.anim ? 2 : 0;
        gfx.beginFill(alien.color);
        if (alien.type === 'top') {
            gfx.drawRect(x + 4, y + bob, alien.w - 8, 6);
            gfx.drawRect(x + 2, y + 8 + bob, alien.w - 4, 8);
            gfx.drawRect(x, y + 16 + bob, alien.w, 6);
        } else if (alien.type === 'mid') {
            gfx.drawRect(x + 6, y + bob, alien.w - 12, 8);
            gfx.drawRect(x + 2, y + 10 + bob, alien.w - 4, 10);
        } else {
            gfx.drawRect(x + 4, y + 2 + bob, alien.w - 8, 8);
            gfx.drawRect(x, y + 12 + bob, alien.w, 8);
        }
        gfx.endFill();
        container.addChild(gfx);
    }

    drawUfoFallback(container, ufo) {
        const gfx = new PIXI.Graphics();
        gfx.beginFill(0xff2244);
        gfx.drawEllipse(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, ufo.w / 2, ufo.h / 2);
        gfx.endFill();
        container.addChild(gfx);
    }

    drawMenu(layer) {
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.55);
        overlay.drawRect(0, 0, this.width, this.height);
        overlay.endFill();
        layer.addChild(overlay);

        this.addCenterText(layer, 'STAR SIEGE', 0x00ffcc, 42, -100);
        const best = highScoreManager.getTopScore('space-invaders');
        this.addCenterText(layer, `BEST: ${Utils.formatScore(best)}`, 0xff66ff, 20, -55);
        this.addCenterText(layer, '← → Move    SPACE Fire', 0xffffff, 16, 0);
        this.addCenterText(layer, 'Destroy the invasion · bunkers are thinner now', 0xaaaacc, 16, 28);
        this.addCenterText(layer, 'PRESS SPACE TO START', 0xffff00, 22, 70);
        if (this.gameState === 'gameOver') {
            this.addCenterText(layer, 'GAME OVER', 0xff4444, 36, -140);
        }
    }

    drawPreviewFrame() {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.fillStyle = '#000011';
        ctx.fillRect(0, 0, this.width, this.height);
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect((i * 37) % this.width, (i * 23) % this.height, 2, 2);
        }
        ctx.fillStyle = '#44ff44';
        for (let c = 0; c < 6; c++) {
            ctx.fillRect(30 + c * 18, this.height - 50, 12, 8);
        }
        ctx.fillStyle = '#ff44ff';
        ctx.fillRect(60, 40, 20, 12);
        ctx.fillRect(100, 40, 20, 12);
        ctx.fillStyle = '#00ffcc';
        ctx.beginPath();
        ctx.moveTo(this.width / 2, this.height - 20);
        ctx.lineTo(this.width / 2 - 12, this.height - 4);
        ctx.lineTo(this.width / 2 + 12, this.height - 4);
        ctx.closePath();
        ctx.fill();
    }

    addCenterText(layer, text, color, size, yOff) {
        const t = new PIXI.Text(text, {
            fontFamily: 'Courier New',
            fontSize: size,
            fill: color,
            fontWeight: 'bold',
            align: 'center'
        });
        t.anchor.set(0.5);
        t.x = this.width / 2;
        t.y = this.height / 2 + yOff;
        layer.addChild(t);
    }

    updateStatsPanel() {
        const el = document.getElementById('game-stats-panel')?.querySelector('.stats-content');
        if (!el) return;
        const score = Number.isFinite(this.score) ? this.score : 0;
        const lives = Number.isFinite(this.lives) ? this.lives : 0;
        const wave = Number.isFinite(this.wave) ? this.wave : 1;
        const aliens = this.aliveAlienCount();
        el.innerHTML = `
            <div class="stat-item"><div class="stat-label">Score</div><div class="stat-value">${Utils.formatScore(score)}</div></div>
            <div class="stat-item"><div class="stat-label">Lives</div><div class="stat-value">${lives}</div></div>
            <div class="stat-item"><div class="stat-label">Wave</div><div class="stat-value">${wave}</div></div>
            <div class="stat-item"><div class="stat-label">Aliens</div><div class="stat-value">${aliens}</div></div>
        `;
    }

    cleanup() {
        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.graphics?.getTicker() && this.tickerCallback) {
            this.graphics.getTicker().remove(this.tickerCallback);
        }
        this.graphics?.stop?.();
    }
}

function initSpaceInvaders() {
    // Lobby uses static cover art; preview canvas optional
}
