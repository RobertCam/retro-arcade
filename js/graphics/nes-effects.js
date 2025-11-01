// NES-style visual effects and filters
// Includes CRT filter, authentic NES color palette, and screen effects

// NES Color Palette - 54 authentic colors
// Stored as an array for easy access
const NES_PALETTE = [
    // Grays (0-4)
    0x545454, 0x001F3F, 0x212121, 0x404040, 0x6D6D6D,
    
    // Blues (5-9)
    0x001973, 0x0000A8, 0x0041CD, 0x2D69FF, 0x5AA5FF,
    
    // Cyans/Teals (10-14)
    0x41C3FF, 0x73DBFF, 0x87F5FF, 0x6FABAD, 0x3F7F8F,
    
    // Greens (15-19)
    0x1F6F4F, 0x008F3F, 0x00A857, 0x00C86F, 0x1FFF8F,
    
    // Yellows (20-24)
    0x7FFF3F, 0xB7FF5F, 0xFFFF7F, 0xFFDB5F, 0xFFB73F,
    
    // Oranges (25-29)
    0xFF8F3F, 0xFF7B3F, 0xFF5F1F, 0xFF4300, 0xDB3700,
    
    // Reds (30-34)
    0xC73700, 0xA71F00, 0x9F0F0F, 0xB71F1F, 0xCF2F2F,
    
    // Pinks/Magentas (35-39)
    0xE75F5F, 0xFF7F7F, 0xFF9F9F, 0xFFBFBF, 0xFFDFDF,
    
    // Purples (40-44)
    0xDB5FE7, 0xCF3FDB, 0xBB1FCB, 0x9F0FAF, 0x7F0F8F,
    
    // Violets (45-49)
    0x6F0F6F, 0x5F0F5F, 0x4F0F4F, 0x3F0F3F, 0x2F0F2F,
    
    // Dark blues/purples (50-54)
    0x1F0F3F, 0x0F0F5F, 0x000F7F, 0x001F9F, 0x003FBF,
    
    // Light blues (55-59)
    0x005FDF, 0x007FFF, 0x2F9FFF, 0x5FBFFF, 0x7FDFFF
];

// Convert hex color to NES palette index (nearest match)
function findNearestNESColor(hexColor) {
    const target = typeof hexColor === 'string' ? parseInt(hexColor.replace('#', ''), 16) : hexColor;
    
    let nearestColor = NES_PALETTE[0];
    let minDistance = Infinity;
    
    NES_PALETTE.forEach(color => {
        const distance = colorDistance(target, color);
        if (distance < minDistance) {
            minDistance = distance;
            nearestColor = color;
        }
    });
    
    return nearestColor;
}

// Calculate color distance (simple RGB distance)
function colorDistance(color1, color2) {
    const r1 = (color1 >> 16) & 0xFF;
    const g1 = (color1 >> 8) & 0xFF;
    const b1 = color1 & 0xFF;
    
    const r2 = (color2 >> 16) & 0xFF;
    const g2 = (color2 >> 8) & 0xFF;
    const b2 = color2 & 0xFF;
    
    return Math.sqrt(
        Math.pow(r1 - r2, 2) +
        Math.pow(g1 - g2, 2) +
        Math.pow(b1 - b2, 2)
    );
}

// NES Screen Effects Class
class NESEffects {
    constructor(app) {
        this.app = app;
        this.renderer = app.renderer;
        
        // Screen shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeOffset = { x: 0, y: 0 };
        
        // Flash effect
        this.flashColor = null;
        this.flashAlpha = 0;
        this.flashDuration = 0;
        
        // Color cycling (for rainbow effects)
        this.colorCycleSpeed = 0;
        this.colorCycleOffset = 0;
        
        // CRT filter
        this.crtEnabled = true;
        this.crtScanlineIntensity = 0.15;
        this.crtNoiseIntensity = 0.05;
        this.crtCurvature = 0.05;
        this.crtVignetteIntensity = 0.3;
        
        // Create CRT overlay graphics
        this.crtOverlay = new PIXI.Graphics();
        this.crtOverlay.zIndex = 9999;
        this.app.stage.addChild(this.crtOverlay);
        
        // Don't call update immediately - wait for app to be ready
        // The update will be called from the game loop
    }
    
