/** Layout mapping (FR-14): computed display → container layout. */
import type { Layout, StyleMap } from '../ir/types';
import { px } from '../util/units';

const FLEX_JUSTIFY: Record< string, string > = {
	'flex-start': 'flex-start',
	start: 'flex-start',
	left: 'flex-start',
	normal: 'flex-start',
	center: 'center',
	'flex-end': 'flex-end',
	end: 'flex-end',
	right: 'flex-end',
	'space-between': 'space-between',
	'space-around': 'space-around',
	'space-evenly': 'space-evenly',
};

const FLEX_ALIGN: Record< string, string > = {
	'flex-start': 'flex-start',
	start: 'flex-start',
	center: 'center',
	'flex-end': 'flex-end',
	end: 'flex-end',
	stretch: 'stretch',
	normal: 'stretch',
	baseline: 'flex-start',
};

export function mapJustify( v: string | undefined ): string | undefined {
	return v ? FLEX_JUSTIFY[ v ] : undefined;
}

export function mapAlign( v: string | undefined ): string | undefined {
	return v ? FLEX_ALIGN[ v ] : undefined;
}

/** Number of explicit tracks in a computed grid-template value ("200px 200px 200px" → 3). */
export function countTracks( v: string | undefined ): number | undefined {
	if ( ! v || v === 'none' ) return undefined;
	const repeat = v.match( /^repeat\((\d+),/ );
	if ( repeat ) return parseInt( repeat[ 1 ]!, 10 );
	// Strip line names like [full-start].
	const parts = v.replace( /\[[^\]]*\]/g, ' ' ).trim().split( /\s+(?![^(]*\))/ ).filter( Boolean );
	return parts.length || undefined;
}

export function layoutOf( s: StyleMap ): Layout {
	const display = s.display ?? 'block';
	const gap = {
		row: px( s[ 'row-gap' ] ) ?? 0,
		column: px( s[ 'column-gap' ] ) ?? 0,
	};
	const hasGap = gap.row > 0 || gap.column > 0;

	if ( display === 'flex' || display === 'inline-flex' ) {
		const dir = s[ 'flex-direction' ] ?? 'row';
		const out: Layout = {
			display: 'flex',
			direction: dir.startsWith( 'column' ) ? 'column' : 'row',
			wrap: s[ 'flex-wrap' ] === 'wrap' || s[ 'flex-wrap' ] === 'wrap-reverse',
		};
		if ( hasGap ) out.gap = gap;
		const j = mapJustify( s[ 'justify-content' ] );
		const a = mapAlign( s[ 'align-items' ] );
		if ( j && j !== 'flex-start' ) out.justify = j;
		if ( a && a !== 'stretch' ) out.align = a;
		return out;
	}
	if ( display === 'grid' || display === 'inline-grid' ) {
		const out: Layout = { display: 'grid' };
		const cols = countTracks( s[ 'grid-template-columns' ] );
		const rows = countTracks( s[ 'grid-template-rows' ] );
		if ( cols ) out.gridCols = cols;
		if ( rows ) out.gridRows = rows;
		if ( hasGap ) out.gap = gap;
		const a = mapAlign( s[ 'align-items' ] );
		if ( a && a !== 'stretch' ) out.align = a;
		return out;
	}
	// Block flow stacks vertically.
	return { display: 'block', direction: 'column' };
}
