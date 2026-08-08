"use client";

import { useFontLibrary } from "@/lib/FontLibraryContext";
import {
  COLOR_SCHEMES,
  SCHEME_LABELS,
  SCHEME_SWATCH,
  THEME_MODES,
  type ColorScheme,
  type ThemeMode,
} from "@/lib/theme";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3 w-3"
      fill="none"
      // Fixed white on fixed swatch faces (scheme previews, not theme chrome).
      stroke="#ffffff"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
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

export function ThemeControls() {
  const { state, setColorScheme, setThemeMode } = useFontLibrary();
  const { scheme, mode } = state.theme;
  const [schemeMenuOpen, setSchemeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const labelId = useId();

  const closeMenu = useCallback(() => {
    setSchemeMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!schemeMenuOpen) return;

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setSchemeMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [schemeMenuOpen, closeMenu]);

  const selectScheme = (id: ColorScheme) => {
    setColorScheme(id);
    setSchemeMenuOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="space-y-2.5 border-t border-[var(--border)] pt-3">
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
            aria-haspopup="dialog"
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
                background:
                  scheme === "spectrum"
                    ? SCHEME_SWATCH.spectrum
                    : undefined,
                backgroundColor:
                  scheme === "spectrum" ? undefined : SCHEME_SWATCH[scheme],
              }}
            />
            <PaletteIcon />
          </button>
        </div>

        <div
          id={menuId}
          role="dialog"
          aria-labelledby={labelId}
          aria-hidden={!schemeMenuOpen}
          className={[
            "absolute bottom-[calc(100%+0.4rem)] right-0 z-20 origin-bottom-right",
            "rounded-lg border border-[var(--border)] bg-[var(--preview-bg)] p-2 shadow-[0_8px_24px_color-mix(in_srgb,var(--ink)_14%,transparent)]",
            "motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out",
            schemeMenuOpen
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-1 scale-95 opacity-0",
          ].join(" ")}
        >
          <div
            role="radiogroup"
            aria-labelledby={labelId}
            className="flex flex-wrap gap-1.5"
          >
            {COLOR_SCHEMES.map((id) => (
              <SchemeSwatch
                key={id}
                scheme={id}
                selected={scheme === id}
                onSelect={() => selectScheme(id)}
                tabIndex={schemeMenuOpen ? 0 : -1}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <p
          id="theme-mode-label"
          className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
        >
          Mode
        </p>
        <div
          role="radiogroup"
          aria-labelledby="theme-mode-label"
          className="grid grid-cols-3 gap-1"
        >
          {THEME_MODES.map((id) => {
            const selected = mode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${MODE_LABELS[id]} mode`}
                onClick={() => setThemeMode(id)}
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

function SchemeSwatch({
  scheme,
  selected,
  onSelect,
  tabIndex,
}: {
  scheme: ColorScheme;
  selected: boolean;
  onSelect: () => void;
  tabIndex?: number;
}) {
  const label = `${SCHEME_LABELS[scheme]} theme`;
  const face = SCHEME_SWATCH[scheme];
  const isSpectrum = scheme === "spectrum";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      tabIndex={tabIndex}
      onClick={onSelect}
      className={[
        "relative flex h-7 w-7 items-center justify-center rounded-full outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--preview-bg)]",
        selected
          ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--preview-bg)]"
          : "ring-1 ring-[var(--border)]",
      ].join(" ")}
      style={{
        background: isSpectrum ? face : undefined,
        backgroundColor: isSpectrum ? undefined : face,
      }}
    >
      {selected ? <CheckIcon /> : null}
    </button>
  );
}
