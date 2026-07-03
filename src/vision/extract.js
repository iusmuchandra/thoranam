// Sketch → layout JSON via the Claude API (vision + structured output).
// The SDK resolves credentials from ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN,
// or an `ant auth login` profile — no key handling here.

import fs from "node:fs";
import path from "node:path";
import { LAYOUT_SCHEMA } from "../layout/schema.js";
import { assertValidLayout } from "../layout/validate.js";

const MEDIA_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const EXTRACTION_PROMPT = `This image is a 2D architectural drawing — a plan, sketch, or blueprint of an
Indian historical structure (think Kakatiya Kala Thoranam, Lepakshi temple, Warangal Fort),
viewed top-down. Extract its structural layout.

Coordinate system: x increases to the right, z increases downward, origin at the
top-left corner of the structure. All values in meters.

Scale: use any written dimensions or scale bars first. If none, estimate from
convention — doorway spans 1.5-4m, wall thickness 0.6-1.2m, mandapa pillar
spacing 2-3.5m.

Extract:
- walls: straight centerline segments. Break wall runs where gateways interrupt
  them, leaving a gap the width of the gateway span. Default height 3m,
  thickness 0.8m if not annotated.
- pillars: freestanding column positions (mandapa grids, colonnades).
  Default height 4m, width 0.5m.
- gateways: torana/entrance spans. from/to are the two post positions on either
  side of the opening. Default height 8m, lintels 2.
- grid: the overall footprint (width along x, depth along z), padded a little
  beyond the outermost element.

Only include elements actually visible in the drawing. Preserve the drawing's
proportions and alignments — collinear walls should share coordinates.`;

export async function extractLayout(imagePath, { model = "claude-opus-4-8" } = {}) {
  const mediaType = MEDIA_TYPES[path.extname(imagePath).toLowerCase()];
  if (!mediaType) {
    throw new Error(`unsupported image type: ${imagePath} (use png, jpg, webp, or gif)`);
  }
  const data = fs.readFileSync(imagePath).toString("base64");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: LAYOUT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("extraction refused by the model — check the input image");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("extraction truncated (max_tokens) — layout may be too complex for one pass");
  }

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("no text block in model response");
  return assertValidLayout(JSON.parse(text));
}
