class StoryNode {
    constructor(id, position) {
        this.id = id;
        this.position = position;
        this.content = {
            text: '',
            media: [],
            choices: []
        };
        this.connections = [];
    }
}

class StoryEditor {
    constructor() {
        this.nodes = new Map();
        this.isDragging = false;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.selectedNode = null;
        this.autosave = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupAutosave();
    }

    setupEventListeners() {
        const grid = document.getElementById('grid');
        
        // Pan functionality
        grid.addEventListener('mousedown', (e) => {
            if (e.target === grid) {
                this.isDragging = true;
                this.lastPosition = { x: e.clientX, y: e.clientY };
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastPosition.x;
                const dy = e.clientY - this.lastPosition.y;
                this.offset.x += dx;
                this.offset.y += dy;
                this.updateGridPosition();
                this.lastPosition = { x: e.clientX, y: e.clientY };
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Zoom functionality
        grid.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.scale *= delta;
            this.scale = Math.min(Math.max(0.1, this.scale), 5);
            this.updateGridPosition();
        });
    }

    updateGridPosition() {
        const grid = document.getElementById('grid');
        grid.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    }

    setupAutosave() {
        if (this.autosave) {
            setInterval(() => this.saveToJson(), 30000);
        }
    }

    async saveToJson(password) {
        const data = {
            nodes: Array.from(this.nodes.values()),
            connections: this.connections
        };

        if (password) {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            const keyBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
            const key = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                dataBuffer
            );
            
            return {
                encrypted: Array.from(new Uint8Array(encrypted)),
                iv: Array.from(iv)
            };
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'story.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return data;
    }
}

const editor = new StoryEditor();
