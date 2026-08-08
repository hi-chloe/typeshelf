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

  async save(prefs: LibraryPreferences): Promise<void> {
    void prefs;
    throw new Error("RemotePreferencesStore is not configured");
  }

  subscribe(listener: (prefs: LibraryPreferences) => void): () => void {
    void listener;
    throw new Error("RemotePreferencesStore is not configured");
  }
}
