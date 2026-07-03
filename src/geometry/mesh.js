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

  addTriangle(a, b, c, normal) {
    const base = this.positions.length / 3;
    for (const p of [a, b, c]) this.positions.push(p[0], p[1], p[2]);
    for (let i = 0; i < 3; i++) this.normals.push(normal[0], normal[1], normal[2]);
    this.indices.push(base, base + 1, base + 2);
  }

  // n-sided prism/frustum around the vertical axis at (cx, cz), from y0 to
  // y1, radius r0 at the bottom and r1 at the top. Flat-shaded sides + caps.
  // r1 near zero makes a pyramid/spire.
  addPrism(cx, cz, y0, y1, r0, r1, sides = 8, yaw = 0) {
    const ring = (r, y) =>
      Array.from({ length: sides }, (_, i) => {
        const a = yaw + (i / sides) * Math.PI * 2;
        return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
      });
    const bot = ring(r0, y0);
    const top = ring(Math.max(r1, 1e-4), y1);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const [a, b, c, d] = [bot[i], bot[j], top[j], top[i]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / len, n[1] / len, n[2] / len];
      // orient outward from the axis (winding doesn't matter, lighting does)
      if (n[0] * (a[0] - cx) + n[2] * (a[2] - cz) < 0) n = [-n[0], -n[1], -n[2]];
      this.addQuad(a, b, c, d, n);
    }
    for (let i = 1; i < sides - 1; i++) {
      this.addTriangle(top[0], top[i], top[i + 1], [0, 1, 0]);
      this.addTriangle(bot[0], bot[i + 1], bot[i], [0, -1, 0]);
    }
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  get triangleCount() {
    return this.indices.length / 3;
  }
}
