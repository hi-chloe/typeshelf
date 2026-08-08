"use client";

import { useFontLibrary } from "@/lib/FontLibraryContext";
import { HsvColorPicker } from "./HsvColorPicker";
import {
  COLOR_SCHEMES,
  SCHEME_LABELS,
  SCHEME_SWATCH,
  THEME_MODES,
  type ColorScheme,
  type ThemeMode,
} from "@/lib/theme";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * Dark halo behind the selection check.
 *
 * allow-color-literal: swatch faces are fixed scheme previews (SCHEME_SWATCH in
 * lib/theme.ts) and never change with the active theme, so the check drawn on them
 * must not either. The halo keeps the check at >=3:1 on light swatch faces,
 * including a user-picked custom seed of any hue.
 */
// prettier-ignore
const CHECK_HALO = "drop-shadow(0 0 0.6px rgba(0,0,0,0.9)) drop-shadow(0 0 1.2px rgba(0,0,0,0.75))";

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3 w-3"
      fill="none"
      // allow-color-literal: swatch faces are fixed scheme previews (SCHEME_SWATCH in
      // lib/theme.ts) or the user's custom seed — not theme chrome. They do not change
      // with the active theme, so the check drawn on them must not either.
      stroke="#ffffff"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: CHECK_HALO }}
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
    >
      <path
        d="M10 2.5c-4.1 0-7.5 3-7.5 6.8 0 2.6 1.6 4.4 3.6 4.4.7 0 1.2-.2 1.7-.7.3-.3.7-.5 1.2-.5h.8c2.2 0 4 1.6 4 3.5 0 .4-.1.9-.2 1.2 2.3-1 4-3.6 4-6.4C17.6 5.6 14.2 2.5 10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="8" r="1.1" fill="currentColor" />
      <circle cx="10.2" cy="6.2" r="1.1" fill="currentColor" />
      <circle cx="13.4" cy="8" r="1.1" fill="currentColor" />
    </svg>
  );
}

/**
 * Roving radiogroup helpers.
 *
 * VariantChips separates arrow focus from selection because each commit can
 * load a font face. Theme tokens are cheap to swap, so arrow / Home / End
 * select immediately — standard WAI-ARIA radio behavior.
 */
function clampIndex(next: number, length: number) {
  return Math.max(0, Math.min(length - 1, next));
}

