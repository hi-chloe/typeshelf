import {
  LEGACY_PREFS_KEYS,
  PREFS_STORAGE_KEY,
  emptyPrefs,
  toPersisted,
  type LibraryPreferences,
} from "./types";
import { migratePreferences } from "./migrate";
import type { PreferencesStore } from "./PreferencesStore";

function isBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

/**
 * Default production store. Behavior matches the historical sync helpers:
 * silent no-op when localStorage is unavailable or throws (private / quota).
 */
export class LocalPreferencesStore implements PreferencesStore {
  readonly storageKey: string;

  constructor(storageKey: string = PREFS_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  /** Synchronous read for FOUC / useLayoutEffect bootstrap — no flash. */
  loadSync(): LibraryPreferences {
    if (!isBrowserStorage()) return emptyPrefs();

    try {
      const current = readRaw(this.storageKey);
      if (current) return migratePreferences(current);

      for (const legacyKey of LEGACY_PREFS_KEYS) {
        const legacy = readRaw(legacyKey);
        if (!legacy) continue;
        const migrated = migratePreferences(legacy);
        // Write forward; leave legacy keys in place for one release.
        this.writeSilent(migrated);
        return migrated;
      }

      return emptyPrefs();
    } catch {
      return emptyPrefs();
    }
  }

  async load(): Promise<LibraryPreferences> {
    return this.loadSync();
  }

  async save(prefs: LibraryPreferences): Promise<void> {
    this.writeSilent(prefs);
  }

  subscribe(listener: (prefs: LibraryPreferences) => void): () => void {
    if (!isBrowserStorage()) return () => {};

    const onStorage = (event: StorageEvent) => {
      if (event.key !== this.storageKey || event.newValue == null) return;
      try {
        const parsed = JSON.parse(event.newValue) as unknown;
        listener(migratePreferences(parsed));
      } catch {
        // Ignore malformed cross-tab payloads.
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }

  private writeSilent(prefs: LibraryPreferences): void {
    if (!isBrowserStorage()) return;
    try {
      window.localStorage.setItem(
        this.storageKey,
        JSON.stringify(toPersisted(prefs)),
      );
    } catch {
      // Private browsing / quota / disabled storage — keep in-memory only.
    }
  }
}
