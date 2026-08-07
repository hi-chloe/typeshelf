"use client";

import { useCallback, useEffect, useState } from "react";
import { useFontLibrary } from "@/lib/FontLibraryContext";
import { parseLocalSystemFonts } from "@/lib/fontParsing";

export function SystemFontBanner() {
  const { state, dismissBanner, addFonts, setLoading, setLoadProgress } =
    useFontLibrary();
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "queryLocalFonts" in window);
  }, []);

  const loadSystemFonts = useCallback(async () => {
    if (!window.queryLocalFonts) return;
    setError(null);
    setLoading(true);
    setLoadProgress({ done: 0, total: 0 });
    try {
      const localFonts = await window.queryLocalFonts();
      setLoadProgress({ done: 0, total: localFonts.length });

      const { fonts, warnings } = await parseLocalSystemFonts(
        localFonts,
        (progress) => {
          // Throttle React updates — every face would be too chatty.
          if (
            progress.done === 0 ||
            progress.done === progress.total ||
            progress.done % 10 === 0
          ) {
            setLoadProgress(progress);
          }
        },
      );
      addFonts(fonts, warnings);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not access installed fonts.";
      const isOom = /out of memory/i.test(message);
      setError(
        isOom
          ? "Chrome ran out of memory while reading installed fonts. Reload the page and try again."
          : message,
      );
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
  }, [addFonts, setLoadProgress, setLoading]);

  if (!supported || state.systemBannerDismissed) return null;

  const progress = state.loadProgress;
  const progressLabel =
    state.isLoading && progress && progress.total > 0
      ? `Cataloging ${progress.done}/${progress.total}…`
      : state.isLoading
        ? "Reading installed fonts…"
        : null;

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-muted)]">
      <div className="min-w-0 flex-1">
        <p>
          Chrome/Edge can load fonts already installed on this device.{" "}
          <button
            type="button"
            onClick={() => void loadSystemFonts()}
            disabled={state.isLoading}
            className="font-medium text-[var(--accent)] underline-offset-2 hover:underline disabled:opacity-50"
          >
            Load my installed fonts
          </button>
        </p>
        <div aria-live="polite" aria-atomic="true">
          {progressLabel ? (
            <p className="mt-1 text-[var(--ink-muted)]">{progressLabel}</p>
          ) : null}
        </div>
        <div aria-live="assertive" aria-atomic="true">
          {error ? <p className="mt-1 text-[var(--warn)]">{error}</p> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={dismissBanner}
        aria-label="Dismiss system fonts banner"
        className="shrink-0 text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        Dismiss
      </button>
    </div>
  );
}
