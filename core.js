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
            const newScale = this.scale * delta;
            if (newScale >= 1.0 && newScale <= 3.0) {
                this.scale = newScale;
                this.updateGridPosition();
            }
        });

        // Autosave toggle
        const autosaveBtn = document.getElementById('autosave-toggle');
        autosaveBtn.addEventListener('click', () => {
            this.autosave = !this.autosave;
            autosaveBtn.title = `Autosave: ${this.autosave ? 'On' : 'Off'}`;
        });

        // Save JSON
        const saveBtn = document.getElementById('save-json');
        saveBtn.addEventListener('click', () => this.saveToJson());

        // Load JSON
        const loadBtn = document.getElementById('open-project');
        loadBtn.addEventListener('click', () => this.loadFromJson());

        // File menu and sub-menu
        const fileMenu = document.getElementById('file-menu');
        const fileSubmenu = document.getElementById('file-submenu');
        fileMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            fileSubmenu.classList.toggle('active');
        });

        // Nodes menu and sub-menu
        const nodesMenu = document.getElementById('nodes-menu');
        const nodesSubmenu = document.getElementById('nodes-submenu');
        nodesMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            nodesSubmenu.classList.toggle('active');
        });

        // Hide sub-menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!fileMenu.contains(e.target) && !fileSubmenu.contains(e.target)) {
                fileSubmenu.classList.remove('active');
            }
            if (!nodesMenu.contains(e.target) && !nodesSubmenu.contains(e.target)) {
                nodesSubmenu.classList.remove('active');
            }
        });

        // New Project
        const newProjectBtn = document.getElementById('new-project');
        const saveProjectModal = document.getElementById('save-project-modal');
        const confirmSaveBtn = document.getElementById('confirm-save');
        const cancelSaveBtn = document.getElementById('cancel-save');
        const closeSaveModalBtn = document.getElementById('close-save-modal');

        newProjectBtn.addEventListener('click', () => {
            saveProjectModal.classList.add('active');
        });

        confirmSaveBtn.addEventListener('click', () => {
            this.saveToJson().then(() => {
                this.nodes.clear();
                this.connections = [];
                saveProjectModal.classList.remove('active');
            });
        });

        cancelSaveBtn.addEventListener('click', () => {
            this.nodes.clear();
            this.connections = [];
            saveProjectModal.classList.remove('active');
        });

        closeSaveModalBtn.addEventListener('click', () => {
            saveProjectModal.classList.remove('active');
        });

        // Save Project
        const saveProjectBtn = document.getElementById('save-project');
        saveProjectBtn.addEventListener('click', () => {
            this.saveToJson();
            fileSubmenu.classList.remove('active');
        });

        // Open Project
        const openProjectBtn = document.getElementById('open-project');
        openProjectBtn.addEventListener('click', () => {
            this.loadFromJson();
            fileSubmenu.classList.remove('active');
        });

        // Make nodes draggable
        function makeNodeDraggable(node) {
            let offsetX, offsetY;
            node.addEventListener('mousedown', (e) => {
                offsetX = e.clientX - node.getBoundingClientRect().left;
                offsetY = e.clientY - node.getBoundingClientRect().top;
                document.addEventListener('mousemove', moveNode);
                document.addEventListener('mouseup', () => {
                    document.removeEventListener('mousemove', moveNode);
                }, { once: true });
            });

            function moveNode(e) {
                node.style.left = `${e.clientX - offsetX}px`;
                node.style.top = `${e.clientY - offsetY}px`;
            }
        }

        // Example of adding a node and making it draggable
        const exampleNode = document.createElement('div');
        exampleNode.className = 'node';
        exampleNode.style.left = '100px';
        exampleNode.style.top = '100px';
        grid.appendChild(exampleNode);
        makeNodeDraggable(exampleNode);
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

        // Download JSON file
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

    async loadFromJson(password) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                const content = event.target.result;
                let data;
                if (password) {
                    const encryptedData = JSON.parse(content);
                    const keyBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
                    const key = await crypto.subtle.importKey(
                        'raw',
                        keyBuffer,
                        { name: 'AES-GCM' },
                        false,
                        ['decrypt']
                    );
                    const decrypted = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
                        key,
                        new Uint8Array(encryptedData.encrypted)
                    );
                    data = JSON.parse(new TextDecoder().decode(decrypted));
                } else {
                    data = JSON.parse(content);
                }
                this.nodes = new Map(data.nodes.map(node => [node.id, node]));
                this.connections = data.connections;
                // Update the UI with loaded data
            };
            reader.readAsText(file);
        };
        input.click();
    }
}

