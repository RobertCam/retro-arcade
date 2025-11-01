// Theme system for Breakout game
// Provides different visual themes based on level

class ThemeManager {
    constructor(graphicsCore) {
        this.graphics = graphicsCore;
        this.themes = this.defineThemes();
        this.currentTheme = null;
        this.backgroundContainer = null;
    }
    
    defineThemes() {
        return {
            space: {
                name: 'Space',
                backgroundColor: 0x0a0a1a,
                stars: [],
                colors: {
                    paddle: 0x00ccff,
                    ball: 0xffffff,
                    bricks: [0x4a9eff, 0x7f7fff, 0xff4aff, 0xff7f7f, 0xffaa00, 0xffff00],
                    particles: 0x00ccff
                },
                effects: {
                    stars: true,
                    nebula: true,
                    glow: true
                }
            },
            underwater: {
                name: 'Underwater',
                backgroundColor: 0x001122,
                bubbles: [],
                colors: {
                    paddle: 0x00ffff,
                    ball: 0xffff00,
                    bricks: [0x0088ff, 0x00aaff, 0x00ddff, 0x88ffaa, 0xaaff88, 0xccffaa],
                    particles: 0x88ddff
                },
                effects: {
                    bubbles: true,
                    caustics: true,
                    seaweed: true
                }
            },
            jungle: {
                name: 'Jungle',
                backgroundColor: 0x0a2a0a,
                leaves: [],
                colors: {
                    paddle: 0x44ff44,
                    ball: 0xffaa00,
                    bricks: [0x44aa22, 0x66cc33, 0x88dd44, 0xaaff55, 0xff8844, 0xffaa44],
                    particles: 0x88ff44
                },
                effects: {
                    leaves: true,
                    vines: true,
                    fireflies: true
                }
            },
            volcano: {
                name: 'Volcano',
                backgroundColor: 0x1a0a00,
                embers: [],
                colors: {
                    paddle: 0xff4400,
                    ball: 0xffdd00,
                    bricks: [0xff0000, 0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffdd00],
                    particles: 0xff6600
                },
                effects: {
                    embers: true,
                    lava: true,
                    smoke: true
                }
            },
            neon: {
                name: 'Neon City',
                backgroundColor: 0x000011,
                colors: {
                    paddle: 0xff00ff,
                    ball: 0x00ffff,
                    bricks: [0xff00ff, 0x00ffff, 0xffff00, 0xff00ff, 0x00ffff, 0xffff00],
                    particles: 0xffffff
                },
                effects: {
                    grid: true,
                    glow: true,
                    scanlines: true
                }
            },
            desert: {
                name: 'Desert',
                backgroundColor: 0x2a1a0a,
                colors: {
                    paddle: 0xffaa44,
                    ball: 0xffdd88,
                    bricks: [0xcc8844, 0xdd9944, 0xeeaa44, 0xffbb44, 0xffcc44, 0xffdd44],
                    particles: 0xffcc44
                },
                effects: {
                    sand: true,
                    mirage: true
                }
            }
        };
    }
    
    getThemeForLevel(level) {
        const themeKeys = Object.keys(this.themes);
        // Cycle through themes every few levels
        const themeIndex = Math.floor((level - 1) / 3) % themeKeys.length;
        return this.themes[themeKeys[themeIndex]];
    }
    
    applyTheme(level) {
        const theme = this.getThemeForLevel(level);
        this.currentTheme = theme;
        
        // Update background
        this.createBackground(theme);
        
        return theme;
    }
    
    createBackground(theme) {
        const bgLayer = this.graphics.getLayer('background');
        if (!bgLayer) return;
        
        // Clear existing background
        bgLayer.removeChildren();
        
        // Create background container
        if (!this.backgroundContainer) {
            this.backgroundContainer = new PIXI.Container();
            bgLayer.addChild(this.backgroundContainer);
        } else {
            this.backgroundContainer.removeChildren();
        }
        
        // Set background color
        const bgGraphics = new PIXI.Graphics();
        bgGraphics.beginFill(theme.backgroundColor);
        bgGraphics.drawRect(0, 0, this.graphics.app.screen.width, this.graphics.app.screen.height);
        bgGraphics.endFill();
        this.backgroundContainer.addChild(bgGraphics);
        
        // Add theme-specific background effects
        if (theme.effects.stars) {
            this.createStars(theme);
        }
        if (theme.effects.bubbles) {
            this.createBubbles(theme);
        }
        if (theme.effects.nebula) {
            this.createNebula(theme);
        }
        if (theme.effects.grid) {
            this.createGrid(theme);
        }
        if (theme.effects.sand) {
            this.createSandEffect(theme);
        }
    }
    
