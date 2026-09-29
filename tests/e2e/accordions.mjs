#!/usr/bin/env node
/**
 * Accordion behavior on imported pages: every accordion starts as saved
 * (collapsed unless the source opened one), each title opens a non-empty
 * answer, and one-at-a-time accordions close the previous item.
 *
 *   node tests/e2e/accordions.mjs --ids 674,678
 */
import { BASE, launch, login, parseArgs } from './lib.mjs';

const args = parseArgs( process.argv.slice( 2 ) );
const ids = String( args.ids ?? '' ).split( ',' ).filter( Boolean );
const { browser, page } = await launch();
await login( page );
await page.setViewportSize( { width: 1440, height: 900 } );
let bad = 0;
const fail = ( msg ) => {
	bad++;
	console.log( `  ✗ ${ msg }` );
};

for ( const id of ids ) {
	await page.goto( `${ BASE }/?page_id=${ id }&preview=true` );
	await page.waitForLoadState( 'networkidle' );
	const widgets = page.locator( '.elementor-widget-n-accordion' );
	const n = await widgets.count();
	console.log( `page ${ id }: ${ n } accordion(s)` );
	for ( let w = 0; w < n; w++ ) {
		const acc = widgets.nth( w );
		const settings = JSON.parse( ( await acc.getAttribute( 'data-settings' ) ) ?? '{}' );
		const one = ( settings.max_items_expended ?? 'one' ) === 'one';
		const items = acc.locator( '.e-n-accordion-item' );
		const count = await items.count();
		const openAtStart = await items.evaluateAll( ( els ) => els.filter( ( e ) => e.hasAttribute( 'open' ) ).length );
		if ( settings.default_state === 'all_collapsed' && openAtStart ) fail( `accordion ${ w + 1 }: ${ openAtStart } item(s) open at load` );
		for ( let i = 0; i < count; i++ ) {
			const item = items.nth( i );
			if ( ! ( await item.evaluate( ( e ) => e.hasAttribute( 'open' ) ) ) ) await item.locator( '> summary' ).click();
			await page.waitForTimeout( 500 );
			const answer = ( await item.locator( '> .e-con' ).innerText().catch( () => '' ) ).trim();
			if ( ! answer ) fail( `accordion ${ w + 1 } item ${ i + 1 }: empty or hidden answer` );
		}
		const openNow = await items.evaluateAll( ( els ) => els.filter( ( e ) => e.hasAttribute( 'open' ) ).length );
		if ( one && openNow !== 1 ) fail( `accordion ${ w + 1 }: one-at-a-time but ${ openNow } open` );
		if ( ! one && openNow !== count ) fail( `accordion ${ w + 1 }: multiple but only ${ openNow }/${ count } open` );
		console.log( `  accordion ${ w + 1 }: ${ count } items, ${ one ? 'one at a time' : 'multiple' }, all answers open with text` );
	}
}
await browser.close();
process.exit( bad ? 1 : 0 );
