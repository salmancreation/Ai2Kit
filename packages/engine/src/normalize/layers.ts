/**
 * Background-layer lifting.
 *
 * AI-built heroes paint their background with extra layers instead of the
 * section's own background:
 *   <section class="relative">
 *     <img class="absolute inset-0 w-full h-full object-cover">   ← image layer
 *     <div class="absolute inset-0 bg-black/50"></div>            ← overlay layer
 *     …content…
 *   </section>
 * or a `.hero__bg` div with a background image and a `::after` gradient.
 *
 * Emitted literally, those become absolutely positioned containers — hard to
 * edit and fragile on mobile. Here, content-free layers that cover their
 * parent are merged into the parent: the image becomes its background image
 * and a color/gradient on top becomes its background overlay — what a person
 * builds in Elementor (Style → Background / Background Overlay).
 */
import type { BgOverlay, IRNode, Rect, StyleMap } from '../ir/types';
import { isTransparent, parseColor } from '../util/color';
import { px, round } from '../util/units';

const TOLERANCE = 2;

/** The child box covers the parent box (within a couple of pixels). */
export function covers( child: Rect | undefined, parent: Rect | undefined ): boolean {
	if ( ! child || ! parent || parent.w <= 0 || parent.h <= 0 ) return false;
	return (
		child.x <= parent.x + TOLERANCE &&
		child.y <= parent.y + TOLERANCE &&
		child.x + child.w >= parent.x + parent.w - TOLERANCE &&
		child.y + child.h >= parent.y + parent.h - TOLERANCE
	);
}

const positioned = ( s: StyleMap ): boolean => s.position === 'absolute' || s.position === 'fixed';

/** A pseudo layer covers its element: inset 0 (or 100% sizes). */
function pseudoCovers( s: StyleMap, host: Rect | undefined ): boolean {
	if ( ! positioned( s ) ) return false;
	const zero = ( v: string | undefined ): boolean => ( px( v ) ?? NaN ) <= TOLERANCE && ( px( v ) ?? NaN ) >= -TOLERANCE;
	if ( [ 'top', 'right', 'bottom', 'left' ].every( ( p ) => zero( s[ p ] ) ) ) return true;
	const w = px( s.width );
	const h = px( s.height );
	return !! host && w !== null && h !== null && w >= host.w - TOLERANCE && h >= host.h - TOLERANCE && zero( s.top ) && zero( s.left );
}

const urlOf = ( bg: string | undefined ): string | undefined => /url\(["']?([^"')]+)["']?\)/.exec( bg ?? '' )?.[ 1 ];

/** Visible at every breakpoint (a layer hidden on mobile stays as it is). */
const alwaysShown = ( n: IRNode ): boolean => n.styles.tablet?.display !== 'none' && n.styles.mobile?.display !== 'none';

type Paint = { image?: { url: string; size: string; position: string; repeat: string; opacity: number }; overlay?: BgOverlay };

