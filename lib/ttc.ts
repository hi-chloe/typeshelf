/**
 * TrueType Collection (ttcf) helpers.
 * Each face in a TTC uses absolute table offsets into the shared file,
 * so faces must be rewritten into standalone sfnt buffers for opentype.js / FontFace.
 */

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

export function isTtcSignature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new DataView(buffer);
  return readTag(view, 0) === "ttcf";
}

export function getTtcFontCount(buffer: ArrayBuffer): number {
  if (!isTtcSignature(buffer) || buffer.byteLength < 12) return 0;
  return new DataView(buffer).getUint32(8);
}

/** Rebuild one face from a TTC into a standalone OpenType/TrueType buffer. */
export function extractTtcFace(
  collection: ArrayBuffer,
  fontIndex: number,
): ArrayBuffer {
  const view = new DataView(collection);
  if (readTag(view, 0) !== "ttcf") {
    throw new Error("Not a TrueType Collection");
  }

  const numFonts = view.getUint32(8);
  if (fontIndex < 0 || fontIndex >= numFonts) {
    throw new Error(`TTC face index ${fontIndex} out of range (0–${numFonts - 1})`);
  }

  const faceOffset = view.getUint32(12 + fontIndex * 4);
  const sfntTag = readTag(view, faceOffset);
  const numTables = view.getUint16(faceOffset + 4);
  const searchRange = view.getUint16(faceOffset + 6);
  const entrySelector = view.getUint16(faceOffset + 8);
  const rangeShift = view.getUint16(faceOffset + 10);

  type TableRec = {
    tag: string;
    checkSum: number;
    offset: number;
    length: number;
  };

  const tables: TableRec[] = [];
  for (let i = 0; i < numTables; i++) {
    const entry = faceOffset + 12 + i * 16;
    tables.push({
      tag: readTag(view, entry),
      checkSum: view.getUint32(entry + 4),
      offset: view.getUint32(entry + 8),
      length: view.getUint32(entry + 12),
    });
  }

  let dataSize = 0;
  for (const table of tables) {
    dataSize += (table.length + 3) & ~3;
  }

  const headerSize = 12 + 16 * numTables;
  const out = new ArrayBuffer(headerSize + dataSize);
  const outView = new DataView(out);
  const outBytes = new Uint8Array(out);
  const srcBytes = new Uint8Array(collection);

  outBytes[0] = sfntTag.charCodeAt(0);
  outBytes[1] = sfntTag.charCodeAt(1);
  outBytes[2] = sfntTag.charCodeAt(2);
  outBytes[3] = sfntTag.charCodeAt(3);
  outView.setUint16(4, numTables);
  outView.setUint16(6, searchRange);
  outView.setUint16(8, entrySelector);
  outView.setUint16(10, rangeShift);

  let writeAt = headerSize;
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]!;
    const dir = 12 + i * 16;

    outBytes[dir] = table.tag.charCodeAt(0);
    outBytes[dir + 1] = table.tag.charCodeAt(1);
    outBytes[dir + 2] = table.tag.charCodeAt(2);
    outBytes[dir + 3] = table.tag.charCodeAt(3);
    outView.setUint32(dir + 4, table.checkSum);
    outView.setUint32(dir + 8, writeAt);
    outView.setUint32(dir + 12, table.length);

    outBytes.set(
      srcBytes.subarray(table.offset, table.offset + table.length),
      writeAt,
    );
    writeAt += (table.length + 3) & ~3;
  }

  return out;
}

export type FaceMatchHint = {
  fullName?: string;
  postscriptName?: string;
  family?: string;
  style?: string;
};

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function faceMatchesHint(
  face: {
    fullName: string;
    postscriptName: string;
    family: string;
    style: string;
  },
  hint: FaceMatchHint,
): "exact" | "family" | false {
  const full = norm(hint.fullName);
  const ps = norm(hint.postscriptName);
  const family = norm(hint.family);
  const style = norm(hint.style);

  if (full && norm(face.fullName) === full) return "exact";
  if (ps && norm(face.postscriptName) === ps) return "exact";

  if (family && norm(face.family) === family) {
    if (
      style &&
      (norm(face.style) === style ||
        norm(face.fullName) === `${family} ${style}` ||
        norm(face.fullName).endsWith(` ${style}`))
    ) {
      return "exact";
    }
    return "family";
  }

  return false;
}

/**
 * Pick the best TTC face index for a Local Font Access entry.
 * Returns -1 if nothing plausible matches.
 */
export function matchTtcFaceIndex(
  faces: {
    fullName: string;
    postscriptName: string;
    family: string;
    style: string;
  }[],
  hint: FaceMatchHint,
): number {
  if (faces.length === 0) return -1;
  if (faces.length === 1) return 0;

  let familyFallback = -1;
  for (let i = 0; i < faces.length; i++) {
    const result = faceMatchesHint(faces[i]!, hint);
    if (result === "exact") return i;
    if (result === "family" && familyFallback < 0) familyFallback = i;
  }

  if (familyFallback >= 0) {
    const family = norm(hint.family);
    const familyFaces = faces
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => norm(f.family) === family);
    const reg = familyFaces.find(
      ({ f }) =>
        norm(f.style) === "regular" ||
        norm(f.style) === "normal" ||
        norm(f.style) === "roman",
    );
    return (reg ?? familyFaces[0])?.i ?? familyFallback;
  }

  return -1;
}
