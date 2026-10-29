// Mousetrap — 3D third-person maze chase (Three.js) with classic Pac-Man mini-map
class MousePacmanGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width || 800;
        this.height = canvas.height || 600;
        this.isPreview = this.width < 400;
        this.onReady = null;
        this.isReady = false;
        this.isDestroyed = false;

        this.gameState = 'menu';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.highScore = 0;

        // Classic Pac-Man proportions: loop corridors, no plazas / cul-de-sacs
        this.mazeCols = 28;
        this.mazeRows = 31;
        this.cellSize = 1.85;
        this.wallHeight = 2.2;

        this.maze = [];
        this.tunnelRow = 14;
        this.mouseStartPos = { x: 14, y: 23 };
        this.cheeseCount = 0;
        this.powerPelletCount = 0;
        this.initialCheeseCount = 0;
        this.initialPowerPelletCount = 0;

        // Baselines — mouse stays deliberate; tension comes from routing
        this.baseMouseDelay = 165;
        this.baseCatDelay = 310;
        this.powerModeDuration = 8000;

        this.mouse = {
            x: 14,
            y: 23,
            direction: 3, // start facing up the opening straight
            nextDirection: 3,
            moveTimer: 0,
            moveDelay: this.baseMouseDelay,
            mouthFrame: 0,
            mouthFrameTime: 0,
            worldX: 0,
            worldZ: 0,
            facing: 0
        };

        this.cats = [];
        this.powerModeActive = false;
        this.powerModeTimer = 0;
        this.catsEatenThisPower = 0;

        this.lastTime = 0;
        this.readyTimer = 0;
        this.readyDuration = 1800;
        this.animationTime = 0;

        this.keys = {};
        this.graphics = null;
        this.world = null;
        this.mazeGroup = null;
        this.cheeseGroup = null;
        this.cheeseMeshes = new Map();
        this.mouseMesh = null;
        this.catMeshes = [];
        this.floorMesh = null;
        this.overlayEl = null;
        this.stageEl = null;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.tickerCallback = null;
        this.animationFrameId = null;
        this.floorGroup = null;
        this._camPos = null;
        this._camLook = null;
        this._camTargetPos = null;
        this._camTargetLook = null;

        this.initializeMaze();
        this.initializeCats();
        this.mouse.x = this.mouseStartPos.x;
        this.mouse.y = this.mouseStartPos.y;
        this.syncWorldFromGrid(this.mouse);

        this.setupInput();

        if (this.isPreview) {
            this.ctx = canvas.getContext('2d');
            this.drawPreview();
            this.markReady();
            return;
        }

        this.ctx = null;
        this.graphics = new ThreeGraphicsCore(canvas, {
            width: this.width,
            height: this.height,
            backgroundColor: 0x0b0d14,
            cameraMode: 'world3d'
        });

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
                console.error('Mousetrap: Three.js init failed');
                this.markReady();
                return;
            }
            await this.finishGraphicsInit();
        } catch (err) {
            console.error('Mousetrap init failed:', err);
            this.markReady();
        }
    }

    async finishGraphicsInit() {
        const T = window.THREE;
        this._camPos = new T.Vector3();
        this._camLook = new T.Vector3();
        this._camTargetPos = new T.Vector3();
        this._camTargetLook = new T.Vector3();

        // Extra warm fill so corridors read clearly behind the mouse
        const fill = new T.PointLight(0x88aaff, 0.55, 140);
        fill.position.set(0, 18, 0);
        this.graphics.scene.add(fill);
        const warm = new T.PointLight(0xffaa66, 0.4, 100);
        warm.position.set(12, 10, 20);
        this.graphics.scene.add(warm);

        this.world = new T.Group();
        this.world.name = 'mousetrap-world';
        this.graphics.scene.add(this.world);

        this.buildFloor();
        this.buildMazeMeshes();
        this.buildCheeseMeshes();
        this.buildMouseMesh();
        this.buildCatMeshes();
        this.createHudOverlays();
        this.snapCamera(true);

        this.startGameLoop();
        this.markReady();
    }

    startGameLoop() {
        const ticker = this.graphics.getTicker();
        if (!ticker) return;
        this.tickerCallback = (tickerObj) => {
            if (this.isDestroyed) return;
            const deltaMs = Math.min(Math.max(tickerObj.deltaTime * 16.67, 1), 100);
            this.gameLoop(deltaMs);
        };
        ticker.add(this.tickerCallback);
        this.graphics.start();
    }

    // --- Maze data ---------------------------------------------------------

    initializeMaze() {
        const mazeLayout = this.getClassicMazeLayout();
        this.maze = [];
        this.cheeseCount = 0;
        this.powerPelletCount = 0;

        for (let row = 0; row < this.mazeRows; row++) {
            this.maze[row] = [];
            const line = mazeLayout[row] || '#'.repeat(this.mazeCols);
            for (let col = 0; col < this.mazeCols; col++) {
                const char = line[col] || '#';
                let cellType = 0;
                if (char === '#' || char === '=') {
                    cellType = 1;
                } else if (char === '.') {
                    cellType = 2;
                    this.cheeseCount++;
                } else if (char === 'o' || char === 'O') {
                    cellType = 3;
                    this.powerPelletCount++;
                } else {
                    cellType = 0;
                }
                this.maze[row][col] = cellType;
            }
        }

        this.initialCheeseCount = this.cheeseCount;
        this.initialPowerPelletCount = this.powerPelletCount;
        this.detectTunnelRow();
        this.findMouseStartPosition();
    }

    detectTunnelRow() {
        for (let row = 0; row < this.mazeRows; row++) {
            if (!this.maze[row]) continue;
            let leftOpen = true;
            let rightOpen = true;
            for (let col = 0; col <= 5; col++) {
                if (this.maze[row][col] === 1) { leftOpen = false; break; }
            }
            for (let col = this.mazeCols - 6; col < this.mazeCols; col++) {
                if (this.maze[row][col] === 1) { rightOpen = false; break; }
            }
            let hasDots = false;
            for (let col = 6; col < this.mazeCols - 6; col++) {
                if (this.maze[row][col] === 2 || this.maze[row][col] === 3) {
                    hasDots = true;
                    break;
                }
            }
            if (leftOpen && rightOpen && hasDots) {
                this.tunnelRow = row;
                return;
            }
        }
        this.tunnelRow = 14;
    }

    findMouseStartPosition() {
        const candidates = [
            { x: 14, y: 23 }, { x: 13, y: 23 }, { x: 15, y: 23 },
            { x: 14, y: 22 }, { x: 14, y: 24 }, { x: 13, y: 24 }, { x: 15, y: 24 }
        ];
        for (const pos of candidates) {
            if (pos.y >= 0 && pos.y < this.mazeRows &&
                pos.x >= 0 && pos.x < this.mazeCols &&
                this.maze[pos.y] && this.maze[pos.y][pos.x] !== 1) {
                this.mouseStartPos = { x: pos.x, y: pos.y };
                return;
            }
        }
        for (let row = this.mazeRows - 2; row >= Math.floor(this.mazeRows / 2); row--) {
            for (let col = 12; col <= 16; col++) {
                if (this.maze[row] && this.maze[row][col] !== 1) {
                    this.mouseStartPos = { x: col, y: row };
                    return;
                }
            }
        }
        this.mouseStartPos = { x: 14, y: 23 };
    }

    getClassicMazeLayout() {
        return (this.level - 1) % 2 === 0 ? this.getMazeLayout1() : this.getMazeLayout2();
    }

    getMazeLayout1() {
        // Classic Pac-Man loop geometry (28x31): corridors only, escapes everywhere
        return [
            "############################",
            "#............##............#",
            "#.####.#####.##.#####.####.#",
            "#o####.#####.##.#####.####o#",
            "#.####.#####.##.#####.####.#",
            "#..........................#",
            "#.####.##.########.##.####.#",
            "#.####.##.########.##.####.#",
            "#......##....##....##......#",
            "######.##### ## #####.######",
            "     #.##### ## #####.#     ",
            "     #.##          ##.#     ",
            "     #.## ######## ##.#     ",
            "######.## ######## ##.######",
            "      .              .      ",
            "######.## ######## ##.######",
            "     #.## ######## ##.#     ",
            "     #.##          ##.#     ",
            "     #.## ######## ##.#     ",
            "######.## ######## ##.######",
            "#............##............#",
            "#.####.#####.##.#####.####.#",
            "#.####.#####.##.#####.####.#",
            "#o..##.......  .......##..o#",
            "###.##.##.########.##.##.###",
            "#......##....##....##......#",
            "#.##########.##.##########.#",
            "#.##########.##.##########.#",
            "#..........................#",
            "#.##########################",
            "############################"
        ];
    }

    getMazeLayout2() {
        return [
            "############################",
            "#............##............#",
            "#.####.#####.##.#####.####.#",
            "#o####.#####.##.#####.####o#",
            "#.####.#####.##.#####.####.#",
            "#......##....##....##......#",
            "######.##### ## #####.######",
            "     #.##### ## #####.#     ",
            "     #.##          ##.#     ",
            "     #.## ######## ##.#     ",
            "######.## ######## ##.######",
            "      .              .      ",
            "######.## ######## ##.######",
            "     #.## ######## ##.#     ",
            "     #.##          ##.#     ",
            "     #.## ######## ##.#     ",
            "######.## ######## ##.######",
            "#............##............#",
            "#.####.#####.##.#####.####.#",
            "#.####.#####.##.#####.####.#",
            "#o..##.......  .......##..o#",
            "###.##.##.########.##.##.###",
            "#......##....##....##......#",
            "#.##########.##.##########.#",
            "#.##########.##.##########.#",
            "#..........................#",
            "#.##########################",
            "############################",
            "############################",
            "############################",
            "############################"
        ];
    }

    getDifficulty() {
        const level = this.level || 1;
        if (level <= 1) {
            return {
                catCount: 2,
                catDelay: 340,
                mouseDelay: 170,
                powerMs: 8500,
                introScatterMs: 4500,
                scatterMs: 3000,
                chaseMs: 3800,
                wanderBonus: 0.12
            };
        }
        if (level === 2) {
            return {
                catCount: 3,
                catDelay: 315,
                mouseDelay: 160,
                powerMs: 8000,
                introScatterMs: 3200,
                scatterMs: 2400,
                chaseMs: 4200,
                wanderBonus: 0.05
            };
        }
        return {
            catCount: 3,
            catDelay: Math.max(250, this.baseCatDelay),
            mouseDelay: Math.max(145, this.baseMouseDelay - (level - 3) * 5),
            powerMs: 7500,
            introScatterMs: 2400,
            scatterMs: 2000,
            chaseMs: 4800,
            wanderBonus: 0
        };
    }

    initializeCats() {
        const diff = this.getDifficulty();
        this.powerModeDuration = diff.powerMs;

        // Near ghost-house / top lanes — far from bottom start
        const roster = [
            {
                x: 1, y: 1, dir: 0,
                personality: this.level <= 1 ? 'roam' : 'chase',
                color: '#ff5555', name: 'Blinky'
            },
            { x: 26, y: 1, dir: 2, personality: 'flank', color: '#ffb8ff', name: 'Pinky' },
            { x: 14, y: 11, dir: 1, personality: 'roam', color: '#55ffff', name: 'Inky' }
        ];

        this.cats = roster.slice(0, diff.catCount).map((pos, index) => ({
            x: pos.x,
            y: pos.y,
            direction: pos.dir,
            moveTimer: 400 + index * 180,
            moveDelay: diff.catDelay + index * 40,
            color: pos.color,
            name: pos.name,
            personality: pos.personality,
            state: 'scatter',
            scatterTimer: diff.introScatterMs + index * 500,
            respawnTimer: null,
            worldX: 0,
            worldZ: 0,
            facing: this.dirToYaw(pos.dir)
        }));

        this.cats.forEach((cat) => this.syncWorldFromGrid(cat));
    }

    // --- World helpers -----------------------------------------------------

    cellToWorld(col, row) {
        const cs = this.cellSize;
        return {
            x: (col - this.mazeCols / 2 + 0.5) * cs,
            z: (row - this.mazeRows / 2 + 0.5) * cs
        };
    }

    syncWorldFromGrid(entity) {
        const w = this.cellToWorld(entity.x, entity.y);
        entity.worldX = w.x;
        entity.worldZ = w.z;
        entity.facing = this.dirToYaw(entity.direction);
    }

    dirToYaw(dir) {
        // 0 right (+X), 1 down (+Z), 2 left (-X), 3 up (-Z)
        if (dir === 0) return Math.PI / 2;
        if (dir === 1) return 0;
        if (dir === 2) return -Math.PI / 2;
        return Math.PI;
    }

    dirVector(dir) {
        if (dir === 0) return { x: 1, z: 0 };
        if (dir === 1) return { x: 0, z: 1 };
        if (dir === 2) return { x: -1, z: 0 };
        return { x: 0, z: -1 };
    }

    // --- 3D mesh builders --------------------------------------------------

    buildFloor() {
        const T = window.THREE;
        if (this.floorGroup) {
            this.world.remove(this.floorGroup);
            this.floorGroup.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
                    else obj.material.dispose();
                }
            });
        }

        this.floorGroup = new T.Group();
        const w = this.mazeCols * this.cellSize;
        const d = this.mazeRows * this.cellSize;
        const geo = new T.PlaneGeometry(w + 4, d + 4);
        const mat = new T.MeshStandardMaterial({
            color: 0x1a1520,
            roughness: 0.92,
            metalness: 0.05
        });
        const floor = new T.Mesh(geo, mat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.floorGroup.add(floor);
        this.floorMesh = floor;

        const tileGeo = new T.PlaneGeometry(this.cellSize * 0.96, this.cellSize * 0.96);
        const tileMat = new T.MeshStandardMaterial({
            color: 0x2a2435,
            roughness: 0.85,
            metalness: 0.08
        });
        for (let row = 0; row < this.mazeRows; row++) {
            for (let col = 0; col < this.mazeCols; col++) {
                if (this.maze[row][col] === 1) continue;
                const tile = new T.Mesh(tileGeo, tileMat);
                tile.rotation.x = -Math.PI / 2;
                const pos = this.cellToWorld(col, row);
                tile.position.set(pos.x, 0.02, pos.z);
                this.floorGroup.add(tile);
            }
        }
        this.world.add(this.floorGroup);
    }

    buildMazeMeshes() {
        const T = window.THREE;
        if (this.mazeGroup) {
            this.world.remove(this.mazeGroup);
            this.mazeGroup.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
                    else obj.material.dispose();
                }
            });
        }

        this.mazeGroup = new T.Group();
        const wallMat = new T.MeshStandardMaterial({
            color: 0x8b5a2b,
            roughness: 0.75,
            metalness: 0.12
        });
        const trimMat = new T.MeshStandardMaterial({
            color: 0x3d2914,
            roughness: 0.7,
            metalness: 0.05
        });
        const cs = this.cellSize;
        const geo = new T.BoxGeometry(cs * 0.95, this.wallHeight, cs * 0.95);
        const trimGeo = new T.BoxGeometry(cs * 0.98, 0.12, cs * 0.98);

        for (let row = 0; row < this.mazeRows; row++) {
            for (let col = 0; col < this.mazeCols; col++) {
                if (this.maze[row][col] !== 1) continue;
                const pos = this.cellToWorld(col, row);
                const wall = new T.Mesh(geo, wallMat);
                wall.position.set(pos.x, this.wallHeight / 2, pos.z);
                this.mazeGroup.add(wall);

                const trim = new T.Mesh(trimGeo, trimMat);
                trim.position.set(pos.x, this.wallHeight + 0.02, pos.z);
                this.mazeGroup.add(trim);
            }
        }
        this.world.add(this.mazeGroup);
    }

    buildCheeseMeshes() {
        const T = window.THREE;
        if (this.cheeseGroup) {
            this.world.remove(this.cheeseGroup);
            this.cheeseMeshes.forEach((mesh) => {
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) mesh.material.dispose();
            });
            this.cheeseMeshes.clear();
        }

        this.cheeseGroup = new T.Group();
        const dotGeo = new T.SphereGeometry(0.18, 10, 8);
        const powerGeo = new T.SphereGeometry(0.38, 12, 10);
        const cheeseMat = new T.MeshStandardMaterial({
            color: 0xffdd44,
            emissive: 0xaa8800,
            emissiveIntensity: 0.45,
            roughness: 0.4
        });
        const powerMat = new T.MeshStandardMaterial({
            color: 0xffee88,
            emissive: 0xffcc00,
            emissiveIntensity: 0.8,
            roughness: 0.35
        });

        for (let row = 0; row < this.mazeRows; row++) {
            for (let col = 0; col < this.mazeCols; col++) {
                const cell = this.maze[row][col];
                if (cell !== 2 && cell !== 3) continue;
                const mesh = new T.Mesh(
                    cell === 3 ? powerGeo : dotGeo,
                    cell === 3 ? powerMat.clone() : cheeseMat
                );
                const pos = this.cellToWorld(col, row);
                mesh.position.set(pos.x, cell === 3 ? 0.55 : 0.35, pos.z);
                mesh.userData = { col, row, isPower: cell === 3 };
                this.cheeseGroup.add(mesh);
                this.cheeseMeshes.set(`${col},${row}`, mesh);
            }
        }
        this.world.add(this.cheeseGroup);
    }

    buildMouseMesh() {
        const T = window.THREE;
        if (this.mouseMesh) {
            this.world.remove(this.mouseMesh);
        }

        const root = new T.Group();
        const bodyMat = new T.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.55 });
        const darkMat = new T.MeshStandardMaterial({ color: 0x707070, roughness: 0.6 });
        const pinkMat = new T.MeshStandardMaterial({ color: 0xff9ab5, roughness: 0.5 });

        const body = new T.Mesh(new T.SphereGeometry(0.45, 16, 12), bodyMat);
        body.scale.set(1.15, 0.85, 1.35);
        body.position.y = 0.45;
        root.add(body);

        const head = new T.Mesh(new T.SphereGeometry(0.32, 14, 12), bodyMat);
        head.position.set(0, 0.55, 0.42);
        root.add(head);

        const earL = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), darkMat);
        earL.position.set(-0.22, 0.82, 0.35);
        root.add(earL);
        const earR = earL.clone();
        earR.position.x = 0.22;
        root.add(earR);

        const earInnerL = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), pinkMat);
        earInnerL.position.set(-0.22, 0.82, 0.42);
        root.add(earInnerL);
        const earInnerR = earInnerL.clone();
        earInnerR.position.x = 0.22;
        root.add(earInnerR);

        const nose = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), pinkMat);
        nose.position.set(0, 0.5, 0.72);
        root.add(nose);

        const eyeMat = new T.MeshStandardMaterial({ color: 0x111111 });
        const eyeL = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), eyeMat);
        eyeL.position.set(-0.12, 0.62, 0.62);
        root.add(eyeL);
        const eyeR = eyeL.clone();
        eyeR.position.x = 0.12;
        root.add(eyeR);

        const tail = new T.Mesh(
            new T.CylinderGeometry(0.05, 0.03, 0.9, 6),
            darkMat
        );
        tail.rotation.x = Math.PI / 2.4;
        tail.position.set(0, 0.4, -0.7);
        root.add(tail);

        this.mouseMesh = root;
        this.world.add(root);
        this.updateMouseMesh(1);
    }

    buildCatMeshes() {
        const T = window.THREE;
        this.catMeshes.forEach((mesh) => {
            if (mesh.parent) mesh.parent.remove(mesh);
        });
        this.catMeshes = [];

        this.cats.forEach((cat) => {
            const root = new T.Group();
            const color = parseInt(cat.color.replace('#', ''), 16);
            const fur = new T.MeshStandardMaterial({ color, roughness: 0.55 });
            const dark = new T.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
            const pink = new T.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.5 });

            const body = new T.Mesh(new T.SphereGeometry(0.48, 14, 12), fur);
            body.scale.set(1.1, 0.85, 1.4);
            body.position.y = 0.5;
            root.add(body);

            const head = new T.Mesh(new T.SphereGeometry(0.34, 12, 10), fur);
            head.position.set(0, 0.7, 0.45);
            root.add(head);

            const earGeo = new T.ConeGeometry(0.12, 0.28, 6);
            const earL = new T.Mesh(earGeo, fur);
            earL.position.set(-0.18, 1.05, 0.4);
            root.add(earL);
            const earR = earL.clone();
            earR.position.x = 0.18;
            root.add(earR);

            const eyeL = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshStandardMaterial({ color: 0xffffaa }));
            eyeL.position.set(-0.12, 0.75, 0.7);
            root.add(eyeL);
            const eyeR = eyeL.clone();
            eyeR.position.x = 0.12;
            root.add(eyeR);

            const pupilL = new T.Mesh(new T.SphereGeometry(0.03, 6, 6), dark);
            pupilL.position.set(-0.12, 0.75, 0.76);
            root.add(pupilL);
            const pupilR = pupilL.clone();
            pupilR.position.x = 0.12;
            root.add(pupilR);

            const nose = new T.Mesh(new T.SphereGeometry(0.05, 6, 6), pink);
            nose.position.set(0, 0.62, 0.78);
            root.add(nose);

            const tail = new T.Mesh(new T.CylinderGeometry(0.06, 0.04, 0.85, 6), fur);
            tail.rotation.z = 0.6;
            tail.rotation.x = Math.PI / 3;
            tail.position.set(0.15, 0.7, -0.55);
            root.add(tail);

            root.userData.baseColor = color;
            root.userData.fur = fur;
            this.catMeshes.push(root);
            this.world.add(root);
        });

        this.updateCatMeshes(1);
    }

    // --- HUD / mini-map ----------------------------------------------------

    createHudOverlays() {
        const wrapper = this.canvas.parentElement;
        if (!wrapper) return;

        const stage = document.createElement('div');
        stage.className = 'mousetrap-stage';
        wrapper.insertBefore(stage, this.canvas);
        stage.appendChild(this.canvas);
        this.stageEl = stage;

        const map = document.createElement('canvas');
        map.id = 'mousetrap-minimap';
        map.className = 'mousetrap-minimap';
        map.width = 168;
        map.height = 186;
        map.setAttribute('aria-label', 'Maze mini-map');
        stage.appendChild(map);
        this.minimapCanvas = map;
        this.minimapCtx = map.getContext('2d');

        const overlay = document.createElement('div');
        overlay.className = 'mousetrap-overlay';
        overlay.innerHTML = `
            <div class="mousetrap-overlay-card">
                <div class="mousetrap-overlay-title"></div>
                <div class="mousetrap-overlay-sub"></div>
            </div>
        `;
        stage.appendChild(overlay);
        this.overlayEl = overlay;
        this.updateOverlay();
    }

    updateOverlay() {
        if (!this.overlayEl) return;
        const title = this.overlayEl.querySelector('.mousetrap-overlay-title');
        const sub = this.overlayEl.querySelector('.mousetrap-overlay-sub');
        if (!title || !sub) return;

        let show = true;
        if (this.gameState === 'menu') {
            title.textContent = 'MOUSETRAP';
            sub.textContent = '← → turn · ↓ reverse · always run forward';
        } else if (this.gameState === 'ready') {
            title.textContent = 'READY!';
            sub.textContent = 'Watch the mini-map for cats';
        } else if (this.gameState === 'paused') {
            title.textContent = 'PAUSED';
            sub.textContent = 'Press P or SPACE to resume';
        } else if (this.gameState === 'gameOver') {
            title.textContent = 'GAME OVER';
            sub.textContent = `Score ${Utils.formatScore(this.score)} · SPACE to retry`;
        } else {
            show = false;
        }
        this.overlayEl.classList.toggle('visible', show);
    }

    drawMinimap() {
        const ctx = this.minimapCtx;
        if (!ctx || !this.minimapCanvas) return;

        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;
        const pad = 6;
        const cellW = (w - pad * 2) / this.mazeCols;
        const cellH = (h - pad * 2) / this.mazeRows;

        ctx.fillStyle = '#000008';
        ctx.fillRect(0, 0, w, h);

        // Border
        ctx.strokeStyle = '#2121de';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);

        for (let row = 0; row < this.mazeRows; row++) {
            for (let col = 0; col < this.mazeCols; col++) {
                const cell = this.maze[row][col];
                const x = pad + col * cellW;
                const y = pad + row * cellH;
                if (cell === 1) {
                    ctx.fillStyle = '#2121de';
                    ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
                } else if (cell === 2) {
                    ctx.fillStyle = '#ffb8ae';
                    ctx.fillRect(x + cellW * 0.35, y + cellH * 0.35, cellW * 0.3, cellH * 0.3);
                } else if (cell === 3) {
                    ctx.fillStyle = '#ffb8ae';
                    ctx.beginPath();
                    ctx.arc(x + cellW / 2, y + cellH / 2, Math.max(2, cellW * 0.35), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Cats
        this.cats.forEach((cat) => {
            if (!cat || cat.state === 'eaten') return;
            const x = pad + cat.x * cellW + cellW / 2;
            const y = pad + cat.y * cellH + cellH / 2;
            ctx.fillStyle = cat.state === 'frightened' ? '#2121de' : cat.color;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(2.5, cellW * 0.45), 0, Math.PI * 2);
            ctx.fill();
        });

        // Mouse
        const mx = pad + this.mouse.x * cellW + cellW / 2;
        const my = pad + this.mouse.y * cellH + cellH / 2;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(2.8, cellW * 0.5), 0, Math.PI * 2);
        ctx.fill();

        // Direction wedge
        const dv = this.dirVector(this.mouse.direction);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(mx + dv.x * cellW * 0.35, my + dv.z * cellH * 0.35);
        ctx.lineTo(mx - dv.z * cellW * 0.25, my + dv.x * cellH * 0.25);
        ctx.lineTo(mx + dv.z * cellW * 0.25, my - dv.x * cellH * 0.25);
        ctx.closePath();
        ctx.fill();
    }

    // --- Input / game flow -------------------------------------------------

    setupInput() {
        this.keydownHandler = (e) => {
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal && nameEntryModal.classList.contains('active')) return;
            if (!this.isPreview) {
                const activeCanvas = document.getElementById('game-canvas');
                if (activeCanvas !== this.canvas) return;
            }

            this.keys[e.code] = true;

            if (e.code === 'Space') {
                if (this.gameState === 'menu' || this.gameState === 'gameOver') {
                    this.startGame();
                    e.preventDefault();
                } else if (this.gameState === 'playing' || this.gameState === 'ready' || this.gameState === 'paused') {
                    this.togglePause();
                    e.preventDefault();
                }
            }

            if (e.code === 'KeyP' &&
                (this.gameState === 'playing' || this.gameState === 'ready' || this.gameState === 'paused')) {
                this.togglePause();
                e.preventDefault();
            }

            if (e.code === 'KeyR' &&
                (this.gameState === 'playing' || this.gameState === 'paused' ||
                    this.gameState === 'gameOver' || this.gameState === 'ready')) {
                this.resetGame();
                e.preventDefault();
            }

            if (this.gameState !== 'playing' && this.gameState !== 'ready') return;

            // Camera-relative tank: always run forward; turn / reverse
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                this.turnMouse(-1);
                e.preventDefault();
            } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                this.turnMouse(1);
                e.preventDefault();
            } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                this.turnMouse(2);
                e.preventDefault();
            } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                // Keep forward intent (cancel a pending side turn)
                this.mouse.nextDirection = this.mouse.direction;
                e.preventDefault();
            }
        };

        this.keyupHandler = (e) => {
            if (!this.isPreview) {
                const activeCanvas = document.getElementById('game-canvas');
                if (activeCanvas !== this.canvas) return;
            }
            this.keys[e.code] = false;
        };

        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }

    /**
     * Turns are relative to where the mouse is actually facing (camera-forward).
     * Reverse applies immediately. Side turns apply now if open, else buffer.
     * @param {number} side -1 left, +1 right, +2 reverse
     */
    turnMouse(side) {
        const mouse = this.mouse;
        const basis = mouse.direction;

        if (side === 2 || side === -2) {
            const rev = (basis + 2) % 4;
            mouse.direction = rev;
            mouse.nextDirection = rev;
            return;
        }

        const desired = (basis + (side === -1 ? 3 : 1)) % 4;
        mouse.nextDirection = desired;
        if (this.canMoveInDirection(mouse.x, mouse.y, desired)) {
            mouse.direction = desired;
        }
    }

    startGame() {
        this.gameState = 'ready';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.readyTimer = 0;
        this.powerModeActive = false;
        this.powerModeTimer = 0;
        this.baseCatDelay = 310;
        const diff = this.getDifficulty();
        this.mouse.moveDelay = diff.mouseDelay;
        this.powerModeDuration = diff.powerMs;

        this.initializeMaze();
        this.mouse.x = this.mouseStartPos.x;
        this.mouse.y = this.mouseStartPos.y;
        this.mouse.direction = 3;
        this.mouse.nextDirection = 3;
        this.mouse.moveTimer = 0;
        this.syncWorldFromGrid(this.mouse);

        this.initializeCats();
        this.rebuildWorldGeometry();
        this.snapCamera(true);
        this.updateOverlay();

        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('mouse-pacman', 'start');
    }

    resetGame() {
        this.startGame();
    }

    togglePause() {
        if (this.gameState === 'playing' || this.gameState === 'ready') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
        }
        this.updateOverlay();
    }

    gameOver() {
        if (this.isDestroyed) return;
        this.gameState = 'gameOver';
        this.updateOverlay();
        if (typeof audioManager !== 'undefined') audioManager.playSfx('gameOver');

        const activeCanvas = document.getElementById('game-canvas');
        if (activeCanvas && activeCanvas === this.canvas) {
            if (highScoreManager.checkHighScore('mouse-pacman', this.score)) {
                highScoreManager.requestNameEntry('mouse-pacman', this.score);
            }
        }
    }

    rebuildWorldGeometry() {
        if (this.isPreview || !this.world || !window.THREE) return;
        this.buildFloor();
        this.buildMazeMeshes();
        this.buildCheeseMeshes();
        this.buildCatMeshes();
        this.updateMouseMesh(1);
        this.updateCatMeshes(1);
    }

    // --- Loop / update -----------------------------------------------------

    gameLoop(deltaTime) {
        if (this.isDestroyed) return;
        this.animationTime += deltaTime;

        try {
            if (this.gameState === 'playing') {
                this.update(deltaTime);
            } else if (this.gameState === 'ready') {
                this.readyTimer += deltaTime;
                if (this.readyTimer >= this.readyDuration) {
                    this.gameState = 'playing';
                    this.readyTimer = 0;
                    this.updateOverlay();
                }
            }

            this.draw(deltaTime);
        } catch (err) {
            console.error('Mousetrap loop error:', err);
            if (this.gameState === 'playing') this.gameState = 'ready';
        }
    }

    update(deltaTime) {
        if (!deltaTime || isNaN(deltaTime) || deltaTime <= 0) deltaTime = 16.67;

        if (this.powerModeActive) {
            this.powerModeTimer += deltaTime;
            if (this.powerModeTimer >= this.powerModeDuration) {
                this.powerModeActive = false;
                this.powerModeTimer = 0;
                if (typeof audioManager !== 'undefined') audioManager.playGameSfx('mouse-pacman', 'alert');
                this.cats.forEach((cat) => {
                    if (cat && cat.state === 'frightened') cat.state = 'chase';
                });
            }
        }

        this.updateMouse(deltaTime);
        this.updateCats(deltaTime);
        this.checkCollisions();

        if (this.cheeseCount === 0 && this.powerPelletCount === 0) {
            this.nextLevel();
        }
    }

    updateMouse(deltaTime) {
        const mouse = this.mouse;
        mouse.moveTimer += deltaTime;

        // Re-try buffered side turn every frame (intersection / opening)
        if (mouse.nextDirection !== mouse.direction) {
            if (this.canMoveInDirection(mouse.x, mouse.y, mouse.nextDirection)) {
                mouse.direction = mouse.nextDirection;
            }
        }

        if (mouse.moveTimer >= mouse.moveDelay) {
            mouse.moveTimer = 0;

            // Prefer buffered turn at the moment of stepping
            if (mouse.nextDirection !== mouse.direction &&
                this.canMoveInDirection(mouse.x, mouse.y, mouse.nextDirection)) {
                mouse.direction = mouse.nextDirection;
            }

            let nextX = mouse.x;
            let nextY = mouse.y;
            if (mouse.direction === 0) nextX++;
            else if (mouse.direction === 1) nextY++;
            else if (mouse.direction === 2) nextX--;
            else if (mouse.direction === 3) nextY--;

            if (mouse.y === this.tunnelRow) {
                if (mouse.direction === 2 && nextX < 0) nextX = this.mazeCols - 1;
                else if (mouse.direction === 0 && nextX >= this.mazeCols) nextX = 0;
            }

            if (this.isValidCell(nextX, nextY)) {
                mouse.x = nextX;
                mouse.y = nextY;
                this.checkCheeseCollection(mouse.x, mouse.y);
            }
            // Hit a wall: stay put and keep facing — reverse/turn still work
        }

        mouse.mouthFrameTime += deltaTime;
        if (mouse.mouthFrameTime > 150) {
            mouse.mouthFrame = (mouse.mouthFrame + 1) % 2;
            mouse.mouthFrameTime = 0;
        }

        const target = this.cellToWorld(mouse.x, mouse.y);
        const lerp = Math.min(1, deltaTime / mouse.moveDelay);
        mouse.worldX += (target.x - mouse.worldX) * Math.max(0.18, lerp);
        mouse.worldZ += (target.z - mouse.worldZ) * Math.max(0.18, lerp);
        const yawTarget = this.dirToYaw(mouse.direction);
        mouse.facing = this.lerpAngle(mouse.facing, yawTarget, 0.28);
    }

    updateCats(deltaTime) {
        this.cats.forEach((cat, index) => {
            if (!cat) return;

            if (cat.state === 'eaten') {
                if (cat.respawnTimer == null) cat.respawnTimer = 2800;
                cat.respawnTimer -= deltaTime;
                if (cat.respawnTimer <= 0) {
                    const starts = [
                        { x: 1, y: 1 }, { x: 26, y: 1 }, { x: 14, y: 11 }
                    ];
                    const pos = starts[index] || { x: 14, y: 11 };
                    cat.x = pos.x;
                    cat.y = pos.y;
                    cat.state = 'scatter';
                    cat.scatterTimer = this.getDifficulty().introScatterMs;
                    cat.respawnTimer = null;
                    cat.moveTimer = 0;
                    this.syncWorldFromGrid(cat);
                }
                return;
            }

            // Scatter ↔ chase cadence (gives the player breathing room)
            if (cat.state === 'scatter' || cat.state === 'chase') {
                const diff = this.getDifficulty();
                cat.scatterTimer = (cat.scatterTimer || 0) - deltaTime;
                if (cat.scatterTimer <= 0) {
                    if (cat.state === 'scatter') {
                        cat.state = 'chase';
                        cat.scatterTimer = diff.chaseMs + index * 400;
                    } else {
                        cat.state = 'scatter';
                        cat.scatterTimer = diff.scatterMs + index * 300;
                    }
                }
            }

            cat.moveTimer += deltaTime;
            if (cat.moveTimer >= cat.moveDelay) {
                cat.moveTimer = 0;
                if (cat.state === 'frightened') this.chooseFleeDirection(cat);
                else this.chooseCatDirection(cat, index);

                let nextX = cat.x;
                let nextY = cat.y;
                if (cat.direction === 0) nextX++;
                else if (cat.direction === 1) nextY++;
                else if (cat.direction === 2) nextX--;
                else if (cat.direction === 3) nextY--;

                if (cat.y === this.tunnelRow) {
                    if (cat.direction === 2 && cat.x === 0) nextX = this.mazeCols - 1;
                    else if (cat.direction === 0 && cat.x === this.mazeCols - 1) nextX = 0;
                }

                if (this.isValidCell(nextX, nextY)) {
                    cat.x = nextX;
                    cat.y = nextY;
                }
            }

            const target = this.cellToWorld(cat.x, cat.y);
            const lerp = Math.min(1, deltaTime / cat.moveDelay);
            cat.worldX += (target.x - cat.worldX) * Math.max(0.12, lerp);
            cat.worldZ += (target.z - cat.worldZ) * Math.max(0.12, lerp);
            cat.facing = this.lerpAngle(cat.facing, this.dirToYaw(cat.direction), 0.15);
        });
    }

    lerpAngle(a, b, t) {
        let diff = b - a;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return a + diff * t;
    }

    isValidCell(x, y) {
        if (!this.maze || !Array.isArray(this.maze)) return false;
        if (y < 0 || y >= this.mazeRows) return false;
        const isTunnelRow = y === this.tunnelRow;
        let actualX = x;
        if (x < 0) {
            if (!isTunnelRow) return false;
            actualX = this.mazeCols - 1;
        } else if (x >= this.mazeCols) {
            if (!isTunnelRow) return false;
            actualX = 0;
        }
        if (!this.maze[y] || this.maze[y][actualX] === undefined) return false;
        return this.maze[y][actualX] !== 1;
    }

    canMoveInDirection(x, y, direction) {
        if (x < 0) x = this.mazeCols - 1;
        if (x >= this.mazeCols) x = 0;
        if (y < 0 || y >= this.mazeRows) return false;

        let targetX = x;
        let targetY = y;
        if (direction === 0) targetX = x + 1;
        else if (direction === 1) targetY = y + 1;
        else if (direction === 2) targetX = x - 1;
        else if (direction === 3) targetY = y - 1;

        if (y === this.tunnelRow && direction === 2 && targetX < 0) return true;
        if (y === this.tunnelRow && direction === 0 && targetX >= this.mazeCols) return true;
        return this.isValidCell(targetX, targetY);
    }

    checkCheeseCollection(x, y) {
        if (x < 0) x = this.mazeCols - 1;
        if (x >= this.mazeCols) x = 0;
        if (y < 0 || y >= this.mazeRows) return;
        if (!this.maze[y] || this.maze[y][x] === undefined) return;

        const cell = this.maze[y][x];
        if (cell === 2) {
            this.maze[y][x] = 0;
            this.cheeseCount--;
            this.score += 10;
            this.removeCheeseMesh(x, y);
            if (typeof audioManager !== 'undefined') audioManager.playGameSfx('mouse-pacman', 'chomp');
        } else if (cell === 3) {
            this.maze[y][x] = 0;
            this.powerPelletCount--;
            this.score += 50;
            this.removeCheeseMesh(x, y);
            this.activatePowerMode();
        }
    }

    removeCheeseMesh(col, row) {
        const key = `${col},${row}`;
        const mesh = this.cheeseMeshes.get(key);
        if (mesh) {
            if (mesh.parent) mesh.parent.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            this.cheeseMeshes.delete(key);
        }
    }

    activatePowerMode() {
        this.powerModeActive = true;
        this.powerModeTimer = 0;
        this.catsEatenThisPower = 0;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('mouse-pacman', 'power');
        this.cats.forEach((cat) => {
            if (cat && cat.state !== 'eaten') {
                cat.state = 'frightened';
                cat.direction = (cat.direction + 2) % 4;
            }
        });
    }

    getCatTarget(cat, index) {
        const scatterCorners = [
            { x: this.mazeCols - 2, y: 1 },
            { x: 1, y: 1 },
            { x: this.mazeCols - 2, y: this.mazeRows - 2 }
        ];

        if (cat.state === 'scatter') {
            return scatterCorners[index % scatterCorners.length];
        }

        const mx = this.mouse.x;
        const my = this.mouse.y;
        const dv = this.dirVector(this.mouse.direction);

        if (cat.personality === 'flank') {
            // Aim a few tiles ahead of the mouse
            return {
                x: mx + dv.x * 4,
                y: my + dv.z * 4
            };
        }
        if (cat.personality === 'roam') {
            // Loose pull toward mouse with noise — feels like patrolling
            return {
                x: mx + (Math.random() < 0.5 ? -5 : 5),
                y: my + (Math.random() < 0.5 ? -3 : 3)
            };
        }
        // chase personality: direct
        return { x: mx, y: my };
    }

    chooseCatDirection(cat, index) {
        const possibleDirs = [];
        const reverse = (cat.direction + 2) % 4;
        for (let dir = 0; dir < 4; dir++) {
            if (dir === reverse) continue;
            if (this.canMoveInDirection(cat.x, cat.y, dir)) possibleDirs.push(dir);
        }
        if (possibleDirs.length === 0) {
            for (let dir = 0; dir < 4; dir++) {
                if (this.canMoveInDirection(cat.x, cat.y, dir)) possibleDirs.push(dir);
            }
        }
        if (possibleDirs.length === 0) return;
        if (possibleDirs.length === 1) {
            cat.direction = possibleDirs[0];
            return;
        }

        // Roamers often pick randomly so they don't dogpile
        const bonus = this.getDifficulty().wanderBonus || 0;
        const wanderChance = (cat.personality === 'roam' ? 0.55
            : cat.personality === 'flank' ? 0.28
            : 0.18) + bonus;
        if (Math.random() < wanderChance) {
            cat.direction = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
            return;
        }

        const target = this.getCatTarget(cat, index);
        let bestDir = possibleDirs[0];
        let bestDist = Infinity;
        possibleDirs.forEach((dir) => {
            let tx = cat.x;
            let ty = cat.y;
            if (dir === 0) tx++;
            else if (dir === 1) ty++;
            else if (dir === 2) tx--;
            else if (dir === 3) ty--;
            const dist = Math.abs(tx - target.x) + Math.abs(ty - target.y);
            const prefer = dir === cat.direction ? dist * 0.82 : dist;
            if (prefer < bestDist) {
                bestDist = prefer;
                bestDir = dir;
            }
        });
        cat.direction = bestDir;
    }

    chooseFleeDirection(cat) {
        const possibleDirs = [];
        for (let dir = 0; dir < 4; dir++) {
            if (this.canMoveInDirection(cat.x, cat.y, dir)) possibleDirs.push(dir);
        }
        if (possibleDirs.length === 0) return;

        let bestDir = possibleDirs[0];
        let bestDist = -1;
        possibleDirs.forEach((dir) => {
            let tx = cat.x;
            let ty = cat.y;
            if (dir === 0) tx++;
            else if (dir === 1) ty++;
            else if (dir === 2) tx--;
            else if (dir === 3) ty--;
            const dist = Math.abs(tx - this.mouse.x) + Math.abs(ty - this.mouse.y);
            if (dist > bestDist) {
                bestDist = dist;
                bestDir = dir;
            }
        });
        // Occasional random flee so power mode isn't trivial
        cat.direction = Math.random() < 0.25
            ? possibleDirs[Math.floor(Math.random() * possibleDirs.length)]
            : bestDir;
    }

    checkCollisions() {
        if (!this.mouse || !this.cats) return;
        this.cats.forEach((cat) => {
            if (!cat || cat.state === 'eaten') return;
            if (cat.x === this.mouse.x && cat.y === this.mouse.y) {
                if (cat.state === 'frightened') {
                    cat.state = 'eaten';
                    this.catsEatenThisPower = (this.catsEatenThisPower || 0) + 1;
                    this.score += 200 * Math.pow(2, this.catsEatenThisPower - 1);
                    if (typeof audioManager !== 'undefined') audioManager.playGameSfx('mouse-pacman', 'chomp');
                } else {
                    this.loseLife();
                }
            }
        });
    }

    loseLife() {
        this.lives--;
        if (this.lives <= 0) {
            this.gameOver();
            return;
        }

        this.mouse.x = this.mouseStartPos.x;
        this.mouse.y = this.mouseStartPos.y;
        this.mouse.direction = 3;
        this.mouse.nextDirection = 3;
        this.mouse.moveTimer = 0;
        this.syncWorldFromGrid(this.mouse);
        this.initializeCats();
        this.buildCatMeshes();
        this.powerModeActive = false;
        this.powerModeTimer = 0;
        this.gameState = 'ready';
        this.readyTimer = 0;
        this.snapCamera(true);
        this.updateOverlay();
    }

    nextLevel() {
        this.level++;
        this.score += 1000;
        this.initializeMaze();
        this.mouse.x = this.mouseStartPos.x;
        this.mouse.y = this.mouseStartPos.y;
        this.mouse.direction = 3;
        this.mouse.nextDirection = 3;
        this.mouse.moveTimer = 0;
        const diff = this.getDifficulty();
        this.mouse.moveDelay = diff.mouseDelay;
        this.baseCatDelay = Math.max(220, diff.catDelay);
        this.syncWorldFromGrid(this.mouse);

        this.initializeCats();
        this.powerModeActive = false;
        this.powerModeTimer = 0;
        this.gameState = 'ready';
        this.readyTimer = 0;
        this.rebuildWorldGeometry();
        this.snapCamera(true);
        this.updateOverlay();
    }

    // --- Draw / camera -----------------------------------------------------

    draw(deltaTime) {
        if (this.isPreview) {
            this.drawPreview();
            return;
        }
        if (!this.graphics?.isInitialized) return;

        this.updateMouseMesh(deltaTime || 16);
        this.updateCatMeshes(deltaTime || 16);
        this.pulsePowerPellets();
        this.updateCamera(deltaTime || 16);
        this.drawMinimap();
        this.updateStatsPanel();
        this.updateOverlay();
    }

    updateMouseMesh() {
        if (!this.mouseMesh) return;
        this.mouseMesh.position.set(this.mouse.worldX, 0, this.mouse.worldZ);
        this.mouseMesh.rotation.y = this.mouse.facing;
        this.mouseMesh.rotation.x = 0;
        const bob = Math.sin(this.animationTime / 120) * 0.04;
        this.mouseMesh.position.y = bob;
    }

    updateCatMeshes() {
        this.cats.forEach((cat, i) => {
            const mesh = this.catMeshes[i];
            if (!mesh || !cat) return;
            mesh.visible = cat.state !== 'eaten';
            if (!mesh.visible) return;
            mesh.position.set(cat.worldX, 0, cat.worldZ);
            mesh.rotation.y = cat.facing;
            mesh.position.y = Math.sin(this.animationTime / 140 + i) * 0.03;

            if (mesh.userData.fur) {
                if (cat.state === 'frightened') {
                    const flash = Math.floor(this.animationTime / 200) % 2 === 0;
                    mesh.userData.fur.color.setHex(flash ? 0x2121de : 0xffffff);
                    mesh.userData.fur.emissive?.setHex?.(flash ? 0x111166 : 0x444444);
                } else {
                    mesh.userData.fur.color.setHex(mesh.userData.baseColor);
                    if (mesh.userData.fur.emissive) mesh.userData.fur.emissive.setHex(0x000000);
                }
            }
        });
    }

    pulsePowerPellets() {
        this.cheeseMeshes.forEach((mesh) => {
            if (!mesh.userData?.isPower) return;
            const s = 1 + Math.sin(this.animationTime / 180) * 0.2;
            mesh.scale.setScalar(s);
            mesh.position.y = 0.55 + Math.sin(this.animationTime / 200) * 0.08;
        });
    }

    snapCamera(instant) {
        if (!this.graphics?.camera || !this._camTargetPos) return;
        this.computeCameraTargets();
        if (instant) {
            this.graphics.camera.position.copy(this._camTargetPos);
            this.graphics.camera.lookAt(this._camTargetLook);
            this._camPos.copy(this._camTargetPos);
            this._camLook.copy(this._camTargetLook);
        }
    }

    computeCameraTargets() {
        const dv = this.dirVector(this.mouse.direction);
        // Slightly elevated chase cam — reads upcoming turns without feeling floaty
        const behind = 6.2;
        const height = 4.1;
        const lookAhead = 3.0;
        this._camTargetPos.set(
            this.mouse.worldX - dv.x * behind,
            height,
            this.mouse.worldZ - dv.z * behind
        );
        this._camTargetLook.set(
            this.mouse.worldX + dv.x * lookAhead,
            0.45,
            this.mouse.worldZ + dv.z * lookAhead
        );
    }

    updateCamera(deltaTime) {
        if (!this.graphics?.camera) return;
        this.computeCameraTargets();
        const t = Math.min(1, (deltaTime || 16) / 180);
        this._camPos.lerp(this._camTargetPos, t);
        this._camLook.lerp(this._camTargetLook, t);
        this.graphics.camera.position.copy(this._camPos);
        this.graphics.camera.lookAt(this._camLook);
        this.graphics.camera.near = 0.2;
        this.graphics.camera.far = 200;
        this.graphics.camera.fov = 55;
        this.graphics.camera.updateProjectionMatrix();
    }

    updateStatsPanel() {
        const statsPanel = document.getElementById('game-stats-panel');
        if (!statsPanel) return;
        const statsContent = statsPanel.querySelector('.stats-content');
        if (!statsContent) return;

        const highScore = typeof highScoreManager !== 'undefined'
            ? highScoreManager.getTopScore('mouse-pacman')
            : 0;
        let livesHTML = '';
        for (let i = 0; i < this.lives; i++) livesHTML += '● ';

        const powerLeft = this.powerModeActive
            ? Math.max(0, Math.ceil((this.powerModeDuration - this.powerModeTimer) / 1000))
            : 0;

        statsContent.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Score</div>
                <div class="stat-value">${Utils.formatScore(this.score)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">High</div>
                <div class="stat-value">${Utils.formatScore(highScore)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Lives</div>
                <div class="stat-value">${livesHTML || '—'}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Level</div>
                <div class="stat-value">${this.level}</div>
            </div>
            ${this.powerModeActive ? `
            <div class="stat-item">
                <div class="stat-label">Power</div>
                <div class="stat-value">${powerLeft}s</div>
            </div>` : ''}
        `;
    }

    drawPreview() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.fillStyle = '#000011';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 14px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('MOUSETRAP', this.width / 2, this.height / 2 - 8);
        ctx.fillStyle = '#88aaff';
        ctx.font = '10px Courier New';
        ctx.fillText('3D Maze Chase', this.width / 2, this.height / 2 + 10);
    }

    cleanup() {
        this.isDestroyed = true;

        if (this.graphics) {
            const ticker = this.graphics.getTicker();
            if (ticker && this.tickerCallback) ticker.remove(this.tickerCallback);
            this.graphics.destroy();
            this.graphics = null;
        }

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.stageEl && this.stageEl.parentElement) {
            const parent = this.stageEl.parentElement;
            if (this.canvas && this.stageEl.contains(this.canvas)) {
                parent.insertBefore(this.canvas, this.stageEl);
            }
            parent.removeChild(this.stageEl);
        }
        this.stageEl = null;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.overlayEl = null;

        if (this.keydownHandler) document.removeEventListener('keydown', this.keydownHandler);
        if (this.keyupHandler) document.removeEventListener('keyup', this.keyupHandler);
    }
}

function initMousePacman() {
    // Lobby uses cover art — no live preview canvas needed
}
