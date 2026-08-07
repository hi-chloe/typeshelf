"use client";

import { useEffect, useState } from "react";
import { VariantChips } from "./VariantChips";
import { useFontLibrary } from "@/lib/FontLibraryContext";
import { pinResidentFace } from "@/lib/fontParsing";

export function PreviewPane() {
  const {
    state,
    selectedFont,
    setPreviewText,
    setFontSize,
    setLetterSpacing,
  } = useFontLibrary();

  const [faceReady, setFaceReady] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);

  useEffect(() => {
    pinResidentFace(selectedFont?.id ?? null);
    return () => {
      pinResidentFace(null);
    };
  }, [selectedFont?.id]);

  useEffect(() => {
    if (!selectedFont) {
      setFaceReady(false);
      setFaceError(null);
      return;
    }

    let cancelled = false;
    setFaceReady(false);
    setFaceError(null);

    void selectedFont
      .ensureFontFace()
      .then(() => {
        if (!cancelled) setFaceReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFaceError(
          err instanceof Error ? err.message : "Could not load font preview.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFont]);

  const letterSpacingEm = state.letterSpacingPercent / 100;

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 p-4 md:p-8">
      {!selectedFont ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="max-w-sm text-center text-[var(--ink-muted)]">
            Select a font family from the library, or upload files to preview
            sample text with live size and spacing controls.
          </p>
        </div>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                Preview
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
                {selectedFont.family}
              </h2>
              <p className="text-sm text-[var(--ink-muted)]">
                {selectedFont.style}
                <span className="mx-1.5 text-[var(--border)]">·</span>
                weight {selectedFont.weightClass}
                <span className="mx-1.5 text-[var(--border)]">·</span>
                {selectedFont.source}
              </p>
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--ink-muted)]">
                <span>Size</span>
                <span>{state.fontSize}px</span>
              </div>
              <input
                type="range"
                min={12}
                max={120}
                step={1}
                value={state.fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </label>
            <label className="block">
              <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--ink-muted)]">
                <span>Letter spacing</span>
                <span>
                  {state.letterSpacingPercent > 0 ? "+" : ""}
                  {state.letterSpacingPercent}%
                </span>
              </div>
              <input
                type="range"
                min={-5}
                max={20}
                step={0.5}
                value={state.letterSpacingPercent}
                onChange={(e) => setLetterSpacing(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Sample text
            </span>
            <textarea
              value={state.previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <div className="relative min-h-[200px] flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--preview-bg)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
            {faceError ? (
              <p className="text-sm text-[var(--warn)]">{faceError}</p>
            ) : !faceReady ? (
              <p className="text-sm text-[var(--ink-muted)]">Loading face…</p>
            ) : (
              <p
                style={{
                  fontFamily: `"${selectedFont.cssFamily}"`,
                  fontSize: `${state.fontSize}px`,
                  letterSpacing: `${letterSpacingEm}em`,
                  fontWeight: "normal",
                  fontStyle: "normal",
                  lineHeight: 1.35,
                  color: "var(--ink)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {state.previewText || "\u00A0"}
              </p>
            )}
          </div>

          <VariantChips />
        </>
      )}
    </main>
  );
}
