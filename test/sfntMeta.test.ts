import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readLiteFaceMeta } from "@/lib/sfntMeta";

const fixturesDir = path.join(__dirname, "fixtures", "fonts");

function loadFixture(name: string): ArrayBuffer {
  const buf = readFileSync(path.join(fixturesDir, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("readLiteFaceMeta", () => {
  it("reads Silkscreen (OFL) family/style/weight", () => {
    const meta = readLiteFaceMeta(loadFixture("silkscreen-latin.ttf"));
    expect(meta.family).toBe("Silkscreen");
    expect(meta.style).toBe("Regular");
    expect(meta.fullName).toContain("Silkscreen");
    expect(meta.postscriptName).toBe("Silkscreen-Regular");
    expect(meta.weightClass).toBe(400);
    expect(meta.isFixedPitch).toBe(false);
    expect(meta.panose).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("reads Tinos (OFL) as a proportional text face", () => {
    const meta = readLiteFaceMeta(loadFixture("tinos-latin.ttf"));
    expect(meta.family).toBe("Tinos");
    expect(meta.style).toBe("Regular");
    expect(meta.weightClass).toBe(400);
    expect(meta.isFixedPitch).toBe(false);
    expect(meta.panose).toHaveLength(10);
  });

  it("reads Cousine (OFL) including isFixedPitch and panose", () => {
    const meta = readLiteFaceMeta(loadFixture("cousine-latin.ttf"));
    expect(meta.family).toBe("Cousine");
    expect(meta.style).toBe("Regular");
    expect(meta.weightClass).toBe(400);
    expect(meta.isFixedPitch).toBe(true);
    expect(meta.panose?.[0]).toBe(2); // Latin Text
    expect(meta.panose?.[1]).toBe(7); // Thin (serif style digit; mono via post)
  });

  it("throws on an invalid buffer", () => {
    const junk = new TextEncoder().encode("not-a-font").buffer;
    expect(() => readLiteFaceMeta(junk)).toThrow(/Unsupported sfnt signature/);
  });
});
