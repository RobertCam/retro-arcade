// Working Man vs Oligarch game implementation (placeholder)
class WorkingManGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Game state
        this.gameState = 'menu';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        
        // Draw preview
        this.drawPreview();
    }
    
    drawPreview() {
        this.ctx.fillStyle = '#110000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw platforms
        this.ctx.fillStyle = '#666666';
        this.ctx.fillRect(20, 100, 60, 10);
        this.ctx.fillRect(120, 80, 60, 10);
        this.ctx.fillRect(20, 60, 60, 10);
        
        // Draw working man
        this.ctx.fillStyle = '#0000ff';
        this.ctx.fillRect(40, 90, 8, 10); // Body
        this.ctx.fillRect(42, 88, 4, 4);  // Head
        
        // Draw oligarch
        this.ctx.fillStyle = '#ffff00';
        this.ctx.fillRect(140, 70, 8, 10); // Body
        this.ctx.fillRect(142, 68, 4, 4);  // Head
        this.ctx.fillRect(140, 66, 8, 2);  // Top hat
        
        // Draw title
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('WORKING MAN', this.width / 2, this.height - 20);
        this.ctx.fillText('VS OLIGARCH', this.width / 2, this.height - 5);
        this.ctx.textAlign = 'left';
    }
}

function initWorkingMan() {
    const canvas = document.getElementById('working-man-preview');
    if (canvas) {
        new WorkingManGame(canvas);
    }
}
