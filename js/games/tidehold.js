// Tidehold — coastal Three.js tower defense
class TideholdGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        this.isPreview = this.width < 400;
        this.onReady = null;
        this.isReady = false;
        this.isDestroyed = false;

        this.gameState = 'menu'; // menu, playing, waveClear, paused, victory, gameOver
        this.score = 0;
        this.gold = 120;
        this.lives = 20;
        this.waveIndex = 0;
        this.mapIndex = 0;
        this.selectedTowerType = 'beacon';
        this.keys = {};

        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.effects = [];
        this.spawnQueue = [];
        this.waveActive = false;
        this.elapsed = 0;
        this._statsDirty = true;
        this._whirlSfxTimer = 0;
        this.intermissionTimer = 0;
        this.intermissionDuration = 0;
        this.mapTransition = false; // true during brief "next map" banner

        this.world = null;
        this.mapRoot = null;
        this.entityRoot = null;
        this.fxRoot = null;
        this.padMeshes = [];
        this.rangeMesh = null;
        this.overlayEl = null;

        this.pointer = { x: 0, y: 0, down: false };
        this._raycaster = null;
        this._pointerNdc = null;
        this._groundPlane = null;

        if (this.isPreview) {
            this.ctx = canvas.getContext('2d');
            this.graphics = null;
            this.drawPreview();
            this.markReady();
            return;
        }

        this.ctx = null;
        this.graphics = new ThreeGraphicsCore(canvas, {
            width: this.width,
            height: this.height,
            backgroundColor: 0x071820,
            cameraMode: 'world3d'
        });

        this.setupInput();
        this.initGraphics();
    }

    markReady() {
        this.isReady = true;
        queueMicrotask(() => {
            if (typeof this.onReady === 'function') this.onReady();
        });
    }

    async initGraphics() {
        try {
            await this.graphics.init();
            if (!this.graphics?.isInitialized || !window.THREE) {
                console.error('Tidehold: Three.js init failed');
                this.markReady();
                return;
            }
            this.finishGraphicsInit();
        } catch (err) {
            console.error('Tidehold init failed:', err);
            this.markReady();
        }
    }

    finishGraphicsInit() {
        const T = window.THREE;
        const scene = this.graphics.scene;

        // Minimal CRT — curvature was clipping the diorama edges
        if (this.graphics.screenEffects) {
            this.graphics.screenEffects.crtScanlineIntensity = 0.025;
            this.graphics.screenEffects.crtCurvature = 0;
            this.graphics.screenEffects.crtVignetteIntensity = 0.08;
        }

        this.world = new T.Group();
        this.world.name = 'tidehold-world';
        scene.add(this.world);

        this.mapRoot = new T.Group();
        this.entityRoot = new T.Group();
        this.fxRoot = new T.Group();
        this.world.add(this.mapRoot, this.entityRoot, this.fxRoot);

        // Warm fill + cool rim for wet-stone look
        const warm = new T.PointLight(0xffc878, 1.35, 90);
        warm.position.set(8, 16, 10);
        this.world.add(warm);
        this._warmLight = warm;

        const cool = new T.PointLight(0x44ccaa, 0.75, 85);
        cool.position.set(-12, 10, -8);
        this.world.add(cool);

        const sky = new T.HemisphereLight(0x88b8c8, 0x1a3038, 0.55);
        this.world.add(sky);

        this._raycaster = new T.Raycaster();
        this._pointerNdc = new T.Vector2();
        this._groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
        this._hit = new T.Vector3();

        this.canvas._tideholdGame = this;
        this.loadMap(0);
        this.createOverlay();
        this.updateOverlay();
        this.updateStatsPanel();

        this.tickerCallback = (payload) => {
            const dtMs = (payload?.deltaTime || 1) * 16.67;
            this.gameLoop(dtMs);
        };
        this.graphics.getTicker().add(this.tickerCallback);
        this.graphics.start();
        this.markReady();
    }

    // --- Map / scene -------------------------------------------------------

    loadMap(index, options = {}) {
        const preserveRun = !!options.preserveRun;
        this.mapIndex = Math.max(0, Math.min(TIDEHOLD_MAPS.length - 1, index));
        this.map = TIDEHOLD_MAPS[this.mapIndex];
        this.waves = tideholdWavesForMap(this.mapIndex);
        this.clearEntities();
        this.buildMapScene();
        this.waveIndex = 0;
        this.waveActive = false;
        this.spawnQueue = [];
        this.elapsed = 0;
        this.selectedTowerId = null;
        this.intermissionTimer = 0;
        this.intermissionDuration = 0;
        this.mapTransition = false;

        if (!preserveRun) {
            this.score = 0;
            this.gold = this.map.startingGold;
            this.lives = this.map.lives;
            this.gameState = 'menu';
        }

        this.fitCamera();
        this._statsDirty = true;
        this.updateOverlay();
        this.updateResourceHud();
    }

    clearEntities() {
        this.enemies.forEach((e) => this.disposeObject(e.mesh));
        this.towers.forEach((t) => this.disposeObject(t.mesh));
        this.projectiles.forEach((p) => this.disposeObject(p.mesh));
        this.effects.forEach((fx) => this.disposeObject(fx.mesh));
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.effects = [];
        this.spawnQueue = [];
        this.padMeshes = [];
        while (this.entityRoot && this.entityRoot.children.length) {
            this.disposeObject(this.entityRoot.children[0]);
        }
        while (this.fxRoot && this.fxRoot.children.length) {
            this.disposeObject(this.fxRoot.children[0]);
        }
        if (this.rangeMesh) {
            this.disposeObject(this.rangeMesh);
            this.rangeMesh = null;
        }
    }

    disposeObject(obj) {
        if (!obj) return;
        if (obj.parent) obj.parent.remove(obj);
        obj.traverse?.((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
                else child.material.dispose();
            }
        });
    }

    buildMapScene() {
        const T = window.THREE;
        while (this.mapRoot.children.length) this.disposeObject(this.mapRoot.children[0]);

        const map = this.map;
        this.graphics.renderer.setClearColor(map.fogColor, 1);
        this.graphics.scene.background = new T.Color(map.fogColor);
        this.graphics.scene.fog = new T.Fog(map.fogColor, map.fogNear, map.fogFar);

        if (this.graphics.lights?.ambient) {
            this.graphics.lights.ambient.color.setHex(map.ambient);
            this.graphics.lights.ambient.intensity = 1.05;
        }
        if (this.graphics.lights?.key) {
            this.graphics.lights.key.color.setHex(map.keyColor);
            this.graphics.lights.key.intensity = 1.55;
            this.graphics.lights.key.position.set(35, 70, 25);
        }

        // Bright teal ocean — high contrast vs dark shelf
        const waterMat = new T.MeshStandardMaterial({
            color: 0x1a8a9a,
            roughness: 0.16,
            metalness: 0.5,
            emissive: 0x0a6070,
            emissiveIntensity: 0.45
        });
        const ocean = new T.Mesh(new T.CircleGeometry(36, 72), waterMat);
        ocean.rotation.x = -Math.PI / 2;
        ocean.position.y = -0.55;
        this.mapRoot.add(ocean);
        this._ocean = ocean;

        // Bright foam collar
        const foam = new T.Mesh(
            new T.RingGeometry(12.4, 14.2, 64),
            new T.MeshBasicMaterial({ color: 0xe8f6fa, transparent: true, opacity: 0.55, side: T.DoubleSide })
        );
        foam.rotation.x = -Math.PI / 2;
        foam.position.y = -0.28;
        this.mapRoot.add(foam);
        this._foam = foam;

        // Dark wet shelf — sized to fit fully in the pulled-back camera
        const shelf = new T.Mesh(
            new T.CylinderGeometry(12.2, 13.2, 0.85, 56),
            new T.MeshStandardMaterial({
                color: 0x1a222c,
                roughness: 0.82,
                metalness: 0.22,
                emissive: 0x081018,
                emissiveIntensity: 0.2
            })
        );
        shelf.position.y = -0.05;
        this.mapRoot.add(shelf);

        // Subtle tile rings for depth
        for (let r = 4; r <= 10; r += 3) {
            const ring = new T.Mesh(
                new T.RingGeometry(r - 0.06, r + 0.06, 48),
                new T.MeshBasicMaterial({ color: 0x2a3848, transparent: true, opacity: 0.35, side: T.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.02;
            this.mapRoot.add(ring);
        }

        this.padMeshes = [];
        map.paths.forEach((path, pi) => this.buildPathRibbon(path, pi));
        map.pads.forEach((pad, i) => {
            const padGroup = this.createPadMesh(pad, i);
            this.mapRoot.add(padGroup);
            this.padMeshes.push(padGroup);
        });

        (map.lanterns || []).forEach((L) => this.mapRoot.add(this.createLantern(L.x, L.z)));

        if (map.atmosphere === 'kelp') this.scatterKelp();
        if (map.atmosphere === 'abyss') this.buildCliffRing();
        if (map.atmosphere === 'open') this.scatterRocks();

        const end = map.paths[0][map.paths[0].length - 1];
        this.mapRoot.add(this.createShrine(end.x, end.z));
        const start = map.paths[0][0];
        this.mapRoot.add(this.createGate(start.x, start.z, 'SPAWN'));
    }

    buildPathRibbon(path, pathIndex) {
        const T = window.THREE;
        // Warm sandstone path — high contrast vs dark shelf
        const mat = new T.MeshStandardMaterial({
            color: pathIndex === 0 ? 0xc4b49a : 0xa8c4b8,
            roughness: 0.42,
            metalness: 0.08,
            emissive: pathIndex === 0 ? 0x3a3020 : 0x1a3028,
            emissiveIntensity: 0.18
        });
        const wallMat = new T.MeshStandardMaterial({
            color: 0x6a5a48,
            roughness: 0.7,
            metalness: 0.1,
            emissive: 0x1a1510,
            emissiveIntensity: 0.1
        });
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i];
            const b = path[i + 1];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const len = Math.hypot(dx, dz);
            const midX = (a.x + b.x) / 2;
            const midZ = (a.z + b.z) / 2;
            const yaw = Math.atan2(dx, dz);

            const seg = new T.Mesh(new T.BoxGeometry(2.1, 0.35, len + 0.45), mat);
            seg.position.set(midX, 0.22, midZ);
            seg.rotation.y = yaw;
            this.mapRoot.add(seg);

            // Jetty side walls
            [-1.15, 1.15].forEach((side) => {
                const wall = new T.Mesh(new T.BoxGeometry(0.22, 0.55, len + 0.4), wallMat);
                const ox = Math.cos(yaw) * side;
                const oz = -Math.sin(yaw) * side;
                wall.position.set(midX + ox, 0.35, midZ + oz);
                wall.rotation.y = yaw;
                this.mapRoot.add(wall);
            });

            const foam = new T.Mesh(
                new T.BoxGeometry(2.45, 0.05, len + 0.3),
                new T.MeshBasicMaterial({ color: 0xd8f0f8, transparent: true, opacity: 0.4 })
            );
            foam.position.set(midX, 0.05, midZ);
            foam.rotation.y = yaw;
            this.mapRoot.add(foam);
        }

        // Path joints
        path.forEach((p) => {
            const joint = new T.Mesh(
                new T.CylinderGeometry(1.05, 1.1, 0.38, 12),
                mat
            );
            joint.position.set(p.x, 0.2, p.z);
            this.mapRoot.add(joint);
        });
    }

    createPadMesh(pad, index) {
        const T = window.THREE;
        const g = new T.Group();
        g.position.set(pad.x, 0, pad.z);
        g.userData = { padIndex: index, kind: 'pad' };

        const hit = new T.Mesh(
            new T.CylinderGeometry(2.0, 2.0, 1.4, 16),
            new T.MeshBasicMaterial({ visible: false })
        );
        hit.position.y = 0.7;
        hit.userData = { padIndex: index, kind: 'pad' };
        g.add(hit);

        const plinth = new T.Mesh(
            new T.CylinderGeometry(1.35, 1.5, 0.35, 24),
            new T.MeshStandardMaterial({
                color: 0x8a6a2a,
                metalness: 0.65,
                roughness: 0.3,
                emissive: 0x553308,
                emissiveIntensity: 0.35
            })
        );
        plinth.position.y = 0.28;
        plinth.userData = { padIndex: index, kind: 'pad' };
        g.add(plinth);

        const ring = new T.Mesh(
            new T.TorusGeometry(1.2, 0.08, 10, 32),
            new T.MeshStandardMaterial({
                color: 0xffd078,
                emissive: 0xffaa33,
                emissiveIntensity: 0.85,
                metalness: 0.8,
                roughness: 0.25
            })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.48;
        ring.userData = { padIndex: index, kind: 'pad', padRing: true };
        g.add(ring);

        const glow = new T.Mesh(
            new T.CircleGeometry(1.0, 24),
            new T.MeshBasicMaterial({ color: 0xffc050, transparent: true, opacity: 0.55, side: T.DoubleSide })
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.5;
        glow.userData = { padIndex: index, kind: 'pad', padGlow: true };
        g.add(glow);

        // Floating marker so empty pads read instantly
        const marker = new T.Mesh(
            new T.OctahedronGeometry(0.28, 0),
            new T.MeshStandardMaterial({
                color: 0xffe0a0,
                emissive: 0xffaa44,
                emissiveIntensity: 0.9,
                metalness: 0.4,
                roughness: 0.3
            })
        );
        marker.position.y = 1.35;
        marker.userData = { padIndex: index, kind: 'pad', padMarker: true };
        g.add(marker);
        g.userData.marker = marker;
        g.userData.ring = ring;
        g.userData.glow = glow;

        return g;
    }

    createGate(x, z) {
        const T = window.THREE;
        const g = new T.Group();
        g.position.set(x, 0, z);
        const mat = new T.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.65, metalness: 0.25 });
        [-1.4, 1.4].forEach((sx) => {
            const pillar = new T.Mesh(new T.BoxGeometry(0.45, 2.4, 0.45), mat);
            pillar.position.set(sx, 1.2, 0);
            g.add(pillar);
        });
        const lintel = new T.Mesh(new T.BoxGeometry(3.3, 0.35, 0.45), mat);
        lintel.position.y = 2.5;
        g.add(lintel);
        const light = new T.PointLight(0x66ffcc, 0.7, 10);
        light.position.y = 2.2;
        g.add(light);
        return g;
    }

    createLantern(x, z) {
        const T = window.THREE;
        const g = new T.Group();
        g.position.set(x, 0, z);
        const pole = new T.Mesh(
            new T.CylinderGeometry(0.08, 0.1, 2.4, 6),
            new T.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.4, roughness: 0.6 })
        );
        pole.position.y = 1.2;
        g.add(pole);
        const lamp = new T.Mesh(
            new T.SphereGeometry(0.28, 12, 12),
            new T.MeshStandardMaterial({
                color: 0xffcc66,
                emissive: 0xffaa33,
                emissiveIntensity: 0.9,
                roughness: 0.3
            })
        );
        lamp.position.y = 2.45;
        g.add(lamp);
        const light = new T.PointLight(0xffb860, 0.85, 12);
        light.position.y = 2.45;
        g.add(light);
        return g;
    }

    createShrine(x, z) {
        const T = window.THREE;
        const g = new T.Group();
        g.position.set(x, 0, z);
        const base = new T.Mesh(
            new T.CylinderGeometry(1.4, 1.6, 0.5, 8),
            new T.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.75 })
        );
        base.position.y = 0.25;
        g.add(base);
        const pillar = new T.Mesh(
            new T.CylinderGeometry(0.45, 0.55, 2.2, 8),
            new T.MeshStandardMaterial({ color: 0x5a6570, roughness: 0.7 })
        );
        pillar.position.y = 1.4;
        g.add(pillar);
        const gem = new T.Mesh(
            new T.OctahedronGeometry(0.45, 0),
            new T.MeshStandardMaterial({
                color: 0x66ffdd,
                emissive: 0x22ddaa,
                emissiveIntensity: 0.7,
                roughness: 0.25,
                metalness: 0.4
            })
        );
        gem.position.y = 2.7;
        g.add(gem);
        const light = new T.PointLight(0x44ffcc, 1.2, 16);
        light.position.y = 2.7;
        g.add(light);
        this._shrineGem = gem;
        return g;
    }

    scatterKelp() {
        const T = window.THREE;
        const mat = new T.MeshStandardMaterial({
            color: 0x1a6a4a,
            emissive: 0x0a3a2a,
            emissiveIntensity: 0.25,
            roughness: 0.7
        });
        for (let i = 0; i < 40; i++) {
            const h = 2 + Math.random() * 4;
            const kelp = new T.Mesh(new T.CylinderGeometry(0.08, 0.14, h, 5), mat);
            const ang = Math.random() * Math.PI * 2;
            const r = 5 + Math.random() * 9;
            kelp.position.set(Math.cos(ang) * r, h / 2, Math.sin(ang) * r);
            kelp.rotation.z = (Math.random() - 0.5) * 0.25;
            kelp.userData.sway = Math.random() * Math.PI * 2;
            this.mapRoot.add(kelp);
            if (!this._kelp) this._kelp = [];
            this._kelp.push(kelp);
        }
    }

    buildCliffRing() {
        const T = window.THREE;
        const mat = new T.MeshStandardMaterial({
            color: 0x2a343e, roughness: 0.88, metalness: 0.08, emissive: 0x0a1018, emissiveIntensity: 0.15
        });
        for (let i = 0; i < 18; i++) {
            const ang = (i / 18) * Math.PI * 2;
            const r = 12.0 + (i % 3) * 0.9;
            const h = 2.8 + (i % 5) * 1.1;
            const rock = new T.Mesh(new T.CylinderGeometry(0.9, 1.4, h, 6), mat);
            rock.position.set(Math.cos(ang) * r, h / 2 - 0.4, Math.sin(ang) * r);
            rock.rotation.y = ang + 0.2;
            rock.rotation.z = (Math.random() - 0.5) * 0.15;
            this.mapRoot.add(rock);
        }
    }

    scatterRocks() {
        const T = window.THREE;
        const mats = [
            new T.MeshStandardMaterial({ color: 0x3a4550, roughness: 0.8, metalness: 0.1 }),
            new T.MeshStandardMaterial({ color: 0x4a5a48, roughness: 0.75, metalness: 0.08 }),
            new T.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.78, metalness: 0.12 })
        ];
        for (let i = 0; i < 22; i++) {
            const rock = new T.Mesh(
                new T.IcosahedronGeometry(0.35 + Math.random() * 0.7, 0),
                mats[i % mats.length]
            );
            const ang = Math.random() * Math.PI * 2;
            const r = 6 + Math.random() * 5.5;
            rock.position.set(Math.cos(ang) * r, 0.25, Math.sin(ang) * r);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.scale.set(1, 0.55 + Math.random() * 0.6, 1);
            this.mapRoot.add(rock);
        }
    }

    fitCamera() {
        const c = this.map.camera;
        const cam = this.graphics.camera;
        cam.position.set(c.x, c.y, c.z);
        cam.lookAt(c.lookX, c.lookY, c.lookZ);
        cam.near = 0.5;
        cam.far = 250;
        cam.fov = c.fov || 40;
        cam.updateProjectionMatrix();

        // Prefer a filled frame — allow slight shelf edge near the border
        const shelfR = 12.5;
        const dist = cam.position.length();
        const needFov = window.THREE.MathUtils.radToDeg(2 * Math.atan((shelfR * 1.02) / Math.max(dist, 1)));
        cam.fov = Math.max(42, Math.min(52, Math.max(cam.fov, needFov)));
        cam.updateProjectionMatrix();
    }

    // --- Towers / enemies meshes -------------------------------------------

    createTowerMesh(type, level, branchId = null) {
        const T = window.THREE;
        const def = TIDEHOLD_TOWERS[type];
        const branch = branchId && def.branches[branchId] ? def.branches[branchId] : null;
        const accent = branch ? branch.accent : def.emissive;
        const g = new T.Group();
        const s = 1.15 + (level - 1) * 0.18;

        const stone = new T.MeshStandardMaterial({
            color: 0x8a949e, roughness: 0.48, metalness: 0.35, emissive: 0x1a2228, emissiveIntensity: 0.12
        });
        const brass = new T.MeshStandardMaterial({
            color: 0xd4b060, metalness: 0.82, roughness: 0.28, emissive: 0x664410, emissiveIntensity: 0.28
        });
        const glowGlass = new T.MeshStandardMaterial({
            color: 0xfff0c8,
            emissive: accent,
            emissiveIntensity: 1.15,
            metalness: 0.2,
            roughness: 0.2,
            transparent: true,
            opacity: 0.88
        });

        if (type === 'beacon') {
            // Stepped plinth
            const plinthLo = new T.Mesh(new T.CylinderGeometry(0.85 * s, 1.0 * s, 0.28 * s, 12), stone);
            plinthLo.position.y = 0.14 * s;
            g.add(plinthLo);
            const plinthHi = new T.Mesh(new T.CylinderGeometry(0.65 * s, 0.75 * s, 0.35 * s, 12), brass);
            plinthHi.position.y = 0.4 * s;
            g.add(plinthHi);
            // Tapered lighthouse body with bands
            const shaft = new T.Mesh(new T.CylinderGeometry(0.32 * s, 0.48 * s, 2.4 * s, 12), stone);
            shaft.position.y = 1.55 * s;
            g.add(shaft);
            for (let i = 0; i < 3; i++) {
                const band = new T.Mesh(new T.TorusGeometry(0.42 * s - i * 0.04 * s, 0.05 * s, 6, 20), brass);
                band.rotation.x = Math.PI / 2;
                band.position.y = (0.9 + i * 0.7) * s;
                g.add(band);
            }
            // Window slits
            for (let i = 0; i < 4; i++) {
                const win = new T.Mesh(
                    new T.BoxGeometry(0.12 * s, 0.35 * s, 0.06 * s),
                    new T.MeshStandardMaterial({ color: 0x111820, emissive: accent, emissiveIntensity: 0.35 })
                );
                const a = (i / 4) * Math.PI * 2 + 0.4;
                win.position.set(Math.cos(a) * 0.4 * s, 1.6 * s, Math.sin(a) * 0.4 * s);
                win.rotation.y = -a;
                g.add(win);
            }
            // Lantern house
            const deck = new T.Mesh(new T.CylinderGeometry(0.62 * s, 0.62 * s, 0.12 * s, 12), brass);
            deck.position.y = 2.75 * s;
            g.add(deck);
            const posts = 6;
            for (let i = 0; i < posts; i++) {
                const post = new T.Mesh(new T.CylinderGeometry(0.035 * s, 0.035 * s, 0.7 * s, 5), brass);
                const a = (i / posts) * Math.PI * 2;
                post.position.set(Math.cos(a) * 0.5 * s, 3.1 * s, Math.sin(a) * 0.5 * s);
                g.add(post);
            }
            const rail = new T.Mesh(new T.TorusGeometry(0.52 * s, 0.04 * s, 6, 20), brass);
            rail.rotation.x = Math.PI / 2;
            rail.position.y = 3.4 * s;
            g.add(rail);
            const house = new T.Mesh(new T.CylinderGeometry(0.45 * s, 0.45 * s, 0.85 * s, 12), glowGlass);
            house.position.y = 3.25 * s;
            g.add(house);
            const flame = new T.Mesh(
                new T.SphereGeometry(0.22 * s, 12, 12),
                new T.MeshStandardMaterial({ color: 0xffffff, emissive: accent, emissiveIntensity: 1.6 })
            );
            flame.position.y = 3.25 * s;
            g.add(flame);
            g.userData.muzzle = flame;
            const roof = new T.Mesh(new T.ConeGeometry(0.65 * s, 0.55 * s, 10), brass);
            roof.position.y = 3.9 * s;
            g.add(roof);
            const finial = new T.Mesh(new T.SphereGeometry(0.1 * s, 8, 8), brass);
            finial.position.y = 4.2 * s;
            g.add(finial);
            const light = new T.PointLight(accent, 1.6 + level * 0.35, 16);
            light.position.y = 3.25 * s;
            g.add(light);
            // Kelp drapes
            for (let i = 0; i < 4; i++) {
                const kelp = new T.Mesh(
                    new T.ConeGeometry(0.12 * s, 1.4 * s, 5),
                    new T.MeshStandardMaterial({ color: 0x2d8a58, roughness: 0.7, emissive: 0x0a4028, emissiveIntensity: 0.25 })
                );
                const a = (i / 4) * Math.PI * 2;
                kelp.position.set(Math.cos(a) * 0.55 * s, 0.9 * s, Math.sin(a) * 0.55 * s);
                kelp.rotation.z = Math.cos(a) * 0.45;
                kelp.rotation.x = Math.sin(a) * 0.45;
                g.add(kelp);
            }
        } else if (type === 'mortar') {
            const base = new T.Mesh(new T.CylinderGeometry(0.95 * s, 1.15 * s, 0.5 * s, 12), stone);
            base.position.y = 0.25 * s;
            g.add(base);
            const coralMat = new T.MeshStandardMaterial({
                color: 0xe07088, roughness: 0.5, emissive: 0x501020, emissiveIntensity: 0.2
            });
            const coralMat2 = new T.MeshStandardMaterial({
                color: 0xff98a8, roughness: 0.45, emissive: 0x602030, emissiveIntensity: 0.25
            });
            for (let i = 0; i < 8; i++) {
                const h = (0.9 + (i % 3) * 0.35) * s;
                const branchMesh = new T.Mesh(new T.ConeGeometry(0.14 * s, h, 6), i % 2 ? coralMat : coralMat2);
                const a = (i / 8) * Math.PI * 2;
                branchMesh.position.set(Math.cos(a) * 0.75 * s, 0.45 * s + h * 0.35, Math.sin(a) * 0.75 * s);
                branchMesh.rotation.z = Math.cos(a) * 0.55;
                branchMesh.rotation.x = Math.sin(a) * 0.55;
                g.add(branchMesh);
                // secondary nub
                const nub = new T.Mesh(new T.SphereGeometry(0.12 * s, 8, 8), coralMat2);
                nub.position.set(Math.cos(a) * 0.55 * s, 0.55 * s, Math.sin(a) * 0.55 * s);
                g.add(nub);
            }
            const bowl = new T.Mesh(
                new T.SphereGeometry(0.58 * s, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
                new T.MeshStandardMaterial({
                    color: 0x163e40, emissive: accent, emissiveIntensity: 0.7,
                    side: T.DoubleSide, metalness: 0.3, roughness: 0.3
                })
            );
            bowl.position.y = 1.35 * s;
            g.add(bowl);
            const rim = new T.Mesh(new T.TorusGeometry(0.55 * s, 0.06 * s, 8, 20), brass);
            rim.rotation.x = Math.PI / 2;
            rim.position.y = 1.55 * s;
            g.add(rim);
            const orb = new T.Mesh(
                new T.SphereGeometry(0.28 * s, 14, 14),
                new T.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4 })
            );
            orb.position.y = 1.55 * s;
            g.add(orb);
            g.userData.orb = orb;
            g.userData.muzzle = orb;
            const light = new T.PointLight(accent, 1.1, 12);
            light.position.y = 1.55 * s;
            g.add(light);
        } else {
            // Whirlpool well — raised stone ring with inner vortex volume
            const plinth = new T.Mesh(new T.CylinderGeometry(1.25 * s, 1.4 * s, 0.35 * s, 16), stone);
            plinth.position.y = 0.18 * s;
            g.add(plinth);
            const outer = new T.Mesh(
                new T.TorusGeometry(1.05 * s, 0.22 * s, 14, 32),
                new T.MeshStandardMaterial({
                    color: 0x6a8090, emissive: accent, emissiveIntensity: 0.65, metalness: 0.5, roughness: 0.3
                })
            );
            outer.rotation.x = Math.PI / 2;
            outer.position.y = 0.4 * s;
            g.add(outer);
            for (let i = 0; i < 10; i++) {
                const tick = new T.Mesh(
                    new T.BoxGeometry(0.1 * s, 0.08 * s, 0.28 * s),
                    new T.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.0 })
                );
                const a = (i / 10) * Math.PI * 2;
                tick.position.set(Math.cos(a) * 1.05 * s, 0.48 * s, Math.sin(a) * 1.05 * s);
                tick.rotation.y = a;
                g.add(tick);
            }
            const water = new T.Mesh(
                new T.CircleGeometry(0.9 * s, 32),
                new T.MeshStandardMaterial({
                    color: 0x1a99aa, emissive: accent, emissiveIntensity: 0.85,
                    roughness: 0.15, metalness: 0.5, side: T.DoubleSide
                })
            );
            water.rotation.x = -Math.PI / 2;
            water.position.y = 0.38 * s;
            g.add(water);
            g.userData.spin = water;
            // Rising spiral ribbons
            for (let i = 0; i < 3; i++) {
                const ribbon = new T.Mesh(
                    new T.TorusGeometry(0.35 * s + i * 0.12 * s, 0.04 * s, 6, 24, Math.PI * 1.4),
                    new T.MeshStandardMaterial({
                        color: accent, emissive: accent, emissiveIntensity: 0.9, transparent: true, opacity: 0.75
                    })
                );
                ribbon.position.y = 0.55 * s + i * 0.25 * s;
                ribbon.rotation.x = Math.PI / 2;
                ribbon.rotation.z = i * 0.8;
                g.add(ribbon);
                if (!g.userData.ribbons) g.userData.ribbons = [];
                g.userData.ribbons.push(ribbon);
            }
            const light = new T.PointLight(accent, 1.0, 12);
            light.position.y = 0.8 * s;
            g.add(light);
        }

        // Level gem pips
        for (let i = 0; i < level; i++) {
            const pip = new T.Mesh(
                new T.OctahedronGeometry(0.12 * s, 0),
                new T.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.1 })
            );
            pip.position.set((i - (level - 1) / 2) * 0.28 * s, 0.12 * s, 1.45 * s);
            g.add(pip);
        }

        return g;
    }

    createEnemyMesh(type) {
        const T = window.THREE;
        const def = TIDEHOLD_ENEMIES[type];
        const g = new T.Group();
        const s = def.scale;

        if (type === 'sailor') {
            const bodyGeo = T.CapsuleGeometry
                ? new T.CapsuleGeometry(0.28 * s, 0.55 * s, 4, 8)
                : new T.CylinderGeometry(0.28 * s, 0.28 * s, 0.9 * s, 8);
            const body = new T.Mesh(
                bodyGeo,
                new T.MeshStandardMaterial({ color: def.color, roughness: 0.75 })
            );
            body.position.y = 0.7 * s;
            g.add(body);
            const head = new T.Mesh(
                new T.SphereGeometry(0.22 * s, 10, 10),
                new T.MeshStandardMaterial({
                    color: 0x6a8a7a,
                    emissive: 0x22aacc,
                    emissiveIntensity: 0.35,
                    roughness: 0.6
                })
            );
            head.position.y = 1.25 * s;
            g.add(head);
            const coat = new T.Mesh(
                new T.ConeGeometry(0.42 * s, 0.7 * s, 6),
                new T.MeshStandardMaterial({ color: 0x1a3a5a, roughness: 0.8 })
            );
            coat.position.y = 0.55 * s;
            g.add(coat);
        } else if (type === 'crab') {
            const shell = new T.Mesh(
                new T.SphereGeometry(0.4 * s, 10, 8),
                new T.MeshStandardMaterial({ color: def.color, roughness: 0.7 })
            );
            shell.scale.set(1.3, 0.55, 1.1);
            shell.position.y = 0.35 * s;
            g.add(shell);
            for (let i = 0; i < 6; i++) {
                const leg = new T.Mesh(
                    new T.CylinderGeometry(0.04 * s, 0.04 * s, 0.55 * s, 4),
                    new T.MeshStandardMaterial({ color: 0x6a4a28 })
                );
                const a = (i / 6) * Math.PI * 2;
                leg.position.set(Math.cos(a) * 0.4 * s, 0.2 * s, Math.sin(a) * 0.4 * s);
                leg.rotation.z = Math.cos(a) * 0.7;
                leg.rotation.x = Math.sin(a) * 0.7;
                g.add(leg);
            }
            const claw = new T.Mesh(
                new T.BoxGeometry(0.25 * s, 0.12 * s, 0.35 * s),
                new T.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.3, roughness: 0.5 })
            );
            claw.position.set(0.45 * s, 0.35 * s, 0.2 * s);
            g.add(claw);
        } else {
            const bodyGeo = T.CapsuleGeometry
                ? new T.CapsuleGeometry(0.4 * s, 1.1 * s, 6, 10)
                : new T.CylinderGeometry(0.4 * s, 0.4 * s, 1.6 * s, 10);
            const body = new T.Mesh(
                bodyGeo,
                new T.MeshStandardMaterial({
                    color: def.color,
                    emissive: 0x113344,
                    emissiveIntensity: 0.35,
                    roughness: 0.55,
                    metalness: 0.25
                })
            );
            body.rotation.z = Math.PI / 2;
            body.position.y = 0.55 * s;
            g.add(body);
            const head = new T.Mesh(
                new T.ConeGeometry(0.35 * s, 0.7 * s, 7),
                new T.MeshStandardMaterial({
                    color: 0x0a1520,
                    emissive: 0x2288aa,
                    emissiveIntensity: 0.4
                })
            );
            head.rotation.z = -Math.PI / 2;
            head.position.set(0.9 * s, 0.55 * s, 0);
            g.add(head);
            for (let i = 0; i < 4; i++) {
                const plate = new T.Mesh(
                    new T.BoxGeometry(0.35 * s, 0.12 * s, 0.5 * s),
                    new T.MeshStandardMaterial({ color: 0x3a4a55, metalness: 0.4, roughness: 0.5 })
                );
                plate.position.set(-0.2 * s + i * 0.25 * s, 0.85 * s, 0);
                g.add(plate);
            }
        }

        // HP bar billboard
        const barBg = new T.Mesh(
            new T.PlaneGeometry(0.9, 0.1),
            new T.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthTest: false })
        );
        barBg.position.y = 1.6 * s;
        g.add(barBg);
        const bar = new T.Mesh(
            new T.PlaneGeometry(0.86, 0.07),
            new T.MeshBasicMaterial({ color: 0x44ddaa, depthTest: false })
        );
        bar.position.y = 1.6 * s;
        bar.position.z = 0.01;
        g.add(bar);
        g.userData.hpBar = bar;
        g.userData.hpBarBg = barBg;

        return g;
    }

    // --- Game flow ---------------------------------------------------------

    startGame() {
        if (this.gameState === 'playing' || this.gameState === 'waveClear') return;
        // Full campaign always begins at Breakwater
        this.loadMap(0);
        this.score = 0;
        this.gold = this.map.startingGold;
        this.lives = this.map.lives;
        this.waveIndex = 0;
        this.waveActive = false;
        this.spawnQueue = [];
        this.mapTransition = false;
        this.beginIntermission(6.5); // opening build window, then auto-wave
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'start');
        this._statsDirty = true;
        this.updateOverlay();
        this.updateStatsPanel();
        this.updateResourceHud();
    }

    beginIntermission(seconds) {
        this.gameState = 'waveClear';
        this.intermissionDuration = seconds;
        this.intermissionTimer = seconds;
        this.updateOverlay();
        this._statsDirty = true;
    }

    startNextWave() {
        if (this.gameState !== 'playing' && this.gameState !== 'waveClear') return;
        if (this.mapTransition) return;
        if (this.waveActive || this.enemies.length > 0 || this.spawnQueue.length > 0) return;
        if (this.waveIndex >= this.waves.length) {
            this.onMapCleared();
            return;
        }

        const wave = this.waves[this.waveIndex];
        this.spawnQueue = [];
        let t = 0;
        wave.groups.forEach((group) => {
            t += group.delay || 0;
            for (let i = 0; i < group.count; i++) {
                this.spawnQueue.push({
                    at: t + i * group.interval,
                    type: group.type,
                    hpScale: group.hpScale || 1
                });
            }
        });
        this.spawnQueue.sort((a, b) => a.at - b.at);
        this.waveClock = 0;
        this.waveActive = true;
        this.intermissionTimer = 0;
        this.intermissionDuration = 0;
        this.gameState = 'playing';
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'wave');
        this._statsDirty = true;
        this.updateOverlay();
        this.updateResourceHud();
    }

    onMapCleared() {
        this.score += 250 + this.mapIndex * 150;
        this.gold += 40 + this.mapIndex * 20;
        if (this.mapIndex >= TIDEHOLD_MAPS.length - 1) {
            this.victory();
            return;
        }

        // Brief banner, then load next map with a build window
        this.mapTransition = true;
        this.gameState = 'waveClear';
        this.intermissionDuration = 3.2;
        this.intermissionTimer = 3.2;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'waveClear');
        this._statsDirty = true;
        this.updateOverlay();
        this.updateResourceHud();
    }

    advanceToNextMap() {
        const next = this.mapIndex + 1;
        const keptGold = this.gold;
        const keptLives = this.lives;
        const keptScore = this.score;
        this.loadMap(next, { preserveRun: true });
        this.gold = keptGold;
        this.lives = keptLives;
        this.score = keptScore;
        this.mapTransition = false;
        this.beginIntermission(7); // rebuild on new layout
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'start');
        this.updateStatsPanel();
        this.updateResourceHud();
    }

    victory() {
        this.gameState = 'victory';
        this.mapTransition = false;
        this.intermissionTimer = 0;
        this.score += this.gold * 2 + this.lives * 25 + 500;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'victory');
        if (highScoreManager.checkHighScore('tidehold', this.score)) {
            highScoreManager.requestNameEntry('tidehold', this.score);
        }
        this._statsDirty = true;
        this.updateOverlay();
        this.updateResourceHud();
    }

    gameOver() {
        this.gameState = 'gameOver';
        if (typeof audioManager !== 'undefined') audioManager.playSfx('gameOver');
        if (highScoreManager.checkHighScore('tidehold', this.score)) {
            highScoreManager.requestNameEntry('tidehold', this.score);
        }
        this._statsDirty = true;
        this.updateOverlay();
    }

    // --- Update loop -------------------------------------------------------

    gameLoop(dtMs) {
        if (this.isDestroyed) return;
        const dt = Math.min(dtMs, 50) / 1000;
        this.elapsed += dt;

        if (this.gameState === 'playing') {
            this.updateSpawns(dt);
            this.updateEnemies(dt);
            this.updateTowers(dt);
            this.updateProjectiles(dt);
            this.updateEffects(dt);
            this.checkWaveClear();
        } else if (this.gameState === 'waveClear') {
            this.updateEffects(dt);
            this.updateIntermission(dt);
        } else {
            this.updateEffects(dt);
        }

        this.animateAmbience(dt);
        this.updateHpBillboards();
        if (this._statsDirty) {
            this.updateStatsPanel();
            this._statsDirty = false;
        }
    }

    updateIntermission(dt) {
        if (this.intermissionTimer <= 0) return;
        this.intermissionTimer -= dt;
        // Refresh countdown text ~4x/sec
        if (Math.floor(this.intermissionTimer * 4) !== Math.floor((this.intermissionTimer + dt) * 4)) {
            this.updateOverlay();
            this.updateResourceHud();
        }
        if (this.intermissionTimer > 0) return;

        this.intermissionTimer = 0;
        if (this.mapTransition) {
            this.advanceToNextMap();
            return;
        }
        this.startNextWave();
    }

    animateAmbience(dt) {
        if (this._ocean) {
            this._ocean.rotation.z = Math.sin(this.elapsed * 0.15) * 0.02;
        }
        if (this._shrineGem) {
            this._shrineGem.rotation.y += dt * 1.2;
            this._shrineGem.position.y = 2.7 + Math.sin(this.elapsed * 2) * 0.08;
        }
        if (this._kelp) {
            this._kelp.forEach((k) => {
                k.rotation.z = Math.sin(this.elapsed * 1.2 + k.userData.sway) * 0.12;
            });
        }
        this.towers.forEach((t) => {
            if (t.mesh.userData.spin) t.mesh.userData.spin.rotation.z += dt * 2.5;
            if (t.mesh.userData.ribbons) {
                t.mesh.userData.ribbons.forEach((r, i) => {
                    r.rotation.z += dt * (1.5 + i * 0.4);
                });
            }
            if (t.mesh.userData.orb) {
                const s = 1.15 + (t.level - 1) * 0.18;
                t.mesh.userData.orb.position.y = 1.55 * s + Math.sin(this.elapsed * 3 + t.cooldown) * 0.1;
            }
        });
        // Pulse empty build markers
        this.padMeshes.forEach((g) => {
            const marker = g.userData?.marker;
            if (marker && marker.visible) {
                marker.position.y = 1.35 + Math.sin(this.elapsed * 3 + g.userData.padIndex) * 0.18;
                marker.rotation.y += dt * 1.8;
            }
        });
        if (this._foam) {
            this._foam.material.opacity = 0.45 + Math.sin(this.elapsed * 1.4) * 0.1;
        }
        this.updateResourceHud();
    }

    updateSpawns(dt) {
        if (!this.waveActive) return;
        this.waveClock += dt;
        while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveClock) {
            const job = this.spawnQueue.shift();
            this.spawnEnemy(job.type, job.hpScale);
        }
    }

    spawnEnemy(type, hpScale = 1) {
        const def = TIDEHOLD_ENEMIES[type];
        if (!def) return;
        const pathIndex = Math.floor(Math.random() * this.map.paths.length);
        const path = this.map.paths[pathIndex];
        const mesh = this.createEnemyMesh(type);
        const start = path[0];
        mesh.position.set(start.x, 0, start.z);
        this.entityRoot.add(mesh);

        this.enemies.push({
            type,
            mesh,
            pathIndex,
            pathProgress: 0,
            hp: def.hp * hpScale,
            maxHp: def.hp * hpScale,
            speed: def.speed,
            baseSpeed: def.speed,
            slowTimer: 0,
            holdTimer: 0,
            reward: def.reward,
            leakDamage: def.leakDamage
        });
        this._statsDirty = true;
    }

    updateEnemies(dt) {
        const cam = this.graphics.camera;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.slowTimer > 0) {
                e.slowTimer -= dt;
                const factor = e._auraSlow ? (1 - e._auraSlow) : 0.45;
                e.speed = e.baseSpeed * Math.max(0.2, factor);
            } else {
                e.speed = e.baseSpeed;
                e._auraSlow = 0;
            }
            if (e.holdTimer > 0) {
                e.holdTimer -= dt;
                e.speed *= 0.15;
            }

            const path = this.map.paths[e.pathIndex];
            const totalLen = this.pathLength(path);
            e.pathProgress += (e.speed * dt) / totalLen;

            if (e.pathProgress >= 1) {
                this.leakEnemy(e);
                this.disposeObject(e.mesh);
                this.enemies.splice(i, 1);
                continue;
            }

            const pos = this.pointOnPath(path, e.pathProgress);
            const next = this.pointOnPath(path, Math.min(1, e.pathProgress + 0.01));
            e.mesh.position.set(pos.x, 0, pos.z);
            const ang = Math.atan2(next.x - pos.x, next.z - pos.z);
            e.mesh.rotation.y = ang;

            // HP bar
            const pct = Math.max(0, e.hp / e.maxHp);
            if (e.mesh.userData.hpBar) {
                e.mesh.userData.hpBar.scale.x = pct;
                e.mesh.userData.hpBar.position.x = -0.43 * (1 - pct);
                e.mesh.userData.hpBar.material.color.setHex(pct > 0.4 ? 0x44ddaa : 0xdd5544);
            }
        }
    }

    updateHpBillboards() {
        const cam = this.graphics?.camera;
        if (!cam) return;
        this.enemies.forEach((e) => {
            const bar = e.mesh.userData.hpBar;
            const bg = e.mesh.userData.hpBarBg;
            if (bar) bar.quaternion.copy(cam.quaternion);
            if (bg) bg.quaternion.copy(cam.quaternion);
        });
    }

    pathLength(path) {
        let len = 0;
        for (let i = 0; i < path.length - 1; i++) {
            len += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
        }
        return Math.max(len, 0.01);
    }

    pointOnPath(path, t) {
        const total = this.pathLength(path);
        let dist = t * total;
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i];
            const b = path[i + 1];
            const seg = Math.hypot(b.x - a.x, b.z - a.z);
            if (dist <= seg) {
                const u = seg < 1e-6 ? 0 : dist / seg;
                return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u };
            }
            dist -= seg;
        }
        const last = path[path.length - 1];
        return { x: last.x, z: last.z };
    }

    leakEnemy(e) {
        this.lives -= e.leakDamage;
        this.score = Math.max(0, this.score - 5);
        this.spawnKillFx(e.mesh.position.x, e.mesh.position.z, 0xff6644);
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'leak');
        this._statsDirty = true;
        if (this.lives <= 0) {
            this.lives = 0;
            this.gameOver();
        }
        this.updateOverlay();
    }

    updateTowers(dt) {
        this.towers.forEach((tower) => {
            tower.cooldown = Math.max(0, tower.cooldown - dt);
            const stats = tideholdGetTowerStats(tower);

            let target = null;
            let best = Infinity;
            this.enemies.forEach((e) => {
                const dx = e.mesh.position.x - tower.x;
                const dz = e.mesh.position.z - tower.z;
                const d = Math.hypot(dx, dz);
                if (d <= stats.range && e.pathProgress < best) {
                    best = e.pathProgress;
                    target = e;
                }
            });

            if (!target || tower.cooldown > 0) return;

            if (tower.type === 'whirlpool') {
                let holding = false;
                this.enemies.forEach((e) => {
                    const d = Math.hypot(e.mesh.position.x - tower.x, e.mesh.position.z - tower.z);
                    if (d <= stats.range) {
                        holding = true;
                        e.hp -= stats.damage * dt * 3;
                        e.holdTimer = Math.max(e.holdTimer, stats.hold);
                        if (stats.auraSlow > 0) {
                            e.slowTimer = Math.max(e.slowTimer, stats.auraSlowDuration);
                            e._auraSlow = stats.auraSlow;
                        }
                    }
                });
                if (Math.random() < 0.12) this.spawnWhirlFx(tower.x, tower.z, stats.range);
                this._whirlSfxTimer -= dt;
                if (holding && this._whirlSfxTimer <= 0) {
                    this._whirlSfxTimer = 0.38;
                    if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'whirlpool');
                }
                tower.cooldown = 0.05;
            } else if (tower.type === 'beacon') {
                this.fireBeaconBeam(tower, target, stats);
                tower.cooldown = stats.fireRate;
            } else {
                this.fireProjectile(tower, target, stats);
                tower.cooldown = stats.fireRate;
            }
        });

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].hp <= 0) this.killEnemy(this.enemies[i]);
        }
    }

    fireBeaconBeam(tower, target, stats) {
        const T = window.THREE;
        const from = new T.Vector3(tower.x, 3.2, tower.z);
        const to = new T.Vector3(target.mesh.position.x, 0.8, target.mesh.position.z);
        const dist = from.distanceTo(to);
        const mid = from.clone().add(to).multiplyScalar(0.5);

        const beam = new T.Mesh(
            new T.CylinderGeometry(0.22, 0.1, dist, 8),
            new T.MeshBasicMaterial({ color: stats.accent, transparent: true, opacity: 1 })
        );
        beam.position.copy(mid);
        beam.quaternion.setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            to.clone().sub(from).normalize()
        );
        this.fxRoot.add(beam);
        this.effects.push({ mesh: beam, life: 0.35, max: 0.35 });

        // Outer glow sheath
        const glow = new T.Mesh(
            new T.CylinderGeometry(0.5, 0.22, dist, 8),
            new T.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.45 })
        );
        glow.position.copy(mid);
        glow.quaternion.copy(beam.quaternion);
        this.fxRoot.add(glow);
        this.effects.push({ mesh: glow, life: 0.3, max: 0.3 });

        // Muzzle flash
        const flash = new T.Mesh(
            new T.SphereGeometry(0.7, 10, 10),
            new T.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 1 })
        );
        flash.position.copy(from);
        this.fxRoot.add(flash);
        this.effects.push({ mesh: flash, life: 0.2, max: 0.2, grow: 1.8 });

        this.applyDamageToEnemy(target, stats.damage, {
            chain: stats.chain,
            chainRange: stats.chainRange
        });

        // Pierce along the beam line
        if (stats.pierce > 0) {
            const dir = to.clone().sub(from).normalize();
            const others = this.enemies
                .filter((en) => en !== target && en.hp > 0)
                .map((en) => {
                    const toE = new T.Vector3(en.mesh.position.x, 0.8, en.mesh.position.z).sub(from);
                    const along = toE.dot(dir);
                    const closest = from.clone().add(dir.clone().multiplyScalar(along));
                    const lateral = closest.distanceTo(new T.Vector3(en.mesh.position.x, 0.8, en.mesh.position.z));
                    return { en, along, lateral };
                })
                .filter((o) => o.along > 0.5 && o.along < dist + 1 && o.lateral < 1.2)
                .sort((a, b) => a.along - b.along)
                .slice(0, stats.pierce);
            others.forEach((o) => {
                this.applyDamageToEnemy(o.en, stats.damage * 0.75);
                this.spawnBoltFx(o.en.mesh.position.x, o.en.mesh.position.z, stats.accent);
            });
        }

        this.spawnBoltFx(to.x, to.z, stats.accent);
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].hp <= 0) this.killEnemy(this.enemies[i]);
        }
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'beacon');
    }

    fireProjectile(tower, target, stats) {
        const T = window.THREE;
        const mesh = new T.Mesh(
            new T.SphereGeometry(0.55, 12, 12),
            new T.MeshStandardMaterial({
                color: stats.accent,
                emissive: stats.accent,
                emissiveIntensity: 1.8
            })
        );
        mesh.position.set(tower.x, 1.7, tower.z);
        this.fxRoot.add(mesh);

        // Soft glow shell
        const shell = new T.Mesh(
            new T.SphereGeometry(0.95, 10, 10),
            new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
        );
        mesh.add(shell);

        this.projectiles.push({
            mesh,
            type: tower.type,
            damage: stats.damage,
            splash: stats.splash || 0,
            slow: stats.slow || 0,
            slowDuration: stats.slowDuration || 0,
            pierce: stats.pierce || 0,
            chain: stats.chain || 0,
            chainRange: stats.chainRange || 0,
            pierced: 0,
            hitIds: new Set(),
            speed: Math.min(stats.projectileSpeed, 10),
            tx: target.mesh.position.x,
            tz: target.mesh.position.z,
            targetRef: target,
            age: 0,
            arc: true,
            accent: stats.accent,
            trailTimer: 0
        });

        // Launch puff
        this.spawnBoltFx(tower.x, tower.z, stats.accent);

        if (typeof audioManager !== 'undefined') {
            audioManager.playGameSfx('tidehold', 'mortar');
        }
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.age += dt;

            let tx = p.tx;
            let tz = p.tz;
            if (p.targetRef && p.targetRef.mesh && p.targetRef.hp > 0) {
                tx = p.targetRef.mesh.position.x;
                tz = p.targetRef.mesh.position.z;
                p.tx = tx;
                p.tz = tz;
            }

            const dx = tx - p.mesh.position.x;
            const dz = tz - p.mesh.position.z;
            const dist = Math.hypot(dx, dz);
            const step = p.speed * dt;

            if (dist > 0.01) {
                p.mesh.position.x += (dx / dist) * step;
                p.mesh.position.z += (dz / dist) * step;
            }
            // Tall arc so mortar orbs read clearly
            p.mesh.position.y = 1.5 + Math.sin(Math.min(1, Math.max(0, 1 - dist / 14)) * Math.PI) * 4.5;
            p.trailTimer = (p.trailTimer || 0) + dt;
            if (p.trailTimer > 0.05) {
                p.trailTimer = 0;
                this.spawnTrailBit(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, p.accent || 0x66ffcc);
            }

            if (dist < step + 0.5 || p.age > 3.5) {
                this.detonateProjectile(p);
                this.disposeObject(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }

    applyDamageToEnemy(e, damage, opts = {}) {
        if (!e || e.hp <= 0) return;
        e.hp -= damage;
        if (opts.slow > 0) e.slowTimer = Math.max(e.slowTimer, opts.slowDuration || 1);
        if (opts.chain > 0) {
            let left = opts.chain;
            let from = e;
            const hit = new Set([e]);
            while (left > 0 && from) {
                let next = null;
                let best = opts.chainRange || 3.5;
                this.enemies.forEach((cand) => {
                    if (hit.has(cand) || cand.hp <= 0) return;
                    const d = Math.hypot(cand.mesh.position.x - from.mesh.position.x, cand.mesh.position.z - from.mesh.position.z);
                    if (d < best) {
                        best = d;
                        next = cand;
                    }
                });
                if (!next) break;
                next.hp -= damage * 0.65;
                this.spawnBoltFx(next.mesh.position.x, next.mesh.position.z);
                hit.add(next);
                from = next;
                left -= 1;
            }
        }
    }

    detonateProjectile(p) {
        if (p.splash > 0) {
            this.enemies.forEach((e) => {
                const d = Math.hypot(e.mesh.position.x - p.tx, e.mesh.position.z - p.tz);
                if (d <= p.splash) {
                    this.applyDamageToEnemy(e, p.damage * (1 - (d / p.splash) * 0.4), {
                        slow: p.slow,
                        slowDuration: p.slowDuration
                    });
                }
            });
            this.spawnSplashFx(p.tx, p.tz, p.splash);
            if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'splash');
        } else {
            let primary = p.targetRef;
            if (!primary || primary.hp <= 0) {
                let best = 1.4;
                this.enemies.forEach((en) => {
                    const d = Math.hypot(en.mesh.position.x - p.tx, en.mesh.position.z - p.tz);
                    if (d < best) {
                        best = d;
                        primary = en;
                    }
                });
            }
            if (primary) {
                this.applyDamageToEnemy(primary, p.damage, {
                    chain: p.chain,
                    chainRange: p.chainRange
                });
                this.spawnBoltFx(p.tx, p.tz);

                // Pierce: damage next-furthest along path within a cone
                if (p.pierce > 0) {
                    const others = this.enemies
                        .filter((en) => en !== primary && en.hp > 0)
                        .filter((en) => Math.hypot(en.mesh.position.x - p.tx, en.mesh.position.z - p.tz) < 4.5)
                        .sort((a, b) => b.pathProgress - a.pathProgress)
                        .slice(0, p.pierce);
                    others.forEach((en) => {
                        this.applyDamageToEnemy(en, p.damage * 0.75);
                        this.spawnBoltFx(en.mesh.position.x, en.mesh.position.z);
                    });
                }
            }
            if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'hit');
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].hp <= 0) this.killEnemy(this.enemies[i]);
        }
    }

    killEnemy(e) {
        const idx = this.enemies.indexOf(e);
        if (idx < 0) return;
        this.gold += e.reward;
        this.score += e.reward * 10;
        this.spawnKillFx(e.mesh.position.x, e.mesh.position.z, 0x66ffcc);
        this.disposeObject(e.mesh);
        this.enemies.splice(idx, 1);
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'kill');
        this._statsDirty = true;
    }

    checkWaveClear() {
        if (!this.waveActive) return;
        if (this.spawnQueue.length > 0 || this.enemies.length > 0) return;
        this.waveActive = false;
        this.waveIndex += 1;
        this.gold += 25 + this.waveIndex * 5;
        this.score += 100 * this.waveIndex;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'waveClear');

        if (this.waveIndex >= this.waves.length) {
            this.onMapCleared();
        } else {
            // Auto-advance — short breather, no Space required
            this.beginIntermission(2.5);
        }
        this._statsDirty = true;
        this.updateResourceHud();
    }

    // --- VFX ---------------------------------------------------------------

    spawnBoltFx(x, z, color = 0xffcc66) {
        const T = window.THREE;
        const burst = new T.Mesh(
            new T.SphereGeometry(0.55, 10, 10),
            new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
        );
        burst.position.set(x, 1.0, z);
        this.fxRoot.add(burst);
        this.effects.push({ mesh: burst, life: 0.28, max: 0.28, grow: 2.2 });

        const pillar = new T.Mesh(
            new T.CylinderGeometry(0.08, 0.2, 2.4, 6),
            new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
        );
        pillar.position.set(x, 1.4, z);
        this.fxRoot.add(pillar);
        this.effects.push({ mesh: pillar, life: 0.2, max: 0.2 });
    }

    spawnTrailBit(x, y, z, color) {
        const T = window.THREE;
        const mesh = new T.Mesh(
            new T.SphereGeometry(0.18, 6, 6),
            new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
        );
        mesh.position.set(x, y, z);
        this.fxRoot.add(mesh);
        this.effects.push({ mesh, life: 0.25, max: 0.25 });
    }

    spawnSplashFx(x, z, radius) {
        const T = window.THREE;
        const ring = new T.Mesh(
            new T.RingGeometry(0.3, Math.max(0.6, radius * 0.45), 24),
            new T.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.85, side: T.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.35, z);
        this.fxRoot.add(ring);
        this.effects.push({ mesh: ring, life: 0.55, max: 0.55, grow: radius * 1.4 });

        const dome = new T.Mesh(
            new T.SphereGeometry(radius * 0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
            new T.MeshBasicMaterial({ color: 0x88ffdd, transparent: true, opacity: 0.45, side: T.DoubleSide })
        );
        dome.position.set(x, 0.2, z);
        this.fxRoot.add(dome);
        this.effects.push({ mesh: dome, life: 0.4, max: 0.4, grow: 2.0 });

        for (let i = 0; i < 6; i++) {
            const shard = new T.Mesh(
                new T.ConeGeometry(0.12, 0.55, 4),
                new T.MeshBasicMaterial({ color: 0xff8899, transparent: true, opacity: 0.9 })
            );
            const a = (i / 6) * Math.PI * 2;
            shard.position.set(x, 0.6, z);
            shard.userData.vx = Math.cos(a) * 3;
            shard.userData.vy = 2 + Math.random() * 2;
            shard.userData.vz = Math.sin(a) * 3;
            this.fxRoot.add(shard);
            this.effects.push({ mesh: shard, life: 0.45, max: 0.45, ballistic: true });
        }
    }

    spawnWhirlFx(x, z, range) {
        const T = window.THREE;
        const mesh = new T.Mesh(
            new T.RingGeometry(range * 0.25, range * 0.7, 28),
            new T.MeshBasicMaterial({ color: 0x33eedd, transparent: true, opacity: 0.55, side: T.DoubleSide })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.35, z);
        this.fxRoot.add(mesh);
        this.effects.push({ mesh, life: 0.5, max: 0.5, spin: true });

        const column = new T.Mesh(
            new T.CylinderGeometry(0.15, range * 0.25, 2.2, 10),
            new T.MeshBasicMaterial({ color: 0x66ffe8, transparent: true, opacity: 0.35 })
        );
        column.position.set(x, 1.2, z);
        this.fxRoot.add(column);
        this.effects.push({ mesh: column, life: 0.35, max: 0.35 });
    }

    spawnKillFx(x, z, color) {
        const T = window.THREE;
        for (let i = 0; i < 12; i++) {
            const mesh = new T.Mesh(
                new T.SphereGeometry(0.14, 6, 6),
                new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
            );
            mesh.position.set(x, 0.5, z);
            mesh.userData.vx = (Math.random() - 0.5) * 4;
            mesh.userData.vy = 2 + Math.random() * 3;
            mesh.userData.vz = (Math.random() - 0.5) * 4;
            this.fxRoot.add(mesh);
            this.effects.push({ mesh, life: 0.6, max: 0.6, ballistic: true });
        }
    }

    updateEffects(dt) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const fx = this.effects[i];
            fx.life -= dt;
            const u = Math.max(0, fx.life / fx.max);
            if (fx.mesh.material) fx.mesh.material.opacity = u * 0.8;
            if (fx.grow) fx.mesh.scale.setScalar(1 + (1 - u) * (fx.grow / 2));
            if (fx.spin) fx.mesh.rotation.z += dt * 4;
            if (fx.ballistic) {
                fx.mesh.position.x += fx.mesh.userData.vx * dt;
                fx.mesh.position.y += fx.mesh.userData.vy * dt;
                fx.mesh.position.z += fx.mesh.userData.vz * dt;
                fx.mesh.userData.vy -= 8 * dt;
            }
            if (fx.life <= 0) {
                this.disposeObject(fx.mesh);
                this.effects.splice(i, 1);
            }
        }
    }

    // --- Placement / input -------------------------------------------------

    setupInput() {
        this.keydownHandler = (e) => {
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal && nameEntryModal.classList.contains('active')) return;
            const activeCanvas = document.getElementById('game-canvas');
            if (!activeCanvas || activeCanvas !== this.canvas) return;

            this.keys[e.code] = true;

            if (e.code === 'Digit1' || e.code === 'Numpad1') {
                if (this.gameState !== 'menu') this.setTowerType('beacon');
            }
            if (e.code === 'Digit2' || e.code === 'Numpad2') {
                if (this.gameState !== 'menu') this.setTowerType('mortar');
            }
            if (e.code === 'Digit3' || e.code === 'Numpad3') {
                if (this.gameState !== 'menu') this.setTowerType('whirlpool');
            }

            if (e.code === 'Space') {
                e.preventDefault();
                if (this.gameState === 'menu' || this.gameState === 'gameOver' || this.gameState === 'victory') {
                    this.startGame();
                } else if (this.gameState === 'waveClear' && !this.mapTransition) {
                    // Skip remaining intermission / build countdown
                    this.intermissionTimer = 0;
                    this.startNextWave();
                } else if (this.gameState === 'paused') {
                    this.gameState = this.waveActive || this.enemies.length ? 'playing' : 'waveClear';
                    this.updateOverlay();
                }
            }

            if (e.code === 'KeyP') {
                if (this.gameState === 'playing' || this.gameState === 'waveClear') {
                    this.gameState = 'paused';
                    this.updateOverlay();
                } else if (this.gameState === 'paused') {
                    this.gameState = this.waveActive || this.enemies.length ? 'playing' : 'waveClear';
                    this.updateOverlay();
                }
            }

            if (e.code === 'KeyR') {
                this.loadMap(0);
                this.gameState = 'menu';
                this.updateOverlay();
                this.updateResourceHud();
            }

            if (e.code === 'KeyU') {
                this.promptUpgrade();
            }
        };

        this.keyupHandler = (e) => {
            this.keys[e.code] = false;
        };

        this.pointerDownHandler = (e) => {
            const activeCanvas = document.getElementById('game-canvas');
            if (!activeCanvas || activeCanvas !== this.canvas) return;
            if (this.gameState === 'paused' || this.gameState === 'gameOver' || this.gameState === 'victory') return;
            if (this.gameState === 'menu' || this.mapTransition) return;
            this.handlePointer(e, true);
        };

        this.pointerMoveHandler = (e) => {
            const activeCanvas = document.getElementById('game-canvas');
            if (!activeCanvas || activeCanvas !== this.canvas) return;
            if (this.gameState === 'menu' || this.gameState === 'paused') return;
            this.handlePointer(e, false);
        };

        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
        // Capture phase so HUD/overlay siblings can't swallow the event first
        this.canvas.style.touchAction = 'none';
        this.canvas.style.cursor = 'crosshair';
    }

    setTowerType(type) {
        this.selectedTowerType = type;
        this._statsDirty = true;
        this.updateRangePreview();
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'select');
    }

    pickWorldPoint(clientX, clientY) {
        if (!this.graphics?.camera || !this._raycaster || !this._groundPlane) return null;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return null;
        this._pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this._pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._pointerNdc, this.graphics.camera);
        const hit = this._hit || (this._hit = new window.THREE.Vector3());
        const ok = this._raycaster.ray.intersectPlane(this._groundPlane, hit);
        return ok ? hit : null;
    }

    nearestPadIndex(worldX, worldZ, maxDist = 3.2) {
        let best = -1;
        let bestDist = maxDist;
        this.map.pads.forEach((pad, i) => {
            const d = Math.hypot(pad.x - worldX, pad.z - worldZ);
            if (d < bestDist) {
                bestDist = d;
                best = i;
            }
        });
        return best;
    }

    handlePointer(e, isDown) {
        if (!this.graphics?.camera || !this._raycaster) return;

        const world = this.pickWorldPoint(e.clientX, e.clientY);
        this._hoverPadIndex = world ? this.nearestPadIndex(world.x, world.z) : -1;
        this.updatePadHighlights();

        if (!isDown) {
            this.updateRangePreview();
            return;
        }

        e.preventDefault();

        // Prefer ground-plane → nearest pad (reliable with CSS-scaled canvas)
        if (world) {
            const padIndex = this.nearestPadIndex(world.x, world.z);
            if (padIndex >= 0) {
                this.onPadClicked(padIndex);
                return;
            }
        }

        // Fallback: direct mesh raycast
        this._raycaster.setFromCamera(this._pointerNdc, this.graphics.camera);
        const padHits = this._raycaster.intersectObjects(this.padMeshes, true);
        if (padHits.length) {
            let obj = padHits[0].object;
            while (obj && obj.userData?.kind !== 'pad') obj = obj.parent;
            if (obj && obj.userData?.kind === 'pad') {
                this.onPadClicked(obj.userData.padIndex);
                return;
            }
        }

        const towerMeshes = this.towers.map((t) => t.mesh);
        const towerHits = this._raycaster.intersectObjects(towerMeshes, true);
        if (towerHits.length) {
            let obj = towerHits[0].object;
            while (obj && !obj.userData?.towerId && obj.parent) obj = obj.parent;
            if (obj?.userData?.towerId != null) {
                this.selectedTowerId = obj.userData.towerId;
                this._statsDirty = true;
                this.updateRangePreview();
            }
        }
    }

    updatePadHighlights() {
        if (!this.padMeshes) return;
        this.padMeshes.forEach((g) => {
            const idx = g.userData?.padIndex;
            const occupied = this.towers.some((t) => t.padIndex === idx);
            const hot = idx === this._hoverPadIndex && !occupied
                && (this.gameState === 'playing' || this.gameState === 'waveClear');
            g.scale.setScalar(hot ? 1.14 : 1);
            if (g.userData.marker) g.userData.marker.visible = !occupied;
            if (g.userData.ring?.material) {
                g.userData.ring.material.emissiveIntensity = occupied ? 0.25 : (hot ? 1.35 : 0.85);
            }
            if (g.userData.glow?.material) {
                g.userData.glow.material.opacity = occupied ? 0.12 : (hot ? 0.75 : 0.5);
            }
        });
    }

    onPadClicked(padIndex) {
        const existing = this.towers.find((t) => t.padIndex === padIndex);
        if (existing) {
            this.selectedTowerId = existing.id;
            this._statsDirty = true;
            this.updateRangePreview();
            return;
        }

        if (this.gameState !== 'playing' && this.gameState !== 'waveClear') return;

        const def = TIDEHOLD_TOWERS[this.selectedTowerType];
        if (!def || this.gold < def.cost) {
            if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'deny');
            return;
        }

        const pad = this.map.pads[padIndex];
        this.gold -= def.cost;
        const mesh = this.createTowerMesh(this.selectedTowerType, 1);
        mesh.position.set(pad.x, 0, pad.z);
        const id = `t${Date.now()}${Math.random()}`;
        mesh.userData.towerId = id;
        this.entityRoot.add(mesh);

        this.towers.push({
            id,
            type: this.selectedTowerType,
            padIndex,
            x: pad.x,
            z: pad.z,
            level: 1,
            branch: null,
            cooldown: 0,
            mesh
        });
        this.selectedTowerId = id;
        this.hidePadMarker(padIndex);
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'build');
        this._statsDirty = true;
        this.updateRangePreview();
        this.updatePadHighlights();
    }

    hidePadMarker(padIndex) {
        const g = this.padMeshes.find((p) => p.userData?.padIndex === padIndex);
        if (!g) return;
        if (g.userData.marker) g.userData.marker.visible = false;
        if (g.userData.glow) g.userData.glow.material.opacity = 0.15;
    }

    promptUpgrade() {
        const tower = this.towers.find((t) => t.id === this.selectedTowerId);
        if (!tower || tower.level >= 3) return;
        if (tower.branch) {
            this.applyUpgrade(tower, tower.branch);
        } else {
            this._showUpgradePicker = true;
            this._statsDirty = true;
            this.updateStatsPanel();
        }
    }

    applyUpgrade(tower, branchId) {
        if (!tower || tower.level >= 3) return;
        const def = TIDEHOLD_TOWERS[tower.type];
        if (!def.branches[branchId]) return;
        if (tower.branch && tower.branch !== branchId) return;

        const cost = def.upgradeCost * tower.level;
        if (this.gold < cost) {
            if (typeof audioManager !== 'undefined') audioManager.playGameSfx('tidehold', 'deny');
            return;
        }

        const firstSpecialize = !tower.branch;
        this.gold -= cost;
        tower.branch = branchId;
        tower.level += 1;
        const pos = tower.mesh.position.clone();
        this.disposeObject(tower.mesh);
        tower.mesh = this.createTowerMesh(tower.type, tower.level, tower.branch);
        tower.mesh.position.copy(pos);
        tower.mesh.userData.towerId = tower.id;
        this.entityRoot.add(tower.mesh);
        this._showUpgradePicker = false;
        if (typeof audioManager !== 'undefined') {
            audioManager.playGameSfx('tidehold', firstSpecialize ? 'specialize' : 'upgrade');
        }
        this._statsDirty = true;
        this.updateRangePreview();
        this.updateStatsPanel();
    }

    updateRangePreview() {
        if (this.rangeMesh) {
            this.disposeObject(this.rangeMesh);
            this.rangeMesh = null;
        }
        if (!window.THREE) return;
        const T = window.THREE;
        let x;
        let z;
        let range;
        const selected = this.towers.find((t) => t.id === this.selectedTowerId);
        if (selected) {
            x = selected.x;
            z = selected.z;
            range = tideholdGetTowerStats(selected).range;
        } else {
            return;
        }
        const mesh = new T.Mesh(
            new T.RingGeometry(range * 0.92, range, 48),
            new T.MeshBasicMaterial({
                color: 0x88e0d0,
                transparent: true,
                opacity: 0.35,
                side: T.DoubleSide,
                depthWrite: false
            })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.3, z);
        this.fxRoot.add(mesh);
        this.rangeMesh = mesh;
    }

    // --- UI ----------------------------------------------------------------

    createOverlay() {
        const wrapper = document.querySelector('.game-content-wrapper');
        if (!wrapper) return;
        let el = document.getElementById('tidehold-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tidehold-overlay';
            // pointer-events must be none on descendants too — children default to auto and steal clicks
            el.style.cssText = [
                'position:absolute',
                'left:0',
                'top:0',
                'right:260px',
                'bottom:0',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'pointer-events:none',
                'z-index:5',
                'font-family:Georgia,Times New Roman,serif',
                'text-align:center',
                'color:#dceef0'
            ].join(';');
            wrapper.style.position = 'relative';
            wrapper.appendChild(el);
        }
        this.overlayEl = el;

        // Always-visible resource strip over the canvas (gold was easy to miss in the tall sidebar)
        let hud = document.getElementById('tidehold-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'tidehold-hud';
            hud.style.cssText = [
                'position:absolute',
                'left:16px',
                'top:12px',
                'z-index:6',
                'pointer-events:none',
                'display:flex',
                'gap:10px',
                'font-family:Georgia,Times New Roman,serif',
                'font-size:15px',
                'letter-spacing:0.04em'
            ].join(';');
            wrapper.appendChild(hud);
        }
        this.hudEl = hud;
        this.updateResourceHud();
    }

    updateResourceHud() {
        if (!this.hudEl) return;
        if (this.gameState === 'menu') {
            this.hudEl.innerHTML = '';
            return;
        }
        this.hudEl.innerHTML = `
            <div style="background:rgba(6,18,22,0.88);border:1px solid #c9a24a;padding:8px 14px;min-width:110px">
                <div style="font-size:10px;color:#e8c878;text-transform:uppercase;letter-spacing:0.12em">Gold</div>
                <div style="font-size:26px;font-weight:700;color:#ffe08a;line-height:1.1">${this.gold}</div>
            </div>
            <div style="background:rgba(6,18,22,0.82);border:1px solid #3a7a7a;padding:8px 12px">
                <div style="font-size:10px;color:#88e0d0;text-transform:uppercase;letter-spacing:0.12em">Lives</div>
                <div style="font-size:22px;font-weight:700;color:#dceef0;line-height:1.1">${this.lives}</div>
            </div>
            <div style="background:rgba(6,18,22,0.82);border:1px solid #3a7a7a;padding:8px 12px">
                <div style="font-size:10px;color:#88e0d0;text-transform:uppercase;letter-spacing:0.12em">Map</div>
                <div style="font-size:18px;font-weight:700;color:#dceef0;line-height:1.1">${this.mapIndex + 1}/${TIDEHOLD_MAPS.length}</div>
            </div>
            <div style="background:rgba(6,18,22,0.82);border:1px solid #3a7a7a;padding:8px 12px">
                <div style="font-size:10px;color:#88e0d0;text-transform:uppercase;letter-spacing:0.12em">Wave</div>
                <div style="font-size:22px;font-weight:700;color:#dceef0;line-height:1.1">${Math.min(this.waveIndex + 1, this.waves.length)}/${this.waves.length}</div>
            </div>
            <div style="background:rgba(6,18,22,0.82);border:1px solid #3a7a7a;padding:8px 12px">
                <div style="font-size:10px;color:#88e0d0;text-transform:uppercase;letter-spacing:0.12em">Score</div>
                <div style="font-size:18px;font-weight:700;color:#dceef0;line-height:1.1">${Utils.formatScore(this.score)}</div>
            </div>
        `;
    }

    updateOverlay() {
        if (!this.overlayEl) return;
        let html = '';
        this.overlayEl.style.alignItems = 'center';
        this.overlayEl.style.paddingTop = '0';
        if (this.gameState === 'menu') {
            html = `
                <div style="background:rgba(4,16,22,0.78);padding:28px 36px;border:1px solid #3a6a6a;max-width:440px">
                    <div style="font-size:34px;letter-spacing:0.12em;color:#e8c878">TIDEHOLD</div>
                    <div style="margin-top:8px;opacity:0.85;font-size:14px">Defend the coastal shrine. Hold the tide.</div>
                    <div style="margin-top:18px;font-size:13px;line-height:1.7;opacity:0.9">
                        <b style="color:#88e0d0">Campaign</b> — 3 maps · 8 waves each<br>
                        Breakwater → Kelp Gate → Abyssal Stair<br>
                        Waves advance automatically.<br>
                        <span style="opacity:0.7">Space — begin</span>
                    </div>
                </div>`;
        } else if (this.gameState === 'waveClear') {
            this.overlayEl.style.alignItems = 'flex-start';
            this.overlayEl.style.paddingTop = '18px';
            const secs = Math.max(0, Math.ceil(this.intermissionTimer));
            if (this.mapTransition) {
                const next = TIDEHOLD_MAPS[this.mapIndex + 1];
                html = `
                    <div style="background:rgba(4,16,22,0.85);padding:14px 24px;border:1px solid #e8c878;pointer-events:none">
                        <div style="font-size:18px;color:#e8c878">${this.map.name} held</div>
                        <div style="margin-top:4px;font-size:13px;opacity:0.9">
                            Next: <b style="color:#88e0d0">${next ? next.name : ''}</b> · ${secs}s
                        </div>
                    </div>`;
            } else {
                const buildFirst = this.waveIndex === 0;
                html = `
                    <div style="background:rgba(4,16,22,0.82);padding:12px 22px;border:1px solid #3a8a7a;pointer-events:none">
                        <div style="font-size:18px;color:#88e0d0">${buildFirst ? `Build — ${this.map.name}` : `Wave ${this.waveIndex} clear`}</div>
                        <div style="margin-top:4px;font-size:12px;opacity:0.85;pointer-events:none">
                            Wave ${this.waveIndex + 1} in ${secs}s · Space to launch now
                        </div>
                    </div>`;
            }
        } else if (this.gameState === 'paused') {
            this.overlayEl.style.alignItems = 'center';
            this.overlayEl.style.paddingTop = '0';
            html = `<div style="background:rgba(4,16,22,0.75);padding:20px 32px;border:1px solid #666;font-size:24px">Paused</div>`;
        } else if (this.gameState === 'victory') {
            html = `
                <div style="background:rgba(4,16,22,0.82);padding:28px 36px;border:1px solid #e8c878">
                    <div style="font-size:28px;color:#e8c878">Tide Held</div>
                    <div style="margin-top:6px;font-size:14px;opacity:0.85">All three shores defended</div>
                    <div style="margin-top:8px">Score ${Utils.formatScore(this.score)}</div>
                    <div style="margin-top:10px;font-size:13px;opacity:0.8">Space — play again · R — menu</div>
                </div>`;
        } else if (this.gameState === 'gameOver') {
            html = `
                <div style="background:rgba(22,8,8,0.82);padding:28px 36px;border:1px solid #aa4444">
                    <div style="font-size:28px;color:#ff8866">Swept Away</div>
                    <div style="margin-top:8px">Score ${Utils.formatScore(this.score)}</div>
                    <div style="margin-top:10px;font-size:13px;opacity:0.8">Space — retry · R — menu</div>
                </div>`;
        }
        this.overlayEl.innerHTML = html;
    }

    formatTowerStats(stats) {
        const bits = [
            `DMG ${Math.round(stats.damage)}`,
            `RNG ${stats.range.toFixed(1)}`,
            `SPD ${(1 / stats.fireRate).toFixed(1)}/s`
        ];
        if (stats.splash) bits.push(`SPL ${stats.splash.toFixed(1)}`);
        if (stats.slow) bits.push(`SLOW`);
        if (stats.hold) bits.push(`HOLD`);
        if (stats.pierce) bits.push(`PIERCE ${stats.pierce}`);
        if (stats.chain) bits.push(`CHAIN ${stats.chain}`);
        if (stats.auraSlow) bits.push(`AURA`);
        return bits.join(' · ');
    }

    updateStatsPanel() {
        const statsPanel = document.getElementById('game-stats-panel');
        if (!statsPanel) return;
        const statsContent = statsPanel.querySelector('.stats-content');
        if (!statsContent) return;

        statsPanel.style.width = '250px';
        statsPanel.style.minWidth = '250px';
        statsPanel.style.maxHeight = 'calc(100dvh - 180px)';
        statsPanel.style.overflowY = 'auto';

        const def = TIDEHOLD_TOWERS[this.selectedTowerType];
        const selected = this.towers.find((t) => t.id === this.selectedTowerId);
        const upCost = selected && selected.level < 3
            ? TIDEHOLD_TOWERS[selected.type].upgradeCost * selected.level
            : null;
        const selectedStats = selected ? tideholdGetTowerStats(selected) : null;
        const branchName = selected?.branch
            ? TIDEHOLD_TOWERS[selected.type].branches[selected.branch].name
            : null;

        let upgradeHtml = '';
        if (selected && selected.level < 3) {
            const canPick = !selected.branch;
            if (canPick) {
                const branches = Object.values(TIDEHOLD_TOWERS[selected.type].branches);
                upgradeHtml = `
                    <div class="stat-item">
                        <div class="stat-label">Specialize · $${upCost}</div>
                        <div class="stat-value" style="font-size:10px;line-height:1.3;font-weight:normal">
                            ${branches.map((b) => `
                                <button data-th-branch="${b.id}" class="th-btn" style="display:block;width:100%;margin:4px 0;padding:6px;text-align:left;background:#14282a;border:1px solid #4a8a7a;color:#dceef0;cursor:pointer">
                                    <b style="color:#e8c878">${b.name}</b><br>
                                    <span style="opacity:0.85">${b.blurb}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>`;
            } else if (selected.branch) {
                const next = TIDEHOLD_TOWERS[selected.type].branches[selected.branch];
                upgradeHtml = `
                    <div class="stat-item">
                        <div class="stat-label">Upgrade (U)</div>
                        <div class="stat-value" style="font-size:11px;line-height:1.35;font-weight:normal">
                            <b style="color:#e8c878">${next.name}</b> — ${next.blurb}<br>
                            <button data-th-branch="${selected.branch}" class="th-btn" style="margin-top:6px;width:100%;padding:6px;background:#3a5a4a;border:1px solid #6aaa8a;color:#fff;cursor:pointer">
                                Empower · $${upCost}
                            </button>
                        </div>
                    </div>`;
            }
        } else if (selected && selected.level >= 3) {
            upgradeHtml = `<div class="stat-item"><div class="stat-label">Maxed</div><div class="stat-value" style="font-size:11px">${branchName}</div></div>`;
        }

        statsContent.innerHTML = `
            <div class="stat-item" style="background:rgba(80,55,10,0.35);padding:8px;border:1px solid #c9a24a;border-radius:4px">
                <div class="stat-label" style="color:#e8c878">Gold</div>
                <div class="stat-value" style="color:#ffe08a;font-size:28px">${this.gold}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Campaign</div>
                <div class="stat-value" style="font-size:12px;line-height:1.35;font-weight:normal">
                    <b>${this.map.name}</b> (${this.mapIndex + 1}/${TIDEHOLD_MAPS.length})<br>
                    Wave ${Math.min(this.waveIndex + 1, this.waves.length)}/${this.waves.length}
                </div>
            </div>
            <div class="stat-item" style="margin-top:6px">
                <div class="stat-label">Build (1-3)</div>
                <div class="stat-value" style="font-size:11px;line-height:1.35;font-weight:normal">
                    <button data-th-tower="beacon" class="th-btn" style="display:block;width:100%;margin:2px 0;padding:5px;background:${this.selectedTowerType === 'beacon' ? '#3a5a4a' : '#1a2a28'};border:1px solid #4a7a6a;color:#dceef0;cursor:pointer;text-align:left"><b>Beacon</b> $${TIDEHOLD_TOWERS.beacon.cost}</button>
                    <button data-th-tower="mortar" class="th-btn" style="display:block;width:100%;margin:2px 0;padding:5px;background:${this.selectedTowerType === 'mortar' ? '#3a5a4a' : '#1a2a28'};border:1px solid #4a7a6a;color:#dceef0;cursor:pointer;text-align:left"><b>Mortar</b> $${TIDEHOLD_TOWERS.mortar.cost}</button>
                    <button data-th-tower="whirlpool" class="th-btn" style="display:block;width:100%;margin:2px 0;padding:5px;background:${this.selectedTowerType === 'whirlpool' ? '#3a5a4a' : '#1a2a28'};border:1px solid #4a7a6a;color:#dceef0;cursor:pointer;text-align:left"><b>Whirl</b> $${TIDEHOLD_TOWERS.whirlpool.cost}</button>
                </div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Selected</div>
                <div class="stat-value" style="font-size:11px;line-height:1.35;font-weight:normal">
                    ${selected
                        ? `<b>${TIDEHOLD_TOWERS[selected.type].name}</b> Lv${selected.level}${branchName ? ` · ${branchName}` : ''}<br><span style="opacity:0.8">${this.formatTowerStats(selectedStats)}</span>`
                        : `<b>${def.name}</b>`}
                </div>
            </div>
            ${upgradeHtml}
            <div class="stat-item" style="margin-top:4px">
                <div class="stat-label" style="font-size:10px;opacity:0.75;line-height:1.35">Click gold pads to build<br>Space next wave · U upgrade</div>
            </div>
        `;
        this.updateResourceHud();

        statsContent.querySelectorAll('[data-th-tower]').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                this.setTowerType(btn.getAttribute('data-th-tower'));
                this.updateStatsPanel();
            });
        });
        statsContent.querySelectorAll('[data-th-branch]').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const tower = this.towers.find((t) => t.id === this.selectedTowerId);
                if (tower) this.applyUpgrade(tower, btn.getAttribute('data-th-branch'));
            });
        });
    }

    // --- Preview / cleanup -------------------------------------------------

    drawPreview() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#071820');
        g.addColorStop(1, '#0c4a55');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e8c878';
        ctx.font = 'bold 18px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('TIDEHOLD', w / 2, h / 2 - 8);
        ctx.fillStyle = '#88e0d0';
        ctx.font = '11px Georgia';
        ctx.fillText('Hold the tide', w / 2, h / 2 + 14);
    }

    cleanup() {
        this.isDestroyed = true;
        if (this.keydownHandler) document.removeEventListener('keydown', this.keydownHandler);
        if (this.keyupHandler) document.removeEventListener('keyup', this.keyupHandler);
        if (this.pointerDownHandler) this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
        if (this.pointerMoveHandler) this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);

        if (this.overlayEl && this.overlayEl.parentNode) {
            this.overlayEl.parentNode.removeChild(this.overlayEl);
            this.overlayEl = null;
        }
        if (this.hudEl && this.hudEl.parentNode) {
            this.hudEl.parentNode.removeChild(this.hudEl);
            this.hudEl = null;
        }

        if (!this.isPreview && this.graphics) {
            const ticker = this.graphics.getTicker();
            if (ticker && this.tickerCallback) ticker.remove(this.tickerCallback);
            this.graphics.stop();
            if (this.world && this.graphics.scene) {
                this.graphics.scene.remove(this.world);
                this.disposeObject(this.world);
            }
            if (this.graphics.app) {
                this.graphics.app.destroyed = true;
            }
            if (this.graphics.renderer) {
                this.graphics.renderer.dispose();
            }
        }
    }
}

function initTidehold() {
    // Cover art used in lobby; optional preview unused
}
