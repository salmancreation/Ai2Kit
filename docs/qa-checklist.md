# Release QA checklist

Run before every release (PRD §12, item 8). Automated checks first, then the manual pass. Tick every box or note why it's skipped.

## Automated

- [ ] `pnpm --filter @ai2kit/engine test` — all pass
- [ ] `pnpm --filter @ai2kit/admin-ui test` — all pass
- [ ] `npm run test:php` and `npm run test:php:integration` — all pass
- [ ] `npm run lint:php` — PHPCS and PHPStan clean
- [ ] `npm run e2e` — every fixture ≥ 90% at desktop, tablet and mobile, in v3 and v4
- [ ] `npm run e2e:icons -- --ids …` and `npm run e2e:accordions -- --ids …` on the imported fixture pages
- [ ] `npm run plugin-check` — "No errors found"
- [ ] POT regenerated; `node scripts/i18n/build-po.mjs bn_BD` passes (no missing or stale strings)

## Manual — themes

Convert the Lovable fixture and one HTML template, import, then open the page on the front end with each theme:

- [ ] Hello Elementor
- [ ] Astra
- [ ] GeneratePress
- [ ] Kadence

## Manual — Elementor versions

- [ ] Oldest supported Elementor 3.x (v3 output only)
- [ ] Latest Elementor 4.x with the Atomic editor off (v3) and on (v4)

## Manual — admin

- [ ] Full flow with the keyboard only (Tab / Enter / Space / arrows), visible focus everywhere
- [ ] Light and dark theme
- [ ] `prefers-reduced-motion` on: no count-up, no slide animations
- [ ] **RTL**: switch the admin to an RTL locale (or use an RTL tester plugin) — layout mirrors, previews show, arrows point the right way (`node tests/e2e/screenshots.mjs --out … ` for the screens)
- [ ] **Bangla**: set your profile language to Bangla with the `bn_BD` files installed — every Ai2Kit string is translated (`node tests/e2e/screenshots.mjs --locale bn_BD --out …`)
- [ ] Other plugins' admin notices appear only in the "Site notices" pill, never inside the app
- [ ] Multisite: a site admin (not super admin) can convert plain HTML but not a React build

## Manual — safety

- [ ] Upload a ZIP with a `.php` file, a symlink and a `../` path — rejected or left out, with a clear message
- [ ] Paste HTML with `<script>` and `onerror=` as an editor-role user — scripts don't survive the import
- [ ] Undo after import removes the page and added images and restores the kit

## Release

- [ ] Version bumped in `ai2kit.php` (header + `AI2KIT_VERSION`), `readme.txt` (Stable tag), `package.json` files
- [ ] Changelog updated in `readme.txt`; "Tested up to" matches the latest WordPress
- [ ] Screenshots in `.wordpress-org/` still match the UI
- [ ] Tag `vX.Y.Z` and push — the deploy workflow publishes to WordPress.org
