import type { LibraryPreferences } from "./types";
import type { PreferencesStore } from "./PreferencesStore";

/**
 * Stub for a future networked backend. Not wired into createPreferencesStore.
 * See docs/PERSISTENCE.md for how to implement and env-gate a real remote.
 */
export class RemotePreferencesStore implements PreferencesStore {
  async load(): Promise<LibraryPreferences> {
    throw new Error("RemotePreferencesStore is not configured");
  }

  async save(_prefs: LibraryPreferences): Promise<void> {
    throw new Error("RemotePreferencesStore is not configured");
  }

  subscribe(_listener: (prefs: LibraryPreferences) => void): () => void {
    throw new Error("RemotePreferencesStore is not configured");
  }
}
