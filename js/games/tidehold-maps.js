// Tidehold map definitions — world XZ plane, Y up
const TIDEHOLD_MAPS = [
    {
        id: 'breakwater',
        name: 'Breakwater',
        blurb: 'S-curve jetty over open sea',
        waterColor: 0x0a5a68,
        fogColor: 0x06141c,
        fogNear: 55,
        fogFar: 140,
        ambient: 0x7a9aaa,
        keyColor: 0xffe2b0,
        // Pulled back so the full shelf fits in frame
        camera: { x: 0, y: 26, z: 24, lookX: 0, lookY: 0, lookZ: 1.5, fov: 46 },
        atmosphere: 'open',
        startingGold: 140,
        lives: 20,
        paths: [
            [
                { x: -14, z: -12 },
                { x: -9, z: -8 },
                { x: -5, z: -3 },
                { x: -7, z: 2 },
                { x: -2, z: 5 },
                { x: 3, z: 3 },
                { x: 7, z: -2 },
                { x: 10, z: -5 },
                { x: 13, z: -1 },
                { x: 11, z: 5 },
                { x: 6, z: 10 }
            ]
        ],
        pads: [
            { x: -10, z: -5 },
            { x: -4, z: 0 },
            { x: 0, z: 7 },
            { x: 5, z: 0 },
            { x: 9, z: -3 },
            { x: 10, z: 4 }
        ],
        lanterns: [
            { x: -12, z: -10 },
            { x: -6, z: 4 },
            { x: 4, z: 5 },
            { x: 12, z: 0 },
            { x: 8, z: 8 }
        ]
    },
    {
        id: 'kelp-gate',
        name: 'Kelp Gate',
        blurb: 'Forked paths through the kelp forest',
        waterColor: 0x0a4844,
        fogColor: 0x051414,
        fogNear: 40,
        fogFar: 110,
        ambient: 0x5a8a7a,
        keyColor: 0xc8e8a0,
        camera: { x: 1, y: 28, z: 26, lookX: 0, lookY: 0, lookZ: 1.5, fov: 46 },
        atmosphere: 'kelp',
        startingGold: 155,
        lives: 18,
        paths: [
            [
                { x: -12, z: -10 },
                { x: -7, z: -7 },
                { x: -3, z: -3 },
                { x: -5, z: 2 },
                { x: -7, z: 7 },
                { x: -2, z: 10 },
                { x: 5, z: 10 },
                { x: 10, z: 7 }
            ],
            [
                { x: -12, z: -10 },
                { x: -7, z: -7 },
                { x: -3, z: -3 },
                { x: 2, z: -2 },
                { x: 7, z: 0 },
                { x: 9, z: 5 },
                { x: 10, z: 7 }
            ]
        ],
        pads: [
            { x: -9, z: -8 },
            { x: -1, z: -5 },
            { x: -7, z: 4 },
            { x: -3, z: 9 },
            { x: 4, z: -3 },
            { x: 5, z: 4 },
            { x: 2, z: 9 },
            { x: 9, z: 2 }
        ],
        lanterns: [
            { x: -10, z: -8 },
            { x: -5, z: 5 },
            { x: 0, z: 0 },
            { x: 7, z: 7 },
            { x: 3, z: -2 }
        ]
    },
    {
        id: 'abyssal-stair',
        name: 'Abyssal Stair',
        blurb: 'Spiral cliff descent into the deep',
        waterColor: 0x072038,
        fogColor: 0x030810,
        fogNear: 35,
        fogFar: 100,
        ambient: 0x4a5a7a,
        keyColor: 0x88aacc,
        camera: { x: 3, y: 28, z: 26, lookX: 0, lookY: 0, lookZ: 1.5, fov: 46 },
        atmosphere: 'abyss',
        startingGold: 170,
        lives: 16,
        paths: [
            [
                { x: 10, z: -10 },
                { x: 7, z: -8 },
                { x: 3, z: -10 },
                { x: -2, z: -8 },
                { x: -7, z: -5 },
                { x: -9, z: 0 },
                { x: -7, z: 5 },
                { x: -2, z: 9 },
                { x: 3, z: 9 },
                { x: 7, z: 5 },
                { x: 5, z: 0 },
                { x: 0, z: -2 }
            ]
        ],
        pads: [
            { x: 8, z: -7 },
            { x: 2, z: -8 },
            { x: -5, z: -7 },
            { x: -9, z: -2 },
            { x: -7, z: 4 },
            { x: 0, z: 9 },
            { x: 7, z: 4 },
            { x: 3, z: -2 }
        ],
        lanterns: [
            { x: 9, z: -10 },
            { x: -3, z: -9 },
            { x: -9, z: 3 },
            { x: 2, z: 7 },
            { x: 5, z: 2 }
        ]
    }
];

