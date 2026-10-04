# CLAUDE.md — Ai2Kit

Source of truth: [PRD.md](PRD.md) (product + architecture) and [DESIGN.md](DESIGN.md) (UI tokens + patterns). Read the relevant section before changing behaviour.

## Layout
```
packages/engine/     TS, zero runtime deps. capture → normalize → recognize → tokens → emit-v3 (+ score, detect)
packages/admin-ui/   React admin app (@wordpress/element), built with @wordpress/scripts → plugin/ai2kit/build (engine.js + index.js)
plugin/ai2kit/       Free WP plugin (PHP 7.4+, namespace ModinaTheme\Ai2Kit, PSR-4 in includes/)
../Ai2Kit-Pro/       Pro add-on — a SEPARATE PRIVATE repo (this repo is public; never add Pro code here).
                     Local wp-env loads it via the gitignored .wp-env.override.json.
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
node scripts/i18n/build-po.mjs bn_BD       # Bangla .po from scripts/i18n/bn_BD.json (fails on missing/stale strings or placeholder mismatch)
node tests/e2e/screenshots.mjs --out .wordpress-org   # wp.org screenshots (--locale bn_BD for QA)
node scripts/wporg/assets.mjs              # wp.org icon + banners
npm run e2e:agent                          # agent tools over real MCP (STDIO): create job → browser converts → get-job → undo
# Pro (in ../Ai2Kit-Pro): npm test | npm run build | npm run release | npm run lint:php | npm run e2e:site
```
Docs: `docs/` (user docs + `docs/qa-checklist.md`, run before every release). CI: `.github/workflows/ci.yml`; tag `vX.Y.Z` → `deploy.yml` publishes to wp.org SVN.

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
- Accordions (Free): Radix unmounts closed panels, so capture clicks each trigger open (React renders on a microtask — await), reads the panel, and restores state. Emitted as v3 `nested-accordion` (also inside v4 trees). Its defaults (1px #d5d8dc borders, 20px title, 10px padding, icon on the left) must be overridden; the Validator allows its child containers. Native `<details>`: `<summary>` is the trigger; capture sets `details.open` (exclusive `name` groups close each other, so one-at-a-time is observed); icons come from the summary's SVG, a `::after` glyph ("+"→"−", captured in both states) or the browser marker (▸ → caret-right/down). Item padding goes on the title; `extraBottom` excludes it. Check behavior with `npm run e2e:accordions -- --ids …`.
- Icons: always the source's own SVG (library `svg`, uploaded by MediaImporter), never a Font Awesome look-alike; FA is only the `fallback` the server uses if an SVG can't be imported. `serializeSvg` bakes computed paint (fill/stroke/…) onto every shape — CSS classes and `style=""` are stripped (and the PHP sanitizer drops `style`), so CSS-colored icons otherwise lose their color. Browsers report paint servers as absolute URLs: rewrite to `url(#id)` and copy shared `<defs>` in. Inline `<use>` sprites; guarantee a viewBox. Elementor draws button icons at 1em of the label (no size control → residual CSS on ` .elementor-button-icon svg`); icon-list gap = text_indent + 0.25em icon margin + 5px. Check with `npm run e2e:icons -- --ids …`.
- Elementor grids fall back to 1 column on mobile (`mobile_default`): write `grid_columns_grid_mobile` whenever the source isn't 1 column there. `line-height: normal` → 1.2em (unset, the theme's 1.5 applies).
- Background layers (`normalize/layers.ts`): a content-free child that covers its parent (absolute, inset 0) and paints an image (`<img object-cover>` or a bg-image div) or a color/gradient (a `bg-black/50` div, or a `::before/::after` with `content:""` — captured as `pseudoLayers`) is merged into the parent as its background image + `bgOverlay` → v3 Background Overlay (opacity always stated; default is 0.5) / v4 top layer of the `background:` shorthand. Children are lifted first, so a layer may already carry its own overlay. v4 background images exist only after AtomicWriter converts CSS → `MediaImporter::process_styles` imports them.
- `boxSection` merges a centered inner box into the section: carry the section's vertical placement (align-items/justify-content flex-end/center) into the merged column.
- i18n: every visible string goes through `ai2kit`. Engine text (warnings, section labels, detection evidence) stays English in the engine (it's also Elementor `_title`s) and is translated in the UI by `packages/admin-ui/src/lib/engineText.ts` — add new engine messages there. Put `/* translators: */` directly before the `__()` call or minification drops it. After changing strings: rebuild the UI, `make-pot`, update `scripts/i18n/bn_BD.json`. WordPress.org language packs deliver translations (no `load_plugin_textdomain`); test locally by compiling into `wp-content/languages/plugins`.
- RTL: `@wordpress/scripts` builds `index-rtl.css` with rtlcss, which mirrors left/right, `transform-origin` and `translateX` automatically — never add manual `.rtl` overrides (they get flipped a second time). Direction icons use `--a2k-dir` (a variable rtlcss leaves alone). Test RTL with a `gettext_with_context` 'text direction' filter (flipping `$wp_locale` at `init` is too late for the stylesheets).
- Admin notices: core's common.js moves notices after the first `.wrap h1` — our React `<h1>` — unless there's an `hr.wp-header-end`; `Menu::render` prints one before the app root. Elementor's notices use `.e-notice`.
- Agent tools (`includes/Abilities.php`): WordPress Abilities (6.9+, guarded by `function_exists`) with `meta.public` + `meta.mcp.public`, so the MCP Adapter's default server exposes them via `mcp-adapter-discover-abilities` / `-execute-ability`. Elementor 4.3+ bundles the adapter (`vendor/wordpress/mcp-adapter`). The Abilities API validates input *and output* against the schemas — keep `summary()` and `job_schema()` in sync. Conversion needs a browser, so `create-job` returns `review_url` (`admin.php?page=ai2kit&job=…` → Convert loads `GET /jobs/{uuid}?upload=1` and starts at Check). Never accept remote URLs (SSRF). In integration tests the bundled adapter triggers a `WP_Abilities_Registry::get_registered` notice — `TestCase::assert_post_conditions` ignores it.
- Pro architecture: Free exposes an extension API, Pro plugs in. Engine: `registerExtension()` (`src/extend.ts`) with hooks `watch` (from page load), `captureDesktop`/`captureBreakpoint`, `detect` (any captured node; first match wins, before core rules), `emitV3`/`emitV4` (nodes with a pattern), `afterEmitV3`/`afterEmitV4` (every element). `CapturedNode.extra` → `IRNode.extra` carries extension capture data; `NodeStats.handled` marks patterns mapped natively (no "kept static" penalty/Pro hint). The engine is its own script (`window.ai2kit.engine`, handle `ai2kit-engine`); Pro's webpack maps `@ai2kit/engine` to it. Admin: `@wordpress/hooks` filters `ai2kit.check.pages`, `ai2kit.convert.morePages`, `ai2kit.import`. PHP: `ai2kit_enqueue_admin_scripts`, `ai2kit_admin_script_dependencies`, `ai2kit_admin_config`, `ai2kit_allowed_widgets`, `ai2kit_nested_widgets`, `ai2kit_import_result`, `ai2kit_undo_import`; constant `AI2KIT_EXTENSION_API`. No `isPro` checks in Free.
- Pro capture of on-demand content (tabs, dialogs): open it like a visitor (Radix Tabs select on mousedown, Dialog on click), `captureSubtree` with `stampSubtree` keys (document order, so re-mounted markup aligns at other widths), then restore the original state AND put the page's keys back on the re-mounted element — later core breakpoints need them.
- Nested Tabs defaults (#f1f2f3 titles, accent active, 15/35px padding, 10px gaps, 1px content border, accordion on mobile) must be overridden; the tab list's pill → residual CSS on ` .e-n-tabs-heading`. Containers use `css_classes` (widgets `_css_classes`).
- Multi-page: the preview shim opens SPA routes with `?a2k_route=/about`. Every page imports through Free's Importer with the same tokens (KitWriter is idempotent per job — the map is needed per page); keep the FIRST page's kit backup for Undo. Links between pages are rewritten after import (possessive path regex; URLs with a query are left alone).
- Shared header/footer templates render on Canvas pages via `elementor/page_templates/canvas/before|after_content`; their styles (incl. atomic v4) must be registered on `elementor/frontend/after_enqueue_styles` with `do_action( 'elementor/post/render', $id )` + Post CSS enqueue, or Elementor prints atomic styles only for the page.
- v4 entrance animations = element `interactions` `{ version: 1, items: [ interaction-item ] }` (shape from Elementor's Interactions module); Elementor sanitizes/validates them on save. v3 = `animation` (container) / `_animation` (widget) + `animation_duration`.
- e2e login: wp-login focuses the username field after load — wait, fill, verify both values, then poll the URL (the dashboard's load event can hang).
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
