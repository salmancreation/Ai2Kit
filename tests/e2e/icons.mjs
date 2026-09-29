#!/usr/bin/env node
/**
 * Icon audit on imported pages: every icon Elementor renders must be an
 * inline SVG with shapes, a visible size and a visible paint (no empty,
 * zero-size, invisible or missing-font icons).
 *
 *   node tests/e2e/icons.mjs --ids 470,458
 */
import { BASE, launch, login, parseArgs } from './lib.mjs';

const args = parseArgs( process.argv.slice( 2 ) );
const ids = String( args.ids ?? '' ).split( ',' ).filter( Boolean );
const { browser, page } = await launch();
await login( page );
await page.setViewportSize( { width: 1440, height: 900 } );
let bad = 0;

for ( const id of ids ) {
	await page.goto( `${ BASE }/?page_id=${ id }&preview=true` );
	await page.waitForLoadState( 'networkidle' );
	const report = await page.evaluate( () => {
		const sel = '.elementor-icon, .elementor-button-icon, .elementor-icon-list-icon, .e-n-accordion-item-title-icon > span, .e-svg-base, [data-widget_type^="e-svg"] .elementor-widget-container, [data-widget_type^="e-svg"]';
		const hosts = [ ...document.querySelectorAll( sel ) ].filter( ( h ) => ! h.closest( '.e-n-accordion-item-title-icon .e-opened' ) || h.matches( '.e-opened' ) );
		const problems = [];
		let ok = 0;
		const painted = ( el ) => {
			const cs = getComputedStyle( el );
			const fill = cs.fill !== 'none' && ! /rgba\(.*,\s*0\)$/.test( cs.fill ) && parseFloat( cs.fillOpacity ) > 0;
			const stroke = cs.stroke !== 'none' && parseFloat( cs.strokeWidth ) > 0 && parseFloat( cs.strokeOpacity ) > 0;
			return fill || stroke;
		};
		for ( const h of hosts ) {
			const svg = h.matches( 'svg' ) ? h : h.querySelector( 'svg' );
			const i = h.querySelector( 'i' );
			const where = ( h.closest( '[data-widget_type]' )?.getAttribute( 'data-widget_type' ) ?? '?' ) + ' ' + ( h.closest( '.elementor-element' )?.textContent ?? '' ).trim().slice( 0, 30 );
			if ( ! svg && ! i ) {
				// Closed/open accordion variants hide one of the pair by design.
				if ( h.closest( '.e-opened, .e-closed' ) && getComputedStyle( h ).display === 'none' ) continue;
				problems.push( `empty icon: ${ where }` );
				continue;
			}
			if ( i ) {
				const content = getComputedStyle( i, '::before' ).content;
				if ( ! content || content === 'none' || content === '""' ) problems.push( `font icon without glyph: ${ where }` );
				else ok++;
				continue;
			}
			if ( svg.closest( '[style*="display: none"], .e-opened' ) && ! svg.checkVisibility?.() ) continue;
			const shapes = [ ...svg.querySelectorAll( 'path,circle,ellipse,line,polyline,polygon,rect,text' ) ];
			const r = svg.getBoundingClientRect();
			if ( ! shapes.length ) problems.push( `svg without shapes: ${ where }` );
			else if ( svg.checkVisibility?.() !== false && ( r.width < 4 || r.height < 4 ) ) problems.push( `svg too small (${ r.width }x${ r.height }): ${ where }` );
			else if ( ! shapes.some( painted ) ) problems.push( `svg not painted: ${ where }` );
			else if ( ! svg.getAttribute( 'viewBox' ) ) problems.push( `svg without viewBox: ${ where }` );
			else ok++;
		}
		return { ok, problems };
	} );
	bad += report.problems.length;
	console.log( `page ${ id }: ${ report.ok } icons OK${ report.problems.length ? `, ${ report.problems.length } problems` : '' }` );
	report.problems.forEach( ( p ) => console.log( `  ✗ ${ p }` ) );
}
await browser.close();
process.exit( bad ? 1 : 0 );
