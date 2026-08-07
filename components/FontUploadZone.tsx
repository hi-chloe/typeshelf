"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { useFontLibrary } from "@/lib/FontLibraryContext";
import { parseFontFiles } from "@/lib/fontParsing";

export function FontUploadZone() {
  const { addFonts, setLoading, state } = useFontLibrary();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setLoading(true);
      try {
        const { fonts, warnings } = await parseFontFiles(files);
        addFonts(fonts, warnings);
      } finally {
        setLoading(false);
      }
    },
    [addFonts, setLoading],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer.files?.length) {
        void handleFiles(event.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={[
        "cursor-pointer rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
        isDragging
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--ink-muted)]",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,.ttc"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-sm font-medium text-[var(--ink)]">
        {state.isLoading ? "Parsing fontsΓÇª" : "Drop font files here"}
      </p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        or click to browse ┬╖ TTF, OTF, WOFF, WOFF2, TTC
      </p>
    </div>
  );
}
