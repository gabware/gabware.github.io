# SoundDiffuserBuilder - Project Mandates

## Project Core
A technical tool for designing and configuring acoustic diffusers with Random Skyline, Wave, and Ripple patterns.

## Development Mandates
- **Local Server Required:** This project uses ES Modules and Three.js. It **MUST** be served via a local web server (e.g., `python -m http.server`) to avoid CORS issues.
- **PWA Ready:** Maintain `manifest.json` and `sw.js`. All core assets must be cached for offline functionality.
- **Unit Precision:** All measurements MUST be in **inches**.
- **Layout Patterns:**
    - **Random Skyline:** Block distribution MUST sum to 100% before the user can click "Generate".
    - **Wave/Ripple:** Supports multiple additive layers with Min/Max/Step constraints.
- **Global Undo:** Every configuration change MUST be captured in the history stack (Ctrl+Z).
- **Responsive Design:** Maintain the mobile tabbed layout for portrait orientations.

## Core Features
- Multi-Layered Pattern Mixing (Additive Depths, Averaged Colors).
- Professional 3D Preview (Studio Lighting, Custom Background).
- Mobile-Friendly PWA (Installable, Offline-capable).
- Export/Load JSON with integrated Build Sheet.
