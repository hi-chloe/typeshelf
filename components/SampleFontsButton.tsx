"use client";

import { useCallback, useState } from "react";
import { useFontLibrary } from "@/lib/FontLibraryContext";
import { parseFontBlob } from "@/lib/fontParsing";

/**
 * First-run affordance: an empty library is a dead end for anyone arriving from
 * a link who has no font files to hand. Loads three OFL-licensed faces bundled
 * in /public/sample-fonts so the app has something to show immediately.
 *
 * These are Latin subsets (see public/sample-fonts/README.md) — small enough to
 * ship, deliberately not presented as complete fonts for design work.
 */
const SAMPLES = [
  { file: "Tinos-Regular.ttf", label: "Tinos" },
  { file: "Cousine-Regular.ttf", label: "Cousine" },
  { file: "Silkscreen-Regular.ttf", label: "Silkscreen" },
] as const;

export function SampleFontsButton() {
  const { addFonts, setLoading, state } = useFontLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSamples = useCallback(async () => {
    setBusy(true);
    setLoading(true);
    setError(null);

    try {
      const entries = [];
      const warnings: string[] = [];

      for (const sample of SAMPLES) {
        try {
          const res = await fetch(`sample-fonts/${sample.file}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const results = await parseFontBlob(blob, "sample", sample.file);
          for (const result of results) {
            entries.push(result.entry);
            if (result.warning) warnings.push(result.warning);
          }
        } catch (err) {
          warnings.push(
            `Could not load sample font ${sample.label}: ${
              err instanceof Error ? err.message : "unknown error"
            }`,
          );
        }
      }

      if (entries.length === 0) {
        setError("Sample fonts could not be loaded. Try uploading your own.");
        return;
      }
      addFonts(entries, warnings);
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }, [addFonts, setLoading]);

  // Once the library has anything in it, this affordance has done its job.
  if (state.fonts.length > 0) return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void loadSamples()}
        disabled={busy}
        className={[
          "w-full rounded-md border border-[var(--border)] bg-[var(--preview-bg)] px-2 py-1.5 text-xs font-medium text-[var(--ink)] transition-colors outline-none",
          "hover:border-[var(--accent)] disabled:opacity-70",
          "focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]",
        ].join(" ")}
      >
        {busy ? "Loading sample fonts…" : "Load 3 sample fonts"}
      </button>
      <div aria-live="polite" aria-atomic="true">
        {error ? (
          <p className="text-[10px] text-[var(--warn-strong)]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
