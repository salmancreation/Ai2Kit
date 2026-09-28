/**
 * DOM capture (FR-6 … FR-10). Runs on the main thread against the sandbox
 * iframe's document. Everything after capture is pure.
 */
import type { Breakpoint, Capture, CaptureMeta, CapturedNode, Rect, StyleMap } from '../ir/types';
import { STYLE_PROPS, TEXT_PROPS, isDefault } from './styleProps';
import { freezeElement, sanitizeInline, serializeSvg } from './freeze';

export const KEY_ATTR = 'data-a2k-key';

export type CaptureEnv = {
	doc: Document;
	win: Window;
	/** Override for tests: the DOM measurement of an element. */
	measure?: ( el: Element ) => Rect;
};

const SKIP_TAGS = new Set( [ 'script', 'style', 'noscript', 'template', 'meta', 'link', 'head', 'title', 'base' ] );

/** Elements captured as a single leaf; their descendants are not walked. */
const LEAF_TAGS = new Set( [ 'img', 'svg', 'video', 'iframe', 'hr', 'canvas', 'input', 'textarea', 'select', 'picture', 'audio' ] );

/** Elements that can't be mapped natively in Free and are frozen for HTML fallback. */
export const FREEZE_TAGS = new Set( [ 'form', 'table', 'canvas', 'select', 'textarea', 'input', 'details', 'audio', 'object', 'embed' ] );

const INLINE_TAGS = new Set( [
	'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 's', 'samp',
	'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'del', 'ins', 'label',
] );

const ATTR_ALLOW = /^(id|href|src|srcset|alt|title|role|type|target|rel|poster|name|placeholder|value|for|tabindex|aria-.*|data-state|data-orientation|data-radix-.*|data-slot|data-lov-.*|data-embla.*|data-swiper.*|data-motion.*|class)$/;

export function measureRect( el: Element ): Rect {
	const r = el.getBoundingClientRect();
	const win = el.ownerDocument.defaultView;
	return {
		x: Math.round( r.left + ( win?.scrollX ?? 0 ) ),
		y: Math.round( r.top + ( win?.scrollY ?? 0 ) ),
		w: Math.round( r.width ),
		h: Math.round( r.height ),
	};
}

export function readStyles( el: Element, win: Window ): StyleMap {
	const cs = win.getComputedStyle( el );
	const out: StyleMap = {};
	for ( const prop of STYLE_PROPS ) {
		const v = cs.getPropertyValue( prop );
		if ( v && ! isDefault( prop, v ) ) out[ prop ] = v.trim();
	}
	return out;
}

function isVisible( el: Element, styles: StyleMap, rect: Rect ): boolean {
	if ( styles.display === 'none' ) return false;
	const cs = el.ownerDocument.defaultView?.getComputedStyle( el );
	if ( cs && cs.visibility === 'hidden' ) return false;
	if ( el.getAttribute( 'aria-hidden' ) === 'true' && el.tagName.toLowerCase() !== 'svg' && rect.w * rect.h === 0 ) return false;
	if ( el.hasAttribute( 'hidden' ) ) return false;
	return rect.w > 0 || rect.h > 0 || el.children.length > 0;
}

function directText( el: Element ): string {
	let s = '';
	el.childNodes.forEach( ( n ) => {
		if ( n.nodeType === 3 ) s += n.textContent ?? '';
	} );
	return s.replace( /\s+/g, ' ' ).trim();
}

function isInlineLevel( el: Element, win: Window ): boolean {
	const tag = el.tagName.toLowerCase();
	if ( ! INLINE_TAGS.has( tag ) ) return false;
	const d = win.getComputedStyle( el ).display;
	return d === 'inline' || d === '' || ( tag === 'br' );
}

/** True when the element's content is text + inline formatting only (a rich-text leaf). */
function isInlineContent( el: Element, win: Window ): boolean {
	if ( ! ( el.textContent ?? '' ).trim() ) return false;
	for ( const child of Array.from( el.children ) ) {
		if ( ! isInlineLevel( child, win ) ) return false;
		if ( child.querySelector( 'img,svg,video,iframe,div,p,ul,ol' ) ) return false;
	}
	return true;
}

/** Whether an inline icon sits before or after the label text. */
function iconPosition( el: Element, svg: Element ): 'before' | 'after' {
	const walker = el.ownerDocument.createTreeWalker( el, 4 /* NodeFilter.SHOW_TEXT */ );
	for ( let t = walker.nextNode(); t; t = walker.nextNode() ) {
		if ( ! ( t.textContent ?? '' ).trim() ) continue;
		// DOCUMENT_POSITION_FOLLOWING (4): the text comes after the svg.
		return svg.compareDocumentPosition( t ) & 4 ? 'before' : 'after';
	}
	return 'before';
}

