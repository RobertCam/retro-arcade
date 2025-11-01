# Guide: Adding New Games to Retro Arcade

This guide provides step-by-step instructions for AI agents and developers to add new games to the Retro Arcade project.

## Table of Contents

1. [Overview](#overview)
2. [Game Class Structure](#game-class-structure)
3. [Required Methods and Properties](#required-methods-and-properties)
4. [Integration Steps](#integration-steps)
5. [Graphics System](#graphics-system)
6. [High Score Integration](#high-score-integration)
7. [Stats Panel Integration](#stats-panel-integration)
8. [Preview Mode](#preview-mode)
9. [Best Practices](#best-practices)
10. [Example: Minimal Game Template](#example-minimal-game-template)

## Overview

The Retro Arcade uses a modular architecture where each game is a self-contained class that:
- Supports both **preview mode** (small canvas in lobby) and **full game mode** (800x600 canvas)
- Uses **PixiJS** for full games and **Canvas 2D** for previews
- Integrates with a unified high score system
- Displays stats in a side panel
- Follows a consistent game state pattern

## Game Class Structure

### Basic Class Template

```javascript
// GameName game implementation - PixiJS version
class GameNameGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        
        // CRITICAL: Detect preview vs full game
        this.isPreview = this.width < 400;
        
        // Initialize graphics based on mode
        if (this.isPreview) {
            this.ctx = canvas.getContext('2d');
            this.graphics = null;
        } else {
            this.ctx = null;
            this.graphics = new GraphicsCore(canvas, {
                width: this.width,
                height: this.height,
                backgroundColor: 0x000011, // Your game's background color
                pixelPerfect: true
            });
        }
        
        // Game state
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        
        // Initialize game objects, variables, etc.
        
        // Initialize input
        this.keys = {};
        this.setupInput();
        
        // Initialize graphics and start loop
        if (this.isPreview) {
            requestAnimationFrame(this.gameLoop);
        } else {
            this.initGraphics();
        }
    }
}
```

## Required Methods and Properties

### Required Properties

1. **`this.isPreview`** (boolean): Must be set in constructor. Determines if running in lobby preview or full game.
2. **`this.canvas`**, **`this.width`**, **`this.height`**: Canvas element and dimensions
3. **`this.gameState`** (string): Current game state (`'menu'`, `'playing'`, `'paused'`, `'gameOver'`)
4. **`this.score`** (number): Player's current score
5. **`this.keys`** (object): Object to track key states

### Required Methods

#### `constructor(canvas)`
- Initialize all game properties
- Set up graphics system (PixiJS for full game, Canvas 2D for preview)
- Call `setupInput()` to register input handlers
- Start game loop or initialize graphics

#### `setupInput()`
- Register keyboard/mouse event listeners
- Only handle input if game is active: `document.getElementById('game-canvas') === this.canvas`
- Check `this.gameState` before processing input

```javascript
setupInput() {
    this.keydownHandler = (e) => {
        // Don't handle input if modals are open
        const nameEntryModal = document.getElementById('name-entry-modal');
        if (nameEntryModal && nameEntryModal.classList.contains('active')) {
            return;
        }
        
        // Only handle input if this is the active game
        const activeCanvas = document.getElementById('game-canvas');
        if (!activeCanvas || activeCanvas !== this.canvas) {
            return;
        }
        
        // Handle keys
        this.keys[e.code] = true;
        
        // Handle specific key actions
        if (e.code === 'Space' && this.gameState === 'menu') {
            this.startGame();
        }
        // ... more key handling
    };
    
    document.addEventListener('keydown', this.keydownHandler);
    
    this.keyupHandler = (e) => {
        this.keys[e.code] = false;
    };
    document.addEventListener('keyup', this.keyupHandler);
}
```

#### `gameLoop(currentTime)` or `gameLoop(deltaTime)`
- Update game state (`update(deltaTime)`)
- Render game (`draw()` or `drawPixi()`)
- Continue loop: `requestAnimationFrame(this.gameLoop)`

#### `update(deltaTime)`
- Update game logic (movement, collisions, timers, etc.)
- Check for game over conditions
- Update animations

#### `draw()` (Canvas 2D) or `drawPixi()` (PixiJS)
- Render all game elements
- Handle different game states (menu, playing, paused, gameOver)
- For PixiJS: Update sprites, add to layers
- For Canvas 2D: Use `this.ctx` to draw

#### `cleanup()`
- Remove event listeners
- Clean up PixiJS resources (if used)
- Stop animation loops
- Clear sprites and graphics

```javascript
cleanup() {
    // Remove event listeners
    if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler);
    }
    if (this.keyupHandler) {
        document.removeEventListener('keyup', this.keyupHandler);
    }
    
    // Clean up PixiJS
    if (!this.isPreview && this.graphics) {
        const ticker = this.graphics.getTicker();
        if (ticker && this.tickerCallback) {
            ticker.remove(this.tickerCallback);
        }
        if (this.graphics.app) {
            this.graphics.app.destroy(true, { children: true, texture: true, baseTexture: true });
        }
    }
    
    // Cancel animation frame
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
    }
}
```

#### `startGame()`
- Reset game state to 'playing'
- Initialize game variables
- Reset positions

#### `gameOver()`
- Set `this.gameState = 'gameOver'`
- Check high score: `highScoreManager.checkHighScore('game-name', this.score)`
- Request name entry if high score: `highScoreManager.requestNameEntry('game-name', this.score)`

```javascript
gameOver() {
    this.gameState = 'gameOver';
    
    // Check for high score
    if (highScoreManager.checkHighScore('your-game-name', this.score)) {
        highScoreManager.requestNameEntry('your-game-name', this.score);
    }
}
```

#### `updateStatsPanel()` (Optional but Recommended)
- Update the stats panel HTML
- Called from `drawUIPixi()` or `draw()` during gameplay

```javascript
updateStatsPanel() {
    const statsPanel = document.getElementById('game-stats-panel');
    if (!statsPanel) return;
    
    const statsContent = statsPanel.querySelector('.stats-content');
    if (!statsContent) return;
    
    statsContent.innerHTML = `
        <div class="stat-item">
            <div class="stat-label">Score</div>
            <div class="stat-value">${Utils.formatScore(this.score)}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Level</div>
            <div class="stat-value">${this.level}</div>
        </div>
        <!-- Add more stats as needed -->
    `;
}
```

#### Preview Initialization Function
- Create a global function `initGameName()` for lobby preview
- Draw a simple static preview image

```javascript
function initGameName() {
    const canvas = document.getElementById('game-name-preview');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Draw preview image
    // Simple, static preview - doesn't need to be animated
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#00ffff';
    ctx.font = '20px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GAME NAME', width / 2, height / 2);
}
```

### Optional Methods

- `initGraphics()`: Initialize PixiJS graphics (async)
- `drawUIPixi()`: Render UI using PixiJS (for full game mode)
- `pauseGame()`, `resumeGame()`: Handle pause state
- `resetGame()`: Reset to initial state

## Integration Steps

### Step 1: Create Game File

Create a new file: `js/games/your-game-name.js`

### Step 2: Add Script Tag to HTML

In `index.html`, add your game script **before** `main.js`:

```html
<script src="js/games/breakout.js"></script>
<script src="js/games/jezzball.js"></script>
<!-- ... other games ... -->
<script src="js/games/your-game-name.js"></script>
<script src="js/main.js"></script>
```

### Step 3: Add Cabinet to HTML

In `index.html`, add a new arcade cabinet in the `.arcade-grid` section:

```html
<div class="arcade-cabinet" data-game="your-game-name">
    <div class="cabinet-marquee">
        <div class="marquee-text">YOUR GAME TITLE</div>
    </div>
    <div class="cabinet-screen">
        <canvas id="your-game-name-preview" width="240" height="180"></canvas>
        <div class="game-cover-art">
            <img src="images/your-game-cover.png" alt="Your Game" class="cover-image">
        </div>
    </div>
    <div class="cabinet-controls">
        <div class="high-score-display">
            <div class="top-score">TOP: <span id="your-game-name-score">0</span></div>
            <button class="scores-btn" data-game="your-game-name">SCORES</button>
        </div>
    </div>
</div>
```

**Note:** The canvas preview is optional if you're using a cover image. If you want a live preview, include the canvas.

### Step 4: Register in main.js

#### 4a. Add Preview Initialization

In `main.js`, add to the `DOMContentLoaded` handler:

```javascript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all game previews
    initBreakout();
    initJezzball();
    // ... other games
    initYourGameName(); // Add this
    
    // Update high score displays
    highScoreManager.updateDisplay('breakout');
    // ... other games
    highScoreManager.updateDisplay('your-game-name'); // Add this
```

#### 4b. Add to getGameTitle()

Add your game's display title:

```javascript
function getGameTitle(gameName) {
    const titles = {
        'breakout': 'Neon Shards',
        // ... other games
        'your-game-name': 'Your Game Title'
    };
    return titles[gameName] || 'Game';
}
```

#### 4c. Add to getGameControls()

Add control instructions:

```javascript
function getGameControls(gameName) {
    const controls = {
        'breakout': 'Arrow Keys: Move paddle | Space: Start/Pause',
        // ... other games
        'your-game-name': 'Arrow Keys: Move | Space: Jump | P: Pause'
    };
    return controls[gameName] || 'Check game instructions';
}
```

#### 4d. Add to initializeGame()

Add game initialization case:

```javascript
function initializeGame(gameName) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    
    switch (gameName) {
        case 'breakout':
            currentGameInstance = new BreakoutGame(canvas);
            break;
        // ... other games
        case 'your-game-name':
            currentGameInstance = new YourGameNameGame(canvas);
            break;
    }
}
```

#### 4e. Update High Score Display

In `closeGame()`, add high score update:

```javascript
function closeGame() {
    // ... cleanup code ...
    
    // Update high scores
    highScoreManager.updateDisplay('breakout');
    // ... other games
    highScoreManager.updateDisplay('your-game-name'); // Add this
}
```

### Step 5: Add Cover Image

1. Add your game cover image to `images/` folder
2. Name it appropriately (e.g., `your-game-cover.png`)
3. Reference it in the HTML cabinet (see Step 3)

## Graphics System

### Preview Mode (Canvas 2D)

- Use `this.ctx = canvas.getContext('2d')`
- Simple rendering with Canvas 2D API
- Static or simple animated previews
- No PixiJS overhead

### Full Game Mode (PixiJS)

1. **Initialize Graphics:**
```javascript
async initGraphics() {
    if (this.isPreview) return;
    
    if (this.graphics && typeof this.graphics.init === 'function') {
        await this.graphics.init();
    }
    
    if (!this.graphics || !this.graphics.isInitialized) {
        console.error('Graphics initialization failed');
        return;
    }
    
    // Set up ticker callback
    this.tickerCallback = (deltaTime) => {
        this.gameLoop(deltaTime * 16.67); // Convert to milliseconds
    };
    
    const ticker = this.graphics.getTicker();
    ticker.add(this.tickerCallback);
    
    // Start initial render
    this.drawPixi();
}
```

2. **Use Graphics Layers:**
```javascript
drawPixi() {
    if (!this.graphics) return;
    
    const bgLayer = this.graphics.getLayer('background');
    const gameLayer = this.graphics.getLayer('game');
    const uiLayer = this.graphics.getLayer('ui');
    
    // Clear UI layer each frame
    uiLayer.removeChildren();
    
    // Draw game elements
    // ... add sprites to layers
}
```

3. **Create Sprites:**
```javascript
// Example: Creating a sprite
const sprite = new PIXI.Graphics();
sprite.beginFill(0x00ff00);
sprite.drawRect(0, 0, 50, 50);
sprite.x = 100;
sprite.y = 200;
gameLayer.addChild(sprite);
```

4. **Get Screen Effects:**
```javascript
// In constructor or initGraphics
this.screenEffects = this.graphics.getScreenEffects();

// Use effects
if (this.screenEffects) {
    this.screenEffects.flash(0xff0000, 10, 0.5); // Red flash
    this.screenEffects.shake(5, 10); // Shake
}
```

## High Score Integration

### Saving High Scores

Call `gameOver()` and check high scores:

```javascript
gameOver() {
    this.gameState = 'gameOver';
    
    // Check if this is a high score
    if (highScoreManager.checkHighScore('your-game-name', this.score)) {
        highScoreManager.requestNameEntry('your-game-name', this.score);
    }
}
```

### High Score Keys

- Use kebab-case: `'your-game-name'`
- Be consistent with the `data-game` attribute in HTML
- Handle legacy keys if renaming (see `micro-racing` → `racing` example)

### Formatting Scores

Use `Utils.formatScore()` for display:

```javascript
Utils.formatScore(this.score) // Returns formatted string (e.g., "1,234,567")
```

## Stats Panel Integration

### HTML Structure

The stats panel is automatically created in `openGame()`. Your game should populate it via `updateStatsPanel()`.

### Update During Gameplay

Call `updateStatsPanel()` from your render method:

```javascript
drawUIPixi() {
    // Update stats panel
    this.updateStatsPanel();
    
    // ... rest of UI rendering
}
```

### Stats HTML Format

```html
<div class="stat-item">
    <div class="stat-label">Label</div>
    <div class="stat-value">Value</div>
</div>
```

## Preview Mode

### Detection

The game automatically detects preview mode:
```javascript
this.isPreview = this.width < 400;
```

### Preview Canvas

- Preview canvases are 240x180 pixels
- Located in the lobby cabinet screens
- Use simple Canvas 2D rendering
- Can be static or lightly animated

### Preview Function

Create `initYourGameName()` that:
- Finds the preview canvas
- Draws a simple preview image
- Doesn't create a game instance (just draws once)

## Best Practices

### 1. State Management

Always check `this.gameState` before:
- Processing input
- Updating game logic
- Rendering

```javascript
if (this.gameState !== 'playing') {
    return; // Don't update game logic
}
```

### 2. Input Handling

- Only handle input when your game is active
- Check for modals (name entry) before processing
- Remove listeners in `cleanup()`

### 3. Memory Management

- Clean up PixiJS resources in `cleanup()`
- Remove event listeners
- Clear sprite references
- Cancel animation frames

### 4. Error Handling

- Check if graphics initialized successfully
- Fall back to Canvas 2D if PixiJS fails
- Handle missing DOM elements gracefully

### 5. Game Loop

- Use consistent deltaTime handling
- For PixiJS: Convert ticker delta to milliseconds
- For Canvas 2D: Calculate delta from timestamps

### 6. Naming Conventions

- Class name: `YourGameNameGame`
- File name: `your-game-name.js` (kebab-case)
- Game key: `'your-game-name'` (kebab-case)
- Preview function: `initYourGameName()`
- Preview canvas ID: `'your-game-name-preview'`

## Example: Minimal Game Template

```javascript
// Minimal game template
class MinimalGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;
        this.height = canvas.height;
        this.isPreview = this.width < 400;
        
        if (this.isPreview) {
            this.ctx = canvas.getContext('2d');
            this.graphics = null;
        } else {
            this.ctx = null;
            this.graphics = new GraphicsCore(canvas, {
                width: this.width,
                height: this.height,
                backgroundColor: 0x000011,
                pixelPerfect: true
            });
        }
        
        this.gameState = 'menu';
        this.score = 0;
        this.keys = {};
        
        this.setupInput();
        
        if (this.isPreview) {
            this.drawPreview();
        } else {
            this.initGraphics();
        }
    }
    
    setupInput() {
        this.keydownHandler = (e) => {
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal && nameEntryModal.classList.contains('active')) {
                return;
            }
            
            const activeCanvas = document.getElementById('game-canvas');
            if (!activeCanvas || activeCanvas !== this.canvas) {
                return;
            }
            
            this.keys[e.code] = true;
            
            if (e.code === 'Space' && this.gameState === 'menu') {
                this.startGame();
            }
        };
        
        document.addEventListener('keydown', this.keydownHandler);
        
        this.keyupHandler = (e) => {
            this.keys[e.code] = false;
        };
        document.addEventListener('keyup', this.keyupHandler);
    }
    
    async initGraphics() {
        if (this.isPreview) return;
        
        if (this.graphics && typeof this.graphics.init === 'function') {
            await this.graphics.init();
        }
        
        if (!this.graphics || !this.graphics.isInitialized) {
            console.error('Graphics initialization failed');
            return;
        }
        
        this.tickerCallback = (deltaTime) => {
            this.gameLoop(deltaTime * 16.67);
        };
        
        const ticker = this.graphics.getTicker();
        ticker.add(this.tickerCallback);
        
        this.drawPixi();
    }
    
    gameLoop(deltaTime) {
        this.update(deltaTime);
        
        if (this.isPreview) {
            this.drawPreview();
            requestAnimationFrame(this.gameLoop);
        } else {
            this.drawPixi();
        }
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        // Update game logic
    }
    
    drawPreview() {
        const ctx = this.ctx;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = '#00ffff';
        ctx.font = '20px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('MINIMAL GAME', this.width / 2, this.height / 2);
    }
    
    drawPixi() {
        if (!this.graphics) return;
        const bgLayer = this.graphics.getLayer('background');
        const uiLayer = this.graphics.getLayer('ui');
        
        uiLayer.removeChildren();
        
        if (this.gameState === 'menu') {
            const text = new PIXI.Text('MINIMAL GAME\nPress SPACE', {
                fontFamily: 'Courier New',
                fontSize: 24,
                fill: 0x00ffff
            });
            text.anchor.set(0.5);
            text.x = this.width / 2;
            text.y = this.height / 2;
            uiLayer.addChild(text);
        }
    }
    
    startGame() {
        this.gameState = 'playing';
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        if (highScoreManager.checkHighScore('minimal-game', this.score)) {
            highScoreManager.requestNameEntry('minimal-game', this.score);
        }
    }
    
    cleanup() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            document.removeEventListener('keyup', this.keyupHandler);
        }
        
        if (!this.isPreview && this.graphics) {
            const ticker = this.graphics.getTicker();
            if (ticker && this.tickerCallback) {
                ticker.remove(this.tickerCallback);
            }
            if (this.graphics.app) {
                this.graphics.app.destroy(true);
            }
        }
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}

function initMinimalGame() {
    const canvas = document.getElementById('minimal-game-preview');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#00ffff';
    ctx.font = '20px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('MINIMAL GAME', width / 2, height / 2);
}
```

## Summary Checklist

When adding a new game, ensure you:

- [ ] Created game file: `js/games/your-game-name.js`
- [ ] Added script tag to `index.html` (before `main.js`)
- [ ] Added cabinet HTML to `index.html`
- [ ] Added preview initialization call in `main.js`
- [ ] Added high score display update in `main.js`
- [ ] Added to `getGameTitle()` function
- [ ] Added to `getGameControls()` function
- [ ] Added case to `initializeGame()` switch statement
- [ ] Created preview initialization function: `initYourGameName()`
- [ ] Added cover image to `images/` folder (or use preview canvas)
- [ ] Implemented `cleanup()` method
- [ ] Implemented `gameOver()` with high score check
- [ ] Tested preview mode in lobby
- [ ] Tested full game mode
- [ ] Tested high score entry
- [ ] Tested pause/resume (if applicable)
- [ ] Tested cleanup when returning to lobby

## Additional Resources

- **Graphics System:** See `js/graphics/graphics-core.js` for PixiJS wrapper
- **High Scores:** See `js/utils.js` for `HighScoreManager` class
- **Screen Effects:** See `js/graphics/nes-effects.js` for effects API
- **Animation:** See `js/animation.js` for animation helpers
- **Existing Games:** Review `js/games/breakout.js` as a comprehensive example

---

**Note for AI Agents:** When implementing a new game, follow this guide step-by-step. Reference existing games (especially `breakout.js`) as working examples. Ensure all required methods are implemented and the game integrates properly with the main application lifecycle.

