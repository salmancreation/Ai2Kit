#!/usr/bin/env node
/**
 * End-to-end (PRD §12.4): upload → check → convert → review → import in the
 * real admin UI, then compare the source and the Elementor page at 3 widths.
 *
 *   node tests/e2e/convert.mjs --file tests/fixtures/source/static-landing.zip [--format v3|v4] [--out dir] [--min 85]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE, compare, launch, login, parseArgs } from './lib.mjs';

const args = parseArgs( process.argv.slice( 2 ) );
const file = resolve( args.file ?? 'tests/fixtures/source/static-landing.zip' );
const out = args.out ?? 'tests/e2e/output';
const t = ( label ) => {
	const start = Date.now();
	return () => console.error( `  ${ label }: ${ ( ( Date.now() - start ) / 1000 ).toFixed( 1 ) }s` );
};

const { browser, page } = await launch();
page.on( 'pageerror', ( e ) => console.error( 'Page error:', e.message ) );
await login( page );

await page.goto( `${ BASE }/wp-admin/admin.php?page=ai2kit` );
await page.waitForSelector( '#ai2kit-root input[type=file]', { state: 'attached' } );

let done = t( 'upload' );
await page.setInputFiles( '#ai2kit-root input[type=file]', file );
await page.getByRole( 'button', { name: 'Continue' } ).and( page.locator( ':enabled' ) ).waitFor();
done();
const detected = await page.locator( '#ai2kit-root [aria-expanded]' ).filter( { hasText: '%' } ).first().textContent();
console.error( `  detected: ${ detected }` );
await page.getByRole( 'button', { name: 'Continue' } ).click();
if ( args.format ) {
	await page.getByLabel( 'Elementor format' ).selectOption( args.format );
	console.error( `  format: ${ args.format }` );
}

await page.getByRole( 'button', { name: 'Start conversion' } ).and( page.locator( ':enabled' ) ).click();
done = t( 'convert' );
await page.getByRole( 'button', { name: 'Import to WordPress' } ).waitFor( { timeout: 90000 } );
done();
const summary = await page.locator( '#ai2kit-root h1 + p' ).first().textContent();
if ( args[ 'save-capture' ] ) {
	const capture = await page.evaluate( () => window.__ai2kitLastCapture );
	writeFileSync( args[ 'save-capture' ], JSON.stringify( capture ) );
	console.error( `  capture saved: ${ args[ 'save-capture' ] }` );
}
console.error( `  review: ${ summary }` );

done = t( 'import' );
await page.getByRole( 'button', { name: 'Import to WordPress' } ).click();
await page.getByText( 'Your site is in Elementor.' ).waitFor( { timeout: 90000 } );
done();

const viewUrl = await page.getByRole( 'link', { name: 'View' } ).first().getAttribute( 'href' );
const sourceUrl = await page.evaluate( () => document.querySelector( 'iframe[title="Source site preview"]' )?.getAttribute( 'src' ) ?? null );
const jobSrc = sourceUrl ?? ( await page.evaluate( () => [ ...document.querySelectorAll( 'iframe' ) ].map( ( f ) => f.src ).find( ( s ) => s.includes( '/ai2kit/jobs/' ) ) ?? null ) );

// The review preview iframe is gone after import; recover the job's entry URL from History's data.
const entry = jobSrc ?? ( await page.evaluate( async () => {
	const res = await window.wp.apiFetch( { path: '/ai2kit/v1/jobs' } );
	return res[ 0 ]?.entryUrl ?? null;
} ) );
const target = `${ viewUrl }${ viewUrl.includes( '?' ) ? '&' : '?' }ai2kit_compare=1`;
console.error( `  source: ${ entry }\n  target: ${ target }` );

done = t( 'compare' );
const report = await compare( page, entry, target, out );
done();
console.log( JSON.stringify( { reviewSummary: summary, ...report }, null, 2 ) );
await browser.close();

if ( args.min && report.median < Number( args.min ) ) {
	console.error( `✗ median similarity ${ report.median }% is below ${ args.min }%` );
	process.exit( 1 );
}
