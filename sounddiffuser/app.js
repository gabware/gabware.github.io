import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { jsPDF } from 'jspdf';

class DiffuserConfigurator {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.blocks = new THREE.Group();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
        this.edgeGeo = new THREE.EdgesGeometry(this.boxGeo);
        this.materialCache = {};
        
        const defaultPalette = ['#878787', '#DBDBDB', '#000000', '#F7C336'];

        this.config = {
            overallWidth: 48,
            overallHeight: 36,
            blockSize: 1.5,
            backgroundColor: '#FAFAFA',
            
            lighting: { intensity: 1.2, angle: 45, ambient: 0.4 },

            layoutType: 'random',
            blockTypes: [{ depth: 2, percentage: 50 }, { depth: 3, percentage: 15 }, { depth: 4, percentage: 35 }],
            waveLayers: [{ angle: 0, amplitude: 4, frequency: 12 }],
            waveConstraints: { minDepth: 1, maxDepth: 5, depthStep: 1 },
            rippleLayers: [{ x: 0.5, y: 0.5, amplitude: 4, frequency: 10 }],
            rippleConstraints: { minDepth: 1, maxDepth: 5, depthStep: 1 },
            
            parametric: {
                orientation: 'vertical',
                spacing: 0,
                layers: [{ amp: 4, freq: 2, phase: 0.5 }],
                noiseAmount: 0
            },

            colorLayoutType: 'random',
            syncColorLayout: false,
            colorTypes: [
                { color: '#878787', percentage: 40 },
                { color: '#DBDBDB', percentage: 30 },
                { color: '#000000', percentage: 20 },
                { color: '#F7C336', percentage: 10 }
            ],
            colorWaveLayers: [{ angle: 0, amplitude: 1, frequency: 12 }],
            colorWaveColors: [...defaultPalette],
            colorRippleLayers: [{ x: 0.5, y: 0.5, amplitude: 1, frequency: 10 }],
            colorRippleColors: [...defaultPalette],
            
            brushPalette: [...defaultPalette],
            
            layout: [],
            colorLayout: []
        };

        this.history = [];
        this.isAR = false;
        this.isPaintEnabled = false;
        this.brushColor = '#878787';
        this.isPainting = false;
        this.paintHistoryTimer = null;

        this.initThree();
        this.initUI();
        this.initMobileTabs();
        this.initPainting();
        
        this.syncUI(); // Ensure UI matches config
        this.updateGrid();
        this.generateLayout();
        this.renderDiffuser();
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
        this.ambientLight = new THREE.AmbientLight(0xffffff, this.config.lighting.ambient);
        this.scene.add(this.ambientLight);
        this.mainLight = new THREE.DirectionalLight(0xffffff, this.config.lighting.intensity);
        this.mainLight.castShadow = true;
        this.mainLight.shadow.camera.left = -100; this.mainLight.shadow.camera.right = 100;
        this.mainLight.shadow.camera.top = 100; this.mainLight.shadow.camera.bottom = -100;
        this.mainLight.shadow.mapSize.set(2048, 2048);
        this.scene.add(this.mainLight);
        this.updateLightPosition();
        this.scene.add(this.blocks);
        window.addEventListener('resize', () => this.onWindowResize());

