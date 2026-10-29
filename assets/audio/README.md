# Audio

## Music

Per-game MP3 loops (CC0, ~1.5–4 minutes). Loaded by theme id:

```
assets/audio/music/{lobby|breakout|jezzball|...}.mp3
assets/audio/games/{game-id}/music.mp3
```

`audioManager.playGameMusic(gameId)` / `playLobbyAmbient()` switch themes. Opening a game stops lobby music and starts that game’s track; Back restores lobby.

See `CREDITS.md` for sources.

## SFX

Kenney CC0 OGGs under `sfx/` and `games/{id}/`, with procedural fallback.
