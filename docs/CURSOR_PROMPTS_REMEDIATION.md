# Typeshelf — accessibility remediation prompts

Companion to `CURSOR_PROMPTS.md`. Fixes the findings in `docs/ACCESSIBILITY_AUDIT.md`.
**Reuse the shared preamble from `CURSOR_PROMPTS.md`** — same two hard rules apply
(tokens only, verify Next.js/Tailwind APIs against `node_modules`).

Paste in order. R1 is the Level A failure; R2–R4 are quick. Commit between each.

---

## R1 — Skip links + landmark names `2.4.1 Level A`

> **One decision before you paste.** See "Scope note" below — it changes what you ask for.

```
Fix a Level A keyboard trap: there is no way to bypass the font library.

THE PROBLEM
app/page.tsx renders <FontLibrarySidebar /> before <PreviewPane />. Each row in
FontFamilyListItem.tsx has THREE tab stops: the favorite star (L94), the family
button (L113), and the category select (L139). With "Load my installed fonts",
queryLocalFonts() commonly returns 300-1000+ faces => 200-400 families =>
600-1200 tab stops before a keyboard user reaches the preview controls.

Worse: <ThemeControls /> and <PreferencesBackup /> are the LAST children of the
sidebar (FontLibrarySidebar.tsx, after the font list <div>). So switching to dark
mode by keyboard also requires tabbing the entire library.

FIX

1. Add TWO skip links as the first focusable elements in <body> in app/layout.tsx,
   before <Providers>:
     - "Skip to preview"  -> #preview-pane
     - "Skip to settings" -> #library-settings
   Style them sr-only until focused (sr-only + focus:not-sr-only), positioned
   absolute at top-left with a high z-index, a solid --surface background, a
   --border outline, and enough padding to clear a 24x24px target. They must
   render ABOVE the app when focused, not behind it — the layout uses
   md:overflow-hidden, so verify the skip link is not clipped. If it is, position
   it fixed rather than absolute.

2. components/PreviewPane.tsx — give the <main> (L156) id="preview-pane" and
   tabIndex={-1} so focus actually lands there rather than merely scrolling.
   Add aria-label="Font preview".

3. components/FontLibrarySidebar.tsx — add aria-label="Font library" to the
   <aside> (L140). Wrap <ThemeControls /> and <PreferencesBackup /> (the last two
   children) in a <div id="library-settings" tabIndex={-1}> with
   aria-label="Library settings" and role="group".

4. Add a visible-on-focus "Skip past font list" link immediately BEFORE the
   scrollable font list container (the <div data-font-list>) targeting
   #library-settings. Same sr-only/focus treatment.

5. Verify focus rings on all skip links meet 3:1 — reuse the existing pattern:
   focus-visible:ring-2 focus-visible:ring-[var(--ink)]
   focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]

DO NOT reorder DOM to put settings before the font list. Visual order and DOM
order must stay in sync (WCAG 1.3.2 Meaningful Sequence) — skip links are the
correct tool here, CSS reordering is not.

VERIFY: with ~200 families loaded, Tab from page load must reach the preview
controls in at most 3 keypresses.
```

### Scope note — read before pasting R1

Skip links fix the Level A failure and take ~30 lines. They are the right immediate move.

But they're a workaround. The *correct* fix is that the font list is semantically a
**listbox**, and should be one tab stop navigated by arrow keys — the same roving-tabindex
pattern `VariantChips.tsx` already implements correctly.

I'm not recommending that today, for one reason: each row has three interactive controls
(star, family, category select), which makes it a `role="grid"` composite widget rather than
a simple listbox. That's a genuinely fiddly pattern to get right and a bad thing to
vibecode under time pressure. Skip links now, grid refactor as a tracked follow-up issue —
which is also a good OSS "help wanted" ticket.

---

## R2 — Kill user-data-derived DOM ids `1.3.1`, `4.1.2`

