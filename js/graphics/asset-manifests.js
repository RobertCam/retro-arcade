/**
 * Central asset path registry. Short filenames inside per-game folders.
 * Convention: assets/games/[game-id]/[filename]
 */
const ASSET_MANIFESTS = {
    breakout: {
        paddle: 'assets/games/breakout/paddle.png',
        ball: 'assets/games/breakout/ball.png',
        brick: (theme, index) => `assets/games/breakout/bricks/${theme}-${index}.png`,
        background: (theme) => `assets/games/breakout/backgrounds/${theme}.png`,
        powerup: (type) => `assets/games/breakout/powerups/${type}.png`
    },
    tetris: {
        boardBg: 'assets/games/tetris/board-bg.png',
        pieceGhost: 'assets/games/tetris/piece-ghost.png',
        piece: (type, rotation) => `assets/games/tetris/piece-${type}-${rotation}.png`
    },
    'mouse-pacman': {
        mouse: 'assets/games/mouse-pacman/mouse.png',
        cat: 'assets/games/mouse-pacman/cat.png',
        cheese: 'assets/games/mouse-pacman/cheese.png',
        wall: 'assets/games/mouse-pacman/wall.png'
    },
    'rivet-rage': {
        player: 'assets/games/rivet-rage/player.png',
        goon: 'assets/games/rivet-rage/goon.png',
        bagger: 'assets/games/rivet-rage/bagger.png',
        bruiser: 'assets/games/rivet-rage/bruiser.png',
        drone: 'assets/games/rivet-rage/drone.png',
        projectile: 'assets/games/rivet-rage/projectile.png',
        obstacle: 'assets/games/rivet-rage/obstacle.png'
    },
    jezzball: {
        ball: 'assets/games/jezzball/ball.png',
        wall: 'assets/games/jezzball/wall.png',
        line: 'assets/games/jezzball/line.png'
    },
    minigolf: {
        ball: 'assets/games/minigolf/ball.png',
        hole: 'assets/games/minigolf/hole.png',
        flag: 'assets/games/minigolf/flag.png',
        grass: 'assets/games/minigolf/grass.png',
        sand: 'assets/games/minigolf/sand.png',
        water: 'assets/games/minigolf/water.png'
    }
};

/** Flatten manifest values into loadable path strings (excludes function entries). */
function getManifestPaths(gameId) {
    const manifest = ASSET_MANIFESTS[gameId];
    if (!manifest) return [];

    const paths = [];
    for (const value of Object.values(manifest)) {
        if (typeof value === 'string') {
            paths.push(value);
        }
    }
    return paths;
}

/** Resolve a manifest key to a path string, or null if it's a factory function. */
function resolveManifestPath(gameId, key, ...args) {
    const manifest = ASSET_MANIFESTS[gameId];
    if (!manifest || !(key in manifest)) return null;

    const entry = manifest[key];
    if (typeof entry === 'function') {
        return entry(...args);
    }
    return entry;
}
