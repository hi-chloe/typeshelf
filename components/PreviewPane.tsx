"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { PreviewColorMenu, type ColorPreset } from "./PreviewColorMenu";
import { VariantChips } from "./VariantChips";
import {
  FONT_SIZE_HARD_MAX,
  FONT_SIZE_HARD_MIN,
  FONT_SIZE_SLIDER_MAX,
  FONT_SIZE_SLIDER_MIN,
  LETTER_SPACING_HARD_MAX,
  LETTER_SPACING_HARD_MIN,
  LETTER_SPACING_SLIDER_MAX,
  LETTER_SPACING_SLIDER_MIN,
  useFontLibrary,
} from "@/lib/FontLibraryContext";
import {
  contrastGrade,
  contrastRatio,
  normalizeHex,
  parseCssColorToRgb,
  resolveCssColor,
  type ContrastGrade,
} from "@/lib/colorContrast";
import { pinResidentFace } from "@/lib/fontParsing";

const TEXT_COLOR_PRESETS: readonly ColorPreset[] = [
  { id: "ink", label: "Ink", css: "var(--ink)", followsTheme: true },
  { id: "muted", label: "Muted", css: "var(--ink-muted)" },
  { id: "accent", label: "Accent", css: "var(--accent-strong)" },
  { id: "paper", label: "Paper", css: "var(--preview-bg)" },
];

const BG_COLOR_PRESETS: readonly ColorPreset[] = [
  {
    id: "preview",
    label: "Preview",
    css: "var(--preview-bg)",
    followsTheme: true,
  },
  { id: "surface", label: "Surface", css: "var(--surface)" },
  { id: "background", label: "Background", css: "var(--background)" },
  { id: "ink", label: "Ink", css: "var(--ink)" },
];

