// Main application logic
let currentGameInstance = null;
let lobbyAmbientStarted = false;

function isInGameView() {
    return !!document.querySelector('.game-container');
}

function ensureLobbyAmbient() {
    // Never start/restart lobby music while a game is open
    if (isInGameView()) return;
    if (typeof audioManager === 'undefined') return;
    // Browsers block audio until a user gesture — unlock then play
    audioManager.unlock().then(() => {
        if (isInGameView()) return;
        if (audioManager.isMuted() || audioManager.isMusicMuted()) return;
        audioManager.playLobbyAmbient();
        lobbyAmbientStarted = true;
    });
}

/** Start lobby music on first lobby interaction (autoplay policies block true on-load audio). */
function setupLobbyMusicOnGesture() {
    const maybeStart = (e) => {
        if (isInGameView()) return;
        // Opening a cabinet goes straight to game music — don't prime lobby first
        if (e && e.target && e.target.closest) {
            const cabinet = e.target.closest('.arcade-cabinet');
            if (cabinet && !e.target.closest('.scores-btn')) return;
        }
        ensureLobbyAmbient();
    };

    document.addEventListener('pointerdown', maybeStart);
    document.addEventListener('keydown', maybeStart);
}

document.addEventListener('DOMContentLoaded', function() {
    initBreakout();
    initJezzball();
    initRivetRage();
    initTetris();
    initMousePacman();
    initMinigolf();
    initSpaceInvaders();
    initCircuitBreaker();
    initTidehold();

    highScoreManager.updateDisplay('breakout');
    highScoreManager.updateDisplay('jezzball');
    highScoreManager.updateDisplay('rivet-rage');
    highScoreManager.updateDisplay('tetris');
    highScoreManager.updateDisplay('mouse-pacman');
    highScoreManager.updateDisplay('minigolf');
    highScoreManager.updateDisplay('space-invaders');
    highScoreManager.updateDisplay('circuit-breaker');
    highScoreManager.updateDisplay('tidehold');

    setupAudioControls();
    setupLobbyMusicOnGesture();

    const arcadeCabinets = document.querySelectorAll('.arcade-cabinet');
    arcadeCabinets.forEach(cabinet => {
        cabinet.addEventListener('click', function(e) {
            if (e.target.classList.contains('scores-btn')) return;
            // Don't start lobby music here — openGame switches to the game theme
            audioManager.unlock().then(() => {
                audioManager.playSfx('click');
                audioManager.preloadMusicThemes();
            });
            openGame(this.dataset.game);
        });
    });

    const scoresButtons = document.querySelectorAll('.scores-btn');
    scoresButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            audioManager.unlock().then(() => {
                ensureLobbyAmbient();
                audioManager.playSfx('click');
            });
            showHighScores(this.dataset.game);
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.code === 'Escape') {
            if (document.getElementById('name-entry-modal').classList.contains('active')) {
                highScoreManager.skipScore();
            } else if (document.getElementById('scores-modal').classList.contains('active')) {
                closeHighScores();
            } else if (document.querySelector('.game-container')) {
                closeGame();
            }
        }

        if (e.code === 'Enter' && document.getElementById('name-entry-modal').classList.contains('active')) {
            highScoreManager.saveScoreWithName();
        }
    });

    document.getElementById('scores-modal').addEventListener('click', function(e) {
        if (e.target === this) closeHighScores();
    });

    document.getElementById('name-entry-modal').addEventListener('click', function(e) {
        if (e.target === this) highScoreManager.skipScore();
    });

    document.getElementById('close-scores').addEventListener('click', closeHighScores);
    document.getElementById('save-score').addEventListener('click', () => highScoreManager.saveScoreWithName());
    document.getElementById('skip-score').addEventListener('click', () => highScoreManager.skipScore());

    setupInitialsInput();
});

