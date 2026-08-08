"use client";

import {
  hexToHsv,
  hsvToHex,
  type Hsv,
} from "@/lib/colorContrast";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Saturation/brightness area + hue slider.
 *
 * Replaces <input type="color">, whose popup is an OS dialog that cannot be
 * styled, cannot inherit the theme, and looks foreign next to the rest of the UI.
 *
 * ACCESSIBILITY NOTES
 * The SV area is inherently two-dimensional, which ARIA has no native control
 * for. It is exposed as role="slider" with aria-valuetext carrying both axes in
 * words ("Saturation 62%, brightness 80%") — the pattern used by every mature
 * picker, because the alternative (two separate sliders) loses the spatial
 * relationship that makes the control usable for sighted users. Arrow keys move
 * 1% per press, Shift+arrow 10%, Home/End jump to the ends of the saturation
 * axis, PageUp/PageDown to the ends of brightness.
 *
 * Hue is a genuine one-dimensional range, so it gets a plain role="slider" with
 * aria-valuenow in degrees and a text equivalent naming the colour family.
 *
 * Pointer input uses setPointerCapture so a drag that leaves the element keeps
 * tracking, matching how every native slider behaves.
 */

const HUE_NAMES: [number, string][] = [
  [15, "red"],
  [45, "orange"],
  [70, "yellow"],
  [160, "green"],
  [200, "cyan"],
  [255, "blue"],
  [290, "violet"],
  [330, "magenta"],
  [360, "red"],
];

