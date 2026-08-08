"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { classifyFont } from "./classifyFont";
import {
  createPreferencesStore,
  LocalPreferencesStore,
  type LibraryPreferences,
  type PreferencesStore,
} from "./libraryPersistence";
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  type ColorScheme,
  type ThemeMode,
  type ThemePreferences,
} from "./theme";
import type { BuiltinCategory, FontEntry, ParseWarning } from "./types";
import { BUILTIN_CATEGORIES, FAVORITES_SECTION } from "./types";

const DEFAULT_PREVIEW =
  "The quick brown fox jumps over the lazy dog.";

export type LibrarySectionId = typeof FAVORITES_SECTION | string;

type LibraryState = {
  fonts: FontEntry[];
  selectedFamily: string | null;
  selectedFontId: string | null;
  warnings: ParseWarning[];
  systemBannerDismissed: boolean;
  previewText: string;
  fontSize: number;
  letterSpacingPercent: number;
  isLoading: boolean;
  loadProgress: { done: number; total: number } | null;
  /** Family names marked as favorites. */
  favorites: string[];
  /** User-created category names (order preserved). */
  customCategories: string[];
  /**
   * Optional bucket override per family. When set, the family leaves its
   * auto-classified builtin bucket and appears only under this category
   * (plus Favorites if starred).
   */
  categoryOverrides: Record<string, string>;
  searchQuery: string;
  theme: ThemePreferences;
  /**
   * Preview specimen text color. `null` follows the theme `--ink` token so
   * theme switches recolor the specimen; a hex pins until reset.
   */
  previewColor: string | null;
  /**
   * Preview surface background. `null` follows `--preview-bg`; a hex pins
   * until reset.
   */
  previewBgColor: string | null;
};

type Action =
  | { type: "ADD_FONTS"; fonts: FontEntry[]; warnings: string[] }
  | { type: "SELECT_FAMILY"; family: string }
  | { type: "SELECT_VARIANT"; fontId: string }
  | { type: "DISMISS_BANNER" }
  | { type: "DISMISS_WARNING"; id: string }
  | { type: "CLEAR_WARNINGS" }
  | { type: "SET_PREVIEW_TEXT"; text: string }
  | { type: "SET_FONT_SIZE"; size: number }
  | { type: "SET_LETTER_SPACING"; percent: number }
  | { type: "SET_LOADING"; isLoading: boolean }
  | {
      type: "SET_LOAD_PROGRESS";
      progress: { done: number; total: number } | null;
    }
  | { type: "TOGGLE_FAVORITE"; family: string }
  | { type: "CREATE_CATEGORY"; name: string }
  | { type: "DELETE_CATEGORY"; name: string }
  | { type: "SET_FAMILY_CATEGORY"; family: string; category: string | null }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "SET_COLOR_SCHEME"; scheme: ColorScheme }
  | { type: "SET_THEME_MODE"; mode: ThemeMode }
  | { type: "SET_PREVIEW_COLOR"; color: string | null }
  | { type: "SET_PREVIEW_BG_COLOR"; color: string | null }
  | { type: "HYDRATE_PREFS"; prefs: LibraryPreferences };

/** Hard ranges for typed metrics (sliders use tighter UI ranges). */
export const FONT_SIZE_HARD_MIN = 4;
export const FONT_SIZE_HARD_MAX = 800;
export const FONT_SIZE_SLIDER_MIN = 12;
export const FONT_SIZE_SLIDER_MAX = 120;
export const LETTER_SPACING_HARD_MIN = -20;
export const LETTER_SPACING_HARD_MAX = 200;
export const LETTER_SPACING_SLIDER_MIN = -5;
export const LETTER_SPACING_SLIDER_MAX = 20;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function fontKey(family: string, style: string): string {
  return `${family.trim().toLowerCase()}::${style.trim().toLowerCase()}`;
}

export function pickDefaultVariant(variants: FontEntry[]): FontEntry {
  const regular = variants.find(
    (f) =>
      f.style.toLowerCase() === "regular" ||
      f.style.toLowerCase() === "normal" ||
      (f.weightClass === 400 && !/italic|oblique/i.test(f.style)),
  );
  if (regular) return regular;
  return [...variants].sort((a, b) => a.weightClass - b.weightClass)[0]!;
}

function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

const initialState: LibraryState = {
  fonts: [],
  selectedFamily: null,
  selectedFontId: null,
  warnings: [],
  systemBannerDismissed: false,
  previewText: DEFAULT_PREVIEW,
  fontSize: 48,
  letterSpacingPercent: 0,
  isLoading: false,
  loadProgress: null,
  favorites: [],
  customCategories: [],
  categoryOverrides: {},
  searchQuery: "",
  theme: { ...DEFAULT_THEME },
  previewColor: null,
  previewBgColor: null,
};

