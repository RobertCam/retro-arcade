/**
 * Circuit Breaker level generator.
 * Builds a Hamiltonian START→END path that fills every cell, then scrambles rotations.
 * Always solvable. Winning only requires a sealed START→END run; leftover tiles may sit unused.
 */
(function (root) {
    const MASKS = { straight: 0b0101, corner: 0b0011, source: 0b0010, sink: 0b0010 };
    const DELTA = {
        N: { dc: 0, dr: -1, out: 1, in: 4 },
        E: { dc: 1, dr: 0, out: 2, in: 8 },
        S: { dc: 0, dr: 1, out: 4, in: 1 },
        W: { dc: -1, dr: 0, out: 8, in: 2 }
    };

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0;
            a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function rotMask(mask, rot) {
        let m = mask;
        for (let i = 0; i < ((rot % 4) + 4) % 4; i++) {
            let next = 0;
            if (m & 1) next |= 2;
            if (m & 2) next |= 4;
            if (m & 4) next |= 8;
            if (m & 8) next |= 1;
            m = next;
        }
        return m;
    }

    function shuffle(arr, rng) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    function dirBetween(a, b) {
        if (b.c === a.c && b.r === a.r - 1) return 'N';
        if (b.c === a.c + 1 && b.r === a.r) return 'E';
        if (b.c === a.c && b.r === a.r + 1) return 'S';
        if (b.c === a.c - 1 && b.r === a.r) return 'W';
        return null;
    }

    function snakePath(cols, rows, variant) {
        const path = [];
        const v = variant % 4;
        for (let r = 0; r < rows; r++) {
            const row = v === 1 ? rows - 1 - r : r;
            const ltr = (r % 2 === 0) !== (v >= 2);
            if (ltr) {
                for (let c = 0; c < cols; c++) path.push({ c, r: row });
            } else {
                for (let c = cols - 1; c >= 0; c--) path.push({ c, r: row });
            }
        }
        return path;
    }

    function pathIsValid(path, cols, rows) {
        if (!path || path.length !== cols * rows) return false;
        const seen = new Set();
        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            if (p.c < 0 || p.r < 0 || p.c >= cols || p.r >= rows) return false;
            const key = `${p.c},${p.r}`;
            if (seen.has(key)) return false;
            seen.add(key);
            if (i > 0 && !dirBetween(path[i - 1], p)) return false;
        }
        return true;
    }

    function perturbPath(path, cols, rows, rng, flips) {
        const n = path.length;
        for (let k = 0; k < flips; k++) {
            const indexOf = new Map();
            path.forEach((p, idx) => indexOf.set(`${p.c},${p.r}`, idx));
            const i = Math.floor(rng() * Math.max(1, n - 2));
            const a = path[i];
            const nbs = shuffle([
                { c: a.c, r: a.r - 1 },
                { c: a.c + 1, r: a.r },
                { c: a.c, r: a.r + 1 },
                { c: a.c - 1, r: a.r }
            ], rng);
            for (const nb of nbs) {
                if (nb.c < 0 || nb.r < 0 || nb.c >= cols || nb.r >= rows) continue;
                const j = indexOf.get(`${nb.c},${nb.r}`);
                if (j == null || j < i + 2) continue;
                if (j < n - 1 && !dirBetween(path[i + 1], path[j + 1])) continue;
                const slice = path.slice(i + 1, j + 1).reverse();
                path.splice(i + 1, j - i, ...slice);
                break;
            }
        }
        return path;
    }

    function cornerRot(d1, d2) {
        const s = d1 + d2;
        if (s === 'NE' || s === 'EN') return 0;
        if (s === 'ES' || s === 'SE') return 1;
        if (s === 'SW' || s === 'WS') return 2;
        if (s === 'WN' || s === 'NW') return 3;
        return 0;
    }

    function singleDirRot(dir) {
        return { E: 0, S: 1, W: 2, N: 3 }[dir] ?? 0;
    }

    function pathToCells(path) {
        const cells = [];
        for (let i = 0; i < path.length; i++) {
            const cur = path[i];
            if (i === 0) {
                const out = dirBetween(cur, path[1]);
                cells.push({
                    col: cur.c, row: cur.r, type: 'source', fixed: true,
                    rotation: singleDirRot(out), solutionRotation: singleDirRot(out)
                });
                continue;
            }
            if (i === path.length - 1) {
                const inn = dirBetween(cur, path[i - 1]);
                cells.push({
                    col: cur.c, row: cur.r, type: 'sink', fixed: true,
                    rotation: singleDirRot(inn), solutionRotation: singleDirRot(inn)
                });
                continue;
            }
            const dIn = dirBetween(cur, path[i - 1]);
            const dOut = dirBetween(cur, path[i + 1]);
            const opposite = (dIn === 'N' && dOut === 'S') || (dIn === 'S' && dOut === 'N') ||
                (dIn === 'E' && dOut === 'W') || (dIn === 'W' && dOut === 'E');
            if (opposite) {
                const rot = (dIn === 'E' || dIn === 'W' || dOut === 'E' || dOut === 'W') ? 1 : 0;
                cells.push({
                    col: cur.c, row: cur.r, type: 'straight',
                    rotation: rot, solutionRotation: rot
                });
            } else {
                const rot = cornerRot(dIn, dOut);
                cells.push({
                    col: cur.c, row: cur.r, type: 'corner',
                    rotation: rot, solutionRotation: rot
                });
            }
        }
        return cells;
    }

    function getMask(tile) {
        return rotMask(MASKS[tile.type] ?? 0, tile.rotation ?? 0);
    }

    function armIsMatched(grid, cols, rows, c, r, dir) {
        const d = DELTA[dir];
        const nc = c + d.dc;
        const nr = r + d.dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) return false;
        const n = grid[nr][nc];
        return !!(n && (getMask(n) & d.in));
    }

    function evaluateClosedCircuit(grid, cols, rows) {
        let sources = 0;
        let sinks = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c]?.type === 'source') sources++;
                if (grid[r][c]?.type === 'sink') sinks++;
            }
        }

        const powered = new Set();
        const q = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c]?.type === 'source') {
                    powered.add(`${c},${r}`);
                    q.push({ c, r });
                }
            }
        }
        while (q.length) {
            const { c, r } = q.shift();
            const mask = getMask(grid[r][c]);
            for (const dir of ['N', 'E', 'S', 'W']) {
                const d = DELTA[dir];
                if (!(mask & d.out)) continue;
                if (!armIsMatched(grid, cols, rows, c, r, dir)) continue;
                const nc = c + d.dc;
                const nr = r + d.dr;
                const k = `${nc},${nr}`;
                if (!powered.has(k)) {
                    powered.add(k);
                    q.push({ c: nc, r: nr });
                }
            }
        }

        let sinkPowered = false;
        let open = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tile = grid[r][c];
                if (!tile) continue;
                if (tile.type === 'sink' && powered.has(`${c},${r}`)) sinkPowered = true;
                if (!powered.has(`${c},${r}`)) continue;
                const mask = getMask(tile);
                for (const dir of ['N', 'E', 'S', 'W']) {
                    const d = DELTA[dir];
                    if (!(mask & d.out)) continue;
                    if (!armIsMatched(grid, cols, rows, c, r, dir)) open++;
                }
            }
        }

        const full = cols * rows;
        const ok = sources === 1 && sinks === 1 && sinkPowered && open === 0;
        return { ok, open, powered, sinkPowered, covered: powered.size, full, sources, sinks };
    }

    function cellsToGrid(cells, cols, rows) {
        const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
        for (const cell of cells) {
            grid[cell.row][cell.col] = {
                type: cell.type,
                rotation: cell.rotation ?? 0,
                fixed: !!cell.fixed,
                solutionRotation: cell.solutionRotation ?? cell.rotation ?? 0
            };
        }
        return grid;
    }

    function scrambleCells(cells, rng) {
        let par = 0;
        for (const cell of cells) {
            if (cell.fixed || cell.type === 'source' || cell.type === 'sink') continue;
            const sol = cell.solutionRotation ?? 0;
            if (cell.type === 'straight') {
                const flip = rng() < 0.78;
                cell.rotation = flip ? (sol + 1) % 2 : sol;
                if (flip) par += 1;
            } else {
                const extra = 1 + Math.floor(rng() * 3);
                cell.rotation = (sol + extra) % 4;
                par += Math.min(extra, 4 - extra);
            }
        }
        return par;
    }

    function scrambleUntilOpen(cells, cols, rows, rng) {
        let par = 0;
        for (let attempt = 0; attempt < 8; attempt++) {
            par = scrambleCells(cells, rng);
            if (!evaluateClosedCircuit(cellsToGrid(cells, cols, rows), cols, rows).ok) {
                return par;
            }
        }
        for (const cell of cells) {
            if (cell.fixed || cell.type === 'source' || cell.type === 'sink') continue;
            if (cell.type === 'straight') cell.rotation = (cell.rotation + 1) % 2;
            else cell.rotation = (cell.rotation + 1) % 4;
            par += 1;
        }
        return par;
    }

    function generateCircuitLevel(spec, seed) {
        const cols = spec.cols;
        const rows = spec.rows;
        const rng = mulberry32(seed);
        let path = snakePath(cols, rows, Math.floor(rng() * 4));
        perturbPath(path, cols, rows, rng, 80 + cols * rows * 3);
        if (!pathIsValid(path, cols, rows)) {
            path = snakePath(cols, rows, 0);
        }
        let cells = pathToCells(path);
        const solved = cellsToGrid(
            cells.map((c) => ({ ...c, rotation: c.solutionRotation })),
            cols,
            rows
        );
        if (!evaluateClosedCircuit(solved, cols, rows).ok) {
            cells = pathToCells(snakePath(cols, rows, 0));
        }
        const parMoves = scrambleUntilOpen(cells, cols, rows, rng);
        return {
            cols,
            rows,
            time: spec.time,
            parMoves,
            cells
        };
    }

    root.CB_GEN_MASKS = MASKS;
    root.CB_GEN_DELTA = DELTA;
    root.cbRotMask = rotMask;
    root.evaluateClosedCircuit = evaluateClosedCircuit;
    root.generateCircuitLevel = generateCircuitLevel;
    root.cbMulberry32 = mulberry32;
})(typeof window !== 'undefined' ? window : globalThis);
