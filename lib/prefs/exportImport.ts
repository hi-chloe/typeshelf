import { migratePreferences, serializePreferences } from "./migrate";
import type { LibraryPreferences } from "./types";

export type PreferencesExportPayload = ReturnType<typeof serializePreferences> & {
  exportedAt: string;
  app: "typeshelf";
};

/** Build a portable JSON document — never includes font bytes or system font lists. */
export function buildPreferencesExport(
  prefs: LibraryPreferences,
): PreferencesExportPayload {
  return {
    ...serializePreferences(prefs),
    exportedAt: new Date().toISOString(),
    app: "typeshelf",
  };
}

export function stringifyPreferencesExport(prefs: LibraryPreferences): string {
  return `${JSON.stringify(buildPreferencesExport(prefs), null, 2)}\n`;
}

/**
 * Parse an import file through the same migration + validation chain as
 * localStorage / remote loads.
 */
export function parsePreferencesImport(raw: string): LibraryPreferences {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Import file is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Import file must be a JSON object.");
  }

  const data = parsed as Record<string, unknown>;
  if ("app" in data && data.app !== "typeshelf") {
    throw new Error('Import file is not a Typeshelf settings export (expected app: "typeshelf").');
  }

  return migratePreferences(parsed);
}
