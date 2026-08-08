# Typeshelf — pre-launch hardening prompts

Closes the two caveats Cursor flagged after the remediation pass, and replaces manual QA
claims with checks that run on every push.

Reuse the shared preamble from `CURSOR_PROMPTS.md`.

---

## First: reframing caveat (1)

Cursor flagged that a ~200-family load wasn't exercised. Worth being precise about what
that actually leaves untested, because the remediation changed the shape of the risk.

**Keyboard access at 200 families is no longer size-dependent.** That was the whole point of
R1 — the skip links mean the tab distance from page load to `#preview-pane` is fixed at 1,
whether the library holds 3 fonts or 3,000. Re-testing keyboard nav at scale would confirm
something the design now guarantees structurally.

What *is* genuinely untested at 200 families:

- **Render performance.** 200 families × 3 controls = ~600 DOM nodes plus 200
  `IntersectionObserver` instances (one per row, `FontFamilyListItem.tsx:53-64`).
- **The lazy face-loading path.** Each visible row calls `ensureFontFace()`. At scale, does
  `pinResidentFace` actually keep memory bounded, or does scrolling the list retain hundreds
  of `FontFace` objects?
- **The `sections` memo** in `FontLibraryContext.tsx`, which re-derives every section on any
  favorites/category/search change — it's O(sections × families) and runs on each keystroke
  in the search box.

That's a performance question, not an accessibility one. P2 below tests it as such.

---

## P1 — Automated accessibility tests in a real browser

> Closes caveat (2) properly. This is the single highest-value item in this file: it turns
> the accessibility claim in the README from an assertion into something CI proves.

```
Add automated accessibility testing with Playwright and axe-core.

WHY A REAL BROWSER: :focus-visible only resolves under genuine keyboard
interaction, and computed styles for CSS custom properties need a real layout
engine. jsdom cannot verify either, so vitest alone can't close this.

SETUP
- Add devDependencies: @playwright/test, @axe-core/playwright
- playwright.config.ts: chromium only (keep CI fast), webServer running
  `npm run build && npm run start` against http://localhost:3000, reuseExistingServer
  locally.
- Add scripts: "test:e2e": "playwright test"
- Put specs in e2e/. Make sure vitest.config.mts EXCLUDES e2e/ so `npm run test`
  and `npm run test:e2e` don't collide — vitest will otherwise try to run
  Playwright specs and fail confusingly.

SPEC 1 — e2e/a11y.spec.ts, axe scan across themes
- Load the app, click "Load 3 sample fonts", wait for the preview to render.
- For each of the 6 schemes × light and dark (12 combinations): set the theme via
  the UI (not by poking data attributes — exercise the real control), then run
  AxeBuilder with withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']) and assert
  zero violations.
- Scan twice per combination: once with the library populated, once with a font
  selected so the preview pane, metric controls, and variant group are all mounted.
- Also scan with the scheme popover OPEN — popovers are where ARIA breaks and a
  closed-state-only scan misses it entirely.

SPEC 2 — e2e/focus.spec.ts, focus indicator verification
This is the caveat that went unconfirmed. Assert paint, not just markup:
- Tab from page load; assert the first focused element is the "Skip to preview"
  link and that it is actually visible (not clipped, non-zero box, inside the
  viewport — the sr-only/focus:not-sr-only pattern fails silently if a parent
  clips it, and app/page.tsx uses md:overflow-hidden).
- Activate it; assert document.activeElement is #preview-pane.
- Repeat for "Skip to settings" -> #library-settings and "Skip past font list".
- For each of: sidebar search input, new-category input, a variant chip, a theme
  mode button, a scheme swatch, the metric number inputs, and both color menu
  triggers — focus via keyboard, then read getComputedStyle and assert a
  focus-visible indicator is actually painted (non-zero outline-width OR a
  box-shadow/ring that differs from the unfocused state). Compare focused vs
  unfocused computed styles rather than asserting a specific value, so the test
  survives a token change.
- Assert this holds in BOTH light and dark mode.

SPEC 3 — e2e/keyboard.spec.ts, the ARIA patterns from R3
- Scheme popover: open it, assert focus lands on the CHECKED swatch, arrow keys
  change the active theme (assert document.documentElement dataset.scheme
  changes), Escape closes it and returns focus to the trigger.
- Mode radiogroup: assert it is ONE tab stop and arrows move between options.
- Variant chips: assert one tab stop, arrows move focus WITHOUT changing
  selection, Space/Enter commits. This asymmetry with the theme groups is
  deliberate — assert it so nobody "fixes" it later.

CI: add a job that runs the e2e suite. Cache the Playwright browser download.
Do NOT block the existing lint/typecheck/test/build job on it — keep e2e a
separate job so a browser flake doesn't mask a real compile failure.

Report any real violations found rather than weakening assertions to make the
suite pass. If axe reports something that is a genuine false positive, exclude it
by specific rule id with a comment explaining why — never by disabling a tag.
```