/**
 * Tower kits with branching upgrades.
 * Level 1 = base. Upgrading to 2 picks a branch. Level 3 deepens that branch.
 * `mult` multiplies base stats; `add` adds flat values (pierce, etc).
 */
const TIDEHOLD_TOWERS = {
    beacon: {
        id: 'beacon',
        name: 'Beacon',
        blurb: 'Lantern sniper — single-target light bolts',
        cost: 50,
        upgradeCost: 45,
        range: 9,
        fireRate: 0.85,
        damage: 14,
        projectileSpeed: 28,
        color: 0xe8c878,
        emissive: 0xffaa44,
        branches: {
            focus: {
                id: 'focus',
                name: 'Focus Beam',
                blurb: 'Harder, faster shots. Slightly less range.',
                accent: 0xffcc66,
                tiers: [
                    { mult: { damage: 1.55, fireRate: 0.78, range: 0.9 }, add: {} },
                    { mult: { damage: 2.15, fireRate: 0.62, range: 0.85 }, add: {} }
                ]
            },
            flood: {
                id: 'flood',
                name: 'Floodlight',
                blurb: 'Wider reach. Bolts pierce extra foes.',
                accent: 0xaaddff,
                tiers: [
                    { mult: { damage: 0.95, fireRate: 0.95, range: 1.3 }, add: { pierce: 1 } },
                    { mult: { damage: 1.1, fireRate: 0.88, range: 1.5 }, add: { pierce: 2 } }
                ]
            },
            prism: {
                id: 'prism',
                name: 'Prism Arc',
                blurb: 'Chain to nearby enemies after the first hit.',
                accent: 0xff88cc,
                tiers: [
                    { mult: { damage: 1.15, fireRate: 0.95, range: 1.05 }, add: { chain: 1, chainRange: 3.5 } },
                    { mult: { damage: 1.35, fireRate: 0.9, range: 1.1 }, add: { chain: 2, chainRange: 4.5 } }
                ]
            }
        }
    },
    mortar: {
        id: 'mortar',
        name: 'Coral Mortar',
        blurb: 'Lobbed splash orbs that slow',
        cost: 75,
        upgradeCost: 60,
        range: 8,
        fireRate: 1.5,
        damage: 22,
        splash: 2.8,
        slow: 0.45,
        slowDuration: 1.6,
        projectileSpeed: 12,
        color: 0xd46a7a,
        emissive: 0x44ffcc,
        branches: {
            tide: {
                id: 'tide',
                name: 'Tide Bloom',
                blurb: 'Bigger splash and longer slow.',
                accent: 0x44ffcc,
                tiers: [
                    { mult: { damage: 1.1, splash: 1.45, slowDuration: 1.35, range: 1.05 }, add: { slow: 0.1 } },
                    { mult: { damage: 1.25, splash: 1.85, slowDuration: 1.7, range: 1.1 }, add: { slow: 0.2 } }
                ]
            },
            spire: {
                id: 'spire',
                name: 'Spire Shot',
                blurb: 'Heavy single impact. Tiny splash.',
                accent: 0xff6688,
                tiers: [
                    { mult: { damage: 1.7, splash: 0.45, fireRate: 0.85, range: 1.15 }, add: {} },
                    { mult: { damage: 2.35, splash: 0.35, fireRate: 0.75, range: 1.25 }, add: {} }
                ]
            },
            brine: {
                id: 'brine',
                name: 'Brine Barrage',
                blurb: 'Faster volleys. Moderate splash.',
                accent: 0x88e0a0,
                tiers: [
                    { mult: { damage: 0.85, fireRate: 0.65, splash: 1.1, range: 1.0 }, add: {} },
                    { mult: { damage: 0.95, fireRate: 0.5, splash: 1.2, range: 1.05 }, add: {} }
                ]
            }
        }
    },
    whirlpool: {
        id: 'whirlpool',
        name: 'Whirlpool',
        blurb: 'Ground vortex — holds and shreds',
        cost: 65,
        upgradeCost: 55,
        range: 4.5,
        fireRate: 0.35,
        damage: 5,
        hold: 0.55,
        color: 0x3a9aaa,
        emissive: 0x33eedd,
        branches: {
            maelstrom: {
                id: 'maelstrom',
                name: 'Maelstrom',
                blurb: 'Wider pull. Slightly less damage.',
                accent: 0x33eedd,
                tiers: [
                    { mult: { range: 1.4, damage: 0.9, hold: 1.25 }, add: {} },
                    { mult: { range: 1.75, damage: 1.0, hold: 1.5 }, add: {} }
                ]
            },
            riptide: {
                id: 'riptide',
                name: 'Riptide',
                blurb: 'Brutal DoT in a tighter well.',
                accent: 0x4488ff,
                tiers: [
                    { mult: { range: 0.85, damage: 1.7, hold: 1.15 }, add: {} },
                    { mult: { range: 0.8, damage: 2.4, hold: 1.35 }, add: {} }
                ]
            },
            undertow: {
                id: 'undertow',
                name: 'Undertow',
                blurb: 'Slows everything nearby even at the edge.',
                accent: 0xaa88ff,
                tiers: [
                    { mult: { range: 1.15, damage: 1.15, hold: 0.9 }, add: { auraSlow: 0.35, auraSlowDuration: 0.4 } },
                    { mult: { range: 1.25, damage: 1.35, hold: 1.0 }, add: { auraSlow: 0.5, auraSlowDuration: 0.55 } }
                ]
            }
        }
    }
};

