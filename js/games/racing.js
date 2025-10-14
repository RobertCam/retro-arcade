// Racing game implementation (placeholder)
class RacingGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Game state
        this.gameState = 'menu';
        this.bestTime = 0;
        this.lives = 3;
        this.level = 1;
        
        // Draw preview
        this.drawPreview();
    }
    
    drawPreview() {
        this.ctx.fillStyle = '#001100';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw track
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(20, 20);
        this.ctx.lineTo(180, 20);
        this.ctx.lineTo(180, 130);
        this.ctx.lineTo(20, 130);
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Draw car
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(50, 50, 20, 10);
        
        // Draw title
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MICRO RACING', this.width / 2, this.height - 10);
        this.ctx.textAlign = 'left';
    }
}

function initRacing() {
    const canvas = document.getElementById('racing-preview');
    if (canvas) {
        new RacingGame(canvas);
    }
}
