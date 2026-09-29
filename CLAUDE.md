# CLAUDE.md — Ai2Kit

Source of truth: [PRD.md](PRD.md) (product + architecture) and [DESIGN.md](DESIGN.md) (UI tokens + patterns). Read the relevant section before changing behaviour.

## Layout
```
packages/engine/     TS, zero runtime deps. capture → normalize → recognize → tokens → emit-v3 (+ score, detect)
packages/admin-ui/   React admin app (@wordpress/element), built with @wordpress/scripts → plugin/ai2kit/build
plugin/ai2kit/       Free WP plugin (PHP 7.4+, namespace ModinaTheme\Ai2Kit, PSR-4 in includes/)
tests/fixtures/      source/ (AI-built sites) · elementor/ (reference JSON exported from real Elementor)
```

## Commands
```
corepack pnpm@9.15.9 install
bash scripts/fetch-deps.sh                 # Elementor + Hello into .deps/ (wp-env mounts them)
npx wp-env start                           # http://localhost:8888  admin / password
pnpm --filter @ai2kit/engine test          # Vitest: engine unit + golden + registry validation
UPDATE_GOLDEN=1 pnpm --filter @ai2kit/engine test   # re-approve golden files after reviewing the diff
pnpm --filter @ai2kit/admin-ui build       # → plugin/ai2kit/build
composer install -d plugin/ai2kit
npm run test:php                           # PHPUnit unit suite (no WP needed)
npm run test:php:integration               # PHPUnit in wp-env with real WordPress + Elementor
npm run e2e                                # Playwright: upload → convert → import → pixelmatch at 3 widths (fails < 90%)
npm run lint:php                           # PHPCS (WordPress + PHPCompatibility 7.4) and PHPStan level 6 — both must be clean
npm run plugin-check                       # Official Plugin Check on the release build (mounted as ai2kit-release; checked as slug ai2kit)
node scripts/release.mjs                   # tests + build + zip → dist/ai2kit-x.y.z.zip
```

## Elementor reference data (never guess the JSON format)
- `tests/fixtures/elementor/controls-v3.json` — every control (name, type, options, responsive) for the container and each widget we emit, exported from a real install by `tests/tools/dump-controls.php` (run with `--context=admin`; see the file header). The emitter tests validate every emitted key and option value against it. Re-export when upgrading Elementor.
- `tests/fixtures/elementor/fa-free-icons.json` — Font Awesome icons bundled with Elementor Free; the Lucide map is tested against it.
- `tests/fixtures/elementor/atomic-schema.json` — v4 (Atomic) element prop schemas + the style schema, exported by `tests/tools/dump-atomic.php`. Atomic output is validated against it.
- `tests/tools/probe-converter.php` — shows how Elementor's CSS → atomic converter handles given declarations (native prop vs leftover). Re-run after Elementor upgrades.
- `tests/fixtures/elementor/generated/*.json` — golden conversions (v3 and v4).
- `tests/fixtures/captures/*.json` — real browser captures of the source fixtures (saved by `tests/e2e/convert.mjs --save-capture`); the engine's real-capture tests run on them.

