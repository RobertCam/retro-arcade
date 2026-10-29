/**
 * Audio manager: procedural music + richer procedural SFX.
 * Optional file-based sounds under assets/audio/ remain supported but off by default.
 */
class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.muted = false;
        this.musicMuted = false;
        this.volume = 0.5;
        this.unlocked = false;
        this.currentMusic = null;
        this.musicSources = new Set(); // all live music BufferSources (prevents orphans)
        this.playingThemeId = null;
        this.bufferCache = new Map();
        this.failedBuffers = new Set();
        // File music/SFX under assets/audio/; procedural is fallback
        this.fileAudioEnabled = true;
        this.fileMusicEnabled = true;
        this.activeTheme = null;
        this._themeRequestId = 0;

        const savedMute = localStorage.getItem('retroArcadeMuted');
        const savedMusicMute = localStorage.getItem('retroArcadeMusicMuted');
        const savedVolume = localStorage.getItem('retroArcadeVolume');
        if (savedMute !== null) this.muted = savedMute === 'true';
        if (savedMusicMute !== null) this.musicMuted = savedMusicMute === 'true';
        if (savedVolume !== null) this.volume = parseFloat(savedVolume) || 0.5;
    }

    async unlock() {
        if (this.unlocked) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();

        this.masterGain.connect(this.ctx.destination);
        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.applyVolume();

        if (typeof proceduralMusic !== 'undefined') {
            proceduralMusic.attach(this.ctx, this.musicGain);
            proceduralMusic.setMuted(this.muted || this.musicMuted);
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.unlocked = true;
    }

    applyVolume() {
        if (!this.masterGain) return;
        const v = this.muted ? 0 : this.volume;
        this.masterGain.gain.value = v;
        this.musicGain.gain.value = (this.musicMuted || this.muted) ? 0 : 0.55;
        this.sfxGain.gain.value = 0.85;
    }

    setMuted(muted) {
        this.muted = muted;
        localStorage.setItem('retroArcadeMuted', String(muted));
        this.applyVolume();
        if (typeof proceduralMusic !== 'undefined') {
            proceduralMusic.setMuted(muted || this.musicMuted);
        }
        if (muted || this.musicMuted) {
            this.stopMusic();
        } else if (this.activeTheme) {
            this.playTheme(this.activeTheme);
        }
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    setMusicMuted(muted) {
        this.musicMuted = muted;
        localStorage.setItem('retroArcadeMusicMuted', String(muted));
        this.applyVolume();
        if (typeof proceduralMusic !== 'undefined') {
            proceduralMusic.setMuted(this.muted || muted);
        }
        if (muted || this.muted) {
            this.stopMusic();
        } else if (this.activeTheme) {
            this.playTheme(this.activeTheme);
        }
    }

    toggleMusicMute() {
        this.setMusicMuted(!this.musicMuted);
        return this.musicMuted;
    }

    isMusicMuted() {
        return this.musicMuted;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        localStorage.setItem('retroArcadeVolume', String(this.volume));
        this.applyVolume();
    }

    isMuted() {
        return this.muted;
    }

    async loadBuffer(path, { force = false } = {}) {
        if (!force && !this.fileAudioEnabled) return null;
        if (this.failedBuffers.has(path)) return null;
        if (this.bufferCache.has(path)) {
            return this.bufferCache.get(path);
        }
        try {
            const response = await fetch(path);
            if (!response.ok) {
                this.failedBuffers.add(path);
                return null;
            }
            if (!this.ctx) await this.unlock();
            const arrayBuffer = await response.arrayBuffer();
            const buffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.bufferCache.set(path, buffer);
            return buffer;
        } catch {
            this.failedBuffers.add(path);
            return null;
        }
    }

    playTone(frequency, duration = 0.1, type = 'square', gain = 0.15) {
        if (this.muted || !this.ctx) return;
        if (typeof sfxSynth !== 'undefined') {
            sfxSynth.play(this.ctx, this.sfxGain, {
                kind: 'tone',
                freq: frequency,
                duration,
                wave: type,
                gain
            });
            return;
        }

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gainNode.gain.value = gain;
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    async playSfx(name, options = {}) {
        if (this.muted) return;
        if (!this.ctx) await this.unlock();
        if (!this.ctx || this.muted) return;

        const candidates = options.path
            ? [options.path]
            : [`assets/audio/sfx/${name}.ogg`, `assets/audio/sfx/${name}.wav`];

        for (const filePath of candidates) {
            const buffer = await this.loadBuffer(filePath, { force: true });
            if (buffer) {
                const source = this.ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(this.sfxGain);
                source.start();
                return;
            }
        }

        this.playProceduralSfx(name);
    }

    playProceduralSfx(name) {
        const patches = {
            click: {
                layers: [
                    { kind: 'tone', freq: 900, duration: 0.04, wave: 'square', gain: 0.08 },
                    { kind: 'noise', duration: 0.02, gain: 0.03, band: 4000, filter: 'highpass' }
                ]
            },
            start: {
                layers: [
                    { kind: 'tone', freq: 440, duration: 0.08, wave: 'square', gain: 0.09 },
                    { kind: 'tone', freq: 660, duration: 0.12, wave: 'square', gain: 0.1, delay: 0.08 }
                ]
            },
            score: {
                layers: [
                    { kind: 'tone', freq: 880, duration: 0.1, wave: 'sine', gain: 0.11 }
                ]
            },
            powerup: {
                layers: [
                    { kind: 'tone', freq: 523, duration: 0.06, wave: 'sine', gain: 0.09 },
                    { kind: 'tone', freq: 784, duration: 0.1, wave: 'sine', gain: 0.1, delay: 0.06 }
                ]
            },
            hit: {
                layers: [
                    { kind: 'noise', duration: 0.06, gain: 0.09, band: 700, filter: 'bandpass' },
                    { kind: 'sweep', freq: 220, endFreq: 90, duration: 0.08, wave: 'sawtooth', gain: 0.08 }
                ]
            },
            break: {
                layers: [
                    { kind: 'noise', duration: 0.07, gain: 0.1, band: 1800, filter: 'bandpass' },
                    { kind: 'sweep', freq: 400, endFreq: 140, duration: 0.08, wave: 'square', gain: 0.08 }
                ]
            },
            lineClear: {
                layers: [
                    { kind: 'tone', freq: 523, duration: 0.08, wave: 'sine', gain: 0.09 },
                    { kind: 'tone', freq: 659, duration: 0.08, wave: 'sine', gain: 0.09, delay: 0.07 },
                    { kind: 'tone', freq: 784, duration: 0.12, wave: 'sine', gain: 0.1, delay: 0.14 }
                ]
            },
            gameOver: {
                layers: [
                    { kind: 'tone', freq: 392, duration: 0.14, wave: 'square', gain: 0.1 },
                    { kind: 'tone', freq: 311, duration: 0.18, wave: 'square', gain: 0.1, delay: 0.14 },
                    { kind: 'sweep', freq: 247, endFreq: 80, duration: 0.32, wave: 'sawtooth', gain: 0.11, delay: 0.3 },
                    { kind: 'noise', duration: 0.25, gain: 0.06, band: 350, filter: 'lowpass', delay: 0.35 }
                ]
            },
            jump: {
                layers: [
                    { kind: 'sweep', freq: 280, endFreq: 620, duration: 0.1, wave: 'sine', gain: 0.1 }
                ]
            },
            engine: {
                layers: [
                    { kind: 'tone', freq: 120, duration: 0.05, wave: 'sawtooth', gain: 0.05 }
                ]
            },
            putt: {
                layers: [
                    { kind: 'sweep', freq: 380, endFreq: 160, duration: 0.06, wave: 'sine', gain: 0.09 }
                ]
            },
            sink: {
                layers: [
                    { kind: 'tone', freq: 660, duration: 0.1, wave: 'sine', gain: 0.1 },
                    { kind: 'tone', freq: 880, duration: 0.12, wave: 'sine', gain: 0.1, delay: 0.08 }
                ]
            }
        };

        const patch = patches[name];
        if (patch && typeof sfxSynth !== 'undefined') {
            sfxSynth.play(this.ctx, this.sfxGain, patch);
            return;
        }
        if (patch) {
            // Minimal fallback without sfxSynth
            this.playTone(440, 0.08, 'square', 0.1);
        }
    }

    async playGameSfx(gameId, event) {
        if (this.muted) return;
        if (!this.ctx) await this.unlock();
        if (!this.ctx || this.muted) return;

        // Prefer procedural profile immediately when no file SFX exist yet —
        // avoids 404 latency on every shot (Tidehold ships music-only assets).
        const profile = typeof getGameSoundProfile !== 'undefined'
            ? getGameSoundProfile(gameId, event)
            : null;

        const candidates = [
            `assets/audio/games/${gameId}/${event}.ogg`,
            `assets/audio/games/${gameId}/${event}.wav`
        ];
        const anyCached = candidates.some((path) => this.bufferCache.has(path));
        const allFailed = candidates.every((path) => this.failedBuffers.has(path));

        if (!allFailed || anyCached) {
            for (const path of candidates) {
                const buffer = await this.loadBuffer(path, { force: true });
                if (buffer) {
                    const source = this.ctx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(this.sfxGain);
                    source.start();
                    return;
                }
            }
        }

        if (profile) {
            this.playProfileSound(profile);
            return;
        }

        this.playProceduralSfx(event);
    }

    playProfileSound(profile) {
        if (!this.ctx || this.muted) return;
        if (typeof sfxSynth !== 'undefined') {
            const patch = sfxSynth.fromLegacyProfile(profile);
            sfxSynth.play(this.ctx, this.sfxGain, patch);
            return;
        }

        const { frequencies, duration, type, gain } = profile;
        frequencies.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, duration, type, gain), i * Math.max(40, duration * 700));
        });
    }

    musicCandidatesFor(themeId) {
        const files = [
            `assets/audio/music/${themeId}.mp3`,
            `assets/audio/music/${themeId}.ogg`,
            `assets/audio/games/${themeId}/music.mp3`,
            `assets/audio/games/${themeId}/music.ogg`
        ];
        if (themeId === 'lobby') {
            files.push('assets/audio/lobby-ambient.mp3', 'assets/audio/lobby-ambient.ogg');
        }
        return files;
    }

    playTheme(themeId) {
        // Already playing this theme — leave it alone
        if (
            this.playingThemeId === themeId &&
            this.currentMusic &&
            this.activeTheme === themeId &&
            !this.muted &&
            !this.musicMuted
        ) {
            return;
        }

        // Claim the desired theme synchronously so stale async loads bail out
        this.activeTheme = themeId;
        const requestId = ++this._themeRequestId;

        // Always kill currently audible music before switching (incl. lobby → game)
        this.stopMusic();

        if (this.muted || this.musicMuted) return;

        if (!this.unlocked || !this.ctx) {
            this.unlock().then(() => {
                if (this.activeTheme === themeId && this._themeRequestId === requestId) {
                    this._playThemeAsync(themeId, requestId);
                }
            });
            return;
        }

        this._playThemeAsync(themeId, requestId);
    }

    isLobbyMusicPlaying() {
        return this.playingThemeId === 'lobby' && !!this.currentMusic;
    }

    _startMusicSource(buffer, themeId, requestId) {
        if (requestId !== this._themeRequestId) return false;
        if (this.activeTheme !== themeId) return false;
        if (this.muted || this.musicMuted) return false;
        if (!this.ctx || !this.musicGain) return false;

        // Belt-and-suspenders: never overlap file music
        this.stopFileMusic();

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(this.musicGain);
        source.onended = () => {
            this.musicSources.delete(source);
            if (this.currentMusic === source) this.currentMusic = null;
        };
        source.start();
        this.musicSources.add(source);
        this.currentMusic = source;
        this.playingThemeId = themeId;
        return true;
    }

    async _playThemeAsync(themeId, requestId) {
        if (this.muted || this.musicMuted) return;
        if (requestId !== this._themeRequestId) return;
        if (this.activeTheme !== themeId) return;

        if (this.fileMusicEnabled) {
            for (const path of this.musicCandidatesFor(themeId)) {
                if (requestId !== this._themeRequestId || this.activeTheme !== themeId) return;
                const buffer = await this.loadBuffer(path, { force: true });
                if (!buffer) continue;
                if (this._startMusicSource(buffer, themeId, requestId)) return;
                return; // stale — don't keep trying candidates
            }
        }

        if (requestId !== this._themeRequestId || this.activeTheme !== themeId) return;

        // Procedural fallback if a file is missing
        if (typeof proceduralMusic !== 'undefined') {
            proceduralMusic.attach(this.ctx, this.musicGain);
            proceduralMusic.setMuted(false);
            proceduralMusic.play(themeId);
            this.playingThemeId = themeId;
        }
    }

    async playMusic(path, loop = true) {
        if (this.muted || this.musicMuted || !this.ctx) return;
        const requestId = ++this._themeRequestId;
        this.stopMusic();

        const buffer = await this.loadBuffer(path, { force: true });
        if (!buffer) return;
        if (requestId !== this._themeRequestId) return;
        this._startMusicSource(buffer, this.activeTheme, requestId);
    }

    stopFileMusic() {
        // Stop every tracked source so a lost reference can't keep lobby audio alive
        for (const source of this.musicSources) {
            try { source.stop(); } catch { /* already stopped */ }
            try { source.disconnect(); } catch { /* already disconnected */ }
        }
        this.musicSources.clear();
        this.currentMusic = null;
        this.playingThemeId = null;
    }

    stopMusic() {
        this.stopFileMusic();
        if (typeof proceduralMusic !== 'undefined') {
            proceduralMusic.stop(true);
        }
    }

    playLobbyAmbient() {
        this.playTheme('lobby');
    }

    playGameMusic(gameId) {
        this.playTheme(gameId || 'lobby');
    }

    /** Warm music buffers so theme switches are snappy. */
    async preloadMusicThemes(themeIds) {
        if (!this.fileMusicEnabled) return;
        if (!this.ctx) await this.unlock();
        const ids = themeIds || [
            'lobby', 'breakout', 'jezzball', 'rivet-rage', 'tetris',
            'mouse-pacman', 'minigolf', 'space-invaders', 'circuit-breaker', 'tidehold'
        ];
        await Promise.all(ids.map(async (id) => {
            for (const path of this.musicCandidatesFor(id)) {
                const buffer = await this.loadBuffer(path, { force: true });
                if (buffer) break;
            }
        }));
    }
}

const audioManager = new AudioManager();