function setupAudioControls() {
    const muteBtn = document.getElementById('mute-btn');
    const musicMuteBtn = document.getElementById('music-mute-btn');
    if (!muteBtn) return;

    const updateLabels = () => {
        muteBtn.textContent = audioManager.isMuted() ? '🔇' : '🔊';
        muteBtn.setAttribute('aria-label', audioManager.isMuted() ? 'Unmute' : 'Mute');
        muteBtn.classList.toggle('is-off', audioManager.isMuted());
        if (musicMuteBtn) {
            musicMuteBtn.textContent = audioManager.isMusicMuted() ? '🎶' : '🎵';
            musicMuteBtn.setAttribute(
                'aria-label',
                audioManager.isMusicMuted() ? 'Unmute music' : 'Mute music'
            );
            musicMuteBtn.classList.toggle('is-off', audioManager.isMusicMuted());
        }
    };

    updateLabels();
    muteBtn.addEventListener('click', () => {
        audioManager.unlock().then(() => {
            ensureLobbyAmbient();
            audioManager.toggleMute();
            updateLabels();
            if (!audioManager.isMuted()) audioManager.playSfx('click');
        });
    });

    if (musicMuteBtn) {
        musicMuteBtn.addEventListener('click', () => {
            audioManager.unlock().then(() => {
                ensureLobbyAmbient();
                audioManager.toggleMusicMute();
                updateLabels();
                if (!audioManager.isMuted()) audioManager.playSfx('click');
            });
        });
    }
}

function showGameLoading() {
    let overlay = document.getElementById('game-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'game-loading-overlay';
        overlay.className = 'game-loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div><p>Loading...</p>';
        document.body.appendChild(overlay);
    }
    overlay.classList.add('active');
}

