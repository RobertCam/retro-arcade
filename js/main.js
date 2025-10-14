// Main application logic
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all game previews
    initBreakout();
    initJezzball();
    initRacing();
    initWorkingMan();
    
    // Update high score displays
    highScoreManager.updateDisplay('breakout');
    highScoreManager.updateDisplay('jezzball');
    highScoreManager.updateDisplay('racing');
    highScoreManager.updateDisplay('workingMan');
    
    // Add click handlers for arcade cabinets
    const arcadeCabinets = document.querySelectorAll('.arcade-cabinet');
    arcadeCabinets.forEach(cabinet => {
        cabinet.addEventListener('click', function(e) {
            // Don't trigger if clicking on scores button
            if (e.target.classList.contains('scores-btn')) {
                return;
            }
            const game = this.dataset.game;
            openGame(game);
        });
    });
    
    // Add click handlers for scores buttons
    const scoresButtons = document.querySelectorAll('.scores-btn');
    scoresButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent cabinet click
            const game = this.dataset.game;
            showHighScores(game);
        });
    });
    
    // Add keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.code === 'Escape') {
            // Close name entry modal if open
            if (document.getElementById('name-entry-modal').classList.contains('active')) {
                highScoreManager.skipScore();
            }
            // Close high scores modal if open
            else if (document.getElementById('scores-modal').classList.contains('active')) {
                closeHighScores();
            }
            // Return to lobby if in a game
            else if (document.querySelector('.game-container')) {
                closeGame();
            }
        }
        
        // Handle Enter key in name entry
        if (e.code === 'Enter' && document.getElementById('name-entry-modal').classList.contains('active')) {
            highScoreManager.saveScoreWithName();
        }
    });
    
    // Close modal when clicking outside
    document.getElementById('scores-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeHighScores();
        }
    });
    
    document.getElementById('name-entry-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            highScoreManager.skipScore();
        }
    });
    
    // Close button handlers
    document.getElementById('close-scores').addEventListener('click', closeHighScores);
    document.getElementById('save-score').addEventListener('click', () => highScoreManager.saveScoreWithName());
    document.getElementById('skip-score').addEventListener('click', () => highScoreManager.skipScore());
    
    // Handle initials input navigation
    setupInitialsInput();
});

function openGame(gameName) {
    // Hide lobby
    document.querySelector('.arcade-lobby').style.display = 'none';
    
    // Create game container
    const gameContainer = document.createElement('div');
    gameContainer.className = 'game-container';
    gameContainer.innerHTML = `
        <div class="game-header">
            <button id="back-btn" class="back-btn">← Back to Lobby</button>
            <h2 id="game-title">${getGameTitle(gameName)}</h2>
        </div>
        <canvas id="game-canvas" class="game-canvas" width="800" height="600"></canvas>
        <div class="game-controls">
            <div class="controls-info">
                <p id="controls-text">${getGameControls(gameName)}</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(gameContainer);
    
    // Add back button handler
    document.getElementById('back-btn').addEventListener('click', closeGame);
    
    // Initialize the selected game
    initializeGame(gameName);
}

function closeGame() {
    // Remove game container
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        gameContainer.remove();
    }
    
    // Show lobby
    document.querySelector('.arcade-lobby').style.display = 'flex';
    
    // Update high scores
    highScoreManager.updateDisplay('breakout');
    highScoreManager.updateDisplay('jezzball');
    highScoreManager.updateDisplay('racing');
    highScoreManager.updateDisplay('workingMan');
}

function getGameTitle(gameName) {
    const titles = {
        'breakout': 'Breakout',
        'jezzball': 'Jezzball',
        'racing': 'Micro Racing',
        'workingMan': 'Working Man vs Oligarch'
    };
    return titles[gameName] || 'Game';
}

function getGameControls(gameName) {
    const controls = {
        'breakout': 'Arrow Keys: Move paddle | Space: Start/Pause | P: Pause',
        'jezzball': 'Mouse: Draw lines | Space: Start | R: Reset',
        'racing': 'Arrow Keys: Steer | Space: Accelerate | R: Reset',
        'workingMan': 'Arrow Keys: Move | Space: Jump | R: Reset'
    };
    return controls[gameName] || 'Check game instructions';
}

function initializeGame(gameName) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    
    // Clear any existing game
    canvas.innerHTML = '';
    
    switch (gameName) {
        case 'breakout':
            new BreakoutGame(canvas);
            break;
        case 'jezzball':
            new JezzballGame(canvas);
            break;
        case 'racing':
            // new RacingGame(canvas);
            showComingSoon('Micro Racing');
            break;
        case 'workingMan':
            // new WorkingManGame(canvas);
            showComingSoon('Working Man vs Oligarch');
            break;
    }
}

function showComingSoon(gameName) {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw coming soon message
    ctx.fillStyle = '#00ffff';
    ctx.font = '48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('COMING SOON', canvas.width / 2, canvas.height / 2 - 50);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Courier New';
    ctx.fillText(gameName, canvas.width / 2, canvas.height / 2);
    
    ctx.fillStyle = '#666666';
    ctx.font = '16px Courier New';
    ctx.fillText('This game is under development', canvas.width / 2, canvas.height / 2 + 50);
    
    ctx.textAlign = 'left';
}

function showHighScores(gameName) {
    const modal = document.getElementById('scores-modal');
    const title = document.getElementById('scores-game-title');
    const list = document.getElementById('scores-list');
    
    // Set title
    title.textContent = `${getGameTitle(gameName).toUpperCase()} HIGH SCORES`;
    
    // Get scores
    const scores = highScoreManager.scores[gameName] || [];
    
    // Clear list
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
            if (gameName === 'racing') {
                value.textContent = Utils.formatTime(score.score);
            } else {
                value.textContent = Utils.formatScore(score.score);
            }
            
            scoreItem.appendChild(rank);
            scoreItem.appendChild(player);
            scoreItem.appendChild(value);
            list.appendChild(scoreItem);
        });
    }
    
    // Show modal
    modal.classList.add('active');
}

function closeHighScores() {
    const modal = document.getElementById('scores-modal');
    modal.classList.remove('active');
}

function setupInitialsInput() {
    const inputs = ['initial1', 'initial2', 'initial3'];
    
    inputs.forEach((id, index) => {
        const input = document.getElementById(id);
        
        input.addEventListener('input', function(e) {
            // Only allow letters
            this.value = this.value.replace(/[^A-Za-z]/g, '').toUpperCase();
            
            // Auto-advance to next input
            if (this.value.length === 1 && index < inputs.length - 1) {
                document.getElementById(inputs[index + 1]).focus();
            }
        });
        
        input.addEventListener('keydown', function(e) {
            // Handle backspace to go to previous input
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
