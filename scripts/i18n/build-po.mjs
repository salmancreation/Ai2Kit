#!/usr/bin/env node
/**
 * Build a .po file from the plugin's POT and a translation map
 * (scripts/i18n/<locale>.json: msgid → msgstr, or [singular, plural]).
 *
 *   node scripts/i18n/build-po.mjs bn_BD
 *
 * Fails when a string is untranslated, a translation is stale (no longer in
 * the POT), or placeholders (%s, %d, %1$s …) differ from the source — a
 * mismatch would break sprintf at runtime.
 *
 * Output: translations/ai2kit-<locale>.po — for import into
 * translate.wordpress.org once the plugin is approved (wp.org language packs
 * then deliver it; the plugin doesn't load bundled translations).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '../..' );
const locale = process.argv[ 2 ];
if ( ! locale ) {
	console.error( 'Usage: build-po.mjs <locale>' );
	process.exit( 2 );
}
const PLURAL_FORMS = { bn_BD: 'nplurals=2; plural=(n != 1);' };

const pot = readFileSync( resolve( root, 'plugin/ai2kit/languages/ai2kit.pot' ), 'utf8' );
const map = JSON.parse( readFileSync( resolve( root, `scripts/i18n/${ locale }.json` ), 'utf8' ) );

const unquote = ( block ) => ( block.match( /"((?:[^"\\]|\\.)*)"/g ) ?? [] ).map( ( q ) => JSON.parse( q ) ).join( '' );
const quote = ( s ) => JSON.stringify( s ).replace( /\\u([0-9a-f]{4})/gi, ( m, h ) => String.fromCharCode( parseInt( h, 16 ) ) );
const field = ( entry, name ) => {
	const m = new RegExp( `^${ name } ((?:".*"\\n?)+)`, 'm' ).exec( entry );
	return m ? unquote( m[ 1 ] ) : undefined;
};
const placeholders = ( s ) => ( s.match( /%(\d+\$)?[sd]|%%/g ) ?? [] ).sort().join( ' ' );

const [ header, ...entries ] = pot.trim().split( /\n\n/ );
const problems = [];
const used = new Set();
const out = [];

out.push(
	header
		.replace( /^"Language: .*\\n"$/m, '' )
		.replace( /^"Language-Team: .*\\n"$/m, `"Language-Team: Bengali (Bangladesh)\\n"` )
		.replace( /^"Plural-Forms: .*\\n"$/m, '' )
		.replace( /\n+$/, '' ) + `\n"Language: ${ locale }\\n"\n"Plural-Forms: ${ PLURAL_FORMS[ locale ] ?? 'nplurals=2; plural=(n != 1);' }\\n"`
);

for ( const entry of entries ) {
	const id = field( entry, 'msgid' );
	const plural = field( entry, 'msgid_plural' );
	// Keep comments and msgid/msgid_plural blocks as they are in the POT.
	const head = entry.replace( /\nmsgstr(\[\d\])? ".*"(\n".*")*/g, '' );
	const tr = map[ id ];
	used.add( id );
	if ( tr === undefined ) {
		problems.push( `untranslated: ${ id }` );
		continue;
	}
	if ( plural !== undefined ) {
		if ( ! Array.isArray( tr ) || tr.length !== 2 ) {
			problems.push( `needs [singular, plural]: ${ id }` );
			continue;
		}
		// Plural forms: each form must keep the placeholders its source form has (a form may drop %d).
		if ( placeholders( tr[ 1 ] ) !== placeholders( plural ) ) problems.push( `placeholders differ (plural): ${ id }` );
		out.push( `${ head }\nmsgstr[0] ${ quote( tr[ 0 ] ) }\nmsgstr[1] ${ quote( tr[ 1 ] ) }` );
	} else {
		if ( typeof tr !== 'string' ) {
			problems.push( `needs a string: ${ id }` );
			continue;
		}
		if ( placeholders( tr ) !== placeholders( id ) ) problems.push( `placeholders differ: ${ id } → ${ tr }` );
		out.push( `${ head }\nmsgstr ${ quote( tr ) }` );
	}
}
for ( const k of Object.keys( map ) ) if ( ! used.has( k ) ) problems.push( `stale (not in POT): ${ k }` );

if ( problems.length ) {
	console.error( problems.map( ( p ) => `✗ ${ p }` ).join( '\n' ) );
	process.exit( 1 );
}
const file = resolve( root, `translations/ai2kit-${ locale }.po` );
mkdirSync( dirname( file ), { recursive: true } );
writeFileSync( file, out.join( '\n\n' ) + '\n' );
console.log( `✓ ${ entries.length } strings → translations/ai2kit-${ locale }.po` );
