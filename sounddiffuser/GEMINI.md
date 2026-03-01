# SoundDiffuserBuilder - Project Mandates

## Project Core
A technical design suite for acoustic diffusers, combining high-precision mathematical pattern generation with manual 3D painting.

## Development Mandates
- **Performance First:** All 3D rendering must utilize **material and geometry pooling**. Never recreate materials or geometries inside the main render loop or during frequent property updates.
- **Local Server & Security:** This project relies on ES Modules and WebXR. It **MUST** be served over HTTPS or localhost. AR features and PWA installation depend on this secure context.
- **Unit Integrity:** All physical measurements (Width, Height, Block Size, Depth) MUST be handled in **inches**. AR mode handles the 1:1 scale conversion (1" = 0.0254m) automatically.
- **UX Standards:**
    - **Paint Mode:** Brushes must support "Single-click to Select" and "Double-click/Long-press to Edit".
    - **Algorithmic Modes:** All other color swatches must support "Immediate Edit" on single click.
    - **DOM Stability:** Dynamic lists (Block/Color configurations) must NOT re-render the full list on `input` events to prevent focus loss.
- **Layout Logic:** 
    - **Additive mixing:** Multi-layered Waves/Ripples must sum their values before applying local Min/Max/Step constraints.
    - **Batch Undo:** Painting actions must be batched with a 5-second inactivity timeout before saving to history.

## Core Features
- Multi-Layered Sinusoidal Patterns (Additive Depths, Averaged Colors).
- Integrated 3D Paint Mode with persistent brush palettes.
- Precision manufacturing constraints (Min/Max/Step clamping).
- Installable PWA with 1:1 scale AR Preview.
- Production Export with integrated Build Sheet (Bill of Materials).
- Global State Undo system (Ctrl+Z).
