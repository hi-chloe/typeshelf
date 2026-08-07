# Font Explorer

Phase 1: client-side font viewer for browsing and previewing local fonts.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Lightweight sfnt table reader for TTF/OTF metadata (`lib/sfntMeta.ts`)
- `woff2-encoder/decompress` (WASM) for WOFF2 ΓåÆ SFNT decompression during cataloging
- `opentype.js` as a fallback for legacy WOFF (non-2) metadata

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Phase 1 features

- Upload `.ttf` / `.otf` / `.woff` / `.woff2` via drag-and-drop or file picker
- Chrome/Edge: optional ΓÇ£Load my installed fontsΓÇ¥ via Local Font Access API
- Library grouped by category (fixed-pitch ΓåÆ panose ΓåÆ OS/2 family class ΓåÆ name keywords)
- Live preview with size and letter-spacing sliders
- Variant chips for loaded faces only (no synthesized bold/italic)
- Favorites, custom categories, and search

## Note on WOFF2

WOFF2 uploads are decompressed with `woff2-encoder/decompress` so cataloging can read the same OS/2 / `post` / `name` tables as TTF/OTF (weight, fixed-pitch, panose, family class). Preview still registers the **original** WOFF2 bytes with `FontFace` ΓÇö browsers decode those natively.

If decompression fails for a given file (corrupt or unsupported WOFF2), the app keeps todayΓÇÖs fallback: filename-guessed family/style plus a non-blocking warning, and the face still previews when possible.
