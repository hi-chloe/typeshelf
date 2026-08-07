/**
 * Minimal sfnt readers for cataloging — avoids opentype.js (which materializes
 * every glyph and OOMs on large CJK faces).
 */

export type LiteFaceMeta = {
  family: string;
  style: string;
  fullName: string;
  postscriptName: string;
  weightClass: number;
  isFixedPitch: boolean;
  familyClassByte: number | null;
  panose: number[] | null;
};

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

type TableOff = { offset: number; length: number };

function findTables(
  buffer: ArrayBuffer,
): { tables: Map<string, TableOff>; flavor: string } {
  const view = new DataView(buffer);
  const flavor = readTag(view, 0);

  if (flavor === "wOFF" || flavor === "wOF2") {
    throw new Error(`Lite parser does not support ${flavor}`);
  }

  if (
    flavor !== "OTTO" &&
    flavor !== "true" &&
    flavor !== "typ1" &&
    !(
      view.getUint8(0) === 0 &&
      view.getUint8(1) === 1 &&
      view.getUint8(2) === 0 &&
      view.getUint8(3) === 0
    )
  ) {
    throw new Error(`Unsupported sfnt signature ${flavor}`);
  }

  const numTables = view.getUint16(4);
  const tables = new Map<string, TableOff>();
  for (let i = 0; i < numTables; i++) {
    const entry = 12 + i * 16;
    const tag = readTag(view, entry);
    tables.set(tag, {
      offset: view.getUint32(entry + 8),
      length: view.getUint32(entry + 12),
    });
  }
  return { tables, flavor };
}

function decodeNameString(
  bytes: Uint8Array,
  platformID: number,
  encodingID: number,
): string {
  // Windows Unicode (BMP) / Unicode platform
  if (
    platformID === 3 ||
    platformID === 0 ||
    (platformID === 3 && (encodingID === 1 || encodingID === 10))
  ) {
    const units = Math.floor(bytes.length / 2);
    let out = "";
    for (let i = 0; i < units; i++) {
      const code = (bytes[i * 2]! << 8) | bytes[i * 2 + 1]!;
      if (code === 0) continue;
      out += String.fromCharCode(code);
    }
    return out;
  }

  // Macintosh Roman (approx ASCII subset)
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}

function readNameTable(buffer: ArrayBuffer, table: TableOff) {
  const view = new DataView(buffer, table.offset, table.length);
  const bytes = new Uint8Array(buffer, table.offset, table.length);
  const count = view.getUint16(2);
  const stringOffset = view.getUint16(4);

  type Rec = {
    platformID: number;
    encodingID: number;
    languageID: number;
    nameID: number;
    text: string;
  };
  const records: Rec[] = [];

  for (let i = 0; i < count; i++) {
    const o = 6 + i * 12;
    const platformID = view.getUint16(o);
    const encodingID = view.getUint16(o + 2);
    const languageID = view.getUint16(o + 4);
    const nameID = view.getUint16(o + 6);
    const length = view.getUint16(o + 8);
    const offset = view.getUint16(o + 10);
    const slice = bytes.subarray(
      stringOffset + offset,
      stringOffset + offset + length,
    );
    const text = decodeNameString(slice, platformID, encodingID).trim();
    if (text) {
      records.push({ platformID, encodingID, languageID, nameID, text });
    }
  }

  const pick = (nameID: number): string => {
    const matches = records.filter((r) => r.nameID === nameID);
    if (matches.length === 0) return "";

    const prefer = (pred: (r: Rec) => boolean) =>
      matches.find(pred)?.text || "";

    return (
      prefer((r) => r.platformID === 3 && r.languageID === 0x0409) || // en-US
      prefer((r) => r.platformID === 3 && (r.languageID & 0xff) === 0x09) ||
      prefer((r) => r.platformID === 3) ||
      prefer((r) => r.platformID === 0) ||
      prefer((r) => r.platformID === 1 && r.languageID === 0) ||
      matches[0]!.text
    );
  };

  return {
    family: pick(16) || pick(1) || "Unknown", // 16 preferred family, 1 font family
    style: pick(17) || pick(2) || "Regular",
    fullName: pick(4),
    postscriptName: pick(6),
  };
}

function readOs2(buffer: ArrayBuffer, table: TableOff) {
  const view = new DataView(buffer, table.offset, table.length);
  const weightClass = table.length >= 6 ? view.getUint16(4) : 400;
  let familyClassByte: number | null = null;
  if (table.length >= 32) {
    familyClassByte = (view.getUint16(30) >> 8) & 0xff;
  }
  let panose: number[] | null = null;
  if (table.length >= 42) {
    panose = [];
    for (let i = 0; i < 10; i++) {
      panose.push(view.getUint8(32 + i));
    }
  }
  return {
    weightClass: weightClass > 0 ? weightClass : 400,
    familyClassByte,
    panose,
  };
}

function readPost(buffer: ArrayBuffer, table: TableOff): boolean {
  // post: fixed version (4) + italicAngle (4) + underlinePosition (2) +
  // underlineThickness (2) + isFixedPitch (4) at offset 12
  if (table.length < 16) return false;
  const view = new DataView(buffer, table.offset, table.length);
  return view.getUint32(12) !== 0;
}

/** Read family/style/weight/panose without loading glyph outlines. */
export function readLiteFaceMeta(buffer: ArrayBuffer): LiteFaceMeta {
  const { tables } = findTables(buffer);
  const nameTable = tables.get("name");
  if (!nameTable) {
    throw new Error("Font is missing a name table");
  }

  const names = readNameTable(buffer, nameTable);
  const os2Table = tables.get("OS/2");
  const os2 = os2Table
    ? readOs2(buffer, os2Table)
    : { weightClass: 400, familyClassByte: null, panose: null };
  const postTable = tables.get("post");
  const isFixedPitch = postTable ? readPost(buffer, postTable) : false;

  return {
    family: names.family,
    style: names.style,
    fullName: names.fullName,
    postscriptName: names.postscriptName,
    weightClass: os2.weightClass,
    isFixedPitch,
    familyClassByte: os2.familyClassByte,
    panose: os2.panose,
  };
}
