# Typeshelf — WCAG 2.1 AA audit

**Status: all 12 findings resolved.** Audited at `e75668c`, remediated across `a1a2614`
and `01a5881`, guardrails added in `856a3ab`.

Method: source review of all components plus independent recomputation of every color pair
using the WCAG 2.x relative-luminance formula. Ratios below are computed, not estimated.
Findings are kept rather than deleted — what was wrong and why is the useful part.

| # | Finding | SC | Level | Status |
|---|---------|----|-------|--------|
| B1 | No skip link; sidebar traps keyboard users | 2.4.1 | A | Fixed |
| B2 | Duplicate DOM ids break label association | 1.3.1, 4.1.2 | A/AA | Fixed |
| B3 | Scheme menu announced `role="dialog"`, never moved focus | 4.1.2, 2.4.3 | A | Fixed |
| M4 | Focus indicator was a border-color swap at 1.03:1 between states | 2.4.7 | AA | Fixed |
| M5 | Category control was hover-only | 1.4.13 | AA | Fixed |
| M6 | Hardcoded white inset shadow bled into dark mode | — | — | Fixed |
| M7 | `--border` used as text color at 3.45:1 | 1.4.3 | AA | Fixed |
| m8 | Selection check at 2.38:1 on the spectrum gold stop | 1.4.11 | AA | Fixed |
| m9 | Radiogroups had no arrow-key navigation | 4.1.2 | A | Fixed |
| m10 | Contrast readout had no programmatic association | 1.3.1 | A | Fixed |
| m11 | Metric inputs didn't communicate their accepted range | 3.3.2 | A | Fixed |
| m12 | File input nested inside `role="button"` | 4.1.2 | A | Fixed |

---

## What was wrong, and what changed

### B1 — Keyboard trap in the sidebar `2.4.1 Level A`

Each font row carried three tab stops (favorite, family, category). With the Local Font
Access API returning 300–1,000+ faces, that meant **600–1,200 tab stops** before a keyboard
user could reach the preview controls. Theme controls sat *after* the list, so switching to
dark mode meant tabbing the entire library.

**Fixed:** three skip links ("Skip to preview", "Skip to settings", "Skip past font list"),
`id` + `tabIndex={-1}` targets on `<main>` and the settings group, and accessible names on
both landmarks. Tab distance to any region is now fixed at 1 regardless of library size.

DOM order was deliberately *not* reordered to put settings first — that would break 1.3.2
Meaningful Sequence. Skip links are the correct tool.

### B2 — Duplicate DOM ids `1.3.1`, `4.1.2`

`id={`cat-${family}`}` collided whenever a font was favorited, because it renders in both
the Favorites section and its category section. `htmlFor` resolved to the first match only,
leaving the second control unnamed. Family names like `"Noto Sans JP"` also aren't id-safe.

**Fixed:** `useId()` throughout. A guardrail now fails CI on any `id={\`...${...}\`}`.

### B3 — Popovers claimed to be dialogs `4.1.2`, `2.4.3`

The scheme picker declared `role="dialog"` and `aria-haspopup="dialog"` but never moved
focus into itself and had no focus trap. Screen-reader users heard "dialog" while focus
stayed on the trigger.

**Fixed:** these are popovers wrapping a radiogroup, so `role="dialog"` is gone and
`aria-haspopup="true"` replaces it. Focus moves into the panel on open and returns to the
trigger on close.

> **Verification note.** This was initially recorded as fixed after checking
> `ThemeControls` alone. `PreviewColorMenu` used the identical pattern and had **not** been
> corrected — it still declared `role="dialog"` and never moved focus. Found later, while
> working in that file for an unrelated reason. Both are now fixed. The lesson is that
> verifying a pattern means finding every instance of it, not the one named in the fix;
> `grep -rn 'role="dialog"'` across the tree is now part of the check.

### M4 — Focus indicator invisible to low-vision users `2.4.7`

Two sidebar inputs used `outline-none` with only `focus:border-[var(--accent)]`:

| | unfocused → focused | ratio |
|---|---|---|
| Light | `#8f877f` → `#d9614f` | **1.03:1** |
| Dark | `#8a8178` → `#e07a6a` | **1.30:1** |

The border changed hue but not lightness. It read as a focus ring to a fully-sighted user
and as nothing at all otherwise.

**Fixed:** both now use the app-wide `focus-visible:ring-2 ring-[var(--ink)]` treatment —
13.4:1 light, 13.8:1 dark.

### M5 — Category assignment was mouse-only `1.4.13`

The control was `opacity-0` until row hover. Keyboard-reachable, but invisible until you
hovered the exact row, and unreachable in principle for touch.

**Fixed:** replaced with a persistent `⋯` trigger at `--ink-faint` (3.39:1) opening a
`role="menu"` with `menuitemradio` options, roving tabindex, Escape-to-close, and focus
return. Closes on list scroll so the fixed-position menu can't orphan from its row.

### M6, M7, m8 — token and contrast cleanup

- A hardcoded `rgba(255,255,255,0.4)` inset shadow painted a white hairline across the
  preview surface in dark mode. Now `--inset-highlight`, defined per mode.
- `·` separators used `--border` as text at 3.45:1 in light mode, under the 4.5:1 minimum.
  `--border` is documented as a boundary token; this used it outside that contract.
- The selection check was white on the spectrum swatch's gold stop at **2.38:1**. Now
  carries a dark halo (`CHECK_HALO`) that holds ≥3:1 on every stop of the gradient.

### m9–m12 — semantics

