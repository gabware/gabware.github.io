import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class DiffuserConfigurator {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.blocks = new THREE.Group();
        
        // Performance: Reuse Geometries
        this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
        this.edgeGeo = new THREE.EdgesGeometry(this.boxGeo);
        
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
        this.isAR = false;

        this.initThree();
        this.initUI();
        this.initMobileTabs();
        this.updateGrid();
        this.generateLayout();
        this.renderDiffuser();
        
        // Correct Animation Loop for WebXR/Standard
        this.renderer.setAnimationLoop(() => this.animate());
    }

    initThree() {
        const container = document.getElementById('three-canvas-wrapper');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.backgroundColor);
        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 5000);
        this.camera.position.set(40, 40, 80);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.xr.enabled = true;
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(50, 100, 100);
        mainLight.castShadow = true;
        this.scene.add(mainLight);
        this.scene.add(new THREE.DirectionalLight(0xffffff, 0.6).position.set(-50, 50, 50));
        
        this.scene.add(this.blocks);
        window.addEventListener('resize', () => this.onWindowResize());

        this.renderer.xr.addEventListener('sessionstart', () => {
            this.isAR = true;
            this.scene.background = null;
            this.blocks.scale.setScalar(0.0254);
            this.blocks.position.set(0, 0, -1.5);
            this.blocks.rotation.x = Math.PI / 2;
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            this.isAR = false;
            this.scene.background = new THREE.Color(this.config.backgroundColor);
            this.blocks.scale.setScalar(1);
            this.blocks.position.set(0, 0, 0);
            this.blocks.rotation.x = 0;
        });
    }

    initUI() {
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

        const setupARButton = (btnId) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            if (!navigator.xr) btn.classList.add('disabled-look');
            else navigator.xr.isSessionSupported('immersive-ar').then(s => { if(!s) btn.classList.add('disabled-look'); });

            btn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (navigator.xr) {
                    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                        if (supported) {
                            this.renderer.xr.setReferenceSpaceType('local');
                            navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body } })
                                .then((session) => this.renderer.xr.setSession(session));
                        } else {
                            alert("AR not supported on this device/browser. iOS requires a WebXR-compatible app or HTTPS.");
                        }
                    });
                } else {
                    alert("WebXR unavailable. Use a modern browser and HTTPS.");
                }
            });
        };
        setupARButton('btn-ar');
        setupARButton('btn-ar-mobile');

        document.getElementById('layout-type').addEventListener('change', (e) => {
            this.saveToHistory(); this.config.layoutType = e.target.value; this.updateLayoutUI(); this.generateLayout(); this.renderDiffuser();
        });

        document.getElementById('color-layout-type').addEventListener('change', (e) => {
            this.saveToHistory(); this.config.colorLayoutType = e.target.value; this.updateLayoutUI(); this.generateLayout(); this.renderDiffuser();
        });

        document.getElementById('sync-color-layout').addEventListener('change', (e) => {
            this.saveToHistory(); this.config.syncColorLayout = e.target.checked; this.generateLayout(); this.renderDiffuser();
        });

        ['wave-angle', 'wave-amplitude', 'wave-frequency', 'wave-minDepth', 'wave-maxDepth', 'wave-depthStep',
         'ripple-x', 'ripple-y', 'ripple-amplitude', 'ripple-frequency', 'ripple-minDepth', 'ripple-maxDepth', 'ripple-depthStep'].forEach(id => {
            document.getElementById(id).addEventListener('mousedown', () => this.saveToHistory());
            document.getElementById(id).addEventListener('input', (e) => {
                const parts = id.split('-'); this.config[parts[0]][parts[1]] = parseFloat(e.target.value) || 0;
                this.generateLayout(); this.renderDiffuser();
            });
        });

        ['color-wave-angle', 'color-wave-amplitude', 'color-wave-frequency', 'color-ripple-x', 'color-ripple-y', 'color-ripple-frequency'].forEach(id => {
            document.getElementById(id).addEventListener('mousedown', () => this.saveToHistory());
            document.getElementById(id).addEventListener('input', (e) => {
                const parts = id.split('-'); const section = (parts[1] === 'wave') ? 'colorWave' : 'colorRipple';
                this.config[section][parts[parts.length - 1]] = parseFloat(e.target.value) || 0;
                this.generateLayout(); this.renderDiffuser();
            });
        });

        document.getElementById('bg-color-picker').addEventListener('input', (e) => {
            this.config.backgroundColor = e.target.value; this.scene.background.set(e.target.value);
        });

        document.getElementById('add-block-config').addEventListener('click', () => { this.saveToHistory(); this.config.blockTypes.push({ depth: 1, percentage: 0 }); this.renderBlockTypesUI(); });
        document.getElementById('add-color-config').addEventListener('click', () => { this.saveToHistory(); this.config.colorTypes.push({ color: '#cccccc', percentage: 0 }); this.renderColorTypesUI(); });
        document.getElementById('randomize-layout').addEventListener('click', () => {
            if (this.config.layoutType === 'random' && this.config.blockTypes.reduce((s, t) => s + t.percentage, 0) !== 100) return;
            this.saveToHistory(); this.generateLayout(); this.renderDiffuser();
        });

        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); } });
        document.getElementById('btn-export').addEventListener('click', () => this.exportJSON());
        document.getElementById('btn-load').addEventListener('click', () => document.getElementById('input-load').click());
        document.getElementById('input-load').addEventListener('change', (e) => this.loadJSON(e));

        this.updateLayoutUI(); this.renderBlockTypesUI(); this.renderColorTypesUI(); this.renderLayersUI(); this.renderHistoryUI();
    }

    initMobileTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        const preview = document.getElementById('preview-container');
        const config = document.getElementById('configuration-panel');
        tabs.forEach(tab => {
            if (!tab.dataset.tab) return;
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active')); tab.classList.add('active');
                if (tab.dataset.tab === 'preview') { preview.classList.add('mobile-active'); config.classList.remove('mobile-active'); this.onWindowResize(); }
                else { preview.classList.remove('mobile-active'); config.classList.add('mobile-active'); }
            });
        });
    }

    renderLayersUI() {
        const renderLayer = (containerId, layers, type) => {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            layers.forEach((layer, idx) => {
                const card = document.createElement('div'); card.className = 'config-card';
                const grid = document.createElement('div'); grid.className = 'config-card-grid grid-4';
                let html = type === 'wave' ? 
                    `<div><label>Angle</label><input type="number" value="${layer.angle}" data-key="angle"></div><div><label>Amp</label><input type="number" step="0.5" value="${layer.amplitude}" data-key="amplitude"></div><div><label>Freq</label><input type="number" value="${layer.frequency}" data-key="frequency"></div>` :
                    `<div><label>X/Y</label><div style="display:flex;gap:2px"><input type="number" step="0.1" value="${layer.x}" data-key="x" style="width:50%"><input type="number" step="0.1" value="${layer.y}" data-key="y" style="width:50%"></div></div><div><label>Amp</label><input type="number" step="0.5" value="${layer.amplitude}" data-key="amplitude"></div><div><label>Freq</label><input type="number" value="${layer.frequency}" data-key="frequency"></div>`;
                grid.innerHTML = html + `<button class="btn-delete">×</button>`; card.appendChild(grid);
                grid.querySelectorAll('input').forEach(input => {
                    input.addEventListener('mousedown', () => this.saveToHistory());
                    input.addEventListener('input', (e) => { layer[e.target.dataset.key] = parseFloat(e.target.value) || 0; this.generateLayout(); this.renderDiffuser(); });
                });
                grid.querySelector('.btn-delete').addEventListener('click', () => { this.saveToHistory(); layers.splice(idx, 1); this.renderLayersUI(); this.generateLayout(); this.renderDiffuser(); });
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
            this.history.push(state); if (this.history.length > 50) this.history.shift(); this.renderHistoryUI();
        }
    }

    undo() {
        if (this.history.length > 0) {
            this.config = JSON.parse(this.history.pop()); this.syncUI(); this.updateGrid(); this.renderDiffuser(); this.renderHistoryUI();
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
        this.updateLayoutUI(); this.renderBlockTypesUI(); this.renderColorTypesUI(); this.renderLayersUI();
    }

    renderHistoryUI() {
        const btn = document.getElementById('btn-undo'); if (btn) btn.disabled = this.history.length === 0;
    }

    renderBlockTypesUI() {
        const container = document.getElementById('block-configs-container'); container.innerHTML = '';
        this.config.blockTypes.forEach((type, index) => {
            const row = document.createElement('div'); row.className = 'block-config-row';
            row.innerHTML = `<div><label>Depth</label><input type="number" step="0.25" value="${type.depth}" data-index="${index}" data-prop="depth"></div><div><label>%</label><input type="number" step="1" value="${type.percentage}" data-index="${index}" data-prop="percentage"></div><button class="btn-delete" data-index="${index}">×</button>`;
            row.querySelectorAll('input').forEach(input => {
                input.addEventListener('mousedown', () => this.saveToHistory());
                input.addEventListener('input', (e) => {
                    this.config.blockTypes[parseInt(e.target.dataset.index)][e.target.dataset.prop] = parseFloat(e.target.value) || 0;
                    const total = this.config.blockTypes.reduce((s, t) => s + t.percentage, 0);
                    document.getElementById('validation-message').textContent = (this.config.layoutType === 'random' && total !== 100) ? `Total: ${total}% (Must be 100%)` : '';
                });
            });
            row.querySelector('.btn-delete').addEventListener('click', (e) => { this.saveToHistory(); this.config.blockTypes.splice(parseInt(e.target.dataset.index), 1); this.renderBlockTypesUI(); });
            container.appendChild(row);
        });
    }

    renderColorTypesUI() {
        const container = document.getElementById('color-configs-container'); container.innerHTML = '';
        this.config.colorTypes.forEach((type, index) => {
            const row = document.createElement('div'); row.className = 'color-config-row';
            row.innerHTML = `<input type="color" value="${type.color}" data-index="${index}" data-prop="color"><div><label>%</label><input type="number" step="1" value="${type.percentage}" data-index="${index}" data-prop="percentage"></div><button class="btn-delete" data-index="${index}">×</button>`;
            row.querySelectorAll('input').forEach(input => {
                input.addEventListener('mousedown', () => this.saveToHistory());
                input.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.dataset.index); const prop = e.target.dataset.prop;
                    this.config.colorTypes[idx][prop] = e.target.type === 'color' ? e.target.value : parseFloat(e.target.value) || 0;
                    if (e.target.type === 'color') this.renderDiffuser();
                    else {
                        const total = this.config.colorTypes.reduce((s, t) => s + t.percentage, 0);
                        document.getElementById('color-validation-message').textContent = (this.config.colorLayoutType === 'random' && !this.config.syncColorLayout && total !== 100) ? `Total: ${total}% (Must be 100%)` : '';
                    }
                });
            });
            row.querySelector('.btn-delete').addEventListener('click', (e) => { this.saveToHistory(); this.config.colorTypes.splice(parseInt(e.target.dataset.index), 1); this.renderColorTypesUI(); });
            container.appendChild(row);
        });
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
        let depths = [];
        if (this.config.layoutType === 'random') {
            let pool = []; this.config.blockTypes.forEach((type) => {
                const count = Math.round((type.percentage / 100) * totalBlocks);
                for (let i = 0; i < count; i++) pool.push(type.depth);
            });
            while (pool.length < totalBlocks) pool.push(this.config.blockTypes[0]?.depth || 0);
            while (pool.length > totalBlocks) pool.pop();
            for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
            depths = pool;
        } else {
            const layers = this.config.layoutType === 'wave' ? this.config.waveLayers : this.config.rippleLayers;
            const constraints = this.config.layoutType === 'wave' ? this.config.waveConstraints : this.config.rippleConstraints;
            for (let i = 0; i < totalBlocks; i++) {
                const col = i % this.cols; const row = Math.floor(i / this.cols); let totalAmp = 0;
                layers.forEach(l => {
                    if (this.config.layoutType === 'wave') {
                        const rad = (l.angle * Math.PI) / 180; const proj = col * Math.cos(rad) + row * Math.sin(rad);
                        totalAmp += (l.amplitude / 2) * (1 + Math.sin((2 * Math.PI * proj * this.config.blockSize) / l.frequency));
                    } else {
                        const dist = Math.sqrt(Math.pow(col - l.x * this.cols, 2) + Math.pow(row - l.y * this.rows, 2));
                        totalAmp += (l.amplitude / 2) * (1 + Math.sin((2 * Math.PI * dist * this.config.blockSize) / l.frequency));
                    }
                });
                depths.push(this.constrainDepth(totalAmp, constraints));
            }
        }
        this.config.layout = depths;

        let colorLayout = [];
        if (this.config.syncColorLayout) {
            this.config.layout.forEach(depth => {
                const typeIdx = this.config.blockTypes.findIndex(t => t.depth === depth);
                const colorType = this.config.colorTypes[typeIdx % this.config.colorTypes.length];
                colorLayout.push(colorType ? colorType.color : '#ffffff');
            });
        } else if (this.config.colorLayoutType === 'random') {
            let pool = []; this.config.colorTypes.forEach(type => {
                const count = Math.round((type.percentage / 100) * totalBlocks);
                for (let i = 0; i < count; i++) pool.push(type.color);
            });
            while (pool.length < totalBlocks) pool.push(this.config.colorTypes[0]?.color || '#ffffff');
            while (pool.length > totalBlocks) pool.pop();
            for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
            colorLayout = pool;
        } else {
            const layers = this.config.colorLayoutType === 'wave' ? this.config.colorWaveLayers : this.config.colorRippleLayers;
            for (let i = 0; i < totalBlocks; i++) {
                const col = i % this.cols; const row = Math.floor(i / this.cols); let totalT = 0;
                layers.forEach(l => {
                    if (this.config.colorLayoutType === 'wave') {
                        const rad = (l.angle * Math.PI) / 180; const proj = col * Math.cos(rad) + row * Math.sin(rad);
                        totalT += (0.5 + 0.5 * Math.sin((2 * Math.PI * proj * this.config.blockSize) / l.frequency + l.amplitude));
                    } else {
                        const dist = Math.sqrt(Math.pow(col - l.x * this.cols, 2) + Math.pow(row - l.y * this.rows, 2));
                        totalT += (0.5 + 0.5 * Math.sin((2 * Math.PI * dist * this.config.blockSize) / l.frequency));
                    }
                });
                const colorIdx = Math.floor((totalT / (layers.length || 1)) * this.config.colorTypes.length);
                colorLayout.push(this.config.colorTypes[colorIdx % this.config.colorTypes.length]?.color || '#ffffff');
            }
        }
        this.config.colorLayout = colorLayout;
    }

    renderDiffuser() {
        while(this.blocks.children.length > 0) {
            const child = this.blocks.children[0];
            if(child.geometry && child.geometry !== this.boxGeo && child.geometry !== this.edgeGeo) child.geometry.dispose();
            this.blocks.remove(child);
        }
        
        const { blockSize, layout, colorLayout } = this.config;
        const actualWidth = this.cols * blockSize;
        const actualHeight = this.rows * blockSize;
        
        // Performance: Material Cache
        const materialCache = {};

        layout.forEach((depth, index) => {
            const color = colorLayout[index];
            if (!materialCache[color]) {
                materialCache[color] = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.1 });
            }
            
            const mesh = new THREE.Mesh(this.boxGeo, materialCache[color]);
            mesh.scale.set(blockSize, blockSize, depth);
            mesh.position.set((index % this.cols) * blockSize - actualWidth / 2 + blockSize / 2, -(Math.floor(index / this.cols) * blockSize) + actualHeight / 2 - blockSize / 2, depth / 2);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.blocks.add(mesh);

            const line = new THREE.LineSegments(this.edgeGeo, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.1, transparent: true }));
            line.scale.copy(mesh.scale);
            line.position.copy(mesh.position);
            this.blocks.add(line);
        });
    }

    loadJSON(event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.saveToHistory(); const loaded = JSON.parse(e.target.result);
                if (loaded.blockSize && (loaded.blockTypes || loaded.waveLayers)) {
                    this.config = { ...this.config, ...loaded }; this.syncUI(); this.updateGrid(); this.generateLayout(); this.renderDiffuser();
                } else { alert("Invalid JSON format."); }
            } catch (err) { alert("Failed to load file."); }
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    exportJSON() {
        const buildSheet = {};
        this.config.layout.forEach((d, i) => {
            const c = this.config.colorLayout[i]; const k = `${c}_${d}in`;
            if (!buildSheet[k]) buildSheet[k] = { color: c, depth: d, count: 0 };
            buildSheet[k].count++;
        });
        const data = { ...this.config, metadata: { exportedAt: new Date().toISOString(), totalBlocks: this.config.layout.length, buildSheet: Object.values(buildSheet) } };
        const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        a.download = `diffuser-build-sheet-${Date.now()}.json`; a.click();
    }

    onWindowResize() {
        const container = document.getElementById('three-canvas-wrapper');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new DiffuserConfigurator();
