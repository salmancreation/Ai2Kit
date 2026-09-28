/**
 * IR → Elementor v3 (containers + widgets) JSON (PRD §8.1).
 *
 * Every settings key and option value emitted here is validated in tests
 * against the control registry exported from a real Elementor install
 * (tests/fixtures/elementor/controls-v3.json).
 */
import type { IRNode, NodeStyles, StyleMap } from '../ir/types';
import type { TokenIndex } from '../tokens/tokens';
import { isTransparent, normalizeColor } from '../util/color';
import { firstFamily, parseBox, parseLinearGradient, parseShadow, px, round } from '../util/units';
import { dims, effective, gaps, link, responsive, slider, type Settings } from './settings';
import lucideFa from '../../data/lucide-fa-map.json';
import { explicitMinHeight, isRowParent, parentCenters, placement } from './placement';

export type V3Element = {
	id: string;
	elType: 'container' | 'widget';
	isInner?: boolean;
	widgetType?: string;
	settings: Settings;
	elements: V3Element[];
};

export type NodeStats = {
	/** Style props present in the source that matter visually. */
	relevant: number;
	/** Of those, how many the emitter mapped to settings. */
	mapped: number;
	leaves: number;
	nativeLeaves: number;
	fallbacks: number;
	widgets: Record< string, number >;
	warnings: string[];
};

export type EmitContext = {
	tokens: TokenIndex;
	nextId: () => string;
	/** Frozen HTML by capture key, for sections switched to HTML mode and fallbacks. */
	frozen?: Record< string, string >;
	/** Section id → 'html' to keep that section as an HTML widget. */
	modes?: Record< string, 'native' | 'html' >;
	/** Resolved asset URLs (after the PHP media import), by original URL. */
	assets?: Record< string, { url: string; id?: number } >;
	stats?: NodeStats;
};

/* ------------------------------------------------------------------ */
/* Style → settings mappers. Each returns the CSS props it consumed.   */
/* ------------------------------------------------------------------ */

const RELEVANT = [
	'color', 'background-color', 'background-image', 'font-size', 'font-weight', 'font-family', 'line-height', 'letter-spacing',
	'text-transform', 'text-align', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-bottom',
	'border-top-width', 'border-top-left-radius', 'box-shadow', 'row-gap', 'column-gap', 'flex-direction', 'justify-content',
	'align-items', 'grid-template-columns', 'min-height', 'max-width', 'object-fit', 'opacity', 'font-style',
];

function track( ctx: EmitContext, s: StyleMap, consumed: Set< string > ): void {
	if ( ! ctx.stats ) return;
	for ( const p of RELEVANT ) {
		if ( s[ p ] === undefined ) continue;
		ctx.stats.relevant++;
		if ( consumed.has( p ) ) ctx.stats.mapped++;
	}
}

function colorSetting( out: Settings, key: string, css: string | undefined, ctx: EmitContext ): boolean {
	if ( ! css || isTransparent( css ) ) return false;
	const gid = ctx.tokens.color( css );
	if ( gid ) {
		const g = ( out.__globals__ ?? {} ) as Record< string, string >;
		g[ key ] = `globals/colors?id=${ gid }`;
		out.__globals__ = g;
		return true;
	}
	const hex = normalizeColor( css );
	if ( ! hex ) return false;
	out[ key ] = hex;
	return true;
}

const ALIGN_TEXT: Record< string, string > = { center: 'center', right: 'end', end: 'end', justify: 'justify' };
const ALIGN_BUTTON: Record< string, string > = { center: 'center', right: 'right', end: 'right', justify: 'justify' };

function typography( out: Settings, prefix: string, node: IRNode, ctx: EmitContext, consumed: Set< string > ): void {
	const s = node.styles.desktop;
	const token = ctx.tokens.font( node );
	const g = `${ prefix }_typography`;
	if ( token ) {
		const globals = ( out.__globals__ ?? {} ) as Record< string, string >;
		globals[ g ] = `globals/typography?id=${ token.id }`;
		out.__globals__ = globals;
		[ 'font-family', 'font-size', 'font-weight', 'line-height' ].forEach( ( p ) => consumed.add( p ) );
		// Responsive sizes that differ from the token still need local overrides.
		return;
	}
	out[ g ] = 'custom';
	const fam = firstFamily( s[ 'font-family' ] );
	if ( fam ) out[ `${ prefix }_font_family` ] = fam;
	// A system-only stack is inherited rather than set, which still matches the source.
	if ( s[ 'font-family' ] ) consumed.add( 'font-family' );
	responsive( out, `${ prefix }_font_size`, node.styles, ( st ) => {
		const v = px( st[ 'font-size' ] );
		return v === null ? undefined : slider( v );
	} );
	if ( s[ 'font-size' ] ) consumed.add( 'font-size' );
	const w = s[ 'font-weight' ];
	if ( w ) {
		out[ `${ prefix }_font_weight` ] = String( w );
		consumed.add( 'font-weight' );
	}
	responsive( out, `${ prefix }_line_height`, node.styles, ( st ) => {
		const lh = px( st[ 'line-height' ] );
		const fs = px( st[ 'font-size' ] );
		return lh !== null && fs ? slider( round( lh / fs ), 'em' ) : undefined;
	} );
	if ( s[ 'line-height' ] ) consumed.add( 'line-height' );
	const ls = px( s[ 'letter-spacing' ] );
	if ( ls !== null && ls !== 0 ) {
		out[ `${ prefix }_letter_spacing` ] = slider( ls );
		consumed.add( 'letter-spacing' );
	}
	const tt = s[ 'text-transform' ];
	if ( tt && [ 'uppercase', 'lowercase', 'capitalize' ].includes( tt ) ) {
		out[ `${ prefix }_text_transform` ] = tt;
		consumed.add( 'text-transform' );
	}
	if ( s[ 'font-style' ] === 'italic' ) {
		out[ `${ prefix }_font_style` ] = 'italic';
		consumed.add( 'font-style' );
	}
}

