import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

try {
    window.THREE = THREE;
    window.THREE_ADDONS = {
        EffectComposer,
        RenderPass,
        ShaderPass,
        UnrealBloomPass,
        OutputPass,
        GLTFLoader
    };
} catch (err) {
    console.error('Three.js bootstrap failed:', err);
} finally {
    if (typeof window.__resolveThreeReady === 'function') {
        window.__resolveThreeReady();
    }
}
