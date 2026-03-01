# Sound Diffuser Configurator

A high-performance technical tool for designing and calculating precision acoustic diffusers for studios, listening rooms, and architectural spaces.

## 1. Project Overview
This application balances mathematical generation with artistic control. Users can design acoustic structures using established Schroeder-inspired layouts (Skyline, Wave, Ripple) and manually refine them using an integrated 3D painting system.

## 2. Core Features

### 2.1 Professional 3D Visualization
- **Real-time Rendering:** Optimized Three.js engine with material and geometry pooling for high frame rates on all devices.
- **Studio Lighting Controls:** Customizable main light intensity, source angle, and ambient fill to verify shadow patterns.
- **Unified Swatch UI:** Professional circular color selection system used across background, palettes, and brushes.

### 2.2 Advanced Layout Patterns
- **Random Skyline:** discrete block depth management with percentage-based distribution.
- **Multi-Layered Mixing:** Add multiple "Wave" or "Ripple" layers.
  - **Additive Depths:** Layers sum their heights before applying min/max constraints.
  - **Averaged Colors:** Multi-layered color patterns are averaged for smooth transitions.
- **Precision Constraints:** All algorithmic layouts respect user-defined **Min Depth**, **Max Depth**, and **Step** increments (e.g., snapping to 1" material thickness).

### 2.3 Artistic Paint Mode
- **Integrated Workflow:** Paint Mode is a primary Color Layout type that allows manual override of algorithmic patterns.
- **Smart Selection UX:** Single-click to select a brush, double-click/long-press to edit its color.
- **Brush Management:** Create, edit, and remove custom brushes in a persistent palette.
- **Batch Undo:** Individual strokes are batched; history is saved after 5 seconds of non-painting.

### 2.4 Production & Portability
- **Installable PWA:** Full Progressive Web App support for home-screen installation and offline access.
- **1:1 Scale AR View:** View your design on your actual wall at real-world scale using WebXR.
- **Comprehensive Export:** JSON output includes the full configuration and a **Build Sheet (Bill of Materials)** with exact block counts per size and color.
- **Global Undo:** Robust `Ctrl+Z` support for every configuration change and manual edit.

## 3. Technical Specifications
- **Units:** Inches (Standard).
- **Tech Stack:** Vanilla JS, Three.js, WebXR, CSS Grid/Flexbox.
- **Architecture:** State-driven class model with global history management.

## 4. How to Run
Serve via a local web server to avoid CORS issues and enable PWA/AR features:
- **Python:** `python -m http.server 8000`
- **VS Code:** "Live Server" extension.
- **Note:** AR and Installation require an **HTTPS** connection (or localhost).
