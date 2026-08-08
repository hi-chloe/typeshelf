# Typeshelf — Cursor prompt sequence

Paste these into Cursor **one at a time, in order**. Each depends on the one before it.
Let each finish, run `npm run lint && npm run test && npm run build`, and eyeball the UI before moving on.

---

## Shared preamble

> Prepend this to every prompt below. It saves Cursor a discovery pass and prevents the two most likely failure modes in this repo.

```
CONTEXT — read before writing code.

Project: Typeshelf, a client-side font viewer. Next.js 16.3 (App Router) + React 19 +
TypeScript + Tailwind CSS v4. No backend. Fonts are parsed and previewed entirely in
the browser; nothing is uploaded anywhere.

Key files:
- app/globals.css ............ all design tokens live here as CSS custom properties on :root
- app/layout.tsx ............. root layout, next/font/google (Young Serif + Schibsted Grotesk)
- app/page.tsx ............... sidebar + preview two-pane shell
- lib/FontLibraryContext.tsx . single useReducer store; ALL app state + actions
- lib/libraryPersistence.ts .. localStorage read/write for favorites/categories
- lib/types.ts ............... FontEntry, BuiltinCategory, etc.
- components/PreviewPane.tsx . preview header, size/spacing sliders, sample text, render surface
- components/VariantChips.tsx  variant selector
- components/FontLibrarySidebar.tsx, FontFamilyListItem.tsx, FontUploadZone.tsx, SystemFontBanner.tsx

Two hard rules for this codebase:

1. This repo is already fully tokenized. There is exactly ONE hardcoded color in the
   entire app (`text-white` in FontLibrarySidebar.tsx:205). Every other color is
   `var(--token)`. Do not introduce Tailwind palette classes (bg-slate-800, text-gray-500,
   etc.). If you need a new color, add a token to globals.css and reference it.

2. AGENTS.md warns that this Next.js version has breaking changes vs. your training data.
   Before using any Next.js API, check node_modules/next/dist/docs/. Same for Tailwind v4 —
   verify syntax against the installed version, not from memory. Tailwind v4 has no
   tailwind.config.js in this repo; configuration is CSS-first via @theme in globals.css.

State changes go through the reducer in FontLibraryContext.tsx: add an action to the
`Action` union, a case in `reducer`, a callback in the provider, and expose it on
`FontLibraryContextValue`. Do not add parallel useState for anything that belongs in the store.
```

---

## Prompt 1 — Theme system (color schemes + dark mode)

