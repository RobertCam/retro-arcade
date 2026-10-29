// Pixi-like 2D facade over Three.js meshes (Y-down canvas coords, +Z toward camera)

function threeColor(hex) {
    return new THREE.Color(typeof hex === 'string' ? hex : hex);
}

function disposeObject3D(object) {
    if (!object) return;
    object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
                if (m.map) m.map.dispose();
                m.dispose();
            });
        }
    });
}

function unwrap3D(obj) {
    return obj && obj.object ? obj.object : obj;
}

class ArcadeObject {
    constructor(object3d, options = {}) {
        this.object = object3d;
        this.width = options.width || 0;
        this.height = options.height || 0;
        this.depth = options.depth || 0;
        this.origin = options.origin || 'topleft';
        this.billboard = !!options.billboard;
        this._x = 0;
        this._y = 0;
        this._z = options.z || 0;
        this._rotation = 0;
        this._alpha = 1;
        this._scaleX = 1;
        this._scaleY = 1;
        this.children = [];
        if (options.x != null) this.x = options.x;
        else this._syncTransform();
        if (options.y != null) this.y = options.y;
        if (options.alpha != null) this.alpha = options.alpha;
        if (options.visible != null) this.visible = options.visible;
        if (options.rotation != null) this.rotation = options.rotation;
    }

    get x() { return this._x; }
    set x(v) {
        this._x = v;
        this._syncTransform();
    }

    get y() { return this._y; }
    set y(v) {
        this._y = v;
        this._syncTransform();
    }

    get z() { return this._z; }
    set z(v) {
        this._z = v;
        this._syncTransform();
    }

    get rotation() { return this._rotation; }
    set rotation(v) {
        this._rotation = v;
        this.object.rotation.z = -v;
    }

    get alpha() { return this._alpha; }
    set alpha(v) {
        this._alpha = Math.max(0, Math.min(1, v));
        this.object.traverse((child) => {
            if (!child.material) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
                m.transparent = this._alpha < 0.999;
                m.opacity = this._alpha;
                m.needsUpdate = true;
            });
        });
    }

    get visible() { return this.object.visible; }
    set visible(v) { this.object.visible = !!v; }

    get scale() {
        return this._scaleX;
    }

    set scale(v) {
        this._scaleX = v;
        this._scaleY = v;
        this._syncTransform();
    }

    _syncTransform() {
        let px = this._x;
        let py = this._y;
        if (this.origin === 'topleft') {
            px += this.width / 2;
            py += this.height / 2;
        }
        this.object.position.set(px, -py, this._z + this.depth / 2);
        this.object.scale.set(this._scaleX, this._scaleY, 1);
    }

    addChild(child) {
        const obj = unwrap3D(child);
        this.object.add(obj);
        this.children.push(child);
        return child;
    }

    removeChild(child) {
        const obj = unwrap3D(child);
        this.object.remove(obj);
        this.children = this.children.filter((c) => c !== child && unwrap3D(c) !== obj);
        return child;
    }

    destroy() {
        if (this.object.parent) this.object.parent.remove(this.object);
        disposeObject3D(this.object);
        this.children = [];
    }

    removeChildren() {
        while (this.object.children.length) {
            const child = this.object.children[0];
            this.object.remove(child);
            disposeObject3D(child);
        }
        this.children = [];
    }

    lookAtCamera(camera) {
        if (this.billboard && camera) {
            this.object.lookAt(camera.position);
        }
    }
}

class ArcadeGroup extends ArcadeObject {
    constructor(group, options = {}) {
        super(group || new window.THREE.Group(), { ...options, origin: options.origin || 'world', depth: 0 });
        this.width = options.width || 0;
        this.height = options.height || 0;
    }

    _syncTransform() {
        this.object.position.set(this._x, -this._y, this._z);
        this.object.scale.set(this._scaleX, this._scaleY, 1);
    }
}

