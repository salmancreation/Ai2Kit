# Contributing to Ai2Kit

Thanks for helping! Ai2Kit is GPL-2.0-or-later; by contributing you agree your contribution is licensed the same way.

## Reporting a bad conversion

The most useful report includes the conversion report (*Ai2Kit → History → View report*), your WordPress, Elementor and PHP versions, and — if you're allowed to share it — the `.html` or `.zip` you converted. Use the **Bug report** issue form.

Security problems: report privately (see [SECURITY.md](SECURITY.md)).

## Code

1. Set up the project as in the [README](README.md) (`corepack pnpm@9.15.9 install`, `npx wp-env start`).
2. Keep changes small and focused; add or update a test for every converter rule (`packages/engine/test`).
3. Before opening a pull request, run:
   - `corepack pnpm@9.15.9 --filter @ai2kit/engine test`
   - `npm run lint:php` (WordPress Coding Standards + PHPStan)
   - `npm run e2e` for changes that affect output
4. Follow WordPress Coding Standards for PHP; prefix everything `ai2kit_` / `ModinaTheme\Ai2Kit`; sanitize input and escape output.
5. Every user-facing string is translatable with the `ai2kit` text domain.
6. Commit messages follow Conventional Commits, e.g. `fix(engine): keep icon list gaps on mobile`.

Never hand-write Elementor's JSON: reference data exported from a real Elementor install lives in `tests/fixtures/elementor/`.
