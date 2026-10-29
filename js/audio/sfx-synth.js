/**
 * Richer procedural SFX: tones, sweeps, noise bursts, and layered patches.
 */
class SfxSynth {
    play(ctx, dest, patch) {
        if (!ctx || !dest || !patch) return;

        if (Array.isArray(patch.layers)) {
            patch.layers.forEach((layer, i) => {
                const delay = (layer.delay || 0) + i * (patch.stagger || 0);
                this._playLayer(ctx, dest, layer, delay);
            });
            return;
        }

        this._playLayer(ctx, dest, patch, 0);
    }

    _playLayer(ctx, dest, layer, delaySec) {
        const kind = layer.kind || (layer.noise ? 'noise' : (layer.endFreq != null ? 'sweep' : 'tone'));
        const t0 = ctx.currentTime + delaySec;

        if (kind === 'noise') {
            this._noise(ctx, dest, layer, t0);
        } else if (kind === 'sweep') {
            this._sweep(ctx, dest, layer, t0);
        } else {
            this._tone(ctx, dest, layer, t0);
        }
    }

    _tone(ctx, dest, layer, t0) {
        const duration = layer.duration || 0.1;
        const gain = layer.gain == null ? 0.12 : layer.gain;
        const attack = layer.attack == null ? 0.008 : layer.attack;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = layer.wave || layer.type || 'square';
        const freq = layer.freq || (layer.frequencies && layer.frequencies[0]) || 440;
        osc.frequency.setValueAtTime(freq, t0);

        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        osc.connect(g);
        g.connect(dest);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }

    _sweep(ctx, dest, layer, t0) {
        const duration = layer.duration || 0.12;
        const gain = layer.gain == null ? 0.12 : layer.gain;
        const attack = layer.attack == null ? 0.005 : layer.attack;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = layer.wave || layer.type || 'square';
        const start = layer.freq || layer.startFreq || 440;
        const end = layer.endFreq != null ? layer.endFreq : start * 0.5;
        osc.frequency.setValueAtTime(start, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + duration);

        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        osc.connect(g);
        g.connect(dest);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }

    _noise(ctx, dest, layer, t0) {
        const duration = layer.duration || 0.08;
        const gain = layer.gain == null ? 0.1 : layer.gain;
        const sampleRate = ctx.sampleRate;
        const length = Math.max(1, Math.floor(sampleRate * duration));
        const buffer = ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = layer.filter || 'bandpass';
        filter.frequency.value = layer.band || 1200;
        filter.Q.value = layer.q == null ? 1.2 : layer.q;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + (layer.attack || 0.005));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        src.connect(filter);
        filter.connect(g);
        g.connect(dest);
        src.start(t0);
        src.stop(t0 + duration + 0.02);
    }

    /** Convert legacy {frequencies, duration, type, gain} profiles into layered patches. */
    fromLegacyProfile(profile) {
        if (!profile) return null;
        if (profile.layers) return profile;

        const freqs = profile.frequencies || [440];
        const duration = profile.duration || 0.1;
        const wave = profile.type || 'square';
        const gain = profile.gain == null ? 0.1 : profile.gain;
        const stagger = Math.max(0.04, duration * 0.7);

        return {
            stagger,
            layers: freqs.map((freq, i) => ({
                kind: 'tone',
                freq,
                duration,
                wave,
                gain: gain * (1 - i * 0.05)
            }))
        };
    }
}

const sfxSynth = new SfxSynth();
