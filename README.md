# Ai2Kit — AI Website to Elementor Converter

Ai2Kit is a free WordPress plugin that converts websites built with AI tools — **Lovable, Bolt, v0, Claude, ChatGPT, Gemini Canvas** — and HTML templates into **native, editable Elementor pages**: real containers, headings, buttons, images, icons, icon lists and accordions, not an iframe or an HTML embed.

- Runs in your browser and saves on your server — no calls to Ai2Kit servers, no tracking.
- Colors and fonts become Elementor Global Colors & Fonts.
- Every section gets a match score before import; one click undoes an import.
- Works with Elementor's free version; outputs classic (v3) or Atomic (v4) elements.

**Status:** submitted to the WordPress.org plugin directory (slug `ai2kit`), awaiting review.

User documentation: [`docs/`](docs/README.md) · Plugin readme: [`plugin/ai2kit/readme.txt`](plugin/ai2kit/readme.txt)

## Where the code is

| Path | What |
|---|---|
| [`plugin/ai2kit/`](plugin/ai2kit) | The WordPress plugin (PHP 7.4+). This folder, plus the built `build/`, is what ships. |
| [`packages/engine/`](packages/engine) | The converter, in TypeScript: capture → normalize → recognize → design tokens → Elementor v3/v4 output. |
| [`packages/admin-ui/`](packages/admin-ui) | The wp-admin screens (React via `@wordpress/element`). |
| [`tests/`](tests) | Fixtures (AI-built sites and reference Elementor data), end-to-end tests and tools. |

The plugin's `build/` folder is **compiled** from `packages/admin-ui` and `packages/engine` with [`@wordpress/scripts`](https://www.npmjs.com/package/@wordpress/scripts). It isn't committed; build it as below.

## Build from source

Requirements: Node.js 20+ (with Corepack) and PHP 7.4+ with Composer (for tests and linting only).

```bash
corepack pnpm@9.15.9 install --frozen-lockfile
corepack pnpm@9.15.9 --filter @ai2kit/admin-ui build    # → plugin/ai2kit/build/
```

That produces exactly the `build/` files shipped in the release ZIP. To build the whole release ZIP (runs the tests first):

```bash
node scripts/release.mjs      # → dist/ai2kit-<version>.zip
```

## Develop and test

```bash
bash scripts/fetch-deps.sh                       # Elementor + Hello theme for the local site
npx wp-env start                                 # http://localhost:8888 (admin / password)
corepack pnpm@9.15.9 --filter @ai2kit/engine test   # converter unit + golden tests
composer install -d plugin/ai2kit && npm run test:php
npm run lint:php                                 # WordPress Coding Standards + PHPStan
npm run e2e                                      # upload → convert → import → visual comparison
```

See [`docs/developers.md`](docs/developers.md) for filters, the extension API and translations.

## Ai2Kit Pro

Ai2Kit Pro is a separate, commercial add-on (whole-site conversion, header/footer, menus, forms, tabs, carousels and more). It is **not** part of this repository; it plugs into Ai2Kit through the documented extension API. Everything in this repository is free and unlimited.

## Contributing and security

Bug reports are welcome in [Issues](https://github.com/salmancreation/Ai2Kit/issues) — include the report from *Ai2Kit → History → View report*. Please report security problems privately: see [`SECURITY.md`](SECURITY.md).

## License

GPL-2.0-or-later. See [`LICENSE`](LICENSE). © ModinaTheme
