# Asset Specification Guide for Retro Arcade

## Overview

This document provides detailed specifications for all illustrated assets needed to replace procedural graphics with hand-drawn/illustrated sprites for a more polished, illustrative visual style.

## Art Style Guidelines

### Overall Direction

- **Style**: Modern illustrative/retro-futuristic, not pixel-art
- **Color Palette**: Vibrant, saturated colors with good contrast
- **Shading**: Soft gradients with subtle highlights/shadow
- **Line Art**: Clean lines, optional subtle outlines
- **Resolution**: 2x resolution for crisp rendering (actual canvas is 800x600, so assets should be 1600x1200 equivalent or higher)

### Technical Requirements

- **Format**: PNG with transparency
- **Color Mode**: RGB
- **Transparency**: Yes (alpha channel)
- **Naming Convention**: Short names inside per-game folders (e.g., `paddle.png`, `player-car.png`). Full paths are listed in `js/graphics/asset-manifests.js`.
- **Organized in folders**: One folder per game under `assets/games/[gamename]/`

---

## Game-by-Game Asset Specifications

See individual README files in each game's asset folder for detailed specifications:
- `assets/games/breakout/README.md`
- `assets/games/jezzball/README.md`
- `assets/games/micro-racing/README.md`
- `assets/games/rivet-rage/README.md`
- `assets/games/tetris/README.md`
- `assets/games/mouse-pacman/README.md`
- `assets/games/minigolf/README.md`

---

## Shared/Common Assets

### UI Elements (used across all games)

See `assets/ui/README.md` for details:
- Button styles (normal, hover, pressed)
- Score displays
- Menu backgrounds

### Effect Overlays

See `assets/effects/README.md` for details:
- Particle sprites (star, circle, spark, smoke)
- Screen flash overlays

---

## File Organization Structure

```
assets/
├── games/
│   ├── breakout/
│   ├── jezzball/
│   ├── micro-racing/
│   ├── rivet-rage/
│   ├── tetris/
│   ├── mouse-pacman/
│   └── minigolf/
├── ui/
└── effects/
```

**Where to Place Assets**: Place all generated assets directly in the appropriate game folders as specified in each game's README.md file.

---

## Delivery Checklist

For each game, ensure:

- [ ] All core gameplay sprites provided
- [ ] Consistent art style across all assets
- [ ] Proper dimensions (2x resolution recommended)
- [ ] Transparent backgrounds where needed
- [ ] Proper file naming convention followed
- [ ] Color palette consistent with game theme
- [ ] Animation frames organized clearly (if applicable)

---

## Notes for Asset Generation

1. **Scale**: Design at 2x resolution for crisp display (actual canvas is 800x600, design at 1600x1200 equivalent)
2. **Color**: Use vibrant, saturated colors that pop against dark backgrounds
3. **Shadows/Glows**: Add subtle glows for neon/synthwave games (Breakout, Racing)
4. **Readability**: Ensure all sprites are clearly visible at their display size
5. **Consistency**: Maintain consistent line weight and style within each game
6. **Animation**: If providing animation frames, ensure smooth transitions between frames

---

## Priority Order for Generation

1. **Breakout** - Core gameplay sprites (paddle, ball, bricks)
2. **Micro Racing** - Car sprites and track elements
3. **Tetris** - Piece sprites (most visible impact)
4. **Mouse Pacman** - Character sprites (mouse, cats)
5. **Rivet Rage** - Player, enemies, projectiles
6. **Jezzball** - Ball and wall sprites
7. **Mini Golf** - Course elements and ball

---

## Asset Integration Guide

### Where to Place Assets

Once you have the generated assets, place them in the appropriate folders:
- `assets/games/[gamename]/` - Game-specific assets (see each game's README)
- `assets/ui/` - Shared UI elements
- `assets/effects/` - Shared visual effects

### File Paths

Assets will be referenced relative to the project root:
- File system: `assets/games/breakout/paddle.png`
- Code reference: `assets/games/breakout/paddle.png`

### Important Notes

1. **Root Directory**: Assets folder is at the root of your project (same level as `js/`, `images/`, `index.html`)

2. **Web Server Required**: Since we're loading image files, you'll need to serve the files through a web server (not just open `index.html` directly) to avoid CORS issues.

3. **Naming**: Follow the exact naming conventions specified in each game's README.md file

### Code Integration Steps

After placing assets, the code will need to be updated to:

1. **Load assets** using PixiJS `PIXI.Texture.from()` or `PIXI.Assets.load()`
2. **Replace procedural graphics** (PIXI.Graphics shapes) with sprite textures
3. **Update sprite creation** methods in each game class
4. **Handle asset loading** asynchronously before game starts

### Example Asset Path Reference

When assets are loaded, they'll be referenced like:

```javascript
// Example for Breakout paddle
const paddleTexture = PIXI.Texture.from('assets/games/breakout/paddle.png');
const paddleSprite = new PIXI.Sprite(paddleTexture);
```

Or using asset loader:

```javascript
PIXI.Assets.load('assets/games/breakout/paddle.png').then((texture) => {
    const paddleSprite = new PIXI.Sprite(texture);
});
```

---

## Next Steps

1. Generate assets according to specifications in each game's README
2. Place assets in the appropriate folders
3. Update game code to load and use the new illustrated assets (this will be implemented in a future update)

---

This specification provides everything needed to generate illustrated assets that will replace the current procedural graphics with a polished, modern illustrative style.

