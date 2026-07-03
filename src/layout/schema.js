// The layout format is the contract between the vision extractor and the
// geometry builder. Coordinates are meters on a top-down plane: x grows
// rightward (east), z grows downward (south), y is up. Origin is the
// structure's top-left corner in the drawing.

const VEC2 = {
  type: "array",
  items: { type: "number" },
  description: "[x, z] position in meters on the ground plane",
};

export const LAYOUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "units", "grid", "walls", "pillars", "gateways"],
  properties: {
    name: {
      type: "string",
      description: "Short name for the structure, e.g. 'Kakatiya Kala Thoranam courtyard'",
    },
    units: { type: "string", enum: ["meters"] },
    grid: {
      type: "object",
      additionalProperties: false,
      required: ["width", "depth"],
      properties: {
        width: { type: "number", description: "Site extent along x, meters" },
        depth: { type: "number", description: "Site extent along z, meters" },
      },
    },
    walls: {
      type: "array",
      description: "Straight wall runs as centerline segments. Leave gaps where gateways stand.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "height", "thickness"],
        properties: {
          from: VEC2,
          to: VEC2,
          height: { type: "number", description: "Wall height in meters" },
          thickness: { type: "number", description: "Wall thickness in meters" },
        },
      },
    },
    pillars: {
      type: "array",
      description: "Freestanding columns (mandapa grids, colonnades).",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["at", "height", "width"],
        properties: {
          at: VEC2,
          height: { type: "number" },
          width: { type: "number", description: "Square column side, meters" },
        },
      },
    },
    gateways: {
      type: "array",
      description:
        "Torana-style gateways: two posts spanned by stacked lintels. from/to are the two post positions.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "height", "lintels"],
        properties: {
          from: VEC2,
          to: VEC2,
          height: { type: "number", description: "Post height in meters" },
          lintels: { type: "integer", description: "Stacked crossbeams above the posts, usually 1-3" },
        },
      },
    },
  },
};
