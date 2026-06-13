/**
 * On-screen touch controls for mobile play.
 */
class TouchControls {
    constructor(container, layout) {
        this.container = container;
        this.layout = layout;
        this.handlers = {};
        this.activeKeys = new Set();
        this.element = null;
        this.render();
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'touch-controls';
        this.element.innerHTML = this.buildHTML();
        this.container.appendChild(this.element);
        this.bindEvents();
    }

    buildHTML() {
        if (this.layout === 'breakout') {
            return `
                <button class="touch-btn touch-left" data-action="left" aria-label="Move left">◀</button>
                <button class="touch-btn touch-right" data-action="right" aria-label="Move right">▶</button>
                <button class="touch-btn touch-action" data-action="action" aria-label="Start or pause">⏯</button>
            `;
        }
        if (this.layout === 'tetris') {
            return `
                <button class="touch-btn touch-left" data-action="left" aria-label="Move left">◀</button>
                <button class="touch-btn touch-right" data-action="right" aria-label="Move right">▶</button>
                <button class="touch-btn touch-down" data-action="down" aria-label="Soft drop">▼</button>
                <button class="touch-btn touch-rotate" data-action="rotate" aria-label="Rotate">↻</button>
                <button class="touch-btn touch-action" data-action="hardDrop" aria-label="Hard drop">⬇</button>
            `;
        }
        return '';
    }

    bindEvents() {
        this.element.querySelectorAll('.touch-btn').forEach(btn => {
            const action = btn.dataset.action;
            const down = (e) => {
                e.preventDefault();
                this.activeKeys.add(action);
                if (this.handlers.onDown) this.handlers.onDown(action);
            };
            const up = (e) => {
                e.preventDefault();
                this.activeKeys.delete(action);
                if (this.handlers.onUp) this.handlers.onUp(action);
            };
            btn.addEventListener('touchstart', down, { passive: false });
            btn.addEventListener('touchend', up, { passive: false });
            btn.addEventListener('touchcancel', up, { passive: false });
            btn.addEventListener('mousedown', down);
            btn.addEventListener('mouseup', up);
            btn.addEventListener('mouseleave', up);
        });
    }

    on(event, handler) {
        this.handlers[event] = handler;
    }

    isActive(action) {
        return this.activeKeys.has(action);
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.activeKeys.clear();
        this.element = null;
    }
}

function shouldShowTouchControls() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
