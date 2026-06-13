# Mouse Pacman Game Assets

Place your Mouse Pacman (Mousetrap) game assets in this directory.

## Required Assets

### Mouse Character
- `mouse-up-1.png` - Mouse facing up, frame 1 (mouth closed) (32x32px base)
- `mouse-up-2.png` - Mouse facing up, frame 2 (mouth open)
- `mouse-down-1.png` - Mouse facing down, frame 1 (mouth closed)
- `mouse-down-2.png` - Mouse facing down, frame 2 (mouth open)
- `mouse-left-1.png` - Mouse facing left, frame 1 (mouth closed)
- `mouse-left-2.png` - Mouse facing left, frame 2 (mouth open)
- `mouse-right-1.png` - Mouse facing right, frame 1 (mouth closed)
- `mouse-right-2.png` - Mouse facing right, frame 2 (mouth open)

### Cat Enemies
For each of 4 cat colors (red, pink, cyan, orange):

- `cat-red-up-1.png` - Red cat, up, frame 1
- `cat-red-up-2.png` - Red cat, up, frame 2
- `cat-red-down-1.png` - Red cat, down, frame 1
- `cat-red-down-2.png` - Red cat, down, frame 2
- `cat-red-left-1.png` - Red cat, left, frame 1
- `cat-red-left-2.png` - Red cat, left, frame 2
- `cat-red-right-1.png` - Red cat, right, frame 1
- `cat-red-right-2.png` - Red cat, right, frame 2

Repeat for: `cat-pink-*`, `cat-cyan-*`, `cat-orange-*`

### Cat Variants
- `cat-scared-1.png` through `cat-scared-2.png` - Scared cat sprite (when power pellet active, for all colors)
- `cat-eyes-only.png` - Eyes only sprite (when cat is eaten, returns to center)

### Maze Elements
- `wall-horizontal.png` - Horizontal wall segment (16x16px tile)
- `wall-vertical.png` - Vertical wall segment (16x16px tile)
- `wall-corner-tl.png` - Top-left corner
- `wall-corner-tr.png` - Top-right corner
- `wall-corner-bl.png` - Bottom-left corner
- `wall-corner-br.png` - Bottom-right corner
- `wall-t-junction-t.png` - T-junction (top opening)
- `wall-t-junction-r.png` - T-junction (right opening)
- `wall-t-junction-b.png` - T-junction (bottom opening)
- `wall-t-junction-l.png` - T-junction (left opening)
- `wall-cross.png` - Cross intersection

### Collectibles
- `cheese-dot.png` - Small cheese dot (8x8px base, or 16x16px for 2x)
- `power-pellet.png` - Power pellet (16x16px base, or 32x32px for 2x)

### Background
- `background.png` - Game background (800x600px)

## Notes
- Mouse needs chomping animation (mouth open/closed)
- Cats need 2-frame walk animation per direction
- Maze walls should be distinct color (typically blue)
- Total animation frames: Mouse (8), Cats (32 for normal + variants)

