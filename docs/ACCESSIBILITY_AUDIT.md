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

### B3 — Popover claimed to be a dialog `4.1.2`, `2.4.3`

The scheme picker declared `role="dialog"` and `aria-haspopup="dialog"` but never moved
focus into itself and had no focus trap. Screen-reader users heard "dialog" while focus
stayed on the trigger.

**Fixed:** it's a popover wrapping a radiogroup, so `role="dialog"` is gone and
`aria-haspopup="true"` replaces it. Focus moves to the checked swatch on open and returns
to the trigger on close.

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

## Verified correct — independently recomputed

All 32 contrast ratios documented in `app/globals.css` are **exact**:

- Body text 14.60:1 light / 15.24:1 dark — AAA, not just AA.
- `--ink-muted` 5.54 / 7.84 · `--ink-faint` 3.39 / 4.43 (icon-only, correct threshold).
- All six schemes' `--accent-strong` clear 4.5:1 in both modes; lowest is verdant light at 6.21.
- `--border` was darkened from `#e3ddd6` — **1.2:1**, a live 1.4.11 failure predating this
  work — to `#8f877f` at 3.45:1.
- `accent-soft` fills sit at ~1.1:1 against neighbours, which is correct: the boundary is
  carried by `--border`, and selection is redundantly encoded via `border-2`,
  `font-semibold`, and a check glyph.

Deliberate asymmetry worth preserving: **variant chips** move focus with arrows but commit
with Space/Enter, because arrow-to-select would trigger a font load per keypress. **Theme
radiogroups** select on arrow, which is standard radio behavior. Both are commented in place.

---

## Not yet verified

Honest gaps, tracked rather than glossed:

1. **Skip-link paint under real `:focus-visible`.** The `sr-only focus:not-sr-only
   focus:fixed` pattern depends on CSS cascade order between `not-sr-only` (`position:
   static`) and `fixed` (`position: fixed`). Source review can't confirm which wins, and
   `app/page.tsx` uses `md:overflow-hidden`, which can clip an absolutely-positioned link.
   Needs a browser assertion that the focused link has a non-zero box inside the viewport.
2. **No automated axe coverage.** All findings above came from source review. An axe pass
   across all 12 scheme × mode combinations — including with popovers open — would catch
   what reading misses.
3. **Behavior at ~200 families is untested.** Keyboard access is now size-independent by
   design, but render performance, 200 concurrent `IntersectionObserver` instances, and
   whether `pinResidentFace` actually bounds `FontFace` residency across a full-list scroll
   are all unverified.
4. **`aria-controls` on the category menu** references a conditionally-rendered element, so
   the IDREF doesn't resolve while closed. Low impact, technically invalid.

Items 1–3 are specced in `docs/CURSOR_PROMPTS_HARDENING.md`.

---

## Enforcement

`npm run verify` runs lint, typecheck, guardrails, and tests. `scripts/guardrails.mjs`
fails CI on Tailwind palette classes, raw color literals outside two documented exemptions,
and DOM ids built from user data — the three rules that regress silently and are invisible
in review. Each exists because it has already been broken once.
