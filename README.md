# Font Explorer

Phase 1: client-side font viewer for browsing and previewing local fonts.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Lightweight sfnt table reader for TTF/OTF metadata (`lib/sfntMeta.ts`)
- `opentype.js` as a fallback for legacy WOFF (non-2) metadata

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Phase 1 features

- Upload `.ttf` / `.otf` / `.woff` / `.woff2` / `.ttc` via drag-and-drop or file picker
- Chrome/Edge: optional “Load my installed fonts” via Local Font Access API
- Library grouped by category (fixed-pitch → panose → OS/2 family class → name keywords)
- Live preview with size and letter-spacing sliders
- Variant chips for loaded faces only (no synthesized bold/italic)
- Favorites, custom categories, and search

## Note on WOFF2

`opentype.js` cannot decompress WOFF2 without an external helper. WOFF2 files still preview via `FontFace`, but family/style come from the filename and classification metadata is limited until a decompressor is wired in.
