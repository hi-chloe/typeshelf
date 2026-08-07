import type { Category, FontEntry } from "./types";

/**
 * IBM OS/2 sFamilyClass high-byte → category.
 * @see https://learn.microsoft.com/en-us/typography/opentype/spec/ibmfc
 */
const FAMILY_CLASS_MAP: Record<number, Category> = {
  1: "Serif", // Oldstyle Serifs
  2: "Serif", // Transitional Serifs
  3: "Serif", // Modern Serifs
  4: "Serif", // Clarendon Serifs
  5: "Serif", // Slab Serifs
  7: "Serif", // Freeform Serifs
  8: "Sans-serif",
  9: "Display", // Ornamentals
  10: "Script",
  12: "Other", // Symbolic
};

/**
 * PANOSE Family Kind (panose[0]) that is definitive on its own.
 * Latin Text (2) is handled separately via Serif Style (panose[1]).
 */
function classifyFromPanoseFamilyKind(
  panose: number[] | null,
): Category | null {
  if (!panose || panose.length < 1) return null;
  const kind = panose[0] ?? 0;
  if (kind === 3) return "Script"; // Latin Hand Written
  if (kind === 4) return "Display"; // Latin Decorative
  if (kind === 5) return "Other"; // Latin Symbol
  return null;
}

/**
 * PANOSE Latin Text: Serif Style digit (panose[1]).
 *   2–10 → serif shapes
 *   11–15 → sans shapes (incl. Flared/Rounded)
 * Family Kind must be 2 (Latin Text).
 */
function classifyFromPanoseLatinText(
  panose: number[] | null,
): Category | null {
  if (!panose || panose.length < 2) return null;
  if ((panose[0] ?? 0) !== 2) return null;

  const serifStyle = panose[1] ?? 0;
  if (serifStyle >= 11 && serifStyle <= 15) return "Sans-serif";
  if (serifStyle >= 2 && serifStyle <= 10) return "Serif";
  return null;
}

function classifyFromFamilyClass(
  familyClassByte: number | null,
  only?: ReadonlySet<number>,
): Category | null {
  if (familyClassByte == null || familyClassByte === 0) return null;
  if (only && !only.has(familyClassByte)) return null;
  return FAMILY_CLASS_MAP[familyClassByte] ?? null;
}

/** IBM classes that shouldn't be overridden by Latin Text panose. */
const ORNAMENTAL_IBM_CLASSES = new Set([9, 12]); // Ornamentals, Symbolic

function classifyFromNameKeywords(family: string): Category | null {
  const name = family.toLowerCase();

  if (
    /\bmono(space)?\b/.test(name) ||
    /\bcode\b/.test(name) ||
    /\bcourier\b/.test(name) ||
    /\bconsolas\b/.test(name) ||
    /\bfira\s*code\b/.test(name) ||
    /\bjetbrains\b/.test(name) ||
    /\bsource\s*code\b/.test(name)
  ) {
    return "Monospace";
  }

  if (
    /\bscript\b/.test(name) ||
    /\bhand(writing|written)?\b/.test(name) ||
    /\bcursive\b/.test(name) ||
    /\bcalligraphy\b/.test(name)
  ) {
    return "Script";
  }

  if (
    /\bdisplay\b/.test(name) ||
    /\bdecorative\b/.test(name) ||
    /\bornament/.test(name) ||
    /\bbanner\b/.test(name) ||
    /\bcopperplate\b/.test(name)
  ) {
    return "Display";
  }

  if (
    /\bsans([- ]?serif)?\b/.test(name) ||
    /\bgothic\b/.test(name) ||
    /\bgrotesk\b/.test(name) ||
    /\bgrotesque\b/.test(name)
  ) {
    return "Sans-serif";
  }

  if (/\bserif\b/.test(name) || /\bslab\b/.test(name)) {
    return "Serif";
  }

  return null;
}

/**
 * Priority (Serif/Sans accuracy + ornamental display faces):
 * 1. post.isFixedPitch → Monospace
 * 2. PANOSE family kind Hand Written / Decorative / Symbol
 * 3. IBM Ornamental (9) / Symbolic (12) → Display / Other
 *    (e.g. Cooper Black, Castellar, Copperplate Gothic)
 * 4. PANOSE Latin Text serif-style → Serif / Sans-serif
 * 5. Remaining IBM sFamilyClass (including Script)
 * 6. Name keywords
 * 7. Other
 */
export function classifyFont(
  entry: Pick<
    FontEntry,
    "isFixedPitch" | "familyClassByte" | "panose" | "family"
  >,
): Category {
  if (entry.isFixedPitch) return "Monospace";

  const fromPanoseKind = classifyFromPanoseFamilyKind(entry.panose);
  if (fromPanoseKind) return fromPanoseKind;

  const fromOrnamental = classifyFromFamilyClass(
    entry.familyClassByte,
    ORNAMENTAL_IBM_CLASSES,
  );
  if (fromOrnamental) return fromOrnamental;

  const fromLatinText = classifyFromPanoseLatinText(entry.panose);
  if (fromLatinText) return fromLatinText;

  const fromClass = classifyFromFamilyClass(entry.familyClassByte);
  if (fromClass) return fromClass;

  return classifyFromNameKeywords(entry.family) ?? "Other";
}
