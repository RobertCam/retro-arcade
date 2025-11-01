// PixiJS Core Graphics Manager for NES-style rendering
// Handles initialization, lifecycle, and pixel-perfect rendering

class GraphicsCore {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = {
            width: options.width || 800,
            height: options.height || 600,
            resolution: options.resolution || 2, // Pixel density for crisp rendering
            backgroundColor: options.backgroundColor || 0x000011,
            pixelPerfect: options.pixelPerfect !== false, // Default true
            ...options
        };
        
        // NES native resolution (will be scaled up)
        this.nesWidth = 256;
        this.nesHeight = 240;
        
        // Initialize PixiJS Application
        this.app = null;
        this.container = null;
        this.isInitialized = false;
        
        // Layers for z-ordering (background, midground, foreground, ui)
        this.layers = {};
        
        // Screen effects
        this.screenEffects = null;
        
        // Note: init() is async in PixiJS v8, must be called explicitly
        // Don't call it here to avoid issues
    }
    
    async init() {
        if (this.isInitialized) return;
        
        // Check if PixiJS is loaded
        if (typeof PIXI === 'undefined') {
            console.error('PixiJS is not loaded. Make sure the PixiJS script is included before this file.');
            this.isInitialized = false;
            return;
        }
        
        try {
            // Ensure canvas is an HTMLCanvasElement
            if (!(this.canvas instanceof HTMLCanvasElement)) {
                console.error('Canvas element is not an HTMLCanvasElement');
                this.isInitialized = false;
                return;
            }
            
            // Ensure canvas has dimensions
            if (!this.options.width || !this.options.height) {
                console.error('Canvas dimensions not specified');
                this.isInitialized = false;
                return;
            }
            
            // Create PixiJS Application
            // In v8, Application.init() is async, so we need to handle both cases
            const appConfig = {
                view: this.canvas,
                width: this.options.width,
                height: this.options.height,
                backgroundColor: this.options.backgroundColor,
                antialias: false, // Disable anti-aliasing for pixel art
                autoDensity: true,
                powerPreference: 'high-performance'
            };
            
            // Add resolution if specified
            if (this.options.resolution) {
                appConfig.resolution = this.options.resolution;
            }
            
            // Check if this is PixiJS v8 (async init) or v7 (synchronous)
            if (PIXI.Application.prototype.init) {
                // v8+ - async initialization
                this.app = new PIXI.Application();
                await this.app.init(appConfig);
            } else {
                // v7 or earlier - synchronous initialization
                this.app = new PIXI.Application(appConfig);
            }
        } catch (error) {
            console.error('Failed to create PixiJS Application:', error);
            console.error('Error details:', error.stack);
            this.isInitialized = false;
            return;
        }
        
        if (!this.app) {
            console.error('PixiJS Application is null');
            this.isInitialized = false;
            return;
        }
        
        // Verify renderer exists (should be available after init)
        if (!this.app.renderer) {
            console.error('Renderer not available after initialization!');
            this.isInitialized = false;
            return;
        }
        
        // Set pixel-perfect filtering (PixiJS v7 API)
        if (this.options.pixelPerfect) {
            // Set default scale mode for all textures (if available)
            if (PIXI.BaseTexture && PIXI.BaseTexture.defaultOptions) {
                PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;
            }
            // Also try legacy API (for v6 compatibility)
            if (PIXI.settings) {
                if (PIXI.settings.SCALE_MODE !== undefined) {
                    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
                }
                if (PIXI.settings.ROUND_PIXELS !== undefined) {
                    PIXI.settings.ROUND_PIXELS = true;
                }
            }
        }
        
        // Create main container
        this.container = new PIXI.Container();
        this.app.stage.addChild(this.container);
        
        // Create layer system (always create layers even if ticker isn't ready)
        this.createLayers();
        
        // Mark as initialized - layers are created
        this.isInitialized = true;
        
        // Initialize screen effects once renderer is confirmed ready
        this.initScreenEffects();
        
        // In PixiJS v8, app is started after init()
        // Renderer and ticker should now be available
    }
    
    initScreenEffects() {
        // Initialize screen effects - renderer should be available after async init
        try {
            if (typeof NESEffects !== 'undefined' && this.app && this.app.renderer) {
                this.screenEffects = new NESEffects(this.app);
            } else {
                if (!this.app || !this.app.renderer) {
                    console.warn('App or renderer not available for NES effects');
                } else {
                    console.warn('NESEffects class not available. Screen effects will be limited.');
                }
                this.screenEffects = null;
            }
        } catch (e) {
            console.error('Error initializing NES effects:', e);
            this.screenEffects = null;
        }
    }
    
    createLayers() {
        // Background layer (farthest)
        this.layers.background = new PIXI.Container();
        this.layers.background.zIndex = 0;
        
        // Midground layer
        this.layers.midground = new PIXI.Container();
        this.layers.midground.zIndex = 1;
        
        // Foreground layer (game objects)
        this.layers.foreground = new PIXI.Container();
        this.layers.foreground.zIndex = 2;
        
        // UI layer (closest)
        this.layers.ui = new PIXI.Container();
        this.layers.ui.zIndex = 3;
        
        // Add layers to container in order
        this.container.addChild(this.layers.background);
        this.container.addChild(this.layers.midground);
        this.container.addChild(this.layers.foreground);
        this.container.addChild(this.layers.ui);
    }
    
    // Get a specific layer
    getLayer(name) {
        if (!this.layers || !this.layers[name]) {
            console.warn(`Layer "${name}" not found, returning foreground layer`);
            return this.layers ? (this.layers.foreground || null) : null;
        }
        return this.layers[name];
    }
    
    // Add sprite to a layer
    addToLayer(sprite, layerName = 'foreground') {
        const layer = this.getLayer(layerName);
        if (!layer) {
            console.error(`Cannot add sprite to layer "${layerName}" - layer not available`);
            return sprite;
        }
        layer.addChild(sprite);
        return sprite;
    }
    
    // Remove sprite from its parent
    remove(sprite) {
        if (sprite && sprite.parent) {
            sprite.parent.removeChild(sprite);
        }
    }
    
    // Clear a layer
    clearLayer(layerName) {
        const layer = this.getLayer(layerName);
        layer.removeChildren();
    }
    
    // Clear all layers
    clear() {
        Object.values(this.layers).forEach(layer => {
            layer.removeChildren();
        });
    }
    
    // Get the application ticker for game loop
    getTicker() {
        if (!this.app) {
            console.error('Cannot get ticker - PixiJS app not initialized');
            return null;
        }
        
        // Ensure renderer is available (ticker depends on renderer)
        if (!this.app.renderer) {
            console.warn('Renderer not available yet, ticker may not be ready');
            return null;
        }
        
        // Check if ticker exists
        if (this.app.ticker) {
            return this.app.ticker;
        }
        
        // Ticker not available - return null to use requestAnimationFrame fallback
        console.warn('App ticker not available, returning null to use requestAnimationFrame fallback');
        return null;
    }
    
    // Start render loop
    start() {
        if (this.app && !this.app.ticker.started) {
            this.app.start();
        }
    }
    
    // Stop render loop
    stop() {
        if (this.app && this.app.ticker.started) {
            this.app.stop();
        }
    }
    
    // Get renderer
    getRenderer() {
        return this.app.renderer;
    }
    
    // Get screen effects
    getScreenEffects() {
        return this.screenEffects;
    }
    
    // Resize the application
    resize(width, height) {
        if (this.app) {
            this.app.renderer.resize(width, height);
            this.options.width = width;
            this.options.height = height;
        }
    }
    
    // Destroy and cleanup
    destroy() {
        if (this.screenEffects) {
            this.screenEffects.destroy();
        }
        
        // Clear all layers
        this.clear();
        
        // Remove container
        if (this.container) {
            this.app.stage.removeChild(this.container);
            this.container.destroy({ children: true });
        }
        
        // Stop and destroy app
        if (this.app) {
            this.stop();
            this.app.destroy(true, { children: true });
        }
        
        this.isInitialized = false;
        this.app = null;
        this.container = null;
        this.layers = {};
    }
    
    // Helper: Create a pixel-perfect sprite from graphics data
    createSpriteFromData(width, height, drawFunction) {
        const graphics = new PIXI.Graphics();
        drawFunction(graphics);
        return graphics;
    }
    
    // Helper: Create a texture from canvas/ImageData for pixel art
    createPixelTexture(width, height, data, scale = 1) {
        // Create a temporary canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw data to canvas
        if (data instanceof ImageData) {
            ctx.putImageData(data, 0, 0);
        } else if (typeof data === 'function') {
            data(ctx);
        }
        
        // Create texture from canvas
        const baseTexture = PIXI.BaseTexture.from(canvas);
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; // Pixel-perfect
        const texture = new PIXI.Texture(baseTexture);
        
        return texture;
    }
}

// Factory function to create a graphics core for a game
function createGraphicsCore(canvas, options = {}) {
    return new GraphicsCore(canvas, options);
}

