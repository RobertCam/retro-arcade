/**
 * Per-game procedural sound synthesis parameters.
 * Used when WAV files are missing under assets/audio/games/.
 */
const GAME_SOUND_PROFILES = {
    'working-man': {
        start: { frequencies: [392, 523], duration: 0.08, type: 'square', gain: 0.1 },
        jump: { frequencies: [440, 550], duration: 0.06, type: 'sine', gain: 0.1 },
        land: { frequencies: [180], duration: 0.05, type: 'triangle', gain: 0.08 },
        throw: { frequencies: [280], duration: 0.05, type: 'square', gain: 0.08 },
        death: { frequencies: [200, 150], duration: 0.15, type: 'sawtooth', gain: 0.12 }
    },
    minigolf: {
        start: { frequencies: [330, 440], duration: 0.07, type: 'sine', gain: 0.1 },
        putt: { frequencies: [520], duration: 0.04, type: 'sine', gain: 0.08 },
        bounce: { frequencies: [380], duration: 0.03, type: 'triangle', gain: 0.06 },
        sand: { frequencies: [200], duration: 0.05, type: 'triangle', gain: 0.05 },
        water: { frequencies: [150, 120], duration: 0.1, type: 'sine', gain: 0.08 },
        sink: { frequencies: [660, 880, 1100], duration: 0.12, type: 'sine', gain: 0.12 }
    },
    breakout: {
        start: { frequencies: [440, 554], duration: 0.07, type: 'square', gain: 0.1 },
        break: { frequencies: [600, 800], duration: 0.05, type: 'square', gain: 0.1 },
        hit: { frequencies: [350], duration: 0.03, type: 'sine', gain: 0.07 },
        powerup: { frequencies: [523, 784, 1047], duration: 0.06, type: 'sine', gain: 0.1 }
    },
    tetris: {
        start: { frequencies: [330, 392, 494], duration: 0.08, type: 'square', gain: 0.1 },
        lock: { frequencies: [220], duration: 0.04, type: 'triangle', gain: 0.07 },
        lineClear: { frequencies: [523, 659, 784, 1047], duration: 0.1, type: 'sine', gain: 0.12 },
        levelUp: { frequencies: [440, 554, 659, 880], duration: 0.1, type: 'square', gain: 0.1 }
    },
    'mouse-pacman': {
        start: { frequencies: [500, 650], duration: 0.06, type: 'sine', gain: 0.1 },
        chomp: { frequencies: [800], duration: 0.03, type: 'square', gain: 0.06 },
        power: { frequencies: [440, 660, 880], duration: 0.08, type: 'sine', gain: 0.1 },
        alert: { frequencies: [300, 250], duration: 0.08, type: 'sawtooth', gain: 0.08 }
    },
    jezzball: {
        start: { frequencies: [400, 500], duration: 0.07, type: 'square', gain: 0.09 },
        draw: { frequencies: [600], duration: 0.02, type: 'sine', gain: 0.05 },
        capture: { frequencies: [523, 659], duration: 0.1, type: 'sine', gain: 0.1 },
        tick: { frequencies: [880], duration: 0.02, type: 'square', gain: 0.05 }
    },
    'space-invaders': {
        start: { frequencies: [330, 440, 550], duration: 0.08, type: 'square', gain: 0.1 },
        shoot: { frequencies: [880], duration: 0.04, type: 'square', gain: 0.08 },
        alienHit: { frequencies: [220, 180], duration: 0.08, type: 'sawtooth', gain: 0.1 },
        bunkerHit: { frequencies: [120], duration: 0.03, type: 'triangle', gain: 0.06 },
        playerHit: { frequencies: [180, 120, 80], duration: 0.15, type: 'sawtooth', gain: 0.12 },
        waveClear: { frequencies: [523, 659, 784, 1047], duration: 0.1, type: 'sine', gain: 0.12 },
        ufo: { frequencies: [140, 180, 220], duration: 0.12, type: 'sine', gain: 0.1 }
    }
};

function getGameSoundProfile(gameId, event) {
    const game = GAME_SOUND_PROFILES[gameId];
    if (!game) return null;
    return game[event] || null;
}
