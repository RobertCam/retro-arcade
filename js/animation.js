// Enhanced animation system for retro arcade games
class Animation {
    constructor(frames, frameRate = 10) {
        this.frames = frames; // Array of image data or canvas contexts
        this.frameRate = frameRate;
        this.currentFrame = 0;
        this.lastFrameTime = 0;
        this.isPlaying = false;
        this.loop = true;
    }
    
    play() {
        this.isPlaying = true;
        this.lastFrameTime = performance.now();
    }
    
    pause() {
        this.isPlaying = false;
    }
    
    stop() {
        this.isPlaying = false;
        this.currentFrame = 0;
    }
    
    update(currentTime) {
        if (!this.isPlaying) return;
        
        const deltaTime = currentTime - this.lastFrameTime;
        const frameInterval = 1000 / this.frameRate;
        
        if (deltaTime >= frameInterval) {
            this.currentFrame++;
            if (this.currentFrame >= this.frames.length) {
                if (this.loop) {
                    this.currentFrame = 0;
                } else {
                    this.currentFrame = this.frames.length - 1;
                    this.isPlaying = false;
                }
            }
            this.lastFrameTime = currentTime;
        }
    }
    
    getCurrentFrame() {
        return this.frames[this.currentFrame];
    }
}

// Easing functions for smooth animations
class Easing {
    // Linear easing
    static linear(t) {
        return t;
    }
    
    // Ease in
    static easeInQuad(t) {
        return t * t;
    }
    
    static easeInCubic(t) {
        return t * t * t;
    }
    
    static easeInSine(t) {
        return 1 - Math.cos((t * Math.PI) / 2);
    }
    
    // Ease out
    static easeOutQuad(t) {
        return t * (2 - t);
    }
    
    static easeOutCubic(t) {
        return --t * t * t + 1;
    }
    
    static easeOutSine(t) {
        return Math.sin((t * Math.PI) / 2);
    }
    
    static easeOutBounce(t) {
        if (t < 1 / 2.75) {
            return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
            return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
            return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
    }
    
    // Ease in-out
    static easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    static easeInOutSine(t) {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }
}

// Tween class for smooth animations
class Tween {
    constructor(target, duration = 1000, easing = Easing.linear) {
        this.target = target;
        this.duration = duration;
        this.easing = easing;
        this.startTime = null;
        this.startValues = {};
        this.endValues = {};
        this.isActive = false;
        this.onComplete = null;
        this.onUpdate = null;
    }
    
    to(properties) {
        this.endValues = properties;
        return this;
    }
    
    from(properties) {
        this.startValues = properties;
        return this;
    }
    
    start() {
        this.startTime = performance.now();
        this.isActive = true;
        
        // Capture current values as start values if not set
        for (let key in this.endValues) {
            if (!(key in this.startValues)) {
                this.startValues[key] = this.target[key] || 0;
            }
        }
        
        return this;
    }
    
    update(currentTime) {
        if (!this.isActive) return false;
        
        const elapsed = currentTime - this.startTime;
        const progress = Math.min(elapsed / this.duration, 1);
        const eased = this.easing(progress);
        
        // Interpolate values
        for (let key in this.endValues) {
            const start = this.startValues[key];
            const end = this.endValues[key];
            this.target[key] = start + (end - start) * eased;
        }
        
        // Call update callback
        if (this.onUpdate) {
            this.onUpdate(progress, eased);
        }
        
        // Check if complete
        if (progress >= 1) {
            this.isActive = false;
            if (this.onComplete) {
                this.onComplete();
            }
            return false;
        }
        
        return true;
    }
    
    stop() {
        this.isActive = false;
        return this;
    }
}

// Tween manager for handling multiple tweens
class TweenManager {
    constructor() {
        this.tweens = [];
    }
    
    add(tween) {
        this.tweens.push(tween);
        return tween;
    }
    
    remove(tween) {
        const index = this.tweens.indexOf(tween);
        if (index > -1) {
            this.tweens.splice(index, 1);
        }
    }
    
    update(currentTime) {
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const tween = this.tweens[i];
            if (!tween.update(currentTime)) {
                this.tweens.splice(i, 1);
            }
        }
    }
    
    clear() {
        this.tweens = [];
    }
}