function reducer(state: LibraryState, action: Action): LibraryState {
  switch (action.type) {
    case "ADD_FONTS": {
      const existing = new Set(
        state.fonts.map((f) => fontKey(f.family, f.style)),
      );
      const nextFonts = [...state.fonts];
      const warnings: ParseWarning[] = [
        ...state.warnings,
        ...action.warnings.map((message) => ({
          id: crypto.randomUUID(),
          message,
        })),
      ];

      for (const font of action.fonts) {
        const key = fontKey(font.family, font.style);
        if (existing.has(key)) continue;
        existing.add(key);
        nextFonts.push(font);
      }

      let { selectedFamily, selectedFontId } = state;
      if (!selectedFamily && nextFonts.length > 0) {
        selectedFamily = nextFonts[0]!.family;
        const familyVariants = nextFonts.filter(
          (f) => f.family === selectedFamily,
        );
        selectedFontId = pickDefaultVariant(familyVariants).id;
      }

      return {
        ...state,
        fonts: nextFonts,
        selectedFamily,
        selectedFontId,
        warnings,
      };
    }
    case "SELECT_FAMILY": {
      const variants = state.fonts.filter((f) => f.family === action.family);
      if (variants.length === 0) return state;
      return {
        ...state,
        selectedFamily: action.family,
        selectedFontId: pickDefaultVariant(variants).id,
      };
    }
    case "SELECT_VARIANT": {
      const font = state.fonts.find((f) => f.id === action.fontId);
      if (!font) return state;
      return {
        ...state,
        selectedFamily: font.family,
        selectedFontId: font.id,
      };
    }
    case "DISMISS_BANNER":
      return { ...state, systemBannerDismissed: true };
    case "DISMISS_WARNING":
      return {
        ...state,
        warnings: state.warnings.filter((w) => w.id !== action.id),
      };
    case "CLEAR_WARNINGS":
      return { ...state, warnings: [] };
    case "SET_PREVIEW_TEXT":
      return { ...state, previewText: action.text };
    case "SET_FONT_SIZE":
      return {
        ...state,
        fontSize: clamp(action.size, FONT_SIZE_HARD_MIN, FONT_SIZE_HARD_MAX),
      };
    case "SET_LETTER_SPACING":
      return {
        ...state,
        letterSpacingPercent: clamp(
          action.percent,
          LETTER_SPACING_HARD_MIN,
          LETTER_SPACING_HARD_MAX,
        ),
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.isLoading,
        loadProgress: action.isLoading ? state.loadProgress : null,
      };
    case "SET_LOAD_PROGRESS":
      return { ...state, loadProgress: action.progress };
    case "TOGGLE_FAVORITE": {
      const family = action.family;
      const has = state.favorites.includes(family);
      return {
        ...state,
        favorites: has
          ? state.favorites.filter((f) => f !== family)
          : [...state.favorites, family],
      };
    }
    case "CREATE_CATEGORY": {
      const name = normalizeCategoryName(action.name);
      if (!name) return state;
      if (name.toLowerCase() === FAVORITES_SECTION.toLowerCase()) return state;
      const reserved = new Set(
        BUILTIN_CATEGORIES.map((c) => c.toLowerCase()),
      );
      if (reserved.has(name.toLowerCase())) return state;
      if (
        state.customCategories.some(
          (c) => c.toLowerCase() === name.toLowerCase(),
        )
      ) {
        return state;
      }
      return {
        ...state,
        customCategories: [...state.customCategories, name],
      };
    }
    case "DELETE_CATEGORY": {
      const name = action.name;
      const nextOverrides = { ...state.categoryOverrides };
      for (const [family, cat] of Object.entries(nextOverrides)) {
        if (cat === name) delete nextOverrides[family];
      }
      return {
        ...state,
        customCategories: state.customCategories.filter((c) => c !== name),
        categoryOverrides: nextOverrides,
      };
    }
    case "SET_FAMILY_CATEGORY": {
      const next = { ...state.categoryOverrides };
      if (!action.category) {
        delete next[action.family];
      } else {
        next[action.family] = action.category;
      }
      return { ...state, categoryOverrides: next };
    }
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };
    case "SET_COLOR_SCHEME":
      return {
        ...state,
        theme: { ...state.theme, scheme: action.scheme },
      };
    case "SET_THEME_MODE":
      return {
        ...state,
        theme: { ...state.theme, mode: action.mode },
      };
    case "SET_PREVIEW_COLOR":
      return { ...state, previewColor: action.color };
    case "SET_PREVIEW_BG_COLOR":
      return { ...state, previewBgColor: action.color };
    case "HYDRATE_PREFS":
      return {
        ...state,
        favorites: action.prefs.favorites,
        customCategories: action.prefs.customCategories,
        categoryOverrides: action.prefs.categoryOverrides,
        theme: action.prefs.theme,
        previewColor: action.prefs.previewColor,
        previewBgColor: action.prefs.previewBgColor,
      };
    default:
      return state;
  }
}