```
Add a theme system with two independent axes: COLOR SCHEME and MODE.

Color schemes: ember (the current orange — this stays the default), azure (blue),
verdant (green), amethyst (purple), garnet (red), and spectrum (multicolor).
Modes: light, dark, system.

ARCHITECTURE — do this the cheap way, not the Tailwind way.

Because this codebase already routes ~100% of color through CSS custom properties,
theming should be pure token swapping. Do NOT rewrite components with `dark:` variants.
Instead, in app/globals.css:

- Keep :root as the light/ember default so nothing breaks if JS fails.
- Add attribute-scoped blocks that redeclare the SAME token names:
    [data-scheme="azure"] { --accent: …; --accent-strong: …; --accent-soft: …; }
    [data-mode="dark"] { --background: …; --ink: …; --surface: …; … }
    [data-mode="dark"][data-scheme="azure"] { … }
- Set `color-scheme: light` / `color-scheme: dark` on the matching blocks so native
  scrollbars, range inputs, and form controls follow the theme.
- The body background is currently two radial-gradients with hardcoded hex values
  (#f3efe6, #d9e8e2). Tokenize those as --glow-1 and --glow-2 and vary them per theme.
- Fix the one hardcoded `text-white` in FontLibrarySidebar.tsx — replace with a new
  `--on-accent` token, because white-on-accent will not hold across all six schemes.

TOKENS THAT MUST BE DEFINED FOR EVERY SCHEME × MODE COMBINATION:
--background --foreground --ink --ink-muted --ink-faint --surface --surface-muted
--preview-bg --border --accent --accent-strong --accent-soft --on-accent
--warn --warn-strong --warn-soft --warn-border --glow-1 --glow-2

CONSTRAINT — "all currently-white areas stay white in light mode."
--preview-bg (#fffefd) and --background (#fdfcfa) must remain near-white and essentially
unchanged across ALL SIX light-mode schemes. Only accent/glow tokens shift in light mode.
Dark mode is the only place these go dark.

CONTRAST BUDGET — non-negotiable, verify each pair numerically and put the computed
ratios in a comment above each theme block:
- --ink on --background, --ink on --surface, --ink on --preview-bg: >= 7:1 (AAA, matches
  the current ember theme's headroom)
- --ink-muted on --background and on --surface: >= 4.5:1
- --ink-faint on --surface: >= 3:1 (it is icon-only chrome — see the existing comment)
- --accent-strong on --background and on --accent-soft: >= 4.5:1
- --warn-strong on --warn-soft: >= 4.5:1
- --on-accent on --accent-strong: >= 4.5:1
- --accent and --border as non-text boundaries/focus rings on --background: >= 3:1
Do not "fade" text with opacity to hit a look — pick a real color. The existing comment
in globals.css says this explicitly; honor it.

"SPECTRUM" (multicolor): I have not specified what this means. Propose a concrete
interpretation and implement it, subject to: any spectrum color used behind or as TEXT
must clear 4.5:1 against its background, and any used as a non-text boundary must clear
3:1. Neutral chrome (--ink, --background, --surface, --preview-bg) must NOT become
multicolored — only accent-role tokens. Put your reasoning in a comment. Keep it stable
per render (no random-on-load) so it can be contrast-tested and screenshot-diffed.

PERSISTENCE + NO FLASH OF WRONG THEME:
- Add `theme: { scheme, mode }` to LibraryPreferences in lib/libraryPersistence.ts.
  Bump the storage key version and write a migration that reads the old v1 payload and
  carries favorites/customCategories/categoryOverrides forward. Do not silently drop
  user data on upgrade.
- Theme prefs currently would hydrate in a post-mount useEffect (see HYDRATE_PREFS),
  which is fine for favorites but would cause a visible light->dark flash. Add a small
  blocking inline script in the document head that reads localStorage and sets
  data-scheme / data-mode on <html> before first paint, and add suppressHydrationWarning
  to <html>. Verify the correct way to inline a head script in THIS version of Next.js
  before writing it.
- mode: "system" must subscribe to matchMedia("(prefers-color-scheme: dark)") and update
  live, not just on load.

UI:
- Add a theme control to the sidebar footer area. Scheme as a row of swatch buttons,
  mode as a 3-way light/dark/system control.
- Swatches must not rely on color alone to show selection (WCAG 1.4.1) — add a checkmark
  or ring plus an accessible name, and use aria-pressed or a radiogroup with aria-checked.
- Each swatch needs an accessible name ("Azure theme"), a >= 24x24px hit target, and a
  visible focus ring that clears 3:1 against its own background.
- Wrap any theme transition in @media (prefers-reduced-motion: no-preference).

Add the theme reducer actions to FontLibraryContext.tsx following the existing pattern.
```

---

## Prompt 2 — Preview text color + editable size/spacing values

```
Two changes to components/PreviewPane.tsx, both backed by new reducer state in
lib/FontLibraryContext.tsx.

A) PREVIEW TEXT COLOR

The preview <p> currently hardcodes `color: "var(--ink)"`. Make it user-settable.

- New state: previewColor, defaulting to null meaning "follow the theme's --ink".
  Null-not-a-hex matters: if the user never picks a color, switching themes should still
  recolor the preview text. A picked color persists until explicitly reset.
- Control lives next to the sample-text field. Include:
    - a small set of preset swatches derived from the active theme tokens
      (--ink, --ink-muted, --accent-strong, plus a light/inverse option)
    - a native <input type="color"> for arbitrary colors
    - a "Reset to theme" affordance, only enabled when previewColor is non-null
- Persist previewColor in the library preferences.

ACCESSIBILITY — read this carefully, it is the subtle part:
The preview surface is a type specimen; the user is deliberately choosing colors, so I
do NOT want the picker hard-blocked on contrast grounds. But it must not silently produce
an unreadable specimen. Implement a live contrast readout instead of a restriction:
  - compute the WCAG 2.x relative-luminance contrast ratio between previewColor and
    --preview-bg (resolve the CSS variable to a real color via getComputedStyle; do not
    assume a literal)
  - display it as e.g. "4.8:1 · AA" next to the picker, updating live
  - when it drops below 4.5:1, show a non-blocking warning with BOTH an icon/text label
    and color (never color alone), announced via aria-live="polite"
  - never disable the choice
Recompute the readout when the theme changes, since --preview-bg moves in dark mode.

B) CLICK-TO-EDIT SIZE AND SPACING

Right now `{state.fontSize}px` and the letter-spacing percentage are plain <span>s.
Make each an editable numeric field while keeping its slider.

- Replace each span with an <input type="number"> (or a text input with numeric
  inputMode) that shares the same reducer state as the slider — one source of truth,
  two controls.
- Commit on Enter and on blur. Escape reverts to the last committed value. Reject
  non-numeric input without wiping what the user typed mid-edit.
- Sliders stay at their current ranges (size 12–120, spacing -5 to 20). Typed values may
  exceed the slider range — that is the point of "custom metric" — so clamp typed input
  to a WIDER hard range: size 4–800px, letter-spacing -20% to 200%. When the value is
  outside the slider range, the slider pins to its nearest end; do not let it snap the
  typed value back.
- Reject NaN/empty on commit by reverting to the previous value, not by writing 0.
- Fractional values allowed (spacing already steps by 0.5; permit at least one decimal
  for size too).

A11y for the number inputs:
- Each control group currently uses a <label> wrapping the range input. Adding a second
  input inside the same label creates an ambiguous label association — restructure so the
  slider and the number field each have their own unambiguous accessible name
  ("Font size, slider" / "Font size, exact value" or equivalent).
- Number inputs need >= 24x24px targets and a visible focus ring meeting 3:1.
- The unit ("px", "%") should be visible next to the field, not only implied.
```

