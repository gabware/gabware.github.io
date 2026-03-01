# SoundDiffuserBuilder - Project Mandates

## Project Core
A technical tool for designing and configuring acoustic diffusers with Random Skyline, Wave, and Ripple patterns.

## Development Mandates
- **Local Server Required:** This project uses ES Modules and Three.js. It **MUST** be served via a local web server (e.g., `python -m http.server`) to avoid CORS issues.
- **Unit Precision:** All measurements MUST be in **inches**.
- **Layout Patterns:**
    - **Random Skyline:** Block distribution MUST sum to 100% before the user can click "Generate".
    - **Wave/Ripple:** Use sine functions for continuous depth calculation.
- **Global Undo:** Every significant configuration change MUST be captured in the history stack.
- **Three.js Usage:** Use the Import Map in `index.html` for modern, build-step-free development.

## Core Features
- Overall Dimension Configuration (Width x Height).
- Dynamic Block Type & Multi-Color Management.
- Advanced Patterns (Wave, Ripple).
- Professional 3D Preview (Studio Lighting, Soft Shadows, Custom Background).
- Global Undo (Ctrl + Z).
- Export/Load JSON configuration.
