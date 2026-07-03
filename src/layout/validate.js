// Runtime validation for layout JSON, whether it came from the vision
// extractor, a fixture, or a hand-edited file. Returns a list of error
// strings; empty means valid.

function isVec2(v) {
  return Array.isArray(v) && v.length === 2 && v.every((n) => Number.isFinite(n));
}

function isPositive(n) {
  return Number.isFinite(n) && n > 0;
}

export function validateLayout(layout) {
  const errors = [];
  if (layout === null || typeof layout !== "object") {
    return ["layout must be an object"];
  }

  if (typeof layout.name !== "string" || !layout.name) errors.push("name must be a non-empty string");
  if (layout.units !== "meters") errors.push('units must be "meters"');

  if (!layout.grid || !isPositive(layout.grid.width) || !isPositive(layout.grid.depth)) {
    errors.push("grid.width and grid.depth must be positive numbers");
  }

  for (const [i, w] of (layout.walls ?? []).entries()) {
    if (!isVec2(w.from) || !isVec2(w.to)) errors.push(`walls[${i}]: from/to must be [x, z] pairs`);
    else if (w.from[0] === w.to[0] && w.from[1] === w.to[1]) errors.push(`walls[${i}]: zero-length segment`);
    if (!isPositive(w.height)) errors.push(`walls[${i}]: height must be positive`);
    if (!isPositive(w.thickness)) errors.push(`walls[${i}]: thickness must be positive`);
  }

  for (const [i, p] of (layout.pillars ?? []).entries()) {
    if (!isVec2(p.at)) errors.push(`pillars[${i}]: at must be an [x, z] pair`);
    if (!isPositive(p.height)) errors.push(`pillars[${i}]: height must be positive`);
    if (!isPositive(p.width)) errors.push(`pillars[${i}]: width must be positive`);
  }

  for (const [i, g] of (layout.gateways ?? []).entries()) {
    if (!isVec2(g.from) || !isVec2(g.to)) errors.push(`gateways[${i}]: from/to must be [x, z] pairs`);
    else if (g.from[0] === g.to[0] && g.from[1] === g.to[1]) errors.push(`gateways[${i}]: zero-width span`);
    if (!isPositive(g.height)) errors.push(`gateways[${i}]: height must be positive`);
    if (g.lintels !== undefined && (!Number.isInteger(g.lintels) || g.lintels < 0)) {
      errors.push(`gateways[${i}]: lintels must be a non-negative integer`);
    }
  }

  return errors;
}

export function assertValidLayout(layout) {
  const errors = validateLayout(layout);
  if (errors.length) {
    throw new Error(`invalid layout:\n  - ${errors.join("\n  - ")}`);
  }
  return layout;
}
