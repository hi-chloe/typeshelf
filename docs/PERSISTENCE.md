# Preferences persistence

Typeshelf keeps library organization prefs (favorites, custom categories,
category overrides, theme, and preview colors) behind a small
`PreferencesStore` interface. Font face bytes and system-font enumeration
results are never persisted or exported.

## Default: local only

`createPreferencesStore()` returns `LocalPreferencesStore`, which reads and
writes `localStorage` under `typeshelf:prefs:v2`. Private browsing / quota
errors are swallowed; the in-memory React state remains usable.

SSR uses `MemoryPreferencesStore` so the server never touches `localStorage`.

## Storage shape

```json
{
  "version": 2,
  "favorites": ["Inter"],
  "customCategories": ["Display"],
  "categoryOverrides": { "Inter": "Sans-serif" },
  "theme": { "scheme": "ember", "mode": "system" },
  "previewColor": null,
  "previewBgColor": null
}
```

`version` drives a forward-only migration chain in `lib/prefs/migrate.ts`.
Adding a third schema revision means:

1. Bump `PREFS_VERSION` to `3`.
2. Add `PREFS_MIGRATIONS[2] = (data) => ({ ...data, /* new fields */ })`.
3. Extend `validatePreferences` / `LibraryPreferences` as needed.

Legacy product keys (`font-explorer:library-prefs:v1` … `v4`) are read once,
written forward to `typeshelf:prefs:v2`, and **left in place** for one release
so rollback remains possible.

## Export / import

The sidebar offers **Export settings** / **Import settings**. Exports are plain
JSON (same schema + `app: "typeshelf"` + `exportedAt`). Imports run through the
same migration + validation path as disk loads. Font files are never included —
that is intentional and the honest open-source default for cross-device portability
without infrastructure.

## Adding a remote backend (not shipped)

`RemotePreferencesStore` is a stub that throws `"not configured"`. To implement
a real backend:

1. Replace the stub methods with authenticated `fetch` (or your client SDK).
2. Gate construction on **environment variables only**, e.g.
   `NEXT_PUBLIC_TYPESHELF_PREFS_URL` (and any public client keys). Never hardcode
   credentials or tenant IDs in source.
3. In `createPreferencesStore()`:
   - If the env vars are unset/empty → return `LocalPreferencesStore` (self-hosters
     keep today’s behavior).
   - If set → construct the remote store, optionally wrap with a local cache, and
     **degrade to local** when the remote constructor or first `load()` fails.
4. Implement `subscribe` if the backend supports live sync; otherwise omit it.
5. Keep the hydrate path optimistic: local cache / `LocalPreferencesStore.loadSync()`
   must still paint settings before the network round-trip settles. Do not introduce
   a blocking loading screen for prefs.

Do **not** add auth providers, databases, or network packages unless a follow-up
explicitly enables them. This document is the contract; the stub is the placeholder.
