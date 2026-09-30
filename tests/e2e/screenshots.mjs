#!/usr/bin/env node
/**
 * Admin screenshots — the six wp.org screenshots (readme "== Screenshots ==")
 * and locale/RTL QA shots (PRD §12 manual QA: RTL admin, Bangla locale).
 *
 *   node tests/e2e/screenshots.mjs --out dist/wporg-assets [--file tests/fixtures/source/lovable-spa-dist.zip] [--locale bn_BD] [--dark]
 *
 * With --locale, only the admin user's language is switched (and restored).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE, launch, login, parseArgs } from './lib.mjs';

const args = parseArgs( process.argv.slice( 2 ) );
const out = resolve( args.out ?? 'dist/wporg-assets' );
const file = resolve( args.file ?? 'tests/fixtures/source/lovable-spa-dist.zip' );
const locale = args.locale;
mkdirSync( out, { recursive: true } );

const wp = ( ...cmd ) => execFileSync( 'npx', [ 'wp-env', 'run', 'cli', 'wp', ...cmd ], { stdio: 'pipe' } ).toString();
if ( locale ) wp( 'user', 'meta', 'update', 'admin', 'locale', locale );

const { browser, page } = await launch();
try {
	await login( page );
	await page.setViewportSize( { width: 1280, height: 860 } );
	await page.emulateMedia( { colorScheme: args.dark ? 'dark' : 'light' } );
	const shot = async ( n, name ) => {
		await page.waitForTimeout( 400 );
		const path = `${ out }/${ locale ? `${ locale }-` : '' }screenshot-${ n }.png`;
		await page.screenshot( { path } );
		console.log( `  ${ n }. ${ name } → ${ path }` );
	};

	// 1. Upload + detected source.
	await page.goto( `${ BASE }/wp-admin/admin.php?page=ai2kit` );
	await page.waitForSelector( '#ai2kit-root input[type=file]', { state: 'attached' } );
	await page.setInputFiles( '#ai2kit-root input[type=file]', file );
	await page.locator( '#ai2kit-root button:enabled' ).filter( { hasText: /.+/ } ).last().waitFor();
	await page.waitForTimeout( 1500 );
	await shot( 1, 'Upload and source detection' );

	// 2. Preflight checks.
	await page.locator( '#ai2kit-root .a2k-actionbar button, #ai2kit-root button' ).filter( { hasText: /Continue|চালিয়ে যান/ } ).first().click();
	await page.waitForTimeout( 1500 );
	await shot( 2, 'Preflight checks' );

	// 3. Live conversion progress (captured mid-run).
	await page.locator( '#ai2kit-root button' ).filter( { hasText: /Start conversion|কনভার্সন শুরু করুন/ } ).first().click();
	await page.waitForTimeout( 1200 );
	await shot( 3, 'Conversion progress' );

	// 4. Review with section scores; 5. design tokens.
	await page.locator( '#ai2kit-root button' ).filter( { hasText: /Import to WordPress|WordPress-এ ইমপোর্ট করুন/ } ).first().waitFor( { timeout: 90000 } );
	await page.waitForTimeout( 1500 );
	await shot( 4, 'Review sections' );
	const tokensTab = page.locator( '#ai2kit-root [role=tab], #ai2kit-root button' ).filter( { hasText: /^(Tokens|টোকেন)$/ } ).first();
	if ( await tokensTab.count() ) {
		await tokensTab.click();
		await shot( 5, 'Design tokens' );
	}

	// 6. Done.
	await page.locator( '#ai2kit-root button' ).filter( { hasText: /Import to WordPress|WordPress-এ ইমপোর্ট করুন/ } ).first().click();
	await page.locator( '#ai2kit-root' ).getByText( /Your site is in Elementor\.|আপনার সাইট এখন Elementor-এ।/ ).waitFor( { timeout: 90000 } );
	await shot( 6, 'Import done' );

	// QA extras: History and Settings.
	await page.goto( `${ BASE }/wp-admin/admin.php?page=ai2kit-history` );
	await page.waitForTimeout( 1500 );
	await shot( 7, 'History' );
	await page.goto( `${ BASE }/wp-admin/admin.php?page=ai2kit-settings` );
	await page.waitForTimeout( 1200 );
	await shot( 8, 'Settings' );
} finally {
	await browser.close();
	if ( locale ) wp( 'user', 'meta', 'delete', 'admin', 'locale' );
}
