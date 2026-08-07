/**
 * Client-side WOFF2 → SFNT decompression for metadata cataloging only.
 * Preview rendering still uses the original WOFF2 bytes via FontFace.
 *
 * Uses `woff2-encoder/decompress` (WASM, decompress-only entry) — verified
 * against `woff-lib` on a real Arial→WOFF2 round-trip; both produced identical
 * sfnt, with woff2-encoder ~2× faster and a dedicated smaller import path.
 */

import decompressWoff2 from "woff2-encoder/decompress";

export async function decompressWoff2ToSfnt(
  buffer: ArrayBuffer,
): Promise<ArrayBuffer> {
  const input = new Uint8Array(buffer);
  const output = await decompressWoff2(input);
  const copy = new Uint8Array(output.byteLength);
  copy.set(output);
  return copy.buffer;
}
