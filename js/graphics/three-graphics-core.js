// Three.js renderer with a faux-3D playfield camera and Pixi-like layer/ticker API

class ThreeTicker {
    constructor() {
        this.callbacks = [];
        this.started = false;
    }

    add(fn) {
        if (typeof fn === 'function' && !this.callbacks.includes(fn)) {
            this.callbacks.push(fn);
        }
        return this;
    }

    remove(fn) {
        this.callbacks = this.callbacks.filter((cb) => cb !== fn);
        return this;
    }

    dispatch(deltaTime) {
        const payload = { deltaTime };
        for (const fn of this.callbacks) {
            fn(payload);
        }
    }
}

class ThreeGraphicsCore {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = {
            width: options.width || 800,
            height: options.height || 600,
            resolution: options.resolution || 2,
            backgroundColor: options.backgroundColor || 0x000011,
            cameraMode: options.cameraMode || 'playfield2d',
            ...options
        };

        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.playfield = null;
        this.layers = {};
        this.layerFacades = {};
        this.ticker = new ThreeTicker();
        this.screenEffects = null;
        this.sprites = null;
        this.assetLoader = typeof assetLoader !== 'undefined' ? assetLoader : null;
        this.isInitialized = false;
        this._running = false;
        this._rafId = null;
        this._lastTime = 0;
        this._raycaster = null;
        this._hitPoint = null;
        this.pixelRatio = this.options.resolution || 2;
        this.app = null;
    }

    async init() {
        if (this.isInitialized) return;

        if (window.__threeReadyPromise) {
            try {
                await window.__threeReadyPromise;
            } catch (err) {
                console.error('Three.js failed to load:', err);
            }
        }

        if (typeof window.THREE === 'undefined') {
            console.error('Three.js is not loaded.');
            this.isInitialized = false;
            return;
        }

        if (!(this.canvas instanceof HTMLCanvasElement)) {
            console.error('Canvas element is not an HTMLCanvasElement');
            this.isInitialized = false;
            return;
        }

        const T = window.THREE;
        const width = this.options.width;
        const height = this.options.height;

        this.renderer = new T.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false
        });
        this.pixelRatio = Math.min(this.options.resolution || 2, window.devicePixelRatio || 1);
        this.canvas.classList.add('three-canvas');
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(width, height, false);
        this.renderer.setClearColor(this.options.backgroundColor, 1);
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;

        this.scene = new T.Scene();
        this.playfield = new T.Group();
        this.scene.add(this.playfield);

        this._setupCamera();
        this._setupLights();
        this.createLayers();

        this._raycaster = new T.Raycaster();
        this._hitPoint = new T.Vector3();

        this.sprites = new ThreeSpriteManager(this);
        this.screenEffects = new ThreeEffects(this);

        this.app = {
            renderer: this.renderer,
            ticker: this.ticker,
            destroyed: false
        };

        this.isInitialized = true;
    }

    _setupCamera() {
        const THREE = window.THREE;
        const width = this.options.width;
        const height = this.options.height;

        if (this.options.cameraMode === 'world3d') {
            this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
            this.camera.position.set(0, 80, 160);
            this.camera.lookAt(0, 0, 0);
            return;
        }

        this.camera = new THREE.PerspectiveCamera(40, width / height, 10, 4000);
        this.framePlayfield(0, 0, width, height, 8);
    }

    framePlayfield(x = 0, y = 0, w = this.options.width, h = this.options.height, padding = 24, tiltFactor = 1) {
        if (!this.camera || this.options.cameraMode === 'world3d') return;
        const THREE = window.THREE;
        const worldW = Math.max(40, w + padding * 2);
        const worldH = Math.max(40, h + padding * 2);
        const cx = x + w / 2;
        const cy = -(y + h / 2);
        const dist = Math.max(360, worldH * 0.98);
        const tilt = Math.min(80, worldH * 0.14) * tiltFactor;
        const vExtent = worldH / 2 + Math.abs(tilt) * 0.5;
        const hExtent = worldW / 2;
        const fovV = THREE.MathUtils.radToDeg(2 * Math.atan(vExtent / dist));
        const aspect = this.options.width / this.options.height;
        const fovFromH = THREE.MathUtils.radToDeg(2 * Math.atan((hExtent / dist) / aspect));
        this.camera.fov = Math.max(fovV, fovFromH) * 1.02;
        this.camera.aspect = aspect;
        this.camera.near = 10;
        this.camera.far = 4000;
        this.camera.position.set(cx, cy + tilt, dist);
        this.camera.lookAt(cx, cy, 0);
        this.camera.up.set(0, 1, 0);
        this.camera.updateProjectionMatrix();
    }

    _fitPlayfieldCamera() {
        this.framePlayfield(0, 0, this.options.width, this.options.height, 8);
    }

    _setupLights() {
        const THREE = window.THREE;
        this.lights = {};

        const ambient = new THREE.AmbientLight(0xb8c4d0, 1.35);
        this.scene.add(ambient);
        this.lights.ambient = ambient;

        const key = new THREE.DirectionalLight(0xffffff, 1.65);
        key.position.set(120, 220, 640);
        this.scene.add(key);
        this.lights.key = key;

        const fill = new THREE.PointLight(0xdde7ff, 0.85, 2200);
        fill.position.set(this.options.width * 0.72, -this.options.height * 0.35, 420);
        this.scene.add(fill);
        this.lights.fill = fill;

        const rim = new THREE.DirectionalLight(0x88aacc, 0.55);
        rim.position.set(-240, -40, 380);
        this.scene.add(rim);
        this.lights.rim = rim;
    }

    createLayers() {
        const names = ['background', 'midground', 'foreground', 'ui'];
        const z = { background: -12, midground: 0, foreground: 0, ui: 48 };
        names.forEach((name) => {
            const group = new window.THREE.Group();
            group.name = name;
            this.playfield.add(group);
            this.layers[name] = group;
            this.layerFacades[name] = new ArcadeGroup(group, { origin: 'world', z: z[name] });
        });
    }

    getLayer(name) {
        if (!this.layerFacades[name]) {
            console.warn(`Layer "${name}" not found, returning foreground layer`);
            return this.layerFacades.foreground || null;
        }
        return this.layerFacades[name];
    }

    addToLayer(sprite, layerName = 'foreground') {
        const layer = this.getLayer(layerName);
        if (!layer) return sprite;
        layer.addChild(sprite);
        return sprite;
    }

    remove(sprite) {
        const obj = unwrap3D(sprite);
        if (obj && obj.parent) obj.parent.remove(obj);
    }

    clearLayer(layerName) {
        const layer = this.getLayer(layerName);
        if (layer) layer.removeChildren();
    }

    clear() {
        Object.keys(this.layerFacades).forEach((name) => this.clearLayer(name));
    }

    getTicker() {
        return this.ticker;
    }

    start() {
        if (this._running) return;
        this._running = true;
        this.ticker.started = true;
        this._lastTime = performance.now();
        const loop = (now) => {
            if (!this._running) return;
            const dt = Math.min(now - this._lastTime, 50);
            this._lastTime = now;
            const deltaTime = dt / 16.67;
            this.ticker.dispatch(deltaTime);
            this.screenEffects?.update();
            this._updateBillboards();
            this.render();
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    stop() {
        this._running = false;
        this.ticker.started = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    _updateBillboards() {
        if (!this.camera) return;
        const walk = (node) => {
            if (node && typeof node.lookAtCamera === 'function') {
                node.lookAtCamera(this.camera);
            }
            if (node && Array.isArray(node.children)) {
                node.children.forEach(walk);
            }
        };
        Object.values(this.layerFacades).forEach(walk);
    }

    render() {
        if (this.screenEffects) {
            this.screenEffects.render();
        } else if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    getRenderer() {
        return this.renderer;
    }

    getScreenEffects() {
        return this.screenEffects;
    }

    getAssetLoader() {
        return this.assetLoader;
    }

    screenToPlayfield(clientX, clientY) {
        if (!this.camera || !this.canvas || !this._raycaster) return null;
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
        const T = window.THREE;
        const plane = new T.Plane(new T.Vector3(0, 0, 1), -8);
        const hit = this._raycaster.ray.intersectPlane(plane, this._hitPoint);
        if (!hit) return null;
        return { x: hit.x, y: -hit.y };
    }

    resize(width, height) {
        this.options.width = width;
        this.options.height = height;
        if (this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
        if (this.renderer) {
            this.renderer.setSize(width, height, false);
        }
        this.screenEffects?.setSize(width, height);
        if (this.options.cameraMode !== 'world3d' && this.camera) {
            this._fitPlayfieldCamera();
        }
    }

    destroy() {
        this.stop();
        this.clear();
        this.screenEffects?.destroy();
        this.screenEffects = null;

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss?.();
        }

        if (this.canvas) this.canvas.classList.remove('three-canvas');
        if (this.app) this.app.destroyed = true;

        this.isInitialized = false;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.playfield = null;
        this.layers = {};
        this.layerFacades = {};
        this.sprites = null;
        this.app = null;
    }
}

function createThreeGraphicsCore(canvas, options = {}) {
    return new ThreeGraphicsCore(canvas, options);
}
