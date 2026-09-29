/**
 * IR → Elementor v4 (Atomic) elements (PRD §8.2).
 *
 * Content settings are emitted as typed props (`{ $$type, value }`), validated
 * against the schema exported from Elementor (tests/fixtures/elementor/
 * atomic-schema.json). Styles are emitted as plain CSS per breakpoint and
 * converted server-side by Elementor's own CSS → atomic converter, so the
 * typed style format is produced by Elementor rather than guessed here.
 *
 * Elements without an atomic equivalent (icon lists, rich lists, HTML
 * fallbacks, buttons with icons) are emitted as v3 widgets on the same page,
 * which Elementor 4 supports.
 */
import type { IRNode, StyleMap } from '../ir/types';
import { isTransparent } from '../util/color';
import { decomposeMatrix, firstFamily, normalizeGradient, parseShadow, px, round, transitionSeconds } from '../util/units';
import { effective } from './settings';
import { emitNode as emitV3Node, emptyStats, gridColumns, type EmitContext, type NodeStats, type V3Element } from './v3';
import { explicitMinHeight, innerBox, isRowParent, parentCenters, placement } from './placement';
import lucideFa from '../../data/lucide-fa-map.json';
import { accordionMeta } from '../recognize/patterns';
import { canEmitAccordion } from './accordion';

type Typed = { $$type: string; value: unknown };
const t = ( $$type: string, value: unknown ): Typed => ( { $$type, value } );

export type V4Css = { desktop?: string; tablet?: string; mobile?: string; hover?: string };

export type V4Element = {
	id: string;
	elType: string;
	widgetType?: string;
	settings: Record< string, unknown >;
	/** Local style as CSS per breakpoint; the server converts it with Elementor's CSS converter. */
	css?: V4Css;
	elements: Array< V4Element | V3Element >;
	isInner?: boolean;
};

type Decls = Record< string, string >;

/* ------------------------------------------------------------------ */
/* CSS per breakpoint                                                  */
/* ------------------------------------------------------------------ */

const TEXT_KINDS = new Set( [ 'heading', 'text', 'button' ] );

/**
 * Box sides as longhands. `always` writes zeros too: atomic base styles add
 * defaults the source didn't have (e-flexbox padding 10px, e-button padding 12px 24px).
 */
function box( d: Decls, st: StyleMap, prop: 'padding' | 'margin', vertical = false, always = false ): void {
	for ( const side of vertical ? [ 'top', 'bottom' ] : [ 'top', 'right', 'bottom', 'left' ] ) {
		const v = px( st[ `${ prop }-${ side }` ] ) ?? 0;
		if ( v || always ) d[ `${ prop }-${ side }` ] = `${ round( v ) }px`;
	}
}

function surface( d: Decls, st: StyleMap ): void {
	if ( ! isTransparent( st[ 'background-color' ] ) ) d[ 'background-color' ] = st[ 'background-color' ]!;
	const img = st[ 'background-image' ];
	const clipText = ( st[ 'background-clip' ] ?? st[ '-webkit-background-clip' ] ) === 'text';
	if ( img && img !== 'none' ) {
		d[ 'background-image' ] = normalizeGradient( img );
		if ( clipText ) {
			// Gradient text: the converter leaves the clip for residual CSS.
			d[ '-webkit-background-clip' ] = 'text';
			d[ 'background-clip' ] = 'text';
			d[ '-webkit-text-fill-color' ] = 'transparent';
		} else {
			if ( st[ 'background-size' ] ) d[ 'background-size' ] = st[ 'background-size' ]!;
			if ( st[ 'background-position' ] ) d[ 'background-position' ] = st[ 'background-position' ]!;
			if ( st[ 'background-repeat' ] ) d[ 'background-repeat' ] = st[ 'background-repeat' ]!;
		}
	}
	const sides = [ 'top', 'right', 'bottom', 'left' ] as const;
	const widths = sides.map( ( s ) => px( st[ `border-${ s }-width` ] ) ?? 0 );
	const styled = ( [ 'top', 'bottom', 'left' ] as const ).find( ( s ) => ( px( st[ `border-${ s }-width` ] ) ?? 0 ) > 0 && ( st[ `border-${ s }-style` ] ?? 'none' ) !== 'none' );
	if ( styled ) {
		d[ 'border-width' ] = widths.map( ( w ) => `${ round( w ) }px` ).join( ' ' );
		d[ 'border-style' ] = st[ `border-${ styled }-style` ]!;
		d[ 'border-color' ] = st[ `border-${ styled }-color` ] ?? st[ 'border-top-color' ] ?? 'currentColor';
	}
	const radii = [ 'top-left', 'top-right', 'bottom-right', 'bottom-left' ].map( ( c ) => Math.min( 999, px( st[ `border-${ c }-radius` ] ) ?? 0 ) );
	if ( radii.some( Boolean ) ) d[ 'border-radius' ] = radii.map( ( r ) => `${ round( r ) }px` ).join( ' ' );
	const sh = parseShadow( st[ 'box-shadow' ] );
	if ( sh && ! sh.inset ) d[ 'box-shadow' ] = `${ sh.x }px ${ sh.y }px ${ sh.blur }px ${ sh.spread }px ${ sh.color }`;
	for ( const p of [ 'opacity', 'transform', 'filter', 'backdrop-filter', 'mix-blend-mode' ] ) {
		const v = p === 'transform' && st[ p ] ? decomposeMatrix( st[ p ]! ) : st[ p ];
		if ( v && ! [ '1', 'none', 'normal' ].includes( v ) ) d[ p ] = v;
	}
	if ( st.overflow === 'hidden' ) d.overflow = 'hidden';
}

