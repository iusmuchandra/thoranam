import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateLayout, assertValidLayout } from "../src/layout/validate.js";

const fixture = JSON.parse(
  fs.readFileSync(new URL("../fixtures/kala-thoranam.json", import.meta.url), "utf8"),
);

test("fixture layout validates cleanly", () => {
  assert.deepEqual(validateLayout(fixture), []);
});

test("missing grid is rejected", () => {
  const bad = { ...fixture, grid: undefined };
  assert.ok(validateLayout(bad).some((e) => e.includes("grid")));
});

test("zero-length wall is rejected", () => {
  const bad = { ...fixture, walls: [{ from: [1, 1], to: [1, 1], height: 3, thickness: 0.8 }] };
  assert.ok(validateLayout(bad).some((e) => e.includes("zero-length")));
});

test("negative pillar height is rejected", () => {
  const bad = { ...fixture, pillars: [{ at: [1, 1], height: -2, width: 0.5 }] };
  assert.ok(validateLayout(bad).some((e) => e.includes("pillars[0]")));
});

test("assertValidLayout throws with error details", () => {
  assert.throws(() => assertValidLayout({}), /invalid layout/);
});
