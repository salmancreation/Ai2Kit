/** Shared e2e helpers: browser, login, screenshots, pixel comparison. */
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const BASE = process.env.A2K_BASE ?? 'http://localhost:8888';
export const WIDTHS = { desktop: 1440, tablet: 1024, mobile: 390 };

export function parseArgs( argv ) {
	const out = {};
	for ( let i = 0; i < argv.length; i++ ) {
		if ( argv[ i ].startsWith( '--' ) ) out[ argv[ i ].slice( 2 ) ] = argv[ i + 1 ]?.startsWith( '--' ) ? true : argv[ ++i ] ?? true;
	}
	return out;
}

/** The newest cached Playwright headless shell, when Playwright's own build isn't downloaded. */
function cachedShell() {
	const cache = join( homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright' );
	const shells = existsSync( cache ) ? readdirSync( cache ).filter( ( d ) => d.startsWith( 'chromium_headless_shell-' ) ).sort().reverse() : [];
	for ( const dir of shells ) {
		for ( const sub of readdirSync( join( cache, dir ) ) ) {
			const bin = join( cache, dir, sub, 'chrome-headless-shell' );
			if ( existsSync( bin ) ) return bin;
		}
	}
	return undefined;
}

export async function launch() {
	let browser;
	if ( process.env.A2K_CHROMIUM ) {
		browser = await chromium.launch( { executablePath: process.env.A2K_CHROMIUM } );
	} else {
		try {
			browser = await chromium.launch();
		} catch ( e ) {
			const fallback = cachedShell();
			if ( ! fallback ) throw e;
			browser = await chromium.launch( { executablePath: fallback } );
		}
	}
	const context = await browser.newContext( { deviceScaleFactor: 1, viewport: { width: 1440, height: 900 } } );
	return { browser, context, page: await context.newPage() };
}

/** Log in with the local wp-env test account (override with A2K_USER / A2K_PASS). */
export async function login( page ) {
	const user = process.env.A2K_USER ?? 'admin';
	const pass = process.env.A2K_PASS ?? 'password';
	await page.goto( `${ BASE }/wp-login.php`, { waitUntil: 'load' } );
	// wp-login.php focuses and selects the username field shortly after load: let it, then fill and check.
	await page.waitForTimeout( 400 );
	for ( let attempt = 0; attempt < 3; attempt++ ) {
		await page.fill( '#user_login', user );
		await page.fill( '#user_pass', pass );
		if ( ( await page.inputValue( '#user_login' ) ) === user && ( await page.inputValue( '#user_pass' ) ) === pass ) break;
		await page.waitForTimeout( 300 );
	}
	// The first request after a rebuild can be slow: wait for the login to land, not for one navigation.
	await page.click( '#wp-submit' );
	for ( let waited = 0; new URL( page.url() ).pathname.endsWith( '/wp-login.php' ); waited += 250 ) {
		if ( waited > 90000 ) {
			const why = ( await page.locator( '#login_error' ).textContent().catch( () => '' ) ) || '';
			throw new Error( `Login did not complete (still on wp-login.php). ${ why.trim() }` );
		}
		await page.waitForTimeout( 250 );
	}
}

export async function shot( page, url, width ) {
	await page.setViewportSize( { width, height: 900 } );
	await page.goto( url, { waitUntil: 'networkidle' } );
	await page.addStyleTag( { content: '*,*::before,*::after{transition:none!important;animation-duration:1ms!important;animation-delay:0s!important;caret-color:transparent!important}' } );
	await page.evaluate( async () => {
		for ( let y = 0; y < document.body.scrollHeight; y += 600 ) {
			window.scrollTo( 0, y );
			await new Promise( ( r ) => setTimeout( r, 30 ) );
		}
		window.scrollTo( 0, 0 );
	} );
	// Elementor lazy-loads section backgrounds on scroll; mark them loaded so the shot is deterministic.
	await page.evaluate( () => document.querySelectorAll( '.e-con.e-parent' ).forEach( ( e ) => e.classList.add( 'e-lazyloaded' ) ) );
	await page.waitForTimeout( 300 );
	return PNG.sync.read( await page.screenshot( { fullPage: true } ) );
}

function crop( png, w, h ) {
	const out = new PNG( { width: w, height: h } );
	PNG.bitblt( png, out, 0, 0, w, h, 0, 0 );
	return out;
}

function sideBySide( a, b, diff ) {
	const out = new PNG( { width: a.width + b.width + diff.width + 40, height: Math.max( a.height, b.height, diff.height ) } );
	out.data.fill( 255 );
	PNG.bitblt( a, out, 0, 0, a.width, a.height, 0, 0 );
	PNG.bitblt( b, out, 0, 0, b.width, b.height, a.width + 20, 0 );
	PNG.bitblt( diff, out, 0, 0, diff.width, diff.height, a.width + b.width + 40, 0 );
	return out;
}

/** Similarity per breakpoint; height drift counts as mismatch. Writes side-by-side PNGs. */
export async function compare( page, source, target, outDir ) {
	mkdirSync( outDir, { recursive: true } );
	const report = {};
	for ( const [ name, width ] of Object.entries( WIDTHS ) ) {
		const a = await shot( page, source, width );
		const b = await shot( page, target, width );
		const w = Math.min( a.width, b.width );
		const h = Math.min( a.height, b.height );
		const diff = new PNG( { width: w, height: h } );
		const changed = pixelmatch( crop( a, w, h ).data, crop( b, w, h ).data, diff.data, w, h, { threshold: 0.1, includeAA: false } );
		const total = w * Math.max( a.height, b.height );
		report[ name ] = {
			similarity: Math.round( ( 1 - ( changed + w * Math.abs( a.height - b.height ) ) / total ) * 1000 ) / 10,
			sourceHeight: a.height,
			targetHeight: b.height,
		};
		writeFileSync( join( outDir, `${ name }-compare.png` ), PNG.sync.write( sideBySide( a, b, diff ) ) );
	}
	const values = Object.values( report ).map( ( r ) => r.similarity ).sort( ( x, y ) => x - y );
	report.median = values[ 1 ];
	return report;
}