---

## Prompt 3 — Relocate the Variants selector

```
Move <VariantChips /> from the bottom of PreviewPane into the preview header region, so
variant switching sits with the family name instead of below the fold.

Layout:
- The header is currently `flex flex-wrap items-end justify-between` containing one
  <div> with the family name, style, weight, and source. Restructure to a two-column
  header: identity block on the left, variant chips on the right, wrapping to a full-width
  row below the identity block on narrow viewports.
- Families can have many variants (9+ weights x italics). The chip strip must not push
  the header to five lines. Constrain it: horizontally scrollable single row on md+ with
  a max width, wrapping to at most two rows on small screens, or collapse to a compact
  select/dropdown below a threshold count. Pick one and justify it in a comment.
- If you make it horizontally scrollable, it must remain reachable by keyboard alone and
  scroll into view on focus — a scroll container that only responds to a mouse wheel is a
  2.1.1 failure.

Fix these existing a11y bugs in VariantChips.tsx while you are in there:
- The chips are a single-select group rendered as plain <button>s. Selection state is
  conveyed ONLY by color (accent border + accent-soft fill), which fails WCAG 1.4.1 (Use
  of Color) and is invisible to screen readers. Convert to a proper single-select pattern:
  role="radiogroup" with aria-checked on each option (or a tablist), plus a non-color
  selected indicator such as a weight change, checkmark, or thicker border.
- Add roving tabindex with arrow-key navigation so the group is one tab stop, not N.
- Add an accessible group label ("Variants") tied via aria-labelledby — the current
  <p> is purely visual.
- Chips are px-2.5 py-1 text-sm, which is likely under the 24x24px minimum target size.
  Verify computed height and pad to meet it.
- Ensure the selected chip's border clears 3:1 against the surrounding surface.

Do not change selection logic — selectVariant / selectedVariants / pickDefaultVariant
behavior stays exactly as-is. This is a presentation + semantics change only.
```

---

## Prompt 4 — Persistence seam for user saves

> **This one is a decision, not just an implementation.** Read the tradeoffs section below
> before pasting. The prompt scaffolds the seam and defers the backend choice, which is
> what I'd recommend — but you should decide consciously.

```
Refactor persistence so user data can live either locally or in a remote backend, without
committing to a backend today.

THE PROBLEM: lib/libraryPersistence.ts hardcodes localStorage. Any future sync, account,
or team-sharing feature requires touching every call site. Also the storage key is
"font-explorer:library-prefs:v1" while the product is called Typeshelf — inconsistent,
and it needs versioning discipline anyway.

STEP 1 — Extract a storage adapter interface.
- Define `PreferencesStore` with async methods: load(): Promise<LibraryPreferences>,
  save(prefs): Promise<void>, and optionally subscribe(cb) for cross-tab/cross-device
  updates.
- Ship `LocalPreferencesStore` implementing it over localStorage — this is the default
  and the ONLY implementation wired up right now. Behavior must be identical to today,
  including the silent-failure path for private browsing / quota errors.
- Add a `MemoryPreferencesStore` for tests and SSR.
- FontLibraryContext consumes the interface, not localStorage. It should not know which
  implementation it has.

STEP 2 — Version and migrate.
- Rename the key to "typeshelf:prefs:v2" and write a migration that reads
  "font-explorer:library-prefs:v1", maps it forward, writes v2, and leaves v1 in place
  for one release rather than deleting it.
- Add an explicit `version` field to the payload and a migration chain keyed on it, so v3
  is a one-function change. Validate on read — the existing isStringArray/isStringRecord
  guards are the right instinct; extend them to cover the new theme and preview fields
  from prompts 1 and 2.

STEP 3 — Export / import.
- Add "Export settings" (downloads a .json of favorites, custom categories, category
  overrides, theme, and preview settings) and "Import settings" (file picker, validated
  and version-migrated on read, with a confirm step before overwriting).
- This gives cross-device portability and shareable presets with zero infrastructure,
  and it is the honest open-source default.
- Never include font file bytes or system-font enumeration results in the export.

STEP 4 — Document the remote path WITHOUT implementing it.
- Add a `RemotePreferencesStore` stub with the full interface, throwing "not configured",
  and a docs/PERSISTENCE.md explaining how a contributor would implement it.
- Document that any remote implementation must be configured purely by environment
  variables (NEXT_PUBLIC_* for client-side config), must have zero hardcoded credentials,
  must degrade to LocalPreferencesStore when unconfigured, and must not change behavior
  for self-hosters who never set the vars.

Do NOT add auth, a database, Supabase, or any network dependency in this pass.
Do NOT let the async interface introduce a loading flash — keep an optimistic
synchronous first paint from the local store.
```

