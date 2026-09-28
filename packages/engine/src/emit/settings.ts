/**
 * Elementor v3 setting value builders. Shapes verified against
 * tests/fixtures/elementor/controls-v3.json (exported from Elementor 4.3).
 */
import type { Box, NodeStyles, StyleMap } from '../ir/types';
import { round } from '../util/units';

export type Settings = Record< string, unknown >;

export type Slider = { unit: string; size: number | string; sizes: [] };
export type Dimensions = { unit: string; top: string; right: string; bottom: string; left: string; isLinked: boolean };

export const slider = ( size: number, unit = 'px' ): Slider => ( { unit, size: round( size ), sizes: [] } );

export function dims( b: Box, unit = 'px' ): Dimensions {
	const v = [ b.top, b.right, b.bottom, b.left ].map( ( n ) => String( round( n ) ) ) as [ string, string, string, string ];
	return { unit, top: v[ 0 ], right: v[ 1 ], bottom: v[ 2 ], left: v[ 3 ], isLinked: v.every( ( x ) => x === v[ 0 ] ) };
}

export function gaps( row: number, column: number ): Settings {
	return { unit: 'px', size: round( column ), column: String( round( column ) ), row: String( round( row ) ), isLinked: row === column };
}

export function effective( s: NodeStyles, bp: 'desktop' | 'tablet' | 'mobile' ): StyleMap {
	if ( bp === 'desktop' ) return s.desktop;
	if ( bp === 'tablet' ) return { ...s.desktop, ...( s.tablet as StyleMap ) };
	return { ...s.desktop, ...( s.tablet as StyleMap ), ...( s.mobile as StyleMap ) };
}

const same = ( a: unknown, b: unknown ): boolean => JSON.stringify( a ) === JSON.stringify( b );

/**
 * Set a responsive setting: desktop value under `key`, and `_tablet` /
 * `_mobile` only when they differ from the breakpoint above (PRD §8.1).
 */
export function responsive( out: Settings, key: string, styles: NodeStyles, fn: ( s: StyleMap ) => unknown, opts: { skipDesktopDefault?: unknown } = {} ): void {
	const d = fn( effective( styles, 'desktop' ) );
	const t = styles.tablet ? fn( effective( styles, 'tablet' ) ) : d;
	const m = styles.mobile ? fn( effective( styles, 'mobile' ) ) : t;
	if ( d !== undefined && ! ( 'skipDesktopDefault' in opts && same( d, opts.skipDesktopDefault ) ) ) out[ key ] = d;
	if ( t !== undefined && ! same( t, d ) ) out[ `${ key }_tablet` ] = t;
	if ( m !== undefined && ! same( m, t ) ) out[ `${ key }_mobile` ] = m;
}

/** Link setting shape for url controls. */
export function link( url: string, target?: string ): Settings {
	return { url, is_external: target === '_blank' ? 'on' : '', nofollow: '', custom_attributes: '' };
}
