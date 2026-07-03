import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MeshBuilder } from "../src/geometry/mesh.js";
import { buildScene } from "../src/geometry/build.js";

const fixture = JSON.parse(
  fs.readFileSync(new URL("../fixtures/kala-thoranam.json", import.meta.url), "utf8"),
);

test("a box is 24 vertices and 12 triangles", () => {
  const mb = new MeshBuilder();
  mb.addBox([0, 0, 0], [1, 2, 3]);
  assert.equal(mb.vertexCount, 24);
  assert.equal(mb.triangleCount, 12);
});

test("box vertices stay within center ± half extents", () => {
  const mb = new MeshBuilder();
  mb.addBox([5, 1, -2], [1.5, 2, 0.5]);
  for (let i = 0; i < mb.positions.length; i += 3) {
    assert.ok(Math.abs(mb.positions[i] - 5) <= 1.5 + 1e-9);
    assert.ok(Math.abs(mb.positions[i + 1] - 1) <= 2 + 1e-9);
    assert.ok(Math.abs(mb.positions[i + 2] + 2) <= 0.5 + 1e-9);
  }
});

test("yaw rotation preserves box dimensions", () => {
  const mb = new MeshBuilder();
  mb.addBox([0, 0, 0], [4, 1, 0.5], Math.PI / 2);
  // rotated 90°: x extent becomes z extent and vice versa
  let maxX = 0, maxZ = 0;
  for (let i = 0; i < mb.positions.length; i += 3) {
    maxX = Math.max(maxX, Math.abs(mb.positions[i]));
    maxZ = Math.max(maxZ, Math.abs(mb.positions[i + 2]));
  }
  assert.ok(Math.abs(maxX - 0.5) < 1e-9);
  assert.ok(Math.abs(maxZ - 4) < 1e-9);
});

test("normals are unit length", () => {
  const mb = new MeshBuilder();
  mb.addBox([0, 0, 0], [1, 1, 1], 0.7);
  for (let i = 0; i < mb.normals.length; i += 3) {
    const len = Math.hypot(mb.normals[i], mb.normals[i + 1], mb.normals[i + 2]);
    assert.ok(Math.abs(len - 1) < 1e-9);
  }
});

test("prism produces expected counts", () => {
  const mb = new MeshBuilder();
  mb.addPrism(0, 0, 0, 2, 1, 1, 8);
  // 8 side quads (4 verts) + 2 caps of 6 fan triangles (3 verts)
  assert.equal(mb.vertexCount, 8 * 4 + 2 * 6 * 3);
  assert.equal(mb.triangleCount, 8 * 2 + 2 * 6);
});

test("prism side normals point outward", () => {
  const mb = new MeshBuilder();
  mb.addPrism(5, -3, 0, 2, 1, 1, 8);
  // side quads come first: check each quad's normal against its first vertex
  for (let q = 0; q < 8; q++) {
    const v = q * 12; // 4 verts * 3 components per quad
    const outward = [mb.positions[v] - 5, 0, mb.positions[v + 2] + 3];
    const n = [mb.normals[v], mb.normals[v + 1], mb.normals[v + 2]];
    assert.ok(n[0] * outward[0] + n[2] * outward[2] > 0, `quad ${q} faces outward`);
  }
});

test("fixture builds all five primitive groups", () => {
  const prims = buildScene(fixture);
  assert.deepEqual(prims.map((p) => p.name), ["floor", "platforms", "walls", "pillars", "gateways"]);
  for (const p of prims) {
    assert.ok(p.mesh.triangleCount > 0, `${p.name} has triangles`);
    // every index must reference an existing vertex
    for (const idx of p.mesh.indices) {
      assert.ok(idx >= 0 && idx < p.mesh.vertexCount, `${p.name} index in range`);
    }
    // no NaN positions
    assert.ok(p.mesh.positions.every(Number.isFinite), `${p.name} positions finite`);
  }
});

test("geometry stays above the floor slab", () => {
  const prims = buildScene(fixture);
  for (const name of ["walls", "pillars", "gateways", "platforms"]) {
    const group = prims.find((p) => p.name === name);
    let minY = Infinity;
    for (let i = 1; i < group.mesh.positions.length; i += 3) {
      minY = Math.min(minY, group.mesh.positions[i]);
    }
    assert.ok(minY >= -1e-9, `${name} sit on y=0 (got ${minY})`);
  }
});

test("pillars on a platform start at platform height", () => {
  const prims = buildScene(fixture);
  const pillars = prims.find((p) => p.name === "pillars");
  let minY = Infinity;
  for (let i = 1; i < pillars.mesh.positions.length; i += 3) {
    minY = Math.min(minY, pillars.mesh.positions[i]);
  }
  // all fixture pillars sit on the 0.9m platform
  assert.ok(Math.abs(minY - 0.9) < 1e-9, `pillar base at platform top (got ${minY})`);
});

test("invalid layout is rejected before building", () => {
  assert.throws(() => buildScene({ name: "x", units: "meters" }), /invalid layout/);
});