const TIDEHOLD_ENEMIES = {
    sailor: {
        id: 'sailor',
        name: 'Drowned Sailor',
        hp: 40,
        speed: 2.4,
        reward: 8,
        leakDamage: 1,
        scale: 1.25,
        color: 0x2a4a6a
    },
    crab: {
        id: 'crab',
        name: 'Reef Crab',
        hp: 28,
        speed: 4.2,
        reward: 10,
        leakDamage: 1,
        scale: 1.1,
        color: 0x8a6a3a
    },
    leviathan: {
        id: 'leviathan',
        name: 'Leviathan Spawn',
        hp: 220,
        speed: 1.35,
        reward: 40,
        leakDamage: 3,
        scale: 1.85,
        color: 0x1a2a3a
    }
};

function tideholdWavesForMap(mapIndex) {
    const base = [
        { groups: [{ type: 'sailor', count: 6, interval: 0.85 }] },
        { groups: [{ type: 'sailor', count: 8, interval: 0.7 }, { type: 'crab', count: 3, interval: 1.1, delay: 2 }] },
        { groups: [{ type: 'crab', count: 8, interval: 0.55 }, { type: 'sailor', count: 6, interval: 0.8, delay: 1 }] },
        { groups: [{ type: 'sailor', count: 10, interval: 0.6 }, { type: 'leviathan', count: 1, interval: 1, delay: 3 }] },
        { groups: [{ type: 'crab', count: 12, interval: 0.45 }, { type: 'sailor', count: 10, interval: 0.55, delay: 1.5 }] },
        { groups: [{ type: 'leviathan', count: 2, interval: 2.5 }, { type: 'sailor', count: 14, interval: 0.5, delay: 1 }, { type: 'crab', count: 8, interval: 0.5, delay: 4 }] },
        { groups: [{ type: 'sailor', count: 16, interval: 0.4 }, { type: 'crab', count: 12, interval: 0.4, delay: 1 }, { type: 'leviathan', count: 2, interval: 2, delay: 5 }] },
        { groups: [{ type: 'leviathan', count: 3, interval: 1.8 }, { type: 'crab', count: 16, interval: 0.35, delay: 0.5 }, { type: 'sailor', count: 18, interval: 0.35, delay: 2 }] }
    ];

    const scale = 1 + mapIndex * 0.12;
    return base.map((wave) => ({
        groups: wave.groups.map((g) => ({
            ...g,
            count: Math.round(g.count * (mapIndex === 0 ? 1 : scale)),
            hpScale: scale
        }))
    }));
}

function tideholdGetTowerStats(tower) {
    const base = TIDEHOLD_TOWERS[tower.type];
    const stats = {
        range: base.range,
        fireRate: base.fireRate,
        damage: base.damage,
        splash: base.splash || 0,
        slow: base.slow || 0,
        slowDuration: base.slowDuration || 0,
        hold: base.hold || 0,
        pierce: 0,
        chain: 0,
        chainRange: 0,
        auraSlow: 0,
        auraSlowDuration: 0,
        projectileSpeed: base.projectileSpeed || 20,
        accent: base.emissive
    };

    if (tower.branch && tower.level >= 2 && base.branches[tower.branch]) {
        const branch = base.branches[tower.branch];
        const tierIndex = Math.min(tower.level - 2, branch.tiers.length - 1);
        const tier = branch.tiers[tierIndex];
        stats.accent = branch.accent;
        Object.keys(tier.mult || {}).forEach((k) => {
            if (typeof stats[k] === 'number') stats[k] *= tier.mult[k];
        });
        Object.keys(tier.add || {}).forEach((k) => {
            stats[k] = (stats[k] || 0) + tier.add[k];
        });
    }
    return stats;
}
