// CRT post-process, screen shake, and flash — NESEffects-compatible API for Three.js

const CRTShader = {
    uniforms: {
        tDiffuse: { value: null },
        resolution: { value: null },
        time: { value: 0 },
        scanlineIntensity: { value: 0.15 },
        vignetteIntensity: { value: 0.3 },
        curvature: { value: 0.08 },
        flashColor: { value: null },
        flashAlpha: { value: 0 }
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float time;
        uniform float scanlineIntensity;
        uniform float vignetteIntensity;
        uniform float curvature;
        uniform vec3 flashColor;
        uniform float flashAlpha;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;
            vec2 cc = uv - 0.5;
            float dist = dot(cc, cc);
            uv = uv + cc * dist * curvature;

            vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
            if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
                color = texture2D(tDiffuse, uv);
            }

            float line = sin(uv.y * resolution.y * 3.14159);
            float scan = 1.0 - scanlineIntensity * (0.5 + 0.5 * line);
            color.rgb *= scan;

            float vig = 1.0 - vignetteIntensity * dist * 2.4;
            color.rgb *= vig;

            color.rgb = mix(color.rgb, flashColor, clamp(flashAlpha, 0.0, 1.0));
            gl_FragColor = color;
        }
    `
};

class ThreeEffects {
    constructor(graphicsCore) {
        this.core = graphicsCore;
        this.composer = null;
        this.crtPass = null;
        this.bloomPass = null;

        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeOffset = { x: 0, y: 0 };

        this.flashColor = 0xffffff;
        this.flashAlpha = 0;
        this.flashDuration = 0;

        this.colorCycleSpeed = 0;
        this.colorCycleOffset = 0;

        this.crtEnabled = true;
        this.crtScanlineIntensity = 0.08;
        this.crtNoiseIntensity = 0;
        this.crtCurvature = 0.018;
        this.crtVignetteIntensity = 0.12;

        this._time = 0;
        this._setupComposer();
    }

    _setupComposer() {
        const THREE = window.THREE;
        const addons = window.THREE_ADDONS;
        if (!THREE || !addons || !this.core?.renderer) return;

        const width = this.core.options.width;
        const height = this.core.options.height;
        const renderer = this.core.renderer;

        this.composer = new addons.EffectComposer(renderer);
        this.composer.setPixelRatio(this.core.pixelRatio || 1);
        this.composer.setSize(width, height);

        const renderPass = new addons.RenderPass(this.core.scene, this.core.camera);
        this.composer.addPass(renderPass);

        this.crtPass = new addons.ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                resolution: { value: new THREE.Vector2(width, height) },
                time: { value: 0 },
                scanlineIntensity: { value: this.crtScanlineIntensity },
                vignetteIntensity: { value: this.crtVignetteIntensity },
                curvature: { value: this.crtCurvature },
                flashColor: { value: new THREE.Color(1, 1, 1) },
                flashAlpha: { value: 0 }
            },
            vertexShader: CRTShader.vertexShader,
            fragmentShader: CRTShader.fragmentShader
        });
        this.composer.addPass(this.crtPass);

        const outputPass = new addons.OutputPass();
        this.composer.addPass(outputPass);
    }

    shake(intensity = 5, duration = 10) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeDuration = Math.max(this.shakeDuration, duration);
    }

    flash(color = 0xffffff, duration = 5, alpha = 0.3) {
        this.flashColor = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
        this.flashDuration = duration;
        this.flashAlpha = alpha;
    }

    startColorCycle(speed = 0.01) {
        this.colorCycleSpeed = speed;
    }

    stopColorCycle() {
        this.colorCycleSpeed = 0;
    }

    update() {
        if (this.shakeDuration > 0) {
            this.shakeDuration--;
            const range = this.shakeIntensity;
            this.shakeOffset.x = (Math.random() * 2 - 1) * range;
            this.shakeOffset.y = (Math.random() * 2 - 1) * range;
            if (this.shakeDuration <= 0) {
                this.shakeIntensity = 0;
                this.shakeOffset.x = 0;
                this.shakeOffset.y = 0;
            }
        }

        if (this.flashDuration > 0) {
            this.flashDuration--;
            this.flashAlpha *= 0.9;
        } else {
            this.flashAlpha = 0;
        }

        if (this.colorCycleSpeed > 0) {
            this.colorCycleOffset += this.colorCycleSpeed;
            if (this.colorCycleOffset >= Math.PI * 2) this.colorCycleOffset -= Math.PI * 2;
        }

        this._time += 0.016;
        this._syncUniforms();
        this._applyShake();
    }

    _syncUniforms() {
        if (!this.crtPass) return;
        const u = this.crtPass.uniforms;
        u.time.value = this._time;
        u.scanlineIntensity.value = this.crtEnabled ? this.crtScanlineIntensity : 0;
        u.vignetteIntensity.value = this.crtEnabled ? this.crtVignetteIntensity : 0;
        u.curvature.value = this.crtEnabled ? this.crtCurvature : 0;
        u.flashAlpha.value = this.flashAlpha;
        if (u.flashColor.value && window.THREE) {
            u.flashColor.value.setHex(this.flashColor);
        }
    }

    _applyShake() {
        if (!this.core?.playfield) return;
        this.core.playfield.position.set(this.shakeOffset.x, -this.shakeOffset.y, 0);
    }

    getShakeOffset() {
        return { ...this.shakeOffset };
    }

    getCycledColor(index = 0) {
        if (typeof NES_PALETTE === 'undefined') return 0xffffff;
        const cycleIndex = (index + Math.floor(this.colorCycleOffset * 10)) % NES_PALETTE.length;
        return NES_PALETTE[cycleIndex];
    }

    setCRTEnabled(enabled) {
        this.crtEnabled = enabled;
        if (this.crtPass) this.crtPass.enabled = enabled;
    }

    setCRTIntensity(scanlines, noise, vignette) {
        if (scanlines !== undefined) this.crtScanlineIntensity = scanlines;
        if (noise !== undefined) this.crtNoiseIntensity = noise;
        if (vignette !== undefined) this.crtVignetteIntensity = vignette;
    }

    setSize(width, height) {
        if (!this.composer) return;
        this.composer.setSize(width, height);
        if (this.crtPass?.uniforms?.resolution?.value) {
            this.crtPass.uniforms.resolution.value.set(width, height);
        }
    }

    render() {
        if (this.composer) {
            this.composer.render();
        } else if (this.core?.renderer) {
            this.core.renderer.render(this.core.scene, this.core.camera);
        }
    }

    destroy() {
        if (this.composer) {
            this.composer.dispose();
            this.composer = null;
        }
        this.crtPass = null;
        this.bloomPass = null;
        this.core = null;
    }
}
