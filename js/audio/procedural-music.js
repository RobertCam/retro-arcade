/**
 * Look-ahead chiptune sequencer using Web Audio.
 * Themes come from MUSIC_THEMES / getMusicTheme().
 */
class ProceduralMusicEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.themeId = null;
        this.theme = null;
        this.playing = false;
        this.muted = false;
        this.step = 0;
        this.nextNoteTime = 0;
        this.timerId = null;
        this.lookahead = 0.12;
        this.scheduleMs = 25;
        this.fadeNode = null;
    }

    attach(ctx, musicGain) {
        this.ctx = ctx;
        this.masterGain = musicGain;
        if (!this.fadeNode && ctx && musicGain) {
            this.fadeNode = ctx.createGain();
            this.fadeNode.gain.value = 1;
            this.fadeNode.connect(musicGain);
        }
    }

    setMuted(muted) {
        this.muted = muted;
        if (muted) this.stop(true);
    }

    play(themeId, { fadeMs = 180 } = {}) {
        if (!this.ctx || !this.masterGain || this.muted) return;
        if (this.playing && this.themeId === themeId) return;

        this.stop(true);
        this.themeId = themeId;
        this.theme = typeof getMusicTheme === 'function'
            ? getMusicTheme(themeId)
            : null;
        if (!this.theme) return;

        if (!this.fadeNode) {
            this.fadeNode = this.ctx.createGain();
            this.fadeNode.connect(this.masterGain);
        }

        const now = this.ctx.currentTime;
        this.fadeNode.gain.cancelScheduledValues(now);
        this.fadeNode.gain.setValueAtTime(0.0001, now);
        this.fadeNode.gain.exponentialRampToValueAtTime(1, now + fadeMs / 1000);

        this.step = 0;
        this.nextNoteTime = now + 0.05;
        this.playing = true;
        this._scheduler();
    }

    stop(immediate = false) {
        this.playing = false;
        if (this.timerId != null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        if (this.fadeNode && this.ctx && !immediate) {
            const now = this.ctx.currentTime;
            this.fadeNode.gain.cancelScheduledValues(now);
            this.fadeNode.gain.setValueAtTime(Math.max(0.0001, this.fadeNode.gain.value), now);
            this.fadeNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        } else if (this.fadeNode && this.ctx) {
            this.fadeNode.gain.cancelScheduledValues(this.ctx.currentTime);
            this.fadeNode.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        }

        this.themeId = null;
        this.theme = null;
    }

    _scheduler() {
        if (!this.playing || !this.ctx || !this.theme) return;

        while (this.nextNoteTime < this.ctx.currentTime + this.lookahead) {
            this._scheduleStep(this.step, this.nextNoteTime);
            this._advance();
        }

        this.timerId = setTimeout(() => this._scheduler(), this.scheduleMs);
    }

    _advance() {
        const secondsPerStep = (60 / this.theme.bpm) / 4; // 16th notes
        this.nextNoteTime += secondsPerStep;
        this.step = (this.step + 1) % this.theme.steps;
    }

    _degreeToFreq(degree, root, scale) {
        if (degree == null) return null;
        const octave = Math.floor(degree / scale.length);
        const idx = ((degree % scale.length) + scale.length) % scale.length;
        const semitones = scale[idx] + octave * 12;
        return root * Math.pow(2, semitones / 12);
    }

    _scheduleStep(step, time) {
        const theme = this.theme;
        const dest = this.fadeNode || this.masterGain;
        const vol = theme.volume || 0.12;

        const bass = theme.tracks.bass;
        if (bass) {
            const deg = bass.pattern[step % bass.pattern.length];
            const freq = this._degreeToFreq(deg, theme.root, theme.scale);
            if (freq) {
                this._tone(freq, time, secondsPerBeat(theme) * 4.5, bass.wave, bass.gain * vol, dest, 0.1);
            }
        }

        const arp = theme.tracks.arp;
        if (arp) {
            const deg = arp.pattern[step % arp.pattern.length];
            const freq = this._degreeToFreq(deg, theme.root * 2, theme.scale);
            if (freq) {
                this._tone(freq, time, secondsPerBeat(theme) * 1.8, arp.wave, arp.gain * vol, dest, 0.04);
            }
        }

        const lead = theme.tracks.lead;
        if (lead) {
            const deg = lead.pattern[step % lead.pattern.length];
            const freq = this._degreeToFreq(deg, theme.root * 2, theme.scale);
            if (freq) {
                this._tone(freq, time, secondsPerBeat(theme) * 2.8, lead.wave, lead.gain * vol, dest, 0.05);
            }
        }

        const drums = theme.tracks.drums;
        if (drums) {
            const hit = drums.pattern[step % drums.pattern.length];
            if (hit === 'k') this._kick(time, vol * 0.35, dest);
            else if (hit === 's') this._snare(time, vol * 0.22, dest);
            else if (hit === 'h') this._hat(time, vol * 0.12, dest);
        }
    }

    _tone(freq, time, duration, type, gain, dest, attack = 0.05) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, time);

        const dur = Math.max(0.08, duration);
        const atk = Math.min(attack, dur * 0.35);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), time + atk);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

        osc.connect(g);
        g.connect(dest);
        osc.start(time);
        osc.stop(time + dur + 0.02);
    }

    _kick(time, gain, dest) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
        g.gain.setValueAtTime(gain, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
        osc.connect(g);
        g.connect(dest);
        osc.start(time);
        osc.stop(time + 0.18);
    }

    _snare(time, gain, dest) {
        const duration = 0.1;
        const buffer = this._noiseBuffer(duration);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1200;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        src.connect(filter);
        filter.connect(g);
        g.connect(dest);
        src.start(time);
        src.stop(time + duration);

        const osc = this.ctx.createOscillator();
        const og = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, time);
        og.gain.setValueAtTime(gain * 0.4, time);
        og.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
        osc.connect(og);
        og.connect(dest);
        osc.start(time);
        osc.stop(time + 0.07);
    }

    _hat(time, gain, dest) {
        const duration = 0.04;
        const buffer = this._noiseBuffer(duration);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 6000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        src.connect(filter);
        filter.connect(g);
        g.connect(dest);
        src.start(time);
        src.stop(time + duration);
    }

    _noiseBuffer(duration) {
        const sampleRate = this.ctx.sampleRate;
        const length = Math.max(1, Math.floor(sampleRate * duration));
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        return buffer;
    }
}

function secondsPerBeat(theme) {
    return 60 / theme.bpm / 4;
}

const proceduralMusic = new ProceduralMusicEngine();
