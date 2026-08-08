/**
 * Runtime palette generation for the user-picked "custom" scheme.
 *
 * This is the TypeScript twin of the Python solver that generated the preset
 * blocks in app/globals.css. Keep the two in sync — if a threshold changes here
 * it must change there, or presets and custom themes stop agreeing about what
 * "AA" means.
 *
 * WHY A SOLVER AND NOT A FIXED RAMP
 * Fixed HSL lightness does not produce constant contrast across hues. Green
 * carries roughly 3.4x the luminance of blue at identical L (0.7152 vs 0.2126
 * in the relative-luminance formula), so a ramp tuned against a blue accent
 * silently fails when the user picks green. Every accent value below is found by
 * binary-searching lightness until it meets a measured contrast target, which
 * means an arbitrary user-picked hue cannot generate an inaccessible theme.
 *
 * The user's HUE is honoured exactly. Saturation and lightness are ours.
 */

export type ThemeTokens = Record<string, string>;

/* ---------------------------------------------------------------- color math */

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360 / 360;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hueToRgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, hue + 1 / 3);
    g = hueToRgb(p, q, hue);
    b = hueToRgb(p, q, hue - 1 / 3);
  }

  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToHue(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = Number.parseInt(m[1]!, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0; // achromatic — treat as red, saturation is ours anyway

  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;

  return (((h * 60) % 360) + 360) % 360;
}

function relativeLuminance(hex: string): number {
  const int = Number.parseInt(hex.slice(1), 16);
  const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
  );
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi! + 0.05) / (lo! + 0.05);
}

/* ------------------------------------------------------------------- solver */

type Test = [against: string, minRatio: number];

/**
 * Binary-search lightness until every test passes.
 * `prefer: "high"` keeps the lightest passing value, `"low"` the darkest.
 * Returns the midpoint if nothing passes, which cannot happen for the ranges
 * used below but keeps the return type honest.
 */
function solveLightness(
  hue: number,
  sat: number,
  tests: Test[],
  lo: number,
  hi: number,
  prefer: "high" | "low",
): number {
  let low = lo;
  let high = hi;
  let best: number | null = null;

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const candidate = hslToHex(hue, sat, mid);
    const ok = tests.every(([other, min]) => contrast(candidate, other) >= min);

    if (ok) {
      best = mid;
      if (prefer === "high") low = mid;
      else high = mid;
    } else if (prefer === "high") {
      high = mid;
    } else {
      low = mid;
    }
  }

  return best ?? (lo + hi) / 2;
}

/* ---------------------------------------------------------------- generation */

/**
 * Targets are set ABOVE the WCAG minimum on purpose. Solving to exactly 4.5
 * parks the value on the boundary, and hex quantisation then rounds it under —
 * plus it leaves accent-soft no room to be a visible tint rather than near-white.
 */
export function buildCustomTheme(
  seedHex: string,
  mode: "light" | "dark",
): ThemeTokens {
  const hue = hexToHue(seedHex) ?? 0;

  if (mode === "light") {
    const background = hslToHex(hue, 0.3, 0.988);
    const surface = hslToHex(hue, 0.26, 0.962);
    const accentStrong = hslToHex(
      hue,
      0.54,
      solveLightness(
        hue,
        0.54,
        [
          [background, 6.2],
          [surface, 6.0],
          ["#ffffff", 4.5],
        ],
        0.1,
        0.6,
        "high",
      ),
    );

    return {
      "--background": background,
      "--foreground": hslToHex(hue, 0.14, 0.145),
      "--ink": hslToHex(hue, 0.14, 0.145),
      "--ink-muted": hslToHex(hue, 0.11, 0.395),
      "--ink-faint": hslToHex(hue, 0.1, 0.515),
      "--surface": surface,
      "--surface-muted": hslToHex(hue, 0.24, 0.952),
      "--preview-bg": hslToHex(hue, 0.4, 0.994),
      "--border": hslToHex(hue, 0.09, 0.525),
      "--accent": hslToHex(
        hue,
        0.62,
        solveLightness(hue, 0.62, [[background, 3.0]], 0.2, 0.75, "high"),
      ),
      "--accent-strong": accentStrong,
      "--accent-soft": hslToHex(
        hue,
        0.58,
        solveLightness(hue, 0.58, [[accentStrong, 4.62]], 0.86, 0.97, "low"),
      ),
      "--on-accent": "#ffffff",
      "--glow-1": hslToHex(hue, 0.62, 0.865),
      "--glow-2": hslToHex(hue + 40, 0.56, 0.88),
      "--inset-highlight": "rgba(255, 255, 255, 0.4)",
    };
  }

  const background = hslToHex(hue, 0.12, 0.088);
  const surface = hslToHex(hue, 0.11, 0.128);
  const onAccent = hslToHex(hue, 0.2, 0.085);
  const accentStrong = hslToHex(
    hue,
    0.74,
    solveLightness(
      hue,
      0.74,
      [
        [background, 7.5],
        [surface, 6.8],
        [onAccent, 4.5],
      ],
      0.45,
      0.95,
      "low",
    ),
  );

  return {
    "--background": background,
    "--foreground": hslToHex(hue, 0.16, 0.935),
    "--ink": hslToHex(hue, 0.16, 0.935),
    "--ink-muted": hslToHex(hue, 0.11, 0.705),
    "--ink-faint": hslToHex(hue, 0.1, 0.545),
    "--surface": surface,
    "--surface-muted": hslToHex(hue, 0.11, 0.152),
    "--preview-bg": hslToHex(hue, 0.12, 0.108),
    "--border": hslToHex(hue, 0.09, 0.525),
    "--accent": hslToHex(
      hue,
      0.58,
      solveLightness(hue, 0.58, [[background, 3.0]], 0.3, 0.85, "low"),
    ),
    "--accent-strong": accentStrong,
    "--accent-soft": hslToHex(
      hue,
      0.34,
      solveLightness(hue, 0.34, [[accentStrong, 4.62]], 0.1, 0.42, "high"),
    ),
    "--on-accent": onAccent,
    "--glow-1": hslToHex(hue, 0.52, 0.185),
    "--glow-2": hslToHex(hue + 40, 0.46, 0.172),
    "--inset-highlight": "rgba(255, 255, 255, 0.06)",
  };
}

/** Applies or clears the custom token block as inline styles on <html>. */
export function applyCustomTheme(
  seedHex: string | null,
  mode: "light" | "dark",
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const tokens = seedHex ? buildCustomTheme(seedHex, mode) : null;

  const keys = Object.keys(buildCustomTheme("#000000", mode));
  for (const key of keys) {
    if (tokens) root.style.setProperty(key, tokens[key]!);
    else root.style.removeProperty(key);
  }
}

export const DEFAULT_CUSTOM_SEED = "#4f7fd4";
