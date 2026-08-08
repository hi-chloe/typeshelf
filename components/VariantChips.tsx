"use client";

import { useFontLibrary } from "@/lib/FontLibraryContext";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/**
 * Overflow strategy: chip radiogroup when there are ≤6 variants; labeled
 * <select> above that. Families regularly ship 9–18 faces (weights × italic),
 * and a wrapping chip strip in the header balloons vertical chrome. A select
 * keeps the header to one compact control while preserving the same
 * selectVariant() path — no horizontal scroll trap for keyboard users.
 */
const CHIP_THRESHOLD = 6;

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

export function VariantChips() {
  const { selectedVariants, selectedFont, selectVariant } = useFontLibrary();
  const labelId = useId();
  const selectId = useId();

  if (!selectedFont || selectedVariants.length === 0) return null;

  const useSelect = selectedVariants.length > CHIP_THRESHOLD;

  return (
    <div className="min-w-0 md:max-w-md">
      {useSelect ? (
        <div>
          <label
            htmlFor={selectId}
            id={labelId}
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
          >
            Variants
          </label>
          <select
            id={selectId}
            aria-labelledby={labelId}
            value={selectedFont.id}
            onChange={(e) => selectVariant(e.target.value)}
            className={[
              "min-h-6 w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none",
              "focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]",
            ].join(" ")}
          >
            {selectedVariants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.style}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <ChipRadiogroup
          labelId={labelId}
          variants={selectedVariants}
          selectedId={selectedFont.id}
          onSelect={selectVariant}
        />
      )}
    </div>
  );
}

function ChipRadiogroup({
  labelId,
  variants,
  selectedId,
  onSelect,
}: {
  labelId: string;
  variants: { id: string; style: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selectedIndex = Math.max(
    0,
    variants.findIndex((v) => v.id === selectedId),
  );
  const [focusIndex, setFocusIndex] = useState(selectedIndex);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setFocusIndex(selectedIndex);
  }, [selectedIndex, selectedId]);

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(variants.length - 1, next));
    setFocusIndex(clamped);
    const el = buttonRefs.current[clamped];
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveFocus(focusIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveFocus(focusIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(0);
        break;
      case "End":
        event.preventDefault();
        moveFocus(variants.length - 1);
        break;
      case " ":
      case "Enter": {
        event.preventDefault();
        const variant = variants[focusIndex];
        if (variant) onSelect(variant.id);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div>
      <p
        id={labelId}
        className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
      >
        Variants
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-1.5"
        onKeyDown={onKeyDown}
      >
        {variants.map((variant, index) => {
          const active = variant.id === selectedId;
          return (
            <button
              key={variant.id}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => onSelect(variant.id)}
              onFocus={() => setFocusIndex(index)}
              className={[
                "inline-flex min-h-6 min-w-6 items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]",
                active
                  ? // --accent clears ≥3:1 on --background; font-semibold + check are non-color cues (WCAG 1.4.1).
                    "border-2 border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]"
                  : "border border-[var(--border)] bg-[var(--surface)] font-normal text-[var(--ink)] hover:border-[var(--ink-muted)]",
              ].join(" ")}
            >
              {active ? <CheckIcon /> : null}
              <span>{variant.style}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
