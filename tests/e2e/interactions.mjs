#!/usr/bin/env node
/**
 * Interaction check on imported pages (things screenshots can't show):
 * hovering the primary button changes its background, hovering a card lifts
 * it, and clicking an accordion title reveals its answer.
 *
 *   node tests/e2e/interactions.mjs --url "http://localhost:8888/?page_id=123&preview=true"
 */
import { BASE, launch, login, parseArgs } from './lib.mjs';

const args = parseArgs( process.argv.slice( 2 ) );
const url = args.url;
if ( ! url ) {
	console.error( 'Usage: --url <imported page URL>' );
	process.exit( 2 );
}

const { browser, page } = await launch();
await login( page );
await page.setViewportSize( { width: 1440, height: 900 } );
await page.goto( url.startsWith( 'http' ) ? url : `${ BASE }${ url }` );
await page.waitForLoadState( 'networkidle' );

const results = [];
const check = ( name, ok, detail ) => {
	results.push( { name, ok, detail } );
	console.log( `${ ok ? '✓' : '✗' } ${ name } — ${ detail }` );
};
const style = ( loc, props ) => loc.evaluate( ( el, ps ) => Object.fromEntries( ps.map( ( p ) => [ p, getComputedStyle( el ).getPropertyValue( p ) ] ) ), props );
const settle = () => page.waitForTimeout( 600 );

// Button hover: background changes.
const button = page.locator( '.elementor-button, .e-button, a.e-button-base, [data-widget_type^="e-button"] a, [data-widget_type^="e-button"] button' ).filter( { hasText: 'Get started' } ).first();
if ( await button.count() ) {
	await page.mouse.move( 0, 0 );
	await settle();
	const before = await style( button, [ 'background-color', 'transform' ] );
	await button.hover();
	await settle();
	const after = await style( button, [ 'background-color', 'transform' ] );
	check( 'button hover', before[ 'background-color' ] !== after[ 'background-color' ], `${ before[ 'background-color' ] } → ${ after[ 'background-color' ] }` );
} else {
	check( 'button hover', false, 'button not found' );
}

// Card hover: shadow appears.
const card = page.locator( '.e-con, .e-flexbox, [data-element_type="e-flexbox"]' ).filter( { hasText: 'AI planning' } ).filter( { hasNotText: 'Calendar sync' } ).last();
if ( await card.count() ) {
	await page.mouse.move( 0, 0 );
	await settle();
	const before = await style( card, [ 'box-shadow', 'transform' ] );
	await card.hover();
	await settle();
	const after = await style( card, [ 'box-shadow', 'transform' ] );
	check( 'card hover', before[ 'box-shadow' ] !== after[ 'box-shadow' ], `shadow ${ before[ 'box-shadow' ] } → ${ after[ 'box-shadow' ] }; transform ${ after.transform }` );
} else {
	check( 'card hover', false, 'card not found' );
}

// Accordion: all collapsed, clicking a title shows its answer.
const title = page.locator( '.e-n-accordion-item-title' ).filter( { hasText: 'Can my team use it?' } ).first();
if ( await title.count() ) {
	const answer = page.getByText( 'shared goals', { exact: false } ).first();
	const hiddenBefore = ! ( await answer.isVisible() );
	await title.click();
	await settle();
	const shownAfter = await answer.isVisible();
	check( 'accordion', hiddenBefore && shownAfter, `answer hidden before click: ${ hiddenBefore }, visible after: ${ shownAfter }` );
} else {
	check( 'accordion', false, 'accordion not found' );
}

await browser.close();
process.exit( results.every( ( r ) => r.ok ) ? 0 : 1 );
