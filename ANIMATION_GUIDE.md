# Enhanced Animation & Graphics Guide

This guide covers the enhanced animation and graphics features available in the retro arcade games.

## Table of Contents
1. [Particle Systems](#particle-systems)
2. [Motion Trails](#motion-trails)
3. [Tweening & Easing](#tweening--easing)
4. [Screen Effects](#screen-effects)
5. [CRT Filter](#crt-filter)
6. [Sprite Creation](#sprite-creation)
7. [Lighting System](#lighting-system)
8. [Usage Examples](#usage-examples)

## Particle Systems

### Enhanced Particle System

The `ParticleSystem` class now supports multiple particle types for different visual effects.

#### Available Particle Types:
- **`default`** - Standard rectangular particles
- **`spark`** - Line-based spark particles with rotation
- **`smoke`** - Soft, expanding circular particles
- **`glow`** - Glowing particles with shadow effects
- **`trail`** - Fading trail particles

#### Methods:

```javascript
// Standard explosion
particles.explode(x, y, count = 10, color = '#ffff00', type = 'default');

// Spark burst (great for impacts)
particles.sparkBurst(x, y, count = 15, color = '#ffaa00');

// Smoke cloud (good for destruction)
particles.smokeCloud(x, y, count = 8, color = '#666666');

// Glow explosion (for magical effects)
particles.glowExplosion(x, y, count = 20, color = '#00ffff');
```

#### Example:
```javascript
// In your game constructor
this.particles = new ParticleSystem();

// When a brick is destroyed
this.particles.explode(brick.x, brick.y, 8, brick.color);
this.particles.sparkBurst(brick.x, brick.y, 6, brick.color);

// Update in game loop
this.particles.update();
this.particles.draw(ctx);
```

## Motion Trails

Motion trails create smooth, fading trails behind moving objects.

### MotionTrail Class

```javascript
// Create a trail
const trail = new MotionTrail(maxPoints = 20, fadeRate = 0.95);

// Add points as object moves
trail.addPoint(x, y, color = '#ffffff', width = 2);

// Update (call each frame)
trail.update();

// Draw (call in render loop)
trail.draw(ctx);

// Clear trail
trail.clear();
```

### Example - Ball Trail:
```javascript
// In constructor
this.ballTrail = new MotionTrail(15, 0.92);

// In update loop
this.ballTrail.addPoint(this.ball.x, this.ball.y, this.ball.color, 4);
this.ballTrail.update();

// In draw loop
this.ballTrail.draw(ctx);
// Then draw the ball on top
```

## Tweening & Easing

Smooth animations using the tween system with various easing functions.

### Easing Functions

Available easing functions in the `Easing` class:
- `linear` - No easing
- `easeInQuad`, `easeInCubic`, `easeInSine` - Slow start
- `easeOutQuad`, `easeOutCubic`, `easeOutSine`, `easeOutBounce` - Slow end
- `easeInOutQuad`, `easeInOutSine` - Slow start and end

### Creating Tweens

```javascript
// Create tween manager
this.tweenManager = new TweenManager();

// Create a tween
const tween = new Tween(targetObject, duration = 1000, easing = Easing.linear);
tween.from({ x: 0, y: 0 });      // Starting values (optional)
tween.to({ x: 100, y: 100 });    // Target values
tween.onUpdate = (progress, eased) => {
    // Called each frame during tween
    console.log(`Progress: ${progress * 100}%`);
};
tween.onComplete = () => {
    // Called when tween finishes
    console.log('Animation complete!');
};
tween.start();

// Add to manager
this.tweenManager.add(tween);

// Update in game loop
this.tweenManager.update(performance.now());
```

### Example - Animated Paddle Size:
```javascript
// Grow paddle smoothly
const tween = new Tween(this.paddle, 300, Easing.easeOutBounce);
tween.from({ width: this.paddle.width });
tween.to({ width: 150 });
tween.onUpdate = (progress, eased) => {
    // Keep paddle centered
    this.paddle.x = centerX - this.paddle.width / 2;
};
this.tweenManager.add(tween);
```

## Screen Effects

Enhanced screen effects for visual feedback.

### ScreenEffects Class

```javascript
// Shake the screen
screenEffects.shake(intensity = 5, duration = 10);

// Flash the screen
screenEffects.flash(color = '#ffffff', duration = 5, intensity = 0.3);

// Ripple effect from a point
screenEffects.ripple(x, y, maxRadius = 200);

// Zoom the screen
screenEffects.zoom(scale);

// Chromatic aberration
screenEffects.chromaticAberration(amount);
```

### Usage:
```javascript
// In constructor
this.screenEffects = new ScreenEffects(canvas);

// On impact
this.screenEffects.shake(8, 15);
this.screenEffects.flash('#ff0000', 10, 0.5);
this.screenEffects.ripple(impactX, impactY, 150);

// Update
this.screenEffects.update();

// Apply transform in draw
const transform = this.screenEffects.getTransform();
ctx.save();
ctx.translate(this.width / 2, this.height / 2);
ctx.scale(transform.scale, transform.scale);
ctx.translate(-this.width / 2 + transform.x, -this.height / 2 + transform.y);
// ... draw game objects ...
ctx.restore();

// Draw overlay effects
this.screenEffects.drawFlash();
this.screenEffects.drawRipple();
```

## CRT Filter

Add authentic retro CRT monitor effects.

### CRTFilter Class

```javascript
// Create filter
const crtFilter = new CRTFilter(canvas);

// Enable/disable
crtFilter.enabled = true;

// Adjust intensity
crtFilter.scanlineIntensity = 0.15;  // 0-1
crtFilter.noiseIntensity = 0.05;     // 0-1
crtFilter.vignetteIntensity = 0.3;   // 0-1

// Draw at end of render loop
crtFilter.draw(ctx);
```

### Example:
```javascript
// In constructor
this.crtFilter = new CRTFilter(canvas);

// At end of draw() method
this.crtFilter.draw(ctx);
```

## Sprite Creation

Enhanced sprite creation utilities for pixel art.

### SpriteCreator Methods

```javascript
// Basic shapes
SpriteCreator.createRect(width, height, color);
SpriteCreator.createCircle(radius, color);
SpriteCreator.createPill(width, height, color);

// Gradients
SpriteCreator.createGradientRect(width, height, color1, color2, direction = 'vertical');
SpriteCreator.createGlowingCircle(radius, color, glowSize = 10);
SpriteCreator.createStripedRect(width, height, color1, color2, stripeWidth = 4, angle = 0);

// Shapes
SpriteCreator.createStar(size, color, points = 5);
```

### Example:
```javascript
// Create a glowing power-up
const powerUpSprite = SpriteCreator.createGlowingCircle(15, '#ff00ff', 8);

// Create a striped paddle
const paddleSprite = SpriteCreator.createStripedRect(120, 15, '#00ffff', '#0088ff', 4, 0);

// Use in drawing
ctx.drawImage(powerUpSprite, x, y);
```

## Lighting System

Dynamic lighting system for atmospheric effects.

### LightingSystem Class

```javascript
// Create lighting system
const lighting = new LightingSystem(canvas);

// Add light
const light = lighting.addLight(x, y, radius, intensity = 1.0, color = '#ffffff');

// Configure light
light.flickerSpeed = 0.01;  // Flicker effect
light.pulse = true;         // Enable pulsing
light.pulseSpeed = 0.005;   // Pulse speed

// Set ambient light
lighting.ambientLight = 0.2;  // 0-1

// Update and draw
lighting.update();
lighting.draw(ctx);  // Draw after all game objects
```

### Example:
```javascript
// In constructor
this.lighting = new LightingSystem(canvas);
this.lighting.ambientLight = 0.2;

// Add lights to power-ups
this.light = this.lighting.addLight(powerUp.x, powerUp.y, 30, 1.0, powerUp.color);
this.light.pulse = true;
this.light.pulseSpeed = 0.01;

// In update
this.lighting.update();

// In draw (after all objects)
this.lighting.draw(ctx);
```

## Usage Examples

### Complete Example - Enhanced Game Object

```javascript
class MyGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Initialize systems
        this.particles = new ParticleSystem();
        this.screenEffects = new ScreenEffects(canvas);
        this.tweenManager = new TweenManager();
        this.crtFilter = new CRTFilter(canvas);
        this.motionTrail = new MotionTrail(20, 0.93);
        
        // Game object with trail
        this.player = {
            x: 100,
            y: 100,
            color: '#00ffff'
        };
    }
    
    update() {
        // Update game logic
        this.player.x += 2;
        this.player.y += 2;
        
        // Add to trail
        this.motionTrail.addPoint(this.player.x, this.player.y, this.player.color, 3);
        this.motionTrail.update();
        
        // Update systems
        this.particles.update();
        this.screenEffects.update();
        this.tweenManager.update(performance.now());
    }
    
    draw() {
        // Clear
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply screen effects transform
        const transform = this.screenEffects.getTransform();
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(transform.scale, transform.scale);
        this.ctx.translate(-this.canvas.width / 2 + transform.x, 
                          -this.canvas.height / 2 + transform.y);
        
        // Draw trail
        this.motionTrail.draw(this.ctx);
        
        // Draw player
        this.ctx.fillStyle = this.player.color;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x, this.player.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw particles
        this.particles.draw(this.ctx);
        
        this.ctx.restore();
        
        // Draw overlay effects
        this.screenEffects.drawFlash();
        this.screenEffects.drawRipple();
        
        // Draw CRT filter
        this.crtFilter.draw(this.ctx);
    }
    
    onCollision(x, y) {
        // Particle effects
        this.particles.explode(x, y, 15, '#ff0000');
        this.particles.sparkBurst(x, y, 10, '#ff6600');
        
        // Screen effects
        this.screenEffects.shake(5, 10);
        this.screenEffects.ripple(x, y, 200);
        this.screenEffects.flash('#ffffff', 5, 0.3);
    }
}
```

## Tips & Best Practices

1. **Performance**: Limit particle counts and trail lengths for better performance
2. **Visual Hierarchy**: Use different particle types to convey different events
3. **Easing**: Choose easing functions that match the feel of your game
4. **CRT Filter**: Adjust intensity based on the retro aesthetic you want
5. **Lighting**: Use lighting sparingly as it can be performance-intensive
6. **Trails**: Clear trails when objects stop moving to avoid visual clutter

## Performance Considerations

- **Particles**: Each particle requires updates and draws. Limit to 100-200 active particles
- **Trails**: More points = smoother but more expensive. 10-20 points is usually enough
- **Lighting**: Very expensive. Use for key moments only or limit number of lights
- **Screen Effects**: Generally cheap, but ripple effects can be more expensive
- **CRT Filter**: Moderate cost. Consider disabling on lower-end devices

Enjoy creating amazing retro arcade visuals!

