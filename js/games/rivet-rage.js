/**
 * Rivet Rage — endless top-down auto-aim arena shooter.
 * Worker vs oligarch goons. Vampire Survivors-lite leveling.
 * Rendering uses pooled sprites + a one-time arena (no per-frame Graphics spam).
 */
const RIVET_RAGE = {
    playerSpeed: 2.4,
    playerRadius: 13,
    playerMaxHp: 5,
    iFrameMs: 850,
    // Mid pacing — first upgrade ~10–12 early goons
    xpBase: 22,
    xpGrowth: 1.42,
    maxWeapons: 4,
    maxEnemies: 48,
    maxParticles: 64,
    maxProjectiles: 80,
    pickupMagnet: 42,
    waveDurationMs: 20000,
    timeBonusPerSec: 2,
    arenaEveryWaves: 3
};

const RR_WEAPONS = {
    rivetGun: {
        id: 'rivetGun', name: 'Rivet Gun', desc: 'Auto bolts at nearest foe',
        maxLevel: 5, base: { cooldown: 340, damage: 14, range: 270, speed: 6.5, count: 1, pierce: 0 }
    },
    arcWelder: {
        id: 'arcWelder', name: 'Arc Welder', desc: 'Short-range welding cone',
        maxLevel: 5, base: { cooldown: 180, damage: 6, range: 90, arc: 0.9 }
    },
    nailburst: {
        id: 'nailburst', name: 'Nailburst', desc: 'Close shotgun spread',
        maxLevel: 5, base: { cooldown: 700, damage: 8, range: 140, speed: 5.5, count: 5, spread: 0.45 }
    },
    pneumaticSpike: {
        id: 'pneumaticSpike', name: 'Pneumatic Spike', desc: 'Slow piercing spike',
        maxLevel: 5, base: { cooldown: 1100, damage: 28, range: 340, speed: 7.5, count: 1, pierce: 3 }
    },
    orbitWrenches: {
        id: 'orbitWrenches', name: 'Orbit Wrenches', desc: 'Spinning melee wrenches',
        maxLevel: 3, base: { cooldown: 0, damage: 10, radius: 48, count: 1, spin: 0.045 }
    },
    forgeHammer: {
        id: 'forgeHammer', name: 'Forge Hammer', desc: 'Slam AoE around you',
        maxLevel: 5, base: { cooldown: 1600, damage: 22, range: 70 }
    },
    scrapSaw: {
        id: 'scrapSaw', name: 'Scrap Saw', desc: 'Bouncing buzz blade',
        maxLevel: 5, base: { cooldown: 900, damage: 14, range: 320, speed: 5.2, bounces: 3 }
    },
    greaseBomb: {
        id: 'greaseBomb', name: 'Grease Bomb', desc: 'Slowing oil puddles',
        maxLevel: 5, base: { cooldown: 2200, damage: 4, range: 220, radius: 48, duration: 2800 }
    },
    railRiveter: {
        id: 'railRiveter', name: 'Rail Riveter', desc: 'Piercing laser burst',
        maxLevel: 5, base: { cooldown: 1400, damage: 36, range: 420 }
    }
};

const RR_STATS = {
    moveSpeed: { id: 'moveSpeed', name: 'Steel Toes', desc: '+12% move speed' },
    maxHp: { id: 'maxHp', name: 'Hard Hat', desc: '+1 max HP & heal 1' },
    pickupRadius: { id: 'pickupRadius', name: 'Magnet Boots', desc: '+30% pickup radius' },
    armor: { id: 'armor', name: 'Thick Skin', desc: '+1 armor (less damage)' },
    damage: { id: 'damage', name: 'Hot Rivets', desc: '+15% all weapon damage' },
    fireRate: { id: 'fireRate', name: 'Grease Gun', desc: '+12% fire rate' },
    range: { id: 'range', name: 'Long Reach', desc: '+15% weapon range' },
    xpGain: { id: 'xpGain', name: 'Union Card', desc: '+20% XP from kills' },
    crit: { id: 'crit', name: 'Lucky Strike', desc: '+8% crit (2x damage)' },
    repair: { id: 'repair', name: 'Field Medic', desc: '8% chance to heal 1 on kill' },
    projectileSpeed: { id: 'projectileSpeed', name: 'Air Hose', desc: '+15% projectile speed' },
    // Run-defining powers
    pulseShield: { id: 'pulseShield', name: 'Pulse Shield', desc: 'Intermittent force bubble blocks hits' },
    dash: { id: 'dash', name: 'Jet Boots', desc: 'Shift/E dash (or upgrade dash)' },
    thorns: { id: 'thorns', name: 'Rivet Mail', desc: 'Contact enemies take spike damage' },
    chainKill: { id: 'chainKill', name: 'Spark Chain', desc: 'Kills arc damage to nearby foes' },
    berserk: { id: 'berserk', name: 'Overtime', desc: 'Low HP: +damage & speed' },
    magnetPulse: { id: 'magnetPulse', name: 'Scrap Magnet', desc: 'Periodic pull on pickups & foes' },
    ricochet: { id: 'ricochet', name: 'Bank Shot', desc: 'Shots bounce off walls once' },
    overclock: { id: 'overclock', name: 'Overclock', desc: 'Periodic fire-rate surge' }
};

/** Starting run archetypes — picked before each endless run */
const RR_RUNS = [
    {
        id: 'riveter',
        name: 'RIVETER',
        desc: 'Balanced starter. Rivet Gun ready.',
        color: 0xffaa33,
        weapons: ['rivetGun'],
        apply: (p, game) => {}
    },
    {
        id: 'sparkie',
        name: 'SPARKIE',
        desc: 'Arc Welder start. Short-range burn.',
        color: 0x66ddff,
        weapons: ['arcWelder'],
        apply: (p) => { p.damageMult *= 1.08; }
    },
    {
        id: 'sprinter',
        name: 'SPRINTER',
        desc: 'Jet Boots dash + move speed.',
        color: 0x88ff66,
        weapons: ['rivetGun'],
        apply: (p) => { p.speed *= 1.18; p.powers.dash = 1; }
    },
    {
        id: 'foreman',
        name: 'FOREMAN',
        desc: 'Pulse Shield + tougher hide.',
        color: 0xff66aa,
        weapons: ['rivetGun'],
        apply: (p) => {
            p.maxHp += 1;
            p.hp = p.maxHp;
            p.powers.pulseShield = 1;
        }
    },
    {
        id: 'sawbones',
        name: 'SAWBONES',
        desc: 'Scrap Saw + Bank Shot ricochet.',
        color: 0xcc8866,
        weapons: ['scrapSaw'],
        apply: (p) => { p.powers.ricochet = 1; }
    },
    {
        id: 'loader',
        name: 'LOADER',
        desc: 'Scrap Magnet pulse + bigger pickup pull.',
        color: 0xaaff66,
        weapons: ['rivetGun'],
        apply: (p) => {
            p.pickupRadius *= 1.4;
            p.powers.magnetPulse = 1;
        }
    }
];

const RR_ENEMIES = {
    // Early goons: ~2 rivet shots. Elite types unlock later and stay chunkier.
    goon: { hp: 22, speed: 0.95, radius: 13, xp: 3, score: 25, unlockWave: 1, deathColor: 0x4a7ad4 },
    bagger: { hp: 30, speed: 0.72, radius: 14, xp: 5, score: 40, unlockWave: 4, shootCd: 2000, deathColor: 0xffd700 },
    bruiser: { hp: 95, speed: 0.62, radius: 18, xp: 10, score: 80, unlockWave: 7, deathColor: 0xff4444 },
    drone: { hp: 16, speed: 1.85, radius: 12, xp: 5, score: 35, unlockWave: 10, deathColor: 0x44ff88 }
};

/** Obstacle layouts — swapped every few waves */
const RR_ARENAS = [
    {
        id: 'yard',
        name: 'LOADING YARD',
        floorA: 0x1c2535, floorB: 0x182030, edge: 0xc9a227, accent: 0x3a4a60,
        obstacles: [
            { x: 180, y: 150, w: 56, h: 56, kind: 'crate' },
            { x: 564, y: 150, w: 56, h: 56, kind: 'crate' },
            { x: 180, y: 400, w: 56, h: 56, kind: 'crate' },
            { x: 564, y: 400, w: 56, h: 56, kind: 'crate' },
            { x: 372, y: 270, w: 56, h: 56, kind: 'pillar' }
        ]
    },
    {
        id: 'lanes',
        name: 'ASSEMBLY LANES',
        floorA: 0x1a2830, floorB: 0x152028, edge: 0x44aadd, accent: 0x2a5060,
        obstacles: [
            { x: 140, y: 120, w: 48, h: 140, kind: 'pipe' },
            { x: 140, y: 360, w: 48, h: 140, kind: 'pipe' },
            { x: 612, y: 120, w: 48, h: 140, kind: 'pipe' },
            { x: 612, y: 360, w: 48, h: 140, kind: 'pipe' },
            { x: 340, y: 250, w: 120, h: 48, kind: 'crate' }
        ]
    },
    {
        id: 'foundry',
        name: 'FOUNDRY FLOOR',
        floorA: 0x2a1818, floorB: 0x221414, edge: 0xff6622, accent: 0x603020,
        obstacles: [
            { x: 100, y: 100, w: 64, h: 64, kind: 'pillar' },
            { x: 636, y: 100, w: 64, h: 64, kind: 'pillar' },
            { x: 100, y: 436, w: 64, h: 64, kind: 'pillar' },
            { x: 636, y: 436, w: 64, h: 64, kind: 'pillar' },
            { x: 280, y: 260, w: 48, h: 80, kind: 'pipe' },
            { x: 472, y: 260, w: 48, h: 80, kind: 'pipe' }
        ]
    },
    {
        id: 'cross',
        name: 'CROSS DOCK',
        floorA: 0x1a2430, floorB: 0x162028, edge: 0x88cc44, accent: 0x3a5030,
        obstacles: [
            { x: 120, y: 268, w: 200, h: 48, kind: 'crate' },
            { x: 480, y: 268, w: 200, h: 48, kind: 'crate' },
            { x: 376, y: 100, w: 48, h: 160, kind: 'pipe' },
            { x: 376, y: 360, w: 48, h: 160, kind: 'pipe' }
        ]
    },
    {
        id: 'ring',
        name: 'RING DECK',
        floorA: 0x182230, floorB: 0x141c28, edge: 0xddaa44, accent: 0x4a4030,
        obstacles: [
            { x: 220, y: 160, w: 56, h: 56, kind: 'pillar' },
            { x: 524, y: 160, w: 56, h: 56, kind: 'pillar' },
            { x: 220, y: 384, w: 56, h: 56, kind: 'pillar' },
            { x: 524, y: 384, w: 56, h: 56, kind: 'pillar' },
            { x: 372, y: 120, w: 56, h: 40, kind: 'crate' },
            { x: 372, y: 440, w: 56, h: 40, kind: 'crate' },
            { x: 120, y: 280, w: 40, h: 56, kind: 'crate' },
            { x: 640, y: 280, w: 40, h: 56, kind: 'crate' }
        ]
    },
    {
        id: 'corridor',
        name: 'SERVICE CORRIDOR',
        floorA: 0x1c1c28, floorB: 0x181820, edge: 0xaa66ff, accent: 0x403060,
        obstacles: [
            { x: 80, y: 80, w: 280, h: 48, kind: 'pipe' },
            { x: 440, y: 80, w: 280, h: 48, kind: 'pipe' },
            { x: 80, y: 472, w: 280, h: 48, kind: 'pipe' },
            { x: 440, y: 472, w: 280, h: 48, kind: 'pipe' },
            { x: 372, y: 220, w: 56, h: 56, kind: 'pillar' },
            { x: 372, y: 340, w: 56, h: 56, kind: 'pillar' }
        ]
    }
];

class RivetRageGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width || 800;
        this.height = canvas.height || 600;
        this.isPreview = canvas.id === 'rivet-rage-preview' || this.width < 400;
        this.onReady = null;
        this.touchControls = null;

        if (this.isPreview) {
            this.ctx = canvas.getContext('2d');
            this.graphics = null;
        } else {
            this.ctx = null;
            this.graphics = new GraphicsCore(canvas, {
                width: this.width,
                height: this.height,
                backgroundColor: 0x151c28,
                pixelPerfect: true
            });
        }

        this.gameState = 'menu';
        this.keys = {};
        this.lastTime = 0;
        this.tickerCallback = null;
        this.rafId = null;
        this.shootSfxCd = 0;
        this.hitSfxCd = 0;
        this.statsPanelCd = 0;
        this.hudDirty = true;
        this.overlayState = null;

        this.textures = null;
        this.scene = null;
        this.arenaIndex = 0;
        this.arenaBannerMs = 0;
        this.arenaBannerName = '';

        this.obstacles = [];
        this.resetRunState();
        this.setupInput();

        if (this.isPreview) {
            this.drawPreview();
            if (typeof this.onReady === 'function') this.onReady();
        } else {
            this.initGraphics();
        }
    }

    resetRunState() {
        this.score = 0;
        this.wave = 1;
        this.surviveMs = 0;
        this.kills = 0;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = RIVET_RAGE.xpBase;
        this.timeBonusAcc = 0;

        this.player = {
            x: this.width / 2,
            y: this.height / 2,
            radius: RIVET_RAGE.playerRadius,
            speed: RIVET_RAGE.playerSpeed,
            hp: RIVET_RAGE.playerMaxHp,
            maxHp: RIVET_RAGE.playerMaxHp,
            armor: 0,
            pickupRadius: RIVET_RAGE.pickupMagnet,
            invincibleMs: 0,
            facing: 0,
            anim: 0,
            moving: false,
            damageMult: 1,
            cooldownMult: 1,
            rangeMult: 1,
            xpMult: 1,
            critChance: 0,
            repairChance: 0,
            projSpeedMult: 1,
            powers: {
                pulseShield: 0,
                dash: 0,
                thorns: 0,
                chainKill: 0,
                berserk: 0,
                magnetPulse: 0,
                ricochet: 0,
                overclock: 0
            },
            shieldActive: false,
            shieldTimer: 0,
            shieldCycle: 0,
            dashCd: 0,
            dashMs: 0,
            dashDirX: 0,
            dashDirY: 0,
            magnetTimer: 0,
            overclockTimer: 0,
            overclockActive: 0,
            runId: 'riveter'
        };

        this.weapons = [{ id: 'rivetGun', level: 1, cooldown: 0 }];
        this.projectiles = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.pickups = [];
        this.orbs = [];
        this.zones = [];
        this.welderFlash = null;
        this.railFlash = null;
        this.hammerFlash = null;
        this.particles = [];
        this.waveTimer = 0;
        this.spawnTimer = 0;
        this.levelUpCards = [];
        this.hudDirty = true;
        this.overlayState = null;
        this.arenaBannerMs = 0;
        this.pendingArena = null;
        this.pendingArenaMs = 0;
        this.selectedRun = 0;
        this.applyArenaLayout(0, false);
    }

    applyArenaLayout(index, announce = true) {
        this.arenaIndex = ((index % RR_ARENAS.length) + RR_ARENAS.length) % RR_ARENAS.length;
        const layout = RR_ARENAS[this.arenaIndex];
        this.obstacles = layout.obstacles.map((o) => ({ ...o }));
        if (announce) {
            this.arenaBannerName = layout.name;
            this.arenaBannerMs = 2400;
        }

        // Soft transition: stay near current spot if possible, never dump into a swarm
        if (this.player) {
            this.resolveObstacles(this.player);
            // If still overlapping a fat obstacle cluster, fall back to center
            let stuck = false;
            for (const o of this.obstacles) {
                const nearestX = Math.max(o.x, Math.min(this.player.x, o.x + o.w));
                const nearestY = Math.max(o.y, Math.min(this.player.y, o.y + o.h));
                if (Math.hypot(this.player.x - nearestX, this.player.y - nearestY) < this.player.radius - 1) {
                    stuck = true;
                    break;
                }
            }
            if (stuck) {
                this.player.x = this.width / 2;
                this.player.y = this.height / 2;
                this.resolveObstacles(this.player);
            }
            this.player.invincibleMs = Math.max(this.player.invincibleMs, 2500);
            this.player.vx = 0;
            this.player.vy = 0;
        }

        this.enemyBullets = [];
        this.zones = [];
        this.projectiles = [];
        this.relocateEnemiesAfterArenaSwap();
        this.spawnTimer = Math.max(this.spawnTimer, 2200);

        if (this.scene?.arena) {
            this.scene.arena.removeChildren();
            this.drawStaticArena(this.scene.arena);
        }
    }

    relocateEnemiesAfterArenaSwap() {
        if (!this.player) return;
        const safeR = 160;
        for (const e of this.enemies) {
            this.resolveObstacles(e);
            const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            if (dist < safeR) {
                this.placeOnMapEdge(e);
                this.resolveObstacles(e);
            }
        }
    }

    placeOnMapEdge(ent) {
        const edge = Math.floor(Math.random() * 4);
        const m = 40;
        if (edge === 0) { ent.x = Math.random() * this.width; ent.y = m; }
        else if (edge === 1) { ent.x = this.width - m; ent.y = Math.random() * this.height; }
        else if (edge === 2) { ent.x = Math.random() * this.width; ent.y = this.height - m; }
        else { ent.x = m; ent.y = Math.random() * this.height; }
    }

    arenaIndexForWave(wave) {
        return Math.floor((Math.max(1, wave) - 1) / RIVET_RAGE.arenaEveryWaves) % RR_ARENAS.length;
    }

    // ── Texture / scene bootstrap ───────────────────────────────────

    makeTex(draw, size) {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        draw(ctx, size);
        const tex = PIXI.Texture.from(c);
        tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return tex;
    }

    /** SNES / Genesis style: chunky pixels, hard outlines, limited palette. */
    buildTextures() {
        const T = {};
        const px = (ctx, x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
        };

        // Worker — 16-bit factory hero, facing right
        T.player = this.makeTex((ctx, s) => {
            const c = s / 2;
            // shadow
            px(ctx, c - 8, c + 14, 16, 3, '#0a1020');
            // boots
            px(ctx, c - 8, c + 10, 6, 4, '#3a2818');
            px(ctx, c + 2, c + 10, 6, 4, '#3a2818');
            // legs
            px(ctx, c - 6, c + 4, 5, 7, '#1a4a9a');
            px(ctx, c + 1, c + 4, 5, 7, '#1a4a9a');
            // torso
            px(ctx, c - 8, c - 6, 16, 12, '#2a6ad4');
            px(ctx, c - 6, c - 4, 12, 8, '#3d88f0');
            // belt
            px(ctx, c - 8, c + 4, 16, 2, '#c9a227');
            // arms
            px(ctx, c - 12, c - 4, 4, 8, '#f0b890');
            px(ctx, c + 8, c - 2, 10, 4, '#f0b890');
            // head
            px(ctx, c - 6, c - 14, 12, 10, '#f5d0b0');
            // hard hat
            px(ctx, c - 8, c - 16, 16, 4, '#ff8c00');
            px(ctx, c - 6, c - 18, 12, 3, '#ffb347');
            px(ctx, c - 1, c - 19, 2, 2, '#ffdd66');
            // eyes
            px(ctx, c - 3, c - 11, 2, 2, '#1a1020');
            px(ctx, c + 2, c - 11, 2, 2, '#1a1020');
            // rivet gun
            px(ctx, c + 14, c - 3, 12, 3, '#ffcc33');
            px(ctx, c + 24, c - 4, 4, 5, '#888');
            px(ctx, c + 26, c - 2, 4, 2, '#fff0aa');
            // outline accents
            px(ctx, c - 8, c - 6, 1, 12, '#7ef9ff');
            px(ctx, c + 7, c - 6, 1, 12, '#7ef9ff');
        }, 48);

        // Goon — navy suit + top hat (blocky silhouette)
        T.goon = this.makeTex((ctx, s) => {
            const c = s / 2;
            px(ctx, c - 9, c - 4, 18, 20, '#0d2a58');
            px(ctx, c - 7, c - 2, 14, 16, '#1a4a9a');
            px(ctx, c - 12, c - 2, 4, 10, '#0a1e40');
            px(ctx, c + 8, c - 2, 4, 10, '#0a1e40');
            px(ctx, c - 6, c - 12, 12, 10, '#e8b890');
            px(ctx, c - 8, c - 14, 16, 3, '#111');
            px(ctx, c - 5, c - 22, 10, 9, '#0a0a0a');
            px(ctx, c + 1, c - 10, 4, 4, '#ffd700');
            px(ctx, c - 1, c - 1, 2, 10, '#ffd700');
            px(ctx, c - 9, c - 4, 18, 1, '#ffffff');
        }, 40);

        // Bagger — purple goon + chunky $ sack
        T.bagger = this.makeTex((ctx, s) => {
            const c = s / 2;
            px(ctx, c - 12, c - 2, 14, 18, '#5a2a8a');
            px(ctx, c - 10, c, 10, 14, '#7a3aaa');
            px(ctx, c - 8, c - 10, 10, 9, '#d4a080');
            px(ctx, c + 0, c - 8, 16, 6, '#e8c020');
            px(ctx, c + 2, c - 2, 16, 16, '#ffd700');
            px(ctx, c + 4, c + 2, 12, 10, '#ffe566');
            px(ctx, c + 6, c + 4, 8, 2, '#5a2a00');
            px(ctx, c + 8, c + 6, 4, 6, '#5a2a00');
            px(ctx, c - 12, c - 2, 14, 1, '#ffe566');
        }, 44);

        // Bruiser — wide red tank with plate armor + spikes
        T.bruiser = this.makeTex((ctx, s) => {
            const c = s / 2;
            px(ctx, c - 16, c - 12, 32, 28, '#6a1010');
            px(ctx, c - 14, c - 10, 28, 8, '#c03030');
            px(ctx, c - 14, c + 2, 28, 8, '#a02020');
            px(ctx, c - 14, c - 4, 28, 4, '#ff6666');
            // spikes (block triangles)
            px(ctx, c - 18, c - 4, 4, 8, '#ff8888');
            px(ctx, c + 14, c - 4, 4, 8, '#ff8888');
            px(ctx, c - 4, c - 18, 8, 6, '#ff8888');
            px(ctx, c - 8, c - 6, 16, 5, '#ffcc00');
            px(ctx, c - 6, c - 5, 4, 3, '#111');
            px(ctx, c + 2, c - 5, 4, 3, '#111');
            px(ctx, c - 16, c - 12, 32, 1, '#ffaaaa');
        }, 48);

        // Drone — X-rotor machine
        T.drone = this.makeTex((ctx, s) => {
            const c = s / 2;
            px(ctx, c - 14, c - 14, 6, 2, '#66ff99');
            px(ctx, c + 8, c - 14, 6, 2, '#66ff99');
            px(ctx, c - 14, c + 12, 6, 2, '#66ff99');
            px(ctx, c + 8, c + 12, 6, 2, '#66ff99');
            px(ctx, c - 12, c - 12, 4, 4, '#228855');
            px(ctx, c + 8, c - 12, 4, 4, '#228855');
            px(ctx, c - 12, c + 8, 4, 4, '#228855');
            px(ctx, c + 8, c + 8, 4, 4, '#228855');
            px(ctx, c - 8, c - 8, 16, 16, '#1a6a45');
            px(ctx, c - 6, c - 6, 12, 12, '#2a8a5a');
            px(ctx, c - 3, c - 3, 6, 6, '#88ffaa');
            px(ctx, c - 1, c - 1, 2, 2, '#003322');
        }, 40);

        T.bolt = this.makeTex((ctx, s) => {
            px(ctx, 2, 4, 10, 6, '#ff9900');
            px(ctx, 4, 2, 6, 10, '#ff9900');
            px(ctx, 5, 5, 4, 4, '#fff0c0');
            px(ctx, 6, 6, 2, 2, '#ffffff');
        }, 14);

        T.spike = this.makeTex((ctx, s) => {
            px(ctx, 2, 6, 14, 6, '#66ddff');
            px(ctx, 12, 4, 6, 10, '#88eeff');
            px(ctx, 14, 7, 4, 4, '#ffffff');
        }, 18);

        T.nail = this.makeTex((ctx, s) => {
            px(ctx, 1, 5, 10, 4, '#ffcc44');
            px(ctx, 9, 3, 5, 8, '#ffe088');
            px(ctx, 11, 5, 3, 4, '#ffffff');
        }, 14);

        T.saw = this.makeTex((ctx, s) => {
            px(ctx, 6, 6, 16, 16, '#aaaaaa');
            px(ctx, 10, 10, 8, 8, '#dddddd');
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                px(ctx, s / 2 + Math.cos(a) * 11 - 2, s / 2 + Math.sin(a) * 11 - 2, 4, 4, '#ff8844');
            }
            px(ctx, 12, 12, 4, 4, '#333');
        }, 28);

        T.bagShot = this.makeTex((ctx, s) => {
            px(ctx, 1, 1, s - 2, s - 2, '#ffd700');
            px(ctx, 3, 3, s - 6, s - 6, '#ffe566');
            px(ctx, 6, 4, 4, 8, '#5a2a00');
            px(ctx, 4, 6, 8, 4, '#5a2a00');
        }, 16);

        T.hp = this.makeTex((ctx, s) => {
            px(ctx, 4, 2, 12, 16, '#ff2255');
            px(ctx, 2, 4, 16, 12, '#ff2255');
            px(ctx, 6, 4, 8, 12, '#ff5577');
            px(ctx, 9, 5, 2, 10, '#ffffff');
            px(ctx, 5, 9, 10, 2, '#ffffff');
        }, 20);

        T.xpGem = this.makeTex((ctx, s) => {
            px(ctx, 7, 1, 4, 16, '#22ff77');
            px(ctx, 1, 7, 16, 4, '#22ff77');
            px(ctx, 4, 4, 10, 10, '#44ff99');
            px(ctx, 6, 6, 4, 4, '#ccffdd');
        }, 18);

        T.wrench = this.makeTex((ctx, s) => {
            px(ctx, 9, 2, 4, 18, '#c8ccd8');
            px(ctx, 2, 9, 18, 4, '#c8ccd8');
            px(ctx, 8, 1, 6, 6, '#ffaa33');
            px(ctx, 10, 3, 2, 2, '#ffe088');
        }, 22);

        T.spark = this.makeTex((ctx, s) => {
            px(ctx, 2, 2, 4, 4, '#ffcc66');
            px(ctx, 3, 3, 2, 2, '#ffffff');
        }, 8);

        T.debris = this.makeTex((ctx, s) => {
            px(ctx, 1, 2, 7, 5, '#ffffff');
            px(ctx, 0, 1, 3, 3, '#ffaa44');
        }, 10);

        T.ring = this.makeTex((ctx, s) => {
            px(ctx, 2, 2, s - 4, 3, '#ffffff');
            px(ctx, 2, s - 5, s - 4, 3, '#ffffff');
            px(ctx, 2, 2, 3, s - 4, '#ffffff');
            px(ctx, s - 5, 2, 3, s - 4, '#ffffff');
        }, 32);

        const makeBlock = (body, band, highlight, rivet) => this.makeTex((ctx, s) => {
            px(ctx, 0, 0, s, s, body);
            px(ctx, 2, 2, s - 4, s - 4, highlight);
            px(ctx, 0, 0, s, 6, band);
            px(ctx, 0, s - 6, s, 6, band);
            px(ctx, 0, 0, 2, s, '#111');
            px(ctx, s - 2, 0, 2, s, '#111');
            [[5, 5], [s - 9, 5], [5, s - 9], [s - 9, s - 9]].forEach(([x, y]) => {
                px(ctx, x, y, 4, 4, rivet);
                px(ctx, x + 1, y + 1, 2, 2, '#ffe8c0');
            });
            // dither shade
            for (let y = 8; y < s - 8; y += 4) {
                for (let x = 8; x < s - 8; x += 4) {
                    if ((x + y) % 8 === 0) px(ctx, x, y, 2, 2, '#2a2010');
                }
            }
        }, 64);

        T.pillar = makeBlock('#5a4a30', '#ffcc33', '#7a6a48', '#d4a574');
        T.crate = makeBlock('#7a4a20', '#c9a227', '#9a6230', '#e8c080');
        T.pipe = this.makeTex((ctx, s) => {
            px(ctx, 0, 0, s, s, '#3a4a5a');
            px(ctx, 3, 3, s - 6, s - 6, '#6a7a8a');
            px(ctx, 5, 5, s - 10, s - 10, '#8a9aaa');
            for (let i = 10; i < s - 8; i += 12) {
                px(ctx, i, 4, 2, s - 8, '#2a3a4a');
            }
            [[6, 6], [s - 10, 6], [6, s - 10], [s - 10, s - 10]].forEach(([x, y]) => {
                px(ctx, x, y, 4, 4, '#b0c0d0');
            });
        }, 64);

        this.textures = T;
    }

    ensureScene() {
        if (this.scene || this.isPreview || !this.graphics?.isInitialized) return;
        this.buildTextures();

        const bg = this.graphics.getLayer('background');
        const fg = this.graphics.getLayer('foreground');
        const ui = this.graphics.getLayer('ui');
        bg.removeChildren();
        fg.removeChildren();
        ui.removeChildren();

        const arena = new PIXI.Container();
        this.drawStaticArena(arena);
        bg.addChild(arena);

        const entities = new PIXI.Container();
        fg.addChild(entities);

        const fx = new PIXI.Graphics();
        entities.addChild(fx);

        const playerSprite = new PIXI.Sprite(this.textures.player);
        playerSprite.anchor.set(0.5);
        entities.addChild(playerSprite);

        const pools = {
            enemies: [],
            projectiles: [],
            enemyBullets: [],
            pickups: [],
            orbs: [],
            particles: [],
            zones: []
        };

        const hud = new PIXI.Container();
        ui.addChild(hud);
        const xpBg = new PIXI.Graphics();
        xpBg.beginFill(0x111820, 0.9);
        xpBg.drawRect(20, 8, this.width - 40, 10);
        xpBg.endFill();
        hud.addChild(xpBg);
        const xpFill = new PIXI.Graphics();
        hud.addChild(xpFill);
        const infoText = new PIXI.Text('', new PIXI.TextStyle({
            fontFamily: 'Courier New', fontSize: 13, fill: 0xffffff
        }));
        infoText.x = 20;
        infoText.y = 22;
        hud.addChild(infoText);
        const wpnText = new PIXI.Text('', new PIXI.TextStyle({
            fontFamily: 'Courier New', fontSize: 11, fill: 0xaaccff
        }));
        wpnText.x = 20;
        wpnText.y = this.height - 22;
        hud.addChild(wpnText);

        const bannerText = new PIXI.Text('', new PIXI.TextStyle({
            fontFamily: 'Courier New', fontSize: 22, fill: 0xffe066, fontWeight: 'bold',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2
        }));
        bannerText.anchor.set(0.5);
        bannerText.x = this.width / 2;
        bannerText.y = 70;
        bannerText.visible = false;
        hud.addChild(bannerText);

        const overlay = new PIXI.Container();
        overlay.visible = false;
        ui.addChild(overlay);

        this.scene = {
            arena, entities, fx, playerSprite, pools,
            hud, xpFill, infoText, wpnText, bannerText, overlay,
            lastHudKey: ''
        };
    }

    drawStaticArena(container) {
        const layout = RR_ARENAS[this.arenaIndex] || RR_ARENAS[0];
        const g = new PIXI.Graphics();
        g.beginFill(layout.floorB);
        g.drawRect(0, 0, this.width, this.height);
        g.endFill();

        // Chunkier 16px tiles + dither (Genesis / SNES factory floor)
        const tile = 16;
        for (let y = 0; y < this.height; y += tile) {
            for (let x = 0; x < this.width; x += tile) {
                const tx = x / tile;
                const ty = y / tile;
                const odd = (tx + ty) % 2 === 0;
                g.beginFill(odd ? layout.floorA : layout.floorB);
                g.drawRect(x, y, tile, tile);
                g.endFill();
                if ((tx + ty * 3) % 5 === 0) {
                    g.beginFill(layout.accent, 0.35);
                    g.drawRect(x + 2, y + 2, 4, 4);
                    g.endFill();
                }
                if ((tx * 2 + ty) % 7 === 0) {
                    g.beginFill(0x000000, 0.18);
                    g.drawRect(x + 8, y + 8, 6, 2);
                    g.endFill();
                }
            }
        }

        // Hazard stripe borders
        for (let x = 0; x < this.width; x += 16) {
            g.beginFill((x / 16) % 2 === 0 ? layout.edge : 0x101018);
            g.drawRect(x, 0, 16, 8);
            g.drawRect(x, this.height - 8, 16, 8);
            g.endFill();
        }
        for (let y = 8; y < this.height - 8; y += 16) {
            g.beginFill((y / 16) % 2 === 0 ? layout.edge : 0x101018);
            g.drawRect(0, y, 8, 16);
            g.drawRect(this.width - 8, y, 8, 16);
            g.endFill();
        }

        // Layout-specific paint marks
        g.lineStyle(3, layout.edge, 0.35);
        if (layout.id === 'lanes' || layout.id === 'corridor') {
            for (let x = 160; x < this.width; x += 160) {
                for (let y = 24; y < this.height - 24; y += 20) {
                    g.beginFill(layout.edge, 0.4);
                    g.drawRect(x - 2, y, 4, 10);
                    g.endFill();
                }
            }
        } else if (layout.id === 'cross') {
            g.beginFill(layout.edge, 0.2);
            g.drawRect(this.width / 2 - 6, 20, 12, this.height - 40);
            g.drawRect(20, this.height / 2 - 6, this.width - 40, 12);
            g.endFill();
        } else if (layout.id === 'ring') {
            g.lineStyle(4, layout.edge, 0.3);
            g.drawCircle(this.width / 2, this.height / 2, 150);
            g.drawCircle(this.width / 2, this.height / 2, 210);
        } else if (layout.id === 'foundry') {
            g.beginFill(0xff4422, 0.08);
            g.drawRect(200, 200, this.width - 400, this.height - 400);
            g.endFill();
        }
        container.addChild(g);

        for (const o of this.obstacles) {
            const kind = o.kind || 'pillar';
            const tex = this.textures[kind] || this.textures.pillar;
            const sh = new PIXI.Graphics();
            sh.beginFill(0x000000, 0.4);
            sh.drawEllipse(o.x + o.w / 2 + 5, o.y + o.h + 5, o.w * 0.48, 9);
            sh.endFill();
            container.addChild(sh);
            const s = new PIXI.Sprite(tex);
            s.x = o.x;
            s.y = o.y;
            s.width = o.w;
            s.height = o.h;
            container.addChild(s);
        }
    }

    borrow(poolName, texture) {
        const pool = this.scene.pools[poolName];
        let spr = pool.find((s) => !s.visible);
        if (!spr) {
            spr = new PIXI.Sprite(texture);
            spr.anchor.set(0.5);
            this.scene.entities.addChild(spr);
            pool.push(spr);
        } else {
            spr.texture = texture;
        }
        spr.visible = true;
        spr.alpha = 1;
        spr.rotation = 0;
        spr.tint = 0xffffff;
        return spr;
    }

    hidePool(poolName) {
        if (!this.scene) return;
        for (const s of this.scene.pools[poolName]) s.visible = false;
    }

    // ── Lifecycle ───────────────────────────────────────────────────

    async initGraphics() {
        try {
            await this.graphics.init();
            if (!this.graphics?.isInitialized) {
                this.gameLoop();
                if (typeof this.onReady === 'function') this.onReady();
                return;
            }
            this.nesEffects = this.graphics.getScreenEffects();
            this.screenEffects = this.nesEffects;
            this.ensureScene();
            this.startGameLoop();
            if (typeof this.graphics.start === 'function') this.graphics.start();
            this.syncScene();
            if (typeof this.onReady === 'function') this.onReady();
        } catch (err) {
            console.error('Rivet Rage graphics init error:', err);
            this.gameLoop();
            if (typeof this.onReady === 'function') this.onReady();
        }
    }

    startGameLoop() {
        const ticker = this.graphics.getTicker();
        if (ticker) {
            this.tickerCallback = (tickerObj) => {
                const deltaMs = Math.min(Math.max((tickerObj.deltaTime ?? 1) * 16.67, 1), 50);
                this.gameLoop(deltaMs);
            };
            ticker.add(this.tickerCallback);
        } else {
            this.gameLoop();
        }
    }

    setupInput() {
        this.keydownHandler = (e) => {
            const nameEntryModal = document.getElementById('name-entry-modal');
            if (nameEntryModal && nameEntryModal.classList.contains('active')) return;
            const activeCanvas = document.getElementById('game-canvas');
            if (activeCanvas !== this.canvas) return;

            this.keys[e.code] = true;

            if (e.code === 'Space') {
                e.preventDefault();
                if (this.gameState === 'menu' || this.gameState === 'gameOver') {
                    this.gameState = 'pickrun';
                    this.overlayState = null;
                } else if (this.gameState === 'pickrun') {
                    this.startGame(RR_RUNS[this.selectedRun]?.id || 'riveter');
                } else if (this.gameState === 'playing') this.gameState = 'paused';
                else if (this.gameState === 'paused') this.gameState = 'playing';
            }
            if (e.code === 'KeyP' && (this.gameState === 'playing' || this.gameState === 'paused')) {
                this.gameState = this.gameState === 'playing' ? 'paused' : 'playing';
            }
            if (e.code === 'KeyR') {
                this.gameState = 'pickrun';
                this.overlayState = null;
            }
            if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') &&
                this.gameState === 'playing') {
                this.tryDash();
            }

            if (this.gameState === 'levelup') {
                if (e.code === 'Digit1' || e.code === 'Numpad1') this.pickCard(0);
                if (e.code === 'Digit2' || e.code === 'Numpad2') this.pickCard(1);
                if (e.code === 'Digit3' || e.code === 'Numpad3') this.pickCard(2);
            }
            if (this.gameState === 'pickrun') {
                if (e.code === 'Digit1' || e.code === 'Numpad1') this.selectedRun = 0;
                if (e.code === 'Digit2' || e.code === 'Numpad2') this.selectedRun = 1;
                if (e.code === 'Digit3' || e.code === 'Numpad3') this.selectedRun = 2;
                if (e.code === 'Digit4' || e.code === 'Numpad4') this.selectedRun = 3;
                if (e.code === 'Digit5' || e.code === 'Numpad5') this.selectedRun = 4;
                if (e.code === 'Digit6' || e.code === 'Numpad6') this.selectedRun = 5;
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                    this.selectedRun = (this.selectedRun + RR_RUNS.length - 1) % RR_RUNS.length;
                }
                if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                    this.selectedRun = (this.selectedRun + 1) % RR_RUNS.length;
                }
                if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                    this.selectedRun = (this.selectedRun + RR_RUNS.length - 3) % RR_RUNS.length;
                }
                if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                    this.selectedRun = (this.selectedRun + 3) % RR_RUNS.length;
                }
                this.selectedRun = Math.max(0, Math.min(RR_RUNS.length - 1, this.selectedRun));
                this.overlayState = null;
            }
        };
        this.keyupHandler = (e) => {
            const activeCanvas = document.getElementById('game-canvas');
            if (activeCanvas !== this.canvas) return;
            this.keys[e.code] = false;
        };
        this.clickHandler = (e) => {
            if (this.isPreview) return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.width / rect.width;
            const scaleY = this.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            if (this.gameState === 'levelup') {
                const cards = this.getCardRects();
                for (let i = 0; i < cards.length; i++) {
                    const r = cards[i];
                    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                        this.pickCard(i);
                        break;
                    }
                }
            } else if (this.gameState === 'pickrun') {
                const cards = this.getRunRects();
                for (let i = 0; i < cards.length; i++) {
                    const r = cards[i];
                    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                        this.selectedRun = i;
                        this.startGame(RR_RUNS[i].id);
                        break;
                    }
                }
            }
        };
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        this.canvas.addEventListener('click', this.clickHandler);
    }

    getCardRects() {
        const w = 200;
        const h = 168;
        const gap = 24;
        const total = 3 * w + 2 * gap;
        const startX = (this.width - total) / 2;
        const y = this.height / 2 - h / 2 + 10;
        return [0, 1, 2].map((i) => ({ x: startX + i * (w + gap), y, w, h }));
    }

    getRunRects() {
        const cols = 3;
        const w = 200;
        const h = 110;
        const gapX = 16;
        const gapY = 14;
        const totalW = cols * w + (cols - 1) * gapX;
        const startX = (this.width - totalW) / 2;
        const startY = this.height / 2 - 100;
        return RR_RUNS.map((_, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            return {
                x: startX + col * (w + gapX),
                y: startY + row * (h + gapY),
                w, h
            };
        });
    }

    startGame(runId = 'riveter') {
        this.resetRunState();
        const run = RR_RUNS.find((r) => r.id === runId) || RR_RUNS[0];
        this.player.runId = run.id;
        this.weapons = run.weapons.map((id) => ({ id, level: 1, cooldown: 0 }));
        run.apply(this.player, this);
        this.rebuildOrbs();
        this.gameState = 'playing';
        this.spawnWaveBurst(2);
        this.spawnTimer = 1600;
        this.hudDirty = true;
        this.overlayState = null;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('rivet-rage', 'start');
    }

    // ── Progression ─────────────────────────────────────────────────

    xpNeeded(level) {
        return Math.floor(RIVET_RAGE.xpBase * Math.pow(RIVET_RAGE.xpGrowth, level - 1));
    }

    addXp(amount) {
        this.xp += Math.ceil(amount * this.player.xpMult);
        this.tryLevelUp();
        this.hudDirty = true;
    }

    tryLevelUp() {
        if (this.gameState === 'levelup') return;
        if (this.xp < this.xpToNext) return;
        this.xp -= this.xpToNext;
        this.level++;
        this.xpToNext = this.xpNeeded(this.level);
        this.openLevelUp();
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('rivet-rage', 'levelup');
    }

    openLevelUp() {
        this.levelUpCards = this.rollCards(3);
        this.gameState = 'levelup';
        this.overlayState = null;
    }

    rollCards(n) {
        const pool = [];
        const weaponFull = this.weapons.length >= RIVET_RAGE.maxWeapons;

        for (const def of Object.values(RR_WEAPONS)) {
            const owned = this.weapons.find((w) => w.id === def.id);
            if (owned) {
                if (owned.level < def.maxLevel) {
                    pool.push({ type: 'weapon', weaponId: def.id, upgrade: true, weight: 3 });
                }
            } else if (!weaponFull) {
                pool.push({ type: 'weapon', weaponId: def.id, upgrade: false, weight: 2 });
            }
        }
        for (const s of Object.values(RR_STATS)) {
            const spicy = ['pulseShield', 'dash', 'thorns', 'chainKill', 'berserk', 'magnetPulse', 'ricochet', 'overclock'];
            pool.push({ type: 'stat', statId: s.id, weight: spicy.includes(s.id) ? 2.6 : 1.8 });
        }

        const picks = [];
        const used = new Set();
        let guard = 0;
        while (picks.length < n && guard++ < 60) {
            const totalW = pool.reduce((a, c) => a + c.weight, 0);
            let r = Math.random() * totalW;
            let card = pool[0];
            for (const c of pool) {
                r -= c.weight;
                if (r <= 0) { card = c; break; }
            }
            const key = card.type === 'weapon' ? `w:${card.weaponId}` : `s:${card.statId}`;
            if (used.has(key)) continue;
            used.add(key);
            picks.push(card);
        }
        while (picks.length < n) picks.push({ type: 'stat', statId: 'damage' });
        return picks;
    }

    pickCard(index) {
        const card = this.levelUpCards[index];
        if (!card) return;
        if (card.type === 'weapon') {
            const owned = this.weapons.find((w) => w.id === card.weaponId);
            if (owned) owned.level++;
            else this.weapons.push({ id: card.weaponId, level: 1, cooldown: 0 });
            this.rebuildOrbs();
        } else {
            this.applyStat(card.statId);
        }
        this.levelUpCards = [];
        this.gameState = 'playing';
        this.overlayState = null;
        this.hudDirty = true;
        this.tryLevelUp();
    }

    applyStat(statId) {
        const p = this.player;
        if (statId === 'moveSpeed') p.speed *= 1.12;
        if (statId === 'maxHp') {
            p.maxHp += 1;
            p.hp = Math.min(p.maxHp, p.hp + 1);
        }
        if (statId === 'pickupRadius') p.pickupRadius *= 1.3;
        if (statId === 'armor') p.armor += 1;
        if (statId === 'damage') p.damageMult *= 1.15;
        if (statId === 'fireRate') p.cooldownMult *= 0.88;
        if (statId === 'range') p.rangeMult *= 1.15;
        if (statId === 'xpGain') p.xpMult *= 1.2;
        if (statId === 'crit') p.critChance = Math.min(0.45, p.critChance + 0.08);
        if (statId === 'repair') p.repairChance = Math.min(0.35, p.repairChance + 0.08);
        if (statId === 'projectileSpeed') p.projSpeedMult *= 1.15;
        const powers = ['pulseShield', 'dash', 'thorns', 'chainKill', 'berserk', 'magnetPulse', 'ricochet', 'overclock'];
        if (powers.includes(statId)) {
            p.powers[statId] = (p.powers[statId] || 0) + 1;
        }
    }

    tryDash() {
        const p = this.player;
        if (!p.powers.dash || p.dashCd > 0 || p.dashMs > 0) return;
        let mx = 0;
        let my = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) mx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) mx += 1;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) my -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) my += 1;
        if (!mx && !my) {
            mx = Math.cos(p.facing);
            my = Math.sin(p.facing);
        } else {
            const len = Math.hypot(mx, my) || 1;
            mx /= len;
            my /= len;
        }
        p.dashDirX = mx;
        p.dashDirY = my;
        p.dashMs = 140 + p.powers.dash * 20;
        p.dashCd = Math.max(900, 2200 - p.powers.dash * 250);
        p.invincibleMs = Math.max(p.invincibleMs, p.dashMs + 80);
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: p.x, y: p.y,
                vx: -mx * 2 + (Math.random() - 0.5),
                vy: -my * 2 + (Math.random() - 0.5),
                life: 200, maxLife: 200, kind: 'spark', color: 0x88ff66, scale: 1.2
            });
        }
    }

    updatePowers(deltaTime) {
        const p = this.player;
        p.dashCd = Math.max(0, p.dashCd - deltaTime);
        p.anim += deltaTime;

        // Pulse shield: off-cycle then on-cycle
        if (p.powers.pulseShield > 0) {
            const onMs = 900 + p.powers.pulseShield * 250;
            const offMs = Math.max(1800, 4200 - p.powers.pulseShield * 400);
            p.shieldCycle += deltaTime;
            if (p.shieldActive) {
                if (p.shieldCycle >= onMs) {
                    p.shieldActive = false;
                    p.shieldCycle = 0;
                    this.hudDirty = true;
                }
            } else if (p.shieldCycle >= offMs) {
                p.shieldActive = true;
                p.shieldCycle = 0;
                this.hudDirty = true;
                for (let i = 0; i < 10; i++) {
                    const a = (i / 10) * Math.PI * 2;
                    this.particles.push({
                        x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18,
                        vx: Math.cos(a), vy: Math.sin(a),
                        life: 220, maxLife: 220, kind: 'spark', color: 0x66ccff, scale: 1.1
                    });
                }
            }
        } else {
            p.shieldActive = false;
        }

        // Magnet pulse
        if (p.powers.magnetPulse > 0) {
            p.magnetTimer += deltaTime;
            const period = Math.max(2800, 5200 - p.powers.magnetPulse * 500);
            if (p.magnetTimer >= period) {
                p.magnetTimer = 0;
                const pull = 40 + p.powers.magnetPulse * 18;
                for (const pk of this.pickups) {
                    const dx = p.x - pk.x;
                    const dy = p.y - pk.y;
                    const d = Math.hypot(dx, dy) || 1;
                    pk.x += (dx / d) * Math.min(pull, d);
                    pk.y += (dy / d) * Math.min(pull, d);
                }
                for (const e of this.enemies) {
                    const dx = p.x - e.x;
                    const dy = p.y - e.y;
                    const d = Math.hypot(dx, dy) || 1;
                    if (d < 220) {
                        e.x += (dx / d) * 10;
                        e.y += (dy / d) * 10;
                        e.slowMs = Math.max(e.slowMs || 0, 500);
                    }
                }
                this.particles.push({
                    x: p.x, y: p.y, vx: 0, vy: 0,
                    life: 260, maxLife: 260, kind: 'ring', color: 0xaaff66, scale: 0.5
                });
            }
        }

        // Overclock surge
        if (p.powers.overclock > 0) {
            if (p.overclockActive > 0) {
                p.overclockActive -= deltaTime;
            } else {
                p.overclockTimer += deltaTime;
                const period = Math.max(5000, 9000 - p.powers.overclock * 800);
                if (p.overclockTimer >= period) {
                    p.overclockTimer = 0;
                    p.overclockActive = 1800 + p.powers.overclock * 400;
                    this.hudDirty = true;
                }
            }
        }
    }

    rebuildOrbs() {
        const wrench = this.weapons.find((w) => w.id === 'orbitWrenches');
        this.orbs = [];
        if (!wrench) return;
        const def = this.weaponStats(wrench);
        for (let i = 0; i < def.count; i++) {
            this.orbs.push({ angle: (Math.PI * 2 * i) / def.count, hitCd: 0 });
        }
    }

    weaponStats(weapon) {
        const base = { ...RR_WEAPONS[weapon.id].base };
        const lv = weapon.level;
        const p = this.player;
        if (weapon.id === 'rivetGun') {
            base.damage += (lv - 1) * 4;
            base.cooldown = Math.max(180, base.cooldown - (lv - 1) * 40);
            if (lv >= 3) base.count = 2;
            if (lv >= 5) base.count = 3;
        } else if (weapon.id === 'arcWelder') {
            base.damage += (lv - 1) * 2;
            base.range += (lv - 1) * 10;
            base.cooldown = Math.max(90, base.cooldown - (lv - 1) * 15);
        } else if (weapon.id === 'nailburst') {
            base.damage += (lv - 1) * 3;
            base.count += (lv - 1);
            base.cooldown = Math.max(400, base.cooldown - (lv - 1) * 50);
        } else if (weapon.id === 'pneumaticSpike') {
            base.damage += (lv - 1) * 8;
            base.pierce += lv >= 3 ? 1 : 0;
            base.cooldown = Math.max(700, base.cooldown - (lv - 1) * 60);
        } else if (weapon.id === 'orbitWrenches') {
            base.damage += (lv - 1) * 4;
            base.count = lv;
            base.radius += (lv - 1) * 8;
        } else if (weapon.id === 'forgeHammer') {
            base.damage += (lv - 1) * 6;
            base.range += (lv - 1) * 8;
            base.cooldown = Math.max(900, base.cooldown - (lv - 1) * 100);
        } else if (weapon.id === 'scrapSaw') {
            base.damage += (lv - 1) * 4;
            base.bounces += lv >= 3 ? 1 : 0;
            base.cooldown = Math.max(500, base.cooldown - (lv - 1) * 70);
        } else if (weapon.id === 'greaseBomb') {
            base.damage += (lv - 1) * 2;
            base.radius += (lv - 1) * 6;
            base.duration += (lv - 1) * 300;
            base.cooldown = Math.max(1400, base.cooldown - (lv - 1) * 120);
        } else if (weapon.id === 'railRiveter') {
            base.damage += (lv - 1) * 10;
            base.range += (lv - 1) * 20;
            base.cooldown = Math.max(800, base.cooldown - (lv - 1) * 80);
        }

        let dmgMult = p.damageMult;
        let cdMult = p.cooldownMult;
        if (p.powers.berserk > 0 && p.hp / p.maxHp <= 0.4) {
            dmgMult *= 1.2 + p.powers.berserk * 0.1;
            cdMult *= 0.85;
        }
        if (p.overclockActive > 0) cdMult *= 0.55;
        base.damage = Math.round(base.damage * dmgMult);
        base.cooldown = Math.max(60, Math.round(base.cooldown * cdMult));
        if (base.range) base.range *= p.rangeMult;
        if (base.radius && weapon.id === 'orbitWrenches') base.radius *= p.rangeMult;
        if (base.speed) base.speed *= p.projSpeedMult;
        return base;
    }

    rollDamage(base) {
        if (Math.random() < this.player.critChance) return { dmg: base * 2, crit: true };
        return { dmg: base, crit: false };
    }

    // ── Update ──────────────────────────────────────────────────────

    gameLoop(currentTime = 0) {
        if (this.isPreview) {
            this.drawPreview();
            return;
        }
        let deltaTime;
        if (typeof currentTime === 'number' && currentTime > 100) {
            if (!this.lastTime) this.lastTime = currentTime;
            deltaTime = Math.min(currentTime - this.lastTime, 50);
            this.lastTime = currentTime;
            this.update(deltaTime);
            this.syncScene();
            this.rafId = requestAnimationFrame((t) => this.gameLoop(t));
            return;
        }
        deltaTime = currentTime || 16.67;
        this.update(deltaTime);
        this.syncScene();
    }

    update(deltaTime) {
        this.shootSfxCd = Math.max(0, this.shootSfxCd - deltaTime);
        this.hitSfxCd = Math.max(0, this.hitSfxCd - deltaTime);
        this.statsPanelCd -= deltaTime;

        if (this.gameState === 'playing') {
            this.surviveMs += deltaTime;
            this.timeBonusAcc += deltaTime;
            while (this.timeBonusAcc >= 1000) {
                this.timeBonusAcc -= 1000;
                this.score += RIVET_RAGE.timeBonusPerSec;
                this.hudDirty = true;
            }
            this.updatePlayer(deltaTime);
            this.updatePowers(deltaTime);
            this.updateWeapons(deltaTime);
            this.updateProjectiles(deltaTime);
            this.updateEnemyBullets(deltaTime);
            this.updateZones(deltaTime);
            this.updateEnemies(deltaTime);
            this.updateWaves(deltaTime);
            this.updatePickups(deltaTime);
            this.updateParticles(deltaTime);
        }
        if (this.statsPanelCd <= 0) {
            this.statsPanelCd = 200;
            this.updateStatsPanel();
        }
        if (this.nesEffects && typeof this.nesEffects.update === 'function') {
            this.nesEffects.update();
        }
    }

    updatePlayer(deltaTime) {
        const dt = deltaTime / 16.67;
        const p = this.player;
        let speed = p.speed;
        if (p.powers.berserk > 0 && p.hp / p.maxHp <= 0.4) {
            speed *= 1.15 + p.powers.berserk * 0.05;
        }

        if (p.dashMs > 0) {
            p.dashMs -= deltaTime;
            this.moveCircle(p, p.dashDirX * 7.5 * dt, p.dashDirY * 7.5 * dt);
            p.moving = true;
        } else {
            let mx = 0;
            let my = 0;
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) mx -= 1;
            if (this.keys['ArrowRight'] || this.keys['KeyD']) mx += 1;
            if (this.keys['ArrowUp'] || this.keys['KeyW']) my -= 1;
            if (this.keys['ArrowDown'] || this.keys['KeyS']) my += 1;
            p.moving = !!(mx || my);
            if (mx || my) {
                const len = Math.hypot(mx, my) || 1;
                mx /= len;
                my /= len;
                p.facing = Math.atan2(my, mx);
                this.moveCircle(p, mx * speed * dt, my * speed * dt);
            }
        }
        p.invincibleMs = Math.max(0, p.invincibleMs - deltaTime);
    }

    moveCircle(ent, dx, dy) {
        ent.x += dx;
        this.resolveObstacles(ent);
        ent.y += dy;
        this.resolveObstacles(ent);
        const pad = ent.radius + 4;
        ent.x = Math.max(pad, Math.min(this.width - pad, ent.x));
        ent.y = Math.max(pad + 28, Math.min(this.height - pad, ent.y));
    }

    resolveObstacles(ent) {
        for (const o of this.obstacles) {
            const nearestX = Math.max(o.x, Math.min(ent.x, o.x + o.w));
            const nearestY = Math.max(o.y, Math.min(ent.y, o.y + o.h));
            let ox = ent.x - nearestX;
            let oy = ent.y - nearestY;
            const dist = Math.hypot(ox, oy);
            if (dist < ent.radius && dist > 0.001) {
                const push = (ent.radius - dist) / dist;
                ent.x += ox * push;
                ent.y += oy * push;
            } else if (dist === 0) {
                ent.x = o.x - ent.radius - 1;
            }
        }
    }

    segmentHitsObstacle(x0, y0, x1, y1) {
        for (const o of this.obstacles) {
            if (this.lineRect(x0, y0, x1, y1, o.x, o.y, o.w, o.h)) return true;
        }
        return false;
    }

    lineRect(x1, y1, x2, y2, rx, ry, rw, rh) {
        return this.lineLine(x1, y1, x2, y2, rx, ry, rx + rw, ry) ||
            this.lineLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh) ||
            this.lineLine(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh) ||
            this.lineLine(x1, y1, x2, y2, rx, ry, rx, ry + rh) ||
            (x1 > rx && x1 < rx + rw && y1 > ry && y1 < ry + rh);
    }

    lineLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(den) < 1e-8) return false;
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    nearestEnemy(range) {
        let best = null;
        let bestD = range;
        for (const e of this.enemies) {
            const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            if (d < bestD) {
                bestD = d;
                best = e;
            }
        }
        return best;
    }

    updateWeapons(deltaTime) {
        this.welderFlash = null;
        this.railFlash = null;
        this.hammerFlash = Math.max(0, (this.hammerFlash || 0) - deltaTime);

        for (const weapon of this.weapons) {
            const stats = this.weaponStats(weapon);
            if (weapon.id === 'orbitWrenches') {
                this.updateOrbs(deltaTime, stats);
                continue;
            }
            weapon.cooldown = Math.max(0, weapon.cooldown - deltaTime);
            if (weapon.cooldown > 0) continue;

            if (weapon.id === 'arcWelder') {
                const target = this.nearestEnemy(stats.range);
                if (!target) continue;
                weapon.cooldown = stats.cooldown;
                this.fireWelder(target, stats);
            } else if (weapon.id === 'forgeHammer') {
                if (!this.nearestEnemy(stats.range * 1.2)) continue;
                weapon.cooldown = stats.cooldown;
                this.fireHammer(stats);
            } else if (weapon.id === 'greaseBomb') {
                const target = this.nearestEnemy(stats.range);
                if (!target) continue;
                weapon.cooldown = stats.cooldown;
                this.fireGrease(target, stats);
            } else if (weapon.id === 'railRiveter') {
                const target = this.nearestEnemy(stats.range);
                if (!target) continue;
                weapon.cooldown = stats.cooldown;
                this.fireRail(target, stats);
            } else if (weapon.id === 'scrapSaw') {
                const target = this.nearestEnemy(stats.range);
                if (!target) continue;
                weapon.cooldown = stats.cooldown;
                this.fireSaw(target, stats);
            } else {
                const target = this.nearestEnemy(stats.range);
                if (!target) continue;
                weapon.cooldown = stats.cooldown;
                this.fireProjectileWeapon(weapon.id, target, stats);
            }
        }
    }

    fireWelder(target, stats) {
        const ang = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        this.welderFlash = { angle: ang, range: stats.range, arc: stats.arc, life: 80 };
        for (const e of this.enemies) {
            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > stats.range) continue;
            let diff = Math.atan2(dy, dx) - ang;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) <= stats.arc / 2) this.damageEnemy(e, stats.damage);
        }
        this.playShoot();
    }

    fireHammer(stats) {
        this.hammerFlash = 180;
        for (const e of this.enemies) {
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= stats.range + e.radius) {
                this.damageEnemy(e, stats.damage);
                const ang = Math.atan2(e.y - this.player.y, e.x - this.player.x);
                e.x += Math.cos(ang) * 8;
                e.y += Math.sin(ang) * 8;
            }
        }
        this.playShoot();
    }

    fireGrease(target, stats) {
        this.zones.push({
            x: target.x,
            y: target.y,
            radius: stats.radius,
            damage: stats.damage,
            life: stats.duration,
            tick: 0
        });
        this.playShoot();
    }

    fireRail(target, stats) {
        const ang = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        const x2 = this.player.x + Math.cos(ang) * stats.range;
        const y2 = this.player.y + Math.sin(ang) * stats.range;
        this.railFlash = { x1: this.player.x, y1: this.player.y, x2, y2, life: 100 };
        for (const e of this.enemies) {
            if (this.pointNearSegment(e.x, e.y, this.player.x, this.player.y, x2, y2, e.radius + 6)) {
                this.damageEnemy(e, stats.damage);
            }
        }
        this.playShoot();
    }

    pointNearSegment(px, py, x1, y1, x2, y2, thresh) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = x1 + t * dx;
        const cy = y1 + t * dy;
        return Math.hypot(px - cx, py - cy) <= thresh;
    }

    fireSaw(target, stats) {
        const ang = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        if (this.projectiles.length >= RIVET_RAGE.maxProjectiles) return;
        this.projectiles.push({
            x: this.player.x,
            y: this.player.y,
            vx: Math.cos(ang) * stats.speed,
            vy: Math.sin(ang) * stats.speed,
            damage: stats.damage,
            pierce: 99,
            bounces: stats.bounces,
            life: 2200,
            radius: 8,
            kind: 'saw',
            hit: new Set(),
            spin: 0
        });
        this.playShoot();
    }

    fireProjectileWeapon(id, target, stats) {
        const baseAng = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        const count = stats.count || 1;
        const spread = stats.spread || 0;
        for (let i = 0; i < count; i++) {
            if (this.projectiles.length >= RIVET_RAGE.maxProjectiles) break;
            let ang = baseAng;
            if (count > 1) ang = baseAng - spread / 2 + (spread * i) / (count - 1);
            this.projectiles.push({
                x: this.player.x,
                y: this.player.y,
                vx: Math.cos(ang) * stats.speed,
                vy: Math.sin(ang) * stats.speed,
                damage: stats.damage,
                pierce: stats.pierce || 0,
                life: 900,
                radius: id === 'pneumaticSpike' ? 5 : 3,
                kind: id === 'pneumaticSpike' ? 'spike' : id === 'nailburst' ? 'nail' : 'bolt',
                ricochets: this.player.powers.ricochet || 0,
                hit: new Set()
            });
        }
        this.playShoot();
    }

    updateOrbs(deltaTime, stats) {
        if (!this.orbs.length) this.rebuildOrbs();
        const dt = deltaTime / 16.67;
        for (let i = 0; i < this.orbs.length; i++) {
            const orb = this.orbs[i];
            orb.angle += stats.spin * dt * (1 + (stats.count - 1) * 0.1);
            orb.hitCd = Math.max(0, orb.hitCd - deltaTime);
            orb.x = this.player.x + Math.cos(orb.angle) * stats.radius;
            orb.y = this.player.y + Math.sin(orb.angle) * stats.radius;
            if (orb.hitCd > 0) continue;
            for (const e of this.enemies) {
                if (Math.hypot(e.x - orb.x, e.y - orb.y) < e.radius + 10) {
                    this.damageEnemy(e, stats.damage);
                    orb.hitCd = 220;
                }
            }
        }
    }

    playShoot() {
        if (this.shootSfxCd > 0) return;
        this.shootSfxCd = 90;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('rivet-rage', 'shoot');
    }

    updateProjectiles(deltaTime) {
        const dt = deltaTime / 16.67;
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const nx = p.x + p.vx * dt;
            const ny = p.y + p.vy * dt;
            if (p.kind === 'saw') {
                p.spin = (p.spin || 0) + 0.4 * dt;
                // Bounce on walls / obstacles
                let bounced = false;
                if (nx < 12 || nx > this.width - 12) { p.vx *= -1; bounced = true; }
                if (ny < 40 || ny > this.height - 12) { p.vy *= -1; bounced = true; }
                if (this.segmentHitsObstacle(p.x, p.y, nx, ny)) {
                    p.vx *= -1; p.vy *= -1; bounced = true;
                }
                if (bounced) {
                    p.bounces--;
                    p.hit = new Set();
                    if (p.bounces < 0) {
                        this.projectiles.splice(i, 1);
                        continue;
                    }
                }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            } else {
                let bounced = false;
                if (nx < 8 || nx > this.width - 8) { p.vx *= -1; bounced = true; }
                if (ny < 36 || ny > this.height - 8) { p.vy *= -1; bounced = true; }
                if (this.segmentHitsObstacle(p.x, p.y, nx, ny)) {
                    p.vx *= -1;
                    p.vy *= -1;
                    bounced = true;
                }
                if (bounced) {
                    if ((p.ricochets || 0) > 0) {
                        p.ricochets--;
                        p.hit = new Set();
                        p.x += p.vx * dt;
                        p.y += p.vy * dt;
                    } else {
                        this.projectiles.splice(i, 1);
                        continue;
                    }
                } else {
                    p.x = nx;
                    p.y = ny;
                }
            }
            p.life -= deltaTime;
            if (p.life <= 0 || p.x < -30 || p.x > this.width + 30 || p.y < -30 || p.y > this.height + 30) {
                this.projectiles.splice(i, 1);
                continue;
            }
            for (const e of this.enemies) {
                if (p.hit.has(e)) continue;
                if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius) {
                    this.damageEnemy(e, p.damage);
                    p.hit.add(e);
                    if (p.pierce <= 0) {
                        this.projectiles.splice(i, 1);
                        break;
                    }
                    p.pierce--;
                }
            }
        }
    }

    updateEnemyBullets(deltaTime) {
        const dt = deltaTime / 16.67;
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            const nx = b.x + b.vx * dt;
            const ny = b.y + b.vy * dt;
            if (this.segmentHitsObstacle(b.x, b.y, nx, ny)) {
                this.enemyBullets.splice(i, 1);
                continue;
            }
            b.x = nx;
            b.y = ny;
            b.life -= deltaTime;
            if (b.life <= 0) {
                this.enemyBullets.splice(i, 1);
                continue;
            }
            if (this.player.invincibleMs <= 0 &&
                Math.hypot(b.x - this.player.x, b.y - this.player.y) < this.player.radius + b.radius) {
                this.hurtPlayer(1);
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    updateZones(deltaTime) {
        for (let i = this.zones.length - 1; i >= 0; i--) {
            const z = this.zones[i];
            z.life -= deltaTime;
            z.tick -= deltaTime;
            if (z.life <= 0) {
                this.zones.splice(i, 1);
                continue;
            }
            if (z.tick <= 0) {
                z.tick = 280;
                for (const e of this.enemies) {
                    if (Math.hypot(e.x - z.x, e.y - z.y) < z.radius + e.radius) {
                        this.damageEnemy(e, z.damage);
                        e.slowMs = 400;
                    }
                }
            }
        }
    }

    updateEnemies(deltaTime) {
        const dt = deltaTime / 16.67;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.hp <= 0) {
                this.onEnemyKilled(e);
                this.enemies.splice(i, 1);
                continue;
            }
            e.flash = Math.max(0, (e.flash || 0) - deltaTime);
            e.slowMs = Math.max(0, (e.slowMs || 0) - deltaTime);
            const spd = e.speed * (e.slowMs > 0 ? 0.45 : 1);

            const dx = this.player.x - e.x;
            const dy = this.player.y - e.y;
            const dist = Math.hypot(dx, dy) || 1;

            if (e.type === 'bagger') {
                e.shootCd = (e.shootCd || 0) - deltaTime;
                if (dist > 160) {
                    this.moveCircle(e, (dx / dist) * spd * dt, (dy / dist) * spd * dt);
                } else if (e.shootCd <= 0) {
                    e.shootCd = e.shootInterval;
                    const ang = Math.atan2(dy, dx);
                    this.enemyBullets.push({
                        x: e.x, y: e.y,
                        vx: Math.cos(ang) * 3.2, vy: Math.sin(ang) * 3.2,
                        radius: 5, life: 2500
                    });
                }
            } else {
                this.moveCircle(e, (dx / dist) * spd * dt, (dy / dist) * spd * dt);
            }

            e.thornHitCd = Math.max(0, (e.thornHitCd || 0) - deltaTime);
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < e.radius + this.player.radius - 2) {
                if (this.player.powers.thorns > 0 && e.thornHitCd <= 0) {
                    this.damageEnemy(e, 6 + this.player.powers.thorns * 4);
                    e.thornHitCd = 280;
                }
                if (this.player.invincibleMs <= 0) {
                    this.hurtPlayer(e.type === 'bruiser' ? 2 : 1, e);
                }
            }
        }
    }

    damageEnemy(e, amount) {
        const roll = this.rollDamage(amount);
        e.hp -= roll.dmg;
        e.flash = 80;
        this.spawnHitParticle(e.x, e.y, roll.crit);
        if (this.hitSfxCd <= 0 && typeof audioManager !== 'undefined') {
            this.hitSfxCd = 50;
            audioManager.playGameSfx('rivet-rage', 'hit');
        }
    }

    onEnemyKilled(e) {
        this.kills++;
        this.score += e.score;
        this.addXp(e.xp);
        this.hudDirty = true;
        this.spawnDeathBurst(e);
        if (this.player.powers.chainKill > 0 && !e._chained) {
            const radius = 70 + this.player.powers.chainKill * 18;
            const dmg = 10 + this.player.powers.chainKill * 6;
            for (const other of this.enemies) {
                if (other === e || other.hp <= 0) continue;
                if (Math.hypot(other.x - e.x, other.y - e.y) <= radius) {
                    other._chained = true;
                    this.damageEnemy(other, dmg);
                    this.particles.push({
                        x: e.x, y: e.y, vx: (other.x - e.x) * 0.08, vy: (other.y - e.y) * 0.08,
                        life: 180, maxLife: 180, kind: 'spark', color: 0x88eeff, scale: 1.3
                    });
                }
            }
        }
        if (Math.random() < this.player.repairChance) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
            this.hudDirty = true;
        }
        if (Math.random() < 0.1) {
            this.pickups.push({ x: e.x, y: e.y, type: 'hp', life: 12000, radius: 8 });
        } else if (Math.random() < 0.07) {
            this.pickups.push({ x: e.x, y: e.y, type: 'xp', value: 8, life: 10000, radius: 7 });
        }
    }

    spawnDeathBurst(e) {
        const color = (RR_ENEMIES[e.type] && RR_ENEMIES[e.type].deathColor) || 0xffaa33;
        const count = e.type === 'bruiser' ? 18 : e.type === 'drone' ? 10 : 14;
        // Expanding ring
        this.particles.push({
            x: e.x, y: e.y, vx: 0, vy: 0,
            life: 280, maxLife: 280, kind: 'ring', color, scale: 0.4
        });
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= RIVET_RAGE.maxParticles) this.particles.shift();
            const ang = (i / count) * Math.PI * 2 + Math.random() * 0.3;
            const spd = 2.2 + Math.random() * 3.5;
            this.particles.push({
                x: e.x, y: e.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                life: 320 + Math.random() * 200,
                maxLife: 400,
                kind: i % 3 === 0 ? 'debris' : 'spark',
                color,
                scale: 0.8 + Math.random() * 0.8
            });
        }
        // Center flash sparks
        for (let i = 0; i < 5; i++) {
            if (this.particles.length >= RIVET_RAGE.maxParticles) this.particles.shift();
            this.particles.push({
                x: e.x + (Math.random() - 0.5) * 8,
                y: e.y + (Math.random() - 0.5) * 8,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                life: 180,
                maxLife: 180,
                kind: 'spark',
                color: 0xffffff,
                scale: 1.4
            });
        }
    }

    hurtPlayer(raw, source) {
        if (this.player.invincibleMs > 0) return;
        if (this.player.powers.pulseShield > 0 && this.player.shieldActive) {
            this.player.invincibleMs = 220;
            this.player.shieldActive = false;
            this.player.shieldCycle = 0;
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                this.particles.push({
                    x: this.player.x + Math.cos(a) * 20,
                    y: this.player.y + Math.sin(a) * 20,
                    vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5,
                    life: 240, maxLife: 240, kind: 'spark', color: 0x66ddff, scale: 1.4
                });
            }
            if (source && this.player.powers.thorns > 0) {
                this.damageEnemy(source, 8 + this.player.powers.thorns * 5);
            }
            return;
        }
        const dmg = Math.max(1, raw - this.player.armor);
        this.player.hp -= dmg;
        this.player.invincibleMs = RIVET_RAGE.iFrameMs;
        this.hudDirty = true;
        if (this.screenEffects && typeof this.screenEffects.shake === 'function') {
            this.screenEffects.shake(6, 10);
        }
        if (this.player.hp <= 0) this.gameOver();
    }

    gameOver() {
        this.gameState = 'gameOver';
        this.overlayState = null;
        if (typeof audioManager !== 'undefined') audioManager.playGameSfx('rivet-rage', 'death');
        if (typeof highScoreManager !== 'undefined' && highScoreManager.checkHighScore('rivet-rage', this.score)) {
            highScoreManager.requestNameEntry('rivet-rage', this.score);
        }
    }

    updateWaves(deltaTime) {
        if (this.arenaBannerMs > 0) this.arenaBannerMs -= deltaTime;

        // Warned sector shift — finish the swap after a short grace window
        if (this.pendingArena != null) {
            this.pendingArenaMs -= deltaTime;
            if (this.player) {
                this.player.invincibleMs = Math.max(this.player.invincibleMs, 200);
            }
            if (this.pendingArenaMs <= 0) {
                const idx = this.pendingArena;
                this.pendingArena = null;
                this.applyArenaLayout(idx, true);
            }
        }

        this.waveTimer += deltaTime;
        if (this.waveTimer >= RIVET_RAGE.waveDurationMs) {
            this.waveTimer = 0;
            this.wave++;
            this.hudDirty = true;
            const nextArena = this.arenaIndexForWave(this.wave);
            if (nextArena !== this.arenaIndex && this.pendingArena == null) {
                this.pendingArena = nextArena;
                this.pendingArenaMs = 1600;
                this.arenaBannerName = 'SECTOR SHIFT — CLEAR THE FLOOR';
                this.arenaBannerMs = 1600;
                if (this.player) {
                    this.player.invincibleMs = Math.max(this.player.invincibleMs, 1600);
                }
                this.enemyBullets = [];
                this.spawnTimer = Math.max(this.spawnTimer, 1600);
            }
        }
        this.spawnTimer -= deltaTime;
        if (this.spawnTimer <= 0 && this.enemies.length < RIVET_RAGE.maxEnemies) {
            // Gentle early spawn, accelerates after wave 5
            const interval = this.wave <= 3
                ? 1700 - this.wave * 80
                : Math.max(420, 1500 - this.wave * 50);
            this.spawnTimer = interval;
            let batch = 1;
            if (this.wave >= 3) batch = 2;
            if (this.wave >= 7) batch = 3;
            if (this.wave >= 12) batch = Math.min(4, 2 + Math.floor(this.wave / 5));
            this.spawnWaveBurst(batch);
        }
    }

    spawnWaveBurst(count) {
        for (let i = 0; i < count; i++) {
            if (this.enemies.length >= RIVET_RAGE.maxEnemies) break;
            this.spawnEnemy(this.pickEnemyType());
        }
    }

    pickEnemyType() {
        const unlocked = Object.keys(RR_ENEMIES).filter((k) => RR_ENEMIES[k].unlockWave <= this.wave);
        // Keep goons dominant early; elites stay minority until mid-run
        const weights = unlocked.map((k) => {
            if (k === 'goon') return this.wave < 5 ? 1.4 : 1;
            if (k === 'bagger') return this.wave < 7 ? 0.35 : 0.55;
            if (k === 'bruiser') return this.wave < 10 ? 0.2 : 0.4;
            if (k === 'drone') return 0.45;
            return 0.4;
        });
        let sum = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * sum;
        for (let i = 0; i < unlocked.length; i++) {
            r -= weights[i];
            if (r <= 0) return unlocked[i];
        }
        return 'goon';
    }

    /** Soft early HP/speed, steeper after wave 6 so mid/late still bite. */
    enemyScale(wave) {
        const w = Math.max(0, wave - 1);
        if (w <= 5) {
            return {
                hp: 1 + w * 0.035,
                speed: 1 + w * 0.015
            };
        }
        const earlyHp = 1 + 5 * 0.035;
        const earlySpd = 1 + 5 * 0.015;
        const late = w - 5;
        return {
            hp: earlyHp + late * 0.09,
            speed: earlySpd + late * 0.035
        };
    }

    spawnEnemy(type) {
        const def = RR_ENEMIES[type];
        const scale = this.enemyScale(this.wave);
        const edge = Math.floor(Math.random() * 4);
        const m = 30;
        let x; let y;
        if (edge === 0) { x = Math.random() * this.width; y = -m; }
        else if (edge === 1) { x = this.width + m; y = Math.random() * this.height; }
        else if (edge === 2) { x = Math.random() * this.width; y = this.height + m; }
        else { x = -m; y = Math.random() * this.height; }

        this.enemies.push({
            type, x, y,
            radius: def.radius,
            hp: def.hp * scale.hp,
            maxHp: def.hp * scale.hp,
            speed: def.speed * scale.speed,
            xp: Math.ceil(def.xp * (1 + this.wave * 0.04)),
            score: Math.ceil(def.score * (1 + this.wave * 0.04)),
            flash: 0,
            slowMs: 0,
            shootCd: 600 + Math.random() * 800,
            shootInterval: def.shootCd || 1600
        });
    }

    updatePickups(deltaTime) {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.life -= deltaTime;
            if (p.life <= 0) {
                this.pickups.splice(i, 1);
                continue;
            }
            const dx = this.player.x - p.x;
            const dy = this.player.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < this.player.pickupRadius) {
                const pull = Math.min(4.5, 80 / (dist + 8));
                p.x += (dx / (dist || 1)) * pull * (deltaTime / 16.67);
                p.y += (dy / (dist || 1)) * pull * (deltaTime / 16.67);
            }
            if (dist < this.player.radius + p.radius) {
                if (p.type === 'hp') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
                else if (p.type === 'xp') this.addXp(p.value || 5);
                this.hudDirty = true;
                if (typeof audioManager !== 'undefined') audioManager.playGameSfx('rivet-rage', 'pickup');
                this.pickups.splice(i, 1);
            }
        }
    }

    spawnHitParticle(x, y, crit) {
        if (this.particles.length >= RIVET_RAGE.maxParticles) this.particles.shift();
        this.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            life: crit ? 280 : 160,
            maxLife: 280,
            kind: 'spark',
            color: crit ? 0xffee88 : 0xffaa33,
            scale: crit ? 1.5 : 1
        });
    }

    updateParticles(deltaTime) {
        const dt = deltaTime / 16.67;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (p.kind === 'ring') {
                p.scale = (p.scale || 0.4) + dt * 0.12;
            } else {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vx *= 0.98;
                p.vy *= 0.98;
            }
            p.life -= deltaTime;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        if (this.welderFlash) {
            this.welderFlash.life -= deltaTime;
            if (this.welderFlash.life <= 0) this.welderFlash = null;
        }
        if (this.railFlash) {
            this.railFlash.life -= deltaTime;
            if (this.railFlash.life <= 0) this.railFlash = null;
        }
    }

    // ── Scene sync (cheap) ──────────────────────────────────────────

    syncScene() {
        if (this.isPreview || !this.graphics?.isInitialized) return;
        this.ensureScene();
        if (!this.scene) return;

        const playing = this.gameState === 'playing' || this.gameState === 'paused' || this.gameState === 'levelup';
        this.scene.entities.visible = playing;

        this.hidePool('enemies');
        this.hidePool('projectiles');
        this.hidePool('enemyBullets');
        this.hidePool('pickups');
        this.hidePool('orbs');
        this.hidePool('particles');
        this.hidePool('zones');

        if (playing) {
            for (const p of this.pickups) {
                const spr = this.borrow('pickups', p.type === 'hp' ? this.textures.hp : this.textures.xpGem);
                spr.x = p.x;
                spr.y = p.y;
                spr.scale.set(1);
                spr.alpha = 0.7 + Math.sin(performance.now() / 200) * 0.3;
            }

            for (const b of this.enemyBullets) {
                const spr = this.borrow('enemyBullets', this.textures.bagShot);
                spr.x = b.x;
                spr.y = b.y;
                spr.scale.set(1);
            }

            for (const e of this.enemies) {
                const tex = this.textures[e.type] || this.textures.goon;
                const spr = this.borrow('enemies', tex);
                spr.x = e.x;
                spr.y = e.y;
                spr.tint = e.flash > 0 ? 0xffffff : (e.slowMs > 0 ? 0xcccc66 : 0xffffff);
                spr.alpha = e.flash > 0 ? 1 : 1;
                spr.scale.set(1);
            }

            for (const p of this.projectiles) {
                const tex = p.kind === 'spike' ? this.textures.spike
                    : p.kind === 'nail' ? this.textures.nail
                        : p.kind === 'saw' ? this.textures.saw
                            : this.textures.bolt;
                const spr = this.borrow('projectiles', tex);
                spr.x = p.x;
                spr.y = p.y;
                spr.rotation = p.kind === 'saw' ? (p.spin || 0) : Math.atan2(p.vy, p.vx);
                spr.scale.set(1.15);
            }

            for (const orb of this.orbs) {
                if (orb.x == null) continue;
                const spr = this.borrow('orbs', this.textures.wrench);
                spr.x = orb.x;
                spr.y = orb.y;
                spr.rotation = orb.angle;
            }

            for (const p of this.particles) {
                const tex = p.kind === 'ring' ? this.textures.ring
                    : p.kind === 'debris' ? this.textures.debris
                        : this.textures.spark;
                const spr = this.borrow('particles', tex);
                spr.x = p.x;
                spr.y = p.y;
                const lifePct = p.maxLife ? p.life / p.maxLife : Math.min(1, p.life / 200);
                spr.alpha = Math.max(0, lifePct);
                spr.tint = p.color != null ? p.color : 0xffaa33;
                const sc = (p.scale || 1) * (p.kind === 'ring' ? 1 : 1);
                spr.scale.set(sc);
                spr.rotation = p.kind === 'debris' ? (p.life * 0.02) : 0;
            }

            // FX graphics (welder / rail / hammer / shield / HP bars)
            const fx = this.scene.fx;
            fx.clear();
            if (this.player.powers.pulseShield > 0 && this.player.shieldActive) {
                const pulse = 0.45 + Math.sin(performance.now() / 120) * 0.25;
                fx.lineStyle(3, 0x66ddff, pulse);
                fx.drawCircle(this.player.x, this.player.y, this.player.radius + 10);
                fx.lineStyle(1, 0xaaffff, pulse * 0.6);
                fx.drawCircle(this.player.x, this.player.y, this.player.radius + 14);
            }
            if (this.player.overclockActive > 0) {
                fx.lineStyle(2, 0xff8844, 0.5 + Math.sin(performance.now() / 80) * 0.3);
                fx.drawCircle(this.player.x, this.player.y, this.player.radius + 6);
            }
            if (this.welderFlash) {
                fx.beginFill(0x66ddff, 0.3);
                fx.moveTo(this.player.x, this.player.y);
                fx.arc(
                    this.player.x, this.player.y, this.welderFlash.range,
                    this.welderFlash.angle - this.welderFlash.arc / 2,
                    this.welderFlash.angle + this.welderFlash.arc / 2
                );
                fx.endFill();
            }
            if (this.railFlash) {
                fx.lineStyle(3, 0xffee88, 0.85);
                fx.moveTo(this.railFlash.x1, this.railFlash.y1);
                fx.lineTo(this.railFlash.x2, this.railFlash.y2);
            }
            if (this.hammerFlash > 0) {
                const hammer = this.weapons.find((w) => w.id === 'forgeHammer');
                const r = hammer ? this.weaponStats(hammer).range : 70;
                fx.lineStyle(2, 0xff8844, this.hammerFlash / 180);
                fx.drawCircle(this.player.x, this.player.y, r);
            }
            for (const z of this.zones) {
                fx.beginFill(0x665522, 0.22);
                fx.drawCircle(z.x, z.y, z.radius);
                fx.endFill();
                fx.lineStyle(1, 0xaa8833, 0.4);
                fx.drawCircle(z.x, z.y, z.radius);
            }
            for (const e of this.enemies) {
                const pct = Math.max(0, e.hp / e.maxHp);
                if (pct >= 0.999) continue;
                const bw = 26;
                const by = e.y - e.radius - 12;
                fx.beginFill(0x000000, 0.75);
                fx.drawRect(e.x - bw / 2, by, bw, 4);
                fx.endFill();
                fx.beginFill(pct > 0.35 ? 0x44dd66 : 0xff4444);
                fx.drawRect(e.x - bw / 2, by, bw * pct, 4);
                fx.endFill();
            }

            const flash = this.player.invincibleMs > 0 && Math.floor(this.player.invincibleMs / 60) % 2;
            this.scene.playerSprite.visible = !flash;
            this.scene.playerSprite.x = this.player.x;
            this.scene.playerSprite.y = this.player.y + (this.player.moving ? Math.sin(this.player.anim / 70) * 1.5 : 0);
            this.scene.playerSprite.rotation = this.player.facing;
            const walk = this.player.moving ? 1 + Math.abs(Math.sin(this.player.anim / 90)) * 0.06 : 1;
            const dashScale = this.player.dashMs > 0 ? 1.15 : 1;
            this.scene.playerSprite.scale.set(walk * dashScale);
            this.scene.playerSprite.tint = this.player.overclockActive > 0 ? 0xffcc88
                : (this.player.powers.berserk > 0 && this.player.hp / this.player.maxHp <= 0.4) ? 0xff8888
                    : 0xffffff;
        }

        this.syncHud();
        this.syncOverlay();
    }

    syncHud() {
        if (!this.scene) return;
        const pct = this.xpToNext > 0 ? this.xp / this.xpToNext : 0;
        const barW = this.width - 40;
        this.scene.xpFill.clear();
        this.scene.xpFill.beginFill(0xffaa33);
        this.scene.xpFill.drawRect(20, 8, barW * pct, 10);
        this.scene.xpFill.endFill();

        if (this.scene.bannerText) {
            if (this.arenaBannerMs > 0 && this.gameState === 'playing') {
                this.scene.bannerText.visible = true;
                this.scene.bannerText.text = `▶ ${this.arenaBannerName}`;
                this.scene.bannerText.alpha = Math.min(1, this.arenaBannerMs / 500);
            } else {
                this.scene.bannerText.visible = false;
            }
        }

        const arenaName = (RR_ARENAS[this.arenaIndex] || RR_ARENAS[0]).name;
        const p = this.player;
        const hudKey = `${p.hp}|${this.level}|${this.wave}|${this.score}|${arenaName}|${this.weapons.map((w) => w.id + w.level).join(',')}|${p.shieldActive}|${p.dashCd > 0}|${p.overclockActive > 0}|${p.hp / p.maxHp <= 0.4}`;
        if (hudKey === this.scene.lastHudKey && !this.hudDirty) return;
        this.scene.lastHudKey = hudKey;
        this.hudDirty = false;
        const powerBits = [];
        const pw = this.player.powers;
        if (pw.pulseShield) powerBits.push(this.player.shieldActive ? 'SHIELD' : 'shield…');
        if (pw.dash) powerBits.push(this.player.dashCd > 0 ? `dash ${Math.ceil(this.player.dashCd / 1000)}s` : 'DASH');
        if (pw.overclock) powerBits.push(this.player.overclockActive > 0 ? 'OVERCLOCK!' : 'oc…');
        if (pw.thorns) powerBits.push('thorns');
        if (pw.berserk && this.player.hp / this.player.maxHp <= 0.4) powerBits.push('OVERTIME');
        if (pw.ricochet) powerBits.push('bank');
        if (pw.chainKill) powerBits.push('chain');
        if (pw.magnetPulse) powerBits.push('magnet');
        this.scene.infoText.text =
            `HP ${this.player.hp}/${this.player.maxHp}  Lv ${this.level}  Wave ${this.wave}  Score ${this.score}` +
            (powerBits.length ? `  ·  ${powerBits.join(' ')}` : '');
        this.scene.wpnText.text =
            `${arenaName}  ·  ` + this.weapons.map((w) => `${RR_WEAPONS[w.id].name} L${w.level}`).join(' · ');
    }

    syncOverlay() {
        if (!this.scene) return;
        const key = this.gameState === 'levelup'
            ? `levelup:${this.levelUpCards.map((c) => c.weaponId || c.statId).join(',')}`
            : this.gameState === 'pickrun'
                ? `pickrun:${this.selectedRun}`
                : this.gameState;
        if (this.overlayState === key) return;
        this.overlayState = key;

        const overlay = this.scene.overlay;
        overlay.removeChildren();

        if (this.gameState === 'playing') {
            overlay.visible = false;
            return;
        }
        overlay.visible = true;

        if (this.gameState === 'menu') {
            this.buildCenterOverlay(overlay, 'RIVET RAGE', [
                'Endless factory survival — weapons auto-aim',
                'Move: WASD   Dash: Shift/E   Pause: P   Reset: R',
                'Pick a run type, then stack wild power-ups',
                'Press SPACE to choose your run'
            ], 0xffaa33);
        } else if (this.gameState === 'pickrun') {
            this.buildPickRunOverlay(overlay);
        } else if (this.gameState === 'paused') {
            this.buildCenterOverlay(overlay, 'PAUSED', [
                'Press SPACE or P to resume',
                this.player.powers.dash ? 'Dash: Shift or E' : 'Find Jet Boots for dash'
            ], 0xffff66);
        } else if (this.gameState === 'gameOver') {
            this.buildCenterOverlay(overlay, 'SHIFT OVER', [
                `Score ${this.score}   Kills ${this.kills}   Wave ${this.wave}`,
                'Press SPACE to pick a new run'
            ], 0xff4444);
        } else if (this.gameState === 'levelup') {
            this.buildLevelUpOverlay(overlay);
        }
    }

    buildPickRunOverlay(overlay) {
        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.78);
        bg.drawRect(0, 0, this.width, this.height);
        bg.endFill();
        overlay.addChild(bg);

        const title = new PIXI.Text('CHOOSE YOUR RUN', new PIXI.TextStyle({
            fontFamily: 'Courier New', fontSize: 26, fill: 0xffaa33, fontWeight: 'bold'
        }));
        title.anchor.set(0.5);
        title.x = this.width / 2;
        title.y = 48;
        overlay.addChild(title);

        const hint = new PIXI.Text('← → ↑ ↓ or 1–6   SPACE / click confirm', new PIXI.TextStyle({
            fontFamily: 'Courier New', fontSize: 13, fill: 0xaabbcc
        }));
        hint.anchor.set(0.5);
        hint.x = this.width / 2;
        hint.y = 80;
        overlay.addChild(hint);

        const rects = this.getRunRects();
        RR_RUNS.forEach((run, i) => {
            const r = rects[i];
            const selected = i === this.selectedRun;
            const g = new PIXI.Graphics();
            g.beginFill(selected ? 0x2a3a28 : 0x1a2430);
            g.lineStyle(selected ? 3 : 2, run.color);
            g.drawRoundedRect(r.x, r.y, r.w, r.h, 6);
            g.endFill();
            overlay.addChild(g);

            const n = new PIXI.Text(run.name, new PIXI.TextStyle({
                fontFamily: 'Courier New', fontSize: 16, fill: run.color, fontWeight: 'bold'
            }));
            n.x = r.x + 12;
            n.y = r.y + 16;
            overlay.addChild(n);

            const d = new PIXI.Text(run.desc, new PIXI.TextStyle({
                fontFamily: 'Courier New', fontSize: 12, fill: 0xccddee,
                wordWrap: true, wordWrapWidth: r.w - 20
            }));
            d.x = r.x + 12;
            d.y = r.y + 48;
            overlay.addChild(d);

            if (selected) {
                const s = new PIXI.Text('▶', new PIXI.TextStyle({
                    fontFamily: 'Courier New', fontSize: 18, fill: run.color
                }));
                s.x = r.x + r.w - 28;
                s.y = r.y + 12;
                overlay.addChild(s);
            }
        });
    }

    buildCenterOverlay(overlay, title, lines, color) {
        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.72);
        bg.drawRect(0, 0, this.width, this.height);
        bg.endFill();
        overlay.addChild(bg);

        const t = new PIXI.Text(title, new PIXI.TextStyle({
            fontFamily: 'Courier New', fontSize: 36, fill: color, fontWeight: 'bold'
        }));
        t.anchor.set(0.5);
        t.x = this.width / 2;
        t.y = this.height / 2 - 60;
        overlay.addChild(t);

        lines.forEach((line, i) => {
            const l = new PIXI.Text(line, new PIXI.TextStyle({
                fontFamily: 'Courier New', fontSize: 14, fill: 0xffffff
            }));
            l.anchor.set(0.5);
            l.x = this.width / 2;
            l.y = this.height / 2 - 10 + i * 24;
            overlay.addChild(l);
        });
    }

    buildLevelUpOverlay(overlay) {
        const bg = new PIXI.Graphics();
        bg.beginFill(0x000000, 0.7);
        bg.drawRect(0, 0, this.width, this.height);
        bg.endFill();
        overlay.addChild(bg);

        const title = new PIXI.Text('LEVEL UP — pick one (1 / 2 / 3 or click)', new PIXI.TextStyle({
            fontFamily: 'Courier New', fontSize: 18, fill: 0xffd700, fontWeight: 'bold'
        }));
        title.anchor.set(0.5);
        title.x = this.width / 2;
        title.y = this.height / 2 - 120;
        overlay.addChild(title);

        const rects = this.getCardRects();
        this.levelUpCards.forEach((card, i) => {
            const r = rects[i];
            const g = new PIXI.Graphics();
            g.beginFill(0x243044);
            g.lineStyle(2, card.type === 'weapon' ? 0xffaa33 : 0x66aaff);
            g.drawRoundedRect(r.x, r.y, r.w, r.h, 8);
            g.endFill();
            overlay.addChild(g);

            let name;
            let desc;
            if (card.type === 'weapon') {
                const def = RR_WEAPONS[card.weaponId];
                name = card.upgrade ? `${def.name} +1` : def.name;
                desc = card.upgrade
                    ? `Upgrade to level ${(this.weapons.find((w) => w.id === card.weaponId)?.level || 1) + 1}`
                    : def.desc;
            } else {
                const def = RR_STATS[card.statId];
                name = def.name;
                desc = def.desc;
            }

            const n = new PIXI.Text(`${i + 1}. ${name}`, new PIXI.TextStyle({
                fontFamily: 'Courier New', fontSize: 15, fill: 0xffffff, fontWeight: 'bold',
                wordWrap: true, wordWrapWidth: r.w - 20
            }));
            n.x = r.x + 12;
            n.y = r.y + 18;
            overlay.addChild(n);

            const d = new PIXI.Text(desc, new PIXI.TextStyle({
                fontFamily: 'Courier New', fontSize: 13, fill: 0xaabbcc,
                wordWrap: true, wordWrapWidth: r.w - 20
            }));
            d.x = r.x + 12;
            d.y = r.y + 72;
            overlay.addChild(d);
        });
    }

    updateStatsPanel() {
        const statsPanel = document.getElementById('game-stats-panel');
        if (!statsPanel) return;
        const statsContent = statsPanel.querySelector('.stats-content');
        if (!statsContent) return;
        statsContent.innerHTML = `
            <div class="stat-item"><div class="stat-label">Score</div><div class="stat-value">${typeof Utils !== 'undefined' ? Utils.formatScore(this.score) : this.score}</div></div>
            <div class="stat-item"><div class="stat-label">Level</div><div class="stat-value">${this.level}</div></div>
            <div class="stat-item"><div class="stat-label">Wave</div><div class="stat-value">${this.wave}</div></div>
            <div class="stat-item"><div class="stat-label">HP</div><div class="stat-value">${this.player.hp}/${this.player.maxHp}</div></div>
            <div class="stat-item"><div class="stat-label">Kills</div><div class="stat-value">${this.kills}</div></div>
        `;
    }

    drawPreview() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.fillStyle = '#151c28';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = '#5a4a32';
        ctx.fillRect(this.width * 0.28, this.height * 0.32, 18, 18);
        ctx.fillRect(this.width * 0.62, this.height * 0.52, 18, 18);
        ctx.fillStyle = '#3a6cc0';
        ctx.beginPath(); ctx.arc(this.width / 2, this.height / 2, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8c00';
        ctx.fillRect(this.width / 2 - 5, this.height / 2 - 10, 10, 4);
        ctx.fillStyle = '#1e4a8c';
        ctx.beginPath(); ctx.arc(this.width * 0.22, this.height * 0.42, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.width * 0.72, this.height * 0.28, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffaa33';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('RIVET RAGE', this.width / 2, this.height - 8);
        ctx.textAlign = 'left';
    }

    cleanup() {
        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);
        if (this.canvas && this.clickHandler) this.canvas.removeEventListener('click', this.clickHandler);
        if (this.rafId) cancelAnimationFrame(this.rafId);
        if (!this.isPreview && this.graphics) {
            const ticker = this.graphics.getTicker?.();
            if (ticker && this.tickerCallback) ticker.remove(this.tickerCallback);
            if (this.graphics.app) {
                this.graphics.app.destroy(true, { children: true, texture: true, baseTexture: true });
            }
        }
        this.scene = null;
        this.textures = null;
        if (this.touchControls) {
            this.touchControls.destroy();
            this.touchControls = null;
        }
    }
}

function initRivetRage() {
    const canvas = document.getElementById('rivet-rage-preview');
    if (canvas) new RivetRageGame(canvas);
}
