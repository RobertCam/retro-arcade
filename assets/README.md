# Assets Directory

This directory contains all illustrated game assets organized by game and category.

## Structure

- `games/` - Game-specific assets organized by game name
- `shared/` - Cross-game packs (e.g. Poly Haven CC0 textures/models) — see `shared/polyhaven/README.md`
- `ui/` - Shared UI elements (buttons, menus, score displays)
- `effects/` - Shared visual effects (particles, overlays)

## Usage

Assets are loaded using PixiJS texture loading. Each game folder contains a README.md file explaining what assets should be placed in that folder.

## Naming Convention

Use short names inside each game folder (e.g., `paddle.png`, `player-car.png`). Canonical paths are defined in `js/graphics/asset-manifests.js`.

## Format Requirements

- **Format**: PNG with transparency
- **Color Mode**: RGB
- **Resolution**: 2x base size recommended (e.g., if displayed at 80px, create at 160px)

