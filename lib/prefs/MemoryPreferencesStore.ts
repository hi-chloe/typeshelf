import { emptyPrefs, type LibraryPreferences } from "./types";
import { migratePreferences, validatePreferences } from "./migrate";
import type { PreferencesStore } from "./PreferencesStore";

/** In-memory store for unit tests and SSR. */
export class MemoryPreferencesStore implements PreferencesStore {
  private prefs: LibraryPreferences;
  private listeners = new Set<(prefs: LibraryPreferences) => void>();

  constructor(initial?: LibraryPreferences) {
    this.prefs = initial
      ? validatePreferences(initial as unknown as Record<string, unknown>)
      : emptyPrefs();
  }

  async load(): Promise<LibraryPreferences> {
    return {
      ...this.prefs,
      theme: { ...this.prefs.theme },
      categoryOverrides: { ...this.prefs.categoryOverrides },
      favorites: [...this.prefs.favorites],
      customCategories: [...this.prefs.customCategories],
    };
  }

  async save(prefs: LibraryPreferences): Promise<void> {
    this.prefs = migratePreferences(prefs);
    for (const listener of this.listeners) {
      listener(await this.load());
    }
  }

  subscribe(listener: (prefs: LibraryPreferences) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