// Enhanced particle system with multiple particle types
class Particle {
    constructor(x, y, vx, vy, life, color, size = 2, type = 'default') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.type = type; // 'default', 'spark', 'smoke', 'trail', 'glow'
        this.gravity = type === 'smoke' ? -0.05 : 0.1;
        this.friction = type === 'spark' ? 0.98 : 1.0;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.scale = 1;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.rotation += this.rotationSpeed;
        this.life--;
        
        // Fade out
        this.alpha = this.life / this.maxLife;
        
        // Scale changes based on type
        if (this.type === 'smoke') {
            this.scale = 1 + (1 - this.alpha) * 2; // Grow as it fades
        } else if (this.type === 'spark') {
            this.scale = this.alpha; // Shrink as it fades
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        
        switch (this.type) {
            case 'spark':
                // Draw spark as a line
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-this.size, -this.size);
                ctx.lineTo(this.size, this.size);
                ctx.stroke();
                break;
                
            case 'smoke':
                // Draw smoke as soft circle
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
                gradient.addColorStop(0, this.color);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'glow':
                // Draw glow with shadow
                ctx.shadowColor = this.color;
                ctx.shadowBlur = this.size * 2;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;
                
            case 'trail':
                // Draw trail as fading circle
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, this.size * this.alpha, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            default:
                // Default rectangle particle
                ctx.fillStyle = this.color;
                ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        }
        
        ctx.restore();
    }
    
    isDead() {
        return this.life <= 0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }
    
    addParticle(particle) {
        this.particles.push(particle);
    }
    
    explode(x, y, count = 10, color = '#ffff00', type = 'default') {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = Utils.random(2, 6);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const life = Utils.randomInt(30, 60);
            const size = Utils.random(2, 5);
            
            this.addParticle(new Particle(x, y, vx, vy, life, color, size, type));
        }
    }
    
    sparkBurst(x, y, count = 15, color = '#ffaa00') {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Utils.random(3, 8);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const life = Utils.randomInt(20, 40);
            const size = Utils.random(2, 4);
            
            this.addParticle(new Particle(x, y, vx, vy, life, color, size, 'spark'));
        }
    }
    
    smokeCloud(x, y, count = 8, color = '#666666') {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Utils.random(0.5, 1.5);
            const vx = Math.cos(angle) * speed;
            const vy = -Math.abs(Math.sin(angle) * speed) - 1; // Upward
            const life = Utils.randomInt(40, 80);
            const size = Utils.random(8, 15);
            
            this.addParticle(new Particle(x, y, vx, vy, life, color, size, 'smoke'));
        }
    }
    
    glowExplosion(x, y, count = 20, color = '#00ffff') {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Utils.random(1, 4);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const life = Utils.randomInt(30, 50);
            const size = Utils.random(3, 6);
            
            this.addParticle(new Particle(x, y, vx, vy, life, color, size, 'glow'));
        }
    }
    
    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update();
            
            if (particle.isDead()) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    draw(ctx) {
        this.particles.forEach(particle => particle.draw(ctx));
    }
}

// Motion trail system for objects
class MotionTrail {
    constructor(maxPoints = 20, fadeRate = 0.95) {
        this.points = [];
        this.maxPoints = maxPoints;
        this.fadeRate = fadeRate;
    }
    
    addPoint(x, y, color = '#ffffff', width = 2) {
        this.points.push({ x, y, color, width, alpha: 1.0 });
        
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
    }
    
    update() {
        // Fade all points
        for (let i = this.points.length - 1; i >= 0; i--) {
            this.points[i].alpha *= this.fadeRate;
            if (this.points[i].alpha < 0.01) {
                this.points.splice(i, 1);
            }
        }
    }
    
    draw(ctx) {
        if (this.points.length < 2) return;
        
        ctx.save();
        
        // Draw trail as connected lines
        for (let i = 1; i < this.points.length; i++) {
            const prev = this.points[i - 1];
            const curr = this.points[i];
            
            const gradient = ctx.createLinearGradient(prev.x, prev.y, curr.x, curr.y);
            gradient.addColorStop(0, this.colorWithAlpha(prev.color, prev.alpha));
            gradient.addColorStop(1, this.colorWithAlpha(curr.color, curr.alpha));
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = curr.width * curr.alpha;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    colorWithAlpha(color, alpha) {
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return color;
    }
    
    clear() {
        this.points = [];
    }
}

// Enhanced screen effects
class ScreenEffects {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.flashColor = null;
        this.flashDuration = 0;
        this.flashAlpha = 0;
        this.rippleCenter = null;
        this.rippleRadius = 0;
        this.rippleMaxRadius = 0;
        this.zoomScale = 1;
        this.zoomTarget = 1;
        this.zoomDuration = 0;
        this.chromaticAberration = 0;
    }
    
    shake(intensity = 5, duration = 10) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeDuration = Math.max(this.shakeDuration, duration);
    }
    
