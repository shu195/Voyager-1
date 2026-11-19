# Voyager 1 — 3D Hardware & Mission Explorer

An interactive WebGL 3D model and engineering simulator of NASA's **Voyager 1** spacecraft, built to commemorate it reaching **1 light-day from Earth** (November 2026).

Everything—from the 3.7-meter high-gain parabolic dish and RTG boom to the decagonal bus electronics and procedural surface materials—is generated in pure TypeScript and Three.js without external 3D mesh files.

## Features

- **Procedural 3D Spacecraft (`src/three/`)**: Full WebGL model with runtime-generated textures, lighting modes, bloom, and smooth orbital camera presets.
- **Exploded View, Cutaway & X-Ray Mode**: Peel back the thermal blankets and bus housing to inspect internal circuitry and hardware subsystems.
- **Subsystem Focus & Hardware Inspector**: Isolate **Communications**, **Power**, **Bus**, **Science**, and **Payload** subsystems with interactive hover tooltips, component specs, and scientific charts.
- **Engineering Simulation Lab**:
  - Scrub across mission epochs (1977–2026+) to observe RTG power decay and solar flux changes.
  - Toggle individual instrument and heater loads to compute live electrical draw, internal bus temperature, and bimetallic thermal louver openness.
  - Articulate the science scan platform (azimuth & elevation), fire attitude thruster pulses, and toggle vector overlays.
- **Live Interstellar Ephemeris**: Real-time distance and mission telemetry readout updated every 10 seconds.
- **Golden Record Decoder**: Dedicated interactive modal exploring the Voyager Golden Record.

## Tech Stack

- **Framework**: React 19, TypeScript, Vite 8
- **3D / Graphics**: Three.js (`three`), procedural geometry & canvas textures
- **Styling & Motion**: Tailwind CSS v4, Motion (`motion`), Lucide Icons

## Project Structure

```text
src/
├── App.tsx                             # Main state, ephemeris loop, thermal & power simulation
├── data/
│   └── voyagerData.ts                  # Component catalog, mission epochs, JPL ephemeris math
├── three/
│   ├── VoyagerViewport.tsx             # Three.js canvas, camera rig, lighting & post-processing
│   ├── buildVoyagerModel.ts            # Procedural Voyager 1 3D geometry assembly
│   └── proceduralTextures.ts           # Runtime-generated surface & foil textures
└── components/
    ├── ControlDock.tsx                 # Viewport & subsystem controls
    ├── InspectorDrawer.tsx             # Selected hardware specifications
    ├── SimulationLabDrawer.tsx         # Power budget, thermal louver, timeline & kinematics lab
    ├── MissionTelemetryOverlay.tsx     # Live interstellar ephemeris HUD
    ├── GoldenRecordModal.tsx           # Voyager Golden Record explorer
    └── ScientificChart.tsx             # Mission & telemetry data visualizations
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended, `bun.lock` included) or Node.js 20+

### Installation & Local Development

```bash
git clone https://github.com/shu195/Voyager-1.git
cd Voyager-1
bun install
bun run dev
```

*(Or with npm: `npm install && npm run dev`)*

The development server runs at `http://localhost:3000`.

### Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start Vite dev server on port 3000 |
| `bun run build` | Build production bundle to `dist/` |
| `bun run preview` | Preview production build locally |
| `bun run lint` | Run TypeScript type-checking (`tsc --noEmit`) |

## Author

**Shubham Barmase** ([@shu195](https://github.com/shu195))

## License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.