function align( out: Settings, key: string, styles: NodeStyles, map: Record< string, string >, consumed: Set< string > ): void {
	responsive( out, key, styles, ( st ) => map[ st[ 'text-align' ] ?? '' ] ?? '', { skipDesktopDefault: '' } );
	if ( styles.desktop[ 'text-align' ] ) consumed.add( 'text-align' );
}

function boxSetting( out: Settings, key: string, styles: NodeStyles, prop: 'padding' | 'margin', consumed: Set< string >, verticalOnly = false, always = false ): void {
	responsive( out, key, styles, ( st ) => {
		const b = parseBox( st, prop );
		if ( ! b ) return always ? dims( { top: 0, right: 0, bottom: 0, left: 0 } ) : undefined;
		if ( verticalOnly ) {
			b.left = 0;
			b.right = 0;
		}
		if ( ! always && b.top === 0 && b.right === 0 && b.bottom === 0 && b.left === 0 ) return undefined;
		return dims( b );
	} );
	for ( const side of [ 'top', 'right', 'bottom', 'left' ] ) {
		if ( styles.desktop[ `${ prop }-${ side }` ] ) consumed.add( `${ prop }-${ side }` );
	}
}

function radius( s: StyleMap ): ReturnType< typeof dims > | undefined {
	const r = [ 'top-left', 'top-right', 'bottom-right', 'bottom-left' ].map( ( c ) => px( s[ `border-${ c }-radius` ] ) ?? 0 );
	if ( r.every( ( v ) => v === 0 ) ) return undefined;
	// Pill shapes (9999px) are clamped to something Elementor renders the same.
	const clamp = ( v: number ): number => Math.min( v, 999 );
	return dims( { top: clamp( r[ 0 ]! ), right: clamp( r[ 1 ]! ), bottom: clamp( r[ 2 ]! ), left: clamp( r[ 3 ]! ) } );
}

function borderSettings( out: Settings, prefix: string, s: StyleMap, ctx: EmitContext, consumed: Set< string >, radiusKey?: string ): void {
	const w = parseBox( s, 'border-width' );
	// Style and color come from the first side that has a border (bottom-only dividers are common).
	const side = ( [ 'top', 'bottom', 'left' ] as const ).find( ( sd ) => ( px( s[ `border-${ sd }-width` ] ) ?? 0 ) > 0 && ( s[ `border-${ sd }-style` ] ?? 'none' ) !== 'none' );
	const style = side ? s[ `border-${ side }-style` ] : undefined;
	if ( w && style ) {
		out[ `${ prefix }_border` ] = [ 'solid', 'double', 'dotted', 'dashed', 'groove' ].includes( style ) ? style : 'solid';
		out[ `${ prefix }_width` ] = dims( w );
		colorSetting( out, `${ prefix }_color`, s[ `border-${ side }-color` ] ?? s[ 'border-top-color' ], ctx );
		consumed.add( 'border-top-width' );
	}
	const r = radius( s );
	if ( r ) {
		out[ radiusKey ?? `${ prefix }_radius` ] = r;
		consumed.add( 'border-top-left-radius' );
	}
}

function shadowSettings( out: Settings, prefix: string, s: StyleMap, consumed: Set< string > ): void {
	const sh = parseShadow( s[ 'box-shadow' ] );
	if ( ! sh || sh.inset ) return;
	out[ `${ prefix }_box_shadow_type` ] = 'yes';
	out[ `${ prefix }_box_shadow` ] = { horizontal: sh.x, vertical: sh.y, blur: sh.blur, spread: sh.spread, color: sh.color };
	consumed.add( 'box-shadow' );
}

