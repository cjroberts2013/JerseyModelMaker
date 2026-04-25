# JerseyModelMaker

A browser-based 3D editor for customizing framed jersey models and exporting print-ready STL / 3MF files. Built with React, Vite, Three.js (via @react-three/fiber), and opentype.js.

## Features

- Pick from a gallery of NFL team templates with live 3D previews
- Customize team name, player name, jersey number, and full-name signature
- Per-zone controls for font, size, depth, letter spacing, line spacing, alignment, color, and X/Y nudge
- Per-part color pickers (frame, matte, jersey, accent, stand)
- Export individual parts as STL with text merged into the part body, or download all parts as a `.zip`

## Run locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Build

```bash
npm run build
```

Produces a fully static `dist/` folder. No backend required.

## Deploy to GitHub Pages

Pushes to `main` are auto-deployed by `.github/workflows/deploy.yml`. The Vite `base` is set to `/JerseyModelMaker/` to match the repo path. In repo Settings → Pages, set Source = "GitHub Actions".