        this.renderer.xr.addEventListener('sessionstart', () => {
            this.isAR = true; this.scene.background = null;
            this.blocks.scale.setScalar(0.0254); this.blocks.position.set(0, 0, -1.5); this.blocks.rotation.x = Math.PI / 2;
        });
        this.renderer.xr.addEventListener('sessionend', () => {
            this.isAR = false; this.scene.background = new THREE.Color(this.config.backgroundColor);
            this.blocks.scale.setScalar(1); this.blocks.position.set(0, 0, 0); this.blocks.rotation.x = 0;
        });
    }

    updateLightPosition() {
        const rad = (this.config.lighting.angle * Math.PI) / 180;
        this.mainLight.position.set(Math.cos(rad) * 100, Math.sin(rad) * 100, 100);
    }

    getMaterial(color) {
        const key = (color || '#ffffff').toLowerCase();
        if (!this.materialCache[key]) {
            this.materialCache[key] = new THREE.MeshStandardMaterial({ color: key, roughness: 0.7, metalness: 0.1 });
        }
        return this.materialCache[key];
    }

    createColorSwatch(initialColor, onInput, onSelect, onRemove, immediateEdit = false) {
        const wrapper = document.createElement('div'); wrapper.className = 'color-swatch-wrapper';
        const swatch = document.createElement('div'); swatch.className = 'color-swatch'; swatch.style.backgroundColor = initialColor;
        const input = document.createElement('input'); input.type = 'color'; input.value = initialColor;
        
        input.addEventListener('input', (e) => {
            const newColor = e.target.value.toLowerCase(); swatch.style.backgroundColor = newColor; if (onInput) onInput(newColor);
        });
        
        const triggerSelect = () => { if (onSelect) onSelect(input.value.toLowerCase()); };
        const triggerEdit = () => { input.click(); };
        
        if (immediateEdit) {
            swatch.addEventListener('click', triggerEdit);
        } else {
            input.style.pointerEvents = 'none'; let timer;
            swatch.addEventListener('click', (e) => { if (e.detail === 1) triggerSelect(); });
            swatch.addEventListener('dblclick', triggerEdit);
            swatch.addEventListener('touchstart', () => { timer = setTimeout(() => { triggerEdit(); timer = null; }, 600); }, { passive: true });
            swatch.addEventListener('touchend', () => { if (timer) { clearTimeout(timer); triggerSelect(); } }, { passive: true });
        }
        
        swatch.appendChild(input); wrapper.appendChild(swatch);
        if (onRemove) {
            const btn = document.createElement('div'); btn.className = 'swatch-remove-btn'; btn.innerHTML = '×';
            btn.addEventListener('click', (e) => { e.stopPropagation(); onRemove(); }); wrapper.appendChild(btn);
        }
        return { wrapper, swatch };
    }

    initPainting() {
        const canvas = this.renderer.domElement;
        const getPoint = (e) => {
            const rect = canvas.getBoundingClientRect();
            let x, y;
            if (e.touches && e.touches.length > 0) { x = e.touches[0].clientX; y = e.touches[0].clientY; } else { x = e.clientX; y = e.clientY; }
            return { x: ((x - rect.left) / rect.width) * 2 - 1, y: -((y - rect.top) / rect.height) * 2 + 1 };
        };
        const paint = (e) => {
            if (this.config.colorLayoutType !== 'paint' || !this.isPaintEnabled || !this.isPainting) return;
            const pt = getPoint(e); this.mouse.set(pt.x, pt.y); this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.blocks.children, false);
            if (intersects.length > 0) {
                const intersect = intersects.find(i => i.object.type === 'Mesh');
                if (intersect) {
                    const mesh = intersect.object; const idx = mesh.userData.index; const color = this.brushColor.toLowerCase();
                    if (idx !== undefined && (this.config.colorLayout[idx] || '').toLowerCase() !== color) {
                        this.config.colorLayout[idx] = color; mesh.material = this.getMaterial(color); this.resetPaintTimer();
                    }
                }
            }
        };
        canvas.addEventListener('mousedown', (e) => { if(this.config.colorLayoutType === 'paint' && this.isPaintEnabled) { this.isPainting = true; this.controls.enabled = false; paint(e); } });
        canvas.addEventListener('mousemove', paint);
        window.addEventListener('mouseup', () => { this.isPainting = false; if(!this.isAR) this.controls.enabled = true; });
        canvas.addEventListener('touchstart', (e) => { if(this.config.colorLayoutType === 'paint' && this.isPaintEnabled) { this.isPainting = true; this.controls.enabled = false; paint(e); } }, {passive: false});
        canvas.addEventListener('touchmove', (e) => { if(this.isPainting) { e.preventDefault(); paint(e); } }, {passive: false});
        canvas.addEventListener('touchend', () => { this.isPainting = false; if(!this.isAR) this.controls.enabled = true; });
    }

    resetPaintTimer() {
        if (this.paintHistoryTimer) clearTimeout(this.paintHistoryTimer);
        this.paintHistoryTimer = setTimeout(() => this.saveToHistory(), 5000);
    }

    initUI() {
        ['overall-width', 'overall-height', 'block-size'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.config[id === 'overall-width' ? 'overallWidth' : (id === 'overall-height' ? 'overallHeight' : 'blockSize')] = parseFloat(e.target.value) || 1;
                this.updateGrid(); this.generateLayout(); this.renderDiffuser();
            });
        });

        document.getElementById('layout-type').addEventListener('change', (e) => {
            this.saveToHistory(); this.config.layoutType = e.target.value;
            this.updateLayoutUI(); this.updateGrid(); this.generateLayout(); this.renderDiffuser();
        });

        // Parametric UI
        document.getElementById('parametric-orientation').addEventListener('change', (e) => {
            this.saveToHistory(); this.config.parametric.orientation = e.target.value;
            this.updateGrid(); this.generateLayout(); this.renderDiffuser();
        });
        document.getElementById('parametric-spacing').addEventListener('input', (e) => {
            this.config.parametric.spacing = parseFloat(e.target.value) || 0;
            this.generateLayout(); this.renderDiffuser();
        });
        document.getElementById('add-parametric-wave-layer').addEventListener('click', () => {
            this.saveToHistory(); this.config.parametric.layers.push({ amp: 2, freq: 4, phase: 0.2 });
            this.renderParametricLayersUI(); this.generateLayout(); this.renderDiffuser();
        });
        document.getElementById('parametric-noise-slider').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.config.parametric.noiseAmount = val;
            document.getElementById('noise-amount-val').textContent = val;
            this.generateLayout(); this.renderDiffuser();
        });

        // Lighting UI
        document.getElementById('light-intensity').addEventListener('input', (e) => { this.config.lighting.intensity = parseFloat(e.target.value); this.mainLight.intensity = this.config.lighting.intensity; });
        document.getElementById('light-angle').addEventListener('input', (e) => { this.config.lighting.angle = parseFloat(e.target.value); this.updateLightPosition(); });
        document.getElementById('light-ambient').addEventListener('input', (e) => { this.config.lighting.ambient = parseFloat(e.target.value); this.ambientLight.intensity = this.config.lighting.ambient; });

        const bgPicker = document.getElementById('bg-color-picker');
        const bgSwatch = document.getElementById('bg-color-swatch');
        bgPicker.addEventListener('input', (e) => {
            this.config.backgroundColor = e.target.value; bgSwatch.style.backgroundColor = e.target.value; this.scene.background.set(e.target.value);
        });

        const btnPaintToggle = document.getElementById('btn-paint-mode');
        btnPaintToggle.addEventListener('click', () => {
            this.isPaintEnabled = !this.isPaintEnabled;
            btnPaintToggle.classList.toggle('active', this.isPaintEnabled);
            btnPaintToggle.textContent = this.isPaintEnabled ? 'Painting Enabled' : 'Enable painting';
        });

        document.getElementById('btn-paint-all').addEventListener('click', () => {
            this.saveToHistory();
            const color = this.brushColor.toLowerCase();
            this.config.colorLayout = this.config.colorLayout.map(() => color);
            this.renderDiffuser();
        });

        document.getElementById('add-brush-color').addEventListener('click', () => { this.saveToHistory(); this.config.brushPalette.push('#ffffff'); this.renderBrushColors(); });
        document.getElementById('add-color-wave-palette-color').addEventListener('click', () => { this.saveToHistory(); this.config.colorWaveColors.push('#ffffff'); this.renderPatternColors(); this.generateLayout(); this.renderDiffuser(); });
        document.getElementById('add-color-ripple-palette-color').addEventListener('click', () => { this.saveToHistory(); this.config.colorRippleColors.push('#ffffff'); this.renderPatternColors(); this.generateLayout(); this.renderDiffuser(); });

        document.getElementById('color-layout-type').addEventListener('change', (e) => { 
            this.saveToHistory(); this.config.colorLayoutType = e.target.value; this.updateLayoutUI(); 
            if (this.config.colorLayoutType !== 'paint') { this.generateLayout(); this.renderDiffuser(); }
            else { this.renderBrushColors(); }
            this.renderPatternColors();
        });
        document.getElementById('sync-color-layout').addEventListener('change', (e) => { this.saveToHistory(); this.config.syncColorLayout = e.target.checked; this.generateLayout(); this.renderDiffuser(); });

        ['wave-minDepth', 'wave-maxDepth', 'wave-depthStep', 'ripple-minDepth', 'ripple-maxDepth', 'ripple-depthStep'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', (e) => { const parts = id.split('-'); this.config[parts[0] + 'Constraints'][parts[1]] = parseFloat(e.target.value) || 0; this.generateLayout(); this.renderDiffuser(); });
        });

        document.getElementById('add-block-config').addEventListener('click', () => { this.saveToHistory(); this.config.blockTypes.push({ depth: 1, percentage: 0 }); this.renderBlockTypesUI(); });
        document.getElementById('add-color-config').addEventListener('click', () => { this.saveToHistory(); this.config.colorTypes.push({ color: '#cccccc', percentage: 0 }); this.renderColorTypesUI(); });
        document.getElementById('randomize-layout').addEventListener('click', () => { if (this.config.layoutType === 'random' && this.config.blockTypes.reduce((s, t) => s + t.percentage, 0) !== 100) return; this.saveToHistory(); this.generateLayout(); this.renderDiffuser(); });
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); } });
        document.getElementById('btn-export').addEventListener('click', () => this.exportJSON());
        document.getElementById('btn-load').addEventListener('click', () => document.getElementById('input-load').click());
        document.getElementById('input-load').addEventListener('change', (e) => this.loadJSON(e));
        document.getElementById('btn-save-pdf').addEventListener('click', () => this.exportPDF());

        const setupAR = (id) => {
            const btn = document.getElementById(id); if (!btn) return;
            if (!navigator.xr) btn.classList.add('disabled-look'); else navigator.xr.isSessionSupported('immersive-ar').then(s => { if(!s) btn.classList.add('disabled-look'); });
            btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (navigator.xr) { navigator.xr.isSessionSupported('immersive-ar').then(s => { if(s) { this.renderer.xr.setReferenceSpaceType('local'); navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body } }).then(sess => this.renderer.xr.setSession(sess)); } else alert("AR unsupported."); }); } else alert("WebXR unavailable."); });
        };
        setupAR('btn-ar'); setupAR('btn-ar-mobile');
    }

    renderParametricLayersUI() {
        const container = document.getElementById('parametric-layers-container'); if (!container) return; container.innerHTML = '';
        this.config.parametric.layers.forEach((layer, idx) => {
            const card = document.createElement('div'); card.className = 'config-card';
            const grid = document.createElement('div'); grid.className = 'config-card-grid grid-4';
            grid.innerHTML = `<div><label>Amp</label><input type="number" step="0.5" value="${layer.amp}" data-key="amp"></div><div><label>Freq</label><input type="number" step="0.1" value="${layer.freq}" data-key="freq"></div><div><label>Shift</label><input type="number" step="0.1" value="${layer.phase}" data-key="phase"></div><button class="btn-delete" ${idx === 0 ? 'disabled' : ''}>×</button>`;
            grid.querySelectorAll('input').forEach(input => { input.addEventListener('input', (e) => { layer[e.target.dataset.key] = parseFloat(e.target.value) || 0; this.generateLayout(); this.renderDiffuser(); }); });
            grid.querySelector('.btn-delete').addEventListener('click', () => { if (idx === 0) return; this.saveToHistory(); this.config.parametric.layers.splice(idx, 1); this.renderParametricLayersUI(); this.generateLayout(); this.renderDiffuser(); });
            card.appendChild(grid); container.appendChild(card);
        });
    }

    renderBrushColors() {
        const container = document.getElementById('brush-colors-list'); if (!container) return; container.innerHTML = '';
        this.config.brushPalette.forEach((color, idx) => {
            const { wrapper, swatch } = this.createColorSwatch(color, (newColor) => { this.config.brushPalette[idx] = newColor; this.brushColor = newColor; this.renderBrushColors(); }, (selColor) => { this.brushColor = selColor; this.renderBrushColors(); }, () => { this.saveToHistory(); this.config.brushPalette.splice(idx, 1); this.renderBrushColors(); }, false);
            if (this.brushColor.toLowerCase() === color.toLowerCase()) swatch.classList.add('active'); container.appendChild(wrapper);
        });
    }

    renderPatternColors() {
        const render = (id, colors, key) => {
            const container = document.getElementById(id); if (!container) return; container.innerHTML = '';
            colors.forEach((color, idx) => {
                const { wrapper } = this.createColorSwatch(color, (newColor) => { this.config[key][idx] = newColor; this.generateLayout(); this.renderDiffuser(); }, null, () => { this.saveToHistory(); this.config[key].splice(idx, 1); this.renderPatternColors(); this.generateLayout(); this.renderDiffuser(); }, true);
                container.appendChild(wrapper);
            });
        };
        render('color-wave-palette', this.config.colorWaveColors, 'colorWaveColors');
        render('color-ripple-palette', this.config.colorRippleColors, 'colorRippleColors');
    }

    initMobileTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        const sections = { preview: document.getElementById('preview-container'), config: document.getElementById('configuration-panel') };
        tabs.forEach(tab => {
            if (!tab.dataset.tab) return;
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active')); tab.classList.add('active');
                Object.values(sections).forEach(s => s.classList.remove('mobile-active')); sections[tab.dataset.tab].classList.add('mobile-active');
                if (tab.dataset.tab === 'preview') this.onWindowResize();
            });
        });
    }

    renderLayersUI() {
        const render = (id, layers, type) => {
            const container = document.getElementById(id); if (!container) return; container.innerHTML = '';
            layers.forEach((layer, idx) => {
                const card = document.createElement('div'); card.className = 'config-card';
                const grid = document.createElement('div'); grid.className = 'config-card-grid grid-4';
                let html = type === 'wave' ? `<div><label>Angle</label><input type="number" value="${layer.angle}" data-key="angle"></div><div><label>Amp</label><input type="number" step="0.5" value="${layer.amplitude}" data-key="amplitude"></div><div><label>Freq</label><input type="number" value="${layer.frequency}" data-key="frequency"></div>` : `<div><label>X/Y</label><div style="display:flex;gap:2px"><input type="number" step="0.1" value="${layer.x}" data-key="x" style="width:50%"><input type="number" step="0.1" value="${layer.y}" data-key="y" style="width:50%"></div></div><div><label>Amp</label><input type="number" step="0.5" value="${layer.amplitude}" data-key="amplitude"></div><div><label>Freq</label><input type="number" value="${layer.frequency}" data-key="frequency"></div>`;
                grid.innerHTML = html + `<button class="btn-delete">×</button>`; card.appendChild(grid);
                grid.querySelectorAll('input').forEach(input => { input.addEventListener('input', (e) => { layer[e.target.dataset.key] = parseFloat(e.target.value) || 0; this.generateLayout(); this.renderDiffuser(); }); });
                grid.querySelector('.btn-delete').addEventListener('click', () => { this.saveToHistory(); layers.splice(idx, 1); this.renderLayersUI(); this.generateLayout(); this.renderDiffuser(); });
                container.appendChild(card);
            });
        };
        render('wave-layers-container', this.config.waveLayers, 'wave'); render('ripple-layers-container', this.config.rippleLayers, 'ripple');
        render('color-wave-layers-container', this.config.colorWaveLayers, 'wave'); render('color-ripple-layers-container', this.config.colorRippleLayers, 'ripple');
    }

    updateLayoutUI() {
        ['random', 'wave', 'ripple', 'parametric'].forEach(type => {
            const el = document.getElementById(`settings-${type}`); if (el) el.style.display = (type === this.config.layoutType) ? 'flex' : 'none';
        });
        ['random', 'wave', 'ripple', 'paint'].forEach(type => {
            const el = document.getElementById(`settings-color-${type}`); if (el) el.style.display = (type === this.config.colorLayoutType) ? 'flex' : 'none';
        });
        document.getElementById('layout-type').value = this.config.layoutType;
        document.getElementById('color-layout-type').value = this.config.colorLayoutType;
        document.getElementById('sync-color-layout').checked = this.config.syncColorLayout;
    }

    saveToHistory() {
        const state = JSON.stringify(this.config); if (this.history.length === 0 || this.history[this.history.length - 1] !== state) { this.history.push(state); if (this.history.length > 50) this.history.shift(); this.renderHistoryUI(); }
    }

    undo() {
        if (this.history.length > 0) { this.config = JSON.parse(this.history.pop()); this.syncUI(); this.updateGrid(); this.generateLayout(); this.renderDiffuser(); this.renderHistoryUI(); }
    }

    syncUI() {
        document.getElementById('overall-width').value = this.config.overallWidth; document.getElementById('overall-height').value = this.config.overallHeight;
        document.getElementById('block-size').value = this.config.blockSize;
        document.getElementById('bg-color-picker').value = this.config.backgroundColor; document.getElementById('bg-color-swatch').style.backgroundColor = this.config.backgroundColor;
        this.scene.background.set(this.config.backgroundColor);
        ['wave', 'ripple'].forEach(s => { const c = this.config[`${s}Constraints`]; if (c) { document.getElementById(`${s}-minDepth`).value = c.minDepth; document.getElementById(`${s}-maxDepth`).value = c.maxDepth; document.getElementById(`${s}-depthStep`).value = c.depthStep; } });
        const p = this.config.parametric;
        document.getElementById('parametric-orientation').value = p.orientation; document.getElementById('parametric-spacing').value = p.spacing;
        document.getElementById('parametric-noise-slider').value = p.noiseAmount; document.getElementById('noise-amount-val').textContent = p.noiseAmount;
        document.getElementById('light-intensity').value = this.config.lighting.intensity; document.getElementById('light-angle').value = this.config.lighting.angle; document.getElementById('light-ambient').value = this.config.lighting.ambient;
        this.updateLayoutUI(); this.renderBlockTypesUI(); this.renderColorTypesUI(); this.renderLayersUI(); this.renderPatternColors(); this.renderParametricLayersUI();
        if (this.config.colorLayoutType === 'paint') this.renderBrushColors();
    }

    renderHistoryUI() { const btn = document.getElementById('btn-undo'); if (btn) btn.disabled = this.history.length === 0; }

    renderBlockTypesUI() {
        const container = document.getElementById('block-configs-container'); container.innerHTML = '';
        this.config.blockTypes.forEach((type, index) => {
            const row = document.createElement('div'); row.className = 'block-config-row';
            row.innerHTML = `<div class="compact-input-group"><label>Depth</label><input type="number" step="0.25" value="${type.depth}"></div><div class="compact-input-group"><input type="number" step="1" value="${type.percentage}"> %</div><button class="btn-delete">×</button>`;
            const inputs = row.querySelectorAll('input');
            inputs[0].addEventListener('input', (e) => { this.config.blockTypes[index].depth = parseFloat(e.target.value) || 0; });
            inputs[1].addEventListener('input', (e) => { this.config.blockTypes[index].percentage = parseFloat(e.target.value) || 0; const total = this.config.blockTypes.reduce((s, t) => s + t.percentage, 0); document.getElementById('validation-message').textContent = (this.config.layoutType === 'random' && total !== 100) ? `Total: ${total}% (Must be 100%)` : ''; });
            row.querySelector('.btn-delete').addEventListener('click', () => { this.saveToHistory(); this.config.blockTypes.splice(index, 1); this.renderBlockTypesUI(); });
            container.appendChild(row);
        });
    }

    renderColorTypesUI() {
        const container = document.getElementById('color-configs-container'); container.innerHTML = '';
        this.config.colorTypes.forEach((type, index) => {
            const row = document.createElement('div'); row.className = 'color-config-row';
            const { wrapper } = this.createColorSwatch(type.color, (newColor) => { this.config.colorTypes[index].color = newColor; if (this.config.colorLayoutType !== 'paint') this.renderDiffuser(); }, null, () => { this.saveToHistory(); this.config.colorTypes.splice(index, 1); this.renderColorTypesUI(); }, true);
            const pctDiv = document.createElement('div'); pctDiv.className = 'compact-input-group'; pctDiv.innerHTML = `<input type="number" step="1" value="${type.percentage}"> %`;
            pctDiv.querySelector('input').addEventListener('input', (e) => { this.config.colorTypes[index].percentage = parseFloat(e.target.value) || 0; const total = this.config.colorTypes.reduce((s, t) => s + t.percentage, 0); document.getElementById('color-validation-message').textContent = (this.config.colorLayoutType === 'random' && !this.config.syncColorLayout && total !== 100) ? `Total: ${total}% (Must be 100%)` : ''; });
            row.appendChild(wrapper); row.appendChild(pctDiv);
            const delBtn = document.createElement('button'); delBtn.className = 'btn-delete'; delBtn.innerHTML = '×';
            delBtn.addEventListener('click', () => { this.saveToHistory(); this.config.colorTypes.splice(index, 1); this.renderColorTypesUI(); });
            row.appendChild(delBtn); container.appendChild(row);
        });
    }

    updateGrid() {
        const bs = this.config.blockSize; const p = this.config.parametric;
        if (this.config.layoutType === 'parametric') {
            const step = bs + p.spacing;
            if (p.orientation === 'vertical') { this.cols = Math.floor(this.config.overallWidth / step) || 1; this.rows = Math.floor(this.config.overallHeight / bs) || 1; }
            else { this.cols = Math.floor(this.config.overallWidth / bs) || 1; this.rows = Math.floor(this.config.overallHeight / step) || 1; }
        } else { this.cols = Math.floor(this.config.overallWidth / bs) || 1; this.rows = Math.floor(this.config.overallHeight / bs) || 1; }
    }

    constrainDepth(d, constraints) {
        const { minDepth, maxDepth, depthStep } = constraints; let val = Math.min(Math.max(d, minDepth), maxDepth);
        if (depthStep > 0) val = Math.round(val / depthStep) * depthStep; return Math.min(Math.max(val, minDepth), maxDepth);
    }

    generateLayout() {
        const totalElements = this.cols * this.rows; let depths = [];
        if (this.config.layoutType === 'random') {
            let pool = []; this.config.blockTypes.forEach((type) => { const count = Math.round((type.percentage / 100) * totalElements); for (let i = 0; i < count; i++) pool.push(type.depth); });
            while (pool.length < totalElements) pool.push(this.config.blockTypes[0]?.depth || 0); while (pool.length > totalElements) pool.pop();
            for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
            depths = pool;
        } else if (this.config.layoutType === 'wave' || this.config.layoutType === 'ripple') {
            const layers = this.config.layoutType === 'wave' ? this.config.waveLayers : this.config.rippleLayers;
            const constraints = this.config.layoutType === 'wave' ? this.config.waveConstraints : this.config.rippleConstraints;
            for (let i = 0; i < totalElements; i++) {
                const col = i % this.cols; const row = Math.floor(i / this.cols); let totalAmp = 0;
                layers.forEach(l => {
                    if (this.config.layoutType === 'wave') { const rad = (l.angle * Math.PI) / 180; const proj = col * Math.cos(rad) + row * Math.sin(rad); totalAmp += (l.amplitude / 2) * (1 + Math.sin((2 * Math.PI * proj * this.config.blockSize) / l.frequency)); }
                    else { const dist = Math.sqrt(Math.pow(col - l.x * this.cols, 2) + Math.pow(row - l.y * this.rows, 2)); totalAmp += (l.amplitude / 2) * (1 + Math.sin((2 * Math.PI * dist * this.config.blockSize) / l.frequency)); }
                });
                depths.push(this.constrainDepth(totalAmp, constraints));
            }
        } else if (this.config.layoutType === 'parametric') {
            const p = this.config.parametric; const isVert = p.orientation === 'vertical';
            const primarySteps = isVert ? this.rows : this.cols; const shiftSteps = isVert ? this.cols : this.rows;
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    const mainIdx = isVert ? row : col; const shiftIdx = isVert ? col : row;
                    const normPos = mainIdx / (primarySteps || 1);
                    let depth = 0; p.layers.forEach(l => { depth += (l.amp / 2) * (1 + Math.sin(2 * Math.PI * l.freq * normPos + shiftIdx * l.phase)); });
                    if (p.noiseAmount > 0) depth += (Math.sin(col * 0.5 + row * 0.5) * Math.cos(col * 0.3) * 0.5 + Math.random() * 0.2) * p.noiseAmount * 5;
                    depths.push(Math.max(0.25, depth));
                }
            }
        }
        this.config.layout = depths;
        if (this.config.colorLayoutType !== 'paint') {
            let colors = [];
            if (this.config.syncColorLayout || this.config.layoutType === 'parametric') {
                this.config.layout.forEach((depth, i) => {
                    const palette = this.config.colorTypes;
                    if (this.config.layoutType === 'parametric') { const isVert = this.config.parametric.orientation === 'vertical'; const sliceIdx = isVert ? (i % this.cols) : Math.floor(i / this.cols); colors.push(palette[sliceIdx % palette.length]?.color || '#ffffff'); }
                    else { const typeIdx = this.config.blockTypes.findIndex(t => t.depth === depth); colors.push(palette[typeIdx % palette.length]?.color || '#ffffff'); }
                });
            } else {
                if (this.config.colorLayoutType === 'random') {
                    let pool = []; this.config.colorTypes.forEach(type => { const count = Math.round((type.percentage / 100) * totalElements); for (let i = 0; i < count; i++) pool.push(type.color); });
                    while (pool.length < totalElements) pool.push(this.config.colorTypes[0]?.color || '#ffffff'); while (pool.length > totalElements) pool.pop();
                    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
                    colors = pool;
                } else {
                    const layers = this.config.colorLayoutType === 'wave' ? this.config.colorWaveLayers : this.config.colorRippleLayers;
                    const palette = this.config.colorLayoutType === 'wave' ? this.config.colorWaveColors : this.config.colorRippleColors;
                    for (let i = 0; i < totalElements; i++) {
                        const col = i % this.cols; const row = Math.floor(i / this.cols); let totalT = 0;
                        layers.forEach(l => {
                            if (this.config.colorLayoutType === 'wave') { const rad = (l.angle * Math.PI) / 180; const proj = col * Math.cos(rad) + row * Math.sin(rad); totalT += (0.5 + 0.5 * Math.sin((2 * Math.PI * proj * this.config.blockSize) / l.frequency + l.amplitude)); }
                            else { const dist = Math.sqrt(Math.pow(col - l.x * this.cols, 2) + Math.pow(row - l.y * this.rows, 2)); totalT += (0.5 + 0.5 * Math.sin((2 * Math.PI * dist * this.config.blockSize) / l.frequency)); }
                        });
                        const colorIdx = Math.floor((totalT / (layers.length || 1)) * palette.length); colors.push(palette[colorIdx % palette.length] || '#ffffff');
                    }
                }
            }
            this.config.colorLayout = colors;
        }
    }

    renderDiffuser() {
        while(this.blocks.children.length > 0) { const child = this.blocks.children[0]; if(child.geometry && child.geometry !== this.boxGeo && child.geometry !== this.edgeGeo) child.geometry.dispose(); this.blocks.remove(child); }
        const { layout, colorLayout, blockSize, layoutType, parametric } = this.config;
        const bs = blockSize; const ps = layoutType === 'parametric' ? parametric.spacing : 0;
        const isVert = layoutType === 'parametric' && parametric.orientation === 'vertical'; const isHoriz = layoutType === 'parametric' && parametric.orientation === 'horizontal';
        const stepX = isVert ? bs + ps : bs; const stepY = isHoriz ? bs + ps : bs;
        const totalW = this.cols * stepX - (isVert ? ps : 0); const totalH = this.rows * stepY - (isHoriz ? ps : 0);
        layout.forEach((depth, index) => {
            const col = index % this.cols; const row = Math.floor(index / this.cols); const color = colorLayout[index] || '#ffffff';
            const mesh = new THREE.Mesh(this.boxGeo, this.getMaterial(color));
            mesh.scale.set(bs, bs, depth); mesh.position.set(col * stepX - totalW / 2 + bs / 2, -row * stepY + totalH / 2 - bs / 2, depth / 2);
            mesh.userData.index = index; mesh.castShadow = true; mesh.receiveShadow = true; this.blocks.add(mesh);
            const line = new THREE.LineSegments(this.edgeGeo, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.1, transparent: true }));
            line.scale.copy(mesh.scale); line.position.copy(mesh.position); this.blocks.add(line);
        });
    }

    loadJSON(event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader(); reader.onload = (e) => {
            try { this.saveToHistory(); const loaded = JSON.parse(e.target.result); if (loaded.overallWidth) { this.config = { ...this.config, ...loaded }; this.syncUI(); this.updateGrid(); this.generateLayout(); this.renderDiffuser(); } } catch (err) { alert("Failed to load file."); }
            event.target.value = '';
        }; reader.readAsText(file);
    }

    exportJSON() {
        const buildSheet = {}; this.config.layout.forEach((d, i) => { const c = this.config.colorLayout[i]; const k = `${c}_${d}in`; if (!buildSheet[k]) buildSheet[k] = { color: c, depth: d, count: 0 }; buildSheet[k].count++; });
        const data = { ...this.config, metadata: { exportedAt: new Date().toISOString(), totalElements: this.config.layout.length, buildSheet: Object.values(buildSheet) } };
        const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2)); a.download = `diffuser-build-sheet-${Date.now()}.json`; a.click();
    }

    exportPDF() {
        const doc = new jsPDF();
        const { overallWidth, overallHeight, blockSize, layout, colorLayout, layoutType } = this.config;
        
        doc.setFontSize(20); doc.text("Diffuser Build Instructions", 20, 20);
        doc.setFontSize(12); doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 30);
        doc.text(`Overall Size: ${overallWidth}" x ${overallHeight}"`, 20, 40);
        doc.text(`Block Size: ${blockSize}"`, 20, 50);
        doc.text(`Layout Type: ${layoutType}`, 20, 60);

        doc.setFontSize(16); doc.text("1. Cutting List (Material Prep)", 20, 80);
        const cutList = {};
        layout.forEach(d => { const key = `${d.toFixed(2)}"`; cutList[key] = (cutList[key] || 0) + 1; });
        let y = 90; doc.setFontSize(11);
        Object.entries(cutList).sort((a,b) => parseFloat(a[0]) - parseFloat(b[0])).forEach(([depth, count]) => {
            if(y > 270) { doc.addPage(); y = 20; }
            doc.text(`- Depth ${depth}: ${count} blocks`, 30, y); y += 7;
        });

        doc.addPage();
        doc.setFontSize(16); doc.text("2. Painting Instructions", 20, 20);
        const paintList = {};
        layout.forEach((d, i) => {
            const color = colorLayout[i] || '#FFFFFF';
            const key = `${color}_${d.toFixed(2)}"`;
            if(!paintList[key]) paintList[key] = { color, depth: d.toFixed(2), count: 0 };
            paintList[key].count++;
        });
        y = 30; doc.setFontSize(11);
        Object.values(paintList).sort((a,b) => a.color.localeCompare(b.color)).forEach(item => {
            if(y > 270) { doc.addPage(); y = 20; }
            doc.setFillColor(item.color); doc.rect(25, y-4, 5, 5, 'F');
            doc.text(`Color ${item.color}, Depth ${item.depth}": ${item.count} blocks`, 35, y); y += 8;
        });

        doc.addPage();
        doc.setFontSize(16); doc.text("3. Assembly Grid", 20, 20);
        doc.setFontSize(8); doc.text("Map showing block depths (in inches). Each square is a block.", 20, 30);
        const gridX = 20; const gridY = 40; const pageW = 170; const pageH = 220;
        const cellS = Math.min(pageW / this.cols, pageH / this.rows);
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const idx = r * this.cols + c; const d = layout[idx] || 0; const color = colorLayout[idx] || '#FFFFFF';
                const x = gridX + c * cellS; const yP = gridY + r * cellS;
                doc.setDrawColor(200); doc.rect(x, yP, cellS, cellS);
                if(cellS > 4) {
                    doc.setFillColor(color); doc.rect(x+0.5, yP+0.5, cellS-1, cellS-1, 'F');
                    doc.setTextColor(this.getContrastColor(color)); doc.setFontSize(Math.max(4, cellS * 0.4));
                    doc.text(d.toFixed(1), x + cellS/2, yP + cellS/2 + 1, { align: 'center' });
                }
            }
        }
        doc.save(`diffuser-build-guide-${Date.now()}.pdf`);
    }

    getContrastColor(hex) {
        const hexcolor = hex.replace("#", "");
        const r = parseInt(hexcolor.substr(0,2),16); const g = parseInt(hexcolor.substr(2,2),16); const b = parseInt(hexcolor.substr(4,2),16);
        return ((r*299+g*587+b*114)/1000 >= 128) ? 'black' : 'white';
    }

    onWindowResize() {
        const container = document.getElementById('three-canvas-wrapper'); if (!container) return;
        this.camera.aspect = container.clientWidth / container.clientHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() { this.controls.update(); this.renderer.render(this.scene, this.camera); }
}

new DiffuserConfigurator();
