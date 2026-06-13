# Asset Integration Guide

This guide explains how to integrate illustrated assets into your games using the new asset loading system.

## Overview

The asset loading system has been implemented with the following components:

1. **AssetLoader** (`js/graphics/asset-loader.js`) - Handles loading textures from files
2. **SpriteManager** (updated) - Now supports loading sprites from assets with fallback
3. **GraphicsCore** (updated) - Provides access to the asset loader

## How It Works

The system supports **graceful fallback**: if an asset file doesn't exist, the game automatically uses procedural graphics instead. This means:

- ✅ Games work immediately with procedural graphics (current behavior)
- ✅ When you add asset files, they're automatically used
- ✅ Missing assets don't break the game

## Basic Usage

### Example: Loading a Single Asset

```javascript
// In your game's initSprites() method:

async initSprites() {
    if (this.isPreview) return;
    
    // Load paddle sprite with fallback
    this.paddleSprite = await this.spriteManager.loadSpriteFromAsset(
        'assets/games/breakout/paddle.png',
        // Fallback function (creates procedural graphics)
        () => {
            const graphics = new PIXI.Graphics();
            const color = parseInt(this.paddle.color.replace('#', ''), 16);
            graphics.beginFill(color);
            graphics.drawRoundedRect(0, 0, this.paddle.width, this.paddle.height, 3);
            graphics.endFill();
            return graphics;
        }
    );
    
    if (this.paddleSprite) {
        this.paddleSprite.x = this.paddle.x;
        this.paddleSprite.y = this.paddle.y;
        this.graphics.addToLayer(this.paddleSprite, 'foreground');
    }
}
```

### Example: Loading Multiple Assets

```javascript
async loadGameAssets() {
    const assetPaths = [
        'assets/games/breakout/paddle.png',
        'assets/games/breakout/ball.png',
        'assets/games/breakout/bricks/space-1.png',
        'assets/games/breakout/bricks/space-2.png'
    ];
    
    const fallbacks = {
        'assets/games/breakout/paddle.png': () => this.createProceduralPaddle(),
        'assets/games/breakout/ball.png': () => this.createProceduralBall(),
        'assets/games/breakout/bricks/space-1.png': () => this.createProceduralBrick(1),
        'assets/games/breakout/bricks/space-2.png': () => this.createProceduralBrick(2)
    };
    
    const sprites = await this.spriteManager.loadSpritesFromAssets(
        assetPaths,
        fallbacks
    );
    
    // Use the loaded sprites
    this.paddleSprite = sprites['assets/games/breakout/paddle.png'];
    this.ballSprite = sprites['assets/games/breakout/ball.png'];
}
```

### Example: Loading with Direct Texture Access

```javascript
async initAssets() {
    const assetLoader = this.graphics.getAssetLoader();
    
    if (assetLoader) {
        // Load texture directly
        const paddleTexture = await assetLoader.loadTexture('assets/games/breakout/paddle.png');
        
        if (paddleTexture) {
            // Use the loaded texture
            this.paddleSprite = new PIXI.Sprite(paddleTexture);
        } else {
            // Fallback to procedural
            this.paddleSprite = this.createProceduralPaddle();
        }
    }
}
```

## Asset Paths

Assets should be placed in the `assets/` directory following this structure:

```
assets/
├── games/
│   ├── breakout/
│   │   ├── paddle.png
│   │   ├── ball.png
│   │   └── bricks/
│   │       ├── space-1.png
│   │       └── ...
│   ├── micro-racing/
│   │   ├── player-car.png
│   │   └── ...
│   └── ...
├── ui/
│   └── button-normal.png
└── effects/
    └── particle-star.png
```

## Integration Checklist

When integrating assets into a game:

1. **Update `initSprites()` or create `async initAssets()` method**
   - Load assets using `loadSpriteFromAsset()` or `loadTextures()`
   - Provide fallback functions for procedural graphics

2. **Keep existing procedural code as fallback**
   - Don't delete your current sprite creation code
   - Wrap it in fallback functions

3. **Test both scenarios**
   - Test with assets present (should use assets)
   - Test with assets missing (should use procedural graphics)

4. **Update sprite references**
   - Make sure to use the loaded sprites instead of procedural ones
   - Update position, visibility, etc. as needed

## Performance Notes

- **Caching**: Loaded textures are cached, so loading the same asset twice is fast
- **Parallel Loading**: Use `loadTextures()` or `loadSpritesFromAssets()` to load multiple assets in parallel
- **Lazy Loading**: Only load assets when needed (e.g., when a game starts)

## Debugging

Check the browser console for asset loading messages:

- ✅ `All X assets loaded successfully` - Assets found and loaded
- ⚠️ `X/Y assets loaded, Z failed (will use fallback)` - Some assets missing (normal if assets not yet added)
- ❌ `Failed to load texture: path` - Asset file not found (will use fallback)

## Example: Breakout Game Integration

Here's how you might integrate assets into the Breakout game:

```javascript
async initSprites() {
    if (this.isPreview) return;
    
    // Load paddle
    this.paddleSprite = await this.spriteManager.loadSpriteFromAsset(
        'assets/games/breakout/paddle.png',
        () => this.createProceduralPaddle()
    );
    
    // Load ball
    this.ballSprite = await this.spriteManager.loadSpriteFromAsset(
        'assets/games/breakout/ball.png',
        () => this.createProceduralBall()
    );
    
    // Position and add to scene
    if (this.paddleSprite) {
        this.paddleSprite.x = this.paddle.x;
        this.paddleSprite.y = this.paddle.y;
        this.graphics.addToLayer(this.paddleSprite, 'foreground');
    }
    
    if (this.ballSprite) {
        this.ballSprite.x = this.ball.x - this.ball.radius;
        this.ballSprite.y = this.ball.y - this.ball.radius;
        this.graphics.addToLayer(this.ballSprite, 'foreground');
    }
    
    // Load brick assets when level changes
    this.updateBrickSprites();
}

createProceduralPaddle() {
    const graphics = new PIXI.Graphics();
    const color = parseInt(this.paddle.color.replace('#', ''), 16);
    graphics.beginFill(color);
    graphics.drawRoundedRect(0, 0, this.paddle.width, this.paddle.height, 3);
    graphics.endFill();
    return graphics;
}

createProceduralBall() {
    const graphics = new PIXI.Graphics();
    const color = parseInt(this.ball.color.replace('#', ''), 16);
    graphics.beginFill(color);
    graphics.drawCircle(this.ball.radius, this.ball.radius, this.ball.radius);
    graphics.endFill();
    return graphics;
}
```

## Next Steps

1. Generate assets according to specifications in each game's README
2. Place assets in the appropriate folders
3. Update game code to use `loadSpriteFromAsset()` with fallbacks
4. Test that games work both with and without assets

