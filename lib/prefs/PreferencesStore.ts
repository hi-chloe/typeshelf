import type { LibraryPreferences } from "./types";

/**
 * Pluggable preferences backend. Implementations must not throw on routine
 * failure modes when a local fallback is expected — LocalPreferencesStore
 * swallows quota/private-mode errors like the prior sync helpers.
 */
export interface PreferencesStore {
  load(): Promise<LibraryPreferences>;
  save(prefs: LibraryPreferences): Promise<void>;
  /**
   * Optional live updates (BroadcastChannel / storage events / remote push).
   * Returns an unsubscribe function.
   */
  subscribe?(listener: (prefs: LibraryPreferences) => void): () => void;
}
