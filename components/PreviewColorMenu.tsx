"use client";

import {
  clampChannel,
  cmykToRgb,
  isHexColor,
  normalizeHex,
  parseCssColorToRgb,
  resolveCssColor,
  rgbToCmyk,
  rgbToHex,
  type Cmyk,
  type Rgb,
} from "@/lib/colorContrast";
import { HsvColorPicker } from "./HsvColorPicker";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export type ColorPreset = {
  id: string;
  label: string;
  /** CSS color used for the swatch face and resolve-on-pick (e.g. var(--ink)). */
  css: string;
  /** When true, picking this preset writes null (follow theme token). */
  followsTheme?: boolean;
};

type PreviewColorMenuProps = {
  label: string;
  /** Stored value; null = follow themeCss. */
  value: string | null;
  /** Theme token used when value is null, e.g. var(--ink). */
  themeCss: string;
  presets: readonly ColorPreset[];
  /** Persist to the store (debounced for custom drag/type). */
  onChange: (color: string | null) => void;
  /**
   * Live paint for the specimen while editing — does not hit the reducer.
   * Pass null to clear the live override (use stored/theme value).
   */
  onLiveChange: (color: string | null) => void;
  /** Optional description for the trigger (e.g. contrast readout). */
  "aria-describedby"?: string;
};

function useDebouncedCommit(onChange: (color: string | null) => void, ms = 140) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flush = useCallback(
    (color: string | null) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = undefined;
      onChange(color);
    },
    [onChange],
  );

  const schedule = useCallback(
    (color: string) => {
      pendingRef.current = color;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const next = pendingRef.current;
        pendingRef.current = undefined;
        if (next !== undefined) onChange(next);
      }, ms);
    },
    [ms, onChange],
  );

  const flushPending = useCallback(() => {
    if (pendingRef.current === undefined) return;
    const next = pendingRef.current;
    pendingRef.current = undefined;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onChange(next);
  }, [onChange]);

  return { schedule, flush, flushPending };
}

function resolveEffectiveHex(
  value: string | null,
  themeCss: string,
): string {
  if (value) return normalizeHex(value);
  // allow-color-literal: logic fallback when getComputedStyle can't resolve a token
  // (SSR / detached node), never painted as a style value.
  return resolveCssColor(themeCss) ?? "#000000";
}

function clampIndex(next: number, length: number) {
  return Math.max(0, Math.min(length - 1, next));
}

