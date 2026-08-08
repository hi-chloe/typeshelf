#!/usr/bin/env node
/**
 * Design-system guardrails.
 *
 * Encodes three rules that regress silently and are near-invisible in review.
 * Each exists because it has already been broken once in this repo.
 *
 * Run: npm run guardrails
 *
 * Escape hatch: put `allow-color-literal: <reason>` in a comment on the offending
 * line OR on either of the two lines above it.
 */

import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const TARGET_GLOBS = ["components/**/*.tsx", "app/**/*.tsx", "lib/**/*.tsx"];

/** Files that legitimately cannot use CSS custom properties. */
const COLOR_EXEMPT_FILES = new Set([
  // Renders when the root layout threw, so globals.css may never have loaded.
  "app/global-error.tsx",
  // Satori (next/og) has no CSS custom property support.
  "app/opengraph-image.tsx",
]);

const PALETTE =
  "white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const RULES = [
  {
    id: "no-palette-classes",
    message:
      "Tailwind palette class found. Use a CSS custom property from app/globals.css.",
    test: (line) =>
      new RegExp(
        `(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|outline|decoration|divide|accent|caret)-(?:${PALETTE})-[0-9]{2,3}`,
      ).test(line),
  },
  {
    id: "no-color-literals",
    message:
      "Raw color literal found. Add a token to app/globals.css, or annotate with `allow-color-literal: <reason>`.",
    test: (line) => /rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/.test(line),
    allowAnnotation: "allow-color-literal",
    exemptFiles: COLOR_EXEMPT_FILES,
  },
  {
    id: "no-interpolated-ids",
    message:
      "DOM id built from a template literal. Use useId() — ids derived from font data collide when a family renders in two sections.",
    test: (line) => /id=\{`[^`]*\$\{/.test(line),
  },
];

function filesToCheck() {
  const seen = new Set();
  for (const pattern of TARGET_GLOBS) {
    for (const file of globSync(pattern)) seen.add(file.replaceAll("\\", "/"));
  }
  return [...seen].sort();
}

const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;

/**
 * True when the line itself, or any line in the contiguous comment block directly
 * above it, carries the annotation. Walking the whole block (rather than a fixed
 * lookback) means a multi-line justification works wherever the annotation sits
 * inside it — which is how people actually write these.
 */
function isAnnotated(lines, index, annotation) {
  if (!annotation) return false;
  if (lines[index]?.includes(annotation)) return true;

  for (let i = index - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line === undefined || !COMMENT_LINE.test(line)) break;
    if (line.includes(annotation)) return true;
  }
  return false;
}

let failures = 0;

for (const file of filesToCheck()) {
  const lines = readFileSync(file, "utf8").split("\n");

  for (const rule of RULES) {
    if (rule.exemptFiles?.has(file)) continue;

    lines.forEach((line, index) => {
      if (!rule.test(line)) return;
      if (isAnnotated(lines, index, rule.allowAnnotation)) return;

      failures += 1;
      const location = `${file}:${index + 1}`;
      console.error(`\n✗ [${rule.id}] ${location}`);
      console.error(`  ${line.trim()}`);
      console.error(`  ${rule.message}`);
      if (process.env.GITHUB_ACTIONS) {
        console.log(
          `::error file=${file},line=${index + 1}::[${rule.id}] ${rule.message}`,
        );
      }
    });
  }
}

if (failures > 0) {
  console.error(`\n${failures} guardrail violation(s).\n`);
  process.exit(1);
}

console.log("✓ Guardrails clean.");