export type FamilyGroup = {
  family: string;
  /** Effective library section this group is listed under. */
  category: string;
  /** Auto-classification (ignores overrides). */
  autoCategory: BuiltinCategory;
  variants: FontEntry[];
  isFavorite: boolean;
};

export type LibrarySection = {
  id: LibrarySectionId;
  label: string;
  families: FamilyGroup[];
  kind: "favorites" | "custom" | "builtin";
};

type FontLibraryContextValue = {
  state: LibraryState;
  sections: LibrarySection[];
  /** Flat list of assignable category names (custom first, then builtin). */
  assignableCategories: string[];
  selectedFont: FontEntry | null;
  selectedVariants: FontEntry[];
  getAutoCategory: (family: string) => BuiltinCategory | null;
  addFonts: (fonts: FontEntry[], warnings?: string[]) => void;
  selectFamily: (family: string) => void;
  selectVariant: (fontId: string) => void;
  dismissBanner: () => void;
  dismissWarning: (id: string) => void;
  clearWarnings: () => void;
  setPreviewText: (text: string) => void;
  setFontSize: (size: number) => void;
  setLetterSpacing: (percent: number) => void;
  setLoading: (isLoading: boolean) => void;
  setLoadProgress: (progress: { done: number; total: number } | null) => void;
  toggleFavorite: (family: string) => void;
  createCategory: (name: string) => boolean;
  deleteCategory: (name: string) => void;
  setFamilyCategory: (family: string, category: string | null) => void;
  setSearchQuery: (query: string) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPreviewColor: (color: string | null) => void;
  setPreviewBgColor: (color: string | null) => void;
  /** Snapshot of persistable prefs (export). Never includes font bytes. */
  getPreferencesSnapshot: () => LibraryPreferences;
  /** Replace prefs after a validated import (writes through the store). */
  replacePreferences: (prefs: LibraryPreferences) => Promise<void>;
};

const FontLibraryContext = createContext<FontLibraryContextValue | null>(null);

function matchesSearch(
  family: string,
  categoryLabel: string,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    family.toLowerCase().includes(q) || categoryLabel.toLowerCase().includes(q)
  );
}

function prefsFromState(state: LibraryState): LibraryPreferences {
  return {
    favorites: state.favorites,
    customCategories: state.customCategories,
    categoryOverrides: state.categoryOverrides,
    theme: state.theme,
    previewColor: state.previewColor,
    previewBgColor: state.previewBgColor,
  };
}

