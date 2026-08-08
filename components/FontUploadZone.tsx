"use client";

import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { useFontLibrary } from "@/lib/FontLibraryContext";
import { parseFontFiles } from "@/lib/fontParsing";

export function FontUploadZone() {
  const { addFonts, setLoading, state } = useFontLibrary();
  const inputRef = useRef<HTMLInputElement>(null);
  const parsingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const statusId = useId();
  const busy = state.isLoading;

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0 || parsingRef.current) return;

      parsingRef.current = true;
      setLoading(true);
      setStatus("Parsing fonts…");
      try {
        const { fonts, warnings } = await parseFontFiles(files);
        addFonts(fonts, warnings);
        setStatus(
          fonts.length === 0
            ? "No fonts were added."
            : `Added ${fonts.length} font${fonts.length === 1 ? "" : "s"}.`,
        );
      } finally {
        parsingRef.current = false;
        setLoading(false);
      }
    },
    [addFonts, setLoading],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (parsingRef.current || busy) return;
      if (event.dataTransfer.files?.length) {
        void handleFiles(event.dataTransfer.files);
      }
    },
    [busy, handleFiles],
  );

  const activate = () => {
    if (parsingRef.current || busy) return;
    inputRef.current?.click();
  };

  return (
    <div>
      {/* Hoisted outside role="button" — nested interactive content is invalid. */}
      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,.ttc"
        multiple
        tabIndex={-1}
        className="sr-only"
        aria-label="Upload font files"
        disabled={busy}
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        aria-describedby={statusId}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!busy) setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsDragging(false);
        }}
        onDrop={onDrop}
        onClick={activate}
        className={[
          "rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
          busy ? "cursor-wait opacity-70" : "cursor-pointer",
          isDragging
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--ink-muted)]",
        ].join(" ")}
      >
        <p className="text-sm font-medium text-[var(--ink)]">
          {busy ? "Parsing fonts…" : "Drop font files here"}
        </p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          or click to browse · TTF, OTF, WOFF, WOFF2, TTC · max 20MB · 200/batch
        </p>
      </div>
      <p id={statusId} aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