function hideGameLoading() {
    const overlay = document.getElementById('game-loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

function openGame(gameName) {
    if (currentGameInstance && typeof currentGameInstance.cleanup === 'function') {
        currentGameInstance.cleanup();
    }
    currentGameInstance = null;

    const existingContainer = document.querySelector('.game-container');
    if (existingContainer) existingContainer.remove();

    document.querySelector('.arcade-lobby').style.display = 'none';
    showGameLoading();

    if (typeof audioManager !== 'undefined') {
        // Stop lobby immediately (sync), then start game theme after unlock
        audioManager.stopMusic();
        audioManager.activeTheme = gameName;
        audioManager.unlock().then(() => {
            // Bail if user already left this game
            if (!isInGameView()) return;
            audioManager.playGameMusic(gameName);
        });
    }

    const gameContainer = document.createElement('div');
    gameContainer.className = 'game-container';
    gameContainer.innerHTML = `
        <div class="game-header">
            <button id="back-btn" class="back-btn">← Back to Lobby</button>
            <h2 id="game-title">${getGameTitle(gameName)}</h2>
        </div>
        <div class="game-content-wrapper">
            <canvas id="game-canvas" class="game-canvas" width="800" height="600"></canvas>
            <div id="game-stats-panel" class="game-stats-panel">
                <div class="stats-content"></div>
            </div>
        </div>
        <div class="game-controls">
            <div class="controls-info">
                <p id="controls-text">${getGameControls(gameName)}</p>
            </div>
        </div>
    `;

    document.body.appendChild(gameContainer);
    document.getElementById('back-btn').addEventListener('click', closeGame);

    initializeGame(gameName);

    if (currentGameInstance) {
        let loadingHidden = false;
        const hideOnce = () => {
            if (loadingHidden) return;
            loadingHidden = true;
            hideGameLoading();
        };
        currentGameInstance.onReady = hideOnce;
        if (currentGameInstance.isReady) hideOnce();
        setTimeout(hideOnce, 8000);
    } else {
        hideGameLoading();
    }
}

function closeGame() {
    if (currentGameInstance && typeof currentGameInstance.cleanup === 'function') {
        currentGameInstance.cleanup();
    }
    currentGameInstance = null;

    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) gameContainer.remove();

    hideGameLoading();
    document.querySelector('.arcade-lobby').style.display = 'flex';

    if (typeof audioManager !== 'undefined') {
        audioManager.stopMusic();
        lobbyAmbientStarted = true;
        audioManager.unlock().then(() => {
            if (isInGameView()) return;
            audioManager.playLobbyAmbient();
        });
    }

    highScoreManager.updateDisplay('breakout');
    highScoreManager.updateDisplay('jezzball');
    highScoreManager.updateDisplay('rivet-rage');
    highScoreManager.updateDisplay('tetris');
    highScoreManager.updateDisplay('mouse-pacman');
    highScoreManager.updateDisplay('minigolf');
    highScoreManager.updateDisplay('space-invaders');
    highScoreManager.updateDisplay('circuit-breaker');
    highScoreManager.updateDisplay('tidehold');
}

function getGameTitle(gameName) {
    const titles = {
        'breakout': 'Neon Shards',
        'jezzball': 'Containment Grid',
        'rivet-rage': 'Rivet Rage',
        'tetris': 'Tetra Stack',
        'mouse-pacman': 'Mousetrap',
        'minigolf': 'Mini Golf',
        'space-invaders': 'Star Siege',
        'circuit-breaker': 'Circuit Breaker',
        'tidehold': 'Tidehold'
    };
    return titles[gameName] || 'Game';
}

function getGameControls(gameName) {
    const controls = {
        'breakout': 'Arrow Keys: Move paddle | Space: Start/Pause | P: Pause | 1-3: Difficulty',
        'jezzball': 'Mouse: Draw lines | Control: Change line direction | Space: Start | R: Reset',
        'rivet-rage': 'Arrows/WASD: Move | Auto-aim fire | 1-3: Level-up pick | Space: Pause | R: Reset',
        'tetris': 'Arrow Keys: Move/Rotate | Down: Soft Drop | Space: Hard Drop | X: Rotate | P: Pause | R: Reset',
        'mouse-pacman': '← → / A D: Turn | ↓ / S: Reverse | ↑ hold lane | Space: Start/Pause | P: Pause | R: Reset',
        'minigolf': 'Mouse: Drag from ball to aim and set power | Release to shoot | Space: Start | P: Pause',
        'space-invaders': '← →: Move | Space: Fire | P: Pause | R: Restart',
        'circuit-breaker': 'Click: Rotate breaker | Arrows: Select | X/R: Rotate | Enter: Throw early | P: Pause',
        'tidehold': 'Space: Start campaign / skip countdown | 1-3: Tower type | Click gold pad: Build | Select tower to specialize | P: Pause | R: Menu'
    };
    return controls[gameName] || 'Check game instructions';
}

function initializeGame(gameName) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    canvas.innerHTML = '';

    switch (gameName) {
        case 'breakout':
            currentGameInstance = new BreakoutGame(canvas);
            break;
        case 'jezzball':
            currentGameInstance = new JezzballGame(canvas);
            break;
        case 'rivet-rage':
            currentGameInstance = new RivetRageGame(canvas);
            break;
        case 'tetris':
            currentGameInstance = new TetrisGame(canvas);
            break;
        case 'mouse-pacman':
            currentGameInstance = new MousePacmanGame(canvas);
            break;
        case 'minigolf':
            currentGameInstance = new MinigolfGame(canvas);
            break;
        case 'space-invaders':
            currentGameInstance = new SpaceInvadersGame(canvas);
            break;
        case 'circuit-breaker':
            currentGameInstance = new CircuitBreakerGame(canvas);
            break;
        case 'tidehold':
            currentGameInstance = new TideholdGame(canvas);
            break;
    }

    if (currentGameInstance && shouldShowTouchControls()) {
        setupTouchControlsForGame(gameName, currentGameInstance);
    }
}

