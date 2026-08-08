import { isHexColor } from "../colorContrast";
import {
  DEFAULT_THEME,
  isColorScheme,
  isThemeMode,
  type ThemePreferences,
} from "../theme";
import {
  emptyPrefs,
  PREFS_VERSION,
  type LibraryPreferences,
  type PersistedPreferences,
} from "./types";

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

/**
 * Infer a synthetic schema version for legacy payloads that lack `version`.
 * 0 = org fields only (font-explorer v1)
 * 1 = has theme and/or preview color fields (intermediate Typeshelf payloads)
 */
export function inferLegacyVersion(data: Record<string, unknown>): number {
  if (typeof data.version === "number" && Number.isFinite(data.version)) {
    return data.version;
  }
  if ("theme" in data || "previewColor" in data || "previewBgColor" in data) {
    return 1;
  }
  return 0;
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations keyed by the version they upgrade FROM.
 * Adding v3 = one new function here and bump PREFS_VERSION.
 */
export const PREFS_MIGRATIONS: Record<number, Migration> = {
  // org-only → add theme defaults
  0: (data) => ({
    ...data,
    theme: data.theme ?? { ...DEFAULT_THEME },
  }),
  // themed intermediate → ensure preview color axes exist
  1: (data) => ({
    ...data,
    previewColor: "previewColor" in data ? data.previewColor : null,
    previewBgColor: "previewBgColor" in data ? data.previewBgColor : null,
  }),
};

/** Clamp / validate a post-migration object into LibraryPreferences. */
export function validatePreferences(data: Record<string, unknown>): LibraryPreferences {
  return {
    favorites: isStringArray(data.favorites) ? data.favorites : [],
    customCategories: isStringArray(data.customCategories)
      ? data.customCategories
      : [],
    categoryOverrides: isStringRecord(data.categoryOverrides)
      ? data.categoryOverrides
      : {},
    theme: parseTheme(data.theme),
    previewColor: parsePreviewColor(data.previewColor),
    previewBgColor: parsePreviewColor(data.previewBgColor),
  };
}

/**
 * Run the version migration chain, then validate.
 * Accepts raw JSON objects from localStorage, import files, or remote APIs.
 */
export function migratePreferences(raw: unknown): LibraryPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyPrefs();
  }

  let data = { ...(raw as Record<string, unknown>) };
  let version = inferLegacyVersion(data);

  while (version < PREFS_VERSION) {
    const step = PREFS_MIGRATIONS[version];
    if (!step) break;
    data = step(data);
    version += 1;
  }

  return validatePreferences(data);
}

export function serializePreferences(prefs: LibraryPreferences): PersistedPreferences {
  const validated = validatePreferences(prefs as unknown as Record<string, unknown>);
  return {
    version: PREFS_VERSION,
    ...validated,
  };
}