function typography( d: Decls, st: StyleMap ): void {
	// A web font is stated by name (so Elementor loads it). Atomic font-family renders its value
	// quoted — a single family name — so a system-font stack goes to residual CSS instead (systemStack).
	const fam = firstFamily( st[ 'font-family' ] );
	if ( fam ) d[ 'font-family' ] = fam;
	for ( const p of [ 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'font-style', 'text-transform', 'text-align' ] ) {
		const v = st[ p ];
		if ( ! v ) continue;
		if ( p === 'letter-spacing' && ( v === 'normal' || v === '0px' ) ) continue;
		if ( p === 'text-align' && ( v === 'start' || v === 'left' ) ) continue;
		if ( p === 'text-transform' && v === 'none' ) continue;
		if ( p === 'font-style' && v === 'normal' ) continue;
		// `normal` (~1.2) isn't a value the converter keeps; unset, the theme's 1.5 applies.
		d[ p ] = p === 'line-height' && v === 'normal' ? '1.2em' : v;
	}
	if ( st.color && ! isTransparent( st.color ) ) d.color = st.color;
	if ( st[ 'text-decoration-line' ] && st[ 'text-decoration-line' ] !== 'none' ) d[ 'text-decoration' ] = st[ 'text-decoration-line' ]!;
}

function layout( d: Decls, node: IRNode, st: StyleMap ): void {
	const disp = st.display ?? 'block';
	if ( disp.includes( 'grid' ) ) {
		d.display = 'grid';
		const cols = gridColumns( st[ 'grid-template-columns' ] ) as { unit: string; size: number | string };
		d[ 'grid-template-columns' ] = cols.unit === 'fr' ? `repeat(${ cols.size }, minmax(0, 1fr))` : String( cols.size );
		// Content-sized rows like the source's implicit rows (a default row template would equalize heights).
		d[ 'grid-template-rows' ] = 'none';
		d[ 'grid-auto-rows' ] = 'auto';
		if ( st[ 'align-items' ] && st[ 'align-items' ] !== 'normal' && st[ 'align-items' ] !== 'stretch' ) d[ 'align-items' ] = st[ 'align-items' ]!;
	} else if ( disp.includes( 'flex' ) ) {
		d.display = 'flex';
		d[ 'flex-direction' ] = st[ 'flex-direction' ] ?? 'row';
		d[ 'flex-wrap' ] = st[ 'flex-wrap' ] ?? 'nowrap';
		const j = st[ 'justify-content' ];
		if ( j && ! [ 'normal', 'flex-start', 'start' ].includes( j ) ) d[ 'justify-content' ] = j;
		const a = st[ 'align-items' ];
		if ( a && ! [ 'normal', 'stretch' ].includes( a ) ) d[ 'align-items' ] = a;
	} else {
		// Block flow stacks children: a column flexbox with no gap.
		d.display = 'flex';
		d[ 'flex-direction' ] = 'column';
		d[ 'flex-wrap' ] = 'nowrap';
	}
	const rg = disp.includes( 'flex' ) || disp.includes( 'grid' ) ? px( st[ 'row-gap' ] ) ?? 0 : 0;
	const cg = disp.includes( 'flex' ) || disp.includes( 'grid' ) ? px( st[ 'column-gap' ] ) ?? 0 : 0;
	// One-value gap converts natively; unequal gaps split (row-gap goes to residual CSS).
	if ( rg === cg ) d.gap = `${ round( rg ) }px`;
	else {
		d[ 'column-gap' ] = `${ round( cg ) }px`;
		d[ 'row-gap' ] = `${ round( rg ) }px`;
	}
	void node;
}