// Initialize the editor
const editor = new Storyclass StoryNode {
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
            const newScale = this.scale * delta;
            if (newScale >= 1.0 && newScale <= 3.0) {
                this.scale = newScale;
                this.updateGridPosition();
            }
        });

        // Autosave toggle
        const autosaveBtn = document.getElementById('autosave-toggle');
        autosaveBtn.addEventListener('click', () => {
            this.autosave = !this.autosave;
            autosaveBtn.title = `Autosave: ${this.autosave ? 'On' : 'Off'}`;
        });

        // Save JSON
        const saveBtn = document.getElementById('save-json');
        saveBtn.addEventListener('click', () => this.saveToJson());

        // Load JSON
        const loadBtn = document.getElementById('open-project');
        loadBtn.addEventListener('click', () => this.loadFromJson());

        // File menu and sub-menu
        const fileMenu = document.getElementById('file-menu');
        const fileSubmenu = document.getElementById('file-submenu');
        fileMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            fileSubmenu.classList.toggle('active');
        });

        // Nodes menu and sub-menu
        const nodesMenu = document.getElementById('nodes-menu');
        const nodesSubmenu = document.getElementById('nodes-submenu');
        nodesMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            nodesSubmenu.classList.toggle('active');
        });

        // Hide sub-menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!fileMenu.contains(e.target) && !fileSubmenu.contains(e.target)) {
                fileSubmenu.classList.remove('active');
            }
            if (!nodesMenu.contains(e.target) && !nodesSubmenu.contains(e.target)) {
                nodesSubmenu.classList.remove('active');
            }
        });

        // New Project
        const newProjectBtn = document.getElementById('new-project');
        const saveProjectModal = document.getElementById('save-project-modal');
        const confirmSaveBtn = document.getElementById('confirm-save');
        const cancelSaveBtn = document.getElementById('cancel-save');
        const closeSaveModalBtn = document.getElementById('close-save-modal');

        newProjectBtn.addEventListener('click', () => {
            saveProjectModal.classList.add('active');
        });

        confirmSaveBtn.addEventListener('click', () => {
            this.saveToJson().then(() => {
                this.nodes.clear();
                this.connections = [];
                saveProjectModal.classList.remove('active');
            });
        });

        cancelSaveBtn.addEventListener('click', () => {
            this.nodes.clear();
            this.connections = [];
            saveProjectModal.classList.remove('active');
        });

        closeSaveModalBtn.addEventListener('click', () => {
            saveProjectModal.classList.remove('active');
        });

        // Save Project
        const saveProjectBtn = document.getElementById('save-project');
        saveProjectBtn.addEventListener('click', () => {
            this.saveToJson();
            fileSubmenu.classList.remove('active');
        });

        // Open Project
        const openProjectBtn = document.getElementById('open-project');
        openProjectBtn.addEventListener('click', () => {
            this.loadFromJson();
            fileSubmenu.classList.remove('active');
        });

        // Make nodes draggable
        function makeNodeDraggable(node) {
            let offsetX, offsetY;
            node.addEventListener('mousedown', (e) => {
                offsetX = e.clientX - node.getBoundingClientRect().left;
                offsetY = e.clientY - node.getBoundingClientRect().top;
                document.addEventListener('mousemove', moveNode);
                document.addEventListener('mouseup', () => {
                    document.removeEventListener('mousemove', moveNode);
                }, { once: true });
            });

            function moveNode(e) {
                node.style.left = `${e.clientX - offsetX}px`;
                node.style.top = `${e.clientY - offsetY}px`;
            }
        }

        // Example of adding a node and making it draggable
        const exampleNode = document.createElement('div');
        exampleNode.className = 'node';
        exampleNode.style.left = '100px';
        exampleNode.style.top = '100px';
        grid.appendChild(exampleNode);
        makeNodeDraggable(exampleNode);
    }

    async saveToJson(password) {
        const data = {
            nodes: Array.from(this.nodes.values()),
            connections: this.connections
        };

        if (password) {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            const keyBuffer = await cryptotle.digest('SHA-256', encoder.encode(password));
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

        // Download JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = documentElement('a');
        a.href = url;
        a.download = 'story.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return data;
    }

    async loadFromJson(password) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                const content = event.target.result;
                let data;
                if (password) {
                    const encryptedData = JSON.parse(content);
                    const keyBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
                    const key = await crypto.subtle.importKey(
                        'raw',
                        keyBuffer,
                        { name: 'AES-GCM' },
                        false,
                        ['decrypt']
                    );
                    const decrypted = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
                        key,
                        new Uint8Array(encryptedData.encrypted)
                    );
                    data = JSON.parse(new TextDecoder().decode(decrypted));
                } else {
                    data = JSON.parse(content);
                }
                this.nodes = new Map(data.nodes.map(node => [node.id, node]));
                this.connections = data.connections;
                // Update the UI with loaded data
            };
            reader.readAsText(file);
        };
        input.click();
    }
}

// Initialize the editor
const editor = new Story