## Gotchas learned the hard way
- Elementor strips settings equal to defaults on save (e.g. `content_width: boxed` disappears — that's fine).
- Containers default to 10px padding and a 20px gap from the kit: always write both.
- Nested containers default to `--width: 100%`; desktop widths don't reach mobile (`min_affected_device`), and mobile forces `--width:100%` + `flex-wrap: wrap` unless `*_mobile` values are set.
- Elementor lazy-loads section background images until scrolled into view (the e2e harness marks them loaded).
- Bind elements to global colors only when near-exact (ΔE < 1); ΔE < 3 is for clustering the palette.
- Capture records the *rendered* font (families that never loaded are dropped).
- `Requires Plugins: elementor` means Elementor must activate first (keep it first in .wp-env.json).
- v4: the engine emits typed content settings + plain CSS per breakpoint; PHP (`AtomicWriter`) converts the CSS with Elementor's own `Css_Converter` and validates with its `Style_Parser`/`Props_Parser`. Converter leftovers go to residual CSS keyed by the style class `e-{id}-a2k`.
- v4 base styles to override explicitly: e-flexbox `padding:10px`; e-button blue background, `padding:12px 24px`, `radius:2px`. Atomic text (`escaped-html`) strips all attributes except link href/target → styled inline text stays a v3 widget. Atomic font-family is a single (quoted) name → system stacks go to residual CSS. Converter-friendly forms: one-value `gap`, gradients as `Ndeg` + explicit stops, transforms as translate/rotate/scale (not `matrix()`), `width:auto` + `align-self` (not fit-content), grids need `grid-template-rows:none; grid-auto-rows:auto`.
- Any value computed at one breakpoint only must be carried to the others, or the diff "resets" it (`min-height: initial` bug).
- Hover: capture copies every `:hover` rule (last compound only; `group-hover` is skipped) with `[data-a2k-hover]` and diffs each element with transitions off. The capture's settle style zeroes transition durations — disable it while reading them. v3 → per-widget hover controls; v4 → `css.hover` block → style variant `state: hover`.
- Accordions (Free): Radix unmounts closed panels, so capture clicks each trigger open (React renders on a microtask — await), reads the panel, and restores state. Emitted as v3 `nested-accordion` (also inside v4 trees). Its defaults (1px #d5d8dc borders, 20px title, 10px padding, icon on the left) must be overridden; the Validator allows its child containers.
- Icons: always the source's own SVG (library `svg`, uploaded by MediaImporter), never a Font Awesome look-alike; FA is only the `fallback` the server uses if an SVG can't be imported. `serializeSvg` bakes computed paint (fill/stroke/…) onto every shape — CSS classes and `style=""` are stripped (and the PHP sanitizer drops `style`), so CSS-colored icons otherwise lose their color. Browsers report paint servers as absolute URLs: rewrite to `url(#id)` and copy shared `<defs>` in. Inline `<use>` sprites; guarantee a viewBox. Elementor draws button icons at 1em of the label (no size control → residual CSS on ` .elementor-button-icon svg`); icon-list gap = text_indent + 0.25em icon margin + 5px. Check with `npm run e2e:icons -- --ids …`.
- Elementor grids fall back to 1 column on mobile (`mobile_default`): write `grid_columns_grid_mobile` whenever the source isn't 1 column there. `line-height: normal` → 1.2em (unset, the theme's 1.5 applies).
- Unmappable styles (gradient text, transforms, filters) go to residual CSS: structured rules from the engine, validated and scoped to `.elementor-{id}` by `ResidualCss`, printed on `elementor/frontend/before_get_builder_content`.

## Coding rules (PRD §11)
- PHP: WordPress Coding Standards. Prefix everything `ai2kit_` / `AI2KIT_` / `ModinaTheme\Ai2Kit`. Sanitize in, escape out. `$wpdb->prepare` always. Every REST route has a `permission_callback`.
- TS: strict, no `any` in the engine. The engine is pure and deterministic — same input, same output (seeded ID generator per job).
- Each mapper rule is a small function with a unit test.
- Never hand-write Elementor JSON shapes without a fixture reference (`tests/fixtures/elementor/`).
- The browser output is never trusted: PHP re-validates and sanitizes everything (FR-23).
- Free makes zero external requests. No remote fonts/JS/CSS in admin.
- Save Elementor data through the document API (`documents->create()` / `$document->save()`), never raw post meta.
- UI components use semantic tokens only (`--a2k-bg-*`, `--a2k-text-*`), all scoped under `.ai2kit-app`.
- All user-facing strings translatable (`ai2kit` text domain), sentence case, `sprintf` with translator comments.
- Conventional commits: `feat(engine): …`, `fix(plugin): …`.