/** Width / self-alignment from placement, as CSS (the v3 rules, expressed natively). */
function sizing( d: Decls, node: IRNode, parent: IRNode | undefined, isContainer: boolean ): void {
	if ( ! parent || ! node.rect ) return;
	if ( node.styles.desktop.position === 'absolute' ) return;
	if ( isRowParent( parent ) ) {
		if ( isContainer ) {
			if ( node.widthPct ) {
				d.width = `${ node.widthPct }%`;
				d[ 'flex-shrink' ] = '0';
			} else {
				d.width = 'auto';
			}
		}
		return;
	}
	const p = placement( node, parent );
	if ( ! p?.narrow ) return;
	if ( node.kind === 'image' || node.kind === 'icon' ) {
		// Media widths are set from their own geometry; only the self-alignment comes from placement.
		if ( p.align !== 'flex-start' && ! parentCenters( parent ) ) d[ 'align-self' ] = p.align;
		return;
	}
	if ( p.inline ) d.width = 'auto'; // With a non-stretch align-self, auto is content-sized.
	else {
		const box = innerBox( parent );
		d.width = `${ Math.ceil( node.rect.w ) }px`;
		if ( box && node.rect.w > 360 ) d[ 'max-width' ] = '100%';
	}
	if ( ( p.inline || p.align !== 'flex-start' ) && ! parentCenters( parent ) ) d[ 'align-self' ] = p.align;
}

function position( d: Decls, node: IRNode, parent: IRNode | undefined ): void {
	const st = node.styles.desktop;
	if ( st.position !== 'absolute' || ! node.rect || ! parent?.rect ) return;
	d.position = 'absolute';
	d[ 'inset-block-start' ] = `${ round( node.rect.y - parent.rect.y ) }px`;
	d[ 'inset-inline-start' ] = `${ round( node.rect.x - parent.rect.x ) }px`;
	d.width = `${ round( node.rect.w ) }px`;
	d.height = `${ round( node.rect.h ) }px`;
	if ( st[ 'z-index' ] && /^-?\d+$/.test( st[ 'z-index' ] ) ) d[ 'z-index' ] = st[ 'z-index' ];
}

