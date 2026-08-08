/**
 * Preferences persistence public surface.
 * Implementation lives in `lib/prefs/` behind PreferencesStore.
 */

export type {
  LibraryPreferences,
  PersistedPreferences,
  PreferencesStore,
  PreferencesExportPayload,
} from "./prefs";

export {
  EMPTY_PREFS,
  LEGACY_PREFS_KEYS,
  PREFS_STORAGE_KEY,
  PREFS_VERSION,
  LocalPreferencesStore,
  MemoryPreferencesStore,
  RemotePreferencesStore,
  createPreferencesStore,
  isRemotePreferencesConfigured,
  migratePreferences,
  parsePreferencesImport,
  stringifyPreferencesExport,
  emptyPrefs,
} from "./prefs";

/** @deprecated Prefer PREFS_STORAGE_KEY */
export { PREFS_STORAGE_KEY as LIBRARY_PREFS_KEY } from "./prefs";

import { LocalPreferencesStore } from "./prefs";

const defaultLocal = new LocalPreferencesStore();

/** @deprecated Prefer PreferencesStore.load() — sync bootstrap helper for FOUC. */
export function loadLibraryPreferences() {
  return defaultLocal.loadSync();
}

/** @deprecated Prefer PreferencesStore.save() */
export function saveLibraryPreferences(
  prefs: import("./prefs").LibraryPreferences,
): void {
  void defaultLocal.save(prefs);
}