function hueName(h: number): string {
  const norm = ((h % 360) + 360) % 360;
  for (const [limit, name] of HUE_NAMES) if (norm < limit) return name;
  return "red";
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function HsvColorPicker({
  value,
  onChange,
  onCommit,
  disabled = false,
  tabIndex,
  label,
}: {
  /** Current colour as #rrggbb. */
  value: string;
  /** Fires continuously while dragging — use for live preview. */
  onChange: (hex: string) => void;
  /** Fires when an interaction ends — use to persist. */
  onCommit: (hex: string) => void;
  disabled?: boolean;
  tabIndex?: number;
  /** Prefix for accessible names, e.g. "Text colour". */
  label: string;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const areaLabelId = useId();
  const hueLabelId = useId();

  /**
   * HSV is held locally rather than derived from `value` on every render.
   * Hex is lossy for this control: at v=0 every hue and saturation collapses to
   * #000000, so round-tripping through hex would snap the thumb to a corner and
   * strand the user the moment they dragged to black. Local state preserves the
   * hue and saturation they had.
   */
  const [hsv, setHsv] = useState<Hsv>(
    () => hexToHsv(value) ?? { h: 0, s: 0, v: 0 },
  );
  const [lastExternal, setLastExternal] = useState(value);

  // Adopt external changes (preset clicks, hex field edits) without clobbering
  // an in-progress drag.
  if (value !== lastExternal) {
    setLastExternal(value);
    const next = hexToHsv(value);
    if (next && hsvToHex(next) !== hsvToHex(hsv)) setHsv(next);
  }

  const push = useCallback(
    (next: Hsv, commit: boolean) => {
      setHsv(next);
      const hex = hsvToHex(next);
      onChange(hex);
      if (commit) onCommit(hex);
    },
    [onChange, onCommit],
  );

  /* ------------------------------------------------------ pointer handling */

  const pointerFromArea = useCallback(
    (clientX: number, clientY: number): { s: number; v: number } | null => {
      const el = areaRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      return {
        s: clamp01((clientX - r.left) / r.width),
        v: 1 - clamp01((clientY - r.top) / r.height),
      };
    },
    [],
  );

  const onAreaPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    areaRef.current?.focus();
    const p = pointerFromArea(e.clientX, e.clientY);
    if (p) push({ ...hsv, ...p }, false);
  };

  const onAreaPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const p = pointerFromArea(e.clientX, e.clientY);
    if (p) push({ ...hsv, ...p }, false);
  };

  const onAreaPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onCommit(hsvToHex(hsv));
  };

  const hueFromPointer = useCallback((clientX: number): number | null => {
    const el = hueRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return null;
    return clamp01((clientX - r.left) / r.width) * 360;
  }, []);

  const onHuePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    hueRef.current?.focus();
    const h = hueFromPointer(e.clientX);
    if (h !== null) push({ ...hsv, h }, false);
  };

  const onHuePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const h = hueFromPointer(e.clientX);
    if (h !== null) push({ ...hsv, h }, false);
  };

  const onHuePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onCommit(hsvToHex(hsv));
  };

  /* ----------------------------------------------------- keyboard handling */

  const onAreaKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = e.shiftKey ? 0.1 : 0.01;
    let { s, v } = hsv;
    let handled = true;

    switch (e.key) {
      case "ArrowRight": s = clamp01(s + step); break;
      case "ArrowLeft":  s = clamp01(s - step); break;
      case "ArrowUp":    v = clamp01(v + step); break;
      case "ArrowDown":  v = clamp01(v - step); break;
      case "Home":       s = 0; break;
      case "End":        s = 1; break;
      case "PageUp":     v = 1; break;
      case "PageDown":   v = 0; break;
      default: handled = false;
    }

    if (!handled) return;
    e.preventDefault();
    push({ ...hsv, s, v }, true);
  };

  const onHueKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = e.shiftKey ? 30 : 2;
    let h = hsv.h;
    let handled = true;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp": h = (h + step) % 360; break;
      case "ArrowLeft":
      case "ArrowDown": h = (h - step + 360) % 360; break;
      case "Home": h = 0; break;
      case "End": h = 359; break;
      default: handled = false;
    }

    if (!handled) return;
    e.preventDefault();
    push({ ...hsv, h }, true);
  };

  /* ------------------------------------------------------------------ view */

  const satPct = Math.round(hsv.s * 100);
  const valPct = Math.round(hsv.v * 100);
  const hueDeg = Math.round(hsv.h);
  const pureHue = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  /**
   * Thumb outline is fixed black-over-white rather than a token: it sits on
   * arbitrary user-chosen colour, so no theme token can guarantee it stays
   * visible. The double ring holds an edge against both ends of the range.
   */
  // allow-color-literal: the thumb sits on arbitrary user-chosen colour, so no
  // theme token can guarantee it stays visible. A white ring inside a dark ring
  // holds an edge against both ends of the range.
  const thumbRing =
    "shadow-[0_0_0_1.5px_#ffffff,0_0_0_3px_rgba(0,0,0,0.55)]";

  return (
    <div className="space-y-2">
      <span id={areaLabelId} className="sr-only">
        {label} saturation and brightness
      </span>
      <div
        ref={areaRef}
        role="slider"
        aria-labelledby={areaLabelId}
        aria-valuetext={`Saturation ${satPct}%, brightness ${valPct}%`}
        aria-valuenow={satPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : (tabIndex ?? 0)}
        onPointerDown={onAreaPointerDown}
        onPointerMove={onAreaPointerMove}
        onPointerUp={onAreaPointerUp}
        onKeyDown={onAreaKeyDown}
        className={[
          "relative h-28 w-full touch-none rounded-lg outline-none",
          "ring-1 ring-[var(--border)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--preview-bg)]",
          disabled ? "opacity-60" : "cursor-crosshair",
        ].join(" ")}
        style={{
          backgroundColor: pureHue,
          // allow-color-literal: these two ramps ARE the HSV colour solid —
          // white->transparent across saturation, black->transparent down
          // brightness. They are the data being displayed, not chrome.
          backgroundImage:
            "linear-gradient(to right, #ffffff, rgba(255,255,255,0)), linear-gradient(to top, #000000, rgba(0,0,0,0))",
        }}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${thumbRing}`}
          style={{
            left: `${satPct}%`,
            top: `${100 - valPct}%`,
            backgroundColor: hsvToHex(hsv),
          }}
        />
      </div>

      <span id={hueLabelId} className="sr-only">
        {label} hue
      </span>
      <div
        ref={hueRef}
        role="slider"
        aria-labelledby={hueLabelId}
        aria-valuenow={hueDeg}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuetext={`${hueDeg} degrees, ${hueName(hsv.h)}`}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : (tabIndex ?? 0)}
        onPointerDown={onHuePointerDown}
        onPointerMove={onHuePointerMove}
        onPointerUp={onHuePointerUp}
        onKeyDown={onHueKeyDown}
        className={[
          "relative h-3.5 w-full touch-none rounded-full outline-none",
          "ring-1 ring-[var(--border)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--preview-bg)]",
          disabled ? "opacity-60" : "cursor-pointer",
        ].join(" ")}
        style={{
          // allow-color-literal: the hue wheel at full saturation. Fixed by
          // definition — theming it would misrepresent the colour space.
          backgroundImage:
            "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
        }}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ${thumbRing}`}
          style={{ left: `${(hueDeg / 360) * 100}%`, backgroundColor: pureHue }}
        />
      </div>
    </div>
  );
}
