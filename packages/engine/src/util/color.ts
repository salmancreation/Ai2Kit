/** Color parsing and comparison. Pure; no DOM. */

export type RGBA = { r: number; g: number; b: number; a: number };

const clamp = ( n: number, lo: number, hi: number ): number => Math.min( hi, Math.max( lo, n ) );

function hslToRgb( h: number, s: number, l: number ): [ number, number, number ] {
	const hue = ( ( h % 360 ) + 360 ) % 360;
	const sat = clamp( s, 0, 1 );
	const lig = clamp( l, 0, 1 );
	const c = ( 1 - Math.abs( 2 * lig - 1 ) ) * sat;
	const x = c * ( 1 - Math.abs( ( ( hue / 60 ) % 2 ) - 1 ) );
	const m = lig - c / 2;
	let rgb: [ number, number, number ];
	if ( hue < 60 ) rgb = [ c, x, 0 ];
	else if ( hue < 120 ) rgb = [ x, c, 0 ];
	else if ( hue < 180 ) rgb = [ 0, c, x ];
	else if ( hue < 240 ) rgb = [ 0, x, c ];
	else if ( hue < 300 ) rgb = [ x, 0, c ];
	else rgb = [ c, 0, x ];
	return [ Math.round( ( rgb[ 0 ] + m ) * 255 ), Math.round( ( rgb[ 1 ] + m ) * 255 ), Math.round( ( rgb[ 2 ] + m ) * 255 ) ];
}

function parseAlpha( raw: string | undefined ): number {
	if ( raw === undefined ) return 1;
	const v = raw.trim();
	return v.endsWith( '%' ) ? parseFloat( v ) / 100 : parseFloat( v );
}

export function parseColor( input: string | undefined | null ): RGBA | null {
	if ( ! input ) return null;
	const s = input.trim().toLowerCase();
	if ( s === 'transparent' ) return { r: 0, g: 0, b: 0, a: 0 };

	const hex = s.match( /^#([0-9a-f]{3,8})$/ );
	if ( hex ) {
		let h = hex[ 1 ]!;
		if ( h.length === 3 || h.length === 4 ) h = h.split( '' ).map( ( c ) => c + c ).join( '' );
		if ( h.length !== 6 && h.length !== 8 ) return null;
		return {
			r: parseInt( h.slice( 0, 2 ), 16 ),
			g: parseInt( h.slice( 2, 4 ), 16 ),
			b: parseInt( h.slice( 4, 6 ), 16 ),
			a: h.length === 8 ? parseInt( h.slice( 6, 8 ), 16 ) / 255 : 1,
		};
	}

	const fn = s.match( /^(rgba?|hsla?)\(([^)]+)\)$/ );
	if ( ! fn ) return null;
	const [ body, alphaPart ] = fn[ 2 ]!.split( '/' );
	const parts = body!.split( /[\s,]+/ ).filter( Boolean );
	if ( parts.length < 3 ) return null;
	const alpha = parseAlpha( alphaPart ?? parts[ 3 ] );

	if ( fn[ 1 ]!.startsWith( 'rgb' ) ) {
		const ch = ( v: string ): number => ( v.endsWith( '%' ) ? ( parseFloat( v ) / 100 ) * 255 : parseFloat( v ) );
		return { r: Math.round( ch( parts[ 0 ]! ) ), g: Math.round( ch( parts[ 1 ]! ) ), b: Math.round( ch( parts[ 2 ]! ) ), a: alpha };
	}
	const [ r, g, b ] = hslToRgb( parseFloat( parts[ 0 ]! ), parseFloat( parts[ 1 ]! ) / 100, parseFloat( parts[ 2 ]! ) / 100 );
	return { r, g, b, a: alpha };
}

/** shadcn stores tokens as bare HSL triplets: `--primary: 222.2 47.4% 11.2%`. */
export function hslTripletToHex( triplet: string ): string | null {
	const t = triplet.trim().replace( /^hsla?\(|\)$/g, '' );
	const m = t.match( /^(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/ );
	if ( ! m ) return null;
	const [ r, g, b ] = hslToRgb( parseFloat( m[ 1 ]! ), parseFloat( m[ 2 ]! ) / 100, parseFloat( m[ 3 ]! ) / 100 );
	return toHex( { r, g, b, a: 1 } );
}

export function toHex( c: RGBA ): string {
	const h = ( n: number ): string => clamp( Math.round( n ), 0, 255 ).toString( 16 ).padStart( 2, '0' );
	const base = `#${ h( c.r ) }${ h( c.g ) }${ h( c.b ) }`;
	return ( c.a < 1 ? base + h( c.a * 255 ) : base ).toUpperCase();
}

/** Normalize any CSS color to uppercase hex (with alpha when < 1). */
export function normalizeColor( input: string | undefined ): string | null {
	const c = parseColor( input );
	return c ? toHex( c ) : null;
}

export function isTransparent( input: string | undefined ): boolean {
	const c = parseColor( input );
	return ! c || c.a === 0;
}

function toLab( c: RGBA ): [ number, number, number ] {
	const lin = ( v: number ): number => {
		const s = v / 255;
		return s <= 0.04045 ? s / 12.92 : Math.pow( ( s + 0.055 ) / 1.055, 2.4 );
	};
	const r = lin( c.r );
	const g = lin( c.g );
	const b = lin( c.b );
	const x = ( r * 0.4124 + g * 0.3576 + b * 0.1805 ) / 0.95047;
	const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
	const z = ( r * 0.0193 + g * 0.1192 + b * 0.9505 ) / 1.08883;
	const f = ( t: number ): number => ( t > 0.008856 ? Math.cbrt( t ) : 7.787 * t + 16 / 116 );
	return [ 116 * f( y ) - 16, 500 * ( f( x ) - f( y ) ), 200 * ( f( y ) - f( z ) ) ];
}

/** CIE76 ΔE. Good enough for clustering (PRD FR-19 uses ΔE < 3). */
export function deltaE( a: RGBA, b: RGBA ): number {
	const [ l1, a1, b1 ] = toLab( a );
	const [ l2, a2, b2 ] = toLab( b );
	return Math.sqrt( ( l1 - l2 ) ** 2 + ( a1 - a2 ) ** 2 + ( b1 - b2 ) ** 2 );
}

export function chroma( c: RGBA ): number {
	const [ , a, b ] = toLab( c );
	return Math.sqrt( a * a + b * b );
}

export function luminance( c: RGBA ): number {
	return toLab( c )[ 0 ];
}