    // Screen shake
    shake(intensity = 5, duration = 10) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeDuration = Math.max(this.shakeDuration, duration);
    }
    
    // Flash screen
    flash(color = 0xFFFFFF, duration = 5, alpha = 0.3) {
        this.flashColor = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
        this.flashDuration = duration;
        this.flashAlpha = alpha;
    }
    
    // Start color cycling
    startColorCycle(speed = 0.01) {
        this.colorCycleSpeed = speed;
    }
    
    stopColorCycle() {
        this.colorCycleSpeed = 0;
    }
    
    // Update effects each frame
    update() {
        // Update shake
        if (this.shakeDuration > 0) {
            this.shakeDuration--;
            this.shakeOffset.x = Utils.random(-this.shakeIntensity, this.shakeIntensity);
            this.shakeOffset.y = Utils.random(-this.shakeIntensity, this.shakeIntensity);
            
            if (this.shakeDuration <= 0) {
                this.shakeIntensity = 0;
                this.shakeOffset.x = 0;
                this.shakeOffset.y = 0;
            }
        }
        
        // Update flash
        if (this.flashDuration > 0) {
            this.flashDuration--;
            this.flashAlpha *= 0.9; // Fade out
        } else {
            this.flashAlpha = 0;
        }
        
        // Update color cycle
        if (this.colorCycleSpeed > 0) {
            this.colorCycleOffset += this.colorCycleSpeed;
            if (this.colorCycleOffset >= Math.PI * 2) {
                this.colorCycleOffset -= Math.PI * 2;
            }
        }
        
        // Update CRT filter
        this.drawCRT();
    }
    
    // Get shake offset for applying to containers
    getShakeOffset() {
        return { ...this.shakeOffset };
    }
    
    // Draw CRT filter overlay
    drawCRT() {
        if (!this.crtEnabled || !this.app) {
            if (this.crtOverlay) {
                this.crtOverlay.clear();
            }
            return;
        }
        
        // Get screen dimensions safely
        let width = 800;
        let height = 600;
        
        // Try multiple ways to get dimensions
        if (this.app.screen && this.app.screen.width && this.app.screen.height) {
            width = this.app.screen.width;
            height = this.app.screen.height;
        } else if (this.renderer && this.renderer.width && this.renderer.height) {
            width = this.renderer.width;
            height = this.renderer.height;
        } else if (this.app.renderer && this.app.renderer.width && this.app.renderer.height) {
            width = this.app.renderer.width;
            height = this.app.renderer.height;
        } else {
            // Dimensions not available yet, skip drawing
            return;
        }
        
        // If dimensions aren't valid, skip drawing
        if (!width || !height || width <= 0 || height <= 0) {
            return;
        }
        
        this.crtOverlay.clear();
        
        // Draw scanlines
        if (this.crtScanlineIntensity > 0) {
            this.crtOverlay.beginFill(0x000000, this.crtScanlineIntensity);
            for (let y = 0; y < height; y += 4) {
                this.crtOverlay.drawRect(0, y, width, 1);
            }
            this.crtOverlay.endFill();
        }
        
        // Draw subtle noise
        if (this.crtNoiseIntensity > 0) {
            const noiseData = this.createNoiseTexture(width, height, this.crtNoiseIntensity);
            // Note: For better performance, we'd use a shader, but for now use a simple approach
            this.crtOverlay.beginFill(0xFFFFFF, this.crtNoiseIntensity * 0.3);
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                this.crtOverlay.drawRect(x, y, 1, 1);
            }
            this.crtOverlay.endFill();
        }
        
        // Draw vignette
        if (this.crtVignetteIntensity > 0) {
            const gradient = this.createVignetteGradient(width, height);
            this.crtOverlay.beginFill(0x000000, this.crtVignetteIntensity);
            this.crtOverlay.drawRect(0, 0, width, height);
            // Vignette would be better with a shader, but this is a simple approximation
            this.crtOverlay.endFill();
        }
        
        // Draw flash overlay
        if (this.flashAlpha > 0.01 && this.flashColor !== null) {
            this.crtOverlay.beginFill(this.flashColor, this.flashAlpha);
            this.crtOverlay.drawRect(0, 0, width, height);
            this.crtOverlay.endFill();
        }
    }
    
    // Create noise texture (simplified)
    createNoiseTexture(width, height, intensity) {
        // This would ideally use a shader, but for compatibility we'll use a simple approach
        return null; // Placeholder
    }
    
    // Create vignette gradient (simplified)
    createVignetteGradient(width, height) {
        // Placeholder - would use shader for proper vignette
        return null;
    }
    
    // Get cycled color from NES palette
    getCycledColor(index = 0) {
        const cycleIndex = (index + Math.floor(this.colorCycleOffset * 10)) % NES_PALETTE.length;
        return NES_PALETTE[cycleIndex];
    }
    
    // Enable/disable CRT filter
    setCRTEnabled(enabled) {
        this.crtEnabled = enabled;
        if (!enabled) {
            this.crtOverlay.clear();
        }
    }
    
    // Set CRT filter intensity
    setCRTIntensity(scanlines, noise, vignette) {
        if (scanlines !== undefined) this.crtScanlineIntensity = scanlines;
        if (noise !== undefined) this.crtNoiseIntensity = noise;
        if (vignette !== undefined) this.crtVignetteIntensity = vignette;
    }
    
    // Destroy and cleanup
    destroy() {
        if (this.crtOverlay && this.crtOverlay.parent) {
            this.crtOverlay.parent.removeChild(this.crtOverlay);
            this.crtOverlay.destroy();
        }
        this.crtOverlay = null;
        this.app = null;
        this.renderer = null;
    }
}

// Export NES palette for use in games
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NES_PALETTE, findNearestNESColor, NESEffects };
}

