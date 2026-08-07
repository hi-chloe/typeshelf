"use client";

import { useFontLibrary } from "@/lib/FontLibraryContext";

export function VariantChips() {
  const { selectedVariants, selectedFont, selectVariant } = useFontLibrary();

  if (!selectedFont || selectedVariants.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        Variants
      </p>
      <div className="flex flex-wrap gap-2">
        {selectedVariants.map((variant) => {
          const active = variant.id === selectedFont.id;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => selectVariant(variant.id)}
              className={[
                "rounded-md border px-2.5 py-1 text-sm transition-colors",
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-muted)]",
              ].join(" ")}
            >
              {variant.style}
            </button>
          );
        })}
      </div>
    </div>
  );
}
