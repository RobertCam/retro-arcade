# Retro Arcade

A lightweight, performant online retro arcade featuring classic games with modern web technologies.

## Games

- **Breakout** - Smash bricks with your paddle! (✅ Complete)
- **Jezzball** - Draw lines to trap bouncing balls (🚧 Coming Soon)
- **Micro Racing** - Race through procedurally generated tracks (🚧 Coming Soon)
- **Working Man vs Oligarch** - Climb to the top, avoid the billionaire's traps (🚧 Coming Soon)

## Features

- 🎮 No accounts required
- 🏆 Local high score tracking
- 📱 Mobile responsive
- ⚡ Lightweight and fast
- 🎨 Retro pixel art style
- 💫 Smooth animations and effects

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3
- **Animation**: Custom sprite system with particle effects
- **Storage**: LocalStorage for high scores
- **Deployment**: Vercel

## Local Development

1. Clone the repository
2. Open `index.html` in your browser
3. Or serve with a local server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/retro-arcade)

Or manually:
```bash
npm i -g vercel
vercel
```

## Game Controls

### Breakout
- **Arrow Keys**: Move paddle
- **Space**: Start game / Pause
- **P**: Pause/Resume

### Jezzball (Coming Soon)
- **Mouse**: Draw lines
- **Space**: Start game
- **R**: Reset

### Micro Racing (Coming Soon)
- **Arrow Keys**: Steer
- **Space**: Accelerate
- **R**: Reset

### Working Man vs Oligarch (Coming Soon)
- **Arrow Keys**: Move
- **Space**: Jump
- **R**: Reset

## Performance Features

- Canvas-based rendering for smooth 60fps gameplay
- Efficient collision detection
- Particle effects system
- Screen shake and flash effects
- Optimized sprite rendering
- Minimal DOM manipulation

## Contributing

Feel free to contribute new games, improvements, or bug fixes!

## License

MIT License - feel free to use this project for your own arcade!
