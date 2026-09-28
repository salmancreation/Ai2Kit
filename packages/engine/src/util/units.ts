import type { Box, StyleMap } from '../ir/types';

export function px( v: string | undefined | null ): number | null {
	if ( v === undefined || v === null ) return null;
	const m = String( v ).trim().match( /^(-?[\d.]+)px$/ );
	return m ? parseFloat( m[ 1 ]! ) : null;
}

/** Round to at most 2 decimals, dropping float noise from computed styles. */
export function round( n: number ): number {
	return Math.round( n * 100 ) / 100;
}

export function parseBox( s: Partial< StyleMap >, prop: 'padding' | 'margin' | 'border-width' ): Box | null {
	const key = ( side: string ): string => ( prop === 'border-width' ? `border-${ side }-width` : `${ prop }-${ side }` );
	const vals = [ 'top', 'right', 'bottom', 'left' ].map( ( side ) => px( s[ key( side ) ] ) );
	if ( vals.every( ( v ) => v === null ) ) return null;
	const [ top, right, bottom, left ] = vals.map( ( v ) => round( v ?? 0 ) ) as [ number, number, number, number ];
	return { top, right, bottom, left };
}

export type Shadow = { color: string; x: number; y: number; blur: number; spread: number; inset: boolean };

/** Parse the first shadow of a computed `box-shadow` (color first, as browsers serialize it). */
export function parseShadow( v: string | undefined ): Shadow | null {
	if ( ! v || v === 'none' ) return null;
	const first = splitTopLevel( v, ',' )[ 0 ]!.trim();
	const colorMatch = first.match( /(rgba?\([^)]*\)|#[0-9a-f]{3,8}|hsla?\([^)]*\))/i );
	const color = colorMatch ? colorMatch[ 1 ]! : 'rgba(0, 0, 0, 0.1)';
	const rest = first.replace( color, '' );
	const nums = ( rest.match( /-?[\d.]+px|\b0\b/g ) ?? [] ).map( ( n ) => parseFloat( n ) );
	return {
		color,
		x: nums[ 0 ] ?? 0,
		y: nums[ 1 ] ?? 0,
		blur: nums[ 2 ] ?? 0,
		spread: nums[ 3 ] ?? 0,
		inset: /\binset\b/.test( rest ),
	};
}

export function splitTopLevel( v: string, sep: string ): string[] {
	const out: string[] = [];
	let depth = 0;
	let cur = '';
	for ( const ch of v ) {
		if ( ch === '(' ) depth++;
		if ( ch === ')' ) depth--;
		if ( ch === sep && depth === 0 ) {
			out.push( cur );
			cur = '';
		} else {
			cur += ch;
		}
	}
	out.push( cur );
	return out;
}

export type Gradient = { angle: number; from: string; fromStop: number; to: string; toStop: number };

const DIRECTION_ANGLES: Record< string, number > = {
	'to top': 0,
	'to right': 90,
	'to bottom': 180,
	'to left': 270,
	'to top right': 45,
	'to right top': 45,
	'to bottom right': 135,
	'to right bottom': 135,
	'to bottom left': 225,
	'to left bottom': 225,
	'to top left': 315,
	'to left top': 315,
};

/** Parse a simple linear-gradient into Elementor's 2-stop model; extra stops keep first and last. */
export function parseLinearGradient( v: string | undefined ): Gradient | null {
	if ( ! v ) return null;
	const m = v.match( /linear-gradient\((.*)\)\s*$/ );
	if ( ! m ) return null;
	const parts = splitTopLevel( m[ 1 ]!, ',' ).map( ( p ) => p.trim() );
	let angle = 180;
	const head = parts[ 0 ] ?? '';
	if ( /deg$/.test( head ) ) {
		angle = parseFloat( head );
		parts.shift();
	} else if ( DIRECTION_ANGLES[ head ] !== undefined ) {
		angle = DIRECTION_ANGLES[ head ]!;
		parts.shift();
	}
	if ( parts.length < 2 ) return null;
	const stop = ( p: string, fallback: number ): { color: string; pos: number } => {
		const pm = p.match( /^(.*?)\s+(-?[\d.]+)%$/ );
		return pm ? { color: pm[ 1 ]!.trim(), pos: parseFloat( pm[ 2 ]! ) } : { color: p, pos: fallback };
	};
	const a = stop( parts[ 0 ]!, 0 );
	const b = stop( parts[ parts.length - 1 ]!, 100 );
	return { angle, from: a.color, fromStop: a.pos, to: b.color, toStop: b.pos };
}

const GENERIC_FAMILIES = new Set( [
	'serif',
	'sans-serif',
	'monospace',
	'cursive',
	'fantasy',
	'system-ui',
	'ui-sans-serif',
	'ui-serif',
	'ui-monospace',
	'ui-rounded',
	'-apple-system',
	'blinkmacsystemfont',
	'segoe ui',
	'roboto',
	'helvetica neue',
	'arial',
	'noto sans',
	'apple color emoji',
	'segoe ui emoji',
	'segoe ui symbol',
	'noto color emoji',
	'helvetica',
	'inherit',
] );

/** First non-generic family from a font-family stack, or null. */
export function firstFamily( stack: string | undefined ): string | null {
	if ( ! stack ) return null;
	for ( const raw of stack.split( ',' ) ) {
		const f = raw.trim().replace( /^["']|["']$/g, '' );
		if ( f && ! GENERIC_FAMILIES.has( f.toLowerCase() ) ) return f;
	}
	return null;
}

const KEYWORD_ANGLES: Record< string, number > = { ...DIRECTION_ANGLES };

/**
 * Normalize a computed linear-gradient to `Ndeg, color P%, …` with explicit
 * stops — the form Elementor's CSS → atomic converter understands. Direction
 * keywords become angles; missing stop positions are spread evenly.
 * Returns the input unchanged when it isn't a plain linear gradient.
 */
export function normalizeGradient( v: string ): string {
	const m = v.trim().match( /^linear-gradient\((.*)\)$/ );
	if ( ! m ) return v;
	const parts = splitTopLevel( m[ 1 ]!, ',' ).map( ( p ) => p.trim() );
	let angle = 180;
	const head = parts[ 0 ] ?? '';
	if ( /deg$/.test( head ) ) {
		angle = parseFloat( head );
		parts.shift();
	} else if ( KEYWORD_ANGLES[ head ] !== undefined ) {
		angle = KEYWORD_ANGLES[ head ]!;
		parts.shift();
	}
	if ( parts.length < 2 ) return v;
	const stops = parts.map( ( p, i ) => {
		const pm = p.match( /^(.*?)\s+(-?[\d.]+)%$/ );
		if ( pm ) return `${ pm[ 1 ]!.trim() } ${ round( parseFloat( pm[ 2 ]! ) ) }%`;
		if ( /\s-?[\d.]+(px|em|rem)$/.test( p ) ) return null; // Length stops can't be expressed as offsets.
		return `${ p } ${ round( ( i / ( parts.length - 1 ) ) * 100 ) }%`;
	} );
	if ( stops.some( ( s ) => s === null ) ) return v;
	return `linear-gradient(${ round( angle ) }deg, ${ stops.join( ', ' ) })`;
}

/**
 * Decompose a computed `matrix(a, b, c, d, e, f)` into translate/rotate/scale
 * functions (what Elementor's converter understands). Returns the input when
 * the matrix has skew or isn't a 2D matrix.
 */
export function decomposeMatrix( v: string ): string {
	const m = v.trim().match( /^matrix\(([^)]+)\)$/ );
	if ( ! m ) return v;
	const n = m[ 1 ]!.split( ',' ).map( ( x ) => parseFloat( x ) );
	if ( n.length !== 6 || n.some( ( x ) => Number.isNaN( x ) ) ) return v;
	const [ a, b, c, d, e, f ] = n as [ number, number, number, number, number, number ];
	if ( Math.abs( a * c + b * d ) > 1e-4 ) return v; // Skew.
	const sx = Math.sqrt( a * a + b * b );
	const sy = ( a * d - b * c ) / ( sx || 1 );
	const rot = ( Math.atan2( b, a ) * 180 ) / Math.PI;
	const fns: string[] = [];
	if ( Math.abs( e ) > 0.01 || Math.abs( f ) > 0.01 ) fns.push( `translate(${ round( e ) }px, ${ round( f ) }px)` );
	if ( Math.abs( rot ) > 0.01 ) fns.push( `rotate(${ round( rot ) }deg)` );
	if ( Math.abs( sx - 1 ) > 0.001 || Math.abs( sy - 1 ) > 0.001 ) fns.push( `scale(${ round( sx ) }, ${ round( sy ) })` );
	return fns.length ? fns.join( ' ' ) : 'none';
}
