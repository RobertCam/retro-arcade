# Smoke Test Checklist

Run `npm run dev` and open http://localhost:8000 before testing.

## Lobby

- [ ] All 7 cabinet cover images display (no broken images)
- [ ] High score displays show for each cabinet
- [ ] SCORES button opens modal with scores (or "No scores yet")
- [ ] Mute button toggles audio on/off and persists after reload
- [ ] Clicking a cabinet opens the game

## Per Game (repeat for each of 7 games)

- [ ] Game canvas renders (not blank)
- [ ] Space starts the game from menu
- [ ] Core gameplay responds to controls for ~30 seconds
- [ ] P or Space pauses (where applicable)
- [ ] Game over triggers correctly
- [ ] High score modal appears on new record (optional: skip with SKIP)
- [ ] Back button or ESC returns to lobby
- [ ] High score on cabinet updates after a scored game

## Games

1. Neon Shards (breakout) — paddle moves, ball breaks bricks, difficulty selectable
2. Containment Grid (jezzball) — mouse draws lines, balls bounce
3. Hyper Runners (micro-racing) — car steers and accelerates
4. Rise of the Rivets (working-man) — move and jump
5. Tetra Circuit (tetris) — pieces fall and lock
6. Mousetrap (mouse-pacman) — maze navigation works
7. Mini Putt (minigolf) — drag to aim and shoot

## Mobile (optional)

- [ ] Lobby layout readable on narrow viewport
- [ ] Breakout touch buttons move paddle
- [ ] Tetris touch buttons move/rotate pieces

## Asset fallback

- [ ] Games run without any PNG files in `assets/` (procedural graphics)
