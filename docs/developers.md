# Developers

## Filters

### `ai2kit_max_upload_bytes`

Maximum upload size in bytes (default 50 MB). The server's own `upload_max_filesize`/`post_max_size` still apply.

```php
add_filter( 'ai2kit_max_upload_bytes', function () {
	return 100 * MB_IN_BYTES;
} );
```

## Building from source

The admin app (`plugin/ai2kit/build/`) is compiled from the TypeScript in this repository:

- `packages/engine` — the converter: capture → normalize → recognize → tokens → Elementor v3/v4 output. Pure and deterministic, no runtime dependencies.
- `packages/admin-ui` — the React admin screens (`@wordpress/element`, built with `@wordpress/scripts`).
- `plugin/ai2kit` — the WordPress plugin (PHP 7.4+).

```bash
corepack pnpm@9.15.9 install
pnpm --filter @ai2kit/admin-ui build    # → plugin/ai2kit/build
composer install -d plugin/ai2kit
```

A local WordPress with Elementor for development and tests:

```bash
bash scripts/fetch-deps.sh   # Elementor + Hello theme into .deps/
npx wp-env start             # http://localhost:8888  (admin / password)
```

Tests: `pnpm --filter @ai2kit/engine test` (engine), `npm run test:php`, `npm run test:php:integration`, `npm run e2e` (upload → convert → import → pixel comparison at three widths), `npm run lint:php`, `npm run plugin-check`. See `CLAUDE.md` for the full list.

## Translations

All strings use the `ai2kit` text domain.

- Template: `plugin/ai2kit/languages/ai2kit.pot` — regenerate after changing strings:

  ```bash
  npx wp-env run cli --env-cwd=wp-content/plugins/ai2kit wp i18n make-pot . languages/ai2kit.pot --slug=ai2kit --domain=ai2kit --exclude=vendor,tests,node_modules
  ```

- Translations are kept as `scripts/i18n/<locale>.json` and built into `translations/ai2kit-<locale>.po` with `node scripts/i18n/build-po.mjs <locale>` (it fails on missing strings or mismatched `%s`/`%d` placeholders). Once the plugin is on WordPress.org, import the `.po` into [translate.wordpress.org](https://translate.wordpress.org/) — language packs then reach every site automatically.
- Bangla (`bn_BD`) is complete.

## Releasing

`node scripts/release.mjs` runs the tests, builds the admin app, and produces `dist/ai2kit-<version>.zip`. Pushing a `v*` tag runs the GitHub Actions deploy to WordPress.org (see `.github/workflows/deploy.yml`); listing screenshots, banner and icon live in `.wordpress-org/`.

## Extension API (add-ons such as Ai2Kit Pro)

Ai2Kit Free contains no locked features. Add-ons extend it through documented hooks.

**Engine** (`window.ai2kit.engine`, script handle `ai2kit-engine`): `registerExtension( { name, watch, captureDesktop, captureBreakpoint, detect, emitV3, emitV4, afterEmitV3, afterEmitV4 } )`. With no extensions registered, output is unchanged. See `packages/engine/src/extend.ts`.

**Admin app** (`@wordpress/hooks`): `ai2kit.check.pages` (the Check step's "Pages" row), `ai2kit.convert.morePages` (convert further pages of a job), `ai2kit.import` (import several pages).

**PHP:** `ai2kit_enqueue_admin_scripts`, `ai2kit_admin_script_dependencies`, `ai2kit_admin_config`, `ai2kit_allowed_widgets`, `ai2kit_nested_widgets`, `ai2kit_import_result`, `ai2kit_undo_import`. Check `AI2KIT_EXTENSION_API` (currently `1`) before using them.
