# thoranam

2D architectural drawings of Telugu historical structures — Kakatiya Kala
Thoranam, Lepakshi, Warangal Fort — in; walkable 3D game spaces out.

```
sketch.png ──extract──▶ layout.json ──build──▶ scene.glb ──▶ any engine
            (Claude vision,          (procedural           (Godot, Filament,
             structured output)       geometry)             Blender, three.js)
```

The layout JSON is the contract in the middle: walls as centerline segments,
pillars as points, gateways as torana spans — all in meters. Everything
downstream of the extractor is deterministic and dependency-free.

## Quickstart

```sh
npm install          # only needed for the vision step
npm test             # geometry + glTF unit tests, no network
npm run demo         # builds out/kala-thoranam.glb from the bundled fixture
```

Open `viewer/index.html` in a browser and drag the `.glb` in (or open it in
Blender / any glTF viewer).

## Extracting from a real drawing

Needs Claude API access (`ANTHROPIC_API_KEY`, or `ant auth login`):

```sh
node src/cli.js extract my-blueprint.png        # → my-blueprint.layout.json
node src/cli.js build my-blueprint.layout.json  # → my-blueprint.layout.glb
```

The extractor sends the image to Claude with a strict JSON schema
(`src/layout/schema.js`) so the response is guaranteed-parseable layout JSON.
Hand-edit the layout file freely and rebuild — `validate` checks it.

## Layout format

```jsonc
{
  "name": "…", "units": "meters",
  "grid":     { "width": 30, "depth": 30 },
  "walls":    [{ "from": [0,0], "to": [13,0], "height": 3, "thickness": 0.8 }],
  "pillars":  [{ "at": [12,12], "height": 4, "width": 0.5 }],
  "gateways": [{ "from": [13,0], "to": [17,0], "height": 8, "lintels": 3 }]
}
```

x → east, z → south, y → up, origin at the drawing's top-left.

## Roadmap (deliberately not built yet)

1. **Prove the pipeline** on 3–5 real drawings (this repo).
2. **Richer geometry**: stepped torana arches, wall crenellations, gopuram
   massing — still procedural, still from the same layout JSON.
3. **Android runtime**: load the `.glb` in Godot (Android export) or Filament
   (pure Kotlin). Not a custom C++ engine — streaming/LOD comes only when a
   real scene is too big, which none are yet.

## Layout of the code

```
src/layout/    schema + validation (the contract)
src/vision/    sketch → layout JSON (Claude API)
src/geometry/  layout JSON → triangle meshes
src/gltf/      meshes → .glb (zero-dependency writer)
src/cli.js     extract | build | demo | validate
fixtures/      hand-authored sample layouts
viewer/        drag-and-drop three.js GLB viewer
```
