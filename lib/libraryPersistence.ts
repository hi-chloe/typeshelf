/**
 * Persist library organization prefs (not the font files themselves).
 * Safe for Next.js App Router — never touches localStorage on the server.
 */

export const LIBRARY_PREFS_KEY = "font-explorer:library-prefs:v1";

export type LibraryPreferences = {
  favorites: string[];
  customCategories: string[];
  categoryOverrides: Record<string, string>;
};

const EMPTY_PREFS: LibraryPreferences = {
  favorites: [],
  customCategories: [],
  categoryOverrides: {},
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

export function loadLibraryPreferences(): LibraryPreferences {
  if (!isBrowser()) return { ...EMPTY_PREFS, categoryOverrides: {} };

  try {
    const raw = window.localStorage.getItem(LIBRARY_PREFS_KEY);
    if (!raw) return { ...EMPTY_PREFS, categoryOverrides: {} };

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { ...EMPTY_PREFS, categoryOverrides: {} };
    }

    const data = parsed as Partial<LibraryPreferences>;
    return {
      favorites: isStringArray(data.favorites) ? data.favorites : [],
      customCategories: isStringArray(data.customCategories)
        ? data.customCategories
        : [],
      categoryOverrides: isStringRecord(data.categoryOverrides)
        ? data.categoryOverrides
        : {},
    };
  } catch {
    return { ...EMPTY_PREFS, categoryOverrides: {} };
  }
}

export function saveLibraryPreferences(prefs: LibraryPreferences): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(
      LIBRARY_PREFS_KEY,
      JSON.stringify({
        favorites: prefs.favorites,
        customCategories: prefs.customCategories,
        categoryOverrides: prefs.categoryOverrides,
      }),
    );
  } catch {
    // Private browsing / quota / disabled storage — keep in-memory only.
  }
}