function collectAttrs( el: Element ): Record< string, string > {
	const out: Record< string, string > = {};
	for ( const a of Array.from( el.attributes ) ) {
		if ( ATTR_ALLOW.test( a.name ) ) out[ a.name ] = a.value.length > 500 ? a.value.slice( 0, 500 ) : a.value;
	}
	// Resolve URLs to absolute so later stages never guess the base.
	const anyEl = el as Element & { href?: unknown; src?: unknown; currentSrc?: string };
	if ( typeof anyEl.href === 'string' && out.href !== undefined ) out.href = anyEl.href;
	if ( el.tagName.toLowerCase() === 'img' ) {
		const img = el as HTMLImageElement;
		const src = img.currentSrc || img.src;
		if ( src ) out.src = src;
	} else if ( typeof anyEl.src === 'string' && out.src !== undefined ) {
		out.src = anyEl.src;
	}
	return out;
}

function pseudo( el: Element, win: Window, which: '::before' | '::after' ): string | undefined {
	try {
		const c = win.getComputedStyle( el, which ).content;
		if ( c && c !== 'none' && c !== 'normal' && c !== '""' ) return c;
	} catch {
		/* not supported in this environment */
	}
	return undefined;
}

type WalkCtx = { env: CaptureEnv; next: () => string; measure: ( el: Element ) => Rect };

function walk( el: Element, ctx: WalkCtx ): CapturedNode | null {
	const { win } = ctx.env;
	const tag = el.tagName.toLowerCase();
	if ( SKIP_TAGS.has( tag ) ) return null;

	const styles = readStyles( el, win );
	const rect = ctx.measure( el );
	if ( ! isVisible( el, styles, rect ) ) return null;

	let key = el.getAttribute( KEY_ATTR );
	if ( ! key ) {
		key = ctx.next();
		el.setAttribute( KEY_ATTR, key );
	}

	const node: CapturedNode = { key, tag, attrs: collectAttrs( el ), rect, styles: { desktop: styles }, children: [] };

	const before = pseudo( el, win, '::before' );
	const after = pseudo( el, win, '::after' );
	if ( before || after ) node.pseudo = { ...( before ? { before } : {} ), ...( after ? { after } : {} ) };

	if ( tag === 'svg' ) {
		node.svg = serializeSvg( el, win );
		return node;
	}
	if ( tag === 'picture' ) {
		const img = el.querySelector( 'img' );
		if ( img ) {
			const src = ( img as HTMLImageElement ).currentSrc || ( img as HTMLImageElement ).src;
			node.tag = 'img';
			node.attrs = { ...collectAttrs( img ), src };
		}
		return node;
	}
	if ( FREEZE_TAGS.has( tag ) ) {
		node.frozen = freezeElement( el, win );
		node.text = ( el.textContent ?? '' ).replace( /\s+/g, ' ' ).trim();
		if ( ! LEAF_TAGS.has( tag ) ) {
			// Still walk forms/tables so the IR has structure for scoring.
			walkChildren( el, node, ctx );
		}
		return node;
	}
	if ( LEAF_TAGS.has( tag ) ) return node;

	const inlineLeaf = isInlineContent( el, win ) || ( ( tag === 'a' || tag === 'button' ) && ! el.querySelector( 'div,p,h1,h2,h3,h4,h5,h6,img,ul,ol,section,article' ) );
	if ( inlineLeaf ) {
		node.text = ( el.textContent ?? '' ).replace( /\s+/g, ' ' ).trim();
		const rules: CapturedNode[ 'inlineRules' ] = [];
		node.html = sanitizeInline( el, win, rules );
		if ( rules.length ) node.inlineRules = rules;
		const svg = el.querySelector( 'svg' );
		if ( svg ) {
			node.svg = serializeSvg( svg, win );
			const cls = svg.getAttribute( 'class' );
			if ( cls ) node.attrs[ 'data-a2k-icon' ] = cls;
			node.attrs[ 'data-a2k-icon-pos' ] = iconPosition( el, svg );
		}
		return node;
	}

	walkChildren( el, node, ctx );
	return node;
}

function walkChildren( el: Element, node: CapturedNode, ctx: WalkCtx ): void {
	const { win } = ctx.env;
	const text = directText( el );
	const hasText = text.length > 0;
	let parentText: StyleMap | null = null;
	if ( hasText ) {
		parentText = {};
		const cs = win.getComputedStyle( el );
		for ( const p of TEXT_PROPS ) {
			const v = cs.getPropertyValue( p );
			if ( v && ! isDefault( p, v ) ) parentText[ p ] = v;
		}
	}

	el.childNodes.forEach( ( child ) => {
		if ( child.nodeType === 3 ) {
			const t = ( child.textContent ?? '' ).replace( /\s+/g, ' ' ).trim();
			if ( t && parentText ) {
				// Text mixed with block siblings: synthesize a text leaf.
				node.children.push( {
					key: `${ node.key }-t${ node.children.length }`,
					tag: '#text',
					attrs: {},
					text: t,
					html: escapeHtml( t ),
					rect: { ...node.rect, h: 0 },
					styles: { desktop: { ...parentText, display: 'block' } },
					children: [],
				} );
			}
			return;
		}
		if ( child.nodeType !== 1 ) return;
		const c = walk( child as Element, ctx );
		if ( c ) node.children.push( c );
	} );
}

