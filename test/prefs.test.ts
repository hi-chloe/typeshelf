import { describe, expect, it } from "vitest";
import {
  MemoryPreferencesStore,
  migratePreferences,
  parsePreferencesImport,
  PREFS_VERSION,
  stringifyPreferencesExport,
  validatePreferences,
} from "../lib/prefs";

describe("migratePreferences", () => {
  it("upgrades org-only legacy payloads to the current shape", () => {
    const prefs = migratePreferences({
      favorites: ["Inter"],
      customCategories: ["Poster"],
      categoryOverrides: { Inter: "Sans-serif" },
    });

    expect(prefs.favorites).toEqual(["Inter"]);
    expect(prefs.customCategories).toEqual(["Poster"]);
    expect(prefs.categoryOverrides).toEqual({ Inter: "Sans-serif" });
    expect(prefs.theme.scheme).toBe("ember");
    expect(prefs.theme.mode).toBe("light");
    expect(prefs.previewColor).toBeNull();
    expect(prefs.previewBgColor).toBeNull();
  });

  it("keeps themed intermediate fields and fills missing preview colors", () => {
    const prefs = migratePreferences({
      favorites: [],
      customCategories: [],
      categoryOverrides: {},
      theme: { scheme: "azure", mode: "dark" },
    });

    expect(prefs.theme).toEqual({
      scheme: "azure",
      mode: "dark",
      customSeed: "#4f7fd4",
    });
    expect(prefs.previewColor).toBeNull();
    expect(prefs.previewBgColor).toBeNull();
  });

  it("rejects invalid theme / color values during validation", () => {
    const prefs = validatePreferences({
      favorites: "nope",
      theme: { scheme: "not-real", mode: "dark" },
      previewColor: "red",
      previewBgColor: "#abc",
    });

    expect(prefs.favorites).toEqual([]);
    expect(prefs.theme.scheme).toBe("ember");
    expect(prefs.theme.mode).toBe("dark");
    expect(prefs.theme.customSeed).toBe("#4f7fd4");
    expect(prefs.previewColor).toBeNull();
    expect(prefs.previewBgColor).toBeNull();
  });
});

describe("export / import", () => {
  it("round-trips through JSON with version and app markers", () => {
    const json = stringifyPreferencesExport({
      favorites: ["Recoleta"],
      customCategories: [],
      categoryOverrides: {},
      theme: { scheme: "verdant", mode: "light", customSeed: "#4f7fd4" },
      previewColor: "#112233",
      previewBgColor: null,
    });

    const parsed = JSON.parse(json) as { version: number; app: string };
    expect(parsed.version).toBe(PREFS_VERSION);
    expect(parsed.app).toBe("typeshelf");

    const prefs = parsePreferencesImport(json);
    expect(prefs.favorites).toEqual(["Recoleta"]);
    expect(prefs.theme.scheme).toBe("verdant");
    expect(prefs.previewColor).toBe("#112233");
  });

  it("rejects non-typeshelf app tags", () => {
    expect(() =>
      parsePreferencesImport(
        JSON.stringify({
          app: "other",
          version: 2,
          favorites: [],
          customCategories: [],
          categoryOverrides: {},
          theme: { scheme: "ember", mode: "system" },
          previewColor: null,
          previewBgColor: null,
        }),
      ),
    ).toThrow(/Typeshelf/);
  });
});

describe("MemoryPreferencesStore", () => {
  it("loads and saves without touching localStorage", async () => {
    const store = new MemoryPreferencesStore();
    await store.save({
      favorites: ["A"],
      customCategories: [],
      categoryOverrides: {},
      theme: { scheme: "garnet", mode: "system", customSeed: "#4f7fd4" },
      previewColor: null,
      previewBgColor: null,
    });
    const loaded = await store.load();
    expect(loaded.favorites).toEqual(["A"]);
    expect(loaded.theme.scheme).toBe("garnet");
  });
});