    addShake(intensity = 5, duration = 10) {
        this.shake(intensity, duration);
    }
    
    flash(color = '#ffffff', duration = 5, intensity = 0.3) {
        this.flashColor = color;
        this.flashDuration = duration;
        this.flashAlpha = intensity;
    }
    
    addFlash(color = '#ffffff', duration = 5, intensity = 0.3) {
        this.flash(color, duration, intensity);
    }
    
    ripple(x, y, maxRadius = 200) {
        this.rippleCenter = { x, y };
        this.rippleRadius = 0;
        this.rippleMaxRadius = maxRadius;
    }
    
    zoom(scale, duration = 20) {
        this.zoomTarget = scale;
        this.zoomDuration = duration;
    }
    
    chromaticAberration(amount) {
        this.chromaticAberration = amount;
    }
    
    update() {
        if (this.shakeDuration > 0) {
            this.shakeDuration--;
        } else {
            this.shakeIntensity = 0;
        }
        
        if (this.flashDuration > 0) {
            this.flashDuration--;
            this.flashAlpha *= 0.9; // Fade out flash
        } else {
            this.flashColor = null;
            this.flashAlpha = 0;
        }
        
        // Update ripple
        if (this.rippleCenter) {
            this.rippleRadius += 5;
            if (this.rippleRadius > this.rippleMaxRadius) {
                this.rippleCenter = null;
                this.rippleRadius = 0;
            }
        }
        
        // Smooth zoom with auto-reset
        if (this.zoomDuration > 0) {
            this.zoomDuration--;
            if (this.zoomDuration === 0) {
                this.zoomTarget = 1; // Reset zoom after duration
            }
        }
        this.zoomScale = Utils.lerp(this.zoomScale, this.zoomTarget, 0.1);
        if (Math.abs(this.zoomScale - this.zoomTarget) < 0.01) {
            this.zoomScale = this.zoomTarget;
        }
        
        // Fade chromatic aberration
        this.chromaticAberration *= 0.95;
    }
    
    getShakeOffset() {
        if (this.shakeIntensity > 0) {
            return {
                x: Utils.random(-this.shakeIntensity, this.shakeIntensity),
                y: Utils.random(-this.shakeIntensity, this.shakeIntensity)
            };
        }
        return { x: 0, y: 0 };
    }
    
    getTransform() {
        const shake = this.getShakeOffset();
        return {
            x: shake.x,
            y: shake.y,
            scale: this.zoomScale
        };
    }
    
    drawFlash() {
        if (this.flashColor && this.flashAlpha > 0.01) {
            this.ctx.save();
            this.ctx.globalAlpha = this.flashAlpha;
            this.ctx.fillStyle = this.flashColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }
    }
    
    drawRipple() {
        if (!this.rippleCenter) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 1 - (this.rippleRadius / this.rippleMaxRadius);
        
        // Ensure inner radius is never negative
        const innerRadius = Math.max(0, this.rippleRadius - 10);
        const outerRadius = this.rippleRadius + 10;
        
        const gradient = this.ctx.createRadialGradient(
            this.rippleCenter.x, this.rippleCenter.y, innerRadius,
            this.rippleCenter.x, this.rippleCenter.y, outerRadius
        );
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
        
        this.ctx.strokeStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(this.rippleCenter.x, this.rippleCenter.y, this.rippleRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
    }
}

// CRT/Scanline effects for retro look
class CRTFilter {
    constructor(canvas) {
        this.canvas = canvas;
        this.enabled = true;
        this.scanlineIntensity = 0.15;
        this.noiseIntensity = 0.05;
        this.curvature = 0.1;
        this.vignetteIntensity = 0.3;
    }
    
