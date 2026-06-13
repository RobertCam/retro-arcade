/**
 * Minigolf hole layouts — classic (1-9) and challenge (10-18).
 * Coords are fractional within each hole's region (0-1).
 * region: [x0, y0, x1, y1] as fractions of the full course — omit for full canvas.
 */
function buildMinigolfHole(holeNumber, margin, cw, ch, ballRadius) {
    const applyClearance = (walls, px, py, minDist) => {
        return walls.map(([x1, y1, x2, y2]) => {
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
            const cxp = x1 + t * dx, cyp = y1 + t * dy;
            const dist = Math.hypot(px - cxp, py - cyp);
            if (dist >= minDist) return [x1, y1, x2, y2];
            const pxp = -dy / len, pyp = dx / len;
            const move = (minDist - dist) * (Math.sign((cxp - px) * pxp + (cyp - py) * pyp) || 1);
            return [x1 + pxp * move, y1 + pyp * move, x2 + pxp * move, y2 + pyp * move];
        });
    };

    const finish = (h) => {
        const ballClr = ballRadius + 35;
        const holeClr = h.holeRadius + 18;
        h.walls = applyClearance(h.walls, h.startX, h.startY, ballClr);
        h.walls = applyClearance(h.walls, h.holeX, h.holeY, holeClr);
        return h;
    };

    const buildFromDef = (defs) => {
        const region = defs.region || [0, 0, 1, 1];
        const ox = margin + region[0] * cw;
        const oy = margin + region[1] * ch;
        const rw = (region[2] - region[0]) * cw;
        const rh = (region[3] - region[1]) * ch;
        const cx = (rx, ry) => [ox + rx * rw, oy + ry * rh];

        const hole = {
            holeRadius: 10,
            par: defs.par,
            walls: [
                [ox, oy, ox + rw, oy],
                [ox + rw, oy, ox + rw, oy + rh],
                [ox + rw, oy + rh, ox, oy + rh],
                [ox, oy + rh, ox, oy]
            ],
            obstacles: [],
            breakZones: [],
            cupLip: true
        };

        const [sx, sy] = cx(defs.start[0], defs.start[1]);
        const [hx, hy] = cx(defs.cup[0], defs.cup[1]);
        hole.startX = sx;
        hole.startY = sy;
        hole.holeX = hx;
        hole.holeY = hy;

        (defs.walls || []).forEach(([[rx1, ry1], [rx2, ry2]]) => {
            const [x1, y1] = cx(rx1, ry1);
            const [x2, y2] = cx(rx2, ry2);
            hole.walls.push([x1, y1, x2, y2]);
        });

        (defs.breaks || []).forEach(b => {
            const [bx, by] = cx(b.x, b.y);
            hole.breakZones.push({
                x: bx, y: by,
                radius: b.r,
                biasAngle: b.angle,
                strength: b.str || 0.018
            });
        });

        (defs.sand || []).forEach(s => {
            const [px, py] = cx(s.x, s.y);
            hole.obstacles.push({ type: 'sand', x: px, y: py, radius: s.r });
        });

        (defs.water || []).forEach(w => {
            const [wx, wy] = cx(w.x, w.y);
            const obs = { type: 'water', x: wx, y: wy, radius: w.r };
            if (w.inner) obs.innerRadius = w.inner;
            if (w.w && w.h) {
                obs.width = w.w;
                obs.height = w.h;
                delete obs.radius;
            }
            hole.obstacles.push(obs);
        });

        (defs.bricks || []).forEach(b => {
            const [bx, by] = cx(b.x, b.y);
            hole.obstacles.push({
                type: 'brick',
                x: bx, y: by,
                width: b.w || 18,
                height: b.h || 18,
                angle: b.angle || 0
            });
        });

        (defs.planks || []).forEach(p => {
            const [px, py] = cx(p.x, p.y);
            hole.obstacles.push({
                type: 'plank',
                x: px, y: py,
                width: p.w || 50,
                height: p.h || 10,
                angle: p.angle || 0
            });
        });

        (defs.ramps || []).forEach(r => {
            const [rx, ry] = cx(r.x, r.y);
            hole.obstacles.push({
                type: 'ramp',
                x: rx, y: ry,
                width: r.w || 50,
                height: r.h || 16,
                angle: r.angle || 0
            });
        });

        (defs.gates || []).forEach(g => {
            const [gx, gy] = cx(g.x, g.y);
            hole.obstacles.push({
                type: 'movingGate',
                x: gx, y: gy,
                width: g.w || 18,
                height: g.h || 70,
                isOpen: false,
                toggleTime: 0,
                toggleInterval: g.interval || 2200
            });
        });

        (defs.windmills || []).forEach(w => {
            const [wx, wy] = cx(w.x, w.y);
            hole.obstacles.push({
                type: 'rotatingBarrier',
                x: wx, y: wy,
                length: w.len || 45,
                thickness: 5,
                rotation: w.rot || 0,
                rotationSpeed: w.speed || 0.028,
                pivotX: wx,
                pivotY: wy
            });
        });

        return finish(hole);
    };

    // Classic 1-9: tighter greens, more bunkers and doglegs
    const classic = [
        // 1 — compact center green, bunker guards the line
        {
            par: 3,
            region: [0.22, 0.28, 0.78, 0.72],
            start: [0.1, 0.5],
            cup: [0.88, 0.5],
            sand: [{ x: 0.52, y: 0.5, r: 26 }],
            breaks: [{ x: 0.35, y: 0.42, r: 28, angle: 0.15, str: 0.02 }]
        },
        // 2 — narrow vertical strip, forced bank off wall
        {
            par: 3,
            region: [0.32, 0.12, 0.68, 0.88],
            start: [0.5, 0.88],
            cup: [0.5, 0.12],
            walls: [[[0.15, 0.45], [0.85, 0.45]]],
            sand: [{ x: 0.5, y: 0.62, r: 22 }],
            breaks: [{ x: 0.5, y: 0.3, r: 24, angle: 1.2, str: 0.022 }]
        },
        // 3 — short wide green, dogleg right
        {
            par: 3,
            region: [0.08, 0.18, 0.92, 0.58],
            start: [0.08, 0.5],
            cup: [0.88, 0.35],
            walls: [[[0.42, 0.0], [0.42, 0.65]], [[0.42, 0.65], [0.72, 0.65]]],
            sand: [{ x: 0.58, y: 0.45, r: 24 }, { x: 0.25, y: 0.55, r: 20 }],
            breaks: [{ x: 0.75, y: 0.4, r: 26, angle: -0.4, str: 0.018 }]
        },
        // 4 — bottom-left pocket, chute between bunkers
        {
            par: 4,
            region: [0.06, 0.42, 0.52, 0.94],
            start: [0.15, 0.85],
            cup: [0.82, 0.18],
            walls: [[[0.55, 0.35], [0.55, 0.95]]],
            sand: [{ x: 0.35, y: 0.55, r: 22 }, { x: 0.7, y: 0.45, r: 20 }],
            planks: [{ x: 0.38, y: 0.72, w: 55, h: 8, angle: 0.35 }]
        },
        // 5 — center square, U-shaped wall around cup
        {
            par: 4,
            region: [0.28, 0.22, 0.72, 0.78],
            start: [0.12, 0.5],
            cup: [0.78, 0.5],
            walls: [
                [[0.55, 0.2], [0.55, 0.55]],
                [[0.55, 0.55], [0.85, 0.55]],
                [[0.85, 0.55], [0.85, 0.8]]
            ],
            sand: [{ x: 0.38, y: 0.35, r: 22 }, { x: 0.38, y: 0.65, r: 22 }],
            breaks: [{ x: 0.68, y: 0.5, r: 30, angle: 0, str: 0.016 }]
        },
        // 6 — top band, zigzag corridor
        {
            par: 4,
            region: [0.1, 0.06, 0.9, 0.48],
            start: [0.08, 0.5],
            cup: [0.92, 0.5],
            walls: [
                [[0.28, 0.0], [0.28, 0.55]],
                [[0.28, 0.55], [0.52, 0.55]],
                [[0.52, 0.55], [0.52, 0.0]],
                [[0.72, 1.0], [0.72, 0.45]],
                [[0.72, 0.45], [0.88, 0.45]]
            ],
            sand: [{ x: 0.4, y: 0.75, r: 20 }],
            breaks: [{ x: 0.6, y: 0.6, r: 28, angle: 0.5, str: 0.02 }]
        },
        // 7 — right-side compact, channel through bunkers
        {
            par: 3,
            region: [0.48, 0.2, 0.94, 0.8],
            start: [0.1, 0.5],
            cup: [0.88, 0.5],
            walls: [[[0.35, 0.25], [0.35, 0.75]]],
            sand: [{ x: 0.55, y: 0.35, r: 24 }, { x: 0.55, y: 0.65, r: 24 }],
            bricks: [{ x: 0.72, y: 0.5, w: 16, h: 16 }]
        },
        // 8 — left L-shape, bank off plank
        {
            par: 4,
            region: [0.04, 0.15, 0.58, 0.85],
            start: [0.12, 0.82],
            cup: [0.85, 0.18],
            walls: [[[0.45, 0.35], [0.95, 0.35]], [[0.45, 0.35], [0.45, 0.95]]],
            sand: [{ x: 0.28, y: 0.55, r: 26 }],
            planks: [{ x: 0.62, y: 0.55, w: 48, h: 10, angle: -0.5 }],
            breaks: [{ x: 0.75, y: 0.28, r: 24, angle: 0.8, str: 0.022 }]
        },
        // 9 — full-width carry over water (classic tier finale)
        {
            par: 4,
            region: [0.06, 0.25, 0.94, 0.75],
            start: [0.06, 0.5],
            cup: [0.94, 0.5],
            water: [{ x: 0.48, y: 0.5, r: 38 }],
            sand: [{ x: 0.22, y: 0.42, r: 22 }, { x: 0.78, y: 0.58, r: 22 }],
            walls: [[[0.68, 0.15], [0.68, 0.85]]],
            breaks: [{ x: 0.82, y: 0.45, r: 26, angle: -0.2, str: 0.015 }]
        }
    ];

    // Challenge 10-18: hazards stack, smaller target greens
    const challenge = [
        // 10 — water carry into narrow landing
        {
            par: 4,
            region: [0.12, 0.3, 0.88, 0.7],
            start: [0.08, 0.5],
            cup: [0.92, 0.5],
            water: [{ x: 0.38, y: 0.5, r: 32 }],
            walls: [[[0.58, 0.15], [0.58, 0.85]]],
            sand: [{ x: 0.72, y: 0.4, r: 22 }, { x: 0.72, y: 0.6, r: 22 }],
            breaks: [{ x: 0.82, y: 0.5, r: 28, angle: 0, str: 0.02 }]
        },
        // 11 — ramp redirect + wall pinch
        {
            par: 4,
            region: [0.18, 0.1, 0.82, 0.65],
            start: [0.15, 0.88],
            cup: [0.85, 0.12],
            walls: [[[0.35, 0.45], [0.65, 0.55]]],
            ramps: [{ x: 0.5, y: 0.65, w: 55, h: 18, angle: -0.35 }],
            sand: [{ x: 0.55, y: 0.35, r: 24 }],
            breaks: [{ x: 0.75, y: 0.2, r: 22, angle: 0.6, str: 0.018 }]
        },
        // 12 — elevated approach over water
        {
            par: 5,
            region: [0.08, 0.08, 0.92, 0.92],
            start: [0.12, 0.88],
            cup: [0.75, 0.15],
            walls: [[[0.25, 0.55], [0.55, 0.55]], [[0.55, 0.55], [0.55, 0.25]]],
            water: [{ x: 0.72, y: 0.55, r: 42 }],
            sand: [{ x: 0.35, y: 0.72, r: 24 }],
            planks: [{ x: 0.42, y: 0.48, w: 60, h: 10, angle: -0.25 }]
        },
        // 13 — timed gate on narrow fairway
        {
            par: 4,
            region: [0.25, 0.18, 0.75, 0.82],
            start: [0.12, 0.5],
            cup: [0.88, 0.5],
            walls: [[[0.38, 0.2], [0.38, 0.8]], [[0.62, 0.2], [0.62, 0.8]]],
            gates: [{ x: 0.5, y: 0.5, w: 16, h: 65, interval: 2000 }],
            sand: [{ x: 0.5, y: 0.72, r: 20 }, { x: 0.5, y: 0.28, r: 20 }]
        },
        // 14 — windmill blocks direct line
        {
            par: 4,
            region: [0.1, 0.22, 0.9, 0.78],
            start: [0.08, 0.75],
            cup: [0.92, 0.25],
            windmills: [{ x: 0.48, y: 0.48, len: 50, speed: 0.032 }],
            sand: [{ x: 0.3, y: 0.55, r: 24 }, { x: 0.72, y: 0.38, r: 22 }],
            walls: [[[0.62, 0.55], [0.85, 0.55]]]
        },
        // 15 — double water carry
        {
            par: 5,
            region: [0.06, 0.28, 0.94, 0.72],
            start: [0.05, 0.5],
            cup: [0.95, 0.5],
            water: [{ x: 0.32, y: 0.5, r: 30 }, { x: 0.62, y: 0.5, r: 30 }],
            sand: [{ x: 0.48, y: 0.35, r: 20 }, { x: 0.48, y: 0.65, r: 20 }],
            breaks: [{ x: 0.82, y: 0.45, r: 26, angle: -0.15, str: 0.018 }]
        },
        // 16 — island green surrounded by water
        {
            par: 4,
            region: [0.2, 0.2, 0.8, 0.8],
            start: [0.12, 0.5],
            cup: [0.58, 0.5],
            water: [{ x: 0.58, y: 0.5, r: 52, inner: 20 }],
            sand: [{ x: 0.28, y: 0.38, r: 22 }, { x: 0.28, y: 0.62, r: 22 }],
            walls: [[[0.72, 0.25], [0.72, 0.75]]]
        },
        // 17 — diagonal wall + spinner + bunkers
        {
            par: 5,
            region: [0.08, 0.12, 0.92, 0.88],
            start: [0.1, 0.88],
            cup: [0.9, 0.12],
            walls: [[[0.22, 0.35], [0.78, 0.65]]],
            windmills: [{ x: 0.5, y: 0.42, len: 42, speed: 0.025 }],
            sand: [{ x: 0.35, y: 0.55, r: 26 }, { x: 0.65, y: 0.35, r: 24 }],
            bricks: [{ x: 0.55, y: 0.72, w: 20, h: 20, angle: 0.4 }],
            breaks: [{ x: 0.78, y: 0.22, r: 28, angle: 0.9, str: 0.02 }]
        },
        // 18 — championship: moat, gate, windmill
        {
            par: 6,
            region: [0.04, 0.06, 0.96, 0.94],
            start: [0.06, 0.5],
            cup: [0.78, 0.5],
            water: [{ x: 0.55, y: 0.5, r: 48, inner: 16 }],
            walls: [[[0.28, 0.22], [0.28, 0.78]], [[0.72, 0.22], [0.72, 0.78]]],
            gates: [{ x: 0.28, y: 0.5, w: 14, h: 55, interval: 1800 }],
            windmills: [{ x: 0.42, y: 0.35, len: 38, speed: 0.03 }],
            sand: [{ x: 0.12, y: 0.35, r: 24 }, { x: 0.12, y: 0.65, r: 24 }],
            breaks: [{ x: 0.78, y: 0.42, r: 30, angle: -0.1, str: 0.022 }]
        }
    ];

    const defs = holeNumber < 9 ? classic[holeNumber] : challenge[holeNumber - 9];
    if (!defs) {
        return buildFromDef({
            par: 3,
            start: [0.1, 0.5],
            cup: [0.9, 0.5],
            sand: [{ x: 0.5, y: 0.5, r: 25 }]
        });
    }

    return buildFromDef(defs);
}