### Tradeoffs to decide before you go further than Step 4

| | Local-only + export/import | Supabase (optional sign-in) | Adapter + deferred backend |
|---|---|---|---|
| Infra cost | none | free tier, then paid | none now |
| Cross-device sync | manual file | yes | later |
| Privacy story | intact — nothing leaves the browser | you now hold user data; needs a privacy policy | intact |
| Open-source friction | zero | self-hosters must provision a project | zero |
| Deploy | stays static-friendly | needs env vars, RLS policies, auth callback route | unchanged |
| Reversibility | trivial | you inherit accounts, deletion requests, GDPR | trivial |

Things worth weighing:

- **Your current privacy story is a genuine feature.** "Your fonts never leave your browser" is a real differentiator for a font tool — some fonts are licensed, unreleased, or client-confidential. Accounts don't break that literally (you'd sync prefs, not font bytes), but it muddies the claim, and you'd need to be explicit that only names and preferences sync. Family names alone can leak a client's unreleased brand work.
- **"Other designers can use this" and "accounts" are separable.** Export/import plus a shareable preset file may cover the actual need — most of the value is portability, not identity.
- **If you do add Supabase:** Row Level Security is mandatory and is the *only* thing protecting the data, since the anon key ships to the client and is publicly visible by design. Budget a security review; that's not a vibecode-and-ship surface.
- **Favorites are keyed on family name strings.** That's fine locally but collides across users with different fonts installed (two people's "Helvetica" aren't the same file). Worth resolving before it becomes a schema.

---

## Prompt 5 — WCAG sweep

> Don't run this in Cursor. Bring it back to me after 1–4 land and I'll audit it properly
> — I can compute actual contrast ratios, check the DOM, and reason about screen-reader
> semantics in a way a code-gen pass won't. What follows is scope, so you know what's coming.

Scope for the audit:

- **1.4.3 / 1.4.6 contrast** — every token pair across all 12 scheme×mode combinations, computed numerically, not eyeballed.
- **1.4.11 non-text contrast** — borders, focus rings, slider tracks and thumbs, chip outlines, the upload dropzone's dashed border, theme swatches.
- **1.4.1 use of color** — theme swatch selection, variant chip selection, warning states, favorite stars.
- **2.1.1 / 2.1.2 keyboard** — the category dropdown in FontFamilyListItem, the new scrollable chip strip, the color picker, the collapsible sections, the new/delete category flow. Every `×` dismiss button.
- **2.4.7 focus visible** — several elements use `outline-none` with only a `focus:border-*` change; a border-color shift alone is a weak focus indicator and may not clear 3:1.
- **4.1.2 name/role/value** — the `▾ ▸` and `★` and `×` glyphs, the collapsible `aria-expanded` pattern, the variant group.
- **1.3.1 info & relationships** — sidebar section headings are `<button>` inside `<div>`, not heading elements; there's one `<h1>` and one `<h2>` and no structure between them.
- **4.1.3 status messages** — the warnings region already has `aria-live`; the load-progress and face-loading states do not.
- **2.5.8 target size (WCAG 2.2)** — the `×` buttons at `text-[10px]`, the `px-1` toggles, and the variant chips are all likely under 24×24. Flagging separately since 2.2 is a superset of your 2.1 AA target.
- **1.4.12 text spacing / 1.4.4 resize** — the preview surface is the point of the app, but the *chrome* must survive 200% zoom and user stylesheets.
- **Reduced motion** — any theme transition added in prompt 1.

---

## Sequencing notes

- **1 → 2 → 3** is a hard dependency chain. Prompt 2's contrast readout resolves `--preview-bg`, which only becomes dynamic in prompt 1. Prompt 3's chip contrast can't be verified until the themes exist.
- **4 is independent** of 1–3 in principle, but running it *after* means the migration covers the new theme and preview-color fields in one shot instead of two.
- **Commit between every prompt.** These touch overlapping files (`globals.css`, `FontLibraryContext.tsx`, `PreviewPane.tsx`), and a bad multi-feature diff is painful to unwind.
- There are existing tests in `test/` covering font parsing only — nothing covers the context or components. Consider asking Cursor for reducer tests as part of prompt 4, since that's where the migration logic lands and it's the easiest thing to silently break.
