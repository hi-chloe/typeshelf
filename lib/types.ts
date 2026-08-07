export type FontSource = "upload" | "system";

/** Built-in auto-classification buckets. */
export type BuiltinCategory =
  | "Serif"
  | "Sans-serif"
  | "Monospace"
  | "Display"
  | "Script"
  | "Other";

/** @deprecated Prefer BuiltinCategory — kept as alias for classifyFont. */
export type Category = BuiltinCategory;

export const BUILTIN_CATEGORIES: BuiltinCategory[] = [
  "Serif",
  "Sans-serif",
  "Monospace",
  "Display",
  "Script",
  "Other",
];

/** Back-compat alias used by older imports. */
export const CATEGORIES = BUILTIN_CATEGORIES;

export const FAVORITES_SECTION = "Favorites";

export interface FontEntry {
  id: string;
  family: string;
  style: string;
  weightClass: number;
  isFixedPitch: boolean;
  familyClassByte: number | null;
  panose: number[] | null;
  source: FontSource;
  /** Unique CSS family registered for this exact face (avoids browser synthesis). */
  cssFamily: string;
  /**
   * Registers the face on demand (and caches it). Cataloging never keeps
   * ArrayBuffers or FontFaces resident — only the selected preview does.
   */
  ensureFontFace(): Promise<FontFace>;
  /** Cached face if already ensured; otherwise null. */
  getFontFace(): FontFace | null;
}

export interface ParseWarning {
  id: string;
  message: string;
}

/** Local Font Access API (Chromium). */
export interface LocalFontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob(): Promise<Blob>;
}

declare global {
  interface Window {
    queryLocalFonts?: (options?: {
      postscriptNames?: string[];
    }) => Promise<LocalFontData[]>;
  }
}