function extractUrl( bgImage: string | undefined ): string | undefined {
	const m = bgImage?.match( /url\(["']?([^"')]+)["']?\)/ );
	return m ? m[ 1 ] : undefined;
}

function asset( ctx: EmitContext, url: string ): { url: string; id: number | string } {
	const a = ctx.assets?.[ url ];
	return a ? { url: a.url, id: a.id ?? '' } : { url, id: '' };
}

function backgroundSettings( out: Settings, prefix: string, s: StyleMap, ctx: EmitContext, consumed: Set< string > ): void {
	const img = s[ 'background-image' ];
	const grad = parseLinearGradient( img );
	if ( grad ) {
		out[ `${ prefix }_background` ] = 'gradient';
		colorSetting( out, `${ prefix }_color`, grad.from, ctx );
		out[ `${ prefix }_color_stop` ] = slider( grad.fromStop, '%' );
		colorSetting( out, `${ prefix }_color_b`, grad.to, ctx );
		out[ `${ prefix }_color_b_stop` ] = slider( grad.toStop, '%' );
		out[ `${ prefix }_gradient_angle` ] = slider( grad.angle, 'deg' );
		consumed.add( 'background-image' );
		consumed.add( 'background-color' );
		return;
	}
	const url = extractUrl( img );
	if ( url ) {
		out[ `${ prefix }_background` ] = 'classic';
		out[ `${ prefix }_image` ] = { ...asset( ctx, url ), size: '' };
		const size = s[ 'background-size' ];
		if ( size === 'cover' || size === 'contain' ) out[ `${ prefix }_size` ] = size;
		const pos = s[ 'background-position' ];
		if ( pos && /50%\s+50%|center/.test( pos ) ) out[ `${ prefix }_position` ] = 'center center';
		if ( s[ 'background-repeat' ] === 'no-repeat' ) out[ `${ prefix }_repeat` ] = 'no-repeat';
		consumed.add( 'background-image' );
		colorSetting( out, `${ prefix }_color`, s[ 'background-color' ], ctx ) && consumed.add( 'background-color' );
		return;
	}
	if ( ! isTransparent( s[ 'background-color' ] ) ) {
		out[ `${ prefix }_background` ] = 'classic';
		colorSetting( out, `${ prefix }_color`, s[ 'background-color' ], ctx );
		consumed.add( 'background-color' );
	}
}

/* ------------------------------------------------------------------ */
/* Containers                                                          */
/* ------------------------------------------------------------------ */

const HTML_TAGS = new Set( [ 'header', 'footer', 'main', 'article', 'section', 'aside', 'nav' ] );

