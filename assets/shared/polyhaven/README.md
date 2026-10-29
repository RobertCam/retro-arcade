# Shared Poly Haven assets (CC0)

Textures and models from [Poly Haven](https://polyhaven.com/) — **CC0 / public domain**.
Attribution is not required but appreciated.

## Layout

```
assets/shared/polyhaven/
  textures/
    metal_plate/              # industrial steel panel
    blue_metal_plate/         # painted sheet metal
    circuit_board/            # real PCB albedo / normal / ARM
  models/
    power_box_01/             # breaker cabinet
    circuit_board/            # motherboard / PCB mesh
    modular_electric_cables/  # modular wiring kit
```

## Reuse in other games

Yes. Keep shared packs here, not under `assets/games/<name>/`.

```js
const maps = await loadPolyhavenTextureSet(this.sm, 'circuitBoard', { repeat: 1.25 });
const gltf = await loadPolyhavenModel('modularElectricCables');
const turn = findPolyhavenNode(gltf, 'cable_turn_short');
```

## Credits

| Asset | Page |
|---|---|
| Metal Plate | https://polyhaven.com/a/metal_plate |
| Blue Metal Plate | https://polyhaven.com/a/blue_metal_plate |
| Circuit Board | https://polyhaven.com/a/circuit_board |
| Modular Electric Cables | https://polyhaven.com/a/modular_electric_cables |
| Power Box 01 | https://polyhaven.com/a/power_box_01 |

Resolution kept at **1k** to keep the repo light (~18 MB total).
