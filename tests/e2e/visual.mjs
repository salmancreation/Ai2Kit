#!/usr/bin/env node
/**
 * Visual similarity between a source page and its converted Elementor page (PRD §12.4).
 *
 *   node tests/e2e/visual.mjs --source <url> --target <url> [--out dir]
 */
import { compare, launch, login, parseArgs } from './lib.mjs';

const args = parseArgs( process.argv.slice( 2 ) );
if ( ! args.source || ! args.target ) {
	console.error( 'Usage: node tests/e2e/visual.mjs --source <url> --target <url> [--out dir]' );
	process.exit( 1 );
}
const { browser, page } = await launch();
await login( page );
console.log( JSON.stringify( await compare( page, args.source, args.target, args.out ?? 'tests/e2e/output' ), null, 2 ) );
await browser.close();