function declsAt( node: IRNode, parent: IRNode | undefined, bp: 'desktop' | 'tablet' | 'mobile', isSection: boolean ): Decls {
	const st = effective( node.styles, bp );
	const d: Decls = {};
	if ( st.display === 'none' ) return { display: 'none' };
	const isContainer = node.kind === 'container' && ! node.fallback;
	if ( isContainer ) {
		if ( isSection && node.innerMaxWidth ) {
			// Boxed section: the outer box carries surface and padding; an inner box carries layout (see innerCss).
			d.display = 'flex';
			d[ 'flex-direction' ] = 'column';
			d[ 'align-items' ] = 'center';
		} else {
			layout( d, node, st );
		}
		box( d, st, 'padding', false, true );
		const minH = px( st[ 'min-height' ] );
		if ( minH ) d[ 'min-height' ] = `${ round( minH ) }px`;
		// An explicit bar height (h-16 headers) holds at every breakpoint; computing it only at
		// desktop would make the smaller breakpoints "reset" it.
		const barH = node.layout?.direction === 'row' && ! ( isSection && node.innerMaxWidth ) ? explicitMinHeight( node ) : null;
		if ( barH && ! minH ) d[ 'min-height' ] = `${ round( barH ) }px`;
		if ( ! node.children.length && node.rect ) {
			const h = bp === 'desktop' ? node.rect.h : node.rects?.[ bp ]?.h ?? node.rect.h;
			d[ 'min-height' ] = `${ Math.round( h ) }px`;
		}
	} else {
		if ( TEXT_KINDS.has( node.kind ) ) typography( d, st );
		if ( node.kind === 'heading' || node.kind === 'text' ) {
			// Atomic text has no theme margins to undo; real margins come from the source.
			d[ 'margin-top' ] = '0px';
			d[ 'margin-bottom' ] = '0px';
		}
		box( d, st, 'padding' );
		if ( node.kind === 'image' && node.rect ) {
			const fit = st[ 'object-fit' ];
			if ( fit && fit !== 'fill' ) {
				d[ 'object-fit' ] = fit;
				d.height = `${ Math.round( bp === 'desktop' ? node.rect.h : node.rects?.[ bp ]?.h ?? node.rect.h ) }px`;
			}
			const pb = parent ? innerBox( parent ) : null;
			d.width = pb && node.rect.w >= pb.w * 0.95 ? '100%' : `${ Math.ceil( node.rect.w ) }px`;
			d[ 'max-width' ] = '100%';
		}
		if ( node.kind === 'icon' && node.rect ) {
			d.width = `${ Math.round( node.rect.w ) }px`;
			d.height = `${ Math.round( node.rect.h ) }px`;
			if ( st.color ) d.color = st.color;
		}
		if ( node.kind === 'button' && placement( node, parent )?.full && ( node.rect?.w ?? 0 ) > 120 ) {
			d.width = '100%';
			d[ 'justify-content' ] = st[ 'justify-content' ] === 'space-between' ? 'space-between' : 'center';
		}
	}
	surface( d, st );
	if ( node.kind === 'button' ) {
		// e-button's base style is a blue, padded, rounded button: state the source's values.
		box( d, st, 'padding', false, true );
		if ( ! d[ 'background-color' ] && ! d[ 'background-image' ] ) d[ 'background-color' ] = 'transparent';
		if ( ! d[ 'border-radius' ] ) d[ 'border-radius' ] = '0px';
		if ( ! d[ 'border-width' ] ) d[ 'border-width' ] = '0px';
	}
	box( d, st, 'margin', true );
	if ( bp === 'desktop' ) sizing( d, node, parent, isContainer );
	else if ( isContainer && isRowParent( parent ) && ( effective( parent!.styles, bp )[ 'flex-direction' ] ?? '' ).startsWith( 'column' ) ) {
		// The row stacks at this breakpoint: its columns go full width.
		d.width = '100%';
	}
	position( d, node, parent );
	return d;
}

/** The centered inner box of a boxed section: its layout within the source's max width. */
function innerDeclsAt( node: IRNode, bp: 'desktop' | 'tablet' | 'mobile' ): Decls {
	const d: Decls = {};
	layout( d, node, effective( node.styles, bp ) );
	for ( const side of [ 'top', 'right', 'bottom', 'left' ] ) d[ `padding-${ side }` ] = '0px';
	// A fixed-height bar (a 72px header) lives on the row itself, so its items center vertically.
	const pad = ( px( node.styles.desktop[ 'padding-top' ] ) ?? 0 ) + ( px( node.styles.desktop[ 'padding-bottom' ] ) ?? 0 );
	const barH = node.layout?.direction === 'row' ? explicitMinHeight( node ) : null;
	if ( barH ) d[ 'min-height' ] = `${ round( barH - pad ) }px`;
	d.width = '100%';
	d[ 'max-width' ] = `${ Math.round( node.innerMaxWidth ?? 0 ) }px`;
	return d;
}

function diffCss( at: ( bp: 'desktop' | 'tablet' | 'mobile' ) => Decls, node: IRNode ): V4Css {
	const d = at( 'desktop' );
	const out: V4Css = {};
	if ( Object.keys( d ).length ) out.desktop = toCss( d );
	let prev = d;
	for ( const bp of [ 'tablet', 'mobile' ] as const ) {
		if ( ! node.styles[ bp ] && ! node.rects?.[ bp ] ) continue;
		const cur = at( bp );
		const diff: Decls = {};
		for ( const k of new Set( [ ...Object.keys( prev ), ...Object.keys( cur ) ] ) ) if ( prev[ k ] !== cur[ k ] ) diff[ k ] = cur[ k ] ?? 'initial';
		if ( Object.keys( diff ).length ) out[ bp ] = toCss( diff );
		prev = { ...prev, ...cur };
	}
	return out;
}

function toCss( d: Decls ): string {
	return Object.entries( d )
		.map( ( [ k, v ] ) => `${ k }: ${ v };` )
		.join( ' ' );
}