class ThreeSpriteManager {
    constructor(graphicsCore) {
        this.graphics = graphicsCore;
        this.textureCache = {};
        this.textureLoader = window.THREE ? new window.THREE.TextureLoader() : null;
    }

    _litMaterial(color, options = {}) {
        const usePbr = options.pbr === true || options.map || options.normalMap ||
            options.roughnessMap || options.metalnessMap;
        if (usePbr) {
            const mat = new THREE.MeshStandardMaterial({
                color: threeColor(color),
                transparent: options.alpha != null && options.alpha < 1,
                opacity: options.alpha ?? 1,
                emissive: options.emissive != null ? threeColor(options.emissive) : 0x000000,
                emissiveIntensity: options.emissiveIntensity ?? 0,
                metalness: options.metalness != null ? options.metalness : (options.metalnessMap ? 1 : 0.35),
                roughness: options.roughness != null ? options.roughness : (options.roughnessMap ? 1 : 0.55),
                depthWrite: options.depthWrite !== false,
                side: THREE.DoubleSide
            });
            if (options.map) mat.map = options.map;
            if (options.normalMap) {
                mat.normalMap = options.normalMap;
                mat.normalScale = new THREE.Vector2(
                    options.normalScale ?? 1,
                    options.normalScale ?? 1
                );
            }
            if (options.roughnessMap) mat.roughnessMap = options.roughnessMap;
            if (options.metalnessMap) mat.metalnessMap = options.metalnessMap;
            if (options.aoMap) mat.aoMap = options.aoMap;
            return mat;
        }
        const mat = new THREE.MeshLambertMaterial({
            color: threeColor(color),
            transparent: options.alpha != null && options.alpha < 1,
            opacity: options.alpha ?? 1,
            emissive: options.emissive != null ? threeColor(options.emissive) : 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            depthWrite: options.depthWrite !== false,
            side: THREE.DoubleSide
        });
        return mat;
    }

    _unlitMaterial(color, options = {}) {
        return new THREE.MeshBasicMaterial({
            color: threeColor(color),
            transparent: options.alpha != null && options.alpha < 1,
            opacity: options.alpha ?? 1,
            depthWrite: options.depthWrite !== false,
            side: THREE.DoubleSide
        });
    }

    createGroup(options = {}) {
        return new ArcadeGroup(new window.THREE.Group(), options);
    }

    createRect(width, height, color, options = {}) {
        const depth = options.depth != null ? options.depth : 10;
        const geo = new THREE.BoxGeometry(width, height, depth);
        const unlit = options.unlit === true;
        const mat = unlit
            ? this._unlitMaterial(color, options)
            : this._litMaterial(color, options);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        return new ArcadeObject(mesh, {
            width,
            height,
            depth,
            origin: options.origin || 'topleft',
            ...options
        });
    }

    createCircle(radius, color, options = {}) {
        const depth = options.depth != null ? options.depth : 10;
        const segments = options.segments || 24;
        const asSphere = options.sphere === true;
        let geo;
        if (asSphere) {
            geo = new THREE.SphereGeometry(radius, segments, Math.max(12, segments / 2));
        } else {
            geo = new THREE.CylinderGeometry(radius, radius, depth, segments);
            geo.rotateX(Math.PI / 2);
        }
        const mat = options.unlit ? this._unlitMaterial(color, options) : this._litMaterial(color, options);
        const mesh = new THREE.Mesh(geo, mat);
        const size = radius * 2;
        return new ArcadeObject(mesh, {
            width: size,
            height: size,
            depth: asSphere ? radius * 2 : depth,
            origin: options.origin || 'topleft',
            ...options
        });
    }

