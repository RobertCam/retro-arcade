# Audio Assets

Optional WAV files for the audio system. When files are missing, procedural Web Audio tones are used instead.

## Structure

```
assets/audio/
├── lobby-ambient.wav       # Optional lobby background loop
├── sfx/
│   ├── click.wav
│   ├── start.wav
│   ├── score.wav
│   ├── gameOver.wav
│   └── ...
└── games/
    ├── breakout/
    │   ├── start.wav
    │   └── ...
    └── [game-id]/
        └── [event].wav
```

## Usage

Games call `audioManager.playGameSfx('breakout', 'start')` which tries `assets/audio/games/breakout/start.wav` first, then falls back to procedural tones.
