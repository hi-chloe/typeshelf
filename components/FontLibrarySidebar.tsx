"use client";

import { FontFamilyListItem } from "./FontFamilyListItem";
import { FontUploadZone } from "./FontUploadZone";
import { SystemFontBanner } from "./SystemFontBanner";
import {
  useFontLibrary,
  type LibrarySection,
} from "@/lib/FontLibraryContext";
import { useMemo, useState } from "react";

function CategorySection({
  section,
  open,
  onToggle,
}: {
  section: LibrarySection;
  open: boolean;
  onToggle: () => void;
}) {
  const { state, selectFamily, deleteCategory } = useFontLibrary();
  const isEmpty = section.families.length === 0;

  // Hide empty builtin sections; keep Favorites + custom visible.
  if (isEmpty && section.kind === "builtin") return null;
  if (
    isEmpty &&
    section.kind === "favorites" &&
    !state.searchQuery.trim() &&
    state.favorites.length === 0
  ) {
    // Still show Favorites once any fonts exist so the pin target is obvious.
  }

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
          aria-expanded={open}
        >
          <span className="truncate">
            {section.kind === "favorites" ? "★ " : ""}
            {section.label}{" "}
            <span className="font-normal normal-case tracking-normal">
              ({section.families.length})
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-[10px]">
            {open ? "▾" : "▸"}
          </span>
        </button>
        {section.kind === "custom" ? (
          <button
            type="button"
            title={`Delete category “${section.label}”`}
            aria-label={`Delete category ${section.label}`}
            onClick={() => deleteCategory(section.label)}
            className="shrink-0 px-1 text-[10px] text-[var(--ink-muted)] hover:text-[var(--warn-strong)]"
          >
            ×
          </button>
        ) : null}
      </div>
      {open ? (
        isEmpty ? (
          <p className="mb-2 px-2 pb-1 text-[11px] text-[var(--ink-muted)]">
            {section.kind === "favorites"
              ? "Star a family to pin it here."
              : "Assign fonts via the category menu on each row."}
          </p>
        ) : (
          <ul className="mb-2 space-y-0.5">
            {section.families.map((group) => (
              <li key={`${section.id}:${group.family}`}>
                <FontFamilyListItem
                  family={group.family}
                  variants={group.variants}
                  active={state.selectedFamily === group.family}
                  isFavorite={group.isFavorite}
                  autoCategory={group.autoCategory}
                  onSelect={() => selectFamily(group.family)}
                />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function FontLibrarySidebar() {
  const {
    state,
    sections,
    dismissWarning,
    clearWarnings,
    createCategory,
    setSearchQuery,
  } = useFontLibrary();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const isOpen = (id: string) => openSections[id] ?? true;

  const hasFonts = state.fonts.length > 0;

  const visibleSections = useMemo(() => {
    // When searching, skip empty sections entirely (including empty Favorites).
    if (state.searchQuery.trim()) {
      return sections.filter((s) => s.families.length > 0);
    }
    return sections;
  }, [sections, state.searchQuery]);

  const submitNewCategory = () => {
    const ok = createCategory(newCategoryName);
    if (!ok) {
      setCategoryError(
        "Use a unique name that isn’t Favorites or a built-in category.",
      );
      return;
    }
    setNewCategoryName("");
    setNewCategoryOpen(false);
    setCategoryError(null);
    const name = newCategoryName.trim().replace(/\s+/g, " ");
    setOpenSections((prev) => ({ ...prev, [name]: true }));
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col gap-3 border-r border-[var(--border)] bg-[var(--surface)] p-4 md:w-72 md:shrink-0 lg:w-80">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]">
          Typeshelf
        </h1>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
          Browse and preview local fonts
        </p>
      </div>

      <SystemFontBanner />
      <FontUploadZone />

      <div className="space-y-2">
        <label className="block">
          <span className="sr-only">Search fonts and categories</span>
          <input
            type="search"
            value={state.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fonts or categories…"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--preview-bg)] px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]"
          />
        </label>

        {!newCategoryOpen ? (
          <button
            type="button"
            onClick={() => {
              setNewCategoryOpen(true);
              setCategoryError(null);
            }}
            className="w-full rounded-md border border-dashed border-[var(--border)] px-2 py-1.5 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            + New category
          </button>
        ) : (
          <div className="space-y-1.5 rounded-md border border-[var(--border)] bg-[var(--preview-bg)] p-2">
            <input
              autoFocus
              type="text"
              value={newCategoryName}
              onChange={(e) => {
                setNewCategoryName(e.target.value);
                setCategoryError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNewCategory();
                }
                if (e.key === "Escape") {
                  setNewCategoryOpen(false);
                  setNewCategoryName("");
                  setCategoryError(null);
                }
              }}
              placeholder="Category name"
              className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
            {categoryError ? (
              <p className="text-[10px] text-[var(--warn-strong)]">{categoryError}</p>
            ) : null}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={submitNewCategory}
                className="rounded bg-[var(--accent-strong)] px-2 py-1 text-xs font-medium text-white"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCategoryOpen(false);
                  setNewCategoryName("");
                  setCategoryError(null);
                }}
                className="rounded px-2 py-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {state.warnings.length > 0 ? (
          <div className="space-y-1.5 rounded-md border border-[var(--warn-border)] bg-[var(--warn-soft)] p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[var(--warn-strong)]">
                Warnings
              </p>
              <button
                type="button"
                onClick={clearWarnings}
                className="text-[10px] text-[var(--warn-strong)] underline-offset-2 hover:underline"
              >
                Clear
              </button>
            </div>
            <ul className="max-h-28 space-y-1 overflow-y-auto">
              {state.warnings.map((w) => (
                <li
                  key={w.id}
                  className="flex items-start justify-between gap-2 text-xs text-[var(--warn-strong)]"
                >
                  <span className="min-w-0 flex-1 break-words">{w.message}</span>
                  <button
                    type="button"
                    aria-label="Dismiss warning"
                    onClick={() => dismissWarning(w.id)}
                    className="shrink-0 text-[var(--ink-muted)] hover:text-[var(--warn-strong)]"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div data-font-list className="min-h-0 flex-1 overflow-y-auto pr-1">
        {!hasFonts ? (
          <p className="px-1 py-6 text-center text-sm text-[var(--ink-muted)]">
            Your library is empty. Upload fonts to get started.
          </p>
        ) : visibleSections.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-[var(--ink-muted)]">
            No fonts match “{state.searchQuery.trim()}”.
          </p>
        ) : (
          visibleSections.map((section) => (
            <CategorySection
              key={section.id}
              section={section}
              open={isOpen(section.id)}
              onToggle={() =>
                setOpenSections((prev) => ({
                  ...prev,
                  [section.id]: !isOpen(section.id),
                }))
              }
            />
          ))
        )}
      </div>

      {hasFonts ? (
        <p className="text-[10px] text-[var(--ink-muted)]">
          {state.fonts.length} face{state.fonts.length === 1 ? "" : "s"} loaded
          {state.favorites.length > 0
            ? ` · ${state.favorites.length} favorite${state.favorites.length === 1 ? "" : "s"}`
            : ""}
          {state.customCategories.length > 0
            ? ` · ${state.customCategories.length} custom`
            : ""}
        </p>
      ) : null}
    </aside>
  );
}
