/**
 * Theme axes: color scheme × mode.
 * Token values live in app/globals.css (presets) and lib/customTheme.ts (custom).
 * This module owns types, resolution, and DOM attributes.
 */

import { applyCustomTheme, buildCustomTheme } from "./customTheme";

export const COLOR_SCHEMES = [
  "ember",
  "azure",
  "verdant",
  "amethyst",
  "garnet",
  "custom",
] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];

/** Schemes with a hand-generated block in globals.css. "custom" is derived at runtime. */
export type PresetScheme = Exclude<ColorScheme, "custom">;

export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** Resolved paint mode (never "system"). */
export type ResolvedThemeMode = "light" | "dark";

export type ThemePreferences = {
  scheme: ColorScheme;
  mode: ThemeMode;
  /** Seed color for the "custom" scheme. Only its hue is used. */
  customSeed: string;
};

export const DEFAULT_CUSTOM_SEED = "#4f7fd4";

export const DEFAULT_THEME: ThemePreferences = {
  scheme: "ember",
  mode: "light",
  customSeed: DEFAULT_CUSTOM_SEED,
};

export const SCHEME_LABELS: Record<ColorScheme, string> = {
  ember: "Ember",
  azure: "Azure",
  verdant: "Verdant",
  amethyst: "Amethyst",
  garnet: "Garnet",
  custom: "Custom",
};

/**
 * Swatch faces for the preset schemes — fixed previews of each accent, held
 * independent of the active tokens so the picker doesn't recolor itself as you
 * move through it. "custom" has no entry; its swatch renders the user's seed.
 */
export const SCHEME_SWATCH: Record<PresetScheme, string> = {
  ember: "#d9775f",
  azure: "#4f8fd6",
  verdant: "#3f9c68",
  amethyst: "#9a6bc4",
  garnet: "#d05f5f",
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

export function isHexSeed(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
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
  const resolved = resolveThemeMode(theme.mode);

  root.setAttribute("data-scheme", theme.scheme);
  root.setAttribute("data-mode", resolved);

  // Presets are pure CSS; custom needs its tokens computed and set inline.
  // Always clear on a preset so a stale custom block can't leak through.
  applyCustomTheme(theme.scheme === "custom" ? theme.customSeed : null, resolved);
}

/**
 * Precomputed custom palettes, cached in storage so the pre-paint boot script
 * can apply them without shipping the solver inline.
 *
 * The solver is ~100 lines of binary search; inlining it in a blocking <script>
 * would cost more than it saves, and recomputing after hydration would flash the
 * fallback grey first. Caching both modes keeps the boot path a plain object read.
 */
export type CustomThemeCache = {
  seed: string;
  light: Record<string, string>;
  dark: Record<string, string>;
};

export function buildCustomThemeCache(seed: string): CustomThemeCache {
  return {
    seed,
    light: buildCustomTheme(seed, "light"),
    dark: buildCustomTheme(seed, "dark"),
  };
}

/**
 * Blocking inline boot script for app/layout.tsx <head>.
 * Tries the canonical Typeshelf key first, then legacy keys (migration leaves
 * those in place for one release).
 */
export function getThemeBootScript(storageKeys: readonly string[]): string {
  const schemes = JSON.stringify(COLOR_SCHEMES);
  const modes = JSON.stringify(THEME_MODES);
  const keys = JSON.stringify(storageKeys);

  return `(function(){try{
var schemes=${schemes},modes=${modes},keys=${keys};
var scheme="ember",modePref="light",cache=null;
for(var i=0;i<keys.length;i++){
  var raw=localStorage.getItem(keys[i]);
  if(!raw)continue;
  try{
    var data=JSON.parse(raw);
    if(data&&data.theme){
      if(schemes.indexOf(data.theme.scheme)!==-1)scheme=data.theme.scheme;
      if(modes.indexOf(data.theme.mode)!==-1)modePref=data.theme.mode;
      if(data.customThemeCache)cache=data.customThemeCache;
      break;
    }
  }catch(_e){}
}
var mode=modePref==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):modePref;
var root=document.documentElement;
root.setAttribute("data-scheme",scheme);
root.setAttribute("data-mode",mode);
if(scheme==="custom"&&cache&&cache[mode]){
  var tokens=cache[mode];
  for(var k in tokens){if(Object.prototype.hasOwnProperty.call(tokens,k))root.style.setProperty(k,tokens[k]);}
}
}catch(e){}})()`;
}