    draw(ctx) {
        if (!this.enabled) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Draw scanlines
        ctx.save();
        ctx.globalAlpha = this.scanlineIntensity;
        ctx.fillStyle = '#000000';
        for (let y = 0; y < height; y += 4) {
            ctx.fillRect(0, y, width, 1);
        }
        ctx.restore();
        
        // Draw subtle noise using overlay blend mode
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = this.noiseIntensity;
        
        // Draw noise as small random dots instead of full imageData
        for (let i = 0; i < width * height * 0.01; i++) { // 1% pixel density
            const x = Math.random() * width;
            const y = Math.random() * height;
            const brightness = Math.random() * 255;
            ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
            ctx.fillRect(x, y, 1, 1);
        }
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        
        // Draw vignette
        ctx.save();
        const gradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) / 2
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${this.vignetteIntensity})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
}

// Enhanced sprite creator for pixel art
class SpriteCreator {
    static createRect(width, height, color) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
        return canvas;
    }
    
    static createCircle(radius, color) {
        const canvas = document.createElement('canvas');
        const size = radius * 2;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.fill();
        return canvas;
    }
    
    static createGradientRect(width, height, color1, color2, direction = 'vertical') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        const gradient = direction === 'vertical' 
            ? ctx.createLinearGradient(0, 0, 0, height)
            : ctx.createLinearGradient(0, 0, width, 0);
        
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        return canvas;
    }
    
    static createGlowingCircle(radius, color, glowSize = 10) {
        const canvas = document.createElement('canvas');
        const size = (radius + glowSize) * 2;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const center = size / 2;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(center, center, radius, center, center, radius + glowSize);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(center, center, radius + glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Core circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fill();
        
        return canvas;
    }
    
    static createPill(width, height, color) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const radius = height / 2;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, Math.PI / 2, Math.PI * 1.5);
        ctx.arc(width - radius, radius, radius, Math.PI * 1.5, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        
        return canvas;
    }
    
    static createStar(size, color, points = 5) {
        const canvas = document.createElement('canvas');
        canvas.width = size * 2;
        canvas.height = size * 2;
        const ctx = canvas.getContext('2d');
        const center = size;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const radius = i % 2 === 0 ? size : size * 0.4;
            const x = center + Math.cos(angle) * radius;
            const y = center + Math.sin(angle) * radius;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.closePath();
        ctx.fill();
        
        return canvas;
    }
    
    static createStripedRect(width, height, color1, color2, stripeWidth = 4, angle = 0) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw base
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, width, height);
        
        // Draw stripes
        ctx.fillStyle = color2;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(angle);
        
        for (let x = -width; x < width * 2; x += stripeWidth * 2) {
            ctx.fillRect(x - width, -height, stripeWidth, height * 2);
        }
        
        ctx.restore();
        return canvas;
    }
}

// Lighting system for dynamic lighting effects
class LightingSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.lights = [];
        this.ambientLight = 0.2;
    }
    
    addLight(x, y, radius, intensity = 1.0, color = '#ffffff') {
        const light = {
            x, y, radius, intensity, color,
            flicker: 0,
            flickerSpeed: 0,
            pulse: false,
            pulseSpeed: 0
        };
        this.lights.push(light);
        return light;
    }
    
    update() {
        this.lights.forEach(light => {
            if (light.flickerSpeed > 0) {
                light.flicker = Math.sin(Date.now() * light.flickerSpeed) * 0.1;
            }
            if (light.pulse) {
                light.intensity = 0.5 + Math.sin(Date.now() * light.pulseSpeed) * 0.5;
            }
        });
    }
    
    draw(ctx) {
        if (this.lights.length === 0) return;
        
        // Create light map
        const lightMap = ctx.createImageData(this.canvas.width, this.canvas.height);
        const data = lightMap.data;
        
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                let brightness = this.ambientLight;
                
                // Calculate brightness from all lights
                this.lights.forEach(light => {
                    const dx = x - light.x;
                    const dy = y - light.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const effectiveRadius = light.radius * (1 + light.flicker);
                    const lightIntensity = Math.max(0, 1 - (distance / effectiveRadius));
                    brightness += lightIntensity * light.intensity * 0.5;
                });
                
                brightness = Math.min(1, brightness);
                
                const index = (y * this.canvas.width + x) * 4;
                data[index] = brightness * 255;     // R
                data[index + 1] = brightness * 255; // G
                data[index + 2] = brightness * 255; // B
                data[index + 3] = 150;              // A (transparency)
            }
        }
        
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.putImageData(lightMap, 0, 0);
        ctx.restore();
    }
}
