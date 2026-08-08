/**
 * Theme axes: color scheme × mode.
 * Tokens live in app/globals.css; this module owns types, resolution, and DOM attrs.
 */

export const COLOR_SCHEMES = [
  "ember",
  "azure",
  "verdant",
  "amethyst",
  "garnet",
  "spectrum",
] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];

export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** Resolved paint mode (never "system"). */
export type ResolvedThemeMode = "light" | "dark";

export type ThemePreferences = {
  scheme: ColorScheme;
  mode: ThemeMode;
};

export const DEFAULT_THEME: ThemePreferences = {
  scheme: "ember",
  mode: "system",
};

export const SCHEME_LABELS: Record<ColorScheme, string> = {
  ember: "Ember",
  azure: "Azure",
  verdant: "Verdant",
  amethyst: "Amethyst",
  garnet: "Garnet",
  spectrum: "Spectrum",
};

/** Fixed swatch face colors (preview of each scheme's accent, independent of active tokens). */
export const SCHEME_SWATCH: Record<ColorScheme, string> = {
  ember: "#d9614f",
  azure: "#3d7ecf",
  verdant: "#3d8f5c",
  amethyst: "#8b5bb5",
  garnet: "#c44545",
  spectrum:
    "conic-gradient(from 210deg, #d95a7a, #5b3d9c, #2a9d8f, #d4a017, #d95a7a)",
};

export function isColorScheme(value: unknown): value is ColorScheme {
  return (
    typeof value === "string" &&
    (COLOR_SCHEMES as readonly string[]).includes(value)
  );
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return (
    typeof value === "string" &&
    (THEME_MODES as readonly string[]).includes(value)
  );
}

export function resolveThemeMode(
  mode: ThemeMode,
  prefersDark?: boolean,
): ResolvedThemeMode {
  if (mode === "light" || mode === "dark") return mode;
  const dark =
    prefersDark ??
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return dark ? "dark" : "light";
}

export function applyThemeToDocument(theme: ThemePreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-scheme", theme.scheme);
  root.setAttribute("data-mode", resolveThemeMode(theme.mode));
}

/**
 * Blocking inline boot script for app/layout.tsx <head>.
 * Must stay in sync with LIBRARY_PREFS_KEY / ThemePreferences shape.
 */
export function getThemeBootScript(storageKey: string): string {
  const schemes = JSON.stringify(COLOR_SCHEMES);
  const modes = JSON.stringify(THEME_MODES);
  return `(function(){try{var schemes=${schemes};var modes=${modes};var scheme="ember";var modePref="system";var raw=localStorage.getItem(${JSON.stringify(storageKey)});if(raw){var data=JSON.parse(raw);if(data&&data.theme){if(schemes.indexOf(data.theme.scheme)!==-1)scheme=data.theme.scheme;if(modes.indexOf(data.theme.mode)!==-1)modePref=data.theme.mode}}var mode=modePref==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):modePref;var root=document.documentElement;root.setAttribute("data-scheme",scheme);root.setAttribute("data-mode",mode)}catch(e){}})()`;
}
