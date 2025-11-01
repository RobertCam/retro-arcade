// Sprite utilities for creating NES-style sprites and managing textures
// Provides helpers for pixel art sprite creation, texture atlases, and animations

class SpriteManager {
    constructor(graphicsCore) {
        this.graphics = graphicsCore;
        this.textureCache = {};
        this.atlases = {};
    }
    
    // Create a simple colored rectangle sprite
    createRect(width, height, color, options = {}) {
        // Always create a new Graphics object (can't efficiently cache and clone Graphics)
        const graphics = new PIXI.Graphics();
        graphics.beginFill(color);
        graphics.drawRect(0, 0, width, height);
        graphics.endFill();
        
        // Graphics objects render directly, no texture needed
        return graphics;
    }
    
    // Create a circle sprite
    createCircle(radius, color, options = {}) {
        // Always create a new Graphics object
        const graphics = new PIXI.Graphics();
        graphics.beginFill(color);
        graphics.drawCircle(radius, radius, radius);
        graphics.endFill();
        
        // Graphics objects render directly
        return graphics;
    }
    
    // Create a pixel-art sprite from a 2D array (NES-style)
    // Array format: [[1,1,1], [1,0,1], [1,1,1]] where numbers are color indices
    createFromArray(dataArray, colorPalette, pixelSize = 1) {
        const height = dataArray.length;
        const width = dataArray[0] ? dataArray[0].length : 0;
        
        const graphics = new PIXI.Graphics();
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const colorIndex = dataArray[y][x];
                if (colorIndex !== null && colorIndex !== undefined && colorIndex !== 0) {
                    const color = colorPalette[colorIndex] || colorPalette[0];
                    graphics.beginFill(color);
                    graphics.drawRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                    graphics.endFill();
                }
            }
        }
        
        return graphics;
    }
    
    // Create a sprite from a texture with pixel-perfect scaling
    createSprite(texture, options = {}) {
        const sprite = new PIXI.Sprite(texture);
        
        // Ensure pixel-perfect scaling
        if (sprite.texture && sprite.texture.baseTexture) {
            sprite.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        }
        
        // Apply options
        if (options.x !== undefined) sprite.x = options.x;
        if (options.y !== undefined) sprite.y = options.y;
        if (options.scale !== undefined) sprite.scale.set(options.scale);
        if (options.anchor !== undefined) sprite.anchor.set(options.anchor);
        if (options.alpha !== undefined) sprite.alpha = options.alpha;
        if (options.rotation !== undefined) sprite.rotation = options.rotation;
        
        return sprite;
    }
    
    // Create animated sprite from texture frames
    createAnimatedSprite(textures, options = {}) {
        const animatedSprite = new PIXI.AnimatedSprite(textures);
        
        // Ensure pixel-perfect scaling for all textures
        textures.forEach(texture => {
            if (texture && texture.baseTexture) {
                texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            }
        });
        
        // Apply options
        if (options.animationSpeed !== undefined) {
            animatedSprite.animationSpeed = options.animationSpeed;
        }
        if (options.loop !== undefined) {
            animatedSprite.loop = options.loop;
        }
        if (options.play !== false) {
            animatedSprite.play();
        }
        
        return animatedSprite;
    }
    
    // Create texture from ImageData (for pixel art)
    createTextureFromImageData(imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        
        const baseTexture = PIXI.BaseTexture.from(canvas);
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return new PIXI.Texture(baseTexture);
    }
    
    // Clear texture cache
    clearCache() {
        Object.values(this.textureCache).forEach(texture => {
            if (texture.destroy) texture.destroy(true);
        });
        this.textureCache = {};
    }
}

// Animation controller for sprite animations
class SpriteAnimation {
    constructor(sprite, frames, options = {}) {
        this.sprite = sprite;
        this.frames = frames; // Array of textures or frame indices
        this.currentFrame = 0;
        this.frameRate = options.frameRate || 10; // Frames per second
        this.loop = options.loop !== false;
        this.isPlaying = false;
        this.onComplete = options.onComplete || null;
        
        this.frameTime = 0;
        this.frameInterval = 1000 / this.frameRate;
    }
    
    play() {
        this.isPlaying = true;
        this.frameTime = 0;
    }
    
    stop() {
        this.isPlaying = false;
    }
    
    reset() {
        this.currentFrame = 0;
        this.frameTime = 0;
        this.updateFrame();
    }
    
    update(deltaTime) {
        if (!this.isPlaying) return;
        
        this.frameTime += deltaTime;
        
        if (this.frameTime >= this.frameInterval) {
            this.frameTime -= this.frameInterval;
            this.currentFrame++;
            
            if (this.currentFrame >= this.frames.length) {
                if (this.loop) {
                    this.currentFrame = 0;
                } else {
                    this.currentFrame = this.frames.length - 1;
                    this.isPlaying = false;
                    if (this.onComplete) {
                        this.onComplete();
                    }
                }
            }
            
            this.updateFrame();
        }
    }
    
    updateFrame() {
        if (this.sprite && this.frames[this.currentFrame]) {
            if (this.sprite instanceof PIXI.Sprite) {
                this.sprite.texture = this.frames[this.currentFrame];
            } else if (this.sprite instanceof PIXI.AnimatedSprite) {
                // For AnimatedSprite, use gotoAndStop
                this.sprite.gotoAndStop(this.currentFrame);
            }
        }
    }
    
    setFrame(frameIndex) {
        this.currentFrame = Math.max(0, Math.min(frameIndex, this.frames.length - 1));
        this.updateFrame();
    }
}

// Texture Atlas Manager for organizing sprites
class TextureAtlas {
    constructor(name, width, height) {
        this.name = name;
        this.width = width;
        this.height = height;
        this.regions = {};
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        this.usedSpace = [];
    }
    
    // Add a sprite region to the atlas
    addRegion(name, imageData, x, y) {
        this.ctx.putImageData(imageData, x, y);
        this.regions[name] = {
            x: x,
            y: y,
            width: imageData.width,
            height: imageData.height
        };
    }
    
    // Get texture for a region
    getTexture(name) {
        const region = this.regions[name];
        if (!region) return null;
        
        const baseTexture = PIXI.BaseTexture.from(this.canvas);
        baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        
        const texture = new PIXI.Texture(
            baseTexture,
            new PIXI.Rectangle(region.x, region.y, region.width, region.height)
        );
        
        return texture;
    }
    
    // Create sprite from region
    createSprite(name) {
        const texture = this.getTexture(name);
        if (!texture) return null;
        
        const sprite = new PIXI.Sprite(texture);
        sprite.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return sprite;
    }
}

// Helper: Convert hex color to number for PixiJS
function hexToNumber(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    return parseInt(hex, 16);
}

// Helper: Convert number to hex color
function numberToHex(num) {
    return '#' + num.toString(16).padStart(6, '0');
}