export function ThemeControls() {
  const { state, setColorScheme, setThemeMode, setCustomSeed } =
    useFontLibrary();
  const { scheme, mode, customSeed } = state.theme;
  const [schemeMenuOpen, setSchemeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const schemeButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const modeButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const labelId = useId();
  const modeLabelId = useId();

  const selectedSchemeIndex = Math.max(0, COLOR_SCHEMES.indexOf(scheme));
  const selectedModeIndex = Math.max(0, THEME_MODES.indexOf(mode));
  const [schemeFocusIndex, setSchemeFocusIndex] = useState(selectedSchemeIndex);
  const [modeFocusIndex, setModeFocusIndex] = useState(selectedModeIndex);
  const [prevScheme, setPrevScheme] = useState(scheme);
  const [prevMode, setPrevMode] = useState(mode);

  if (scheme !== prevScheme) {
    setPrevScheme(scheme);
    setSchemeFocusIndex(selectedSchemeIndex);
  }
  if (mode !== prevMode) {
    setPrevMode(mode);
    setModeFocusIndex(selectedModeIndex);
  }

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    const restoreFocus = opts?.restoreFocus !== false;
    setSchemeMenuOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /**
   * Outside pointer: close, then restore focus only if it is still parked inside
   * the (now aria-hidden) panel. If the click focused another control, leave it.
   */
  const closeFromOutsidePointer = useCallback(() => {
    const focusInside = Boolean(
      menuRef.current?.contains(document.activeElement),
    );
    setSchemeMenuOpen(false);
    if (!focusInside) return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (
        !active ||
        active === document.body ||
        menuRef.current?.contains(active)
      ) {
        triggerRef.current?.focus();
      }
    });
  }, []);

  useEffect(() => {
    if (!schemeMenuOpen) return;

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeFromOutsidePointer();
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
    };

    // Tab away: dismiss without yanking focus back to the trigger.
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && menuRef.current?.contains(next)) return;
      closeMenu({ restoreFocus: false });
    };

    const root = menuRef.current;
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    root?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      root?.removeEventListener("focusout", onFocusOut);
    };
  }, [schemeMenuOpen, closeMenu, closeFromOutsidePointer]);

  // Move focus into the checked swatch when the popover opens (not a dialog).
  useEffect(() => {
    if (!schemeMenuOpen) return;
    const index = Math.max(0, COLOR_SCHEMES.indexOf(scheme));
    const frame = requestAnimationFrame(() => {
      schemeButtonRefs.current[index]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [schemeMenuOpen, scheme]);

  const commitScheme = (id: ColorScheme) => {
    setColorScheme(id);
    closeMenu({ restoreFocus: true });
  };

  const moveSchemeFocus = (next: number) => {
    const clamped = clampIndex(next, COLOR_SCHEMES.length);
    setSchemeFocusIndex(clamped);
    const id = COLOR_SCHEMES[clamped];
    if (id) setColorScheme(id);
    const el = schemeButtonRefs.current[clamped];
    el?.focus();
  };

  const onSchemeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveSchemeFocus(schemeFocusIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveSchemeFocus(schemeFocusIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        moveSchemeFocus(0);
        break;
      case "End":
        event.preventDefault();
        moveSchemeFocus(COLOR_SCHEMES.length - 1);
        break;
      case " ":
      case "Enter": {
        event.preventDefault();
        const id = COLOR_SCHEMES[schemeFocusIndex];
        if (id) commitScheme(id);
        break;
      }
      default:
        break;
    }
  };

  const moveModeFocus = (next: number) => {
    const clamped = clampIndex(next, THEME_MODES.length);
    setModeFocusIndex(clamped);
    const id = THEME_MODES[clamped];
    if (id) setThemeMode(id);
    const el = modeButtonRefs.current[clamped];
    el?.focus();
  };

  const onModeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveModeFocus(modeFocusIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveModeFocus(modeFocusIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        moveModeFocus(0);
        break;
      case "End":
        event.preventDefault();
        moveModeFocus(THEME_MODES.length - 1);
        break;
      case " ":
      case "Enter": {
        event.preventDefault();
        const id = THEME_MODES[modeFocusIndex];
        if (id) setThemeMode(id);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="relative" ref={menuRef}>
        <div className="flex items-center justify-between gap-2">
          <p
            id={labelId}
            className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
          >
            Color
          </p>
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="true"
            aria-expanded={schemeMenuOpen}
            aria-controls={menuId}
            aria-label={`Color theme: ${SCHEME_LABELS[scheme]}. Open color menu`}
            title={`${SCHEME_LABELS[scheme]} theme`}
            onClick={() => setSchemeMenuOpen((open) => !open)}
            className={[
              "inline-flex h-7 min-w-7 items-center gap-1.5 rounded-md border px-1.5 outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]",
              schemeMenuOpen
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                : "border-[var(--border)] bg-[var(--preview-bg)] text-[var(--ink-muted)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-[var(--border)]"
              style={{
                backgroundColor:
                  scheme === "custom" ? customSeed : SCHEME_SWATCH[scheme],
              }}
            />
            <PaletteIcon />
          </button>
        </div>

        <div
          aria-hidden={!schemeMenuOpen}
          className={[
            "absolute bottom-[calc(100%+0.4rem)] right-0 z-20 origin-bottom-right",
            "rounded-xl border border-[var(--border)] bg-[var(--preview-bg)] p-2 shadow-[0_8px_24px_color-mix(in_srgb,var(--ink)_14%,transparent)]",
            "motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out",
            schemeMenuOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-1 scale-95 opacity-0",
          ].join(" ")}
        >
          <div
            id={menuId}
            role="radiogroup"
            aria-labelledby={labelId}
            className="flex flex-wrap gap-1.5"
            onKeyDown={onSchemeKeyDown}
          >
            {COLOR_SCHEMES.map((id, index) => (
              <SchemeSwatch
                key={id}
                ref={(el) => {
                  schemeButtonRefs.current[index] = el;
                }}
                scheme={id}
                customSeed={customSeed}
                selected={scheme === id}
                onSelect={() => commitScheme(id)}
                onFocus={() => setSchemeFocusIndex(index)}
                tabIndex={
                  schemeMenuOpen && index === schemeFocusIndex ? 0 : -1
                }
              />
            ))}
          </div>

          {/*
            Only the HUE of this color is used. Saturation and lightness are
            solved against contrast targets in lib/customTheme.ts, so the theme
            can't be driven below AA no matter what is picked — verified across
            all 360 hues. The swatch shows the seed, not the derived accent, so
            the control stays predictable while you drag.
          */}
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <p className="mb-1 text-[10px] font-medium text-[var(--ink-muted)]">
              Custom color
            </p>
            <HsvColorPicker
              label="Custom theme"
              value={customSeed}
              tabIndex={schemeMenuOpen ? 0 : -1}
              onChange={(hex) => {
                setCustomSeed(hex);
                if (scheme !== "custom") setColorScheme("custom");
              }}
              onCommit={(hex) => setCustomSeed(hex)}
            />
            <p className="mt-1 font-mono text-[10px] uppercase tabular-nums text-[var(--ink-muted)]">
              {customSeed}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p
          id={modeLabelId}
          className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
        >
          Mode
        </p>
        <div
          role="radiogroup"
          aria-labelledby={modeLabelId}
          className="grid grid-cols-3 gap-1"
          onKeyDown={onModeKeyDown}
        >
          {THEME_MODES.map((id, index) => {
            const selected = mode === id;
            return (
              <button
                key={id}
                ref={(el) => {
                  modeButtonRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${MODE_LABELS[id]} mode`}
                tabIndex={index === modeFocusIndex ? 0 : -1}
                onClick={() => setThemeMode(id)}
                onFocus={() => setModeFocusIndex(index)}
                className={[
                  "min-h-6 rounded-md border px-1.5 py-1 text-[11px] font-medium outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]",
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--border)] bg-[var(--preview-bg)] text-[var(--ink-muted)] hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {MODE_LABELS[id]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const SchemeSwatch = forwardRef<
  HTMLButtonElement,
  {
    scheme: ColorScheme;
    selected: boolean;
    onSelect: () => void;
    onFocus: () => void;
    tabIndex?: number;
    /** Face color for the "custom" swatch; presets use their fixed swatch. */
    customSeed: string;
  }
>(function SchemeSwatch(
  { scheme, selected, onSelect, onFocus, tabIndex, customSeed },
  ref,
) {
  const label =
    scheme === "custom"
      ? "Custom theme color"
      : `${SCHEME_LABELS[scheme]} theme`;
  const face = scheme === "custom" ? customSeed : SCHEME_SWATCH[scheme];

  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      tabIndex={tabIndex}
      onClick={onSelect}
      onFocus={onFocus}
      className={[
        "relative flex h-7 w-7 items-center justify-center rounded-full outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--preview-bg)]",
        selected
          ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--preview-bg)]"
          : "ring-1 ring-[var(--border)]",
      ].join(" ")}
      style={{ backgroundColor: face }}
    >
      {selected ? <CheckIcon /> : null}
    </button>
  );
});
