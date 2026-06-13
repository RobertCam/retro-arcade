# Tetris Game Assets

Place your Tetris (Tetra Circuit) game assets in this directory.

## Required Assets

### Tetromino Pieces
Each piece needs textures for all rotations (0°, 90°, 180°, 270°) OR you can provide base textures and rotation will be handled in code.

- `piece-i-0.png` - I piece, 0° rotation (base cell 25x25px, or 50x50px for 2x)
- `piece-i-90.png` - I piece, 90° rotation
- `piece-i-180.png` - I piece, 180° rotation
- `piece-i-270.png` - I piece, 270° rotation

Repeat for each piece type:
- `piece-o-0.png` through `piece-o-270.png` - O piece
- `piece-t-0.png` through `piece-t-270.png` - T piece
- `piece-s-0.png` through `piece-s-270.png` - S piece
- `piece-z-0.png` through `piece-z-270.png` - Z piece
- `piece-j-0.png` through `piece-j-270.png` - J piece
- `piece-l-0.png` through `piece-l-270.png` - L piece

### Variants
- `piece-ghost.png` - Ghost piece overlay (semi-transparent outline)
- `piece-locked.png` - Locked piece texture (for pieces on board, optional darker variant)

### Board Elements
- `board-bg.png` - Board background (250x500px)
- `cell-border.png` - Cell border/outline (25x25px base)

### UI Elements
- `next-box.png` - Next piece display box (120x120px)
- `ui-bg.png` - Score/UI background panel (200x150px)

## Notes
- Each piece type should have a distinct color/pattern
- Pieces can be provided as base textures with rotations handled programmatically, OR as separate rotation frames
- Total: 7 piece types × 4 rotations = 28 files (if providing all rotations separately)