export function FontLibraryProvider({
  children,
  store: storeProp,
}: {
  children: ReactNode;
  /** Injected store for tests; defaults to createPreferencesStore(). */
  store?: PreferencesStore;
}) {
  const [store] = useState(() => storeProp ?? createPreferencesStore());

  const [state, dispatch] = useReducer(reducer, initialState);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  /*
   * Optimistic prefs hydrate in useLayoutEffect so LocalPreferencesStore
   * (Promise.resolve(sync)) settles before paint — no empty→filled flash.
   * Context talks only to PreferencesStore, never localStorage directly.
   */
  useLayoutEffect(() => {
    let cancelled = false;

    const apply = (prefs: LibraryPreferences) => {
      if (cancelled) return;
      dispatch({ type: "HYDRATE_PREFS", prefs });
      applyThemeToDocument(prefs.theme);
      setPrefsHydrated(true);
    };

    if (store instanceof LocalPreferencesStore) {
      apply(store.loadSync());
      return () => {
        cancelled = true;
      };
    }

    void store.load().then(apply);
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    if (!store.subscribe) return;
    return store.subscribe((prefs) => {
      dispatch({ type: "HYDRATE_PREFS", prefs });
      applyThemeToDocument(prefs.theme);
    });
  }, [store]);

  useEffect(() => {
    if (!prefsHydrated) return;
    void store.save(prefsFromState(state));
    // Deliberately omit full `state` — fonts/search/warnings must not write prefs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefs slice only
  }, [
    prefsHydrated,
    store,
    state.favorites,
    state.customCategories,
    state.categoryOverrides,
    state.theme,
    state.previewColor,
    state.previewBgColor,
  ]);

  // Keep <html> data-* in sync after hydration (and Strict Mode remounts).
  useLayoutEffect(() => {
    if (!prefsHydrated) return;
    applyThemeToDocument(state.theme);
  }, [prefsHydrated, state.theme]);

  // Live-update when OS prefers-color-scheme changes and mode is "system".
  useEffect(() => {
    if (!prefsHydrated || state.theme.mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeToDocument(state.theme);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefsHydrated, state.theme]);

  const familiesByName = useMemo(() => {
    const byFamily = new Map<string, FontEntry[]>();
    for (const font of state.fonts) {
      const list = byFamily.get(font.family) ?? [];
      list.push(font);
      byFamily.set(font.family, list);
    }
    for (const [family, variants] of byFamily) {
      byFamily.set(
        family,
        [...variants].sort((a, b) => {
          if (a.weightClass !== b.weightClass) {
            return a.weightClass - b.weightClass;
          }
          return a.style.localeCompare(b.style);
        }),
      );
    }
    return byFamily;
  }, [state.fonts]);

  const getAutoCategory = useCallback(
    (family: string): BuiltinCategory | null => {
      const variants = familiesByName.get(family);
      if (!variants || variants.length === 0) return null;
      return classifyFont(pickDefaultVariant(variants));
    },
    [familiesByName],
  );

  const sections = useMemo(() => {
    const favoriteSet = new Set(state.favorites);
    const result: LibrarySection[] = [];

    const makeGroup = (
      family: string,
      category: string,
      autoCategory: BuiltinCategory,
    ): FamilyGroup => ({
      family,
      category,
      autoCategory,
      variants: familiesByName.get(family) ?? [],
      isFavorite: favoriteSet.has(family),
    });

    // Favorites first
    const favoriteFamilies = state.favorites
      .filter((family) => familiesByName.has(family))
      .filter((family) =>
        matchesSearch(family, FAVORITES_SECTION, state.searchQuery),
      )
      .sort((a, b) => a.localeCompare(b))
      .map((family) => {
        const auto = getAutoCategory(family) ?? "Other";
        return makeGroup(family, FAVORITES_SECTION, auto);
      });

    result.push({
      id: FAVORITES_SECTION,
      label: FAVORITES_SECTION,
      families: favoriteFamilies,
      kind: "favorites",
    });

    for (const custom of state.customCategories) {
      const families = [...familiesByName.keys()]
        .filter((family) => state.categoryOverrides[family] === custom)
        .filter((family) => matchesSearch(family, custom, state.searchQuery))
        .sort((a, b) => a.localeCompare(b))
        .map((family) => {
          const auto = getAutoCategory(family) ?? "Other";
          return makeGroup(family, custom, auto);
        });

      result.push({
        id: custom,
        label: custom,
        families,
        kind: "custom",
      });
    }

    for (const builtin of BUILTIN_CATEGORIES) {
      const families = [...familiesByName.keys()]
        .filter((family) => {
          const override = state.categoryOverrides[family];
          if (override) return override === builtin;
          return getAutoCategory(family) === builtin;
        })
        .filter((family) => matchesSearch(family, builtin, state.searchQuery))
        .sort((a, b) => a.localeCompare(b))
        .map((family) => {
          const auto = getAutoCategory(family) ?? "Other";
          return makeGroup(family, builtin, auto);
        });

      result.push({
        id: builtin,
        label: builtin,
        families,
        kind: "builtin",
      });
    }

    return result;
  }, [
    familiesByName,
    getAutoCategory,
    state.categoryOverrides,
    state.customCategories,
    state.favorites,
    state.searchQuery,
  ]);

  const assignableCategories = useMemo(
    () => [...state.customCategories, ...BUILTIN_CATEGORIES],
    [state.customCategories],
  );

  const selectedFont = useMemo(
    () => state.fonts.find((f) => f.id === state.selectedFontId) ?? null,
    [state.fonts, state.selectedFontId],
  );

  const selectedVariants = useMemo(() => {
    if (!state.selectedFamily) return [];
    return familiesByName.get(state.selectedFamily) ?? [];
  }, [familiesByName, state.selectedFamily]);

  const addFonts = useCallback((fonts: FontEntry[], warnings: string[] = []) => {
    dispatch({ type: "ADD_FONTS", fonts, warnings });
  }, []);

  const selectFamily = useCallback((family: string) => {
    dispatch({ type: "SELECT_FAMILY", family });
  }, []);

  const selectVariant = useCallback((fontId: string) => {
    dispatch({ type: "SELECT_VARIANT", fontId });
  }, []);

  const dismissBanner = useCallback(() => {
    dispatch({ type: "DISMISS_BANNER" });
  }, []);

  const dismissWarning = useCallback((id: string) => {
    dispatch({ type: "DISMISS_WARNING", id });
  }, []);

  const clearWarnings = useCallback(() => {
    dispatch({ type: "CLEAR_WARNINGS" });
  }, []);

  const setPreviewText = useCallback((text: string) => {
    dispatch({ type: "SET_PREVIEW_TEXT", text });
  }, []);

  const setFontSize = useCallback((size: number) => {
    dispatch({ type: "SET_FONT_SIZE", size });
  }, []);

  const setLetterSpacing = useCallback((percent: number) => {
    dispatch({ type: "SET_LETTER_SPACING", percent });
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    dispatch({ type: "SET_LOADING", isLoading });
  }, []);

  const setLoadProgress = useCallback(
    (progress: { done: number; total: number } | null) => {
      dispatch({ type: "SET_LOAD_PROGRESS", progress });
    },
    [],
  );

  const toggleFavorite = useCallback((family: string) => {
    dispatch({ type: "TOGGLE_FAVORITE", family });
  }, []);

  const createCategory = useCallback((name: string) => {
    const normalized = normalizeCategoryName(name);
    if (!normalized) return false;
    if (normalized.toLowerCase() === FAVORITES_SECTION.toLowerCase()) {
      return false;
    }
    if (
      BUILTIN_CATEGORIES.some(
        (c) => c.toLowerCase() === normalized.toLowerCase(),
      )
    ) {
      return false;
    }
    dispatch({ type: "CREATE_CATEGORY", name: normalized });
    return true;
  }, []);

  const deleteCategory = useCallback((name: string) => {
    dispatch({ type: "DELETE_CATEGORY", name });
  }, []);

  const setFamilyCategory = useCallback(
    (family: string, category: string | null) => {
      dispatch({ type: "SET_FAMILY_CATEGORY", family, category });
    },
    [],
  );

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: "SET_SEARCH_QUERY", query });
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    dispatch({ type: "SET_COLOR_SCHEME", scheme });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    dispatch({ type: "SET_THEME_MODE", mode });
  }, []);

  const setPreviewColor = useCallback((color: string | null) => {
    dispatch({ type: "SET_PREVIEW_COLOR", color });
  }, []);

  const setPreviewBgColor = useCallback((color: string | null) => {
    dispatch({ type: "SET_PREVIEW_BG_COLOR", color });
  }, []);

  const getPreferencesSnapshot = useCallback(
    () => prefsFromState(state),
    [state],
  );

  const replacePreferences = useCallback(
    async (prefs: LibraryPreferences) => {
      dispatch({ type: "HYDRATE_PREFS", prefs });
      applyThemeToDocument(prefs.theme);
      await store.save(prefs);
    },
    [store],
  );

  const value = useMemo(
    () => ({
      state,
      sections,
      assignableCategories,
      selectedFont,
      selectedVariants,
      getAutoCategory,
      addFonts,
      selectFamily,
      selectVariant,
      dismissBanner,
      dismissWarning,
      clearWarnings,
      setPreviewText,
      setFontSize,
      setLetterSpacing,
      setLoading,
      setLoadProgress,
      toggleFavorite,
      createCategory,
      deleteCategory,
      setFamilyCategory,
      setSearchQuery,
      setColorScheme,
      setThemeMode,
      setPreviewColor,
      setPreviewBgColor,
      getPreferencesSnapshot,
      replacePreferences,
    }),
    [
      state,
      sections,
      assignableCategories,
      selectedFont,
      selectedVariants,
      getAutoCategory,
      addFonts,
      selectFamily,
      selectVariant,
      dismissBanner,
      dismissWarning,
      clearWarnings,
      setPreviewText,
      setFontSize,
      setLetterSpacing,
      setLoading,
      setLoadProgress,
      toggleFavorite,
      createCategory,
      deleteCategory,
      setFamilyCategory,
      setSearchQuery,
      setColorScheme,
      setThemeMode,
      setPreviewColor,
      setPreviewBgColor,
      getPreferencesSnapshot,
      replacePreferences,
    ],
  );

  return (
    <FontLibraryContext.Provider value={value}>
      {children}
    </FontLibraryContext.Provider>
  );
}

export function useFontLibrary(): FontLibraryContextValue {
  const ctx = useContext(FontLibraryContext);
  if (!ctx) {
    throw new Error("useFontLibrary must be used within FontLibraryProvider");
  }
  return ctx;
}
