// Utility functions for the retro arcade
class Utils {
    // Generate random number between min and max
    static random(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    // Generate random integer between min and max (inclusive)
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Clamp value between min and max
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    // Calculate distance between two points
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Check if two rectangles overlap
    static rectOverlap(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    // Linear interpolation
    static lerp(start, end, factor) {
        return start + (end - start) * factor;
    }
    
    // Convert degrees to radians
    static degToRad(degrees) {
        return degrees * Math.PI / 180;
    }
    
    // Convert radians to degrees
    static radToDeg(radians) {
        return radians * 180 / Math.PI;
    }
    
    // Format time as MM:SS
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Format score with commas
    static formatScore(score) {
        return score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

// High Score Manager
class HighScoreManager {
    constructor() {
        this.scores = this.loadScores();
        this.pendingScore = null; // Store pending score for name entry
    }
    
    loadScores() {
        const saved = localStorage.getItem('retroArcadeScores');
        return saved ? JSON.parse(saved) : {
            breakout: [],
            jezzball: [],
            racing: [],
            workingMan: [],
            tetris: [],
            'mouse-pacman': []
        };
    }
    
    saveScores() {
        localStorage.setItem('retroArcadeScores', JSON.stringify(this.scores));
    }
    
    checkHighScore(game, score) {
        if (!this.scores[game]) {
            this.scores[game] = [];
        }
        
        // Check if this score qualifies for top 10
        if (this.scores[game].length < 10) {
            return true; // Always qualify if less than 10 scores
        }
        
        // Check if score is higher than the lowest score
        const lowestScore = Math.min(...this.scores[game].map(s => s.score));
        return score > lowestScore;
    }
    
    addScore(game, score, playerName = 'Player') {
        if (!this.scores[game]) {
            this.scores[game] = [];
        }
        
        // Only add if it qualifies for top 10
        if (this.checkHighScore(game, score)) {
            this.scores[game].push({
                score: score,
                player: playerName,
                date: new Date().toISOString()
            });
            
            // Sort by score (descending) and keep only top 10
            this.scores[game].sort((a, b) => b.score - a.score);
            this.scores[game] = this.scores[game].slice(0, 10);
            
            this.saveScores();
            this.updateDisplay(game);
        }
    }
    
    requestNameEntry(game, score) {
        this.pendingScore = { game, score };
        this.showNameEntryModal(score);
    }
    
    showNameEntryModal(score) {
        const modal = document.getElementById('name-entry-modal');
        const scoreDisplay = document.getElementById('new-score-display');
        
        // Format score display - all games use score format (points)
        scoreDisplay.textContent = Utils.formatScore(score);
        
        // Clear initials inputs
        document.getElementById('initial1').value = '';
        document.getElementById('initial2').value = '';
        document.getElementById('initial3').value = '';
        
        // Focus first input
        document.getElementById('initial1').focus();
        
        // Show modal
        modal.classList.add('active');
    }
    
    saveScoreWithName() {
        if (!this.pendingScore) return;
        
        const initial1 = document.getElementById('initial1').value.toUpperCase();
        const initial2 = document.getElementById('initial2').value.toUpperCase();
        const initial3 = document.getElementById('initial3').value.toUpperCase();
        
        // Default to "AAA" if no initials entered
        const initials = (initial1 + initial2 + initial3).padEnd(3, 'A');
        
        this.addScore(this.pendingScore.game, this.pendingScore.score, initials);
        this.closeNameEntryModal();
    }
    
    skipScore() {
        if (!this.pendingScore) return;
        
        this.addScore(this.pendingScore.game, this.pendingScore.score, 'AAA');
        this.closeNameEntryModal();
    }
    
    closeNameEntryModal() {
        const modal = document.getElementById('name-entry-modal');
        modal.classList.remove('active');
        this.pendingScore = null;
    }
    
    getTopScore(game) {
        if (!this.scores[game] || this.scores[game].length === 0) {
            return 0;
        }
        return this.scores[game][0].score;
    }
    
    updateDisplay(game) {
        // Handle legacy 'racing' game name for HTML element
        const elementId = game === 'micro-racing' ? 'micro-racing-score' : `${game}-score`;
        const element = document.getElementById(elementId);
        if (element) {
            const topScore = this.getTopScore(game);
            // All games use score format (points), not time
            element.textContent = topScore > 0 ? Utils.formatScore(topScore) : '0';
        }
    }
}

// Initialize high score manager
const highScoreManager = new HighScoreManager();