function setupTouchControlsForGame(gameName, game) {
    const wrapper = document.querySelector('.game-content-wrapper');
    if (!wrapper) return;

    if (gameName === 'breakout') {
        game.touchControls = new TouchControls(wrapper, 'breakout');
        game.touchControls.on('onDown', (action) => {
            if (action === 'left') game.keys['ArrowLeft'] = true;
            if (action === 'right') game.keys['ArrowRight'] = true;
            if (action === 'action') {
                if (game.gameState === 'menu' || game.gameState === 'gameOver') game.startGame();
                else if (game.waitingForNextTurn) game.startNextTurn();
                else game.togglePause();
            }
        });
        game.touchControls.on('onUp', (action) => {
            if (action === 'left') game.keys['ArrowLeft'] = false;
            if (action === 'right') game.keys['ArrowRight'] = false;
        });
    }

    if (gameName === 'tetris') {
        game.touchControls = new TouchControls(wrapper, 'tetris');
        game.touchControls.on('onDown', (action) => {
            if (action === 'left') game.keys['ArrowLeft'] = true;
            if (action === 'right') game.keys['ArrowRight'] = true;
            if (action === 'down') game.keys['ArrowDown'] = true;
            if (action === 'rotate') game.keys['KeyX'] = true;
            if (action === 'hardDrop') game.hardDrop();
        });
        game.touchControls.on('onUp', (action) => {
            if (action === 'left') game.keys['ArrowLeft'] = false;
            if (action === 'right') game.keys['ArrowRight'] = false;
            if (action === 'down') game.keys['ArrowDown'] = false;
            if (action === 'rotate') game.keys['KeyX'] = false;
        });
    }

    if (gameName === 'rivet-rage') {
        game.touchControls = new TouchControls(wrapper, 'arena');
        game.touchControls.on('onDown', (action) => {
            if (action === 'left') game.keys['ArrowLeft'] = true;
            if (action === 'right') game.keys['ArrowRight'] = true;
            if (action === 'up') game.keys['ArrowUp'] = true;
            if (action === 'down') game.keys['ArrowDown'] = true;
            if (action === 'action') {
                if (game.gameState === 'menu' || game.gameState === 'gameOver') game.startGame();
                else if (game.gameState === 'playing') game.gameState = 'paused';
                else if (game.gameState === 'paused') game.gameState = 'playing';
                else if (game.gameState === 'levelup') game.pickCard(0);
            }
        });
        game.touchControls.on('onUp', (action) => {
            if (action === 'left') game.keys['ArrowLeft'] = false;
            if (action === 'right') game.keys['ArrowRight'] = false;
            if (action === 'up') game.keys['ArrowUp'] = false;
            if (action === 'down') game.keys['ArrowDown'] = false;
        });
    }
}

function showHighScores(gameName) {
    const modal = document.getElementById('scores-modal');
    const title = document.getElementById('scores-game-title');
    const list = document.getElementById('scores-list');

    title.textContent = `${getGameTitle(gameName).toUpperCase()} HIGH SCORES`;

    let scoreKey = gameName;
    const scores = highScoreManager.scores[scoreKey] || [];
    list.innerHTML = '';

    if (scores.length === 0) {
        list.innerHTML = '<div class="no-scores">No scores yet!<br>Be the first to play!</div>';
    } else {
        scores.forEach((score, index) => {
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';

            const rank = document.createElement('div');
            rank.className = 'score-rank';
            rank.textContent = `#${index + 1}`;

            const player = document.createElement('div');
            player.className = 'score-player';
            player.textContent = score.player;

            const value = document.createElement('div');
            value.className = 'score-value';
            const numericScore = typeof score.score === 'number' ? score.score : parseInt(score.score) || 0;
            value.textContent = Utils.formatScore(numericScore);

            scoreItem.appendChild(rank);
            scoreItem.appendChild(player);
            scoreItem.appendChild(value);
            list.appendChild(scoreItem);
        });
    }

    modal.classList.add('active');
}

function closeHighScores() {
    document.getElementById('scores-modal').classList.remove('active');
}

function setupInitialsInput() {
    const inputs = ['initial1', 'initial2', 'initial3'];

    inputs.forEach((id, index) => {
        const input = document.getElementById(id);

        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^A-Za-z]/g, '').toUpperCase();
            if (this.value.length === 1 && index < inputs.length - 1) {
                document.getElementById(inputs[index + 1]).focus();
            }
        });

        input.addEventListener('keydown', function(e) {
            e.stopPropagation();
            if (e.code === 'Backspace' && this.value === '' && index > 0) {
                document.getElementById(inputs[index - 1]).focus();
            }
        });

        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/[^A-Za-z]/g, '').toUpperCase();
            if (pasted.length >= 3) {
                inputs.forEach((inputId, i) => {
                    document.getElementById(inputId).value = pasted[i] || '';
                });
                document.getElementById('initial3').focus();
            }
        });
    });
}
