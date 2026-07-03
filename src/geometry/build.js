// Turns a validated layout into renderable geometry: one mesh per element
// class (floor, walls, pillars, gateways), each with a stone-like material
// color assigned at export time.

import { MeshBuilder } from "./mesh.js";
import { assertValidLayout } from "../layout/validate.js";

const COLORS = {
  floor: [0.72, 0.66, 0.55, 1],   // packed earth / worn flagstone
  wall: [0.76, 0.6, 0.42, 1],     // sandstone
  pillar: [0.45, 0.44, 0.42, 1],  // granite
  gateway: [0.62, 0.45, 0.3, 1],  // darker sandstone
};

function segment(from, to) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  return {
    length: Math.hypot(dx, dz),
    yaw: Math.atan2(-dz, dx),
    mid: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
  };
}

function addWall(mb, wall) {
  const s = segment(wall.from, wall.to);
  mb.addBox(
    [s.mid[0], wall.height / 2, s.mid[1]],
    [s.length / 2, wall.height / 2, wall.thickness / 2],
    s.yaw,
  );
}

// Plinth, shaft, capital — the classic three-part column silhouette.
function addPillar(mb, [x, z], height, width) {
  const cap = Math.min(0.3, height * 0.1);
  mb.addBox([x, cap / 2, z], [width * 0.8, cap / 2, width * 0.8]);
  mb.addBox([x, height / 2, z], [width / 2, (height - 2 * cap) / 2, width / 2]);
  mb.addBox([x, height - cap / 2, z], [width * 0.7, cap / 2, width * 0.7]);
}

// Torana: two posts spanned by stacked lintels that overhang the posts,
// narrowing slightly as they rise.
function addGateway(mb, gate) {
  const s = segment(gate.from, gate.to);
  const postWidth = 0.6;
  addPillar(mb, gate.from, gate.height, postWidth);
  addPillar(mb, gate.to, gate.height, postWidth);
  const lintels = gate.lintels ?? 2;
  for (let i = 0; i < lintels; i++) {
    const halfLength = (s.length / 2) * (1.18 - i * 0.09) ;
    const y = gate.height + 0.3 + i * 0.75;
    mb.addBox([s.mid[0], y, s.mid[1]], [halfLength, 0.22, 0.32], s.yaw);
  }
}

export function buildScene(layout) {
  assertValidLayout(layout);

  const floor = new MeshBuilder();
  const walls = new MeshBuilder();
  const pillars = new MeshBuilder();
  const gateways = new MeshBuilder();

  const { width, depth } = layout.grid;
  floor.addBox([width / 2, -0.1, depth / 2], [width / 2 + 1, 0.1, depth / 2 + 1]);

  for (const w of layout.walls ?? []) addWall(walls, w);
  for (const p of layout.pillars ?? []) addPillar(pillars, p.at, p.height, p.width);
  for (const g of layout.gateways ?? []) addGateway(gateways, g);

  return [
    { name: "floor", mesh: floor, color: COLORS.floor },
    { name: "walls", mesh: walls, color: COLORS.wall },
    { name: "pillars", mesh: pillars, color: COLORS.pillar },
    { name: "gateways", mesh: gateways, color: COLORS.gateway },
  ].filter((p) => p.mesh.triangleCount > 0);
}
