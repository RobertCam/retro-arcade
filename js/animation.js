// Simple animation system for retro arcade games
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

// Particle system for effects
class Particle {
    constructor(x, y, vx, vy, life, color, size = 2) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.gravity = 0.1;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life--;
        
        // Fade out
        this.alpha = this.life / this.maxLife;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
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
    
    explode(x, y, count = 10, color = '#ffff00') {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = Utils.random(2, 6);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const life = Utils.randomInt(30, 60);
            
            this.addParticle(new Particle(x, y, vx, vy, life, color));
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

// Screen effects
class ScreenEffects {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.flashColor = null;
        this.flashDuration = 0;
    }
    
    shake(intensity = 5, duration = 10) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }
    
    flash(color = '#ffffff', duration = 5) {
        this.flashColor = color;
        this.flashDuration = duration;
    }
    
    update() {
        if (this.shakeDuration > 0) {
            this.shakeDuration--;
        } else {
            this.shakeIntensity = 0;
        }
        
        if (this.flashDuration > 0) {
            this.flashDuration--;
        } else {
            this.flashColor = null;
        }
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
    
    drawFlash() {
        if (this.flashColor && this.flashDuration > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillStyle = this.flashColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }
    }
}

// Simple sprite creator for pixel art
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
}
