// Mini Golf — Three.js faux-3D course, 2D physics unchanged
class MinigolfGame {
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
                backgroundColor: 0x1a3d28,
                cameraMode: 'playfield2d'
            });
        }

        this.gameState = 'menu';
        this.score = 0;
        this.currentHole = 0;
        this.strokesOnHole = 0;
        this.isDestroyed = false;

        this.ball = {
            x: 0, y: 0, radius: 8,
            vx: 0, vy: 0,
            color: '#ffffff',
            isMoving: false
        };

        this.aiming = {
            isAiming: false,
            startX: 0, startY: 0,
            currentX: 0, currentY: 0,
            minDragDistance: 10
        };

        this.friction = 0.98;
        this.bounceCoefficient = 0.75;
        this.minVelocity = 0.1;
        this.maxSinkSpeed = 1.2;

        this.currentHoleData = null;
        this.holes = [];
        this.initializeHoles();

        this.sinking = {
            isActive: false, scale: 1, alpha: 1,
            duration: 0, maxDuration: 300, startTime: 0
        };
        this.speedWarning = { isActive: false, duration: 0, maxDuration: 500 };

        this.mouseDownHandler = null;
        this.mouseMoveHandler = null;
        this.mouseUpHandler = null;
        this.keydownHandler = null;
        this.keyupHandler = null;
        this.keys = {};
        this.setupInput();

        this.sm = null;
        this.nesEffects = null;
        this.courseRoot = null;
        this.dynamicRoot = null;
        this.uiRoot = null;
        this.menuRoot = null;
        this.pauseRoot = null;
        this.ballMesh = null;
        this.ballShadow = null;
        this.aimRoot = null;
        this.windmillViews = [];
        this.gateViews = [];
        this.barrierViews = [];
        this._frameKey = '';
        this._menuKey = '';
        this._statsKey = '';
        this._holeBuilt = -1;
        this.wallThickness = 16;
        this.wallDepth = 22;
        this.textureMaps = {};

        this.tickerCallback = null;
        this.animationFrameId = null;
        this._useRafLoop = false;

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
            this.sm = this.graphics.sprites;
            this.nesEffects = this.graphics.getScreenEffects();
            if (this.nesEffects) {
                this.nesEffects.crtScanlineIntensity = 0.035;
                this.nesEffects.crtVignetteIntensity = 0.06;
                this.nesEffects.crtCurvature = 0.008;
                const u = this.nesEffects.crtPass?.uniforms;
                if (u?.scanlineIntensity) u.scanlineIntensity.value = 0.035;
                if (u?.vignetteIntensity) u.vignetteIntensity.value = 0.06;
                if (u?.curvature) u.curvature.value = 0.008;
            }
            if (this.graphics.renderer) {
                this.graphics.renderer.toneMappingExposure = 1.2;
                this.graphics.renderer.setClearColor(0x152820, 1);
            }
            this.setupStageLights();
            this.initProcTextures();
            this.buildStaticScene();
            this.startGameLoop();
            this.graphics.start?.();
            this.syncVisuals();
        } catch (err) {
            console.error('Mini Golf init failed:', err);
            this.startFallbackLoop();
        } finally {
            this.markReady();
        }
    }

    setupStageLights() {
        const lights = this.graphics?.lights;
        if (!lights) return;
        if (lights.ambient) {
            lights.ambient.color.setHex(0x90b898);
            lights.ambient.intensity = 0.75;
        }
        if (lights.key) {
            lights.key.color.setHex(0xfff5e0);
            lights.key.intensity = 1.9;
            lights.key.position.set(120, 260, 700);
        }
        if (lights.fill) {
            lights.fill.color.setHex(0xa8d8ff);
            lights.fill.intensity = 0.9;
            lights.fill.position.set(this.width * 0.75, -this.height * 0.4, 400);
        }
        if (lights.rim) {
            lights.rim.color.setHex(0x88ffaa);
            lights.rim.intensity = 0.7;
            lights.rim.position.set(-280, 20, 360);
        }
    }

    makeCanvasTexture(draw, size = 64) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        draw(ctx, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return tex;
    }

    initProcTextures() {
        if (!window.THREE) return;
        this.textureMaps.grass = this.makeCanvasTexture((ctx, s) => {
            ctx.fillStyle = '#3f8a4e';
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 40; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#357844' : '#4c9a5c';
                ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 2, 2 + Math.random() * 3);
            }
        }, 64);
        this.textureMaps.grass.repeat.set(8, 6);

        this.textureMaps.sand = this.makeCanvasTexture((ctx, s) => {
            ctx.fillStyle = '#e6d2a0';
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 50; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#d4c090' : '#f0e2b8';
                ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
            }
        }, 32);

        this.textureMaps.water = this.makeCanvasTexture((ctx, s) => {
            ctx.fillStyle = '#2a7a9a';
            ctx.fillRect(0, 0, s, s);
            ctx.strokeStyle = 'rgba(120,200,230,0.35)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(8 + i * 8, 10 + i * 6, 5, 0, Math.PI * 1.5);
                ctx.stroke();
            }
        }, 32);

        this.textureMaps.wood = this.makeCanvasTexture((ctx, s) => {
            ctx.fillStyle = '#8b5a3c';
            ctx.fillRect(0, 0, s, s);
            ctx.strokeStyle = '#6b4423';
            for (let y = 3; y < s; y += 5) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(s, y + (Math.random() * 2 - 1));
                ctx.stroke();
            }
        }, 32);
    }

    pointerToPlayfield(clientX, clientY) {
        if (this.graphics?.screenToPlayfield) {
            const hit = this.graphics.screenToPlayfield(clientX, clientY);
            if (hit) return hit;
        }
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / (rect.width || this.width);
        const scaleY = this.height / (rect.height || this.height);
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    startFallbackLoop() {
        this._useRafLoop = true;
        this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(16.67));
    }

    startGameLoop() {
        const ticker = this.graphics?.getTicker?.();
        if (ticker) {
            this._useRafLoop = false;
            this.tickerCallback = () => this.gameLoop(16.67);
            ticker.add(this.tickerCallback);
        } else {
            this.startFallbackLoop();
        }
    }

    gameLoop(deltaTime) {
        if (this.isDestroyed) return;
        const validDelta = deltaTime > 0 && deltaTime < 100 ? deltaTime : 16.67;
        this.update(validDelta);
        if (!this.isPreview) this.syncVisuals();
        if (this._useRafLoop) {
            this.animationFrameId = requestAnimationFrame(() => this.gameLoop(16.67));
        }
    }

    buildStaticScene() {
        if (!this.sm) return;
        const bg = this.graphics.getLayer('background');
        const fg = this.graphics.getLayer('foreground');
        const ui = this.graphics.getLayer('ui');

        this.roomBg = this.sm.createRect(this.width + 100, this.height + 100, 0x143020, {
            depth: 2, unlit: true, x: -50, y: -50, z: -40
        });
        bg.addChild(this.roomBg);

        this.courseRoot = this.sm.createGroup();
        fg.addChild(this.courseRoot);

        this.dynamicRoot = this.sm.createGroup();
        fg.addChild(this.dynamicRoot);

        this.aimRoot = this.sm.createGroup();
        fg.addChild(this.aimRoot);

        this.uiRoot = this.sm.createGroup();
        ui.addChild(this.uiRoot);
        this.menuRoot = this.sm.createGroup();
        ui.addChild(this.menuRoot);
        this.pauseRoot = this.sm.createGroup();
        ui.addChild(this.pauseRoot);

        this.rebuildPause();
        this.rebuildMenu();
    }

    clearGroup(group) {
        if (!group) return;
        group.removeChildren();
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
        this._holeBuilt = -1;
        this._frameKey = '';
        this._statsKey = '';
        this.rebuildHoleScene();
    }

    rebuildHoleScene() {
        if (!this.sm || !this.courseRoot || !this.currentHoleData) return;
        this.clearGroup(this.courseRoot);
        this.clearGroup(this.dynamicRoot);
        this.windmillViews = [];
        this.gateViews = [];
        this.barrierViews = [];
        this.ballMesh = null;
        this.ballShadow = null;

        const hole = this.currentHoleData;
        const bounds = this.getHoleBounds(hole);

        // Soft apron around course
        this.courseRoot.addChild(this.sm.createRect(
            bounds.w + 80, bounds.h + 80, 0x2a5538, {
                depth: 4, pbr: true, metalness: 0.05, roughness: 0.9,
                x: bounds.x - 40, y: bounds.y - 40, z: -18
            }
        ));

        // Main green
        const grassOpts = {
            depth: 6, pbr: true, metalness: 0.05, roughness: 0.85,
            emissive: 0x0a2810, emissiveIntensity: 0.08,
            x: bounds.x, y: bounds.y, z: -12
        };
        if (this.textureMaps.grass) {
            grassOpts.map = this.textureMaps.grass;
        }
        const green = this.sm.createRect(bounds.w, bounds.h, 0x3f8a4e, grassOpts);
        this.courseRoot.addChild(green);

        // Hazards first (under walls)
        (hole.obstacles || []).forEach((obs) => this.addStaticObstacle(obs));

        // Walls
        (hole.walls || []).forEach((wall) => this.addWall(wall));

        // Cup
        const cupR = hole.holeRadius;
        this.courseRoot.addChild(this.sm.createCircle(cupR * 1.15, 0x0a1008, {
            depth: 4, pbr: true, metalness: 0.2, roughness: 0.7,
            origin: 'center',
            x: hole.holeX, y: hole.holeY, z: -8
        }));
        this.courseRoot.addChild(this.sm.createCircle(cupR * 0.85, 0x050505, {
            depth: 8, pbr: true, metalness: 0.1, roughness: 0.9,
            origin: 'center',
            x: hole.holeX, y: hole.holeY, z: -10
        }));

        // Flag pole + flag
        const pole = this.sm.createRect(2.5, 36, 0xdddddd, {
            depth: 2.5, pbr: true, metalness: 0.6, roughness: 0.3,
            origin: 'center',
            x: hole.holeX + cupR + 4, y: hole.holeY - 10, z: 8
        });
        this.courseRoot.addChild(pole);
        const flag = this.sm.createRect(16, 10, 0xe03030, {
            depth: 1.5, pbr: true, metalness: 0.1, roughness: 0.55,
            emissive: 0x801010, emissiveIntensity: 0.2,
            origin: 'topleft',
            x: hole.holeX + cupR + 5, y: hole.holeY - 26, z: 10
        });
        this.courseRoot.addChild(flag);

        // Break zone hints (subtle)
        (hole.breakZones || []).forEach((zone) => {
            this.courseRoot.addChild(this.sm.createCircle(zone.radius, 0xffffaa, {
                depth: 1, unlit: true, alpha: 0.08,
                origin: 'center',
                x: zone.x, y: zone.y, z: -6
            }));
        });

        // Ball + shadow in dynamic root
        this.ballShadow = this.sm.createCircle(this.ball.radius * 0.95, 0x000000, {
            depth: 1, unlit: true, alpha: 0.3,
            origin: 'center', z: -4
        });
        this.dynamicRoot.addChild(this.ballShadow);

        this.ballMesh = this.sm.createCircle(this.ball.radius, 0xf5f5f5, {
            depth: this.ball.radius * 1.6,
            sphere: true,
            pbr: true,
            metalness: 0.15,
            roughness: 0.35,
            emissive: 0x888888,
            emissiveIntensity: 0.05,
            origin: 'center',
            z: 6
        });
        this.dynamicRoot.addChild(this.ballMesh);

        // Moving obstacle views
        (hole.obstacles || []).forEach((obs) => this.addDynamicObstacle(obs));

        this._holeBuilt = this.currentHole;
        this._frameKey = '';
    }

    getHoleBounds(hole) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        (hole.walls || []).forEach(([x1, y1, x2, y2]) => {
            minX = Math.min(minX, x1, x2);
            minY = Math.min(minY, y1, y2);
            maxX = Math.max(maxX, x1, x2);
            maxY = Math.max(maxY, y1, y2);
        });
        if (!isFinite(minX)) {
            return { x: 40, y: 40, w: this.width - 80, h: this.height - 80 };
        }
        const pad = 8;
        return {
            x: minX - pad,
            y: minY - pad,
            w: (maxX - minX) + pad * 2,
            h: (maxY - minY) + pad * 2
        };
    }

    addWall(wall) {
        const [x1, y1, x2, y2] = wall;
        const dx = x2 - x1, dy = y2 - y1;
        const length = Math.hypot(dx, dy) || 1;
        const angle = Math.atan2(dy, dx);
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const opts = {
            depth: this.wallDepth,
            pbr: true,
            metalness: 0.25,
            roughness: 0.55,
            emissive: 0x2a1808,
            emissiveIntensity: 0.05,
            origin: 'center',
            x: midX,
            y: midY,
            z: 2
        };
        if (this.textureMaps.wood) opts.map = this.textureMaps.wood;
        const mesh = this.sm.createRect(length, this.wallThickness, 0x8b5a3c, opts);
        mesh.rotation = angle;
        this.courseRoot.addChild(mesh);

        // Lighter top cap
        const top = this.sm.createRect(length, this.wallThickness * 0.55, 0xa67c52, {
            depth: 4,
            pbr: true,
            metalness: 0.2,
            roughness: 0.5,
            origin: 'center',
            x: midX,
            y: midY,
            z: this.wallDepth / 2 + 2
        });
        top.rotation = angle;
        this.courseRoot.addChild(top);
    }

    addStaticObstacle(obs) {
        if (obs.type === 'sand') {
            // Flat disc (no cylinder UVs) — warm matte sand
            this.courseRoot.addChild(this.sm.createCircle(obs.radius, 0xe8d4a0, {
                depth: 2.5, segments: 48,
                pbr: true, metalness: 0.04, roughness: 0.92,
                emissive: 0x3a3010, emissiveIntensity: 0.06,
                origin: 'center', x: obs.x, y: obs.y, z: -9
            }));
            this.courseRoot.addChild(this.sm.createCircle(obs.radius * 0.72, 0xd4c090, {
                depth: 2, segments: 40,
                pbr: true, metalness: 0.04, roughness: 0.92,
                origin: 'center', x: obs.x, y: obs.y, z: -8.5
            }));
        } else if (obs.type === 'water') {
            const waterOpts = {
                depth: 3.5, segments: 48,
                pbr: true, metalness: 0.45, roughness: 0.22,
                emissive: 0x0a4060, emissiveIntensity: 0.3,
                origin: 'center', x: obs.x, y: obs.y, z: -9
            };
            if (obs.width && obs.height) {
                this.courseRoot.addChild(this.sm.createRect(obs.width, obs.height, 0x2a88b0, {
                    depth: 3.5, pbr: true, metalness: 0.45, roughness: 0.22,
                    emissive: 0x0a4060, emissiveIntensity: 0.3,
                    origin: 'center', x: obs.x, y: obs.y, z: -9
                }));
            } else {
                this.courseRoot.addChild(this.sm.createCircle(obs.radius, 0x2a88b0, waterOpts));
                this.courseRoot.addChild(this.sm.createCircle(obs.radius * 0.55, 0x4aa8d0, {
                    ...waterOpts, depth: 2, z: -8.2, emissiveIntensity: 0.2
                }));
            }
        } else if (obs.type === 'brick') {
            this.courseRoot.addChild(this.sm.createRect(obs.width || 60, obs.height || 20, 0xb85450, {
                depth: 14, pbr: true, metalness: 0.15, roughness: 0.7,
                origin: 'center', x: obs.x, y: obs.y, z: 2
            }));
        } else if (obs.type === 'plank' || obs.type === 'bridge') {
            const w = obs.width || 80;
            const h = obs.height || 30;
            this.courseRoot.addChild(this.sm.createRect(w, h, 0x8b5a3c, {
                depth: 10, pbr: true, metalness: 0.2, roughness: 0.6,
                map: this.textureMaps.wood,
                origin: 'center', x: obs.x, y: obs.y, z: 1
            }));
        } else if (obs.type === 'ramp' || obs.type === 'slope') {
            const w = obs.width || 80;
            const h = obs.height || 30;
            this.courseRoot.addChild(this.sm.createRect(w, h, 0xa67c52, {
                depth: 12, pbr: true, metalness: 0.15, roughness: 0.6,
                origin: 'center', x: obs.x, y: obs.y, z: 4
            }));
        } else if (obs.type === 'jumpPad') {
            this.courseRoot.addChild(this.sm.createCircle(obs.radius || 25, 0xff6b6b, {
                depth: 8, pbr: true, metalness: 0.3, roughness: 0.4,
                emissive: 0x802020, emissiveIntensity: 0.25,
                origin: 'center', x: obs.x, y: obs.y, z: 2
            }));
        }
    }

    addDynamicObstacle(obs) {
        if (obs.type === 'windmill') {
            const root = this.sm.createGroup({ x: obs.x, y: obs.y, z: 6 });
            root.addChild(this.sm.createCircle(obs.radius * 0.28, 0x8b4513, {
                depth: 12, pbr: true, metalness: 0.2, roughness: 0.55,
                origin: 'center', x: 0, y: 0, z: 0
            }));
            const blades = [];
            for (let i = 0; i < (obs.blades || 4); i++) {
                const blade = this.sm.createRect(obs.radius * 0.85, 5, 0x654321, {
                    depth: 4, pbr: true, metalness: 0.15, roughness: 0.5,
                    origin: 'center', x: obs.radius * 0.45, y: 0, z: 2
                });
                blades.push(blade);
                root.addChild(blade);
            }
            this.dynamicRoot.addChild(root);
            this.windmillViews.push({ root, blades, obs });
        } else if (obs.type === 'movingGate') {
            const gate = this.sm.createRect(obs.width, obs.height, 0x8b4513, {
                depth: 12, pbr: true, metalness: 0.2, roughness: 0.55,
                origin: 'center', x: obs.x, y: obs.y, z: 4
            });
            this.dynamicRoot.addChild(gate);
            this.gateViews.push({ mesh: gate, obs });
        } else if (obs.type === 'rotatingBarrier') {
            const length = obs.length || 80;
            const thickness = obs.thickness || 8;
            const bar = this.sm.createRect(length, thickness, 0xb85450, {
                depth: 12, pbr: true, metalness: 0.15, roughness: 0.65,
                origin: 'center',
                x: obs.pivotX, y: obs.pivotY, z: 4
            });
            this.dynamicRoot.addChild(bar);
            this.barrierViews.push({ mesh: bar, obs });
        }
    }

    syncVisuals() {
        if (!this.graphics?.isInitialized || this.isDestroyed) return;

        const inMenu = this.gameState === 'menu' || this.gameState === 'gameOver';
        if (this.courseRoot) this.courseRoot.visible = !inMenu;
        if (this.dynamicRoot) this.dynamicRoot.visible = !inMenu;
        if (this.aimRoot) this.aimRoot.visible = !inMenu;
        if (this.pauseRoot) this.pauseRoot.visible = this.gameState === 'paused';

        const menuKey = `${this.gameState}:${this.score}`;
        if (this.menuRoot) {
            if (inMenu && menuKey !== this._menuKey) {
                this._menuKey = menuKey;
                this.rebuildMenu();
            }
            this.menuRoot.visible = inMenu;
        }

        if (!inMenu && this.currentHoleData) {
            if (this._holeBuilt !== this.currentHole) this.rebuildHoleScene();
            this.frameCamera();
            this.syncBall();
            this.syncMovers();
            this.syncAim();
            this.syncHud();
            this.updateStatsPanel();
        }
    }

    frameCamera() {
        if (!this.graphics?.framePlayfield || !this.currentHoleData) return;
        const b = this.getHoleBounds(this.currentHoleData);
        const key = `h${this.currentHole}:${b.x}:${b.y}:${b.w}:${b.h}`;
        if (key === this._frameKey) return;
        this._frameKey = key;
        this.graphics.framePlayfield(b.x - 24, b.y - 24, b.w + 48, b.h + 48, 14, 0.18);
    }

    syncBall() {
        if (!this.ballMesh) return;
        this.ballMesh.x = this.ball.x;
        this.ballMesh.y = this.ball.y;
        if (this.ballShadow) {
            this.ballShadow.x = this.ball.x + 2;
            this.ballShadow.y = this.ball.y + 3;
        }
        if (this.sinking.isActive) {
            this.ballMesh.scale = this.sinking.scale;
            this.ballMesh.alpha = this.sinking.alpha;
            this.ballMesh.z = 6 * this.sinking.scale;
            if (this.ballShadow) this.ballShadow.alpha = 0.3 * this.sinking.alpha;
        } else {
            this.ballMesh.scale = 1;
            this.ballMesh.alpha = 1;
            this.ballMesh.z = 6;
            if (this.ballShadow) this.ballShadow.alpha = 0.3;
        }
    }

    syncMovers() {
        this.windmillViews.forEach(({ root, blades, obs }) => {
            const rot = obs.rotation || 0;
            blades.forEach((blade, i) => {
                const angle = rot + (i * Math.PI * 2 / (obs.blades || 4));
                blade.rotation = angle;
                blade.x = Math.cos(angle) * obs.radius * 0.45;
                blade.y = Math.sin(angle) * obs.radius * 0.45;
            });
        });
        this.gateViews.forEach(({ mesh, obs }) => {
            mesh.visible = !obs.isOpen;
        });
        this.barrierViews.forEach(({ mesh, obs }) => {
            mesh.rotation = obs.rotation || 0;
            mesh.x = obs.pivotX;
            mesh.y = obs.pivotY;
        });
    }

    syncAim() {
        this.clearGroup(this.aimRoot);
        if (!this.aiming.isAiming || this.ball.isMoving || !this.sm) return;

        const dx = this.aiming.currentX - this.aiming.startX;
        const dy = this.aiming.currentY - this.aiming.startY;
        const distance = Math.hypot(dx, dy);
        if (distance < this.aiming.minDragDistance) return;

        const power = Math.min(distance / 20, 30);
        const ballAngle = Math.atan2(dy, dx) + Math.PI;
        const lineLength = Math.min(distance, 200);
        const powerColor = power > 6 ? 0xff3333 : power > 3 ? 0xffaa00 : 0x33ff66;

        // Aim direction line
        const aimLen = lineLength;
        const aim = this.sm.createRect(aimLen, 3, 0xffee55, {
            depth: 2, unlit: true, alpha: 0.9,
            origin: 'center',
            x: this.ball.x + Math.cos(ballAngle) * aimLen / 2,
            y: this.ball.y + Math.sin(ballAngle) * aimLen / 2,
            z: 14
        });
        aim.rotation = ballAngle;
        this.aimRoot.addChild(aim);

        const powerLen = power * 15;
        const pLine = this.sm.createRect(powerLen, 5, powerColor, {
            depth: 3, unlit: true,
            origin: 'center',
            x: this.ball.x + Math.cos(ballAngle) * powerLen / 2,
            y: this.ball.y + Math.sin(ballAngle) * powerLen / 2,
            z: 15
        });
        pLine.rotation = ballAngle;
        this.aimRoot.addChild(pLine);

        const label = this.sm.createText(`Power: ${power.toFixed(1)}`, {
            fontSize: 14, fill: powerColor, z: 20, billboard: true
        });
        label.x = this.ball.x + Math.cos(ballAngle) * (powerLen + 24);
        label.y = this.ball.y + Math.sin(ballAngle) * (powerLen + 24);
        this.aimRoot.addChild(label);
    }

    syncHud() {
        // Lightweight: only rebuild warning text when needed via pause/menu roots
        // Hole stats live in DOM panel
        if (!this.uiRoot) return;
        const warnKey = `${this.speedWarning.isActive}:${this.gameState}:${this.currentHole}:${this.strokesOnHole}`;
        if (warnKey === this._hudKey) return;
        this._hudKey = warnKey;
        this.clearGroup(this.uiRoot);

        if (this.gameState !== 'playing' && this.gameState !== 'paused') return;

        if (this.speedWarning.isActive) {
            const warning = this.sm.createText('TOO FAST!', {
                fontSize: 26, fill: 0xff3333, z: 40, billboard: true
            });
            warning.x = this.width / 2;
            warning.y = 48;
            this.uiRoot.addChild(warning);
        }

        const info = this.sm.createText(
            `Hole ${this.currentHole + 1}/18   Strokes: ${this.strokesOnHole}   Total: ${this.score}`,
            { fontSize: 16, fill: 0xffffff, z: 40, billboard: true }
        );
        info.x = 20 + info.width / 2;
        info.y = 28;
        this.uiRoot.addChild(info);

        if (this.currentHoleData) {
            const par = this.sm.createText(`Par: ${this.currentHoleData.par}`, {
                fontSize: 14, fill: 0xaabbcc, z: 40, billboard: true
            });
            par.x = 20 + par.width / 2;
            par.y = 52;
            this.uiRoot.addChild(par);
        }
    }

    rebuildMenu() {
        if (!this.sm || !this.menuRoot) return;
        this.clearGroup(this.menuRoot);
        this.menuRoot.addChild(this.sm.createRect(this.width, this.height, 0x0a1810, {
            depth: 2, unlit: true, alpha: 0.55, x: 0, y: 0, z: 30
        }));
        const isOver = this.gameState === 'gameOver';
        const title = this.sm.createText(isOver ? 'GAME OVER' : 'MINI GOLF', {
            fontSize: isOver ? 42 : 48,
            fill: isOver ? 0xffee55 : 0xffffff,
            z: 40, billboard: true
        });
        title.x = this.width / 2;
        title.y = this.height / 2 - 40;
        this.menuRoot.addChild(title);

        const sub = this.sm.createText(
            isOver ? `Final Score: ${this.score} strokes` : 'Press SPACE to Start',
            { fontSize: isOver ? 20 : 22, fill: 0xcccccc, z: 40, billboard: true }
        );
        sub.x = this.width / 2;
        sub.y = this.height / 2 + 24;
        this.menuRoot.addChild(sub);
    }

    rebuildPause() {
        if (!this.sm || !this.pauseRoot) return;
        this.clearGroup(this.pauseRoot);
        this.pauseRoot.addChild(this.sm.createRect(this.width, this.height, 0x000000, {
            depth: 2, unlit: true, alpha: 0.65, x: 0, y: 0, z: 50
        }));
        const text = this.sm.createText('PAUSED', {
            fontSize: 40, fill: 0xffffff, z: 60, billboard: true
        });
        text.x = this.width / 2;
        text.y = this.height / 2 - 10;
        this.pauseRoot.addChild(text);
        const sub = this.sm.createText('Press P to Resume', {
            fontSize: 18, fill: 0xcccccc, z: 60, billboard: true
        });
        sub.x = this.width / 2;
        sub.y = this.height / 2 + 36;
        this.pauseRoot.addChild(sub);
    }

    cleanup() {
        this.isDestroyed = true;
        if (this.keydownHandler) document.removeEventListener('keydown', this.keydownHandler);
        if (this.keyupHandler) document.removeEventListener('keyup', this.keyupHandler);
        if (this.mouseDownHandler) this.canvas?.removeEventListener('mousedown', this.mouseDownHandler);
        if (this.mouseMoveHandler) this.canvas?.removeEventListener('mousemove', this.mouseMoveHandler);
        if (this.mouseUpHandler) this.canvas?.removeEventListener('mouseup', this.mouseUpHandler);
        if (this.globalMouseMoveHandler) document.removeEventListener('mousemove', this.globalMouseMoveHandler);
        if (this.globalMouseUpHandler) document.removeEventListener('mouseup', this.globalMouseUpHandler);

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.graphics?.getTicker?.() && this.tickerCallback) {
            this.graphics.getTicker().remove(this.tickerCallback);
        }
        this.graphics?.stop?.();
        this.graphics?.destroy?.();
        this.graphics = null;
        this.canvas = null;
        this.currentHoleData = null;
        this.holes = [];
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
        return buildMinigolfHole(holeNumber, margin, courseWidth, courseHeight, this.ball.radius);
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
            
            // Debug mode: Jump to specific holes
            // Numbers 1-9 for holes 1-9, 0 for hole 10, Shift+1-8 for holes 11-18
            if (this.gameState === 'menu' || this.gameState === 'playing' || this.gameState === 'paused') {
                let targetHole = null;
                
                // Check number keys
                if (e.code.startsWith('Digit')) {
                    const digit = parseInt(e.code.replace('Digit', ''));
                    if (e.shiftKey) {
                        // Shift + number = holes 11-18
                        if (digit >= 1 && digit <= 8) {
                            targetHole = 10 + digit; // 11-18
                        }
                    } else {
                        // Regular number = holes 1-10
                        if (digit >= 1 && digit <= 9) {
                            targetHole = digit - 1; // 0-8 (holes 1-9)
                        } else if (digit === 0) {
                            targetHole = 9; // Hole 10
                        }
                    }
                }
                
                if (targetHole !== null && targetHole >= 0 && targetHole < 18) {
                    // Debug: Jump to specific hole
                    this.currentHole = targetHole;
                    this.totalStrokes = 0; // Reset total for debug testing
                    this.loadHole(this.currentHole);
                    this.gameState = 'playing';
                }
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
            
            const { x, y } = this.pointerToPlayfield(e.clientX, e.clientY);
            
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
            
            const pos = this.pointerToPlayfield(e.clientX, e.clientY);
            this.aiming.currentX = pos.x;
            this.aiming.currentY = pos.y;
        };
        
        // Track mouse globally when aiming
        this.globalMouseMoveHandler = (e) => {
            if (!this.aiming.isAiming) return;
            
            const pos = this.pointerToPlayfield(e.clientX, e.clientY);
            this.aiming.currentX = pos.x;
            this.aiming.currentY = pos.y;
        };
        
        this.mouseUpHandler = (e) => {
            if (!this.aiming.isAiming) return;
            
            this.aiming.isAiming = false;
            
            // Ensure we have valid coordinates (allow mouseup outside canvas)
            if (e.clientX !== undefined && e.clientY !== undefined) {
                const pos = this.pointerToPlayfield(e.clientX, e.clientY);
                this.aiming.currentX = pos.x;
                this.aiming.currentY = pos.y;
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
                if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'putt');
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

    update(deltaTime) {
        // Don't update if destroyed
        if (this.isDestroyed) return;
        
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
        
        // Update obstacles (windmills, rotating barriers)
        if (this.currentHoleData && this.currentHoleData.obstacles) {
            this.currentHoleData.obstacles.forEach(obstacle => {
                if (obstacle.type === 'windmill') {
                    obstacle.rotation += obstacle.rotationSpeed;
                } else if (obstacle.type === 'rotatingBarrier') {
                    obstacle.rotation += obstacle.rotationSpeed;
                }
            });
        }
        
        // Update ball physics if moving
        if (this.ball.isMoving && !this.sinking.isActive) {
            // Apply friction
            this.ball.vx *= this.friction;
            this.ball.vy *= this.friction;

            if (this.currentHoleData && this.currentHoleData.breakZones) {
                for (const zone of this.currentHoleData.breakZones) {
                    const d = Utils.distance(this.ball.x, this.ball.y, zone.x, zone.y);
                    if (d < zone.radius) {
                        this.ball.vx += Math.cos(zone.biasAngle) * zone.strength;
                        this.ball.vy += Math.sin(zone.biasAngle) * zone.strength;
                    }
                }
            }
            
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
            
            // Check obstacle collisions (pass old position for water entry detection)
            this.checkObstacleCollisions(oldX, oldY);
            
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
                if (lineLength === 0) continue; // Skip zero-length walls
                
                // Calculate the closest point on the line segment to the collision point
                const lineDx = x2 - x1;
                const lineDy = y2 - y1;
                const toCollisionX = collision.x - x1;
                const toCollisionY = collision.y - y1;
                const t = Math.max(0, Math.min(1, (toCollisionX * lineDx + toCollisionY * lineDy) / (lineLength * lineLength)));
                const closestX = x1 + t * lineDx;
                const closestY = y1 + t * lineDy;
                
                // Calculate vector from closest point on line to collision point (ball center)
                const fromLineX = collision.x - closestX;
                const fromLineY = collision.y - closestY;
                const fromLineDist = Math.sqrt(fromLineX * fromLineX + fromLineY * fromLineY);
                
                // Normal vector pointing from the line toward the ball
                // If ball is exactly on the line (shouldn't happen), use perpendicular vector
                let nx, ny;
                if (fromLineDist > 0.001) {
                    // Normalize the vector from line to ball
                    nx = fromLineX / fromLineDist;
                    ny = fromLineY / fromLineDist;
                } else {
                    // Ball is very close to line, use perpendicular vector
                    // Choose direction based on velocity to push ball back
                    const perpX = -(y2 - y1) / lineLength;
                    const perpY = (x2 - x1) / lineLength;
                    
                    // Determine which side using the old position (before collision)
                    const oldToLineDx = (oldX || ball.x) - x1;
                    const oldToLineDy = (oldY || ball.y) - y1;
                    const crossProd = oldToLineDx * lineDy - oldToLineDy * lineDx;
                    
                    // Normal points away from where ball came from
                    const normalDir = crossProd > 0 ? 1 : -1;
                    nx = normalDir * perpX;
                    ny = normalDir * perpY;
                }
                
                // Move ball to collision point
                ball.x = collision.x;
                ball.y = collision.y;
                
                // Reflect velocity
                const dot = ball.vx * nx + ball.vy * ny;
                ball.vx -= 2 * dot * nx * this.bounceCoefficient;
                ball.vy -= 2 * dot * ny * this.bounceCoefficient;
                if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'bounce');
                
                // Move ball slightly away from wall to prevent stuck
                // Push in the direction of the normal (away from wall)
                const pushDistance = ball.radius - collision.distance + 3; // Extra padding
                ball.x += nx * pushDistance;
                ball.y += ny * pushDistance;
                
                // Safety check: verify ball is now outside the wall
                // If still inside, push it further
                const safetyDist = this.distanceToLineSegment(ball.x, ball.y, x1, y1, x2, y2);
                if (safetyDist < ball.radius) {
                    // Still inside wall - push further out
                    const extraPush = (ball.radius - safetyDist) + 2;
                    ball.x += nx * extraPush;
                    ball.y += ny * extraPush;
                }
            }
        }
        
        // Final safety check: ensure ball isn't inside any wall after all collisions
        // This catches any edge cases where collision was missed
        for (let wall of this.currentHoleData.walls) {
            const [x1, y1, x2, y2] = wall;
            const dist = this.distanceToLineSegment(ball.x, ball.y, x1, y1, x2, y2);
            
            if (dist < ball.radius) {
                // Ball is inside wall - push it out
                const lineLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                if (lineLength === 0) continue;
                
                const lineDx = x2 - x1;
                const lineDy = y2 - y1;
                const toBallX = ball.x - x1;
                const toBallY = ball.y - y1;
                const t = Math.max(0, Math.min(1, (toBallX * lineDx + toBallY * lineDy) / (lineLength * lineLength)));
                const closestX = x1 + t * lineDx;
                const closestY = y1 + t * lineDy;
                
                const fromLineX = ball.x - closestX;
                const fromLineY = ball.y - closestY;
                const fromLineDist = Math.sqrt(fromLineX * fromLineX + fromLineY * fromLineY);
                
                if (fromLineDist > 0.001) {
                    const nx = fromLineX / fromLineDist;
                    const ny = fromLineY / fromLineDist;
                    const pushDist = (ball.radius - dist) + 2;
                    ball.x += nx * pushDist;
                    ball.y += ny * pushDist;
                } else {
                    // Use perpendicular vector
                    const perpX = -(y2 - y1) / lineLength;
                    const perpY = (x2 - x1) / lineLength;
                    const pushDist = ball.radius - dist + 2;
                    // Push in direction away from line center
                    const centerX = (x1 + x2) / 2;
                    const centerY = (y1 + y2) / 2;
                    const toCenterX = ball.x - centerX;
                    const toCenterY = ball.y - centerY;
                    const dot = toCenterX * perpX + toCenterY * perpY;
                    const dir = dot > 0 ? 1 : -1;
                    ball.x += dir * perpX * pushDist;
                    ball.y += dir * perpY * pushDist;
                }
            }
        }
    }

    sweptCircleLineCollision(cx0, cy0, cx1, cy1, radius, x1, y1, x2, y2) {
        // Check along the movement path first with more accurate detection
        const dx = cx1 - cx0;
        const dy = cy1 - cy0;
        const movementDist = Math.sqrt(dx * dx + dy * dy);
        
        // If movement is very small, just check current position
        if (movementDist < 0.1) {
            const currentDist = this.distanceToLineSegment(cx1, cy1, x1, y1, x2, y2);
            if (currentDist < radius) {
                return {
                    x: cx1,
                    y: cy1,
                    distance: currentDist
                };
            }
            return null;
        }
        
        // Use much finer steps - at least 2 steps per radius, up to 50 steps
        // This ensures we catch collisions even at very high speeds
        const minSteps = Math.max(20, Math.ceil(movementDist / (radius * 0.25)));
        const steps = Math.min(minSteps, 50); // Cap at 50 for performance
        
        let firstCollision = null;
        let lastValidPos = { x: cx0, y: cy0, dist: this.distanceToLineSegment(cx0, cy0, x1, y1, x2, y2) };
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const testX = cx0 + dx * t;
            const testY = cy0 + dy * t;
            
            const dist = this.distanceToLineSegment(testX, testY, x1, y1, x2, y2);
            
            if (dist < radius) {
                // Found collision - use previous valid position as collision point
                // Use binary search between last valid and current position for precision
                if (!firstCollision) {
                    firstCollision = this.findExactCollisionPoint(
                        lastValidPos.x, lastValidPos.y, testX, testY, radius, x1, y1, x2, y2
                    );
                }
                
                if (firstCollision) {
                    return firstCollision;
                }
            } else {
                // Still valid - update last valid position
                lastValidPos = { x: testX, y: testY, dist: dist };
            }
        }
        
        // Final check at end position
        const currentDist = this.distanceToLineSegment(cx1, cy1, x1, y1, x2, y2);
        if (currentDist < radius) {
            return {
                x: cx1,
                y: cy1,
                distance: currentDist
            };
        }
        
        return null;
    }

    findExactCollisionPoint(x0, y0, x1, y1, radius, wallX1, wallY1, wallX2, wallY2, iterations = 5) {
        let low = 0;
        let high = 1;
        let bestT = 0;
        
        // Binary search for collision point
        for (let i = 0; i < iterations; i++) {
            const mid = (low + high) / 2;
            const testX = x0 + (x1 - x0) * mid;
            const testY = y0 + (y1 - y0) * mid;
            const dist = this.distanceToLineSegment(testX, testY, wallX1, wallY1, wallX2, wallY2);
            
            if (dist < radius) {
                high = mid;
                bestT = mid;
            } else {
                low = mid;
            }
        }
        
        const collisionX = x0 + (x1 - x0) * bestT;
        const collisionY = y0 + (y1 - y0) * bestT;
        const finalDist = this.distanceToLineSegment(collisionX, collisionY, wallX1, wallY1, wallX2, wallY2);
        
        return {
            x: collisionX,
            y: collisionY,
            distance: finalDist
        };
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

    checkObstacleCollisions(oldX, oldY) {
        if (!this.currentHoleData || !this.currentHoleData.obstacles) return;
        if (!this.ball.isMoving) return;
        
        const ball = this.ball;
        const currentTime = Date.now();
        // Use old position if provided, otherwise fall back to current position
        const prevX = oldX !== undefined ? oldX : ball.x;
        const prevY = oldY !== undefined ? oldY : ball.y;
        
        for (let obstacle of this.currentHoleData.obstacles) {
            // Update obstacle state (gates, rotating barriers)
            if (obstacle.type === 'movingGate') {
                if (!obstacle.lastToggleTime) {
                    obstacle.lastToggleTime = currentTime;
                }
                if (currentTime - obstacle.lastToggleTime >= obstacle.toggleInterval) {
                    obstacle.isOpen = !obstacle.isOpen;
                    obstacle.lastToggleTime = currentTime;
                }
                
                // Check collision with closed gate
                if (!obstacle.isOpen) {
                    const distX = Math.abs(ball.x - obstacle.x);
                    const distY = Math.abs(ball.y - obstacle.y);
                    const halfWidth = obstacle.width / 2;
                    const halfHeight = obstacle.height / 2;
                    
                    if (distX < halfWidth + ball.radius && distY < halfHeight + ball.radius) {
                        // Collision with gate - bounce back
                        const angle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                        ball.vx = -Math.cos(angle) * Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * this.bounceCoefficient;
                        ball.vy = -Math.sin(angle) * Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * this.bounceCoefficient;
                        
                        // Push ball out
                        const overlap = Math.min(halfWidth + ball.radius - distX, halfHeight + ball.radius - distY);
                        ball.x += Math.cos(angle) * overlap;
                        ball.y += Math.sin(angle) * overlap;
                    }
                }
            } else if (obstacle.type === 'windmill') {
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
            } else if (obstacle.type === 'sand') {
                // Sand slows the ball significantly
                const dist = Utils.distance(ball.x, ball.y, obstacle.x, obstacle.y);
                if (dist < obstacle.radius) {
                    // Apply heavy friction - much more impactful
                    this.ball.vx *= 0.88; // Very heavy friction (was 0.92)
                    this.ball.vy *= 0.88;
                    if (!obstacle._sandSoundPlayed) {
                        obstacle._sandSoundPlayed = true;
                        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'sand');
                    }
                } else {
                    obstacle._sandSoundPlayed = false;
                }
            } else if (obstacle.type === 'water') {
                // Water slows the ball and adds drag
                // For Hole 13 and Hole 15, water adds a stroke penalty and resets ball
                const isHole13 = this.currentHole === 12; // Hole 13 is case 12 (0-indexed)
                const isHole15 = this.currentHole === 14; // Hole 15 is case 14 (0-indexed)
                
                let inWater = false;
                let waterEdgeX = ball.x;
                let waterEdgeY = ball.y;
                let wasOutside = true;
                
                if (obstacle.width && obstacle.height) {
                    // Rectangular water
                    const distX = Math.abs(ball.x - obstacle.x);
                    const distY = Math.abs(ball.y - obstacle.y);
                    const prevDistX = Math.abs(prevX - obstacle.x);
                    const prevDistY = Math.abs(prevY - obstacle.y);
                    wasOutside = prevDistX >= obstacle.width / 2 || prevDistY >= obstacle.height / 2;
                    
                    if (distX < obstacle.width / 2 && distY < obstacle.height / 2) {
                        inWater = true;
                        // Find edge where ball entered - use previous position to determine entry
                        if (!obstacle.entryPoint || wasOutside) {
                            // Ball just entered - find entry point on edge
                            // Determine which edge was crossed by checking previous position
                            const dx = ball.x - prevX;
                            const dy = ball.y - prevY;
                            const t = 0; // Parameter for line intersection (start from edge)
                            
                            // Find intersection with water rectangle edges
                            let entryFound = false;
                            // Check top/bottom edges
                            if (dy !== 0) {
                                const tTop = (obstacle.y - obstacle.height / 2 - prevY) / dy;
                                const tBottom = (obstacle.y + obstacle.height / 2 - prevY) / dy;
                                if (tTop >= 0 && tTop <= 1 && prevX + dx * tTop >= obstacle.x - obstacle.width / 2 && 
                                    prevX + dx * tTop <= obstacle.x + obstacle.width / 2) {
                                    waterEdgeX = prevX + dx * tTop;
                                    waterEdgeY = obstacle.y - obstacle.height / 2;
                                    entryFound = true;
                                } else if (tBottom >= 0 && tBottom <= 1 && prevX + dx * tBottom >= obstacle.x - obstacle.width / 2 && 
                                           prevX + dx * tBottom <= obstacle.x + obstacle.width / 2) {
                                    waterEdgeX = prevX + dx * tBottom;
                                    waterEdgeY = obstacle.y + obstacle.height / 2;
                                    entryFound = true;
                                }
                            }
                            // Check left/right edges
                            if (!entryFound && dx !== 0) {
                                const tLeft = (obstacle.x - obstacle.width / 2 - prevX) / dx;
                                const tRight = (obstacle.x + obstacle.width / 2 - prevX) / dx;
                                if (tLeft >= 0 && tLeft <= 1 && prevY + dy * tLeft >= obstacle.y - obstacle.height / 2 && 
                                    prevY + dy * tLeft <= obstacle.y + obstacle.height / 2) {
                                    waterEdgeX = obstacle.x - obstacle.width / 2;
                                    waterEdgeY = prevY + dy * tLeft;
                                    entryFound = true;
                                } else if (tRight >= 0 && tRight <= 1 && prevY + dy * tRight >= obstacle.y - obstacle.height / 2 && 
                                           prevY + dy * tRight <= obstacle.y + obstacle.height / 2) {
                                    waterEdgeX = obstacle.x + obstacle.width / 2;
                                    waterEdgeY = prevY + dy * tRight;
                                    entryFound = true;
                                }
                            }
                            
                            // Fallback: use closest edge if intersection not found
                            if (!entryFound) {
                                const entryAngle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                                const edgeDistX = obstacle.width / 2;
                                const edgeDistY = obstacle.height / 2;
                                if (Math.abs(Math.cos(entryAngle)) > Math.abs(Math.sin(entryAngle))) {
                                    waterEdgeX = obstacle.x + (Math.cos(entryAngle) > 0 ? edgeDistX : -edgeDistX);
                                    waterEdgeY = obstacle.y;
                                } else {
                                    waterEdgeX = obstacle.x;
                                    waterEdgeY = obstacle.y + (Math.sin(entryAngle) > 0 ? edgeDistY : -edgeDistY);
                                }
                            }
                            
                            obstacle.entryPoint = { x: waterEdgeX, y: waterEdgeY };
                        } else {
                            waterEdgeX = obstacle.entryPoint.x;
                            waterEdgeY = obstacle.entryPoint.y;
                        }
                    }
                } else if (obstacle.innerRadius) {
                    // Ring/moat water
                    const dist = Utils.distance(ball.x, ball.y, obstacle.x, obstacle.y);
                    const prevDist = Utils.distance(prevX, prevY, obstacle.x, obstacle.y);
                    wasOutside = prevDist >= obstacle.radius || prevDist <= obstacle.innerRadius;
                    
                    if (dist < obstacle.radius && dist > obstacle.innerRadius) {
                        inWater = true;
                        // Find edge point on outer radius where ball entered
                        if (!obstacle.entryPoint || wasOutside) {
                            // Use direction from previous position to current to find entry point
                            const angle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                            waterEdgeX = obstacle.x + Math.cos(angle) * obstacle.radius;
                            waterEdgeY = obstacle.y + Math.sin(angle) * obstacle.radius;
                            obstacle.entryPoint = { x: waterEdgeX, y: waterEdgeY };
                        } else {
                            waterEdgeX = obstacle.entryPoint.x;
                            waterEdgeY = obstacle.entryPoint.y;
                        }
                    }
                } else {
                    // Circular water
                    const dist = Utils.distance(ball.x, ball.y, obstacle.x, obstacle.y);
                    const prevDist = Utils.distance(prevX, prevY, obstacle.x, obstacle.y);
                    wasOutside = prevDist >= obstacle.radius;
                    
                    if (dist < obstacle.radius) {
                        inWater = true;
                        // Find edge point on circle where ball entered
                        if (!obstacle.entryPoint || wasOutside) {
                            // Use direction from previous position to current to find entry point
                            const angle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                            waterEdgeX = obstacle.x + Math.cos(angle) * obstacle.radius;
                            waterEdgeY = obstacle.y + Math.sin(angle) * obstacle.radius;
                            obstacle.entryPoint = { x: waterEdgeX, y: waterEdgeY };
                        } else {
                            waterEdgeX = obstacle.entryPoint.x;
                            waterEdgeY = obstacle.entryPoint.y;
                        }
                    }
                }
                
                if (inWater) {
                    if (wasOutside && typeof audioManager !== 'undefined') {
                        audioManager.playGameSfx('minigolf', 'water');
                    }
                    if ((isHole13 || isHole15) && !obstacle.penaltyApplied) {
                        // Hole 13 and Hole 15 special penalty: add stroke and reset ball
                        this.strokesOnHole++;
                        this.score++;
                        this.updateStatsPanel();
                        
                        // Reset ball to entry point on water edge
                        ball.x = waterEdgeX;
                        ball.y = waterEdgeY;
                        ball.vx = 0;
                        ball.vy = 0;
                        ball.isMoving = false;
                        
                        obstacle.penaltyApplied = true;
                        
                        // Visual feedback
                        if (!this.isPreview && this.graphics && this.graphics.getScreenEffects) {
                            const screenEffects = this.graphics.getScreenEffects();
                            if (screenEffects) {
                                screenEffects.flash(0xff0000, 8, 0.5);
                                screenEffects.shake(5, 10);
                            }
                        }
                    } else if (!isHole13 && !isHole15) {
                        // Other holes: just heavy water drag
                        this.ball.vx *= 0.90;
                        this.ball.vy *= 0.90;
                    }
                } else {
                    // Ball left water, reset penalty flag
                    if (isHole13 || isHole15) {
                        obstacle.penaltyApplied = false;
                        obstacle.entryPoint = null;
                    }
                }
                
                // Track ball position for entry detection
                obstacle.lastBallX = ball.x;
                obstacle.lastBallY = ball.y;
            } else if (obstacle.type === 'jumpPad') {
                // Jump pad boosts the ball when touched
                const dist = Utils.distance(ball.x, ball.y, obstacle.x, obstacle.y);
                if (dist < (obstacle.radius || 25) + ball.radius) {
                    // Boost ball speed in current direction
                    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                    const angle = Math.atan2(ball.vy, ball.vx);
                    const boost = 3; // Speed boost
                    ball.vx = Math.cos(angle) * (speed + boost);
                    ball.vy = Math.sin(angle) * (speed + boost);
                    
                    // Push ball off pad
                    const overlap = (obstacle.radius || 25) + ball.radius - dist;
                    const padAngle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                    ball.x += Math.cos(padAngle) * overlap;
                    ball.y += Math.sin(padAngle) * overlap;
                }
            } else if (obstacle.type === 'ramp' || obstacle.type === 'slope') {
                // Ramps and slopes affect ball velocity
                const w = obstacle.width || 80;
                const h = obstacle.height || 30;
                const distX = Math.abs(ball.x - obstacle.x);
                const distY = Math.abs(ball.y - obstacle.y);
                
                if (distX < w / 2 && distY < h / 2) {
                    // Ball is on ramp - add acceleration based on ramp angle
                    const angle = obstacle.angle || Math.PI / 6;
                    const gravity = 0.3; // Gravity effect
                    ball.vx += Math.sin(angle) * gravity * Math.cos(angle);
                    ball.vy -= Math.cos(angle) * gravity * Math.sin(angle);
                }
            } else if (obstacle.type === 'brick' || obstacle.type === 'plank') {
                // Rectangular obstacles - check collision
                const distX = Math.abs(ball.x - obstacle.x);
                const distY = Math.abs(ball.y - obstacle.y);
                const halfWidth = (obstacle.width || 60) / 2;
                const halfHeight = (obstacle.height || 20) / 2;
                
                if (distX < halfWidth + ball.radius && distY < halfHeight + ball.radius) {
                    // Collision with rectangular obstacle
                    const angle = Math.atan2(ball.y - obstacle.y, ball.x - obstacle.x);
                    
                    // Determine which side was hit
                    let normalX = 0;
                    let normalY = 0;
                    if (distX / halfWidth > distY / halfHeight) {
                        // Hit vertical side
                        normalX = ball.x > obstacle.x ? 1 : -1;
                    } else {
                        // Hit horizontal side
                        normalY = ball.y > obstacle.y ? 1 : -1;
                    }
                    
                    // Reflect velocity
                    const dot = ball.vx * normalX + ball.vy * normalY;
                    ball.vx -= 2 * dot * normalX * this.bounceCoefficient;
                    ball.vy -= 2 * dot * normalY * this.bounceCoefficient;
                    
                    // Push ball out
                    const overlap = Math.min(halfWidth + ball.radius - distX, halfHeight + ball.radius - distY);
                    ball.x += normalX * overlap;
                    ball.y += normalY * overlap;
                }
            } else if (obstacle.type === 'rotatingBarrier') {
                // Rotating barrier collision
                const length = obstacle.length || 80;
                const thickness = obstacle.thickness || 8;
                const angle = obstacle.rotation || 0;
                const pivotX = obstacle.pivotX || obstacle.x;
                const pivotY = obstacle.pivotY || obstacle.y;
                
                // Calculate barrier endpoints
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const barrierX1 = pivotX + cos * (-length / 2);
                const barrierY1 = pivotY + sin * (-length / 2);
                const barrierX2 = pivotX + cos * (length / 2);
                const barrierY2 = pivotY + sin * (length / 2);
                
                // Check collision with barrier line segment
                const dist = this.distanceToLineSegment(ball.x, ball.y, barrierX1, barrierY1, barrierX2, barrierY2);
                
                if (dist < ball.radius + thickness / 2) {
                    // Collision with rotating barrier
                    const lineAngle = Math.atan2(barrierY2 - barrierY1, barrierX2 - barrierX1);
                    const normalX = -Math.sin(lineAngle);
                    const normalY = Math.cos(lineAngle);
                    
                    // Reflect velocity
                    const dot = ball.vx * normalX + ball.vy * normalY;
                    ball.vx -= 2 * dot * normalX * this.bounceCoefficient;
                    ball.vy -= 2 * dot * normalY * this.bounceCoefficient;
                    
                    // Add rotation influence
                    const tangentSpeed = obstacle.rotationSpeed * length * 10;
                    ball.vx += Math.cos(lineAngle) * tangentSpeed * 0.2;
                    ball.vy += Math.sin(lineAngle) * tangentSpeed * 0.2;
                    
                    // Push ball out
                    const overlap = ball.radius + thickness / 2 - dist;
                    ball.x += normalX * overlap;
                    ball.y += normalY * overlap;
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
                    if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'sink');
                    
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
            } else if (hole.cupLip && speed > this.maxSinkSpeed) {
                const lipAngle = Math.atan2(ball.y - hole.holeY, ball.x - hole.holeX);
                ball.vx = Math.cos(lipAngle) * speed * 0.6;
                ball.vy = Math.sin(lipAngle) * speed * 0.6;
                ball.x = hole.holeX + Math.cos(lipAngle) * (detectionRadius + ball.radius * 0.5);
                ball.y = hole.holeY + Math.sin(lipAngle) * (detectionRadius + ball.radius * 0.5);
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
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('minigolf', 'start');
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
        if (typeof audioManager !== 'undefined') audioManager.playSfx('gameOver');

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
}

function initMinigolf() {
    const canvas = document.getElementById('minigolf-preview');
    if (!canvas) return;
    new MinigolfGame(canvas);
}
