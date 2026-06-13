// Asset Loader for loading and managing game assets
// Handles async loading of textures with fallback to procedural graphics

class AssetLoader {
    constructor() {
        this.textureCache = {};
        this.loadingPromises = {};
        this.loadedAssets = new Set();
        this.failedAssets = new Set();
        
        // Track if PixiJS Assets API is available
        this.hasAssetsAPI = typeof PIXI !== 'undefined' && PIXI.Assets;
    }
    
    /**
     * Load a single texture from a file path
     * @param {string} path - Path to the asset file
     * @param {object} options - Loading options
     * @returns {Promise<PIXI.Texture|null>} - The loaded texture or null if failed
     */
    async loadTexture(path, options = {}) {
        // Check cache first
        if (this.textureCache[path]) {
            return this.textureCache[path];
        }
        
        // Check if already loading
        if (this.loadingPromises[path]) {
            return this.loadingPromises[path];
        }
        
        // Check if already failed
        if (this.failedAssets.has(path)) {
            if (options.fallback) {
                return null; // Return null to trigger fallback
            }
            return null;
        }
        
        // Start loading
        const loadPromise = this._loadTextureInternal(path, options);
        this.loadingPromises[path] = loadPromise;
        
        try {
            const texture = await loadPromise;
            if (texture) {
                this.textureCache[path] = texture;
                this.loadedAssets.add(path);
            } else {
                this.failedAssets.add(path);
            }
            return texture;
        } catch (error) {
            this.failedAssets.add(path);
            return null;
        } finally {
            delete this.loadingPromises[path];
        }
    }
    
    /**
     * Internal method to load texture using available API
     */
    async _loadTextureInternal(path, options = {}) {
        try {
            if (this.hasAssetsAPI) {
                try {
                    const texture = await PIXI.Assets.load(path);
                    if (texture?.baseTexture) {
                        if (options.pixelPerfect !== false) {
                            texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
                        }
                        return texture;
                    }
                } catch (e) {
                    // Missing assets are expected — fall through to null
                }
            }

            if (typeof PIXI.Texture?.from !== 'function') return null;

            const texture = PIXI.Texture.from(path);
            if (!texture?.baseTexture) return null;

            if (texture.baseTexture.resource?.source) {
                if (options.pixelPerfect !== false) {
                    texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
                }
                return texture;
            }

            return await new Promise((resolve) => {
                const baseTexture = texture.baseTexture;
                let settled = false;
                const finish = (result) => {
                    if (settled) return;
                    settled = true;
                    resolve(result);
                };

                const timeout = setTimeout(() => finish(null), 2000);

                baseTexture.once?.('loaded', () => {
                    clearTimeout(timeout);
                    if (options.pixelPerfect !== false) {
                        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
                    }
                    finish(new PIXI.Texture(baseTexture));
                });
                baseTexture.once?.('error', () => {
                    clearTimeout(timeout);
                    finish(null);
                });

                if (baseTexture.resource?.source) {
                    clearTimeout(timeout);
                    finish(texture);
                }
            });
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Load multiple textures in parallel
     * @param {string[]} paths - Array of asset paths
     * @param {object} options - Loading options
     * @returns {Promise<Object>} - Object mapping paths to textures (or null if failed)
     */
    async loadTextures(paths, options = {}) {
        const loadPromises = paths.map(path => 
            this.loadTexture(path, options).then(texture => ({ path, texture }))
        );
        
        const results = await Promise.all(loadPromises);
        const textureMap = {};
        
        results.forEach(({ path, texture }) => {
            textureMap[path] = texture;
        });
        
        return textureMap;
    }
    
    /**
     * Load all assets for a specific game
     * @param {string} gameName - Name of the game
     * @param {string[]} assetPaths - Array of asset paths for this game
     * @param {object} options - Loading options
     * @returns {Promise<Object>} - Object mapping paths to textures
     */
    async loadGameAssets(gameName, assetPaths, options = {}) {
        console.log(`Loading assets for ${gameName}...`);
        const textures = await this.loadTextures(assetPaths, options);
        
        const loadedCount = Object.values(textures).filter(t => t !== null).length;
        const failedCount = assetPaths.length - loadedCount;
        
        if (failedCount > 0) {
            console.warn(`${gameName}: ${loadedCount}/${assetPaths.length} assets loaded, ${failedCount} failed (will use fallback)`);
        } else {
            console.log(`${gameName}: All ${loadedCount} assets loaded successfully`);
        }
        
        return textures;
    }
    
    /**
     * Check if an asset is loaded
     * @param {string} path - Asset path
     * @returns {boolean}
     */
    isLoaded(path) {
        return this.loadedAssets.has(path) || this.textureCache.hasOwnProperty(path);
    }
    
    /**
     * Get a cached texture (returns null if not loaded)
     * @param {string} path - Asset path
     * @returns {PIXI.Texture|null}
     */
    getTexture(path) {
        return this.textureCache[path] || null;
    }
    
    /**
     * Clear all cached textures
     */
    clearCache() {
        Object.values(this.textureCache).forEach(texture => {
            if (texture && texture.destroy) {
                texture.destroy(true);
            }
        });
        this.textureCache = {};
        this.loadedAssets.clear();
        this.failedAssets.clear();
    }
    
    /**
     * Clear cache for a specific path
     * @param {string} path - Asset path
     */
    clearTexture(path) {
        if (this.textureCache[path]) {
            if (this.textureCache[path].destroy) {
                this.textureCache[path].destroy(true);
            }
            delete this.textureCache[path];
        }
        this.loadedAssets.delete(path);
        this.failedAssets.delete(path);
    }
    
    /**
     * Preload assets with progress callback
     * @param {string[]} paths - Asset paths to preload
     * @param {function} onProgress - Callback with (loaded, total, currentPath)
     * @returns {Promise<Object>} - Texture map
     */
    async preloadAssets(paths, onProgress = null) {
        const total = paths.length;
        let loaded = 0;
        const textureMap = {};
        
        for (const path of paths) {
            const texture = await this.loadTexture(path);
            textureMap[path] = texture;
            loaded++;
            
            if (onProgress) {
                onProgress(loaded, total, path);
            }
        }
        
        return textureMap;
    }
}

// Create a global asset loader instance
const assetLoader = new AssetLoader();

