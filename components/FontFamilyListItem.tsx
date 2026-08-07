"use client";

import { useEffect, useRef, useState } from "react";
import { useFontLibrary } from "@/lib/FontLibraryContext";
import type { FontEntry } from "@/lib/types";

function pickDefaultVariant(variants: FontEntry[]): FontEntry {
  const regular = variants.find(
    (f) =>
      f.style.toLowerCase() === "regular" ||
      f.style.toLowerCase() === "normal" ||
      (f.weightClass === 400 && !/italic|oblique/i.test(f.style)),
  );
  if (regular) return regular;
  return [...variants].sort((a, b) => a.weightClass - b.weightClass)[0]!;
}

export function FontFamilyListItem({
  family,
  variants,
  active,
  isFavorite,
  autoCategory,
  onSelect,
}: {
  family: string;
  variants: FontEntry[];
  active: boolean;
  isFavorite: boolean;
  autoCategory: string;
  onSelect: () => void;
}) {
  const {
    state,
    assignableCategories,
    toggleFavorite,
    setFamilyCategory,
  } = useFontLibrary();
  const entry = pickDefaultVariant(variants);
  const rowRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [faceReady, setFaceReady] = useState(false);

  const override = state.categoryOverrides[family] ?? "";
  const selectValue = override || "";

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const scrollRoot = el.closest("[data-font-list]");
    const observer = new IntersectionObserver(
      ([item]) => {
        if (item?.isIntersecting) setVisible(true);
      },
      {
        root: scrollRoot instanceof Element ? scrollRoot : null,
        rootMargin: "160px 0px",
        threshold: 0.01,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    void entry
      .ensureFontFace()
      .then(() => {
        if (!cancelled) setFaceReady(true);
      })
      .catch(() => {
        if (!cancelled) setFaceReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, entry.id, entry]);

  const usingFace = faceReady && entry.getFontFace() !== null;

  return (
    <div
      ref={rowRef}
      className={[
        "group flex items-center gap-0.5 rounded-md transition-colors",
        active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-muted)]",
      ].join(" ")}
    >
      <button
        type="button"
        aria-label={isFavorite ? `Unfavorite ${family}` : `Favorite ${family}`}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(family);
        }}
        className={[
          "shrink-0 px-1.5 py-1.5 text-sm leading-none transition-colors",
          // Prefer a quieter solid token over opacity — opacity sinks icon contrast below 3:1.
          isFavorite
            ? "text-[var(--accent-strong)]"
            : "text-[var(--ink-faint)] hover:text-[var(--ink)]",
        ].join(" ")}
      >
        {isFavorite ? "★" : "☆"}
      </button>

      <button
        type="button"
        onClick={onSelect}
        title={family}
        className={[
          "min-w-0 flex-1 truncate py-1.5 pr-1 text-left text-[15px] leading-snug",
          active
            ? "font-medium text-[var(--accent-strong)]"
            : "text-[var(--ink)]",
        ].join(" ")}
        style={
          usingFace
            ? {
                fontFamily: `"${entry.cssFamily}", var(--font-ui), sans-serif`,
                fontWeight: "normal",
                fontStyle: "normal",
              }
            : undefined
        }
      >
        {family}
      </button>

      <label className="sr-only" htmlFor={`cat-${family}`}>
        Category for {family}
      </label>
      <select
        id={`cat-${family}`}
        value={selectValue}
        title="Move to category"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const value = e.target.value;
          setFamilyCategory(family, value || null);
        }}
        className="mr-1 max-w-[4.75rem] shrink-0 cursor-pointer truncate rounded border border-transparent bg-transparent py-0.5 text-[10px] text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 focus:border-[var(--border)] focus:opacity-100"
      >
        <option value="">Auto ({autoCategory})</option>
        {assignableCategories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    </div>
  );
}
