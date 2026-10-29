/**
 * Shared Poly Haven CC0 asset paths.
 * Safe to reuse across any game — CC0 / public domain (attribution appreciated).
 * Sources: https://polyhaven.com/
 */
const POLYHAVEN_ASSETS = {
    textures: {
        metalPlate: {
            id: 'metal_plate',
            name: 'Metal Plate',
            author: 'Poly Haven',
            url: 'https://polyhaven.com/a/metal_plate',
            diff: 'assets/shared/polyhaven/textures/metal_plate/metal_plate_diff_1k.jpg',
            nor: 'assets/shared/polyhaven/textures/metal_plate/metal_plate_nor_gl_1k.jpg',
            rough: 'assets/shared/polyhaven/textures/metal_plate/metal_plate_rough_1k.jpg',
            metal: 'assets/shared/polyhaven/textures/metal_plate/metal_plate_metal_1k.jpg'
        },
        blueMetalPlate: {
            id: 'blue_metal_plate',
            name: 'Blue Metal Plate',
            author: 'Poly Haven',
            url: 'https://polyhaven.com/a/blue_metal_plate',
            diff: 'assets/shared/polyhaven/textures/blue_metal_plate/blue_metal_plate_diff_1k.jpg',
            nor: 'assets/shared/polyhaven/textures/blue_metal_plate/blue_metal_plate_nor_gl_1k.jpg',
            rough: 'assets/shared/polyhaven/textures/blue_metal_plate/blue_metal_plate_rough_1k.jpg',
            arm: 'assets/shared/polyhaven/textures/blue_metal_plate/blue_metal_plate_arm_1k.jpg'
        },
        circuitBoard: {
            id: 'circuit_board',
            name: 'Circuit Board',
            author: 'Poly Haven',
            url: 'https://polyhaven.com/a/circuit_board',
            diff: 'assets/shared/polyhaven/textures/circuit_board/circuit_board_diff_1k.jpg',
            nor: 'assets/shared/polyhaven/textures/circuit_board/circuit_board_nor_gl_1k.jpg',
            arm: 'assets/shared/polyhaven/textures/circuit_board/circuit_board_arm_1k.jpg'
        }
    },
    models: {
        powerBox01: {
            id: 'power_box_01',
            name: 'Power Box 01',
            author: 'Poly Haven',
            url: 'https://polyhaven.com/a/power_box_01',
            gltf: 'assets/shared/polyhaven/models/power_box_01/power_box_01.gltf'
        },
        circuitBoard: {
            id: 'circuit_board',
            name: 'Circuit Board',
            author: 'Poly Haven',
            url: 'https://polyhaven.com/a/circuit_board',
            gltf: 'assets/shared/polyhaven/models/circuit_board/circuit_board.gltf'
        },
        modularElectricCables: {
            id: 'modular_electric_cables',
            name: 'Modular Electric Cables',
            author: 'Poly Haven',
            url: 'https://polyhaven.com/a/modular_electric_cables',
            gltf: 'assets/shared/polyhaven/models/modular_electric_cables/modular_electric_cables.gltf'
        }
    }
};

/**
 * Load a Poly Haven glTF model. Returns the parsed glTF or null.
 */
async function loadPolyhavenModel(modelKey) {
    const entry = POLYHAVEN_ASSETS.models[modelKey];
    const Loader = typeof window !== 'undefined' ? window.THREE_ADDONS?.GLTFLoader : null;
    if (!entry?.gltf || !Loader) return null;
    try {
        const loader = new Loader();
        return await loader.loadAsync(entry.gltf);
    } catch (err) {
        console.warn('Poly Haven model failed to load:', entry.id, err);
        return null;
    }
}

/** Find a named object inside a loaded glTF scene (clone-ready). */
function findPolyhavenNode(gltfOrScene, name) {
    const root = gltfOrScene?.scene || gltfOrScene;
    if (!root) return null;
    let found = null;
    root.traverse((node) => {
        if (!found && node.name === name) found = node;
    });
    return found;
}

async function loadPolyhavenTextureSet(spriteManager, setKey, options = {}) {
    const set = POLYHAVEN_ASSETS.textures[setKey];
    if (!set || !spriteManager?.loadTexture) return null;

    const repeat = options.repeat || 1;
    const load = async (path, space) => {
        if (!path) return null;
        const tex = await spriteManager.loadTexture(path, {
            pixelPerfect: false,
            colorSpace: space === 'srgb' ? 'srgb' : 'linear'
        });
        if (!tex) return null;
        const T = window.THREE;
        tex.wrapS = T.RepeatWrapping;
        tex.wrapT = T.RepeatWrapping;
        tex.repeat.set(repeat, repeat);
        tex.needsUpdate = true;
        return tex;
    };

    const map = await load(set.diff, 'srgb');
    const normalMap = await load(set.nor, 'linear');
    const roughnessMap = await load(set.rough || set.arm, 'linear');
    const metalnessMap = await load(set.metal, 'linear');
    return { map, normalMap, roughnessMap, metalnessMap, meta: set };
}
