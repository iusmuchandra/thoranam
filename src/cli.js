#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildScene } from "./geometry/build.js";
import { toGLB, inspectGLB } from "./gltf/export.js";
import { validateLayout } from "./layout/validate.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const USAGE = `thoranam — 2D architectural sketch → 3D glTF scene

Usage:
  thoranam extract <sketch.png|jpg> [-o layout.json]   Vision-extract a layout (needs Claude API access)
  thoranam build <layout.json> [-o scene.glb]          Build a .glb from a layout
  thoranam demo                                        Build the bundled Kala Thoranam fixture
  thoranam validate <layout.json>                      Check a layout file

Open the .glb in viewer/index.html (drag & drop), Blender, or any glTF viewer.`;

function outFlag(args, fallback) {
  const i = args.indexOf("-o");
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

function writeGLB(layout, outPath) {
  const primitives = buildScene(layout);
  const glb = toGLB(primitives, { name: layout.name });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, glb);
  inspectGLB(fs.readFileSync(outPath)); // fail loudly if we wrote garbage
  const tris = primitives.reduce((n, p) => n + p.mesh.triangleCount, 0);
  console.log(`wrote ${outPath} — ${primitives.length} meshes, ${tris} triangles, ${(glb.length / 1024).toFixed(1)} KiB`);
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "extract": {
    const image = args[0];
    if (!image) throw new Error("usage: thoranam extract <sketch.png> [-o layout.json]");
    const { extractLayout } = await import("./vision/extract.js");
    const layout = await extractLayout(image);
    const out = outFlag(args, image.replace(/\.[^.]+$/, "") + ".layout.json");
    fs.writeFileSync(out, JSON.stringify(layout, null, 2) + "\n");
    console.log(`wrote ${out} — "${layout.name}": ${layout.walls.length} walls, ${layout.pillars.length} pillars, ${layout.gateways.length} gateways`);
    console.log(`next: node src/cli.js build ${out}`);
    break;
  }
  case "build": {
    const layoutPath = args[0];
    if (!layoutPath) throw new Error("usage: thoranam build <layout.json> [-o scene.glb]");
    const layout = JSON.parse(fs.readFileSync(layoutPath, "utf8"));
    writeGLB(layout, outFlag(args, layoutPath.replace(/\.json$/, "") + ".glb"));
    break;
  }
  case "demo": {
    const layout = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/kala-thoranam.json"), "utf8"));
    writeGLB(layout, path.join(ROOT, "out/kala-thoranam.glb"));
    break;
  }
  case "validate": {
    const layout = JSON.parse(fs.readFileSync(args[0], "utf8"));
    const errors = validateLayout(layout);
    if (errors.length) {
      console.error(`invalid:\n  - ${errors.join("\n  - ")}`);
      process.exit(1);
    }
    console.log("valid");
    break;
  }
  default:
    console.log(USAGE);
    process.exit(command ? 1 : 0);
}
