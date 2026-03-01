import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class DiffuserConfigurator {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.blocks = new THREE.Group();
        
        this.config = {
            overallWidth: 48,
            overallHeight: 36,
            blockSize: 1.5,
            backgroundColor: '#1a1a1a',
            layoutType: 'random',
            blockTypes: [
                { depth: 2, percentage: 50 },
                { depth: 3, percentage: 15 },
                { depth: 4, percentage: 35 }
            ],
            waveLayers: [{ angle: 0, amplitude: 4, frequency: 12 }],
            waveConstraints: { minDepth: 1, maxDepth: 5, depthStep: 1 },
            rippleLayers: [{ x: 0.5, y: 0.5, amplitude: 4, frequency: 10 }],
            rippleConstraints: { minDepth: 1, maxDepth: 5, depthStep: 1 },
            
            colorLayoutType: 'random',
            syncColorLayout: false,
            colorTypes: [
                { color: '#000080', percentage: 40 },
                { color: '#add8e6', percentage: 30 },
                { color: '#40e0d0', percentage: 30 }
            ],
            colorWaveLayers: [{ angle: 0, amplitude: 1, frequency: 12 }],
            colorRippleLayers: [{ x: 0.5, y: 0.5, amplitude: 1, frequency: 10 }],
            
            layout: [],
            colorLayout: []
        };

        this.history = [];

        this.initThree();
        this.initUI();
        this.updateGrid();
        this.generateLayout();
        this.renderDiffuser();
        this.animate();
    }

    initThree() {
        const container = document.getElementById('three-canvas-wrapper');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.backgroundColor);
        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 5000);
        this.camera.position.set(40, 40, 80);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(50, 100, 100);
        mainLight.castShadow = true;
        this.scene.add(mainLight);
        this.scene.add(new THREE.DirectionalLight(0xffffff, 0.6).position.set(-50, 50, 50));
        this.scene.add(new THREE.DirectionalLight(0xffffff, 0.8).position.set(0, -100, -50));
        this.scene.add(this.blocks);
        window.addEventListener('resize', () => this.onWindowResize());
    }

    initUI() {
        // Shared Dimensions
        ['overall-width', 'overall-height', 'block-size'].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('mousedown', () => this.saveToHistory());
            el.addEventListener('input', (e) => {
                const key = id === 'overall-width' ? 'overallWidth' : (id === 'overall-height' ? 'overallHeight' : 'blockSize');
                this.config[key] = parseFloat(e.target.value) || 1;
                this.updateGrid();
                this.generateLayout();
                this.renderDiffuser();
            });
        });

        // Layout Selectors
        document.getElementById('layout-type').addEventListener('change', (e) => {
            this.saveToHistory();
            this.config.layoutType = e.target.value;
            this.updateLayoutUI();
            this.generateLayout();
            this.renderDiffuser();
        });

        document.getElementById('color-layout-type').addEventListener('change', (e) => {
            this.saveToHistory();
            this.config.colorLayoutType = e.target.value;
            this.updateLayoutUI();
            this.generateLayout();
            this.renderDiffuser();
        });

        document.getElementById('sync-color-layout').addEventListener('change', (e) => {
            this.saveToHistory();
            this.config.syncColorLayout = e.target.checked;
            this.generateLayout();
            this.renderDiffuser();
        });

        // Layer Adding
        document.getElementById('add-wave-layer').addEventListener('click', () => { this.saveToHistory(); this.config.waveLayers.push({ angle: 0, amplitude: 2, frequency: 12 }); this.renderLayersUI(); this.generateLayout(); this.renderDiffuser(); });
        document.getElementById('add-ripple-layer').addEventListener('click', () => { this.saveToHistory(); this.config.rippleLayers.push({ x: 0.5, y: 0.5, amplitude: 2, frequency: 10 }); this.renderLayersUI(); this.generateLayout(); this.renderDiffuser(); });
        document.getElementById('add-color-wave-layer').addEventListener('click', () => { this.saveToHistory(); this.config.colorWaveLayers.push({ angle: 0, amplitude: 1, frequency: 12 }); this.renderLayersUI(); this.generateLayout(); this.renderDiffuser(); });
        document.getElementById('add-color-ripple-layer').addEventListener('click', () => { this.saveToHistory(); this.config.colorRippleLayers.push({ x: 0.5, y: 0.5, amplitude: 1, frequency: 10 }); this.renderLayersUI(); this.generateLayout(); this.renderDiffuser(); });

        // Constraints
        ['wave-minDepth', 'wave-maxDepth', 'wave-depthStep', 'ripple-minDepth', 'ripple-maxDepth', 'ripple-depthStep'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                const parts = id.split('-');
                const section = parts[0] + 'Constraints';
                const key = parts[1];
                this.config[section][key] = parseFloat(e.target.value) || 0;
                this.generateLayout();
                this.renderDiffuser();
            });
        });

        // Rest of the existing UI setup...
        document.getElementById('bg-color-picker').addEventListener('input', (e) => {
            this.config.backgroundColor = e.target.value;
            this.scene.background.set(e.target.value);
        });

        document.getElementById('add-block-config').addEventListener('click', () => { this.saveToHistory(); this.config.blockTypes.push({ depth: 1, percentage: 0 }); this.renderBlockTypesUI(); });
        document.getElementById('add-color-config').addEventListener('click', () => { this.saveToHistory(); this.config.colorTypes.push({ color: '#cccccc', percentage: 0 }); this.renderColorTypesUI(); });
        document.getElementById('randomize-layout').addEventListener('click', () => { this.saveToHistory(); this.generateLayout(); this.renderDiffuser(); });
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); } });
        document.getElementById('btn-export').addEventListener('click', () => this.exportJSON());

        document.getElementById('btn-load').addEventListener('click', () => document.getElementById('input-load').click());
        document.getElementById('input-load').addEventListener('change', (e) => this.loadJSON(e));

        this.updateLayoutUI();
        this.renderBlockTypesUI();
        this.renderColorTypesUI();
        this.renderLayersUI();
        this.renderHistoryUI();
    }

    renderLayersUI() {
        const renderLayer = (containerId, layers, type) => {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            layers.forEach((layer, idx) => {
                const card = document.createElement('div');
                card.className = 'config-card';
                const grid = document.createElement('div');
                grid.className = 'config-card-grid grid-4';
                
                let html = '';
                if (type === 'wave') {
                    html = `
                        <div><label>Angle</label><input type="number" value="${layer.angle}" data-key="angle"></div>
                        <div><label>Amp</label><input type="number" step="0.5" value="${layer.amplitude}" data-key="amplitude"></div>
                        <div><label>Freq</label><input type="number" value="${layer.frequency}" data-key="frequency"></div>
                    `;
                } else {
                    html = `
                        <div><label>X/Y</label><div style="display:flex;gap:2px"><input type="number" step="0.1" value="${layer.x}" data-key="x" style="width:50%"><input type="number" step="0.1" value="${layer.y}" data-key="y" style="width:50%"></div></div>
                        <div><label>Amp</label><input type="number" step="0.5" value="${layer.amplitude}" data-key="amplitude"></div>
                        <div><label>Freq</label><input type="number" value="${layer.frequency}" data-key="frequency"></div>
                    `;
                }
                grid.innerHTML = html + `<button class="btn-delete">×</button>`;
                card.appendChild(grid);

                grid.querySelectorAll('input').forEach(input => {
                    input.addEventListener('mousedown', () => this.saveToHistory());
                    input.addEventListener('input', (e) => {
                        layer[e.target.dataset.key] = parseFloat(e.target.value) || 0;
                        this.generateLayout();
                        this.renderDiffuser();
                    });
                });
                grid.querySelector('.btn-delete').addEventListener('click', () => {
                    this.saveToHistory();
                    layers.splice(idx, 1);
                    this.renderLayersUI();
                    this.generateLayout();
                    this.renderDiffuser();
                });
                container.appendChild(card);
            });
        };

        renderLayer('wave-layers-container', this.config.waveLayers, 'wave');
        renderLayer('ripple-layers-container', this.config.rippleLayers, 'ripple');
        renderLayer('color-wave-layers-container', this.config.colorWaveLayers, 'wave');
        renderLayer('color-ripple-layers-container', this.config.colorRippleLayers, 'ripple');
    }

    updateLayoutUI() {
        ['random', 'wave', 'ripple'].forEach(type => {
            document.getElementById(`settings-${type}`).style.display = (type === this.config.layoutType) ? 'flex' : 'none';
            document.getElementById(`settings-color-${type}`).style.display = (type === this.config.colorLayoutType) ? 'flex' : 'none';
        });
        document.getElementById('layout-type').value = this.config.layoutType;
        document.getElementById('color-layout-type').value = this.config.colorLayoutType;
        document.getElementById('sync-color-layout').checked = this.config.syncColorLayout;
    }

    saveToHistory() {
        const state = JSON.stringify(this.config);
        if (this.history.length === 0 || this.history[this.history.length - 1] !== state) {
            this.history.push(state);
            if (this.history.length > 50) this.history.shift();
            this.renderHistoryUI();
        }
    }

    undo() {
        if (this.history.length > 0) {
            this.config = JSON.parse(this.history.pop());
            this.syncUI();
            this.updateGrid();
            this.generateLayout();
            this.renderDiffuser();
            this.renderHistoryUI();
        }
    }

    syncUI() {
        document.getElementById('overall-width').value = this.config.overallWidth;
        document.getElementById('overall-height').value = this.config.overallHeight;
        document.getElementById('block-size').value = this.config.blockSize;
        document.getElementById('bg-color-picker').value = this.config.backgroundColor;
        this.scene.background.set(this.config.backgroundColor);
        
        ['wave', 'ripple'].forEach(s => {
            document.getElementById(`${s}-minDepth`).value = this.config[`${s}Constraints`].minDepth;
            document.getElementById(`${s}-maxDepth`).value = this.config[`${s}Constraints`].maxDepth;
            document.getElementById(`${s}-depthStep`).value = this.config[`${s}Constraints`].depthStep;
        });

        this.updateLayoutUI();
        this.renderBlockTypesUI();
        this.renderColorTypesUI();
        this.renderLayersUI();
    }

    renderHistoryUI() {
        const undoBtn = document.getElementById('btn-undo');
        if (undoBtn) undoBtn.disabled = this.history.length === 0;
    }

    renderBlockTypesUI() {
        const container = document.getElementById('block-configs-container');
        container.innerHTML = '';
        let totalPercent = 0;
        this.config.blockTypes.forEach((type, index) => {
            totalPercent += type.percentage;
            const row = document.createElement('div');
            row.className = 'block-config-row';
            row.innerHTML = `
                <div><label>Depth</label><input type="number" step="0.25" value="${type.depth}" data-index="${index}" data-prop="depth"></div>
                <div><label>%</label><input type="number" step="1" value="${type.percentage}" data-index="${index}" data-prop="percentage"></div>
                <button class="btn-delete" data-index="${index}">×</button>
            `;
            row.querySelectorAll('input').forEach(input => {
                input.addEventListener('mousedown', () => this.saveToHistory());
                input.addEventListener('input', (e) => {
                    this.config.blockTypes[parseInt(e.target.dataset.index)][e.target.dataset.prop] = parseFloat(e.target.value) || 0;
                    this.renderBlockTypesUI();
                });
            });
            row.querySelector('.btn-delete').addEventListener('click', (e) => {
                this.saveToHistory();
                this.config.blockTypes.splice(parseInt(e.target.dataset.index), 1);
                this.renderBlockTypesUI();
            });
            container.appendChild(row);
        });
        document.getElementById('validation-message').textContent = (this.config.layoutType === 'random' && totalPercent !== 100) ? `Total: ${totalPercent}% (Must be 100%)` : '';
    }

    renderColorTypesUI() {
        const container = document.getElementById('color-configs-container');
        container.innerHTML = '';
        let totalPercent = 0;
        this.config.colorTypes.forEach((type, index) => {
            totalPercent += type.percentage;
            const row = document.createElement('div');
            row.className = 'color-config-row';
            row.innerHTML = `
                <input type="color" value="${type.color}" data-index="${index}" data-prop="color">
                <div><label>%</label><input type="number" step="1" value="${type.percentage}" data-index="${index}" data-prop="percentage"></div>
                <button class="btn-delete" data-index="${index}">×</button>
            `;
            row.querySelectorAll('input').forEach(input => {
                input.addEventListener('mousedown', () => this.saveToHistory());
                input.addEventListener('input', (e) => {
                    this.config.colorTypes[parseInt(e.target.dataset.index)][e.target.dataset.prop] = e.target.type === 'color' ? e.target.value : parseFloat(e.target.value) || 0;
                    this.renderColorTypesUI();
                });
            });
            row.querySelector('.btn-delete').addEventListener('click', (e) => {
                this.saveToHistory();
                this.config.colorTypes.splice(parseInt(e.target.dataset.index), 1);
                this.renderColorTypesUI();
            });
            container.appendChild(row);
        });
        document.getElementById('color-validation-message').textContent = (this.config.colorLayoutType === 'random' && !this.config.syncColorLayout && totalPercent !== 100) ? `Total: ${totalPercent}% (Must be 100%)` : '';
    }

    updateGrid() {
        this.cols = Math.floor(this.config.overallWidth / this.config.blockSize) || 1;
        this.rows = Math.floor(this.config.overallHeight / this.config.blockSize) || 1;
    }

    constrainDepth(d, constraints) {
        const { minDepth, maxDepth, depthStep } = constraints;
        if (depthStep <= 0) return Math.min(Math.max(d, minDepth), maxDepth);
        let val = Math.min(Math.max(d, minDepth), maxDepth);
        val = Math.round(val / depthStep) * depthStep;
        return Math.min(Math.max(val, minDepth), maxDepth);
    }

    generateLayout() {
        const totalBlocks = this.cols * this.rows;
        
        // 1. Depths
        let depths = [];
        if (this.config.layoutType === 'random') {
            let pool = [];
            this.config.blockTypes.forEach((type) => {
                const count = Math.round((type.percentage / 100) * totalBlocks);
                for (let i = 0; i < count; i++) pool.push(type.depth);
            });
            while (pool.length < totalBlocks) pool.push(this.config.blockTypes[0]?.depth || 0);
            while (pool.length > totalBlocks) pool.pop();
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            depths = pool;
        } else {
            const layers = this.config.layoutType === 'wave' ? this.config.waveLayers : this.config.rippleLayers;
            const constraints = this.config.layoutType === 'wave' ? this.config.waveConstraints : this.config.rippleConstraints;
            for (let i = 0; i < totalBlocks; i++) {
                const col = i % this.cols;
                const row = Math.floor(i / this.cols);
                let totalAmp = 0;
                layers.forEach(layer => {
                    if (this.config.layoutType === 'wave') {
                        const rad = (layer.angle * Math.PI) / 180;
                        const proj = col * Math.cos(rad) + row * Math.sin(rad);
                        totalAmp += (layer.amplitude / 2) * (1 + Math.sin((2 * Math.PI * proj * this.config.blockSize) / layer.frequency));
                    } else {
                        const dist = Math.sqrt(Math.pow(col - layer.x * this.cols, 2) + Math.pow(row - layer.y * this.rows, 2));
                        totalAmp += (layer.amplitude / 2) * (1 + Math.sin((2 * Math.PI * dist * this.config.blockSize) / layer.frequency));
                    }
                });
                depths.push(this.constrainDepth(totalAmp, constraints));
            }
        }
        this.config.layout = depths;

        // 2. Colors
        let colorLayout = [];
        if (this.config.syncColorLayout) {
            this.config.layout.forEach(depth => {
                const typeIdx = this.config.blockTypes.findIndex(t => t.depth === depth);
                const colorType = this.config.colorTypes[typeIdx % this.config.colorTypes.length];
                colorLayout.push(colorType ? colorType.color : '#ffffff');
            });
        } else if (this.config.colorLayoutType === 'random') {
            let pool = [];
            this.config.colorTypes.forEach(type => {
                const count = Math.round((type.percentage / 100) * totalBlocks);
                for (let i = 0; i < count; i++) pool.push(type.color);
            });
            while (pool.length < totalBlocks) pool.push(this.config.colorTypes[0]?.color || '#ffffff');
            while (pool.length > totalBlocks) pool.pop();
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            colorLayout = pool;
        } else {
            const layers = this.config.colorLayoutType === 'wave' ? this.config.colorWaveLayers : this.config.colorRippleLayers;
            for (let i = 0; i < totalBlocks; i++) {
                const col = i % this.cols;
                const row = Math.floor(i / this.cols);
                let totalT = 0;
                layers.forEach(layer => {
                    if (this.config.colorLayoutType === 'wave') {
                        const rad = (layer.angle * Math.PI) / 180;
                        const proj = col * Math.cos(rad) + row * Math.sin(rad);
                        totalT += (0.5 + 0.5 * Math.sin((2 * Math.PI * proj * this.config.blockSize) / layer.frequency + layer.amplitude));
                    } else {
                        const dist = Math.sqrt(Math.pow(col - layer.x * this.cols, 2) + Math.pow(row - layer.y * this.rows, 2));
                        totalT += (0.5 + 0.5 * Math.sin((2 * Math.PI * dist * this.config.blockSize) / layer.frequency));
                    }
                });
                const normT = (totalT / (layers.length || 1));
                const colorIdx = Math.floor(normT * this.config.colorTypes.length);
                colorLayout.push(this.config.colorTypes[colorIdx % this.config.colorTypes.length]?.color || '#ffffff');
            }
        }
        this.config.colorLayout = colorLayout;
    }

    renderDiffuser() {
        while(this.blocks.children.length > 0) this.blocks.remove(this.blocks.children[0]);
        const { blockSize, layout, colorLayout } = this.config;
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const actualWidth = this.cols * blockSize;
        const actualHeight = this.rows * blockSize;
        layout.forEach((depth, index) => {
            const material = new THREE.MeshStandardMaterial({ color: colorLayout[index], roughness: 0.7, metalness: 0.1 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.set(blockSize, blockSize, depth);
            mesh.position.set((index % this.cols) * blockSize - actualWidth / 2 + blockSize / 2, -(Math.floor(index / this.cols) * blockSize) + actualHeight / 2 - blockSize / 2, depth / 2);
            this.blocks.add(mesh);
            const line = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.1, transparent: true }));
            line.scale.copy(mesh.scale);
            line.position.copy(mesh.position);
            this.blocks.add(line);
        });
    }

    loadJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.saveToHistory();
                const loadedData = JSON.parse(e.target.result);
                
                // Shallow validation: ensure basic keys exist
                if (loadedData.blockSize && loadedData.blockTypes) {
                    this.config = { ...this.config, ...loadedData };
                    this.syncUI();
                    this.updateGrid();
                    this.generateLayout();
                    this.renderDiffuser();
                } else {
                    alert("Invalid JSON format. This doesn't look like a diffuser configuration.");
                }
            } catch (err) {
                console.error("Error parsing JSON:", err);
                alert("Failed to load file. Error parsing JSON.");
            }
            // Reset the input so the same file can be loaded again if needed
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    exportJSON() {
        const buildSheet = {};
        this.config.layout.forEach((depth, index) => {
            const color = this.config.colorLayout[index];
            const key = `${color}_${depth}in`;
            if (!buildSheet[key]) buildSheet[key] = { color: color, depth: depth, count: 0 };
            buildSheet[key].count++;
        });
        const exportData = { ...this.config, metadata: { exportedAt: new Date().toISOString(), totalBlocks: this.config.layout.length, buildSheet: Object.values(buildSheet) } };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `diffuser-build-sheet-${Date.now()}.json`;
        a.click();
    }

    onWindowResize() {
        const container = document.getElementById('three-canvas-wrapper');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new DiffuserConfigurator();
