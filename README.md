# Retro Arcade

A lightweight, performant online retro arcade featuring classic games with modern web technologies.

## Games

- **Neon Shards** (Breakout) — Smash themed brick fields with power-ups
- **Containment Grid** (Jezzball) — Draw lines to trap bouncing balls
- **Hyper Runners** (Micro Racing) — Pseudo-3D Out Run–style racing
- **Rise of the Rivets** (Working Man) — Platformer with 20 levels
- **Tetra Circuit** (Tetris) — Classic tetromino puzzle action
- **Mousetrap** (Mouse Pac-Man) — Maze chase with cats and cheese
- **Mini Putt** (Mini Golf) — 18-hole mouse-aim golf

## Features

- No accounts required
- Local high score tracking (top 10 per game)
- Mobile-responsive lobby with touch controls in select games
- PixiJS WebGL rendering with procedural graphics and optional illustrated assets
- Particle effects, screen shake, CRT overlay, and theme support
- Procedural audio via Web Audio API with mute toggle

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3, PixiJS (CDN)
- **Graphics**: Custom sprite system, asset loader with procedural fallback
- **Audio**: Web Audio API sound manager
- **Storage**: LocalStorage for high scores and settings
- **Deployment**: Vercel

## Local Development

A local web server is required for asset loading (CORS). Use either:

```bash
npm run dev
```

Or manually:

```bash
python -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000` (or the port shown).

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/retro-arcade)

Or manually:

```bash
npm i -g vercel
vercel
```

## Game Controls

### Neon Shards (Breakout)
- **Arrow Keys**: Move paddle
- **Space**: Start / Pause
- **P**: Pause

### Containment Grid (Jezzball)
- **Mouse**: Draw lines
- **Space**: Start
- **R**: Reset

### Hyper Runners (Micro Racing)
- **Arrow Keys**: Steer
- **Space**: Accelerate
- **R**: Reset

### Rise of the Rivets (Working Man)
- **Arrow Keys**: Move
- **Space**: Jump
- **R**: Reset

### Tetra Circuit (Tetris)
- **Arrow Keys**: Move / Rotate
- **Down**: Soft drop
- **Space**: Hard drop
- **X**: Rotate
- **P**: Pause

### Mousetrap (Mouse Pac-Man)
- **Arrow Keys**: Move
- **Space**: Start / Pause
- **P**: Pause

### Mini Putt (Mini Golf)
- **Mouse**: Drag from ball to aim and set power
- **Space**: Start
- **P**: Pause

## Asset Pipeline

Illustrated sprites can be dropped into `assets/games/[game-name]/` following the per-game README specs. Games fall back to procedural graphics when assets are missing. See `ASSET_SPECIFICATION.md` and `assets/ASSET_INTEGRATION.md`.

## Testing

See `SMOKE_TEST.md` for a manual smoke-test checklist.

## Contributing

Feel free to contribute new games, improvements, or bug fixes! See `ADDING_NEW_GAMES.md`.

## License

MIT License — feel free to use this project for your own arcade!
