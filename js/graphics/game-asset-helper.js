/**
 * Shared helpers for loading per-game illustrated assets with procedural fallback.
 */
class GameAssetHelper {
    constructor(spriteManager, gameId) {
        this.spriteManager = spriteManager;
        this.gameId = gameId;
        this.textures = new Map();
    }

    getPath(key, ...args) {
        return resolveManifestPath(this.gameId, key, ...args);
    }

    async loadTexture(path, options = {}) {
        if (!path || this.textures.has(path)) {
            return this.textures.get(path) || null;
        }

        const assetLoader = this.spriteManager.assetLoader;
        if (!assetLoader) return null;

        const texture = await assetLoader.loadTexture(path, {
            pixelPerfect: false,
            ...options
        });

        if (texture) {
            this.textures.set(path, texture);
        }
        return texture || null;
    }

    async loadKey(key, options = {}) {
        const path = this.getPath(key);
        if (!path) return null;
        return this.loadTexture(path, options);
    }

    async loadSprite(key, fallbackFn, options = {}) {
        const path = this.getPath(key);
        if (!path) {
            return fallbackFn ? fallbackFn() : null;
        }

        return this.spriteManager.loadSpriteFromAsset(path, fallbackFn, {
            pixelPerfect: false,
            ...options
        });
    }

    async loadDynamic(path, fallbackFn, options = {}) {
        if (!path) return fallbackFn ? fallbackFn() : null;

        const sprite = await this.spriteManager.loadSpriteFromAsset(path, fallbackFn, {
            pixelPerfect: false,
            ...options
        });

        const texture = this.spriteManager.assetLoader?.getTexture(path);
        if (texture) {
            this.textures.set(path, texture);
        }
        return sprite;
    }

    getTexture(keyOrPath) {
        const path = keyOrPath.includes('/') ? keyOrPath : this.getPath(keyOrPath);
        if (!path) return null;
        return this.textures.get(path) || this.spriteManager.getOrLoadTexture(path);
    }

    async preloadAll(onProgress) {
        const paths = getManifestPaths(this.gameId);
        const assetLoader = this.spriteManager.assetLoader;
        if (!assetLoader || paths.length === 0) {
            if (onProgress) onProgress(1, paths.length, paths.length);
            return this.textures;
        }

        let loaded = 0;
        for (const path of paths) {
            await this.loadTexture(path);
            loaded++;
            if (onProgress) onProgress(loaded / paths.length, loaded, paths.length);
        }
        return this.textures;
    }
}
