# Bundled sample fonts

Loaded by `components/SampleFontsButton.tsx` so a first-time visitor with no font
files still has something to preview.

| File | Upstream family | Category | License |
|------|-----------------|----------|---------|
| `Tinos-Regular.ttf` | [Tinos](https://github.com/googlefonts/tinos) (Liberation / STIX lineage) | Serif | SIL Open Font License 1.1 |
| `Cousine-Regular.ttf` | [Cousine](https://github.com/googlefonts/cousine) (Liberation Mono lineage) | Monospace | SIL Open Font License 1.1 |
| `Silkscreen-Regular.ttf` | [Silkscreen](https://github.com/googlefonts/silkscreen) | Display | SIL Open Font License 1.1 |

Full license text: [`OFL.txt`](./OFL.txt).

## These are subsets, not complete fonts

Each file is an ASCII Latin subset of the OFL original from the
[google/fonts](https://github.com/google/fonts) tree (`ofl/tinos`, `ofl/cousine`,
`ofl/silkscreen`), shared with `test/fixtures/fonts/`. Glyph coverage is trimmed to keep
the repo small — they are demo material, not fonts for design work.

The OFL permits redistributing modified versions provided the original copyright and
license notices travel with them, which `OFL.txt` satisfies. The Reserved Font Name clause
is why these keep their upstream family names rather than being renamed.

## Gap worth closing

There is no **sans-serif** in this set, which is the category most visitors will expect to
see first. Adding one OFL sans (Inter, Open Sans, and Work Sans are all suitable) would
make the demo materially more representative. Ship the full face rather than a subset if
size allows — these three are subsets only because they started life as test fixtures.