function containerSettings( node: IRNode, ctx: EmitContext, isSection: boolean, parent?: IRNode ): Settings {
	const s = node.styles.desktop;
	const out: Settings = {};
	const consumed = new Set< string >();
	if ( node.label ) out._title = node.label;
	if ( node.anchor ) out._element_id = node.anchor;

	// Width model.
	if ( isSection && node.innerMaxWidth ) {
		out.content_width = 'boxed';
		out.boxed_width = slider( node.innerMaxWidth );
		consumed.add( 'max-width' );
	} else {
		out.content_width = 'full';
		if ( node.widthPct ) {
			// Children of a row that stacks on smaller screens go full width there.
			out.width = slider( node.widthPct, '%' );
			if ( parentStacksOn( parent, 'tablet' ) ) out.width_tablet = slider( 100, '%' );
			else if ( parentStacksOn( parent, 'mobile' ) ) out.width_mobile = slider( 100, '%' );
		} else if ( ! isSection && node.rect && isRowParent( parent ) ) {
			// Nested containers default to width 100%; content-sized row children size to their content
			// (auto survives font differences better than a measured px width).
			out.width = { unit: 'custom', size: 'auto', sizes: [] };
			out.width_mobile = parentStacksOn( parent, 'mobile' ) ? slider( 100, '%' ) : { unit: 'custom', size: 'auto', sizes: [] };
		} else if ( ! isSection ) {
			const p = placement( node, parent );
			if ( p?.narrow && node.rect ) {
				// Content-sized boxes (pills, inline-flex badges) size to their content; fixed boxes keep their size.
				out.width = p.inline ? { unit: 'custom', size: 'auto', sizes: [] } : slider( Math.ceil( node.rect.w ) );
				if ( p.inline ) out.width_mobile = { unit: 'custom', size: 'auto', sizes: [] };
				// Auto-width items would still stretch in a column, so they always get an explicit self-alignment.
				if ( ( p.inline || p.align !== 'flex-start' ) && ! parentCenters( parent ) ) out._flex_align_self = p.align;
			}
		}
		// Elementor forces flex containers to width 100% on mobile unless a mobile width is set:
		// small fixed boxes (icon tiles, avatars) keep their size; wide ones go full width.
		const w = out.width as { unit?: string; size?: number } | undefined;
		if ( ! isSection && w?.unit === 'px' && ! out.width_mobile ) {
			out.width_mobile = ( w.size ?? 0 ) > 360 ? slider( 100, '%' ) : slider( w.size ?? 0 );
		}
		if ( s[ 'max-width' ] ) consumed.add( 'max-width' );
	}

	// Layout.
	const L = node.layout ?? { display: 'block', direction: 'column' };
	if ( L.display === 'grid' ) {
		out.container_type = 'grid';
		responsive( out, 'grid_columns_grid', node.styles, ( st ) => gridColumns( st[ 'grid-template-columns' ] ) );
		// Content-sized rows, like the source's implicit rows (fr rows would force equal heights).
		out.grid_rows_grid = { unit: 'custom', size: 'auto', sizes: [] };
		responsive( out, 'grid_gaps', node.styles, ( st ) => gaps( px( st[ 'row-gap' ] ) ?? 0, px( st[ 'column-gap' ] ) ?? 0 ) );
		if ( L.align ) out.grid_align_items = L.align === 'flex-start' ? 'start' : L.align === 'flex-end' ? 'end' : L.align;
		[ 'grid-template-columns', 'row-gap', 'column-gap', 'align-items' ].forEach( ( p ) => consumed.add( p ) );
	} else {
		responsive( out, 'flex_direction', node.styles, ( st ) => {
			const d = st[ 'flex-direction' ];
			if ( st.display === 'flex' || st.display === 'inline-flex' ) return d?.startsWith( 'column' ) ? d : d ?? 'row';
			return 'column';
		} );
		if ( L.wrap ) out.flex_wrap = 'wrap';
		// Elementor wraps rows on mobile by default; keep the source's behavior.
		const mob = effective( node.styles, 'mobile' );
		if ( ( mob.display === 'flex' || mob.display === 'inline-flex' ) && ! ( mob[ 'flex-direction' ] ?? 'row' ).startsWith( 'column' ) ) {
			out.flex_wrap_mobile = mob[ 'flex-wrap' ] === 'wrap' || mob[ 'flex-wrap' ] === 'wrap-reverse' ? 'wrap' : 'nowrap';
		}
		responsive( out, 'flex_justify_content', node.styles, ( st ) => {
			if ( st.display !== 'flex' && st.display !== 'inline-flex' ) return undefined;
			const v = st[ 'justify-content' ];
			return v && [ 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly' ].includes( v ) ? v : v === 'end' ? 'flex-end' : undefined;
		} );
		responsive( out, 'flex_align_items', node.styles, ( st ) => {
			const isFlex = st.display === 'flex' || st.display === 'inline-flex';
			const v = st[ 'align-items' ];
			if ( ! isFlex ) return undefined;
			if ( ! v || v === 'normal' ) return undefined;
			return v === 'start' ? 'flex-start' : v === 'end' ? 'flex-end' : v === 'baseline' ? 'flex-start' : v;
		} );
		// Elementor's kit default gap is 20px; always write the real gap.
		responsive( out, 'flex_gap', node.styles, ( st ) => {
			const isFlex = st.display === 'flex' || st.display === 'inline-flex';
			return gaps( isFlex ? px( st[ 'row-gap' ] ) ?? 0 : 0, isFlex ? px( st[ 'column-gap' ] ) ?? 0 : 0 );
		} );
		[ 'flex-direction', 'justify-content', 'align-items', 'row-gap', 'column-gap' ].forEach( ( p ) => consumed.add( p ) );
	}

	// Box model. Containers default to 10px padding in the kit, so always write it.
	boxSetting( out, 'padding', node.styles, 'padding', consumed, false, true );
	boxSetting( out, 'margin', node.styles, 'margin', consumed, true );

	// Empty decorative boxes (gradient panels, image placeholders) get their height from
	// aspect-ratio or explicit sizes; Elementor needs it spelled out per breakpoint.
	if ( ! node.children.length && node.rect && node.rect.h > 0 ) {
		out.min_height = slider( Math.round( node.rect.h ) );
		const th = node.rects?.tablet?.h;
		const mh = node.rects?.mobile?.h;
		if ( th && Math.abs( th - node.rect.h ) > 1 ) out.min_height_tablet = slider( Math.round( th ) );
		if ( mh && Math.abs( mh - ( th ?? node.rect.h ) ) > 1 ) out.min_height_mobile = slider( Math.round( mh ) );
	}
	const minH = px( s[ 'min-height' ] );
	const barH = node.layout?.direction === 'row' ? explicitMinHeight( node ) : null;
	if ( barH && ! ( minH && minH > 0 ) ) {
		out.min_height = slider( barH );
	}
	if ( minH && minH > 0 ) {
		responsive( out, 'min_height', node.styles, ( st ) => {
			const v = px( st[ 'min-height' ] );
			return v ? slider( v ) : undefined;
		} );
		consumed.add( 'min-height' );
	}

	backgroundSettings( out, 'background', s, ctx, consumed );
	borderSettings( out, 'border', s, ctx, consumed );
	shadowSettings( out, 'box_shadow', s, consumed );
	if ( s.overflow === 'hidden' ) out.overflow = 'hidden';

	if ( node.content?.href ) {
		out.html_tag = 'a';
		out.link = link( node.content.href );
	} else if ( HTML_TAGS.has( node.tag ?? '' ) ) {
		out.html_tag = node.tag;
	}

	positionSettings( out, node, parent, consumed );
	responsiveHide( out, node.styles );
	track( ctx, s, consumed );
	return out;
}

/**
 * Computed grid-template-columns (always px) → Elementor columns: N equal
 * tracks as `N fr`, unequal tracks as a custom `Xfr Yfr` template.
 */
export function gridColumns( cols: string | undefined ): Record< string, unknown > {
	if ( ! cols || cols === 'none' ) return slider( 1, 'fr' );
	const tracks = cols.replace( /\[[^\]]*\]/g, ' ' ).trim().split( /\s+(?![^(]*\))/ ).filter( Boolean );
	const widths = tracks.map( ( t ) => px( t ) );
	if ( widths.some( ( w ) => w === null || w <= 0 ) ) return slider( tracks.length, 'fr' );
	const min = Math.min( ...( widths as number[] ) );
	const equal = ( widths as number[] ).every( ( w ) => Math.abs( w - min ) <= 1.5 );
	if ( equal ) return slider( tracks.length, 'fr' );
	return { unit: 'custom', size: ( widths as number[] ).map( ( w ) => `${ Math.round( ( w / min ) * 100 ) / 100 }fr` ).join( ' ' ), sizes: [] };
}