export function PreviewColorMenu({
  label,
  value,
  themeCss,
  presets,
  onChange,
  onLiveChange,
  "aria-describedby": ariaDescribedBy,
}: PreviewColorMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const labelId = useId();
  const presetButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [presetFocusIndex, setPresetFocusIndex] = useState(0);

  const [draftHex, setDraftHex] = useState(() =>
    resolveEffectiveHex(value, themeCss),
  );
  const [presetHexes, setPresetHexes] = useState<Record<string, string>>({});
  const { schedule, flush, flushPending } = useDebouncedCommit(onChange);

  const setOpenSafe = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpen((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (prev && !resolved) {
          flushPending();
          onLiveChange(null);
        }
        return resolved;
      });
    },
    [flushPending, onLiveChange],
  );

  const closeMenu = useCallback(
    (opts?: { restoreFocus?: boolean }) => {
      const restoreFocus = opts?.restoreFocus !== false;
      setOpenSafe(false);
      if (restoreFocus) triggerRef.current?.focus();
    },
    [setOpenSafe],
  );

  /**
   * Outside pointer: close, then restore focus only if it is still parked inside
   * the (now aria-hidden) panel. If the click focused another control, leave it.
   */
  const closeFromOutsidePointer = useCallback(() => {
    const focusInside = Boolean(
      menuRef.current?.contains(document.activeElement),
    );
    setOpenSafe(false);
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
  }, [setOpenSafe]);

  const refreshPresetHexes = useCallback(() => {
    const next: Record<string, string> = {};
    for (const preset of presets) {
      const hex = resolveCssColor(preset.css);
      if (hex) next[preset.id] = normalizeHex(hex);
    }
    setPresetHexes(next);
  }, [presets]);

  // Keep draft in sync when closed (theme switch / external reset).
  if (!open) {
    const resolved = resolveEffectiveHex(value, themeCss);
    if (draftHex !== resolved) {
      setDraftHex(resolved);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) refreshPresetHexes();
    });
    const obs = new MutationObserver(refreshPresetHexes);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-scheme", "data-mode"],
    });
    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [open, refreshPresetHexes]);

  // Re-read theme token when data-scheme / data-mode flips while closed.
  useEffect(() => {
    if (open || value !== null) return;
    const sync = () => setDraftHex(resolveEffectiveHex(null, themeCss));
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-scheme", "data-mode"],
    });
    return () => obs.disconnect();
  }, [open, value, themeCss]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeFromOutsidePointer();
    };

    const onKeyDown = (event: KeyboardEvent) => {
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
  }, [open, closeMenu, closeFromOutsidePointer]);

  /*
    Move focus into the popover when it opens. Prefer the checked preset so
    keyboard users land on the current selection (standard radiogroup open).
  */
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const selected = panelRef.current?.querySelector<HTMLElement>(
        '[role="radiogroup"] [role="radio"][aria-checked="true"]',
      );
      if (selected) {
        selected.focus();
        return;
      }
      const first = panelRef.current?.querySelector<HTMLElement>(
        '[role="slider"], button, input',
      );
      first?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const paintAndPersist = (hex: string, mode: "immediate" | "debounce") => {
    const next = normalizeHex(hex);
    setDraftHex(next);
    onLiveChange(next);
    if (mode === "immediate") flush(next);
    else schedule(next);
  };

  const applyThemeFollow = () => {
    const hex = resolveCssColor(themeCss) ?? draftHex;
    setDraftHex(hex);
    onLiveChange(null);
    flush(null);
  };

  const pickPreset = (preset: ColorPreset) => {
    if (preset.followsTheme) {
      applyThemeFollow();
      return;
    }
    const hex = resolveCssColor(preset.css);
    if (hex) paintAndPersist(hex, "immediate");
  };

  const rgb = parseCssColorToRgb(draftHex) ?? { r: 0, g: 0, b: 0 };
  const cmyk = rgbToCmyk(rgb);
  const followingTheme = value === null;

  const isPresetSelected = (preset: ColorPreset) =>
    preset.followsTheme
      ? followingTheme
      : !followingTheme &&
        !!presetHexes[preset.id] &&
        normalizeHex(draftHex) === presetHexes[preset.id];

  const selectedPresetIndex = Math.max(
    0,
    presets.findIndex((preset) => isPresetSelected(preset)),
  );

  // Keep roving focus aligned with the checked preset when selection changes.
  const [prevSelectedPresetIndex, setPrevSelectedPresetIndex] =
    useState(selectedPresetIndex);
  if (selectedPresetIndex !== prevSelectedPresetIndex) {
    setPrevSelectedPresetIndex(selectedPresetIndex);
    setPresetFocusIndex(selectedPresetIndex);
  }

  const movePresetFocus = (next: number) => {
    const clamped = clampIndex(next, presets.length);
    setPresetFocusIndex(clamped);
    const preset = presets[clamped];
    if (preset) pickPreset(preset);
    presetButtonRefs.current[clamped]?.focus();
  };

  // Presets are cheap to apply — arrow selects immediately (theme radiogroups).
  const onPresetKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        movePresetFocus(presetFocusIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        movePresetFocus(presetFocusIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        movePresetFocus(0);
        break;
      case "End":
        event.preventDefault();
        movePresetFocus(presets.length - 1);
        break;
      case " ":
      case "Enter": {
        event.preventDefault();
        const preset = presets[presetFocusIndex];
        if (preset) pickPreset(preset);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        aria-labelledby={labelId}
        aria-describedby={ariaDescribedBy}
        onClick={() => setOpenSafe((v) => !v)}
        className={[
          "inline-flex h-7 min-w-7 items-center gap-1.5 rounded-md border px-1.5 outline-none",
          "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]",
          open
            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]",
        ].join(" ")}
      >
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-[var(--border)]"
          style={{ backgroundColor: draftHex }}
        />
        <span id={labelId} className="text-[11px] font-medium">
          {label}
        </span>
      </button>

      <div
        ref={panelRef}
        id={menuId}
        role="group"
        aria-labelledby={labelId}
        aria-hidden={!open}
        className={[
          "absolute left-0 top-[calc(100%+0.4rem)] z-30 w-[17.5rem] origin-top-left",
          "rounded-xl border border-[var(--border)] bg-[var(--preview-bg)] p-3 shadow-[0_8px_24px_color-mix(in_srgb,var(--ink)_14%,transparent)]",
          "motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0",
        ].join(" ")}
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          Presets
        </p>
        <div
          role="radiogroup"
          aria-label={`${label} presets`}
          className="mb-3 flex flex-wrap gap-1.5"
          onKeyDown={onPresetKeyDown}
        >
          {presets.map((preset, index) => {
            const selected = isPresetSelected(preset);
            return (
              <button
                key={preset.id}
                ref={(el) => {
                  presetButtonRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={preset.label}
                title={preset.label}
                tabIndex={open && index === presetFocusIndex ? 0 : -1}
                onClick={() => pickPreset(preset)}
                onFocus={() => setPresetFocusIndex(index)}
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--preview-bg)]",
                  selected
                    ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--preview-bg)]"
                    : "ring-1 ring-[var(--border)]",
                ].join(" ")}
                style={{ background: preset.css }}
              />
            );
          })}
        </div>

        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          Custom
        </p>

        <div className="mb-2 space-y-2">
          <HsvColorPicker
            label={label}
            value={draftHex}
            disabled={!open}
            tabIndex={open ? 0 : -1}
            onChange={(hex) => paintAndPersist(hex, "debounce")}
            onCommit={(hex) => paintAndPersist(hex, "immediate")}
          />
          <HexField
            value={draftHex}
            disabled={!open}
            onCommit={(hex) => paintAndPersist(hex, "immediate")}
          />
        </div>

        <ChannelRow
          label="RGB"
          fields={[
            { key: "r", value: rgb.r, max: 255 },
            { key: "g", value: rgb.g, max: 255 },
            { key: "b", value: rgb.b, max: 255 },
          ]}
          disabled={!open}
          onCommit={(next) => {
            const parsed: Rgb = {
              r: clampChannel(next.r ?? rgb.r),
              g: clampChannel(next.g ?? rgb.g),
              b: clampChannel(next.b ?? rgb.b),
            };
            paintAndPersist(rgbToHex(parsed), "immediate");
          }}
        />

        <ChannelRow
          label="CMYK"
          fields={[
            { key: "c", value: cmyk.c, max: 100 },
            { key: "m", value: cmyk.m, max: 100 },
            { key: "y", value: cmyk.y, max: 100 },
            { key: "k", value: cmyk.k, max: 100 },
          ]}
          disabled={!open}
          onCommit={(next) => {
            const parsed: Cmyk = {
              c: next.c ?? cmyk.c,
              m: next.m ?? cmyk.m,
              y: next.y ?? cmyk.y,
              k: next.k ?? cmyk.k,
            };
            paintAndPersist(rgbToHex(cmykToRgb(parsed)), "immediate");
          }}
        />

        <button
          type="button"
          tabIndex={open ? 0 : -1}
          disabled={followingTheme}
          onClick={applyThemeFollow}
          className={[
            "mt-2 min-h-6 w-full rounded-md border px-2 py-1 text-[11px] font-medium outline-none",
            "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--preview-bg)]",
            followingTheme
              ? "cursor-not-allowed border-[var(--border)] text-[var(--ink-faint)]"
              : "border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]",
          ].join(" ")}
        >
          Reset to theme
        </button>
      </div>
    </div>
  );
}