/** What a content-free covering layer paints, or null when it isn't a pure paint layer. */
export function layerPaint( n: IRNode ): Paint | null {
	const s = n.styles.desktop;
	const opacity = parseFloat( s.opacity ?? '1' );
	if ( n.kind === 'image' && n.content?.src ) {
		// An <img>, or an empty div painting a background image (classified as an image).
		const bgUrl = urlOf( s[ 'background-image' ] );
		const fit = s[ 'object-fit' ];
		const paint: Paint = {
			image: bgUrl
				? { url: bgUrl, size: s[ 'background-size' ] ?? 'auto', position: s[ 'background-position' ] ?? '0% 0%', repeat: s[ 'background-repeat' ] ?? 'repeat', opacity }
				: {
						url: n.content.src,
						size: fit === 'contain' ? 'contain' : fit === 'fill' || fit === 'none' ? 'auto' : 'cover',
						position: s[ 'object-position' ] ?? '50% 50%',
						repeat: 'no-repeat',
						opacity,
				  },
		};
		// Its own overlay: a ::after still on it, or one already lifted onto it (children go first).
		const own = overlayFromPseudo( n ) ?? n.bgOverlay;
		if ( own ) paint.overlay = own;
		return paint;
	}
	if ( n.kind !== 'container' || n.children.length || n.content?.text || n.content?.href ) return null;
	const out: Paint = {};
	const url = urlOf( s[ 'background-image' ] );
	if ( url ) {
		out.image = { url, size: s[ 'background-size' ] ?? 'auto', position: s[ 'background-position' ] ?? '0% 0%', repeat: s[ 'background-repeat' ] ?? 'repeat', opacity };
	} else if ( /gradient\(/.test( s[ 'background-image' ] ?? '' ) ) {
		out.overlay = { gradient: s[ 'background-image' ]!, opacity };
	} else if ( ! isTransparent( s[ 'background-color' ] ) ) {
		out.overlay = { color: s[ 'background-color' ]!, opacity };
	}
	// The layer's own ::after/::before overlay (e.g. .hero__bg::after { background: linear-gradient(…) }).
	const own = overlayFromPseudo( n ) ?? n.bgOverlay;
	if ( own ) {
		if ( out.overlay ) return null; // Two stacked overlays: keep as is.
		out.overlay = own;
	}
	return out.image || out.overlay ? out : null;
}

function overlayFromPseudo( n: IRNode ): BgOverlay | undefined {
	for ( const which of [ 'before', 'after' ] as const ) {
		const l = n.pseudoLayers?.[ which ];
		if ( ! l || ! pseudoCovers( l, n.rect ) ) continue;
		const opacity = parseFloat( l.opacity ?? '1' );
		if ( /gradient\(/.test( l[ 'background-image' ] ?? '' ) ) return { gradient: l[ 'background-image' ]!, opacity };
		if ( ! isTransparent( l[ 'background-color' ] ) ) return { color: l[ 'background-color' ]!, opacity };
	}
	return undefined;
}

function dropPseudo( n: IRNode ): void {
	delete n.pseudoLayers;
	if ( n.pseudo && ! n.pseudo.before && ! n.pseudo.after ) delete n.pseudo;
}

/**
 * Lift covering paint layers into their parent, recursively. Only layers
 * painted *under* the content qualify: they come before every content child
 * (or sit at a negative z-index), and the parent can take a background image
 * (it has none of its own).
 */
export function liftBackgroundLayers( node: IRNode ): IRNode {
	node.children.forEach( liftBackgroundLayers );
	if ( node.kind !== 'container' ) return node;

	let image: Paint[ 'image' ];
	let overlay: BgOverlay | undefined;
	const lifted = new Set< IRNode >();
	let seenContent = false;
	for ( const c of node.children ) {
		const below = ! seenContent || parseFloat( c.styles.desktop[ 'z-index' ] ?? '0' ) < 0;
		const candidate = below && positioned( c.styles.desktop ) && covers( c.rect, node.rect ) && alwaysShown( c );
		const paint = candidate ? layerPaint( c ) : null;
		if ( ! paint ) {
			if ( ! ( positioned( c.styles.desktop ) && c.kind === 'container' && ! c.children.length ) ) seenContent = true;
			continue;
		}
		if ( paint.image ) {
			if ( image || overlay ) break; // A second image, or an image over an overlay: not a simple stack.
			image = paint.image;
		}
		if ( paint.overlay ) {
			if ( overlay ) break;
			overlay = paint.overlay;
		}
		lifted.add( c );
	}
	// The parent's own ::before/::after overlay counts too (hero::before { background: rgba(…) }).
	const ownOverlay = overlayFromPseudo( node );
	if ( ownOverlay && ! overlay && ( image || urlOf( node.styles.desktop[ 'background-image' ] ) ) ) {
		overlay = ownOverlay;
		dropPseudo( node );
	}
	if ( ! lifted.size && ! ( overlay && ownOverlay ) ) return node;
	// A parent that already paints its own image can't take another one.
	if ( image && urlOf( node.styles.desktop[ 'background-image' ] ) ) return node;
	// An overlay alone (no image anywhere) is just the parent's background.
	if ( overlay && ! image && ! urlOf( node.styles.desktop[ 'background-image' ] ) ) {
		if ( ! isTransparent( node.styles.desktop[ 'background-color' ] ) || node.styles.desktop[ 'background-image' ] ) return node;
	}

	const d: StyleMap = { ...node.styles.desktop };
	if ( image ) {
		d[ 'background-image' ] = `url("${ image.url }")`;
		d[ 'background-size' ] = image.size;
		d[ 'background-position' ] = image.position;
		d[ 'background-repeat' ] = image.repeat;
		// A faded image over the section color is that color laid over the image.
		if ( image.opacity < 0.99 && ! overlay && ! isTransparent( d[ 'background-color' ] ) ) {
			overlay = { color: d[ 'background-color' ]!, opacity: round( 1 - image.opacity ) };
		}
	}
	if ( overlay && ! image && ! urlOf( d[ 'background-image' ] ) ) {
		// Plain color/gradient layer and nothing under it: the parent's own background.
		if ( overlay.gradient ) d[ 'background-image' ] = overlay.gradient;
		else if ( overlay.color ) d[ 'background-color' ] = withAlpha( overlay.color, overlay.opacity );
		overlay = undefined;
	}
	node.styles = { ...node.styles, desktop: d };
	if ( overlay ) node.bgOverlay = overlay;
	node.children = node.children.filter( ( c ) => ! lifted.has( c ) );
	return node;
}

/** A color with an extra opacity multiplied into its alpha. */
export function withAlpha( color: string, opacity: number ): string {
	const c = parseColor( color );
	if ( ! c || opacity >= 0.999 ) return color;
	return `rgba(${ c.r }, ${ c.g }, ${ c.b }, ${ round( c.a * opacity ) })`;
}
