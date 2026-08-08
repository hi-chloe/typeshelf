"use client";

import { useId, useState, type ReactNode } from "react";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={[
        "h-2.5 w-2.5 shrink-0",
        "motion-safe:transition-transform motion-safe:duration-150",
        open ? "rotate-180" : "rotate-0",
      ].join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

/**
 * Collapsible sidebar footer section.
 *
 * Disclosure pattern rather than a <details> element: <details> can't animate
 * its own open state and ships inconsistent default markers across browsers,
 * both of which we'd immediately override.
 *
 * Collapsed content is UNMOUNTED, not hidden. Visually-hidden-but-focusable
 * content is a keyboard trap — you tab into a control you cannot see. Unmounting
 * keeps the tab order honest.
 */
export function SidebarSection({
  label,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      onOpenChange?.(next);
      return next;
    });
  };

  return (
    <div className="border-t border-[var(--border)] pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
        className={[
          "flex min-h-6 w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left outline-none",
          "text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]",
          "transition-colors hover:text-[var(--ink)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]",
        ].join(" ")}
      >
        <span>{label}</span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div id={contentId} className="pt-1.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