    createSprite(texture, options = {}) {
        const THREE = window.THREE;
        const map = texture.isTexture ? texture : texture;
        map.colorSpace = THREE.SRGBColorSpace;
        map.magFilter = THREE.NearestFilter;
        map.minFilter = THREE.NearestFilter;
        const w = options.width || map.image?.width || 16;
        const h = options.height || map.image?.height || 16;
        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshBasicMaterial({
            map,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        const obj = new ArcadeObject(mesh, {
            width: w,
            height: h,
            depth: 0,
            origin: options.origin || 'topleft',
            billboard: options.billboard === true,
            ...options
        });
        return obj;
    }

    _textPixelRatio(style = {}) {
        if (style.resolution) return style.resolution;
        const pr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
        return Math.min(3, Math.max(2, Math.ceil(pr)));
    }

    _paintTextCanvas(canvas, ctx, text, style, logicalW, logicalH) {
        const fontSize = style.fontSize || 16;
        const fontFamily = style.fontFamily || 'Courier New, monospace';
        const fontWeight = style.fontWeight || 'bold';
        const fill = style.fill != null ? style.fill : 0xffffff;
        const pad = 6;
        const scale = this._textPixelRatio(style);

        canvas.width = Math.max(2, Math.ceil(logicalW * scale));
        canvas.height = Math.max(2, Math.ceil(logicalH * scale));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = '#' + threeColor(fill).getHexString();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.imageSmoothingEnabled = true;
        ctx.fillText(String(text), pad, logicalH / 2);
        return scale;
    }

    createText(text, style = {}) {
        const THREE = window.THREE;
        const fontSize = style.fontSize || 16;
        const fontFamily = style.fontFamily || 'Courier New, monospace';
        const fontWeight = style.fontWeight || 'bold';
        const pad = 6;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const metrics = ctx.measureText(String(text));
        const width = Math.max(2, Math.ceil(metrics.width) + pad * 2);
        const height = Math.max(2, Math.ceil(fontSize * 1.45) + pad * 2);
        this._paintTextCanvas(canvas, ctx, text, style, width, height);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;

        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            depthTest: style.depthTest !== false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
        const obj = new ArcadeObject(mesh, {
            width,
            height,
            depth: 0,
            origin: style.origin || 'center',
            billboard: style.billboard === true,
            z: style.z || 0
        });
        obj._textCanvas = canvas;
        obj._textCtx = ctx;
        obj._textStyle = style;
        obj.setText = (next) => this._rewriteText(obj, next);
        return obj;
    }

    _rewriteText(obj, text) {
        const style = obj._textStyle || {};
        const fontSize = style.fontSize || 16;
        const fontFamily = style.fontFamily || 'Courier New, monospace';
        const fontWeight = style.fontWeight || 'bold';
        const pad = 6;
        const ctx = obj._textCtx;
        const canvas = obj._textCanvas;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const metrics = ctx.measureText(String(text));
        const width = Math.max(2, Math.ceil(metrics.width) + pad * 2);
        const height = Math.max(2, Math.ceil(fontSize * 1.45) + pad * 2);
        this._paintTextCanvas(canvas, ctx, text, style, width, height);
        obj.width = width;
        obj.height = height;
        obj.object.geometry.dispose();
        obj.object.geometry = new THREE.PlaneGeometry(width, height);
        const map = obj.object.material.map;
        map.generateMipmaps = false;
        map.minFilter = THREE.LinearFilter;
        map.magFilter = THREE.LinearFilter;
        map.needsUpdate = true;
        obj._syncTransform();
    }

    async loadTexture(path, options = {}) {
        if (this.textureCache[path]) return this.textureCache[path];
        if (!this.textureLoader) return null;
        try {
            const texture = await this.textureLoader.loadAsync(path);
            texture.colorSpace = options.colorSpace === 'linear'
                ? THREE.NoColorSpace
                : THREE.SRGBColorSpace;
            if (options.pixelPerfect === false) {
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.generateMipmaps = true;
            } else {
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
            }
            this.textureCache[path] = texture;
            return texture;
        } catch (err) {
            return null;
        }
    }
}