Arrow-key navigation and roving tabindex on both theme radiogroups; `aria-describedby`
linking the contrast readout to both color triggers and the accepted range to the metric
inputs; the file input hoisted out of `role="button"`.

---

## Contrast — full matrix

Schemes own their neutrals, not just their accents, so every surface changes per theme and
every pair has to be re-verified per theme. Values below are computed with the WCAG 2.x
relative-luminance formula, not estimated.

| Scheme | Mode | ink/bg | muted/bg | faint/surf | border/bg | strong/bg | strong/soft | on/strong | accent/bg |
|---|---|---|---|---|---|---|---|---|---|
| Ember | Light | 15.11 | 5.93 | 3.60 | 3.69 | 6.31 | 4.61 | 6.50 | 3.02 |
| Azure | Light | 15.04 | 5.86 | 3.54 | 3.65 | 6.39 | 4.65 | 6.57 | 3.00 |
| Verdant | Light | 14.48 | 5.22 | 3.21 | 3.30 | 6.39 | 5.23 | 6.53 | 3.02 |
| Amethyst | Light | 15.39 | 6.20 | 3.76 | 3.84 | 6.37 | 4.62 | 6.57 | 3.01 |
| Garnet | Light | 15.36 | 6.17 | 3.75 | 3.82 | 6.37 | 4.64 | 6.57 | 3.00 |
| Ember | Dark | 15.59 | 8.51 | 4.63 | 4.77 | 7.48 | 4.60 | 7.57 | 3.01 |
| Azure | Dark | 15.59 | 8.57 | 4.66 | 4.84 | 7.54 | 4.55 | 7.62 | 3.03 |
| Verdant | Dark | 15.57 | 8.99 | 5.05 | 5.28 | 7.87 | 4.75 | 7.86 | 3.31 |
| Amethyst | Dark | 15.59 | 8.36 | 4.44 | 4.61 | 7.53 | 4.56 | 7.66 | 3.00 |
| Garnet | Dark | 15.59 | 8.37 | 4.47 | 4.63 | 7.53 | 4.55 | 7.65 | 3.01 |

| Column | Threshold | Worst case |
|---|---|---|
| ink/bg | 7.0 (AAA) | **14.48** |
| ink-muted/bg | 4.5 | **5.22** |
| ink-faint/surface | 3.0 (icon chrome) | **3.21** |
| border/bg | 3.0 (1.4.11) | **3.30** |
| accent-strong/bg | 4.5 | **6.31** |
| accent-strong/accent-soft | 4.5 | **4.55** |
| on-accent/accent-strong | 4.5 | **6.50** |
| accent/bg | 3.0 (non-text) | **3.00** |

Body text clears AAA in every combination, not just AA.

### The custom scheme is verified too

The user-picked scheme is generated at runtime by `lib/customTheme.ts`, which runs the same
lightness solver used to produce the preset blocks. It was exercised across **all 360 hues
× 2 modes × 13 pairs = 9,360 ratios, with zero failures** — no color a user can pick
produces a theme that fails AA. Only the hue is honored; saturation and lightness belong to
the solver.

### Why a solver rather than chosen hex values

Fixed HSL lightness does not yield constant contrast across hues. Green carries roughly
3.4× the luminance of blue at identical L (0.7152 vs 0.2126 coefficients). The first pass
at this palette used one lightness ramp for every scheme, and verdant failed five checks
while the other four passed — a discrepancy invisible to the eye and to review. Every
accent value is now found by binary-searching lightness against a measured target.

Targets sit deliberately above the WCAG minimum: solving to exactly 4.5 parks a value on
the boundary where hex quantization rounds it under, and leaves `--accent-soft` no room to
be a visible tint rather than near-white.

### Also verified

- `--border` was originally `#e3ddd6` — **1.2:1**, a live 1.4.11 failure predating this
  work. It now clears 3:1 in all ten combinations.
- `accent-soft` fills sit low against their neighbours by design: the boundary is carried
  by `--border`, and selection is redundantly encoded via `border-2`, `font-semibold`, and
  a check glyph rather than fill alone.

Deliberate asymmetry worth preserving: **variant chips** move focus with arrows but commit
with Space/Enter, because arrow-to-select would trigger a font load per keypress. **Theme
radiogroups** select on arrow, which is standard radio behavior. Both are commented in place.

---

## Not yet verified

Honest gaps, tracked rather than glossed:

1. ~~**Skip-link paint is manually confirmed, not automated.**~~ **Covered** by
   `e2e/a11y.smoke.spec.ts` — asserts focused skip links paint at a usable size and
   that Enter moves focus to `#preview-pane` / `#library-settings`.
2. ~~**No automated axe coverage.**~~ **Smoke coverage** in the same suite: axe-core
   against light and dark Ember at page load. Full 12 scheme × mode matrix and
   open-popover states are still open follow-ups.
3. **Behavior at ~200 families is untested.** Keyboard access is now size-independent by
   design, but render performance, 200 concurrent `IntersectionObserver` instances, and
   whether `pinResidentFace` actually bounds `FontFace` residency across a full-list scroll
   are all unverified.
4. **`aria-controls` on the category menu** references a conditionally-rendered element, so
   the IDREF doesn't resolve while closed. Low impact, technically invalid.

Item 3 still needs assertions a source review can't make — memory behavior under load.

---

## Enforcement

`npm run verify` runs lint, typecheck, guardrails, and unit tests. CI also builds and
runs `npm run test:e2e` (Playwright + axe). `scripts/guardrails.mjs`
fails CI on Tailwind palette classes, raw color literals outside two documented exemptions,
and DOM ids built from user data — the three rules that regress silently and are invisible
in review. Each exists because it has already been broken once.