function parentStacksOn( parent: IRNode | undefined, bp: 'tablet' | 'mobile' ): boolean {
	const d = parent?.styles[ bp ]?.[ 'flex-direction' ];
	return !! d && d.startsWith( 'column' );
}

function positionSettings( out: Settings, node: IRNode, parent: IRNode | undefined, consumed: Set< string > ): void {
	const pos = node.styles.desktop.position;
	if ( pos !== 'absolute' || ! node.rect || ! parent?.rect ) return;
	const isContainer = node.kind === 'container';
	out[ isContainer ? 'position' : '_position' ] = 'absolute';
	out._offset_orientation_h = 'start';
	out._offset_x = slider( node.rect.x - parent.rect.x );
	out._offset_orientation_v = 'start';
	out._offset_y = slider( node.rect.y - parent.rect.y );
	if ( isContainer ) {
		out.content_width = 'full';
		out.width = slider( node.rect.w );
		out.min_height = slider( node.rect.h );
	}
	const z = node.styles.desktop[ 'z-index' ];
	if ( z && /^-?\d+$/.test( z ) ) out[ isContainer ? 'z_index' : '_z_index' ] = parseInt( z, 10 );
	consumed.add( 'position' );
}

/** Nodes hidden at a breakpoint use Elementor's responsive visibility. */
function responsiveHide( out: Settings, styles: NodeStyles ): void {
	if ( styles.desktop.display === 'none' ) out.hide_desktop = 'hidden-desktop';
	if ( effective( styles, 'tablet' ).display === 'none' ) out.hide_tablet = 'hidden-tablet';
	if ( effective( styles, 'mobile' ).display === 'none' ) out.hide_mobile = 'hidden-mobile';
}

/* ------------------------------------------------------------------ */
/* Widgets                                                             */
/* ------------------------------------------------------------------ */

function commonWidget( out: Settings, node: IRNode, ctx: EmitContext, parent: IRNode | undefined, consumed: Set< string >, opts: { boxStyles?: boolean; sizing?: boolean } = {} ): void {
	if ( node.anchor ) out._element_id = node.anchor;
	boxSetting( out, '_margin', node.styles, 'margin', consumed, true );
	if ( opts.boxStyles ) {
		const s = node.styles.desktop;
		boxSetting( out, '_padding', node.styles, 'padding', consumed );
		backgroundSettings( out, '_background', s, ctx, consumed );
		borderSettings( out, '_border', s, ctx, consumed );
		shadowSettings( out, '_box_shadow', s, consumed );
	}
	if ( opts.sizing ) {
		// Stretched by default in a column container: narrow widgets need a width and alignment.
		const p = placement( node, parent );
		if ( p?.narrow && node.rect ) {
			if ( p.inline ) {
				out._element_width = 'auto';
			} else {
				out._element_width = 'initial';
				out._element_custom_width = slider( Math.ceil( node.rect.w ) );
				consumed.add( 'max-width' );
			}
			if ( ( p.inline || p.align !== 'flex-start' ) && ! parentCenters( parent ) ) out._flex_align_self = p.align;
		}
	}
	positionSettings( out, node, parent, consumed );
	responsiveHide( out, node.styles );
}

