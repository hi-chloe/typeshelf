import { LocalPreferencesStore } from "./LocalPreferencesStore";
import { MemoryPreferencesStore } from "./MemoryPreferencesStore";
import type { PreferencesStore } from "./PreferencesStore";

/**
 * Env flag for a future remote backend. When unset / empty, always use local.
 * RemotePreferencesStore is NOT selected yet — see docs/PERSISTENCE.md.
 */
export function isRemotePreferencesConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_TYPESHELF_PREFS_URL;
  return typeof url === "string" && url.trim().length > 0;
}

/**
 * Default store for the app. Self-hosters with no env vars get localStorage
 * (or memory during SSR). Remote is documented but not implemented.
 */
export function createPreferencesStore(): PreferencesStore {
  if (typeof window === "undefined") {
    return new MemoryPreferencesStore();
  }
  // When a real RemotePreferencesStore exists, gate it on
  // isRemotePreferencesConfigured() and fall back to Local on failure.
  return new LocalPreferencesStore();
}
