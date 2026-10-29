/**
 * Circuit Breaker level specs — filled boards, shrinking timers, growing grids.
 * Layouts are generated at runtime from a Hamiltonian START→END path (always solvable).
 */
const CIRCUIT_BREAKER_LEVELS = [
    { cols: 4, rows: 4, time: 28 },
    { cols: 4, rows: 5, time: 26 },
    { cols: 5, rows: 5, time: 28 },
    { cols: 5, rows: 6, time: 30 },
    { cols: 6, rows: 6, time: 34 },
    { cols: 6, rows: 7, time: 34 },
    { cols: 7, rows: 7, time: 38 },
    { cols: 7, rows: 8, time: 38 },
    { cols: 8, rows: 8, time: 42 },
    { cols: 8, rows: 8, time: 34 },
    { cols: 8, rows: 9, time: 40 },
    { cols: 9, rows: 9, time: 44 },
    { cols: 9, rows: 9, time: 36 },
    { cols: 9, rows: 10, time: 42 },
    { cols: 10, rows: 10, time: 46 }
];