    createStars(theme) {
        const starContainer = new PIXI.Container();
        const width = this.graphics.app.screen.width;
        const height = this.graphics.app.screen.height;
        
        // Create twinkling stars
        for (let i = 0; i < 100; i++) {
            const star = new PIXI.Graphics();
            const size = Math.random() * 2 + 0.5;
            const x = Math.random() * width;
            const y = Math.random() * height;
            const brightness = Math.random() * 0.5 + 0.5;
            
            star.beginFill(0xffffff, brightness);
            star.drawCircle(x, y, size);
            star.endFill();
            
            // Add twinkle animation
            star.alpha = brightness;
            star.userData = {
                baseAlpha: brightness,
                twinkleSpeed: Math.random() * 0.02 + 0.01,
                twinklePhase: Math.random() * Math.PI * 2
            };
            
            starContainer.addChild(star);
        }
        
        this.backgroundContainer.addChild(starContainer);
        theme.stars = starContainer;
    }
    
    createBubbles(theme) {
        const bubbleContainer = new PIXI.Container();
        const width = this.graphics.app.screen.width;
        
        // Create floating bubbles
        for (let i = 0; i < 30; i++) {
            const bubble = new PIXI.Graphics();
            const size = Math.random() * 20 + 10;
            const x = Math.random() * width;
            const y = this.graphics.app.screen.height + size;
            
            bubble.lineStyle(2, 0x88ddff, 0.6);
            bubble.beginFill(0x88ddff, 0.2);
            bubble.drawCircle(0, 0, size);
            bubble.endFill();
            bubble.x = x;
            bubble.y = y;
            
            bubble.userData = {
                speed: Math.random() * 0.5 + 0.2,
                floatSpeed: Math.random() * 0.5 + 0.5
            };
            
            bubbleContainer.addChild(bubble);
        }
        
        this.backgroundContainer.addChild(bubbleContainer);
        theme.bubbles = bubbleContainer;
    }
    
    createNebula(theme) {
        const nebula = new PIXI.Graphics();
        const width = this.graphics.app.screen.width;
        const height = this.graphics.app.screen.height;
        
        // Create colorful nebula clouds
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = Math.random() * 150 + 100;
            const color = [0x4a0099, 0x7f00ff, 0xff00ff][Math.floor(Math.random() * 3)];
            
            const gradient = nebula.beginFill(color, 0.3);
            nebula.drawCircle(x, y, radius);
            nebula.endFill();
        }
        
        this.backgroundContainer.addChild(nebula);
    }
    
    createGrid(theme) {
        const grid = new PIXI.Graphics();
        const width = this.graphics.app.screen.width;
        const height = this.graphics.app.screen.height;
        const spacing = 50;
        
        grid.lineStyle(1, 0x00ffff, 0.2);
        
        // Vertical lines
        for (let x = 0; x < width; x += spacing) {
            grid.moveTo(x, 0);
            grid.lineTo(x, height);
        }
        
        // Horizontal lines
        for (let y = 0; y < height; y += spacing) {
            grid.moveTo(0, y);
            grid.lineTo(width, y);
        }
        
        this.backgroundContainer.addChild(grid);
    }
    
    createSandEffect(theme) {
        // Create sand texture
        const sand = new PIXI.Graphics();
        const width = this.graphics.app.screen.width;
        const height = this.graphics.app.screen.height;
        
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 1.5 + 0.5;
            
            sand.beginFill(0xffdd88, 0.3);
            sand.drawCircle(x, y, size);
            sand.endFill();
        }
        
        this.backgroundContainer.addChild(sand);
    }
    
    update(theme) {
        if (!theme) return;
        
        // Update star twinkling
        if (theme.stars && theme.stars.children) {
            theme.stars.children.forEach(star => {
                if (star.userData) {
                    star.userData.twinklePhase += star.userData.twinkleSpeed;
                    star.alpha = star.userData.baseAlpha + Math.sin(star.userData.twinklePhase) * 0.3;
                }
            });
        }
        
        // Update bubbles
        if (theme.bubbles && theme.bubbles.children) {
            theme.bubbles.children.forEach(bubble => {
                if (bubble.userData) {
                    bubble.y -= bubble.userData.speed;
                    bubble.x += Math.sin(bubble.y * bubble.userData.floatSpeed) * 0.5;
                    
                    // Reset bubble if it goes off screen
                    if (bubble.y < -bubble.height) {
                        bubble.y = this.graphics.app.screen.height + bubble.height;
                        bubble.x = Math.random() * this.graphics.app.screen.width;
                    }
                }
            });
        }
    }
}