/** Image/icon alignment inside their own widget, from placement. */
function innerAlign( node: IRNode, parent: IRNode | undefined ): 'center' | 'end' | undefined {
	const p = placement( node, parent );
	if ( ! p?.narrow ) return undefined;
	return p.align === 'center' ? 'center' : p.align === 'flex-end' ? 'end' : undefined;
}

function iconValue( name: string | undefined ): { value: string; library: string } | undefined {
	if ( ! name ) return undefined;
	const fa = ( lucideFa as Record< string, string > )[ name ];
	if ( ! fa ) return undefined;
	return { value: fa, library: fa.startsWith( 'fab ' ) ? 'fa-brands' : 'fa-solid' };
}

function svgDataUri( svg: string ): string {
	const b64 = typeof btoa === 'function' ? btoa( unescape( encodeURIComponent( svg ) ) ) : Buffer.from( svg, 'utf8' ).toString( 'base64' );
	return `data:image/svg+xml;base64,${ b64 }`;
}

function widget( type: string, settings: Settings, ctx: EmitContext ): V3Element {
	if ( ctx.stats ) ctx.stats.widgets[ type ] = ( ctx.stats.widgets[ type ] ?? 0 ) + 1;
	return { id: ctx.nextId(), elType: 'widget', widgetType: type, settings, elements: [] };
}

function htmlWidget( html: string, reason: string, ctx: EmitContext ): V3Element {
	if ( ctx.stats ) ctx.stats.fallbacks++;
	return widget( 'html', { html, _title: `HTML (kept) — ${ reason }` }, ctx );
}

