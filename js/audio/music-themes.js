/**
 * Soft ambient themes with real melodies and long loops.
 * Patterns use scale degrees or null rests. 64 steps ≈ 4 bars of 16ths.
 */
const MUSIC_THEMES = {
    lobby: {
        bpm: 52,
        steps: 64,
        scale: [0, 2, 3, 5, 7, 8, 10], // natural minor
        root: 110,
        volume: 0.05,
        tracks: {
            bass: {
                wave: 'sine',
                gain: 0.26,
                pattern: [
                    0, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    5, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    3, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null
                ]
            },
            arp: {
                wave: 'sine',
                gain: 0.07,
                pattern: [
                    0, null, 2, null, 4, null, 2, null,
                    0, null, 2, null, 4, null, 5, null,
                    5, null, 4, null, 2, null, 0, null,
                    2, null, 4, null, 5, null, 4, null,
                    3, null, 5, null, 7, null, 5, null,
                    3, null, 5, null, 4, null, 2, null,
                    4, null, 5, null, 7, null, 5, null,
                    4, null, 2, null, 0, null, 2, null
                ]
            },
            lead: {
                wave: 'triangle',
                gain: 0.09,
                pattern: [
                    4, null, null, 5, 7, null, null, null,
                    null, null, 5, null, 4, null, 2, null,
                    0, null, null, null, null, null, 2, null,
                    4, null, null, 5, 4, null, null, null,
                    7, null, null, 5, 4, null, null, null,
                    null, null, 5, null, 7, null, 9, null,
                    7, null, null, 5, 4, null, 2, null,
                    0, null, null, null, null, null, null, null
                ]
            }
        }
    },

    breakout: {
        bpm: 58,
        steps: 64,
        scale: [0, 2, 4, 5, 7, 9, 11], // major
        root: 98,
        volume: 0.048,
        tracks: {
            bass: {
                wave: 'sine',
                gain: 0.24,
                pattern: [
                    0, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    5, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    0, null, null, null, null, null, null, null,
                    2, null, null, null, null, null, null, null,
                    5, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null
                ]
            },
            arp: {
                wave: 'sine',
                gain: 0.06,
                pattern: [
                    0, null, 2, null, 4, null, null, null,
                    4, null, 5, null, 7, null, null, null,
                    5, null, 4, null, 2, null, null, null,
                    4, null, 2, null, 0, null, null, null,
                    0, null, 2, null, 4, null, 5, null,
                    2, null, 4, null, 5, null, 7, null,
                    5, null, 7, null, 5, null, 4, null,
                    2, null, 4, null, 2, null, 0, null
                ]
            },
            lead: {
                wave: 'triangle',
                gain: 0.1,
                pattern: [
                    4, null, null, null, 5, null, 7, null,
                    null, null, 9, null, 7, null, null, null,
                    5, null, null, 4, 5, null, null, null,
                    4, null, 2, null, 0, null, null, null,
                    7, null, null, null, 5, null, 4, null,
                    null, null, 5, null, 7, null, 9, null,
                    7, null, null, 5, 4, null, 2, null,
                    4, null, null, null, null, null, null, null
                ]
            }
        }
    },

    jezzball: {
        bpm: 54,
        steps: 64,
        scale: [0, 2, 3, 5, 7, 8, 10],
        root: 92,
        volume: 0.048,
        tracks: {
            bass: {
                wave: 'sine',
                gain: 0.25,
                pattern: [
                    0, null, null, null, null, null, null, null,
                    null, null, null, null, 5, null, null, null,
                    3, null, null, null, null, null, null, null,
                    null, null, null, null, 4, null, null, null,
                    0, null, null, null, null, null, null, null,
                    null, null, null, null, 7, null, null, null,
                    5, null, null, null, null, null, null, null,
                    4, null, null, null, 2, null, null, null
                ]
            },
            arp: {
                wave: 'sine',
                gain: 0.06,
                pattern: [
                    0, null, null, 2, 4, null, null, 2,
                    0, null, null, 2, 5, null, null, 4,
                    3, null, null, 5, 7, null, null, 5,
                    3, null, null, 4, 5, null, null, 4,
                    0, null, null, 2, 4, null, null, 5,
                    7, null, null, 5, 4, null, null, 2,
                    5, null, null, 4, 2, null, null, 0,
                    2, null, null, 4, 2, null, null, 0
                ]
            },
            lead: {
                wave: 'triangle',
                gain: 0.095,
                pattern: [
                    null, null, 4, null, null, 5, 7, null,
                    null, null, null, null, 5, null, 4, null,
                    2, null, null, null, 0, null, null, null,
                    null, null, 2, null, 4, null, null, null,
                    7, null, null, 5, null, null, 4, null,
                    null, null, 5, null, 7, null, 8, null,
                    7, null, null, null, 5, null, 4, null,
                    2, null, null, 0, null, null, null, null
                ]
            }
        }
    },

    'rivet-rage': {
        bpm: 60,
        steps: 64,
        scale: [0, 2, 3, 5, 7, 8, 10],
        root: 82,
        volume: 0.05,
        tracks: {
            bass: {
                wave: 'triangle',
                gain: 0.22,
                pattern: [
                    0, null, null, null, 0, null, null, null,
                    3, null, null, null, null, null, null, null,
                    5, null, null, null, 5, null, null, null,
                    4, null, null, null, null, null, null, null,
                    0, null, null, null, 0, null, null, null,
                    7, null, null, null, null, null, null, null,
                    5, null, null, null, 3, null, null, null,
                    4, null, null, null, null, null, null, null
                ]
            },
            arp: {
                wave: 'sine',
                gain: 0.055,
                pattern: [
                    0, null, 3, null, 5, null, 3, null,
                    0, null, 3, null, 5, null, 7, null,
                    5, null, 3, null, 0, null, 3, null,
                    4, null, 5, null, 4, null, 2, null,
                    0, null, 3, null, 5, null, 7, null,
                    5, null, 7, null, 8, null, 7, null,
                    5, null, 3, null, 5, null, 3, null,
                    0, null, 2, null, 3, null, 0, null
                ]
            },
            lead: {
                wave: 'triangle',
                gain: 0.1,
                pattern: [
                    7, null, null, null, 5, null, null, 3,
                    null, null, 5, null, 7, null, null, null,
                    8, null, null, 7, 5, null, null, null,
                    null, null, 4, null, 5, null, null, null,
                    7, null, null, null, 10, null, null, 8,
                    null, null, 7, null, 5, null, null, null,
                    3, null, null, 5, 7, null, 5, null,
                    0, null, null, null, null, null, null, null
                ]
            }
        }
    },

    tetris: {
        bpm: 56,
        steps: 64,
        scale: [0, 2, 4, 5, 7, 9, 11],
        root: 131,
        volume: 0.048,
        tracks: {
            bass: {
                wave: 'sine',
                gain: 0.24,
                pattern: [
                    0, null, null, null, null, null, null, null,
                    0, null, null, null, 4, null, null, null,
                    5, null, null, null, null, null, null, null,
                    5, null, null, null, 4, null, null, null,
                    0, null, null, null, null, null, null, null,
                    2, null, null, null, 4, null, null, null,
                    5, null, null, null, 4, null, null, null,
                    2, null, null, null, 0, null, null, null
                ]
            },
            arp: {
                wave: 'sine',
                gain: 0.06,
                pattern: [
                    0, null, 2, null, 4, null, 0, null,
                    0, null, 2, null, 4, null, 5, null,
                    5, null, 4, null, 2, null, 0, null,
                    4, null, 5, null, 7, null, 5, null,
                    0, null, 2, null, 4, null, 5, null,
                    2, null, 4, null, 5, null, 7, null,
                    5, null, 7, null, 5, null, 4, null,
                    2, null, 4, null, 2, null, 0, null
                ]
            },
            lead: {
                wave: 'triangle',
                gain: 0.1,
                pattern: [
                    4, null, 5, null, 7, null, null, null,
                    7, null, 9, null, 7, null, 5, null,
                    4, null, null, 5, 4, null, 2, null,
                    0, null, null, null, null, null, null, null,
                    4, null, 5, null, 7, null, null, null,
                    9, null, 7, null, 5, null, 4, null,
                    5, null, null, 4, 2, null, 0, null,
                    2, null, null, null, 0, null, null, null
                ]
            }
        }
    },

    'mouse-pacman': {
        bpm: 58,
        steps: 64,
        scale: [0, 2, 3, 5, 7, 9, 10],
        root: 123,
        volume: 0.048,
        tracks: {
            bass: {
                wave: 'sine',
                gain: 0.23,
                pattern: [
                    0, null, null, null, null, null, null, null,
                    3, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    0, null, null, null, null, null, null, null,
                    5, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    3, null, null, null, null, null, null, null,
                    0, null, null, null, null, null, null, null
                ]
            },
            arp: {
                wave: 'sine',
                gain: 0.06,
                pattern: [
                    0, null, 2, null, 4, null, 2, null,
                    3, null, 5, null, 7, null, 5, null,
                    4, null, 5, null, 7, null, 5, null,
                    4, null, 2, null, 0, null, 2, null,
                    5, null, 4, null, 2, null, 0, null,
                    4, null, 5, null, 7, null, 9, null,
                    7, null, 5, null, 4, null, 2, null,
                    0, null, 2, null, 3, null, 0, null
                ]
            },
            lead: {
                wave: 'triangle',
                gain: 0.095,
                pattern: [
                    7, null, null, 5, 4, null, null, null,
                    null, null, 5, null, 7, null, 9, null,
                    7, null, null, null, 5, null, 4, null,
                    2, null, null, 0, null, null, null, null,
                    4, null, null, 5, 7, null, null, null,
                    9, null, 7, null, 5, null, null, null,
                    4, null, null, 2, 4, null, 5, null,
                    0, null, null, null, null, null, null, null
                ]
            }
        }
    },

    minigolf: {
        bpm: 48,
        steps: 64,
        scale: [0, 2, 4, 5, 7, 9, 11],
        root: 87,
        volume: 0.045,
        tracks: {
            bass: {
                wave: 'sine',
                gain: 0.28,
                pattern: [
                    0, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    5, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    2, null, null, null, null, null, null, null
                ]
            },
            arp: {
                wave: 'sine',
                gain: 0.055,
                pattern: [
                    0, null, null, null, 2, null, null, null,
                    4, null, null, null, 2, null, null, null,
                    4, null, null, null, 5, null, null, null,
                    7, null, null, null, 5, null, null, null,
                    5, null, null, null, 4, null, null, null,
                    2, null, null, null, 0, null, null, null,
                    4, null, null, null, 5, null, null, null,
                    4, null, null, null, 2, null, null, null
                ]
            },
            lead: {
                wave: 'sine',
                gain: 0.09,
                pattern: [
                    null, null, null, null, 4, null, null, 5,
                    7, null, null, null, null, null, null, null,
                    null, null, 5, null, 4, null, null, null,
                    2, null, null, null, 0, null, null, null,
                    null, null, null, null, 7, null, null, 5,
                    4, null, null, null, null, null, 5, null,
                    7, null, null, 9, 7, null, 5, null,
                    4, null, null, null, null, null, null, null
                ]
            }
        }
    },

    'space-invaders': {
        bpm: 50,
        steps: 64,
        scale: [0, 2, 3, 5, 7, 8, 10],
        root: 73,
        volume: 0.048,
        tracks: {
            bass: {
                wave: 'sine',
                gain: 0.28,
                pattern: [
                    0, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    0, null, null, null, null, null, null, null,
                    3, null, null, null, null, null, null, null,
                    5, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    2, null, null, null, null, null, null, null
                ]
            },
            arp: {
                wave: 'sine',
                gain: 0.05,
                pattern: [
                    0, null, null, 3, null, null, 5, null,
                    null, null, 3, null, null, null, 0, null,
                    0, null, null, 3, null, null, 5, null,
                    null, null, 7, null, null, null, 5, null,
                    5, null, null, 3, null, null, 0, null,
                    null, null, 2, null, null, null, 3, null,
                    4, null, null, 5, null, null, 4, null,
                    null, null, 2, null, null, null, 0, null
                ]
            },
            lead: {
                wave: 'triangle',
                gain: 0.09,
                pattern: [
                    null, null, null, null, 7, null, null, null,
                    5, null, null, 3, null, null, null, null,
                    null, null, 5, null, 7, null, 8, null,
                    7, null, null, null, null, null, null, null,
                    null, null, null, null, 5, null, null, null,
                    3, null, null, 0, null, null, null, null,
                    null, null, 2, null, 3, null, 5, null,
                    3, null, null, null, 0, null, null, null
                ]
            }
        }
    },

    'circuit-breaker': {
        bpm: 54,
        steps: 64,
        scale: [0, 2, 4, 6, 7, 9, 11], // lydian-ish
        root: 104,
        volume: 0.048,
        tracks: {
            bass: {
                wave: 'sine',
                gain: 0.24,
                pattern: [
                    0, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    6, null, null, null, null, null, null, null,
                    4, null, null, null, null, null, null, null,
                    0, null, null, null, null, null, null, null,
                    2, null, null, null, null, null, null, null,
                    7, null, null, null, null, null, null, null,
                    6, null, null, null, 4, null, null, null
                ]
            },
            arp: {
                wave: 'sine',
                gain: 0.055,
                pattern: [
                    0, null, 2, null, 4, null, 6, null,
                    4, null, 6, null, 7, null, 6, null,
                    6, null, 4, null, 2, null, 0, null,
                    2, null, 4, null, 6, null, 4, null,
                    0, null, 2, null, 4, null, 6, null,
                    7, null, 6, null, 4, null, 2, null,
                    7, null, 9, null, 7, null, 6, null,
                    4, null, 6, null, 4, null, 0, null
                ]
            },
            lead: {
                wave: 'triangle',
                gain: 0.095,
                pattern: [
                    6, null, null, null, 7, null, 9, null,
                    null, null, 7, null, 6, null, null, null,
                    4, null, null, 6, 7, null, null, null,
                    6, null, 4, null, 2, null, null, null,
                    7, null, null, null, 6, null, 4, null,
                    null, null, 6, null, 7, null, 9, null,
                    11, null, 9, null, 7, null, 6, null,
                    4, null, null, null, null, null, null, null
                ]
            }
        }
    }
};

function getMusicTheme(themeId) {
    return MUSIC_THEMES[themeId] || MUSIC_THEMES.lobby;
}
