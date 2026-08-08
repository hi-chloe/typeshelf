# Typeshelf — WCAG 2.1 AA audit

Audited at commit `e75668c` (after the theme, preview-color, variant, and persistence work).
Method: source review of all 8 components + independent recomputation of every color pair
using the WCAG 2.x relative-luminance formula. Ratios below are computed, not estimated.

**Result: 3 blocking failures, 4 moderate, 5 minor.** No failure is in the theme token
system — that part holds up. Everything blocking is in keyboard navigation and DOM
semantics, which is the usual pattern when styling gets audited but structure doesn't.

---

## Blocking (fix before any public link)

### B1 — No skip link. Sidebar traps keyboard users. `2.4.1 Bypass Blocks (Level A)`

`app/page.tsx` renders `<FontLibrarySidebar />` before `<PreviewPane />`, and every font
row in `FontFamilyListItem.tsx` contains **three** tab stops: the favorite star (L94), the
family button (L113), and the category select (L139).

With uploaded fonts that's tolerable. With "Load my installed fonts" on Chrome — the
feature the app advertises — `queryLocalFonts()` commonly returns 300–1,000+ faces. At
~200–400 families that is **600–1,200 tab stops** before a keyboard user reaches the
preview controls. There is no skip link anywhere in the app (grep confirms zero matches).

This is the only Level A failure in the audit, and it's the one that would actually stop
someone from using the tool.

**Fix:** add a visually-hidden-until-focused "Skip to preview" link as the first focusable
element in `layout.tsx`, targeting an `id` on `<main>`. Also give `<aside>` and `<main>`
accessible names (`aria-label="Font library"` / `aria-label="Preview"`) so screen-reader
users can jump by landmark instead.

### B2 — Duplicate DOM ids break label association. `1.3.1`, `4.1.2`

`FontFamilyListItem.tsx:136-140`

```tsx
<label className="sr-only" htmlFor={`cat-${family}`}>Category for {family}</label>
<select id={`cat-${family}`} …>
```

A favorited font renders **twice** — once in the Favorites section, once in its category
section (`FontLibraryContext.tsx` builds both lists from the same family). Both instances
emit `id="cat-Inter"`. Duplicate ids mean `htmlFor` resolves to the first match only, so
the second select has no accessible name at all.

Family names also aren't id-safe — spaces, dots, and quotes in names like
`"Noto Sans JP"` or `"P22 Underground"` produce fragile selectors.

**Fix:** use `useId()` per instance. Never derive ids from user data.

Same class of bug, lower severity: `ThemeControls.tsx:188` hardcodes
`id="theme-mode-label"` instead of `useId()`.

### B3 — Scheme menu announces `role="dialog"` but never moves focus. `4.1.2`, `2.4.3`

`ThemeControls.tsx:124,156` — trigger declares `aria-haspopup="dialog"`, popup declares
`role="dialog"`. But `selectScheme`/`setSchemeMenuOpen(true)` never move focus into the
container, and there's no focus trap.

A screen-reader user activates the trigger, hears "dialog", and focus is still on the
button. Nothing tells them the swatches exist. Sighted keyboard users have to guess that
Tab (not arrows) walks into it.

**Fix:** this isn't a dialog, it's a popover containing a radiogroup. Drop `role="dialog"`
and `aria-haspopup="dialog"`; move focus to the checked swatch on open. Escape/outside-click
handling already works and should stay.

---

## Moderate

### M4 — Focus indicator on text inputs is a border-color swap that's effectively invisible. `2.4.7`

`FontLibrarySidebar.tsx:161` (search) and `:198` (new category name) use
`outline-none` with only `focus:border-[var(--accent)]`.

Computed contrast between the unfocused and focused border:

| | unfocused → focused | ratio |
|---|---|---|
| Light | `#8f877f` → `#d9614f` | **1.03:1** |
| Dark | `#8a8178` → `#e07a6a` | **1.30:1** |

Those two states are, luminance-wise, nearly identical. The border *changes hue* but not
lightness — so it reads as a focus indicator to a fully-sighted user and as nothing at all
to a colorblind or low-vision user. It scrapes past 2.4.7 (which only demands "some"
visible indicator) and fails 2.4.13 Focus Appearance outright.

Every other interactive element in the app already uses
`focus-visible:ring-2 focus-visible:ring-[var(--ink)]` (13.4:1 light, 13.8:1 dark — excellent).
These two inputs are just inconsistent.

**Fix:** apply the same ring treatment. It's a copy-paste.

### M5 — Category select is mouse-only in practice. `1.4.13`-adjacent, usability

`FontFamilyListItem.tsx:148` — `opacity-0 group-hover:opacity-100 focus:opacity-100`.

It's keyboard-reachable and does become visible on focus, so it isn't a hard failure. But
"move a font to a category" is a core feature that is **completely invisible** until you
hover the exact row. Touch users have no hover state at all. Discoverability here is near
zero regardless of ability.

**Fix:** show it at `--ink-faint` persistently (3.39:1 — already cleared for icon chrome),
or move category assignment into a row context menu with a visible trigger.

### M6 — Hardcoded white inset shadow on the preview surface. Dark mode artifact

`PreviewPane.tsx:273` — `shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]`

**I got this wrong last session.** I reported "zero hardcoded colors" based on a grep for
Tailwind palette classes. This one is an arbitrary-value `rgba()` and slipped the pattern.
In dark mode it paints a 40%-white hairline across the top of the preview box — a light-mode
bevel surviving into a dark theme.