function emitLeaf( node: IRNode, ctx: EmitContext, parent?: IRNode ): V3Element | null {
	const s = node.styles.desktop;
	const consumed = new Set< string >();
	const out: Settings = {};
	if ( ctx.stats ) ctx.stats.leaves++;

	if ( node.fallback ) {
		const html = ( node.key && ctx.frozen?.[ node.key ] ) || node.fallback.html;
		if ( ! html ) return null;
		ctx.stats?.warnings.push( `Kept as HTML — ${ node.fallback.reason }.` );
		return htmlWidget( html, node.fallback.reason, ctx );
	}
	if ( ctx.stats ) ctx.stats.nativeLeaves++;

	let el: V3Element | null = null;
	switch ( node.kind ) {
		case 'heading': {
			out.title = node.content?.html || node.content?.text || '';
			const tag = node.content?.tag ?? 'h2';
			if ( tag !== 'h2' ) out.header_size = /^h[1-6]$/.test( tag ) ? tag : 'div';
			align( out, 'align', node.styles, ALIGN_TEXT, consumed );
			colorSetting( out, 'title_color', s.color, ctx ) && consumed.add( 'color' );
			typography( out, 'typography', node, ctx, consumed );
			commonWidget( out, node, ctx, parent, consumed, { boxStyles: true, sizing: true } );
			el = widget( 'heading', out, ctx );
			break;
		}
		case 'text': {
			const html = node.content?.html || node.content?.text || '';
			out.editor = /^<(ul|ol|blockquote)>/.test( html ) ? html : `<p>${ html }</p>`;
			align( out, 'align', node.styles, ALIGN_TEXT, consumed );
			colorSetting( out, 'text_color', s.color, ctx ) && consumed.add( 'color' );
			// Links keep the text color (themes otherwise recolor them).
			if ( /<a[\s>]/.test( html ) ) colorSetting( out, 'link_color', s.color, ctx );
			// Theme paragraph margins would add space the source didn't have; real margins go to _margin.
			out.paragraph_spacing = slider( 0 );
			typography( out, 'typography', node, ctx, consumed );
			commonWidget( out, node, ctx, parent, consumed, { boxStyles: true, sizing: true } );
			el = widget( 'text-editor', out, ctx );
			break;
		}
		case 'button': {
			out.text = node.content?.text ?? '';
			out.link = link( node.content?.href || '#', node.content?.target );
			const icon = iconValue( node.content?.iconName );
			if ( icon ) {
				out.selected_icon = icon;
				// Icon after the label in the source → row-reverse.
				if ( node.content?.iconPos === 'after' ) out.icon_align = 'row-reverse';
				out.icon_indent = slider( 8 );
			}
			// A button's horizontal position comes from its parent: text-align, or align-items in a column.
			const placed = placement( node, parent );
			if ( placed?.narrow && placed.align !== 'flex-start' ) {
				out.align = placed.align === 'center' ? 'center' : 'right';
			} else if ( parent ) {
				responsive( out, 'align', parent.styles, ( ps ) => {
					const colFlex = ( ps.display === 'flex' || ps.display === 'inline-flex' ) && ( ps[ 'flex-direction' ] ?? '' ).startsWith( 'column' );
					const ai = colFlex ? ps[ 'align-items' ] : undefined;
					const key = ai === 'center' ? 'center' : ai === 'flex-end' || ai === 'end' ? 'end' : ps[ 'text-align' ] ?? '';
					return ALIGN_BUTTON[ key ] ?? '';
				}, { skipDesktopDefault: '' } );
			}
			const bp = placement( node, parent );
			if ( bp?.full && ( node.rect?.w ?? 0 ) > 120 ) {
				out.align = 'justify';
				// Full-width buttons position their label (e.g. accordion triggers: text left, chevron right).
				const jc = s[ 'justify-content' ];
				const ta = s[ 'text-align' ];
				const ca = jc === 'space-between' ? 'space-between' : jc === 'flex-start' || jc === 'start' || ta === 'left' || ta === 'start' ? 'start' : jc === 'flex-end' || jc === 'end' ? 'end' : undefined;
				if ( ca ) out.content_align = ca;
			}
			typography( out, 'typography', node, ctx, consumed );
			colorSetting( out, 'button_text_color', s.color, ctx ) && consumed.add( 'color' );
			backgroundSettings( out, 'background', s, ctx, consumed );
			if ( ! out.background_background ) {
				// Elementor buttons default to the kit accent color; outline buttons need explicit transparency.
				out.background_background = 'classic';
				out.background_color = '#00000000';
			}
			borderSettings( out, 'border', s, ctx, consumed, 'border_radius' );
			shadowSettings( out, 'button_box_shadow', s, consumed );
			boxSetting( out, 'text_padding', node.styles, 'padding', consumed );
			commonWidget( out, node, ctx, parent, consumed );
			el = widget( 'button', out, ctx );
			break;
		}
		case 'image': {
			const src = node.content?.src ?? '';
			out.image = { ...asset( ctx, src ), alt: node.content?.alt ?? '', source: 'library' };
			out.image_size = 'full';
			if ( node.rect && parent?.rect ) {
				const inner = parent.rect.w - ( px( parent.styles.desktop[ 'padding-left' ] ) ?? 0 ) - ( px( parent.styles.desktop[ 'padding-right' ] ) ?? 0 );
				out.width = node.rect.w >= inner * 0.95 ? slider( 100, '%' ) : slider( node.rect.w );
			}
			const fit = s[ 'object-fit' ];
			if ( fit && [ 'cover', 'contain', 'scale-down' ].includes( fit ) && node.rect ) {
				out[ 'object-fit' ] = fit;
				out.height = slider( node.rect.h );
				consumed.add( 'object-fit' );
			}
			const r = radius( s );
			if ( r ) {
				out.image_border_radius = r;
				consumed.add( 'border-top-left-radius' );
			}
			shadowSettings( out, 'image_box_shadow', s, consumed );
			const ia = innerAlign( node, parent );
			if ( ia ) out.align = ia;
			if ( s.opacity && s.opacity !== '1' ) {
				out.opacity = slider( parseFloat( s.opacity ), '' );
				consumed.add( 'opacity' );
			}
			commonWidget( out, node, ctx, parent, consumed );
			el = widget( 'image', out, ctx );
			break;
		}
		case 'icon': {
			const icon = iconValue( node.content?.iconName );
			if ( icon ) out.selected_icon = icon;
			else if ( node.content?.svg ) out.selected_icon = { value: { url: svgDataUri( node.content.svg ), id: '' }, library: 'svg' };
			else return null;
			if ( ! icon ) ctx.stats?.warnings.push( 'Custom icon uploaded as SVG.' );
			const color = svgColor( node.content?.svg ) ?? s.color;
			colorSetting( out, 'primary_color', color, ctx ) && consumed.add( 'color' );
			if ( node.rect?.w ) out.size = slider( node.rect.w );
			out.align = innerAlign( node, parent ) ?? 'start';
			if ( node.content?.href ) out.link = link( node.content.href );
			commonWidget( out, node, ctx, parent, consumed );
			el = widget( 'icon', out, ctx );
			break;
		}
		case 'list': {
			const items = node.content?.items ?? [];
			out.icon_list = items.map( ( it ) => {
				const item: Settings = { _id: ctx.nextId(), text: it.text };
				const icon = iconValue( it.iconName );
				item.selected_icon = icon ?? ( it.svg ? { value: { url: svgDataUri( it.svg ), id: '' }, library: 'svg' } : { value: 'fas fa-check', library: 'fa-solid' } );
				if ( it.href ) item.link = link( it.href );
				return item;
			} );
			const iconColor = svgColor( items[ 0 ]?.svg );
			if ( iconColor ) colorSetting( out, 'icon_color', iconColor, ctx );
			colorSetting( out, 'text_color', s.color, ctx ) && consumed.add( 'color' );
			typography( out, 'icon_typography', node, ctx, consumed );
			const isRow = ( s.display === 'flex' || s.display === 'inline-flex' ) && ! ( s[ 'flex-direction' ] ?? 'row' ).startsWith( 'column' );
			const gap = px( s[ isRow ? 'column-gap' : 'row-gap' ] );
			if ( gap ) out.space_between = slider( gap );
			if ( isRow ) {
				out.view = 'inline';
				const j = s[ 'justify-content' ];
				const listAlign = j === 'center' ? 'center' : j === 'flex-end' || j === 'end' ? 'end' : innerAlign( node, parent );
				if ( listAlign ) out.icon_align = listAlign;
			}
			if ( node.content?.iconSize ) out.icon_size = slider( node.content.iconSize );
			if ( node.content?.iconGap ) out.text_indent = slider( node.content.iconGap );
			commonWidget( out, node, ctx, parent, consumed, { sizing: true } );
			el = widget( 'icon-list', out, ctx );
			break;
		}
		case 'video': {
			const c = node.content ?? {};
			out.video_type = c.videoType ?? 'youtube';
			if ( c.videoType === 'vimeo' ) out.vimeo_url = c.src;
			else if ( c.videoType === 'hosted' ) {
				out.insert_url = 'yes';
				out.external_url = link( c.src ?? '' );
			} else out.youtube_url = c.src;
			commonWidget( out, node, ctx, parent, consumed );
			el = widget( 'video', out, ctx );
			break;
		}
		case 'divider': {
			const bw = px( s[ 'border-top-width' ] ) ?? 1;
			out.weight = slider( bw || 1 );
			colorSetting( out, 'color', s[ 'border-top-color' ] ?? s.color, ctx );
			out.gap = slider( 0 );
			commonWidget( out, node, ctx, parent, consumed );
			el = widget( 'divider', out, ctx );
			break;
		}
		case 'spacer': {
			const h = node.rect?.h ?? 0;
			if ( h <= 0 ) return null;
			out.space = slider( h );
			el = widget( 'spacer', out, ctx );
			break;
		}
		default: {
			const html = ( node.key && ctx.frozen?.[ node.key ] ) || '';
			if ( ! html ) return null;
			return htmlWidget( html, 'Unrecognized block', ctx );
		}
	}
	track( ctx, s, consumed );
	return el;
}

