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

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Move focus to the next/previous tab stop after a menu unmounts under Tab. */
function focusAdjacent(
  from: HTMLElement | null,
  direction: "forward" | "backward",
) {
  if (!from || typeof document === "undefined") return;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => {
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    // offsetParent is null for fixed/hidden; keep fixed-position menus' siblings.
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  });
  const index = candidates.indexOf(from);
  if (index < 0) return;
  const next =
    direction === "forward" ? candidates[index + 1] : candidates[index - 1];
  next?.focus();
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

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    const restoreFocus = opts?.restoreFocus !== false;
    setMenuOpen(false);
    setMenuPos(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const closeFromOutsidePointer = useCallback(() => {
    const focusInside = Boolean(
      menuRef.current?.contains(document.activeElement),
    );
    setMenuOpen(false);
    setMenuPos(null);
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

  const toggleMenu = useCallback(() => {
    if (menuOpen) {
      closeMenu({ restoreFocus: false });
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
  }, [menuOpen, selectedIndex, closeMenu]);

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
      closeFromOutsidePointer();
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu, closeFromOutsidePointer]);

  // Close on list scroll so a fixed menu doesn't orphan from its row.
  useEffect(() => {
    if (!menuOpen) return;
    const root = rowRef.current?.closest("[data-font-list]");
    if (!root) return;
    const onScroll = () => {
      closeMenu({ restoreFocus: true });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [menuOpen, closeMenu]);

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
  // Tab closes without restoring — APG: Tab moves to the next page stop and closes.
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
      case "Tab": {
        // Menu unmounts on close — without relocating first, focus dumps to <body>.
        // Restore to the trigger, then step once in the Tab direction (APG).
        event.preventDefault();
        const direction = event.shiftKey ? "backward" : "forward";
        closeMenu({ restoreFocus: true });
        requestAnimationFrame(() => {
          focusAdjacent(triggerRef.current, direction);
        });
        break;
      }
      case " ":
      case "Enter": {
        event.preventDefault();
        const opt = options[focusIndex];
        if (opt) {
          setFamilyCategory(family, opt.value || null);
          closeMenu({ restoreFocus: true });
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
        aria-controls={menuOpen ? menuId : undefined}
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
                  closeMenu({ restoreFocus: true });
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
