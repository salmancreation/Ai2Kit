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

import type { ResidualRule } from '../ir/types';

/** The gradient of a gradient-text element (background clipped to text), or null. */
export function gradientText( e: Element, win: Window ): string | null {
	const cs = win.getComputedStyle( e );
	const clip = cs.getPropertyValue( 'background-clip' ) || cs.getPropertyValue( '-webkit-background-clip' );
	const img = cs.getPropertyValue( 'background-image' );
	return clip === 'text' && /gradient\(/.test( img ) ? img : null;
}

export function gradientDecls( gradient: string ): Record< string, string > {
	return {
		'background-image': gradient,
		'-webkit-background-clip': 'text',
		'background-clip': 'text',
		color: 'transparent',
		'-webkit-text-fill-color': 'transparent',
	};
}

function hash( s: string ): string {
	let h = 0x811c9dc5;
	for ( let i = 0; i < s.length; i++ ) h = Math.imul( h ^ s.charCodeAt( i ), 0x01000193 );
	return ( h >>> 0 ).toString( 36 ).slice( 0, 6 );
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
export function sanitizeInline( el: Element, win?: Window, rules?: ResidualRule[] ): string {
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
		let style = win ? inlineStyleDiff( e, win, tag ) : '';
		// Gradient text (bg-clip-text + transparent color): a class with a residual rule,
		// since inline styles can't carry background-clip through wp_kses.
		let cls = '';
		if ( win && rules ) {
			const g = gradientText( e, win );
			if ( g ) {
				cls = `a2k-gt-${ hash( g ) }`;
				if ( ! rules.some( ( r ) => r.className === cls ) ) rules.push( { className: cls, breakpoint: 'desktop', decls: gradientDecls( g ) } );
				style = style.split( ';' ).filter( ( d ) => d && ! /^(color|background-color):/.test( d ) ).join( ';' );
			}
		}
		if ( cls ) {
			out.push( `<span class="${ cls }"${ style ? ` style="${ esc( style ) }"` : '' }>` );
			e.childNodes.forEach( visit );
			out.push( '</span>' );
			return;
		}
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

const SVG_SHAPES = 'path,circle,ellipse,line,polyline,polygon,rect,text,tspan,use';

/**
 * Paint properties baked from computed style onto every shape. Source icons
 * are often colored by CSS (`.pill svg { fill: … }`, Tailwind `fill-*`,
 * `style=""`), which the class/style stripping below — and the SVG
 * sanitizer on the server — would otherwise lose.
 */
const SVG_PAINT = [ 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity' ];
const PAINT_DEFAULT: Record< string, string > = { 'fill-opacity': '1', 'fill-rule': 'nonzero', 'stroke-opacity': '1', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-dasharray': 'none', opacity: '1' };

/** Inline `<use href="#id">` references (icon sprites) so the icon is self-contained. */
function inlineUses( clone: Element, doc: Document ): void {
	clone.querySelectorAll( 'use' ).forEach( ( use ) => {
		const ref = use.getAttribute( 'href' ) ?? use.getAttribute( 'xlink:href' ) ?? '';
		const id = ref.slice( 1 );
		// Local references (a gradient or shape defined inside this icon) already travel with it.
		if ( ! ref.startsWith( '#' ) || Array.from( clone.querySelectorAll( '[id]' ) ).some( ( e ) => e.id === id ) ) return;
		const target = doc.getElementById( id );
		if ( ! target ) return;
		const g = doc.createElementNS( 'http://www.w3.org/2000/svg', 'g' );
		Array.from( target.childNodes ).forEach( ( n ) => g.appendChild( n.cloneNode( true ) ) );
		for ( const a of [ 'transform', ...SVG_PAINT ] ) {
			const v = use.getAttribute( a );
			if ( v ) g.setAttribute( a, v );
		}
		// <use x y> offsets the referenced content.
		const x = parseFloat( use.getAttribute( 'x' ) ?? '0' ) || 0;
		const y = parseFloat( use.getAttribute( 'y' ) ?? '0' ) || 0;
		if ( x || y ) g.setAttribute( 'transform', `${ g.getAttribute( 'transform' ) ?? '' } translate(${ x } ${ y })`.trim() );
		// A <symbol>'s viewBox becomes the icon's, when the icon has none.
		const vb = target.getAttribute( 'viewBox' );
		if ( vb && ! clone.getAttribute( 'viewBox' ) ) clone.setAttribute( 'viewBox', vb );
		use.replaceWith( g );
	} );
}

const num = ( v: string ): string => v.replace( /px$/, '' );

/**
 * Gradients, clip paths and masks referenced as url(#id) but defined outside
 * this icon (a shared <defs> elsewhere on the page) are copied into it, so the
 * uploaded icon doesn't lose them.
 */
function inlineRefs( clone: Element, doc: Document ): void {
	const have = new Set( Array.from( clone.querySelectorAll( '[id]' ) ).map( ( e ) => e.id ) );
	const needed = new Set< string >();
	for ( const e of [ clone, ...Array.from( clone.querySelectorAll( '*' ) ) ] ) {
		for ( const a of Array.from( e.attributes ) ) {
			for ( const m of a.value.matchAll( /url\(#([^)]+)\)/g ) ) if ( ! have.has( m[ 1 ]! ) ) needed.add( m[ 1 ]! );
		}
	}
	if ( ! needed.size ) return;
	let defs = clone.querySelector( 'defs' );
	if ( ! defs ) {
		defs = doc.createElementNS( 'http://www.w3.org/2000/svg', 'defs' );
		clone.insertBefore( defs, clone.firstChild );
	}
	for ( const id of needed ) {
		const src = doc.getElementById( id );
		if ( src && src.namespaceURI === 'http://www.w3.org/2000/svg' ) defs.appendChild( src.cloneNode( true ) );
	}
}

/**
 * Serialize an SVG so it renders the same outside the source page: computed
 * paint baked onto every shape (currentColor and CSS-driven colors resolved),
 * sprite references inlined, a viewBox guaranteed, and scripts, handlers,
 * classes and inline styles removed.
 */
export function serializeSvg( svg: Element, win: Window ): string {
	const doc = svg.ownerDocument;
	const clone = svg.cloneNode( true ) as Element;
	const color = win.getComputedStyle( svg ).color || '#000';

	// Bake paint from the live element onto its clone (same document order).
	const src = [ svg, ...Array.from( svg.querySelectorAll( SVG_SHAPES ) ) ];
	const dst = [ clone, ...Array.from( clone.querySelectorAll( SVG_SHAPES ) ) ];
	src.forEach( ( s, i ) => {
		const d = dst[ i ];
		if ( ! d ) return;
		const cs = win.getComputedStyle( s );
		for ( const p of SVG_PAINT ) {
			let v = cs.getPropertyValue( p ).trim();
			if ( ! v ) continue;
			if ( i === 0 && ( p === 'opacity' || v === PAINT_DEFAULT[ p ] ) ) continue;
			if ( i > 0 && v === PAINT_DEFAULT[ p ] && ! d.hasAttribute( p ) ) continue;
			if ( p === 'stroke-width' ) v = num( v );
			// Computed paint servers are absolute (url("https://…/page#grad")): keep them local.
			const ref = /^url\(\s*["']?[^"')]*#([^"')]+)["']?\s*\)/.exec( v );
			if ( ref ) v = `url(#${ ref[ 1 ] })`;
			if ( p === 'stroke-dasharray' && v !== 'none' ) v = v.split( ',' ).map( ( x ) => num( x.trim() ) ).join( ' ' );
			d.setAttribute( p, v );
		}
	} );

	// Outline icons: Elementor paints `fill` on the icon's root, so every shape states its own
	// fill="none" (also when computed style didn't report an inherited value).
	if ( ( clone.getAttribute( 'fill' ) ?? '' ).toLowerCase() === 'none' ) {
		clone.querySelectorAll( SVG_SHAPES ).forEach( ( shape ) => {
			if ( ! shape.hasAttribute( 'fill' ) ) shape.setAttribute( 'fill', 'none' );
		} );
	}

	inlineUses( clone, doc );

	const clean = ( e: Element ): void => {
		for ( const a of Array.from( e.attributes ) ) {
			if ( SVG_ATTR_BLOCK.test( a.name ) || /javascript:/i.test( a.value ) ) e.removeAttribute( a.name );
			else if ( /currentcolor/i.test( a.value ) ) e.setAttribute( a.name, a.value.replace( /currentcolor/gi, color ) );
			else if ( /url\(\s*["']?[^"')#]+#/.test( a.value ) ) e.setAttribute( a.name, a.value.replace( /url\(\s*["']?[^"')#]*#([^"')]+)["']?\s*\)/g, 'url(#$1)' ) );
		}
		Array.from( e.children ).forEach( ( c ) => {
			const tag = c.tagName.toLowerCase();
			if ( tag === 'script' || tag === 'foreignobject' || tag === 'style' ) c.remove();
			else clean( c );
		} );
	};
	clean( clone );
	// References resolved after cleaning (URLs are local by now); copied definitions are cleaned too.
	inlineRefs( clone, doc );
	clean( clone );

	// Without a viewBox, a resized icon (Elementor sizes icons to 1em) crops instead of scaling.
	if ( ! clone.getAttribute( 'viewBox' ) ) {
		const w = parseFloat( svg.getAttribute( 'width' ) ?? '' );
		const h = parseFloat( svg.getAttribute( 'height' ) ?? '' );
		let box: { x: number; y: number; width: number; height: number } | undefined;
		try {
			box = ( svg as SVGGraphicsElement ).getBBox?.();
		} catch {
			box = undefined; // Not rendered.
		}
		if ( w > 0 && h > 0 ) clone.setAttribute( 'viewBox', `0 0 ${ w } ${ h }` );
		else if ( box && box.width > 0 && box.height > 0 ) clone.setAttribute( 'viewBox', `${ box.x } ${ box.y } ${ box.width } ${ box.height }` );
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
