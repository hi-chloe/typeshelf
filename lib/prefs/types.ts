import type { ThemePreferences } from "../theme";
import { DEFAULT_THEME } from "../theme";

/** Current on-disk schema version for `typeshelf:prefs:v2`. */
export const PREFS_VERSION = 2 as const;

/** Canonical localStorage key (product-aligned). */
export const PREFS_STORAGE_KEY = "typeshelf:prefs:v2";

/**
 * Legacy keys left in place for one release after migration (do not delete).
 * Checked newest-first when the canonical key is empty.
 */
export const LEGACY_PREFS_KEYS = [
  "font-explorer:library-prefs:v4",
  "font-explorer:library-prefs:v3",
  "font-explorer:library-prefs:v2",
  "font-explorer:library-prefs:v1",
] as const;

export type LibraryPreferences = {
  favorites: string[];
  customCategories: string[];
  categoryOverrides: Record<string, string>;
  theme: ThemePreferences;
  /** Custom preview text color; null = follow theme `--ink`. */
  previewColor: string | null;
  /** Custom preview surface color; null = follow theme `--preview-bg`. */
  previewBgColor: string | null;
};

/** On-disk / export envelope. Always includes `version`. */
export type PersistedPreferences = LibraryPreferences & {
  version: number;
};

export const EMPTY_PREFS: LibraryPreferences = {
  favorites: [],
  customCategories: [],
  categoryOverrides: {},
  theme: { ...DEFAULT_THEME },
  previewColor: null,
  previewBgColor: null,
};

export function emptyPrefs(): LibraryPreferences {
  return {
    favorites: [],
    customCategories: [],
    categoryOverrides: {},
    theme: { ...DEFAULT_THEME },
    previewColor: null,
    previewBgColor: null,
  };
}

export function toPersisted(prefs: LibraryPreferences): PersistedPreferences {
  return {
    version: PREFS_VERSION,
    favorites: prefs.favorites,
    customCategories: prefs.customCategories,
    categoryOverrides: prefs.categoryOverrides,
    theme: prefs.theme,
    previewColor: prefs.previewColor,
    previewBgColor: prefs.previewBgColor,
  };
}
