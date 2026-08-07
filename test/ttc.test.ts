import { describe, expect, it } from "vitest";
import { faceMatchesHint, matchTtcFaceIndex } from "@/lib/ttc";

const cambriaFaces = [
  {
    fullName: "Cambria",
    postscriptName: "Cambria",
    family: "Cambria",
    style: "Regular",
  },
  {
    fullName: "Cambria Math",
    postscriptName: "CambriaMath",
    family: "Cambria Math",
    style: "Regular",
  },
];

const gothicFaces = [
  {
    fullName: "MS Gothic",
    postscriptName: "MS-Gothic",
    family: "MS Gothic",
    style: "Regular",
  },
  {
    fullName: "MS UI Gothic",
    postscriptName: "MS-UIGothic",
    family: "MS UI Gothic",
    style: "Regular",
  },
  {
    fullName: "MS PGothic",
    postscriptName: "MS-PGothic",
    family: "MS PGothic",
    style: "Regular",
  },
];

const familyVariants = [
  {
    fullName: "Example Bold",
    postscriptName: "Example-Bold",
    family: "Example",
    style: "Bold",
  },
  {
    fullName: "Example Regular",
    postscriptName: "Example-Regular",
    family: "Example",
    style: "Regular",
  },
  {
    fullName: "Example Italic",
    postscriptName: "Example-Italic",
    family: "Example",
    style: "Italic",
  },
];

describe("faceMatchesHint", () => {
  it("matches exact fullName (case-insensitive)", () => {
    expect(
      faceMatchesHint(cambriaFaces[1]!, { fullName: "cambria math" }),
    ).toBe("exact");
  });

  it("matches exact postscriptName", () => {
    expect(
      faceMatchesHint(gothicFaces[0]!, { postscriptName: "MS-Gothic" }),
    ).toBe("exact");
  });

  it("matches family+style as exact", () => {
    expect(
      faceMatchesHint(familyVariants[0]!, {
        family: "Example",
        style: "Bold",
      }),
    ).toBe("exact");
  });

  it("matches family-only as family", () => {
    expect(
      faceMatchesHint(familyVariants[1]!, { family: "Example" }),
    ).toBe("family");
  });

  it("returns false when nothing matches", () => {
    expect(
      faceMatchesHint(cambriaFaces[0]!, {
        fullName: "Arial",
        family: "Arial",
        style: "Regular",
      }),
    ).toBe(false);
  });
});

describe("matchTtcFaceIndex", () => {
  it("returns -1 for an empty face list", () => {
    expect(matchTtcFaceIndex([], { fullName: "Cambria" })).toBe(-1);
  });

  it("returns 0 when only one face exists", () => {
    expect(
      matchTtcFaceIndex([cambriaFaces[0]!], { fullName: "Anything" }),
    ).toBe(0);
  });

  it("picks exact fullName match", () => {
    expect(
      matchTtcFaceIndex(cambriaFaces, { fullName: "Cambria Math" }),
    ).toBe(1);
  });

  it("picks exact postscriptName match", () => {
    expect(
      matchTtcFaceIndex(gothicFaces, { postscriptName: "MS-PGothic" }),
    ).toBe(2);
  });

  it("prefers Regular within a family-only fallback", () => {
    expect(
      matchTtcFaceIndex(familyVariants, { family: "Example" }),
    ).toBe(1); // Regular
  });

  it("uses first family match when no Regular style exists", () => {
    const faces = [
      {
        fullName: "Demo Bold",
        postscriptName: "Demo-Bold",
        family: "Demo",
        style: "Bold",
      },
      {
        fullName: "Demo Light",
        postscriptName: "Demo-Light",
        family: "Demo",
        style: "Light",
      },
    ];
    expect(matchTtcFaceIndex(faces, { family: "Demo" })).toBe(0);
  });

  it("returns -1 when there is no plausible match among multiple faces", () => {
    expect(
      matchTtcFaceIndex(cambriaFaces, {
        fullName: "Arial",
        postscriptName: "ArialMT",
        family: "Arial",
        style: "Regular",
      }),
    ).toBe(-1);
  });
});