/** CSS property a hover diff key animates (for the `transition` list). */
const HOVER_CSS: Record< string, string > = {
	color: 'color',
	'background-color': 'background-color',
	'background-image': 'background-image',
	'border-top-color': 'border-color',
	'border-right-color': 'border-color',
	'border-bottom-color': 'border-color',
	'border-left-color': 'border-color',
	'box-shadow': 'box-shadow',
	transform: 'transform',
	opacity: 'opacity',
	filter: 'filter',
};

/**
 * Hover state declarations (FR-22) and the normal-state `transition` that
 * animates them. Atomic styles have a real hover state, so every captured
 * property maps (no per-widget control subset as in v3).
 */
export function hoverDecls( node: IRNode ): { hover: Decls; transition?: string } {
	const h = node.styles.hover;
	const hover: Decls = {};
	if ( ! h ) return { hover };
	if ( h.color !== undefined ) hover.color = h.color;
	if ( h[ 'background-image' ] !== undefined && h[ 'background-image' ] !== 'none' ) hover[ 'background-image' ] = normalizeGradient( h[ 'background-image' ] );
	if ( h[ 'background-color' ] !== undefined ) hover[ 'background-color' ] = h[ 'background-color' ];
	const bc = h[ 'border-top-color' ] ?? h[ 'border-bottom-color' ] ?? h[ 'border-left-color' ] ?? h[ 'border-right-color' ];
	if ( bc !== undefined ) hover[ 'border-color' ] = bc;
	if ( h[ 'box-shadow' ] !== undefined ) {
		const sh = parseShadow( h[ 'box-shadow' ] );
		if ( ! sh ) hover[ 'box-shadow' ] = '0px 0px 0px 0px rgba(0, 0, 0, 0)';
		else if ( ! sh.inset ) hover[ 'box-shadow' ] = `${ sh.x }px ${ sh.y }px ${ sh.blur }px ${ sh.spread }px ${ sh.color }`;
	}
	if ( h.transform !== undefined ) hover.transform = decomposeMatrix( h.transform );
	if ( h.opacity !== undefined ) hover.opacity = h.opacity;
	if ( h[ 'text-decoration-line' ] !== undefined ) hover[ 'text-decoration' ] = h[ 'text-decoration-line' ];
	if ( h.filter !== undefined ) hover.filter = h.filter;
	const sec = transitionSeconds( h[ 'transition-duration' ] );
	if ( sec === null ) return { hover };
	const animated = ( h[ 'transition-property' ] ?? 'all' ).split( ',' ).map( ( p ) => p.trim() );
	const props = [ ...new Set( Object.keys( h ).map( ( k ) => HOVER_CSS[ k ] ).filter( ( p ): p is string => !! p ) ) ];
	const list = animated.includes( 'all' ) ? props : props.filter( ( p ) => animated.includes( p ) || ( p === 'border-color' && animated.some( ( a ) => a.startsWith( 'border' ) ) ) );
	return list.length ? { hover, transition: list.map( ( p ) => `${ p } ${ sec }s` ).join( ', ' ) } : { hover };
}

/** Desktop CSS plus tablet/mobile diffs (values the breakpoint changes or resets), and the hover state. */
export function cssFor( node: IRNode, parent: IRNode | undefined, isSection = false ): V4Css {
	const d = declsAt( node, parent, 'desktop', isSection );
	const out: V4Css = {};
	const hv = hoverDecls( node );
	if ( Object.keys( hv.hover ).length ) {
		out.hover = toCss( hv.hover );
		if ( hv.transition ) d.transition = hv.transition;
	}
	if ( Object.keys( d ).length ) out.desktop = toCss( d );
	let prev = d;
	for ( const bp of [ 'tablet', 'mobile' ] as const ) {
		if ( ! node.styles[ bp ] && ! node.rects?.[ bp ] ) continue;
		const cur = declsAt( node, parent, bp, isSection );
		if ( cur.display === 'none' ) {
			if ( prev.display !== 'none' ) out[ bp ] = 'display: none;';
			prev = { ...prev, display: 'none' };
			continue;
		}
		// Sizing is desktop-only; carry it so it isn't reported as a reset.
		for ( const k of [ 'width', 'max-width', 'align-self', 'flex-shrink', 'transition' ] ) if ( prev[ k ] !== undefined && cur[ k ] === undefined && cur.display !== 'none' ) cur[ k ] = prev[ k ]!;
		const diff: Decls = {};
		for ( const k of new Set( [ ...Object.keys( prev ), ...Object.keys( cur ) ] ) ) {
			if ( prev[ k ] === cur[ k ] ) continue;
			diff[ k ] = cur[ k ] ?? 'initial';
		}
		if ( Object.keys( diff ).length ) out[ bp ] = toCss( diff );
		prev = { ...prev, ...cur };
	}
	return out;
}