function formatSize(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function formatSpacing(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function isPartialNumber(value: string): boolean {
  return value === "" || /^-?\d*\.?\d*$/.test(value);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function WarningIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.5 14 13.5H2L8 2.5Z" />
      <path d="M8 6.5v3" />
      <circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PreviewPane() {
  const {
    state,
    selectedFont,
    setPreviewText,
    setFontSize,
    setLetterSpacing,
    setPreviewColor,
    setPreviewBgColor,
  } = useFontLibrary();

  const [readyForId, setReadyForId] = useState<string | null>(null);
  const [faceError, setFaceError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  /** Live overrides while a color menu is dragging — skips the reducer. */
  const [liveFg, setLiveFg] = useState<string | null>(null);
  const [liveBg, setLiveBg] = useState<string | null>(null);

  const fontId = selectedFont?.id ?? null;
  const faceReady = fontId !== null && readyForId === fontId;
  const faceErrorMessage =
    faceError && fontId !== null && faceError.id === fontId
      ? faceError.message
      : null;

  useEffect(() => {
    pinResidentFace(selectedFont?.id ?? null);
    return () => {
      pinResidentFace(null);
    };
  }, [selectedFont?.id]);

  useEffect(() => {
    if (!selectedFont) return;

    let cancelled = false;

    void selectedFont
      .ensureFontFace()
      .then(() => {
        if (!cancelled) setReadyForId(selectedFont.id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFaceError({
          id: selectedFont.id,
          message:
            err instanceof Error ? err.message : "Could not load font preview.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFont]);

  const letterSpacingEm = state.letterSpacingPercent / 100;

  const textColor =
    liveFg ?? state.previewColor ?? "var(--ink)";
  const bgColor =
    liveBg ?? state.previewBgColor ?? "var(--preview-bg)";

  const onLiveFg = useCallback((color: string | null) => {
    setLiveFg(color);
  }, []);
  const onLiveBg = useCallback((color: string | null) => {
    setLiveBg(color);
  }, []);

  const contrast = usePreviewContrast(textColor, bgColor);
  const contrastId = useId();

  return (
    <main
      id="preview-pane"
      tabIndex={-1}
      aria-label="Font preview"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 p-4 md:p-8"
    >
      {!selectedFont ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="max-w-sm text-center text-[var(--ink-muted)]">
            Select a font family from the library, or upload fonts to preview
            sample text with live size and spacing controls.
          </p>
        </div>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1 basis-[12rem]">
              <p className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                Preview
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
                {selectedFont.family}
              </h2>
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-[var(--ink-muted)]">
                <span>{selectedFont.style}</span>
                <span>weight {selectedFont.weightClass}</span>
                <span>{selectedFont.source}</span>
              </p>
            </div>
            {/*
              Full-width basis on small screens so chips drop under the identity
              block; on md+ they sit as a constrained column on the right.
            */}
            <div className="min-w-0 basis-full md:basis-auto md:max-w-md">
              <VariantChips />
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetricControl
              label="Size"
              sliderName="Font size, slider"
              numberName="Font size, exact value"
              unit="px"
              value={state.fontSize}
              onCommit={setFontSize}
              sliderMin={FONT_SIZE_SLIDER_MIN}
              sliderMax={FONT_SIZE_SLIDER_MAX}
              hardMin={FONT_SIZE_HARD_MIN}
              hardMax={FONT_SIZE_HARD_MAX}
              sliderStep={1}
              formatValue={formatSize}
            />
            <MetricControl
              label="Letter spacing"
              sliderName="Letter spacing, slider"
              numberName="Letter spacing, exact value"
              unit="%"
              value={state.letterSpacingPercent}
              onCommit={setLetterSpacing}
              sliderMin={LETTER_SPACING_SLIDER_MIN}
              sliderMax={LETTER_SPACING_SLIDER_MAX}
              hardMin={LETTER_SPACING_HARD_MIN}
              hardMax={LETTER_SPACING_HARD_MAX}
              sliderStep={0.5}
              formatValue={formatSpacing}
            />
          </div>

          <div className="space-y-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Sample text
              </span>
              <textarea
                value={state.previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                rows={2}
                className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <PreviewColorMenu
                label="Text"
                value={state.previewColor}
                themeCss="var(--ink)"
                presets={TEXT_COLOR_PRESETS}
                onChange={setPreviewColor}
                onLiveChange={onLiveFg}
                aria-describedby={contrast ? contrastId : undefined}
              />
              <PreviewColorMenu
                label="Background"
                value={state.previewBgColor}
                themeCss="var(--preview-bg)"
                presets={BG_COLOR_PRESETS}
                onChange={setPreviewBgColor}
                onLiveChange={onLiveBg}
                aria-describedby={contrast ? contrastId : undefined}
              />
              {contrast ? (
                <span
                  id={contrastId}
                  className="text-[11px] tabular-nums text-[var(--ink-muted)]"
                >
                  {contrast.label}
                </span>
              ) : null}
            </div>

            <div aria-live="polite" aria-atomic="true">
              {contrast?.belowAa ? (
                <p className="flex items-center gap-1.5 text-[11px] text-[var(--warn-strong)]">
                  <WarningIcon />
                  <span>
                    Low contrast ({contrast.label}) — specimen may be hard to
                    read
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <div
            className="relative min-h-[200px] flex-1 overflow-auto rounded-xl border border-[var(--border)] p-6 shadow-[inset_0_1px_0_var(--inset-highlight)]"
            style={{ background: bgColor }}
          >
            <div aria-live="polite" aria-atomic="true">
              {faceErrorMessage ? (
                <p className="text-sm text-[var(--warn-strong)]">
                  {faceErrorMessage}
                </p>
              ) : !faceReady ? (
                <p className="text-sm text-[var(--ink-muted)]">Loading face…</p>
              ) : null}
            </div>
            {faceReady && !faceErrorMessage ? (
              <p
                style={{
                  fontFamily: `"${selectedFont.cssFamily}"`,
                  fontSize: `${state.fontSize}px`,
                  letterSpacing: `${letterSpacingEm}em`,
                  fontWeight: "normal",
                  fontStyle: "normal",
                  lineHeight: 1.35,
                  color: textColor,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {state.previewText || "\u00A0"}
              </p>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}

type ContrastInfo = {
  ratio: number;
  grade: ContrastGrade;
  belowAa: boolean;
  label: string;
} | null;

function resolvePaintColor(cssOrHex: string): string | null {
  if (cssOrHex.startsWith("#")) return normalizeHex(cssOrHex);
  return resolveCssColor(cssOrHex);
}

function usePreviewContrast(fgCss: string, bgCss: string): ContrastInfo {
  const [info, setInfo] = useState<ContrastInfo>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const fgHex = resolvePaintColor(fgCss);
      const bgHex = resolvePaintColor(bgCss);
      if (!fgHex || !bgHex) {
        setInfo(null);
        return;
      }
      const fg = parseCssColorToRgb(fgHex);
      const bg = parseCssColorToRgb(bgHex);
      if (!fg || !bg) {
        setInfo(null);
        return;
      }
      const ratio = contrastRatio(fg, bg);
      const grade = contrastGrade(ratio);
      setInfo({
        ratio,
        grade,
        belowAa: ratio < 4.5,
        label: `${ratio.toFixed(1)}:1 · ${grade}`,
      });
    };

    const schedule = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        measure();
      });
    };

    schedule();

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-scheme", "data-mode"],
    });

    return () => {
      obs.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [fgCss, bgCss]);

  return info;
}

function MetricControl({
  label,
  sliderName,
  numberName,
  unit,
  value,
  onCommit,
  sliderMin,
  sliderMax,
  hardMin,
  hardMax,
  sliderStep,
  formatValue,
}: {
  label: string;
  sliderName: string;
  numberName: string;
  unit: string;
  value: number;
  onCommit: (n: number) => void;
  sliderMin: number;
  sliderMax: number;
  hardMin: number;
  hardMax: number;
  sliderStep: number;
  formatValue: (n: number) => string;
}) {
  const sliderId = useId();
  const numberId = useId();
  const rangeId = useId();
  const [draft, setDraft] = useState(formatValue(value));
  const [focused, setFocused] = useState(false);
  const [prevValue, setPrevValue] = useState(value);
  const skipCommitRef = useRef(false);

  if (!focused && value !== prevValue) {
    setPrevValue(value);
    setDraft(formatValue(value));
  } else if (value !== prevValue) {
    setPrevValue(value);
  }

  const commitDraft = () => {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatValue(value));
      return;
    }
    const next = clamp(parsed, hardMin, hardMax);
    onCommit(next);
    setDraft(formatValue(next));
  };

  const sliderValue = clamp(value, sliderMin, sliderMax);

  return (
    <div className="block">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[var(--ink-muted)]">
        <span>{label}</span>
        <div className="flex items-center gap-1">
          <input
            id={numberId}
            type="text"
            inputMode="decimal"
            aria-label={`${numberName} (${unit})`}
            aria-describedby={rangeId}
            value={draft}
            onFocus={() => setFocused(true)}
            onChange={(e) => {
              const next = e.target.value;
              if (isPartialNumber(next)) setDraft(next);
            }}
            onBlur={() => {
              setFocused(false);
              if (skipCommitRef.current) {
                skipCommitRef.current = false;
                return;
              }
              commitDraft();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                skipCommitRef.current = true;
                setDraft(formatValue(value));
                (e.target as HTMLInputElement).blur();
              }
            }}
            className={[
              "h-6 min-h-6 w-14 rounded border border-[var(--border)] bg-[var(--preview-bg)] px-1.5 text-right text-xs tabular-nums text-[var(--ink)] outline-none",
              "focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]",
            ].join(" ")}
          />
          <span aria-hidden className="min-w-[1rem] text-[var(--ink-muted)]">
            {unit}
          </span>
          <span id={rangeId} className="sr-only">
            Allowed range {hardMin} to {hardMax}
            {unit}. Values outside this range are clamped.
          </span>
        </div>
      </div>
      <label htmlFor={sliderId} className="sr-only">
        {sliderName}
      </label>
      <input
        id={sliderId}
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={sliderStep}
        value={sliderValue}
        aria-label={sliderName}
        onChange={(e) => onCommit(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}
