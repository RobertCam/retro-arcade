#!/usr/bin/env python3
"""Generate pixel-art PNG sprites for Star Siege (no external deps)."""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'games', 'space-invaders', 'sprites')
os.makedirs(OUT, exist_ok=True)

# Palette indices: 0=transparent, 1=main, 2=highlight, 3=shadow, 4=accent
PALETTES = {
    'top':    {1: (0xFF, 0x44, 0xFF), 2: (0xFF, 0xAA, 0xFF), 3: (0x99, 0x00, 0x99), 4: (0xFF, 0xFF, 0xFF)},
    'mid':    {1: (0x44, 0xCC, 0xFF), 2: (0xAA, 0xEE, 0xFF), 3: (0x00, 0x66, 0xAA), 4: (0xFF, 0xFF, 0x00)},
    'bottom': {1: (0x44, 0xFF, 0x66), 2: (0xAA, 0xFF, 0xAA), 3: (0x00, 0x99, 0x33), 4: (0xFF, 0xFF, 0x00)},
    'player': {1: (0x00, 0xFF, 0xCC), 2: (0xAA, 0xFF, 0xEE), 3: (0x00, 0x99, 0x77), 4: (0xFFFFFF)},
    'bunker': {1: (0x44, 0xFF, 0x66), 2: (0x88, 0xFF, 0x99), 3: (0x00, 0xAA, 0x44)},
    'pbullet':{1: (0xFF, 0xFF, 0x00), 2: (0xFF, 0xAA, 0x00)},
    'abullet':{1: (0xFF, 0x66, 0x44), 2: (0xFF, 0xAA, 0x88)},
    'ufo':    {1: (0xFF, 0x22, 0x44), 2: (0xFF, 0xAA, 0x88), 3: (0xAA, 0x00, 0x22), 4: (0xFF, 0xFF, 0x00)},
}

# Classic invader-inspired 11x8 grids (frame A / B differ in legs/antennae)
ALIEN_TOP_A = [
    [0,0,0,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,0,0],
    [0,1,1,4,1,1,1,4,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1],
    [0,1,0,1,0,0,0,1,0,1,0],
    [1,0,1,0,1,0,1,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0],
]
ALIEN_TOP_B = [
    [0,0,0,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,0,0],
    [0,1,1,4,1,1,1,4,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,0,0,1,0,0,1,0,0],
    [0,1,0,0,1,0,1,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0],
]

ALIEN_MID_A = [
    [0,0,1,0,0,0,0,0,1,0,0],
    [0,0,0,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,0,0],
    [1,1,4,1,1,1,1,1,4,1,1],
    [1,1,1,1,1,1,1,1,1,1,1],
    [0,1,0,1,0,0,0,1,0,1,0],
    [1,0,1,0,0,0,0,0,1,0,1],
    [0,0,0,0,0,0,0,0,0,0,0],
]
ALIEN_MID_B = [
    [0,0,1,0,0,0,0,0,1,0,0],
    [0,0,0,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,0,0],
    [1,1,4,1,1,1,1,1,4,1,1],
    [1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,0,1,0,1,0,1,0,0],
    [0,1,0,0,0,1,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0],
]

ALIEN_BOT_A = [
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,0,0,0],
    [0,0,1,1,4,1,4,1,1,0,0],
    [1,1,1,1,1,1,1,1,1,1,1],
    [0,1,1,0,1,1,1,0,1,1,0],
    [1,0,0,1,0,0,0,1,0,0,1],
    [0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0],
]
ALIEN_BOT_B = [
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,0,0,0],
    [0,0,1,1,4,1,4,1,1,0,0],
    [1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,1,0,1,0,1,1,0,0],
    [0,1,0,0,1,0,1,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0],
]

PLAYER = [
    [0,0,0,0,0,1,0,0,0,0,0],
    [0,0,0,0,1,2,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,0,0,0],
    [0,0,1,1,3,1,3,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,0,0],
]

BUNKER = [
    [0,3,3,3,3,3,3,3,0],
    [3,2,1,1,1,1,1,2,3],
    [3,1,1,1,1,1,1,1,3],
    [0,1,1,1,1,1,1,1,0],
]

PBULLET = [[0,2,0],[0,1,0],[0,1,0]]
ABULLET = [[0,2,0],[0,1,0],[0,1,0]]

UFO = [
    [0,0,0,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,1,0,0],
    [0,1,1,4,1,1,1,1,1,4,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,3,0,3,0,3,0,3,0,3,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0],
]

EXPLOSION = [
    [0,0,2,0,2,0,0],
    [0,2,1,2,1,2,0],
    [2,1,1,1,1,1,2],
    [0,2,1,2,1,2,0],
    [0,0,2,0,2,0,0],
]
EXPLOSION_PAL = {1: (0xFF, 0xFF, 0x00), 2: (0xFF, 0x66, 0x00)}


def write_png(path, grid, palette, scale=2):
    h = len(grid)
    w = len(grid[0]) if h else 0
    pw, ph = w * scale, h * scale
    rows = []
    for y in range(ph):
        row = bytearray()
        for x in range(pw):
            sy, sx = y // scale, x // scale
            idx = grid[sy][sx]
            if idx == 0:
                row += b'\x00\x00\x00\x00'
            else:
                r, g, b = palette.get(idx, (255, 0, 255))
                row += bytes([r, g, b, 255])
        rows.append(b'\x00' + row)
    raw = b''.join(rows)
    compressed = zlib.compress(raw, 9)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', pw, ph, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print(f'  {path} ({pw}x{ph})')


def main():
    print('Generating Star Siege sprites...')
    write_png(os.path.join(OUT, 'alien-top-a.png'), ALIEN_TOP_A, PALETTES['top'])
    write_png(os.path.join(OUT, 'alien-top-b.png'), ALIEN_TOP_B, PALETTES['top'])
    write_png(os.path.join(OUT, 'alien-mid-a.png'), ALIEN_MID_A, PALETTES['mid'])
    write_png(os.path.join(OUT, 'alien-mid-b.png'), ALIEN_MID_B, PALETTES['mid'])
    write_png(os.path.join(OUT, 'alien-bot-a.png'), ALIEN_BOT_A, PALETTES['bottom'])
    write_png(os.path.join(OUT, 'alien-bot-b.png'), ALIEN_BOT_B, PALETTES['bottom'])
    write_png(os.path.join(OUT, 'player.png'), PLAYER, PALETTES['player'])
    write_png(os.path.join(OUT, 'bunker-cell.png'), BUNKER, PALETTES['bunker'], scale=1)
    write_png(os.path.join(OUT, 'bullet-player.png'), PBULLET, PALETTES['pbullet'], scale=2)
    write_png(os.path.join(OUT, 'bullet-alien.png'), ABULLET, PALETTES['abullet'], scale=2)
    write_png(os.path.join(OUT, 'ufo.png'), UFO, PALETTES['ufo'], scale=2)
    write_png(os.path.join(OUT, 'explosion.png'), EXPLOSION, EXPLOSION_PAL, scale=2)
    print('Done.')

if __name__ == '__main__':
    main()
