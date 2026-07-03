import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildScene } from "../src/geometry/build.js";
import { toGLB, inspectGLB } from "../src/gltf/export.js";

const fixture = JSON.parse(
  fs.readFileSync(new URL("../fixtures/kala-thoranam.json", import.meta.url), "utf8"),
);

test("fixture exports to a structurally valid GLB", () => {
  const prims = buildScene(fixture);
  const glb = toGLB(prims, { name: fixture.name });
  const json = inspectGLB(glb); // throws on any structural problem

  assert.equal(json.asset.version, "2.0");
  assert.equal(json.meshes.length, prims.length);
  assert.equal(json.materials.length, prims.length);
  assert.equal(json.nodes.length, prims.length);
  assert.equal(json.scenes[0].nodes.length, prims.length);
  // 3 accessors (POSITION, NORMAL, indices) per primitive
  assert.equal(json.accessors.length, prims.length * 3);
});

test("accessor counts match the source meshes", () => {
  const prims = buildScene(fixture);
  const json = inspectGLB(toGLB(prims));
  prims.forEach((prim, i) => {
    const mesh = json.meshes[i];
    const pos = json.accessors[mesh.primitives[0].attributes.POSITION];
    const idx = json.accessors[mesh.primitives[0].indices];
    assert.equal(pos.count, prim.mesh.vertexCount);
    assert.equal(idx.count, prim.mesh.indices.length);
    assert.ok(pos.min.every(Number.isFinite) && pos.max.every(Number.isFinite));
  });
});

test("all bufferViews are 4-byte aligned and inside the BIN chunk", () => {
  const json = inspectGLB(toGLB(buildScene(fixture)));
  const binLength = json.buffers[0].byteLength;
  for (const view of json.bufferViews) {
    assert.equal(view.byteOffset % 4, 0);
    assert.ok(view.byteOffset + view.byteLength <= binLength);
  }
});

test("empty scene is rejected", () => {
  assert.throws(() => toGLB([]), /no primitives/);
});
