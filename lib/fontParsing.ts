import { parse as parseOpenType } from "opentype.js";
import { readLiteFaceMeta, type LiteFaceMeta } from "./sfntMeta";
import type { FontEntry, FontSource } from "./types";
import {
  extractTtcFace,
  faceMatchesHint,
  getTtcFontCount,
  isTtcSignature,
  type FaceMatchHint,
} from "./ttc";
import { decompressWoff2ToSfnt } from "./woff2";

/** Cap resident FontFaces ΓÇö enough for a sidebar viewport + active preview. */
const MAX_RESIDENT_FACES = 28;

type ResidentFace = {
  id: string;
  face: FontFace;
  clearCache: () => void;
};

const residentFaces: ResidentFace[] = [];
let pinnedFaceId: string | null = null;

/** Keep the actively previewed face from being evicted by sidebar samples. */
export function pinResidentFace(id: string | null) {
  pinnedFaceId = id;
}

function retainFace(id: string, face: FontFace, clearCache: () => void) {
  const existing = residentFaces.findIndex((r) => r.id === id);
  if (existing >= 0) {
    residentFaces.splice(existing, 1);
  }
  residentFaces.push({ id, face, clearCache });

  while (residentFaces.length > MAX_RESIDENT_FACES) {
    const evictAt = residentFaces.findIndex((r) => r.id !== pinnedFaceId);
    if (evictAt < 0) break;
    const [evicted] = residentFaces.splice(evictAt, 1);
    if (!evicted) break;
    try {
      if (typeof document !== "undefined") {
        document.fonts.delete(evicted.face);
      }
    } catch {
      // ignore
    }
    evicted.clearCache();
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `font-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class FontParseError extends Error {
  constructor(
    message: string,
    readonly fileLabel: string,
  ) {
    super(message);
    this.name = "FontParseError";
  }
}

export type ParsedFontResult = {
  entry: FontEntry;
  warning?: string;
};

export type ParseOptions = {
  match?: FaceMatchHint;
  extractAllCollectionFaces?: boolean;
  getBuffer?: () => Promise<ArrayBuffer>;
};

type FaceMeta = LiteFaceMeta;

async function registerFontFace(
  cssFamily: string,
  buffer: ArrayBuffer,
  fileLabel: string,
): Promise<FontFace> {
  const descriptors: FontFaceDescriptors = {
    weight: "400",
    style: "normal",
    display: "block",
  };

  let lastError: unknown;

  try {
    const face = new FontFace(cssFamily, buffer, descriptors);
    await face.load();
    if (typeof document !== "undefined") {
      document.fonts.add(face);
    }
    return face;
  } catch (err) {
    lastError = err;
  }

  try {
    const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)]));
    try {
      const face = new FontFace(cssFamily, `url(${url})`, descriptors);
      await face.load();
      if (typeof document !== "undefined") {
        document.fonts.add(face);
      }
      return face;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    lastError = err;
  }

  // Last resort only ΓÇö opentype materializes glyphs and is expensive.
  try {
    const font = parseOpenType(buffer);
    const rebuilt = font.toArrayBuffer();
    const face = new FontFace(cssFamily, rebuilt, descriptors);
    await face.load();
    if (typeof document !== "undefined") {
      document.fonts.add(face);
    }
    return face;
  } catch (err) {
    lastError = err;
  }

  const detail =
    lastError instanceof Error ? lastError.message : "FontFace load failed";
  throw new FontParseError(
    `Could not register face for "${fileLabel}": ${detail}`,
    fileLabel,
  );
}

function createLazyEntry(
  meta: FaceMeta,
  source: FontSource,
  fileLabel: string,
  getBuffer: () => Promise<ArrayBuffer>,
  nameOverrides?: Partial<Pick<FontEntry, "family" | "style">>,
  warning?: string,
): ParsedFontResult {
  const id = createId();
  const cssFamily = `__fe_${id.replace(/-/g, "")}`;
  let cached: FontFace | null = null;
  let pending: Promise<FontFace> | null = null;

  const clearCache = () => {
    cached = null;
    pending = null;
  };

  const entry: FontEntry = {
    id,
    family: nameOverrides?.family || meta.family,
    style: nameOverrides?.style || meta.style,
    weightClass: meta.weightClass,
    isFixedPitch: meta.isFixedPitch,
    familyClassByte: meta.familyClassByte,
    panose: meta.panose,
    source,
    cssFamily,
    getFontFace: () => cached,
    ensureFontFace: async () => {
      if (cached) {
        retainFace(id, cached, clearCache);
        return cached;
      }
      if (pending) return pending;

      pending = (async () => {
        const buffer = await getBuffer();
        const face = await registerFontFace(cssFamily, buffer, fileLabel);
        cached = face;
        retainFace(id, face, clearCache);
        return face;
      })();

      try {
        return await pending;
      } finally {
        pending = null;
      }
    },
  };

  return { entry, warning };
}

function filenameGuessMeta(fileLabel: string): FaceMeta {
  return {
    family: fileLabel.replace(/\.[^.]+$/, "") || "Unknown",
    style: "Regular",
    fullName: "",
    postscriptName: "",
    weightClass: 400,
    isFixedPitch: false,
    familyClassByte: null,
    panose: null,
  };
}

async function parseSfntMetadata(
  buffer: ArrayBuffer,
  fileLabel: string,
): Promise<{ meta: FaceMeta; warning?: string }> {
  const looksLikeWoff2 =
    fileLabel.toLowerCase().endsWith(".woff2") || isWoff2Signature(buffer);
  const looksLikeWoff =
    fileLabel.toLowerCase().endsWith(".woff") || isWoffSignature(buffer);

  // WOFF2 tables are Brotli-compressed ΓÇö decompress to SFNT, then reuse the
  // same lite OS/2/post/name reader as TTF/OTF. FontFace still uses original bytes.
  if (looksLikeWoff2) {
    try {
      const sfnt = await decompressWoff2ToSfnt(buffer);
      return { meta: readLiteFaceMeta(sfnt) };
    } catch {
      return {
        meta: filenameGuessMeta(fileLabel),
        warning: `WOFF2 metadata is limited for "${fileLabel}" (decompression failed). Preview uses the file; family/style are inferred from the filename.`,
      };
    }
  }

  try {
    return { meta: readLiteFaceMeta(buffer) };
  } catch (err) {
    // WOFF needs table decompression ΓÇö fall back to opentype for single uploads.
    if (looksLikeWoff) {
      try {
        const font = parseOpenType(buffer);
        const os2 = font.tables.os2 as
          | { usWeightClass?: number; sFamilyClass?: number; panose?: number[] }
          | undefined;
        const post = font.tables.post as { isFixedPitch?: number } | undefined;
        const family =
          font.getEnglishName("preferredFamily") ||
          font.getEnglishName("fontFamily") ||
          fileLabel.replace(/\.[^.]+$/, "") ||
          "Unknown";
        const style =
          font.getEnglishName("preferredSubfamily") ||
          font.getEnglishName("fontSubfamily") ||
          "Regular";
        return {
          meta: {
            family,
            style,
            fullName: font.getEnglishName("fullName") || "",
            postscriptName: font.getEnglishName("postScriptName") || "",
            weightClass: os2?.usWeightClass || 400,
            isFixedPitch: Boolean(post?.isFixedPitch),
            familyClassByte:
              typeof os2?.sFamilyClass === "number"
                ? (os2.sFamilyClass >> 8) & 0xff
                : null,
            panose: os2?.panose ? Array.from(os2.panose) : null,
          },
        };
      } catch {
        // fall through
      }
    }

    const detail = err instanceof Error ? err.message : "Unknown parse error";
    throw new FontParseError(
      `Could not parse "${fileLabel}": ${detail}`,
      fileLabel,
    );
  }
}

/** Catalog a font: metadata only. FontFace bytes load later on preview. */
export async function parseFontBuffer(
  buffer: ArrayBuffer,
  source: FontSource,
  fileLabel = "font",
  options: ParseOptions = {},
): Promise<ParsedFontResult[]> {
  const getBuffer =
    options.getBuffer ??
    (async () => {
      return buffer.slice(0);
    });

  if (isTtcSignature(buffer)) {
    return catalogTtc(buffer, source, fileLabel, options, getBuffer);
  }

  const { meta, warning } = await parseSfntMetadata(buffer, fileLabel);
  return [
    createLazyEntry(meta, source, fileLabel, getBuffer, undefined, warning),
  ];
}

async function catalogTtc(
  buffer: ArrayBuffer,
  source: FontSource,
  fileLabel: string,
  options: ParseOptions,
  parentGetBuffer: () => Promise<ArrayBuffer>,
): Promise<ParsedFontResult[]> {
  const count = getTtcFontCount(buffer);
  if (count <= 0) {
    throw new FontParseError(
      `Could not parse "${fileLabel}": empty font collection`,
      fileLabel,
    );
  }

  const makeReloader = (index: number) => async () => {
    const full = await parentGetBuffer();
    return isTtcSignature(full) ? extractTtcFace(full, index) : full;
  };

  if (options.match) {
    let familyFallback: { index: number; meta: FaceMeta } | null = null;

    for (let i = 0; i < count; i++) {
      try {
        const faceBuffer = extractTtcFace(buffer, i);
        const meta = readLiteFaceMeta(faceBuffer);
        const hit = faceMatchesHint(meta, options.match);
        if (hit === "exact") {
          const label = meta.fullName || fileLabel;
          return [
            createLazyEntry(meta, source, label, makeReloader(i), {
              family: options.match.family || meta.family,
              style: options.match.style || meta.style,
            }),
          ];
        }
        if (hit === "family" && !familyFallback) {
          familyFallback = { index: i, meta };
        }
      } catch {
        // try next face
      }
    }

    if (familyFallback) {
      const { index, meta } = familyFallback;
      const label = meta.fullName || fileLabel;
      return [
        createLazyEntry(meta, source, label, makeReloader(index), {
          family: options.match.family || meta.family,
          style: options.match.style || meta.style,
        }),
      ];
    }

    throw new FontParseError(
      `Could not parse "${fileLabel}": no matching face in font collection`,
      fileLabel,
    );
  }

  const results: ParsedFontResult[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const faceBuffer = extractTtcFace(buffer, i);
      const { meta, warning } = await parseSfntMetadata(
        faceBuffer,
        `${fileLabel} #${i + 1}`,
      );
      const label = meta.fullName || `${fileLabel} #${i + 1}`;
      results.push(
        createLazyEntry(meta, source, label, makeReloader(i), undefined, warning),
      );
    } catch {
      // skip unreadable face
    }
  }

  if (results.length === 0) {
    throw new FontParseError(
      `Could not parse "${fileLabel}": no readable faces in font collection`,
      fileLabel,
    );
  }

  return results;
}

