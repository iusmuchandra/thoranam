#!/usr/bin/env node
// Packs a .glb into a single self-contained HTML file (viewer + scene, no
// network needed) — handy for opening scenes directly on a phone.
//
//   node scripts/pack-viewer.js out/kala-thoranam.glb "Scene name" [out.html]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectGLB } from "../src/gltf/export.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const [glbPath, sceneName, outPath] = process.argv.slice(2);
if (!glbPath) {
  console.error('usage: pack-viewer.js <scene.glb> ["Scene name"] [out.html]');
  process.exit(1);
}

const glb = fs.readFileSync(glbPath);
const json = inspectGLB(glb); // refuse to pack a broken file
const name = sceneName || json.scenes?.[0]?.name || path.basename(glbPath, ".glb");

const template = fs.readFileSync(path.join(ROOT, "viewer/mobile-template.html"), "utf8");
const html = template
  .replace("__SCENE_NAME__", name)
  .replace("__GLB_BASE64__", glb.toString("base64"));

const out = outPath || glbPath.replace(/\.glb$/, ".html");
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KiB, scene "${name}")`);
