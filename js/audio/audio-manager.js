/**
 * Lightweight audio manager using Web Audio API with procedural fallback tones.
 * Supports optional file-based sounds under assets/audio/.
 */
class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.muted = false;
        this.volume = 0.5;
        this.unlocked = false;
        this.currentMusic = null;
        this.bufferCache = new Map();
        this.failedBuffers = new Set();
        // No file-based audio shipped yet — use procedural tones to avoid 404 spam
        this.fileAudioEnabled = false;

        const savedMute = localStorage.getItem('retroArcadeMuted');
        const savedVolume = localStorage.getItem('retroArcadeVolume');
        if (savedMute !== null) this.muted = savedMute === 'true';
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

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.unlocked = true;
    }

    applyVolume() {
        if (!this.masterGain) return;
        const v = this.muted ? 0 : this.volume;
        this.masterGain.gain.value = v;
        this.musicGain.gain.value = 0.4;
        this.sfxGain.gain.value = 0.8;
    }

    setMuted(muted) {
        this.muted = muted;
        localStorage.setItem('retroArcadeMuted', String(muted));
        this.applyVolume();
        if (muted) this.stopMusic();
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        localStorage.setItem('retroArcadeVolume', String(this.volume));
        this.applyVolume();
    }

    isMuted() {
        return this.muted;
    }

    async loadBuffer(path) {
        if (!this.fileAudioEnabled) return null;
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

        const filePath = options.path || `assets/audio/sfx/${name}.wav`;
        const buffer = await this.loadBuffer(filePath);
        if (buffer) {
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.sfxGain);
            source.start();
            return;
        }

        this.playProceduralSfx(name);
    }

    playProceduralSfx(name) {
        const tones = {
            click: () => this.playTone(800, 0.05, 'square', 0.1),
            start: () => { this.playTone(440, 0.08); setTimeout(() => this.playTone(660, 0.12), 80); },
            score: () => this.playTone(880, 0.1, 'sine', 0.12),
            powerup: () => { this.playTone(523, 0.06); setTimeout(() => this.playTone(784, 0.1), 60); },
            hit: () => this.playTone(200, 0.08, 'sawtooth', 0.1),
            break: () => this.playTone(300, 0.06, 'square', 0.12),
            lineClear: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => this.playTone(f, 0.1, 'sine', 0.1), i * 80)); },
            gameOver: () => { this.playTone(400, 0.15); setTimeout(() => this.playTone(300, 0.2), 150); setTimeout(() => this.playTone(200, 0.3), 300); },
            jump: () => this.playTone(600, 0.08, 'sine', 0.1),
            engine: () => this.playTone(120, 0.05, 'sawtooth', 0.06),
            putt: () => this.playTone(350, 0.06, 'sine', 0.1),
            sink: () => this.playTone(660, 0.15, 'sine', 0.12)
        };

        if (tones[name]) tones[name]();
    }

    async playGameSfx(gameId, event) {
        if (this.muted) return;
        if (!this.ctx) await this.unlock();
        if (!this.ctx || this.muted) return;

        const path = `assets/audio/games/${gameId}/${event}.wav`;
        const buffer = await this.loadBuffer(path);
        if (buffer) {
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.sfxGain);
            source.start();
            return;
        }

        const profile = typeof getGameSoundProfile !== 'undefined'
            ? getGameSoundProfile(gameId, event)
            : null;
        if (profile) {
            this.playProfileSound(profile);
            return;
        }

        this.playProceduralSfx(event);
    }

    playProfileSound(profile) {
        const { frequencies, duration, type, gain } = profile;
        frequencies.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, duration, type, gain), i * Math.max(40, duration * 700));
        });
    }

    async playMusic(path, loop = true) {
        if (this.muted || !this.ctx) return;
        this.stopMusic();

        const buffer = await this.loadBuffer(path);
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        source.connect(this.musicGain);
        source.start();
        this.currentMusic = source;
    }

    stopMusic() {
        if (this.currentMusic) {
            try { this.currentMusic.stop(); } catch { /* already stopped */ }
            this.currentMusic = null;
        }
    }

    playLobbyAmbient() {
        if (this.muted || !this.fileAudioEnabled) return;
        this.playMusic('assets/audio/lobby-ambient.wav').catch(() => {});
    }
}

const audioManager = new AudioManager();
