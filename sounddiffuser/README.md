# Sound Diffuser Configurator

A technical tool for designing and calculating high-precision acoustic diffusers for studios, listening rooms, and architectural spaces.

## 1. Project Overview
This web application allows users to configure and design acoustic diffusers by defining overall size, block constraints, colors, and layout patterns. It provides real-time 3D visualization and exportable configuration files.

## 2. Core Features

### 2.1 3D Preview & Appearance
- **Real-time Rendering:** Powered by Three.js with studio-grade lighting and soft shadows.
- **Customizable Background:** Toggle between dark/light or custom background colors.
- **Multi-Color Palettes:** Add and manage a list of colors that are randomly distributed across the diffuser blocks.
- **Interactive Controls:** Rotate, zoom, and pan the model using OrbitControls.

### 2.2 Layout Patterns (Block Configuration)
- **Overall Dimensioning:** Set the total width and height in **inches**. The grid automatically calculates the number of blocks based on the specified block size.
- **Random Skyline:**
  - Define custom block depths (in).
  - Assign percentage distributions for each depth (must sum to 100%).
  - Manually "Generate" to re-randomize the distribution.
- **Wave:**
  - Continuous sinusoidal wave pattern.
  - Controls for orientation (Horizontal/Vertical), Wave Height (Amplitude), and Wave Width (Period).
- **Ripple:**
  - Radial wave pattern originating from a specific $(x, y)$ coordinate.
  - Controls for origin point, Ripple Height, and Ripple Width.

### 2.3 Productivity Tools
- **Global Undo System:** Revert any configuration change using the UI button or **Ctrl+Z**.
- **JSON Export:** Save your entire configuration (dimensions, block types, colors, and layout) to a portable JSON file.
- **JSON Load:** [Planned/In-progress] Restore a design from a saved configuration file.
- **AR Preview:** [Planned] Preview the diffuser on your own walls using WebAR.

## 3. Technical Specifications
- **Units:** All measurements are in **inches**.
- **Tech Stack:** Vanilla JS, Three.js, CSS3 (Flexbox/Grid), and HTML5.
- **Architecture:** Modular class-based design with a central `config` state and history management.

## 4. How to Run
Due to the use of ES Modules and Three.js, this project **must be served via a local web server**.
- **Python:** `python -m http.server 8000`
- **Node.js:** `npx serve`
- **VS Code:** Use the "Live Server" extension.
