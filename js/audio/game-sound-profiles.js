/**
 * Per-game procedural sound patches.
 * Prefer layered patches (tone / sweep / noise). Legacy frequency arrays still work.
 */
const GAME_SOUND_PROFILES = {
    'rivet-rage': {
        start: {
            layers: [
                { kind: 'tone', freq: 220, duration: 0.1, wave: 'square', gain: 0.09 },
                { kind: 'tone', freq: 330, duration: 0.1, wave: 'square', gain: 0.09, delay: 0.08 },
                { kind: 'tone', freq: 440, duration: 0.14, wave: 'triangle', gain: 0.1, delay: 0.16 }
            ]
        },
        shoot: {
            layers: [
                { kind: 'sweep', freq: 880, endFreq: 220, duration: 0.07, wave: 'square', gain: 0.07 },
                { kind: 'noise', duration: 0.04, gain: 0.04, band: 2500, filter: 'bandpass' }
            ]
        },
        hit: {
            layers: [
                { kind: 'noise', duration: 0.06, gain: 0.1, band: 800, filter: 'bandpass' },
                { kind: 'sweep', freq: 280, endFreq: 90, duration: 0.08, wave: 'triangle', gain: 0.08 }
            ]
        },
        levelup: {
            layers: [
                { kind: 'tone', freq: 523, duration: 0.08, wave: 'sine', gain: 0.1 },
                { kind: 'tone', freq: 659, duration: 0.08, wave: 'sine', gain: 0.1, delay: 0.07 },
                { kind: 'tone', freq: 784, duration: 0.12, wave: 'sine', gain: 0.11, delay: 0.14 }
            ]
        },
        pickup: {
            layers: [
                { kind: 'tone', freq: 660, duration: 0.05, wave: 'sine', gain: 0.09 },
                { kind: 'tone', freq: 990, duration: 0.08, wave: 'sine', gain: 0.1, delay: 0.05 }
            ]
        },
        death: {
            layers: [
                { kind: 'sweep', freq: 240, endFreq: 60, duration: 0.28, wave: 'sawtooth', gain: 0.12 },
                { kind: 'noise', duration: 0.22, gain: 0.08, band: 400, filter: 'lowpass', delay: 0.02 }
            ]
        }
    },

    minigolf: {
        start: {
            layers: [
                { kind: 'tone', freq: 330, duration: 0.08, wave: 'sine', gain: 0.09 },
                { kind: 'tone', freq: 440, duration: 0.1, wave: 'sine', gain: 0.1, delay: 0.08 }
            ]
        },
        putt: {
            layers: [
                { kind: 'sweep', freq: 420, endFreq: 180, duration: 0.06, wave: 'sine', gain: 0.09 },
                { kind: 'noise', duration: 0.03, gain: 0.035, band: 900, filter: 'bandpass' }
            ]
        },
        bounce: {
            layers: [
                { kind: 'tone', freq: 520, duration: 0.04, wave: 'triangle', gain: 0.07 },
                { kind: 'noise', duration: 0.025, gain: 0.03, band: 1800, filter: 'highpass' }
            ]
        },
        sand: {
            layers: [
                { kind: 'noise', duration: 0.12, gain: 0.07, band: 700, filter: 'bandpass', q: 0.7 }
            ]
        },
        water: {
            layers: [
                { kind: 'noise', duration: 0.14, gain: 0.06, band: 500, filter: 'lowpass' },
                { kind: 'sweep', freq: 220, endFreq: 90, duration: 0.16, wave: 'sine', gain: 0.07 }
            ]
        },
        sink: {
            layers: [
                { kind: 'tone', freq: 660, duration: 0.08, wave: 'sine', gain: 0.1 },
                { kind: 'tone', freq: 880, duration: 0.1, wave: 'sine', gain: 0.1, delay: 0.08 },
                { kind: 'tone', freq: 1175, duration: 0.14, wave: 'sine', gain: 0.11, delay: 0.16 }
            ]
        }
    },

    breakout: {
        start: {
            layers: [
                { kind: 'tone', freq: 440, duration: 0.07, wave: 'square', gain: 0.09 },
                { kind: 'tone', freq: 554, duration: 0.1, wave: 'square', gain: 0.1, delay: 0.07 }
            ]
        },
        break: {
            layers: [
                { kind: 'noise', duration: 0.07, gain: 0.09, band: 2200, filter: 'bandpass' },
                { kind: 'sweep', freq: 720, endFreq: 240, duration: 0.08, wave: 'square', gain: 0.08 }
            ]
        },
        hit: {
            layers: [
                { kind: 'tone', freq: 360, duration: 0.035, wave: 'triangle', gain: 0.08 },
                { kind: 'noise', duration: 0.025, gain: 0.04, band: 1500, filter: 'highpass' }
            ]
        },
        powerup: {
            layers: [
                { kind: 'tone', freq: 523, duration: 0.06, wave: 'sine', gain: 0.09 },
                { kind: 'tone', freq: 784, duration: 0.07, wave: 'sine', gain: 0.1, delay: 0.06 },
                { kind: 'tone', freq: 1047, duration: 0.1, wave: 'sine', gain: 0.1, delay: 0.12 }
            ]
        }
    },

    tetris: {
        start: {
            layers: [
                { kind: 'tone', freq: 330, duration: 0.07, wave: 'square', gain: 0.09 },
                { kind: 'tone', freq: 392, duration: 0.07, wave: 'square', gain: 0.09, delay: 0.07 },
                { kind: 'tone', freq: 494, duration: 0.1, wave: 'square', gain: 0.1, delay: 0.14 }
            ]
        },
        lock: {
            layers: [
                { kind: 'tone', freq: 180, duration: 0.045, wave: 'triangle', gain: 0.08 },
                { kind: 'noise', duration: 0.03, gain: 0.03, band: 600, filter: 'lowpass' }
            ]
        },
        lineClear: {
            layers: [
                { kind: 'tone', freq: 523, duration: 0.08, wave: 'sine', gain: 0.1 },
                { kind: 'tone', freq: 659, duration: 0.08, wave: 'sine', gain: 0.1, delay: 0.07 },
                { kind: 'tone', freq: 784, duration: 0.08, wave: 'sine', gain: 0.1, delay: 0.14 },
                { kind: 'tone', freq: 1047, duration: 0.14, wave: 'sine', gain: 0.11, delay: 0.21 }
            ]
        },
        levelUp: {
            layers: [
                { kind: 'tone', freq: 440, duration: 0.07, wave: 'square', gain: 0.09 },
                { kind: 'tone', freq: 554, duration: 0.07, wave: 'square', gain: 0.09, delay: 0.07 },
                { kind: 'tone', freq: 659, duration: 0.07, wave: 'square', gain: 0.09, delay: 0.14 },
                { kind: 'tone', freq: 880, duration: 0.12, wave: 'square', gain: 0.1, delay: 0.21 }
            ]
        }
    },

    'mouse-pacman': {
        start: {
            layers: [
                { kind: 'tone', freq: 500, duration: 0.06, wave: 'sine', gain: 0.09 },
                { kind: 'tone', freq: 650, duration: 0.09, wave: 'sine', gain: 0.1, delay: 0.06 }
            ]
        },
        chomp: {
            layers: [
                { kind: 'sweep', freq: 420, endFreq: 180, duration: 0.05, wave: 'square', gain: 0.07 },
                { kind: 'tone', freq: 90, duration: 0.04, wave: 'triangle', gain: 0.05 }
            ]
        },
        power: {
            layers: [
                { kind: 'tone', freq: 440, duration: 0.07, wave: 'sine', gain: 0.09 },
                { kind: 'tone', freq: 660, duration: 0.08, wave: 'sine', gain: 0.1, delay: 0.07 },
                { kind: 'tone', freq: 880, duration: 0.12, wave: 'sine', gain: 0.1, delay: 0.14 }
            ]
        },
        alert: {
            layers: [
                { kind: 'sweep', freq: 320, endFreq: 180, duration: 0.1, wave: 'sawtooth', gain: 0.08 },
                { kind: 'sweep', freq: 280, endFreq: 140, duration: 0.1, wave: 'sawtooth', gain: 0.07, delay: 0.09 }
            ]
        }
    },

    jezzball: {
        start: {
            layers: [
                { kind: 'tone', freq: 400, duration: 0.07, wave: 'square', gain: 0.08 },
                { kind: 'tone', freq: 500, duration: 0.09, wave: 'square', gain: 0.09, delay: 0.07 }
            ]
        },
        draw: {
            layers: [
                { kind: 'tone', freq: 700, duration: 0.02, wave: 'sine', gain: 0.045 }
            ]
        },
        capture: {
            layers: [
                { kind: 'tone', freq: 523, duration: 0.09, wave: 'sine', gain: 0.1 },
                { kind: 'tone', freq: 659, duration: 0.12, wave: 'sine', gain: 0.1, delay: 0.08 }
            ]
        },
        tick: {
            layers: [
                { kind: 'tone', freq: 980, duration: 0.02, wave: 'square', gain: 0.045 }
            ]
        },
        fail: {
            layers: [
                { kind: 'sweep', freq: 240, endFreq: 70, duration: 0.22, wave: 'sawtooth', gain: 0.12 },
                { kind: 'noise', duration: 0.16, gain: 0.07, band: 350, filter: 'lowpass', delay: 0.03 }
            ]
        }
    },

    'space-invaders': {
        start: {
            layers: [
                { kind: 'tone', freq: 220, duration: 0.08, wave: 'square', gain: 0.09 },
                { kind: 'tone', freq: 277, duration: 0.08, wave: 'square', gain: 0.09, delay: 0.08 },
                { kind: 'tone', freq: 330, duration: 0.12, wave: 'square', gain: 0.1, delay: 0.16 }
            ]
        },
        shoot: {
            layers: [
                { kind: 'sweep', freq: 980, endFreq: 280, duration: 0.09, wave: 'square', gain: 0.08 },
                { kind: 'noise', duration: 0.04, gain: 0.03, band: 3000, filter: 'highpass' }
            ]
        },
        alienHit: {
            layers: [
                { kind: 'noise', duration: 0.1, gain: 0.1, band: 900, filter: 'bandpass' },
                { kind: 'sweep', freq: 220, endFreq: 80, duration: 0.12, wave: 'sawtooth', gain: 0.09 }
            ]
        },
        bunkerHit: {
            layers: [
                { kind: 'noise', duration: 0.05, gain: 0.07, band: 500, filter: 'lowpass' },
                { kind: 'tone', freq: 110, duration: 0.04, wave: 'triangle', gain: 0.05 }
            ]
        },
        playerHit: {
            layers: [
                { kind: 'sweep', freq: 200, endFreq: 55, duration: 0.25, wave: 'sawtooth', gain: 0.12 },
                { kind: 'noise', duration: 0.2, gain: 0.09, band: 400, filter: 'lowpass' }
            ]
        },
        waveClear: {
            layers: [
                { kind: 'tone', freq: 523, duration: 0.08, wave: 'sine', gain: 0.1 },
                { kind: 'tone', freq: 659, duration: 0.08, wave: 'sine', gain: 0.1, delay: 0.07 },
                { kind: 'tone', freq: 784, duration: 0.08, wave: 'sine', gain: 0.1, delay: 0.14 },
                { kind: 'tone', freq: 1047, duration: 0.14, wave: 'sine', gain: 0.11, delay: 0.21 }
            ]
        },
        ufo: {
            layers: [
                { kind: 'sweep', freq: 140, endFreq: 220, duration: 0.14, wave: 'sine', gain: 0.08 },
                { kind: 'sweep', freq: 220, endFreq: 140, duration: 0.14, wave: 'sine', gain: 0.07, delay: 0.12 }
            ]
        }
    },

    'circuit-breaker': {
        start: {
            layers: [
                { kind: 'tone', freq: 440, duration: 0.07, wave: 'square', gain: 0.09 },
                { kind: 'tone', freq: 554, duration: 0.07, wave: 'square', gain: 0.09, delay: 0.07 },
                { kind: 'tone', freq: 660, duration: 0.1, wave: 'square', gain: 0.1, delay: 0.14 }
            ]
        },
        rotate: {
            layers: [
                { kind: 'tone', freq: 320, duration: 0.025, wave: 'triangle', gain: 0.06 },
                { kind: 'noise', duration: 0.02, gain: 0.025, band: 2000, filter: 'highpass' }
            ]
        },
        energize: {
            layers: [
                { kind: 'sweep', freq: 180, endFreq: 520, duration: 0.1, wave: 'sawtooth', gain: 0.09 },
                { kind: 'noise', duration: 0.06, gain: 0.04, band: 1800, filter: 'bandpass' }
            ]
        },
        powerOn: {
            layers: [
                { kind: 'tone', freq: 523, duration: 0.09, wave: 'sine', gain: 0.1 },
                { kind: 'tone', freq: 784, duration: 0.14, wave: 'sine', gain: 0.11, delay: 0.08 }
            ]
        },
        tick: {
            layers: [
                { kind: 'tone', freq: 880, duration: 0.025, wave: 'square', gain: 0.04 },
                { kind: 'tone', freq: 660, duration: 0.025, wave: 'square', gain: 0.035, delay: 0.03 }
            ]
        },
        fuseBlow: {
            layers: [
                { kind: 'noise', duration: 0.2, gain: 0.12, band: 600, filter: 'bandpass' },
                { kind: 'sweep', freq: 200, endFreq: 50, duration: 0.22, wave: 'sawtooth', gain: 0.11 }
            ]
        },
        levelClear: {
            layers: [
                { kind: 'tone', freq: 659, duration: 0.08, wave: 'sine', gain: 0.1 },
                { kind: 'tone', freq: 784, duration: 0.08, wave: 'sine', gain: 0.1, delay: 0.08 },
                { kind: 'tone', freq: 988, duration: 0.14, wave: 'sine', gain: 0.11, delay: 0.16 }
            ]
        }
    },

    tidehold: {
        start: {
            layers: [
                { kind: 'tone', freq: 196, duration: 0.14, wave: 'sine', gain: 0.14 },
                { kind: 'tone', freq: 247, duration: 0.14, wave: 'sine', gain: 0.13, delay: 0.1 },
                { kind: 'tone', freq: 294, duration: 0.2, wave: 'triangle', gain: 0.14, delay: 0.2 },
                { kind: 'noise', duration: 0.18, gain: 0.05, band: 280, filter: 'lowpass', delay: 0.05 }
            ]
        },
        wave: {
            layers: [
                { kind: 'sweep', freq: 70, endFreq: 180, duration: 0.28, wave: 'sine', gain: 0.14 },
                { kind: 'noise', duration: 0.22, gain: 0.09, band: 380, filter: 'lowpass' },
                { kind: 'tone', freq: 110, duration: 0.18, wave: 'triangle', gain: 0.08, delay: 0.06 }
            ]
        },
        select: {
            layers: [
                { kind: 'tone', freq: 520, duration: 0.04, wave: 'triangle', gain: 0.08 },
                { kind: 'tone', freq: 690, duration: 0.05, wave: 'triangle', gain: 0.07, delay: 0.03 }
            ]
        },
        build: {
            layers: [
                { kind: 'tone', freq: 280, duration: 0.05, wave: 'triangle', gain: 0.1 },
                { kind: 'tone', freq: 420, duration: 0.07, wave: 'triangle', gain: 0.11, delay: 0.04 },
                { kind: 'tone', freq: 560, duration: 0.1, wave: 'sine', gain: 0.1, delay: 0.09 },
                { kind: 'noise', duration: 0.08, gain: 0.05, band: 900, filter: 'bandpass', delay: 0.02 }
            ]
        },
        deny: {
            layers: [
                { kind: 'tone', freq: 180, duration: 0.08, wave: 'square', gain: 0.08 },
                { kind: 'tone', freq: 140, duration: 0.1, wave: 'square', gain: 0.07, delay: 0.07 }
            ]
        },
        specialize: {
            layers: [
                { kind: 'tone', freq: 392, duration: 0.07, wave: 'sine', gain: 0.11 },
                { kind: 'tone', freq: 494, duration: 0.07, wave: 'sine', gain: 0.11, delay: 0.06 },
                { kind: 'tone', freq: 587, duration: 0.12, wave: 'triangle', gain: 0.12, delay: 0.12 },
                { kind: 'sweep', freq: 300, endFreq: 720, duration: 0.14, wave: 'sine', gain: 0.07, delay: 0.08 }
            ]
        },
        upgrade: {
            layers: [
                { kind: 'tone', freq: 523, duration: 0.07, wave: 'sine', gain: 0.12 },
                { kind: 'tone', freq: 659, duration: 0.09, wave: 'sine', gain: 0.12, delay: 0.06 },
                { kind: 'tone', freq: 784, duration: 0.14, wave: 'triangle', gain: 0.11, delay: 0.13 }
            ]
        },
        beacon: {
            layers: [
                { kind: 'sweep', freq: 1200, endFreq: 380, duration: 0.1, wave: 'sine', gain: 0.11 },
                { kind: 'tone', freq: 880, duration: 0.05, wave: 'triangle', gain: 0.07 },
                { kind: 'noise', duration: 0.04, gain: 0.035, band: 2500, filter: 'highpass' }
            ]
        },
        mortar: {
            layers: [
                { kind: 'sweep', freq: 220, endFreq: 70, duration: 0.16, wave: 'triangle', gain: 0.13 },
                { kind: 'noise', duration: 0.1, gain: 0.07, band: 450, filter: 'lowpass' },
                { kind: 'tone', freq: 90, duration: 0.12, wave: 'sine', gain: 0.08 }
            ]
        },
        splash: {
            layers: [
                { kind: 'noise', duration: 0.2, gain: 0.14, band: 650, filter: 'bandpass' },
                { kind: 'tone', freq: 180, duration: 0.14, wave: 'sine', gain: 0.1 },
                { kind: 'sweep', freq: 320, endFreq: 90, duration: 0.16, wave: 'triangle', gain: 0.08, delay: 0.02 }
            ]
        },
        whirlpool: {
            layers: [
                { kind: 'sweep', freq: 140, endFreq: 90, duration: 0.18, wave: 'sine', gain: 0.09 },
                { kind: 'noise', duration: 0.16, gain: 0.07, band: 320, filter: 'lowpass' },
                { kind: 'tone', freq: 60, duration: 0.14, wave: 'triangle', gain: 0.07 }
            ]
        },
        hit: {
            layers: [
                { kind: 'tone', freq: 480, duration: 0.05, wave: 'square', gain: 0.08 },
                { kind: 'noise', duration: 0.06, gain: 0.055, band: 1400, filter: 'highpass' }
            ]
        },
        kill: {
            layers: [
                { kind: 'noise', duration: 0.16, gain: 0.12, band: 550, filter: 'bandpass' },
                { kind: 'sweep', freq: 280, endFreq: 70, duration: 0.18, wave: 'sine', gain: 0.11 },
                { kind: 'tone', freq: 160, duration: 0.1, wave: 'triangle', gain: 0.07, delay: 0.04 }
            ]
        },
        leak: {
            layers: [
                { kind: 'sweep', freq: 200, endFreq: 55, duration: 0.28, wave: 'sawtooth', gain: 0.13 },
                { kind: 'noise', duration: 0.22, gain: 0.1, band: 320, filter: 'lowpass' },
                { kind: 'tone', freq: 90, duration: 0.18, wave: 'sine', gain: 0.08, delay: 0.05 }
            ]
        },
        waveClear: {
            layers: [
                { kind: 'tone', freq: 392, duration: 0.09, wave: 'sine', gain: 0.13 },
                { kind: 'tone', freq: 494, duration: 0.09, wave: 'sine', gain: 0.13, delay: 0.08 },
                { kind: 'tone', freq: 587, duration: 0.16, wave: 'sine', gain: 0.14, delay: 0.16 },
                { kind: 'noise', duration: 0.12, gain: 0.04, band: 800, filter: 'bandpass', delay: 0.1 }
            ]
        },
        victory: {
            layers: [
                { kind: 'tone', freq: 392, duration: 0.12, wave: 'sine', gain: 0.13 },
                { kind: 'tone', freq: 494, duration: 0.12, wave: 'sine', gain: 0.13, delay: 0.1 },
                { kind: 'tone', freq: 587, duration: 0.12, wave: 'sine', gain: 0.13, delay: 0.2 },
                { kind: 'tone', freq: 784, duration: 0.24, wave: 'triangle', gain: 0.15, delay: 0.3 },
                { kind: 'sweep', freq: 200, endFreq: 600, duration: 0.25, wave: 'sine', gain: 0.06, delay: 0.15 }
            ]
        }
    }
};

function getGameSoundProfile(gameId, event) {
    const game = GAME_SOUND_PROFILES[gameId];
    if (!game) return null;
    return game[event] || null;
}
