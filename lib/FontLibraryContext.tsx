"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { classifyFont } from "./classifyFont";
import {
  loadLibraryPreferences,
  saveLibraryPreferences,
  type LibraryPreferences,
} from "./libraryPersistence";
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
  | { type: "HYDRATE_PREFS"; prefs: LibraryPreferences };

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
      return { ...state, fontSize: action.size };
    case "SET_LETTER_SPACING":
      return { ...state, letterSpacingPercent: action.percent };
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
    case "HYDRATE_PREFS":
      return {
        ...state,
        favorites: action.prefs.favorites,
        customCategories: action.prefs.customCategories,
        categoryOverrides: action.prefs.categoryOverrides,
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

export function FontLibraryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  // Hydrate after mount so SSR HTML matches the first client paint.
  useEffect(() => {
    dispatch({ type: "HYDRATE_PREFS", prefs: loadLibraryPreferences() });
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveLibraryPreferences({
      favorites: state.favorites,
      customCategories: state.customCategories,
      categoryOverrides: state.categoryOverrides,
    });
  }, [
    prefsHydrated,
    state.favorites,
    state.customCategories,
    state.categoryOverrides,
  ]);

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
