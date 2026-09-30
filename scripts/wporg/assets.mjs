#!/usr/bin/env node
/** Render the WordPress.org listing icon and banners from assets.html into .wordpress-org/. */
import { resolve } from 'node:path';
import { launch } from '../../tests/e2e/lib.mjs';

const root = resolve( import.meta.dirname, '../..' );
const out = resolve( root, '.wordpress-org' );
const { browser, page } = await launch();
await page.goto( `file://${ resolve( import.meta.dirname, 'assets.html' ) }` );
for ( const [ sel, name, scale ] of [
	[ '#icon', 'icon-256x256.png', 1 ],
	[ '#icon', 'icon-128x128.png', 0.5 ],
	[ '#banner', 'banner-1544x500.png', 1 ],
	[ '#banner', 'banner-772x250.png', 0.5 ],
] ) {
	await page.evaluate( ( s ) => ( document.body.style.zoom = String( s ) ), scale );
	await page.locator( sel ).screenshot( { path: `${ out }/${ name }` } );
	console.log( `✓ .wordpress-org/${ name }` );
}
await browser.close();
