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
node scripts/release.mjs                   # tests + build + zip → dist/ai2kit-x.y.z.zip
```

## Elementor reference data (never guess the JSON format)
- `tests/fixtures/elementor/controls-v3.json` — every control (name, type, options, responsive) for the container and each widget we emit, exported from a real install by `tests/tools/dump-controls.php` (run with `--context=admin`; see the file header). The emitter tests validate every emitted key and option value against it. Re-export when upgrading Elementor.
- `tests/fixtures/elementor/fa-free-icons.json` — Font Awesome icons bundled with Elementor Free; the Lucide map is tested against it.
- `tests/fixtures/elementor/generated/*.json` — golden conversions.

## Gotchas learned the hard way
- Elementor strips settings equal to defaults on save (e.g. `content_width: boxed` disappears — that's fine).
- Containers default to 10px padding and a 20px gap from the kit: always write both.
- Nested containers default to `--width: 100%`; desktop widths don't reach mobile (`min_affected_device`), and mobile forces `--width:100%` + `flex-wrap: wrap` unless `*_mobile` values are set.
- Elementor lazy-loads section background images until scrolled into view (the e2e harness marks them loaded).
- Bind elements to global colors only when near-exact (ΔE < 1); ΔE < 3 is for clustering the palette.
- Capture records the *rendered* font (families that never loaded are dropped).

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