---

## P2 — Scale and performance check

```
Verify the library holds up at realistic scale. See the reframing above — this is
a performance question, not a keyboard one.

A) UNIT: sections derivation at scale (test/librarySections.test.ts)
- Build 200 synthetic FontEntry objects across ~40 families with a stub
  ensureFontFace (no real font parsing — this tests the reducer and memo, not the
  parser).
- Assert the sections memo produces correct grouping, and that a search-query
  change re-derives in a reasonable budget. Do not assert a hard millisecond
  number — that's flaky in CI. Assert algorithmic behavior instead: the number of
  classifyFont calls should not grow superlinearly with families. Spy on it.
- Assert a family favorited AND category-overridden appears in exactly two
  sections, with distinct DOM-safe keys.

B) E2E: 200-family smoke (e2e/scale.spec.ts)
- Programmatically register ~200 faces before load (inject via a test-only route
  or seed localStorage plus stubbed FontFace — pick whichever is least invasive
  and document the choice).
- Assert: the list renders, scrolling to the bottom does not throw, and the number
  of resident FontFace objects stays bounded after scrolling the full list. That
  last one is the real risk — pinResidentFace is supposed to cap residency, and it
  has never been tested.
- Assert the skip links still reach #preview-pane in one activation with the full
  list rendered.

If B proves too invasive to seed cleanly, say so and ship A only — do not fake it
with 3 fonts and label it a scale test.
```

---

## P3 — Repo hygiene (do this before pushing anything else)

```
Housekeeping for a public repo.

1. DELETE the unused Next.js boilerplate in public/: file.svg, globe.svg,
   next.svg, vercel.svg, window.svg. Confirm zero references first.

2. MOVE process docs out of the repo root into docs/:
     CURSOR_PROMPTS.md -> docs/
     CURSOR_PROMPTS_REMEDIATION.md -> docs/
     CURSOR_PROMPTS_HARDENING.md -> docs/
   Keep them — they are the strongest artifact in this project — but a root
   cluttered with prompt files reads as scratch work. Add a short index in the
   README pointing at them as "how this was built".

3. DO NOT COMMIT PORTFOLIO_PLAN.md. It's personal planning for a different
   project. Add it to .gitignore or move it out of the repo entirely.

4. Add .github/ISSUE_TEMPLATE/bug_report.md and a short CONTRIBUTING.md covering:
   npm run verify before opening a PR, the tokens-only rule, and the guardrails
   escape hatch.

5. Verify README claims match reality. Every capability it lists must be true of
   the committed code, and the accessibility section must not claim more than the
   audit supports. Report any mismatch instead of quietly adjusting the docs.
```

---

## What NOT to build

Being explicit, because the temptation at this stage is to keep adding scaffolding:

- **Don't chase coverage percentages.** A reviewer looks at *what* you tested, not how much.
  The axe suite and the residency test above are worth more than 80% line coverage of
  getters.
- **Don't add component snapshot tests.** They break on every styling change, teach nobody
  anything, and get regenerated blindly.
- **Don't add Storybook.** It's a real cost to maintain and this app has ~9 components.
- **Don't add a mutation testing or bundle-size budget.** Wrong stage.
- **Don't write a CHANGELOG** until there's a v1 tag and someone other than you has used it.

---

## Release checklist

Run in order. Stop at the first failure.

```bash
# 1. Clean-clone build — catches imported-but-uncommitted files.
git clone <repo> /tmp/typeshelf-clean && cd /tmp/typeshelf-clean
npm ci && npm run build

# 2. Full local verification
npm run verify          # lint + typecheck + guardrails + unit tests
npm run test:e2e        # after P1 lands

# 3. Manual, five minutes, in a browser
#    - keyboard-only pass with samples loaded
#    - toggle all 6 schemes in light and dark
#    - resize to 320px width and to 200% zoom
#    - throw a deliberately corrupt .ttf at the upload zone; confirm the error
#      boundary catches it instead of white-screening
```

Item 1 is not optional. `origin/main` was in a non-building state at commit `a1a2614` —
`FontLibrarySidebar.tsx` imported `SampleFontsButton`, which had never been committed. A
clean-clone build is the only check that catches that class of mistake, and it is the first
thing a reviewer does.
