// Turns a validated layout into renderable geometry. Element vocabulary is
// Kakatiya-era: three-part crenellated walls, columns with the square →
// octagon → flaring-disc profile, torana gateways with stacked architraves
// and finials, stepped mandapa platforms.

import { MeshBuilder } from "./mesh.js";
import { assertValidLayout } from "../layout/validate.js";

const COLORS = {
  floor: [0.5, 0.41, 0.3, 1],       // worn court paving
  platform: [0.6, 0.45, 0.3, 1],    // dressed sandstone
  wall: [0.62, 0.44, 0.27, 1],      // sandstone
  pillar: [0.43, 0.39, 0.35, 1],    // granite
  gateway: [0.55, 0.38, 0.22, 1],   // darker sandstone
};

function segment(from, to) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  return {
    length,
    yaw: Math.atan2(-dz, dx),
    mid: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
    dir: [dx / length, dz / length],
  };
}

function platformHeightAt(layout, x, z) {
  for (const p of layout.platforms ?? []) {
    if (x >= p.min[0] && x <= p.max[0] && z >= p.min[1] && z <= p.max[1]) return p.height;
  }
  return 0;
}

// Plinth and coping courses stick out past the body; merlons run along the top.
function addWall(mb, wall) {
  const s = segment(wall.from, wall.to);
  const t = wall.thickness;
  const h = wall.height;
  mb.addBox([s.mid[0], 0.25, s.mid[1]], [s.length / 2, 0.25, t / 2 + 0.15], s.yaw);
  mb.addBox([s.mid[0], (0.5 + h - 0.22) / 2, s.mid[1]], [s.length / 2, (h - 0.72) / 2, t / 2], s.yaw);
  mb.addBox([s.mid[0], h - 0.11, s.mid[1]], [s.length / 2, 0.11, t / 2 + 0.12], s.yaw);
  const count = Math.max(1, Math.floor(s.length / 1.6));
  const pitch = s.length / count;
  for (let i = 0; i < count; i++) {
    const d = (i + 0.5) * pitch - s.length / 2;
    mb.addBox(
      [s.mid[0] + d * s.dir[0], h + 0.26, s.mid[1] + d * s.dir[1]],
      [Math.min(0.45, pitch * 0.3), 0.26, t * 0.36],
      s.yaw,
    );
  }
}

// Kakatiya column: plinth → square base → octagonal shaft → square mid-block
// → octagon → flaring 16-sided disc → abacus → crossed bracket arms.
function addPillar(mb, [x, z], height, width, baseY = 0) {
  const h = height;
  const w = width;
  const oct = Math.PI / 8;
  mb.addBox([x, baseY + 0.04 * h, z], [w * 0.85, 0.04 * h, w * 0.85]);
  mb.addBox([x, baseY + 0.185 * h, z], [w * 0.55, 0.105 * h, w * 0.55]);
  mb.addPrism(x, z, baseY + 0.29 * h, baseY + 0.52 * h, w * 0.52, w * 0.52, 8, oct);
  mb.addBox([x, baseY + 0.575 * h, z], [w * 0.58, 0.055 * h, w * 0.58]);
  mb.addPrism(x, z, baseY + 0.63 * h, baseY + 0.78 * h, w * 0.48, w * 0.48, 8, oct);
  mb.addPrism(x, z, baseY + 0.78 * h, baseY + 0.85 * h, w * 0.5, w * 0.72, 16);
  mb.addBox([x, baseY + 0.885 * h, z], [w * 0.62, 0.035 * h, w * 0.62]);
  mb.addBox([x, baseY + 0.96 * h, z], [w * 1.1, 0.04 * h, w * 0.5]);
  mb.addBox([x, baseY + 0.96 * h, z], [w * 0.5, 0.04 * h, w * 1.1]);
}

// Torana: two heavy posts, a lower architrave with overhanging scroll ends,
// a frieze of blocks, an upper architrave, and a row of finial spires.
function addGateway(mb, gate) {
  const s = segment(gate.from, gate.to);
  const H = gate.height;
  const [ux, uz] = s.dir;
  const at = (d, y) => [s.mid[0] + d * ux, y, s.mid[1] + d * uz];

  addPillar(mb, gate.from, H, 0.85);
  addPillar(mb, gate.to, H, 0.85);

  const over = s.length / 2 + 0.9;
  mb.addBox(at(0, H + 0.35), [over, 0.3, 0.45], s.yaw);
  for (const side of [-1, 1]) {
    mb.addBox(at(side * over, H - 0.05), [0.3, 0.4, 0.45], s.yaw);
  }

  if ((gate.lintels ?? 2) >= 2) {
    const blocks = Math.max(3, Math.round(s.length / 0.9));
    for (let i = 0; i < blocks; i++) {
      const d = ((i + 0.5) / blocks - 0.5) * s.length;
      mb.addBox(at(d, H + 0.95), [0.22, 0.26, 0.3], s.yaw);
    }
    mb.addBox(at(0, H + 1.5), [s.length / 2 + 0.55, 0.28, 0.42], s.yaw);
  }

  const finials = 5;
  for (let i = 0; i < finials; i++) {
    const d = (i / (finials - 1) - 0.5) * s.length * 0.8;
    const spike = i === (finials - 1) / 2 ? 1.05 : 0.65;
    const [fx, , fz] = at(d, 0);
    mb.addPrism(fx, fz, H + 1.78, H + 1.78 + spike, 0.26, 0, 4, Math.PI / 4);
  }
}

// Stepped platform: three tiers, each inset from the one below.
function addPlatform(mb, p) {
  const cx = (p.min[0] + p.max[0]) / 2;
  const cz = (p.min[1] + p.max[1]) / 2;
  const hw = (p.max[0] - p.min[0]) / 2;
  const hd = (p.max[1] - p.min[1]) / 2;
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const extra = (tiers - 1 - i) * 0.5;
    mb.addBox(
      [cx, (p.height * (i + 0.5)) / tiers, cz],
      [hw + extra, p.height / (2 * tiers), hd + extra],
    );
  }
}

export function buildScene(layout) {
  assertValidLayout(layout);

  const groups = {
    floor: new MeshBuilder(),
    platforms: new MeshBuilder(),
    walls: new MeshBuilder(),
    pillars: new MeshBuilder(),
    gateways: new MeshBuilder(),
  };

  const { width, depth } = layout.grid;
  groups.floor.addBox([width / 2, -0.1, depth / 2], [width / 2 + 2, 0.1, depth / 2 + 2]);

  for (const p of layout.platforms ?? []) addPlatform(groups.platforms, p);
  for (const w of layout.walls ?? []) addWall(groups.walls, w);
  for (const p of layout.pillars ?? []) {
    addPillar(groups.pillars, p.at, p.height, p.width, platformHeightAt(layout, ...p.at));
  }
  for (const g of layout.gateways ?? []) addGateway(groups.gateways, g);

  return Object.entries(groups)
    .map(([name, mesh]) => ({
      name,
      mesh,
      color: COLORS[name === "platforms" ? "platform" : name.replace(/s$/, "")] ?? COLORS.wall,
    }))
    .filter((p) => p.mesh.triangleCount > 0);
}