/**
 * A system-font stack (no web font rendered) as residual CSS on the element's
 * local style class; the server builds that class as `e-{id}-a2k`.
 */
function systemStack( node: IRNode, id: string, ctx: EmitContext ): void {
	const stack = node.styles.desktop[ 'font-family' ];
	if ( ! TEXT_KINDS.has( node.kind ) || ! stack || firstFamily( stack ) ) return;
	ctx.residual?.push( { className: `e-${ id }-a2k`, breakpoint: 'desktop', decls: { 'font-family': stack }, label: ctx.section } );
}

/* ------------------------------------------------------------------ */
/* Elements                                                            */
/* ------------------------------------------------------------------ */

const CONTAINER_TAGS = new Set( [ 'header', 'section', 'article', 'aside', 'footer', 'main', 'nav' ] );

function linkProp( href: string, target?: string ): Typed {
	return t( 'link', { destination: t( 'url', href ), isTargetBlank: t( 'boolean', target === '_blank' ) } );
}

function faIcon( name: string | undefined ): { value: string; library: string } | undefined {
	const fa = name ? ( lucideFa as Record< string, string > )[ name ] : undefined;
	return fa ? { value: fa, library: fa.startsWith( 'fab ' ) ? 'fa-brands' : 'fa-solid' } : undefined;
}

function svgDataUri( svg: string ): string {
	const b64 = typeof btoa === 'function' ? btoa( unescape( encodeURIComponent( svg ) ) ) : Buffer.from( svg, 'utf8' ).toString( 'base64' );
	return `data:image/svg+xml;base64,${ b64 }`;
}

function common( node: IRNode, settings: Record< string, unknown > ): void {
	if ( node.anchor ) settings._cssid = t( 'string', node.anchor );
}

/**
 * Atomic text (`escaped-html`) keeps inline tags but drops every attribute
 * except link href/target, so styled spans (a small grey "/ mo", gradient
 * text) only survive in the classic widgets.
 */
export function needsClassicText( html: string | undefined ): boolean {
	return /<span[^>]*\s(style|class)=/.test( html ?? '' ) || /<(strong|em|b|i|u|a|small|mark|code)[^>]*\sstyle=/.test( html ?? '' );
}

function atomicLeaf( node: IRNode, ctx: EmitContext, parent?: IRNode ): V4Element | null {
	const c = node.content ?? {};
	if ( ( node.kind === 'heading' || node.kind === 'text' || node.kind === 'button' ) && needsClassicText( c.html ) ) return null;
	const settings: Record< string, unknown > = {};
	common( node, settings );
	const el = ( widgetType: string ): V4Element => {
		if ( ctx.stats ) {
			ctx.stats.widgets[ widgetType ] = ( ctx.stats.widgets[ widgetType ] ?? 0 ) + 1;
			ctx.stats.leaves++;
			ctx.stats.nativeLeaves++;
		}
		const id = ctx.nextId();
		systemStack( node, id, ctx );
		return { id, elType: 'widget', widgetType, settings, css: cssFor( node, parent ), elements: [] };
	};
	switch ( node.kind ) {
		case 'heading': {
			const tag = /^h[1-6]$/.test( c.tag ?? '' ) ? c.tag! : null;
			if ( tag ) {
				settings.tag = t( 'string', tag );
				settings.title = t( 'escaped-html', c.html || c.text || '' );
				return el( 'e-heading' );
			}
			settings.paragraph = t( 'escaped-html', c.html || c.text || '' );
			return el( 'e-paragraph' );
		}
		case 'text': {
			const html = c.html || c.text || '';
			if ( /^<(ul|ol|blockquote)>/.test( html ) ) return null; // v3 Text Editor keeps list markup.
			settings.paragraph = t( 'escaped-html', html );
			return el( 'e-paragraph' );
		}
		case 'button': {
			// Atomic buttons have no icon: any icon (SVG or Lucide) keeps the v3 Button, which carries it.
			if ( c.svg || c.iconName ) return null;
			settings.text = t( 'escaped-html', c.text ?? '' );
			settings.link = linkProp( c.href || '#', c.target );
			return el( 'e-button' );
		}
		case 'image': {
			settings.image = t( 'image', {
				src: t( 'image-src', { id: null, url: t( 'url', c.src ?? '' ), alt: t( 'string', c.alt ?? '' ) } ),
				size: t( 'string', 'full' ),
			} );
			return el( 'e-image' );
		}
		case 'icon': {
			// The source's own SVG (identical); Font Awesome only when none was captured.
			const fa = c.svg ? undefined : faIcon( c.iconName );
			if ( c.svg ) settings.svg = t( 'svg-src', { id: null, url: t( 'url', svgDataUri( c.svg ) ) } );
			else if ( fa ) settings.svg = t( 'icon', { value: t( 'string', fa.value ), library: t( 'string', fa.library ) } );
			else return null;
			if ( c.href ) settings.link = linkProp( c.href );
			return el( 'e-svg' );
		}
		case 'divider':
			return el( 'e-divider' );
		case 'video': {
			if ( c.videoType !== 'youtube' ) return null;
			settings.source = t( 'string', c.src ?? '' );
			return el( 'e-youtube' );
		}
		case 'spacer': {
			if ( ! node.rect?.h ) return null;
			return { id: ctx.nextId(), elType: 'e-div-block', settings, css: { desktop: `height: ${ Math.round( node.rect.h ) }px;` }, elements: [] };
		}
		default:
			return null;
	}
}

