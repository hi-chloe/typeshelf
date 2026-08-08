"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Typeshelf parses arbitrary binary files handed over by the user, so a throw
 * during render is the highest-probability failure in the app. Without this the
 * whole page white-screens and the user has no way back except a manual reload.
 *
 * Recovery is genuinely possible here: fonts are held in memory, so `reset()`
 * re-renders the tree and the library survives. Only the offending render is lost.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the browser console; swap for a reporter if one is ever added.
    console.error("Typeshelf render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div
        role="alert"
        className="max-w-md rounded-xl border border-[var(--warn-border)] bg-[var(--warn-soft)] p-5"
      >
        <h1 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
          Something broke while rendering
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          This is usually a malformed or unsupported font file. Your library is
          held in memory, so trying again often works — if it doesn&rsquo;t,
          reload and skip the last font you added.
        </p>
        {error.message ? (
          <p className="mt-3 break-words rounded-md border border-[var(--warn-border)] bg-[var(--preview-bg)] px-2.5 py-2 font-mono text-xs text-[var(--warn-strong)]">
            {error.message}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-[var(--accent-strong)] px-3 py-1.5 text-sm font-medium text-[var(--on-accent)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--warn-soft)]"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-[var(--border)] bg-[var(--preview-bg)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--warn-soft)]"
          >
            Reload the page
          </button>
        </div>
      </div>
    </div>
  );
}