function HexField({
  value,
  disabled,
  onCommit,
}: {
  value: string;
  disabled?: boolean;
  onCommit: (hex: string) => void;
}) {
  const errorId = useId();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevValue, setPrevValue] = useState(value);

  if (!focused && value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
    setError(null);
  } else if (value !== prevValue) {
    setPrevValue(value);
  }

  const commit = () => {
    const raw = draft.trim().startsWith("#") ? draft.trim() : `#${draft.trim()}`;
    if (isHexColor(raw)) {
      onCommit(normalizeHex(raw));
      setDraft(normalizeHex(raw));
      setError(null);
      return;
    }
    // Keep the typed value so the user can fix it; don't silently revert.
    setError("Enter a valid hex color like #1a1a1a.");
  };

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <label className="flex min-w-0 items-center gap-1 text-[11px] text-[var(--ink-muted)]">
        <span className="shrink-0 font-medium">HEX</span>
        <input
          type="text"
          spellCheck={false}
          disabled={disabled}
          value={draft}
          aria-label="Hex color"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(value);
              setError(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-7 min-h-7 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-xs text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--preview-bg)]"
        />
      </label>
      {error ? (
        <p id={errorId} role="alert" className="text-[10px] text-[var(--warn-strong)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ChannelRow({
  label,
  fields,
  disabled,
  onCommit,
}: {
  label: string;
  fields: { key: string; value: number; max: number }[];
  disabled?: boolean;
  onCommit: (next: Record<string, number>) => void;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-1">
      <span className="w-9 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {label}
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-4 gap-1">
        {fields.map((field) => (
          <ChannelInput
            key={field.key}
            ariaLabel={`${label} ${field.key.toUpperCase()}`}
            value={field.value}
            max={field.max}
            disabled={disabled}
            onCommit={(n) => onCommit({ [field.key]: n })}
          />
        ))}
      </div>
    </div>
  );
}

function ChannelInput({
  ariaLabel,
  value,
  max,
  disabled,
  onCommit,
}: {
  ariaLabel: string;
  value: number;
  max: number;
  disabled?: boolean;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  if (!focused && value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  } else if (value !== prevValue) {
    setPrevValue(value);
  }

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(0, parsed));
    onCommit(next);
    setDraft(String(next));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      aria-label={`${ariaLabel}, 0 to ${max}`}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const next = e.target.value;
        if (next === "" || /^\d{0,3}$/.test(next)) setDraft(next);
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-7 min-h-7 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-1 text-center text-[11px] tabular-nums text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--preview-bg)]"
    />
  );
}
