"use client";

import { useFontLibrary } from "@/lib/FontLibraryContext";
import {
  parsePreferencesImport,
  stringifyPreferencesExport,
} from "@/lib/libraryPersistence";
import { useId, useRef, useState } from "react";

export function PreferencesBackup() {
  const { getPreferencesSnapshot, replacePreferences } = useFontLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const statusId = useId();

  const onExport = () => {
    try {
      const json = stringifyPreferencesExport(getPreferencesSnapshot());
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `typeshelf-settings-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Settings exported.");
    } catch {
      setStatus("Could not export settings.");
    }
  };

  const onPickImport = () => {
    fileInputRef.current?.click();
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const prefs = parsePreferencesImport(text);
      const ok = window.confirm(
        "Replace your current Typeshelf settings (favorites, categories, theme, and preview colors) with this file?",
      );
      if (!ok) {
        setStatus("Import cancelled.");
        return;
      }
      await replacePreferences(prefs);
      setStatus("Settings imported.");
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Could not import settings.",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5 border-t border-[var(--border)] pt-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        Settings
      </p>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={onExport}
          className={[
            "min-h-6 rounded-md border border-[var(--border)] bg-[var(--preview-bg)] px-1.5 py-1 text-[11px] font-medium text-[var(--ink-muted)] outline-none",
            "hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]",
          ].join(" ")}
        >
          Export settings
        </button>
        <button
          type="button"
          onClick={onPickImport}
          className={[
            "min-h-6 rounded-md border border-[var(--border)] bg-[var(--preview-bg)] px-1.5 py-1 text-[11px] font-medium text-[var(--ink-muted)] outline-none",
            "hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]",
          ].join(" ")}
        >
          Import settings
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-describedby={statusId}
        onChange={(e) => void onImportFile(e.target.files?.[0])}
      />
      <p
        id={statusId}
        aria-live="polite"
        className="min-h-[1rem] text-[10px] text-[var(--ink-muted)]"
      >
        {status}
      </p>
    </div>
  );
}
