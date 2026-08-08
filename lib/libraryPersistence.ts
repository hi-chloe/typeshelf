/**
 * Persist library organization prefs (not the font files themselves).
 * Safe for Next.js App Router — never touches localStorage on the server.
 */

import { isHexColor } from "./colorContrast";
import {
  DEFAULT_THEME,
  isColorScheme,
  isThemeMode,
  type ThemePreferences,
} from "./theme";

/** Current storage key. Bump when the prefs shape changes. */
export const LIBRARY_PREFS_KEY = "font-explorer:library-prefs:v4";

const LIBRARY_PREFS_KEY_V3 = "font-explorer:library-prefs:v3";
const LIBRARY_PREFS_KEY_V2 = "font-explorer:library-prefs:v2";
const LIBRARY_PREFS_KEY_V1 = "font-explorer:library-prefs:v1";

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

const EMPTY_PREFS: LibraryPreferences = {
  favorites: [],
  customCategories: [],
  categoryOverrides: {},
  theme: { ...DEFAULT_THEME },
  previewColor: null,
  previewBgColor: null,
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
}

function parseTheme(value: unknown): ThemePreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_THEME };
  const raw = value as Partial<ThemePreferences>;
  return {
    scheme: isColorScheme(raw.scheme) ? raw.scheme : DEFAULT_THEME.scheme,
    mode: isThemeMode(raw.mode) ? raw.mode : DEFAULT_THEME.mode,
  };
}

function parsePreviewColor(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (isHexColor(value)) return value.toLowerCase();
  return null;
}

function parseOrgFields(
  data: Record<string, unknown>,
): Pick<
  LibraryPreferences,
  "favorites" | "customCategories" | "categoryOverrides"
> {
  return {
    favorites: isStringArray(data.favorites) ? data.favorites : [],
    customCategories: isStringArray(data.customCategories)
      ? data.customCategories
      : [],
    categoryOverrides: isStringRecord(data.categoryOverrides)
      ? data.categoryOverrides
      : {},
  };
}

function readRaw(key: string): unknown | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePrefs(prefs: LibraryPreferences): void {
  window.localStorage.setItem(LIBRARY_PREFS_KEY, JSON.stringify(prefs));
}

function migrateFromV3(): LibraryPreferences | null {
  const parsed = readRaw(LIBRARY_PREFS_KEY_V3);
  if (!parsed) return null;

  const data = parsed as Record<string, unknown>;
  const prefs: LibraryPreferences = {
    ...parseOrgFields(data),
    theme: parseTheme(data.theme),
    previewColor: parsePreviewColor(data.previewColor),
    previewBgColor: null,
  };

  try {
    writePrefs(prefs);
    window.localStorage.removeItem(LIBRARY_PREFS_KEY_V3);
  } catch {
    // Still return migrated prefs for in-memory use even if rewrite fails.
  }

  return prefs;
}

function migrateFromV2(): LibraryPreferences | null {
  const parsed = readRaw(LIBRARY_PREFS_KEY_V2);
  if (!parsed) return null;

  const data = parsed as Record<string, unknown>;
  const prefs: LibraryPreferences = {
    ...parseOrgFields(data),
    theme: parseTheme(data.theme),
    previewColor: null,
    previewBgColor: null,
  };

  try {
    writePrefs(prefs);
    window.localStorage.removeItem(LIBRARY_PREFS_KEY_V2);
  } catch {
    // Still return migrated prefs for in-memory use even if rewrite fails.
  }

  return prefs;
}

/** Migrate v1 → current once, carrying org data forward. */
function migrateFromV1(): LibraryPreferences | null {
  const parsed = readRaw(LIBRARY_PREFS_KEY_V1);
  if (!parsed) return null;

  const data = parsed as Record<string, unknown>;
  const prefs: LibraryPreferences = {
    ...parseOrgFields(data),
    theme: { ...DEFAULT_THEME },
    previewColor: null,
    previewBgColor: null,
  };

  try {
    writePrefs(prefs);
    window.localStorage.removeItem(LIBRARY_PREFS_KEY_V1);
  } catch {
    // Still return migrated prefs for in-memory use even if rewrite fails.
  }

  return prefs;
}

export function loadLibraryPreferences(): LibraryPreferences {
  if (!isBrowser()) {
    return {
      ...EMPTY_PREFS,
      categoryOverrides: {},
      theme: { ...DEFAULT_THEME },
    };
  }

  try {
    const parsed = readRaw(LIBRARY_PREFS_KEY);
    if (parsed) {
      const data = parsed as Record<string, unknown>;
      return {
        ...parseOrgFields(data),
        theme: parseTheme(data.theme),
        previewColor: parsePreviewColor(data.previewColor),
        previewBgColor: parsePreviewColor(data.previewBgColor),
      };
    }

    const fromV3 = migrateFromV3();
    if (fromV3) return fromV3;

    const fromV2 = migrateFromV2();
    if (fromV2) return fromV2;

    const fromV1 = migrateFromV1();
    if (fromV1) return fromV1;

    return {
      ...EMPTY_PREFS,
      categoryOverrides: {},
      theme: { ...DEFAULT_THEME },
    };
  } catch {
    return {
      ...EMPTY_PREFS,
      categoryOverrides: {},
      theme: { ...DEFAULT_THEME },
    };
  }
}

export function saveLibraryPreferences(prefs: LibraryPreferences): void {
  if (!isBrowser()) return;

  try {
    writePrefs({
      favorites: prefs.favorites,
      customCategories: prefs.customCategories,
      categoryOverrides: prefs.categoryOverrides,
      theme: prefs.theme,
      previewColor: prefs.previewColor,
      previewBgColor: prefs.previewBgColor,
    });
  } catch {
    // Private browsing / quota / disabled storage — keep in-memory only.
  }
}