```
Fix duplicate DOM ids that break label association.

PROBLEM 1 — components/FontFamilyListItem.tsx L136-140:

  <label className="sr-only" htmlFor={`cat-${family}`}>Category for {family}</label>
  <select id={`cat-${family}`} …>

A favorited font renders TWICE — once under Favorites, once under its category
(FontLibraryContext.tsx builds both section lists from the same family). Both
instances emit id="cat-Inter". Duplicate ids mean htmlFor resolves to the first
match only, so the second select has no accessible name.

Family names are also not id-safe: "Noto Sans JP", "P22 Underground", names with
dots or quotes.

FIX: import useId from react, call it once in the component, use it for the
select id and the label htmlFor. Never interpolate user data into an id.

PROBLEM 2 — components/ThemeControls.tsx L188: id="theme-mode-label" is
hardcoded. If ThemeControls is ever rendered twice it collides. Use useId()
(the file already imports it and uses it for menuId/labelId).

VERIFY: render a favorited font and confirm both instances have distinct ids and
both selects expose an accessible name.
```

---

## R3 — Scheme popover: wrong role, no focus move, no arrow keys `4.1.2`, `2.4.3`

```
Two related fixes in components/ThemeControls.tsx.

A) IT IS NOT A DIALOG (L124, L156)

The trigger declares aria-haspopup="dialog" and the popup declares
role="dialog", but nothing moves focus into the container on open and there is
no focus trap. A screen reader user hears "dialog", focus stays on the trigger,
and nothing indicates the swatches exist.

FIX:
- Remove role="dialog" and aria-labelledby from the popup container; it is a
  popover wrapping a radiogroup, not a dialog.
- Change the trigger to aria-haspopup="true" (keep aria-expanded and
  aria-controls, and point aria-controls at the radiogroup element).
- On open, move focus to the CHECKED swatch. Use a ref + useEffect keyed on
  schemeMenuOpen. The existing Escape handling and outside-pointerdown close
  behavior are correct — keep them, including returning focus to the trigger
  on close (closeMenu already does this).
- Keep the existing tabIndex={schemeMenuOpen ? 0 : -1} guard so closed swatches
  stay out of the tab order, but see (B) — it becomes a roving tabindex.

B) BOTH RADIOGROUPS LACK ARROW-KEY NAVIGATION

role="radio" inside role="radiogroup" sets a WAI-ARIA APG expectation that the
group is ONE tab stop navigated with arrow keys. Currently the three mode
buttons (L198-219) are three separate tab stops, and the six swatches are all
tabbable when open.

FIX: implement roving tabindex + ArrowLeft/Right/Up/Down + Home/End for BOTH
the scheme radiogroup (L169) and the mode radiogroup (L194).

components/VariantChips.tsx L98-147 already implements exactly this pattern
correctly. MIRROR IT — do not invent a second approach. Note that VariantChips
deliberately separates focus movement from selection (arrows move, Space/Enter
commits) because arrow-to-select would trigger a font load per keypress. That
reasoning does NOT apply to themes: for the theme radiogroups, arrow keys SHOULD
select immediately, which is the standard radio behavior. Implement it that way
and leave a comment explaining why the two differ.

C) While in this file — the CheckIcon at L26-42 hardcodes stroke="#ffffff".
Against the spectrum swatch's gold stop (#d4a017) that is 2.38:1, under the 3:1
non-text minimum. Selection is redundantly signalled by ring-2 ring-[var(--ink)]
so it is not a hard failure, but add a subtle dark drop-shadow or outline to the
check so it holds on every stop of the conic gradient.
```

---

## R4 — Focus indicators, token misuse, dark-mode artifact `2.4.7`, `1.4.3`

