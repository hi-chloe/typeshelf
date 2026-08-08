"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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

function clampIndex(next: number, length: number) {
  return Math.max(0, Math.min(length - 1, next));
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
  const menuId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [visible, setVisible] = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );

  const override = state.categoryOverrides[family] ?? "";
  const selectValue = override || "";

  const options = useMemo(
    () => [
      { value: "", label: `Auto (${autoCategory})` },
      ...assignableCategories.map((cat) => ({ value: cat, label: cat })),
    ],
    [autoCategory, assignableCategories],
  );

  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === selectValue),
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuPos(null);
    triggerRef.current?.focus();
  }, []);

  const toggleMenu = useCallback(() => {
    if (menuOpen) {
      setMenuOpen(false);
      setMenuPos(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setFocusIndex(selectedIndex);
    setMenuOpen(true);
  }, [menuOpen, selectedIndex]);

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

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
      setMenuPos(null);
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
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
  }, [menuOpen, closeMenu]);

  // Close on list scroll so a fixed menu doesn't orphan from its row.
  useEffect(() => {
    if (!menuOpen) return;
    const root = rowRef.current?.closest("[data-font-list]");
    if (!root) return;
    const onScroll = () => {
      setMenuOpen(false);
      setMenuPos(null);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !menuPos) return;
    const frame = requestAnimationFrame(() => {
      itemRefs.current[focusIndex]?.focus();
    });
    return () => cancelAnimationFrame(frame);
    // Only land focus when the menu opens — not on every arrow move.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition
  }, [menuOpen, menuPos]);

  const moveFocus = (next: number) => {
    const clamped = clampIndex(next, options.length);
    setFocusIndex(clamped);
    itemRefs.current[clamped]?.focus();
  };

  // Menu pattern: arrows move focus; Enter/Space commits (unlike theme radiogroups).
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(focusIndex + 1);
        break;
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
        moveFocus(options.length - 1);
        break;
      case " ":
      case "Enter": {
        event.preventDefault();
        const opt = options[focusIndex];
        if (opt) {
          setFamilyCategory(family, opt.value || null);
          closeMenu();
        }
        break;
      }
      default:
        break;
    }
  };

  const usingFace = faceReady && entry.getFontFace() !== null;

  return (
    <div
      ref={rowRef}
      className={[
        "flex items-center gap-0.5 rounded-md transition-colors",
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

      <button
        ref={triggerRef}
        type="button"
        aria-label={`Move ${family} to category`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        title="Move to category"
        onClick={(e) => {
          e.stopPropagation();
          toggleMenu();
        }}
        className={[
          "mr-0.5 shrink-0 rounded px-1.5 py-1.5 text-sm leading-none outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]",
          menuOpen
            ? "text-[var(--ink)]"
            : "text-[var(--ink-faint)] hover:text-[var(--ink)]",
        ].join(" ")}
      >
        ⋯
      </button>

      {menuOpen && menuPos ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Category for ${family}`}
          style={{ top: menuPos.top, right: menuPos.right }}
          className="fixed z-50 min-w-[9.5rem] rounded-md border border-[var(--border)] bg-[var(--preview-bg)] py-1 shadow-[0_8px_24px_color-mix(in_srgb,var(--ink)_14%,transparent)]"
          onKeyDown={onMenuKeyDown}
        >
          {options.map((opt, index) => {
            const selected = opt.value === selectValue;
            return (
              <button
                key={opt.value || "__auto"}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={index === focusIndex ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  setFamilyCategory(family, opt.value || null);
                  closeMenu();
                }}
                onFocus={() => setFocusIndex(index)}
                className={[
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs outline-none",
                  "focus-visible:bg-[var(--accent-soft)] focus-visible:text-[var(--accent-strong)]",
                  "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-inset",
                  selected
                    ? "font-medium text-[var(--accent-strong)]"
                    : "text-[var(--ink)] hover:bg-[var(--surface-muted)]",
                ].join(" ")}
              >
                <span aria-hidden className="w-3 shrink-0 text-[10px]">
                  {selected ? "✓" : ""}
                </span>
                <span className="min-w-0 truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
