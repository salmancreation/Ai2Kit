/**
 * Design-token extraction (FR-19, FR-20) and matching (FR-21).
 */
import type { CaptureMeta, ColorToken, FontToken, IRNode, TokenTable } from '../ir/types';
import { chroma, deltaE, hslTripletToHex, luminance, normalizeColor, parseColor } from '../util/color';
import { firstFamily, px, round } from '../util/units';

function shortHash( s: string ): string {
	let h = 0x811c9dc5;
	for ( let i = 0; i < s.length; i++ ) h = Math.imul( h ^ s.charCodeAt( i ), 0x01000193 );
	return ( h >>> 0 ).toString( 16 ).padStart( 8, '0' ).slice( 0, 4 );
}

const customId = ( name: string ): string => `a2k${ shortHash( name ) }`;

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

const SHADCN_SYSTEM: Array< [ string, string, string ] > = [
	// [ shadcn var, Elementor system id, title ]
	[ 'primary', 'primary', 'Primary' ],
	[ 'secondary', 'secondary', 'Secondary' ],
	[ 'foreground', 'text', 'Text' ],
	[ 'accent', 'accent', 'Accent' ],
];

const SHADCN_CUSTOM: Array< [ string, string ] > = [
	[ 'background', 'Background' ],
	[ 'card', 'Card' ],
	[ 'muted', 'Muted' ],
	[ 'muted-foreground', 'Muted text' ],
	[ 'border', 'Border' ],
	[ 'primary-foreground', 'On primary' ],
	[ 'secondary-foreground', 'On secondary' ],
	[ 'accent-foreground', 'On accent' ],
	[ 'destructive', 'Destructive' ],
	[ 'ring', 'Ring' ],
];

export function colorsFromShadcn( vars: Record< string, string > ): ColorToken[] | null {
	if ( ! vars.primary || ! vars.background || ! vars.foreground ) return null;
	const out: ColorToken[] = [];
	const seen = new Set< string >();
	for ( const [ v, id, title ] of SHADCN_SYSTEM ) {
		const hex = vars[ v ] ? hslTripletToHex( vars[ v ]! ) ?? normalizeColor( vars[ v ] ) : null;
		if ( ! hex ) continue;
		out.push( { id, title, hex, system: true, usage: 0 } );
		seen.add( hex );
	}
	for ( const [ v, title ] of SHADCN_CUSTOM ) {
		const hex = vars[ v ] ? hslTripletToHex( vars[ v ]! ) ?? normalizeColor( vars[ v ] ) : null;
		if ( ! hex || seen.has( hex ) ) continue;
		out.push( { id: customId( v ), title, hex, system: false, usage: 0 } );
		seen.add( hex );
	}
	return out;
}

type ColorUse = { hex: string; weight: number; role: 'text' | 'bg' | 'button' | 'border' };

export function collectColors( root: IRNode ): ColorUse[] {
	const out: ColorUse[] = [];
	const visit = ( n: IRNode ): void => {
		const s = n.styles.desktop;
		const area = ( n.rect?.w ?? 0 ) * ( n.rect?.h ?? 0 );
		const textLen = ( n.content?.text ?? '' ).length;
		if ( ( n.kind === 'text' || n.kind === 'heading' || n.kind === 'button' || n.kind === 'list' ) && s.color ) {
			const hex = normalizeColor( s.color );
			if ( hex && hex.length === 7 ) out.push( { hex, weight: Math.max( 1, textLen ) * ( n.kind === 'heading' ? 2 : 1 ), role: 'text' } );
		}
		const bg = s[ 'background-color' ];
		const bgHex = normalizeColor( bg );
		if ( bgHex && bgHex.length === 7 ) {
			out.push( { hex: bgHex, weight: n.kind === 'button' ? 4000 : Math.max( 1, area / 250 ), role: n.kind === 'button' ? 'button' : 'bg' } );
		}
		const bc = s[ 'border-top-color' ];
		if ( ( px( s[ 'border-top-width' ] ) ?? 0 ) > 0 && bc ) {
			const h = normalizeColor( bc );
			if ( h && h.length === 7 ) out.push( { hex: h, weight: 20, role: 'border' } );
		}
		n.children.forEach( visit );
	};
	visit( root );
	return out;
}

type Cluster = { hex: string; weight: number; roles: Record< ColorUse[ 'role' ], number > };

export function clusterColors( uses: ColorUse[], threshold = 3 ): Cluster[] {
	const clusters: Cluster[] = [];
	// Heaviest first so the representative is the most-used shade.
	const byHex = new Map< string, ColorUse[] >();
	for ( const u of uses ) byHex.set( u.hex, [ ...( byHex.get( u.hex ) ?? [] ), u ] );
	const merged = [ ...byHex.entries() ]
		.map( ( [ hex, list ] ) => ( { hex, list, weight: list.reduce( ( s, u ) => s + u.weight, 0 ) } ) )
		.sort( ( a, b ) => b.weight - a.weight || a.hex.localeCompare( b.hex ) );
	for ( const m of merged ) {
		const c = parseColor( m.hex )!;
		const hit = clusters.find( ( k ) => deltaE( parseColor( k.hex )!, c ) < threshold );
		const target = hit ?? { hex: m.hex, weight: 0, roles: { text: 0, bg: 0, button: 0, border: 0 } };
		if ( ! hit ) clusters.push( target );
		target.weight += m.weight;
		for ( const u of m.list ) target.roles[ u.role ] += u.weight;
	}
	return clusters.sort( ( a, b ) => b.weight - a.weight || a.hex.localeCompare( b.hex ) );
}