**Fix:** tokenize as `--inset-highlight`, near-white in light mode and a low-alpha white or
transparent in dark.

### M7 — `--border` used as text color. `1.4.3`

`PreviewPane.tsx:176,178` — the `·` separators between style / weight / source use
`text-[var(--border)]`.

| | ratio | text threshold |
|---|---|---|
| Light | **3.45:1** | fails 4.5:1 |
| Dark | 4.67:1 | passes |

Defensible as "pure decoration" since the metadata is separated by layout anyway — but
`--border` is documented in `globals.css` as a boundary token, and this uses it outside
that contract. Cheapest correct fix: `aria-hidden` the separators and switch them to
`--ink-faint`, or drop them for flex `gap`.

---

## Minor

- **m8** — `ThemeControls.tsx:34`: `CheckIcon` hardcodes `stroke="#ffffff"`. Against the swatch faces it clears 3:1 everywhere (ember 3.64, azure 4.13, verdant 3.98, amethyst 4.93, garnet 4.90) **except the spectrum gold stop `#d4a017` at 2.38:1**. The conic gradient means the check may land on gold depending on rotation. Selection is redundantly conveyed by `ring-2 ring-[var(--ink)]`, so this isn't a 1.4.1 failure — but add a dark stroke or a drop-shadow for the spectrum case.
- **m9** — Both radiogroups in `ThemeControls.tsx` (schemes L169, modes L194) declare `role="radio"` children but have **no arrow-key handling and no roving tabindex**. Per WAI-ARIA APG a radiogroup is one tab stop navigated by arrows. `VariantChips.tsx` implements this correctly (L98–147) — `ThemeControls` should match it.
- **m10** — `PreviewPane.tsx:253` — the contrast readout (`"4.8:1 · AA"`) is a bare `<span>` with no programmatic relationship to either color picker. Give it an id and `aria-describedby` from both `PreviewColorMenu` triggers.
- **m11** — `PreviewPane.tsx:424` — the metric number inputs are `type="text"` + `inputMode="decimal"` (a good call — avoids number-spinner scroll bugs), but nothing communicates the accepted range. A keyboard user typing `900` silently gets clamped to 800. Add `aria-describedby` with "4 to 800".
- **m12** — `FontUploadZone.tsx:41` — `role="button"` on a `<div>` with `tabIndex={0}` and an Enter/Space handler is implemented correctly, but if the `<input type="file">` is a descendant, nested interactive content inside `role="button"` is invalid. Verify and hoist the input out if so.

---

## Verified correct — do not "fix" these

Independently recomputed; all 32 ratios documented in `globals.css` are **exact**:

- Body text 14.60:1 light / 15.24:1 dark — AAA, not just AA.
- `--ink-muted` 5.54 / 7.84 · `--ink-faint` 3.39 / 4.43 (icon-only, correct threshold).
- All six schemes' `--accent-strong` clear 4.5:1 in both modes; lowest is verdant light at 6.21.
- `--border` darkened from `#e3ddd6` (**1.2:1** — a live 1.4.11 failure that predated this work) to `#8f877f` at 3.45:1.
- `accent-soft` fills sit at ~1.1:1 against neighbours. This looks alarming and **is fine** — the boundary is carried by `--border`, and selection is redundantly encoded via `border-2`, `font-semibold`, and a check glyph.
- `VariantChips.tsx` roving tabindex + Home/End + arrow keys: textbook. Arrows move focus without selecting (Space/Enter commits) — non-standard for a radiogroup but deliberate here, since arrow-to-select would trigger a font load per keypress. Keep it; document it.
- Live regions exist in the DOM before content changes (`PreviewPane.tsx:259`, `SystemFontBanner.tsx:79,84`, `PreferencesBackup.tsx:97`) — the common mistake is injecting the region with its content, which announces nothing. Not made here.
- `prefers-reduced-motion` gating on theme transitions, `color-scheme` set per mode, `matchMedia` change subscription for system mode, cross-tab `storage` sync.

---

## Not WCAG, but ship-blocking

1. **No `LICENSE`.** Repo is public; absent a license it's all-rights-reserved and the open-source goal is unmet. MIT chosen — add `LICENSE` + a README license section.
2. **No error boundary.** No `app/error.tsx` or `global-error.tsx`. The app parses arbitrary binary files from users; that's the highest-probability throw surface in the codebase and it currently white-screens.
3. **Empty first-run state.** `"Your library is empty. Upload fonts to get started."` is what every portfolio visitor sees. Three OFL-licensed fonts already sit in `test/fixtures/fonts/` — wire a "Load sample fonts" button.
4. **No CI.** Tests exist, nothing runs them.
5. **No `metadataBase` / `openGraph`.** Shared links render bare.
6. Five unreferenced Next.js boilerplate SVGs in `public/`.

---

## Suggested order

1. B1 skip link + landmark names — highest user impact, ~20 lines.
2. B2 `useId()` — mechanical.
3. M4 focus rings — copy-paste from existing pattern.
4. B3 dialog→popover + m9 arrow keys — same file, do together.
5. M6, M7, m8 — token cleanup, one pass.
6. M5 — needs a design decision from you, not just a fix.
7. m10–m12 — polish.

Re-verify after: every `outline-none` must have a paired `focus-visible:ring-*`, and no
`id={...}` may interpolate user data.