function escapeHtml( s: string ): string {
	return s.replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' );
}

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|emoji|math)$/i;

/**
 * A font stack reduced to the families that can actually render, so the IR
 * records what the visitor saw (a stack naming "Inter" that never loaded
 * rendered in the fallback). Uses canvas text metrics against generic
 * fallbacks; returns the stack unchanged where canvas isn't available.
 */
export function renderedFontStack( doc: Document, stack: string, cache: Map< string, boolean > = new Map() ): string {
	const canvas = doc.createElement( 'canvas' );
	const ctx = typeof canvas.getContext === 'function' ? ( canvas.getContext( '2d' ) as CanvasRenderingContext2D | null ) : null;
	if ( ! ctx || typeof ctx.measureText !== 'function' ) return stack;
	const sample = 'mmmmmmmmmmlli1WQ@#&ÄÅ';
	const width = ( font: string ): number => {
		ctx.font = `72px ${ font }`;
		return ctx.measureText( sample ).width;
	};
	const available = ( fam: string ): boolean => {
		if ( GENERIC.test( fam ) ) return true;
		const hit = cache.get( fam );
		if ( hit !== undefined ) return hit;
		const quoted = `"${ fam.replace( /"/g, '' ) }"`;
		const ok = [ 'monospace', 'serif', 'sans-serif' ].some( ( base ) => width( `${ quoted }, ${ base }` ) !== width( base ) );
		cache.set( fam, ok );
		return ok;
	};
	const parts = stack.split( ',' ).map( ( f ) => f.trim() ).filter( Boolean );
	const kept = parts.filter( ( f ) => available( f.replace( /^["']|["']$/g, '' ) ) );
	return kept.length ? kept.join( ', ' ) : stack;
}

function resolveFonts( root: CapturedNode, doc: Document ): void {
	const stacks = new Map< string, string >();
	const cache = new Map< string, boolean >();
	const visit = ( n: CapturedNode ): void => {
		const ff = n.styles.desktop[ 'font-family' ];
		if ( ff ) {
			if ( ! stacks.has( ff ) ) stacks.set( ff, renderedFontStack( doc, ff, cache ) );
			n.styles.desktop[ 'font-family' ] = stacks.get( ff )!;
		}
		n.children.forEach( visit );
	};
	visit( root );
}

/** Capture the full tree at the current viewport width (the desktop pass). */
export function captureTree( env: CaptureEnv ): CapturedNode {
	let n = 0;
	const ctx: WalkCtx = { env, next: () => `n${ ++n }`, measure: env.measure ?? measureRect };
	// Reuse keys from a previous pass when present (re-capture after route change).
	const body = env.doc.body;
	const root = walk( body, ctx );
	if ( ! root ) throw new Error( 'The page rendered no visible content.' );
	resolveFonts( root, env.doc );
	return root;
}

/** Style snapshot at the current width, keyed by node key. Visible nodes only. */
export function captureStyles( env: CaptureEnv ): Map< string, { styles: StyleMap; rect: Rect; visible: boolean } > {
	const measure = env.measure ?? measureRect;
	const out = new Map< string, { styles: StyleMap; rect: Rect; visible: boolean } >();
	// Resolve font stacks exactly like the desktop pass, or every breakpoint would
	// record a spurious font-family change.
	const stacks = new Map< string, string >();
	const cache = new Map< string, boolean >();
	env.doc.querySelectorAll( `[${ KEY_ATTR }]` ).forEach( ( el ) => {
		const styles = readStyles( el, env.win );
		const ff = styles[ 'font-family' ];
		if ( ff ) {
			if ( ! stacks.has( ff ) ) stacks.set( ff, renderedFontStack( env.doc, ff, cache ) );
			styles[ 'font-family' ] = stacks.get( ff )!;
		}
		const rect = measure( el );
		out.set( el.getAttribute( KEY_ATTR )!, { styles, rect, visible: isVisible( el, styles, rect ) } );
	} );
	return out;
}

/**
 * Merge a breakpoint snapshot into the tree as diffs from desktop (FR-10:
 * "per-breakpoint diffs only"). Hidden-at-breakpoint nodes get display:none.
 */
export function applyBreakpoint(
	root: CapturedNode,
	bp: Exclude< Breakpoint, 'desktop' >,
	snapshot: Map< string, { styles: StyleMap; visible: boolean; rect?: Rect } >
): void {
	const visit = ( node: CapturedNode ): void => {
		const snap = snapshot.get( node.key );
		if ( snap ) {
			if ( snap.rect && snap.visible ) node.rects = { ...node.rects, [ bp ]: snap.rect };
			const diff: StyleMap = {};
			const desk = node.styles.desktop;
			if ( ! snap.visible ) {
				diff.display = 'none';
			} else {
				const keys = new Set( [ ...Object.keys( desk ), ...Object.keys( snap.styles ) ] );
				for ( const k of keys ) {
					const a = desk[ k ];
					const b = snap.styles[ k ];
					if ( a === b ) continue;
					if ( k === 'width' || k === 'height' ) continue; // Used sizes always differ; layout drives them.
					diff[ k ] = b ?? defaultFor( k );
				}
			}
			// A tablet diff that repeats onto mobile is inherited by Elementor; keep mobile minimal.
			if ( bp === 'mobile' && node.styles.tablet ) {
				for ( const k of Object.keys( diff ) ) {
					if ( node.styles.tablet[ k ] === diff[ k ] ) delete diff[ k ];
				}
			}
			if ( Object.keys( diff ).length ) node.styles[ bp ] = diff;
		}
		node.children.forEach( visit );
	};
	visit( root );
}

function defaultFor( prop: string ): string {
	const map: Record< string, string > = {
		'background-color': 'rgba(0, 0, 0, 0)',
		'box-shadow': 'none',
		'max-width': 'none',
		'text-align': 'start',
		'flex-wrap': 'nowrap',
		'grid-template-columns': 'none',
		'row-gap': '0px',
		'column-gap': '0px',
	};
	if ( map[ prop ] ) return map[ prop ]!;
	if ( /^(padding|margin|border)-/.test( prop ) ) return '0px';
	return 'initial';
}

const SHADCN_VARS = [
	'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground',
	'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive',
	'destructive-foreground', 'border', 'input', 'ring', 'radius',
];

export function captureMeta( env: CaptureEnv, viewport: Record< Breakpoint, number > ): CaptureMeta {
	const { doc, win } = env;
	const rootCs = win.getComputedStyle( doc.documentElement );
	const rootVars: Record< string, string > = {};
	for ( const v of SHADCN_VARS ) {
		const val = rootCs.getPropertyValue( `--${ v }` ).trim();
		if ( val ) rootVars[ v ] = val;
	}

	const families = new Set< string >();
	doc.querySelectorAll( 'link[href*="fonts.googleapis.com"]' ).forEach( ( l ) => {
		const href = l.getAttribute( 'href' ) ?? '';
		for ( const m of href.matchAll( /family=([^:&]+)/g ) ) families.add( decodeURIComponent( m[ 1 ]!.replace( /\+/g, ' ' ) ) );
	} );
	try {
		for ( const sheet of Array.from( doc.styleSheets ) ) {
			let rules: CSSRuleList;
			try {
				rules = sheet.cssRules;
			} catch {
				continue; // Cross-origin sheet.
			}
			for ( const rule of Array.from( rules ) ) {
				if ( rule.constructor.name === 'CSSFontFaceRule' || /^@font-face/.test( rule.cssText ) ) {
					const fam = ( rule as CSSStyleRule ).style?.getPropertyValue( 'font-family' );
					if ( fam ) families.add( fam.replace( /["']/g, '' ).trim() );
				}
			}
		}
	} catch {
		/* ignore */
	}

	return {
		title: doc.title || 'Untitled',
		lang: doc.documentElement.lang || 'en',
		viewport,
		rootVars,
		fontFamilies: [ ...families ],
		baseUrl: doc.baseURI,
	};
}

export const DEFAULT_VIEWPORT: Record< Breakpoint, number > = { desktop: 1440, tablet: 1024, mobile: 390 };

/**
 * Full three-breakpoint capture. `resize` sets the iframe width and resolves
 * once layout has settled; the caller owns the iframe.
 */
export async function captureAll(
	env: CaptureEnv,
	resize: ( width: number ) => Promise< void >,
	viewport: Record< Breakpoint, number > = DEFAULT_VIEWPORT,
	onStage?: ( stage: Breakpoint ) => void
): Promise< Capture > {
	onStage?.( 'desktop' );
	await resize( viewport.desktop );
	const root = captureTree( env );
	const meta = captureMeta( env, viewport );

	onStage?.( 'tablet' );
	await resize( viewport.tablet );
	applyBreakpoint( root, 'tablet', captureStyles( env ) );

	onStage?.( 'mobile' );
	await resize( viewport.mobile );
	applyBreakpoint( root, 'mobile', captureStyles( env ) );

	await resize( viewport.desktop );
	return { meta, root };
}
