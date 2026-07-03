// Self-contained binary glTF (.glb) writer — no dependencies. One node,
// mesh, and material per primitive group from buildScene().

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_INT = 5125;

function pad4(n) {
  return (4 - (n % 4)) % 4;
}

export function toGLB(primitives, { name = "thoranam" } = {}) {
  if (!primitives.length) throw new Error("toGLB: no primitives to export");

  const json = {
    asset: { version: "2.0", generator: "thoranam" },
    scene: 0,
    scenes: [{ name, nodes: primitives.map((_, i) => i) }],
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };

  const binParts = [];
  let binLength = 0;

  const pushView = (buf, target) => {
    const gap = pad4(binLength);
    if (gap) {
      binParts.push(Buffer.alloc(gap));
      binLength += gap;
    }
    json.bufferViews.push({ buffer: 0, byteOffset: binLength, byteLength: buf.length, target });
    binParts.push(buf);
    binLength += buf.length;
    return json.bufferViews.length - 1;
  };

  primitives.forEach((prim, i) => {
    const pos = new Float32Array(prim.mesh.positions);
    const nor = new Float32Array(prim.mesh.normals);
    const idx = new Uint32Array(prim.mesh.indices);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let j = 0; j < pos.length; j += 3) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], pos[j + k]);
        max[k] = Math.max(max[k], pos[j + k]);
      }
    }

    const posView = pushView(Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength), ARRAY_BUFFER);
    const norView = pushView(Buffer.from(nor.buffer, nor.byteOffset, nor.byteLength), ARRAY_BUFFER);
    const idxView = pushView(Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength), ELEMENT_ARRAY_BUFFER);

    const posAccessor = json.accessors.push({
      bufferView: posView, componentType: FLOAT, count: pos.length / 3, type: "VEC3", min, max,
    }) - 1;
    const norAccessor = json.accessors.push({
      bufferView: norView, componentType: FLOAT, count: nor.length / 3, type: "VEC3",
    }) - 1;
    const idxAccessor = json.accessors.push({
      bufferView: idxView, componentType: UNSIGNED_INT, count: idx.length, type: "SCALAR",
    }) - 1;

    json.materials.push({
      name: prim.name,
      pbrMetallicRoughness: { baseColorFactor: prim.color, metallicFactor: 0, roughnessFactor: 0.9 },
      doubleSided: true,
    });
    json.meshes.push({
      name: prim.name,
      primitives: [{
        attributes: { POSITION: posAccessor, NORMAL: norAccessor },
        indices: idxAccessor,
        material: i,
      }],
    });
    json.nodes.push({ name: prim.name, mesh: i });
  });

  const binGap = pad4(binLength);
  if (binGap) {
    binParts.push(Buffer.alloc(binGap));
    binLength += binGap;
  }
  json.buffers.push({ byteLength: binLength });
  const bin = Buffer.concat(binParts, binLength);

  let jsonBuf = Buffer.from(JSON.stringify(json));
  const jsonGap = pad4(jsonBuf.length);
  if (jsonGap) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonGap, 0x20)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonChunkHeader.writeUInt32LE(CHUNK_JSON, 4);

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(bin.length, 0);
  binChunkHeader.writeUInt32LE(CHUNK_BIN, 4);

  return Buffer.concat([header, jsonChunkHeader, jsonBuf, binChunkHeader, bin]);
}

// Parses just enough of a GLB to sanity-check it (used by tests and the CLI).
export function inspectGLB(buf) {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error("not a GLB: bad magic");
  if (buf.readUInt32LE(4) !== 2) throw new Error("unsupported glTF version");
  const total = buf.readUInt32LE(8);
  if (total !== buf.length) throw new Error(`length mismatch: header says ${total}, buffer is ${buf.length}`);
  const jsonLength = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== CHUNK_JSON) throw new Error("first chunk is not JSON");
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
  const binHeaderAt = 20 + jsonLength;
  const binLength = buf.readUInt32LE(binHeaderAt);
  if (buf.readUInt32LE(binHeaderAt + 4) !== CHUNK_BIN) throw new Error("second chunk is not BIN");
  if (json.buffers[0].byteLength !== binLength) throw new Error("BIN chunk length disagrees with buffers[0]");
  return json;
}