export function emitV4Node( node: IRNode, ctx: EmitContext, parent?: IRNode, isSection = false ): V4Element | V3Element | null {
	// Accordion has no atomic element yet: the v3 Nested Accordion, mixed into the v4 tree (PRD §8.2).
	if ( node.kind === 'container' && ! node.fallback && ! isSection && canEmitAccordion( accordionMeta( node.pattern ) ) ) return emitV3Node( node, ctx, parent );
	if ( node.kind === 'container' && ! node.fallback ) {
		const settings: Record< string, unknown > = {};
		common( node, settings );
		if ( node.content?.href ) settings.link = linkProp( node.content.href );
		else if ( CONTAINER_TAGS.has( node.tag ?? '' ) ) settings.tag = t( 'string', node.tag );
		const elements = node.children.map( ( ch ) => emitV4Node( ch, ctx, node ) ).filter( ( e ): e is V4Element | V3Element => e !== null );
		const css = cssFor( node, parent, isSection );
		if ( isSection && node.innerMaxWidth ) {
			const inner: V4Element = { id: ctx.nextId(), elType: 'e-flexbox', settings: {}, css: diffCss( ( bp ) => innerDeclsAt( node, bp ), node ), elements, isInner: true };
			return { id: ctx.nextId(), elType: 'e-flexbox', settings, css, elements: [ inner ], isInner: false };
		}
		return { id: ctx.nextId(), elType: 'e-flexbox', settings, css, elements, isInner: ! isSection };
	}
	const atomic = node.fallback ? null : atomicLeaf( node, ctx, parent );
	if ( atomic ) return atomic;
	// No atomic equivalent: the v3 widget, mixed into the v4 tree.
	return emitV3Node( node, ctx, parent );
}

/** Emit one section as v4, honoring its Native/HTML mode. */
export function emitSectionV4( section: IRNode, ctx: EmitContext ): { element: V4Element | V3Element | null; stats: NodeStats } {
	const stats = emptyStats();
	const local: EmitContext = { ...ctx, stats, section: section.label };
	const frozen = section.key ? ctx.frozen?.[ section.key ] : undefined;
	if ( ctx.modes?.[ section.id ] === 'html' && frozen ) {
		stats.fallbacks++;
		const html: V3Element = { id: ctx.nextId(), elType: 'widget', widgetType: 'html', settings: { html: frozen, _title: 'HTML (kept) — switched to HTML in review' }, elements: [] };
		return { element: { id: ctx.nextId(), elType: 'e-flexbox', settings: {}, css: { desktop: 'display: flex; flex-direction: column; padding: 0px;' }, elements: [ html ], isInner: false }, stats };
	}
	const element = emitV4Node( section, local, undefined, true );
	if ( element && element.elType === 'widget' ) {
		return { element: { id: ctx.nextId(), elType: 'e-flexbox', settings: {}, css: { desktop: 'display: flex; flex-direction: column;' }, elements: [ element ], isInner: false }, stats };
	}
	return { element, stats };
}