export function colorsFromUsage( root: IRNode, max = 8 ): ColorToken[] {
	const clusters = clusterColors( collectColors( root ) ).slice( 0, 24 );
	const out: ColorToken[] = [];
	const taken = new Set< Cluster >();
	const add = ( c: Cluster | undefined, id: string, title: string, system: boolean ): void => {
		if ( ! c || taken.has( c ) ) return;
		taken.add( c );
		out.push( { id, title, hex: c.hex, system, usage: Math.round( c.weight ) } );
	};
	const isChromatic = ( c: Cluster ): boolean => chroma( parseColor( c.hex )! ) > 20;

	const text = [ ...clusters ].sort( ( a, b ) => b.roles.text - a.roles.text )[ 0 ];
	if ( text && text.roles.text > 0 ) add( text, 'text', 'Text', true );
	const chromatic = clusters.filter( ( c ) => isChromatic( c ) && ! taken.has( c ) );
	const primary = [ ...chromatic ].sort( ( a, b ) => b.roles.button + b.weight * 0.1 - ( a.roles.button + a.weight * 0.1 ) )[ 0 ];
	add( primary, 'primary', 'Primary', true );
	const rest = chromatic.filter( ( c ) => ! taken.has( c ) );
	add( rest[ 0 ], 'secondary', 'Secondary', true );
	add( rest[ 1 ], 'accent', 'Accent', true );

	for ( const c of clusters ) {
		if ( out.length >= max ) break;
		if ( taken.has( c ) ) continue;
		const lum = luminance( parseColor( c.hex )! );
		const title = c.roles.bg >= c.roles.text ? ( lum > 90 ? 'Surface' : lum < 20 ? 'Dark surface' : 'Background' ) : 'Muted text';
		add( c, customId( c.hex ), title, false );
	}
	// Disambiguate duplicate custom titles.
	const counts = new Map< string, number >();
	for ( const t of out ) {
		if ( t.system ) continue;
		const n = ( counts.get( t.title ) ?? 0 ) + 1;
		counts.set( t.title, n );
		if ( n > 1 ) t.title = `${ t.title } ${ n }`;
	}
	return out;
}

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

type FontUse = { family: string; size: number; weight: string; lineHeight: number | undefined; kind: string; tag?: string; len: number; node: IRNode };

function collectFonts( root: IRNode ): FontUse[] {
	const out: FontUse[] = [];
	const visit = ( n: IRNode ): void => {
		if ( n.kind === 'heading' || n.kind === 'text' || n.kind === 'button' || n.kind === 'list' ) {
			const s = n.styles.desktop;
			const family = firstFamily( s[ 'font-family' ] ) ?? '';
			const size = px( s[ 'font-size' ] ) ?? 16;
			const lh = px( s[ 'line-height' ] );
			out.push( {
				family,
				size,
				weight: s[ 'font-weight' ] ?? '400',
				lineHeight: lh ? round( lh / size ) : undefined,
				kind: n.kind,
				tag: n.content?.tag,
				len: ( n.content?.text ?? '' ).length,
				node: n,
			} );
		}
		n.children.forEach( visit );
	};
	visit( root );
	return out;
}

function mostCommon< T >( xs: T[], key: ( x: T ) => string, weight: ( x: T ) => number = () => 1 ): T | undefined {
	const m = new Map< string, { item: T; w: number } >();
	for ( const x of xs ) {
		const k = key( x );
		const e = m.get( k );
		if ( e ) e.w += weight( x );
		else m.set( k, { item: x, w: weight( x ) } );
	}
	return [ ...m.values() ].sort( ( a, b ) => b.w - a.w )[ 0 ]?.item;
}