```
Four small fixes.

A) FOCUS RINGS ON THE TWO SIDEBAR TEXT INPUTS  (2.4.7)

components/FontLibrarySidebar.tsx L161 (search) and L198 (new category name)
both use outline-none with ONLY focus:border-[var(--accent)].

Computed contrast between the unfocused and focused border color:
  light  #8f877f -> #d9614f = 1.03:1
  dark   #8a8178 -> #e07a6a = 1.30:1

The border changes hue but not lightness, so the indicator is invisible to
colorblind and low-vision users.

FIX: add the same ring every other control in the app already uses:
  focus-visible:ring-2 focus-visible:ring-[var(--ink)]
  focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]
Keep the border change as a secondary cue.

Then audit the whole components/ directory: every element with outline-none must
have a paired focus-visible:ring-*. Report any you find that I missed.

B) HARDCODED WHITE INSET SHADOW  (dark mode artifact)

components/PreviewPane.tsx L273:
  shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]

This is a light-mode bevel. In dark mode it paints a 40%-white hairline across
the top of the preview surface.

FIX: add an --inset-highlight token to app/globals.css. Light: keep the current
rgba(255,255,255,0.4). Dark: use a much lower alpha (around 0.06) or transparent.
Reference it as shadow-[inset_0_1px_0_var(--inset-highlight)].

C) --border USED AS TEXT COLOR  (1.4.3)

components/PreviewPane.tsx L176 and L178 — the "·" separators between style /
weight / source use text-[var(--border)]. That is 3.45:1 in light mode, under
the 4.5:1 text minimum. --border is documented in globals.css as a boundary
token; this uses it outside its contract.

FIX: mark the separator spans aria-hidden and switch them to
text-[var(--ink-faint)], or drop them and use flex gap. Prefer the flex gap —
it removes decorative text from the accessibility tree entirely.

D) SMALL SEMANTIC GAPS

- components/PreviewPane.tsx L253: the contrast readout ("4.8:1 · AA") is a bare
  <span> with no relationship to either color picker. Give it an id and reference
  it via aria-describedby from BOTH PreviewColorMenu triggers.
- components/PreviewPane.tsx L424: the metric number inputs accept 4-800px and
  -20 to 200%, but nothing communicates the range — typing 900 silently clamps to
  800. Add aria-describedby pointing at visually-hidden range text.
- components/FontUploadZone.tsx L41: role="button" on a <div> with tabIndex={0}.
  Confirm the <input type="file"> is NOT a descendant — nested interactive content
  inside role="button" is invalid. If it is, hoist it out as a sibling.
```

---

## R5 — Deferred (needs a design decision from you, not a prompt)

**M5, category select is mouse-only.** `FontFamilyListItem.tsx:148` uses
`opacity-0 group-hover:opacity-100`. It's keyboard-reachable and becomes visible on focus,
so it's not a hard failure — but "move a font to a category" is a core feature that is
invisible until you hover the exact row, and touch users have no hover state at all.

Three options, all defensible:

1. Show it persistently at `--ink-faint` (3.39:1, already cleared for icon chrome). Cheapest;
   adds visual noise to every row.
2. Replace with a `⋯` overflow button that opens a small menu. Cleaner rows, one more click,
   and you'd need the menu keyboard pattern.
3. Drag-and-drop onto category headers, with the select kept as the accessible fallback.
   Best feel, most work, and DnD needs a keyboard equivalent to stay conformant.

I'd take (1) now and (2) later, but it's a visual-density call on your own product.

---

## Verification after R1–R4

```
Run a full accessibility regression on the changes:

1. npm run lint && npm run test && npm run build — all must pass.
2. Keyboard-only pass, no mouse: load ~200 font families, then confirm
   (a) Tab reaches the preview controls within 3 keypresses,
   (b) Tab reaches theme controls within 3 keypresses,
   (c) every focused element has a visibly distinct indicator in BOTH light and
       dark mode across all 6 schemes,
   (d) the scheme popover opens with focus on the checked swatch, arrows change
       the theme, Escape closes and returns focus to the trigger.
3. grep the components directory for `outline-none` and confirm each has a
   paired focus-visible:ring-*. Report the list.
4. grep for `id={` and confirm no id interpolates user data.
5. Confirm no hardcoded color literals remain: search for `rgba(`, `rgb(`, `#`
   followed by 3/6 hex digits, and Tailwind palette class names, across
   components/ and app/. Report anything found.
```

Item 5 exists because my earlier "zero hardcoded colors" claim was wrong — I grepped only
for Tailwind palette classes and missed the `rgba()` in an arbitrary value. Make Cursor
check all four forms.