export async function parseFontBlob(
  blob: Blob,
  source: FontSource,
  fileLabel = "font",
  options: ParseOptions = {},
): Promise<ParsedFontResult[]> {
  const getBuffer = options.getBuffer ?? (() => blob.arrayBuffer());
  const buffer = await getBuffer();
  return parseFontBuffer(buffer, source, fileLabel, {
    ...options,
    getBuffer,
  });
}

export async function parseFontFile(file: File): Promise<ParsedFontResult[]> {
  const isCollection = file.name.toLowerCase().endsWith(".ttc");
  return parseFontBlob(file, "upload", file.name, {
    extractAllCollectionFaces: isCollection,
    getBuffer: () => file.arrayBuffer(),
  });
}

const ACCEPTED_EXTENSIONS = [".ttf", ".otf", ".woff", ".woff2", ".ttc"];

export function isAcceptedFontFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export type BatchParseResult = {
  fonts: FontEntry[];
  warnings: string[];
};

function collectResults(
  results: ParsedFontResult[],
  fonts: FontEntry[],
  warnings: string[],
) {
  for (const result of results) {
    fonts.push(result.entry);
    if (result.warning) warnings.push(result.warning);
  }
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function parseFontFiles(files: File[]): Promise<BatchParseResult> {
  const fonts: FontEntry[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    if (!isAcceptedFontFile(file)) {
      warnings.push(`Skipped "${file.name}": unsupported file type.`);
      continue;
    }

    try {
      const results = await parseFontFile(file);
      collectResults(results, fonts, warnings);
    } catch (err) {
      if (err instanceof FontParseError) {
        warnings.push(err.message);
      } else {
        const detail = err instanceof Error ? err.message : "Unknown error";
        warnings.push(`Failed to load "${file.name}": ${detail}`);
      }
    }

    await yieldToMain();
  }

  return { fonts, warnings };
}

export type SystemFontProgress = {
  done: number;
  total: number;
};

export async function parseLocalSystemFonts(
  localFonts: {
    family?: string;
    fullName?: string;
    postscriptName?: string;
    style?: string;
    blob: () => Promise<Blob>;
  }[],
  onProgress?: (progress: SystemFontProgress) => void,
): Promise<BatchParseResult> {
  const fonts: FontEntry[] = [];
  const warnings: string[] = [];
  let skippedUnreadable = 0;
  const total = localFonts.length;

  for (let i = 0; i < localFonts.length; i++) {
    const local = localFonts[i]!;
    const label = local.fullName || local.family || "system font";
    onProgress?.({ done: i, total });

    try {
      const getBuffer = async () => {
        const blob = await local.blob();
        return blob.arrayBuffer();
      };

      const buffer = await getBuffer();
      const results = await parseFontBuffer(buffer, "system", label, {
        match: {
          fullName: local.fullName,
          postscriptName: local.postscriptName,
          family: local.family,
          style: local.style,
        },
        getBuffer,
      });
      collectResults(results, fonts, warnings);
    } catch {
      skippedUnreadable += 1;
    }

    await yieldToMain();
  }

  onProgress?.({ done: total, total });

  if (skippedUnreadable > 0) {
    warnings.push(
      `Skipped ${skippedUnreadable} system face${skippedUnreadable === 1 ? "" : "s"} that could not be parsed (emoji fonts, odd formats, or unmatched collections).`,
    );
  }

  return { fonts, warnings };
}

function isWoff2Signature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  return (
    bytes[0] === 0x77 &&
    bytes[1] === 0x4f &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x32
  );
}

function isWoffSignature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  return (
    bytes[0] === 0x77 &&
    bytes[1] === 0x4f &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 // wOFF
  );
}