function svgColor( svg: string | undefined ): string | undefined {
	const m = svg?.match( /(?:stroke|fill)="(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})"/ );
	return m ? m[ 1 ] : undefined;
}

export function emitNode( node: IRNode, ctx: EmitContext, parent?: IRNode, isSection = false ): V3Element | null {
	if ( node.kind !== 'container' ) return emitLeaf( node, ctx, parent );
	if ( node.fallback ) return emitLeaf( node, ctx, parent );
	const settings = containerSettings( node, ctx, isSection, parent );
	const elements = node.children.map( ( c ) => emitNode( c, ctx, node ) ).filter( ( e ): e is V3Element => e !== null );
	const el: V3Element = { id: ctx.nextId(), elType: 'container', settings, elements };
	el.isInner = ! isSection;
	return el;
}

export function emptyStats(): NodeStats {
	return { relevant: 0, mapped: 0, leaves: 0, nativeLeaves: 0, fallbacks: 0, widgets: {}, warnings: [] };
}

/** Emit one section, honoring its Native/HTML mode. */
export function emitSection( section: IRNode, ctx: EmitContext ): { element: V3Element | null; stats: NodeStats } {
	const stats = emptyStats();
	const local: EmitContext = { ...ctx, stats };
	if ( ctx.modes?.[ section.id ] === 'html' && section.key && ctx.frozen?.[ section.key ] ) {
		const wrap: V3Element = {
			id: ctx.nextId(),
			elType: 'container',
			isInner: false,
			settings: { _title: `${ section.label ?? 'Section' } (HTML)`, content_width: 'full', padding: dims( { top: 0, right: 0, bottom: 0, left: 0 } ), flex_gap: gaps( 0, 0 ) },
			elements: [ htmlWidget( ctx.frozen[ section.key ]!, 'switched to HTML in review', local ) ],
		};
		return { element: wrap, stats };
	}
	const element = emitNode( section, local, undefined, true );
	if ( element && element.elType === 'widget' ) {
		// A section that is itself a leaf still needs a top-level container.
		return {
			element: {
				id: ctx.nextId(),
				elType: 'container',
				isInner: false,
				settings: { _title: section.label ?? 'Section', content_width: 'full', padding: dims( { top: 0, right: 0, bottom: 0, left: 0 } ), flex_gap: gaps( 0, 0 ) },
				elements: [ element ],
			},
			stats,
		};
	}
	return { element, stats };
}
