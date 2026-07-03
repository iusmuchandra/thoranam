// Minimal triangle-mesh accumulator. Everything in the pipeline is built
// from oriented boxes, which keeps vertex budgets tiny for mobile targets.

export class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.indices = [];
  }

  addQuad(a, b, c, d, normal) {
    const base = this.positions.length / 3;
    for (const p of [a, b, c, d]) this.positions.push(p[0], p[1], p[2]);
    for (let i = 0; i < 4; i++) this.normals.push(normal[0], normal[1], normal[2]);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Box centered at `center` with the given half extents, rotated `yaw`
  // radians around the Y axis. Local +x maps to world (cos yaw, 0, -sin yaw).
  addBox(center, halfExtents, yaw = 0) {
    const [hx, hy, hz] = halfExtents;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const toWorld = ([x, y, z]) => [
      center[0] + x * cos + z * sin,
      center[1] + y,
      center[2] - x * sin + z * cos,
    ];
    const rotate = ([x, y, z]) => [x * cos + z * sin, y, -x * sin + z * cos];

    const faces = [
      { n: [0, 1, 0], q: [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]] },
      { n: [0, -1, 0], q: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
      { n: [1, 0, 0], q: [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]] },
      { n: [-1, 0, 0], q: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
      { n: [0, 0, 1], q: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
      { n: [0, 0, -1], q: [[-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz]] },
    ];
    for (const face of faces) {
      const [a, b, c, d] = face.q.map(toWorld);
      this.addQuad(a, b, c, d, rotate(face.n));
    }
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  get triangleCount() {
    return this.indices.length / 3;
  }
}
