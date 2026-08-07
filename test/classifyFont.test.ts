import { describe, expect, it } from "vitest";
import { classifyFont } from "@/lib/classifyFont";
import type { FontEntry } from "@/lib/types";

type Case = {
  name: string;
  entry: Pick<
    FontEntry,
    "isFixedPitch" | "familyClassByte" | "panose" | "family"
  >;
  expected: ReturnType<typeof classifyFont>;
};

const cases: Case[] = [
  // 1. Fixed-pitch always wins
  {
    name: "fixed-pitch beats Latin Text sans panose and IBM sans class",
    entry: {
      isFixedPitch: true,
      familyClassByte: 8,
      panose: [2, 11, 5, 0, 0, 0, 0, 0, 0, 0],
      family: "Fancy Serif Display Script",
    },
    expected: "Monospace",
  },
  {
    name: "fixed-pitch beats Hand Written panose kind",
    entry: {
      isFixedPitch: true,
      familyClassByte: 10,
      panose: [3, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      family: "Whatever",
    },
    expected: "Monospace",
  },

  // 2. PANOSE Latin Text serif-style ranges
  {
    name: "Latin Text serif-style 2 (Cove) → Serif",
    entry: {
      isFixedPitch: false,
      familyClassByte: null,
      panose: [2, 2, 5, 0, 0, 0, 0, 0, 0, 0],
      family: "Unknown",
    },
    expected: "Serif",
  },
  {
    name: "Latin Text serif-style 10 (Triangle) → Serif",
    entry: {
      isFixedPitch: false,
      familyClassByte: 0,
      panose: [2, 10, 5, 0, 0, 0, 0, 0, 0, 0],
      family: "Unknown",
    },
    expected: "Serif",
  },
  {
    name: "Latin Text serif-style 11 (Normal Sans) → Sans-serif",
    entry: {
      isFixedPitch: false,
      familyClassByte: null,
      panose: [2, 11, 5, 0, 0, 0, 0, 0, 0, 0],
      family: "Unknown",
    },
    expected: "Sans-serif",
  },
  {
    name: "Latin Text serif-style 15 (Rounded) → Sans-serif",
    entry: {
      isFixedPitch: false,
      familyClassByte: null,
      panose: [2, 15, 5, 0, 0, 0, 0, 0, 0, 0],
      family: "Unknown",
    },
    expected: "Sans-serif",
  },
  {
    name: "Latin Text with Any/No Fit serif-style falls through to IBM class",
    entry: {
      isFixedPitch: false,
      familyClassByte: 1,
      panose: [2, 0, 5, 0, 0, 0, 0, 0, 0, 0],
      family: "Unknown",
    },
    expected: "Serif",
  },

  // 3. PANOSE family-kind overrides
  {
    name: "Hand Written family kind → Script",
    entry: {
      isFixedPitch: false,
      familyClassByte: 8,
      panose: [3, 15, 0, 0, 0, 0, 0, 0, 0, 0],
      family: "Unknown",
    },
    expected: "Script",
  },
  {
    name: "Decorative family kind → Display",
    entry: {
      isFixedPitch: false,
      familyClassByte: 8,
      panose: [4, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      family: "Unknown",
    },
    expected: "Display",
  },
  {
    name: "Symbol family kind → Other",
    entry: {
      isFixedPitch: false,
      familyClassByte: 8,
      panose: [5, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      family: "Unknown",
    },
    expected: "Other",
  },

  // 4. Ornamental IBM classes not overridden by Latin Text panose
  {
    name: "IBM Ornamental (9) beats Latin Text serif panose → Display",
    entry: {
      isFixedPitch: false,
      familyClassByte: 9,
      panose: [2, 8, 9, 0, 0, 0, 0, 0, 0, 0],
      family: "Cooper Black",
    },
    expected: "Display",
  },
  {
    name: "IBM Ornamental (9) beats Latin Text Flared sans panose → Display",
    entry: {
      isFixedPitch: false,
      familyClassByte: 9,
      panose: [2, 14, 5, 0, 0, 0, 0, 0, 0, 0],
      family: "Copperplate Gothic",
    },
    expected: "Display",
  },
  {
    name: "IBM Symbolic (12) → Other even with sans panose",
    entry: {
      isFixedPitch: false,
      familyClassByte: 12,
      panose: [2, 11, 0, 0, 0, 0, 0, 0, 0, 0],
      family: "Symbolish",
    },
    expected: "Other",
  },

  // 5. IBM family class fallback (when panose Latin Text is unusable)
  {
    name: "IBM Sans (8) when panose is empty",
    entry: {
      isFixedPitch: false,
      familyClassByte: 8,
      panose: null,
      family: "Unknown",
    },
    expected: "Sans-serif",
  },
  {
    name: "IBM Script (10) after panose Latin Text is incomplete",
    entry: {
      isFixedPitch: false,
      familyClassByte: 10,
      panose: [2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      family: "Unknown",
    },
    expected: "Script",
  },
  {
    name: "IBM class wins over wrong opposite when Latin Text panose is clear (Century Gothic case)",
    entry: {
      isFixedPitch: false,
      familyClassByte: 2, // Transitional Serifs (wrong in some Windows fonts)
      panose: [2, 11, 5, 0, 0, 0, 0, 0, 0, 0], // Normal Sans
      family: "Century Gothic",
    },
    expected: "Sans-serif", // panose Latin Text before remaining IBM
  },

  // 6. Name-keyword fallback
  {
    name: "name keyword mono when no tables",
    entry: {
      isFixedPitch: false,
      familyClassByte: null,
      panose: null,
      family: "My Mono Code Font",
    },
    expected: "Monospace",
  },
  {
    name: "name keyword script",
    entry: {
      isFixedPitch: false,
      familyClassByte: 0,
      panose: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      family: "Elegant Handwriting",
    },
    expected: "Script",
  },
  {
    name: "name keyword sans-serif",
    entry: {
      isFixedPitch: false,
      familyClassByte: null,
      panose: null,
      family: "Pretty Sans",
    },
    expected: "Sans-serif",
  },
  {
    name: "name keyword gothic → Sans-serif",
    entry: {
      isFixedPitch: false,
      familyClassByte: null,
      panose: null,
      family: "News Gothic",
    },
    expected: "Sans-serif",
  },
  {
    name: "nothing matches → Other",
    entry: {
      isFixedPitch: false,
      familyClassByte: null,
      panose: null,
      family: "Completely Novel Face",
    },
    expected: "Other",
  },
];

describe("classifyFont", () => {
  it.each(cases)("$name", ({ entry, expected }) => {
    expect(classifyFont(entry)).toBe(expected);
  });
});