function fontToken( id: string, title: string, u: FontUse, system: boolean, withSize: boolean ): FontToken {
	const t: FontToken = { id, title, family: u.family, weight: u.weight, system };
	if ( withSize ) {
		t.size = u.size;
		if ( u.lineHeight ) t.lineHeight = u.lineHeight;
		const ls = px( u.node.styles.desktop[ 'letter-spacing' ] );
		if ( ls ) t.letterSpacing = ls;
		const tt = u.node.styles.desktop[ 'text-transform' ];
		if ( tt && tt !== 'none' ) t.textTransform = tt;
		const tab = px( u.node.styles.tablet?.[ 'font-size' ] );
		const mob = px( u.node.styles.mobile?.[ 'font-size' ] );
		if ( tab !== null ) t.sizeTablet = tab;
		if ( mob !== null ) t.sizeMobile = mob;
		const lhAt = ( bp: 'tablet' | 'mobile' ): number | undefined => {
			const st = bp === 'tablet' ? { ...u.node.styles.desktop, ...u.node.styles.tablet } : { ...u.node.styles.desktop, ...u.node.styles.tablet, ...u.node.styles.mobile };
			const lh = px( st[ 'line-height' ] );
			const fs = px( st[ 'font-size' ] );
			return lh !== null && fs ? round( lh / fs ) : undefined;
		};
		const lt = lhAt( 'tablet' );
		const lm = lhAt( 'mobile' );
		if ( lt !== undefined && lt !== t.lineHeight ) t.lineHeightTablet = lt;
		if ( lm !== undefined && lm !== ( t.lineHeightTablet ?? t.lineHeight ) ) t.lineHeightMobile = lm;
	}
	return t;
}

export function extractFonts( root: IRNode ): FontToken[] {
	const uses = collectFonts( root ).filter( ( u ) => u.family );
	const out: FontToken[] = [];
	const headings = uses.filter( ( u ) => u.kind === 'heading' );
	const body = uses.filter( ( u ) => u.kind === 'text' || u.kind === 'list' );
	const buttons = uses.filter( ( u ) => u.kind === 'button' );

	const h = mostCommon( headings, ( u ) => `${ u.family }|${ u.weight }` );
	if ( h ) out.push( fontToken( 'primary', 'Primary', h, true, false ) );
	const secondFamily = mostCommon(
		uses.filter( ( u ) => u.family !== h?.family ),
		( u ) => `${ u.family }|${ u.weight }`,
		( u ) => u.len
	);
	if ( secondFamily ) out.push( fontToken( 'secondary', 'Secondary', secondFamily, true, false ) );
	const t = mostCommon( body, ( u ) => `${ u.family }|${ u.size }|${ u.weight }`, ( u ) => u.len );
	if ( t ) out.push( fontToken( 'text', 'Text', t, true, true ) );
	const b = mostCommon( buttons, ( u ) => `${ u.family }|${ u.weight }` );
	if ( b ) out.push( fontToken( 'accent', 'Accent', b, true, false ) );

	for ( const level of [ 'h1', 'h2', 'h3' ] ) {
		const u = mostCommon( headings.filter( ( x ) => x.tag === level ), ( x ) => `${ x.family }|${ x.size }|${ x.weight }` );
		if ( u ) out.push( fontToken( customId( level ), level.toUpperCase(), u, false, true ) );
	}
	return out;
}

/* ------------------------------------------------------------------ */
/* Table + matching                                                    */
/* ------------------------------------------------------------------ */

export function extractTokens( meta: CaptureMeta, root: IRNode ): TokenTable {
	const shadcn = colorsFromShadcn( meta.rootVars );
	return {
		colors: shadcn ?? colorsFromUsage( root ),
		fonts: extractFonts( root ),
		source: shadcn ? 'shadcn' : 'clustered',
	};
}

export type TokenIndex = {
	color: ( css: string | undefined ) => string | undefined;
	font: ( n: IRNode ) => FontToken | undefined;
};

/** Build lookups from CSS values to global ids (FR-21). */
export function tokenIndex( table: TokenTable ): TokenIndex {
	const colors = table.colors.map( ( c ) => ( { id: c.id, rgba: parseColor( c.hex )! } ) );
	return {
		color( css ) {
			const c = parseColor( css );
			if ( ! c || c.a < 1 ) return undefined;
			let best: { id: string; d: number } | undefined;
			for ( const t of colors ) {
				// Clustering uses ΔE < 3, but binding an element to a global must be near-exact:
				// #F8FAFC vs #FFFFFF is a deliberate surface change, not noise.
				const d = deltaE( t.rgba, c );
				if ( d < 1 && ( ! best || d < best.d ) ) best = { id: t.id, d };
			}
			return best?.id;
		},
		font( n ) {
			const s = n.styles.desktop;
			const family = firstFamily( s[ 'font-family' ] );
			const size = px( s[ 'font-size' ] );
			const weight = s[ 'font-weight' ] ?? '400';
			// Sized tokens (Text, H1–H3) must match exactly; family-only tokens match headings/buttons.
			const ls = px( s[ 'letter-spacing' ] ) ?? undefined;
			const lhPx = px( s[ 'line-height' ] );
			const lh = lhPx !== null && size ? round( lhPx / size ) : undefined;
			const sized = table.fonts.find(
				( f ) =>
					f.size !== undefined &&
					f.family === family &&
					f.size === size &&
					f.weight === weight &&
					( f.letterSpacing ?? undefined ) === ( ls || undefined ) &&
					( f.lineHeight === undefined || lh === undefined || Math.abs( f.lineHeight - lh ) <= 0.02 )
			);
			if ( sized ) return sized;
			return undefined;
		},
	};
}
