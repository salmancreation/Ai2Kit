/**
 * Turning live DOM into self-contained HTML strings: inline rich text for
 * Text Editor widgets, serialized SVG for icons, and "frozen" HTML (computed
 * styles inlined) for the HTML fallback.
 */
import { STYLE_PROPS, isDefault } from './styleProps';

const INLINE_ALLOWED = new Set( [ 'a', 'strong', 'b', 'em', 'i', 'u', 'br', 'code', 'small', 'mark', 'sub', 'sup', 's', 'span', 'del', 'ins' ] );

function esc( s: string ): string {
	return s.replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
}

/** Typography that inline elements may override relative to their parent. */
const INLINE_STYLE_PROPS = [ 'color', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-transform', 'background-color', 'text-decoration-line' ];

/** Declarations where the element's computed style differs from its parent's. */
function inlineStyleDiff( e: Element, win: Window, tag: string ): string {
	const parent = e.parentElement;
	if ( ! parent ) return '';
	const cs = win.getComputedStyle( e );
	const ps = win.getComputedStyle( parent );
	const decl: string[] = [];
	for ( const p of INLINE_STYLE_PROPS ) {
		const v = cs.getPropertyValue( p );
		if ( ! v || v === ps.getPropertyValue( p ) ) continue;
		if ( p === 'background-color' && /rgba\(0, 0, 0, 0\)|transparent/.test( v ) ) continue;
		// Implied by the tag itself.
		if ( p === 'font-weight' && ( tag === 'strong' || tag === 'b' ) ) continue;
		if ( p === 'font-style' && ( tag === 'em' || tag === 'i' ) ) continue;
		if ( p === 'text-decoration-line' && tag === 'u' ) continue;
		decl.push( `${ p }:${ v }` );
	}
	return decl.join( ';' ).replace( /"/g, "'" );
}

/**
 * Inner HTML restricted to inline formatting; everything else becomes text.
 * With a window, inline elements keep typography that differs from their
 * parent (e.g. a smaller, grey "/ mo" after a price) as a style attribute.
 */
export function sanitizeInline( el: Element, win?: Window ): string {
	const out: string[] = [];
	const visit = ( n: Node ): void => {
		if ( n.nodeType === 3 ) {
			out.push( esc( ( n.textContent ?? '' ).replace( /\s+/g, ' ' ) ) );
			return;
		}
		if ( n.nodeType !== 1 ) return;
		const e = n as Element;
		const tag = e.tagName.toLowerCase();
		if ( tag === 'svg' || tag === 'script' || tag === 'style' ) return;
		if ( tag === 'br' ) {
			out.push( '<br>' );
			return;
		}
		const style = win ? inlineStyleDiff( e, win, tag ) : '';
		if ( ! INLINE_ALLOWED.has( tag ) || tag === 'span' ) {
			if ( style ) {
				out.push( `<span style="${ esc( style ) }">` );
				e.childNodes.forEach( visit );
				out.push( '</span>' );
			} else {
				e.childNodes.forEach( visit );
			}
			return;
		}
		let attrs = '';
		if ( tag === 'a' ) {
			const href = ( e as HTMLAnchorElement ).href || e.getAttribute( 'href' ) || '';
			if ( href && ! /^\s*javascript:/i.test( href ) ) attrs += ` href="${ esc( href ) }"`;
			if ( e.getAttribute( 'target' ) === '_blank' ) attrs += ' target="_blank" rel="noopener"';
		}
		if ( style ) attrs += ` style="${ esc( style ) }"`;
		out.push( `<${ tag }${ attrs }>` );
		e.childNodes.forEach( visit );
		out.push( `</${ tag }>` );
	};
	el.childNodes.forEach( visit );
	return out.join( '' ).replace( /\s+/g, ' ' ).trim();
}

const SVG_ATTR_BLOCK = /^(on.*|style|class|data-a2k-key)$/i;

/** Serialize an SVG with `currentColor` resolved and scripts/handlers removed. */
export function serializeSvg( svg: Element, win: Window ): string {
	const clone = svg.cloneNode( true ) as Element;
	const color = win.getComputedStyle( svg ).color || '#000';
	const clean = ( e: Element ): void => {
		for ( const a of Array.from( e.attributes ) ) {
			if ( SVG_ATTR_BLOCK.test( a.name ) || /javascript:/i.test( a.value ) ) e.removeAttribute( a.name );
			else if ( a.value === 'currentColor' ) e.setAttribute( a.name, color );
		}
		Array.from( e.children ).forEach( ( c ) => {
			if ( c.tagName.toLowerCase() === 'script' || c.tagName.toLowerCase() === 'foreignobject' ) c.remove();
			else clean( c );
		} );
	};
	clean( clone );
	// Outline icons (fill="none" on the root): Elementor paints `fill` on uploaded SVG icons,
	// so shapes carry their own fill="none" to stay outlines.
	if ( ( clone.getAttribute( 'fill' ) ?? '' ).toLowerCase() === 'none' ) {
		clone.querySelectorAll( 'path,circle,ellipse,line,polyline,polygon,rect' ).forEach( ( shape ) => {
			if ( ! shape.hasAttribute( 'fill' ) ) shape.setAttribute( 'fill', 'none' );
		} );
	}
	if ( ! clone.getAttribute( 'xmlns' ) ) clone.setAttribute( 'xmlns', 'http://www.w3.org/2000/svg' );
	return clone.outerHTML;
}

const FREEZE_EXTRA = [ 'visibility', 'white-space', 'list-style-type', 'text-decoration-color', 'vertical-align', 'cursor', 'box-sizing' ];

export type ResponsiveDiffs = Map< string, { tablet?: Partial< Record< string, string > >; mobile?: Partial< Record< string, string > > } >;

/** Elementor's default breakpoints (tablet ≤ 1024, mobile ≤ 767). */
const MEDIA = { tablet: '(max-width:1024px)', mobile: '(max-width:767px)' };

/**
 * Clone an element with its computed styles inlined, so it renders the same
 * inside an Elementor HTML widget without the source stylesheet. When
 * per-breakpoint diffs are given (keyed by data-a2k-key), a scoped <style>
 * with media queries keeps the fallback responsive.
 */
export function freezeElement( el: Element, win: Window, responsive?: ResponsiveDiffs ): string {
	const clone = el.cloneNode( true ) as Element;
	const srcAll = [ el, ...Array.from( el.querySelectorAll( '*' ) ) ];
	const dstAll = [ clone, ...Array.from( clone.querySelectorAll( '*' ) ) ];
	const rules: Record< 'tablet' | 'mobile', string[] > = { tablet: [], mobile: [] };

	srcAll.forEach( ( src, i ) => {
		const dst = dstAll[ i ];
		if ( ! dst ) return;
		const tag = src.tagName.toLowerCase();
		if ( tag === 'script' || tag === 'noscript' ) {
			dst.remove();
			return;
		}
		const cs = win.getComputedStyle( src );
		const decl: string[] = [];
		for ( const p of [ ...STYLE_PROPS, ...FREEZE_EXTRA ] ) {
			const v = cs.getPropertyValue( p );
			if ( ! v || isDefault( p, v ) ) continue;
			if ( ( p === 'width' || p === 'height' ) && tag !== 'img' && tag !== 'svg' ) continue;
			decl.push( `${ p }:${ v }` );
		}
		const key = src.getAttribute( 'data-a2k-key' );
		for ( const a of Array.from( dst.attributes ) ) {
			if ( /^on/i.test( a.name ) || a.name === 'class' || a.name.startsWith( 'data-' ) || /javascript:/i.test( a.value ) ) {
				dst.removeAttribute( a.name );
			}
		}
		const diffs = key ? responsive?.get( key ) : undefined;
		if ( key && diffs && ( diffs.tablet || diffs.mobile ) ) {
			dst.setAttribute( 'data-a2k-r', key );
			for ( const bp of [ 'tablet', 'mobile' ] as const ) {
				const d = diffs[ bp ];
				if ( ! d ) continue;
				const body = Object.entries( d )
					.filter( ( [ , v ] ) => v !== undefined && v !== 'initial' )
					.map( ( [ k, v ] ) => `${ k }:${ v }!important` )
					.join( ';' );
				if ( body ) rules[ bp ].push( `[data-a2k-r="${ key }"]{${ body }}` );
			}
		}
		// Absolute URLs so the fallback works outside the job folder.
		const anySrc = src as Element & { src?: unknown; href?: unknown };
		if ( typeof anySrc.src === 'string' && anySrc.src ) dst.setAttribute( 'src', anySrc.src );
		if ( typeof anySrc.href === 'string' && anySrc.href && tag === 'a' ) dst.setAttribute( 'href', anySrc.href );
		if ( decl.length ) dst.setAttribute( 'style', decl.join( ';' ) );
	} );

	const css = ( [ 'tablet', 'mobile' ] as const )
		.filter( ( bp ) => rules[ bp ].length )
		.map( ( bp ) => `@media ${ MEDIA[ bp ] }{${ rules[ bp ].join( '' ) }}` )
		.join( '' );
	return ( css ? `<style>${ css }</style>` : '' ) + clone.outerHTML;
}

/** Collect per-breakpoint diffs from a captured tree, for responsive freezing. */
export function responsiveDiffs( root: { key: string; styles: { tablet?: Partial< Record< string, string > >; mobile?: Partial< Record< string, string > > }; children: unknown[] } ): ResponsiveDiffs {
	const out: ResponsiveDiffs = new Map();
	const visit = ( n: typeof root ): void => {
		if ( n.styles.tablet || n.styles.mobile ) out.set( n.key, { tablet: n.styles.tablet, mobile: n.styles.mobile } );
		( n.children as Array< typeof root > ).forEach( visit );
	};
	visit( root );
	return out;
}
