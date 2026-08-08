# Typeshelf

A client-side font viewer. Browse, preview, and organize your fonts — **nothing is ever
uploaded anywhere.** Font files are read, parsed, and rendered entirely in your browser.


## Why it exists

Picking type from a folder of files means opening them one at a time in a font viewer that
shows you a fixed sentence at a fixed size. Typeshelf loads a whole directory at once,
auto-sorts it by category, and lets you drive the specimen — size, spacing, color, and
background — without the files leaving your machine.

## Features

- Upload `.ttf` / `.otf` / `.woff` / `.woff2` / `.ttc` by drag-and-drop or file picker
- Chrome/Edge: optional "Load my installed fonts" via the Local Font Access API
- Auto-classification into Serif / Sans-serif / Monospace / Display / Script
  (fixed-pitch → panose → OS/2 family class → name keywords)
- Live specimen with size, letter-spacing, text color, and background color
- Six color themes × light / dark / system, all verified to WCAG AA
- Variant selection for loaded faces only — no synthesized bold or italic
- Favorites, custom categories, search
- Settings export / import as JSON; no account required

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No font files on hand? Click
**Load 3 sample fonts**.

```bash
npm run verify   # lint + typecheck + guardrails + tests
npm run build    # production build
```

## Deploying

The app is fully static-friendly and needs no backend. One optional environment variable:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Absolute origin (e.g. `https://typeshelf.example.com`). Drives Open Graph URLs. Defaults to `http://localhost:3000`, so set it in production or social previews will point at localhost. |

No other configuration is required, and none of it affects local development.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Lightweight sfnt table reader for TTF/OTF metadata (`lib/sfntMeta.ts`)
- `woff2-encoder/decompress` (WASM) for WOFF2 → SFNT decompression during cataloging
- `opentype.js` as a fallback for legacy WOFF (non-2) metadata

## Accessibility

Theming is pure CSS-custom-property swapping on `data-scheme` × `data-mode` — there are no
`dark:` variants in components, and no Tailwind palette classes anywhere. Every token pair
carries its computed contrast ratio as a comment in
[`app/globals.css`](./app/globals.css); body text clears **14.6:1** in light mode and
**15.2:1** in dark (AAA).

A full WCAG 2.1 AA audit — 12 findings, all resolved, plus what remains unverified — is in
[`docs/ACCESSIBILITY_AUDIT.md`](./docs/ACCESSIBILITY_AUDIT.md).

CI enforces the parts that regress silently — no palette classes, no raw color literals, no
DOM ids built from user data.

## Data and privacy

Font bytes never leave the browser and are never persisted. Only organization preferences
(favorites, custom categories, theme, specimen settings) are stored, in `localStorage`.
Storage is abstracted behind a `PreferencesStore` interface
([`docs/PERSISTENCE.md`](./docs/PERSISTENCE.md)) so a remote backend can be added without
touching call sites — none is implemented, and the default build makes no network requests
for user data.

## Notes on WOFF2

WOFF2 uploads are decompressed with `woff2-encoder/decompress` so cataloging can read the
same OS/2 / `post` / `name` tables as TTF/OTF (weight, fixed-pitch, panose, family class).
Preview still registers the **original** WOFF2 bytes with `FontFace` — browsers decode
those natively.

If decompression fails for a file (corrupt or unsupported WOFF2), the app falls back to a
filename-guessed family and style plus a non-blocking warning, and the face still previews
when possible.

## Sample fonts

The three bundled demo faces are OFL 1.1 and are Latin subsets, not complete fonts. See
[`public/sample-fonts/README.md`](./public/sample-fonts/README.md).

## License

[MIT](./LICENSE) © Chloe Polk. Bundled sample fonts are licensed separately under the
[SIL Open Font License 1.1](./public/sample-fonts/OFL.txt).
