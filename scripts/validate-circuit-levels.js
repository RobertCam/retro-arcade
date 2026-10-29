#!/usr/bin/env node
/** Verify generated Circuit Breaker levels are filled, closed, and solvable. */
const fs = require('fs');
const path = require('path');

const genSrc = fs.readFileSync(path.join(__dirname, '../js/games/circuit-breaker-gen.js'), 'utf8');
const specSrc = fs.readFileSync(path.join(__dirname, '../js/games/circuit-breaker-levels.js'), 'utf8');
eval(genSrc);
eval(specSrc.replace('const CIRCUIT_BREAKER_LEVELS', 'globalThis.CIRCUIT_BREAKER_LEVELS'));

function gridFrom(level, useSolution) {
    const grid = Array.from({ length: level.rows }, () => Array(level.cols).fill(null));
    for (const cell of level.cells) {
        grid[cell.row][cell.col] = {
            type: cell.type,
            rotation: useSolution ? (cell.solutionRotation ?? cell.rotation) : cell.rotation,
            fixed: !!cell.fixed
        };
    }
    return grid;
}

const ALLOWED = new Set(['source', 'sink', 'straight', 'corner']);
let bad = 0;

CIRCUIT_BREAKER_LEVELS.forEach((spec, i) => {
    const seeds = [(i + 1) * 9973, (i + 1) * 9973 + 104729, (i + 7) * 4243];
    seeds.forEach((seed) => {
        const level = generateCircuitLevel(spec, seed);
        const filled = level.cells.length === spec.cols * spec.rows;
        const unique = new Set(level.cells.map((c) => `${c.col},${c.row}`)).size === spec.cols * spec.rows;
        const typesOk = level.cells.every((c) => ALLOWED.has(c.type));
        const sources = level.cells.filter((c) => c.type === 'source').length;
        const sinks = level.cells.filter((c) => c.type === 'sink').length;
        const solved = evaluateClosedCircuit(gridFrom(level, true), spec.cols, spec.rows);
        const scrambled = evaluateClosedCircuit(gridFrom(level, false), spec.cols, spec.rows);
        const ok = filled && unique && typesOk && sources === 1 && sinks === 1 &&
            solved.ok && spec.time > 0 && !scrambled.ok;
        if (!ok) {
            bad++;
            console.log(
                `Level ${i + 1} seed ${seed}: FAIL filled=${filled} unique=${unique} ` +
                `src/snk=${sources}/${sinks} solved=${solved.ok} open=${solved.open} ` +
                `covered=${solved.covered}/${solved.full} scrambledClosed=${scrambled.ok}`
            );
        } else if (seed === seeds[0]) {
            console.log(`Level ${i + 1}: OK ${spec.cols}x${spec.rows} t=${spec.time}s par=${level.parMoves}`);
        }
    });
});

if (bad) {
    console.error(`${bad} generated puzzles failed solvability checks`);
    process.exit(1);
}
console.log('All Circuit Breaker puzzles are filled, closed, and solvable.');
