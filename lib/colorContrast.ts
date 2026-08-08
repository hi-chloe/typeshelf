/**
 * WCAG 2.x relative-luminance contrast helpers for the preview color readout.
 */

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export type Rgb = { r: number; g: number; b: number };

export function parseCssColorToRgb(color: string): Rgb | null {
  const value = color.trim();
  if (!value || value === "transparent") return null;

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1]!;
    if (h.length === 3) {
      return {
        r: parseInt(h[0]! + h[0]!, 16),
        g: parseInt(h[1]! + h[1]!, 16),
        b: parseInt(h[2]! + h[2]!, 16),
      };
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i,
  );
  if (rgb) {
    return {
      r: Math.round(Number(rgb[1])),
      g: Math.round(Number(rgb[2])),
      b: Math.round(Number(rgb[3])),
    };
  }

  return null;
}

export function relativeLuminance(rgb: Rgb): number {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastGrade = "AAA" | "AA" | "AA Large" | "Fail";

export function contrastGrade(ratio: number): ContrastGrade {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return (
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Resolve `var(--token)` (or any CSS color) to a computed rgb()/hex via the live cascade. */
export function resolveCssColor(
  cssColor: string,
  root: Element = document.documentElement,
): string | null {
  const probe = document.createElement("span");
  probe.style.color = cssColor;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  root.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  root.removeChild(probe);
  const rgb = parseCssColorToRgb(computed);
  return rgb ? rgbToHex(rgb) : null;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizeHex(hex: string): string {
  return hex.toLowerCase();
}

export type Cmyk = { c: number; m: number; y: number; k: number };

export function rgbToCmyk({ r, g, b }: Rgb): Cmyk {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1 - 1e-9) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  const denom = 1 - k;
  return {
    c: Math.round(((1 - rr - k) / denom) * 100),
    m: Math.round(((1 - gg - k) / denom) * 100),
    y: Math.round(((1 - bb - k) / denom) * 100),
    k: Math.round(k * 100),
  };
}

export function cmykToRgb({ c, m, y, k }: Cmyk): Rgb {
  const cc = clampPct(c) / 100;
  const mm = clampPct(m) / 100;
  const yy = clampPct(y) / 100;
  const kk = clampPct(k) / 100;
  return {
    r: Math.round(255 * (1 - cc) * (1 - kk)),
    g: Math.round(255 * (1 - mm) * (1 - kk)),
    b: Math.round(255 * (1 - yy) * (1 - kk)),
  };
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function clampChannel(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

/* --------------------------------------------------------------------- HSV */

/**
 * HSV (not HSL) backs the custom picker.
 *
 * The familiar saturation/brightness rectangle IS the HSV colour solid: x maps
 * to S and y to V, with hue fixed. HSL would need a skewed, hue-dependent shape
 * for the same interaction, because HSL saturation behaves differently at the
 * light and dark ends. Every mainstream picker uses HSV for this reason.
 *
 * h: 0-360, s: 0-1, v: 0-1
 */
export type Hsv = { h: number; s: number; v: number };

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h = (((h * 60) % 360) + 360) % 360;
  }

  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;

  let rgb: [number, number, number];
  if (hh < 1) rgb = [c, x, 0];
  else if (hh < 2) rgb = [x, c, 0];
  else if (hh < 3) rgb = [0, c, x];
  else if (hh < 4) rgb = [0, x, c];
  else if (hh < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return {
    r: clampChannel((rgb[0] + m) * 255),
    g: clampChannel((rgb[1] + m) * 255),
    b: clampChannel((rgb[2] + m) * 255),
  };
}

export function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}

export function hexToHsv(hex: string): Hsv | null {
  const rgb = parseCssColorToRgb(hex);
  return rgb ? rgbToHsv(rgb) : null;
}
