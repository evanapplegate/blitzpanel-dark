# BlitzPanel Assembly Animation

Three.js animation system for STEP file component assembly.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Convert STEP to GLTF/GLB:
   - **Fusion 360**: File → Export → glTF → Save as `Montagem_final.glb` (if file is already open)
   - **Blender**: File → Import → STEP (install STEP import addon if needed) → File → Export → glTF 2.0 → Save as `Montagem_final.glb`
   - **FreeCAD**: File → Export → GLTF
   - **CAD Exchanger Cloud API**: Upload STEP → Convert to GLTF → Download
   - Place converted file as `Montagem_final.glb` in project root

3. Run dev server:
```bash
npm run dev
```

## Features

- Loads STEP/GLTF models
- Separates components automatically
- Animates components flying together and assembling
- Interactive camera controls
- Play/Reset controls

## STEP Conversion

STEP files need conversion to GLTF/GLB for web use. Options:

1. **Fusion 360** (Easiest if file is already open):
   - File → Export → glTF
   - Choose GLB format, name it `Montagem_final.glb`
   - Components in assembly will be preserved as separate meshes

2. **Blender** (Free, recommended):
   - Install STEP import addon: Edit → Preferences → Add-ons → Search "STEP" → Enable "Import-Export: STEP"
   - File → Import → STEP → Select `Montagem_final.STEP`
   - File → Export → glTF 2.0 (.glb/.gltf)
   - Choose GLB format, name it `Montagem_final.glb`
   - **Tip**: If components are separate objects, they'll be preserved as separate meshes/groups

3. **FreeCAD** (Free, desktop):
   - Open STEP file → File → Export → GLTF

4. **CAD Exchanger Cloud API** (Online):
   - Upload STEP → Convert to GLTF → Download

5. **OpenCASCADE.js** (Browser-based, heavy):
   - Can parse STEP directly but adds significant bundle size

